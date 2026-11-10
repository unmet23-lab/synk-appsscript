#!/usr/bin/env node
'use strict';
/* 판본 글 잇기(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 6 · 22). 판본 틀의 판본 글(remotion/src/<접두>/판본/<KEY>.json)을 검수 도구가 읽는
 * 판본글/1(게시/판본/<KEY>/글.json)로 뽑고, 준비.json 「돌림」.판본에 넣고, 한 판본의 사슬을 확인한다. 꼴 · 지도는 tools/lib/판본잇기.js 머리말.
 *
 *   node tools/판본글잇기.js 채우기 <편 폴더> <입력.json>
 *       판본 글 틀과 원고 파일에 글을 넣는다. 입력 = { "<KEY>": { hook: "…", means: […], "_원문": { hook: "<한국어 뜻>" },
 *       "원고": { "youtube": { title, caption, pinnedComment, "_원문": { title, caption, … } } } } }. 틀의 `_설명` · `_한도`는 그대로 둔다.
 *   node tools/판본글잇기.js 뽑기 <편 폴더> <KEY…|전부>
 *       글.json을 원천(판본 글 · 지도 · 원고)에 맞춘다. 같으면 건드리지 않는다. 글이 아직 빈 판본은 건너뛰며 알린다.
 *   node tools/판본글잇기.js 돌림 <편 폴더> <KEY…|전부> [--형식 이야기|퀴즈] [--쓸날 YYYY-MM-DD]
 *       준비.json 「돌림」.판본[KEY] = { 언어, 파일, 표지, 글, 원고 }(검수는 그대로 둔다). 「돌림」이 없으면 만든다(형식은 지도의 틀).
 *       글.json도 같이 맞춘다. 판(게시 칸)은 쓰지 않는다 — 판은 tools/돌림표.js --쓰기가 쓴다.
 *   node tools/판본글잇기.js 확인 <편 폴더> [KEY…|전부] [--json]
 *       판본마다 사슬(글 → 글.json → 영상 · 렌더 기록 → 준비.json → 검수 지문)을 본다. 문제가 하나라도 있으면 종료 1.
 * 한 판본의 차례: 채우기 → 뽑기 → 글자검사 전 → 현지어대조 → 판본렌더 → 돌림 → 글자검사 판본 --기록 → 뜻검사 판본 → 채점 --기록 → 확인.
 */
const fs = require('node:fs');
const path = require('node:path');
const 잇기 = require('./lib/판본잇기.js');
const 판본글 = require('./lib/판본글.js');

const REPO = path.resolve(__dirname, '..');
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

function 인자들(argv) {
  const 값 = {}, 위치 = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') 값.json = true;
    else if (a.startsWith('--')) 값[a.slice(2)] = argv[++i];
    else 위치.push(a);
  }
  return { 값, 위치 };
}

function 고른키(편, 준것) {
  const 있는 = 잇기.키들(편);
  if (!준것.length || 준것.includes('전부')) return 있는;
  const 키 = 준것.map((k) => k.toUpperCase());
  for (const k of 키) if (!/^[A-Z]{2}$/.test(k)) throw new Error(`판본 키가 아니다: ${k}(두 글자 대문자)`);
  return 키;
}

function main(argv) {
  const { 값, 위치 } = 인자들(argv);
  const [명령, 편, ...나머지] = 위치;
  const 쓰는법 = '쓰는 법: node tools/판본글잇기.js 채우기 <편 폴더> <입력.json> | 뽑기 <편 폴더> <KEY…|전부> | 돌림 <편 폴더> <KEY…|전부> [--형식 …] [--쓸날 YYYY-MM-DD] | 확인 <편 폴더> [KEY…|전부] [--json]';
  if (!명령 || !편) { console.error(쓰는법); return 2; }

  if (명령 === '채우기') {
    if (!나머지[0]) { console.error(쓰는법); return 2; }
    const 결과 = 잇기.채우기(편, 판본글.readJson(나머지[0]));
    for (const r of 결과) console.log(`  ${r.키}: ${rel(r.팩파일)}${r.원고.length ? ` · 원고 ${r.원고.map((f) => path.basename(f)).join(' · ')}` : ''}`);
    console.log(`채웠다 ${결과.length}개 — 다음: node tools/판본글잇기.js 뽑기 "${편}" ${결과.map((r) => r.키).join(' ')}`);
    return 0;
  }

  if (명령 === '뽑기' || 명령 === '돌림') {
    if (!나머지.length) { console.error(쓰는법); return 2; }
    if (값.쓸날 && !/^\d{4}-\d{2}-\d{2}$/.test(값.쓸날)) { console.error('--쓸날은 YYYY-MM-DD'); return 2; }
    if (값.형식 && !['이야기', '퀴즈'].includes(값.형식)) { console.error('--형식은 이야기 · 퀴즈'); return 2; }
    const 된 = [];
    let 실패 = 0;
    for (const 키 of 고른키(편, 나머지)) {
      try {
        const r = 잇기.맞추기(편, 키);
        console.log(`  ${키}: ${r.새로 ? '새로 뽑음' : r.바뀜 ? '다시 뽑음(지문이 바뀌었다 — 뜻 검사를 다시 받는다)' : '그대로'} · ${rel(r.글파일)} · ${r.지문.slice(0, 12)}`);
        for (const w of r.경고) console.log(`    ? ${w}`);
        된.push(키);
      } catch (e) { console.log(`  ${키}: 건너뜀 — ${e.message.split('\n')[0]}`); 실패 += 1; }
    }
    if (명령 === '돌림' && 된.length) {
      const r = 잇기.준비에넣기(편, 된, { 형식: 값.형식 || null, 쓸날: 값.쓸날 || null });
      console.log(`준비.json 「돌림」.판본 ${된.length}개 ${r.바뀜 ? '넣음' : '그대로'}(${rel(r.준비)}) — 검수 칸은 건드리지 않았다`);
    }
    return 실패 ? 1 : 0;
  }

  if (명령 === '확인') {
    const 결과 = 고른키(편, 나머지).map((키) => 잇기.확인(편, 키));
    if (값.json) console.log(JSON.stringify(결과, null, 2));
    else {
      for (const r of 결과) {
        console.log(`  ${r.문제.length ? '✗' : '✓'} ${r.키}${r.문제.length ? ` — ${r.문제.join(' · ')}` : ' — 돌림에 든다'}`);
        for (const w of r.알림) console.log(`    ? ${w}`);
      }
      const 못 = 결과.filter((r) => r.문제.length);
      console.log(`판본 ${결과.length} · 돌림에 드는 것 ${결과.length - 못.length} · 못 드는 것 ${못.length}${못.length ? `(${못.map((r) => r.키).join(' · ')})` : ''}`);
    }
    return 결과.some((r) => r.문제.length) ? 1 : 0;
  }

  console.error(쓰는법);
  return 2;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; }
}

module.exports = { main };
