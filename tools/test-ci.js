#!/usr/bin/env node
'use strict';
/* CI 모사 러너 — 「로컬 초록」과 「CI 초록」이 다른 것에서 나온 F036·F039의 원인 제거.
 *
 * 2026-08-04 하루에 두 세션이 각각 같은 함정을 밟았다. 한 번은 회귀가 repo 밖
 * (`~/.claude/.../memory`) 경로를 읽어 CI를 깨뜨렸고, 한 번은 그 빨간 CI 위에서
 * 「643건 fail 0」이라는 로컬 결과를 초록이라 보고하고 라이브 배포까지 나갔다.
 * 개인 부주의가 아니다 — **로컬 머신에는 CI에 없는 것이 두 가지 있고**, 그게 있는 한
 * 로컬 스위트는 CI 결과를 예측하지 못한다:
 *   ① 로컬 시간대(KST)      → CI는 UTC. 날짜·월 계산이 갈린다.
 *   ② 홈 디렉터리           → CI엔 메모리 정본도 자격증명도 없다.
 * 둘을 지우고 스위트를 돌린다.
 *
 * 🔴 ③ **플랫폼은 못 지운다** (마찰 F620 · 2026-08-18에 추가). CI는 `ubuntu-latest`(linux)이고
 *   유호님 로컬은 win32다 — OS는 갈아끼울 수 없으니 이 모사가 **원리상 못 재는 축**이다.
 *   옛 머리말은 축을 ①②로 못박아 놓고 「여기서 초록이면 CI도 초록이다」라고 **단언**했고,
 *   그래서 윈도우 세션에게 거짓 보증을 줬다: 리눅스 클라우드 세션이 돌리자 fail 3이 났는데
 *   셋 다 윈도우에서는 초록이던 것이다. **재지 않은 축에 대한 주장**이 원인이고, 새는 방향은
 *   언제나 「통과」다. 지울 수 없는 축은 **이름 대고 말한다** — 아래 출력이 매 실행 그 줄을 낸다
 *   (판정은 `lib/ci모사환경.js` 의 `CI판`·`플랫폼줄` 한 곳에서 파생 — 손으로 적으면 갈라진다).
 *
 * ⇒ 여기서 초록이면 **같은 플랫폼의** CI도 초록이다(역은 성립하지 않는다 — CI엔 shallow
 *   체크아웃 등 여기서 못 지우는 차이가 더 있다).
 *
 * 쓰는 곳: /deploy 2단계, 완료·배포 보고 직전. `node tools/test-ci.js`
 *
 * 🔴 시간 한도 두 겹 (2026-11-10 — 전체 런 두 벌이 글자검사에서 5시간 넘게 멈췄다):
 *   ① 시험 하나 `--test-timeout`(시험한도ms): 본문이 끝없이 기다리면 그 시험을 취소(실패)로 센다.
 *   ② 런 전체(전체한도ms): 시험 본문은 끝났는데 남은 자식(그날은 크롬)이 통로를 붙잡아 **파일 프로세스가 안 끝나면** ①로는 못 잡는다
 *      (11-10 실측 — 본문은 20초에 실패로 끝났는데 파일은 5시간 뒤에도 살아 있었다). 넘기면 그때 도는 시험 파일 이름을 대고
 *      node --test 를 나무째 끈 뒤 적색으로 낸다.
 *   `--test-force-exit` 는 쓰지 않는다 — 남은 자식 문제는 덮지만 비동기로 늦게 등록되는 시험을 말없이 빼먹는다
 *   (11-10 실측: 시험 둘 중 하나만 돌고 초록). 새는 방향이 통과다.
 */
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');

function 테스트파일들() {
  if (!fs.existsSync(TESTS)) {
    console.error('[test-ci] tests/ 폴더를 못 찾음: ' + TESTS);
    process.exit(1);
  }
  const files = fs.readdirSync(TESTS)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => path.join('tests', f));

  if (!files.length) {
    console.error('[test-ci] tests/*.test.js 가 0건 — 스위트가 비었는지 확인하라');
    process.exit(1);
  }
  return files;
}

/* 테스트가 읽는 파일들의 (경로·수정시각·크기·**내용 해시**) 스냅샷.
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 **옆 세션이
 *   Code.js·HTML 을 편집하면** 테스트가 중간 상태를 읽고 빨간불이 된다. 그런데 그
 *   적색은 진짜 적색과 **모양이 완전히 같다** — 실제로 그걸 보고 남의 살아있는
 *   작업본(Code.js)을 고치러 갈 뻔했다. 통과/미실행을 가르는 것과 같은 규율이다:
 *   **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 🔴 왜 해시가 붙었나 (F616 · 2026-08-18 실측 2회 · 격리 컨테이너라 **다른 세션이 0**이었다):
 *   옛 스냅샷 키는 `mtime:size` 뿐이라 **「손댔다」와 「바뀌었다」를 못 갈랐다.** 그런데 이 스위트에는
 *   산출물을 «제자리에서 다시 굽고 바이트로 되돌리는» 검사가 있다(`tests/이해대장.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다):495` 가
 *   `docs/이해대장.html` 을, `tools/교재읽기본.js` 를 부르는 검사 셋이 `docs/교재_읽기본/권1.html` 을).
 *   그래서 mtime 만 움직인 자기 부작용이 「옆 세션이 편집 중」으로 나갔고, 그 두 검사는 거의 모든
 *   전체 런에 끼므로 **적색이면 사실상 항상** 「이 적색은 못 믿는다 · 재실행하라」가 함께 떴다.
 *   새는 방향이 통과가 아니라 **「빨간 것을 안 믿게 만든다」**다 — 초록은 다시 재면 되지만 이건
 *   재라는 처방이 매번 참이라 무한히 미룰 수 있다. 게다가 처방이 따를 수 없었다(F103):
 *   「누구 파일인지는 `작업본소유자.js`」인데 그 목록엔 아무도 없다(실측: 그 런들에서 `git status` 는
 *   실행 **전후 모두** 빈 출력이었다 — 두 파일 다 무변경으로 돌아와 있었다).
 *
 * 🔑 대가를 값으로 적는다 — `before` 만 전량 해시하고 `after` 는 도장이 같으면 **재사용**한다.
 *   실측 2026-08-18(이 컨테이너): 1355파일·44.2MB·해시 **2.8초** / 스위트 155초 = **+1.8%**.
 *   양쪽 다 해시하면 두 배인데, 도장(mtime:size)이 같은 파일은 내용도 같다고 보는 것이 옛 판의
 *   전제 그대로라 여기서 새로 무는 것이 없다.
 * @param {Map|null} 앞판 주면 도장이 같은 항목의 해시를 그대로 물려받는다(= 안 읽는다).
 * @param {string} 루트 훑을 뿌리. **기본은 이 저장소**이고, 픽스처가 임시 트리를 넘길 때만 바뀐다.
 *
 * 🔑 이 인자가 왜 있나 (F616 델타 · 2026-08-18 변이 실측 4건 중 **구멍 3**):
 *   판정·문장·배선은 회귀 11건이 덮는데 **걸음(무엇을 훑고 무엇을 거르나) 층은 소스 앵커뿐**이라,
 *   목록 글자를 안 건드리면서 걸음만 망가뜨리는 변이가 전부 통과했다 — 실측:
 *   ①`.claude/state` 를 안 거른다 ②`node_modules` 를 안 거른다 ③하위 폴더를 안 훑는다(깊이 2→0).
 *   셋 다 새는 방향이 「통과」다: ①②는 매 런 노이즈로 경고를 죽이고, ③은 `tools/lib` 나 `docs`
 *   아래 한 겹 더 들어간 자리가 통째로 사각이 된다 — F616 이 본 두 파일 중 하나가 바로
 *   `docs/교재_읽기본/권1.html` 이다.
 *   뿌리를 인자로 받으면 픽스처가 진짜 파일로 그 층을 잰다 — 소스 글자가 아니라 **행동**으로.
 */
function snapshot(앞판 = null, 루트 = ROOT) {
  const out = new Map();
  const walk = (dir, depth) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      // `.claude/state` 는 훅이 매 턴 갱신하는 런타임 상태라 늘 바뀐다 — 세면 경고에 노이즈만 는다.
      /* 🔴 `worktrees` — `.claude/worktrees/` 밑은 **이 체크아웃의 파일이 아니다**(다른 가지의 사본).
       *   [08-26 실측] 안 빼면 스냅샷이 614개를 세고 그중 21개가 워크트리 사본이었다 —
       *   CLAUDE.md·Code.js·엔진_*.js 가 «두 벌»로 잡혀 「안 바뀐 파일이 바뀌었다」로 뜬다.
       *   (`tools/인용검사.js(10-20 보관):241` 이 이미 쓰는 규칙과 같다.) */
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'state' || e.name === 'worktrees') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth > 0) walk(p, depth - 1); continue; }
      if (!/\.(js|json|md|html|txt)$/i.test(e.name)) continue;
      const 상대 = path.relative(루트, p);
      let 도장;
      try { const s = fs.statSync(p); 도장 = `${s.mtimeMs}:${s.size}`; } catch (_) { continue; /* 사라진 파일 */ }
      const 앞 = 앞판 && 앞판.get(상대);
      if (앞 && 앞.도장 === 도장) { out.set(상대, 앞); continue; }
      let 해시 = null;   // null = 못 읽었다(≠ 같다) — 아래 판정이 「모름」으로 따로 센다(F207)
      try { 해시 = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); } catch (_) { /* 읽기 실패 */ }
      out.set(상대, { 도장, 해시 });
    }
  };
  walk(루트, 0);
  for (const d of ['tests', 'tools', 'docs', '.claude']) walk(path.join(루트, d), 2);
  return out;
}

/**
 * 관측 두 벌 → 판정. **순수 함수다**(F543 계보 — 판정을 떼 놔야 픽스처가 탐지력을 진다).
 * 갈래를 셋으로 낸다. 뭉치면 그 순간 이 도구가 F616 로 되돌아간다:
 *   · `밖에서바뀜` — 바이트가 실제로 달라졌다. **이것만이** 적색을 의심할 근거다.
 *   · `되돌아옴`  — 다시 쓰였는데 바이트는 그대로. 이 런이 스스로 구운 산출물이다(경고 아님 · 분모).
 *   · `모름`      — 어느 한쪽을 못 읽었다. 「같다」로 접지 않는다(F207).
 * @returns {{밖에서바뀜:string[], 되돌아옴:string[], 사라짐:string[], 모름:string[], 분모:number}}
 */
function 판정(before, after) {
  const 밖에서바뀜 = []; const 되돌아옴 = []; const 사라짐 = []; const 모름 = [];
  for (const [p, 앞] of before) {
    const 뒤 = after.get(p);
    if (뒤 === undefined) { 사라짐.push(p); continue; }
    if (앞.도장 === 뒤.도장) continue;                       // 손도 안 댔다
    if (앞.해시 === null || 뒤.해시 === null) { 모름.push(p); continue; }
    if (앞.해시 === 뒤.해시) { 되돌아옴.push(p); continue; }   // 다시 쓰였을 뿐 — 바이트 무변경
    밖에서바뀜.push(p);
  }
  /* 새로 **생긴** 파일은 안 센다 — 테스트가 읽던 대상이 아니었다(스위트 자신의 산출물이 섞인다). */
  return { 밖에서바뀜, 되돌아옴, 사라짐, 모름, 분모: before.size };
}

/** 판정 → 사람이 읽을 줄들. 순수 함수라 픽스처가 «무엇을 말하는가»까지 잰다. */
function 알림줄들(판, code) {
  const 줄 = [];
  /* 🔑 적색을 의심할 근거는 **`밖에서바뀜`·`사라짐`뿐**이다(F616).
   *   「다시 쓰였지만 바이트는 그대로」는 이 런 자신의 부작용이라 남의 탓이 아니고, 적색과도 무관하다. */
  const 진짜 = [...판.밖에서바뀜, ...판.사라짐.map((p) => `${p} (삭제됨)`)];
  if (code !== 0 && (진짜.length || 판.모름.length)) {
    줄.push('');
    줄.push(`[test-ci] ⚠ **이 적색은 못 믿을 수 있다** — 도는 동안 ${진짜.length}개 파일의 **내용이** 달라졌다(밖에서 편집 중).`);
    for (const p of 진짜.slice(0, 8)) 줄.push(`   · ${p}`);
    if (진짜.length > 8) 줄.push(`   · … 외 ${진짜.length - 8}건`);
    if (판.모름.length) 줄.push(`   · (읽지 못해 판정 못 한 것 ${판.모름.length}건 — 「같다」로 접지 않았다)`);
    줄.push('   → **고치러 가기 전에 재실행하라.** 08-04 실측: 이 거짓 적색 2회, 하마터면 남의 작업본을 고칠 뻔했다.');
    줄.push('   → 여전히 빨갛고 이 경고가 없으면 그건 진짜다. 누구 파일인지는 `list_sessions(하네스)`.');
  }
  /* 분모를 한 줄로 낸다 — F616 이 「몇 벌인지 안 셌다」로 남긴 자리다. 경고가 아니라 관측이다. */
  if (판.되돌아옴.length) {
    줄.push(`[test-ci] ℹ 이 런이 스스로 다시 구운 산출물 ${판.되돌아옴.length}벌 — **바이트 무변경**이라 적색과 무관하다`
      + `: ${판.되돌아옴.slice(0, 4).join(' · ')}${판.되돌아옴.length > 4 ? ` … 외 ${판.되돌아옴.length - 4}건` : ''}`);
  }
  return 줄;
}

/* 두 한도 모두 실측에서 잡았다 — 11-10 아침 전체 런 46분 43초(334파일)에서 `tests/바로올리기.test.js` 한 파일이 약 46분으로 긴 막대였고
 *   가장 긴 시험 하나가 300초(그 파일의 「공용 작업본: 새 경로 목록이 Windows 명령 길이를…」)였다. 그날 밤 그 파일이 git을 띄우는 수를 줄였다
 *   (같은 시각 나란히 단독 62.7분 → 47.3분 · 그 시험 118초 → 15초 — 현장 노트 시험_화면확인 「바로올리기 시험 한 파일이 test-ci 전체 런의 긴 막대다」).
 *   그래도 PC가 바쁜 밤의 전체 런은 80분 50초(339파일)였다 — 끝까지 남는 것은 여전히 그 파일이고 다음 막대는 `tests/공개.test.js`(약 50분) ·
 *   `tests/내커밋.test.js`(약 35분)다. 부하에 따라 두 배 가까이 늘어 시험 20분 · 전체 120분으로 둔다 — 정상 런을 끊지 않되 멈춘 런은 끝이 있다. */
const 시험한도ms = 20 * 60e3;
const 전체한도ms = 120 * 60e3;
const 분글 = (ms) => `${Math.round(ms / 60e3)}분`;

/** 프로세스 명령 줄 글에서 시험 파일(tests/…test.js) 경로를 뽑는다 — 순수 함수(시험이 문장으로 잰다). */
function 시험파일뽑기(글) {
  return [...new Set((String(글 || '').match(/tests[\\/][^\s"'<>|]+?\.test\.[cm]?js/g) || []).map((p) => p.replace(/\\/g, '/')))];
}

/** 윈도우 밖의 프로세스 표 { pid, ppid, args } — ps -e 는 리눅스 · 맥 모두 있다. */
function 프로세스표() {
  const r = spawnSync('ps', ['-e', '-o', 'pid=,ppid=,args='], { encoding: 'utf8', timeout: 30000 });
  return String(r.stdout || '').split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), args: m[3] }));
}

/** pid 바로 아래에서 아직 도는 프로세스의 명령 줄 — node --test 는 시험 파일마다 아이 node 하나를 띄우고 그 명령 줄에 파일 경로가 있다. */
function 아이명령줄(pid) {
  if (process.platform !== 'win32') return 프로세스표().filter((p) => p.ppid === Number(pid)).map((p) => p.args).join('\n');
  // 출력 인코딩을 UTF-8로 못 박는다 — 안 박으면 콘솔 코드 페이지(CP949)로 나와 한글 시험 파일 이름이 깨진다(11-10 실측)
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '
    + `Get-CimInstance Win32_Process -Filter "ParentProcessId=${Number(pid)}" | ForEach-Object { $_.CommandLine }`],
  { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  return String(r.stdout || '');
}

/** 나무째 끈다 — 윈도우는 taskkill /T(아래 파일 · 크롬까지), 그 밖은 자손을 **먼저 다 모은 뒤**(부모가 죽으면 고아로 옮겨 가 못 찾는다) 끈다. */
function 나무끄기(아이) {
  if (process.platform === 'win32') {
    const r = spawnSync('taskkill', ['/PID', String(아이.pid), '/T', '/F'], { windowsHide: true, timeout: 30000 });
    if (r.status === 0) return;
  } else {
    const 표 = 프로세스표();
    const 아래 = []; const 볼 = [아이.pid];
    while (볼.length) { const p = 볼.pop(); for (const x of 표) if (x.ppid === p) { 아래.push(x.pid); 볼.push(x.pid); } }
    for (const p of 아래) { try { process.kill(p, 'SIGKILL'); } catch (_) { /* 이미 끝났다 */ } }
  }
  try { 아이.kill('SIGKILL'); } catch (_) { /* 이미 끝났다 */ }
}

/**
 * node --test 를 두 겹 한도(머리말)로 돌린다 → { status, signal, error, 넘김: null | { 파일: string[] } }.
 * 뿌리 · 한도를 인자로 받는 까닭: 픽스처가 「남은 자식 때문에 안 끝나는 파일」을 진짜로 만들어 한도 · 이름 대기 · 끄기를 행동으로 잰다.
 */
function 돌리기(files, env, { cwd = ROOT, 시험ms = 시험한도ms, 전체ms = 전체한도ms, stdio = 'inherit' } = {}) {
  const 환경 = { ...env };
  delete 환경.NODE_TEST_CONTEXT; // 시험 안에서 불려도 바깥 러너에 붙지 않고 제 러너로 돈다
  return new Promise((맞다) => {
    let 끝 = false;
    let 넘김 = null;
    let 아이;
    try {
      아이 = spawn(process.execPath, ['--test', `--test-timeout=${시험ms}`, ...files], { cwd, env: 환경, stdio, windowsHide: true });
    } catch (e) { 맞다({ status: null, signal: null, error: e, 넘김 }); return; }
    const 시계 = setTimeout(() => {
      넘김 = { 파일: 시험파일뽑기(아이명령줄(아이.pid)) };
      나무끄기(아이);
    }, 전체ms);
    const 마침 = (r) => { if (끝) return; 끝 = true; clearTimeout(시계); 맞다({ ...r, 넘김 }); };
    아이.on('error', (e) => 마침({ status: null, signal: null, error: e }));
    아이.on('exit', (status, signal) => 마침({ status, signal, error: undefined }));
  });
}

/** 한도를 넘겼을 때의 줄들 — 순수 함수. */
function 넘김줄들(넘김, 전체ms = 전체한도ms) {
  if (!넘김) return [];
  return [
    '',
    `[test-ci] ⏱ 런 전체가 ${분글(전체ms)}을 넘겨 node --test 를 나무째 껐다 — 그때 아직 안 끝난 시험 파일: ${넘김.파일.length ? 넘김.파일.join(' · ') : '(명령 줄에서 못 읽음)'}`,
    '   → 시험 본문은 끝났는데 파일이 안 끝나면 남은 자식(크롬 · 서버)이 통로를 붙잡은 것이다. 그 파일만',
    `     \`node --test --test-timeout=${시험한도ms} <파일>\`로 따로 돌려 보고, 현장 노트 시험_화면확인 「몇 시간째 안 끝난다」 절을 본다.`,
  ];
}

async function 주() {
  const files = 테스트파일들();
  /* CI 모사 환경은 lib/ci모사환경.js **한 벌**에서 온다 (F389) — clasp-guard 안전테스트와 여기가
   * 각자 조립하다 갈라져, 「여기 초록」이 배포 게이트 통과를 예측하지 못했다. 조리법은 그 파일에. */
  const 모사환경 = require('./lib/ci모사환경.js');
  const 모사 = 모사환경.만들기();
  /* ③ 축 — 지울 수 없으니 잰 자리에서 이름을 댄다(F620 · 머리말). 워크플로에서 읽는다. */
  const ci판 = 모사환경.CI판(ROOT);

  console.log(`[test-ci] CI 모사: TZ=UTC · HOME=${모사.fakeHome}(빈 폴더) · plat=${process.platform} · 테스트 ${files.length}파일`
    + ` · 한도 시험마다 ${분글(시험한도ms)} · 전체 ${분글(전체한도ms)}`);
  const before = snapshot();
  const r = await 돌리기(files, 모사.env);
  const after = snapshot(before);

  모사.치우기();

  if (r.error) {
    console.error('[test-ci] 실행 실패: ' + r.error.message);
    process.exit(1);
  }
  for (const 줄 of 넘김줄들(r.넘김)) console.error(줄);
  const code = r.넘김 || r.status === null ? 1 : r.status;

  // 도는 동안 바뀐 파일 — 스위트가 스스로 만드는 임시물은 위 스냅샷 대상에 없다(tmp 로 나간다).
  for (const 줄 of 알림줄들(판정(before, after), code)) console.error(줄);

  /* ⚠ 초록을 「CI 초록」이라 단언하지 않는다 — 이건 **모사**라 환경 의존 실패(git 이력·얕은 클론
   * 같은 것)를 구조적으로 못 본다. 2026-08-04 F095: 여기서 1178/0 초록이던 그 순간 실제 CI 는
   * 적색이었고, 그 적색이 주인 없이 남아 모두의 배포 게이트를 막았다. 아는 만큼만 말한다. */
  /* 🔴 초록·적색 **둘 다** 플랫폼 줄을 단다(F620). 초록에만 달면 「내 적색이 저쪽 판에도 나는가」를
   *   못 가르고, 적색에만 달면 거짓 보증이 그대로 남는다 — 분모는 판정과 함께 다녀야 한다. */
  console.log(모사환경.플랫폼줄(process.platform, ci판).replace(/\n$/, ''));
  console.log(code === 0
    // ⚠ 옛 안내는 `gh run list --limit 1` 이었는데, 그건 **남의 push 로 생긴 최신 run** 을 보여줄
    //   뿐이라 「내 커밋이 검증됐나」에 답하지 못한다(F175 · 웹훅이 끊겨 run 0건이던 날 실측).
    ? '[test-ci] ✅ CI 모사 초록 — 단 이건 모사다(환경 의존 실패는 못 본다). 진실 층은 원격 run: `node tools/원격ci.js`'
    : '[test-ci] ❌ CI 모사 실패 — 로컬에서는 통과해도 CI는 여기서 막힌다\n'
      + '   → **배포하려던 것이면 여기서 멈추기 전에 층을 가른다**: 나갈 바이트는 작업본이 아니라 HEAD 다.\n'
      + '     `node tools/원격ci.js` 가 초록이면 이 적색은 **커밋 안 된 작업** 탓이라 라이브와 무관하고,\n'
      + '     clasp-guard 도 같은 판정으로 통과시킨다(F240 축 B — 우회가 아니라 재는 대상을 바로잡은 것).');
  process.exit(code);
}

/* 판정을 **내보낸다** — 회귀가 소스에서 정규식으로 블록을 긁어 `new Function` 으로 돌리던 자리다.
 * 긁어 쓰면 구조를 바꿀 때마다 회귀가 조용히 「못 찾음」이 되고, 그때 새는 방향은 통과다. */
module.exports = { snapshot, 판정, 알림줄들, 시험파일뽑기, 돌리기, 넘김줄들 };

if (require.main === module) 주().catch((e) => { console.error('[test-ci] 실행 실패: ' + (e && e.stack || e)); process.exit(1); });
