# Actual Plus

> 🚀 AI-powered extensions for [Actual Budget](https://actualbudget.org)

**Actual Plus** enhances the local-first, privacy-focused Actual Budget with ML-powered auto-categorization, advanced reports, automatic bank syncing, and Claude Desktop integration.

## Features

### 🤖 ML Auto-Categorization

- Automatically categorize new transactions using Claude/OpenAI
- Learns from your corrections over time
- Batch processing for cost efficiency ($25/month budget target)
- Daily token limits with usage tracking

### 📊 Enhanced Reports

- **Spending Trend** - Monthly spending with rolling average
- **Category Breakdown** - Visual spending by category
- **Cash Flow Forecast** - 30-day balance projection
- **Subscription Tracker** - Auto-detect recurring payments
- **Spending Velocity** - Weekly spending alerts

### 🏦 Automatic Bank Sync

- Scheduled syncing with cron expressions
- Exponential backoff retry logic
- Per-account schedule management

### 🤖 Claude Desktop Integration (MCP)

- Natural language queries: "What's my balance?"
- Voice-style transactions: "Add $50 at Chipotle"
- Budget insights on demand

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/youruser/actual-plus.git
cd actual-plus
yarn install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with:
# - ANTHROPIC_API_KEY (required)
# - ML_SERVICE_API_KEY (generate a secure random string for production)
```

### 3. Start Development

```bash
# Start everything
yarn start

# Or individual services
yarn start:server      # Actual sync server on :5006
cd packages/ml-service && yarn dev  # ML service on :3050
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Actual Plus                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │   Desktop   │   │  ML Service │   │ MCP Server  │        │
│  │   Client    │   │   (:3050)   │   │  (Claude)   │        │
│  │   (:3001)   │   │             │   │             │        │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘        │
│         │                 │                 │                │
│         └────────┬────────┴────────┬────────┘                │
│                  │                 │                         │
│         ┌────────▼────────┐  ┌─────▼─────┐                  │
│         │   loot-core     │  │   Actual  │                  │
│         │   (ML hooks)    │  │    API    │                  │
│         └────────┬────────┘  └─────┬─────┘                  │
│                  │                 │                         │
│         ┌────────▼─────────────────▼────────┐               │
│         │          Sync Server (:5006)       │               │
│         │  + Scheduler (auto bank sync)      │               │
│         └───────────────────────────────────┘               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `ML_SERVICE_API_KEY` | API key for ML service auth | Required in production |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3001` |
| `ML_DAILY_TOKEN_LIMIT` | Max tokens per day | `50000` |
| `ML_SERVICE_PORT` | ML service port | `3050` |
| `ML_CONFIDENCE_THRESHOLD` | Min confidence for auto-categorize | `0.7` |

[Full configuration →](.env.example)

---

## Security

### Authentication

ML service endpoints (except `/health`) require Bearer token authentication:

```bash
curl -H "Authorization: Bearer $ML_SERVICE_API_KEY" http://localhost:3050/predict
```

### CORS

Configure allowed origins via `CORS_ORIGINS` environment variable. In production, set this to your actual domain.

### See Also

- Full security audit: See `security_audit.md` in project artifacts

---

## API Endpoints

### ML Service (`:3050`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with usage stats |
| `/usage` | GET | Detailed token usage |
| `/predict` | POST | Categorize single transaction |
| `/predict/batch` | POST | Categorize up to 10 transactions |
| `/normalize-payee` | POST | Clean bank payee names |
| `/parse-natural-language` | POST | Parse "50 chipotle yesterday" |
| `/suggest-rules` | POST | AI-suggested categorization rules |
| `/feedback` | POST | Record user corrections |

### Scheduler API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/schedules` | GET | List sync schedules |
| `/api/schedules` | POST | Create new schedule |
| `/api/schedules/:id/sync` | POST | Trigger manual sync |

---

## Database Migrations

Actual Plus adds these tables (using `9XXX` prefix to avoid upstream conflicts):

- `ml_predictions` - Stores ML categorization predictions
- `ml_corrections` - Tracks user corrections for learning
- `sync_schedules` - Automatic bank sync schedules
- `token_usage` - LLM API cost tracking

---

## Production Deployment

```bash
# Build and start with Docker
docker-compose -f docker-compose.prod.yml up -d
```

---

## Claude Desktop Setup

See [packages/mcp-server/CLAUDE_DESKTOP.md](packages/mcp-server/CLAUDE_DESKTOP.md) for configuration instructions.

---

## Development

```bash
# Run tests
yarn test

# Lint
yarn lint

# Type check
yarn typecheck
```

---

## License

MIT - Built on top of [Actual Budget](https://github.com/actualbudget/actual)
