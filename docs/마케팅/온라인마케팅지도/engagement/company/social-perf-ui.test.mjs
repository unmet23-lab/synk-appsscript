// SNS 성과 · 기간 성과 화면 조각 시험(11-13) — 날짜 범위 · 비교 규칙 · 빈 날 처리 · 누적과 기간 증가 구분.
// 숫자는 꾸민 응답이다(실제 계정 숫자를 고정해 두지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function screen() {
  const source = readFileSync(new URL('./public/social-simple.js', import.meta.url), 'utf8');
  const cut = source.indexOf('// ── 상태와 불러오기 ──');
  assert.ok(cut > 0);
  const context = { URLSearchParams };
  vm.createContext(context);
  vm.runInContext(source.slice(0, cut) + '\n;Object.assign(globalThis,{ssPerfRange,ssPerfQuery,ssPerfSeries,ssPerfSummary,ssPerfChart,ssPerfBlock,ssCollectLine,ssResults,ssAccounts,SNS_SIMPLE_VIEWS});', context);
  // 화면 글은 「 · 」 앞 칸을 NBSP로 바꾼다(ssEsc) — 시험은 보통 칸으로 맞춰 읽는다.
  const plain = fn => (...args) => String(fn(...args)).replace(/ /g, ' ');
  for (const name of ['ssPerfChart', 'ssPerfBlock', 'ssCollectLine', 'ssAccounts']) context[name] = plain(context[name]);
  return context;
}
const change = (delta, count, eligible) => ({ delta, count, eligible, complete: eligible > 0 && count === eligible });
const day = (date, delta, count = 2, eligible = 2) => ({ date, metrics: { views: { change: change(delta, count, eligible) } } });
const report = (overrides = {}) => ({
  scope: { business: '' },
  metrics: { views: { latest: 266, latestCount: 26, count: 20, stale: 6, period: { delta: 120, count: 2, eligible: 2, complete: true },
    periodComparison: { current: 120, previous: 80, delta: 40, rate: 50, count: 2, eligible: 2, complete: true, reason: null } } },
  daily: [day('2026-11-10', 50), day('2026-11-11', null, 0, 2), day('2026-11-12', 70, 1, 2)],
  ...overrides
});

test('기간은 끝난 어제(한국 날짜)까지 N일, 이전 기간은 그 바로 앞 같은 길이', () => {
  const { ssPerfRange, ssPerfQuery } = screen();
  assert.deepEqual({ ...ssPerfRange('2026-11-13', 7) }, { start: '2026-11-06', end: '2026-11-12', prevStart: '2026-10-30', prevEnd: '2026-11-05', days: 7 });
  const r90 = ssPerfRange('2026-03-01', 90);
  assert.equal(r90.end, '2026-02-28');
  assert.equal((Date.parse(r90.end) - Date.parse(r90.start)) / 864e5 + 1, 90);
  assert.equal((Date.parse(r90.prevEnd) - Date.parse(r90.prevStart)) / 864e5 + 1, 90);
  assert.equal((Date.parse(r90.start) - Date.parse(r90.prevEnd)) / 864e5, 1, '두 기간 사이에 빈 날 · 겹친 날 없음');
  const range = ssPerfRange('2026-11-13', 30);
  assert.equal(ssPerfQuery(range, 'business:LAB'), '/api/analytics?start=2026-10-14&end=2026-11-12&business=LAB');
  assert.equal(ssPerfQuery(range, 'channel:abc', 'previous'), '/api/analytics?start=2026-09-14&end=2026-10-13&channel=abc');
  assert.equal(ssPerfQuery(range, 'nope:x'), '/api/analytics?start=2026-10-14&end=2026-11-12', '모르는 거르기는 보내지 않는다');
});

test('빈 날은 null(0으로 메우지 않음) · 선을 끊는다 · 일부만 비교된 날은 속 빈 점', () => {
  const { ssPerfSeries, ssPerfChart } = screen();
  const series = ssPerfSeries(report(), 'views');
  assert.deepEqual(series.map(p => p.value), [50, null, 70]);
  assert.equal(series[2].complete, false);
  const svg = ssPerfChart(series, [], { label: '조회' });
  const d = svg.match(/class="ss-perf-cur" d="([^"]*)"/)[1];
  assert.equal((d.match(/M/g) || []).length, 2, '빈 날에서 선을 새로 시작');
  assert.doesNotMatch(d, /L/, '이웃이 비어 있어 이어 그리지 않는다');
  assert.match(svg, /ss-perf-cdot is-part/);
  assert.match(svg, /11\.11 \(수\) · 조회 기록 없음/);
  assert.match(ssPerfChart([{ date: '2026-11-10', value: null }], []), /견줄 기록이 아직 없어요/);
  assert.doesNotMatch(svg, /\sstyle=/);
});

test('비교 %는 periodComparison이 같은 대상으로 완전할 때만 · period.rate는 쓰지 않는다', () => {
  const { ssPerfBlock } = screen();
  const D = { today: '2026-11-13', accounts: [], health: {} };
  const ready = cur => ({ days: 30, metric: 'views', target: '', status: 'ready', current: cur, previous: report() });
  const ok = ssPerfBlock(ready(report()), D);
  assert.match(ok, /▲ 50%/);
  assert.match(ok, /같은 대상 2개 · 이번 \+120 · 이전 \+80/);
  assert.match(ok, /30일 동안 늘어난 조회/);
  assert.match(ok, /게시물 누적 조회\(지금까지\)/);
  assert.match(ok, /기간 증가가 아니라 11\.12까지 쌓인 합/);
  const partial = report(); partial.metrics.views.periodComparison = { current: 90, previous: 60, delta: 30, rate: null, count: 1, eligible: 2, complete: false, reason: 'partial-coverage' };
  partial.metrics.views.period.rate = 999;
  const p = ssPerfBlock(ready(partial), D);
  assert.doesNotMatch(p, /999|▲|▼/, '불완전하면 %를 내지 않고, 누적 대비 rate도 쓰지 않는다');
  assert.match(p, /일부 대상만 두 기간 기록이 있어/);
  const none = report(); delete none.metrics.views.periodComparison;
  assert.match(ssPerfBlock(ready(none), D), /비교 자료가 아직 없어요/);
});

test('전체 비교가 없고 일부 대상만 비교되면 matchedRate를 「비교 가능한 N/M개 기준」으로 크게 표시한다 · 구형 응답 호환', () => {
  const { ssPerfBlock } = screen();
  const D = { today: '2026-11-13', accounts: [], health: {} };
  const withPc = pc => { const r = report(); r.metrics.views.periodComparison = pc; return { days: 30, metric: 'views', target: '', status: 'ready', current: r, previous: report() }; };
  const part = ssPerfBlock(withPc({ current: 90, previous: 60, delta: 30, rate: null, matchedRate: 50, count: 18, eligible: 26, complete: false, reason: 'partial-coverage' }), D);
  assert.match(part, /▲ 50%/);
  assert.match(part, /class="ss-perf-tag">일부 대상만 18\/26</);
  assert.match(part, /비교 가능한 18\/26개 기준 · 이번 \+90 · 이전 \+60 · 전체 계정 성장이 아니에요/);
  // 숫자 고침 · 이전 0은 서버가 matchedRate를 null로 준다 — 화면도 %를 내지 않고 이번·이전 실제값만 밝힌다.
  for (const reason of ['counter-correction', 'zero-previous']) {
    const html = ssPerfBlock(withPc({ current: 5, previous: 0, rate: null, matchedRate: 77, count: 1, eligible: 2, complete: false, reason }), D);
    assert.doesNotMatch(html, /77%|일부 대상만/, reason);
    assert.match(html, /이번 \+5 · 이전 0/, reason);
  }
  const zeroComplete = ssPerfBlock(withPc({ current: 10, previous: 0, delta: 10, rate: 99, count: 2, eligible: 2, complete: true, reason: null }), D);
  assert.doesNotMatch(zeroComplete, /99%|▲|▼/, '이전 0이면 어떤 경우에도 퍼센트를 만들지 않는다');
  // matchedRate가 null인 부분 비교도 「일부 대상만 N/M」 표지와 이번·이전 실제값을 함께 붙인다.
  const noRatePart = ssPerfBlock(withPc({ current: 1, previous: 2, rate: null, matchedRate: null, count: 1, eligible: 2, complete: false, reason: 'partial-coverage' }), D);
  assert.match(noRatePart, /class="ss-perf-tag">일부 대상만 1\/2</);
  assert.match(noRatePart, /일부 대상만 두 기간 기록이 있어 %는 내지 않아요 · 비교 가능한 1\/2개 기준 · 이번 \+1 · 이전 \+2/);
  // 구형 응답(matchedRate 없음 · 완전 비교)은 그대로 rate.
  const old = ssPerfBlock(withPc({ current: 120, previous: 80, delta: 40, rate: 50, count: 2, eligible: 2, complete: true, reason: null }), D);
  assert.match(old, /▲ 50%/);
  assert.doesNotMatch(old, /일부 대상만/);
});

test('분류 안 된 채널: 사업으로 거르면 빠진 수를, 모든 계정이면 분류 필요를 알린다', () => {
  const { ssPerfBlock } = screen();
  const D = { today: '2026-11-13', accounts: [], health: {} };
  const cur = report({ scope: { business: 'LAB' }, unassignedChannelCount: 3 });
  assert.match(ssPerfBlock({ days: 7, metric: 'views', target: 'business:LAB', status: 'ready', current: cur, previous: report() }, D), /사업 분류가 안 된 채널 3개는 LAB 숫자에서 빠졌어요/);
  assert.match(ssPerfBlock({ days: 7, metric: 'views', target: '', status: 'ready', current: report({ unassignedChannelCount: 3 }), previous: report() }, D), /사업 분류가 필요한 채널이 3개 있어요/);
  assert.doesNotMatch(ssPerfBlock({ days: 7, metric: 'views', target: 'platform:youtube', status: 'ready', current: report({ unassignedChannelCount: 3 }), previous: report() }, D), /사업 분류/);
  assert.doesNotMatch(ssPerfBlock({ days: 7, metric: 'views', target: '', status: 'ready', current: report({ unassignedChannelCount: 0 }), previous: report() }, D), /사업 분류/);
});

test('사업 거르기를 서버가 돌려주지 않으면 그 사업 숫자라고 쓰지 않는다 · 도달 · 팔로워 안내', () => {
  const { ssPerfBlock } = screen();
  const D = { today: '2026-11-13', accounts: [{ channelId: 'c1', platform: 'youtube', handle: '@a' }], health: {} };
  const html = ssPerfBlock({ days: 7, metric: 'views', target: 'business:SHIFT', status: 'ready', current: report(), previous: report() }, D);
  assert.match(html, /SHIFT 사업으로 거르는 기능이 서버에 아직 없어/);
  assert.doesNotMatch(html, /ss-perf-num/);
  const scoped = report({ scope: { business: 'SHIFT' } });
  assert.match(ssPerfBlock({ days: 7, metric: 'views', target: 'business:SHIFT', status: 'ready', current: scoped, previous: report() }, D), /ss-perf-num/);
  const reach = report(); reach.metrics.reach = reach.metrics.views;
  assert.match(ssPerfBlock({ days: 7, metric: 'reach', target: '', status: 'ready', current: reach, previous: reach }, D), /서로 다른 사람 수가 아니에요/);
  assert.match(html, /<option value="channel:c1">유튜브 @a<\/option>/);
  for (const d of [7, 30, 60, 90]) assert.match(html, new RegExp(`data-value="${d}"`));
  for (const k of ['views', 'likes', 'shares', 'comments', 'saves', 'reach', 'followers']) assert.match(html, new RegExp(`data-ss-action="perf-metric" data-value="${k}"`));
});

test('수집 줄: 마지막 성공 · 범위 · 일부 실패 · 하루 수집 시각(서버가 줄 때만)', () => {
  const { ssCollectLine } = screen();
  const line = ssCollectLine({ today: '2026-11-13', health: { collectedAt: '2026-11-13 09:02', collectOk: 10, collectTotal: 12, failed: 2, nextAt: '2026-11-13 21:30', collectionTimes: ['09:00', '21:30'] } });
  assert.match(line, /마지막 수집 오늘 09:02/);
  assert.match(line, /계정 10\/12개/);
  assert.match(line, /일부 실패 · 실패 2/);
  assert.match(line, /하루 2번\(09:00 · 21:30\)/);
  assert.match(ssCollectLine({ today: '2026-11-13', schedule: { hoursKst: [9, 21] }, health: {} }), /09:00 · 21:00/);
  assert.match(ssCollectLine({ today: '2026-11-13', collectionSchedule: { enabled: true, hoursKst: [9, 21.5] }, health: {} }), /하루 2번\(09:00 · 21:30\)/, '서버 계약 collectionSchedule · 소수 시각');
  assert.doesNotMatch(ssCollectLine({ today: '2026-11-13', collectionSchedule: { enabled: false, hoursKst: [9] }, health: {} }), /하루 \d번/, '꺼진 수집은 시각을 쓰지 않는다');
  // 다음 수집: collectionSchedule.nextAt(ISO)이 health.nextAt보다 먼저. 21:00 한국 = 12:00Z.
  const both = ssCollectLine({ today: '2026-11-13', collectionSchedule: { enabled: true, hoursKst: [9, 21], nextAt: '2026-11-13T12:00:00.000Z' }, health: { nextAt: '2026-11-14 09:00' } });
  assert.match(both, /다음 오늘 21:00/);
  assert.doesNotMatch(both, /11\.14/);
  assert.match(ssCollectLine({ today: '2026-11-13', health: { nextAt: '2026-11-14 09:00' } }), /다음 11\.14 \(토\) 09:00/, '옛 응답은 health.nextAt');
  assert.match(ssCollectLine({ today: '2026-11-13', collectionSchedule: { enabled: false, nextAt: null }, health: {} }), /자동 수집 꺼짐/);
  assert.doesNotMatch(ssCollectLine({ today: '2026-11-13', health: {} }), /하루 \d번/, '시각을 모르면 지어내지 않는다');
});

test('휴대폰 탭도 지도가 맨 앞 · 계정 장의 30일 숫자는 「게시물 누적 조회」라고 쓴다', () => {
  const { SNS_SIMPLE_VIEWS, ssAccounts } = screen();
  assert.equal(SNS_SIMPLE_VIEWS[0][0], 'map');
  const html = ssAccounts({ accounts: [{ brand: 'LAB', country: true, platform: 'youtube', handle: '@vn', posts30: 2, views30: 1234 }, { brand: 'SHIFT', country: false, platform: 'instagram', handle: '@shift', posts30: 4, views30: 560 }] });
  assert.match(html, /최근 30일 게시물의 누적 조회 1,234회/);
  assert.match(html, /@shift/, '새 사업 분류(SHIFT · PULSE · PATH · SYNK) 계정을 누락하지 않는다');
  assert.match(html, /아래 LAB 목록에 따로 있고/);
  assert.doesNotMatch(html, /30일 조회가 다 합쳐|30일 동안 얼마나 봤는지/);
  // 서버가 조회를 못 받은 계정(views30: null)은 0으로 더하지 않고 빠진 수를 밝힌다.
  const partial = ssAccounts({ accounts: [{ brand: 'LAB', country: true, platform: 'youtube', handle: '@vn', posts30: 2, views30: 1234 }, { brand: 'LAB', country: true, platform: 'tiktok', handle: '@vn2', posts30: 1, views30: null }] });
  assert.match(partial, /누적 조회 1,234회\(1곳은 조회 수 미측정이라 뺌\)/);
  assert.match(partial, /1편 · 조회 미측정/);
  const none = ssAccounts({ accounts: [{ brand: 'LAB', country: true, platform: 'tiktok', handle: '@vn2', posts30: 1, views30: null }] });
  assert.match(none, /누적 조회 — \(조회 수를 아직 못 받았어요\)/);
  assert.doesNotMatch(none, /누적 조회 0회/);
});

test('공개 통계만 연결한 YouTube 안내는 60·90일에 YouTube가 대상일 때만 한 번', () => {
  const { ssPerfBlock } = screen();
  const D = { today: '2026-11-13', accounts: [{ channelId: 'yt', platform: 'youtube', handle: '@a' }, { channelId: 'ig', platform: 'instagram', handle: '@b' }], health: {} };
  const at = (days, target) => ssPerfBlock({ days, metric: 'views', target, status: 'ready', current: report({ scope: { business: target.startsWith('business:') ? target.slice(9) : '' } }), previous: report() }, D);
  const note = /공개 통계만 연결한 YouTube는 기록을 30일만 보관해서/;
  assert.equal((at(90, '').match(new RegExp(note.source, 'g')) || []).length, 1, '한 번만');
  assert.match(at(60, 'platform:youtube'), note);
  assert.match(at(60, 'channel:yt'), note);
  assert.doesNotMatch(at(30, ''), note, '30일 이하는 안내하지 않는다');
  assert.doesNotMatch(at(90, 'platform:instagram'), note, 'YouTube가 대상이 아니면 안내하지 않는다');
  assert.doesNotMatch(at(90, 'channel:ig'), note);
  const noYt = ssPerfBlock({ days: 90, metric: 'views', target: '', status: 'ready', current: report(), previous: report() }, { ...D, accounts: [{ channelId: 'ig', platform: 'instagram' }] });
  assert.doesNotMatch(noYt, note);
});
