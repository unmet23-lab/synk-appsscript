// Runtime configuration from environment variables and secret files. Secret
// values are read from files only (compose `secrets:` mounts them under
// /run/secrets), never from the environment, so `docker inspect` and process
// listings do not show them. Bucket names and account ids come from the runtime
// env file outside the repository (the repository is public).
import fs from 'node:fs';

export function secretFile(name, { env = process.env, json = false } = {}) {
  const file = env[`WB_SECRET_${name}`] || `/run/secrets/${name.toLowerCase().replace(/_/g, '-')}`;
  let text;
  try { text = fs.readFileSync(file, 'utf8').trim(); } catch { throw new Error(`SECRET_MISSING:${name}`); }
  if (!text) throw new Error(`SECRET_EMPTY:${name}`);
  if (!json) return text;
  try { return JSON.parse(text); } catch { throw new Error(`SECRET_FORMAT:${name}`); }
}

export function need(name, { env = process.env, pattern } = {}) {
  const v = env[name];
  if (typeof v !== 'string' || !v) throw new Error(`CONFIG_MISSING:${name}`);
  if (pattern && !pattern.test(v)) throw new Error(`CONFIG_INVALID:${name}`);
  return v;
}

export const PREFIX = /^c\/[a-z0-9]{16}\/$/;
export const BUCKET_ID = /^[a-f0-9]{8,64}$/;
export const KEY_ID = /^[A-Za-z0-9_-]{8,256}$/;
