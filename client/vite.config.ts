import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL('../dist/client', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 0 // keep fonts/images as files (CSP: no data: fonts)
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3000', '/media': 'http://127.0.0.1:3000' }
  }
});
