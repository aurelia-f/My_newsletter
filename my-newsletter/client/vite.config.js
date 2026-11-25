import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In development the client runs on 5173 and the API on 3000.
    // This proxy forwards /api, /uploads and /ads to the Node
    // server: the browser thinks everything comes from 5173, so the
    // session cookie is accepted with no CORS trouble.
    proxy: {
      '/api':     { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/ads':     { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
});
