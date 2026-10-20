/* 공개 — synk.im(공개 저장소 main)에 내 파일만 얹어 올리는 도구.
 * 임시 bare 원격(file://, 부분 클론 허용)·로컬 HTTP 서버(공개 주소 흉내)·가짜 gh로 잰다.
 * 실제 synk-policy·synk.im·GitHub·전역 git 설정은 건드리지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구 = require(path.join(REPO, 'tools', '공개.js'));
const 속 = 도구._시험;
const 엇 = require(path.join(REPO, 'tools', 'lib', 'import엇갈림.js'));

// 시험 git은 이 PC·CI의 시스템·전역 설정을 읽지 않는다. curl은 프록시를 타지 않는다.
for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-publish-test-no-global-config'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost',
});

const 블롭id = (b) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sha12 = (b) => sha(b).slice(0, 12);
const 글 = (s) => Buffer.from(s, 'utf8');

function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, ...경로.split('/'));
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}

/** 공개 저장소 .github/site-check/check.mjs의 도구 이름 단계와 같은 꼴(낱말 목록만 바꾼다) */
const 점검원문 = (낱말) => [
  '// 2. 도구 이름',
  '  const skipDir = /(^|\\/)(vendor|node_modules)\\//;',
  '  const skipPage = /^(en\\/)?(privacy|terms|data-deletion|brief)\\//;',
  '  const skipFile = /(^|\\/)knowledge-engine\\.js$/;',
  "  const listOf = b64 => new RegExp(Buffer.from(b64, 'base64').toString('utf8'), 'i');",
  `  const words = listOf('${Buffer.from(낱말).toString('base64')}');`,
  `  const tagWords = listOf('${Buffer.from('suno|\\budio\\b').toString('base64')}');`,
  '    if (/\\.(html|js|mjs|css|json|txt|xml|md|svg|webmanifest)$/i.test(f)) {',
  '',
].join('\n');

/** 임시 공개 저장소: bare origin(main) + 남이 올리는 작업본. 도구 사본(bare 부분 클론)은 도구가 따로 받는다. */
function 새공개본(t, 파일 = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-publish-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const origin = path.join(뿌리, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  for (const [k, v] of [['uploadpack.allowFilter', 'true'], ['uploadpack.allowAnySHA1InWant', 'true']]) execFileSync('git', ['--git-dir', origin, 'config', k, v]);
  const 작업 = path.join(뿌리, '남');
  execFileSync('git', ['init', '-q', '-b', 'main', 작업]);
  const g = (...a) => execFileSync('git', ['-C', 작업, '-c', 'core.autocrlf=false', '-c', 'core.quotepath=false', ...a], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  g('remote', 'add', 'origin', origin);
  /** 남의 공개(다른 세션이 synk-policy에 직접 올림) */
  const 올림 = (바꿀 = {}, 지울 = [], 메시지 = '남의 공개') => {
    // 도구가 그사이 올린 커밋 위에서 고친다
    try { g('fetch', '-q', 'origin'); g('reset', '-q', '--hard', 'origin/main'); } catch (_) { /* 첫 커밋 */ }
    for (const [p, v] of Object.entries(바꿀)) 쓰기(작업, p, v);
    for (const p of 지울) fs.rmSync(path.join(작업, ...p.split('/')));
    g('add', '-A');
    g('commit', '-q', '-m', 메시지);
    g('push', '-q', 'origin', 'main');
    return g('rev-parse', 'HEAD').trim();
  };
  const 바탕 = 올림({ '.github/site-check/check.mjs': 점검원문('suno|금지낱말'), ...파일 }, [], '바탕');
  const 사본 = path.join(뿌리, '사본.git');
  const 원격주소 = `file:///${origin.replace(/\\/g, '/')}`;
  const og = (...a) => execFileSync('git', ['--git-dir', origin, '-c', 'core.quotepath=false', ...a], { stdio: ['pipe', 'pipe', 'pipe'] });
  return {
    뿌리, origin, 작업, 바탕, 올림, 사본, 원격주소,
    머리: () => og('rev-parse', 'main').toString().trim(),
    파일: (p, rev = 'main') => og('show', `${rev}:${p}`),
    있나: (p, rev = 'main') => { try { og('cat-file', '-e', `${rev}:${p}`); return true; } catch (_) { return false; } },
    og,
    /** 로컬 폴더(빌드 출력 흉내) */
    로컬: (이름, 파일들) => { const d = path.join(뿌리, 이름); fs.mkdirSync(d, { recursive: true }); for (const [p, v] of Object.entries(파일들)) 쓰기(d, p, v); return d; },
    후보폴더: () => path.join(뿌리, `후보-${crypto.randomBytes(3).toString('hex')}`),
    옵션: (덧 = {}) => ({ 사본, 원격주소, 주소: 'http://127.0.0.1:9', 점검안함: true, ...덧 }),
  };
}

/** 공개 주소 흉내: 경로 → 바이트. 쿼리는 무시한다. */
async function 공개서버(t) {
  const 파일 = new Map();
  const 요청 = [];
  const 서버 = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
    요청.push(`${req.method} ${p}`);
    const b = 파일.get(p);
    if (!b) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('없음'); return; }
    res.writeHead(200, { 'content-length': b.length, 'x-cache': 'HIT' });
    res.end(req.method === 'HEAD' ? undefined : b);
  });
  await new Promise((r) => 서버.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => 서버.close(r)));
  return { 주소: `http://127.0.0.1:${서버.address().port}`, 파일, 요청 };
}

/** 가짜 gh: run list는 목록(부른 차례) 함수가, run view는 실패 단계 하나, rerun은 기록만(다시실패면 던진다) */
function 가짜gh(목록, { 다시실패 = false } = {}) {
  const 부름 = [];
  const gh = (args) => {
    부름.push(args.join(' '));
    if (args[0] === 'run' && args[1] === 'list') return JSON.stringify(목록(부름.filter((a) => a.startsWith('run list')).length));
    if (args[0] === 'run' && args[1] === 'view') return JSON.stringify({ jobs: [{ steps: [{ name: '점검', conclusion: 'failure' }, { name: '준비', conclusion: 'success' }] }] });
    if (args[0] === 'run' && args[1] === 'rerun') { if (다시실패) throw Object.assign(new Error('rerun 거절'), { 이유: 'gh run rerun 실패 — 권한 없음' }); return ''; }
    throw new Error(`모르는 gh ${args.join(' ')}`);
  };
  gh.부름 = 부름;
  return gh;
}

const 실행 = (id, sha, status, conclusion, attempt = 1, at = '2026-10-19T00:00:00Z') => ({ databaseId: id, headSha: sha, status, conclusion, createdAt: at, url: `u/${id}`, attempt });

const 후보읽기 = (폴더, p) => fs.readFileSync(path.join(폴더, ...p.split('/')));
const 종류들 = (r) => Object.fromEntries(r.항목.map((x) => [x.경로, x.종류]));

// ── 미리 보기 ──────────────────────────────────────────────────────────────

test('미리 보기: 공개본 + 내 파일만 · 같은 파일과 줄끝만 다른 파일은 뺀다 · 원격은 그대로 · 사본은 bare', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': 'A\n', 'b.txt': 'B\n', 'c.txt': 'C1\nC2\n' });
  const 로컬 = 공.로컬('빌드', { 'a.txt': 'A2\n', 'b.txt': 'B\n', 'c.txt': 'C1\r\nC2\r\n', 'new/d.txt': 'D\n' });
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt', 'b.txt', 'c.txt', 'new/d.txt'] }));
  assert.equal(r.결과, '미리 보기');
  assert.deepEqual(종류들(r), { 'a.txt': '바꿈', 'new/d.txt': '새' });
  assert.match(r.건너뜀.find((x) => x.경로 === 'b.txt').이유, /이미 공개본과 같다/);
  assert.match(r.건너뜀.find((x) => x.경로 === 'c.txt').이유, /줄끝만 다르다/);
  assert.match(r.계획, /^[0-9a-f]{12}$/);
  assert.equal(공.머리(), 공.바탕, '미리 보기는 push하지 않는다');
  assert.equal(execFileSync('git', ['--git-dir', 공.사본, 'rev-parse', '--is-bare-repository'], { encoding: 'utf8' }).trim(), 'true');
  const 다시 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt', 'b.txt', 'c.txt', 'new/d.txt'] }));
  assert.equal(다시.계획, r.계획, '같은 입력·같은 공개본이면 계획 해시가 같다');
  const 줄끝도 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['c.txt'], 줄끝도: true }));
  assert.deepEqual(종류들(줄끝도), { 'c.txt': '바꿈' });
});

test('3방향(--기준): 기준 뒤 남이 같은 파일을 고쳤으면 둘 다 살리고, 겹치면 멈춘다', async (t) => {
  const 줄들 = Array.from({ length: 10 }, (_, i) => `줄 ${i + 1}`);
  const 판 = (고침) => `${줄들.map((l, i) => 고침[i] ?? l).join('\n')}\n`;
  const 공 = 새공개본(t, { 'page.html': 판({}), 'logo.webp': Buffer.from([1, 0, 2, 3]) });
  const 기준 = 공.바탕;
  공.올림({ 'page.html': 판({ 1: '줄 2 — 남이 공개본에서 고침' }), 'logo.webp': Buffer.from([1, 0, 9, 9]) });
  const 내판 = 공.로컬('내판', { 'page.html': 판({ 8: '줄 9 — 내가 고침' }), 'logo.webp': Buffer.from([1, 0, 7, 7]) });

  const 후보 = 공.후보폴더();
  const r = await 도구.올리기(공.옵션({ 원본: 내판, 항목: ['page.html'], 기준, 후보폴더: 후보 }));
  assert.equal(r.결과, '미리 보기');
  assert.match(r.항목[0].방법, /3방향/);
  const 합친 = 후보읽기(후보, 'page.html').toString('utf8');
  assert.match(합친, /줄 2 — 남이 공개본에서 고침/);
  assert.match(합친, /줄 9 — 내가 고침/);

  // 기준 없이 덮으면 남의 변경이 되돌아간다 — 하루 안에 남이 고친 파일이라고 알린다
  const 덮기 = await 도구.올리기(공.옵션({ 원본: 내판, 항목: ['page.html'] }));
  assert.ok(덮기.알림.some((x) => x.검사 === '덮어쓰기' && x.경로 === 'page.html'));

  // 같은 줄을 둘 다 고치면 멈춘다 · 그림을 둘 다 바꿔도 멈춘다
  const 겹침 = 공.로컬('겹침', { 'page.html': 판({ 1: '줄 2 — 나도 고침' }) });
  const g = await 도구.올리기(공.옵션({ 원본: 겹침, 항목: ['page.html'], 기준 }));
  assert.equal(g.결과, '걸림');
  assert.match(g.걸림[0].이유, /1곳 겹친다/);
  const 그림 = await 도구.올리기(공.옵션({ 원본: 내판, 항목: ['logo.webp'], 기준 }));
  assert.equal(그림.결과, '걸림');
  assert.match(그림.걸림[0].이유, /그림·바이너리/);
  assert.equal(공.머리() !== 기준, true);
});

test('3방향(--기준폴더): 원고 빌드끼리 견줘 내가 바꾼 파일만 올리고 남의 직접 수정은 둔다 · 원고에서 지운 파일은 지운다', async (t) => {
  const 공 = 새공개본(t, {
    'world/a.js': 'A\n', 'world/b.js': 'B-공개본에서 직접 고침\n', 'world/c.js': 'C\n', 'world/old.js': 'OLD\n',
    'world/index.html': `<script src="a.js?v=${sha12(글('A\n'))}"></script>\n<p>hi</p>\n<footer>f</footer>\n<!-- 공개본에만 -->\n`,
    'world/live-only.txt': '남이 공개본에만 올린 파일\n',
  });
  const 기준빌드 = 공.로컬('기준빌드', {
    'a.js': 'A\n', 'b.js': 'B\n', 'c.js': 'C\n', 'old.js': 'OLD\n',
    'index.html': '<script src="a.js?v=aaaaaaaaaaaa"></script>\n<p>hi</p>\n<footer>f</footer>\n',
  });
  const 내빌드 = 공.로컬('내빌드', {
    'a.js': 'A2\n', 'b.js': 'B\n', 'c.js': 'C\n',
    'index.html': '<script src="a.js?v=bbbbbbbbbbbb"></script>\n<p>hi there</p>\n<footer>f</footer>\n',
  });
  const 후보 = 공.후보폴더();
  const r = await 도구.올리기(공.옵션({ 원본: 내빌드, 공개폴더: 'world', 항목: ['.'], 기준폴더: 기준빌드, 후보폴더: 후보 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.deepEqual(종류들(r), { 'world/a.js': '바꿈', 'world/index.html': '바꿈', 'world/old.js': '지움' });
  assert.match(r.건너뜀.find((x) => x.경로 === 'world/b.js').이유, /기준과 같다/);
  assert.equal(후보읽기(후보, 'world/index.html').toString('utf8'),
    `<script src="a.js?v=${sha12(글('A2\n'))}"></script>\n<p>hi there</p>\n<footer>f</footer>\n<!-- 공개본에만 -->\n`,
    '빌드 토큰은 공개본 값으로 맞춘 뒤 합치고, 바뀐 a.js 토큰만 새 값');
  assert.ok(!r.항목.some((x) => x.경로 === 'world/live-only.txt'), '공개본에만 있는 남의 파일은 지우지 않는다');
});

test('3방향 지움: 지우려는 파일을 기준 뒤 남이 고쳤으면 멈추고, 그대로면 지운다', async (t) => {
  const 공 = 새공개본(t, { 'site/old.txt': 'v1\n', 'site/keep.txt': 'k\n', 'site/gone.txt': 'g\n' });
  const 기준 = 공.바탕;
  공.올림({ 'site/old.txt': 'v2 — 남이 공개본에서 고침\n' });
  const 직접 = await 도구.올리기(공.옵션({ 지움: ['site/old.txt', 'site/gone.txt'], 기준 }));
  assert.equal(직접.결과, '걸림');
  assert.deepEqual(직접.걸림.map((x) => `${x.경로}:${x.검사}`), ['site/old.txt:3방향']);
  assert.match(직접.걸림[0].이유, /남이 바꿨다/);
  // 기준폴더: 기준 빌드에만 있는 파일(원고에서 지운 파일)도 같은 규칙
  const 기준빌드 = 공.로컬('기준빌드', { 'old.txt': 'v1\n', 'keep.txt': 'k\n', 'gone.txt': 'g\n' });
  const 내빌드 = 공.로컬('내빌드', { 'keep.txt': 'k\n' });
  const 폴더 = await 도구.올리기(공.옵션({ 원본: 내빌드, 공개폴더: 'site', 항목: ['.'], 기준폴더: 기준빌드 }));
  assert.equal(폴더.결과, '걸림');
  assert.deepEqual(폴더.걸림.map((x) => x.경로), ['site/old.txt']);
  assert.deepEqual(종류들(폴더), { 'site/gone.txt': '지움' }, '남이 안 고친 파일은 지운다');
  assert.equal(공.있나('site/old.txt'), true);
});

test('기준 없이 폴더를 주면 목록만 보이고 멈춘다(--전부면 미리 보기)', async (t) => {
  const 공 = 새공개본(t, { 'site/a.css': 'a{}\n', 'site/b.css': 'b{}\n', 'site/live.css': 'live{}\n' });
  const 빌드 = 공.로컬('빌드', { 'a.css': 'a{color:red}\n', 'b.css': 'b{}\n' });
  const r = await 도구.올리기(공.옵션({ 원본: 빌드, 공개폴더: 'site', 항목: ['.'] }));
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /목록만/);
  assert.deepEqual(종류들(r), { 'site/a.css': '바꿈' });
  assert.ok(r.알림.some((x) => /공개본에만 있는 파일 1개/.test(x.이유)));
  const 전부 = await 도구.올리기(공.옵션({ 원본: 빌드, 공개폴더: 'site', 항목: ['.'], 전부: true }));
  assert.equal(전부.결과, '미리 보기');
});

// ── ?v= ────────────────────────────────────────────────────────────────────

test('?v= 갱신: 바뀐 파일을 부르는 토큰만, 사슬 끝까지 · 다른 사이트·.github·안 바뀐 파일·64자·이름 토큰·꼬리 맞춤', async (t) => {
  const K1 = '{"q":1}\n', L1 = 'export const x = 1;\n', S = 'body{}\n', CS1 = '.care{}\n', W1 = Buffer.from([7, 7, 7]);
  const app1 = `import { x } from './lib.js?v=${sha12(글(L1))}';\nfetch('/knowledge.json?v=${sha12(글(K1))}');\n`;
  const 공개 = {
    'knowledge.json': K1, 'lib.js': L1, 'style.css': S, 'app.js': app1,
    'index.html': `<script type="module" src="./app.js?v=${sha12(글(app1))}"></script>\n<a href="https://www.youtube.com/watch?v=abcdefabcdef">영상</a>\n<link rel="stylesheet" href="/style.css?v=feedfacecafe">\n`,
    'world/index.html': '<script src="../app.js?v=atlas-20261017"></script>\n',
    'care/style.css': CS1,
    'care/index.html': `<link rel="stylesheet" href="./style.css?v=${sha(글(CS1))}">\n`,
    'world/assets/tutor-photos/onb/mongle-기본.webp': W1,
    'world/data/photos.mjs': `export default {"onb":{"기본":"onb/mongle-기본.webp?v=${sha12(W1)}"}};\n`,
    'world/data/app.mjs': "import 사진 from './photos.mjs';\n",
    '.github/desktop-preview/index.html': `<script src="/app.js?v=${sha12(글(app1))}"></script>\n`,
    // 어느 파일도 부르지 않는 옛 파일(루트 app.js 꼴) — 토큰을 고치지 않고 알린다. 주석 속 이름은 부르는 것이 아니다(site-bar.js 꼴).
    'legacy.js': "fetch('/knowledge.json?v=dec311b1711a');\n",
    'note.js': '// On the old page legacy.js and app.js did this.\nexport const 쉼 = 1;\n',
    // 쓰는 파일인데 토큰이 CRLF 작업본으로 계산됐거나(en/sites.js 꼴) 옛 판의 해시다 — 그래도 따라 바꾼다
    'en/sites.js': `fetch('/knowledge.json?v=${sha12(Buffer.from(K1.replace(/\n/g, '\r\n')))}');\n`,
    'en/index.html': '<script type="module" src="./sites.js"></script>\n',
  };
  const 공 = 새공개본(t, 공개);
  const K2 = '{"q":2}\n', CS2 = '.care{color:red}\n', W2 = Buffer.from([8, 8, 8, 8]);
  const 로컬 = 공.로컬('빌드', { 'knowledge.json': K2, 'care/style.css': CS2, 'world/assets/tutor-photos/onb/mongle-기본.webp': W2 });
  const 후보 = 공.후보폴더();
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['knowledge.json', 'care/style.css', 'world/assets/tutor-photos/onb/mongle-기본.webp'], 후보폴더: 후보 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.deepEqual(종류들(r), {
    'app.js': '토큰', 'care/index.html': '토큰', 'care/style.css': '바꿈', 'en/sites.js': '토큰', 'index.html': '토큰', 'knowledge.json': '바꿈',
    'world/assets/tutor-photos/onb/mongle-기본.webp': '바꿈', 'world/data/photos.mjs': '토큰', 'world/index.html': '토큰',
  });
  const app2 = 후보읽기(후보, 'app.js').toString('utf8');
  assert.equal(app2, `import { x } from './lib.js?v=${sha12(글(L1))}';\nfetch('/knowledge.json?v=${sha12(글(K2))}');\n`);
  const index = 후보읽기(후보, 'index.html').toString('utf8');
  assert.match(index, new RegExp(`\\./app\\.js\\?v=${sha12(글(app2))}"`), '사슬: knowledge.json → app.js → index.html');
  assert.match(index, /watch\?v=abcdefabcdef/, '다른 사이트 주소는 그대로');
  assert.match(index, /style\.css\?v=feedfacecafe/, '안 바뀐 파일의 토큰은 공개본 값 그대로');
  assert.equal(후보읽기(후보, 'world/index.html').toString('utf8'), `<script src="../app.js?v=${sha12(글(app2))}"></script>\n`, '이름 토큰은 sha256 12자로');
  assert.equal(후보읽기(후보, 'care/index.html').toString('utf8'), `<link rel="stylesheet" href="./style.css?v=${sha(글(CS2))}">\n`, '64자 토큰은 64자로');
  assert.match(후보읽기(후보, 'world/data/photos.mjs').toString('utf8'), new RegExp(`mongle-기본\\.webp\\?v=${sha12(W2)}`), '기준 폴더가 다른 데이터 모듈은 꼬리 맞춤');
  assert.ok(!r.항목.some((x) => x.경로.startsWith('.github/')), '.github 아래는 고치지 않는다');
  assert.ok(!r.항목.some((x) => x.경로 === 'legacy.js'), '어느 파일도 부르지 않는 옛 파일은 고치지 않는다');
  assert.ok(r.알림.some((x) => x.경로 === 'legacy.js' && /어느 파일도 부르지 않는/.test(x.이유)));
  assert.match(후보읽기(후보, 'en/sites.js').toString('utf8'), new RegExp(`knowledge\\.json\\?v=${sha12(글(K2)).slice(0, 12)}`),
    '쓰는 파일의 토큰은 공개본 값이 옛 내용 해시와 달라도(CRLF·옛 판) 따라 바꾼다');

  const 정한 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['knowledge.json'], 토큰: 'rel-20261019', 후보폴더: 공.후보폴더() }));
  const 앱 = 정한.항목.find((x) => x.경로 === 'app.js');
  assert.deepEqual(앱.토큰.map((x) => x.후), ['rel-20261019']);
  const 끔 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['knowledge.json'], 토큰안함: true }));
  assert.deepEqual(종류들(끔), { 'knowledge.json': '바꿈' });
});

test('?v= 토큰 맞춤: 빌드 HTML의 토큰은 공개본 값으로 되돌리고 바뀐 파일만 새 값 · 지우는 파일을 부르면 알린다', async (t) => {
  const 공 = 새공개본(t, {
    'page.html': `<link href="a.css?v=${sha12(글('a{}\n'))}"><link href="b.css?v=222222222222">\n<p>x</p>\n`,
    'a.css': 'a{}\n', 'b.css': 'b{}\n', 'gone.js': '1\n', 'uses-gone.html': '<script src="gone.js?v=333333333333"></script>\n',
  });
  const 빌드 = 공.로컬('빌드', {
    'page.html': '<link href="a.css?v=aaaaaaaaaaaa"><link href="b.css?v=bbbbbbbbbbbb">\n<p>y</p>\n',
    'a.css': 'a{color:red}\n',
  });
  const 후보 = 공.후보폴더();
  const r = await 도구.올리기(공.옵션({ 원본: 빌드, 항목: ['page.html', 'a.css'], 지움: ['gone.js'], 후보폴더: 후보 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.equal(후보읽기(후보, 'page.html').toString('utf8'), `<link href="a.css?v=${sha12(글('a{color:red}\n'))}"><link href="b.css?v=222222222222">\n<p>y</p>\n`);
  assert.match(r.항목.find((x) => x.경로 === 'page.html').방법, /공개본 값으로/);
  assert.ok(r.알림.some((x) => x.경로 === 'uses-gone.html' && /지우는 파일/.test(x.이유)));
  assert.equal(r.항목.find((x) => x.경로 === 'gone.js').종류, '지움');

  // 토큰만 다른 빌드 HTML은 공개본 그대로
  const 공2 = 새공개본(t, { 'page.html': '<link href="a.css?v=111111111111">\n<p>x</p>\n', 'a.css': 'a{}\n' });
  const 빌드2 = 공2.로컬('빌드', { 'page.html': '<link href="a.css?v=aaaaaaaaaaaa">\n<p>x</p>\n' });
  const 같음 = await 도구.올리기(공2.옵션({ 원본: 빌드2, 항목: ['page.html'] }));
  assert.equal(같음.결과, '올릴 것 없음');
  assert.match(같음.건너뜀[0].이유, /토큰만/);
  const 그대로 = await 도구.올리기(공2.옵션({ 원본: 빌드2, 항목: ['page.html'], 토큰안함: true }));
  assert.deepEqual(종류들(그대로), { 'page.html': '바꿈' });
});

// ── 검사 ────────────────────────────────────────────────────────────────────

test('도구 이름: 후보의 check.mjs 규칙·MP3 태그·그림 제작 표시·더한 줄의 AI 이름을 막는다(--허용은 AI 이름만)', async (t) => {
  const 공 = 새공개본(t, { 'app.js': '// 기존 주석: gemini 이야기\nconst a = 1;\n', 'pulse/index.html': '<p>모델</p>\n' });
  const 로컬 = 공.로컬('빌드', {
    'lab/index.html': '<p>금지낱말로 만든 노래</p>\n',
    'privacy/index.html': '<p>처리 위탁: 금지낱말 주식회사</p>\n',
    'song.mp3': Buffer.concat([Buffer.from('ID3\u0003\u0000'), Buffer.from('TSSE Made with Suno', 'latin1'), Buffer.alloc(64)]),
    'pic.png': Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]), Buffer.from('caBX c2pa.manifest', 'latin1')]),
    'app.js': '// 기존 주석: gemini 이야기\nconst a = 1;\n// see https://claude.ai/x\n',
    'pulse/index.html': '<p>모델</p>\n<p>AI로 만든 모델입니다</p>\n',
    'lab2/index.html': '<p>AI로 만든 그림</p>\n',
    'builds/manual/view.js': 'const 안내 = "계속 쓸 때는 ChatGPT와 Claude는 프로젝트의 지침, Gemini는 스킬";\n',
  });
  const 항목 = ['lab/index.html', 'privacy/index.html', 'song.mp3', 'pic.png', 'app.js', 'pulse/index.html', 'lab2/index.html', 'builds/manual/view.js'];
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목 }));
  assert.equal(r.결과, '걸림');
  assert.equal(r.규칙출처, '.github/site-check/check.mjs', '배포 점검 규칙을 후보의 check.mjs에서 읽는다');
  const 걸린 = (p) => r.걸림.filter((x) => x.경로 === p).map((x) => x.검사);
  assert.deepEqual(걸린('lab/index.html'), ['도구 이름'], '도구에 든 사본 목록에 없는 낱말도 check.mjs 목록으로 잡는다');
  assert.deepEqual(걸린('privacy/index.html'), [], '처리 위탁 업체를 적는 페이지는 점검처럼 뺀다');
  assert.deepEqual(걸린('song.mp3'), ['도구 이름']);
  assert.deepEqual(걸린('pic.png'), ['제작 표시']);
  assert.deepEqual(걸린('app.js'), ['AI 이름'], '더한 줄만 본다(이미 있던 줄의 이름은 다른 검사 몫)');
  assert.deepEqual(걸린('pulse/index.html'), [], 'PULSE 가상 모델 고지는 남긴다');
  assert.deepEqual(걸린('lab2/index.html'), ['AI 이름']);
  assert.deepEqual(걸린('builds/manual/view.js'), [], 'AI 도구 사용법이 내용인 맞춤 도구 페이지는 AI 이름 검사에서 뺀다');
  assert.equal(공.머리(), 공.바탕);

  const 허용 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['app.js', 'song.mp3'], 허용: ['app.js', 'song.mp3'] }));
  assert.deepEqual(허용.걸림.map((x) => `${x.경로}:${x.검사}`), ['song.mp3:도구 이름'], '배포 점검 규칙은 --허용으로 넘기지 않는다');
  assert.ok(허용.알림.some((x) => x.경로 === 'app.js' && /--허용으로 넘김/.test(x.이유)));
});

test('AI 이름 한글·맨 GPT와 이 PC 경로: 10-19 공개본에서 샌 줄은 잡고, 공개본의 흔한 낱말 줄은 넘긴다', () => {
  const 규칙 = 속.점검규칙읽기(점검원문('suno'));
  const 검사 = (줄들, 옵션) => 속.검사하기(줄들.map(([경로, 새, 옛]) => ({ 경로, 버퍼: 글(새), 공개버퍼: 옛 === undefined ? null : 글(옛) })), 규칙, 옵션);
  const 걸린 = (r) => r.걸림.map((x) => `${x.경로} ${x.검사}`).sort();
  // 10-19 공개본(synk-policy e3909ee)에 실제로 실려 나간 줄과 같은 꼴
  const 샌줄 = 검사([
    ['world/brand-opening/first-run.mjs', '// 몽글 그림은 GPT 이미지 2.5로 한 판에 구워 나눔\n'],
    ['world/korean-runner/course-motion.mjs', '// 수정을 옮김 — snapshot/gpt-games-local-20261006 course-motion.mjs).\n'],
    ['world/hangul-stage/songs.mjs', '// 시각은 노래에서 목소리만 떼어(Demucs) 잰 음절 시작이다\n// Documents/synk-vendor/hangul-mascot-video/vowel-dance-full-v6/scripts/).\n'],
    ['world/brand-opening/home-town.mjs', '// 다시 잰다(격자 사진: .tmp/world-firstrun-20261014).\n'],
    ['brief/katana/view.js', '// 펠트 그림(10-13 GPT 이미지 2.5로 구워 오림, 판·지시문은 Documents/synk-vendor/katana-tool-felt/).\n'],
    ['vendor/lib.js', '// built in C:\\Users\\me\\lib\n'],
    ['a/path.js', "const 곳 = '/c/Users/me/x';\n"],
    ['a/korean.js', '// 지피티로 만든 판 · (수노 노래) · 클로드가 다시 그림\n'],
    ['a/mono.js', '// MonoGPT Biz-Pro로 구움\n'],
    ['a/video.js', '// Veo 3.1로 만든 장면\n'],
    ['.github/site-check/note.mjs', '// Documents/synk-vendor/x GPT 이미지\n'],
  ]);
  assert.deepEqual(걸린(샌줄), [
    'a/korean.js AI 이름', 'a/mono.js AI 이름', 'a/path.js 내부 경로', 'a/video.js AI 이름',
    'brief/katana/view.js 내부 경로',
    'vendor/lib.js 내부 경로',
    'world/brand-opening/first-run.mjs AI 이름',
    'world/brand-opening/home-town.mjs 내부 경로',
    'world/hangul-stage/songs.mjs AI 이름', 'world/hangul-stage/songs.mjs 내부 경로',
    'world/korean-runner/course-motion.mjs AI 이름',
  ], 'AI 이름은 맞춤 도구(brief/)·vendor에서 빼고, 이 PC 경로는 .github/만 뺀다');
  assert.equal(샌줄.요약.경로줄, 11, '이 PC 경로는 .github/ 말고 모든 글 파일의 더한 줄을 본다');

  // 공개본에 지금 있는 줄 — 흔한 낱말과 겹치는 이름·일부러 둔 글(10-19 e3909ee 948개로 잰 거짓 경보)
  const 흔한줄 = 검사([
    ['try/rhythm/index.html', '<canvas class="hero-runway" id="hero-runway"></canvas>\n'],
    ['nombre/rules.js', "    if (w.startsWith('ll')) { out.push({ rule: 'll', src: 'll' }); i += 2; continue; } // llama 야마\n"],
    ['path/models/whisper-base/tokenizer.json', '{"model": {"vocab": {"llama": 1, "runway": 2, "veo": 3, "sora": 4}}}\n'],
    ['builds/move/content.js', "  { id: 'onedrive', title: 'OneDrive 동기화가 끝났는지 보기' },\n"],
    ['homepage.css', '/* 규칙의 정본은 SYNK-appsscript/docs/디자인/플랫폼_시그널/README.md. */\n'],
    ['a/links.html', '<a href="https://example.com/documents/guide.pdf">안내</a>\n'],
    ['a/race.js', "const 글 = '사이클링 대회와 교수노조 회의';\nconst 임시 = 'cache.tmp/x';\n"],
    ['world/hangul-stage/audio.mjs', '// 10-03 목소리는 Typecast로 정했다\nconst a = 2;\n', '// 10-03 목소리는 Typecast로 정했다\nconst a = 1;\n'],
  ]);
  assert.deepEqual(걸린(흔한줄), [], '흔한 낱말·원고 머리말·주소의 documents·이미 공개본에 있던 줄은 넘긴다');

  const 허용 = 검사([['world/brand-opening/home-town.mjs', '// .tmp/world-firstrun-20261014 · 지피티\n']], { 허용: ['world/brand-opening/home-town.mjs'] });
  assert.deepEqual(허용.걸림, []);
  assert.deepEqual(허용.알림.map((x) => x.검사).sort(), ['AI 이름', '내부 경로'], '--허용은 사람이 본 AI 이름·이 PC 경로를 알림으로 넘긴다');
});

test('공개 경로·제작 자료·저장 용량: 밑줄 폴더·qa/·-original 그림·큰 파일은 막고 Jekyll 머리말은 알린다', async (t) => {
  const 공 = 새공개본(t, { 'index.html': '<p>홈</p>\n' });
  const 로컬 = 공.로컬('빌드', {
    '_shared/x.js': 'export {}\n', 'try/racing/qa/play.cjs': '//\n', 'art/mongle-original.png': Buffer.from([1, 0, 1]),
    'notes/README.md': '# 안내\n', 'feed.xml': '---\ntitle: x\n---\n<rss/>\n', 'big.bin': Buffer.alloc(100, 1), 'mid.bin': Buffer.alloc(50, 1),
  });
  const 항목 = ['_shared/x.js', 'try/racing/qa/play.cjs', 'art/mongle-original.png', 'notes/README.md', 'feed.xml', 'big.bin', 'mid.bin'];
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목, 한도: { 파일: 60, 파일경고: 45 } }));
  const 걸린 = r.걸림.map((x) => `${x.경로}:${x.검사}`).sort();
  assert.deepEqual(걸린, ['_shared/x.js:공개 경로', 'art/mongle-original.png:제작 자료', 'big.bin:저장 용량', 'try/racing/qa/play.cjs:제작 자료']);
  const 알린 = r.알림.map((x) => `${x.경로 || ''}:${x.검사}`);
  for (const a of ['feed.xml:공개 경로', 'mid.bin:저장 용량']) assert.ok(알린.includes(a), a);
  assert.ok(!알린.includes('notes/README.md:공개 경로'), '머리말 없는 .md는 그대로 나가니 알리지 않는다');
  const 허용 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['art/mongle-original.png'], 허용: ['art/mongle-original.png'] }));
  assert.equal(허용.결과, '미리 보기');
});

// ── import 이름 엇갈림(공개 주소 캐시 10분) ─────────────────────────────────

/** 짝을 한 줄 글로: 「① 부르는 → 대상: 이름,…」(옛 판은 (옛), 모듈째 없으면 (모듈)) */
const 짝글들 = (e) => e.짝.map((x) => `${x.종류} ${x.부르는}${x.판 === '옛' ? '(옛)' : ''} → ${x.대상}: ${[...x.이름, ...(x.모듈없음 ? ['(모듈)'] : [])].join(',')}`);

test('import 이름 읽기: 주석·문자열·틀 글·정규식은 걷어 내고 정적 import·export 꼴을 모두 읽는다', () => {
  const r = 엇.모듈읽기([
    "import a, { b as c, 'd e' as f } from './x.mjs';",
    "import { default as g } from './g.mjs'",
    'import * as ns from "../y.mjs"',
    "import './side.mjs';",
    "import h, * as ns2 from '/world/z.mjs?v=abc';",
    '// import { 주석 } from "./주석.mjs";',
    '/* export const 막힘 = 1;',
    '   import { 막힘 } from "./막힘.mjs"; */',
    "const 글 = \"import { 글속 } from './글속.mjs'\";",
    'const 틀 = `export const 틀속 = ${"}"} import { 틀속 } from \'./틀속.mjs\'`;',
    "const 식 = /import { 식속 } from '.\\/식속.mjs'/g, 몫 = 4 / 2 / 1;",
    "if (식.test(글)) /'/.exec(글);",
    'const 반 = 글.length / 2; const 따옴 = "\'";',
    "obj.import('./dyn.mjs'); import('./dyn2.mjs'); const m = import.meta.url;",
    'export default function () {}',
    'export const k1 = 1, k2 = (a, b) => { return a / b }, { k3, k4: k5, ...k6 } = obj, [k7, , k8 = 2] = arr',
    'export let k9',
    'export async function k10() {}',
    'export function* k11() {}',
    'export class K12 extends Base {}',
    'export { k13, k14 as k15, k16 as "글 이름" };',
    "export { r1, r2 as r3 } from './re.mjs';",
    "export * from './star.mjs';",
    "export * as ns3 from './star2.mjs';",
    'const 객체 = { import: 1, export: 2 }; class Q { export() {} }',
  ].join('\n'));
  assert.equal(r.문제, null);
  assert.deepEqual(r.가져옴, [
    { 지정자: './x.mjs', 이름: ['default', 'b', 'd e'] },
    { 지정자: './g.mjs', 이름: ['default'] },
    { 지정자: '../y.mjs', 이름: [] },
    { 지정자: './side.mjs', 이름: [] },
    { 지정자: '/world/z.mjs?v=abc', 이름: ['default'] },
    { 지정자: './re.mjs', 이름: ['r1', 'r2'] },
    { 지정자: './star.mjs', 이름: [] },
    { 지정자: './star2.mjs', 이름: [] },
  ], '주석·문자열·틀 글·정규식 속 import와 동적 import()·import.meta·속성 이름은 빼고');
  assert.deepEqual([...r.내보냄].sort(), ['K12', 'default', 'k1', 'k10', 'k11', 'k13', 'k15', 'k2', 'k3', 'k5', 'k6', 'k7', 'k8', 'k9', 'ns3', 'r1', 'r3', '글 이름'].sort());
  assert.deepEqual(r.모두다시, ['./star.mjs']);
  // esbuild 묶음 끝의 export {…}(world-account.bundle.mjs 꼴)
  const 묶음 = 엇.모듈읽기('var x = 1;\nvar export_worldLearning = import_game.default;\nexport {\n  createWorldAccount,\n  export_worldLearning as worldLearning\n};\n');
  assert.deepEqual([...묶음.내보냄], ['createWorldAccount', 'worldLearning']);
  const 별 = 엇.모듈읽기("export * from './a.mjs';\nexport const b = 1;\n");
  assert.deepEqual([엇.내보내나(별, 'b'), 엇.내보내나(별, 'c'), 엇.내보내나(별, 'default')], [true, '모름', false], 'export *는 default를 넘기지 않는다');
  const 호스트 = new Set(['synk.im']);
  assert.deepEqual(엇.지정자풀기('world/a/b.mjs', './x.mjs', 호스트), { 경로: 'world/a/x.mjs', 쿼리: '' });
  assert.deepEqual(엇.지정자풀기('world/a/b.mjs', '../y.mjs?v=1#h', 호스트), { 경로: 'world/y.mjs', 쿼리: '?v=1#h' });
  assert.deepEqual(엇.지정자풀기('world/a/b.mjs', '/world/z.mjs', 호스트), { 경로: 'world/z.mjs', 쿼리: '' });
  assert.deepEqual(엇.지정자풀기('a.mjs', 'https://synk.im/world/q.mjs', 호스트), { 경로: 'world/q.mjs', 쿼리: '' });
  for (const 바깥 of ['https://cdn.example.com/x.mjs', 'three', 'data:text/javascript,1', '../../x.mjs']) assert.equal(엇.지정자풀기('world/b.mjs', 바깥, 호스트), null, 바깥);
  // 검수(10-20 Fable)로 더한 꼴: case·default·라벨 블록과 export default 뒤의 정규식, 역슬래시 + CRLF 줄 이음 글, \u로 쓴 이름
  const 역 = String.fromCharCode(92);
  const 꼴 = 엇.모듈읽기([
    "switch (x) { case 1: { y(); } /['\"]/.test(z); default: { w(); } /['\"]/.test(z); }",
    "outer: { break outer; } /['\"]/.exec(z);",
    'const 삼항 = a ? { b: 1 } : { c: 2 }, 몫2 = 6 / 3 / 2;',
    'export const 하나 = 1;',
    "export default /['\"]/;",
    'export const 둘 = 2;',
    `const 이음 = 'abc${역}${String.fromCharCode(13, 10)}def'; export const 같은줄 = 3;`,
    `export const ${역}uD55C = 4, ${역}u{AE00} = 5;`,
  ].join('\n'));
  assert.equal(꼴.문제, null);
  assert.deepEqual([...꼴.내보냄].sort(), ['default', '같은줄', '글', '둘', '하나', '한'].sort());
});

test('import 이름 세기: ①·②·③ 가르기 · 이미 깨져 있던 짝·export *·지운 모듈·새 파일·처음 쓰는 ?v= 주소 · 1단계는 엇갈림을 푸는 최소', () => {
  /** 옛 = 공개본 {경로: 글}, 바꿈 = {경로: 새 글 | null(지움)} */
  const 세보기 = (옛, 바꿈, 덧 = {}) => {
    const 후 = { ...옛 };
    for (const [p, v] of Object.entries(바꿈)) if (v === null) delete 후[p]; else 후[p] = v;
    return 엇.세기({
      바뀐: Object.keys(바꿈).map((p) => [p, 바꿈[p] === null ? '지움' : p in 옛 ? '바꿈' : '새']),
      옛판: (p) => 옛[p] ?? null, 새판: (p) => 후[p] ?? null, 모든경로: [...new Set([...Object.keys(옛), ...Object.keys(후)])], ...덧,
    });
  };
  // ① 새 이름(공개본에서도 없던 이름 broken은 세지 않는다) → 1단계는 새 이름을 내보내는 쪽
  const 하나 = 세보기(
    { 'w/shell.mjs': "import { a, broken } from './lib.mjs';", 'w/lib.mjs': 'export const a = 1;' },
    { 'w/shell.mjs': "import { a, b, broken } from './lib.mjs';", 'w/lib.mjs': 'export const a = 1, b = 2;' },
  );
  assert.deepEqual(짝글들(하나), ['① w/shell.mjs → w/lib.mjs: b']);
  assert.deepEqual(하나.나눔, { '1단계': ['w/lib.mjs'], 남는: [] });

  // ② 옛 판만 부르던 이름을 없앰 → 1단계는 그 이름을 그만 부르는 쪽. 새 판도 계속 부르면 ③이고 나누지 않는다(사람이 넘긴 ③은 빼고).
  const 옛둘 = { 'w/a.mjs': "import { x, y } from './t.mjs';", 'w/t.mjs': 'export const x = 1, y = 2;', 'w/c.mjs': "import { x } from './t.mjs';" };
  const 바꿈둘 = { 'w/a.mjs': "import { y } from './t.mjs';", 'w/t.mjs': 'export const y = 2;', 'w/c.mjs': "import { x } from './t.mjs';\nexport const z = 1;" };
  const 둘 = 세보기(옛둘, 바꿈둘);
  assert.deepEqual(짝글들(둘), ['② w/a.mjs(옛) → w/t.mjs: x', '③ w/c.mjs → w/t.mjs: x']);
  assert.equal(둘.나눔, null);
  assert.deepEqual(세보기(옛둘, 바꿈둘, { 넘김: new Set(['w/c.mjs']) }).나눔['1단계'], ['w/a.mjs']);
  assert.equal(세보기(옛둘, 바꿈둘, { 넘김: new Set(['w/t.mjs']) }).나눔, null, '넘김은 부르는 쪽 경로로만 받는다');
  const 안씀 = 세보기(옛둘, 바꿈둘, { 쓰이나: (p) => p !== 'w/c.mjs' });
  assert.deepEqual([안씀.짝.find((x) => x.종류 === '③').안쓰임, 안씀.나눔['1단계']], [true, ['w/a.mjs']], '아무도 안 부르는 모듈의 ③은 나눔을 막지 않는다');
  assert.deepEqual(세보기(옛둘, { ...바꿈둘, 'w/c.mjs': 'export const z = 1;' }).나눔, { '1단계': ['w/a.mjs', 'w/c.mjs'], 남는: [] });

  // 지운 모듈: 바뀐 모듈의 옛 판만 부르면 ②, 안 바뀌는 모듈이 부르면 ③
  const 셋 = 세보기(
    { 'w/u.mjs': "import { x } from './del.mjs';", 'w/m.mjs': "import { x } from './del.mjs';", 'w/del.mjs': 'export const x = 1;' },
    { 'w/del.mjs': null, 'w/m.mjs': 'export const m = 1;' },
  );
  assert.deepEqual(짝글들(셋), ['② w/m.mjs(옛) → w/del.mjs: (모듈)', '③ w/u.mjs → w/del.mjs: (모듈)']);

  // export *: 모르는 이름은 세지 않고(알 수 없음), default는 export *로 넘어오지 않아 ③
  const 넷 = 세보기(
    { 'w/re.mjs': "export * from './lib.mjs';", 'w/lib.mjs': 'export const a = 1;', 'w/user.mjs': "import { a } from './re.mjs';" },
    { 'w/user.mjs': "import { a, maybe } from './re.mjs';\nimport d from './re.mjs';" },
  );
  assert.deepEqual(짝글들(넷), ['③ w/user.mjs → w/re.mjs: default']);
  assert.deepEqual(넷.알수없음, [{ 부르는: 'w/user.mjs', 대상: 'w/re.mjs', 이름: 'maybe' }]);

  // 새 파일로 가는 import는 ①이 아니다(캐시에 옛 판이 없다). 새 파일에 없는 이름은 ③
  assert.deepEqual(짝글들(세보기({ 'w/app.mjs': 'export const z = 1;' }, { 'w/app.mjs': "import { n } from './new.mjs';\nexport const z = 1;", 'w/new.mjs': 'export const n = 1;' })), []);
  assert.deepEqual(짝글들(세보기({ 'w/app.mjs': '' }, { 'w/app.mjs': "import { n, typo } from './new.mjs';", 'w/new.mjs': 'export const n = 1;' })), ['③ w/app.mjs → w/new.mjs: typo']);

  // ?v=: 공개본이 그 모듈을 부르던 값과 다르면 처음 쓰는 주소라 ①에서 뺀다
  const 옛여섯 = { 'w/v.mjs': "import { s } from './s.mjs?v=1111';", 'w/s.mjs': 'export const s = 1;' };
  const 바꿈여섯 = (값) => ({ 'w/v.mjs': `import { s, s2 } from './s.mjs?v=${값}';`, 'w/s.mjs': 'export const s = 1, s2 = 2;' });
  const 옛토큰들 = () => new Set(['1111']);
  const 새주소 = 세보기(옛여섯, 바꿈여섯('2222'), { 옛토큰들 });
  assert.deepEqual([짝글들(새주소), 새주소.새주소], [[], 1]);
  assert.deepEqual(짝글들(세보기(옛여섯, 바꿈여섯('1111'), { 옛토큰들 })), ['① w/v.mjs → w/s.mjs: s2'], '공개본과 같은 주소는 캐시를 탄다');
  assert.deepEqual(짝글들(세보기(옛여섯, 바꿈여섯('2222'))), ['① w/v.mjs → w/s.mjs: s2'], '공개본 값을 모르면 ?v= 주소도 캐시를 탈 수 있다고 본다');

  // 새 이름을 부르면서 남이 쓰던 이름도 없애면 나눠도 안 풀린다(남는 짝)
  const 막힘 = 세보기({ 'w/p.mjs': "import { y } from './t.mjs';", 'w/t.mjs': 'export const y = 1;' }, { 'w/p.mjs': "import { x } from './t.mjs';", 'w/t.mjs': 'export const x = 1;' });
  assert.deepEqual(짝글들(막힘), ['① w/p.mjs → w/t.mjs: x', '② w/p.mjs(옛) → w/t.mjs: y']);
  assert.deepEqual([막힘.나눔['1단계'], 막힘.나눔.남는.length], [[], 2]);
});

test('import 이름 엇갈림: 세 짝을 세고 ③은 걸림(--허용이면 알림), ①·②는 1단계를 --만 명령으로 보이며 1단계를 올린 뒤에는 0이다', async (t) => {
  const 묶음 = (이름들) => `function createWorldAccount() {}\nfunction loadWorldConfig() {}\nfunction createGuestTrials() {}\nexport {\n${이름들.map((x) => `  ${x}`).join(',\n')}\n};\n`;
  const 셸 = (이름들) => `import {${이름들.join(',')}} from './world-account.bundle.mjs';\nimport {restoreTutorSelection} from './tutor-selection-sync.mjs';\nimport './report-view.mjs';\nimport './town.mjs';\nimport './foo.mjs';\n`;
  const 셸1 = 셸(['createWorldAccount']);
  const 공 = 새공개본(t, {
    'world/index.html': `<script type="module" src="/world/app-shell.mjs?v=${sha12(글(셸1))}"></script>\n`,
    'world/app-shell.mjs': 셸1,
    'world/world-account.bundle.mjs': 묶음(['createWorldAccount', 'loadWorldConfig']),
    'world/tutor-selection-sync.mjs': 'export function restoreTutorSelection(a) { return a; }\n',
    'world/town.mjs': "import {loadWorldConfig} from './world-account.bundle.mjs';\n",
    // 아무 파일도 부르지 않는 옛 모듈(루트 app.js 꼴) — 그 ③은 알림만
    'world/old-root.mjs': "import {loadWorldConfig} from './world-account.bundle.mjs';\n",
    'world/badges.mjs': 'export function legacyBadge() {}\nexport function badge() {}\n',
    'world/old-panel.mjs': "import {legacyBadge} from './badges.mjs';\nexport const panel = 1;\n",
    'world/legacy-util.mjs': 'export const util = 1;\n',
    'world/foo.mjs': "import {util} from './legacy-util.mjs';\n",
    'world/report.mjs': 'export const scoreRun = 1;\n',
    'world/report-view.mjs': "import { scoreRun } from './report.mjs?v=runner-20261014';\n",
  });
  // 손님 체험(10-19) 꼴: 새 셸이 묶음의 새 이름을 부르고, 배지에서 옛 이름을 빼며 패널은 그 이름을 그만 부른다
  const 빌드 = (덧) => 공.로컬(`빌드-${crypto.randomBytes(3).toString('hex')}`, {
    'world/app-shell.mjs': 셸(['createWorldAccount', 'createGuestTrials']),
    'world/world-account.bundle.mjs': 묶음(['createGuestTrials', 'createWorldAccount', 'loadWorldConfig']),
    'world/tutor-selection-sync.mjs': 'export function restoreTutorSelection(a, b = {}) { return [a, b]; }\n',
    'world/badges.mjs': 'export function badge() {}\n',
    'world/old-panel.mjs': "import {badge} from './badges.mjs';\nexport const panel = 2;\n",
    'world/report.mjs': 'export const scoreRun = 1, newStat = 2;\n',
    'world/report-view.mjs': "import { scoreRun, newStat } from './report.mjs?v=runner-20261014';\n",
    // 새 파일은 도구가 ?v=를 갈지 않는다 — 공개본과 같은 주소라 캐시의 옛 report.mjs를 받을 수 있다(①)
    'world/report-card.mjs': "import { newStat } from './report.mjs?v=runner-20261014';\n",
    ...덧,
  });
  const 항목 = ['world/app-shell.mjs', 'world/world-account.bundle.mjs', 'world/tutor-selection-sync.mjs', 'world/badges.mjs', 'world/old-panel.mjs', 'world/report.mjs', 'world/report-view.mjs', 'world/report-card.mjs'];

  // ③: 안 바뀌는 town.mjs가 부르는 이름을 묶음에서 빼고, foo.mjs가 부르는 모듈을 지운다 → 걸림(아무도 안 부르는 old-root.mjs는 알림)
  const 나쁜 = 빌드({ 'world/world-account.bundle.mjs': 묶음(['createGuestTrials', 'createWorldAccount']) });
  const 걸린 = await 도구.올리기(공.옵션({ 원본: 나쁜, 항목, 지움: ['world/legacy-util.mjs'] }));
  assert.equal(걸린.결과, '걸림');
  assert.deepEqual(걸린.엇갈림.셈, { '①': 2, '②': 1, '③': 3 });
  assert.deepEqual(짝글들(걸린.엇갈림).filter((x) => x.startsWith('③')), [
    '③ world/foo.mjs → world/legacy-util.mjs: (모듈)',
    '③ world/old-root.mjs → world/world-account.bundle.mjs: loadWorldConfig',
    '③ world/town.mjs → world/world-account.bundle.mjs: loadWorldConfig',
  ]);
  const import걸림 = 걸린.걸림.filter((x) => x.검사 === 'import 이름');
  assert.deepEqual(import걸림.map((x) => x.경로), ['world/foo.mjs', 'world/town.mjs']);
  assert.match(import걸림[1].이유, /--허용 world\/town\.mjs$/);
  assert.ok(걸린.알림.some((x) => x.경로 === 'world/old-root.mjs' && /안 쓰는 옛 모듈/.test(x.이유)));
  assert.equal(걸린.엇갈림.나눔, null);
  const 대상허용 = await 도구.올리기(공.옵션({ 원본: 나쁜, 항목, 지움: ['world/legacy-util.mjs'], 허용: ['world/world-account.bundle.mjs', 'world/legacy-util.mjs'] }));
  assert.equal(대상허용.결과, '걸림', '③은 부르는 쪽 경로로만 넘긴다(대상 경로 허용은 그 파일의 다른 검사까지 끄므로)');
  const 넘김 = await 도구.올리기(공.옵션({ 원본: 나쁜, 항목, 지움: ['world/legacy-util.mjs'], 허용: ['world/town.mjs', 'world/foo.mjs'] }));
  assert.equal(넘김.결과, '미리 보기', '사람이 본 ③은 --허용으로 넘긴다');
  assert.equal(넘김.알림.filter((x) => x.검사 === 'import 이름' && /--허용으로 넘김/.test(x.이유)).length, 2);

  // ①·②만: 1단계 = 새 이름을 내보내는 묶음·report + 옛 이름을 그만 부르는 패널. report-view는 도구가 갈아 끼운 ?v= 새 주소로 불러
  // ①이 아니고, 새 파일 report-card는 공개본과 같은 주소로 불러 ①이다.
  // 이 미리 보기는 명령줄 --json으로 받는다(결과가 JSON에도 그대로 들어간다).
  const 좋은 = 빌드({});
  const argv = ['올리기', '--원본', 좋은, ...항목];
  const 찍힘 = [];
  const 원래 = console.log;
  console.log = (s) => 찍힘.push(String(s));
  try {
    assert.equal(await 도구.main([...argv, '--사본', 공.사본, '--원격주소', 공.원격주소, '--json']), 0);
  } finally {
    console.log = 원래;
  }
  const r = JSON.parse(찍힘.join('\n'));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.deepEqual(짝글들(r.엇갈림), [
    '① world/app-shell.mjs → world/world-account.bundle.mjs: createGuestTrials',
    '① world/report-card.mjs → world/report.mjs: newStat',
    '② world/old-panel.mjs(옛) → world/badges.mjs: legacyBadge',
  ]);
  assert.equal(r.엇갈림.새주소, 1);
  assert.deepEqual(r.엇갈림.나눔['1단계'], ['world/old-panel.mjs', 'world/report.mjs', 'world/world-account.bundle.mjs']);
  assert.ok(['world/app-shell.mjs', 'world/badges.mjs', 'world/index.html', 'world/report-card.mjs'].every((p) => r.엇갈림.나눔['2단계'].includes(p)));
  const 글줄 = 속.올리기글(r, argv);
  assert.match(글줄, /import 이름\(캐시 10분\) — ① 2짝 · ② 1짝 · ③ 0짝/);
  assert.match(글줄, /--만 world\/old-panel\.mjs --만 world\/report\.mjs --만 world\/world-account\.bundle\.mjs\n/);
  assert.match(글줄, /한 번에 올리려면\(위 import ①·② 엇갈림을 알고도/);
  // 1단계 명령은 미리 보기다 — 받은 명령의 --실행·--계획·메시지는 빼고, 미리 보기가 아닌 결과에는 나눔을 안 보인다
  const 실행글 = 속.올리기글(r, [...argv, '-m', '한 번에', '--실행', '--계획', '0123456789ab', '--json']);
  const 단계줄 = 실행글.split('\n').find((l) => l.includes('--만 world/old-panel.mjs'));
  assert.ok(단계줄 && !/--실행|--계획|-m |--json/.test(단계줄), 단계줄);
  assert.doesNotMatch(속.올리기글({ ...r, 결과: '올림', 커밋: '0'.repeat(40) }, argv), /나눠 올린다/);

  // 1단계(--만)는 엇갈림 0(report를 부르는 report-view는 ?v=만 따라 바뀐다) — 올리고 나면 원래 명령의 남은 2단계도 0
  const 일 = await 도구.올리기(공.옵션({ 원본: 좋은, 항목, 만: r.엇갈림.나눔['1단계'] }));
  assert.deepEqual(종류들(일), { 'world/old-panel.mjs': '바꿈', 'world/report.mjs': '바꿈', 'world/report-view.mjs': '토큰', 'world/world-account.bundle.mjs': '바꿈' });
  assert.deepEqual(일.엇갈림.셈, { '①': 0, '②': 0, '③': 0 });
  await assert.rejects(도구.올리기(공.옵션({ 원본: 좋은, 항목, 만: ['world/town.mjs'] })), /--만 world\/town\.mjs/);
  const 올림 = await 도구.올리기(공.옵션({ 원본: 좋은, 항목, 만: r.엇갈림.나눔['1단계'], 실행: true, 계획: 일.계획, 메시지: '1단계', 기다림: 0.01, 간격: 0.1 }));
  assert.match(올림.결과, /^올림/);
  const 이 = await 도구.올리기(공.옵션({ 원본: 좋은, 항목 }));
  assert.deepEqual([이.엇갈림.셈, 이.엇갈림.나눔], [{ '①': 0, '②': 0, '③': 0 }, null], '1단계가 공개본에 있으면 2단계는 엇갈림이 없다');
  assert.ok(!이.항목.some((x) => x.경로 === 'world/world-account.bundle.mjs'));
});

test('import 이름 엇갈림 0: 10-20 화면 언어 1판처럼 새 모듈을 더하고 묶음 내보내기만 늘리면 한 번에 올린다(주석·글 속 import는 세지 않는다)', async (t) => {
  const 묶음 = (덧 = '') => `function createWorldAccount() {}\nfunction loadWorldConfig() {}\n${덧}var export_worldLearning = 1;\nexport {\n  ${덧 ? 'createDeviceRecordsOffer,\n  ' : ''}createWorldAccount,\n  loadWorldConfig,\n  export_worldLearning as worldLearning\n};\n`;
  const 공 = 새공개본(t, {
    'world/index.html': '<script type="module" src="./app-shell.mjs?v=1a2b3c4d5e6f"></script>\n',
    'world/app-shell.mjs': "import {createWorldAccount, loadWorldConfig} from './world-account.bundle.mjs';\nimport {createLifeExperience} from './life-ui.mjs';\n",
    'world/world-account.bundle.mjs': 묶음(),
    'world/life-ui.mjs': "import {PACKS} from './life-content.mjs';\nexport function createLifeExperience() { return PACKS; }\n",
    'world/life-content.mjs': 'export const PACKS = [], LESSONS = [];\n',
    'world/hangul-stage/app.mjs': "import * as audio from './audio.mjs';\nimport { SONGS } from './songs.mjs';\n",
    'world/hangul-stage/audio.mjs': 'export function play() {}\n',
    'world/hangul-stage/songs.mjs': 'export const SONGS = [];\n',
  });
  const 로컬 = 공.로컬('빌드', {
    'world/brand-opening/world-strings.mjs': 'export default { ko: {}, en: {}, mn: {} };\n',
    'world/brand-opening/world-lang.mjs': "import STRINGS from './world-strings.mjs';\nexport const LANGS = ['ko', 'en', 'mn'];\nexport function t(k) { return STRINGS.ko[k] ?? k; }\nexport const tMessage = (k) => t(k);\n",
    'world/app-shell.mjs': [
      "import {createWorldAccount, loadWorldConfig, worldLearning} from './world-account.bundle.mjs';",
      "import {createLifeExperience} from './life-ui.mjs';",
      "import {t} from './brand-opening/world-lang.mjs';",
      "// import {ghost} from './world-account.bundle.mjs'; — 주석 속 import는 부르는 것이 아니다",
      "const 안내 = \"import {ghost2} from './world-account.bundle.mjs'\";",
      '',
    ].join('\n'),
    'world/world-account.bundle.mjs': 묶음('function createDeviceRecordsOffer() {}\n'),
    'world/life-ui.mjs': "import {PACKS, LESSONS} from './life-content.mjs';\nimport {t as tr, tMessage} from './brand-opening/world-lang.mjs';\nexport function createLifeExperience() { return [PACKS, LESSONS, tr, tMessage]; }\n",
    'world/hangul-stage/lang.mjs': "export { t, LANGS } from '../brand-opening/world-lang.mjs';\nexport const currentLang = () => 'ko';\n",
    'world/hangul-stage/app.mjs': "import * as audio from './audio.mjs';\nimport { SONGS } from './songs.mjs';\nimport { t as tr, currentLang } from './lang.mjs';\n",
  });
  const 항목 = ['world/brand-opening/world-strings.mjs', 'world/brand-opening/world-lang.mjs', 'world/app-shell.mjs', 'world/world-account.bundle.mjs', 'world/life-ui.mjs', 'world/hangul-stage/lang.mjs', 'world/hangul-stage/app.mjs'];
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.deepEqual([r.엇갈림.셈, r.엇갈림.짝, r.엇갈림.나눔, r.엇갈림.모듈.바뀐], [{ '①': 0, '②': 0, '③': 0 }, [], null, 7]);
  const 글줄 = 속.올리기글(r, ['올리기']);
  assert.match(글줄, /import 이름\(캐시 10분\) — ① 0짝 · ② 0짝 · ③ 0짝 · 바뀐 모듈 7개/);
  assert.match(글줄, /\n올리려면\(유호님이 이 계획을 승인한 뒤에만\):/);
  assert.doesNotMatch(글줄, /나눠 올린다/);
});

// ── 실행 ────────────────────────────────────────────────────────────────────

test('--실행: 계획이 같을 때만 별도 인덱스로 커밋·push하고, 공개 주소 바이트와 배포 점검까지 본다', async (t) => {
  const 옛 = 'a{}\n';
  const 공 = 새공개본(t, { 'app.css': 옛, 'index.html': `<link rel="stylesheet" href="/app.css?v=${sha12(글(옛))}">\n`, 'gone.txt': '지울 파일\n' });
  const 서버 = await 공개서버(t);
  const 새 = 'a{color:blue}\n';
  const 로컬 = 공.로컬('빌드', { 'app.css': 새 });
  const 입력 = { 원본: 로컬, 항목: ['app.css'], 지움: ['gone.txt'] };
  const 미리 = await 도구.올리기(공.옵션(입력));
  assert.equal(미리.결과, '미리 보기');

  const 틀린계획 = await 도구.올리기(공.옵션({ ...입력, 실행: true, 계획: '000000000000', 메시지: 'x' }));
  assert.equal(틀린계획.결과, '멈춤');
  assert.match(틀린계획.이유, /계획이 미리 보기와 다르다/);
  assert.equal(공.머리(), 공.바탕);

  // Pages가 새 판을 내준다고 치고, 배포 점검은 origin 머리의 실행이 통과한다
  서버.파일.set('app.css', 글(새));
  서버.파일.set('index.html', 글(`<link rel="stylesheet" href="/app.css?v=${sha12(글(새))}">\n`));
  const gh = 가짜gh(() => [{ databaseId: 41, headSha: 공.머리(), status: 'completed', conclusion: 'success', createdAt: '2026-10-19T00:00:00Z', url: 'u', attempt: 1 }]);
  const r = await 도구.올리기(공.옵션({ ...입력, 실행: true, 계획: 미리.계획, 메시지: 'Publish app.css\n\nSource: 시험', 주소: 서버.주소, 기다림: 0.1, 간격: 0.2, 점검안함: false, gh }));
  assert.equal(r.결과, '올림', JSON.stringify(r.확인));
  assert.equal(공.머리(), r.커밋);
  assert.equal(r.원격머리, r.커밋);
  assert.equal(공.og('rev-parse', `${r.커밋}^`).toString().trim(), 공.바탕, '부모는 미리 보기 때의 공개본');
  assert.equal(공.og('log', '-1', '--format=%an <%ae>|%s', r.커밋).toString().trim(), 'yuho <301381929+unmet23-lab@users.noreply.github.com>|Publish app.css');
  const 바뀜 = 공.og('diff-tree', '-r', '--no-renames', '--name-status', `${r.커밋}^`, r.커밋).toString().trim().split('\n').sort();
  assert.deepEqual(바뀜, ['D\tgone.txt', 'M\tapp.css', 'M\tindex.html']);
  assert.deepEqual({ 통과: r.확인.대조.통과, 같음: r.확인.대조.같음, 전체: r.확인.대조.전체 }, { 통과: true, 같음: 3, 전체: 3 }, '지운 파일은 404로 확인');
  assert.equal(r.확인.점검.결과, '통과');
  assert.equal(r.확인.점검.실행, 41);
});

test('--실행: 그사이 남이 다른 파일을 올렸으면 새 판 위에, 내 경로를 고쳤으면 멈춘다', async (t) => {
  const 공 = 새공개본(t, { 'mine.txt': '1\n', 'other.txt': 'o\n' });
  const 로컬 = 공.로컬('빌드', { 'mine.txt': '2\n' });
  const 입력 = { 원본: 로컬, 항목: ['mine.txt'], 메시지: 'Publish mine' };
  const 미리 = await 도구.올리기(공.옵션(입력));
  const 남 = 공.올림({ 'other.txt': 'o2\n' });
  const r = await 도구.올리기(공.옵션({ ...입력, 실행: true, 계획: 미리.계획, 기다림: 0.01, 간격: 0.1 }));
  assert.match(r.결과, /^올림/);
  assert.equal(공.og('rev-parse', `${r.커밋}^`).toString().trim(), 남, '새 공개본 위에 얹는다');
  assert.equal(공.파일('other.txt').toString(), 'o2\n', '남의 변경을 지키고');
  assert.equal(공.파일('mine.txt').toString(), '2\n');

  const 로컬2 = 공.로컬('빌드2', { 'mine.txt': '3\n' });
  const 미리2 = await 도구.올리기(공.옵션({ 원본: 로컬2, 항목: ['mine.txt'] }));
  공.올림({ 'mine.txt': '남이 같은 파일을 고침\n' });
  const 머리 = 공.머리();
  const 멈춤 = await 도구.올리기(공.옵션({ 원본: 로컬2, 항목: ['mine.txt'], 실행: true, 계획: 미리2.계획, 메시지: 'x' }));
  assert.equal(멈춤.결과, '멈춤');
  assert.match(멈춤.이유, /계획이 미리 보기와 다르다/);
  assert.equal(공.머리(), 머리, '아무것도 올리지 않았다');
});

test('push 경합: 커밋을 만든 뒤 남이 먼저 올리면 거절을 받고 새 판 위에서 다시 만든다', async (t) => {
  const 공 = 새공개본(t, { 'mine.txt': '1\n', 'other.txt': 'o\n' });
  const 로컬 = 공.로컬('빌드', { 'mine.txt': '2\n' });
  const 미리 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['mine.txt'] }));
  let 남 = null;
  const r = await 도구.올리기(공.옵션({
    원본: 로컬, 항목: ['mine.txt'], 실행: true, 계획: 미리.계획, 메시지: 'Publish mine', 기다림: 0.01, 간격: 0.1,
    _밀기전: () => { if (!남) 남 = 공.올림({ 'other.txt': '경합\n' }); },
  }));
  assert.match(r.결과, /^올림/);
  assert.equal(r.다시한수, 1);
  assert.equal(공.og('rev-parse', `${r.커밋}^`).toString().trim(), 남);
  assert.equal(공.파일('other.txt').toString(), '경합\n');
});

test('바이트 대조 실패: 공개 주소가 옛 바이트를 주면 「올림·확인 덜 됨」과 다른 파일을 알린다', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '옛\n', 'b.txt': 'b\n' });
  const 서버 = await 공개서버(t);
  서버.파일.set('a.txt', 글('옛\n')); // Pages가 아직 옛 판을 내준다
  const 로컬 = 공.로컬('빌드', { 'a.txt': '새\n' });
  const 미리 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'] }));
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 실행: true, 계획: 미리.계획, 메시지: 'Publish a', 주소: 서버.주소, 기다림: 0.02, 간격: 0.3 }));
  assert.equal(r.결과, '올림·확인 덜 됨');
  assert.equal(공.머리(), r.커밋, 'push는 됐다');
  assert.equal(r.확인.대조.통과, false);
  assert.deepEqual(r.확인.대조.다름.map((x) => [x.경로, x.상태]), [['a.txt', 200]]);
  assert.match(속.올리기글(r, []), /바이트 대조 실패 0\/1[\s\S]*다름 a\.txt/);
});

test('확인: 올라간 커밋을 다시 대조하고(남의 공개도) 지운 파일은 404를 기다린다', async (t) => {
  const 공 = 새공개본(t, { 'keep.txt': 'k\n', 'gone.txt': 'g\n', 'pic.webp': Buffer.from([1, 2, 3]) });
  const 커밋 = 공.올림({ 'keep.txt': 'k2\n', 'pic.webp': Buffer.from([4, 5, 6, 7]), 'README.md': '# x\n', 'feed.xml': '---\nlayout: x\n---\n<rss/>\n' }, ['gone.txt']);
  const 서버 = await 공개서버(t);
  서버.파일.set('keep.txt', 글('k2\n'));
  서버.파일.set('pic.webp', Buffer.from([4, 5, 6, 7]));
  서버.파일.set('README.md', 글('# x\n')); // 머리말 없는 .md는 그대로 나간다
  서버.파일.set('gone.txt', 글('g\n')); // 아직 안 지워짐
  const 반쯤 = await 도구.확인(공.옵션({ 커밋, 주소: 서버.주소, 기다림: 0.01, 간격: 0.2 }));
  assert.equal(반쯤.결과, '확인 덜 됨');
  assert.deepEqual(반쯤.대조.다름.map((x) => x.경로), ['gone.txt']);
  assert.deepEqual(반쯤.빠짐.map((x) => x.경로), ['feed.xml'], 'Jekyll 머리말 파일만 뺀다');
  서버.파일.delete('gone.txt');
  const 됨 = await 도구.확인(공.옵션({ 커밋, 주소: 서버.주소, 기다림: 0.01, 간격: 0.2 }));
  assert.equal(됨.결과, '확인함');
  assert.equal(됨.대조.같음, 4);
  // --부터: 여러 커밋에 걸친 공개도 한 번에 본다
  const 앞 = 공.올림({ 'a.txt': 'a\n' });
  const 끝 = 공.올림({ 'b.txt': 'b\n' });
  서버.파일.set('a.txt', 글('a\n'));
  서버.파일.set('b.txt', 글('b\n'));
  const 범위 = await 도구.확인(공.옵션({ 커밋: 끝, 부터: `${앞}^`, 주소: 서버.주소, 기다림: 0.01, 간격: 0.2 }));
  assert.equal(범위.결과, '확인함');
  assert.equal(범위.대조.전체, 2);
  // 뒤 공개가 같은 파일을 다시 바꾸면 그 경로는 지금 main 판으로 대조한다(Pages는 main 머리를 내준다)
  공.올림({ 'keep.txt': 'k3 — 뒤 공개\n' });
  서버.파일.set('keep.txt', 글('k3 — 뒤 공개\n'));
  const 뒤 = await 도구.확인(공.옵션({ 커밋, 주소: 서버.주소, 기다림: 0.01, 간격: 0.2 }));
  assert.equal(뒤.결과, '확인함', JSON.stringify(뒤.대조));
  assert.deepEqual(뒤.대조.뒤바뀜, ['keep.txt']);
  assert.match(속.확인결과글(뒤), /지금 main\([0-9a-f]{7}\) 판으로 대조: keep\.txt/);
});

test('배포 점검: 취소된 내 실행은 뒤 커밋 실행으로, 실패는 바이트가 같을 때 한 번만 다시 돌린다', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '1\n' });
  const 내커밋 = 공.올림({ 'a.txt': '2\n' }, [], '내 공개');
  const 뒤커밋 = 공.올림({ 'b.txt': 'b\n' }, [], '뒤 공개');
  const 서버 = await 공개서버(t);
  서버.파일.set('a.txt', 글('2\n'));
  // 첫 응답: 내 실행만 취소된 채 보이고 뒤 실행은 아직 없다 — 실패가 아니라 기다릴 때다
  const 취소 = 가짜gh((n) => (n === 1 ? [실행(1, 내커밋, 'completed', 'cancelled')]
    : n === 2 ? [실행(1, 내커밋, 'completed', 'cancelled'), 실행(2, 뒤커밋, 'in_progress', '', 1, '2026-10-19T00:01:00Z')]
      : [실행(1, 내커밋, 'completed', 'cancelled'), 실행(2, 뒤커밋, 'completed', 'success', 1, '2026-10-19T00:01:00Z')]));
  const a = await 도구.확인(공.옵션({ 커밋: 내커밋, 주소: 서버.주소, 기다림: 0.01, 간격: 0.05, 점검안함: false, gh: 취소 }));
  assert.equal(a.점검.결과, '통과');
  assert.equal(a.점검.실행, 2);
  assert.equal(a.점검.뒤커밋, true);

  const 다시 = 가짜gh((n) => (n === 1 ? [실행(5, 내커밋, 'completed', 'failure', 1)]
    : n === 2 ? [실행(5, 내커밋, 'completed', 'failure', 1)] // 다시 돌린 직전: 아직 옛 시도가 보인다
      : n === 3 ? [실행(5, 내커밋, 'in_progress', '', 2)]
        : [실행(5, 내커밋, 'completed', 'success', 2)]));
  const b = await 도구.확인(공.옵션({ 커밋: 내커밋, 주소: 서버.주소, 기다림: 0.01, 점검기다림: 0.2, 간격: 0.05, 점검안함: false, 재실행: true, gh: 다시 }));
  assert.equal(b.점검.결과, '통과', JSON.stringify(b.점검));
  assert.equal(b.점검.재실행, 5);
  assert.equal(다시.부름.filter((x) => x.startsWith('run rerun')).length, 1);

  const 실패 = 가짜gh(() => [실행(9, 내커밋, 'completed', 'failure', 1)]);
  const c = await 도구.확인(공.옵션({ 커밋: 내커밋, 주소: 서버.주소, 기다림: 0.01, 간격: 0.05, 점검안함: false, gh: 실패 }));
  assert.equal(c.결과, '확인 덜 됨');
  assert.equal(c.점검.결과, '실패');
  assert.deepEqual(c.점검.실패단계, ['점검']);
  assert.equal(실패.부름.filter((x) => x.startsWith('run rerun')).length, 0, '--재실행 없이는 다시 돌리지 않는다');
});

// ── 검수(10-19 Fable)로 더한 경우 ──────────────────────────────────────────

test('미리 보기 뒤 내 로컬 파일이 바뀌면 --실행이 멈춘다(계획의 새 판이 다르다)', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '1\n' });
  const 로컬 = 공.로컬('빌드', { 'a.txt': '2\n' });
  const 미리 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'] }));
  쓰기(로컬, 'a.txt', '3 — 미리 보기 뒤에 고침\n');
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 실행: true, 계획: 미리.계획, 메시지: 'x' }));
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /계획이 미리 보기와 다르다/);
  assert.equal(공.머리(), 공.바탕);
});

test('3방향 줄끝: 공개본이 CRLF면 합친 뒤 CRLF로 돌리고, 줄끝이 섞인 판은 LF로 맞춰 합친다', async (t) => {
  const 판 = (고침, 끝 = '\n') => `${['줄 1', '줄 2', '줄 3', '줄 4', '줄 5', '줄 6'].map((l, i) => 고침[i] ?? l).join(끝)}${끝}`;
  const 공 = 새공개본(t, { 'p.html': 판({}), 'q.html': 판({}) });
  const 기준 = 공.바탕;
  // 남이 CRLF 작업본에서 줄 2를 고쳐 올렸다(q는 한 줄만 CRLF로 섞임)
  공.올림({ 'p.html': 판({ 1: '줄 2 남' }, '\r\n'), 'q.html': `줄 1\r\n${판({ 1: '줄 2 남' }).slice('줄 1\n'.length)}` });
  const 내판 = 공.로컬('내판', { 'p.html': 판({ 4: '줄 5 나' }), 'q.html': 판({ 4: '줄 5 나' }) });
  const 후보 = 공.후보폴더();
  const r = await 도구.올리기(공.옵션({ 원본: 내판, 항목: ['p.html', 'q.html'], 기준, 후보폴더: 후보 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.equal(후보읽기(후보, 'p.html').toString('utf8'), 판({ 1: '줄 2 남', 4: '줄 5 나' }, '\r\n'));
  assert.equal(후보읽기(후보, 'q.html').toString('utf8'), 판({ 1: '줄 2 남', 4: '줄 5 나' }));
  assert.match(r.항목.find((x) => x.경로 === 'q.html').방법, /섞인/);
});

test('?v= 슬래시 없는 참조: 이름이 하나뿐이면 꼬리 맞춤으로 고치고, 여럿이면 고치지 않고 알린다', async (t) => {
  const 사진 = Buffer.from([1, 2, 3]);
  const 공 = 새공개본(t, {
    'world/brand-opening/assets/tutors/marin-기본.webp': 사진,
    'world/brand-opening/tutor-profiles.mjs': `export default {"기본":"marin-기본.webp?v=${sha12(사진)}","표정":"face.webp?v=${sha12(사진)}","눈":"eye.webp?v=${sha12(사진)}"};\n`,
    'world/brand-opening/app.mjs': "import 프로필 from './tutor-profiles.mjs';\n",
    'world/a/face.webp': 사진, 'world/b/face.webp': 사진,
    // 같은 이름 둘 중 하나만 토큰 해시와 맞는다 — 그쪽이 대상이다
    'world/c/eye.webp': 사진, 'world/d/eye.webp': Buffer.from([5, 5]),
  });
  const 새사진 = Buffer.from([9, 9, 9, 9]);
  const 로컬 = 공.로컬('빌드', { 'world/brand-opening/assets/tutors/marin-기본.webp': 새사진, 'world/a/face.webp': 새사진, 'world/c/eye.webp': 새사진 });
  const 후보 = 공.후보폴더();
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['world/brand-opening/assets/tutors/marin-기본.webp', 'world/a/face.webp', 'world/c/eye.webp'], 후보폴더: 후보 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  const 프로필 = 후보읽기(후보, 'world/brand-opening/tutor-profiles.mjs').toString('utf8');
  assert.match(프로필, new RegExp(`marin-기본\\.webp\\?v=${sha12(새사진)}`));
  assert.match(프로필, new RegExp(`eye\\.webp\\?v=${sha12(새사진)}`), '같은 이름이 여럿이어도 토큰 해시가 맞는 하나를 고른다');
  assert.match(프로필, new RegExp(`face\\.webp\\?v=${sha12(사진)}`), '어느 face.webp인지 모르면(둘 다 맞으면) 그대로 둔다');
  assert.ok(r.알림.some((x) => x.경로 === 'world/brand-opening/tutor-profiles.mjs' && /가리킬 수 있는 파일이 2개/.test(x.이유)));
});

test('지움: 밑줄 경로도 지울 수 있고, 기준 빌드와 공개본이 줄끝만 다르면 남이 바꾼 것으로 보지 않는다', async (t) => {
  const 공 = 새공개본(t, { '_shared/x.js': 'x\n', 'site/crlf.txt': 'c1\r\nc2\r\n', 'site/keep.txt': 'k\n' });
  const 밑줄 = await 도구.올리기(공.옵션({ 지움: ['_shared/x.js'] }));
  assert.equal(밑줄.결과, '미리 보기', JSON.stringify(밑줄.걸림));
  assert.deepEqual(종류들(밑줄), { '_shared/x.js': '지움' });
  const 기준빌드 = 공.로컬('기준빌드', { 'crlf.txt': 'c1\nc2\n', 'keep.txt': 'k\n' });
  const 내빌드 = 공.로컬('내빌드', { 'keep.txt': 'k\n' });
  const r = await 도구.올리기(공.옵션({ 원본: 내빌드, 공개폴더: 'site', 항목: ['.'], 기준폴더: 기준빌드 }));
  assert.equal(r.결과, '미리 보기', JSON.stringify(r.걸림));
  assert.deepEqual(종류들(r), { 'site/crlf.txt': '지움' });
  assert.match(r.항목[0].방법, /줄끝/);
});

test('push가 세 번 다 거절되면 멈추고 아무것도 올리지 않는다', async (t) => {
  const 공 = 새공개본(t, { 'mine.txt': '1\n', 'other.txt': 'o\n' });
  const 로컬 = 공.로컬('빌드', { 'mine.txt': '2\n' });
  const 미리 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['mine.txt'] }));
  let 번 = 0;
  const r = await 도구.올리기(공.옵션({
    원본: 로컬, 항목: ['mine.txt'], 실행: true, 계획: 미리.계획, 메시지: 'x',
    _밀기전: () => { 번++; 공.올림({ 'other.txt': `경합 ${번}\n` }); },
  }));
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /거절/);
  assert.equal(번, 3);
  assert.equal(공.파일('mine.txt').toString(), '1\n');
});

test('배포 점검: 실행이 안 보이면 못 찾음, 안 끝나면 기다림 끝, gh가 안 되면 못 찾음 · rerun이 실패해도 push 결과는 남는다', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '1\n' });
  const 커밋 = 공.올림({ 'a.txt': '2\n' });
  const 서버 = await 공개서버(t);
  서버.파일.set('a.txt', 글('2\n'));
  const 짧게 = { 커밋, 주소: 서버.주소, 기다림: 0.01, 점검기다림: 0.005, 간격: 0.05, 점검안함: false };
  const a = await 도구.확인(공.옵션({ ...짧게, gh: 가짜gh(() => []) }));
  assert.equal(a.점검.결과, '못 찾음');
  const b = await 도구.확인(공.옵션({ ...짧게, gh: 가짜gh(() => [실행(3, 커밋, 'in_progress', '', 1)]) }));
  assert.equal(b.점검.결과, '기다림 끝');
  const c = await 도구.확인(공.옵션({ ...짧게, gh: () => { throw Object.assign(new Error('x'), { 이유: 'gh 인증 없음' }); } }));
  assert.equal(c.점검.결과, '못 찾음');
  assert.match(c.점검.이유, /gh 인증 없음/);

  const 로컬 = 공.로컬('빌드', { 'a.txt': '3\n' });
  const 미리 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'] }));
  서버.파일.set('a.txt', 글('3\n'));
  const gh = 가짜gh(() => [실행(8, 공.머리(), 'completed', 'failure', 1)], { 다시실패: true });
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 실행: true, 계획: 미리.계획, 메시지: 'x', ...짧게, 커밋: undefined, 재실행: true, gh }));
  assert.equal(r.결과, '올림·확인 덜 됨');
  assert.equal(공.머리(), r.커밋, 'push는 됐고 커밋이 결과에 남는다');
  assert.equal(r.확인.점검.결과, '실패');
  assert.match(r.확인.점검.재실행오류, /권한 없음/);

  // 확인 자체가 오류로 끝나도(망이 끊김) push 결과와 커밋은 남는다
  const 로컬2 = 공.로컬('빌드2', { 'a.txt': '4\n' });
  const 미리2 = await 도구.올리기(공.옵션({ 원본: 로컬2, 항목: ['a.txt'] }));
  const 끊김 = await 도구.올리기(공.옵션({
    원본: 로컬2, 항목: ['a.txt'], 실행: true, 계획: 미리2.계획, 메시지: 'x', 점검안함: true,
    받기: () => { throw new Error('망 끊김'); },
  }));
  assert.equal(끊김.결과, '올림·확인 덜 됨');
  assert.equal(공.머리(), 끊김.커밋);
  assert.match(끊김.확인.오류, /망 끊김/);
  assert.match(속.올리기글(끊김, []), /확인 중 오류\(push는 됐다\): 망 끊김/);
});

test('?v= 순환: 서로를 부르는 두 파일이 같이 바뀌면 멈춘다(--토큰안함이면 그대로 올린다)', async (t) => {
  const 공 = 새공개본(t, {
    'a.js': "import './b.js?v=111111111111';\n", 'b.js': "import './a.js?v=222222222222';\n",
    'index.html': '<script type="module" src="a.js?v=333333333333"></script>\n',
  });
  const 로컬 = 공.로컬('빌드', { 'a.js': "import './b.js?v=111111111111';\n// 새 줄\n" });
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.js'] }));
  assert.equal(r.결과, '멈춤');
  assert.match(r.이유, /서로를 부르며/);
  const 끔 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.js'], 토큰안함: true }));
  assert.equal(끔.결과, '미리 보기');
});

test('바이트 대조: 8MB 넘는 파일은 HEAD 크기가 다르면 몸을 받지 않는다', async (t) => {
  const 큰 = Buffer.alloc(9 * 1024 * 1024, 3);
  const 공 = 새공개본(t, { 'big.bin': Buffer.alloc(10, 1) });
  const 서버 = await 공개서버(t);
  서버.파일.set('big.bin', Buffer.alloc(10, 1)); // 아직 옛 판(크기부터 다름)
  const 로컬 = 공.로컬('빌드', { 'big.bin': 큰 });
  const 미리 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['big.bin'] }));
  const r = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['big.bin'], 실행: true, 계획: 미리.계획, 메시지: 'x', 주소: 서버.주소, 기다림: 0.01, 간격: 0.2 }));
  assert.equal(r.결과, '올림·확인 덜 됨');
  assert.ok(서버.요청.includes('HEAD big.bin'));
  assert.ok(!서버.요청.includes('GET big.bin'), '크기가 다르면 9MB를 받지 않는다');
  서버.파일.set('big.bin', 큰);
  const 됨 = await 도구.확인(공.옵션({ 커밋: r.커밋, 주소: 서버.주소, 기다림: 0.01, 간격: 0.2 }));
  assert.equal(됨.결과, '확인함');
});

test('후보폴더: 이 도구가 써 둔 폴더면 다시 쓰고, 다른 파일이 섞였으면 멈춘다', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '1\n' });
  const 로컬 = 공.로컬('빌드', { 'a.txt': '2\n', 'b.txt': 'b\n' });
  const 후보 = 공.후보폴더();
  assert.equal((await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt', 'b.txt'], 후보폴더: 후보 }))).결과, '미리 보기');
  const 다시 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 후보폴더: 후보 }));
  assert.equal(다시.결과, '미리 보기');
  assert.ok(!fs.existsSync(path.join(후보, 'b.txt')), '전에 쓴 후보를 비우고 다시 쓴다');
  쓰기(후보, '남의파일.txt', 'x');
  const 막힘 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 후보폴더: 후보 }));
  assert.equal(막힘.결과, '멈춤');
  assert.ok(fs.existsSync(path.join(후보, '남의파일.txt')), '남의 파일은 지우지 않는다');
});

test('채우기: 기본은 PATH 면접 영상 — 쿼리 없는 주소로 받고 HEAD로 x-cache를 적는다', async (t) => {
  const 영상 = Buffer.alloc(3000, 7);
  const 공 = 새공개본(t, {
    'path/assets/interview/film/strict-question-4k.mp4': 영상, 'path/assets/interview/film/strict-question-720p.mp4': 영상,
    'path/assets/interview/film/other.mp4': 영상, 'world/assets/videos/a.mp4': 영상,
  });
  const 서버 = await 공개서버(t);
  서버.파일.set('path/assets/interview/film/strict-question-4k.mp4', 영상);
  서버.파일.set('path/assets/interview/film/strict-question-720p.mp4', 영상);
  const r = await 도구.채우기(공.옵션({ 주소: 서버.주소 }));
  assert.equal(r.결과, '채움', JSON.stringify(r));
  assert.deepEqual(r.파일.map((x) => [x.경로, x.상태, x.크기, x.캐시]), [
    ['path/assets/interview/film/strict-question-4k.mp4', 200, 3000, 'HIT'],
    ['path/assets/interview/film/strict-question-720p.mp4', 200, 3000, 'HIT'],
  ]);
  const 없음 = await 도구.채우기(공.옵션({ 주소: 서버.주소, 항목: ['world/assets/videos/*.mp4'] }));
  assert.equal(없음.결과, '덜 참', '공개 주소가 404면 덜 참');
});

// ── 사용법·명령줄 ───────────────────────────────────────────────────────────

test('사용법: --실행에는 --계획·메시지 · --위에는 미리 보기 전용 · 작업본(비 bare) 사본은 거절', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '1\n' });
  const 로컬 = 공.로컬('빌드', { 'a.txt': '2\n' });
  await assert.rejects(도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 실행: true, 메시지: 'x' })), /--계획/);
  await assert.rejects(도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 실행: true, 계획: 'abc' })), /메시지/);
  await assert.rejects(도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 실행: true, 계획: 'abc', 메시지: 'x', 위에: 'main' })), /--위에/);
  await assert.rejects(도구.올리기(공.옵션({ 항목: ['../a.txt=' + path.join(로컬, 'a.txt')] })), /\.\./);
  const 작업본 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 사본: 공.작업 }));
  assert.equal(작업본.결과, '멈춤');
  assert.match(작업본.이유, /bare 저장소가 아니다/);
  // 지난 공개 재현: --위에 바탕 위에서 만든다
  공.올림({ 'a.txt': '남\n' });
  const 재현 = await 도구.올리기(공.옵션({ 원본: 로컬, 항목: ['a.txt'], 위에: 공.바탕 }));
  assert.equal(재현.위, 공.바탕);
  assert.equal(재현.항목[0].전, 블롭id(글('1\n')));
});

test('명령줄: 미리 보기는 계획 해시가 붙은 올리는 명령을 보이고 종료 0, 걸리면 1, 잘못 쓰면 2', async (t) => {
  const 공 = 새공개본(t, { 'a.txt': '1\n' });
  const 로컬 = 공.로컬('빌드', { 'a.txt': '2\n', 'bad.html': '<p>금지낱말</p>\n' });
  const 찍힘 = [];
  const 원래 = { log: console.log, error: console.error };
  console.log = (s) => 찍힘.push(String(s));
  console.error = () => {};
  try {
    const 공통 = ['--사본', 공.사본, '--원격주소', 공.원격주소];
    assert.equal(await 도구.main(['올리기', '--원본', 로컬, 'a.txt', ...공통]), 0);
    const 출력 = 찍힘.join('\n');
    const m = /계획 ([0-9a-f]{12})/.exec(출력);
    assert.ok(m, 출력);
    assert.match(출력, new RegExp(`--실행 --계획 ${m[1]}`));
    assert.equal(await 도구.main(['올리기', '--원본', 로컬, 'bad.html', ...공통]), 1);
    assert.equal(await 도구.main(['올리기', '--모르는것']), 2);
    assert.equal(await 도구.main(['올리기', '--원본', 로컬, 'a.txt', '--실행', ...공통]), 2);
  } finally {
    Object.assign(console, 원래);
  }
  assert.equal(공.머리(), 공.바탕);
});

test('작은 함수: 참조 풀기·토큰 값·점검 규칙 읽기·glob', () => {
  const 있는 = new Set(['account/dist/platform.js', 'social-conversion.js', 'en/index.html', 'world/a/b.webp']);
  const 있나 = (p) => 있는.has(p);
  const 꼬리 = (u) => [...있는].filter((p) => p === u || p.endsWith(`/${u}`));
  const 호스트 = new Set(['synk.im']);
  assert.deepEqual(속.참조풀기('account/platform.html', './dist/platform.js', 있나, 꼬리, 호스트), { 경로: 'account/dist/platform.js' });
  assert.deepEqual(속.참조풀기('account/platform.html', '/social-conversion.js', 있나, 꼬리, 호스트), { 경로: 'social-conversion.js' });
  assert.deepEqual(속.참조풀기('x/y.html', 'https://synk.im/en/', 있나, 꼬리, 호스트), { 경로: 'en/index.html' });
  assert.equal(속.참조풀기('x/y.html', 'https://www.youtube.com/watch', 있나, 꼬리, 호스트), null);
  assert.equal(속.참조풀기('x/y.html', 'data:image/png;base64', 있나, 꼬리, 호스트), null);
  assert.deepEqual(속.참조풀기('data/m.mjs', 'a/b.webp', 있나, 꼬리, 호스트), { 경로: 'world/a/b.webp', 꼬리: true });
  const b = 글('x');
  assert.equal(속.토큰값(b, '35983c432263'), sha12(b));
  assert.equal(속.토큰값(b, 'atlas-20261017'), sha12(b));
  assert.equal(속.토큰값(b, '2'), sha12(b));
  assert.equal(속.토큰값(b, sha(글('y'))), sha(b));
  assert.equal(속.토큰값(b, 'abc', 'rel-1'), 'rel-1');
  const 사본 = 속.점검규칙읽기(null);
  assert.equal(사본.출처, '도구 사본');
  assert.match('made with suno', new RegExp(Buffer.from(사본.낱말, 'base64').toString(), 'i'));
  const 읽음 = 속.점검규칙읽기(점검원문('x|y'));
  assert.equal(읽음.출처, '.github/site-check/check.mjs');
  assert.ok(읽음.skipPage.test('en/privacy/index.html') && 읽음.글.test('a.webmanifest'));
  assert.ok(속.glob식('path/assets/interview/film/strict-*.mp4').test('path/assets/interview/film/strict-question-4k.mp4'));
  assert.ok(!속.glob식('path/*.mp4').test('path/a/b.mp4'));
  assert.ok(속.glob식('path/**/*.mp4').test('path/a/b/c.mp4') && 속.glob식('path/**/*.mp4').test('path/c.mp4'));
  assert.ok(속.glob식('world/**').test('world/a/b.glb') && !속.glob식('world/**').test('worldx/a'));
  assert.deepEqual(속.참조풀기('x/y.html', 'https://synk.im/', 있나, 꼬리, 호스트), null, '뿌리 index.html이 없으면 null');
  assert.deepEqual(속.참조풀기('x/y.html', '/', (p) => p === 'index.html', 꼬리, 호스트), { 경로: 'index.html' });
  // check.mjs의 목록은 이름으로 읽는다(순서가 바뀌어도)
  const 바꾼순서 = 점검원문('a|b').split('\n');
  const [w, tg] = [바꾼순서.findIndex((l) => l.includes('const words')), 바꾼순서.findIndex((l) => l.includes('const tagWords'))];
  [바꾼순서[w], 바꾼순서[tg]] = [바꾼순서[tg], 바꾼순서[w]];
  const 읽음2 = 속.점검규칙읽기(바꾼순서.join('\n'));
  assert.equal(Buffer.from(읽음2.낱말, 'base64').toString(), 'a|b');
});
