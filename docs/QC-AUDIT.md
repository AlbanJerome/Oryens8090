# Full Project Quality Control (QC) Audit

**Date:** 2026-02-25  
**Scope:** Formula engine, RBAC & security, bitemporal/audit integrity, types & performance, dead code.

---

## 1. Formula Engine Accuracy

**File:** `packages/ui/app/lib/engine/formula-plugin.ts`

### Current behavior
- Uses **floating-point math** with `Math.round(x * 100) / 100` for amounts.
- Line subtotal: `Math.round(qty * price * 100) / 100`; tax and grand total similarly rounded.

### Issue
- **IEEE 754**: Summing rounded floats can still accumulate errors (e.g. `0.1 + 0.2 === 0.30000000000000004`). For many lines or repeated operations, financial totals may be off by a cent or more.
- The plugin is used in **demo/formula UI** and **AIEntryReview** (line totals). Core ledger uses **integer cents** elsewhere; this plugin is the outlier.

### Recommendations
1. **Preferred:** Use **integer cents** end-to-end in the formula plugin (e.g. `quantity` in units, `unitPriceCents`, `taxRateBps`). Compute `subtotalCents`, `taxAmountCents`, `grandTotalCents` with integer arithmetic; convert to display only when rendering.
2. **Alternative:** Use a **decimal library** (e.g. `decimal.js` or `big.js`) for all monetary calculations and round only at final display.
3. Add a **unit test** with known problematic cases (e.g. 0.1 + 0.2, or 10 lines of 0.01) and assert exact expected cents.

---

## 2. RBAC & Security Leakage

### 2.1 PermissionGuard and demoRoleOverride
- **PermissionGuard** (`packages/ui/app/components/PermissionGuard.tsx`) correctly hides buttons based on `usePermissions().role` (VIEWER cannot see EDITOR-only actions).
- **demoRoleOverride** (`tenant-store.ts`) is **UI-only**: it overrides the displayed role on the Demo page so users can simulate VIEWER. It does **not** affect the server; the server always uses the real role from `user_tenants`.

**Verdict:** UI behavior is correct. The security gap is server-side (below).

### 2.2 Server-side role enforcement — **GAP FIXED**
- **Before:** `POST /api/tenants/[tenantId]/journal-entries` only called `assertUserCanAccessTenant(request, tenantId)`, which checks **tenant membership** (user has *some* row in `user_tenants` for that tenant). It did **not** check **role**. A VIEWER could send a direct POST and create journal entries.
- **Fix applied:** The route now calls `getRequestUserTenantRows(request)`, finds the row for `tenantId`, and returns **403 Forbidden** if the role is `VIEWER`. Only `EDITOR` and `OWNER` are allowed to POST.

**Recommendation:** Audit other mutating endpoints (e.g. close period, revalue, team invite if restricted by role) and enforce minimum role (EDITOR/OWNER) where applicable.

---

## 3. Bitemporal Integrity (Audit)

### Current architecture
- **Application-level audit:** `AuditLoggerService` and `audit_log` table (see `scripts/setup-db.ts`, `packages/core/src/application/services/audit-logger.service.ts`). Handlers call `auditLogger.log({ action, entityType, entityId, payload })`; the repo inserts into `audit_log(tenant_id, user_id, action, entity_type, entity_id, payload, created_at)`.
- **No DB triggers** on `journal_entries` or `journal_entry_lines` that capture `OLD`/`NEW` row state. The only triggers found are on `audit_log` itself (deny UPDATE/DELETE to keep it append-only).

### Metadata in audit
- **Payload** is a free-form `Record<string, unknown>` (JSONB). Handlers pass whatever they want (e.g. `journalEntryId`, `entityId`, `description`). There is **no** automatic capture of `journal_entries.metadata` or `journal_entry_lines.metadata` in payloads unless the handler explicitly includes them.
- **Bitemporal:** Valid/transaction time is handled in `temporal_balances` and in the domain; audit_log stores **record time** (`created_at`) and action/payload. Old vs new record snapshots for row changes are **not** implemented via triggers.

### Recommendations
1. **If bitemporal row history is required:** Add DB triggers on `journal_entries` and `journal_entry_lines` (AFTER INSERT/UPDATE/DELETE) that append to a history table or to `audit_log` with e.g. `old_record JSONB`, `new_record JSONB` including **all** columns (including `metadata`). Then ensure migrations add these triggers and that `metadata` is part of the snapshot.
2. **If application-level audit is sufficient:** Document that payload content is handler-defined; for important actions (e.g. JournalEntryCreated), consider explicitly including entry/line metadata in the payload where needed for compliance or debugging.

---

## 4. Performance & Types

### 4.1 `any` usage (strict interfaces recommended)

| Location | Current | Recommendation |
|----------|---------|----------------|
| `metadata-validator.ts` | `validateSchema(obj as any)` | Keep cast for Ajv; type schema input as `Record<string, unknown>` or use Ajv's typed compile if available. |
| `journal-entries/route.ts` | `(res.rows as any[]).map(rowToAccount)`, `rowToAccount(r as any)`, `temporalBalanceService as any` | Define `PgAccountRow` and use it in `rowToAccount`; define a minimal `TemporalBalanceService` interface for the handler. |
| `accounts/route.ts` | `(res.rows as any[]).map(...)` | Type the query result row (e.g. `PgAccountRow`) and map without `any`. |
| `journal-lines/route.ts` | `(res.rows as any[]).map(...)` | Same: strict row type. |
| `accounting-periods/route.ts` | `(res.rows as any[]).map(...)` | Same. |
| `audit/route.ts` | `res.rows.map((r: any) => ...)` | Use a typed `PgAuditLogRow` (id, tenant_id, user_id, action, entity_type, entity_id, payload, created_at, entity_name?). |
| `idempotency.service.ts` | `result: any` in interface / `recordExecution(..., result: any)` | Type as `Record<string, unknown>` or a union of known result shapes. |
| `temporal-balance.service.ts` | `Money.zero(currency as any)` | Use `Currency` from domain or a validated string union. |
| Tests | `as unknown as any` for mocks | Prefer typed interfaces for mocks. |

### 4.2 LineItem, TenantContext, AuditRow
- **LineItem** and **LineTotals** are already defined in `formula-plugin.ts` and are strict.
- **AuditRow** is defined in `packages/ui/app/api/tenants/[tenantId]/audit/route.ts` as `AuditLogRow` and in `audit/page.tsx` as `AuditLogRow`; unify naming and ensure the API row type matches the query columns (including payload typing as `Record<string, unknown>`).
- **TenantContext:** No single “TenantContext” type found; tenant/role comes from `getRequestUserTenantRows` and store. Consider a small `TenantContext` type (tenantId, role, name?) used across API and UI for consistency.

---

## 5. Dead Code / Generic Template Leftovers

### Findings
- **Branding:** The codebase is consistently **Oryens**-branded (OryensLogo, oryens-* CSS vars, “Oryens Ledger”, “Welcome to Oryens”). No generic “Supabase” or “Template” branding found in UI strings.
- **Supabase:** Used for **auth and session** (login, signup, callback, tenant resolution via `user_tenants`). This is intentional infrastructure, not dead code.
- **Possible cleanups:**
  - **Duplicate logo components:** `Logo.tsx` (wordmark “Oryens”) and `brand/OryensLogo.tsx` / `components/ui/OryensLogo.tsx`. Confirm which is canonical and remove or redirect the other if unused.
  - **Unused env or flags:** Any `DEBUG_MODE` / `MOCK_USER_TENANT_ID` usage is documented for dev; keep or gate behind env only.
  - No obvious “Generic Supabase Template” landing copy or placeholder pages were found; audit passes for Oryens-specific logic and branding.

### Recommendation
- Do a single pass for `Logo.tsx` vs `OryensLogo` usage; if one is unused, remove or re-export from the other to avoid confusion.

---

## Summary Table

| Area | Status | Action |
|------|--------|--------|
| Formula engine | ⚠️ Float risk | Use cents or decimal library; add tests |
| RBAC (UI) | ✅ | None |
| RBAC (API POST journal) | ✅ Fixed | Enforce EDITOR/OWNER on POST (implemented) |
| Bitemporal / audit triggers | ⚠️ Not present | Add triggers + metadata in snapshot if required |
| Types (`any`) | ⚠️ | Replace with strict interfaces (see table above) |
| Dead code / template | ✅ | Minor: consolidate logo components if duplicate |
