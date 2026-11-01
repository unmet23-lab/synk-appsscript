// 실시간 음성 상황극 시제품의 로컬 서버(2026-10-30) — 이 PC에서만 듣는다(127.0.0.1). 학생에게 여는 배포가 아니다.
// 화면(public/)을 주고, 공급사 세션을 열고(키는 서버만 — Gemini는 1회용 임시 토큰, OpenAI는 SDP 교환), 끝나면 장부에 값을 적고 전사로 글 피드백을 만든다.
//   node experiences/realtime-roleplay/server.mjs           → http://127.0.0.1:5250/
//   SYNK_ROLEPLAY_BUDGET_USD=50(기본) · SYNK_ROLEPLAY_RESET_DAY=1(예산 주기 시작 날, 구독 결제일에 맞춤) · SYNK_ROLEPLAY_LEDGER(장부 경로)
//   · GEMINI_KEY_PATH_FREE(Gemini 무료 키 파일, 기본 ~/SYNK_보안/제미나이_무료.txt) · SYNK_OPENAI_BASE · SYNK_GEMINI_BASE(시험용 가짜 서버) · PORT
// 소리는 서버를 지나지 않고, 전사는 피드백을 만드는 동안만 메모리에 둔다. 콘솔에는 길 · 시간 · 어림 값만 찍는다(키 · 토큰 값은 찍지 않는다).
// 답 은행 길(?길=은행 · 「Zoe 목소리로 말 걸기」, 11-02)만 다르다 — 학습자 말 한 차례(WAV)가 서버를 지나 Gemini로 가고(저장하지 않는다),
// 하온 답은 미리 녹음한 Zoe 소리(소리/하온_zoe/ → /하온소리/NNN.mp3)를 화면이 이어 튼다(lib/답은행.mjs).
import http from 'node:http';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 팬사인회, 지시문, 첫인사지시, 마무리지시, 작별지시, 침묵도움지시 } from './lib/장면.mjs';
import { 공급사들, 응답부르기, 제미나이부르기 } from './lib/공급사.mjs';
import { 계량, 장부읽기, 장부적기, gptLive값, realtime값, gemini값, 글값 } from './lib/예산.mjs';
import { 요청본문, 제미나이요청본문, 출력글, 검사, 피드백모델 } from './lib/피드백.mjs';
import { 듣고고르기, 답짓기, 침묵도움, 시간마무리, 첫인사 as 은행첫인사, 소리찾기, 소리폴더 } from './lib/답은행.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '..', '..');
const 공개 = path.join(여기, 'public');
const 글꼴 = path.join(저장소, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2');
const 장면 = 팬사인회;
const 글모델 = 'gpt-6-luna';
const 최대몸 = 64 * 1024;
const 최대소리 = 2 * 1024 * 1024; // 답 은행 길의 학습자 말 한 차례(16kHz 모노 WAV — 15초가 약 480KB)
// OpenAI 크레딧이 바닥났을 때 돌아보기를 만들 Gemini 모델(무료 등급) — 몫이 차면 다음 모델로
const 피드백제미나이모델들 = (process.env.SYNK_FEEDBACK_GEMINI_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',').map((s) => s.trim()).filter(Boolean);
const 종류 = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

export function 서버만들기({ 장부 = process.env.SYNK_ROLEPLAY_LEDGER || path.join(저장소, '.tmp', 'realtime-roleplay', '예산장부.jsonl'), 예산USD = Number(process.env.SYNK_ROLEPLAY_BUDGET_USD || 50), 리셋날 = Number(process.env.SYNK_ROLEPLAY_RESET_DAY || 1), 기록 = console.log } = {}) {
  const 끝난세션 = new Set();
  const 진행중 = new Map(); // 세션 → {길, 시작} — 끝 보고 없이 새 연결이 오면(새로 고침 · 탭 닫힘) 지난 시간으로 닫는다
  const 은행판 = new Map(); // 답 은행 길 세션 → {순간, 차례, 되묻기, 도움, 처리중} — 대화가 어느 순간에 있는지는 서버가 쥔다
  const 모델쉼 = new Map(); // Gemini 모델 → 다시 앞에 둘 시각 — 시한을 넘긴 모델은 10분 동안 맨 뒤로(듣기 · 돌아보기가 같이 쓴다)
  // 제미나이빼기: 화면이 Gemini 준비 전 실패를 알리고 다시 열 때(이번 한 번은 OpenAI 길로)
  const 지금계량 = (제미나이빼기 = false) => 계량({ 줄들: 장부읽기(장부), 예산USD, 리셋날, 상한초: 장면.상한초, 제미나이: !제미나이빼기 && 공급사들['gemini-live'].쓸수있나() });
  const 남은세션닫기 = (까닭) => {
    for (const [세션, v] of 진행중) {
      const 초 = Math.min(Math.round((Date.now() - v.시작) / 1000), 장면.상한초 + 15);
      if (v.길 === 'gpt-live') 장부적기(장부, { 무엇: '세션', 길: v.길, 세션, 초, USD: Math.max(0, gptLive값(초) - gptLive값(0)), 끝확인: false, 까닭 });
      else if (v.길 === 'gemini-live' || v.길 === '은행') 장부적기(장부, { 무엇: '세션', 길: v.길, 세션, 초, USD: 0, 등급: '무료', 끝확인: false, 까닭 });
      else 장부적기(장부, { 무엇: '세션', 길: v.길, 세션, 초, USD: (초 / 60) * 0.12, 끝확인: false, 까닭 }); // mini는 사용량을 못 받았으니 분당 $0.12로 넉넉히
      끝난세션.add(세션);
      진행중.delete(세션);
      은행판.delete(세션);
    }
  };
  const 공개장면 = { 이름: 장면.이름, 상황: 장면.상황, 나: 장면.나, 상대: { 이름: 장면.상대.이름, 누구: 장면.상대.누구 }, 미션: 장면.미션, 상한초: 장면.상한초 };

  function 몸읽기(req) {
    return new Promise((res, rej) => {
      let 길이 = 0;
      const 조각 = [];
      req.on('data', (c) => {
        길이 += c.length;
        if (길이 > 최대몸) { rej(Object.assign(new Error('너무 큰 요청'), { 상태: 413 })); req.destroy(); return; }
        조각.push(c);
      });
      req.on('end', () => {
        try { res(JSON.parse(Buffer.concat(조각).toString('utf8') || '{}')); } catch { rej(Object.assign(new Error('JSON이 아니다'), { 상태: 400 })); }
      });
      req.on('error', rej);
    });
  }
  const 답 = (res, 상태, 몸) => { res.writeHead(상태, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(몸)); };
  const 전사고르기 = (전사) => (Array.isArray(전사) ? 전사 : [])
    .filter((t) => t && (t.누가 === '나' || t.누가 === '상대') && typeof t.글 === 'string' && t.글.trim())
    .slice(0, 80).map((t) => ({ 누가: t.누가, 글: t.글.trim().slice(0, 400) }));

  // 연결 — 화면은 SDP 없이 먼저 길을 묻는다. Gemini면 바로 임시 토큰을, WebRTC 길(OpenAI)이면 428 {필요:'sdp'}로 길을 알려 주고
  // 화면이 그 길로 SDP를 만들어 다시 부르면 지금처럼 세션을 연다. 답 은행 길은 길을 골랐을 때만(예산 계량기가 고르지 않는다).
  async function 연결(몸) {
    if (몸.길 === '은행') return 은행연결();
    if (몸.sdp !== undefined && (typeof 몸.sdp !== 'string' || !/^v=0/m.test(몸.sdp) || 몸.sdp.length > 최대몸)) return [400, { 오류: 'SDP 제안이 이상하다' }];
    const 계 = 지금계량(몸.제외 === 'gemini-live');
    const 강제 = !!공급사들[몸.길]; // 시험용 강제(이 서버는 127.0.0.1에서만 듣는다)
    const 길 = 강제 ? 몸.길 : 계.길;
    if (길 === '글' || !공급사들[길]) return [409, { 길: '글', 계량: 계 }];
    if (공급사들[길].운반 === 'webrtc' && !몸.sdp) return [428, { 길, 필요: 'sdp', 계량: 계 }];
    남은세션닫기('새 연결로 닫음');
    const 시작 = Date.now();
    let 세션;
    try {
      세션 = await 공급사들[길].세션만들기({ sdp: 몸.sdp, 장면 });
    } catch (e) {
      if (길 === 'gemini-live') {
        // Gemini 토큰을 못 만들면 — 몫(429)은 몫바닥(몫쉼 동안 OpenAI 길), 그 밖은 연결실패 줄만 적고 이번 연결은 다음 길로 알려 준다.
        // 길을 고정한 시험이면 넘기지 않고 알린다
        const 몫 = e.코드 === '몫';
        장부적기(장부, { 무엇: 몫 ? '몫바닥' : '연결실패', 길, USD: 0, 까닭: `토큰 ${e.상태 || ''} ${String(e.message).slice(0, 80)}`.trim() });
        기록(`[상황극] Gemini 토큰 실패(${몫 ? '몫' : e.상태 || '?'}) — ${강제 ? '길 고정이라 멈춤' : '다음 길로'}`);
        if (강제) return [몫 ? 429 : 502, { 오류: 몫 ? 'Gemini 무료 몫을 다 썼다' : `Gemini 연결 실패: ${String(e.message).slice(0, 120)}`, 계량: 지금계량() }];
        const 까닭 = 몫 ? 'Gemini 무료 몫' : 'Gemini 연결 실패';
        const 다음 = 지금계량(true);
        if (다음.길 === '글' || !공급사들[다음.길]) return [409, { 길: '글', 까닭, 계량: 다음 }];
        return [428, { 길: 다음.길, 필요: 'sdp', 까닭, 계량: 다음 }];
      }
      if (e.코드 !== 'credit_balance_exhausted') throw e;
      // 크레딧이 바닥나면 장부와 상관없이 이번 주기는 글 상황극으로(돈 드는 길로 돌리지 않는다)
      장부적기(장부, { 무엇: '크레딧바닥', 길, USD: 0 });
      기록(`[상황극] 크레딧 바닥 — 글 상황극으로`);
      return [409, { 길: '글', 까닭: '크레딧 바닥', 계량: 지금계량() }];
    }
    if (세션.세션) 진행중.set(세션.세션, { 길, 시작: Date.now() });
    // GPT-Live WebRTC는 여는 순간 15초를 먼저 매긴다 — 끝을 못 받아도 그만큼은 장부에 남는다
    const 먼저 = 길 === 'gpt-live' ? gptLive값(0) : 0;
    장부적기(장부, { 무엇: '세션시작', 길, 세션: 세션.세션, USD: 먼저 });
    기록(`[상황극] 연결 ${길} ${Date.now() - 시작}ms 키 ${세션.키}`);
    const 공통 = { 길, 세션: 세션.세션, 첫인사: 첫인사지시(장면), 마무리: 마무리지시(장면), 계량: 지금계량() };
    // Gemini: 1회용 임시 토큰(60초 안에 열기 · 설정 잠금)과 같은 setup, 침묵 때 연결 층이 넣을 글 차례 둘 — 표준 키는 응답에 없다
    if (공급사들[길].운반 === 'websocket') return [201, { ...공통, 운반: 'websocket', 소켓: 세션.소켓, 토큰: 세션.토큰, 설정: 세션.설정, 작별: 작별지시(장면), 도움: 침묵도움지시(장면) }];
    return [201, { ...공통, 운반: 'webrtc', sdp: 세션.sdp }];
  }

  // ── 답 은행 길 ── 0원(Gemini 무료 등급)이라 예산 계량과 상관없다. 무료 몫이 차도 Gemini Live 몫쉼(몫바닥 줄)에는 적지 않는다(다른 몫이다)
  function 은행연결() {
    if (!공급사들['gemini-live'].쓸수있나()) return [503, { 오류: 'Gemini 무료 키가 없어 답 은행 길을 못 연다' }];
    남은세션닫기('새 연결로 닫음');
    const 세션 = `bank_${randomBytes(9).toString('hex')}`;
    은행판.set(세션, { 순간: '처음', 차례: 0, 되묻기: 0, 도움: 0, 처리중: false });
    진행중.set(세션, { 길: '은행', 시작: Date.now() });
    장부적기(장부, { 무엇: '세션시작', 길: '은행', 세션, USD: 0 });
    기록('[상황극] 연결 은행(Zoe 녹음 답) 키 Gemini 무료 키');
    return [201, { 길: '은행', 운반: '은행', 세션, 첫인사: { 글: 은행첫인사, 소리: 소리찾기(은행첫인사) }, 계량: 지금계량() }];
  }

  function 소리읽기(req) {
    return new Promise((res, rej) => {
      if (!/^audio\/(wav|wave|x-wav)\b/.test(req.headers['content-type'] || '')) { req.resume(); rej(Object.assign(new Error('audio/wav만 받는다'), { 상태: 415 })); return; }
      let 길이 = 0;
      const 조각 = [];
      req.on('data', (c) => {
        길이 += c.length;
        if (길이 <= 최대소리) 조각.push(c); // 넘치면 더 모으지 않고 끝까지 흘려 413으로 답한다(화면이 까닭을 받게)
      });
      req.on('end', () => (길이 > 최대소리 ? rej(Object.assign(new Error('너무 긴 말소리'), { 상태: 413 })) : res(Buffer.concat(조각))));
      req.on('error', rej);
    });
  }

  // 학습자 말 한 차례 → Gemini가 듣고 고름 → 하온 답 조각. Gemini가 안 되면 하온이 되묻고(차례 · 순간 그대로) 실패를 알린다 — 화면이 두 번 잇따르면 끝낸다
  async function 은행차례(req, 주소) {
    const 세션 = (주소.searchParams.get('세션') || '').slice(0, 120);
    const 판 = 은행판.get(세션);
    if (!판) { req.resume(); return [404, { 오류: '없는 은행 세션' }]; }
    const wav = await 소리읽기(req);
    if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') return [400, { 오류: 'WAV가 아니다' }];
    if (판.순간 === '끝남') return [409, { 오류: '이미 작별했다' }];
    if (판.처리중) return [409, { 오류: '앞 차례를 듣는 중' }];
    판.처리중 = true;
    try {
      const 앞순간 = 판.순간;
      let 고름;
      try {
        고름 = await 듣고고르기(앞순간, wav, { 쉼: 모델쉼 });
      } catch (e) {
        if (e.상태 === 400) throw e; // 모르는 순간 — 서버 잘못이다
        장부적기(장부, { 무엇: '차례실패', 길: '은행', 세션, USD: 0, 까닭: `${e.상태 || '네트워크'} ${String(e.message).slice(0, 80)}`, ...(e.건넘?.length ? { 건넘: e.건넘 } : {}) });
        기록(`[상황극] 은행 듣기 실패 ${e.상태 || '네트워크'}: ${String(e.message).slice(0, 80)}`);
        const 되 = 답짓기(앞순간, { 판단: '되묻기' }, 판.되묻기++);
        return [200, { 실패: e.상태 === 429 ? 'Gemini 무료 몫' : 'Gemini 연결 실패', 받아적기: '', 판단: '되묻기', 조각: 되.조각, 순간: 판.순간, 끝남: false }];
      }
      const 답짓기결과 = 답짓기(앞순간, 고름, 고름.판단 === '되묻기' ? 판.되묻기++ : 판.차례);
      판.순간 = 답짓기결과.다음순간;
      판.차례 += 1;
      // 장부에는 고른 반응 id · 시간 · 토큰 수만 — 받아 적은 글은 남기지 않는다
      장부적기(장부, { 무엇: '차례', 길: '은행', 세션, 모델: 고름.모델, ms: 고름.ms, ...(고름.건넘?.length ? { 건넘: 고름.건넘 } : {}), 판단: 고름.판단, 반응: 고름.반응, 순간: [앞순간, 판.순간], 사용: 고름.사용 ? { 입력: 고름.사용.promptTokenCount || 0, 출력: 고름.사용.candidatesTokenCount || 0 } : null, USD: 0, 등급: '무료' });
      return [200, { 받아적기: 고름.받아적기, 판단: 고름.판단, 조각: 답짓기결과.조각, 순간: 판.순간, 끝남: 판.순간 === '끝남', ms: 고름.ms }];
    } finally {
      판.처리중 = false;
    }
  }

  // 침묵 도움(학습자가 8초 조용) · 시간 마무리(상한 20초 전) — 화면이 부르고 하온 녹음 줄을 받는다. 듣는 중이거나 이미 작별 순간이면 빈 조각
  function 은행도움(몸) {
    const 판 = 은행판.get(typeof 몸.세션 === 'string' ? 몸.세션 : '');
    if (!판) return [404, { 오류: '없는 은행 세션' }];
    if (판.처리중) return [200, { 조각: [], 순간: 판.순간 }];
    const 도움 = 침묵도움(판.순간, 판.도움);
    if (도움.조각.length) 판.도움 += 1;
    판.순간 = 도움.다음순간;
    return [200, { 조각: 도움.조각, 순간: 판.순간 }];
  }
  function 은행마무리(몸) {
    const 판 = 은행판.get(typeof 몸.세션 === 'string' ? 몸.세션 : '');
    if (!판) return [404, { 오류: '없는 은행 세션' }];
    const 마 = 시간마무리(판.순간);
    판.순간 = 마.다음순간;
    return [200, { 조각: 마.조각, 순간: 판.순간 }];
  }

  // 화면이 Gemini 소켓 실패를 알린다 — 몫(429)이면 몫바닥(몫쉼 동안 OpenAI 길), 준비 전 다른 실패면 연결실패 줄만.
  // 127.0.0.1 · Origin 검사 안이라 화면 말을 믿는다(거짓이면 10분 동안 GPT-Live로 돈이 나갈 뿐)
  async function 넘김(몸) {
    const 세션 = typeof 몸.세션 === 'string' ? 몸.세션.slice(0, 120) : null;
    const 까닭 = typeof 몸.까닭 === 'string' ? 몸.까닭.slice(0, 160) : '';
    장부적기(장부, { 무엇: 몸.몫 ? '몫바닥' : '연결실패', 길: 'gemini-live', USD: 0, 까닭: `소켓 ${까닭}`.trim() });
    if (세션 && 진행중.has(세션)) {
      장부적기(장부, { 무엇: '세션', 길: 'gemini-live', 세션, 초: 0, USD: 0, 등급: '무료', 끝확인: false, 까닭: 몸.몫 ? '몫' : '연결실패' });
      진행중.delete(세션);
      끝난세션.add(세션);
    }
    기록(`[상황극] Gemini ${몸.몫 ? '무료 몫' : '연결 실패'}(소켓) — 다음 연결은 OpenAI 길`);
    return [200, { 계량: 지금계량(!몸.몫) }];
  }

  // Gemini 사용(차례마다 마지막 usageMetadata를 더한 것)은 숫자 칸만 받는다
  const 사용고르기 = (사용) => Object.fromEntries(['글입력', '음성입력', '글출력', '음성출력', '생각', '차례']
    .map((k) => [k, Math.max(0, Math.min(Number(사용?.[k]) || 0, 1e8))]));
  // 화면이 알린 끊긴 까닭과 사건 기록 꼬리(종류 · 시각 · 닫힘 코드뿐 — 자막 글 · 토큰은 없다)를 세션 줄에 붙인다.
  // 판이 왜 끝났는지 장부만 보고 알게(10-30 유호님 첫 판이 Gemini 준비 직후 0초에 끝났는데 까닭이 남지 않았다)
  const 진단고르기 = (몸) => {
    const 진단 = {};
    if (typeof 몸.까닭 === 'string' && 몸.까닭.trim()) 진단.까닭 = 몸.까닭.trim().slice(0, 160);
    if (Array.isArray(몸.기록)) {
      진단.기록 = 몸.기록.filter((x) => typeof x === 'string').slice(-40)
        .map((x) => x.replace(/access_token=[^&\s"')]+/g, 'access_token=«가림»').slice(0, 120));
    }
    return 진단;
  };

  // 돌아보기 — OpenAI(gpt-6.1-terra)가 먼저, 안 되면(11-02 세 조직 크레딧이 모두 바닥) 같은 지시 · 같은 스키마로 Gemini 무료 등급.
  // 어느 쪽이든 출력은 같은 검사()를 거친다. Gemini로 넘길 때는 전사가 구글 무료 등급으로 간다(유호님 시험용 시제품이라 허용 — README)
  async function 피드백만들기(전사) {
    try {
      const { 답: r, 키 } = await 응답부르기(요청본문(장면, 전사));
      장부적기(장부, { 무엇: '피드백', 길: 피드백모델, 키, 사용: r.usage || null, USD: 글값(피드백모델, r.usage) }); // 키는 이름만(어느 조직 크레딧인지)
      return 검사(장면, JSON.parse(출력글(r) || '{}'), 전사);
    } catch (e) {
      if (!공급사들['gemini-live'].쓸수있나()) throw e;
      기록(`[상황극] 피드백 OpenAI 실패(${String(e.message).slice(0, 60)}) — Gemini 무료 등급으로`);
      const g = await 제미나이부르기(제미나이요청본문(장면, 전사), { 모델들: 피드백제미나이모델들, 시한ms: 45000, 쉼: 모델쉼 });
      장부적기(장부, { 무엇: '피드백', 길: g.모델, 키: 'Gemini 무료 키', ms: g.ms, ...(g.건넘.length ? { 건넘: g.건넘 } : {}), 사용: g.사용 ? { 입력: g.사용.promptTokenCount || 0, 출력: g.사용.candidatesTokenCount || 0, 생각: g.사용.thoughtsTokenCount || 0 } : null, USD: 0, 등급: '무료' });
      return 검사(장면, g.출력, 전사);
    }
  }

  async function 끝(몸) {
    const 길 = 몸.길;
    if (!공급사들[길] && 길 !== '글' && 길 !== '은행') return [400, { 오류: '길이 없다' }];
    const 전사 = 전사고르기(몸.전사);
    const 세션 = typeof 몸.세션 === 'string' ? 몸.세션.slice(0, 120) : null;
    if (세션 && 끝난세션.has(세션)) return [409, { 오류: '이미 끝난 세션' }];
    if (세션) { 끝난세션.add(세션); 진행중.delete(세션); }
    const 진단 = 진단고르기(몸);
    if (길 === 'gpt-live') {
      const 초 = Math.max(0, Math.min(Number(몸.초) || 0, 3600));
      장부적기(장부, { 무엇: '세션', 길, 세션, 초, USD: Math.max(0, gptLive값(초) - gptLive값(0)), 끝확인: !!몸.끝확인, ...진단 });
    } else if (길 === 'realtime-mini') {
      const 사용 = 몸.사용 && typeof 몸.사용 === 'object' ? 몸.사용 : {};
      const 초 = Math.max(0, Math.min(Number(몸.초) || 0, 3600));
      // 학습자 받아쓰기(gpt-4o-mini-transcribe) 값은 응답 usage에 없어 세션 초로 어림한다(분당 $0.003)
      장부적기(장부, { 무엇: '세션', 길, 세션, 초, 사용, USD: realtime값(사용) + (초 / 60) * 0.003, 끝확인: !!몸.끝확인, ...진단 });
    } else if (길 === 'gemini-live') {
      // 무료 등급이라 0원 — 학생에게 열기 전 유료로 바꾸면 USD를 유료였다면 값으로 센다(설계 §10.5)
      const 사용 = 사용고르기(몸.사용);
      const 초 = Math.max(0, Math.min(Number(몸.초) || 0, 3600));
      장부적기(장부, { 무엇: '세션', 길, 세션, 초, 사용, USD: 0, 유료였다면USD: Number(gemini값(사용).toFixed(6)), 등급: '무료', 끝확인: !!몸.끝확인, ...진단 });
    } else if (길 === '은행') {
      // 차례마다 Gemini 무료 등급 한 번(장부 「차례」 줄) — 세션 줄은 초와 차례 수만
      const 초 = Math.max(0, Math.min(Number(몸.초) || 0, 3600));
      장부적기(장부, { 무엇: '세션', 길, 세션, 초, 차례: (세션 && 은행판.get(세션)?.차례) ?? null, USD: 0, 등급: '무료', 끝확인: !!몸.끝확인, ...진단 });
      if (세션) 은행판.delete(세션);
    }
    let 피드백 = null;
    if (!몸.피드백없이 && 전사.some((t) => t.누가 === '나')) {
      const 시작 = Date.now();
      try {
        피드백 = await 피드백만들기(전사);
        기록(`[상황극] 피드백 ${Date.now() - 시작}ms 버림 ${피드백.버림.length}`);
      } catch (e) {
        기록(`[상황극] 피드백 실패: ${String(e.message).slice(0, 120)}`);
        피드백 = { 실패: true };
      }
    }
    return [200, { 피드백, 계량: 지금계량() }];
  }

  async function 글차례(몸) {
    const 계 = 지금계량();
    if (계.막힘) return [429, { 오류: '이번 달 예산을 다 썼다', 계량: 계 }];
    const 대화 = 전사고르기(몸.대화).slice(-30);
    const 본문 = {
      model: 글모델,
      max_output_tokens: 300,
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: `${지시문(장면)}\n이번에는 소리 대신 글로 대화한다. 한 번에 1~2문장.` }] },
        ...(대화.length ? [] : [{ role: 'developer', content: [{ type: 'input_text', text: 첫인사지시(장면) }] }]),
        ...대화.map((t) => ({ role: t.누가 === '나' ? 'user' : 'assistant', content: [{ type: t.누가 === '나' ? 'input_text' : 'output_text', text: t.글 }] })),
      ],
    };
    const { 답: r } = await 응답부르기(본문);
    장부적기(장부, { 무엇: '차례', 길: '글', 사용: r.usage || null, USD: 글값(글모델, r.usage) });
    return [200, { 답: 출력글(r).trim(), 계량: 지금계량() }];
  }

  return http.createServer(async (req, res) => {
    const 주소 = new URL(req.url, 'http://127.0.0.1');
    try {
      if (주소.pathname.startsWith('/api/')) {
        if (req.method === 'POST') {
          const 출처 = req.headers.origin;
          const 내주소 = `http://${req.headers.host}`;
          if (출처 !== 내주소) return 답(res, 403, { 오류: '다른 곳에서 온 요청' });
        }
        const 길 = decodeURIComponent(주소.pathname);
        if (req.method === 'GET' && 길 === '/api/상태') return 답(res, 200, { 장면: 공개장면, 계량: 지금계량(), 길들: Object.fromEntries(Object.entries(공급사들).map(([k, v]) => [k, v.이름])) });
        if (req.method !== 'POST') return 답(res, 405, { 오류: 'POST만' });
        if (길 === '/api/은행차례') { const [상태, 내용] = await 은행차례(req, 주소); return 답(res, 상태, 내용); } // 몸이 JSON이 아니라 WAV
        const 몸 = await 몸읽기(req);
        const 처리 = { '/api/연결': 연결, '/api/끝': 끝, '/api/글차례': 글차례, '/api/넘김': 넘김, '/api/은행도움': 은행도움, '/api/은행마무리': 은행마무리 }[길];
        if (!처리) return 답(res, 404, { 오류: '없는 길' });
        const [상태, 내용] = await 처리(몸);
        return 답(res, 상태, 내용);
      }
      const 경로 = decodeURIComponent(주소.pathname);
      const 하온소리 = /^\/하온소리\/(\d{3})\.mp3$/.exec(경로); // 답 은행 길의 Zoe 녹음 줄(번호 파일만)
      let 파일 = 경로 === '/글꼴/SUIT-Variable.woff2' ? 글꼴 : 하온소리 ? path.join(소리폴더, `${하온소리[1]}.mp3`) : path.resolve(공개, `.${경로}`);
      if (파일 !== 글꼴 && !하온소리 && path.relative(공개, 파일).startsWith('..')) return 답(res, 403, { 오류: '밖' });
      if (fs.existsSync(파일) && (await stat(파일)).isDirectory()) 파일 = path.join(파일, 'index.html');
      const 형 = 종류[path.extname(파일)];
      if (!형 || !fs.existsSync(파일)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 형, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(await readFile(파일));
    } catch (e) {
      const 상태 = e.상태 && e.상태 >= 400 && e.상태 < 600 ? e.상태 : 500;
      기록(`[상황극] ${주소.pathname} 오류 ${상태}: ${String(e.message).slice(0, 160)}`);
      답(res, 상태 === 401 || 상태 === 403 ? 502 : 상태, { 오류: 상태 === 500 ? '서버 오류' : String(e.message).slice(0, 160) });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 서버 = 서버만들기();
  서버.listen(Number(process.env.PORT || 5250), '127.0.0.1', () => process.stdout.write(`실시간 상황극 시제품: http://127.0.0.1:${서버.address().port}/\n`));
}
