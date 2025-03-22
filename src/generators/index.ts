// src/generators/index.ts
import { AiResponse, FileAction } from '../types';

// Define the ResponseGenerator interface
export interface ResponseGenerator {
  name: string;
  description: string;
  detect: (input: string) => boolean;
  generate: (input: string) => Promise<AiResponse>;
}

// Registry to store all generators
const generators: ResponseGenerator[] = [];

// Function to register a new generator
export function registerGenerator(generator: ResponseGenerator): void {
  generators.push(generator);
}

// Function to find the appropriate generator for a given input
export function findGenerator(input: string): ResponseGenerator | undefined {
  return generators.find(generator => generator.detect(input));
}

// Re-export types that might be needed by generators
export { AiResponse, FileAction };