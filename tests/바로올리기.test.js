/* 바로올리기 — 고친 것을 최신 origin 위에 커밋해 곧바로 push하고 작업본을 따라가게 하는 도구.
 * 임시 bare 원격(origin) · 공용 작업본(메인) · 세션 워크트리(연결 작업본) · 남의 클론으로 잰다.
 * 실제 저장소·원격·전역 git 설정은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
// SYNK_BARO_TOOL: 뮤테이션 시험이 일부러 망가뜨린 사본(tools/ 안)을 넣는다
const 도구경로 = process.env.SYNK_BARO_TOOL ? path.resolve(process.env.SYNK_BARO_TOOL) : path.join(REPO, 'tools', '바로올리기.js');
const 도구 = require(도구경로);
const 잠금도구 = require(path.join(REPO, 'tools', 'git잠금.js'));
const 정책 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'git-storage-policy.json'), 'utf8'));

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-baro-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

function 깃(폴더) {
  const g = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  g.바이트 = (...args) => execFileSync('git', args, { cwd: 폴더, stdio: ['pipe', 'pipe', 'pipe'] });
  return g;
}

function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, 경로);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}

function 작업본(폴더) {
  const g = 깃(폴더);
  return {
    폴더, g,
    쓰기: (p, v) => 쓰기(폴더, p, v),
    읽기: (p) => fs.readFileSync(path.join(폴더, p), 'utf8'),
    바이트: (p) => fs.readFileSync(path.join(폴더, p)),
    있나: (p) => fs.existsSync(path.join(폴더, p)),
    머리: () => g('rev-parse', 'HEAD').trim(),
    상태: () => g('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean).sort(),
    gitdir: () => path.resolve(폴더, g('rev-parse', '--git-dir').trim()),
  };
}

/** origin(bare) · 공용 작업본(master) · 워크트리 · 남의 push. */
function 새판(t, { 파일 = {}, autocrlf = 'false', 정책고침 = null } = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-baro-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 원격 = path.join(뿌리, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
  const 공용폴더 = path.join(뿌리, '공용');
  fs.mkdirSync(공용폴더);
  const 공용 = 작업본(공용폴더);
  공용.g('init', '-q', '-b', 'master');
  공용.g('config', 'core.autocrlf', 'false');            // 바탕 커밋은 준 바이트 그대로(CRLF가 든 blob도 만든다)
  공용.g('config', 'extensions.worktreeConfig', 'true');
  쓰기(공용폴더, 'tools/git-storage-policy.json', `${JSON.stringify({ ...정책, ...(정책고침 || {}) }, null, 2)}\n`);
  for (const [p, v] of Object.entries(파일)) 쓰기(공용폴더, p, v);
  공용.g('add', '-A');
  공용.g('commit', '-q', '-m', '바탕');
  공용.g('config', 'core.autocrlf', autocrlf);
  공용.g('remote', 'add', 'origin', 원격);
  공용.g('push', '-q', 'origin', 'master');
  공용.g('fetch', '-q', 'origin');
  const 판 = { 뿌리, 원격, 공용 };
  판.워크트리 = (이름, 바탕 = 'master') => {
    const 폴더 = path.join(뿌리, 이름);
    공용.g('worktree', 'add', '-q', '-b', `claude/${이름}`, 폴더, 바탕);
    return 작업본(폴더);
  };
  /** 다른 곳에서 origin에 커밋을 올린다(남의 push). 값이 null이면 지운다. */
  판.남push = (파일들, 메시지 = '남의 push') => {
    const 다른 = path.join(뿌리, `다른-${crypto.randomBytes(3).toString('hex')}`);
    execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
    const g = 깃(다른);
    for (const [p, v] of Object.entries(파일들)) {
      if (v === null) fs.rmSync(path.join(다른, p), { force: true });
      else 쓰기(다른, p, v);
    }
    g('add', '-A');
    g('commit', '-q', '-m', 메시지);
    g('push', '-q', 'origin', 'master');
    return g('rev-parse', 'HEAD').trim();
  };
  /** 로컬 커밋의 작성자·작성 시각·메시지 그대로 origin에 올린다(내커밋.js 올리기가 다시 쌓아 올린 짝처럼) */
  판.짝push = (곳, 커밋, 파일들) => {
    const 다른 = path.join(뿌리, `짝-${crypto.randomBytes(3).toString('hex')}`);
    execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
    for (const [p, v] of Object.entries(파일들)) 쓰기(다른, p, v);
    깃(다른)('add', '-A');
    const [이름, 메일, 날짜, 몸] = 곳.g('log', '-1', '--date=raw', '--format=%an%x00%ae%x00%ad%x00%B', 커밋).split('\0');
    execFileSync('git', ['commit', '-q', '-F', '-'], {
      cwd: 다른, input: 몸, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_AUTHOR_NAME: 이름, GIT_AUTHOR_EMAIL: 메일, GIT_AUTHOR_DATE: 날짜 },
    });
    깃(다른)('push', '-q', 'origin', 'master');
    return 깃(다른)('rev-parse', 'HEAD').trim();
  };
  /** 공용 작업본 master에 origin에 없는 커밋(남의 미푸시 = 꼬리)을 만든다 */
  판.미푸시 = (파일들, 메시지 = '남의 미푸시') => {
    for (const [p, v] of Object.entries(파일들)) 공용.쓰기(p, v);
    공용.g('add', '-A', '--', ...Object.keys(파일들));
    공용.g('commit', '-q', '-m', 메시지);
    return 공용.머리();
  };
  판.원격머리 = () => execFileSync('git', ['--git-dir', 원격, 'rev-parse', 'master'], { encoding: 'utf8', stdio: 'pipe' }).trim();
  판.원격파일 = (p, rev = 'master') => execFileSync('git', ['--git-dir', 원격, 'show', `${rev}:${p}`], { encoding: 'utf8', stdio: 'pipe' });
  판.원격바이트 = (p, rev = 'master') => execFileSync('git', ['--git-dir', 원격, 'cat-file', 'blob', `${rev}:${p}`], { stdio: 'pipe' });
  판.원격부모 = (rev = 'master') => execFileSync('git', ['--git-dir', 원격, 'rev-parse', `${rev}^`], { encoding: 'utf8', stdio: 'pipe' }).trim();
  판.원격에있나 = (p, rev = 'master') => spawnSync('git', ['--git-dir', 원격, 'cat-file', '-e', `${rev}:${p}`]).status === 0;
  return 판;
}

const 지문 = (파일) => crypto.createHash('sha256').update(fs.readFileSync(파일)).digest('hex');
const 공용글 = '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n';

// ── 워크트리에서 ─────────────────────────────────────────────────────────────

test('워크트리: 꼬리(남의 미푸시)에서 떠도 내가 바꾼 것만 최신 origin 위에 올리고, 워크트리는 올린 커밋으로 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { '공용.md': 공용글, '남.txt': '바탕\n', 'tools/a.js': 'a\n' } });
  const P = 판.미푸시({ '공용.md': '# 공용\n\n## 가\n- a1\n- 남의 미푸시 줄\n\n## 나\n- b1\n', '꼬리.txt': '꼬리\n' });
  const 워 = 판.워크트리('wt');
  assert.equal(워.머리(), P, '앱처럼 로컬 master(꼬리 포함)에서 뜬다');
  워.쓰기('공용.md', '# 공용\n\n## 가\n- a1\n- 남의 미푸시 줄\n\n## 나\n- b1\n- 내 b2\n');
  워.쓰기('내.md', '# 내 문서\n');
  const O1 = 판.남push({ '남.txt': '바탕\n남이 올림\n', '공용.md': '# 공용\n\n## 가\n- a1\n- 원격 a2\n\n## 나\n- b1\n' });

  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['공용.md', '내.md'], 메시지: '내 줄과 내 문서', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.작업본, '워크트리');
  assert.equal(판.원격머리(), r.머리);
  assert.equal(판.원격부모(), O1, '막 받은 origin 바로 위');
  assert.equal(판.원격파일('공용.md'), '# 공용\n\n## 가\n- a1\n- 원격 a2\n\n## 나\n- b1\n- 내 b2\n', '꼬리 줄은 안 올라가고 내 줄만');
  assert.equal(판.원격파일('내.md'), '# 내 문서\n');
  assert.equal(판.원격에있나('꼬리.txt'), false, '꼬리 파일은 안 올라간다');
  assert.equal(판.원격파일('남.txt'), '바탕\n남이 올림\n');
  // 워크트리는 올린 커밋으로 — 꼬리를 벗어나고 남의 새 판도 받는다
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(워.머리(), r.머리);
  assert.deepEqual(워.상태(), [], '워크트리가 깨끗하다');
  assert.equal(워.읽기('남.txt'), '바탕\n남이 올림\n');
  assert.equal(워.있나('꼬리.txt'), false);
  // 공용 작업본은 꼬리가 있어 건너뛰고, 꼬리 커밋은 로컬 master에 그대로
  assert.equal(r.공용따라가기.결과, '건너뜀');
  assert.match(r.공용따라가기.이유, /꼬리/);
  assert.equal(판.공용.머리(), P);
  // 다시 돌리면 올릴 것 없음
  const r2 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['공용.md', '내.md'], 메시지: '또', 실행: true });
  assert.equal(r2.결과, '올릴 것 없음', JSON.stringify(r2));
  assert.equal(판.원격머리(), r.머리);
});

test('워크트리: 미리 보기는 origin·가지·인덱스·작업본을 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  const 상태전 = 워.상태();                                // 시험의 git status가 인덱스를 새로 쓰므로 지문보다 먼저
  const 전 = { 원격: 판.원격머리(), 머리: 워.머리(), 인덱스: 지문(path.join(워.gitdir(), 'index')) };
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: '2' });
  assert.equal(r.결과, '미리 보기', JSON.stringify(r));
  assert.equal(r.따라가기.결과, '계획');
  assert.deepEqual({ 원격: 판.원격머리(), 머리: 워.머리(), 인덱스: 지문(path.join(워.gitdir(), 'index')) }, 전);
  assert.deepEqual(워.상태(), 상태전);
  assert.equal(워.읽기('a.txt'), '2\n');
});

test('워크트리: 같은 문서 같은 자리에 원격도 줄을 더했으면 원격 줄 뒤에 내 줄을 붙이고, 공용 문서도 조각 없이 통째로 올린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/트랙.md': '# 트랙\n\n## 가\n- a1\n\n## 나\n- b1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('docs/_ops/트랙.md', '# 트랙\n\n## 가\n- a1\n- 내 a2 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다\n\n## 나\n- b1\n');
  판.남push({ 'docs/_ops/트랙.md': '# 트랙\n\n## 가\n- a1\n- 원격 a2 줄도 길게 써서 다른 줄과 헷갈리지 않게 한다\n\n## 나\n- b1\n' });
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['docs/_ops/트랙.md'], 메시지: '트랙 내 줄', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일('docs/_ops/트랙.md'), '# 트랙\n\n## 가\n- a1\n- 원격 a2 줄도 길게 써서 다른 줄과 헷갈리지 않게 한다\n- 내 a2 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다\n\n## 나\n- b1\n');
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 코드 파일의 같은 줄을 원격이 다르게 고쳤으면 멈추고 아무것도 올리지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'tools/a.js': 'const a = 1;\nconst b = 2;\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('tools/a.js', 'const a = 10;\nconst b = 2;\n');
  const O = 판.남push({ 'tools/a.js': 'const a = 100;\nconst b = 2;\n' });
  const 전머리 = 워.머리();
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['tools/a.js'], 메시지: 'a', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.문제[0].이유, /겹친다/);
  assert.equal(판.원격머리(), O);
  assert.equal(워.머리(), 전머리);
  assert.equal(워.읽기('tools/a.js'), 'const a = 10;\nconst b = 2;\n');
});

test('워크트리: push 직전에 남이 먼저 올려 거절되면 다시 받아 그 위에 올린다(CAS 경합)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '남.txt': '0\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  let 끼어든 = null;
  const r = await 도구.올리기({
    저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true,
    시험고리: { push직전: (차례) => { if (차례 === 1) 끼어든 = 판.남push({ '남.txt': '끼어듦\n' }); } },
  });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.다시한수, 1);
  assert.equal(판.원격부모(), 끼어든, '끼어든 커밋 위에 다시 쌓았다');
  assert.equal(판.원격파일('남.txt'), '끼어듦\n');
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(워.머리(), r.머리);
  assert.equal(워.읽기('남.txt'), '끼어듦\n');
});

test('워크트리: 아직 고치는 다른 파일은 따라가며 3방향으로 지키고, 같은 줄이 겹치면 따라가지 않고(push는 됨) 다시 돌리면 올릴 것 없음', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '긴.txt': 'x1\nx2\nx3\nx4\nx5\n', '겹침.txt': 'y1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  워.쓰기('긴.txt', 'x1 내 고침\nx2\nx3\nx4\nx5\n');      // 아직 올리지 않는 내 고침(원격과 다른 자리)
  판.남push({ '긴.txt': 'x1\nx2\nx3\nx4\nx5 원격 고침\n' });
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(워.읽기('긴.txt'), 'x1 내 고침\nx2\nx3\nx4\nx5 원격 고침\n', '내 미커밋 고침 + 원격 고침');
  assert.deepEqual(워.상태(), [' M 긴.txt'], '남은 것은 내 미커밋 고침뿐');
  assert.equal(판.원격파일('긴.txt'), 'x1\nx2\nx3\nx4\nx5 원격 고침\n', '내 미커밋 고침은 안 올라간다');

  // 같은 줄이 겹치면: push는 되고 따라가기는 아무것도 바꾸지 않는다
  워.쓰기('겹침.txt', 'y1 내 것\n');
  판.남push({ '겹침.txt': 'y1 원격 것\n' });
  워.쓰기('b.txt', 'b\n');
  const 전머리 = 워.머리();
  const r2 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['b.txt'], 메시지: 'b', 실행: true });
  assert.equal(r2.결과, '올림', JSON.stringify(r2));
  assert.equal(판.원격파일('b.txt'), 'b\n');
  assert.equal(r2.따라가기.결과, '멈춤', JSON.stringify(r2.따라가기));
  assert.equal(r2.따라가기.걸림[0].경로, '겹침.txt');
  assert.equal(워.머리(), 전머리, '가지는 그대로');
  assert.equal(워.읽기('겹침.txt'), 'y1 내 것\n');
  assert.equal(워.읽기('b.txt'), 'b\n');
  const r3 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['b.txt'], 메시지: 'b 또', 실행: true });
  assert.equal(r3.결과, '올릴 것 없음', JSON.stringify(r3));
  assert.equal(판.원격머리(), r2.머리);
});

test('워크트리: 이 가지에만 있는 커밋이 있으면 push는 하되 따라가지 않는다(커밋이 가지에서 빠지지 않게)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('로컬.txt', '로컬 커밋\n');
  워.g('add', '로컬.txt');
  워.g('commit', '-q', '-m', '가지에만');
  const 가지만 = 워.머리();
  워.쓰기('a.txt', '2\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격에있나('로컬.txt'), false);
  assert.equal(r.따라가기.결과, '멈춤');
  assert.match(r.따라가기.이유, /에만 있고 origin에 올라가지 않은 커밋/);
  assert.equal(워.머리(), 가지만);
});

test('워크트리: 가지에만 있는 커밋이라도 origin에 짝(같은 작성자·시각·제목으로 다시 쌓아 올린 것)이 있으면 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('옛방식.txt', '내커밋으로 커밋\n');
  워.g('add', '옛방식.txt');
  워.g('commit', '-q', '-m', '옛 방식으로 커밋하고 올림');
  const 옛 = 워.머리();
  판.남push({ '남.txt': '먼저 올라온 남의 것\n' });
  const 짝 = 판.짝push(워, 옛, { '옛방식.txt': '내커밋으로 커밋\n' });
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), 짝);
  assert.equal(워.읽기('남.txt'), '먼저 올라온 남의 것\n');
  assert.deepEqual(워.상태(), []);
});

test('워크트리: index.lock — 내용 있는 잠금이 안 풀리면 따라가기만 멈추고, 주인 없는 잠금은 치우고 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  const 잠금 = path.join(워.gitdir(), 'index.lock');
  const 짧은잠 = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${Math.min(ms, 50)})`]);
  워.쓰기('a.txt', '2\n');
  fs.writeFileSync(잠금, '쓰는 중');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true, 잠금한도ms: { 잠금: 300 }, 잠깐: 짧은잠 });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.따라가기.결과, '멈춤');
  assert.match(r.따라가기.이유, /index\.lock/);
  assert.equal(fs.readFileSync(잠금, 'utf8'), '쓰는 중', '남의 잠금은 안 지운다');
  // 0바이트·오래된·주인 없는 잠금은 한 번 치우고 따라간다
  fs.writeFileSync(잠금, '');
  const 옛날 = new Date(Date.now() - 60000);
  fs.utimesSync(잠금, 옛날, 옛날);
  const r2 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true, 잠금살피기: () => 잠금도구.살피기(워.폴더, { 잠금, 먼저시작한git: () => 0 }) });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.ok(!fs.existsSync(잠금));
  assert.equal(워.머리(), 판.원격머리());
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 줄끝 — CRLF 작업본에서 고쳐도 origin에는 LF로, CRLF로 든 blob은 CRLF 그대로 올라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'lf.md': '- 하나\n- 둘\n', 'crlf.md': '- 하나\r\n- 둘\r\n' }, autocrlf: 'true' });
  const 워 = 판.워크트리('wt');
  assert.equal(워.바이트('lf.md').toString(), '- 하나\r\n- 둘\r\n', 'autocrlf 체크아웃은 CRLF');
  워.쓰기('lf.md', '- 하나\r\n- 둘\r\n- 셋\r\n');
  워.쓰기('crlf.md', '- 하나\r\n- 둘\r\n- 셋\r\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['lf.md', 'crlf.md'], 메시지: '셋', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격바이트('lf.md').toString(), '- 하나\n- 둘\n- 셋\n');
  assert.equal(판.원격바이트('crlf.md').toString(), '- 하나\r\n- 둘\r\n- 셋\r\n');
  assert.equal(r.따라가기.결과, '따라감');
  assert.deepEqual(워.상태(), []);
});

test('워크트리: 저장 용량 검사에 걸리면 올리지 않고 아무것도 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': 'a\n' }, 정책고침: { maxBlobBytes: 64 } });
  const 워 = 판.워크트리('wt');
  워.쓰기('큰.bin', Buffer.alloc(65, 1));
  const 전 = { 원격: 판.원격머리(), 머리: 워.머리() };
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['큰.bin'], 메시지: '큰 파일', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.문제.map((x) => x.이유).join(' '), /저장 용량/);
  assert.deepEqual({ 원격: 판.원격머리(), 머리: 워.머리() }, 전);
  assert.ok(워.있나('큰.bin'));
});

test('워크트리: --모두는 고친·새·지운 파일을 모두 올린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '지울.txt': 'x\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  워.쓰기('새/파일.md', '새\n');
  fs.rmSync(path.join(워.폴더, '지울.txt'));
  const r = await 도구.올리기({ 저장소: 워.폴더, 모두: true, 메시지: '모두', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(판.원격파일('새/파일.md'), '새\n');
  assert.equal(판.원격에있나('지울.txt'), false);
  assert.deepEqual(워.상태(), []);
});

test('따라가기: push 없이 origin 최신으로 옮기며 내 미커밋 고침과 새 파일은 그대로 둔다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  워.쓰기('메모.txt', '미추적\n');
  const O = 판.남push({ 'a.txt': '원격 2\n', 'b.txt': 'b1\nb2\nb3 원격\n' });
  const 미리 = await 도구.따라가기({ 저장소: 워.폴더 });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.notEqual(워.머리(), O);
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), O);
  assert.equal(워.읽기('a.txt'), '원격 2\n');
  assert.equal(워.읽기('b.txt'), 'b1 내 것\nb2\nb3 원격\n');
  assert.equal(워.읽기('메모.txt'), '미추적\n');
  assert.deepEqual(워.상태(), [' M b.txt', '?? 메모.txt']);
  assert.ok(fs.existsSync(r.백업), '고친 파일의 바이트 백업');
});

test('따라가기: 계획을 세운 뒤 고치던 파일이 바뀌었으면 실행하지 않고 아무것도 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const { 맥락, 따라가기계획, 따라가기실행 } = 도구._시험;
  const c = 맥락({ 저장소: 워.폴더 });
  c.저장 = new Map();
  워.g('fetch', '-q', 'origin');
  const 계획 = 따라가기계획(c, 워.머리(), O);
  assert.equal(계획.결과, '계획', JSON.stringify(계획));
  워.쓰기('b.txt', 'b1 내 것 더 고침\nb2\nb3\n');
  const 전머리 = 워.머리();
  const r = 따라가기실행(c, 계획);
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /그사이 작업본 파일이 바뀌었다/);
  assert.equal(워.머리(), 전머리);
  assert.equal(워.읽기('b.txt'), 'b1 내 것 더 고침\nb2\nb3\n');
});

test('따라가기: 가지를 옮기기 직전에 남이 가지를 움직였으면(CAS) 작업본을 되돌리고 그 가지를 지킨다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  판.남push({ 'a.txt': '원격 2\n', 'b.txt': 'b1\nb2\nb3 원격\n' });
  const B = 워.머리();
  let 끼어든 = null;
  const r = await 도구.따라가기({
    저장소: 워.폴더, 실행: true,
    시험고리: { 가지옮기기직전: () => {
      const 트리 = 워.g('rev-parse', `${B}^{tree}`).trim();
      끼어든 = execFileSync('git', ['commit-tree', 트리, '-p', B, '-m', '그사이 남이 이 가지에 커밋'], { cwd: 워.폴더, encoding: 'utf8' }).trim();
      워.g('update-ref', 'refs/heads/claude/wt', 끼어든);
    } },
  });
  assert.equal(r.결과, '실패', JSON.stringify(r));
  assert.match(r.이유, /그사이 움직임/);
  assert.equal(워.머리(), 끼어든, '남이 옮긴 가지를 덮지 않는다');
  assert.equal(워.읽기('a.txt'), '1\n', '작업본은 바탕 판으로 되돌림');
  assert.equal(워.읽기('b.txt'), 'b1 내 것\nb2\nb3\n', '고치던 파일도 되돌림');
});

test('따라가기: 가지를 옮긴 뒤 3방향 결과를 쓰기 직전에 남이 그 파일을 쓰면 덮지 않고 알린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const r = await 도구.따라가기({
    저장소: 워.폴더, 실행: true,
    시험고리: { 따라가기쓰기직전: () => 워.쓰기('b.txt', '편집기가 그사이 저장\n') },
  });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(워.머리(), O);
  assert.match(r.주의, /그사이 누가 써서/);
  assert.equal(워.읽기('b.txt'), '편집기가 그사이 저장\n', '남이 쓴 판을 덮지 않는다');
  assert.ok(fs.existsSync(path.join(r.백업, '목록.json')), '내 고침은 백업에 있다');
});

test('따라가기: origin이 새로 넣는 경로에 다른 미추적 파일이 있거나 폴더·파일이 부딪히면 아무것도 바꾸지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('새.txt', '내 미추적 파일\n');
  const O1 = 판.남push({ '새.txt': '원격이 넣은 파일\n' });
  const B = 워.머리();
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.equal(r.걸림[0].경로, '새.txt');
  assert.equal(워.머리(), B);
  assert.equal(워.읽기('새.txt'), '내 미추적 파일\n');
  // 같은 바이트면 받아들인다
  워.쓰기('새.txt', '원격이 넣은 파일\n');
  const r2 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(워.머리(), O1);
  // 작업본의 미추적 파일 「폴더」 자리에 origin이 그 아래 파일을 넣는다
  워.쓰기('겹침', '나는 파일\n');
  워.쓰기('a.txt', '내 위\n1\n');                         // 3방향으로 얹을 내 미커밋 고침(read-tree가 멈추면 되돌아와야 한다)
  판.남push({ '겹침/아래.txt': '원격\n', 'a.txt': '1\n원격 아래\n' });
  const B2 = 워.머리();
  const r3 = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.notEqual(r3.결과, '따라감', JSON.stringify(r3));
  assert.equal(워.머리(), B2);
  assert.equal(워.읽기('겹침'), '나는 파일\n');
  assert.equal(워.읽기('a.txt'), '내 위\n1\n', '바탕 판으로 돌렸던 내 고침을 되돌려 놓는다');
});

test('워크트리: 조각으로 일부만 올리면 남은 내 고침은 올린 판을 바탕으로 3방향 — 붙어 있는 코드 줄도 따라간다', async (t) => {
  const 바탕글 = 'const a1 = 1;\nconst a2 = 2;\nconst a3 = 3;\nconst a4 = 4;\n';
  const 판 = 새판(t, { 파일: { 'tools/x.js': 바탕글 } });
  const 워 = 판.워크트리('wt');
  const 고친글 = 'const a1 = 1;\nconst a2 = 20;\nconst a3 = 30;\nconst a4 = 4;\n';
  워.쓰기('tools/x.js', 고친글);
  const 내커밋도구 = require(path.join(REPO, 'tools', '내커밋.js'));
  const { 묶음 } = 내커밋도구.조각만들기(바탕글, 고친글);
  assert.equal(묶음.length, 1, '붙은 두 줄은 한 조각');
  // 조각 줄: 1·2 = 뺀 a2·a3, 3·4 = 더한 a2·a3 새 판 → a2 고침만 올린다
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: [], 조각: [['tools/x.js', `${묶음[0].id}:1,${묶음[0].id}:3`]], 메시지: 'a2만', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일('tools/x.js'), 'const a1 = 1;\nconst a2 = 20;\nconst a3 = 3;\nconst a4 = 4;\n');
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(워.머리(), r.머리);
  assert.equal(워.읽기('tools/x.js'), 고친글, '올리지 않은 a3 고침은 작업본에 남는다');
  assert.deepEqual(워.상태(), [' M tools/x.js']);
});

// ── 공용 작업본에서 ──────────────────────────────────────────────────────────

test('공용 작업본: origin이 바꾼 경로에 남의 스테이징이 있으면 따라가지 않는다(남의 git add를 지우지 않게)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 's.txt': 's1\ns2\ns3\n' } });
  const 워 = 판.워크트리('wt');
  판.공용.쓰기('s.txt', 's1 남이 올려 둠\ns2\ns3\n');
  판.공용.g('add', 's.txt');
  판.남push({ 's.txt': 's1\ns2\ns3 원격\n' });
  워.쓰기('a.txt', '2\n');
  const 전 = 판.공용.머리();
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.공용따라가기.결과, '건너뜀', JSON.stringify(r.공용따라가기));
  assert.match(JSON.stringify(r.공용따라가기.걸림), /스테이징/);
  assert.equal(판.공용.머리(), 전);
  assert.deepEqual(판.공용.상태(), ['M  s.txt']);
});

test('공용 작업본: master에 꼬리(남의 미푸시)가 있으면 아무것도 하지 않는다(정리 전까지 내커밋.js)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  판.미푸시({ '남.txt': '남\n' });
  판.공용.쓰기('a.txt', '2\n');
  const 전 = { 원격: 판.원격머리(), 머리: 판.공용.머리(), 인덱스: 지문(path.join(판.공용.gitdir(), 'index')) };
  const r = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['a.txt'], 메시지: 'a', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /꼬리/);
  assert.deepEqual({ 원격: 판.원격머리(), 머리: 판.공용.머리(), 인덱스: 지문(path.join(판.공용.gitdir(), 'index')) }, 전);
  const f = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(f.결과, '멈춤');
});

test('공용 작업본(꼬리 없음): 공용 문서는 조각으로 내 것만, 남의 미커밋·스테이징·새 파일은 그대로 두고 master가 따라간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/트랙.md': 공용글, '남.txt': '바탕\n', '남스테이징.txt': 's\n', 'a.txt': '1\n' } });
  const 공 = 판.공용;
  공.쓰기('a.txt', '내 2\n');
  공.쓰기('docs/_ops/트랙.md', '# 공용\n\n## 가\n- a1\n- 남의 미커밋 a2 줄은 길게 쓴다\n\n## 나\n- b1\n- 내 b2 줄은 길게 쓴다\n');
  공.쓰기('남.txt', '바탕\n남의 미커밋\n');
  공.쓰기('남스테이징.txt', 's 남이 올려 둠\n');
  공.g('add', '남스테이징.txt');
  공.쓰기('남새파일.txt', '미추적\n');
  const O = 판.남push({ 'c.txt': '원격\n' });

  await assert.rejects(() => 도구.올리기({ 저장소: 공.폴더, 모두: true, 메시지: '모두' }), /워크트리에서만/);
  const 막힘 = await 도구.올리기({ 저장소: 공.폴더, 경로들: ['a.txt', 'docs/_ops/트랙.md'], 메시지: '내 것' });
  assert.equal(막힘.결과, '멈춤', JSON.stringify(막힘));
  assert.match(막힘.이유, /조각/);
  const 조각 = 막힘.조각보기[0].조각.find((x) => x.줄.some((l) => /내 b2/.test(l.글)));
  const r = await 도구.올리기({ 저장소: 공.폴더, 경로들: ['a.txt'], 조각: [['docs/_ops/트랙.md', 조각.id]], 메시지: '내 것', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.작업본, '공용');
  assert.equal(판.원격부모(), O);
  assert.equal(판.원격파일('docs/_ops/트랙.md'), '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n- 내 b2 줄은 길게 쓴다\n', '남의 미커밋 줄은 안 올라간다');
  assert.equal(판.원격파일('a.txt'), '내 2\n');
  assert.equal(판.원격파일('남.txt'), '바탕\n');
  // master가 따라가고 남의 것은 그대로
  assert.equal(r.따라가기.결과, '따라감', JSON.stringify(r.따라가기));
  assert.equal(공.머리(), r.머리);
  assert.equal(공.읽기('c.txt'), '원격\n');
  assert.equal(공.읽기('docs/_ops/트랙.md'), '# 공용\n\n## 가\n- a1\n- 남의 미커밋 a2 줄은 길게 쓴다\n\n## 나\n- b1\n- 내 b2 줄은 길게 쓴다\n');
  assert.equal(공.읽기('남.txt'), '바탕\n남의 미커밋\n');
  assert.deepEqual(공.상태(), [' M docs/_ops/트랙.md', ' M 남.txt', '?? 남새파일.txt', 'M  남스테이징.txt'].sort());
});

test('공용 작업본: 워크트리에서 올리면 꼬리 없는 공용 작업본도 빨리감기로 따라가고, 겹치면 건너뛴다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '남.txt': 'n1\n' } });
  const 워 = 판.워크트리('wt');
  판.공용.쓰기('남.txt', 'n1 남의 미커밋\n');
  워.쓰기('a.txt', '2\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.공용따라가기.결과, '따라감', JSON.stringify(r.공용따라가기));
  assert.equal(판.공용.머리(), r.머리);
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  assert.equal(판.공용.읽기('남.txt'), 'n1 남의 미커밋\n');

  // 공용 작업본의 남의 미커밋이 origin 변경과 같은 줄이면 건너뛴다(공용 작업본은 그대로)
  판.남push({ '남.txt': 'n1 원격\n' });
  워.쓰기('a.txt', '3\n');
  const 전 = 판.공용.머리();
  const r2 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 3', 실행: true });
  assert.equal(r2.결과, '올림', JSON.stringify(r2));
  assert.equal(r2.공용따라가기.결과, '건너뜀', JSON.stringify(r2.공용따라가기));
  assert.equal(판.공용.머리(), 전);
  assert.equal(판.공용.읽기('남.txt'), 'n1 남의 미커밋\n');
  assert.equal(판.공용.읽기('a.txt'), '2\n');
});

// ── 가볍게 ──────────────────────────────────────────────────────────────────

test('가볍게: 워크트리에서만 큰 미디어 폴더를 작업본에서 빼고(그 워크트리 설정), 되살린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'docs/캐릭터/정본_4K/까몽.png': Buffer.alloc(10, 2), 'docs/홍보물/x.mp4': Buffer.alloc(10, 3), 'docs/남길.md': '남김\n' } });
  const 워 = 판.워크트리('wt');
  const 공용거절 = await 도구.가볍게({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(공용거절.결과, '멈춤');
  const 미리 = await 도구.가볍게({ 저장소: 워.폴더 });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.equal(미리.파일, 2);
  const r = await 도구.가볍게({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '가볍게 함', JSON.stringify(r));
  assert.match(r.설정, /^worktree/);
  assert.equal(워.있나('docs/캐릭터/정본_4K/까몽.png'), false);
  assert.equal(워.있나('docs/홍보물/x.mp4'), false);
  assert.equal(워.읽기('docs/남길.md'), '남김\n');
  assert.deepEqual(워.상태(), []);
  assert.ok(판.공용.있나('docs/캐릭터/정본_4K/까몽.png'), '공용 작업본은 그대로');
  // 가벼운 워크트리에서도 올리고 따라간다
  워.쓰기('a.txt', '2\n');
  const 올림 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(올림.결과, '올림', JSON.stringify(올림));
  assert.equal(판.원격에있나('docs/캐릭터/정본_4K/까몽.png'), true, '뺀 폴더가 origin에서 지워지지 않는다');
  assert.deepEqual(워.상태(), []);
  const 되 = await 도구.가볍게({ 저장소: 워.폴더, 되살림: true, 실행: true });
  assert.equal(되.결과, '되살림', JSON.stringify(되));
  assert.ok(워.있나('docs/캐릭터/정본_4K/까몽.png'));
});

// ── 명령줄 ──────────────────────────────────────────────────────────────────

test('인자 읽기: 명령마다 받는 인자만 받고 틀리면 사용법 오류', () => {
  assert.deepEqual(도구.인자읽기(['따라가기', '--실행']).명령, '따라가기');
  assert.equal(도구.인자읽기(['a.md', '-m', 'x']).명령, '올리기');
  assert.equal(도구.인자읽기([]).도움말, true);
  assert.throws(() => 도구.인자읽기(['따라가기', 'a.md']), /받지 않는다/);
  assert.throws(() => 도구.인자읽기(['a.md', '--되살림']), /가볍게에만/);
  assert.throws(() => 도구.인자읽기(['a.md', '--모르는']), /모르는 인자/);
  assert.throws(() => 도구.인자읽기(['a.md', '--조각', '공용.md']), /<경로>=<조각/);
});

test('재현: 워크트리에서 명령줄로 올리고 따라간다', (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('a.txt', '2\n');
  const 돌림 = spawnSync(process.execPath, [도구경로, 'a.txt', '-m', 'a 2', '--실행'], { cwd: 워.폴더, encoding: 'utf8' });
  assert.equal(돌림.status, 0, 돌림.stdout + 돌림.stderr);
  assert.match(돌림.stdout, /^\[올림\]/);
  assert.match(돌림.stdout, /따라가기: /);
  assert.equal(판.원격파일('a.txt'), '2\n');
  assert.equal(워.머리(), 판.원격머리());
  const 또 = spawnSync(process.execPath, [도구경로, 'a.txt', '-m', 'a 2', '--실행'], { cwd: 워.폴더, encoding: 'utf8' });
  assert.equal(또.status, 0, 또.stdout + 또.stderr);
  assert.match(또.stdout, /^\[올릴 것 없음\]/);
});
