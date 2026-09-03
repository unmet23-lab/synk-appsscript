#!/usr/bin/env node
'use strict';
/**
 * 지면인쇄 — HTML 한 장을 PDF 로 뽑되, **「다 됐다」를 물어보고** 뽑는다.
 *
 * ■ 왜 있나 (2026-09-03 · 유호 지시 「쪽번호 도구를 우리 지면에 붙여라」)
 *   지금까지는 크롬에 `--virtual-time-budget=8000`(8초어치 기다린다)을 주고 인쇄했다.
 *   그건 «기다림»이 아니라 «추측»이다. 조판이 안 끝나도 크롬은 그 시점까지의 지면을
 *   멀쩡한 PDF 로 뱉는다.
 *
 * ■ 🔴 그게 조용히 틀린 실측 (09-03 · 몽골어 번역 작업본 8쪽)
 *     기다림 40초어치 → 1쪽 · 120초어치 → 2쪽 · 400초어치 → 3쪽.
 *   셋 다 «열리는» PDF 다. 쪽이 사라진 것을 아무 검사도 안 문다.
 *   신호로 기다리니 **0.3초** 만에 「다 됐다」가 왔다 — 시간이 문제가 아니었다.
 *
 * ■ ⚠ 못 기다리면 **깨진다**. 반쪽 PDF 를 내놓지 않는다.
 *
 * 쓰는 법:
 *   node tools/지면인쇄.js <html> <pdf>
 *   node tools/지면인쇄.js <html> <pdf> --기다림 "window.__SYNK_PAGED_DONE===true" --최대초 90
 */
const fs = require('node:fs');
const path = require('node:path');
const { 지면열기 } = require('./lib/크롬조종.js');

async function 인쇄(html, pdf, { 기다림 = null, 최대초 = 90 } = {}) {
  const { c, 닫기, 걸린초 } = await 지면열기(html, { 기다림, 최대초 });
  try {
    const { data } = await c.보냄('Page.printToPDF', {
      printBackground: true,      // 배경 색·면이 빠지면 우리 인쇄물은 흰 종이가 된다
      preferCSSPageSize: true,    // @page 의 용지 선언을 크롬 기본값보다 앞세운다
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    });
    fs.mkdirSync(path.dirname(path.resolve(pdf)), { recursive: true });
    fs.writeFileSync(pdf, Buffer.from(data, 'base64'));
    return { pdf, KB: Math.round(fs.statSync(pdf).size / 1024), 물음: 기다림, 걸린초 };
  } finally { 닫기(); }
}

async function 본다(argv) {
  const 값 = (이름, 기본) => {
    const i = argv.indexOf(이름);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : 기본;
  };
  const 남은 = argv.filter((a, i) => !a.startsWith('--') && !['--기다림', '--최대초'].includes(argv[i - 1]));
  if (남은.length !== 2) {
    console.error('용법: node tools/지면인쇄.js <html> <pdf> [--기다림 "<표현식>"] [--최대초 90]');
    return 2;
  }
  const r = await 인쇄(남은[0], 남은[1], { 기다림: 값('--기다림', null), 최대초: Number(값('--최대초', 90)) });
  console.log(`✅ ${r.pdf}  (${r.KB} KB${r.물음 ? ` · 「다 됐다」까지 ${r.걸린초.toFixed(1)}초 기다렸다` : ''})`);
  return 0;
}

if (require.main === module) {
  본다(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    console.error(`🔴 ${e.message}`);
    process.exit(1);
  });
}
module.exports = { 인쇄 };
