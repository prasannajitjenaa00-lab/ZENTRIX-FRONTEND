// Starts the mock API + client bundle, runs the browser suite, shuts the mock down.
const { spawn } = require('node:child_process'); const path = require('node:path');
const PORT = process.env.PORT || '4010';
const mock = spawn(process.execPath, [path.join(__dirname, 'mock-server.cjs')], { env: { ...process.env, PORT }, stdio: 'inherit' });
setTimeout(() => {
  const t = spawn(process.execPath, [path.join(__dirname, 'e2e.cjs')], { env: { ...process.env, PORT }, stdio: 'inherit' });
  t.on('exit', (code) => { mock.kill(); process.exit(code ?? 1); });
}, 1200);
