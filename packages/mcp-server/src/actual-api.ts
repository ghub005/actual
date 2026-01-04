// Actual API wrapper for MCP tools
import api from '@actual-app/api';
import { config } from './config.js';

let initialized = false;

export async function initializeActual(): Promise<void> {
    if (initialized) return;

    try {
        await api.init({
            dataDir: config.dataDir,
            serverURL: config.actualServerUrl,
            password: config.actualPassword,
        });

        if (config.actualBudgetId) {
            await api.downloadBudget(config.actualBudgetId);
        }

        initialized = true;
        console.log('[MCP] Actual API initialized');
    } catch (error) {
        console.error('[MCP] Failed to initialize Actual API:', error);
        throw error;
    }
}

export async function shutdownActual(): Promise<void> {
    if (initialized) {
        await api.shutdown();
        initialized = false;
    }
}

// Account operations
export async function getAccounts() {
    await initializeActual();
    return api.getAccounts();
}

export async function getAccountBalance(accountId: string) {
    await initializeActual();
    const accounts = await api.getAccounts();
    const account = accounts.find((a: { id: string }) => a.id === accountId);
    return account?.balance || 0;
}

// Transaction operations
export async function getTransactions(accountId: string, startDate?: string, endDate?: string) {
    await initializeActual();
    const transactions = await api.getTransactions(accountId, startDate, endDate);
    return transactions;
}

export async function addTransaction(transaction: {
    account: string;
    date: string;
    amount: number;
    payee_name?: string;
    category?: string;
    notes?: string;
}) {
    await initializeActual();
    const result = await api.importTransactions(transaction.account, [transaction]);
    return result;
}

// Budget operations
export async function getBudgetMonth(month: string) {
    await initializeActual();
    return api.getBudgetMonth(month);
}

export async function getCategories() {
    await initializeActual();
    return api.getCategories();
}

export async function getCategoryGroups() {
    await initializeActual();
    return api.getCategoryGroups();
}

// Utility
export async function runQuery(query: object) {
    await initializeActual();
    return api.runQuery(query);
}

export { api };
