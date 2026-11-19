// flow 묶음의 받침: 새 순간 맞춤(src/flow — 변형 실행기가 사본을 시험할 수 있게 test/support/subject.mjs로)과,
// 대조에 쓰는 옛 모듈(저장소 뿌리 atlas/의 CommonJS — 고치지 않고 읽기만 한다)을 부른다.
import { createRequire } from 'node:module';
import path from 'node:path';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';

const require = createRequire(import.meta.url);
const REPO = path.resolve(PACKAGE_ROOT, '..', '..');

export const legacy = name => require(path.join(REPO, 'atlas', name));
export const Flow = await subject('flow/index.mjs');

export const NOW = '2026-10-02T09:00:00.000Z';
export const later = (days, from = NOW) =>
  new Date(Date.parse(from) + days * 86_400_000).toISOString();
export const play = (run, outcomes) =>
  outcomes.map(o => run.observe(typeof o === 'string' ? { outcome: o } : o));
export const steps = run => run.intro().opening.map(c => [c.because, c.knob, c.from, c.to]);
export const reasons = run => run.intro().opening.map(change => change.because);

// 씨앗을 고정한 의사 난수(옛 시험 atlas-flow.test.js의 선형 합동과 같은 꼴).
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
