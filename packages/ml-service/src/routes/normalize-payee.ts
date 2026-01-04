import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { costTracker } from '../cost-tracker.js';
import { ClaudeProvider } from '../providers/claude.js';
import { OpenAIProvider } from '../providers/openai.js';
import { LLMProvider } from '../providers/base.js';
import {
    buildPayeeNormalizationPrompt,
    parseNormalizationResponse
} from '../prompts/payee-normalization.js';

export const normalizePayeeRouter = Router();

const requestSchema = z.object({
    rawPayee: z.string(),
    existingPayees: z.array(z.string()).default([]),
});

let provider: LLMProvider | null = null;

function getProvider(): LLMProvider {
    if (!provider) {
        provider = config.primaryProvider === 'claude'
            ? new ClaudeProvider()
            : new OpenAIProvider();
    }
    return provider;
}

normalizePayeeRouter.post('/normalize-payee', async (req, res) => {
    if (costTracker.isAtLimit()) {
        res.status(429).json({ error: 'Daily token limit reached' });
        return;
    }

    try {
        const body = requestSchema.parse(req.body);

        const messages = buildPayeeNormalizationPrompt(body.rawPayee, body.existingPayees);
        const llmProvider = getProvider();
        const response = await llmProvider.complete(messages);

        if (response.usage) {
            costTracker.recordUsage('normalize-payee', response.usage.inputTokens, response.usage.outputTokens);
        }

        const result = parseNormalizationResponse(response.content);

        if (!result) {
            res.status(422).json({ error: 'Failed to parse response' });
            return;
        }

        res.json({ result });
    } catch (err) {
        console.error('Payee normalization error:', err);
        res.status(500).json({ error: String(err) });
    }
});
