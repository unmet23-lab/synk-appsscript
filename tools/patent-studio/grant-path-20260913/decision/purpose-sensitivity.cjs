'use strict';
// Read-only characterization of the existing adapter, not a new patent algorithm.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../../core.cjs');
const { fixture, TARGET, ALT, PRESENT } = require('../lab/fixtures.cjs');
const { compileObservationContracts } = require('../lab/observation-contract.cjs');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, file))).digest('hex');
const rows = [];
for (const texts of [[TARGET, ALT], [TARGET, ALT, PRESENT]]) {
  const initial = fixture({ texts });
  for (const purpose of ['original-performance', 'asr-data']) {
    const state = structuredClone(initial.state);
    state.purpose = purpose;
    const before = JSON.stringify(state);
    const evaluated = core.evaluate(state);
    const proposal = compileObservationContracts(state, { alignments: initial.alignments });
    if (JSON.stringify(state) !== before) throw Error('Read-only analysis changed input');
    rows.push({ texts, sessionPurpose: purpose, selectedAction: evaluated.selectedAction,
      plannerTargets: evaluated.evidencePlan.targets.map(t => t.id),
      contracts: proposal.contracts.map(c => ({ targetIds: c.targetIds, range: c.range,
        candidateTexts: c.candidateTexts, allowedResultKind: c.allowedResultKind,
        witnesses: c.witnesses.map(w => ({ targetId: w.targetId, purpose: w.purpose, skill: w.skill })) })),
      unresolved: proposal.unresolved });
  }
}
const comparisons = [0, 2].map(i => ({ candidateCount: rows[i].texts.length,
  identicalContractMeaning: JSON.stringify(rows[i].contracts) === JSON.stringify(rows[i + 1].contracts),
  plannerTargetsDiffer: JSON.stringify(rows[i].plannerTargets) !== JSON.stringify(rows[i + 1].plannerTargets) }));
const result = { generatedAt: new Date().toISOString(), coreVersion: core.VERSION,
  scope: 'Two authored candidate sets and two session purposes; no audio inference or operational writes',
  sources: Object.fromEntries(['../../core.cjs', '../lab/fixtures.cjs', '../lab/observation-contract.cjs', 'purpose-sensitivity.cjs'].map(f => [f, hash(f)])),
  rows, comparisons,
  interpretation: 'Purpose changes the Core planner target list, but not the existing adapter contract meaning in these examples. No purpose-dependent range reduction demonstrated. Contract identity hashes are not treated as behavior differences. This is not proof that a future design or whole claim lacks inventive step.' };
fs.writeFileSync(path.join(__dirname, 'PURPOSE_SENSITIVITY.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ comparisons, rows: rows.map(r => ({ purpose:r.sessionPurpose, candidates:r.texts.length, plannerTargets:r.plannerTargets, contracts:r.contracts.map(c=>({ targets:c.targetIds,range:c.range,kind:c.allowedResultKind })) })) }));
