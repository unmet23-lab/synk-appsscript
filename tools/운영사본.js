#!/usr/bin/env node
'use strict';
/**
 * 운영 사본 — Windows 예약 작업과 헤르메스 감시가 실행하는 작업본. origin/master만 따라가고 아무도 여기서 고치지 않는다(2026-10-22).
 *
 * 공용 작업본(Documents/SYNK-appsscript)은 여러 세션이 고치는 곳이라 거기서 코드를 실행하면 ① origin에 올린 고침이 공용 작업본이
 * 따라가기 전까지 운영에 안 들어가고(10-22 오후 77커밋 뒤) ② 세션이 고치다 만 코드가 그대로 실린다(헤르메스 감시는 계약 파일을
 * 저장만 해도 멈춘다). 그래서 예약 작업·헤르메스 감시는 이 사본의 코드를 실행하고, 백업할 저장소 같은 데이터 대상은 공용 작업본을
 * 그대로 쓴다.
 *
 *   node tools/운영사본.js                     상태(경로·HEAD·origin과의 차이·마지막 갱신)
 *   node tools/운영사본.js 만들기 [--실행]      %LOCALAPPDATA%\synk\ops\SYNK-appsscript에 분리된 HEAD 워크트리로 만든다(가볍게·node_modules 연결)
 *   node tools/운영사본.js 갱신 [--실행]        남은 장부 올리기 → origin/master로 따라가기 → 헤르메스 감시 계약 다시 잡기 → 상태 기록
 *   공통: --json · --저장소 <폴더>(이 저장소의 어느 작업본이든)
 *
 * 찾기 — 공용 git 폴더의 synk-ops-path 한 줄(운영 사본 절대 경로). 어느 작업본에서든 git rev-parse --git-common-dir로 찾는다.
 * 갱신 — tools/바로올리기.js가 push한 뒤(같은 프로세스)와 Windows 예약 「SYNK 운영 사본 갱신」(5분)이 부른다.
 *   1. 잠금(상태 폴더의 갱신.lock — 10분 넘었거나 주인 프로세스가 없으면 주인 없는 잠금).
 *   2. 추적 파일이 바뀌어 있으면: 운영 도구가 기록을 쓰는 자리(기록자리 — 장부·편 기록·팁 카드)는 쓰는 중일 수 있어 막지 않고,
 *      그 가운데 도구가 올리려다 못 올린 것(남은장부.json)만 다시 올린다. 그 밖의 파일이 바뀌었으면 「누가 운영 사본을 고쳤다」로 보고
 *      따라가지 않는다. 처음 본 시각을 상태에 남기고 헤르메스 감시가 30분 넘게 이어지면 알린다(못 올린 기록은 6시간).
 *   3. tools/바로올리기.js 따라가기로 origin/master에 맞춘다(이 사본에만 있는 커밋이 있으면 멈춘다).
 *   4. 헤르메스 감시 계약(install-automation.cjs --확인)이 이 사본 파일과 다르면 --apply로 다시 잡는다. 헤르메스 쪽 파일이 바뀐 것
 *      (헤르메스 판 올림)은 다시 잡지 않는다 — 감시가 「호환 확인 필요」로 멈춰 사람이 보게 둔다.
 *   5. 상태 폴더의 상태.json에 남긴다. 헤르메스 감시(tools/hermes-synk/overview.cjs)가 읽는다.
 * 상태 폴더: %LOCALAPPDATA%\synk\ops(시험은 SYNK_운영사본_상태).
 * 지우기: node_modules는 공용 작업본으로 가는 junction이다 — 통째로 지우기 전에 링크부터 끊는다(현장노트 git_줄끝_잠금 「junction이 든 워크트리」).
 * 시험: node --test tests/운영사본.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const 내커밋 = require('./내커밋.js');

const { git도구, 조상인가, 멈춤, 사용법오류 } = 내커밋._도구;

const 가리킴파일 = 'synk-ops-path';
/** 운영 사본에서도 빼는 큰 미디어 폴더 — tools/바로올리기.js 가볍게와 같은 목록(예약 작업은 읽지 않는다) */
const 뺄폴더 = ['docs/캐릭터', 'docs/홍보물', 'docs/라디오'];
/**
 * 운영 도구가 기록을 쓰고 곧바로 올리는 자리(장부·편 기록·게시 성과·팁 카드). 여기 바뀐 파일은 쓰는 중일 수 있어 따라가기를 막지 않고
 * (따라가기가 3방향으로 지킨다) 올리지도 않는다 — 쓴 도구가 올린다. 이 밖의 파일이 바뀌었으면 누가 운영 사본을 고친 것으로 본다.
 */
const 기록자리 = ['docs/_ops/', 'docs/마케팅/', 'docs/참고카드/'];
const 잠금한도ms = 10 * 60_000;
const 기본상태폴더 = () => process.env.SYNK_운영사본_상태
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', 'ops');

const 기록자리인가 = (경로) => 기록자리.some((p) => 경로.startsWith(p));

function 같은곳(가, 나) {
  if (!가 || !나) return false;
  const 풀기 = (p) => {
    let q;
    try { q = fs.realpathSync.native(p); } catch { q = path.resolve(p); }
    return process.platform === 'win32' ? q.toLowerCase() : q;
  };
  return 풀기(가) === 풀기(나);
}

/** 이 저장소의 어느 작업본에서든 → {공용git, 공용작업본, 운영사본(없으면 null), 지금(이 작업본 뿌리)} */
function 찾기(시작 = __dirname) {
  const git = git도구(시작);
  const [공용git, 뿌리] = git.글(['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel']).split('\n');
  const 공용 = path.resolve(공용git);
  let 운영 = null;
  try { 운영 = fs.readFileSync(path.join(공용, 가리킴파일), 'utf8').trim() || null; } catch {}
  return {
    공용git: 공용,
    공용작업본: path.basename(공용).toLowerCase() === '.git' ? path.dirname(공용) : null,
    운영사본: 운영 ? path.resolve(운영) : null,
    지금: path.resolve(뿌리),
  };
}

/** 이 폴더가 운영 사본인가. 저장소 밖·가리킴 없음이면 false */
function 운영사본인가(폴더 = process.cwd()) {
  try { const f = 찾기(폴더); return 같은곳(f.지금, f.운영사본); } catch { return false; }
}

function 받기(git) {
  const f = git.돌리기(['fetch', '-q', 'origin', '+refs/heads/master:refs/remotes/origin/master'], { 허용: null });
  if (f.status !== 0) throw new 멈춤(`fetch 실패 — ${String(f.stderr).trim()}`);
  return git.글(['rev-parse', '--verify', 'refs/remotes/origin/master^{commit}']);
}

function 워크트리목록(git) {
  const 목록 = [];
  let 지금 = null;
  for (const 줄 of git.글(['worktree', 'list', '--porcelain']).split('\n')) {
    if (줄.startsWith('worktree ')) { 지금 = { 경로: path.resolve(줄.slice(9)) }; 목록.push(지금); }
    else if (지금 && 줄.startsWith('HEAD ')) 지금.머리 = 줄.slice(5);
    else if (지금 && 줄 === 'detached') 지금.분리 = true;
  }
  return 목록;
}

/** status -z 출력 → 경로들. 이름 바꿈·복사는 다음 칸이 옛 경로라 건너뛴다 */
function 상태경로들(출력) {
  const 칸 = 출력.toString('utf8').split('\0');
  const 경로들 = [];
  for (let i = 0; i < 칸.length; i++) {
    if (!칸[i]) continue;
    경로들.push(칸[i].slice(3));
    if (칸[i][0] === 'R' || 칸[i][0] === 'C') i++;
  }
  return 경로들;
}

/** 추적 파일 가운데 바뀐 경로(스테이징 포함). 미추적·무시 파일(로그·출력)은 보지 않는다 */
function 바뀐경로(git) {
  return 상태경로들(git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=no', '--ignore-submodules=all']));
}

/** 기록자리에서 바뀐 것과 새로 생긴 것 — 처음 쓰는 기록(첫 등록의 편 기록·새 카드)은 미추적 새 파일이다 */
function 기록바뀜(git) {
  return 상태경로들(git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all', '--',
    ...기록자리.map((p) => p.replace(/\/$/, ''))]));
}

const 최근ms = 10 * 60_000;
function 최근에씀(파일) {
  try { return Date.now() - fs.statSync(파일).mtimeMs < 최근ms; } catch { return false; }
}

// ── 상태 ────────────────────────────────────────────────────────────────────

function 상태읽기(상태폴더 = 기본상태폴더()) {
  try { return JSON.parse(fs.readFileSync(path.join(상태폴더, '상태.json'), 'utf8')); } catch { return null; }
}

/** 임시 파일에 다 쓰고 바꾼다. Windows는 읽는 쪽(헤르메스 감시)이 열고 있으면 바꾸기를 잠깐 거절해 몇 번 다시 한다 */
function 바꿔쓰기(파일, 글) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, 글);
  for (let 차례 = 0; ; 차례++) {
    try { fs.renameSync(임시, 파일); return; } catch (e) {
      if (차례 >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { try { fs.rmSync(임시, { force: true }); } catch {} throw e; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (차례 + 1));
    }
  }
}

/** 헤르메스 감시가 읽는 칸은 영어 이름(schemaVersion·state …), 사람이 읽는 까닭은 reason */
function 상태쓰기(상태폴더, 값) {
  바꿔쓰기(path.join(상태폴더, '상태.json'), `${JSON.stringify({ schemaVersion: 1, ...값 }, null, 2)}\n`);
}

/** 운영 사본에서 도구가 올리려다 못 올린 기록 경로 → {시각, 이유}. 갱신이 다음 회차에 다시 올린다 */
function 남은장부읽기(상태폴더 = 기본상태폴더()) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(상태폴더, '남은장부.json'), 'utf8'));
    return v && typeof v.paths === 'object' && v.paths ? v.paths : {};
  } catch { return {}; }
}

function 남은장부쓰기(상태폴더, 목록) {
  바꿔쓰기(path.join(상태폴더, '남은장부.json'), `${JSON.stringify({ paths: 목록 }, null, 2)}\n`);
}

/** 장부올리기·참고카드_커밋(운영 사본)이 부른다 — 올렸으면 그 경로를 지우고, 못 올렸으면 남긴다 */
function 남은장부적기(경로들, 결과, 상태폴더 = 기본상태폴더()) {
  const 지금 = 남은장부읽기(상태폴더);
  const 됨 = ['올림', '올릴 것 없음'].includes(결과?.결과);
  for (const p of 경로들) {
    if (됨) delete 지금[p];
    else 지금[p] = { 시각: 지금[p]?.시각 || new Date().toISOString(), 이유: String(결과?.이유 || 결과?.결과 || '').slice(0, 300) };
  }
  남은장부쓰기(상태폴더, 지금);
}

function 잠그기(상태폴더) {
  fs.mkdirSync(상태폴더, { recursive: true });
  const 파일 = path.join(상태폴더, '갱신.lock');
  for (let 차례 = 0; 차례 < 2; 차례++) {
    try {
      const fd = fs.openSync(파일, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, 시각: new Date().toISOString() }));
      fs.closeSync(fd);
      return { 풀기: () => { try { fs.rmSync(파일, { force: true }); } catch {} } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let 주인 = null;
      try { 주인 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch {}
      const 나이 = Date.now() - (Date.parse(주인?.시각) || fs.statSync(파일).mtimeMs);
      let 살아있음 = false;
      try { if (Number.isSafeInteger(주인?.pid)) { process.kill(주인.pid, 0); 살아있음 = true; } } catch {}
      if (살아있음 && 나이 < 잠금한도ms) return null;
      fs.rmSync(파일, { force: true });                // 주인 없는 잠금
    }
  }
  return null;
}

// ── 헤르메스 감시 계약 ────────────────────────────────────────────────────────

/** 저절로 다시 잡지 않는 계약 파일 — 감시 검사기·발송기 자체와, 헤르메스에 따로 설치하는 플러그인(install.cjs가 복사한다) */
const 사람몫 = (이름) => /^tools\/hermes-synk\/(automation\.py|plugin\/)/.test(이름) || 이름 === '설치된 감시 스크립트';

/**
 * install-automation.cjs --확인 답 → 할 일. {결과:'적용'}이면 --apply로 다시 잡는다. 헤르메스 판 올림·감시 검사기·플러그인 변경은 사람 몫,
 * 바로 전(30분 안)에 다시 잡았는데 같은 어긋남이면 되풀이하지 않는다 — 경로 꼴 차이 같은 것으로 5분마다 cron을 고치지 않게.
 */
function 헤르메스판단(판, { 실행 = false, 직전 = null, 지금 = Date.now() } = {}) {
  if (typeof 판?.inSync !== 'boolean' || typeof 판.nativeChanged !== 'boolean' || !Array.isArray(판.differs)) {
    return { 결과: '실패', 이유: '계약 대조 답의 모양이 다르다 — 운영 사본의 install-automation.cjs 판을 본다' };
  }
  if (판.inSync) return { 결과: '맞음' };
  if (판.nativeChanged) return { 결과: '판바뀜', 이유: '헤르메스 쪽 파일이 바뀌어(판 올림) 다시 잡지 않았다 — 호환을 보고 install-automation.cjs --apply', 다름: 판.differs };
  const 사람 = 판.differs.filter(사람몫);
  if (사람.length) {
    return { 결과: '사람 확인', 다름: 판.differs,
      이유: `감시 검사기·플러그인이 바뀌어(${사람.join(', ')}) 저절로 다시 잡지 않았다 — 바꾼 세션이 확인하고 node tools/hermes-synk/install-automation.cjs --apply(플러그인은 install.cjs --apply와 게이트웨이 다시 켜기도)` };
  }
  if (직전?.result === '다시 잡음' && 지금 - Date.parse(직전.at) < 30 * 60_000 && JSON.stringify(직전.differs || []) === JSON.stringify(판.differs)) {
    return { 결과: '실패', 이유: '방금 다시 잡았는데도 계약이 맞지 않는다 — install-automation.cjs --확인으로 본다', 다름: 판.differs };
  }
  if (!실행) return { 결과: '다시 잡을 것', 다름: 판.differs };
  return { 결과: '적용', 다름: 판.differs };
}

/**
 * 운영 사본의 install-automation.cjs로 감시 계약을 대조하고, 이 사본 판과 다르면 다시 잡는다.
 * 옵션.헤르메스: 시험용 대역 (운영사본, 실행) → 결과. 직전: 상태.json의 지난 hermes 칸(되풀이 막기).
 */
function 헤르메스맞추기(운영사본, { 실행 = false, 헤르메스, 직전 = null } = {}) {
  if (헤르메스) return 헤르메스(운영사본, 실행);
  if (process.env.NODE_TEST_CONTEXT && !process.env.SYNK_운영사본_헤르메스) return { 결과: '건너뜀', 이유: '시험 안' };
  const 설치기 = path.join(운영사본, 'tools', 'hermes-synk', 'install-automation.cjs');
  if (!fs.existsSync(설치기)) return { 결과: '건너뜀', 이유: '설치기가 없다' };
  const 부르기 = (인자) => spawnSync(process.execPath, [설치기, ...인자], { cwd: 운영사본, encoding: 'utf8', windowsHide: true, timeout: 150_000 });
  const 확인 = 부르기(['--확인']);
  let 판;
  try { 판 = JSON.parse(확인.stdout); } catch { return { 결과: '실패', 이유: `계약 대조를 못 읽었다 — ${String(확인.stderr || 확인.stdout || 확인.error || '').trim().slice(0, 200)}` }; }
  const 판단 = 헤르메스판단(판, { 실행, 직전 });
  if (판단.결과 !== '적용') return 판단;
  const 적용 = 부르기(['--apply']);
  if (적용.status !== 0) return { 결과: '실패', 이유: `다시 잡지 못했다 — ${String(적용.stderr || 적용.error || '').trim().slice(0, 200)}`, 다름: 판.differs };
  return { 결과: '다시 잡음', 다름: 판.differs };
}

// ── 명령 ────────────────────────────────────────────────────────────────────

/** 옵션: 저장소 · 경로 · 실행 · 상태폴더 */
async function 만들기(옵션 = {}) {
  const f = 찾기(옵션.저장소 || process.cwd());
  if (!f.공용작업본) throw new 멈춤('공용 git 폴더가 작업본 안의 .git이 아니다');
  const 상태폴더 = 옵션.상태폴더 || 기본상태폴더();
  const 목표 = path.resolve(옵션.경로 || f.운영사본 || path.join(상태폴더, 'SYNK-appsscript'));
  const git = git도구(f.공용작업본);
  const 있는것 = 워크트리목록(git).find((w) => 같은곳(w.경로, 목표));
  if (있는것 && 같은곳(f.운영사본, 목표)) return { 결과: '이미 있음', 경로: 목표, 머리: 있는것.머리 };
  if (있는것) throw new 멈춤(`${목표}는 이미 다른 용도의 워크트리다`);
  if (fs.existsSync(목표)) throw new 멈춤(`${목표}에 이미 폴더가 있다 — 비우거나 --경로로 다른 곳을 준다`);
  const O = 받기(git);
  const 무늬 = ['/*', ...뺄폴더.map((p) => `!/${p}/`)];
  const 공용모듈 = path.join(f.공용작업본, 'node_modules');
  const 계획 = { 경로: 목표, 바탕: O, 뺄폴더, 연결: fs.existsSync(공용모듈) ? 공용모듈 : null };
  if (!옵션.실행) return { 결과: '미리 보기', ...계획 };
  fs.mkdirSync(path.dirname(목표), { recursive: true });
  git(['worktree', 'add', '--no-checkout', '--detach', 목표, O]);
  const g = git도구(목표);
  // 아무도 고치지 않는 사본이라 바이트 그대로 꺼낸다 — core.autocrlf=true면 CRLF가 든 blob이 유령 수정으로 보여 갱신이 멈춘다
  g(['config', '--worktree', 'core.autocrlf', 'false']);
  // 빈 인덱스에서 무늬부터 걸고 꺼낸다 — 뺄 폴더를 한 번도 쓰지 않는다
  g(['sparse-checkout', 'set', '--no-cone', '--stdin'], { input: `${무늬.join('\n')}\n` });
  g(['read-tree', '-m', '-u', 'HEAD']);
  if (계획.연결) fs.symlinkSync(계획.연결, path.join(목표, 'node_modules'), 'junction');
  const 남음 = 바뀐경로(g);
  if (남음.length) throw new 멈춤(`만든 뒤 바뀐 파일이 보인다(${남음.slice(0, 3).join(', ')}) — 줄끝 설정을 확인한다`);
  fs.writeFileSync(path.join(f.공용git, 가리킴파일), `${목표}\n`);
  상태쓰기(상태폴더, { checkedAt: new Date().toISOString(), state: 'ok', head: O, origin: O, behind: 0, reason: '만듦' });
  return { 결과: '만듦', ...계획, 머리: g.글(['rev-parse', 'HEAD']) };
}

/**
 * 따라가기가 read-tree 뒤 HEAD를 옮기기 전에 끊겼으면(시간 한도로 죽음) 인덱스·작업본은 새 판, HEAD는 옛 판이라 모든 파일이 고친 것으로
 * 보인다. 인덱스가 B..O 사이 어느 커밋의 트리와 똑같으면 HEAD만 그 커밋으로 옮긴다(CAS). 아니면 아무것도 하지 않는다 → 옮긴 커밋 또는 null
 */
function 끊긴따라가기마무리(git, B, O) {
  if (B === O || git.돌리기(['diff-index', '--cached', '--quiet', B, '--'], { 허용: [0, 1] }).status === 0) return null;
  const w = git.돌리기(['write-tree'], { 허용: null });
  if (w.status !== 0) return null;
  const 트리 = String(w.stdout).trim();
  const 맞음 = git.글(['log', '--format=%H %T', '--max-count=500', `${B}..${O}`]).split('\n').filter(Boolean)
    .map((l) => l.split(' ')).find(([, t]) => t === 트리);
  if (!맞음) return null;
  git(['update-ref', '--no-deref', '-m', '운영 사본: 끊긴 따라가기 마무리', 'HEAD', 맞음[0], B]);
  return 맞음[0];
}

/**
 * 옵션: 저장소 · 실행 · 상태폴더 · 받지않음(방금 push해 origin 추적 가지가 최신일 때) · 헤르메스(시험 대역) · 부른곳
 * → {결과:'같음'|'따라감'|'멈춤'|'실패'|'바쁨'|'없음'|'미리 보기', …}. 상태.json도 같은 내용으로 쓴다(미리 보기·바쁨·없음은 안 씀).
 */
async function 갱신(옵션 = {}) {
  const 상태폴더 = 옵션.상태폴더 || 기본상태폴더();
  let f;
  try { f = 찾기(옵션.저장소 || __dirname); } catch (e) { return { 결과: '없음', 이유: e.이유 || e.message }; }
  if (!f.운영사본) return { 결과: '없음', 이유: '운영 사본이 아직 없다 — node tools/운영사본.js 만들기 --실행' };
  const 지금 = new Date().toISOString();
  const 이전 = 상태읽기(상태폴더);
  const 남기기 = (값) => {
    if (!옵션.실행) return 값;
    const 멈춤값 = 값.결과 === '멈춤' || 값.결과 === '실패';
    // 같은 까닭으로 계속 멈춰 있으면 처음 본 시각을 이어 간다 — 감시가 30분 넘게 이어진 것만 알린다
    const 이어서 = 멈춤값 && 이전 && ['stopped', 'failed'].includes(이전.state) && 이전.reasonKey === 값.까닭;
    const 안올림 = 값.안올림 || [];
    const 헤 = 값.헤르메스;
    상태쓰기(상태폴더, {
      checkedAt: 지금, state: 멈춤값 ? (값.결과 === '멈춤' ? 'stopped' : 'failed') : 'ok',
      head: 값.머리 || null, origin: 값.origin || null, behind: Number.isSafeInteger(값.뒤짐) ? 값.뒤짐 : null,
      stoppedSince: 멈춤값 ? (이어서 && 이전.stoppedSince ? 이전.stoppedSince : 지금) : null,
      reasonKey: 멈춤값 ? 값.까닭 : null, reason: 값.이유 || null, paths: (값.걸림 || []).slice(0, 10),
      // 운영 도구가 쓰고 아직 origin에 없는 기록 — 6시간 넘게 남으면 감시가 알린다
      unpushedSince: 안올림.length ? (이전?.unpushedSince || 지금) : null, unpushed: 안올림.slice(0, 10),
      hermes: 헤 ? { result: 헤.결과, reason: 헤.이유 || null, at: 헤.결과 === '맞음' ? (이전?.hermes?.at || null) : 지금, differs: (헤.다름 || []).slice(0, 30) }
        : (이전?.hermes || null),
      caller: 옵션.부른곳 || null,
      ...(값.마무리 ? { finishedInterruptedFollow: 값.마무리 } : {}),
    });
    return 값;
  };
  if (!fs.existsSync(f.운영사본)) return 남기기({ 결과: '실패', 까닭: '폴더 없음', 이유: `운영 사본 폴더가 없다(${f.운영사본})` });
  const 잠금 = 옵션.실행 ? 잠그기(상태폴더) : { 풀기() {} };
  if (!잠금) return { 결과: '바쁨', 이유: '다른 갱신이 돌고 있다' };
  try {
    const git = git도구(f.운영사본);
    const 추적판 = () => git.글(['rev-parse', '--verify', 'refs/remotes/origin/master^{commit}']);
    let O = 옵션.받지않음 ? 추적판() : 받기(git);
    let B = git.글(['rev-parse', '--verify', 'HEAD^{commit}']);
    const 처음 = B;
    const 뒤짐 = () => Number(git.글(['rev-list', '--count', `${B}..${O}`]));
    let 마무리 = null;
    if (옵션.실행 && 조상인가(git, B, O)) {
      마무리 = 끊긴따라가기마무리(git, B, O);
      if (마무리) B = 마무리;
    }
    const 기록 = 기록바뀜(git);
    const 남의것 = 바뀐경로(git).filter((p) => !기록자리인가(p));
    if (남의것.length) {
      return 남기기({ 결과: '멈춤', 까닭: '고친 파일', 걸림: 남의것, 머리: B, origin: O, 뒤짐: 뒤짐(), 안올림: 기록, 마무리,
        이유: `운영 사본에서 고친 파일이 ${남의것.length}개 있어 따라가지 않았다 — 운영 사본은 고치지 않는다. 고칠 것은 작업본에서 올리고 여기는 git -C "${f.운영사본}" checkout -- <파일>로 되돌린다` });
    }
    // 운영 도구가 올리려다 못 올린 기록만 다시 올린다. 쓰는 중일 수 있는 다른 기록은 건드리지 않는다(쓴 도구가 올린다)
    let 남은 = 남은장부읽기(상태폴더);
    if (옵션.실행 && Object.keys(남은).some((p) => !기록.includes(p))) {
      남은 = Object.fromEntries(Object.entries(남은).filter(([p]) => 기록.includes(p)));   // 깨끗해진 것(누가 올림)은 지운다
      남은장부쓰기(상태폴더, 남은);
    }
    const 다시올릴 = 기록.filter((p) => 남은[p]);
    let 장부 = null;
    if (다시올릴.length && 옵션.실행) {
      const { 장부올리기 } = require('./lib/장부올리기.js');
      const r = await 장부올리기(다시올릴, 'chore(장부): 운영 사본에서 못 올렸던 기록', { 저장소: f.운영사본 });
      장부 = { 결과: r.결과, 이유: r.이유 || null };
      남은장부적기(다시올릴, r, 상태폴더);
      // 올렸으면 그 커밋이 새 origin이고 이 사본도 이미 그리로 따라갔다
      B = git.글(['rev-parse', '--verify', 'HEAD^{commit}']);
      O = 추적판();
    }
    if (!조상인가(git, B, O)) {
      return 남기기({ 결과: '멈춤', 까닭: '갈라짐', 이유: '운영 사본 HEAD가 origin/master의 조상이 아니다(이 사본에서 커밋했거나 origin이 되감겼다) — 따라가지 않았다', 머리: B, origin: O, 뒤짐: 뒤짐(), 안올림: 기록바뀜(git), 마무리 });
    }
    let 따라 = null;
    if (B !== O) {
      if (!옵션.실행) return { 결과: '미리 보기', 머리: B, origin: O, 뒤짐: 뒤짐(), 기록바뀜: 기록 };
      // 예약 작업이 기록을 쓰는 중이면(10분 안에 바뀐 기록 파일이 못 올린 목록 밖에 있음) 이번 회차는 따라가지 않는다 — 따라가기가
      // 그 파일을 잠깐 바탕 판으로 되돌리는 사이에 덧붙인 줄을 잃지 않게. 쓴 도구가 올리면 그 push 뒤 갱신이 바로 따라간다
      const 쓰는중 = 기록바뀜(git).filter((p) => !남은장부읽기(상태폴더)[p] && 최근에씀(path.join(f.운영사본, p)));
      if (쓰는중.length) {
        return 남기기({ 결과: '멈춤', 까닭: '기록 쓰는 중', 걸림: 쓰는중, 머리: B, origin: O, 뒤짐: 뒤짐(), 안올림: 기록바뀜(git), 마무리,
          이유: `예약 작업이 기록을 쓰는 중이라(10분 안에 바뀐 파일 ${쓰는중.length}개) 이번 회차는 따라가지 않았다 — 그 도구가 올리면 바로 따라간다` });
      }
      따라 = await require('./바로올리기.js').따라가기({ 저장소: f.운영사본, 실행: true, 운영안맞춤: true });
      if (따라.결과 !== '따라감' && 따라.결과 !== '이미 최신') {
        return 남기기({ 결과: '멈춤', 까닭: '따라가기', 이유: `따라가지 못했다 — ${따라.결과}${따라.이유 ? `: ${따라.이유}` : ''}`, 걸림: (따라.걸림 || []).map((x) => x.경로 || x.커밋), 머리: B, origin: O, 뒤짐: 뒤짐(), 안올림: 기록바뀜(git), 마무리 });
      }
    }
    const 머리 = git.글(['rev-parse', '--verify', 'HEAD^{commit}']);
    const 헤르메스 = 헤르메스맞추기(f.운영사본, { 실행: 옵션.실행, 헤르메스: 옵션.헤르메스, 직전: 이전?.hermes });
    const 값 = { 결과: 머리 === 처음 ? '같음' : '따라감', 머리, origin: O, 뒤짐: Number(git.글(['rev-list', '--count', `${머리}..${O}`])), 헤르메스, 안올림: 기록바뀜(git), 마무리, ...(장부 ? { 장부 } : {}) };
    if (따라 && 따라.주의) 값.주의 = 따라.주의;
    if (헤르메스.결과 === '실패') return 남기기({ ...값, 결과: '실패', 까닭: '헤르메스', 이유: 헤르메스.이유 });
    return 남기기(값);
  } catch (e) {
    return 남기기({ 결과: '실패', 까닭: '오류', 이유: e.이유 || e.message });
  } finally {
    잠금.풀기();
  }
}

/**
 * tools/바로올리기.js가 push·따라가기 뒤에 부른다. 운영 사본에서 돈 것이면(장부 push) 이미 따라갔으니 헤르메스 계약만 맞추고,
 * 다른 작업본에서 올린 것이면 운영 사본을 갱신한다. 운영 사본이 없으면 null.
 */
async function 밀린뒤(저장소, { 받지않음 = true } = {}) {
  let f;
  try { f = 찾기(저장소); } catch { return null; }
  if (!f.운영사본) return null;
  if (같은곳(f.지금, f.운영사본)) return { 결과: '운영 사본', 헤르메스: 헤르메스맞추기(f.운영사본, { 실행: true, 직전: 상태읽기()?.hermes }) };
  return 갱신({ 저장소, 실행: true, 받지않음, 부른곳: '바로올리기' });
}

async function 상태(옵션 = {}) {
  const 상태폴더 = 옵션.상태폴더 || 기본상태폴더();
  const f = 찾기(옵션.저장소 || process.cwd());
  const 기록 = 상태읽기(상태폴더);
  if (!f.운영사본) return { 결과: '없음', 이유: '운영 사본이 아직 없다 — node tools/운영사본.js 만들기 --실행', 공용작업본: f.공용작업본 };
  const r = { 결과: '있음', 경로: f.운영사본, 공용작업본: f.공용작업본, 기록 };
  try {
    const git = git도구(f.운영사본);
    r.머리 = git.글(['rev-parse', 'HEAD']);
    r.origin = git.글(['rev-parse', 'refs/remotes/origin/master']);
    r.뒤짐 = Number(git.글(['rev-list', '--count', `${r.머리}..${r.origin}`]));
    r.바뀜 = 바뀐경로(git);
  } catch (e) { r.결과 = '못 읽음'; r.이유 = e.이유 || e.message; }
  return r;
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/운영사본.js [상태] [--json]
  node tools/운영사본.js 만들기 [--경로 <폴더>] [--실행] [--json]
  node tools/운영사본.js 갱신 [--실행] [--json]
  공통: --저장소 <폴더>. 기본은 미리 보기다. 자세한 설명은 파일 머리.`;

function 인자읽기(argv) {
  const 옵션 = { 명령: '상태' };
  const 남은 = [...argv];
  if (남은[0] && !남은[0].startsWith('--')) 옵션.명령 = 남은.shift();
  if (!['상태', '만들기', '갱신'].includes(옵션.명령)) throw new 사용법오류(`모르는 명령: ${옵션.명령}`);
  while (남은.length) {
    const a = 남은.shift();
    if (a === '--실행') 옵션.실행 = true;
    else if (a === '--json') 옵션.json = true;
    else if (a === '--저장소' || a === '--경로') {
      const v = 남은.shift();
      if (!v) throw new 사용법오류(`${a} 뒤에 폴더가 없다`);
      옵션[a.slice(2)] = path.resolve(v);
    } else if (a === '-h' || a === '--help') 옵션.도움말 = true;
    else throw new 사용법오류(`모르는 인자: ${a}`);
  }
  return 옵션;
}

const 짧게 = (sha) => (sha ? String(sha).slice(0, 9) : '-');

function 글로(r) {
  const 줄 = [`[${r.결과}]${r.이유 ? ` ${r.이유}` : ''}`];
  if (r.경로) 줄.push(`운영 사본: ${r.경로}`);
  if (r.머리 || r.origin) 줄.push(`HEAD ${짧게(r.머리)} · origin ${짧게(r.origin)}${Number.isSafeInteger(r.뒤짐) ? ` · ${r.뒤짐}커밋 뒤` : ''}`);
  if (r.뺄폴더) 줄.push(`뺄 폴더: ${r.뺄폴더.join(' · ')}${r.연결 ? ` · node_modules → ${r.연결}` : ''}`);
  for (const p of (r.걸림 || r.바뀜 || []).slice(0, 10)) 줄.push(`  - ${p}`);
  if (r.장부) 줄.push(`남은 장부: ${r.장부.결과}${r.장부.이유 ? ` — ${r.장부.이유}` : ''}`);
  if (r.헤르메스) 줄.push(`헤르메스 감시 계약: ${r.헤르메스.결과}${r.헤르메스.이유 ? ` — ${r.헤르메스.이유}` : ''}`);
  if (r.기록) 줄.push(`마지막 갱신: ${r.기록.checkedAt} · ${r.기록.state}${r.기록.reason ? ` — ${r.기록.reason}` : ''}`);
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  if (r.결과 === '미리 보기') 줄.push('--실행을 붙이면 한다.');
  return 줄.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  let 옵션;
  try { 옵션 = 인자읽기(argv); } catch (e) {
    if (!(e instanceof 사용법오류)) throw e;
    console.error(`${e.message}\n${사용법}`);
    return 2;
  }
  if (옵션.도움말) { console.log(사용법); return 0; }
  let r;
  try {
    r = 옵션.명령 === '만들기' ? await 만들기(옵션) : 옵션.명령 === '갱신' ? await 갱신(옵션) : await 상태(옵션);
  } catch (e) {
    r = { 결과: e instanceof 멈춤 ? '멈춤' : '실패', 이유: e.이유 || e.message };
  }
  console.log(옵션.json ? JSON.stringify(r, null, 2) : 글로(r));
  return ['같음', '따라감', '만듦', '이미 있음', '있음', '미리 보기', '바쁨'].includes(r.결과) ? 0 : 1;
}

module.exports = { 찾기, 운영사본인가, 만들기, 갱신, 밀린뒤, 상태, 헤르메스맞추기, 기록자리인가, 남은장부읽기, 남은장부적기, 상태읽기, 같은곳, 인자읽기, main, 가리킴파일, 뺄폴더, 사람몫, 헤르메스판단 };

if (require.main === module) main().then((code) => { process.exitCode = code; });
