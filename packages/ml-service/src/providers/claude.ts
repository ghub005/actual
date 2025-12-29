import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMResponse, CompletionOptions } from './base.js';
import { config } from '../config.js';

export class ClaudeProvider implements LLMProvider {
    name = 'claude';
    private client: Anthropic;

    constructor() {
        if (!config.anthropicApiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }
        this.client = new Anthropic({
            apiKey: config.anthropicApiKey,
        });
    }

    async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<LLMResponse> {
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));

        const response = await this.client.messages.create({
            model: config.anthropicModel,
            max_tokens: options?.maxTokens ?? 1024,
            system: systemMessage?.content,
            messages: conversationMessages,
        });

        const textContent = response.content.find(c => c.type === 'text');

        return {
            content: textContent?.text ?? '',
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            },
        };
    }
}
