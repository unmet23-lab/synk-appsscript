// 실시간 음성 상황극 시제품(experiences/realtime-roleplay) — 예산 계량기 · 자막 모음 · 피드백 검사 · 서버 길(가짜 OpenAI · 가짜 Gemini) · 답 은행 길(Zoe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

// 이 노트북의 진짜 Gemini 무료 키 · 진짜 주소에 닿지 않게 — 키 경로는 없는 파일, 바탕은 닫힌 포트(Gemini 시험만 가짜로 바꾼다)
process.env.GEMINI_KEY_PATH_FREE = path.join(os.tmpdir(), '실시간상황극-시험-없는-제미나이키.txt');
process.env.SYNK_GEMINI_BASE = 'http://127.0.0.1:9/v1beta';
import { 계량, gptLive값, gemini값, 주기, 장부읽기 } from '../experiences/realtime-roleplay/lib/예산.mjs';
import { 자막모음, 공급사표, wav만들기 } from '../experiences/realtime-roleplay/public/연결층.mjs';
import { 답짓기, 침묵도움, 시간마무리, 소리폴더, 듣기모델들, 듣고고르기, 은행 } from '../experiences/realtime-roleplay/lib/답은행.mjs';
import { 제미나이부르기 } from '../experiences/realtime-roleplay/lib/공급사.mjs';
import { 검사 } from '../experiences/realtime-roleplay/lib/피드백.mjs';
import { 팬사인회 } from '../experiences/realtime-roleplay/lib/장면.mjs';
import { 키차례 } from '../experiences/realtime-roleplay/lib/오픈AI키.mjs';

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

test('예산: Gemini 무료 키가 있으면 예산 비율과 상관없이 gemini-live, 몫바닥 뒤 10분만 OpenAI 길', () => {
  const 몫 = (분전) => ({ 때: new Date(지금 - 분전 * 60e3).toISOString(), 무엇: '몫바닥', 길: 'gemini-live', USD: 0 });
  assert.equal(계량({ 줄들: [], 예산USD: 100, 지금, 제미나이: true }).길, 'gemini-live');
  assert.equal(계량({ 줄들: [], 예산USD: 100, 지금 }).길, 'gpt-live'); // 키 없음 → 지금 규칙
  assert.equal(계량({ 줄들: [줄(99)], 예산USD: 100, 지금, 제미나이: true }).길, 'gemini-live'); // 0원 길이라 예산을 넘겨도
  const 막힘 = 계량({ 줄들: [몫(3)], 예산USD: 100, 지금, 제미나이: true });
  assert.equal(막힘.길, 'gpt-live');
  assert.equal(Date.parse(막힘.제미나이.몫막힘까지), 지금 + 7 * 60e3);
  assert.equal(계량({ 줄들: [몫(3), 줄(96)], 예산USD: 100, 지금, 제미나이: true }).길, '글'); // 막힌 동안은 지금 규칙 그대로
  assert.equal(계량({ 줄들: [몫(11)], 예산USD: 100, 지금, 제미나이: true }).길, 'gemini-live'); // 10분 지나면 다시 먼저
  assert.equal(계량({ 줄들: [{ ...몫(3), 길: 'gpt-live' }], 예산USD: 100, 지금, 제미나이: true }).길, 'gemini-live'); // 다른 길의 줄은 상관없음
});

test('예산: Gemini 유료였다면 값은 생각 토큰을 글 출력 값으로 센다', () => {
  const 백만 = 1e6;
  assert.ok(Math.abs(gemini값({ 글입력: 백만, 음성입력: 백만, 글출력: 백만, 음성출력: 백만, 생각: 백만 }) - (0.75 + 3 + 4.5 + 12 + 4.5)) < 1e-9);
  assert.equal(gemini값({}), 0);
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

test('자막: Gemini는 말 시작 자리에 늦게 온 받아쓰기를 채우고, 끊긴 답(interrupted)은 지운다', () => {
  const z = 자막모음();
  const 표 = 공급사표['gemini-live'];
  const 넣기 = (e, 응답 = null, 활동 = 0) => { for (const s of 표.자막({ ...e, 응답, 활동 })) z.넣기(s); };
  넣기({ serverContent: { outputTranscription: { text: '안녕하세요! 이름이' } } }, 1);
  넣기({ serverContent: { outputTranscription: { text: ' 뭐예요?' } } }, 1);
  넣기({ voiceActivity: { type: 'ACTIVITY_START' } }, null, 1);
  넣기({ serverContent: { outputTranscription: { text: '아, 네' } } }, 2, 1); // 학습자 쉼에 시작한 답 → 끊김
  넣기({ serverContent: { interrupted: true } }, 2, 1);
  // 받아쓰기는 말이 끝날 때 다음 답 자막과 같은 메시지로 온다 — 받아쓰기가 먼저(답보다 앞 자리)
  넣기({ serverContent: { inputTranscription: { text: '저는 볼로르예요.' }, outputTranscription: { text: '볼로르 씨, 반가워요!' } } }, 3, 1);
  넣기({ voiceActivity: { type: 'ACTIVITY_START' } }, null, 2); // 받아쓰기가 끝내 안 온 자리(바탕 소리)는 보낼 것에서 빠진다
  assert.deepEqual(z.보낼것().map((l) => `${l.누가}:${l.글}`), ['상대:안녕하세요! 이름이 뭐예요?', '나:저는 볼로르예요.', '상대:볼로르 씨, 반가워요!']);
});

test('자막: Gemini 답 조각은 사이에 학습자 자리가 끼어도 그 답 줄에 붙고, 말 시작 신호가 없으면 받아쓰기를 그 답 앞에 둔다', () => {
  const z = 자막모음();
  const 표 = 공급사표['gemini-live'];
  const 넣기 = (e, 응답 = null, 활동 = 0) => { for (const s of 표.자막({ ...e, 응답, 활동 })) z.넣기(s); };
  넣기({ serverContent: { outputTranscription: { text: '이름이' } } }, 1);
  넣기({ voiceActivity: { type: 'ACTIVITY_START' } }, 1, 1); // 메아리 · 소음으로 생긴 가짜 말 시작
  넣기({ serverContent: { outputTranscription: { text: ' 뭐예요?' } } }, 1, 1);
  z.빈자리지우기();
  // voiceActivity 없이 받아쓰기가 다음 답과 같이 온 판 — 답 2가 먼저 줄을 만든 뒤 받아쓰기가 와도 답 앞에
  넣기({ serverContent: { outputTranscription: { text: '반가워요!' } } }, 2, 1);
  넣기({ serverContent: { inputTranscription: { text: '볼로르' } } }, 2, 0);
  넣기({ serverContent: { inputTranscription: { text: '예요.' } } }, 2, 0);
  assert.deepEqual(z.보낼것().map((l) => `${l.누가}:${l.글}`), ['상대:이름이 뭐예요?', '나:볼로르예요.', '상대:반가워요!']);
  assert.equal(z.줄들.length, 3);
});

test('Gemini 표: 몫 닫힘만 몫으로 보고(토큰 재사용은 아님), 사용은 차례마다 모달리티별로 더한다', () => {
  const 표 = 공급사표['gemini-live'];
  assert.equal(표.몫인가('You exceeded your current quota, please check your plan'), true);
  assert.equal(표.몫인가('RESOURCE_EXHAUSTED'), true);
  assert.equal(표.몫인가('Token has been used too many times'), false);
  assert.equal(표.몫인가(''), false);
  const 합 = { 글입력: 0, 음성입력: 0, 글출력: 0, 음성출력: 0, 생각: 0, 차례: 0 };
  표.사용더하기(합, { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 327 }, { modality: 'AUDIO', tokenCount: 168 }], responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 42 }], thoughtsTokenCount: 42 });
  표.사용더하기(합, { promptTokensDetails: [{ modality: 'TEXT', tokenCount: 10 }], responseTokensDetails: [{ modality: 'TEXT', tokenCount: 5 }] });
  assert.deepEqual(합, { 글입력: 337, 음성입력: 168, 글출력: 5, 음성출력: 42, 생각: 42, 차례: 2 });
  assert.deepEqual(표.마무리('마무리 지시').clientContent.turnComplete, false); // 대화를 멈추지 않는 꼴(10-30 실측)
  assert.deepEqual(표.첫인사('인사 지시').clientContent.turnComplete, true);
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
  const 물음 = await 보내기('/api/연결', {}); // 화면은 SDP 없이 먼저 길을 묻는다 → WebRTC 길이면 428
  assert.equal(물음.status, 428);
  assert.deepEqual((({ 길, 필요 }) => ({ 길, 필요 }))(await 물음.json()), { 길: 'gpt-live', 필요: 'sdp' });
  assert.equal(가짜.받은.length, 0);
  const 연 = await 보내기('/api/연결', { sdp: 'v=0\r\noffer', 길: 'gpt-live' });
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

// ── Gemini 길: 가짜 Gemini(SYNK_GEMINI_BASE)로 임시 토큰 · 장부 · 몫 넘김 ──
async function 제미나이준비(t, 처리) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '상황극-'));
  const 키파일 = path.join(폴더, 'g.txt');
  fs.writeFileSync(키파일, 'AIzaFakeGeminiKeyMustNotLeak');
  const 가짜 = await 가짜OpenAI(처리);
  const 원래 = { key: process.env.GEMINI_KEY_PATH_FREE, base: process.env.SYNK_GEMINI_BASE };
  process.env.GEMINI_KEY_PATH_FREE = 키파일;
  process.env.SYNK_GEMINI_BASE = 가짜.주소.replace(/\/v1$/, '/v1beta');
  t.after(() => { 가짜.s.close(); process.env.GEMINI_KEY_PATH_FREE = 원래.key; process.env.SYNK_GEMINI_BASE = 원래.base; });
  return { 폴더, 가짜 };
}
const 토큰답 = (이름) => (req, res) => {
  if (req.url === '/v1beta/auth_tokens') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: 이름 })); return; }
  res.writeHead(404).end('{}');
};

test('서버: Gemini 기본 길 — 1회용 토큰(만료 둘 · 설정 잠금 · Kore) · 키는 머리로만 · 응답 · 장부에 키 없음 · 0원 장부 + 유료였다면', async (t) => {
  const { 폴더, 가짜 } = await 제미나이준비(t, 토큰답('auth_tokens/fake-token-1'));
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 바탕, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => s.close());

  const 상태 = await (await fetch(`${바탕}/api/상태`)).json();
  assert.equal(상태.계량.길, 'gemini-live');
  const 연 = await 보내기('/api/연결', {});
  assert.equal(연.status, 201);
  const 연몸 = await 연.json();
  assert.equal(연몸.길, 'gemini-live');
  assert.equal(연몸.운반, 'websocket');
  assert.equal(연몸.토큰, 'auth_tokens/fake-token-1');
  assert.match(연몸.소켓, /^wss:\/\/generativelanguage\.googleapis\.com\/ws\/google\.ai\.generativelanguage\.v1beta\.GenerativeService\.BidiGenerateContentConstrained$/);
  assert.match(연몸.세션, /^gem_[0-9a-f]{18}$/);
  assert.equal(연몸.설정.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
  assert.match(연몸.첫인사, /안녕하세요/);
  const 토큰요청 = 가짜.받은[0];
  assert.equal(토큰요청.주소, '/v1beta/auth_tokens');
  assert.equal(토큰요청.머리['x-goog-api-key'], 'AIzaFakeGeminiKeyMustNotLeak');
  const 몸 = JSON.parse(토큰요청.몸);
  assert.equal(몸.uses, 1);
  const 새세션 = Date.parse(몸.newSessionExpireTime) - Date.now();
  assert.ok(새세션 > 30e3 && 새세션 <= 61e3, `newSessionExpireTime ${새세션}`);
  const 만료 = Date.parse(몸.expireTime) - Date.now();
  assert.ok(만료 > (팬사인회.상한초 + 60) * 1000 && 만료 <= (팬사인회.상한초 + 181) * 1000, `expireTime ${만료}`);
  assert.deepEqual(몸.bidiGenerateContentSetup, 연몸.설정); // 토큰에 잠근 setup = 브라우저가 보낼 setup
  assert.equal(몸.bidiGenerateContentSetup.model, 'models/gemini-3.8-live');
  assert.match(몸.bidiGenerateContentSetup.systemInstruction.parts[0].text, /너는 하온이다/);
  assert.deepEqual(몸.bidiGenerateContentSetup.realtimeInputConfig.automaticActivityDetection, { endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', silenceDurationMs: 1000 });
  assert.deepEqual(몸.bidiGenerateContentSetup.inputAudioTranscription, {});

  const 사용 = { 글입력: 1000, 음성입력: 2000, 글출력: 100, 음성출력: 3000, 생각: 200, 차례: 4, 이상한칸: 'x' };
  const 끝 = await 보내기('/api/끝', { 길: 'gemini-live', 세션: 연몸.세션, 초: 50, 사용, 끝확인: true, 피드백없이: true, 전사: [] });
  assert.equal(끝.status, 200);
  const 끝몸 = await 끝.json();
  assert.equal((await 보내기('/api/끝', { 길: 'gemini-live', 세션: 연몸.세션, 초: 50 })).status, 409); // 두 번 끝내기
  const 줄들 = 장부읽기(장부).filter((r) => r.세션 === 연몸.세션);
  assert.deepEqual(줄들.map((r) => [r.무엇, r.USD]), [['세션시작', 0], ['세션', 0]]);
  assert.ok(Math.abs(줄들[1].유료였다면USD - gemini값(사용)) < 1e-6);
  assert.equal(줄들[1].등급, '무료');
  assert.equal(줄들[1].사용.이상한칸, undefined);
  assert.equal(끝몸.계량.쓴값, 0);
  for (const 글 of [JSON.stringify(상태), JSON.stringify(연몸), JSON.stringify(끝몸), fs.readFileSync(장부, 'utf8')]) assert.ok(!글.includes('AIzaFake'));
});

test('서버: Gemini 토큰 429면 몫바닥을 적고 GPT-Live로(428 SDP 요청) · 길 고정이면 넘기지 않음 · 몫쉼 동안은 토큰을 다시 안 만듦', async (t) => {
  const { 폴더, 가짜 } = await 제미나이준비(t, (req, res) => {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }));
  });
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => s.close());
  const r1 = await 보내기('/api/연결', {});
  assert.equal(r1.status, 428);
  assert.deepEqual((({ 길, 필요, 까닭 }) => ({ 길, 필요, 까닭 }))(await r1.json()), { 길: 'gpt-live', 필요: 'sdp', 까닭: 'Gemini 무료 몫' });
  assert.ok(장부읽기(장부).some((r) => r.무엇 === '몫바닥' && r.길 === 'gemini-live'));
  const r2 = await 보내기('/api/연결', {});
  assert.equal(r2.status, 428);
  assert.equal((await r2.json()).길, 'gpt-live');
  assert.equal(가짜.받은.length, 1); // 몫쉼 동안은 Gemini에 다시 묻지 않는다
  const r3 = await 보내기('/api/연결', { 길: 'gemini-live' }); // 시험용 길 고정은 넘기지 않고 알린다
  assert.equal(r3.status, 429);
  assert.equal((await 보내기('/api/연결', { 길: 'gpt-live' })).status, 428); // WebRTC 길은 SDP가 있어야 연다
});

test('서버: 화면이 소켓 몫 닫힘을 알리면(/api/넘김 몫) 그 세션을 닫고 다음 연결은 GPT-Live', async (t) => {
  const { 폴더 } = await 제미나이준비(t, 토큰답('auth_tokens/fake-token-2'));
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => s.close());
  const 연몸 = await (await 보내기('/api/연결', {})).json();
  assert.equal(연몸.길, 'gemini-live');
  assert.equal((await 보내기('/api/넘김', { 세션: 연몸.세션, 까닭: 'You exceeded your current quota', 몫: true })).status, 200);
  assert.equal((await 보내기('/api/넘김', {}, 'http://evil.example')).status, 403);
  const 줄들 = 장부읽기(장부);
  assert.ok(줄들.some((r) => r.무엇 === '몫바닥' && /quota/.test(r.까닭)));
  assert.ok(줄들.some((r) => r.무엇 === '세션' && r.세션 === 연몸.세션 && r.USD === 0));
  assert.equal((await 보내기('/api/끝', { 길: 'gemini-live', 세션: 연몸.세션, 초: 3 })).status, 409);
  const 다음 = await 보내기('/api/연결', {});
  assert.equal(다음.status, 428);
  assert.equal((await 다음.json()).길, 'gpt-live');
});

test('서버: Gemini 토큰이 몫 말고 다른 까닭으로 실패하면 연결실패 줄만 적고(몫쉼 없음) 이번 연결은 GPT-Live로, 길 고정이면 502', async (t) => {
  const { 폴더 } = await 제미나이준비(t, (req, res) => { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":403,"status":"PERMISSION_DENIED"}}'); });
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => s.close());
  const r1 = await 보내기('/api/연결', {});
  assert.equal(r1.status, 428);
  const r1몸 = await r1.json();
  assert.deepEqual([r1몸.길, r1몸.까닭], ['gpt-live', 'Gemini 연결 실패']);
  const 줄들 = 장부읽기(장부);
  assert.ok(줄들.some((r) => r.무엇 === '연결실패' && r.길 === 'gemini-live'));
  assert.ok(!줄들.some((r) => r.무엇 === '몫바닥'));
  assert.equal(r1몸.계량.제미나이.몫막힘까지, null);
  assert.equal((await 보내기('/api/연결', { 길: 'gemini-live' })).status, 502);
});

test('서버: 화면이 준비 전 실패를 알리고 Gemini를 빼고 다시 열면(제외) GPT-Live, 그다음 연결은 다시 Gemini · 버려진 Gemini 세션은 0원으로 닫힌다', async (t) => {
  const { 폴더 } = await 제미나이준비(t, 토큰답('auth_tokens/fake-token-3'));
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => s.close());
  const 첫 = await (await 보내기('/api/연결', {})).json();
  assert.equal(첫.길, 'gemini-live');
  assert.match(첫.작별, /다음에 또 만나요/);
  assert.match(첫.도움, /8초/);
  assert.equal((await 보내기('/api/넘김', { 세션: 첫.세션, 까닭: 'Gemini 연결이 열리지 않았어요: 연결이 닫혔어요(1006)', 몫: false })).status, 200);
  const 빼고 = await 보내기('/api/연결', { 제외: 'gemini-live' });
  assert.equal(빼고.status, 428);
  assert.equal((await 빼고.json()).길, 'gpt-live');
  const 다시 = await (await 보내기('/api/연결', {})).json(); // 연결실패는 몫쉼이 없다 — 다음은 다시 Gemini
  assert.equal(다시.길, 'gemini-live');
  const 셋째 = await (await 보내기('/api/연결', {})).json(); // 끝 보고 없이 새 연결 → 앞 Gemini 세션은 0원으로 닫힘
  assert.equal(셋째.길, 'gemini-live');
  const 닫힌 = 장부읽기(장부).filter((r) => r.무엇 === '세션' && r.세션 === 다시.세션);
  assert.deepEqual(닫힌.map((r) => [r.USD, r.끝확인, r.등급]), [[0, false, '무료']]);
  assert.ok(장부읽기(장부).some((r) => r.무엇 === '연결실패' && /1006/.test(r.까닭)));
});

test('OpenAI 키: 상황극 전용 목록 다음에 일반 목록을 잇고(같은 키 파일은 한 번) 「까지」 날부터 그 키를 뺀다', (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '상황극키목록-'));
  const 원래 = process.env.OPENAI_KEY_FILE;
  delete process.env.OPENAI_KEY_FILE;
  t.after(() => { fs.rmSync(폴더, { recursive: true, force: true }); if (원래 !== undefined) process.env.OPENAI_KEY_FILE = 원래; });
  const 전용 = path.join(폴더, '전용.json');
  const 일반 = path.join(폴더, '일반.json');
  fs.writeFileSync(전용, JSON.stringify([{ 이름: '상황극', 파일: 'a.txt' }]));
  fs.writeFileSync(일반, JSON.stringify([{ 이름: '본', 파일: 'b.txt' }, { 이름: '옛', 파일: 'c.txt', 까지: '2026-11-12' }, { 이름: '겹침', 파일: 'a.txt' }]));
  const 전날밤 = Date.parse('2026-11-11T23:59:00+09:00');
  const 그날 = Date.parse('2026-11-12T00:00:00+09:00');
  assert.deepEqual(키차례([전용, 일반], 전날밤).map((k) => k.이름), ['상황극', '본', '옛']);
  assert.deepEqual(키차례([전용, 일반], 그날).map((k) => k.이름), ['상황극', '본']);
  assert.equal(키차례([전용, 일반], 전날밤)[0].파일, path.join(폴더, 'a.txt'));
  assert.deepEqual(키차례([path.join(폴더, '없음.json'), 일반], 그날).map((k) => k.이름), ['본', '겹침']); // 전용 목록이 없으면 일반만
  assert.equal(키차례([path.join(폴더, '없음.json')], 그날)[0].이름, 'openai.txt');
  assert.deepEqual(키차례(일반, 그날).map((k) => k.이름), ['본', '겹침']); // 파일 하나를 주던 옛 부름도 그대로
});

test('서버: 끝 보고의 끊긴 까닭 · 사건 기록 꼬리는 세션 줄에 남고(토큰 가림 · 40개 · 한 줄 120자), 안 주면 칸도 없다', async (t) => {
  const { 폴더 } = await 제미나이준비(t, 토큰답('auth_tokens/fake-token-4'));
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => s.close());
  const 첫 = await (await 보내기('/api/연결', {})).json();
  const 닫힘 = 'ws:close(1007 Request contains an invalid argument.)@2347';
  const 기록 = [...Array.from({ length: 45 }, (_, i) => `voice:ACTIVITY_START@${i}`), 닫힘, '연결실패(wss://x?access_token=비밀값)@9', 'x'.repeat(300), 42];
  const r = await 보내기('/api/끝', { 길: 'gemini-live', 세션: 첫.세션, 초: 0, 끝확인: false, 까닭: '1007 Request contains an invalid argument.', 기록, 전사: [] });
  assert.equal(r.status, 200);
  const 줄 = 장부읽기(장부).find((x) => x.무엇 === '세션' && x.세션 === 첫.세션);
  assert.equal(줄.까닭, '1007 Request contains an invalid argument.');
  assert.equal(줄.기록.length, 40);
  assert.ok(줄.기록.includes(닫힘));
  assert.ok(줄.기록.every((x) => x.length <= 120));
  assert.ok(!JSON.stringify(줄).includes('비밀값'));
  const 둘째 = await (await 보내기('/api/연결', {})).json();
  assert.equal((await 보내기('/api/끝', { 길: 'gemini-live', 세션: 둘째.세션, 초: 30, 끝확인: true, 전사: [] })).status, 200);
  const 줄2 = 장부읽기(장부).find((x) => x.무엇 === '세션' && x.세션 === 둘째.세션);
  assert.ok(!('까닭' in 줄2) && !('기록' in 줄2));
});

// ── 답 은행 길(Zoe 녹음 답, 11-02): 가짜 Gemini가 학습자 WAV를 듣고 고른 것처럼 답한다 ──
const 제미나이글답 = (res, 출력, 사용 = { promptTokenCount: 900, candidatesTokenCount: 40 }) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(출력) }] } }], usageMetadata: 사용 }));
};
const 작은wav = () => Buffer.from(wav만들기([new Int16Array(1600).map((_, i) => Math.round(Math.sin(i / 8) * 8000))]));
const 환경되돌림 = (k, v) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };

test('답 은행: WAV는 16k 모노 PCM16 머리, 고를 수 있는 반응 · 되묻기 · 침묵 도움 · 시간 마무리가 내는 줄은 모두 Zoe 소리가 있다', () => {
  const w = Buffer.from(wav만들기([new Int16Array([1, -2]), new Int16Array([32767])]));
  assert.equal(w.toString('ascii', 0, 4), 'RIFF');
  assert.equal(w.toString('ascii', 8, 12), 'WAVE');
  assert.deepEqual([w.readUInt16LE(22), w.readUInt32LE(24), w.readUInt16LE(34), w.readUInt32LE(40)], [1, 16000, 16, 6]);
  assert.deepEqual([w.readInt16LE(44), w.readInt16LE(46), w.readInt16LE(48)], [1, -2, 32767]);

  const 쓴소리 = new Set();
  let 셈 = 0;
  for (const 순간 of ['처음', '나라', '좋아함', '사인', '끝', '작별뒤']) {
    const ids = 은행.고를반응(순간).map((r) => r.id);
    for (const a of ids) for (const b of [null, ...ids]) for (const 변형 of [0, 1]) for (const 들은 of [[], ['이름', '나라', '좋아함']]) {
      for (const c of 답짓기(순간, { 판단: '고름', 반응: b ? [a, b] : [a], 들은것: 들은 }, 변형).조각) 쓴소리.add(c.소리); // 목록에 없는 줄이면 소리찾기가 던진다
      셈 += 1;
    }
    for (const 변형 of [0, 1, 2]) {
      for (const c of [...답짓기(순간, { 판단: '되묻기' }, 변형).조각, ...침묵도움(순간, 변형).조각]) 쓴소리.add(c.소리);
    }
    for (const c of 시간마무리(순간).조각) 쓴소리.add(c.소리);
  }
  assert.ok(셈 > 10000, `조합 ${셈}`);
  for (const 소리 of 쓴소리) assert.ok(fs.existsSync(path.join(소리폴더, path.basename(소리))), 소리);
  // 끝 · 작별뒤 되묻기 줄은 그 자체가 작별 인사라 다음 순간으로, 사인을 다 해 준 끝에서 조용하면 기다리지 않고 작별로
  assert.equal(답짓기('끝', { 판단: '되묻기' }).다음순간, '작별뒤');
  assert.equal(답짓기('작별뒤', { 판단: '되묻기' }).다음순간, '끝남');
  assert.equal(답짓기('나라', { 판단: '되묻기' }).다음순간, '나라');
  assert.deepEqual(침묵도움('끝').조각.map((c) => c.글), ['오늘 와 줘서 진짜 고마워요. 다음에 또 만나요, 약속!']);
  assert.equal(침묵도움('끝').다음순간, '작별뒤');
  assert.deepEqual(침묵도움('작별뒤').조각, []);
  assert.deepEqual(시간마무리('끝남').조각, []);
});

test('서버: 답 은행 길 — 연결 · Zoe 소리 · 차례(가짜 Gemini가 WAV를 듣고 고름) · 몫 찬 되묻기 · 침묵 도움 · 시간 마무리 · 작별 · 장부(받아 적은 글 · 키 없음) · Gemini 돌아보기', async (t) => {
  let 답할것 = null;
  let 몫찼음 = false;
  const { 폴더, 가짜 } = await 제미나이준비(t, (req, res) => {
    if (!/^\/v1beta\/models\/[^/]+:generateContent$/.test(req.url)) { res.writeHead(404).end('{}'); return; }
    if (몫찼음) { res.writeHead(429, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } })); return; }
    제미나이글답(res, 답할것);
  });
  // 돌아보기 — OpenAI는 크레딧 바닥(429 credit_balance_exhausted) → 같은 지시로 Gemini 무료 등급
  const 키파일 = path.join(폴더, 'k.txt');
  fs.writeFileSync(키파일, 'sk-test');
  const 오픈 = await 가짜OpenAI((req, res) => { res.writeHead(429, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'credit_balance_exhausted' } })); });
  const 원래 = { base: process.env.SYNK_OPENAI_BASE, key: process.env.OPENAI_KEY_FILE };
  process.env.SYNK_OPENAI_BASE = 오픈.주소;
  process.env.OPENAI_KEY_FILE = 키파일;
  const 장부 = path.join(폴더, '장부.jsonl');
  const { s, 바탕, 보내기 } = await 띄우기({ 장부, 예산USD: 50 });
  t.after(() => { s.close(); 오픈.s.close(); 환경되돌림('SYNK_OPENAI_BASE', 원래.base); 환경되돌림('OPENAI_KEY_FILE', 원래.key); });
  const 차례 = (세션, 몸 = 작은wav(), 머리 = {}) => fetch(`${바탕}/api/은행차례?세션=${encodeURIComponent(세션)}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav', Origin: 바탕, ...머리 }, body: 몸 });

  const 연 = await 보내기('/api/연결', { 길: '은행' });
  assert.equal(연.status, 201);
  const 연몸 = await 연.json();
  assert.equal(연몸.운반, '은행');
  assert.match(연몸.세션, /^bank_[0-9a-f]{18}$/);
  assert.match(연몸.첫인사.글, /이름이 뭐예요\?$/);
  assert.match(연몸.첫인사.소리, /^\/하온소리\/\d{3}\.mp3$/);
  assert.equal(가짜.받은.length, 0); // 여는 데는 Gemini를 부르지 않는다
  const 소리 = await fetch(`${바탕}${연몸.첫인사.소리}`);
  assert.equal(소리.status, 200);
  assert.equal(소리.headers.get('content-type'), 'audio/mpeg');
  assert.ok((await 소리.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(`${바탕}/하온소리/999.mp3`)).status, 404);
  assert.equal((await fetch(`${바탕}/하온소리/1.mp3`)).status, 404);

  // 거절: 다른 출처 · 없는 세션 · WAV 아님 · 소리 형 아님 — Gemini까지 가지 않는다
  assert.equal((await 차례(연몸.세션, 작은wav(), { Origin: 'http://evil.example' })).status, 403);
  assert.equal((await 차례('bank_없음')).status, 404);
  assert.equal((await 차례(연몸.세션, Buffer.from('x'.repeat(80)))).status, 400);
  assert.equal((await fetch(`${바탕}/api/은행차례?세션=${연몸.세션}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 바탕 }, body: '{}' })).status, 415);
  assert.equal(가짜.받은.length, 0);

  // 처음: 이름을 말함 → 이름 칭찬 + 나라 묻기, 순간 나라. 그 순간에 없는 반응 · 미션은 버린다
  답할것 = { 받아적기: '저는 바트예요', 판단: '고름', 반응: ['이름', '없는반응'], 들은것: ['이름', '이상한'], 확신: 0.9 };
  const wav = 작은wav();
  const r1 = await 차례(연몸.세션, wav);
  assert.equal(r1.status, 200);
  const 몸1 = await r1.json();
  assert.equal(몸1.받아적기, '저는 바트예요');
  assert.equal(몸1.순간, '나라');
  assert.equal(몸1.끝남, false);
  assert.equal(몸1.조각.at(-1).글, '어디에서 왔어요?');
  for (const c of 몸1.조각) assert.match(c.소리, /^\/하온소리\/\d{3}\.mp3$/);
  const 들음 = 가짜.받은[0];
  assert.equal(들음.주소, `/v1beta/models/${듣기모델들[0]}:generateContent`);
  assert.equal(들음.머리['x-goog-api-key'], 'AIzaFakeGeminiKeyMustNotLeak');
  const 들은몸 = JSON.parse(들음.몸);
  const 소리칸 = 들은몸.contents[0].parts.find((p) => p.inlineData).inlineData;
  assert.equal(소리칸.mimeType, 'audio/wav');
  assert.equal(소리칸.data, wav.toString('base64'));
  assert.ok(들은몸.generationConfig.responseSchema.properties.반응.items.enum.includes('나라.몽골'));
  assert.match(들은몸.contents[0].parts[0].text, /이름이 뭐예요/);

  // 침묵 도움 — 그 순간(나라)의 되묻기 줄, 순간 그대로
  const 도움 = await (await 보내기('/api/은행도움', { 세션: 연몸.세션 })).json();
  assert.deepEqual(도움.조각.map((c) => c.글), [은행.되묻기('나라')[0]]);
  assert.equal(도움.순간, '나라');

  // 모든 듣기 모델의 무료 몫이 차면 하온이 되묻고(순간 · 차례 그대로) 실패를 알린다 — Gemini Live 몫쉼(몫바닥 줄)에는 적지 않는다
  몫찼음 = true;
  const 앞수 = 가짜.받은.length;
  const 몸2 = await (await 차례(연몸.세션)).json();
  assert.equal(몸2.실패, 'Gemini 무료 몫');
  assert.equal(몸2.순간, '나라');
  assert.equal(몸2.조각.length, 1);
  assert.ok(은행.되묻기('나라').includes(몸2.조각[0].글));
  assert.equal(가짜.받은.length - 앞수, 듣기모델들.length);
  몫찼음 = false;

  // 시간 마무리 — 「아쉽지만 오늘은 시간이 다 됐어요.」 + 긴 마무리, 순간 작별뒤 · 두 번째는 빈 조각
  const 마 = await (await 보내기('/api/은행마무리', { 세션: 연몸.세션 })).json();
  assert.deepEqual(마.조각.map((c) => c.글), ['아쉽지만 오늘은 시간이 다 됐어요.', '오늘 와 줘서 진짜 고마워요. 다음에 또 만나요, 약속!']);
  assert.equal(마.순간, '작별뒤');
  assert.deepEqual((await (await 보내기('/api/은행마무리', { 세션: 연몸.세션 })).json()).조각, []);

  // 작별뒤: 작별 인사 → 하온 작별, 대화 끝 · 그 뒤 차례는 409
  답할것 = { 받아적기: '안녕히 계세요', 판단: '고름', 반응: ['끝.작별'], 들은것: ['끝인사'], 확신: 0.9 };
  const 몸3 = await (await 차례(연몸.세션)).json();
  assert.equal(몸3.순간, '끝남');
  assert.equal(몸3.끝남, true);
  assert.equal((await 차례(연몸.세션)).status, 409);

  // 끝 — 세션 줄(차례 수) · 돌아보기는 Gemini가 같은 스키마로(형 이름 대문자 · additionalProperties 없음), 출력은 같은 검사를 거친다
  답할것 = { 미션: [{ id: '이름', 해냄: true, 근거: '저는 바트예요' }, { id: '나라', 해냄: true, 근거: '몽골에서 왔어요' }], 잘한말: [{ 말: '저는 바트예요', 왜: '이름을 또렷하게 말했어요.' }], 고칠말: [], 써볼말: ['사인해 주세요.'], 한마디: '잘했어요!' };
  const 전사 = [{ 누가: '상대', 글: 연몸.첫인사.글 }, { 누가: '나', 글: '저는 바트예요' }, { 누가: '상대', 글: 몸1.조각.map((c) => c.글).join(' ') }, { 누가: '나', 글: '안녕히 계세요' }];
  const 끝 = await 보내기('/api/끝', { 길: '은행', 세션: 연몸.세션, 초: 41, 끝확인: true, 전사 });
  assert.equal(끝.status, 200);
  const 끝몸 = await 끝.json();
  assert.deepEqual(끝몸.피드백.미션.filter((m) => m.해냄).map((m) => m.id), ['이름']); // 나라 근거는 전사에 없어 버린다
  assert.equal(끝몸.피드백.한마디, '잘했어요!');
  assert.equal(오픈.받은.length, 1); // OpenAI를 먼저 해 봤다
  assert.equal(가짜.받은.at(-1).주소, '/v1beta/models/gemini-3.6-flash:generateContent');
  const 돌아보기요청 = JSON.parse(가짜.받은.at(-1).몸);
  const 스키마 = 돌아보기요청.generationConfig.responseSchema;
  assert.equal(스키마.type, 'OBJECT');
  assert.equal(스키마.additionalProperties, undefined);
  assert.equal(스키마.properties.미션.items.properties.id.type, 'STRING');
  assert.match(돌아보기요청.contents[0].parts[0].text, /나: 저는 바트예요/);
  assert.equal((await 보내기('/api/끝', { 길: '은행', 세션: 연몸.세션, 초: 41 })).status, 409);

  const 줄들 = 장부읽기(장부).filter((r) => r.세션 === 연몸.세션 || r.무엇 === '피드백');
  assert.deepEqual(줄들.map((r) => r.무엇), ['세션시작', '차례', '차례실패', '차례', '세션', '피드백']);
  const 세션줄 = 줄들.find((r) => r.무엇 === '세션');
  assert.deepEqual([세션줄.길, 세션줄.차례, 세션줄.초, 세션줄.USD, 세션줄.등급], ['은행', 2, 41, 0, '무료']);
  assert.deepEqual(줄들[1].반응, ['이름']);
  assert.deepEqual(줄들[1].순간, ['처음', '나라']);
  assert.deepEqual(줄들[1].사용, { 입력: 900, 출력: 40 });
  assert.deepEqual([줄들.at(-1).길, 줄들.at(-1).USD, 줄들.at(-1).등급], ['gemini-3.6-flash', 0, '무료']);
  assert.ok(!장부읽기(장부).some((r) => r.무엇 === '몫바닥'));
  const 장부글 = fs.readFileSync(장부, 'utf8');
  assert.ok(!장부글.includes('바트')); // 받아 적은 글 · 전사는 장부에 남기지 않는다
  for (const 글 of [JSON.stringify(연몸), JSON.stringify(몸1), JSON.stringify(몸2), JSON.stringify(끝몸), 장부글]) assert.ok(!글.includes('AIzaFake'));
});

test('답 은행: 사인은 사인 부탁 반응을 고른 차례에만 들은 것으로 치고, Gemini가 시한을 넘기면 다음 모델로 넘어간다', async (t) => {
  let 답할것 = null;
  const { 가짜 } = await 제미나이준비(t, (req, res) => {
    if (decodeURIComponent(req.url).includes('/models/느림:')) return; // 답하지 않는다 — 시한을 넘긴다
    제미나이글답(res, 답할것);
  });
  // 사진 부탁인데 들은것에 사인이 끼면 버린다(하온이 부탁받지 않은 사인을 「짠!」으로 끝내지 않게) — 다른 미션은 그대로
  답할것 = { 받아적기: '사진 같이 찍어도 돼요?', 판단: '고름', 반응: ['부탁.사진'], 들은것: ['사인', '좋아함'], 확신: 0.8 };
  const 사진 = await 듣고고르기('사인', 작은wav());
  assert.deepEqual(사진.들은것, ['좋아함']);
  assert.equal(답짓기('사인', 사진).다음순간, '사인');
  답할것 = { 받아적기: '사인해 주세요', 판단: '고름', 반응: ['부탁.사인'], 들은것: ['사인'], 확신: 0.9 };
  const 사인 = await 듣고고르기('사인', 작은wav());
  assert.deepEqual(사인.들은것, ['사인']);
  assert.equal(답짓기('사인', 사인).다음순간, '끝');
  // 고른 반응이 그 순간에 없으면 되묻기
  답할것 = { 받아적기: '음', 판단: '고름', 반응: ['없는반응'], 들은것: [], 확신: 0.3 };
  assert.equal((await 듣고고르기('나라', 작은wav())).판단, '되묻기');

  const 앞수 = 가짜.받은.length;
  답할것 = { 좋음: true };
  const 넘김 = await 제미나이부르기({ contents: [] }, { 모델들: ['느림', '빠름'], 키: 'AIzaFakeGeminiKeyMustNotLeak', 시한ms: 300 });
  assert.equal(넘김.모델, '빠름');
  assert.deepEqual(넘김.출력, { 좋음: true });
  assert.deepEqual(가짜.받은.slice(앞수).map((r) => decodeURIComponent(r.주소)), ['/v1beta/models/느림:generateContent', '/v1beta/models/빠름:generateContent']);
  await assert.rejects(제미나이부르기({ contents: [] }, { 모델들: ['느림'], 키: 'AIzaFakeGeminiKeyMustNotLeak', 시한ms: 200 }), (e) => e.상태 === 504);
});

test('서버: Gemini 무료 키가 없으면 답 은행 길은 503(다른 길로 넘기지 않는다)', async (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '상황극-'));
  const { s, 보내기 } = await 띄우기({ 장부: path.join(폴더, '장부.jsonl'), 예산USD: 50 });
  t.after(() => s.close());
  const r = await 보내기('/api/연결', { 길: '은행' });
  assert.equal(r.status, 503);
  assert.match((await r.json()).오류, /Gemini 무료 키/);
});
