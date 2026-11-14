// Local operator preview only: JSON input on stdin, JSON result on stdout.
// No filesystem writes, network, credentials, executable manifests or API route.
import { previewEnrollmentChange } from '../server/enrollment-preview.mjs';
let input = '';
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 262144) throw new Error('Input too large');
  }
  const result = previewEnrollmentChange(JSON.parse(input));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'blocked') process.exitCode = 2;
} catch {
  process.stderr.write('Invalid preview input; no changes made.\n');
  process.exitCode = 2;
}
