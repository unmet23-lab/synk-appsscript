'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./core.cjs');

// Authored fixture expansion measures local rule evaluation only. It makes no
// external requests and does not measure recognizer or student outcomes.
const results = [];
for (const responseCount of [0, 10, 100, 1000]) {
  const session = core.createSession({ mode: 'example', exampleId: 'particle-ambiguity', id: 'scale-fixture' });
  session.responses = Array.from({ length: responseCount }, (_, i) => ({
    ...structuredClone(session.original), id: `response-${i + 1}`, epoch: `e${i + 1}`, sequence: i + 1
  }));
  core.evaluate(session);
  const times = [];
  let result;
  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    result = core.evaluate(session);
    times.push(Number((performance.now() - start).toFixed(3)));
  }
  results.push({ responseCount, hypotheses: 2 * (responseCount + 1), mainCells: result.cells.length,
    comparisons: result.comparisons.length, milliseconds: times, medianMs: [...times].sort((a, b) => a - b)[1],
    serializedAnalysisBytes: Buffer.byteLength(JSON.stringify(result)) });
}
const report = {
  measuredAt: new Date().toISOString(), node: process.version, coreVersion: core.VERSION,
  coreSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'core.cjs'))).digest('hex'),
  scope: 'Generated controlled fixtures; local full rule evaluation with four comparisons. No audio, database, network, concurrent users or learning outcome benchmark.',
  results
};
const dir = path.join(__dirname, 'qa-output');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'benchmark.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
