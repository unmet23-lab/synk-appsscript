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
 *   node tools/bump-version.js --desc "인센티브 배점 3지표 완성"   # 채번 + Code.js 기입
 *   node tools/bump-version.js --dry                              # 다음 번호만 조회(예약 안 함)
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

function main(argv) {
  const dry = argv.includes('--dry');
  const di = argv.indexOf('--desc');
  const desc = di >= 0 ? argv[di + 1] : '';

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
    try { git(['tag', tag], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (_) { cand = nextVer(cand); continue; }          // 로컬에 이미 있음 → 다음 후보

    try {
      git(['push', 'origin', tag], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      gitQuiet(['tag', '-d', tag]);                        // 원격이 거절 = 누가 방금 가져갔다
      cand = nextVer(cand);
      continue;
    }

    const src = fs.readFileSync(CODE, 'utf8');
    // [F017] origin/master의 **현재** 줄을 함께 넘긴다 — 위에서 이미 fetch했으므로 최신이다.
    // 못 읽으면(오프라인·초기 저장소) null이 가고 병합은 건너뛴다. 병합 실패가 채번을 막지는 않는다.
    const originSrc = gitQuiet(['show', 'origin/master:Code.js']);
    fs.writeFileSync(CODE, replaceVersionLine(src, cand, desc, originSrc));
    console.log('✅ 예약 완료: ' + cand + '  (태그 ' + tag + ' origin push 성공 = 이 번호는 내 것)');
    console.log('   Code.js SYNK_VERSION 기입됨. 커밋 제목·태그·docs/버전_이력.md에 [' + cand + ']를 쓰세요.');
    return cand;
  }
  throw new Error(MAX_TRIES + '회 시도했으나 번호를 확보하지 못했습니다 — origin 접근을 확인하세요');
}

module.exports = {
  parseVer, cmpVer, maxVer, nextVer, versionOf, replaceVersionLine, collectUsedVersions, main,
  chainEntries, mergeChain, entryVer,
};

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
