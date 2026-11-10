'use strict';
// Atlas 재설계 단계 0의 관문 도구(docs/_ops/qa/atlas-redesign-20261110/단계0/공개대조.cjs 「견줌」)가 산출물과 판정을 모두 견준다 —
// 파일 · 바이트가 같아도 참조 수 · 빠진 참조 · 도구 이름 · 원천 변경 · ok 가운데 하나라도 다르면 「같다」가 아니고 끝 코드 1이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TOOL = path.join(__dirname, '..', 'docs', '_ops', 'qa', 'atlas-redesign-20261110', '단계0', '공개대조.cjs');
const base = {
  commit: 'a'.repeat(40), config: 'world-config.json', ok: false, fileCount: 1, totalBytes: 3, referenceCount: 1377,
  missing: [{ from: 'me2-photo.mjs', reference: './vendor/face-api/', reason: 'missing' }], publicToolNames: [], sourceChanges: [],
  files: [{ path: 'index.html', bytes: 3, sha256: 'b'.repeat(64) }],
};

function compare(before, after) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-public-compare-'));
  const write = (name, record) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(record));
    return file;
  };
  const run = spawnSync(process.execPath, [TOOL, '견줌', write('a.json', before), write('b.json', after)], { encoding: 'utf8' });
  return { status: run.status, verdict: JSON.parse(run.stdout) };
}

test('산출물과 판정이 모두 같으면 같다', () => {
  const { status, verdict } = compare(base, { ...base, commit: 'c'.repeat(40) });
  assert.equal(status, 0);
  assert.equal(verdict.identical, true);
});

test('참조 수 · 빠진 참조 · 도구 이름 · 원천 변경 · ok 가운데 하나만 달라도 같지 않다', () => {
  const variants = {
    referenceCount: { referenceCount: 1376 },
    missing: { missing: [] },
    publicToolNames: { publicToolNames: [{ path: 'a.js', match: 'x' }] },
    sourceChanges: { sourceChanges: ['tools/x.mjs'] },
    ok: { ok: true },
  };
  for (const [name, change] of Object.entries(variants)) {
    const { status, verdict } = compare(base, { ...base, ...change });
    assert.equal(status, 1, name);
    assert.equal(verdict.identical, false, name);
  }
});

test('파일이 더해지거나 바이트가 바뀌면 같지 않다', () => {
  const added = compare(base, { ...base, fileCount: 2, files: [...base.files, { path: 'x.js', bytes: 1, sha256: 'd'.repeat(64) }] });
  assert.deepEqual(added.verdict.added, ['x.js']);
  assert.equal(added.status, 1);
  const changed = compare(base, { ...base, files: [{ ...base.files[0], sha256: 'e'.repeat(64) }] });
  assert.deepEqual(changed.verdict.changed, ['index.html']);
  assert.equal(changed.status, 1);
});
