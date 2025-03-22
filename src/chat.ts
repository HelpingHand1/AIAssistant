import * as vscode from 'vscode';
import { getApiConfig, getAiResponse } from './api';
import { buildProjectIndex, applyResponseChanges } from './fileOperations';
import { ChatHistoryItem, AiResponse } from './types';
import { formatCodeSnippet, generateUniqueId, truncateString } from './utils';
import { findGenerator } from './generators';

// Import all generators to ensure they are registered
import './generators/games';
import './generators/apps';
import { debounce } from 'lodash';

export async function sendMessage(message: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext, workspaceFolders: vscode.WorkspaceFolder[]): Promise<void> {
    try {
        await buildProjectIndex();
        let response: AiResponse;

        // Check for a matching generator
        const generator = findGenerator(message);
        if (generator) {
            response = await generator.generate(message);
        } else {
            response = await getAiResponse(message) || { actions: [], message: 'Failed to get a response from AI.' };
        }

        await applyResponseChanges(response, panel, context, workspaceFolders);
        const displayMessage = response.message.includes('```') 
            ? formatCodeSnippet(response.message.split('```')[1] || response.message, 'typescript')
            : truncateString(response.message, 500);
        panel.webview.postMessage({ command: 'chat', text: displayMessage, id: generateUniqueId('msg') });
    } catch (error) {
        console.error('Error sending message:', error);
        panel.webview.postMessage({ command: 'error', text: 'Failed to send message. Check your API key or network.' });
    }
}


export const debouncedSendMessage = debounce(async (message: string, panel: vscode.WebviewPanel, context: vscode.ExtensionContext) => {
    const workspaceFolders = [...(vscode.workspace.workspaceFolders || [])];
    await sendMessage(message, panel, context, workspaceFolders);
}, 500);

export async function openChatPanel(context: vscode.ExtensionContext): Promise<void> {
    console.log('openChatPanel called');

    try {
        const apiConfig = await getApiConfig();
        if (!apiConfig.apiKey) {
            vscode.window.showErrorMessage('Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)');
            return;
        }
    } catch (error) {
        vscode.window.showErrorMessage('API configuration error. Please check settings.');
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace is open.');
        return;
    }
    await buildProjectIndex();

    const panel = vscode.window.createWebviewPanel('aiChat', 'My AI Assistant', vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    console.log('Webview panel created');

    const history = context.globalState.get<ChatHistoryItem[]>('chatHistory', []);
    let historyHtml = history.map(h => `
        <div class="message user-message" data-timestamp="${h.timestamp || new Date().toISOString()}">
            <span class="message-content">${h.user || ''}</span>
            <span class="timestamp">${new Date(h.timestamp || Date.now()).toLocaleTimeString()}</span>
        </div>
        <div class="message ai-message" data-timestamp="${h.timestamp || new Date().toISOString()}">
            <span class="message-content">${h.ai || ''}</span>
            <span class="timestamp">${new Date(h.timestamp || Date.now()).toLocaleTimeString()}</span>
        </div>
    `).join('');

    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My AI Assistant</title>
        <style>
            :root {
                --primary-start: #007acc;
                --primary-end: #005f99;
                --background-color: #f9f9f9;
                --text-color: #333;
                --message-bg-user: #007acc;
                --message-bg-ai: #f1f1f1;
            }
            [data-theme="dark"] {
                --background-color: #252526;
                --text-color: #d4d4d4;
                --message-bg-user: #004d80;
                --message-bg-ai: #2c2c2c;
            }
            body {
                font-family: 'Segoe UI', 'Roboto', sans-serif;
                margin: 0;
                padding: 0;
                height: 100vh;
                display: flex;
                background: var(--background-color);
                color: var(--text-color);
                transition: all 0.3s ease;
            }
            #sidebar {
                width: 220px;
                background: linear-gradient(135deg, var(--primary-start), var(--primary-end));
                color: white;
                padding: 15px 10px;
                box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
                overflow-y: auto;
                transition: transform 0.3s ease-in-out;
                z-index: 10;
            }
            #sidebar.hidden { transform: translateX(-220px); }
            #sidebar button {
                display: flex;
                align-items: center;
                width: 100%;
                padding: 10px 15px;
                margin: 8px 0;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 5px;
                color: white;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: left;
            }
            #sidebar button:hover, #sidebar button.active {
                background: rgba(255, 255, 255, 0.2);
                transform: translateX(5px);
            }
            #sidebar button::before {
                content: "▶";
                margin-right: 10px;
                opacity: 0.7;
            }
            #main-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            #header {
                background: linear-gradient(90deg, var(--primary-start), var(--primary-end));
                color: white;
                padding: 10px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            }
            #header button {
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                padding: 5px;
                transition: transform 0.3s;
            }
            #header button:hover { transform: rotate(90deg); }
            #chatOutput {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: var(--background-color);
                display: flex;
                flex-direction: column-reverse;
            }
            .message {
                margin: 10px 0;
                padding: 12px 18px;
                border-radius: 10px;
                max-width: 65%;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                position: relative;
                animation: slideIn 0.4s ease-out;
                word-wrap: break-word;
            }
            .user-message {
                background: var(--message-bg-user);
                color: white;
                margin-left: auto;
                align-self: flex-end;
            }
            .ai-message {
                background: var(--message-bg-ai);
                color: var(--text-color);
                margin-right: auto;
                align-self: flex-start;
            }
            .message-content { display: block; }
            .timestamp {
                font-size: 0.65em;
                opacity: 0.5;
                margin-top: 5px;
                display: block;
            }
            #inputArea {
                display: flex;
                padding: 15px;
                background: var(--background-color);
                border-top: 1px solid #ddd;
                box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.05);
            }
            #chatInput {
                flex: 1;
                padding: 12px 15px;
                border: 2px solid #ddd;
                border-radius: 8px;
                resize: vertical;
                outline: none;
                font-size: 14px;
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            #chatInput:focus {
                border-color: var(--primary-start);
                box-shadow: 0 0 5px rgba(0, 122, 204, 0.3);
            }
            #sendButton {
                margin-left: 10px;
                padding: 12px 25px;
                background: linear-gradient(45deg, var(--primary-start), var(--primary-end));
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            #sendButton:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            #sendButton:disabled {
                background: #ccc;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            .tooltip {
                position: absolute;
                background: var(--text-color);
                color: var(--background-color);
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 12px;
                visibility: hidden;
                z-index: 1;
                top: -25px;
                left: 50%;
                transform: translateX(-50%);
            }
            button:hover .tooltip { visibility: visible; }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    </head>
    <body>
        <div id="sidebar">
            <button data-command="extension.helloWorld" title="Say Hello" class="tooltip">Hello World</button>
            <button data-command="extension.modifyProject" title="Modify your project" class="tooltip">Modify Project</button>
            <button data-command="extension.editSelection" title="Edit selected code" class="tooltip">Edit Selection</button>
            <button data-command="extension.suggestCode" title="Suggest code at cursor" class="tooltip">Suggest Code</button>
            <button data-command="extension.undoChanges" title="Undo last AI changes" class="tooltip">Undo Changes</button>
            <button data-command="extension.openChat" title="Open chat (active)" class="tooltip active">Open Chat</button>
            <button id="toggleTheme" title="Toggle Light/Dark Theme" class="tooltip">Toggle Theme</button>
            <button id="settings" title="Configure API Key" class="tooltip">Settings</button>
        </div>
        <div id="main-content">
            <div id="header">
                <button id="toggleSidebar">☰</button>
                <h2>My AI Assistant</h2>
                <span></span>
            </div>
            <div id="chatOutput">${historyHtml}</div>
            <div id="inputArea">
                <textarea id="chatInput" rows="3" placeholder="Ask me anything..."></textarea>
                <button id="sendButton">Send</button>
            </div>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const chatOutput = document.getElementById('chatOutput');
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendButton');
            const sidebar = document.getElementById('sidebar');
            const toggleSidebar = document.getElementById('toggleSidebar');
            const toggleTheme = document.getElementById('toggleTheme');
            let isDark = false;

            // Toggle sidebar
            toggleSidebar.addEventListener('click', () => {
                sidebar.classList.toggle('hidden');
            });

            // Toggle theme
            toggleTheme.addEventListener('click', () => {
                isDark = !isDark;
                document.body.setAttribute('data-theme', isDark ? 'dark' : '');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            });

            // Load saved theme
            if (localStorage.getItem('theme') === 'dark') {
                isDark = true;
                document.body.setAttribute('data-theme', 'dark');
            }

            // Command navigation
            document.querySelectorAll('#sidebar button[data-command]').forEach(button => {
                button.addEventListener('click', () => {
                    const command = button.getAttribute('data-command');
                    document.querySelectorAll('#sidebar button').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    vscode.postMessage({ command: 'execute', text: command });
                });
            });

            // Settings button
            document.getElementById('settings').addEventListener('click', () => {
                vscode.postMessage({ command: 'openSettings' });
            });

            // Send message with enable/disable button
            function sendMessage() {
                const text = chatInput.value.trim();
                if (!text) {
                    sendButton.disabled = true;
                    return;
                }
                sendButton.disabled = false;
                const timestamp = new Date().toLocaleTimeString();
                appendMessage('user-message', text, timestamp);
                vscode.postMessage({ command: 'chat', text: text });
                chatInput.value = '';
                sendButton.disabled = true; // Disable until new input
            }

            // Append message with timestamp
            function appendMessage(className, text, timestamp) {
                const div = document.createElement('div');
                div.className = 'message ' + className;
                div.innerHTML = \`<span class="message-content">\${text}</span><span class="timestamp">\${timestamp}</span>\`;
                chatOutput.prepend(div); // Add to top for reverse chronology
                chatOutput.scrollTop = 0; // Scroll to latest message
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'chat') {
                    appendMessage('ai-message', message.text, new Date().toLocaleTimeString());
                } else if (message.command === 'execute') {
                    vscode.postMessage({ command: message.text });
                } else if (message.command === 'error') {
                    appendMessage('ai-message', 'Error: ' + message.text, new Date().toLocaleTimeString());
                }
            });

            // Input event to enable/disable send button
            chatInput.addEventListener('input', () => {
                sendButton.disabled = !chatInput.value.trim();
            });

            // Send on Enter, allow Shift+Enter for newline
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            // Send button
            sendButton.addEventListener('click', sendMessage);
            sendButton.disabled = true; // Initially disabled
        </script>
    </body>
    </html>
    `;

    panel.webview.onDidReceiveMessage((message) => {
        console.log('Received message in extension:', message);
        if (message.command === 'chat') {
            console.log('Calling debouncedSendMessage with message:', message.text);
            debouncedSendMessage(message.text, panel, context);
        } else if (message.command === 'execute') {
            vscode.commands.executeCommand(message.text);
        } else if (message.command === 'openSettings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'myAiAssistant');
        }
    }, undefined, context.subscriptions);
}