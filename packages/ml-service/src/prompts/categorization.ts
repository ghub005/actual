import { LLMMessage } from '../providers/base.js';

export interface Category {
    id: string;
    name: string;
    groupName?: string;
}

export interface TransactionInput {
    payee: string;
    importedPayee?: string;
    amount: number;  // In cents, negative for expenses
    date: string;
    notes?: string;
}

export interface CategorizationResult {
    categoryId: string;
    categoryName: string;
    confidence: number;
    reasoning: string;
}

export interface BatchCategorizationResult {
    results: Array<{
        payee: string;
        prediction: CategorizationResult | null;
        error?: string;
    }>;
}

export function buildCategorizationPrompt(
    transaction: TransactionInput,
    categories: Category[],
    recentCorrections?: Array<{ payee: string; category: string }>
): LLMMessage[] {
    const categoryList = categories
        .map(c => `- ${c.name} (ID: ${c.id})${c.groupName ? ` [Group: ${c.groupName}]` : ''}`)
        .join('\n');

    const correctionsSection = recentCorrections?.length
        ? `
## Recent User Corrections (learn from these):
${recentCorrections.slice(0, 10).map(c => `- "${c.payee}" → ${c.category}`).join('\n')}
`
        : '';

    const amountStr = Math.abs(transaction.amount / 100).toFixed(2);
    const txnType = transaction.amount < 0 ? 'Expense' : 'Income';

    const systemPrompt = `You are a financial transaction categorizer. Your job is to assign the most appropriate category to transactions based on the payee name, amount, and any available context.

Be precise and consistent. When uncertain, indicate lower confidence. Always respond with valid JSON.`;

    const userPrompt = `Categorize this transaction:

## Transaction Details
- Payee: ${transaction.payee}
${transaction.importedPayee ? `- Raw Bank Payee: ${transaction.importedPayee}` : ''}
- Amount: $${amountStr} (${txnType})
- Date: ${transaction.date}
${transaction.notes ? `- Notes: ${transaction.notes}` : ''}

## Available Categories
${categoryList}
${correctionsSection}

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "categoryId": "<selected category ID>",
  "categoryName": "<selected category name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation, 1-2 sentences>"
}`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}

export function buildBatchCategorizationPrompt(
    transactions: TransactionInput[],
    categories: Category[],
    recentCorrections?: Array<{ payee: string; category: string }>
): LLMMessage[] {
    const categoryList = categories
        .map(c => `- ${c.name} (ID: ${c.id})${c.groupName ? ` [Group: ${c.groupName}]` : ''}`)
        .join('\n');

    const correctionsSection = recentCorrections?.length
        ? `
## Recent User Corrections (learn from these):
${recentCorrections.slice(0, 10).map(c => `- "${c.payee}" → ${c.category}`).join('\n')}
`
        : '';

    const txnList = transactions.map((t, i) => {
        const amountStr = Math.abs(t.amount / 100).toFixed(2);
        const txnType = t.amount < 0 ? 'expense' : 'income';
        return `${i + 1}. "${t.payee}" - $${amountStr} (${txnType}) on ${t.date}`;
    }).join('\n');

    const systemPrompt = `You are a financial transaction categorizer. Categorize multiple transactions at once. Be precise and consistent. Always respond with valid JSON array.`;

    const userPrompt = `Categorize these ${transactions.length} transactions:

## Transactions
${txnList}

## Available Categories
${categoryList}
${correctionsSection}

Respond with ONLY a JSON array (no markdown):
[
  {
    "payee": "<original payee from input>",
    "categoryId": "<selected category ID>",
    "categoryName": "<selected category name>",
    "confidence": <0.0-1.0>,
    "reasoning": "<brief explanation>"
  },
  ...
]`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}

export function parseCategorizationResponse(response: string): CategorizationResult | null {
    try {
        // Strip markdown code blocks if present
        const cleaned = response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        if (!parsed.categoryId || typeof parsed.confidence !== 'number') {
            return null;
        }

        return {
            categoryId: parsed.categoryId,
            categoryName: parsed.categoryName || '',
            confidence: Math.max(0, Math.min(1, parsed.confidence)),
            reasoning: parsed.reasoning || '',
        };
    } catch {
        return null;
    }
}

export function parseBatchCategorizationResponse(
    response: string,
    originalPayees: string[]
): BatchCategorizationResult {
    const results: BatchCategorizationResult['results'] = [];

    try {
        const cleaned = response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) {
            // Return null for all if parsing fails
            return {
                results: originalPayees.map(payee => ({
                    payee,
                    prediction: null,
                    error: 'Invalid response format',
                })),
            };
        }

        // Match responses to original payees
        for (const payee of originalPayees) {
            const match = parsed.find(
                (r: Record<string, unknown>) =>
                    String(r.payee).toLowerCase() === payee.toLowerCase()
            );

            if (match && match.categoryId && typeof match.confidence === 'number') {
                results.push({
                    payee,
                    prediction: {
                        categoryId: match.categoryId,
                        categoryName: match.categoryName || '',
                        confidence: Math.max(0, Math.min(1, match.confidence)),
                        reasoning: match.reasoning || '',
                    },
                });
            } else {
                results.push({
                    payee,
                    prediction: null,
                    error: match ? 'Missing required fields' : 'No match in response',
                });
            }
        }
    } catch (err) {
        // Return null for all on parse error
        return {
            results: originalPayees.map(payee => ({
                payee,
                prediction: null,
                error: 'Parse error',
            })),
        };
    }

    return { results };
}
