'use strict';
const fs = require('node:fs'), path = require('node:path');
const { coverage, sha256 } = require('./contract.cjs');

const accountLedger = 'docs/마케팅/sns-계정.json';
const testFile = 'tests/글자검사.test.js';
// SHA-256 of b3be72479162 as checked out with LF or CRLF.
const fixtureHashes = new Set([
  '127480e94d40d03a58917970bbf7f8b88ea6fb93f725a5040bae7a54db7ece04',
  '36d662883aaa0297937db099110ac2835a551f7e1f486ec133ae217e90329aad',
]);

// The S122 fixture's source blob is unchanged throughout the diagnosed commit range.
// The same file runs two other cases, so its process name alone cannot identify this call.
function s122Reader(root, entry) {
  const file = path.resolve(root, testFile);
  if (!entry || path.resolve(entry) !== file) return () => false;
  return () => {
    try {
      const stack = String(new Error().stack);
      return [606, 626, 631].some(line => stack.includes(file + ':' + line + ':'));
    } catch { return false; } // Keep recording the general trace if a stack formatter fails.
  };
}

function sameRows(rows, cases) {
  if (!Array.isArray(rows) || rows.length !== cases.length) return false;
  const expected = new Map(cases.map(row => [row.id, row]));
  return rows.every(row => {
    const wanted = expected.get(row.id);
    return wanted && row.status === 'pass' && row.name === wanted.name && row.file === wanted.file && expected.delete(row.id);
  });
}

function s122TraceOnly(receipt, expected, trace) {
  if (receipt.touchedOutside.length !== 1 || receipt.touchedOutside[0] !== accountLedger ||
      receipt.route !== 'local' || receipt.candidate !== false || receipt.inputsUnchanged !== true ||
      receipt.sourceBefore?.commit !== expected.commit || receipt.sourceBefore.trackedDiff !== sha256('') ||
      !fixtureHashes.has(receipt.sourceBefore.files?.[testFile]) ||
      !coverage(receipt, expected) || !expected.cases.some(row => row.id === 'S122' && row.file === testFile) ||
      !sameRows(receipt.rows, expected.cases)) return false;
  const profiles = new Set(expected.cases.map(row => row.profile));
  if (!Array.isArray(receipt.phases) || receipt.phases.length !== profiles.size || !receipt.phases.every(phase => {
    const cases = expected.cases.filter(row => row.profile === phase.profile);
    return profiles.delete(phase.profile) && phase.ok === true && phase.exitCode === 0 && phase.timedOut === false &&
      Array.isArray(phase.unexpectedFailures) && phase.unexpectedFailures.length === 0 &&
      phase.expected === cases.length && phase.passed === cases.length && sameRows(phase.rows, cases);
  })) return false;
  try {
    const readers = fs.readdirSync(trace);
    return readers.length > 0 && readers.every(name => /^\d+\.s122\.txt$/.test(name));
  } catch { return false; } // Losing a trace write or the folder must never explain a failure.
}

module.exports = { accountLedger, s122Reader, s122TraceOnly };
