import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
const USAGE_FILE = path.join(process.cwd(), 'token-usage.json');
class CostTracker {
    usage = {};
    todayKey = '';
    constructor() {
        this.loadUsage();
        this.todayKey = this.getDateKey();
    }
    getDateKey() {
        return new Date().toISOString().split('T')[0];
    }
    loadUsage() {
        try {
            if (fs.existsSync(USAGE_FILE)) {
                const data = fs.readFileSync(USAGE_FILE, 'utf-8');
                this.usage = JSON.parse(data);
            }
        }
        catch {
            console.warn('Could not load token usage file, starting fresh');
            this.usage = {};
        }
    }
    saveUsage() {
        try {
            fs.writeFileSync(USAGE_FILE, JSON.stringify(this.usage, null, 2));
        }
        catch (err) {
            console.error('Failed to save token usage:', err);
        }
    }
    ensureToday() {
        const today = this.getDateKey();
        if (today !== this.todayKey) {
            this.todayKey = today;
        }
        if (!this.usage[today]) {
            this.usage[today] = {
                date: today,
                inputTokens: 0,
                outputTokens: 0,
                requestCount: 0,
                features: {},
            };
        }
        return this.usage[today];
    }
    recordUsage(feature, inputTokens, outputTokens) {
        const today = this.ensureToday();
        today.inputTokens += inputTokens;
        today.outputTokens += outputTokens;
        today.requestCount += 1;
        if (!today.features[feature]) {
            today.features[feature] = { input: 0, output: 0, count: 0 };
        }
        today.features[feature].input += inputTokens;
        today.features[feature].output += outputTokens;
        today.features[feature].count += 1;
        this.saveUsage();
    }
    getTodayUsage() {
        return this.ensureToday();
    }
    getTotalTokensToday() {
        const today = this.ensureToday();
        return today.inputTokens + today.outputTokens;
    }
    isAtLimit() {
        return this.getTotalTokensToday() >= config.dailyTokenLimit;
    }
    getRemainingTokens() {
        return Math.max(0, config.dailyTokenLimit - this.getTotalTokensToday());
    }
    getUsagePercentage() {
        return (this.getTotalTokensToday() / config.dailyTokenLimit) * 100;
    }
    isNearLimit(threshold = 0.8) {
        return this.getUsagePercentage() >= threshold * 100;
    }
    getMonthlyStats() {
        const now = new Date();
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let totalTokens = 0;
        let totalRequests = 0;
        let days = 0;
        for (const [date, usage] of Object.entries(this.usage)) {
            if (date.startsWith(monthPrefix)) {
                totalTokens += usage.inputTokens + usage.outputTokens;
                totalRequests += usage.requestCount;
                days += 1;
            }
        }
        return { totalTokens, totalRequests, days };
    }
    estimateCost(inputTokens, outputTokens) {
        // Claude Sonnet pricing (approximate): $3/1M input, $15/1M output
        const inputCost = (inputTokens / 1_000_000) * 3;
        const outputCost = (outputTokens / 1_000_000) * 15;
        return inputCost + outputCost;
    }
    getTodayCost() {
        const today = this.ensureToday();
        return this.estimateCost(today.inputTokens, today.outputTokens);
    }
    getMonthlyCost() {
        const stats = this.getMonthlyStats();
        // Rough estimate assuming 70% input, 30% output ratio
        const inputEstimate = stats.totalTokens * 0.7;
        const outputEstimate = stats.totalTokens * 0.3;
        return this.estimateCost(inputEstimate, outputEstimate);
    }
}
export const costTracker = new CostTracker();
//# sourceMappingURL=cost-tracker.js.map