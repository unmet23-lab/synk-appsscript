'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

function 엔진로드(속성, 응답함수) {
  const 요청 = [];
  const 기록 = [];
  const 메일 = [];
  const props = Object.assign({
    상담AI_페이지토큰: 'page-token',
    상담AI_IG토큰: 'ig-token',
  }, 속성 || {});
  const propStore = {
    getProperty: (k) => props[k] || '',
    setProperty: (k, v) => { props[k] = String(v); },
    setProperties: (o) => Object.assign(props, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]))),
    deleteProperty: (k) => { delete props[k]; },
  };
  const ctx = {
    PropertiesService: { getScriptProperties: () => propStore },
    UrlFetchApp: { fetch: (url, options) => {
      요청.push({ url, options });
      if (응답함수) return 응답함수(url, options);
      return { getResponseCode: () => 200, getContentText: () => '{}' };
    } },
    SpreadsheetApp: {}, Utilities: {}, Logger: { log: () => {} }, ContentService: {},
    CacheService: {}, MailApp: {}, console,
  };
  vm.createContext(ctx);
  new vm.Script(fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8'), { filename: '상담AI.js' }).runInContext(ctx);
  ctx.상담_기록_ = (...args) => 기록.push(args);
  ctx.상담_메시지조립_ = (text) => ({ text });
  ctx.adminMail = (...args) => 메일.push(args);
  return { ctx, 요청, 기록, 메일, props };
}

test('Facebook과 Instagram 웹훅을 플랫폼까지 보존해 정규화한다', () => {
  const { ctx } = 엔진로드();
  const facebook = ctx.상담_정규화_({ object: 'page', entry: [{ id: 'page', messaging: [{ sender: { id: 'f1' }, message: { text: '안녕', mid: 'm1' } }] }] });
  const instagram = ctx.상담_정규화_({ object: 'instagram', entry: [{ id: 'ig', messaging: [{ sender: { id: 'i1' }, message: { text: 'hello', mid: 'm2' } }] }] });
  assert.equal(facebook.플랫폼, 'fb');
  assert.equal(instagram.플랫폼, 'ig');
  assert.equal(instagram.세션, 'i1');
});

test('Facebook 답장은 Graph v26 페이지 호스트와 페이지 토큰만 쓴다', () => {
  const { ctx, 요청 } = 엔진로드();
  assert.equal(ctx.상담_전송_('f1', '안녕', { 플랫폼: 'fb' }), true);
  assert.equal(요청.length, 1);
  assert.match(요청[0].url, /^https:\/\/graph\.facebook\.com\/v26\.0\/me\/messages\?/);
  assert.match(요청[0].url, /page-token/);
  assert.doesNotMatch(요청[0].url, /ig-token/);
});

test('Instagram 답장은 Instagram v26 호스트와 전용 토큰만 쓴다', () => {
  const { ctx, 요청 } = 엔진로드();
  assert.equal(ctx.상담_전송_('i1', 'hello', { 플랫폼: 'ig' }), true);
  assert.equal(요청.length, 1);
  assert.match(요청[0].url, /^https:\/\/graph\.instagram\.com\/v26\.0\/me\/messages\?/);
  assert.match(요청[0].url, /ig-token/);
  assert.doesNotMatch(요청[0].url, /page-token/);
});

test('채널별 전송 실패 알림이 올바른 토큰과 권한을 안내한다', () => {
  const 실패 = () => ({ getResponseCode: () => 400, getContentText: () => '{"error":"denied"}' });
  const ig = 엔진로드({}, 실패);
  assert.equal(ig.ctx.상담_전송_('ig-user', '답장', { 플랫폼: 'ig' }), false);
  assert.match(ig.메일[0][1], /상담AI_IG토큰/);
  assert.match(ig.메일[0][1], /instagram_business_basic/);
  assert.doesNotMatch(ig.메일[0][1], /페이지 액세스 토큰 만료/);

  const fb = 엔진로드({}, 실패);
  assert.equal(fb.ctx.상담_전송_('fb-user', '답장', { 플랫폼: 'fb' }), false);
  assert.match(fb.메일[0][1], /상담AI_페이지토큰/);
  assert.match(fb.메일[0][1], /pages_messaging/);
});

test('Instagram 전용 토큰이 없으면 페이지 토큰으로 우회하지 않고 닫는다', () => {
  const { ctx, 요청, 기록 } = 엔진로드({ 상담AI_IG토큰: '' });
  assert.equal(ctx.상담_전송_('i1', 'hello', { 플랫폼: 'ig' }), false);
  assert.equal(요청.length, 0);
  assert.match(String(기록[0][2]), /상담AI_IG토큰 미설정/);
});

test('팔로우 조회도 Instagram 전용 호스트와 토큰만 쓴다', () => {
  const { ctx, 요청 } = 엔진로드();
  ctx.UrlFetchApp.fetch = (url) => {
    요청.push({ url });
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ is_user_follow_business: true }) };
  };
  assert.equal(ctx.상담_팔로우확인_('i1'), true);
  assert.match(요청[0].url, /^https:\/\/graph\.instagram\.com\/v26\.0\/i1\?/);
  assert.match(요청[0].url, /ig-token/);
});

test('Instagram 장기 토큰은 만료 14일 전 자동 갱신하고 새 만료시각을 저장한다', () => {
  const 응답 = () => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ access_token: 'renewed-token', expires_in: 5184000 }),
  });
  const { ctx, 요청, props } = 엔진로드({
    상담AI_IG토큰만료시각: '0',
    상담AI_IG토큰발급시각: String(Date.now() - 25 * 3600 * 1000),
  }, 응답);
  const 결과 = ctx.상담AI_IG토큰수명점검_();
  assert.equal(결과.ok, true);
  assert.equal(props.상담AI_IG토큰, 'renewed-token');
  assert.ok(Number(props.상담AI_IG토큰만료시각) > Date.now() + 50 * 24 * 3600 * 1000);
  assert.match(요청[0].url, /^https:\/\/graph\.instagram\.com\/refresh_access_token\?/);
});

test('새 Instagram 토큰은 최초 24시간 동안 갱신하지 않는다', () => {
  const { ctx, 요청 } = 엔진로드({
    상담AI_IG토큰만료시각: '0',
    상담AI_IG토큰발급시각: String(Date.now()),
  });
  const 처음 = ctx.상담AI_IG토큰수명점검_();
  assert.equal(처음.ok, true);
  assert.equal(처음.skip, 'fresh-token');
  assert.equal(요청.length, 0);
  assert.equal(ctx.상담AI_IG토큰수명점검_().skip, 'fresh-token');
  assert.equal(요청.length, 0);
});

test('발급시각을 모르는 기존 Instagram 토큰은 즉시 갱신한다', () => {
  const 응답 = () => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ access_token: 'renewed-legacy-token', expires_in: 5184000 }),
  });
  const { ctx, 요청, props } = 엔진로드({ 상담AI_IG토큰만료시각: '0' }, 응답);
  const 결과 = ctx.상담AI_IG토큰수명점검_();
  assert.equal(결과.ok, true);
  assert.equal(요청.length, 1);
  assert.equal(props.상담AI_IG토큰, 'renewed-legacy-token');
  assert.ok(Number(props.상담AI_IG토큰만료시각) > Date.now());
});

test('Instagram 토큰 만료가 멀면 갱신 API를 호출하지 않는다', () => {
  const 먼만료 = String(Date.now() + 20 * 24 * 3600 * 1000);
  const { ctx, 요청 } = 엔진로드({ 상담AI_IG토큰만료시각: 먼만료 });
  const 결과 = ctx.상담AI_IG토큰수명점검_();
  assert.equal(결과.ok, true);
  assert.equal(결과.skip, 'not-due');
  assert.equal(요청.length, 0);
});

test('Instagram 토큰 갱신 실패는 기존 토큰을 보존하고 값 없이 경고한다', () => {
  const 실패 = () => ({ getResponseCode: () => 400, getContentText: () => '{"error":"invalid"}' });
  const { ctx, 메일, props } = 엔진로드({
    상담AI_IG토큰만료시각: '0',
    상담AI_IG토큰발급시각: String(Date.now() - 25 * 3600 * 1000),
  }, 실패);
  assert.equal(ctx.상담AI_IG토큰수명점검_().ok, false);
  assert.equal(props.상담AI_IG토큰, 'ig-token');
  assert.equal(메일.length, 1);
  assert.doesNotMatch(메일[0].join('\n'), /ig-token/);
});

test('Instagram 토큰 갱신 예외문에 토큰이 섞여도 메일과 반환값으로 내보내지 않는다', () => {
  const 예외 = () => { throw new Error('request failed: https://graph.instagram.com/?access_token=ig-token'); };
  const { ctx, 메일, props } = 엔진로드({
    상담AI_IG토큰만료시각: '0',
    상담AI_IG토큰발급시각: String(Date.now() - 25 * 3600 * 1000),
  }, 예외);
  const 결과 = ctx.상담AI_IG토큰수명점검_();
  assert.equal(결과.ok, false);
  assert.equal(props.상담AI_IG토큰, 'ig-token');
  assert.equal(메일.length, 1);
  assert.doesNotMatch(JSON.stringify({ 결과, 메일 }), /ig-token|access_token/);
});

test('Instagram 계정 잠금 뒤 전용 토큰이 없으면 점검 경고를 반환한다', () => {
  const { ctx } = 엔진로드({ 상담AI_IG계정ID: 'ig-business', 상담AI_IG토큰: '' });
  const props = ctx.PropertiesService.getScriptProperties();
  assert.match(ctx.상담AI_연결경고_(props).join('\n'), /상담AI_IG토큰 없음/);
});

test('아침 배치에 Instagram 토큰 수명 점검이 연결돼 있다', () => {
  const setup = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const morning = setup.slice(setup.indexOf('function morningJobs()'), setup.indexOf('function nightJobs()'));
  assert.match(morning, /safeRun\('상담AI_IG토큰수명',\s*상담AI_IG토큰수명점검_\)/);
});

test('공개 저장소 문서에 실제 웹훅 비밀값이나 폐기 권한명이 남지 않는다', () => {
  const files = ['docs/상담AI_개통_지금할일.md', 'docs/상담AI_설치_v1.md', 'docs/DM상담_자동화_로드맵.md'];
  const docs = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  assert.doesNotMatch(docs, /synk-sabtbx-|synk-verify-aeuid9fu/);
  assert.doesNotMatch(docs, /\binstagram_manage_messages\b/);
  assert.match(docs, /instagram_business_basic/);
  assert.match(docs, /instagram_business_manage_messages/);
});

test('상담 답장과 만족도 다이제스트가 같은 Graph API 버전을 쓴다', () => {
  const 상담 = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const 만족도 = fs.readFileSync(path.join(ROOT, '만족도팩.js'), 'utf8');
  assert.match(상담, /상담AI_META_API_VERSION\s*=\s*'v26\.0'/);
  assert.match(만족도, /graph\.facebook\.com\/'\s*\+\s*apiVersion/);
  assert.match(만족도, /typeof 상담AI_META_API_VERSION === 'undefined'/);
  assert.doesNotMatch(상담 + '\n' + 만족도, /graph\.facebook\.com\/v21\.0/);
});
