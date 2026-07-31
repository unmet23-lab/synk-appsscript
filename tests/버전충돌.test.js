/* [v9.95] 버전 번호 선점 감시 — 워크트리 병렬에서 같은 번호를 두 세션이 쓰는 사고 차단.
 *
 * 왜: 같은 사고가 세 번 났다.
 *   ① 2026-07-31 워크트리 병렬 rebase 충돌  ② 같은 날 버전 동시 발번
 *   ③ 2026-08-01 v9.94를 두 세션이 각자 발번(반 편성 / 폼 고아 방지) → 병합 시점에야 발각
 * 세 번이면 실수가 아니라 시스템 결함이다(CLAUDE.md 「신뢰성」). 발각 시점을 **병합 → 커밋 전**으로 당긴다.
 *
 * 규칙: Code.js가 원격 master와 다르면, SYNK_VERSION도 그보다 커야 한다.
 *   - 같으면(내가 Code.js를 안 건드림) 검사 안 함
 *   - 원격 ref가 없거나 git이 없으면 조용히 통과(오프라인·새 클론에서 배포를 막지 않는다)
 *   - 워크트리 병렬을 잡으려면 로컬 master도 함께 본다 — 옆 세션이 push 전에 커밋만 해둔 경우가 실제 사례였다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const local = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');

function versionOf(src) {
  const m = src.match(/const SYNK_VERSION = '([^']+)'/);
  return m ? m[1] : null;
}

const norm = (s) => String(s).replace(/\r\n/g, '\n');

// 'v9.95' → [9, 95] · 자리수가 달라도 비교가 깨지지 않게 숫자열로 다룬다
function parts(v) {
  return String(v || '').replace(/^v/, '').split('.').map((n) => Number(n) || 0);
}
function cmp(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
}

// ⚠ maxBuffer 필수 — Code.js는 931KB이고 한글이 멀티바이트라 기본 1MB를 넘긴다.
//   이게 없으면 git이 ENOBUFS로 죽고 catch가 null을 돌려줘 **검사가 조용히 통과한다**(초안에서 실제로 그랬다).
const GIT_OPTS = { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 };

function codeAt(ref) {
  try {
    const out = execFileSync('git', ['show', `${ref}:Code.js`], GIT_OPTS);
    return out && out.length > 1000 ? out : null; // 잘렸거나 빈 응답이면 판단 근거로 쓰지 않는다
  } catch {
    return null; // ref 없음·git 없음·새 클론 — 배포를 막지 않는다
  }
}

// 가드 자신이 죽어 있지 않은지 먼저 확인한다 — 위 ENOBUFS처럼 조용히 통과하는 실패가 가장 위험하다
test('[v9.95] 버전 가드가 실제로 원격 Code.js를 읽을 수 있다 (조용한 무력화 감시)', () => {
  const refs = ['origin/master', 'master'].map(codeAt).filter(Boolean);
  if (!refs.length) return; // git·ref 자체가 없는 환경은 정당한 스킵
  refs.forEach((src) => assert.ok(versionOf(src), '원격 Code.js에서 SYNK_VERSION을 못 읽었다 — 가드가 무력화된 상태다'));
});

test('[v9.95] Code.js를 고쳤으면 SYNK_VERSION은 다른 세션이 이미 쓴 번호보다 커야 한다', () => {
  const mine = versionOf(local);
  assert.ok(mine, 'SYNK_VERSION을 못 찾음');

  ['origin/master', 'master'].forEach((ref) => {
    const other = codeAt(ref);
    if (other === null) return;              // 그 ref가 없으면 건너뜀
    // ⚠ 줄바꿈 정규화 필수 — git show는 LF, 작업본은 CRLF(.gitattributes 변환)라
    //   그대로 비교하면 **손도 안 댄 파일이 매번 "다르다"로 잡혀** 정상 상태에서 오경보가 난다.
    if (norm(other) === norm(local)) return;  // 내가 Code.js를 안 건드렸으면 검사 대상 아님
    const theirs = versionOf(other);
    if (!theirs) return;
    assert.ok(cmp(mine, theirs) > 0,
      `버전 선점 충돌 — ${ref}가 이미 ${theirs}인데 내 Code.js도 ${theirs} 이하(${mine})다.\n` +
      `  다른 워크트리가 그 번호를 먼저 썼을 수 있다. SYNK_VERSION과 내 [${theirs}] 태그를 한 단계 올린 뒤 다시 실행하라\n` +
      `  (남의 태그는 그대로 둘 것 — 번호가 겹친 두 작업의 이력은 각자 보존한다).`);
  });
});
