#!/usr/bin/env node
'use strict';
/**
 * LAB 교훈 표 입구 — 이해 시험 · 판본 회차에서 떨어진 까닭을 다음 편이 시작할 때 읽고, 회차를 닫을 때 표에 올렸는지 본다(11-17).
 * 왜와 셈은 tools/lib/LAB교훈.js 머리말, 표는 docs/마케팅/제작양식/LAB_교훈.json.
 *
 *   node tools/LAB교훈.js                         교훈 수 · 올린 곳 · 올린 뒤 다시 나온 교훈 · 안 올린 기록 · 판본 회차 숫자
 *   node tools/LAB교훈.js 시작 <원본|판본|시험> [--모두] [--json]
 *       원본 = 07 · 15시 제작 회차가 기획 · 콘티 · 화면 글을 쓰기 전에(원본과 시험 교훈), 판본 = 판본 회차가 판본 글 · 원고를 쓰기 전에.
 *       나온 줄을 기획 · 글을 쓰는 하위 에이전트 지시문 맨 앞에 그대로 넣는다. 끝 코드는 늘 0이다(장부가 제작을 멈추지 않는다).
 *   node tools/LAB교훈.js --점검 [이해|판본] [--json]
 *       기록의 모든 줄(표의 시작일부터)이 교훈의 근거나 뺌에 있는지, 받은 줄의 글이 지문과 같은지, 표에 없는 근거 · 꼴을 못 읽은
 *       「다음 원본」 줄이 없는지, 표의 꼴이 맞는지 본다. 하나라도 걸리면 끝 코드 1 — 회차를 닫기 전에 0이 되게 표를 고친다.
 *       제작 회차는 「이해」, 판본 회차는 「판본」만 본다(다른 회차가 방금 올린 남의 줄로 막히지 않게 — Fable 5.2 P2-3).
 *   node tools/LAB교훈.js --지문 [이해|판본] [--바뀜받음 <열쇠,…>|모두]
 *       표를 고친 뒤 받은 줄 가운데 지문이 없는 줄의 지문을 적는다(표를 정렬 · 한 줄에 하나 꼴로 다시 쓴다). 있는 지문은 덮지 않는다 —
 *       점검이 「받은 뒤 바뀐 기록」으로 띄운 줄을 읽고 표에 반영했을 때만 --바뀜받음으로 그 줄을 덮는다. 차례: --점검 → 표 고침 → --지문 → --점검.
 */
const path = require('node:path');
const L = require('./lib/LAB교훈.js');

const REPO = path.resolve(__dirname, '..');
const 뿌리 = () => (process.env.SYNK_LAB_LESSON_DIR ? path.resolve(process.env.SYNK_LAB_LESSON_DIR) : REPO);
const 짧게 = (t, n = 160) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

const fs = require('node:fs');
const 출처of = (argv, 명령) => { const i = argv.indexOf(명령); const v = i >= 0 ? argv[i + 1] : undefined; return v === '이해' || v === '판본' ? v : null; };

function 점검main(json, 출처) {
  const root = 뿌리();
  const 원천 = L.원천읽기(root);
  const 표 = L.표읽기(root);
  const 판본글 = fs.existsSync(path.join(root, ...L.자리.판본)) ? fs.readFileSync(path.join(root, ...L.자리.판본), 'utf8') : '';
  const r = L.점검(원천, 표, { 출처, 못읽음: L.판본못읽음(판본글) });
  if (표.없음) r.꼴.unshift(`표가 없다: ${L.자리.표.join('/')}`);
  const 걸림 = L.걸림수(r);
  const 범위 = 출처 ? `${출처} 기록` : '두 기록';
  if (json) { console.log(JSON.stringify({ 걸림, 범위, ...r }, null, 1)); return 걸림 ? 1 : 0; }
  if (!걸림) {
    const n = 원천.filter((x) => !출처 || x.출처 === 출처).length;
    console.log(`LAB 교훈 표 점검(${범위}): 걸림 0 — 기록 ${n}줄이 모두 교훈 ${표.교훈.length}개의 근거나 뺌 ${표.뺌.length}개에 있고 지문이 맞다(시작일 ${표.시작일 || '없음'})`);
    return 0;
  }
  console.log(`LAB 교훈 표 점검(${범위}): 걸림 ${걸림} — 회차를 닫기 전에 docs/마케팅/제작양식/LAB_교훈.json을 고친다`);
  if (r.안올림.length) {
    console.log(`  교훈 표에 안 올린 기록 ${r.안올림.length}줄 — 같은 뿌리의 교훈이 있으면 그 「근거」에 열쇠를 더하고, 새 뿌리면 새 교훈을, 교훈이 없는 칸이면 「뺌」에 까닭과 함께 적는다:`);
    for (const x of r.안올림) console.log(`  · ${x.키} — ${짧게(x.글)}`);
  }
  if (r.바뀜.length) {
    console.log(`  받은 뒤 글이 바뀐 기록 ${r.바뀜.length}줄 — 고쳐 쓴 글을 읽고 새 교훈이 있으면 표에 올린 뒤 node tools/LAB교훈.js --지문${출처 ? ` ${출처}` : ''} --바뀜받음 "<그 열쇠,…>"로 그 줄의 지문만 다시 적는다(열쇠에 빈칸이 있어 따옴표로 감싼다):`);
    for (const x of r.바뀜) console.log(`  · ${x.키} — ${짧게(x.글)}`);
  }
  if (r.지문없음.length) console.log(`  표에 올렸는데 지문이 없는 기록 ${r.지문없음.length}줄 — 글을 다시 읽고 node tools/LAB교훈.js --지문${출처 ? ` ${출처}` : ''}으로 적는다: ${r.지문없음.map((x) => x.키).join(' · ')}`);
  if (r.못읽음.length) {
    console.log(`  꼴을 못 읽은 「다음 원본에서 바꿀 것」 줄 ${r.못읽음.length}개 — 「다음 원본에서 바꿀 것: …」 꼴로 고쳐 적는다:`);
    for (const x of r.못읽음) console.log(`  · ${L.자리.판본.join('/')}:${x.줄번호}(${x.회차}) — ${짧게(x.글, 100)}`);
  }
  if (r.없는근거.length) console.log(`  기록에 없는 근거 ${r.없는근거.length}개(열쇠 오타이거나 기록 줄이 고쳐졌다): ${r.없는근거.join(' · ')}`);
  for (const t of r.꼴) console.log(`  꼴: ${t}`);
  return 1;
}

// 받은 기록 가운데 지문이 없는 줄의 지문을 적는다 — 표를 고친 뒤 돌린다. 표는 정렬 · 한 줄에 하나 꼴로 다시 쓴다.
// 이미 있는 지문은 덮지 않는다(다시 검수 N1). 「받은 뒤 바뀐 기록」을 읽고 표에 반영했으면 --바뀜받음 <열쇠,…>(또는 --바뀜받음 모두)로 그 줄만 덮는다
function 지문main(출처, argv) {
  const root = 뿌리();
  const 표 = L.표읽기(root);
  if (표.없음) { console.error(`표가 없다: ${L.자리.표.join('/')}`); return 1; }
  const i = argv.indexOf('--바뀜받음');
  const 값 = i >= 0 ? String(argv[i + 1] || '') : '';
  if (i >= 0 && (!값 || 값.startsWith('--'))) { console.error('--바뀜받음 뒤에 열쇠(쉼표로 잇기)나 「모두」를 준다'); return 2; }
  const 바뀜받음 = i < 0 ? false : 값 === '모두' ? true : 값.split(',').map((x) => x.trim()).filter(Boolean);
  const 원천 = L.원천읽기(root);
  const 전 = { ...(표.지문 || {}) };
  const 글 = L.지문적은표(원천, 표, { 출처, 바뀜받음 });
  fs.writeFileSync(path.join(root, ...L.자리.표), 글);
  const 뒤 = JSON.parse(글).지문;
  const 새 = Object.keys(뒤).filter((k) => !(k in 전)).length;
  const 덮음 = Object.keys(뒤).filter((k) => k in 전 && 전[k] !== 뒤[k]).length;
  console.log(`LAB 교훈 표 지문: ${출처 ? `${출처} 기록` : '두 기록'}의 받은 줄 가운데 새로 ${새}줄을 적고 ${덮음}줄을 덮었다(지문 ${Object.keys(전).length} → ${Object.keys(뒤).length}개) — 이어서 node tools/LAB교훈.js --점검${출처 ? ` ${출처}` : ''}`);
  return 0;
}

function 요약main() {
  const root = 뿌리();
  const 원천 = L.원천읽기(root);
  const 표 = L.표읽기(root);
  const 줄 = L.셈(표, 원천);
  const 곳 = L.올린곳들.map((k) => `${k} ${줄.filter((e) => e.올린곳 === k).length}`).join(' · ');
  const r = L.점검(원천, 표);
  console.log(`LAB 교훈 표 · 교훈 ${줄.length}개(${곳}) · 뺌 ${표.뺌.length} · 기록 ${원천.length}줄(시작일 ${표.시작일 || '없음'}) · 안 올린 기록 ${r.안올림.length}`);
  const 다시 = 줄.filter((e) => e.다시).sort((a, b) => b.다시 - a.다시);
  if (다시.length) {
    console.log('올린 뒤에도 다시 나온 교훈 — 읽히기로는 안 막혀 기본값이나 기계 검사로 올릴 차례:');
    for (const e of 다시) console.log(`  · ${e.id}(${e.올린곳} · ${e.올린날}) ${짧게(e.할것, 90)} — 올린 뒤 ${e.다시}번`);
  } else {
    console.log('올린 뒤에도 다시 나온 교훈: 없음');
  }
  const 많이 = 줄.filter((e) => e.올린곳 === '읽힘').sort((a, b) => b.횟수 - a.횟수).slice(0, 5);
  if (많이.length) console.log(`읽힘으로만 올린 교훈 가운데 기록이 많은 것: ${많이.map((e) => `${e.id} ${e.횟수}번`).join(' · ')}`);
  const 숫자 = L.판본숫자(require('node:fs').existsSync(path.join(root, ...L.자리.판본)) ? require('node:fs').readFileSync(path.join(root, ...L.자리.판본), 'utf8') : '');
  if (숫자.length) console.log(`판본 회차(통과 / 판본 · 고친 횟수 평균): ${숫자.map((x) => `${x.회차.replace(/ 회차$/, '')} ${x.통과}/${x.판본}${x.고친평균 === null ? '' : ` · ${x.고친평균}`}`).join(' | ')}`);
  return 0;
}

function main(argv) {
  const json = argv.includes('--json');
  if (argv.includes('--지문')) return 지문main(출처of(argv, '--지문'), argv);
  if (argv.includes('--점검')) return 점검main(json, 출처of(argv, '--점검'));
  if (argv[0] === '시작') {
    const 단계 = argv[1];
    if (!L.단계들.includes(단계)) { console.error(`사용: node tools/LAB교훈.js 시작 <${L.단계들.join('|')}> [--모두] [--json]`); return 2; }
    let r;
    try { r = L.시작(뿌리(), 단계, { 상한: argv.includes('--모두') ? Infinity : L.시작상한 }); } catch (e) { console.error(`LAB 교훈 표를 못 읽음 — ${e.message}`); return 0; }
    if (json) { console.log(JSON.stringify(r, null, 1)); return 0; }
    const 글 = L.시작글(r);
    if (글) console.log(글);
    return 0;
  }
  if (argv.length && !json) { console.error('사용: node tools/LAB교훈.js [시작 <원본|판본|시험> [--모두]] [--점검 [이해|판본]] [--지문 [이해|판본] [--바뀜받음 <열쇠,…>|모두]] [--json]'); return 2; }
  return 요약main();
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
