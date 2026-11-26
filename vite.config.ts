import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? (process.env.VITE_BASE_PATH || './') : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@scribble-it/types': path.resolve(__dirname, 'packages/types/src/index.ts'),
        '@scribble-it/api-client': path.resolve(__dirname, 'packages/api-client/src/index.ts'),
        '@scribble-it/rbac': path.resolve(__dirname, 'packages/rbac/src/index.ts'),
        '@scribble-it/design-tokens': path.resolve(__dirname, 'packages/design-tokens/src/index.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
