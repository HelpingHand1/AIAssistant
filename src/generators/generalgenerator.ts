import { ResponseGenerator } from '../types';
import { getAiResponse } from '../api';

/**
 * A powerful, open-ended generator that catches any request not matched by
 * specialized triggers (e.g., snake). This generator will attempt
 * to create or modify files to fulfill the user's request as best it can.
 */
const generalGenerator: ResponseGenerator = {
  name: 'General Purpose Generator',
  description: 'Handles broad or vague requests like "build me a random game" or "create an app that does X."',

  detect: () => true, // Always matches

  generate: async (userRequest: string) => {
    const systemPrompt = `
You are a highly capable coding assistant integrated into a VS Code extension. 
Your role is to generate or modify code in the user's project according to their request. 
Your responses must be valid JSON with the following shape: 
{
  "actions": [
    { "type": "createFolder", "path": "<folder>" },
    { "type": "createFile", "path": "<file>", "content": "<content>" },
    { "type": "editFile", "path": "<file>", "range": {"startLine":0,"startCharacter":0,"endLine":0,"endCharacter":0}, "newText":"<new code>" },
    { "type": "deleteFile", "path": "<file>" },
    { "type": "deleteFolder", "path": "<folder>" },
    { "type": "insertText", "text": "<text to insert at cursor>" }
  ],
  "message": "Explanation, instructions, or context here."
}

Guidelines:
- If the user requests a new app or game, create all needed files and folders (HTML, CSS, JS, TS, etc.).
- If the user has an existing codebase, consider the context for file paths.
- If the request is too vague, make a best guess or ask for clarification in the "message".
- Never return code outside of the JSON object. The "actions" array must contain real operations; do not wrap it in quotes.

User's request: "${userRequest}"
`;

    const aiResponse = await getAiResponse(systemPrompt);
    if (!aiResponse) {
      return {
        actions: [],
        message: "No valid response received from the AI. Please try again or refine your request."
      };
    }

    return aiResponse;
  }
};

export default generalGenerator;
