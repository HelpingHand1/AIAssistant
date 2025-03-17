import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import * as path from 'path';
import { debounce } from 'lodash';

// Interfaces for structured data
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

// Globals for project indexing and caching
let projectIndex: ProjectIndexItem[] = [];
const apiCache = new Map<string, string>();

const debouncedSendMessage = debounce((message: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext) => {
    sendMessageToAI(message, panel, context);
}, 500);

// Recursive function to read directories and retrieve files
async function readDirectoryRecursive(uri: vscode.Uri): Promise<FileData[]> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const files: FileData[] = [];
    const openFiles = vscode.window.visibleTextEditors.map(e => e.document.uri.fsPath);

    for (const [name, fileType] of entries) {
        const fileUri = vscode.Uri.file(path.join(uri.fsPath, name));
        if (fileType === vscode.FileType.File && /\.(ts|js)$/.test(name) && openFiles.includes(fileUri.fsPath)) {
            const data = await vscode.workspace.fs.readFile(fileUri);
            files.push({ path: fileUri.fsPath, content: data.toString() });
        } else if (fileType === vscode.FileType.Directory && !['node_modules', '.git'].includes(name)) {
            files.push(...await readDirectoryRecursive(fileUri));
        }
    }
    return files;
}

// Build a searchable project index
async function buildProjectIndex(): Promise<void> {
    const files = await readDirectoryRecursive(vscode.workspace.workspaceFolders![0].uri);
    projectIndex = files.map(file => ({
        path: file.path,
        symbols: file.content.match(/(function|class|const|let|var|interface|type|export\s+function|export\s+class)\s+(\w+)/g) || []
    }));
}

// Retrieve API configuration from VS Code settings
async function getApiConfig(): Promise<ApiConfig> {
    const config = vscode.workspace.getConfiguration('myAiAssistant');
    const model = config.get<string>('model') || 'gpt-3.5-turbo';
    return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: config.get<string>('apiKey'),
        model,
        requestFormat: (input: string) => ({
            model,
            messages: [
                { role: 'system', content: 'You are a coding assistant. Respond with JSON actions to create or edit files and folders.' },
                { role: 'user', content: input }
            ],
            max_tokens: 2000,
            temperature: 0.7
        })
    };
}

// Apply AI-suggested changes to the workspace
async function applyChanges(aiResponse: string): Promise<void> {
    let changes: { path: string; range: any; newText: string }[];
    try {
        changes = JSON.parse(aiResponse).actions;
    } catch (err) {
        vscode.window.showErrorMessage('Invalid AI response.');
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    for (const change of changes) {
        const uri = vscode.Uri.file(change.path);
        const range = new vscode.Range(
            change.range.startLine, change.range.startCharacter,
            change.range.endLine, change.range.endCharacter
        );
        edit.replace(uri, range, change.newText);
    }

    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage('Changes applied successfully!');
}

// Command: Modify the project
async function modifyProject(): Promise<void> {
    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        vscode.window.showErrorMessage('Please set your OpenAI API key in the settings.');
        return;
    }

    const userPrompt = await vscode.window.showInputBox({ prompt: 'Describe how to modify the project' });
    if (!userPrompt) return;

    await buildProjectIndex();
    const files = await readDirectoryRecursive(vscode.workspace.workspaceFolders![0].uri);

    try {
        const response = await axios.post(
            apiConfig.endpoint,
            apiConfig.requestFormat(`Project Index: ${JSON.stringify(projectIndex)}\nFiles: ${JSON.stringify(files)}\nInstructions: ${userPrompt}`),
            { headers: { Authorization: `Bearer ${apiConfig.apiKey}` } }
        );
        await applyChanges(response.data.choices[0].message.content);
    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        vscode.window.showErrorMessage(`Error: ${axiosError.message}`);
    }
}

// Command: Edit selected code
async function editSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        vscode.window.showErrorMessage('Set your OpenAI API key in the settings.');
        return;
    }

    const selection = editor.selection;
    const code = editor.document.getText(selection);
    const prompt = await vscode.window.showInputBox({ prompt: 'How should this code be edited?' });
    if (!prompt) return;

    try {
        const response = await axios.post(
            apiConfig.endpoint,
            apiConfig.requestFormat(`Code: ${code}\nEdit: ${prompt}`),
            { headers: { Authorization: `Bearer ${apiConfig.apiKey}` } }
        );
        const newText = response.data.choices[0].message.content;
        editor.edit(editBuilder => editBuilder.replace(selection, newText));
    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        vscode.window.showErrorMessage(`Error: ${axiosError.message}`);
    }
}

// Webview-based chat interface
async function openChatPanel(context: vscode.ExtensionContext): Promise<void> {
    const panel = vscode.window.createWebviewPanel('aiChat', 'AI Assistant Chat', vscode.ViewColumn.Beside, { enableScripts: true });
    const apiConfig = await getApiConfig();

    panel.webview.html = `
        <html>
        <body>
            <textarea id="chatInput"></textarea>
        </body>
        </html>
    `;
    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'chat') {
            try {
                const response = await axios.post(
                    apiConfig.endpoint,
                    apiConfig.requestFormat(message.text),
                    { headers: { Authorization: `Bearer ${apiConfig.apiKey}` } }
                );
                panel.webview.postMessage({ text: response.data.choices[0].message.content });
            } catch (error: unknown) {
                const axiosError = error as AxiosError;
                panel.webview.postMessage({ text: `Error: ${axiosError.message}` });
            }
        }
    });
}

// Helper: Send message to the AI
async function sendMessageToAI(message: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext): Promise<void> {
    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        vscode.window.showErrorMessage('Please set your OpenAI API key in the settings.');
        return;
    }

    try {
        const response = await axios.post(
            apiConfig.endpoint,
            apiConfig.requestFormat(message),
            { headers: { Authorization: `Bearer ${apiConfig.apiKey}` } }
        );

        const reply = response.data.choices[0].message.content || 'No response from AI.';
        panel.webview.postMessage({ text: reply });

        // Save chat history
        const history = context.globalState.get<ChatHistoryItem[]>('chatHistory', []);
        history.push({ user: message, ai: reply });
        context.globalState.update('chatHistory', history);

    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        vscode.window.showErrorMessage(`Error: ${axiosError.message}`);
        panel.webview.postMessage({ text: `Error: ${axiosError.message}` });
    }
}

// Extension activation
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.helloWorld', () => {
            vscode.window.showInformationMessage('Hello from My AI Assistant!');
        }),
        vscode.commands.registerCommand('extension.modifyProject', modifyProject),
        vscode.commands.registerCommand('extension.editSelection', editSelection),
        vscode.commands.registerCommand('extension.openChat', () => openChatPanel(context))
    );
}

// Extension deactivation
export function deactivate() {}
