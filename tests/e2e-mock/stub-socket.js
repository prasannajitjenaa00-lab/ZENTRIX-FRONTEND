// Verification-only stand-in for socket.io-client (not installable offline). The real package is a dependency in client/package.json.
export function io() { const h = {}; return { on(e, f) { h[e] = f; return this; }, off() {}, close() {}, emit() {} }; }
