import { AiResponse, FileAction, ResponseGenerator } from '../types';
import snakeGameGenerator from './games/snake';
import generalGenerator from './generalgenerator'; // ✅ ADD THIS

// Registry
const generators: ResponseGenerator[] = [];

export function registerGenerator(generator: ResponseGenerator): void {
  generators.push(generator);
}

// Register specific generators
registerGenerator(snakeGameGenerator);

// Register fallback last
registerGenerator(generalGenerator); // ✅ REGISTER IT

export function findGenerator(input: string): ResponseGenerator | undefined {
  return generators.find(generator => generator.detect(input));
}

export { AiResponse, FileAction };
