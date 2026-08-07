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
const { 묶어읽기, 행합치기 } = require(TOOL);
const 장부 = 'docs/_ops/마찰신호.md';
const 장부글 = (행들) => `# 마찰 신호\n\n| ID | 날짜 | 종류 | 신호 | 해소 |\n|---|---|---|---|---|\n${행들.join('\n')}\n`;
const git있나 = (() => { const r = spawnSync('git', ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; })();

const 임시들 = [];
const G = (cwd) => (...a) => spawnSync('git',
  ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
  { cwd, encoding: 'utf8' });

/** origin 역할 저장소에 `claude/*` 브랜치를 만들고, 그걸 클론해 작업본을 준다. */
function 픽스처({ 브랜치 = 'claude/폰작업', 보드도바꾼다 = true, 보드만 = false, 장부도 = false, 장부만 = false } = {}) {
  if (장부만) { 보드만 = false; 보드도바꾼다 = false; 장부도 = true; }
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-반입-origin-'));
  임시들.push(원본);
  const go = G(원본);
  go('init', '-q', '-b', 'master');
  fs.mkdirSync(path.join(원본, 'docs', '_ops'), { recursive: true });
  fs.writeFileSync(path.join(원본, 'docs', '세션보드.md'), '| 원래 보드 |\n');
  fs.writeFileSync(path.join(원본, 'seed.txt'), 'seed\n');
  if (장부도) {
    fs.writeFileSync(path.join(원본, 장부), 장부글([
      '| F001 | 2026-08-01 | 실수 | 첫 신호 | |',
      '| F002 | 2026-08-02 | 마찰 | 둘째 신호 | |',
    ]));
  }
  go('add', '-A'); go('commit', '-qm', 'seed');

  go('checkout', '-qb', 브랜치);
  if (!보드만 && !장부만) {
    fs.writeFileSync(path.join(원본, '폰산출물.md'), '폰이 만든 것\n');
    fs.writeFileSync(path.join(원본, '폰빌더.js'), 'console.log(1);\n');
  }
  if (보드도바꾼다 || 보드만) fs.writeFileSync(path.join(원본, 'docs', '세션보드.md'), '| 폰이 본 낡은 보드 |\n');
  if (장부도) {
    // 폰: 있던 행의 문구를 고치고(F002), 자기 신호를 손번호로 붙인다(F003 은 master 와 충돌·F004 는 새것).
    fs.writeFileSync(path.join(원본, 장부), 장부글(장부만 ? [
      '| F001 | 2026-08-01 | 실수 | 첫 신호 | |',
      '| F002 | 2026-08-02 | 마찰 | 둘째 신호 (폰이 문구를 고쳤다) | |',
    ] : [
      '| F001 | 2026-08-01 | 실수 | 첫 신호 | |',
      '| F002 | 2026-08-02 | 마찰 | 둘째 신호 (폰이 문구를 고쳤다) | |',
      '| F003 | 2026-08-07 | 마찰 | 폰이 손으로 매긴 번호 — master 의 F003 과 다른 사건 | |',
      '| F004 | 2026-08-07 | 실수 | 폰에만 있는 신호 | |',
    ]));
  }
  go('add', '-A'); go('commit', '-qm', 'docs: 인쇄본 PDF 16종 (유호님 지시)');
  go('checkout', '-q', 'master');

  if (장부도) {
    // 갈라진 **뒤** master 에 붙은 행 — checkout 으로 통째로 덮으면 이게 사라진다(F195).
    fs.writeFileSync(path.join(원본, 장부), 장부글([
      '| F001 | 2026-08-01 | 실수 | 첫 신호 | |',
      '| F002 | 2026-08-02 | 마찰 | 둘째 신호 | |',
      '| F003 | 2026-08-07 | 실수 | master 가 먼저 쓴 F003 | |',
    ]));
    go('add', '-A'); go('commit', '-qm', '장부 F003');
  }

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

/* F195 실측: 폰이 장부의 두 행 문구만 고쳤는데, 그 사이 master 에 붙은 4행이 **삭제로** 실렸다.
 * git 은 오류 0 이고 `--stat` 도 「1 파일 변경」으로만 보인다 — 이 검사가 그 자리다. */
test('🔴 추가전용 장부는 덮지 않고 합친다 — 갈라진 뒤 master 에 붙은 행이 살아남는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 브랜치 } = 픽스처({ 장부도: true });
  const r = 돌린다(repo, ['--받기', 브랜치]);
  assert.strictEqual(r.코드, 0, r.글);

  const 합친것 = 읽기(repo, 장부);
  assert.match(합친것, /master 가 먼저 쓴 F003/,
    'master 가 갈라진 뒤 붙인 행이 사라졌다 — 폰 판으로 통째로 덮었다(F195 그대로)');
  assert.match(합친것, /폰에만 있는 신호/, '폰이 새로 적은 행(F004)이 안 들어왔다 — 합치는 게 아니라 버린 것이다');
  assert.doesNotMatch(합친것, /폰이 문구를 고쳤다/,
    '같은 번호를 폰 판으로 덮었다 — 폰의 바탕은 갈라진 시점이라 낡았다');
  assert.doesNotMatch(합친것, /다른 사건/, '번호가 겹치는 폰 행을 그대로 붙여 F003 이 두 개가 됐다');

  const 번호들 = (합친것.match(/^\|\s*F\d+\s*\|/gm) || []).map((s) => s.trim());
  assert.strictEqual(new Set(번호들).size, 번호들.length, `번호가 중복됐다: ${번호들.join(' ')}`);
  assert.strictEqual(번호들.length, 4, `행 수가 F001~F004 가 아니다: ${번호들.join(' ')}`);

  // 내 판을 남긴 자리는 **버린 게 아니다** — 폰 판을 커밋 메시지에 실어 다시 올릴 자리를 남긴다.
  /* 🔴 「다른 사건」으로 재면 안 된다 — 그 말은 안내 문구에도 있어서 행을 빼도 초록이다(변이가 잡았다).
   *   폰 행 **본문에만** 있는 말로 잰다. */
  const 본문 = G(repo)('log', '--format=%B', '-2').stdout;
  assert.match(본문, /폰이 손으로 매긴 번호/, '번호가 겹쳐 안 실은 폰 행이 어디에도 안 남았다 — 그건 조용한 유실이다');
  assert.match(본문, /friction\.js add/, '다시 올릴 방법을 안 주면 따를 수 없는 처방이다(F103)');
});

/* 실측 `bw80kq`: 폰의 설계 문서가 이미 다른 경로로 master 에 들어와 있었고, master 는 거기에
 * 계보 각주를 덧붙여 뒀다. 그대로 덮었으면 그 각주가 **삭제로** 실린다 — 커밋이었다면
 * git-scope-guard ⑨ 가 막는 그 모양이다. 폰의 바탕은 언제나 갈라진 시점이라 더 옛 판이다. */
test('🔴 갈라진 뒤 master 가 고친 파일은 덮지 않고 건너뛴다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 원본, 브랜치 } = 픽스처();
  // master 가 폰산출물.md 를 갈라진 뒤에 고친다(폰은 그 사실을 모른다).
  fs.writeFileSync(path.join(원본, '폰산출물.md'), '폰이 만든 것\nmaster 가 뒤에 붙인 줄\n');
  G(원본)('add', '-A'); G(원본)('commit', '-qm', 'master 가 뒤에 고침');
  G(repo)('pull', '-q', 'origin', 'master');

  const r = 돌린다(repo, ['--받기', 브랜치]);
  assert.strictEqual(r.코드, 0, r.글);
  assert.match(읽기(repo, '폰산출물.md'), /master 가 뒤에 붙인 줄/,
    '폰 판으로 덮어 master 의 뒤 편집이 사라졌다 — 커밋이었다면 가드 ⑨ 가 막는 모양이다');
  assert.match(r.글, /건너뛴다/, '왜 안 가져왔는지 말해야 한다');
  assert.ok(fs.existsSync(path.join(repo, '폰빌더.js')), '건너뛸 파일 때문에 나머지까지 안 가져왔다');

  const 본문 = G(repo)('log', '--format=%B', '-2').stdout;
  assert.match(본문, /git checkout \S+ -- "?폰산출물\.md/,
    '폰 판을 쓰려면 어떻게 하는지 안 주면 따를 수 없는 처방이다(F103)');
});

/* 실측 `hftriw`: 폰이 장부의 세 행 **문구만** 고쳤다. 전부 내 판을 남기니 파일이 안 바뀌고,
 * `git commit` 은 커밋할 게 없어 exit 1 로 죽었다 — 그럼 브랜치는 영원히 대기로 뜨고
 * 안 실은 폰 행은 **어디에도 안 남는다**. 0건과 같은 자리다: 이력과 버린 것은 남긴다. */
test('🔴 합쳐도 바뀌는 게 없으면 — 멈추지 말고 이력에 남긴다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 브랜치 } = 픽스처({ 장부만: true });
  const r = 돌린다(repo, ['--받기', 브랜치]);
  assert.strictEqual(r.코드, 0, '커밋할 게 없다고 죽었다 — 이 브랜치는 대기 목록에서 안 빠진다\n' + r.글);
  assert.doesNotMatch(읽기(repo, 장부), /폰이 문구를 고쳤다/, '폰 판으로 덮었다');

  const 본문 = G(repo)('log', '--format=%B', '-1').stdout;
  assert.match(본문, /병합 이력/, '이력을 안 남기면 대기 목록에서 안 빠진다');
  assert.match(본문, /폰이 문구를 고쳤다/, '안 실은 폰 행이 어디에도 안 남았다 — 조용한 유실이다');
  assert.doesNotMatch(돌린다(repo).글, /받으려면/, '이력을 남겼는데 아직 대기로 잡힌다');
});

test('행합치기 — 같은 번호는 내 판, 없는 번호만 붙인다 (개행은 내 판을 따른다)', () => {
  const 내판 = '| ID |\n|---|\n| F001 | 내 판 |\r\n| F002 | 나만 있다 |\r\n';
  const 폰판 = '| ID |\n|---|\n| F001 | 폰 판 |\n| F003 | 폰만 있다 |\n';
  const r = 행합치기(내판.replace(/\r?\n/g, '\r\n'), 폰판);
  assert.deepStrictEqual(r.붙임, ['| F003 | 폰만 있다 |']);
  assert.deepStrictEqual(r.버림, ['| F001 | 폰 판 |']);
  assert.match(r.내용, /내 판/); assert.doesNotMatch(r.내용, /폰 판/);
  assert.ok(!/[^\r]\n/.test(r.내용), 'CRLF 판에 LF 줄을 섞어 넣었다');
});

test('🔴 값마다 줄을 바꿔 읽는 자리 — 빈 제목이 뒤를 밀지 않는다', () => {
  // 제목이 빈 브랜치가 하나 끼면, 빈 줄을 버리는 구현은 그 뒤가 통째로 한 칸씩 밀린다.
  const out = 'origin/claude/a\n1분 전\n첫 제목\norigin/claude/b\n2분 전\n\norigin/claude/c\n3분 전\n셋째\n';
  const 묶음 = 묶어읽기(out, 3);
  assert.strictEqual(묶음.length, 3, '빈 값을 버려서 묶음이 깨졌다');
  assert.deepStrictEqual(묶음[1], ['origin/claude/b', '2분 전', ''], '빈 제목 자리가 사라졌다');
  assert.deepStrictEqual(묶음[2], ['origin/claude/c', '3분 전', '셋째'], '뒤가 한 칸 밀렸다');
});
