#!/usr/bin/env node
// 폰작업반입 회귀 — 클라우드(폰) 브랜치를 master 로 가져오는 절차가 실제로 도는지.
//
// 검사 방식 — **픽스처 저장소 + 로컬 폴더 origin**. 네트워크에 의존하지 않는다(CI 에서 깨지지 않는다).
// 재는 것 넷: ①대기 브랜치를 목록에 낸다 ②받으면 파일이 실제로 들어오고 커밋된다
//            ③공유 파일(세션보드)은 안 가져온다 ④미커밋과 겹치면 **멈춘다**(F073)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const TOOL = path.resolve(__dirname, '..', 'tools', '폰작업반입.js');
const { 묶어읽기 } = require(TOOL);
const git있나 = (() => { const r = spawnSync('git', ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; })();

const 임시들 = [];
const G = (cwd) => (...a) => spawnSync('git',
  ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
  { cwd, encoding: 'utf8' });

/** origin 역할 저장소에 `claude/*` 브랜치를 만들고, 그걸 클론해 작업본을 준다. */
function 픽스처({ 브랜치 = 'claude/폰작업', 보드도바꾼다 = true, 보드만 = false } = {}) {
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-반입-origin-'));
  임시들.push(원본);
  const go = G(원본);
  go('init', '-q', '-b', 'master');
  fs.mkdirSync(path.join(원본, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(원본, 'docs', '세션보드.md'), '| 원래 보드 |\n');
  fs.writeFileSync(path.join(원본, 'seed.txt'), 'seed\n');
  go('add', '-A'); go('commit', '-qm', 'seed');

  go('checkout', '-qb', 브랜치);
  if (!보드만) {
    fs.writeFileSync(path.join(원본, '폰산출물.md'), '폰이 만든 것\n');
    fs.writeFileSync(path.join(원본, '폰빌더.js'), 'console.log(1);\n');
  }
  if (보드도바꾼다 || 보드만) fs.writeFileSync(path.join(원본, 'docs', '세션보드.md'), '| 폰이 본 낡은 보드 |\n');
  go('add', '-A'); go('commit', '-qm', 'docs: 인쇄본 PDF 16종 (유호님 지시)');
  go('checkout', '-q', 'master');

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-반입-repo-'));
  임시들.push(repo);
  spawnSync('git', ['clone', '-q', 원본, repo], { encoding: 'utf8' });
  /* 🔴 클론에도 같은 셋을 **로컬로** 박는다 — 위 `G` 의 `-c` 는 이 테스트가 부르는 git 에만 붙고,
   * 정작 커밋하는 쪽은 `돌린다()` 가 띄우는 **도구 프로세스**다. 그 프로세스는 전역 설정을 읽는데
   * CI(그리고 `tools/test-ci.js` 의 HOME=빈폴더)엔 전역 identity 가 없어 `Author identity unknown` 으로 죽는다.
   * 🔑 개발 기계에선 `~/.gitconfig` 가 대신 채워 줘서 **로컬은 초록·CI만 적색**이 된다 — 주인이 볼 수 없는 형태다.
   *   (실측 2026-08-07: HOME 하나만 빈 폴더로 바꾸자 4/4 → 3/4.) */
  for (const [k, v] of [['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false']]) {
    spawnSync('git', ['config', k, v], { cwd: repo, encoding: 'utf8' });
  }
  return { repo, 원본, 브랜치: `origin/${브랜치}` };
}

/** 개행만 정규화해 읽는다 — 윈도우 git 체크아웃은 LF 를 CRLF 로 바꾼다(내용은 그대로다). */
const 읽기 = (repo, rel) => fs.readFileSync(path.join(repo, rel), 'utf8').replace(/\r/g, '');

function 돌린다(repo, 인자 = []) {
  const r = spawnSync(process.execPath, [TOOL, ...인자],
    { encoding: 'utf8', env: { ...process.env, SYNK_반입_ROOT: repo } });
  return { 코드: r.status, 글: String(r.stdout || '') + String(r.stderr || '') };
}

test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

test('대기 중인 폰 브랜치를 목록에 낸다 (아무것도 바꾸지 않는다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 브랜치 } = 픽스처();
  const r = 돌린다(repo);
  assert.strictEqual(r.코드, 0, r.글);
  assert.match(r.글, /claude\/폰작업/, '대기 브랜치를 이름으로 말해야 한다');
  assert.match(r.글, /인쇄본 PDF 16종/, '무슨 작업인지까지 줘야 열어볼지 판단할 수 있다');
  assert.ok(!fs.existsSync(path.join(repo, '폰산출물.md')), '목록만 보는데 파일이 들어왔다 — 드라이런이 아니다');
  assert.strictEqual(브랜치, 'origin/claude/폰작업');
});

test('🔴 받으면 파일이 실제로 들어오고 커밋된다 — 공유 파일(세션보드)은 빼고', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 브랜치 } = 픽스처();
  const r = 돌린다(repo, ['--받기', 브랜치]);
  assert.strictEqual(r.코드, 0, r.글);
  assert.ok(fs.existsSync(path.join(repo, '폰산출물.md')), '가져온다고 해놓고 파일이 없다');
  // 윈도우 체크아웃이 LF 를 CRLF 로 바꾸므로 개행은 정규화하고 **내용**만 본다.
  assert.strictEqual(읽기(repo, 'docs/세션보드.md'), '| 원래 보드 |\n',
    '세션보드를 폰 판으로 덮었다 — 그건 갈라진 시점 판이라 낡았고, 남의 미커밋을 밟는 자리다');

  const 로그 = G(repo)('log', '--format=%s', '-2').stdout;
  assert.match(로그, /반입/, '커밋이 안 됐다 — no-op 은 성공처럼 조용하다(F071)');
  assert.match(로그, /병합 이력/, '병합 이력을 안 남기면 그 브랜치가 영원히 「대기 중」으로 뜬다');

  const 남은대기 = 돌린다(repo).글;
  assert.doesNotMatch(남은대기, /받으려면/, '반입했는데 아직 대기로 잡힌다');
});

test('🔴 미커밋과 겹치면 멈춘다 — 받으면 남의 편집이 사라진다 (F073)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 브랜치 } = 픽스처();
  fs.writeFileSync(path.join(repo, '폰산출물.md'), '남이 지금 쓰고 있는 내용\n');
  const r = 돌린다(repo, ['--받기', 브랜치]);
  assert.notStrictEqual(r.코드, 0, '겹치는데 그냥 진행했다 — 새는 방향은 언제나 통과다');
  assert.match(r.글, /미커밋과 겹치/, '왜 멈췄는지 말해야 다음 행동을 정한다');
  assert.strictEqual(읽기(repo, '폰산출물.md'), '남이 지금 쓰고 있는 내용\n',
    '멈췄다면서 파일은 이미 덮여 있다');
});

/* 실물에서 나온 자리(2026-08-07): 폰이 보드 줄 하나만 고치고 push 하면 변경 100% 가 공유 파일이라
 * 「가져올 것 0건」이 된다. 옛 구현은 여기서 멈췄고, 멈추면 그 브랜치는 병합 표시를 못 받아
 * **영원히 「대기 중」** 으로 매 세션 시작에 뜬다. 0건에 성격이 다른 둘이 섞여 있던 것. */
test('🔴 변경이 전부 공유 파일이면 — 멈추지 말고 이력을 남긴다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 브랜치 } = 픽스처({ 보드만: true });
  const r = 돌린다(repo, ['--받기', 브랜치]);
  assert.strictEqual(r.코드, 0,
    '가져올 게 0건이라고 멈췄다 — 이 브랜치는 대기 목록에서 영원히 안 빠진다\n' + r.글);
  assert.strictEqual(읽기(repo, 'docs/세션보드.md'), '| 원래 보드 |\n',
    '이력만 남기랬더니 공유 파일을 폰 판(낡은 것)으로 덮었다');

  const 머리 = G(repo)('log', '--format=%s%n%b', '-1').stdout;
  assert.match(머리, /병합 이력/, '이력을 안 남기면 대기 목록에서 안 빠진다');
  assert.match(머리, /git show/, '버린 내용을 어디서 읽는지 안 알려주면 그냥 사라진 것과 같다');

  assert.doesNotMatch(돌린다(repo).글, /받으려면/, '이력을 남겼는데 아직 대기로 잡힌다');

  // 같은 0건이라도 **이미 들어온 브랜치**는 멈춰야 한다 — 이게 없으면 위 통과는
  // "무조건 진행"으로도 초록이 된다(구분을 안 재는 회귀는 회귀가 아니다).
  const 두번째 = 돌린다(repo, ['--받기', 브랜치]);
  assert.notStrictEqual(두번째.코드, 0, '이미 들어온 브랜치를 또 받아 병합 커밋을 겹쳐 쌓았다');
  assert.match(두번째.글, /이미 master 에 들어와 있다/);
});

test('🔴 값마다 줄을 바꿔 읽는 자리 — 빈 제목이 뒤를 밀지 않는다', () => {
  // 제목이 빈 브랜치가 하나 끼면, 빈 줄을 버리는 구현은 그 뒤가 통째로 한 칸씩 밀린다.
  const out = 'origin/claude/a\n1분 전\n첫 제목\norigin/claude/b\n2분 전\n\norigin/claude/c\n3분 전\n셋째\n';
  const 묶음 = 묶어읽기(out, 3);
  assert.strictEqual(묶음.length, 3, '빈 값을 버려서 묶음이 깨졌다');
  assert.deepStrictEqual(묶음[1], ['origin/claude/b', '2분 전', ''], '빈 제목 자리가 사라졌다');
  assert.deepStrictEqual(묶음[2], ['origin/claude/c', '3분 전', '셋째'], '뒤가 한 칸 밀렸다');
});
