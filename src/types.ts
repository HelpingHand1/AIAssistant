export interface FileData {
    path: string;
    content: string;
}

export interface ProjectIndexItem {
    path: string;
    symbols: string[];
}

export interface ChatHistoryItem {
    user: string;
    ai: string;
}

export interface ApiConfig {
    endpoint: string;
    apiKey: string | undefined;
    model: string;
    requestFormat: (input: string) => any;
}

export interface Action {
    type: 'createFolder' | 'createFile' | 'editFile' | 'deleteFile' | 'deleteFolder';
    path: string;
    content?: string;
    range?: {
        startLine: number;
        startCharacter: number;
        endLine: number;
        endCharacter: number;
    };
    newText?: string;
}

export interface AiResponse {
    actions: Action[];
    message: string;
}