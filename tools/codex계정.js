#!/usr/bin/env node
'use strict';
/**
 * codex계정 — 그림 굽기용 GPT(Codex) 계정을 돌려 쓴다 (2026-10-17).
 *
 * 왜 있나: ChatGPT 구독의 주간 한도는 계정마다 따로 잡힌다. 본 계정(~/.codex)으로 그림을 굽다
 * 한도가 차면 같은 로그인을 쓰는 GPT 앱의 백엔드·헤르메스 작업까지 일주일 멈춘다(10-14).
 * 그래서 굽기는 보조 계정 폴더(CODEX_HOME)에서만 돌리고, 한도에 닿으면 다음 계정으로 바꿔 다시 부른다.
 * 본 계정과 같은 계정은 「예비」로만 넣는다 — 보조 계정이 모두 막혔을 때만 맨 마지막에 쓴다(10-17 유호님).
 * 보조 계정이 하나도 없을 때만 예전처럼 본 계정 폴더(~/.codex)로 부른다.
 *
 *   node tools/codex계정.js                        계정마다 이메일·요금제·주간 한도·막힌 시각
 *   node tools/codex계정.js --추가 [이름]           새 폴더를 만들고 로그인한다(브라우저 로그인은 유호님).
 *                                                  있는 이름을 주면 그 폴더만 다시 로그인한다.
 *   node tools/codex계정.js --예비 <이름>           로그인해 둔 폴더를 맨 마지막 예비로 넣는다(본 계정과 같아도 된다).
 *   node tools/codex계정.js exec <codex exec 인자…>  `codex exec` 대신 쓴다. 지시문은 표준입력으로 준다.
 *   종료 코드 3 — 쓸 수 있는 굽기 계정이 없다(모두 막힘·로그인 필요).
 *
 * 폴더·장부는 저장소 밖 ~/.codex-bake/<이름>/ 와 ~/.codex-bake/계정.json 이다. 토큰 파일은 열지 않고,
 * 이메일·한도는 Codex app-server(`account/read`·`account/rateLimits/read`)로만 읽는다.
 * 시험용 이음매: CODEX_BAKE_DIR(폴더 뿌리), CODEX_BIN(codex 대신 부를 파일).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
/* 프로그램 찾기·Windows .cmd 감싸기·한도 창 가르기는 AI 구독 계정판과 같은 코드를 쓴다. */
const { candidatePaths, commandFor, codexWindows } = require('../desktop/src/ai-subscriptions.cjs');

const 뿌리 = process.env.CODEX_BAKE_DIR || path.join(os.homedir(), '.codex-bake');
const 장부경로 = path.join(뿌리, '계정.json');
const 본설정 = path.join(os.homedir(), '.codex', 'config.toml');
/* 새 폴더에는 본 설정의 모델·로그인 방식만 옮긴다. 플러그인·notify·프로젝트 칸은 굽기에 필요 없다. */
const 옮길설정 = /^(model|forced_login_method|model_reasoning_effort|service_tier)\s*=/;
const 한도문구 = /(hit|reached) your usage limit|usage_limit_reached/i;
const 로그인문구 = /not logged in|please (re-?)?log ?in|401 unauthorized|refresh token|token (has )?expired/i;
const 이름꼴 = /^[a-z0-9-]{1,20}$/;
const 계정없음 = 3;

/* ── 장부 ─────────────────────────────────────────────────────────────── */

function 장부() {
  try {
    const j = JSON.parse(fs.readFileSync(장부경로, 'utf8'));
    return Array.isArray(j.계정) ? j : { 계정: [] };
  } catch {
    return { 계정: [] };
  }
}

/** 굽기를 여럿 동시에 돌리므로 쓰기 직전에 다시 읽고, 그 계정 칸만 고쳐 임시 파일→교체로 쓴다. */
function 계정고치기(이름, 바꿀것) {
  const j = 장부();
  const a = j.계정.find((x) => x.이름 === 이름);
  if (a) Object.assign(a, 바꿀것);
  else j.계정.push({ 이름, ...바꿀것 });
  fs.mkdirSync(뿌리, { recursive: true });
  const 임시 = `${장부경로}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(j, null, 2) + '\n', 'utf8');
  fs.renameSync(임시, 장부경로);
}

/* ── codex 부르기 ─────────────────────────────────────────────────────── */

function codex(args) {
  const 시험 = process.env.CODEX_BIN;
  if (시험) return /\.[cm]?js$/i.test(시험) ? { command: process.execPath, argv: [시험, ...args], verbatim: false } : commandFor(시험, args, { platform: process.platform, env: process.env });
  const 파일 = candidatePaths('codex', { platform: process.platform, env: process.env, home: os.homedir() }).find((p) => fs.existsSync(p));
  if (!파일) throw new Error('codex를 찾지 못했다 — Codex CLI 설치를 확인한다');
  return commandFor(파일, args, { platform: process.platform, env: process.env });
}

/** 이름이 없으면 본 계정(~/.codex)이다. */
function 환경(이름) {
  const env = { ...process.env };
  if (이름) env.CODEX_HOME = path.join(뿌리, 이름);
  else delete env.CODEX_HOME;
  return env;
}

/** Windows의 .cmd 감싸기는 cmd.exe만 죽으면 안쪽 codex가 남는다 — 나무째 끈다. */
function 끄기(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else child.kill();
}

/** codex를 한 번 부른다. 출력은 그대로 흘려보내고 표준출력·표준오류의 끝부분만 따로 남겨 한도·로그인 문구를 본다. */
function 실행(이름, args, 입력) {
  return new Promise((resolve) => {
    const { command, argv, verbatim } = codex(args);
    const 끝 = { 출력: '', 오류: '' };
    const 담기 = (곳, d) => { 끝[곳] = (끝[곳] + d).slice(-65536); };
    const child = spawn(command, argv, {
      env: 환경(이름), windowsVerbatimArguments: verbatim, windowsHide: true,
      stdio: [입력 == null ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => { 담기('출력', d); process.stdout.write(d); });
    child.stderr.on('data', (d) => { 담기('오류', d); process.stderr.write(d); });
    child.on('error', (e) => resolve({ code: -1, 출력: 끝.출력, 오류: `${끝.오류}\n${e}` }));
    child.on('close', (code) => resolve({ code, ...끝 }));
    if (입력 != null) child.stdin.end(입력);
  });
}

/**
 * Codex 자신이 낸 오류 문장들(차례대로). 사람용 출력은 표준오류의 `ERROR: …`(시작 전 실패는 `Error: …`) 줄,
 * `--json`이면 표준출력의 `error`·`turn.failed` 사건이다. 실패한 실행의 마지막 문장이 실패한 까닭이다
 * (0.163은 그 문장을 맨 끝에 두 번 찍는다). 모델 답과 모델이 읽은 파일 내용은 보지 않는다 —
 * 10-17 한도 문구를 인용한 현장 노트를 읽은 굽기가 성공하고도 세 계정을 모두 「막힘」으로 적었다.
 */
function 코덱스오류(r) {
  const 문장 = [];
  /* 색을 강제하면(FORCE_COLOR 등) `ERROR:` 앞뒤에 색 코드가 붙는다 — 벗기고 줄 맨 앞을 본다 */
  for (const 줄 of (r.오류 || '').replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) {
    const m = /^(?:ERROR|Error):\s*(.+)$/.exec(줄);
    if (m) 문장.push(m[1]);
  }
  for (const 줄 of (r.출력 || '').split(/\r?\n/)) {
    if (!줄.startsWith('{')) continue;
    let e;
    try { e = JSON.parse(줄); } catch { continue; }
    const 글 = e?.type === 'error' ? e.message : e?.type === 'turn.failed' ? e.error?.message : null;
    if (typeof 글 === 'string') 문장.push(글);
  }
  return 문장;
}

/** app-server에 순서대로 묻고 결과 배열을 돌려준다(계정판 `codexSession`과 같은 주고받기). */
function 묻기(이름, 단계들) {
  return new Promise((resolve) => {
    const { command, argv, verbatim } = codex(['app-server']);
    const 결과 = [];
    let 버퍼 = '', 끝 = false, child = null;
    const 마침 = () => {
      if (끝) return;
      끝 = true; clearTimeout(시계);
      try { child.stdin.end(); } catch {}
      끄기(child);
      resolve(결과);
    };
    const 시계 = setTimeout(마침, 60000);
    const 보내기 = (m) => { try { child.stdin.write(JSON.stringify(m) + '\n'); } catch {} };
    try {
      child = spawn(command, argv, { env: 환경(이름), windowsVerbatimArguments: verbatim, windowsHide: true });
    } catch { 마침(); return; }
    child.on('error', 마침);
    child.on('close', 마침);
    child.stdout.on('data', (d) => {
      버퍼 += d;
      let 자리;
      while ((자리 = 버퍼.indexOf('\n')) >= 0) {
        const 줄 = 버퍼.slice(0, 자리).trim();
        버퍼 = 버퍼.slice(자리 + 1);
        let m;
        try { m = JSON.parse(줄); } catch { continue; }
        if (m.id === 0) {
          보내기({ method: 'initialized' });
          if (단계들.length) 보내기({ id: 1, ...단계들[0] }); else 마침();
        } else if (m.id === 결과.length + 1) {
          결과.push(m.error ? { error: m.error } : m.result);
          if (결과.length < 단계들.length) 보내기({ id: 결과.length + 1, ...단계들[결과.length] }); else 마침();
        }
      }
    });
    보내기({ id: 0, method: 'initialize', params: { clientInfo: { name: 'synk-bake', title: 'SYNK 굽기 계정', version: '1.0.0' } } });
  });
}

const 계정읽기 = { method: 'account/read', params: {} };
const 한도읽기 = { method: 'account/rateLimits/read', params: {} };
const 창들 = (r) => codexWindows(r?.rateLimits || Object.values(r?.rateLimitsByLimitId || {})[0] || {});

/* ── 한도가 풀리는 시각 ───────────────────────────────────────────────── */

/** "try again at Oct 21st, 2026 3:40 PM" · "try again at 3:40 PM" · "try again in 2 hours 5 minutes" */
function 풀리는시각(글, 지금 = new Date()) {
  const at = /try again at ([^\n.]+?(?:AM|PM))/i.exec(글);
  if (at) {
    const 글자 = at[1].replace(/(\d+)(st|nd|rd|th)\b/i, '$1').trim();
    const 시만 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(글자);
    if (시만) {
      const d = new Date(지금);
      d.setHours((Number(시만[1]) % 12) + (/pm/i.test(시만[3]) ? 12 : 0), Number(시만[2]), 0, 0);
      if (d <= 지금) d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    const ms = Date.parse(글자);
    if (Number.isFinite(ms)) return ms;
  }
  const inn = /try again in ([^\n.]+)/i.exec(글);
  if (inn) {
    const 단위 = { day: 864e5, hour: 36e5, minute: 6e4, second: 1e3 };
    let ms = 0;
    for (const [, n, u] of inn[1].matchAll(/(\d+)\s*(day|hour|minute|second)s?/gi)) ms += Number(n) * 단위[u.toLowerCase()];
    if (ms) return 지금.getTime() + ms;
  }
  return null;
}

/** 글에서 못 읽으면 app-server의 한도 창에서 다 쓴 창이 풀리는 시각을 쓴다. */
async function 한도에서풀림(이름) {
  const [r] = await 묻기(이름, [한도읽기]);
  const { session, weekly } = 창들(r);
  const 찬창 = [weekly, session].filter((w) => w && w.usedPercent >= 100 && w.resetsAt);
  return 찬창.length ? Math.max(...찬창.map((w) => w.resetsAt)) : null;
}

const 시각 = (ms) => {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* ── 명령 ─────────────────────────────────────────────────────────────── */

function 표준입력() {
  if (process.stdin.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    const 조각 = [];
    process.stdin.on('data', (d) => 조각.push(d));
    process.stdin.on('end', () => resolve(Buffer.concat(조각)));
    process.stdin.on('error', () => resolve(null));
  });
}

async function 굽기(args) {
  const 입력 = await 표준입력();
  if (!장부().계정.length) {
    process.stderr.write('[codex계정] 굽기 계정이 아직 없다 — 본 계정으로 부른다(--추가로 계정을 더한다)\n');
    return (await 실행(null, ['exec', ...args], 입력)).code ?? 1;
  }
  const 시도한 = new Set();
  for (;;) {
    const 지금 = Date.now();
    /* 예비는 장부 순서와 상관없이 맨 뒤 — 보조 계정이 모두 막혔을 때만 쓴다 */
    const 순서 = [...장부().계정].sort((a, b) => !!a.예비 - !!b.예비);
    const 후보 = 순서.find((a) => !시도한.has(a.이름) && !a.로그인필요 && !(a.막힘까지 > 지금));
    if (!후보) {
      const 줄들 = 순서.map((a) => `  ${a.이름} ${a.메일 || ''}${a.예비 ? '(예비)' : ''} — ${a.로그인필요 ? '로그인 필요' : a.막힘까지 > 지금 ? `${시각(a.막힘까지)}에 풀림` : '이번에 실패'}`);
      process.stderr.write(`[codex계정] 쓸 수 있는 굽기 계정이 없다. 본 계정 폴더(~/.codex)로는 넘어가지 않는다.\n${줄들.join('\n')}\n`);
      return 계정없음;
    }
    시도한.add(후보.이름);
    if (후보.예비) process.stderr.write(`[codex계정] 보조 계정이 모두 막혀 예비 ${후보.이름}(${후보.메일 || ''})로 굽는다\n`);
    const r = await 실행(후보.이름, ['exec', ...args], 입력);
    /* 한도·로그인은 실패한 실행에서 Codex의 마지막 오류 문장으로만 본다. 풀리는 시각도 그 문장에서 읽는다 */
    const 오류 = r.code !== 0 ? 코덱스오류(r).pop() : undefined;
    if (오류 && 한도문구.test(오류)) {
      const 풀림 = 풀리는시각(오류) ?? (await 한도에서풀림(후보.이름)) ?? 지금 + 36e5;
      계정고치기(후보.이름, { 막힘까지: 풀림, 막힌때: 지금 });
      process.stderr.write(`\n[codex계정] ${후보.이름} 한도 — ${시각(풀림)}에 풀림. 다음 계정으로 다시 부른다\n`);
      continue;
    }
    if (오류 && 로그인문구.test(오류)) {
      계정고치기(후보.이름, { 로그인필요: true });
      process.stderr.write(`\n[codex계정] ${후보.이름} 로그인이 풀렸다(--추가 ${후보.이름}로 다시). 다음 계정으로 다시 부른다\n`);
      continue;
    }
    계정고치기(후보.이름, { 마지막사용: 지금 });
    return r.code ?? 1;
  }
}

async function 추가(이름) {
  const 있는 = 장부().계정;
  if (!이름) {
    let n = 1;
    while (있는.some((a) => a.이름 === `bake${n}`)) n++;
    이름 = `bake${n}`;
  }
  if (!이름꼴.test(이름)) throw new Error(`이름은 영문 소문자·숫자·- 20자까지: ${이름}`);
  const 폴더 = path.join(뿌리, 이름);
  fs.mkdirSync(폴더, { recursive: true });
  const 설정 = path.join(폴더, 'config.toml');
  if (!fs.existsSync(설정)) {
    const 줄들 = [];
    for (const 줄 of (fs.existsSync(본설정) ? fs.readFileSync(본설정, 'utf8') : '').split(/\r?\n/)) {
      if (/^\s*\[/.test(줄)) break;
      if (옮길설정.test(줄)) 줄들.push(줄);
    }
    fs.writeFileSync(설정, 줄들.join('\n') + '\n', 'utf8');
  }
  console.log(`[codex계정] ${이름} 로그인을 시작한다. 브라우저가 열리면 굽기에 쓸 계정으로 로그인한다.`);
  console.log('  브라우저에 이미 다른 GPT 계정이 로그인돼 있으면 그 계정으로 붙는다 — 아래 주소를 크롬 시크릿 창에 붙여 넣는 편이 안전하다.\n');
  const r = await 실행(이름, ['login'], null);
  if (r.code !== 0) throw new Error(`로그인이 끝나지 않았다(종료 ${r.code})`);
  const [계정] = await 묻기(이름, [계정읽기]);
  const 메일 = 계정?.account?.email;
  if (!메일) throw new Error('로그인 뒤 계정을 읽지 못했다 — 다시 시도한다');
  const [본] = await 묻기(null, [계정읽기]);
  const 겹침 = 본?.account?.email === 메일 ? '본 계정' : 있는.find((a) => a.이름 !== 이름 && a.메일 === 메일)?.이름;
  if (겹침) {
    const 예비안내 = 겹침 === '본 계정' ? `\n  맨 마지막 예비로 쓰려면: node tools/codex계정.js --예비 ${이름}` : '';
    console.log(`\n[codex계정] ${메일}은 ${겹침}과 같은 계정이다. 돌림에 넣지 않았다 — 시크릿 창에서 다른 계정으로: node tools/codex계정.js --추가 ${이름}${예비안내}`);
    return 1;
  }
  계정고치기(이름, { 메일, 요금제: 계정.account.planType || null, 더한때: Date.now(), 로그인필요: false, 막힘까지: null });
  console.log(`\n[codex계정] ${이름} = ${메일} (${계정.account.planType || '요금제 모름'}) 굽기 돌림에 넣었다.`);
  return 0;
}

/** 로그인해 둔 폴더를 맨 마지막 예비로 넣는다. 본 계정과 같은 계정이어도 된다 — 다른 보조 계정과 겹치면 거절한다. */
async function 예비(이름) {
  if (!이름 || !이름꼴.test(이름) || !fs.existsSync(path.join(뿌리, 이름))) throw new Error(`로그인해 둔 폴더 이름을 준다: ${이름 || '(없음)'}`);
  const [계정] = await 묻기(이름, [계정읽기]);
  const 메일 = 계정?.account?.email;
  if (!메일) throw new Error(`${이름}은 로그인돼 있지 않다 — 먼저 --추가 ${이름}`);
  const 겹침 = 장부().계정.find((a) => a.이름 !== 이름 && a.메일 === 메일);
  if (겹침) throw new Error(`${메일}은 이미 ${겹침.이름}으로 들어가 있다`);
  계정고치기(이름, { 메일, 요금제: 계정.account.planType || null, 더한때: Date.now(), 로그인필요: false, 막힘까지: null, 예비: true });
  console.log(`[codex계정] ${이름} = ${메일} (${계정.account.planType || '요금제 모름'}) 맨 마지막 예비로 넣었다.`);
  return 0;
}

async function 목록() {
  const { 계정 } = 장부();
  if (!계정.length) {
    console.log('굽기 계정이 없다 — node tools/codex계정.js --추가');
    return 0;
  }
  for (const a of [...계정].sort((x, y) => !!x.예비 - !!y.예비)) {
    const [정보, 한도] = await 묻기(a.이름, [계정읽기, 한도읽기]);
    const 메일 = 정보?.account?.email;
    const { weekly } = 창들(한도);
    const 주간 = weekly ? `주간 ${Math.round(weekly.usedPercent)}%${weekly.resetsAt ? ` (${시각(weekly.resetsAt)} 새로)` : ''}` : '주간 한도 못 읽음';
    const 막힘 = a.막힘까지 > Date.now() ? ` · 막힘 ${시각(a.막힘까지)}까지` : '';
    console.log(`${a.이름}${a.예비 ? '(예비)' : ''}  ${메일 || '로그인 필요'}  ${정보?.account?.planType || a.요금제 || ''}  ${메일 ? 주간 : ''}${막힘}`);
  }
  return 0;
}

async function main(argv) {
  if (argv[0] === 'exec') return 굽기(argv.slice(1));
  if (argv[0] === '--추가') return 추가(argv[1]);
  if (argv[0] === '--예비') return 예비(argv[1]);
  if (!argv.length) return 목록();
  console.error('사용: node tools/codex계정.js [--추가 [이름] | --예비 <이름> | exec <codex exec 인자…>]');
  return 2;
}

module.exports = { 풀리는시각, 코덱스오류, 한도문구, 로그인문구, 묻기 };

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => { console.error(`[codex계정] ${e.message}`); process.exitCode = 1; },
  );
}
