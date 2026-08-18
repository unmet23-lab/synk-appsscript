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
/* 잠금 판정은 **한 곳에서만** 산다 — 보드수거도 같은 통로를 부른다(같은 판정을 두 곳에 적으면 갈라진다). */
const 잠금lib = require(path.join(__dirname, 'lib', 'git잠금.js'));
/* master 직접 커밋을 그 자리에서 미는 통로 — `작업가지 --닫기` 와 **같은 파일**을 쓴다
 * (같은 판정을 두 곳에 적으면 갈라진다 · 사연은 tools/lib/master동기.js 머리말). */
const 동기 = require(path.join(__dirname, 'lib', 'master동기.js'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('../.claude/hooks/lib/board-id.js');
const ROOT = process.env.SYNK_OWNER_ROOT || path.resolve(__dirname, '..');

// 자리(폴더·목차)와 「이름→세션 지문」 변환도 그쪽 것 하나를 쓴다 — 여기 한 벌 더 적었더니
// 작업본소유자 쪽에는 그 변환이 아예 없었고, 그래서 산 세션의 인계문이 전부 ❔모름으로 떴다.
const 폴더 = 소유자.인계문폴더;
const 목차 = 소유자.인계문목차;

function git(args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  return { ok: !r.error && r.status === 0, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

/** HEAD 에 그 경로가 있나 — `git add` 가 빈손인 두 까닭(남이 선점 / 스테이징된 삭제)을
 *  가르는 유일한 자다. 자세한 갈래는 실행()의 add 루프 주석에 있다.
 *  묻는 통로를 `-- <pathspec>` 으로 맞춘 것은 의도다 — `HEAD:경로` 리비전 문법은 인자
 *  인코딩을 타는데, 이 저장소의 경로엔 한글이 있고 그 자리는 Windows 에서 갈린다.
 *  add 와 **같은 통로로 묻어야** 「add 는 못 찾았는데 여기선 찾았다」가 안 생긴다.
 *  출력 유무만 본다 — 경로 문자열 비교는 정규화(NFC/NFD)에서 또 갈린다. */
function HEAD에있나(p) {
  const r = git(['ls-tree', '--name-only', 'HEAD', '--', p]);
  return r.ok && r.out.trim() !== '';
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
  const 내sid8 = 보드id.보드지문();

  const r = { 수거: [], 만료: [], 내것: [], 보류: [], 잡파일: [], 목차더러움: false, 내sid8 };
  for (const it of 항목) {
    if (it.경로 === 목차) { r.목차더러움 = true; continue; }
    const sid8 = 소유자.인계문지문(it.경로);
    if (!sid8) { r.잡파일.push(it); continue; }   // 세션 파일 꼴이 아니다 — 주인을 특정 못 하면 안 거둔다
    /* 🔴 **삭제는 수거가 아니다**(F257). session-report 의 12h TTL 이 디스크에서 지운 자국이
     *   여기 `D` 로 올라오는데, 옛 판은 xy 를 안 보고 파일명만으로 갈라 그것까지 「수거」로 셌다.
     *   실물: 40f763e 제목 「3건」 = 실제 보호 1 + 만료 2 · 64d6b9b 「6건」 = 1 + 5.
     *   커밋 범위에는 그대로 넣는다 — 안 실으면 인계문 자리가 영영 더럽다(회귀가 못박는다).
     *   가르는 것은 **세는 이름**뿐이다: 「거뒀다」와 「지워진 것을 정리했다」는 반대 사건이고,
     *   합쳐 세면 커밋 목록이 「N건을 보호했다」로 읽힌다. */
    if (it.xy.includes('D')) { r.만료.push(it); continue; }
    if (내sid8 && sid8 === 내sid8) r.내것.push(it);
    else if (산.has(sid8)) r.보류.push({ ...it, 분: 박동분.get(sid8) });
    else r.수거.push(it);
  }
  return r;
}

/**
 * add 단계 — **한 번의 원자 add 가 기본**이고, 경로가 사라졌을 때만 경로별로 되돈다.
 *
 * 🔴 왜 원자가 먼저인가 (F111 계열 · 2026-08-18 실측): 옛 판은 **처음부터** 경로별로 돌았다.
 *   그래서 잠금(index.lock)이 루프 **도중에** 잡히면 앞쪽 몇 건은 이미 인덱스에 앉은 채
 *   실패로 빠져나가는데, 부르는 쪽 문장은 「미커밋 그대로」였다 — 맞는 얼굴로 틀린 값
 *   (CLAUDE.md 가드 맹점 ④). 08-18 세션 시작에서 실물로 났다: 만료 삭제 22건 중 **앞 6건만**
 *   스테이징된 알파벳 접두 절단이 남았고 보고문은 「그대로」라고 말했다.
 *   📏 실측으로 갈랐다 — `git add -- p1 p2 …` 는 **잠금**과 **경로 부재**에서 0건을 앉힌다
 *   (원자). 그래서 잠금 실패에서는 부분 적용이 **원리상** 안 생긴다.
 * ⚠ 그러나 「원자 add 는 언제나 0건」은 **거짓이다** — 무시 경로가 섞이면 나머지는 앉는다
 *   (같은 날 실측). 그 모양은 이 도구의 후보엔 안 온다(`status --porcelain` 이 무시 파일을
 *   애초에 안 낸다). 그래도 **0건이라고 단정하지 않고 재서 말한다** — `인덱스잔여()`.
 * 🔑 되돌리지(reset) 않는 이유: 방금 실패한 그 잠금을 reset 도 똑같이 필요로 한다.
 *   못 미더운 되돌리기를 더하는 대신, 남은 것을 **정확히 세어 보고**한다.
 *
 * @param {(args:string[])=>{ok:boolean,out:string,err:string}} git호출 git 통로(픽스처가 갈아끼운다)
 * @param {(p:string)=>boolean} HEAD확인 그 경로가 HEAD 에 있나(선점 ⓐ 와 스테이징된 삭제 ⓑ 를 가른다)
 * @returns {{사라짐:Set<string>, 실패?:string}}
 */
function add단계(git호출, HEAD확인, 후보) {
  const 사라짐 = new Set();
  if (!후보.length) return { 사라짐 };
  const 뭉치 = git호출(['add', '--', ...후보]);
  if (뭉치.ok) return { 사라짐 };                              // 정상 경로 — 경로별 루프는 아예 안 돈다
  if (!/did not match any files/.test(뭉치.err)) {
    return { 사라짐, 실패: `git add 실패: ${뭉치.err.trim() || '알 수 없음'}` };
  }

  // 여기부터가 옛 루프다 — 사라진 경로가 섞였을 때만 온다.
  // add 는 미추적을 알리는 절차일 뿐, 범위는 commit 의 pathspec 이 못박는다 —
  // 다른 세션이 스테이징에 무엇을 올려 뒀든 그건 이 커밋에 안 실린다.
  // 경로별로 도는 까닭: 조사() 스냅샷과 add 사이에 딴 세션의 수거가 같은 경로를 먼저 커밋하면
  // (동시 기동 · F071) 그 경로는 작업본에도 index 에도 없어 pathspec fatal 인데, 전량 원자 add 는
  // 그 하나로 아직 거둘 수 있는 나머지까지 0건으로 접는다(08-07 실측: 87d2dfa 가 선점한
  // ba86eeb2 하나에 시작 훅 수거가 통째로 죽었다). 사라진 경로는 이미 남의 커밋에 실려 있어
  // 건너뛰어도 잃는 내용이 없다 — 그 밖의 add 실패는 사라짐이 아니므로 전과 같이 전체를 접는다.
  //
  // ⚠ 단 `did not match any files` 는 **서로 다른 두 상태**를 같은 말로 뱉는다 — 안 가르면
  //   한쪽이 영영 안 거둬진다. 가르는 자는 하나: **HEAD 에 그 경로가 있나.**
  //   ⓐ 딴 세션이 이미 커밋했다 → HEAD 에도 없다 → 건너뛴다(위 문단의 원래 뜻).
  //   ⓑ 삭제가 **이미 스테이징**돼 있다 → 작업본에도 index 에도 없어 add 는 빈손인데
  //      **HEAD 에는 그대로 있다** → 아직 아무도 안 거뒀다. 여기서 건너뛰면 다음 실행도
  //      똑같이 건너뛰어 그 삭제는 공유 인덱스에 **영영** 남고, 모든 세션의 「미커밋 0」
  //      판독을 흐린다. add 없이도 commit 의 pathspec 이 그 삭제를 그대로 싣는다.
  //   08-15 실측: 만료 5건이 ⓑ 로 굳어 있었는데 도구는 「5건 전부 딴 세션이 먼저 거뒀다 —
  //   커밋 안 함(잃은 내용 없음)」고 **확신에 찬 얼굴로 거짓을** 말했다(지침 v9.2 맹점 ④:
  //   장치는 안 도는 쪽보다 「맞는 얼굴로 틀린 값」 쪽으로 더 자주 샌다). 손 커밋 4b5ffe00
  //   으로 실물을 풀었고, 도구가 다시는 못 놓치게 판별자를 여기 둔다.
  for (const p of 후보) {
    const a = git호출(['add', '--', p]);
    if (a.ok) continue;
    if (/did not match any files/.test(a.err)) {
      if (HEAD확인(p)) continue;        // ⓑ 스테이징된 삭제 — 아직 안 거뒀다. 범위에 그대로 둔다.
      사라짐.add(p); continue;           // ⓐ 남이 선점했다 — 잃는 내용이 없다.
    }
    return { 사라짐, 실패: `git add 실패: ${a.err.trim() || '알 수 없음'}` };
  }
  return { 사라짐 };
}

/** add 가 실패한 뒤 **인덱스에 실제로 남은** 내 후보의 수 — 추론이 아니라 관측이다.
 *  못 재면 null 을 준다(0 으로 접으면 「안 재봤다」가 「깨끗하다」와 같은 모양이 된다 · F207). */
function 인덱스잔여(git호출, 후보) {
  if (!후보.length) return 0;
  const r = git호출(['diff', '--cached', '--name-only', '--', ...후보]);
  return r.ok ? r.out.split(/\r?\n/).filter(Boolean).length : null;
}

/** 실패 보고의 잔여 문구 — **「미커밋 그대로」는 0건을 실제로 쟀을 때만 쓴다.**
 *  🔴 08-18 실물: 이 자리가 늘 「그대로」라고 말했고, 그때 인덱스엔 앞 6건이 앉아 있었다.
 *  못 잰 것(null)을 0 으로 접지 않는다 — 미실행과 통과가 같은 모양이면 안 된다(F207). */
function 잔여문구(잔여) {
  if (잔여 === null || 잔여 === undefined) return '인덱스 잔여는 못 쟀다(0건이라는 뜻이 아니다)';
  if (!잔여) return '미커밋 그대로';
  return `인덱스에 ${잔여}건이 스테이징된 채다(작업본 내용은 그대로 · 다음 실행이 그 위에 이어 붙인다)`;
}

/** 거둘 것을 커밋한다. 성공 시 짧은 해시, 거둘 게 없으면 null. 실패는 {실패:사유, 잔여:수|null}. */
function 실행(r) {
  r.만료 = r.만료 || [];   // 조사() 밖에서 만든 r 도 받는다(테스트 헬퍼·옛 호출부)
  if (!r.수거.length && !r.만료.length && !r.내것.length) return null;
  const 이유 = 커밋못하는이유();
  if (이유) return { 실패: 이유 };

  const 후보 = [...r.수거, ...r.만료, ...r.내것].map((x) => x.경로).concat(r.목차더러움 ? [목차] : []);
  const 단계 = add단계(git, HEAD에있나, 후보);
  if (단계.실패) return { 실패: 단계.실패, 잔여: 인덱스잔여(git, 후보) };
  const 사라짐 = 단계.사라짐;
  r.수거 = r.수거.filter((x) => !사라짐.has(x.경로));
  r.만료 = r.만료.filter((x) => !사라짐.has(x.경로));
  r.내것 = r.내것.filter((x) => !사라짐.has(x.경로));
  r.사라짐 = 사라짐.size;
  const 파일들 = [...r.수거, ...r.만료, ...r.내것].map((x) => x.경로);
  if (!파일들.length) return null; // 전부 딴 세션이 먼저 거뒀다 — 빈손과 같다(내용은 다 이력에 있다)

  const 경로들 = r.목차더러움 && !사라짐.has(목차) ? [...파일들, 목차] : 파일들;

  const 이름들 = (xs) => xs.map((x) => x.경로.split('/').pop().replace(/\.md$/, ''));
  const sids = 이름들(r.수거);
  const 만료sids = 이름들(r.만료);
  /* 제목은 **두 수를 따로** 든다(F257). 합쳐 세면 「N건을 보호했다」로 읽히는데 그 중 일부는
   * 보호가 아니라 TTL 이 지운 것의 정리다 — 이력을 되짚는 사람이 반대로 읽는다. */
  const 제목 = `docs: 인계문 수거 — 죽은 세션 ${r.수거.length}건${r.만료.length ? ` · 만료 정리 ${r.만료.length}건` : ''}${r.내것.length ? ` + 내 세션 파일` : ''} (F111 통로)`;
  const 본문 = [
    sids.length ? `수거: ${sids.join(' ')}` : '',
    만료sids.length ? `만료 정리(TTL 12h 가 이미 지운 자국 — 내용은 삭제 이전 이력에 있다): ${만료sids.join(' ')}` : '',
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
    줄.push(`[인계문수거] ${폴더} — 수거 대상 ${r.수거.length}건${r.만료.length ? ` · 만료 정리 ${r.만료.length}건` : ''} · 내 것 ${r.내것.length}건 · 보류(살아있는 세션) ${r.보류.length}건${r.잡파일.length ? ` · 잡파일 ${r.잡파일.length}건(안 거둠)` : ''}`);
    for (const x of r.수거) 줄.push(`   거둠 ${x.xy.trim() || '??'} ${x.경로}`);
    for (const x of r.만료) 줄.push(`   만료 ${x.xy.trim()} ${x.경로} — TTL 이 이미 지웠다(보호가 아니라 정리다)`);
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
    if (r.수거.length || r.만료.length || r.내것.length) process.stdout.write(`   커밋하려면: node tools/인계문수거.js --실행\n`);
    process.exit(0);
  }
  const 결과 = 실행(r);
  if (결과 === null) {
    if (모드 === '실행') process.stdout.write(r.사라짐
      ? `[인계문수거] ${r.사라짐}건 전부 딴 세션이 먼저 거뒀다 — 커밋 안 함(잃은 내용 없음)\n`
      : '[인계문수거] 거둘 것이 없다 — 커밋 안 함\n');
    process.exit(0); // hook 모드 빈손은 침묵 — 잔소리하는 장치는 읽히지 않게 된다
  }
  if (결과.실패) {
    /* 「다음 실행이 다시 시도한다」는 **경합일 때만** 참이다 — 고아 잠금이면 그 재시도가
     * 영영 안 통한다(F493 실측: 9시간 8분 · 그 창의 커밋 0건). 가르는 자는 잠금의 나이 하나다. */
    const 잠금 = 잠금lib.고아잠금줄(ROOT, { 실패문: 결과.실패 });
    process.stdout.write(`[인계문수거] 거두지 못했다(${결과.실패}) — ${잔여문구(결과.잔여)}, 다음 실행이 다시 시도한다\n${잠금 ? 잠금 + '\n' : ''}`);
    process.exit(모드 === '실행' ? 2 : 0); // 명시 실행의 실패는 소리 내고, 훅은 다음 기회에 맡긴다
  }
  process.stdout.write(`[인계문수거] 죽은 세션 인계문 ${r.수거.length}건${r.만료.length ? ` + 만료 정리 ${r.만료.length}건(TTL 이 이미 지운 것 — 보호 아님)` : ''}${r.내것.length ? ' + 내 세션 파일' : ''}을 커밋했다(${결과}) — F111 통로${r.보류.length ? ` · 보류 ${r.보류.length}건은 살아있는 세션 것이라 남겼다` : ''}${r.사라짐 ? ` · ${r.사라짐}건은 딴 세션이 먼저 거둬 건너뜀` : ''}\n`);

  /* 커밋과 push 는 한 벌이다 — 이 도구는 master 에 **직접** 커밋하므로, 안 밀면 그 커밋은
   * 이 노트북에만 있다. 실측 2026-08-17: 그렇게 좌초된 수거 커밋이 8건 쌓여 master 가
   * 갈라졌고(5앞/57뒤), 그때부터 push 자체가 non-fast-forward 로 거절됐다.
   * 여기서 미는 것이 그 상태를 애초에 안 만든다 — 커밋이 났을 때만 도니 빈손 세션엔 왕복 0회다. */
  process.stdout.write(동기.줄내기('인계문수거', 동기.밀기(ROOT)) + '\n');
  process.exit(0);
}

module.exports = { 조사, 실행, add단계, 인덱스잔여, 잔여문구, 커밋못하는이유, 폴더, 목차 };
