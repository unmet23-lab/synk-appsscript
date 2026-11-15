'use strict';
/* 흠 장부(tools/흠장부.js) — 편 폴더의 흠 기록을 슬롭 점검표 번호로 모아 만드는 길마다 센다(2026-11-15 설계 1단계로 다시 씀).
 * 맹검 번호 꼴 맞추기 · 맹검 기각은 세기만 · 「올릴 차례」 15%(적어도 세 편) · 길 나누기 · 갈래 없는 옛 기록은 미분류 · 낼 수 없는 숫자는 「자료 없음」 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 장부 = require('../tools/흠장부.js');

const 기준 = 장부.기준읽기();
const 임시 = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'flaw-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const jsonl = (xs) => xs.map((x) => JSON.stringify(x)).join('\n') + '\n';
const 때 = (일) => `2026-11-${String(일).padStart(2, '0')}T10:00:00.000Z`;

function 편(root, 이름, { 브랜드 = 이름.split('_')[0], 컷표 = false, 확인 = null, 옛기록 = null, 검사 = null, 맹검 = null } = {}) {
  const d = path.join(root, 이름, '게시');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '준비.json'), JSON.stringify({ 브랜드 }));
  if (컷표) fs.writeFileSync(path.join(root, 이름, '컷표.json'), '{"틀":2}');
  if (확인) fs.writeFileSync(path.join(d, '최종확인_이력.jsonl'), jsonl(확인));
  if (옛기록) fs.writeFileSync(path.join(d, '최종확인.json'), JSON.stringify(옛기록));
  if (검사) fs.writeFileSync(path.join(d, '검사이력.jsonl'), jsonl(검사));
  if (맹검) fs.writeFileSync(path.join(d, '미학맹검.json'), JSON.stringify(맹검));
  return path.join(root, 이름);
}
const 세기 = (root, 길) => {
  const 편들 = 장부.모으기(root, 기준).filter((p) => p.길 === 길);
  return 장부.길세기(편들, 기준);
};
const 줄of = (s, 열쇠) => s.줄.find((c) => c.열쇠 === 열쇠);

test('맹검 번호 꼴 맞추기 — [K7] · [K07]은 점검표 7, [C10] · [C010]은 모음 C010, [G3] · [P012]와 글 속 컷 이름은 열쇠가 아니다', () => {
  assert.deepEqual(장부.맹검열쇠들('[K7] 끝 화면이 판 · [K07] 또 · [C10] 강조 글 · [C010] 같은 지적 · [G3] 통과한 판 · [P012] 강점 · C10 컷의 손'), ['#7', 'C010']);
  assert.deepEqual(장부.맹검열쇠들('[K26] 사람 굳음 [c78]'), ['#26', 'C078']);
  assert.deepEqual(장부.갈래열쇠('사람굳음', 기준), '#26');
  assert.deepEqual([장부.갈래열쇠('26', 기준), 장부.갈래열쇠('K26', 기준), 장부.갈래열쇠('#26', 기준)], ['#26', '#26', '#26']);
  assert.equal(장부.갈래열쇠('숫자불일치', 기준), '항목:숫자불일치', '번호가 없는 갈래는 이름으로 센다');
});

test('실제 맹검 기록의 약점 번호를 모두 읽는다 — 공용 작업본의 미학맹검.json에서 [K…] · [C…]를 빠짐없이 열쇠로', (t) => {
  const 마케팅 = path.join(__dirname, '..', 'docs', '마케팅');
  let 셈 = 0, 읽음 = 0;
  for (const 이름 of fs.existsSync(마케팅) ? fs.readdirSync(마케팅) : []) {
    const p = path.join(마케팅, 이름, '게시', '미학맹검.json');
    if (!fs.existsSync(p)) continue;
    for (const s of JSON.parse(fs.readFileSync(p, 'utf8')).낱장 || []) {
      for (const w of s.약점 || []) {
        const 꼴 = String(w).match(/\[\s*[KkCc]\s*\d{1,3}\s*\]/g) || [];
        셈 += new Set(꼴.map((x) => x.replace(/\s/g, '').toUpperCase().replace(/^\[([KC])0*(\d+)\]$/, '$1$2'))).size;
        읽음 += 장부.맹검열쇠들(w).length;
      }
    }
  }
  if (!셈) t.skip('맹검 기록이 없는 작업본');
  else assert.equal(읽음, 셈);
});

test('맹검 기각은 세기만 한다 — 다섯 편에서 기각돼도 올릴 차례가 아니고, 최종 확인 · 기계 검사 편 수에도 안 든다', (t) => {
  const root = 임시(t);
  for (let i = 1; i <= 5; i += 1) 편(root, `LAB_맹검${i}`, { 맹검: { 만든때: 때(i), 낱장: [{ 판정: '기각', 약점: ['[K26] 굳음', '[C010] 글자'] }, { 판정: '고쳐서 냄', 약점: ['[K8] 틀'] }] } });
  const s = 세기(root, 'LAB');
  assert.deepEqual([줄of(s, '#26').맹검편, 줄of(s, '#26').편수, 줄of(s, '#26').올릴차례], [5, 0, false]);
  assert.equal(줄of(s, 'C010').맹검편, 5);
  assert.ok(!줄of(s, '#8'), '「고쳐서 냄」 화면의 약점은 세지 않는다');
});

test('올릴 차례 — 그 길의 최근 스무 편 가운데 세 편(15%) 이상, 최종 확인과 기계 검사의 흠만, 기계 규칙은 점검표 번호에 이은 것만', (t) => {
  const root = 임시(t);
  // 그래픽 길 21편: 1~20일은 최근 스무 편, 0일(가장 오래)은 스물한째
  for (let i = 0; i <= 20; i += 1) {
    const 확인 = [{ 결과: '통과', 시각: 때(i + 1), 갈래: [] }];
    if ([5, 9].includes(i)) 확인.unshift({ 결과: '미흡', 시각: 때(i), 갈래: ['멈춘화면'] });   // #20 — 최종 확인 두 편
    if (i === 0) 확인.unshift({ 결과: '미흡', 시각: 때(1), 갈래: ['20'] });                    // 스물한째 편 — 최근 스물 밖
    const 검사 = [];
    if (i === 12) 검사.push({ 때: 때(13), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'final-cut-굳음', 등급: '걸림', 글: '굳음' }] });
    if ([3, 4, 6].includes(i)) 검사.push({ 때: 때(i + 1), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'slot', 등급: '걸림', 글: '슬롯' }] });
    if ([7, 8, 10].includes(i)) 검사.push({ 때: 때(i + 1), 단계: '올리기 전', 눈: '올리기전검사', 결과: '확인', 걸림: [{ 규칙: 'still', 번호: 20, 등급: '확인', 글: '확인만' }] });
    편(root, `synkbrief_편${String(i).padStart(2, '0')}`, { 확인, 검사 });
  }
  let s = 세기(root, '그래픽');
  assert.equal(s.편수, 20);
  assert.deepEqual([줄of(s, '#20').편수, 줄of(s, '#20').올릴차례], [2, false], '두 편은 15%(세 편)에 못 미친다 · 스물한째 편과 「확인」 등급은 안 센다');
  assert.equal(줄of(s, '#26').기계편, 1, 'final-cut-굳음은 최종본검사 굳음과 같은 26번');
  assert.deepEqual([줄of(s, '규칙:올리기전검사:slot').편수, 줄of(s, '규칙:올리기전검사:slot').올릴차례], [3, false], '번호에 안 이은 운영 규칙은 올리지 않는다');
  // 셋째 편이 나면 올릴 차례
  편(root, 'synkbrief_편15', { 확인: [{ 결과: '미흡', 시각: 때(16), 갈래: ['K20'] }, { 결과: '통과', 시각: 때(16), 갈래: [] }] });
  s = 세기(root, '그래픽');
  assert.deepEqual([줄of(s, '#20').편수, 줄of(s, '#20').최종편, 줄of(s, '#20').올릴차례, 줄of(s, '#20').상태], [3, 3, true, '올릴 차례']);
  assert.equal(장부.올릴편수, 3);
  assert.equal(장부.올릴비율, 0.15);
});

test('길 나누기 — 브랜드 LAB은 LAB, 컷표.json · 컷순서.json이 있으면 컷표영상, 그 밖은 그래픽. 셈은 길마다 따로', (t) => {
  const root = 임시(t);
  const 흠 = (일) => [{ 결과: '미흡', 시각: 때(일), 갈래: ['사람굳음'] }];
  편(root, 'LAB_가', { 브랜드: 'LAB', 확인: 흠(1) });
  편(root, 'synkbrief_컷표', { 컷표: true, 확인: 흠(2) });
  const 컷순서 = 편(root, 'yuhobuilds_컷순서', { 확인: 흠(3) });
  fs.writeFileSync(path.join(컷순서, '컷순서.json'), '{}');
  편(root, 'yuhobuilds_그래픽', { 확인: 흠(4) });
  const 길 = Object.fromEntries(장부.모으기(root, 기준).map((p) => [p.편, p.길]));
  assert.deepEqual(길, { LAB_가: 'LAB', synkbrief_컷표: '컷표영상', yuhobuilds_컷순서: '컷표영상', yuhobuilds_그래픽: '그래픽' });
  assert.equal(줄of(세기(root, '컷표영상'), '#26').편수, 2);
  assert.equal(줄of(세기(root, '그래픽'), '#26').편수, 1);
});

test('갈래 없는 옛 기록은 미분류로만 센다 — 메모 글로 어림하지 않는다(「음량 −14.6 LUFS」를 소리 흠으로 세던 일)', (t) => {
  const root = 임시(t);
  편(root, 'yuhobuilds_옛', { 옛기록: { 결과: '미흡', 시각: 때(1), 메모: '음량 −14.6 LUFS · 안경이 클로즈업끼리 다름 · 6초 멈춘 표' } });
  const s = 세기(root, '그래픽');
  assert.equal(s.미분류, 1);
  assert.deepEqual(s.줄, []);
});

test('숫자 — 첫 판 통과율 · 편당 판정 수는 이력이 있는 편만(옛 기록은 뺌), 맨 끝 관문 비율은 두 기록이 다 있을 때만, 없으면 「자료 없음」', (t) => {
  const root = 임시(t);
  편(root, 'synkbrief_첫통과', { 확인: [{ 결과: '작은 흠', 시각: 때(2), 갈래: ['소품튐'] }] });
  편(root, 'synkbrief_두판', {
    확인: [{ 결과: '미흡', 시각: 때(3), 갈래: ['사람굳음', '끝약함'] }, { 결과: '통과', 시각: 때(4), 갈래: [] }],
    검사: [{ 때: 때(2), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'final-cut-굳음', 등급: '걸림', 글: '굳음' }] }],
  });
  편(root, 'synkbrief_옛', { 옛기록: { 결과: '통과', 시각: 때(1) } });
  const s = 세기(root, '그래픽');
  assert.equal(s.숫자.첫판통과율, '1/2(50%)');
  assert.equal(s.숫자.편당판정수, '1.5');
  assert.match(s.숫자.첫판통과율_분모, /옛 기록.*1개는 뺌/);
  // 두판: 최종 확인이 잡은 #26 · #2 가운데 #26은 앞선 기계 검사가 먼저 잡았다 → 맨 끝에서 처음 잡힌 것은 #2 하나
  assert.equal(s.숫자.맨끝비율, '1/2(50%)');
  const 빈 = 임시(t);
  편(빈, 'LAB_기록만', { 브랜드: 'LAB', 맹검: { 만든때: 때(1), 낱장: [{ 판정: '기각', 약점: ['[K2] 끝'] }] } });
  const l = 세기(빈, 'LAB');
  assert.deepEqual([l.숫자.첫판통과율, l.숫자.편당판정수, l.숫자.맨끝비율], ['자료 없음', '자료 없음', '자료 없음']);
});

test('깊은 연재 폴더의 같은 이름 회차(A/E01 · B/E01 · C/E01)는 서로 다른 세 편으로 센다(GPT 검수 GA2)', (t) => {
  const root = 임시(t);
  for (const s of ['A', 'B', 'C']) 편(path.join(root, `PULSE_${s}`, 'Still'), 'E01', { 브랜드: 'PULSE', 컷표: true, 확인: [{ 결과: '미흡', 시각: 때(1), 갈래: ['사람굳음'] }] });
  const s = 세기(root, '컷표영상');
  assert.equal(s.편수, 3);
  assert.deepEqual([줄of(s, '#26').편수, 줄of(s, '#26').올릴차례], [3, true]);
});

test('최종 확인 단계에서 돈 기계 검사는 「앞선 검사」가 아니고, 앞선 기계 검사가 먼저 잡은 흠은 「검사가 못 잡음」이 아니다(GPT 검수 GA3 · GA4)', (t) => {
  const root = 임시(t);
  // 가: 최종 확인 묶음의 최종본 검사가 처음 잡고 사람이 미흡으로 적음 → 맨 끝에서 처음 잡힌 흠
  편(root, 'synkbrief_가', {
    검사: [{ 때: 때(14), 단계: '최종 확인', 눈: '최종본검사', 결과: '걸림', 걸림: [{ 규칙: '굳음', 번호: 26, 등급: '걸림', 글: '굳음' }] }],
    확인: [{ 결과: '미흡', 시각: 때(15), 갈래: ['사람굳음'] }],
  });
  let s = 세기(root, '그래픽');
  assert.equal(s.숫자.맨끝비율, '자료 없음', '앞선 단계 기계 검사가 없는 편은 분모에 안 든다');
  // 나: 올리기 전 검사가 먼저 잡았는데 최종 확인에도 적힘 → 맨 끝에서 처음 잡힌 흠이 아니고, 검사가 못 잡은 것도 아니다
  편(root, 'synkbrief_나', {
    검사: [{ 때: 때(14), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'final-cut-굳음', 등급: '걸림', 글: '굳음' }] }],
    확인: [{ 결과: '미흡', 시각: 때(15), 갈래: ['사람굳음'] }],
  });
  s = 세기(root, '그래픽');
  assert.equal(s.숫자.맨끝비율, '0/1(0%)');
  assert.match(줄of(s, '#26').상태, /검사가 못 잡음 — .*1번/, '가 편 하나만 못 잡음으로 센다');
  const 나만 = 장부.길세기(장부.모으기(root, 기준).filter((p) => p.편 === 'synkbrief_나'), 기준);
  assert.match(줄of(나만, '#26').상태, /^검사로 올림/);
  // 다: 최종 확인 단계 검사만 있고 앞선 단계 검사가 있는 편에서 처음 잡힌 흠 → 1/1
  편(root, 'synkbrief_다', {
    검사: [{ 때: 때(13), 단계: '올리기 전', 눈: '올리기전검사', 결과: '통과', 걸림: [] },
      { 때: 때(14), 단계: '최종 확인', 눈: '최종본검사', 결과: '걸림', 걸림: [{ 규칙: '굳음', 번호: 26, 등급: '걸림', 글: '굳음' }] }],
    확인: [{ 결과: '미흡', 시각: 때(15), 갈래: ['26'] }],
  });
  const 다만 = 장부.길세기(장부.모으기(root, 기준).filter((p) => p.편 === 'synkbrief_다'), 기준);
  assert.equal(다만.숫자.맨끝비율, '1/1(100%)');
});

test('명령: 길 · 브랜드로 거르고(옛 「<브랜드>」 부름도 받는다), 모르는 이름은 끝 코드 2, 깊은 편 폴더도 찾는다', (t) => {
  const root = 임시(t);
  편(root, 'synkbrief_가', { 확인: [{ 결과: '미흡', 시각: 때(1), 갈래: ['끝약함'] }] });
  편(path.join(root, 'PULSE_연재', 'Still'), 'E01', { 브랜드: 'PULSE', 컷표: true, 확인: [{ 결과: '미흡', 시각: 때(2), 갈래: ['사람굳음'] }] });
  const 찍기 = (args) => {
    const 앞 = console.log, 앞e = console.error, 글 = [];
    console.log = (x) => 글.push(String(x)); console.error = (x) => 글.push(String(x));
    try { return { 코드: 장부.main([...args, '--폴더', root]), 글: 글.join('\n') }; } finally { console.log = 앞; console.error = 앞e; }
  };
  assert.match(찍기([]).글, /\[컷표영상\][\s\S]*\[그래픽\]/);
  assert.equal(찍기(['synkbrief']).코드, 0);
  assert.doesNotMatch(찍기(['synkbrief']).글, /컷표영상/);
  assert.match(찍기(['컷표영상']).글, /#26/);
  assert.equal(찍기(['없는브랜드']).코드, 2);
  const j = JSON.parse(찍기(['--json']).글);
  assert.deepEqual(Object.keys(j.길).sort(), ['그래픽', '컷표영상']);
});
