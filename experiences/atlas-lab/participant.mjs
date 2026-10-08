import { MEETING_FIELDS } from './meeting.mjs';
// Only a server-filtered participant projection lives in this page. Never import raw pair state.
const root = document, find = id => root.getElementById(id);
let sessionPath, csrfToken, data, pending = false, requestGeneration = 0;
const DEFAULT_INVITATION = '다음에 다시 만나서 이야기 나눠 볼까요?';
let invitationDraft = DEFAULT_INVITATION, invitationOpen = false;
const make = (tag, text, cls) => { const node = root.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
const button = (text, key, fn, disabled = false) => { const b = make('button', text, 'slab'); b.type = 'button'; b.dataset.participantAction = key; b.disabled = disabled || pending; b.onclick = fn; return b; };
const say = text => { find('participant-notice').textContent = text; };
async function request(route, body) {
  const response = await fetch(route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }, body: JSON.stringify(body) } : {});
  const result = await response.json();
  if (!response.ok) { const error = new Error(response.status === 409 ? 'conflict' : response.status === 401 || response.status === 410 ? 'expired' : result.error === 'journey-inaccessible' ? 'access-ended' : 'unavailable'); error.status = response.status; throw error; }
  return result;
}
function accept(result, generation = requestGeneration) {
  if (generation !== requestGeneration || data && result.revision < data.revision) return;
  data = result; csrfToken = result.csrfToken || csrfToken; render();
}
function failure(error) {
  say(error.message === 'conflict' ? '상대의 응답이나 제안이 바뀌었어요. 최신 내용을 다시 확인한 뒤 선택해 주세요.' : error.message === 'expired' ? '이 체험의 접근이 끝났어요. 실험실에서 새 역할 창을 준비해 주세요.' : error.message === 'access-ended' ? '이 만남의 접근이 중단되어 반영하지 않았어요.' : '지금은 반영하지 못했어요. 최신 내용을 다시 확인해 주세요.');
  if (error.message === 'expired') { data = null; find('participant-title').textContent = '이 체험의 접근이 끝났어요'; find('participant-controls').replaceChildren(); find('participant-content').replaceChildren(); find('participant-account').replaceChildren(); }
}
async function refresh() {
  if (pending || !sessionPath) return;
  const generation = ++requestGeneration; pending = true; render();
  try { accept(await request(sessionPath + '/state'), generation); }
  catch (error) { if (generation === requestGeneration) failure(error); }
  finally { if (generation === requestGeneration) { pending = false; render(); } }
}
async function act(action) {
  if (pending || !data) return; const generation = ++requestGeneration; pending = true; render();
  try {
    const result = await request(sessionPath + '/action', { requestId: crypto.randomUUID(), expectedRevision: data.revision, action });
    if (action.kind === 'reconnect' && action.action.kind === 'send') { invitationDraft = DEFAULT_INVITATION; invitationOpen = false; }
    accept(result, generation); say('내 선택을 반영했어요.');
  }
  catch (error) {
    let reportedError = error;
    if (error.message === 'access-ended') {
      // The denial itself is enough to stop displaying the old private projection,
      // even if the follow-up read cannot reach the local host.
      data = { ...data, view: { access: { allowed: false }, reconnect: { me: { blocking: false } } } }; render();
    }
    if (['conflict', 'access-ended'].includes(error.message)) await request(sessionPath + '/state').then(result => accept(result, generation)).catch(latestError => { if (latestError.message === 'expired') reportedError = latestError; });
    failure(reportedError);
  }
  finally { pending = false; if (data) render(); }
}
function render() {
  if (!data?.view) return;
  const view = data.view;
  if (view.access?.allowed === false) {
    invitationDraft = DEFAULT_INVITATION; invitationOpen = false;
    find('participant-title').textContent = '이 만남의 접근이 중단됐어요';
    find('participant-controls').replaceChildren(button('최신 내용 확인하기', 'refresh', refresh));
    find('participant-content').replaceChildren(make('p', '지금은 이 만남의 제안이나 상대 정보를 볼 수 없어요.'));
    if (view.reconnect?.me?.blocking) find('participant-content').append(button('내 차단 해제', 'block', () => act({ kind: 'reconnect', action: { kind: 'unblock' } })));
    find('participant-account').replaceChildren(button('이 체험 기록 지우기', 'delete', () => control('delete'))); return;
  }
  const mine = view.me, actor = mine.id;
  find('participant-title').textContent = `${mine.label}의 첫 만남`;
  find('participant-controls').replaceChildren(button('최신 내용 확인하기', 'refresh', refresh));
  const area = find('participant-content'); area.replaceChildren();
  const grid = make('div', '', 'meeting-grid'), inputs = make('div', '', 'meeting-inputs'), plan = make('div', '', 'meeting-plan'); grid.append(inputs, plan); area.append(grid);
  inputs.append(make('h2', '내가 원하는 만남'));
  for (const field of mine.fields) inputs.append(make('p', `${field.label}: ${field.state === 'known' ? field.valueLabel : '아직 고르지 않았어요'}`, 'mini'));
  const q = view.nextQuestion;
  if (q && q.person === actor) {
    inputs.append(make('h3', q.label)); const choices = make('div', '', 'interpret-actions');
    for (const option of q.options) choices.append(button(option.label, `answer-${q.field}-${option.id}`, () => act({ kind: 'set', field: q.field, value: option.value, duration: 'ongoing', share: true, required: ['consent', 'availability'].includes(q.field) })));
    inputs.append(choices);
  }
  if (view.awaitingOtherConfirmation) inputs.append(make('p', '상대가 직접 확인할 항목이 있어요. 이 창에서 대신 답하지 않아요.', 'mini'));
  const editor = make('details', '', 'meeting-editor'); editor.append(make('summary', '내 조건 고치기'));
  const fieldSelect = make('select'); fieldSelect.id = 'participant-field';
  for (const field of MEETING_FIELDS) { const o = make('option', field.label); o.value = field.id; fieldSelect.append(o); }
  const valueSelect = make('select'); valueSelect.id = 'participant-value';
  function update() { valueSelect.replaceChildren(); const spec = MEETING_FIELDS.find(f => f.id === fieldSelect.value); for (const option of spec.options) { const o = make('option', option.label); o.value = option.id; o.selected = option.value === mine.fields.find(f => f.id === spec.id)?.value; valueSelect.append(o); } }
  fieldSelect.onchange = update; update();
  const fLabel = make('label', '고칠 항목'); fLabel.htmlFor = fieldSelect.id; const vLabel = make('label', '내 선택'); vLabel.htmlFor = valueSelect.id;
  editor.append(fLabel, fieldSelect, vLabel, valueSelect, button('이 조건 적용하기', 'save-setting', () => { const spec = MEETING_FIELDS.find(f => f.id === fieldSelect.value), option = spec.options.find(o => o.id === valueSelect.value); act({ kind: 'set', field: spec.id, value: option.value, duration: 'ongoing', share: true, required: ['consent', 'availability'].includes(spec.id) }); })); inputs.append(editor);
  const proposal = view.proposal, selected = proposal?.valid ? proposal.plan : view.recommendation.plan;
  plan.append(make('p', proposal?.valid ? '함께 확인할 제안' : '내 조건으로 살펴본 만남', 'eyebrow'), make('h3', selected?.title || '필요한 답을 먼저 확인해요'));
  for (const reason of view.recommendation.reasons) plan.append(make('p', reason, 'mini'));
  if (proposal) plan.append(make('p', proposal.label, 'mini'));
  const actions = make('div', '', 'interpret-actions'); area.append(actions);
  if (view.canPropose) actions.append(button('이 만남을 함께 확인하기', 'propose', () => act({ kind: 'propose' })));
  const self = proposal?.people.find(p => p.id === actor);
  if (proposal?.valid && self && !self.met) {
    actions.append(button('이 제안 확인했어요', 'view', () => act({ kind: 'view' }), self.seen));
    for (const [value, label] of [['accept', '이 만남이 좋아요'], ['busy', '이번에는 여유가 없어요'], ['decline', '이 제안은 넘길게요'], ['withdraw', '앞선 의향 철회']]) actions.append(button(label, value, () => act({ kind: 'respond', value }), !self.seen || self.response === value || value === 'accept' && !proposal.selfCanAccept));
    if (proposal.canMeet) actions.append(button('가상 만남을 마쳤다고 확인', 'met', () => act({ kind: 'met' })));
  }
  if (mine.reflection?.canReflect || mine.pendingProposals.length) {
    const reflection = make('div', '', 'meeting-reflection'); reflection.append(make('h2', '나만 보는 돌아보기'), make('p', '만남 방식에 대한 감상과 다시 만날 의향을 따로 남겨요. 상대에게 자동으로 보내지 않아요.', 'mini'));
    const feedbacks = make('div', '', 'interpret-actions');
    for (const [value, label] of [['too-long', '시간은 조금 길었어요'], ['activity-change', '다른 활동도 하고 싶어요'], ['felt-good', '이 방식은 편했어요']]) feedbacks.append(button(label, `feedback-${value}`, () => act({ kind: 'feedback', value, encounterId: mine.reflection.encounterId }), mine.reflection?.answered));
    if (mine.reflection?.canReflect) reflection.append(feedbacks);
    for (const feedback of mine.feedback) reflection.append(make('p', feedback.label, 'mini'));
    for (const change of mine.pendingProposals) { reflection.append(make('p', change.label)); const bs = make('div', '', 'interpret-actions'); for (const [duration, label] of [['once', '다음 만남에만 적용'], ['ongoing', '앞으로도 적용']]) bs.append(button(label, `apply-${duration}`, () => act({ kind: 'apply', proposalId: change.id, duration }))); bs.append(button('반영하지 않기', 'dismiss', () => act({ kind: 'dismiss', proposalId: change.id }))); reflection.append(bs); }
    area.append(reflection);
  }
  renderReconnect(area, view);
  if (view.canNext) area.append(button('다음 가상 만남으로', 'next', () => act({ kind: 'next' })));
  find('participant-account').replaceChildren(button('이 체험의 접근 끝내기', 'revoke', () => control('revoke')), button('이 두 역할의 체험 기록 지우기', 'delete', () => control('delete')));
}
function reconnect(action) { return act({ kind: 'reconnect', action }); }
function renderReconnect(area, view) {
  const r = view.reconnect; if (!r) return;
  const box = make('div', '', 'meeting-reflection'); box.append(make('h2', '다시 만날 내 마음과 제안'));
  const actions = make('div', '', 'interpret-actions');
  if (r.me.canReflect) {
    for (const [value, text] of [['yes', '다시 만나고 싶어요'], ['no', '다시 만나지는 않을래요'], ['unsure', '아직 모르겠어요'], ['not-now', '지금은 여유가 없어요'], [null, '내 마음 기록 지우기']]) actions.append(button(text, `intent-${value ?? 'clear'}`, () => reconnect({ kind: 'intent', encounterId: r.me.encounterId, value })));
    box.append(make('p', '이 답은 나만 봐요. 초대를 보내는 행동과는 별개예요.', 'mini'));
  }
  box.append(actions);
  if (r.me?.intent) { const labels = { yes: '다시 만나고 싶어요', no: '다시 만나지는 않을래요', unsure: '아직 모르겠어요', 'not-now': '지금은 여유가 없어요' }; box.append(make('p', `내가 남긴 의향: ${labels[typeof r.me.intent === 'object' ? r.me.intent.value : r.me.intent] || '아직 고르지 않았어요'}`, 'mini')); }
  const invite = make('details', '', 'meeting-editor'); invite.append(make('summary', '상대에게 재만남 제안 보내기'));
  invite.open = invitationOpen; invite.ontoggle = () => { invitationOpen = invite.open; };
  const label = make('label', '상대가 볼 문구 (최대 280자)'); label.htmlFor = 'participant-invitation'; const message = make('textarea'); message.id = label.htmlFor; message.maxLength = 280; message.value = invitationDraft;
  message.oninput = () => { invitationDraft = message.value; };
  invite.append(label, message, make('p', `${view.partner.label}에게 이 문구만 보내요. 내 회고나 비공개 의향은 첨부하지 않아요. 응답 기한은 72시간이에요.`, 'mini'), button('이 문구로 제안 보내기', 'send-invitation', () => {
    const text = message.value.trim();
    if (!text || text.length > 280) { say('보낼 문구를 1~280자로 적어 주세요.'); return; }
    return reconnect({ kind: 'send', encounterId: r.me.encounterId, to: view.partner.id, message: text });
  }));
  if (r.canSend) box.append(invite);
  const invitations = r.invitations || (r.invitation ? [r.invitation] : []);
  for (const item of invitations) {
    const statuses = { pending: '응답을 기다리고 있어요', accepted: '다음 만남을 준비할 수 있어요', deferred: '이번 제안은 끝났어요', declined: '이번 제안은 끝났어요', withdrawn: '철회한 제안이에요', expired: '기한이 끝났어요', closed: '종료한 제안이에요', completed: '다음 만남으로 이어졌어요' };
    const card = make('div', '', 'meeting-change'); card.append(make('p', item.message), make('p', `${statuses[item.status] || '종료한 제안이에요'} · 기한: ${item.expiresAt ? new Date(item.expiresAt).toLocaleString('ko-KR') : ''}`, 'mini'));
    const buttons = make('div', '', 'interpret-actions');
    if (r.canRespond && item.to === view.me.id) for (const [value, text] of [['accept', '다시 만남 준비하기'], ['busy', '이번에는 어려워요'], ['decline', '이 제안은 넘길게요']]) buttons.append(button(text, `invite-${value}`, () => reconnect({ kind: 'respond', invitationId: item.id, value })));
    if (r.canWithdraw && item.from === view.me.id) buttons.append(button('보낸 제안 철회', 'invite-withdraw', () => reconnect({ kind: 'withdraw', invitationId: item.id })));
    card.append(buttons); box.append(card);
  }
  const settings = make('div', '', 'interpret-actions');
  settings.append(button(r.me?.paused ? '다시 시작하기' : '새 제안 쉬기', 'pause', () => reconnect({ kind: r.me?.paused ? 'resume' : 'pause' })), button('이 상대의 초대 다시 허용', 'reopen', () => reconnect({ kind: 'reopen' })), button(r.me?.blocking ? '차단 해제' : '이 상대 차단', 'block', () => reconnect({ kind: r.me?.blocking ? 'unblock' : 'block' })));
  box.append(settings); area.append(box);
}
async function control(action) {
  if (pending || !data) return; ++requestGeneration; pending = true; render();
  try { await request(sessionPath + '/control', { requestId: crypto.randomUUID(), expectedRevision: data.revision, action }); sessionStorage.removeItem('atlas-participant-session'); data = null; find('participant-title').textContent = '이 체험을 마쳤어요'; find('participant-controls').replaceChildren(); find('participant-content').replaceChildren(); find('participant-account').replaceChildren(); say(action === 'delete' ? '이 체험 기록을 지웠어요. 두 역할의 접근도 끝났어요.' : '이 체험의 접근을 끝냈어요.'); }
  catch (error) { failure(error); } finally { pending = false; if (data) render(); }
}
try {
  const capability = new URLSearchParams(location.hash.slice(1)).get('cap');
  history.replaceState(null, '', location.pathname);
  if (capability) { const joined = await request('/api/atlas-journey/session', { capability }); sessionPath = joined.sessionPath; sessionStorage.setItem('atlas-participant-session', sessionPath); accept(joined); }
  else { sessionPath = sessionStorage.getItem('atlas-participant-session'); if (!/^\/api\/atlas-journey\/sessions\/[a-zA-Z0-9-]+$/.test(sessionPath || '')) throw new Error('expired'); await refresh(); }
} catch (error) { failure(error); }
window.synkAtlasParticipant = Object.freeze({ snapshot: () => data ? JSON.parse(JSON.stringify(data.view)) : null });
