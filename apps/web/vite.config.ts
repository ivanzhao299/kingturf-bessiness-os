import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { manifest: true },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
});
