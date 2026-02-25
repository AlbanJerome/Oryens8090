# AI Service (Port 8090)

Optional service for the Transaction Assistant in the New Journal Entry sidebar.

## Endpoint

**POST /v1/ai/interpret-transaction**

- **Request body:** `{ rawInput: string, accounts: { code, name, accountType }[] }`
- **Response:** `{ description: string, lines: { accountCode, debitAmountCents, creditAmountCents }[], confidenceScore: number }`

Uses fuzzy keyword matching against the tenant's Chart of Accounts (e.g. "Paid $200 for AWS" → debit expense, credit cash). Can be replaced with an LLM later.

## Run

```bash
cd packages/ai-service && npm install && npm run dev
```

Or from repo root: `npm run dev` (if turbo runs all workspaces).

Set `NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8090` in the UI app if the URL differs.
