// Bundles the client for the contract-mock browser test (esbuild ships with Vite). Not used for production builds.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let esbuild;
try { esbuild = await import('esbuild'); } catch { esbuild = await import(process.env.ESBUILD_PATH); }
await esbuild.build({
  entryPoints: [path.join(here, '../../src/main.jsx')], bundle: true, outfile: path.join(here, 'dist/app.js'), format: 'esm', jsx: 'automatic',
  loader: { '.png': 'dataurl' }, define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"development"' },
  // the mock has no websocket server; a no-op socket keeps the test focused on REST behaviour
  alias: { 'socket.io-client': path.join(here, 'stub-socket.js') }, nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [], logLevel: 'info',
});
