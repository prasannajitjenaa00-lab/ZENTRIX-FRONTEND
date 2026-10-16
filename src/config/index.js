/**
 * Centralized application configuration.
 * Reads Vite environment variables with fallback defaults.
 */
const env = import.meta.env || {};

export const config = Object.freeze({
  isDev: Boolean(env.DEV),
  isProd: Boolean(env.PROD),
  appName: env.VITE_APP_NAME || 'Zentrix Pulse',
  apiUrl: (env.VITE_API_URL || '').replace(/\/$/, ''),
  socketUrl: env.VITE_SOCKET_URL || undefined,
  maxUploadFiles: Number(env.VITE_MAX_UPLOAD_FILES) || 100,
});

export default config;
