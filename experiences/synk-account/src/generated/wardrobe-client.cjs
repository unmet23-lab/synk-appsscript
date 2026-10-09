'use strict';
const { COSTUMES, BACKGROUNDS } = require('./wardrobe-catalog.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => Object.assign(new Error(message), { code });
const costume = id => COSTUMES.find(item => item.id === id);
const background = id => BACKGROUNDS.some(item => item.id === id);
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function starterWardrobe(defaultCostumeId = 'mongle-basic') {
  return { revision: 0, equipped: { costumeId: costume(defaultCostumeId)?.grant === 'starter' ? defaultCostumeId : 'mongle-basic', backgroundId: 'paper' },
    looks: [], photos: [], grants: COSTUMES.filter(item => item.grant === 'starter').map(item => ({ costumeId: item.id, source: 'starter', earnedAt: null })) };
}
function validWardrobe(value) {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.grants)) throw fail('INVALID_CACHE', '옷장 기록을 읽지 못했어요. 원래 기록을 보존했어요.');
  const owned = new Set();
  for (const grant of value.grants) {
    const item = costume(grant?.costumeId);
    if (!item || owned.has(item.id) || grant.source !== item.grant || !(instant(grant.earnedAt) || item.grant === 'starter' && grant.earnedAt === null)) throw fail('INVALID_CACHE', '옷의 획득 기록을 읽지 못했어요. 원래 기록을 보존했어요.');
    owned.add(item.id);
  }
  const validLook = look => look && costume(look.costumeId) && owned.has(look.costumeId) && background(look.backgroundId);
  if (!validLook(value.equipped) || !Array.isArray(value.looks) || value.looks.length > 12 || !Array.isArray(value.photos) || value.photos.length > 30) throw fail('INVALID_CACHE', '옷장 기록을 읽지 못했어요. 원래 기록을 보존했어요.');
  for (const items of [value.looks, value.photos]) {
    const ids = new Set();
    for (const item of items) {
      if (!validLook(item) || typeof item.id !== 'string' || !item.id || item.id.length > 80 || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 40) throw fail('INVALID_LOOK', '차림 이름과 보유한 옷을 다시 확인해 주세요.');
      ids.add(item.id);
    }
  }
  for (const photo of value.photos) {
    if (!instant(photo.createdAt)) throw fail('INVALID_CACHE', '사진 날짜를 읽지 못했어요. 원래 기록을 보존했어요.');
  }
  return clone(value);
}
function createWardrobeController({ owner, storage, client, guard = () => {}, onChange = () => {}, defaultCostumeId }) {
  if (typeof owner !== 'string' || !owner || !storage?.read || !storage?.write) throw new TypeError('An owner and durable wardrobe storage are required');
  let alive = true, record, state = { wardrobe: starterWardrobe(defaultCostumeId), progress: { completedActivities: 0, learningConnected: false, nextMilestone: null }, phase: 'loading', notice: '', pending: false, busy: false, ready: false, conflict: null };
  const check = () => { if (!alive) throw fail('DISPOSED', '옷장을 닫았어요.'); guard(); };
  const snapshot = () => clone(state);
  const emit = () => { check(); onChange(snapshot()); };
  const cloud = () => typeof client?.wardrobeLoad === 'function' && typeof client?.wardrobeSave === 'function';
  const authentication = error => [401, 403].includes(error?.status) || ['AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_EXPIRED', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN'].includes(error?.code);
  const unavailableService = error => ['CONFIG', 'NOT_FOUND', 'FUNCTION_NOT_FOUND', 'WARDROBE_UNAVAILABLE', 'FEATURE_DISABLED'].includes(error?.code) || error?.status === 404;
  const unavailable = error => !authentication(error) && (error?.retryable || unavailableService(error) || error?.code === 'NETWORK');
  async function persist(wardrobe, { pending, baseRevision, progress = state.progress }) {
    check();
    const value = { version: 1, owner, wardrobe: validWardrobe(wardrobe), progress: clone(progress), pending, baseRevision };
    await storage.write(value); check(); record = value;
    Object.assign(state, { wardrobe: clone(value.wardrobe), progress: clone(progress), pending });
  }
  async function accept(response) {
    check(); const wardrobe = validWardrobe(response?.wardrobe);
    await persist(wardrobe, { pending: false, baseRevision: wardrobe.revision, progress: response.progress || state.progress });
    Object.assign(state, { phase: 'account', notice: '계정에 저장되어 다른 기기에서도 이어져요.', conflict: null });
  }
  function post(wardrobe, revision) {
    check(); return client.wardrobeSave({ expected_revision: revision, equipped: clone(wardrobe.equipped), looks: clone(wardrobe.looks), photos: clone(wardrobe.photos) });
  }
  function showError(error) {
    check();
    state.phase = unavailable(error) ? 'device' : 'error';
    state.notice = authentication(error) ? `${state.pending ? '이 기기에 저장한 변경은 보관하고 있어요. ' : ''}계정 연결을 다시 확인해 주세요.`
      : unavailableService(error) ? `${state.pending ? '이 기기에 저장했어요. ' : ''}계정 보관 기능은 아직 사용할 수 없어요.`
      : unavailable(error) ? state.pending ? '이 기기에 저장했어요. 계정에는 아직 보내지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.' : '계정의 옷장을 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'
      : error?.message || '옷장을 저장하지 못했어요. 다시 확인해 주세요.';
  }
  async function retrieve() {
    if (!cloud()) { state.phase = 'device'; state.notice = '이 기기에 보관하는 옷장이에요.'; return; }
    const remote = await client.wardrobeLoad(); check(); validWardrobe(remote?.wardrobe);
    if (state.pending) {
      if (record.baseRevision !== remote.wardrobe.revision) {
        state.conflict = clone(remote); state.phase = 'conflict'; state.notice = '계정의 옷장이 달라졌어요. 이 기기의 차림과 계정 차림 중 이어 쓸 것을 골라 주세요.'; return;
      }
      // Only the server can add activity rewards. A local draft cannot supply grants.
      const draft = { ...state.wardrobe, grants: remote.wardrobe.grants };
      state.notice = '이 기기의 변경을 계정에 저장하고 있어요.'; emit();
      await accept(await post(draft, remote.wardrobe.revision));
    } else await accept(remote);
  }
  async function init() {
    if (state.ready || state.busy) return snapshot();
    state.busy = true; state.notice = '옷장 기록을 확인하고 있어요.'; emit();
    try {
      const saved = await storage.read(); check();
      if (saved) {
        if (saved.owner !== owner || saved.version !== 1 || !Number.isSafeInteger(saved.baseRevision)) throw fail('INVALID_CACHE', '이 계정의 옷장 기록을 읽지 못했어요. 원래 기록을 보존했어요.');
        record = clone(saved); state.wardrobe = validWardrobe(saved.wardrobe); state.progress = saved.progress || state.progress; state.pending = saved.pending === true;
      } else await persist(state.wardrobe, { pending: false, baseRevision: 0 });
      state.ready = true;
      try { await retrieve(); } catch (error) { showError(error); }
    } catch (error) { if (alive) { state.phase = 'error'; state.notice = error.message; } }
    finally { if (alive) { state.busy = false; emit(); } }
    return snapshot();
  }
  async function refresh() {
    check(); if (!state.ready) return init(); if (state.busy) return snapshot();
    state.busy = true; state.notice = cloud() ? '계정의 옷장을 확인하고 있어요.' : '이 기기의 옷장을 확인하고 있어요.'; emit();
    try { await retrieve(); } catch (error) { showError(error); }
    finally { if (alive) { state.busy = false; emit(); } }
    return snapshot();
  }
  async function save(values) {
    check();
    if (!state.ready || state.busy || state.conflict) throw fail('BUSY', '옷장 확인이 끝난 뒤 다시 해 주세요.');
    if (!values || Object.keys(values).some(key => !['equipped', 'looks', 'photos'].includes(key))) throw fail('INVALID_LOOK', '착용할 차림을 다시 확인해 주세요.');
    const next = validWardrobe({ ...state.wardrobe, ...clone(values) });
    state.busy = true; state.notice = '차림을 이 기기에 저장하고 있어요.'; emit();
    try {
      await persist(next, { pending: true, baseRevision: record.baseRevision });
      state.notice = cloud() ? '이 기기에 보관했어요. 계정에 저장하고 있어요.' : '이 기기에 저장했어요.'; emit();
      if (cloud()) {
        try { await accept(await post(next, record.baseRevision)); }
        catch (error) {
          if (error?.code === 'REVISION_CONFLICT') await retrieve();
          else { showError(error); if (!unavailable(error)) throw error; }
        }
      } else { state.phase = 'device'; state.notice = '이 기기에 저장했어요.'; }
    } catch (error) { showError(error); throw error; }
    finally { if (alive) { state.busy = false; emit(); } }
    return snapshot();
  }
  async function resolveConflict(choice) {
    check(); if (!state.conflict || state.busy || !['device', 'account'].includes(choice)) throw fail('NO_CONFLICT', '옷장을 다시 확인해 주세요.');
    state.busy = true; state.notice = choice === 'account' ? '계정의 차림을 불러오고 있어요.' : '선택한 차림을 이 기기에 저장하고 있어요.'; emit();
    try {
      const remote = state.conflict;
      if (choice === 'account') await accept(remote);
      else {
        const draft = validWardrobe({ ...state.wardrobe, grants: remote.wardrobe.grants });
        // Save the user's decision before transmitting, so a lost response retains the draft.
        await persist(draft, { pending: true, baseRevision: remote.wardrobe.revision });
        state.notice = '이 기기에 보관했어요. 계정에 저장하고 있어요.'; emit();
        await accept(await post(draft, remote.wardrobe.revision));
      }
    } catch (error) { if (error?.code === 'REVISION_CONFLICT') await retrieve(); else showError(error); }
    finally { if (alive) { state.busy = false; emit(); } }
    return snapshot();
  }
  return { init, refresh, save, resolveConflict, snapshot, dispose() { alive = false; } };
}
module.exports = { createWardrobeController, starterWardrobe, validWardrobe };
