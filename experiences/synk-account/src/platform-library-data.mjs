// Shared web/PC selections. No URLs, app permissions, or private product contents.
export const PLATFORM_APP_IDS = Object.freeze(['world','messenger','teacher','path','pulse','partners','care','fortune','rehearsal','family-album']);
// Keep the v1 storage contract, including historical app references. New UI
// selections use the merged catalogue without rewriting an account document.
const RETIRED_PLATFORM_APP_IDS = new Set(['rehearsal','family-album']);
export const ACTIVE_PLATFORM_APP_IDS = Object.freeze(PLATFORM_APP_IDS.filter(id=>id!=='partners'&&!RETIRED_PLATFORM_APP_IDS.has(id)));
export const platformAppId = id => id==='partners'?'pulse':id;
export const platformDisplayAppId = (id,appIds=ACTIVE_PLATFORM_APP_IDS) => platformAppId(id)==='teacher'&&appIds.includes('teacher')&&appIds.includes('messenger')?'messenger':platformAppId(id);
export const platformDisplayAppIds = (appIds=ACTIVE_PLATFORM_APP_IDS) => [...new Set(appIds.filter(id=>ACTIVE_PLATFORM_APP_IDS.includes(id)).map(id=>platformDisplayAppId(id,appIds)))];
export const PLATFORM_NOTE_LIMIT = 60;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw Object.assign(new TypeError('플랫폼 기록 형식을 확인해 주세요.'), { code:'INVALID_PERSONAL_STATE' }); };
const noteLimit = () => { throw Object.assign(new Error('메모는 최대 '+PLATFORM_NOTE_LIMIT+'개까지 보관할 수 있어요. 필요 없는 메모를 삭제한 뒤 다시 시도해 주세요.'), { code:'NOTE_LIMIT' }); };
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value,key));
const stamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
const ids = value => Array.isArray(value) && value.length <= PLATFORM_APP_IDS.length && new Set(value).size === value.length && value.every(id => PLATFORM_APP_IDS.includes(id));
const note = row => exact(row,['id','appId','title','done','createdAt']) && text(row.id,80) && /^[a-zA-Z0-9-]+$/.test(row.id) && PLATFORM_APP_IDS.includes(row.appId) && text(row.title,240) && typeof row.done === 'boolean' && stamp(row.createdAt);
export function emptyPlatformLibrary() { return {version:1,consent:false,favorites:[],recent:[],rememberRecent:true,notes:[]}; }
export function validatePlatformLibrary(value) {
  if (!exact(value,['version','consent','favorites','recent','rememberRecent','notes']) || value.version !== 1 || typeof value.consent !== 'boolean' || !ids(value.favorites) || typeof value.rememberRecent !== 'boolean' || !Array.isArray(value.recent) || value.recent.length > PLATFORM_APP_IDS.length || !Array.isArray(value.notes) || value.notes.length > PLATFORM_NOTE_LIMIT) invalid();
  if ((!value.consent && (value.favorites.length || value.recent.length || value.notes.length)) || (!value.rememberRecent && value.recent.length)) invalid();
  const seen = new Set();
  for (const row of value.recent) { if (!exact(row,['id','at','mode']) || !PLATFORM_APP_IDS.includes(row.id) || !stamp(row.at) || !['web','client'].includes(row.mode) || seen.has(row.id)) invalid(); seen.add(row.id); }
  seen.clear();
  for (const row of value.notes) { if (!note(row) || seen.has(row.id)) invalid(); seen.add(row.id); }
  return structuredClone(value);
}
export function projectPlatformLibrary(value,{appIds=ACTIVE_PLATFORM_APP_IDS}={}) {
  const next=validatePlatformLibrary(value);
  next.favorites=[...new Set(next.favorites.filter(id=>!RETIRED_PLATFORM_APP_IDS.has(id)).map(id=>platformDisplayAppId(id,appIds)))];
  const recent=new Map();
  for(const row of next.recent){if(RETIRED_PLATFORM_APP_IDS.has(row.id))continue;const id=platformDisplayAppId(row.id,appIds),previous=recent.get(id);if(!previous||row.at>previous.at)recent.set(id,{...row,id,...(row.id==='teacher'&&id!==row.id?{entryId:'teacher'}:{})});}
  next.recent=[...recent.values()].sort((a,b)=>b.at-a.at);
  return next;
}
export function updatePlatformLibrary(value, action, now = Date.now(),appIds=ACTIVE_PLATFORM_APP_IDS) {
  const next = validatePlatformLibrary(value);
  if (action.type === 'consent') { if (action.value !== true) return emptyPlatformLibrary(); next.consent=true; return next; }
  if (!next.consent) throw new Error('계정에 저장할 항목을 확인하고 연결을 켜 주세요.');
  if (['favorite','launch','note'].includes(action.type) && !ACTIVE_PLATFORM_APP_IDS.includes(action.id)) invalid();
  if (action.type === 'favorite') next.favorites = next.favorites.some(id=>platformDisplayAppId(id,appIds)===platformDisplayAppId(action.id,appIds)) ? next.favorites.filter(id=>platformDisplayAppId(id,appIds)!==platformDisplayAppId(action.id,appIds)) : [...next.favorites,action.id];
  else if (action.type === 'move-favorite') {
    if (!ACTIVE_PLATFORM_APP_IDS.includes(action.id) || ![-1,1].includes(action.direction)) invalid();
    // Move displayed groups as a unit; legacy Partners/teacher IDs remain intact.
    const groups = new Map();
    for (const id of next.favorites) { const visible = platformDisplayAppId(id,appIds); if (!groups.has(visible)) groups.set(visible,[]); groups.get(visible).push(id); }
    const order = [...groups.keys()], visible = platformDisplayAppIds(appIds), from = order.indexOf(platformDisplayAppId(action.id,appIds));
    if (from < 0 || !visible.includes(order[from])) invalid();
    let to = from + action.direction;
    while (to >= 0 && to < order.length && !visible.includes(order[to])) to += action.direction;
    if (to >= 0 && to < order.length) { [order[from],order[to]]=[order[to],order[from]]; next.favorites=order.flatMap(id=>groups.get(id)); }
  }
  else if (action.type === 'launch' && next.rememberRecent) next.recent=[{id:action.id,at:now,mode:action.mode},...next.recent.filter(row=>platformDisplayAppId(row.id,appIds)!==platformDisplayAppId(action.id,appIds))];
  else if (action.type === 'remember') { next.rememberRecent=action.value; if (!action.value) next.recent=[]; }
  else if (action.type === 'clear-recent') next.recent=[];
  else if (action.type === 'note') { if(next.notes.length>=PLATFORM_NOTE_LIMIT)noteLimit();next.notes.unshift({id:globalThis.crypto.randomUUID(),appId:action.id,title:String(action.title||'').trim(),done:false,createdAt:now}); }
  else if (action.type === 'edit-note') { const row=next.notes.find(row=>row.id===action.noteId);if(!row||!text(action.title,240)||!ACTIVE_PLATFORM_APP_IDS.includes(action.id)&&!(action.id==='partners'&&row.appId==='partners'))invalid();row.title=action.title.trim();row.appId=action.id; }
  else if (action.type === 'restore-note') { if(!note(action.note)||!Number.isSafeInteger(action.index)||action.index<0||action.index>next.notes.length||next.notes.some(row=>row.id===action.note.id))invalid();if(next.notes.length>=PLATFORM_NOTE_LIMIT)noteLimit();next.notes.splice(action.index,0,structuredClone(action.note)); }
  else if (action.type === 'toggle-note') { const row=next.notes.find(row=>row.id===action.noteId);if(!row)invalid();row.done=!row.done; }
  else if (action.type === 'remove-note') next.notes=next.notes.filter(row=>row.id!==action.noteId);
  else if (!['favorite','launch','remember','clear-recent'].includes(action.type)) invalid();
  return validatePlatformLibrary(next);
}
