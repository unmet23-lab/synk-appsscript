/* 운영 사본 — 예약 작업·헤르메스 감시가 실행하는, origin/master만 따라가는 분리된 HEAD 워크트리.
 * 임시 bare 원격(origin) · 공용 작업본(메인) · 운영 사본 · 세션 워크트리 · 남의 클론으로 잰다.
 * 실제 저장소·원격·전역 git 설정·%LOCALAPPDATA%는 건드리지 않는다(상태 폴더는 SYNK_운영사본_상태로 임시 폴더). */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-ops-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});
const 기본상태 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ops-state-'));
process.env.SYNK_운영사본_상태 = 기본상태;
process.on('exit', () => { try { fs.rmSync(기본상태, { recursive: true, force: true }); } catch {} });

const 도구 = require(path.join(REPO, 'tools', '운영사본.js'));
const 바로 = require(path.join(REPO, 'tools', '바로올리기.js'));
const 정책 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'git-storage-policy.json'), 'utf8'));

function 깃(폴더) {
  return (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, 경로);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}
/** 쓰기가 끝난 지 오래된 파일로 — 갱신은 10분 안에 바뀐 기록을 쓰는 중으로 본다 */
function 오래전(파일) {
  const 때 = new Date(Date.now() - 11 * 60_000);
  fs.utimesSync(파일, 때, 때);
}
function 작업본(폴더) {
  const g = 깃(폴더);
  return {
    폴더, g,
    쓰기: (p, v) => 쓰기(폴더, p, v),
    읽기: (p) => fs.readFileSync(path.join(폴더, p), 'utf8'),
    있나: (p) => fs.existsSync(path.join(폴더, p)),
    머리: () => g('rev-parse', 'HEAD').trim(),
    상태: () => g('status', '--porcelain=v1', '--untracked-files=no').split('\n').filter(Boolean).sort(),
  };
}

/** origin(bare) · 공용 작업본(master) · 상태 폴더 · 운영 사본 만들기 · 남의 push */
function 새판(t, 파일 = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ops-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 원격 = path.join(뿌리, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
  const 공용 = 작업본(path.join(뿌리, '공용'));
  fs.mkdirSync(공용.폴더);
  공용.g('init', '-q', '-b', 'master');
  공용.g('config', 'core.autocrlf', 'false');
  공용.g('config', 'extensions.worktreeConfig', 'true');
  공용.쓰기('tools/git-storage-policy.json', `${JSON.stringify(정책, null, 2)}\n`);
  const 바탕 = { '.gitignore': 'node_modules/\n', 'tools/a.js': '1\n', 'docs/캐릭터/큰그림.txt': '큰 파일\n', 'docs/_ops/장부.jsonl': '{"n":1}\n', ...파일 };
  for (const [p, v] of Object.entries(바탕)) 공용.쓰기(p, v);
  공용.g('add', '-A');
  공용.g('commit', '-q', '-m', '바탕');
  공용.g('remote', 'add', 'origin', 원격);
  공용.g('push', '-q', 'origin', 'master');
  공용.g('fetch', '-q', 'origin');
  fs.mkdirSync(path.join(공용.폴더, 'node_modules', 'pkg'), { recursive: true });
  const 상태폴더 = path.join(뿌리, '상태');
  const 판 = { 뿌리, 원격, 공용, 상태폴더 };
  판.만들기 = async () => {
    const r = await 도구.만들기({ 저장소: 공용.폴더, 상태폴더, 실행: true });
    assert.equal(r.결과, '만듦', JSON.stringify(r));
    판.운영 = 작업본(r.경로);
    return r;
  };
  판.워크트리 = (이름) => {
    const 폴더 = path.join(뿌리, 이름);
    공용.g('worktree', 'add', '-q', '-b', `claude/${이름}`, 폴더, 'master');
    return 작업본(폴더);
  };
  판.남push = (파일들, 메시지 = '남의 push') => {
    const 다른 = path.join(뿌리, `다른-${crypto.randomBytes(3).toString('hex')}`);
    execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
    const g = 깃(다른);
    for (const [p, v] of Object.entries(파일들)) 쓰기(다른, p, v);
    g('add', '-A');
    g('commit', '-q', '-m', 메시지);
    g('push', '-q', 'origin', 'master');
    return g('rev-parse', 'HEAD').trim();
  };
  판.원격머리 = () => execFileSync('git', ['--git-dir', 원격, 'rev-parse', 'master'], { encoding: 'utf8', stdio: 'pipe' }).trim();
  판.원격파일 = (p) => execFileSync('git', ['--git-dir', 원격, 'show', `master:${p}`], { encoding: 'utf8', stdio: 'pipe' });
  판.상태 = () => JSON.parse(fs.readFileSync(path.join(상태폴더, '상태.json'), 'utf8'));
  return 판;
}

test('만들기: 분리된 HEAD 워크트리로 만들고 큰 미디어 폴더는 꺼내지 않으며 가리킴 파일·node_modules 연결·상태를 남긴다', async (t) => {
  const 판 = 새판(t);
  const 미리 = await 도구.만들기({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더 });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.equal(fs.existsSync(미리.경로), false, '미리 보기는 아무것도 만들지 않는다');
  const r = await 판.만들기();
  assert.equal(r.경로, path.join(판.상태폴더, 'SYNK-appsscript'));
  const 운 = 판.운영;
  assert.equal(운.머리(), 판.원격머리());
  assert.equal(운.g('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'HEAD', '분리된 HEAD');
  assert.equal(운.읽기('tools/a.js'), '1\n');
  assert.equal(운.있나('docs/캐릭터/큰그림.txt'), false, '뺀 폴더는 꺼내지 않는다');
  assert.deepEqual(운.상태(), []);
  assert.equal(fs.existsSync(path.join(운.폴더, 'node_modules', 'pkg')), true, 'node_modules는 공용 작업본으로 잇는다');
  assert.equal(fs.readFileSync(path.join(판.공용.폴더, '.git', 도구.가리킴파일), 'utf8').trim(), r.경로);
  assert.equal(판.상태().state, 'ok');
  // 찾기 · 운영사본인가 — 어느 작업본에서든 같은 운영 사본을 가리킨다
  const 워 = 판.워크트리('wt');
  for (const 곳 of [판.공용.폴더, 워.폴더, 운.폴더]) {
    const f = 도구.찾기(곳);
    assert.ok(도구.같은곳(f.운영사본, r.경로), 곳);
    assert.ok(도구.같은곳(f.공용작업본, 판.공용.폴더), 곳);
  }
  assert.equal(도구.운영사본인가(운.폴더), true);
  assert.equal(도구.운영사본인가(판.공용.폴더), false);
  assert.equal(도구.운영사본인가(워.폴더), false);
  const 또 = await 도구.만들기({ 저장소: 워.폴더, 상태폴더: 판.상태폴더, 실행: true });
  assert.equal(또.결과, '이미 있음', JSON.stringify(또));
});

test('갱신: origin이 움직이면 따라가고 헤르메스 계약을 맞춘 뒤 상태를 남긴다 — 이미 같으면 같음', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 불림 = [];
  const 헤르메스 = (곳, 실행) => { 불림.push({ 곳, 실행 }); return { 결과: '다시 잡음' }; };
  const O = 판.남push({ 'tools/a.js': '2\n', 'tools/b.js': '새 파일\n' });
  const 미리 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 헤르메스 });
  assert.equal(미리.결과, '미리 보기', JSON.stringify(미리));
  assert.equal(미리.뒤짐, 1);
  assert.notEqual(판.운영.머리(), O, '미리 보기는 옮기지 않는다');
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(판.운영.머리(), O);
  assert.equal(판.운영.읽기('tools/a.js'), '2\n');
  assert.equal(판.운영.읽기('tools/b.js'), '새 파일\n');
  assert.deepEqual(불림.at(-1), { 곳: 판.운영.폴더, 실행: true });
  const s = 판.상태();
  assert.equal(s.state, 'ok');
  assert.equal(s.head, O);
  assert.equal(s.behind, 0);
  assert.equal(s.hermes.result, '다시 잡음');
  const 같음 = await 도구.갱신({ 저장소: 판.운영.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(같음.결과, '같음', JSON.stringify(같음));
});

test('갱신: 운영 사본에서 코드를 고쳤으면 따라가지 않고 멈춘 시각을 이어 남긴다 — 되돌리면 다시 따라간다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' });
  판.운영.쓰기('tools/a.js', '운영 사본에서 고침\n');
  const 전 = 판.운영.머리();
  const O = 판.남push({ 'tools/c.js': '3\n' });
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.deepEqual(r.걸림, ['tools/a.js']);
  assert.equal(판.운영.머리(), 전);
  const 처음 = 판.상태();
  assert.equal(처음.state, 'stopped');
  assert.deepEqual(처음.paths, ['tools/a.js']);
  assert.equal(처음.behind, 1);
  await new Promise((r2) => setTimeout(r2, 20));
  await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  const 둘째 = 판.상태();
  assert.equal(둘째.stoppedSince, 처음.stoppedSince, '같은 까닭이면 처음 본 시각을 이어 간다');
  assert.notEqual(둘째.checkedAt, 처음.checkedAt);
  판.운영.g('checkout', '--', 'tools/a.js');
  const 다시 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(다시.결과, '따라감', JSON.stringify(다시));
  assert.equal(판.운영.머리(), O);
  assert.equal(판.상태().stoppedSince, null);
});

test('갱신: 기록 자리의 수정은 쓰는 중일 수 있어 올리지 않고 지킨 채 따라가며, 도구가 못 올린 기록만 다시 올린다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' });
  const 장부 = path.join(판.운영.폴더, 'docs/_ops/장부.jsonl');
  fs.appendFileSync(장부, '{"n":2}\n');
  const O = 판.남push({ 'tools/d.js': '4\n' });
  // 막 쓴 기록은 쓰는 중일 수 있다 — 이번 회차는 따라가지 않는다(따라가기가 그 파일을 잠깐 되돌리는 사이 덧붙인 줄을 잃지 않게)
  const 미룸 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(미룸.결과, '멈춤', JSON.stringify(미룸));
  assert.equal(판.상태().reasonKey, '기록 쓰는 중');
  assert.notEqual(판.운영.머리(), O);
  오래전(장부);
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.장부, undefined, '쓰는 중일 수 있는 기록은 올리지 않는다');
  assert.equal(판.운영.머리(), O);
  assert.equal(판.운영.읽기('docs/_ops/장부.jsonl'), '{"n":1}\n{"n":2}\n', '따라가며 지킨다');
  assert.equal(판.원격파일('docs/_ops/장부.jsonl'), '{"n":1}\n');
  const 첫 = 판.상태();
  assert.deepEqual(첫.unpushed, ['docs/_ops/장부.jsonl']);
  assert.ok(첫.unpushedSince);
  assert.equal(첫.state, 'ok');
  // 도구가 올리려다 못 올렸다고 적어 두면(장부올리기 → 남은장부적기) 다음 갱신이 다시 올린다 — 막 쓴 것이어도
  도구.남은장부적기(['docs/_ops/장부.jsonl'], { 결과: '멈춤', 이유: '오프라인' }, 판.상태폴더);
  fs.utimesSync(장부, new Date(), new Date());
  const O2 = 판.남push({ 'tools/e.js': '5\n' });
  const r2 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(r2.장부.결과, '올림', JSON.stringify(r2.장부));
  assert.equal(판.원격파일('docs/_ops/장부.jsonl'), '{"n":1}\n{"n":2}\n');
  assert.equal(판.원격파일('tools/e.js'), '5\n', 'push는 최신 origin 위에');
  assert.notEqual(판.원격머리(), O2);
  assert.equal(판.운영.머리(), 판.원격머리());
  assert.deepEqual(판.운영.상태(), []);
  const 끝 = 판.상태();
  assert.deepEqual(끝.unpushed, []);
  assert.equal(끝.unpushedSince, null);
});

test('갱신: 운영 사본에서 커밋했으면(origin의 조상이 아님) 멈춘다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  판.운영.쓰기('tools/a.js', '몰래 커밋\n');
  판.운영.g('commit', '-q', '-am', '운영 사본에서 커밋');
  판.남push({ 'tools/e.js': '5\n' });
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /조상이 아니다/);
  assert.equal(판.상태().reasonKey, '갈라짐');
});

test('갱신: 살아 있는 다른 갱신이 잠금을 쥐고 있으면 바쁨, 주인 없는 잠금은 치운다 · 운영 사본이 없으면 없음', async (t) => {
  const 판 = 새판(t);
  const 없음 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true });
  assert.equal(없음.결과, '없음', JSON.stringify(없음));
  await 판.만들기();
  const 잠금 = path.join(판.상태폴더, '갱신.lock');
  fs.writeFileSync(잠금, JSON.stringify({ pid: process.pid, 시각: new Date().toISOString() }));
  const 바쁨 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(바쁨.결과, '바쁨', JSON.stringify(바쁨));
  fs.writeFileSync(잠금, JSON.stringify({ pid: 2 ** 31 - 2, 시각: new Date().toISOString() }));
  const 됨 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(됨.결과, '같음', JSON.stringify(됨));
  assert.equal(fs.existsSync(잠금), false, '끝나면 잠금을 푼다');
});

test('갱신: 헤르메스 계약을 다시 잡지 못하면 실패로 남긴다(따라가기는 된 채로)', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const O = 판.남push({ 'tools/f.js': '6\n' });
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '실패', 이유: '설치 잠금' }) });
  assert.equal(r.결과, '실패', JSON.stringify(r));
  assert.equal(판.운영.머리(), O);
  const s = 판.상태();
  assert.equal(s.state, 'failed');
  assert.equal(s.reasonKey, '헤르메스');
  assert.equal(s.head, O);
});

test('바로올리기: 다른 작업본에서 올리면 운영 사본도 그 커밋으로 따라간다 · 운영 사본에서 올린 장부는 헤르메스만 맞춘다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 워 = 판.워크트리('wt');
  워.쓰기('tools/a.js', '워크트리에서 고침\n');
  const r = await 바로.올리기({ 저장소: 워.폴더, 경로들: ['tools/a.js'], 메시지: 'a 고침', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.운영따라가기.결과, '따라감', JSON.stringify(r.운영따라가기));
  assert.equal(판.운영.머리(), r.머리);
  assert.equal(판.운영.읽기('tools/a.js'), '워크트리에서 고침\n');
  assert.equal(JSON.parse(fs.readFileSync(path.join(기본상태, '상태.json'), 'utf8')).caller, '바로올리기');
  fs.appendFileSync(path.join(판.운영.폴더, 'docs/_ops/장부.jsonl'), '{"n":3}\n');
  const 장 = await 바로.올리기({ 저장소: 판.운영.폴더, 경로들: ['docs/_ops/장부.jsonl'], 메시지: 'chore(장부): 시험', 실행: true });
  assert.equal(장.결과, '올림', JSON.stringify(장));
  assert.equal(장.운영따라가기.결과, '운영 사본', JSON.stringify(장.운영따라가기));
  assert.equal(판.운영.머리(), 판.원격머리());
  const 안 = await 바로.올리기({ 저장소: 워.폴더, 경로들: ['tools/a.js'], 메시지: '없음', 실행: true, 운영안따라감: true });
  assert.equal(안.운영따라가기, undefined);
});

test('갱신: 처음 쓰는 기록(미추적 새 파일)도 못 올렸으면 다시 올리고, 깨끗해진 못 올린 목록은 지운다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' });
  판.운영.쓰기('docs/마케팅/편1/게시/작업실.json', '{"등록":"r1"}\n');
  도구.남은장부적기(['docs/마케팅/편1/게시/작업실.json', 'docs/_ops/사라진.jsonl'], { 결과: '실패', 이유: '오프라인' }, 판.상태폴더);
  const 미리 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 헤르메스 });
  assert.equal(미리.결과, '같음', JSON.stringify(미리));
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.장부.결과, '올림', JSON.stringify(r.장부));
  assert.equal(판.원격파일('docs/마케팅/편1/게시/작업실.json'), '{"등록":"r1"}\n');
  assert.equal(판.운영.머리(), 판.원격머리());
  assert.deepEqual(도구.남은장부읽기(판.상태폴더), {}, '올린 것과 깨끗해진 것 모두 목록에서 빠진다');
  assert.deepEqual(판.상태().unpushed, []);
});

test('갱신: 저장소가 core.autocrlf=true여도 운영 사본은 바이트 그대로 꺼내 CRLF가 든 커밋을 유령 수정 없이 따라간다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  assert.equal(판.운영.g('config', '--worktree', '--get', 'core.autocrlf').trim(), 'false');
  판.공용.g('config', 'core.autocrlf', 'true');
  const O = 판.남push({ 'tools/윈도우.cmd': '@echo off\r\necho 한글\r\n' });
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(판.운영.머리(), O);
  assert.deepEqual(판.운영.상태(), [], 'CRLF blob이 고친 파일로 보이지 않는다');
  const 다음 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(다음.결과, '같음', JSON.stringify(다음));
});

test('갱신: 따라가기가 HEAD를 옮기기 전에 끊겼으면(인덱스·작업본만 새 판) HEAD만 마무리하고 이어 간다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const B = 판.운영.머리();
  const T = 판.남push({ 'tools/a.js': '끊긴 판\n' });
  const O = 판.남push({ 'tools/b.js': '그 뒤 판\n' });
  판.운영.g('fetch', '-q', 'origin');
  판.운영.g('read-tree', '-m', '-u', B, T);              // 시간 한도로 죽은 따라가기가 남긴 모양
  assert.deepEqual(판.운영.상태(), ['M  tools/a.js']);
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.마무리, T);
  assert.equal(판.운영.머리(), O);
  assert.deepEqual(판.운영.상태(), []);
  assert.equal(판.상태().finishedInterruptedFollow, T);
});

test('헤르메스판단: 판 올림·감시 검사기·플러그인 변경은 사람 몫, 방금 다시 잡았는데 같은 어긋남이면 되풀이하지 않는다', () => {
  const 판단 = 도구.헤르메스판단;
  assert.equal(판단({ inSync: true, nativeChanged: false, differs: [] }).결과, '맞음');
  assert.equal(판단({}).결과, '실패', '모양이 다른 답으로 다시 잡지 않는다');
  assert.equal(판단({ inSync: false, nativeChanged: true, differs: [] }, { 실행: true }).결과, '판바뀜');
  for (const 이름 of ['tools/hermes-synk/automation.py', 'tools/hermes-synk/plugin/__init__.py', '설치된 감시 스크립트']) {
    assert.equal(판단({ inSync: false, nativeChanged: false, differs: ['tools/hermes-synk/overview.cjs', 이름] }, { 실행: true }).결과, '사람 확인', 이름);
  }
  const 판 = { inSync: false, nativeChanged: false, differs: ['tools/hermes-synk/overview.cjs'] };
  assert.equal(판단(판).결과, '다시 잡을 것');
  assert.equal(판단(판, { 실행: true }).결과, '적용');
  const 지금 = Date.parse('2026-10-22T10:00:00Z');
  const 직전 = { result: '다시 잡음', at: '2026-10-22T09:45:00Z', differs: ['tools/hermes-synk/overview.cjs'] };
  assert.equal(판단(판, { 실행: true, 직전, 지금 }).결과, '실패');
  assert.equal(판단(판, { 실행: true, 직전, 지금: 지금 + 20 * 60_000 }).결과, '적용', '30분 지나면 다시 잡는다');
  assert.equal(판단({ ...판, differs: ['tools/모델정책.js'] }, { 실행: true, 직전, 지금 }).결과, '적용', '다른 어긋남이면 다시 잡는다');
  const 이동 = { inSync: false, nativeChanged: false, differs: [], moved: true };
  assert.equal(판단(이동, { 실행: true }).결과, '적용', '자리만 옮긴 것은 다시 잡는다');
});

test('공용작업본: 운영 사본·세션 워크트리에서 돌아도 데이터 뿌리는 공용 작업본이고, 저장소 밖이면 받은 폴더 그대로', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 워 = 판.워크트리('wt');
  const { 공용작업본 } = require(path.join(REPO, 'tools', 'lib', '공용작업본.js'));
  for (const 곳 of [판.공용.폴더, 판.운영.폴더, 워.폴더]) assert.ok(도구.같은곳(공용작업본(곳), 판.공용.폴더), 곳);
  assert.equal(공용작업본(판.상태폴더), path.resolve(판.상태폴더));
});
