// Mutation bodies stay in tab memory. An optional checkpoint preserves only
// the authenticated receipt lookup across reload; it cannot authorize a POST.
const clone = value => structuredClone(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const fail = (code, message) => Object.assign(new Error(message), { code });
export function createDatingDelivery({ request, idFactory = () => globalThis.crypto.randomUUID(), checkpoint } = {}) {
  if (typeof request !== 'function' || typeof idFactory !== 'function') throw new TypeError('An authenticated request function is required.');
  if (checkpoint && !['read','write','clear'].every(key=>typeof checkpoint[key]==='function')) throw new TypeError('A receipt checkpoint adapter is required.');
  let pending = null, active = false, generation = 0;
  const clearMarker = () => { if (!checkpoint) return true; try { checkpoint.clear(); return true; } catch { return false; } };
  const clear = () => { generation++; pending = null; const removed=clearMarker(); return checkpoint ? removed : undefined; };
  const recovered = marker => ({ actorId:marker.actorId,demo:marker.demo,requestId:marker.requestId,createdAt:marker.createdAt,checkOnly:true,marker });
  const snapshot = () => pending ? pending.checkOnly ? clone({actorId:pending.actorId,demo:pending.demo,requestId:pending.requestId,createdAt:pending.createdAt,checkOnly:true})
    : clone({ actorId: pending.actorId, demo: pending.demo, ...pending.body,...(checkpoint?{createdAt:pending.createdAt,checkOnly:false}:{}) }) : null;
  const identity = ({ actorId, demo = false }) => {
    if (!pending) throw fail('delivery-no-pending', '확인할 전송이 없어요.');
    if (actorId !== pending.actorId || demo !== pending.demo) { clear(); throw fail('delivery-identity-changed', '계정 연결이 바뀌어 이전 전송 확인을 종료했어요.'); }
    return pending;
  };
  async function operation(record, callback, { checking = false } = {}) {
    if (active) throw fail('delivery-busy', '전송 결과를 확인하고 있어요.');
    active = true; const current = generation;
    try {
      const result = await callback();
      if (current !== generation || pending !== record) throw fail('delivery-identity-changed', '계정 연결이 바뀌어 이전 전송 확인을 종료했어요.');
      if (!checking || result.status === 'applied') { pending = null; if (!clearMarker()) return {...result,checkpointCleanupFailed:true}; }
      return result;
    } catch (error) {
      if (error.code==='delivery-checkpoint-expired') throw error;
      if (current !== generation || pending !== record) throw fail('delivery-identity-changed', '계정 연결이 바뀌어 이전 전송 확인을 종료했어요.');
      // GET transport failures do not prove whether the original POST ran.
      const rejected = Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
      if (rejected || !checking && error.outcomeUnknown !== true) { pending = null; if (error.code!=='checkpoint-exists' && !clearMarker()) error.checkpointCleanupFailed=true; }
      throw error;
    } finally { active = false; }
  }
  const transmit = async record => {
    const response = await request('/action', clone(record.body), { demo: record.demo });
    if (response?.ok !== true || response?.view?.accountId !== record.actorId || !Number.isSafeInteger(response?.view?.revision)
      || !Number.isSafeInteger(response?.appliedRevision) || response.appliedRevision < 0 || response.appliedRevision > response.view.revision
      || !Object.hasOwn(response, 'result')) throw Object.assign(fail('delivery-invalid-response', '전송 결과 응답이 맞지 않아 저장 여부 확인이 필요해요.'), { outcomeUnknown: true });
    return response;
  };
  const markerMatches = async record => {
    if (!checkpoint || !record.marker) return;
    const current=generation, marker=await checkpoint.read({actorId:record.actorId,demo:record.demo},{isCurrent:()=>generation===current && pending===record});
    if (!marker || marker.requestId!==record.requestId || marker.createdAt!==record.marker.createdAt) {
      clear(); throw fail('delivery-checkpoint-expired','전송 확인 표식의 기한이나 연결 범위가 바뀌었어요. 현재 기록을 다시 확인해 주세요.');
    }
  };
  return Object.freeze({
    async send({ actorId, expectedRevision, action, demo = false }) {
      if (pending) {
        if (actorId !== pending.actorId || demo !== pending.demo) { clear(); throw fail('delivery-identity-changed', '계정 연결이 바뀌어 이전 전송 확인을 종료했어요.'); }
        throw fail('delivery-pending', '앞서 보낸 변경의 결과를 먼저 확인해 주세요.');
      }
      if (active) throw fail('delivery-busy', '전송 결과를 확인하고 있어요.');
      if (checkpoint) {
        const current=generation; active=true;
        try { const marker=await checkpoint.read({actorId,demo},{isCurrent:()=>generation===current});
          if (current!==generation) throw fail('delivery-identity-changed','계정 연결이 바뀌어 이전 전송 확인을 종료했어요.');
          if (marker) { pending=recovered(marker); throw fail('delivery-pending','앞서 보낸 변경의 결과를 먼저 확인해 주세요.'); }
        } finally { active=false; }
      }
      const requestId = idFactory();
      if (typeof actorId !== 'string' || !actorId || typeof demo !== 'boolean' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !action || typeof action !== 'object' || Array.isArray(action) || !uuid(requestId)) throw new TypeError('A current actor, revision, action and UUID are required.');
      const record = pending = { actorId, demo, requestId, body: clone({ requestId, expectedRevision, action }) };
      return operation(record, async () => {
        if (checkpoint) { const current=generation; record.marker=await checkpoint.write({actorId,demo,requestId},{isCurrent:()=>generation===current && pending===record}); record.createdAt=record.marker.createdAt; }
        return transmit(record);
      });
    },
    async check(options) {
      const record = identity(options);
      return operation(record, async () => {
        await markerMatches(record);
        const response = await request(`/receipt?requestId=${encodeURIComponent(record.requestId)}`, undefined, { demo: record.demo });
        if (response?.requestId !== record.requestId || !['applied', 'not-found'].includes(response?.status) || response?.view?.accountId !== record.actorId
          || !Number.isSafeInteger(response?.view?.revision) || response.view.revision < 0
          || response.status === 'applied' && (!Number.isSafeInteger(response.appliedRevision) || response.appliedRevision < 0 || response.appliedRevision > response.view.revision || !Object.hasOwn(response, 'result'))) throw fail('delivery-invalid-receipt', '전송 확인 응답이 맞지 않아 다시 확인이 필요해요.');
        return { status: response.status, requestId: record.requestId, currentView: response.view,
          ...(response.status === 'applied' ? { result: response.result, appliedRevision: response.appliedRevision } : {}) };
      }, { checking: true });
    },
    async retry(options) { const record = identity(options); if (record.checkOnly) throw fail('delivery-check-only','이전 전송의 원문은 보관하지 않아요. 저장 여부만 확인할 수 있어요.'); return operation(record, async()=>{await markerMatches(record);return transmit(record);}); },
    async restore({actorId,demo=false}) {
      if (active) throw fail('delivery-busy','전송 결과를 확인하고 있어요.');
      if (pending) { identity({actorId,demo}); return snapshot(); }
      if (!checkpoint) return null;
      active=true; const current=generation;
      try { const marker=await checkpoint.read({actorId,demo},{isCurrent:()=>generation===current});
        if (current!==generation) throw fail('delivery-identity-changed','계정 연결이 바뀌어 이전 전송 확인을 종료했어요.');
        if (marker) pending=recovered(marker); return snapshot();
      } finally { active=false; }
    },
    clear, snapshot,
  });
}
