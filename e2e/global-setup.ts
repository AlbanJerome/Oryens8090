/**
 * Optional E2E global setup. Runs once before all tests.
 * Use for: seeding test tenant + root entity + accounts + period (when DATABASE_URL is set),
 * or setting process.env.MOCK_USER_TENANT_ID from a .env.e2e file.
 */
export default async function globalSetup(): Promise<void> {
  // No-op by default. Uncomment to run seed or load env:
  // process.env.MOCK_USER_TENANT_ID = process.env.E2E_TENANT_ID ?? process.env.MOCK_USER_TENANT_ID;
}
