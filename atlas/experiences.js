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
    if (!plan || plan.status !== 'ready') return { title: '연습 설정을 확인해 주세요', description: '현재 조건에 맞는 연습이 없습니다. 분량이나 도움 방식을 바꿔 주세요.' };
    const pace = plan.selected.pace;
    const independent = plan.support === 'independent';
    const single = pace === 'short' || plan.support === 'step';
    return {
      title: independent ? '먼저 쓰고, 필요할 때 점검하기' : single ? '한 항목부터 글 점검하기' : pace === 'deep' ? '다른 표현까지 비교하기' : '내용·높임말·요청 기간 점검하기',
      description: independent ? '먼저 메일을 써 보세요. 글을 다듬는 단계에서 점검 항목을 직접 열 수 있습니다.' : single ? '메일을 쓴 뒤 점검 항목을 한 개부터 보여드립니다. 나머지 항목도 원할 때 열 수 있습니다.' : pace === 'deep' ? '메일을 점검한 뒤, 한 문장을 다른 표현으로 바꿔 뜻과 말투를 비교해 보세요.' : '메일을 쓴 뒤, 부탁할 내용과 정중한 표현, 요청한 기간이 잘 드러나는지 확인합니다.',
      focus: letterFocus(plan.focus),
      reason: plan.reasons.includes('time.short') ? '‘짧게 연습하기’를 선택한 설정입니다.' : plan.reasons.includes('feedback.too_much') ? '지난 연습에서 확인할 내용이 많았다는 답변을 반영했습니다.' : plan.reasons.includes('feedback.want_more') ? '지난 연습에서 더 연습하고 싶다는 답변을 반영했습니다.' : '아래에서 연습 분량과 도움 방식을 바꿀 수 있습니다.',
    };
  }
  return { modesFor, letterFocus, guidance };
});
