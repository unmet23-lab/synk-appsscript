// SNS · 나라 지도 화면 조각 시험(11-13) — 네 사업 · 전체 보기 · 운영 상태 병합을 만든 자료(fixture)로 본다.
// 생성 JSON(marketing-map.json)과 원장 대조는 marketing-map.test.mjs가 맡는다. 여기 숫자는 꾸민 자료이고 실제 원장 숫자가 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function screen() {
  const source = readFileSync(new URL('./public/marketing-map.js', import.meta.url), 'utf8');
  const cut = source.indexOf('// ── 상태와 불러오기 ──');
  assert.ok(cut > 0);
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(0, cut) + '\n;Object.assign(globalThis,{mmPage,mmBrands,mmAllView,mmOpsIndex,mmLoginText,mmPublicationText,mmCollectionText,mmWhen});', context);
  return context;
}
const geo = { w: 1000, h: 500, countries: ['KR', 'JP', 'AU', 'VN', 'US', 'SG'].map(a2 => ({ a2, d: 'M0 0' })).concat([{ a2: null, d: 'M1 1' }]) };
const acc = (id, business, platform, secured = true, extra = {}) => ({ id, business, contentTrack: extra.contentTrack || business, platform, handle: secured ? '@' + id : null, url: secured ? 'https://example.com/' + id : null, secured, state: secured ? '확보' : '계정 계획', note: null, ...extra });
const country = (code, name, status, accounts, extra = {}) => ({ code, name, status, region: '동아시아', center: [10, 10], small: false, area: 500, secured: accounts.filter(a => a.secured).length, planned: accounts.length, accounts, lines: [], ...extra });
const view = (brand, countries, shared = [], extra = {}) => ({ brand, name: brand, what: '', headline: { first: brand, second: '' }, countries, shared, sharedNote: null,
  summary: { active: countries.filter(c => c.status === 'active').length, target: countries.filter(c => c.status === 'target').length, secured: 0, planned: 0 }, ...extra });
const linkedin = acc('yuho-linkedin-primary', 'SYNK', 'LinkedIn', true, { contentTrack: 'YUHO', shared: true });
const tiktok = acc('pulse-tiktok', 'PULSE', 'TikTok', true, { shared: true });
const fixture = () => ({
  schema: 'synk-marketing-map/v1', generatedAt: '2026-11-13T11:00:00Z', geo,
  views: {
    lab: view('LAB', [country('VN', '베트남', 'active', [acc('lab-vn-yt', 'LAB', 'YouTube')]), country('JP', '일본', 'target', [acc('lab-jp-ig', 'LAB', 'Instagram', false)])], [acc('lab-youtube', 'LAB', 'YouTube')]),
    shift: view('SHIFT', [country('KR', '한국', 'active', [acc('shift-ig', 'SHIFT', 'Instagram')])], [acc('shift-x', 'SHIFT', 'X')]),
    pulse: view('PULSE', [country('KR', '한국', 'active', [acc('pulse-blog', 'PULSE', 'Naver Blog')]), country('AU', '호주', 'target', [linkedin, tiktok])], [tiktok]),
    path: view('PATH', [], [acc('lab-youtube', 'LAB', 'YouTube', true, { shared: true })], { sharedNote: '독립 계정 없음' })
  },
  all: { accounts: [acc('lab-youtube', 'LAB', 'YouTube', true, { country: null }), acc('lab-vn-yt', 'LAB', 'YouTube', true, { country: '베트남' }), acc('shift-ig', 'SHIFT', 'Instagram'), tiktok, linkedin, acc('pulse-th-ig', 'PULSE', 'Instagram', false)],
    plans: [{ id: 'plan-1', business: 'PATH', platform: 'YouTube', state: '장기 계획', note: '유학 안내' }], summary: { managed: 5, planned: 1, excluded: 0, longTermPlans: 1 } }
});

test('네 사업 단추와 전체 단추는 자료에 있는 보기만 보이고, 옛 자료(lab · pulse만)도 열린다', () => {
  const { mmPage } = screen();
  const html = mmPage(fixture(), 'lab', null);
  assert.deepEqual([...html.matchAll(/data-mm-action="view" data-value="(\w+)"/g)].map(m => m[1]), ['lab', 'shift', 'pulse', 'path', 'all']);
  const old = fixture(); delete old.views.shift; delete old.views.path; delete old.all;
  const oldHtml = mmPage(old, 'path', null);
  assert.deepEqual([...oldHtml.matchAll(/data-mm-action="view" data-value="(\w+)"/g)].map(m => m[1]), ['lab', 'pulse']);
  assert.match(oldHtml, /data-mm-view="lab"/, '없는 보기를 고르면 첫 보기로');
  for (const id of ['shift', 'path', 'all']) assert.doesNotMatch(mmPage(fixture(), id, null), /\sstyle=/, 'CSP: style 속성 없음');
});

test('나라를 나누지 않은 계정은 목록으로 두고 나라를 지어내지 않는다 · 다른 사업 계정은 표지를 단다', () => {
  const { mmPage } = screen();
  const lab = mmPage(fixture(), 'lab', null);
  assert.match(lab, /나라를 나누지 않은 계정 <span class="mm-num">1<\/span>/, '본 LAB 계정은 공통 목록');
  const path = mmPage(fixture(), 'path', null);
  assert.equal((path.match(/mm-c hot/g) || []).length, 0, 'PATH는 나라를 칠하지 않는다');
  assert.match(path, /LAB 계정<\/span>/, 'PATH 보기의 LAB 계정은 연계로 표시');
  assert.match(path, /독립 계정 없음/);
  // 연계만 있는 보기는 「이 사업 계정 0」과 「연계 n 포함」을 밝힌다(다른 사업 계정을 이 사업 실적처럼 세지 않음).
  const linked = fixture(); Object.assign(linked.views.path.summary, { secured: 1, planned: 1, primary: 0, shared: 1 });
  const linkedHtml = mmPage(linked, 'path', null);
  assert.match(linkedHtml, /확보한 계정\(연계 1\)/);
  assert.match(linkedHtml, /이 사업 계정<\/span><strong>0<small>개/);
  assert.doesNotMatch(mmPage(fixture(), 'lab', null), /연계 \d+\)|이 사업 계정/, '연계가 없으면 예전 칸 그대로');
});

test('PULSE 나라의 공통 계정(accountRefs)은 확보로 세고 한 번만 보인다', () => {
  const { mmPage } = screen();
  const au = mmPage(fixture(), 'pulse', 'AU');
  assert.match(au, /계정 2\/2/);
  assert.equal((au.match(/@pulse-tiktok/g) || []).length, 1, '공통 틱톡을 나라 칸 · 공통 칸에 두 번 그리지 않는다');
  assert.doesNotMatch(au, /만들 계정/, '공통 계정으로 채운 나라는 새 계정 계획이 없다');
});

test('전체 보기: 사업별로 묶고 장기 계획은 따로 · 계정 수에 더하지 않는다', () => {
  const { mmPage, mmAllView } = screen();
  const D = fixture();
  const html = mmPage(D, 'all', null);
  assert.match(html, /관리 중<\/span><strong>5<small>개/);
  assert.match(html, /장기 계획 <span class="mm-num">1<\/span>/);
  assert.match(html, /계정 <span class="mm-num">6<\/span>/, '계정 수는 계정 목록 길이(장기 계획 제외)');
  assert.match(html, /나라 미정/, '나라 없는 계정은 「나라 미정」으로');
  const lab = mmPage(D, 'all', null, { business: 'SHIFT' });
  assert.doesNotMatch(lab.split('<aside')[1], /@lab-vn-yt/, '사업 거르기');
  const kr = mmAllView(D).countries.find(c => c.code === 'KR');
  assert.equal(kr.role, 'SHIFT · PULSE');
  assert.equal(new Set(kr.accounts.map(a => a.id)).size, kr.accounts.length, '같은 계정은 한 번만');
});

test('운영 상태는 같은 id일 때만 붙이고, 로그인 · 게시 · 수집을 따로 쓰며 없는 칸은 「기록 미확인」', () => {
  const { mmPage, mmLoginText, mmPublicationText, mmCollectionText } = screen();
  const accountMap = { generatedAt: '2026-11-13T11:30:00Z', accounts: [
    { id: 'pulse-tiktok', operations: { login: { state: 'verified', observedAt: '2026-11-13T11:00:00Z', scope: 'Profile 5' }, publication: { publishedCount: 3, scheduledCount: 1, pendingConfirmationCount: 1, lastPublishedAt: '2026-11-12 21:00', nextScheduledAt: '2026-11-14 21:00' }, collection: { state: 'success', checkedAt: '2026-11-13 09:00', method: 'official-api' } } },
    { id: 'someone-else', operations: { login: { state: 'login-required' } } }
  ] };
  const html = mmPage(fixture(), 'pulse', 'AU', { accountMap });
  assert.match(html, /확인됨 · 11월 13일 20:00 · Profile 5/);
  assert.match(html, /게시 3건\(마지막 11월 12일 21:00\) · 예약 1건\(다음 11월 14일 21:00\) · 게시 확인 대기 1건/);
  assert.match(html, /오늘 수집 완료 · 공식 API · 마지막 수집 11월 13일 09:00/);
  assert.match(html, /운영 상태<\/dt><dd>기록 미확인/, '링크드인은 운영 자료에 없으니 미확인(실패로 단정하지 않음)');
  assert.doesNotMatch(html, /로그인 필요/, '다른 id의 상태를 짐작해 붙이지 않는다');
  assert.doesNotMatch(mmPage(fixture(), 'pulse', 'AU'), /mm-ops/, '운영 자료가 없으면(관리자 아님) 상태 줄이 없다');
  assert.equal(mmLoginText({ state: 'historical', observedAt: '2026-11-09' }), '예전 기록만 있음 · 11월 9일 · 다시 확인 전');
  assert.equal(mmLoginText({ state: 'login-required', scope: 'Profile 2 경로' }), '로그인 필요 · Profile 2 경로');
  // 날짜만 확인한 기록: 만든 시각(09:00)을 쓰지 않는다 — ISO 앞 10자 날짜만.
  assert.equal(mmLoginText({ state: 'historical', observedAt: '2026-11-09T00:00:00.000Z', observedDateOnly: true }), '예전 기록만 있음 · 11월 9일 · 다시 확인 전');
  assert.equal(mmLoginText({ state: 'verified', observedAt: '2026-11-12T00:00:00.000Z', observedDateOnly: true, scope: 'Profile 7' }), '확인됨 · 11월 12일 · Profile 7');
  assert.match(mmLoginText({ state: 'verified', observedAt: '2026-11-12T00:00:00.000Z', scope: 'Profile 7' }), /11월 12일 09:00/, '시각이 있는 기록은 한국 시각 그대로');
  assert.equal(mmPublicationText({ publishedCount: 0, scheduledCount: 0 }), '기록 미확인', '확인 시각 없는 0은 「없음」이라 쓰지 않는다');
  assert.equal(mmPublicationText({ publishedCount: 0, scheduledCount: 0, checkedAt: '2026-11-13 20:13' }), '작업실 게시 · 예약 없음 · 11월 13일 20:13 확인');
  assert.equal(mmCollectionText(null), '기록 미확인');
  // 만든 뒤 예약 시각이 지나면 예약으로 남기지 않고 확인 필요를 붙인다(게시로 바꾸지 않음) · 기준 시각을 밝힌다.
  const pub = { publishedCount: 1, scheduledCount: 1, nextScheduledAt: '2026-11-13T12:00:00Z', checkedAt: '2026-11-13T11:57:00Z' };
  assert.match(mmPublicationText(pub, Date.parse('2026-11-13T11:58:00Z')), /예약 1건\(다음 11월 13일 21:00\) · 11월 13일 20:57 기준/);
  const late = mmPublicationText(pub, Date.parse('2026-11-13T12:30:00Z'));
  assert.match(late, /그 예약 시각이 지나 게시 확인 필요/);
  assert.match(late, /게시 1건/, '게시 수를 늘리지 않는다');
  assert.doesNotMatch(late, /게시 2건/);
  // 최근 근거 60개 밖의 옛 게시는 따로 밝히고 표시 수에 더하지 않는다.
  const older = mmPublicationText({ publishedCount: 60, omittedPublishedCount: 12, scheduledCount: 0, checkedAt: '2026-11-13T11:57:00Z' }, Date.parse('2026-11-13T11:58:00Z'));
  assert.match(older, /최근 근거 게시 60건 · 그 전 게시 12건은 따로\(이 수에 안 넣음\)/);
  assert.doesNotMatch(older, /72건/);
  assert.doesNotMatch(mmPublicationText({ publishedCount: 3, omittedPublishedCount: 0 }), /최근 근거|따로/);
});

test('수집 상태 · 방법은 서버 토큰을 모두 한국어로 옮기고 영어 토큰을 내보이지 않는다', () => {
  const { mmCollectionText } = screen();
  const policy = readFileSync(new URL('./collection-policy.mjs', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('./account-catalog.mjs', import.meta.url), 'utf8');
  // 서버가 낼 수 있는 이름: collectionItem의 show('…') + 계정 목록의 not-managed · not-registered · unknown · historical
  const tokens = [...new Set([...policy.matchAll(/show\('([a-z-]+)'/g)].map(m => m[1]))];
  assert.ok(tokens.length >= 10, '수집 상태 이름을 서버 원문에서 읽음');
  for (const extra of ['not-managed', 'not-registered']) { assert.match(catalog, new RegExp(`'${extra}'`)); tokens.push(extra); }
  tokens.push('unknown', 'historical');
  // 방법 이름: 계정 목록(official-api · creator-export-or-manual)과 현황판 원장(server · public-api · vk-api · public-page · screen-only)
  for (const state of tokens) for (const method of ['official-api', 'creator-export-or-manual', 'server', 'public-api', 'vk-api', 'public-page', 'screen-only']) {
    const text = mmCollectionText({ state, method, checkedAt: '2026-11-13T00:02:00Z' });
    assert.doesNotMatch(text.replace(/\b(API|VK)\b/g, ''), /[A-Za-z]{2,}/, `${state}/${method}: ${text}`);
    if (state !== 'unknown') assert.doesNotMatch(text, /미확인/, `${state}: 아는 토큰은 미확인으로 뭉개지 않는다`);
  }
  assert.equal(mmCollectionText({ state: 'brand-new-state', method: 'mystery' }), '수집 상태 미확인', '모르는 토큰도 영어를 내보이지 않는다');
});
