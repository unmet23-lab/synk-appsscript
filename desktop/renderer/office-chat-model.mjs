// 솔리오 「사무실」 방의 대화 짜임(2026-11-25) 자료. DOM이 없다.
// 설계: docs/디자인/솔리오_사무실대화_20261124/PC앱_옮기기.md. 시안: 같은 폴더 대화.html.
// officeRoom(office-room.mjs)이 만든 줄과 맡긴 일로 왼쪽 목록(대화 상대), 방 머리, 가운데 · 오른쪽 칸에 세울 줄을 만든다.
// 상대 열쇠: 'all'(사무실, 모든 일) · 'd:<부서 id>' · 'lobby'(부서 없는 일). 줄의 꼴과 안쪽 [종류, …]는 solio-rooms.mjs와 같다.
// 줄의 pin이 참이면 화면은 그 줄을 「펼친 채 고정」으로 그린다(접는 머리가 없고 안쪽이 늘 열려 있다).
import { solioTaskItem } from './solio-queue.mjs';
import { countWord } from './office-model.mjs';
import { josa } from './solio-today.mjs';

export const OFFICE_CHAT_ALL = 'all';
export const OFFICE_CHAT_NAME = '사무실';
/* 맡기기가 꺼진 판(배포판)의 입력칸 자리 안내 */
export const OFFICE_CHAT_OFF_SAY = Object.freeze({
  all: '일 맡기기는 아직 준비 중입니다. 부서 폴더에서 Claude Code나 Codex를 켜면 그 부서의 직원으로 섭니다.',
  dept: '일 맡기기는 아직 준비 중입니다. 이 부서 폴더에서 Claude Code나 Codex를 켜면 여기에 직원으로 섭니다.',
});
/* 부서가 하나도 없을 때 가운데의 안내. 맡기기가 꺼진 판은 맡긴다고 말하지 않고, 아래 「준비 중」 줄도 두지 않는다(카본 화면 검수 A3) */
export const OFFICE_CHAT_EMPTY_SAY = Object.freeze({
  on: '부서를 하나 만들면 그 부서에 일을 맡길 수 있습니다.',
  off: '부서를 하나 만들고 폴더를 정하면, 그 폴더에서 켠 Claude Code와 Codex가 그 부서의 직원으로 섭니다.',
});
export const OFFICE_CHAT_EMPTY_DEPT = '이 부서 폴더에서 Claude Code나 Codex를 켜면 여기에 섭니다.';

const firstLine = s => String(s ?? '').split('\n').map(l => l.trim()).find(Boolean) || '';
const clip = (s, n) => { const a = [...String(s)]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* 상대 열쇠가 고를 수 있는 것인가 */
export const officeChatKeyOk = (key, { departments = [], lobby = false } = {}) =>
  key === OFFICE_CHAT_ALL || (key === 'lobby' && lobby) || (typeof key === 'string' && key.startsWith('d:') && departments.some(d => 'd:' + d.id === key));
/* 맡긴 일이 서는 대화. 부서가 없거나 뺀 부서의 일은 「사무실」이다 */
export function officeTaskChatKey(t, departments = []) {
  const id = t?.departmentId;
  return id != null && departments.some(d => d.id === id) ? 'd:' + id : OFFICE_CHAT_ALL;
}
/* 상대 열쇠의 보낼 부서(입력칸의 부서). 「사무실」과 「부서 없는 일」은 부서가 없다 */
export const officeChatDepartment = key => (typeof key === 'string' && key.startsWith('d:') ? key.slice(2) || null : null);

/* 맡긴 일 하나의 차례: 'ai'(직원이 하는 중) · 'wait'(사람 차례) · 'failed'(최근에 못 끝냄) · null.
   가름은 「한 번에 처리」(solio-queue.mjs)와 같은 함수다. 두 화면이 같은 일을 다르게 세지 않는다.
   done: 「한 번에 처리」에서 끝냈다고 적은 일({ [열쇠]: 때 }, 「보냈어요」 따위). 적힌 일은 사람의 차례가 아니다(Fable 최종 F4) */
export function officeTaskTurn(t, now = Date.now(), done = null) {
  let it = null;
  try { it = solioTaskItem(t, now); } catch { it = null; }
  if (!it || (done && done[it.key] != null)) return null;
  if (it.ai) return 'ai';
  if (it.waiting || it.outside) return 'wait';
  return 'failed';
}
function taskPreview(t, now, done = null) {
  let it = null;
  try { it = solioTaskItem(t, now); } catch { it = null; }
  if (it && done && done[it.key] != null) it = null;
  if (it && !it.ai && it.say) return it.say;
  const ask = clip(firstLine(t.prompt), 24);
  if (t.status === 'running' || t.status === 'queued') return ask ? `「${ask}」 일을 하는 중` : '맡긴 일을 하는 중';
  if (t.status === 'completed') return clip(firstLine(t.answer) || firstLine(t.prompt), 60);
  return ask ? `「${ask}」` : '';
}

/* ── 왼쪽 목록 ──
   room: officeRoom의 결과(rows · seated · departments). tasks: 맡긴 일(기능 업무는 뺀 것).
   chat: 지금 고른 상대. seen: 상대마다 마지막으로 본 때(ms). base: 앱을 켜고 처음 그린 때(그 전에 끝난 일은 새 결과가 아니다) */
export function officeChatContacts(room, { tasks = [], chat = null, seen = new Map(), base = null, now = Date.now(), done = null } = {}) {
  const rows = Array.isArray(room?.rows) ? room.rows : [];
  const departments = Array.isArray(room?.departments) ? room.departments : [];
  const seated = Array.isArray(room?.seated) ? room.seated : [];
  const rowOf = key => rows.find(r => r.key === key) || null;
  const groups = new Map();
  for (const t of Array.isArray(tasks) ? tasks : []) {
    if (!t || typeof t !== 'object') continue;
    const k = officeTaskChatKey(t, departments);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const orbsOf = key => seated.filter(v => (key === 'lobby' ? v.departmentId == null : key === OFFICE_CHAT_ALL ? true : 'd:' + v.departmentId === key))
    .slice(0, 2).map(v => ({ id: v.id, status: v.status, hat: v.hat || null, provider: v.tool === 'codex' || v.tool === 'claude' ? v.tool : null }));
  function contact(key, nm, row) {
    const ts = groups.get(key) || [];
    const turns = ts.map(t => officeTaskTurn(t, now, done));
    const wait = turns.filter(x => x === 'wait').length, failed = turns.filter(x => x === 'failed').length, ai = turns.filter(x => x === 'ai').length;
    const since = seen.get(key) ?? base;
    const fresh = key !== chat && since != null ? ts.filter(t => t.status === 'completed' && num(t.updatedAt) > since).length : 0;
    const latest = [...ts].sort((a, b) => num(b.updatedAt) - num(a.updatedAt))[0] || null;
    const newest = test => [...ts].filter(test).sort((a, b) => num(b.updatedAt) - num(a.updatedAt))[0] || null;
    const waitTask = ts.find(t => officeTaskTurn(t, now, done) === 'wait') || null;
    // 미리보기와 방 머리에 맡긴 일의 말을 쓰는 때: 확인을 기다리는 일, 그다음(직원이 승인을 묻는 중이 아니면) 못 끝낸 일 · 아직 안 본 새 결과 · 하는 중인 일.
    // 이미 본 지난 답은 직원의 지금 한 가지를 가리지 않는다(카본 화면 검수 A5)
    const pick = waitTask || (!row?.now && (newest(t => officeTaskTurn(t, now, done) === 'failed')
      || (fresh ? newest(t => t.status === 'completed' && num(t.updatedAt) > since) : null)
      || newest(t => officeTaskTurn(t, now, done) === 'ai'))) || null;
    let word;
    if (row?.now) word = row.val;
    else if (wait) word = wait > 1 ? `확인 기다림 ${countWord(wait)}` : '확인 기다림';
    else if (failed) word = '못 끝낸 일';
    else if (fresh) word = '새 결과';
    else if (ai) word = ai > 1 ? countWord(ai) + ' 일하는 중' : '일하는 중';
    else word = key === OFFICE_CHAT_ALL ? '' : row?.val || '';
    const told = pick ? taskPreview(pick, now, done) : '';
    const preview = told || (key === OFFICE_CHAT_ALL ? room?.say || '' : row?.mid || '') || (latest && taskPreview(latest, now, done)) || '';
    const flag = !!row?.flag || wait > 0 || fresh > 0;
    const label = [nm, flag && '새 소식', word, preview].filter(Boolean).join(', ');
    // urgent: 사람이 지금 할 일(승인 물음 · 확인을 기다리는 일)이 있다. 처음 고를 상대는 이것이 먼저다
    return { key, nm, word: word || '', preview, fromTask: !!told, flag, waiting: wait, urgent: !!row?.now || wait > 0, orbs: orbsOf(key), label };
  }
  const out = [contact(OFFICE_CHAT_ALL, OFFICE_CHAT_NAME, null)];
  for (const d of departments) out.push(contact('d:' + d.id, d.name, rowOf('d:' + d.id)));
  const lobby = rowOf('lobby');
  if (lobby) out.push(contact('lobby', lobby.nm, lobby));
  return out;
}

/* 부서 방 머리의 문장: 앞선 직원의 지금 한 가지(「Claude Code가 3분 전에 승인을 물었습니다.」). 직원이 없으면 그 부서 줄의 안내 */
const RANK = { asked: 0, working: 1, silent: 2, done: 3, resting: 4, quiet: 5 };
const TOOL_WORD = { claude: 'Claude Code', codex: 'Codex' };
const sentence = t => { const s = String(t || '').trim(); return !s || /[.!?。]$/.test(s) ? s : s + '.'; };
function deptSay(room, key, row) {
  const staff = (Array.isArray(room?.seated) ? room.seated : []).filter(v => 'd:' + v.departmentId === key);
  const lead = [...staff].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9))[0];
  if (!lead || !lead.say) return sentence(row?.mid);
  const who = lead.lookName || TOOL_WORD[lead.tool] || '직원';
  return sentence(`${josa(who, ['이', '가'])} ${lead.say}`);
}

/* 처음 열 때 고를 상대: 사람이 지금 할 일이 있는 첫 부서, 없으면 느낌표가 있는 첫 부서(또는 부서 없는 일), 없으면 「사무실」 */
export function officeChatFirst(contacts) {
  const list = (Array.isArray(contacts) ? contacts : []).filter(x => x.key !== OFFICE_CHAT_ALL);
  const c = list.find(x => x.urgent) || list.find(x => x.flag);
  return c ? c.key : OFFICE_CHAT_ALL;
}

/* ── 고른 상대의 방 ──
   head: 방 머리(이름, 지금 한 가지, 작은 글). center: 가운데 대화 자리에 세울 줄(맡기기 대화가 아닐 때).
   side: 오른쪽 칸의 줄. composer: 입력칸(on · deptPick · off 안내). empty: 부서가 하나도 없음 */
export function officeChatPanes(room, key, { tasking = false, contacts = [] } = {}) {
  const rows = Array.isArray(room?.rows) ? room.rows : [];
  const departments = Array.isArray(room?.departments) ? room.departments : [];
  const rowOf = k => rows.find(r => r.key === k) || null;
  const c = contacts.find(x => x.key === key) || null;
  const empty = departments.length === 0;
  const emptySay = empty ? OFFICE_CHAT_EMPTY_SAY[tasking ? 'on' : 'off'] : '';
  const cap = rowOf('cap');
  const capLine = cap ? [cap.nm, cap.val || cap.mid].filter(Boolean).join(' · ') : '';
  if (key === 'lobby' && rowOf('lobby')) {
    const r = rowOf('lobby');
    return { key, head: { nm: r.nm, say: c?.preview || r.mid, then: r.val }, center: [{ ...r, pin: true }], side: [], composer: { on: false, off: '' }, empty, emptySay, capLine };
  }
  if (typeof key === 'string' && key.startsWith('d:') && rowOf(key)) {
    const r = rowOf(key), staffMore = Array.isArray(r.staffMore) ? r.staffMore : [], restMore = Array.isArray(r.restMore) ? r.restMore : r.more || [];
    // 맡긴 일에서 온 말(확인을 기다리는 일 따위)이 있으면 그것이 먼저다. 없으면 앞선 직원의 지금 한 가지를 문장으로 쓴다
    const head = { nm: r.nm, say: c?.fromTask ? sentence(c.preview) : deptSay(room, key, r), then: c?.word || r.val };
    if (tasking) return { key, head, center: null, side: [{ ...r, pin: true, more: [...staffMore, ...restMore] }], composer: { on: true, deptPick: false, departmentId: key.slice(2) }, empty, emptySay, capLine };
    const now = staffMore.length ? staffMore : [['note', OFFICE_CHAT_EMPTY_DEPT]];
    return { key, head, center: [{ key: 'now:' + key, nm: '지금', mid: r.val, val: '', when: '', pin: true, label: `지금, ${r.nm}, ${r.val}`, more: now }], side: [{ ...r, pin: true, more: restMore }], composer: { on: false, off: OFFICE_CHAT_OFF_SAY.dept }, empty, emptySay, capLine };
  }
  const head = { nm: OFFICE_CHAT_NAME, say: room?.say || '', then: room?.then || '' };
  const side = ['cap', 'cfg', 'look'].map(rowOf).filter(Boolean).map(r => ({ ...r, gap: false }));
  if (tasking) return { key: OFFICE_CHAT_ALL, head, center: null, side, composer: { on: true, deptPick: true, departmentId: null }, empty, emptySay, capLine };
  // 배포판의 「사무실」: 부서마다 지금 선 직원을 펼친 채 세운다
  const center = departments.map(d => {
    const r = rowOf('d:' + d.id);
    if (!r) return null;
    const staffMore = Array.isArray(r.staffMore) && r.staffMore.length ? r.staffMore : [['note', OFFICE_CHAT_EMPTY_DEPT]];
    return { key: 'now:d:' + d.id, nm: r.nm, mid: r.val, val: '', when: '', pin: true, label: `${r.nm}, ${r.val}`, more: staffMore };
  }).filter(Boolean);
  return { key: OFFICE_CHAT_ALL, head, center, side, composer: { on: false, off: empty ? '' : OFFICE_CHAT_OFF_SAY.all }, empty, emptySay, capLine };
}
