#!/usr/bin/env node
/* 시험 결과에서 «사람이 볼 줄»만 뽑는다 — 맞은 줄은 안 올린다.
 *
 * ■ 왜
 *   28칸을 다 읽으라고 하면 아무도 안 읽는다. 사람 눈이 값진 자리는 넷뿐이다:
 *     ① 정답지와 어긋난 줄  ② 두 모델이 서로 갈린 줄  ③ 답을 못 읽은 줄(오류·판정불능·결과 행 없음)
 *     ④ 판정은 맞는데 **채점 부품이 떨어진 줄** — 「어색」이라 하고서 입력에 없는 문장을 근거로 든 답(근거채점)
 *   ②는 정답지가 없는 자리에서 «어느 쪽이 맞는지»를 사람만 가를 수 있는 자리다.
 *   ④는 09-02 에 더했다(codex P1 7d941e08dcbe·f8dd5e4e67c7) — 답(판정)만 읽는 자는 promptfoo 가 이미 실패로
 *   채점한 «지어낸 근거»를 못 봤다. 판정이 맞아 보이는 줄이라 사람 검토에서도 빠졌다.
 *
 * ■ 부르는 법
 *   node evals/의심줄.js evals/_결과/결과.json
 *
 * ■ 함정
 *   - 결과 파일이 없거나 못 읽으면 **0건이 아니라 「확인 불가」로 죽는다.** 안 잰 것을
 *     「의심 줄 없음」으로 접으면 이 도구가 거짓말을 하게 된다.
 *   - promptfoo 판(0.122.x)에 따라 결과 JSON 모양이 바뀔 수 있다 — 줄을 하나도 못 찾으면
 *     「0건」이라고 말하지 않고 모양이 안 맞는다고 말한다.
 *   - 한 모델의 결과 행이 통째로 빠진 문항은 그 모델의 «못잼»으로 센다 — 없는 칸을 맞음 0·틀림 0 으로 두면
 *     점수판이 반쪽인데 반쪽인 줄을 모른다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 판정읽기 } = require(path.join(__dirname, '검문자.js'));

const 맞나 = (기대, 판정) => (기대 === '정상' ? 판정 === '정상' : 판정 !== null && 판정 !== '정상');

/* 판정채점 부품의 실패는 아래 `맞나` 가 이미 같은 말을 하므로 뺀다 — 한 사건을 두 줄로 올리지 않는다.
 * assertion 칸이 없는 판이면 사유 문구 모양(검문자.js 판정채점의 `기대 … · 모델 판정 …`)으로 가른다. */
function 판정채점부품인가(c) {
  if (/판정채점/.test(String((c.assertion || {}).value || ''))) return true;
  return /^기대 .* 모델 판정 /.test(String(c.reason || ''));
}

/** 결과 JSON 한 벌 → { 문항, 올릴것, 점수, 칸수 }. 순수 함수 — 시험(tests/의심줄.test.js)이 픽스처로 탐지력을 못 박는다. */
function 의심줄추출(원본) {
  const 결과들 = (원본.results && 원본.results.results) || (원본.results) || [];
  if (!Array.isArray(결과들) || !결과들.length) throw new Error('결과 JSON 안에서 칸(results)을 못 찾았다 — promptfoo 판이 바뀌었을 수 있다');

  // 문항별로 모아서, 모델끼리 나란히 본다.
  const 문항 = new Map();
  const 모델들 = new Set();
  for (const r of 결과들) {
    const v = (r.testCase && r.testCase.vars) || r.vars || {};
    const 이름 = (r.testCase && r.testCase.description) || v.근거 || '(이름 없음)';
    const 모델 = (r.provider && (r.provider.label || r.provider.id)) || '(모델 미상)';
    모델들.add(모델);
    /* ⚠ promptfoo 는 «채점 실패»에도 error 를 채운다 — 그것을 「호출이 안 됐다」로 읽으면
     *    실제로 답이 온 칸을 못 잰 칸으로 세게 된다(그 둘은 다른 사건이다). 답이 있으면 답을 읽는다. */
    const 답 = (r.response && r.response.output) ?? r.output;
    const 읽음 = 답 == null ? null : 판정읽기(typeof 답 === 'string' ? 답 : JSON.stringify(답));
    const 판정 = 읽음 ? 읽음.판정 : null;
    const 오류 = 답 == null ? (r.error || '답 없음') : null;
    // ④ 채점 부품의 실패 — 판정 말고 «근거»(지어낸 문장·키릴 아님)·모양(is-json)이 떨어진 것
    const 부품실패 = (((r.gradingResult || {}).componentResults) || [])
      .filter((c) => c && c.pass === false && !판정채점부품인가(c))
      .map((c) => String(c.reason || '(사유 없음)').replace(/\s+/g, ' ').slice(0, 120));
    if (!문항.has(이름)) 문항.set(이름, { 기대: v.기대, 몽골어: v.몽골어, 근거: v.근거, 칸: [] });
    문항.get(이름).칸.push({ 모델, 판정, 오류, 부품실패 });
  }
  // ③' 결과 행 자체가 빠진 모델 — 그 모델의 못잼이다(맞음도 틀림도 아닌 «안 잰 칸»)
  for (const [, f] of 문항) {
    for (const m of 모델들) {
      if (!f.칸.some((c) => c.모델 === m)) f.칸.push({ 모델: m, 판정: null, 오류: '결과 행 없음(호출·저장 누락)', 부품실패: [] });
    }
  }

  const 올릴것 = [];
  for (const [이름, f] of 문항) {
    const 사유 = [];
    for (const c of f.칸) {
      if (c.오류) 사유.push(`${c.모델}: 오류(${String(c.오류).slice(0, 80)})`);
      else if (c.판정 === null) 사유.push(`${c.모델}: 판정불능 — 답을 못 읽었다`);
      else if (!맞나(f.기대, c.판정)) 사유.push(`${c.모델}: ${c.판정} ← 기대 ${f.기대}`);
      for (const s of c.부품실패) 사유.push(`${c.모델}: 채점 부품 실패 — ${s}`);
    }
    const 판정들 = f.칸.filter((c) => c.판정).map((c) => c.판정);
    const 갈림 = new Set(판정들).size > 1;
    if (갈림) 사유.push('두 모델이 갈렸다 — ' + f.칸.map((c) => `${c.모델}=${c.판정 || '?'}`).join(' · '));
    if (사유.length) 올릴것.push({ 이름, f, 사유 });
  }

  /* 점수판 — 「합계 = 갈래 + 갈래」로 적는다. 못 잰 칸을 틀린 칸과 섞으면 0의 뜻이 흐려진다.
   * 근거흠 은 합계 밖의 곁 셈이다 — 판정은 맞았는데 근거가 떨어진 칸의 수(맞음 안에 들어 있다). */
  const 점수 = new Map();
  for (const [, f] of 문항) {
    for (const c of f.칸) {
      if (!점수.has(c.모델)) 점수.set(c.모델, { 맞음: 0, 틀림: 0, 못잼: 0, 근거흠: 0 });
      const s = 점수.get(c.모델);
      if (c.판정 === null) s.못잼++;
      else if (맞나(f.기대, c.판정)) s.맞음++;
      else s.틀림++;
      if (c.부품실패.length) s.근거흠++;
    }
  }
  return { 문항, 올릴것, 점수, 칸수: 결과들.length };
}

function main() {
  const 죽는다 = (말) => { console.error('🔴 확인 불가 — ' + 말); process.exit(1); };
  const 경로 = process.argv[2] || path.join(__dirname, '_결과', '결과.json');
  if (!fs.existsSync(경로)) 죽는다(`결과 파일이 없다 → ${경로}\n   먼저 시험을 돌려라(evals/README.md)`);

  let 원본;
  try { 원본 = JSON.parse(fs.readFileSync(경로, 'utf8')); }
  catch (e) { 죽는다(`결과 JSON 을 못 읽었다 — ${e.message}`); }

  let 뽑음;
  try { 뽑음 = 의심줄추출(원본); }
  catch (e) { 죽는다(e.message); }
  const { 문항, 올릴것, 점수, 칸수 } = 뽑음;

  console.log(`■ 몽골어 검문 시험 — 사람이 볼 줄`);
  console.log(`  문항 ${문항.size} · 칸 ${칸수} · 의심 줄 ${올릴것.length}`);
  console.log(`  (맞은 줄은 여기 안 올라온다 — 결과 전량은 ${경로})\n`);
  console.log('■ 점수판 (맞음 + 틀림 + 못잼 = 문항 수 · 근거 흠은 맞음 안의 곁 셈)');
  for (const [모델, s] of 점수) {
    console.log(`  ${모델.padEnd(14)} 맞음 ${s.맞음}/${문항.size} · 틀림 ${s.틀림} · 못잼 ${s.못잼}` +
      (s.근거흠 ? ` · 근거 흠 ${s.근거흠}` : '') +
      (s.못잼 ? '  🔴 못 잰 칸이 있다 — 이 점수는 아직 반쪽이다' : ''));
  }
  console.log('');

  if (!올릴것.length) {
    console.log('✅ 정답지와 어긋난 줄도, 두 모델이 갈린 줄도, 채점 부품이 떨어진 줄도 없다.');
    console.log('   ⚠ 이것은 「이 14문항에서」 그렇다는 말이지 「몽골어가 맞다」는 말이 아니다 — 몽골어=사람.');
    process.exit(0);
  }

  for (const { 이름, f, 사유 } of 올릴것) {
    console.log(`─ ${이름}`);
    console.log(`  몽골어: ${f.몽골어}`);
    console.log(`  근거:   ${f.근거 || '(없음)'}`);
    for (const s of 사유) console.log(`  🔴 ${s}`);
    console.log('');
  }
  console.log('→ 이 줄들만 사람이 본다. 「어느 쪽이 맞나」는 몽골어를 읽는 사람만 가른다.');
  process.exit(2);
}

module.exports = { 의심줄추출 };

if (require.main === module) main();
