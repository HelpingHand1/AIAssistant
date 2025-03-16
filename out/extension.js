"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const path = __importStar(require("path"));
let projectIndex = [];
function readDirectoryRecursive(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const entries = yield vscode.workspace.fs.readDirectory(uri);
        const files = [];
        for (const [name, fileType] of entries) {
            const fileUri = vscode.Uri.file(path.join(uri.fsPath, name));
            if (fileType === vscode.FileType.File && /\.(ts|js)$/.test(name)) {
                const data = yield vscode.workspace.fs.readFile(fileUri);
                files.push({ path: fileUri.fsPath, content: data.toString() });
            }
            else if (fileType === vscode.FileType.Directory) {
                files.push(...yield readDirectoryRecursive(fileUri));
            }
        }
        return files;
    });
}
function buildProjectIndex() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield readDirectoryRecursive(vscode.workspace.workspaceFolders[0].uri);
        projectIndex = files.map(file => ({
            path: file.path,
            symbols: file.content.match(/(function|class|const|let|var)\s+(\w+)/g) || []
        }));
    });
}
function applyChanges(aiResponse) {
    return __awaiter(this, void 0, void 0, function* () {
        let changes;
        try {
            changes = JSON.parse(aiResponse);
        }
        catch (err) {
            vscode.window.showErrorMessage('Invalid AI response.');
            return;
        }
        for (const change of changes) {
            const uri = vscode.Uri.file(change.path);
            const document = yield vscode.workspace.openTextDocument(uri);
            const oldText = document.getText(change.range);
            yield vscode.commands.executeCommand('vscode.diff', uri, uri.with({ scheme: 'untitled' }), oldText, change.newText);
        }
        const apply = yield vscode.window.showInformationMessage('Apply AI changes?', 'Yes', 'No');
        if (apply === 'Yes') {
            const edit = new vscode.WorkspaceEdit();
            for (const change of changes) {
                edit.replace(vscode.Uri.file(change.path), change.range, change.newText);
            }
            yield vscode.workspace.applyEdit(edit);
            vscode.commands.executeCommand('git.stage');
            vscode.window.showInformationMessage('Changes applied and staged!');
        }
    });
}
function modifyProject() {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)');
            return;
        }
        const userPrompt = yield vscode.window.showInputBox({ prompt: 'Describe how to modify the project' });
        if (!userPrompt)
            return;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace is open.');
            return;
        }
        yield buildProjectIndex();
        const files = yield readDirectoryRecursive(workspaceFolders[0].uri);
        if (!files.length) {
            vscode.window.showInformationMessage('No files found.');
            return;
        }
        const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'Return JSON: [{ path, range: { startLine, startChar, endLine, endChar }, newText }]' },
                { role: 'user', content: `Index: ${JSON.stringify(projectIndex)}\nFiles: ${JSON.stringify(files)}\nInstructions: ${userPrompt}` }
            ],
        }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        yield applyChanges(response.data.choices[0].message.content);
    });
}
function editSelection() {
    return __awaiter(this, void 0, void 0, function* () {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey');
        if (!apiKey)
            return vscode.window.showErrorMessage('Set your API key!');
        const selection = editor.selection;
        const code = editor.document.getText(selection);
        const prompt = yield vscode.window.showInputBox({ prompt: 'How to edit this code?' });
        if (!prompt)
            return;
        const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'Return JSON: { newText }' },
                { role: 'user', content: `Code: ${code}\nEdit: ${prompt}` }
            ],
        }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const { newText } = JSON.parse(response.data.choices[0].message.content);
        editor.edit((editBuilder) => editBuilder.replace(selection, newText));
        const refine = yield vscode.window.showInformationMessage('Looks good?', 'Yes', 'Refine');
        if (refine === 'Refine')
            editSelection();
    });
}
function openChatPanel(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)');
            return;
        }
        const panel = vscode.window.createWebviewPanel('aiChat', 'AI Assistant Chat', vscode.ViewColumn.Beside, { enableScripts: true });
        const history = context.globalState.get('chatHistory', []);
        let historyHtml = history.map((h) => `<div class="message user-message">${h.user}</div><div class="message ai-message">${h.ai}</div>`).join('');
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
        panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            if (message.command === 'chat') {
                const editor = vscode.window.activeTextEditor;
                const contextText = editor ? editor.document.getText() : 'No file open';
                const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: 'Answer with context in mind.' },
                        { role: 'user', content: `${contextText}\n${message.text}` }
                    ],
                }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                const reply = response.data.choices[0].message.content;
                panel.webview.postMessage({ text: reply });
                history.push({ user: message.text, ai: reply });
                context.globalState.update('chatHistory', history);
            }
        }));
    });
}
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from My AI Assistant!');
    }), vscode.commands.registerCommand('extension.modifyProject', modifyProject), vscode.commands.registerCommand('extension.editSelection', editSelection), vscode.commands.registerCommand('extension.openChat', () => openChatPanel(context)), vscode.languages.registerCompletionItemProvider(['typescript', 'javascript'], {
        provideCompletionItems(document, position) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey');
                if (!apiKey)
                    return [];
                const range = document.lineAt(position.line).range;
                const text = document.getText();
                const surrounding = document.getText(new vscode.Range(Math.max(0, position.line - 10), 0, Math.min(document.lineCount, position.line + 10), 0));
                const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: 'Suggest multi-line code completions based on context.' },
                        { role: 'user', content: `File: ${text}\nSurrounding: ${surrounding}\nCurrent: ${document.getText(range)}` }
                    ],
                }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                const suggestion = response.data.choices[0].message.content;
                const item = new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.Snippet);
                item.range = range;
                return [item];
            });
        }
    }, '.', ' ', '\n'), vscode.languages.registerCodeActionsProvider(['typescript', 'javascript'], {
        provideCodeActions(document, range) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey');
                if (!apiKey)
                    return [];
                const code = document.getText(range);
                const response = yield axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                    model: 'gpt-4',
                    messages: [{ role: 'user', content: `Refactor: ${code}` }],
                }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                const refactor = JSON.parse(response.data.choices[0].message.content);
                const action = new vscode.CodeAction('AI Refactor', vscode.CodeActionKind.Refactor);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, range, refactor.newText);
                return [action];
            });
        }
    }));
}
function deactivate() { }
