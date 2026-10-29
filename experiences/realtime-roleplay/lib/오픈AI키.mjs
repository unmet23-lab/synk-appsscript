// OpenAI 키 고르기 — tools/GPT콘티굽기.mjs와 같은 규칙(2026-10-30 실시간 상황극 시제품).
// 차례: OPENAI_KEY_FILE 하나 → ~/SYNK_보안/openai_키목록_상황극.json(있으면) 또는 openai_키목록.json(`[{이름, 파일, 까지?}]`, 「까지」 날 한국 시각 0시부터 건너뜀)
// → ~/SYNK_보안/openai.txt. 값은 부르기 직전에 읽고 어디에도 찍지 않는다. 모두 결제 수단 없는 월 크레딧 조직의 키라,
// 401 · 403 · 크레딧 바닥(credit_balance_exhausted)이면 다음 키로 넘겨도 돈 드는 길이 아니다. 그 밖의 오류는 넘기지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const 보안 = path.join(os.homedir(), 'SYNK_보안');

// 상황극 전용 키 목록(synk-roleplay-live-20261030 — 모델 호출 + 목소리 읽기, 10-30 유호님 「상황극 키 새로」)이 있으면 그것부터 쓴다 — 광고 콘티 키와 나눈다
const 기본목록 = () => [path.join(보안, 'openai_키목록_상황극.json'), path.join(보안, 'openai_키목록.json')].find((p) => fs.existsSync(p)) || path.join(보안, 'openai_키목록.json');

export function 키차례(목록파일 = process.env.SYNK_OPENAI_KEYLIST || 기본목록(), 지금 = Date.now()) {
  if (process.env.OPENAI_KEY_FILE) return [{ 이름: path.basename(process.env.OPENAI_KEY_FILE), 파일: process.env.OPENAI_KEY_FILE }];
  if (!fs.existsSync(목록파일)) return [{ 이름: 'openai.txt', 파일: path.join(보안, 'openai.txt') }];
  const 목록 = JSON.parse(fs.readFileSync(목록파일, 'utf8').replace(/^﻿/, ''));
  if (!Array.isArray(목록)) throw new Error(`키 목록은 [{이름, 파일, 까지?}] 배열이어야 한다: ${목록파일}`);
  return 목록
    .filter((k) => !k.까지 || 지금 < Date.parse(`${k.까지}T00:00:00+09:00`))
    .map((k) => ({ 이름: k.이름 || k.파일, 파일: path.isAbsolute(k.파일) ? k.파일 : path.join(path.dirname(목록파일), k.파일) }));
}

export function 키읽기({ 이름, 파일 }) {
  if (!fs.existsSync(파일)) throw new Error(`키 파일이 없다(${이름})`);
  const 값 = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '').trim();
  if (!/^sk-\S+$/.test(값)) throw new Error(`키 파일에 sk- 로 시작하는 값이 없다(${이름})`);
  return 값;
}

/** 부르기(키값)는 fetch Response를 돌려준다. 성공한 Response와 쓴 키 이름을 돌려주고, 넘길 수 있는 실패만 다음 키로 다시 부른다. */
export async function 키로부르기(부르기, 키들 = 키차례()) {
  if (!키들.length) throw Object.assign(new Error('쓸 수 있는 OpenAI 키가 없다'), { 상태: 503 });
  let 마지막;
  for (const [i, 키] of 키들.entries()) {
    const res = await 부르기(키읽기(키));
    if (res.ok) return { res, 키: 키.이름 };
    const 글 = await res.text();
    const 코드 = /"code"\s*:\s*"([^"]+)"/.exec(글)?.[1] || '';
    마지막 = Object.assign(new Error(`OpenAI ${res.status} ${코드}`.trim()), { 상태: res.status, 코드, 본문: 글.slice(0, 400) });
    const 넘김 = 코드 === 'credit_balance_exhausted' || res.status === 401 || res.status === 403;
    if (!넘김 || i === 키들.length - 1) throw 마지막;
  }
  throw 마지막;
}
