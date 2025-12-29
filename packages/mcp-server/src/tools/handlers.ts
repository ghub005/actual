// MCP Tool Handlers - Implementation of each tool
import * as actualApi from '../actual-api.js';
import {
    getBalanceSchema,
    addTransactionSchema,
    getTransactionsSchema,
    getBudgetSchema,
} from './definitions.js';

// Format amount from cents to dollars
function formatAmount(cents: number): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Math.abs(dollars));
}

// Get current date in YYYY-MM-DD format
function getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
}

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

export async function handleGetBalance(args: unknown): Promise<string> {
    const parsed = getBalanceSchema.parse(args);

    try {
        const accounts = await actualApi.getAccounts();

        if (parsed.accountName) {
            // Find specific account
            const account = accounts.find(
                (a: { name: string }) =>
                    a.name.toLowerCase() === parsed.accountName!.toLowerCase()
            );

            if (!account) {
                return `Account "${parsed.accountName}" not found. Available accounts: ${accounts.map((a: { name: string }) => a.name).join(', ')
                    }`;
            }

            return `${account.name}: ${formatAmount(account.balance)}`;
        }

        // Total balance
        const onBudget = accounts.filter((a: { offbudget: number }) => !a.offbudget);
        const total = onBudget.reduce((sum: number, a: { balance: number }) => sum + a.balance, 0);

        let response = `Total Balance: ${formatAmount(total)}\n\nBreakdown:\n`;
        for (const account of onBudget) {
            response += `  ${account.name}: ${formatAmount(account.balance)}\n`;
        }

        return response;
    } catch (error) {
        return `Error getting balance: ${error}`;
    }
}

export async function handleAddTransaction(args: unknown): Promise<string> {
    const parsed = addTransactionSchema.parse(args);

    try {
        const accounts = await actualApi.getAccounts();
        const account = accounts.find(
            (a: { name: string }) =>
                a.name.toLowerCase() === parsed.account.toLowerCase()
        );

        if (!account) {
            return `Account "${parsed.account}" not found. Available: ${accounts.map((a: { name: string }) => a.name).join(', ')
                }`;
        }

        // Convert dollars to cents
        const amountCents = Math.round(parsed.amount * 100);

        // Find category if specified
        let categoryId: string | undefined;
        if (parsed.category) {
            const categories = await actualApi.getCategories();
            const category = categories.find(
                (c: { name: string }) =>
                    c.name.toLowerCase() === parsed.category!.toLowerCase()
            );
            categoryId = category?.id;
        }

        await actualApi.addTransaction({
            account: account.id,
            date: parsed.date || getCurrentDate(),
            amount: amountCents,
            payee_name: parsed.payee,
            category: categoryId,
            notes: parsed.notes,
        });

        const type = parsed.amount < 0 ? 'expense' : 'income';
        return `Added ${type} of ${formatAmount(amountCents)} at "${parsed.payee}" to ${account.name}`;
    } catch (error) {
        return `Error adding transaction: ${error}`;
    }
}

export async function handleGetTransactions(args: unknown): Promise<string> {
    const parsed = getTransactionsSchema.parse(args);

    try {
        const accounts = await actualApi.getAccounts();
        let accountId: string | undefined;

        if (parsed.account) {
            const account = accounts.find(
                (a: { name: string }) =>
                    a.name.toLowerCase() === parsed.account!.toLowerCase()
            );
            if (!account) {
                return `Account "${parsed.account}" not found`;
            }
            accountId = account.id;
        }

        // Get transactions for all accounts if no specific one given
        const targetAccounts = accountId
            ? [{ id: accountId }]
            : accounts.filter((a: { offbudget: number }) => !a.offbudget);

        let allTransactions: Array<{
            date: string;
            payee_name: string;
            amount: number;
            category_name: string;
            account_name: string;
        }> = [];

        for (const acc of targetAccounts) {
            const txns = await actualApi.getTransactions(
                acc.id,
                parsed.startDate,
                parsed.endDate
            );
            allTransactions = allTransactions.concat(
                txns.map((t: { date: string; payee_name: string; amount: number; category_name: string }) => ({
                    ...t,
                    account_name: accounts.find((a: { id: string }) => a.id === acc.id)?.name,
                }))
            );
        }

        // Sort by date descending
        allTransactions.sort((a, b) => b.date.localeCompare(a.date));

        // Limit
        const limited = allTransactions.slice(0, parsed.limit || 20);

        if (limited.length === 0) {
            return 'No transactions found for the given criteria';
        }

        let response = `Recent Transactions (${limited.length}):\n\n`;
        for (const txn of limited) {
            const type = txn.amount < 0 ? '↓' : '↑';
            response += `${txn.date} ${type} ${formatAmount(txn.amount)} - ${txn.payee_name}\n`;
            response += `    ${txn.category_name || 'Uncategorized'} (${txn.account_name})\n`;
        }

        return response;
    } catch (error) {
        return `Error getting transactions: ${error}`;
    }
}

export async function handleGetBudget(args: unknown): Promise<string> {
    const parsed = getBudgetSchema.parse(args);

    try {
        const month = parsed.month || getCurrentMonth();
        const budget = await actualApi.getBudgetMonth(month);

        let response = `Budget for ${month}:\n\n`;

        for (const group of budget.categoryGroups || []) {
            response += `${group.name}:\n`;

            for (const category of group.categories || []) {
                const budgeted = formatAmount(category.budgeted || 0);
                const spent = formatAmount(category.spent || 0);
                const balance = formatAmount(category.balance || 0);

                response += `  ${category.name}\n`;
                response += `    Budgeted: ${budgeted} | Spent: ${spent} | Balance: ${balance}\n`;
            }
            response += '\n';
        }

        return response;
    } catch (error) {
        return `Error getting budget: ${error}`;
    }
}

export async function handleGetCategories(_args: unknown): Promise<string> {
    try {
        const groups = await actualApi.getCategoryGroups();
        const categories = await actualApi.getCategories();

        let response = 'Budget Categories:\n\n';

        for (const group of groups) {
            response += `${group.name}:\n`;

            const groupCategories = categories.filter(
                (c: { group: string }) => c.group === group.id
            );

            for (const cat of groupCategories) {
                response += `  - ${cat.name}\n`;
            }
            response += '\n';
        }

        return response;
    } catch (error) {
        return `Error getting categories: ${error}`;
    }
}

// Main handler dispatcher
export async function handleTool(name: string, args: unknown): Promise<string> {
    switch (name) {
        case 'get_balance':
            return handleGetBalance(args);
        case 'add_transaction':
            return handleAddTransaction(args);
        case 'get_transactions':
            return handleGetTransactions(args);
        case 'get_budget':
            return handleGetBudget(args);
        case 'get_categories':
            return handleGetCategories(args);
        default:
            return `Unknown tool: ${name}`;
    }
}
