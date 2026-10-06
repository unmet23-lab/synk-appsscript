'use strict';
// Shared pieces for the SYNK ID operations scripts in this folder. The Supabase access token is read
// through SYNK-talk's own credential reader (its .env) and never printed or passed on the command line.
// Rehearsal (synk-core-rehearsal) is the default target; production (Synk Core) needs --운영.
const path = require('node:path');

const TALK_ROOT = process.env.SYNK_TALK_ROOT || path.resolve(__dirname, '../../../SYNK-talk');
const credentials = require(path.join(TALK_ROOT, 'lib', '자격증명.js'));

// Public OAuth clients registered for SYNK products (public values, no secret).
const { LEGACY_CLIENT_IDS: CLIENTS, TOOL_REDIRECTS } = require('./registry.cjs');

function target(argv = process.argv) {
  const production = argv.includes('--운영');
  return { production, name: production ? 'production' : 'rehearsal', ref: production ? credentials.운영REF : credentials.리허설REF,
    portalPath: production ? '/id/' : '/id-rehearsal/', apply: argv.includes('--적용') };
}
function token() { return credentials.파일읽기().SUPABASE_ACCESS_TOKEN; }
async function management(ref, suffix = '', init = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${suffix}`, { ...init,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  return response;
}
async function projectName(ref) {
  return management(ref).then(r => r.json()).then(p => p.name).catch(() => '?');
}
// The project's server key for an Auth admin call. Used in memory only.
async function serverKey(ref) {
  const keys = await management(ref, '/api-keys?reveal=true').then(r => r.json());
  const key = (keys.find(k => k.type === 'secret') || keys.find(k => k.name === 'service_role'))?.api_key;
  if (!key) throw new Error('no server key found for the admin call');
  return key;
}
module.exports = { TALK_ROOT, credentials, CLIENTS, TOOL_REDIRECTS, target, management, projectName, serverKey };
