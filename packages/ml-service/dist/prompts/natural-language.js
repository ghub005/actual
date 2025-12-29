export function buildNaturalLanguagePrompt(input, accounts, categories, today) {
    const systemPrompt = `You parse natural language into structured transaction data.

Examples:
- "$45.50 at Chipotle yesterday for lunch" → expense at restaurant
- "Got paid $3000 today" → income
- "$12 coffee this morning" → small expense today
- "Transferred $500 to savings" → transfer between accounts
- "Spent fifty bucks at Target" → $50 expense

Interpret dates relative to today: ${today}
- "yesterday" = day before today
- "last friday" = most recent Friday before today
- "this morning" = today

Always respond with valid JSON. Convert dollar amounts to cents (e.g., $45.50 → -4550 for expense).`;
    const userPrompt = `Parse this into a transaction:
"${input}"

Available accounts: ${accounts.join(', ') || '(none provided)'}
Available categories: ${categories.join(', ') || '(none provided)'}
Today's date: ${today}

Respond with ONLY JSON:
{
  "amount": <number in cents, negative for expenses, positive for income>,
  "payee": "<merchant/payee name>",
  "category": "<best matching category or null>",
  "account": "<best matching account or null>",
  "date": "<YYYY-MM-DD>",
  "notes": "<any additional context or null>"
}`;
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}
export function parseNaturalLanguageResponse(response) {
    try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.amount !== 'number' || !parsed.payee || !parsed.date) {
            return null;
        }
        return {
            amount: parsed.amount,
            payee: parsed.payee,
            category: parsed.category || null,
            account: parsed.account || null,
            date: parsed.date,
            notes: parsed.notes || null,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=natural-language.js.map