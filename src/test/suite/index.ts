import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';
import * as vscode from 'vscode';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 10000,
  });

  mocha.suite.emit('pre-require', global, 'suite', mocha);

  describe('Extension Tests', () => {
    it('should activate extension', async () => {
      const extension = vscode.extensions.getExtension('HelpingHand1.my-ai-assistant');
      console.log('Extension:', extension);
      assert.ok(extension, 'Extension not found');
      const activationResult = await extension.activate();
      console.log('Activation Result:', activationResult);
      assert.ok(activationResult, 'Extension did not activate successfully');
    });
  });

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
