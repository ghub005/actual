export function buildPayeeNormalizationPrompt(rawPayee, existingPayees) {
    const payeeList = existingPayees.slice(0, 100).join('\n- ');
    const systemPrompt = `You clean up ugly bank payee names into readable merchant names.

Rules:
1. Remove transaction IDs, reference numbers, dates
2. Remove location codes (city, state abbreviations at end)
3. Remove payment processor prefixes (SQ *, TST *, PAYPAL *, etc.)
4. Capitalize properly (e.g., "STARBUCKS" → "Starbucks")
5. If an existing payee matches, use that exact spelling
6. Keep it simple - just the merchant name

Always respond with valid JSON.`;
    const userPrompt = `Clean this bank payee name:
"${rawPayee}"

Existing payees in the system (use exact match if applicable):
- ${payeeList || '(none)'}

Respond with ONLY JSON:
{
  "normalizedName": "<clean merchant name>",
  "matchedExisting": "<exact existing payee name if matched, null otherwise>",
  "confidence": <0.0-1.0>
}`;
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}
export function parseNormalizationResponse(response) {
    try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!parsed.normalizedName)
            return null;
        return {
            normalizedName: parsed.normalizedName,
            matchedExisting: parsed.matchedExisting || null,
            confidence: parsed.confidence ?? 0.8,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=payee-normalization.js.map