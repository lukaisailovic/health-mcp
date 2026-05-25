import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const SERVER_TARGET = process.env.HEALTH_MCP_PROXY ?? 'http://127.0.0.1:7777';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@health-mcp/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': SERVER_TARGET,
      '/health': SERVER_TARGET,
      '/version': SERVER_TARGET,
      '/auth/wearable': SERVER_TARGET,
    },
  },
  build: {
    outDir: resolve(__dirname, '../server/public'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
