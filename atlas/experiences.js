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
  const onlyLab = domain => {
    // This is a LAB writing experience. A shared engine does not make this
    // catalogue applicable to a company's work, a cultural work or a career plan.
    if (domain !== 'LAB') throw new TypeError('Only the LAB letter adapter is implemented');
  };
  const modesFor = domain => { onlyLab(domain); return modes.map(mode => ({ ...mode, goals: [...mode.goals] })); };
  // What the letter adapter lets Atlas change. The task, the text the person wrote, the review
  // result and what a check means are not levers. A need or a due review is only ever reported
  // from a correction a person confirmed; the on-screen gauge and self-checks are not a score.
  const levers = [
    { id: 'core.focus', engine: 'core', class: 'content', options: [
      { id: 'purpose', goals: ['prepare', 'work', 'study'], targets: ['need:letter.purpose', 'due:letter.purpose'] },
      { id: 'tone', goals: ['expression'], targets: ['need:honorific', 'due:honorific', 'need:letter.tone', 'due:letter.tone'] },
      { id: 'clarity', goals: ['clarity'], targets: ['need:letter.deadline', 'due:letter.deadline'] }] },
    { id: 'vellum.checks', engine: 'vellum', class: 'shape', follows: 'support', default: 'choose', learn: true, options: [
      { id: 'choose', targets: ['trait:prefers.all_checks'] },
      { id: 'step', targets: ['trait:prefers.one_check'] },
      { id: 'independent', targets: ['trait:prefers.write_first'] }] },
  ];
  const leversFor = domain => { onlyLab(domain); return JSON.parse(JSON.stringify(levers)); };
  const letterFocus = goal => ({
    work: '상대가 다음에 무엇을 하면 되는지 분명하게 써 보세요.',
    clarity: '부탁하는 일과 필요한 날짜가 드러나는지 살펴보세요.',
    expression: '상대와의 관계에 맞는 정중한 표현을 골라 보세요.',
    prepare: '이 상황에서 꼭 전달해야 할 사실부터 정리해 보세요.',
    study: '직접 쓴 뒤, 전달하려던 뜻이 글에 담겼는지 확인해 보세요.',
    explore: '먼저 내 방식으로 써 보고, 필요한 도움을 골라 보세요.',
  }[goal] || '먼저 내 방식으로 써 보고, 필요한 도움을 골라 보세요.');
  const firstCheck = {
    purpose: '부탁하는 내용이 글에 분명히 드러나는지부터 살펴봅니다.',
    tone: '상대에게 맞는 정중한 표현을 썼는지부터 살펴봅니다.',
    clarity: '필요한 날짜와 기간이 글에 드러나는지부터 살펴봅니다.',
  };
  // Sentences state what is on record. They do not grade the person or promise an effect.
  const known = {
    'need:honorific': '최근 교정에서 높임말을 다시 볼 필요가 있었습니다.',
    'need:letter.tone': '최근 교정에서 말투를 상대에 맞게 다듬을 필요가 있었습니다.',
    'need:letter.deadline': '최근 교정에서 요청 기간이 빠진 적이 있었습니다.',
    'need:letter.purpose': '최근 교정에서 부탁하는 내용이 분명하지 않은 적이 있었습니다.',
    'due:honorific': '높임말을 다시 연습할 때가 되었습니다.',
    'due:letter.tone': '상대에 맞는 말투를 다시 연습할 때가 되었습니다.',
    'due:letter.deadline': '요청 기간 쓰기를 다시 연습할 때가 되었습니다.',
    'due:letter.purpose': '부탁하는 내용 쓰기를 다시 연습할 때가 되었습니다.',
    'trait:prefers.all_checks': '점검 항목을 한꺼번에 여는 일이 많았습니다.',
    'trait:prefers.one_check': '점검 항목을 하나씩 보는 일이 많았습니다.',
    'trait:prefers.write_first': '먼저 혼자 쓴 뒤에 점검을 여는 일이 많았습니다.',
  };
  // Seen once or twice is said as once or twice.
  const once = {
    'trait:prefers.all_checks': '점검 항목을 한꺼번에 연 적이 있습니다.',
    'trait:prefers.one_check': '점검 항목을 하나씩 본 적이 있습니다.',
    'trait:prefers.write_first': '먼저 혼자 쓴 뒤에 점검을 연 적이 있습니다.',
  };
  const said = {
    goal: { label: '이번에 집중할 것', explore: '직접 써 보며 정하기', study: '내 글을 읽고 고치기', work: '일에 쓰는 글', clarity: '내용을 분명하게', expression: '정중한 표현', prepare: '전달할 사실 정리' },
    time: { label: '연습 분량', short: '짧게', standard: '기본', unlimited: '충분히' },
    support: { label: '도움 방식', choose: '필요한 도움 고르기', step: '하나씩 살펴보기', independent: '먼저 혼자 해 보기' },
    audio: { label: '소리', off: '끄기', available: '사용 가능' },
  };
  function guidance(plan) {
    if (!plan || plan.status !== 'ready') return { title: '연습 설정을 확인해 주세요', description: '현재 조건에 맞는 연습이 없습니다. 분량이나 도움 방식을 바꿔 주세요.' };
    const pace = plan.selected.pace;
    const independent = plan.support === 'independent';
    const single = pace === 'short' || plan.support === 'step';
    const focus = plan.bundle?.['core.focus'], checks = plan.bundle?.['vellum.checks'], reasons = [];
    if (plan.reasons.includes('arm.baseline')) reasons.push('이번 회차는 기본 구성으로 진행합니다. 아래에서 연습 분량과 도움 방식을 바꿀 수 있습니다.');
    if (plan.reasons.includes('time.short')) reasons.push('‘짧게 연습하기’를 선택한 설정입니다.');
    else if (plan.reasons.includes('feedback.too_much')) reasons.push('지난 연습에서 확인할 내용이 많았다는 답변을 반영했습니다.');
    else if (plan.reasons.includes('feedback.want_more')) reasons.push('지난 연습에서 더 연습하고 싶다는 답변을 반영했습니다.');
    const line = focus?.basis === 'line' ? focus.reasons.map(reason => known[reason.replace(/^line\./, '')]).find(Boolean) : null;
    if (line) reasons.push(`${line} 그래서 ${firstCheck[focus.option]}`);
    if (checks?.reasons.includes('learned.switch')) reasons.push('지난 연습에서 도움 방식이 맞지 않았다는 답변이 있어 다른 방식으로 준비했습니다.');
    else if (checks?.reasons.includes('learned.works')) reasons.push('지난 연습에서 이 도움 방식이 좋았다는 답변이 있어 같은 방식으로 준비했습니다.');
    else if (checks?.basis === 'line') reasons.push('점검 항목을 보시던 방식에 맞춰 준비했습니다. 아래에서 바꿀 수 있습니다.');
    if (!reasons.length) reasons.push('아래에서 연습 분량과 도움 방식을 바꿀 수 있습니다.');
    return {
      title: independent ? '먼저 쓰고, 필요할 때 점검하기' : single ? '한 항목부터 글 점검하기' : pace === 'deep' ? '다른 표현까지 비교하기' : '내용·높임말·요청 기간 점검하기',
      description: independent ? '먼저 메일을 써 보세요. 글을 다듬는 단계에서 점검 항목을 직접 열 수 있습니다.' : single ? '메일을 쓴 뒤 점검 항목을 한 개부터 보여드립니다. 나머지 항목도 원할 때 열 수 있습니다.' : pace === 'deep' ? '메일을 점검한 뒤, 한 문장을 다른 표현으로 바꿔 뜻과 말투를 비교해 보세요.' : '메일을 쓴 뒤, 부탁할 내용과 정중한 표현, 요청한 기간이 잘 드러나는지 확인합니다.',
      focus: letterFocus(plan.focus),
      first: focus?.option || null,
      reason: reasons[0], reasons,
    };
  }
  // "What I came to know about you": what the person said and what was seen, listed apart.
  // A key this adapter has no sentence for is left out; a raw key is never shown to a person.
  function aboutYou(lines) {
    const out = [];
    for (const line of lines || []) {
      if (line.source === 'declared') {
        const field = line.key.replace(/^declared:/, ''), words = said[field];
        if (words?.[line.value]) out.push({ key: line.key, source: 'said', text: `${words.label}: ${words[line.value]}`, status: line.status, askable: false });
      } else if (known[line.key]) {
        out.push({ key: line.key, source: 'seen', text: (line.sufficiency === 'thin' && once[line.key]) || known[line.key], status: line.status, sure: line.sufficiency !== 'thin', askable: true,
          note: line.status === 'denied' ? '아니라고 답하셔서 반영하지 않습니다.' : line.sufficiency === 'thin' && line.status !== 'confirmed' ? '아직 한두 번 본 것이라 확인 전에는 반영하지 않습니다.' : null });
      }
    }
    return out;
  }
  // A habit is something the person did themselves. The screen reports it at most once a round.
  function notice(session, key) {
    if (!known[`trait:${key}`]) throw new TypeError('Unknown letter habit');
    const n = (session.lines().find(line => line.key === `trait:${key}`)?.n || 0) + 1;
    return session.observe({ kind: 'trait', key, strength: Math.min(1, n / 4), n, assisted: null });
  }
  // G4 applies support only after submission. The questions, answers, order and
  // scoring are not personalization levers; only how much review is open is.
  function documentReview(plan, count, revealed = 1, opened = false) {
    if (!Number.isInteger(count) || count < 0 || !Number.isInteger(revealed) || revealed < 1) throw new TypeError('Invalid review window');
    const support = plan?.support || 'choose';
    const visible = support === 'independent' && !opened ? 0 : support === 'step' ? Math.min(count, revealed) : count;
    return { visible, remaining: count - visible };
  }
  function documentGuidance(plan) {
    const support = plan?.support || 'choose';
    return {
      title: support === 'step' ? '한 문장씩 되돌아보기' : support === 'independent' ? '필요할 때 해설 열기' : '쓴 답과 해설 함께 살펴보기',
      description: support === 'step' ? '해설을 하나씩 열어 볼 수 있어요. 원하면 모두 펼칠 수도 있어요.' : support === 'independent' ? '바꿔 쓴 문장부터 읽어 보고, 준비되면 빈칸 해설을 열어 보세요.' : '빈칸에 쓴 답과 해설을 함께 보며 다시 써 볼 문장을 골라요.',
      reason: '도움 방식은 되돌아보기의 펼침만 바꿔요. 문제와 답은 그대로예요.',
    };
  }
  return { modesFor, leversFor, letterFocus, guidance, aboutYou, notice, documentReview, documentGuidance };
});
