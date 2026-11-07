import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the build works at the domain root, under a sub-path,
  // or opened as a static preview.
  base: './',
  resolve: {
    alias: {
      // Single source of truth for all copy: the same file the server seeds into MongoDB.
      '@content': here('../server/data/content.json'),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: [here('..')] },
    proxy: {
      '/api': 'http://localhost:5000',
      '/resume.pdf': 'http://localhost:5000',
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
  },
});
