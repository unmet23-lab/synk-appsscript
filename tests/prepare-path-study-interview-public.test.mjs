// 「대학 입학 면접 연습」 공개 묶음 시험. 가짜 계정 설정만 쓴다.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { prepareStudyInterviewPublic, studyInterviewHtml, studyInterviewCsp, LIVE_MODULES } from '../tools/prepare-path-study-interview-public.mjs';
import { PATH_PUBLIC_URL } from '../tools/prepare-path-app-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '.tmp/study-interview-test-' + randomUUID();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const config = () => ({ version: 1, supabaseUrl: 'https://synthetic-auth.example/', supabasePublishableKey: 'sb_publishable_synthetic',
  accountApiUrl: 'https://synthetic-account.example/', portalUrl: 'https://synk.im/id/',
  clients: { 'path-app': { clientId: 'path-app-fixture', redirectUri: PATH_PUBLIC_URL } } });
after(() => fs.rm(path.join(ROOT, BASE), { recursive: true, force: true }));

test('묶음: 쪽 하나 · 스크립트 하나 · 꾸밈 하나뿐이고, 라이브 면접실 모듈은 상대 주소로만 부른다', async () => {
  const out = path.join(BASE, 'a');
  const r = await prepareStudyInterviewPublic({ out, config: config() });
  assert.deepEqual([...r.files].sort(), ['app.mjs', 'build-manifest.json', 'index.html', 'study.css']);
  const read = (n) => fs.readFile(path.join(ROOT, out, n));
  const app = (await read('app.mjs')).toString('utf8'), html = (await read('index.html')).toString('utf8'), manifest = JSON.parse(await read('build-manifest.json'));
  const imports = [...app.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual([...new Set(imports)].sort(), [...LIVE_MODULES].sort());
  for (const p of LIVE_MODULES) await fs.access(path.join(ROOT, 'experiences/path-vr/interview/study', p));
  assert.ok(!/\bimport\s*\(|\beval\s*\(|new Function/.test(app));
  assert.ok(html.includes(`src="./app.mjs?v=${sha(await read('app.mjs'))}"`) && html.includes(`href="./study.css?v=${sha(await read('study.css'))}"`));
  for (const [name, f] of Object.entries(manifest.files)) assert.equal(f.sha256, sha(await read(name)), name);
  assert.ok(Object.keys(manifest.sources).every((n) => /^experiences\/(path-vr\/interview\/study|path-app|synk-account\/src)\//.test(n)));
  // 답을 남기는 길이 없다: 저장소에 쓰는 말이 이 쪽의 코드에 없고, 읽는 것은 앱이 넘긴 과정과 급수뿐이다.
  const own = await fs.readFile(path.join(ROOT, 'experiences/path-vr/interview/study/app.mjs'), 'utf8') + await fs.readFile(path.join(ROOT, 'experiences/path-vr/interview/study/session.mjs'), 'utf8');
  assert.ok(!/setItem|indexedDB|localStorage|console\.(log|info|warn|error)/.test(own));
  assert.deepEqual([...own.matchAll(/getItem\('([^']+)'\)/g)].map((m) => m[1]), ['synk-path-interview']);
});

test('CSP: 계정 서버와 면접실 저장소만 연다. 인라인 스크립트와 eval은 없다', () => {
  const csp = studyInterviewCsp(config());
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.ok(!/script-src[^;]*'unsafe-inline'|'unsafe-eval'|\*/.test(csp));
  assert.match(csp, /connect-src[^;]*https:\/\/synthetic-auth\.example[^;]*https:\/\/synthetic-account\.example/);
  assert.ok(!/google-analytics|anthropic|generativelanguage/.test(csp));
});

test('쪽 원본: 인라인 스크립트 · 이벤트 속성 · 인라인 꾸밈이 들어오면 멈춘다', async () => {
  const html = await fs.readFile(path.join(ROOT, 'experiences/path-vr/interview/study/index.html'), 'utf8');
  const opts = { config: config(), appHash: 'a'.repeat(64), cssHash: 'b'.repeat(64) };
  assert.match(studyInterviewHtml(html, opts), /http-equiv="Content-Security-Policy"/);
  for (const extra of ['<script>alert(1)</script>', '<p onclick="x()">', '<p style="color:red">', '<iframe src="x"></iframe>', '<base href="/">']) assert.throws(() => studyInterviewHtml(html.replace('</main>', extra + '</main>'), opts), extra);
  for (const extra of ['<style>p{}</style>']) assert.throws(() => studyInterviewHtml(html.replace('</head>', extra + '</head>'), opts));
});

test('묶음 도구: 작업 사본의 .tmp 아래 새 폴더에만 쓰고, 다른 곳 · 있는 폴더 · 잘못된 설정은 멈춘다', async () => {
  await assert.rejects(prepareStudyInterviewPublic({ out: 'experiences/x', config: config() }));
  await assert.rejects(prepareStudyInterviewPublic({ out: '../x', config: config() }));
  await assert.rejects(prepareStudyInterviewPublic({ out: path.join(BASE, 'b'), config: { ...config(), accountApiUrl: 'http://plain.example/' } }));
  await fs.mkdir(path.join(ROOT, BASE, 'c'), { recursive: true });
  await assert.rejects(prepareStudyInterviewPublic({ out: path.join(BASE, 'c'), config: config() }));
});
