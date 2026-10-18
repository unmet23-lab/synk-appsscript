#!/usr/bin/env node
'use strict';
/**
 * Claude API 키 여러 개를 크레딧 순서대로 쓰는 공용 통로.
 *
 * Max·Team 플랜마다 Console 조직 하나에 매달 API 크레딧이 들어오고 결제일에 사라진다(이월 없음).
 * 그래서 갱신일이 가장 가까운(곧 사라질) 키부터 쓰고, 「credit balance is too low」로 거절되면
 * 그 키를 다음 갱신일까지 소진으로 표시한 뒤 다음 키로 같은 요청을 보낸다.
 * 크레딧 부족·인증 실패는 처리 전에 거절되므로 다시 보내도 두 번 청구되지 않는다.
 * 그 밖의 오류(429·5xx·시간 초과·연결 끊김)는 다른 키로 넘기지 않고 멈춘다. 429를 다른 키로
 * 돌리면 속도 제한을 우회하게 되고, 시간 초과는 이미 청구됐을 수 있기 때문이다.
 *
 * 키 값은 출력·기록하지 않는다. 키 목록·상태·사용 기록은 저장소 밖 `~/SYNK_보안/`에 둔다.
 *   클로드_키목록.json  {"키":[{"이름":"유호","키파일":"클로드_API.txt","갱신일":17}]}
 *                       키파일은 목록 파일 기준 상대 경로, 갱신일은 결제일(1~31, 모르면 null)
 *   클로드_키상태.json  소진·키오류 표시(이 도구가 씀)
 *   클로드_사용기록.jsonl  호출마다 키 이름·모델·토큰·추정 비용(이 도구가 씀)
 *
 * 사용:
 *   const 클로드 = require('./tools/lib/클로드키.js');
 *   const { 응답, 키이름 } = await 클로드.보내기({ model: 'claude-opus-5-5', max_tokens: 1024,
 *     messages: [{ role: 'user', content: '…' }] }, { 용도: 'learning-blind' });
 *   node tools/lib/클로드키.js --상태          키별 갱신일·상태·이번 주기 추정 사용액
 *   node tools/lib/클로드키.js --풀기 <이름>   소진·키오류 표시를 지운다
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const 주소 = 'https://api.anthropic.com/v1/messages';
const 버전 = '2023-06-01';
const 하루 = 24 * 60 * 60 * 1000;
// 갱신일을 모르는 키는 하루 뒤 다시 시도한다. 크레딧 부족 거절은 청구되지 않는다.
const 모름재시도 = 하루;

// 일반 단가(USD / 100만 토큰). 추정용이며 청구서가 아니다. 캐시 단가는 따로 셈하지 않는다.
const 단가 = Object.freeze({
  'claude-fable-5-1': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
});

function 기본경로() {
  const 폴더 = path.join(os.homedir(), 'SYNK_보안');
  return {
    목록경로: process.env.SYNK_CLAUDE_KEYS || path.join(폴더, '클로드_키목록.json'),
    상태경로: process.env.SYNK_CLAUDE_KEY_STATE || path.join(폴더, '클로드_키상태.json'),
    기록경로: process.env.SYNK_CLAUDE_KEY_LEDGER || path.join(폴더, '클로드_사용기록.jsonl'),
  };
}

function 경로들(옵션 = {}) {
  const 기본 = 기본경로();
  const 고름 = {
    목록경로: 옵션.목록경로 || 기본.목록경로,
    상태경로: 옵션.상태경로 || 기본.상태경로,
    기록경로: 옵션.기록경로 || 기본.기록경로,
  };
  // node --test 안에서 실제 보안 폴더를 읽지 않는다(현장 노트: 시험이 실제 키를 보낸 사고).
  if (process.env.NODE_TEST_CONTEXT && !(옵션.목록경로 && 옵션.상태경로 && 옵션.기록경로)) {
    throw new Error('시험 중에는 목록·상태·기록 경로를 모두 직접 넘겨야 한다(실제 키 폴더 차단)');
  }
  return 고름;
}

function JSON읽기(파일, 없을때) {
  try { return JSON.parse(fs.readFileSync(파일, 'utf8').replace(/^﻿/, '')); }
  catch (e) { if (e.code === 'ENOENT') return 없을때; throw new Error(`${path.basename(파일)}을 읽지 못했다: ${e.message}`); }
}

// 덮어쓰다 실패해도 원본이 남도록 임시 파일에 쓴 뒤 바꾼다.
function JSON쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 2) + '\n');
  fs.renameSync(임시, 파일);
}

function 목록읽기(목록경로) {
  const 목록 = JSON읽기(목록경로, null);
  if (!목록) throw new Error(`키 목록이 없다: ${목록경로}`);
  if (!Array.isArray(목록.키) || 목록.키.length === 0) throw new Error('키 목록의 「키」 배열이 비었다');
  const 이름들 = new Set();
  return 목록.키.map((항목, i) => {
    if (!항목 || typeof 항목.이름 !== 'string' || !항목.이름.trim()) throw new Error(`키 ${i + 1}번에 이름이 없다`);
    if (이름들.has(항목.이름)) throw new Error(`키 이름이 겹친다: ${항목.이름}`);
    이름들.add(항목.이름);
    if (typeof 항목.키파일 !== 'string' || !항목.키파일) throw new Error(`${항목.이름}: 키파일이 없다`);
    const 갱신일 = 항목.갱신일 ?? null;
    if (갱신일 !== null && !(Number.isInteger(갱신일) && 갱신일 >= 1 && 갱신일 <= 31)) throw new Error(`${항목.이름}: 갱신일은 1~31 또는 null`);
    return { 순번: i, 이름: 항목.이름, 키파일: path.resolve(path.dirname(목록경로), 항목.키파일), 갱신일 };
  });
}

// 기준 시각 뒤에 오는 첫 갱신일 0시(이 PC 시간대). 짧은 달은 말일로 당긴다.
function 다음갱신(갱신일, 기준) {
  if (갱신일 === null) return null;
  const 날 = (y, m) => new Date(y, m, Math.min(갱신일, new Date(y, m + 1, 0).getDate()));
  let 후보 = 날(기준.getFullYear(), 기준.getMonth());
  if (후보 <= 기준) 후보 = 날(기준.getFullYear(), 기준.getMonth() + 1);
  return 후보;
}

function 이전갱신(갱신일, 기준) {
  const 다음 = 다음갱신(갱신일, 기준);
  if (!다음) return null;
  const 날 = (y, m) => new Date(y, m, Math.min(갱신일, new Date(y, m + 1, 0).getDate()));
  return 날(다음.getFullYear(), 다음.getMonth() - 1);
}

function 키값(키) {
  let 값;
  try { 값 = fs.readFileSync(키.키파일, 'utf8').replace(/^﻿/, '').trim(); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  return /^sk-ant-\S+$/.test(값) ? 값 : null;
}

// 쓸 수 있는 키를 곧 사라질 크레딧부터. 갱신일 모르는 키는 뒤로, 같으면 목록 순서.
function 순서(키들, 상태, 지금) {
  const 쓸수있음 = 키들.filter((키) => {
    const 표시 = 상태[키.이름];
    if (!표시) return true;
    if (표시.상태 === '키오류') return false;
    return 표시.풀림 && new Date(표시.풀림) <= 지금;
  });
  const 무한 = 8.64e15;
  return 쓸수있음.sort((a, b) => {
    const da = 다음갱신(a.갱신일, 지금), db = 다음갱신(b.갱신일, 지금);
    return ((da ? +da : 무한) - (db ? +db : 무한)) || (a.순번 - b.순번);
  });
}

function 가리기(글, 키들값) {
  let s = String(글 ?? '');
  for (const v of 키들값) if (v) s = s.split(v).join('[REDACTED]');
  return s.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[REDACTED]');
}

function 크레딧부족(http, body) {
  return http >= 400 && http < 500 && /credit balance is too low/i.test(String(body?.error?.message ?? ''));
}

function 추정USD(model, usage) {
  const 표 = 단가[model];
  if (!표 || !usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens)) return null;
  const 입력 = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (입력 * 표[0] + usage.output_tokens * 표[1]) / 1e6;
}

function 오류(code, 메시지, 덧붙임 = {}) {
  return Object.assign(new Error(메시지), { code }, 덧붙임);
}

/**
 * 요청 본문을 크레딧이 남은 키로 보낸다. 성공하면 { 응답, 키이름, http, 건너뛴키 }.
 * 옵션: 용도(기록용 이름), 목록경로·상태경로·기록경로, fetch(시험용), 지금(Date, 시험용), 시간제한(ms)
 */
async function 보내기(본문, 옵션 = {}) {
  if (!본문 || typeof 본문 !== 'object' || typeof 본문.model !== 'string') throw new Error('요청 본문에 model이 없다');
  const { 목록경로, 상태경로, 기록경로 } = 경로들(옵션);
  const 보낼것 = 옵션.fetch || globalThis.fetch;
  const 지금 = 옵션.지금 || new Date();
  const 키들 = 목록읽기(목록경로);
  const 상태 = JSON읽기(상태경로, {});
  const 건너뛴키 = [];
  const 본문글 = JSON.stringify(본문);

  for (const 키 of 순서(키들, 상태, 지금)) {
    const 값 = 키값(키);
    if (!값) { 건너뛴키.push({ 이름: 키.이름, 이유: '키파일없음' }); continue; }
    let 응답, body, 글;
    try {
      응답 = await 보낼것(주소, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(옵션.시간제한 || 600000),
        headers: { 'content-type': 'application/json', 'anthropic-version': 버전, 'x-api-key': 값 },
        body: 본문글,
      });
      글 = await 응답.text();
    } catch (e) {
      throw 오류('클로드키_결과모름', `${키.이름}: 응답을 받지 못했다(청구됐을 수 있어 다른 키로 넘기지 않음) — ${가리기(e.message, [값])}`, { 키이름: 키.이름, 청구모름: true });
    }
    try { body = JSON.parse(글); } catch { body = null; }

    if (크레딧부족(응답.status, body) || 응답.status === 401) {
      const 키오류 = 응답.status === 401;
      const 다음 = 다음갱신(키.갱신일, 지금);
      상태[키.이름] = 키오류
        ? { 상태: '키오류', 표시: 지금.toISOString(), http: 401 }
        : { 상태: '소진', 표시: 지금.toISOString(), 풀림: (다음 || new Date(+지금 + 모름재시도)).toISOString() };
      JSON쓰기(상태경로, 상태);
      건너뛴키.push({ 이름: 키.이름, 이유: 키오류 ? '키오류' : '크레딧소진' });
      continue;
    }

    const usage = body?.usage ?? null;
    fs.mkdirSync(path.dirname(기록경로), { recursive: true });
    fs.appendFileSync(기록경로, JSON.stringify({
      시각: 지금.toISOString(), 키이름: 키.이름, 용도: 옵션.용도 ?? null, model: 본문.model,
      http: 응답.status, usage, 추정USD: 추정USD(본문.model, usage),
    }) + '\n');

    if (!응답.ok) {
      throw 오류('클로드키_요청실패', `${키.이름}: HTTP ${응답.status} ${가리기(body?.error?.type ?? '', [값])} ${가리기(body?.error?.message ?? 글.slice(0, 300), [값])}`.trim(),
        { 키이름: 키.이름, http: 응답.status, 응답: body });
    }
    return { 응답: body, 키이름: 키.이름, http: 응답.status, 건너뛴키 };
  }
  throw 오류('클로드키_모두소진', `쓸 수 있는 키가 없다 — ${건너뛴키.map((k) => `${k.이름}:${k.이유}`).join(', ') || '모두 소진 표시 중'}. --상태로 확인`, { 건너뛴키 });
}

function 상태보기(옵션 = {}) {
  const { 목록경로, 상태경로, 기록경로 } = 경로들(옵션);
  const 지금 = 옵션.지금 || new Date();
  const 키들 = 목록읽기(목록경로);
  const 상태 = JSON읽기(상태경로, {});
  let 기록 = [];
  try { 기록 = fs.readFileSync(기록경로, 'utf8').split('\n').filter(Boolean).map((줄) => JSON.parse(줄)); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const 순번 = new Map(순서(키들, 상태, 지금).map((키, i) => [키.이름, i + 1]));
  return 키들.map((키) => {
    const 표시 = 상태[키.이름];
    const 시작 = 이전갱신(키.갱신일, 지금);
    const 이번 = 기록.filter((r) => r.키이름 === 키.이름 && (!시작 || new Date(r.시각) >= 시작));
    return {
      이름: 키.이름,
      키파일: 키값(키) ? '있음' : '없음/형식다름',
      갱신일: 키.갱신일,
      다음갱신: 다음갱신(키.갱신일, 지금)?.toISOString().slice(0, 10) ?? null,
      상태: !표시 ? '사용가능' : 표시.상태 === '키오류' ? '키오류' : new Date(표시.풀림) <= 지금 ? '사용가능(재확인)' : `소진~${표시.풀림.slice(0, 10)}`,
      쓰는순서: 순번.get(키.이름) ?? null,
      이번주기호출: 이번.length,
      이번주기추정USD: Number(이번.reduce((s, r) => s + (r.추정USD ?? 0), 0).toFixed(6)),
    };
  });
}

function 풀기(이름, 옵션 = {}) {
  const { 상태경로 } = 경로들(옵션);
  const 상태 = JSON읽기(상태경로, {});
  if (!상태[이름]) return false;
  delete 상태[이름];
  JSON쓰기(상태경로, 상태);
  return true;
}

/**
 * 크레딧이 남은 키 하나를 고른다 — `claude -p`·Managed Agents처럼 키를 다른 프로그램에 넘겨야 할 때 쓴다.
 * 곧 사라질 크레딧부터 1토큰 확인 요청(Haiku 5.5 · 1센트의 만분의 일 수준)을 보내 200이면 그 키다.
 * 크레딧 부족·401은 보내기()와 같은 표시를 남기고 다음 키로, 그 밖의 실패(429·5xx·연결)는 표시 없이 다음 키로 간다.
 * 돌려주는 `값`은 부른 프로세스 안에서만 쓴다(출력·기록 금지). 고를 키가 없으면 { 이름: null, 건너뛴키 }.
 */
async function 키고르기(옵션 = {}) {
  const { 목록경로, 상태경로, 기록경로 } = 경로들(옵션);
  const 보낼것 = 옵션.fetch || globalThis.fetch;
  const 지금 = 옵션.지금 || new Date();
  const 키들 = 목록읽기(목록경로);
  const 상태 = JSON읽기(상태경로, {});
  const 건너뛴키 = [];
  for (const 키 of 순서(키들, 상태, 지금)) {
    const 값 = 키값(키);
    if (!값) { 건너뛴키.push({ 이름: 키.이름, 이유: '키파일없음' }); continue; }
    let 응답, body = null;
    try {
      응답 = await 보낼것(주소, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(옵션.시간제한 || 30000),
        headers: { 'content-type': 'application/json', 'anthropic-version': 버전, 'x-api-key': 값 },
        body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: '.' }] }),
      });
      try { body = JSON.parse(await 응답.text()); } catch { body = null; }
    } catch (e) {
      건너뛴키.push({ 이름: 키.이름, 이유: `확인실패(${가리기(e.message, [값]).slice(0, 80)})` });
      continue;
    }
    if (응답.ok) {
      fs.mkdirSync(path.dirname(기록경로), { recursive: true });
      fs.appendFileSync(기록경로, JSON.stringify({ 시각: 지금.toISOString(), 키이름: 키.이름, 용도: `키확인:${옵션.용도 ?? ''}`,
        model: 'claude-haiku-5-5', http: 응답.status, usage: body?.usage ?? null, 추정USD: 추정USD('claude-haiku-5-5', body?.usage) }) + '\n');
      return { 이름: 키.이름, 값, 건너뛴키 };
    }
    if (크레딧부족(응답.status, body) || 응답.status === 401) {
      표시하기(키, 응답.status === 401 ? '키오류' : '소진', { 상태경로, 지금, 상태 });
      건너뛴키.push({ 이름: 키.이름, 이유: 응답.status === 401 ? '키오류' : '크레딧소진' });
      continue;
    }
    건너뛴키.push({ 이름: 키.이름, 이유: `HTTP ${응답.status}` });
  }
  return { 이름: null, 값: null, 건너뛴키 };
}

function 표시하기(키, 종류, { 상태경로, 지금, 상태 = JSON읽기(상태경로, {}) }) {
  const 다음 = 다음갱신(키.갱신일, 지금);
  상태[키.이름] = 종류 === '키오류'
    ? { 상태: '키오류', 표시: 지금.toISOString(), http: 401 }
    : { 상태: '소진', 표시: 지금.toISOString(), 풀림: (다음 || new Date(+지금 + 모름재시도)).toISOString() };
  JSON쓰기(상태경로, 상태);
}

/** 다른 프로그램이 그 키로 돌다가 「credit balance is too low」를 받았을 때 표시한다. */
function 소진표시(이름, 옵션 = {}) {
  const { 목록경로, 상태경로 } = 경로들(옵션);
  const 키 = 목록읽기(목록경로).find((k) => k.이름 === 이름);
  if (!키) return false;
  표시하기(키, '소진', { 상태경로, 지금: 옵션.지금 || new Date() });
  return true;
}

/** 다른 프로그램(claude -p·Managed Agents)이 쓴 비용을 같은 사용 기록에 남긴다. 키 값은 받지 않는다. */
function 기록남기기(행, 옵션 = {}) {
  const { 기록경로 } = 경로들(옵션);
  fs.mkdirSync(path.dirname(기록경로), { recursive: true });
  fs.appendFileSync(기록경로, JSON.stringify({ 시각: (옵션.지금 || new Date()).toISOString(), ...행 }) + '\n');
}

/** 이름으로 키 값만 읽는다(크레딧 확인 없이) — 이미 만든 클라우드 세션을 그 키의 조직에서 다시 볼 때 쓴다. */
function 키읽기(이름, 옵션 = {}) {
  const { 목록경로 } = 경로들(옵션);
  const 키 = 목록읽기(목록경로).find((k) => k.이름 === 이름);
  return 키 ? { 이름: 키.이름, 값: 키값(키) } : { 이름: null, 값: null };
}

module.exports = { 보내기, 상태보기, 풀기, 키고르기, 키읽기, 소진표시, 기록남기기, 다음갱신, 순서, 크레딧부족, 추정USD, 단가 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] === '--풀기' && argv[1]) {
      console.log(풀기(argv[1]) ? `${argv[1]} 표시를 지웠다` : `${argv[1]}에는 표시가 없다`);
    } else if (argv[0] === '--상태' || argv.length === 0) {
      console.table(상태보기());
    } else {
      console.error('사용: node tools/lib/클로드키.js --상태 | --풀기 <이름>');
      process.exitCode = 2;
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
