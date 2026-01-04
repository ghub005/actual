// Configuration for MCP Server

export interface MCPConfig {
    actualServerUrl: string;
    actualPassword?: string;
    actualBudgetId?: string;
    dataDir: string;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

export const config: MCPConfig = {
    actualServerUrl: getEnvOrDefault('ACTUAL_SERVER_URL', 'http://localhost:5006'),
    actualPassword: process.env.ACTUAL_PASSWORD,
    actualBudgetId: process.env.ACTUAL_BUDGET_ID,
    dataDir: getEnvOrDefault('ACTUAL_DATA_DIR', '/tmp/actual-mcp'),
};

export function validateConfig(): void {
    if (!config.actualPassword) {
        console.warn('[MCP] Warning: ACTUAL_PASSWORD not set');
    }
    if (!config.actualBudgetId) {
        console.warn('[MCP] Warning: ACTUAL_BUDGET_ID not set - will need to specify budget');
    }
}
