'use strict';
// 늦게 찾은 공모 재기 시험(2026-11-20, 유호님 「다섯 개 다 해」 가운데 다섯째).
const test = require('node:test');
const assert = require('node:assert');
const 늦음 = require('../tools/공모늦음.js');
const { 열쇠 } = require('../tools/lib/contest-eligibility.cjs');

test('찾은 날은 그록 첫 회차, id 날짜, discovered 칸 차례로 읽는다', () => {
  assert.strictEqual(늦음.찾은날({ id: 'grok-contest:abc', grok_first_seen: '2026-11-19' }), '2026-11-19');
  assert.strictEqual(늦음.찾은날({ id: 'claude-20261019:c0097' }), '2026-10-19');
  assert.strictEqual(늦음.찾은날({ id: 'raw:lk:1', discovered_20261110: {} }), '2026-11-10');
  assert.strictEqual(늦음.찾은날({ id: 'raw:lk:347984' }), '');
});

test('마감 7일 안쪽에 찾았거나 접수 시작 21일 뒤에 찾은 공고만 낸다', () => {
  const 통합 = { items: [
    { id: 'claude-20261019:c0001', title: '첫 수집 날 찾은 영상 공모', ai_video: { value: 'AI 영상' }, calendar_20261110: { end: '2026-10-20' } },
    { id: 'grok-contest:a', title: '응답하라 제천 AI영상 공모전', grok_first_seen: '2026-11-19', grok_contest: { video: true, officialUrl: 'https://www.jccf.or.kr/bbs/board.php?wr_id=669' } },
    { id: 'claude-20261027:d07', title: '매경 AI 광고 공모전', ai_video: { value: 'AI 영상' }, calendar_20261110: { end: '2026-11-30' } },
    { id: 'codex-20261104:x1', title: '창업 해커톤', ai_video: { value: '기타' }, calendar_20261110: { end: '2026-11-05' } },
  ] };
  const 판정 = { schema: 'synk-contest-eligibility-v1', items: {
    [열쇠('응답하라 제천 AI영상 공모전')]: { title: '응답하라 제천 AI영상 공모전', status: '안 됨', 공고: { 마감: '2026-11-20', 접수시작: '2026-09-28' } },
  } };
  const xs = 늦음.늦음재기(통합, 판정);
  assert.deepStrictEqual(xs.map(x => [x.공식사이트, x.남은날, x.지난날]), [['jccf.or.kr', 1, 52]]);
  assert.deepStrictEqual(xs[0].까닭, ['찾았을 때 마감까지 1일', '접수 시작 52일 뒤에 찾음']);
});
