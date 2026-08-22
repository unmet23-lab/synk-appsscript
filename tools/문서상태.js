#!/usr/bin/env node
/* 문서 상태 조회 — 「무엇을 판단 정본으로 삼아도 되나」를 한 명령으로 답한다.
 *
 * 발단(유호님 지시 2026-08-09): 철학·시스템 문서를 대화로 계속 업그레이드하는데,
 *   **커밋 ≠ 확정**이라 다른 세션이 「이 문서를 근거로 만들어도 되나」를 구분할 수 없었다.
 *   초안도 커밋되고 확정본도 커밋된다 — 그래서 상태를 문서 머리에 한 줄로 박고, 이 도구가 읽는다.
 *
 * 세 상태(실측이 요구한 갈래 — 두 개로 뭉개면 「지금 이걸 따라야 하나」가 사라진다):
 *   ✅확정   = 따른다 + 안 바뀐다        → 판단 정본
 *   🔄개편중 = 따른다(현행) + 곧 바뀐다  → 새로 굳히는 근거로는 쓰지 않는다
 *   🔵논의중 = 아직 안 따른다            → 참고만
 *
 * 🔑 **분모를 같이 낸다** — 상태 줄이 없는 문서가 몇 개인지 안 보이면 「전부 확정이구나」로 읽힌다
 *   (이 저장소 규칙: 초록은 분모와 함께 읽는다). 미표기는 침묵이지 확정이 아니다.
 * 🔑 렌더링되는 문서(홈페이지 원고 등)는 상태를 **HTML 주석**으로 둔다 — 본문에 내부 표기가 새면
 *   그건 대외 노출 사고다. 그래서 두 표기를 **같은 정규식 하나**로 읽는다(두 벌로 적으면 갈라진다).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
const 상태들 = ['✅확정', '🔄개편중', '🔵논의중'];
/* 한 정규식이 인용문 표기와 주석 표기를 **둘 다** 읽는다.
 * ☠️ 첫 판은 `\*{0,2}` 를 자리마다 박았다가 **내가 실제로 쓴 표기(`✅**확정**`)를 못 봤다** — 8줄 중 1줄만
 *   잡혔다(굵게가 이모지와 낱말 **사이**에 들어갈 줄 몰랐다). 자리를 세는 정규식은 사람이 굵게를 어디
 *   찍느냐에 따라 조용히 눈이 먼다. 그래서 **별표를 먼저 지우고** 본다 — 변이 다섯 벌을 회귀가 못박는다
 *   (`tests/문서상태.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)`). 이 저장소 규칙: 가드는 「사람이 실제로 쓰는 표기」로 검사한다. */
const 상태식 = /^\s*(?:>|<!--)\s*상태\s*[:：]\s*(✅\s*확정|🔄\s*개편중|🔵\s*논의중)/;
const 별표지우기 = (줄) => String(줄).replace(/\*/g, '');

function 상태읽기(절대) {
  let 머리;
  try {
    머리 = fs.readFileSync(절대, 'utf8').split(/\r?\n/, 12);  // 머리 12줄만 — 본문 중간의 인용은 상태가 아니다
  } catch { return null; }
  for (const 줄 of 머리) {
    const m = 상태식.exec(별표지우기(줄));
    if (!m) continue;
    return {
      상태: m[1].replace(/\s+/g, ''),   // `✅ 확정` 처럼 띄어 써도 한 값으로 접는다
      줄: 별표지우기(줄).trim().replace(/^<!--\s*|\s*-->$/g, '').replace(/^>\s*/, ''),
    };
  }
  return null;
}

function 대상들(전체) {
  const 목록 = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith('.md') && f !== 'MEMORY.md') 목록.push(f);
  }
  const docs = path.join(ROOT, 'docs');
  if (fs.existsSync(docs)) {
    for (const f of fs.readdirSync(docs)) {
      if (!f.endsWith('.md')) continue;
      목록.push(path.join('docs', f));
    }
    if (전체) {  // docs/정본/ 하위까지 — 대외 자료라 평소엔 소음이다
      const 정본 = path.join(docs, '정본');
      if (fs.existsSync(정본)) 훑기(정본, 목록);
    }
  }
  return 목록;
}

function 훑기(디렉, 목록) {
  for (const e of fs.readdirSync(디렉, { withFileTypes: true })) {
    const p = path.join(디렉, e.name);
    if (e.isDirectory()) 훑기(p, 목록);
    else if (e.name.endsWith('.md')) 목록.push(path.relative(ROOT, p));
  }
}

function 출력() {
  const 전체 = process.argv.includes('--전체');
  const 파일들 = 대상들(전체);
  const 묶음 = new Map(상태들.map((s) => [s, []]));
  const 미표기 = [];

  for (const rel of 파일들) {
    const r = 상태읽기(path.join(ROOT, rel));
    if (r) 묶음.get(r.상태).push({ rel, 줄: r.줄 });
    else 미표기.push(rel);
  }

  console.log('■ 문서 상태 — 「무엇을 판단 정본으로 삼나」\n');
  for (const s of 상태들) {
    const 들 = 묶음.get(s);
    console.log(`${s} (${들.length})`);
    if (!들.length) console.log('   (없음)');
    for (const { rel, 줄 } of 들) {
      const 꼬리 = 줄.replace(/^상태\s*[:：]\s*(✅\s*확정|🔄\s*개편중|🔵\s*논의중)\s*[·-]?\s*/, '');
      console.log(`   · ${rel}${꼬리 ? '\n       ' + 꼬리.slice(0, 150) : ''}`);
    }
    console.log('');
  }

  /* 🔴 분모 — 이 줄이 없으면 위 목록이 「전부」로 읽힌다. 미표기는 확정이 아니라 **모름**이다. */
  console.log(`❔ 상태 줄 없음 (${미표기.length} / 전체 ${파일들.length}) — **모름이지 확정이 아니다**`);
  if (미표기.length && process.argv.includes('--미표기')) {
    for (const rel of 미표기) console.log(`   · ${rel}`);
  } else if (미표기.length) {
    console.log('   목록: node tools/문서상태.js --미표기' + (전체 ? ' --전체' : ''));
  }
  if (!전체) console.log('\n(docs/정본/ 하위 대외 자료까지: --전체)');
  console.log('\n상태를 바꾸는 사람 = 유호님. 문서 머리 한 줄을 고쳐 커밋하면 그 순간부터 모든 세션이 그렇게 읽는다.');
  return 0;
}

module.exports = { 상태읽기, 상태식, 상태들 };

if (require.main === module) process.exit(출력());
