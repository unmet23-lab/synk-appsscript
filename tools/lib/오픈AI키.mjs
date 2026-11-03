/**
 * OpenAI API 키 차례와 부르기 — GPT Pro 구독의 월 API 크레딧을 쓰는 도구(`tools/GPT콘티굽기.mjs` · `tools/GPT시험관.mjs`)가 같이 쓴다.
 *
 * 차례: OPENAI_KEY_FILE 하나(시험 · 손으로 고를 때) → 키 목록 ~/SYNK_보안/openai_키목록.json(`[{이름, 파일, 까지?, 안씀?}]`, 파일은 목록 옆
 * 상대 경로, 「까지」 날 한국 시각 0시부터 그 키는 건너뛴다) → ~/SYNK_보안/openai.txt 하나. 키 값은 찍지 않는다.
 * 부르는 도구가 용도(예: '콘티')를 주면 「안씀」 배열에 그 용도가 든 키는 건너뛴다 — 크레딧을 다른 일 몫으로 남길 때 쓴다.
 * 한 키가 크레딧 바닥(429 credit_balance_exhausted) · 키 거절(401) · 권한 없음(403)이면 다음 키로 다시 부른다 — 모두 결제 수단 없는
 * 무료 크레딧 조직이라 돈 드는 길이 아니다. 속도 제한 · 서버 오류 · 그 밖의 오류는 넘기지 않고 멈춘다. 마지막 키까지 바닥이면 코드 3.
 * 시험은 SYNK_OPENAI_BASE로 가짜 서버를, SYNK_OPENAI_KEYLIST로 임시 키 목록을 준다.
 * 2026-11-03 유호님 「openai크레딧은 다른데 쓰지말고 여기에만 써」: 월 API 크레딧은 WORLD 말하기 받아 적기 몫이다. 용도 '말하기'가 아니면
 * 키를 내주지 않고 코드 3(쓸 크레딧 없음)으로 멈춘다 — 콘티 굽기는 그 자리에서 구독 경로로 넘어가고, 시험관 · 상황극 시제품은 부르지 않는다.
 * 가짜 서버 · 임시 키 목록을 준 시험은 크레딧을 쓰지 않으므로 막지 않는다.
 * 같은 날 유호님 「일단 제공되는 무료크레딧안에서 해결하자」: 「제2의 나」 사진 아바타 시범(용도 '사진')은 받아 적기 몫을 먼저 떼고 남은
 * 만큼만 쓴다. 사진 몫 파일(~/SYNK_보안/openai_사진몫.json — 주기 · 월 크레딧 · 지난 주기 받아 적기 실사용)로 상한을 셈하고, 사진 장부
 * (~/SYNK_보안/openai_사진장부.jsonl)에 부를 때마다 어림을 먼저 적는다. 넘치면 코드 3 — 굽기는 「배송 지연」으로 미루고 돈 드는 길로 돌리지 않는다.
 * 돈이 들지 않는 부르기(파일 지우기 · 결과 받기)는 어림 0으로 불러 막지 않는다 — 학생 사진 지우기가 몫 때문에 멈추면 안 된다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 코드: 1 = API 오류 · 2 = 쓰는 법 · 키 파일 문제 · 3 = 크레딧 바닥(돈 드는 길로 돌리지 않음). 상태 = API가 JSON 오류로 답한 HTTP 상태(그때만) */
export class 부르기오류 extends Error {
  constructor(코드, 말, 상태) {
    super(말);
    this.코드 = 코드;
    if (상태 !== undefined) this.상태 = 상태;
  }
}

export const 바탕주소 = () => (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 보안 = () => path.join(os.homedir(), 'SYNK_보안');
export const 목록파일 = () => process.env.SYNK_OPENAI_KEYLIST || path.join(보안(), 'openai_키목록.json');

/** 쓸 키 차례 — 이름과 파일만. 값은 부르기 직전에 읽는다. 용도를 주면 「안씀」에 그 용도가 든 키를 뺀다. */
export function 키차례(용도) {
  return 목록키(용도).쓸;
}

/** OpenAI 월 API 크레딧을 쓸 수 있는 용도 — WORLD 말하기 받아 적기(운영 talk 비밀값과 같은 몫)와, 그 몫을 남긴 만큼의 「제2의 나」 사진 */
export const 크레딧용도 = Object.freeze(['말하기', '사진']);

export const 사진몫파일 = () => process.env.SYNK_OPENAI_PHOTO_BUDGET || path.join(보안(), 'openai_사진몫.json');
export const 사진장부파일 = () => process.env.SYNK_OPENAI_PHOTO_LEDGER || path.join(보안(), 'openai_사진장부.jsonl');
/** 받아 적기 몫 = 지난 주기 실사용의 3배, 적어도 $20 — 학생이 늘어도 한 주기 안에서 받아 적기가 먼저 바닥나지 않게(2026-11-03) */
export const 받아적기몫 = (지난실사용) => Math.max(20, 3 * 지난실사용);
/** 기록 어림은 사용 화면보다 약 26% 낮게 나왔다(10-30 실측) — 장부에는 1.3배로 적는다 */
export const 어림보정 = 1.3;

const 날 = (s) => Date.parse(`${s}T00:00:00+09:00`);

/** 사진 몫 파일을 읽어 지금 주기의 상한을 낸다 — 없거나 주기가 지났거나 숫자가 맞지 않으면 코드 3(사진 굽기를 열지 않음) */
export function 사진몫(지금 = Date.now()) {
  const 파일 = 사진몫파일();
  if (!fs.existsSync(파일)) throw new 부르기오류(3, `사진 몫이 정해지지 않았다 — ${파일}에 주기 · 월 크레딧 · 지난 주기 받아 적기 실사용을 적어야 사진 굽기를 연다(받아 적기가 먼저, 결정 11-03)`);
  let 몫;
  try {
    몫 = JSON.parse(fs.readFileSync(파일, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new 부르기오류(3, `사진 몫 파일을 읽지 못했다: ${파일} (${e.message})`);
  }
  if (!몫 || typeof 몫 !== 'object' || Array.isArray(몫)) throw new 부르기오류(3, `사진 몫 파일 꼴이 맞지 않다: ${파일} — 맨 위가 {…} 객체여야 한다`);
  const 시작 = 날(몫?.주기?.시작), 끝 = 날(몫?.주기?.끝);
  // 금액은 JSON 숫자만 받는다 — null · 빈 글 · false를 0으로 읽으면 모르는 받아 적기 실사용이 0이 되어 몫이 커진다. 여유만 빠졌을 때 10
  const 크레딧 = 몫?.월크레딧USD, 실사용 = 몫?.받아적기?.지난주기실사용USD, 여유 = 몫 && !('여유USD' in 몫) ? 10 : 몫?.여유USD;
  const 금액 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (![시작, 끝].every(Number.isFinite) || 끝 <= 시작 || ![크레딧, 실사용, 여유].every(금액)) {
    throw new 부르기오류(3, `사진 몫 파일 꼴이 맞지 않다: ${파일} — {주기:{시작,끝}, 월크레딧USD, 받아적기:{지난주기실사용USD}, 여유USD}`);
  }
  if (지금 < 시작 || 지금 >= 끝) throw new 부르기오류(3, `사진 몫의 주기(${몫.주기.시작}~${몫.주기.끝})가 지금이 아니다 — 새 주기의 받아 적기 실사용을 보고 다시 적는다`);
  const 남길 = 받아적기몫(실사용);
  return { 시작, 끝, 상한: Math.max(0, 크레딧 - 남길 - 여유), 남길, 주기: 몫.주기 };
}

/** 이번 주기에 사진 장부에 적힌 합(USD). 금액이 숫자가 아니거나 때를 읽을 수 없는 줄이 하나라도 있으면 쓴 돈을 모르므로 코드 3 */
export function 사진씀(시작, 끝) {
  const 파일 = 사진장부파일();
  if (!fs.existsSync(파일)) return 0;
  let 합 = 0;
  const 깨짐 = (말) => new 부르기오류(3, `사진 장부 줄이 깨졌다(${말}): ${파일} — 고치기 전에는 사진 굽기를 열지 않는다`);
  for (const 줄 of fs.readFileSync(파일, 'utf8').split('\n')) {
    if (!줄.trim()) continue;
    let r;
    try { r = JSON.parse(줄); } catch { throw 깨짐('JSON 아님'); }
    const t = Date.parse(r?.때);
    if (typeof r?.USD !== 'number' || !Number.isFinite(r.USD)) throw 깨짐('USD가 숫자가 아님');
    if (!Number.isFinite(t)) throw 깨짐('때를 읽을 수 없음');
    if (t >= 시작 && t < 끝) 합 += r.USD;
  }
  return 합;
}

/** 사진 부르기 전 몫을 보고 장부에 어림(보정)을 먼저 적는다. 어림 0(지우기 · 받기)은 적지도 막지도 않는다. 적은 값과 때를 돌려준다(되돌림은 같은 때로 — 주기를 넘겨도 같은 주기에서 빠지게). */
function 사진몫잡기(어림USD, 메모) {
  if (typeof 어림USD !== 'number' || !Number.isFinite(어림USD) || 어림USD < 0) {
    throw new 부르기오류(2, '용도 「사진」은 어림USD(이 부르기의 어림 값, 지우기 · 받기는 0)를 숫자로 줘야 한다');
  }
  if (어림USD === 0) return null;
  const { 시작, 끝, 상한, 남길, 주기 } = 사진몫();
  const 적을 = Number((어림USD * 어림보정).toFixed(4));
  const 씀 = 사진씀(시작, 끝);
  if (씀 + 적을 > 상한) {
    throw new 부르기오류(3, `사진 몫이 모자라다(이번 주기 ${주기.시작}~${주기.끝} 상한 $${상한.toFixed(2)} · 씀 $${씀.toFixed(2)} · 이번 $${적을.toFixed(2)}, 받아 적기 몫 $${남길.toFixed(2)}는 남김) — 굽기를 「배송 지연」으로 미루고 다음 주기(${주기.끝})를 기다린다. 돈 드는 길로 돌리지 않는다`);
  }
  const 때 = new Date().toISOString();
  fs.mkdirSync(path.dirname(사진장부파일()), { recursive: true });
  fs.appendFileSync(사진장부파일(), JSON.stringify({ 때, USD: 적을, 메모: 메모 || '' }) + '\n');
  return { 적을, 때 };
}

/** 값이 나가지 않은 것이 분명한 실패만 — 크레딧 바닥(코드 3) · 키 파일 문제(코드 2, 보내기 전) · API가 4xx JSON 오류로 거절. 끝나지 않음 · 본문을 다 못 읽음 · 5xx · 모르는 오류는 쓴 것으로 둔다 */
function 값안나감(e) {
  return e instanceof 부르기오류 && (e.코드 === 3 || e.코드 === 2 || (e.코드 === 1 && e.상태 >= 400 && e.상태 < 500));
}

/** 키 목록에서 쓸 키와, 용도 때문에 뺀 키 이름을 함께 낸다 */
function 목록키(용도) {
  if (!크레딧용도.includes(용도) && !process.env.SYNK_OPENAI_BASE && !process.env.SYNK_OPENAI_KEYLIST) {
    throw new 부르기오류(3, `OpenAI API 크레딧은 WORLD 말하기 받아 적기에만 쓴다(2026-11-03 유호님) — 용도 「${용도 || '없음'}」에는 키를 내주지 않는다(docs/AI_계정과_크레딧.md 「GPT」)`);
  }
  if (process.env.OPENAI_KEY_FILE) return { 쓸: [{ 이름: path.basename(process.env.OPENAI_KEY_FILE), 파일: process.env.OPENAI_KEY_FILE }], 뺌: [] };
  const 목록경로 = 목록파일();
  if (!fs.existsSync(목록경로)) return { 쓸: [{ 이름: 'openai.txt', 파일: path.join(보안(), 'openai.txt') }], 뺌: [] };
  let 목록;
  try {
    목록 = JSON.parse(fs.readFileSync(목록경로, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new 부르기오류(2, `키 목록을 읽지 못했다: ${목록경로} (${e.message})`);
  }
  if (!Array.isArray(목록)) throw new 부르기오류(2, `키 목록은 [{이름, 파일, 까지?, 안씀?}] 배열이어야 한다: ${목록경로}`);
  const 산 = 목록.filter((k) => !k.까지 || Date.now() < Date.parse(`${k.까지}T00:00:00+09:00`));
  const 막힘 = (k) => Boolean(용도) && Array.isArray(k.안씀) && k.안씀.includes(용도);
  return {
    쓸: 산.filter((k) => !막힘(k)).map((k) => ({ 이름: k.이름 || k.파일, 파일: path.isAbsolute(k.파일) ? k.파일 : path.join(path.dirname(목록경로), k.파일) })),
    뺌: 산.filter(막힘).map((k) => k.이름 || k.파일),
  };
}

function 키읽기({ 이름, 파일 }) {
  if (!fs.existsSync(파일)) throw new 부르기오류(2, `키 파일이 없다(${이름}): ${파일}`);
  const 값 = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '').trim();
  if (!/^sk-\S+$/.test(값)) throw new 부르기오류(2, `키 파일에 sk- 로 시작하는 값이 없다(${이름}): ${파일}`);
  return 값;
}

/**
 * 만들기() → { 주소, 몸, json } 을 키마다 새로 만들어 부른다. 성공하면 { 답, 글, 요청, 초, 쓴키 }.
 * 알림(말)은 다음 키로 넘길 때 한 줄씩 받는다. 용도는 키 목록의 「안씀」과 맞춰 본다.
 * 용도 '사진'은 어림USD(돈이 안 드는 지우기 · 받기는 0)를 함께 주고, 사진 몫 안에서만 부른다 — API가 거절한 부르기는 적은 어림을 되돌린다.
 * 키이름을 주면 그 키 하나로만 부른다(일괄 처리의 파일 · 묶음은 만든 조직의 키로만 받고 지운다). 날글이면 JSON으로 읽지 않는다(묶음 결과 JSONL).
 */
export async function 차례로부르기(만들기, { 알림 = () => {}, 제한ms = 15 * 60 * 1000, 용도, 어림USD, 메모, 방법 = 'POST', 키이름, 날글 = false } = {}) {
  const { 쓸: 모든키, 뺌 } = 목록키(용도);
  const 키들 = 키이름 ? 모든키.filter((k) => k.이름 === 키이름) : 모든키;
  const 뺀말 = 뺌.length ? ` — 「${용도}」에 쓰지 않기로 한 키(${뺌.join(', ')})는 부르지 않았다(docs/AI_계정과_크레딧.md 「GPT」)` : '';
  if (키이름 && !키들.length) throw new 부르기오류(2, `키 「${키이름}」가 키 목록에 없다: ${목록파일()}`);
  if (!키들.length) throw new 부르기오류(3, `쓸 수 있는 키가 없다 — 키 목록의 「까지」가 지났거나 「안씀」으로 막혔다: ${목록파일()}${뺀말}`);
  const 잡음 = 용도 === '사진' ? 사진몫잡기(어림USD, 메모) : null;
  try {
    return await 키마다부르기(만들기, 키들, 뺀말, { 알림, 제한ms, 방법, 날글 });
  } catch (e) {
    if (잡음 && 값안나감(e)) {
      fs.appendFileSync(사진장부파일(), JSON.stringify({ 때: 잡음.때, USD: -잡음.적을, 메모: `되돌림 ${메모 || ''}`.trim() }) + '\n');
    }
    throw e;
  }
}

async function 키마다부르기(만들기, 키들, 뺀말, { 알림, 제한ms, 방법, 날글 }) {
  for (const [i, k] of 키들.entries()) {
    const { 주소, 몸, json } = 만들기();
    const 머리 = { Authorization: `Bearer ${키읽기(k)}` };
    if (json) 머리['Content-Type'] = 'application/json';
    const 시작 = Date.now();
    let res;
    try {
      res = await fetch(주소, { method: 방법, headers: 머리, ...(몸 === undefined ? {} : { body: 몸 }), signal: AbortSignal.timeout(제한ms) });
    } catch (e) {
      throw new 부르기오류(1, `요청이 끝나지 않았다(${k.이름}): ${e.message}`);
    }
    const 초 = Math.round((Date.now() - 시작) / 1000);
    let 글;
    try {
      글 = await res.text();
    } catch (e) {
      throw new 부르기오류(1, `답을 다 읽지 못했다(${k.이름} · ${res.status}): ${e.message}`);
    }
    if (날글 && res.ok) return { 글, 요청: res.headers.get('x-request-id'), 초, 쓴키: k.이름 };
    let 답;
    try {
      답 = JSON.parse(글);
    } catch {
      throw new 부르기오류(1, `JSON이 아닌 답(${k.이름} · ${res.status}): ${글.slice(0, 300)}`);
    }
    const 요청 = res.headers.get('x-request-id');
    if (res.ok && !답.error) return { 답, 글, 요청, 초, 쓴키: k.이름 };
    const 오류 = 답.error || {};
    const 바닥 = 오류.code === 'credit_balance_exhausted';
    if ((바닥 || res.status === 401 || res.status === 403) && i < 키들.length - 1) {
      알림(`${k.이름} 키: ${res.status} ${오류.code || ''} — 다음 키(${키들[i + 1].이름})로 다시 부른다`);
      continue;
    }
    if (바닥) {
      throw new 부르기오류(3, `API 크레딧이 바닥났다(마지막 키 ${k.이름} · ${res.status}) — 돈 드는 길로 돌리지 않는다. 크레딧이 든 조직의 키인지 docs/AI_계정과_크레딧.md 「GPT」를 본다(요청 ${요청})${뺀말}`);
    }
    throw new 부르기오류(1, `오류(${k.이름}) ${res.status} ${오류.code || ''}: ${오류.message || 글.slice(0, 300)} (요청 ${요청})`, res.status);
  }
  throw new 부르기오류(1, '부를 키가 없다');
}
