import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8787';
  const apiUrl = env.VITE_API_URL || '';
  const socketUrl = env.VITE_SOCKET_URL || '';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_SOCKET_URL': JSON.stringify(socketUrl),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: false },
        '/socket.io': { target, ws: true, changeOrigin: false }
      }
    },
    build: { outDir: 'dist', sourcemap: false },
  };
});
