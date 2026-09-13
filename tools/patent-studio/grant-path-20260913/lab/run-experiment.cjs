'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { compileObservationContracts: compile, applyObservationReceipt: apply } = require('./observation-contract.cjs');
const { fixture, receipt, cells, approvedSyntheticAudio, TARGET, ALT, PRESENT } = require('./fixtures.cjs');
const { applyEvent, VERSION } = require('../../core.cjs');
const audio = approvedSyntheticAudio();
const scenarios = [];
function run(id, title, explain, prepare) {
  const f = fixture({ durationMs: audio.durationMs });
  const context = prepare(f) || f;
  const before = JSON.stringify(context.state);
  const start = performance.now();
  const contract = context.contract || compile(context.state, { alignments: context.alignments }).contracts[0];
  const actual = context.actual || receipt(contract);
  const result = apply(context.state, contract, actual);
  const elapsedMs = performance.now() - start;
  if (JSON.stringify(context.state) !== before) throw Error('Input mutated');
  scenarios.push({ id, title, explain, before: cells(context.state), after: cells(result.state),
    outcome: result.reason, applied: result.ok, contract, receipt: actual,
    changedTargetIds: result.record?.changedTargetIds || [], elapsedMs,
    interpretation: 'Controlled metadata processing. Not actual listening, ASR accuracy, learning benefit or patent odds.' });
}
run('original-review', '처음 원음을 확인했다', '처음 녹음에서 확인했다고 가정한 결과를 적용하면 전사와 조사 기록을 반영합니다. 이미 반영하던 과거형은 그대로입니다.', f => f);
run('new-attempt', '같은 문장을 새로 말했다', '녹음 내용의 해시가 같아도 시도가 다르면 처음 녹음의 확인 계약에 넣을 수 없습니다. 새 응답은 기존 별도 응답 경로의 대상입니다.', f => {
  f.contract = compile(f.state, { alignments: f.alignments }).contracts[0];
  f.actual = receipt(f.contract, { source: { ...f.contract.source, utteranceId: 'response-1', epoch: 'e1' } }); return f;
});
run('stale-plan', '확인하는 사이 새 사건이 생겼다', '계약을 만든 뒤 도움 사건이 추가됐습니다. 예전 계약은 적용하지 않고 바뀐 상태에서 다시 계획해야 합니다.', f => {
  f.contract = compile(f.state, { alignments: f.alignments }).contracts[0];
  f.state = applyEvent(f.state, { id: 'intervening-help', type: 'help-presented', at: '2026-09-13T09:00:30.000Z', text: '목적격 조사는 를', skills: ['object'], exposesAnswer: true }); return f;
});
run('existing-hint', '처음부터 조사 힌트를 받았다', '원음을 확인하면 전사 자료로 사용할 수 있지만, 먼저 받은 조사 도움은 없어지지 않습니다. 처음의 독립적인 조사 사용으로는 반영하지 않습니다.', f => {
  f.state = applyEvent(f.state, { id: 'preceding-help', type: 'help-presented', at: '2026-09-13T08:59:00.000Z', text: '목적격 조사는 를', skills: ['object'], exposesAnswer: true }); return f;
});
run('third-candidate', '세 번째 후보는 끝부분도 다르다', '두 후보의 조사 차이만 듣고 세 번째 후보까지 제거하지 않습니다. 제공된 모든 후보 차이를 감싸는 구간을 계약에 넣습니다.', () => {
  const f = fixture({ durationMs: audio.durationMs, texts: [TARGET, ALT, PRESENT] });
  f.contract = compile(f.state, { alignments: f.alignments }).contracts[0];
  f.actual = receipt(f.contract, { range: { startMs: 0, endMs: 550 } }); return f;
});
run('missing-alignment', '단어의 녹음 위치를 모른다', '위치 자료가 없으면 좁은 구간을 추측하지 않고 원음 전체로 돌아갑니다. 화면의 짧은 구간 수치는 수동으로 만든 시험 정렬일 때만 나옵니다.', f => { f.alignments = []; return f; });

// Strong key/policy baseline with the SAME author-supplied policy inputs.
// Matching results measure routing equivalence, not derivation from prior art.
const targets = [{ audio: 'A', attempt: 'e0', purpose: 'transcript', skill: 'all' },
  { audio: 'A', attempt: 'e0', purpose: 'independent', skill: 'object' },
  { audio: 'B', attempt: 'e1', purpose: 'transcript', skill: 'all' }];
const outcomes = [{ id: 'A-review', audio: 'A', attempt: 'e0', denied: [] },
  { id: 'B-after-hint', audio: 'B', attempt: 'e1', denied: ['independent:object'] },
  { id: 'B-review', audio: 'B', attempt: 'e1', denied: [] }];
const routingPairs = outcomes.flatMap(result => targets.map(target => {
  const baseline = result.audio === target.audio && result.attempt === target.attempt && !result.denied.includes(`${target.purpose}:${target.skill}`);
  const allowedDestinationKeys = targets.filter(t => t.audio === result.audio && t.attempt === result.attempt)
    .filter(t => !new Set(result.denied).has(`${t.purpose}:${t.skill}`)).map(t => JSON.stringify(t));
  return { outcome: result.id, target, baseline, labelledRouting: allowedDestinationKeys.includes(JSON.stringify(target)) };
}));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence = { generatedAt: new Date().toISOString(), coreVersion: VERSION, scope: 'local synthetic contract experiment',
  audio, conditions: ['후보·단어 시각·독립 조건은 수동 시험 입력',
    '기존 합성 WAV의 크기·해시·길이만 실제 파일에서 확인', '학생 자료·외부 API·실제 청취·운영 DB 변경 없음'],
  scenarios, routingComparison: { pairs: routingPairs, equalPairs: routingPairs.filter(p => p.baseline === p.labelledRouting).length,
    conclusion: '동일한 정책을 준 9쌍 귀속 결과는 동일. 출력 우월성 미입증이며 결합 관계의 도출 용이성과는 다른 판단.' },
  sources: Object.fromEntries(['../../core.cjs', 'observation-contract.cjs', 'fixtures.cjs', 'run-experiment.cjs'].map(file => [file, hash(path.join(__dirname, file))])) };
const output = path.join(__dirname, 'RESULTS.json');
fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output, audio: { bytes: audio.bytes, durationMs: audio.durationMs, sha256: audio.sha256 }, scenarios: scenarios.map(s => ({ id: s.id, applied: s.applied, outcome: s.outcome })), equalRoutingPairs: evidence.routingComparison.equalPairs }, null, 2));
