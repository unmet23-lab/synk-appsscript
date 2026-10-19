// esbuild 묶음을 「// <경로>」 모듈 칸으로 나눠 비교한다: (a) 바탕 빌드 ↔ v48 운영, (a) ↔ (b) 새 판.
const fs = require('fs');
const path = require('path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
// 모듈 칸 머리: 줄 전체가 「// 경로」이고 경로에 확장자가 있는 줄
const MARK = /^\/\/ ((?:\.\.\/|lib\/|synk-)[^\s]+\.(?:mjs|js|cjs)(?:\?v=[\w-]+)?)$/;
function slots(text) {
  const lines = text.split('\n'), out = []; let cur = { key: '(머리)', start: 0, lines: [] };
  lines.forEach((line, i) => { const m = MARK.exec(line); if (m) { out.push(cur); cur = { key: m[1], start: i, lines: [] }; } cur.lines.push(line); });
  out.push(cur);
  return out.map(s => ({ key: s.key, start: s.start, text: s.lines.join('\n') }));
}
const A = slots(read('bundle-a.js')), B = slots(read('bundle-b.js')), V = slots(read('v48-bundle.js'));
const map = list => { const m = new Map(); for (const s of list) { if (m.has(s.key)) m.set(s.key + '#2', s); else m.set(s.key, s); } return m; };
const a = map(A), b = map(B), v = map(V);
console.log('칸 수 — a', A.length, 'b', B.length, 'v48', V.length);
console.log('\n[a ↔ v48] 같은 칸 / 다른 칸 / 한쪽에만');
const keysAV = [...new Set([...a.keys(), ...v.keys()])];
for (const k of keysAV) { const x = a.get(k), y = v.get(k); const st = !x ? 'v48에만' : !y ? 'a에만' : x.text === y.text ? '같음' : `다름(a ${x.text.length}B · v48 ${y.text.length}B)`; if (st !== '같음' || /path-travel|atlas\//.test(k)) console.log(' ', st.padEnd(28), k); }
console.log('\n[a ↔ b] 다른 칸');
const keysAB = [...new Set([...a.keys(), ...b.keys()])];
for (const k of keysAB) { const x = a.get(k), y = b.get(k); if (!x || !y || x.text !== y.text) console.log(' ', !x ? 'b에만' : !y ? 'a에만' : `다름(a ${x.text.length}B · b ${y.text.length}B)`, k); }
// 순서 비교(칸 순서가 같아야 옮겨 심기가 쉽다)
console.log('\n순서 a', A.map(s => s.key).filter(k => /path-travel/.test(k)).join(' > '));
console.log('순서 b', B.map(s => s.key).filter(k => /path-travel/.test(k)).join(' > '));
console.log('순서 v', V.map(s => s.key).filter(k => /path-travel/.test(k)).join(' > '));
