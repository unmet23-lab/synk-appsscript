import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import { 정책만들기, 정책판, 사이트점검작업ID, 필수글, 다시검수자들, 대신할검수자, 끝판정책, sha256 } from '../tools/lib/검수증명.mjs';

const options = { 종류: '화면', 작성자: 'GPT', 담당예외: 사이트점검작업ID };
const source = { 경로: 'site-v10/drama.js', 상태: 'M' };
const productPaths = [
  'site-v10/build.mjs', 'site-v10/drama.css', 'site-v10/drama.js', 'site-v10/content/ko.mjs', 'site-v10/content/en.mjs', 'site-v10/public-index.mjs',
  'experiences/path-travel/planner-ui.mjs', 'experiences/path-travel/index.html', 'experiences/brand-opening/home.html',
  'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/index.html',
];
const publicPaths = [
  'index.html', 'en/index.html', 'lab/index.html', 'en/lab/index.html', 'shift/index.html', 'en/shift/index.html',
  'assets/v10/drama.css', 'assets/v10/drama.js', 'assets/v10/pulse-redirect.js', 'robots.txt', 'sitemap.xml', 'pulse-app/index.html', 'llms.txt',
  'try/travel/index.html', 'try/travel/planner-ui.mjs', 'world/index.html', 'world/mobile.html', 'world/desktop.html',
];
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
function temp(t) {
  const root = fs.realpathSync(os.tmpdir()), dir = fs.mkdtempSync(path.join(root, 'synk-site-audit-review-'));
  t.after(() => { assert.ok(path.resolve(dir).startsWith(root + path.sep)); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); });
  return dir;
}
function candidate(dir, paths = ['index.html'], { kind = 'synk.im', deleted = false } = {}) {
  const before = '<p>before</p>\n', after = '<p>after</p>\n';
  const blob = crypto.createHash('sha1').update(Buffer.from(`blob ${Buffer.byteLength(before)}\0${before}`)).digest('hex');
  const rows = paths.map(p => {
    if (!deleted) write(path.join(dir, p), after);
    write(path.join(dir, '.앞판', p), before);
    return { 경로: p, 종류: deleted ? '지움' : '바꿈', 모드: deleted ? null : '100644', sha256: deleted ? null : sha256(after) };
  });
  write(path.join(dir, '후보.json'), JSON.stringify({ 판: 1, 종류: kind, 항목: rows, 위: 'a'.repeat(40), 앞판: Object.fromEntries(paths.map(p => [p, blob])) }));
  return dir;
}
function fixture(t, extra = {}) {
  const dir = temp(t), repo = path.join(dir, 'repo'); fs.mkdirSync(repo);
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(dir, 'no-global'), GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_') && !['GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL'].includes(k)) delete env[k];
  const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'core.autocrlf=false', '-c', `core.hooksPath=${path.join(dir, 'no-hooks')}`, ...args], { env, encoding: 'utf8', stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  write(path.join(repo, source.경로), 'export const value = 1;\n'); git('add', '.'); git('commit', '-qm', 'fixture');
  const base = git('rev-parse', 'HEAD').trim(); write(path.join(repo, source.경로), 'export const value = 2;\n');
  const out = candidate(path.join(dir, 'candidate'));
  return { dir, repo, out, git, options: { ...options, 저장소: repo, 바탕: base, 이름: 'site-audit-test', 폴더: path.join(dir, 'review'), 배포후보: out, ...extra } };
}
const answer = (b, findings = []) => ({ findings, coverage: { reviewed: 'synthetic fixture packet', limitations: 'test fixture only; no model was called', complete: true, missing: [] }, seen: b.항목, endMarker: b.표식,
  ...(b.대상 ? { targets: b.대상.map(id => ({ id, resolved: true, note: 'fixture correction verified' })) } : {}) });
function review(packet, who = '아르곤', findings = []) {
  for (const b of packet.목록.묶음) api.검수받기(packet.폴더, who, b.이름, JSON.stringify(answer(b, findings)));
}
async function finalReview(packet) {
  await api.페이블하기(packet.폴더, { 시험: false, 캡처: false });
  const proof = JSON.parse(fs.readFileSync(path.join(packet.폴더, '페이블자료.json'))).증명;
  api.페이블받기(packet.폴더, JSON.stringify({ ...answer(proof), argonReview: [], reviewInputHash: proof.검토입력해시 }));
}

test('사이트 점검은 승인 원문과 GPT 작성자를 보존하고 일반 화면 검수 정책과 같다', () => {
  for (const skip of [undefined, '공유 제목과 설명만 수정']) {
    const common = { 종류: '화면', ...(skip ? { 페이블생략: skip } : {}) };
    const normal = 정책만들기(common, [source]), actual = 정책만들기({ ...options, ...common }, [source]);
    assert.deepEqual(actual.필수, normal.필수); assert.equal(actual.예외, null); assert.equal(actual.작성자, 'GPT');
    assert.equal(actual.담당예외.taskId, 'site-audit-20261110'); assert.equal(actual.담당예외.userStatement, '이번 수정은 GPT가 직접 진행');
    assert.equal(필수글(actual), 필수글(normal)); assert.equal(끝판정책(actual), false);
    for (const findings of [[], [{ 출처: '아르곤' }], [{ 출처: 'Fable' }]]) assert.deepEqual(다시검수자들(actual, findings), 다시검수자들(normal, findings));
    for (const who of ['아르곤', 'Fable']) assert.deepEqual(대신할검수자(actual, who), 대신할검수자(normal, who));
  }
  assert.throws(() => 정책만들기({ ...options, 페이블생략: '  ' }, [source]), /까닭/);
});

test('정확한 제품·QA·생성물만 허용하고 관문·다른 제품·삭제·이름 변경·후보 단독은 거부한다', () => {
  for (const p of productPaths) assert.doesNotThrow(() => 정책만들기(options, [{ ...source, 경로: p }]));
  for (const p of ['qa/drama.test.mjs', 'qa/shift-lectures.test.mjs', 'qa/v11-site.test.mjs', 'qa/public-index.test.mjs', 'qa/RESULTS.md', 'package.json', 'docs/_ops/결정.md', 'docs/_ops/트랙.md', ...publicPaths.filter(p => !p.startsWith('world/')).map(p => `dist/${p}`)]) {
    assert.doesNotThrow(() => 정책만들기(options, [source, { 경로: p, 상태: 'A' }]));
    assert.throws(() => 정책만들기(options, [{ 경로: p, 상태: 'M' }]), /직접 승인 범위/);
  }
  for (const p of ['tools/lib/검수증명.mjs', 'tools/검수묶음.mjs', 'tests/검수사이트점검예외.test.mjs', 'docs/_ops/관문_자동화.md', 'site-v10/site.js', 'qa/unrelated.test.mjs', 'dist/account/index.html', 'experiences/synk-world-app/app-shell.mjs', '../site-v10/drama.js', 'site-v10/../site-v10/drama.js', 'site-v10\\drama.js']) assert.throws(() => 정책만들기(options, [source, { ...source, 경로: p }]), /직접 승인 범위/);
  for (const status of ['D', 'R', 'C', 'T', 'U', undefined]) assert.throws(() => 정책만들기(options, [{ ...source, 상태: status }]), /직접 승인 범위/);
  assert.throws(() => 정책만들기(options, [{ ...source, 옛경로: source.경로 }]), /직접 승인 범위/);
  assert.throws(() => 정책만들기(options, []), /직접 승인 범위/);
});

test('다른 작성자·작업·검수 예외·옛 정책과 혼합하지 않고 정상 GPT 백엔드는 공동 검수를 유지한다', () => {
  for (const change of [{ 작성자: 'Claude' }, { 종류: '백엔드' }, { 담당예외: 'other' }, { 사용자지정: 'unrelated.json' }, { 예외: '내부' }, { GPT구독: '종료' }]) assert.throws(() => 정책만들기({ ...options, ...change }, [source]));
  for (const 판 of [1, 2, 5]) if (판 !== 정책판) assert.throws(() => 정책만들기(options, [source], { 판 }), /직접 승인 범위/);
  assert.throws(() => 정책만들기({ 종류: '화면', 작성자: 'GPT' }, [source]), /Claude 담당/);
  assert.deepEqual(정책만들기({ 종류: '백엔드', 작성자: 'GPT' }, [{ 경로: 'tools/lib/검수증명.mjs', 상태: 'M' }]).필수, ['GPT', 'Claude']);
});

test('공개 후보는 정확한 synk.im 경로만 허용하고 삭제·회사 서버 경로·후보 단독은 거부한다', t => {
  const dir = temp(t), allowed = candidate(path.join(dir, 'allowed'), publicPaths);
  assert.deepEqual(정책만들기({ ...options, 배포후보: allowed }, [source]).필수, ['아르곤', 'Fable']);
  assert.throws(() => 정책만들기({ ...options, 배포후보: allowed }, []), /직접 승인 범위/);
  for (const p of ['account/index.html', 'world/app-shell.mjs', 'world/brand-opening/home.html', productPaths.at(-1)]) {
    const out = candidate(path.join(dir, String(publicPaths.indexOf(p)) + sha256(p).slice(0, 5)), [p]);
    assert.throws(() => 정책만들기({ ...options, 배포후보: out }, [source]), /직접 승인 범위/);
  }
  assert.throws(() => 정책만들기({ ...options, 배포후보: candidate(path.join(dir, 'deleted'), ['index.html'], { deleted: true }) }, [source]), /직접 승인 범위/);
  assert.throws(() => 정책만들기({ ...options, 배포후보: candidate(path.join(dir, 'backend'), ['index.html'], { kind: 'apps-script' }) }, [source]));
});

test('준비는 앞판 증명을 유지하며 미전송·빠진 응답·Fable 미검수와 변조된 후보를 통과시키지 않는다', async t => {
  const f = fixture(t), packet = await api.준비하기(f.options);
  assert.deepEqual(packet.목록.증명.후보앞판, { 위: 'a'.repeat(40), 항목: JSON.parse(fs.readFileSync(path.join(f.out, '후보.json'))).앞판 });
  assert.equal(api.검수확인(packet.폴더).통과, false);
  const b = packet.목록.묶음[0];
  assert.throws(() => api.검수받기(packet.폴더, '아르곤', b.이름, JSON.stringify({ ...answer(b), seen: [] })), /응답 검증/);
  review(packet); assert.equal(api.검수확인(packet.폴더).통과, false);
  assert.ok(api.검수확인(packet.폴더).사유.some(s => s.includes('Fable')));
  await finalReview(packet); assert.equal(api.검수확인(packet.폴더).통과, true);
  write(path.join(f.out, 'index.html'), '<p>not reviewed</p>\n');
  assert.equal(api.검수확인(packet.폴더).통과, false);
});

test('Fable 생략도 Argon 원문·입력 SHA가 맞아야 하며 승인 원문 변조를 거부한다', async t => {
  const f = fixture(t, { 페이블생략: '공유 설명 문구만 수정' }), packet = await api.준비하기(f.options);
  review(packet); assert.equal(api.검수확인(packet.폴더).통과, true);
  const manifest = path.join(packet.폴더, '묶음.json'), saved = fs.readFileSync(manifest), changed = JSON.parse(saved);
  changed.정책.담당예외.userStatement = '검수도 생략'; write(manifest, JSON.stringify(changed));
  assert.equal(api.검수확인(packet.폴더).통과, false); write(manifest, saved);
  const b = packet.목록.묶음[0]; fs.appendFileSync(path.join(packet.폴더, b.파일), '\nchanged input');
  assert.equal(api.검수확인(packet.폴더).통과, false);
});

test('Argon 한도 증거가 있을 때만 일반 화면처럼 Fable로 대체하고 집계도 동일하게 판단한다', async t => {
  const f = fixture(t, { 페이블생략: '공유 설명 문구만 수정' }), packet = await api.준비하기(f.options);
  const results = await api.아르곤보내기(packet.폴더, packet.목록, { 몫: () => ({ 주간: 0 }), call: async () => assert.fail('no model call in fixture') });
  assert.equal(api.검수확인(packet.폴더).통과, false);
  assert.equal(api.집계하기(packet.목록, results, api.지적표읽기(packet.폴더)).배포조건충족, false);
  await finalReview(packet); assert.equal(api.검수확인(packet.폴더).통과, true);
  assert.equal(api.집계하기(packet.목록, results, api.지적표읽기(packet.폴더)).배포조건충족, true);
});

test('Argon P1을 고치면 Fable 생략 판도 Argon과 Fable 재검수를 모두 요구한다', async t => {
  const f = fixture(t, { 페이블생략: '공유 설명 문구만 수정' }), packet = await api.준비하기(f.options);
  review(packet, '아르곤', [{ grade: 'P1', location: `${source.경로}:1`, quote: 'value = 2', problem: 'synthetic fixture defect', fix: 'use 3' }]);
  api.지적표고치기(packet.폴더, p => api.처리하기(p, ['A1=반영']));
  write(path.join(f.repo, source.경로), 'export const value = 3;\n');
  const next = await api.다시하기({ 이름: 'fixed', 폴더: path.join(f.dir, 'fixed'), 앞: packet.폴더, 저장소: f.repo });
  assert.deepEqual(next.목록.검수자들, ['아르곤', 'Fable']);
  review(next); assert.equal(api.검수확인(next.폴더).통과, false);
  review(next, 'Fable'); assert.equal(api.검수확인(next.폴더).통과, true);
});

test('최종 Fable 자료를 만들 때 새로 섞인 관문 코드는 담당 예외로 검수하지 않는다', async t => {
  const f = fixture(t), packet = await api.준비하기(f.options); review(packet);
  write(path.join(f.repo, 'tools/lib/검수증명.mjs'), 'export const unreviewedGate = true;\n');
  await assert.rejects(api.페이블하기(packet.폴더, { 시험: false, 캡처: false }), /직접 승인 범위/);
});

test('유일한 제품 변경을 바탕으로 되돌린 고침도 원문 해시에 묶어 재검수한다', async t => {
  const f = fixture(t, { 페이블생략: '공유 설명 문구만 수정' }), packet = await api.준비하기(f.options);
  review(packet, '아르곤', [{ grade: 'P1', location: `${source.경로}:1`, quote: 'value = 2', problem: 'synthetic fixture regression', fix: 'restore 1' }]);
  api.지적표고치기(packet.폴더, p => api.처리하기(p, ['A1=반영']));
  write(path.join(f.repo, source.경로), 'export const value = 1;\n');
  const next = await api.다시하기({ 이름: 'restored', 폴더: path.join(f.dir, 'restored'), 앞: packet.폴더, 저장소: f.repo });
  assert.deepEqual(next.목록.검수자들, ['아르곤', 'Fable']);
  review(next); assert.equal(api.검수확인(next.폴더).통과, false);
  review(next, 'Fable'); assert.equal(api.검수확인(next.폴더).통과, true);
});
