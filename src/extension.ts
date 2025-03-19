import * as vscode from 'vscode';
import { openChatPanel } from './chat';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Extension activated with GPT-4! Do you see this?', 'Yes', 'No').then(response => {
        console.log('Initial dialog test response:', response);
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.helloWorld', () => {
            vscode.window.showInformationMessage('Hello from My AI Assistant (GPT-4 powered)!');
        }),
        vscode.commands.registerCommand('extension.openChat', () => openChatPanel(context))
    );
}

export function deactivate() {
    // Cleanup if needed
}