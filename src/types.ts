export interface ChatHistoryItem {
    user: string;
    ai: string;
    timestamp: string;
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
    type: 'createFolder' | 'createFile' | 'editFile' | 'deleteFile' | 'deleteFolder' | 'insertText';
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

// Add the ApiConfig interface
export interface ApiConfig {
    endpoint: string;
    apiKey: string;
    model: string;
    requestFormat: (input: string) => {
        model: string;
        messages: { role: string; content: string }[];
        max_tokens: number;
        temperature: number;
    };
}