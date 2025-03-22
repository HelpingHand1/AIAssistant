import { AiResponse } from '../types';

// Interface for a response generator
export interface ResponseGenerator {
    name: string; // Unique name of the generator (e.g., "snakeGame")
    patterns: RegExp[]; // Patterns to match user input (e.g., [/snake game/i])
    generate: (message: string) => Promise<AiResponse> | AiResponse; // Function to generate the response
}

// Registry to hold all generators
const generators: ResponseGenerator[] = [];

// Register a generator
export function registerGenerator(generator: ResponseGenerator): void {
    generators.push(generator);
}

// Find a generator that matches the input message
export function findGenerator(message: string): ResponseGenerator | undefined {
    return generators.find(generator =>
        generator.patterns.some(pattern => pattern.test(message))
    );
}

// Export all generators (for importing in other files)
export { generators };