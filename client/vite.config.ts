import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Resolved to the source directly, not through the node_modules
      // symlink the workspace sets up.
      //
      // Vite does not watch anything under node_modules, so reaching shared/
      // that way meant an edit to a Zod schema or the permission matrix was
      // served from a transform cached at server start. The dev server went
      // on handing the browser the old module through reloads and restarts of
      // everything else -- which is how an added `approve` permission left the
      // Approve and Refuse buttons hidden, with correct code on both sides.
      '@payz/shared': fileURLToPath(
        new URL('../shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    // Proxying keeps the browser on one origin, so the auth cookie is
    // first-party and CORS never enters the picture during development.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
