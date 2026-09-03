// v2 기계 자 — 옷만 입혔나(내용·이름 보존)와 읽히나를 잰다. 사용: node docs/_ops/엔진7종_v2/자.js §4  (또는 전부: node 자.js 전부)
// 유호 확정 09-04 「B로 가자」 — 을(정본 몸통)의 U·D·실물 이름·URL·해시·「안 재봤다」가 v2 에 전부 살아 있어야 통과.
const fs = require('fs');
const path = require('path');
const W = path.resolve(__dirname);
const arg = process.argv[2] || '전부';
const secs = arg === '전부' ? Array.from({ length: 17 }, (_, i) => '§' + i) : [arg];
const norm = (s) => s.split('\r\n').join('\n');
const uniq = (a) => [...new Set(a)];
function ex(s) {
  const U = uniq([...s.matchAll(/^#{2,6}\s*(?:\*\*)?U(\d+)\b/gm)].map((m) => 'U' + m[1]));
  const D = uniq([...s.matchAll(/\bD(\d{1,2})(?:\s*별항)?\b/g)].map((m) => 'D' + m[1]));
  const code = uniq([...s.matchAll(/`([^`\n]{2,120})`/g)].map((m) => m[1].trim()));
  const files = uniq([...s.matchAll(/[A-Za-z0-9_가-힣./-]+\.(?:js|ts|tsx|json|jsonl|md|sql|yml|yaml|html|py|wav|mp3|sh|csv)\b/g)].map((m) => m[0].replace(/^[./]+/, '')));
  const urls = uniq([...s.matchAll(/https?:\/\/[^\s)>\]」』]+/g)].map((m) => m[0]));
  const hashes = uniq([...s.matchAll(/\b(?=[0-9a-f]*[a-f])[0-9a-f]{7,10}\b/g)].map((m) => m[0]));
  const notMeasured = (s.match(/안 재봤/g) || []).length;
  const lines = s.split('\n').filter((l) => l.trim());
  const bytes = Buffer.byteLength(s);
  const lens = lines.map((l) => Buffer.byteLength(l));
  const long = lens.filter((b) => b > 400).length;
  const nested = (s.match(/\([^()]*\(/g) || []).length;
  const dash = (s.match(/ — /g) || []).length;
  return { U, D, code, files, urls, hashes, notMeasured, bytes, lines: lines.length, avg: Math.round(bytes / Math.max(1, lines.length)), max: Math.max(...lens, 0), long, nested, dash };
}
let fail = 0;
for (const sec of secs) {
  const a = W + '/재료/을/' + sec + '.md', b = W + '/v2/' + sec + '.md';
  if (!fs.existsSync(b)) { console.log(sec, '— v2 없음'); continue; }
  const A = ex(norm(fs.readFileSync(a, 'utf8'))), B = ex(norm(fs.readFileSync(b, 'utf8')));
  const missing = (k, strict) => { const bs = new Set(B[k].map((x) => x.toLowerCase())); return A[k].filter((x) => !bs.has(x.toLowerCase())); };
  const mU = A.U.filter((u) => !B.U.includes(u)), xU = B.U.filter((u) => !A.U.includes(u));
  const mD = missing('D'), mC = missing('code'), mF = missing('files'), mUrl = missing('urls'), mH = missing('hashes');
  const nm = B.notMeasured < Math.floor(A.notMeasured * 0.9);
  const hard = mU.length + xU.length + mD.length + mC.length + mF.length + mUrl.length + mH.length + (nm ? 1 : 0);
  const ok = hard === 0;
  if (!ok) fail++;
  console.log(`${ok ? '✅' : '🔴'} ${sec} — 을 ${A.bytes}B/${A.lines}줄(줄당 ${A.avg}) → v2 ${B.bytes}B/${B.lines}줄(줄당 ${B.avg} · 최장 ${B.max} · 400B↑ ${B.long}줄 · 괄호속괄호 ${B.nested} · 긴줄표 ${B.dash}) · 안 재봤다 ${A.notMeasured}→${B.notMeasured}`);
  if (mU.length || xU.length) console.log('   U 빠짐/새로 생김:', mU.join(' '), '/', xU.join(' '));
  if (mD.length) console.log('   D 빠짐:', mD.join(' '));
  if (mC.length) console.log('   백틱 이름 빠짐(' + mC.length + '):', mC.slice(0, 12).join(' | ') + (mC.length > 12 ? ' …' : ''));
  if (mF.length) console.log('   파일 이름 빠짐(' + mF.length + '):', mF.slice(0, 12).join(' | ') + (mF.length > 12 ? ' …' : ''));
  if (mUrl.length) console.log('   URL 빠짐(' + mUrl.length + '):', mUrl.slice(0, 6).join(' | ') + (mUrl.length > 6 ? ' …' : ''));
  if (mH.length) console.log('   커밋 해시 빠짐:', mH.join(' '));
  if (nm) console.log('   「안 재봤다」가 10% 넘게 줄었다 —', A.notMeasured, '→', B.notMeasured);
  if (B.avg > 170) console.log('   ⚠ 줄당 평균이 170B 를 넘는다(갑 103 · 을 246) — 더 끊어야 한다');
}
console.log(fail ? `🔴 실패 ${fail}절` : '✅ 잰 절 전부 통과');
process.exit(fail ? 1 : 0);
