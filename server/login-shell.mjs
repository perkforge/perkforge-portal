// Public bootstrap only: no imports from the compiled application or model.
export const loginHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PerkForge · Sign in</title><script src="/auth/bootstrap.js" defer></script></head><body><main><h1>PerkForge Portal</h1><p>Sign in to open your workspace and architecture documents.</p><button id="login" disabled>Sign in with Keycloak</button><p id="status" role="status">Checking sign-in availability…</p></main></body></html>`;
export const loginScript = `const button = document.getElementById('login');
const status = document.getElementById('status');
let session;
async function json(path, init) {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Sign-in is unavailable. Reload to try again.');
  return response.json();
}
json('/auth/session').then(value => {
  session = value;
  if (value.authenticated) { location.reload(); return; }
  button.disabled = !value.loginConfigured;
  status.textContent = value.loginConfigured ? '' : 'Identity is not configured. Sign-in is currently unavailable.';
}).catch(error => { status.textContent = error.message; });
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const result = await json('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf }, body: JSON.stringify({ returnTo: '/' }) });
    location.assign(result.authorizationUrl);
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});`;
