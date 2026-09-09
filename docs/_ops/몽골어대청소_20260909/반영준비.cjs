'use strict';
// 이번 40개 교정만 위한 정적 차이 생성기. 소스는 쓰지 않고 apply_patch용 패치를 낸다.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const acorn = require('../../../영상/node_modules/acorn');
const root = path.resolve(__dirname, '../../..');
const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, '교정후보.json'), 'utf8'));
const review = JSON.parse(fs.readFileSync(path.join(__dirname, '최종결과.json'), 'utf8'));
const byId = new Map(review.reviews.map(row => [row.id, row]));
const adjustments = JSON.parse(fs.readFileSync(path.join(__dirname, '최종조정.json'), 'utf8'));
for (const row of adjustments) byId.set(row.id, {...row, evidence: '최종조정.json'});
const grouped = new Map();
const finals = [];
const normalize = raw => raw.replace(/\\n/g, ' ').trim();
for (const row of candidates) {
  const verdict = byId.get(row.id);
  assert(verdict && ['accept', 'revise'].includes(verdict.decision), `미확정 ${row.id}`);
  let finalText = verdict.decision === 'revise' ? verdict.newText : row.newText;
  assert.equal(typeof finalText, 'string');
  // 평가자 출력의 인용부호만 원래 JS 리터럴의 이스케이프 꼴로 되돌린다.
  const oldQuotes = row.oldText.match(/\\*"/g) || [];
  const newQuotes = finalText.match(/\\*"/g) || [];
  assert.equal(oldQuotes.length, newQuotes.length, `인용부호 수 ${row.id}`);
  let quoteIndex = 0;
  finalText = finalText.replace(/\\*"/g, () => oldQuotes[quoteIndex++]);
  assert.deepEqual(finalText.match(/[가-힣ㄱ-ㅣ]+/g), row.oldText.match(/[가-힣ㄱ-ㅣ]+/g), `한국어 학습 예시 변경 ${row.id}`);
  if (row.id !== '0155') assert.deepEqual(finalText.match(/\d+/g), row.oldText.match(/\d+/g), `숫자 변경 ${row.id}`);
  assert.deepEqual(finalText.match(/<[^>]+>/g), row.oldText.match(/<[^>]+>/g), `태그 변경 ${row.id}`);
  const final = {...row, finalText, finalReview: verdict};
  finals.push(final);
  if (finalText === row.oldText) continue;
  for (const loc of row.locations) {
    if (!grouped.has(loc.file)) grouped.set(loc.file, []);
    grouped.get(loc.file).push({...final, line: loc.line});
  }
}
const patches = ['*** Begin Patch'];
const summary = [];
for (const [file, rows] of grouped) {
  assert(/^(Code\.js|엔진_.*\.js|contents_.*\.js)$/.test(file));
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = source.split(/\r?\n/);
  const newLines = lines.slice();
  patches.push(`*** Update File: ${file}`);
  for (const row of rows) {
    const line = lines[row.line - 1];
    assert.equal(newLines[row.line - 1], line, `같은 줄 중복 수정 ${file}:${row.line}`);
    const matches = [...line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].filter(match => normalize(match[2]) === row.oldText);
    assert.equal(matches.length, 1, `원문/줄 드리프트 ${row.id}`);
    const match = matches[0];
    const raw = match[2];
    const chars = []; const offsets = [];
    for (let i = 0; i < raw.length; i++) {
      offsets.push(i);
      if (raw[i] === '\\' && raw[i + 1] === 'n') {chars.push(' '); i++;}
      else chars.push(raw[i]);
    }
    offsets.push(raw.length);
    const expanded = chars.join('');
    const leading = expanded.length - expanded.trimStart().length;
    let prefix = 0;
    while (prefix < row.oldText.length && row.oldText[prefix] === row.finalText[prefix]) prefix++;
    let suffix = 0;
    while (suffix < row.oldText.length - prefix && suffix < row.finalText.length - prefix && row.oldText.at(-1 - suffix) === row.finalText.at(-1 - suffix)) suffix++;
    const start = offsets[leading + prefix];
    const end = offsets[leading + row.oldText.length - suffix];
    const rawNew = raw.slice(0, start) + row.finalText.slice(prefix, row.finalText.length - suffix) + raw.slice(end);
    assert.equal(normalize(rawNew), row.finalText, `정규화 차이 ${row.id}`);
    assert.deepEqual(rawNew.match(/\\./g), raw.match(/\\./g), `이스케이프 변경 ${row.id}`);
    const replacement = match[1] + rawNew + match[1];
    const newLine = line.slice(0, match.index) + replacement + line.slice(match.index + match[0].length);
    newLines[row.line - 1] = newLine;
    patches.push('@@', '-' + line, '+' + newLine);
  }
  const newSource = newLines.join(source.includes('\r\n') ? '\r\n' : '\n');
  const parse = text => acorn.parse(text, {ecmaVersion: 'latest', allowReturnOutsideFunction: true});
  const before = parse(source); const after = parse(newSource);
  let changed = 0;
  function compare(a, b) {
    if (Array.isArray(a)) {assert.equal(a.length, b.length); a.forEach((item, i) => compare(item, b[i])); return;}
    if (a && typeof a === 'object') {
      assert.deepEqual(Object.keys(a), Object.keys(b));
      if (a.type === 'Literal' && !a.regex && a.value !== b.value) {
        assert.equal(typeof a.value, 'string'); assert.equal(typeof b.value, 'string');
        const oldNormalized = normalize(source.slice(a.start + 1, a.end - 1));
        const row = rows.find(row => row.oldText === oldNormalized);
        assert(row, '승인하지 않은 리터럴 변경');
        assert.equal(normalize(newSource.slice(b.start + 1, b.end - 1)), row.finalText);
        changed++;
      }
      for (const key of Object.keys(a)) {
        if (['start', 'end', 'raw'].includes(key) || (a.type === 'Literal' && key === 'value')) continue;
        compare(a[key], b[key]);
      }
      return;
    }
    assert.deepEqual(a, b);
  }
  compare(before, after);
  assert.equal(changed, rows.length);
  summary.push({file, changedStringLiterals: changed, codeStructureUnchanged: true, escapesUnchanged: true});
}
patches.push('*** End Patch');
if (process.argv.includes('--patch')) process.stdout.write(patches.join('\n') + '\n');
else {
  fs.writeFileSync(path.join(__dirname, '교정확정.json'), JSON.stringify(finals, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, '반영차이.patch'), patches.join('\n') + '\n');
  fs.writeFileSync(path.join(__dirname, '정적검증.json'), JSON.stringify({checkedAt: new Date().toISOString(), count: candidates.length, changed: summary.reduce((sum, row) => sum + row.changedStringLiterals, 0), summary}, null, 2) + '\n');
  console.log(JSON.stringify(summary));
}
