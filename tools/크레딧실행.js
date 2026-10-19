#!/usr/bin/env node
'use strict';
/**
 * Claude 자동 작업을 Max 월 API 크레딧 키로 돌리는 실행기(2026-10-18 유호님 요청 · 공식 `claude -p`).
 *
 *   node tools/크레딧실행.js 작업 <이름>             tools/크레딧작업/<이름>.js 를 돈다(Windows 작업 스케줄러가 부른다)
 *   node tools/크레딧실행.js 중계 -- <claude 인자…>   헤르메스 등에서: 크레딧 키를 골라 claude 를 그대로 띄운다
 *                                                    (표준입력·표준출력·종료 코드는 그대로 통과)
 *
 * 키는 tools/lib/클로드키.js 가 고르고(곧 사라질 크레딧부터 · 1토큰 확인), 값은 자식 프로세스 환경에만 넣는다.
 * ⚠ 구독에 로그인된 PC에서는 ANTHROPIC_API_KEY(·apiKeyHelper)를 줘도 `claude -p`가 구독으로 청구된다(10-18 실측:
 *   「weekly limit」). `--bare`는 키만 쓰지만 도구가 Bash·Edit·PowerShell·Read로 줄어든다. 그래서 크레딧으로 돌 때는
 *   구독 로그인이 없는 전용 설정 폴더(CLAUDE_CONFIG_DIR)를 쓴다 — 도구는 그대로, 인증은 키뿐(실측: 「Credit balance is too low」).
 *   그 폴더에는 유호님 설정의 autoMode·permissions만 옮기고 훅·플러그인은 옮기지 않는다.
 * 크레딧 키가 없으면 키를 지운 채 구독 로그인으로 돈다(작업이 허용할 때만) — 어느 쪽으로 돌았는지 기록에 남긴다.
 * 모델을 고르거나 바꾸지 않고 결과를 다시 검수하는 반복도 없다 — 공식 CLI를 한 번 띄울 뿐이다.
 * 키 목록·상태·사용 기록은 클로드키와 같은 곳(저장소 밖 ~/SYNK_보안)이고, 실행 기록은 output/크레딧작업/<이름>/ 이다.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const 클로드 = require('./lib/클로드키.js');

const 루트 = path.resolve(__dirname, '..');
const 헤르메스 = 'C:/Users/q1212/AppData/Local/hermes/bin/hermes.exe';
const 텔레그램대상 = 'telegram:6017495834';

// 시험이나 다른 키 묶음을 쓸 때만 환경 변수로 세 경로를 함께 준다(하나라도 없으면 클로드키 기본값).
function 키경로() {
  const { SYNK_CLAUDE_KEYS: 목록경로, SYNK_CLAUDE_KEY_STATE: 상태경로, SYNK_CLAUDE_KEY_LEDGER: 기록경로 } = process.env;
  return 목록경로 && 상태경로 && 기록경로 ? { 목록경로, 상태경로, 기록경로 } : {};
}

function claude실행파일() {
  return process.env.SYNK_CLAUDE_BIN || 'claude';
}

/** 크레딧 전용 설정 폴더 — 구독 로그인이 없어 키로만 인증된다. 유호님 설정에서 autoMode·permissions만 옮긴다. */
function 설정폴더준비(폴더 = process.env.SYNK_CREDIT_CONFIG_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'synk-claude-credit'),
  사용자설정 = path.join(os.homedir(), '.claude', 'settings.json')) {
  fs.mkdirSync(폴더, { recursive: true });
  let 원본 = {};
  try { 원본 = JSON.parse(fs.readFileSync(사용자설정, 'utf8')); } catch { /* 없으면 기본값으로 돈다 */ }
  const 옮길것 = Object.fromEntries(['autoMode', 'permissions'].filter((k) => 원본[k]).map((k) => [k, 원본[k]]));
  const 파일 = path.join(폴더, 'settings.json');
  const 새글 = JSON.stringify(옮길것, null, 2) + '\n';
  if (!fs.existsSync(파일) || fs.readFileSync(파일, 'utf8') !== 새글) fs.writeFileSync(파일, 새글);
  return 폴더;
}

/** 자식 환경: Anthropic 자격을 모두 지우고, 크레딧 키가 있을 때만 그 키와 전용 설정 폴더를 넣는다. */
function 환경만들기(키값, 기본 = process.env, 설정폴더 = null) {
  const env = { ...기본 };
  for (const 이름 of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']) delete env[이름];
  if (키값) {
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
    env.ANTHROPIC_API_KEY = 키값;
    if (!설정폴더) throw new Error('크레딧으로 돌 때는 전용 설정 폴더가 있어야 한다(구독으로 새지 않게)');
    env.CLAUDE_CONFIG_DIR = 설정폴더;
  }
  return env;
}

/** `--output-format json`(한 덩어리)이나 `stream-json`(줄마다)에서 마지막 result 를 읽는다. */
function 결과읽기(stdout) {
  const 글전체 = String(stdout || '').trim();
  let 결과 = null;
  try { const j = JSON.parse(글전체); if (j && j.type === 'result') 결과 = j; } catch { /* 줄마다 읽는다 */ }
  if (!결과) {
    for (const 줄 of 글전체.split(/\r?\n/)) {
      try { const j = JSON.parse(줄); if (j && j.type === 'result') 결과 = j; } catch { /* 결과 줄만 쓴다 */ }
    }
  }
  let 인증 = null;
  for (const 줄 of 글전체.split(/\r?\n/)) {
    try { const j = JSON.parse(줄); if (j && j.type === 'system' && j.subtype === 'init') 인증 = j.apiKeySource ?? null; } catch { /* stream-json 시작 줄만 */ }
  }
  if (!결과) return { 읽음: false, 오류: true, 글: '', 비용: 0, 턴: null, 크레딧부족: false, 인증 };
  const 글 = String(결과.result ?? '');
  return {
    읽음: true, 오류: !!결과.is_error, 글, 비용: Number(결과.total_cost_usd) || 0, 턴: 결과.num_turns ?? null,
    세션: 결과.session_id ?? null, 크레딧부족: /credit balance is too low/i.test(글), 인증,
  };
}

const 가리기 = (글) => String(글 ?? '').replace(/sk-ant-[A-Za-z0-9_-]+/g, '[REDACTED]');

/** claude 를 한 번 띄운다. 입력이 'inherit'면 이 프로세스의 표준입력을 그대로 넘긴다. 통과면 출력도 그대로 내보낸다. */
function 띄우기({ 실행파일 = claude실행파일(), 앞인자 = [], 인자, 입력 = '', env, cwd = 루트, 시간제한 = 0, 통과 = false }) {
  return new Promise((resolve) => {
    const p = spawn(실행파일, [...앞인자, ...인자], { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', 끝남 = false;
    const 타이머 = 시간제한 ? setTimeout(() => { if (!끝남) p.kill(); }, 시간제한) : null;
    p.stdout.on('data', (d) => { stdout += d; if (통과) process.stdout.write(d); });
    p.stderr.on('data', (d) => { stderr += d; if (통과) process.stderr.write(d); });
    p.on('error', (e) => { 끝남 = true; if (타이머) clearTimeout(타이머); resolve({ code: 127, stdout, stderr: stderr + String(e.message) }); });
    p.on('close', (code) => { 끝남 = true; if (타이머) clearTimeout(타이머); resolve({ code: code ?? 1, stdout, stderr }); });
    if (입력 === 'inherit') process.stdin.pipe(p.stdin);
    else p.stdin.end(String(입력), 'utf8');
  });
}

function 잠그기(파일, 오래됨ms) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  try {
    fs.writeFileSync(파일, JSON.stringify({ pid: process.pid, 시각: new Date().toISOString() }), { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const 나이 = Date.now() - fs.statSync(파일).mtimeMs;
    if (나이 < 오래됨ms) throw Object.assign(new Error(`이미 도는 중이다(잠금 ${Math.round(나이 / 60000)}분 전)`), { code: '크레딧실행_겹침' });
    fs.writeFileSync(파일, JSON.stringify({ pid: process.pid, 시각: new Date().toISOString(), 이전잠금분: Math.round(나이 / 60000) }));
  }
  return () => { try { fs.rmSync(파일, { force: true }); } catch { /* 다음 실행이 오래된 잠금을 넘는다 */ } };
}

function 명령실행(명령, 인자 = [], { cwd = 루트, 입력 } = {}) {
  const r = spawnSync(명령, 인자, { cwd, encoding: 'utf8', windowsHide: true, input: 입력, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  return { code: r.status ?? (r.error ? 127 : 1), stdout: r.stdout || '', stderr: r.stderr || String(r.error?.message || '') };
}

function 텔레그램보내기(글) {
  if (process.env.SYNK_CREDIT_NO_TELEGRAM === '1') return { code: 0, 건너뜀: true };
  const 파일 = path.join(os.tmpdir(), `synk-credit-msg-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(파일, 가리기(글), 'utf8');
  try { return 명령실행(헤르메스, ['send', '-t', 텔레그램대상, '-f', 파일]); }
  finally { fs.rmSync(파일, { force: true }); }
}

function 실행기록(방, 내용) {
  fs.mkdirSync(방, { recursive: true });
  const 파일 = path.join(방, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(파일, 가리기(JSON.stringify(내용, null, 2)) + '\n');
  return 파일;
}

/** 크레딧 키 → (첫 응답이 크레딧 부족이면 다음 키) → (없으면 작업이 허용할 때만 구독)으로 한 번 돈다. */
async function 크레딧으로띄우기({ 이름, 인자만들기, 입력, cwd = 루트, 시간제한, 구독대체 = false, 실행파일, 앞인자, fetch, 설정폴더 }) {
  const 시도 = [];
  const 폴더 = 설정폴더 || 설정폴더준비();
  let 고른 = await 클로드.키고르기({ ...키경로(), 용도: 이름, fetch });
  for (;;) {
    const 크레딧 = !!고른.이름;
    if (!크레딧 && !구독대체) return { 경로: '없음', 키이름: null, 결과: null, 시도, 건너뛴키: 고른.건너뛴키 };
    const r = await 띄우기({ 실행파일, 앞인자, 인자: 인자만들기({ 크레딧 }), 입력, env: 환경만들기(크레딧 ? 고른.값 : null, process.env, 폴더), cwd, 시간제한 });
    const 결과 = 결과읽기(r.stdout);
    // stream-json이면 시작 줄의 인증 경로를 본다 — 크레딧으로 띄웠는데 키가 아니면 구독으로 샌 것이다.
    if (크레딧 && 결과.인증 && 결과.인증 !== 'ANTHROPIC_API_KEY') 결과.경고 = `크레딧으로 띄웠는데 인증이 ${결과.인증}`;
    시도.push({ 경로: 크레딧 ? '크레딧' : '구독', 키이름: 고른.이름, code: r.code, 오류: 결과.오류, 크레딧부족: 결과.크레딧부족, 인증: 결과.인증, stderr: 가리기(r.stderr).slice(-600) });
    // 첫 턴에서 크레딧 부족이면 아직 아무 도구도 돌지 않았다 — 같은 요청을 다음 키로 다시 보내도 겹치지 않는다.
    if (크레딧 && 결과.크레딧부족 && (결과.턴 ?? 1) <= 1) {
      클로드.소진표시(고른.이름, 키경로());
      고른 = await 클로드.키고르기({ ...키경로(), 용도: 이름, fetch });
      continue;
    }
    return { 경로: 크레딧 ? '크레딧' : '구독', 키이름: 고른.이름, 결과, code: r.code, 시도 };
  }
}

async function 작업돌리기(이름, 옵션 = {}) {
  if (!/^[\p{L}\p{N}_-]+$/u.test(String(이름))) throw new Error(`작업 이름이 이상하다: ${이름}`);
  const 작업 = 옵션.작업 || require(path.join(__dirname, '크레딧작업', `${이름}.js`));
  const 방 = 옵션.방 || path.join(루트, 'output', '크레딧작업', 이름);
  const 알림 = 옵션.알림 || 텔레그램보내기;
  const 풀기 = 잠그기(path.join(방, '잠금'), 작업.잠금시간 || 3 * 60 * 60 * 1000);
  const ctx = { 루트, 방, 실행: 옵션.실행 || 명령실행, 알림 };
  try {
    const 자료 = await 작업.사전확인(ctx);
    if (!자료 || 자료.할일 === false) {
      실행기록(방, { 이름, 상태: '할일없음', 이유: 자료?.이유 ?? null });
      return { 상태: '할일없음', 이유: 자료?.이유 ?? null };
    }
    const 돈 = await 크레딧으로띄우기({
      이름, 입력: 작업.지시문(자료, ctx), cwd: 작업.작업폴더 || 루트, 시간제한: 작업.시간제한,
      구독대체: !!작업.구독대체, 인자만들기: (o) => 작업.인자(o), 실행파일: 옵션.실행파일, 앞인자: 옵션.앞인자, fetch: 옵션.fetch, 설정폴더: 옵션.설정폴더,
    });
    if (돈.경로 === '없음') {
      실행기록(방, { 이름, 상태: '키없음', 건너뛴키: 돈.건너뛴키 });
      알림(`[크레딧 실행] ${이름}: 쓸 수 있는 크레딧 키가 없어 돌지 않았어요. node tools/lib/클로드키.js --상태 로 확인해 주세요.`);
      return { 상태: '키없음' };
    }
    클로드.기록남기기({ 키이름: 돈.키이름 || '구독', 용도: 이름, 경로: 돈.경로, model: 작업.모델 || null,
      추정USD: 돈.경로 === '크레딧' ? 돈.결과.비용 : null, 오류: 돈.결과.오류 }, 키경로());
    const 기록파일 = 실행기록(방, { 이름, 경로: 돈.경로, 키이름: 돈.키이름, 비용: 돈.결과.비용, 오류: 돈.결과.오류, 시도: 돈.시도, 글: 돈.결과.글 });
    if (!돈.결과.읽음 || 돈.결과.오류) {
      알림(`[크레딧 실행] ${이름} 실패(${돈.경로}) — ${가리기(돈.결과.글 || 돈.시도.at(-1)?.stderr || '결과 없음').slice(0, 300)}\n기록: ${path.relative(루트, 기록파일)}`);
      return { 상태: '실패', 경로: 돈.경로, 기록파일 };
    }
    const 사후 = await 작업.사후(돈.결과, 자료, { ...ctx, 경로: 돈.경로, 키이름: 돈.키이름 });
    return { 상태: '끝', 경로: 돈.경로, 키이름: 돈.키이름, 비용: 돈.결과.비용, 사후, 기록파일 };
  } finally {
    풀기();
  }
}

/** 헤르메스용: claude 인자를 그대로 받아 크레딧 키로(없으면 구독으로) 띄운다. 종료 코드를 돌려준다. */
async function 중계(인자들, 옵션 = {}) {
  let args = [...인자들];
  let 실행파일 = 옵션.실행파일 || claude실행파일();
  if (args.length && /(^|[\\/])claude(\.exe)?$/i.test(args[0])) 실행파일 = args.shift();
  const 고른 = await 클로드.키고르기({ ...키경로(), 용도: '중계', fetch: 옵션.fetch });
  const 크레딧 = !!고른.이름;
  if (!크레딧) args = args.filter((a) => a !== '--bare'); // --bare 는 API 키만 읽는다 — 구독으로 돌 때는 뺀다
  const 폴더 = 크레딧 ? (옵션.설정폴더 || 설정폴더준비()) : null;
  (옵션.알림줄 || ((s) => process.stderr.write(s)))(`[크레딧실행] 경로=${크레딧 ? `크레딧(${고른.이름})` : '구독'}\n`);
  const r = await 띄우기({ 실행파일, 앞인자: 옵션.앞인자, 인자: args, 입력: 옵션.입력 ?? 'inherit', env: 환경만들기(크레딧 ? 고른.값 : null, process.env, 폴더), cwd: 옵션.cwd || process.cwd(), 통과: 옵션.통과 ?? true });
  const 결과 = 결과읽기(r.stdout);
  if (크레딧 && 결과.크레딧부족) 클로드.소진표시(고른.이름, 키경로());
  클로드.기록남기기({ 키이름: 고른.이름 || '구독', 용도: '중계', 경로: 크레딧 ? '크레딧' : '구독',
    추정USD: 크레딧 ? 결과.비용 : null, 오류: 결과.오류 }, 키경로());
  return r.code;
}

module.exports = { 환경만들기, 설정폴더준비, 결과읽기, 띄우기, 잠그기, 크레딧으로띄우기, 작업돌리기, 중계, 텔레그램보내기, 명령실행 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    if (argv[0] === '작업' && argv[1]) {
      const r = await 작업돌리기(argv[1]);
      console.log(JSON.stringify(r));
      process.exitCode = r.상태 === '실패' || r.상태 === '키없음' ? 2 : 0;
    } else if (argv[0] === '중계') {
      const i = argv.indexOf('--');
      process.exitCode = await 중계(i >= 0 ? argv.slice(i + 1) : argv.slice(1));
    } else {
      console.error('사용: node tools/크레딧실행.js 작업 <이름> | 중계 -- <claude 인자…>');
      process.exitCode = 1;
    }
  })().catch((e) => { console.error(가리기(e.message)); process.exitCode = e.code === '크레딧실행_겹침' ? 3 : 1; });
}
