#!/usr/bin/env node
'use strict';
/* 일꾼시험 — push 전 관련 시험을 이 PC 대신 일꾼 서버(tools/일꾼서버.js)에서 돈다(2026-11-26, 유호님 「네, 서버부터」).
 *
 * 왜: 여러 세션의 push 전 관련 시험이 이 PC에서 한꺼번에 돌아 15분 한도에 걸리곤 했다(관련시험.js 「자리」). 일꾼은 16코어 서버다.
 * 무엇을 돈다: push할 커밋(바로올리기의 계획.머리 = origin/master O 위에 내 변경만 얹은 커밋) 그대로. 공용 작업본의 남의 미커밋은 안 섞인다.
 *   CI처럼 CI=1로, 그 커밋의 tools/lib/관련시험몰이.cjs로 파일마다 돈다. 판정은 이 PC와 같은 관련시험.js 몰이판정이다.
 * 판정(관련시험.js 돌리기가 쓴다):
 *   일꾼에서 통과 → 통과. 다만 서버에 없는 준비물(형제 저장소 SYNK-talk · 크롬 · 윈도우 갈래 · git 밖 로컬 자료)에 기대는 시험 파일은
 *   서버에서 건너뜀으로 끝나므로 이 PC에서 한 번 더 돌고, 거기서 깨지면 깨짐이다(관련시험.js 환경시험, Fable 설계 검토 11-26).
 *   일꾼에서 깨짐 · 시간 넘김(서버 한도 5분) → 같은 시험을 이 PC에서 다시 돌려 그 결과를 따른다
 *   (리눅스에서만 깨진 것으로 push를 막지 않는다 — CI가 다시 본다).
 *   일꾼을 못 씀(꺼 둠 · 열쇠 없음 · 서버를 못 켬 · 꾸러미 300MB 넘음 · SSH 실패 · 준비 실패 · 응답 끝 표가 없음) → 이 PC에서 돈다.
 * 끄기: SYNK_일꾼=끔. origin이 GitHub의 이 저장소(unmet23-lab/synk-appsscript)가 아니면 쓰지 않는다(시험의 가짜 저장소).
 *
 *   node tools/일꾼시험.js <시험 파일…> [--커밋 <rev>]   그 커밋(기본 HEAD)을 일꾼에서만 돌려 결과를 보인다(이 PC에서 다시 돌지 않는다)
 */
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const 꾸러미한도 = 300 << 20;
const 동시 = 6;          // 16 vCPU에 자리 셋 — 이 PC(CPU의 3분의 1)보다 넉넉하다
const 자리기다림초 = 120;  // 서버 자리 셋이 다 차 있으면 이만큼만 기다리고 이 PC로 돌린다
const 서버한도초 = 300;    // 이 PC에서 15분 걸리던 시험이 서버에서 수십 초다 — 5분을 넘기면 걸린 것으로 보고 이 PC로 돌린다
const 환경셈초 = 150;      // 시험.sh가 몰이 뒤 이 PC가 봐야 할 파일을 셈하는 한도(120초)에 여유를 더한 것
const 설치초 = 300;        // 자리의 npm ci(꾸러미 잠금이 바뀌었을 때) 몫
const 마감여유초 = 60;     // 서버 마감과 SSH 한도 사이 — 결과를 보내는 몫(시험.sh가 gzip해 보낸다 — 30 MiB TAP이 수 MiB로 줄어 2 Mbps에서도 수십 초 안)
const 우리저장소 = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)unmet23-lab\/synk-appsscript(?:\.git)?\/?$/i;
const 열쇠 = path.join(os.homedir(), '.ssh', 'synk_worker');

function git(root, args, 옵션 = {}) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20, timeout: 120000, ...옵션 });
}

/** origin 주소가 GitHub의 이 저장소인가 — 다른 호스트의 같은 이름은 아니다. */
const 우리저장소인가 = (url) => 우리저장소.test(String(url || '').trim());

/** 쓸 수 있나 — 못 쓰면 까닭 글, 쓰면 null. 네트워크를 부르지 않는다. */
function 못쓰는까닭(root, 원격 = 'origin') {
  if (process.env.SYNK_일꾼 === '끔') return 'SYNK_일꾼=끔';
  if (!fs.existsSync(열쇠)) return '이 PC에 일꾼 열쇠가 없다';
  const url = (git(root, ['remote', 'get-url', 원격]).stdout || '').trim();
  if (!우리저장소인가(url)) return 'origin이 GitHub의 이 저장소가 아니다';
  return null;
}

/** 일꾼을 켜고 꾸러미를 올린다 → { 실행(입력), 한도ms } 또는 { 못씀: 까닭 }. 머리는 바탕의 자손이고, 바탕은 GitHub origin에 있는 커밋이어야 한다. */
async function 준비({ root, 머리, 바탕, 원격 = 'origin', 켜기기다림초 = 150 }) {
  const 까닭 = 못쓰는까닭(root, 원격);
  if (까닭) return { 못씀: 까닭 };
  const 서버 = require('./일꾼서버.js');
  const 시작 = Date.now();
  let 주소;
  try { 주소 = await 서버.주소얻기({ 켜기: true, 최대기다림초: 켜기기다림초 }); } catch (e) { return { 못씀: `서버 확인 실패 — ${e.message}` }; }
  if (!주소) return { 못씀: '서버를 켜지 못했다(스팟 자리 없음일 수 있다)' };
  const 작업 = `${Date.now()}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  const 참조 = `refs/synk-worker/${작업}`;
  const 파일 = path.join(os.tmpdir(), `synk-일꾼-${작업}.bundle`);
  // 머리가 바탕 그 자체면(이미 origin에 있는 커밋) 빈 꾸러미가 되지 않게 부모를 뺀다
  const 뺄것 = 머리 === 바탕 ? `${바탕}~1` : 바탕;
  try {
    if (git(root, ['update-ref', 참조, 머리]).status !== 0) return { 못씀: '꾸러미 참조를 못 만들었다' };
    let b;
    try { b = git(root, ['bundle', 'create', '-q', 파일, 참조, `^${뺄것}`]); }
    finally {
      const d = git(root, ['update-ref', '-d', 참조]);
      if (d.status !== 0) console.error(`[일꾼] 임시 참조 ${참조}를 못 지웠다 — git update-ref -d ${참조}`);
    }
    if (b.status !== 0) return { 못씀: `꾸러미를 못 만들었다 — ${(b.stderr || '').trim().slice(0, 160)}` };
    const 크기 = fs.statSync(파일).size;
    if (크기 > 꾸러미한도) return { 못씀: `꾸러미가 ${Math.round(크기 / 1048576)}MB라 이 PC에서 돈다` };
    // 올리기 전에 두 시간 넘은 이 도구의 꾸러미 · 작업 폴더만 치운다(작업 이름 꼴 <시각>-<pid>-<임의>). 올린 뒤 시험 접속이 실패하면 남는다
    // 꾸러미를 받은 뒤 강제로 끝나 trap이 못 돈 판의 임시 참조(refs/synk-worker/<작업>)도 이름의 시각으로 두 시간이 지났으면 지운다(일꾼몰이 GPT GA10)
    const 치우기 = "find ~/jobs -maxdepth 1 -regextype posix-extended -regex '.*/[0-9]{13}-[0-9]+-[0-9a-f]{6}([.]bundle|[.]tap|[.]d)' -mmin +120 -exec rm -rf {} +; "
      + "n=$(date +%s%3N); git -C ~/repo for-each-ref --format='%(refname:lstrip=2)' refs/synk-worker/ 2>/dev/null | while read -r j; do "
      + "t=${j%%-*}; case $t in ''|*[!0-9]*) continue ;; esac; [ $((n - t)) -gt 7200000 ] && git -C ~/repo update-ref -d \"refs/synk-worker/$j\"; done";
    const up = spawnSync('ssh', [...서버.ssh인자(주소), `mkdir -p ~/jobs && ${치우기}; cat > ~/jobs/${작업}.bundle`],
      { input: fs.readFileSync(파일), windowsHide: true, timeout: 10 * 60e3, maxBuffer: 1 << 20 });
    if (up.status !== 0) return { 못씀: `꾸러미를 못 올렸다 — ${String(up.stderr || up.error?.code || '').trim().slice(0, 160)}` };
  } finally {
    try { fs.rmSync(파일, { force: true }); } catch { /* 이미 없다 */ }
  }
  const 준비초 = Math.round((Date.now() - 시작) / 1000);
  return { 주소, 작업, 준비초, 한도ms: 서버한도초 * 1000, 실행: (입력) => 실행({ ...입력, 주소, 작업, 머리, ssh인자: 서버.ssh인자 }) };
}

const b64 = (줄들) => Buffer.from(줄들.join('\n'), 'utf8').toString('base64');
const 홑따옴 = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** 일꾼에서 한 판 → { 몰이, 장부글, taps, 초 } 또는 { 되돌림: 까닭 }(시험이 안 돌았다 — 이 PC에서 돈다).
 *  서버는 그 커밋의 tools/lib/관련시험몰이.cjs로 돈다. 판정은 관련시험.js 일꾼으로가 이 PC와 같은 몰이판정으로 한다. */
function 실행({ 주소, 작업, 머리, ssh인자, 시험, 새파일 = [], 한도ms }) {
  const 한도초 = Math.max(30, Math.min(서버한도초, Math.floor(한도ms / 1000)));
  // SSH 한도 = 자리 기다림 · 설치 · 시험 · 몰이 끝 기다림 · 환경 셈 · 여유. 서버는 그보다 마감여유초 앞의 마감(DEADLINE, 스크립트 시작부터 초) 안에서
  // 설치 · 시험 · 환경 셈 한도를 줄여 결과가 SSH 한도 전에 닿게 한다(일꾼몰이-6 GA2 · -7 GA3)
  const ssh한도초 = 자리기다림초 + 설치초 + 한도초 + 60 + 환경셈초 + 마감여유초;
  const 머리말 = [`JOB=${홑따옴(작업)}`, `HEAD_SHA=${홑따옴(머리)}`, `TESTS_B64=${홑따옴(b64(시험))}`,
    `NEW_JSON=${홑따옴(JSON.stringify(새파일))}`, `CONC=${동시}`, `LIMIT=${한도초}`, `SLOT_WAIT=${자리기다림초}`, `DEADLINE=${ssh한도초 - 마감여유초}`].join('\n');
  const 글 = fs.readFileSync(path.join(__dirname, '일꾼', '시험.sh'), 'utf8').replace(/\r\n/g, '\n'); // 작업본이 CRLF여도 bash가 읽게
  const 시작 = Date.now();
  const p = spawnSync('ssh', [...ssh인자(주소), 'bash -s'], { input: `${머리말}\n${글}`, encoding: 'utf8', windowsHide: true, timeout: ssh한도초 * 1000, maxBuffer: 256 << 20 });
  return 응답읽기(p, Math.round((Date.now() - 시작) / 1000));
}

/** ssh 결과 → { 몰이, 장부글, taps, 환경, 초 } 또는 { 되돌림 }. 환경: 서버가 그 커밋에서 셈한 「이 PC가 봐야 할 파일」(못 셈이면 null).
 *  되돌림(이 PC에서 돈다): SSH가 0으로 끝나지 않음 · 「@@결과 N」 줄이 없음 · 그 뒤가 자료 한 줄과 끝 표 「@@끝」이 아님 · 자료를 못 읽음 · N이 200번대(준비 실패).
 *  N은 몰이의 종료 코드다. 124는 바깥 timeout이 몰이를 끊은 것이라 시간 넘김으로 넘긴다. 그 밖의 판정은 몰이판정이 장부로 한다. */
function 응답읽기(p, 초) {
  const 출력 = String(p.stdout || '').replace(/\r\n/g, '\n');
  const 마지막 = String(p.stderr || '').trim().split('\n').slice(-1)[0]?.slice(0, 160) || '';
  const 덧 = 마지막 ? ` — ${마지막}` : '';
  if (p.error || p.status !== 0) return { 되돌림: `일꾼 접속이 끝까지 가지 않았다(${p.error?.code || `ssh ${p.status}`})${덧}` };
  const m = /^@@결과 (\d+)$/m.exec(출력);
  if (!m) return { 되돌림: `일꾼 응답에 결과 줄이 없다${덧}` };
  const 코드 = Number(m[1]);
  if (코드 >= 200) return { 되돌림: `일꾼 준비 실패 ${코드}${덧}` };
  const 뒤 = 출력.slice(m.index + m[0].length).replace(/^\n/, '').split('\n');
  if (뒤.length !== 3 || 뒤[1] !== '@@끝' || 뒤[2] !== '') return { 되돌림: `일꾼 응답이 자료 한 줄과 끝 표로 끝나지 않았다${덧}` };
  let 자료;
  try { 자료 = JSON.parse(zlib.gunzipSync(Buffer.from(뒤[0], 'base64'), { maxOutputLength: 1 << 30 }).toString('utf8')); } catch { return { 되돌림: `일꾼 응답 자료를 읽지 못했다${덧}` }; }
  const 환경꼴 = 자료 && (자료.환경 === undefined || 자료.환경 === null || (Array.isArray(자료.환경) && 자료.환경.every((x) => typeof x === 'string')));
  if (!자료 || typeof 자료 !== 'object' || (자료.장부 !== null && typeof 자료.장부 !== 'string') || !자료.taps || typeof 자료.taps !== 'object' || !환경꼴) {
    return { 되돌림: `일꾼 응답 자료의 꼴이 다르다${덧}` };
  }
  const 몰이 = 코드 === 124 ? { status: null, error: { code: 'ETIMEDOUT' } } : { status: 코드, signal: null };
  return { 몰이, 장부글: 자료.장부, taps: 자료.taps, 환경: Array.isArray(자료.환경) ? 자료.환경 : null, 초 };
}

async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, '..');
  const i = argv.indexOf('--커밋');
  const rev = i >= 0 ? argv[i + 1] : 'HEAD';
  const 시험 = argv.filter((a, k) => !a.startsWith('--') && !(i >= 0 && k === i + 1));
  if (!시험.length) { console.error('사용: node tools/일꾼시험.js <시험 파일…> [--커밋 <rev>]'); return 2; }
  git(root, ['fetch', '-q', 'origin', 'master']);
  const 머리 = git(root, ['rev-parse', rev]).stdout.trim();
  const 바탕 = git(root, ['merge-base', 머리, 'origin/master']).stdout.trim();
  const 일꾼 = await 준비({ root, 머리, 바탕 });
  if (일꾼.못씀) { console.log(`일꾼을 못 씀 — ${일꾼.못씀}`); return 1; }
  // 이 PC로 되돌리지 않는다 — 지정한 커밋의 결과만 본다(작업본은 다른 판일 수 있다)
  const 관련시험 = require('./관련시험.js');
  const r = 관련시험.일꾼으로({ root, 시험, 새파일: [], 한도ms: 15 * 60e3, 일꾼 });
  if (r.되돌림) { console.log(`일꾼에서 시험이 돌지 않았다 — ${r.되돌림}`); return 1; }
  console.log(`${r.통과함 ? '통과' : 관련시험.시간만넘김(r) ? '시간 넘김' : '깨짐'} — ${r.통과}/${r.시험} · 건너뜀 ${r.건너뜀 ?? '?'} · 일꾼 ${r.초}초 · 준비 ${일꾼.준비초}초${r.이유 ? ` · ${r.이유}` : ''}`);
  for (const x of r.실패) console.log(`  ✗ ${x.이름}${x.위치 ? ` (${x.위치})` : ''}`);
  return r.통과함 ? 0 : 1;
}

if (require.main === module) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack || e.message); process.exitCode = 1; });

module.exports = { 준비, 실행, 응답읽기, 못쓰는까닭, 우리저장소인가 };
