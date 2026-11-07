#!/usr/bin/env node
'use strict';
/**
 * 그록(xAI) 구독으로 Grok Build CLI(`grok`)를 한 번 부르는 로컬 통로(2026-11-07).
 * 유호님 「그록만이 잘하는 장점을 살려보자 … 잘하는곳에만, 효율적으로」 — 쓰는 자리는 docs/AI_계정과_크레딧.md 「그록」.
 * 계정은 unmet23@gmail.com(구글 로그인, Ultra 요금제 — 11-07 유호님이 77yuhbs에서 고침), 로그인은 `grok login`(유호님), 자격은 ~/.grok/auth.json이다(토큰은 보지 않는다).
 *
 * 지키는 것
 *  - API 키(XAI_API_KEY)는 쓰지 않는다 — 구독 로그인만. 환경에 키가 있어도 지우고 부른다(돈 나가는 길로 새지 않게).
 *  - 빈 임시 폴더를 작업 폴더로 두고, 파일 읽기 · 찾기 · 셸 · 고치기 · MCP 도구를 모두 막는다. 그록에게 줄 자료는 프롬프트에 다 넣는다
 *    (웹 검색 결과에 섞인 지시가 이 PC 파일을 읽게 하지 못하게). 웹 검색은 `웹: true`일 때만 연다.
 *  - 한 번 부르고 끝낸다. 다른 모델로 내리거나 다시 보내지 않는다(빈 답 · 막힘은 그대로 실패로 돌려준다).
 *
 * 사용:
 *   node tools/lib/그록호출.js [--웹] [--모델 <이름>] [--노력 high] [--턴 8] [--시간 600] -o <출력> < 프롬프트
 *   node tools/lib/그록호출.js --점검        # 설치 · 로그인 · 판만 본다(모델을 부르지 않는다)
 *   const { 부르기 } = require('./그록호출.js');  → await 부르기({ 프롬프트, 웹, 모델, 노력, 턴, 시간초 })
 *     → { 글, 구조답(스키마를 줬을 때), 멈춘까닭, 세션, 쓴양, 비용USD, 걸린ms }
 *   스키마: JSON 스키마(객체·글) — --json-schema로 넘겨 답 꼴을 강제한다. 하위 에이전트는 늘 끄고, 웹을 안 쓸 땐 웹 검색 도구 자체를 끈다.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const 막을도구 = Object.freeze(['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob', 'MCPTool', 'WebFetch']);

function 그록경로() {
  if (process.env.GROK_BIN && fs.existsSync(process.env.GROK_BIN)) return process.env.GROK_BIN;
  const 기본 = path.join(os.homedir(), '.grok', 'bin', process.platform === 'win32' ? 'grok.exe' : 'grok');
  if (fs.existsSync(기본)) return 기본;
  return null;
}

function 로그인됨() {
  return fs.existsSync(path.join(os.homedir(), '.grok', 'auth.json'));
}

function 막힘(code, message) {
  return Object.assign(new Error(message), { code });
}

/** 설치 · 로그인 · 판. 모델을 부르지 않는다. */
function 점검() {
  const bin = 그록경로();
  if (!bin) return { ok: false, code: 'NOT_INSTALLED', 안내: 'irm https://x.ai/cli/install.ps1 | iex' };
  let 판 = null;
  try { 판 = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 30000, windowsHide: true }).trim(); } catch { /* 판 못 읽음 */ }
  if (!로그인됨()) return { ok: false, code: 'NEEDS_LOGIN', bin, 판, 안내: 'grok login' };
  return { ok: true, bin, 판 };
}

function 인자목록({ 프롬프트파일, 작업폴더, 웹, 모델, 노력, 턴, 스키마 = null }) {
  const a = ['--no-auto-update', '--prompt-file', 프롬프트파일, '--output-format', 'json', '--cwd', 작업폴더,
    '--permission-mode', 'dontAsk', '--max-turns', String(턴), '--no-subagents'];
  for (const t of 막을도구) a.push('--deny', t);
  if (!웹) a.push('--deny', 'WebSearch', '--disable-web-search');
  // 답 꼴(11-07 실측 grok 1.0.77): --json-schema를 주면 답이 structuredOutput 칸에 꼴 그대로 온다
  if (스키마) a.push('--json-schema', typeof 스키마 === 'string' ? 스키마 : JSON.stringify(스키마));
  if (모델) a.push('--model', 모델);
  if (노력) a.push('--reasoning-effort', 노력);
  return a;
}

/** 그록 답(JSON 한 덩이)에서 쓸 것만 꺼낸다. 꼴이 다르면 null. */
function 답읽기(out) {
  const s = String(out || '').trim();
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j < i) return null;
  let o = null;
  try { o = JSON.parse(s.slice(i, j + 1)); } catch { return null; }
  if (!o || typeof o !== 'object' || typeof o.text !== 'string') return null;
  return { 글: o.text, 구조답: o.structuredOutput ?? null, 멈춘까닭: o.stopReason ?? null, 세션: o.sessionId ?? null, 쓴양: o.usage ?? null, 비용USD: typeof o.total_cost_usd === 'number' ? o.total_cost_usd : null, 턴수: o.num_turns ?? null };
}

/** 글에서 맨 바깥 { … } 덩이들을 차례로 꺼낸다(글자열 · 이스케이프 안의 괄호는 세지 않는다). */
function JSON덩이들(글) {
  const s = String(글 ?? ''), 덩이 = [];
  let 깊이 = 0, 시작 = -1, 글자열 = false, 탈출 = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (글자열) { if (탈출) 탈출 = false; else if (c === '\\') 탈출 = true; else if (c === '"') 글자열 = false; continue; }
    if (c === '"') { if (깊이 > 0) 글자열 = true; continue; }
    if (c === '{') { if (깊이 === 0) 시작 = i; 깊이 += 1; }
    else if (c === '}' && 깊이 > 0) { 깊이 -= 1; if (깊이 === 0) { 덩이.push(s.slice(시작, i + 1)); 시작 = -1; } }
  }
  return 덩이;
}

/** 그록 답 글에서 읽히는 JSON 덩이 가운데 마지막 것(울타리 안을 먼저). 꼴 칸이 빌 때 답이 두 번 이어 붙어 오기도 한다(11-07 실측). 없으면 null. */
function 마지막JSON(글) {
  const s = String(글 ?? '');
  const 울 = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  for (const 몸 of 울 ? [울[1], s] : [s]) {
    for (const d of JSON덩이들(몸).reverse()) { try { return JSON.parse(d); } catch { /* 다음 덩이 */ } }
  }
  return null;
}

async function 부르기({ 프롬프트, 웹 = false, 모델 = null, 노력 = null, 턴 = 8, 시간초 = 600, 스키마 = null } = {}) {
  if (typeof 프롬프트 !== 'string' || !프롬프트.trim()) throw 막힘('EMPTY_PROMPT', '프롬프트가 비었다');
  const 상태 = 점검();
  if (!상태.ok) throw 막힘(상태.code, 상태.code === 'NOT_INSTALLED' ? `그록 CLI가 없다 — ${상태.안내}` : `그록 로그인이 필요하다 — ${상태.안내}`);
  const 작업폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-call-'));
  const 프롬프트파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'grok-prompt-')), 'prompt.md');
  fs.writeFileSync(프롬프트파일, 프롬프트, 'utf8');
  const env = { ...process.env };
  delete env.XAI_API_KEY;
  const 시작 = Date.now();
  try {
    const { code, out, err, 끊김 } = await new Promise(resolve => {
      const p = spawn(상태.bin, 인자목록({ 프롬프트파일, 작업폴더, 웹, 모델, 노력, 턴, 스키마 }), { cwd: 작업폴더, env, windowsHide: true });
      let out = '', err = '', 끊김 = false;
      const t = setTimeout(() => { 끊김 = true; p.kill(); }, 시간초 * 1000);
      p.stdout.on('data', d => { out += d; });
      p.stderr.on('data', d => { err += d; });
      p.on('error', e => { clearTimeout(t); resolve({ code: -1, out, err: err + String(e), 끊김 }); });
      p.on('close', c => { clearTimeout(t); resolve({ code: c, out, err, 끊김 }); });
    });
    const 걸린ms = Date.now() - 시작;
    if (끊김) throw 막힘('TIMEOUT', `그록이 ${시간초}초 안에 끝나지 않았다`);
    const 답 = 답읽기(out);
    if (code !== 0 || !답) {
      const 글 = (err + '\n' + out).slice(-600);
      if (/login|auth|unauthori[sz]ed|401|expired/i.test(글)) throw 막힘('NEEDS_LOGIN', `그록 로그인이 필요하다 — grok login (${글.trim().split('\n').pop()})`);
      if (/rate.?limit|429|quota|usage limit/i.test(글)) throw 막힘('RATE_LIMIT', `그록 사용량 한도 — ${글.trim().split('\n').pop()}`);
      throw 막힘('BAD_RESPONSE', `그록 답을 읽지 못했다(끝 코드 ${code}) — ${글.trim().slice(-300)}`);
    }
    if (!답.글.trim() && !답.구조답) throw 막힘('EMPTY_ANSWER', '그록이 빈 답을 냈다');
    return { ...답, 걸린ms };
  } finally {
    for (const d of [작업폴더, path.dirname(프롬프트파일)]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 남아도 임시 폴더 */ } }
  }
}

function 값(argv, 이름) {
  const i = argv.indexOf(이름);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (!v || /^--?/.test(v)) throw new Error(`${이름} 뒤에 값이 없다`);
  return v;
}

async function main(argv) {
  if (argv.includes('--점검')) { const s = 점검(); console.log(JSON.stringify(s, null, 1)); return s.ok ? 0 : 2; }
  const 출력 = 값(argv, '-o');
  if (!출력) { console.error('쓰는 법: node tools/lib/그록호출.js [--웹] [--모델 m] [--노력 high] [--턴 8] [--시간 600] -o <출력> < 프롬프트'); return 2; }
  const 프롬프트 = fs.readFileSync(0, 'utf8');
  try {
    const r = await 부르기({ 프롬프트, 웹: argv.includes('--웹'), 모델: 값(argv, '--모델'), 노력: 값(argv, '--노력'), 턴: Number(값(argv, '--턴') || 8), 시간초: Number(값(argv, '--시간') || 600) });
    fs.writeFileSync(출력, r.글, 'utf8');
    console.log(JSON.stringify({ ok: true, 출력, 걸린ms: r.걸린ms, 비용USD: r.비용USD, 턴수: r.턴수, 멈춘까닭: r.멈춘까닭 }));
    return 0;
  } catch (e) {
    console.log(JSON.stringify({ ok: false, code: e.code || 'ERROR', message: e.message }));
    return e.code === 'NEEDS_LOGIN' || e.code === 'NOT_INSTALLED' ? 3 : 1;
  }
}

if (require.main === module) main(process.argv.slice(2)).then(c => { process.exitCode = c; });

module.exports = { 부르기, 점검, 답읽기, 인자목록, 그록경로, JSON덩이들, 마지막JSON };
