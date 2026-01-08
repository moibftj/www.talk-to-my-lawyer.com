import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ? Number(process.env.PLAYWRIGHT_PORT) : 3000
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm dev -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://dummy-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy_anon_key_for_local_ci_testing_only',
      OPENAI_API_KEY: 'dummy_openai_key_for_local_ci_testing_only',
      ENABLE_TEST_MODE: 'true',
      NEXT_PUBLIC_TEST_MODE: 'true',
      NEXT_PUBLIC_APP_URL: baseURL,
      EMAIL_PROVIDER: 'console',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
