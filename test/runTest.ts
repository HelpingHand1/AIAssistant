import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
    try {
        // Correct paths
        const extensionDevelopmentPath = path.resolve(__dirname, "../"); // Path to the project root
        const extensionTestsPath = path.resolve(__dirname, "./suite/index.js"); // Correct test suite entry point

        // Debugging logs for verification
        console.log("Extension Development Path:", extensionDevelopmentPath);
        console.log("Extension Tests Path:", extensionTestsPath);

        // Run the tests
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: ["--disable-extensions"],
        });
    } catch (err) {
        console.error("Failed to run tests", err);
        process.exit(1);
    }
}

main();
