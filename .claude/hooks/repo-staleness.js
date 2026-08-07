#!/usr/bin/env node
'use strict';
/* repo-staleness — 내가 보고 있는 판이 `origin/master` 보다 얼마나 낡았나 (PreToolUse: Edit|Write|MultiEdit).
 *
 * 🔴 2026-08-07 실측(F192)이 이 훅의 존재 이유다. 클라우드(폰) 세션이 clone 시점 판으로 일하는 동안
 *   PC 세션들이 master 를 밀었다: 폰 브랜치가 **34 커밋 뒤 · 36분 전 판**인 채로 `docs/세션보드.md` 를
 *   편집했다. 그대로 반입하면 그 사이 남이 쓴 보드 줄이 **삭제로** 실린다(F187 과 같은 형태).
 *
 * 🔑 왜 로컬 충돌 장치로는 못 잡나 — `작업본소유자.js`·`track-collision.js` 는 **이 기계의**
 *   파일 mtime 과 세션 로그를 읽는다. 클라우드 세션의 작업 트리는 다른 기계에 있어서, 그 둘은
 *   폰을 **원리상** 못 본다(반대도 같다). 기계를 건너 남는 유일한 흔적은 커밋뿐이고, 커밋은
 *   `origin` 을 통해서만 보인다. 그래서 이 훅은 파일이 아니라 **ref 거리**를 잰다.
 *
 * 🔑 발화 자리를 Edit·Write 로 고른 이유: 뒤처짐이 사고로 바뀌는 순간은 「편집을 시작할 때」다.
 *   SessionStart 는 못 쓴다 — 클라우드 세션은 **시작 시점엔 최신**이고, 뒤처짐은 30분 뒤에 생긴다.
 *   커밋 시점은 늦다(이미 뒤처진 판 위에서 다 만든 뒤다).
 *
 * ⚠ **가드가 아니라 알림이다** — 절대 작업을 세우지 않는다. 뒤처짐은 차단 사유가 아니고,
 *   차단하면 폰 세션이 아무것도 못 한다. 알면 스스로 fetch 한다.
 *
 * ⚠ 침묵 조건은 **뒤처짐 0** 하나다. 실측상 PC 세션은 작업 트리를 공유해 거의 항상 0이라
 *   소음이 안 난다 — 울리는 것은 기계를 건넌 판뿐이다.
 *
 * ⚠ repo 밖 환경(네트워크·origin)에 기대므로 CI 에서는 잴 것이 없다 — 그때는 **조용히 통과**하고
 *   탐지력은 픽스처 회귀(`tests/저장소뒤처짐.test.js`)가 진다.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const 기준 = 'origin/master';
const 보드 = 'docs/세션보드.md';
/* fetch 는 네트워크라 매 편집마다 물릴 수 없다. 5분 = 실측 세션보드 변경 간격 중앙값(3분)보다
 * 조금 길게 — 더 짧게 잡아도 얻는 것이 없고, 더 길면 그 사이 보드가 두 번 넘게 바뀐다. */
const 조용한간격_MS = 5 * 60 * 1000;

function g(args, cwd, ms = 5000) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: ms, stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/** 뒤처짐 판정 — **정본 1개**. 회귀는 사본을 들지 말고 이 함수를 부른다(F045: 갈라지면 통과 쪽으로 샌다).
 *  반환: null = 잴 수 없음(origin 없음·git 아님) · `{ 뒤: 0 }` = 최신 · `{ 뒤, 나이분, 보드변경 }`.
 *  `fetch:false` 는 **테스트 전용 이음매**가 아니다 — 네트워크가 없는 환경에서도 로컬 ref 로 재라는 뜻이다. */
function 재다(cwd, { fetch: 가져오나 = true } = {}) {
  try { g(['rev-parse', '--verify', '--quiet', `${기준}^{commit}`], cwd); }
  catch (_) { return null; }   // origin/master 가 없으면 잴 것이 없다
  if (가져오나) {
    // 못 가져와도 판정은 한다 — 로컬 ref 로만 재면 뒤처짐을 **작게** 본다(안전한 방향은 아니지만 조용한 실패보단 낫다)
    try { g(['fetch', 'origin', 'master', '--quiet'], cwd, 8000); } catch (_) { /* 네트워크 없음 */ }
  }
  let 뒤;
  try { 뒤 = Number(g(['rev-list', '--count', `HEAD..${기준}`], cwd)); }
  catch (_) { return null; }
  if (!Number.isFinite(뒤) || 뒤 === 0) return { 뒤: 0 };

  let 나이분 = null;
  let 보드변경 = null;
  try {
    /* 나이는 **HEAD 시각이 아니라 갈라진 지점**부터 잰다 — 내 커밋이 새것이어도 내가 **보고 있는 판**은
     * 갈라진 그 시점이다. HEAD 로 재면 방금 커밋한 폰 세션이 「0분 전 판」으로 나온다. */
    const mb = g(['merge-base', 'HEAD', 기준], cwd);
    const 끝 = Number(g(['log', '-1', '--format=%ct', 기준], cwd));
    const 시작 = Number(g(['log', '-1', '--format=%ct', mb], cwd));
    if (Number.isFinite(끝) && Number.isFinite(시작)) 나이분 = Math.round((끝 - 시작) / 60);
  } catch (_) { /* 부가 정보다 — 없어도 알린다 */ }
  try { 보드변경 = Number(g(['rev-list', '--count', `HEAD..${기준}`, '--', 보드], cwd)); }
  catch (_) { /* 같다 */ }
  return { 뒤, 나이분, 보드변경 };
}

/** 알림 본문 — 숫자만 주면 무엇을 할지 모른다. **다음 한 수**를 같이 준다(F055: 셀 수 있는 단위로). */
function 본문(r) {
  const 곁 = [
    r.나이분 != null ? `${r.나이분}분 전 판` : null,
    r.보드변경 ? `그 사이 세션보드 **${r.보드변경}번** 바뀜` : null,
  ].filter(Boolean).join(' · ');
  return `[repo-staleness] 내 판이 \`${기준}\` 보다 **${r.뒤} 커밋 뒤**다${곁 ? ` (${곁})` : ''}.\n\n`
    + '지금 편집을 시작하면 **다른 세션이 이미 잡은 트랙**을 모르고 고르게 된다 — 이 저장소는\n'
    + '커밋 간격 중앙값 1분·세션보드 3분이라(2026-08-07 실측), 뒤처짐은 곧 「남이 뭘 하는지 모름」이다.\n'
    + '뒤처진 판 위의 공유 문서 편집은 반입될 때 남의 줄을 **삭제로** 싣는다(F187·F192).\n\n'
    + '→ 트랙을 고르기 전에:\n'
    + `   git fetch origin master && git log --oneline HEAD..${기준} -- ${보드}\n`
    + '→ 클라우드(폰) 세션이면 `claude/*` 브랜치라 master 로 직접 못 민다 — 코드보다 **판정·읽기**에 쓴다.';
}

module.exports = { 재다, 본문, 조용한간격_MS, 기준, 보드 };

if (require.main !== module) return;

let 입력 = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { 입력 += c; });
process.stdin.on('end', () => {
  let ev = {};
  try { ev = JSON.parse(입력 || '{}'); } catch (_) { process.exit(0); }
  const cwd = ev?.cwd || ROOT;

  /* throttle — 못 쓰면 **매번 검사한다**(느릴 뿐 안전한 방향). 조용히 안 재는 쪽으로 새면
   * 통과와 미실행이 같은 모양이 된다(F193 이 정확히 그 자리에서 났다). */
  let 표 = null;
  try {
    const store = require(path.join(__dirname, 'lib', 'handoff-store.js'));
    표 = path.join(store.stateDir(),
      `staleness-${store.projectKey(cwd)}-${store.safeId(process.env.CLAUDE_CODE_HOST_SESSION_ID || 'nosid')}.json`);
    const 최근 = Number(JSON.parse(fs.readFileSync(표, 'utf8')).at);
    if (Number.isFinite(최근) && Date.now() - 최근 < 조용한간격_MS) process.exit(0);
  } catch (_) { /* 없거나 못 읽으면 잰다 */ }

  let r;
  try { r = 재다(cwd); } catch (_) { process.exit(0); }

  if (표) {
    try {
      fs.mkdirSync(path.dirname(표), { recursive: true });
      fs.writeFileSync(표, JSON.stringify({ at: Date.now() }));
    } catch (_) { /* 못 써도 판정은 이미 했다 */ }
  }

  if (!r || !r.뒤) process.exit(0);   // 최신이거나 잴 수 없으면 조용히 — 소음은 알림을 죽인다

  process.stdout.write(JSON.stringify({
    systemMessage: `⚠ 내 판이 ${기준} 보다 ${r.뒤} 커밋 뒤다`,
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 본문(r) },
  }));
  process.exit(0);
});
