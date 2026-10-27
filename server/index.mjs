import { buildApp } from './app.mjs';
import { readConfig } from './config.mjs';
const config = readConfig();
const app = await buildApp(config);
// Loopback by default; tenant config may opt into pod networking behind approved HTTPS ingress.
await app.listen({ host: config.listenHost, port: 3000 });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); process.exit(0); });
