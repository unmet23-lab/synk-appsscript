/* 커밋 세션 ID 트레일러 회귀 — 마찰 F041(커밋으로 세션을 특정할 수단이 없어 오귀속).
 *
 * 지키려는 성질:
 *   ① 세션에서 낸 커밋은 `Session-Id` 트레일러를 **트레일러로 읽을 수 있게** 갖는다
 *      (문자열이 파일 어딘가에 있는 것으로는 부족하다 — 문단이 갈리면 %(trailers)로 안 읽히고,
 *       그러면 박아도 못 찾아 목적이 통째로 무너진다. 그래서 git이 파싱하는지로 검사한다.)
 *   ② 환경변수가 없으면 아무것도 하지 않는다(유호님 손커밋·CI·타 도구를 방해하지 않는다)
 *   ③ 중복해서 붙지 않는다(amend·rebase)
 *
 * 이 검사는 **격리 픽스처 저장소**에서 돈다 — CI에는 이 훅이 설치돼 있지 않고, 실저장소에서
 * 돌리면 회귀가 진짜 커밋을 만들게 된다. 설치 여부는 마지막 검사가 skip으로 드러낸다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const store = require('../.claude/hooks/lib/handoff-store.js');

const ROOT = path.join(__dirname, '..');
const HOOK_SRC = path.join(ROOT, 'tools', 'githooks', 'prepare-commit-msg');
const SID = 'local_11111111-2222-3333-4444-555555555555';

function git(cwd, args, env) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    /* 🔑 **두 변수를 다** 비운다 — 훅이 `HOST` → `REMOTE` 로 폴백하므로(F628), 하나만 비우면
     *   이 검사가 «내가 도는 기계»에 따라 갈린다: 클라우드에선 REMOTE 가 실제로 있어
     *   「환경변수가 없으면 아무것도 안 한다」가 그 기계에서만 빨개진다(F296 그 자리다). */
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_REMOTE_SESSION_ID: '', ...(env || {}) },
  });
}

/** 훅이 설치된 1회용 저장소 — 진짜 커밋을 만들어 트레일러가 파싱되는지까지 본다. */
function mkRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidtrailer-'));
  git(dir, ['init', '-b', 'master']);
  git(dir, ['config', 'user.email', 'test@synk.local']);
  git(dir, ['config', 'user.name', 'test']);
  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const dst = path.join(hooks, 'prepare-commit-msg');
  fs.copyFileSync(HOOK_SRC, dst);
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows */ }
  return dir;
}

function commit(dir, name, msg, env) {
  fs.writeFileSync(path.join(dir, name), name, 'utf8');
  git(dir, ['add', name], env);
  git(dir, ['commit', '-m', msg], env);
  return git(dir, ['log', '-1', '--format=%(trailers:key=Session-Id,valueonly)']).trim();
}

test('세션 커밋은 Session-Id 트레일러를 갖고, git이 트레일러로 파싱한다', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 저장소 생성 실패(git 없음?): ' + e.message); }

  const got = commit(dir, 'a.txt', '작업 하나', { CLAUDE_CODE_HOST_SESSION_ID: SID });
  assert.equal(got, SID,
    '%(trailers:key=Session-Id)로 안 읽힌다 — 트레일러 문단이 갈렸거나 안 박혔다. 실제: ' + JSON.stringify(got));
});

test('본문 끝이 이미 트레일러(Co-Authored-By)여도 같은 문단에 붙는다', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const msg = '작업 둘\n\n설명 줄.\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>';
  const got = commit(dir, 'b.txt', msg, { CLAUDE_CODE_HOST_SESSION_ID: SID });
  assert.equal(got, SID, 'Co-Authored-By가 있을 때 트레일러로 안 읽힌다: ' + JSON.stringify(got));

  const co = git(dir, ['log', '-1', '--format=%(trailers:key=Co-Authored-By,valueonly)']).trim();
  assert.match(co, /Claude Opus 5/, '기존 Co-Authored-By 트레일러가 깨졌다: ' + co);
});

test('환경변수가 없으면 아무것도 하지 않는다 (손커밋·CI를 방해하지 않는다)', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const got = commit(dir, 'c.txt', '유호 손커밋', {});   // CLAUDE_CODE_HOST_SESSION_ID 빈 값
  assert.equal(got, '', '환경변수가 없는데 트레일러가 박혔다: ' + JSON.stringify(got));
  const body = git(dir, ['log', '-1', '--format=%B']).trim();
  assert.equal(body, '유호 손커밋', '본문이 변형됐다: ' + JSON.stringify(body));
});

/* ── F628 폴백 — 클라우드엔 `HOST` 가 아예 없다 ─────────────────────────────────
 * 실측 2026-08-18: 기준 `origin/master@ef6b0a41` 에서 **최신 194커밋 연속** 트레일러가 없었고,
 * 있는 126건은 전부 `local_` 접두였다 — 클라우드가 박은 적이 한 번도 없다. 가드가 조용히
 * `exit 0` 하던 자리다(새는 방향이 「아무 일도 안 남」이라 아무도 못 봤다). */
const REMOTE = 'cse_01Fi49nN7q4mpXF7RsLDkqeZ';

test('🔴 F628 — HOST 가 없으면 REMOTE 로 폴백해 박는다 (클라우드의 기본 상태)', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const got = commit(dir, 'f628-a.txt', '클라우드 커밋', { CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE });
  assert.equal(got, REMOTE,
    'HOST 가 없을 때 트레일러가 안 박혔다 — 클라우드 커밋이 다시 주인 없이 쌓인다: ' + JSON.stringify(got));
});

test('🔑 F628 — HOST 가 있으면 HOST 가 이긴다 (폴백은 «없을 때만»)', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const got = commit(dir, 'f628-b.txt', '노트북 커밋',
    { CLAUDE_CODE_HOST_SESSION_ID: SID, CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE });
  assert.equal(got, SID,
    '폴백이 우선순위를 뒤집었다 — 노트북에서 박히던 값이 바뀌면 옛 커밋과 새 커밋의 주인이 갈린다: ' + JSON.stringify(got));
});

test('🔑 F628 — `CLAUDE_CODE_SESSION_ID` 로는 «안» 내려간다 (트레일러의 뜻을 지킨다)', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  // 그건 메시지를 못 보내는 내부 에이전트 id 다 — 여기까지 폴백하면 트레일러가 「연락 가능한 id」에서
  // 「그냥 구분자」로 내려앉는다. 훅 머리말이 그 이유를 적어 뒀고, 이 검사가 그 문장을 못박는다.
  const got = commit(dir, 'f628-c.txt', '내부 id 뿐인 판',
    { CLAUDE_CODE_SESSION_ID: 'ad0673f3-a839-5087-86fd-4b5f602a093d' });
  assert.equal(got, '',
    '내부 에이전트 id 까지 폴백했다 — 그 값으로는 세션에 메시지를 못 보낸다: ' + JSON.stringify(got));
});

test('🔴 F628×F300 — 폴백 판에서도 축약형은 전체 id 로 교정된다 (변이가 뚫은 구멍)', (t) => {
  /* 변이 실측 2026-08-18: 교체 판정이 `$SID` 대신 옛 변수(`$CLAUDE_CODE_HOST_SESSION_ID`)를 보게
   * 망가뜨렸는데 13건이 전부 초록이었다 — 기존 F300 검사가 **전부 HOST 를 세팅**하고 돌아서
   * 두 값이 같았기 때문이다. 클라우드(HOST 없음)에서는 그 비교가 빈 문자열과 하는 비교가 되어
   * **교정이 통째로 죽는다**: 손으로 적은 축약형이 그대로 박히고, 그 커밋은 모든 소유 판별에서
   * 남의 것이 된다(F300 이 잡았던 바로 그 사고). 새는 방향은 여기서도 「통과」다. */
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const 축약 = 'cse_01Fi49nN';                   // REMOTE 의 접두사 = 보드 지문 자리
  const got = commit(dir, 'f628-d.txt', `클라우드 작업\n\nSession-Id: ${축약}`,
    { CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE });
  assert.equal(got, REMOTE,
    `폴백 판에서 축약형이 안 고쳐졌다(${JSON.stringify(got)}) — 이 커밋은 어느 세션과도 안 맞는다`);

  const hits = (git(dir, ['log', '-1', '--format=%B']).match(/^Session-Id:/gm) || []).length;
  assert.equal(hits, 1, `교체가 아니라 덧붙었다 — Session-Id 가 ${hits}줄이면 읽는 쪽이 갈린다`);
});

test('amend해도 트레일러가 중복되지 않는다', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  commit(dir, 'd.txt', '작업 셋', { CLAUDE_CODE_HOST_SESSION_ID: SID });
  git(dir, ['commit', '--amend', '-m', '작업 셋 (고침)'], { CLAUDE_CODE_HOST_SESSION_ID: SID });
  const all = git(dir, ['log', '-1', '--format=%B']);
  const hits = (all.match(/^Session-Id:/gm) || []).length;
  assert.equal(hits, 1, `Session-Id가 ${hits}번 박혔다 — amend마다 쌓이면 트레일러가 쓰레기가 된다`);
});

/* ── 손으로 적어 둔 트레일러 (마찰 F300) ─────────────────────────────────
 * `--if-exists doNothing` 은 **틀린 값도 그대로 뒀다.** 실측 2026-08-09: 커밋 메시지 파일 끝에
 * `Session-Id: local_c23ccb25`(보드 지문 8자리 — 트레일러와 **다른 식별자**다)를 손으로 적었더니
 * 훅이 비켜서 그게 박혔고, `track-collision` 이 즉시 「남의 커밋이 내 자리에 착지했다」고 알렸다.
 * 소유 판별은 전부 이 값을 문자열 그대로 비교하므로 축약형은 어떤 세션과도 안 맞는다.
 * 🔑 **양쪽을 같이 잰다** — 「축약형은 고친다」만 검사하면 `--if-exists replace` 로 통째로
 *    덮는 구현이 초록으로 지나가고, 그건 cherry-pick 에서 원저자 트레일러를 삼킨다. */

test('F300 손으로 적은 축약형 Session-Id 는 전체 id 로 교정된다', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const 축약 = 'local_11111111';                 // 보드 지문 = 트레일러의 진짜 접두사
  const got = commit(dir, 'e.txt', `작업 넷\n\nSession-Id: ${축약}`, { CLAUDE_CODE_HOST_SESSION_ID: SID });
  assert.equal(got, SID, `축약형이 그대로 남았다(${JSON.stringify(got)}) — 이 커밋은 모든 소유 판별에서 남의 것이 된다`);

  const hits = (git(dir, ['log', '-1', '--format=%B']).match(/^Session-Id:/gm) || []).length;
  assert.equal(hits, 1, `교체가 아니라 덧붙었다 — Session-Id 가 ${hits}줄이면 읽는 쪽이 어느 것을 믿을지 갈린다`);
});

test('F300 남의 완전한 Session-Id 는 덮지 않는다 (cherry-pick 이 이 훅을 부른다)', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  const 남의것 = 'local_99999999-8888-7777-6666-555555555555';
  const got = commit(dir, 'f.txt', `남이 만든 커밋\n\nSession-Id: ${남의것}`, { CLAUDE_CODE_HOST_SESSION_ID: SID });
  assert.equal(got, 남의것, '원저자 트레일러를 내 것으로 덮어썼다 — cherry-pick 한 커밋의 주인이 통째로 뒤바뀐다');
});

test('F300 같은 접두라도 어긋난 꼬리는 덮지 않는다 — 접두사일 때만 교체한다', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  /* 앞 8자리는 같은데 뒤가 다르다 = 내 id 의 접두사가 **아니다**. 지문 충돌한 남의 세션이
   * 이 모양이라, 앞자리만 보고 교체하면 그 커밋을 내 것으로 만든다. */
  const 비슷한남 = 'local_11111111-0000-0000-0000-000000000000';
  const got = commit(dir, 'g.txt', `앞자리만 같은 남의 커밋\n\nSession-Id: ${비슷한남}`,
    { CLAUDE_CODE_HOST_SESSION_ID: SID });
  assert.equal(got, 비슷한남, '앞자리만 보고 덮었다 — 지문이 겹친 남의 커밋을 내 것으로 만든다');
});

/* 배선 검사 — 훅은 버전 관리 밖(.git/hooks)에 살아서, 원본만 고치고 설치를 잊으면 조용히 안 돈다.
 * CI에는 애초에 설치돼 있지 않으므로 **실패가 아니라 skip**으로 드러낸다(통과와 미실행을 가른다). */
test('이 저장소에 훅이 설치돼 있고 원본과 같다', (t) => {
  let out;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'install-githooks.js'), '--check'],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    return t.skip('훅 미설치/드리프트 — node tools/install-githooks.js 로 설치한다. ' +
      String(e.stdout || '').trim());
  }
  assert.match(out, /최신/, out);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 형제 저장소 사본이 갈라지지 않는가 (2026-08-07)
 *
 * 왜: 이 훅은 이제 **두 저장소에 각자 산다** — appsscript 는 `tools/githooks/` 원본을
 *   `.git/hooks` 로 설치하고, SYNK-talk 은 `core.hooksPath=.githooks` 로 **자기 저장소 안에
 *   추적되는 사본**을 둔다(talk `5ff575e`). 설치기로 한쪽에서 다른 쪽에 밀어넣지 않는다 —
 *   그건 남의 저장소의 추적 파일을 덮는 짓이다.
 *
 *   그래서 남는 위험이 「사본 드리프트」다. 한쪽 훅만 고치면 **두 저장소의 주인 판정이 갈리고**,
 *   증상은 조용하다(트레일러가 한쪽에만 안 박히거나 다르게 박힌다). 더 나쁜 것은 **양쪽 다
 *   초록으로 보인다**는 점이다 — 각 저장소의 회귀는 자기 사본만 보기 때문이다.
 *   CLAUDE.md 신뢰성: 같은 판정을 두 곳에 적으면 갈라진다 · 목록은 하나에서 파생시킨다.
 *
 * 무엇을 비교하나: **실행되는 줄만**. 두 사본의 머리말은 각자 다른 사연을 적으므로 다른 것이
 *   정상이다(같기를 요구하면 거짓 경보가 되고, 거짓 경보를 내는 가드는 곧 꺼진다).
 *   셔뱅은 주석처럼 생겼지만 **어느 인터프리터로 도느냐**라 실행부에 남긴다.
 * ───────────────────────────────────────────────────────────────────────────── */

/** 주석·빈 줄을 걷어낸 실행부(셔뱅은 남긴다). */
function 실행부(원문) {
  const 줄 = String(원문).replace(/\r\n/g, '\n').split('\n');
  const 셔뱅 = 줄[0] && 줄[0].startsWith('#!') ? [줄[0].trim()] : [];
  const 본문 = 줄.slice(셔뱅.length)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  return [...셔뱅, ...본문].join('\n');
}

/* 탐지력은 픽스처가 진다 — 실저장소는 지금 같으므로, 여기서 못박지 않으면 `실행부`가
 * 전부를 지워 「언제나 같다」가 돼도 아래 검사는 초록이다(가드가 자기 눈을 감는 형태). */
test('실행부 비교가 코드 차이는 잡고 주석 차이는 안 잡는다 (픽스처)', () => {
  const 기준 = '#!/bin/sh\n# 사연 A\n[ -n "$X" ] || exit 0\nexit 0\n';
  const 주석만다름 = '#!/bin/sh\n# 사연 B — 이 저장소의 다른 이력\n\n[ -n "$X" ] || exit 0\nexit 0\n';
  const 코드다름 = '#!/bin/sh\n# 사연 A\n[ -n "$Y" ] || exit 0\nexit 0\n';
  const 셔뱅다름 = '#!/bin/bash\n# 사연 A\n[ -n "$X" ] || exit 0\nexit 0\n';

  assert.equal(실행부(기준), 실행부(주석만다름), '주석·빈 줄 차이를 드리프트로 오인한다(거짓 경보)');
  assert.notEqual(실행부(기준), 실행부(코드다름), '실행되는 줄이 다른데 같다고 한다 — 이 검사가 눈이 멀었다');
  assert.notEqual(실행부(기준), 실행부(셔뱅다름), '셔뱅 차이를 못 본다 — 도는 인터프리터가 다르면 다른 훅이다');
  assert.ok(실행부(기준).includes('exit 0'), '실행부가 통째로 비었다 — 그러면 무엇이든 같아진다');
});

/** 그 저장소에서 **실제로 도는** 훅의 자리. 설정을 읽는다 — 추적 위치를 추측하지 않는다. */
function 형제훅경로(뿌리) {
  const run = (args) => execFileSync('git', args, { cwd: 뿌리, encoding: 'utf8', stdio: 'pipe' }).trim();
  let dir = '';
  try { dir = run(['config', '--get', 'core.hooksPath']); } catch (_) { /* 미설정 = 기본 자리 */ }
  if (!dir) {
    try { dir = path.join(run(['rev-parse', '--git-common-dir']), 'hooks'); } catch (_) { return null; }
  }
  const p = path.resolve(뿌리, dir, 'prepare-commit-msg');
  return fs.existsSync(p) ? p : null;
}

/* 실저장소 쪽은 **거짓양성만** 검사한다(형제가 없는 CI 에서는 skip 으로 드러낸다 —
 * 통과와 미실행이 같은 모양이면 안 된다). 형제 좌표는 handoff-store 하나에서만 온다. */
test('형제 저장소의 prepare-commit-msg 사본이 실행부까지 같다', (t) => {
  const 형제 = store.siblings(ROOT);
  if (!형제.length) return t.skip('이 기계에 형제 저장소가 없다(CI) — 비교할 사본이 없다');

  const 본 = [];
  for (const { 뿌리, 저장소 } of 형제) {
    const p = 형제훅경로(뿌리);
    if (!p) { t.diagnostic(`${저장소}: prepare-commit-msg 없음 — 그 저장소 커밋엔 주인이 안 박힌다`); continue; }
    본.push(저장소);
    assert.equal(실행부(fs.readFileSync(p, 'utf8')), 실행부(fs.readFileSync(HOOK_SRC, 'utf8')),
      `${저장소} 의 훅 사본이 정본(tools/githooks/prepare-commit-msg)과 실행부가 다르다.\n` +
      `  → 두 저장소의 주인 판정이 갈린다. 사연(주석)은 각자 달라도 되지만 도는 줄은 같아야 한다.\n` +
      `  → 사본: ${p}`);
  }
  if (!본.length) return t.skip('형제는 있는데 훅 사본이 하나도 없다 — 위 diagnostic 참고');
});
