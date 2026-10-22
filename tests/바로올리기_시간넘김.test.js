/* 바로올리기 — push 전 관련 시험이 한도(15분)만 넘겼을 때(2026-10-22).
 * 임시 bare 원격(origin) · 공용 작업본 · 세션 워크트리 · 남의 클론으로 잰다(tests/바로올리기.test.js와 같은 꼴). 실제 저장소·원격·전역 설정은 안 건드린다.
 * 관련 시험 돌리기는 옵션.관련시험돌리기로 바꿔 끼워 15분을 실제로 기다리지 않고 끊긴 결과만 준다(실제 끊김은 tests/관련시험.test.js가 잰다).
 * 따로 둔 까닭: 바로올리기.test.js는 시험이 차례로 돌아 파일 하나가 12분 남짓이다(tests/바로올리기_짝검사.test.js와 같다). */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
// SYNK_BARO_TOOL: 뮤테이션 시험이 일부러 망가뜨린 사본(tools/ 안)을 넣는다(바로올리기.test.js와 같다)
const 도구경로 = process.env.SYNK_BARO_TOOL ? path.resolve(process.env.SYNK_BARO_TOOL) : path.join(REPO, 'tools', '바로올리기.js');
const 도구 = require(도구경로);
const 정책 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'git-storage-policy.json'), 'utf8'));

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-baro-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

const 흐름 = "name: syntax-check\non:\n  push:\n    paths-ignore:\n      - 'docs/_ops/트랙.md'\njobs:\n  check:\n    steps:\n      - run: node --test --test-reporter=tap tests/*.test.js\n";
const 값시험 = "const { test } = require('node:test'); const assert = require('node:assert');\n"
  + "test('tools/값.json 의 값은 1이다', () => { assert.equal(require('../tools/값.json').값, 1); });\n";

/** origin(bare) · 공용 작업본(master) · 워크트리 하나 · 남의 push. */
function 새판(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-baro-시간-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'core.quotepath=false', ...a], { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const 쓰기 = (곳, p, v) => { fs.mkdirSync(path.dirname(path.join(곳, p)), { recursive: true }); fs.writeFileSync(path.join(곳, p), v); };
  const 원격 = path.join(뿌리, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
  const 공용 = path.join(뿌리, '공용');
  fs.mkdirSync(공용);
  git(공용, 'init', '-q', '-b', 'master');
  git(공용, 'config', 'core.autocrlf', 'false');
  git(공용, 'config', 'extensions.worktreeConfig', 'true');
  쓰기(공용, 'tools/git-storage-policy.json', `${JSON.stringify(정책, null, 2)}\n`);
  const 파일 = { '.github/workflows/syntax-check.yml': 흐름, 'tests/값.test.js': 값시험, 'tools/값.json': '{"값":1}\n', 'a.txt': '1\n' };
  for (const [p, v] of Object.entries(파일)) 쓰기(공용, p, v);
  git(공용, 'add', '-A');
  git(공용, 'commit', '-q', '-m', '바탕');
  git(공용, 'remote', 'add', 'origin', 원격);
  git(공용, 'push', '-q', 'origin', 'master');
  git(공용, 'fetch', '-q', 'origin');
  const 워 = path.join(뿌리, 'wt');
  git(공용, 'worktree', 'add', '-q', '-b', 'claude/wt', 워, 'master');
  const 원격git = (...a) => execFileSync('git', ['--git-dir', 원격, ...a], { encoding: 'utf8', stdio: 'pipe' });
  return {
    워, 쓰기: (p, v) => 쓰기(워, p, v),
    원격머리: () => 원격git('rev-parse', 'master').trim(),
    원격부모: () => 원격git('rev-parse', 'master^').trim(),
    원격파일: (p) => 원격git('show', `master:${p}`),
    /** 다른 클론에서 origin에 커밋을 올린다(남의 push). */
    남push: (파일들) => {
      const 다른 = path.join(뿌리, `다른-${crypto.randomBytes(3).toString('hex')}`);
      execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
      for (const [p, v] of Object.entries(파일들)) 쓰기(다른, p, v);
      git(다른, 'add', '-A');
      git(다른, 'commit', '-q', '-m', '남의 push');
      git(다른, 'push', '-q', 'origin', 'master');
      return git(다른, 'rev-parse', 'HEAD').trim();
    },
  };
}

const 끊김 = { 통과함: false, 시간넘김: true, 이유: '15분 안에 끝나지 않았다', 시험: 0, 통과: 0, 실패수: 0, 취소: 0, 초: 900 };

test('관련 시험: 한도에 끊기기 전에 깨진 시험이 보였으면 push하지 않는다', async (t) => {
  const 판 = 새판(t);
  const 전 = 판.원격머리();
  판.쓰기('tools/값.json', '{"값":2}\n');
  const r = await 도구.올리기({
    저장소: 판.워, 경로들: ['tools/값.json'], 메시지: '값 2', 실행: true,
    관련시험돌리기: () => ({ ...끊김, 실패: [{ 이름: 'tools/값.json 의 값은 1이다', 위치: 'tests/값.test.js:2', 파일: 'tests/값.test.js' }] }),
  });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /관련 시험이 깨졌다\(1개 깨짐 · 끝까지 못 봄 · 15분 안에 끝나지 않았다\)/);
  assert.equal(판.원격머리(), 전, '아무것도 올라가지 않았다');
});

test('관련 시험: 바쁜 PC에서 한도만 넘기고 깨진 것이 없으면 올리고 주의를 남긴다 — push가 거절돼 다시 쌓아도 시험은 한 번, 주의는 그대로', async (t) => {
  const 판 = 새판(t);
  판.쓰기('tools/값.json', '{"값":2}\n');
  let 돌린수 = 0, 끼어든 = null;
  const r = await 도구.올리기({
    저장소: 판.워, 경로들: ['tools/값.json'], 메시지: '값 2', 실행: true,
    관련시험돌리기: () => { 돌린수++; return { ...끊김, 실패: [] }; },
    시험고리: { push직전: (차례) => { if (차례 === 1) 끼어든 = 판.남push({ 'a.txt': '끼어듦\n' }); } },
  });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.다시한수, 1, 'push가 한 번 거절돼 다시 쌓았다');
  assert.equal(돌린수, 1, '다시 쌓아도 시험은 한 번만 돈다');
  assert.match(r.주의, /관련 시험이 15분 안에 끝나지 않았다\(900초까지 깨진 시험 없음\) — PC가 바쁜 탓으로 보고 막지 않았다/, '다시 쌓은 차례에도 주의가 남는다');
  assert.equal(판.원격부모(), 끼어든);
  assert.equal(판.원격파일('tools/값.json'), '{"값":2}\n');
  const 글 = 도구._시험.올리기글(r);
  assert.match(글, /관련 시험 시간 넘김 — 끝까지 못 봄 · 900초 · 파일 1개/);
  assert.match(글, /주의: 관련 시험이 15분 안에 끝나지 않았다/);
});
