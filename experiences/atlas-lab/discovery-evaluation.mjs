import { createDiscoveryAdapter } from './discovery.mjs';

// Authored synthetic policy checks, not held-out model evaluation or evidence of
// attraction, relationship quality, satisfaction, or real-world effectiveness.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const set = (field, value, required) => ({ kind: 'set', field, value, ...(required === undefined ? {} : { required }) });
const neutral = [set('wants.pace', 'any'), set('wants.plan', 'any')];
export const DISCOVERY_EVALUATION_SCENARIOS = freeze([
  { id: 'ready', title: '밝힌 대화·계획 선호', scenario: 'ready', actions: [], acceptableTopIds: ['candidate-1'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'listen', title: '차분한 응답을 원함', scenario: 'ready', actions: [set('wants.pace', 'listen')], acceptableTopIds: ['candidate-2'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'spontaneous', title: '즉흥적인 약속을 원함', scenario: 'ready', actions: [set('wants.plan', 'spontaneous')], acceptableTopIds: ['candidate-3'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'purpose-open', title: '목적을 대화하며 정하고 싶음', scenario: 'ready', actions: [...neutral, set('wants.relationshipGoal', 'open')], acceptableTopIds: ['candidate-3'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'contact-daily', title: '매일 연락하는 편을 원함', scenario: 'ready', actions: [...neutral, set('wants.contact', 'daily')], acceptableTopIds: ['candidate-2'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'rhythm-variable', title: '활동 시간이 유동적인 편을 원함', scenario: 'ready', actions: [...neutral, set('wants.rhythm', 'variable')], acceptableTopIds: ['candidate-3'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'hard-contact', title: '명시한 연락 필수조건', scenario: 'ready', actions: [...neutral, set('wants.contact', 'daily', true)], acceptableTopIds: ['candidate-2'], eligibleIds: ['candidate-2'] },
  { id: 'hard-unknown', title: '필수 답을 지운 뒤 보류', scenario: 'ready', actions: [set('wants.pace', 'lead', true), { kind: 'clear', field: 'wants.pace' }], acceptableTopIds: [null], eligibleIds: [] },
  { id: 'consent-missing', title: '동의 전 후보 비노출', scenario: 'first', actions: [], acceptableTopIds: [null], eligibleIds: [] },
  { id: 'consent-withdrawn', title: '탐색 동의 철회', scenario: 'ready', actions: [set('consent', false)], acceptableTopIds: [null], eligibleIds: [] },
  { id: 'equal-rank', title: '동일 우선순위는 정답 집합으로 평가', scenario: 'ready', actions: [set('wants.plan', 'any')], acceptableTopIds: ['candidate-1', 'candidate-3'], eligibleIds: ['candidate-1', 'candidate-2', 'candidate-3'] },
  { id: 'skip-current', title: '이번 회차에서 명시적으로 넘김', scenario: 'ready', actions: [{ kind: 'feedback', candidateId: 'candidate-1', reason: 'context', decision: 'skip-current' }], acceptableTopIds: ['candidate-2'], eligibleIds: ['candidate-2', 'candidate-3'] },
]);

export function evaluateDiscovery({ Domain, Ask, Personalization } = {}) {
  const adapter = createDiscoveryAdapter({ Domain, Ask, Personalization });
  const equalIds = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const cases = DISCOVERY_EVALUATION_SCENARIOS.map(scenario => {
    let state = adapter.create(scenario.scenario);
    for (const action of scenario.actions) state = adapter.record(state, action);
    const view = adapter.inspect(state), eligibleIds = view.candidates.filter(person => person.status === 'eligible').map(person => person.id);
    // Both policies reuse the exact same reciprocal eligibility result. The
    // baseline differs only in ordering, not consent or safety requirements.
    const baselineTop = [...eligibleIds].sort()[0] || null;
    const result = topCandidateId => ({ topCandidateId, eligibleIds: [...eligibleIds],
      eligibilityPassed: equalIds(eligibleIds, scenario.eligibleIds),
      authoredPriorityPassed: scenario.acceptableTopIds.includes(topCandidateId),
      selectedEligible: topCandidateId === null || eligibleIds.includes(topCandidateId) });
    const baseline = result(baselineTop), atlas = result(view.topCandidateId);
    return { id: scenario.id, title: scenario.title, expected: { acceptableTopIds: [...scenario.acceptableTopIds], eligibleIds: [...scenario.eligibleIds] },
      baseline, atlas, policyComparable: baseline.eligibilityPassed && atlas.eligibilityPassed,
      changedTop: baseline.topCandidateId !== atlas.topCandidateId };
  });
  const summarize = policy => ({ cases: cases.length, eligibilityPassed: cases.filter(item => item[policy].eligibilityPassed).length,
    authoredPriorityPassed: cases.filter(item => item[policy].authoredPriorityPassed).length,
    selectedIneligible: cases.filter(item => !item[policy].selectedEligible).length });
  return { version: 'discovery-evaluation-1', synthetic: true, authored: true, scope: 'fixed-synthetic-policy-ordering',
    policies: { baseline: '동일한 쌍방 필수조건을 통과한 후보를 고정 ID 순서로 제시', atlas: '동일한 쌍방 필수조건에 명시한 선호와 동등조건 내 노출 분산을 적용' },
    limitations: ['직접 작성한 가상 선언 12개 사례의 제품 규칙 검증이에요.', '실제 프로필·모델 해석·관계 성과·사용자 만족도는 검증하지 않았어요.', '질문 부담이나 실제 추천 효과가 좋아졌다는 근거로 사용할 수 없어요.'],
    summary: { baseline: summarize('baseline'), atlas: summarize('atlas'), changedTop: cases.filter(item => item.changedTop).length,
      comparableCases: cases.filter(item => item.policyComparable).length }, cases };
}
