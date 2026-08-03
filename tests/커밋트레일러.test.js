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

const ROOT = path.join(__dirname, '..');
const HOOK_SRC = path.join(ROOT, 'tools', 'githooks', 'prepare-commit-msg');
const SID = 'local_11111111-2222-3333-4444-555555555555';

function git(cwd, args, env) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: '', ...(env || {}) },
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

test('amend해도 트레일러가 중복되지 않는다', (t) => {
  let dir;
  try { dir = mkRepo(); } catch (e) { return t.skip('픽스처 생성 실패: ' + e.message); }

  commit(dir, 'd.txt', '작업 셋', { CLAUDE_CODE_HOST_SESSION_ID: SID });
  git(dir, ['commit', '--amend', '-m', '작업 셋 (고침)'], { CLAUDE_CODE_HOST_SESSION_ID: SID });
  const all = git(dir, ['log', '-1', '--format=%B']);
  const hits = (all.match(/^Session-Id:/gm) || []).length;
  assert.equal(hits, 1, `Session-Id가 ${hits}번 박혔다 — amend마다 쌓이면 트레일러가 쓰레기가 된다`);
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
