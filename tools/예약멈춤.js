#!/usr/bin/env node
'use strict';
/* 예약 멈춤 — Claude 앱 예약 작업이 끝 보고 없이 멈추면 AI 없이 알아채고 텔레그램 한 통을 보낸다 (2026-10-22).
 *
 * 왜 있나: 앱 예약 작업(07시 콘텐츠 셋·14시 게시·월요일 스캔·금요일 판정·일회용 판정)은 지시문 마지막 단계에서야 텔레그램을
 *   보낸다. 그래서 사용량 한도·앱 재시작·계정 전환·PC 꺼짐으로 중간에 멈추면 아무 알림이 없었다(10-21 밤 한도로 세션 여럿이
 *   조용히 멈췄다). 권한에 막힌 것만 Stop 훅 tools/텔레그램승인.js가 알렸다.
 *
 *   node tools/예약멈춤.js          최근 30시간 회차마다 상태(끝남 · 도는 중 · 멈춤 · 보고 없음 · 시작 안 함)
 *   node tools/예약멈춤.js --json
 *   node tools/예약멈춤.js --알림    새로 멈춘 회차가 있으면 텔레그램 한 통(작업마다 하루 한 번). 예약을 따로 걸지 않고
 *                                   「SYNK CI 빨간불 알림」(10분마다, tools/ci빨간불.js --알림)이 같은 회차에 부른다
 *
 * 읽는 것(모두 읽기만):
 *   - 예약 정의    <앱 데이터>/claude-code-sessions/<계정>/<조직>/scheduled-tasks.json (cron·fireAt·enabled·lastScheduledFor,
 *                  앱이 회차를 건너뛴 까닭 recordedSkips)
 *   - 실행 세션    같은 폴더의 local_*.json 가운데 scheduledTaskId가 있는 것. 계정 폴더 일곱 곳을 미러가 맞추므로 세션마다
 *                  가장 늦게 바뀐 사본을 쓴다
 *   - 대화 원문    ~/.claude/projects/<폴더>/<cliSessionId>.jsonl — 차례가 어떻게 끝났는지는 /이어서의 세션고르기.cjs
 *                  (끝판정·끊김)를 그대로 쓴다. 그래서 이 알림이 멈췄다는 세션과 /이어서가 깨우는 세션이 같다. 텔레그램 보낸 줄도 여기서 본다
 *   - 실행 중 CLI  ~/.claude/sessions/<pid>.json — 그 세션 CLI가 살아서 차례를 돌리는 중(busy)인지
 *   - 승인 훅 기록 %LOCALAPPDATA%\hermes\runtime\synk-approvals\<cliSessionId>.json — 마지막 차례 끝에 권한 막힘을 알렸는지
 *   - 편 폴더      docs/마케팅/<편>/기획.md 첫 줄·게시/준비.json — 07시 작업이 그날 무엇을 남겼는지(알림에 덧붙이는 사실)
 *
 * 판정(회차마다):
 *   시작 안 함  예정 2시간이 지나도 그 회차 세션이 없다(앱이 그 회차나 뒤 회차를 띄웠다는 lastScheduledFor도 없다)
 *   멈춤        한도·오류로 끝난 차례 · 앱 재시작·계정 전환으로 끊긴 차례 · 받은 글에 답하지 못함 · CLI가 일하는 중인데 3시간 넘게 움직임 없음
 *   보고 없음   차례는 보통으로 끝났는데, 지시문에 텔레그램 단계가 있는 작업이 텔레그램을 안 보냈고, 권한 알림도 없고,
 *               앱 요약이 완료가 아니며, 2시간 넘게 움직임이 없다(백그라운드 렌더를 기다리며 차례를 쉬는 동안은 알리지 않는다)
 *   끝남·도는 중·쉬는 중·직접 멈춤(Stop·Esc·다른 세션)·보관됨은 알리지 않는다.
 * 한도·오류는 바로 알린다. 나머지는 감시가 끊김 없이 이어 도는 동안(회차 사이 15분 안) 9분 넘게 같은 모양일 때 알린다 —
 *   절전에서 막 깬 PC에서 아직 못 움직인 세션이나 늦게 뜨는 회차를 멈춤으로 적지 않는다.
 * 같은 작업은 하루(예정일, 이 PC 시간대)에 한 번만 알리고, 한 번에 여럿이면 한 통으로 묶는다. 그날 세션이 있는 회차가 있으면
 *   「시작 안 함」은 알리지 않고, 「시작 안 함」을 알린 뒤 그날 직접 돌린 회차가 멈추면 한 번 더 알리며, 그날 뒤에 다시 돌린 회차가
 *   잘 돌았으면 앞 회차는 알리지 않는다.
 *   보내기에 실패하면 알림 기록을 안 남겨 다음 회차에 다시 보낸다. 못 읽은 회차(원문 없음 등)는 「모름」이고 멈춤으로 적지 않는다.
 * 상태 파일은 공용 git 폴더 안(<git-common-dir>/synk-예약멈춤/상태.json)이라 워크트리·운영 사본·공용 작업본이 같이 보고, 저장소에는
 *   안 들어간다. 그 폴더는 git을 부르지 않고 .git 파일·commondir로 찾는다(바쁜 PC에서 git이 늦어 회차가 멈췄다, 10-22).
 *   앱 기록을 못 읽는 회차가 한 시간(6회) 내리 이어지면 감시가 멈췄다고 한 통, 다시 읽히면 「다시 읽습니다」 한 줄(<같은 폴더>/못읽음.json).
 * 시험·재현: SYNK_TG_DRYRUN_DIR(텔레그램 대신 그 폴더에 글 — 텔레그램승인.js와 같다) · SYNK_예약멈춤_상태(상태 파일) ·
 *   SYNK_CLAUDE_SESSIONS(계정 폴더들의 뿌리) · SYNK_CLAUDE_REGISTRY(실행 중 CLI 폴더) · SYNK_APPROVAL_DIR(승인 훅 기록) ·
 *   SYNK_예약멈춤_마케팅(편 폴더들) · CLAUDE_CONFIG_DIR(원문 projects·지시문 scheduled-tasks의 뿌리).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 고르기 = require('../.claude/skills/이어서/세션고르기.cjs');

const { 공용작업본 } = require('./lib/공용작업본.js');

const ROOT = path.resolve(__dirname, '..');
const 분 = 60e3;
const 시간 = 60 * 분;
const 창ms = 30 * 시간; // 이만큼 거슬러 올라간 회차까지 본다
const 창여유ms = 시간; // 창 끝에서 예정과 지터로 늦게 뜬 세션의 짝이 갈리지 않게 더 읽고 짝을 맞춘 뒤 자른다
const 시작여유ms = 2 * 시간;
const 막움직임ms = 90e3; // 원문이 이만큼 안에 쓰였으면 일하는 중(세션고르기 막움직임기준과 같다)
const 바쁨멈춤ms = 3 * 시간;
const 원문없음멈춤ms = 시간;
const 보고없음ms = 2 * 시간;
const 확인ms = 9 * 분;
const 이어짐ms = 15 * 분;
const 알림보관ms = 4 * 24 * 시간;
const 못읽음한도 = 6; // 10분 회차로 약 1시간 내리 못 읽으면 감시가 멈춘 것을 한 번 알린다(ci빨간불과 같다)
const 알릴종류 = new Set(['멈춤', '보고 없음', '시작 안 함']);
const 잘돈종류 = new Set(['끝남', '도는 중', '쉬는 중', '보관됨']);
const 텔레그램꼴 = /hermes(?:\.exe)?[\\"'`]*\s+send\b/i;
// hermes send는 성공하면 「sent」(홈 채널로 보내면 「Sent to … home channel」 note), --json이면 success:true. 실패는 stderr의 「hermes send: …」
const 보낸꼴 = /(?:^|\n)\s*(?:sent\s*(?:\r?\n|$)|Sent to \S)|"success"\s*:\s*true/;
const 완료요약 = new Set(['completed', 'review_ready']);

const 목록 = (p) => { try { return fs.readdirSync(p); } catch { return []; } };
const 폴더인가 = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const 바뀐시각 = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const 짧게 = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const 기본오프셋 = (ms) => -new Date(ms).getTimezoneOffset(); // 앱은 cron을 이 PC 시간대로 읽는다

function 경로들(환경 = process.env) {
  const 집 = 환경.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return {
    세션뿌리들: 세션뿌리후보(환경),
    원문뿌리: path.join(집, 'projects'),
    실행중: 환경.SYNK_CLAUDE_REGISTRY || path.join(집, 'sessions'),
    지시문: path.join(집, 'scheduled-tasks'),
    승인: 환경.SYNK_APPROVAL_DIR || path.join(환경.LOCALAPPDATA || '', 'hermes', 'runtime', 'synk-approvals'),
    // 앱 예약 작업은 공용 작업본에서 편을 만든다 — 이 도구가 운영 사본(tools/운영사본.js)에서 돌아도 거기를 본다(10-22)
    마케팅: 환경.SYNK_예약멈춤_마케팅 || path.join(공용작업본(ROOT), 'docs', '마케팅'),
  };
}

/** 앱 데이터의 claude-code-sessions 뿌리들(세션고르기 세션뿌리후보와 같은 곳). */
function 세션뿌리후보(환경 = process.env) {
  if (환경.SYNK_CLAUDE_SESSIONS) return [환경.SYNK_CLAUDE_SESSIONS];
  const 후보 = [];
  const local = 환경.LOCALAPPDATA;
  if (local) {
    for (const d of 목록(path.join(local, 'Claude-Data'))) 후보.push(path.join(local, 'Claude-Data', d, 'claude-code-sessions'));
    for (const d of 목록(path.join(local, 'Packages'))) {
      if (/^Claude_/i.test(d)) 후보.push(path.join(local, 'Packages', d, 'LocalCache', 'Roaming', 'Claude', 'claude-code-sessions'));
    }
  }
  if (환경.APPDATA) 후보.push(path.join(환경.APPDATA, 'Claude', 'claude-code-sessions'));
  return [...new Set(후보)].filter(폴더인가);
}

function 조직폴더들(뿌리들) {
  const 결과 = [];
  for (const 뿌리 of 뿌리들) for (const 계정 of 목록(뿌리)) for (const 조직 of 목록(path.join(뿌리, 계정))) {
    const p = path.join(뿌리, 계정, 조직);
    if (폴더인가(p)) 결과.push(p);
  }
  return 결과;
}

/**
 * 가장 늦게 바뀐 scheduled-tasks.json의 작업 목록(작업마다 앱이 건너뛴 기록 recordedSkips[id] = [{ at, reason }]을 「건너뜀」으로 붙인다).
 * 쓰는 중이라 못 읽으면 다음 사본. 하나도 못 읽으면 null.
 */
function 정의읽기(폴더들) {
  const 후보 = 폴더들.map((p) => path.join(p, 'scheduled-tasks.json')).map((f) => ({ f, t: 바뀐시각(f) }))
    .filter((x) => x.t).sort((a, b) => b.t - a.t);
  for (const { f } of 후보) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const 건너뜀 = (j.recordedSkips && typeof j.recordedSkips === 'object') ? j.recordedSkips : {};
      if (Array.isArray(j.scheduledTasks)) return j.scheduledTasks.map((t) => ({ ...t, 건너뜀: Array.isArray(건너뜀[t.id]) ? 건너뜀[t.id] : [] }));
    } catch { /* 미러·앱이 쓰는 중 */ }
  }
  return null;
}

/** 앱이 회차를 건너뛸 때 적는 까닭(app.asar 3.1623의 건너뜀 열거값). */
const 건너뜀까닭 = {
  per_task_limit: '같은 작업이 아직 돌고 있었다', global_limit: '동시에 도는 예약 작업 한도에 걸렸다', sign_in_required: '로그인이 필요했다',
  host_unavailable: '실행할 컴퓨터에 닿지 못했다', host_not_allowed: '실행할 컴퓨터가 허용되지 않았다', connection_removed: '연결이 지워졌다',
  folder_not_trusted: '작업 폴더를 신뢰하지 않았다', folder_missing: '작업 폴더가 없었다', start_failed: '세션을 띄우지 못했다',
  not_available: '이 컴퓨터에서 쓸 수 없었다', not_run_before_update: '앱 업데이트 전에 돌지 못했다',
};

/** 창 안에 만들어진 예약 실행 세션 기록 — 세션마다 가장 늦게 바뀐 사본(그 사본을 못 읽으면 그다음 사본). 보관된 것도 읽는다. */
function 실행기록읽기(폴더들, 이후ms) {
  const 사본 = new Map();
  for (const p of 폴더들) for (const f of 목록(p)) {
    if (!/^local_[0-9a-f-]+\.json$/i.test(f)) continue;
    const 경로 = path.join(p, f);
    const t = 바뀐시각(경로);
    if (t < 이후ms) continue; // 창보다 오래 안 바뀐 기록은 창 안에 만들어진 회차가 아니다
    if (!사본.has(f)) 사본.set(f, []);
    사본.get(f).push({ 경로, t });
  }
  const 기록들 = [];
  for (const 사본들 of 사본.values()) {
    for (const { 경로 } of 사본들.sort((a, b) => b.t - a.t)) {
      let 글;
      try { 글 = fs.readFileSync(경로, 'utf8'); } catch { continue; }
      if (!글.includes('"scheduledTaskId"')) break;
      let j;
      try { j = JSON.parse(글); } catch { continue; }
      if (j && j.scheduledTaskId && Number(j.createdAt) >= 이후ms) 기록들.push(j);
      break;
    }
  }
  return 기록들;
}

/** 앱 설정(claude-code-sessions 옆 claude_desktop_config.json)에서 Code 탭 예약 작업을 꺼 두었는지. */
function 예약꺼졌나(뿌리들) {
  return 뿌리들.some((뿌리) => {
    try { return JSON.parse(fs.readFileSync(path.join(path.dirname(뿌리), 'claude_desktop_config.json'), 'utf8')).preferences?.ccdScheduledTasksEnabled === false; } catch { return false; }
  });
}

function 살았나(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** 살아 있는 CLI — 앱 세션 ID → { 바쁨 }. ListAgents의 busy·idle과 같은 곳이다. 한 세션에 파일이 여럿이면(다시 뜬 CLI) 상태를 늦게 쓴 것. */
function 실행중읽기(폴더, 살았나판 = 살았나) {
  const 결과 = new Map();
  for (const f of 목록(폴더)) {
    if (!/^\d+\.json$/.test(f)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(폴더, f), 'utf8')); } catch { continue; }
    if (!j || !j.hostSessionId || !살았나판(j.pid)) continue;
    const t = Number(j.statusUpdatedAt || j.updatedAt) || 0;
    const 앞 = 결과.get(j.hostSessionId);
    if (!앞 || t >= 앞.t) 결과.set(j.hostSessionId, { 바쁨: j.status === 'busy', t });
  }
  return 결과;
}

// ── cron ────────────────────────────────────────────────────────────────────

function 칸풀기(칸, 최소, 최대) {
  if (칸 === '*') return null;
  const 값 = new Set();
  for (const 조각 of 칸.split(',')) {
    const [범위, 걸음글] = 조각.split('/');
    const 걸음 = 걸음글 === undefined ? 1 : Number(걸음글);
    let [처음, 끝] = 범위 === '*' ? [최소, 최대] : 범위.split('-').map(Number);
    if (끝 === undefined) 끝 = 걸음글 === undefined ? 처음 : 최대;
    if (![처음, 끝, 걸음].every(Number.isInteger) || 걸음 < 1 || 처음 < 최소 || 끝 > 최대) throw new Error(`cron 칸을 못 읽었다: ${칸}`);
    for (let v = 처음; v <= 끝; v += 걸음) 값.add(v);
  }
  return 값;
}

function cron읽기(식) {
  const 칸 = String(식 || '').trim().split(/\s+/);
  if (칸.length !== 5) throw new Error(`cron은 다섯 칸이다: ${식}`);
  const 요일 = 칸풀기(칸[4], 0, 7);
  if (요일 && 요일.has(7)) 요일.add(0); // 7도 일요일
  return { 분: 칸풀기(칸[0], 0, 59), 시: 칸풀기(칸[1], 0, 23), 일: 칸풀기(칸[2], 1, 31), 월: 칸풀기(칸[3], 1, 12), 요일 };
}

function cron맞나(c, d) {
  const 맞음 = (s, v) => !s || s.has(v);
  if (!맞음(c.분, d.분) || !맞음(c.시, d.시) || !맞음(c.월, d.월)) return false;
  if (c.일 && c.요일) return c.일.has(d.일) || c.요일.has(d.요일); // 날짜와 요일을 둘 다 정하면 어느 하나(표준 cron)
  return 맞음(c.일, d.일) && 맞음(c.요일, d.요일);
}

/** (부터, 까지] 안의 예정 시각들(ms). 오프셋(ms) = 그 순간 이 PC 시간대의 분. */
function 예정들(식, 부터ms, 까지ms, 오프셋 = 기본오프셋) {
  const c = cron읽기(식);
  const 결과 = [];
  for (let t = Math.floor(부터ms / 분) * 분 + 분; t <= 까지ms; t += 분) {
    const k = new Date(t + 오프셋(t) * 분);
    if (cron맞나(c, { 분: k.getUTCMinutes(), 시: k.getUTCHours(), 일: k.getUTCDate(), 월: k.getUTCMonth() + 1, 요일: k.getUTCDay() })) 결과.push(t);
  }
  return 결과;
}

const 띄웠나 = (정의, 예정) => Boolean(정의 && Math.abs(Date.parse(정의.lastScheduledFor) - 예정) <= 분);

/** 예정 시각마다 그 회차 세션을 붙인다. 예정에 안 묶인 실행(「지금 실행」·꺼진 작업의 회차)도 따로 넣는다. */
function 회차모으기(정의들, 기록들, 지금ms, 오프셋 = 기본오프셋, 창 = 창ms) {
  const 부터 = 지금ms - 창;
  const 작업별 = new Map();
  for (const r of 기록들) {
    if (!작업별.has(r.scheduledTaskId)) 작업별.set(r.scheduledTaskId, []);
    작업별.get(r.scheduledTaskId).push(r);
  }
  for (const 세션들 of 작업별.values()) 세션들.sort((a, b) => a.createdAt - b.createdAt);
  const 회차들 = [];
  const 쓴 = new Set();
  for (const t of 정의들) {
    let 예정 = [];
    if (t.cronExpression && t.enabled) {
      try { 예정 = 예정들(t.cronExpression, 부터, 지금ms, 오프셋); } catch { 예정 = []; }
    } else if (Number.isFinite(t.fireAt) && t.fireAt > 부터 && t.fireAt <= 지금ms && (t.enabled || 띄웠나(t, t.fireAt))) 예정 = [t.fireAt];
    예정 = 예정.filter((s) => !(Number(t.createdAt) > s)); // 작업을 만들기 전 예정은 없다
    const 세션들 = 작업별.get(t.id) || [];
    예정.forEach((s, i) => {
      const 다음 = i + 1 < 예정.length ? 예정[i + 1] : Infinity;
      const r = 세션들.find((x) => !쓴.has(x.sessionId) && x.createdAt >= s - 2 * 분 && x.createdAt < 다음 - 2 * 분);
      if (r) 쓴.add(r.sessionId);
      회차들.push({ 작업: t.id, 정의: t, 예정: s, 다음, 기록: r || null });
    });
  }
  const 정의맵 = new Map(정의들.map((t) => [t.id, t]));
  for (const [id, 세션들] of 작업별) for (const r of 세션들) if (!쓴.has(r.sessionId)) 회차들.push({ 작업: id, 정의: 정의맵.get(id) || null, 예정: null, 기록: r });
  return 회차들.sort((a, b) => (a.예정 ?? a.기록.createdAt) - (b.예정 ?? b.기록.createdAt));
}

// ── 원문·지시문·편 폴더 ─────────────────────────────────────────────────────

/** 원문 전체에서 hermes send 호출과 그 결과의 「sent」를 찾는다(07시 작업은 마무리 3단계에서 보낸다). */
function 텔레그램보냈나(파일) {
  let 글;
  try { 글 = fs.readFileSync(파일, 'utf8'); } catch { return false; }
  if (!글.includes('hermes')) return false;
  const 줄들 = 글.split('\n');
  const 블록 = (줄) => { try { const c = JSON.parse(줄).message?.content; return Array.isArray(c) ? c : []; } catch { return []; } };
  const 호출 = new Set();
  for (const 줄 of 줄들) {
    if (!줄.includes('hermes') || !줄.includes('"tool_use"')) continue;
    for (const b of 블록(줄)) {
      if (b?.type === 'tool_use' && Object.values(b.input || {}).some((v) => typeof v === 'string' && 텔레그램꼴.test(v))) 호출.add(b.id);
    }
  }
  if (!호출.size) return false;
  for (const 줄 of 줄들) {
    if (!줄.includes('"tool_result"') || ![...호출].some((id) => 줄.includes(id))) continue;
    for (const b of 블록(줄)) {
      if (b?.type !== 'tool_result' || !호출.has(b.tool_use_id) || b.is_error) continue;
      const 내용 = typeof b.content === 'string' ? b.content : (b.content || []).map((x) => (x && x.type === 'text' ? x.text : '')).join('\n');
      if (보낸꼴.test(내용)) return true;
    }
  }
  return false;
}

/** 지시문(SKILL.md)에서 읽는 것 — 텔레그램 단계가 있는지, 07시 편 브랜드(기획.md 첫 줄 「1일 1편 · <브랜드> · <날짜>」). */
function 지시문읽기(정의, 작업, 지시문폴더) {
  let 글 = '';
  for (const 파일 of [정의 && 정의.filePath, path.join(지시문폴더, 작업, 'SKILL.md')]) {
    if (!파일) continue;
    try { 글 = fs.readFileSync(파일, 'utf8'); break; } catch { /* 옮겼거나 지운 작업 */ }
  }
  const m = 글.match(/1일 1편 · ([^\s·<]+) · <(?:오늘|만든 날)/);
  return { 텔레그램: 텔레그램꼴.test(글), 브랜드: m ? m[1] : null };
}

/** 편 폴더마다 { 브랜드, 날짜, 준비 } — 게시/준비.json(올릴 묶음까지 끝)이 먼저, 없으면 기획.md 첫 줄(시작만 함). */
function 편목록(마케팅) {
  const 결과 = [];
  for (const d of 목록(마케팅)) {
    const 폴더 = path.join(마케팅, d);
    let 준비 = null;
    try { 준비 = JSON.parse(fs.readFileSync(path.join(폴더, '게시', '준비.json'), 'utf8').trimStart()); } catch { /* 없음 — trimStart는 BOM도 지운다 */ }
    if (준비 && 준비.브랜드 && 준비.날짜) { 결과.push({ 브랜드: 준비.브랜드, 날짜: String(준비.날짜).slice(0, 10), 준비: true }); continue; }
    let 첫줄 = '';
    try {
      const fd = fs.openSync(path.join(폴더, '기획.md'), 'r');
      try { const b = Buffer.alloc(600); 첫줄 = b.toString('utf8', 0, fs.readSync(fd, b, 0, 600, 0)).split('\n')[0]; } finally { fs.closeSync(fd); }
    } catch { continue; }
    const m = 첫줄.match(/1일 1편 · ([^\s·]+) · (\d{4}-\d{2}-\d{2})/);
    if (m) 결과.push({ 브랜드: m[1], 날짜: m[2], 준비: false });
  }
  return 결과;
}

function 편사실(편들, 브랜드, 날짜) {
  const 그날 = 편들.filter((x) => x.브랜드 === 브랜드 && x.날짜 === 날짜);
  const 준비 = 그날.filter((x) => x.준비).length;
  if (준비) return `그날 ${브랜드} 편 준비 ${준비}편${그날.length > 준비 ? `·기획만 ${그날.length - 준비}편` : ''}`;
  return 그날.length ? `그날 ${브랜드} 편 기획만 ${그날.length}편(준비.json 없음)` : `그날 ${브랜드} 편 없음`;
}

/** 마지막 차례 끝(원문 마지막 메시지 앞뒤 5분)에 승인 훅이 권한 막힘을 알렸는지. */
function 승인알렸나(승인폴더, 기록, 끝시각) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(승인폴더, `${기록.cliSessionId}.json`), 'utf8'));
    const 보낸 = Date.parse(j?.notice?.sent_at);
    return Boolean(보낸 && !j.notice.error && 보낸 >= (끝시각 || Number(기록.createdAt) || 0) - 5 * 분);
  } catch { return false; }
}

// ── 판정 ────────────────────────────────────────────────────────────────────

const 끊김까닭 = { 재시작: '앱 재시작·계정 전환으로 끊김', 답없음: '받은 글에 답하지 못하고 멈춤' };

/** 회차 하나 — { 종류, 까닭, 확실(바로 알림), 활동(마지막 활동 ms), 텔레그램, 세션 }. */
function 회차판정(회차, ctx) {
  const r = 회차.기록;
  const { 지금ms } = ctx;
  if (!r) {
    if (회차.예정 + 시작여유ms > 지금ms) return { 종류: '아직', 까닭: '예정 2시간 안' };
    // 앱이 이 회차를 건너뛰었다고 적었으면 그것이 먼저다(건너뛴 회차도 lastScheduledFor는 넘어간다)
    const 건너뜀 = ((회차.정의 && 회차.정의.건너뜀) || []).filter((x) => Number(x.at) >= 회차.예정 - 분 && Number(x.at) < (회차.다음 ?? Infinity)).pop();
    if (건너뜀) return { 종류: '시작 안 함', 까닭: `시작하지 않았습니다 — 앱이 건너뜀: ${건너뜀까닭[건너뜀.reason] || 건너뜀.reason}`, 확실: false, 활동: null };
    // lastScheduledFor는 마지막으로 띄운 예정 하나뿐이다 — 이 회차 뒤 회차를 이미 띄웠으면 지운 세션과 놓친 회차를 가를 수 없다
    const 띄움 = Date.parse(회차.정의 && 회차.정의.lastScheduledFor) || 0;
    if (띄움 >= 회차.예정 - 분) return { 종류: '모름', 까닭: 띄움 <= 회차.예정 + 분 ? '앱은 띄웠다는데 세션 기록이 없다(지운 세션일 수 있다)' : '뒤 회차를 이미 띄워 이 회차는 가르지 못한다' };
    const 까닭 = ctx.예약꺼짐 ? '시작하지 않았습니다 — 앱 설정에서 예약 작업이 꺼져 있습니다' : '시작하지 않았습니다(그 시각에 PC·앱이 꺼져 있었거나 잠자기였을 수 있음)';
    return { 종류: '시작 안 함', 까닭, 확실: false, 활동: null };
  }
  const 세션 = r.sessionId;
  if (r.isArchived) return { 종류: '보관됨', 세션, 활동: Number(r.lastActivityAt) || null };
  const 원문 = 고르기.원문찾기(ctx.원문뿌리, r);
  const 끝 = 원문 ? 고르기.끝판정(고르기.원문끝메시지(원문, 6)) : null;
  const 읽음 = Boolean(끝 && 끝.종류 !== '모름');
  let 곁 = 0; // 서브에이전트 원문이 더 늦게 움직였으면 그 시각
  if (원문) {
    const 곁폴더 = path.join(path.dirname(원문), path.basename(원문, '.jsonl'), 'subagents');
    for (const f of 목록(곁폴더)) if (f.endsWith('.jsonl')) 곁 = Math.max(곁, 바뀐시각(path.join(곁폴더, f)));
  }
  const 끊긴때 = 읽음 ? (끝.보정 ? 끝.앞시각 : 끝.시각) || 0 : 0; // 다시 뜬 CLI가 나중에 쓴 보정 줄 말고 실제로 끊긴 때
  const 활동 = Math.max(Number(r.lastActivityAt) || 0, 끊긴때, 곁) || null;
  const 판 = (종류, 덧 = {}) => ({ 종류, 세션, 활동, ...덧 });
  const 조용 = 지금ms - (활동 || 0);
  const 실행 = ctx.실행중.get(세션);
  const 바쁨 = Boolean(실행 && 실행.바쁨);
  const 로그필요 = 읽음 && (r.lastTurnCutShort === true || r.interruptedByQuitAt != null || ['멈춤', '재시작', '답없음'].includes(끝.종류));
  const k = 고르기.끊김(r, 읽음 ? 끝 : null, 지금ms, 로그필요 ? ctx.로그멈춤(세션) : null);
  // 한도·오류는 끝난 차례다 — 실행 중 기록(죽은 CLI의 낡은 busy일 수 있다)·막 움직임과 상관없이 바로 알린다
  if (k && (k.종류 === '한도' || k.종류 === '오류')) return 판('멈춤', { 까닭: `${k.종류 === '한도' ? '사용량 한도' : '오류'}로 끊김 「${짧게(k.글, 90)}」`, 확실: true, 한도: k.종류 === '한도' });
  if (!읽음) {
    // 원문을 못 읽으면 앱 기록만 본다 — 차례가 열린 채 한 시간(CLI가 일하는 중이면 세 시간) 넘게 조용한 것만 멈춤이다
    const 열림 = (Number(r.latestUserFrameAt) || 0) > (Number(r.lastTurnEdgeAt) || 0);
    if (열림 && 조용 >= (바쁨 ? 바쁨멈춤ms : 원문없음멈춤ms)) return 판('멈춤', { 까닭: `${동안(조용)} 동안 움직임 없음(대화 원문을 못 찾음)`, 확실: false });
    return 판(열림 ? '도는 중' : '모름', { 까닭: '대화 원문을 못 찾음' });
  }
  if (k) {
    // 차례 한가운데 모양 — CLI가 살아 차례를 돌리는 중이거나 막 움직였으면 도는 중이다
    if ((바쁨 && 조용 < 바쁨멈춤ms) || 조용 < 막움직임ms) return 판('도는 중');
    if (바쁨) return 판('멈춤', { 까닭: `${동안(조용)} 동안 움직임 없음(CLI는 일하는 중으로 떠 있음)`, 확실: false });
    if (끊김까닭[k.종류]) return 판('멈춤', { 까닭: 끊김까닭[k.종류], 확실: false });
    return 판('직접 멈춤', { 까닭: k.원인 ? `${k.원인}으로 멈춤` : '사람·다른 세션이 멈춘 것으로 보임' }); // 멈춤·불명은 일부러 멈춘 쪽으로 본다
  }
  // 차례가 보통으로 끝났다 — 텔레그램 단계가 있는 작업이면 끝 보고(텔레그램)를 했는지 본다
  const 지시 = ctx.지시문(회차);
  if (!지시.텔레그램) return 판('끝남');
  if (텔레그램보냈나(원문)) return 판('끝남', { 텔레그램: true });
  if (승인알렸나(ctx.승인, r, 끝.시각)) return 판('끝남', { 까닭: '권한 막힘 알림이 갔다' });
  const s = 고르기.상태(r);
  if (완료요약.has(s.상태)) return 판('끝남', { 까닭: `앱 요약 ${s.상태}(텔레그램 없음)` });
  const 까닭 = `텔레그램 끝 보고 없이 섰습니다${s.기다림 ? ` — 기다리는 것: ${짧게(s.기다림, 80)}` : s.설명 ? ` — 마지막 상태: ${짧게(s.설명, 80)}` : ''}`;
  return 조용 < 보고없음ms ? 판('쉬는 중', { 까닭 }) : 판('보고 없음', { 까닭, 확실: false });
}

/** 지금 상태 — { 상태: '읽음'|'모름', 이유, 확인시각, 회차들: [{ 작업, 제목, 예정, 세션, 열쇠, 회차열쇠, 판정, 편 }] }. */
function 지금읽기({ 환경 = process.env, 지금ms = Date.now(), 오프셋분 = null, 살았나판 = 살았나, 로그파일들 = null } = {}) {
  const 오프셋 = 오프셋분 == null ? 기본오프셋 : () => 오프셋분;
  const 경 = 경로들(환경);
  const 폴더들 = 조직폴더들(경.세션뿌리들);
  if (!폴더들.length) return { 상태: '모름', 이유: '앱 세션 기록 폴더(claude-code-sessions)를 못 찾았다', 회차들: [] };
  const 정의들 = 정의읽기(폴더들);
  const 넓은창 = 창ms + 창여유ms;
  const 회차들 = 회차모으기(정의들 || [], 실행기록읽기(폴더들, 지금ms - 넓은창), 지금ms, 오프셋, 넓은창)
    .filter((x) => (x.예정 ?? x.기록.createdAt) > 지금ms - 창ms);
  let 로그 = null;
  const 지시들 = new Map();
  let 편들 = null;
  const ctx = {
    지금ms, 원문뿌리: 경.원문뿌리, 승인: 경.승인, 실행중: 실행중읽기(경.실행중, 살았나판), 예약꺼짐: 예약꺼졌나(경.세션뿌리들),
    로그멈춤: (id) => {
      if (!로그) { try { 로그 = 고르기.로그읽기(로그파일들 || 고르기.로그후보(환경)); } catch { 로그 = { 멈춤들: new Map() }; } }
      return 로그.멈춤들.get(id) || null;
    },
    지시문: (회차) => {
      if (!지시들.has(회차.작업)) 지시들.set(회차.작업, 지시문읽기(회차.정의, 회차.작업, 경.지시문));
      return 지시들.get(회차.작업);
    },
  };
  const 결과 = 회차들.map((회차) => {
    const 판정 = 회차판정(회차, ctx);
    const 기준 = 회차.예정 ?? 회차.기록.createdAt;
    const 날짜 = 날짜글(기준, 오프셋);
    const x = {
      작업: 회차.작업, 제목: 짧게((회차.정의 && 회차.정의.displayName) || (회차.기록 && 회차.기록.title) || 회차.작업, 44),
      예정: 회차.예정, 시작: 회차.기록 ? 회차.기록.createdAt : null, 세션: 회차.기록 ? 회차.기록.sessionId : null,
      열쇠: `${회차.작업}|${날짜}`, 회차열쇠: `${회차.작업}|${회차.예정 ?? `실행:${회차.기록.sessionId}`}`, 판정,
    };
    const 브랜드 = ctx.지시문(회차).브랜드;
    if (브랜드 && 알릴종류.has(판정.종류)) x.편 = 편사실(편들 || (편들 = 편목록(경.마케팅)), 브랜드, 날짜);
    return x;
  });
  return { 상태: '읽음', ...(정의들 ? {} : { 이유: 'scheduled-tasks.json을 못 읽어 예정 회차는 빼고 실행만 봤다' }), 확인시각: new Date(지금ms).toISOString(), 오프셋분: 오프셋(지금ms), 회차들: 결과 };
}

// ── 글 ──────────────────────────────────────────────────────────────────────

function 날짜글(ms, 오프셋 = 기본오프셋) { return new Date(ms + 오프셋(ms) * 분).toISOString().slice(0, 10); }
function 때(ms, 오프셋분) {
  const 오 = 오프셋분 == null ? 기본오프셋(ms) : 오프셋분;
  return new Date(ms + 오 * 분).toISOString().slice(5, 16).replace('T', ' ');
}
function 동안(ms) {
  const 분수 = Math.max(0, Math.round(ms / 분));
  return 분수 >= 60 ? `${Math.floor(분수 / 60)}시간${분수 % 60 ? ` ${분수 % 60}분` : ''}` : `${분수}분`;
}
const 회차때 = (x, 오) => (x.예정 != null ? `${때(x.예정, 오)} 회차` : `${때(x.시작, 오)} 실행`);
const 표지 = { 끝남: '✓', 보관됨: '✓', '도는 중': '▶', '쉬는 중': '◦', '직접 멈춤': '■', 멈춤: '⏸', '보고 없음': '⏸', '시작 안 함': '⏸', 아직: '…', 모름: '?' };

function 줄글(x, 오) {
  const p = x.판정;
  const 덧 = [p.텔레그램 ? '텔레그램 보냄' : '', p.까닭 || '', p.활동 ? `마지막 활동 ${때(p.활동, 오)}` : '', x.편 || ''].filter(Boolean);
  return `${x.제목} — ${회차때(x, 오)} · ${p.종류}${덧.length ? ` · ${덧.join(' · ')}` : ''}`;
}

function 상태글(r) {
  if (r.상태 === '모름') return `앱 예약 작업 상태 모름 — ${r.이유}`;
  const 줄 = [`앱 예약 작업 — 최근 ${창ms / 시간}시간 회차 (${때(Date.parse(r.확인시각), r.오프셋분)} 확인)`];
  if (r.이유) 줄.push(`(${r.이유})`);
  if (!r.회차들.length) 줄.push('  회차 없음');
  for (const x of r.회차들) 줄.push(`  ${표지[x.판정.종류] || '·'} ${줄글(x, r.오프셋분)}`);
  return 줄.join('\n');
}

function 알림글(새것들, 오) {
  const 줄 = ['⏸ 앱 예약 작업이 끝 보고 없이 멈춘 것 같습니다'];
  for (const x of 새것들) 줄.push(`• ${줄글(x, 오)}`);
  if (새것들.some((x) => x.판정.종류 !== '시작 안 함')) 줄.push(`다시 깨우려면 /이어서${새것들.some((x) => x.판정.한도) ? ' (한도로 끊긴 것은 풀린 뒤에)' : ''}`);
  if (새것들.some((x) => x.판정.종류 === '시작 안 함')) 줄.push('시작하지 않은 회차는 앱 예약 작업의 「지금 실행」으로 돌립니다');
  줄.push('자세히: node tools/예약멈춤.js');
  return 줄.join('\n');
}

// ── 알림(작업마다 하루 한 번) ────────────────────────────────────────────────

/**
 * 앞 상태와 지금을 견줘 보낼 글과 새 상태를 만든다(보내지는 않는다).
 * 상태: { 판: 1, 확인시각, 깨어있음부터(감시가 15분 안 간격으로 이어 돈 시작), 알림: { 열쇠: { 알린시각, 종류, 세션 } },
 *         의심: { 회차열쇠: { 종류, 활동, 처음 } } }
 */
function 알림계획(앞, 지금, 지금ms = Date.now()) {
  const 옛 = 앞 && 앞.판 === 1 ? 앞 : {};
  const 지금글 = new Date(지금ms).toISOString();
  const 이어짐 = Boolean(옛.확인시각) && 지금ms - Date.parse(옛.확인시각) <= 이어짐ms;
  const 알림 = {};
  for (const [k, v] of Object.entries(옛.알림 || {})) if (지금ms - Date.parse(v.알린시각) <= 알림보관ms) 알림[k] = v;
  const 의심 = {};
  const 새것들 = [];
  for (const x of 지금.회차들) {
    const p = x.판정;
    if (!알릴종류.has(p.종류) || 새것들.some((y) => y.열쇠 === x.열쇠)) continue;
    // 같은 작업은 하루 한 번 — 「시작 안 함」을 알린 뒤 그날 직접 돌린 회차가 멈춘 것만 한 번 더 알린다
    const 앞 = 알림[x.열쇠];
    if (앞 && !(앞.종류 === '시작 안 함' && x.세션)) continue;
    // 시작 안 한 회차는 그날 세션이 있는 회차가 하나라도 있으면 뺀다(그 회차가 멈췄으면 그 회차를 알린다).
    // 멈춘 회차는 그 뒤에 다시 돌린 회차가 잘 돌았으면 뺀다
    const 같은날 = 지금.회차들.filter((y) => y !== x && y.열쇠 === x.열쇠 && y.세션);
    if (x.세션 == null ? 같은날.length : 같은날.some((y) => 잘돈종류.has(y.판정.종류) && (y.시작 || 0) > (x.시작 || 0))) continue;
    if (!p.확실) {
      const o = 이어짐 ? (옛.의심 || {})[x.회차열쇠] : null; // 감시가 끊겼으면(절전 등) 처음부터 다시 센다
      const 같음 = o && o.종류 === p.종류 && (o.활동 ?? null) === (p.활동 ?? null);
      const 처음 = 같음 ? o.처음 : 지금글;
      의심[x.회차열쇠] = { 종류: p.종류, 활동: p.활동 ?? null, 처음 };
      if (지금ms - Date.parse(처음) < 확인ms) continue;
    }
    새것들.push(x);
  }
  const 알린뒤 = { ...알림 };
  for (const x of 새것들) 알린뒤[x.열쇠] = { 알린시각: 지금글, 종류: x.판정.종류, 세션: x.세션 };
  const 깨어있음부터 = 이어짐 ? (옛.깨어있음부터 || 옛.확인시각) : 지금글;
  const 바탕 = { 판: 1, 확인시각: 지금글, 깨어있음부터, 의심 };
  return { 글: 새것들.length ? 알림글(새것들, 지금.오프셋분) : null, 새상태: { ...바탕, 알림: 알린뒤 }, 못보낸상태: { ...바탕, 알림 }, 새것들 };
}

/**
 * 공용 git 폴더 — git을 부르지 않고 .git 파일·commondir로 먼저 찾는다(lib/공용작업본.js). 10-22 18:28 운영 사본 회차가 바쁜 PC에서
 * 10초 한도의 rev-parse를 넘겨 「git 폴더를 못 찾았다」로 끝났다. 그래도 못 찾으면 git에 60초까지 묻는다(ci빨간불과 같은 한도).
 */
function 공용git폴더(root = ROOT) {
  const 곁 = path.join(공용작업본(root), '.git');
  if (폴더인가(곁)) return 곁;
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  return r.status === 0 ? String(r.stdout).trim() : null;
}
function 상태파일(환경 = process.env) {
  if (환경.SYNK_예약멈춤_상태) return 환경.SYNK_예약멈춤_상태;
  const g = 공용git폴더();
  return g ? path.join(g, 'synk-예약멈춤', '상태.json') : null;
}

/**
 * 못 읽은 회차(앱 기록을 못 찾음 등)를 센다 — 못읽음한도(약 1시간) 내리 못 읽으면 감시가 멈췄다고 한 번 보낸다. 감시가 조용히 못 도는 것도
 * 막으려던 꼴이다. 셈 파일 { 처음, 회수(이번에 내리 못 읽은 수 — 0이면 그사이 읽힌 회차가 있었다), 알림(이번 줄에 「멈췄다」를 보냈나),
 * 빚(「다시 읽습니다」를 아직 못 보냈나) }. 읽힌 회차가 끼면 새 줄로 세서 새 장애도 알린다(GPT 10-22 P1).
 */
function 못읽음세기(파일, 이유, { 환경, 보내는일, 지금ms }) {
  let 앞 = {};
  try { 앞 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { 앞 = {}; }
  const 이어짐 = (앞.회수 || 0) > 0;
  const 회수 = (이어짐 ? 앞.회수 : 0) + 1, 처음 = 이어짐 && 앞.처음 ? 앞.처음 : new Date(지금ms).toISOString();
  let 알림 = 이어짐 && Boolean(앞.알림), 빚 = Boolean(앞.빚);
  if (회수 >= 못읽음한도 && !알림) {
    const 글 = `⚠ 앱 예약 작업 감시가 ${회수}회(${동안(지금ms - Date.parse(처음))}) 내리 앱 기록을 못 읽었습니다 — ${이유}\n`
      + '그동안 예약 작업이 끝 보고 없이 멈춰도 알림이 가지 않습니다. 확인: node tools/예약멈춤.js';
    const r = (보내는일 || require('./텔레그램승인.js').보내기)(글, 환경);
    알림 = Boolean(r && r.ok);
    if (알림) 빚 = true;
  }
  셈쓰기(파일, { 처음, 회수, 마지막이유: 이유, 알림, 빚 });
  return { 회수, 알림 };
}
function 셈쓰기(파일, 값) {
  try {
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    fs.writeFileSync(파일, JSON.stringify(값));
  } catch { /* 셈을 못 남겨도 이번 회차 결과는 그대로 */ }
}
function 상태읽기(파일) { try { return JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { return null; } }
function 상태쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 2));
  fs.renameSync(임시, 파일);
}

function 알림({ 환경 = process.env, 지금ms = Date.now(), 보내는일 = null, ...읽기옵션 } = {}) {
  const 파일 = 상태파일(환경);
  if (!파일) return { 결과: '모름', 이유: 'git 폴더를 못 찾았다' }; // 셀 곳도 없다 — .git 폴더도 git도 답이 없을 때뿐
  const 못읽음파일 = path.join(path.dirname(파일), '못읽음.json');
  const 지금 = 지금읽기({ 환경, 지금ms, ...읽기옵션 });
  if (지금.상태 === '모름') return { 결과: '모름', 이유: 지금.이유, 못읽음: 못읽음세기(못읽음파일, 지금.이유, { 환경, 보내는일, 지금ms }) }; // 상태는 안 바꾼다
  const 계획 = 알림계획(상태읽기(파일), 지금, 지금ms);
  // 다시 읽혔다 — 「멈췄다」를 보냈었으면(빚) 이 회차 글에 「다시 읽습니다」를 붙이고, 아니면 셈을 바로 지운다
  let 못읽음 = null;
  try { 못읽음 = JSON.parse(fs.readFileSync(못읽음파일, 'utf8')); } catch { 못읽음 = null; }
  if (못읽음 && !못읽음.빚) { fs.rmSync(못읽음파일, { force: true }); 못읽음 = null; }
  const 다시읽음 = 못읽음 ? `✅ 앱 예약 작업 감시가 다시 앱 기록을 읽습니다${못읽음.회수 ? `(${못읽음.회수}회 못 읽은 뒤)` : ''}.` : null;
  const 글 = [계획.글, 다시읽음].filter(Boolean).join('\n\n') || null;
  if (글) {
    const 보냄 = (보내는일 || require('./텔레그램승인.js').보내기)(글, 환경);
    if (!보냄.ok) {
      상태쓰기(파일, 계획.못보낸상태); // 알림 기록은 안 남겨 다음 회차에 다시 보낸다
      if (못읽음) 셈쓰기(못읽음파일, { ...못읽음, 회수: 0, 알림: false }); // 「내리」 셈은 끊고 빚만 남긴다 — 새 장애는 새로 센다
      return { 결과: '못 보냄', 이유: 보냄.error || '보내기 실패', 글 };
    }
  }
  상태쓰기(파일, 계획.새상태);
  if (못읽음) fs.rmSync(못읽음파일, { force: true });
  return { 결과: 글 ? '보냄' : '바뀐 것 없음', 글, 상태파일: 파일, 회차: 지금.회차들.length };
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

function main(argv = process.argv.slice(2)) {
  const 옵션 = new Set(argv);
  if (옵션.has('--알림')) {
    const r = 알림();
    console.log(`[${r.결과}]${r.이유 ? ` ${r.이유}` : ''}${r.글 ? `\n${r.글}` : ''}`);
    return r.결과 === '보냄' || r.결과 === '바뀐 것 없음' ? 0 : 1;
  }
  const r = 지금읽기();
  console.log(옵션.has('--json') ? JSON.stringify(r, null, 2) : 상태글(r));
  return r.상태 === '모름' || r.회차들.some((x) => 알릴종류.has(x.판정.종류)) ? 1 : 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { cron읽기, 예정들, 회차모으기, 회차판정, 지금읽기, 알림계획, 알림, 상태글, 텔레그램보냈나, 편목록, 실행기록읽기, 공용git폴더, 알릴종류 };
