'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { generate } = require('../tools/geminilm-export.js');
const { copy } = require('../tools/이어하기꾸러미.js');
const { geminilmSection, geminilmFinding } = require('../tools/rot-check.js');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-share-freshness-'));
  t.after(() => {
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const repo = path.join(temp, 'source');
  const out = path.join(temp, 'output');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/AI_운영원칙.md'), '# 운영 원칙\n관련 정본을 실제로 읽는다.\n');
  return { temp, repo, out };
}

test('내보내기는 새 생성본을 만들고 사용자 파일·이전 생성본을 보존한다', t => {
  const { repo, out } = fixture(t);
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'user-note.md'), '사용자 메모');
  fs.mkdirSync(path.join(repo, 'memory'));
  fs.writeFileSync(path.join(repo, 'memory/private.md'), 'PRIVATE_FIXTURE_ONLY');
  const doc = path.join(repo, 'docs/current.md');
  fs.writeFileSync(doc, '# 원본 v1');
  const logs = [];
  const first = generate({ repo, out, log: line => logs.push(line) });
  fs.writeFileSync(doc, '# 원본 v2');
  const second = generate({ repo, out, log: line => logs.push(line) });
  assert.notEqual(first.output, second.output);
  assert.equal(fs.readFileSync(path.join(out, 'user-note.md'), 'utf8'), '사용자 메모');
  assert.match(fs.readFileSync(path.join(first.output, '문서__current.md'), 'utf8'), /원본 v1/);
  assert.match(fs.readFileSync(path.join(second.output, '문서__current.md'), 'utf8'), /원본 v2/);
  const manifest = JSON.parse(fs.readFileSync(path.join(second.output, '생성정보.json')));
  assert.equal(manifest.files.length, 2);
  assert.equal(manifest.files.find(f => f.source === 'docs/current.md').sha256, sha256(fs.readFileSync(doc)));
  const guide = fs.readFileSync(path.join(second.output, 'README_먼저읽기.md'), 'utf8');
  assert.match(guide, /AI_운영원칙\.md/);
  assert.match(guide, /현재 주담당/);
  assert.doesNotMatch(guide, /결손 보전|반영은 클로드|Plus 상한|구글이 이름|PRIVATE_FIXTURE_ONLY/);
});

test('제외한 비밀은 생성 파일·반환값·로그에도 나오지 않고 dry는 아무것도 쓰지 않는다', t => {
  const { repo, out } = fixture(t);
  const syntheticSecret = 'sk-' + 'Z'.repeat(30);
  fs.writeFileSync(path.join(repo, 'docs/secret.md'), syntheticSecret);
  const logs = [];
  const dry = generate({ repo, out, dry: true, log: line => logs.push(line) });
  assert.equal(dry.blocked, 1);
  assert.equal(fs.existsSync(out), false);
  const made = generate({ repo, out, log: line => logs.push(line) });
  const all = fs.readdirSync(made.output).map(file => fs.readFileSync(path.join(made.output, file), 'utf8')).join('\n');
  assert.equal(all.includes(syntheticSecret), false);
  assert.equal(logs.join('\n').includes(syntheticSecret), false);
  assert.equal(JSON.stringify(made).includes(syntheticSecret), false);
  assert.equal(fs.existsSync(path.join(made.output, '문서__secret.md')), false);
});

test('공유 사본은 원본 해시·직접 링크를 보여 주고 원문 변경 뒤에만 갱신된다', t => {
  const { repo, out } = fixture(t);
  const source = 'docs/current.md';
  const doc = path.join(repo, source);
  const row = { brand: 'SYNK', source, target: '정본/current.md', bytes: 10 };
  fs.writeFileSync(doc, '[정책](AI_운영원칙.md)\n원본 v1');
  assert.equal(copy(repo, out, [row]).written, 1);
  const target = path.join(out, 'SYNK/정본/current.md');
  const first = fs.readFileSync(target, 'utf8');
  assert.match(first, /공유 사본/);
  assert.ok(first.includes(sha256(fs.readFileSync(doc))));
  assert.ok(first.includes(path.join(repo, 'docs/AI_운영원칙.md').replace(/\\/g, '/')));
  assert.equal(copy(repo, out, [row]).unchanged, 1);
  fs.writeFileSync(doc, '원본 v2');
  assert.equal(copy(repo, out, [row]).written, 1);
  const second = fs.readFileSync(target, 'utf8');
  assert.ok(second.includes(sha256(fs.readFileSync(doc))));
  assert.notEqual(first, second);
});

test('원격에 없는 로컬 새 문서도 원문·관련 링크는 실제 작업 파일을 가리킨다', t => {
  const { repo, out } = fixture(t);
  const source = 'docs/새 마케팅 정본.md';
  fs.writeFileSync(path.join(repo, source), '[관련 원문](AI_운영원칙.md)\n원격에 아직 없는 최신 내용');
  const row = { brand: 'SYNK', source, target: '정본/새 문서.md', bytes: 10 };
  copy(repo, out, [row]);
  const shared = fs.readFileSync(path.join(out, 'SYNK/정본/새 문서.md'), 'utf8');
  const local = path.join(repo, source).replace(/\\/g, '/');
  assert.ok(shared.includes(`[이 컴퓨터의 작업 원문](<${local}>)`));
  assert.ok(shared.includes(`[관련 원문](<${path.join(repo, 'docs/AI_운영원칙.md').replace(/\\/g, '/')}>`));
  assert.ok(shared.includes(sha256(fs.readFileSync(path.join(repo, source)))));
  assert.match(shared, /보조: \[GitHub 게시본\].*일치를 확인하지 않았으며/);
  assert.doesNotMatch(shared, /\[저장소 원문\]\(https:\/\/github/);
  assert.doesNotMatch(shared, /\[관련 원문\]\(https:\/\/github/);
});

test('최신 묶음 조회는 날짜·파일 시각 대신 원본 해시와 당일 재생성의 전체 시각을 대조한다', t => {
  const { repo, out } = fixture(t);
  const doc = path.join(repo, 'docs/current.md');
  fs.writeFileSync(doc, '원본 v1');
  const first = generate({ repo, out, now: new Date('2026-09-09T01:00:00Z'), log: () => {} });
  let state = geminilmSection({ repo, dir: out });
  assert.equal(state.unknown, false);
  assert.deepEqual(state.changed, []);
  fs.writeFileSync(doc, '원본 v2');
  // 옛 시각으로 돌려도 내용을 바꾼 사실을 놓치면 안 된다.
  fs.utimesSync(doc, new Date('2020-01-01Z'), new Date('2020-01-01Z'));
  state = geminilmSection({ repo, dir: out });
  assert.deepEqual(state.changed, ['docs/current.md']);
  assert.match(geminilmFinding(state).kind, /낡음/);
  const second = generate({ repo, out, now: new Date('2026-09-09T02:00:00Z'), log: () => {} });
  // 첫 폴더의 파일시각을 더 나중으로 바꿔도 생성정보의 시각을 따른다.
  fs.utimesSync(first.output, new Date('2030-01-01Z'), new Date('2030-01-01Z'));
  state = geminilmSection({ repo, dir: out });
  assert.equal(state.folder, second.output);
  assert.deepEqual(state.changed, []);
  assert.equal(geminilmFinding(state), null);
  fs.unlinkSync(doc);
  fs.writeFileSync(path.join(repo, 'docs/new.md'), '새 원본');
  assert.deepEqual(geminilmSection({ repo, dir: out }).changed, ['docs/current.md', 'docs/new.md']);
});

for (const damage of ['manifest-truncated', 'manifest-missing', 'document-truncated', 'readme-truncated', 'document-missing']) {
  test(`깨진 최신 생성본을 이전 정상본으로 감추지 않는다: ${damage}`, t => {
    const { repo, out } = fixture(t);
    generate({ repo, out, now: new Date('2026-09-09T01:00:00Z'), log: () => {} });
    const newer = generate({ repo, out, now: new Date('2026-09-09T02:00:00Z'), log: () => {} });
    const manifest = path.join(newer.output, '생성정보.json');
    const document = path.join(newer.output, '문서__AI_운영원칙.md');
    if (damage === 'manifest-truncated') fs.writeFileSync(manifest, '{"schema":1');
    if (damage === 'manifest-missing') fs.unlinkSync(manifest);
    if (damage === 'document-truncated') fs.writeFileSync(document, '일부');
    if (damage === 'readme-truncated') fs.writeFileSync(path.join(newer.output, 'README_먼저읽기.md'), '일부');
    if (damage === 'document-missing') fs.unlinkSync(document);
    const state = geminilmSection({ repo, dir: out });
    assert.equal(state.unknown, true);
    assert.match(geminilmFinding(state).kind, /미확인/);
  });
}

test('동일한 생성 시각의 다른 원본과 해시 없는 옛 폴더를 최신으로 단정하지 않는다', t => {
  const { repo, out } = fixture(t);
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, 'README_먼저읽기.md'), '만든 날 2026-09-09');
  assert.equal(geminilmSection({ repo, dir: out }).unknown, true);
  fs.writeFileSync(path.join(repo, 'docs/current.md'), '원본 v1');
  const now = new Date('2026-09-09T03:00:00Z');
  generate({ repo, out, now, log: () => {} });
  fs.writeFileSync(path.join(repo, 'docs/current.md'), '원본 v2');
  generate({ repo, out, now, log: () => {} });
  const state = geminilmSection({ repo, dir: out });
  assert.equal(state.unknown, true);
  assert.match(state.reason, /같은 생성 시각/);
});
