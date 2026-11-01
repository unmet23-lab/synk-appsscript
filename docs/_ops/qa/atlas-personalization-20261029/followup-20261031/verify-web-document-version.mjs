// Run against the actual public bundle; never substitute a source build.
// node --test --test-reporter=tap <this file>
// SYNK_SCHEMA_BUNDLE=<platform.js> SYNK_SCHEMA_EXTRACT=<temporary .mjs>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const require = createRequire(import.meta.url);
const locations = [root, process.env.SYNK_TALK_ROOT || path.join(os.homedir(), 'Documents/SYNK-talk')];
const parser = require(require.resolve('@babel/parser', { paths: locations }));
const traverse = require(require.resolve('@babel/traverse', { paths: locations })).default;
assert(process.env.SYNK_SCHEMA_BUNDLE && process.env.SYNK_SCHEMA_EXTRACT, 'Explicit actual bundle and temporary extraction paths required');
const input = path.resolve(process.env.SYNK_SCHEMA_BUNDLE);
const output = path.resolve(process.env.SYNK_SCHEMA_EXTRACT);
assert.notEqual(input, output);
const text = fs.readFileSync(input, 'utf8');
const ast = parser.parse(text, { sourceType: 'module' });
const exports = ['validateMemberUnderstanding', 'updateMemberUnderstanding'];
const targets = new Map(), selected = new Map();
traverse(ast, { FunctionDeclaration(p) {
  if (exports.includes(p.node.id.name)) {
    assert(!targets.has(p.node.id.name), 'Unique compiled function');
    targets.set(p.node.id.name, p);
  }
} });
assert.equal(targets.size, exports.length);
function collect(p) {
  const original = p.node;
  if (selected.has(original.start)) return;
  assert(['FunctionDeclaration', 'VariableDeclarator'].includes(original.type), original.type);
  let expressionPath = p, order = original.start, code;
  if (original.type === 'VariableDeclarator' && !original.init) {
    const assignments = p.scope.getBinding(original.id.name).constantViolations.filter(q =>
      q.isAssignmentExpression() && q.node.operator === '=' && q.node.left.name === original.id.name);
    assert.equal(assignments.length, 1, 'Unique module initializer for ' + original.id.name);
    expressionPath = assignments[0].get('right');
    order = assignments[0].node.start;
    code = 'var ' + original.id.name + '=' + text.slice(expressionPath.node.start, expressionPath.node.end) + ';';
  } else code = (original.type === 'VariableDeclarator' ? 'var ' : '') + text.slice(original.start, original.end) + ';';
  selected.set(original.start, { order, code });
  const capture = q => {
    if (!q.isReferencedIdentifier()) return;
    const binding = q.scope.getBinding(q.node.name);
    if (!binding) return; // Native globals remain native when the extracted ESM runs.
    const n = binding.path.node, within = expressionPath.node;
    if (n.start >= within.start && n.end <= within.end) return;
    collect(binding.path);
  };
  capture(expressionPath);
  expressionPath.traverse({ Identifier: capture });
}
for (const p of targets.values()) collect(p);
const extracted = [...selected.values()].sort((a, b) => a.order - b.order).map(x => x.code).join('\n')
  + '\nexport {' + exports.join(',') + '};\n';
fs.writeFileSync(output, extracted, { flag: 'wx' });
const actual = await import(pathToFileURL(output).href);
const canonical = await import(pathToFileURL(path.join(root, 'experiences/synk-account/src/member-understanding-data.mjs')).href);
const current = require(path.join(root, 'experiences/synk-account/src/member-statement-contract.cjs'));
assert.equal(current.PARSER_VERSION, 'member-statement-ko-13');
const at = '2026-10-29T00:00:00.000Z';
const makeRow = (v, value = '예시가 좋아요') => {
  const p = v === 13 ? current : require(path.join(root, 'experiences/synk-account/src/member-statement-v' + v + '.cjs'));
  return { id: '00000000-0000-4000-8000-00000000000' + (v === 13 ? '2' : '1'),
    parserVersion: p.PARSER_VERSION, text: value, at, confirmedAt: at,
    meanings: p.parseMemberStatement(value).meanings, ...(v >= 2 ? { clarifications: [] } : {}) };
};
const doc = (version, rows) => ({ version, reviews: [], overrides: [], statements: rows });
const outcome = fn => { try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, code: e.code }; } };
test('web rejects a ko13 row labelled as document13', () => {
  assert.throws(() => actual.validateMemberUnderstanding(doc(13, [makeRow(13)])), { code: 'INVALID_PERSONAL_STATE' });
});
for (let v = 1; v <= 13; v++) {
  const row = makeRow(v);
  assert(row.meanings.length > 0);
  for (let document = 2; document <= 14; document++) test(`parser${v} in document${document} agrees with canonical schema`, () => {
    const value = doc(document, [row]);
    assert.deepEqual(outcome(() => actual.validateMemberUnderstanding(value)), outcome(() => canonical.validateMemberUnderstanding(value)));
  });
}
test('frozen12 meanings and IDs survive document13 and explicit promotion to14', () => {
  const old = makeRow(12, '도움받기 전에는 혼자 해 보고 싶어요. 요즘 저는 음악을 좋아해요.');
  assert.equal(old.meanings.find(m => m.value === 'music').id, 'p0');
  assert.equal(current.parseMemberStatement(old.text).meanings.find(m => m.value === 'music').id, 'p1');
  const previous = doc(13, [old]);
  assert.deepEqual(actual.validateMemberUnderstanding(previous), previous);
  const changed = actual.updateMemberUnderstanding(previous, { type: 'statement', value: makeRow(13), replaceId: null }, at);
  assert.equal(changed.version, 14);
  assert.deepEqual(changed.statements.find(s => s.id === old.id), old);
  assert.equal(actual.updateMemberUnderstanding(changed, { type: 'clear' }, at).version, 14);
});
test('empty historical documents stay valid and unknown future documents stay rejected', () => {
  for (let v = 2; v <= 14; v++) assert.deepEqual(actual.validateMemberUnderstanding(doc(v, [])), doc(v, []));
  assert.throws(() => actual.validateMemberUnderstanding(doc(15, [])), { code: 'INVALID_PERSONAL_STATE' });
});
test('duplicate identity and tampered frozen meanings remain rejected', () => {
  const row = makeRow(13);
  assert.throws(() => actual.validateMemberUnderstanding(doc(14, [row, row])), { code: 'INVALID_PERSONAL_STATE' });
  const old = makeRow(12, '도움받기 전에는 혼자 해 보고 싶어요. 요즘 저는 음악을 좋아해요.');
  old.meanings = current.parseMemberStatement(old.text).meanings;
  assert.throws(() => actual.validateMemberUnderstanding(doc(13, [old])), { code: 'INVALID_PERSONAL_STATE' });
});
