#!/usr/bin/env node
'use strict';
/**
 * 세션고르기 — /이어서 스킬이 「이어서 해」를 보낼 Code 탭 세션을 고른다 (2026-10-20).
 *
 * 왜 있나: 계정 전환·사용량 한도 초기화·앱 재시작 뒤에는 일하던 세션이 한꺼번에 멈추고, 「다시 시도」 단추는
 * 계정이 바뀐 뒤 듣지 않는다(10-16~20 대화 원문: 한도 끊김 359번, 뒤이은 글 「이어서 해」 111번·「다시 시도」 82번).
 * 세션마다 치던 「이어서 해」를 한 번에 보내되, 유호님 승인·고르기를 기다리는 세션과 일부러 멈춘 세션은 가른다.
 *
 * 읽기만 한다(쓰기 없음):
 *   - 앱 세션 기록  <앱 데이터>/claude-code-sessions/<계정>/<조직>/local_*.json
 *                   (lastTurnCutShort·error·errorAt·postTurnSummary·turnWrapUp·spawnedFrom·interruptedByQuitAt)
 *   - 대화 원문 끝  <CLAUDE_CONFIG_DIR 또는 ~/.claude>/projects/<폴더>/<cliSessionId>.jsonl (끝에서 1~32MB)
 *   - 앱 로그       main.log·main1.log…(10MB마다 돌려 씀) — 마지막 로그인 줄로 지금 계정 폴더를 고르고,
 *                   세션마다 마지막 멈춤 사건(화면 Stop·컴퓨터 사용 Esc·다른 세션·앱 종료)을 읽는다.
 * 지금 일하는 중인지는 기록에 남지 않아서, 스킬이 list_sessions의 isRunning을 --busy로 넘긴다.
 *
 *   node 세션고르기.cjs --self <local_…> --busy <id,id,…> [--전부]
 *   node 세션고르기.cjs … --기록 <계정/조직 폴더> --원문 <projects 폴더> --로그 <logs 폴더> --지금 <ISO 시각>   (시험·점검용)
 *
 * 판정 순서(위가 먼저): 일하는중 → 유호님차례 → (막 움직임)일하는중 → 끊긴 세션 보냄 → 직접멈춤 → 방금끝남 → 보관 → 오래쉼 → 보냄.
 * 승인 대기를 끊김보다 먼저 본다. 앱은 새 차례를 시작할 때 요약·마무리 상자를 지우므로(app.asar Zk→Yk)
 * 기록에 남은 대기 신호는 늘 마지막 차례의 것이다.
 *
 * 기대는 앱 동작(2026-10-20 Claude 데스크톱 2.42304.2.0·Claude Code 2.1.299에서 확인, 바뀌면 판정도 다시 본다):
 *   - lastTurnCutShort는 사람·다른 세션이 멈출 때와, 일하던 세션이 앱 종료로 멈출 때 켜지고 차례가 잘 끝나야 꺼진다.
 *     이 값을 켜는 app.asar tr()은 원격 기능 표지(oE) 뒤에 있다 — 표지가 꺼지면 Stop을 앱 기록으로는 못 가른다.
 *   - 계정 폴더 여러 곳을 미러가 같게 맞추므로 --self가 그 폴더에 있다는 것만으로는 지금 계정이라는 증거가 못 된다.
 *     그래서 앱 로그의 로그인 줄로 고르고, 못 찾으면 바로 보관을 끈다.
 *   - 대기 신호는 마지막 차례의 요약 기준이다. 앞 차례에서 유호님께 고르기를 청했어도 뒤 차례(곁 세션 알림 등)가
 *     그 말을 되풀이하지 않으면 신호가 사라진다 — 그때는 받는 세션이 보낼 글 1번으로 스스로 멈춘다(10-20 Fable).
 *
 * 출력은 JSON 한 덩어리다. 칸:
 *   보냄        끊긴 세션(한도·오류·앱 재시작)과 끝난 채 쉬는 세션 — 받으면 이어 가거나, 할 일이 없으면 스스로 보관한다
 *   보관        예약 실행이 「완료」로 끝났고 걸린 것이 없는 세션 — 깨우지 않고 스킬이 바로 보관한다.
 *               대화형 세션·워크트리 세션·곁 세션이 있는 세션은 넣지 않는다(보관하면 워크트리가 지워지고 끝난 곁 세션도
 *               같이 보관된다). 기록 일부를 못 읽었거나 지금 계정을 로그로 확인하지 못했으면 이 칸을 비우고 보냄으로 돌린다.
 *   일하는중    --busy에 든 세션, /loop 깨우기가 걸린 세션, 원문이 90초 안에 차례 한가운데로 쓰인 세션
 *   유호님차례  유호님 지시를 기다린다는 신호(마무리 상자 needsUser, 요약 blocked·need_input, needs_action)가 있다 —
 *               승인·최종 업로드 검토·고르기 대기. 끊겼어도, --전부여도 보내지 않는다
 *   직접멈춤    마지막 차례를 Stop·Esc·다른 세션이 멈췄거나, 앱 표식은 멈춤인데 원문·로그로 까닭을 가를 수 없거나,
 *               앱 종료 때 권한·대화 상자를 기다리던 세션 — --전부면 보냄
 *   곁세션대기  끊기지 않았고, 이 세션이 띄운 세션이 일하는 중·이번에 깨울 대상·유호님 차례 — 곁 세션이 끝나면 앱이 깨운다
 *   방금끝남    끊김 없이 10분 안에 끝났다 — 유호님과 대화 중일 수 있어 건드리지 않는다
 *   오래쉼      마지막 활동이 7일보다 오래됐다 — --전부면 보냄
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const 분 = 60 * 1000;
const 일 = 24 * 60 * 분;
const 오래기준 = 7 * 일;
const 방금기준 = 10 * 분;
/* 목록(isRunning)을 읽은 뒤 몇 초 사이에 차례가 시작되기도 한다. 앱을 껐다 켜는 데만 1분이 넘게 걸리므로
 * 이보다 최근에 쓰인 「차례 한가운데」 원문은 죽은 차례가 아니라 지금 도는 차례로 본다.
 * 재시작한 CLI가 남기는 보정 줄(No response requested.)은 끝난 차례가 분명하므로 이 규칙에서 뺀다. */
const 막움직임기준 = 90 * 1000;
/* 앱도 7일 안의 오류만 「실패」로 띄운다(app.asar Qt). 그보다 오래된 error 칸은 판정에 쓰지 않는다. */
const 오류유효 = 7 * 일;
const 한도문구 = /hit your (?:\w+ )?limit|usage limit|limit reached|rate[ _-]?limit/i;
const 멈춤문구 = '[Request interrupted by user';
const 재시작문구 = 'the session ended before this call';
const 답없음문구 = /^No response requested\.?$/;
/* 원문 끝에서 메시지 줄을 찾을 때까지 읽는 범위를 늘린다. 끝까지 못 찾으면 「모름」. */
const 읽기단계 = [1, 4, 16, 32].map((mb) => mb * 1024 * 1024);
const 로그최대 = 32 * 1024 * 1024;
const 기다림상태 = new Set(['blocked', 'need_input']);

/* ── 작은 도구 ─────────────────────────────────────────────────────────── */

function 목록(폴더) {
  try {
    return fs.readdirSync(폴더);
  } catch {
    return [];
  }
}

function 폴더인가(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function 바뀐시각(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function 짧게(글, 길이 = 160) {
  const s = String(글 ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 길이 ? `${s.slice(0, 길이 - 1)}…` : s;
}

function 아이디(값) {
  const s = String(값 || '').trim();
  if (!s) return '';
  return s.startsWith('local_') ? s : `local_${s}`;
}

/** --busy에 준 값(전체 id 또는 local_ 뺀 8자 이상 앞부분)으로 맞추는 함수. 판정과 알림이 같은 것을 쓴다. */
function 일하나판(busy) {
  const 목록값 = [...(busy || [])].map(아이디).filter((b) => b.length >= 'local_'.length + 8);
  const 맞나 = (id) => 목록값.some((b) => id === b || id.startsWith(b));
  return { 목록: 목록값, 맞나 };
}

/** spawnedFrom은 기록마다 객체이기도, JSON 글이기도 하다. */
function 부모(기록) {
  let s = 기록.spawnedFrom;
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch {
      return null;
    }
  }
  return s && typeof s.sessionId === 'string' ? s.sessionId : null;
}

function 워크트리인가(기록) {
  return Boolean(기록.worktreePath || 기록.worktreeName || /[\\/]\.claude[\\/]worktrees[\\/]/.test(기록.cwd || ''));
}

function 잠깐(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/* ── 앱 데이터·지금 계정 찾기 ──────────────────────────────────────────── */

/** claude-code-sessions 폴더 후보. Windows 스토어 앱은 데이터를 Claude-Data로 옮기기도 한다(10-19 user-data-move). */
function 세션뿌리후보(env = process.env) {
  const 후보 = [];
  const local = env.LOCALAPPDATA;
  if (local) {
    const 옮긴곳 = path.join(local, 'Claude-Data');
    for (const d of 목록(옮긴곳)) 후보.push(path.join(옮긴곳, d, 'claude-code-sessions'));
    const 꾸러미 = path.join(local, 'Packages');
    for (const d of 목록(꾸러미)) {
      if (/^Claude_/i.test(d)) 후보.push(path.join(꾸러미, d, 'LocalCache', 'Roaming', 'Claude', 'claude-code-sessions'));
    }
  }
  if (env.APPDATA) 후보.push(path.join(env.APPDATA, 'Claude', 'claude-code-sessions'));
  const 집 = env.HOME || env.USERPROFILE;
  if (집) 후보.push(path.join(집, 'Library', 'Application Support', 'Claude', 'claude-code-sessions'));
  return [...new Set(후보)].filter(폴더인가);
}

/** 앱 로그 폴더 후보의 main*.log 전부(돌려 쓴 main1.log… 포함). */
function 로그후보(env = process.env) {
  const 폴더들 = [];
  const local = env.LOCALAPPDATA;
  if (local) {
    폴더들.push(path.join(local, 'Claude', 'logs'));
    const 옮긴곳 = path.join(local, 'Claude-Data');
    for (const d of 목록(옮긴곳)) 폴더들.push(path.join(옮긴곳, d, 'logs'));
    const 꾸러미 = path.join(local, 'Packages');
    for (const d of 목록(꾸러미)) {
      if (!/^Claude_/i.test(d)) continue;
      폴더들.push(path.join(꾸러미, d, 'LocalCache', 'Roaming', 'Claude', 'logs'));
      폴더들.push(path.join(꾸러미, d, 'LocalCache', 'Local', 'Claude', 'logs'));
    }
  }
  if (env.APPDATA) 폴더들.push(path.join(env.APPDATA, 'Claude', 'logs'));
  const 집 = env.HOME || env.USERPROFILE;
  if (집) 폴더들.push(path.join(집, 'Library', 'Logs', 'Claude'));
  const 파일들 = [];
  for (const 폴더 of new Set(폴더들)) {
    for (const f of 목록(폴더)) if (/^main\d*\.log$/i.test(f)) 파일들.push(path.join(폴더, f));
  }
  return 파일들.filter((p) => 바뀐시각(p) > 0);
}

/** 파일 끝 바이트를 글로 읽는다. 잘린 첫 줄은 버린다. */
function 끝읽기(파일, 바이트) {
  const 크기 = fs.statSync(파일).size;
  const 길이 = Math.min(크기, 바이트);
  const 버퍼 = Buffer.alloc(길이);
  const fd = fs.openSync(파일, 'r');
  try {
    fs.readSync(fd, 버퍼, 0, 길이, 크기 - 길이);
  } finally {
    fs.closeSync(fd);
  }
  const 글 = 버퍼.toString('utf8');
  if (길이 >= 크기) return { 글, 처음까지: true };
  const 줄바꿈 = 글.indexOf('\n');
  return { 글: 줄바꿈 < 0 ? '' : 글.slice(줄바꿈 + 1), 처음까지: false };
}

/** 로그 줄 앞 시각(앱이 이 PC 시간대로 적는다, 「2026-10-20 19:22:00」) → ms. 시간대를 못박지 않고 PC 시간대로 읽는다. */
function 로그시각(글) {
  return Date.parse(글.replace(' ', 'T')) || 0;
}

/**
 * 앱 로그(main.log·돌려 쓴 main1.log…)를 한 번 읽어 두 가지를 뽑는다.
 *   로그인 — 로그인 줄 가운데 시각이 가장 늦은 것 { 계정, 조직, 시각, 시각ms }. 파일 순서가 아니라 줄 앞 시각으로 고른다.
 *   멈춤들 — 세션마다 { 의도: { 원인, 시각 }, 종료: { 시각 } } — 마지막 의도한 멈춤과 마지막 앱 종료를 따로 둔다.
 *     앱 종료 때는 쉬던 세션에도 「Stopping session」이 찍히므로, 하나로 합치면 Stop 뒤에 앱을 껐을 때 Stop을 잃는다.
 *     의도.원인:
 *       'Stop'      화면의 Stop(「LocalSessions.interrupt: sessionId=…」)
 *       'Esc'       컴퓨터 사용 중 Esc(「[cu-esc] escape pressed, stopping …」)
 *       '다른 세션' 「Interrupting session …」만 있고 화면 Stop이 없음(stop_session 등)
 *     종료: 종료 정리·로그아웃 5초 안의 「Stopping session …」 — 일하던 세션은 이때도 lastTurnCutShort가 켜진다.
 *   차례 중간에 글을 보내는 것은 이 줄들을 남기지 않는다(10-20 이 세션 실측). 10-16~20 로그: 앱 종료 534·Esc 7·Stop 14.
 */
function 로그읽기(로그파일들) {
  const 로그인꼴 = /\[LocalSessionManager\] Initialization succeeded\W+accountId=([0-9a-f-]{36}), orgId=([0-9a-f-]{36})/;
  const 사건꼴 = [
    [/^LocalSessions\.interrupt: sessionId=(local_[0-9a-f-]+)/, 'Stop'],
    [/^\[cu-esc\] escape pressed, stopping (local_[0-9a-f-]+)/, 'Esc'],
    [/^Interrupting session (local_[0-9a-f-]+)/, '다른 세션'],
    [/^Stopping session (local_[0-9a-f-]+)/, '멈춤'],
  ];
  let 로그인 = null;
  const 멈춤들 = new Map();
  for (const 파일 of 로그파일들) {
    let 줄들;
    try {
      줄들 = 끝읽기(파일, 로그최대).글.split(/\r?\n/);
    } catch {
      continue;
    }
    let 종료시각 = -Infinity; // 마지막 종료 정리·로그아웃 줄
    const 같은때 = new Map(); // id → 5초 안의 Stop·Esc 사건(「Interrupting」「Stopping」이 그 뒤에 붙어 찍힌다)
    for (const 줄 of 줄들) {
      const m = 줄.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[\w+\] (.*)$/);
      if (!m) continue;
      const 시각 = 로그시각(m[1]);
      const 글 = m[2];
      const 로그인줄 = 글.match(로그인꼴);
      if (로그인줄 && (!로그인 || 시각 >= 로그인.시각ms)) 로그인 = { 계정: 로그인줄[1], 조직: 로그인줄[2], 시각: m[1], 시각ms: 시각 };
      if (/beforeQuit|onQuitCleanup|Quitting app|Account logged out/.test(글)) 종료시각 = 시각;
      for (const [꼴, 종류] of 사건꼴) {
        const s = 글.match(꼴);
        if (!s) continue;
        const id = s[1];
        const 앞 = 같은때.get(id);
        const 칸 = 멈춤들.get(id) || {};
        if (종류 === 'Stop' || 종류 === 'Esc') {
          같은때.set(id, { 원인: 종류, 시각 });
          if (!칸.의도 || 시각 >= 칸.의도.시각) 칸.의도 = { 원인: 종류, 시각 };
        } else if (앞 && 시각 - 앞.시각 <= 5000) {
          /* Stop·Esc 바로 뒤에 붙어 찍히는 「Interrupting」「Stopping」 — 같은 사건이다. */
        } else if (종류 === '다른 세션') {
          if (!칸.의도 || 시각 >= 칸.의도.시각) 칸.의도 = { 원인: '다른 세션', 시각 };
        } else if (시각 - 종료시각 <= 5000) {
          if (!칸.종료 || 시각 >= 칸.종료.시각) 칸.종료 = { 시각 };
        }
        멈춤들.set(id, 칸);
        break;
      }
    }
  }
  return { 로그인, 멈춤들 };
}

/** 앱 로그들의 마지막 로그인 → { 계정, 조직, 시각 } (없으면 null). */
function 마지막로그인(로그파일들) {
  const { 로그인 } = 로그읽기(로그파일들);
  return 로그인 ? { 계정: 로그인.계정, 조직: 로그인.조직, 시각: 로그인.시각 } : null;
}

/**
 * 지금 로그인한 계정의 세션 기록 폴더(<뿌리>/<계정>/<조직>).
 * 로그인 줄이 가리키는 폴더가 없으면, local_*.json이 든 가장 최근에 바뀐 <계정>/<조직> 폴더를 쓰고 확실하지 않다고 표시한다.
 * 로그를 이미 읽었으면 로그인을 넘겨 다시 읽지 않는다.
 */
function 지금계정폴더({ 뿌리들, 로그들, 로그인: 읽은로그인 }) {
  const 로그인 = 읽은로그인 !== undefined ? 읽은로그인 : 마지막로그인(로그들 || []);
  if (로그인) {
    const 맞는곳 = 뿌리들
      .map((r) => path.join(r, 로그인.계정, 로그인.조직))
      .filter(폴더인가)
      .sort((a, b) => 바뀐시각(b) - 바뀐시각(a));
    if (맞는곳.length) return { 폴더: 맞는곳[0], 근거: `앱 로그의 마지막 로그인(${로그인.시각})`, 확실: true };
  }
  let 최선 = null;
  for (const 뿌리 of 뿌리들) {
    for (const 계정 of 목록(뿌리)) {
      const 계정폴더 = path.join(뿌리, 계정);
      if (!폴더인가(계정폴더)) continue;
      for (const 조직 of 목록(계정폴더)) {
        const p = path.join(계정폴더, 조직);
        if (!폴더인가(p) || !목록(p).some((f) => /^local_.*\.json$/i.test(f))) continue;
        const t = 바뀐시각(p);
        if (!최선 || t > 최선.t) 최선 = { p, t };
      }
    }
  }
  return 최선 ? { 폴더: 최선.p, 근거: '가장 최근에 바뀐 계정 폴더(앱 로그에서 로그인 줄을 못 찾음)', 확실: false } : null;
}

/* ── 기록 읽기 ─────────────────────────────────────────────────────────── */

function 기록한개(파일) {
  const 글 = fs.readFileSync(파일, 'utf8');
  if (/"isArchived"\s*:\s*true/.test(글)) return { 보관됨: true };
  const j = JSON.parse(글);
  if (!j || typeof j.sessionId !== 'string') throw new Error('sessionId 없음');
  return { 기록: j };
}

/**
 * 보관되지 않은 세션 기록만 읽는다. 보관된 것은 파싱 전에 거른다(기록 하나가 100KB를 넘기도 한다).
 * 앱·미러가 쓰는 중인 파일은 깨져 보일 수 있어 한 번 더 읽는다. 그래도 깨진 수는 「깨짐」으로 돌려준다 —
 * 곁 세션 관계가 빠졌을 수 있으니 부르는 쪽은 바로 보관을 하지 않는다.
 */
function 기록읽기(폴더) {
  const 기록들 = [];
  const 실패 = [];
  for (const f of 목록(폴더)) {
    if (!/^local_[0-9a-f-]+\.json$/i.test(f)) continue;
    try {
      const r = 기록한개(path.join(폴더, f));
      if (r.기록 && !r.기록.isArchived) 기록들.push(r.기록);
    } catch {
      실패.push(f);
    }
  }
  let 깨짐 = 0;
  if (실패.length) 잠깐(300);
  for (const f of 실패) {
    try {
      const r = 기록한개(path.join(폴더, f));
      if (r.기록 && !r.기록.isArchived) 기록들.push(r.기록);
    } catch {
      깨짐++;
    }
  }
  return { 기록들, 깨짐 };
}

/** cwd로 Claude Code가 만드는 projects 폴더 이름(영숫자 밖은 모두 '-'). */
function 원문폴더이름(cwd) {
  return String(cwd || '').replace(/[^A-Za-z0-9]/g, '-');
}

function 원문찾기(원문뿌리, 기록) {
  const cli = 기록.cliSessionId;
  if (!cli || !/^[0-9a-f-]{36}$/i.test(cli)) return null;
  const 이름 = `${cli}.jsonl`;
  for (const cwd of [기록.cwd, 기록.originCwd]) {
    if (!cwd) continue;
    const p = path.join(원문뿌리, 원문폴더이름(cwd), 이름);
    if (바뀐시각(p) > 0) return p;
  }
  for (const d of 목록(원문뿌리)) {
    const p = path.join(원문뿌리, d, 이름);
    if (바뀐시각(p) > 0) return p;
  }
  return null;
}

/** 원문 끝의 메시지 줄(user·assistant)만 시간순으로. 메타·첨부·제목 줄은 뺀다. */
function 원문끝메시지(파일, 필요 = 6, 단계 = 읽기단계) {
  let 메시지 = [];
  for (const 바이트 of 단계) {
    const { 글, 처음까지 } = 끝읽기(파일, 바이트);
    메시지 = [];
    for (const 줄 of 글.split('\n')) {
      if (!줄 || (!줄.includes('"type":"user"') && !줄.includes('"type":"assistant"'))) continue;
      let j;
      try {
        j = JSON.parse(줄);
      } catch {
        continue;
      }
      if ((j.type !== 'user' && j.type !== 'assistant') || !j.message || j.isMeta) continue;
      메시지.push(j);
    }
    if (메시지.length >= 필요 || 처음까지) break;
  }
  return 메시지;
}

function 블록들(항목) {
  const c = 항목.message && 항목.message.content;
  if (Array.isArray(c)) return c;
  return [{ type: 'text', text: typeof c === 'string' ? c : '' }];
}

function 글만(항목) {
  return 블록들(항목)
    .map((b) => {
      if (b.type === 'text') return b.text || '';
      if (b.type === 'tool_result') {
        const r = b.content;
        if (typeof r === 'string') return r;
        if (Array.isArray(r)) return r.map((x) => (x && x.type === 'text' ? x.text : '')).join(' ');
      }
      return '';
    })
    .join(' ');
}

/** 보정 줄(다시 뜬 CLI가 나중에 쓴 줄)을 건너뛴, 실제로 끊긴 때의 마지막 메시지 시각. */
function 보정앞시각(메시지) {
  for (let i = 메시지.length - 1; i >= 0; i--) {
    const 글 = 글만(메시지[i]).trim();
    if (답없음문구.test(글) || 글.includes(재시작문구)) continue;
    return Date.parse(메시지[i].timestamp) || 0;
  }
  return 0;
}

/**
 * 원문 끝으로 마지막 차례가 어떻게 끝났는지 본다.
 *   한도·오류 — API 오류 메시지로 끝남
 *   재시작 — 도구 호출 중에 프로세스가 끝남(앱 재시작·계정 전환). 보정: true면 다시 뜬 CLI가 남긴 보정 줄로 끝남(끝난 차례가 분명)
 *   멈춤 — Stop 줄로 끝남 / 답없음 — 받은 글에 답하지 못하고 끝남 / 끝남 — 보통 끝 / 모름 — 메시지 줄을 못 찾음
 */
function 끝판정(메시지) {
  const 끝 = 메시지[메시지.length - 1];
  if (!끝) return { 종류: '모름' };
  const 시각 = Date.parse(끝.timestamp) || 0;
  const 판 = (종류, 덧) => ({ 종류, 시각, ...덧 });
  const 글 = 글만(끝);
  const 도구결과 = 블록들(끝).some((b) => b.type === 'tool_result');
  if (끝.type === 'assistant') {
    if (끝.isApiErrorMessage) return 판(한도문구.test(글) ? '한도' : '오류', { 글: 짧게(글, 120) });
    if (답없음문구.test(글.trim())) {
      /* 재시작한 CLI는 걸려 있던 도구 호출을 「끝났다」로 메우고 「No response requested.」를 붙인다. */
      const 앞 = 메시지[메시지.length - 2];
      const 앞글 = 앞 ? 글만(앞) : '';
      return 앞글.includes(멈춤문구) ? 판('멈춤') : 판('재시작', { 보정: true, 앞시각: 보정앞시각(메시지) });
    }
    if (블록들(끝).some((b) => b.type === 'tool_use')) return 판('재시작');
    return 판('끝남');
  }
  /* 「[Request interrupted by user」는 Stop 말고도 차례 중간에 글을 보낼 때 찍힌다. 그 뒤에 아무것도 없을 때만 멈춤이다. */
  if (글.includes(멈춤문구)) return 판('멈춤');
  if (글.includes(재시작문구)) return 판('재시작', { 보정: true, 앞시각: 보정앞시각(메시지) });
  if (도구결과) return 판('재시작');
  return 판('답없음', { 글: 짧게(글, 80) });
}

/* ── 판정 ─────────────────────────────────────────────────────────────── */

/**
 * 세션 상태.
 *   대기 — 유호님 지시를 기다린다는 신호가 하나라도 있다: 마무리 상자 needsUser, 요약 blocked·need_input, 요약 needs_action.
 *          앱 사이드바는 마무리 상자가 있으면 blocked를 review_ready로 낮추지만(app.asar qB), 보낼지·보관할지는 보수적으로 본다.
 *   기다림 — 유호님이 할 일(needsUser·needs_action), 설명 — 요약의 상태 설명(status_detail).
 */
function 상태(기록) {
  const 요약 = 기록.postTurnSummary || {};
  const 마무리 = 기록.turnWrapUp;
  const 설명 = 짧게(요약.status_detail || (마무리 && 마무리.description) || '');
  const 할일 = 짧게((마무리 && 마무리.needsUser) || 요약.needs_action || '');
  const 대기 = Boolean((마무리 && 마무리.needsUser !== undefined) || 기다림상태.has(요약.status_category) || 할일);
  return { 상태: 요약.status_category, 대기, 기다림: 할일, 설명 };
}

/**
 * 마지막 차례가 끊겼는지 — 앱 기록과 원문 끝을 함께 본다. 끊기지 않았으면 null.
 *   - 앱은 새 차례가 시작될 때 error를 지운다(app.asar Zk). 원문이 오류 뒤에 보통 끝났거나 더 늦은 Stop이 있으면 지난 오류로 본다.
 *   - Stop은 원문 끝 멈춤 줄 + 앱의 lastTurnCutShort(사람·다른 세션이 멈출 때만 적힘)가 함께일 때만. 표식 없는 멈춤 줄은
 *     앱이 스스로 끊은 것으로 보고 재시작과 같이 깨운다.
 *   - 앱 로그(로그멈춤)가 원문 마지막 메시지 뒤에 일어난 멈춤의 원인을 알려 주면 그것을 따른다.
 *     Stop·Esc·다른 세션의 멈춤이면 멈춤(원문에 멈춤 줄이 없어도 — Esc·Stop 4/4가 줄을 안 남겼다, 10-20 Fable 실측).
 *     앱 종료면 재시작(일하던 세션은 종료 때도 lastTurnCutShort가 켜지고 멈춤 줄이 찍히기도 한다).
 *   - 로그로 원인을 모르는데 lastTurnCutShort가 켜져 있으면 「불명」 — Stop일 수 있어 기본으로는 깨우지 않는다.
 *     앱도 !isRunning && lastTurnCutShort를 「사람이 멈춤」으로 보고 곁 세션 쪽지로 깨우지 않는다(app.asar wakeWaitsForPerson).
 *   - 표식 없이 원문 끝에만 멈춤 줄이 있으면 앱이 스스로 끊은 것으로 보고 재시작과 같이 깨운다.
 *   - 앱 종료 표식(interruptedByQuitAt)이 있어도 그때 권한·대화 상자를 기다리던 세션(interruptedAwaitingPerson)은
 *     앱도 사람이 열 때까지 두므로 깨우지 않는다.
 */
function 끊김(기록, 끝, 지금, 로그멈춤) {
  const 오류시각 = Number(기록.errorAt) || 0;
  const 표식 = 기록.lastTurnCutShort === true;
  const 기준시각 = 끝 ? (끝.보정 ? 끝.앞시각 : 끝.시각) || 0 : 0;
  /* 원문 마지막 메시지(보정 줄 앞) 뒤에 일어난 로그 사건만 이 차례의 원인이다. */
  const 이차례 = (사건) => Boolean(사건 && (!기준시각 || 사건.시각 >= 기준시각 - 분));
  const 의도 = 로그멈춤 && 이차례(로그멈춤.의도) ? 로그멈춤.의도 : null;
  /* 멈추고 바로 새 글을 보내 그 차례가 잘 끝났으면 앱이 표식을 끈다 — 그래서 의도한 멈춤은 표식이 켜져 있을 때만 본다. */
  const 의도멈춤 = Boolean(표식 && 의도);
  /* 원문 끝이 멈춤 줄이면 그 줄이 앱 종료 때 찍혔을 때(1분 안)만 종료 탓이다. 한참 앞선 멈춤 줄은 사람이 멈춘 것이다. */
  const 종료 = 로그멈춤 && 이차례(로그멈춤.종료) ? 로그멈춤.종료 : null;
  const 종료로끊김 = Boolean(종료 && (!끝 || 끝.종류 !== '멈춤' || Math.abs(종료.시각 - 끝.시각) <= 분));
  const 오류뒤에끝남 = 끝 && 끝.종류 === '끝남' && 끝.시각 > 오류시각 + 분;
  const 오류뒤에멈춤 = (의도멈춤 && 의도.시각 > 오류시각) || (!종료로끊김 && 끝 && 끝.종류 === '멈춤' && 표식 && 끝.시각 > 오류시각);
  if (기록.error && 오류시각 && 지금 - 오류시각 < 오류유효 && !오류뒤에끝남 && !오류뒤에멈춤) {
    return { 종류: 한도문구.test(String(기록.error)) ? '한도' : '오류', 글: 짧게(기록.error, 120) };
  }
  if (끝 && (끝.종류 === '한도' || 끝.종류 === '오류')) return 끝;
  if (의도멈춤) return { 종류: '멈춤', 원인: 의도.원인, 시각: 의도.시각 };
  if (기록.interruptedByQuitAt !== undefined && 기록.interruptedByQuitAt !== null) {
    return 기록.interruptedAwaitingPerson === true ? { 종류: '멈춤', 원인: '종료 때 권한·대화 상자 대기' } : { 종류: '재시작', 확정: true };
  }
  const 차례중간 = 끝 && (끝.종류 === '멈춤' || 끝.종류 === '재시작' || 끝.종류 === '답없음');
  if (종료로끊김 && (표식 || 차례중간)) return { ...(끝 || {}), 종류: '재시작', 확정: true };
  if (표식) return 끝 && 끝.종류 === '멈춤' ? 끝 : { 종류: '불명' };
  if (끝 && 끝.종류 === '멈춤') return { ...끝, 종류: '재시작' };
  if (끝 && (끝.종류 === '재시작' || 끝.종류 === '답없음')) return 끝;
  if (기록.postTurnSummary && 기록.postTurnSummary.status_category === 'failed') {
    return { 종류: '오류', 글: 짧게(기록.postTurnSummary.needs_action || 기록.postTurnSummary.status_detail || '') };
  }
  return null;
}

const 이유문구 = {
  한도: '사용량 한도로 끊김',
  오류: '오류로 끊김',
  재시작: '앱 재시작·계정 전환으로 끊김',
  답없음: '받은 글에 답하지 못하고 멈춤',
};
const 멈춘까닭문구 = {
  Stop: 'Stop으로 멈춤',
  Esc: 'Esc로 멈춤(컴퓨터 사용)',
  '다른 세션': '다른 세션이 멈춤',
  '종료 때 권한·대화 상자 대기': '앱 종료 때 권한·대화 상자를 기다리던 세션',
};

function 날짜(ms) {
  if (!ms) return '';
  const d = new Date(ms + 9 * 60 * 분); // KST 표시
  return d.toISOString().slice(5, 16).replace('T', ' ');
}

/**
 * 세션마다 칸을 정한다.
 * @param {object[]} 기록들 보관되지 않은 세션 기록
 * @param {Map<string,{종류:string,시각?:number,보정?:boolean,글?:string}>} 끝들 sessionId → 원문 끝판정(원문을 못 찾으면 없음)
 * @param {{self:string, busy:Iterable<string>, 전부?:boolean, 지금?:number, 바로보관?:boolean, 바로보관막힘?:string}} 옵션
 *   busy는 list_sessions의 isRunning 세션(전체 id 또는 local_ 뺀 8자 이상 앞부분).
 *   바로보관이 false면(기록 일부를 못 읽음·계정 불확실) 보관 칸을 비우고 그 세션은 깨워서 스스로 정하게 한다.
 */
function 나누기(기록들, 끝들, 옵션) {
  const self = 아이디(옵션.self);
  const { 맞나: 일하나 } = 일하나판(옵션.busy);
  const 전부 = Boolean(옵션.전부);
  const 지금 = 옵션.지금 ?? Date.now();
  const 바로보관 = 옵션.바로보관 !== false;
  const 대상 = 기록들.filter((r) => !r.isArchived && r.sessionId !== self);

  /* 곁 세션 관계(spawnedFrom). 보관하면 앱이 끝난 곁 세션까지 같이 보관하므로 바로 보관할 때도 쓴다. */
  const 자식들 = new Map();
  for (const r of 대상) {
    const p = 부모(r);
    if (!p || p === r.sessionId) continue;
    if (!자식들.has(p)) 자식들.set(p, []);
    자식들.get(p).push(r.sessionId);
  }

  const 판정 = new Map();
  for (const r of 대상) {
    const id = r.sessionId;
    const 마지막활동 = Number(r.lastActivityAt) || 0;
    const 기본 = { id, 제목: r.title || '(제목 없음)', 마지막: 날짜(마지막활동) };
    if (워크트리인가(r)) 기본.워크트리 = true;
    const 오래됨 = 지금 - 마지막활동 > 오래기준;
    if (일하나(id)) {
      판정.set(id, { ...기본, 칸: '일하는중' });
      continue;
    }
    /* /loop가 걸어 둔 다음 깨우기가 있으면 앱이 그때 깨운다. */
    if (r.pendingLoopWakeup !== undefined && r.pendingLoopWakeup !== null) {
      판정.set(id, { ...기본, 칸: '일하는중', 이유: '예약된 깨우기 대기' });
      continue;
    }
    const 끝 = 끝들.get(id);
    const k = 끊김(r, 끝, 지금, 옵션.멈춤들 && 옵션.멈춤들.get(id));
    const s = 상태(r);
    /* 승인·최종 업로드 검토·고르기 대기는 끊김보다 먼저 지킨다. 「이어서 해」를 승인으로 오해할 틈을 아예 주지 않는다. */
    if (s.대기) {
      const 덧 = k && k.종류 !== '멈춤' && k.종류 !== '불명' ? { 이유: `그 뒤 ${이유문구[k.종류]}` } : {};
      판정.set(id, { ...기본, 칸: '유호님차례', 기다림: s.기다림 || s.설명 || '(앱 요약에 적힌 내용 없음)', ...덧 });
      continue;
    }
    /* 원문 끝이 차례 한가운데 모양인데 마지막 줄이 막 쓰였으면, 목록을 읽은 사이에 차례가 시작된 것이다.
     * 보정 줄(다시 뜬 CLI)·앱 종료로 끊긴 것이 분명한 경우는 빼다. */
    const 한가운데 = k && (k.종류 === '재시작' || k.종류 === '답없음') && !k.보정 && !k.확정 && k.시각 && 지금 - k.시각 < 막움직임기준;
    if (한가운데) {
      판정.set(id, { ...기본, 칸: '일하는중', 이유: '막 움직이는 중(원문 기준)' });
      continue;
    }
    if (k && k.종류 !== '멈춤' && k.종류 !== '불명') {
      if (오래됨 && !전부) 판정.set(id, { ...기본, 칸: '오래쉼', 이유: 이유문구[k.종류] });
      else 판정.set(id, { ...기본, 칸: '보냄', 이유: 이유문구[k.종류], ...(k.글 ? { 근거: k.글 } : {}), 끊김: true });
      continue;
    }
    if (k && (k.종류 === '멈춤' || k.종류 === '불명')) {
      const 멈춘까닭 = 멈춘까닭문구[k.원인] || (k.종류 === '불명' ? '앱 표식은 멈춤인데 원문·로그로 까닭을 못 가름' : 'Stop으로 멈춤');
      if (전부) 판정.set(id, { ...기본, 칸: '보냄', 이유: `${멈춘까닭}(--전부)`, 끊김: true });
      else 판정.set(id, { ...기본, 칸: '직접멈춤', 이유: 멈춘까닭 });
      continue;
    }
    if (지금 - 마지막활동 < 방금기준) {
      판정.set(id, { ...기본, 칸: '방금끝남' });
      continue;
    }
    /* 예약 실행이 「완료」로 끝났고 걸린 것이 없으면 깨우지 않고 바로 보관한다(깨우면 사용량만 든다).
     * 대화형 세션은 분류기의 완료가 마지막 차례 기준일 뿐이라 깨워서 스스로 정하게 한다(10-20 Fable F4).
     * 워크트리 세션은 보관하면 워크트리가 지워지고, 곁 세션이 있으면 같이 보관되므로 역시 깨운다. */
    const 쪽지남음 = Array.isArray(r.queuedSideSessionNotes) && r.queuedSideSessionNotes.length > 0;
    if (s.상태 === 'completed' && r.scheduledTaskId && !자식들.has(id) && !쪽지남음 && !기본.워크트리) {
      if (바로보관) {
        판정.set(id, { ...기본, 칸: '보관', 이유: '예약 실행이 완료로 끝남' });
      } else {
        판정.set(id, { ...기본, 칸: '보냄', 이유: `완료로 보이지만 ${옵션.바로보관막힘 || '바로 보관을 끔'} — 스스로 확인하고 보관` });
      }
      continue;
    }
    if (오래됨) {
      판정.set(id, 전부 ? { ...기본, 칸: '보냄', 이유: '오래 쉬던 세션(--전부)' } : { ...기본, 칸: '오래쉼' });
      continue;
    }
    판정.set(id, { ...기본, 칸: '보냄', 이유: '끊김 없이 쉬는 중 — 남은 일이 있으면 잇고 없으면 보관' });
  }

  /* 곁 세션: 끊기지 않은 부모는, 자식이 일하거나 이번에 깨울 대상이거나 유호님 차례면 기다리게 둔다.
   * 자식이 곁세션대기여도 그 아래가 살아 있다는 뜻이라 같이 센다. 부모가 끊겼으면 그대로 깨운다 —
   * 그때 부모가 스스로 보관해 곁 세션을 휩쓸지 않게 하는 것은 보낼 글이 맡는다. */
  const 살아있는칸 = new Set(['일하는중', '보냄', '곁세션대기', '유호님차례']);
  const 기다리나 = (id, 본 = new Set()) => {
    if (본.has(id)) return [];
    본.add(id);
    const 걸린 = [];
    for (const c of 자식들.get(id) || []) {
      const 판 = 판정.get(c);
      if (판 && 살아있는칸.has(판.칸)) 걸린.push(판.제목);
      else 걸린.push(...기다리나(c, 본));
    }
    return 걸린;
  };
  for (const [id, 판] of 판정) {
    if (판.칸 !== '보냄' || 판.끊김) continue;
    const 걸린 = 기다리나(id);
    if (걸린.length) 판정.set(id, { ...판, 칸: '곁세션대기', 곁: 걸린.slice(0, 5), 이유: undefined });
  }

  const 칸들 = { 보냄: [], 보관: [], 일하는중: [], 유호님차례: [], 직접멈춤: [], 곁세션대기: [], 방금끝남: [], 오래쉼: [] };
  for (const 판 of 판정.values()) {
    const { 칸, 끊김: _끊김, ...남김 } = 판;
    if (남김.이유 === undefined) delete 남김.이유;
    칸들[칸].push(남김);
  }
  /* 끊긴 세션을 먼저, 그 안에서는 최근 것부터 보낸다. */
  const 끊긴 = new Set([...판정.values()].filter((p) => p.끊김).map((p) => p.id));
  const 시각 = new Map(대상.map((r) => [r.sessionId, Number(r.lastActivityAt) || 0]));
  칸들.보냄.sort((a, b) => (끊긴.has(b.id) - 끊긴.has(a.id)) || (시각.get(b.id) - 시각.get(a.id)));
  return 칸들;
}

/* ── 실행 ─────────────────────────────────────────────────────────────── */

function 인자읽기(argv) {
  const 옵션 = { 전부: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const 다음 = () => {
      const v = argv[i + 1];
      i++;
      return v === undefined ? '' : v;
    };
    if (a === '--self') 옵션.self = 다음();
    else if (a === '--busy') {
      /* Windows PowerShell 5.1은 빈 인자("")를 빼고 넘긴다. 다음 값이 없거나 다른 인자면 「일하는 세션 없음」으로 읽는다. */
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) 옵션.busy = '';
      else 옵션.busy = 다음();
    } else if (a.startsWith('--busy=')) 옵션.busy = a.slice('--busy='.length);
    else if (a === '--전부' || a === '--all') 옵션.전부 = true;
    else if (a === '--기록') 옵션.기록 = 다음();
    else if (a === '--원문') 옵션.원문 = 다음();
    else if (a === '--로그') 옵션.로그 = 다음();
    else if (a === '--지금') 옵션.지금 = 다음();
    else if (a === '-h' || a === '--help') 옵션.도움말 = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  return 옵션;
}

function 실행(argv = process.argv.slice(2), env = process.env) {
  const 옵션 = 인자읽기(argv);
  if (옵션.도움말) return { ok: true, 도움말: '세션고르기.cjs --self <local_…> --busy <id,id,…> [--전부]' };
  if (!옵션.self) return { ok: false, 까닭: '--self(이 세션 id)가 없습니다. get_session("self")의 sessionId를 넘기세요.' };
  if (옵션.busy === undefined) {
    return { ok: false, 까닭: '--busy가 없습니다. 지금 일하는 세션을 모르면 고르지 않습니다. 없으면 --busy ""로 넘기세요.' };
  }
  const busy = 옵션.busy.split(/[\s,]+/).filter(Boolean);
  const 지금 = 옵션.지금 ? Date.parse(옵션.지금) : Date.now();
  if (!Number.isFinite(지금)) return { ok: false, 까닭: `--지금 값을 시각으로 읽지 못했습니다: ${옵션.지금}` };

  /* 앱 로그는 한 번만 읽는다 — 지금 계정(로그인 줄)과 세션별 마지막 멈춤 원인(Esc·앱 종료). */
  const 로그파일들 = 옵션.로그
    ? 목록(옵션.로그).filter((f) => /^main\d*\.log$/i.test(f)).map((f) => path.join(옵션.로그, f))
    : 옵션.기록
      ? []
      : 로그후보(env);
  const 로그 = 로그읽기(로그파일들);

  let 폴더 = 옵션.기록;
  let 근거 = '--기록으로 지정';
  let 확실 = true;
  if (!폴더) {
    const 찾음 = 지금계정폴더({ 뿌리들: 세션뿌리후보(env), 로그인: 로그.로그인 });
    if (!찾음) return { ok: false, 까닭: '앱 세션 기록 폴더(claude-code-sessions)를 찾지 못했습니다.' };
    ({ 폴더, 근거, 확실 } = 찾음);
  }
  const { 기록들, 깨짐 } = 기록읽기(폴더);
  if (!기록들.length) return { ok: false, 까닭: `세션 기록을 하나도 읽지 못했습니다: ${폴더}` };
  /* 기록 모양이 바뀌었으면(앱 업데이트) 판정을 믿지 말고 스킬의 다른 길로 가게 한다. */
  if (!기록들.some((r) => 'lastActivityAt' in r && 'cliSessionId' in r)) {
    return { ok: false, 까닭: '세션 기록의 모양이 예상과 다릅니다(lastActivityAt·cliSessionId 없음). 앱이 바뀌었을 수 있습니다.' };
  }
  const self = 아이디(옵션.self);
  if (!기록들.some((r) => r.sessionId === self)) {
    return { ok: false, 까닭: `이 세션(${self})의 기록이 고른 폴더에 없습니다. 다른 계정 폴더를 읽었을 수 있습니다: ${폴더}` };
  }

  const 원문뿌리 = 옵션.원문 || path.join(env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const 끝들 = new Map();
  let 원문없음 = 0;
  let 메시지없음 = 0;
  for (const r of 기록들) {
    if (r.sessionId === self) continue;
    const 파일 = 원문찾기(원문뿌리, r);
    if (!파일) {
      원문없음++;
      continue;
    }
    try {
      const 판 = 끝판정(원문끝메시지(파일));
      if (판.종류 === '모름') 메시지없음++;
      끝들.set(r.sessionId, 판);
    } catch {
      원문없음++;
    }
  }

  const 바로보관막힘 = 깨짐 ? `기록 ${깨짐}개를 읽지 못해` : !확실 ? '지금 계정을 앱 로그로 확인하지 못해' : '';
  const 칸들 = 나누기(기록들, 끝들, { self, busy, 전부: 옵션.전부, 지금, 바로보관: !바로보관막힘, 바로보관막힘, 멈춤들: 로그.멈춤들 });
  const 알림 = [];
  /* 앱은 켠 직후 10초쯤 뒤에 스스로 재개를 한 번 돌린다(main.log 「Relaunch auto-resume」). 그 전에 고르면 겹친다. */
  const 켜진지초 = 로그.로그인 ? Math.round((지금 - 로그.로그인.시각ms) / 1000) : null;
  if (켜진지초 !== null && 켜진지초 >= 0 && 켜진지초 < 60) {
    알림.push(`앱이 ${켜진지초}초 전에 켜졌습니다. 앱의 자동 재개가 끝나도록 1분을 채운 뒤 다시 고르면 겹치지 않습니다.`);
  }
  if (깨짐) 알림.push(`읽지 못한 세션 기록 ${깨짐}개가 있어 이번에는 바로 보관하지 않습니다(곁 세션 관계가 빠졌을 수 있음).`);
  if (!확실) 알림.push(`지금 계정을 앱 로그로 확인하지 못해 가장 최근에 바뀐 계정 폴더를 읽었고, 바로 보관은 하지 않습니다: ${폴더}`);
  if (원문없음) 알림.push(`대화 원문을 못 찾은 세션 ${원문없음}개는 앱 기록만으로 판정했습니다.`);
  if (메시지없음) 알림.push(`대화 원문 끝 32MB 안에서 메시지를 못 찾은 세션 ${메시지없음}개는 앱 기록만으로 판정했습니다.`);
  const 모르는busy = 일하나판(busy).목록.filter((b) => !기록들.some((r) => r.sessionId === b || r.sessionId.startsWith(b)));
  if (모르는busy.length) 알림.push(`--busy에 있지만 기록에 없는 세션 ${모르는busy.length}개(보관됐거나 다른 계정 폴더).`);
  return { ok: true, 기록폴더: 폴더, 폴더근거: 근거, 세션수: 기록들.length - 1, 앱켜진지초: 켜진지초, ...칸들, 알림 };
}

if (require.main === module) {
  let 결과;
  try {
    결과 = 실행();
  } catch (e) {
    결과 = { ok: false, 까닭: String(e && e.message ? e.message : e) };
  }
  process.stdout.write(`${JSON.stringify(결과, null, 1)}\n`);
  process.exitCode = 결과.ok ? 0 : 1;
}

module.exports = {
  나누기,
  끝판정,
  끊김,
  상태,
  부모,
  원문끝메시지,
  원문찾기,
  원문폴더이름,
  기록읽기,
  지금계정폴더,
  마지막로그인,
  로그읽기,
  로그후보,
  실행,
};
