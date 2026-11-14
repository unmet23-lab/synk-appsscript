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
 * 최종 확인 예약 작업(synk-sns-final-check, 3시간마다 — 11-15 유호님 「예약으로 바꿔」)과 제작 회차가 쓰는 것:
 *   node tools/최종확인.js 대기 [--json] [--폴더 docs/마케팅] [--오늘 YYYY-MM-DD]   다시 볼 편(제작이 「완성」이라 적었는데 기록이 없거나
 *        기록 뒤 영상이 바뀐 편). 오늘과 뒤 슬롯을 먼저, 지난 슬롯을 뒤에 둔다. 다른 회차가 맡은 편은 「맡음」으로 보인다.
 *        없으면 「다시 볼 편 없음」 한 줄. 통과 · 작은 흠인데 그 판정보다 먼저 걸린 자동 등록 중지 표식에 막힌 편은 「등록할 편」으로,
 *        읽지 못한 편은 「못 읽은 편(보고만)」으로 따로 적고 셈에 넣지 않는다. 끝 코드는 늘 0이다
 *   node tools/최종확인.js 고칠편 [<브랜드>] [--json] [--오늘 YYYY-MM-DD]   최종 확인 「미흡」 뒤 새 판이 없는 편(슬롯이 3일 넘게 지난 편은 뺌).
 *        제작 회차가 목표 칸보다 먼저 고친다(제작절차.md 0단계). 고칠 것은 그 편 기획.md 끝 「최종 확인 미흡」 절과 기록 메모에 있다.
 *        「슬롯 지남」 편은 고친 뒤 목표 칸으로 슬롯과 판 시각을 옮긴다
 *   node tools/최종확인.js 맡기 <편 폴더> --누가 "<회차 이름>"   이 편을 맡는다. 지금 「다시 볼 차례」가 아니거나, 같은 영상을 이미 판정해
 *        올렸거나, 다른 회차가 2시간 안에 맡았으면 끝 코드 1(건너뛴다). 같은 이름으로 다시 부르면 시각만 새로 찍는다(단계마다 부른다)
 *   node tools/최종확인.js 놓기 <편 폴더> [--누가 "<회차 이름>"]   올린 뒤 부른다. 기록이 지금 영상과 맞고 origin/master에 올라갔으면
 *        「판정 끝」 표시로 바꿔 다른 작업본이 따라오기 전에 또 맡지 않게 하고, 아니면(판정 없이 손을 뗌 · 못 올림) 맡음만 지운다
 *
 * 쓰는 곳: 편 폴더 게시/최종확인.json — 결과 · 시각 · 메모 · 판이 쓰는 영상과 「최종본」마다 경로 · 바이트 · SHA-256.
 * 영상이 하나라도 바뀌면 기록은 무효(다시 컷 전수). 이 파일은 저장소에 함께 올린다 — 예약큐(운영 사본)가 origin에서 읽는다.
 * 관문: tools/작업실예약.js의 planBundle(대기열 · 명시 등록 모두)이 tools/lib/최종확인.js problem()을 판마다의 까닭으로 넣는다.
 */
const path = require('node:path');
const 묶음 = require('./lib/게시묶음.js');
const 확인 = require('./lib/최종확인.js');

const REPO = path.resolve(__dirname, '..');

// 오늘(이 PC의 날짜 — 한국 시각) YYYY-MM-DD
function today() { return new Date().toLocaleDateString('sv-SE'); }

function listLine(x) {
  if (x.차례 === '못 읽음') return `${x.편} | 못 읽음 — ${x.까닭}`;
  const 맡음 = x.맡음 ? ` · 맡음: ${x.맡음.누가}(${x.맡음.시각.slice(0, 16).replace('T', ' ')} UTC)` : '';
  return `${x.슬롯 || '슬롯 없음'} | ${x.편} | ${x.까닭 || x.차례}${맡음}\n    볼 영상: ${x.볼영상 || '없음'}`;
}

function main(argv) {
  const 동사들 = ['통과', '작은흠', '미흡', '상태', '대기', '고칠편', '맡기', '놓기'];
  const optionValues = new Set(['--메모', '--독립검수', '--검수', '--갈래', '--누가', '--폴더', '--오늘'].map((n) => argv.indexOf(n)).filter((i) => i >= 0).map((i) => i + 1));
  const verb0 = argv.find((a, i) => !optionValues.has(i) && 동사들.includes(a)) || '상태';
  const dir = argv.find((a, i) => !optionValues.has(i) && !a.startsWith('--') && !동사들.includes(a));
  const verb = verb0 === '작은흠' ? '작은 흠' : verb0;
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const root = path.resolve(opt('--폴더') || path.join(REPO, 'docs', '마케팅'));
  if (verb === '대기') {
    const day = opt('--오늘') || today();
    const all = 확인.scan(root);
    // 오늘과 뒤 슬롯이 먼저 — 지난 슬롯 편이 회차 시간을 먼저 쓰지 않게(11-15 Fable 검수 P2)
    const list = all.filter((x) => x.차례 === '다시 볼 차례').sort((a, b) => Number(a.슬롯 < day) - Number(b.슬롯 < day) || a.슬롯.localeCompare(b.슬롯) || a.편.localeCompare(b.편));
    const broken = all.filter((x) => x.차례 === '못 읽음');
    const toRegister = all.filter((x) => x.차례 === '등록 기다림').sort((a, b) => Number(a.슬롯 < day) - Number(b.슬롯 < day) || a.슬롯.localeCompare(b.슬롯));
    if (argv.includes('--json')) { console.log(JSON.stringify({ 다시볼편: list, 등록할편: toRegister, 못읽은편: broken }, null, 2)); return 0; }
    console.log(list.length ? `다시 볼 편 ${list.length}개(오늘과 뒤 슬롯 먼저):` : '다시 볼 편 없음');
    for (const x of list) console.log(listLine(x));
    if (toRegister.length) {
      console.log(`등록할 편(통과 · 작은 흠인데 옛 자동 등록 중지 표식에 막힘 — 명시 등록) ${toRegister.length}개:`);
      for (const x of toRegister) console.log(`${x.슬롯} | ${x.편} | ${x.기록?.결과} ${String(x.기록?.시각 || '').slice(0, 16)}`);
    }
    if (broken.length) {
      console.log(`못 읽은 편(보고만 — 회차를 열 까닭이 아니다) ${broken.length}개:`);
      for (const x of broken) console.log(listLine(x));
    }
    return 0;
  }
  if (verb === '고칠편') {
    const list = 확인.needsFix(root, dir || '', opt('--오늘') || today());
    if (argv.includes('--json')) { console.log(JSON.stringify(list, null, 2)); return 0; }
    if (!list.length) { console.log(`최종 확인에서 고칠 편 없음${dir ? `(${dir})` : ''}`); return 0; }
    console.log(`최종 확인 미흡 뒤 아직 고치지 않은 편 ${list.length}개 — 목표 칸 새 편보다 먼저 고친다:`);
    for (const x of list) console.log(`${x.슬롯}${x.지남 ? '(슬롯 지남 — 고친 뒤 목표 칸으로 옮긴다)' : ''} | ${x.편} | ${x.기록?.시각?.slice(0, 16) || ''} 미흡 — ${String(x.기록?.메모 || '').slice(0, 300)}`);
    return 0;
  }
  if (!dir) {
    console.error('사용: node tools/최종확인.js 대기 · 고칠편 [브랜드] · <편 폴더> 맡기 --누가 "…" · <편 폴더> 놓기 · <편 폴더> 통과|작은흠|미흡|상태 [--메모 "…"] [--갈래 멈춘화면,끝약함,…(작은흠 · 미흡에는 꼭)] [--독립검수 "누가 · 판정"] [--검수 <이름>]');
    return 2;
  }
  let bundle;
  try { bundle = 묶음.load(path.resolve(dir)); } catch (error) { console.error(`편을 읽지 못했다 — ${error.message}`); return 2; }
  if (verb === '맡기') {
    let r;
    try { r = 확인.take(bundle, opt('--누가')); } catch (error) { console.error(`맡지 못했다 — ${error.message}`); return 2; }
    if (!r.ok) { console.log(`${bundle.name}: 건너뛴다 — ${r.까닭}`); return 1; }
    console.log(`${bundle.name}: 맡음 — ${r.맡음.누가}(${확인.LOCK_HOURS}시간 동안. 단계마다 같은 이름으로 다시 맡아 시각을 잇고, 올린 뒤 「놓기」)`);
    return 0;
  }
  if (verb === '놓기') {
    const m = 확인.finish(bundle, opt('--누가') || '');
    console.log(m.끝남 ? `${bundle.name}: 판정 끝 표시(「${m.끝남}」) — 같은 영상은 다시 맡지 않는다` : `${bundle.name}: 맡음을 지웠다 — ${m.까닭}`);
    return 0;
  }
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
  console.log(`  올리기: node tools/바로올리기.js "${path.relative(bundle.repo, 확인.recordFile(bundle))}" -m "…" --실행 → 올린 뒤 node tools/최종확인.js "${dir}" 놓기 --누가 "…"`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main };
