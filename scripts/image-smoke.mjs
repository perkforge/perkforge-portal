import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildApp } from '/app/server/app.mjs';
import { readConfig } from '/app/server/config.mjs';
assert.equal(process.getuid(), 1000);
for (const path of ['/app/.env', '/app/.git', '/app/.secrets', '/app/tests', '/app/src']) {
  assert.equal(existsSync(path), false, `Unexpected image content: ${path}`);
}
const app = await buildApp(readConfig({}));
try {
  for (const [url, status] of [['/healthz', 200], ['/', 200], ['/api/tenants', 401], ['/bff/tenants', 401]]) {
    assert.equal((await app.inject({ url })).statusCode, status, url);
  }
} finally {
  await app.close();
}
