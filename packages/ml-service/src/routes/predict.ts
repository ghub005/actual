import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { costTracker } from '../cost-tracker.js';
import { ClaudeProvider } from '../providers/claude.js';
import { OpenAIProvider } from '../providers/openai.js';
import { LLMProvider } from '../providers/base.js';
import {
    buildCategorizationPrompt,
    parseCategorizationResponse,
    buildBatchCategorizationPrompt,
    parseBatchCategorizationResponse,
} from '../prompts/categorization.js';

export const predictRouter = Router();

const predictRequestSchema = z.object({
    transaction: z.object({
        payee: z.string(),
        importedPayee: z.string().optional(),
        amount: z.number(),
        date: z.string(),
        notes: z.string().optional(),
    }),
    categories: z.array(z.object({
        id: z.string(),
        name: z.string(),
        groupName: z.string().optional(),
    })),
    recentCorrections: z.array(z.object({
        payee: z.string(),
        category: z.string(),
    })).optional(),
});

const batchRequestSchema = z.object({
    transactions: z.array(z.object({
        payee: z.string(),
        importedPayee: z.string().optional(),
        amount: z.number(),
        date: z.string(),
        notes: z.string().optional(),
    })).max(10),
    categories: z.array(z.object({
        id: z.string(),
        name: z.string(),
        groupName: z.string().optional(),
    })),
    recentCorrections: z.array(z.object({
        payee: z.string(),
        category: z.string(),
    })).optional(),
});

let provider: LLMProvider | null = null;
let fallbackProvider: LLMProvider | null = null;

function getProvider(): LLMProvider {
    if (!provider) {
        provider = config.primaryProvider === 'claude'
            ? new ClaudeProvider()
            : new OpenAIProvider();
    }
    return provider;
}

function getFallbackProvider(): LLMProvider | null {
    if (fallbackProvider === null && config.primaryProvider === 'claude' && config.openaiApiKey) {
        fallbackProvider = new OpenAIProvider();
    }
    return fallbackProvider;
}

predictRouter.post('/predict', async (req, res) => {
    // Check daily limit
    if (costTracker.isAtLimit()) {
        res.status(429).json({
            error: 'Daily token limit reached',
            limit: config.dailyTokenLimit,
            usedToday: costTracker.getTotalTokensToday(),
        });
        return;
    }

    try {
        const body = predictRequestSchema.parse(req.body);

        const messages = buildCategorizationPrompt(
            body.transaction,
            body.categories,
            body.recentCorrections
        );

        let response;
        const llmProvider = getProvider();

        try {
            response = await llmProvider.complete(messages, {
                jsonMode: llmProvider.name === 'openai'
            });
        } catch (err) {
            const fallback = getFallbackProvider();
            if (fallback) {
                console.log('Primary provider failed, trying fallback');
                response = await fallback.complete(messages, { jsonMode: true });
            } else {
                throw err;
            }
        }

        // Track usage
        if (response.usage) {
            costTracker.recordUsage('predict', response.usage.inputTokens, response.usage.outputTokens);
        }

        const result = parseCategorizationResponse(response.content);

        if (!result) {
            res.status(422).json({ error: 'Failed to parse LLM response', raw: response.content });
            return;
        }

        // Apply confidence threshold
        if (result.confidence < config.confidenceThreshold) {
            res.json({
                prediction: null,
                reason: 'Below confidence threshold',
                actualConfidence: result.confidence,
                threshold: config.confidenceThreshold,
            });
            return;
        }

        res.json({
            prediction: result,
            provider: llmProvider.name,
            usage: response.usage,
        });
    } catch (err) {
        console.error('Prediction error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// Batch prediction endpoint (for cost efficiency)
predictRouter.post('/predict/batch', async (req, res) => {
    // Check daily limit
    if (costTracker.isAtLimit()) {
        res.status(429).json({
            error: 'Daily token limit reached',
            limit: config.dailyTokenLimit,
        });
        return;
    }

    try {
        const body = batchRequestSchema.parse(req.body);

        if (body.transactions.length === 0) {
            res.json({ results: [] });
            return;
        }

        const messages = buildBatchCategorizationPrompt(
            body.transactions,
            body.categories,
            body.recentCorrections
        );

        const llmProvider = getProvider();
        const response = await llmProvider.complete(messages, {
            maxTokens: 2048,
            jsonMode: llmProvider.name === 'openai',
        });

        // Track usage
        if (response.usage) {
            costTracker.recordUsage('predict-batch', response.usage.inputTokens, response.usage.outputTokens);
        }

        const originalPayees = body.transactions.map(t => t.payee);
        const batchResult = parseBatchCategorizationResponse(response.content, originalPayees);

        // Apply confidence threshold
        const filteredResults = batchResult.results.map(r => ({
            ...r,
            prediction: r.prediction && r.prediction.confidence >= config.confidenceThreshold
                ? r.prediction
                : null,
            belowThreshold: r.prediction && r.prediction.confidence < config.confidenceThreshold,
        }));

        res.json({
            results: filteredResults,
            provider: llmProvider.name,
            usage: response.usage,
        });
    } catch (err) {
        console.error('Batch prediction error:', err);
        res.status(500).json({ error: String(err) });
    }
});
