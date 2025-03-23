/**
 * Represents a single entry in the chat history, including user input, AI response,
 * and optional metadata about referenced files and errors.
 */
export interface ChatHistoryItem {
    user: string;
    ai: string;
    timestamp: string;
    files?: string[];
    errors?: string[];
  }
  
  export interface Range {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  }
  
  export interface FileData {
    path: string;
    content: string;
  }
  
  export interface ProjectIndexItem {
    path: string;
    symbols: string[];
  }
  
  export interface FileAction {
    type:
      | 'createFolder'
      | 'createFile'
      | 'editFile'
      | 'deleteFile'
      | 'deleteFolder'
      | 'insertText';
    path?: string;
    content?: string;
    range?: Range;
    newText?: string;
    text?: string;
  }
  
  export interface AiResponse {
    actions: FileAction[];
    message: string;
  }
  
  export interface ApiConfig {
    endpoint: string;
    apiKey: string;
    model: string;
    requestFormat: (input: string) => {
      model: string;
      messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
      max_tokens: number;
      temperature: number;
    };
  }
  
  /**
   * Shared interface used by all file generators (e.g., snake, general, todo).
   */
  export interface ResponseGenerator {
    name: string;
    description: string;
    detect: (input: string) => boolean;
    generate: (input: string) => Promise<AiResponse>;
  }
  
  