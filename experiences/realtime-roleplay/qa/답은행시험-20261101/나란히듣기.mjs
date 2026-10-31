// 답 은행 시험 3단계(2026-11-01) — 같은 학습자 소리로 「답 은행판」과 「실시간판」을 녹음해 나란히 듣는다.
// · 답 은행판 = 실제 길 그대로: 학습자 소리 → 받아 적기(gpt-transcribe, 드라마 테이크와 같은 길) → 고르기(gpt-6.1-terra 생각 끔, 고르기.mjs와 같은 지시)
//   → 은행 답(되묻기면 그 순간의 되묻기 줄, 생성이면 gpt-6-luna가 시제품 지시문으로 한 줄). 고른 하온 말은 Gemini 3.8 Live Kore가 글자 그대로
//   읽는다 — 실시간판과 같은 목소리라 내용만 비교된다(실제 앱이면 미리 구운 소리를 바로 튼다).
// · 실시간판 = 시제품과 같은 지시문(../../lib/장면.mjs)으로 Gemini 3.8 Live Kore가 자유롭게 받아친다.
// 쓰는 법: node 나란히듣기.mjs <학습자|은행|실시간|엮기|전부>
// 소리 · 기록은 git 밖 .tmp/답은행시험-20261101/. 키: Gemini 「글」 무료 키(지어낸 대본만) · OpenAI 상황극 키 목록(결제 수단 없는 월 크레딧).
// Gemini 연결 · 소리 펌프 · 답 끝 재기는 듣기 시험 녹음.mjs(10-29 실측 9판)에서 옮겼다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { 키로부르기 } from '../../lib/오픈AI키.mjs';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 팬사인회, 지시문, 첫인사지시 } from '../../lib/장면.mjs';
import 듣기대본 from '../../../synk-world-app/qa/realtime-roleplay-20261029/듣기시험/대본.mjs';
import { 순간, 묶음들, 되묻기 } from './은행.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 바탕 = (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 표본율 = 24000;
const 조각ms = 100;
const 목소리 = 'Kore';
const 제미나이소켓 = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
// 생성 길에서만 쓰는 순간의 질문(은행.mjs의 꼬리와 같은 글 — 은행 파일은 시험 전에 해시로 굳혀 고치지 않는다)
const 꼬리 = { 처음: '이름이 뭐예요?', 나라: '어디에서 왔어요?', 좋아함: '우리 노래 중에 뭐 좋아해요?', 사인: '오늘 제가 뭐 해 줄까요?', 끝: '다음에 또 만나요, 약속!', 작별뒤: '조심히 가요, 또 만나요~' };

// 들려 드릴 두 판 — 시험 자료(학습자말.mjs)와 따로, 대화가 이어질 때의 느낌을 보려고 Claude가 지은 학습자 말이다(숫자는 200줄 시험이 낸다).
export const 대화들 = {
  A: { 이름: '평범한 판', 줄: [
    '안녕하세요! 저는… 볼로르예요.',
    '몽골에서 왔어요. 울란바토르요.',
    '음… 지난번 무대요. 춤이 너무 멋있었어요!',
    '여기 사인해 주세요! 제 이름도 써 주세요.',
    '와, 진짜 예뻐요! 감사합니다!',
    '네, 약속! 또 올게요!',
  ] },
  B: { 이름: '까다로운 판', 줄: [
    'Hi! 아, 안녕하세요… 이름이 투야예요.',
    '하온 씨는 어디에서 왔어요?',
    '아, 저는 몽골… 몽골 사람이에요.',
    '노래 이름이… 생각 안 나요. 미안해요.',
    '사진 같이 찍어도 돼요?',
    '네! 사인도 해 주세요.',
    '사랑해요! 콘서트 꼭 갈게요!',
    '안녕히 계세요!',
  ] },
};

function 멈춤(말, 코드 = 2) { console.error(`[나란히] ${말}`); process.exit(코드); }
function wav(pcm, 율 = 표본율) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(율, 24);
  h.writeUInt32LE(율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function 다듬기(pcm, 문턱 = 0.012, 여유ms = 60) {
  const n = pcm.length >> 1; const 틀 = 표본율 / 100;
  const 큼 = (s) => { let m = 0; for (let j = Math.max(0, s); j < Math.min(n, s + 틀); j++) m = Math.max(m, Math.abs(pcm.readInt16LE(j * 2)) / 32768); return m; };
  let a = 0; while (a < n && 큼(a) < 문턱) a += 틀;
  let b = n; while (b > a && 큼(b - 틀) < 문턱) b -= 틀;
  const 여유 = (표본율 * 여유ms) / 1000;
  return pcm.subarray(Math.max(0, a - 여유) * 2, Math.min(n, b + 여유) * 2);
}
function ff(인자) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...인자], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) 멈춤(`ffmpeg 실패: ${인자.join(' ')}\n${(r.stderr || '').slice(-800)}`, 1);
}
const 학습자파일 = (대, i) => path.join(작업, '학습자', `${대}_${i + 1}.wav`);
function 학습자16k(대, i) {
  const 나갈 = path.join(작업, '학습자16k', `${대}_${i + 1}.pcm`);
  if (!fs.existsSync(나갈)) { fs.mkdirSync(path.dirname(나갈), { recursive: true }); ff(['-i', 학습자파일(대, i), '-ar', '16000', '-ac', '1', '-f', 's16le', 나갈]); }
  return fs.readFileSync(나갈);
}
const pcm24 = (대, i) => fs.readFileSync(학습자파일(대, i)).subarray(44);

// ── 학습자 줄 굽기(듣기 시험과 같은 학습자 목소리) ──
async function 학습자굽기() {
  const 목 = 듣기대본.학습자목소리;
  for (const [대, d] of Object.entries(대화들)) {
    for (const [i, 말] of d.줄.entries()) {
      const 나갈 = 학습자파일(대, i);
      if (fs.existsSync(나갈)) continue;
      const { res, 키 } = await 키로부르기((v) => fetch(`${바탕}/audio/speech`, {
        method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 목.모델, voice: 목.목소리, input: 말, instructions: 목.지시, response_format: 'pcm' }),
      }));
      const pcm = 다듬기(Buffer.from(await res.arrayBuffer()));
      fs.mkdirSync(path.dirname(나갈), { recursive: true });
      fs.writeFileSync(나갈, wav(pcm));
      console.log(`[나란히] 학습자 ${대}_${i + 1} ${(pcm.length / 2 / 표본율).toFixed(2)}초 · 키 ${키}`);
    }
  }
}

// ── 답 은행 길: 받아 적기 → 고르기 → 은행 답 ──
async function 받아적기(pcm) {
  const 시작 = performance.now();
  const { res } = await 키로부르기((v) => {
    const form = new FormData();
    form.set('file', new Blob([wav(pcm)], { type: 'audio/wav' }), 'speech.wav');
    form.set('model', 'gpt-transcribe');
    return fetch(`${바탕}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${v}` }, body: form });
  });
  const j = await res.json();
  return { 글: String(j.text || '').trim(), ms: Math.round(performance.now() - 시작) };
}
function 다음순간(단계id, 묶음id) {
  const b = 순간[단계id].묶음.find((x) => x.id === 묶음id);
  if (b) return b.다음;
  return 단계id === '끝' ? '작별뒤' : 단계id === '작별뒤' ? '끝남' : 단계id; // 공통 묶음 — 꼬리가 작별인 두 순간만 넘어간다
}
async function 생성한줄(대화, 단계id) {
  const 본문 = {
    model: 'gpt-6-luna', max_output_tokens: 300,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: `${지시문(팬사인회)}\n이번 답은 한두 문장으로 짧게, 끝에 「${꼬리[단계id]}」로 돌아온다. 하온의 말만 쓴다.` }] },
      ...대화.map((t) => ({ role: t.누가 === '나' ? 'user' : 'assistant', content: [{ type: t.누가 === '나' ? 'input_text' : 'output_text', text: t.글 }] })),
    ],
  };
  const { 답 } = await 응답부르기(본문);
  return 출력글(답).trim();
}
async function 은행길() {
  const { 고르기본문 } = await import('./고르기.mjs'); // 고르기.mjs는 학습자말.mjs를 읽으므로 이 길에서만 부른다
  const 기록 = {};
  for (const [대, d] of Object.entries(대화들)) {
    let 단계id = '처음';
    const 쓴수 = {};
    const 대화 = [{ 누가: '상대', 글: 팬사인회.첫인사 }];
    const 차례 = [];
    for (const [i, 말] of d.줄.entries()) {
      if (단계id === '끝남') { 차례.push({ 말, 건너뜀: '대화가 이미 끝남' }); continue; }
      const 들음 = await 받아적기(pcm24(대, i));
      대화.push({ 누가: '나', 글: 들음.글 });
      const 시작 = performance.now();
      // 실시간 차례용 설정(생각 끔). 11-01은 luna가 조직 토큰 상한에 닿아 200줄 시험과 같은 terra로 고른다(채점 README 「고르기 모델」)
      const { 답 } = await 응답부르기(고르기본문({ 단계: 단계id, 받아적기: 들음.글 }, 'gpt-6.1-terra', 'none'));
      const 고름 = JSON.parse(출력글(답) || '{}');
      const 고르기ms = Math.round(performance.now() - 시작);
      let 하온; let 길 = 고름.판단;
      if (고름.판단 === '고름') {
        const 답들 = 묶음들(단계id).find((b) => b.id === 고름.묶음)?.답 || [];
        쓴수[고름.묶음] = (쓴수[고름.묶음] || 0) + 1;
        하온 = 답들[(쓴수[고름.묶음] - 1) % 답들.length];
        if (!하온) { 길 = '생성'; }
      } else if (고름.판단 === '되묻기') {
        const 줄들 = 되묻기(단계id); 쓴수.되묻기 = (쓴수.되묻기 || 0) + 1;
        하온 = 줄들[(쓴수.되묻기 - 1) % 줄들.length];
      }
      if (길 === '생성') 하온 = await 생성한줄(대화, 단계id);
      const 앞순간 = 단계id;
      if (길 === '고름') 단계id = 다음순간(단계id, 고름.묶음);
      대화.push({ 누가: '상대', 글: 하온 });
      차례.push({ 말, 받아적기: 들음.글, 받아적기ms: 들음.ms, 순간: 앞순간, 판단: 길, 묶음: 고름.묶음 || '', 확신: 고름.확신, 고르기ms, 하온 });
      console.log(`[나란히] 은행 ${대}_${i + 1} ${앞순간} 「${들음.글}」 → ${길} ${고름.묶음 || ''} (${고름.확신}) 「${하온}」`);
    }
    기록[대] = { 첫인사: 팬사인회.첫인사, 차례 };
  }
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(path.join(작업, '은행길.json'), JSON.stringify(기록, null, 1));
}

// ── Gemini 3.8 Live 연결(녹음.mjs에서 옮김) ──
class 소켓 {
  constructor(ws) {
    this.ws = ws; this.기다림 = []; this.듣기 = null;
    ws.addEventListener('message', (ev) => {
      const e = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (e.error) e.type ??= 'error';
      e.받은 = performance.now();
      this.듣기?.(e);
      for (const w of [...this.기다림]) if (w.조건(e)) { this.기다림.splice(this.기다림.indexOf(w), 1); w.res(e); }
    });
    ws.addEventListener('close', (ev) => {
      this.닫힘 = `${ev.code} ${ev.reason || ''}`.trim();
      for (const w of this.기다림.splice(0)) w.rej(new Error(`소켓이 닫혔다(${this.닫힘}) — ${w.이름} 기다리던 중`));
    });
  }
  보내기(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  기다리기(조건, ms, 이름) {
    return new Promise((res, rej) => {
      const w = { 조건, res, rej, 이름 }; this.기다림.push(w);
      setTimeout(() => { const i = this.기다림.indexOf(w); if (i >= 0) { this.기다림.splice(i, 1); rej(new Error(`${이름}을 ${ms}ms 기다렸다`)); } }, ms);
    });
  }
}
function 열기(주소, 머리) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(주소, { headers: 머리 });
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('error', (e) => rej(new Error(`연결 실패 ${e?.message || ''}`)), { once: true });
    ws.addEventListener('open', () => res(ws), { once: true });
  });
}
class 소리펌프 {
  constructor(보내기, 율) { this.보내기 = 보내기; this.율 = 율; this.조각바이트 = (율 * 2 * 조각ms) / 1000; this.대기 = []; this.지금 = null; this.보낸조각 = 0; this.침묵 = Buffer.alloc(this.조각바이트); }
  시작하기() { this.시작 = performance.now(); this.돌기(); }
  넣기(pcm) { return new Promise((res) => this.대기.push({ pcm, res, 자리: 0 })); }
  돌기() {
    if (this.꺼짐) return;
    const 목표 = Math.floor((performance.now() - this.시작) / 조각ms) + 1;
    while (this.보낸조각 < 목표) {
      if (!this.지금 && this.대기.length) this.지금 = this.대기.shift();
      let 조각 = this.침묵;
      if (this.지금) {
        const 줄 = this.지금;
        조각 = 줄.pcm.subarray(줄.자리, 줄.자리 + this.조각바이트);
        const 실제 = 조각.length; 줄.자리 += 실제;
        if (실제 < this.조각바이트) 조각 = Buffer.concat([조각, Buffer.alloc(this.조각바이트 - 실제)]);
        if (줄.자리 >= 줄.pcm.length) { this.지금 = null; 줄.res(this.시작 + this.보낸조각 * 조각ms + (실제 / 2 / this.율) * 1000); }
      }
      this.보내기(조각); this.보낸조각++;
    }
    this.타이머 = setTimeout(() => this.돌기(), 10);
  }
  끄기() { this.꺼짐 = true; clearTimeout(this.타이머); }
}
const 새답 = (번호) => ({ 번호, 소리: [], 글: '', 첫소리: null, 마지막소리: null, 끝남: false });
const 답길이ms = (답) => (답.소리.reduce((n, b) => n + b.length, 0) / 2 / 표본율) * 1000;
async function 답끝(답, 첫소리기한) {
  const 시작 = performance.now();
  for (;;) {
    await 쉼(100);
    const 지금 = performance.now();
    if (!답.첫소리) { if (지금 - 시작 > 첫소리기한) { 답.빠짐 = true; return; } continue; }
    if (답.끝남 && 지금 > 답.첫소리 + 답길이ms(답) + 600) return;
    if (지금 - 시작 > 60000) { 답.잘림 = true; return; }
  }
}
async function gemini돌리기({ 지시, 첫지시, 학습자줄 }) {
  const 정책 = createRequire(import.meta.url)(path.join(저장소, 'tools', '모델정책.js'));
  const 키값 = 정책.제미나이키('글');
  if (!키값) 멈춤(정책.제미나이키안내('글'));
  const ws = new 소켓(await 열기(제미나이소켓, { 'x-goog-api-key': 키값 }));
  const 답들 = []; const 입력글 = []; let 지금답 = null; let 학습자칸 = -1;
  ws.듣기 = (e) => {
    const sc = e.serverContent; if (!sc) return;
    for (const p of sc.modelTurn?.parts || []) {
      if (!p.inlineData?.data || !지금답) continue;
      지금답.소리.push(Buffer.from(p.inlineData.data, 'base64')); 지금답.첫소리 ??= e.받은; 지금답.마지막소리 = e.받은; 지금답.끝남 = false;
    }
    if (sc.outputTranscription?.text && 지금답) 지금답.글 += sc.outputTranscription.text;
    if (sc.inputTranscription?.text && 학습자칸 >= 0) 입력글[학습자칸] = (입력글[학습자칸] || '') + sc.inputTranscription.text;
    if (sc.interrupted && 지금답) Object.assign(지금답, { 소리: [], 글: '', 첫소리: null, 마지막소리: null, 끝남: false });
    if (sc.turnComplete && 지금답 && 지금답.소리.length) 지금답.끝남 = true;
  };
  ws.보내기({ setup: {
    model: 'models/gemini-3.8-live',
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 목소리 } } } },
    systemInstruction: { parts: [{ text: 지시 }] },
    realtimeInputConfig: { automaticActivityDetection: { endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', silenceDurationMs: 1000 } },
    inputAudioTranscription: {}, outputAudioTranscription: {},
  } });
  const 시작 = await ws.기다리기((e) => e.setupComplete || e.type === 'error', 20000, 'setupComplete');
  if (시작.type === 'error') throw new Error(`시작 거절: ${JSON.stringify(시작.error).slice(0, 300)}`);
  const 펌프 = new 소리펌프((조각) => ws.보내기({ realtimeInput: { audio: { data: 조각.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }), 16000);
  지금답 = 새답(1); 답들.push(지금답); 펌프.시작하기();
  ws.보내기({ clientContent: { turns: [{ role: 'user', parts: [{ text: 첫지시 }] }], turnComplete: true } });
  await 답끝(지금답, 12000);
  for (const [i, pcm] of 학습자줄.entries()) {
    지금답 = 새답(i + 2); 답들.push(지금답); 학습자칸 = i;
    지금답.학습자끝 = await 펌프.넣기(pcm);
    await 답끝(지금답, 15000);
    console.log(`  · ${지금답.번호}번 ${지금답.빠짐 ? '빠짐' : 지금답.잘림 ? '잘림' : 'ok'} 지연 ${지금답.첫소리 ? Math.round(지금답.첫소리 - 지금답.학습자끝) : '-'}ms 「${지금답.글.trim().slice(0, 70)}」`);
  }
  await 쉼(1200); 펌프.끄기(); ws.ws.close();
  return { 답들, 입력글 };
}
function 판저장(이름, 대, 결과) {
  const 폴더 = path.join(작업, 이름);
  fs.mkdirSync(폴더, { recursive: true });
  const 줄 = 결과.답들.map((답, i) => {
    const pcm = Buffer.concat(답.소리);
    if (pcm.length) fs.writeFileSync(path.join(폴더, `${대}_${i}.wav`), wav(pcm));
    return { 번호: i, 하온: 답.글.trim(), 초: Number((pcm.length / 2 / 표본율).toFixed(2)), 지연ms: 답.학습자끝 && 답.첫소리 ? Math.round(답.첫소리 - 답.학습자끝) : null, 빠짐: !!답.빠짐, 잘림: !!답.잘림 };
  });
  return { 줄, 제미나이받아쓰기: 결과.입력글 };
}

async function 실시간판() {
  const 기록 = {};
  for (const [대, d] of Object.entries(대화들)) {
    console.log(`[나란히] 실시간 ${대}`);
    const 결과 = await gemini돌리기({ 지시: 지시문(팬사인회), 첫지시: 첫인사지시(팬사인회), 학습자줄: d.줄.map((_, i) => 학습자16k(대, i)) });
    기록[대] = 판저장('실시간', 대, 결과);
  }
  fs.writeFileSync(path.join(작업, '실시간판.json'), JSON.stringify(기록, null, 1));
}

async function 은행판() {
  const 길 = JSON.parse(fs.readFileSync(path.join(작업, '은행길.json'), 'utf8'));
  const 기록 = {};
  for (const [대, d] of Object.entries(대화들)) {
    const 차례 = 길[대].차례.filter((t) => !t.건너뜀);
    const 상대줄 = [길[대].첫인사, ...차례.map((t) => t.하온)];
    const 대본 = [`상대역: ${상대줄[0]}`, ...차례.flatMap((t, i) => [`학습자: ${t.말}`, `상대역: ${상대줄[i + 1]}`])].join('\n');
    const 지시 = `${듣기대본.공통지시}\n\n장면: 팬사인회. 너의 역할: 하온(가상 아이돌). 연기: ${팬사인회.상대.연기}\n\n대본:\n${대본}`;
    console.log(`[나란히] 은행판 ${대}`);
    const 결과 = await gemini돌리기({ 지시, 첫지시: `(상황극 시작) 지금 상대역 1번 줄을 글자 그대로 말한다: 「${상대줄[0]}」 그다음 학습자가 말할 때까지 기다린다.`, 학습자줄: 차례.map((_, i) => 학습자16k(대, i)) });
    기록[대] = { ...판저장('은행', 대, 결과), 대본줄: 상대줄 };
  }
  fs.writeFileSync(path.join(작업, '은행판.json'), JSON.stringify(기록, null, 1));
}

// ── 엮기: 같은 간격(0.45초)으로 하온 · 학습자 줄을 이어 mp3 한 판씩 ──
function 엮기() {
  const 간격 = Buffer.alloc(Math.round(표본율 * 0.45) * 2);
  const 나갈폴더 = path.join(작업, '엮음');
  fs.mkdirSync(나갈폴더, { recursive: true });
  const 길 = JSON.parse(fs.readFileSync(path.join(작업, '은행길.json'), 'utf8'));
  for (const 판 of ['은행', '실시간']) {
    for (const [대, d] of Object.entries(대화들)) {
      const n = 판 === '은행' ? 길[대].차례.filter((t) => !t.건너뜀).length : d.줄.length;
      const 조각 = [];
      for (let i = 0; i <= n; i++) {
        const 하온 = path.join(작업, 판, `${대}_${i}.wav`);
        if (fs.existsSync(하온)) 조각.push(다듬기(fs.readFileSync(하온).subarray(44)), 간격);
        if (i < n) 조각.push(pcm24(대, i), 간격);
      }
      const 임시 = path.join(나갈폴더, `${판}_${대}.wav`);
      fs.writeFileSync(임시, wav(Buffer.concat(조각)));
      ff(['-i', 임시, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '96k', path.join(나갈폴더, `${판}_${대}.mp3`)]);
      console.log(`[나란히] 엮음 ${판}_${대}.mp3`);
    }
  }
}

const 명령 = process.argv[2];
if (명령 === '학습자' || 명령 === '전부') await 학습자굽기();
if (명령 === '은행' || 명령 === '전부') { await 은행길(); await 은행판(); }
if (명령 === '실시간' || 명령 === '전부') await 실시간판();
if (명령 === '엮기' || 명령 === '전부') 엮기();
if (!['학습자', '은행', '실시간', '엮기', '전부'].includes(명령)) 멈춤('명령: 학습자 | 은행 | 실시간 | 엮기 | 전부', 1);
