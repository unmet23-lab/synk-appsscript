/* 바로올리기 — push 전 짝 검사(tools/짝검사.js)와 이번 push의 새 파일 넘기기(SYNK_새파일).
 * 임시 bare 원격(origin) · 공용 작업본 · 세션 워크트리로 잰다(tests/바로올리기.test.js와 같은 꼴). 실제 저장소·원격·전역 설정은 안 건드린다.
 * 따로 둔 까닭: 바로올리기.test.js는 시험이 차례로 돌아 파일 하나가 12분 남짓이고, 바로올리기를 고친 push의 관련 시험(15분 한도)이
 *   그 파일 하나를 기다린다. 파일을 나누면 node --test가 함께 돌린다. 올리기가 필요 없는 곳은 미리 보기로 잰다(미리 보기도 짝 검사를 돈다). */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
// SYNK_BARO_TOOL: 뮤테이션 시험이 일부러 망가뜨린 사본(tools/ 안)을 넣는다(바로올리기.test.js와 같다)
const 도구경로 = process.env.SYNK_BARO_TOOL ? path.resolve(process.env.SYNK_BARO_TOOL) : path.join(REPO, 'tools', '바로올리기.js');
const 도구 = require(도구경로);
const 올리기글 = 도구._시험.올리기글;
const 정책 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'git-storage-policy.json'), 'utf8'));

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-baro-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

/** origin(bare) · 공용 작업본(master) · 워크트리 하나. */
function 판(t, 파일) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-baro-짝-'));
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
  for (const [p, v] of Object.entries(파일)) 쓰기(공용, p, v);
  git(공용, 'add', '-A');
  git(공용, 'commit', '-q', '-m', '바탕');
  git(공용, 'remote', 'add', 'origin', 원격);
  git(공용, 'push', '-q', 'origin', 'master');
  git(공용, 'fetch', '-q', 'origin');
  const 워 = path.join(뿌리, 'wt');
  git(공용, 'worktree', 'add', '-q', '-b', 'claude/wt', 워, 'master');
  return {
    원격, 공용, 워, 쓰기: (p, v) => 쓰기(워, p, v),
    gitdir: () => path.resolve(공용, git(공용, 'rev-parse', '--git-dir').trim()),
    원격머리: () => execFileSync('git', ['--git-dir', 원격, 'rev-parse', 'master'], { encoding: 'utf8', stdio: 'pipe' }).trim(),
    원격파일: (p) => execFileSync('git', ['--git-dir', 원격, 'show', `master:${p}`], { encoding: 'utf8', stdio: 'pipe' }),
    원격몸: () => execFileSync('git', ['--git-dir', 원격, 'log', '-1', '--format=%B', 'master'], { encoding: 'utf8', stdio: 'pipe' }),
  };
}

/** 「src/*.txt를 대문자로 이어 out/가.txt에」 쓰는 가짜 생성기 — --check면 대조만 하고 다르면 「낡았다」를 던진다. */
const 생성기 = `const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const 원천 = fs.readdirSync(path.join(root, 'src')).sort().map((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('');
const 결과 = 원천.toUpperCase(), 자리 = path.join(root, 'out/가.txt');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(자리, 'utf8') !== 결과) throw new Error('낡았다: out/가.txt');
} else fs.writeFileSync(자리, 결과);
`;
const 짝표 = [{ 이름: '가짜 묶음', 단계: '시험', 명령: ['tools/만들기.js', '--check'], 고침: 'node tools/만들기.js', 결과물: ['out/가.txt'], 원천: ['src/*.txt'], 낡음: /낡았다/ }];
const 짝판 = (t) => 판(t, { 'tools/만들기.js': 생성기, 'src/가.txt': 'abc\n', 'out/가.txt': 'ABC\n', 'a.txt': '1\n' });

test('짝 검사: 원천만 고치면 멈추고 고치는 명령을 보인다 · 결과물을 빠뜨려도 멈춘다 · 같이 올리면 올라간다 · 상관없는 push는 안 돈다', async (t) => {
  const 곳 = 짝판(t);
  const 전 = 곳.원격머리();
  const 올리기 = (경로들, 덧 = {}) => 도구.올리기({ 저장소: 곳.워, 경로들, 메시지: '시험', 짝검사표: 짝표, ...덧 });

  곳.쓰기('src/가.txt', 'abd\n'); // 원천만 고치고 생성기를 안 돌렸다
  const 낡음 = await 올리기(['src/가.txt'], { 실행: true });
  assert.equal(낡음.결과, '멈춤', JSON.stringify(낡음));
  assert.match(낡음.이유, /짝 파일이 원천과 어긋난다\(가짜 묶음\) — 아무것도 올리지 않았다/);
  assert.equal(낡음.짝검사.결과.결과[0].판정, '낡음');
  const 글 = 올리기글(낡음);
  assert.match(글, /✗ 가짜 묶음 — 낡음/);
  assert.match(글, /→ 고친다: node tools\/만들기\.js/);
  assert.match(글, /→ 그 뒤 결과물을 경로에 더해 같이 올린다: out\/가\.txt/);
  assert.equal(곳.원격머리(), 전, '아무것도 올라가지 않았다');

  곳.쓰기('out/가.txt', 'ABD\n'); // 생성기는 돌렸는데 결과물을 경로에 안 넣었다 — 미리 보기도 짝 검사를 돈다
  const 빠짐 = await 올리기(['src/가.txt']);
  assert.equal(빠짐.결과, '멈춤', JSON.stringify(빠짐));
  assert.deepEqual(빠짐.짝검사.결과.결과[0].안올린, [{ 경로: 'out/가.txt', 결과물: true }]);
  assert.match(올리기글(빠짐), /경로에 더해 같이 올리거나 되돌린다: out\/가\.txt\(결과물\)/);

  const 됨 = await 올리기(['src/가.txt', 'out/가.txt'], { 실행: true });
  assert.equal(됨.결과, '올림', JSON.stringify(됨));
  assert.deepEqual(됨.짝검사.결과.막음, []);
  assert.equal(곳.원격파일('out/가.txt'), 'ABD\n');
  assert.match(올리기글(됨), /짝 검사 통과 — 1개/);

  곳.쓰기('a.txt', '2\n');
  const 무관 = await 올리기(['a.txt']);
  assert.equal(무관.결과, '미리 보기', JSON.stringify(무관));
  assert.equal(무관.짝검사, undefined, '상관없는 push는 짝 검사를 안 돈다');
  assert.doesNotMatch(올리기글(무관), /짝 검사/);
});

test('짝 검사: --짝검사건너뜀은 까닭을 트레일러 앞 문단으로 남긴다 · SYNK_짝검사=끔 · 검사 도구가 던지면 막지 않는다 · 인자', async (t) => {
  const 곳 = 짝판(t);
  곳.쓰기('src/가.txt', 'abd\n');
  const 메시지 = '원천만\n\n본문\n\nCo-Authored-By: 시험 <t@example.invalid>\n';
  const r = await 도구.올리기({ 저장소: 곳.워, 경로들: ['src/가.txt'], 메시지, 실행: true, 짝검사표: 짝표, 짝검사건너뜀: '생성물은 다음 커밋에서 같이' });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.짝검사.건너뜀, '생성물은 다음 커밋에서 같이');
  assert.equal(r.짝검사.결과, undefined, '건너뛰면 돌리지 않는다');
  assert.match(곳.원격몸(), /본문\n\n짝 검사 건너뜀: 생성물은 다음 커밋에서 같이\n\nCo-Authored-By: 시험/);
  await assert.rejects(도구.올리기({ 저장소: 곳.워, 경로들: ['a.txt'], 메시지: 'x', 실행: true, 짝검사건너뜀: ' ' }), /까닭/);

  곳.쓰기('src/가.txt', 'abe\n');
  process.env.SYNK_짝검사 = '끔';
  try {
    const 끔 = await 도구.올리기({ 저장소: 곳.워, 경로들: ['src/가.txt'], 메시지: '끔', 짝검사표: 짝표 });
    assert.equal(끔.결과, '미리 보기', JSON.stringify(끔));
    assert.equal(끔.짝검사, undefined);
  } finally { delete process.env.SYNK_짝검사; }

  // 검사 도구 자체가 던지면 막지 않고 알리기만 한다 — 모든 세션의 push가 그 고장에 묶이지 않게(CI가 다시 본다)
  const 짝모듈 = require(path.join(path.dirname(도구경로), '짝검사.js'));
  const 원래 = 짝모듈.돌리기;
  짝모듈.돌리기 = async () => { throw new Error('시험용 고장'); };
  try {
    const 고장 = await 도구.올리기({ 저장소: 곳.워, 경로들: ['src/가.txt'], 메시지: '고장', 짝검사표: 짝표 });
    assert.equal(고장.결과, '미리 보기', JSON.stringify(고장));
    assert.equal(고장.짝검사.결과.오류, '시험용 고장');
    assert.match(올리기글(고장), /짝 검사: 돌리지 못했다 — 시험용 고장 \(막지 않았다/);
  } finally { 짝모듈.돌리기 = 원래; }

  assert.equal(도구.인자읽기(['a.md', '-m', 'x', '--짝검사건너뜀', '까닭']).짝검사건너뜀, '까닭');
  assert.throws(() => 도구.인자읽기(['따라가기', '--짝검사건너뜀', 'x']), /받지 않는다/);
});

test('관련 시험: 이번 push로 처음 들어가는 파일을 SYNK_새파일로 넘긴다 — git ls-files로 훑는 시험도 push 전에 새 파일을 본다(10-21 지면폰트 ⑦)', async (t) => {
  const 흐름 = "name: syntax-check\non:\n  push:\n    paths-ignore:\n      - 'docs/_ops/트랙.md'\njobs:\n  check:\n    steps:\n      - run: node --test --test-reporter=tap tests/*.test.js\n";
  const 훑는시험 = "const { test } = require('node:test'); const assert = require('node:assert');\n"
    + "const { execFileSync } = require('node:child_process'); const fs = require('node:fs'); const path = require('node:path');\n"
    + "const 루트 = path.resolve(__dirname, '..');\n"
    + "test('지면은 모두 «가»를 담는다', () => {\n"
    + "  const 추적 = execFileSync('git', ['-C', 루트, 'ls-files', '-z', '--', '*.html'], { encoding: 'utf8' }).split('\\0').filter(Boolean);\n"
    + "  const 새것 = JSON.parse(process.env.SYNK_새파일 || '[]').filter((p) => p.endsWith('.html'));\n"
    + "  for (const p of new Set([...추적, ...새것])) assert.match(fs.readFileSync(path.join(루트, p), 'utf8'), /가/, p);\n"
    + '});\n';
  const 곳 = 판(t, { '.github/workflows/syntax-check.yml': 흐름, 'tests/지면.test.js': 훑는시험, 'docs/옛.html': '<p>가</p>\n' });
  // CI 읽기 지도를 받아 둔 꼴 — 이 시험은 git ls-files *.html 로 훑는다(tools/관련시험.js 지도받기)
  const 자리 = path.join(곳.gitdir(), 'synk-관련시험');
  fs.mkdirSync(자리, { recursive: true });
  fs.writeFileSync(path.join(자리, '지도.json'), JSON.stringify({ 판: 1, run: 7, 받은때: new Date().toISOString(), 시험: { 'tests/지면.test.js': { 읽음: [], 폴더: [], 무늬: ['*.html'] } } }));
  const 전 = 곳.원격머리();
  곳.쓰기('docs/새.html', '<p>나</p>\n');
  const r = await 도구.올리기({ 저장소: 곳.워, 경로들: ['docs/새.html'], 메시지: '새 지면', 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /관련 시험이 깨졌다/);
  // 새 지면은 아직 추적 밖이다 — SYNK_새파일이 없으면 이 시험은 그 지면을 못 보고 통과한다
  assert.equal(r.관련시험.결과.실패[0].이름, '지면은 모두 «가»를 담는다');
  assert.equal(곳.원격머리(), 전);
});
