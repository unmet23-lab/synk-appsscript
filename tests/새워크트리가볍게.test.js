'use strict';
// 새 워크트리 가볍게(tools/새워크트리가볍게.js + tools/git훅/post-checkout) — 실제 sh 훅을 임시 저장소에 깔고 git worktree add로 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const 도구경로 = path.join(__dirname, '..', 'tools', '새워크트리가볍게.js');
const 도구 = require(도구경로);

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
delete process.env.SYNK_LIGHT_OFF;
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-light-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

const 깃 = (폴더, ...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const 있나 = (폴더, p) => fs.existsSync(path.join(폴더, p));
const 상태 = (폴더) => 깃(폴더, 'status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean);

function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, 경로);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}

/** 공용 작업본 하나 — 큰 미디어 폴더 셋과 남길 파일, 훅이 부를 도구(이 저장소의 진짜 도구를 부르는 대리 파일). */
function 새판(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-light-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 공용 = path.join(뿌리, '공용');
  fs.mkdirSync(공용);
  깃(공용, 'init', '-q', '-b', 'master');
  깃(공용, 'config', 'core.autocrlf', 'false');
  깃(공용, 'config', 'extensions.worktreeConfig', 'true');
  쓰기(공용, 'docs/캐릭터/정본_4K/까몽.png', Buffer.alloc(10, 2));
  쓰기(공용, 'docs/홍보물/x.mp4', Buffer.alloc(10, 3));
  쓰기(공용, 'docs/라디오/y.mp3', Buffer.alloc(10, 4));
  쓰기(공용, 'docs/남길.md', '남김\n');
  쓰기(공용, '.gitignore', '/.claude/\n');
  쓰기(공용, 'tools/새워크트리가볍게.js', `require(${JSON.stringify(도구경로)}).main(process.argv.slice(2)).then((c) => { process.exitCode = c; });\n`);
  깃(공용, 'add', '-A');
  깃(공용, 'commit', '-q', '-m', '바탕');
  const 판 = { 뿌리, 공용 };
  /** git worktree add를 그대로 부르고 종료 코드·폴더를 돌려준다. */
  판.워크트리 = (자리, { 바탕 = 'master', env = {} } = {}) => {
    const 폴더 = path.isAbsolute(자리) ? 자리 : path.join(공용, 자리);
    const 가지 = `claude/${path.basename(path.dirname(폴더))}-${path.basename(폴더)}`;
    const r = spawnSync('git', ['worktree', 'add', '-q', '-b', 가지, 폴더, 바탕], { cwd: 공용, encoding: 'utf8', env: { ...process.env, ...env } });
    return { 폴더, status: r.status, stderr: r.stderr };
  };
  판.기록 = () => {
    try { return fs.readFileSync(path.join(공용, '.git', 도구.기록이름), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_) { return []; }
  };
  return 판;
}

const 빠졌나 = (폴더) => ['docs/캐릭터/정본_4K/까몽.png', 'docs/홍보물/x.mp4', 'docs/라디오/y.mp3'].every((p) => !있나(폴더, p));
const 다있나 = (폴더) => ['docs/캐릭터/정본_4K/까몽.png', 'docs/홍보물/x.mp4', 'docs/라디오/y.mp3'].every((p) => 있나(폴더, p));

test('대상인가: 세션이 만든 워크트리 자리만', () => {
  assert.equal(도구.대상인가('C:/Users/a/Documents/SYNK-appsscript/.claude/worktrees/gifted-ritchie-b43998'), true);
  assert.equal(도구.대상인가('C:\\Users\\a\\Documents\\SYNK-appsscript\\.claude\\worktrees\\x'), true);
  assert.equal(도구.대상인가('C:/Users/a/.codex/worktrees/booking-safety-20261031/SYNK-appsscript'), true);
  assert.equal(도구.대상인가('C:/Users/a/Documents/SYNK-appsscript'), false, '공용 작업본');
  assert.equal(도구.대상인가('C:/Users/a/AppData/Local/SYNK/ops/SYNK-appsscript'), false, '운영 사본');
  assert.equal(도구.대상인가('C:/Users/a/AppData/Local/hermes/runtime/synk-tasks/synk-1/workspace'), false, '헤르메스 작업 폴더');
  assert.equal(도구.대상인가('C:/Users/a/Documents/SYNK-worktrees/company-analytics-read-20261018'), false, '손으로 만든 작업트리');
});

test('훅: 세션 워크트리를 만들면 큰 미디어 폴더가 빠지고 다른 파일·상태는 그대로', async (t) => {
  const 판 = 새판(t);
  const 깔기 = 도구.설치({ 저장소: 판.공용 });
  assert.equal(깔기.결과, '깔았다', JSON.stringify(깔기));
  assert.ok(!fs.readFileSync(깔기.자리, 'utf8').includes('\r'), '깐 훅은 LF');
  assert.equal(도구.설치({ 저장소: 판.공용 }).결과, '이미 깔림');
  assert.equal(도구.상태({ 저장소: 판.공용 }).깔림, true);

  const 클 = 판.워크트리('.claude/worktrees/a');
  assert.equal(클.status, 0, 클.stderr);
  assert.ok(빠졌나(클.폴더), 'Claude 워크트리에서 셋 다 빠짐');
  assert.equal(fs.readFileSync(path.join(클.폴더, 'docs/남길.md'), 'utf8'), '남김\n');
  assert.deepEqual(상태(클.폴더), []);
  assert.equal(깃(클.폴더, 'config', '--show-scope', '--get', 'core.sparseCheckout').split(/\s+/)[0], 'worktree', '그 워크트리 설정에만');
  assert.ok(다있나(판.공용), '공용 작업본은 그대로');

  const 지 = 판.워크트리(path.join(판.뿌리, '.codex', 'worktrees', 'b', 'SYNK-appsscript'));
  assert.equal(지.status, 0, 지.stderr);
  assert.ok(빠졌나(지.폴더), 'GPT 워크트리도 빠짐');

  const 밖 = 판.워크트리(path.join(판.뿌리, 'SYNK-worktrees', 'c'));
  assert.equal(밖.status, 0, 밖.stderr);
  assert.ok(다있나(밖.폴더), '세션 자리가 아닌 워크트리는 그대로');

  const 기록 = 판.기록();
  assert.equal(기록.length, 2, JSON.stringify(기록));
  assert.ok(기록.every((줄) => 줄.결과 === '가볍게 함' && 줄.파일 === 3), JSON.stringify(기록));
});

test('훅: 끈 때 · 이미 있는 워크트리의 checkout · 도구가 깨진 판에서는 아무것도 하지 않고 git을 막지 않는다', async (t) => {
  const 판 = 새판(t);
  도구.설치({ 저장소: 판.공용 });

  const 끔 = 판.워크트리('.claude/worktrees/off', { env: { SYNK_LIGHT_OFF: '1' } });
  assert.equal(끔.status, 0, 끔.stderr);
  assert.ok(다있나(끔.폴더), 'SYNK_LIGHT_OFF면 그대로');
  깃(끔.폴더, 'checkout', '-q', '-b', 'claude/off-2');
  assert.ok(다있나(끔.폴더), '이미 있는 워크트리에서 가지를 바꿔도 그대로(새 워크트리 때만)');

  // 도구가 던지는 판에서 워크트리를 만들어도 git worktree add는 성공한다
  쓰기(판.공용, 'tools/새워크트리가볍게.js', "throw new Error('깨짐');\n");
  깃(판.공용, 'commit', '-q', '-am', '깨진 도구');
  const 깨 = 판.워크트리('.claude/worktrees/broken');
  assert.equal(깨.status, 0, 깨.stderr);
  assert.ok(다있나(깨.폴더));

  // 도구가 없는 옛 판에서도 그대로
  fs.rmSync(path.join(판.공용, 'tools/새워크트리가볍게.js'));
  깃(판.공용, 'commit', '-q', '-am', '도구 없음');
  const 옛 = 판.워크트리('.claude/worktrees/old');
  assert.equal(옛.status, 0, 옛.stderr);
  assert.ok(다있나(옛.폴더));
  assert.deepEqual(판.기록(), []);
});

test('설치: 남의 post-checkout 훅은 덮지 않는다', (t) => {
  const 판 = 새판(t);
  const 자리 = path.join(판.공용, '.git', 'hooks', 'post-checkout');
  fs.writeFileSync(자리, '#!/bin/sh\necho 남의 훅\n');
  const r = 도구.설치({ 저장소: 판.공용 });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.equal(fs.readFileSync(자리, 'utf8'), '#!/bin/sh\necho 남의 훅\n');
});
