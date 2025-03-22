import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be activated', async () => {
    const extension = vscode.extensions.getExtension('HelpingHand1.my-ai-assistant');
    assert.ok(extension);
    
    // Ensure the extension is activated
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true);
  });

  test('Command should be registered', async () => {
    // Get a list of all available commands
    const commands = await vscode.commands.getCommands();
    
    // Check if your command is registered
    assert.ok(commands.includes('extension.helloWorld'));
    assert.ok(commands.includes('extension.openChat'));
  });

  test('Hello world command should show message', async () => {
    // Create a spy to check if showInformationMessage was called
    let messageShown = false;
    const originalShowMessage = vscode.window.showInformationMessage;
    vscode.window.showInformationMessage = async (message: string) => {
      if (message.includes('Hello from My AI Assistant')) {
        messageShown = true;
      }
      return '';
    };
    
    try {
      // Execute the command
      await vscode.commands.executeCommand('extension.helloWorld');
      // Wait a bit for the message to be shown
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.strictEqual(messageShown, true);
    } finally {
      // Restore the original function
      vscode.window.showInformationMessage = originalShowMessage;
    }
  });
});