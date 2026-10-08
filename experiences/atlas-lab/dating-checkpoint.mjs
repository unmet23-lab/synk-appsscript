// sessionStorage contains only a receipt lookup marker. No mutation body,
// revision, profile, preference, schedule or credential enters this adapter.
export const DATING_CHECKPOINT_KEY = 'synk.dating.delivery.checkpoint.v1';
const DAY = 86400000, MAX_LENGTH = 1024;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const actor = value => typeof value === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
const error = (code, message) => Object.assign(new Error(message), { code });
const available = callback => { try { return callback(); } catch { throw error('checkpoint-storage-unavailable', '이 탭의 전송 확인 표식을 읽거나 정리하지 못했어요. 저장 여부는 별도로 확인해야 해요.'); } };
export function createDatingCheckpoint({ storage = globalThis.sessionStorage, binding, clock = () => Date.now(), maxAgeMs = DAY } = {}) {
  if (!storage || !['getItem','setItem','removeItem'].every(key => typeof storage[key] === 'function') || !['string','function'].includes(typeof binding)
    || typeof clock !== 'function' || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > DAY) throw new TypeError('Session storage, a public client binding and a bounded lifetime are required.');
  const now = () => { const value = new Date(clock()).getTime(); if (!Number.isSafeInteger(value)) throw new TypeError('A valid checkpoint clock is required.'); return value; };
  const guard = isCurrent => { if (!isCurrent()) throw error('checkpoint-operation-cancelled', '계정 연결이 바뀌어 이전 전송 표식 보관을 종료했어요.'); };
  async function fingerprint() {
    const value = typeof binding === 'function' ? binding() : binding;
    if (typeof value !== 'string' || !value || value.length > 4096) throw error('checkpoint-binding-unavailable', '현재 계정의 전송 확인 범위를 읽지 못했어요.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
  }
  const clear = () => available(() => storage.removeItem(DATING_CHECKPOINT_KEY));
  function parse(raw, expected, digest) {
    if (typeof raw !== 'string' || raw.length > MAX_LENGTH) return null;
    let value; try { value=JSON.parse(raw); } catch { return null; }
    if (!value || Object.getPrototypeOf(value)!==Object.prototype || Object.keys(value).length!==6
      || Object.keys(value).some(key=>!['version','requestId','actorId','demo','binding','createdAt'].includes(key))
      || value.version!==1 || !uuid(value.requestId) || !actor(value.actorId) || typeof value.demo!=='boolean'
      || typeof value.binding!=='string' || !/^[a-f0-9]{64}$/.test(value.binding) || typeof value.createdAt!=='string') return null;
    const created=Date.parse(value.createdAt), at=now();
    if (!Number.isFinite(created) || new Date(created).toISOString()!==value.createdAt || created>at+300000 || at-created>=maxAgeMs
      || value.actorId!==expected.actorId || value.demo!==expected.demo || value.binding!==digest) return null;
    return value;
  }
  const scope = expected => { if (!expected || !actor(expected.actorId) || typeof expected.demo!=='boolean') throw new TypeError('A current actor and product mode are required.'); };
  async function read(expected, { isCurrent = () => true } = {}) {
    scope(expected); const digest=await fingerprint(); guard(isCurrent);
    const raw=available(()=>storage.getItem(DATING_CHECKPOINT_KEY)); if (raw===null) return null;
    const value=parse(raw,expected,digest); if (!value) { guard(isCurrent); clear(); } return value;
  }
  async function write({ actorId, demo, requestId }, { isCurrent = () => true } = {}) {
    scope({actorId,demo}); if (!uuid(requestId)) throw new TypeError('A receipt UUID is required.');
    const digest=await fingerprint(); guard(isCurrent);
    const raw=available(()=>storage.getItem(DATING_CHECKPOINT_KEY)), old=raw===null?null:parse(raw,{actorId,demo},digest);
    if (old && old.requestId!==requestId) throw error('checkpoint-exists','앞서 보낸 변경의 저장 여부를 먼저 확인해 주세요.');
    const marker=old || {version:1,requestId,actorId,demo,binding:digest,createdAt:new Date(now()).toISOString()};
    const text=JSON.stringify(marker); guard(isCurrent); available(()=>storage.setItem(DATING_CHECKPOINT_KEY,text));
    if (available(()=>storage.getItem(DATING_CHECKPOINT_KEY))!==text) throw error('checkpoint-storage-unavailable','이 탭의 전송 확인 표식을 보관하지 못했어요. 변경은 보내지 않았어요.');
    return {...marker};
  }
  return Object.freeze({read,write,clear,maxAgeMs});
}
