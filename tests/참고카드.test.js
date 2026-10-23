/* 참고카드 — 텔레그램 팁 적용안 카드의 목록 도구와 카드만 커밋하는 도구.
 * 목록은 합성 카드로, 커밋은 임시 git 저장소(남의 스테이징·미커밋 수정이 섞인 공용 작업본 흉내)에서 잰다.
 * 실제 저장소·장부·텔레그램은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 목록 = require(path.join(REPO, 'tools', '참고카드_목록.js'));
const { 상태경로 } = require(path.join(REPO, 'tools', '참고카드_커밋.js'));

const 카드글 = (머리) => ['---', ...Object.entries(머리).map(([k, v]) => `${k}: ${v}`), '---', '', '## 무엇인가', '시험'].join('\n');

test('머리 정보: 키: 값 줄을 읽고, CRLF·BOM도 읽고, 머리가 없으면 null', () => {
  assert.deepStrictEqual(목록.머리읽기(카드글({ 제목: '가', 대상: 'WORLD 앱 · 싱크타운', 언제: '지금' })), { 제목: '가', 대상: 'WORLD 앱 · 싱크타운', 언제: '지금' });
  assert.deepStrictEqual(목록.머리읽기('﻿---\r\n제목: 나: 부제\r\n---\r\n본문'), { 제목: '나: 부제' });
  assert.strictEqual(목록.머리읽기('# 머리 없음'), null);
  assert.strictEqual(목록.머리읽기('---\n제목: 끝 표식 없음'), null);
  assert.deepStrictEqual(목록.대상나누기('WORLD 앱 · 싱크타운'), ['WORLD 앱', '싱크타운']);
  assert.deepStrictEqual(목록.대상나누기('홈페이지, LAB 게임'), ['홈페이지', 'LAB 게임']);
  assert.deepStrictEqual(목록.대상나누기('SNS·영상 · 브랜드·디자인'), ['SNS·영상', '브랜드·디자인'], '이름 안의 ·는 나누지 않는다');
  assert.deepStrictEqual(목록.대상나누기(''), []);
});

test('목록: 지금 하기는 적용하지 않은 「지금」만, 대상은 표 순서, 새 카드가 위', () => {
  assert.strictEqual(목록.목록글([]), '아직 카드가 없다.');
  const 카드 = (파일, 머리) => ({ 파일, ...머리, 대상목록: 목록.대상나누기(머리.대상) });
  const 글 = 목록.목록글([
    카드('2026-10-16_옛.md', { 제목: '옛 카드', 공유일: '2026-10-16', 대상: '싱크타운', 언제: '그 작업 때', 한줄: '배치' }),
    카드('2026-10-17_새.md', { 제목: '새 카드', 공유일: '2026-10-17', 대상: 'WORLD 앱 · 싱크타운', 언제: '지금', 한줄: '움직임' }),
    카드('2026-10-17_끝.md', { 제목: '끝낸 카드', 공유일: '2026-10-17', 대상: 'WORLD 앱', 언제: '지금', 상태: '적용함 (abc)' }),
    카드('2026-10-17_새대상.md', { 제목: '새 대상', 공유일: '2026-10-17', 대상: '회사 앱', 언제: '그 작업 때' }),
    { 파일: '깨진.md', 오류: '머리 정보 없음' },
  ]);
  const 지금 = 글.split('### 지금 하기')[1].split('###')[0];
  assert.match(지금, /새 카드/);
  assert.doesNotMatch(지금, /끝낸 카드/, '적용함은 지금 하기에서 빠진다');
  assert.ok(글.indexOf('### WORLD 앱') < 글.indexOf('### 싱크타운'), '대상 표 순서');
  assert.ok(글.indexOf('### 싱크타운') < 글.indexOf('### 회사 앱'), '표에 없는 대상은 뒤에');
  const 타운 = 글.split('### 싱크타운')[1].split('###')[0];
  assert.ok(타운.indexOf('새 카드') < 타운.indexOf('옛 카드'), '새 카드가 위');
  assert.match(글, /\[새 카드\]\(카드\/2026-10-17_새\.md\) — 움직임 · 지금 · 2026-10-17/);
  assert.match(글, /끝낸 카드.*· 적용함/);
  assert.match(글, /### 머리 정보를 못 읽은 카드\n- 카드\/깨진\.md — 머리 정보 없음/);
  assert.match(글, /^카드 4장\./);
});

test('README 갈아쓰기: 표식 사이만 바꾸고 원래 줄끝을 따른다', () => {
  const 시작 = '<!-- 목록 시작 · tools/참고카드_목록.js 가 이 구간만 다시 쓴다 -->';
  const 원문 = ['# 머리', 시작, '옛 목록', '<!-- 목록 끝 -->', '꼬리'].join('\r\n');
  const 새 = 목록.갈아쓰기(원문, '줄 하나\n줄 둘');
  assert.strictEqual(새, ['# 머리', 시작, '줄 하나', '줄 둘', '<!-- 목록 끝 -->', '꼬리'].join('\r\n'));
  assert.throws(() => 목록.갈아쓰기('표식 없음', 'x'), /표식/);
});

test('status -z 경로: 앞 공백 코드를 자르지 않고, 이름 바꿈의 옛 경로는 건너뛴다', () => {
  const 출력 = [' M docs/참고카드/README.md', '?? docs/참고카드/카드/새.md', 'R  docs/참고카드/카드/새이름.md', 'docs/참고카드/카드/옛이름.md', ''].join('\0');
  assert.deepStrictEqual(상태경로(출력), ['docs/참고카드/README.md', 'docs/참고카드/카드/새.md', 'docs/참고카드/카드/새이름.md']);
});

test('카드 커밋: 남의 스테이징·미커밋 수정은 그대로 두고 카드 폴더만 커밋하고 공용 인덱스를 맞춘다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cards-test-'));
  const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 뿌리, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(뿌리, 'tools'));
    for (const f of ['참고카드_커밋.js', '참고카드_목록.js', 'git잠금.js']) fs.copyFileSync(path.join(REPO, 'tools', f), path.join(뿌리, 'tools', f));
    fs.mkdirSync(path.join(뿌리, 'docs', '참고카드', '카드'), { recursive: true });
    fs.writeFileSync(path.join(뿌리, 'docs', '참고카드', 'README.md'), '# 참고 카드\n');
    fs.writeFileSync(path.join(뿌리, '남.txt'), 'base\n');
    fs.writeFileSync(path.join(뿌리, '결정.md'), 'a\n');
    git('init', '-q', '-b', 'master');
    git('config', 'user.name', 'test');
    git('config', 'user.email', 'test@example.com');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    const 처음 = git('rev-parse', 'HEAD').trim();

    fs.appendFileSync(path.join(뿌리, '남.txt'), 'peer staged\n');
    git('add', '남.txt');
    fs.appendFileSync(path.join(뿌리, '결정.md'), 'peer unstaged\n');
    fs.writeFileSync(path.join(뿌리, '남의새파일.txt'), 'x\n');
    fs.writeFileSync(path.join(뿌리, 'docs', '참고카드', '카드', '2026-10-17_시험.md'), 카드글({ 제목: '시험', 대상: 'WORLD 앱', 언제: '지금' }));
    fs.appendFileSync(path.join(뿌리, 'docs', '참고카드', 'README.md'), '목록\n');

    const 결과 = JSON.parse(execFileSync('node', [path.join(뿌리, 'tools', '참고카드_커밋.js'), '--커밋', '--json'], { cwd: 뿌리, encoding: 'utf8' }));
    assert.strictEqual(결과.결과, '커밋함');
    assert.deepStrictEqual(결과.파일.sort(), ['docs/참고카드/README.md', 'docs/참고카드/카드/2026-10-17_시험.md']);
    assert.strictEqual(git('rev-parse', 'HEAD~1').trim(), 처음, '부모는 처음 HEAD');
    assert.deepStrictEqual(git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort(), 결과.파일.sort(), '커밋에는 카드 폴더만');
    assert.match(git('log', '-1', '--format=%B'), /Co-Authored-By: Claude/);
    assert.strictEqual(git('diff', '--cached', '--name-only').trim(), '남.txt', '남이 스테이징한 것만 그대로 스테이징');
    assert.strictEqual(git('status', '--porcelain=v1', '--', 'docs/참고카드').trim(), '', '카드 경로는 공용 인덱스·작업본 모두 새 HEAD와 같다');
    assert.match(git('status', '--porcelain=v1', '--', '결정.md'), /^ M 결정\.md/, '남의 미커밋 수정은 작업본에 그대로');
    assert.ok(fs.existsSync(path.join(뿌리, '남의새파일.txt')));

    const 다시 = JSON.parse(execFileSync('node', [path.join(뿌리, 'tools', '참고카드_커밋.js'), '--커밋', '--json'], { cwd: 뿌리, encoding: 'utf8' }));
    assert.strictEqual(다시.결과, '커밋할 것 없음');
  } finally {
    fs.rmSync(뿌리, { recursive: true, force: true });
  }
});

test('카드 커밋: 꼬리 없는 작업본(HEAD가 origin/master의 조상)에서는 로컬에 쌓지 않고 바로올리기로 카드만 커밋·push한다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cards-push-test-'));
  const 작업본 = path.join(뿌리, '공용'), 원격 = path.join(뿌리, 'origin.git');
  const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 작업본, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(작업본, 'tools'), { recursive: true });
    for (const f of ['참고카드_커밋.js', '참고카드_목록.js', 'git잠금.js', '바로올리기.js', '내커밋.js', '공개검사.js', 'git-storage-check.cjs', 'git-storage-policy.json']) {
      fs.copyFileSync(path.join(REPO, 'tools', f), path.join(작업본, 'tools', f));
      fs.mkdirSync(path.join(작업본, 'tools', 'lib'), { recursive: true });
      for (const helper of ['git-commit-core.cjs', 'git-commit-plan.cjs', 'git-publish-core.cjs', 'backup-primitives.cjs']) fs.copyFileSync(path.join(REPO, 'tools', 'lib', helper), path.join(작업본, 'tools', 'lib', helper));
    }
    fs.mkdirSync(path.join(작업본, 'docs', '참고카드', '카드'), { recursive: true });
    fs.writeFileSync(path.join(작업본, 'docs', '참고카드', 'README.md'), '# 참고 카드\n');
    fs.writeFileSync(path.join(작업본, '남.txt'), 'base\n');
    git('init', '-q', '-b', 'master');
    git('config', 'user.name', 'test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'core.autocrlf', 'false');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
    git('remote', 'add', 'origin', 원격);
    git('push', '-q', 'origin', 'master');
    git('fetch', '-q', 'origin');
    const 처음 = git('rev-parse', 'HEAD').trim();

    fs.appendFileSync(path.join(작업본, '남.txt'), 'peer unstaged\n');
    fs.writeFileSync(path.join(작업본, 'docs', '참고카드', '카드', '2026-10-20_시험.md'), 카드글({ 제목: '시험', 대상: 'WORLD 앱', 언제: '지금' }));
    fs.appendFileSync(path.join(작업본, 'docs', '참고카드', 'README.md'), '목록\n');

    const 결과 = JSON.parse(execFileSync('node', [path.join(작업본, 'tools', '참고카드_커밋.js'), '--커밋', '--json'], { cwd: 작업본, encoding: 'utf8' }));
    assert.strictEqual(결과.결과, '커밋함', JSON.stringify(결과));
    assert.strictEqual(결과.올림, true);
    assert.deepStrictEqual(결과.파일.sort(), ['docs/참고카드/README.md', 'docs/참고카드/카드/2026-10-20_시험.md']);
    const 원격머리 = execFileSync('git', ['--git-dir', 원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim();
    assert.strictEqual(원격머리, 결과.커밋, 'origin에 올라갔다');
    assert.strictEqual(execFileSync('git', ['--git-dir', 원격, 'rev-parse', `${원격머리}~1`], { encoding: 'utf8' }).trim(), 처음, '부모는 처음 origin 머리');
    assert.deepStrictEqual(execFileSync('git', ['-c', 'core.quotepath=false', '--git-dir', 원격, 'show', '--name-only', '--format=', 원격머리], { encoding: 'utf8' }).trim().split('\n').sort(), 결과.파일.sort(), '카드 폴더만');
    assert.match(execFileSync('git', ['--git-dir', 원격, 'log', '-1', '--format=%B', 원격머리], { encoding: 'utf8' }), /Co-Authored-By: Claude/);
    assert.strictEqual(git('rev-parse', 'HEAD').trim(), 결과.커밋, '작업본은 올린 커밋으로 따라갔다(꼬리 없음)');
    assert.strictEqual(git('status', '--porcelain=v1', '--', 'docs/참고카드').trim(), '', '카드 경로는 새 HEAD와 같다');
    assert.match(git('status', '--porcelain=v1', '--', '남.txt'), /^ M 남\.txt/, '남의 미커밋 수정은 그대로');

    const 다시 = JSON.parse(execFileSync('node', [path.join(작업본, 'tools', '참고카드_커밋.js'), '--커밋', '--json'], { cwd: 작업본, encoding: 'utf8' }));
    assert.strictEqual(다시.결과, '커밋할 것 없음');
  } finally {
    fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('카드 커밋: 예약 작업이 도는 운영 사본(분리된 HEAD 워크트리, origin/master의 조상)에서도 바로올리기로 카드만 올리고 따라간다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-cards-ops-test-'));
  const 공용 = path.join(뿌리, '공용'), 운영 = path.join(뿌리, '운영'), 원격 = path.join(뿌리, 'origin.git');
  const git = (곳, ...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 곳, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(공용, 'tools', 'lib'), { recursive: true });
    for (const f of ['참고카드_커밋.js', '참고카드_목록.js', 'git잠금.js', '바로올리기.js', '내커밋.js', '공개검사.js', 'git-storage-check.cjs', 'git-storage-policy.json', '운영사본.js']) {
      fs.copyFileSync(path.join(REPO, 'tools', f), path.join(공용, 'tools', f));
      fs.mkdirSync(path.join(공용, 'tools', 'lib'), { recursive: true });
      for (const helper of ['git-commit-core.cjs', 'git-commit-plan.cjs', 'git-publish-core.cjs', 'backup-primitives.cjs']) fs.copyFileSync(path.join(REPO, 'tools', 'lib', helper), path.join(공용, 'tools', 'lib', helper));
    }
    for (const f of ['장부올리기.js', '공용작업본.js']) fs.copyFileSync(path.join(REPO, 'tools', 'lib', f), path.join(공용, 'tools', 'lib', f));
    fs.mkdirSync(path.join(공용, 'docs', '참고카드', '카드'), { recursive: true });
    fs.writeFileSync(path.join(공용, 'docs', '참고카드', 'README.md'), '# 참고 카드\n');
    git(공용, 'init', '-q', '-b', 'master');
    git(공용, 'config', 'user.name', 'test');
    git(공용, 'config', 'user.email', 'test@example.com');
    git(공용, 'config', 'core.autocrlf', 'false');
    git(공용, 'add', '-A');
    git(공용, 'commit', '-q', '-m', 'base');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
    git(공용, 'remote', 'add', 'origin', 원격);
    git(공용, 'push', '-q', 'origin', 'master');
    git(공용, 'fetch', '-q', 'origin');
    git(공용, 'worktree', 'add', '-q', '--detach', 운영, 'origin/master');

    fs.mkdirSync(path.join(운영, 'docs', '참고카드', '카드'), { recursive: true });   // 빈 폴더는 git에 없다
    fs.writeFileSync(path.join(운영, 'docs', '참고카드', '카드', '2026-10-22_운영.md'), 카드글({ 제목: '운영 사본에서 쓴 카드', 대상: 'WORLD 앱', 언제: '지금' }));
    const 결과 = JSON.parse(execFileSync('node', [path.join(운영, 'tools', '참고카드_커밋.js'), '--커밋', '--json'], { cwd: 운영, encoding: 'utf8' }));
    assert.strictEqual(결과.결과, '커밋함', JSON.stringify(결과));
    assert.strictEqual(결과.올림, true);
    assert.deepStrictEqual(결과.파일, ['docs/참고카드/카드/2026-10-22_운영.md']);
    assert.strictEqual(execFileSync('git', ['--git-dir', 원격, 'rev-parse', 'master'], { encoding: 'utf8' }).trim(), 결과.커밋, 'origin에 올라갔다');
    assert.strictEqual(git(운영, 'rev-parse', 'HEAD').trim(), 결과.커밋, '운영 사본은 올린 커밋으로 따라갔다');
    assert.strictEqual(git(운영, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'HEAD', '여전히 분리된 HEAD');
    assert.strictEqual(git(운영, 'status', '--porcelain=v1').trim(), '');
  } finally {
    fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 });
  }
});
