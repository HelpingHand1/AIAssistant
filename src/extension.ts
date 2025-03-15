import * as vscode from 'vscode';
import axios from 'axios';
import * as path from 'path';

async function readDirectoryRecursive(uri: vscode.Uri): Promise<{ path: string; content: string }[]> {
  const entries = await vscode.workspace.fs.readDirectory(uri);
  const files: { path: string; content: string }[] = [];
  for (const [name, fileType] of entries) {
    const fileUri = vscode.Uri.file(path.join(uri.fsPath, name));
    if (fileType === vscode.FileType.File && /\.(ts|js)$/.test(name)) {
      const data = await vscode.workspace.fs.readFile(fileUri);
      files.push({ path: fileUri.fsPath, content: data.toString() });
    } else if (fileType === vscode.FileType.Directory) {
      files.push(...await readDirectoryRecursive(fileUri));
    }
  }
  return files;
}

async function applyChanges(aiResponse: string) {
  let changes: Array<{ path: string; range: vscode.Range; newText: string }>;
  try {
    changes = JSON.parse(aiResponse);
  } catch (err) {
    vscode.window.showErrorMessage('Invalid AI response.');
    return;
  }
  const edit = new vscode.WorkspaceEdit();
  for (const change of changes) {
    const uri = vscode.Uri.file(change.path);
    edit.replace(uri, change.range, change.newText);
  }
  const apply = await vscode.window.showInformationMessage('Apply AI changes?', 'Yes', 'No');
  if (apply === 'Yes') {
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage('AI changes applied!');
  }
}

async function modifyProject() {
  const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey') as string;
  if (!apiKey) {
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

  const files = await readDirectoryRecursive(workspaceFolders[0].uri);
  if (!files.length) {
    vscode.window.showInformationMessage('No files found.');
    return;
  }

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Return JSON: [{ path, range: { startLine, startChar, endLine, endChar }, newText }]' },
      { role: 'user', content: `Files: ${JSON.stringify(files)}\nInstructions: ${userPrompt}` }
    ],
  }, { headers: { 'Authorization': `Bearer ${apiKey}` } });

  await applyChanges(response.data.choices[0].message.content);
}

async function openChatPanel(context: vscode.ExtensionContext) {
  const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey') as string;
  if (!apiKey) {
    vscode.window.showErrorMessage('Please set your OpenAI API key in VS Code settings (myAiAssistant.apiKey)');
    return;
  }

  const panel = vscode.window.createWebviewPanel('aiChat', 'AI Assistant Chat', vscode.ViewColumn.Beside, { enableScripts: true });
  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Assistant Chat</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
          color: #333;
        }
        #header {
          background: #007acc;
          color: white;
          padding: 10px;
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        #chatOutput {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          background: #fff;
          border-bottom: 1px solid #ddd;
        }
        .message {
          margin: 10px 0;
          padding: 10px;
          border-radius: 5px;
          max-width: 80%;
          word-wrap: break-word;
        }
        .user-message {
          background: #007acc;
          color: white;
          margin-left: auto;
          text-align: right;
        }
        .ai-message {
          background: #e0e0e0;
          color: #333;
          margin-right: auto;
        }
        #inputArea {
          display: flex;
          padding: 10px;
          background: #fff;
          border-top: 1px solid #ddd;
          box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
        }
        #chatInput {
          flex: 1;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          resize: none;
          outline: none;
          font-size: 14px;
        }
        #chatInput:focus {
          border-color: #007acc;
        }
        #sendButton {
          margin-left: 10px;
          padding: 10px 20px;
          background: #007acc;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        #sendButton:hover {
          background: #005f99;
        }
      </style>
    </head>
    <body>
      <div id="header">AI Assistant Chat</div>
      <div id="chatOutput"></div>
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

  panel.webview.onDidReceiveMessage(async message => {
    if (message.command === 'chat') {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: message.text }],
      }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      panel.webview.postMessage({ text: response.data.choices[0].message.content });
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.helloWorld', () => {
      vscode.window.showInformationMessage('Hello from My AI Assistant!');
    }),
    vscode.commands.registerCommand('extension.modifyProject', modifyProject),
    vscode.commands.registerCommand('extension.openChat', () => openChatPanel(context)),
    vscode.languages.registerCompletionItemProvider(['typescript', 'javascript'], {
      async provideCompletionItems(document, position) {
        const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey') as string;
        if (!apiKey) return [];

        const text = document.getText(document.lineAt(position.line).range);
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: `Suggest code for: ${text}` }],
        }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const suggestion = response.data.choices[0].message.content;
        return [new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.Snippet)];
      }
    }, '.'),
    vscode.languages.registerCodeActionsProvider(['typescript', 'javascript'], {
      async provideCodeActions(document, range) {
        const apiKey = vscode.workspace.getConfiguration('myAiAssistant').get('apiKey') as string;
        if (!apiKey) return [];

        const code = document.getText(range);
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4',
          messages: [{ role: 'user', content: `Refactor: ${code}` }],
        }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        const refactor = JSON.parse(response.data.choices[0].message.content);
        const action = new vscode.CodeAction('AI Refactor', vscode.CodeActionKind.Refactor);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, range, refactor.newText);
        return [action];
      }
    })
  );
}

export function deactivate() {}