# Claude Desktop MCP Configuration

Add this to your Claude Desktop configuration file:

## macOS

`~/Library/Application Support/Claude/claude_desktop_config.json`

## Windows

`%APPDATA%\Claude\claude_desktop_config.json`

## Linux

`~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "actual-budget": {
      "command": "node",
      "args": ["/path/to/actual-plus-repo/packages/mcp-server/dist/index.js"],
      "env": {
        "ACTUAL_SERVER_URL": "http://localhost:5006",
        "ACTUAL_PASSWORD": "your-password-here",
        "ACTUAL_BUDGET_ID": "your-budget-sync-id",
        "ACTUAL_DATA_DIR": "/tmp/actual-mcp"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACTUAL_SERVER_URL` | URL of your Actual sync server | `http://localhost:5006` |
| `ACTUAL_PASSWORD` | Password for the Actual server | Required |
| `ACTUAL_BUDGET_ID` | Sync ID of the budget to use | Required |
| `ACTUAL_DATA_DIR` | Directory for local data cache | `/tmp/actual-mcp` |

## Available Tools

Once configured, you can ask Claude to:

- **Check balances**: "What's my checking account balance?"
- **Add transactions**: "Add a $25 expense at Starbucks from my credit card"
- **View transactions**: "Show me my last 10 transactions"
- **Check budget**: "How's my dining budget looking this month?"
- **List categories**: "What budget categories do I have?"

## Setup Steps

1. Build the MCP server:

   ```bash
   cd packages/mcp-server
   yarn install
   yarn build
   ```

2. Add the configuration to Claude Desktop

3. Restart Claude Desktop

4. Test by asking: "Can you check my Actual Budget balance?"
