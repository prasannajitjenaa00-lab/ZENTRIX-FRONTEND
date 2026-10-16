import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: the browser talks only to http://localhost:5173; Vite proxies /api and /socket.io to the Express server,
// so session cookies stay first-party (same as production behind Nginx).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8787';
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': { target, changeOrigin: false }, '/socket.io': { target, ws: true, changeOrigin: false } } },
    build: { outDir: 'dist', sourcemap: false },
  };
});
