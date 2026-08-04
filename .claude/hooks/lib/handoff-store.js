// handoff-store — 세션 인계 바통의 **유일한 통로** (context-budget · session-end-handoff · session-handoff 공용)
//
// 왜 모아 뒀나 — 바통을 쓰는 곳이 셋(Stop·SessionEnd)이고 읽는 곳이 하나(SessionStart)다.
//   파일명 규칙·프로젝트 격리·청소가 각 훅에 흩어지면 **한 곳만 고쳐도 조용히 갈라진다**.
//   CLAUDE.md 「3번째 = 원인을 쓸 수 없게 만든다 — 호출부마다 고치는 대신 잘못 쓸 수 없는
//   공용 통로를 만든다」의 적용. 여기 말고 다른 데서 바통 경로를 조립하면 안 된다.
//
// 08-04 실측된 결함 3종이 이 파일의 존재 이유다:
//   ① 바통이 **전역 1개**라 마지막에 쓴 세션이 이겼다 — 🔴에 닿은 세션이 셋인 날,
//      내 인계문이 「구글폼 접수」 트랙 것으로 덮였다. → 세션별 파일로 가른다.
//   ② **프로젝트 격리가 없었다** — tmp 폴더 하나를 모든 저장소가 공유했다.
//      다른 저장소 세션의 인계문을 물면 새 세션이 엉뚱한 트랙을 이어간다. → cwd 키로 가른다.
//   ③ **청소가 없었다** — 상태 파일이 하루 5개씩 영구히 쌓였다. → 읽을 때마다 쓸어낸다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// 이음매는 테스트 격리 전용 — 로직을 끄지 않고 위치만 바꾼다. **세 훅이 같은 이름을 봐야 한다**
// (갈라지면 바통이 안 넘어가고, 증상은 「조용히 아무 일도 안 일어남」이라 눈에 안 띈다).
const STATE_DIR = process.env.SYNK_CTXBUDGET_DIR || path.join(os.tmpdir(), 'synk-context-budget');

const BATON_TTL_MS = 12 * 60 * 60 * 1000; // 인계문: 12시간 넘으면 트랙이 이미 바뀌었다고 본다
const SWEEP_TTL_MS = 24 * 60 * 60 * 1000; // 카운터 등 잡파일: 하루 지나면 지운다

/** cwd → 짧고 안정적인 프로젝트 키. 경로를 그대로 파일명에 쓸 수 없어 해시로 줄인다.
 *
 * ⚠ **구분자를 먼저 통일한다.** 2026-08-04 실측: 같은 저장소인데 `C:/Users/...`(슬래시)와
 *   `C:\Users\...`(백슬래시)가 **서로 다른 키**를 내 상태가 조용히 둘로 갈렸다
 *   (`cec367f48f` vs `de787defcb`). 대소문자·끝슬래시는 이미 지웠는데 구분자만 남아 있었다.
 *   증상은 「아무 일도 안 일어남」이라 눈에 안 띈다 — 이 파일이 존재하는 이유 ②(프로젝트 격리)와
 *   같은 함정의 다른 입구다. 호출부가 `path.resolve` 를 쓰든 리터럴을 쓰든 같은 키여야 한다. */
function projectKey(cwd) {
  const norm = String(cwd || '').replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 10);
}

function safeId(id) {
  return String(id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
}

function batonName(cwd, sessionId) {
  return `handoff-${projectKey(cwd)}-${safeId(sessionId)}.json`;
}

function stateDir() { return STATE_DIR; }

/** 세션별 단계 카운터(발화 중복 억제용). 프로젝트 키를 붙여 저장소 간 간섭을 막는다. */
function stagePath(cwd, sessionId) {
  return path.join(STATE_DIR, `stage-${projectKey(cwd)}-${safeId(sessionId)}.json`);
}

function readStage(cwd, sessionId) {
  try {
    const j = JSON.parse(fs.readFileSync(stagePath(cwd, sessionId), 'utf8'));
    if (!j.at || Date.now() - j.at > SWEEP_TTL_MS) return 0;
    return Number(j.stage) || 0;
  } catch (_) { return 0; }
}

function writeStage(cwd, sessionId, stage) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(stagePath(cwd, sessionId), JSON.stringify({ stage, at: Date.now(), cwd: String(cwd || '') }));
    return true;
  } catch (_) { return false; }
}

/** 오래된 파일을 지운다. 읽기·쓰기 어느 쪽에서 불러도 되게 **조용히 실패**한다. */
function sweep() {
  let removed = 0;
  let files;
  try { files = fs.readdirSync(STATE_DIR); } catch (_) { return 0; }
  for (const f of files) {
    const p = path.join(STATE_DIR, f);
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      // 옛 형식은 나이와 무관하게 버린다 — 전역 `handoff.json`(트랙이 섞이던 그 파일)과
      // 프로젝트 키 없는 `<세션uuid>.json` 카운터. 남기면 24시간 동안 오해의 소지가 된다.
      if (f === 'handoff.json' || /^[0-9a-fA-F-]{36}\.json$/.test(f)) {
        fs.unlinkSync(p); removed += 1; continue;
      }
      const ttl = f.startsWith('handoff-') ? BATON_TTL_MS : SWEEP_TTL_MS;
      if (!j.at || Date.now() - Number(j.at) > ttl) { fs.unlinkSync(p); removed += 1; }
    } catch (_) {
      // 파싱조차 안 되는 파일은 옛 형식(전역 handoff.json 등)이거나 쓰다 만 것 — 지운다
      try { fs.unlinkSync(p); removed += 1; } catch (__) { /* 못 지워도 진행 */ }
    }
  }
  return removed;
}

/** 바통을 떨군다. 같은 세션이 여러 번 떨구면 **마지막 것이 그 세션의 바통**이다(덮어쓰기). */
function drop(cwd, sessionId, message, meta) {
  if (!String(message || '').trim()) return false;
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(STATE_DIR, batonName(cwd, sessionId)),
      JSON.stringify({ at: Date.now(), cwd: String(cwd || ''), sessionId: String(sessionId || ''), message: String(message), ...(meta || {}) })
    );
    return true;
  } catch (_) { return false; }
}

/**
 * **이 프로젝트**의 바통 중 가장 최근 것을 집어 오고, 집은 것은 지운다(일회용).
 * 다른 프로젝트 바통은 건드리지 않는다 — 남의 저장소 세션이 이어받으면 안 된다.
 * 같은 프로젝트의 더 오래된 바통들도 함께 지운다: 안 지우면 그 다음 세션이 옛것을 문다.
 */
function take(cwd) {
  sweep();
  const prefix = `handoff-${projectKey(cwd)}-`;
  let files;
  try { files = fs.readdirSync(STATE_DIR).filter((f) => f.startsWith(prefix)); } catch (_) { return null; }
  if (!files.length) return null;

  const found = [];
  for (const f of files) {
    const p = path.join(STATE_DIR, f);
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && Number(j.at) && Date.now() - Number(j.at) <= BATON_TTL_MS) found.push({ p, j });
      else fs.unlinkSync(p);
    } catch (_) { try { fs.unlinkSync(p); } catch (__) { /* 진행 */ } }
  }
  if (!found.length) return null;

  found.sort((a, b) => Number(b.j.at) - Number(a.j.at));
  const winner = found[0];
  // 집은 것도, 뒤처진 것도 전부 지운다 — 남기면 다음 세션이 또 문다
  for (const { p } of found) { try { fs.unlinkSync(p); } catch (_) { /* 진행 */ } }
  return { ...winner.j, alsoDropped: found.length - 1 };
}

/* safeId 도 내보낸다 — track-collision 이 같은 STATE_DIR 에 세션별 파일을 쓴다.
 * 파일명 규칙을 그쪽에서 다시 적으면 sweep() 이 못 알아보는 이름이 생기고, 증상은
 * 「조용히 안 지워짐」이라 눈에 안 띈다(이 파일이 존재하는 이유 ③과 같은 함정). */
module.exports = { stateDir, projectKey, safeId, batonName, stagePath, readStage, writeStage, sweep, drop, take, BATON_TTL_MS, SWEEP_TTL_MS };
