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
function replaceVersionLine(src, newVer, desc) {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith('const SYNK_VERSION'));
  if (i < 0) throw new Error('SYNK_VERSION 선언을 찾지 못함');
  let line = lines[i].replace(/const SYNK_VERSION = '[^']+'/, "const SYNK_VERSION = '" + newVer + "'");
  if (desc) {
    const head = line.split('//')[0];
    line = head + '// 전체 이력 = docs/버전_이력.md (새 버전은 그 파일 맨 아래에 추가) · 최신 ['
         + newVer + '] ' + desc;
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
    fs.writeFileSync(CODE, replaceVersionLine(src, cand, desc));
    console.log('✅ 예약 완료: ' + cand + '  (태그 ' + tag + ' origin push 성공 = 이 번호는 내 것)');
    console.log('   Code.js SYNK_VERSION 기입됨. 커밋 제목·태그·docs/버전_이력.md에 [' + cand + ']를 쓰세요.');
    return cand;
  }
  throw new Error(MAX_TRIES + '회 시도했으나 번호를 확보하지 못했습니다 — origin 접근을 확인하세요');
}

module.exports = { parseVer, cmpVer, maxVer, nextVer, versionOf, replaceVersionLine, collectUsedVersions, main };

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
