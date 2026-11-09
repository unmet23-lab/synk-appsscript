/* 예약 사본 — 앱 예약 작업 워크트리의 git 밖 결과물을 공용 작업본으로 넘기고, 지워도 되는지 본다.
 * 임시 bare 원격(origin) · 공용 작업본(메인) · 세션 워크트리(.claude/worktrees/sched-…)로 잰다. 실제 저장소·원격·전역 git 설정은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-sched-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});

const 도구 = require(path.join(REPO, 'tools', '예약사본.js'));

const 깃 = (폴더) => (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, 경로);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
  return 파일;
}

/** origin · 메인 · 예약 워크트리 하나. 편 폴더의 remotion/out과 게시/*.mp4는 .gitignore 대상 */
function 판() {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sched-'));
  const 원격 = path.join(뿌리, 'origin.git');
  const 메인 = path.join(뿌리, 'main');
  깃(뿌리)('init', '-q', '--bare', '-b', 'master', 원격);
  깃(뿌리)('clone', '-q', 원격, 메인);
  // node_modules에 빗금을 붙이지 않는다 — 빗금 꼴은 폴더에만 맞아 Linux의 심볼릭 링크가 무시 대상에서 빠진다(Windows junction은 폴더로 보인다)
  쓰기(메인, '.gitignore', 'out/\n*.mp4\nnode_modules\n.tmp/\n');
  쓰기(메인, 'docs/마케팅/편A/기획.md', '기획\n');
  쓰기(메인, 'node_modules/표지/index.js', 'module.exports = 1;\n');
  const g = 깃(메인);
  g('add', '-A'); g('commit', '-q', '-m', '처음'); g('push', '-q', 'origin', 'master');
  const 사본 = path.join(메인, '.claude', 'worktrees', 'sched-synk-daily-lab-1103-0700');
  g('worktree', 'add', '-q', '-b', 'sched', 사본, 'origin/master');
  return { 뿌리, 원격, 메인, 사본, 치우기: () => fs.rmSync(뿌리, { recursive: true, force: true }) };
}

test('넘기기 — 편 폴더의 git 밖 영상을 공용 작업본 같은 경로로 복사하고, 미리 보기는 아무것도 안 만든다', () => {
  const t = 판();
  try {
    쓰기(t.사본, 'docs/마케팅/편A/remotion/out/b1_v1.mp4', '렌더');
    const 원본 = 쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', '최종본');
    const 시각 = new Date(Date.now() - 60_000); fs.utimesSync(원본, 시각, 시각);
    const 미리 = 도구.넘기기({ 저장소: t.사본 });
    assert.equal(미리.결과, '미리 보기');
    assert.deepEqual(미리.셈, { 복사: 2 });
    assert.equal(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4')), false);

    const r = 도구.넘기기({ 저장소: t.사본, 실행: true });
    assert.deepEqual(r.셈, { 복사: 2 });
    const 공용쪽 = path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4');
    assert.equal(fs.readFileSync(공용쪽, 'utf8'), '최종본');
    assert.equal(fs.statSync(공용쪽).nlink, 1, '하드링크가 아니라 따로 있는 파일');
    assert.ok(Math.abs(fs.statSync(공용쪽).mtimeMs - 시각.getTime()) < 2000, '수정 시각을 지킨다 — 검사 기록 대조가 산다');

    // 원본 자리에 그대로 다시 써도 공용 쪽은 다음 넘기기 전까지 그대로다
    assert.deepEqual(도구.넘기기({ 저장소: t.사본, 실행: true }).셈, { 같음: 2 });
    fs.writeFileSync(원본, '다시 렌더한 최종본');
    assert.equal(fs.readFileSync(공용쪽, 'utf8'), '최종본', '렌더 중인 원본이 공용 자리에 비치지 않는다');
    const 뒤 = new Date(Date.now() + 5000); fs.utimesSync(원본, 뒤, 뒤);
    assert.deepEqual(도구.넘기기({ 저장소: t.사본, 실행: true }).셈, { 바꿈: 1, 같음: 1 });
    assert.equal(fs.readFileSync(공용쪽, 'utf8'), '다시 렌더한 최종본');
  } finally { t.치우기(); }
});

test('넘기기 — 공용 쪽이 더 새것이면 덮지 않고 알린다', () => {
  const t = 판();
  try {
    const 원본 = 쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', '옛 판');
    const 공용쪽 = 쓰기(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4', '공용에서 고친 판');
    const 앞 = new Date(Date.now() - 60_000); fs.utimesSync(원본, 앞, 앞);
    const r = 도구.넘기기({ 저장소: t.사본, 실행: true });
    assert.deepEqual(r.공용이더새것, ['docs/마케팅/편A/게시/b1_master.mp4']);
    assert.equal(fs.readFileSync(공용쪽, 'utf8'), '공용에서 고친 판');
  } finally { t.치우기(); }
});

test('넘기기 — 크기 · 수정 시각이 같아도 내용이 다르면 「같음」으로 보지 않고, 끝이 남은 것으로 잡는다', () => {
  const t = 판();
  try {
    const 원본 = 쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', 'NEW');
    const 공용쪽 = 쓰기(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4', 'OLD');
    const 때 = new Date(Date.now() - 60_000);
    fs.utimesSync(원본, 때, 때); fs.utimesSync(공용쪽, 때, 때);
    const r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '남은 것 있음');
    assert.ok(r.남은것.some((x) => x.includes('공용 쪽이 더 새것')), JSON.stringify(r.남은것));
    assert.equal(fs.readFileSync(공용쪽, 'utf8'), 'OLD');
    // 내용까지 같으면 같은 파일이다
    fs.writeFileSync(공용쪽, 'NEW'); fs.utimesSync(공용쪽, 때, 때);
    assert.equal(도구.끝({ 저장소: t.사본, 실행: true }).결과, '지워도 됨');
  } finally { t.치우기(); }
});

test('넘기기 — 판단한 뒤 공용 쪽이 더 새 판으로 바뀌면 덮지 않는다 · 임시 파일을 남기지 않는다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sched-one-'));
  try {
    const 원본 = 쓰기(뿌리, '원본.mp4', '두 번째');
    const 대상 = 쓰기(뿌리, '공용.mp4', '첫 번째');
    const 앞 = new Date(Date.now() - 120_000), 가운데 = new Date(Date.now() - 60_000);
    fs.utimesSync(대상, 앞, 앞); fs.utimesSync(원본, 가운데, 가운데);
    const 결과 = 도구.하나넘기기(원본, 대상, true, { 검사뒤: () => { fs.writeFileSync(대상, '세 번째'); } });
    assert.equal(결과, '공용이 더 새것');
    assert.equal(fs.readFileSync(대상, 'utf8'), '세 번째');
    assert.deepEqual(fs.readdirSync(뿌리).sort(), ['공용.mp4', '원본.mp4']);
    // 그새 바뀌지 않으면 정상으로 바꾼다
    fs.utimesSync(대상, 앞, 앞);
    assert.equal(도구.하나넘기기(원본, 대상, true), '바꿈');
    assert.equal(fs.readFileSync(대상, 'utf8'), '두 번째');
  } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
});

test('넘기기 — 워크트리 안을 가리키는 링크는 공용 쪽 같은 자리로, 밖을 가리키는 링크는 그대로', () => {
  const t = 판();
  try {
    fs.mkdirSync(path.join(t.사본, 'docs/마케팅/편A/assets'), { recursive: true });
    fs.mkdirSync(path.join(t.메인, 'docs/마케팅/편A/assets'), { recursive: true });
    fs.mkdirSync(path.join(t.사본, 'docs/마케팅/편A/remotion'), { recursive: true });
    // .gitignore가 잡는 링크 이름으로
    fs.symlinkSync(path.join(t.사본, 'docs/마케팅/편A/assets'), path.join(t.사본, 'docs/마케팅/편A/remotion/node_modules'), 'junction');
    const r = 도구.넘기기({ 저장소: t.사본, 실행: true });
    assert.equal(path.resolve(r.링크[0].대상), path.join(t.메인, 'docs/마케팅/편A/assets'));
    assert.equal(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/remotion/node_modules')), true);
  } finally { t.치우기(); }
});

test('끝 — docs/마케팅 밖에 남긴 결과물은 「남은 것」, .tmp · 빌드 결과는 버리는 것으로 본다', () => {
  const t = 판();
  try {
    쓰기(t.사본, 'out/master.mp4', '최종 영상');
    쓰기(t.사본, 'out/master.gif', '최종 움직이는 그림');
    쓰기(t.사본, '.tmp/시험/장면.png', '버려도 되는 그림');
    쓰기(t.사본, 'out/기록.txt', '결과물이 아닌 것');
    const r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '남은 것 있음');
    assert.deepEqual(r.남은것, ['docs/마케팅 밖 git 밖 결과물 out/master.gif', 'docs/마케팅 밖 git 밖 결과물 out/master.mp4']);
  } finally { t.치우기(); }
});

test('넘기기 — 옆 이름을 먼저 차지한 쪽만 넘기고, 다른 쪽은 「열려 있음」, 남의 옆 이름은 오래돼도 지우지 않는다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sched-side-'));
  try {
    const 원본 = 쓰기(뿌리, '원본.mp4', '새 판');
    const 대상 = 쓰기(뿌리, '공용.mp4', '옛 판');
    const 앞 = new Date(Date.now() - 60_000); fs.utimesSync(대상, 앞, 앞);
    const 옆 = 쓰기(뿌리, '공용.mp4.예약사본', '다른 회차가 복사 중');
    assert.equal(도구.하나넘기기(원본, 대상, true), '열려 있음');
    assert.equal(fs.readFileSync(대상, 'utf8'), '옛 판');
    assert.equal(fs.readFileSync(옆, 'utf8'), '다른 회차가 복사 중', '남의 옆 이름을 지우지 않는다');
    fs.rmSync(옆);
    assert.equal(도구.하나넘기기(원본, 대상, true), '바꿈', '옆 이름이 비면 넘긴다');
    assert.equal(fs.readFileSync(대상, 'utf8'), '새 판');
  } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
});

test('넘기기 — 바꿔 끼운 뒤에는 옆 이름 자리를 지우지 않는다(다음 회차가 이미 차지했을 수 있다)', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sched-owner-'));
  const 원래 = fs.renameSync;
  try {
    const 원본 = 쓰기(뿌리, '원본.mp4', 'BBBB');
    const 대상 = path.join(뿌리, '공용.mp4');
    const 옆 = `${대상}.예약사본`;
    // 바꿔 끼운 바로 그 순간 다른 회차가 옆 이름을 차지한다
    fs.renameSync = (가, 나) => { 원래(가, 나); if (나 === 대상) fs.writeFileSync(옆, '다음 회차의 복사본'); };
    assert.equal(도구.하나넘기기(원본, 대상, true), '복사');
    assert.equal(fs.readFileSync(옆, 'utf8'), '다음 회차의 복사본');
    assert.equal(fs.readFileSync(대상, 'utf8'), 'BBBB');
  } finally { fs.renameSync = 원래; fs.rmSync(뿌리, { recursive: true, force: true }); }
});

test('넘기기 — 검사받지 않은 영상에 검사받은 시각을 달아 주지 않는다(검사 뒤 같은 크기로 바꾼 영상)', () => {
  const t = 판();
  try {
    const 검사때 = new Date(Math.trunc(Date.now() / 1000) * 1000 - 600_000);
    const 바꾼때 = new Date(Math.trunc(Date.now() / 1000) * 1000 - 60_000);
    쓰기(t.사본, 'docs/마케팅/편A/게시/준비.json', JSON.stringify({ 검사: { 파일: [{ 경로: '게시/b1_master.mp4', 바이트: 4, 수정: 검사때.toISOString() }] } }));
    const 원본 = 쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', 'BBBB');
    const 공용쪽 = 쓰기(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4', 'AAAA');
    fs.utimesSync(공용쪽, 검사때, 검사때); fs.utimesSync(원본, 바꾼때, 바꾼때);
    assert.deepEqual(도구.넘기기({ 저장소: t.사본, 실행: true }).셈, { 바꿈: 1 });
    assert.equal(fs.statSync(공용쪽).mtime.toISOString(), 바꾼때.toISOString());
    assert.deepEqual(도구.넘기기({ 저장소: t.사본, 실행: true }).셈, { 같음: 1 });
    assert.equal(fs.statSync(공용쪽).mtime.toISOString(), 바꾼때.toISOString(), '기록 시각으로 되돌리면 검사받지 않은 BBBB가 관문을 통과한다');
  } finally { t.치우기(); }
});

test('넘기기 — 내용이 같으면 공용 쪽 시각은 검사 기록이 이 원본을 검사한 것일 때만 맞춘다', () => {
  const t = 판();
  try {
    const 원본 = 쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', '같은 내용');
    const 공용쪽 = 쓰기(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4', '같은 내용');
    const 옛날 = new Date(Math.trunc(Date.now() / 1000) * 1000 - 600_000);
    const 새로 = new Date(Math.trunc(Date.now() / 1000) * 1000 - 60_000);
    fs.utimesSync(공용쪽, 옛날, 옛날); fs.utimesSync(원본, 새로, 새로);
    // 검사 기록이 없으면(공용 영상을 복사해 왔을 뿐) 공용 쪽 시각을 건드리지 않는다
    assert.deepEqual(도구.넘기기({ 저장소: t.사본, 실행: true }).셈, { 같음: 1 });
    assert.equal(fs.statSync(공용쪽).mtime.toISOString(), 옛날.toISOString());
    // 기록이 옛 시각이면 그대로 — 복사해 온 사본이 큐의 「검사 뒤 바뀜」을 부르지 않는다
    const 준비 = (수정) => 쓰기(t.사본, 'docs/마케팅/편A/게시/준비.json', JSON.stringify({ 검사: { 파일: [{ 경로: '게시/b1_master.mp4', 바이트: 13, 수정 }] } }));
    준비(옛날.toISOString());
    도구.넘기기({ 저장소: t.사본, 실행: true });
    assert.equal(fs.statSync(공용쪽).mtime.toISOString(), 옛날.toISOString());
    // 같은 내용을 다시 굽고 다시 검사했으면 기록의 새 시각에 맞춘다
    준비(새로.toISOString());
    assert.deepEqual(도구.넘기기({ 저장소: t.사본 }).셈, { 같음: 1 });
    assert.equal(fs.statSync(공용쪽).mtime.toISOString(), 옛날.toISOString(), '미리 보기는 건드리지 않는다');
    도구.넘기기({ 저장소: t.사본, 실행: true });
    assert.equal(fs.statSync(공용쪽).mtime.toISOString(), 새로.toISOString());
  } finally { t.치우기(); }
});

test('끝 — 파일 종류가 바뀐 것(T)도 미커밋으로 잡는다', () => {
  const t = 판();
  try {
    const 파일 = path.join(t.사본, 'docs/마케팅/편A/기획.md');
    fs.rmSync(파일);
    fs.symlinkSync(path.join(t.메인, 'docs/마케팅/편A/기획.md'), 파일, 'file');
    const r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '남은 것 있음', JSON.stringify(r.남은것));
    assert.ok(r.남은것.includes('미커밋 docs/마케팅/편A/기획.md'), JSON.stringify(r.남은것));
  } catch (e) {
    if (e.code === 'EPERM') return; // 이 PC에서 파일 심볼릭 링크 권한이 없으면 건너뛴다
    throw e;
  } finally { t.치우기(); }
});

test('공용 작업본에서 부르면 멈춘다', () => {
  const t = 판();
  try { assert.throws(() => 도구.넘기기({ 저장소: t.메인 }), /공용 작업본에서는/); }
  finally { t.치우기(); }
});

test('끝 — 링크(junction)는 공용 쪽에 만들어 두고 워크트리 안 링크만 끊는다, 공용 node_modules는 그대로', () => {
  const t = 판();
  try {
    쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', '최종본');
    const 링크 = path.join(t.사본, 'docs/마케팅/편A/remotion/node_modules');
    fs.mkdirSync(path.dirname(링크), { recursive: true });
    fs.symlinkSync(path.join(t.메인, 'node_modules'), 링크, 'junction');

    const r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '지워도 됨', JSON.stringify(r.남은것));
    assert.deepEqual(r.끊은링크, ['docs/마케팅/편A/remotion/node_modules']);
    assert.equal(fs.existsSync(링크), false);
    assert.ok(fs.existsSync(path.join(t.메인, 'node_modules/표지/index.js')), '링크 대상은 남는다');
    assert.ok(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/remotion/node_modules/표지/index.js')), '공용 쪽에 같은 링크를 만든다');
    assert.equal(fs.readFileSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4'), 'utf8'), '최종본');
  } finally { t.치우기(); }
});

test('끝 — 미커밋 · origin에 없는 커밋이 있으면 「남은 것 있음」(종료 1)', () => {
  const t = 판();
  try {
    쓰기(t.사본, 'docs/마케팅/편A/기획.md', '고친 기획\n');
    let r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '남은 것 있음');
    assert.ok(r.남은것.some((x) => x === '미커밋 docs/마케팅/편A/기획.md'));

    const g = 깃(t.사본);
    g('commit', '-q', '-am', '기획 고침');
    r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.ok(r.남은것.some((x) => x.startsWith('origin에 없는 커밋')), JSON.stringify(r.남은것));

    g('push', '-q', 'origin', 'HEAD:master');
    r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '지워도 됨', JSON.stringify(r.남은것));
    assert.equal(도구.main(['끝', '--저장소', t.사본, '--실행', '--json']), 0);
  } finally { t.치우기(); }
});

test('끝 — 남은 것이 있으면 링크를 끊지 않는다(고쳐 올리려면 node_modules가 있어야 한다)', () => {
  const t = 판();
  try {
    const 링크 = path.join(t.사본, 'node_modules');
    fs.symlinkSync(path.join(t.메인, 'node_modules'), 링크, 'junction');
    쓰기(t.사본, 'docs/마케팅/편A/기획.md', '고친 기획\n');
    const r = 도구.끝({ 저장소: t.사본, 실행: true });
    assert.equal(r.결과, '남은 것 있음');
    assert.deepEqual(r.끊은링크, []);
    assert.ok(fs.lstatSync(링크).isSymbolicLink());
  } finally { t.치우기(); }
});

test('남은사본 — 이름이 sched-<작업>-<MMDD>-<HHmm>인 다른 예약 워크트리만 보고, --실행이면 그 영상을 넘기고 지우지 않는다', () => {
  const t = 판();
  try {
    const 멈춘판 = 쓰기(t.사본, 'docs/마케팅/편A/게시/b1_master.mp4', '멈춘 회차의 최종본');
    쓰기(t.사본, 'docs/마케팅/편A/게시/b1_쓰는중.mp4', '렌더 중');
    쓰기(t.사본, 'docs/마케팅/편A/기획.md', '반쯤 고친 기획\n');
    const 옛날 = new Date(Date.now() - 31 * 60_000); fs.utimesSync(멈춘판, 옛날, 옛날);
    const 남 = path.join(t.메인, '.claude', 'worktrees', 'quirky-name-1234');
    깃(t.메인)('worktree', 'add', '-q', '-b', 'other', 남, 'origin/master');
    const 미리 = 도구.남은사본({ 저장소: t.메인 });
    assert.deepEqual(미리.사본.map((s) => s.이름), ['sched-synk-daily-lab-1103-0700']);
    assert.deepEqual(미리.사본[0].넘김.셈, { 복사: 1, '쓰는 중': 1 });
    assert.deepEqual(미리.사본[0].미커밋목록, ['docs/마케팅/편A/기획.md'], '이어 받을 파일을 보여 준다');
    assert.equal(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4')), false);
    도구.남은사본({ 저장소: t.메인, 실행: true });
    assert.equal(fs.readFileSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4'), 'utf8'), '멈춘 회차의 최종본');
    assert.equal(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_쓰는중.mp4')), false, '최근 30분 안에 쓴 파일은 도는 회차 것일 수 있어 넘기지 않는다');
    assert.ok(fs.existsSync(t.사본), '지우지 않는다');
    // 자기 자신은 남은 사본으로 세지 않는다
    assert.deepEqual(도구.남은사본({ 저장소: t.사본 }).사본, []);
  } finally { t.치우기(); }
});

test('들기 — 뿌리 node_modules를 공용 작업본에 잇고 남은 사본을 보인다', () => {
  const t = 판();
  try {
    const 다른 = path.join(t.메인, '.claude', 'worktrees', 'sched-synk-daily-threads-1030-2052');
    깃(t.메인)('worktree', 'add', '-q', '-b', 'b', 다른, 'origin/master');
    쓰기(다른, 'docs/마케팅/편A/기획.md', '반쯤 고친 기획\n');
    const 미리 = 도구.들기({ 저장소: t.사본 });
    assert.equal(미리.node_modules, '이을 것');
    assert.equal(fs.existsSync(path.join(t.사본, 'node_modules')), false);
    const r = 도구.들기({ 저장소: t.사본, 실행: true });
    assert.equal(r.node_modules, '이음');
    assert.ok(fs.lstatSync(path.join(t.사본, 'node_modules')).isSymbolicLink());
    assert.ok(fs.existsSync(path.join(t.사본, 'node_modules/표지/index.js')));
    assert.deepEqual(r.남은사본.사본.map((s) => s.이름), ['sched-synk-daily-threads-1030-2052']);
    assert.ok(fs.existsSync(다른), '남은 사본을 지우지 않는다');
    assert.equal(도구.들기({ 저장소: t.사본, 실행: true }).node_modules, '있음');
  } finally { t.치우기(); }
});

/** 사본 자리(저장소 밖). 시험 뿌리 안이라 함께 지워진다 */
const 사본자리 = (t) => path.join(t.뿌리, 'wt-root', 'SYNK-appsscript');
const 새이름 = 'sched-synk-daily-lab-1110-0711';

test('만들기 — 미리 보기는 아무것도 안 만들고, --실행은 origin 판 사본 · 그 회차 가지 · 옆 링크를 만든다', () => {
  const t = 판();
  try {
    쓰기(t.메인, 'docs/마케팅/편A/공용만의미커밋.md', '공용 쪽 미커밋\n');
    const 자리 = 사본자리(t);
    const 미리 = 도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리 });
    assert.equal(미리.결과, '미리 보기');
    assert.equal(fs.existsSync(자리), false);

    // 원격에만 있는 새 판까지 받아서 뜬다(공용 작업본이 뒤처져 있어도)
    const 다른 = path.join(t.뿌리, 'other');
    깃(t.뿌리)('clone', '-q', t.원격, 다른);
    쓰기(다른, 'docs/마케팅/편A/새판.md', '원격의 새 판\n');
    깃(다른)('add', '-A'); 깃(다른)('commit', '-q', '-m', '새 판'); 깃(다른)('push', '-q', 'origin', 'master');
    const 원격머리 = 깃(다른)('rev-parse', 'HEAD').trim();

    const r = 도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.equal(r.결과, '만듦');
    assert.equal(r.판, 원격머리);
    const 폴더 = path.join(자리, 새이름);
    assert.equal(r.폴더, 폴더);
    assert.equal(깃(폴더)('rev-parse', 'HEAD').trim(), 원격머리);
    assert.equal(깃(폴더)('rev-parse', '--abbrev-ref', 'HEAD').trim(), `worktree-${새이름}`);
    assert.ok(fs.existsSync(path.join(폴더, 'docs/마케팅/편A/새판.md')));
    assert.equal(fs.existsSync(path.join(폴더, 'docs/마케팅/편A/공용만의미커밋.md')), false, '공용 작업본의 미커밋을 물려받지 않는다');
    assert.ok(fs.lstatSync(path.join(자리, 'node_modules')).isSymbolicLink());
    assert.ok(fs.existsSync(path.join(자리, 'node_modules/표지/index.js')), '위로 걸어 찾는 길이 공용 node_modules에 닿는다');
    assert.deepEqual(r.링크.find((l) => l.이름 === 'node_modules'), { 이름: 'node_modules', 상태: '만듦' });
    // 공용 옆에 없는 형제는 만들지 않는다(이 시험에는 SYNK-talk이 없다)
    assert.equal(r.링크.find((l) => l.이름 === 'SYNK-talk').상태, '대상 없음');
    assert.equal(fs.existsSync(path.join(자리, 'SYNK-talk')), false);
    assert.ok(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/공용만의미커밋.md')), '공용 작업본 미커밋은 그대로');

    // 다시 부르면 그 자리를 돌려준다 · 다른 작업본에서 불러도 같다
    const 또 = 도구.만들기({ 저장소: t.사본, 이름: 새이름, 자리, 실행: true });
    assert.equal(또.결과, '이미 있음');
    assert.equal(또.폴더, 폴더);
  } finally { t.치우기(); }
});

test('만들기 — 형제가 공용 옆에 있으면 사본의 ../형제가 닿게 잇는다', () => {
  const t = 판();
  try {
    쓰기(t.뿌리, 'SYNK-talk/lib/표지.js', 'module.exports = 2;\n');
    쓰기(t.뿌리, 'SYNK-worktrees/옛사본/표지.txt', '옛 사본\n');
    const 자리 = 사본자리(t);
    const r = 도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.deepEqual(r.링크.map((l) => l.상태), ['만듦', '만듦', '만듦']);
    const 폴더 = path.join(자리, 새이름);
    assert.ok(fs.existsSync(path.join(폴더, '..', 'SYNK-talk', 'lib', '표지.js')));
    assert.ok(fs.existsSync(path.join(폴더, '..', 'SYNK-worktrees', '옛사본', '표지.txt')));
    // 두 번째 회차는 있는 링크를 그대로 쓴다
    const 둘 = 도구.만들기({ 저장소: t.메인, 이름: 'sched-synk-daily-lab-1110-1511', 자리, 실행: true });
    assert.deepEqual(둘.링크.map((l) => l.상태), ['있음', '있음', '있음']);
  } finally { t.치우기(); }
});

test('만들기 — 이상한 이름 · 한글 자리 · 저장소 안 자리 · 잘못 이어진 링크 · 낯선 폴더 · 있는 가지에서 멈추고 아무것도 안 바꾼다', () => {
  const t = 판();
  try {
    const 자리 = 사본자리(t);
    const 부름 = (옵션) => () => 도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true, ...옵션 });
    for (const 이름 of ['', 'sched-worktree-move', 'other-1110-0711', 'sched-../x-1110-0711', 'sched-한글-1110-0711']) {
      assert.throws(부름({ 이름 }), /이름은 sched-/, 이름);
    }
    assert.throws(부름({ 자리: path.join(t.뿌리, '한글자리') }), /한글/);
    assert.throws(부름({ 자리: path.join(t.메인, '.tmp', 'wt') }), /저장소 안/);
    assert.equal(fs.existsSync(자리), false);

    fs.mkdirSync(자리, { recursive: true });
    const 낯선 = path.join(t.뿌리, 'elsewhere');
    fs.mkdirSync(낯선);
    fs.symlinkSync(낯선, path.join(자리, 'node_modules'), 'junction');
    assert.throws(부름({}), /가리키지 않는다/);
    assert.equal(path.resolve(자리, fs.readlinkSync(path.join(자리, 'node_modules'))), 낯선, '남의 링크를 고치지 않는다');
    fs.unlinkSync(path.join(자리, 'node_modules'));

    fs.mkdirSync(path.join(자리, 새이름));
    assert.throws(부름({}), /등록된 사본이 아니다/);
    fs.rmdirSync(path.join(자리, 새이름));

    깃(t.메인)('branch', `worktree-${새이름}`, 'origin/master');
    assert.throws(부름({}), /이미 있다/);
    assert.equal(fs.readdirSync(자리).includes(새이름), false);
  } finally { t.치우기(); }
});

test('남은사본 — 사본 자리의 예약 사본도 보고, 그 자리의 다른 이름 · 링크는 안 본다', () => {
  const t = 판();
  try {
    const 자리 = 사본자리(t);
    도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    깃(t.메인)('worktree', 'add', '-q', '-b', 'app', path.join(자리, 'quirky-name-1234'), 'origin/master');
    const r = 도구.남은사본({ 저장소: t.메인, 자리 });
    assert.deepEqual(r.사본.map((s) => s.이름).sort(), ['sched-synk-daily-lab-1103-0700', 새이름].sort());
    // 사본 자리 안에서 부르면 자기 자신은 빠진다
    assert.deepEqual(도구.남은사본({ 저장소: path.join(자리, 새이름), 자리 }).사본.map((s) => s.이름), ['sched-synk-daily-lab-1103-0700']);
    // 자리를 다르게 주면 그 사본을 안 본다
    assert.deepEqual(도구.남은사본({ 저장소: t.메인, 자리: path.join(t.뿌리, 'wt-other') }).사본.map((s) => s.이름), ['sched-synk-daily-lab-1103-0700']);
  } finally { t.치우기(); }
});

test('끝 — 사본 자리의 사본은 ExitWorktree remove가 아니라 치우기를 안내한다', (ctx) => {
  const t = 판();
  const 찍음 = [];
  ctx.mock.method(console, 'log', (글) => 찍음.push(String(글)));
  try {
    const 자리 = 사본자리(t);
    도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    const 폴더 = path.join(자리, 새이름);
    assert.equal(도구.끝({ 저장소: 폴더 }).자리사본, true);
    assert.equal(도구.끝({ 저장소: t.사본 }).자리사본, false);
    assert.equal(도구.main(['끝', '--저장소', 폴더, '--실행']), 0);
    assert.match(찍음.join('\n'), new RegExp(`ExitWorktree keep으로 나온 뒤 node tools/예약사본.js 치우기 ${새이름} --실행`));
    찍음.length = 0;
    assert.equal(도구.main(['끝', '--저장소', t.사본, '--실행']), 0);
    assert.match(찍음.join('\n'), /ExitWorktree remove\(discard_changes: true\)/);
  } finally { t.치우기(); }
});

test('치우기 — 끝이 「지워도 됨」일 때만 사본과 그 회차 가지를 지우고, 공용 쪽 · 링크 대상 · 다른 사본은 그대로', () => {
  const t = 판();
  try {
    쓰기(t.뿌리, 'SYNK-talk/lib/표지.js', 'module.exports = 2;\n');
    const 자리 = 사본자리(t);
    도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    const 폴더 = path.join(자리, 새이름);
    fs.symlinkSync(path.join(t.메인, 'node_modules'), path.join(폴더, 'node_modules'), 'junction');
    쓰기(폴더, 'docs/마케팅/편A/게시/b1_master.mp4', '최종본');
    const 미리 = 도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리 });
    assert.equal(미리.결과, '미리 보기');
    assert.ok(fs.existsSync(폴더));
    assert.equal(fs.existsSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4')), false, '미리 보기는 넘기지 않는다');

    const r = 도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.equal(r.결과, '치움', JSON.stringify(r));
    assert.equal(fs.existsSync(폴더), false);
    assert.equal(r.가지지움, true);
    assert.throws(() => 깃(t.메인)('rev-parse', '--verify', '-q', `refs/heads/worktree-${새이름}`));
    assert.equal(fs.readFileSync(path.join(t.메인, 'docs/마케팅/편A/게시/b1_master.mp4'), 'utf8'), '최종본', 'git 밖 결과물은 공용 쪽으로 넘어간다');
    assert.ok(fs.existsSync(path.join(t.메인, 'node_modules/표지/index.js')), '링크 대상은 남는다');
    assert.ok(fs.existsSync(path.join(자리, 'node_modules/표지/index.js')), '사본 자리의 옆 링크는 남는다');
    assert.ok(fs.existsSync(path.join(t.뿌리, 'SYNK-talk/lib/표지.js')));
    assert.ok(fs.existsSync(t.사본), '다른 사본은 그대로');
    assert.equal(도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true }).결과, '없음');
    assert.equal(도구.main(['치우기', 새이름, '--저장소', t.메인, '--자리', 자리, '--실행', '--json']), 1, '없으면 종료 1');
  } finally { t.치우기(); }
});

test('치우기 — 미커밋 · origin에 없는 커밋 · 사본 안에서 부름이면 지우지 않는다', () => {
  const t = 판();
  try {
    const 자리 = 사본자리(t);
    도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    const 폴더 = path.join(자리, 새이름);
    fs.symlinkSync(path.join(t.메인, 'node_modules'), path.join(폴더, 'node_modules'), 'junction');
    assert.throws(() => 도구.치우기({ 저장소: 폴더, 이름: 새이름, 자리, 실행: true }), /사본 안에서는/);
    assert.throws(() => 도구.치우기({ 저장소: path.join(폴더, 'docs'), 이름: 새이름, 자리, 실행: true }), /사본 안에서는/);

    쓰기(폴더, 'docs/마케팅/편A/기획.md', '고친 기획\n');
    let r = 도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.equal(r.결과, '남김');
    assert.ok(r.남은것.some((x) => x === '미커밋 docs/마케팅/편A/기획.md'), JSON.stringify(r.남은것));
    assert.ok(fs.existsSync(폴더));
    assert.ok(fs.lstatSync(path.join(폴더, 'node_modules')).isSymbolicLink(), '남기면 링크도 그대로 — 고쳐 올려야 한다');

    깃(폴더)('commit', '-q', '-am', '기획 고침');
    r = 도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.equal(r.결과, '남김');
    assert.ok(r.남은것.some((x) => x.startsWith('origin에 없는 커밋')), JSON.stringify(r.남은것));
    assert.ok(fs.existsSync(폴더));
    깃(폴더)('rev-parse', '--verify', '-q', `refs/heads/worktree-${새이름}`);

    // 저장소 안 자리의 사본은 이 명령의 대상이 아니다 — 같은 이름이어도 사본 자리만 본다
    assert.equal(도구.치우기({ 저장소: t.메인, 이름: path.basename(t.사본), 자리, 실행: true }).결과, '없음');
    assert.ok(fs.existsSync(t.사본));
  } finally { t.치우기(); }
});

test('치우기 — 폴더가 사라진 등록은 등록을 지우되 가지의 안 올린 커밋이 있으면 남긴다', () => {
  const t = 판();
  try {
    const 자리 = 사본자리(t);
    도구.만들기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    const 폴더 = path.join(자리, 새이름);
    쓰기(폴더, 'docs/마케팅/편A/기획.md', '안 올린 판\n');
    깃(폴더)('commit', '-q', '-am', '안 올린 커밋');
    fs.rmSync(폴더, { recursive: true, force: true });
    let r = 도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.equal(r.결과, '남김');
    assert.ok(r.남은것.some((x) => x.startsWith('origin에 없는 커밋')), JSON.stringify(r.남은것));
    깃(t.메인)('rev-parse', '--verify', '-q', `refs/heads/worktree-${새이름}`);

    // 그 커밋이 origin에 있으면 등록과 가지를 지운다
    깃(t.메인)('push', '-q', 'origin', `worktree-${새이름}:refs/heads/master`);
    깃(t.메인)('fetch', '-q', 'origin');
    r = 도구.치우기({ 저장소: t.메인, 이름: 새이름, 자리, 실행: true });
    assert.equal(r.결과, '치움', JSON.stringify(r));
    assert.equal(깃(t.메인)('worktree', 'list', '--porcelain').includes(새이름), false);
    assert.throws(() => 깃(t.메인)('rev-parse', '--verify', '-q', `refs/heads/worktree-${새이름}`));
  } finally { t.치우기(); }
});

test('인자 — 만들기 · 치우기는 사본 이름을 받고, 없으면 멈춘다', () => {
  assert.deepEqual(도구.인자읽기(['만들기', 새이름, '--실행']), { 명령: '만들기', 실행: true, json: false, 저장소: null, 이름: 새이름 });
  assert.deepEqual(도구.인자읽기(['치우기', 새이름, '--자리', 'x']), { 명령: '치우기', 실행: false, json: false, 저장소: null, 이름: 새이름, 자리: 'x' });
  assert.throws(() => 도구.인자읽기(['만들기']), /사본 이름/);
  assert.throws(() => 도구.인자읽기(['치우기', '--실행']), /사본 이름/);
  assert.throws(() => 도구.인자읽기(['끝', 새이름]), /모르는 인자/);
  assert.throws(() => 도구.인자읽기(['만들기', 새이름, '또']), /모르는 인자/);
});

test('인자 — 모르는 명령 · 인자는 멈춘다', () => {
  assert.throws(() => 도구.인자읽기([]), /명령/);
  assert.throws(() => 도구.인자읽기(['끝', '--모두']), /모르는 인자/);
  assert.deepEqual(도구.인자읽기(['끝', '--실행']), { 명령: '끝', 실행: true, json: false, 저장소: null });
  assert.ok(도구.예약이름.test('sched-synk-daily-publish-1103-1400'));
  assert.ok(!도구.예약이름.test('sched-worktree-move'));
});
