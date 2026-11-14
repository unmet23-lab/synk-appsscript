#!/usr/bin/env node
'use strict';
/**
 * 최종 확인(컷 전수) 기록 — SNS 두 브랜드(synkbrief · yuhobuilds) 편은 이 기록이 「통과」이고 그 뒤 영상이 그대로여야 작업실에 등록된다(11-13).
 *
 *   node tools/최종확인.js <편 폴더> 통과 --메모 "무엇을 봤나(0.5초 시트 · 1/8초 띠 · 얼굴 · 받아쓰기 · 음량 · 안전선 · 최종본 검사)"
 *        --독립검수 "맥락 없는 Fable 5.2 — 다시 구울 컷 없음"(통과에는 꼭) [--검수 <세션 · 사람>]
 *   node tools/최종확인.js <편 폴더> 작은흠 --메모 "남은 작은 흠(다음 편 검사 항목으로 넘길 것)" --독립검수 "누가 · 판정"
 *        시청자가 평소 속도로 한 번 봐서는 알아채기 어려운 흠만 남은 편 — 등록된다(11-15 유호님 「작은 흠은 올리기」)
 *   node tools/최종확인.js <편 폴더> 미흡 --메모 "걸린 것" --갈래 멈춘화면,끝약함
 *        --갈래는 작은흠과 미흡에 꼭 붙인다(tools/lib/최종확인.js KINDS). 판정마다 게시/최종확인_이력.jsonl에 한 줄이 쌓이고
 *        node tools/흠장부.js 가 편들을 모아 되풀이된 갈래를 센다 — 다음 편이 같은 실수를 하지 않게 콘티 전에 읽는다
 *   node tools/최종확인.js <편 폴더> [상태]            지금 등록을 막는 까닭(없으면 「통과 — 등록 가능」)
 *
 * 쓰는 곳: 편 폴더 게시/최종확인.json — 결과 · 시각 · 메모 · 판이 쓰는 영상과 「최종본」마다 경로 · 바이트 · SHA-256.
 * 영상이 하나라도 바뀌면 기록은 무효(다시 컷 전수). 이 파일은 저장소에 함께 올린다 — 예약큐(운영 사본)가 origin에서 읽는다.
 * 관문: tools/작업실예약.js의 planBundle(대기열 · 명시 등록 모두)이 tools/lib/최종확인.js problem()을 판마다의 까닭으로 넣는다.
 */
const path = require('node:path');
const 묶음 = require('./lib/게시묶음.js');
const 확인 = require('./lib/최종확인.js');

function main(argv) {
  const 동사들 = ['통과', '작은흠', '미흡', '상태'];
  const optionValues = new Set(['--메모', '--독립검수', '--검수', '--갈래'].map((n) => argv.indexOf(n)).filter((i) => i >= 0).map((i) => i + 1));
  const dir = argv.find((a, i) => !optionValues.has(i) && !a.startsWith('--') && !동사들.includes(a));
  const verb0 = argv.find((a, i) => !optionValues.has(i) && 동사들.includes(a)) || '상태';
  const verb = verb0 === '작은흠' ? '작은 흠' : verb0;
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  if (!dir) {
    console.error('사용: node tools/최종확인.js <편 폴더> 통과|작은흠|미흡|상태 [--메모 "…"] [--갈래 멈춘화면,끝약함,…(작은흠 · 미흡에는 꼭)] [--독립검수 "누가 · 판정"] [--검수 <이름>]');
    return 2;
  }
  const bundle = 묶음.load(path.resolve(dir));
  if (verb === '상태') {
    if (!확인.required(bundle.prep)) { console.log(`${bundle.name}: 최종 확인 관문 밖(브랜드 ${bundle.prep.브랜드 || '없음'} · 슬롯 ${bundle.prep.슬롯 || '없음'})`); return 0; }
    const why = 확인.problem(bundle);
    const 기록 = 확인.read(bundle);
    console.log(why ? `${bundle.name}: 막힘 — ${why}` : `${bundle.name}: ${기록 && 기록.결과 === '작은 흠' ? '작은 흠' : '통과'} — 등록 가능`);
    return why ? 1 : 0;
  }
  const memo = opt('--메모');
  if (!memo || !memo.trim()) { console.error('--메모 "…"가 있어야 한다 — 통과면 무엇을 봤는지, 작은 흠이면 남은 흠, 미흡이면 무엇이 걸렸는지'); return 2; }
  let r;
  try { r = 확인.write(bundle, verb, memo, { 검수: opt('--검수') || '', 독립검수: opt('--독립검수') || '', 갈래: opt('--갈래') || '' }); } catch (error) { console.error(error.message); return 2; }
  console.log(`${bundle.name}: 최종 확인 ${r.결과} 기록 — ${path.relative(bundle.repo, 확인.recordFile(bundle))} · 영상 ${r.파일.length}개`);
  console.log(`  올리기: node tools/바로올리기.js "${path.relative(bundle.repo, 확인.recordFile(bundle))}" -m "…" --실행`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
