import * as vscode from 'vscode';
import * as path from 'path';
import { FileData, ProjectIndexItem, AiResponse, ChatHistoryItem } from './types';
import { sanitizeFilePath } from './utils';

export let projectIndex: ProjectIndexItem[] = [];

export async function readDirectoryRecursive(uri: vscode.Uri): Promise<FileData[]> {
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

export async function buildProjectIndex(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        projectIndex = [];
        return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    let activeFileData: FileData | undefined;
    if (activeEditor && (activeEditor.document.languageId === 'typescript' || activeEditor.document.languageId === 'javascript')) {
        activeFileData = {
            path: activeEditor.document.uri.fsPath,
            content: activeEditor.document.getText().substring(0, 2000)
        };
    }

    const files = await readDirectoryRecursive(workspaceFolders[0].uri);
    let limitedFiles: ProjectIndexItem[] = [];

    if (activeFileData) {
        limitedFiles.push({
            path: activeFileData.path,
            symbols: activeFileData.content.match(/(function|class|const|let|var|def|public|private|interface|type)\s+(\w+)/g)?.slice(0, 50) || []
        });
    }

    const otherFiles = files.filter(file => file.path !== activeFileData?.path).slice(0, 9);
    limitedFiles.push(...otherFiles.map(file => ({
        path: file.path,
        symbols: file.content.match(/(function|class|const|let|var|def|public|private|interface|type)\s+(\w+)/g)?.slice(0, 50) || []
    })));

    projectIndex = limitedFiles;
}

export async function deletePath(filePath: string): Promise<void> {
    const sanitizedPath = sanitizeFilePath(filePath);
    const uri = vscode.Uri.file(sanitizedPath);
    for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.fsPath === uri.fsPath) {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    }
    try {
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
        console.log(`Deleted ${sanitizedPath}`);
    } catch (e) {
        console.error(`Failed to delete ${sanitizedPath}: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
    }
}

export async function applyResponseChanges(
    parsedResponse: AiResponse,
    panel: vscode.WebviewPanel | null,
    context: vscode.ExtensionContext,
    workspaceFolders: readonly vscode.WorkspaceFolder[] // Changed to readonly
): Promise<void> {
    console.log('Entering applyResponseChanges with response:', parsedResponse);

    // Skip confirmation for insertText actions (used by suggestCode)
    const requiresConfirmation = !parsedResponse.actions.every(action => action.type === 'insertText');
    let confirm: string | undefined = 'Yes'; // Default to Yes for non-interactive actions

    if (requiresConfirmation) {
        try {
            confirm = await Promise.race([
                vscode.window.showInformationMessage(
                    parsedResponse.actions.length > 0
                        ? `Apply these changes? ${parsedResponse.message || 'See actions in response.'}`
                        : 'No actions to apply. Proceed anyway?',
                    { modal: false },
                    'Yes', 'No'
                ),
                new Promise<undefined>((_, reject) => setTimeout(() => reject(new Error('Prompt timed out')), 30000))
            ]);
        } catch (e) {
            console.error('Prompt failed:', e instanceof Error ? e.message : String(e));
            vscode.window.showErrorMessage('Prompt timed out after 30 seconds. Applying changes automatically.');
            confirm = 'Yes';
        }

        if (confirm !== 'Yes') {
            console.log('User discarded changes or prompt failed.');
            if (panel) panel.webview.postMessage({ text: 'Changes discarded.' });
            return;
        }
    }

    console.log('Proceeding to apply changes...');
    if (parsedResponse.actions.length > 0) {
        console.log('Applying changes...');
        let allSucceeded = true;

        for (const action of parsedResponse.actions) {
            // Handle actions that require a path
            let sanitizedPath = action.path ? sanitizeFilePath(action.path) : '';
            let fullPath = action.path ? path.join(workspaceFolders[0].uri.fsPath, sanitizedPath) : '';
            let uri = action.path ? vscode.Uri.file(fullPath) : null;

            try {
                switch (action.type) {
                    case 'createFolder':
                        if (!uri) throw new Error('Path is required for createFolder action.');
                        try {
                            await vscode.workspace.fs.stat(uri);
                            console.log(`Folder already exists: ${sanitizedPath}, skipping creation.`);
                        } catch {
                            await vscode.workspace.fs.createDirectory(uri);
                            console.log(`Created folder: ${sanitizedPath}`);
                        }
                        break;
                    case 'createFile':
                        if (!uri) throw new Error('Path is required for createFile action.');
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(action.content || '', 'utf8'));
                        console.log(`Created/Updated file: ${sanitizedPath} with content length: ${action.content?.length || 0}`);
                        break;
                    case 'editFile':
                        if (!uri) throw new Error('Path is required for editFile action.');
                        if (action.range && action.newText) {
                            const document = await vscode.workspace.openTextDocument(uri);
                            const startLine = Math.min(action.range.startLine || 0, document.lineCount - 1);
                            const startChar = Math.min(action.range.startCharacter || 0, document.lineAt(startLine).text.length);
                            const endLine = Math.min(action.range.endLine || 0, document.lineCount - 1);
                            const endChar = Math.min(action.range.endCharacter || 0, document.lineAt(endLine).text.length);
                            const range = new vscode.Range(startLine, startChar, endLine, endChar);
                            const edit = new vscode.WorkspaceEdit();
                            edit.replace(uri, range, action.newText);
                            const success = await vscode.workspace.applyEdit(edit);
                            console.log(`Edited file: ${sanitizedPath} at range:`, range, `Success: ${success}`);
                            if (!success) allSucceeded = false;
                        }
                        break;
                    case 'deleteFile':
                        if (!fullPath) throw new Error('Path is required for deleteFile action.');
                        await deletePath(fullPath);
                        console.log(`Deleted file: ${sanitizedPath}`);
                        break;
                    case 'deleteFolder':
                        if (!fullPath) throw new Error('Path is required for deleteFolder action.');
                        await deletePath(fullPath);
                        console.log(`Deleted folder: ${sanitizedPath}`);
                        break;
                    case 'insertText': {
                        const editor = vscode.window.activeTextEditor;
                        if (!editor) {
                            vscode.window.showErrorMessage('No active editor found to insert text.');
                            allSucceeded = false;
                            break;
                        }
                        const position = editor.selection.active;
                        await editor.edit(editBuilder => {
                            editBuilder.insert(position, action.text || '');
                        });
                        console.log(`Inserted text at position: ${position.line}:${position.character}`);
                        break;
                    }
                }
            } catch (e) {
                console.error(`Error processing action for ${sanitizedPath || action.type}:`, e);
                if (panel) panel.webview.postMessage({ text: `Error processing action for ${sanitizedPath || action.type}: ${e instanceof Error ? e.message : String(e)}` });
                allSucceeded = false;
            }
        }

        if (allSucceeded) {
            vscode.window.showInformationMessage('Changes applied successfully!');
            console.log('All changes applied successfully.');
        } else {
            vscode.window.showWarningMessage('Some changes could not be applied.');
            console.warn('Some changes could not be applied.');
        }
    }

    const reply = parsedResponse.message || 'No actions specified by AI.';
    console.log('Sending response to webview:', reply);
    if (panel) {
        panel.webview.postMessage({ text: reply });
        console.log('Response sent to webview.');

        // Update chat history only if a panel is present (i.e., in chat context)
        const history = context.globalState.get<ChatHistoryItem[]>('chatHistory', []);
        history.push({
            user: '',
            ai: reply,
            timestamp: new Date().toISOString()
        });
        context.globalState.update('chatHistory', history);
        console.log('Chat history updated:', history);
    }
}