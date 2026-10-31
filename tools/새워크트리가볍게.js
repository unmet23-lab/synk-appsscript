#!/usr/bin/env node
'use strict';
/**
 * 새 워크트리 가볍게 — git post-checkout 훅이 부른다(2026-10-31, 유호님 「둘 다 진행」).
 *
 * Claude·GPT 세션이 새 워크트리(`.claude/worktrees/…`, `.codex/worktrees/…`)를 만들면
 * `node tools/바로올리기.js 가볍게 --실행`과 같은 일을 한다 — docs/캐릭터·홍보물·라디오를 sparse-checkout으로 뺀다.
 * 세션이 시작할 때 손으로 하던 이 단계가 자주 빠져, 사본마다 2GB 남짓이 그대로 쌓였다.
 * 그 폴더가 필요한 작업은 `node tools/바로올리기.js 가볍게 --되살림 <폴더> --실행`으로 그 폴더만 꺼낸다.
 *
 *   node tools/새워크트리가볍게.js --설치   공용 .git/hooks/post-checkout을 tools/git훅/post-checkout으로 깐다
 *   node tools/새워크트리가볍게.js --상태   훅이 깔렸는지와 최근 기록 다섯 줄
 *   (훅이 부를 때) node tools/새워크트리가볍게.js <앞 HEAD> <새 HEAD> <1|0>
 *
 * 공용 작업본 · 운영 사본 · 헤르메스 작업 폴더 같은 다른 곳의 워크트리는 건드리지 않는다.
 * 한 번만 끄려면 SYNK_LIGHT_OFF=1, 아예 끄려면 공용 `.git/hooks/post-checkout`을 지운다.
 * 기록: 공용 git 폴더의 `synk-새워크트리가볍게.log`(한 줄에 JSON 하나).
 * 시험: node --test tests/새워크트리가볍게.test.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 훅원본 = path.join(__dirname, 'git훅', 'post-checkout');
const 표지 = 'SYNK 새 워크트리 가볍게';
const 기록이름 = 'synk-새워크트리가볍게.log';

function git(폴더, args) {
  const env = { ...process.env };
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[k];
  const r = spawnSync('git', args, { cwd: 폴더, encoding: 'utf8', env });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} — ${String(r.stderr).trim()}`);
  return r.stdout.trim();
}

/** 세션이 만든 워크트리 자리인가: …/.claude/worktrees/<이름> · …/.codex/worktrees/<이름>/… */
function 대상인가(폴더) {
  return /\/\.(claude|codex)\/worktrees\/[^/]+/i.test(String(폴더).replace(/\\/g, '/'));
}

function 공용git폴더(폴더) {
  return path.resolve(폴더, git(폴더, ['rev-parse', '--git-common-dir']));
}

function 기록(폴더, 줄) {
  try {
    fs.appendFileSync(path.join(공용git폴더(폴더), 기록이름), `${JSON.stringify({ 시각: new Date().toISOString(), ...줄 })}\n`);
  } catch (_) { /* 기록 실패는 넘긴다 — 훅은 git을 막지 않는다 */ }
}

/** 훅으로 불렸을 때. 늘 결과 객체를 돌려주고 던지지 않는다. */
async function 훅(args, { cwd = process.cwd(), env = process.env } = {}) {
  const [앞] = args;
  if (env.SYNK_LIGHT_OFF) return { 결과: '끔' };
  if (!/^0+$/.test(String(앞 || ''))) return { 결과: '새 워크트리 아님' };
  let 폴더;
  try { 폴더 = git(cwd, ['rev-parse', '--show-toplevel']); } catch (e) { return { 결과: '건너뜀', 이유: e.message }; }
  if (!대상인가(폴더)) return { 결과: '대상 아님', 폴더 };
  let r;
  try {
    const { 가볍게 } = require('./lib/git-publish-core.cjs');
    r = await 가볍게({ 저장소: 폴더, 실행: true });
  } catch (e) {
    r = { 결과: '멈춤', 이유: e.message };
  }
  const 줄 = { 폴더, 결과: r.결과, ...(r.이유 ? { 이유: r.이유 } : {}), ...(r.파일 != null ? { 파일: r.파일, 바이트: r.바이트 } : {}) };
  기록(폴더, 줄);
  return 줄;
}

/** 깔 훅 글 — 작업본이 CRLF로 꺼냈어도 sh가 읽게 LF로 맞춘다. */
function 훅글() {
  return Buffer.from(fs.readFileSync(훅원본, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
}

/** 공용 .git/hooks/post-checkout을 깐다. 남의 post-checkout이 이미 있으면 덮지 않는다. */
function 설치({ 저장소 = process.cwd() } = {}) {
  const 훅폴더 = path.join(공용git폴더(저장소), 'hooks');
  const 자리 = path.join(훅폴더, 'post-checkout');
  const 새것 = 훅글();
  if (fs.existsSync(자리)) {
    const 지금 = fs.readFileSync(자리);
    if (지금.equals(새것)) return { 결과: '이미 깔림', 자리 };
    if (!지금.toString('utf8').includes(표지)) return { 결과: '멈춤', 이유: `다른 post-checkout 훅이 이미 있다 — 덮지 않았다: ${자리}`, 자리 };
  }
  const 경로설정 = (() => { try { return git(저장소, ['config', '--get', 'core.hooksPath']); } catch (_) { return ''; } })();
  if (경로설정) return { 결과: '멈춤', 이유: `core.hooksPath(${경로설정})가 걸려 있어 .git/hooks가 쓰이지 않는다`, 자리 };
  fs.mkdirSync(훅폴더, { recursive: true });
  const 임시 = `${자리}.${process.pid}.tmp`;
  fs.writeFileSync(임시, 새것);
  fs.chmodSync(임시, 0o755);
  fs.renameSync(임시, 자리);
  return { 결과: '깔았다', 자리 };
}

function 상태({ 저장소 = process.cwd() } = {}) {
  const 공용 = 공용git폴더(저장소);
  const 자리 = path.join(공용, 'hooks', 'post-checkout');
  const 깔림 = fs.existsSync(자리) && fs.readFileSync(자리).equals(훅글());
  let 최근 = [];
  try { 최근 = fs.readFileSync(path.join(공용, 기록이름), 'utf8').trim().split('\n').filter(Boolean).slice(-5); } catch (_) {}
  return { 깔림, 자리, 최근 };
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--설치') {
    const r = 설치();
    console.log(r.결과 === '멈춤' ? `멈춤 — ${r.이유}` : `${r.결과}: ${r.자리}`);
    return r.결과 === '멈춤' ? 1 : 0;
  }
  if (argv[0] === '--상태') {
    const r = 상태();
    console.log(`${r.깔림 ? '깔림' : '안 깔림(또는 원본과 다름)'}: ${r.자리}`);
    for (const 줄 of r.최근) console.log(`  ${줄}`);
    return 0;
  }
  await 훅(argv);
  return 0;
}

if (require.main === module) {
  const 손으로 = String(process.argv[2] || '').startsWith('--');
  main().then((code) => { process.exitCode = code; }, (e) => {
    // 훅으로 불렸으면 늘 0(git을 막지 않는다), 손으로 불렀으면 까닭을 보인다
    if (손으로) { console.error(e && e.message ? e.message : e); process.exitCode = 1; } else process.exitCode = 0;
  });
}

module.exports = { 훅, 설치, 상태, 대상인가, main, 기록이름 };
