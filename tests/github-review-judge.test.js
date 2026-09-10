'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tally } = require('../tools/lib/github-review-judge.js');
const sha = 'a'.repeat(40), old = 'b'.repeat(40);
const row = (overrides = {}) => ({ id: 1, user: { type: 'Bot', login: 'claude[bot]' },
  body: `[review-claude]\n합의표식: P0=0 P1=0\n검수커밋: ${sha}\n검수완료: true`,
  created_at: '2026-09-11T00:00:00Z', ...overrides });
test('새 head에 과거 clean·critical 코멘트가 있어도 완료 검수 전에는 pending이다', () => {
  for (const counts of ['P0=0 P1=0', 'P0=1 P1=3']) {
    const r = row({ body: `합의표식: ${counts}\n검수커밋: ${old}\n검수완료: true` });
    assert.equal(tally({ headSha: sha, comments: [r] }).state, 'pending');
  }
});
test('SHA 없는 옛 요약·미완료·스푸핑 봇·다른 review commit은 세지 않는다', () => {
  for (const r of [row({ body: 'P0 없음, critical 없음' }), row({ body: row().body.replace('true', 'false') }),
    row({ user: { type: 'Bot', login: 'attacker-claude[bot]' } }), row({ commit_id: old }),
    row({ state: 'DISMISSED' })]) assert.equal(tally({ headSha: sha, comments: [r] }).state, 'pending');
});
test('같은 커밋의 최신 완료 총평이 이전 지적과 중복 댓글을 대체한다', () => {
  const bad = row({ body: row().body.replace('P0=0', 'P0=1') });
  assert.equal(tally({ headSha: sha, comments: [bad] }).state, 'failure');
  const fixed = row({ id: 2, created_at: '2026-09-11T00:01:00Z' });
  const result = tally({ headSha: sha, comments: [fixed, bad, bad] });
  assert.equal(result.state, 'success'); assert.equal(result.responses.length, 1);
});
test('현재 여러 벤더 완료 검수는 기존 min(2, 응답수) 문턱을 지킨다', () => {
  const bad = row({ body: row().body.replace('P1=0', 'P1=1') });
  const second = row({ user: { type: 'Bot', login: 'chatgpt-codex-connector[bot]' } });
  assert.equal(tally({ headSha: sha, comments: [bad, second] }).state, 'success');
  assert.equal(tally({ headSha: sha, comments: [bad, { ...second, body: bad.body }] }).state, 'failure');
});
