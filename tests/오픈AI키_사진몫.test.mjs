/* 오픈AI키 — 「제2의 나」 사진 시범(용도 '사진')은 받아 적기 몫을 먼저 떼고 남은 만큼만 부른다(2026-11-03 「무료 크레딧 안에서」).
 * 가짜 서버(SYNK_OPENAI_BASE) · 임시 키 목록(SYNK_OPENAI_KEYLIST) · 임시 사진 몫 · 장부만 쓴다 — 실제 API · ~/SYNK_보안은 건드리지 않는다. */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { 차례로부르기, 사진몫, 받아적기몫, 부르기오류 } from '../tools/lib/오픈AI키.mjs';

function 서버(답) {
  return new Promise((resolve) => {
    const 받은 = [];
    const s = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        받은.push({ url: req.url, 방법: req.method });
        const { 상태 = 200, 글 } = 답(req);
        res.writeHead(상태, { 'Content-Type': 'application/json', 'x-request-id': 'req_fake' });
        res.end(글);
      });
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, 받은, 바탕: `http://127.0.0.1:${s.address().port}/v1` }));
  });
}

function 자리(몫) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-photo-budget-'));
  fs.writeFileSync(path.join(d, 'a.txt'), 'sk-test-photo-a-0123456789');
  fs.writeFileSync(path.join(d, 'b.txt'), 'sk-test-photo-b-0123456789');
  fs.writeFileSync(path.join(d, '목록.json'), JSON.stringify([{ 이름: '첫째', 파일: 'a.txt' }, { 이름: '둘째', 파일: 'b.txt' }]));
  if (몫) fs.writeFileSync(path.join(d, '몫.json'), JSON.stringify(몫));
  return d;
}

const 오늘몫 = (더 = {}) => {
  const 앞 = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10), 뒤 = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  return { 주기: { 시작: 앞, 끝: 뒤 }, 월크레딧USD: 30, 받아적기: { 지난주기실사용USD: 2 }, 여유USD: 5, ...더 };
};

async function 환경(d, 바탕, 몸) {
  const 옛 = Object.fromEntries(['SYNK_OPENAI_BASE', 'SYNK_OPENAI_KEYLIST', 'OPENAI_KEY_FILE', 'SYNK_OPENAI_PHOTO_BUDGET', 'SYNK_OPENAI_PHOTO_LEDGER'].map((k) => [k, process.env[k]]));
  Object.assign(process.env, { SYNK_OPENAI_BASE: 바탕, SYNK_OPENAI_KEYLIST: path.join(d, '목록.json'), SYNK_OPENAI_PHOTO_BUDGET: path.join(d, '몫.json'), SYNK_OPENAI_PHOTO_LEDGER: path.join(d, '장부.jsonl') });
  delete process.env.OPENAI_KEY_FILE;
  try {
    return await 몸();
  } finally {
    for (const [k, v] of Object.entries(옛)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

const 장부합 = (d) => (fs.existsSync(path.join(d, '장부.jsonl')) ? fs.readFileSync(path.join(d, '장부.jsonl'), 'utf8').trim().split('\n').filter(Boolean).reduce((a, l) => a + JSON.parse(l).USD, 0) : 0);
const 만들기 = (바탕, 끝 = '/batches') => () => ({ 주소: `${바탕}${끝}`, 몸: JSON.stringify({ input_file_id: 'file-x' }), json: true });

test('받아 적기 몫 = 지난 주기 실사용의 3배, 적어도 $20 — 상한은 월 크레딧에서 그 몫과 여유를 뺀 만큼', () => {
  assert.strictEqual(받아적기몫(0), 20);
  assert.strictEqual(받아적기몫(12), 36);
  const d = 자리(오늘몫({ 월크레딧USD: 200, 받아적기: { 지난주기실사용USD: 12 }, 여유USD: 10 }));
  process.env.SYNK_OPENAI_PHOTO_BUDGET = path.join(d, '몫.json');
  try {
    assert.strictEqual(사진몫().상한, 200 - 36 - 10);
  } finally {
    delete process.env.SYNK_OPENAI_PHOTO_BUDGET;
  }
});

test('사진 몫 파일이 없거나 주기가 지났으면 부르지 않고 코드 3', async () => {
  const { s, 받은, 바탕 } = await 서버(() => ({ 글: '{"id":"batch_1"}' }));
  try {
    const 없음 = 자리(null);
    await 환경(없음, 바탕, () => assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 0.1 }), (e) => e instanceof 부르기오류 && e.코드 === 3 && /사진 몫이 정해지지/.test(e.message)));
    const 지남 = 자리({ ...오늘몫(), 주기: { 시작: '2026-01-01', 끝: '2026-02-01' } });
    await 환경(지남, 바탕, () => assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 0.1 }), (e) => e.코드 === 3 && /주기/.test(e.message)));
    assert.strictEqual(받은.length, 0);
  } finally {
    s.close();
  }
});

test('상한 안에서는 어림을 1.3배로 장부에 먼저 적고 부르며, 넘치면 「배송 지연」 코드 3으로 서버를 부르지 않는다', async () => {
  const { s, 받은, 바탕 } = await 서버(() => ({ 글: '{"id":"batch_1","status":"validating"}' }));
  try {
    const d = 자리(오늘몫()); // 상한 30 − 20 − 5 = $5
    await 환경(d, 바탕, async () => {
      const r = await 차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 1, 메모: '기준 묶음' });
      assert.strictEqual(r.답.id, 'batch_1');
      assert.strictEqual(Number(장부합(d).toFixed(4)), 1.3);
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 3 }), (e) => e.코드 === 3 && /배송 지연/.test(e.message) && /받아 적기 몫 \$20\.00/.test(e.message));
      assert.strictEqual(받은.length, 1);
      assert.strictEqual(Number(장부합(d).toFixed(4)), 1.3);
    });
  } finally {
    s.close();
  }
});

test('돈이 안 드는 부르기(어림 0 — 파일 지우기 · 결과 받기)는 몫이 바닥나도 막지 않고, 만든 키 하나로만 · 날글로 받는다', async () => {
  const { s, 받은, 바탕 } = await 서버((req) => (req.method === 'DELETE' ? { 글: '{"id":"file-x","deleted":true}' } : { 글: '{"custom_id":"a"}\n{"custom_id":"b"}\n' }));
  try {
    const d = 자리(오늘몫({ 월크레딧USD: 20 })); // 상한 0
    await 환경(d, 바탕, async () => {
      const 지움 = await 차례로부르기(() => ({ 주소: `${바탕}/files/file-x` }), { 용도: '사진', 어림USD: 0, 방법: 'DELETE', 키이름: '둘째' });
      assert.strictEqual(지움.답.deleted, true);
      assert.strictEqual(지움.쓴키, '둘째');
      const 결과 = await 차례로부르기(() => ({ 주소: `${바탕}/files/file-out/content` }), { 용도: '사진', 어림USD: 0, 방법: 'GET', 키이름: '둘째', 날글: true });
      assert.strictEqual(결과.글.trim().split('\n').length, 2);
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 0.01 }), (e) => e.코드 === 3);
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 0, 키이름: '없는키' }), (e) => e.코드 === 2);
      assert.deepStrictEqual(받은.map((r) => r.방법), ['DELETE', 'GET']);
      assert.strictEqual(장부합(d), 0);
    });
  } finally {
    s.close();
  }
});

test('몫 파일의 금액은 JSON 숫자만 — null · 빈 글 · false는 0이 아니라 코드 3, 여유가 빠졌을 때만 10', () => {
  const 읽기 = (몫) => {
    const d = 자리(몫);
    process.env.SYNK_OPENAI_PHOTO_BUDGET = path.join(d, '몫.json');
    try { return 사진몫(); } finally { delete process.env.SYNK_OPENAI_PHOTO_BUDGET; }
  };
  for (const 틀림 of [{ 받아적기: { 지난주기실사용USD: null } }, { 받아적기: { 지난주기실사용USD: '' } }, { 월크레딧USD: false }, { 여유USD: '' }, { 여유USD: null }, { 월크레딧USD: '200' }]) {
    assert.throws(() => 읽기(오늘몫(틀림)), (e) => e instanceof 부르기오류 && e.코드 === 3 && /꼴이 맞지 않다/.test(e.message), JSON.stringify(틀림));
  }
  for (const 맨위 of [true, 200, 'x', null, [1]]) {
    const d = 자리(null);
    fs.writeFileSync(path.join(d, '몫.json'), JSON.stringify(맨위));
    process.env.SYNK_OPENAI_PHOTO_BUDGET = path.join(d, '몫.json');
    try { assert.throws(() => 사진몫(), (e) => e instanceof 부르기오류 && e.코드 === 3, JSON.stringify(맨위)); } finally { delete process.env.SYNK_OPENAI_PHOTO_BUDGET; }
  }
  const { 여유USD, ...여유없음 } = 오늘몫();
  void 여유USD;
  assert.strictEqual(읽기(여유없음).상한, 30 - 20 - 10);
});

test('장부에 금액이 숫자가 아니거나 때를 못 읽는 줄이 있으면 쓴 돈을 모르므로 코드 3', async () => {
  const { s, 받은, 바탕 } = await 서버(() => ({ 글: '{"id":"batch_1"}' }));
  try {
    for (const 줄 of [{ 때: new Date().toISOString(), USD: '4.9USD' }, { 때: 'bad-date', USD: 4.9 }, { 때: new Date().toISOString() }]) {
      const d = 자리(오늘몫());
      fs.writeFileSync(path.join(d, '장부.jsonl'), JSON.stringify(줄) + '\n');
      await 환경(d, 바탕, () => assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 0.1 }), (e) => e.코드 === 3 && /장부 줄이 깨졌다/.test(e.message)));
    }
    assert.strictEqual(받은.length, 0);
  } finally {
    s.close();
  }
});

test('값이 나갔는지 모르는 실패(본문을 다 못 읽음 · 5xx)는 되돌리지 않고, 되돌림은 예약과 같은 때로 적는다', async () => {
  let 차례 = 0;
  const s = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      차례++;
      if (차례 === 1) { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '500' }); res.write('{"id":"ba'); setTimeout(() => res.socket.destroy(), 20); return; }
      if (차례 === 2) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"server_error","message":"x"}}'); return; }
      res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"invalid_request","message":"bad"}}');
    });
  });
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  const 바탕 = `http://127.0.0.1:${s.address().port}/v1`;
  try {
    const d = 자리(오늘몫({ 월크레딧USD: 100 }));
    await 환경(d, 바탕, async () => {
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 1 }), (e) => e.코드 === 1 && /다 읽지 못했다/.test(e.message));
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 1 }), (e) => e.코드 === 1 && e.상태 === 500);
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 1 }), (e) => e.코드 === 1 && e.상태 === 400);
      const 줄 = fs.readFileSync(path.join(d, '장부.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.deepStrictEqual(줄.map((r) => r.USD), [1.3, 1.3, 1.3, -1.3]);
      assert.strictEqual(줄[3].때, 줄[2].때);
    });
  } finally {
    s.close();
  }
});

test('주기 끝 25시간 안에는 돈 드는 사진 부르기를 하지 않고(다음 주기로 청구될 수 있음), 지우기는 그대로 한다', async () => {
  const { s, 받은, 바탕 } = await 서버((req) => ({ 글: req.method === 'DELETE' ? '{"id":"file-x","deleted":true}' : '{"id":"batch_1"}' }));
  try {
    const 내일 = new Date(Date.now() + 864e5 + 3600e3).toISOString().slice(0, 10);
    const d = 자리(오늘몫({ 주기: { 시작: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), 끝: 내일 }, 월크레딧USD: 100 }));
    await 환경(d, 바탕, async () => {
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 0.1 }), (e) => e.코드 === 3 && /25시간 안/.test(e.message));
      const 지움 = await 차례로부르기(() => ({ 주소: `${바탕}/files/file-x` }), { 용도: '사진', 어림USD: 0, 방법: 'DELETE' });
      assert.strictEqual(지움.답.deleted, true);
    });
    assert.deepStrictEqual(받은.map((r) => r.방법), ['DELETE']);
  } finally {
    s.close();
  }
});

test('어림을 안 주면 코드 2, API가 거절한 부르기는 적은 어림을 되돌린다', async () => {
  const { s, 바탕 } = await 서버(() => ({ 상태: 400, 글: '{"error":{"code":"invalid_request","message":"bad"}}' }));
  try {
    const d = 자리(오늘몫());
    await 환경(d, 바탕, async () => {
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진' }), (e) => e.코드 === 2 && /어림USD/.test(e.message));
      await assert.rejects(차례로부르기(만들기(바탕), { 용도: '사진', 어림USD: 2 }), (e) => e.코드 === 1);
      const 줄 = fs.readFileSync(path.join(d, '장부.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.deepStrictEqual(줄.map((r) => r.USD), [2.6, -2.6]);
      assert.strictEqual(장부합(d), 0);
    });
  } finally {
    s.close();
  }
});
