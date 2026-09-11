'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./core.cjs');
const { digest } = require('./projection.cjs');
const clean = result => { const { projectionCache, computation, ...rest } = result; return rest; };
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
function run() {
  const start = Date.parse('2026-09-11T00:00:00.000Z');
  const event = (state, type, fields) => core.applyEvent(state, { id: `event-${state.revision + 1}`, type,
    at: new Date(start + (state.revision + 1) * 1000).toISOString(), ...fields });
  let state = core.createSession({ id: 'controlled-scale-40', createdAt: new Date(start).toISOString() });
  for (let i = 0; i < 40; i++) {
    state = event(state, 'audio-attached', { role: 'response', responseId: `scale-${i}`, audioRef: `local:authored-${i}.wav` });
    state = event(state, 'review-response', { responseId: `scale-${i}`, text: core.TARGET, confirmed: true, performanceTimeConfirmed: true, exposureScopeConfirmed: true });
  }
  const previous = core.evaluate(state);
  state = event(state, 'review-response', { responseId: 'scale-20', text: '친구가 만나서 카페에 갔어요', confirmed: true, performanceTimeConfirmed: true });
  const incremental = core.evaluate(state, { previousProjection: previous.projectionCache });
  const full = core.evaluate(state, { forceFull: true });
  if (digest(clean(incremental)) !== digest(clean(full))) throw new Error('Incremental/full projection mismatch');
  const duration = { incremental: [], full: [] };
  for (let i = 0; i < 7; i++) {
    for (const mode of i % 2 ? ['full', 'incremental'] : ['incremental', 'full']) {
      const before = performance.now();
      core.evaluate(state, mode === 'full' ? { forceFull: true } : { previousProjection: previous.projectionCache });
      duration[mode].push(Number((performance.now() - before).toFixed(3)));
    }
  }
  return { schemaVersion: 1, engineVersion: core.VERSION, generatedAt: new Date().toISOString(),
    sourceSha256: Object.fromEntries(['core.cjs', 'projection.cjs', 'projection-benchmark.cjs'].map(name => [name,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, name))).digest('hex')])),
    fixture: { authored: true, realAudioInference: false, utterances: 41, responseCount: 40, changedResponse: 'scale-20',
      cells: full.cells.length, configurations: 5, hypothesisCount: state.original.alternatives.length + state.responses.reduce((n, r) => n + r.alternatives.length, 0) },
    semanticResultsEqual: true, resultSha256: digest(clean(full)),
    full: full.computation, incremental: incremental.computation,
    timing: { trials: 7, unit: 'ms', ...duration, incrementalMedian: median(duration.incremental), fullMedian: median(duration.full) },
    complexity: { C: '발화별 사용처·능력·시점 셀 수', H: '기록된 도움 사건 수', K: '셀당 지원 해석 후보 수',
      comparisonAndLookup: 'O(C): 셀 비교와 응답 조회는 Map 인덱스 사용',
      inputAndProjection: 'O(C × (H + K)): 입력 지문과 도움 구간 확인은 매 실행 수행; 캐시 적중은 효과 판정 함수만 재사용',
      storage: '판본별 전환 원장은 판본마다 O(C) 저장. 세션 전체 상태·지문 검사 비용은 별도',
      scope: '통제 합성 사건열의 현재 기계 측정. 일반적 속도 향상률·AI 정확도·특허 등록 가능성의 측정값이 아님' } };
}
if (require.main === module) {
  const result = run();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ engineVersion: result.engineVersion, fixture: result.fixture,
    fullEvaluations: result.full.evaluatedCells, selectiveEvaluations: result.incremental.evaluatedCells,
    reusedPrevious: result.incremental.reusedPreviousCells, semanticResultsEqual: result.semanticResultsEqual,
    timing: result.timing }, null, 2) + '\n');
}
module.exports = { run };
