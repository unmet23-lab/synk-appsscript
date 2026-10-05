import { createMatchingAdapter, MATCHING_SCENARIOS } from './matching.mjs';

// Fictional, in-memory demonstration. No account, persistence or messaging API.
export function mountMatchingLab({ root = document, Domain, Ask, TemperOutcomes }) {
  const adapter = createMatchingAdapter({ Domain, Ask, TemperOutcomes });
  const find = id => root.getElementById(id);
  const make = (tag, text, className) => {
    const node = root.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let state = adapter.create('ready'), history = [];
  const button = (label, action, { disabled = false, key } = {}) => {
    const node = make('button', label, 'slab');
    node.type = 'button'; node.disabled = disabled;
    if (key) node.dataset.matchAction = key;
    node.addEventListener('click', action);
    return node;
  };
  function act(event, label) {
    try {
      state = adapter.record(state, event);
      history.push(label); find('matching-feedback').textContent = label;
      render();
    } catch {
      find('matching-feedback').textContent = '현재 조건에서는 이 단계를 진행할 수 없어요. 두 사람의 조건과 의향을 다시 확인해 주세요.';
    }
  }
  function select(id) {
    state = adapter.create(id); history = [];
    find('matching-feedback').textContent = '가상 사례를 처음 상태로 열었어요.'; render();
  }
  function render() {
    const view = adapter.inspect(state);
    find('matching-scenarios').replaceChildren(...MATCHING_SCENARIOS.map(scenario => {
      const node = button(scenario.title, () => select(scenario.id));
      node.dataset.matchScenario = scenario.id;
      node.setAttribute('aria-pressed', String(view.scenario.id === scenario.id)); return node;
    }));
    find('matching-scenario-note').textContent = view.scenario.description;
    find('matching-status').textContent = view.eligibility.label;
    find('matching-detail').textContent = view.mutual.label;
    const names = Object.fromEntries(view.participants.map(person => [person.id, person.label]));
    find('matching-checks').replaceChildren(...view.eligibility.checks.map(check =>
      make('li', `${names[check.owner]}의 조건 · ${check.label}: ${check.reason}`)));
    find('matching-people').replaceChildren(...view.participants.map(person => {
      const card = make('article', '', 'matching-person'); card.dataset.matchPerson = person.id;
      card.append(make('h3', person.label));
      const facts = make('dl');
      for (const fact of person.facts) facts.append(make('dt', fact.label), make('dd', fact.usable ? fact.valueLabel : '아직 확인하지 않았어요'));
      facts.append(make('dt', '소개에 사용할 동의'), make('dd', person.consent.value === true ? '동의했어요' : person.consent.value === false ? '동의하지 않아요' : '아직 확인하지 않았어요'));
      const intentLabels = { unanswered: '아직 답하지 않았어요', accept: '만나 보고 싶어요', decline: '이번 소개는 넘길게요', withdraw: '앞선 의향을 철회했어요' };
      facts.append(make('dt', '현재 만남 의향'), make('dd', intentLabels[person.intent.value]));
      facts.append(make('dt', '현재 소개 확인'), make('dd', person.delivered ? '소개를 봤어요' : view.round && !view.round.active ? '새 소개가 필요해요' : '아직 소개를 보지 않았어요'));
      const previouslyDelivered = view.tracking.historicalResultDeliveries.some(event => event.person === person.id);
      facts.append(make('dt', '상호 수락 결과 확인'), make('dd', person.resultDelivered ? '현재 결과를 봤어요' : previouslyDelivered ? '이전 결과를 봤지만 현재 수락을 뜻하지 않아요' : '아직 결과를 보지 않았어요'));
      card.append(facts);
      const actions = make('div', '', 'interpret-actions');
      const active = view.round?.active === true;
      actions.append(button('소개 보기', () => act({ kind: 'deliver', person: person.id }, `${person.label}에게 소개를 보여 줬어요.`),
        { disabled: !active || person.delivered, key: 'deliver' }));
      for (const [value, label] of [['accept', '만나 보고 싶어요'], ['decline', '이번에는 넘길게요'], ['withdraw', '의향 철회']]) {
        actions.append(button(label, () => act({ kind: 'intent', person: person.id, value }, `${person.label}: ${intentLabels[value]}`),
          { disabled: !active || !person.delivered || person.intent.value === value || value === 'withdraw' && person.intent.value === 'unanswered', key: value }));
      }
      actions.append(button(person.consent.value === true ? '소개 동의 철회' : '소개에 동의하기', () => act({ kind: 'consent', person: person.id, value: person.consent.value !== true }, `${person.label}의 소개 동의가 바뀌었어요.`), { key: 'consent' }));
      card.append(actions); return card;
    }));
    const question = find('matching-question'); question.replaceChildren();
    if (view.nextQuestion) {
      const q = view.nextQuestion, card = make('div', '', 'ask-card');
      card.append(make('h3', `${names[q.person]}에게 확인할 질문`), make('p', q.label));
      const options = make('div', '', 'interpret-actions');
      for (const option of q.options) options.append(button(option.label, () => act(
        q.field === 'consent' ? { kind: 'consent', person: q.person, value: option.value }
          : { kind: 'declare', person: q.person, field: q.field, value: option.value },
        `${names[q.person]}의 답을 확인했어요.`), { key: 'answer-' + option.id }));
      card.append(options); question.append(card);
    }
    const actions = find('matching-actions');
    actions.replaceChildren(button('새 소개 준비하기', () => act({ kind: 'introduce' }, '두 사람의 조건으로 새 소개를 준비했어요.'), { disabled: !view.eligibility.canIntroduce || view.round?.active === true, key: 'introduce' }));
    const mutuallyAccepted = view.round?.active === true && view.participants.every(person => person.delivered && person.intent.value === 'accept');
    for (const person of view.participants) actions.append(button(`${person.label}에게 상호 수락 알리기`, () => act({ kind: 'result-delivered', person: person.id }, `${person.label}에게 상호 수락 결과를 보여 줬어요.`), { disabled: !mutuallyAccepted || person.resultDelivered, key: 'result-' + person.id }));
    actions.append(button('사례 다시 시작', () => select(view.scenario.id), { key: 'reset' }));
    const rows = [`현재 유효한 소개: 결정 ${view.tracking.decisions.length}건 · 소개 전달 ${view.tracking.exposures.length}건 · 관측된 결과 ${view.tracking.outcomes.length}건 · 결과 전달 ${view.tracking.resultDeliveries.length}건`, `이 사례에서 이미 보여 준 결과 이력 ${view.tracking.historicalResultDeliveries.length}건. 철회해도 상대가 과거에 본 사실은 없어지지 않아요.`, ...history];
    find('matching-history').replaceChildren(...rows.map(row => make('li', row)));
  }
  render();
  return Object.freeze({ snapshot: () => adapter.inspect(state) });
}
