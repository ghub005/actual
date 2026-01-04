// Database helpers for ML tables
import * as db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

// Types for ML tables
export interface MLPredictionRecord {
    id: string;
    transaction_id: string;
    predicted_category_id: string;
    confidence: number;
    model?: string;
    reasoning?: string;
    tokens_used?: number;
    created_at?: string;
}

export interface MLCorrectionRecord {
    id: string;
    transaction_id: string;
    original_payee?: string;
    amount?: number;
    predicted_category_id: string;
    predicted_category_name?: string;
    actual_category_id: string;
    actual_category_name?: string;
    created_at?: string;
}

// ML Predictions

export async function insertMLPrediction(prediction: Omit<MLPredictionRecord, 'id' | 'created_at'>): Promise<string> {
    const id = uuidv4();
    await db.insertWithUUID('ml_predictions', {
        id,
        ...prediction,
    });
    return id;
}

export async function getMLPrediction(transactionId: string): Promise<MLPredictionRecord | null> {
    const result = await db.first<MLPredictionRecord>(
        'SELECT * FROM ml_predictions WHERE transaction_id = ?',
        [transactionId]
    );
    return result || null;
}

export async function hasMLPrediction(transactionId: string): Promise<boolean> {
    const result = await db.first<{ count: number }>(
        'SELECT COUNT(*) as count FROM ml_predictions WHERE transaction_id = ?',
        [transactionId]
    );
    return (result?.count || 0) > 0;
}

// ML Corrections

export async function insertMLCorrection(correction: Omit<MLCorrectionRecord, 'id' | 'created_at'>): Promise<string> {
    const id = uuidv4();
    await db.insertWithUUID('ml_corrections', {
        id,
        ...correction,
    });
    return id;
}

export async function getRecentCorrections(limit = 20): Promise<Array<{ payee: string; category: string }>> {
    const results = await db.all<MLCorrectionRecord>(
        `SELECT original_payee, actual_category_name 
     FROM ml_corrections 
     ORDER BY created_at DESC 
     LIMIT ?`,
        [limit]
    );

    return results
        .filter(r => r.original_payee && r.actual_category_name)
        .map(r => ({
            payee: r.original_payee!,
            category: r.actual_category_name!,
        }));
}

export async function getCorrectionStats(): Promise<{ total: number; today: number }> {
    const today = new Date().toISOString().split('T')[0];

    const total = await db.first<{ count: number }>(
        'SELECT COUNT(*) as count FROM ml_corrections'
    );

    const todayCount = await db.first<{ count: number }>(
        'SELECT COUNT(*) as count FROM ml_corrections WHERE date(created_at) = ?',
        [today]
    );

    return {
        total: total?.count || 0,
        today: todayCount?.count || 0,
    };
}

// Token Usage (local tracking, complements ML service tracking)

export async function recordTokenUsage(
    feature: string,
    inputTokens: number,
    outputTokens: number
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Upsert - increment if exists, insert if not
    await db.runQuery(`
    INSERT INTO token_usage (id, date, feature, input_tokens, output_tokens, request_count)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(date, feature) DO UPDATE SET
      input_tokens = input_tokens + excluded.input_tokens,
      output_tokens = output_tokens + excluded.output_tokens,
      request_count = request_count + 1
  `, [uuidv4(), today, feature, inputTokens, outputTokens]);
}

export async function getTokenUsageToday(): Promise<{ inputTokens: number; outputTokens: number; requests: number }> {
    const today = new Date().toISOString().split('T')[0];

    const result = await db.first<{
        input_sum: number;
        output_sum: number;
        request_sum: number;
    }>(`
    SELECT 
      COALESCE(SUM(input_tokens), 0) as input_sum,
      COALESCE(SUM(output_tokens), 0) as output_sum,
      COALESCE(SUM(request_count), 0) as request_sum
    FROM token_usage 
    WHERE date = ?
  `, [today]);

    return {
        inputTokens: result?.input_sum || 0,
        outputTokens: result?.output_sum || 0,
        requests: result?.request_sum || 0,
    };
}
