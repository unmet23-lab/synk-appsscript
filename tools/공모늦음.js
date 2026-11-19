#!/usr/bin/env node
'use strict';
/**
 * 늦게 찾은 공모 재기(2026-11-20).
 *
 * 왜: 「응답하라, 제천」은 9-28에 공고가 올라왔는데 11-19에야 찾았다. 마감 하루 전이었다.
 *   늦게 찾는 공고가 어느 사이트에 올라오는지 알아야 조사 범위에 그 사이트를 더할 수 있다.
 *   유호님 11-20 「다섯 개 다 해」 가운데 다섯째(늦게 찾은 공고 재기와 출처 보강).
 *
 * 쓰기:
 *   node tools/공모늦음.js            늦게 찾은 공고와 그 공식 사이트를 사이트별로 보인다
 *   node tools/공모늦음.js --json     같은 내용을 JSON으로
 *   --보관함 <폴더>                    다른 지원사업 폴더(시험용)
 *
 * 재는 법:
 *   찾은 날 — 그록 · Gemini 공고는 처음 받은 회차의 날(grok_first_seen), 옛 장부 공고는 id의 날짜(claude-20261019 → 10-19).
 *   마감 · 접수 시작 — 자격 판정이 공고 원문에서 읽은 값(tools/공모자격.js), 없으면 장부의 마감.
 *   늦음 — 찾았을 때 마감까지 7일이 안 남았거나, 접수가 시작되고 21일 넘게 지나서 찾았다.
 *   영상 공고만 본다. 첫 수집 날(10-19, 장부를 처음 만든 날)에 찾은 공고는 모두 처음 본 것이라 빼고 잰다.
 * 결과는 그록 · Gemini 조사 지시문의 출처를 고칠 때 근거로 쓴다(두 조사 비교가 끝난 11-21 뒤, docs/지원사업/README.md).
 */
const 지도 = require('./공모지도.js');
const 자격 = require('./lib/contest-eligibility.cjs');

const 하루 = 864e5;
const 날 = (t) => Date.parse(`${String(t).slice(0, 10)}T00:00:00+09:00`);

/** 공고를 처음 찾은 날(YYYY-MM-DD). 모르면 ''. */
function 찾은날(o) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(o.grok_first_seen || '')) return o.grok_first_seen;
  const m = /(?:^|[-:])(20\d{2})(\d{2})(\d{2})(?=[:-]|$)/.exec(o.id || '');
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const k = Object.keys(o).map((x) => /^discovered_(20\d{2})(\d{2})(\d{2})$/.exec(x)).find(Boolean);
  return k ? `${k[1]}-${k[2]}-${k[3]}` : '';
}

function 사이트(주소) {
  try { return new URL(주소).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** 늦게 찾은 공고 목록. */
const 영상인가 = (o) => (o.grok_contest ? o.grok_contest.video === true : ['AI 영상', '영상'].includes(o.ai_video?.value));

function 늦음재기(통합, 판정) {
  const 결과 = [];
  const 날들 = (통합.items || []).map(찾은날).filter(Boolean).sort();
  const 첫수집 = 날들[0] || '';
  for (const o of 통합.items || []) {
    const 찾음 = 찾은날(o);
    if (!찾음 || 찾음 === 첫수집 || !영상인가(o)) continue;
    const v = 자격.판정찾기(판정, o.title);
    const 마감 = (v?.공고?.마감 || 지도.공고마감(o) || '').slice(0, 10);
    const 시작 = v?.공고?.접수시작 || '';
    const 남은날 = 마감 ? Math.round((날(마감) - 날(찾음)) / 하루) : null;
    const 지난날 = 시작 ? Math.round((날(찾음) - 날(시작)) / 하루) : null;
    const 까닭 = [];
    if (남은날 != null && 남은날 >= 0 && 남은날 < 7) 까닭.push(`찾았을 때 마감까지 ${남은날}일`);
    if (지난날 != null && 지난날 > 21) 까닭.push(`접수 시작 ${지난날}일 뒤에 찾음`);
    if (!까닭.length) continue;
    const 공식 = o.grok_contest?.officialUrl || v?.url || 지도.공고주소(o) || '';
    결과.push({ id: o.id, 제목: o.title, 찾은날: 찾음, 마감, 접수시작: 시작, 남은날, 지난날, 까닭, 공식사이트: 사이트(공식), 찾은곳: 사이트(o.grok_contest?.discoveryUrl || '') });
  }
  return 결과.sort((a, b) => (a.남은날 ?? 99) - (b.남은날 ?? 99));
}

function main(argv) {
  const 보관함 = argv.includes('--보관함') ? argv[argv.indexOf('--보관함') + 1] : 지도.기본보관함;
  const { 통합, 자격판정 } = 지도.읽기(보관함);
  const xs = 늦음재기(통합, 자격판정);
  if (argv.includes('--json')) { console.log(JSON.stringify(xs, null, 1)); return 0; }
  const 묶음 = new Map();
  for (const x of xs) {
    const k = x.공식사이트 || '(공식 주소 없음)';
    if (!묶음.has(k)) 묶음.set(k, []);
    묶음.get(k).push(x);
  }
  console.log(`늦게 찾은 공고 ${xs.length}건 — 공식 사이트별`);
  for (const [k, 목록] of [...묶음].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${k} ${목록.length}건`);
    for (const x of 목록) console.log(`  - ${x.제목.slice(0, 60)} | 찾음 ${x.찾은날} | ${x.까닭.join(', ')}${x.찾은곳 ? ` | 찾은 곳 ${x.찾은곳}` : ''}`);
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}

module.exports = { 찾은날, 늦음재기 };
