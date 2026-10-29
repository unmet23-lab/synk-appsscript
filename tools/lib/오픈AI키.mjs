/**
 * OpenAI API 키 차례와 부르기 — GPT Pro 구독의 월 API 크레딧을 쓰는 도구(`tools/GPT콘티굽기.mjs` · `tools/GPT시험관.mjs`)가 같이 쓴다.
 *
 * 차례: OPENAI_KEY_FILE 하나(시험 · 손으로 고를 때) → 키 목록 ~/SYNK_보안/openai_키목록.json(`[{이름, 파일, 까지?}]`, 파일은 목록 옆
 * 상대 경로, 「까지」 날 한국 시각 0시부터 그 키는 건너뛴다) → ~/SYNK_보안/openai.txt 하나. 키 값은 찍지 않는다.
 * 한 키가 크레딧 바닥(429 credit_balance_exhausted) · 키 거절(401) · 권한 없음(403)이면 다음 키로 다시 부른다 — 모두 결제 수단 없는
 * 무료 크레딧 조직이라 돈 드는 길이 아니다. 속도 제한 · 서버 오류 · 그 밖의 오류는 넘기지 않고 멈춘다. 마지막 키까지 바닥이면 코드 3.
 * 시험은 SYNK_OPENAI_BASE로 가짜 서버를, SYNK_OPENAI_KEYLIST로 임시 키 목록을 준다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 코드: 1 = API 오류 · 2 = 쓰는 법 · 키 파일 문제 · 3 = 크레딧 바닥(돈 드는 길로 돌리지 않음) */
export class 부르기오류 extends Error {
  constructor(코드, 말) {
    super(말);
    this.코드 = 코드;
  }
}

export const 바탕주소 = () => (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 보안 = () => path.join(os.homedir(), 'SYNK_보안');
export const 목록파일 = () => process.env.SYNK_OPENAI_KEYLIST || path.join(보안(), 'openai_키목록.json');

/** 쓸 키 차례 — 이름과 파일만. 값은 부르기 직전에 읽는다. */
export function 키차례() {
  if (process.env.OPENAI_KEY_FILE) return [{ 이름: path.basename(process.env.OPENAI_KEY_FILE), 파일: process.env.OPENAI_KEY_FILE }];
  const 목록경로 = 목록파일();
  if (!fs.existsSync(목록경로)) return [{ 이름: 'openai.txt', 파일: path.join(보안(), 'openai.txt') }];
  let 목록;
  try {
    목록 = JSON.parse(fs.readFileSync(목록경로, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new 부르기오류(2, `키 목록을 읽지 못했다: ${목록경로} (${e.message})`);
  }
  if (!Array.isArray(목록)) throw new 부르기오류(2, `키 목록은 [{이름, 파일, 까지?}] 배열이어야 한다: ${목록경로}`);
  return 목록
    .filter((k) => !k.까지 || Date.now() < Date.parse(`${k.까지}T00:00:00+09:00`))
    .map((k) => ({ 이름: k.이름 || k.파일, 파일: path.isAbsolute(k.파일) ? k.파일 : path.join(path.dirname(목록경로), k.파일) }));
}

function 키읽기({ 이름, 파일 }) {
  if (!fs.existsSync(파일)) throw new 부르기오류(2, `키 파일이 없다(${이름}): ${파일}`);
  const 값 = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '').trim();
  if (!/^sk-\S+$/.test(값)) throw new 부르기오류(2, `키 파일에 sk- 로 시작하는 값이 없다(${이름}): ${파일}`);
  return 값;
}

/**
 * 만들기() → { 주소, 몸, json } 을 키마다 새로 만들어 부른다. 성공하면 { 답, 글, 요청, 초, 쓴키 }.
 * 알림(말)은 다음 키로 넘길 때 한 줄씩 받는다.
 */
export async function 차례로부르기(만들기, { 알림 = () => {}, 제한ms = 15 * 60 * 1000 } = {}) {
  const 키들 = 키차례();
  if (!키들.length) throw new 부르기오류(3, `쓸 수 있는 키가 없다 — 키 목록의 「까지」가 모두 지났다: ${목록파일()}`);
  for (const [i, k] of 키들.entries()) {
    const { 주소, 몸, json } = 만들기();
    const 머리 = { Authorization: `Bearer ${키읽기(k)}` };
    if (json) 머리['Content-Type'] = 'application/json';
    const 시작 = Date.now();
    let res;
    try {
      res = await fetch(주소, { method: 'POST', headers: 머리, body: 몸, signal: AbortSignal.timeout(제한ms) });
    } catch (e) {
      throw new 부르기오류(1, `요청이 끝나지 않았다(${k.이름}): ${e.message}`);
    }
    const 초 = Math.round((Date.now() - 시작) / 1000);
    const 글 = await res.text();
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
      throw new 부르기오류(3, `API 크레딧이 바닥났다(마지막 키 ${k.이름} · ${res.status}) — 돈 드는 길로 돌리지 않는다. 크레딧이 든 조직의 키인지 docs/AI_계정과_크레딧.md 「GPT」를 본다(요청 ${요청})`);
    }
    throw new 부르기오류(1, `오류(${k.이름}) ${res.status} ${오류.code || ''}: ${오류.message || 글.slice(0, 300)} (요청 ${요청})`);
  }
  throw new 부르기오류(1, '부를 키가 없다');
}
