# Demo: Features Built on This Branch

This guide walks through the features implemented for **Entities**, **Departmental Tagging**, and **Automated Reversals**, plus related fixes.

---

## Prerequisites

1. **Database**: PostgreSQL with schema applied.
   ```bash
   DATABASE_URL=postgres://user:pass@host:5432/dbname npx tsx scripts/setup-db.ts
   ```
2. **Run the app** (from repo root):
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 (or the URL shown).

3. **Access a tenant**: With Supabase configured, sign in and pick a company. For local dev without Supabase, set `DEBUG_MODE=true` and `MOCK_USER_TENANT_ID=<a-tenant-uuid>` in `.env.local` so requests are allowed and a tenant is preselected.

---

## 1. Entities

**Nav:** Sidebar → **Entities**

**What you see**

- **Table** of all entities for the current tenant: Name, Parent, Ownership %, Consolidation method, Currency. Root entities show “(root)”.
- **Add entity** button.

**Demo steps**

1. Go to **Entities**.
2. Click **Add entity**.
3. **Root entity**: Enter a name (e.g. “HQ”), leave Parent as “— None (root) —”, Currency e.g. “USD”. Click **Add entity**. The new row appears with “(root)”.
4. **Subsidiary**: Click **Add entity** again. Enter name (e.g. “Sub A”), choose the root as **Parent entity**, set **Ownership %** (e.g. 80), **Consolidation method** (Full / Proportional / Equity). Click **Add entity**. The table shows the new entity with parent name and ownership.
5. Use **← Back to Dashboard** to return.

**APIs used:** `GET /api/tenants/[tenantId]/entities`, `POST /api/tenants/[tenantId]/entities`.

---

## 2. Departmental Tagging

**Nav:** Sidebar → **Departmental Tagging**

**What you see**

- **Departments** section: table of departments (Name, Code) and **Add department**.
- **Tag accounts** section: table of accounts with a **Department** dropdown per row.

**Demo steps**

1. Go to **Departmental Tagging**.
2. **Create departments**: Click **Add department**. Enter Name (e.g. “Sales”), optional Code (e.g. “SAL”). Submit. Add another (e.g. “Engineering”, “ENG”). They appear in the departments table.
3. **Tag accounts**: In “Tag accounts”, pick a department from the dropdown for one or more accounts. The selection is saved via PATCH; the page shows the updated department name.
4. **← Back to Dashboard** returns to the dashboard.

**APIs used:** `GET/POST /api/tenants/[tenantId]/departments`, `GET /api/tenants/[tenantId]/accounts` (with department info), `PATCH /api/tenants/[tenantId]/accounts/[accountId]` (body: `{ departmentId }`).

**Note:** Chart of Accounts and Automated Reversals also use `GET .../accounts` for their lists.

---

## 3. Automated Reversals

**Nav:** Sidebar → **Automated Reversals**

**What you see**

- **Run rule** bar: Entity dropdown, Posting date.
- **Table** of reversal rules: Name, Schedule, number of lines, Last run, **Run now** button.
- **Add rule** button.

**Demo steps**

1. Go to **Automated Reversals**.
2. **Run rule bar**: Select an **Entity** (e.g. your root entity) and a **Posting date** (must fall in an open accounting period).
3. **Create a rule**: Click **Add rule**. Enter Name (e.g. “Monthly accrual reversal”), optional Description, **Schedule** (Manual only / Month end / Quarter end). In **Template lines**:
   - Pick an **Account** (e.g. from Chart of Accounts).
   - Enter **Debit cents** on one line and **Credit cents** on another (e.g. 10000 and 10000 so the entry balances). Add more lines with **+ Add line** if needed.
   - Submit. The new rule appears in the table.
4. **Run a rule**: In the run bar, ensure Entity and Posting date are set. Click **Run now** on a rule. The handler creates a reversal journal entry (debits/credits swapped) and updates **Last run**.
5. **← Back to Dashboard** to finish.

**APIs used:** `GET/POST /api/tenants/[tenantId]/reversal-rules`, `POST /api/tenants/[tenantId]/reversal-rules/[ruleId]/run` (body: `{ entityId, postingDate }`). Run uses the same journal-entry creation pipeline as manual JEs (period check, audit, etc.).

---

## 4. Other pages that use the new APIs

- **Chart of Accounts** (`/chart-of-accounts`): Lists accounts via `GET .../accounts` (no department column on this page; departments are used on Departmental Tagging).
- **Dashboard / Alerts**: Uses `GET .../alerts?parentEntityId=...` with the discovery root entity; requires `parentEntityId` to be passed from the dashboard.

---

## 5. Bug fixes included on this branch

- **Tenant guard**: Users with **no** tenant associations now get **403 Forbidden** instead of being allowed to access any tenant.
- **Entities API**: Invalid or missing `ownershipPercentage` defaults to 100; redundant dead validation was removed.
- **Accounting periods**: Fallback period end date uses the **last day of the current month** (not December 31).
- **LocaleContext**: Settings fetch checks `response.ok` before parsing JSON and treats non-ok as failure (defaults locale/currency).

---

## Quick checklist for a full demo

1. Start app and open a tenant (debug or real).
2. **Entities**: Add root entity → add subsidiary with ownership %.
3. **Departmental Tagging**: Add 2 departments → tag several accounts.
4. **Automated Reversals**: Add a reversal rule with 2+ lines → set entity + date → Run now.
5. Optionally open Chart of Accounts and Dashboard to confirm accounts and alerts load.
