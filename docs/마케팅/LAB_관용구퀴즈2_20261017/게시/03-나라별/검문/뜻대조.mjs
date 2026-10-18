// 검문 결과의 직역 역번역을 한국어 원문 옆에 줄 번호로 붙여 뜻만 빠르게 견준다(10-18). 사람(Claude)이 읽는 대조표다.
//   node 뜻대조.mjs [언어 …]   → 뜻대조.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const D = path.dirname(fileURLToPath(import.meta.url));
const codes = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(D).filter((f) => /^결과_.+\.txt$/.test(f)).map((f) => f.slice(3, -4));
const out = [];
for (const c of codes) {
  const t = fs.readFileSync(path.join(D, `결과_${c}.txt`), 'utf8');
  const ko = t.split('■ 한국어 원문')[1]?.split('■ 직역 역번역')[0] ?? '';
  const back = t.split('■ 직역 역번역 (다듬기 금지 — 원문과 뜻을 견준다)')[1]?.split('\n결과:')[0] ?? '';
  const lines = (s) => Object.fromEntries([...s.matchAll(/^\s*(\d+)\.\s*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
  const K = lines(ko);
  const R = lines(back);
  out.push(`=== ${c}`);
  for (const n of Object.keys(K)) if (Number(n) <= 39) out.push(`${n}. ${K[n]}  ⇄  ${R[n] ?? '(없음)'}`);
}
fs.writeFileSync(path.join(D, '뜻대조.txt'), out.join('\n') + '\n', 'utf8');
console.log(codes.length, '개 언어 → 뜻대조.txt');
