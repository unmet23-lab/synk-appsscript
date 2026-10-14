/** GOAL-C1: the cafe owner's own work, shared use, and factual recollection.
 * The host supplies elapsed foreground time and the single presentation fence.
 * No browser clock, reward, affinity score, language assessment, or LS completion.
 * Mutations and returned fact descriptors must be committed together by core.
 */
export class LifeError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const ensure = (ok, code, message, status) => { if (!ok) throw new LifeError(code, message, status); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const placements = Object.freeze({ garden: { x: 65, y: 64 }, 'garden-right': { x: 78, y: 68 }, 'eaves-left': { x: 25, y: 54 }, 'eaves-right': { x: 39, y: 54 } });
const roles = ['planner', 'observer', 'delegated'];
const stages = ['role', 'direction', 'preview', 'executing', 'result', 'invalid'];
const contactStates = ['issued', 'delivered', 'detail', 'accepted', 'deferred', 'declined', 'passed', 'cancelled', 'deliveryUnknown'];
const directionText = direction => direction === 'near' ? '자리를 향해' : '통로를 비워';
const action = (type, label, payload = {}) => ({ type, label, payload });
const fact = (factType, sourceKey, causes = []) => ({ factType, sourceKey, causes, knownBy: ['cafe-owner'] });
const freshRoutine = () => ({ worldRevision: null, placement: null, phase: 'waiting', elapsedMs: 0, tidyRecorded: false, useRecorded: false });

export function initialLife() {
  return { schema: 1, uMs: 0, visitStartU: 0, visitIndex: 1, activeVisit: true,
    mode: 'normal', preferenceRevision: 0, restGuard: false, visitDeclined: false,
    authority: { surfaceId: null, fence: 0 }, environment: { worldRevision: 0, placement: null },
    contacts: [], handledNeeds: [], sequence: 0, episode: null, routine: freshRoutine(), currentAgreement: null, history: [] };
}
export function assertLife(life) {
  const invalid = () => new LifeError('invalid-life-save', '주민 생활 기록을 확인할 수 없어요.', 503);
  const validTarget = target => target === null || Object.hasOwn(placements, target);
  if (!life || life.schema !== 1 || !integer(life.uMs) || !integer(life.visitStartU) || life.visitStartU > life.uMs
    || !Number.isSafeInteger(life.visitIndex) || life.visitIndex < 1 || !integer(life.sequence) || !integer(life.preferenceRevision)
    || !['normal', 'lively', 'quiet'].includes(life.mode)
    || !['activeVisit', 'restGuard', 'visitDeclined'].every(key => typeof life[key] === 'boolean')
    || !life.authority || !integer(life.authority.fence) || !(life.authority.surfaceId === null || identifier(life.authority.surfaceId))
    || !life.environment || !integer(life.environment.worldRevision) || !validTarget(life.environment.placement)
    || !Array.isArray(life.contacts) || !Array.isArray(life.history) || !Array.isArray(life.handledNeeds)
    || !life.handledNeeds.every(key => /^C1:(garden|garden-right|eaves-left|eaves-right)$/.test(key))
    || new Set(life.handledNeeds).size !== life.handledNeeds.length) throw invalid();
  const keys = new Set(), ids = new Set();
  for (const c of life.contacts) {
    if (!identifier(c.id) || !identifier(c.contactKey) || keys.has(c.contactKey) || ids.has(c.id)
      || !contactStates.includes(c.status) || !integer(c.issuedU) || c.issuedU > life.uMs
      || !identifier(c.issuedSurfaceId) || !integer(c.issuedFence) || !integer(c.worldRevision)
      || !Object.hasOwn(placements, c.placement) || typeof c.delivered !== 'boolean') throw invalid();
    keys.add(c.contactKey); ids.add(c.id);
  }
  const r = life.routine;
  if (!r || !['waiting', 'tidying', 'walking', 'resting'].includes(r.phase) || !integer(r.elapsedMs) || r.elapsedMs > 6000
    || !(r.worldRevision === null || integer(r.worldRevision)) || !validTarget(r.placement)
    || typeof r.tidyRecorded !== 'boolean' || typeof r.useRecorded !== 'boolean') throw invalid();
  const results = new Set();
  for (const row of life.history) {
    if (!identifier(row.resultId) || results.has(row.resultId) || !roles.includes(row.role) || !['near', 'clear'].includes(row.direction)
      || !integer(row.worldRevision) || !Object.hasOwn(placements, row.placement) || !integer(row.completedU) || row.completedU > life.uMs
      || !(row.observedU === null || integer(row.observedU) && row.observedU >= row.completedU && row.observedU <= life.uMs)) throw invalid();
    results.add(row.resultId);
  }
  const e = life.episode;
  if (e && (!identifier(e.id) || !stages.includes(e.stage) || !integer(e.worldRevision) || !Object.hasOwn(placements, e.placement)
    || ![null, ...roles].includes(e.role) || ![null, 'near', 'clear'].includes(e.direction)
    || !integer(e.elapsedMs) || e.elapsedMs > 6000 || typeof e.open !== 'boolean' || typeof e.delivered !== 'boolean' || typeof e.dismissed !== 'boolean'
    || typeof e.tidyRecorded !== 'boolean' || !(e.contactId === null || life.contacts.some(c => c.id === e.contactId))
    || !(e.resultId === null || results.has(e.resultId))
    || e.stage === 'result' && !e.resultId || ['preview', 'executing', 'result'].includes(e.stage) && (!e.role || !e.direction))) throw invalid();
  const agreement = life.currentAgreement;
  if (agreement && (!results.has(agreement.resultId) || !['planner', 'delegated'].includes(agreement.role)
    || !['near', 'clear'].includes(agreement.direction) || !integer(agreement.worldRevision)
    || !Object.hasOwn(placements, agreement.placement)
    || agreement.worldRevision !== life.environment.worldRevision || agreement.placement !== life.environment.placement)) throw invalid();
  return life;
}
function contextFor(context = {}) {
  ensure(integer(context.worldRevision) && (context.placement === null || Object.hasOwn(placements, context.placement))
    && (context.surfaceId === null || identifier(context.surfaceId)) && integer(context.fence)
    && typeof context.canRun === 'boolean' && typeof context.canContact === 'boolean'
    && (context.elapsedMs === undefined || integer(context.elapsedMs)), 'invalid-life-context', '주민의 현재 자리를 다시 확인해 주세요.', 503);
  return context;
}
function currentContact(life) {
  return [...life.contacts].reverse().find(c => ['issued', 'delivered'].includes(c.status)
    && c.issuedSurfaceId === life.authority.surfaceId && c.issuedFence === life.authority.fence
    && life.uMs - c.issuedU < 20000) || null;
}
function sameWorld(item, ctx) { return item.worldRevision === ctx.worldRevision && item.placement === ctx.placement; }
// A sign revision or replacing the same seat does not invent a new need.
// This small slice has one authored invitation opportunity per actual seat area.
function descriptorKey(ctx) { return `C1:${ctx.placement}`; }
function reconcileWorld(life, ctx) {
  life.environment = { worldRevision: ctx.worldRevision, placement: ctx.placement };
  if (life.currentAgreement && !sameWorld(life.currentAgreement, ctx)) life.currentAgreement = null;
  if (!sameWorld(life.routine, ctx)) life.routine = { ...freshRoutine(), worldRevision: ctx.worldRevision, placement: ctx.placement };
  if (life.episode && !sameWorld(life.episode, ctx) && !life.episode.resultId) life.episode.stage = 'invalid';
  for (const c of life.contacts) if (!sameWorld(c, ctx) && ['issued', 'delivered', 'detail'].includes(c.status)) c.status = 'cancelled';
}
function advanceRoutine(life, elapsedMs, facts) {
  const r = life.routine;
  r.elapsedMs = Math.min(6000, r.elapsedMs + elapsedMs);
  r.phase = r.elapsedMs < 3000 ? 'tidying' : r.elapsedMs < 6000 ? 'walking' : 'resting';
  const source = `C1:routine:${r.worldRevision}:${r.placement}`;
  if (r.elapsedMs >= 3000 && !r.tidyRecorded) { r.tidyRecorded = true; facts.push(fact('cafe.C1.tidied', `${source}:tidied`)); }
  if (r.elapsedMs >= 6000 && !r.useRecorded) { r.useRecorded = true; facts.push(fact('cafe.C1.rested', `${source}:rested`, [`${source}:tidied`])); }
}
function advanceEpisode(life, elapsedMs, facts) {
  const e = life.episode;
  e.elapsedMs = Math.min(6000, e.elapsedMs + elapsedMs);
  if (e.elapsedMs >= 2000 && !e.tidyRecorded) { e.tidyRecorded = true; facts.push(fact('cafe.C1.tidied', `${e.id}:tidied`)); }
  if (e.elapsedMs < 6000) return;
  e.stage = 'result'; e.resultId = `${e.id}:result`;
  life.history.push({ resultId: e.resultId, role: e.role, direction: e.direction, worldRevision: e.worldRevision,
    placement: e.placement, completedU: life.uMs, observedU: null });
  if (e.role !== 'observer') life.currentAgreement = { resultId: e.resultId, role: e.role, direction: e.direction,
    worldRevision: e.worldRevision, placement: e.placement };
  facts.push(fact(`cafe.C1.${e.role}.executed`, e.resultId, [`${e.id}:tidied`]));
  // This body is now resting. The interrupted background plan does not also finish.
  life.routine.phase = 'resting';
}
export function advanceLife(life, context) {
  assertLife(life); const ctx = contextFor(context), facts = [];
  reconcileWorld(life, ctx);
  life.authority = { surfaceId: ctx.surfaceId, fence: ctx.fence };
  if (ctx.visitEnded === true) {
    life.activeVisit = false;
    for (const c of life.contacts) if (['issued', 'delivered'].includes(c.status)) c.status = c.delivered ? 'passed' : 'deliveryUnknown';
    return facts;
  }
  if (!life.activeVisit && ctx.surfaceId !== null) {
    life.activeVisit = true; life.visitIndex++; life.visitStartU = life.uMs; life.visitDeclined = false;
  }
  life.uMs += ctx.elapsedMs || 0;
  ensure(integer(life.uMs), 'invalid-life-context', '생활 시간을 다시 확인해 주세요.', 503);
  for (const c of life.contacts) {
    if (!['issued', 'delivered'].includes(c.status)) continue;
    if (c.issuedSurfaceId !== ctx.surfaceId || c.issuedFence !== ctx.fence) c.status = c.delivered ? 'passed' : 'deliveryUnknown';
    else if (life.uMs - c.issuedU >= 20000) c.status = c.delivered ? 'passed' : 'deliveryUnknown';
  }
  if (ctx.canRun && ctx.placement && life.activeVisit) {
    if (life.episode?.stage === 'executing') advanceEpisode(life, ctx.elapsedMs || 0, facts);
    else {
      // A completed interaction keeps its one actor in its actual final pose.
      if (!life.episode?.resultId || !sameWorld(life.episode, ctx)) advanceRoutine(life, ctx.elapsedMs || 0, facts);
    }
  }
  const contactKey = ctx.placement ? descriptorKey(ctx) : null;
  const recent = life.contacts.filter(c => c.issuedU > life.uMs - 900000 && c.issuedU <= life.uMs);
  const last = life.contacts.at(-1);
  const gap = life.mode === 'lively' ? 90000 : 180000;
  const maximum = life.mode === 'lively' ? 4 : 2;
  const episodeBusy = life.episode && (!['result', 'invalid'].includes(life.episode.stage) || life.episode.open);
  if (life.activeVisit && ctx.canContact && ctx.canRun && ctx.placement && ctx.surfaceId !== null && life.mode !== 'quiet'
    && !life.restGuard && !life.visitDeclined && !episodeBusy && life.uMs - life.visitStartU >= 45000
    && recent.length < maximum && (!last || life.uMs - last.issuedU >= gap)
    && !life.handledNeeds.includes(contactKey) && !life.contacts.some(c => c.contactKey === contactKey)) {
    const id = `C1:contact:${++life.sequence}`;
    life.contacts.push({ id, contactKey, worldRevision: ctx.worldRevision, placement: ctx.placement, status: 'issued',
      delivered: false, issuedU: life.uMs, issuedSurfaceId: ctx.surfaceId, issuedFence: ctx.fence });
    facts.push(fact('cafe.C1.contact.issued', id));
  }
  assertLife(life); return facts;
}
function contactForCommand(life, payload, ctx, allowDetail = true) {
  const c = life.contacts.find(row => row.id === payload.contactId);
  ensure(c && (['issued', 'delivered'].includes(c.status) && life.uMs - c.issuedU < 20000 || allowDetail && c.status === 'detail')
    && sameWorld(c, ctx) && c.issuedSurfaceId === ctx.surfaceId && c.issuedFence === ctx.fence
    && life.authority.surfaceId === ctx.surfaceId && life.authority.fence === ctx.fence,
  'stale-life-contact', '이 초대는 현재 화면에서 다시 확인해 주세요. 직접 생활을 여는 것은 언제든 가능해요.', 409);
  return c;
}
function episodeForCommand(life, ctx, allowed) {
  const e = life.episode;
  ensure(e && allowed.includes(e.stage) && sameWorld(e, ctx) && ctx.canRun && ctx.placement,
    'stale-life-action', '현재 자리를 확인한 뒤 이어가요.', 409);
  return e;
}
export function commandLife(life, type, payload = {}, context) {
  assertLife(life); const ctx = contextFor(context), facts = [];
  ensure(payload && typeof payload === 'object' && !Array.isArray(payload), 'invalid-life-command', '할 일을 다시 골라 주세요.');
  reconcileWorld(life, ctx);
  switch (type) {
    case 'LIFE_PREFERENCE':
      ensure(['quiet', 'normal', 'lively'].includes(payload.mode), 'invalid-life-preference', '주민이 먼저 다가오는 정도를 골라 주세요.');
      if (life.mode !== payload.mode) { life.mode = payload.mode; life.preferenceRevision++; }
      if (life.mode === 'quiet') for (const c of life.contacts) if (['issued', 'delivered'].includes(c.status)) c.status = 'cancelled';
      break;
    case 'LIFE_OPEN': {
      ensure(ctx.canRun && ctx.placement, 'life-unavailable', '하던 장면이 끝난 뒤 주인의 자리를 볼 수 있어요.', 409);
      ensure(['direct', 'contact'].includes(payload.source), 'invalid-life-command', '생활을 여는 방법을 확인해 주세요.');
      const contact = payload.source === 'contact' ? contactForCommand(life, payload, ctx) : null;
      if (contact) contact.status = 'detail';
      const need = descriptorKey(ctx);
      if (!life.handledNeeds.includes(need)) life.handledNeeds.push(need);
      if (payload.source === 'direct') {
        // Opening the same work yourself consumes its existing invitation, too.
        // Keep issuedU and the canonical key: this is not a budget refund.
        for (const c of life.contacts) if (c.contactKey === need && ['issued', 'delivered', 'detail'].includes(c.status)) c.status = 'cancelled';
      }
      const old = life.episode;
      if (old && sameWorld(old, ctx) && !['result', 'invalid'].includes(old.stage)) { old.open = true; break; }
      life.episode = { id: `C1:episode:${++life.sequence}`, worldRevision: ctx.worldRevision, placement: ctx.placement,
        stage: 'role', role: null, direction: null, elapsedMs: 0, open: true, delivered: false, dismissed: false, tidyRecorded: false,
        resultId: null, contactId: contact?.id || null };
      break;
    }
    case 'LIFE_ROLE': {
      const e = episodeForCommand(life, ctx, ['role', 'direction', 'preview']);
      ensure(roles.includes(payload.role), 'invalid-life-role', '함께 정하기, 구경하기, 맡기기 중 골라 주세요.');
      e.role = payload.role; e.direction = payload.role === 'planner' ? null
        : payload.role === 'observer' ? life.currentAgreement?.direction || 'clear' : 'clear';
      e.stage = payload.role === 'planner' ? 'direction' : 'preview'; break;
    }
    case 'LIFE_DIRECTION': {
      const e = episodeForCommand(life, ctx, ['direction', 'preview']);
      ensure(e.role === 'planner' && ['near', 'clear'].includes(payload.direction), 'invalid-life-direction', '지금 가능한 방향을 골라 주세요.');
      e.direction = payload.direction; e.stage = 'preview'; break;
    }
    case 'LIFE_CONFIRM': {
      const e = episodeForCommand(life, ctx, ['preview']); e.stage = 'executing'; e.elapsedMs = 0;
      if (e.contactId) {
        const c = life.contacts.find(row => row.id === e.contactId);
        if (c?.status === 'detail') c.status = 'accepted';
      }
      break;
    }
    case 'LIFE_ACK': {
      ensure(payload.visible === true, 'incomplete-life-ack', '실제로 보인 결과만 기록해요.');
      if (payload.contactId) {
        const c = contactForCommand(life, payload, ctx);
        if (!c.delivered) { c.delivered = true; if (c.status === 'issued') c.status = 'delivered'; facts.push(fact('cafe.C1.contact.delivered', `${c.id}:delivered`, [c.id])); }
      } else {
        const e = episodeForCommand(life, ctx, ['result']);
        ensure(payload.resultId === e.resultId, 'stale-life-result', '지금 보이는 결과를 다시 확인해 주세요.', 409);
        if (!e.delivered) {
          e.delivered = true; life.history.find(row => row.resultId === e.resultId).observedU = life.uMs;
          facts.push(fact('cafe.C1.result.observed', `${e.resultId}:observed`, [e.resultId]));
        }
      }
      break;
    }
    case 'LIFE_DECLINE': case 'LIFE_DEFER': {
      const c = contactForCommand(life, payload, ctx);
      c.status = type === 'LIFE_DECLINE' ? 'declined' : 'deferred';
      if (type === 'LIFE_DECLINE') life.visitDeclined = true;
      if (life.episode?.contactId === c.id && !['executing', 'result'].includes(life.episode.stage)) life.episode = null;
      break;
    }
    case 'LIFE_CLOSE':
      if (life.episode) { life.episode.open = false; if (life.episode.stage === 'result') life.episode.dismissed = true; }
      break;
    case 'LIFE_REST':
      life.restGuard = true; if (life.episode) { life.episode.open = false; if (life.episode.stage === 'result') life.episode.dismissed = true; }
      for (const c of life.contacts) if (['issued', 'delivered'].includes(c.status)) c.status = 'cancelled';
      break;
    case 'LIFE_RESUME': life.restGuard = false; break;
    default: throw new LifeError('unknown-life-command', '지금 할 수 있는 생활을 골라 주세요.');
  }
  assertLife(life); return facts;
}
function memoryFor(row) {
  if (row.role === 'planner') return `함께 정한 자리: 주인이 ${directionText(row.direction)} 잔을 정리하고 쉬었어요.`;
  if (row.role === 'delegated') return '맡긴 일: 주인이 자기 방식으로 통로를 비우고 쉬었어요.';
  return row.observedU === null ? '주인이 자기 잔을 정리하고 쉬었어요. 아직 함께 본 기록은 없어요.' : '함께 본 일: 주인이 자기 잔을 정리하고 쉬는 모습을 봤어요.';
}
function greetingFor(life) {
  const row = life.history.at(-1);
  if (!row) return '잔을 정리하고 잠깐 쉬려고 해요. 어떻게 함께할까요?';
  const recalled = row.role === 'planner' ? `지난번에는 ${row.direction === 'near' ? '자리 가까운 쪽' : '통로가 넓은 쪽'}을 골라 주셨지요.`
    : row.role === 'delegated' ? '지난번에 맡겨 주신 잔 정리는 제가 마쳤어요.'
      : row.observedU !== null ? '지난번에는 제가 쉬는 모습을 함께 봤지요.'
        : '지난번에는 제가 잔을 정리하고 쉬었어요.';
  return `${recalled} 이번에는 어떻게 함께할까요?`;
}
export function viewLife(life, context = {}) {
  assertLife(life);
  const ctx = { ...life.environment, canRun: true, ...context };
  const e = life.episode, active = e && sameWorld(e, ctx);
  const r = life.routine, seat = placements[ctx.placement] || { x: 25, y: 54 };
  const committedEpisode = active && ['executing', 'result'].includes(e.stage);
  const direction = committedEpisode && e.direction || life.currentAgreement?.direction || 'clear';
  const working = active && e.stage === 'executing';
  const phase = working ? e.elapsedMs < 2000 ? 'tidying' : e.elapsedMs < 4000 ? 'walking' : 'settling'
    : active && e.resultId ? 'resting' : r.phase;
  const start = { x: 42, y: 60 }, destination = { x: Math.min(90, seat.x + (direction === 'near' ? 13 : 20)), y: seat.y + (direction === 'near' ? 2 : 9) };
  const moveT = phase === 'walking' ? Math.min(1, Math.max(0, working ? (e.elapsedMs - 2000) / 2000 : (r.elapsedMs - 3000) / 3000)) : phase === 'resting' || phase === 'settling' ? 1 : 0;
  const owner = { x: start.x + (destination.x - start.x) * moveT, y: start.y + (destination.y - start.y) * moveT,
    pose: phase === 'tidying' ? 'tidying' : phase === 'walking' ? 'walking' : phase === 'resting' || phase === 'settling' ? 'resting' : 'standing' };
  const prop = { x: phase === 'tidying' ? 46 : Math.min(92, seat.x + (direction === 'near' ? 10 : 22)),
    y: phase === 'tidying' ? 60 : seat.y + (direction === 'near' ? -1 : 11), pose: phase === 'waiting' ? 'hidden' : 'placed' };
  const contact = currentContact(life);
  if (contact && life.uMs - contact.issuedU < 8000 && !working) { owner.pose = 'inviting'; }
  let interaction = null;
  if (e && !e.dismissed && (e.open || ['executing', 'result'].includes(e.stage))) {
    let line = '', actions = [];
    if (e.stage === 'invalid' || !active) { line = '자리가 바뀌었어요. 지금 가능한 자리를 다시 볼까요?'; actions = [action('LIFE_OPEN', '현재 자리 다시 보기', { source: 'direct' })]; }
    else if (e.stage === 'role') {
      line = greetingFor(life);
      actions = [action('LIFE_ROLE', '함께 방향을 정할게요', { role: 'planner' }), action('LIFE_ROLE', '보기만 할게요', { role: 'observer' }), action('LIFE_ROLE', '주인에게 맡길게요', { role: 'delegated' })];
    } else if (e.stage === 'direction') {
      line = '잔은 어느 쪽에 두면 좋을까요?';
      actions = [action('LIFE_DIRECTION', '자리 가까이', { direction: 'near' }), action('LIFE_DIRECTION', '통로를 넓게', { direction: 'clear' })];
    } else if (e.stage === 'preview') {
      line = e.role === 'planner' ? `${directionText(e.direction)} 놓을게요. 이대로 할까요?` : e.role === 'observer' ? `저는 ${directionText(e.direction)} 잔을 정리하고 쉴게요. 편하게 구경해요.` : '그럼 제가 통로를 비우고 쉬는 자리를 준비할게요.';
      actions = [action('LIFE_CONFIRM', e.role === 'observer' ? '구경할게요' : '좋아요'), action('LIFE_ROLE', '역할 다시 고르기', { role: 'planner' })];
    } else if (e.stage === 'executing') line = phase === 'tidying' ? '주인이 자기 잔을 정리하고 있어요.' : phase === 'walking' ? '주인이 고른 쪽으로 이동해요.' : '주인이 자리를 확인하고 쉬어요.';
    else if (e.stage === 'result') {
      line = e.role === 'planner' ? `골라 주신 대로 ${directionText(e.direction)} 놓았어요.` : e.role === 'delegated' ? '맡겨 주신 자리를 이렇게 준비했어요.' : '제 잔을 정리했어요. 이제 잠깐 쉴게요.';
      actions = [action('LIFE_REST', '여기서 쉴게요'), action('LIFE_CLOSE', '계속 둘러보기')];
    }
    if (['role', 'direction', 'preview'].includes(e.stage)) {
      const c = life.contacts.find(row => row.id === e.contactId);
      if (c?.status === 'detail' && c.issuedSurfaceId === life.authority.surfaceId && c.issuedFence === life.authority.fence) {
        actions.push(action('LIFE_DEFER', '나중에요', { contactId: c.id }), action('LIFE_DECLINE', '이번에는 안 할게요', { contactId: c.id }));
      } else actions.push(action('LIFE_CLOSE', '나중에요'));
    }
    interaction = { id: e.id, stage: active ? e.stage : 'invalid', line, actions, resultId: e.resultId,
      role: e.role, direction: e.direction, delivered: e.delivered, open: e.open };
  }
  return { mode: life.mode, canStart: ctx.canRun === true && !!ctx.placement, restGuard: life.restGuard,
    background: { phase, owner, prop, line: phase === 'tidying' ? '주인이 자기 잔을 정리해요.' : phase === 'walking' ? '주인이 쉬는 자리로 가요.' : phase === 'resting' ? '주인이 잠깐 쉬어요.' : '주인이 자기 일을 하고 있어요.' },
    contact: contact ? { id: contact.id, label: '잔을 놓을 방향을 함께 볼까요?', state: contact.status,
      issuedSurfaceId: contact.issuedSurfaceId, issuedFence: contact.issuedFence, bodyWaiting: life.uMs - contact.issuedU < 8000 } : null,
    interaction, memory: life.history.slice(-6).map(memoryFor), currentAgreement: life.currentAgreement ? { ...life.currentAgreement } : null };
}
