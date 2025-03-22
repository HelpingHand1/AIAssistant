import * as crypto from 'crypto';

// Existing utility functions (assumed to be present based on previous context)
export function sanitizeFilePath(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9_./-]/g, '_').replace(/\/+/g, '/');
}

export function generateUniqueId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

export function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

export function formatCodeSnippet(code: string, language: string): string {
    return `<pre><code class="language-${language}">${code}</code></pre>`;
}

export function debounceAsync<T>(fn: (...args: any[]) => Promise<T>, wait: number): (...args: any[]) => Promise<T> {
    let timeout: NodeJS.Timeout | null = null;
    let promise: Promise<T> | null = null;

    return (...args: any[]) => {
        if (timeout) {
            clearTimeout(timeout);
        }

        if (!promise) {
            promise = new Promise<T>((resolve, reject) => {
                timeout = setTimeout(async () => {
                    try {
                        const result = await fn(...args);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    } finally {
                        timeout = null;
                        promise = null;
                    }
                }, wait);
            });
        }

        return promise;
    };
}

export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

// Game development utilities
export function createCanvasGameBoilerplate(canvasId: string = 'game'): string {
    return `// Get canvas and context
const canvas = document.getElementById('${canvasId}');
const ctx = canvas.getContext('2d');

// Game settings
const gridSize = 20;
const tileCount = canvas.width / gridSize;
const tileSize = canvas.width / tileCount;

// Game loop setup
let gameLoop;

function startGame(gameLogic) {
    clearTimeout(gameLoop);
    gameLogic();
    gameLoop = setTimeout(() => startGame(gameLogic), 100);
}

function stopGame() {
    clearTimeout(gameLoop);
}`;
}

export function createKeyHandler(directionVar: { dx: string, dy: string }): string {
    return `// Handle key presses
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowUp':
            if (${directionVar.dy} !== 1) { ${directionVar.dx} = 0; ${directionVar.dy} = -1; }
            break;
        case 'ArrowDown':
            if (${directionVar.dy} !== -1) { ${directionVar.dx} = 0; ${directionVar.dy} = 1; }
            break;
        case 'ArrowLeft':
            if (${directionVar.dx} !== 1) { ${directionVar.dx} = -1; ${directionVar.dy} = 0; }
            break;
        case 'ArrowRight':
            if (${directionVar.dx} !== -1) { ${directionVar.dx} = 1; ${directionVar.dy} = 0; }
            break;
    }
});`;
}