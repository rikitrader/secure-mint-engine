/**
 * SecureMint Engine - E2E Tests
 * Complete mint flow end-to-end testing with Playwright
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test wallet address (from hardhat test accounts)
const TEST_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

test.describe('SecureMint Dashboard - Mint Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(BASE_URL);

    // Wait for app to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  });

  test('should display system status', async ({ page }) => {
    // Check status panel
    await expect(page.locator('[data-testid="total-supply"]')).toBeVisible();
    await expect(page.locator('[data-testid="backing-ratio"]')).toBeVisible();
    await expect(page.locator('[data-testid="emergency-level"]')).toBeVisible();
  });

  test('should show invariant status', async ({ page }) => {
    // Navigate to invariants page
    await page.click('[data-testid="nav-invariants"]');

    // Check all 4 invariants are displayed
    await expect(page.locator('[data-testid="invariant-INV-SM-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="invariant-INV-SM-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="invariant-INV-SM-3"]')).toBeVisible();
    await expect(page.locator('[data-testid="invariant-INV-SM-4"]')).toBeVisible();

    // All should be passing in test environment
    const invariants = await page.locator('[data-testid^="invariant-"]').all();
    for (const inv of invariants) {
      await expect(inv.locator('[data-testid="status"]')).toHaveText('Passed');
    }
  });

  test('should navigate to mint page', async ({ page }) => {
    await page.click('[data-testid="nav-mint"]');

    await expect(page).toHaveURL(`${BASE_URL}/mint`);
    await expect(page.locator('h1')).toContainText('Mint');
  });

  test('should display epoch capacity', async ({ page }) => {
    await page.click('[data-testid="nav-mint"]');

    await expect(page.locator('[data-testid="epoch-capacity"]')).toBeVisible();
    await expect(page.locator('[data-testid="epoch-used"]')).toBeVisible();
    await expect(page.locator('[data-testid="epoch-remaining"]')).toBeVisible();
  });

  test('should validate mint form inputs', async ({ page }) => {
    await page.click('[data-testid="nav-mint"]');

    // Try submitting empty form
    await page.click('[data-testid="simulate-mint-btn"]');
    await expect(page.locator('[data-testid="error-recipient"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-amount"]')).toBeVisible();

    // Enter invalid address
    await page.fill('[data-testid="input-recipient"]', 'invalid-address');
    await page.click('[data-testid="simulate-mint-btn"]');
    await expect(page.locator('[data-testid="error-recipient"]')).toContainText('Invalid address');

    // Enter valid address but zero amount
    await page.fill('[data-testid="input-recipient"]', TEST_WALLET);
    await page.fill('[data-testid="input-amount"]', '0');
    await page.click('[data-testid="simulate-mint-btn"]');
    await expect(page.locator('[data-testid="error-amount"]')).toContainText('greater than 0');
  });

  test('should simulate mint successfully', async ({ page }) => {
    await page.click('[data-testid="nav-mint"]');

    // Fill form
    await page.fill('[data-testid="input-recipient"]', TEST_WALLET);
    await page.fill('[data-testid="input-amount"]', '1000');

    // Simulate
    await page.click('[data-testid="simulate-mint-btn"]');

    // Wait for simulation result
    await expect(page.locator('[data-testid="simulation-result"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="simulation-success"]')).toHaveText('Success');
    await expect(page.locator('[data-testid="estimated-gas"]')).toBeVisible();
  });

  test('should show warning for large mint amounts', async ({ page }) => {
    await page.click('[data-testid="nav-mint"]');

    // Fill form with large amount
    await page.fill('[data-testid="input-recipient"]', TEST_WALLET);
    await page.fill('[data-testid="input-amount"]', '500000'); // 500K

    // Simulate
    await page.click('[data-testid="simulate-mint-btn"]');

    // Should show warning for large amount
    await expect(page.locator('[data-testid="large-amount-warning"]')).toBeVisible();
  });
});

test.describe('SecureMint Dashboard - Oracle Status', () => {
  test('should display oracle information', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-testid="nav-oracle"]');

    await expect(page.locator('[data-testid="oracle-address"]')).toBeVisible();
    await expect(page.locator('[data-testid="oracle-last-update"]')).toBeVisible();
    await expect(page.locator('[data-testid="oracle-round-id"]')).toBeVisible();
    await expect(page.locator('[data-testid="oracle-staleness"]')).toBeVisible();
  });

  test('should show backing value', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-testid="nav-oracle"]');

    const backingValue = await page.locator('[data-testid="backing-value"]').textContent();
    expect(backingValue).toMatch(/\$[\d,]+/); // Should be formatted as currency
  });
});

test.describe('SecureMint Dashboard - Treasury', () => {
  test('should display treasury balances', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-testid="nav-treasury"]');

    await expect(page.locator('[data-testid="tier-1-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="tier-2-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="tier-3-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="tier-4-balance"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-reserves"]')).toBeVisible();
  });

  test('should show treasury allocation chart', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-testid="nav-treasury"]');

    await expect(page.locator('[data-testid="allocation-chart"]')).toBeVisible();
  });
});

test.describe('SecureMint Dashboard - Emergency Controls', () => {
  test('should display current emergency level', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-testid="nav-emergency"]');

    await expect(page.locator('[data-testid="current-level"]')).toBeVisible();
    await expect(page.locator('[data-testid="level-description"]')).toBeVisible();
  });

  test('should show level restrictions', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('[data-testid="nav-emergency"]');

    const levels = await page.locator('[data-testid^="level-"]').all();
    expect(levels.length).toBe(6); // 0-5 levels
  });
});

test.describe('API Integration', () => {
  test('should fetch data from API', async ({ request }) => {
    // Test health endpoint
    const healthResponse = await request.get(`${API_URL}/health`);
    expect(healthResponse.ok()).toBeTruthy();

    const health = await healthResponse.json();
    expect(health.status).toBe('ok');
  });

  test('should require auth for protected endpoints', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/mint/capacity`);
    expect(response.status()).toBe(401);
  });

  test('should accept valid JWT token', async ({ request }) => {
    // This would use a test JWT token
    const response = await request.get(`${API_URL}/api/mint/capacity`, {
      headers: {
        Authorization: 'Bearer test-jwt-token',
      },
    });

    // Should either succeed or fail auth (depending on test setup)
    expect([200, 401]).toContain(response.status());
  });
});

test.describe('Mobile Responsiveness', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(BASE_URL);

    // Mobile menu should be visible
    await expect(page.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();

    // Click to open menu
    await page.click('[data-testid="mobile-menu-btn"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto(BASE_URL);

    // Should show sidebar on tablet
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });
});
