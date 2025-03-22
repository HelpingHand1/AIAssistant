import * as vscode from 'vscode';
import { openChatPanel } from './chat'; 
import { getAiResponse } from './api';    // Changed from './ai' to './api'
import { applyResponseChanges } from './fileOperations';

export function activate(context: vscode.ExtensionContext) {
    console.log('Attempting to activate HelpingHand1.my-ai-assistant...');

    // Show activation message
    console.log('Showing activation message...');
    vscode.window.showInformationMessage('Extension activated with GPT-4! Do you see this?', 'Yes', 'No').then(response => {
        console.log('Initial dialog test response:', response);
    });

    // Register commands
    console.log('Registering commands for HelpingHand1.my-ai-assistant...');
    context.subscriptions.push(
        // Hello World command
        vscode.commands.registerCommand('extension.helloWorld', () => {
            console.log('Executing extension.helloWorld command');
            vscode.window.showInformationMessage('Hello from My AI Assistant (GPT-4 powered)!');
        }),

        // Open Chat command
        vscode.commands.registerCommand('extension.openChat', () => {
            console.log('Executing extension.openChat command');
            try {
                openChatPanel(context);
                console.log('openChatPanel executed successfully');
            } catch (error) {
                console.error('Error in extension.openChat:', error);
            }
        }),

        // Edit Selection command
        vscode.commands.registerCommand('extension.editSelection', async () => {
            console.log('Executing extension.editSelection command');
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor || editor.selection.isEmpty) {
                    console.log('No active editor or selection');
                    vscode.window.showErrorMessage('No text selected.');
                    return;
                }
                const selectedText = editor.document.getText(editor.selection);
                const aiResponse = await getAiResponse(selectedText);
                if (aiResponse) {
                    console.log('AI response received:', aiResponse);
                    vscode.window.showInformationMessage(aiResponse.message);
                }
            } catch (error) {
                console.error('Error in extension.editSelection:', error);
            }
        }),

        // Suggest Code command
        vscode.commands.registerCommand('extension.suggestCode', async () => {
            console.log('Executing extension.suggestCode command');
            try {
                const aiResponse = await getAiResponse('Suggest some code');
                if (aiResponse) {
                    console.log('AI response received:', aiResponse);
                    vscode.window.showInformationMessage(aiResponse.message);
                }
            } catch (error) {
                console.error('Error in extension.suggestCode:', error);
            }
        }),

        // Modify Project command
        vscode.commands.registerCommand('extension.modifyProject', async () => {
            console.log('Executing extension.modifyProject command');
            try {
                const aiResponse = await getAiResponse('Modify the project');
                if (aiResponse) {
                    console.log('AI response received:', aiResponse);
                    await applyResponseChanges(aiResponse, null, context, vscode.workspace.workspaceFolders || []);
                    console.log('Project modifications applied');
                }
            } catch (error) {
                console.error('Error in extension.modifyProject:', error);
            }
        }),

        // Undo Changes command (placeholder, as not in tests but in package.json)
        vscode.commands.registerCommand('extension.undoChanges', () => {
            console.log('Executing extension.undoChanges command');
            try {
                vscode.window.showInformationMessage('Undo feature not yet implemented.');
                console.log('UndoChanges placeholder executed');
            } catch (error) {
                console.error('Error in extension.undoChanges:', error);
            }
        })
    );

    console.log('Commands registered successfully for HelpingHand1.my-ai-assistant');
    console.log('Activation complete for HelpingHand1.my-ai-assistant');
}

export function deactivate() {
    console.log('Deactivating HelpingHand1.my-ai-assistant');
}