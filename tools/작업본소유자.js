#!/usr/bin/env node
// 작업본소유자 — 「이 미커밋 변경은 누구 것인가」 (F073)
//
// 왜 있나:
//   세션 시작 시 `git status` 는 **두 가지를 같은 모양으로** 보여준다.
//     ⓐ 전 세션이 남기고 끝난 미완 → 이어받는 게 맞다
//     ⓑ 지금 살아서 돌고 있는 남의 작업본 → 손대면 사고다
//   F073 실사고: 보드의 「진행중」 줄을 ⓐ로 읽고 편집했는데 실제로는 ⓑ였고,
//   내 편집이 6분 뒤 남의 커밋에 그대로 실려 나갔다(uncommitted-swept-by-peer 의 반대 방향).
//   같은 트랙 병렬 3번째다(F070 가드 중복 · 크루카드 포크).
//
//   🔑 정보가 없었던 게 아니다 — **아무도 안 읽고 있었다.**
//      `track-collision` 훅이 세션마다 `track-<프로젝트>-<세션>.json` 에 만진 파일 목록을
//      이미 쌓고 있고, 그 파일의 mtime 이 곧 심장박동이다. 이 도구는 **읽는 쪽**이다.
//      (쓰는 쪽은 그 훅 소유다 — 여기서 다시 구현하지 않는다. 판정층을 둘로 만들면 갈라진다.)
//
// ⚠ 「모름」을 「안전」으로 바꾸지 않는다.
//    Edit·Write 를 안 거친 변경(Bash 스크립트·외부 앱·git 조작)은 만진 기록이 없다.
//    그건 ⓐ도 ⓑ도 아니라 **❔모름**이고, 그렇게 표시한다. 실측에서 14건 중 8건이 이랬다.
//
// 쓰는 법
//   node tools/작업본소유자.js          사람용 표
//   node tools/작업본소유자.js --hook   SessionStart 훅용 — 🔴가 있을 때만 말한다
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// SYNK_OWNER_ROOT = **보는 저장소**만 바꾸는 이음매(로직은 안 끈다 · SYNK_TRACK_ROOT 와 같은 패턴).
const ROOT = process.env.SYNK_OWNER_ROOT || path.resolve(__dirname, '..');
// ⚠ lib 는 ROOT 가 아니라 **이 파일 옆**에서 가져온다 — lib 은 이 저장소가 배포하는 것이고
//   ROOT 는 「어느 작업 트리를 보느냐」일 뿐이다. ROOT 기준으로 require 하면 픽스처마다
//   lib 사본을 깔아야 하고, 그건 곧 판정기가 갈라진다는 뜻이다.
const store = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));

/** 심장박동 유효 시간. 이보다 오래된 세션은 「끝난 것」으로 본다.
 *  짧게 잡으면 살아있는 세션을 죽었다고 해 사고가 나고(위험한 방향),
 *  길게 잡으면 끝난 세션을 살아있다고 해 조심하게 된다(안전한 방향). 그래서 넉넉히 잡는다. */
const 살아있음_분 = Number(process.env.SYNK_OWNER_ALIVE_MIN || 30);

function git(args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || '');
}

/** 미커밋 경로들. git 을 못 부르면 **null(=모름)** — 빈 배열(=없음)과 구별한다. */
function 미커밋들() {
  const out = git(['status', '--porcelain']);
  if (out === null) return null;
  return out.split(/\r?\n/).filter(Boolean).map((l) => {
    const p = l.slice(3);
    const 뒤 = p.split(' -> ').pop();               // 이름 바뀜: 새 경로가 지금 자리다
    return 뒤.replace(/^"(.*)"$/, '$1');
  });
}

/** 세션별 {sid, 분, touched}. track-collision 이 쌓아 둔 것을 읽기만 한다. */
function 세션들() {
  const dir = store.stateDir();
  const 접두 = `track-${store.projectKey(ROOT)}-`;
  let 목록;
  try { 목록 = fs.readdirSync(dir); } catch (_) { return []; }
  const now = Date.now();
  const 결과 = [];
  for (const f of 목록) {
    if (!f.startsWith(접두) || !f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    let j; let 분;
    try {
      분 = Math.round((now - fs.statSync(p).mtimeMs) / 60000);
      j = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) { continue; }
    결과.push({ sid: f.slice(접두.length, -5), 분, touched: Array.isArray(j.touched) ? j.touched : [] });
  }
  return 결과.sort((a, b) => a.분 - b.분);
}

const 판정 = { 내것: '내것', 남의살아있는: '남의살아있는', 끝난세션: '끝난세션', 모름: '모름' };

function 조사() {
  const 파일들 = 미커밋들();
  const ss = 세션들();
  const 나 = store.safeId(process.env.CLAUDE_CODE_HOST_SESSION_ID || '');
  if (파일들 === null) return { git못부름: true, 나, 항목: [], 세션수: ss.length };

  const 항목 = 파일들.map((f) => {
    const 주인 = ss.filter((s) => s.touched.includes(f));
    const 산주인 = 주인.filter((s) => s.분 <= 살아있음_분);
    if (나 && 산주인.some((s) => s.sid === 나)) return { 파일: f, 종류: 판정.내것, 주인: [] };
    const 남 = 산주인.filter((s) => s.sid !== 나);
    if (남.length) return { 파일: f, 종류: 판정.남의살아있는, 주인: 남 };
    if (주인.length) return { 파일: f, 종류: 판정.끝난세션, 주인 };
    return { 파일: f, 종류: 판정.모름, 주인: [] };
  });
  return { git못부름: false, 나, 항목, 세션수: ss.filter((s) => s.분 <= 살아있음_분).length };
}

const 짧게 = (s) => s.replace(/^local_/, '').slice(0, 8);

function 보고(r, { 훅 }) {
  if (r.git못부름) return 훅 ? '' : '[작업본소유자] git 을 못 불렀다 — 판정 불가(0건 아님).';
  const 위험 = r.항목.filter((i) => i.종류 === 판정.남의살아있는);
  const 모름 = r.항목.filter((i) => i.종류 === 판정.모름);
  const 유물 = r.항목.filter((i) => i.종류 === 판정.끝난세션);

  // 훅 모드: 🔴가 없으면 침묵한다. 잔소리하는 장치는 읽히지 않게 된다.
  if (훅 && !위험.length) return '';

  const 줄 = [];
  줄.push(`[작업본소유자] 미커밋 ${r.항목.length}건 · 살아있는 세션 ${r.세션수}개`);
  if (위험.length) {
    줄.push('', `🔴 살아있는 남의 작업본 ${위험.length}건 — **편집하지 않는다**(F073: 내 편집이 남의 커밋에 실려 나간다)`);
    for (const i of 위험) 줄.push(`   · ${i.파일}  ← ${i.주인.map((s) => `${짧게(s.sid)}·${s.분}분 전`).join(', ')}`);
  }
  if (유물.length) {
    줄.push('', `⚪ 끝난 세션이 남긴 것 ${유물.length}건 — 이어받아도 된다(미추적은 무보호 상태다 · F025)`);
    for (const i of 유물) 줄.push(`   · ${i.파일}  ← ${i.주인.map((s) => `${짧게(s.sid)}·${s.분}분 전`).join(', ')}`);
  }
  if (모름.length) {
    줄.push('', `❔ 주인 모름 ${모름.length}건 — Edit·Write 를 안 거친 변경(Bash·외부 앱·git)이라 기록이 없다.`);
    줄.push('   **모름은 안전이 아니다** — 만지기 전에 `git log --oneline -5` 와 보드로 확인한다.');
    for (const i of 모름) 줄.push(`   · ${i.파일}`);
  }
  return 줄.join('\n');
}

if (require.main === module) {
  const 훅 = process.argv.includes('--hook');
  const 글 = 보고(조사(), { 훅 });
  if (글) process.stdout.write(글 + '\n');
  process.exit(0);
}

module.exports = { 조사, 보고, 판정 };
