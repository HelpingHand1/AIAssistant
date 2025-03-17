import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 10000,
  });

  mocha.suite.emit('pre-require', global, 'suite', mocha);

  describe('My AI Assistant Tests', () => {
    it('should activate extension', async () => {
      // Path to the compiled extension file
      const extensionPath = path.join(process.cwd(), 'out/src/extension');

      // Check if the compiled extension file exists
      if (!fs.existsSync(`${extensionPath}.js`)) {
        throw new Error(`Extension file not found at ${extensionPath}.js`);
      }

      const extension = require(extensionPath);
      const context = { subscriptions: [] };

      console.log('Activating extension...');
      
      try {
        const result = await extension.activate(context);
        console.log('Extension activated successfully:', result);
        assert.ok(result, 'Extension activated successfully');
      } catch (err) {
        console.error('Error during extension activation:', err);
        throw err;
      }
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
