// Operator-PC secret store for stage-1 test keys (Windows only). Each value is
// DPAPI-protected for the current Windows user and kept outside the repository
// (%LOCALAPPDATA%\SynkWorkBackupStage1\secrets.json). Values cross the process
// boundary only through stdin/stdout of a child pwsh, never on a command line.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const ROOT = path.join(process.env.LOCALAPPDATA || '', 'SynkWorkBackupStage1');
const FILE = path.join(ROOT, 'secrets.json');
const NAME = /^[a-zA-Z][a-zA-Z0-9-]{0,40}$/;

function pwsh(script, input) {
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 20 });
  if (r.status !== 0) throw new Error('DPAPI_FAILED');
  return r.stdout.trim();
}
const PROTECT = "$i=[Console]::In.ReadToEnd(); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($i),$null,'CurrentUser'))";
const UNPROTECT = "$i=[Console]::In.ReadToEnd().Trim(); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($i),$null,'CurrentUser'))";

function readAll() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw new Error('SECRET_STORE_CORRUPT'); } }

export function put(name, value) {
  if (!NAME.test(name)) throw new Error('SECRET_NAME_INVALID');
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error('SECRET_NOT_ASCII');
  fs.mkdirSync(ROOT, { recursive: true });
  const all = readAll(); all[name] = { at: new Date().toISOString(), dpapi: pwsh(PROTECT, text) };
  const tmp = FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(all, null, 1), { flag: 'wx' }); fs.renameSync(tmp, FILE);
}
export function get(name, { json = true } = {}) {
  const entry = readAll()[name]; if (!entry) throw new Error(`SECRET_MISSING:${name}`);
  const text = pwsh(UNPROTECT, entry.dpapi);
  return json ? JSON.parse(text) : text;
}
// Moves an already DPAPI-protected blob (e.g. captured from the B2 console) into
// the store without decrypting it, then removes the capture file.
export function importProtected(name, file) {
  if (!NAME.test(name)) throw new Error('SECRET_NAME_INVALID');
  const blob = fs.readFileSync(file, 'utf8').trim();
  if (!/^[A-Za-z0-9+/=]{40,}$/.test(blob)) throw new Error('SECRET_BLOB_INVALID');
  const all = readAll(); all[name] = { at: new Date().toISOString(), dpapi: blob };
  const tmp = FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(all, null, 1), { flag: 'wx' }); fs.renameSync(tmp, FILE); fs.rmSync(file);
}
export function has(name) { return !!readAll()[name]; }
export function remove(name) {
  const all = readAll(); if (!all[name]) return false; delete all[name];
  const tmp = FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(all, null, 1), { flag: 'wx' }); fs.renameSync(tmp, FILE); return true;
}
export function names() { return Object.keys(readAll()); }
