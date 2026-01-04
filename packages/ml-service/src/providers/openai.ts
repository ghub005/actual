import OpenAI from 'openai';
import { LLMProvider, LLMMessage, LLMResponse, CompletionOptions } from './base.js';
import { config } from '../config.js';

export class OpenAIProvider implements LLMProvider {
    name = 'openai';
    private client: OpenAI;

    constructor() {
        if (!config.openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured');
        }
        this.client = new OpenAI({
            apiKey: config.openaiApiKey,
        });
    }

    async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<LLMResponse> {
        const response = await this.client.chat.completions.create({
            model: config.openaiModel,
            max_tokens: options?.maxTokens ?? 1024,
            temperature: options?.temperature ?? 0.3,
            response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        });

        return {
            content: response.choices[0]?.message?.content ?? '',
            usage: {
                inputTokens: response.usage?.prompt_tokens ?? 0,
                outputTokens: response.usage?.completion_tokens ?? 0,
            },
        };
    }
}
