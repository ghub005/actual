import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { costTracker } from '../cost-tracker.js';
import { ClaudeProvider } from '../providers/claude.js';
import { OpenAIProvider } from '../providers/openai.js';
import { buildNaturalLanguagePrompt, parseNaturalLanguageResponse } from '../prompts/natural-language.js';
export const parseNLRouter = Router();
const requestSchema = z.object({
    input: z.string(),
    accounts: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    today: z.string().optional(),
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
parseNLRouter.post('/parse-natural-language', async (req, res) => {
    if (costTracker.isAtLimit()) {
        res.status(429).json({ error: 'Daily token limit reached' });
        return;
    }
    try {
        const body = requestSchema.parse(req.body);
        const today = body.today || new Date().toISOString().split('T')[0];
        const messages = buildNaturalLanguagePrompt(body.input, body.accounts, body.categories, today);
        const llmProvider = getProvider();
        const response = await llmProvider.complete(messages);
        if (response.usage) {
            costTracker.recordUsage('parse-nl', response.usage.inputTokens, response.usage.outputTokens);
        }
        const result = parseNaturalLanguageResponse(response.content);
        if (!result) {
            res.status(422).json({ error: 'Failed to parse input' });
            return;
        }
        res.json({ result });
    }
    catch (err) {
        console.error('NL parsing error:', err);
        res.status(500).json({ error: String(err) });
    }
});
//# sourceMappingURL=parse-natural-language.js.map