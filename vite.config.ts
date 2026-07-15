import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@config': resolve(__dirname, 'src/config'),
      '@data': resolve(__dirname, 'src/data'),
      '@render': resolve(__dirname, 'src/render'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@safeguards': resolve(__dirname, 'src/safeguards'),
      '@save': resolve(__dirname, 'src/save'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'ES2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});