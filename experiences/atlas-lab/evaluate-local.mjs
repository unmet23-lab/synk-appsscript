// Capture actual local-pattern outputs against the independently authored cases.
// This is development regression, not a held-out model benchmark or user trial.
// Run: node experiences/atlas-lab/evaluate-local.mjs
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import content from '../../docs/마케팅/맞춤도구/computer/content.js';
import Interpretation from '../../atlas/interpretation.js';
import { createComputerCatalog, extractComputerProposals, COMPUTER_EXTRACTOR } from './interpretation.mjs';
const datasetUrl = new URL('../../tests/fixtures/atlas-interpretation-cases.json', import.meta.url);
const datasetBytes = await fs.readFile(datasetUrl), dataset = JSON.parse(datasetBytes);
const catalog = createComputerCatalog(content), timings = [];
const runs = dataset.cases.map(item => {
  const start = performance.now(), output = extractComputerProposals({ source: item.source, catalog });
  timings.push({ caseId: item.id, milliseconds: performance.now() - start });
  return { caseId: item.id, output };
});
const directory = new URL('./qa/interpretation-evaluation/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
const outputsUrl = new URL('current-local-outputs.json', directory), reportUrl = new URL('current-local-report.json', directory);
const sourceHash = createHash('sha256').update(await fs.readFile(new URL('./interpretation.mjs', import.meta.url))).digest('hex');
const gate = runs.map((run, index) => {
  const item = dataset.cases[index], scope = { domain: 'SHIFT', workspace: 'authored-evaluation', subject: 'synthetic-case' };
  const result = Interpretation.resolve({ contract: catalog.contract, scope, sources: [{ ...item.source, scope }], proposals: run.output.proposals, reviews: [], at: item.source.at });
  return { caseId: item.id, usableBeforeReview: result.understanding.fields.filter(field => field.usable).length,
    conflictingFields: [...new Set(result.proposals.filter(proposal => proposal.status === 'conflict').map(proposal => proposal.field))] };
});
await fs.writeFile(outputsUrl, JSON.stringify({ version: 1, dataset: { id: dataset.id, version: dataset.version }, mode: 'extractor-output',
  backend: { id: COMPUTER_EXTRACTOR, version: '1', kind: 'local-pattern' }, runs }, null, 2) + '\n');
await fs.writeFile(new URL('capture.json', directory), JSON.stringify({ at: new Date().toISOString(),
  kind: 'authored-development-regression', sourceSha256: sourceHash, datasetSha256: createHash('sha256').update(datasetBytes).digest('hex'),
  sourceInterpretationExecuted: true, modelExecuted: false, networkCalls: 0, externalApiCost: 0, timings, reviewGate: gate,
  limitations: ['Cases were visible during development; agreement is not held-out performance.', 'Times cover only local extraction on this computer, not UI, inference or real-device latency.'] }, null, 2) + '\n');
await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../../tools/evaluate-atlas-interpretation.mjs', import.meta.url)),
  '--outputs', fileURLToPath(outputsUrl), '--report', fileURLToPath(reportUrl)]);
const report = JSON.parse(await fs.readFile(reportUrl));
console.log(JSON.stringify({ report: fileURLToPath(reportUrl), counts: report.counts, claims: report.claims, restraint: report.restraint,
  failed: report.cases.filter(item => !item.passed).map(item => ({ id: item.id, fields: item.fields?.filter(field => !['exact', 'permitted', 'correctly-unasserted'].includes(field.status)) })) }, null, 2));
