// 월 예산 계량기(2026-10-30 시제품) — 이 서버로 돈 세션만 장부에 적고, 이번 달(한국 시각) 쓴 값으로 길을 고른다.
// 쓴 값 < 70% → GPT-Live, 70~95% → Realtime 2.1 mini, ≥ 95% → 글 상황극. 조직 전체 사용량은 제한 키로 읽을 수 없어 세지 못한다.
import fs from 'node:fs';
import path from 'node:path';

// USD — GPT-Live 분당 $0.05(WebRTC는 시작 때 15초를 먼저 매기고 진행 초에서 뺀다 → 한 세션 최소 15초),
// Realtime 2.1 mini 음성 입력 $10 · 출력 $20 /100만(조사.md), 글 토큰은 mini 글 값을 어림으로. 글 모델은 OpenAI 값표(10-30).
export const 값표 = {
  'gpt-live': { 분: 0.05, 최소초: 15 },
  'realtime-mini': { 음성입력: 10e-6, 음성출력: 20e-6, 글입력: 0.6e-6, 글출력: 2.4e-6, 캐시: 0.06e-6 },
  'gpt-6.1-terra': { 입력: 1e-6, 출력: 5e-6, 캐시: 0.05e-6 },
  'gpt-6-luna': { 입력: 0.1e-6, 출력: 0.5e-6, 캐시: 0.01e-6 },
};
export const 문턱 = { mini: 0.7, 글: 0.95, 끝: 1 };
export const 글하루한도 = 10;

const 한국 = (ms) => new Date(ms + 9 * 3600e3);
const 한국날 = (ms) => 한국(ms).toISOString().slice(0, 10);
/** 예산 주기 — 구독 크레딧은 결제일마다 새로 차니(예: synk.yuh 11-08) 리셋 날을 설정으로 받는다. 그달 리셋 날 전이면 앞달 주기. */
export function 주기(ms, 리셋날 = 1) {
  const d = 한국(ms);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  if (d.getUTCDate() < 리셋날) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  return `${y}-${String(m + 1).padStart(2, '0')}~${리셋날}일`;
}
// 끝 보고가 오지 않은 GPT-Live 세션(탭 닫힘 · 새로 고침 · 서버 재시작)은 5분이 지나면 상한 + 15초를 다 쓴 것으로 본다 — 모자라게 세지 않게
export const 끝없는세션 = { 넘김ms: 5 * 60e3 };

export function gptLive값(초) {
  const 셈초 = Math.max(Number(초) || 0, 값표['gpt-live'].최소초);
  return (셈초 / 60) * 값표['gpt-live'].분;
}

/** Realtime response.done usage를 더한 것({음성입력, 음성출력, 글입력, 글출력, 캐시}) */
export function realtime값(사용 = {}) {
  const v = 값표['realtime-mini'];
  return (사용.음성입력 || 0) * v.음성입력 + (사용.음성출력 || 0) * v.음성출력 + (사용.글입력 || 0) * v.글입력 + (사용.글출력 || 0) * v.글출력 + (사용.캐시 || 0) * v.캐시;
}

/** Responses usage({input_tokens, output_tokens, input_tokens_details.cached_tokens}) */
export function 글값(모델, 사용 = {}) {
  const v = 값표[모델];
  if (!v) return 0;
  const 캐시 = 사용.input_tokens_details?.cached_tokens || 0;
  return ((사용.input_tokens || 0) - 캐시) * v.입력 + 캐시 * v.캐시 + (사용.output_tokens || 0) * v.출력;
}

export function 장부읽기(파일) {
  if (!fs.existsSync(파일)) return [];
  const 줄들 = [];
  for (const 줄 of fs.readFileSync(파일, 'utf8').split('\n')) {
    if (!줄.trim()) continue;
    try {
      const r = JSON.parse(줄);
      if (typeof r.USD === 'number' && Number.isFinite(r.USD) && r.때) 줄들.push(r);
    } catch { /* 깨진 줄은 건너뛴다 — 계량기가 멈추지 않게 */ }
  }
  return 줄들;
}

export function 장부적기(파일, 줄) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.appendFileSync(파일, `${JSON.stringify({ 때: new Date().toISOString(), ...줄, USD: Number((줄.USD || 0).toFixed(6)) })}\n`);
}

/** 이번 주기 쓴 값 · 비율 · 고를 길. 예산이 0이거나 이상하면 글로 내린다(돈을 못 세면 비싼 길을 열지 않는다).
 *  크레딧 바닥(429 credit_balance_exhausted)을 한 번 받은 주기는 장부 값과 상관없이 글로 간다. */
export function 계량({ 줄들, 예산USD, 지금 = Date.now(), 리셋날 = 1, 상한초 = 240 }) {
  const 이번 = 주기(지금, 리셋날);
  const 이번줄 = 줄들.filter((r) => 주기(Date.parse(r.때), 리셋날) === 이번);
  const 끝난 = new Set(이번줄.filter((r) => r.무엇 === '세션' && r.세션).map((r) => r.세션));
  const 끝없음 = 이번줄.filter((r) => r.무엇 === '세션시작' && r.길 === 'gpt-live' && r.세션 && !끝난.has(r.세션) && 지금 - Date.parse(r.때) > 끝없는세션.넘김ms);
  const 덧셈 = 끝없음.length * (gptLive값(상한초 + 15) - gptLive값(0));
  const 쓴값 = 이번줄.reduce((n, r) => n + r.USD, 0) + 덧셈;
  const 비율 = 예산USD > 0 ? 쓴값 / 예산USD : Infinity;
  const 오늘글 = 이번줄.filter((r) => r.길 === '글' && r.무엇 === '차례' && 한국날(Date.parse(r.때)) === 한국날(지금)).length;
  const 바닥 = 이번줄.some((r) => r.무엇 === '크레딧바닥');
  let 길 = 'gpt-live';
  if (!(비율 < 문턱.mini)) 길 = 'realtime-mini';
  if (!(비율 < 문턱.글) || 바닥) 길 = '글';
  const 막힘 = 비율 >= 문턱.끝 && 오늘글 >= 글하루한도;
  return {
    주기: 이번, 쓴값: Number(쓴값.toFixed(4)), 예산USD, 비율: Number.isFinite(비율) ? Number(비율.toFixed(4)) : null, 길, 바닥, 오늘글, 막힘,
    세션수: 이번줄.filter((r) => r.무엇 === '세션시작').length, 끝없는세션: 끝없음.length,
  };
}
