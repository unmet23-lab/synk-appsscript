/* pilot-9 실증 — 「시즌 시작일 칸이 목록을 받으면 연습 시즌이 서는가」를 실제로 돌려 본다.
 * 실물 함수(lessonNoOf_·seasonWeekOf_·SEASON_WEEKS·classDowOk_)는 저장소에서 잘라 온다 — 사본을 짓지 않는다. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = 'C:/Users/q1212/Documents/SYNK-appsscript';
const src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
const code = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');

function cut(text, from, to) {
  const s = text.indexOf(from); assert.notEqual(s, -1, '못 찾음: ' + from);
  const e = text.indexOf(to, s); assert.notEqual(e, -1, '못 찾음: ' + to);
  return text.slice(s, e);
}
const 실물 = [
  cut(src, 'const SEASON_WEEKS = 8;', '/* [v9.99] 역할별'),
  cut(src, 'function lessonNoOf_(', '// 시즌 주차(1~8)'),
  cut(src, 'function seasonWeekOf_(', "/* --- 역할·짝"),
  cut(code, 'function toDate_(', '// [opt] 셀값'),
  "function classDowOk_(type, dow) { return String(type) === '주말' ? dow === 6 : (dow >= 1 && dow <= 5); }",
].join('\n');

/* 지금 판 — app_state 「시즌시작일」 한 칸이 날짜 하나만 쥔다 */
const 지금판 = `function seasonStartOf_지금(칸) { return toDate_(칸); }`;
/* 고친 판 — 같은 칸이 «목록»을 쥔다. 오늘을 덮는(=오늘 이하 중 가장 늦은) 시작일 하나를 고른다. */
const 고친판 = `
function seasonStartOf_고침(칸, 오늘) {
  const 날 = String(칸 == null ? '' : 칸).split(',').map(s => toDate_(s.trim())).filter(Boolean)
    .sort((a, b) => a - b);
  if (!날.length) return null;
  const t = 오늘 || new Date();
  let 고른 = null;
  for (let i = 0; i < 날.length; i++) if (날[i] <= t) 고른 = 날[i];
  return 고른;
}`;

const G = new Function(실물 + '\n' + 지금판 + '\n' + 고친판 +
  '\nreturn { SEASON_WEEKS, lessonNoOf_, seasonWeekOf_, toDate_, classDowOk_, seasonStartOf_지금, seasonStartOf_고침 };')();

const 날 = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const 라벨 = (d) => d ? [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-') : '';

let 통과 = 0, 실패 = 0;
function 잰다(무엇, fn) { try { fn(); 통과++; console.log('  ✅ ' + 무엇); } catch (e) { 실패++; console.log('  ❌ ' + 무엇 + '\n     ' + e.message); } }

console.log('\n① 지금 판 — 한 칸에 날짜 하나');
잰다('정규 시즌만 박으면 12월 파일럿 날은 «시즌 밖»이라 차시가 0 = 서클 종이가 안 나온다', () => {
  const start = G.seasonStartOf_지금('2027-02-25');
  assert.strictEqual(G.lessonNoOf_(start, 날('2026-12-07'), '평일'), 0);
});
잰다('12월로 바꿔 박으면 파일럿은 도는데, 2월 25일이 «9주차 밖»으로 떨어져 정규 시즌이 안 열린다', () => {
  const start = G.seasonStartOf_지금('2026-12-07');
  assert.ok(G.lessonNoOf_(start, 날('2026-12-07'), '평일') > 0, '파일럿 첫날 차시가 0');
  assert.ok(G.seasonWeekOf_(start, 날('2027-02-25')) > G.SEASON_WEEKS,
    '2월 25일이 8주 안으로 잘못 들어왔다');
});

console.log('\n② 고친 판 — 같은 칸이 목록을 쥔다(연습 12-07 · 정규 02-25)');
const 목록 = '2026-12-07, 2027-02-25';
잰다('파일럿 첫날(12-07)에는 연습 시즌이 선다 — 차시 1', () => {
  const start = G.seasonStartOf_고침(목록, 날('2026-12-07'));
  assert.strictEqual(라벨(start), '2026-12-07');
  assert.strictEqual(G.lessonNoOf_(start, 날('2026-12-07'), '평일'), 1);
});
잰다('파일럿 마지막 날(12-18)에도 연습 시즌 — 평일반 10차시', () => {
  const start = G.seasonStartOf_고침(목록, 날('2026-12-18'));
  assert.strictEqual(G.lessonNoOf_(start, 날('2026-12-18'), '평일'), 10);
});
잰다('개원일(02-25)에는 «손대지 않아도» 정규 시즌으로 넘어간다 — 차시 1', () => {
  const start = G.seasonStartOf_고침(목록, 날('2027-02-25'));
  assert.strictEqual(라벨(start), '2027-02-25');
  assert.strictEqual(G.lessonNoOf_(start, 날('2027-02-25'), '평일'), 1);
});
잰다('두 시즌의 이름(=행에 박히는 열쇠)이 다르다 — 12월 행이 2월 집계에 안 섞인다', () => {
  const a = 라벨(G.seasonStartOf_고침(목록, 날('2026-12-10')));
  const b = 라벨(G.seasonStartOf_고침(목록, 날('2027-03-01')));
  assert.notStrictEqual(a, b);
});
잰다('날짜 하나만 적힌 옛 칸도 그대로 돈다(뒤로 안 깨진다)', () => {
  const start = G.seasonStartOf_고침('2027-02-25', 날('2027-02-25'));
  assert.strictEqual(라벨(start), '2027-02-25');
  assert.strictEqual(G.lessonNoOf_(start, 날('2027-02-25'), '평일'), 1);
});
잰다('첫 시즌 시작 «전»에는 아무 시즌도 안 선다(빈손 = 지금 판과 같다)', () => {
  assert.strictEqual(G.seasonStartOf_고침(목록, 날('2026-11-30')), null);
});
잰다('달력이 1월로 옮겨져도(01-11 파일럿 · 02-15 개원) 같은 칸으로 선다', () => {
  const 새목록 = '2027-01-11, 2027-02-15';
  assert.strictEqual(라벨(G.seasonStartOf_고침(새목록, 날('2027-01-11'))), '2027-01-11');
  assert.strictEqual(G.lessonNoOf_(G.seasonStartOf_고침(새목록, 날('2027-01-29')), 날('2027-01-29'), '평일'), 15);
  assert.strictEqual(라벨(G.seasonStartOf_고침(새목록, 날('2027-02-15'))), '2027-02-15');
});
잰다('연습 둘 + 정규 하나(12월 리허설 · 1월 파일럿 · 2월 개원)도 한 칸에 선다', () => {
  const 셋 = '2026-12-07, 2027-01-11, 2027-02-15';
  assert.strictEqual(라벨(G.seasonStartOf_고침(셋, 날('2026-12-10'))), '2026-12-07');
  assert.strictEqual(라벨(G.seasonStartOf_고침(셋, 날('2027-01-20'))), '2027-01-11');
  assert.strictEqual(라벨(G.seasonStartOf_고침(셋, 날('2027-02-20'))), '2027-02-15');
});

console.log('\n합계 = ' + (통과 + 실패) + ' = 통과 ' + 통과 + ' + 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
