/* pilot-9 실증 v2 — 「시즌 시작일 칸이 목록을 받으면 연습 시즌이 서는가」를 실제로 돌려 본다.
 *
 * v1(09-03 오전)은 «차시 번호» 계산기만 잘라 와 10벌을 돌렸다. 반박이 그 구멍을 정확히 짚었다 —
 * 갈래가 깨지는 자리는 차시가 아니라 «시즌 이름(=행에 박히는 열쇠)» 쪽이었다.
 * v2 는 그 통로를 통째로 잰다: 편성이 행에 박는 열쇠(assignGroups 2640·2703) → groups 시트 A열 →
 * 그 열쇠로 행을 찾는 groupBoardOf_(2768~2780) → 종이(circleSheetOf_ 3127~3128 · 인쇄 게이트 3470).
 *
 * 실물은 저장소에서 잘라 온다 — 사본을 짓지 않는다.
 * 흉내낸 것 셋(그리고 그것뿐): ①Utilities.formatDate('yyyy-MM-dd' 만) ②scheduleMap/schedOf(반 요일표)
 * ③시트 객체(getLastRow·getRange().getValues()). 이 셋은 구글 것이라 노트북에 없다.
 *
 * 「시계」에 관한 규약 — seasonStartOf_(ss) 는 «인자로 날짜를 안 받는다». 그래서 시즌 선택은 늘 «지금»
 * 기준이다. 그 성질을 여기서는 ss.__시계 로 모형한다: 시계를 그대로 두면 「인자를 안 넘긴 판」,
 * 시계를 when 으로 맞추면 「그 여섯 자리에 날짜를 같이 넘긴 판」이다(=갈래 A 가 고치는 그 한 줄씩).
 */
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
  cut(src, 'const GROUP_COUNT = 4;', 'function seasonStartOf_('),      // 상수(SEASON_WEEKS=8 · 역할·짝)
  cut(src, 'function seasonKeyOf_(', '// 시즌 라벨 — groups 행의 키'),  // 열쇠 정규화
  cut(src, 'function seasonLabelOf_(', '/* --- 차시 번호'),             // 시즌 이름
  cut(src, 'function lessonNoOf_(', '/* --- 역할·짝'),                  // 차시·주차
  cut(src, 'function roleOfSeat_(', '/* [v9.99] 정밀 청취 조'),          // 역할·짝
  cut(src, 'function focusGroupOf_(', '/* [v9.99] 날짜 → 차시 번호 맵'),
  cut(src, 'function groupBoardOf_(', '/* --- 강사용 조 편성표'),        // 🔑 종이가 타는 그 함수
  cut(code, 'const GROUPS_HEADERS =', '/* [2026-09-02'),
  cut(code, 'function toDate_(', '// [opt] 셀값'),
  cut(code, 'function classDowOk_(', 'function hasClassToday('),
].join('\n');

const 하네스 = `
const Session = { getScriptTimeZone: function () { return 'Asia/Ulaanbaatar'; } };
const Utilities = { formatDate: function (d, tz, f) {
  if (f !== 'yyyy-MM-dd') throw new Error('이 하네스는 yyyy-MM-dd 만 흉내낸다: ' + f);
  const p = function (n) { return ('0' + n).slice(-2); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
} };
function scheduleMap(ss) { return ss.__sched; }
function schedOf(map, cls) { return map[String(cls)]; }
let 규칙 = null;                                  // 세 판(지금·순진·고침) 중 하나를 끼운다
function seasonStartOf_(ss) { return 규칙(ss.__칸, ss.__시계); }   // 실물과 같은 꼴 — 날짜 인자가 «없다»

/* ── 세 판 ─────────────────────────────────────────────────────────────── */
function 규칙_지금(칸) { return toDate_(칸); }      // 지금 라이브 = 엔진_셋업확장.js:2076~2078 그대로

function 목록_(칸) {                                // '시작[~끝], 시작[~끝], …'
  return String(칸 == null ? '' : 칸).split(',').map(function (조각) {
    const 쪽 = 조각.split('~');
    const 시작 = toDate_(String(쪽[0] || '').trim());
    const 끝 = 쪽.length > 1 ? toDate_(String(쪽[1] || '').trim()) : null;
    return 시작 ? { 시작: 시작, 끝: 끝 } : null;
  }).filter(Boolean).sort(function (a, b) { return a.시작 - b.시작; });
}
function 더한날_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

/* v1 이 실제로 짠 규칙 — 「오늘 이하 중 가장 늦은 시작일」. 반박이 여기를 깼다. */
function 규칙_순진(칸, 오늘) {
  const L = 목록_(칸); if (!L.length) return null;
  const t = 오늘 || new Date();
  let 고른 = null;
  for (let i = 0; i < L.length; i++) if (L[i].시작 <= t) 고른 = L[i].시작;
  return 고른;
}
/* v2 규칙 — 「오늘을 덮는 시즌 · 없으면 다음 시즌 · 그것도 없으면 마지막(=지금 판과 같은 얼굴)」.
 *   덮는 창 = [시작, min(적은 끝날짜 or 시작+8주-1, 다음 시작일-1)] */
function 규칙_고침(칸, 오늘) {
  const L = 목록_(칸); if (!L.length) return null;
  const t = 오늘 || new Date();
  for (let i = L.length - 1; i >= 0; i--) {
    if (L[i].시작 > t) continue;                       // 아직 시작 안 함
    const 자연끝 = L[i].끝 || 더한날_(L[i].시작, SEASON_WEEKS * 7 - 1);
    const 다음 = L[i + 1] ? 더한날_(L[i + 1].시작, -1) : null;
    const 끝 = (다음 && 다음 < 자연끝) ? 다음 : 자연끝;
    if (t <= 끝) return L[i].시작;                     // 덮는다
    break;                                             // 가장 늦게 시작한 시즌이 이미 끝났다
  }
  for (let i = 0; i < L.length; i++) if (L[i].시작 > t) return L[i].시작;   // 다음 시즌
  return L[L.length - 1].시작;                          // 마지막 — 지금 판과 똑같이 「기간 밖」으로 떨어진다
}
`;

const G = new Function(실물 + '\n' + 하네스 +
  '\nreturn { SEASON_WEEKS, GROUPS_HEADERS, lessonNoOf_, seasonWeekOf_, seasonLabelOf_, seasonKeyOf_,' +
  ' groupBoardOf_, toDate_, classDowOk_,' +
  ' 규칙_지금, 규칙_순진, 규칙_고침, 끼운다: function (r) { 규칙 = r; } };')();

const TZ = 'Asia/Ulaanbaatar';
const 날 = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const 라벨 = (d) => d ? [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-') : '';

/* 시트 흉내 — groupBoardOf_ 가 쓰는 두 가지만 */
function 시트_(rows) {
  return {
    getLastRow: () => rows.length + 1,
    getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 2, r - 2 + nr).map(x => x.slice(c - 1, c - 1 + nc)) })
  };
}
function 판_(칸, 시계, rows) {
  return {
    __칸: 칸, __시계: 시계, __sched: { '파일럿반': { type: '평일' }, '정규반1': { type: '평일' } },
    getSpreadsheetTimeZone: () => TZ,
    getSheetByName: (n) => (n === 'groups' ? 시트_(rows || []) : null)
  };
}
/* assignGroups 가 열쇠를 박는 두 줄의 거울 — 엔진_셋업확장.js:2640(season) · 2703(fresh 행 첫 칸) */
function 편성한다_(ss, cls) {
  const season = G.seasonLabelOf_(ss, TZ);
  if (!season) return { 열쇠: '', 행들: [], 거절: '⚠ 시즌 시작일이 없습니다' };
  const 행들 = [['A', 1, 0], ['B', 1, 1], ['C', 1, 2], ['D', 1, 3]]
    .map(m => [season, cls, m[0], m[0] + '학생', m[1], m[2], '확정', season, '', '']);
  return { 열쇠: season, 행들: 행들, 거절: '' };
}
/* 인쇄 게이트 — 엔진_셋업확장.js:3470(조 편성 없음) · 3471(시즌 기간 밖) · circleSheetOf_ 3127~3128 */
function 인쇄_(ss, cls, when) {
  const b = G.groupBoardOf_(ss, cls, when, TZ);
  if (!b) return '⚠ 조 편성이 없습니다';
  if (!b.lessonNo) return '⚠ 시즌 기간 밖입니다';
  return '종이 ' + b.groups.length + '장 · 인원 ' + b.groups.reduce((n, a) => n + a.length, 0) +
    ' (차시 ' + b.lessonNo + ' · 시즌 ' + b.season + ')';
}

let 통과 = 0, 실패 = 0;
function 잰다(무엇, fn) { try { fn(); 통과++; console.log('  ✅ ' + 무엇); } catch (e) { 실패++; console.log('  ❌ ' + 무엇 + '\n     ' + e.message); } }

/* ═══ ① 지금 판 — 칸 하나에 날짜 하나 ═══════════════════════════════════ */
console.log('\n① 지금 판(라이브) — app_state 「시즌시작일」 한 칸');
G.끼운다(G.규칙_지금);
잰다('정규 시즌만 박으면 파일럿 날은 차시 0 = 서클 종이가 안 나온다', () => {
  const start = G.규칙_지금('2027-02-25');
  assert.strictEqual(G.lessonNoOf_(start, 날('2026-12-07'), '평일'), 0);
});
잰다('12월로 바꿔 박으면 파일럿은 도는데 개원일이 8주 밖으로 떨어진다(정규 시즌이 조용히 안 열린다)', () => {
  const start = G.규칙_지금('2026-12-07');
  assert.ok(G.lessonNoOf_(start, 날('2026-12-07'), '평일') > 0);
  assert.ok(G.seasonWeekOf_(start, 날('2027-02-25')) > G.SEASON_WEEKS);
});
잰다('🔴 v1 의 7번 시험 이름표 정정 — 시즌 시작 «전»에도 지금 판은 «빈손이 아니라 날짜»를 돌려준다(= 오늘 미리 편성이 된다)', () => {
  const ss = 판_('2027-02-25', 날('2026-11-30'), []);
  assert.strictEqual(라벨(G.규칙_지금('2027-02-25')), '2027-02-25');
  assert.strictEqual(편성한다_(ss, '정규반1').열쇠, '2027-02-25');   // 미리 편성이 «된다»
});

/* ═══ ② v1 이 짠 순진한 규칙 — 반박 1번을 재현한다 ═══════════════════════ */
console.log('\n② v1 규칙(「오늘 이하 중 가장 늦은 시작일」) — 반박 재현');
G.끼운다(G.규칙_순진);
const 목록2 = '2026-12-07, 2027-02-25';
잰다('🔴 시즌 «사이»(02-20)에 기계는 아직 「2026-12-07」이 현재라고 답한다', () => {
  assert.strictEqual(라벨(G.규칙_순진(목록2, 날('2027-02-20'))), '2026-12-07');
});
잰다('🔴 그날 미리 편성하면 개원일 아침에 종이가 0장이고 화면은 「조 편성이 없습니다」만 말한다', () => {
  const 미리 = 판_(목록2, 날('2027-02-20'), []);
  const r = 편성한다_(미리, '정규반1');
  assert.strictEqual(r.열쇠, '2026-12-07');                       // 엉뚱한 열쇠로 박힌다
  const 개원 = 판_(목록2, 날('2027-02-25'), r.행들);
  assert.strictEqual(인쇄_(개원, '정규반1', 날('2027-02-25')), '⚠ 조 편성이 없습니다');
});
잰다('🔴 오늘(2026-09-03)에는 라벨이 빈칸이 되어, 지금 되던 «미리 편성»이 막힌다', () => {
  const ss = 판_(목록2, 날('2026-09-03'), []);
  assert.strictEqual(G.seasonLabelOf_(ss, TZ), '');
  assert.strictEqual(편성한다_(ss, '정규반1').거절, '⚠ 시즌 시작일이 없습니다');
});

/* ═══ ③ v2 규칙 — 덮는 시즌 · 없으면 다음 시즌 ═════════════════════════ */
console.log('\n③ v2 규칙(덮으면 그것 · 아니면 다음 · 없으면 마지막)');
G.끼운다(G.규칙_고침);
const 목록3 = '2026-12-07~2026-12-18, 2027-02-25';
잰다('오늘(2026-09-03) 미리 편성하면 «파일럿» 열쇠로 박히고 파일럿 첫날 그 행이 걸린다 — 종이 1장(4명 한 조)', () => {
  const 오늘판 = 판_(목록3, 날('2026-09-03'), []);
  const r = 편성한다_(오늘판, '파일럿반');
  assert.strictEqual(r.열쇠, '2026-12-07');
  const 첫날 = 판_(목록3, 날('2026-12-07'), r.행들);
  assert.strictEqual(인쇄_(첫날, '파일럿반', 날('2026-12-07')), '종이 1장 · 인원 4 (차시 1 · 시즌 2026-12-07)');
});
잰다('🔑 반박 1번 자리가 닫힌다 — 개원 5일 전(02-20)에 미리 편성해도 열쇠가 「2027-02-25」로 박히고 개원일에 걸린다', () => {
  const 미리 = 판_(목록3, 날('2027-02-20'), []);
  const r = 편성한다_(미리, '정규반1');
  assert.strictEqual(r.열쇠, '2027-02-25');
  const 개원 = 판_(목록3, 날('2027-02-25'), r.행들);
  assert.strictEqual(인쇄_(개원, '정규반1', 날('2027-02-25')), '종이 1장 · 인원 4 (차시 1 · 시즌 2027-02-25)');
});
잰다('파일럿 마지막 날(12-18)도 연습 시즌 — 평일반 10차시', () => {
  const ss = 판_(목록3, 날('2026-12-18'), []);
  const r = 편성한다_(판_(목록3, 날('2026-12-07'), []), '파일럿반');
  const 판 = 판_(목록3, 날('2026-12-18'), r.행들);
  assert.strictEqual(인쇄_(판, '파일럿반', 날('2026-12-18')), '종이 1장 · 인원 4 (차시 10 · 시즌 2026-12-07)');
  assert.ok(ss);
});
잰다('두 시즌 열쇠가 갈린다 — 12월 행이 2월 화면에 안 섞인다', () => {
  const 파 = 편성한다_(판_(목록3, 날('2026-12-07'), []), '파일럿반').행들;
  const 정 = 편성한다_(판_(목록3, 날('2027-02-25'), []), '파일럿반').행들;
  const 섞음 = 파.concat(정);
  const 개원 = 판_(목록3, 날('2027-02-25'), 섞음);
  const b = G.groupBoardOf_(개원, '파일럿반', 날('2027-02-25'), TZ);
  assert.strictEqual(b.season, '2027-02-25');
  assert.strictEqual(b.groups.reduce((n, a) => n + a.length, 0), 4);   // 8명이 아니라 4명
});
잰다('🔴 끝날짜를 «안» 적으면 1월 달력에서 개원 하루 전 라벨이 파일럿으로 샌다(그래서 끝날짜를 적는다)', () => {
  const 안적음 = '2027-01-11, 2027-02-15';
  assert.strictEqual(라벨(G.규칙_고침(안적음, 날('2027-02-14'))), '2027-01-11');   // 샌다
  const 적음 = '2027-01-11~2027-01-29, 2027-02-15';
  assert.strictEqual(라벨(G.규칙_고침(적음, 날('2027-02-14'))), '2027-02-15');     // 안 샌다
});
잰다('1월 달력(01-11~01-29 파일럿 · 02-15 개원)에서도 선다 — 파일럿 15차시 · 개원일 차시 1', () => {
  const 일월목록 = '2027-01-11~2027-01-29, 2027-02-15';
  assert.strictEqual(라벨(G.규칙_고침(일월목록, 날('2027-01-11'))), '2027-01-11');
  assert.strictEqual(G.lessonNoOf_(G.규칙_고침(일월목록, 날('2027-01-29')), 날('2027-01-29'), '평일'), 15);
  assert.strictEqual(라벨(G.규칙_고침(일월목록, 날('2027-02-15'))), '2027-02-15');
});
잰다('연습 둘 + 정규 하나(12월 리허설 · 1월 파일럿 · 2월 개원)도 한 칸에 선다', () => {
  const 셋 = '2026-12-07~2026-12-18, 2027-01-11~2027-01-29, 2027-02-15';
  assert.strictEqual(라벨(G.규칙_고침(셋, 날('2026-12-10'))), '2026-12-07');
  assert.strictEqual(라벨(G.규칙_고침(셋, 날('2027-01-20'))), '2027-01-11');
  assert.strictEqual(라벨(G.규칙_고침(셋, 날('2027-02-20'))), '2027-02-15');
});

/* ═══ ④ 뒤로 호환 — 칸에 날짜가 하나면 지금 판과 «똑같이» 답한다 ═══════ */
console.log('\n④ 뒤로 호환(칸에 날짜 하나)');
['2026-09-03', '2027-02-25', '2027-03-10', '2027-05-30'].forEach(d => {
  잰다('같은 답 — ' + d, () => {
    assert.strictEqual(라벨(G.규칙_고침('2027-02-25', 날(d))), 라벨(G.규칙_지금('2027-02-25')));
  });
});

/* ═══ ⑤ 「인자 하나 더하기」가 왜 필요한가 ═══════════════════════════════ */
console.log('\n⑤ 여섯 자리에 날짜를 같이 넘겨야 하는 이유(지난 차시 종이 다시 뽑기)');
잰다('시계로만 고르면 개원 뒤에 파일럿 차시 종이를 다시 못 뽑는다', () => {
  const 파 = 편성한다_(판_(목록3, 날('2026-12-07'), []), '파일럿반').행들;
  const 시계만 = 판_(목록3, 날('2027-02-25'), 파);       // 시계 = 개원일, 보려는 날 = 12-10
  assert.strictEqual(인쇄_(시계만, '파일럿반', 날('2026-12-10')), '⚠ 조 편성이 없습니다');
});
잰다('그 자리에 날짜를 같이 넘기면 뽑힌다 — 갈래 A 가 고치는 한 줄씩', () => {
  const 파 = 편성한다_(판_(목록3, 날('2026-12-07'), []), '파일럿반').행들;
  const 넘김 = 판_(목록3, 날('2026-12-10'), 파);         // 시계 자리에 when 을 넣은 것과 같다
  assert.strictEqual(인쇄_(넘김, '파일럿반', 날('2026-12-10')), '종이 1장 · 인원 4 (차시 4 · 시즌 2026-12-07)');
});

console.log('\n합계 = ' + (통과 + 실패) + ' = 통과 ' + 통과 + ' + 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
