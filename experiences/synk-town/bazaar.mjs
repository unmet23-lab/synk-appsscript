/** Authored local slices: LS02.2 two current requests and LS02.3 foodless picture menu.
 * The host owns time, actor reservations and atomic Trail commits. This module does not
 * create player inventory, money, language scores, repeatable servings or a market.
 */
export class BazaarError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const ensure = (ok, code, message, status = 409) => { if (!ok) throw new BazaarError(code, message, status); };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const owner = 'cafe-owner', reader = 'visitor-tea-reader', companion = 'visitor-companion-ls022', workshop = 'workshop-owner';
const kinds = ['requests', 'pictureMenu'], roles = ['planner', 'observer', 'delegated'], supports = ['demo', 'cooperate', 'plan'];
const stages = ['role', 'requests', 'requestContinue', 'choice', 'matching', 'demonstration', 'awaitContinue', 'preview', 'rehearsal', 'awaitConfirm', 'correction', 'preparing', 'serving', 'awaitTea', 'installing', 'looking', 'result'];
const choices = { requests: ['together', 'waterFirst'], pictureMenu: ['picturesFirst', 'wordsFirst'] };
const source = kind => kind === 'requests' ? 'BAZAAR:LS02.2' : 'BAZAAR:LS02.3:pictureMenu';
const validKey = key => typeof key === 'string' && /^BAZAAR:[a-zA-Z0-9_.:-]{1,100}$/.test(key);
const action = (type, label, payload = {}, primary = false) => ({ type, label, payload, primary });
const correctMatch = { reader: { menu: 'tea', sweetener: 'none' }, companion: { menu: 'water', sweetener: 'none' } };
const cloneMatch = () => ({ reader: { ...correctMatch.reader }, companion: { ...correctMatch.companion } });
const menuName = menu => menu === 'tea' ? '향 있는 차' : '따뜻한 물';
const who = recipient => recipient === 'reader' ? reader : companion;
const whoLabel = recipient => recipient === 'reader' ? '책을 가져온 손님' : '동행 손님';
const same = (a, b) => a?.menu === b.menu && a?.sweetener === b.sweetener;
const matching = e => ['reader', 'companion'].every(id => same(e.matches[id], correctMatch[id]));
const allMatched = e => ['reader', 'companion'].every(id => e.matches[id]);
const served = state => state.allocation.portions.filter(p => p.status === 'served');
const duration = stage => ({ demonstration: 2000, rehearsal: 3000, preparing: 3000, serving: 2000, installing: 3000, looking: 2000, result: 1200 }[stage] ?? 0);
function validSupportSnapshot(snapshot, languageSupport) {
  if (!snapshot || snapshot.mode !== languageSupport || !['plain', 'stepwise'].includes(snapshot.mode)
    || !['default', 'explicit', 'accepted-proposal'].includes(snapshot.source) || !integer(snapshot.revision)) return false;
  if (snapshot.source !== 'accepted-proposal') return snapshot.basis === null;
  const b = snapshot.basis, skillByKind = { tea: 'sequence', coordination: 'sequence', help: 'detail' };
  const evidence = value => Array.isArray(value) && value.length <= 10000
    && value.every(id => typeof id === 'string' && /^support-answer-[1-9]\d*$/.test(id)) && new Set(value).size === value.length;
  // Keep a versioned historical basis. A later policy or setting cannot rewrite
  // why this already-accepted scene was presented with these supports.
  return !!b && b.version === 'town-reading-support-1' && /^learning-priority-[1-9]\d*$/.test(b.policy)
    && Object.hasOwn(skillByKind, b.kind) && b.skillId === `ko.reading.${skillByKind[b.kind]}`
    && b.difficulty === 1 && b.responseFormat === 'single-choice'
    && ['practice', 'supported', 'checking', 'review', 'recent-independent'].includes(b.state)
    && evidence(b.evidence) && evidence(b.supportingEvidence);
}

export function initialBazaar() {
  return { schema: 1, uMs: 0, episode: null, emitted: [], history: [], allocation: {
    sourceEventId: source('requests'), storyAllocationId: `${source('requests')}:allocation`, accepted: false,
    portions: [
      { id: 'reader', recipient: reader, menu: 'tea', sweetener: 'none', status: 'available', servedU: null },
      { id: 'companion', recipient: companion, menu: 'water', sweetener: 'none', status: 'available', servedU: null },
    ],
  } };
}

export function assertBazaar(state) {
  const bad = () => new BazaarError('invalid-bazaar-save', '손님 맞이 기록을 확인할 수 없어요.', 503);
  const a = state?.allocation;
  if (!state || state.schema !== 1 || !integer(state.uMs) || !Array.isArray(state.emitted)
    || !state.emitted.every(validKey) || new Set(state.emitted).size !== state.emitted.length
    || !Array.isArray(state.history) || !a || a.sourceEventId !== source('requests')
    || a.storyAllocationId !== `${source('requests')}:allocation` || typeof a.accepted !== 'boolean'
    || !Array.isArray(a.portions) || a.portions.length !== 2) throw bad();
  for (let index = 0; index < 2; index++) {
    const p = a.portions[index], id = ['reader', 'companion'][index];
    if (!p || p.id !== id || p.recipient !== who(id) || !same(p, correctMatch[id])
      || !['available', 'reserved', 'served'].includes(p.status)
      || (p.status === 'served') !== (p.servedU !== null)
      || p.servedU !== null && (!integer(p.servedU) || p.servedU > state.uMs)
      || !a.accepted && p.status !== 'available'
      || p.status === 'served' && !state.emitted.includes(`${source('requests')}:served:${id}`)) throw bad();
  }
  const seen = new Set();
  for (const h of state.history) {
    if (!h || !kinds.includes(h.kind) || seen.has(h.kind) || h.resultId !== `${source(h.kind)}:result`
      || !roles.includes(h.role) || !supports.includes(h.support) || !choices[h.kind].includes(h.choice)
      || !integer(h.completedU) || h.completedU > state.uMs
      || !(h.observedU === null || integer(h.observedU) && h.observedU >= h.completedU && h.observedU <= state.uMs)
      || h.contribution !== (h.role === 'planner' ? h.kind === 'requests' ? 'cupMatchingAndOrder' : 'pictureMenuOrder' : null)
      || h.servings !== (h.kind === 'requests' ? 2 : 0)
      || !Array.isArray(h.knownBy) || h.knownBy.join(',') !== (h.kind === 'requests' ? [owner, reader, companion] : [owner, workshop, reader]).join(',')
      || !state.emitted.includes(h.resultId) || h.kind === 'requests' && served(state).length !== 2) throw bad();
    seen.add(h.kind);
  }
  const e = state.episode;
  if (e && (!kinds.includes(e.kind) || e.id !== source(e.kind) || !stages.includes(e.stage) || typeof e.open !== 'boolean'
    || ![null, ...roles].includes(e.role) || !supports.includes(e.support) || !['plain', 'stepwise'].includes(e.languageSupport)
    || e.languageSupportBasis !== undefined && !validSupportSnapshot(e.languageSupportBasis, e.languageSupport)
    || ![null, ...choices[e.kind]].includes(e.choice) || !integer(e.elapsedMs) || e.elapsedMs > 3000
    || !integer(e.part) || e.part > 1 || !integer(e.requestsHeard) || e.requestsHeard > 2
    || !e.matches || !['reader', 'companion'].every(id => e.matches[id] === null
      || ['tea', 'water'].includes(e.matches[id]?.menu) && ['none', 'sweet'].includes(e.matches[id]?.sweetener))
    || !(e.resultId === null || e.resultId === `${e.id}:result` && seen.has(e.kind))
    || (e.stage === 'result') !== (e.resultId !== null)
    || e.stage !== 'role' && !e.role
    || !['role', 'requests', 'requestContinue', 'choice'].includes(e.stage) && !e.choice
    || e.kind === 'requests' && !['role', 'requests', 'requestContinue'].includes(e.stage) && e.requestsHeard !== 2
    || ['preparing', 'serving', 'awaitTea'].includes(e.stage) && (e.kind !== 'requests' || !a.accepted || !matching(e))
    || ['installing', 'looking'].includes(e.stage) && e.kind !== 'pictureMenu'
    || e.stage === 'awaitTea' && (!served(state).some(p => p.id === 'companion') || served(state).some(p => p.id === 'reader')))) throw bad();
  return state;
}

function context(ctx) {
  ensure(ctx && integer(ctx.elapsedMs ?? 0) && typeof ctx.canRun === 'boolean'
    && ['home', 'cafe', 'workshop', 'greenhouse'].includes(ctx.location) && supports.includes(ctx.support)
    && [undefined, 'plain', 'stepwise'].includes(ctx.languageSupport)
    && (ctx.languageSupportBasis === undefined || validSupportSnapshot(ctx.languageSupportBasis, ctx.languageSupport ?? 'plain')),
  'invalid-bazaar-context', '마을 상태를 다시 확인해 주세요.', 503);
  return ctx;
}
function emit(state, facts, factType, sourceKey, knownBy, causes = []) {
  if (state.emitted.includes(sourceKey)) return;
  ensure(causes.every(key => state.emitted.includes(key)), 'bazaar-cause-missing', '앞서 한 일을 먼저 확인해 주세요.', 503);
  state.emitted.push(sourceKey); facts.push({ factType, sourceKey, knownBy: [...knownBy], causes: [...causes] });
}
function requireEpisode(state, allowed) {
  const e = state.episode;
  ensure(e?.open && (!allowed || allowed.includes(e.stage)), 'bazaar-phase-conflict', '지금 진행 중인 손님 맞이를 확인해 주세요.');
  return e;
}
function receiveRequest(state, e, recipient, facts) {
  emit(state, facts, 'bazaar.currentRequest.spoken', `${e.id}:request:${recipient}`, [owner, who(recipient)]);
  e.requestsHeard++;
}
function preview(e) {
  e.elapsedMs = 0;
  e.stage = e.support === 'demo' ? 'demonstration' : e.support === 'plan' ? 'rehearsal' : 'preview';
}
function afterRequests(e) {
  if (e.role === 'planner') e.stage = 'choice';
  else { e.choice = 'together'; e.matches = cloneMatch(); preview(e); }
}
function complete(state, e, facts) {
  const knownBy = e.kind === 'requests' ? [owner, reader, companion] : [owner, workshop, reader];
  const causes = e.kind === 'requests' ? [`${e.id}:served:reader`, `${e.id}:served:companion`] : [`${e.id}:viewed`];
  e.resultId = `${e.id}:result`; e.stage = 'result'; e.elapsedMs = 0;
  emit(state, facts, `bazaar.${e.kind}.${e.role}.completed`, e.resultId, knownBy, causes);
  state.history.push({ kind: e.kind, resultId: e.resultId, role: e.role, support: e.support, choice: e.choice,
    contribution: e.role === 'planner' ? e.kind === 'requests' ? 'cupMatchingAndOrder' : 'pictureMenuOrder' : null,
    servings: e.kind === 'requests' ? 2 : 0, knownBy, completedU: state.uMs, observedU: null });
}
function servePortion(state, e, id, facts) {
  const p = state.allocation.portions.find(row => row.id === id);
  if (p.status === 'served') return;
  ensure(p.status === 'reserved', 'bazaar-portion-missing', '준비할 몫을 다시 확인해 주세요.', 503);
  p.status = 'served'; p.servedU = state.uMs;
  emit(state, facts, 'bazaar.storyPortion.served', `${e.id}:served:${id}`, [owner, who(id)], [`${e.id}:reserved`, `${e.id}:request:${id}`]);
}

export function advanceBazaar(state, input) {
  assertBazaar(state); const ctx = context(input), facts = [], e = state.episode;
  if (!ctx.canRun || ctx.cafeBusy || ctx.location !== 'cafe' || !e?.open) return facts;
  state.uMs += ctx.elapsedMs ?? 0;
  const ms = duration(e.stage);
  if (!ms) return facts;
  e.elapsedMs = Math.min(ms, e.elapsedMs + (ctx.elapsedMs ?? 0));
  if (e.elapsedMs < ms) return facts;
  if (e.stage === 'demonstration') { e.stage = 'awaitContinue'; e.elapsedMs = 0; }
  else if (e.stage === 'rehearsal') { e.stage = 'awaitConfirm'; e.elapsedMs = 0; }
  else if (e.stage === 'preparing') {
    emit(state, facts, 'bazaar.storyPortion.prepared', `${e.id}:prepared:${e.part}`, [owner], [`${e.id}:reserved`]);
    e.stage = 'serving'; e.elapsedMs = 0;
  } else if (e.stage === 'serving') {
    if (e.choice === 'together') { servePortion(state, e, 'reader', facts); servePortion(state, e, 'companion', facts); complete(state, e, facts); }
    else if (e.part === 0) { servePortion(state, e, 'companion', facts); e.stage = 'awaitTea'; e.elapsedMs = 0; }
    else { servePortion(state, e, 'reader', facts); complete(state, e, facts); }
  } else if (e.stage === 'installing') {
    emit(state, facts, 'bazaar.pictureMenu.installed', `${e.id}:installed`, [owner, workshop], [`${e.id}:accepted`]);
    e.stage = 'looking'; e.elapsedMs = 0;
  } else if (e.stage === 'looking') {
    emit(state, facts, 'bazaar.pictureMenu.visitorViewed', `${e.id}:viewed`, [owner, workshop, reader], [`${e.id}:installed`]);
    emit(state, facts, 'bazaar.readerWorkshop.firstConversation', `${e.id}:firstConversation`, [reader, workshop], [`${e.id}:viewed`]);
    complete(state, e, facts);
  }
  assertBazaar(state); return facts;
}

export function commandBazaar(state, type, payload = {}, input) {
  assertBazaar(state); const ctx = context(input), facts = [];
  if (type !== 'BAZAAR_CLOSE' && type !== 'BAZAAR_CANCEL') {
    ensure(ctx.canRun && ctx.location === 'cafe', 'bazaar-place-conflict', '찻집에서 손님 맞이를 이어 주세요.');
    ensure(!ctx.cafeBusy, 'bazaar-owner-busy', '찻집 주인이 하던 일을 마친 뒤 함께해 주세요.');
  }
  switch (type) {
    case 'BAZAAR_START': {
      ensure(kinds.includes(payload.kind), 'invalid-bazaar-kind', '준비된 손님 맞이를 골라 주세요.', 400);
      ensure(!state.episode || state.episode.stage === 'result', 'bazaar-unfinished', '하던 손님 맞이는 이어 할 수 있어요.');
      ensure(!state.history.some(h => h.kind === payload.kind), 'bazaar-already-completed', '이 회차는 수첩에 남아 있어요. 제공한 몫은 다시 만들지 않아요.');
      state.episode = { id: source(payload.kind), kind: payload.kind, stage: 'role', role: null, open: true,
        support: ctx.support, languageSupport: ctx.languageSupport ?? 'plain', elapsedMs: 0, choice: null,
        ...(ctx.languageSupportBasis === undefined ? {} : { languageSupportBasis: structuredClone(ctx.languageSupportBasis) }),
        requestsHeard: 0, matches: { reader: null, companion: null }, part: 0, resultId: null };
      break;
    }
    case 'BAZAAR_ROLE': {
      const e = requireEpisode(state, ['role']);
      ensure(roles.includes(payload.role), 'invalid-bazaar-role', '맡고 싶은 역할을 골라 주세요.', 400);
      e.role = payload.role;
      if (e.kind === 'requests') e.stage = 'requests';
      else {
        emit(state, facts, 'bazaar.pictureMenu.helpAgreed', `${e.id}:helpAgreed`, [owner, workshop]);
        if (e.role === 'planner') e.stage = 'choice';
        else { e.choice = 'picturesFirst'; preview(e); }
      }
      break;
    }
    case 'BAZAAR_ASK': {
      const e = requireEpisode(state, ['requests', 'choice', 'matching', 'preview', 'awaitConfirm', 'correction']);
      ensure(e.kind === 'requests', 'bazaar-no-request', '이 장면은 음식 없는 그림 메뉴예요.');
      if (!e.requestsHeard) receiveRequest(state, e, 'reader', facts);
      if (e.requestsHeard === 1 && e.languageSupport === 'stepwise') e.stage = 'requestContinue';
      else if (e.requestsHeard === 1) { receiveRequest(state, e, 'companion', facts); afterRequests(e); }
      // Hearing an existing request again only reopens the card; it is not new knowledge or progress.
      break;
    }
    case 'BAZAAR_CONTINUE': {
      const e = requireEpisode(state, ['requestContinue', 'awaitContinue']);
      if (e.stage === 'requestContinue') { receiveRequest(state, e, 'companion', facts); afterRequests(e); }
      else e.stage = 'preview';
      e.elapsedMs = 0; break;
    }
    case 'BAZAAR_CHOICE': {
      const e = requireEpisode(state, ['choice', 'matching', 'demonstration', 'awaitContinue', 'preview', 'rehearsal', 'awaitConfirm', 'correction']);
      ensure(e.role === 'planner' && choices[e.kind].includes(payload.choice), 'invalid-bazaar-choice', '지금 맡은 역할의 선택을 확인해 주세요.', 400);
      ensure(e.kind !== 'requests' || served(state).length === 0, 'bazaar-already-served', '이미 드린 몫은 유지하고 남은 차를 이어 드려요.');
      e.choice = payload.choice; e.elapsedMs = 0;
      if (e.kind === 'requests' && !allMatched(e)) e.stage = 'matching'; else preview(e);
      break;
    }
    case 'BAZAAR_MATCH': {
      const e = requireEpisode(state, ['matching', 'preview', 'awaitConfirm', 'correction']);
      ensure(e.kind === 'requests' && e.role === 'planner' && ['reader', 'companion'].includes(payload.recipient)
        && ['tea', 'water'].includes(payload.menu) && ['none', 'sweet'].includes(payload.sweetener), 'invalid-bazaar-match', '잔과 받을 손님을 골라 주세요.', 400);
      ensure(served(state).length === 0, 'bazaar-already-served', '이미 드린 몫을 새 주문으로 바꿀 수는 없어요.');
      e.matches[payload.recipient] = { menu: payload.menu, sweetener: payload.sweetener };
      if (allMatched(e)) preview(e);
      break;
    }
    case 'BAZAAR_CONFIRM': {
      const e = requireEpisode(state, ['preview', 'awaitConfirm']);
      if (e.kind === 'requests') {
        if (!matching(e)) { e.stage = 'correction'; e.elapsedMs = 0; break; }
        state.allocation.accepted = true;
        for (const p of state.allocation.portions) if (p.status !== 'served') p.status = 'reserved';
        emit(state, facts, 'bazaar.storyAllocation.reserved', `${e.id}:reserved`, [owner], [`${e.id}:request:reader`, `${e.id}:request:companion`]);
        if (e.choice === 'waterFirst') emit(state, facts, 'bazaar.reader.waitAgreed', `${e.id}:waitAgreed`, [owner, reader], [`${e.id}:request:reader`]);
        e.stage = 'preparing';
      } else {
        emit(state, facts, 'bazaar.pictureMenu.participationAgreed', `${e.id}:accepted`, [owner, workshop], [`${e.id}:helpAgreed`]);
        e.stage = 'installing';
      }
      e.elapsedMs = 0; break;
    }
    case 'BAZAAR_OWNER_TAKE': {
      const e = requireEpisode(state, ['choice', 'matching', 'preview', 'awaitConfirm', 'correction']);
      ensure(e.kind === 'requests' && served(state).length === 0, 'bazaar-delegation-conflict', '남은 제공 순서를 확인해 주세요.');
      e.role = 'delegated'; e.choice = 'together'; e.matches = cloneMatch(); preview(e); break;
    }
    case 'BAZAAR_TEA_NEXT': {
      const e = requireEpisode(state, ['awaitTea']);
      state.allocation.portions.find(p => p.id === 'reader').status = 'reserved';
      e.part = 1; e.stage = 'preparing'; e.elapsedMs = 0; break;
    }
    case 'BAZAAR_CLOSE':
      ensure(state.episode, 'no-bazaar-episode', '열린 손님 맞이가 없어요.'); state.episode.open = false; break;
    case 'BAZAAR_RESUME':
      ensure(state.episode, 'no-bazaar-episode', '이어 할 손님 맞이가 없어요.'); state.episode.open = true; break;
    case 'BAZAAR_CANCEL': {
      const e = requireEpisode(state);
      if (e.kind === 'requests' && e.stage !== 'result') {
        for (const p of state.allocation.portions) if (p.status === 'reserved') p.status = 'available';
        e.elapsedMs = 0;
        if (served(state).length) e.stage = 'awaitTea';
        else if (e.requestsHeard === 2 && e.choice) e.stage = 'preview';
      }
      e.open = false; break;
    }
    case 'BAZAAR_OBSERVED': {
      const e = requireEpisode(state, ['result']);
      ensure(payload.resultId === e.resultId && payload.visible === true && e.elapsedMs >= 1200, 'bazaar-observation-conflict', '지금 보이는 결과를 확인해 주세요.');
      const h = state.history.find(row => row.resultId === e.resultId);
      if (h.observedU === null) {
        h.observedU = state.uMs;
        emit(state, facts, 'bazaar.result.observed', `${e.resultId}:observed`, h.knownBy, [e.resultId]);
      }
      break;
    }
    default: throw new BazaarError('unknown-bazaar-command', '알 수 없는 손님 맞이 선택이에요.');
  }
  assertBazaar(state); return facts;
}

function sceneFor(state, ctx) {
  const e = state.episode, active = !!e?.open && ctx.location === 'cafe' && !ctx.cafeBusy;
  if (!active) return { active: false, npcs: [], props: [], cafeReserved: false, summary: '하던 손님 맞이는 수첩에 남아 있어요.' };
  const npcs = [{ id: owner, x: -.7, z: -.4, pose: 'talking', goal: '각 손님의 현재 요청 확인' }], props = [];
  const previewing = ['matching', 'demonstration', 'awaitContinue', 'preview', 'rehearsal', 'awaitConfirm', 'correction'].includes(e.stage);
  const moving = ['preparing', 'serving', 'installing', 'looking'].includes(e.stage), p = Math.min(1, e.elapsedMs / (duration(e.stage) || 1));
  const cafe = npcs[0];
  cafe.pose = e.stage === 'demonstration' ? 'showing' : e.stage === 'rehearsal' ? 'walking'
    : ['preparing', 'installing'].includes(e.stage) ? 'working' : e.stage === 'serving' ? 'walking' : e.stage === 'result' ? 'resting' : 'standing';
  cafe.goal = e.stage === 'demonstration' ? '요청표와 잔을 한 쌍씩 시범' : e.stage === 'rehearsal' ? '선택한 계획의 순서만 연습'
    : e.stage === 'preparing' ? '승인된 남은 몫만 준비' : e.stage === 'serving' ? '요청한 손님에게 잔 전달'
      : ['awaitContinue', 'awaitConfirm', 'preview'].includes(e.stage) ? '사용자의 확인 기다리기' : '자기 찻집에서 손님 안내';
  if (e.kind === 'requests') {
    props.push({ id: 'bazaar-table', kind: 'bazaar-table', x: .45, z: 1.05 });
    npcs.push({ id: 'book-guest', x: -.4, z: 2.2, pose: served(state).some(p => p.id === 'reader') ? 'resting' : 'standing', goal: e.requestsHeard ? '지금 요청한 달지 않은 차 기다리기' : '책을 들고 처음 방문하기' },
      { id: 'companion', x: 1.35, z: 2.2, pose: served(state).some(p => p.id === 'companion') ? 'resting' : 'standing', goal: e.requestsHeard === 2 ? '지금 요청한 따뜻한 물 기다리기' : '함께 온 자리에서 현재 필요 말하기' });
    for (const recipient of ['reader', 'companion']) {
      const index = recipient === 'reader' ? 0 : 1, portion = state.allocation.portions[index];
      if (e.requestsHeard > index) props.push({ id: `bazaar-request-${recipient}`, kind: 'request-card', x: index ? 1.35 : -.4, z: .65, label: index ? '따뜻한 물' : '차 · 단맛 없이', drink: index ? 'water' : 'tea', onTable: true });
      const allocated = portion.status === 'reserved', wasServed = portion.status === 'served';
      const preparedThisPart = e.stage === 'serving' && (e.choice === 'together' || e.part === 0 && recipient === 'companion' || e.part === 1 && recipient === 'reader');
      if (e.matches[recipient] && previewing || allocated && ['preparing', 'serving', 'awaitTea'].includes(e.stage) || wasServed) {
        if (e.stage === 'demonstration' && (e.elapsedMs < 1000 ? 'reader' : 'companion') !== recipient) continue;
        const targetX = index ? 1.35 : -.4, menu = previewing ? e.matches[recipient]?.menu : portion.menu;
        const progress = wasServed ? 1 : preparedThisPart ? p : 0, startX = -.8 + index * .5;
        props.push({ id: `bazaar-cup-${recipient}`, kind: menu === 'tea' ? 'tea-cup' : 'water-glass', x: startX + (targetX - startX) * progress, z: .9 + .5 * progress,
          menu, drink: menu, sweetener: previewing ? e.matches[recipient]?.sweetener : 'none', preview: previewing || e.stage === 'preparing', served: wasServed, owner });
      }
    }
    if (e.stage === 'serving') { cafe.x = -.7 + (e.choice === 'waterFirst' && e.part === 0 ? 1.7 : .5) * p; cafe.z = -.1; cafe.pose = 'holding'; }
    if (e.stage === 'rehearsal') { cafe.x = -.7 + 1.6 * Math.sin(Math.PI * p); cafe.z = -.1; }
  } else {
    if (e.stage !== 'role') npcs.push({ id: workshop, x: moving ? 1.6 - p * .6 : 1, z: .75, pose: e.stage === 'installing' ? 'holding' : 'standing', goal: '동의한 그림 가판의 받침 고정' });
    if (['looking', 'result'].includes(e.stage)) npcs.push({ id: 'book-guest', x: .7, z: 2.1, pose: e.stage === 'looking' ? 'walking' : 'resting', goal: '그림 메뉴와 책 받침을 직접 보기' });
    if (e.choice) props.push({ id: 'bazaar-menu-board', kind: 'picture-menu', x: .45, z: .2, preview: previewing, order: e.choice, label: e.choice === 'picturesFirst' ? '큰 그림 → 짧은 글' : '짧은 글 → 큰 그림' },
      { id: 'bazaar-menu-support', kind: 'support', x: .45, z: .25, preview: previewing });
  }
  return { active, npcs, props, cafeReserved: true, summary: e.kind === 'requests' ? '서로 다른 두 요청과 두 잔의 제공 순서' : '음식 없는 그림 가판 · 주인의 안내와 공방의 받침', phase: e.stage };
}

function matchActions(e) {
  const actions = [];
  for (const recipient of ['reader', 'companion']) {
    const options = recipient === 'reader' ? [{ menu: 'tea', sweetener: 'none' }, { menu: 'tea', sweetener: 'sweet' }, { menu: 'water', sweetener: 'none' }] : [{ menu: 'water', sweetener: 'none' }, { menu: 'tea', sweetener: 'none' }];
    for (const option of options) if (!same(e.matches[recipient], option)) actions.push(action('BAZAAR_MATCH', `${whoLabel(recipient)}: ${menuName(option.menu)}${option.sweetener === 'sweet' ? ' + 단맛' : option.menu === 'tea' ? ' · 단맛 없이' : ''}`, { recipient, ...option }));
  }
  return actions;
}
export function viewBazaar(state, input) {
  assertBazaar(state); const ctx = context(input), e = state.episode;
  let line = '두 손님의 현재 요청을 듣거나 음식 없는 그림 메뉴 가판을 준비할 수 있어요.', speaker = '찻집 주인', actions = [];
  const here = ctx.location === 'cafe';
  if (!e?.open) {
    if (here && !ctx.cafeBusy) {
      if (e && e.stage !== 'result') actions.push(action('BAZAAR_RESUME', '하던 손님 맞이 이어 하기', {}, true));
      else for (const kind of kinds) if (!state.history.some(h => h.kind === kind)) actions.push(action('BAZAAR_START', kind === 'requests' ? '두 손님의 요청 듣기' : '그림 메뉴 가판 함께 열기 · 음식 없음', { kind }));
      if (e?.stage === 'result') actions.push(action('BAZAAR_RESUME', '방금 마친 모습 다시 보기'));
    }
    if (ctx.cafeBusy) line = '찻집 주인은 지금 하던 일을 마치고 손님 맞이를 함께할 수 있어요.';
  } else if (!here) line = '찻집에서 하던 손님 맞이는 그대로 남아 있어요.';
  else if (e.stage === 'role') {
    line = e.kind === 'requests' ? '책을 가져온 손님이 동행자와 왔어요. 오늘 어떤 것을 원하는지 직접 물어볼까요?' : '음식을 내지 않는 작은 그림 가판이에요. 주인은 안내하고 공방 주인은 동의한 받침 준비를 맡아요.';
    actions = [action('BAZAAR_ROLE', '같이 골라 볼게요', { role: 'planner' }, true), action('BAZAAR_ROLE', '오늘은 구경할게요', { role: 'observer' }), action('BAZAAR_ROLE', '주인님께 맡길게요', { role: 'delegated' })];
  } else if (e.stage === 'requests') {
    line = '지난 주문을 짐작하지 않고 오늘의 요청을 직접 물어요.';
    actions = [action('BAZAAR_ASK', '오늘은 무엇을 드릴까요?', {}, true)];
  } else if (e.stage === 'requestContinue') {
    speaker = '책을 가져온 손님'; line = '“향은 좋지만 달지 않으면 좋겠어요.” 차예요. 단맛은 넣지 않아요.';
    actions = [action('BAZAAR_CONTINUE', '동행 손님에게도 물어요', {}, true)];
  } else if (e.stage === 'choice') {
    line = e.kind === 'requests' ? '책 손님은 달지 않은 차, 동행 손님은 따뜻한 물을 직접 요청했어요. 각각 준비할까요, 물을 먼저 드릴까요?' : '주인: “그림 가판을 같이 준비해요?” 공방: “좋아요. 제 받침을 가져올게요.” 큰 그림과 짧은 글 가운데 어디부터 놓을까요?';
    actions = e.kind === 'requests' ? [action('BAZAAR_CHOICE', '각자 좋아하는 걸 함께 드려요', { choice: 'together' }), action('BAZAAR_CHOICE', '따뜻한 물을 먼저 드려요', { choice: 'waterFirst' })]
      : [action('BAZAAR_CHOICE', '큰 그림 먼저', { choice: 'picturesFirst' }), action('BAZAAR_CHOICE', '짧은 글 먼저', { choice: 'wordsFirst' })];
  } else if (e.stage === 'matching') {
    line = '요청표를 보며 각각 받을 잔을 미리 골라요. 아직 준비하거나 제공하지 않아요.'; actions = matchActions(e);
  } else if (e.stage === 'demonstration') line = e.kind === 'requests' ? '주인이 요청표 옆에 잔을 하나씩 보여 줘요. 고른 잔을 확인한 뒤 시작해요.' : '공방이 그림판과 받침의 놓는 순서를 먼저 보여 줘요.';
  else if (e.stage === 'awaitContinue') { line = '시범을 봤어요. 준비되면 고른 모습을 확인해 주세요.'; actions = [action('BAZAAR_CONTINUE', '고른 모습 확인하기', {}, true)]; }
  else if (e.stage === 'rehearsal') line = '주인이 고른 계획대로 움직여 봐요. 실제 준비는 마지막 확인 뒤 시작해요.';
  else if (['preview', 'awaitConfirm'].includes(e.stage)) {
    line = e.kind === 'requests' ? e.choice === 'waterFirst' ? '물을 먼저 드리고 책 손님은 차를 기다리는 데 동의해요. 그다음 차는 직접 알려 주면 준비해요.' : '요청한 두 잔을 각각 준비할까요?' : '이 순서로 그림 가판을 놓을까요? 음식 제공과 판매는 없는 모임이에요.';
    actions = [action('BAZAAR_CONFIRM', e.kind === 'requests' ? '이대로 드려요' : '이대로 놓아요', {}, true)];
    if (e.role === 'planner') {
      if (e.kind === 'requests') actions.push(...matchActions(e));
      actions.push(...choices[e.kind].filter(choice => choice !== e.choice).map(choice => action('BAZAAR_CHOICE', ({ together: '두 잔 함께 준비하기', waterFirst: '물부터 준비하기', picturesFirst: '큰 그림 먼저 바꾸기', wordsFirst: '짧은 글 먼저 바꾸기' })[choice], { choice })));
    }
  } else if (e.stage === 'correction') {
    line = !same(e.matches.reader, correctMatch.reader) ? '책 손님은 달지 않은 차를 원해요. 아직 드리지 않았으니 요청표와 잔을 다시 볼까요?' : '동행 손님은 따뜻한 물을 원해요. 아직 드리지 않았으니 바꿔 볼까요?';
    actions = [...matchActions(e), action('BAZAAR_ASK', '요청을 다시 읽어요'), action('BAZAAR_OWNER_TAKE', '주인님이 맡아 주세요')];
  } else if (e.stage === 'preparing') line = e.choice === 'waterFirst' && e.part === 0 ? '주인이 동행 손님의 따뜻한 물부터 준비해요. 차 몫은 남아 있어요.' : e.part === 1 ? '이번에는 책 손님의 달지 않은 차를 준비해요.' : '주인이 달지 않은 차와 따뜻한 물을 각각 준비해요.';
  else if (e.stage === 'serving') line = '주인이 요청한 손님에게 잔을 가져가요. 실제 전달이 끝나면 제공 기록이 남아요.';
  else if (e.stage === 'awaitTea') { line = '동행 손님은 물을 받았어요. 책 손님의 차는 아직 준비할 몫으로 남아 있어요.'; actions = [action('BAZAAR_TEA_NEXT', '이제 차를 드려요', {}, true)]; }
  else if (e.stage === 'installing') line = '공방은 받침을 고정하고, 주인은 고른 순서로 메뉴판을 놓고 있어요.';
  else if (e.stage === 'looking') line = '손님이 그림판을 보고 책 놓을 곳을 살펴요. 공방 주인과 처음으로 책 자리를 이야기해요.';
  else if (e.stage === 'result') {
    const h = state.history.find(h => h.resultId === e.resultId);
    line = e.kind === 'requests' ? '책 손님: “이건 향이 나네요.” 동행 손님: “저는 물을 받았어요.” 서로 원하는 두 잔을 각각 받았어요.' : '손님: “책 놓을 곳도 있네요.” 공방 주인: “책은 이쪽이 덜 흔들려요.” 그림판을 본 뒤 둘이 처음 이야기를 나눴어요.';
    if (h.observedU === null && e.elapsedMs >= 1200) actions.push(action('BAZAAR_OBSERVED', '지금 모습 봤어요', { resultId: e.resultId, visible: true }));
    actions.push(action('BAZAAR_CLOSE', '여기서 마칠게요', {}, true));
  }
  if (e?.open && here && e.stage !== 'result') actions.push(action('BAZAAR_CLOSE', '나중에 이어 할게요'), action('BAZAAR_CANCEL', '남은 준비를 보류할게요'));
  if (ctx.cafeBusy && e?.open) { line = '찻집 주인이 함께 하던 일을 마칠 때까지 현재 준비를 그대로 둘게요.'; actions = [action('BAZAAR_CLOSE', '잠깐 닫기')]; }
  return { title: '요청을 듣고 함께 준비하기', line, speaker, actions,
    episode: e ? { id: e.id, kind: e.kind, stage: e.stage, open: e.open, role: e.role, support: e.support, languageSupport: e.languageSupport, choice: e.choice, resultId: e.resultId, elapsedMs: e.elapsedMs } : null,
    requests: e?.kind === 'requests' ? ['reader', 'companion'].slice(0, e.requestsHeard).map(recipient => ({ recipient, name: whoLabel(recipient), line: recipient === 'reader' ? '향 있는 차 · 단맛을 넣지 않아요' : '따뜻한 물', selected: e.matches[recipient] ? { ...e.matches[recipient] } : null })) : [],
    allocation: { sourceEventId: state.allocation.sourceEventId, storyAllocationId: state.allocation.storyAllocationId, accepted: state.allocation.accepted, portions: state.allocation.portions.map(p => ({ ...p })), playerInventory: false },
    history: state.history.map(h => ({ ...h, knownBy: [...h.knownBy], observed: h.observedU !== null,
      summary: `${h.kind === 'requests' ? '서로 다른 두 요청과 두 잔' : '음식 없는 그림 가판'} · ${h.role === 'planner' ? '함께 정함' : h.role === 'delegated' ? '주인에게 맡김' : h.observedU === null ? '주민의 결과 · 관람 전' : '직접 구경함'}` })),
    scene: sceneFor(state, ctx), limits: ['LS02.2 응대와 LS02.3 음식 없는 그림 가판의 로컬 시제품', '판매·가격·정산·플레이어 음식 재고 없음', 'LS02 전체 완결·실제 언어 능력 평가 아님'] };
}
