// MCP Tool definitions for Actual Budget
import { z } from 'zod';

// Tool parameter schemas
export const getBalanceSchema = z.object({
    accountName: z.string().optional().describe('Account name to get balance for, or omit for total balance'),
});

export const addTransactionSchema = z.object({
    account: z.string().describe('Account name or ID'),
    amount: z.number().describe('Amount in dollars (negative for expenses, positive for income)'),
    payee: z.string().describe('Payee/merchant name'),
    category: z.string().optional().describe('Category name'),
    date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
    notes: z.string().optional().describe('Optional notes'),
});

export const getTransactionsSchema = z.object({
    account: z.string().optional().describe('Account name to filter by'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().default(20).describe('Maximum transactions to return'),
});

export const getBudgetSchema = z.object({
    month: z.string().optional().describe('Month in YYYY-MM format, defaults to current month'),
});

export const getCategoriesSchema = z.object({});

// Tool definitions for MCP
export const toolDefinitions = [
    {
        name: 'get_balance',
        description: 'Get the current balance of an account or total balance across all on-budget accounts',
        inputSchema: {
            type: 'object' as const,
            properties: {
                accountName: {
                    type: 'string',
                    description: 'Account name to get balance for. Omit to get total balance.',
                },
            },
        },
    },
    {
        name: 'add_transaction',
        description: 'Add a new transaction to Actual Budget',
        inputSchema: {
            type: 'object' as const,
            properties: {
                account: {
                    type: 'string',
                    description: 'Account name (e.g., "Checking", "Credit Card")',
                },
                amount: {
                    type: 'number',
                    description: 'Amount in dollars. Negative for expenses, positive for income. Example: -25.50 for a $25.50 expense',
                },
                payee: {
                    type: 'string',
                    description: 'Merchant or payee name',
                },
                category: {
                    type: 'string',
                    description: 'Budget category name (optional)',
                },
                date: {
                    type: 'string',
                    description: 'Date in YYYY-MM-DD format. Defaults to today.',
                },
                notes: {
                    type: 'string',
                    description: 'Optional notes for the transaction',
                },
            },
            required: ['account', 'amount', 'payee'],
        },
    },
    {
        name: 'get_transactions',
        description: 'Get recent transactions, optionally filtered by account and date range',
        inputSchema: {
            type: 'object' as const,
            properties: {
                account: {
                    type: 'string',
                    description: 'Account name to filter by (optional)',
                },
                startDate: {
                    type: 'string',
                    description: 'Start date in YYYY-MM-DD format',
                },
                endDate: {
                    type: 'string',
                    description: 'End date in YYYY-MM-DD format',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of transactions to return (default: 20)',
                },
            },
        },
    },
    {
        name: 'get_budget',
        description: 'Get the budget status for a month, showing budgeted vs spent amounts by category',
        inputSchema: {
            type: 'object' as const,
            properties: {
                month: {
                    type: 'string',
                    description: 'Month in YYYY-MM format. Defaults to current month.',
                },
            },
        },
    },
    {
        name: 'get_categories',
        description: 'List all budget categories and category groups',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
];

export type ToolName = typeof toolDefinitions[number]['name'];
