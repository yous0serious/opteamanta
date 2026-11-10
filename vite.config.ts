import { defineConfig } from 'vite';

export default defineConfig({
  // Relative Pfade: das Bundle läuft aus jedem Verzeichnis und von jedem statischen Host.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
