// ML Categorizer - hooks into transaction import pipeline
import {
    predictCategoryBatch,
    isMLServiceAvailable,
    type TransactionForML,
    type CategoryForML,
    type MLPrediction
} from './client.js';
import { insertMLPrediction, getRecentCorrections } from './db.js';
import * as db from '../db/index.js';

export interface TransactionToProcess {
    id: string;
    payee?: string;
    payee_name?: string;
    imported_payee?: string;
    amount: number;
    date: string;
    notes?: string;
    category?: string | null;
}

interface CategorizationResult {
    processed: number;
    categorized: number;
    skipped: number;
}

// Get categories formatted for ML
async function getCategoriesForML(): Promise<CategoryForML[]> {
    const categories = await db.all<{
        id: string;
        name: string;
        group_name?: string;
    }>(`
    SELECT c.id, c.name, cg.name as group_name
    FROM categories c
    LEFT JOIN category_groups cg ON c.cat_group = cg.id
    WHERE c.tombstone = 0 AND c.hidden = 0
  `);

    return categories.map(c => ({
        id: c.id,
        name: c.name,
        groupName: c.group_name,
    }));
}

// Main function to apply ML categorization to transactions
export async function applyMLCategorization(
    transactions: TransactionToProcess[]
): Promise<CategorizationResult> {
    const result: CategorizationResult = {
        processed: 0,
        categorized: 0,
        skipped: 0,
    };

    // Filter to only uncategorized transactions
    const uncategorized = transactions.filter(t => !t.category);

    if (uncategorized.length === 0) {
        return result;
    }

    // Check if ML service is available
    const available = await isMLServiceAvailable();
    if (!available) {
        console.log('[ML] Service not available, skipping ML categorization');
        result.skipped = uncategorized.length;
        return result;
    }

    // Get categories and recent corrections
    const [categories, recentCorrections] = await Promise.all([
        getCategoriesForML(),
        getRecentCorrections(20),
    ]);

    if (categories.length === 0) {
        console.log('[ML] No categories available, skipping');
        result.skipped = uncategorized.length;
        return result;
    }

    // Process in batches of 10
    const batchSize = 10;

    for (let i = 0; i < uncategorized.length; i += batchSize) {
        const batch = uncategorized.slice(i, i + batchSize);

        const txnsForML: TransactionForML[] = batch.map(t => ({
            payee: t.payee_name || t.imported_payee || '',
            importedPayee: t.imported_payee,
            amount: t.amount,
            date: t.date,
            notes: t.notes,
        }));

        // Call ML service
        const predictions = await predictCategoryBatch(txnsForML, categories, recentCorrections);

        result.processed += batch.length;

        // Apply predictions
        for (const txn of batch) {
            const payeeKey = txn.payee_name || txn.imported_payee || '';
            const prediction = predictions.get(payeeKey);

            if (prediction) {
                // Update the transaction object (caller should persist)
                txn.category = prediction.categoryId;

                // Add ML tag to notes
                txn.notes = txn.notes
                    ? `${txn.notes} #ml-auto`
                    : '#ml-auto';

                // Store prediction for feedback loop
                try {
                    await insertMLPrediction({
                        transaction_id: txn.id,
                        predicted_category_id: prediction.categoryId,
                        confidence: prediction.confidence,
                        model: 'claude',  // From ML service
                        reasoning: prediction.reasoning,
                    });
                } catch (err) {
                    console.error('[ML] Failed to store prediction:', err);
                }

                result.categorized++;
            } else {
                result.skipped++;
            }
        }
    }

    console.log(`[ML] Categorization complete: ${result.categorized}/${result.processed} categorized, ${result.skipped} skipped`);

    return result;
}

// Export for use in transaction update hooks
export { getRecentCorrections };
