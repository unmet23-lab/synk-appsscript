'use strict';
// Synthetic data D1 and process memory readers for the T7 measures (STAGE1_DESIGN.md 4.3):
// small notes, medium pictures and large model files of deterministic bytes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function stream(seed, n) { const b = Buffer.alloc(n); let o = 0, i = 0; while (o < n) { const h = crypto.createHash('sha256').update(`${seed}:${i++}`).digest(); h.copy(b, o); o += h.length; } return b; }
function makeData(dir, dataMB = 300) {
  const put = (rel, buf) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };
  let bytes = 0, files = 0; const target = dataMB * 1024 * 1024;
  for (let i = 0; i < 2000 && bytes < target * 0.2; i++) { const n = 1024 + (i * 7919) % 64512; put(`작은/${Math.floor(i / 100)}/메모-${i}.txt`, stream(`s${i}`, n)); bytes += n; files++; }
  for (let i = 0; bytes < target * 0.65; i++) { const n = (1 + i % 8) * 1024 * 1024; put(`중간/사진-${i}.bin`, stream(`m${i}`, n)); bytes += n; files++; }
  for (let i = 0; bytes < target; i++) { const n = Math.min(100 * 1024 * 1024, target - bytes); put(`큰/model-${i}.bin`, stream(`b${i}`, n)); bytes += n; files++; }
  return { files, bytes };
}
function peakWorkingSet(pid) {
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${pid}).PeakWorkingSet64`], { encoding: 'utf8', windowsHide: true });
  return Number(String(r.stdout).trim()) || null;
}
function memory(pid) {
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-Command', `$p=Get-Process -Id ${pid}; '{0} {1} {2}' -f $p.WorkingSet64,$p.PeakWorkingSet64,$p.PrivateMemorySize64`], { encoding: 'utf8', windowsHide: true });
  const [ws, peak, priv] = String(r.stdout).trim().split(' ').map(Number); const mb = (v) => +(v / 1048576).toFixed(1);
  return { workingSetMB: mb(ws), peakWorkingSetMB: mb(peak), privateMB: mb(priv) };
}

module.exports = { makeData, peakWorkingSet, memory };
