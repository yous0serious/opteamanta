import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1300, height: 820 },
  },
  webServer: [
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command:
        'npx vite build --outDir .tmp/dist-e2e-online --emptyOutDir && npx vite preview --outDir .tmp/dist-e2e-online --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        VITE_SUPABASE_URL: 'http://supabase.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-dummy-key', // secret-scan: allow (Dummy für gemockte E2E)
      },
    },
  ],
});
