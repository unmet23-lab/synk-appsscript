'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

function 엔진로드(속성) {
  const 요청 = [];
  const 기록 = [];
  const props = Object.assign({
    상담AI_페이지토큰: 'page-token',
    상담AI_IG토큰: 'ig-token',
  }, 속성 || {});
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || '' }) },
    UrlFetchApp: { fetch: (url, options) => {
      요청.push({ url, options });
      return { getResponseCode: () => 200, getContentText: () => '{}' };
    } },
    SpreadsheetApp: {}, Utilities: {}, Logger: { log: () => {} }, ContentService: {},
    CacheService: {}, MailApp: {}, console,
  };
  vm.createContext(ctx);
  new vm.Script(fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8'), { filename: '상담AI.js' }).runInContext(ctx);
  ctx.상담_기록_ = (...args) => 기록.push(args);
  ctx.상담_메시지조립_ = (text) => ({ text });
  ctx.adminMail = () => {};
  return { ctx, 요청, 기록 };
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

test('공개 저장소 문서에 실제 웹훅 비밀값이나 폐기 권한명이 남지 않는다', () => {
  const files = ['docs/상담AI_개통_지금할일.md', 'docs/상담AI_설치_v1.md', 'docs/DM상담_자동화_로드맵.md'];
  const docs = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  assert.doesNotMatch(docs, /synk-sabtbx-|synk-verify-aeuid9fu/);
  assert.doesNotMatch(docs, /\binstagram_manage_messages\b/);
});

test('상담 답장과 만족도 다이제스트가 같은 Graph API 버전을 쓴다', () => {
  const 상담 = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const 만족도 = fs.readFileSync(path.join(ROOT, '만족도팩.js'), 'utf8');
  assert.match(상담, /상담AI_META_API_VERSION\s*=\s*'v26\.0'/);
  assert.match(만족도, /graph\.facebook\.com\/'\s*\+\s*apiVersion/);
  assert.match(만족도, /typeof 상담AI_META_API_VERSION === 'undefined'/);
  assert.doesNotMatch(상담 + '\n' + 만족도, /graph\.facebook\.com\/v21\.0/);
});
