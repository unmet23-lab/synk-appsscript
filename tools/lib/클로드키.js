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
 *                       한 번만 들어온 크레딧(프로모션)이나 카드가 붙은 조직의 키에는 선택 칸을 더 둔다:
 *                       한도USD(그 키로 쓸 추정 비용 합의 상한) · 한도시작(합을 셀 때부터, ISO 날짜) ·
 *                       만료일(YYYY-MM-DD — 그날까지 쓰고 다음 날 0시부터 뺀다). 한도는 이 도구의 사용 기록으로 세므로,
 *                       한도를 건 키는 기록이 남는 보내기·일괄에만 쓰고 키 값을 다른 프로그램에 넘기는 키고르기에는 내주지 않는다.
 *                       한도를 건 키는 「키」가 아니라 「한도키」 배열에 둔다 — 한도 칸을 모르는 옛 판(10-22 e57d4126b 앞)은
 *                       「키」만 읽어 그 키를 아예 보지 못한다(한도 없이 쓰지 않는다).
 *                       {"키":[…],"한도키":[{"이름":"프로모","키파일":"…","갱신일":null,"한도USD":140,"한도시작":"…","만료일":"2026-11-20"}]}
 *   클로드_키상태.json  소진·키오류 표시(이 도구가 씀)
 *   클로드_사용기록.jsonl  호출마다 키 이름·모델·토큰·추정 비용(이 도구가 씀)
 *
 * 사용:
 *   const 클로드 = require('./tools/lib/클로드키.js');
 *   const { 응답, 키이름 } = await 클로드.보내기({ model: 'claude-opus-5-5', max_tokens: 1024,
 *     messages: [{ role: 'user', content: '…' }] }, { 용도: 'learning-blind' });
 *   const { 배치id, 키이름 } = await 클로드.배치보내기([{ custom_id, params }], { 용도 });   반값 일괄(Message Batches)
 *   await 클로드.배치보기(배치id, 키이름) · await 클로드.배치결과(배치id, 키이름)  — 결과는 만든 키의 조직에서만 받는다
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
  // 빈 배열은 오류가 아니라 「지금 쓸 크레딧 키 없음」이다(새 조직 키를 넣기 전) — 고르기는 null, 보내기는 키 없음으로 멈춘다.
  if (!Array.isArray(목록.키)) throw new Error('키 목록에 「키」 배열이 없다');
  if (목록.한도키 != null && !Array.isArray(목록.한도키)) throw new Error('키 목록의 「한도키」는 배열이어야 한다');
  const 이름들 = new Set();
  return [...목록.키.map((항목) => [항목, false]), ...(목록.한도키 || []).map((항목) => [항목, true])].map(([항목, 한도칸], i) => {
    if (!항목 || typeof 항목.이름 !== 'string' || !항목.이름.trim()) throw new Error(`키 ${i + 1}번에 이름이 없다`);
    if (이름들.has(항목.이름)) throw new Error(`키 이름이 겹친다: ${항목.이름}`);
    이름들.add(항목.이름);
    if (typeof 항목.키파일 !== 'string' || !항목.키파일) throw new Error(`${항목.이름}: 키파일이 없다`);
    const 갱신일 = 항목.갱신일 ?? null;
    if (갱신일 !== null && !(Number.isInteger(갱신일) && 갱신일 >= 1 && 갱신일 <= 31)) throw new Error(`${항목.이름}: 갱신일은 1~31 또는 null`);
    const 한도USD = 항목.한도USD ?? null;
    if (한도USD !== null && !(typeof 한도USD === 'number' && Number.isFinite(한도USD) && 한도USD > 0)) throw new Error(`${항목.이름}: 한도USD는 0보다 큰 수 또는 null`);
    if (한도칸 && 한도USD === null) throw new Error(`${항목.이름}: 「한도키」 배열의 키에는 한도USD가 있어야 한다`);
    if (!한도칸 && 한도USD !== null) throw new Error(`${항목.이름}: 한도를 건 키는 「한도키」 배열에 둔다(옛 판이 한도 없이 쓰지 않게)`);
    const 한도시작 = 항목.한도시작 == null ? null : new Date(항목.한도시작);
    if (한도시작 !== null && Number.isNaN(+한도시작)) throw new Error(`${항목.이름}: 한도시작은 날짜(ISO) 또는 null`);
    return { 순번: i, 이름: 항목.이름, 키파일: path.resolve(path.dirname(목록경로), 항목.키파일), 갱신일,
      한도USD, 한도시작, 만료일: 항목.만료일 ?? null, 만료: 만료시각(항목) };
  });
}

// 만료일(YYYY-MM-DD)은 그날 하루까지 쓰고, 다음 날 0시(이 PC 시간대)부터 뺀다.
function 만료시각(항목) {
  const 만료일 = 항목.만료일 ?? null;
  if (만료일 === null) return null;
  const 맞음 = typeof 만료일 === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(만료일);
  const 날 = 맞음 && new Date(+맞음[1], +맞음[2] - 1, +맞음[3]);
  if (!날 || 날.getMonth() !== +맞음[2] - 1 || 날.getDate() !== +맞음[3]) throw new Error(`${항목.이름}: 만료일은 YYYY-MM-DD 또는 null`);
  return new Date(날.getFullYear(), 날.getMonth(), 날.getDate() + 1);
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

// 줄바꿈으로 끝나지 않은 마지막 조각(남이 아직 쓰는 중)과 깨진 줄(쓰다 죽은 실행)은 건너뛴다. 예약은 보내기 전에 쓰므로, 건너뛴 줄이
// 끝·취소·결과 줄이면 그 예약이 어림으로 남아 넉넉히 세지고, 예약 줄이면 그 요청은 보내지 않았다 — 돈을 덜 세는 쪽으로는 틀리지 않는다.
// 셈에 쓰는 칸의 꼴이 어긋난 줄(글 칸에 글이 아닌 값, 금액·개수 칸에 0 이상의 수가 아닌 값)도 깨진 줄로 본다.
const 글칸 = ['시각', '키이름', '단계', '예약', '배치'], 수칸 = ['어림USD', '추정USD', '결과수', '요청수'];
const 온전한줄 = (r) => r !== null && typeof r === 'object' && !Array.isArray(r)
  && 글칸.every((k) => r[k] == null || typeof r[k] === 'string')
  && 수칸.every((k) => r[k] == null || (typeof r[k] === 'number' && Number.isFinite(r[k]) && r[k] >= 0));
function 기록읽기(기록경로) {
  let 글;
  try { 글 = fs.readFileSync(기록경로, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const 줄들 = 글.split('\n');
  줄들.pop();
  return 줄들.flatMap((줄) => { try { const r = 줄.trim() ? JSON.parse(줄) : null; return 온전한줄(r) ? [r] : []; } catch { return []; } });
}

/*
 * 한도를 건 키의 누적 = 한도시작 뒤 그 키의 사용 기록 합. 줄마다 이렇게 센다.
 *   예약 줄(단계: '예약')        보내기 전에 남긴 위 어림. 같은 예약 번호의 끝·취소 줄이 오면 세지 않는다 —
 *                                응답을 못 받은 요청(청구됐을 수 있다)은 끝 줄이 없어 어림이 그대로 남는다.
 *   일괄을 만든 줄(배치, 결과수 없음)  결과를 받기 전까지 만들 때 적은 위 어림(어림USD).
 *   일괄 결과 줄(배치, 결과수)   일괄마다 마지막 한 줄만(결과를 두 번 받아도 한 번).
 *   그 밖의 줄                   추정USD.
 */
function 누적USD(키, 기록) {
  const 내것 = 기록.filter((r) => r.키이름 === 키.이름 && (!키.한도시작 || new Date(r.시각) >= 키.한도시작));
  const 끝난예약 = new Set(내것.filter((r) => r.예약 && r.단계 !== '예약').map((r) => r.예약));
  const 수 = (v) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null);
  const 만든 = new Map(), 결과 = new Map();
  for (const r of 내것) {
    if (!r.배치) continue;
    if (r.결과수 == null) { 만든.set(r.배치, { 어림: 수(r.어림USD) ?? 0, 요청수: Number(r.요청수) || 0 }); continue; }
    // 같은 일괄을 여러 번 받았으면 가장 큰 값 하나만(뒤에 받은 빈 결과·일부 결과가 앞서 센 비용을 지우지 않게).
    const 앞 = 결과.get(r.배치);
    결과.set(r.배치, { 추정: Math.max(앞?.추정 ?? 0, 수(r.추정USD) ?? 0), 결과수: Math.max(앞?.결과수 ?? 0, Number(r.결과수) || 0),
      모름: Boolean(앞?.모름 || r.추정모름) });
  }
  let 합 = 0;
  for (const r of 내것) {
    if (r.단계 === '예약') { if (!끝난예약.has(r.예약)) 합 += 수(r.어림USD) ?? 0; continue; }
    if (r.배치) continue;
    // 비용을 모르는 응답(usage 없음)은 0이 아니라 보내기 전 위 어림으로 센다.
    합 += 수(r.추정USD) ?? 수(r.어림USD) ?? 0;
  }
  for (const [배치, m] of 만든) {
    const r = 결과.get(배치);
    // 결과를 받으면 실제 추정으로 바꾸되, 비용을 모르는 결과가 섞였거나 결과 수가 요청 수보다 적으면 만든 때의 어림보다 작게 세지 않는다.
    합 += !r ? m.어림 : (r.모름 || r.결과수 < m.요청수) ? Math.max(r.추정, m.어림) : r.추정;
  }
  for (const [배치, r] of 결과) if (!만든.has(배치)) 합 += r.추정;
  return 합;
}

// 보내기 전의 위 어림. 토큰은 1바이트 이상이므로 요청 JSON의 UTF-8 바이트 수를 입력 토큰의 위 한계로 삼고(도구 정의가 있으면
// API가 덧붙이는 지시 몫 1,000토큰을 더한다), 캐시 쓰기 할증(1시간 2배·5분 1.25배)을 모두 쓰기로 보고, 출력은 max_tokens까지다.
// 단가를 모르는 모델, max_tokens가 수가 아닌 요청, 바이트로 가늠할 수 없는 요청 — 그림·문서(base64라도 해상도·쪽으로 매겨진다)·
// 서버 도구(검색·코드 실행 결과가 다시 입력이 된다)·MCP·컨테이너 — 은 Infinity라 한도 키로 보내지 않는다.
function 요청어림USD(params) {
  const 표 = 단가[params?.model];
  const 출력 = params?.max_tokens;
  if (!표 || typeof 출력 !== 'number' || !Number.isFinite(출력) || 출력 < 0) return Infinity;
  const 글 = JSON.stringify(params);
  if (/"type"\s*:\s*"(url|file|image|document|base64)"/.test(글) || params.mcp_servers != null || params.container != null
    || (Array.isArray(params.tools) && params.tools.some((도구) => 도구?.type != null && 도구.type !== 'custom'))) return Infinity;
  const 배수 = /"ttl"\s*:\s*"1h"/.test(글) ? 2 : /"cache_control"/.test(글) ? 1.25 : 1;
  const 입력 = Buffer.byteLength(글, 'utf8') * 배수 + (Array.isArray(params.tools) && params.tools.length ? 1000 : 0);
  return (입력 * 표[0] + 출력 * 표[1]) / 1e6;
}

// 이 키를 지금 쓰지 않는 까닭(쓸 수 있으면 null). 바깥: 키 값을 다른 프로그램에 넘기는 쓰임. 어림USD: 이번에 쓸 위 어림.
function 뺄까닭(키, 상태, 지금, 기록 = [], { 바깥 = false, 어림USD = 0 } = {}) {
  const 표시 = 상태[키.이름];
  if (표시?.상태 === '키오류') return '키오류';
  if (표시 && !(표시.풀림 && new Date(표시.풀림) <= 지금)) return '소진';
  if (키.만료 && 지금 >= 키.만료) return '만료';
  if (키.한도USD != null) {
    if (바깥) return '한도키(다른 프로그램에는 안 넘김)';
    const 쓴양 = 누적USD(키, 기록);
    if (!(쓴양 < 키.한도USD && 쓴양 + 어림USD <= 키.한도USD)) return '한도';
  }
  return null;
}

/*
 * 한도 키로 보내기 직전의 예약 — 잠금 없이 「먼저 쓰고 앞만 본다」.
 *   1) 만료·소진 표시와 어림만으로 한도를 넘는지 먼저 본다(이때는 아무것도 쓰지 않는다).
 *   2) 예약 줄을 덧붙인다. 줄 하나를 한 번에 덧붙이면(Node의 'a' 열기) 여러 프로세스가 함께 써도 파일 끝에 줄이 하나씩
 *      차례로 쌓이고 서로 섞이지 않는다 — 시험(프로세스 넷이 수백 줄씩 함께 덧붙이기)이 이 PC에서 확인한다.
 *   3) 기록을 다시 읽어 「내 예약 줄 앞에 쌓인 줄들만」으로 누적을 세고, 거기에 내 어림을 더해 한도를 본다.
 *      내 줄이 내가 쓴 글 그대로 보이지 않거나(남의 조각이 끼었다) 넘으면 취소 줄을 남기고 null.
 * 그래서 동시에 덧붙인 둘 가운데 뒤에 쌓인 쪽이 앞의 예약을 보고 물러선다. 받아들인 예약마다 「앞의 누적 + 제 어림 ≤ 한도」가
 * 성립하고, 받아들인 마지막 예약의 앞에는 받아들인 다른 예약이 모두 들어 있으므로 받아들인 예약의 합은 한도를 넘지 않는다.
 * 앞의 예약이 아직 끝나지 않았거나 그 끝 줄이 내 줄 뒤에 쌓였으면 어림으로 넉넉히 센다. 물러선 예약이 취소 줄을 쓰기 전에
 * 남이 읽으면 그 예약도 세어 같이 물러설 수 있다 — 돈이 나가는 쪽이 아니라 덜 쓰는 쪽으로만 틀린다.
 */
function 예약하기(키, 어림, { 기록경로, 상태, 시각, 용도, model }) {
  const 지금 = 시각();
  if (뺄까닭(키, 상태, 지금, [], { 어림USD: 어림 })) return null;
  const 예약 = `${지금.getTime().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  fs.mkdirSync(path.dirname(기록경로), { recursive: true });
  const 내줄 = JSON.stringify({ 시각: 지금.toISOString(), 키이름: 키.이름, 용도: 용도 ?? null, model, 단계: '예약', 예약, 어림USD: 어림 });
  fs.appendFileSync(기록경로, 내줄 + '\n');
  const 기록 = 기록읽기(기록경로);
  const 내자리 = 기록.findIndex((r) => r.단계 === '예약' && r.예약 === 예약 && JSON.stringify(r) === 내줄);
  const 앞 = 내자리 < 0 ? Infinity : 누적USD(키, 기록.slice(0, 내자리));
  if (앞 < 키.한도USD && 앞 + 어림 <= 키.한도USD) return 예약;
  예약취소(키, 예약, { 기록경로, 지금 });
  return null;
}

function 예약취소(키, 예약, { 기록경로, 지금 }) {
  fs.appendFileSync(기록경로, JSON.stringify({ 시각: 지금.toISOString(), 키이름: 키.이름, 단계: '취소', 예약, 추정USD: 0 }) + '\n');
}

// 쓸 수 있는 키를 곧 사라질 크레딧부터(다음 갱신일과 만료 가운데 이른 쪽). 둘 다 모르는 키는 뒤로, 같으면 목록 순서.
function 순서(키들, 상태, 지금, 기록 = [], 옵션 = {}) {
  const 무한 = 8.64e15;
  const 끝 = (키) => Math.min(다음갱신(키.갱신일, 지금)?.getTime() ?? 무한, 키.만료?.getTime() ?? 무한);
  return 키들.filter((키) => !뺄까닭(키, 상태, 지금, 기록, 옵션)).sort((a, b) => (끝(a) - 끝(b)) || (a.순번 - b.순번));
}

const 한도키있음 = (키들) => 키들.some((키) => 키.한도USD != null);

function 가리기(글, 키들값) {
  let s = String(글 ?? '');
  for (const v of 키들값) if (v) s = s.split(v).join('[REDACTED]');
  return s.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[REDACTED]');
}

function 크레딧부족(http, body) {
  return http >= 400 && http < 500 && /credit balance is too low/i.test(String(body?.error?.message ?? ''));
}

// 캐시 읽기 단가는 입력 단가의 배수다(공식 가격, 10-20 claude-api 참고: Opus 5.5 $0.20/MTok = 0.05배, Fable 5.1 0.025배, 그 밖 0.1배).
// 캐시 쓰기는 5분 1.25배·1시간 2배, 배치(Message Batches)는 모든 토큰이 반값이다.
const 캐시읽기배수 = Object.freeze({ 'claude-opus-5-5': 0.05, 'claude-fable-5-1': 0.025 });
function 추정USD(model, usage, { 배치 = false } = {}) {
  const 표 = 단가[model];
  if (!표 || !usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens)) return null;
  const 쓰기 = usage.cache_creation || {};
  const 쓰기전체 = Number(usage.cache_creation_input_tokens) || 0;
  const 쓰기1h = Number(쓰기.ephemeral_1h_input_tokens) || 0;
  const 쓰기5m = Number.isFinite(쓰기.ephemeral_5m_input_tokens) ? 쓰기.ephemeral_5m_input_tokens : Math.max(0, 쓰기전체 - 쓰기1h);
  const 읽기 = Number(usage.cache_read_input_tokens) || 0;
  const 입력 = usage.input_tokens + 쓰기5m * 1.25 + 쓰기1h * 2 + 읽기 * (캐시읽기배수[model] ?? 0.1);
  const 값 = (입력 * 표[0] + usage.output_tokens * 표[1]) / 1e6;
  return 배치 ? 값 / 2 : 값;
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
  const 기록 = 한도키있음(키들) ? 기록읽기(기록경로) : [];
  const 어림 = 요청어림USD(본문);

  for (const 키 of 순서(키들, 상태, 지금, 기록, { 어림USD: 어림 })) {
    const 값 = 키값(키);
    if (!값) { 건너뛴키.push({ 이름: 키.이름, 이유: '키파일없음' }); continue; }
    // 앞 키의 응답을 기다리는 사이 날이 바뀌었을 수 있다 — 보내기 직전 만료를 다시 본다.
    if (키.만료 && (옵션.지금 || new Date()) >= 키.만료) { 건너뛴키.push({ 이름: 키.이름, 이유: '만료' }); continue; }
    // 한도 키는 예약 줄을 먼저 덧붙이고 앞의 줄만으로 다시 확인한다 — 동시에 도는 다른 요청과 응답을 못 받은 요청까지 한도에 든다.
    const 예약 = 키.한도USD != null ? 예약하기(키, 어림, { 기록경로, 상태, 시각: () => 옵션.지금 || new Date(), 용도: 옵션.용도, model: 본문.model }) : null;
    if (키.한도USD != null && !예약) { 건너뛴키.push({ 이름: 키.이름, 이유: '한도' }); continue; }
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
      if (예약) 예약취소(키, 예약, { 기록경로, 지금 });
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
    // 처리 전에 거절된 것이 분명한 4xx(시간 초과 408 제외)에 usage가 없으면 청구가 없다 — 0으로 적어 예약을 끝낸다.
    // 그 밖에 usage가 없으면(5xx 등) 추정을 비워 두고, 한도 키는 누적에서 보내기 전 위 어림으로 센다.
    const 거절됨 = !응답.ok && 응답.status >= 400 && 응답.status < 500 && 응답.status !== 408;
    const 추정 = 추정USD(본문.model, usage) ?? (거절됨 && !usage ? 0 : null);
    fs.mkdirSync(path.dirname(기록경로), { recursive: true });
    fs.appendFileSync(기록경로, JSON.stringify({
      시각: 지금.toISOString(), 키이름: 키.이름, 용도: 옵션.용도 ?? null, model: 본문.model,
      http: 응답.status, usage, 추정USD: 추정, ...(예약 ? { 예약, 어림USD: 어림 } : {}),
    }) + '\n');

    if (!응답.ok) {
      throw 오류('클로드키_요청실패', `${키.이름}: HTTP ${응답.status} ${가리기(body?.error?.type ?? '', [값])} ${가리기(body?.error?.message ?? 글.slice(0, 300), [값])}`.trim(),
        { 키이름: 키.이름, http: 응답.status, 응답: body });
    }
    return { 응답: body, 키이름: 키.이름, http: 응답.status, 건너뛴키 };
  }
  const 뺀키 = 뺀키들(키들, 건너뛴키, 상태, 지금, 기록, { 어림USD: 어림 });
  throw 오류('클로드키_모두소진', `쓸 수 있는 키가 없다 — ${[...건너뛴키, ...뺀키].map((k) => `${k.이름}:${k.이유}`).join(', ') || (키들.length ? '모두 소진 표시 중' : '목록에 키 없음')}. --상태로 확인`, { 건너뛴키, 뺀키 });
}

// 시도하기 전에 순서에서 빠진 키와 그 까닭(만료·한도·소진 표시 등) — 「쓸 키가 없다」 오류에 함께 싣는다.
function 뺀키들(키들, 건너뛴키, 상태, 지금, 기록, 옵션) {
  return 키들.filter((키) => !건너뛴키.some((k) => k.이름 === 키.이름))
    .map((키) => ({ 이름: 키.이름, 이유: 뺄까닭(키, 상태, 지금, 기록, 옵션) })).filter((k) => k.이유);
}

function 상태보기(옵션 = {}) {
  const { 목록경로, 상태경로, 기록경로 } = 경로들(옵션);
  const 지금 = 옵션.지금 || new Date();
  const 키들 = 목록읽기(목록경로);
  const 상태 = JSON읽기(상태경로, {});
  const 기록 = 기록읽기(기록경로);
  const 순번 = new Map(순서(키들, 상태, 지금, 기록).map((키, i) => [키.이름, i + 1]));
  return 키들.map((키) => {
    const 표시 = 상태[키.이름];
    const 시작 = 이전갱신(키.갱신일, 지금);
    const 이번 = 기록.filter((r) => r.키이름 === 키.이름 && (!시작 || new Date(r.시각) >= 시작));
    const 까닭 = 뺄까닭(키, 상태, 지금, 기록);
    return {
      이름: 키.이름,
      키파일: 키값(키) ? '있음' : '없음/형식다름',
      갱신일: 키.갱신일,
      다음갱신: 다음갱신(키.갱신일, 지금)?.toISOString().slice(0, 10) ?? null,
      상태: 키.만료 && 지금 >= 키.만료 ? '만료' : 까닭 === '한도' ? '한도도달'
        : !표시 ? '사용가능' : 표시.상태 === '키오류' ? '키오류' : new Date(표시.풀림) <= 지금 ? '사용가능(재확인)' : `소진~${표시.풀림.slice(0, 10)}`,
      쓰는순서: 순번.get(키.이름) ?? null,
      이번주기호출: 이번.length,
      이번주기추정USD: Number(이번.reduce((s, r) => s + (r.추정USD ?? 0), 0).toFixed(6)),
      한도USD: 키.한도USD,
      한도쓴양USD: 키.한도USD != null ? Number(누적USD(키, 기록).toFixed(4)) : null,
      만료일: 키.만료일,
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
 * 한도를 건 키는 내주지 않는다 — 다른 프로그램이 쓴 양은 이 도구가 미리 세지 못한다. 이 파일의 일괄처럼 쓴 양을
 * 기록에 남기는 쪽만 옵션 기록되는쓰임: true와 이번 위 어림(어림USD)을 넘겨 한도 안에서 받는다.
 */
async function 키고르기(옵션 = {}) {
  const { 목록경로, 상태경로, 기록경로 } = 경로들(옵션);
  const 보낼것 = 옵션.fetch || globalThis.fetch;
  const 지금 = 옵션.지금 || new Date();
  const 키들 = 목록읽기(목록경로);
  const 상태 = JSON읽기(상태경로, {});
  const 건너뛴키 = [];
  const 기록 = 한도키있음(키들) ? 기록읽기(기록경로) : [];
  // 확인 요청도 그 키로 돈이 나가므로 한도 판정에 그 위 어림을 더한다. 빼고: 부르는 쪽이 이미 해 본 키 이름들.
  const 판정어림 = (옵션.어림USD ?? 0) + (옵션.한도키는확인없이 ? 0 : 요청어림USD(확인본문));
  const 빼고 = new Set(옵션.빼고 || []);
  for (const 키 of 순서(키들, 상태, 지금, 기록, { 바깥: !옵션.기록되는쓰임, 어림USD: 판정어림 }).filter((k) => !빼고.has(k.이름))) {
    const 값 = 키값(키);
    if (!값) { 건너뛴키.push({ 이름: 키.이름, 이유: '키파일없음' }); continue; }
    // 일괄은 한도 키에 확인 요청을 보내지 않는다 — 예약 없이 나가는 돈이 생기지 않게, 크레딧 확인은 일괄 만들기가 맡는다.
    if (옵션.한도키는확인없이 && 키.한도USD != null) return { 이름: 키.이름, 값, 건너뛴키 };
    let 응답, body = null;
    try {
      응답 = await 보낼것(주소, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(옵션.시간제한 || 30000),
        headers: { 'content-type': 'application/json', 'anthropic-version': 버전, 'x-api-key': 값 },
        body: JSON.stringify(확인본문),
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
  return { 이름: null, 값: null, 건너뛴키,
    뺀키: 뺀키들(키들, 건너뛴키, 상태, 지금, 기록, { 바깥: !옵션.기록되는쓰임, 어림USD: 판정어림 }) };
}
const 확인본문 = Object.freeze({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: '.' }] });

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

/*
 * Message Batches(반값·비동기, 10-20 TOPIK 문항 AI 검수). 같은 키 목록에서 크레딧이 남은 키를 1토큰으로 골라
 * 일괄을 만들고, 그 키 이름을 돌려준다 — 결과는 같은 조직의 키로만 받을 수 있어서 부르는 쪽이 이름을 보관한다.
 * 일괄을 만든 뒤의 실패·소진은 다른 키로 넘기지 않는다(이미 처리 중일 수 있다). 사용 기록은 결과를 받을 때
 * 일괄 하나에 한 줄(토큰 합계·반값 추정)로 남긴다.
 */
const 배치주소 = 'https://api.anthropic.com/v1/messages/batches';

function 키값읽기(이름, 옵션) {
  const 키 = 키읽기(이름, 옵션);
  if (!키.값) throw 오류('클로드키_키없음', `${이름}: 키 목록이나 키 파일에 없다`);
  return 키.값;
}

async function 배치보내기(요청들, 옵션 = {}) {
  if (!Array.isArray(요청들) || !요청들.length) throw new Error('보낼 요청이 없다');
  const 아이디 = new Set();
  for (const r of 요청들) {
    if (!r || typeof r.custom_id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(r.custom_id) || 아이디.has(r.custom_id)) throw new Error(`custom_id 꼴·중복: ${r?.custom_id}`);
    if (!r.params || typeof r.params.model !== 'string') throw new Error(`${r.custom_id}: params.model이 없다`);
    아이디.add(r.custom_id);
  }
  const { 기록경로 } = 경로들(옵션);
  // 일괄은 결과를 받을 때에야 비용을 안다 — 그때까지 한도에는 반값으로 잡은 위 어림을 센다.
  const 어림 = 요청들.reduce((합, r) => 합 + 요청어림USD(r.params), 0) / 2;
  // 한도 키는 확인 요청 없이 고르고, 일괄을 만들기 직전 시각을 새로 읽어 예약 줄을 덧붙인 뒤 앞의 줄만으로 다시 확인한다(만든 줄이
  // 그 예약을 끝낸다 — 응답을 못 받으면 예약이 남아 한도에 든다). 그사이 다른 요청이 한도를 먼저 썼거나 만료됐거나, 일괄 만들기가
  // 크레딧 부족·401로 거절되면 그 키를 빼고 다음 키를 다시 고른다.
  const 시각 = () => 옵션.지금 || new Date();
  const 해본키 = [], 밀린키 = [], 건너뛴것 = [];
  const 보낼것 = 옵션.fetch || globalThis.fetch;
  let 고른, 키, 예약, 지금, 응답, 글, body;
  for (;;) {
    고른 = await 키고르기({ ...옵션, 기록되는쓰임: true, 어림USD: 어림, 빼고: 해본키, 한도키는확인없이: true });
    건너뛴것.push(...고른.건너뛴키);
    if (!고른.이름) {
      // 같은 키를 두 번 적지 않는다(이 고리에서 밀린 키 > 확인에서 건너뛴 키 > 처음부터 뺀 키).
      const 본 = new Set(), 까닭들 = [...밀린키, ...건너뛴것, ...(고른.뺀키 || [])].filter((k) => !본.has(k.이름) && 본.add(k.이름));
      const 뺀 = 까닭들.filter((k) => !건너뛴것.includes(k));
      throw 오류('클로드키_모두소진', `쓸 수 있는 키가 없다 — ${까닭들.map((k) => `${k.이름}:${k.이유}`).join(', ') || '목록에 키 없음'}`, { 건너뛴키: 건너뛴것, 뺀키: 뺀 });
    }
    키 = 목록읽기(경로들(옵션).목록경로).find((k) => k.이름 === 고른.이름);
    예약 = null;
    if (키?.만료 && 시각() >= 키.만료) { 해본키.push(고른.이름); 밀린키.push({ 이름: 고른.이름, 이유: '만료' }); continue; }
    if (키?.한도USD != null) {
      예약 = 예약하기(키, 어림, { 기록경로, 상태: JSON읽기(경로들(옵션).상태경로, {}), 시각, 용도: 옵션.용도, model: 요청들[0].params.model });
      if (!예약) { 해본키.push(고른.이름); 밀린키.push({ 이름: 고른.이름, 이유: '한도' }); continue; }
    }
    try {
      응답 = await 보낼것(배치주소, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(옵션.시간제한 || 120000),
        headers: { 'content-type': 'application/json', 'anthropic-version': 버전, 'x-api-key': 고른.값 }, body: JSON.stringify({ requests: 요청들 }) });
      글 = await 응답.text();
    } catch (e) {
      throw 오류('클로드키_결과모름', `${고른.이름}: 일괄을 만들었는지 모른다(목록 조회로 확인) — ${가리기(e.message, [고른.값])}`, { 키이름: 고른.이름, 청구모름: true });
    }
    지금 = 시각();
    body = null; try { body = JSON.parse(글); } catch { /* 아래에서 실패로 */ }
    if (응답.ok && body?.id) break;
    // 처리 전에 거절된 것이 분명한 4xx(시간 초과 408 제외)만 예약을 푼다. 5xx·잘린 본문은 만들어졌을 수 있어 예약을 남긴다.
    if (예약 && 응답.status >= 400 && 응답.status < 500 && 응답.status !== 408) 예약취소(키, 예약, { 기록경로, 지금 });
    if (크레딧부족(응답.status, body) || 응답.status === 401) {
      표시하기(키, 응답.status === 401 ? '키오류' : '소진', { 상태경로: 경로들(옵션).상태경로, 지금 });
      해본키.push(고른.이름); 밀린키.push({ 이름: 고른.이름, 이유: 응답.status === 401 ? '키오류' : '크레딧소진' });
      continue;
    }
    throw 오류('클로드키_요청실패', `${고른.이름}: 일괄 만들기 HTTP ${응답.status} ${가리기(body?.error?.message ?? 글.slice(0, 300), [고른.값])}`, { 키이름: 고른.이름, http: 응답.status });
  }
  fs.mkdirSync(path.dirname(기록경로), { recursive: true });
  fs.appendFileSync(기록경로, JSON.stringify({ 시각: 지금.toISOString(), 키이름: 고른.이름, 용도: 옵션.용도 ?? null,
    model: 요청들[0].params.model, 배치: body.id, 요청수: 요청들.length, http: 응답.status, usage: null, 추정USD: 0,
    ...(Number.isFinite(어림) ? { 어림USD: 어림 } : {}), ...(예약 ? { 예약 } : {}) }) + '\n');
  return { 배치id: body.id, 키이름: 고른.이름, 상태: body.processing_status, 건너뛴키: [...건너뛴것, ...밀린키] };
}

async function 배치가져오기(주소, 값, 옵션) {
  const 보낼것 = 옵션.fetch || globalThis.fetch;
  const 응답 = await 보낼것(주소, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(옵션.시간제한 || 120000),
    headers: { 'anthropic-version': 버전, 'x-api-key': 값 } });
  const 글 = await 응답.text();
  if (!응답.ok) throw 오류('클로드키_요청실패', `HTTP ${응답.status} ${가리기(글.slice(0, 300), [값])}`, { http: 응답.status });
  return 글;
}

/** 일괄 상태(processing_status·request_counts·results_url). */
async function 배치보기(배치id, 키이름, 옵션 = {}) {
  const 값 = 키값읽기(키이름, 옵션);
  return JSON.parse(await 배치가져오기(`${배치주소}/${encodeURIComponent(배치id)}`, 값, 옵션));
}

/**
 * 끝난 일괄의 결과(순서는 보장되지 않는다 — custom_id로 찾는다). 성공 결과의 토큰을 합쳐 사용 기록 한 줄을 남긴다.
 * 돌려주는 값: { 결과: [{custom_id, result}], 합계: {요청, 성공, usage, 추정USD} }
 */
async function 배치결과(배치id, 키이름, 옵션 = {}) {
  const 값 = 키값읽기(키이름, 옵션);
  const 일괄 = JSON.parse(await 배치가져오기(`${배치주소}/${encodeURIComponent(배치id)}`, 값, 옵션));
  if (일괄.processing_status !== 'ended') throw 오류('클로드키_배치진행중', `${배치id}: 아직 끝나지 않았다(${일괄.processing_status})`, { 일괄 });
  const 글 = await 배치가져오기(일괄.results_url || `${배치주소}/${encodeURIComponent(배치id)}/results`, 값, 옵션);
  const 결과 = 글.split('\n').filter((줄) => 줄.trim()).map((줄) => JSON.parse(줄));
  const 합 = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } };
  let 추정 = 0, 모델 = null, 성공 = 0, 모름 = false;
  for (const r of 결과) {
    const m = r.result?.type === 'succeeded' ? r.result.message : null;
    if (m && !m.usage) 모름 = true;
    if (!m?.usage) continue;
    성공 += 1; 모델 = 모델 || m.model;
    const u = m.usage;
    for (const k of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) 합[k] += Number(u[k]) || 0;
    const 쓰기 = u.cache_creation || {};
    const 쓰기1h = Number(쓰기.ephemeral_1h_input_tokens) || 0;
    합.cache_creation.ephemeral_1h_input_tokens += 쓰기1h;
    합.cache_creation.ephemeral_5m_input_tokens += Number.isFinite(쓰기.ephemeral_5m_input_tokens) ? 쓰기.ephemeral_5m_input_tokens : Math.max(0, (Number(u.cache_creation_input_tokens) || 0) - 쓰기1h);
    const 값 = 추정USD(m.model, u, { 배치: true });
    if (값 === null) 모름 = true; else 추정 += 값;
  }
  const 합계 = { 요청: 결과.length, 성공, usage: 합, 추정USD: Number(추정.toFixed(6)) };
  if (!옵션.기록안함) {
    const { 기록경로 } = 경로들(옵션);
    fs.mkdirSync(path.dirname(기록경로), { recursive: true });
    // 기록에는 반올림하지 않은 값을 남긴다 — 내려 적으면 한도 셈이 쓴 것보다 작아진다(합계의 6자리는 보기용).
    fs.appendFileSync(기록경로, JSON.stringify({ 시각: (옵션.지금 || new Date()).toISOString(), 키이름, 용도: 옵션.용도 ?? null,
      model: 모델, 배치: 배치id, 결과수: 결과.length, 성공, http: 200, usage: 합, 추정USD: 추정, ...(모름 ? { 추정모름: true } : {}) }) + '\n');
  }
  return { 결과, 합계 };
}

module.exports = { 보내기, 상태보기, 풀기, 키고르기, 키읽기, 소진표시, 기록남기기, 다음갱신, 순서, 크레딧부족, 추정USD, 단가,
  배치보내기, 배치보기, 배치결과, 누적USD, 요청어림USD };

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
