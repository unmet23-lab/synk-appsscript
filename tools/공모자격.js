#!/usr/bin/env node
'use strict';
/**
 * 공모 응모 자격 확인 — 공모 지도의 열린 공모 가운데 자격 판정이 없거나 오래된 공고를 확인한다(2026-11-20).
 * 판정 규칙과 까닭은 tools/lib/contest-eligibility.cjs 머리말에 있다.
 *
 * 쓰기:
 *   node tools/공모자격.js                       판정이 없거나 7일 지난 열린 공고를 확인한다(카본, 기본 10분 안)
 *   node tools/공모자격.js --다시                「확인 필요」도 다시 확인한다(원문이 바뀌었거나 카본이 실패했을 때)
 *   node tools/공모자격.js --목록                판정을 보인다(안 됨 · 확인 필요 · 됨)
 *   node tools/공모자격.js --제외 "<제목 조각>" --까닭 "<까닭>"   사람이 확인한 자격 미달을 직접 넣는다
 *   --보관함 <폴더>   다른 지원사업 폴더(시험용) · --분 <숫자>   확인에 쓸 시간
 * 확인 뒤에는 node tools/공모지도.js로 지도를 다시 만든다.
 */
const 지도 = require('./공모지도.js');
const 자격 = require('./lib/contest-eligibility.cjs');

function 값(argv, 옵션) {
  if (!argv.includes(옵션)) return '';
  const v = argv[argv.indexOf(옵션) + 1];
  if (!v || v.startsWith('--')) throw Error(옵션 + ' 다음에 값을 적어 주세요.');
  return v;
}

/** 지도에 실릴 열린 공고 — 자격 판정을 빼고 걸러 판정 없는 것까지 모두 본다. */
function 후보(보관함) {
  const { 현황, 통합 } = 지도.읽기(보관함);
  const 기준일 = 지도.오늘();
  const 원본 = new Map((통합.items || []).map(o => [o.id, o]));
  // 공고에 딸린 주소를 모두 모은다(공식 원문, 발견한 모음 사이트, 옛 장부의 링크).
  const 딸린주소 = o => [...new Set((JSON.stringify(o || {}).match(/https?:\/\/[^\s"'<>)\\\]]+/g) || []))].slice(0, 8);
  // 판정의 공고 원문 마감을 쓰고(늘어난 마감) 「안 됨」도 넣어 7일마다 다시 본다.
  const 판정 = 자격.판정읽기(보관함);
  return 지도.열린영상(통합, 현황, 기준일, new Date(), 판정, { 안됨포함: true }).map(o => ({ 제목: o.전체이름, 주소: o.주소, 주소들: 딸린주소(원본.get(o.id)), 마감: o.마감 || '' }));
}

async function main(argv) {
  const 보관함 = 값(argv, '--보관함') || 지도.기본보관함;
  if (argv.includes('--제외')) {
    const v = 자격.수동제외(보관함, 값(argv, '--제외'), 값(argv, '--까닭'));
    console.log(`넣었다: 「${v.title}」 안 됨 — ${v.reason}`);
    return 0;
  }
  if (argv.includes('--목록')) {
    const 판정 = 자격.판정읽기(보관함);
    for (const status of ['안 됨', '확인 필요', '됨']) {
      const xs = Object.values(판정.items).filter(v => v.status === status);
      console.log(`== ${status} ${xs.length}건`);
      for (const v of xs) console.log(`  - ${v.title} — ${v.reason}${v.by === '수동' ? ' (수동)' : ''}`);
    }
    return 0;
  }
  const 분 = Number(값(argv, '--분') || 10);
  const 결과 = await 자격.자격확인(보관함, 후보(보관함), { budgetMs: 분 * 60000, 확인필요다시: argv.includes('--다시') });
  console.log(JSON.stringify(결과));
  const 판정 = 자격.판정읽기(보관함);
  const 셈 = s => Object.values(판정.items).filter(v => v.status === s).length;
  console.log(`판정: 안 됨 ${셈('안 됨')} · 확인 필요 ${셈('확인 필요')} · 됨 ${셈('됨')}. 지도는 node tools/공모지도.js로 다시 만든다.`);
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; })
  .catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { 후보 };
