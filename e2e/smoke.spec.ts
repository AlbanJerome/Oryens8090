/**
 * E2E smoke: login bypass, dashboard discovery, new journal entry $100, success toast, balance sheet shows $100.
 * Requires: app running with MOCK_USER_TENANT_ID set to a tenant that has a root entity, open period, and accounts (e.g. 1000-CASH, 4000-REV).
 * Run: npm run test:e2e (start the UI first: npm run dev from packages/ui or turbo dev).
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke: dashboard, new journal entry, balance sheet', () => {
  test('Step 1–5: auth bypass, dashboard, new entry $100, success toast, balance sheet reflects $100', async ({
    page,
  }) => {
    // Step 1: Log in bypass — app must be run with MOCK_USER_TENANT_ID (and optionally DEBUG_MODE=true).
    // No explicit login; we rely on mock tenant access.
    await page.goto('/');

    // Step 2: Landing on dashboard (discovery check).
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'New Entry' })).toBeVisible();

    // Ensure Balance Sheet tab is active (click if needed).
    await page.getByRole('button', { name: 'Balance Sheet' }).click();

    // Step 3: Open "New Journal Entry" and input $100 Debit / $100 Credit.
    await page.getByRole('button', { name: 'New Entry' }).click();
    await expect(page.getByRole('dialog', { name: /new journal entry/i })).toBeVisible();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Description').fill('Smoke test $100');
    await dialog.getByLabel('Date').fill(new Date().toISOString().slice(0, 10));

    // First line: account (type to filter then select), debit 100.
    const accountInputs = dialog.getByPlaceholder(/search by code or name/i);
    await accountInputs.first().click();
    await accountInputs.first().fill('Cash');
    await page.getByRole('option', { name: /1000-CASH|Cash/i }).first().click();

    const amountInputs = dialog.locator('input[placeholder="0.00"]');
    await amountInputs.nth(0).fill('100'); // first line debit

    // Second line: account Revenue, credit 100.
    await accountInputs.nth(1).click();
    await accountInputs.nth(1).fill('Revenue');
    await page.getByRole('option', { name: /4000-REV|Revenue/i }).first().click();
    await amountInputs.nth(3).fill('100'); // second line credit

    // Step 4: Submit and observe success toast.
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: /saved/i })).toBeVisible({ timeout: 10000 });

    // Step 5: Balance sheet shows $100 (in trial balance / balance sheet table).
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
    await page.getByRole('button', { name: 'Balance Sheet' }).click();
    await expect(
      page.locator('table.balance-sheet-table').getByText(/\$100|100\.00/, { exact: false })
    ).toBeVisible({ timeout: 10000 });
  });
});
