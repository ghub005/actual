import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { costTracker } from '../cost-tracker.js';
import { ClaudeProvider } from '../providers/claude.js';
import { OpenAIProvider } from '../providers/openai.js';
import { buildRuleSuggestionPrompt, parseRuleSuggestionResponse } from '../prompts/rule-suggestion.js';
export const suggestRulesRouter = Router();
const requestSchema = z.object({
    uncategorized: z.array(z.object({
        payee: z.string(),
        count: z.number(),
        totalAmount: z.number(),
        sampleDates: z.array(z.string()),
    })),
    existingPatterns: z.array(z.object({
        payee: z.string(),
        category: z.string(),
        count: z.number(),
    })),
    categories: z.array(z.object({
        id: z.string(),
        name: z.string(),
    })),
});
let provider = null;
function getProvider() {
    if (!provider) {
        provider = config.primaryProvider === 'claude'
            ? new ClaudeProvider()
            : new OpenAIProvider();
    }
    return provider;
}
suggestRulesRouter.post('/suggest-rules', async (req, res) => {
    if (costTracker.isAtLimit()) {
        res.status(429).json({ error: 'Daily token limit reached' });
        return;
    }
    try {
        const body = requestSchema.parse(req.body);
        const messages = buildRuleSuggestionPrompt(body.uncategorized, body.existingPatterns, body.categories);
        const llmProvider = getProvider();
        const response = await llmProvider.complete(messages, { maxTokens: 2048 });
        if (response.usage) {
            costTracker.recordUsage('suggest-rules', response.usage.inputTokens, response.usage.outputTokens);
        }
        const suggestions = parseRuleSuggestionResponse(response.content);
        res.json({ suggestions });
    }
    catch (err) {
        console.error('Rule suggestion error:', err);
        res.status(500).json({ error: String(err) });
    }
});
//# sourceMappingURL=suggest-rules.js.map