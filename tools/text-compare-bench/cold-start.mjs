import { performance } from 'node:perf_hooks';
import { createRustComparison } from './rust.mjs';

const start = performance.now();
const rust = await createRustComparison();
const initialized = performance.now();
const value = rust.compareText('오늘은 자막을 비교합니다.', '오늘 자막을 비교합니다.');
console.log(JSON.stringify({ initializeMs: initialized - start,
  initializeAndFirstCompareMs: performance.now() - start, distance: value.editDistance }));
