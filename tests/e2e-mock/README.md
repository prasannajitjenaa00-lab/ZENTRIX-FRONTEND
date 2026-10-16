# Browser test against a contract mock

Runs the real React client in Chromium against `mock-server.cjs`, an in-memory implementation of `server/docs/API.md`
(it reuses the real backend's permission/scope code, but it is **not** the real backend).

    cd client
    npm install
    npx playwright install chromium
    npm run test:e2e-mock

48 scenarios: every role's navigation, MFA/recovery/reset/forced-password-change, task + account + package workflows,
MP3 upload validation, bank locking, data-scope checks, session expiry, mobile layout. Screenshots go to `$SHOTS` (default /tmp).
Use it to catch client regressions fast; use `server/tests/integration` to verify the real backend.
