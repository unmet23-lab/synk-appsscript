// Runtime configuration from environment variables, one settings file and secret
// files. Secret values are read from files only, never from the environment, so
// `docker inspect` and process listings do not show them. Bucket names and account
// ids come from the settings file outside the repository (the repository is public).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

// On the company host each service mounts only its own folder on the persistent disk
// (server/README.md); its secrets are files in WB_SECRETS_DIR, named like `wb-keys-rpc`.
export function secretFile(name, { env = process.env, json = false } = {}) {
  const file = env[`WB_SECRET_${name}`] || path.join(env.WB_SECRETS_DIR || '/run/secrets', name.toLowerCase().replace(/_/g, '-'));
  let text;
  try { text = fs.readFileSync(file, 'utf8').trim(); } catch { throw new Error(`SECRET_MISSING:${name}`); }
  if (!text) throw new Error(`SECRET_EMPTY:${name}`);
  if (!json) return text;
  try { return JSON.parse(text); } catch { throw new Error(`SECRET_FORMAT:${name}`); }
}

// Non-secret settings (endpoint, bucket and its id, Google client ids, operator address)
// sit in one KEY=VALUE file next to the data, outside the repository (it is public).
// Only WB_ names are taken and never secrets; the environment wins over the file.
export function withSettings(env = process.env) {
  if (!env.WB_SETTINGS) return env;
  let text;
  try { text = fs.readFileSync(env.WB_SETTINGS, 'utf8'); } catch { throw new Error('CONFIG_MISSING:WB_SETTINGS'); }
  const file = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(WB_[A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m || m[1].startsWith('WB_SECRET') || m[1] === 'WB_SETTINGS') throw new Error('CONFIG_INVALID:WB_SETTINGS');
    file[m[1]] = m[2];
  }
  return { ...file, ...env };
}

export function need(name, { env = process.env, pattern } = {}) {
  const v = env[name];
  if (typeof v !== 'string' || !v) throw new Error(`CONFIG_MISSING:${name}`);
  if (pattern && !pattern.test(v)) throw new Error(`CONFIG_INVALID:${name}`);
  return v;
}

// The address a role listens on. Unset keeps all addresses (the container case). On the
// company host the api takes the wb-front bridge address and the two workers loopback.
export function listenHost(env = process.env) {
  const v = env.WB_HOST;
  if (v === undefined || v === '') return '0.0.0.0';
  if (!net.isIPv4(v)) throw new Error('CONFIG_INVALID:WB_HOST');
  return v;
}

export const PREFIX = /^c\/[a-z0-9]{16}\/$/;
export const BUCKET_ID = /^[a-f0-9]{8,64}$/;
export const KEY_ID = /^[A-Za-z0-9_-]{8,256}$/;
