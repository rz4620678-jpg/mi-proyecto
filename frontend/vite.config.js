import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = basename(dirname(dirname(fileURLToPath(import.meta.url))));

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
   proxy: {
     '/api': {
       target: 'http://127.0.0.1',
       changeOrigin: true,
       rewrite: (path) => path.replace(/^\/api/, `/${projectDirectory}/backend/api.php`),
     },
   },
  },
});
