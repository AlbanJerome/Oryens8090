import express from 'express';
import cors from 'cors';
import { interpretTransaction, type AccountInput, type InterpretTransactionContext } from './interpret.js';
import { summarizeAccountActivity, type TransactionInput } from './summarize.js';
import { analyzeLedgerHealth, type AnalyzeLedgerHealthInput } from './analyze-ledger-health.js';

const app = express();
const PORT = Number(process.env.PORT) || 8090;

app.use(cors());
app.use(express.json());

app.post('/v1/ai/summarize-account-activity', (req, res) => {
  try {
    const body = req.body as { accountCode?: string; accountName?: string; transactions?: TransactionInput[] };
    const accountCode = typeof body.accountCode === 'string' ? body.accountCode : '';
    const accountName = typeof body.accountName === 'string' ? body.accountName : undefined;
    const transactions = Array.isArray(body.transactions) ? body.transactions : [];
    const result = summarizeAccountActivity(accountCode, accountName, transactions);
    res.json(result);
  } catch (err) {
    console.error('summarize-account-activity error:', err);
    res.status(500).json({
      summary: 'Unable to generate summary.',
      error: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

app.post('/v1/ai/interpret-transaction', (req, res) => {
  try {
    const body = req.body as {
      rawInput?: string;
      accounts?: AccountInput[];
      tenantSettings?: { currencyCode?: string; locale?: string };
      metadataSchema?: { fields?: string[] };
    };
    const rawInput = typeof body.rawInput === 'string' ? body.rawInput : '';
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const context: InterpretTransactionContext | undefined =
      body.tenantSettings || body.metadataSchema
        ? {
            tenantSettings: body.tenantSettings,
            metadataSchema: body.metadataSchema,
          }
        : undefined;

    const result = interpretTransaction(rawInput, accounts, context);
    res.json(result);
  } catch (err) {
    console.error('interpret-transaction error:', err);
    res.status(500).json({
      description: 'Transaction',
      lines: [],
      confidenceScore: 0,
      error: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

app.post('/v1/ai/analyze-ledger-health', (req, res) => {
  try {
    const body = req.body as AnalyzeLedgerHealthInput & { entries?: unknown };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const currentRates =
      body.currentRates && typeof body.currentRates === 'object' && !Array.isArray(body.currentRates)
        ? (body.currentRates as Record<string, number>)
        : undefined;
    const result = analyzeLedgerHealth({ entries, currentRates });
    res.json(result);
  } catch (err) {
    console.error('analyze-ledger-health error:', err);
    res.status(500).json({
      exceptions: [],
      closeReadinessScore: 0,
      error: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-service' });
});

app.listen(PORT, () => {
  console.log(`AI service listening on http://localhost:${PORT}`);
});
