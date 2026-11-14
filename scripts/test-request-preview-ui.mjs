// Local Chromium QA against built assets with synthetic responses only.
// Requires the repository's installed Playwright and its existing Chromium cache.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:4178';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* local startup */ } await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'local built app started');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  let configured = false; let sent = 0; let respond;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/session') return json({ authenticated: true, csrf: 'synthetic', user: { name: 'Fixture admin' }, expiresAt: Date.now() + 600000 });
    if (url.pathname === '/bff/tenants') return json({ source: { mode: 'disabled', path: '/fixture' }, tenants: [] });
    if (url.pathname === '/bff/enrollment') return route.fulfill({ status: 403, body: '{}' });
    if (url.pathname === '/bff/tenant-requests/capability') return json({ configured, authorized: true, mode: 'preview-only' });
    if (url.pathname === '/bff/tenant-requests/preview') {
      sent++; const body = route.request().postDataJSON(); assert.equal(body.tenant, 'home');
      assert.equal(route.request().headers()['x-csrf-token'], 'synthetic');
      const answer = await new Promise(resolve => { respond = resolve; });
      try { return await route.fulfill({ status: answer.status || 200, contentType: 'application/json', body: JSON.stringify(answer.body) }); } catch { return; }
    }
    return route.continue();
  });
  const panel = page.getByRole('region', { name: 'Membership request preview' });
  const open = page.getByRole('button', { name: 'Review membership change' });
  const dialog = page.getByRole('dialog');
  const waitSent = async count => { await page.waitForFunction(() => true); for (let i = 0; sent < count && i < 50; i++) await page.waitForTimeout(20); assert.equal(sent, count); };
  const fill = async () => { await page.getByLabel('Tenant context', { exact: true }).fill('home'); await page.getByLabel('Reviewed subject ID').fill('00000000-0000-4000-8000-000000000100'); };
  const answer = (status = 'proposal', reason = 'review-required') => ({ status, reason, persisted: false, submitted: false, writable: false, readyToSubmit: false });
  await page.goto(origin); await panel.getByText('Request previews are not configured.', { exact: false }).waitFor(); assert.equal(await open.isEnabled(), false);
  configured = true; await page.reload(); await open.waitFor(); await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Review membership change').disabled);
  await open.click(); await fill();
  await page.getByRole('button', { name: 'Preview change', exact: true }).evaluate(button => { button.click(); button.click(); });
  await waitSent(1); assert.equal(await page.getByRole('button', { name: 'Checking preview…' }).isEnabled(), false);
  respond({ body: answer() }); await dialog.getByText('Draft preview only:', { exact: false }).waitFor();
  await page.screenshot({ path: '/tmp/portal-membership-preview-ui.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await dialog.boundingBox()).width <= 390);
  await page.screenshot({ path: '/tmp/portal-membership-preview-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(await dialog.isVisible(), false);
  await open.click(); assert.equal(await page.getByLabel('Reviewed subject ID').inputValue(), ''); await fill();
  await page.getByRole('button', { name: 'Preview change', exact: true }).click(); await waitSent(2); const oldResponse = respond;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await open.click();
  oldResponse({ body: answer() }); await page.waitForTimeout(100); assert.equal(await dialog.getByText('Draft preview only:', { exact: false }).count(), 0);
  await fill(); await page.getByRole('button', { name: 'Preview change', exact: true }).click(); await waitSent(3);
  respond({ status: 409, body: answer('blocked', 'reviewed-context-unavailable') }); await dialog.getByText('Reviewed context is missing, stale', { exact: false }).waitFor();
  await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), false);
  await open.click(); assert.equal(await page.getByLabel('Tenant context', { exact: true }).inputValue(), '');
  await page.evaluate(() => { location.hash = '#/workspace'; }); await dialog.waitFor({ state: 'hidden' });
  await page.goBack(); assert.equal(await dialog.isVisible(), false);
  await open.click(); await fill(); await page.getByRole('button', { name: 'Preview change', exact: true }).click(); await waitSent(4);
  respond({ status: 503, body: {} }); await dialog.getByText('Request previews are unavailable. Nothing was saved or submitted.').waitFor();
  console.log('PASS: real built UI default-off, preview, duplicate click, cancel/stale response, stale snapshot, Escape, history and unavailable flows; synthetic responses only.');
} finally { await browser?.close(); server.kill(); }
