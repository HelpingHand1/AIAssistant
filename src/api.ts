import * as vscode from 'vscode';
import axios from 'axios';
import { ApiConfig, AiResponse } from './types';
import { projectIndex } from './fileOperations';
import { extractErrorMessage } from './utils';

// API provider type for better type safety
export type ApiProvider = 'anthropic' | 'openai';

export async function getApiConfig(provider: ApiProvider = 'openai'): Promise<ApiConfig> {
    const config = vscode.workspace.getConfiguration('myAiAssistant');
    
    let model: string;
    let endpoint: string;
    let apiKey: string | undefined;
    let requestFormat: (input: string) => any;
    
    // If provider is Anthropic but there's no Anthropic key set, fallback to OpenAI
    if (provider === 'anthropic') {
        const maybeKey = config.get('anthropicApiKey') as string | undefined;
        if (!maybeKey) {
            console.warn('[getApiConfig] No Anthropic API key found. Falling back to OpenAI...');
            provider = 'openai'; // Force fallback
        }
    }

    if (provider === 'anthropic') {
        // By the time we reach here, a key must exist
        model = 'claude-3-7-sonnet-20250219';
        endpoint = 'https://api.anthropic.com/v1/messages';
        apiKey = config.get('anthropicApiKey') as string; // guaranteed to exist now

        requestFormat = (input: string) => ({
            model,
            messages: [
                { role: 'system', content: `Your system prompt here...` },
                { role: 'user', content: input }
            ],
            max_tokens: 4000
        });
    } else {
        // Default to OpenAI
        model = 'gpt-4';
        endpoint = 'https://api.openai.com/v1/chat/completions';
        apiKey = config.get('openaiApiKey') as string | undefined;
        
        if (!apiKey) {
            throw new Error('No OpenAI API key configured. Please set it in VS Code settings (myAiAssistant.openaiApiKey).');
        }
        
        requestFormat = (input: string) => ({
            model,
            messages: [
                {
                    role: 'system',
                    content: `You are an advanced coding assistant powered by GPT-4, designed to interpret user requests in a VS Code extension. Your goal is to deliver high-quality, creative, and functional code solutions. Use the provided project context to inform your responses. **You must respond with a valid JSON object** containing an 'actions' array (for file/folder operations) and a 'message' string (explaining your reasoning, assumptions, and instructions), unless instructed to return only code.

                    Project context: ${JSON.stringify(projectIndex)}

                    Supported actions:
                    - \"createFolder\": {\"type\": \"createFolder\", \"path\": \"<folder_path>\"}
                    - \"createFile\": {\"type\": \"createFile\", \"path\": \"<file_path>\", \"content\": \"<file_content>\"}
                    - \"editFile\": {\"type\": \"editFile\", \"path\": \"<file_path>\", \"range\": {startLine, startCharacter, endLine, endCharacter}, \"newText\": \"<text>\"}
                    - \"deleteFile\": {\"type\": \"deleteFile\", \"path\": \"<file_path>\"}
                    - \"deleteFolder\": {\"type\": \"deleteFolder\", \"path\": \"<folder_path>\"}

                    Guidelines:
                    - Interpret vague requests intelligently and creatively (e.g., \"make a game\" should result in a fully functional game like Snake with HTML/CSS/JS).
                    - Use project context to choose logical file locations and enhance existing code.
                    - Provide complete, well-commented code adhering to modern standards (e.g., ES6+, CSS Grid).
                    - If unclear, make a reasoned assumption and explain it in the 'message', or suggest clarification.
                    - Aim for production-ready outputs that maximize usefulness.
                    - **Your response must be a valid JSON object. Do not start with text like \"Sure, I'll...\" or \"Creating a...\". Do not embed JSON within the message string unless it's part of an explanation. The 'actions' array must contain the actual actions to be performed, not a string representation of JSON.**
                    - For game or app requests, provide a complete implementation including all necessary logic, not just a skeleton.

                    Examples:
                    - Input: \"Make a snake game\"
                      Output: {\"actions\": [{\"type\": \"createFolder\", \"path\": \"snake_game\"}, {\"type\": \"createFile\", \"path\": \"snake_game/index.html\", \"content\": \"<!DOCTYPE html><html lang='en'>...\"}, {\"type\": \"createFile\", \"path\": \"snake_game/snake.css\", \"content\": \"body { background-color: #1a1a1a; ...}\"}, {\"type\": \"createFile\", \"path\": \"snake_game/snake.js\", \"content\": \"const canvas = document.getElementById('game');...\"}], \"message\": \"Created a fully functional Snake game in the 'snake_game' folder. Use the arrow keys to control the snake, eat the red food to grow, and avoid hitting the walls or yourself!\"}
                    - Input: \"Create a todo app\"
                      Output: {\"actions\": [{\"type\": \"createFolder\", \"path\": \"todo_app\"}, {\"type\": \"createFile\", \"path\": \"todo_app/index.html\", \"content\": \"<!DOCTYPE html><html lang='en'>...\"}, {\"type\": \"createFile\", \"path\": \"todo_app/style.css\", \"content\": \"body { background-color: #f4f4f4; ...}\"}, {\"type\": \"createFile\", \"path\": \"todo_app/app.js\", \"content\": \"const todoInput = document.getElementById('todoInput');...\"}], \"message\": \"Created a simple Todo App in the 'todo_app' folder. Enter a task and click 'Add' or press Enter to add it to the list.\"}
                    - Input: \"Add a utility\"
                      Output: {\"actions\": [{\"type\": \"createFile\", \"path\": \"utils/helpers.js\", \"content\": \"export const formatDate = ...\"}], \"message\": \"Added a date formatting utility in utils/helpers.js.\"}
                    `
                },
                { role: 'user', content: input }
            ],
            max_tokens: 4000,
            temperature: 0.5
        });
    }
    
    return { endpoint, apiKey, model, requestFormat };
}

export async function getAiMessage(message: string, provider: ApiProvider = 'openai'): Promise<string | null> {
    try {
        const config = await getApiConfig(provider);
        const requestBody = config.requestFormat(message);
        const response = await axios.post(config.endpoint, requestBody, {
            headers: { 'Authorization': `Bearer ${config.apiKey}` }
        });
        
        // Handle different response formats from different providers
        if (provider === 'anthropic') {
            return response.data.content[0].text;
        } else {
            return response.data.choices[0].message.content;
        }
    } catch (error) {
        const errorMessage = extractErrorMessage(error);
        console.error(`Error getting AI message from ${provider}:`, errorMessage);
        vscode.window.showErrorMessage(`AI request failed (${provider}): ${errorMessage}`);
        return null;
    }
}

export async function getAiResponse(message: string, provider: ApiProvider = 'openai'): Promise<AiResponse | null> {
    const aiMessage = await getAiMessage(message, provider);
    if (!aiMessage) return null;

    try {
        return JSON.parse(aiMessage);
    } catch (e) {
        console.error('Error parsing AI response:', e);
        // Attempt to extract JSON from the message if it contains embedded JSON
        const jsonMatch = aiMessage.match(/```json\\n([\\s\\S]*?)\\n```/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return parsed as AiResponse;
            } catch (innerError) {
                console.error('Error parsing embedded JSON:', innerError);
            }
        }
        // Fallback to raw text as message with empty actions
        return { actions: [], message: aiMessage };
    }
}
