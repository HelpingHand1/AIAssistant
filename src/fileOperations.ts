import * as vscode from 'vscode';
import * as path from 'path';
import { FileData, ProjectIndexItem, AiResponse, ChatHistoryItem } from './types';
import { sanitizeFilePath } from './utils';

/**
 * Global project index storing metadata about workspace files.
 * Used for quick lookups and context provision to the AI.
 */
export let projectIndex: ProjectIndexItem[] = [];

/**
 * Recursively reads directory contents, collecting TypeScript/JavaScript files.
 * @param uri The directory URI to scan
 * @returns A promise resolving to an array of file data objects
 */
export async function readDirectoryRecursive(uri: vscode.Uri): Promise<FileData[]> {
  const files: FileData[] = [];
  try {
    const entries = await vscode.workspace.fs.readDirectory(uri);

    for (const [name, fileType] of entries) {
      const fileUri = vscode.Uri.file(path.join(uri.fsPath, name));
      if (fileType === vscode.FileType.File && /\.(ts|js)$/.test(name)) {
        const data = await vscode.workspace.fs.readFile(fileUri);
        files.push({ path: fileUri.fsPath, content: new TextDecoder().decode(data) });
      } else if (fileType === vscode.FileType.Directory) {
        files.push(...await readDirectoryRecursive(fileUri));
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${uri.fsPath}:`, error);
  }
  return files;
}

/**
 * Builds an index of the project’s TypeScript/JavaScript files for AI context.
 * Prioritizes the active file and limits the total to optimize performance.
 */
export async function buildProjectIndex(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    projectIndex = [];
    console.log('No workspace folders found; project index cleared.');
    return;
  }

  const activeEditor = vscode.window.activeTextEditor;
  let activeFileData: FileData | undefined;
  if (
    activeEditor &&
    (activeEditor.document.languageId === 'typescript' || activeEditor.document.languageId === 'javascript')
  ) {
    activeFileData = {
      path: activeEditor.document.uri.fsPath,
      content: activeEditor.document.getText().substring(0, 4000), // Increased for richer context
    };
  }

  const allFiles = await readDirectoryRecursive(workspaceFolders[0].uri);
  const limitedFiles: ProjectIndexItem[] = [];

  // Add active file first (if present) with more detailed symbol extraction
  if (activeFileData) {
    limitedFiles.push({
      path: activeFileData.path,
      symbols: extractSymbols(activeFileData.content).slice(0, 100), // Increased limit
    });
  }

  // Add other files, excluding active file, up to a total of 10 entries
  const otherFiles = allFiles
    .filter((file) => file.path !== activeFileData?.path)
    .slice(0, 9 - (activeFileData ? 1 : 0));
  limitedFiles.push(
    ...otherFiles.map((file) => ({
      path: file.path,
      symbols: extractSymbols(file.content).slice(0, 100),
    }))
  );

  projectIndex = limitedFiles;
  console.log(`Project index built with ${projectIndex.length} files.`);
}

/**
 * Extracts symbol names (e.g., functions, classes) from file content.
 * @param content The file content to parse
 * @returns An array of symbol names
 */
function extractSymbols(content: string): string[] {
  const symbolRegex =
    /(?:function|class|const|let|var|interface|type)\s+([a-zA-Z_]\w*)/g;
  const matches = [...content.matchAll(symbolRegex)];
  return matches.map((match) => match[1]);
}

/**
 * Deletes a file or folder at the specified path, moving it to trash.
 * @param filePath The path to delete
 * @throws Error if deletion fails
 */
export async function deletePath(filePath: string): Promise<void> {
  const sanitizedPath = sanitizeFilePath(filePath);
  const uri = vscode.Uri.file(sanitizedPath);

  // Close any open editors for this path
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.fsPath === uri.fsPath) {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }

  try {
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
    console.log(`Deleted ${sanitizedPath} to trash.`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to delete ${sanitizedPath}: ${errorMsg}`);
    throw new Error(`Deletion failed: ${errorMsg}`);
  }
}

/**
 * Applies AI-suggested changes to the workspace based on the response.
 * @param parsedResponse The AI response containing actions and a message
 * @param panel The webview panel for chat feedback (null if not in chat context)
 * @param context The VS Code extension context for state management
 * @param workspaceFolders The workspace folders to operate within
 */
export async function applyResponseChanges(
  parsedResponse: AiResponse,
  panel: vscode.WebviewPanel | null,
  context: vscode.ExtensionContext,
  workspaceFolders: readonly vscode.WorkspaceFolder[]
): Promise<void> {
  console.log('Applying response changes:', parsedResponse);

  if (!Array.isArray(parsedResponse.actions)) {
    console.warn('No valid actions array in AI response; skipping modifications.');
    if (parsedResponse.message && panel) {
      panel.webview.postMessage({ text: parsedResponse.message });
    }
    return;
  }

  const requiresConfirmation = !parsedResponse.actions.every(
    (action) => action.type === 'insertText'
  );
  let confirm: string | undefined = 'Yes';

  if (requiresConfirmation) {
    try {
      confirm = await Promise.race([
        vscode.window.showInformationMessage(
          parsedResponse.actions.length > 0
            ? `Apply ${parsedResponse.actions.length} change(s)? ${parsedResponse.message || 'See actions.'}`
            : 'No actions to apply. Show message anyway?',
          { modal: false },
          'Yes',
          'No'
        ),
        new Promise<undefined>((_, reject) =>
          setTimeout(() => reject(new Error('Prompt timed out')), 30000)
        ),
      ]);
    } catch (error) {
      console.warn('Confirmation prompt timed out; applying changes automatically.');
      vscode.window.showWarningMessage('Prompt timed out. Applying changes.');
    }

    if (confirm !== 'Yes') {
      console.log('User declined changes.');
      if (panel) panel.webview.postMessage({ text: 'Changes discarded.' });
      return;
    }
  }

  let allSucceeded = true;
  const rootPath = workspaceFolders[0].uri.fsPath;

  for (const action of parsedResponse.actions) {
    const sanitizedPath = action.path ? sanitizeFilePath(action.path) : '';
    const fullPath = action.path ? path.join(rootPath, sanitizedPath) : '';
    const uri = action.path ? vscode.Uri.file(fullPath) : null;

    try {
      switch (action.type) {
        case 'createFolder':
          if (!uri) throw new Error('Path required for createFolder.');
          try {
            await vscode.workspace.fs.stat(uri);
            console.log(`Folder ${sanitizedPath} already exists; skipping.`);
          } catch {
            await vscode.workspace.fs.createDirectory(uri);
            console.log(`Created folder: ${sanitizedPath}`);
          }
          break;

        case 'createFile':
          if (!uri) throw new Error('Path required for createFile.');
          await vscode.workspace.fs.writeFile(
            uri,
            new TextEncoder().encode(action.content || '')
          );
          console.log(`Created file: ${sanitizedPath}`);
          break;

        case 'editFile':
          if (!uri || !action.range || !action.newText) {
            throw new Error('Path, range, and newText required for editFile.');
          }
          const doc = await vscode.workspace.openTextDocument(uri);
          const range = new vscode.Range(
            Math.min(action.range.startLine, doc.lineCount - 1),
            Math.min(action.range.startCharacter, doc.lineAt(action.range.startLine).text.length),
            Math.min(action.range.endLine, doc.lineCount - 1),
            Math.min(action.range.endCharacter, doc.lineAt(action.range.endLine).text.length)
          );
          const edit = new vscode.WorkspaceEdit();
          edit.replace(uri, range, action.newText);
          if (await vscode.workspace.applyEdit(edit)) {
            console.log(`Edited file: ${sanitizedPath} at range ${range.start.line}:${range.end.line}`);
          } else {
            throw new Error('Edit application failed.');
          }
          break;

        case 'deleteFile':
          if (!fullPath) throw new Error('Path required for deleteFile.');
          await deletePath(fullPath);
          break;

        case 'deleteFolder':
          if (!fullPath) throw new Error('Path required for deleteFolder.');
          await deletePath(fullPath);
          break;

        case 'insertText':
          const editor = vscode.window.activeTextEditor;
          if (!editor) throw new Error('No active editor for insertText.');
          await editor.edit((editBuilder) =>
            editBuilder.insert(editor.selection.active, action.text || '')
          );
          console.log(`Inserted text at ${editor.selection.active.line}:${editor.selection.active.character}`);
          break;

        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to apply action ${action.type} on ${sanitizedPath || 'N/A'}: ${errorMsg}`);
      if (panel) {
        panel.webview.postMessage({ text: `Error on ${action.type}: ${errorMsg}` });
      }
      allSucceeded = false;
    }
  }

  const reply = parsedResponse.message || 'Actions completed.';
  if (panel) {
    panel.webview.postMessage({ text: reply });
    if (allSucceeded) {
      const history = context.globalState.get<ChatHistoryItem[]>('chatHistory', []);
      history.push({
        user: '', // User input not stored here; handled in chat.ts
        ai: reply,
        timestamp: new Date().toISOString(),
        files: parsedResponse.actions.map((a) => a.path).filter(Boolean) as string[],
        errors: [], // Could be populated if AI response includes error refs
      });
      await context.globalState.update('chatHistory', history);
      console.log('Updated chat history with response.');
    }
  }

  vscode.window.showInformationMessage(
    allSucceeded ? 'Changes applied successfully!' : 'Some changes failed; check logs.'
  );
}