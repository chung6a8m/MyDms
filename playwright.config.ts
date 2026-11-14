import { defineConfig } from '@playwright/test';

// S6-0 only: browser E2E not activated on CI until real PWA tests/harness are approved.
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 30_000,
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:5173' },
  reporter: 'list'
});
