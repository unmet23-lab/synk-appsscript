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
  // 나: 올리기 전 검사가 먼저 잡았는데 최종 확인에도 적힘 → 맨 끝에서 처음 잡힌 흠이 아니고, 검사가 못 잡은 것도 아니다 —
  // 기계가 잡았는데 넘어온 흠이다(11-15 3단계 — 예전에는 「검사로 올림」으로만 보여 넘어온 것이 안 보였다)
  편(root, 'synkbrief_나', {
    검사: [{ 때: 때(14), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'final-cut-굳음', 등급: '걸림', 글: '굳음' }] }],
    확인: [{ 결과: '미흡', 시각: 때(15), 갈래: ['사람굳음'] }],
  });
  s = 세기(root, '그래픽');
  assert.equal(s.숫자.맨끝비율, '0/1(0%)');
  assert.match(줄of(s, '#26').상태, /검사가 못 잡음 — .*1번 · 기계가 잡았는데 넘김 1번$/, '가 편 하나만 못 잡음으로, 나 편은 넘김으로 센다');
  const 나만 = 장부.길세기(장부.모으기(root, 기준).filter((p) => p.편 === 'synkbrief_나'), 기준);
  assert.equal(줄of(나만, '#26').상태, '기계가 잡았는데 넘김 — 올리기전검사가 먼저 띄웠는데 최종 확인에서 1번 다시 잡힘');
  assert.equal(줄of(나만, '#26').넘김, 1);
  // 다: 최종 확인 단계 검사만 있고 앞선 단계 검사가 있는 편에서 처음 잡힌 흠 → 1/1
  편(root, 'synkbrief_다', {
    검사: [{ 때: 때(13), 단계: '올리기 전', 눈: '올리기전검사', 결과: '통과', 걸림: [] },
      { 때: 때(14), 단계: '최종 확인', 눈: '최종본검사', 결과: '걸림', 걸림: [{ 규칙: '굳음', 번호: 26, 등급: '걸림', 글: '굳음' }] }],
    확인: [{ 결과: '미흡', 시각: 때(15), 갈래: ['26'] }],
  });
  const 다만 = 장부.길세기(장부.모으기(root, 기준).filter((p) => p.편 === 'synkbrief_다'), 기준);
  assert.equal(다만.숫자.맨끝비율, '1/1(100%)');
});

// ── 기계가 잡았는데 넘김(11-15 3단계 — 사람 굳음 세 편은 최종본 검사가 「확인할 것」으로 띄웠는데 장부에는 「검사가 못 잡음」으로 보였다) ──
test('시작 — 검사가 먼저 띄웠는데 넘겨서 최종 확인에서 다시 잡힌 흠은 「넘긴 흠」 묶음으로 따로 낸다(둘 이하) · 못 잡는 흠 묶음에 있는 흠은 거기에만', (t) => {
  const root = 마케팅(t);
  const 굳음띄움 = (n) => [{ 때: 날(n), 단계: '올리기 전', 눈: '올리기전검사', 결과: '확인', 걸림: [{ 규칙: 'final-cut-구간굳음', 번호: 26, 등급: '확인', 글: '최종본 · 38.5초부터 멎는다' }] }];
  편(root, 'synkbrief_가', { 검사: 굳음띄움(1), 확인: [{ 결과: '작은 흠', 시각: 날(2), 갈래: ['사람굳음'], 메모: '작은 흠: 38.5~41.9초 자세가 거의 그대로' }] });
  편(root, 'synkbrief_나', { 검사: 굳음띄움(3), 확인: [{ 결과: '미흡', 시각: 날(4), 갈래: ['사람굳음'], 메모: '미흡: 52초부터 두 사람이 멎는다' }] });
  const r = 장부.시작('그래픽', { 폴더: root });
  assert.deepEqual(r.줄, [], '검사가 띄운 흠은 「못 잡는 흠」이 아니다');
  assert.equal(r.넘김줄.length, 1);
  const n = r.넘김줄[0];
  assert.deepEqual([n.열쇠, n.편수, n.넘김, n.띄운검사, n.최근.편, n.최근.결과], ['#26', 2, 2, ['올리기전검사'], 'synkbrief_나', '미흡']);
  const 글 = 장부.시작글(r);
  assert.match(글, /^\[흠 장부\] 그래픽 · 최근 2편에서 검사가 띄웠는데 넘겨서 최종 확인에서 다시 잡힌 흠 1개 — 검사가 띄우면 넘기기 전에 그 자리를 고친다\n {2}· #26 [^\n]* — 2편 · 올리기전검사가 먼저 띄웠는데 최종 확인에서 2번 다시 잡힘 · 가장 최근 synkbrief_나\([^\n]*최종 확인 「미흡」\)[^\n]*$/);
  assert.doesNotMatch(글, /아직 못 잡는 흠/);
  // 못 잡는 흠이 함께 있으면 그 묶음이 먼저, 넘긴 흠 묶음이 뒤
  편(root, 'synkbrief_다', { 확인: [{ 결과: '작은 흠', 시각: 날(5), 갈래: ['인물튐'], 메모: '작은 흠: 끝 컷 얼굴이 둥글다' }] });
  const 둘 = 장부.시작글(장부.시작('그래픽', { 폴더: root }));
  assert.match(둘, /^\[흠 장부\] 그래픽 · 최근 3편에서 검사가 아직 못 잡는 흠 1개[^\n]*\n {2}· 인물튐[^\n]*\n {4}→ 할 것: [^\n]*\n\[흠 장부\] 그래픽 · 최근 3편에서 검사가 띄웠는데 넘겨서 최종 확인에서 다시 잡힌 흠 1개[^\n]*\n {2}· #26 [^\n]*$/);
  // 같은 흠을 띄우지 못한 편이 있으면 「검사가 못 잡음」 묶음에만 낸다(두 번 내지 않는다)
  편(root, 'synkbrief_라', { 확인: [{ 결과: '작은 흠', 시각: 날(6), 갈래: ['사람굳음'], 메모: '작은 흠: 2~5초 두 사람이 그대로' }] });
  const 셋 = 장부.시작('그래픽', { 폴더: root });
  assert.equal(셋.넘김줄, undefined);
  assert.deepEqual(셋.줄.filter((x) => x.열쇠 === '#26').map((x) => [x.까닭, x.놓침]), [['검사가 못 잡음', 1]]);
  // 넘긴 흠이 셋이어도 둘까지만
  const 많이 = 마케팅(t);
  const 띄움 = (규칙, 번호) => [{ 때: 날(1), 단계: '올리기 전', 눈: '올리기전검사', 결과: '확인', 걸림: [{ 규칙, 번호, 등급: '확인', 글: '띄움' }] }];
  편(많이, 'synkbrief_가', { 검사: 띄움('final-cut-구간굳음', 26), 확인: [{ 결과: '작은 흠', 시각: 날(2), 갈래: ['사람굳음'], 메모: '작은 흠: 굳음' }] });
  편(많이, 'synkbrief_나', { 검사: 띄움('final-cut-같은구도', 50), 확인: [{ 결과: '작은 흠', 시각: 날(2), 갈래: ['50'], 메모: '작은 흠: 같은 구도' }] });
  편(많이, 'synkbrief_다', { 검사: 띄움('final-cut-끝소리', 2), 확인: [{ 결과: '작은 흠', 시각: 날(2), 갈래: ['2'], 메모: '작은 흠: 끝이 약하다' }] });
  assert.equal(장부.시작('그래픽', { 폴더: 많이 }).넘김줄.length, 2);
});

test('넘김 — 앞선 기계 검사가 「확인」으로 띄운 흠이 최종 확인에서 다시 잡히면 「기계가 잡았는데 넘김」, 못 잡는 흠 묶음에는 안 낸다 · 못 잰 줄은 띄운 것이 아니다', (t) => {
  const root = 마케팅(t);
  // 가: 올리기 전 검사가 구간굳음을 확인할 것으로 띄움 → 최종 확인이 사람굳음을 작은 흠으로 적음
  편(root, 'synkbrief_가', {
    검사: [{ 때: 날(1), 단계: '올리기 전', 눈: '올리기전검사', 결과: '확인', 걸림: [{ 규칙: 'final-cut-구간굳음', 번호: 26, 등급: '확인', 글: '최종본 · 38.5초부터 멎는다' }] }],
    확인: [{ 결과: '작은 흠', 시각: 날(2), 갈래: ['사람굳음'], 메모: '작은 흠: 38.5~41.9초 자세가 거의 그대로' }],
  });
  // 나: 최종본 검사가 굳음을 「못 잼」(등급 확인)으로만 남김 → 띄운 것이 아니다 → 검사가 못 잡음
  편(root, 'synkbrief_나', {
    검사: [{ 때: 날(1), 단계: '편집', 눈: '최종본검사', 결과: '못 잼', 걸림: [{ 규칙: '굳음', 등급: '확인', 글: '못 잼 — FileNotFoundError' }] }],
    확인: [{ 결과: '작은 흠', 시각: 날(3), 갈래: ['사람굳음'], 메모: '작은 흠: 2~5초 두 사람이 그대로' }],
  });
  const s = 세기(root, '그래픽');
  const c = 줄of(s, '#26');
  assert.equal(c.넘김, 1);
  assert.match(c.상태, /^검사가 못 잡음 — [^\n]*최종 확인에서 1번 · 기계가 잡았는데 넘김 1번$/);
  assert.equal(c.편수, 2, '셈은 그대로 — 최종 확인 두 편(기계 「확인」은 편 수에 안 든다)');
  assert.equal(c.기계편, 0);
  assert.equal(s.숫자.넘김, '1번(1편)');
  assert.match(s.숫자.넘김_분모, /편 2개$/);
  const r = 장부.시작('그래픽', { 폴더: root });
  const 줄 = r.줄.find((x) => x.열쇠 === '#26');
  assert.deepEqual([줄.놓침, 줄.최근.편], [1, 'synkbrief_나'], '시작 줄은 띄우지 못한 나 편만 센다');
  const 가만 = 장부.길세기(장부.모으기(root, 기준).filter((p) => p.편 === 'synkbrief_가'), 기준);
  assert.match(줄of(가만, '#26').상태, /^기계가 잡았는데 넘김 — /);
  const 빈 = 마케팅(t);
  편(빈, 'synkbrief_다', { 확인: [{ 결과: '통과', 시각: 날(1), 갈래: [] }] });
  assert.equal(세기(빈, '그래픽').숫자.넘김, '자료 없음', '기계 기록이 없는 길은 「자료 없음」');
});

test('넘김 — 검사이력이 생기기 전의 판정은 게시/최종본검사.json(⑳의 마지막 잰 값)을 지금 영상과 같을 때만 「기계가 띄운 것」으로 읽는다', (t) => {
  const root = 마케팅(t);
  const 옛편 = (이름, { 영상 = true, 바꿈 = false, 이력 = null } = {}) => {
    const d = 편(root, 이름, {
      확인: [{ 결과: '작은 흠', 시각: 날(3), 갈래: ['사람굳음', '같은구도반복'], 메모: '작은 흠: 28~33초 사진처럼 그대로' }],
      ...(이력 ? { 검사: [{ 때: 이력, 단계: '올리기 전', 눈: '올리기전검사', 결과: '통과', 걸림: [] }] } : {}),
    });
    const f = path.join(d, '최종.mp4');
    fs.writeFileSync(f, 'video');
    const 수정 = new Date(Date.parse(날(1))).getTime() / 1000;
    fs.utimesSync(f, 수정, 수정);
    const st = fs.statSync(f);
    fs.writeFileSync(path.join(d, '게시', '최종본검사.json'), JSON.stringify({ [`docs/마케팅/${이름}/최종.mp4`]: {
      바이트: st.size, 수정: new Date(st.mtimeMs).toISOString(), 도구: 'abc', 결과: { 걸림: [{ 항목: '굳음', 초: 28.62 }, { 항목: '같은판', 초: 9.83 }] } } }));
    if (!영상) fs.rmSync(f);
    if (바꿈) fs.appendFileSync(f, 'x');
    return d;
  };
  옛편('yuhobuilds_맞음');
  옛편('yuhobuilds_바뀜', { 바꿈: true });
  옛편('yuhobuilds_없음', { 영상: false });
  옛편('yuhobuilds_이력', { 이력: 날(1) });     // 판정 전에 검사이력이 있으면 그 판정에는 옛 기록을 쓰지 않는다(이력이 앞선 검사를 말한다)
  옛편('yuhobuilds_뒤이력', { 이력: 날(4) });   // 판정 뒤에 생긴 이력(올리기 전 검사를 다시 돌림)은 옛 판정의 넘김을 지우지 않는다
  const 편별 = (이름) => 장부.길세기(장부.모으기(root, 기준).filter((p) => p.편 === 이름), 기준);
  assert.equal(줄of(편별('yuhobuilds_맞음'), '#26').상태, '기계가 잡았는데 넘김 — 최종본검사(옛 기록)가 먼저 띄웠는데 최종 확인에서 1번 다시 잡힘');
  assert.equal(줄of(편별('yuhobuilds_맞음'), '#50').넘김, 1, '같은판은 50번으로 띄운다');
  assert.match(줄of(편별('yuhobuilds_뒤이력'), '#26').상태, /^기계가 잡았는데 넘김/);
  for (const 이름 of ['yuhobuilds_바뀜', 'yuhobuilds_없음', 'yuhobuilds_이력']) assert.match(줄of(편별(이름), '#26').상태, /^검사가 못 잡음/, 이름);
  assert.equal(세기(root, '그래픽').숫자.넘김, '4번(2편)');
});

test('항목에 올린 검사 — 소리 갈래는 최종본검사 조용구간(올리기 전 검사 final-cut-조용구간)으로 세고, 「범위: 일부」라 띄우지 못한 소리 흠은 「검사가 일부만 잼」', (t) => {
  const 올린 = 기준.항목.소리.올린검사;
  assert.deepEqual([올린[0].검사, 올린[0].규칙, 올린[0].날짜, 올린[0].범위], ['최종본검사', ['조용구간'], '2026-11-15', '일부']);
  const root = 마케팅(t);
  const 뒤 = (n) => `2026-11-${String(15 + n).padStart(2, '0')}T10:00:00.000Z`;
  // 가: 올리기 전 검사가 조용구간을 확인할 것으로 띄움(번호 없음) → 소리 작은 흠 → 넘김
  편(root, 'synkbrief_가', {
    검사: [{ 때: 뒤(1), 단계: '올리기 전', 눈: '올리기전검사', 결과: '확인', 걸림: [{ 규칙: 'final-cut-조용구간', 등급: '확인', 글: '28~40초 조용' }] }],
    확인: [{ 결과: '작은 흠', 시각: 뒤(2), 갈래: ['소리'], 메모: '작은 흠: 28~40초 말 없이 조용' }],
  });
  // 나: 최종본 검사 직접 줄(규칙 조용구간)도 같은 열쇠
  편(root, 'synkbrief_나', { 검사: [{ 때: 뒤(1), 단계: '편집', 눈: '최종본검사', 결과: '확인', 걸림: [{ 규칙: '조용구간', 등급: '확인', 글: '조용' }] }] });
  // 다: 짧은 빈 소리 — 검사가 띄우지 못하고 최종 확인이 잡음
  편(root, 'synkbrief_다', { 확인: [{ 결과: '작은 흠', 시각: 뒤(3), 갈래: ['소리'], 메모: '작은 흠: 14~16초 2초 동안 소리가 빔' }] });
  const 편들 = 장부.모으기(root, 기준);
  assert.deepEqual(편들.find((p) => p.편 === 'synkbrief_나').사건[0].띄운, ['항목:소리']);
  // 라: 올린 날 전(11-14)의 짧은 빈 소리 — 일부만 재는 검사라 날짜와 상관없이 「못 띄움」으로 센다
  편(root, 'synkbrief_라', { 확인: [{ 결과: '작은 흠', 시각: '2026-11-14T10:00:00.000Z', 갈래: ['소리'], 메모: '작은 흠: 2.9~5.1초 말 없이 배경음만' }] });
  const 편들2 = 장부.모으기(root, 기준);
  const c = 줄of(장부.길세기(편들2, 기준), '항목:소리');
  assert.equal(c.상태, '검사가 일부만 잼 — 최종본검사(2026-11-15~)가 띄우지 못한 흠이 최종 확인에서 2번 · 기계가 잡았는데 넘김 1번');
  const r = 장부.시작('그래픽', { 폴더: root });
  const 줄 = r.줄.find((x) => x.열쇠 === '항목:소리');
  assert.deepEqual([줄.까닭, 줄.올린검사, 줄.놓침, 줄.최근.편], ['검사가 일부만 잼', ['최종본검사'], 2, 'synkbrief_다']);
  assert.match(장부.시작글(r), /소리\(G15 · 점검표 줄 없음\)[^\n]*검사\(최종본검사\)는 일부만 재고, 띄우지 못한 흠이 최종 확인에서 2번 잡힘/);
  // 기계가 띄운 가 편만 남으면 넘김만 보인다(시작할 때는 「넘긴 흠」 묶음으로 나간다 — 위 시험)
  const 가만 = 장부.길세기(편들2.filter((p) => p.편 === 'synkbrief_가'), 기준);
  assert.match(줄of(가만, '항목:소리').상태, /^기계가 잡았는데 넘김 — 올리기전검사가 먼저 띄웠는데/);
});

test('넘김 — 판정 뒤에 다시 잰 최종본 기록(「잰때」가 판정보다 늦음)은 앞선 경고로 세지 않는다(GPT 검수 GA1)', (t) => {
  const root = 마케팅(t);
  const d = 편(root, 'synkbrief_다시잼', { 확인: [{ 결과: '작은 흠', 시각: 날(3), 갈래: ['사람굳음', '소리'], 메모: '작은 흠: 28~40초 조용 · 38~41초 그대로' }] });
  const f = path.join(d, '게시', 'b_master.mp4');
  fs.writeFileSync(f, 'video');
  const 수정 = Date.parse(날(1)) / 1000;
  fs.utimesSync(f, 수정, 수정);
  const st = fs.statSync(f);
  const 줄 = (잰때) => ({ 바이트: st.size, 수정: new Date(st.mtimeMs).toISOString(), 도구: 'x', ...(잰때 ? { 잰때 } : {}), 결과: { 걸림: [{ 항목: '구간굳음' }, { 항목: '조용구간' }] } });
  const 상태들 = (잰때) => {
    fs.writeFileSync(path.join(d, '게시', '최종본검사.json'), JSON.stringify({ [`docs/마케팅/synkbrief_다시잼/게시/b_master.mp4`]: 줄(잰때) }));
    const s = 장부.길세기(장부.모으기(root, 기준), 기준);
    return [줄of(s, '#26').상태.split(' — ')[0], 줄of(s, '항목:소리').상태.split(' — ')[0]];
  };
  assert.deepEqual(상태들(날(4)), ['검사가 못 잡음', '검사가 일부만 잼'], '판정 뒤에 잰 기록');
  assert.deepEqual(상태들(날(2)), ['기계가 잡았는데 넘김', '기계가 잡았는데 넘김'], '판정 전에 잰 기록');
  // 판정 뒤에 새 도구로 다시 잰 줄이라도, 같은 영상을 판정 전에 처음 잰 증거(「처음」)가 있으면 그때 걸린 항목만 넘김이다
  fs.writeFileSync(path.join(d, '게시', '최종본검사.json'), JSON.stringify({ [`docs/마케팅/synkbrief_다시잼/게시/b_master.mp4`]: { ...줄(날(4)), 처음: { 잰때: 날(1), 걸림항목: ['구간굳음'] } } }));
  const s = 장부.길세기(장부.모으기(root, 기준), 기준);
  assert.deepEqual([줄of(s, '#26').상태.split(' — ')[0], 줄of(s, '항목:소리').상태.split(' — ')[0]], ['기계가 잡았는데 넘김', '검사가 일부만 잼']);
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

// ── 시작할 때 읽힘(설계 ④ · 2단계) ──
const { spawnSync } = require('node:child_process');
const 새편 = require('../tools/새편.js');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' }).status === 0;
const 검사도구 = path.join(__dirname, '..', 'tools', '컷연속성검사.py');
// 장부는 docs/마케팅 아래의 편만 센다 — 시험 자료도 <임시>/docs/마케팅에 둔다
const 마케팅 = (t) => { const d = path.join(임시(t), 'docs', '마케팅'); fs.mkdirSync(d, { recursive: true }); return d; };
const 줄들of = (r) => r.줄.map((c) => c.열쇠);
function 찍어(fn) {
  const 앞 = console.log, 앞e = console.error, out = [], err = [];
  console.log = (x) => out.push(String(x)); console.error = (x) => err.push(String(x));
  try { const 코드 = fn(); return { 코드, out: out.join('\n'), err: err.join('\n') }; } finally { console.log = 앞; console.error = 앞e; }
}
function 환경(바꿈, fn) {
  const 앞 = {};
  for (const [k, v] of Object.entries(바꿈)) { 앞[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); } finally { for (const [k, v] of Object.entries(앞)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
// 장부 node가 시작할 때 던지거나 멈추게 하는 미리 읽기(NODE_OPTIONS --require) — 새편.js · 컷표 검사가 띄운 장부만 부러뜨린다
function 부러진장부(t) {
  const d = 임시(t);
  const 던짐 = path.join(d, 'throw.cjs'), 멈춤 = path.join(d, 'hang.cjs');
  fs.writeFileSync(던짐, "throw new Error('부러진 장부');\n");
  fs.writeFileSync(멈춤, 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);\n');
  return { 던짐: { NODE_OPTIONS: `--require ${JSON.stringify(던짐)}` }, 멈춤: { NODE_OPTIONS: `--require ${JSON.stringify(멈춤)}`, SYNK_FLAW_LEDGER_TIMEOUT_MS: '1500' } };
}
const 올린26 = 기준.줄.get(26).올린검사;
const 첫날26 = 올린26.map((o) => o.날짜).filter(Boolean).sort()[0];
const 날 = (n) => new Date(Date.parse(`${첫날26}T10:00:00.000Z`) + n * 864e5).toISOString();   // 26번 검사를 올린 날에서 n일

test('시작 — 낼 것이 없으면 조용하다(맹검에만 나온 번호 · 미분류 · 「기타」 · 번호에 안 이은 기계 규칙 · 기계 「확인」 · 통과만)', (t) => {
  const root = 마케팅(t);
  for (let i = 1; i <= 4; i += 1) 편(root, `synkbrief_맹검${i}`, { 맹검: { 만든때: 때(i), 낱장: [{ 판정: '기각', 약점: ['[K8] 틀', '[K20] 멈춤', '[C010] 글자'] }] } });
  편(root, 'synkbrief_옛', { 옛기록: { 결과: '미흡', 시각: 때(5), 메모: '갈래 없이 쓴 옛 판정' } });
  편(root, 'synkbrief_기타', { 확인: [{ 결과: '작은 흠', 시각: 때(6), 갈래: ['기타'], 메모: '작은 흠: 3~4초 무엇이 있다' }] });
  편(root, 'synkbrief_규칙', { 검사: [{ 때: 때(7), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'slot', 등급: '걸림', 글: '슬롯' }] }] });
  편(root, 'synkbrief_확인만', { 검사: [{ 때: 때(8), 단계: '편집', 눈: '컷연속성검사', 결과: '확인', 걸림: [{ 규칙: '멈춤', 번호: 20, 등급: '확인', 글: '눈으로 볼 것' }] }] });
  편(root, 'synkbrief_통과', { 확인: [{ 결과: '통과', 시각: 때(9), 갈래: [] }] });
  const r = 장부.시작('그래픽', { 폴더: root });
  assert.equal(r.편수, 9);
  assert.deepEqual(r.줄, []);
  assert.equal(장부.시작글(r), '');
  const 새 = path.join(root, 'synkbrief_새_20261120');
  assert.deepEqual(장부.시작(새, { 폴더: root }).줄, []);
  assert.deepEqual(찍어(() => 장부.main(['시작', 새, '--폴더', root])), { 코드: 0, out: '', err: '' }, '명령도 아무것도 찍지 않는다');
  // 같은 번호(#20)가 최종 확인에서 잡히면 그때는 낸다
  편(root, 'synkbrief_멈춤', { 확인: [{ 결과: '작은 흠', 시각: 때(10), 갈래: ['멈춘화면'], 메모: '큰 흠은 없다. 작은 흠: 1~2초 글이 작다. 5.3~7.4초 카드 석 장이 2초 그대로' }] });
  const r2 = 장부.시작('그래픽', { 폴더: root });
  assert.deepEqual(줄들of(r2), ['#20']);
  assert.deepEqual([r2.줄[0].까닭, r2.줄[0].최근.글, r2.줄[0].최근.글출처], ['올린 검사 없음', '5.3~7.4초 카드 석 장이 2초 그대로', '메모']);
});

test('시작 — 올린 검사가 받는 번호는 안 내고, 검사를 지나 최종 확인에서 다시 잡힌 번호와 재는 검사가 없는 흠은 낸다', (t) => {
  const root = 마케팅(t);
  // 가: 26번 검사를 올리기 전에 최종 확인이 잡음 → 「검사로 올림」이라 안 낸다
  편(root, 'synkbrief_가', { 확인: [{ 결과: '미흡', 시각: 날(-3), 갈래: ['사람굳음'], 메모: '큰 흠: 3~6초 두 사람이 거의 그대로' }] });
  // 나: 올린 뒤인데 올리기 전 검사가 먼저 잡고 최종 확인에도 적힘 → 검사가 받았다 → 안 낸다
  편(root, 'synkbrief_나', {
    검사: [{ 때: 날(1), 단계: '올리기 전', 눈: '올리기전검사', 결과: '걸림', 걸림: [{ 규칙: 'final-cut-굳음', 등급: '걸림', 글: 'C3 굳음' }] }],
    확인: [{ 결과: '미흡', 시각: 날(2), 갈래: ['사람굳음'], 메모: '큰 흠: C3 굳음' }],
  });
  let r = 장부.시작('그래픽', { 폴더: root });
  assert.ok(!줄들of(r).includes('#26'), JSON.stringify(r.줄));
  // 다: 올린 뒤 앞선 기계 검사 없이 최종 확인이 잡음 → 낸다
  편(root, 'synkbrief_다', { 확인: [{ 결과: '작은 흠', 시각: 날(3), 갈래: ['26'], 메모: 'v3 최종 확인 — 0.5초 시트 · 받아쓰기. 큰 흠은 없다. 작은 흠: 1~2초 글이 작다. 12.0~15.5초 두 사람이 거의 그대로 서 있다(말만 이어짐 · 손도 그대로). 끝 꼬리 0.5초' }] });
  // 라: 재는 검사가 없는 번호를 기계 검사가 번호를 달아 걸었다 → 그 걸림의 글로 낸다
  const 맨 = [...기준.줄.values()].find((x) => !(x.올린검사 || []).length).번호;
  편(root, 'synkbrief_라', { 검사: [{ 때: 날(4), 단계: '편집', 눈: '컷연속성검사', 결과: '걸림', 걸림: [{ 규칙: '무엇', 번호: 맨, 등급: '걸림', 글: 'C4: 화면이 3초 그대로' }] }] });
  r = 장부.시작('그래픽', { 폴더: root });
  const c = r.줄.find((x) => x.열쇠 === '#26');
  assert.ok(c, JSON.stringify(r.줄));
  assert.deepEqual([c.번호, c.까닭, c.놓침, c.최근.편, c.최근.출처, c.최근.결과], [26, '검사가 못 잡음', 1, 'synkbrief_다', '최종 확인', '작은 흠']);
  assert.deepEqual(c.올린검사, [...new Set(올린26.map((o) => o.검사))]);
  assert.equal(c.최근.글, '12.0~15.5초 두 사람이 거의 그대로 서 있다(말만 이어짐 · 손도 그대로)', '메모에서 그 흠의 낱말이 든 조각');
  const d = r.줄.find((x) => x.열쇠 === `#${맨}`);
  assert.deepEqual([d.까닭, d.최근.글, d.최근.글출처, d.최근.눈, d.최근.단계], ['올린 검사 없음', 'C4: 화면이 3초 그대로', '검사 글', '컷연속성검사', '편집']);
  const 글 = 장부.시작글(r);
  assert.match(글, /^\[흠 장부\] 그래픽 · 최근 4편에서 검사가 아직 못 잡는 흠 2개 — 이 편을 만들 때 직접 본다\n/);
  assert.match(글, new RegExp(`#26 [^\\n]*검사\\(${c.올린검사.join(' · ')}\\)를 지나 최종 확인에서 1번 잡힘 · 가장 최근 synkbrief_다\\([^)]*최종 확인 「작은 흠」\\): 「12\\.0~15\\.5초`));
  assert.match(글, new RegExp(`#${맨} [^\\n]*재는 검사 없음 · 가장 최근 synkbrief_라\\([^)]* 컷연속성검사 · 편집\\): 「C4: 화면이 3초 그대로」`));
});

test('시작 — 날짜를 모르는 올린 검사는 기계 검사만 잡았으면 안 내고, 최종 확인에서 잡히면 낸다', (t) => {
  const 무날 = [...기준.줄.values()].find((x) => (x.올린검사 || []).length && x.올린검사.every((o) => !o.날짜) && x.올린검사.some((o) => (o.규칙 || []).length));
  if (!무날) { t.skip('날짜 없는 올린 검사가 없다'); return; }
  const o = 무날.올린검사.find((x) => (x.규칙 || []).length);
  const root = 마케팅(t);
  편(root, 'PULSE_가', { 컷표: true, 검사: [{ 때: 때(3), 단계: '받은 뒤', 눈: o.검사, 결과: '걸림', 걸림: [{ 규칙: o.규칙[0], 등급: '걸림', 글: 'C2 빛' }] }] });
  assert.deepEqual(줄들of(장부.시작('컷표영상', { 폴더: root })), []);
  편(root, 'PULSE_나', { 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(4), 갈래: [String(무날.번호)], 메모: '작은 흠: 2~3초 무엇' }] });
  const r = 장부.시작('컷표영상', { 폴더: root });
  assert.deepEqual([줄들of(r), r.줄[0].까닭], [[`#${무날.번호}`], '검사가 못 잡음']);
});

test('시작 — 셋을 넘지 않고 많이 난 흠부터, 묶음이 있는 갈래 이름(점검표 줄 없음)도 낸다', (t) => {
  const root = 마케팅(t);
  const 흠 = (일, 갈래) => ({ 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(일), 갈래, 메모: '작은 흠: 1~2초 얼굴이 둥글다 · 3~4초 소리가 빈다' }] });
  편(root, 'synkbrief_1', 흠(1, ['인물튐', '소리']));
  편(root, 'synkbrief_2', 흠(2, ['인물튐', '글자표']));
  편(root, 'synkbrief_3', 흠(3, ['인물튐', '소리']));
  편(root, 'synkbrief_4', 흠(4, ['화면작음어두움']));
  편(root, 'synkbrief_5', 흠(5, ['숫자불일치', '기타']));
  const r = 장부.시작('컷표영상', { 폴더: root });
  assert.equal(r.줄.length, 장부.시작상한);
  assert.equal(장부.시작상한, 3);
  const k = (g) => 장부.갈래열쇠(g, 기준);
  assert.deepEqual(줄들of(r), [k('인물튐'), k('소리'), k('숫자불일치')], '편 수 → 판정 수 → 가장 최근 순');
  assert.deepEqual(r.줄.map((c) => c.편수), [3, 2, 1]);
  // 소리는 11-15에 조용구간을 「범위: 일부」로 올렸다 — 올린 날 전 흠도 기계가 띄우지 않았으면 그대로 낸다(GPT 검수 GA2)
  assert.deepEqual([r.줄[1].까닭, r.줄[1].놓침], ['검사가 일부만 잼', 2]);
  assert.equal(r.줄[0].최근.글, '1~2초 얼굴이 둥글다');
  assert.equal(r.줄[1].최근.글, '3~4초 소리가 빈다');
  assert.equal(r.줄[2].최근.글출처, '메모 첫 흠', '낱말이 하나도 안 맞으면 메모 첫 흠이라고 밝힌다');
  assert.match(장부.시작글(r), /인물튐\(G11 · 점검표 줄 없음\) — 3편 · 재는 검사 없음[^\n]*\n[\s\S]*메모 첫 흠 「1~2초 얼굴이 둥글다」/);
  // 머리 줄 · 흠 줄 · 그 흠의 「→ 할 것」 줄(인물튐은 11-16에 기본값과 검수 질문의 할것을 적었다)
  const 하나 = 장부.시작글(장부.시작('컷표영상', { 폴더: root, 상한: 1 })).split('\n');
  assert.equal(하나.length, 3);
  assert.match(하나[2], /^ {4}→ 할 것: /);
});

test('기계 검사 없이 올린 흠(「올린곳」, 11-16 인물튐) — 「올릴 차례」 대신 올린 자리를 보이고, 그 뒤 최종 확인에서 다시 잡히면 센다 · 시작 줄에는 그대로 낸다', (t) => {
  const root = 마케팅(t);
  const 흠 = (일) => ({ 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(일), 갈래: ['인물튐'], 메모: '작은 흠: 1~2초 얼굴이 둥글다' }] });
  for (const 일 of [12, 13, 15]) 편(root, `synkbrief_${일}`, 흠(일));
  const k = 장부.갈래열쇠('인물튐', 기준);
  const 줄 = 줄of(세기(root, '컷표영상'), k);
  assert.deepEqual([줄.편수, 줄.올릴차례, 줄.상태], [3, true, '기계 검사 없이 올림(기본값 · 검수 질문 2026-11-16~)'], '세 편이어도 올릴 차례로 다시 뜨지 않는다');
  const 시작 = 장부.시작('컷표영상', { 폴더: root });
  assert.deepEqual([시작.줄[0].열쇠, 시작.줄[0].까닭, 시작.줄[0].올린곳], [k, '올린 검사 없음', ['기본값', '검수 질문']]);
  assert.match(장부.시작글(시작), /인물튐\(G11 · 점검표 줄 없음\) — 3편 · 재는 검사 없음\(올린 자리: 기본값 · 검수 질문 — 눈으로 본다\)/);
  // 올린 자리의 「할것」은 그 흠 바로 아래 한 줄로 뜬다 — 절차 문서를 다시 읽지 않아도 새 편을 시작하는 자리에서 보인다(11-16 유호님 「다음에 무조건 적용하게」)
  assert.deepEqual(시작.줄[0].할것, 기준.항목.인물튐.올린곳.map((o) => o.할것));
  assert.match(장부.시작글(시작), /\n {2}· 인물튐[^\n]*\n {4}→ 할 것: 사람이 나오는 그림을 굽기 전에 인물마다 얼굴이 크고 정면으로 보이는 뿌리 그림 한 장을 정하고[^\n]* \/ 이해 시험 답 10이 짚은 자리는 통과 판정과 따로 고친다(\n|$)/);
  // 할것이 없는 흠에는 그 줄이 붙지 않는다
  assert.doesNotMatch(장부.시작글({ 길: '컷표영상', 편수: 1, 줄: [{ ...시작.줄[0], 할것: undefined }] }), /→ 할 것/);
  // 올린 날 뒤에도 최종 확인에서 잡히면 그 횟수를 보인다(기본값 · 질문이 먹혔는지)
  편(root, 'synkbrief_20', 흠(20));
  assert.equal(줄of(세기(root, '컷표영상'), k).상태, '기계 검사 없이 올림(기본값 · 검수 질문 2026-11-16~) — 그 뒤에도 최종 확인에서 1번');
  // 올린곳이 없는 갈래(숫자불일치)는 그대로 「올릴 차례」
  for (const 일 of [1, 2, 3]) 편(root, `synkbrief_수${일}`, { 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(일), 갈래: ['숫자불일치'], 메모: '작은 흠: 숫자가 다르다' }] });
  assert.equal(줄of(세기(root, '컷표영상'), 장부.갈래열쇠('숫자불일치', 기준)).상태, '올릴 차례');
});

test('시작 — 길 찾기: LAB 브랜드 · 컷표 · 아직 컷표가 없는 새 편은 같은 브랜드 최근 편, docs/마케팅 밖은 아무것도 안 낸다', (t) => {
  const root = 마케팅(t);
  편(root, 'LAB_가_20261101', { 브랜드: 'LAB', 확인: [{ 결과: '작은 흠', 시각: 때(1), 갈래: ['소리'], 메모: '작은 흠: 1~2초 소리가 빈다' }] });
  편(root, 'synkbrief_그_20261105', { 확인: [{ 결과: '통과', 시각: 때(5), 갈래: [] }] });
  편(root, 'synkbrief_컷_20261110', { 컷표: true, 확인: [{ 결과: '통과', 시각: 때(10), 갈래: [] }] });
  편(root, 'yuhobuilds_그_20261110', { 확인: [{ 결과: '통과', 시각: 때(10), 갈래: [] }] });
  const 편들 = 장부.모으기(root, 기준);
  const 길 = (p) => 장부.시작길(p, 편들);
  assert.deepEqual(길(path.join(root, 'synkbrief_새_20261120')), { 길: '컷표영상', 근거: '같은 브랜드 최근 편', 편: 'synkbrief_새_20261120' });
  assert.deepEqual(길(path.join(root, 'yuhobuilds_새_20261120')), { 길: '그래픽', 근거: '같은 브랜드 최근 편', 편: 'yuhobuilds_새_20261120' });
  assert.deepEqual(길(path.join(root, 'newbrand_새_20261120')), { 길: '그래픽', 근거: '컷표 없음', 편: 'newbrand_새_20261120' });
  assert.equal(길(path.join(root, 'LAB_새_20261120')).길, 'LAB');
  const 컷 = path.join(root, 'yuhobuilds_컷_20261121');
  fs.mkdirSync(컷, { recursive: true });
  fs.writeFileSync(path.join(컷, '컷표.json'), '{"틀":2}');
  assert.deepEqual(길(path.join(컷, '컷표.json')), { 길: '컷표영상', 근거: '컷표', 편: 'yuhobuilds_컷_20261121' });
  const 판 = path.join(root, '제작양식', '영상양식');
  fs.mkdirSync(판, { recursive: true });
  fs.writeFileSync(path.join(판, '컷표_틀.json'), '{}');
  assert.ok(길(path.join(판, '컷표_틀.json')).까닭, '곁에 편 폴더가 없는 컷표 파일(틀 예시)에는 길이 없다');
  const 시작 = 장부.시작(path.join(root, 'LAB_새_20261120'), { 폴더: root });
  assert.deepEqual([시작.길, 시작.근거, 줄들of(시작)], ['LAB', 'LAB 브랜드', [장부.갈래열쇠('소리', 기준)]]);
  assert.deepEqual(장부.시작(path.join(os.tmpdir(), 'synkbrief_밖_20261120'), { 폴더: root }), { 줄: [], 까닭: '편 폴더가 docs/마케팅 아래가 아니다' });
  assert.equal(장부.마케팅아래(path.join('a', 'docs', '마케팅')), false, 'docs/마케팅 그 자체는 편이 아니다');
});

test('시작 — 메모 조각: 무엇을 봤는지의 목록은 빼고, 괄호 · 낫표 밖의 「 · 」 「. 」 「 — 」에서 자른다', () => {
  assert.deepEqual(장부.흠조각('v1 최종 확인 — 0.5초 시트 · 받아쓰기. 큰 흠은 없다. 작은 흠: 1~2초 글(작은 · 흐린). 3~4초 「멈춰. 거기」 대사 · 끝 꼬리 — 5초 말 없음'),
    ['1~2초 글(작은 · 흐린)', '3~4초 「멈춰. 거기」 대사', '끝 꼬리', '5초 말 없음']);
  assert.deepEqual(장부.흠조각('사람이 없는 편이다. 큰 흠은 없다. 남은 작은 흠은 이렇다. 27~36초 칸이 노랗다. 40~43초 끝 글이 작다'), ['27~36초 칸이 노랗다', '40~43초 끝 글이 작다']);
  assert.deepEqual(장부.흠조각('남은 작은 흠(1 · 2는 경계): 28~40초 말 없이 글 네 장 · 음량 −28dB(폰으로 4분의 1이 조용)'), ['28~40초 말 없이 글 네 장', '음량 −28dB(폰으로 4분의 1이 조용)']);
  assert.deepEqual(장부.흠조각(''), []);
});

test('시작 — 명령: 길 · --json · 모르는 깃발은 끝 코드 2 · SYNK_FLAW_LEDGER=off면 비고, 장부 자리는 SYNK_FLAW_LEDGER_DIR', (t) => {
  const root = 마케팅(t);
  편(root, 'synkbrief_가', { 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(1), 갈래: ['인물튐'], 메모: '작은 흠: 1~2초 얼굴이 둥글다' }] });
  const j = JSON.parse(찍어(() => 장부.main(['시작', '컷표영상', '--폴더', root, '--json'])).out);
  assert.deepEqual([j.길, j.근거, j.편수, j.줄.length, j.줄[0].최근.편], ['컷표영상', '길 이름', 1, 1, 'synkbrief_가']);
  assert.equal(찍어(() => 장부.main(['시작'])).코드, 2);
  assert.equal(찍어(() => 장부.main(['시작', '컷표영상', '--모름'])).코드, 2);
  assert.match(환경({ SYNK_FLAW_LEDGER_DIR: root }, () => 찍어(() => 장부.main(['시작', '컷표영상'])).out), /^\[흠 장부\] 컷표영상/);
  assert.deepEqual(환경({ SYNK_FLAW_LEDGER: 'off', SYNK_FLAW_LEDGER_DIR: root }, () => 장부.시작('컷표영상')), { 줄: [], 까닭: 'SYNK_FLAW_LEDGER=off' });
});

test('새편 — 새 편을 세울 때 시작 줄을 끝에 붙이고(--json이면 stderr), 장부가 꺼지거나 던지거나 멈춰도 출력과 끝 코드는 같다', (t) => {
  const root = 마케팅(t);
  편(root, 'synkbrief_흠_20261110', { 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(10), 갈래: ['인물튐'], 메모: '작은 흠: 3~5초 얼굴이 앞 컷보다 둥글다' }] });
  const 자리 = 임시(t);
  const 새 = path.join(root, 'synkbrief_새_20261120');
  const 돌림 = (argv, 바꿈 = {}) => 환경({ SYNK_FLAW_LEDGER: undefined, SYNK_FLAW_LEDGER_DIR: root, SYNK_REMOTION_PARTS_DIR: 자리, NODE_OPTIONS: undefined, SYNK_FLAW_LEDGER_TIMEOUT_MS: undefined, ...바꿈 }, () => 찍어(() => 새편.main(argv)));
  const 켬 = 돌림([새]);
  const 끔 = 돌림([새], { SYNK_FLAW_LEDGER: 'off' });
  assert.equal(켬.코드, 끔.코드);
  assert.ok(켬.out.startsWith(`${끔.out}\n`), 켬.out);
  assert.match(켬.out.slice(끔.out.length + 1), /^\[흠 장부\] 컷표영상\(컷표가 아직 없어 같은 브랜드 최근 편의 길\) · 최근 1편에서 검사가 아직 못 잡는 흠 1개[^\n]*\n {2}· 인물튐[^\n]*「3~5초 얼굴이 앞 컷보다 둥글다」\n {4}→ 할 것: [^\n]*$/);
  assert.equal(fs.existsSync(새), false, '미리 보기는 아무것도 쓰지 않는다');
  const 켬j = 돌림([새, '--json']);
  const 끔j = 돌림([새, '--json'], { SYNK_FLAW_LEDGER: 'off' });
  assert.deepEqual([켬j.코드, 켬j.out], [끔j.코드, 끔j.out], '--json의 stdout은 그대로다');
  assert.match(켬j.err, /\[흠 장부\] 컷표영상/);
  assert.doesNotMatch(끔j.err, /흠 장부/);
  // 장부가 던지거나 멈춰도 — 장부를 띄운 node만 부러뜨린다(멈춤은 시간 제한 1.5초로 끊긴다, GPT 검수 GA1)
  const 부러짐 = 부러진장부(t);
  const 던짐 = 돌림([새], 부러짐.던짐);
  assert.deepEqual([던짐.코드, 던짐.out, 던짐.err], [끔.코드, 끔.out, 끔.err]);
  const 앞때 = Date.now();
  const 멈춤 = 돌림([새], 부러짐.멈춤);
  assert.deepEqual([멈춤.코드, 멈춤.out, 멈춤.err], [끔.코드, 끔.out, 끔.err]);
  assert.ok(Date.now() - 앞때 < 20000, `멈춘 장부를 시간 제한에서 끊는다(${Date.now() - 앞때}ms)`);
  assert.equal(환경({ ...부러짐.던짐, SYNK_FLAW_LEDGER_DIR: root }, () => 새편.흠시작글(새)), '');
  // 이미 있는 편(부품만 · package.json을 찍지 않는 편)에는 붙이지 않는다
  const 옛 = path.join(root, 'synkbrief_옛편_20261020');
  fs.mkdirSync(path.join(옛, 'remotion'), { recursive: true });
  fs.writeFileSync(path.join(옛, 'remotion', 'package.json'), '{}');
  assert.doesNotMatch(돌림([옛]).out, /흠 장부/);
});

test('컷표 검사 — docs/마케팅 아래 편의 컷표를 글로 돌리면 끝에 시작 줄을 붙이고, 끝 코드 · --json · 결과.json은 그대로다. 장부가 실패해도 같다', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const root = 마케팅(t);
  편(root, 'synkbrief_흠_20261110', { 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(10), 갈래: ['인물튐'], 메모: '작은 흠: 3~5초 얼굴이 앞 컷보다 둥글다' }] });
  const 편폴더 = path.join(root, 'synkbrief_검사_20261120');
  fs.mkdirSync(편폴더, { recursive: true });
  const 표 = path.join(편폴더, '컷순서.json');
  const 출력 = path.join(편폴더, '검사_연속성');
  const 돌 = (args, 바꿈 = {}) => {
    const r = spawnSync('python', ['-I', '-X', 'utf8', 검사도구, 표, '--출력', 출력, ...args], { encoding: 'utf8', env: { ...process.env, SYNK_검사이력: '끔', SYNK_FLAW_LEDGER_DIR: root, SYNK_FLAW_LEDGER: '', NODE_OPTIONS: '', ...바꿈 } });
    return { 코드: r.status, out: r.stdout, err: r.stderr, 결과: fs.readFileSync(path.join(출력, '결과.json'), 'utf8') };
  };
  const 부러진 = 부러진장부(t);
  for (const [이름, 표값] of [['통과(끝 코드 0)', { detail: [{ cut: 'A1', t: 0, dur: 2 }], 소품: [], 사건: [], 소리사건: [] }], ['확인(끝 코드 2)', { detail: [{ cut: 'A1', t: 0, dur: 2 }] }]]) {
    fs.writeFileSync(표, JSON.stringify(표값));
    const 끔 = 돌([], { SYNK_FLAW_LEDGER: 'off' });
    const 켬 = 돌([]);
    const 부러짐 = 돌([], { NODE_OPTIONS: '--없는-깃발-흠장부시험' });   // node가 뜨지 못한다
    const 던짐 = 돌([], 부러진.던짐);
    const 앞때 = Date.now();
    const 멈춤 = 돌([], 부러진.멈춤);   // 시간 제한 1.5초에서 끊긴다(GPT 검수 GA1)
    assert.ok(Date.now() - 앞때 < 30000, `${이름}: 멈춘 장부를 시간 제한에서 끊는다`);
    assert.deepEqual([켬.코드, 부러짐.코드, 던짐.코드, 멈춤.코드], [끔.코드, 끔.코드, 끔.코드, 끔.코드], 이름);
    assert.ok(켬.out.startsWith(끔.out), 이름);
    assert.match(켬.out.slice(끔.out.length), /^\[흠 장부\] 컷표영상 · 최근 1편에서 검사가 아직 못 잡는 흠 1개[^\n]*\n {2}· 인물튐[^\n]*\n {4}→ 할 것: [^\n]*\n$/, `${이름}: ${켬.out}`);
    assert.deepEqual([부러짐.out, 던짐.out, 멈춤.out], [끔.out, 끔.out, 끔.out], `${이름}: 장부가 실패하면 아무것도 붙이지 않는다`);
    assert.deepEqual([켬.결과, 부러짐.결과, 던짐.결과, 멈춤.결과], [끔.결과, 끔.결과, 끔.결과, 끔.결과], `${이름}: 결과.json`);
    const 켬j = 돌(['--json']), 끔j = 돌(['--json'], { SYNK_FLAW_LEDGER: 'off' });
    assert.deepEqual([켬j.코드, 켬j.out], [끔j.코드, 끔j.out], `${이름}: --json 출력과 끝 코드`);
  }
  assert.equal(돌([]).코드, 2);
});

test('실제 편 — 만족 사례 장부의 편(synkbrief 영상통화연인)의 컷표는 장부를 켜도 끝 코드 · --json · 결과.json이 같다', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const 편폴더 = path.join(__dirname, '..', 'docs', '마케팅', 'synkbrief_영상통화연인_20261113');
  const 표 = ['컷표.json', '컷순서.json'].map((f) => path.join(편폴더, f)).find((p) => fs.existsSync(p));
  if (!표) { t.skip('그 편이 없는 작업본'); return; }
  const 출력 = 임시(t);
  const 돌 = (args, 바꿈 = {}) => {
    const r = spawnSync('python', ['-I', '-X', 'utf8', 검사도구, 표, '--출력', 출력, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, SYNK_검사이력: '끔', SYNK_FLAW_LEDGER: '', ...바꿈 } });
    return { 코드: r.status, out: r.stdout, 결과: fs.readFileSync(path.join(출력, '결과.json'), 'utf8') };
  };
  const 끔 = 돌([], { SYNK_FLAW_LEDGER: 'off' }), 켬 = 돌([]);
  assert.equal(켬.코드, 끔.코드);
  assert.ok(켬.out.startsWith(끔.out));
  // 묶음은 둘까지다 — 검사가 아직 못 잡는 흠(셋 이하) · 검사가 띄웠는데 넘긴 흠(둘 이하)
  assert.match(켬.out.slice(끔.out.length), /^(\[흠 장부\] 컷표영상[^\n]*\n( {2}· [^\n]*\n( {4}→ 할 것: [^\n]*\n)?){1,3}){0,2}$/);
  assert.equal(켬.결과, 끔.결과);
  const 켬j = 돌(['--json']), 끔j = 돌(['--json'], { SYNK_FLAW_LEDGER: 'off' });
  assert.deepEqual([켬j.코드, 켬j.out], [끔j.코드, 끔j.out]);
});

test('영상세션재기 — 흠 장부 시작 줄이 도구 결과에 나온 세션과 띄운 명령(새편 · 컷표 검사 · 직접)을 모든 세션에서 센다', (t) => {
  const home = 임시(t);
  const dir = path.join(home, '.claude', 'projects', 'C--x-SYNK-appsscript');
  fs.mkdirSync(dir, { recursive: true });
  const j = (o) => `${JSON.stringify(o)}\n`;
  const at = (m) => `2026-11-13T10:${String(m).padStart(2, '0')}:00.000Z`;
  const 도구 = (id, command, m) => j({ type: 'assistant', timestamp: at(m), message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
  const 결과 = (id, text, m, 배열 = false) => j({ type: 'user', timestamp: at(m), message: { content: [{ type: 'tool_result', tool_use_id: id, content: 배열 ? [{ type: 'text', text }] : text }] } });
  // 머리 줄은 장부가 실제로 내는 글로 — 시작글의 꼴이 바뀌면 이 셈도 함께 깨진다
  const 자료 = 마케팅(t);
  편(자료, 'synkbrief_가', { 컷표: true, 확인: [{ 결과: '작은 흠', 시각: 때(1), 갈래: ['인물튐'], 메모: '작은 흠: 1~2초 얼굴이 둥글다' }] });
  편(자료, 'yuhobuilds_가', { 확인: [{ 결과: '작은 흠', 시각: 때(1), 갈래: ['소리'], 메모: '작은 흠: 1~2초 소리가 빈다' }] });
  const 컷글 = 장부.시작글(장부.시작('컷표영상', { 폴더: 자료 }));
  const 그글 = 장부.시작글(장부.시작('그래픽', { 폴더: 자료 }));
  assert.match(컷글, /^\[흠 장부\] 컷표영상 /);
  fs.writeFileSync(path.join(dir, 'aaaa0001.jsonl'), 도구('t1', 'node tools/새편.js docs/마케팅/synkbrief_가_20261120 --실행', 0) + 결과('t1', `[됨] …\n${컷글}`, 1));
  fs.writeFileSync(path.join(dir, 'aaaa0002.jsonl'), 도구('t2', 'node tools/새편.js docs/마케팅/LAB_나_20261120 --실행', 0) + 결과('t2', '[됨] …', 1) + 도구('t3', 'node tools/새편.js 부품 --실행', 2));
  fs.writeFileSync(path.join(dir, 'aaaa0003.jsonl'), 도구('t4', 'python -X utf8 tools/컷연속성검사.py docs/마케팅/x/컷표.json', 0) + 결과('t4', `끝: 걸림 · 확인 없음\n${컷글}\n`, 1, true));
  fs.writeFileSync(path.join(dir, 'aaaa0004.jsonl'), 도구('t5', 'node tools/흠장부.js 시작 docs/마케팅/yuhobuilds_라_20261120', 0) + 결과('t5', 그글, 1));
  fs.writeFileSync(path.join(dir, 'aaaa0005.jsonl'), 도구('t6', 'node tools/흠장부.js', 0) + 결과('t6', '흠 장부 · 모든 길 · 길마다 …\n[컷표영상] 편 9개', 1));
  // 시험 파일 · 소스를 읽은 결과는 세지 않는다 — 줄 번호가 앞에 붙고, 글 속 줄바꿈은 「\n」 두 글자다(GPT 검수 GA2)
  const 머리 = 컷글.split('\n')[0];
  fs.writeFileSync(path.join(dir, 'aaaa0006.jsonl'), j({ type: 'assistant', timestamp: at(0), message: { content: [{ type: 'tool_use', id: 't7', name: 'Read', input: { file_path: 'tests/흠장부.test.js' } }] } })
    + 결과('t7', `   12\t  결과('t1', '[됨] …\\n${머리}')\n   13\t${머리}`, 1)
    + 도구('t8', 'cat tests/흠장부.test.js', 2) + 결과('t8', `  결과('t1', '[됨] …\\n${머리}', 1);`, 3));
  const 재기 = path.join(__dirname, '..', 'tools', '영상세션재기.js');
  const 돌 = (...a) => spawnSync(process.execPath, [재기, '--부터', '2026-11-12', '--까지', '2026-11-15', ...a], { encoding: 'utf8', env: { ...process.env, USERPROFILE: home, HOME: home } });
  const r = 돌('--json');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).흠시작, { 세션: 6, 띄운세션: 3, 새편세션: 2, 새편이띄운세션: 1, 컷표검사세션: 1, 컷표검사가띄운세션: 1, 직접부른세션: 1, 출처: { 새편: 1, 컷표검사: 1, 직접: 1 } });
  assert.match(돌().stdout, /흠 장부 시작 줄\(이 기간 세션 6개 모두\): 줄이 뜬 세션 3개\(새편 1번 · 컷표 검사 1번 · 직접 1번\) · 새편\.js를 돌린 세션 2개 가운데 새편이 띄운 세션 1개 · 컷표 검사를 돌린 세션 1개 가운데 검사가 띄운 세션 1개/);
});
