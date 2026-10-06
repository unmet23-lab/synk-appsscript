#!/usr/bin/env node
// Product-specific saved-request/saved-result utility. Never calls a provider.
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { preparePacket, evaluatePacket } from './learning-blind/evaluation.mjs';
import { buildCases } from './learning-blind/cases.mjs';
import { PROVIDERS, buildRequest, normalizeResponse } from './learning-blind/providers.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'Usage: node tools/learning-blind-test.mjs prepare --out NEW_DIR | evaluate --packet PACKET_DIR --results SAVED_RESULTS.json --out NEW_DIR';
const args = process.argv.slice(2), command = args.shift(), options = {};
try {
  while (args.length) { const flag = args.shift(), value = args.shift(); if (!['--out', '--packet', '--results'].includes(flag) || !value || value.startsWith('--') || Object.hasOwn(options, flag)) throw new Error(usage); options[flag] = value; }
  if (!options['--out'] || !['prepare', 'evaluate'].includes(command)) throw new Error(usage);
  let result;
  if (command === 'prepare') {
    if (options['--packet'] || options['--results']) throw new Error(usage);
    result = await preparePacket({ outDir: options['--out'], caseBundle: buildCases(), providers: PROVIDERS, buildRequest, workspace,
      sourceFiles: ['tools/learning-blind/cases.mjs', 'tools/learning-blind/providers.mjs', 'tools/learning-blind/evaluation.mjs', 'tools/learning-blind-test.mjs'] });
    process.stdout.write(JSON.stringify({ action: 'prepared-only', outDir: result.outDir, caseCount: result.manifest.caseCount, requestCount: result.manifest.recordCount, estimatedUSD: result.costEstimate.estimatedTotalUSD, actualModelResponses: 0 }) + '\n');
  } else {
    if (!options['--packet'] || !options['--results']) throw new Error(usage);
    result = await evaluatePacket({ packetDir: options['--packet'], resultsPath: options['--results'], outDir: options['--out'], providers: PROVIDERS, normalizeResponse });
    process.stdout.write(JSON.stringify({ action: 'evaluated-saved-results-only', outDir: result.outDir, ...result.summary }) + '\n');
  }
} catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
