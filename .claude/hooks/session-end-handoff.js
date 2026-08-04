#!/usr/bin/env node
// session-end-handoff — 세션이 끝날 때 인계 바통을 떨군다 (SessionEnd 훅)
//
// 왜 있나 (08-04 실측 결함 ④) — 인계가 **🔴(150k) 도달 시에만** 걸려 있었다.
//   그런데 대부분의 세션은 임계에 안 닿고 끝난다. 즉 자동 인계가 **평상시엔 아예 안 돌았다**.
//   유호님 요구("자동화가 되어야해")의 핵심이 여기다: 유호님은 그냥 창을 닫고 새로 열 뿐이고,
//   그 전환마다 다음 세션이 직전 작업을 알고 시작해야 한다.
//
// 아무 세션에서나 떨구지는 않는다 — **일한 세션만**:
//   ① 이 세션 이름으로 된 커밋이 있거나 ② 미커밋이 남았거나 ③ 임계(🟡)를 넘겼거나.
//   질문 한 번 하고 끝난 세션까지 바통을 남기면, 다음 세션이 「이어서 작업한다」를 물고
//   시작해 엉뚱한 일을 한다. 인계문은 **다음 세션의 컨텍스트에 실리는 비용**이기도 하다.
//
// ⚠ SessionEnd 는 **1.5초 예산**을 공유한다(공식 문서). 그래서 여기서 하는 일은
//   git 두 번 + 파일 쓰기 하나뿐이다. 무거운 걸 넣으면 조용히 잘린다.
// ⚠ 창을 강제로 닫으면 이 훅이 못 돌 수 있다. 그래서 context-budget(Stop)이 🔴에서
//   미리 바통을 떨궈 둔다 — **두 겹인 게 설계다**(같은 세션이면 나중 것이 덮어쓴다).
'use strict';
const fs = require('fs');
const path = require('path');
const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
const report = require(path.join(__dirname, 'lib', 'session-report.js'));

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { /* 입력 없이도 진행 */ }

const cwd = input.cwd || process.cwd();
const sid = input.session_id;
const reason = String(input.reason || input.matcher || '');

// `resume`·`compact` 는 세션이 **끝난 게 아니라 이어지는** 것이다 — 인계문을 남기면 중복이 된다.
if (reason === 'resume' || reason === 'compact') process.exit(0);

store.sweep(); // 종료 시점은 청소하기 좋은 자리다(다음 세션 읽기가 빨라진다)

const dirty = report.dirtyCount(cwd);
const commits = report.myCommits(cwd, report.hostSessionId(sid));
const stage = store.readStage(cwd, sid); // 🟡 이상을 넘겼으면 1 이상

// 「일한 세션」 판정. 셋 다 아니면 조용히 나간다.
const worked = commits.length > 0 || (dirty !== null && dirty > 0) || stage > 0;
if (!worked) process.exit(0);

const msg = report.buildHandoff(cwd, sid, { dirty, reason: reason || undefined });
store.drop(cwd, sid, msg, { trigger: `session-end:${reason || 'other'}` });

// SessionEnd 의 출력은 유호님 화면에 스치듯 지나간다 — 짧게 한 줄만.
process.stdout.write(JSON.stringify({
  systemMessage: `↪ 인계 바통을 남겼다(커밋 ${commits.length}건${dirty === null ? '' : ` · 미커밋 ${dirty}건`}). 새 세션에서 자동으로 이어진다.`,
}));
process.exit(0);
