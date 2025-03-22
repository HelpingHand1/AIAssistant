import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',        // Use TDD UI (Test-Driven Development)
    color: true,      // Colored output
    timeout: 60000    // 60 seconds timeout
  });

  const testsRoot = path.resolve(__dirname, '.');

  try {
    // Find all test files using the Promise-based approach for glob v10+
    const files: string[] = await glob('**/**.test.js', { cwd: testsRoot });

    // Add files to the test suite
    files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

    // Run the mocha test
    return new Promise<void>((resolve, reject) => {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    console.error('Error running tests:', err);
    throw err;
  }
}