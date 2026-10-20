// Disposable, loopback-only server for checking the customer consultation page (/consultation/) logged out and logged in.
// verify-workspace-fixture.mjs has no customer SYNK ID, so this one adds a synthetic customer identity provider and a
// synthetic AI provider (no central login, no model call, no real keys). Data lives in a temporary folder that is
// removed on stop (send "stop" on stdin; Windows does not deliver SIGINT to a child reliably).
// Usage: TEMP=<own folder> TMP=<own folder> node qa/verify-consultation-fixture.mjs [port]
// Prints one JSON line: { base, issuer, users, directory }. A browser that opens `${issuer}/auth/v1/oauth/authorize`
// must be routed back to the callback with the same state and one of `users` as the code (see verify-consultation-browser.mjs).
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createCompanyApp } from '../server.mjs';

const port = Number(process.argv[2] || 47811);
const origin = `http://localhost:${port}`, issuer = 'https://identity.example.test';
const sessionId = '33333333-3333-4333-8333-333333333333';
const config = { accountApiUrl: issuer + '/functions/v1/synk-account', publishableKey: 'sb_publishable_synthetic_fixture', issuer,
  clientId: 'customer-browser-fixture', redirectUri: origin + '/api/customer/synk-id/callback' };
const names = { '11111111-1111-4111-8111-111111111111': '하늘', '22222222-2222-4222-8222-222222222222': '바다' };
const directory = await mkdtemp(join(tmpdir(), 'synk-consultation-review-'));
const now = () => Date.now();
function token(id) {
  const t = Math.floor(now() / 1000);
  return 'synthetic.' + Buffer.from(JSON.stringify({ iss: issuer + '/auth/v1', sub: id, session_id: sessionId, client_id: config.clientId, iat: t - 1, exp: t + 3600 })).toString('base64url') + '.fixture';
}
let refreshCount = 0;
async function identityFetch(url, init = {}) {
  url = String(url);
  if (url.endsWith('/oauth/token')) {
    const body = new URLSearchParams(init.body), refresh = body.get('grant_type') === 'refresh_token';
    if (refresh) refreshCount++;
    const id = refresh ? body.get('refresh_token').split(':')[1] : body.get('code');
    return Response.json({ access_token: token(id), refresh_token: 'synthetic-refresh:' + id + ':' + refreshCount, token_type: 'bearer' });
  }
  if (url.includes('/logout?scope=local')) return new Response(null, { status: 204 });
  if (init.method === 'POST') return Response.json({ ok: true, current: true });
  const claims = JSON.parse(Buffer.from(init.headers.Authorization.split('.')[1], 'base64url'));
  return Response.json({ ok: true, account: { synk_user_id: claims.sub, status: 'active', profile: { display_name: names[claims.sub] || '고객' } },
    sessions: [{ id: sessionId, current: true, revoked: false, product: 'platform' }] });
}
// Synthetic AI: proposes conditions only for these example sentences, quoting them exactly.
const SAMPLES = [
  { quote: '저는 프리미어로 4K 영상을 편집해요.', proposals: [['uses.video', true], ['video.app', 'premiere'], ['video.res', '4k']] },
  { quote: '지금 컴퓨터는 램 16GB예요.', proposals: [['current.ram', '16']] },
];
async function provider(_url, init) {
  const body = String(init?.body || ''), proposals = [];
  for (const sample of SAMPLES) if (body.includes(sample.quote))
    for (const [field, value] of sample.proposals) proposals.push({ field, value, subject: 'self', stance: 'current', evidence: [{ quote: sample.quote, occurrence: 1 }] });
  await new Promise(done => setTimeout(done, Number(process.env.FIXTURE_AI_DELAY_MS || 900)));
  return Response.json({ model: 'gpt-6-luna', status: 'completed', usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 },
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ proposals, held: [] }) }] }] });
}
const env = { SYNK_COMPUTER_AI_ENABLED: '1', SYNK_COMPUTER_AI_MODEL: 'gpt-6-luna', SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS: '3000',
  SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD: '125000', SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD: '500000',
  SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD: '10000', SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD: '250000',
  SYNK_COMPUTER_AI_CUSTOMER_ENABLED: '1', SYNK_COMPUTER_AI_CUSTOMER_DAILY_REQUESTS: '5', SYNK_COMPUTER_AI_CUSTOMER_DAILY_MICRO_USD: '50000',
  OPENAI_API_KEY: 'synthetic-provider-key-never-sent' };
const loginOff = process.env.FIXTURE_LOGIN === 'off';
const app = createCompanyApp({ dataDir: directory, host: '127.0.0.1', port, origin, schedule: false, synkIdentityConfig: null,
  synkCustomerIdentityConfig: loginOff ? null : config, synkCustomerIdentityFetch: identityFetch, synkCustomerIdentityNow: now,
  computerAIEnv: name => env[name], computerAIFetch: provider,
  messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });
let stopping;
async function stop() {
  if (stopping) return stopping;
  stopping = (async () => {
    await app.stop();
    const target = resolve(directory), prefix = resolve(tmpdir()) + sep;
    if (!target.startsWith(prefix) || !target.split(sep).at(-1).startsWith('synk-consultation-review-')) throw Error('Unexpected fixture path');
    await rm(target, { recursive: true, force: true });
  })();
  return stopping;
}
process.on('SIGINT', () => void stop().then(() => process.exit(0)));
process.on('SIGTERM', () => void stop().then(() => process.exit(0)));
process.stdin.on('data', chunk => { if (String(chunk).trim() === 'stop') void stop().then(() => process.exit(0)); });
await app.start();
console.log(JSON.stringify({ base: origin + '/consultation/', issuer, users: Object.keys(names), directory, login: loginOff ? 'off' : 'on' }));
