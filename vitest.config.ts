import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/renderer/**', 'jsdom']],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/source_backup/**', '**/source_temp/**'],
  },
});
