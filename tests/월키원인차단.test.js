/* [v9.144] 월키 Date 오염 — **원인 차단** 회귀.
 *
 * 이 파일이 지키는 것은 「groups가 고쳐졌다」가 아니다. 그건 v9.132가 이미 했고, 그러고도
 * 재발은 계속됐다. 여기서 지키는 것은 **다섯 번째가 나올 수 없는 구조**다:
 *   목록(어느 열이 날짜형 키인가)이 **선언(sheetSkeleton_)에서 도출**되고,
 *   손으로 유지되는 자리로 돌아가지 않는다.
 *
 * 재발 4회 — 스토리북(v9.97) · world_raid + report_cards(v9.126) · groups(v9.132).
 * 넷 다 통로(ymTextColFix_)는 있었고, 그 통로를 **태우라고 말해 주는 것이 없었다.**
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { engineSource } = require('./_engine-source');

const code = engineSource();
const stub = new Proxy(function () {}, { get: () => stub, apply: () => stub });
const ctx = {
  SpreadsheetApp: stub, PropertiesService: stub, Utilities: stub, Session: stub,
  MailApp: stub, GmailApp: stub, UrlFetchApp: stub, DriveApp: stub, FormApp: stub,
  DocumentApp: stub, ScriptApp: stub, CacheService: stub, LockService: stub,
  HtmlService: stub, Logger: { log: () => {} }, console,
};
vm.createContext(ctx);
vm.runInContext(code, ctx);

/* ═══════ ① 목록이 선언에서 도출된다 ═══════ */

test('[v9.144] textKeyCols_는 골격에서 도출한다 — 손 목록으로 되돌아가면 실패', () => {
  const cols = ctx.textKeyCols_();
  assert.ok(Array.isArray(cols) && cols.length > 0, '키 열을 하나도 못 찾았다');

  // 골격을 직접 훑어 같은 답이 나오는지 대조한다. 하드코딩 배열로 바뀌면 이 대조가 깨진다.
  const HEADS = { '월': 'ym', 'month': 'ym', '기준월': 'ym', '시즌': 'season' };
  const expected = [];
  for (const row of ctx.sheetSkeleton_()) {
    const heads = row[1] || [];
    heads.forEach((h, i) => {
      const kind = HEADS[String(h == null ? '' : h).trim()];
      if (kind) expected.push(row[0] + '#' + (i + 1) + '#' + kind);
    });
  }
  // vm 컨텍스트에서 만들어진 배열은 호스트와 프로토타입 렐름이 달라 deepStrictEqual이 구조가 같아도
  // 실패한다. 비교 대상은 값이므로 문자열로 눌러서 본다(GAS 실환경은 단일 렐름이라 무관한 차이다).
  assert.equal(cols.map(c => c.sheet + '#' + c.col + '#' + c.kind).join('\n'), expected.join('\n'),
    '골격에서 도출한 결과와 다르다 — 목록이 선언에서 떨어졌다(그게 재발 4회의 원인이다)');
});

test('[v9.144] 사고가 났던 시트 4곳이 전부 대상에 들어 있다', () => {
  const byName = new Map(ctx.textKeyCols_().map(c => [c.sheet, c]));
  for (const [sheet, col] of [['synk_stories', 1], ['world_raid', 1], ['report_cards', 3], ['groups', 1]]) {
    const hit = byName.get(sheet);
    assert.ok(hit, `${sheet}가 키 열 목록에서 빠졌다 — 그 시트에서 실제로 사고가 났다`);
    assert.equal(hit.col, col, `${sheet}의 키 열 번호가 ${hit.col}이다(사고 지점은 ${col}열)`);
  }
});

test('[v9.144] 한 번도 처치된 적 없던 시트들도 이제 대상이다 — 5번째 재발 대기열', () => {
  const names = new Set(ctx.textKeyCols_().map(c => c.sheet));
  // 08-03 실측: 골격에 '월'·'시즌' 열이 있는데 ymTextColFix_ 호출이 없던 시트들.
  for (const s of ['point_logs', 'titles', 'story', 'crew_projects']) {
    assert.ok(names.has(s), `${s}가 빠졌다 — 같은 모양인데 방치되면 다음 사고가 여기서 난다`);
  }
});

test('[v9.144] 월 열과 시즌 열을 둘 다 가진 시트는 둘 다 잡는다', () => {
  // league_history = ['월','시즌',...]. 첫 매치에서 break하면 시즌 열이 영영 안 고쳐진다.
  const lh = ctx.textKeyCols_().filter(c => c.sheet === 'league_history');
  assert.equal(lh.length, 2, `league_history에서 ${lh.length}개만 잡았다 — 한 시트당 하나만 본다`);
  assert.equal(lh.map(c => c.kind).sort().join(','), 'season,ym');
});

test('[v9.144] 키 종류가 정규화 함수를 가른다 — 월=yyyy-MM · 시즌=yyyy-MM-dd', () => {
  const cols = ctx.textKeyCols_();
  assert.equal(cols.find(c => c.sheet === 'groups').kind, 'season',
    '시즌 열에 yyyy-MM를 쓰면 2026-07-13이 2026-07로 뭉개져 조 편성이 통째로 어긋난다');
  assert.equal(cols.find(c => c.sheet === 'world_raid').kind, 'ym');
});

/* ═══════ ② 통로가 실제로 도는가 ═══════ */

test('[v9.144] 자기치유가 전수 치유를 가장 먼저 부른다', () => {
  const start = code.indexOf('function sheetSelfHeal_()');
  const stop = code.indexOf('function orphanVsClean_');
  const seg = code.slice(start, stop > start ? stop : code.length);
  const healAt = seg.indexOf('healTextKeyCols_(ss)');
  assert.ok(healAt > -1, '자기치유가 전수 치유를 부르지 않는다 — 장치를 만들고 배선을 잊었다');
  const firstFix = seg.indexOf('ymTextColFix_(');
  assert.ok(firstFix === -1 || healAt < firstFix,
    '개별 치유가 전수 치유보다 먼저다 — 뒤따르는 중복 정리·재발간 판정이 오염된 값으로 돈다');
});

test('[v9.144] ymTextColFix_의 순서 불변식은 그대로다 — 읽기 → 서식 → 쓰기', () => {
  const seg = code.slice(code.indexOf('function ymTextColFix_('), code.indexOf('function textKeyCols_'));
  const readAt = seg.indexOf('.getValues()');
  const fmtAt = seg.indexOf("setNumberFormat('@')");
  const writeAt = seg.indexOf('.setValues(vals)');
  assert.ok(readAt > -1 && fmtAt > -1 && writeAt > -1, '세 단계 중 하나가 사라졌다');
  assert.ok(readAt < fmtAt, '서식이 읽기보다 먼저다 — Date가 시리얼로 읽혀 instanceof를 빠져나간다(구 v9.97 함정)');
  assert.ok(fmtAt < writeAt, '쓰기가 서식보다 먼저다 — 되쓴 값이 그 자리에서 다시 Date가 된다(v9.125 함정)');
});

test('[v9.144] 전수 치유는 없는 시트를 건너뛴다 — 골격은 선언이지 실재가 아니다', () => {
  const calls = [];
  const ss = {
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
    getSheetByName: (n) => (n === 'world_raid' ? { __name: n } : null),
  };
  ctx.ymTextColFix_ = (sh, col) => { calls.push(sh.__name + '#' + col); return 0; };
  const r = ctx.healTextKeyCols_(ss);
  assert.equal(calls.join(','), 'world_raid#1', '없는 시트에까지 쓰기를 시도했다');
  assert.equal(r.fixed, 0);
  assert.ok(r.cols > 1, '대상 열 수를 보고하지 않는다');
});

test('[v9.144] 전수 치유는 시즌 열에 seasonKeyOf_를 넘긴다', () => {
  const seen = [];
  const ss = { getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar', getSheetByName: (n) => ({ __name: n }) };
  ctx.ymTextColFix_ = (sh, col, tz, norm) => { seen.push([sh.__name, norm]); return 0; };
  ctx.healTextKeyCols_(ss);
  const groups = seen.find(s => s[0] === 'groups');
  const wr = seen.find(s => s[0] === 'world_raid');
  assert.equal(groups[1], ctx.seasonKeyOf_, '시즌 열에 월 정규화가 걸렸다 — 날짜가 뭉개진다');
  assert.equal(wr[1], ctx.ymTextOf_, '월 열에 시즌 정규화가 걸렸다');
});

/* ═══════ ③ 사람이 쓴 텍스트는 건드리지 않는다 (거짓양성 = 데이터 파손) ═══════ */

test('[v9.144] 정규화는 Date 형태만 되돌린다 — 일반 텍스트를 날짜로 오변환하지 않는다', () => {
  const tz = 'Asia/Ulaanbaatar';
  assert.equal(ctx.seasonKeyOf_('2026 봄 시즌', tz), '2026 봄 시즌', '사람이 쓴 라벨을 훼손했다');
  assert.equal(ctx.seasonKeyOf_('정규반1', tz), '정규반1');
  assert.equal(ctx.ymTextOf_('미정', tz), '미정');
  assert.equal(ctx.ymTextOf_('', tz), '');
});
