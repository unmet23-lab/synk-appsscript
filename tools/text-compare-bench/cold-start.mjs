import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { createRustComparison } from './rust.mjs';

const [expected, observed] = process.argv.includes('--stdin') ? JSON.parse(readFileSync(0, 'utf8')) :
  ['오늘은 자막을 비교합니다.', '오늘 자막을 비교합니다.'];
const start = performance.now();
const rust = await createRustComparison();
const initialized = performance.now();
const value = rust.compareText(expected, observed);
console.log(JSON.stringify({ initializeMs: initialized - start,
  initializeAndFirstCompareMs: performance.now() - start, distance: value.editDistance }));
