#!/usr/bin/env node
/**
 * 소급 불가 실행표 — 재료에 이미 있는 «자리»를 꺼내 급한 순으로 세운다 (2026-09-08).
 *
 * ■ 왜 있나 (09-08 에 알아낸 것)
 *   색인 마크다운(`docs/소급불가_색인_2026-09-03.md`)은 「마감 사건 · 임자 · 무엇이 사라지나」
 *   세 칸만 옮기고 **`source`(어디를 고치나) 칸을 버렸다.** 그래서 「자리가 없다」로 보였다.
 *   재료 `docs/_ops/소급불가_울트라/전량.json` 에는 **194건 전부**에 파일·줄까지 적혀 있다.
 *   🔑 자리는 처음부터 있었다 — 옮기는 자리에서 떨어졌을 뿐이다.
 *
 * ■ 무엇을 내나
 *   급한 순(파일럿 → 개원 → 그 밖)으로 「무엇이 사라지나 · 어디를 고치나 · 임자 · 확신」을 낸다.
 *   `--md` 를 주면 문서로 낸다.
 *
 * 쓰기:
 *   node tools/소급실행표.js                  # 파일럿에 걸린 것
 *   node tools/소급실행표.js --임자 machine    # 내가 고칠 것만
 *   node tools/소급실행표.js --전량 --md > docs/소급_실행표_0908.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 재료 = path.join(뿌리, 'docs', '_ops', '소급불가_울트라', '전량.json');

const 인자 = (() => {
  const a = process.argv.slice(2);
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) o[a[i].slice(2)] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : true;
    else o._.push(a[i]);
  }
  return o;
})();

const 임자말 = { machine: '내가', yuho: '유호님', person: '사람 손' };
const 확신말 = { high: '높다', medium: '보통', low: '낮다' };

/* 🔴 자리가 «이 저장소 밖»을 가리키는 것이 있다 (09-08 인용 검사가 잡았다).
 *   재료의 source 에는 기억 파일 이름(`class-restructure.md` 같은 것)이 섞여 있는데,
 *   기억은 `~/.claude/projects/.../memory/` 에 살아서 저장소 파일이 아니다.
 *   그대로 내면 인용 검사가 「그 파일이 없다」로 잡고, 읽는 사람도 헛다리를 짚는다.
 *   ⇒ 그런 이름은 «어느 층인지»를 붙여서 낸다 — 「고치거나, 지우거나, 그 층엔 없다까지 적는다」(F350). */
const 기억방 = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects');
const 기억이름 = (() => {
  const s = new Set();
  try {
    for (const d of fs.readdirSync(기억방)) {
      const m = path.join(기억방, d, 'memory');
      if (!fs.existsSync(m)) continue;
      for (const f of fs.readdirSync(m)) if (f.endsWith('.md')) s.add(f);
    }
  } catch { /* 기억 폴더가 없는 기계면 그냥 빈 집합 */ }
  return s;
})();

/** source 문자열 안의 «저장소에 없는 파일 이름»에 그 층을 달아 준다. */
function 자리손질(s) {
  return String(s || '').replace(/`?\b([a-z0-9][a-z0-9-]{3,}\.md)\b(:[\d-]+)?`?/gi, (전, 이름, 줄) => {
    if (fs.existsSync(path.join(뿌리, 이름))) return 전;
    if (기억이름.has(이름)) return `기억 「${이름.replace(/\.md$/, '')}」${줄 ? ` ${줄.slice(1)}줄` : ''}`;
    // 저장소에도 기억에도 없다 — 있는 그대로 적되 «못 찾았다»를 밝힌다
    return `${이름}${줄 || ''} (이 저장소에도 기억에도 없다)`;
  })
    // 재료가 이미 「기억 」을 붙여 둔 자리가 있어 그대로 두면 「기억 기억」이 된다
    .replace(/기억\s+기억\s+「/g, '기억 「');
}

/* 🔴 재료의 자리가 «그 뒤 사라진» 것도 있다 (09-08 인용 검사가 잡았다).
 *   재료는 09-03 에 떴고 그 사이 파일이 지워지거나 트랙 줄이 밀렸다.
 *   자리를 지우면 「어디였는지」가 사라지고, 그대로 두면 읽는 사람이 헛다리를 짚는다.
 *   ⇒ 있는 그대로 적되 «지금은 없다»를 옆에 붙인다. */
/* 🔴 «매일 바뀌는 파일»은 줄 번호를 애초에 안 쓴다.
 *   트랙·결정 원장은 세션 예닐곱이 매일 고쳐서 09-03 의 줄 번호가 오늘 다른 줄을 가리킨다.
 *   틀린 줄은 안 적느니만 못하다 — 다음 사람이 그 줄을 열고 엉뚱한 것을 읽는다. */
const 매일바뀜 = /(docs\/_ops\/(?:트랙|결정)\.md)/;

function 낡음표시(s) {
  return String(s || '')
    .replace(/(docs\/_ops\/(?:트랙|결정)\.md):(\d+)/g, (전, 파일) => `${파일}(줄은 매일 밀린다)`)
    // 파일 경로 뒤에 (`이름`) 이 붙은 꼴 — 그 이름이 그 파일에 아직 있나
    .replace(/(`?)([\w가-힣./_-]+\.(?:md|js))\1:(\d+)\s*\(`([^`]+)`\)/g, (전, q, 파일, 줄, 이름) => {
      const p = path.join(뿌리, 파일);
      if (!fs.existsSync(p)) return `${파일}:${줄} 「${이름}」 (그 파일이 지금은 없다)`;
      try {
        if (!fs.readFileSync(p, 'utf8').includes(이름)) {
          return `${파일} 「${이름}」 (09-03 에는 ${줄}줄 · 지금 그 파일에 그 이름이 없다)`;
        }
      } catch { /* 못 읽으면 그대로 둔다 */ }
      return 전;
    })
    // 홑따옴표 없이 경로만 있는 꼴 — 파일 자체가 사라졌나
    //   🔑 콜론을 빼서 «인용 꼴»이 아니게 쓴다. 표시만 붙이면 인용 검사가 형식만 보고 계속 잡는다
    //      (검사가 옳다 — 없는 자리를 인용 꼴로 두면 다음 사람이 그대로 열어 보려 한다).
    //   경계에 여는 괄호·홑화살괄호를 넣는다 — 안 넣으면 `(을/§3.md:140)` 같은 자리를 놓친다
    .replace(/(^|[\s·(「『（])([\w가-힣§./_-]+\.(?:md|js)):(\d+)/g, (전, 앞, 파일, 줄) => {
      if (파일.startsWith('http') || fs.existsSync(path.join(뿌리, 파일))) return 전;
      return `${앞}${파일} ${줄}줄 (그 파일이 지금은 없다)`;
    });
}

/** 마감이 «12-07 파일럿»에 걸리나. 색인 §시계 정정 — 첫 학생은 개원이 아니라 파일럿이다. */
const 파일럿인가 = (v) => /파일럿|12월|12-07|첫 학생|첫학생/.test(v.deadline_event || '');

const 전부 = JSON.parse(fs.readFileSync(재료, 'utf8'));
let 볼것 = 인자.전량 ? 전부 : 전부.filter(파일럿인가);
if (인자.임자) 볼것 = 볼것.filter((v) => v.owner === 인자.임자);

/* 급한 순 — 파일럿이 먼저, 그 안에서 확신이 높은 것이 먼저(자리가 확실하니 바로 손댈 수 있다) */
const 확신순 = { high: 0, medium: 1, low: 2 };
볼것.sort((a, b) => (파일럿인가(b) - 파일럿인가(a))
  || (확신순[a.confidence] - 확신순[b.confidence])
  || String(a.id).localeCompare(String(b.id)));

if (인자.md) {
  const 오늘 = new Date().toISOString().slice(0, 10);
  console.log(`# 소급 불가 실행표 — 자리를 붙였다 (${오늘})\n`);
  console.log('> 재료 `docs/_ops/소급불가_울트라/전량.json` 의 `source` 칸을 꺼낸 것이다.');
  console.log('> 🔑 **자리는 처음부터 있었다** — 색인 마크다운이 옮길 때 그 칸을 버렸을 뿐이다.');
  console.log('> 되뜨는 자 = `node tools/소급실행표.js --전량 --md`\n');
  console.log(`총 ${볼것.length}건 · 파일럿(12-07)에 걸린 것 ${볼것.filter(파일럿인가).length}건\n`);
  let 절 = null;
  for (const v of 볼것) {
    const 새절 = 파일럿인가(v) ? '12-07 파일럿에 걸린 것' : '그 뒤에 오는 것';
    if (새절 !== 절) { 절 = 새절; console.log(`\n## ${절}\n`); }
    console.log(`### ${v.title}`);
    console.log(`- **임자** ${임자말[v.owner] || v.owner} · **확신** ${확신말[v.confidence] || v.confidence} · \`${v.id}\``);
    console.log(`- **마감** ${v.deadline_event}`);
    console.log(`- **사라지는 것** ${(v.what_is_lost || '').replace(/\n/g, ' ')}`);
    console.log(`- **어디를 고치나** ${낡음표시(자리손질((v.source || '').replace(/\n/g, ' ')))}`);
    // 🔴 「그날의 상태」 칸에도 자리가 섞여 있다 — source 만 손질하면 그 칸의 낡은 인용이 남는다
    if (v.current_state) console.log(`- **09-03 그날의 상태** ${낡음표시(자리손질(String(v.current_state).replace(/\n/g, ' ')))}`);
    console.log('');
  }
} else {
  console.log(`■ ${볼것.length}건 (전체 ${전부.length})\n`);
  for (const v of 볼것) {
    const 표 = { high: '🟢', medium: '🟡', low: '⬜' }[v.confidence] || ' ';
    console.log(`${표} [${임자말[v.owner] || v.owner}] ${v.title}`);
    console.log(`     자리: ${낡음표시(자리손질(String(v.source || ''))).slice(0, 96)}`);
  }
  const c = (k) => 볼것.filter((v) => v.owner === k).length;
  console.log('\n' + '─'.repeat(60));
  console.log(`임자 — 내가 ${c('machine')} · 유호님 ${c('yuho')} · 사람 손 ${c('person')}`);
  console.log(`확신 — 높다 ${볼것.filter((v) => v.confidence === 'high').length}`
    + ` · 보통 ${볼것.filter((v) => v.confidence === 'medium').length}`
    + ` · 낮다 ${볼것.filter((v) => v.confidence === 'low').length}`);
}
