export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

export interface CompletionOptions {
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
}

export interface LLMProvider {
    name: string;
    complete(messages: LLMMessage[], options?: CompletionOptions): Promise<LLMResponse>;
}
