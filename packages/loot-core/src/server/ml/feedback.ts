// ML Feedback Detection - detects when users correct ML predictions
import { getMLPrediction, insertMLCorrection } from './db.js';
import { recordCorrection } from './client.js';
import * as db from '../db/index.js';

interface TransactionUpdate {
    id: string;
    category?: string;
}

interface TransactionData {
    id: string;
    category?: string | null;
    payee_name?: string;
    imported_payee?: string;
    amount?: number;
    notes?: string;
}

// Called when a transaction is updated
// Checks if it was an ML-predicted transaction and category was changed
export async function detectAndRecordCorrection(
    transactionId: string,
    updates: Partial<TransactionUpdate>
): Promise<boolean> {
    // Only process if category was changed
    if (!updates.category) {
        return false;
    }

    // Check if we have an ML prediction for this transaction
    const prediction = await getMLPrediction(transactionId);

    if (!prediction) {
        return false;
    }

    // Check if the new category is different from prediction
    if (prediction.predicted_category_id === updates.category) {
        return false;
    }

    // Get transaction details
    const txn = await db.first<TransactionData>(
        'SELECT id, payee_name, imported_payee, amount, notes FROM v_transactions WHERE id = ?',
        [transactionId]
    );

    if (!txn) {
        return false;
    }

    // Get category names for logging
    const [predictedCat, actualCat] = await Promise.all([
        db.first<{ name: string }>('SELECT name FROM categories WHERE id = ?', [prediction.predicted_category_id]),
        db.first<{ name: string }>('SELECT name FROM categories WHERE id = ?', [updates.category]),
    ]);

    const payee = txn.payee_name || txn.imported_payee || '';

    console.log(`[ML] Correction detected: "${payee}" changed from "${predictedCat?.name}" to "${actualCat?.name}"`);

    // Store in local DB
    try {
        await insertMLCorrection({
            transaction_id: transactionId,
            original_payee: payee,
            amount: txn.amount,
            predicted_category_id: prediction.predicted_category_id,
            predicted_category_name: predictedCat?.name,
            actual_category_id: updates.category,
            actual_category_name: actualCat?.name,
        });
    } catch (err) {
        console.error('[ML] Failed to store correction locally:', err);
    }

    // Send to ML service for learning
    try {
        await recordCorrection(
            transactionId,
            payee,
            prediction.predicted_category_id,
            updates.category
        );
    } catch (err) {
        console.error('[ML] Failed to send correction to ML service:', err);
    }

    return true;
}

// Check if a transaction was ML-categorized (has #ml-auto tag)
export function isMLCategorized(notes?: string | null): boolean {
    return notes?.includes('#ml-auto') ?? false;
}
