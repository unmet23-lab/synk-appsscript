/* Reviewed action choices, not inferred personality or automatic assessment. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAtlasExperiences = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const modes = [
    { id: 'brief', pace: 'short', minutes: 5, goals: ['clarity'], requiresAudio: false },
    { id: 'balanced', pace: 'standard', minutes: 10, goals: ['study', 'prepare'], requiresAudio: false },
    { id: 'extended', pace: 'deep', minutes: 15, goals: ['expression', 'work'], requiresAudio: false },
  ];
  const modesFor = domain => {
    // This is a LAB writing experience. A shared engine does not make this
    // catalogue applicable to a company's work, a cultural work or a career plan.
    if (domain !== 'LAB') throw new TypeError('Only the LAB letter adapter is implemented');
    return modes.map(mode => ({ ...mode, goals: [...mode.goals] }));
  };
  const letterFocus = goal => ({
    work: '상대가 다음에 무엇을 하면 되는지 분명하게 써 보세요.',
    clarity: '부탁하는 일과 필요한 날짜가 드러나는지 살펴보세요.',
    expression: '상대와의 관계에 맞는 정중한 표현을 골라 보세요.',
    prepare: '이 상황에서 꼭 전달해야 할 사실부터 정리해 보세요.',
    study: '직접 쓴 뒤, 전달하려던 뜻이 글에 담겼는지 확인해 보세요.',
    explore: '먼저 내 방식으로 써 보고, 필요한 도움을 골라 보세요.',
  }[goal] || '먼저 내 방식으로 써 보고, 필요한 도움을 골라 보세요.');
  function guidance(plan) {
    if (!plan || plan.status !== 'ready') return { title: '지금 가능한 방식으로', description: '조건에 맞는 경험을 고르거나 설정을 바꿀 수 있어요.' };
    const pace = plan.selected.pace;
    return {
      title: pace === 'short' ? '핵심부터 한 번' : pace === 'deep' ? '다른 표현까지 살펴보기' : '쓰고, 살펴보고, 다듬기',
      description: plan.support === 'independent' ? '먼저 혼자 써 보고, 확인할 부분은 원할 때 열어 보세요.' : pace === 'short' ? '전달할 내용을 먼저 쓰고, 가장 중요한 부분부터 확인해요.' : pace === 'deep' ? '한 번 다듬은 뒤 다른 표현도 생각해 보세요.' : '내 생각대로 써 본 뒤, 필요한 부분을 골라 다듬어요.',
      focus: letterFocus(plan.focus),
      reason: plan.reasons.includes('time.short') ? '이번에 고른 짧은 시간에 맞췄어요.' : plan.reasons.includes('feedback.too_much') ? '지난번에 양이 많다고 알려줘서 핵심부터 보도록 바꿨어요.' : plan.reasons.includes('feedback.want_more') ? '지난번에 더 해 보고 싶다고 알려줘서 한 번 더 살펴볼 자리를 준비했어요.' : '원하는 방향과 도움 방식을 언제든 바꿀 수 있어요.',
    };
  }
  return { modesFor, letterFocus, guidance };
});
