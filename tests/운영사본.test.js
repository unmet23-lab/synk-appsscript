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

test('운영 사본 장부 올림과 수동 따라가기는 예약 갱신과 같은 잠금을 지키고 원고를 보존한다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 경로 = 'docs/_ops/장부.jsonl';
  const 옛머리 = 판.운영.머리();
  판.운영.쓰기(경로, '{"n":2}\n');
  const 옵션 = { 저장소: 판.운영.폴더, 경로들: [경로], 메시지: 'chore(장부): 한 번만', 실행: true };
  const 예약 = 도구.잠그기(기본상태);
  assert.ok(예약);
  try {
    const 올림 = await 바로.올리기(옵션);
    assert.equal(올림.결과, '멈춤', JSON.stringify(올림));
    assert.equal((await 바로.따라가기(옵션)).결과, '멈춤');
    assert.equal(판.원격머리(), 옛머리);
    assert.equal(판.운영.읽기(경로), '{"n":2}\n');
  } finally { 예약.풀기(); }
  let 잠금확인 = false;
  const r = await 바로.올리기({ ...옵션, 시험고리: { push직전() {
    const 파일 = path.join(기본상태, '갱신.lock');
    const 주인 = JSON.parse(fs.readFileSync(파일, 'utf8'));
    fs.writeFileSync(파일, JSON.stringify({ ...주인, 시각: new Date(Date.now() - 30 * 60_000).toISOString() }));
    const 다른 = 도구.잠그기(기본상태);
    if (다른) 다른.풀기();
    assert.equal(다른, null, '장부를 올리는 동안 예약 갱신은 들어올 수 없다');
    잠금확인 = true;
  } } });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.ok(잠금확인);
  assert.equal(판.운영.머리(), 판.원격머리());
  assert.equal(판.운영.읽기(경로), '{"n":2}\n');
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
  // 마지막으로 실제로 다시 잡은 때(lastApplyAt)를 본다 — 그 뒤 「실패」 회차가 끼어도 30분 안이면 되풀이하지 않는다(GPT 10-22 P2)
  const 직전 = { result: '실패', at: '2026-10-22T09:55:00Z', lastApplyAt: '2026-10-22T09:45:00Z', lastApplyDiffers: ['tools/hermes-synk/overview.cjs'] };
  assert.equal(판단(판, { 실행: true, 직전, 지금 }).결과, '실패');
  assert.equal(판단(판, { 실행: true, 직전: { result: '다시 잡음', at: '2026-10-22T09:45:00Z', differs: 판.differs }, 지금 }).결과, '적용', 'lastApplyAt이 없는 옛 기록으로는 막지 않는다');
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

test('갱신: 따라가기가 중간에 끊겨(Windows가 연 파일로 read-tree 128) 작업본에 origin 판 내용만 남은 파일은 고친 것으로 보지 않고 이어 따라간다', async (t) => {
  const 판 = 새판(t, { 'tools/c.js': 'c1\n' });
  await 판.만들기();
  const O = 판.남push({ 'tools/a.js': 'a2\n', 'tools/c.js': 'c2\n' });
  판.운영.g('fetch', '-q', 'origin');
  판.운영.쓰기('tools/a.js', 'a2\n');                    // read-tree가 이 파일만 새 판으로 쓰고 멈춘 모양(HEAD·인덱스는 옛 판)
  assert.deepEqual(판.운영.상태(), [' M tools/a.js']);
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(판.운영.머리(), O);
  assert.deepEqual(판.운영.상태(), []);
  assert.equal(판.운영.읽기('tools/c.js'), 'c2\n');
  // origin 판과 다른 내용이면 여전히 누가 고친 것이다
  판.운영.쓰기('tools/a.js', '운영 사본에서 고침\n');
  const 멈춤 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(멈춤.결과, '멈춤', JSON.stringify(멈춤));
  assert.deepEqual(멈춤.걸림, ['tools/a.js']);
});

test('따라가기: 같은 사본을 따라간 다른 프로세스가 HEAD를 먼저 옮겼으면 앞 판으로 되돌리지 않는다 — HEAD와 인덱스 · 작업본이 갈라지지 않게', async (t) => {
  const 핵심 = require(path.join(REPO, 'tools', 'lib', 'git-publish-core.cjs'));
  const 판 = 새판(t);
  await 판.만들기();
  const B = 판.운영.머리();
  const T = 판.남push({ 'tools/a.js': '새 판\n', 'tools/새.js': '새 파일\n' });
  const r = await 핵심.따라가기({ 저장소: 판.운영.폴더, 실행: true,
    시험고리: { 가지옮기기직전: () => 판.운영.g('update-ref', '--no-deref', 'HEAD', T, B) } });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.match(r.주의, /먼저 옮겼다/);
  assert.equal(판.운영.머리(), T);
  assert.deepEqual(판.운영.상태(), [], '늦은 쪽이 파일을 앞 판으로 되돌리지 않는다');
  assert.equal(판.운영.읽기('tools/a.js'), '새 판\n');
  // 더 새 판으로 먼저 갔으면 앞 판이 아니라 그 판에 맞춘다
  const 앞 = 판.운영.머리();
  판.남push({ 'tools/a.js': '다음 판\n' });
  let 더새 = null;
  const r2 = await 핵심.따라가기({ 저장소: 판.운영.폴더, 실행: true,
    시험고리: { 가지옮기기직전: () => {
      더새 = 판.남push({ 'tools/b.js': '더 새 판\n' });
      판.운영.g('fetch', '-q', 'origin');
      판.운영.g('update-ref', '--no-deref', 'HEAD', 더새, 앞);
    } } });
  assert.equal(r2.결과, '실패', JSON.stringify(r2));
  assert.equal(판.운영.머리(), 더새);
  assert.deepEqual(판.운영.상태(), [], '인덱스 · 작업본이 지금 HEAD와 같다');
  assert.equal(판.운영.읽기('tools/b.js'), '더 새 판\n');
});

test('갱신: 동시 따라가기의 늦은 쪽이 파일만 앞 판으로 되돌린 자국(HEAD만 새 판)은 스스로 풀어 따라가고, 누가 고친 내용이 있으면 멈춘다', async (t) => {
  const 판 = 새판(t, { 'tools/c.js': 'c1\n', 'tools/지울.js': '곧 지움\n' });
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' });
  const 장부 = 'docs/_ops/장부.jsonl';
  const B = 판.운영.머리();
  const T = 판.남push({ 'tools/a.js': 'a2\n', 'tools/c.js': 'c2\n', 'tools/새.js': '새\n', [장부]: '{"n":1}\n{"n":2}\n' });
  const O = 판.남push({ 'tools/b.js': '그 뒤 판\n' });
  판.운영.g('fetch', '-q', 'origin');
  // 11-04 실측 모양: HEAD는 T, 인덱스 · 작업본은 B, 운영 사본에서 올린 장부만 T 판
  판.운영.g('read-tree', '-m', '-u', B, T);
  판.운영.g('update-ref', '--no-deref', 'HEAD', T, B);
  판.운영.g('read-tree', '-m', '-u', T, B);
  판.운영.쓰기(장부, '{"n":1}\n{"n":2}\n');
  판.운영.g('add', 장부);
  오래전(path.join(판.운영.폴더, 장부));
  assert.deepEqual(판.운영.상태(), ['D  tools/새.js', 'M  tools/a.js', 'M  tools/c.js']);
  // 누가 고친 내용(작업본 · 인덱스)이 있으면 지금처럼 멈추고 HEAD도 건드리지 않는다
  판.운영.쓰기('tools/c.js', '운영 사본에서 고침\n');
  const 고침 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(고침.결과, '멈춤', JSON.stringify(고침));
  assert.equal(판.운영.머리(), T);
  판.운영.g('add', 'tools/c.js');
  const 올려둠 = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(올려둠.결과, '멈춤', JSON.stringify(올려둠));
  assert.equal(판.운영.머리(), T);
  판.운영.쓰기('tools/c.js', 'c1\n');
  판.운영.g('add', 'tools/c.js');
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.마무리, B);
  assert.equal(판.운영.머리(), O);
  assert.deepEqual(판.운영.상태(), []);
  assert.equal(판.운영.읽기('tools/a.js'), 'a2\n');
  assert.equal(판.운영.읽기('tools/새.js'), '새\n');
  assert.equal(판.운영.읽기(장부), '{"n":1}\n{"n":2}\n', '이미 올라간 장부를 지킨다');
  const s = 판.상태();
  assert.equal(s.state, 'ok');
  assert.equal(s.finishedInterruptedFollow, B);
});

test('갱신: 인덱스가 기록자리에서만 HEAD와 다르면 되돌린 자국이 아니다 — HEAD를 앞 판으로 돌리지 않는다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' });
  const 장부 = 'docs/_ops/장부.jsonl';
  const T = 판.남push({ [장부]: '{"n":1}\n{"n":2}\n' });
  assert.equal((await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 })).결과, '따라감');
  판.운영.쓰기(장부, '{"n":1}\n{"n":2}\n{"n":3}\n');
  판.운영.g('add', 장부);
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '같음', JSON.stringify(r));
  assert.equal(r.마무리, null);
  assert.equal(판.운영.머리(), T);
});

test('잠그기: 풀기는 제가 잡은 잠금만 지우고, 살아 있는 주인의 잠금은 한도 안이면 빼앗지 않는다', (t) => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ops-lock-'));
  t.after(() => fs.rmSync(방, { recursive: true, force: true }));
  const 파일 = path.join(방, '시험.lock');
  const 가 = 도구.잠그기(방, '시험.lock', 60_000);
  assert.ok(가);
  assert.equal(도구.잠그기(방, '시험.lock', 60_000), null, '살아 있는 주인(이 프로세스)의 잠금');
  fs.writeFileSync(파일, JSON.stringify({ pid: process.pid, 시각: new Date().toISOString(), 표: '남의-잠금' }));
  가.풀기();
  assert.equal(fs.existsSync(파일), true, '그사이 남이 잡은 잠금은 지우지 않는다');
  fs.writeFileSync(파일, JSON.stringify({ pid: process.pid, 시각: new Date(Date.now() - 120_000).toISOString(), 표: '오래된' }));
  const 나 = 도구.잠그기(방, '시험.lock', 60_000);
  assert.ok(나, '한도를 넘긴 잠금은 주인이 살아 있어도 치운다');
  나.풀기();
  assert.equal(fs.existsSync(파일), false);
});

test('만들기: extensions.worktreeConfig가 꺼진 저장소에서는 공용 설정을 건드리지 않고 멈춘다', async (t) => {
  const 판 = 새판(t);
  판.공용.g('config', 'extensions.worktreeConfig', 'false');
  await assert.rejects(도구.만들기({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true }), /worktreeConfig/);
  assert.equal(판.공용.g('config', '--get', 'core.autocrlf').trim(), 'false', '공용 설정 그대로');
  assert.equal(fs.existsSync(path.join(판.상태폴더, 'SYNK-appsscript')), false);
});

test('갱신: fetch가 실패한 회차(예외)도 못 올린 기록과 처음 본 시각을 이어 간다 — 6시간 알림 시계가 다시 0이 되지 않게', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' });
  const 장부 = path.join(판.운영.폴더, 'docs/_ops/장부.jsonl');
  fs.appendFileSync(장부, '{"n":2}\n');
  오래전(장부);
  await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  const 처음 = 판.상태();
  assert.deepEqual(처음.unpushed, ['docs/_ops/장부.jsonl']);
  assert.equal(처음.head, 판.운영.머리(), '기록 자리를 본 회차에는 head가 있다');
  판.공용.g('remote', 'set-url', 'origin', path.join(판.뿌리, '없는-원격.git'));
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.equal(r.결과, '실패', JSON.stringify(r));
  const 뒤 = 판.상태();
  assert.equal(뒤.state, 'failed');
  assert.deepEqual(뒤.unpushed, ['docs/_ops/장부.jsonl']);
  assert.equal(뒤.unpushedSince, 처음.unpushedSince);
  assert.equal(뒤.head, null, '못 본 회차에는 head가 없다');
  assert.deepEqual(뒤.unpushedFirst, 처음.unpushedFirst, '못 본 회차는 경로마다 처음 본 때도 이어 간다');
  // 앞 상태까지 못 읽으면 빈 목록이 남는다. head가 없어 감시(tools/hermes-synk/overview.cjs)가 「남은 기록 없음」으로 읽지 않는다
  fs.writeFileSync(path.join(판.상태폴더, '상태.json'), '{ 깨진');
  assert.equal((await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 })).결과, '실패');
  assert.deepEqual([판.상태().unpushed, 판.상태().head], [[], null]);
});

test('갱신: 처음 본 때는 경로마다 잇는다 — 앞 기록이 올라가고 다른 기록이 남으면 그 시각을 물려받지 않는다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 갱신 = () => 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  const 앞경로 = 'docs/_ops/장부.jsonl', 새경로 = 'docs/마케팅/편1/게시/작업실.json', 옛때 = '2026-11-22T20:39:22.085Z';
  fs.appendFileSync(path.join(판.운영.폴더, 앞경로), '{"n":2}\n');
  오래전(path.join(판.운영.폴더, 앞경로));
  // 같은 기록이 그대로 남으면 처음 본 때를 잇는다 — 경로마다 적기 전의 상태(처음 본 때 하나)도 이어받는다
  fs.writeFileSync(path.join(판.상태폴더, '상태.json'), JSON.stringify({ ...판.상태(), unpushed: [앞경로], unpushedSince: 옛때 }));
  await 갱신();
  assert.deepEqual([판.상태().unpushedSince, 판.상태().unpushedFirst], [옛때, { [앞경로]: 옛때 }]);
  // 그 기록이 올라가고 같은 회차에 다른 기록이 남는다
  판.운영.쓰기(새경로, '{"등록":"r1"}\n');
  오래전(path.join(판.운영.폴더, 새경로));
  도구.남은장부적기([앞경로], { 결과: '멈춤', 이유: '오프라인' }, 판.상태폴더);
  assert.equal((await 갱신()).장부.결과, '올림');
  const 뒤 = 판.상태();
  assert.deepEqual([뒤.unpushed, 뒤.unpushedFirst, 뒤.unpushedSince], [[새경로], { [새경로]: 뒤.checkedAt }, 뒤.checkedAt]);
  // 경로마다 적기 전의 상태(옛 판)에서 첫 회차가 origin을 못 봐도 앞 시각을 잃지 않는다
  const { unpushedFirst: _, ...옛상태 } = 뒤;
  fs.writeFileSync(path.join(판.상태폴더, '상태.json'), JSON.stringify({ ...옛상태, unpushedSince: 옛때 }));
  판.공용.g('remote', 'set-url', 'origin', path.join(판.뿌리, '없는.git'));
  assert.equal((await 갱신()).결과, '실패');
  판.공용.g('remote', 'set-url', 'origin', 판.원격);
  await 갱신();
  assert.deepEqual([판.상태().unpushedSince, 판.상태().unpushedFirst], [옛때, { [새경로]: 옛때 }]);
  // 표시 목록에만 있고 경로마다 적은 때에는 없는 경로(300개 밖)는 앞 시각을 물려받지 않는다
  fs.writeFileSync(path.join(판.상태폴더, '상태.json'), JSON.stringify({ ...뒤, unpushed: [새경로], unpushedSince: 옛때, unpushedFirst: {} }));
  await 갱신();
  assert.deepEqual([판.상태().unpushedSince, 판.상태().unpushedFirst], [판.상태().checkedAt, { [새경로]: 판.상태().checkedAt }]);
  fs.writeFileSync(path.join(판.상태폴더, '상태.json'), JSON.stringify(뒤));
  // 새 기록이 많아 표시 목록(50개) 밖으로 밀려도 처음 본 때를 잃지 않는다
  for (let i = 0; i < 60; i++) 판.운영.쓰기(`docs/_ops/가${String(i).padStart(2, '0')}.json`, '{}\n');
  for (const f of fs.readdirSync(path.join(판.운영.폴더, 'docs/_ops'))) 오래전(path.join(판.운영.폴더, 'docs/_ops', f));
  await 갱신();
  const 많음 = 판.상태();
  assert.deepEqual([많음.unpushed.length, 많음.unpushed.includes(새경로), 많음.unpushedSince, 많음.unpushedFirst[새경로]], [50, false, 뒤.checkedAt, 뒤.checkedAt]);
});

test('갱신: 못 올린 기록은 운영시험으로 시험해 올리고, 올리는 동안 덧붙은 줄이 있으면 목록에 남긴다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 헤르메스 = () => ({ 결과: '맞음' }), 경로 = 'docs/_ops/장부.jsonl', 파일 = path.join(판.운영.폴더, 경로);
  const core = require(path.join(REPO, 'tools', 'lib', 'git-publish-core.cjs')), 원래 = core.올리기;
  fs.appendFileSync(파일, '{"n":2}\n');
  도구.남은장부적기([경로], { 결과: '멈춤', 이유: '오프라인' }, 판.상태폴더);
  let 받은;
  t.mock.method(core, '올리기', async (옵션) => {
    받은 = 옵션;
    const r = await 원래(옵션);
    // 올리는 동안 다른 도구가 같은 장부에 덧붙이고, 잠금에 막혀 목록에 적고 끝났다
    fs.appendFileSync(파일, '{"n":3}\n');
    도구.남은장부적기([경로], { 결과: '멈춤', 이유: '진행 중' }, 판.상태폴더);
    return r;
  });
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 });
  assert.deepEqual([r.장부.결과, 받은.관련시험돌리기], ['올림', 도구.운영시험], JSON.stringify(r));
  assert.equal(판.원격파일(경로), '{"n":1}\n{"n":2}\n');
  assert.deepEqual(Object.keys(도구.남은장부읽기(판.상태폴더)), [경로], '덧붙은 줄은 다음 갱신이 올린다');
  t.mock.restoreAll();
  assert.equal((await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 })).장부.결과, '올림');
  assert.deepEqual([판.원격파일(경로), 도구.남은장부읽기(판.상태폴더)], ['{"n":1}\n{"n":2}\n{"n":3}\n', {}]);
  // git에는 바뀐 것으로 보여도 올릴 것이 없으면(줄끝만 다름) 목록에서 빼고 회차마다 되풀이하지 않는다
  fs.writeFileSync(파일, fs.readFileSync(파일, 'utf8').replace(/\n$/, ''));
  도구.남은장부적기([경로], { 결과: '멈춤', 이유: '오프라인' }, 판.상태폴더);
  assert.equal((await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스 })).장부.결과, '올릴 것 없음');
  assert.deepEqual(도구.남은장부읽기(판.상태폴더), {});
});

const 옛항목 = { 시각: '2026-11-25T00:00:00.000Z', 이유: '진행 중' };
for (const [이름, 적은판, 다시적은, 차례] of [
  ['지우려는 사이 다른 도구가', null, (옛) => ({ ...옛, 표: '다른 도구' }), 2],
  // 옛 판은 표를 적지 않는다 — 갱신이 먼저 달아 둔 표가 없어진다. 표를 다는 잠금 안에서 목록을 한 번 더 읽는다
  ['지우려는 사이 옛 판 도구가', 옛항목, () => 옛항목, 3],
  // 표를 git 상태보다 먼저 달지 않으면 여기서 새 항목에 표를 달고 지운다
  ['표를 달려는 사이 옛 판 도구가', 옛항목, () => 옛항목, 2],
]) test(`갱신: 깨끗해진 항목을 ${이름} 다시 적은 항목은 잃지 않고 올린다`, async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 경로 = 'docs/_ops/장부.jsonl', 목록파일 = path.join(판.상태폴더, '남은장부.json');
  const 갱신 = () => 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  도구.남은장부적기([경로], { 결과: '멈춤', 이유: '오프라인' }, 판.상태폴더);   // 이미 깨끗한 기록
  if (적은판) fs.writeFileSync(목록파일, JSON.stringify({ paths: { [경로]: 적은판 } }));
  const 원래 = fs.readFileSync;
  let 읽기 = 0, 다시;
  t.mock.method(fs, 'readFileSync', function (...인자) {
    // 갱신이 목록을 그 차례로 읽기 바로 앞에 줄을 덧붙이고 다시 적은 경우
    if (인자[0] === 목록파일 && ++읽기 === 차례) {
      fs.appendFileSync(path.join(판.운영.폴더, 경로), '{"n":2}\n');
      다시 = 다시적은(JSON.parse(원래(목록파일, 'utf8')).paths[경로]);
      fs.writeFileSync(목록파일, JSON.stringify({ paths: { [경로]: 다시 } }));
    }
    return 원래.apply(fs, 인자);
  });
  const r = await 갱신();
  t.mock.restoreAll();
  assert.ok(읽기 >= 차례, '목록을 다시 읽었다');
  // git 상태를 본 뒤에 적혔으면 항목이 그대로 남아 다음 갱신이 올리고, 그 앞이면 이 회차가 올린다
  if (r.장부?.결과 !== '올림') {
    assert.deepEqual(도구.남은장부읽기(판.상태폴더)[경로], 다시, JSON.stringify(r));
    assert.equal((await 갱신()).장부?.결과, '올림');
  }
  assert.deepEqual([판.원격파일(경로), 도구.남은장부읽기(판.상태폴더)], ['{"n":1}\n{"n":2}\n', {}]);
});

test('갱신: 목록을 git 상태보다 먼저 읽는다 — 그 앞에 적힌 기록은 그 회차의 상태에 보여 올린다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 경로 = 'docs/_ops/장부.jsonl', 목록파일 = path.join(판.상태폴더, '남은장부.json');
  const 원래 = fs.readFileSync;
  let 읽기 = 0;
  t.mock.method(fs, 'readFileSync', function (...인자) {
    // 갱신이 목록을 처음 읽기 바로 앞에 다른 도구가 줄을 덧붙이고 적은 경우
    if (인자[0] === 목록파일 && ++읽기 === 1) {
      fs.appendFileSync(path.join(판.운영.폴더, 경로), '{"n":2}\n');
      fs.writeFileSync(목록파일, JSON.stringify({ paths: { [경로]: { 시각: new Date().toISOString(), 이유: '진행 중', 표: '다른 도구' } } }));
    }
    return 원래.apply(fs, 인자);
  });
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  t.mock.restoreAll();
  assert.deepEqual([r.장부?.결과, 판.원격파일(경로), 도구.남은장부읽기(판.상태폴더)], ['올림', '{"n":1}\n{"n":2}\n', {}], JSON.stringify(r));
});

test('남은장부적기: 적은 뒤 다른 도구가 다시 적은 항목은 올렸어도 남기고, 그대로인 항목만 지운다', (t) => {
  const 상태폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-left-'));
  t.after(() => fs.rmSync(상태폴더, { recursive: true, force: true }));
  const [가, 나] = ['docs/_ops/장부.jsonl', 'docs/마케팅/편1/게시/작업실.json'], 올림 = { 결과: '올림' }, 멈춤 = { 결과: '멈춤', 이유: '진행 중' };
  const 남은 = () => 도구.남은장부읽기(상태폴더), 적기 = (경로들, 결과, 앞) => 도구.남은장부적기(경로들, 결과, 상태폴더, 앞);
  const 앞 = 적기([가, 나], { 결과: '올리는 중', 이유: '올리는 중' });
  assert.deepEqual(앞, 남은(), '적은 뒤의 목록을 돌려준다');
  assert.ok(앞[가].표 && 앞[가].표 !== 앞[나].표, '적을 때마다 새 표');
  적기([나], { 결과: '올리는 중', 이유: '올리는 중' });   // 글이 같아도 다시 적은 것이다(적고 나서 끊긴 다른 도구)
  적기([가, 나], 올림, 앞);
  assert.deepEqual([Object.keys(남은()), 남은()[나].시각], [[나], 앞[나].시각], '처음 본 때는 이어 간다');
  // 올리기 전에 적지 못했으면(빈 목록) 다른 도구의 항목을 지우지 않는다
  적기([나], 올림, {});
  assert.deepEqual(Object.keys(남은()), [나]);
  적기([나], { 결과: '올릴 것 없음' }, 남은());
  assert.deepEqual(남은(), {}, '올릴 것이 없어도 지운다');
  // 옛 판이 적은 항목은 표가 없어 남긴다(다음 갱신이 표를 달고 본다). 앞 목록에 없던 것도 남긴다. 앞을 안 주면 그대로 지운다
  fs.writeFileSync(path.join(상태폴더, '남은장부.json'), JSON.stringify({ paths: { [가]: { 시각: 'x', 이유: 'y' }, [나]: { 시각: 'x', 이유: 'y' } } }));
  적기([가, 나], 올림, { [가]: { 시각: 'x', 이유: 'y' } });
  assert.deepEqual(Object.keys(남은()), [가, 나]);
  적기([가, 나], 멈춤);
  적기([가, 나], 올림);
  assert.deepEqual(남은(), {});
});

test('운영시험: 시험 자리를 짧게 기다리고, 없으면 멈추며, 있으면 그 자리로 돌리고 놓는다', (t) => {
  const 앞 = process.env.SYNK_관련시험_자리;
  t.after(() => { if (앞 === undefined) delete process.env.SYNK_관련시험_자리; else process.env.SYNK_관련시험_자리 = 앞; });
  delete process.env.SYNK_관련시험_자리;
  const 본 = [];
  const 시험 = (자리, 결과) => ({
    자리잡기: (폴더, 옵션) => { 본.push(['자리', path.relative(도구.찾기(REPO).공용git, 폴더).replace(/\\/g, '/'), 옵션]); return 자리; },
    돌리기: (입력) => { 본.push(['돌리기', 입력]); if (결과 instanceof Error) throw 결과; return 결과; },
  });
  const 잡은 = { 번호: 1, 수: 2, 기다린초: 3, 놓기: () => 본.push(['놓기']) };
  assert.throws(() => 도구.운영시험({ root: REPO, 시험: ['a'] }, { 시험: 시험({ ...잡은, 번호: null }) }), (e) => /시험 자리가 차 있다/.test(e.이유 || e.message));
  assert.deepEqual(본, [['자리', 'synk-관련시험/자리', { 수: undefined, 기다림ms: 120000 }]], '자리가 없으면 시험을 돌리지 않는다');
  본.length = 0;
  assert.deepEqual(도구.운영시험({ root: REPO, 시험: ['a'] }, { 시험: 시험(잡은, { 통과함: true }) }), { 통과함: true, 자리: { 번호: 1, 수: 2, 기다린초: 3 } });
  assert.deepEqual(본.slice(1), [['돌리기', { root: REPO, 시험: ['a'], 자리: false }], ['놓기']], '시험의 한도는 그대로다');
  본.length = 0;
  assert.throws(() => 도구.운영시험({ root: REPO, 시험: ['a'] }, { 시험: 시험(잡은, new Error('시험 오류')) }), /시험 오류/);
  assert.deepEqual(본.at(-1), ['놓기'], '시험이 던져도 자리를 놓는다');
  for (const [값, 수] of [['3', 3], ['-1', 1], ['1.7', 1], ['0', undefined], ['셋', undefined]]) {
    process.env.SYNK_관련시험_자리 = 값;
    본.length = 0;
    도구.운영시험({ root: REPO, 시험: ['a'] }, { 시험: 시험(잡은, {}) });
    assert.equal(본[0][2].수, 수, 값);
  }
  process.env.SYNK_관련시험_자리 = '끔';
  본.length = 0;
  도구.운영시험({ root: REPO, 시험: ['a'] }, { 시험: 시험(잡은, {}) });
  assert.deepEqual(본.map((x) => x[0]), ['돌리기'], '자리를 끄면 잡지 않는다');
});

test('바로올리기: 운영 사본에서 올릴 때만 관련 시험을 운영시험으로 돌린다 — 자리가 없으면 멈추고 잠금을 놓는다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const core = require(path.join(REPO, 'tools', 'lib', 'git-publish-core.cjs'));
  let 받은;
  t.mock.method(core, '올리기', async (옵션) => { 받은 = 옵션; return { 결과: '올릴 것 없음' }; });
  await 바로.올리기({ 저장소: 판.운영.폴더, 경로들: ['docs/_ops/장부.jsonl'], 메시지: 'x', 실행: true });
  assert.equal(받은.관련시험돌리기, 도구.운영시험);
  const 제것 = () => ({});
  await 바로.올리기({ 저장소: 판.운영.폴더, 경로들: ['docs/_ops/장부.jsonl'], 메시지: 'x', 실행: true, 관련시험돌리기: 제것 });
  assert.equal(받은.관련시험돌리기, 제것);
  await 바로.올리기({ 저장소: 판.공용.폴더, 경로들: ['tools/a.js'], 메시지: 'x', 실행: true });
  assert.equal(받은.관련시험돌리기, undefined, '다른 작업본은 그대로');
  t.mock.restoreAll();
  // 시험이 있는 판에서 자리가 없으면 아무것도 올리지 않고 멈춘다
  const { 멈춤 } = require(path.join(REPO, 'tools', 'lib', 'git-commit-core.cjs'));
  const 관련 = require(path.join(REPO, 'tools', '관련시험.js'));
  t.mock.method(관련, '고르기', () => ({ 시험: ['tests/a.test.js'], 까닭: {} }));
  판.운영.쓰기('docs/_ops/장부.jsonl', '{"n":2}\n');
  const 앞머리 = 판.원격머리();
  const r = await 바로.올리기({ 저장소: 판.운영.폴더, 경로들: ['docs/_ops/장부.jsonl'], 메시지: 'x', 실행: true, 관련시험돌리기: () => { throw new 멈춤('관련 시험 자리가 차 있다'); } });
  assert.deepEqual([r.결과, 판.원격머리()], ['멈춤', 앞머리], JSON.stringify(r));
  assert.match(r.이유, /자리가 차 있다/);
  const 잠금 = 도구.잠그기(기본상태);
  assert.ok(잠금, '잠금을 놓았다');
  잠금.풀기();
});

test('장부올리기가 올리다 끊기면 먼저 적힌 기록을 다음 갱신이 올린다', async (t) => {
  const 판 = 새판(t);
  await 판.만들기();
  const 경로 = 'docs/마케팅/편1/게시/작업실.json';
  판.운영.쓰기(경로, '{"등록":"r1"}\n');
  // 올리는 중에 프로세스가 끝났다(PC 재시작 · 부른 쪽의 시간 제한) — 결과를 적지 못한다
  t.mock.method(바로, '올리기', () => new Promise(() => {}));
  require(path.join(REPO, 'tools', 'lib', '장부올리기.js')).장부올리기([경로], 'chore(장부): 시험', { 저장소: 판.운영.폴더, 환경: {} });
  assert.match(도구.남은장부읽기(기본상태)[경로].이유, /올리는 중/);
  t.mock.restoreAll();
  const r = await 도구.갱신({ 저장소: 판.공용.폴더, 상태폴더: 기본상태, 실행: true, 헤르메스: () => ({ 결과: '맞음' }) });
  assert.equal(r.장부?.결과, '올림', JSON.stringify(r));
  assert.equal(판.원격파일(경로), '{"등록":"r1"}\n');
  assert.deepEqual(도구.남은장부읽기(기본상태), {});
});

test('만들기: 되돌리기가 가리킴만 지우고 남긴 운영 사본은 다시 가리킨다', async (t) => {
  const 판 = 새판(t);
  const r = await 판.만들기();
  fs.rmSync(path.join(판.공용.폴더, '.git', 도구.가리킴파일));
  assert.equal(도구.찾기(판.공용.폴더).운영사본, null);
  const 다시 = await 도구.만들기({ 저장소: 판.공용.폴더, 상태폴더: 판.상태폴더, 실행: true });
  assert.equal(다시.결과, '다시 가리킴', JSON.stringify(다시));
  assert.ok(도구.같은곳(도구.찾기(판.공용.폴더).운영사본, r.경로));
});
