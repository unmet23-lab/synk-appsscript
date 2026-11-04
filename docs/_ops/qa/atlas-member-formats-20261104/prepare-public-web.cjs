'use strict';

// Reproduce the reviewed release from the public bundle and the two original Atlas commits.
// Run from a checkout with its normal npm dependencies. The output is an input to tools/공개.js.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const acorn = require('acorn');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '../../../..');
const core = { file: 'atlas/member-understanding.js', commit: 'b5442c2659542a8e1f1a7984bd75e10edc1dd06c' };
const contract = { file: 'atlas/member-understanding-contract.js', commit: '8cc7a4482389cc47cb88e568049b25d30fc1c9ca' };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const releasedBefore = 'e3879c7ae7307e647863f573c691b451af02ac75d0bae06fb80792e01ffd7d83';
const reviewedAfter = 'fc5cd559ba0eb4c2d056de76efd2701e2786f230acf5d38123d51437f7c91f2c';

function positions(text, needle) {
  const result = [];
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) result.push(i);
  return result;
}

function source({ commit, file }, revision) {
  return execFileSync('git', ['-C', root, 'cat-file', 'blob', commit + revision + ':' + file], { encoding: 'utf8' });
}

function compiled(code, charset) {
  return esbuild.transformSync(code, { loader: 'js', target: 'es2022', charset, minifyWhitespace: true, legalComments: 'none' }).code.trim();
}

function namedFunction(code, name) {
  const matches = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id.name === name) matches.push(node);
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }
  visit(acorn.parse(code, { ecmaVersion: 'latest' }));
  assert.equal(matches.length, 1, name);
  return compiled(code.slice(matches[0].start, matches[0].end), 'utf8');
}

function responseOptions(code) {
  const { body } = acorn.parse(code, { ecmaVersion: 'latest' });
  const def = body.flatMap(node => node.declarations || []).find(decl => decl.id.name === 'MEMBER_UNDERSTANDING_FACETS');
  const facet = def.init.arguments[0].properties.find(prop => prop.key.value === 'practice-response');
  const choices = facet.value.arguments[0].properties.find(prop => prop.key.name === 'choices');
  const rows = choices.value.arguments[0];
  const prefix = 'var options=';
  const output = compiled(prefix + code.slice(rows.start, rows.end), 'ascii');
  assert(output.startsWith(prefix) && output.endsWith(';'));
  return output.slice(prefix.length, -1);
}

function prepare(bytes) {
  assert.equal(sha(bytes), releasedBefore, '공개 바탕이 바뀌었다. 현재판과 원천을 다시 대조한다.');
  const before = source(core, '^'), after = source(core, '');
  const oldOptions = responseOptions(source(contract, '^')), newOptions = responseOptions(source(contract, ''));
  const options = JSON.parse(newOptions);
  assert.deepEqual(options.filter(([id]) => id !== 'spoken'), JSON.parse(oldOptions));
  assert.deepEqual(options.filter(([id]) => id === 'spoken'), [['spoken', '말로 답하기']]);
  const changes = [
    ...['observationsOf', 'add'].map(name => ({ file: core.file, copies: 1, old: namedFunction(before, name), next: namedFunction(after, name) })),
    { file: contract.file, copies: 2, old: oldOptions, next: newOptions },
  ];
  let candidate = bytes.toString('utf8');
  for (const part of changes) {
    const modules = positions(candidate, JSON.stringify(part.file));
    const hits = positions(candidate, part.old);
    assert.equal(modules.length, part.copies, part.file);
    assert.equal(hits.length, part.copies);
    assert.equal(positions(candidate, part.next).length, 0);
    for (let i = 0; i < hits.length; i++) {
      const end = candidate.indexOf('__commonJS({', modules[i] + part.file.length + 2);
      assert(hits[i] > modules[i] && hits[i] + part.old.length <= end, part.file);
    }
    candidate = candidate.split(part.old).join(part.next);
  }
  const restored = changes.slice().reverse().reduce((text, part) => text.split(part.next).join(part.old), candidate);
  assert(bytes.equals(Buffer.from(restored)), '다른 공개 기능의 바이트가 달라졌다');
  acorn.parse(candidate, { ecmaVersion: 'latest', sourceType: 'module' });
  assert.equal(sha(candidate), reviewedAfter);
  return candidate;
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('node prepare-public-web.cjs <공개 platform.js> <새 후보 파일>');
  const candidate = prepare(fs.readFileSync(input));
  fs.writeFileSync(output, candidate, { flag: 'wx' });
  console.log(sha(candidate));
}
