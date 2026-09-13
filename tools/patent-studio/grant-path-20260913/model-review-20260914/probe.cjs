'use strict';
// Reuses the saved authored P1 input. No microphone, audio read, DB or network.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const base = path.resolve(__dirname, '..');
const core = require('../../core.cjs');
const projection = require('../../projection.cjs');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = Object.fromEntries(['../core.cjs', '../projection.cjs', '../temporal-evidence.cjs', '../observation-planner.cjs', 'decision/P1_SUPPORT_CASES.json'].map(f => [f, sha(path.resolve(base, f))]));
const input = JSON.parse(fs.readFileSync(path.join(base, 'decision/P1_SUPPORT_CASES.json'), 'utf8'));
for (const [file, expected] of Object.entries(input.sources)) {
  if (sha(path.resolve(base, 'decision', file)) !== expected) throw Error('Saved P1 source changed: ' + file);
}
let state = core.createSession(input.baselineInput.initialOptions);
for (const row of input.baselineInput.preparation) state = core.applyEvent(state, row.event);
const engineKey = projection.digest(sources);
const first = core.evaluate(state, { engineKey });
const event = input.cases[0].inputEventsAfterBaseline[0].event;
const next = core.applyEvent(state, event);
const cached = core.evaluate(next, { engineKey, previousProjection: first.projectionCache });
const full = core.evaluate(next, { engineKey, forceFull: true });
const ledger = projection.buildLedgerEntry({ beforeCells: first.cells, afterCells: cached.cells, event,
  fromRevision: state.revision, toRevision: next.revision, engineKey });
const same = projection.canonical(cached.cells) === projection.canonical(full.cells);
const record = {
  generatedAt: new Date().toISOString(), runtime: process.version, sources,
  scope: 'One authored synthetic late-help case; no microphone/audio file/DB/network; not a benchmark',
  cellResultsMatchFull: same,
  transitions: ledger.transitions.map(t => ({ cell: t.cellId, action: t.action })),
  asrInvalidations: cached.computation.invalidated.filter(e => e.key.includes(':asr')).map(e => ({ key: e.key, changedInputs: e.changedInputs })),
  computation: cached.computation,
};
if (!same || !record.asrInvalidations.length || !record.transitions.some(t => t.cell === 'e0:asr' && t.action === 'retained')) throw Error('Expected counterexample not reproduced');
fs.writeFileSync(path.join(__dirname, 'CACHE_PROBE.json'), JSON.stringify(record, null, 2));
console.log(JSON.stringify({ cellResultsMatchFull: same, transitions: record.transitions, asrInvalidations: record.asrInvalidations.length }));
