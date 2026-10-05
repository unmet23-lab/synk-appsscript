#!/usr/bin/env node
// Offline scoring only. This CLI never calls or launches an extractor/model.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Temper from '../atlas/temper-interpretation.js';

const usage = `Usage: node tools/evaluate-atlas-interpretation.mjs [--dataset FILE] [--outputs FILE] [--baseline FILE] [--report FILE]
Saved outputs: {version:1,dataset:{id,version},mode:"extractor-output"|"proposal-replay",
 backend:{id,version,kind:"local-pattern"|"model"|"manual-replay"},runs:[{caseId,output:{proposals,held?,extractor?}}]}
Omitting --outputs reports every authored case as not_run. No extraction or network request is performed.
Dataset expected.facts are required; expected.permittedFacts are optional supported additions and do not change required-field recall.
Proposal evidence uses UTF-16 start/end offsets, with an exclusive end, matching JavaScript String.slice.`;
const args = process.argv.slice(2), options = {};
try {
  if (args.includes('--help')) { console.log(usage); process.exit(0); }
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--dataset', '--outputs', '--baseline', '--report'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--') || options[flag]) throw Error(usage);
    options[flag] = args[i + 1];
  }
  const readJSON = async path => {
    const bytes = await readFile(path);
    if (bytes.length > 10000000) throw Error('Evaluation input exceeds 10 MB.');
    return { value: JSON.parse(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  const datasetPath = options['--dataset'] ? resolve(options['--dataset']) : fileURLToPath(new URL('../tests/fixtures/atlas-interpretation-cases.json', import.meta.url));
  const dataset = await readJSON(datasetPath), supplied = options['--outputs'] ? await readJSON(resolve(options['--outputs'])) : null;
  if (options['--baseline'] && !supplied) throw Error('--baseline requires candidate --outputs.');
  const baseline = options['--baseline'] ? await readJSON(resolve(options['--baseline'])) : null;
  for (const file of [supplied, baseline].filter(Boolean)) if (file.value?.version !== 1 || file.value.dataset?.id !== dataset.value.id || file.value.dataset?.version !== dataset.value.version) throw Error('Saved outputs do not match the requested dataset id/version.');
  const input = supplied?.value || { mode: 'extractor-output', backend: { id: 'unprovided', version: 'unprovided', kind: 'not-run' }, runs: [] };
  const report = Temper.evaluateInterpretations({ dataset: dataset.value, runs: input.runs, backend: input.backend, mode: input.mode });
  const baselineReport = baseline ? Temper.evaluateInterpretations({ dataset: dataset.value, runs: baseline.value.runs, backend: baseline.value.backend, mode: baseline.value.mode }) : null;
  const result = { ...report, ...(baselineReport ? { comparison: Temper.compareInterpretations({ baseline: baselineReport, candidate: report }) } : {}),
    evaluatedAt: new Date().toISOString(), inputs: { datasetSha256: dataset.sha256, outputsSha256: supplied?.sha256 || null, baselineSha256: baseline?.sha256 || null },
    evaluatorExecution: { extractionPerformed: false, networkCalls: 0, externalApiCost: 0 } };
  const json = JSON.stringify(result, null, 2) + '\n';
  if (options['--report']) {
    const path = resolve(options['--report']);
    if ([datasetPath, options['--outputs'] && resolve(options['--outputs']), options['--baseline'] && resolve(options['--baseline'])].includes(path)) throw Error('Report must not overwrite evaluation input.');
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, json, 'utf8');
    console.log(JSON.stringify({ report: path, status: result.status, mode: result.mode, counts: result.counts }));
  } else console.log(json.trimEnd());
} catch (error) { console.error(error.message); process.exitCode = 1; }
