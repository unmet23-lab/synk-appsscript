// 실시간 음성 상황극 시제품(experiences/realtime-roleplay) — 예산 계량기 · 자막 모음 · 피드백 검사 · 서버 길(가짜 OpenAI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { 계량, gptLive값, 주기, 장부읽기 } from '../experiences/realtime-roleplay/lib/예산.mjs';
import { 자막모음, 공급사표 } from '../experiences/realtime-roleplay/public/연결층.mjs';
import { 검사 } from '../experiences/realtime-roleplay/lib/피드백.mjs';
import { 팬사인회 } from '../experiences/realtime-roleplay/lib/장면.mjs';

const 때 = (iso) => iso;
const 줄 = (USD, 무엇 = '세션', 덧 = {}) => ({ 때: 때('2026-10-30T03:00:00Z'), 무엇, 길: 'gpt-live', USD, ...덧 });
const 지금 = Date.parse('2026-10-30T04:00:00Z');

test('예산: 70 · 95% 문턱에서 길이 내려가고 예산이 이상하면 글', () => {
  const 길 = (쓴) => 계량({ 줄들: [줄(쓴)], 예산USD: 100, 지금 }).길;
  assert.equal(길(69.99), 'gpt-live');
  assert.equal(길(70), 'realtime-mini');
  assert.equal(길(94.99), 'realtime-mini');
  assert.equal(길(95), '글');
  assert.equal(계량({ 줄들: [], 예산USD: 0, 지금 }).길, '글');
});

test('예산: 리셋 날 전후로 주기가 갈리고 지난 주기 값은 세지 않는다', () => {
  assert.equal(주기(Date.parse('2026-11-07T14:59:00Z'), 8), '2026-10~8일'); // 한국 11-07 23:59
  assert.equal(주기(Date.parse('2026-11-07T15:00:00Z'), 8), '2026-11~8일'); // 한국 11-08 00:00
  const 줄들 = [{ ...줄(40), 때: '2026-11-07T14:00:00Z' }, { ...줄(5), 때: '2026-11-08T01:00:00Z' }];
  assert.equal(계량({ 줄들, 예산USD: 50, 지금: Date.parse('2026-11-08T02:00:00Z'), 리셋날: 8 }).쓴값, 5);
});

test('예산: 끝 보고 없는 GPT-Live 세션은 5분 뒤 상한+15초로 세고, 크레딧 바닥이면 글', () => {
  const 시작 = { ...줄(gptLive값(0), '세션시작', { 세션: 'live_a' }), 때: '2026-10-30T03:50:00Z' };
  const 이른 = 계량({ 줄들: [시작], 예산USD: 100, 지금: Date.parse('2026-10-30T03:52:00Z') });
  assert.equal(이른.끝없는세션, 0);
  const 늦은 = 계량({ 줄들: [시작], 예산USD: 100, 지금 });
  assert.equal(늦은.끝없는세션, 1);
  assert.ok(Math.abs(늦은.쓴값 - gptLive값(255)) < 1e-3);
  const 끝남 = { ...줄(0.05, '세션', { 세션: 'live_a' }), 때: '2026-10-30T03:54:00Z' };
  assert.equal(계량({ 줄들: [시작, 끝남], 예산USD: 100, 지금 }).끝없는세션, 0);
  assert.equal(계량({ 줄들: [줄(0, '크레딧바닥')], 예산USD: 100, 지금 }).길, '글');
});

test('예산: 깨진 장부 줄은 건너뛴다', () => {
  const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), '장부-')), '예산장부.jsonl');
  fs.writeFileSync(파일, `${JSON.stringify(줄(1))}\n{깨짐\n${JSON.stringify({ 때: 'x' })}\n${JSON.stringify(줄(2))}\n`);
  assert.equal(장부읽기(파일).length, 2);
});

test('자막: GPT-Live는 사람이 바뀌거나 1.3초 넘게 쉬면 새 줄, 늦게 온 조각은 시각 자리로', () => {
  const z = 자막모음();
  const 넣기 = (type, delta, a, b) => z.넣기(공급사표['gpt-live'].자막({ type, delta, start_ms: a, end_ms: b }));
  넣기('session.output_transcript.delta', '이름이 뭐예요?', 0, 1500);
  넣기('session.input_transcript.delta', '저는 볼로르예요.', 2000, 3000);
  넣기('session.input_transcript.delta', '몽골에서 왔어요.', 4600, 5600); // 1.6초 쉼 → 새 줄
  넣기('session.output_transcript.delta', '와, 몽골에서요?', 6000, 7000);
  넣기('session.input_transcript.delta', '네.', 5650, 5900); // 늦게 도착 — 상대 줄 앞, 앞 줄에 이어 붙음
  assert.deepEqual(z.보낼것().map((l) => `${l.누가}:${l.글}`), ['상대:이름이 뭐예요?', '나:저는 볼로르예요.', '나:몽골에서 왔어요.네.', '상대:와, 몽골에서요?']);
});

test('자막: Realtime은 취소된 응답 자막을 지우고 학습자 자리를 늦게 채운다', () => {
  const z = 자막모음();
  const 넣기 = (e) => { const s = 공급사표['realtime-mini'].자막(e); if (s) z.넣기(s); };
  넣기({ type: 'response.output_audio_transcript.delta', delta: '안녕하세요!', response_id: 'r1' });
  넣기({ type: 'input_audio_buffer.speech_started', item_id: 'i1' });
  넣기({ type: 'response.output_audio_transcript.delta', delta: '아, 네', response_id: 'r2' });
  넣기({ type: 'response.done', response: { id: 'r2', status: 'cancelled' } });
  넣기({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: '저는 뚜자라고 합니다. 잘 부탁드립니다.' });
  넣기({ type: 'response.output_audio_transcript.delta', delta: '반가워요!', response_id: 'r3' });
  assert.deepEqual(z.보낼것().map((l) => `${l.누가}:${l.글}`), ['상대:안녕하세요!', '나:저는 뚜자라고 합니다. 잘 부탁드립니다.', '상대:반가워요!']);
});

test('피드백 검사: 전사에 없는 내 말 · 설명의 발음/감정 추론 · 개수 초과를 버리고, 인용 속 「기분」은 둔다', () => {
  const 전사 = [{ 누가: '상대', 글: '이름이 뭐예요?' }, { 누가: '나', 글: '저는 볼로르예요. 오늘 기분이 좋아요.' }, { 누가: '나', 글: '몽골에서 왔어요' }];
  const 출력 = {
    미션: [{ id: '이름', 해냄: true, 근거: '저는 볼로르예요' }, { id: '나라', 해냄: true, 근거: '중국에서 왔어요' }, { id: '없는미션', 해냄: true, 근거: '' }],
    잘한말: [{ 말: '오늘 기분이 좋아요', 왜: '감정을 잘 말했어요' }, { 말: '저는 볼로르예요', 왜: '이름을 또렷이 말했어요' }],
    고칠말: [{ 내말: '몽골에서 왔어요', 고친말: '몽골에서 왔어요!', 왜: '발음이 조금 흐렸어요' }, { 내말: '없던 말', 고친말: '고친 말', 왜: '문법' }],
    써볼말: ['기분이 좋아요!', '사인해 주세요.', '셋째'],
    한마디: '긴장해 보였지만 잘했어요',
  };
  const r = 검사(팬사인회, 출력, 전사);
  assert.deepEqual(r.미션.filter((m) => m.해냄).map((m) => m.id), ['이름']);
  assert.equal(r.미션.length, 팬사인회.미션.length);
  assert.deepEqual(r.잘한말.map((x) => x.말), ['저는 볼로르예요']); // 「감정을 잘 말했어요」 설명은 감정 낱말이라 버림
  assert.equal(r.고칠말.length, 0); // 발음 설명 · 전사에 없는 말
  assert.deepEqual(r.써볼말, ['기분이 좋아요!', '사인해 주세요.']);
  assert.equal(r.한마디, '');
});

// ── 서버 길: 가짜 OpenAI로 연결 · 끝 · 거절 ──
function 가짜OpenAI(처리) {
  return new Promise((res) => {
    const 받은 = [];
    const s = http.createServer((req, rq) => {
      let 몸 = '';
      req.on('data', (c) => { 몸 += c; });
      req.on('end', () => { 받은.push({ 주소: req.url, 머리: req.headers, 몸 }); 처리(req, rq, 몸); });
    });
    s.listen(0, '127.0.0.1', () => res({ s, 받은, 주소: `http://127.0.0.1:${s.address().port}/v1` }));
  });
}
async function 띄우기(옵션) {
  const { 서버만들기 } = await import('../experiences/realtime-roleplay/server.mjs');
  const s = 서버만들기({ 기록: () => {}, ...옵션 });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const 바탕 = `http://127.0.0.1:${s.address().port}`;
  const 보내기 = (길, 몸, 출처 = 바탕) => fetch(`${바탕}${길}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 출처 }, body: JSON.stringify(몸) });
  return { s, 바탕, 보내기 };
}

test('서버: GPT-Live 세션 몸통 · 15초 선과금 · 끝 장부 · 피드백, 키 값은 어디에도 없다', async (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '상황극-'));
  const 키파일 = path.join(폴더, 'k.txt');
  fs.writeFileSync(키파일, 'sk-fakekeyvalue-must-not-leak'); // 머리에 실리므로 ASCII만
  const 가짜 = await 가짜OpenAI((req, res, 몸) => {
    if (req.url === '/v1/live/sessions') { res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ session: { id: 'live_t1' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' } })); return; }
    if (req.url === '/v1/responses') {
      const 출력 = { 미션: [{ id: '이름', 해냄: true, 근거: '저는 볼로르예요' }], 잘한말: [], 고칠말: [], 써볼말: ['사인해 주세요.'], 한마디: '잘했어요!' };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(출력) }] }], usage: { input_tokens: 1000, output_tokens: 200 } }));
      return;
    }
    res.writeHead(404).end('{}');
  });
  const 원래 = { base: process.env.SYNK_OPENAI_BASE, key: process.env.OPENAI_KEY_FILE };
  process.env.SYNK_OPENAI_BASE = 가짜.주소;
  process.env.OPENAI_KEY_FILE = 키파일;
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => { s.close(); 가짜.s.close(); process.env.SYNK_OPENAI_BASE = 원래.base; process.env.OPENAI_KEY_FILE = 원래.key; });

  assert.equal((await 보내기('/api/연결', { sdp: 'v=0\r\noffer' }, 'http://evil.example')).status, 403);
  const 연 = await 보내기('/api/연결', { sdp: 'v=0\r\noffer' });
  assert.equal(연.status, 201);
  const 연몸 = await 연.json();
  assert.equal(연몸.길, 'gpt-live');
  assert.equal(연몸.세션, 'live_t1');
  const 세션요청 = JSON.parse(가짜.받은[0].몸);
  assert.equal(세션요청.session.model, 'gpt-live-1');
  assert.deepEqual(세션요청.session.delegation, { type: 'client' });
  assert.equal(세션요청.session.audio.output.voice, 'cedar');
  assert.equal(세션요청.transport.sdp, 'v=0\r\noffer');
  assert.match(가짜.받은[0].머리.authorization, /^Bearer sk-/);

  const 끝 = await 보내기('/api/끝', { 길: 'gpt-live', 세션: 'live_t1', 초: 75, 끝확인: true, 전사: [{ 누가: '상대', 글: '이름이 뭐예요?' }, { 누가: '나', 글: '저는 볼로르예요.' }] });
  assert.equal(끝.status, 200);
  const 끝몸 = await 끝.json();
  assert.deepEqual(끝몸.피드백.미션.filter((m) => m.해냄).map((m) => m.id), ['이름']);
  assert.equal((await 보내기('/api/끝', { 길: 'gpt-live', 세션: 'live_t1', 초: 75 })).status, 409); // 두 번 끝내기
  const 줄들 = 장부읽기(장부);
  const 합 = 줄들.filter((r) => r.세션 === 'live_t1').reduce((n, r) => n + r.USD, 0);
  assert.ok(Math.abs(합 - gptLive값(75)) < 1e-6, `세션 값 ${합}`);
  const 피드백요청 = JSON.parse(가짜.받은.find((r) => r.주소 === '/v1/responses').몸);
  assert.equal(피드백요청.safety_identifier, 'synk-realtime-roleplay-local-prototype');
  for (const 글 of [JSON.stringify(연몸), JSON.stringify(끝몸), fs.readFileSync(장부, 'utf8')]) assert.ok(!글.includes('fakekeyvalue'));
});

test('서버: 예산 95% 넘으면 연결은 글 길(409), 크레딧 바닥이면 장부에 적고 글 길', async (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '상황극-'));
  const 키파일 = path.join(폴더, 'k.txt');
  fs.writeFileSync(키파일, 'sk-test');
  const 가짜 = await 가짜OpenAI((req, res) => { res.writeHead(429, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'credit_balance_exhausted' } })); });
  const 원래 = { base: process.env.SYNK_OPENAI_BASE, key: process.env.OPENAI_KEY_FILE };
  process.env.SYNK_OPENAI_BASE = 가짜.주소;
  process.env.OPENAI_KEY_FILE = 키파일;
  const 장부 = path.join(폴더, '장부.jsonl');
  fs.writeFileSync(장부, `${JSON.stringify({ 때: new Date().toISOString(), 무엇: '세션', 길: 'gpt-live', USD: 9.6 })}\n`);
  const 높음 = await 띄우기({ 장부, 예산USD: 10 });
  const 낮음 = await 띄우기({ 장부: path.join(폴더, '빈장부.jsonl'), 예산USD: 10 });
  t.after(() => { 높음.s.close(); 낮음.s.close(); 가짜.s.close(); process.env.SYNK_OPENAI_BASE = 원래.base; process.env.OPENAI_KEY_FILE = 원래.key; });
  const r1 = await 높음.보내기('/api/연결', { sdp: 'v=0\r\noffer' });
  assert.equal(r1.status, 409);
  assert.equal((await r1.json()).길, '글');
  assert.equal(가짜.받은.length, 0);
  const r2 = await 낮음.보내기('/api/연결', { sdp: 'v=0\r\noffer' });
  assert.equal(r2.status, 409);
  assert.equal((await r2.json()).까닭, '크레딧 바닥');
  assert.ok(장부읽기(path.join(폴더, '빈장부.jsonl')).some((r) => r.무엇 === '크레딧바닥'));
});
