import { LLMMessage } from '../providers/base.js';

export interface UncategorizedPattern {
    payee: string;
    count: number;
    totalAmount: number;
    sampleDates: string[];
}

export interface ExistingPattern {
    payee: string;
    category: string;
    count: number;
}

export interface RuleSuggestion {
    pattern: {
        field: 'payee' | 'imported_payee';
        operator: 'is' | 'contains';
        value: string;
    };
    action: {
        field: 'category';
        value: string;
        categoryId: string;
    };
    confidence: number;
    reasoning: string;
    affectedCount: number;
}

export function buildRuleSuggestionPrompt(
    uncategorized: UncategorizedPattern[],
    existingPatterns: ExistingPattern[],
    categories: Array<{ id: string; name: string }>
): LLMMessage[] {
    const systemPrompt = `You analyze transaction patterns and suggest categorization rules.

A good rule:
- Matches multiple transactions (not just one)
- Is specific enough to avoid false positives
- Uses "contains" for partial matches, "is" for exact matches
- Prefers "contains" with unique keywords over exact payee matches

Always respond with valid JSON array.`;

    const uncatList = uncategorized
        .map(u => `- "${u.payee}" (${u.count} transactions, $${(u.totalAmount / 100).toFixed(2)} total)`)
        .join('\n');

    const patternList = existingPatterns
        .map(p => `- "${p.payee}" → ${p.category} (${p.count} times)`)
        .join('\n');

    const categoryList = categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');

    const userPrompt = `Analyze these patterns and suggest rules:

## Uncategorized Transactions (need rules):
${uncatList || '(none)'}

## How user has categorized similar transactions:
${patternList || '(none)'}

## Available categories:
${categoryList}

Suggest up to 5 rules. Respond with ONLY JSON array:
[
  {
    "pattern": {
      "field": "payee",
      "operator": "contains",
      "value": "<match string>"
    },
    "action": {
      "field": "category",
      "value": "<category name>",
      "categoryId": "<category ID>"
    },
    "confidence": <0.0-1.0>,
    "reasoning": "<why this rule makes sense>",
    "affectedCount": <number of transactions this would categorize>
  }
]`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}

export function parseRuleSuggestionResponse(response: string): RuleSuggestion[] {
    try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(r =>
            r.pattern?.field &&
            r.pattern?.operator &&
            r.pattern?.value &&
            r.action?.categoryId
        );
    } catch {
        return [];
    }
}
