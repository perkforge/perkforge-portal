import { buildApp } from './app.mjs';
import { readConfig } from './config.mjs';
const app = await buildApp(readConfig());
// Loopback only: an approved HTTPS reverse proxy must terminate browser TLS.
await app.listen({ host: '127.0.0.1', port: 3000 });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); process.exit(0); });
