#!/usr/bin/env node
/**
 * peer-edit-watch — 「내가 답을 끝낸 뒤, 다른 창이 파일을 만졌나」를 잰다.
 *
 * ─ 왜 있나 (09-09 유호님 요청)
 *   유호님은 클로드 창과 GPT 창을 «번갈아» 쓰신다. 동시에 치지 않으니 파일이 서로
 *   덮어쓰는 사고는 안 난다. 그런데 남는 함정이 하나 있다 — **「손에 든 옛 종이」**.
 *     1) 클로드가 A.js 를 읽는다 → 내용을 문맥에 들고 있다
 *     2) 유호님이 GPT 창으로 가서 A.js 를 고친다
 *     3) 클로드 창으로 돌아온다 → 클로드는 **아직 1)의 옛 내용**을 들고 있다
 *     4) 그 위에 고친다 → GPT 가 한 것이 **조용히** 지워진다 (빨간 줄 0)
 *   09-05 에 이 무늬로 옆 세션 커밋을 되돌렸다(기억 stale-base-commit-reverts-peer).
 *
 * ─ 어떻게 가르나
 *   Stop(내 답이 끝나는 순간)에 작업트리 상태를 찍어 둔다. 다음 UserPromptSubmit
 *   (유호님 입력)에 다시 재서 다르면, 그 차이는 **내가 안 만든 것**이다 — 그 사이
 *   이 세션은 돌지 않았으니까. 곧 다른 창이거나 뒤에서 도는 일감이다.
 *
 * ─ 자리
 *   Stop             → --찍기 (출력 0)
 *   UserPromptSubmit → --재기 (다르면 알림 · 스냅샷은 안 건드린다)
 *   아무 때나        → --자가시험 (스스로 재고 종료코드로 답한다)
 *
 * ─ 넘지 않는 선
 *   **막지 않는다.** 알리기만 한다. 어떤 갈래로도 종료코드는 0 이다(--자가시험 제외).
 *   여기서 죽으면 유호님 턴이 통째로 막히므로, 모든 실패는 삼키고 0 으로 나간다.
 *
 * ─ GPT 쪽
 *   tools/codex-hook-bridge.js 가 .claude/settings.json 을 그때그때 읽어 코덱스에도
 *   같은 훅을 싣는다. 그래서 이 파일 한 벌이 **양쪽 창**을 다 지킨다.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const 뿌리 = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/* 🔴 스냅샷은 **저장소 밖**에 둔다.
 *   처음엔 .claude/state/ 에 뒀다. 그 자리는 .gitignore 가 막아 주니 괜찮아 보였는데,
 *   자가시험이 잡았다 — 훅이 제 스냅샷 폴더를 만드는 순간 그게 «새로 생긴 미추적
 *   디렉토리»가 되어 **훅이 제 발자국을 보고 알림을 냈다**. 지금 저장소에서만 조용한
 *   것은 .gitignore 한 줄 덕이고, 그 줄이 바뀌면 깨진다. 그래서 아예 저장소를 안
 *   건드리는 자리로 옮겼다. 지워져도 안전하다 — 스냅샷이 없으면 첫 턴처럼 조용히 지나간다.
 *   저장소(워크트리)마다 갈라야 여러 갈래가 섞이지 않는다. */
const 곳간 = path.join(
  require('os').tmpdir(),
  'synk-peer-watch',
  crypto.createHash('sha1').update(뿌리).digest('hex').slice(0, 16)
);

/* 자동으로 쌓이거나 기계만 쓰는 자리 — 알려도 유호님이 할 일이 없다.
 * 좁게 잡는다: docs/_ops/ 안엔 결정.md·트랙.md 처럼 «봐야 하는» 것도 산다. */
const 무시목록 = [
  /^docs\/_ops\/[^/]+\.jsonl$/,   // 실행기록·검수기록 등 자동 장부
  /^\.claude\/state\//,           // 훅들의 상태 파일
  /^\.tmp-/,                      // 임시 산출
  /\.log$/,
  /^node_modules\//,
  /^\.claude\/settings\.local\.json$/,
];

const 무시인가 = (p) => 무시목록.some((re) => re.test(p));

// ══════════════════════════════════════════════════════════ 재는 자

function git(...args) {
  return execFileSync('git', ['-C', 뿌리, ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
}

/** 지금 작업트리의 «바뀐 것» 목록을 { 경로: "상태|수정시각|크기" } 로 만든다.
 *  -z 를 쓰는 까닭 = 한글 경로. 기본 --porcelain 은 한글을 따옴표+숫자로 감싸 내보내
 *  경로가 원본과 달라진다. -z 는 NUL 로만 가르니 글자를 안 건드린다. */
function 지금상태() {
  const 원 = git('status', '--porcelain=v1', '-z', '--untracked-files=normal');
  const 칸 = 원.split('\0');
  const 표 = Object.create(null);

  for (let i = 0; i < 칸.length; i++) {
    const 줄 = 칸[i];
    if (!줄 || 줄.length < 4) continue;
    const 상태 = 줄.slice(0, 2);
    const 경로 = 줄.slice(3);
    // 이름 바뀜(R)·복사(C) 는 «새 경로 \0 옛 경로» 두 칸으로 온다 — 다음 칸을 건너뛴다
    if (상태[0] === 'R' || 상태[0] === 'C') i++;
    if (!경로 || 무시인가(경로)) continue;

    let 지문 = '?';
    try {
      const st = fs.statSync(path.join(뿌리, 경로));
      지문 = `${Math.floor(st.mtimeMs)}|${st.size}`;
    } catch {
      지문 = '없음'; // 지워진 것
    }
    표[경로] = `${상태}|${지문}`;
  }
  return 표;
}

function 지금머리() {
  try {
    return git('rev-parse', 'HEAD').trim();
  } catch {
    return '';
  }
}

// ══════════════════════════════════════════════════════════ 곳간

/** 스냅샷을 세션마다 가른다. 각 창이 «자기가 마지막으로 본 시점»을 기준으로 재야
 *  서로를 볼 수 있다. session_id 가 없으면(코덱스 다리가 안 넘길 수 있다) 작업
 *  디렉토리로 떨어뜨린다 — 그 경우 같은 창이 여럿이면 알림이 겹칠 수 있으나,
 *  막는 장치가 아니라 알리는 장치라 치명적이지 않다. */
function 열쇠(입력) {
  const sid = 입력 && (입력.session_id || 입력.sessionId);
  if (sid && typeof sid === 'string') return sid.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'nosession';
  return 'cwd-' + crypto.createHash('sha1').update(뿌리).digest('hex').slice(0, 12);
}

const 곳간길 = (k) => path.join(곳간, `${k}.json`);

function 읽기(k) {
  try {
    return JSON.parse(fs.readFileSync(곳간길(k), 'utf8'));
  } catch {
    return null;
  }
}

function 쓰기(k, 값) {
  fs.mkdirSync(곳간, { recursive: true });
  const 임시 = 곳간길(k) + '.tmp';
  fs.writeFileSync(임시, JSON.stringify(값));
  fs.renameSync(임시, 곳간길(k)); // 반쯤 쓰인 파일을 다음 턴이 읽지 않게
}

/** 오래 안 쓴 스냅샷을 걷는다(세션은 늘어나기만 하므로). */
function 묵은것걷기() {
  try {
    const 한계 = Date.now() - 14 * 24 * 60 * 60 * 1000;
    for (const 이름 of fs.readdirSync(곳간)) {
      const p = path.join(곳간, 이름);
      try {
        if (fs.statSync(p).mtimeMs < 한계) fs.unlinkSync(p);
      } catch { /* 지우다 실패해도 그만 */ }
    }
  } catch { /* 곳간이 아직 없다 */ }
}

// ══════════════════════════════════════════════════════════ 가르는 자

function 차이(옛, 새) {
  const 생김 = [];
  const 바뀜 = [];
  const 사라짐 = [];

  for (const [p, v] of Object.entries(새.files)) {
    if (!(p in 옛.files)) {
      /* 스냅샷에 없던 경로가 새로 뜬 갈래는 둘이다.
       *   ?? = 없던 파일이 생겼다
       *   그 밖(' M' 등) = 원래 깨끗해서 목록에 안 뜨던 추적 파일이 고쳐졌다
       * 둘을 안 가르면 「고쳐졌다」를 「새로 생겼다」로 잘못 부른다(자가시험 ④가 잡았다). */
      (v.startsWith('??') ? 생김 : 바뀜).push(p);
    } else if (옛.files[p] !== v) 바뀜.push(p);
  }
  for (const p of Object.keys(옛.files)) {
    if (!(p in 새.files)) 사라짐.push(p);
  }
  return { 생김, 바뀜, 사라짐, 머리바뀜: 옛.head !== 새.head };
}

/** 두 머리 사이에 커밋이 몇 개 들어왔나. 못 세면 null. */
function 커밋수(옛머리, 새머리) {
  if (!옛머리 || !새머리 || 옛머리 === 새머리) return null;
  try {
    const n = git('rev-list', '--count', `${옛머리}..${새머리}`).trim();
    return /^\d+$/.test(n) ? Number(n) : null;
  } catch {
    return null;
  }
}

function 알림글(d, 옛, 새) {
  const 줄 = [];
  const 전부 = [
    ...d.바뀜.map((p) => [p, '내용이 바뀌었다']),
    ...d.생김.map((p) => [p, '새로 생겼다']),
    ...d.사라짐.map((p) => [p, d.머리바뀜 ? '커밋됐다' : '되돌려졌다']),
  ];
  const 합 = 전부.length;

  const 머리말 = [];
  if (합) 머리말.push(`파일 ${합}건`);
  if (d.머리바뀜) {
    const n = 커밋수(옛.head, 새.head);
    머리말.push(n ? `커밋 ${n}개` : '커밋');
  }

  줄.push(`🪟 **내가 답을 끝낸 뒤에 다른 창이 만졌다** — ${머리말.join(' · ')}`);

  for (const [p, 왜] of 전부.slice(0, 8)) 줄.push(`   · ${p} (${왜})`);
  if (합 > 8) 줄.push(`   · … 외 ${합 - 8}건 (\`git status\` 로 전부 본다)`);

  if (d.머리바뀜) 줄.push(`   · 커밋이 늘었다: ${옛.head.slice(0, 9)} → ${새.head.slice(0, 9)}`);

  줄.push('→ 🔴 **이 파일들은 손대기 전에 다시 읽는다.** 안 읽고 고치면 내가 든 옛 내용이 다른 창의 작업을 조용히 지운다.');
  줄.push('→ 뒤에서 도는 일감(밤 배치·배경 명령)이 만졌을 수도 있다. 어느 쪽인지는 파일을 열어 본다.');
  return 줄.join('\n');
}

// ══════════════════════════════════════════════════════════ 들머리

function 입력읽기() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function 찍기(입력) {
  const k = 열쇠(입력);
  쓰기(k, { head: 지금머리(), files: 지금상태(), at: Date.now() });
  묵은것걷기();
}

function 재기(입력) {
  const k = 열쇠(입력);
  const 옛 = 읽기(k);
  if (!옛 || !옛.files) return; // 첫 턴 — 견줄 것이 없으니 조용히 지나간다

  const 새 = { head: 지금머리(), files: 지금상태() };
  const d = 차이(옛, 새);
  if (!d.생김.length && !d.바뀜.length && !d.사라짐.length && !d.머리바뀜) return;

  process.stdout.write(알림글(d, 옛, 새) + '\n');
}

// ══════════════════════════════════════════════════════════ 자가시험
//   기억 test-guards-the-defect: 소스 «글자»가 아니라 «실제로 잡히나»를 잰다.
//   그래서 진짜 임시 저장소를 하나 만들어 시나리오를 그대로 돌린다.

function 자가시험() {
  const os = require('os');
  const 밭 = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-watch-'));
  const 원래뿌리 = 뿌리;
  let 실패 = 0;
  const 잰다 = (이름, 참인가, 덧말) => {
    if (참인가) console.log(`  ✅ ${이름}`);
    else { console.log(`  ❌ ${이름}${덧말 ? ' — ' + 덧말 : ''}`); 실패++; }
  };

  try {
    const g = (...a) => execFileSync('git', ['-C', 밭, ...a], { encoding: 'utf8', windowsHide: true });
    g('init', '-q');
    g('config', 'user.email', 'test@synk.local');
    g('config', 'user.name', 'test');
    /* 줄바꿈 자동 변환을 끈다. 켜져 있으면 git 이 «내가 안 만진 파일»을 수정됨으로 띄워
     * 시험이 훅 결함과 밭 잡음을 못 가른다(첫 판에서 실제로 그렇게 빨개졌다). */
    g('config', 'core.autocrlf', 'false');
    fs.writeFileSync(path.join(밭, '씨앗.txt'), 'a\n');
    /* 장부 무시가 실제 상황을 재게 하려면 그 파일이 «이미 추적»되어야 한다.
     * 미추적이면 git 이 상위 폴더째 접어 `docs/` 한 줄로 내놓아 경로 규칙이 안 걸린다. */
    fs.mkdirSync(path.join(밭, 'docs', '_ops'), { recursive: true });
    fs.writeFileSync(path.join(밭, 'docs', '_ops', '실행기록.jsonl'), '{"x":0}\n');
    g('add', '--', '씨앗.txt', 'docs/_ops/실행기록.jsonl');
    g('commit', '-q', '-m', '씨앗');

    // 하위 프로세스로 돌려야 뿌리 상수가 새로 잡힌다
    const 돌리기 = (플래그, 입력) => execFileSync(process.execPath, [__filename, 플래그], {
      encoding: 'utf8',
      input: JSON.stringify(입력),
      env: { ...process.env, CLAUDE_PROJECT_DIR: 밭 },
      windowsHide: true,
    });

    const 세션 = { session_id: 'selftest-1' };

    // ① 첫 재기 — 스냅샷이 없으니 조용해야 한다
    잰다('첫 턴은 조용하다', 돌리기('--재기', 세션).trim() === '');

    // ② 찍고 → 아무것도 안 바꾸고 재기 — 조용해야 한다
    돌리기('--찍기', 세션);
    const r2 = 돌리기('--재기', 세션);
    잰다('안 바뀌면 조용하다', r2.trim() === '', r2.slice(0, 200));

    // ③ 한글 이름 파일을 새로 만든다 — 잡혀야 하고 경로가 안 깨져야 한다
    fs.writeFileSync(path.join(밭, '한글 이름.md'), '새것\n');
    const r3 = 돌리기('--재기', 세션);
    잰다('새 파일을 잡는다', /새로 생겼다/.test(r3), r3.slice(0, 120));
    잰다('한글 경로가 안 깨진다', r3.includes('한글 이름.md'), r3.slice(0, 200));

    // ④ 다시 찍고 → 기존 추적 파일의 «내용»을 바꾼다 (크기까지 바꿔 시각 해상도에 안 기댄다)
    돌리기('--찍기', 세션);
    fs.writeFileSync(path.join(밭, '씨앗.txt'), 'a-바뀜-더-길게\n');
    const r4 = 돌리기('--재기', 세션);
    잰다('내용 바뀜을 잡는다', /씨앗\.txt.*내용이 바뀌었다/.test(r4), r4.slice(0, 200));

    // ⑤ 다시 찍고 → 커밋을 하나 얹는다 — 커밋 늘어남을 잡아야 한다
    돌리기('--찍기', 세션);
    g('add', '--', '씨앗.txt', '한글 이름.md');
    g('commit', '-q', '-m', '옆 창이 한 커밋');
    const r5 = 돌리기('--재기', 세션);
    잰다('커밋 늘어남을 잡는다', /커밋이 늘었다/.test(r5), r5.slice(0, 200));

    // ⑥ 무시 목록이 실제로 먹나 — 자동 장부만 바뀌면 조용해야 한다
    돌리기('--찍기', 세션);
    fs.appendFileSync(path.join(밭, 'docs', '_ops', '실행기록.jsonl'), '{"x":1}\n');
    const r6 = 돌리기('--재기', 세션);
    잰다('자동 장부는 안 알린다', r6.trim() === '', r6.slice(0, 200));

    // ⑥-b 무시가 «전부 무시»로 새지 않나 — 장부와 진짜 파일이 함께 바뀌면 진짜 것만 알린다
    돌리기('--찍기', 세션);
    fs.appendFileSync(path.join(밭, 'docs', '_ops', '실행기록.jsonl'), '{"x":2}\n');
    fs.writeFileSync(path.join(밭, 'docs', '_ops', '트랙.md'), '진짜 문서\n');
    const r6b = 돌리기('--재기', 세션);
    잰다('무시가 이웃 파일까지 먹지 않는다',
      /트랙\.md/.test(r6b) && !/실행기록/.test(r6b), r6b.slice(0, 250));

    // ⑦ 세션이 다르면 서로 안 섞인다
    돌리기('--찍기', { session_id: 'selftest-2' });
    fs.writeFileSync(path.join(밭, '둘째.txt'), 'x\n');
    const r7a = 돌리기('--재기', { session_id: 'selftest-2' });
    잰다('다른 세션도 제 기준으로 잡는다', /둘째\.txt/.test(r7a), r7a.slice(0, 200));

    // ⑧ 재기는 스냅샷을 안 건드린다 — 같은 알림이 두 번 나와야 한다
    const r8 = 돌리기('--재기', { session_id: 'selftest-2' });
    잰다('재기가 스냅샷을 안 먹는다', /둘째\.txt/.test(r8), r8.slice(0, 200));

    // ⑨ git 이 아닌 곳에서도 안 죽는다
    const 맨밭 = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-watch-nogit-'));
    let 죽었나 = false;
    try {
      execFileSync(process.execPath, [__filename, '--재기'], {
        encoding: 'utf8', input: '{}',
        env: { ...process.env, CLAUDE_PROJECT_DIR: 맨밭 }, windowsHide: true,
      });
    } catch { 죽었나 = true; }
    잰다('git 밖에서도 종료코드 0', !죽었나);
    try { fs.rmSync(맨밭, { recursive: true, force: true }); } catch {}
  } finally {
    process.env.CLAUDE_PROJECT_DIR = 원래뿌리;
    try { fs.rmSync(밭, { recursive: true, force: true }); } catch {}
  }

  console.log(실패 ? `\n🔴 ${실패}건 실패` : '\n✅ 전부 통과');
  process.exit(실패 ? 1 : 0);
}

// ══════════════════════════════════════════════════════════ 실행

const 플래그 = process.argv[2] || '';

if (플래그 === '--자가시험') {
  자가시험();
} else {
  try {
    const 입력 = 입력읽기();
    if (플래그 === '--찍기') 찍기(입력);
    else if (플래그 === '--재기') 재기(입력);
  } catch {
    /* 이 자리는 «막는 자»가 아니다. 죽으면 유호님 턴이 통째로 멈추므로 조용히 지나간다. */
  }
  process.exit(0);
}
