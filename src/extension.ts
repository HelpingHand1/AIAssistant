import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import * as path from 'path';
import { debounce } from 'lodash';

interface FileData {
    path: string;
    content: string;
}

interface ProjectIndexItem {
    path: string;
    symbols: string[];
}

interface ChatHistoryItem {
    user: string;
    ai: string;
}

interface ApiConfig {
    endpoint: string;
    apiKey: string | undefined;
    model: string;
    requestFormat: (input: string) => any;
}

let projectIndex: ProjectIndexItem[] = [];
const apiCache = new Map<string, string>();

async function readDirectoryRecursive(uri: vscode.Uri): Promise<FileData[]> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const files: FileData[] = [];
    const openFiles = vscode.window.visibleTextEditors.map(e => e.document.uri.fsPath);
    for (const [name, fileType] of entries) {
        const fileUri = vscode.Uri.file(path.join(uri.fsPath, name));
        if (fileType === vscode.FileType.File && /\.(ts|js)$/.test(name) && openFiles.includes(fileUri.fsPath)) {
            const data = await vscode.workspace.fs.readFile(fileUri);
            files.push({ path: fileUri.fsPath, content: data.toString() });
        } else if (fileType === vscode.FileType.Directory) {
            files.push(...await readDirectoryRecursive(fileUri));
        }
    }
    return files;
}

async function buildProjectIndex(): Promise<void> {
    const files = await readDirectoryRecursive(vscode.workspace.workspaceFolders![0].uri);
    const limitedFiles = files.slice(0, 10).map(file => ({
        path: file.path,
        symbols: file.content.match(/(function|class|const|let|var|def|public|private|interface|type)\s+(\w+)/g)?.slice(0, 50) || []
    }));
    projectIndex = limitedFiles;
}

async function getApiConfig(): Promise<ApiConfig> {
    const config = vscode.workspace.getConfiguration('myAiAssistant');
    const model = config.get('model') as string || 'gpt-3.5-turbo';
    return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: config.get('apiKey') as string | undefined,
        model: model,
        requestFormat: (input: string) => ({
            model: model,
            messages: [
                { role: 'system', content: 'You are a coding assistant. Respond with a detailed JSON object containing actions to create/edit files and folders. Use the full context provided and maximize your response within the token limit.' },
                { role: 'user', content: input }
            ],
            max_tokens: 2000,
            temperature: 0.7
        })
    };
}

async function applyChanges(aiResponse: string): Promise<void> {
    let changes: { path: string; range: any; newText: string }[] = [];
    try {
        const parsed = JSON.parse(aiResponse);
        if (parsed.actions && Array.isArray(parsed.actions)) {
            changes = parsed.actions;
        } else {
            throw new Error('No actions found in AI response');
        }
    } catch (e) {
        if (e instanceof Error) {
            vscode.window.showErrorMessage(`Invalid AI response: ${e.message}`);
        } else {
            vscode.window.showErrorMessage(`Invalid AI response: ${String(e)}`);
        }
        return;
    }

    for (const change of changes) {
        const uri = vscode.Uri.file(change.path);
        const document = await vscode.workspace.openTextDocument(uri);
        const oldText = document.getText(change.range);
        await vscode.commands.executeCommand('vscode.diff', uri, uri.with({ scheme: 'untitled' }), oldText, change.newText);
    }

    const apply = await vscode.window.showInformationMessage('Apply AI changes?', 'Yes', 'No');
    if (apply === 'Yes') {
        const edit = new vscode.WorkspaceEdit();
        for (const change of changes) {
            edit.replace(vscode.Uri.file(change.path), change.range, change.newText);
        }
        await vscode.workspace.applyEdit(edit);
        vscode.commands.executeCommand('git.stage');
        vscode.window.showInformationMessage('Changes applied and staged!');
    }
}

async function modifyProject(): Promise<void> {
    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        vscode.window.showErrorMessage('Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)');
        return;
    }

    const userPrompt = await vscode.window.showInputBox({ prompt: 'Describe how to modify the project' });
    if (!userPrompt) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace is open.');
        return;
    }

    await buildProjectIndex();
    const files = await readDirectoryRecursive(workspaceFolders[0].uri);
    const context = `Project Index (limited to 10 files): ${JSON.stringify(projectIndex)}\nFile Paths: ${files.map(f => f.path).join(', ')}\nInstructions: ${userPrompt}`;
    const truncatedContext = context.length > 2000 ? context.substring(0, 2000) + '...' : context;
    console.log(`Context length: ${truncatedContext.length} characters`);

    try {
        const response = await axios.post(
            apiConfig.endpoint,
            apiConfig.requestFormat(truncatedContext),
            { headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` } }
        );
        await applyChanges(response.data.choices[0].message.content);
    } catch (e) {
        if (e instanceof AxiosError) {
            console.error('API Error:', e.message, e.response?.status, e.response?.data);
            vscode.window.showErrorMessage(`Error: ${e.message}`);
        } else {
            console.error('Unknown Error:', String(e));
            vscode.window.showErrorMessage(`Error: ${String(e)}`);
        }
    }
}

async function editSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        vscode.window.showErrorMessage('Set your OpenAI API key!');
        return;
    }

    const selection = editor.selection;
    const code = editor.document.getText(selection);
    const prompt = await vscode.window.showInputBox({ prompt: 'How to edit this code?' });
    if (!prompt) return;

    try {
        const response = await axios.post(
            apiConfig.endpoint,
            apiConfig.requestFormat(`Code: ${code}\nEdit: ${prompt}`),
            { headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` } }
        );
        const newText = JSON.parse(response.data.choices[0].message.content).newText || response.data.choices[0].message.content || code;
        editor.edit(editBuilder => editBuilder.replace(selection, newText));
    } catch (e) {
        if (e instanceof AxiosError) {
            console.error('API Error:', e.message, e.response?.status, e.response?.data);
            vscode.window.showErrorMessage(`Error: ${e.message}`);
        } else {
            console.error('Unknown Error:', String(e));
            vscode.window.showErrorMessage(`Error: ${String(e)}`);
        }
    }

    const refine = await vscode.window.showInformationMessage('Looks good?', 'Yes', 'Refine');
    if (refine === 'Refine') editSelection();
}

const debouncedSendMessage = debounce(async (message: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext) => {
    const editor = vscode.window.activeTextEditor;
    const contextText = editor ? editor.document.getText().substring(0, 1000) : 'No active editor';
    const files = await readDirectoryRecursive(vscode.workspace.workspaceFolders![0].uri);
    const workspaceContext = `Project Index (sample): ${JSON.stringify(projectIndex.slice(0, 5))}\nActive File Snippet: ${contextText}`;
    const truncatedContext = workspaceContext.length > 2000 ? workspaceContext.substring(0, 2000) + '...' : workspaceContext;

    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        panel.webview.postMessage({ text: 'Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)' });
        return;
    }

    const systemPrompt = `You are a coding assistant. Respond with a JSON object containing actions to create/edit files and folders in the following format:
    {
        "actions": [
            { "type": "createFolder", "path": "relative/path/to/folder" },
            { "type": "createFile", "path": "relative/path/to/file.ts", "content": "file content" },
            { "type": "editFile", "path": "relative/path/to/file.ts", "range": { "startLine": 0, "startCharacter": 0, "endLine": 1, "endCharacter": 10 }, "newText": "new content" }
        ],
        "message": "Description of actions taken"
    }`;

    try {
        const response = await axios.post(
            `${apiConfig.endpoint}`,
            apiConfig.requestFormat(`${systemPrompt}\n${truncatedContext}\nUser Query: ${message}`),
            { headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` } }
        );
        const aiResponse = response.data.choices ? response.data.choices[0].message.content : response.data[0]?.generated_text || '{}';
        let parsedResponse: { actions?: Array<{ type: string, path: string, content?: string, range?: { startLine: number, startCharacter: number, endLine: number, endCharacter: number }, newText?: string }>, message?: string };
        try {
            parsedResponse = JSON.parse(aiResponse);
        } catch (e) {
            if (e instanceof Error) {
                parsedResponse = { message: `Error: AI response is not valid JSON: ${e.message}` };
            } else {
                parsedResponse = { message: `Error: AI response is not valid JSON: ${String(e)}` };
            }
        }

        const confirm = await vscode.window.showInformationMessage(
            parsedResponse.actions && parsedResponse.actions.length > 0
                ? `Apply these changes? ${parsedResponse.message || 'See actions in response.'}`
                : 'No actions to apply. Proceed anyway?',
            'Yes', 'No'
        );
        if (confirm !== 'Yes') {
            panel.webview.postMessage({ text: 'Changes discarded.' });
            return;
        }

        if (parsedResponse.actions && parsedResponse.actions.length > 0) {
            const edit = new vscode.WorkspaceEdit();
            for (const action of parsedResponse.actions) {
                const fullPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, action.path);
                const uri = vscode.Uri.file(fullPath);

                try {
                    if (action.type === 'createFolder') {
                        try {
                            await vscode.workspace.fs.stat(uri);
                            console.log(`Folder already exists: ${action.path}, skipping creation.`);
                        } catch {
                            await vscode.workspace.fs.createDirectory(uri);
                            console.log(`Created folder: ${action.path}`);
                        }
                    } else if (action.type === 'createFile') {
                        try {
                            await vscode.workspace.fs.stat(uri);
                            console.log(`File already exists: ${action.path}, skipping creation.`);
                        } catch {
                            const content = action.content || '';
                            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                            console.log(`Created file: ${action.path}`);
                        }
                    } else if (action.type === 'editFile') {
                        try {
                            const document = await vscode.workspace.openTextDocument(uri);
                            const range = new vscode.Range(
                                action.range?.startLine || 0,
                                action.range?.startCharacter || 0,
                                action.range?.endLine || 0,
                                action.range?.endCharacter || 0
                            );
                            edit.replace(uri, range, action.newText || '');
                            console.log(`Edited file: ${action.path}`);
                        } catch (e) {
                            if (e instanceof Error) {
                                console.error(`Error editing file ${action.path}: ${e.message}`);
                                panel.webview.postMessage({ text: `Error editing file ${action.path}: ${e.message}` });
                            } else {
                                console.error(`Error editing file ${action.path}: ${String(e)}`);
                                panel.webview.postMessage({ text: `Error editing file ${action.path}: ${String(e)}` });
                            }
                        }
                    }
                } catch (e) {
                    if (e instanceof Error) {
                        console.error(`Error processing action for ${action.path}: ${e.message}`);
                        panel.webview.postMessage({ text: `Error processing action for ${action.path}: ${e.message}` });
                    } else {
                        console.error(`Error processing action for ${action.path}: ${String(e)}`);
                        panel.webview.postMessage({ text: `Error processing action for ${action.path}: ${String(e)}` });
                    }
                }
            }
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('Changes applied!');
        }

        const reply = parsedResponse.message || 'No actions specified by AI.';
        panel.webview.postMessage({ text: reply });
        const history = context.globalState.get<ChatHistoryItem[]>('chatHistory', []);
        history.push({ user: message, ai: reply });
        context.globalState.update('chatHistory', history);
    } catch (e) {
        if (e instanceof AxiosError) {
            const errorDetails = e.response?.data ? JSON.stringify(e.response.data) : e.message;
            console.error('API Error:', e.message, e.response?.status, errorDetails);
            panel.webview.postMessage({ text: `Error: ${e.message} - ${errorDetails}` });
        } else {
            console.error('Unknown Error:', String(e));
            panel.webview.postMessage({ text: `Error: ${String(e)}` });
        }
    }
}, 500);

async function openChatPanel(context: vscode.ExtensionContext): Promise<void> {
    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        vscode.window.showErrorMessage('Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)');
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace is open.');
        return;
    }
    await buildProjectIndex();

    const panel = vscode.window.createWebviewPanel('aiChat', 'AI Assistant Chat', vscode.ViewColumn.Beside, { enableScripts: true });
    const history = context.globalState.get<ChatHistoryItem[]>('chatHistory', []);
    let historyHtml = history.map(h => `<div class="message user-message">${h.user}</div><div class="message ai-message">${h.ai}</div>`).join('');

    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Assistant Chat</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; height: 100vh; display: flex; flex-direction: column; background: #f5f5f5; color: #333; }
            #header { background: #007acc; color: white; padding: 10px; font-size: 16px; font-weight: bold; text-align: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
            #chatOutput { flex: 1; overflow-y: auto; padding: 15px; background: #fff; border-bottom: 1px solid #ddd; }
            .message { margin: 10px 0; padding: 10px; border-radius: 5px; max-width: 80%; word-wrap: break-word; }
            .user-message { background: #007acc; color: white; margin-left: auto; text-align: right; }
            .ai-message { background: #e0e0e0; color: #333; margin-right: auto; }
            #inputArea { display: flex; padding: 10px; background: #fff; border-top: 1px solid #ddd; box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05); }
            #chatInput { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 5px; resize: none; outline: none; font-size: 14px; }
            #chatInput:focus { border-color: #007acc; }
            #sendButton { margin-left: 10px; padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
            #sendButton:hover { background: #005f99; }
        </style>
    </head>
    <body>
        <div id="header">AI Assistant Chat</div>
        <div id="chatOutput">${historyHtml}</div>
        <div id="inputArea">
            <textarea id="chatInput" rows="3" placeholder="Ask me anything..."></textarea>
            <button id="sendButton" onclick="sendMessage()">Send</button>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const chatOutput = document.getElementById('chatOutput');
            const chatInput = document.getElementById('chatInput');
            function sendMessage() {
                const text = chatInput.value.trim();
                if (!text) return;
                appendMessage('user-message', text);
                vscode.postMessage({ command: 'chat', text });
                chatInput.value = '';
            }
            function appendMessage(className, text) {
                const div = document.createElement('div');
                div.className = 'message ' + className;
                div.textContent = text;
                chatOutput.appendChild(div);
                chatOutput.scrollTop = chatOutput.scrollHeight;
            }
            window.addEventListener('message', event => {
                appendMessage('ai-message', event.data.text);
            });
            chatInput.addEventListener('keydown', event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>
    `;

    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'chat') {
            debouncedSendMessage(message.text, panel, context);
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.helloWorld', () => {
            vscode.window.showInformationMessage('Hello from My AI Assistant!');
        }),
        vscode.commands.registerCommand('extension.modifyProject', modifyProject),
        vscode.commands.registerCommand('extension.editSelection', editSelection),
        vscode.commands.registerCommand('extension.openChat', () => openChatPanel(context)),
        vscode.languages.registerCompletionItemProvider(
            ['typescript', 'javascript'],
            {
                async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                    const apiConfig = await getApiConfig();
                    if (!apiConfig.apiKey) return [];

                    const range = document.lineAt(position.line).range;
                    const surrounding = document.getText(new vscode.Range(
                        Math.max(0, position.line - 5), 0,
                        Math.min(document.lineCount, position.line + 5), 0
                    )).substring(0, 500);

                    try {
                        const response = await axios.post(
                            apiConfig.endpoint,
                            apiConfig.requestFormat(`Surrounding: ${surrounding}`),
                            { headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` } }
                        );
                        const suggestion = response.data.choices[0].message.content.substring(0, 100);
                        const item = new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.Snippet);
                        item.range = range;
                        return [item];
                    } catch (e) {
                        if (e instanceof AxiosError) {
                            console.error('API Error:', e.message, e.response?.status, e.response?.data);
                        } else {
                            console.error('Unknown Error:', String(e));
                        }
                        return [];
                    }
                }
            },
            '.', ' ', '\n'
        ),
        vscode.languages.registerCodeActionsProvider(
            ['typescript', 'javascript'],
            {
                async provideCodeActions(document: vscode.TextDocument, range: vscode.Range) {
                    const apiConfig = await getApiConfig();
                    if (!apiConfig.apiKey) return [];

                    const code = document.getText(range).substring(0, 500);
                    try {
                        const response = await axios.post(
                            apiConfig.endpoint,
                            apiConfig.requestFormat(`Refactor: ${code}`),
                            { headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` } }
                        );
                        const refactor = JSON.parse(response.data.choices[0].message.content);
                        const action = new vscode.CodeAction('AI Refactor', vscode.CodeActionKind.Refactor);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.replace(document.uri, range, refactor.newText || response.data.choices[0].message.content || code);
                        return [action];
                    } catch (e) {
                        if (e instanceof AxiosError) {
                            console.error('API Error:', e.message, e.response?.status, e.response?.data);
                        } else {
                            console.error('Unknown Error:', String(e));
                        }
                        return [];
                    }
                }
            }
        )
    );
}

export function deactivate() {}