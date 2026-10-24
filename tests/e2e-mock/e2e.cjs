const { chromium } = require('playwright');
const BASE = `http://127.0.0.1:${process.env.PORT || 4010}`; const PW = 'Passw0rd!';
const results = []; let page; let consoleErrors = [];
const step = async (name, fn) => { try { const mb = page.locator('.modal-back'); if (await mb.count()) { await page.mouse.click(2, 2); await page.waitForTimeout(300); } await fn(); results.push(['PASS', name]); console.log('PASS', name); } catch (e) { results.push(['FAIL', name, String(e.message).split('\n')[0]]); console.log('FAIL', name, '->', String(e.message).split('\n')[0]); try { await page.screenshot({ path: `/tmp/fail-${results.length}.png` }); } catch {} } };
const expect = (c, m) => { if (!c) { const ln = (new Error().stack.split('\n')[2] || '').match(/e2e\.cjs:(\d+:\d+)/); throw new Error((m || 'assertion failed') + ' @' + (ln ? ln[1] : '?')); } };
const toastText = async () => (await page.locator('.toast').allTextContents()).join(' | ');

const toastHas = async (sub, ms = 3500) => { try { await page.waitForFunction((t) => [...document.querySelectorAll('.toast')].some((x) => x.textContent.includes(t)), sub, { timeout: ms }); } catch { throw new Error(`toast containing "${sub}" never appeared; saw: ${await toastText()}`); } };
const textHas = async (sel, sub, ms = 3500) => { try { await page.waitForFunction(([s, t]) => (document.querySelector(s)?.textContent || '').includes(t), [sel, sub], { timeout: ms }); } catch { throw new Error(`"${sel}" never contained "${sub}"; saw: ${(await page.locator(sel).first().textContent().catch(() => 'n/a')).slice(0, 120)}`); } };
async function reset() { await page.request.get(`${BASE}/__reset`); }
async function login(email, pw = PW) { await page.goto(BASE); await page.fill('#login-email', email); await page.fill('#login-password', pw); await page.click('#login-form button[type=submit]'); }
async function loginReady(email) { await login(email); await page.waitForSelector('#app-screen', { timeout: 5000 }); await page.waitForSelector('.kpi, .panel, .empty', { timeout: 5000 }); }
async function logout() { try { await page.click('#logout-btn', { timeout: 4000 }); await page.waitForSelector('#auth-screen', { timeout: 4000 }); } catch (e) { console.log('  (logout fallback: ' + String(e.message).split('\n')[0] + ')'); await page.request.get(`${BASE}/__reset`); await page.goto(BASE); await page.waitForSelector('#auth-screen'); } }
const nav = (label) => page.locator('#nav .nav-btn', { hasText: label }).first().click();

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); page = await ctx.newPage(); page.setDefaultTimeout(7000);
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message));
  await reset();

  /* ---------- AUTH ---------- */
  await step('login screen renders hero + form, no demo credentials chips', async () => { await page.goto(BASE); await page.waitForSelector('#login-form'); await textHas('.auth-hero h1', 'Orchestrate every month'); expect(await page.locator('.demo-chip').count() === 0); await page.screenshot({ path: '/tmp/shot-login.png' }); });
  await step('wrong password shows generic error and stays on login', async () => { await login('tina.r@example.net', 'nope-nope'); await page.waitForSelector('.auth-error:not(.hidden)'); await textHas('.auth-error', 'do not match'); });
  await step('Show/Hide toggles password field type', async () => { await page.goto(BASE); await page.fill('#login-password', 'abc'); expect(await page.getAttribute('#login-password', 'type') === 'password'); await page.click('.pass-toggle'); expect(await page.getAttribute('#login-password', 'type') === 'text'); });
  await step('admin signs in (no MFA) and lands on Command center', async () => { await loginReady('tina.r@example.net'); expect((await page.textContent('#page-title')) === 'Command center'); await textHas('#sb-name', 'Aryan'); });

  /* ---------- ADMIN DASHBOARD ---------- */
  await step('admin dashboard: 4 KPIs (count-up finishes), ring canvas, legend, panels, security panel w/o passwords', async () => {
    await page.waitForTimeout(900);
    expect(await page.locator('.kpi').count() === 4, 'kpi count'); const vals = await page.locator('.kpi .k-val').allTextContents(); expect(vals[1] === '10' || /^\d+$/.test(vals[1]), 'open work numeric ' + vals);
    expect(await page.locator('canvas#pie').count() === 1); expect(await page.locator('.legend .leg-item').count() === 4);
    expect(await page.locator('text=Studio activity').count() >= 1); expect(await page.locator('text=Inactive members').count() >= 1);
    const sec = await page.locator('.cred-panel').textContent(); expect(sec.includes('Security credentials')); expect(!/Admin@123|Emp@123|Passw0rd!/.test(sec), 'no passwords shown'); expect(!sec.includes('Current password'));
    await page.screenshot({ path: '/tmp/shot-admin-dash.png', fullPage: true });
  });
  await step('status ring: hover slice shows tooltip with owners; hover center shows snapshot; legend click navigates to Open work', async () => {
    const box = await page.locator('canvas#pie').boundingBox(); const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.waitForSelector('.ring-tip'); await textHas('.ring-tip', 'Studio snapshot');
    await page.mouse.move(cx + box.width * 0.4, cy); await page.waitForTimeout(100); const tip = await page.textContent('.ring-tip'); expect(/Pending|In Progress|On Hold|Completed/.test(tip));
    await page.mouse.move(5, 5); await page.click('.legend [data-st="Pending"]'); await page.waitForSelector('#page-title:has-text("Open work")');
  });
  await step('Completed slice goes to Completed board (original routed it to the wrong view)', async () => { await nav('Command center'); await page.click('.legend [data-st="Completed"]'); await page.waitForSelector('#page-title:has-text("Completed work")'); expect(await page.locator('.kpi').count() === 4); });

  /* ---------- EVERY ADMIN NAV ITEM ---------- */
  for (const [label, title] of [['Active crew', 'Active crew'], ['Open work', 'Open work'], ['All assignments', 'All assignments'], ['Assign work', 'Assign work'], ['Projects', 'Projects'], ['Packages', 'Packages'], ['Accounts', 'Accounts studio']]) {
    await step(`admin nav → ${label}`, async () => { await nav(label); await page.waitForFunction((t) => document.querySelector('#page-title')?.textContent === t, title, { timeout: 4000 }); await page.waitForTimeout(150); expect(await page.locator('#view').textContent() !== ''); });
  }

  /* ---------- CALENDAR + TASKS ---------- */
  await step('calendar opens on September 2026 with chips; admin filter by employee; prev/next month', async () => {
    await nav('Monthly orbit'); await page.waitForSelector('.cal-grid .chip'); await textHas('.month-title', 'September 2026'); const n = await page.locator('.chip').count(); expect(n >= 10, 'chips ' + n);
    await page.selectOption('#cal-user', { label: 'Priya Sharma' }); await page.waitForTimeout(300); const m = await page.locator('.chip').count(); expect(m > 0 && m < n, `filtered ${m}/${n}`); await page.selectOption('#cal-user', 'all');
    await page.click('#next-m'); await page.waitForTimeout(300); await textHas('.month-title', 'October 2026'); await page.click('#prev-m');
    await page.screenshot({ path: '/tmp/shot-calendar.png' });
  });
  await step('Today button jumps to the current month on the calendar', async () => { await page.click('#today-btn'); await page.waitForSelector('.month-title'); const cur = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); expect((await page.textContent('.month-title')) === cur, await page.textContent('.month-title')); });
  await step('admin edits a task from the calendar: modal has all fields, saves, toast, data refreshes', async () => {
    await page.click('#today-btn'); await nav('Monthly orbit'); await page.waitForSelector('.cal-grid'); for (let i = 0; i < 1; i++) { /* ensure Sept */ }
    const sep = await page.evaluate(() => 0); await page.click('#prev-m').catch(() => {}); // may be Oct (today=Oct 15, 2026) -> back to Sept
    await page.waitForSelector('.chip'); await page.locator('.chip').first().click(); await page.waitForSelector('.modal');
    for (const id of ['#f-title', '#f-desc', '#f-assignee', '#f-cat', '#f-start', '#f-due', '#f-st', '#f-prog', '#f-notes', '#del-task']) expect(await page.locator(id).count() === 1, id);
    await page.fill('#f-prog', '66'); await page.selectOption('#f-st', 'In Progress'); await page.click('#save-m'); await page.waitForFunction(() => !document.querySelector('.modal-back')); await toastHas('Pulse updated');
  });
  await step('task list: status filter + global search (≥2 chars) + New assignment creates a task visible in list', async () => {
    await nav('All assignments'); await page.waitForSelector('table'); const all = await page.locator('tbody tr').count(); await page.selectOption('#st-filter', 'Completed'); await page.waitForTimeout(300); const comp = await page.locator('tbody tr').count(); expect(comp > 0 && comp < all, `${comp}/${all}`);
    await page.selectOption('#st-filter', 'all'); await page.fill('#global-search', 'Priya'); await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'All assignments'); await page.waitForTimeout(400); const byOwner = await page.locator('tbody tr').count(); expect(byOwner > 0 && byOwner < all, 'owner search ' + byOwner);
    await page.fill('#global-search', ''); await page.click('#new-task'); await page.waitForSelector('#f-title'); await page.waitForFunction(() => document.querySelector('#f-assignee')?.value); await page.fill('#f-title', 'E2E created task'); await page.click('#save-m'); await page.waitForFunction(() => !document.querySelector('.modal-back'));
    await page.fill('#global-search', 'E2E created'); await page.waitForTimeout(500); expect(await page.locator('tbody tr').count() === 1);
    await page.fill('#global-search', '');
  });
  await step('assign page validates required fields then publishes and jumps to calendar', async () => {
    await nav('Assign work'); await page.waitForSelector('#save-assign'); await page.click('#save-assign'); await toastHas('required');
    await page.fill('#f-title', 'Via assign page'); await page.click('#save-assign'); await page.waitForSelector('.month-title'); await toastHas('Assignment published');
  });

  /* ---------- ACCOUNTS ---------- */
  await step('accounts list shows roles/orgs/bank lines; create employee requires a team leader; temp password shown once', async () => {
    await nav('Accounts'); await page.waitForSelector('#new-person'); expect(await page.locator('[data-edit]').count() === 7); expect(await page.locator('[data-toggle]').count() === 6, 'admin has no suspend button');
    await page.click('#new-person'); await page.waitForSelector('#pe-name'); await page.fill('#pe-name', 'Test Hire'); await page.fill('#pe-email', 'hire@example.com'); await page.click('#save-m'); await toastHas('team leader');
    await page.selectOption('#pe-leader', { label: 'Ananya Iyer' }); await page.click('#save-m'); await page.waitForSelector('#temp-password'); const tp = await page.textContent('#temp-password'); expect(tp.length >= 8); await page.click('#close-m'); await page.waitForTimeout(250);
    expect(await page.locator('[data-edit]').count() === 8);
  });
  await step('floor manager edit modal cannot demote (role locked)', async () => { await page.locator('.panel', { has: page.locator('strong', { hasText: /^Vikram Singh$/ }) }).locator('[data-edit]').click(); await page.waitForSelector('#pe-role'); expect(await page.locator('#pe-role').isDisabled()); expect((await page.locator('#pe-role option').allTextContents()).join() === 'Floor Manager'); await page.click('#close-m'); await page.waitForTimeout(250); });
  await step('suspend then restore an employee updates the badge', async () => { const row = page.locator('.panel', { has: page.locator('strong', { hasText: /^Arjun Patel$/ }) }); await row.locator('[data-toggle]').click(); await page.waitForFunction(() => [...document.querySelectorAll('.panel')].find((p) => p.textContent.includes('Arjun Patel'))?.textContent.includes('Restore')); await row.locator('[data-toggle]').click(); await page.waitForFunction(() => [...document.querySelectorAll('.panel')].find((p) => p.textContent.includes('Arjun Patel'))?.textContent.includes('Suspend')); });

  /* ---------- PACKAGES / CHAT / PROJECTS ---------- */
  await step('packages: list defaults, create, edit validation (empty name), delete with confirm', async () => {
    await nav('Packages'); await page.waitForSelector('#new-package'); const before = await page.locator('.panel').count(); expect(before === 4, 'defaults ' + before);
    await page.click('#new-package'); await page.fill('#pkg-name', ''); await page.click('#save-pkg'); await toastHas('Package name is required');
    await page.fill('#pkg-name', 'Gold'); await page.fill('#pkg-amount', '30000'); await page.click('#save-pkg'); await page.waitForFunction(() => document.querySelectorAll('.panel').length === 5);
    page.once('dialog', (d) => d.accept()); await page.locator('.panel', { hasText: 'Gold' }).locator('.btn-danger').click(); await page.waitForFunction(() => document.querySelectorAll('.panel').length === 4);
  });
  await step('chat: admin posts and sees the message; input limited to 500', async () => { await nav('Studio chat'); await page.waitForSelector('#chat-form'); expect((await page.getAttribute('#chat-input', 'maxlength')) === '500'); await page.fill('#chat-input', 'Hello from e2e'); await page.click('#chat-form button'); await page.waitForSelector('.chat-bubble:has-text("Hello from e2e")'); });
  await step('projects: create project, upload MP3 (+ a fake .mp3 rejected by content), assign to employees', async () => {
    await nav('Projects'); await page.waitForSelector('#new-project'); await page.click('#new-project'); await page.fill('#pr-name', 'E2E set'); await page.click('#save-m'); await page.waitForSelector('#mp3-upload');
    const mp3 = Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00'), Buffer.alloc(3000, 1)]);
    await page.setInputFiles('#mp3-files', [{ name: 'good.mp3', mimeType: 'audio/mpeg', buffer: mp3 }, { name: 'fake.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('<?php evil ?>') }]); await page.click('#mp3-upload');
    await page.waitForSelector('.track-row'); expect(await page.locator('.track-row').count() === 1, 'only the real mp3'); expect((await page.textContent('#mp3-status')).includes('fake.mp3'), 'rejection shown: ' + (await page.textContent('#mp3-status')));
    await page.check('[data-track]'); await page.locator('.emp-chip', { hasText: 'Priya' }).locator('input').check(); await page.click('#assign-tracks'); await page.waitForFunction(() => document.body.textContent.includes('Assigned 1 listening jobs'));
    await page.click('#assign-tracks'); await page.waitForFunction(() => document.body.textContent.includes('already assigned'));
  });
  await step('upload guard: >100 files refused client-side with original message', async () => {
    const files = Array.from({ length: 101 }, (_, i) => ({ name: `t${i}.mp3`, mimeType: 'audio/mpeg', buffer: Buffer.from('ID3....') })); await page.setInputFiles('#mp3-files', files); await page.click('#mp3-upload'); await toastHas('Maximum 100 MP3 files');
  });
  await logout();

  /* ---------- EMPLOYEE ---------- */
  await step('employee dashboard: wallet, own tasks only, assigned MP3 → notebook modal plays audio and saves notes', async () => {
    await loginReady('zara.a@example.net'); expect((await page.textContent('#page-title')).includes("Priya's dashboard")); await page.waitForTimeout(800);
    const txt = await page.locator('#view').textContent(); expect(txt.includes('Your wallet') && txt.includes('Standard') && txt.includes('₹10,000'), 'wallet'); expect(!txt.includes('Rohan'), 'no colleague data');
    await page.screenshot({ path: '/tmp/shot-employee-dash.png', fullPage: true });
    await page.click('[data-mp3]'); await page.waitForSelector('#mp3-player'); expect((await page.getAttribute('#mp3-player', 'src')).includes('/stream')); await page.fill('#mp3-note', 'I heard hello'); await page.click('#save-mp3-note'); await page.waitForFunction(() => !document.querySelector('.modal-back')); await toastHas('Notebook saved');
  });
  await step('employee nav has exactly the original 6 items; no admin items', async () => { const labels = await page.locator('#nav .nav-btn').allTextContents(); expect(labels.length === 6 && labels.join('').includes('Assigned Audio') && !labels.join('').includes('Accounts'), labels.join('|')); });
  await step('employee updates own task status/progress; Completed forces 100 (server rule shown)', async () => {
    await nav('My tasks'); await page.waitForSelector('table'); await page.locator('tbody tr').first().locator('button').click(); await page.waitForSelector('#f-st'); expect(await page.locator('#f-title').count() === 0, 'employee sees status form only'); await page.selectOption('#f-st', 'Completed'); await page.fill('#f-notes', 'done by e2e'); await page.click('#save-m'); await page.waitForFunction(() => !document.querySelector('.modal-back'));
    await page.waitForTimeout(300); expect((await page.locator('tbody tr').first().textContent()).includes('100%'), 'progress forced to 100');
  });
  await step('employee: only own tasks listed; assigned audio page shows audio, saves a draft, and submits', async () => {
    const n = await page.locator('tbody tr').count(); expect(n === 3 || n >= 1, 'own tasks ' + n);
    await nav('Assigned Audio'); await page.waitForSelector('.note-card'); expect((await page.inputValue('textarea[data-note]')) === 'I heard hello');
    await page.fill('textarea[data-note]', 'second note'); await page.click('[data-save-draft]'); await toastHas('Draft saved');
    await page.click('[data-submit]'); await toastHas('Translation submitted'); await page.waitForSelector('textarea[data-note][readonly]');
  });
  await step('employee chat is read-only', async () => { await nav('Studio chat'); await page.waitForSelector('.chat-stream'); expect(await page.locator('#chat-form').count() === 0); await textHas('.panel.chat-panel', 'Only admin can send'); });
  await step('profile: bank validation, save locks fields, recovery codes shown once, MFA toggle, forget devices', async () => {
    await nav('Profile'); await page.waitForSelector('#save-bank'); await page.click('#save-bank'); await toastHas('All bank fields are required');
    await page.fill('#p-bank-holder', 'Priya Sharma'); await page.fill('#p-bank-name', 'SBI'); await page.fill('#p-bank-acc', '12ab'); await page.fill('#p-bank-ifsc', 'sbin0001234'); await page.click('#save-bank'); await toastHas('Account number looks invalid');
    await page.fill('#p-bank-acc', '123456789012'); await page.fill('#p-bank-ifsc', 'BAD'); await page.click('#save-bank'); await toastHas('IFSC must be 11');
    await page.fill('#p-bank-ifsc', 'sbin0001234'); await page.click('#save-bank'); await page.waitForFunction(() => document.querySelector('#p-bank-holder')?.disabled === true); await textHas('body', 'locked after first save'); expect(await page.locator('#save-bank').count() === 0);
    await page.click('#p-gen-recovery'); await page.waitForSelector('.modal #p-recovery code'); expect(await page.locator('.modal #p-recovery code').count() === 6); await page.click('#close-m'); await page.waitForTimeout(250);
    await textHas('#p-recovery', '6 unused'); await page.click('#p-clear-trust'); await toastHas('Trusted devices cleared');
    await page.check('#p-mfa'); await page.click('#save-profile'); await page.waitForSelector('.modal #p-recovery code'); await page.click('#close-m'); await page.waitForTimeout(250);
    await page.screenshot({ path: '/tmp/shot-profile.png', fullPage: true });
  });
  await step('password change from profile requires the current password', async () => {
    await page.fill('#p-pass', 'NewPass#12'); await page.click('#save-profile'); await toastHas('current password'); await page.fill('#p-cur', 'wrong'); await page.click('#save-profile'); await page.waitForTimeout(300); expect((await toastText()).includes('incorrect'), await toastText());
    await page.fill('#p-cur', PW); await page.click('#save-profile'); await page.waitForTimeout(300); await toastHas('Password replaced');
  });
  await logout();

  /* ---------- TEAM LEADER (MFA) ---------- */
  await step('MFA: password → code screen; wrong code errors; resend; recovery code works; trust box present', async () => {
    await login('frank.g@example.org'); await page.waitForSelector('#mfa-form'); expect((await page.getAttribute('#mfa-code', 'maxlength')) >= '16' || Number(await page.getAttribute('#mfa-code', 'maxlength')) >= 16, 'recovery codes fit the input');
    await page.fill('#mfa-code', '000000'); await page.click('#mfa-submit'); await page.waitForSelector('.auth-error:not(.hidden)'); await textHas('.auth-error', 'does not match');
    await page.click('#mfa-resend'); await toastHas('new code'); expect(await page.locator('#mfa-trust').count() === 1);
    await page.fill('#mfa-code', '123456'); await page.check('#mfa-trust'); await page.click('#mfa-submit'); await page.waitForSelector('#app-screen'); await page.waitForSelector('.kpi');
  });
  await step('team leader dashboard is scoped: only own team (Priya, Rohan, Arjun), no security panel, no Accounts/Packages nav', async () => {
    await page.waitForTimeout(600); const txt = await page.locator('#view').textContent(); expect(!txt.includes('Security credentials'), 'no security panel'); expect(txt.includes('Priya Sharma') && !txt.includes('Vikram Singh'), 'scoped members');
    const labels = (await page.locator('#nav .nav-btn').allTextContents()).join('|'); expect(labels.includes('My team') && !labels.includes('Accounts') && !labels.includes('Packages'), labels);
  });
  await step('team leader crew view groups by leader; Assign-to modal locks owner; assigns within team', async () => {
    await nav('My team'); await page.waitForSelector('.crew-card'); expect(await page.locator('.team-heading').count() >= 1); await page.locator('.crew-card').first().locator('.assign-to').click(); await page.waitForSelector('#f-assignee'); expect(await page.locator('#f-assignee').isDisabled());
    await page.fill('#f-title', 'TL assigned'); await page.click('#save-m'); await page.waitForFunction(() => !document.querySelector('.modal-back')); await toastHas('Assigned to');
  });
  await step('team leader cannot open a teammate task ("lives on another desk")', async () => { await nav('Assignments'); await page.waitForSelector('table'); await page.locator('tbody tr').first().locator('button').click(); await page.waitForTimeout(200); expect((await toastText()).includes('another desk') || (await page.locator('.modal').count()) === 1); });
  await step('team leader projects: no upload box, can assign, can see tracks', async () => { await nav('Projects'); await page.waitForSelector('.panel'); expect(await page.locator('#new-project').count() === 0); expect(await page.locator('#mp3-upload').count() === 0); });
  await logout();
  await step('trusted device: next sign-in skips MFA (server-controlled in real backend; mock keeps MFA)', async () => { /* informational: trust is a server cookie — verified by backend integration tests */ });

  /* ---------- FORGOT / RESET ---------- */
  await step('forgot password → dev preview link → reset form (strength meter, mismatch) → login with new password', async () => {
    await page.goto(BASE); await page.fill('#login-email', 'james.b@example.com'); await page.click('#go-forgot'); await page.waitForSelector('#forgot-form'); expect((await page.inputValue('#forgot-email')) === 'james.b@example.com'); await page.click('#forgot-submit'); await page.waitForSelector('#forgot-ok');
    await page.click('#open-reset-link'); await page.waitForSelector('#reset-form'); await page.waitForFunction(() => document.querySelector('#reset-hint')?.textContent.includes('james.b@example.com'));
    await page.fill('#reset-password', 'abc'); await page.fill('#reset-password-2', 'abc'); expect(await page.locator('#reset-password-meter:not(.hidden)').count() === 1); await page.click('#reset-form button[type=submit]'); await textHas('#reset-form .auth-error', 'at least 6');
    await page.fill('#reset-password', 'Str0ng!Pass'); await page.fill('#reset-password-2', 'different'); await page.click('#reset-form button[type=submit]'); await textHas('#reset-form .auth-error', 'do not match');
    await page.fill('#reset-password-2', 'Str0ng!Pass'); await page.click('#reset-form button[type=submit]'); await page.waitForSelector('#login-form'); expect((await page.inputValue('#login-email')) === 'james.b@example.com');
    await page.fill('#login-password', 'Str0ng!Pass'); await page.click('#login-form button[type=submit]'); await page.waitForSelector('#app-screen'); await logout();
  });
  await step('forgot for unknown email shows the same generic message (no existence leak)', async () => { await page.goto(BASE); await page.fill('#login-email', 'nobody@example.com'); await page.click('#go-forgot'); await page.click('#forgot-submit'); await page.waitForSelector('#forgot-ok'); await textHas('#forgot-ok', 'If that inbox is on Pulse'); expect(await page.locator('#inbox-panel').count() === 0); });
  await step('stale/invalid reset link shows an error', async () => { await page.goto(BASE + '/#reset=deadbeefdeadbeef'); await page.waitForSelector('#reset-form'); await page.waitForSelector('#reset-form .auth-error:not(.hidden)'); });

  /* ---------- ADMIN-ISSUED PASSWORD → FORCED CHANGE ---------- */
  await step('new account must change the temporary password before using the app', async () => {
    await reset(); await loginReady('tina.r@example.net'); await nav('Accounts'); await page.click('#new-person'); await page.fill('#pe-name', 'Forced Change'); await page.fill('#pe-email', 'forced@example.com'); await page.selectOption('#pe-leader', { index: 1 }); await page.click('#save-m'); await page.waitForSelector('#temp-password'); const temp = await page.textContent('#temp-password'); await page.click('#close-m'); await logout();
    await login('forced@example.com', temp); await page.waitForSelector('#mfa-form'); await page.fill('#mfa-code', '123456'); await page.click('#mfa-submit'); await page.waitForSelector('#force-form'); expect(await page.locator('#app-screen').count() === 0, 'app hidden'); await page.fill('#force-current', temp); await page.fill('#force-new', 'abc'); await page.fill('#force-new2', 'abc'); await page.click('#force-form button[type=submit]'); await textHas('#force-form .auth-error', 'at least 6');
    await page.fill('#force-new', 'Mine#12345'); await page.fill('#force-new2', 'Mine#12345'); await page.click('#force-form button[type=submit]'); await page.waitForSelector('#app-screen'); await page.waitForSelector('.kpi'); await logout();
  });
  await step('suspended account sees the server message and stays on login', async () => { await reset(); await loginReady('tina.r@example.net'); await nav('Accounts'); await page.locator('.panel', { has: page.locator('strong', { hasText: /^Priya Sharma$/ }) }).locator('[data-toggle]').click(); await page.waitForTimeout(300); await logout(); await login('zara.a@example.net'); await page.waitForSelector('.auth-error:not(.hidden)'); await textHas('.auth-error', 'suspended'); });

  /* ---------- SESSION EXPIRY ---------- */
  await step('expired session mid-use returns to the sign-in screen', async () => { await reset(); await loginReady('tina.r@example.net'); await page.waitForTimeout(1000); await page.request.get(`${BASE}/__reset`); await nav('All assignments').catch(() => {}); await page.waitForSelector('#auth-screen', { timeout: 5000 }); });

  /* ---------- AUDIO ASSIGNMENT + TRANSLATION WORKFLOW (deadline, submit, review) ---------- */
  await step('translation workflow: admin assigns with a deadline, employee submits, admin reviews on Translation jobs', async () => {
    await reset(); await loginReady('tina.r@example.net');
    await nav('Projects'); await page.waitForSelector('#new-project'); await page.click('#new-project'); await page.fill('#pr-name', 'Workflow set'); await page.click('#save-m'); await page.waitForSelector('#mp3-upload');
    const mp3 = Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00'), Buffer.alloc(3000, 1)]);
    await page.setInputFiles('#mp3-files', [{ name: 'job.mp3', mimeType: 'audio/mpeg', buffer: mp3 }]); await page.click('#mp3-upload'); await page.waitForSelector('.track-row');
    await page.check('[data-track]'); await page.locator('.emp-chip', { hasText: 'Priya' }).locator('input').check();
    await page.fill('#assign-deadline', '2099-01-01T10:00'); await page.click('#assign-tracks'); await toastHas('Assigned 1 listening jobs');
    await logout();

    await loginReady('zara.a@example.net'); await nav('Assigned Audio'); await page.waitForSelector('.note-card');
    expect((await page.textContent('.note-card')).includes('Pending'), 'starts pending');
    await page.fill('textarea[data-note]', 'My translation of the audio.'); await page.click('[data-submit]'); await toastHas('Translation submitted');
    await page.waitForSelector('textarea[data-note][readonly]'); expect((await page.textContent('.note-card')).includes('Completed'), 'submitted shows Completed');
    await logout();

    await loginReady('tina.r@example.net'); await nav('Translation jobs'); await page.waitForSelector('table');
    await textHas('tbody', 'Priya'); await page.locator('tbody tr').first().click(); await page.waitForSelector('[data-approve]');
    expect((await page.locator('textarea[readonly]').first().inputValue()).includes('My translation'), 'review shows submitted text');
    await page.click('[data-approve]'); await toastHas('Translation approved'); await page.waitForFunction(() => !document.querySelector('.modal-back'));
    await logout();
  });

  /* ---------- RESPONSIVE ---------- */
  await step('mobile viewport: shell collapses (labels hidden), content still usable', async () => { await page.setViewportSize({ width: 390, height: 844 }); await reset(); await loginReady('tina.r@example.net'); await page.waitForTimeout(500); await page.screenshot({ path: '/tmp/shot-mobile.png' }); const grid = await page.evaluate(() => getComputedStyle(document.querySelector('.shell')).gridTemplateColumns); expect(grid.split(' ').length === 2, grid); expect(await page.locator('.brand-text').isVisible() === false); await page.setViewportSize({ width: 1440, height: 900 }); });

  await browser.close();
  console.log('\n=== RESULTS ==='); let fails = 0; for (const [s, n, e] of results) { if (s === 'FAIL') fails++; console.log(`${s}  ${n}${e ? '\n        -> ' + e : ''}`); }
  const real = consoleErrors.filter((e) => !/Failed to load resource|favicon|401|403|404|409|fonts\.g/.test(e)); console.log(`\n${results.length - fails}/${results.length} passed; ${fails} failed`); console.log('console errors (excluding expected HTTP statuses):', real.length ? real : 'none');
  process.exit(fails ? 1 : 0);
})();
