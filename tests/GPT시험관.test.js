/* GPT시험관 — 낯선 사람 이해 시험의 셋째 시험관(다른 회사 눈, 2026-10-29). 낯선이시험.js가 만든 폴더의 질문 · 말 · 장면을
 * 그 순서 그대로 OpenAI Responses API에 보내 답_GPT.md로 받는다. 크레딧이 바닥나면 종료 3 — 돈 드는 길로 돌리지 않는다. 키는 찍지 않는다.
 * 가짜 서버(SYNK_OPENAI_BASE)와 임시 키 파일(OPENAI_KEY_FILE)만 쓴다 — 실제 API · ~/SYNK_보안은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구 = path.join(REPO, 'tools', 'GPT시험관.mjs');
const 가짜키 = 'sk-test-fake-tester-key-0123456789';

function 서버(답) {
  return new Promise((resolve) => {
    const 받은 = [];
    const s = http.createServer((req, res) => {
      const 조각 = [];
      req.on('data', (d) => 조각.push(d));
      req.on('end', () => {
        받은.push({ url: req.url, 머리: req.headers, 몸: Buffer.concat(조각).toString('utf8') });
        const { 상태 = 200, json } = 답(req);
        res.writeHead(상태, { 'Content-Type': 'application/json', 'x-request-id': 'req_fake' });
        res.end(JSON.stringify(json));
      });
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, 받은, 바탕: `http://127.0.0.1:${s.address().port}/v1` }));
  });
}

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

/* 낯선이시험.js가 만드는 폴더 꼴 — 장면 둘(이름 순서를 일부러 거꾸로 만든다)과 지난 편 하나 */
function 시험폴더() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-tester-'));
  fs.writeFileSync(path.join(d, '질문.md'), '너는 처음 본 사람이다.\n1. 이 영상이 말하려는 것 — 한 문장.');
  fs.writeFileSync(path.join(d, '말.txt'), '0.0s  안녕하세요\n2.1s  아니?!\n');
  fs.writeFileSync(path.join(d, '정지컷_02.jpg'), Buffer.from('jpeg-second'));
  fs.writeFileSync(path.join(d, '정지컷_01.jpg'), Buffer.from('jpeg-first'));
  fs.writeFileSync(path.join(d, '지난1_E8.jpg'), Buffer.from('jpeg-previous'));
  const 키 = path.join(d, 'openai.txt');
  fs.writeFileSync(키, `${가짜키}\n`);
  return { d, 키 };
}

const 성공 = () => ({
  json: { output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '1. 아니의 두 억양을 알려 준다.' }] }], usage: { input_tokens: 1000, output_tokens: 200 } },
});

test('질문 · 말 · 장면(이름 순) · 지난 편 순서로 Responses API에 보내고 답을 답_GPT.md에 받는다, 키는 찍지 않는다', async () => {
  const { s, 받은, 바탕 } = await 서버(성공);
  try {
    const t = 시험폴더();
    const r = await 돌리기([t.d], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(r.code, 0, r.오류);
    assert.strictEqual(받은.length, 1);
    assert.strictEqual(받은[0].url, '/v1/responses');
    const 몸 = JSON.parse(받은[0].몸);
    assert.strictEqual(몸.model, 'gpt-6.1-sol');
    assert.strictEqual(몸.store, false);
    const 내용 = 몸.input[0].content;
    assert.match(내용[0].text, /너는 처음 본 사람이다/);
    assert.match(내용[1].text, /2\.1s {2}아니\?!/);
    const 이름표 = 내용.filter((c) => c.type === 'input_text' && /^\[.+\.jpg\]$/.test(c.text)).map((c) => c.text);
    assert.deepStrictEqual(이름표, ['[정지컷_01.jpg]', '[정지컷_02.jpg]', '[지난1_E8.jpg]']);
    const 그림 = 내용.filter((c) => c.type === 'input_image').map((c) => Buffer.from(c.image_url.split(',')[1], 'base64').toString());
    assert.deepStrictEqual(그림, ['jpeg-first', 'jpeg-second', 'jpeg-previous']);
    assert.match(fs.readFileSync(path.join(t.d, '답_GPT.md'), 'utf8'), /아니의 두 억양/);
    const 기록 = JSON.parse(fs.readFileSync(path.join(t.d, '답_GPT_기록.json'), 'utf8'));
    assert.strictEqual(기록.어림값USD, Number((1000 * 2e-6 + 200 * 10e-6).toFixed(4)));
    assert.ok(!`${r.출력}${r.오류}${JSON.stringify(기록)}`.includes(가짜키), '키가 출력 · 기록에 들어갔다');
  } finally {
    s.close();
  }
});

test('크레딧이 바닥나면 종료 3이고 답 파일을 만들지 않는다', async () => {
  const { s, 바탕 } = await 서버(() => ({ 상태: 429, json: { error: { code: 'credit_balance_exhausted', message: 'exhausted' } } }));
  try {
    const t = 시험폴더();
    const r = await 돌리기([t.d], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(r.code, 3, r.오류);
    assert.match(r.오류, /크레딧이 바닥났다/);
    assert.ok(!fs.existsSync(path.join(t.d, '답_GPT.md')));
  } finally {
    s.close();
  }
});

test('질문.md나 장면 묶음이 없으면 부르기 전에 종료 2', async () => {
  const { s, 받은, 바탕 } = await 서버(성공);
  try {
    const t = 시험폴더();
    fs.rmSync(path.join(t.d, '질문.md'));
    const 없음 = await 돌리기([t.d], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: t.키 });
    assert.strictEqual(없음.code, 2);
    const u = 시험폴더();
    for (const f of ['정지컷_01.jpg', '정지컷_02.jpg']) fs.rmSync(path.join(u.d, f));
    const 장면없음 = await 돌리기([u.d], { SYNK_OPENAI_BASE: 바탕, OPENAI_KEY_FILE: u.키 });
    assert.strictEqual(장면없음.code, 2);
    assert.strictEqual(받은.length, 0);
  } finally {
    s.close();
  }
});
