import { Router } from 'express';
import { z } from 'zod';
export const feedbackRouter = Router();
// In-memory store; in production this would call back to Actual's DB
const corrections = [];
const feedbackSchema = z.object({
    transactionId: z.string(),
    payee: z.string(),
    predictedCategory: z.string(),
    actualCategory: z.string(),
});
feedbackRouter.post('/feedback', (req, res) => {
    try {
        const body = feedbackSchema.parse(req.body);
        corrections.push({
            ...body,
            timestamp: new Date().toISOString(),
        });
        // Keep only last 1000 corrections in memory
        if (corrections.length > 1000) {
            corrections.shift();
        }
        res.json({ success: true, totalCorrections: corrections.length });
    }
    catch (err) {
        res.status(400).json({ error: String(err) });
    }
});
feedbackRouter.get('/feedback/recent', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const recent = corrections.slice(-limit).reverse();
    res.json({ corrections: recent });
});
// Export for use in prediction prompts
export function getRecentCorrections(limit = 20) {
    return corrections.slice(-limit).map(c => ({
        payee: c.payee,
        category: c.actualCategory,
    }));
}
//# sourceMappingURL=feedback.js.map