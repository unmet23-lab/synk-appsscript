'use strict';
// 샤오훙수 소유자 화면 읽기(readRednote). 11-23 계정 이름이 기본 「小红薯…」에서 바뀐 뒤 모든 회차가 need_owner로 끝났다.
// 이름은 관리 화면 윗줄(.user-info .name-box)에서 읽고, 등록한 이름과 정확히 같을 때만 읽는다.
const test = require('node:test'), assert = require('node:assert/strict');
const { readRednote } = require('../tools/계정통계예약/official-screen.cjs');

const ID = '6ab10807000000000301d12f';
function el({ text = '', attrs = {}, children = {} } = {}) {
  return {
    innerText: text, textContent: text, pathname: attrs.pathname,
    getAttribute: (k) => attrs[k] ?? null,
    querySelector: (sel) => (children[sel] || [])[0] || null,
    querySelectorAll: (sel) => children[sel] || [],
  };
}
function card(n) {
  return el({ text: `note ${n}`, attrs: { 'data-impression': JSON.stringify({ noteTarget: { value: { noteId: `n${n}` } } }) },
    children: { '.note-card__title': [el({ text: `제목 ${n}` })], '.note-card__stat': ['10', '0', '1', '0', '0'].map((t) => el({ text: t })) } });
}
// 화면 둘(공개 프로필 · 관리 화면)을 가짜 document로 바꿔 끼우는 page
function fakePage({ topbarName, bodyName = '', meId = ID, cards = 2 }) {
  const screens = {
    profile: { body: '', all: { 'a[href*="/user/profile/"]': [el({ text: 'Me', attrs: { pathname: `/user/profile/${meId}` } })] }, one: {} },
    creator: {
      body: `创作服务平台 ${bodyName} 发布笔记 全部 ${cards}`,
      all: { '.note-card': Array.from({ length: cards }, (_, i) => card(i + 1)) },
      one: topbarName ? { '.d-topbar .user-info .name-box': el({ text: ` ${topbarName} ` }) } : {},
    },
  };
  let now = screens.profile;
  const install = () => {
    globalThis.document = { body: { innerText: now.body }, querySelector: (s) => now.one[s] || (now.all[s] || [])[0] || null, querySelectorAll: (s) => now.all[s] || [] };
    globalThis.location = { origin: 'https://creator.rednote.com', pathname: '/new/note-manager' };
  };
  install();
  return {
    visited: [],
    async goto(url) { this.visited.push(url); now = /creator\./.test(url) ? screens.creator : screens.profile; install(); },
    snapshot: async () => {}, waitForFunction: async () => {}, mouse: { move: async () => {}, wheel: async () => {} },
    evaluate: async (fn, arg) => fn(arg),
  };
}
test.after(() => { delete globalThis.document; delete globalThis.location; });

test('이름을 바꾼 계정은 관리 화면 윗줄의 이름이 등록한 이름과 같으면 읽는다', async () => {
  const r = await readRednote(fakePage({ topbarName: 'Synk Lab yuho teacher', bodyName: 'Synk Lab yuho teacher' }), {}, { expectedExternalId: ID, observedName: 'Synk Lab yuho teacher' });
  assert.equal(r.reason, undefined);
  assert.equal(r.evidence.accountName, 'Synk Lab yuho teacher');
  assert.equal(r.evidence.rows.length, 2);
  assert.equal(r.evidence.viewerTimeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, '꼬리표 없는 예약 시각을 읽을 브라우저 시간대');
  assert.equal(r.evidence.profileId, ID);
});

test('윗줄 이름이 등록한 이름과 다르면 need_owner로 멈춘다(본문에 같은 글자가 있어도)', async () => {
  const r = await readRednote(fakePage({ topbarName: '다른 계정', bodyName: 'Synk Lab yuho teacher' }), {}, { expectedExternalId: ID, observedName: 'Synk Lab yuho teacher' });
  assert.deepEqual(r, { reason: 'need_owner' });
});

test('윗줄이 없으면 예전처럼 기본 이름 「小红薯…」으로 대조한다', async () => {
  const r = await readRednote(fakePage({ bodyName: '小红薯6AB25DEB' }), {}, { expectedExternalId: ID, observedName: '小红薯6AB25DEB' });
  assert.equal(r.evidence.accountName, '小红薯6AB25DEB');
});

test('「Me」 링크가 등록한 프로필 번호가 아니면 관리 화면을 열기 전에 멈춘다', async () => {
  const page = fakePage({ topbarName: 'Synk Lab yuho teacher', meId: 'ffffffffffffffffffffffff' });
  const r = await readRednote(page, {}, { expectedExternalId: ID, observedName: 'Synk Lab yuho teacher' });
  assert.deepEqual(r, { reason: 'need_owner' });
  assert.deepEqual(page.visited.filter((u) => /creator\./.test(u)), [], '관리 화면을 열지 않는다(GPT GA2)');
});
