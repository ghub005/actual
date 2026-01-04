import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

interface TokenUsage {
    date: string;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    features: Record<string, { input: number; output: number; count: number }>;
}

interface UsageRecord {
    [date: string]: TokenUsage;
}

const USAGE_FILE = path.join(process.cwd(), 'token-usage.json');

class CostTracker {
    private usage: UsageRecord = {};
    private todayKey: string = '';

    constructor() {
        this.loadUsage();
        this.todayKey = this.getDateKey();
    }

    private getDateKey(): string {
        return new Date().toISOString().split('T')[0];
    }

    private loadUsage(): void {
        try {
            if (fs.existsSync(USAGE_FILE)) {
                const data = fs.readFileSync(USAGE_FILE, 'utf-8');
                this.usage = JSON.parse(data);
            }
        } catch {
            console.warn('Could not load token usage file, starting fresh');
            this.usage = {};
        }
    }

    private saveUsage(): void {
        try {
            fs.writeFileSync(USAGE_FILE, JSON.stringify(this.usage, null, 2));
        } catch (err) {
            console.error('Failed to save token usage:', err);
        }
    }

    private ensureToday(): TokenUsage {
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

    recordUsage(feature: string, inputTokens: number, outputTokens: number): void {
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

    getTodayUsage(): TokenUsage {
        return this.ensureToday();
    }

    getTotalTokensToday(): number {
        const today = this.ensureToday();
        return today.inputTokens + today.outputTokens;
    }

    isAtLimit(): boolean {
        return this.getTotalTokensToday() >= config.dailyTokenLimit;
    }

    getRemainingTokens(): number {
        return Math.max(0, config.dailyTokenLimit - this.getTotalTokensToday());
    }

    getUsagePercentage(): number {
        return (this.getTotalTokensToday() / config.dailyTokenLimit) * 100;
    }

    isNearLimit(threshold = 0.8): boolean {
        return this.getUsagePercentage() >= threshold * 100;
    }

    getMonthlyStats(): { totalTokens: number; totalRequests: number; days: number } {
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

    estimateCost(inputTokens: number, outputTokens: number): number {
        // Claude Sonnet pricing (approximate): $3/1M input, $15/1M output
        const inputCost = (inputTokens / 1_000_000) * 3;
        const outputCost = (outputTokens / 1_000_000) * 15;
        return inputCost + outputCost;
    }

    getTodayCost(): number {
        const today = this.ensureToday();
        return this.estimateCost(today.inputTokens, today.outputTokens);
    }

    getMonthlyCost(): number {
        const stats = this.getMonthlyStats();
        // Rough estimate assuming 70% input, 30% output ratio
        const inputEstimate = stats.totalTokens * 0.7;
        const outputEstimate = stats.totalTokens * 0.3;
        return this.estimateCost(inputEstimate, outputEstimate);
    }
}

export const costTracker = new CostTracker();
