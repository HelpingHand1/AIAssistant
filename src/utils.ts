import * as crypto from 'crypto';
import { ChatHistoryItem } from './types';

/**
 * Sanitizes a file path by replacing invalid characters and normalizing slashes.
 * @param filePath The raw file path to sanitize
 * @returns A sanitized file path safe for filesystem operations
 */
export function sanitizeFilePath(filePath: string): string {
  return filePath
    .replace(/[^a-zA-Z0-9_./-]/g, '_') // Replace invalid chars with underscore
    .replace(/\/+/g, '/'); // Normalize multiple slashes to single
}

/**
 * Generates a unique identifier with a custom prefix.
 * @param prefix A string to prepend to the UUID
 * @returns A unique string in the format `<prefix>-<uuid>`
 */
export function generateUniqueId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Truncates a string to a maximum length, appending ellipsis if needed.
 * @param str The string to truncate
 * @param maxLength The maximum allowed length
 * @returns The truncated string, with '...' if shortened
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const truncated = str.substring(0, maxLength - 3).trimEnd();
  return `${truncated}...`;
}

/**
 * Formats a code snippet for display in the webview.
 * @param code The code to format
 * @param language The programming language (e.g., 'typescript', 'javascript')
 * @returns An HTML string with pre/code tags and language class
 */
export function formatCodeSnippet(code: string, language: string): string {
  const escapedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre><code class="language-${language}">${escapedCode}</code></pre>`;
}

/**
 * Debounces an async function, delaying execution until calls settle.
 * @param fn The async function to debounce
 * @param wait The delay in milliseconds
 * @returns A debounced version of the function
 */
export function debounceAsync<T>(
  fn: (...args: any[]) => Promise<T>,
  wait: number
): (...args: any[]) => Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  let activePromise: Promise<T> | null = null;

  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);

    if (!activePromise) {
      activePromise = new Promise<T>((resolve, reject) => {
        timeout = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            timeout = null;
            activePromise = null;
          }
        }, wait);
      });
    }

    return activePromise;
  };
}

/**
 * Extracts a human-readable message from an error object.
 * @param error The error to process
 * @returns A string representation of the error message
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/**
 * Formats file content for inclusion in chat prompts or display.
 * @param filePath The path to the file
 * @param content The file’s content
 * @param maxLength Optional maximum length before truncation
 * @returns A formatted string with file path and indented content
 */
export function formatFileContent(filePath: string, content: string, maxLength: number = 2000): string {
  const truncated = truncateString(content, maxLength);
  const lines = truncated.split('\n').map((line) => `  ${line}`).join('\n');
  return `File: ${filePath}\n${lines}`;
}

/**
 * Formats an error message for inclusion in chat prompts or display.
 * @param error The error text to format
 * @returns A formatted string prefixed with 'Error:'
 */
export function formatError(error: string): string {
  return `Error: ${error}`;
}

/**
 * Summarizes chat history for concise context inclusion in prompts.
 * @param history The array of chat history items
 * @param maxLength Optional maximum length of the summary
 * @returns A summarized string of the chat history
 */
export function summarizeChatHistory(history: ChatHistoryItem[], maxLength: number = 1000): string {
  if (!history.length) return 'No prior context.';

  const summaryLines = history.map((item) => {
    let line = `User: ${item.user}\nAI: ${item.ai}`;
    if (item.files?.length) line += `\nFiles: ${item.files.join(', ')}`;
    if (item.errors?.length) line += `\nErrors: ${item.errors.join(', ')}`;
    return line;
  });

  const fullSummary = summaryLines.join('\n\n');
  return truncateString(fullSummary, maxLength);
}

// Game development utilities

/**
 * Generates boilerplate JavaScript code for a canvas-based game.
 * @param canvasId The ID of the canvas element (default: 'game')
 * @returns A string of JavaScript code for game setup
 */
export function createCanvasGameBoilerplate(canvasId: string = 'game'): string {
  return `// Game setup
const canvas = document.getElementById('${canvasId}') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
if (!ctx) throw new Error('Failed to get 2D context');

// Game settings
const gridSize = 20;
const tileCount = canvas.width / gridSize;
const tileSize = canvas.width / tileCount;

// Game loop
let gameLoop: number;

function startGame(gameLogic: () => void) {
  cancelAnimationFrame(gameLoop);
  gameLogic();
  gameLoop = requestAnimationFrame(() => startGame(gameLogic));
}

function stopGame() {
  cancelAnimationFrame(gameLoop);
}

// Example usage: startGame(() => { ctx.fillRect(0, 0, canvas.width, canvas.height); });`;
}

/**
 * Generates JavaScript code for handling arrow key inputs in a game.
 * @param directionVar Object with dx and dy property names for direction state
 * @returns A string of JavaScript code for key event handling
 */
export function createKeyHandler(directionVar: { dx: string; dy: string }): string {
  const { dx, dy } = directionVar;
  return `// Key event handling
document.addEventListener('keydown', (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowUp':
      if (${dy} !== 1) { ${dx} = 0; ${dy} = -1; }
      break;
    case 'ArrowDown':
      if (${dy} !== -1) { ${dx} = 0; ${dy} = 1; }
      break;
    case 'ArrowLeft':
      if (${dx} !== 1) { ${dx} = -1; ${dy} = 0; }
      break;
    case 'ArrowRight':
      if (${dx} !== -1) { ${dx} = 1; ${dy} = 0; }
      break;
  }
});`;
}