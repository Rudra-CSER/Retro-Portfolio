import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app runs on :5173 and asks the Express server on :5000
// for everything that isn't React code: the API, the resume and project screenshots.
const SERVER = 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the build works at the domain root or under a sub-path.
  base: './',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': SERVER,
      '/resume.pdf': SERVER,
      '/shots': SERVER,
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
  },
});
