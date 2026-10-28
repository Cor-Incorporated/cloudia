/**
 * Fail the production bundle if server-only intake secrets or the local
 * gateway client are pulled into browser assets.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const forbidden = [
  /CLOUDIA_LOCAL_LLM_TOKEN/,
  /CLOUDIA_LOCAL_LLM_BASE_URL/,
  /TURNSTILE_SECRET/,
  /BEGIN (?:[A-Z]+ )?PRIVATE KEY/,
  /sk-[A-Za-z0-9]{10,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /\/v1\/chat\/completions/,
  /cloudia-local-intake-spike-v1/,
  /x-cluster-served-model/,
  /llm-gateway/,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|css|html|map)$/.test(name)) out.push(path);
  }
  return out;
}

let files;
try {
  files = walk(dist);
} catch {
  console.error('bundle secret scan: dist/ is missing. Run npm run build first.');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`bundle secret scan hit ${pattern} in ${file}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`bundle secret scan ok (${files.length} files)`);
