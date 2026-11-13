'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function normalized(p) { return process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p); }
function contains(a, b) { const r = path.relative(normalized(a), normalized(b)); return !r || (!r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r)); }
function overlap(a, b) { return contains(a, b) || contains(b, a); }
async function directory(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p) || p.includes('\0')) throw new Error('폴더의 전체 경로가 필요합니다.');
  if (process.platform === 'win32' && (/^\\\\/.test(p) || !/^[A-Za-z]:\\/.test(p))) throw new Error('이 시험판은 Windows 로컬 드라이브와 외장 드라이브만 지원합니다.');
  let cursor = path.resolve(p);
  while (true) {
    const stat = await fs.lstat(cursor);
    if (stat.isSymbolicLink()) throw new Error('연결 폴더·정션 대신 실제 폴더를 선택해 주세요.');
    if (!stat.isDirectory()) throw new Error('폴더를 선택해 주세요.');
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return fs.realpath(p);
}
async function atomic(file, data) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temp, file);
}
async function validateSources(sources, forbidden) {
  if (!Array.isArray(sources) || !sources.length || sources.length > 30) throw new Error('백업할 폴더를 1~30개 선택해 주세요.');
  const result = [];
  for (const source of sources) {
    const real = await directory(source);
    if (forbidden.some(p => overlap(real, p))) throw new Error('작업 폴더와 백업·앱 보관 폴더가 겹칩니다. 별도 폴더를 선택해 주세요.');
    if (result.some(p => overlap(p, real))) throw new Error('서로 포함되는 작업 폴더는 하나만 선택해 주세요.');
    await fs.readdir(real); // A missing or inaccessible root cannot become an empty successful backup.
    result.push(real);
  }
  return result;
}
/** Each place as given and, when it exists, as it really is (an 8.3 short name spelled out), so a place chosen
 *  by its real path still meets it (GPT workbackup-notify GA1). */
async function spellings(list) {
  const out = [];
  for (const p of list) {
    const given = path.resolve(p); if (!out.includes(given)) out.push(given);
    try { const real = await fs.realpath(given); if (!out.includes(real)) out.push(real); } catch { }
  }
  return out;
}
module.exports = { directory, overlap, contains, normalized, atomic, validateSources, spellings };
