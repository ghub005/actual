import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();
const configSchema = z.object({
    // Server
    port: z.coerce.number().default(3050),
    // LLM Configuration
    primaryProvider: z.enum(['claude', 'openai']).default('claude'),
    confidenceThreshold: z.coerce.number().min(0).max(1).default(0.7),
    // Claude
    anthropicApiKey: z.string().optional(),
    anthropicModel: z.string().default('claude-sonnet-4-20250514'),
    // OpenAI
    openaiApiKey: z.string().optional(),
    openaiModel: z.string().default('gpt-4o'),
    // Cost controls
    dailyTokenLimit: z.coerce.number().default(50000),
    maxConcurrentRequests: z.coerce.number().default(3),
    batchSize: z.coerce.number().default(10),
    // Retry settings
    maxRetries: z.coerce.number().default(3),
    retryDelayMs: z.coerce.number().default(1000),
});
export const config = configSchema.parse({
    port: process.env.ML_SERVICE_PORT,
    primaryProvider: process.env.ML_PRIMARY_PROVIDER,
    confidenceThreshold: process.env.ML_CONFIDENCE_THRESHOLD,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    dailyTokenLimit: process.env.ML_DAILY_TOKEN_LIMIT,
    maxConcurrentRequests: process.env.ML_MAX_CONCURRENT,
    batchSize: process.env.ML_BATCH_SIZE,
    maxRetries: process.env.ML_MAX_RETRIES,
    retryDelayMs: process.env.ML_RETRY_DELAY_MS,
});
export function validateConfig() {
    if (config.primaryProvider === 'claude' && !config.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY required when primaryProvider is claude');
    }
    if (config.primaryProvider === 'openai' && !config.openaiApiKey) {
        throw new Error('OPENAI_API_KEY required when primaryProvider is openai');
    }
}
//# sourceMappingURL=config.js.map