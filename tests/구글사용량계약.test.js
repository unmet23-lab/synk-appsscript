'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const 조회 = require('../tools/구글크레딧.js');
const 정책 = require('../tools/모델정책.js');

test('조회 기본 지갑은 명시된 무료 체험 계정이며 다른 계정으로 자동 이동하지 않는다', () => {
  assert.equal(조회.고른지갑([]).프로, 'synk-bake-unmet27');
  assert.equal(조회.고른지갑(['--옛']).이름, '옛');
  assert.throws(() => 조회.고른지갑(['--옛', '--새']), /하나만/);
});
test('출력토큰이 많은 글을 그림으로 세지 않고 모델·시각별 입력/출력/호출을 보존한다', () => {
  const rows = 조회.합치기({
    출력: [{ model: 'gemini-3.8-flash', time: '2026-09-11 01', value: 3000 }, { model: 'gemini-3-pro-image', time: '2026-09-11 01', value: 1500 }],
    입력: [{ model: 'gemini-3.8-flash', time: '2026-09-11 01', value: 30 }],
    호출: [{ model: 'gemini-3.8-flash', time: '2026-09-11 01', value: 1 }],
  });
  assert.equal(rows.length, 2);
  const text = rows.find((r) => r.모델 === 'gemini-3.8-flash');
  assert.deepEqual([text.입력, text.출력, text.호출], [30, 3000, 1]);
  const report = 조회.보고서(조회.지갑들.새, rows, 1, new Date(), { balanceKRW: 123, asOfDate: '2026-09-01' });
  assert.equal(report.실제청구액KRW, null);
  assert.equal(report.현재크레딧KRW, null);
  assert.equal(report.마지막화면확인.현재값아님, true);
  assert.equal(report.합계.출력, 4500);
  assert.equal(조회.보고서(조회.지갑들.새, [], 1, new Date(), null).마지막화면확인, null);
});
test('Monitoring 페이지를 모두 읽고 모델 라벨 없는 값도 미확인으로 보존한다', async (t) => {
  const ts = (model, n) => ({ resource: { labels: model ? { model_user_id: model } : {} },
    points: [{ interval: { endTime: '2026-09-10T16:00:00Z' }, value: { int64Value: String(n) } }] });
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    const q = new URL(url).searchParams;
    assert.equal(q.get('aggregation.groupByFields'), 'resource.labels.model_user_id');
    return { ok: true, status: 200, json: async () => q.has('pageToken')
      ? { timeSeries: [ts(null, 2)] } : { timeSeries: [ts('text-model', 3)], nextPageToken: 'page-2' } };
  });
  const rows = await 조회.시계열({}, 'test-project', 'metric', 3600);
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(rows.map((r) => [r.model, r.value]), [['text-model', 3], ['(모델 미확인)', 2]]);
});
test('Monitoring 부분 오류는 비용 0으로 보고하지 않고 실패한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    json: async () => ({ executionErrors: [{ code: 13 }] }) }));
  await assert.rejects(() => 조회.시계열({}, 'test', 'metric', 3600), /조회 불완전/);
});
test('Vertex 자격은 과금 프로젝트가 맞아야 하며 계정/프로젝트/회전마다 캐시가 다르다', () => {
  const j = { 프로젝트: 'credit-project', client_id: 'synthetic-client', client_secret: 'synthetic-secret', refresh_token: 'synthetic-refresh' };
  assert.equal(정책.벌텍스자격확인(j, 'credit-project'), j);
  assert.throws(() => 정책.벌텍스자격확인(j, 'paid-project'), /프로젝트가 다르다/);
  const identity = 정책.벌텍스캐시식별자('synthetic.json', 'credit-project', j);
  assert.notEqual(identity, 정책.벌텍스캐시식별자('synthetic.json', 'paid-project', j));
  assert.notEqual(identity, 정책.벌텍스캐시식별자('synthetic.json', 'credit-project', { ...j, refresh_token: 'rotated' }));
  assert.notEqual(identity, 정책.벌텍스캐시식별자('other.json', 'credit-project', j));
});
test('폐기한 계정 이동 명령은 자격 파일을 만지기 전에 멈춘다', async () => {
  await assert.rejects(() => require('../tools/굽기계정.js').main(['--옛']), /자격을 이동하지 않았다/);
});
test('명시 자격이 없으면 살아 있는 다른 계정 캐시가 있어도 읽거나 전송하지 않는다', async (t) => {
  const fs = require('node:fs');
  t.mock.method(fs, 'existsSync', () => false);
  const read = t.mock.method(fs, 'readFileSync', () => { throw new Error('다른 자격/캐시 읽기 금지'); });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('전송 금지'); });
  await assert.rejects(() => 정책.벌텍스토큰(), /구글 로그인을|구글 로그인|못 찾았다/);
  assert.equal(read.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
});
