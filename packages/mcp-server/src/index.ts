#!/usr/bin/env node
// MCP Server for Actual Budget - Claude Desktop Integration

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { validateConfig } from './config.js';
import { toolDefinitions, handleTool } from './tools/index.js';
import { shutdownActual } from './actual-api.js';

// Validate config on startup
validateConfig();

// Create MCP server
const server = new Server(
    {
        name: 'actual-budget',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: toolDefinitions,
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        const result = await handleTool(name, args || {});

        return {
            content: [
                {
                    type: 'text',
                    text: result,
                },
            ],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
});

// Clean shutdown
async function cleanup() {
    console.error('[MCP] Shutting down...');
    await shutdownActual();
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] Actual Budget MCP Server running');
}

main().catch((error) => {
    console.error('[MCP] Fatal error:', error);
    process.exit(1);
});
