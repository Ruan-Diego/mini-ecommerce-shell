import { defineConfig, devices } from '@playwright/test';

/**
 * E2E da compra. A stack inteira (infra, serviços, MFEs e shell) é subida à parte por `pnpm e2e:stack`,
 * então aqui não há `webServer`: os testes só abrem http://localhost:5173.
 * Um worker só: os cenários compartilham o mesmo cliente de teste do Keycloak e o mesmo produto.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
