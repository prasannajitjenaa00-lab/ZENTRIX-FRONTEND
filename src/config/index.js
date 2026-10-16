/**
 * Centralized application configuration.
 * Direct property access on import.meta.env is required for Vite production bundling.
 */
export const config = Object.freeze({
  isDev: Boolean(import.meta.env.DEV),
  isProd: Boolean(import.meta.env.PROD),
  appName: import.meta.env.VITE_APP_NAME || 'Zentrix Pulse',
  apiUrl: (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''),
  socketUrl: import.meta.env.VITE_SOCKET_URL || undefined,
  maxUploadFiles: Number(import.meta.env.VITE_MAX_UPLOAD_FILES) || 100,
});

export default config;
