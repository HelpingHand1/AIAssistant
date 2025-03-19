import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { getApiConfig } from './api';
import { buildProjectIndex, applyResponseChanges, readDirectoryRecursive } from './fileOperations';
import { AiResponse, ChatHistoryItem, Action } from './types';

export const debouncedSendMessage = debounce(async (message: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext) => {
    console.log('debouncedSendMessage triggered with message:', message);

    const apiConfig = await getApiConfig();
    if (!apiConfig.apiKey) {
        console.log('No API key found, sending error message to webview.');
        panel.webview.postMessage({ text: 'Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)' });
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        console.log('No workspace found, sending error message to webview.');
        panel.webview.postMessage({ text: 'No workspace is open.' });
        return;
    }

const projectIndex = await buildProjectIndex(); // Ensure projectIndex is defined
const editor = vscode.window.activeTextEditor;
const contextText = editor ? editor.document.getText().substring(0, 1000) : 'No active editor';
const files = await readDirectoryRecursive(workspaceFolders[0].uri);
const workspaceContext = `Project Context:
- Workspace Root: ${workspaceFolders[0].uri.fsPath}
- Project Index (sample): ${Array.isArray(projectIndex) ? JSON.stringify(projectIndex.slice(0, 5)) : 'No index available'}
- Active File Snippet: ${contextText}
- Files in Workspace: ${files.map(f => f.path).join(', ')}`;
    const truncatedContext = workspaceContext.length > 1500 ? workspaceContext.substring(0, 1500) + '...' : workspaceContext;
    console.log(`Context length: ${truncatedContext.length} characters`);

    const enhancedPrompt = `
${truncatedContext}

User Query: ${message}

Leverage GPT-4’s advanced reasoning to interpret this request creatively and effectively. Generate complete, high-quality code and file structures, placing files logically based on context (e.g., 'src', 'games', or root). Explain your reasoning and assumptions in the 'message' field. If the request is vague, choose a practical, impressive implementation and justify your choice.
`;

    let parsedResponse: AiResponse = { actions: [], message: '' };
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log('Sending API request to OpenAI...', attempt > 0 ? `(Retry ${attempt}/${maxRetries})` : '');
            const response = await axios.post(
                apiConfig.endpoint,
                apiConfig.requestFormat(enhancedPrompt),
                { headers: { 'Authorization': `Bearer ${apiConfig.apiKey}` } }
            );
            const aiResponse = response.data.choices ? response.data.choices[0].message.content : '{}';
            console.log('Raw AI response:', aiResponse);

            const cleanedResponse = aiResponse.replace(/```(?:json|javascript|python)?\s*|\s*```/g, '').trim();
            console.log('Cleaned AI response:', cleanedResponse);
            parsedResponse = JSON.parse(cleanedResponse);
            console.log('Parsed AI response:', parsedResponse);

            if (!parsedResponse.hasOwnProperty('actions')) {
                console.log('AI response missing "actions" property, setting to empty array.');
                parsedResponse.actions = [];
            }
            if (!parsedResponse.hasOwnProperty('message')) {
                console.log('AI response missing "message" property, setting default message.');
                parsedResponse.message = 'No message provided by AI.';
            }

            parsedResponse.actions = parsedResponse.actions.map((action: any) => {
                const normalized: Action = {
                    type: action.type || action.action || '',
                    path: action.path || action.filePath || action.folderPath || ''
                };
                if (action.content) normalized.content = action.content;
                if (action.range) normalized.range = action.range;
                if (action.newText) normalized.newText = action.newText;
                return normalized;
            });

            console.log('Validating parsedResponse:', parsedResponse);
            if (!Array.isArray(parsedResponse.actions)) {
                console.error('Validation error: AI response does not contain a valid "actions" array');
                parsedResponse = { 
                    actions: [], 
                    message: `Error: AI response does not contain a valid 'actions' array: ${JSON.stringify(parsedResponse)}` 
                };
            } else {
                let hasInvalidAction = false;
                for (const action of parsedResponse.actions) {
                    if (!action.type || !action.path) {
                        console.error('Action validation error: Invalid action in AI response:', action);
                        hasInvalidAction = true;
                        break;
                    }
                    if (action.type === 'editFile' && (!action.range || !action.newText)) {
                        console.error('Edit file validation error: "editFile" action missing range or newText:', action);
                        hasInvalidAction = true;
                        break;
                    }
                }
                if (hasInvalidAction) {
                    parsedResponse = { 
                        actions: [], 
                        message: `Error: One or more actions in AI response are invalid: ${JSON.stringify(parsedResponse.actions)}` 
                    };
                }
            }

            console.log('Final parsedResponse before applying changes:', parsedResponse);
            break;
        } catch (e) {
            const axiosError = e as AxiosError;
            const errorDetails = axiosError.response?.data ? JSON.stringify(axiosError.response.data) : axiosError.message;
            console.error('API Error:', axiosError.message, axiosError.response?.status, errorDetails);
            if (attempt < maxRetries && (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('Canceled'))) {
                console.log(`Retrying API request (${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
            }
            panel.webview.postMessage({ text: `Error: ${axiosError.message} - ${errorDetails}` });
            return;
        }
    }

    await applyResponseChanges(parsedResponse, panel, context, [...workspaceFolders]);
}, 500);

export async function openChatPanel(context: vscode.ExtensionContext): Promise<void> {
    console.log('openChatPanel called');

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
    console.log('Webview panel created');

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
            #sendButton { margin-left: 10px; padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
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
                console.log('Sending message from webview:', text);
                appendMessage('user-message', text);
                vscode.postMessage({ command: 'chat', text: text });
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
                console.log('Received message in webview:', event.data);
                appendMessage('ai-message', event.data.text);
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>
    `;

    panel.webview.onDidReceiveMessage((message) => {
        console.log('Received message in extension:', message);
        if (message.command === 'chat') {
            console.log('Calling debouncedSendMessage with message:', message.text);
            debouncedSendMessage(message.text, panel, context);
        } else {
            console.log('Unknown command received:', message.command);
        }
    }, undefined, context.subscriptions);
}