#!/usr/bin/env node
// 인계문수거 — 주인이 끝난(죽은) 세션의 인계문을 git 이력에 거둔다 (F111)
//
// 왜 있나 (F111 · 2026-08-05 실측: docs/_ops/인계문/ 미추적 38건 + 추적-수정 2건):
//   세션별 인계문의 커밋은 「그 세션의 /close」에만 기대는데, 그 기대가 두 겹으로 빈다.
//   ① /close 자체가 인계문을 커밋(3단계) **뒤에** 쓴다(6단계) — 정상 종료조차 자기 인계문을
//      고아로 남긴다(목차 머리말의 「/close 때 커밋된다」는 약속만 있고 실행 단계가 없었다).
//   ② 세션이 /close 를 못 마치고 끝나면(창 강제 종료 · other) 영영 미추적이다.
//   미추적은 이력·stash·reflog 어디에도 없는 유일한 무보호 상태(F025)인데, 목차 재생성이
//   TTL 12시간 지난 세션 파일을 **지운다**(session-report.js writeHandoffFile ②).
//   즉 커밋이 곧 보호고, 12시간이 시한이다. 「주인 없는 파일을 누가 거두는가」의 답을
//   기계로 만든다: **주인이 죽은 것만, 그 폴더로 범위를 못박아** 거둔다.
//
// 남의 살아있는 작업본은 절대 안 거둔다(F073·F102) — 생존 판정은 작업본소유자와 **같은 판정
//   하나**를 쓴다(심장박동 SYNK_OWNER_ALIVE_MIN분 · 판정층을 둘로 만들면 갈라진다).
//   새는 방향 주의: 막 끝난 세션도 심장박동이 식을 때까지(기본 30분) 「살아있음」으로 보인다 —
//   그건 안전한 방향이라 그대로 둔다(다음 실행이 거둔다). 예외는 **내 세션 파일**(/close 6단계
//   직후의 자기 인계문) — 내 것을 내가 커밋하는 것은 수거가 아니라 제 몫이다.
//
// 범위는 CLI 로도 넓힐 수 없다: docs/_ops/인계문/ 폴더 + 파생 목차 docs/_ops/인계문.md 뿐.
//   목차는 세션 파일을 거둘 때만 동반한다(폴더에서 파생되는 파일이라 단독 커밋은 소음이다).
//   커밋 뒤 실제 실린 경로를 되읽어 범위 밖이 섞였으면 소리 내고 비정상 종료한다(결과 검사 —
//   가드는 「적용된 결과」를 검사한다).
//
// 쓰는 법
//   node tools/인계문수거.js          보고만 — 무엇을 거둘지 / 왜 보류인지
//   node tools/인계문수거.js --실행    커밋까지 (+ 내 세션 파일 — /close 6단계 자리)
//   node tools/인계문수거.js --hook   SessionStart 용 — 거둔 게 있을 때만 말한다(빈손이면 침묵)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 생존 판정·sid 표기는 작업본소유자 것을 그대로 쓴다 — ROOT 이음매(SYNK_OWNER_ROOT)도
// 그쪽과 같은 env 라 두 도구가 항상 같은 저장소·같은 심장박동을 본다.
const 소유자 = require(path.join(__dirname, '작업본소유자.js'));
const ROOT = process.env.SYNK_OWNER_ROOT || path.resolve(__dirname, '..');

const 폴더 = 'docs/_ops/인계문';   // git 경로 표기(슬래시) — status/pathspec 과 같은 꼴
const 목차 = 'docs/_ops/인계문.md';

function git(args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  return { ok: !r.error && r.status === 0, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

/** 커밋해도 되는 상태인가 — rebase·merge·bisect 중이거나 HEAD 가 분리돼 있으면 거른다.
 *  그때의 커밋은 남의 진행 중 작업에 끼어들거나(F035·F038) 붙을 가지가 없다. */
function 커밋못하는이유() {
  const d = git(['rev-parse', '--git-dir']);
  if (!d.ok) return 'git 을 못 불렀다';
  const g = path.resolve(ROOT, d.out.trim());
  for (const m of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG']) {
    if (fs.existsSync(path.join(g, m))) return `${m} — 진행 중인 git 작업이 있다`;
  }
  if (!git(['symbolic-ref', '-q', 'HEAD']).ok) return 'HEAD 분리 상태 — 커밋이 가지 없이 떠돈다';
  return null;
}

/** 인계문 자리의 미커밋을 주인별로 가른다. git 을 못 부르면 null(=모름 · 0건과 구별). */
function 조사() {
  const st = git(['status', '--porcelain', '-uall', '--', 폴더, 목차]);
  if (!st.ok) return null;
  const 씻기 = (l) => l.slice(3).split(' -> ').pop().replace(/^"(.*)"$/, '$1');
  const 항목 = st.out.split(/\r?\n/).filter(Boolean).map((l) => ({ xy: l.slice(0, 2), 경로: 씻기(l) }));

  const 세션 = 소유자.세션들();
  const 박동분 = new Map(세션.map((s) => [소유자.짧게(s.sid), s.분]));
  const 산 = new Set(세션.filter(소유자.살았나).map((s) => 소유자.짧게(s.sid)));
  // 파일명 sid8 은 session-report 가 쓰는 표기와 같은 변환(local_ 접두 제거 + 8자)이다.
  const 내sid8 = String(process.env.CLAUDE_CODE_HOST_SESSION_ID || '').replace(/^local_/, '').slice(0, 8);

  const r = { 수거: [], 내것: [], 보류: [], 잡파일: [], 목차더러움: false, 내sid8 };
  for (const it of 항목) {
    if (it.경로 === 목차) { r.목차더러움 = true; continue; }
    const m = /^([A-Za-z0-9_-]+)\.md$/.exec(it.경로.split('/').pop());
    if (!m) { r.잡파일.push(it); continue; }   // 세션 파일 꼴이 아니다 — 주인을 특정 못 하면 안 거둔다
    const sid8 = m[1];
    if (내sid8 && sid8 === 내sid8) r.내것.push(it);
    else if (산.has(sid8)) r.보류.push({ ...it, 분: 박동분.get(sid8) });
    else r.수거.push(it);
  }
  return r;
}

/** 거둘 것을 커밋한다. 성공 시 짧은 해시, 거둘 게 없으면 null. 실패는 {실패:사유}. */
function 실행(r) {
  const 파일들 = [...r.수거, ...r.내것].map((x) => x.경로);
  if (!파일들.length) return null;
  const 이유 = 커밋못하는이유();
  if (이유) return { 실패: 이유 };

  const 경로들 = r.목차더러움 ? [...파일들, 목차] : 파일들;
  // add 는 미추적을 알리는 절차일 뿐, 범위는 commit 의 pathspec 이 못박는다 —
  // 다른 세션이 스테이징에 무엇을 올려 뒀든 그건 이 커밋에 안 실린다.
  const add = git(['add', '--', ...경로들]);
  if (!add.ok) return { 실패: `git add 실패: ${add.err.trim() || '알 수 없음'}` };

  const sids = r.수거.map((x) => x.경로.split('/').pop().replace(/\.md$/, ''));
  const 제목 = `docs: 인계문 수거 — 죽은 세션 ${r.수거.length}건${r.내것.length ? ` + 내 세션 파일` : ''} (F111 통로)`;
  const 본문 = [
    sids.length ? `수거: ${sids.join(' ')}` : '',
    '근거: 심장박동 무소식 = 끝난 세션(작업본소유자와 같은 판정 하나). 미추적 인계문은',
    '목차 재생성 TTL 12h 가 지우면 이력·stash·reflog 어디에도 없어 영영 유실이다(F025·F111).',
  ].filter(Boolean).join('\n');
  const c = git(['commit', '-m', `${제목}\n\n${본문}`, '--', ...경로들]);
  if (!c.ok) return { 실패: `git commit 실패: ${(c.err || c.out).trim().split(/\r?\n/)[0] || '알 수 없음'}` };

  // 결과 검사 — 방금 커밋에 범위 밖 경로가 섞였으면 그 자리에서 소리 낸다(조용한 혼입 금지 · F104).
  const shown = git(['show', '--name-only', '--format=', 'HEAD']);
  const 실림 = shown.ok ? shown.out.split(/\r?\n/).filter(Boolean) : [];
  const 밖 = 실림.filter((p) => p !== 목차 && !p.startsWith(폴더 + '/'));
  if (밖.length) {
    process.stderr.write(`[인계문수거] 🔴 범위 밖 경로가 커밋에 실렸다 — 즉시 확인 필요: ${밖.join(', ')}\n`);
    process.exit(2);
  }
  const h = git(['rev-parse', '--short', 'HEAD']);
  return h.ok ? h.out.trim() : '(해시 조회 실패)';
}

function 보고(r, 모드) {
  const 줄 = [];
  if (모드 !== 'hook') {
    줄.push(`[인계문수거] ${폴더} — 수거 대상 ${r.수거.length}건 · 내 것 ${r.내것.length}건 · 보류(살아있는 세션) ${r.보류.length}건${r.잡파일.length ? ` · 잡파일 ${r.잡파일.length}건(안 거둠)` : ''}`);
    for (const x of r.수거) 줄.push(`   거둠 ${x.xy.trim() || '??'} ${x.경로}`);
    for (const x of r.보류) 줄.push(`   보류 ${x.경로} ← 심장박동 ${x.분}분 전(살아있다 — 안 거둔다)`);
    for (const x of r.잡파일) 줄.push(`   스킵 ${x.경로} — 세션 파일 꼴이 아니라 주인을 특정 못 한다`);
  }
  return 줄.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 모드 = argv.includes('--hook') ? 'hook' : argv.includes('--실행') ? '실행' : '보고';
  const r = 조사();
  if (r === null) {
    // 모름을 0건으로 접지 않는다 — 훅에서도 한 줄은 낸다(미실행과 통과가 같은 모양이면 안 된다).
    process.stdout.write('[인계문수거] git 을 못 불렀다 — 수거 여부를 판정 못 했다(0건 아님)\n');
    process.exit(0);
  }
  const 머리 = 보고(r, 모드);
  if (머리) process.stdout.write(머리 + '\n');

  if (모드 === '보고') {
    if (r.수거.length || r.내것.length) process.stdout.write(`   커밋하려면: node tools/인계문수거.js --실행\n`);
    process.exit(0);
  }
  const 결과 = 실행(r);
  if (결과 === null) {
    if (모드 === '실행') process.stdout.write('[인계문수거] 거둘 것이 없다 — 커밋 안 함\n');
    process.exit(0); // hook 모드 빈손은 침묵 — 잔소리하는 장치는 읽히지 않게 된다
  }
  if (결과.실패) {
    process.stdout.write(`[인계문수거] 거두지 못했다(${결과.실패}) — 미커밋 그대로, 다음 실행이 다시 시도한다\n`);
    process.exit(모드 === '실행' ? 2 : 0); // 명시 실행의 실패는 소리 내고, 훅은 다음 기회에 맡긴다
  }
  process.stdout.write(`[인계문수거] 죽은 세션 인계문 ${r.수거.length}건${r.내것.length ? ' + 내 세션 파일' : ''}을 커밋했다(${결과}) — F111 통로${r.보류.length ? ` · 보류 ${r.보류.length}건은 살아있는 세션 것이라 남겼다` : ''}\n`);
  process.exit(0);
}

module.exports = { 조사, 실행, 커밋못하는이유, 폴더, 목차 };
