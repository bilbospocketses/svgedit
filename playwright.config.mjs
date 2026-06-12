import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:9000',
    headless: true
  },
  reporter: 'list',
  webServer: {
    command: 'npm run start:e2e',
    url: 'http://localhost:9000/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The browser-canary workflow sets CHROMIUM_CHANNEL=chrome-beta to run this suite
        // against the upcoming Chrome; unset everywhere else, so the pinned CI and local
        // runs use Playwright's bundled Chromium.
        ...(process.env.CHROMIUM_CHANNEL ? { channel: process.env.CHROMIUM_CHANNEL } : {})
      }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ]
})
