#!/usr/bin/env node
'use strict';
/**
 * 예약 사본 — Claude 앱 예약 작업이 회차마다 쓰는 세션 워크트리의 들고 나기(2026-11-03). 지시문이 읽는 절차는 docs/_ops/예약작업_작업자리.md.
 *
 * 앱 예약 작업(07·15시 제작 셋 · 14시 게시 · 20:52 스레드 · 19:30 수요 스캔 · 화 · 금 판정)은 cwd가 공용 작업본이라 거기서 파일을 고쳤다.
 * 고친 것을 바로올리기로 올려도 공용 작업본이 따라가기에 막혀 있으면 그 파일은 미커밋으로 남고, 그 미커밋이 다시 따라가기를 막았다
 * (10-22 122커밋 · 11-03 145커밋 뒤). 그래서 회차마다 EnterWorktree로 origin 판 워크트리에 들어가 거기서만 고치고 올린 뒤 지운다.
 * 11-09 유호님 「옮기기」부터 새 회차 사본은 C:(.claude/worktrees)가 아니라 D:\SYNK-worktrees\SYNK-appsscript\<이름>에 둔다 — `만들기`로 만들고 EnterWorktree(path)로 들어간다.
 * 그렇게 들어간 사본은 ExitWorktree가 지우지 않으므로 끝에 `치우기`가 지운다. CLI는 앱의 사본 자리 설정을 안 읽고, WorktreeCreate 훅은 에이전트 격리 사본까지 영영 안 지워 쓰지 않는다(현장 노트 윈도우_셸).
 * 이 도구는 그 워크트리를 지워도 잃는 것이 없게 한다:
 *   - git 밖 결과물(편 폴더의 remotion/out · 게시/*.mp4 · 장면 · public/img 같은 .gitignore 대상)은 공용 작업본의 같은 경로로 복사한다.
 *     예약큐(운영 사본)와 게시 도구는 git 밖 영상을 공용 작업본에서 찾는다(tools/lib/게시묶음.js mediaRoot). 자리는 공용 작업본에서 렌더하던 옛 흐름과 같다.
 *   - 워크트리 안 junction(remotion/node_modules → 공용 작업본 node_modules)은 공용 쪽에 같은 링크가 없으면 만들어 두고, 지우기 전에 링크만
 *     끊는다(통째로 지우면 공용 node_modules까지 지울 수 있다 — 현장노트 git 「junction이 든 워크트리」).
 *
 *   node tools/예약사본.js 만들기 <이름> [--실행]  회차 맨 처음(공용 작업본에서) — origin 판 사본을 사본 자리에 만들고 그 경로를 찍는다. 그 경로로 EnterWorktree(path)
 *   node tools/예약사본.js 치우기 <이름> [--실행]  회차 맨 끝(ExitWorktree keep으로 나온 뒤) — `끝`을 다시 재서 「지워도 됨」일 때만 사본 자리의 그 사본과 가지를 지운다
 *   node tools/예약사본.js 들기 [--실행]        회차 시작 — 뿌리 node_modules를 공용 작업본에 잇고, 남은사본을 함께 돈다
 *   node tools/예약사본.js 넘기기 [--실행]      이 워크트리 docs/마케팅의 git 밖 파일을 공용 작업본 같은 경로로 복사
 *   node tools/예약사본.js 끝 [--실행]          넘기기 → 미커밋 · origin에 없는 커밋 확인 → 없으면 링크 끊기. 「지워도 됨」(종료 0)일 때만 ExitWorktree remove
 *   node tools/예약사본.js 남은사본 [--실행]    끝내지 못하고 남은 예약 워크트리(.claude/worktrees · 사본 자리의 sched-<작업>-<MMDD>-<HHmm>)와 그 미커밋 파일을 보이고, --실행이면
 *                                               그 git 밖 파일을 공용 작업본으로 넘긴다(지우지 않는다 — 깨어나 이어 갈 회차일 수 있다)
 *   공통: --json · --저장소 <폴더>(기본 지금 폴더)
 *   사본 자리는 D:/SYNK-worktrees/SYNK-appsscript 하나이고 명령줄로 못 바꾼다 — 안내한 명령이 다른 자리의 같은 이름 사본을 지우는 길을 두지 않는다(GPT 검수 11-09). 함수의 `자리` 인자는 시험용이다.
 *
 * 넘기기 규칙: 공용 쪽에 없으면 복사, 같은 내용이면 그대로(검사 기록이 이 원본을 검사한 것이면 공용 쪽 수정 시각만 맞춘다), 내용이 다른데 공용 쪽 수정 시각이 같거나 더 늦으면 두고 「공용이 더 새것」, 아니면
 * 공용 쪽을 이 판으로 바꾼다. 복사는 옆 이름(<파일>.예약사본)에 끝낸 뒤 바꿔 끼우고 수정 시각을 지킨다(검사 기록의 시각 대조가 그대로 산다). node_modules 안은 걷지 않는다.
 * 여러 회차가 같은 파일을 같이 넘기면 옆 이름을 먼저 만든 쪽만 넘기고 다른 쪽은 「열려 있음」이다. 바꾸기 직전에 공용 쪽을 다시 본다.
 * 남은사본은 최근 30분 안에 쓴 파일을 넘기지 않는다 — 도는 회차가 쓰는 중인 영상을 공용 자리에 내놓지 않는다.
 * 지워도 되는지: git 밖 파일 가운데 docs/마케팅은 넘기고, .tmp · node_modules · 빌드 결과는 버리는 것으로 보며, 그 밖 자리의 영상 · 소리 · 그림 · 문서가 있으면 「남은 것」이다.
 * 시험: node --test tests/예약사본.test.js
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 넘길곳 = 'docs/마케팅';
const 예약이름 = /^sched-.+-\d{4}-\d{4}$/;
/** 지워도 잃는 것이 아닌 git 밖 자리 — 이 이름의 폴더 안은 걷지 않는다 */
const 버리는폴더 = new Set(['.git', '.tmp', 'tmp', '.claude', '.expo', 'node_modules', 'dist', 'build', '__pycache__', '.cache']);
const 결과물꼴 = /\.(mp4|mov|m4v|webm|mkv|avi|gif|wav|mp3|m4a|aac|flac|ogg|opus|png|jpe?g|webp|avif|heic|tiff?|bmp|svg|psd|pdf|pptx|docx|xlsx|hwpx?|zip)$/i;
const 쓰는중ms = 30 * 60_000;
/** 새 회차 사본 자리 — 앱 Worktree location(D:\SYNK-worktrees)의 저장소 폴더와 같은 곳. 뿌리에 한글을 넣지 않는다: cv2가 영문 하위 경로도 조용히 못 연다 */
const 기본자리 = 'D:/SYNK-worktrees/SYNK-appsscript';
const 자리최소여유 = 20 * 2 ** 30;
const 이름받는명령 = new Set(['만들기', '치우기']);

function git(폴더, args, 더할환경 = null) {
  const env = { ...process.env, ...(더할환경 || {}) };
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[k];
  // --no-optional-locks: 남의 사본을 볼 때 그 인덱스를 다시 쓰지 않는다
  const r = spawnSync('git', ['--no-optional-locks', '-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', env, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} — ${String(r.stderr || r.error || '').trim()}`);
  return r.stdout;
}

function 뿌리(폴더) { return path.resolve(git(폴더, ['rev-parse', '--show-toplevel']).trim()); }

/** 이 작업본의 공용 작업본. 공용 작업본 자신이면 던진다 — 넘길 곳이 자기 자신이다 */
function 짝(폴더) {
  const 나 = 뿌리(폴더);
  const 메인 = 공용작업본(나);
  if (path.resolve(메인).toLowerCase() === 나.toLowerCase()) throw new Error('공용 작업본에서는 할 일이 없다 — 세션 워크트리에서 부른다');
  return { 나, 메인 };
}

function 사본자리(옵션 = {}) { return path.resolve(옵션.자리 || 기본자리); }
function 같은길(가, 나) { return path.resolve(가).toLowerCase() === path.resolve(나).toLowerCase(); }
/** 드라이브가 다르면 path.relative가 절대 경로를 내므로 그것도 밖으로 본다 */
function 안에있나(바깥, 안) {
  const r = path.relative(바깥, 안);
  return r === '' || (r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r));
}
function 사본이름꼴(이름) { return 예약이름.test(이름) && /^[A-Za-z0-9-]+$/.test(이름); }

/** git에 등록된 작업본 — [{ 폴더, 머리, 가지 }]. 떨어진 머리면 가지가 null */
function 등록사본(메인) {
  const 목록 = [];
  let 지금 = null;
  for (const 줄 of git(메인, ['worktree', 'list', '--porcelain']).split('\n')) {
    const 글 = 줄.replace(/\r$/, '');
    if (글.startsWith('worktree ')) { 지금 = { 폴더: path.resolve(글.slice(9).trim()), 머리: null, 가지: null }; 목록.push(지금); }
    else if (지금 && 글.startsWith('HEAD ')) 지금.머리 = 글.slice(5).trim();
    else if (지금 && 글.startsWith('branch ')) 지금.가지 = 글.slice(7).trim().replace(/^refs\/heads\//, '');
  }
  return 목록;
}

/**
 * 사본 자리에 있어야 하는 링크 — 저장소 안 사본과 같은 길로 찾게 한다. 사본의 `..`가 이 자리다.
 * node_modules: Node가 위로 걸어 찾는다 · SYNK-talk: ../SYNK-talk · SYNK-worktrees: ../SYNK-worktrees/… (없으면 숙제 첨삭 시험 3건이 빨강 없이 건너뛴다)
 */
function 옆링크맞추기(자리, 메인, 실행) {
  const 줄 = [];
  for (const [이름, 대상] of [['node_modules', path.join(메인, 'node_modules')], ['SYNK-talk', path.resolve(메인, '..', 'SYNK-talk')], ['SYNK-worktrees', path.resolve(메인, '..', 'SYNK-worktrees')]]) {
    const 링크 = path.join(자리, 이름);
    let st = null;
    try { st = fs.lstatSync(링크); } catch {}
    if (st) {
      const 읽음 = st.isSymbolicLink() ? 링크대상(링크) : null;
      if (!읽음 || !같은길(path.resolve(자리, 읽음), 대상)) throw new Error(`${링크}가 ${대상}을 가리키지 않는다 — 손대지 않고 멈춘다`);
      줄.push({ 이름, 상태: '있음' });
    } else if (!fs.existsSync(대상)) {
      줄.push({ 이름, 상태: '대상 없음' });
    } else {
      if (실행) fs.symlinkSync(대상, 링크, 'junction');
      줄.push({ 이름, 상태: 실행 ? '만듦' : '만들 것' });
    }
  }
  return 줄;
}

/** 여러 회차가 같은 분에 뜨면 같은 원격 참조를 고치다 잠금에 걸린다 — 잠깐 뒤 다시 한다 */
function 원격판받기(메인) {
  for (let 번 = 1; ; 번++) {
    try {
      git(메인, ['fetch', '-q', 'origin', '+refs/heads/master:refs/remotes/origin/master']);
      return git(메인, ['rev-parse', 'refs/remotes/origin/master']).trim();
    } catch (e) {
      if (번 >= 3) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    }
  }
}

/** 회차 맨 처음 — origin 판 사본을 사본 자리에 만든다. 미디어까지 전체다(결정 11-04, post-checkout 훅은 이 자리를 대상으로 안 본다). 들어가는 것은 EnterWorktree(path) */
function 만들기(옵션 = {}) {
  const 이름 = 옵션.이름 || '';
  if (!사본이름꼴(이름)) throw new Error(`이름은 sched-<작업 id>-<MMDD>-<HHmm>, 영문 · 숫자 · 대시만: ${이름}`);
  const 메인 = 공용작업본(뿌리(옵션.저장소 || process.cwd()));
  const 자리 = 사본자리(옵션);
  if (/[^\x00-\x7f]/.test(자리)) throw new Error(`사본 자리에 한글을 넣지 않는다(cv2가 하위 경로도 못 연다): ${자리}`);
  if (안에있나(메인, 자리)) throw new Error(`사본 자리가 저장소 안이다: ${자리}`);
  const 폴더 = path.join(자리, 이름), 가지 = `worktree-${이름}`;
  if (등록사본(메인).some((w) => 같은길(w.폴더, 폴더))) {
    let 정상 = false;
    try { 정상 = 같은길(뿌리(폴더), 폴더); } catch {}
    if (!정상) throw new Error(`${폴더}는 git에 등록만 남았고 쓸 수 있는 사본이 아니다 — 치우기 ${이름} --실행으로 등록을 지우고 다른 시각의 이름으로 만든다`);
    return { 결과: '이미 있음', 폴더, 가지, 링크: 옆링크맞추기(자리, 메인, 옵션.실행) };
  }
  if (fs.existsSync(폴더)) throw new Error(`${폴더}가 있는데 git에 등록된 사본이 아니다 — 손대지 않고 멈춘다`);
  let 가지있음 = true;
  try { git(메인, ['rev-parse', '--verify', '-q', `refs/heads/${가지}`]); } catch { 가지있음 = false; }
  if (가지있음) throw new Error(`가지 ${가지}가 이미 있다 — 다른 시각의 이름으로 만든다`);
  if (!옵션.실행) return { 결과: '미리 보기', 폴더, 가지, 링크: 옆링크맞추기(자리, 메인, false) };
  fs.mkdirSync(자리, { recursive: true });
  const 칸 = fs.statfsSync(자리);
  if (칸.bavail * 칸.bsize < 자리최소여유) throw new Error(`사본 자리 여유가 ${자리최소여유 / 2 ** 30}GiB 아래다: ${자리}`);
  const 링크 = 옆링크맞추기(자리, 메인, true);
  const 판 = 원격판받기(메인);
  // CLI가 새 사본을 뜰 때와 같이 병렬로 꺼낸다(k$r). SYNK_LIGHT_OFF: 이 사본은 미디어를 빼지 않는다
  git(메인, ['-c', 'core.longpaths=true', '-c', `checkout.workers=${Math.min(16, Math.max(1, os.cpus().length))}`, 'worktree', 'add', '-q', '-b', 가지, 폴더, 판], { SYNK_LIGHT_OFF: '1' });
  const 머리 = git(폴더, ['rev-parse', 'HEAD']).trim();
  if (머리 !== 판) throw new Error(`새 사본 판이 다르다: ${머리} · origin ${판}`);
  return { 결과: '만듦', 폴더, 가지, 판, 링크 };
}

/** 회차 맨 끝 — EnterWorktree(path)로 들어간 사본은 ExitWorktree가 안 지운다. `끝`을 다시 재서 「지워도 됨」일 때만 사본 자리의 그 사본과 그 회차 가지를 지운다 */
function 치우기(옵션 = {}) {
  const 이름 = 옵션.이름 || '';
  if (!사본이름꼴(이름)) throw new Error(`이름은 sched-<작업 id>-<MMDD>-<HHmm>, 영문 · 숫자 · 대시만: ${이름}`);
  const 시작 = path.resolve(옵션.저장소 || process.cwd());
  const 폴더 = path.join(사본자리(옵션), 이름);
  if (안에있나(폴더, 시작)) throw new Error('그 사본 안에서는 치울 수 없다 — ExitWorktree keep으로 나온 뒤 부른다');
  const 메인 = 공용작업본(뿌리(시작));
  const 등록 = 등록사본(메인).find((w) => 같은길(w.폴더, 폴더));
  if (!등록) return { 결과: '없음', 폴더, 남은것: [] };
  const 가지 = 등록.가지;
  const 폴더있음 = fs.existsSync(폴더);
  const 확인 = 폴더있음 ? 끝({ ...옵션, 저장소: 폴더 }) : { 결과: '지워도 됨', 남은것: [] };
  // 폴더가 사라진 등록이어도 그 머리의 커밋은 잃지 않는다(떨어진 머리 포함 — 등록을 지우면 reflog까지 사라진다). 폴더가 있으면 `끝`이 이미 봤다
  const 남은것 = [...확인.남은것];
  if (!폴더있음) {
    if (!등록.머리) 남은것.push('머리를 읽지 못함');
    else for (const c of git(메인, ['rev-list', '--oneline', 등록.머리, '--not', '--remotes=origin']).split('\n').filter(Boolean)) 남은것.push(`origin에 없는 커밋 ${c}`);
  }
  if (!옵션.실행) return { 결과: '미리 보기', 폴더, 가지, 남은것 };
  if (확인.결과 !== '지워도 됨' || 남은것.length) return { 결과: '남김', 폴더, 가지, 남은것 };
  let 이유 = null;
  try { git(메인, ['-c', 'core.longpaths=true', 'worktree', 'remove', '--force', 폴더]); } catch (e) { 이유 = e.message; }
  if (!이유 && fs.existsSync(폴더)) 이유 = 'git은 끝났는데 폴더가 남았다';
  if (이유) return { 결과: '못 지움', 폴더, 가지, 남은것: [], 이유 };
  let 가지지움 = false;
  if (가지 === `worktree-${이름}`) {
    try { git(메인, ['branch', '-D', 가지]); 가지지움 = true; } catch {}
  }
  return { 결과: '치움', 폴더, 가지, 가지지움, 남은것: [] };
}

/** git 밖 항목 목록(같은 항목을 두 번 내기도 한다 — Windows Git 2.55, 무시된 파일) */
function 무시항목(나, 아래 = null) {
  const r = git(나, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory', ...(아래 ? ['--', 아래] : [])]);
  return [...new Set(r.split('\0').filter(Boolean).map((x) => x.replace(/\/$/, '')))];
}

/** docs/마케팅 아래 git 밖 항목 — { 파일: [상대 경로], 링크: [상대 경로] }. 무시된 폴더는 걸어 들어가되 링크 · node_modules는 들어가지 않는다 */
function git밖(나, 아래 = 넘길곳) {
  if (!fs.existsSync(path.join(나, 아래))) return { 파일: [], 링크: [] };
  const 파일 = [], 링크 = [];
  const 걷기 = (상대) => {
    const 절대 = path.join(나, 상대);
    let st;
    try { st = fs.lstatSync(절대); } catch { return; }
    if (st.isSymbolicLink()) { 링크.push(상대); return; }
    if (st.isDirectory()) {
      if (path.basename(상대) === 'node_modules') return;
      for (const d of fs.readdirSync(절대)) 걷기(path.posix.join(상대, d));
      return;
    }
    if (st.isFile()) 파일.push(상대);
  };
  for (const e of 무시항목(나, 아래)) 걷기(e);
  return { 파일: [...new Set(파일)].sort(), 링크: [...new Set(링크)].sort() };
}

function 링크대상(절대) {
  try { return fs.readlinkSync(절대); } catch { return null; }
}

function 해시(파일) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(파일, 'r');
  try {
    const 칸 = Buffer.alloc(1024 * 1024);
    for (let n = fs.readSync(fd, 칸); n > 0; n = fs.readSync(fd, 칸)) h.update(칸.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

/** 공용 쪽을 어떻게 할지 — 같음 · 공용이 더 새것 · 새로 · 바꿈 */
function 판단(원본, 대상) {
  const s = fs.statSync(원본);
  let d = null;
  try { d = fs.statSync(대상); } catch { return { 할일: '새로', s }; }
  // 크기가 같으면 내용까지 본다 — 크기 · 시각만 같은 다른 판을 「같음」으로 보면 워크트리를 지울 때 새 판을 잃는다
  if (d.size === s.size && 해시(원본) === 해시(대상)) return { 할일: '같음', s, d };
  return { 할일: d.mtimeMs >= s.mtimeMs ? '공용이 더 새것' : '바꿈', s };
}

/** 옆 이름을 먼저 차지한 쪽만 그 파일을 넘긴다 — 파일 하나의 차례표다. 남의 옆 이름은 지우지 않는다(회수 경쟁을 만든다). 차지했으면 true */
function 옆이름차지(원본, 임시) {
  try { fs.copyFileSync(원본, 임시, fs.constants.COPYFILE_EXCL); return true; } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    return false;
  }
}

/** 한 파일을 공용 쪽으로. 돌려주는 값: 복사 · 바꿈 · 같음 · 공용이 더 새것 · 열려 있음. 검사뒤는 시험용 — 판단과 바꾸기 사이 */
function 하나넘기기(원본, 대상, 실행, { 검사뒤 = null, 검사시각 = null } = {}) {
  const 앞 = 판단(원본, 대상);
  if (앞.할일 === '같음') {
    // 검사 기록은 수정 시각까지 대조한다(작업실예약 checkedFile) — 같은 내용을 다시 굽고 다시 검사했으면 공용 쪽 시각을 맞춘다.
    // 기록이 이 원본을 검사한 것일 때만(기록 시각 = 원본 시각): 공용 영상을 복사해 왔을 뿐이거나 검사 뒤 바꾼 영상에 검사받은 시각을 달아 주면 관문이 뚫린다
    const 기록 = 실행 && 앞.d && 검사시각 ? 검사시각() : null;
    if (기록 && 기록.getTime() === Math.trunc(앞.s.mtimeMs) && 기록.getTime() !== Math.trunc(앞.d.mtimeMs)) fs.utimesSync(대상, 앞.s.atime, 기록);
    return '같음';
  }
  if (앞.할일 === '공용이 더 새것') return 앞.할일;
  if (!실행) return 앞.할일 === '새로' ? '복사' : '바꿈';
  fs.mkdirSync(path.dirname(대상), { recursive: true });
  // 옆 이름에 복사를 끝낸 뒤 바꿔 끼운다 — 도중에 실패해도 공용 쪽 옛 판이 남고, 반쯤 복사한 영상을 내놓지 않는다
  const 임시 = `${대상}.예약사본`;
  if (!옆이름차지(원본, 임시)) return '열려 있음';
  let 바꿔끼움 = false; // 바꿔 끼운 뒤의 옆 이름은 이미 내 것이 아니다 — 그 자리는 다음 회차가 차지했을 수 있어 지우지 않는다
  try {
    fs.utimesSync(임시, 앞.s.atime, 앞.s.mtime);
    if (검사뒤) 검사뒤();
    // 판단한 뒤 다른 손(잠금 밖의 사람 · 도구)이 공용 쪽을 더 새 판으로 바꿨으면 덮지 않는다
    const 뒤 = 판단(원본, 대상);
    if (뒤.할일 === '같음' || 뒤.할일 === '공용이 더 새것') return 뒤.할일;
    // 공용 쪽을 누가 열어 두면(예약큐가 올리는 중 등) Windows에서 바꿀 수 없다 — 멈추지 않고 남은 것으로 알린다
    try { fs.renameSync(임시, 대상); 바꿔끼움 = true; } catch (e) { if (['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) return '열려 있음'; throw e; }
  } finally { if (!바꿔끼움) fs.rmSync(임시, { force: true }); }
  return 앞.할일 === '새로' ? '복사' : '바꿈';
}

/** 이 워크트리 준비.json의 검사 기록에 적힌 그 파일의 수정 시각(Date) — 편 폴더 · 게시 폴더 · 저장소 어느 기준 경로로 적혔든 찾는다. 없으면 null */
function 검사기록시각(나, 상대) {
  const m = /^docs\/마케팅\/([^/]+)\/(.+)$/.exec(상대);
  if (!m) return null;
  const [, 편, 편안쪽] = m;
  try {
    const 준비 = JSON.parse(fs.readFileSync(path.join(나, 넘길곳, 편, '게시', '준비.json'), 'utf8').trimStart());
    const 후보 = new Set([상대, 편안쪽, 편안쪽.replace(/^게시\//, '')]);
    const 줄 = ((준비.검사 && 준비.검사.파일) || []).find((f) => 후보.has(f.경로));
    const 때 = 줄 && new Date(줄.수정);
    return 때 && !Number.isNaN(때.getTime()) ? 때 : null;
  } catch { return null; }
}

function 넘기기(옵션 = {}) {
  const { 나, 메인 } = 짝(옵션.저장소 || process.cwd());
  const { 파일, 링크 } = git밖(나);
  const 셈 = {};
  const 공용이더새것 = [];
  const 열려있음 = [];
  const 지금 = Date.now();
  for (const p of 파일) {
    const 원본 = path.join(나, p);
    const 결과 = 옵션.쓰는중건너뜀 && 지금 - fs.statSync(원본).mtimeMs < 쓰는중ms ? '쓰는 중' : 하나넘기기(원본, path.join(메인, p), 옵션.실행, { 검사시각: () => 검사기록시각(나, p) });
    셈[결과] = (셈[결과] || 0) + 1;
    if (결과 === '공용이 더 새것') 공용이더새것.push(p);
    if (결과 === '열려 있음') 열려있음.push(p);
  }
  const 링크들 = [];
  for (const p of 링크) {
    const 읽은링크 = 링크대상(path.join(나, p));
    let 대상 = 읽은링크 && path.resolve(path.dirname(path.join(나, p)), 읽은링크);
    // 워크트리 안을 가리키는 링크는 공용 쪽 같은 자리로 — 워크트리를 지우면 끊긴다
    const 안쪽 = 대상 && path.relative(나, 대상);
    if (대상 && 안쪽 && !안쪽.startsWith('..') && !path.isAbsolute(안쪽)) 대상 = path.join(메인, 안쪽);
    const 공용쪽 = path.join(메인, p);
    let 있음 = false;
    try { fs.lstatSync(공용쪽); 있음 = true; } catch {}
    if (!있음 && 대상 && 옵션.실행) {
      fs.mkdirSync(path.dirname(공용쪽), { recursive: true });
      fs.symlinkSync(대상, 공용쪽, 'junction');
    }
    링크들.push({ 경로: p, 대상, 공용: 있음 ? '있음' : (대상 ? (옵션.실행 ? '만듦' : '만들 것') : '대상 모름') });
  }
  return { 결과: 옵션.실행 ? '넘김' : '미리 보기', 워크트리: 나, 공용작업본: 메인, 파일: 파일.length, 셈, 공용이더새것, 열려있음, 링크: 링크들 };
}

/** 워크트리 안 git 밖 링크(junction · symlink)를 링크만 지운다 — 대상은 건드리지 않는다 */
function 링크끊기(나) {
  const 끊음 = [];
  const 걷기 = (상대, 깊이) => {
    const 절대 = path.join(나, 상대);
    let st;
    try { st = fs.lstatSync(절대); } catch { return; }
    if (st.isSymbolicLink()) { fs.unlinkSync(절대); 끊음.push(상대); return; }
    if (st.isDirectory() && 깊이 < 12 && !['.git', 'node_modules'].includes(path.basename(상대))) for (const d of fs.readdirSync(절대)) 걷기(path.posix.join(상대, d), 깊이 + 1);
  };
  for (const e of 무시항목(나)) 걷기(e, 0);
  return 끊음;
}

/** docs/마케팅 밖 git 밖 자리에 남은 결과물 — 넘기지 않으므로 지우면 잃는다(.tmp · node_modules · 빌드 결과는 빼고) */
function 안넘긴결과물(나) {
  const 찾음 = [];
  const 걷기 = (상대) => {
    if (상대 === 넘길곳 || 상대.startsWith(`${넘길곳}/`) || 버리는폴더.has(path.basename(상대))) return;
    let st;
    try { st = fs.lstatSync(path.join(나, 상대)); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) { for (const d of fs.readdirSync(path.join(나, 상대))) 걷기(path.posix.join(상대, d)); return; }
    if (결과물꼴.test(상대)) 찾음.push(상대);
  };
  for (const e of 무시항목(나)) 걷기(e);
  return 찾음.sort();
}

function 끝(옵션 = {}) {
  const { 나 } = 짝(옵션.저장소 || process.cwd());
  const 넘김 = 넘기기({ ...옵션, 저장소: 나 });
  const 안넘김 = 안넘긴결과물(나);
  const 미커밋 = git(나, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0').filter(Boolean)
    .filter((l) => /^[ MTADRCU?!]{2} /.test(l)).map((l) => l.slice(3));
  let 안올린커밋 = [];
  try { 안올린커밋 = git(나, ['rev-list', '--oneline', 'HEAD', '--not', '--remotes=origin']).split('\n').filter(Boolean); }
  catch (e) { 안올린커밋 = [`확인 못 함 — ${e.message}`]; }
  const 남은것 = [
    ...미커밋.map((p) => `미커밋 ${p}`),
    ...안올린커밋.map((c) => `origin에 없는 커밋 ${c}`),
    ...넘김.공용이더새것.map((p) => `공용 쪽이 더 새것이라 안 넘김 ${p}`),
    ...넘김.열려있음.map((p) => `공용 쪽 파일이 열려 있거나 다른 회차가 넘기는 중(잠시 뒤 다시 — 그래도 남으면 공용 쪽 ${p}.예약사본이 죽은 회차가 남긴 것인지 보고 보고한다) ${p}`),
    ...안넘김.map((p) => `docs/마케팅 밖 git 밖 결과물 ${p}`),
  ];
  const 지워도됨 = 옵션.실행 && !남은것.length;
  // 링크는 지울 수 있을 때만 끊는다 — 남은 것을 고쳐 올리려면 node_modules가 있어야 한다
  const 끊은링크 = 지워도됨 ? 링크끊기(나) : [];
  // 사본 자리의 사본은 EnterWorktree(path)로 들어갔다 — ExitWorktree가 안 지우므로 `치우기`로 지운다. 그 밖의 자리에는 `치우기`를 안내하지 않는다(그 명령은 사본 자리의 같은 이름을 지운다)
  const 다음 = !지워도됨 ? null : 같은길(path.dirname(나), 사본자리(옵션))
    ? `→ ExitWorktree keep으로 나온 뒤 node tools/예약사본.js 치우기 ${path.basename(나)} --실행으로 지운다 — 커밋은 모두 origin에 있다`
    : '→ ExitWorktree remove(discard_changes: true)로 지운다 — 커밋은 모두 origin에 있다';
  return { 결과: 지워도됨 ? '지워도 됨' : 옵션.실행 ? '남은 것 있음' : '미리 보기', 워크트리: 나, 다음, 넘김, 끊은링크, 남은것 };
}

/** 회차를 시작할 때 — 뿌리 node_modules를 공용 작업본에 잇고(바로올리기의 관련 시험 · 도구가 찾는다), 멈춘 회차의 영상을 넘긴다 */
function 들기(옵션 = {}) {
  const { 나, 메인 } = 짝(옵션.저장소 || process.cwd());
  const 모듈 = path.join(나, 'node_modules'), 공용모듈 = path.join(메인, 'node_modules');
  let 연결 = '있음';
  let 모듈있음 = false;
  try { fs.lstatSync(모듈); 모듈있음 = true; } catch {}
  if (!모듈있음) {
    if (!fs.existsSync(공용모듈)) 연결 = '공용 쪽에도 없음';
    else if (옵션.실행) { fs.symlinkSync(공용모듈, 모듈, 'junction'); 연결 = '이음'; }
    else 연결 = '이을 것';
  }
  return { 결과: 옵션.실행 ? '들어옴' : '미리 보기', 워크트리: 나, node_modules: 연결, 남은사본: 남은사본({ ...옵션, 저장소: 나 }) };
}

function 남은사본(옵션 = {}) {
  const 시작 = path.resolve(옵션.저장소 || process.cwd());
  const 메인 = 공용작업본(뿌리(시작));
  const 지금 = 뿌리(시작).toLowerCase();
  const 자리 = 사본자리(옵션);
  const 결과 = [];
  for (const { 폴더 } of 등록사본(메인)) {
    const 이름 = path.basename(폴더);
    const 회차자리 = /[\\/]\.claude[\\/]worktrees[\\/]/i.test(폴더) || 같은길(path.dirname(폴더), 자리);
    if (!회차자리 || !예약이름.test(이름) || 폴더.toLowerCase() === 지금 || !fs.existsSync(폴더)) continue;
    let 미커밋목록 = null;
    try { 미커밋목록 = git(폴더, ['status', '--porcelain=v1', '--untracked-files=normal']).split('\n').filter(Boolean).map((l) => l.slice(3)); } catch {}
    let 넘김;
    try { 넘김 = 넘기기({ 저장소: 폴더, 실행: 옵션.실행, 쓰는중건너뜀: true }); } catch (e) { 넘김 = { 결과: `못 넘김 — ${e.message}` }; }
    // 반쯤 만든 편은 파일이 수백이라 편 폴더를 따로 보인다 — 다음 회차가 어디서 이어 받을지 바로 알게
    const 미커밋편 = [...new Set((미커밋목록 || []).map((p) => (/^docs\/마케팅\/[^/]+/.exec(p.replace(/^"|"$/g, '')) || [])[0]).filter(Boolean))];
    결과.push({ 이름, 폴더, 미커밋: 미커밋목록 && 미커밋목록.length, 미커밋편, 미커밋목록: 미커밋목록 && 미커밋목록.slice(0, 20), 넘김: { 결과: 넘김.결과, 파일: 넘김.파일, 셈: 넘김.셈, 공용이더새것: 넘김.공용이더새것 } });
  }
  return { 결과: 옵션.실행 ? '넘김' : '미리 보기', 공용작업본: 메인, 사본: 결과 };
}

function 인자읽기(argv) {
  const 옵션 = { 명령: null, 실행: false, json: false, 저장소: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--실행') 옵션.실행 = true;
    else if (a === '--json') 옵션.json = true;
    else if (a === '--저장소') 옵션.저장소 = argv[++i];
    else if (!옵션.명령 && ['만들기', '들기', '넘기기', '끝', '남은사본', '치우기'].includes(a)) 옵션.명령 = a;
    else if (이름받는명령.has(옵션.명령) && !옵션.이름 && !a.startsWith('-')) 옵션.이름 = a;
    else throw new Error(`모르는 인자: ${a}`);
  }
  if (!옵션.명령) throw new Error('명령: 만들기 · 들기 · 넘기기 · 끝 · 남은사본 · 치우기');
  if (이름받는명령.has(옵션.명령) && !옵션.이름) throw new Error(`${옵션.명령}에는 사본 이름이 든다: sched-<작업 id>-<MMDD>-<HHmm>`);
  return 옵션;
}

function 셈글(셈 = {}) {
  const 글 = Object.entries(셈).map(([k, v]) => `${k} ${v}`).join(' · ');
  return 글 || '없음';
}

function 넘김글(r) {
  const 줄 = [`git 밖 파일 ${r.파일}개 → ${r.공용작업본}: ${셈글(r.셈)}`];
  for (const l of r.링크 || []) 줄.push(`  링크 ${l.경로} → ${l.대상 || '?'} (공용 쪽 ${l.공용})`);
  for (const p of r.공용이더새것 || []) 줄.push(`  공용 쪽이 더 새것이라 안 넘김: ${p}`);
  for (const p of r.열려있음 || []) 줄.push(`  공용 쪽 파일이 열려 있어 안 넘김: ${p}`);
  return 줄;
}

function main(argv = process.argv.slice(2)) {
  let 옵션;
  try { 옵션 = 인자읽기(argv); } catch (e) {
    console.error(`${e.message}\n  node tools/예약사본.js 만들기|치우기 <이름> [--실행]  ·  들기|넘기기|끝|남은사본 [--실행]  ·  공통 [--json] [--저장소 <폴더>]`);
    return 2;
  }
  if (이름받는명령.has(옵션.명령)) {
    let r;
    try { r = 옵션.명령 === '만들기' ? 만들기(옵션) : 치우기(옵션); }
    catch (e) { console.error(`[멈춤] ${e.message}`); return 1; }
    if (옵션.json) console.log(JSON.stringify(r, null, 2));
    else if (옵션.명령 === '만들기') {
      console.log([`[${r.결과}] ${r.폴더} · 가지 ${r.가지}${r.판 ? ` · 판 ${r.판.slice(0, 10)}` : ''}`,
        `옆 링크: ${r.링크.map((l) => `${l.이름} ${l.상태}`).join(' · ')}`,
        r.결과 === '미리 보기' ? '' : `→ EnterWorktree(path: "${r.폴더.replace(/\\/g, '/')}")로 들어간다`].filter(Boolean).join('\n'));
    } else {
      console.log([`[${r.결과}] ${r.폴더}${r.가지 ? ` · 가지 ${r.가지}${r.가지지움 ? ' 지움' : ''}` : ''}`,
        ...(r.이유 ? [`  까닭: ${r.이유}`] : []), ...r.남은것.map((x) => `  남음: ${x}`)].join('\n'));
    }
    return 옵션.명령 === '치우기' && !['치움', '미리 보기'].includes(r.결과) ? 1 : 0;
  }
  const r = 옵션.명령 === '들기' ? 들기(옵션) : 옵션.명령 === '넘기기' ? 넘기기(옵션) : 옵션.명령 === '끝' ? 끝(옵션) : 남은사본(옵션);
  const 사본글 = (x) => [`[${x.결과}] 남은 예약 사본 ${x.사본.length}개`,
    ...x.사본.flatMap((s) => [
      `  ${s.이름} — ${s.폴더} · 미커밋 ${s.미커밋 ?? '?'}줄 · git 밖 ${s.넘김.파일 ?? '?'}개(${셈글(s.넘김.셈)})${s.넘김.결과.startsWith('못') ? ` · ${s.넘김.결과}` : ''}`,
      ...(s.미커밋편 || []).map((p) => `    이어 받을 편 ${path.join(s.폴더, p)}`),
      ...(s.미커밋목록 || []).map((p) => `    미커밋 ${p}`),
    ])];
  if (옵션.json) { console.log(JSON.stringify(r, null, 2)); }
  else if (옵션.명령 === '들기') console.log([`[${r.결과}] ${r.워크트리} · node_modules ${r.node_modules}`, ...사본글(r.남은사본)].join('\n'));
  else if (옵션.명령 === '넘기기') console.log([`[${r.결과}]`, ...넘김글(r)].join('\n'));
  else if (옵션.명령 === '끝') {
    console.log([`[${r.결과}] ${r.워크트리}`, ...넘김글(r.넘김),
      ...(r.끊은링크.length ? [`워크트리 안 링크 ${r.끊은링크.length}개를 끊음(대상은 그대로): ${r.끊은링크.join(' · ')}`] : []),
      ...r.남은것.map((x) => `  남음: ${x}`),
      r.다음 || '',
    ].filter(Boolean).join('\n'));
  } else console.log(사본글(r).join('\n'));
  if (옵션.명령 === '끝') return r.결과 === '지워도 됨' ? 0 : 1;
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { 만들기, 치우기, 들기, 넘기기, 끝, 남은사본, git밖, 링크끊기, 안넘긴결과물, 하나넘기기, 인자읽기, main, 예약이름 };
