#!/usr/bin/env node
'use strict';
/**
 * 흠 장부 — SNS 두 브랜드 편의 최종 확인에서 걸린 흠을 편들에 걸쳐 모아, 되풀이되는 갈래를 센다(2026-11-15). 읽기만 한다.
 *
 * 왜: 유호님 11-15 「컨텐츠생산 작업하면 보통 공통적으로 문제가 있는 부분들이 있을거아냐. 그 실수와 작업내용을 기억해서
 * 다음번에는 같은 실수 안하도록 시스템화 할순없는거야?」. 그때까지 흠은 편마다 최종확인.json 메모에 글로만 남았고 다음 판정이 덮었다.
 * 그래서 「멈춘 화면」, 「끝이 약함」이 여러 편에서 되풀이돼도 세는 곳이 없었고, 만드는 회차는 앞 편의 실수를 모른 채 시작했다.
 *
 *   node tools/흠장부.js [브랜드(synkbrief · yuhobuilds)] [--일수 30] [--json] [--폴더 <docs/마케팅>]
 *
 * 읽는 것: 편 폴더 게시/최종확인_이력.jsonl(판정마다 한 줄 — tools/lib/최종확인.js가 쌓는다).
 *          이력이 없는 옛 편은 게시/최종확인.json의 마지막 판정 하나를 읽고, 갈래가 없으면 메모 글에서 어림으로 고른다(「어림」 표시).
 * 쓰는 곳: 제작 회차가 콘티 전에(같은 자리를 밟지 않게), 최종 확인 세션이 판정 뒤에(서로 다른 세 편 이상에서 나온 갈래를 기계 검사로 올리게).
 * 절차는 docs/마케팅/기획장부/제작절차.md 「작은 흠은 올린다」의 「흠 장부」 줄.
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 확인 = require('./lib/최종확인.js');

const 올릴기준 = 3;

/* 검사로 올림 — 갈래를 기계 검사나 양식 칸으로 올렸으면 여기에 적는다. 적은 뒤에도 같은 갈래가 다시 나오면 「검사가 못 잡음」으로 뜬다. */
const 검사로올림 = {
  // 예) 멈춘화면: { 날짜: '2026-11-20', 검사: 'tools/최종본검사.py 멈춘 화면 2초' },
};

/* 갈래가 없는 옛 기록의 메모에서 어림으로 고른다. 새 기록은 --갈래가 꼭 붙으므로 이 길을 타지 않는다. */
const 어림표 = [
  ['멈춘화면', /멈춘|멈춤|정지/],
  ['끝약함', /끝\s*\d|끝이|끝 3초|가장 약함|재탕/],
  ['사람굳음', /굳/],
  ['인물튐', /얼굴|다른 사람/],
  ['소품튐', /안경|넥타이|소매|소품|의자/],
  ['점프컷', /점프컷|번쩍/],
  ['같은구도반복', /같은 구도|같은 장면/],
  ['글자표', /글자 표|표 카드|표에/],
  ['숫자불일치', /안 맞|불일치|배수/],
  ['소리', /무음|dB|음량|소리/],
  ['화면작음어두움', /어둡|작고/],
];
function 어림(메모) {
  const 찾은 = 어림표.filter(([, re]) => re.test(메모)).map(([g]) => g);
  return 찾은.length ? 찾은 : ['기타'];
}

function 브랜드of(이름, 준비) {
  const b = 준비 && 준비.브랜드;
  if (b) return b;
  return 이름.startsWith('synkbrief') ? 'synkbrief' : 이름.startsWith('yuhobuilds') ? 'yuhobuilds' : '';
}

function 모으기(root, { 브랜드 = '', 부터 = 0 } = {}) {
  const 줄들 = [];
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(root); } catch { return 줄들; }
  for (const 편 of 이름들) {
    const 게시 = path.join(root, 편, '게시');
    let 준비 = null;
    try { 준비 = JSON.parse(fs.readFileSync(path.join(게시, '준비.json'), 'utf8')); } catch { /* 준비 없는 폴더 */ }
    const b = 브랜드of(편, 준비);
    if (!확인.BRANDS.has(b) || (브랜드 && b !== 브랜드)) continue;
    let 이력 = [];
    try {
      이력 = fs.readFileSync(path.join(게시, 확인.HISTORY), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(게시, 확인.FILE), 'utf8'));
        if (r && r.결과) 이력 = [{ 결과: r.결과, 시각: r.시각, 갈래: r.갈래 || [], 메모: r.메모 || '' }];
      } catch { /* 기록 없는 편 */ }
    }
    for (const x of 이력) {
      if (x.결과 === '통과' || !x.결과) continue;
      const t = Date.parse(x.시각 || '') || 0;
      if (t < 부터) continue;
      const 있음 = Array.isArray(x.갈래) && x.갈래.length > 0;
      줄들.push({ 편, 브랜드: b, 결과: x.결과, 시각: x.시각 || '', 갈래: 있음 ? x.갈래 : 어림(String(x.메모 || '')), 어림: !있음, 메모: String(x.메모 || '') });
    }
  }
  return 줄들.sort((a, b) => String(b.시각).localeCompare(String(a.시각)));
}

function 세기(줄들) {
  const 표 = new Map();
  for (const z of 줄들) {
    for (const g of z.갈래) {
      const c = 표.get(g) || { 갈래: g, 편: new Set(), 판정: 0, 미흡: 0, 작은흠: 0, 마지막: '', 보기: [] };
      c.편.add(z.편);
      c.판정 += 1;
      if (z.결과 === '미흡') c.미흡 += 1; else c.작은흠 += 1;
      if (String(z.시각) > c.마지막) c.마지막 = String(z.시각);
      if (c.보기.length < 2) c.보기.push(`${z.편}: ${z.메모.slice(0, 110)}`);
      표.set(g, c);
    }
  }
  return [...표.values()].map((c) => {
    const 올림 = 검사로올림[c.갈래];
    const 다시남 = 올림 && c.마지막.slice(0, 10) > 올림.날짜;
    return { ...c, 편수: c.편.size, 편: [...c.편], 상태: 올림 ? (다시남 ? `검사가 못 잡음(${올림.검사})` : `검사로 올림(${올림.날짜} ${올림.검사})`) : c.편.size >= 올릴기준 ? '기계 검사로 올릴 차례' : '' };
  }).sort((a, b) => b.편수 - a.편수 || b.판정 - a.판정);
}

function main(argv) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const 값자리 = new Set(['--일수', '--폴더'].map((n) => argv.indexOf(n)).filter((i) => i >= 0).map((i) => i + 1));
  const 브랜드 = argv.find((a, i) => !값자리.has(i) && !a.startsWith('--')) || '';
  if (브랜드 && !확인.BRANDS.has(브랜드)) { console.error(`브랜드는 ${[...확인.BRANDS].join(' · ')} 가운데 하나다: ${브랜드}`); return 2; }
  const 일수 = Number(opt('--일수')) > 0 ? Number(opt('--일수')) : 30;
  const root = opt('--폴더') ? path.resolve(opt('--폴더')) : path.join(공용작업본(path.resolve(__dirname, '..')), 'docs', '마케팅');
  const 줄들 = 모으기(root, { 브랜드, 부터: Date.now() - 일수 * 86400000 });
  const 표 = 세기(줄들);
  if (argv.includes('--json')) { console.log(JSON.stringify({ 일수, 브랜드: 브랜드 || '두 브랜드', 판정: 줄들.length, 갈래: 표 }, null, 2)); return 0; }
  console.log(`흠 장부 · ${브랜드 || '두 브랜드'} · 지난 ${일수}일 · 미흡과 작은 흠 판정 ${줄들.length}건 · 편 ${new Set(줄들.map((z) => z.편)).size}개`);
  if (!표.length) { console.log('  걸린 흠이 없다.'); return 0; }
  console.log('  갈래 — 서로 다른 편 수 / 판정 수(미흡 · 작은 흠) — 할 일');
  for (const c of 표) {
    console.log(`  ${c.갈래} — ${c.편수}편 / ${c.판정}건(미흡 ${c.미흡} · 작은 흠 ${c.작은흠})${c.상태 ? ` — ${c.상태}` : ''}`);
    for (const b of c.보기) console.log(`      ${b}`);
  }
  if (줄들.some((z) => z.어림)) console.log('  (갈래 없이 쓴 옛 기록은 메모 글에서 어림으로 골랐다.)');
  console.log('  콘티를 쓰기 전에 위 갈래마다 이번 편이 같은 자리를 밟지 않는지 기획에 한 줄로 적는다.');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { 모으기, 세기, 어림, 올릴기준 };
