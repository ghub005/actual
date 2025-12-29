import { Router } from 'express';
import { config } from '../config.js';
import { costTracker } from '../cost-tracker.js';
export const healthRouter = Router();
healthRouter.get('/health', (_req, res) => {
    const usage = costTracker.getTodayUsage();
    res.json({
        status: 'ok',
        provider: config.primaryProvider,
        model: config.primaryProvider === 'claude' ? config.anthropicModel : config.openaiModel,
        timestamp: new Date().toISOString(),
        usage: {
            todayTokens: usage.inputTokens + usage.outputTokens,
            dailyLimit: config.dailyTokenLimit,
            percentUsed: costTracker.getUsagePercentage().toFixed(1) + '%',
            atLimit: costTracker.isAtLimit(),
        },
    });
});
healthRouter.get('/usage', (_req, res) => {
    const today = costTracker.getTodayUsage();
    const monthly = costTracker.getMonthlyStats();
    res.json({
        today: {
            inputTokens: today.inputTokens,
            outputTokens: today.outputTokens,
            totalTokens: today.inputTokens + today.outputTokens,
            requestCount: today.requestCount,
            estimatedCost: `$${costTracker.getTodayCost().toFixed(4)}`,
            limit: config.dailyTokenLimit,
            remaining: costTracker.getRemainingTokens(),
            percentUsed: costTracker.getUsagePercentage().toFixed(1) + '%',
            byFeature: today.features,
        },
        monthly: {
            totalTokens: monthly.totalTokens,
            totalRequests: monthly.totalRequests,
            daysActive: monthly.days,
            estimatedCost: `$${costTracker.getMonthlyCost().toFixed(2)}`,
        },
    });
});
//# sourceMappingURL=health.js.map