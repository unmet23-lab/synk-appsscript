/* GPT콘티굽기 — 광고 콘티만 GPT Image 2.5 Sunburst · max로 API에서 굽는다(2026-10-29 결정).
 * 모델 · 품질은 고정이고, 크레딧이 바닥나면 다음 무료 크레딧 키로만 넘기고 마지막 키에서 멈춘다. 키는 찍지 않는다.
 * 가짜 서버(SYNK_OPENAI_BASE)와 임시 키 파일(OPENAI_KEY_FILE) · 임시 키 목록(SYNK_OPENAI_KEYLIST)만 쓴다
 * — 실제 API · ~/SYNK_보안은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구 = path.join(REPO, 'tools', 'GPT콘티굽기.mjs');
const 가짜키 = 'sk-test-fake-key-must-never-be-printed-0123456789';
const 그림 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const 성공 = () => ({
  json: {
    data: [{ b64_json: 그림.toString('base64') }], size: '1152x2048', quality: 'max',
    usage: { input_tokens: 100, input_tokens_details: { text_tokens: 100, image_tokens: 0 }, output_tokens: 1000 },
  },
});

/* 받은 요청을 모으고 답(요청 → {상태, json})대로 돌려주는 가짜 OpenAI */
function 서버(답) {
  return new Promise((resolve) => {
    const 받은 = [];
    const s = http.createServer((req, res) => {
      const 조각 = [];
      req.on('data', (d) => 조각.push(d));
      req.on('end', () => {
        받은.push({ url: req.url, 머리: req.headers, 몸: Buffer.concat(조각).toString('latin1') });
        const { 상태 = 200, json } = 답(req);
        res.writeHead(상태, { 'Content-Type': 'application/json', 'x-request-id': 'req_fake' });
        res.end(JSON.stringify(json));
      });
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, 받은, 바탕: `http://127.0.0.1:${s.address().port}/v1` }));
  });
}

/* 서버가 같은 프로세스에 있으므로 spawnSync가 아니라 spawn으로 돌린다 */
function 돌리기(인자, env) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [도구, ...인자], { cwd: REPO, env: { ...process.env, ...env } });
    let 출력 = '';
    let 오류 = '';
    c.stdout.on('data', (d) => { 출력 += d; });
    c.stderr.on('data', (d) => { 오류 += d; });
    c.on('close', (code) => resolve({ code, 출력, 오류 }));
  });
}

function 임시() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-conti-'));
  const 키 = path.join(d, 'openai.txt');
  fs.writeFileSync(키, `${가짜키}\n`);
  const 지시문 = path.join(d, '지시문.txt');
  fs.writeFileSync(지시문, 'A vertical ad storyboard frame: iced coffee on a cafe counter, morning light.');
  return { d, 키, 지시문, 나갈: path.join(d, '판.png') };
}

/* 임시 폴더에 키 파일들과 그 옆 상대 경로를 쓰는 키 목록을 만든다 */
function 목록만들기(d, 키들) {
  const 목록 = 키들.map((k, i) => {
    const 파일 = `key${i}.txt`;
    fs.writeFileSync(path.join(d, 파일), `${k.값}\n`);
    return { 이름: k.이름, 파일, ...(k.까지 ? { 까지: k.까지 } : {}) };
  });
  const p = path.join(d, '키목록.json');
  fs.writeFileSync(p, JSON.stringify(목록));
  return p;
}

test('참고 없이 굽기 — generations에 Sunburst · max · 세로 9:16 기본 크기를 보내고 그림 · 기록을 남긴다, 키는 찍지 않는다', async () => {
  const { s, 받은, 바탕 } = await 서버(성공);
  try {
    const t = 임시();
    const r = await 돌리기([t.지시문, t.나갈], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(r.code, 0, r.오류);
    assert.strictEqual(받은.length, 1);
    assert.strictEqual(받은[0].url, '/v1/images/generations');
    const 몸 = JSON.parse(받은[0].몸);
    assert.deepStrictEqual([몸.model, 몸.quality, 몸.size, 몸.n], ['gpt-image-2.5-sunburst', 'max', '1152x2048', 1]);
    assert.strictEqual(받은[0].머리.authorization, `Bearer ${가짜키}`);
    assert.ok(fs.readFileSync(t.나갈).equals(그림));
    const 기록 = JSON.parse(fs.readFileSync(t.나갈.replace(/\.png$/, '_기록.json'), 'utf8'));
    assert.strictEqual(기록.어림값USD, Number((100 * 5e-6 + 1000 * 30e-6).toFixed(4)));
    assert.strictEqual(기록.받은품질, 'max');
    assert.ok(!`${r.출력}${r.오류}`.includes(가짜키), '키가 출력에 찍혔다');
    assert.ok(!fs.readFileSync(t.나갈.replace(/\.png$/, '_기록.json'), 'utf8').includes(가짜키), '키가 기록에 들어갔다');
  } finally {
    s.close();
  }
});

test('참고 그림이 있으면 edits로 보내고 image[]를 넘긴 순서대로 붙인다 — 모델 · 품질은 그대로 고정', async () => {
  const { s, 받은, 바탕 } = await 서버(성공);
  try {
    const t = 임시();
    const 가 = path.join(t.d, 'a_세트.jpg');
    const 나 = path.join(t.d, 'b_인물.jpg');
    fs.writeFileSync(가, Buffer.from('jpeg-a'));
    fs.writeFileSync(나, Buffer.from('jpeg-b'));
    const r = await 돌리기([t.지시문, t.나갈, 가, 나, '--크기', '2048x1152'], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(r.code, 0, r.오류);
    assert.strictEqual(받은[0].url, '/v1/images/edits');
    const 몸 = 받은[0].몸;
    assert.ok(몸.includes('name="model"\r\n\r\ngpt-image-2.5-sunburst'));
    assert.ok(몸.includes('name="quality"\r\n\r\nmax'));
    assert.ok(몸.includes('name="size"\r\n\r\n2048x1152'));
    assert.strictEqual(몸.split('name="image[]"').length - 1, 2);
    assert.ok(몸.indexOf('jpeg-a') < 몸.indexOf('jpeg-b'), '참고 그림 순서가 바뀌었다');
  } finally {
    s.close();
  }
});

test('크레딧이 바닥나면(429 credit_balance_exhausted) 종료 3 — 다시 부르지 않고 그림도 남기지 않는다', async () => {
  const { s, 받은, 바탕 } = await 서버(() => ({ 상태: 429, json: { error: { code: 'credit_balance_exhausted', message: 'Your credit balance is exhausted.' } } }));
  try {
    const t = 임시();
    const r = await 돌리기([t.지시문, t.나갈], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(r.code, 3, r.오류);
    assert.match(r.오류, /크레딧이 바닥났다/);
    assert.strictEqual(받은.length, 1);
    assert.ok(!fs.existsSync(t.나갈));
  } finally {
    s.close();
  }
});

test('있는 그림은 --덮어쓰기 없이 덮지 않고, 16의 배수가 아닌 크기는 부르기 전에 거절한다', async () => {
  const { s, 받은, 바탕 } = await 서버(성공);
  try {
    const t = 임시();
    fs.writeFileSync(t.나갈, 'old');
    const 덮기 = await 돌리기([t.지시문, t.나갈], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(덮기.code, 2);
    assert.strictEqual(fs.readFileSync(t.나갈, 'utf8'), 'old');
    const 크기 = await 돌리기([t.지시문, path.join(t.d, '새.png'), '--크기', '1080x1920'], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(크기.code, 2);
    assert.strictEqual(받은.length, 0);
  } finally {
    s.close();
  }
});

test('키 목록 — 첫 키 크레딧이 바닥나면 다음 키로 한 번 더 부르고, 기록에는 쓴 키 이름만 남긴다', async () => {
  const 키1 = 'sk-test-first-key-0123456789';
  const 키2 = 'sk-test-second-key-0123456789';
  const { s, 받은, 바탕 } = await 서버((req) => (req.headers.authorization === `Bearer ${키1}`
    ? { 상태: 429, json: { error: { code: 'credit_balance_exhausted', message: 'exhausted' } } }
    : 성공()));
  try {
    const t = 임시();
    const 목록 = 목록만들기(t.d, [{ 이름: '첫째', 값: 키1 }, { 이름: '둘째', 값: 키2 }]);
    const r = await 돌리기([t.지시문, t.나갈], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: '', SYNK_OPENAI_KEYLIST: 목록 });
    assert.strictEqual(r.code, 0, r.오류);
    assert.deepStrictEqual(받은.map((x) => x.머리.authorization), [`Bearer ${키1}`, `Bearer ${키2}`]);
    const 기록 = fs.readFileSync(t.나갈.replace(/\.png$/, '_기록.json'), 'utf8');
    assert.strictEqual(JSON.parse(기록).키, '둘째');
    for (const 키 of [키1, 키2]) assert.ok(!`${r.출력}${r.오류}${기록}`.includes(키), '키가 출력 · 기록에 들어갔다');
  } finally {
    s.close();
  }
});

test('키 목록 — 「까지」 날이 지난 키는 부르지 않는다', async () => {
  const 옛키 = 'sk-test-old-key-0123456789';
  const 새키 = 'sk-test-new-key-0123456789';
  const { s, 받은, 바탕 } = await 서버(성공);
  try {
    const t = 임시();
    const 목록 = 목록만들기(t.d, [{ 이름: '옛', 값: 옛키, 까지: '2000-01-01' }, { 이름: '새', 값: 새키 }]);
    const r = await 돌리기([t.지시문, t.나갈], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: '', SYNK_OPENAI_KEYLIST: 목록 });
    assert.strictEqual(r.code, 0, r.오류);
    assert.deepStrictEqual(받은.map((x) => x.머리.authorization), [`Bearer ${새키}`]);
  } finally {
    s.close();
  }
});

test('키 목록 — 속도 제한(429 rate_limit_exceeded)은 다음 키로 넘기지 않고 멈춘다', async () => {
  const 키1 = 'sk-test-rate-key-0123456789';
  const { s, 받은, 바탕 } = await 서버(() => ({ 상태: 429, json: { error: { code: 'rate_limit_exceeded', message: 'slow down' } } }));
  try {
    const t = 임시();
    const 목록 = 목록만들기(t.d, [{ 이름: '첫째', 값: 키1 }, { 이름: '둘째', 값: 'sk-test-unused-key-0123456789' }]);
    const r = await 돌리기([t.지시문, t.나갈], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: '', SYNK_OPENAI_KEYLIST: 목록 });
    assert.strictEqual(r.code, 1, r.오류);
    assert.strictEqual(받은.length, 1);
    assert.ok(!fs.existsSync(t.나갈));
  } finally {
    s.close();
  }
});
