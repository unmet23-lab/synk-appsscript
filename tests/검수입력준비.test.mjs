import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { prepareReviewInput, compareReviewInputs, inspectReviewInput, parseArgs } from '../tools/검수입력준비.mjs';
import { 준비하기 } from '../tools/검수묶음.mjs';

const sha = x => crypto.createHash('sha256').update(x).digest('hex');
function sandbox(t) {
  const tmp = path.resolve(os.tmpdir()), root = fs.mkdtempSync(path.join(tmp, 'synk-review-input-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), tmp);
    assert.ok(path.basename(root).startsWith('synk-review-input-'));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const write = (name, body) => { const file = path.join(repo, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); return file; };
  return { root, repo, write };
}
function gitFixture(t) {
  const f = sandbox(t);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k)));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(f.root, 'no-global-config'), GIT_TERMINAL_PROMPT: '0' });
  const git = (...args) => execFileSync('git', ['-C', f.repo, '-c', 'core.autocrlf=false', '-c', 'user.name=review-input-test', '-c', 'user.email=test@example.invalid', ...args], { env, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'main');
  f.write('src/app.js', 'export const value = 1;\n');
  git('add', '--', 'src/app.js'); git('commit', '-q', '-m', 'fixture');
  const base = git('rev-parse', 'HEAD').trim();
  f.write('src/app.js', 'export const value = 2;\n' + Array.from({ length: 1800 }, (_, i) => `// 원천 범위 ${i}: ${'unchanged-contract-'.repeat(3)}`).join('\n') + '\n');
  return { ...f, base };
}
function inputs(f, detail = null) {
  const background = f.write('.tmp/in/short.md', '# 목적\r\n요청 권한과 결과 연결을 검토한다. 상세 원문은 곁자료 전체를 읽는다.\r\n');
  const details = [f.write('.tmp/in/detail.md', detail ?? Array.from({ length: 220 }, (_, i) => `상세 ${i}: ${'contract-'.repeat(5)}`).join('\r\n') + '\r\n')];
  return prepareReviewInput({ repository: f.repo, background, details, output: '.tmp/prepared' });
}
async function preparePair(f, p) {
  const common = { 저장소: f.repo, 종류: '백엔드', 작성자: 'Claude', 바탕: f.base, 경로: ['src/app.js'], 크기: 60000 };
  const before = path.join(f.root, 'before'), after = path.join(f.root, 'after');
  await 준비하기({ ...common, 이름: 'before', 폴더: before, 배경: p.baselineOptions.background });
  await 준비하기({ ...common, 이름: 'after', 폴더: after, 배경: p.reviewOptions.background, 곁: p.reviewOptions.companions });
  return { input: p.manifestPath, before, after };
}

test('입력을 요약하지 않고 UTF-8·CRLF 원시 바이트와 SHA를 보존하며 기존 옵션만 반환한다', t => {
  const f = sandbox(t), p = inputs(f, '첫 줄\r\n가운데: 서로 다른 의미를 그대로\r\n마지막 줄\r\n');
  const source = fs.readFileSync(p.sourceFiles[1].path), copied = fs.readFileSync(path.join(f.repo, p.details[0].path));
  assert.deepEqual(copied, source);
  assert.equal(p.details[0].sha256, sha(source));
  assert.notEqual(p.details[0].sha256, p.details[0].lfSha256);
  assert.deepEqual(p.reviewOptions.companions, ['.tmp/prepared/상세-01.md']);
  assert.equal(fs.existsSync(path.join(f.repo, '.tmp/prepared/묶음.json')), false);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, p.baseline.path)), Buffer.concat([fs.readFileSync(p.sourceFiles[0].path), Buffer.from('\n\n'), source]));
});

test('덮어쓰기·출력 경계·중복 입력·잘못된 UTF-8를 쓰기 전에 거절한다', t => {
  const f = sandbox(t), p = inputs(f);
  const args = { repository: f.repo, background: p.sourceFiles[0].path, details: [p.sourceFiles[1].path], output: '.tmp/prepared' };
  const old = fs.readFileSync(p.manifestPath);
  assert.throws(() => prepareReviewInput(args), /이미 있다/);
  assert.deepEqual(fs.readFileSync(p.manifestPath), old);
  assert.throws(() => prepareReviewInput({ ...args, output: '../escape' }), /폴더 밖/);
  assert.throws(() => prepareReviewInput({ ...args, output: 'public/input' }), /\.tmp/);
  assert.throws(() => prepareReviewInput({ ...args, output: '.tmp/duplicate', details: [args.background] }), /두 번/);
  const binary = f.write('.tmp/binary', Buffer.from([0xff, 0xfe]));
  assert.throws(() => prepareReviewInput({ ...args, output: '.tmp/binary-output', details: [binary] }), /UTF-8/);
  assert.equal(fs.existsSync(path.join(f.repo, '.tmp/binary-output')), false);
});

test('출력 부모의 junction·symlink를 따라가지 않는다', t => {
  const f = sandbox(t), p = inputs(f), link = path.join(f.repo, '.tmp/link');
  const target = path.join(f.root, 'elsewhere'); fs.mkdirSync(target);
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    assert.throws(() => prepareReviewInput({ repository: f.repo, background: p.sourceFiles[0].path, details: [p.sourceFiles[1].path], output: '.tmp/link/out' }), /연결 경로/);
    assert.equal(fs.readdirSync(target).length, 0);
  } finally { fs.unlinkSync(link); }
});

test('실제 준비기로 같은 원천·정책을 묶고 상세 전체·의존 SHA를 지키면서 바이트 감소를 측정한다', async t => {
  const f = gitFixture(t), p = inputs(f), pair = await preparePair(f, p);
  const r = compareReviewInputs(pair);
  assert.ok(r.savedBytes > 0, JSON.stringify(r));
  assert.equal(r.before.bytes - r.after.bytes, r.savedBytes);
  assert.equal(r.savedPercent, Number((r.savedBytes / r.before.bytes * 100).toFixed(2)));
  assert.equal(r.details[0].wholeTextIncluded, true);
  assert.equal(r.details[0].itemIds.length, 1);
  assert.deepEqual(Object.values(r.unchanged), [true, true, true, true, true]);
  assert.match(r.notice, /검수 통과.*측정하지 않았다/);
  const raw = JSON.parse(fs.readFileSync(path.join(pair.after, '묶음.json'), 'utf8'));
  const row = raw.증명.파일.find(x => x.경로 === p.details[0].path);
  assert.equal(row.역할, '의존'); assert.equal(row.sha256, p.details[0].lfSha256);
  assert.deepEqual(raw.정책.필수, ['GPT']);
});

test('상세가 여러 조각으로 나뉘고 긴 한 줄이 잘려도 모든 원문 문자를 확인한다', async t => {
  const f = gitFixture(t);
  const detail = Array.from({ length: 2000 }, (_, i) => `자료 ${i} 첫·중간·끝 계약`).join('\n') + '\n' + '긴한줄계약'.repeat(11000) + '\n마지막 표식';
  const p = inputs(f, detail), after = path.join(f.root, 'after');
  // 큰 상세는 기존 작은 묶음에서 조각난다. 이것을 합친 배경으로는 머리말 한도를 넘으므로 본문 포함만 검사한다.
  await 준비하기({ 저장소: f.repo, 종류: '백엔드', 바탕: f.base, 경로: ['src/app.js'], 크기: 60000, 이름: 'after', 폴더: after, 배경: p.reviewOptions.background, 곁: p.reviewOptions.companions });
  const m = JSON.parse(fs.readFileSync(path.join(after, '묶음.json'), 'utf8'));
  assert.ok(m.묶음.flatMap(x => x.항목).filter(x => /^X01/.test(x)).length > 2);
  const r = inspectReviewInput({ input: p.manifestPath, review: after });
  assert.equal(r.details[0].wholeTextIncluded, true);
  assert.ok(r.details[0].itemIds.length > 2);
});

test('상세 사본·준비된 묶음·후보 범위 변조를 통과시키지 않는다', async t => {
  const f = gitFixture(t), p = inputs(f), pair = await preparePair(f, p);
  const file = path.join(f.repo, p.details[0].path), old = fs.readFileSync(file);
  fs.appendFileSync(file, '나중 변경');
  assert.throws(() => compareReviewInputs(pair), /준비 뒤 바뀌었다/);
  fs.writeFileSync(file, old);
  const mf = path.join(pair.after, '묶음.json'), manifestBytes = fs.readFileSync(mf), m = JSON.parse(manifestBytes);
  const bundle = path.join(pair.after, m.묶음[0].파일), bundleBytes = fs.readFileSync(bundle);
  fs.appendFileSync(bundle, '추가');
  assert.throws(() => compareReviewInputs(pair), /바이트·SHA 불일치/);
  fs.writeFileSync(bundle, bundleBytes);
  m.증명.배포후보 = { 종류: 'synk.im', 항목: [] };
  fs.writeFileSync(mf, JSON.stringify(m));
  assert.throws(() => compareReviewInputs(pair), /배포후보.*다르다/);
  fs.writeFileSync(mf, manifestBytes);
  assert.ok(compareReviewInputs(pair).savedBytes > 0);
  const budgetChanged = JSON.parse(manifestBytes); budgetChanged.최대바이트 += 1000;
  fs.writeFileSync(mf, JSON.stringify(budgetChanged));
  assert.throws(() => compareReviewInputs(pair), /같은 묶음 크기/);
  fs.writeFileSync(mf, manifestBytes);
  // 본문을 빼고 묶음 SHA·항목 ID까지 다시 쓴 경우에도 원문과의 대조로 거절한다.
  const forged = JSON.parse(manifestBytes), row = forged.묶음.find(x => x.항목.some(id => /^X01-/.test(id)));
  const id = row.항목.find(x => /^X01-/.test(x)), actual = path.join(pair.after, row.파일);
  const expectedBody = old.toString('utf8').replace(/\r\n/g, '\n').split('\n').map((line, i) => `${String(i + 1).padStart(5)}| ${line}`).join('\n');
  const omittedBody = expectedBody.replace('   51| 상세 50: contract-', '   51| 상세 50: ');
  assert.notEqual(omittedBody, expectedBody);
  const forgedId = `X01-${sha(omittedBody).slice(0, 4)}`;
  const forgedText = fs.readFileSync(actual, 'utf8').replace(expectedBody, omittedBody).replace(`### [${id}]`, `### [${forgedId}]`);
  fs.writeFileSync(actual, forgedText);
  row.항목 = row.항목.map(x => x === id ? forgedId : x); row.sha256 = sha(forgedText); row.바이트 = Buffer.byteLength(forgedText);
  forged.증명.항목 = forged.묶음.map(x => x.sha256); fs.writeFileSync(mf, JSON.stringify(forged));
  assert.throws(() => compareReviewInputs(pair), /상세 본문 누락/);
});

test('상세를 줄 범위로 줄이면 전체 파일 SHA가 남아 있어도 거절한다', async t => {
  const f = gitFixture(t), p = inputs(f), pair = await preparePair(f, p);
  const file = path.join(pair.after, '묶음.json'), m = JSON.parse(fs.readFileSync(file, 'utf8'));
  m.설정.곁[0] += ':1-2'; fs.writeFileSync(file, JSON.stringify(m));
  assert.throws(() => compareReviewInputs(pair), /상세 전체/);
});

test('CLI는 명시한 입력만 받고 중복·명령 혼합을 거절한다', () => {
  assert.deepEqual(parseArgs(['준비', '--배경', '짧은 글.md', '--상세', 'a.md', 'b.md', '--출력', '.tmp/out']).options.details, ['a.md', 'b.md']);
  assert.throws(() => parseArgs(['준비', '--배경', 'a', '--배경', 'b']), /중복/);
  assert.throws(() => parseArgs(['대조', '--상세', 'a']), /명령에 맞지/);
  assert.throws(() => parseArgs(['실행']), /준비 또는 대조/);
});
