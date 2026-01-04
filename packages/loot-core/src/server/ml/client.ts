// ML Service Client for loot-core
// Connects to the ML microservice running on port 3050

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:3050';
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY;

function getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (ML_SERVICE_API_KEY) {
        headers['Authorization'] = `Bearer ${ML_SERVICE_API_KEY}`;
    }
    return headers;
}

export interface MLPrediction {
    categoryId: string;
    categoryName: string;
    confidence: number;
    reasoning: string;
}

export interface TransactionForML {
    payee: string;
    importedPayee?: string;
    amount: number;
    date: string;
    notes?: string;
}

export interface CategoryForML {
    id: string;
    name: string;
    groupName?: string;
}

export interface NormalizationResult {
    normalizedName: string;
    matchedExisting: string | null;
    confidence: number;
}

export interface ParsedTransaction {
    amount: number;
    payee: string;
    category: string | null;
    account: string | null;
    date: string;
    notes: string | null;
}

async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout = 30000
): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(id);
    }
}

export async function predictCategory(
    transaction: TransactionForML,
    categories: CategoryForML[],
    recentCorrections?: Array<{ payee: string; category: string }>
): Promise<MLPrediction | null> {
    try {
        const response = await fetchWithTimeout(`${ML_SERVICE_URL}/predict`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                transaction,
                categories,
                recentCorrections,
            }),
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.log('[ML] Daily token limit reached, skipping ML categorization');
                return null;
            }
            console.error('[ML] Prediction failed:', response.status);
            return null;
        }

        const data = await response.json();
        return data.prediction || null;
    } catch (error) {
        console.error('[ML] Service error:', error);
        return null;
    }
}

export async function predictCategoryBatch(
    transactions: TransactionForML[],
    categories: CategoryForML[],
    recentCorrections?: Array<{ payee: string; category: string }>
): Promise<Map<string, MLPrediction | null>> {
    const results = new Map<string, MLPrediction | null>();

    if (transactions.length === 0) {
        return results;
    }

    try {
        const response = await fetchWithTimeout(`${ML_SERVICE_URL}/predict/batch`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                transactions,
                categories,
                recentCorrections,
            }),
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.log('[ML] Daily token limit reached');
            }
            return results;
        }

        const data = await response.json();

        if (data.results) {
            for (const r of data.results) {
                results.set(r.payee, r.prediction || null);
            }
        }
    } catch (error) {
        console.error('[ML] Batch prediction error:', error);
    }

    return results;
}

export async function normalizePayee(
    rawPayee: string,
    existingPayees: string[]
): Promise<NormalizationResult | null> {
    try {
        const response = await fetchWithTimeout(`${ML_SERVICE_URL}/normalize-payee`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ rawPayee, existingPayees }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.result || null;
    } catch (error) {
        console.error('[ML] Payee normalization error:', error);
        return null;
    }
}

export async function parseNaturalLanguage(
    input: string,
    accounts: string[],
    categories: string[]
): Promise<ParsedTransaction | null> {
    try {
        const response = await fetchWithTimeout(`${ML_SERVICE_URL}/parse-natural-language`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ input, accounts, categories }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.result || null;
    } catch (error) {
        console.error('[ML] NL parsing error:', error);
        return null;
    }
}

export async function recordCorrection(
    transactionId: string,
    payee: string,
    predictedCategory: string,
    actualCategory: string
): Promise<void> {
    try {
        await fetchWithTimeout(`${ML_SERVICE_URL}/feedback`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                transactionId,
                payee,
                predictedCategory,
                actualCategory,
            }),
        });
    } catch (error) {
        console.error('[ML] Failed to record correction:', error);
    }
}

export async function isMLServiceAvailable(): Promise<boolean> {
    try {
        const response = await fetchWithTimeout(`${ML_SERVICE_URL}/health`, {
            method: 'GET',
        }, 5000);

        if (response.ok) {
            const data = await response.json();
            return data.status === 'ok' && !data.usage?.atLimit;
        }
        return false;
    } catch {
        return false;
    }
}
