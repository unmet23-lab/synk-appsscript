import { createMeetingAdapter, MEETING_FIELDS, MEETING_SCENARIOS, MEETING_PLANS } from './meeting.mjs';

// A role-switching fictional walkthrough, not authenticated accounts or messaging.
export function mountMeetingLab({ root = document, Domain, Ask, Personalization, initialState, onStateChange = () => {} }) {
  const adapter = createMeetingAdapter({ Domain, Ask, Personalization });
  const clone = value => JSON.parse(JSON.stringify(value));
  let state = initialState === undefined ? adapter.create('first') : clone(initialState), viewer = 'person-a', connectionKey = null, inviteDraft = null;
  if (state) { const snapshot = adapter.inspect(state); connectionKey = snapshot.connection?.key || null; }
  const find = id => root.getElementById(id);
  const make = (tag, text, className) => {
    const node = root.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (label, action, key, disabled = false) => {
    const node = make('button', label, 'slab'); node.type = 'button'; node.disabled = disabled;
    node.dataset.meetingAction = key; node.addEventListener('click', action); return node;
  };
  const select = (id, options, selected) => {
    const node = make('select'); node.id = id;
    for (const option of options) {
      const child = make('option', option.label); child.value = option.id;
      if (option.id === selected) child.selected = true;
      node.append(child);
    }
    return node;
  };
  const labeled = (label, control) => {
    const node = make('label', label); node.htmlFor = control.id; return [node, control];
  };
  function changed() {
    try { const result = onStateChange(clone(state)); if (result?.catch) result.catch(() => {}); } catch { /* The host reports persistence failures separately. */ }
  }
  function act(action, message) {
    try {
      state = adapter.record(state, action);
      inviteDraft = null;
      find('meeting-notice').textContent = message;
      render(); changed();
    } catch {
      find('meeting-notice').textContent = '현재 단계에서는 적용할 수 없어요. 두 사람의 조건과 확인 상태를 다시 살펴봐 주세요.';
    }
  }
  function setRole(person) { viewer = person; inviteDraft = null; find('meeting-notice').textContent = '가상 인물의 역할을 바꿨어요.'; render(); }
  function renderInputs(view) {
    const area = find('meeting-inputs'); area.replaceChildren(make('h3', `${view.me.label} · 내가 원하는 만남`));
    const summary = make('ul', '', 'mini');
    for (const field of view.me.fields) summary.append(make('li', `${field.label}: ${field.state === 'known' ? field.valueLabel : '아직 고르지 않았어요'}${field.required ? ' · 필수' : ''}`));
    area.append(summary);
    const q = view.nextQuestion;
    if (q) {
      const card = make('fieldset'); card.append(make('legend', q.label));
      if (q.optional) card.append(make('p', '더 잘 맞추고 싶다면 골라 주세요. 답하지 않고 지금 제안으로 진행해도 돼요.', 'mini'));
      const actions = make('div', '', 'interpret-actions');
      if (q.person !== viewer) actions.append(button('상대 역할에서 직접 확인하기', () => setRole(q.person), 'switch-question'));
      else {
        card.append(make('p', '여기서 고른 조건은 만남 제안에 사용하며 상대 역할에도 보여요. 아래에서 나만 반영하도록 바꿀 수 있어요.', 'mini'));
        for (const option of q.options) {
          const node = button(option.label, () => act({ kind: 'set', person: viewer, field: q.field, value: option.value,
            duration: 'ongoing', share: true, required: ['availability', 'consent'].includes(q.field) }, '고른 조건을 반영했어요.'), 'answer-' + option.id);
          node.dataset.meetingAnswer = option.id; node.dataset.meetingField = q.field; actions.append(node);
        }
        if (q.optional) actions.append(button('이번에는 건너뛰기', () => act({ kind: 'skip-question', person: viewer, field: q.field }, '이 질문은 이번 만남에서 건너뛰었어요. 내 선호로 기록하지 않아요.'), 'skip-question'));
      }
      card.append(actions); area.append(card);
    }
    const editor = make('details', '', 'meeting-editor'); editor.id = 'meeting-editor';
    editor.append(make('summary', '조건을 직접 고치기'));
    const fieldSelect = select('meeting-edit-field', MEETING_FIELDS, 'duration');
    const valueSelect = select('meeting-edit-value', [], null);
    const futureSetting = view.encounter.started || view.encounter.completed;
    const period = select('meeting-edit-period', [{ id: 'once', label: futureSetting ? '다음 만남에만' : '이번 만남에만' }, { id: 'ongoing', label: '앞으로도' }], 'once');
    const share = make('input'); share.type = 'checkbox'; share.id = 'meeting-edit-share';
    const required = make('input'); required.type = 'checkbox'; required.id = 'meeting-edit-required';
    const shareLabel = make('label', '', 'meeting-check'); shareLabel.append(share, root.createTextNode('이 조건을 상대에게도 보여요'));
    const requiredLabel = make('label', '', 'meeting-check'); requiredLabel.append(required, root.createTextNode('이 조건은 꼭 지켜야 해요'));
    const update = () => {
      const spec = MEETING_FIELDS.find(field => field.id === fieldSelect.value), current = view.me.fields.find(field => field.id === spec.id);
      valueSelect.replaceChildren(...spec.options.map(option => { const node = make('option', option.label); node.value = option.id; node.selected = option.value === current?.value; return node; }));
      const mandatory = ['availability', 'consent'].includes(spec.id);
      share.checked = mandatory || current?.share === true; share.disabled = mandatory;
      required.checked = mandatory || current?.required === true; required.disabled = mandatory;
    };
    fieldSelect.addEventListener('change', update); update();
    editor.append(...labeled('바꾸고 싶은 조건', fieldSelect), ...labeled('내 선택', valueSelect), ...labeled('어디까지 반영할까요?', period), shareLabel, requiredLabel);
    const editActions = make('div', '', 'interpret-actions');
    editActions.append(button('이 선택 반영하기', () => {
      const spec = MEETING_FIELDS.find(field => field.id === fieldSelect.value), option = spec.options.find(item => item.id === valueSelect.value);
      act({ kind: 'set', person: viewer, field: spec.id, value: option.value, duration: period.value, share: share.checked, required: required.checked },
        period.value === 'once' ? '고른 만남에만 반영했어요. 평소 선택은 유지해요.' : '앞으로의 만남에도 반영하도록 바꿨어요.');
    }, 'save-setting'));
    editActions.append(button('이 범위의 선택 지우기', () => act({ kind: 'withdraw-setting', person: viewer, field: fieldSelect.value, duration: period.value },
      '선택한 범위의 조건을 지웠어요. 남아 있는 조건으로 다시 살펴봐요.'), 'withdraw-setting'));
    editor.append(editActions, make('p', futureSetting ? '만남 완료 확인을 시작했어요. 지금 바꾸는 조건은 다음 만남부터 반영하고, 이번 만남 기록은 유지해요.' : '조건을 바꾸면 진행 중인 제안을 다시 확인해야 해요. 상대의 수락을 새 조건에 가져오지 않아요.', 'mini'));
    area.append(editor);
  }
  function renderPlan(view) {
    const area = find('meeting-plan'); area.replaceChildren();
    const recommendation = view.recommendation, proposal = view.proposal;
    area.append(make('p', proposal?.valid ? '함께 확인할 만남' : '내 조건으로 살펴본 만남', 'eyebrow'));
    const plan = proposal?.valid ? proposal.plan : recommendation.plan;
    if (plan) {
      area.append(make('h3', plan.title), make('p', `${plan.minutes}분 · ${plan.location}`, 'meeting-meta'));
      const steps = make('ol', '', 'mini'); for (const text of plan.steps) steps.append(make('li', text)); area.append(steps);
      if (proposal?.valid) area.append(make('p', proposal.label, 'mini'));
    } else area.append(make('h3', recommendation.status === 'blocked' ? '지금 조건에 맞는 만남이 없어요' : '몇 가지만 더 확인하면 제안할 수 있어요'));
    if (proposal && !proposal.valid) area.append(make('p', '조건이 달라져 이전 제안과 수락을 다시 사용하지 않아요.', 'mini meeting-unknown'));
    const evaluation = proposal?.valid && proposal.evaluation ? proposal.evaluation : recommendation;
    for (const reason of evaluation.reasons) area.append(make('p', reason, 'mini'));
    const important = make('ul');
    for (const fact of evaluation.facts.filter(item => item.status !== 'fit')) {
      const item = make('li', fact.text, fact.status === 'unknown' ? 'meeting-unknown' : ''); item.dataset.meetingFact = fact.status; important.append(item);
    }
    if (important.childElementCount) area.append(important);
    const matchingFacts = evaluation.facts.filter(item => item.status === 'fit');
    if (matchingFacts.length) {
      const detail = make('details'); detail.append(make('summary', '제안에 반영된 조건 보기'));
      const facts = make('ul');
      for (const fact of matchingFacts) { const item = make('li', fact.text); item.dataset.meetingFact = fact.status; facts.append(item); }
      detail.append(facts); area.append(detail);
    }
    if (proposal?.valid) {
      const progress = make('ul', '', 'mini');
      const responses = { unanswered: '아직 답하지 않았어요', accept: '이 만남이 좋아요', busy: '이번에는 여유가 없어요', decline: '이 제안은 넘길게요', withdraw: '앞선 의향을 철회했어요' };
      for (const person of proposal.people) progress.append(make('li', `${person.label}: ${person.met ? '만남을 마쳤다고 확인했어요' : responses[person.response]}`));
      area.append(progress);
      if (proposal.people.some(person => person.response === 'busy')) area.append(make('p', '일정의 여유가 없다는 답이에요. 상대를 싫어하거나 취향이 바뀌었다고 기록하지 않아요.', 'mini'));
    }
    if (view.canPropose) area.append(button('이 만남을 함께 확인하기', () => act({ kind: 'propose', person: viewer }, '구체적인 만남을 공동 제안으로 올렸어요. 두 역할에서 각각 확인해 주세요.'), 'propose'));
    if (proposal?.canEdit && recommendation.alternatives.length) {
      const details = make('details'); details.append(make('summary', '다른 만남 방식 살펴보기'));
      const actions = make('div', '', 'interpret-actions');
      for (const alternative of recommendation.alternatives.filter(item => item.id !== proposal.plan.id).slice(0, 4)) {
        const b = button(alternative.title, () => act({ kind: 'edit', person: viewer, planId: alternative.id }, '만남 제안을 바꿨어요. 두 사람 모두 새 제안을 다시 확인해 주세요.'), 'edit-plan');
        b.dataset.meetingPlan = alternative.id; actions.append(b);
      }
      details.append(actions); area.append(details);
    }
  }
  function renderActions(view) {
    const area = find('meeting-actions'); area.replaceChildren();
    const proposal = view.proposal, self = proposal?.people.find(person => person.id === viewer);
    if (proposal?.valid && self && !view.encounter.completed) {
      area.append(button('이 제안 확인했어요', () => act({ kind: 'view', person: viewer }, '지금 제안을 확인했어요.'), 'view', self.seen));
      for (const [value, text] of [['accept', '이 만남이 좋아요'], ['busy', '이번에는 여유가 없어요'], ['decline', '이 제안은 넘길게요'], ['withdraw', '앞선 의향 철회']]) area.append(button(text,
        () => act({ kind: 'respond', person: viewer, value }, `${view.me.label}의 답을 반영했어요.`), value,
        !self.seen || view.encounter.completed || proposal.people.some(person => person.met) || self.response === value || value === 'accept' && !proposal.selfCanAccept || value === 'withdraw' && self.response === 'unanswered'));
      if (self.seen && !proposal.selfCanAccept && !view.encounter.completed) area.append(make('p', '이 제안은 내가 정한 필수조건과 맞지 않아요. 조건이나 제안을 직접 고친 뒤 수락할 수 있어요.', 'mini'));
      if (proposal.canMeet) area.append(button('만남을 마쳤다고 가정하기', () => act({ kind: 'met', person: viewer }, '가상 만남을 마친 것으로 확인했어요. 실제 만남 기록은 아니에요.'), 'met', self.met));
    }
    if (view.canNext) area.append(button('다음 가상 만남으로', () => act({ kind: 'next' }, '새 가상 만남을 열었어요. 이번만의 조건과 이전 수락은 이어지지 않아요.'), 'next'));
  }
  function renderReflection(view) {
    const area = find('meeting-reflection'); area.replaceChildren();
    const reflection = view.me.reflection;
    if (!reflection.canReflect && !view.me.pendingProposals.length) return;
    area.append(make('h3', reflection.canReflect ? '다음에는 무엇을 유지하거나 바꿀까요?' : '지난 만남에서 남긴 변경 제안'), make('p', `${view.me.label}만의 피드백이에요. 최근 내가 마쳤다고 확인한 만남을 돌아봐요. 상대 역할의 완료 확인을 기다리지 않고 남길 수 있어요. 직접 확인한 변경만 반영해요.`, 'mini'));
    const answered = reflection.answered;
    const actions = make('div', '', 'interpret-actions');
    for (const [value, text] of [['too-long', '사람보다, 긴 시간이 부담스러웠어요'], ['activity-change', '다음에는 다른 활동을 해보고 싶어요'], ['felt-good', '이 만남 방식이 편했어요']]) {
      const b = button(text, () => act({ kind: 'feedback', person: viewer, value, encounterId: reflection.encounterId }, '나만의 피드백으로 남겼어요. 바꿀 조건은 직접 확인한 뒤에만 반영해요.'), 'feedback-' + value, answered); actions.append(b);
    }
    if (reflection.canReflect) area.append(actions, make('p', '만남 방식에 대한 감상이에요. 다시 만나고 싶은 마음은 아래에서 따로 기록해요.', 'mini'));
    for (const feedback of view.me.feedback.filter(item => item.encounterId === reflection.encounterId)) area.append(make('p', feedback.label, 'mini'));
    for (const change of view.me.pendingProposals) {
      const card = make('div', '', 'meeting-change'); card.dataset.meetingProposal = change.id;
      card.append(make('p', change.label));
      const choices = make('div', '', 'interpret-actions');
      for (const [duration, label] of [['once', change.targetEncounterId === view.encounter.id ? '이번 만남에만 적용' : '다음 만남에만 적용'], ['ongoing', '앞으로도 적용']]) choices.append(button(label,
        () => act({ kind: 'apply', person: viewer, proposalId: change.id, duration }, '확인한 조건만 다음 제안에 반영했어요. 상대에게 이 피드백을 보내지는 않아요.'), 'apply-' + duration));
      choices.append(button('반영하지 않기', () => act({ kind: 'dismiss', person: viewer, proposalId: change.id }, '이번 피드백은 조건 변경에 사용하지 않아요.'), 'dismiss'));
      card.append(choices); area.append(card);
    }
    const next = view.me.nextPreview?.recommendation;
    if (next?.plan) {
      const preview = make('div', '', 'meeting-change'); preview.id = 'meeting-next-preview';
      preview.append(make('p', '내 다음 제안 미리보기', 'eyebrow'), make('h3', next.plan.title), make('p', `${next.plan.minutes}분 · ${next.plan.location}`, 'meeting-meta'));
      for (const reason of next.reasons) preview.append(make('p', reason, 'mini'));
      preview.append(make('p', '미리보기는 나에게만 보여요. 다음 제안을 함께 확인하기 전에는 공동 약속이 되지 않아요.', 'mini')); area.append(preview);
    }
  }
  function reconnectAction(action, message) { act({ kind: 'reconnect', person: viewer, action }, message); }
  function renderReconnect(view) {
    let area = find('meeting-reconnect');
    if (!area) { area = make('section', '', 'meeting-reflection meeting-reconnect'); area.id = 'meeting-reconnect'; find('meeting-reflection').after(area); }
    area.replaceChildren(); if (!view) return;
    const value = view.reconnect, own = value.me;
    area.append(make('h3', '다시 만날 마음과 보내는 초대는 따로예요'), make('p', '내 마음을 기록해도 상대에게 전송하지 않아요. 초대는 받는 사람과 문구를 확인한 뒤 직접 보내요.', 'mini'));
    if (own.canReflect) {
      const labels = { yes: '다시 만나고 싶어요', no: '다시 만나지 않을래요', unsure: '아직 모르겠어요', 'not-now': '지금은 여유가 없어요' };
      area.append(make('p', `나만 보는 마음: ${labels[own.intent?.value] || '아직 답하지 않았어요'}`, 'mini'));
      const intents = make('div', '', 'interpret-actions');
      for (const [answer, label] of Object.entries(labels)) {
        const b = button(label, () => reconnectAction({ kind: 'intent', encounterId: own.encounterId, value: answer }, '나만 보는 마음으로 기록했어요. 이미 보낸 초대는 바꾸지 않았어요.'), 'reconnect-intent-' + answer, own.intent?.value === answer);
        b.dataset.reconnectIntent = answer; intents.append(b);
      }
      intents.append(button('내 마음 기록 지우기', () => reconnectAction({ kind: 'intent', encounterId: own.encounterId, value: null }, '비공개 답을 지웠어요. 보낸 초대를 철회하려면 별도로 선택해 주세요.'), 'reconnect-intent-clear', !own.intent));
      area.append(intents);
    } else area.append(make('p', '내가 만남을 마쳤다고 확인하면 나만 보는 마음을 남길 수 있어요.', 'mini'));
    if (value.access !== 'available') area.append(make('p', '지금은 이 연결에서 초대를 진행할 수 없어요.', 'mini'));
    const invitation = value.invitation;
    if (invitation) {
      const card = make('div', '', 'meeting-change'); card.id = 'reconnect-invitation';
      const labels = { pending: '응답을 기다리는 초대', accepted: '다음 만남을 준비하기로 했어요', deferred: '이번 초대를 마쳤어요', declined: '이번 초대를 마쳤어요', withdrawn: '철회한 초대', expired: '기한이 지난 초대', closed: '종료한 초대', completed: '지난 초대' };
      card.append(make('h4', labels[invitation.status]), make('p', invitation.message), make('p', `응답 기한: ${invitation.expiresAt}`, 'mini'), make('p', value.description, 'mini'));
      const responses = make('div', '', 'interpret-actions');
      if (value.canRespond) for (const [answer, label] of [['accept', '다음 만남을 준비할게요'], ['busy', '이번에는 어려워요'], ['decline', '이 초대는 거절할게요']]) responses.append(button(label,
        () => reconnectAction({ kind: 'respond', invitationId: invitation.id, value: answer }, '이 초대에 대한 답을 반영했어요. 구체적인 약속의 수락은 별도예요.'), 'reconnect-respond-' + answer));
      if (value.canWithdraw) responses.append(button('보낸 초대 철회', () => reconnectAction({ kind: 'withdraw', invitationId: invitation.id }, '이 초대를 철회했어요. 상대가 이미 본 내용을 지웠다는 뜻은 아니에요.'), 'reconnect-withdraw'));
      card.append(responses); area.append(card);
    }
    if (value.canSend) {
      const compose = make('details'); compose.id = 'reconnect-compose'; compose.open = !!inviteDraft;
      compose.append(make('summary', '내가 직접 재만남 초대 작성하기'));
      const input = make('textarea'); input.id = 'reconnect-message'; input.rows = 3; input.maxLength = 280;
      input.value = inviteDraft?.message || '다시 만나고 싶어요. 함께 다음 만남을 준비할까요?';
      input.addEventListener('input', () => { inviteDraft = null; find('reconnect-review')?.remove(); });
      compose.append(...labeled('상대에게 보낼 문구', input), make('p', `받는 사람: ${view.partner.label} · 전송한 때부터 72시간 동안 답할 수 있어요. 비공개 피드백은 보내지 않아요.`, 'mini'));
      compose.append(button('보낼 내용 확인하기', () => {
        const message = input.value.trim();
        if (!message || message.length > 280) { find('meeting-notice').textContent = '보낼 문구를 280자 안으로 적어 주세요.'; return; }
        inviteDraft = { message, person: viewer, to: view.partner.id, encounterId: own.encounterId, state: JSON.stringify(state) }; renderReconnect(adapter.inspect(state, { viewer }));
      }, 'reconnect-review'));
      if (inviteDraft) {
        const review = make('div', '', 'meeting-change'); review.id = 'reconnect-review';
        review.append(make('h4', `${view.partner.label}에게 이 내용만 보내요`), make('p', inviteDraft.message), make('p', '응답 기한은 전송 후 72시간이에요. 아직 보내지 않았어요.', 'mini'));
        review.append(button('이 초대 전송하기', () => {
          if (!inviteDraft || inviteDraft.person !== viewer || inviteDraft.state !== JSON.stringify(state)) { inviteDraft = null; renderReconnect(adapter.inspect(state, { viewer })); return; }
          reconnectAction({ kind: 'send', encounterId: inviteDraft.encounterId, to: inviteDraft.to, message: inviteDraft.message }, '가상 상대에게 보낼 초대를 기록했어요. 실제 외부 전송은 하지 않아요.');
        }, 'reconnect-send'), button('작성 취소', () => { inviteDraft = null; renderReconnect(adapter.inspect(state, { viewer })); }, 'reconnect-cancel-draft'));
        compose.append(review);
      }
      area.append(compose);
    }
    const controls = make('div', '', 'interpret-actions');
    if (!own.receiving && !own.blocking) controls.append(button('이 상대의 초대를 다시 받기', () => reconnectAction({ kind: 'reopen' }, '이 상대의 새 초대를 다시 받을 수 있어요. 옛 초대는 되살리지 않아요.'), 'reconnect-reopen'));
    controls.append(button(own.paused ? '새 제안 받기 다시 시작' : '새 제안 잠시 쉬기', () => reconnectAction({ kind: own.paused ? 'resume' : 'pause' }, own.paused ? '새 제안 받기를 다시 시작했어요.' : '새 제안을 쉬어요. 이미 진행 중인 초대와 약속은 그대로이며, 철회는 별도로 할 수 있어요.'), own.paused ? 'reconnect-resume' : 'reconnect-pause'));
    controls.append(button(own.blocking ? '내 차단 해제' : '이 상대 차단', () => reconnectAction({ kind: own.blocking ? 'unblock' : 'block' }, own.blocking ? '내 차단을 해제했어요. 옛 초대와 수락은 복원하지 않아요.' : '이 연결의 접근과 진행 중인 초대를 중단했어요.'), own.blocking ? 'reconnect-unblock' : 'reconnect-block'));
    area.append(controls);
  }
  function renderScenarios(changes) {
    const scenarios = make('div', '', 'interpret-actions meeting-reset');
    for (const scenario of MEETING_SCENARIOS) { const b = button(scenario.title, () => { state = adapter.create(scenario.id); connectionKey = null; viewer = 'person-a'; inviteDraft = null; find('meeting-notice').textContent = '가상 사례를 처음부터 시작해요.'; render(); changed(); }, 'scenario'); b.dataset.meetingScenario = scenario.id; scenarios.append(b); }
    changes.append(make('p', '독립된 가상 사례로 다시 시작하면 지금 선택과 피드백을 지워요.', 'mini'), scenarios);
  }
  function render() {
    const connection = find('meeting-connection'); connection.replaceChildren();
    if (!state) {
      for (const id of ['meeting-roles', 'meeting-stage', 'meeting-inputs', 'meeting-plan', 'meeting-actions', 'meeting-reflection', 'meeting-changes']) find(id).replaceChildren();
      connection.append(make('h3', '바뀐 조건으로 후보를 다시 골라 주세요.'), make('p', '이전 후보와의 만남 준비를 마쳤어요. 수락과 피드백은 새 후보에게 이어지지 않아요.', 'mini'));
      connection.append(button('후보를 다시 살펴보기', () => { find('discovery-summary').scrollIntoView({ block: 'start', behavior: 'instant' }); find('discovery-summary').focus({ preventScroll: true }); }, 'return-discovery'));
      renderReconnect(null); renderScenarios(find('meeting-changes')); return;
    }
    const view = adapter.inspect(state, { viewer });
    if (view.connection) connection.append(make('h3', `${view.connection.label}님과 첫 만남 준비`), make('p', '후보 탐색에서 밝힌 일정은 이어 썼어요. 만남 제안을 받을 의향은 각자의 역할에서 다시 확인해 주세요. 아직 고르지 않은 만남 취향은 비워 두었어요.', 'mini'));
    find('meeting-roles').replaceChildren(...view.people.map(person => {
      const b = button(`${person.label}로 체험`, () => setRole(person.id), 'role');
      b.dataset.meetingRole = person.id; b.setAttribute('aria-pressed', String(person.id === viewer)); return b;
    }));
    find('meeting-stage').textContent = `${view.encounter.index}번째 가상 만남 · ${view.me.label}의 화면${view.encounter.completed ? ' · 만남 뒤 돌아보기' : ''}`;
    renderInputs(view); renderPlan(view); renderActions(view); renderReflection(view); renderReconnect(view);
    const changes = find('meeting-changes'); changes.replaceChildren();
    for (const field of view.me.fields.filter(item => item.state === 'known')) changes.append(make('p', `${field.label} · ${field.valueLabel}${field.source === 'feedback-confirmed' ? ' · 내가 피드백을 확인하고 반영했어요' : ' · 내가 직접 골랐어요'}${field.share ? ' · 공유한 조건' : ' · 나에게만 반영'}`, 'mini'));
    renderScenarios(changes);
  }
  render();
  return Object.freeze({
    snapshot: (person = viewer) => state ? adapter.inspect(state, { viewer: person }) : null,
    exportState: () => clone(state),
    restoreState(saved) {
      const restored = clone(saved); const snapshot = restored ? adapter.inspect(restored) : null;
      state = restored; connectionKey = snapshot?.connection?.key || null; viewer = 'person-a'; inviteDraft = null; render(); changed();
    },
    loadSelection(seed) {
      if (state && connectionKey === seed.key) {
        find('meeting-notice').textContent = '준비하던 만남을 이어서 보여 드려요.'; changed(); return;
      }
      state = adapter.createFromSelection(seed); connectionKey = seed.key; viewer = 'person-a'; inviteDraft = null;
      find('meeting-notice').textContent = '고른 후보와 새 만남을 준비해요. 먼저 각자의 의향을 확인해 주세요.'; render(); changed();
    },
    syncSelection(seed) {
      if (connectionKey && seed?.key !== connectionKey) {
        state = null; connectionKey = null; viewer = 'person-a'; inviteDraft = null;
        find('meeting-notice').textContent = '후보나 조건이 달라져 이전 만남 준비를 닫았어요.'; render(); changed();
      }
    }
  });
}
