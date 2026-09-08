#!/usr/bin/env node
/**
 * 소급 불가 항목의 «어디를 고치나»를 찾는다 (2026-09-08).
 *
 * ■ 왜 있나 (판정 `docs/소급_판정_0908.md` §1)
 *   색인은 「마감 사건 · 임자 · 무엇이 사라지나」만 적고 **자리를 안 적는다.**
 *   그래서 한 줄을 고치려면 그 줄이 가리키는 코드·시트·문서를 먼저 찾아야 하고,
 *   189줄이면 그 찾기만으로 며칠이 든다. 그 찾기를 기계에게 시킨다.
 *
 * ■ 어떻게
 *   ① 「무엇이 사라지나」에서 «저장소에 있을 법한 이름»을 뽑는다
 *      — 홑화살괄호·따옴표 안의 말, 로마자 식별자, `.js`·`.md` 로 끝나는 것, 시트 칸 이름.
 *   ② 그 이름으로 `git grep` 한다(추적되는 파일만 · node_modules 는 애초에 안 든다).
 *   ③ 후보가 «하나»로 좁혀지면 자리가 선 것이고, 여럿이면 사람이 고른다.
 *
 * 🔴 이 도구는 «찾기»만 한다 — 고치지 않고, 「이게 맞다」고 판정하지도 않는다.
 *    후보를 좁혀 사람 앞에 놓는 것이 전부다.
 *
 * 쓰기:
 *   node tools/소급자리찾기.js                    # 파일럿에 걸린 것만
 *   node tools/소급자리찾기.js --전량              # 189건 전부
 *   node tools/소급자리찾기.js --자리있는것만       # 후보가 잡힌 것만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 색인 = path.join(뿌리, 'docs', '소급불가_색인_2026-09-03.md');

const 인자 = process.argv.slice(2);
const 전량 = 인자.includes('--전량');
const 자리있는것만 = 인자.includes('--자리있는것만');

/* 흔해서 후보를 못 좁히는 말 — 이것만 남으면 «못 찾음»으로 둔다. */
const 너무흔함 = new Set([
  '학생', '강사', '수업', '출석', '숙제', '앱', '시트', '칸', '표', '값', '날', '첫',
  'AI', 'SYNK', 'LAB', '데이터', '기록', '화면', '목표', '점수', '이름', '시간',
]);

function 색인읽기() {
  const s = fs.readFileSync(색인, 'utf8');
  const out = [];
  let 절 = null;
  for (const l of s.split('\n')) {
    if (l.startsWith('### ')) { 절 = l.slice(4).trim(); continue; }
    if (!절 || !l.startsWith('|') || l.split('|').length < 4) continue;
    if (/^\|\s*[-: ]+\|/.test(l) || l.includes('마감 사건') || l.includes('마감일')) continue;
    const 칸 = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (칸.length < 3) continue;
    out.push({ 절, 사건: 칸[0], 임자: 칸[1], 사라짐: 칸.slice(2).join(' ') });
  }
  return out;
}

/** 「무엇이 사라지나」에서 저장소에 있을 법한 이름을 뽑는다. */
function 이름뽑기(글) {
  const 후보 = new Set();
  // 「…」 · «…» · '…' 안의 말
  for (const m of 글.matchAll(/[「『«"']([^」』»"']{2,30})[」』»"']/g)) 후보.add(m[1].trim());
  // 로마자 식별자 (snake_case · camelCase · 파일 이름)
  for (const m of 글.matchAll(/\b([a-zA-Z][a-zA-Z0-9_]{3,}(?:\.[a-z]{2,4})?)\b/g)) 후보.add(m[1]);
  // 백틱 안
  for (const m of 글.matchAll(/`([^`]{2,40})`/g)) 후보.add(m[1].trim());
  return [...후보]
    .map((v) => v.replace(/[,.·]$/, '').trim())
    .filter((v) => v.length >= 3 && !너무흔함.has(v))
    .slice(0, 6);
}

function 훑기(말) {
  try {
    const r = cp.execFileSync('git', ['grep', '-l', '--fixed-strings', '-i', '--', 말],
      { cwd: 뿌리, encoding: 'utf8', maxBuffer: 1 << 22, stdio: ['ignore', 'pipe', 'ignore'] });
    return r.split('\n').filter(Boolean);
  } catch { return []; }             // git grep 은 못 찾으면 종료코드 1 을 낸다
}

const 전부 = 색인읽기();
const 볼것 = 전량 ? 전부
  : 전부.filter((v) => /파일럿|12월|12-07/.test(v.사건));

console.log(`■ ${볼것.length}건에 자리를 찾는다 (전체 ${전부.length}건)\n`);

let 찾음 = 0; let 좁힘 = 0;
const 결과 = [];
for (const v of 볼것) {
  const 이름들 = 이름뽑기(v.사라짐);
  const 자리 = new Map();
  for (const n of 이름들) {
    for (const f of 훑기(n).slice(0, 8)) {
      if (!자리.has(f)) 자리.set(f, []);
      자리.get(f).push(n);
    }
  }
  // 여러 이름이 함께 가리키는 파일이 가장 그럴듯하다
  const 정렬 = [...자리.entries()].sort((a, b) => b[1].length - a[1].length);
  const 뽑은 = 정렬.slice(0, 3);
  if (뽑은.length) 찾음 += 1;
  if (뽑은.length && 뽑은[0][1].length >= 2) 좁힘 += 1;
  결과.push({ ...v, 이름들, 자리: 뽑은 });
}

for (const r of 결과) {
  if (자리있는것만 && !r.자리.length) continue;
  const 표 = r.자리.length ? (r.자리[0][1].length >= 2 ? '🟢' : '🟡') : '⬜';
  console.log(`${표} [${r.절}] ${r.사라짐.slice(0, 74)}`);
  if (r.이름들.length) console.log(`     찾은 말: ${r.이름들.join(' · ')}`);
  for (const [f, ns] of r.자리) console.log(`     → ${f}  (${ns.join('·')})`);
  console.log('');
}

console.log('─'.repeat(60));
console.log(`🟢 두 말 이상이 같은 파일을 가리킨다 ${좁힘}건`);
console.log(`🟡 한 말만 걸렸다 ${찾음 - 좁힘}건`);
console.log(`⬜ 못 찾았다 ${볼것.length - 찾음}건`);
console.log('🔴 이 도구는 «찾기»만 한다 — 맞는지는 사람이 연다.');
