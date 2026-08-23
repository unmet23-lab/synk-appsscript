#!/usr/bin/env node
// rot-check — 「조용한 부패」를 주기적으로 한 번에 훑는다.
//
// 왜 있나 (2026-08-03 루프 진단): 하네스에 **트리거 층이 통째로 없었다.**
// 훅 4종은 전부 PreToolUse = 내 행동을 **막는 게이트**지, 무언가를 **띄우는 트리거**가 아니다.
// 그래서 도구는 만들어졌는데 아무도 돌리지 않았다 — 실측 두 개가 그 증거였다:
//   · 마찰 신호가 3건 쌓였다(지침의 /evolve 발동 조건은 2건). 세는 도구는 있는데 아무도 안 봤다.
//   · 급여 정본이 v1.3인데 파생 3종이 v1.1 수치를 인용 중이었다. 엣지는 멀쩡히 붙어 있었다.
// 공통점: 실패가 **에러가 아니라 침묵**으로 나타난다. 침묵은 아무도 안 읽으면 영원히 침묵이다.
//
// 설계 판정 — 루프 담론은 "cron으로 에이전트를 상시 돌려라"라고 하지만 여기선 틀린 처방이다.
//   ① 이 하네스는 상주 프로세스가 없다(세션이 켜질 때만 존재한다). 세션 밖 cron은 읽는 사람이 없다.
//   ② 유호님 병목은 「일감 발견」이 아니라 **「결정 대기」**다. 일감을 더 찾아내는 루프는 큐에 기름을 붓는다.
// → 그래서 트리거는 **SessionStart + 주기 스로틀**이고, 산출은 **새 일감이 아니라 부패와 결정 순위**다.
//
// 정지 조건은 무르지 않다 — 검사 결과가 0건이면 **아무것도 출력하지 않는다**.
// ("코드를 개선하라"는 정지 조건이 될 수 없지만 "깨진 링크 0건"은 된다.)
//
// 사용법:
//   node tools/rot-check.js            전체 리포트(0건이어도 「부패 없음」 한 줄은 찍는다)
//   node tools/rot-check.js --quiet    0건이면 완전 침묵 (사람이 손으로 돌릴 때)
//   node tools/rot-check.js --json     기계 판독용
//   node tools/rot-check.js --hook     SessionStart 훅 모드(스로틀 + additionalContext)
//   node tools/rot-check.js --hook --force   스로틀 무시(테스트·수동 확인용)
//   SYNK_ROT_INTERVAL_DAYS=7  주기(기본 7일) · SYNK_ROT_STATE=<경로>  상태 파일 위치
//   SYNK_ROT_LIVE=0           라이브 대조를 끈다(≈15초 pull). 끄면 「초록」이 아니라 **미측정**으로 낸다.
//                             `collect()` 를 직접 부르면 기본이 꺼짐이다 — 회귀·CI 가 네트워크를 안 타야 하므로.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INTERVAL_DAYS = 7;
const 배포_주기_일 = 1;        // 라이브 드리프트만 하루 (F244 — 왜인지는 `배포Section` 머리말)
const 장부_주기_일 = 0.25;     // 회차 장부는 6시간 (조용한 실패 장부 ④-㉡ — `장부Section` 머리말)
const 배포_대조_한도 = 20000;  // 프로젝트당 clasp pull 상한(실측 8.5s) — 훅 예산 60초 안에서 끝나야 한다
const stateFile = () =>
  process.env.SYNK_ROT_STATE || path.join(ROOT, '.claude', 'state', 'rot-check.json');

/* ── 수집 ────────────────────────────────────────────────────────────────── */
// 각 검사는 **독립적으로** 실패할 수 있어야 한다. 하나가 터져서 나머지가 통째로 침묵하면
// 「부패 없음」과 「검사기가 죽었음」이 또 똑같이 생긴다 — 이 도구가 고치려는 바로 그 병이다.
function attempt(name, fn) {
  try {
    return { name, ok: true, value: fn() };
  } catch (e) {
    return { name, ok: false, error: (e && e.message) || String(e) };
  }
}

function memorySection() {
  const M = require('./memory-graph.js');
  const dir = M.memoryDir();
  const nodes = M.load(dir);
  if (!nodes) throw new Error(`메모리 디렉터리를 못 찾음: ${dir}`);
  const d = M.diagnose(nodes);
  const dec = M.decisions(nodes);

  // 그래프 밖의 결정 부채 — 본문에 ⏳는 있는데 [[막힘>…]] 엣지가 없는 토픽.
  // 이게 왜 중요한가: 결정 큐 위상정렬은 **엣지로만** 순위를 매긴다. 글로만 있는 ⏳는
  // 큐에 아예 안 잡히므로, 「차단자 2개」가 「대기 2건」을 뜻한다고 오해하게 만든다.
  const unwired = [];
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    let text = '';
    try { text = fs.readFileSync(n.full, 'utf8'); } catch (_) { continue; }
    if (!text.includes('⏳')) continue;
    if (n.links.some((l) => l.type === '막힘')) continue;
    unwired.push(n.slug);
  }

  const totalLinks = [...nodes.values()].reduce((a, n) => a + n.links.length, 0);
  const typed = [...nodes.values()]
    .reduce((a, n) => a + n.links.filter((l) => l.type !== '관련').length, 0);

  return { dir, count: nodes.size - 1, totalLinks, typed, diagnose: d, decisions: dec, unwired };
}

function docSection() {
  const D = require('./doc-graph.js');
  const g = D.build();
  if (!g.docs.size) throw new Error('문서를 하나도 못 읽었다 — SKIP 규칙이 docs를 통째로 걸렀을 수 있다');
  return {
    docs: g.docs.size,
    broken: g.broken,
    stale: g.stale,
    staleHeld: g.staleHeld,
    canonUnknown: g.canonUnknown,
    unversioned: g.unversioned.length,
    mapGaps: g.mapGaps,
  };
}

/* 지침의 마지막 개정 날짜 — 개정 제안 문턱(마찰 2건)의 **기준점**이다.
 * 지침은 「굵직한 마찰 신호 2건이면 개정을 제안한다」고 하는데, 그 2건은 **새로 난** 둘이지
 * 누적 열림 둘이 아니다. 기준점 없이 누적을 세면 40건이 쌓인 지금 알림이 영구히 켜지고,
 * 켜져 있는 알림은 안 읽힌다(F386 · F370 과 같은 병). 날짜는 기계가 정확히 안다. */
function 마지막개정(파일) {
  let 최대 = null;
  const p = 파일 || path.join(ROOT, 'docs', '지침_이력.md');
  try {
    const text = fs.readFileSync(p, 'utf8');
    for (const m of text.matchAll(/^##\s+v[\d.]+[^\n]*?(\d{4}-\d{2}-\d{2})/gm)) {
      if (!최대 || m[1] > 최대) 최대 = m[1];
    }
  } catch (_) { /* 이력이 없으면 정본만으로 판정한다 */ }

  /* 정본 자신의 머리도 본다 — 08-22 실측: v10.0 개편(08-19)이 이력에 «등재만» 안 됐는데,
   * 그 하나로 기준점이 08-13 에 얼어붙어 그 뒤 마찰 14건이 전부 「새로 난 것」으로 세졌고
   * 매 세션 「지침 개정 제안 조건 도달」이 떴다. 개편을 해도 시스템은 개편 전으로 안다 —
   * 유호님이 「개편이 체감 안 된다」고 하신 자리의 기계적 뿌리다.
   * 이력 등재는 사람이 잊지만 정본은 자기 개정일을 머리에 이고 다닌다(둘 중 늦은 쪽을 쓴다). */
  try {
    const 머리 = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8').slice(0, 600);
    const m = 머리.match(/v[\d.]+\s*·\s*(\d{4}-\d{2}-\d{2})/);
    if (m && (!최대 || m[1] > 최대)) 최대 = m[1];
  } catch (_) { /* 정본이 없으면 이력 값만 쓴다 */ }

  return 최대;
}

function frictionSection() {
  const F = require('./friction.js');
  /* 정본은 조각 폴더다 — 옛 단일 아카이브(마찰신호.md)는 압축 08-20 은퇴. 그 파일을 요구하면
   * 장부 26벌이 멀쩡히 있는데도 영구 「검사기 고장」이 된다(실측 08-20 — 이 줄이 그랬다). */
  if (!fs.existsSync(F.FOLDER)) throw new Error(`장부가 없다: ${F.FOLDER}`);
  const { rows } = F.read();
  /* 판정 술어는 friction.js 하나에서 온다 — 여기서 `!r.resolved` 를 다시 적으면 보류가
   * 「열림」으로 새고, 새는 방향은 언제나 「통과」가 아니라 여기선 «영구 알림»이다. */
  const open = rows.filter(F.열렸나);
  const 기준 = 마지막개정();
  return {
    open,
    보류: rows.filter(F.보류인가),
    total: rows.length,
    기준,
    /* 새로 난 것 = 마지막 개정 뒤에 신고된 열림 행. 기준점을 못 읽으면 전량으로 되돌린다
     * (모름을 「0건」으로 접지 않는다 — 그건 미실행을 통과로 세는 것이다 · F207). */
    새로: 기준 ? open.filter((r) => (r.date || '') > 기준) : open,
    묵은: 기준 ? open.filter((r) => (r.date || '') <= 기준) : [],
  };
}

/* 재질의 금지 — 유호님이 이미 답한 주제가 **메모리**에 대기로 되살아나지 않았나 (F126 · F389).
 * 왜 여기인가: 이 검사의 실물(메모리 폴더)은 repo 밖이라 CI 에도, CI 를 모사하는 배포 게이트에도
 * 없다. F389 실측 — 게이트가 실 HOME 으로 스위트를 돌던 시절 이 검사가 **게이트에서만** 켜져
 * 남의 배포를 막았고, 정작 그 줄을 적은 세션은 자기 test-ci 가 초록(skip)이라 볼 통로가 없었다.
 * 그래서 발동 자리를 옮겼다: 실물이 있는 기계에서 · 고칠 수 있는 사람(이 기계의 세션)에게 ·
 * 배포를 막지 않는 층(warn)으로. repo 안(보드·docs)·형제 실물은 스위트가 계속 지고,
 * 탐지력은 픽스처가 진다 — 판정은 lib/재질의금지.js **한 벌**이다(사본 금지). */
function 재질의Section() {
  const 금지 = require('./lib/재질의금지.js');
  const M = require('./memory-graph.js');
  const dir = M.memoryDir();
  if (!dir || !fs.existsSync(dir)) {
    // 메모리 없는 기계(CI·폰·새 기계)는 실물이 없다 — 위반도 없고, 탐지력은 픽스처 몫이다.
    return { 측정: false, 사유: '메모리 폴더 없음: ' + (dir || '(경로 미해석)') };
  }
  return { 측정: true, 위반: 금지.폴더검사(dir, 'memory') };
}

/* 절단문서(소급불가 정본)는 **다른 저장소의 커밋으로 닫힌다.** 항목을 실제로 끝내는 코드는
 * 거의 전부 형제(SYNK-talk)에 있고, 닫은 세션은 보드·메모리를 갱신하면서 이 문서는 자주 빠뜨린다.
 * 실측 2026-08-08: 문서 마지막 갱신 `be34610`(08-07 15:57) 뒤 `58eaf68`(21:25)이 ①-2·①-12 를
 * 닫았는데 진행표는 5시간 반 동안 둘 다 「남음」으로 들고 있었다. 그 문서는 「지금 안 모으면 영원히
 * 잃는 것」의 정본이라, 낡으면 없는 지도보다 나쁘다 — 여는 사람에게 **확신에 찬 오답**을 준다.
 *
 * 🔑 표와 본문이 **함께** 낡아서 문서 안을 아무리 대조해도 안 잡힌다 — 재료가 문서 밖에 있다.
 *   (그래서 「진행표 ↔ 본문」 일관성 검사는 짓지 않았다. 오늘의 낡음에 안 울리는 장치다.)
 * 왜 CI 가 아니라 주간 점검인가: 재료가 **git 이력 + 형제 저장소**라 CI 에는 원리상 없다
 *   (CLAUDE.md 「repo 밖 환경에 기대는 검사는 CI 에서 깨진다」). 탐지력은 픽스처가 진다
 *   (`tests/절단문서.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)`). 못 재면 **미측정**으로 낸다 — 통과와 미실행이 같은 모양이면
 *   이 도구가 고치려는 바로 그 병이다. */
// git pathspec 과 fs 경로에 같은 문자열을 쓴다. (`path.join` 으로 바꿔 역슬래시로 만들어도 이 기계의
// git 은 그대로 받는다 — 변이로 확인했다. 그러니 「역슬래시면 깨진다」고 적지 않는다.)
const 절단문서 = 'docs/_ops/심문_P0_소급불가_절단.md';
const 항목표기 = /[①②]-\d+|절단문서/;

function git(뿌리, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: 뿌리, encoding: 'utf8', timeout: 10000, windowsHide: true });
  return (r.error || r.status !== 0) ? null : String(r.stdout || '');
}

/** 그 시각 **뒤에** 난 커밋만. `--since` 는 경계를 포함하고 git 시각은 초 단위라, 1초 밀지 않으면
 *  문서를 담은 그 커밋과 **같은 초**의 형제 커밋이 「뒤」로 딸려 들어온다(F062 계열 · 회귀가 잠근다).
 *  ⚠ 아래 구분자는 제어문자 0x1F 다 — 커밋 제목엔 한글·`|`·`·` 가 흔해 보이는 문자를 못 쓴다. */
function 뒤커밋들(뿌리, 시각) {
  const o = git(뿌리, ['log', `--since=@${시각 + 1}`, '--format=%h%x1f%s']);
  if (o === null) return [];
  return o.split('\n').filter(Boolean).map((l) => {
    const [해시, 제목] = l.split('\u001f');
    return { 해시, 제목: 제목 || '' };
  });
}

function 절단문서Section(뿌리 = ROOT) {
  if (!fs.existsSync(path.join(뿌리, 절단문서))) return { present: false }; // 없는 것은 부패가 아니다
  const o = git(뿌리, ['log', '-1', '--format=%ct', '--', 절단문서]);
  const 갱신 = o === null ? NaN : Number(String(o).trim());
  if (!Number.isFinite(갱신) || 갱신 <= 0) {
    return { present: true, 측정: false, 사유: '문서의 마지막 커밋 시각을 못 읽었다(아직 미커밋이거나 git 이 없다)' };
  }

  // 형제 좌표는 여기서 다시 적지 않는다 — 갈라지면 「형제 없음 = 조용」 쪽으로 샌다(맹점 ④).
  const store = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
  const 형제들 = store.siblings(뿌리);
  if (!형제들.length) return { present: true, 측정: false, 사유: '형제 저장소가 없다 — 이 문서를 닫는 커밋은 거기서 난다' };

  const 뒤 = [];
  for (const { 뿌리: 형제, 저장소 } of 형제들) {
    for (const c of 뒤커밋들(형제, 갱신)) if (항목표기.test(c.제목)) 뒤.push({ 저장소, ...c });
  }
  return { present: true, 측정: true, 갱신, 뒤 };
}

function harnessSection() {
  // 이식 폴더(바탕화면 SYNK_하네스)는 머리말에 정본 버전을 박아 「스스로 낡음을 말하는」 생성물이지만,
  // 여는 사람이 없으면 그 고백도 침묵이다 — 실측: v6.12 개정 당일, 폴더는 v6.11인 채로 하루를 보냈다(08-03).
  // 폴더가 없으면 부패가 아니다(아직 안 꺼낸 것) — 「없음」과 「낡음」을 같은 모양으로 만들지 않는다.
  const H = require('./harness-export.js'); // require는 생성기를 실행하지 않는다 — 경로·정본 버전만 얻는다
  const dir = process.env.SYNK_HARNESS_OUT || H.DEFAULT_OUT;
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) return { present: false, canonical: H.VER };
  const m = fs.readFileSync(readme, 'utf8').match(/지침 \*\*(v[\d.]+)/);
  const stamp = m ? m[1] : null;
  return { present: true, canonical: H.VER, stamp, stale: !stamp || stamp !== H.VER };
}

function 바탕화면Section() {
  /* 유호님이 실제로 여는 화면은 저장소가 아니라 **바탕화면 두 폴더**다(「SYNK 방향」·「SYNK 자산」).
   * 거기 링크가 무덤(`docs/_archive`)이나 죽은 자리를 가리키면 저장소가 아무리 최신이어도
   * 유호님 눈에는 영원히 옛판만 온다 — 그리고 그 실패는 에러가 아니라 **침묵**이다.
   *
   * 실측 08-24: 「오프라인 신규 등록서」 바로가기가 08-04 판 `_archive` PDF 를 가리킨 채
   *   `--지금상태` 표에서 «✅ 낡을 수 없다»로 스무 날을 서 있었다(바로가기이기만 하면 초록이었다).
   *   잡아낸 것은 그물이 아니라 유호님이었다 — 「왜 새 로고가 반영이 안 되지」.
   *
   * 판정을 여기 다시 적지 않는다 — `운영자료.js --지금상태` 를 부르고 **결과만** 읽는다.
   * 두 곳에 적으면 한쪽만 고치는 날 판정이 갈린다(가드 맹점 ④). 곁들여 이 호출은
   * `_지금상태.html` 을 다시 굽는다 = 유호님 화면도 같이 최신이 된다(부작용이 아니라 목적).
   * 바탕화면이 없는 기계(CI·다른 노트북)면 부패가 아니라 **없음**이다. */
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', '운영자료.js'), '--지금상태'],
    { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (r.error || r.status !== 0) {
    return { present: false, 사유: r.error ? String(r.error.message) : `종료코드 ${r.status}` };
  }
  const out = String(r.stdout || '');
  const 요약 = out.match(/🔴\s*(\d+)\s*·/);
  if (!요약) return { present: false, 사유: '바탕화면 폴더를 못 찾았다(요약줄 없음)' };
  /* 요약줄(「🔴 1 · ❔ 7 …」)이 아니라 «항목» 줄만 걷는다.
   * ⚠「가운뎃점이 있으면 요약」으로 가르지 말 것 — 이 폴더의 이름들이 바로 그 모양이다
   *   (「급여·인센티브 정본」·「사업·운영」). 요약은 **숫자가 먼저 오는 것**으로만 가른다. */
  const 줄 = out.split('\n').map((x) => x.trim())
    .filter((x) => x.startsWith('🔴') && !/^🔴\s*\d+\s*·/.test(x))
    .map((x) => x.replace(/^🔴\s*/, ''));
  return { present: true, 건수: Number(요약[1]), 줄 };
}

function 배포Section(라이브, 시간제한) {
  /* 「커밋은 했는데 `clasp push` 를 안 했다」 — 루트(유호님이 매일 쓰는 라이브 학원 시스템)는
   * @HEAD 를 서빙해서 배포 설명에 심는 **지문이 원리상 안 선다**(배포판점검 머리말). 그래서
   * `deploy-freshness` 훅은 루트에 영원히 침묵하고, `/deploy` 를 안 부른 커밋의 드리프트는
   * 아무 층에서도 안 보인다 — **스킬은 불러야 적용된다.** 여기서 라이브를 받아 바이트로 잰다.
   * 왜 여기만 **하루**인가(F244): 저장소 쪽 부패는 느리게 생기지만 라이브 드리프트는 소급 불가
   *   데이터가 걸린 하루짜리 손실이고, 네트워크 0 층(`안나간변경`)이 이 형태를 **원리상 못 잰다**
   *   — 기준선으로 쓰는 마지막 `[vN]` 커밋 자신이 push 안 된 판이면 기준선이 통째로 거짓이다.
   *   실측 2026-08-08: 루트 8.5s + crewcard 3.9s = 12.4초. 하루 1회면 무시할 만하다.
   * 왜 `/deploy` 안이 아닌가: /deploy 는 끝에 push 를 하므로 재는 순간 답이 늘 「같음」이다.
   * 🔴 라이브를 안 재는 호출(테스트·CI·`SYNK_ROT_LIVE=0`)은 **초록이 아니라 미측정**으로 낸다. */
  const D = require('./배포판점검.js');
  if (!라이브) return { 측정: false, 결과: [] };
  const 미커밋 = D.미커밋집합();
  return {
    측정: true,
    결과: D.claspProjects().map((p) => {
      const r = D.점검(p, ROOT, { 라이브: true, 시간제한 });
      /* 잰 값을 **아래 층에 물려준다**(F244 후속 · 2026-08-10): 네트워크 0 층 `안나간변경()` 은
       * `[vN]` 기준선이 양방향으로 틀려 매 SessionStart 마다 거짓 🔴 를 낼 수 있는데, 여기서
       * 실제로 잰 「초록 + 그때의 배포집합 지문」을 남겨 두면 그 층이 자기 거짓양성을 재운다.
       * 지문을 같이 남기는 이유는 배포판점검 `라이브도장` 머리말 — 시각만으로는 거짓음성이 된다. */
      /* `라이브판` 도 같이 남긴다(F474) — 아래 층의 기준선이 「마지막 채번 커밋」 하나뿐이라,
       * 채번 «뒤»에 배포가 끊기면 기준선이 페이로드 자신이 되어 그 층이 0건을 낸다. 여기가 라이브를
       * **실제로 재는 유일한 자리**이므로, 「라이브가 서 있는 판」을 아는 것도 여기뿐이다. */
      const 실측 = { 지문: (() => { try { return D.지문(p, ROOT); } catch (_) { return null; } })(), 초록: r.level === 'ok' && r.측정 === true, 라이브판: r.라이브판 || null };
      return r.level === 'stale' ? { ...r, 실측, 편집중: 편집중인가(r.파일들, p, 미커밋) } : { ...r, 실측 };
    }),
  };
}

/* 🔴 라이브대조는 **작업본**을 잰다(clasp 가 미는 것이 작업본이라서다). 그래서 옆 세션이 배포집합
 * 파일을 고치는 중이면 라이브와 다른 게 **정상**인데, 그걸 「push 가 빠졌다」로 내면 이 알림은
 * 하루에 한 번 거짓말을 하고 거짓말하는 가드는 곧 무시당한다(F113). 주간일 땐 드물어 안 보였고
 * 하루로 당기는 순간 흔해진다 — 실측 2026-08-08: 남이 12:44 에 고친 `Code.js`·`엔진_운영배치.js`
 * 두 파일이 12:51 대조에서 그대로 🔴 로 나왔다. 가르는 재료는 git 이 이미 준다.
 * (미커밋을 재는 통로는 배포판점검.미커밋집합 하나다 — 여기 사본이 있었는데 F310 트랙이 합쳤다.) */
function 편집중인가(파일들, projRoot, 미커밋) {
  if (!미커밋 || !파일들 || !파일들.length) return false;
  const 앞 = path.relative(ROOT, projRoot).replace(/\\/g, '/');
  // **전부** 미커밋일 때만 보류다 — 하나라도 깨끗하면 그건 진짜 안 나간 것이다
  return 파일들.every((f) => 미커밋.has(앞 ? `${앞}/${f}` : f));
}

/* 🔗 형제(`SYNK-talk`)의 «회차 장부» — cron 이 무엇을 냈나 (조용한 실패 장부 ④-㉡).
 *
 * ■ 왜 여기인가 — 장부 자신이 「부르면 답할 뿐」이라 **아무도 안 부르면 조용하다**(④ 종결 시점의
 *   남은 칸). 실측 08-15: radio 잡이 `url` NULL 로 **16회 전부** 죽었는데 15시간 아무도 몰랐다.
 *   새 훅을 세우지 않고 이 도구에 축 하나로 얹은 이유는 셋이다 —
 *     ① 이 도구엔 **키별 스로틀이 이미 있다**(F244). 6시간에 한 번만 네트워크를 쓴다.
 *     ② 세션 시작에서 먼저 말하는 자리가 이미 이것이다(장치를 안 늘린다 · 경량 원칙).
 *     ③ `작업본소유자 --hook` 은 **지금 다른 세션이 비용을 깎는 중**이라(#Q95) 얹으면 안 된다.
 *
 * ⚠ **판정은 형제 소유다** — 여기서 요약·대조를 다시 계산하지 않고 `판정`·`안적힘`·`이상` 을
 *   옮기기만 한다(`형제배포빚` 과 같은 규칙 · 같은 판정을 두 곳에 적으면 갈라진다).
 * ⚠ **종료 코드로 갈래를 정하지 않는다** — 그쪽 1·2 는 고장이 아니라 판정이다. 갈라내는 재료는
 *   stdout 의 JSON 유무 하나뿐이다. `status!==0` 을 「못 잼」으로 읽으면 진짜 적색이 통째로 사라진다.
 * ⚠ 도구가 없으면 **모름이 아니라 «해당 없음»** 이다(그냥 건너뛴다) — 형제 없는 클론·CI 에서
 *   영구 경보가 되고, 따를 수 없는 경보는 통로를 끈다(F103·F296).
 *
 * 비용 실측(2026-08-15 · 판 미적용 상태 = HTTP 1회): 828ms. 판이 서면 2회라 ~1.7초로 본다.
 *   6시간 스로틀이라 세션 시작 평균 비용은 그 1/N 이다. */
const 장부_시간제한 = 10000;
/* 그쪽(`회차장부.js --json`)이 낼 수 있는 «판정» 전부. 0=이상 없음 · 1=이상 있음 · 2=판을 못 봤다.
 * 🔑 목록으로 두는 이유는 아래 문에서 **모르는 값을 닫기** 위해서다 — 그쪽이 상태를 늘리면
 *   여기부터 열어야 하고, 안 열면 그 상태는 「못 잼」으로 드러난다(조용한 통과가 아니라).
 * 🔴 08-24 까지 0 이 빠져 있었다 — 장부가 «건강해지는 순간» 다리가 «못 잼»을 내는 결함인데,
 *   다리가 태어난 뒤 리허설 장부가 건강했던 적이 없어서(잔존 cron 침묵 9일) 한 번도 안 튀었다.
 *   리허설 잔존을 걷어 처음으로 판정 0 이 나온 날 그 자리에서 드러났다. */
const 아는판정 = new Set([0, 1, 2]);

function 장부Section(잰다, 형제들) {
  if (!잰다) return { 측정: false, 사유: '차례 아님' };
  let 목록 = 형제들;   // 픽스처가 주입하는 자리 — 탐지력은 실저장소가 아니라 픽스처가 진다(F296)
  if (!목록) {
    try { 목록 = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js')).siblings(ROOT); } catch (_) { return { 측정: false, 사유: '형제 목록을 못 읽었다' }; }
  }
  const 결과 = [];
  for (const { 뿌리, 저장소 } of 목록) {
    const 도구 = path.join(뿌리, 'tools', '회차장부.js');
    if (!fs.existsSync(도구)) continue;                       // 해당 없음 — 0건도 모름도 아니다
    /* 과녁 둘 — 기본(.env = 리허설)과 운영(08-24). 리허설만 보던 9일 동안 운영 장부는 reader 0
     * 이었고, 그 사이 운영 대조 뷰의 영구 오탐(ops-harvest 288/일)도 아무에게도 안 보였다.
     * ref 는 그쪽 정본(lib/자격증명.js)에서 읽는다 — 여기 박아 두면 두 정본이 된다. */
    const 과녁들 = [{ 이름: '', env: undefined }];
    try {
      const { 운영REF } = require(path.join(뿌리, 'lib', '자격증명.js'));
      if (운영REF) 과녁들.push({ 이름: '운영', env: { ...process.env, SUPABASE_PROJECT_REF: 운영REF } });
    } catch (e) {
      결과.push({ 저장소, 과녁이름: '운영', 못잼: true,
        사유: `운영 ref 를 못 읽었다(lib/자격증명.js): ${String((e && e.message) || e).slice(0, 80)}` });
    }
    for (const 과 of 과녁들) {
    const r = spawnSync(process.execPath, [도구, '--json'], {
      cwd: 뿌리, encoding: 'utf8', timeout: 장부_시간제한, windowsHide: true, env: 과.env,
    });
    /* 마지막 줄만 읽는다 — 그쪽이 stdout 을 JSON 한 줄로 지키지만, 옛 체크아웃(`--json` 을 모르는
     * 판)은 **사람글**을 낸다. 그때 `JSON.parse` 가 던지고 아래가 «못 잼»으로 받는다 — 그게 옳다. */
    const 줄 = String(r.stdout || '').trim().split('\n').filter(Boolean).pop();
    let o = null;
    try { o = 줄 ? JSON.parse(줄) : null; } catch (_) { o = null; }
    /* 모양 검사를 따로 두는 이유는 `형제배포빚` 머리말 ⓑ 와 같다 — 파싱을 통과하는 «다른 모양»은
     * 아래에서 `판정 === 2` 도 `=== 1` 도 아니라 **조용히 통과**한다. 여기가 유일한 문이다.
     * 🔴 그래서 «값 집합»까지 닫는다 — `typeof number` 만 보면 이 문은 열린 채였다(①배포 검수 P1):
     *   `판정:99` 가 여기를 지나면 `장부판정` 은 1·2 만 보므로 적색도 메모도 안 내고, 훅은
     *   `측정:true` 를 받아 도장을 찍는다 ⇒ **모르는 상태 하나가 6시간 창을 통째로 재운다.**
     *   모르는 값은 「통과」가 아니라 「못 잼」이다 — 새 상태가 생기면 `아는판정` 부터 연다. */
    const 모르는판정 = !!o && typeof o.판정 === 'number' && !아는판정.has(o.판정);
    if (!o || typeof o.판정 !== 'number' || 모르는판정) {
      const 사유 = r.error ? String(r.error.message || r.error).slice(0, 120)
        : 모르는판정 ? `모르는 판정 ${o.판정} — 아는 값은 ${[...아는판정].join('·')} 뿐이다(그쪽이 상태를 늘렸으면 rot-check 의 \`아는판정\` 을 연다)`
          : `stdout 에 판정이 없다(exit ${r.status})`;
      결과.push({ 저장소, 과녁이름: 과.이름, 못잼: true, 사유 });
      continue;
    }
    결과.push({ 저장소, 과녁이름: 과.이름, 판정: o.판정, 판: o.판, 과녁: o.과녁 || null, 안적힘: Number(o.안적힘) || 0, 이상: Number(o.이상) || 0, 사유: o.사유 || null, 최근이상: Array.isArray(o.최근이상) ? o.최근이상 : [] });
    }
  }
  return { 측정: true, 결과, 섰던적: !!상태().장부섰나 };
}

function geminilmSection() {
  // 하네스 폴더와 결정적으로 다른 점: 제미나이LM 묶음은 **올린 뒤 손이 닿지 않는다.**
  // 자료는 구글 계정 안으로 복사돼 버려서, 저장소가 아무리 바뀌어도 그쪽은 그대로다.
  // 즉 「스스로 낡음을 말하는」 배너조차 올라간 사본에는 만든 날짜로 굳어 있다 —
  // 낡음을 알려야 할 상대는 폴더가 아니라 **올린 사람**이다. 그래서 주간 점검이 진다.
  const N = require('./geminilm-export.js'); // require는 생성기를 실행하지 않는다
  const dir = process.env.SYNK_GEMINILM_OUT || N.DEFAULT_OUT;
  const readme = path.join(dir, 'README_먼저읽기.md');
  if (!fs.existsSync(readme)) return { present: false }; // 아직 안 쓰는 것 = 부패 아님
  const madeAt = fs.statSync(readme).mtimeMs;
  // 앵커는 굵기표시(**)를 건너뛰고 날짜만 본다 — 문구 앵커는 문구가 바뀌면 죽고,
  // 죽어도 경고는 그대로 떠서 「(날짜 미검출)」이라는 쓸모없는 값으로 조용히 낡는다.
  // 생성기와 이 앵커가 어긋나는지는 tests/노트북LM묶음.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)가 왕복으로 검사한다.
  const m = fs.readFileSync(readme, 'utf8').match(/만든 날\s*\**\s*(\d{4}-\d{2}-\d{2})/);
  const changed = [];
  for (const { root } of N.SOURCE_ROOTS) {
    for (const f of N.walk(root)) {
      if (fs.statSync(f).mtimeMs > madeAt) changed.push(path.basename(f));
    }
  }
  return { present: true, made: m ? m[1] : '(날짜 미검출)', changed };
}

function geminilmDriveSection() {
  /* 제미나이LM **자동 갱신** 배선(예약 작업 SYNK_GeminiLM · 구 SYNK_NotebookLM)의 감시.
   *
   * 왜 필요한가 — 자동화를 붙이면 「안 도는 것」이 「아무 일도 안 일어남」으로 나타난다.
   * 드라이브가 꺼져 있거나 크롬이 실패하면 생성기는 정직하게 멈추고 로그만 남기는데,
   * **그 로그를 아무도 안 연다.** 장치를 만들고 발동 조건을 안 만든 형태(F026)의 재발이라
   * 여기서 읽는다 — 「자동이니까 되겠지」가 정확히 조용한 실패의 모양이다.
   *
   * 로그가 없으면 부패가 아니다(아직 한 번도 안 돌았거나 이 기계가 아니다). */
  const log = path.join(__dirname, 'geminilm-drive.log');
  if (!fs.existsSync(log)) return { present: false };
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter((l) => /\bOK\b|FAILED/.test(l));
  if (!lines.length) return { present: true, unknown: true };
  const last = lines[lines.length - 1];
  const failed = /FAILED/.test(last);
  const 마지막성공 = [...lines].reverse().find((l) => /\bOK\b/.test(l)) || null;
  // 로그 줄머리 = `%date% %time%` (예: 2026-08-04 12:24:57.19)
  const 날짜 = (s) => (s && s.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  const 성공일 = 날짜(마지막성공);
  const 지난날 = 성공일 ? Math.floor((Date.now() - new Date(성공일 + 'T00:00:00').getTime()) / 86400000) : null;
  /* 「왜 실패했나」와 **「지금 고칠 수 있나」는 다른 질문이다.** 로그만 읽으면 앞의 것만 안다.
   * F318 실측: 처방(`node tools/geminilm-drive.js`)을 그대로 따라 돌렸다가 같은 자리에서
   * 막혔다 — 마운트가 없으면 그 도구는 정지하도록 설계돼 있고, 마운트를 켜는 건 유호님
   * 몫이라 세션이 몇 번을 돌려도 안 된다. 그래서 지금 상태를 같이 재서 처방을 가른다.
   * 판정은 생성기의 것을 그대로 부른다(사본을 만들면 드라이브 문자 목록이 갈라진다). */
  let 마운트 = null;
  try { 마운트 = !!require('./geminilm-drive.js').findDriveRoot(); } catch (_) { 마운트 = null; }
  return { present: true, failed, last, 성공일, 지난날, 마운트 };
}

function mapSection() {
  /* 바탕화면 SYNK_지도 폴더 — 유호님이 실제로 여는 사본이 repo 정본과 갈라졌는지.
   * 도구(tools/지도대장.js)는 e27a93a 로 들어왔는데 **발화 지점이 0**이었다(「장치와
   * 발동 조건은 같은 커밋에서」 미충족 · 커밋 메시지에 미완성으로 명시). 여기가 그 발동
   * 조건이다 — 주간 점검이 돌 때마다 같이 잰다(2026-08-04).
   * 폴더가 없으면 부패가 아니라 미실행이다(CI·클라우드·다른 기계). */
  const M = require('./지도대장.js');
  const 결과 = M.훑기();
  if (!결과.있음) return { present: false, dir: 결과.dir };
  const 문제지도 = 결과.지도들.filter((m) => m.문제.length);
  return {
    present: true,
    지도수: 결과.지도들.length,
    문제수: 문제지도.reduce((a, m) => a + m.문제.length, 0),
    지도들: 문제지도.map((m) => ({ 이름: m.이름, 첫문제: (m.문제[0] || '').split('\n')[0] })),
  };
}

function toilSection() {
  /* 손일 장부(docs/_ops/손일장부.md(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다))가 자라고 있는지.
   *
   * 다른 섹션과 성격이 다르다 — 여기서 썩는 것은 파일이 아니라 **기억**이다.
   * 손일을 없애는 순간 「그게 얼마나 자주·몇 분이었나」를 잴 마지막 기회가 지나가고,
   * 그 뒤에는 아무도 되살릴 수 없다(소급 불가). 그래서 검사 대상은 「낡았나」가 아니라
   * **「기입 통로가 아직 도는가」**다.
   *
   * ⚠ 매 릴리스가 손일을 없애는 것은 아니므로 임계를 날짜로 둔다 — 버전 수로 재면
   *   개원 전처럼 릴리스가 잦은 구간에서 경고가 노이즈가 되고, 노이즈가 되면 꺼진다.
   * 장부가 없거나 한 줄도 없으면 부패가 아니다(아직 안 쓰는 것). */
  const T = require('./toil.js');
  if (!fs.existsSync(T.ledgerPath())) return { present: false };
  const { rows } = T.read();
  const idle = T.daysSinceLast(rows);
  const limit = Number(process.env.SYNK_TOIL_IDLE_DAYS || 30);
  return { present: true, count: rows.length, idle, limit, stale: idle !== null && idle >= limit };
}

/* ── 판정 ────────────────────────────────────────────────────────────────── */
// 🔴 = 무언가가 이미 거짓을 말하고 있다(고치기 전엔 그래프·문서가 거짓말한다)
// ⚠  = 아직 거짓은 아니지만 방치하면 🔴이 된다
const EVOLVE_THRESHOLD = 2; // 지침: 마찰 신호 2건이면 지침 개정을 **제안**한다(/evolve 스킬은 08-20 은퇴 · 문턱은 산다)

function collect({ 라이브 = false, 시간제한, 장부: 장부잰다 = false } = {}) {
  const mem = attempt('memory', memorySection);
  const doc = attempt('doc', docSection);
  const fri = attempt('friction', frictionSection);
  const har = attempt('harness', harnessSection);
  const nbl = attempt('geminilm', geminilmSection);
  const nbd = attempt('geminilm-drive', geminilmDriveSection);
  const toi = attempt('toil', toilSection);
  const map = attempt('지도', mapSection);
  const 절단 = attempt('절단문서', () => 절단문서Section());
  const dep = attempt('배포판', () => 배포Section(라이브, 시간제한));
  const 재질 = attempt('재질의금지', 재질의Section);
  const 장부 = attempt('회차장부', () => 장부Section(장부잰다));
  const 바탕 = attempt('바탕화면', 바탕화면Section);

  const red = [];
  const warn = [];
  const notes = [];

  for (const s of [mem, doc, fri, har, nbl, nbd, toi, map, 절단, dep, 재질, 장부, 바탕]) {
    // `배포:true`·`장부:true` = 각자 스로틀로 따로 도는 항목(F244). 문구가 아니라 이 표식으로
    // 고른다 — 앵커는 문구가 바뀌면 죽고, 죽으면 그 절만 조용히 리포트에서 빠진다.
    if (!s.ok) red.push({ kind: '검사기 고장', text: `${s.name} 검사가 실패했다 — ${s.error}`, 배포: s === dep, 장부: s === 장부 });
  }

  if (절단.ok && 절단.value.present) {
    const v = 절단.value;
    // 못 잰 것은 「부패 없음」이 아니다 — 침묵시키지 않고 메모로 드러낸다(라이브 미측정과 같은 원칙).
    if (!v.측정) notes.push({ kind: '소급불가 정본 미측정', text: `${절단문서} — ${v.사유}` });
    else if (v.뒤.length) {
      const 보임 = v.뒤.slice(0, 4).map((c) => `${c.저장소} ${c.해시} ${c.제목.slice(0, 44)}`);
      // 자른 것은 숫자로 밝힌다 — 조용한 절단은 「이게 전부」로 읽힌다.
      if (v.뒤.length > 보임.length) 보임.push(`외 ${v.뒤.length - 보임.length}건`);
      warn.push({
        kind: '소급불가 정본 낡음 의심',
        text: `${절단문서} 가 마지막으로 담긴 뒤 형제에서 ①②항목을 말한 커밋 ${v.뒤.length}건 — `
          + `${보임.join(' / ')} · 진행표(§진행)를 그 커밋들과 대조한다`,
      });
    }
  }

  if (재질.ok && 재질.value.측정) {
    for (const v of 재질.value.위반) {
      warn.push({
        kind: '재질의 위반(메모리)',
        text: `${v} — 유호님이 이미 답한 주제가 대기 표식을 달고 있다(F126). 그 줄에 ✅/🚫재질의 를 붙이거나 낡은 대기를 지운다`,
      });
    }
  }
  // 재질.측정=false 는 메모조차 아니다 — 메모리 없는 기계(CI·폰)가 정상인 자리라(절단문서 present:false 와 같은 축),
  // 거기서 소음을 내면 진짜 위반 경보까지 같이 꺼진다. 탐지력은 픽스처가 진다.

  if (dep.ok && dep.value.측정) {
    for (const r of dep.value.결과) {
      // 보류는 **경고가 아니라 메모**다 — 남이 손대는 중인 것을 내가 배포할 수는 없다(F073).
      if (r.level === 'stale' && r.편집중) {
        notes.push({
          kind: '라이브 대조 보류',
          text: `${r.이름}: 배포집합 ${r.파일들.join('·')} 이 지금 미커밋이라 라이브와 달라 보인다 — 커밋된 뒤 다시 잰다`,
          배포: true,
        });
      } else if (r.level === 'stale') red.push({ kind: '라이브 낡음', text: r.lines.join('\n      '), 배포: true });
      else if (r.level === 'unknown') warn.push({ kind: '배포 판정 불가', text: r.lines[0], 배포: true });
      // 확인 불가는 **경고가 아니라 메모**다 — 폰·CI엔 자격증명이 없고, 그건 부패가 아니다.
      // 단 침묵시키지도 않는다: 통과와 미실행이 같은 모양이면 이 도구의 존재 이유가 사라진다.
      else if (r.level === 'unreachable') notes.push({ kind: '라이브 미측정', text: r.lines.join(' / '), 배포: true });
    }
  }

  if (mem.ok) {
    const d = mem.value.diagnose;
    for (const b of d.broken) red.push({ kind: '깨진 링크', text: `${b.from} --${b.type}> ${b.target}` });
    for (const g of d.ghostInIndex) red.push({ kind: '인덱스 유령', text: `MEMORY.md가 없는 파일을 가리킨다: ${g}` });
    for (const u of d.unknown) warn.push({ kind: '미지 링크 타입', text: `${u.from}: ${u.type}>${u.target}` });
    /* 「인덱스 누락」·「고아 노드」 검사는 08-20 은퇴 — 옛 규약(토픽 전수를 MEMORY.md 에 등재)의
     * 검사다. 새 규약(08-20 압축: 인덱스는 핵심만 · 토픽 356벌은 이름으로 연다)에서 인덱스 밖은
     * 정상이라, 이 두 경고는 매 실행 «정상을 소음으로» 냈다(실측: 누락 12 · 전부 의도된 비등재).
     * ghostInIndex(인덱스가 죽은 파일을 가리킴)는 남는다 — 그건 새 규약에서도 진짜 부패다. */
  }

  if (doc.ok) {
    for (const b of doc.value.broken) red.push({ kind: '깨진 참조', text: `${b.from} → ${b.target}` });
    for (const s of doc.value.stale) {
      red.push({ kind: '낡은 인용', text: `${s.from} — ${path.basename(s.target)} 인용 ${s.cited} → 현재 ${s.now}` });
    }
    for (const c of doc.value.canonUnknown) {
      warn.push({ kind: '정본 버전 미상', text: `${c.target}(${c.from}이 ${c.cited} 인용)` });
    }
    // 색인 밖 문서는 **한 줄로** 올린다 — 12건이 각자 한 줄을 먹으면 warn 렌더 상한(12)을
    // 통째로 차지해 다른 신호를 밀어낸다. 전량은 도구가 갖고 있다.
    const mg = doc.value.mapGaps;
    if (mg.noMap) {
      red.push({ kind: '지도 실종', text: 'docs/문서_지도.md 가 없다 — 색인이 통째로 사라졌다' });
    } else if (mg.missing.length) {
      const 앞 = mg.missing.slice(0, 3).map((m) => path.basename(m)).join('·');
      warn.push({
        kind: '지도 누락',
        text: `${mg.missing.length}종이 문서_지도.md 색인 밖 — ${앞}${mg.missing.length > 3 ? ' 외' : ''}` +
          ' · 색인이 갈라지면 정본 지목이 두 갈래가 된다(08-07 실측) · 전량: node tools/doc-graph.js',
      });
    }
  }

  if (바탕.ok && 바탕.value.present && 바탕.value.건수 > 0) {
    // 빨강이다 — 유호님이 **지금 눈으로 보는** 물건이 틀렸다는 뜻이라 「나중에」가 없다.
    red.push({
      kind: '바탕화면 빨강 — 유호님 화면이 틀렸다',
      text: `${바탕.value.건수}건 — ${바탕.value.줄.join(' / ') || '(항목 줄 미검출)'}` +
        '\n      수리: 「무덤」이면 링크를 정본으로 돌리고(`docs/_archive` 를 가리키면 안 된다),' +
        '\n            「멈췄다」면 그 산출물을 만드는 배선부터 본다(예약 작업이 부르는 도구가 지워졌을 수 있다).' +
        '\n            표 = node tools/운영자료.js --지금상태',
    });
  }

  if (har.ok && har.value.present && har.value.stale) {
    warn.push({
      kind: '이식 폴더 낡음',
      text: `바탕화면 SYNK_하네스 = ${har.value.stamp || '(스탬프 미검출)'} · 정본 = ${har.value.canonical}` +
        ' — 다른 도구(Codex·Kimi·웹·Obsidian)가 낡은 지침을 읽는다. 수리: node tools/harness-export.js',
    });
  }

  if (nbl.ok && nbl.value.present && nbl.value.changed.length) {
    const n = nbl.value.changed.length;
    warn.push({
      kind: '제미나이LM 묶음 낡음',
      text: `묶음(만든 날 ${nbl.value.made}) 이후 원천 ${n}개가 바뀌었다 — ` +
        `${nbl.value.changed.slice(0, 3).join(', ')}${n > 3 ? ` 외 ${n - 3}건` : ''}. ` +
        '올라간 사본은 저장소가 만질 수 없으므로 스스로 안 낫는다. ' +
        '수리: node tools/geminilm-export.js → 제미나이LM에서 옛 노트북을 지우고 새로 올린다',
    });
  }

  if (nbd.ok && nbd.value.present && !nbd.value.unknown) {
    if (nbd.value.failed) {
      red.push({
        kind: '제미나이LM 자동 갱신 실패',
        text: `예약 작업 SYNK_GeminiLM 마지막 실행이 실패했다 — ${nbd.value.last.trim()}\n` +
          '     드라이브 데스크톱이 꺼졌거나 크롬 실패. 제미나이LM 소스는 그 시점에서 멈춰 있다' +
          '(화면상으론 「있는 것」처럼 보이므로 조용한 낡음이다).\n' +
          (nbd.value.마운트 === false
            // 처방을 갈라 준다 — 마운트가 없는데 도구를 돌리라고 하면 세션은 같은 자리에서
            // 막히고, 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103·F318).
            ? '     🔴 지금도 드라이브 마운트가 없다(G:~K: 전부 훑음) — **도구를 돌려도 같은 자리에서 멈춘다.**\n' +
              '     유호님만 풀 수 있다: 구글 드라이브 데스크톱을 켜고 「내 드라이브」가 보이면 그때 재실행된다' +
              '(예약 작업이 매일 돌므로 켜 두기만 하면 손은 안 간다).'
            : '     수리: node tools/geminilm-drive.js  (마운트는 지금 잡힌다)'),
      });
    } else if (nbd.value.지난날 !== null && nbd.value.지난날 >= 3) {
      warn.push({
        kind: '제미나이LM 자동 갱신 멈춤',
        text: `마지막 성공이 ${nbd.value.성공일}(${nbd.value.지난날}일 전) — 매일 도는 배선인데 안 돌고 있다. ` +
          'PC가 꺼져 있었다면 정상이지만, 켜져 있었다면 예약 작업을 확인하라(schtasks /query /tn SYNK_GeminiLM).',
      });
    }
  }

  if (map.ok && map.value.present && map.value.문제수) {
    warn.push({
      kind: '지도 사본 갈림',
      text: `바탕화면 SYNK_지도 ${map.value.지도수}종 중 문제 ${map.value.문제수}건 — ` +
        map.value.지도들.slice(0, 3).map((m) => `${m.이름}(${m.첫문제})`).join(' · ') +
        ' — 유호님이 여는 사본이 정본과 갈라졌거나 신선도를 모른다.' +
        ' 상세: node tools/지도대장.js · 수리: --bake / --stamp',
    });
  }

  if (toi.ok && toi.value.present && toi.value.stale) {
    warn.push({
      kind: '손일 장부 정체',
      text: `마지막 기입이 ${toi.value.idle}일 전(기준 ${toi.value.limit}일) — 그 사이 사람 일을 없앤 릴리스가 정말 없었나. ` +
        '없앤 뒤에는 「그게 얼마나 자주였나」를 다시 못 잰다(소급 불가). ' +
        '기입: node tools/bump-version.js --desc "..." --toil "없앤 손일::주기::대체 장치"',
    });
  }

  /* /evolve 스킬은 08-20 은퇴(유호 픽 — 개정은 마찰이 쌓이면 그 자리에서 제안한다).
   * 알림 자체는 산다 — 「지침 개정을 제안할 때」의 신호는 스킬이 아니라 이 문턱이었다. */
  if (fri.ok && fri.value.새로.length >= EVOLVE_THRESHOLD) {
    notes.push({
      kind: '지침 개정 제안 조건 도달',
      text: `마지막 개정(${fri.value.기준 || '기준점 못 읽음 — 전량으로 센다'}) 뒤에 난 마찰 신호 ` +
        `${fri.value.새로.length}건(기준 ${EVOLVE_THRESHOLD}건) — ${fri.value.새로.map((r) => r.id).join(', ')} · 유호님 승인 자리다`,
    });
  }

  /* F386 ㉡ — 「지난 개정을 넘겼는데 아직 아무도 판정 안 붙인 행」. 위 알림과 **갈라서** 낸다:
   * 붙여 놓으면 「2건 더 났다」와 「N건이 안 닫혔다」가 한 문장에서 같은 모양이 되고, 그게
   * 정확히 F386 이 신고한 포화다. 처방이 둘로 갈리는데(개정하라 / 대조하라) 문장이 하나면
   * 읽는 쪽은 둘 다 안 한다. 나이는 기계가 정확히 아는 축이라 거짓양성이 0이다. */
  if (fri.ok && fri.value.기준 && fri.value.묵은.length) {
    warn.push({
      kind: '장부 판정 미부착',
      text: `마지막 개정(${fri.value.기준}) 전에 난 마찰 신호 ${fri.value.묵은.length}건이 «판정 없이» 열려 있다 — ` +
        `${fri.value.묵은.map((r) => r.id).join(', ')}. ` +
        '고쳤으면 resolve, 「지금은 안 닫는다」면 defer 로 그 판정을 장부에 적는다(적을 자리가 없어서 ' +
        '같은 대조를 세션마다 다시 하던 자리다 · F386). 처방: node tools/friction.js defer F0NN "왜 · 어디서 판정했나"',
    });
  }

  if (장부.ok && 장부.value.측정) {
    const j = 장부판정(장부.value);
    red.push(...j.red);
    notes.push(...j.notes);
  }

  return { mem, doc, fri, har, dep, 장부, red, warn, notes, findings: red.length + warn.length + notes.length };
}

/* ── 출력 ────────────────────────────────────────────────────────────────── */
function render(r) {
  const out = [];
  const push = (s) => out.push(s);

  if (r.red.length) {
    push(`🔴 수리 필요 ${r.red.length}건`);
    for (const x of r.red) push(`   [${x.kind}] ${x.text}`);
  }
  if (r.warn.length) {
    push(`⚠ 주의 ${r.warn.length}건`);
    for (const x of r.warn.slice(0, 12)) push(`   [${x.kind}] ${x.text}`);
    if (r.warn.length > 12) push(`   … 외 ${r.warn.length - 12}건`);
  }
  for (const n of r.notes) push(`▶ ${n.kind} — ${n.text}`);

  // 전파 보류 — 적색도 경고도 아니다. **세어서 보이기는 한다**: 숨기면 「없는 것」이 되고,
  // 적색에 두면 고치지 말라고 정해 둔 것이 매 세션 27건 중 25건을 차지한다(08-10 실측).
  // 절 하나가 없거나 안 쟀다고 리포트 전체가 죽으면 안 된다 — 그 침묵이 이 도구가 고치려는 병이다.
  if (r.doc && r.doc.ok && r.doc.value && r.doc.value.staleHeld && r.doc.value.staleHeld.length) {
    const h = r.doc.value.staleHeld;
    const 정본별 = [...new Set(h.map((s) => `${path.basename(s.target)}@${s.now}`))].join(' · ');
    push(`   ⏸ 전파 보류 ${h.length}건 — 유호님이 그 판에서 세워 둔 것이다(${정본별}). 손댈 일이 생기면 그때 같이 반영한다.`);
  }

  // 결정 큐 — 부패가 아니라 **순서**다. 이 도구가 존재하는 이유의 절반이 여기에 있다.
  if (r.mem.ok) {
    const dec = r.mem.value.decisions;
    if (dec.ranked.length) {
      push(`\n결정 큐 (막힘> 위상정렬) — 기다리는 항목 ${dec.waiting}개`);
      for (const x of dec.ranked.slice(0, 3)) {
        push(`   ${String(x.unblocks).padStart(2)}건 해소 ← ${x.blocker} [${x.kind}]`);
      }
      if (dec.cycles.length) push(`   ☠️ 순환 대기 ${dec.cycles.length}건 — 서로 기다려 영원히 안 풀린다`);
    }
    const un = r.mem.value.unwired;
    if (un.length) {
      push(`   ℹ 큐 밖의 ⏳ — ${un.length}개 토픽이 글로만 대기 중(막힘> 엣지가 없어 순위에 안 잡힌다)`);
    }
  }
  return out.join('\n');
}

/* ── 스로틀 ──────────────────────────────────────────────────────────────── */
/* 키별로 연 이유(F244): 항목마다 부패 속도가 다르다. 저장소 쪽(메모리·문서·마찰)은 느리게
 * 낡아서 7일이면 충분한데, **라이브 드리프트는 하루가 그대로 소급 불가 손실**이다.
 * 하나의 도장으로 묶으면 둘 중 느린 쪽이 빠른 쪽을 6일간 침묵시킨다. */
function 상태() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) || {}; } catch (_) { return {}; }
}

function dueNow(now, key = 'last', days = Number(process.env.SYNK_ROT_INTERVAL_DAYS || DEFAULT_INTERVAL_DAYS)) {
  const last = 상태()[key] || 0;   // 없는 키 = 한 번도 안 잼 = 돌 차례다
  return now - last >= days * 24 * 60 * 60 * 1000;
}

/* 읽고 합쳐서 쓴다 — 통째로 덮으면 주간 도장이 배포 도장을 지우고(그 반대도) 서로를 되살려
 * 두 스로틀이 다 무의미해진다. */
function stamp(now, patch) {
  const f = stateFile();
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ ...상태(), ...patch, at: new Date(now).toISOString() }, null, 1), 'utf8');
  } catch (_) { /* 상태를 못 써도 검사 자체는 성공이다 — 다음 세션에 한 번 더 도는 것뿐 */ }
}

/* 아래 층(`배포판점검.안나간변경`)이 자기 거짓양성을 재우는 데 쓰는 도장 조각.
 * 여기서만 만든다 — **실제로 잰 실행**만 남길 값을 갖기 때문이다(위 stamp 주석과 같은 축:
 * 안 잰 날에 찍으면 그 하루가 조용히 사라진다). 키 이름은 배포판점검에서 파생시킨다:
 * 쓰는 쪽과 읽는 쪽에 글자를 따로 적으면 갈라지고, 갈라진 쪽은 「도장 없음」으로 조용히 죽는다. */
function 배포도장(now, dep) {
  let 키;
  try { 키 = require('./배포판점검.js').도장키; } catch (_) { return {}; }
  if (!키) return {};
  const 프로젝트들 = {};
  for (const r of (dep && dep.결과) || []) {
    if (!r || !r.이름 || !r.실측 || !r.실측.지문) continue;   // 지문을 못 잰 것은 안 남긴다
    /* `라이브판` 은 **뒤처졌다고 실측된 판에만** 실린다(그 갈래에서만 나온다) — 없으면 아래 층이
     * 채번 기준선으로 떨어진다. 「모름」을 값처럼 실으면 그 층이 모름을 기준선으로 쓴다. */
    프로젝트들[r.이름] = { 지문: r.실측.지문, 초록: !!r.실측.초록 };
    if (r.실측.라이브판 && r.실측.라이브판.종류 === '뒤처짐' && r.실측.라이브판.sha) {
      프로젝트들[r.이름].라이브판 = { 종류: '뒤처짐', sha: r.실측.라이브판.sha };
    }
  }
  return Object.keys(프로젝트들).length ? { [키]: { at: now, 프로젝트들 } } : {};
}

/* 배포 절만 남긴 판. `mem`·`doc` 을 죽여 결정 큐 절과 보류 절도 같이 뺀다 — 하루짜리 알림에
 * 주간 리포트가 딸려 오면 그게 곧 소음이고, 소음은 읽히지 않아 침묵과 같은 값이 된다.
 *
 * ⚠ 이 축약 판은 `render()` 가 읽는 **모든** 절 키를 갖고 있어야 한다. 없는 키를 render 가
 *   `r.X.ok` 로 만지면 리포트 전체가 예외로 죽고, 출력은 「부패 점검기 자체가 실패했다」
 *   한 줄이 된다 — 배포 알림 자리에서 그건 침묵과 같다. `{ ok: false }` 는 「이 절은 안
 *   쟀다」는 뜻이고, 절을 늘리는 사람이 여기를 같이 안 늘리면 그 자리에서 터진다(08-10 실측). */
function 축만(r, 축들) {
  const 고른다 = (a) => a.filter((x) => 축들.some((k) => x[k]));
  const [red, warn, notes] = [고른다(r.red), 고른다(r.warn), 고른다(r.notes)];
  return {
    red, warn, notes,
    mem: { ok: false }, doc: { ok: false }, 장부: { ok: false },
    findings: red.length + warn.length + notes.length,
  };
}

/* 회차 장부 판정 — 네 갈래를 **다른 소리로** 낸다. 하나로 뭉치면 늘 우는 경보가 되고, 늘 우는
 * 경보는 꺼진다(F113). 오늘 정상인 상태(판 미적용)가 그 넷 중 하나라 특히 그렇다.
 * `장부Section`(부르기·파싱)과 갈라 둔 이유는 이 함수가 **네트워크 없이 픽스처로 재지는 층**이라서다. */
function 장부판정(v) {
  const red = [];
  const notes = [];
  for (const g of (v && v.결과) || []) {
    const 이름 = `${g.저장소}${g.과녁이름 ? `(${g.과녁이름})` : ''} 회차 장부`;
    /* 처방은 «그대로 돌아야» 처방이다 — 운영 항목의 cd 명령에 과녁 덮어쓰기를 함께 싣는다(F462 정본 통로). */
    const 전량 = `cd ../${g.저장소} && ${g.과녁이름 === '운영' && g.과녁 ? `SUPABASE_PROJECT_REF=${g.과녁} ` : ''}node tools/회차장부.js --자세히`;
    if (g.못잼) {
      // 미측정은 통과가 아니다 — 다만 적색도 아니다(네트워크가 한 번 끊긴 것과 cron 이 죽은 것은 다르다).
      notes.push({ kind: '회차 장부 미측정', text: `${이름} — ${g.사유}. 그쪽에서 직접: node tools/회차장부.js`, 장부: true });
      continue;
    }
    if (g.판정 === 2) {
      /* 🔑 그쪽 «판정 2» 안에 갈래가 둘이고 **처방이 다르다** — 뭉치면 둘 다 안 하게 된다:
       *   `판 === false` = 판을 열어 봤는데 없다   → 아래 ⏳ 갈래
       *   `판 === null`  = 판을 **열지도 못했다**(자격증명·네트워크) → 미측정. 조용하면 그 창이 통째로 사라진다. */
      if (g.판 !== false) {
        notes.push({ kind: '회차 장부 미측정', text: `${이름} — ${g.사유 || '판을 못 열었다'}. 그쪽에서 직접: node tools/회차장부.js`, 장부: true });
        continue;
      }
      /* 판이 아직 안 부어진 상태 = **오늘의 정상**이다(`20260815080000` 은 companion 승인 묶음에
       * 얹혀 부어진다 · ⏳유호). 여기서 6시간마다 적색을 내면 승인 날까지 거짓 경보만 쌓인다.
       * 🔑 다만 **한 번이라도 섰던 판이 사라진 것**은 전혀 다른 사건이라 적색으로 가른다 —
       *   래치가 없으면 그 사고가 「아직 안 부었네」와 같은 모양이 되어 영영 안 보인다. */
      if (v.섰던적) {
        red.push({
          kind: '회차 장부 판이 사라졌다',
          text: `${이름} — 전에는 \`ops.cron_runs\` 가 섰는데 지금 없다(${g.사유 || '판 미적용'}). `
            + 'cron 은 계속 도는데 장부만 사라진 상태다',
          장부: true,
        });
      }
      continue;
    }
    if (g.판정 === 1) {
      const 꼬리 = (g.최근이상 || []).slice(0, 3).map((x) => `${x.jobname}→${x.outcome}`).join(' · ');
      red.push({
        kind: g.안적힘 > 0 ? '회차 장부가 침묵했다' : 'cron 이 이상을 냈다',
        text: `${이름}(${g.과녁 || '과녁 모름'}) — ${g.안적힘 > 0
          ? `cron 은 돌았는데 안 적힌 회차 ${g.안적힘}건(장부가 안 불렸다 · 요약만 보면 안 보인다)`
          : `이상 ${g.이상}건${꼬리 ? ` — ${꼬리}` : ''}`}. 전량: ${전량}`,
        장부: true,
      });
    }
  }
  return { red, notes };
}

/* 「판이 한 번이라도 섰다」는 **래치**다 — 켜기만 하고 끄지 않는다. 끄는 순간 「판이 사라졌다」는
 * 사고가 「아직 안 부었다」와 같은 모양이 되어 다음 회차부터 영영 안 보인다(그게 이 축을 만든 병). */
function 장부도장(v) {
  return (v.결과 || []).some((g) => g.판 === true) ? { 장부섰나: true } : {};
}

/* 장부 도장 패치 — **스로틀 시계와 래치를 가른다.** 하나로 묶었더니 스로틀이 조용히 리셋됐다
 * (①배포 검수 P1 · F541 트랙). 순수 함수로 떼어 둔 이유는 훅 경로가 형제 저장소를 스폰해서
 * 그 안에선 이 불변식을 «네트워크 없이» 못 재기 때문이다(F296 — 탐지는 픽스처가 진다).
 *   · `장부: now` = 6시간 스로틀의 «시계». 자기 차례였던 실행에만 찍는다.
 *   · `장부섰나` = 「한 번이라도 판이 섰다」 **래치**. 단조 증가라 차례와 무관하게 잰 김에 찍는다.
 * ⚠ 빈 객체를 내면 **부르는 쪽이 stamp 를 아예 건너뛴다** — 빈 패치로 찍으면 최상위 `at` 만
 *   갱신돼 「오늘 점검이 돌았다」로 읽히고 그날 점검이 통째로 사라진다(F482 가 밟은 함정). */
function 장부패치(장부차례, v, now) {
  return { ...(장부차례 ? { 장부: now } : {}), ...장부도장(v) };
}

/* ── 진입점 ──────────────────────────────────────────────────────────────── */
function main() {
  const args = process.argv.slice(2);
  const isHook = args.includes('--hook');
  /* 라이브 대조는 **사람이 부른 실행에서만** 돈다 — `collect()` 기본값이 꺼짐인 이유와 같다.
   * 여기서 켜는 것이 이 장치의 발동 조건이다(장치와 발동 조건은 같은 커밋 · CLAUDE.md 신뢰성). */
  const 라이브 = process.env.SYNK_ROT_LIVE !== '0';
  /* 회차 장부도 같은 문을 둔다 — 회귀·CI 는 네트워크를 안 탄다(그 자리 탐지력은 픽스처가 진다 · F296).
   * ⚠ 끄는 것과 배선이 사라진 것은 다르다 — 배선 자체는 `tests/부패점검.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 등록층 검사가 본다. */
  const 장부켬 = process.env.SYNK_ROT_LEDGER !== '0';

  if (isHook) {
    // 훅은 무슨 일이 있어도 세션을 방해하지 않는다: 항상 exit 0, 예외는 통째로 삼킨다.
    // 단 **삼키되 감추지는 않는다** — 검사기가 고장 났으면 그 사실을 알린다.
    // (침묵으로 죽는 장치를 잡으려고 만든 도구가 침묵으로 죽으면 아무 의미가 없다.)
    try {
      const now = Date.now();
      const 강제 = args.includes('--force');
      const 주간 = 강제 || dueNow(now);
      const 배포차례 = 강제 || dueNow(now, '배포', 배포_주기_일);
      /* 🔑 꺼져 있으면 **차례도 아니다.** 안 그러면 도장을 영영 못 찍어(측정 안 했으니) 이 축이
       *   스로틀 문을 매 세션 열어 둔 채가 되고, 나머지 두 축의 스로틀이 통째로 무의미해진다. */
      const 장부차례 = 장부켬 && (강제 || dueNow(now, '장부', 장부_주기_일));
      if (!주간 && !배포차례 && !장부차례) return;
      /* 여기까지 왔으면 둘 중 하나는 차례다 — 그러면 **재는 건 늘 잰다.** 「배포 차례일 때만
       * 켠다」로 좁혔더니, 주간만 차례인 날 주간 리포트가 「라이브 미측정」이라는 거짓 메모를
       * 달았다(몇 시간 전에 쟀는데도). 아낄 값은 주 1회 12초뿐이라 아낄 이유가 없다. */
      /* 🔴 라이브 대조(clasp pull · 실측 12.4초)는 **자기 차례일 때만** 켠다. 장부 축이 6시간이라
       *   그냥 두면 하루 네 번 clasp 를 당기게 되고, 그 비용은 이 축이 막으려는 손실보다 크다.
       *   위 「재는 건 늘 잰다」와 어긋나지 않는다 — 그 문장의 분모는 «주간·배포 둘» 이었다. */
      const r = collect({ 라이브: 라이브 && (주간 || 배포차례), 시간제한: 배포_대조_한도, 장부: 장부켬 });
      if (주간) stamp(now, { last: now, findings: r.findings });
      /* 장부 도장도 **실제로 잰 실행에만** 찍는다(배포 도장과 같은 축) — 못 잰 6시간에 찍으면
       * 그 창이 조용히 사라진다. `측정:false` 는 「차례가 아니었다」이고 여기 오지 않는다.
       * 🔴 그리고 도장을 **둘로 가른다** — 하나로 묶었더니 스로틀이 조용히 리셋됐다(①배포 검수 P1):
       *   · `장부: now` = 6시간 스로틀의 «시계». **자기 차례였던 실행에만** 찍는다. 주간·배포 차례로
       *     들어온 날에도 찍으면, 아래 `볼것` 이 장부 축을 걸러내므로 지적이 «측정·도장까지 되고
       *     보고만 안 된 채» 창이 리셋된다 ⇒ cron 침묵 탐지가 6시간에서 하루로 늘어진다.
       *   · `장부섰나` = 「한 번이라도 판이 섰다」 **래치**. 단조 증가(false→true 뿐)라 차례와 무관하게
       *     잰 김에 찍는다 — 차례에 묶으면 비차례 창에서 섰다 사라진 판을 영영 못 가르고,
       *     그러면 `장부판정` 의 «판이 사라졌다» 적색이 조용히 죽는다(래치가 그 적색의 전제다).
       * ⚠ 빈 패치로 `stamp` 를 부르지 않는다 — 패치가 비어도 최상위 `at` 은 갱신돼(그 함수는 늘 쓴다)
       *   「오늘 점검이 돌았다」로 읽히고 그날 점검이 통째로 건너뛰어진다(F482 가 밟은 그 함정). */
      if (r.장부.ok && r.장부.value.측정) {
        const 패치 = 장부패치(장부차례, r.장부.value, now);
        if (Object.keys(패치).length) stamp(now, 패치);
      }
      /* 배포 도장은 **실제로 잰 날에만** 찍는다(차례였는지가 아니라 쟀는지가 재료다) — 못 잰 날에
       * 찍으면 그 하루가 조용히 사라지고, 그게 이 항목을 하루로 떼어낸 이유(F244)를 무효로 만든다. */
      if (r.dep.ok && r.dep.value.측정) stamp(now, { 배포: now, ...배포도장(now, r.dep.value) });
      const 볼것 = 주간 ? r : 축만(r, [배포차례 && '배포', 장부차례 && '장부'].filter(Boolean));
      if (!볼것.findings) return; // 정지 조건 — 깨끗하면 한 글자도 넣지 않는다
      const 라벨 = 주간 ? '주간 부패 점검'
        : [배포차례 && '라이브 배포 대조(하루)', 장부차례 && '회차 장부 대조(6시간)'].filter(Boolean).join(' + ');
      const body =
        `[rot-check · ${라벨}] 이 저장소의 「조용한 부패」 자동 점검 결과다.\n` +
        render(볼것) +
        '\n\n※ 이건 지시가 아니라 관측이다. 지금 트랙과 무관하면 유호님께 한 줄로 알리고 넘어가라.' +
        ' 고칠 때는 해당 도구(tools/memory-graph.js · doc-graph.js · friction.js)를 직접 볼 것.';
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: body },
      }));
    } catch (e) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `[rot-check] 부패 점검기 자체가 실패했다 — ${(e && e.message) || e}. tools/rot-check.js 확인 필요.`,
        },
      }));
    }
    return;
  }

  const r = collect({ 라이브, 장부: 장부켬 });

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      findings: r.findings, red: r.red, warn: r.warn, notes: r.notes,
      memory: r.mem.ok ? r.mem.value : { error: r.mem.error },
      doc: r.doc.ok ? r.doc.value : { error: r.doc.error },
      friction: r.fri.ok ? { open: r.fri.value.open.length, total: r.fri.value.total } : { error: r.fri.error },
      harness: r.har.ok ? r.har.value : { error: r.har.error },
      장부: r.장부.ok ? r.장부.value : { error: r.장부.error },
    }, null, 2));
    process.exit(r.red.length ? 1 : 0);
  }

  if (!r.findings) {
    if (!args.includes('--quiet')) console.log('[rot-check] ✅ 부패 없음 — 깨진 링크·낡은 인용·미해소 마찰 0건');
    return;
  }

  // 현지 날짜로 찍는다 — UTC로 찍으면 오전에 「어제」가 나와 로그를 읽는 사람이 판을 헷갈린다.
  console.log(`\n[rot-check] ${new Date().toLocaleDateString('sv-SE')}`);
  console.log(render(r));
  console.log('');
  process.exit(r.red.length ? 1 : 0);
}

if (require.main === module) main();
/* `stamp` 는 **일부러 안 내보낸다.** 인프로세스로 부르면 `SYNK_ROT_STATE` 가 없는 한
 * 실저장소 `.claude/state/rot-check.json` 에 `{findings:0}` 을 찍고, 그러면 이 저장소의
 * 주간 부패 점검이 7일간 침묵한다 — 🔴 를 든 채로. 2026-08-07 실측: 회귀 한 줄이
 * 하루에 세 번(10:04·10:11·10:13) 그 도장을 찍었고 테스트는 내내 초록이었다.
 * 쓰기 실패 내성은 서브프로세스(`SYNK_ROT_STATE`=못 쓰는 경로)로 검사한다. */
/* `뒤커밋들` 을 내보내는 이유 (2026-08-09 · F289): 같은 계산이 `tools/대기열.js(⚠삭제됨 39019553 2026-08-20 — 지금 없다)` 에도 필요해져
 * **두 번째**가 됐다. 특히 저 안의 **1초 밀기**는 실측으로만 아는 규칙이라(F062 계열) 두 곳에
 * 적으면 한쪽이 조용히 옛 규칙으로 남고, 증상은 「갱신했는데 계속 운다」 아니면 「아직인데
 * 조용하다」 — 둘 다 침묵을 닮았다. 그래서 베끼지 않고 **이 한 벌을 빌려 쓴다**(회귀는
 * tests/절단문서.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) ③ 이 그대로 진다). ⚠ 시각은 안 돌려준다 — 부르는 쪽은 `--since` 로
 * 이미 걸러진 목록을 받으므로 필요 없다. */
module.exports = { collect, render, dueNow, stateFile, harnessSection, toilSection, mapSection, 절단문서Section, 뒤커밋들, 배포Section, 배포도장, 편집중인가, EVOLVE_THRESHOLD, 마지막개정, frictionSection, 장부Section, 장부판정, 장부도장, 장부패치, 축만, 장부_주기_일 };
