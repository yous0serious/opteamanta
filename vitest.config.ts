import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integrationstests laufen nur explizit gegen Supabase (npm run test:integration).
    exclude: ['tests/integration/**', 'node_modules/**'],
  },
});
