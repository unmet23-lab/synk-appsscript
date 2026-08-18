#!/usr/bin/env node
/**
 * SYNK 버전 자동 채번 — 동시 발번 충돌을 원천 차단한다.
 *
 * 왜 필요한가 (2026-08-01 실측): 하루에 6세션이 병렬로 돌면서 SYNK_VERSION이 6번 겹쳤다
 * (v9.80·81·87·100·107·112). 기존 대책은 전부 사후 감지였다 —
 *   · tests/버전충돌.test.js: 커밋 전에 "이미 쓴 번호"를 잡는다(발각 시점을 당겼을 뿐, 충돌 자체는 난다)
 *   · 규약(v6.3): 커밋 직전 origin 확인 — 두 세션이 같은 순간에 확인하면 같은 답을 본다
 * 근본 원인은 **번호를 사람이 고른다**는 것이고, 고르는 행위가 원자적이지 않다는 것이다.
 *
 * 해법: git push의 원자성을 채번 락으로 쓴다.
 *   후보 번호로 태그를 만들어 origin에 push → 성공하면 그 번호는 내 것(원격이 보증),
 *   실패하면 누군가 방금 가져간 것이므로 +1 하고 재시도. 두 세션이 같은 순간에 돌려도
 *   한쪽만 성공한다. 락 서버도, 대기도 필요 없다.
 *
 * 사용:
 *   node tools/bump-version.js --desc "인센티브 배점 3지표 완성" --종류 수리   # 채번 + Code.js 기입
 *   node tools/bump-version.js --dry                              # 다음 번호만 조회(예약 안 함)
 *   node tools/bump-version.js --desc "..." --toil "없앤 손일::주기::대체 장치"   # + 손일 장부 기입
 *   --종류 신설 --시스템 "이름" --한줄 "대외 언어 한 줄" --구역 "접수·상담"     # 시스템 대장에 행 추가
 *   --종류 보강 --시스템 "대장의 그 이름"                                      # 그 행의 「최근」 갱신
 *
 * --toil 은 이 릴리스가 **사람이 하던 일을 없앴을 때만** 쓴다(대부분의 버전은 해당 없음).
 * 왜 여기 붙였나: 손일 기록은 3년 뒤 「원장 전용 AI 비서」의 제품 명세가 되는데, 별도 명령으로
 * 두면 아무도 안 부른다 — 이 도구는 매 릴리스에 반드시 지나가는 유일한 통로다.
 * 자세한 근거 = tools/toil.js 머리말 · docs/_ops/손일장부.md.
 *
 * 태그는 `synk-v9.114` 형태로 남는다(일반 릴리스 태그와 구분). 커밋을 안 해서 번호가 비는 것은
 * 무해하다 — 이 체계가 보장하는 것은 "연속"이 아니라 "유일"이다.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CODE = path.join(ROOT, 'Code.js');
const TAG_PREFIX = 'synk-';
const MAX_TRIES = 25;

/* ── 순수 함수 (tests/버전채번.test.js가 직접 로드해 검증) ───────────────── */

// 'v9.113' → [9, 113] · 형식이 아니면 null(비교에서 제외되도록)
function parseVer(s) {
  const m = String(s == null ? '' : s).match(/^v?(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// a가 b보다 크면 +1, 작으면 -1, 같으면 0. null은 항상 작다(미상은 최솟값 취급).
function cmpVer(a, b) {
  const x = parseVer(a), y = parseVer(b);
  if (!x && !y) return 0;
  if (!x) return -1;
  if (!y) return 1;
  return x[0] !== y[0] ? (x[0] > y[0] ? 1 : -1) : (x[1] !== y[1] ? (x[1] > y[1] ? 1 : -1) : 0);
}

function maxVer(list) {
  return (list || []).filter(Boolean).reduce((best, v) => (cmpVer(v, best) > 0 ? v : best), null);
}

// 'v9.113' → 'v9.114'. minor만 올린다 — major 승격(v10)은 사람이 정할 일이고,
// 자동으로 넘기면 safety.test.js의 /\[v9\.(\d+)/ 태그 검사가 통째로 무력해진다.
function nextVer(v) {
  const p = parseVer(v);
  if (!p) throw new Error('버전 형식이 아님: ' + v);
  return 'v' + p[0] + '.' + (p[1] + 1);
}

function versionOf(src) {
  const m = String(src || '').match(/const SYNK_VERSION = '([^']+)'/);
  return m ? m[1] : null;
}

// SYNK_VERSION 줄만 교체한다. desc가 있으면 설명 꼬리를 '· 최신 [vX] desc'로 갈아끼운다.
// 파일의 다른 부분은 절대 건드리지 않는다(줄 단위 치환).
/* [v9.144 후속] 이력 체인 병합 — 마찰 F017.
 *
 * 무슨 일이 있었나: 채번기는 **작업본**의 SYNK_VERSION 줄만 보고 새 항목을 끼워 넣는다.
 * 그런데 내가 작업하는 동안 옆 세션이 origin에 자기 번호를 올려 두면, 내 작업본의 체인에는
 * 그 항목이 **애초에 없다.** 그 상태로 내 줄을 쓰면 옆 세션의 기록이 조용히 빠진 줄이 만들어진다.
 * 08-03 실측 — v9.141(옆)과 v9.142(내)가 겹쳤을 때 `[v9.141]` 항목이 누락됐고,
 * 마침 충돌이 나서 손으로 복원했다. **충돌이 안 났으면 아무도 몰랐을 자리다.**
 *
 * 그래서 origin/master의 현재 줄에만 있는 항목을 내 체인에 **끼워 넣는다**(통째로 갈아끼우지 않는다 —
 * 초판이 그렇게 했다가 앞선 세션들의 기록을 날렸다). 삽입 위치는 버전 내림차순을 따르고,
 * 판정 불가한 조각은 건드리지 않는다. 즉 이 함수는 **더하기만 하고 빼지 않는다.** */
/* ⚠ '최신' 도막도 **항목이다**. 초판은 head에 남겨 뒀는데, 그러면 상대의 가장 새 항목이
 *   — 즉 이번 사고에서 잃어버린 바로 그 항목이 — 비교 대상에서 통째로 빠진다.
 *   회귀 「origin에만 있는 항목을 되살린다」가 정확히 이걸로 실패했다. */
const CHAIN_SPLIT = /\s·\s(?=(?:최신\s)?\[v\d)/;
const CHAIN_FIRST = /·\s(?:최신\s)?\[v\d/;
function chainEntries(comment) {
  const s = String(comment || '');
  const first = s.search(CHAIN_FIRST);
  if (first < 0) return { head: s, items: [] };
  const head = s.slice(0, first).replace(/\s*$/, '');
  const rest = s.slice(first).replace(/^·\s*/, '');
  return { head: head, items: rest.split(CHAIN_SPLIT).map((t) => t.trim()).filter(Boolean) };
}
const entryVer = (raw) => {
  const m = String(raw).replace(/^최신\s+/, '').match(/^\[v(\d+)\.(\d+)\]/);
  return m ? 'v' + m[1] + '.' + m[2] : null;
};

function mergeChain(mineComment, theirsComment) {
  const mine = chainEntries(mineComment);
  const theirs = chainEntries(theirsComment);
  if (!theirs.items.length) return mineComment;

  const have = new Set(mine.items.map(entryVer).filter(Boolean));
  // 상대의 '최신' 표식은 떼고 들여온다 — 「최신」은 이 줄에 **하나**여야 하고, 그건 내가 지금 다는 번호다.
  const missing = theirs.items
    .filter((raw) => { const v = entryVer(raw); return v && !have.has(v); })
    .map((raw) => raw.replace(/^최신\s+/, ''));
  if (!missing.length) return mineComment;

  const items = mine.items.slice();
  missing.forEach((raw) => {
    const v = entryVer(raw);
    // 내림차순 유지 — 나보다 낮은 첫 항목 **앞**에 넣는다. 못 정하면 맨 뒤(잃는 것보다 낫다).
    let at = items.findIndex((x) => { const xv = entryVer(x); return xv && cmpVer(xv, v) < 0; });
    if (at < 0) at = items.length;
    items.splice(at, 0, raw);
  });
  return mine.head + ' · ' + items.join(' · ');
}

function replaceVersionLine(src, newVer, desc, originSrc) {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith('const SYNK_VERSION'));
  if (i < 0) throw new Error('SYNK_VERSION 선언을 찾지 못함');
  let line = lines[i].replace(/const SYNK_VERSION = '[^']+'/, "const SYNK_VERSION = '" + newVer + "'");

  /* [F017] 옆 세션이 origin에 올린 항목을 먼저 되살린다 — desc 유무와 무관하게 한다.
   * 내 작업본에 없는 항목은 「내가 지운 것」이 아니라 「내가 본 적 없는 것」이고,
   * 그대로 쓰면 그들의 기록이 조용히 사라진다. */
  if (originSrc) {
    const ci0 = line.indexOf('//');
    if (ci0 >= 0) {
      const originLine = String(originSrc).split(/\r?\n/).find((l) => l.startsWith('const SYNK_VERSION')) || '';
      const oci = originLine.indexOf('//');
      if (oci >= 0) {
        const merged = mergeChain(line.slice(ci0), originLine.slice(oci));
        line = line.slice(0, ci0) + merged;
      }
    }
  }

  if (desc) {
    // ⚠ 기존 이력 체인을 통째로 갈아끼우면 안 된다 — 이 줄에는 앞선 세션들의 [vN] 항목이 누적돼 있고,
    //   덮어쓰면 그들의 기록이 조용히 사라진다(초판이 실제로 그랬고 라이브 대조에서 발각됐다).
    //   기존 '· 최신 [vOld]'를 '· [vOld]'로 강등하고, 새 항목을 그 앞에 끼워 넣는다.
    //   '· 최신 [' 위치를 기준으로 삼는다 — 특정 안내 문구에 앵커를 걸면 그 문구가 바뀌는 순간
    //   조용히 else로 빠져 체인을 통째로 날린다(앵커 의존 초판이 테스트에서 그렇게 걸렸다).
    const ci = line.indexOf('//');
    const old = ci >= 0 ? line.slice(ci) : '';
    const NEW = '· 최신 [' + newVer + '] ' + desc;
    /* [F017] 기준은 '· 최신 [' 이 아니라 **체인의 첫 항목**이다.
     * 병합으로 되살린 항목(옆 세션의 더 큰 번호)이 '최신' 도막 **앞**에 놓이면,
     * '최신' 자리에 끼워 넣는 순간 새 번호가 그 뒤로 밀려 141·142·140 같은 순서가 나온다.
     * 뒤쪽의 옛 '최신' 표식은 아래 replace가 그대로 강등한다(표식은 줄에 하나여야 한다). */
    const k = old.search(CHAIN_FIRST);
    const comment = k >= 0
      ? old.slice(0, k) + NEW + ' ' + old.slice(k).replace('· 최신 [', '· [')   // 기존 최신을 강등하고 앞에 삽입
      : (old ? old.replace(/\s*$/, '') + ' ' + NEW
             : '// 전체 이력 = docs/버전_이력.md (새 버전은 그 파일 맨 아래에 추가) ' + NEW);
    line = (ci >= 0 ? line.slice(0, ci) : line + ' ') + comment;
  }
  lines[i] = line;
  return lines.join(eol);
}

/* ── git 조회 ─────────────────────────────────────────────────────────── */

function git(args, opts) {
  return execFileSync('git', args, Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts || ''));
}
function gitQuiet(args) {
  try { return git(args, { stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { return null; }
}

/* 태그 push 가 거절됐을 때 그 사유를 가른다 — **증거는 메시지가 아니라 origin 의 상태**다(F196).
 *   true  = origin 이 그 태그를 갖고 있다 → 진짜 선점(다음 후보로)
 *   false = 없다 → 선점이 아니라 태그 push 자체가 막힌 환경(클라우드/폰 프록시)
 *   null  = 조회도 실패 → 못 쟀다. 단정하지 않는다.
 * 조회를 인자로 받는 이유는 하나다: 이 판정을 **실제로 돌려서** 검사할 수 있게. 소스에 문장이 있다는
 * 것과 그렇게 동작한다는 것은 다르다(이 파일 검사의 오랜 천장 · tests/버전채번 '감사' 주석).
 * ⚠ tools/friction.js 에 같은 판정이 인라인으로 한 벌 더 있다. **세 번째가 생기면 공용 통로로 옮긴다.** */
/** 예약 태그에 새길 주인 — 세션마다 달라야 SHA 가 갈린다(같으면 F201 이 그대로 돌아온다).
 *  🔑 HOST 만 읽으면 클라우드 세션이 전부 `unknown/<pid>` 로 뭉친다 — 공용 통로에서 받는다(F633).
 *  ⚠ 위 줄이 예고한 「세 번째가 생기면 공용 통로로 옮긴다」가 여기다: 이제 이 판정의 정본은
 *    `.claude/hooks/lib/세션식별.js` 하나고, friction.js 의 같은 함수도 그것을 부른다. */
function 예약자() {
  return (require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', '세션식별.js')).표기id() || 'unknown') + '/' + process.pid;
}

function 선점인가(태그, 조회) {
  const out = 조회(['ls-remote', '--tags', 'origin', 'refs/tags/' + 태그]);
  return out === null ? null : !!out.trim();
}

// 번호를 이미 쓴 곳을 전부 훑는다 — 하나라도 빠지면 그 경로로 충돌이 다시 샌다.
function collectUsedVersions() {
  const found = [];
  const push = (v, where) => { if (v) found.push({ v: v, where: where }); };

  push(versionOf(fs.readFileSync(CODE, 'utf8')), '작업본 Code.js');
  push(versionOf(gitQuiet(['show', 'origin/master:Code.js'])), 'origin/master');

  // 로컬 브랜치 전부 — 워크트리가 커밋만 하고 아직 push 안 한 번호를 잡는다(실제 사고 경로)
  const refs = (gitQuiet(['for-each-ref', '--format=%(refname)', 'refs/heads']) || '').split(/\r?\n/).filter(Boolean);
  refs.forEach((r) => push(versionOf(gitQuiet(['show', r + ':Code.js'])), r));

  // 예약 태그 — 아직 커밋조차 안 된 '방금 가져간' 번호까지 포함한다
  (gitQuiet(['tag', '-l', TAG_PREFIX + 'v*']) || '').split(/\r?\n/).filter(Boolean)
    .forEach((t) => push(t.slice(TAG_PREFIX.length), '태그 ' + t));

  return found;
}

/* ── CLI ──────────────────────────────────────────────────────────────── */

/* ── 상수와 헤더 태그를 한 동작으로 ──────────────────────────────────────
 *
 * 왜 (2026-08-04 실측, 하루 두 번 · v9.180·v9.181):
 *   검사(safety [v9.55])는 **엔진 7파일을 이어붙인 문자열**의 최고 `[v9.N]` 태그와
 *   `Code.js` 의 `SYNK_VERSION` 상수가 같은지 본다. 그런데 그 둘은 **두 번에 나뉘어** 쓰였다:
 *     ⓐ `--desc` 없이 돌리면 상수만 오르고 체인 항목이 안 붙는다 → 반드시 빨개진다
 *     ⓑ 세션이 기능을 짜면서 엔진 파일 헤더에 `[v9.181]` 을 먼저 박고, 채번은 나중에 한다
 *   그 사이 창에서 CI 가 빨개지고, **그 적색은 남의 배포 게이트까지 막는다**(실측: 보드 두 줄이
 *   「타 세션 미커밋이라 배포만 대기」였다). 자기 트랙 안에서 끝나지 않는 결함이다.
 *
 * 처방 = 「잘못 쓸 수 없는 통로」로 옮긴다(CLAUDE.md 신뢰성).
 *   ⓐ `--desc` 를 **채번 전에** 강제한다(채번 뒤에 막으면 번호만 태운다).
 *   ⓑ 짜는 동안에는 `[vNEXT]` 라고 적는다 — 이 자리표는 `\[v9\.\d+` 에 안 걸려 **safety [v9.55] 를
 *      안 건드린다.** 채번이 상수를 쓰는 **같은 실행에서** 모든 엔진 파일의 `[vNEXT]` 를 `[v9.N]` 으로 바꾼다.
 *   🔑 순서를 바꾸라고 사람에게 시키는 대신, 순서가 하나뿐인 통로를 만든 것이다. */
/* [2026-08-15] F450 — 위 ⓑ 를 「그러니 커밋해도 안전」으로 읽은 세션이 실재한다(실측 `694497ad`:
 *   커밋 본문이 「버전은 [vNEXT] 그대로 둔다 — 먼저 박으면 남의 배포를 막는다 F078」이라 적으면서
 *   자리표를 커밋해 **정확히 남의 배포를 막았다**). 그 오독의 출처가 이 주석과 `auto-commit.js` 였다.
 * 🔑 가른다: 자리표는 **미커밋인 동안** 안전하다(safety 짝이 없어 안 빨개진다). 커밋되는 순간
 *   `tests/버전채번.test.js` 「실저장소에 [vNEXT] 자리표가 남아 있지 않다」가 빨개지고, 그 적색은
 *   낸 사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다 — ⓑ 가 없애려던 그 상태 그대로다.
 * 🔑 그래서 프로즈가 아니라 기계로 옮겼다: `tools/자리표검사.js` 가 pre-commit 에서 **커밋될 blob**
 *   을 보고 막는다(작업본이 아니다 · F302). 판정은 아래 `자리표자리` 하나가 지고 훅은 발동만 맡는다. */
/* [2026-08-12] F339 — 라벨을 붙인 자리표(`[vNEXT·E²]`)를 **통째로 놓쳤다.** 정확히 `[vNEXT]` 만 봤으니
 *   치환도 `--check` 도 조용히 지나갔고, 실측 08-12 에 `엔진_운영배치.js` 의 `[vNEXT·E²]` 하나가
 *   `--check` 초록 아래 살아남았다 — 잡은 것은 기계가 아니라 사람 눈이다. 가드가 로직이 아니라
 *   **표기층**에서 샜고, 새는 방향은 여기서도 「통과」다.
 * 🔑 라벨은 지우지 않고 **번호만** 갈아 끼운다 — 라벨은 뜻을 진다(`[vNEXT·검수 31584c…]` = 어느 검수가
 *   잡았나 · `[vNEXT·E²]` = 어느 절의 몫인가). 사람이 손으로 확정할 때도 그렇게 했다: `[vNEXT·E²]` 는
 *   `[v9.215·E²]` 가 됐지 `[v9.215]` 가 아니었다(엔진_운영배치.js:383).
 * ⚠ 확정된 `[v9.N·라벨]` 은 버전 태그 패턴(`\[v9\.(\d+)\]`)에 **안 걸린다** — 그래서 `maxTagInEngines`
 *   가 그 줄을 최고 태그로 세지 않는다. 새는 방향이 「상수보다 높은 태그를 못 본다」가 아니라
 *   「안 센다」라 거짓 적색을 안 만든다. 태그 패턴을 넓히는 것은 이 트랙 밖(별건).
 * 🔑 `/g` 정규식을 **상수로 두지 않는다** — `lastIndex` 가 호출 사이에 남아 두 번째 `test()` 가 거짓을
 *   낸다(옛 코드가 그 자리에서 `lastIndex = 0` 을 손으로 껐다 · 끄는 것을 한 번 잊으면 자리표가
 *   「없다」로 읽힌다). 매번 새로 만들어 그 자리 자체를 없앤다. 판정은 이 함수 **하나**다 —
 *   옛 코드는 같은 패턴을 네 곳에 손으로 적어 두었고, 그러면 넓힐 때 갈라진다. */
function 자리표() { return /\[vNEXT(?:([·\s][^\]\n]*))?\]/g; }

/* SYNK_BUMP_ROOT = **보는 저장소만** 바꾸는 이음매(로직은 안 끈다 · SYNK_TRACK_ROOT·SYNK_OWNER_ROOT 와 같은 패턴).
 * 탐지력은 픽스처가 져야 한다 — 실저장소에 `[vNEXT]` 를 심어 놓고 재는 순간 그게 사고다. */
function rootDir() { return process.env.SYNK_BUMP_ROOT || ROOT; }
function codePath() { return path.join(rootDir(), 'Code.js'); }

/** 엔진 파일 목록의 정본은 tests/_engine-source.js 하나다 — 여기 다시 적으면 분할 때 갈라진다.
 *  픽스처에는 그 파일이 없으므로, 그때는 있는 것만 본다. */
function engineFiles() {
  let 목록;
  try { 목록 = require('../tests/_engine-source.js').ENGINE_FILES; }
  catch (_) { 목록 = ['Code.js']; }   // 목록을 못 읽어도 Code.js 는 반드시 본다
  const r = rootDir();
  return 목록.filter((f) => fs.existsSync(path.join(r, f)));
}

/* ═══ 배포 집합 — 「엔진 파일」과 「배포 파일」은 같지 않다 (F390 · 2026-08-12) ═══
 *
 * 무슨 일이 있었나: 자리표 치환·검사가 `ENGINE_FILES`(7개)를 범위로 쓰고 있었다. 그 목록은 원래
 *   「테스트가 엔진을 한 문자열로 본다」는 **다른 계약**의 것인데, 채번기가 그걸 치환 범위로
 *   재사용하면서 「엔진 파일 = 배포 파일」이라는 전제가 조용히 들어왔다. 두 집합은 실제로 다르다 —
 *   실측 2026-08-12: 배포 집합 14 ∖ ENGINE_FILES 7 = **7개**(`상담AI.js`·`엔진_두뇌.js`·`교재연동.js`
 *   ·`만족도팩.js`·`contents_*.js` 3). 그 7개에 `[vNEXT]` 를 적으면 **치환도 검사도 안 받고 그대로
 *   clasp push 에 실린다** — v9.223 배선 중 `상담AI.js`×3·`엔진_두뇌.js`×2 가 실제로 그렇게 남았다.
 *
 * 🔴 그물이 있다고 믿었는데 없었다: 실저장소를 재는 자리표 검사는 `tests/버전채번.test.js` 의
 *   「실저장소에 [vNEXT] 자리표가 남아 있지 않다」 하나뿐이고, 그것이 부르는 것이 바로 이 함수다.
 *   즉 검사 층도 같은 7파일만 봤다 — 새는 방향은 여기서도 「통과」다. 이미 라이브까지 간 적이
 *   있다(F309·F310: 미커밋 `contents_상담AI.js` 의 자리표가 clasp push 에 실려 라이브에 박혔다).
 *   그때 진단은 TOCTOU 였는데, 원인은 둘이었고 한쪽만 처방됐다.
 *
 * 🔑 정본은 `.claspignore` 다 — clasp 가 **실제로 미는 것**이 거기 적혀 있다. 목록을 여기 베끼지
 *   않고 `clasp-guard` 가 쓰는 공용 통로(`.claude/hooks/lib/clasp-project.js`)를 그대로 부른다.
 *   두 곳에 적으면 갈라지고, 갈라진 쪽은 언제나 「통과」로 샌다.
 * 🚫 `ENGINE_FILES` 에 배포 파일을 더 넣는 것으로 때우지 않는다 — 그 목록은 테스트 195건의
 *   구간 자르기가 매달린 다른 계약이라, 얹으면 그쪽이 같이 흔들린다. 두 목록은 갈라 둔 채
 *   채번기가 배포 집합을 **따로** 읽는다.
 * ⚠ 바닥은 언제나 `engineFiles()` 다 — 정본을 못 읽는 환경(픽스처·다른 저장소)에서도 엔진은
 *   반드시 본다. 못 읽었을 때 새는 방향이 「오늘과 같음」이라 F103 을 안 만든다. */
function 배포파일들() {
  const r = rootDir();
  let 글롭 = [];
  try {
    /* SYNK_CLASP_LIB = **정본 통로만** 바꾸는 이음매(로직은 안 끈다 · SYNK_BUMP_ROOT 와 같은 패턴).
     * 이게 없으면 「정본을 못 읽는 날」을 잴 방법이 없고, 그날의 폴백이 `[]` 인지 엔진 목록인지가
     * 검사 밖으로 나간다 — 빈 목록은 「자리표 0건」과 **같은 모양**이라 그게 F207 그 자체다. */
    const cp = require(process.env.SYNK_CLASP_LIB
      || path.join(ROOT, '.claude', 'hooks', 'lib', 'clasp-project.js'));
    const res = cp.deployTargets(r).map(cp.globToRe);
    글롭 = fs.readdirSync(r, { withFileTypes: true })
      .filter((d) => d.isFile() && res.some((re) => re.test(d.name)))
      .map((d) => d.name);
  } catch (_) { /* 정본을 못 읽으면 바닥만 — 「엔진은 반드시」가 남는다 */ }
  return [...new Set([...engineFiles(), ...글롭])];
}

/** 엔진 전체에서 최고 `[v9.N]` 태그. 없으면 null.
 *
 *  ⚠ 여기는 **일부러 엔진 범위 그대로다** — 배포 집합으로 넓히지 마라. 이 판정의 짝은
 *  `tests/safety.test.js [v9.55]` 이고 그쪽이 **엔진 7파일을 이어붙인 문자열**을 본다.
 *  CI 를 빨갛게 만드는 것은 그쪽이라, 여기만 넓히면 `--check` 가 CI 보다 엄해져서
 *  「preflight 는 빨간데 CI 는 초록」이 된다 — 아래 「safety 가 보는 것을 --check 도 본다」
 *  결합 검사가 지키려는 바로 그 축이 반대 방향으로 깨진다. 자리표(위)는 CI 짝이 아예
 *  없어서 넓히는 것이고, 태그(여기)는 짝이 있어서 안 넓히는 것이다. */
function maxTagInEngines() {
  let max = null;
  for (const f of engineFiles()) {
    let src; try { src = fs.readFileSync(path.join(rootDir(), f), 'utf8'); } catch (_) { continue; }
    for (const m of src.matchAll(/\[v9\.(\d+)\]/g)) {
      const n = Number(m[1]);
      if (max === null || n > max) max = n;
    }
  }
  return max;
}

/* ═══ 세 번째 다리 — docs/버전_이력.md (F082) ═══
 * 버전 표기는 **세 곳**에 있다: ①SYNK_VERSION 상수 ②엔진 헤더 태그 ③이력 문서.
 * `--check` 는 ①②만 봤다. 그런데 ③이 어긋나도 CI 는 똑같이 빨개진다(safety [2026-08-03]).
 * 즉 「✅ 일치」라고 답한 직후에 CI 가 터지는 상태가 존재했다 — 예측이 틀리는 preflight 는
 * 없느니만 못하다(사람이 그 답을 믿고 커밋한다). F078 을 닫으며 「--check 로 잡는다」고
 * 적어 놓고 이 다리를 안 넣은 것이 F082 다.
 * 자유서술이라 **자동 기입은 못 해도 탐지는 된다** — 못 고치는 것과 못 보는 것은 다르다. */
function historyDocPath() { return path.join(rootDir(), 'docs', '버전_이력.md'); }
function historyDoc() {
  try { return fs.readFileSync(historyDocPath(), 'utf8'); } catch (_) { return null; }
}

/** 이력 문서의 최고 `[v9.N]`. 문서가 없으면(픽스처) null = **「검사 안 함」이지 「통과」가 아니다.** */
function maxTagInHistoryDoc() {
  const doc = historyDoc();
  if (doc === null) return null;
  let max = null;
  for (const m of doc.matchAll(/\[v9\.(\d+)\]/g)) {
    const n = Number(m[1]);
    if (max === null || n > max) max = n;
  }
  return max;
}

/** 머리말(첫 `---` 앞)에 박힌 「현재 버전 = v9.NNN」. 아무도 안 고쳐서 반드시 낡는다 — 없으면 null. */
function hardcodedHeadVersion() {
  const doc = historyDoc();
  if (doc === null) return null;
  const m = doc.split(/^---$/m)[0].match(/현재 버전\s*=\s*\**v9\.\d+/);
  return m ? m[0] : null;
}

/** 내용 한 덩이에서 자리표가 앉은 자리들 — `[{줄, 문구}]`.
 *
 *  🔑 **디스크를 읽는 쪽(`pendingPlaceholders`)과 커밋될 blob 을 읽는 쪽(`tools/자리표검사.js`)이
 *  이 함수 하나를 쓴다.** 둘로 적으면 갈라지고, 갈라지는 방향은 언제나 「통과」다 — F339 가 정확히
 *  그 형태였다(패턴이 네 곳에 손으로 적혀 라벨 자리표를 통째로 놓쳤다). 그래서 **경로도 파일도
 *  모르는** 순수 함수로 둔다: 읽는 자리가 늘어도 판정은 안 늘어난다.
 *  ⚠ 줄 번호를 함께 내는 이유는 처방 때문이다 — 「어느 파일」까지만 말하면 2,000줄짜리 엔진
 *  파일에서 사람이 자리를 다시 찾아야 하고, 다시 찾게 만드는 처방은 잘 안 따라진다. */
function 자리표자리(내용) {
  const 결과 = [];
  const 줄들 = String(내용).split(/\r?\n/);
  for (let i = 0; i < 줄들.length; i++) {
    for (const m of 줄들[i].matchAll(자리표())) 결과.push({ 줄: i + 1, 문구: m[0] });
  }
  return 결과;
}

/** `[vNEXT]`·`[vNEXT·라벨]` 이 남아 있는 파일들. 범위 = **배포 집합**(F390). */
function pendingPlaceholders() {
  return 배포파일들().filter((f) => {
    try { return 자리표자리(fs.readFileSync(path.join(rootDir(), f), 'utf8')).length > 0; }
    catch (_) { return false; }
  });
}

/** 자리표를 확정 번호로 바꾼다. Code.js 는 상수 줄과 함께 이미 쓰였으므로 그 내용을 넘겨받는다. */
function stampPlaceholders(ver, codeSrcAfter) {
  const 바뀐것 = [];
  const 쓸것 = [];
  for (const f of 배포파일들()) {
    const p = path.join(rootDir(), f);
    let src = f === 'Code.js' && codeSrcAfter !== undefined ? codeSrcAfter : null;
    if (src === null) { try { src = fs.readFileSync(p, 'utf8'); } catch (_) { continue; } }
    const n = (src.match(자리표()) || []).length;
    if (!n) { if (f === 'Code.js' && codeSrcAfter !== undefined) 쓸것.push([p, src]); continue; }
    // 라벨(`·E²`)은 그대로 두고 번호만 갈아 끼운다 — 자리표가 없으면 라벨 그룹은 undefined 다.
    쓸것.push([p, src.replace(자리표(), (_, 라벨) => '[' + ver + (라벨 || '') + ']')]);
    바뀐것.push(f + '×' + n);
  }
  // 전부 계산한 뒤에 쓴다 — 중간에 실패하면 절반만 바뀐 상태가 남는다
  for (const [p, s] of 쓸것) fs.writeFileSync(p, s);
  return 바뀐것;
}

/** `--check` — 지금 상태가 CI 를 빨갛게 만드는가. 되돌림 비용 0이라 아무 때나 돌려도 된다. */
function check() {
  const 문제 = [];
  const cur = versionOf(fs.readFileSync(codePath(), 'utf8'));
  const 남은 = pendingPlaceholders();
  if (남은.length) 문제.push('[vNEXT] 자리표가 남아 있다(`[vNEXT·라벨]` 포함): ' + 남은.join(', ') + ' → 커밋 전에 `--desc` 로 채번하면 함께 확정된다');
  const curN = cur ? Number(String(cur).replace(/^v9\./, '')) : null;
  const max = maxTagInEngines();
  if (curN !== null && max !== null && curN !== max) {
    문제.push(`SYNK_VERSION ${cur} ≠ 엔진 최고 태그 v9.${max}`
      + (max > curN ? ' — 태그를 먼저 박았다. `[vNEXT]` 로 적고 채번에 맡겨라(그 사이 CI 가 빨개지고 남의 배포까지 막힌다)'
                    : ' — 상수만 올랐다. `--desc` 없이 돌렸을 때 이렇게 된다'));
  }

  // 세 번째 다리 — 여기가 어긋나도 CI 는 똑같이 빨개진다(F082)
  const docMax = maxTagInHistoryDoc();
  if (curN !== null && docMax !== null && docMax !== curN) {
    문제.push(`docs/버전_이력.md 최고 태그 v9.${docMax} ≠ SYNK_VERSION ${cur}`
      + (docMax < curN ? ' — 채번했는데 이력 줄을 안 썼다. 그 파일 **맨 아래**에 `[' + cur + '] 한 줄 요약` 을 추가하라(/deploy 5단계)'
                       : ' — 이력에 없는 번호를 적었다. 상수와 같은 번호로 맞춰라'));
  }
  const 박힌머리말 = hardcodedHeadVersion();
  if (박힌머리말) {
    문제.push(`docs/버전_이력.md 머리말에 「${박힌머리말}」이 박혀 있다 — 아무도 안 고쳐서 반드시 낡는다`
      + '(실측: 36개 버전 뒤처진 채 이틀). 현재 버전은 맨 아래 마지막 항목이 말한다');
  }

  if (문제.length) { 문제.forEach((m) => console.error('✗ ' + m)); return 1; }
  /* ⚠ 검사한 것만 검사했다고 말한다 — 「통과」와 「미실행」이 같은 문장이면 초록이 거짓말을 한다.
   *   픽스처 루트에는 이력 문서가 없으므로 그 경우를 침묵으로 덮지 않는다. */
  console.log('✅ 버전 표기 일치 — SYNK_VERSION ' + cur + ' = 엔진 최고 태그 · 배포 집합 '
    + 배포파일들().length + '개에서 [vNEXT] 잔존 0'
    + (docMax === null ? ' · ⚠docs/버전_이력.md 없음 — 이력 다리는 검사하지 않았다'
                       : ' · 이력 문서 v9.' + docMax + ' 일치'));
  return 0;
}

function main(argv) {
  if (argv.includes('--check')) { const c = check(); if (c) process.exitCode = c; return c; }

  const dry = argv.includes('--dry');
  const di = argv.indexOf('--desc');
  const desc = di >= 0 ? argv[di + 1] : '';

  /* 🔑 채번 **전에** 막는다 — 아래 push 로 번호를 확보한 뒤에 throw 하면 그 번호는 영영 태워진다.
   *   desc 없이 상수만 올리는 것은 「실수」가 아니라 **반드시 CI 를 빨갛게 만드는 상태**다. */
  if (!dry && !desc) {
    throw new Error('--desc "한 줄 요약" 이 필요합니다 — 없이 돌리면 상수만 오르고 [v9.N] 체인 항목이 안 붙어 '
      + 'CI 가 즉시 빨개집니다(safety [v9.55]). 번호만 미리 보려면 --dry 를 쓰세요.');
  }
  const ti = argv.indexOf('--toil');
  const toilSpec = ti >= 0 ? argv[ti + 1] : '';
  // 형식 오류는 **채번 전에** 잡는다 — 채번 뒤에 터지면 번호는 예약됐는데 기록은 없는 상태가 된다
  if (toilSpec) require('./toil.js').parseSpec(toilSpec);

  /* ═══ 시스템 대장 게이트 (2026-08-05 유호님 "구축할 때마다 기록을 남기는 시스템") ═══
   * 기록 장치를 자발 호출로 두면 안 돈다 — --toil 과 같은 이유로 유일 통로(채번)에 박되, 이건 강제다:
   * 매 채번이 「이 버전이 무엇인가(신설|보강|수리)」를 선언해야 하고, 신설이면 대외 언어 한 줄이
   * docs/시스템_대장.md 에 남는다. 검증은 전부 채번 **전**(뒤에서 터지면 번호만 탄다), 기입은 채번 뒤. */
  const 값 = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] || '' : ''; };
  const 종류 = 값('--종류');
  if (!dry && !종류) {
    throw new Error('--종류 신설|보강|수리 가 필요합니다 — 시스템 대장(docs/시스템_대장.md)에 기록을 남기는 게이트입니다.\n'
      + '    수리(버그·오류 수정):          --종류 수리\n'
      + '    보강(기존 시스템에 살 붙임):   --종류 보강 --시스템 "대장의 그 이름"\n'
      + '    신설(새 시스템·기능 구축):     --종류 신설 --시스템 "이름" --한줄 "대외 언어 한 줄" --구역 "접수·상담"\n'
      + '    구역 목록·형식은 docs/시스템_대장.md 머리말에 있습니다.');
  }
  if (종류 && !['신설', '보강', '수리'].includes(종류)) {
    throw new Error('--종류 는 신설|보강|수리 중 하나입니다(받은 값: ' + 종류 + ')');
  }
  const 대장도구 = require('./시스템대장.js');
  const 대장파일 = path.join(rootDir(), 'docs', '시스템_대장.md');
  const 대장스펙 = 종류 === '신설'
    ? { 구역: 값('--구역'), 시스템: 값('--시스템'), 한줄: 값('--한줄') }
    : (종류 === '보강' && 값('--시스템') ? { 시스템: 값('--시스템') } : null);
  if (!dry && 대장스펙) {
    const md = fs.readFileSync(대장파일, 'utf8');   // 파일이 없으면 여기서 죽는다 — 채번 전이라 번호는 안전
    if (종류 === '신설') 대장도구.신설검증(md, 대장스펙);
    else 대장도구.최근갱신(md, { ...대장스펙, 버전: 'v9.0' });   // 행 존재만 검증하고 결과는 버린다
  }

  // gitQuiet는 실패 시에만 null을 준다(성공 시 빈 문자열일 수 있으므로 !로 판정하면 항상 실패로 읽힌다)
  if (gitQuiet(['fetch', 'origin', '--tags', '--quiet']) === null) {
    // 오프라인이어도 로컬 정보만으로 계속한다 — 다만 예약(push)은 실패할 것이므로 경고한다
    console.error('⚠ origin fetch 실패 — 로컬 정보만으로 계산합니다(예약은 실패할 수 있음)');
  }

  const used = collectUsedVersions();
  if (!used.length) throw new Error('기준 버전을 한 곳에서도 읽지 못했습니다 — 저장소 상태를 확인하세요');
  const top = maxVer(used.map((u) => u.v));
  const topWhere = used.filter((u) => cmpVer(u.v, top) === 0).map((u) => u.where).join(', ');
  console.log('현재 최고 버전: ' + top + '  (' + topWhere + ')');

  let cand = nextVer(top);
  if (dry) { console.log('다음 번호(예약 안 함): ' + cand); return cand; }

  for (let i = 0; i < MAX_TRIES; i++) {
    const tag = TAG_PREFIX + cand;
    /* `-a` 가 F201 의 전부다 — 라이트웨이트 태그는 커밋을 가리키는 이름일 뿐이라, 같은 커밋 위의
     * 두 세션이 만든 태그가 **같은 객체**가 되고 두 번째 push 가 no-op 으로 **성공한다**(= 락이
     * 조용히 안 문다 · friction.js 에서 실측). 세션 고유 메시지로 SHA 를 갈라 정직하게 거절되게 한다. */
    try { git(['tag', '-a', tag, '-m', '예약 ' + cand + ' · ' + 예약자()], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (_) {
      // 실패 사유를 가른다 — 「이미 있음」과 「태그를 못 만든다」를 합치면 25회 헛돌고 틀린 진단이 나온다(F196)
      if (gitQuiet(['rev-parse', '--verify', '--quiet', 'refs/tags/' + tag]) === null) {
        throw new Error('예약 태그를 만들지 못했다 — git 사용자 정보(user.name·user.email)가 없거나 태그 생성이 막혔다: ' + tag);
      }
      cand = nextVer(cand); continue;                      // 로컬에 이미 있음 → 다음 후보
    }

    try {
      git(['push', 'origin', tag], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      gitQuiet(['tag', '-d', tag]);
      /* 거절을 「선점」으로 단정하지 않는다(F196) — friction 과 갈래가 **반대**인 이유는 대가가 반대라서다:
       * 신고문은 유실이 더 나쁘니 미예약으로 진행하지만, 버전은 예약 없이 확정하면 남의 배포까지 막는다(F078).
       * 그래서 여기서는 **빨리, 맞는 사유로** 멈춘다 — 25회 헛돌며 「origin 접근을 확인하세요」라는 틀린
       * 진단을 내는 것이 옛 동작이었다. 못 쟀을 때(null)는 단정하지 않고 옛 갈래(재시도)에 맡긴다. */
      if (선점인가(tag, gitQuiet) === false) {
        throw new Error('태그 push 가 거절됐는데 origin 에 ' + tag + ' 가 없다 — 선점이 아니라 **태그 push 자체가 막힌 환경**이다'
          + '(클라우드/폰 세션의 git 프록시는 지정 claude/* 밖 push 를 거부한다 · F196).\n'
          + '   → 여기서 번호를 확정하지 않는다. 헤더를 [vNEXT] 로 둔 채 커밋하면 PC 세션이 반입 때 채번한다.');
      }
      cand = nextVer(cand);                                // 원격이 갖고 있다 = 누가 방금 가져갔다
      continue;
    }

    const src = fs.readFileSync(CODE, 'utf8');
    // [F017] origin/master의 **현재** 줄을 함께 넘긴다 — 위에서 이미 fetch했으므로 최신이다.
    // 못 읽으면(오프라인·초기 저장소) null이 가고 병합은 건너뛴다. 병합 실패가 채번을 막지는 않는다.
    const originSrc = gitQuiet(['show', 'origin/master:Code.js']);
    /* 상수 줄과 엔진 파일들의 `[vNEXT]` 를 **한 실행에서** 확정한다.
     * 계산을 전부 끝낸 뒤 쓰기 때문에, 중간에 죽어도 절반만 확정된 상태가 남지 않는다. */
    const 새Code = replaceVersionLine(src, cand, desc, originSrc);
    const 찍은것 = stampPlaceholders(cand, 새Code);
    console.log('✅ 예약 완료: ' + cand + '  (태그 ' + tag + ' origin push 성공 = 이 번호는 내 것)');
    console.log('   Code.js SYNK_VERSION 기입됨'
      + (찍은것.length ? ' · [vNEXT] → [' + cand + '] 확정: ' + 찍은것.join(', ') : '')
      + '. 커밋 제목과 docs/버전_이력.md에 [' + cand + ']를 쓰세요.');
    /* [F390 ②③] **분모를 밝히고** 남은 자리표는 여기서 말한다.
     * 옛 판은 「확정: (두 파일)」이라고만 말하고 「나머지는 안 봤다」고는 말하지 않았다 —
     * 미실행이 완료와 같은 모양이면 초록이 거짓말을 한다(F207). 그래서 자리표가 남은 것은
     * 몇 분 뒤 CI 적색으로만 드러났고, 그 적색은 그 사이 **남의 배포 게이트까지** 막았다(F078).
     * 처방을 아는 도구가 처방을 안 하고 남에게 적색을 전가하는 모양이었다.
     * ⚠ 종료코드는 건드리지 않는다 — 번호는 이미 origin 이 보증했다. 여기서 실패로 끝내면
     *   다음 세션이 번호를 또 태운다(손일 장부 기입과 같은 원칙). 말은 하되 되돌리지 않는다. */
    const 남은자리표 = pendingPlaceholders();
    const 확정자리 = 찍은것.reduce((a, s) => a + (Number(String(s).split('×')[1]) || 0), 0);
    console.log('   배포 집합 ' + 배포파일들().length + '개 파일 훑음 · ' + 확정자리 + '자리 확정 · 남은 자리표 '
      + (남은자리표.length ? 남은자리표.length + '건 → ' + 남은자리표.join(', ') : '0'));
    if (남은자리표.length) {
      console.error('   🔴 자리표가 남은 채다 — 이대로 커밋하면 자리표가 라이브로 나간다(F309·F310 실사고).');
      console.error('      그 파일들의 자리표를 [' + cand + '] 로 갈아 끼우고 `node tools/bump-version.js --check` 로 확인하라.');
    }
    /* 🔑 지시만 하지 말고 **지금 상태를 재서** 말한다(F082). 위 한 줄은 v9.116 부터 있었는데도
     *   이력 줄 누락으로 CI 가 빨개진 적이 있다 — 「쓰세요」는 안 썼는지를 보지 않기 때문이다.
     *   여기가 유일하게 확실한 발화 지점이다: 채번한 사람이 지금 이 화면을 보고 있다. */
    const docMax = maxTagInHistoryDoc();
    if (docMax !== null && docMax !== parseVer(cand)[1]) {
      console.log('   ⚠ 이력 문서 최고는 아직 v9.' + docMax + ' — 그 파일 **맨 아래**에 한 줄 추가하기 전까지'
        + ' CI 는 빨갛고 남의 배포까지 막힌다. 확인은 `node tools/bump-version.js --check`.');
    }

    /* 손일 장부 기입 — 번호가 확정된 뒤에 한다(장부의 ID가 곧 이 번호다).
     * ⚠ 장부 기입 실패가 채번을 되돌리지 않는다 — 번호는 이미 origin이 보증했고,
     *   여기서 throw하면 「예약은 됐는데 실패로 보이는」 상태가 되어 다음 세션이 번호를 또 태운다.
     *   friction.js와 같은 원칙: 기록이 도구 사정으로 멈추면 안 되고, 멈췄으면 드러내야 한다. */
    if (toilSpec) {
      try { require('./toil.js').add(cand, toilSpec); }
      catch (e) {
        console.error('⚠ 손일 장부 기입 실패(번호는 유효): ' + ((e && e.message) || e));
        console.error('   손으로: node tools/toil.js add ' + cand + ' "' + toilSpec + '"');
      }
    }

    /* 시스템 대장 기입 — toil 과 같은 원칙: 기입 실패가 채번을 되돌리지 않고, 멈췄으면 드러낸다. */
    if (대장스펙) {
      try {
        const md = fs.readFileSync(대장파일, 'utf8');
        const 새md = 종류 === '신설'
          ? 대장도구.기입(md, { ...대장스펙, 버전: cand })
          : 대장도구.최근갱신(md, { ...대장스펙, 버전: cand });
        fs.writeFileSync(대장파일, 새md);
        console.log(종류 === '신설'
          ? '   시스템 대장 기입: 「' + 대장스펙.시스템 + '」 → ' + 대장스펙.구역 + ' (🟡 반영 대기 — 라이브 확인 후 🟢로)'
          : '   시스템 대장 갱신: 「' + 대장스펙.시스템 + '」 최근 = [' + cand + ']');
      } catch (e) {
        console.error('⚠ 시스템 대장 기입 실패(번호는 유효): ' + ((e && e.message) || e));
        console.error('   손으로: docs/시스템_대장.md 해당 구역 표에 | 🟡 반영 대기 | '
          + (대장스펙.시스템 || '?') + ' | 한 줄 | [' + cand + '] | [' + cand + '] | 추가');
      }
    }
    return cand;
  }
  throw new Error(MAX_TRIES + '회 시도했으나 번호를 확보하지 못했습니다 — origin 접근을 확인하세요');
}

module.exports = {
  parseVer, cmpVer, maxVer, nextVer, versionOf, replaceVersionLine, collectUsedVersions, main, 선점인가,
  chainEntries, mergeChain, entryVer,
  engineFiles, 배포파일들, maxTagInEngines, 자리표자리, pendingPlaceholders, stampPlaceholders, check,
  historyDocPath, maxTagInHistoryDoc, hardcodedHeadVersion,
};

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
