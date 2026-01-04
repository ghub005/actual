import express from 'express';
import { config, validateConfig } from './config.js';
import {
    healthRouter,
    predictRouter,
    normalizePayeeRouter,
    parseNLRouter,
    suggestRulesRouter,
    feedbackRouter
} from './routes/index.js';

// Validate configuration on startup
try {
    validateConfig();
} catch (err) {
    console.error('Configuration error:', err);
    console.error('Please set required environment variables and restart.');
    process.exit(1);
}

const app = express();

app.use(express.json({ limit: '1mb' }));

// Authentication middleware
const API_KEY = process.env.ML_SERVICE_API_KEY;

app.use((req, res, next) => {
    // Allow health checks without auth
    if (req.path === '/health' || req.method === 'OPTIONS') {
        return next();
    }

    // In development, auth is optional
    if (!API_KEY) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${API_KEY}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
});

// CORS - configurable origins
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',');

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // Allow requests without origin (same-origin, curl, etc.)
        res.header('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// Routes
app.use(healthRouter);
app.use(predictRouter);
app.use(normalizePayeeRouter);
app.use(parseNLRouter);
app.use(suggestRulesRouter);
app.use(feedbackRouter);

// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Actual Plus ML Service');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Port:          ${config.port}`);
    console.log(`  Provider:      ${config.primaryProvider}`);
    console.log(`  Model:         ${config.primaryProvider === 'claude' ? config.anthropicModel : config.openaiModel}`);
    console.log(`  Confidence:    ${config.confidenceThreshold}`);
    console.log(`  Daily Limit:   ${config.dailyTokenLimit.toLocaleString()} tokens`);
    console.log(`  Batch Size:    ${config.batchSize}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health                 - Health check + usage stats');
    console.log('  GET  /usage                  - Detailed token usage');
    console.log('  POST /predict                - Categorize single transaction');
    console.log('  POST /predict/batch          - Categorize up to 10 transactions');
    console.log('  POST /normalize-payee        - Clean bank payee names');
    console.log('  POST /parse-natural-language - Parse "50 chipotle yesterday"');
    console.log('  POST /suggest-rules          - Suggest categorization rules');
    console.log('  POST /feedback               - Record user corrections');
    console.log('');
});
