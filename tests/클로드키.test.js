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
  for (const [이름, 갱신일, 값] of 키들) {
    const 파일 = `${이름}.txt`;
    if (값 !== null) fs.writeFileSync(path.join(방, 파일), 값 + '\r\n');
    목록.키.push({ 이름, 키파일: 파일, 갱신일 });
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
    assert.deepEqual(await 클로드.키고르기({ ...t.옵션, fetch: 안됨, 지금 }), { 이름: null, 값: null, 건너뛴키: [] });
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
