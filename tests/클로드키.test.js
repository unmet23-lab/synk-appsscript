'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 클로드 = require('../tools/lib/클로드키.js');

// 가짜 키만 쓴다. 실제 보안 폴더·네트워크는 건드리지 않는다.
function 방만들기(키들) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-claude-keys-'));
  const 목록 = { 키: [] };
  for (const [이름, 갱신일, 값, 덧붙임 = {}] of 키들) {
    const 파일 = `${이름}.txt`;
    if (값 !== null) fs.writeFileSync(path.join(방, 파일), 값 + '\r\n');
    // 한도를 건 키는 「한도키」 배열에 둔다(옛 판이 못 보게).
    (덧붙임.한도USD != null ? (목록.한도키 ||= []) : 목록.키).push({ 이름, 키파일: 파일, 갱신일, ...덧붙임 });
  }
  fs.writeFileSync(path.join(방, '목록.json'), JSON.stringify(목록));
  return {
    방,
    옵션: { 목록경로: path.join(방, '목록.json'), 상태경로: path.join(방, '상태.json'), 기록경로: path.join(방, '기록.jsonl') },
    지우기: () => fs.rmSync(방, { recursive: true, force: true }),
  };
}

function 가짜서버(규칙) {
  const 받은키 = [];
  const fetch = async (url, init) => {
    const 키 = init.headers['x-api-key'];
    받은키.push(키);
    const [status, body] = 규칙(키, JSON.parse(init.body));
    if (status === 'throw') throw new Error(`socket hang up ${키}`);
    return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) };
  };
  return { fetch, 받은키 };
}

const 성공 = (model) => [200, { model, type: 'message', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1000, output_tokens: 100 } }];
const 소진 = [400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } }];
const 본문 = { model: 'claude-opus-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] };
const 지금 = new Date(2026, 9, 17, 12, 0, 0); // 10월 17일 정오(이 PC 시간대)

test('다음 갱신일은 기준 뒤의 첫 결제일이고 짧은 달은 말일로 당긴다', () => {
  assert.equal(+클로드.다음갱신(20, 지금), +new Date(2026, 9, 20));
  assert.equal(+클로드.다음갱신(5, 지금), +new Date(2026, 10, 5));
  assert.equal(+클로드.다음갱신(31, new Date(2026, 10, 2)), +new Date(2026, 10, 30));
  assert.equal(+클로드.다음갱신(17, 지금), +new Date(2026, 10, 17)); // 당일 0시는 이미 지남
  assert.equal(클로드.다음갱신(null, 지금), null);
});

test('곧 사라질 크레딧(가까운 갱신일) 키부터 쓰고, 갱신일 모르는 키는 뒤로 간다', async () => {
  const t = 방만들기([['늦음', 5, 'sk-ant-test-late'], ['모름', null, 'sk-ant-test-null'], ['가까움', 20, 'sk-ant-test-soon']]);
  try {
    const 서버 = 가짜서버(() => 성공('claude-opus-5-5'));
    const r = await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금, 용도: '시험' });
    assert.equal(r.키이름, '가까움');
    assert.deepEqual(서버.받은키, ['sk-ant-test-soon']);
    assert.deepEqual(클로드.상태보기({ ...t.옵션, 지금 }).map((k) => [k.이름, k.쓰는순서]), [['늦음', 2], ['모름', 3], ['가까움', 1]]);
  } finally { t.지우기(); }
});

test('크레딧이 바닥난 키는 다음 갱신일까지 표시하고 같은 요청을 다음 키로 보낸다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const 서버 = 가짜서버((키) => (키.endsWith('aaaa') ? 소진 : 성공('claude-opus-5-5')));
    const r = await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 });
    assert.equal(r.키이름, 'B');
    assert.deepEqual(r.건너뛴키, [{ 이름: 'A', 이유: '크레딧소진' }]);
    const 상태 = JSON.parse(fs.readFileSync(t.옵션.상태경로, 'utf8'));
    assert.equal(상태.A.상태, '소진');
    assert.equal(+new Date(상태.A.풀림), +new Date(2026, 9, 20));

    // 다음 호출은 A를 건너뛰고 바로 B로 간다.
    서버.받은키.length = 0;
    await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 });
    assert.deepEqual(서버.받은키, ['sk-ant-test-bbbb']);

    // A의 갱신일이 지나면 다시 후보가 된다. 10-21에는 A의 다음 갱신(11-20)보다 B(10-25)가 가까워 B가 먼저다.
    const 갱신뒤 = new Date(2026, 9, 21);
    assert.deepEqual(클로드.상태보기({ ...t.옵션, 지금: 갱신뒤 }).map((k) => [k.이름, k.상태, k.쓰는순서]),
      [['A', '사용가능(재확인)', 2], ['B', '사용가능', 1]]);
    const 둘다소진 = 가짜서버(() => 소진);
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 둘다소진.fetch, 지금: 갱신뒤 }), { code: '클로드키_모두소진' });
    assert.deepEqual(둘다소진.받은키, ['sk-ant-test-bbbb', 'sk-ant-test-aaaa']);
  } finally { t.지우기(); }
});

test('갱신일을 모르는 키가 소진되면 하루 뒤 다시 확인한다', async () => {
  const t = 방만들기([['모름', null, 'sk-ant-test-null'], ['B', 25, 'sk-ant-test-bbbb']]);
  try {
    // 갱신일 아는 B가 먼저 쓰이니 둘 다 소진시켜 모름 키까지 가게 한다.
    const 둘다소진 = 가짜서버(() => 소진);
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 둘다소진.fetch, 지금 }), { code: '클로드키_모두소진' });
    assert.deepEqual(둘다소진.받은키, ['sk-ant-test-bbbb', 'sk-ant-test-null']);
    const 상태 = JSON.parse(fs.readFileSync(t.옵션.상태경로, 'utf8'));
    assert.equal(+new Date(상태.모름.풀림), +지금 + 24 * 60 * 60 * 1000);
  } finally { t.지우기(); }
});

test('429·5xx는 다른 키로 넘기지 않고(속도 제한 우회 금지) 멈춘다', async () => {
  for (const status of [429, 500, 529]) {
    const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 25, 'sk-ant-test-bbbb']]);
    try {
      const 서버 = 가짜서버(() => [status, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }]);
      await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 }), (e) => e.code === '클로드키_요청실패' && e.http === status && e.키이름 === 'A');
      assert.equal(서버.받은키.length, 1);
      assert.equal(fs.existsSync(t.옵션.상태경로), false);
    } finally { t.지우기(); }
  }
});

test('응답을 못 받으면 청구됐을 수 있어 다른 키로 넘기지 않고, 오류에 키 값이 남지 않는다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const 서버 = 가짜서버(() => ['throw']);
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 }), (e) => {
      assert.equal(e.code, '클로드키_결과모름');
      assert.equal(e.청구모름, true);
      assert.equal(e.message.includes('sk-ant-test'), false);
      return true;
    });
    assert.equal(서버.받은키.length, 1);
  } finally { t.지우기(); }
});

test('401 키는 키오류로 표시해 다시 쓰지 않고, 키파일이 없으면 건너뛴다', async () => {
  const t = 방만들기([['폐기됨', 18, 'sk-ant-test-dead'], ['파일없음', 19, null], ['정상', 25, 'sk-ant-test-good']]);
  try {
    const 서버 = 가짜서버((키) => (키.endsWith('dead') ? [401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }] : 성공('claude-opus-5-5')));
    const r = await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 });
    assert.equal(r.키이름, '정상');
    assert.deepEqual(r.건너뛴키.map((k) => k.이유), ['키오류', '키파일없음']);
    const 다음달 = new Date(2026, 11, 1);
    서버.받은키.length = 0;
    await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금: 다음달 });
    assert.deepEqual(서버.받은키, ['sk-ant-test-good']);
    assert.equal(클로드.풀기('폐기됨', t.옵션), true);
    assert.equal(클로드.풀기('폐기됨', t.옵션), false);
  } finally { t.지우기(); }
});

test('사용 기록에는 키 이름·토큰·추정 비용만 남고 키 값은 어디에도 쓰지 않는다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 25, 'sk-ant-test-bbbb']]);
  try {
    const 서버 = 가짜서버((키) => (키.endsWith('aaaa') ? 소진 : 성공('claude-opus-5-5')));
    await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금, 용도: '시험' });
    const 기록 = fs.readFileSync(t.옵션.기록경로, 'utf8').trim().split('\n').map((줄) => JSON.parse(줄));
    assert.equal(기록.length, 1);
    assert.equal(기록[0].키이름, 'B');
    assert.equal(기록[0].용도, '시험');
    assert.equal(기록[0].추정USD, (1000 * 4 + 100 * 20) / 1e6);
    for (const 파일 of [t.옵션.기록경로, t.옵션.상태경로]) assert.equal(fs.readFileSync(파일, 'utf8').includes('sk-ant-test'), false);
    const 표 = 클로드.상태보기({ ...t.옵션, 지금 });
    assert.deepEqual(표.map((k) => [k.이름, k.상태.startsWith('소진'), k.이번주기호출]), [['A', true, 0], ['B', false, 1]]);
  } finally { t.지우기(); }
});

test('시험 중에는 경로를 다 넘기지 않으면 실제 키 폴더를 읽지 않고 멈춘다', async () => {
  assert.ok(process.env.NODE_TEST_CONTEXT);
  await assert.rejects(클로드.보내기(본문, {}), /실제 키 폴더 차단/);
  assert.throws(() => 클로드.상태보기(), /실제 키 폴더 차단/);
});

test('빈 키 목록은 오류가 아니라 「키 없음」이다 — 고르기는 null, 보내기는 호출 없이 멈춘다', async () => {
  const t = 방만들기([]);
  try {
    const 안됨 = async () => { throw new Error('호출되면 안 됨'); };
    assert.deepEqual(await 클로드.키고르기({ ...t.옵션, fetch: 안됨, 지금 }), { 이름: null, 값: null, 건너뛴키: [], 뺀키: [] });
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 안됨, 지금 }), /목록에 키 없음/);
    assert.deepEqual(클로드.상태보기({ ...t.옵션, 지금 }), []);
  } finally { t.지우기(); }
});

test('키 목록 오류는 호출 전에 막는다', async () => {
  const t = 방만들기([['A', 32, 'sk-ant-test-aaaa']]);
  try {
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: async () => { throw new Error('호출되면 안 됨'); }, 지금 }), /갱신일은 1~31/);
  } finally { t.지우기(); }
});

test('키고르기: 곧 사라질 크레딧 키부터 1토큰 확인 요청으로 고르고, 바닥난 키·401은 표시하고 넘긴다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa'], ['B', 22, 'sk-ant-test-bbbb'], ['C', 25, 'sk-ant-test-cccc'], ['D', 28, 'sk-ant-test-dddd']]);
  try {
    const 받은 = [];
    const fetch = async (url, init) => {
      const 키 = init.headers['x-api-key']; const body = JSON.parse(init.body); 받은.push([키, body.model, body.max_tokens]);
      if (키.endsWith('aaaa')) return { status: 400, ok: false, text: async () => JSON.stringify(소진[1]) };
      if (키.endsWith('bbbb')) return { status: 401, ok: false, text: async () => JSON.stringify({ error: { type: 'authentication_error', message: 'invalid' } }) };
      if (키.endsWith('cccc')) throw new Error('socket hang up sk-ant-test-cccc');
      return { status: 200, ok: true, text: async () => JSON.stringify({ usage: { input_tokens: 8, output_tokens: 1 } }) };
    };
    const r = await 클로드.키고르기({ ...t.옵션, fetch, 지금, 용도: '시험' });
    assert.equal(r.이름, 'D');
    assert.equal(r.값, 'sk-ant-test-dddd');
    assert.deepEqual(r.건너뛴키.map((k) => [k.이름, k.이유.split('(')[0]]), [['A', '크레딧소진'], ['B', '키오류'], ['C', '확인실패']]);
    assert.equal(r.건너뛴키[2].이유.includes('sk-ant-test'), false);
    assert.deepEqual(받은.map((x) => x[1]), Array(4).fill('claude-haiku-5-5'));
    assert.deepEqual(받은.map((x) => x[2]), [1, 1, 1, 1]);
    const 상태 = JSON.parse(fs.readFileSync(t.옵션.상태경로, 'utf8'));
    assert.equal(상태.A.상태, '소진'); assert.equal(상태.B.상태, '키오류'); assert.equal(상태.C, undefined);
    const 기록 = fs.readFileSync(t.옵션.기록경로, 'utf8');
    assert.match(기록, /"키이름":"D","용도":"키확인:시험"/);
    assert.equal(기록.includes('sk-ant-test'), false);

    const 없음 = await 클로드.키고르기({ ...t.옵션, fetch: async () => { throw new Error('down'); }, 지금 });
    assert.equal(없음.이름, null); assert.equal(없음.값, null);
  } finally { t.지우기(); }
});

test('소진표시·기록남기기: 다른 프로그램이 쓴 키를 표시하고 비용을 같은 기록에 남긴다(키 값 없이)', () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    assert.equal(클로드.소진표시('A', { ...t.옵션, 지금 }), true);
    assert.equal(클로드.소진표시('없는키', { ...t.옵션, 지금 }), false);
    const 상태 = JSON.parse(fs.readFileSync(t.옵션.상태경로, 'utf8'));
    assert.equal(+new Date(상태.A.풀림), +new Date(2026, 9, 20));
    클로드.기록남기기({ 키이름: 'A', 용도: '팁적용안', 경로: '크레딧', model: 'claude-opus-5-5', 추정USD: 1.25 }, { ...t.옵션, 지금 });
    const 표 = 클로드.상태보기({ ...t.옵션, 지금 });
    assert.equal(표[0].이번주기호출, 1);
    assert.equal(표[0].이번주기추정USD, 1.25);
    // 소진 표시가 있어도 이름으로는 읽힌다(이미 만든 클라우드 세션을 그 조직 키로 다시 볼 때).
    assert.deepEqual(클로드.키읽기('A', t.옵션), { 이름: 'A', 값: 'sk-ant-test-aaaa' });
    assert.deepEqual(클로드.키읽기('없는키', t.옵션), { 이름: null, 값: null });
  } finally { t.지우기(); }
});

test('추정 비용은 캐시 쓰기(5분 1.25배·1시간 2배)·읽기(Opus 5.5 0.05배)와 일괄 반값을 셈한다', () => {
  const usage = { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 2000, cache_read_input_tokens: 10000,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 2000 } };
  const 보통 = ((1000 + 2000 * 2 + 10000 * 0.05) * 4 + 100 * 20) / 1e6;
  assert.ok(Math.abs(클로드.추정USD('claude-opus-5-5', usage) - 보통) < 1e-12);
  assert.ok(Math.abs(클로드.추정USD('claude-opus-5-5', usage, { 배치: true }) - 보통 / 2) < 1e-12);
  // 쓰기 내역이 없으면 5분 쓰기로 본다, 다른 모델의 읽기는 0.1배.
  const 간단 = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 400, cache_read_input_tokens: 1000 };
  assert.ok(Math.abs(클로드.추정USD('claude-sonnet-5-5', 간단) - ((400 * 1.25 + 1000 * 0.1) * 2) / 1e6) < 1e-12);
});

function 일괄서버({ 끝남 = true, 모델 = 'claude-opus-5-5' } = {}) {
  const 요청 = [];
  const fetch = async (url, init) => {
    요청.push({ url, method: init.method, 키: init.headers['x-api-key'], body: init.body ? JSON.parse(init.body) : null });
    const 답 = (status, body, raw) => ({ status, ok: status >= 200 && status < 300, text: async () => raw ?? JSON.stringify(body) });
    if (url.endsWith('/v1/messages')) return 답(200, { type: 'message', content: [], usage: { input_tokens: 8, output_tokens: 1 } });
    if (url.endsWith('/v1/messages/batches') && init.method === 'POST') return 답(200, { id: 'msgbatch_test1', processing_status: 'in_progress' });
    if (url.endsWith('/msgbatch_test1')) return 답(200, { id: 'msgbatch_test1', processing_status: 끝남 ? 'ended' : 'in_progress',
      results_url: 'https://api.anthropic.com/v1/messages/batches/msgbatch_test1/results' });
    if (url.endsWith('/msgbatch_test1/results')) {
      const 줄 = [
        { custom_id: 'b', result: { type: 'succeeded', message: { model: 모델, content: [{ type: 'text', text: '{}' }],
          usage: { input_tokens: 500, output_tokens: 1000, cache_read_input_tokens: 6000, cache_creation_input_tokens: 0 } } } },
        { custom_id: 'a', result: { type: 'succeeded', message: { model: 모델, content: [{ type: 'text', text: '{}' }],
          usage: { input_tokens: 500, output_tokens: 800, cache_creation_input_tokens: 6000, cache_read_input_tokens: 0,
            cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 6000 } } } } },
        { custom_id: 'c', result: { type: 'errored', error: { type: 'invalid_request_error' } } },
      ];
      return 답(200, null, 줄.map((x) => JSON.stringify(x)).join('\n') + '\n');
    }
    return 답(404, { error: { message: 'not found' } });
  };
  return { fetch, 요청 };
}

test('일괄: 크레딧 남은 키를 1토큰으로 고른 뒤 만들고, 결과는 같은 키로 받아 한 줄 반값 기록을 남긴다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    const 서버 = 일괄서버();
    const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } },
      { custom_id: 'b', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'y' }] } }];
    await assert.rejects(클로드.배치보내기([{ custom_id: 'a', params: 요청들[0].params }, { custom_id: 'a', params: 요청들[1].params }], { ...t.옵션, fetch: 서버.fetch, 지금 }), /중복/);
    const 만듦 = await 클로드.배치보내기(요청들, { ...t.옵션, fetch: 서버.fetch, 지금, 용도: 'topik-review:시험' });
    assert.deepEqual([만듦.배치id, 만듦.키이름], ['msgbatch_test1', 'A']);
    const 보낸일괄 = 서버.요청.find((r) => r.url.endsWith('/batches') && r.method === 'POST');
    assert.deepEqual(보낸일괄.body.requests.map((r) => r.custom_id), ['a', 'b']);
    const { 결과, 합계 } = await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch: 서버.fetch, 지금, 용도: 'topik-review:시험' });
    assert.deepEqual(결과.map((r) => r.custom_id), ['b', 'a', 'c']);
    assert.equal(합계.성공, 2);
    const 기대 = (((500 + 6000 * 0.05) * 4 + 1000 * 20) / 1e6 + ((500 + 6000 * 2) * 4 + 800 * 20) / 1e6) / 2;
    assert.ok(Math.abs(합계.추정USD - 기대) < 1e-6);
    const 기록 = fs.readFileSync(t.옵션.기록경로, 'utf8').trim().split('\n').map((줄) => JSON.parse(줄));
    assert.deepEqual(기록.map((r) => [r.용도, r.배치 || null]), [['키확인:topik-review:시험', null], ['topik-review:시험', 'msgbatch_test1'], ['topik-review:시험', 'msgbatch_test1']]);
    assert.equal(fs.readFileSync(t.옵션.기록경로, 'utf8').includes('sk-ant-test'), false);
  } finally { t.지우기(); }
});

test('일괄: 끝나지 않은 일괄의 결과는 받지 않고, 목록에 없는 키 이름은 거절한다', async () => {
  const t = 방만들기([['A', 20, 'sk-ant-test-aaaa']]);
  try {
    const 서버 = 일괄서버({ 끝남: false });
    await assert.rejects(클로드.배치결과('msgbatch_test1', 'A', { ...t.옵션, fetch: 서버.fetch, 지금 }), (e) => e.code === '클로드키_배치진행중');
    await assert.rejects(클로드.배치보기('msgbatch_test1', '없는키', { ...t.옵션, fetch: 서버.fetch, 지금 }), (e) => e.code === '클로드키_키없음');
  } finally { t.지우기(); }
});

test('만료일이 있는 키는 그날까지 먼저 쓰고(곧 끝나는 크레딧부터), 다음 날 0시부터 뺀다', async () => {
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-10-17' }]]);
  try {
    const 서버 = 가짜서버(() => 성공('claude-opus-5-5'));
    assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 })).키이름, '프로모');
    const 다음날 = new Date(2026, 9, 18, 0, 0, 0);
    assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금: 다음날 })).키이름, '예비');
    assert.deepEqual(클로드.상태보기({ ...t.옵션, 지금: 다음날 }).map((k) => [k.이름, k.상태, k.만료일, k.쓰는순서]),
      [['예비', '사용가능', null, 1], ['프로모', '만료', '2026-10-17', null]]);
  } finally { t.지우기(); }
});

// 응답 토큰이 요청의 위 어림을 넘지 않는 서버 — 입력은 받은 JSON 바이트 수, 출력은 max_tokens 그대로(최악의 청구).
const 정직한서버 = () => 가짜서버((키, body) => [200, { model: body.model, type: 'message', content: [],
  usage: { input_tokens: Buffer.byteLength(JSON.stringify(body), 'utf8'), output_tokens: body.max_tokens } }]);
function 누적(t, 이름, 한도시작 = null) {
  const 기록 = fs.existsSync(t.옵션.기록경로) ? fs.readFileSync(t.옵션.기록경로, 'utf8').split('\n').filter(Boolean).map((줄) => JSON.parse(줄)) : [];
  return 클로드.누적USD({ 이름, 한도시작 }, 기록);
}

test('한도 키는 위 어림이 남은 몫에 들어갈 때만 쓴다 — 응답이 요청보다 크지 않으면 누적은 한도를 넘지 않는다', async () => {
  const 한도 = 0.01, 시작 = '2026-10-17T00:00:00+09:00';
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 한도, 한도시작: 시작 }]]);
  try {
    // 한도시작 앞의 쓰임은 세지 않는다.
    클로드.기록남기기({ 키이름: '프로모', model: 'claude-opus-5-5', 추정USD: 5 }, { ...t.옵션, 지금: new Date(2026, 9, 16, 12) });
    const 서버 = 정직한서버();
    const 어림 = 클로드.요청어림USD(본문);
    let 프로모 = 0;
    for (let i = 0; i < 40; i++) {
      if ((await 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 })).키이름 === '프로모') 프로모 += 1;
      assert.ok(누적(t, '프로모', new Date(시작)) <= 한도 + 1e-12);
    }
    // 위 어림만큼 그대로 청구되는 최악의 응답이면, 한도에 들어가는 만큼(⌊한도 ÷ 어림⌋번)만 프로모로 가고 나머지는 예비로 간다.
    assert.equal(프로모, Math.floor(한도 / 어림));
    assert.ok(Math.abs(누적(t, '프로모', new Date(시작)) - 프로모 * 어림) < 1e-9);
    // 한도에 닿은 키밖에 없으면 보내지 않고 까닭을 알린다.
    const 하나 = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 0.01 }]]);
    try {
      클로드.기록남기기({ 키이름: '프로모', 추정USD: 0.01 }, { ...하나.옵션, 지금 });
      await assert.rejects(클로드.보내기(본문, { ...하나.옵션, fetch: 서버.fetch, 지금 }), /프로모:한도/);
    } finally { 하나.지우기(); }
  } finally { t.지우기(); }
});

test('한도를 건 키는 키 값을 다른 프로그램에 넘기는 키고르기에는 내주지 않고, 기록이 남는 일괄에만 쓴다', async () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 안됨 = async () => { throw new Error('호출되면 안 됨'); };
    const 바깥 = await 클로드.키고르기({ ...t.옵션, fetch: 안됨, 지금 });
    assert.deepEqual([바깥.이름, 바깥.값, 바깥.건너뛴키, 바깥.뺀키.map((k) => k.이름)], [null, null, [], ['프로모']]);
    const 서버 = 일괄서버();
    const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } },
      { custom_id: 'b', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'y' }] } }];
    const 만듦 = await 클로드.배치보내기(요청들, { ...t.옵션, fetch: 서버.fetch, 지금, 용도: '시험' });
    assert.equal(만듦.키이름, '프로모');
    // 한도 키에는 확인 요청을 보내지 않는다. 결과를 받기 전에는 만들 때 적은 반값 위 어림을 센다.
    assert.equal(서버.요청.filter((r) => r.url.endsWith('/v1/messages')).length, 0);
    const 어림 = (클로드.요청어림USD(요청들[0].params) + 클로드.요청어림USD(요청들[1].params)) / 2;
    assert.ok(Math.abs(누적(t, '프로모') - 어림) < 1e-9);
    const { 합계 } = await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch: 서버.fetch, 지금, 용도: '시험' });
    // 결과를 받은 뒤에는 어림 대신 실제 추정 비용을 센다.
    assert.ok(Math.abs(누적(t, '프로모') - 합계.추정USD) < 1e-9);
  } finally { t.지우기(); }
});

test('한도 키는 보내기 전에 예약 줄을 남긴다 — 동시에 도는 요청과 응답을 못 받은 요청까지 한도에 든다', async () => {
  const 어림 = 클로드.요청어림USD(본문);
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 어림 * 1.5 }]]);
  try {
    // 두 요청이 함께 돌아도 둘째는 첫째의 예약을 보고 예비로 간다 — 예약이 없으면 둘 다 프로모로 가 한도를 넘는다.
    const 서버 = 정직한서버();
    const 둘 = await Promise.all([클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 }), 클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 })]);
    assert.deepEqual(둘.map((r) => r.키이름), ['프로모', '예비']);
    assert.ok(Math.abs(누적(t, '프로모') - 어림) < 1e-9);
  } finally { t.지우기(); }
  const 끊김 = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 서버 = 가짜서버(() => ['throw']);
    await assert.rejects(클로드.보내기(본문, { ...끊김.옵션, fetch: 서버.fetch, 지금 }), (e) => e.code === '클로드키_결과모름');
    // 응답을 못 받은 요청은 청구됐을 수 있어 예약 어림이 그대로 남는다.
    assert.ok(Math.abs(누적(끊김, '프로모') - 어림) < 1e-9);
  } finally { 끊김.지우기(); }
});

test('한도 키의 누적: 크레딧 부족 거절은 예약을 취소하고, 비용을 모르면 위 어림으로 세며, 같은 일괄 결과는 한 번만 센다', async () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 어림 = 클로드.요청어림USD(본문);
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 가짜서버(() => 소진).fetch, 지금 }), /프로모:크레딧소진/);
    assert.equal(누적(t, '프로모'), 0);
    클로드.풀기('프로모', t.옵션);
    // usage가 없는 응답은 0이 아니라 위 어림으로 센다.
    await 클로드.보내기(본문, { ...t.옵션, fetch: 가짜서버(() => [200, { type: 'message', content: [] }]).fetch, 지금 });
    assert.ok(Math.abs(누적(t, '프로모') - 어림) < 1e-9);
    const 서버 = 일괄서버();
    const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } }];
    const 만듦 = await 클로드.배치보내기(요청들, { ...t.옵션, fetch: 서버.fetch, 지금 });
    const 한번 = (await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch: 서버.fetch, 지금 })).합계.추정USD;
    await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch: 서버.fetch, 지금 });
    assert.ok(Math.abs(누적(t, '프로모') - (어림 + 한번)) < 1e-9);
  } finally { t.지우기(); }
  // 단가를 모르는 모델의 결과는 0으로 세지 않고, 만들 때의 어림보다 작게 세지 않는다.
  const 모름 = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 서버 = 일괄서버({ 모델: 'claude-새모델' });
    const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } }];
    const 만듦 = await 클로드.배치보내기(요청들, { ...모름.옵션, fetch: 서버.fetch, 지금 });
    await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...모름.옵션, fetch: 서버.fetch, 지금 });
    assert.ok(Math.abs(누적(모름, '프로모') - 클로드.요청어림USD(요청들[0].params) / 2) < 1e-9);
  } finally { 모름.지우기(); }
});

test('일괄: 같은 한도 키로 둘이 함께 만들면 둘째는 첫째의 예약을 보고 다음 키로 가고, 크레딧 부족 거절도 다음 키로 간다', async () => {
  const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } }];
  const 어림 = 클로드.요청어림USD(요청들[0].params) / 2;
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 어림 * 1.5 }]]);
  try {
    const 서버 = 일괄서버();
    const 둘 = await Promise.all([클로드.배치보내기(요청들, { ...t.옵션, fetch: 서버.fetch, 지금 }), 클로드.배치보내기(요청들, { ...t.옵션, fetch: 서버.fetch, 지금 })]);
    assert.deepEqual(둘.map((r) => r.키이름), ['프로모', '예비']);
    assert.ok(Math.abs(누적(t, '프로모') - 어림) < 1e-9);
  } finally { t.지우기(); }
  const 바닥 = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 1 }]]);
  try {
    const 바탕 = 일괄서버();
    const fetch = async (url, init) => (url.endsWith('/v1/messages/batches') && init.method === 'POST' && init.headers['x-api-key'].endsWith('pppp')
      ? { status: 400, ok: false, text: async () => JSON.stringify(소진[1]) } : 바탕.fetch(url, init));
    const 만듦 = await 클로드.배치보내기(요청들, { ...바닥.옵션, fetch, 지금 });
    assert.equal(만듦.키이름, '예비');
    assert.equal(누적(바닥, '프로모'), 0);
    assert.equal(JSON.parse(fs.readFileSync(바닥.옵션.상태경로, 'utf8')).프로모.상태, '소진');
  } finally { 바닥.지우기(); }
});

test('일괄 만들기가 5xx·잘린 본문이면 만들어졌을 수 있어 예약을 남기고, 처리 전에 거절된 4xx면 예약을 푼다', async () => {
  const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } }];
  const 어림 = 클로드.요청어림USD(요청들[0].params) / 2;
  for (const [status, 남음] of [[502, true], [200, true], [400, false]]) {
    const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
    try {
      const 바탕 = 일괄서버();
      const fetch = async (url, init) => (url.endsWith('/v1/messages/batches') && init.method === 'POST'
        ? { status, ok: status < 300, text: async () => (status === 200 ? '{"id":' : JSON.stringify({ error: { message: 'bad' } })) }
        : 바탕.fetch(url, init));
      await assert.rejects(클로드.배치보내기(요청들, { ...t.옵션, fetch, 지금 }), (e) => e.code === '클로드키_요청실패');
      assert.ok(Math.abs(누적(t, '프로모') - (남음 ? 어림 : 0)) < 1e-9, `HTTP ${status}`);
    } finally { t.지우기(); }
  }
});

test('일괄 결과에 usage 없는 성공이 섞이면 만든 때의 어림보다 작게 세지 않고, 그림·문서·서버 도구 요청은 어림이 무한이다', async () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 바탕 = 일괄서버();
    const fetch = async (url, init) => (url.endsWith('/msgbatch_test1/results')
      ? { status: 200, ok: true, text: async () => JSON.stringify({ custom_id: 'a', result: { type: 'succeeded', message: { model: 'claude-opus-5-5', content: [] } } }) + '\n' }
      : 바탕.fetch(url, init));
    const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } }];
    const 만듦 = await 클로드.배치보내기(요청들, { ...t.옵션, fetch, 지금 });
    await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch, 지금 });
    assert.ok(Math.abs(누적(t, '프로모') - 클로드.요청어림USD(요청들[0].params) / 2) < 1e-9);
  } finally { t.지우기(); }
  const 기본 = { model: 'claude-opus-5-5', max_tokens: 10 };
  for (const 요청 of [
    { ...기본, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }] }] },
    { ...기본, messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } }] }] },
    { ...기본, messages: [{ role: 'user', content: '찾아 줘' }], tools: [{ type: 'web_search_20260209', name: 'web_search' }] },
  ]) assert.equal(클로드.요청어림USD(요청), Infinity);
  // 직접 정의한 도구는 바이트로 세고 도구 지시 몫 1,000토큰을 더한다.
  const 도구 = { ...기본, messages: [{ role: 'user', content: 'x' }], tools: [{ name: 'f', input_schema: { type: 'object' } }] };
  assert.ok(Math.abs(클로드.요청어림USD(도구) - ((Buffer.byteLength(JSON.stringify(도구)) + 1000) * 4 + 10 * 20) / 1e6) < 1e-12);
});

test('한도에 딱 닿은 키는 상태 표에서도 「한도도달」이고, 만료된 키는 소진 표시가 있어도 「만료」로 보인다', async () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 0.5 }], ['옛것', null, 'sk-ant-test-oooo', { 만료일: '2026-10-01' }]]);
  try {
    클로드.기록남기기({ 키이름: '프로모', 추정USD: 0.5 }, { ...t.옵션, 지금 });
    클로드.소진표시('옛것', { ...t.옵션, 지금 });
    assert.deepEqual(클로드.상태보기({ ...t.옵션, 지금 }).map((k) => [k.이름, k.상태, k.쓰는순서]), [['옛것', '만료', null], ['프로모', '한도도달', null]]);
    const 안됨 = async () => { throw new Error('호출되면 안 됨'); };
    await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 안됨, 지금 }), (e) => e.뺀키.map((k) => k.이름).join() === '옛것,프로모');
  } finally { t.지우기(); }
});

test('위 어림: 한국어도 바이트로 넉넉히 세고, 캐시 쓰기 할증을 붙이며, 가늠할 수 없는 요청은 무한이다', () => {
  const 한국어 = { model: 'claude-opus-5-5', max_tokens: 0, messages: [{ role: 'user', content: '가'.repeat(1000) }] };
  // 한글 1,000자 = 3,000바이트 → 입력 토큰 위 한계는 3,000 이상(글자 수보다 크다).
  assert.ok(클로드.요청어림USD(한국어) >= (3000 * 4) / 1e6);
  const 캐시 = { ...한국어, system: [{ type: 'text', text: '규칙', cache_control: { type: 'ephemeral', ttl: '1h' } }] };
  assert.ok(클로드.요청어림USD(캐시) >= 2 * (3000 * 4) / 1e6);
  for (const 이상 of [{ ...한국어, max_tokens: -1 }, { ...한국어, max_tokens: NaN }, { model: 'claude-opus-5-5', messages: [] },
    { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } }] }] }]) {
    assert.equal(클로드.요청어림USD(이상), Infinity);
  }
});

test('한도 키의 누적: 같은 일괄을 다시 받을 때 빈 결과·일부 결과가 와도 앞서 센 비용을 지우지 않는다', async () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 바탕 = 일괄서버();
    let 빈결과 = false;
    const fetch = async (url, init) => (빈결과 && url.endsWith('/msgbatch_test1/results') ? { status: 200, ok: true, text: async () => '' } : 바탕.fetch(url, init));
    const 요청들 = [{ custom_id: 'a', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } },
      { custom_id: 'b', params: { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'y' }] } }];
    const 만듦 = await 클로드.배치보내기(요청들, { ...t.옵션, fetch, 지금 });
    const 한번 = (await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch, 지금 })).합계.추정USD;
    빈결과 = true;
    await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...t.옵션, fetch, 지금 });
    assert.ok(Math.abs(누적(t, '프로모') - 한번) < 1e-9);
  } finally { t.지우기(); }
  // 처음 받은 결과가 요청 수보다 적으면(일부만) 만든 때의 어림보다 작게 세지 않는다.
  const 일부 = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
  try {
    const 바탕 = 일괄서버();
    const fetch = async (url, init) => (url.endsWith('/msgbatch_test1/results')
      ? { status: 200, ok: true, text: async () => JSON.stringify({ custom_id: 'a', result: { type: 'succeeded', message: { model: 'claude-haiku-5-5', content: [], usage: { input_tokens: 1, output_tokens: 1 } } } }) + '\n' }
      : 바탕.fetch(url, init));
    const 요청들 = ['a', 'b', 'c'].map((id) => ({ custom_id: id, params: { model: 'claude-opus-5-5', max_tokens: 1000, messages: [{ role: 'user', content: id }] } }));
    const 만듦 = await 클로드.배치보내기(요청들, { ...일부.옵션, fetch, 지금 });
    await 클로드.배치결과(만듦.배치id, 만듦.키이름, { ...일부.옵션, fetch, 지금 });
    const 만든어림 = 요청들.reduce((합, r) => 합 + 클로드.요청어림USD(r.params), 0) / 2;
    assert.ok(Math.abs(누적(일부, '프로모') - 만든어림) < 1e-9);
  } finally { 일부.지우기(); }
});

test('한도 키로 보낸 요청이 처리 전에 거절된 4xx(usage 없음)면 0으로 끝내고, 5xx면 위 어림을 남긴다', async () => {
  for (const [status, 남음] of [[400, false], [429, false], [500, true], [529, true]]) {
    const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 한도USD: 1 }]]);
    try {
      const 서버 = 가짜서버(() => [status, { type: 'error', error: { type: 'some_error', message: 'nope' } }]);
      await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 서버.fetch, 지금 }), (e) => e.code === '클로드키_요청실패');
      assert.ok(Math.abs(누적(t, '프로모') - (남음 ? 클로드.요청어림USD(본문) : 0)) < 1e-9, `HTTP ${status}`);
    } finally { t.지우기(); }
  }
});

test('잠금 없이: 예약 줄을 먼저 쓰고 내 줄 앞만 본다 — 앞에 쌓인 끝나지 않은 남의 예약을 보고 물러서고 취소 줄로 끝낸다', async () => {
  const 어림 = 클로드.요청어림USD(본문);
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 어림 * 1.5 }]]);
  try {
    // 다른 실행이 프로모로 보내려고 남긴 예약(아직 끝 줄 없음)이 앞에 있다.
    클로드.기록남기기({ 키이름: '프로모', 단계: '예약', 예약: '남의것', 어림USD: 어림 }, { ...t.옵션, 지금 });
    assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 })).키이름, '예비');
    // 앞에 남의 예약이 있다는 것은 처음 판정에서 이미 보여 내 예약은 쓰이지도 않는다. 남의 예약이 끝나면(실제 비용 0) 다시 쓸 수 있다.
    클로드.기록남기기({ 키이름: '프로모', 단계: '끝', 예약: '남의것', 추정USD: 0 }, { ...t.옵션, 지금 });
    assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 })).키이름, '프로모');
    assert.ok(Math.abs(누적(t, '프로모') - 어림) < 1e-9);
  } finally { t.지우기(); }
});

test('잠금 없이: 기록에 깨진 줄·끝나지 않은 마지막 줄이 있어도 읽고, 내 예약 줄이 깨져 찾지 못하면 그 키에서 물러선다', async () => {
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 1 }]]);
  try {
    // 쓰다 죽은 실행이 줄바꿈 없는 조각을 남겼다 — 내 예약 줄이 그 뒤에 붙어 한 줄로 깨진다.
    fs.writeFileSync(t.옵션.기록경로, '{"키이름":"프로모","단계":"예약","예약":"죽은것","어림USD":0.0');
    assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 })).키이름, '예비');
    // 깨진 줄은 건너뛰고 다음 요청은 다시 프로모로 간다(상태 표도 깨진 줄로 멈추지 않는다).
    assert.equal(클로드.상태보기({ ...t.옵션, 지금 }).length, 2);
    assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 })).키이름, '프로모');
  } finally { t.지우기(); }
});

test('한도·만료 칸이 잘못되면 호출 전에 막는다', async () => {
  const 안됨 = async () => { throw new Error('호출되면 안 됨'); };
  for (const [덧붙임, 문구] of [[{ 한도USD: -1 }, /한도USD/], [{ 한도USD: '200' }, /한도USD/], [{ 만료일: '2026-02-30' }, /만료일/],
    [{ 만료일: '11-22' }, /만료일/], [{ 한도USD: 1, 한도시작: '어제' }, /한도시작/]]) {
    const t = 방만들기([['A', null, 'sk-ant-test-aaaa', 덧붙임]]);
    try { await assert.rejects(클로드.보내기(본문, { ...t.옵션, fetch: 안됨, 지금 }), 문구); } finally { t.지우기(); }
  }
});

test('일괄 결과는 반올림하지 않고 적는다 — 6자리로 내려 적으면 다음 일괄이 한도를 조금 넘는다', async () => {
  const params = { model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'a'.repeat(19) }] };
  const 입력 = Buffer.byteLength(JSON.stringify(params), 'utf8');
  const 어림 = 클로드.요청어림USD(params) / 2;
  assert.ok(어림 - Number(어림.toFixed(6)) > 2e-7, '반올림으로 잃는 몫이 아래 틈보다 커야 이 시험이 뜻이 있다');
  const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 1 }]]);
  try {
    // 앞선 쓰임 + 일괄 둘의 실제 비용이 한도를 2e-7달러 넘게 맞춘다.
    클로드.기록남기기({ 키이름: '프로모', model: 'claude-haiku-5-5', 추정USD: 1 - 2 * 어림 + 2e-7 }, { ...t.옵션, 지금 });
    let 번호 = 0;
    const fetch = async (url, init) => {
      const 답 = (body, raw) => ({ status: 200, ok: true, text: async () => raw ?? JSON.stringify(body) });
      if (url.endsWith('/v1/messages')) return 답({ type: 'message', content: [], usage: { input_tokens: 8, output_tokens: 1 } });
      if (url.endsWith('/v1/messages/batches') && init.method === 'POST') return 답({ id: `msgbatch_r${++번호}`, processing_status: 'in_progress' });
      if (url.endsWith('/results')) return 답(null, JSON.stringify({ custom_id: 'a', result: { type: 'succeeded',
        message: { model: 'claude-haiku-5-5', content: [], usage: { input_tokens: 입력, output_tokens: 1 } } } }) + '\n');
      const id = url.split('/').pop();
      return 답({ id, processing_status: 'ended', results_url: `https://api.anthropic.com/v1/messages/batches/${id}/results` });
    };
    const 첫째 = await 클로드.배치보내기([{ custom_id: 'a', params }], { ...t.옵션, fetch, 지금 });
    assert.equal(첫째.키이름, '프로모');
    await 클로드.배치결과(첫째.배치id, 첫째.키이름, { ...t.옵션, fetch, 지금 });
    assert.equal((await 클로드.배치보내기([{ custom_id: 'a', params }], { ...t.옵션, fetch, 지금 })).키이름, '예비');
  } finally { t.지우기(); }
});

test('잠금 없이: 내 예약 줄에 남의 조각이 끼어 내가 쓴 글과 달라지면 JSON으로 읽혀도 그 키에서 물러선다', async () => {
  // 덧붙이기가 섞였다고 치고 예약 줄을 바꿔 쓴다 — 어림 자리에 남의 예약이 들어간 꼴(꼴이 어긋난 줄), 수에 숫자 하나가 낀 꼴.
  const 망가뜨리기 = [(글) => 글.replace(/"어림USD":([^}]*)\}/, '"어림USD":{"키이름":"프로모","단계":"예약","예약":"남의것","어림USD":$1}}'),
    (글) => 글.replace('"어림USD":0.', '"어림USD":0.0')];
  for (const 바꾸기 of 망가뜨리기) {
    const t = 방만들기([['예비', null, 'sk-ant-test-yyyy'], ['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 1 }]]);
    const 원래 = fs.appendFileSync;
    try {
      fs.appendFileSync = (경로, 글, ...나머지) => {
        if (!String(글).includes('"단계":"예약"')) return 원래(경로, 글, ...나머지);
        const 바뀐글 = 바꾸기(String(글));
        assert.notEqual(바뀐글, String(글));
        return 원래(경로, 바뀐글, ...나머지);
      };
      assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 })).키이름, '예비');
      fs.appendFileSync = 원래;
      // 물러선 예약은 취소 줄로 끝나 세지 않고, 다음 요청은 다시 프로모로 간다.
      assert.equal((await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 })).키이름, '프로모');
      assert.ok(Math.abs(누적(t, '프로모') - 클로드.요청어림USD(본문)) < 1e-12);
      assert.equal(클로드.상태보기({ ...t.옵션, 지금 }).length, 2);
    } finally { fs.appendFileSync = 원래; t.지우기(); }
  }
});

test('덧붙이기: 여러 프로세스가 한 기록에 함께 덧붙여도 줄이 섞이지 않는다(잠금 없는 예약이 기대는 성질)', async () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-claude-append-'));
  try {
    const 기록 = path.join(방, '기록.jsonl'), 출발 = Date.now() + 1000;
    // 프로세스마다 출발 시각까지 기다렸다가 2KB 안팎의 예약 줄을 400개씩 한 줄씩 덧붙인다. 줄 글은 예약 번호로 정해진다.
    const 줄글 = (예약) => JSON.stringify({ 시각: '2026-10-22T00:00:00.000Z', 키이름: '프로모', 단계: '예약', 예약, 어림USD: 0.000123456789, 용도: '가'.repeat(600) });
    const 코드 = `const fs = require('fs'); const [경로, 번호, 출발] = process.argv.slice(1); while (Date.now() < Number(출발));
const 줄글 = ${줄글.toString()};
for (let i = 0; i < 400; i++) fs.appendFileSync(경로, 줄글(번호 + '-' + i) + '\\n');`;
    await Promise.all([0, 1, 2, 3].map((번호) => new Promise((풀림, 거절) => {
      const 자식 = require('node:child_process').spawn(process.execPath, ['-e', 코드, 기록, String(번호), String(출발)], { stdio: 'inherit' });
      자식.on('error', 거절);
      자식.on('exit', (c) => (c === 0 ? 풀림() : 거절(new Error(`자식 프로세스 종료 코드 ${c}`))));
    })));
    const 줄들 = fs.readFileSync(기록, 'utf8').split('\n');
    assert.equal(줄들.pop(), '');
    assert.equal(줄들.length, 1600);
    // 줄마다 원문이 그대로이고(1,600개가 모두 다르다), 한 프로세스의 줄은 쓴 차례대로 쌓였다.
    const 기대 = new Set([0, 1, 2, 3].flatMap((번호) => Array.from({ length: 400 }, (_, i) => 줄글(`${번호}-${i}`))));
    assert.equal(new Set(줄들).size, 1600);
    assert.ok(줄들.every((줄) => 기대.has(줄)));
    for (const 번호 of ['0', '1', '2', '3']) {
      const 차례 = 줄들.map((줄) => JSON.parse(줄).예약.split('-')).filter(([n]) => n === 번호).map(([, i]) => Number(i));
      assert.deepEqual(차례, Array.from({ length: 400 }, (_, i) => i));
    }
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('잠금 없이: 금액 칸의 꼴이 어긋난 줄은 깨진 줄로 건너뛰어, 그 줄이 끝내려던 예약은 어림으로 남는다', () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 1 }]]);
  try {
    클로드.기록남기기({ 키이름: '프로모', 단계: '예약', 예약: 'r1', 어림USD: 0.3 }, { ...t.옵션, 지금 });
    // 남의 줄이 섞여 금액 자리에 객체가 들어간 끝 줄 — 받아들이면 예약을 끝내고 0으로 센다.
    클로드.기록남기기({ 키이름: '프로모', 단계: '끝', 예약: 'r1', 추정USD: { 키이름: '프로모' }, 어림USD: { 예약: 'r2' } }, { ...t.옵션, 지금 });
    assert.equal(클로드.상태보기({ ...t.옵션, 지금 })[0].한도쓴양USD, 0.3);
  } finally { t.지우기(); }
});

test('한도를 건 키는 「한도키」 배열에만 둔다 — 옛 판이 읽는 「키」 배열에 한도USD가 있거나, 「한도키」에 한도USD가 없으면 막는다', async () => {
  const 안됨 = async () => { throw new Error('호출되면 안 됨'); };
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-claude-keys-'));
  try {
    fs.writeFileSync(path.join(방, 'A.txt'), 'sk-ant-test-aaaa');
    const 옵션 = { 목록경로: path.join(방, '목록.json'), 상태경로: path.join(방, '상태.json'), 기록경로: path.join(방, '기록.jsonl') };
    const 키 = { 이름: 'A', 키파일: 'A.txt', 갱신일: null };
    for (const [목록, 문구] of [[{ 키: [{ ...키, 한도USD: 1 }] }, /한도키/], [{ 키: [], 한도키: [키] }, /한도USD가 있어야/],
      [{ 키: [], 한도키: { A: 키 } }, /배열/], [{ 키: [키], 한도키: [{ ...키, 한도USD: 1 }] }, /겹친다/]]) {
      fs.writeFileSync(옵션.목록경로, JSON.stringify(목록));
      await assert.rejects(클로드.보내기(본문, { ...옵션, fetch: 안됨, 지금 }), 문구);
    }
    // 「한도키」의 키는 일괄 결과를 받을 때처럼 이름으로도 찾는다.
    fs.writeFileSync(옵션.목록경로, JSON.stringify({ 키: [], 한도키: [{ ...키, 한도USD: 1 }] }));
    assert.deepEqual(클로드.상태보기({ ...옵션, 지금 }).map((k) => [k.이름, k.한도USD]), [['A', 1]]);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('상태 표의 이번 주기 호출 수는 한도 키의 예약·취소 줄을 세지 않는다', async () => {
  const t = 방만들기([['프로모', null, 'sk-ant-test-pppp', { 만료일: '2026-11-21', 한도USD: 1 }]]);
  try {
    for (let i = 0; i < 2; i++) await 클로드.보내기(본문, { ...t.옵션, fetch: 정직한서버().fetch, 지금 });
    클로드.기록남기기({ 키이름: '프로모', 단계: '예약', 예약: '물러선것', 어림USD: 0.1 }, { ...t.옵션, 지금 });
    클로드.기록남기기({ 키이름: '프로모', 단계: '취소', 예약: '물러선것', 추정USD: 0 }, { ...t.옵션, 지금 });
    assert.equal(클로드.상태보기({ ...t.옵션, 지금 })[0].이번주기호출, 2);
  } finally { t.지우기(); }
});
