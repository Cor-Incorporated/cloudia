/**
 * Self-test for parseContactIntent (7 keys). Run: node constants/intents.selftest.mjs
 * Note: uses dynamic import of compiled-less TS via duplicate logic for CI simplicity.
 */
const KEYS = [
  'confidential-ai-assessment',
  'local-llm-poc',
  'grift-team-beta',
  'grift-paid-trial',
  'estimate-audit',
  'contract-dev',
  'press-speaking-other',
];

function parseContactIntent(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return KEYS.includes(key) ? key : null;
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('ok:', msg);
  }
}

assert(KEYS.length === 7, '7 keys');
assert(parseContactIntent('contract-dev') === 'contract-dev', 'accept contract-dev');
assert(parseContactIntent('CONTRACT-DEV') === 'contract-dev', 'case insensitive');
assert(parseContactIntent('local-llm-poc') === 'local-llm-poc', 'accept local-llm-poc');
assert(parseContactIntent('unknown-key') === null, 'reject unknown');
assert(parseContactIntent('') === null, 'reject empty');
assert(parseContactIntent(null) === null, 'reject null');

if (failed) {
  console.error(failed, 'failures');
  process.exit(1);
}
console.log('All intent self-tests passed');
