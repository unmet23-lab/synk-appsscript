// 솔리오 「사무실」 방(PC 클라이언트 첫 조각 「보기」, 2026-11-20)의 줄 자료와 그 방의 동작. DOM이 없다.
// 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 5~7절 · 11절, 시안 사무실.html과 README 「담은 것」 1~17. 직원의 상태와 문장, 수용 인원 셈은 office-model.mjs가 정한다.
// 줄 하나의 꼴과 안쪽 [종류, …]는 solio-rooms.mjs와 같다. 이 방에서 더한 안쪽 종류는 둘이다.
//   ['staff', 세션 번호, 도구, 모델, 상태 문장, 하는 일, 표시('alert' · 'now')] — 직원 줄. 그림에서 그 직원을 가리키면 줄이 밝아진다
//   ['item', 이름, 한 문장, 열림, 묶음 이름, 오른쪽] — 부서의 기능 줄(담은 것 16). 누르면 바로 아래 묶음(grp)이 열린다
// 「꾸미기」 줄(솔리오_사무실스킨_20261123/PC앱_설계.md): 스킨과 자리마다의 모자 · 이름. 모두 무료다. 모습은 세션이 아니라 자리(부서마다 시작 시각 차례)에 붙는다.
// 줄의 flag가 참이면 이름 옆에 느낌표가 붙는다(7절). 부서 줄과 「부서 없는 일」은 watch 줄이라, 열었다 닫으면 seen을 부른다(4.1 끝냄).
import { officeSessions, officeHeadline, officeCapacity, officeSeats, countWord, officeFolderName, officeOwnWorkCwd, officeDeskPlan, officeDeskLine, OFFICE_DESK_SIZES, OFFICE_DESK_COUNT_MAX, OFFICE_DESK_FINISHES } from './office-model.mjs';
import { createOfficeTaskRoom, officeTaskHeadline } from './office-task-room.mjs';
import { createBizplanRoom } from './office-bizplan-room.mjs';
import { bizplanLine, attachesBizplan } from './office-bizplan-model.mjs';
import { limitGauge } from './subscriptions-model.mjs';
import { josa, whenWords } from './solio-today.mjs';
import { OFFICE_CHAT_ALL, officeChatContacts, officeChatFirst, officeChatPanes, officeChatKeyOk, officeChatDepartment, officeTaskChatKey } from './office-chat-model.mjs';

export const OFFICE_NAME = '사무실';
/* 방이 보이는 동안 분 글을 다시 쓰는 사이, 솔리오가 보이는 동안 오브제의 느낌표를 맞추려고 다시 읽는 사이, 바뀜 알림을 모으는 시간(ms).
   desk: 남은 책상을 거두기까지 기다리는 시간. 세션이 오갈 때마다 책상이 놓였다 빠지며 사무실이 들썩이지 않게 한다(책상 설계 검토 P1-2) */
export const OFFICE_TIMING = Object.freeze({ clock: 15000, poll: 60000, changed: 250, desk: 180000 });
/* 이름 칸에 보이는 예시(5절: 미리 만들지 않고 고를 수 있게 보이기만 한다) */
export const OFFICE_DEPT_EXAMPLES = Object.freeze(['마케팅부', '법무부', '개발부', '디자인부', '회계부', '고객지원부']);
/* 그림에 따로 그리는 부서 수(5절). 일곱째부터는 그림에서 「그 밖」 한 구역으로 묶는다 */
export const OFFICE_FLOOR_DEPTS = 6;
const NAME_MAX = 20;
export const OFFICE_BUSY_SAY = '다른 일을 마치는 중입니다. 잠시 뒤 다시 눌러 주세요.';
export const OFFICE_CODE_SAY = Object.freeze({
  NAME: '부서 이름을 1자에서 20자로 적어 주세요.',
  NAME_TAKEN: '같은 이름의 부서가 이미 있습니다. 다른 이름을 적어 주세요.',
  FOLDER: '그 폴더를 찾지 못했습니다. 다른 폴더를 골라 주세요.',
  LIMIT: '더 넣을 수 없습니다. 부서는 24개, 보는 폴더는 8개까지입니다.',
  LOOK_LIMIT: '꾸민 자리가 너무 많습니다. 다른 자리의 모자나 이름을 지운 뒤 다시 해 주세요.',
  NOT_FOUND: '그 부서나 세션을 찾지 못했습니다. 화면을 다시 읽었습니다.',
  NOT_ALLOWED: '이 계정에서는 사무실을 고칠 수 없습니다.',
  SIGN_IN_REQUIRED: '로그인을 확인하는 중이라 저장하지 않았습니다. 잠시 뒤 다시 해 주세요.',
  AUTH_CHANGED: '로그인이 바뀌어 저장하지 않았습니다.',
  VALUE: '적은 값을 확인해 주세요.',
});
const DEFAULT_SAY = '저장하지 못했습니다. 잠시 뒤 다시 해 주세요.';
export const officeCodeSay = code => (code && Object.hasOwn(OFFICE_CODE_SAY, code) ? OFFICE_CODE_SAY[code] : DEFAULT_SAY);


const eul = w => josa(w, ['을', '를']), ga = w => josa(w, ['이', '가']), wa = w => josa(w, ['과', '와']);
/* 「로 · 으로」: 받침이 없거나 ㄹ이면 「로」다. 끝의 괄호와 문장부호는 건너뛰고, 숫자는 읽는 소리로(0 · 3 · 6만 ㄹ 아닌 받침), 영문은 흔한 끝소리로 본다(카본 A7) */
const ro = w => {
  const text = String(w), t = text.replace(/[^가-힣A-Za-z0-9]+$/, ''), ch = t.slice(-1), c = ch.charCodeAt(0);
  let eu;
  if (c >= 0xAC00 && c <= 0xD7A3) { const j = (c - 0xAC00) % 28; eu = j !== 0 && j !== 8; }
  else if (/[0-9]/.test(ch)) eu = '036'.includes(ch);
  else { const l = t.toLowerCase(); eu = /(?:[mn]|ng)$/.test(l) || /[aeiou][tkp]$/.test(l); }
  return text + (eu ? '으로' : '로');
};
export const officeRo = ro; // 시험이 본다
const TOOL_NAME = Object.freeze({ claude: 'Claude Code', codex: 'Codex' });
const flags = (...xs) => xs.filter(Boolean).join(' ');
const pad = n => String(n).padStart(2, '0');
const hm = t => (d => pad(d.getHours()) + ':' + pad(d.getMinutes()))(new Date(t));
const lastPart = p => String(p ?? '').replace(/[\\/]+$/, '').split(/[\\/]+/).filter(Boolean).pop() || '';
/* 모델 이름은 계열만 보인다(시안의 「Opus」 · 「Sonnet」). 모르는 이름은 그대로, 길면 줄인다 */
export function modelWord(model) {
  const s = String(model ?? '').trim();
  if (!s) return '';
  const f = /(opus|sonnet|haiku|fable)/i.exec(s);
  if (f) return f[1][0].toUpperCase() + f[1].slice(1).toLowerCase();
  return s.length > 24 ? s.slice(0, 23) + '…' : s;
}
const cleanName = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const nameKey = v => cleanName(v).toLowerCase();

/* ── 구독의 남은 양(2절 · 6절) ── 구독 방이 이미 읽은 값을 쓴다. 기본 로그인(계정 폴더가 없는 자동 줄)의 주간 한도만 본다.
   돌려주는 값: { claude?: { leftPercent, resetsAt }, codex?: { … } }. 값이 없는 도구는 빠진다 */
export function officeSubscriptions(subsSnapshot, now) {
  const out = {};
  const rows = Array.isArray(subsSnapshot?.rows) ? subsSnapshot.rows : [];
  for (const [service, tool] of [['claude', 'claude'], ['gpt', 'codex']]) {
    for (const row of rows) {
      if (!row || row.service !== service || row.source !== 'auto' || row.folder) continue;
      const w = limitGauge(row, now)?.weekly;
      if (!w || !Number.isFinite(w.left)) continue;
      out[tool] = { leftPercent: w.left, resetsAt: w.resetsAt || null };
      break;
    }
  }
  return out;
}

/* ── 부서 줄의 상태(시안 summary). 앞선 직원(승인을 물은 · 소식 없는 · 일하는 · 끝낸 순)의 하는 일이 가운데 칸이다 ── */
const RANK = Object.freeze({ asked: 0, silent: 1, working: 2, done: 3, quiet: 4, resting: 5 });
export function officeLead(staff) { return [...staff].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9))[0] || null; }
export function officeGroupStatus(staff) {
  const n = s => staff.filter(v => s.includes(v.status)).length;
  if (!staff.length) return '빈 자리';
  if (n(['asked'])) return n(['asked']) > 1 ? ga(countWord(n(['asked']))) + ' 승인을 물었습니다' : '승인을 물었습니다';
  if (n(['working', 'silent'])) return countWord(n(['working', 'silent'])) + ' 일하는 중';
  if (n(['done'])) return '끝냄';
  if (n(['resting'])) return '쉬는 중';
  return '조용합니다';
}
/* 직원 줄의 작은 글: 하는 일, 도우미 수, 모르는 것. 하는 일을 모르면 「shop 폴더에서 켬」이다. 덩그런 폴더 이름은 처음 보는 사람이 무엇인지 몰랐다
   (11-25 맹검). 바로 아래 「이 폴더로 부서 만들기」의 「이 폴더」가 이 글이다. 단추에는 이름을 적지 않는다: 작업 사본이면 이름은 저장소인데
   부서에 묶이는 것은 작업 사본 폴더다(Fable solio-office-staff-words F1) */
export function officeStaffDetail(v, deptFolder = null) {
  const helpers = v.subagents > 0 ? wa('도우미 ' + countWord(v.subagents)) + ' 함께' : '';
  const place = v.folder && !ownFolder(v, deptFolder) ? v.folder + ' 폴더에서 켬' : '';
  return [activitySay(v, deptFolder) || place, helpers, v.note].filter(Boolean).join(' · ');
}
function staffItem(v, deptFolder) {
  // 이름을 바꾼 직원은 이름 칸에 그 이름, 작은 글에 도구와 모델이다(꾸미기 6절)
  const tool = TOOL_NAME[v.tool] || v.tool || '', model = modelWord(v.model);
  const nm = v.lookName || tool, small = v.lookName ? [tool, model].filter(Boolean).join(' · ') : model;
  return ['staff', v.id, nm, small, v.say, officeStaffDetail(v, deptFolder), flags(v.alert && 'alert', v.status === 'asked' && 'now')];
}
function staffItems(v, tasking, deptFolder = null) {
  const rows = [staffItem(v, deptFolder)];
  if (tasking && Object.hasOwn(TOOL_NAME, v.tool)) {
    const name = v.tool === 'codex' ? 'GPT (Codex)' : TOOL_NAME[v.tool];
    rows.push(['acts', [[name + '에게 새 일 맡기기', 'task-open', v.tool]]]);
  }
  return rows;
}
const rowLabel = parts => parts.filter(Boolean).join(', ');
const samePath = (a, b) => { const n = p => String(p ?? '').trim().replace(/[\\/]+/g, '\\').replace(/\\$/, '').toLowerCase(); return n(a) === n(b); };
/* 이름을 적지 않는 폴더. 부서 줄에서 그 부서의 폴더다. 부서 폴더 안의 작업 사본(「shop/.claude/worktrees/…」)은 이름이 부서 폴더와 같게 읽히므로 그것도 자기 폴더다
   (카본 solio-room-content A1). 부서를 정하지 않고 솔리오에 맡긴 일의 폴더는 이름이 회원 번호라 어느 줄에도 쓰지 않는다(카본 solio-office-words A2, Fable F4) */
function ownFolder(v, deptFolder = null) {
  return officeOwnWorkCwd(v.cwd) || (deptFolder != null && (samePath(v.cwd, deptFolder) || String(v.folder || '').toLowerCase() === officeFolderName(deptFolder).toLowerCase()));
}
/* 하는 일의 글: officeActivity(「shop · 읽기 · auth.ts」)의 맨 앞 폴더 이름을 「shop 폴더에서 읽기 · auth.ts」처럼 일하는 곳으로 쓴다. 폴더밖에 모르면 빈 글이다 */
function activitySay(v, deptFolder = null) {
  const act = String(v.activity || ''), folder = String(v.folder || '');
  const rest = folder && (act === folder || act.startsWith(folder + ' · ')) ? act.slice(folder.length).replace(/^ · /, '') : act;
  return rest && folder && !ownFolder(v, deptFolder) ? folder + ' 폴더에서 ' + rest : rest;
}
/* 닫힌 줄 가운데 칸의 「하는 일」. 하는 일을 모르면 폴더 이름을 쓰지 않는다. 처음 보는 사람은 그 폴더가 왜 거기 있는지 모른다(11-23 두 번 · 11-25 맹검).
   부서 줄은 어느 AI인지를, 「부서 없는 일」은 어디서 켠 AI인지를 쓴다 */
function rowActivity(v, deptFolder = null, staff = [v]) {
  const say = activitySay(v, deptFolder);
  if (deptFolder == null) {
    if (say) return (officeOwnWorkCwd(v.cwd) ? '솔리오에서 맡긴 일 · ' : '') + say;
    // 하는 일을 모르면 줄의 글은 묶음의 출처로 읽히므로 앞선 직원 하나가 아니라 모두를 본다(Fable F1)
    const ours = staff.filter(s => officeOwnWorkCwd(s.cwd)).length;
    return !ours ? '이 PC에서 따로 켠 AI' : ours === staff.length ? '솔리오에서 맡긴 일' : '따로 켠 AI와 맡긴 일';
  }
  // 하는 일을 모르면 오른쪽 칸(「하나 일하는 중」 · 「승인을 물었습니다」)과 겹치지 않게 어느 AI인지 쓴다(「Claude Code · Opus」, Fable solio-room-content F3)
  return say || [TOOL_NAME[v.tool] || '', modelWord(v.model)].filter(Boolean).join(' · ') || v.say;
}

/* ── 꾸미기(PC앱_설계.md 2~3절 · 6절) ── 값의 꼴은 본체(office-store.cjs)와 같다 */
export const OFFICE_SKINS = Object.freeze([['black', '검정'], ['walnut', '호두나무 서재']]);
export const OFFICE_HATS = Object.freeze([['none', '모자 없음'], ['beanie', '니트 비니'], ['beret', '베레모'], ['gat', '갓'], ['phones', '헤드폰'], ['sprout', '새싹']]);
export const OFFICE_LOOK_NAME_MAX = 12;
const SEAT_MAX = 100;
const HAT_IDS = new Set(OFFICE_HATS.slice(1).map(([k]) => k));
const LOOK_HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
const skinWord = id => (OFFICE_SKINS.find(([k]) => k === id) || OFFICE_SKINS[0])[1];
const hatWord = id => (OFFICE_HATS.find(([k]) => k === id) || OFFICE_HATS[0])[1];
const skinOf = v => (v === 'walnut' ? 'walnut' : 'black');
/* 자리: 부서마다(부서 없는 일도 하나로) 시작 시각 차례로 센다. list는 officeSessions의 차례 그대로다.
   직원마다 seat(자리 열쇠), seatNo, seatName(처음 이름 「마케팅부 2」), lookName(바꾼 이름), hat을 더한다. 백째 자리부터는 열쇠가 없다 */
export function officeSeated(list, departments = [], looks = {}) {
  const count = new Map();
  return list.map(v => {
    const zone = v.departmentId == null ? 'lobby' : 'd:' + v.departmentId, n = count.get(zone) || 0;
    count.set(zone, n + 1);
    if (n >= SEAT_MAX) return { ...v, seat: null, seatNo: n + 1, seatName: '', lookName: '', hat: null };
    const seat = zone + ':' + n, look = looks && typeof looks[seat] === 'object' && looks[seat] ? looks[seat] : {};
    const dept = v.departmentId == null ? '부서 없는 일' : (departments.find(d => d.id === v.departmentId)?.name || v.departmentName || '');
    return { ...v, seat, seatNo: n + 1, seatName: `${dept} ${n + 1}`, lookName: typeof look.name === 'string' ? look.name : '', hat: HAT_IDS.has(look.hat) ? look.hat : null };
  });
}
/* 판의 모습에, 손님이 눌러 아직 판에 오지 않은 값(ui.lookWant)을 얹는다 */
function looksOf(settings, ui) {
  const out = {};
  for (const [k, v] of Object.entries(settings?.looks && typeof settings.looks === 'object' ? settings.looks : {})) if (v && typeof v === 'object') out[k] = { ...v };
  for (const [k, w] of ui.lookWant || []) {
    const cur = { ...(out[k] || {}) };
    for (const f of ['hat', 'name']) if (Object.hasOwn(w, f)) { if (w[f]) cur[f] = w[f]; else delete cur[f]; }
    out[k] = cur;
  }
  return out;
}
/* 이름 칸의 칸 이름: 저장 차례와 자리를 함께 넣는다. 고른 직원이 저절로 바뀌어도(앞 세션이 끝남) 쓰던 글이 다른 직원의 칸에 남지 않는다(검수 A2) */
export const officeLookField = (ui, seat = '') => 'lname-' + (ui?.lookSeq || 0) + (seat ? '-' + seat : '');
const whoOf = v => v.lookName || v.seatName;
/* 꾸밀 직원의 차례: 부서 줄의 차례(부서 없는 일은 맨 뒤), 그 안에서 자리 차례. 맨 처음 고른 직원도 이 차례의 첫 직원이다 */
export function officeLookOrder(staff, departments = []) {
  const rank = v => (v.departmentId == null ? departments.length : Math.max(0, departments.findIndex(d => d.id === v.departmentId)));
  return staff.filter(v => v.seat).map((v, i) => [v, i]).sort(([a, i], [b, j]) => rank(a) - rank(b) || a.seatNo - b.seatNo || i - j).map(([v]) => v);
}
/* 「꾸미기」 줄. staff는 officeSeated의 값이다 */
export function officeLooksRow({ skin = 'black', staff = [], departments = [], pick = null, ui = {} } = {}) {
  const note = ui.notes?.get?.('look') || '';
  const seated = officeLookOrder(staff, departments), now = seated.find(v => v.seat === pick) || null;
  const hats = seated.filter(v => v.hat).length;
  const mid = skinWord(skin) + (hats ? ' · 모자 쓴 직원 ' + countWord(hats) : '');
  const more = [['pick', '스킨', OFFICE_SKINS.map(([k, w]) => [w, k]), skin, '', 'skin']];
  if (skin === 'walnut') more.push(['note', '일하는 부서 위에만 탁상 등이 켜집니다.']);
  if (!now) more.push(['note', '직원이 서면 한 명씩 모자를 씌우고 이름을 바꿀 수 있습니다.']);
  else {
    // 꾸밀 직원은 부서마다 한 줄이다. 직원이 스물이 넘어도 한 줄에 단추가 몰리지 않는다(설계 검토 13)
    const groups = [];
    for (const v of seated) {
      const label = v.seatName.slice(0, v.seatName.lastIndexOf(' '));
      const g = groups.find(x => x.zone === v.seat.slice(0, v.seat.lastIndexOf(':')));
      if (g) g.staff.push(v); else groups.push({ zone: v.seat.slice(0, v.seat.lastIndexOf(':')), label, staff: [v] });
    }
    if (groups.length > 1) more.push(['note', '꾸밀 직원을 고릅니다.']);
    for (const g of groups) {
      const picked = g.staff.some(v => v.seat === now.seat) ? now.seat : '';
      more.push(['pick', groups.length > 1 ? g.label : '꾸밀 직원', g.staff.map(v => [v.lookName || v.seatNo + '번', v.seat]), picked, '', 'look-pick']);
    }
    // 모자 단추의 값에 자리를 함께 싣는다. 누르는 사이 고른 직원이 바뀌어도 본 직원에게 간다
    more.push(['pick', '모자', OFFICE_HATS.map(([k, w]) => [w, now.seat + '|' + k]), now.seat + '|' + (now.hat || 'none'), '', 'look-hat']);
    more.push(['fld', '이름', now.lookName, `비우면 「${now.seatName}」 · ${OFFICE_LOOK_NAME_MAX}자까지`, officeLookField(ui, now.seat), 'text']);
    more.push(['acts', [['이름 바꾸기', 'look-rename', now.seat, flags('enter', ui.busy && 'off')]]]);
    more.push(['note', '이름과 모자는 자리에 붙습니다. 앞자리 일이 끝나면 다음 세션이 그 자리의 모습을 이어받습니다.']);
  }
  if (departments.length) more.push(['note', '책상은 왼쪽에서 부서를 고르면 부서마다 바꿀 수 있습니다.']);
  more.push(['note', '모두 무료입니다. 이 값은 계정과 PC마다 따로 기억합니다.']);
  more.push(['live', note]);
  return { key: 'look', nm: '꾸미기', mid, val: '', when: '', watch: true, label: rowLabel(['꾸미기', mid]), more };
}

/* ── 수용 인원 줄(6절, 시안 pcHTML) ── 첫 조각은 보이기만 한다. 구독을 둘 다 다 썼으면 숫자 대신 쉰다고 말한다(6절 11-20) */
export const OFFICE_REST_SAY = '구독을 다 써서 다시 찰 때까지 쉽니다';
/* 읽은 수인가: null · 빈 글자는 Number()가 0으로 바꾸므로 따로 거른다(메모리를 읽지 못하면 본체가 null을 보낸다, P2 묶음 카본 A1) */
const known = v => v != null && v !== '' && Number.isFinite(Number(v));
/* 쉬는 때: 두 구독의 남은 양을 다 알고 둘 다 0이며, 손님이 수를 직접 정하지 않았을 때. 직접 정한 수가 이긴다(0.5.2 공개 검수 A4) */
export const officeResting = c => !!c && c.source !== 'manual' && c.missing.length === 0 && c.toolCaps.claude === 0 && c.toolCaps.codex === 0;
/* 수용 인원: 코어를 못 읽었으면 null이다. counted는 화면이 수를 말해도 되는가 — 메모리까지 읽었거나 손님이 수를 직접 정했을 때다.
   못 읽은 메모리로 자동 수를 말하지 않는다(카본 A1). 메모리를 못 읽었어도 직접 정한 수는 보이고(P2 묶음 GA1), 직접 정하는 칸은 늘 둔다(검수 solio-office-ga1 F3) */
function countableCapacity(pc, subscriptions, manual) {
  if (!pc || !known(pc.cores)) return null;
  const c = officeCapacity({ cores: pc.cores, totalMemGb: known(pc.totalMemGb) ? pc.totalMemGb : null, subscriptions, manual });
  return { ...c, counted: c.memKnown || c.source === 'manual' };
}
export function officeCapacityRow({ pc = null, subscriptions = {}, manualCap = null, active = 0, ui = {}, now = Date.now(), tasking = false } = {}) {
  const note = ui.notes?.get?.('cap') || '';
  const c = countableCapacity(pc, subscriptions, manualCap);
  if (!c) {
    return { key: 'cap', gap: true, nm: '수용 인원', mid: '이 PC의 프로세서와 메모리를 아직 읽지 못했습니다', val: '', when: '', label: rowLabel(['수용 인원', '이 PC의 프로세서와 메모리를 아직 읽지 못했습니다']), more: [['note', '사무실을 열어 두면 곧 다시 읽습니다.'], ['live', note]] };
  }
  const cores = Math.max(1, Math.floor(Number(pc.cores))), mem = c.memKnown ? Math.round(Math.max(0, Number(pc.totalMemGb))) : null;
  const resting = officeResting(c);
  const low = ['claude', 'codex'].filter(t => subscriptions[t] && subscriptions[t].leftPercent < 50).map(t => ` · ${t === 'codex' ? 'Codex' : 'Claude'} ${subscriptions[t].leftPercent}%`).join('');
  const mid = resting ? OFFICE_REST_SAY : `${cores}코어 · ${mem == null ? '메모리를 읽지 못했습니다' : mem + 'GB'}${low}`;
  const val = resting || !c.counted ? '' : countWord(c.cap) + '까지';
  const per = n => (n >= 1 ? countWord(n) : '없음');
  const cpu = known(pc.cpuPercent) ? ` · 지금 ${Math.round(pc.cpuPercent)}% 쓰는 중` : '';
  const free = known(pc.freeMemGb) ? ` · 지금 ${Math.round(pc.freeMemGb * 10) / 10}GB 비어 있음` : '';
  const toolRow = tool => {
    const s = subscriptions[tool], name = TOOL_NAME[tool];
    if (!s) return ['row', name, '남은 양을 모릅니다', c.counted ? countWord(c.toolCaps[tool]) + '까지' : '', ''];
    const again = s.resetsAt ? ` · ${whenWords(s.resetsAt, now, { withTime: true })}에 다시 찹니다` : '';
    return ['row', name, `${s.leftPercent}% 남음${again}`, !c.counted ? '' : c.toolCaps[tool] ? countWord(c.toolCaps[tool]) + '까지' : '쉬는 중', ''];
  };
  const manualOpen = c.source === 'manual' || ui.grps?.has?.('cap:manual');
  const more = [
    ['row', '프로세서', `논리 코어 ${cores}개${cpu}`, '둘마다 하나 · ' + per(Math.floor(cores / 2)), ''],
    mem == null ? ['row', '메모리', '읽지 못했습니다', '', ''] : ['row', '메모리', `${mem}GB${free}`, '4GB마다 하나 · ' + per(Math.floor(mem / 4)), ''],
    toolRow('claude'), toolRow('codex'),
    ['row', '합쳐서', resting ? OFFICE_REST_SAY + '.' : `${c.source === 'manual' ? '직접 정한 수입니다.' : !c.counted ? (tasking ? '메모리를 읽지 못해 한 번에 하나씩 맡깁니다. 직접 정할 수 있습니다.' : '메모리를 읽지 못해 자동으로는 세지 않습니다. 직접 정할 수 있습니다.') : 'PC와 구독 가운데 적은 쪽입니다.'} ${active ? '지금 ' + ga(countWord(active)) + ' 일하고 있습니다.' : '지금은 아무도 일하지 않습니다.'}`, resting || !c.counted ? '' : (c.source === 'manual' ? '직접 정함 · ' : '') + '동시에 ' + countWord(c.cap) + '까지', ''],
  ];
  if (c.note) more.push(['note', c.note]);
  more.push(['pick', '정하는 방법', [['자동', 'auto'], ['직접 정하기', 'manual']], manualOpen ? 'manual' : 'auto', '', 'cap-mode']);
  more.push(['grp', 'manual', [
    ['fld', '함께 일할 수', String(manualCap ?? c.cap), `1에서 ${cores}까지`, 'cap', 'number'],
    ['acts', [['저장', 'cap-save', '', flags('enter', ui.busy && 'off')]]],
  ], !manualOpen]);
  // 직접 정했으면 구독 규칙은 정한 수에 걸린다. 일 맡기기가 켜진 판에서는 실제로 맡기므로 「보이기만 합니다」를 쓰지 않는다(검수 solio-office-ga1b-20261122 F1)
  more.push(['note', `구독이 절반 넘게 남으면 ${c.source === 'manual' ? '정한 수' : 'PC 한도'}까지, 절반 아래면 그 절반, 20% 아래면 한 사람이 일합니다. 다 쓰면 다시 찰 때까지 쉽니다.${tasking ? '' : ' 지금은 이 PC에서 도는 일을 세어 보이기만 합니다.'} 이 값은 계정과 PC마다 따로 기억합니다.`]);
  more.push(['live', note]);
  return { key: 'cap', gap: true, nm: '수용 인원', mid, val, when: '', label: rowLabel(['수용 인원', mid, val]), more };
}

/* ── 설정 줄(11.4) ── 보기 두 가지와 보는 폴더. 첫 조각에는 「승인 물음도 보기」가 없다(11-21 훅을 뺐다) */
export function officeSettingsRow({ view = 'tilted', roots = {}, ui = {} } = {}) {
  const note = ui.notes?.get?.('cfg') || '';
  const claude = Array.isArray(roots.claude) ? roots.claude : [], codex = Array.isArray(roots.codex) ? roots.codex : [], added = Array.isArray(roots.added) ? roots.added : [];
  // 빗금 방향과 끝 빗금, 큰 · 작은 글자를 가리지 않고 견준다(화면 r5 FA1)
  const norm = v => String(v).replace(/[\\/]+/g, '\\').replace(/\\$/, '').toLowerCase();
  const same = (a, b) => norm(a) === norm(b);
  const addedOf = dir => added.find(a => same(a, dir));
  // 더한 폴더 가운데 지금 보지 않는 것(구독 방 계정 폴더이거나 2초 안에 답하지 않는 폴더)도 줄로 세워 뺄 수 있게 한다(설계 검토 be7 고칠 것 1).
  // 본체가 보낸 목록(roots.resting)을 먼저 쓴다. 본체가 같은 열쇠로 가른 것이다
  const resting = Array.isArray(roots.resting) ? roots.resting : added.filter(a => !claude.some(c => same(c, a)));
  const shown = view === 'top' ? '위에서' : '비스듬히';
  const more = [
    ['pick', '그림 각도', [['비스듬히', 'tilted'], ['위에서', 'top']], view === 'top' ? 'top' : 'tilted', '', 'view'],
    ['note', '같은 사무실을 보는 각도입니다. 고른 각도는 다음에 열 때도 그대로입니다.'],
    ...claude.map(dir => ['row', 'Claude Code', String(dir), addedOf(dir) != null ? ['빼기', 'root-remove', String(addedOf(dir)), ui.busy ? 'off' : ''] : '', '']),
    ...resting.map(dir => ['row', 'Claude Code', String(dir) + ' · 지금은 보지 않음', ['빼기', 'root-remove', String(dir), ui.busy ? 'off' : ''], '']),
    ...(resting.length ? [['note', '「지금은 보지 않음」은 구독 방의 계정 폴더이거나, 2초 안에 답하지 않거나 실제 위치를 알 수 없는 폴더입니다.']] : []),
    ...codex.map(dir => ['row', 'Codex', String(dir), '', '']),
    ['acts', [['폴더 더하기', 'root-add', '', ui.busy ? 'off' : '']], '보는 폴더'],
    ['note', 'Claude Code의 기본 설정 폴더와 Codex의 기록 폴더는 늘 봅니다. 다른 설정 폴더를 쓰면 더해 주세요.'],
    ['live', note],
  ];
  // 닫힌 줄에는 고른 각도만 쓴다. 「보는 폴더 둘」도 「기록을 읽는 폴더 둘」도 처음 보는 사람은 읽지 못했고(11-23 맹검 두 번),
  // 폴더는 다른 설정 폴더를 쓰는 사람만 찾는다. 줄을 열면 폴더마다 한 줄과 무엇인지 적은 글이 있다. 「비스듬히 보기」는 무엇을 보는지 몰랐다(11-25 맹검)
  const mid = `그림 각도 · ${shown}`;
  return { key: 'cfg', nm: '설정', mid, val: '', when: '', label: rowLabel(['설정', mid]), more };
}

/* ── 부서 더하기 줄(5절) ── 이름을 적고 폴더를 고른다. 폴더 고르기 창은 본체가 띄운다(13절) */
/* 이름 칸의 이름. 더한 뒤에는 이름을 바꿔 칸을 비운다(쓰던 글을 옮겨 적는 화면 규칙이 지난 이름을 남기지 않게) */
export const officeAddField = ui => 'name' + (ui?.addSeq ? '-' + ui.addSeq : '');
export function officeAddRow({ ui = {} } = {}) {
  const note = ui.notes?.get?.('add') || '', name = ui.addName || '';
  return { key: 'add', nm: '부서 더하기', mid: '이름을 적고 폴더를 고릅니다', val: '', when: '', label: '부서 더하기, 이름을 적고 폴더를 고릅니다', more: [
    ['fld', '부서 이름', name, NAME_MAX + '자까지', officeAddField(ui), 'text'],
    ['pick', '예시', OFFICE_DEPT_EXAMPLES.map(n => [n, n]), OFFICE_DEPT_EXAMPLES.includes(name) ? name : '', '', 'dept-name'],
    ['acts', [['폴더 고르고 더하기', 'dept-add', '', flags('enter', ui.busy && 'off')]]],
    ['note', '부서는 폴더 하나에 이름을 붙인 것입니다. 그 폴더나 그 아래에서 켠 Claude Code와 Codex가 이 부서의 직원으로 섭니다.'],
    ['live', note],
  ] };
}

/* 부서 하나의 줄. 안쪽은 직원 줄, 그다음 기능 줄(셋째 조각: 기획부의 「사업계획서」), 맨 아래 「부서 설정」이다 */
function featureTask(tasks, feature, departmentId) {
  return (Array.isArray(tasks) ? tasks : []).filter(t => t?.feature === feature && t.departmentId === departmentId).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}
/* ── 부서의 책상(솔리오_사무실책상_20261125/README.md) ── 판의 값에, 손님이 눌러 아직 판에 오지 않은 값(ui.deskWant)을 얹는다 */
export const OFFICE_FINISHES = Object.freeze([['office', '사무실과 같게'], ['black', '검정'], ['walnut', '호두나무']]);
const finishWord = id => (OFFICE_FINISHES.find(([k]) => k === id) || OFFICE_FINISHES[0])[1];
function deskOf(d, ui) {
  const desk = { ...(d?.desk && typeof d.desk === 'object' ? d.desk : {}), ...(ui?.deskWant?.get?.(d?.id) || {}) };
  for (const f of ['size', 'count', 'finish']) if (desk[f] == null) delete desk[f];
  return desk;
}
const heldOf = (d, ui) => ui?.deskHold?.get?.(d?.id)?.desks || 0;
/* 「책상」 줄과 그 안쪽. 크기 · 수 · 재질을 누르면 바로 바뀐다. 값에 부서를 함께 실어, 누르는 사이 고른 부서가 바뀌어도 본 부서에 간다 */
function deskItems(d, staffCount, ui, { seats = 1, index = 0 } = {}) {
  const desk = deskOf(d, ui), plan = officeDeskPlan(desk, staffCount, seats, { held: heldOf(d, ui) }), open = !!ui.grps?.has?.('d:' + d.id + ':desk');
  const inner = [
    ['pick', '책상 크기', OFFICE_DESK_SIZES.map(n => [n + '인', d.id + '|' + n]), d.id + '|' + plan.size, '', 'desk-size'],
    ['pick', '책상 수', Array.from({ length: OFFICE_DESK_COUNT_MAX }, (_, i) => [String(i + 1), d.id + '|' + (i + 1)]), d.id + '|' + plan.base, '', 'desk-count'],
    ['pick', '재질', OFFICE_FINISHES.map(([k, w]) => [w, d.id + '|' + k]), d.id + '|' + (plan.finish || 'office'), '', 'desk-finish'],
    ['note', '직원이 자리보다 많으면 같은 책상이 저절로 더 놓이고, 직원이 떠나면 잠시 뒤 고른 수로 돌아갑니다.'],
  ];
  if (index >= OFFICE_FLOOR_DEPTS) inner.push(['note', '그림에는 여섯째 부서까지 책상이 놓입니다.']);
  return [['item', '책상', officeDeskLine(plan), open, 'desk', ''], ['grp', 'desk', inner, !open]];
}
function departmentRow(d, staff, ui, tasking, tasks = [], place = {}) {
  const key = 'd:' + d.id, lead = officeLead(staff), alert = staff.some(v => v.alert);
  // 닫힌 줄에는 경로를 쓰지 않는다(11-23 맹검이 「inapp\기획부」를 짚었다). 빈 부서는 직원이 서는 길을 말하고, 온전한 경로는 부서 설정의 「폴더」 줄에 있다
  const mid = lead ? rowActivity(lead, d.folder || '') : tasking ? '일을 맡기면 직원이 자리에 앉습니다' : '이 부서 폴더에서 일을 시작하면 직원이 섭니다';
  const val = officeGroupStatus(staff);
  const staffMore = staff.flatMap(v => staffItems(v, tasking, d.folder || ''));
  if (tasking) staffMore.push(['acts', [['이 부서에 일 맡기기', 'task-open', '']]]);
  else if (!staff.length) staffMore.push(['note', '이 폴더에서 Claude Code나 Codex를 켜면 여기에 섭니다.']);
  const more = [];
  // 기능 줄은 누르면 작업 화면이 열린다(사업계획서_설계.md 2절). 일 맡기기가 켜진 판에서만 선다
  if (tasking && attachesBizplan(d)) {
    const l = bizplanLine(featureTask(tasks, 'bizplan', d.id));
    more.push(['item', '사업계획서', l.line, false, 'bizplan', l.when, 'feature']);
  }
  more.push(...deskItems(d, staff.length, ui, place));
  const open = !!ui.grps?.has?.(key + ':set'), asking = ui.asking === d.id;
  more.push(['item', '부서 설정', '이름 · 폴더 · 빼기', open, 'set', '']);
  const inner = [
    ['fld', '부서 이름', d.name, NAME_MAX + '자까지', 'name', 'text'],
    ['acts', [['이름 저장', 'dept-rename', d.id, flags('enter', ui.busy && 'off')], ['폴더 바꾸기', 'dept-folder', d.id, ui.busy ? 'off' : ''], ['부서 빼기', 'dept-remove-ask', d.id, flags('toggle', asking && 'on', 'far')]]],
    ['row', '폴더', String(d.folder || ''), '', ''],
  ];
  if (asking) inner.push(['confirm', eul(d.name) + ' 빼시겠습니까?', ['이 부서에 선 직원은 「부서 없는 일」로 갑니다.', '폴더와 그 안의 파일은 그대로 둡니다.'], [['부서 빼기', 'dept-remove', d.id, ui.busy ? 'off' : ''], ['그만두기', 'dept-remove-keep', d.id]]]);
  more.push(['grp', 'set', inner, !open]);
  more.push(['live', ui.notes?.get?.(key) || '']);
  return { key, nm: d.name, flag: alert, mid, val, when: '', now: staff.some(v => v.status === 'asked'), watch: true, label: rowLabel([d.name, alert && '새 소식', mid, val]), more: [...staffMore, ...more], staffMore, restMore: more };
}

/* 「이 폴더로 부서 만들기」의 첫 이름: 읽히는 폴더 이름을 20자로 자른 것, 그 이름의 부서가 있으면 끝 폴더 이름을 자른 것 */
function suggestName(v, departments) {
  const cut = s => String(s || '').slice(0, NAME_MAX), first = cut(v.folder);
  return first && !departments.some(d => nameKey(d.name) === nameKey(first)) ? first : cut(lastPart(v.cwd));
}

/* 「부서 없는 일」: 솔리오 밖에서 연 일 가운데 부서 폴더 밖의 것(5절). 세션마다 그 작업 폴더로 부서를 만들거나 보낼 부서를 고른다 */
function lobbyRow(staff, departments, ui, tasking) {
  const lead = officeLead(staff), alert = staff.some(v => v.alert);
  const mid = rowActivity(lead, null, staff), val = officeGroupStatus(staff);
  const more = [];
  for (const v of staff) {
    more.push(...staffItems(v, tasking));
    if (departments.length) more.push(['acts', departments.map(d => [d.name, 'assign', v.id + '|' + d.id, ui.busy ? 'off' : '']), '보낼 부서']);
    if (v.cwd) {
      const grp = 'mk-' + v.id, open = !!ui.grps?.has?.('lobby:' + grp);
      more.push(['acts', [['이 폴더로 부서 만들기', 'grp', grp, open ? 'on' : '']]]);
      more.push(['grp', grp, [
        // 첫 제안은 읽히는 폴더 이름(작업 사본이면 저장소 이름)이다. 같은 이름의 부서가 이미 있으면 끝 폴더 이름으로 돌아간다(Fable solio-room-content F2).
        // 견주기는 20자로 자른 뒤의 이름으로 한다. 자르기 전으로 견주면 긴 폴더 이름에서 이미 쓰인 이름이 그대로 제안됐다(Fable -b FA1)
        ['fld', '부서 이름', suggestName(v, departments), NAME_MAX + '자까지', 'nm-' + v.id, 'text'],
        ['acts', [['만들기', 'dept-from', v.id, flags('enter', ui.busy && 'off')], ['닫기', 'grp', grp]]],
      ], !open]);
    }
  }
  more.push(['note', '이 PC에서 따로 켠 AI(Claude Code, Codex)는 여기에 섭니다. 켠 폴더가 부서의 폴더이거나 그 아래이면 그 부서로 갑니다.']);
  more.push(['live', ui.notes?.get?.('lobby') || '']);
  return { key: 'lobby', nm: '부서 없는 일', flag: alert, mid, val, when: '', now: staff.some(v => v.status === 'asked'), watch: true, label: rowLabel(['부서 없는 일', alert && '새 소식', mid, val]), more };
}

/* 그림의 자료(office-floor.mjs). 부서 여섯까지 따로 그리고, 일곱째부터는 「그 밖」 한 구역으로 묶는다(5절) */
export function officeFloorScene({ departments = [], list = [], cap = null, view = 'tilted', viewSeq = 0, skin = 'black', skinSeq = 0, pick = null, picking = false, ui = {} } = {}) {
  const staffOf = v => ({
    id: v.id, status: v.status, alert: !!v.alert, subagents: v.subagents || 0,
    hat: HAT_IDS.has(v.hat) ? v.hat : null, picked: !!(picking && pick && v.seat === pick),
    provider: Object.hasOwn(TOOL_NAME, v.tool) ? v.tool : null,
    zone: v.departmentId == null ? 'lobby' : 'd:' + v.departmentId,
  });
  const zones = departments.slice(0, OFFICE_FLOOR_DEPTS).map(d => {
    const staff = list.filter(v => v.departmentId === d.id);
    return { key: 'd:' + d.id, kind: 'dept', name: d.name, urgent: staff.some(v => v.status === 'asked'), desk: deskOf(d, ui), held: heldOf(d, ui), staff: staff.map(staffOf) };
  });
  const rest = departments.slice(OFFICE_FLOOR_DEPTS);
  const lobby = list.filter(v => v.departmentId == null);
  if (lobby.length) zones.push({ key: 'lobby', kind: 'lobby', name: '부서 없는 일', urgent: lobby.some(v => v.status === 'asked'), staff: lobby.map(staffOf) });
  if (rest.length) {
    const ids = new Set(rest.map(d => d.id)), staff = list.filter(v => ids.has(v.departmentId));
    zones.push({ key: 'other', kind: 'other', name: '그 밖 ' + countWord(rest.length), urgent: staff.some(v => v.status === 'asked'), staff: staff.map(staffOf) });
  }
  return { view: view === 'top' ? 'top' : 'tilted', viewSeq, skin: skinOf(skin), skinSeq, deskSeq: ui.deskSeq || 0, seats: officeSeats(cap ?? 1), zones };
}

/* ── 방 하나(controller의 장면) ──
   snap: 본체의 사무실 판 { ok, available, state, departments, assignments, settings, roots, pc, readAt }
   ui: 이 방의 화면 상태(createOfficeRoom의 st). subs: 구독 방이 가진 스냅숏 */
export function officeRoom(snap, ui = {}, now = Date.now(), { subs = null } = {}) {
  if (!snap || typeof snap !== 'object' || snap.ok === false || snap.available !== true) return { visible: false };
  const departments = (Array.isArray(snap.departments) ? snap.departments : []).filter(d => d && typeof d.id === 'string');
  const assignments = snap.assignments && typeof snap.assignments === 'object' ? snap.assignments : {};
  const all = officeSessions(snap.state, now, { departments, assignments });
  // 승인 물음을 아는 직원이 하나도 없으면(첫 조각은 늘 그렇다) 직원 줄의 「승인 물음은 모릅니다」를 빼고 맨 위 둘째 줄에만 둔다
  const plain = all.some(v => v.hooked) ? all : all.map(v => ({ ...v, note: '' }));
  const subscriptions = officeSubscriptions(subs, now);
  const settings = snap.settings && typeof snap.settings === 'object' ? snap.settings : {};
  const list = officeSeated(plain, departments, looksOf(settings, ui));
  const skin = skinOf(ui.skinWant || settings.skin);
  const pick = (list.find(v => v.seat && v.seat === ui.pick) || officeLookOrder(list, departments)[0])?.seat || null;
  const pc = snap.pc && typeof snap.pc === 'object' ? snap.pc : null;
  // 쉬는 때는 수용 인원 줄이 숫자 대신 쉰다고 말하므로, 맨 위 글도 「몇까지인데」를 세지 않는다(0.5.2 공개 검수 A4)
  const capInfo = countableCapacity(pc, subscriptions, settings.manualCap);
  const cap = capInfo && capInfo.counted && !officeResting(capInfo) ? capInfo.cap : null;
  const head = officeTaskHeadline(officeHeadline(list, { cap }), list, snap.tasking);
  const view = ui.view || (settings.view === 'top' ? 'top' : 'tilted');
  const tasking = Array.isArray(snap.tasking?.tasks);
  const rows = departments.map((d, index) => departmentRow(d, list.filter(v => v.departmentId === d.id), ui, tasking, snap.tasking?.tasks, { seats: officeSeats(cap ?? 1), index }));
  const lobby = list.filter(v => v.departmentId == null);
  if (lobby.length) rows.push(lobbyRow(lobby, departments, ui, tasking));
  // 종류가 다른 줄 앞의 틈은 위에 부서 줄이 있을 때만 둔다(세션도 부서도 없으면 수용 인원이 첫 줄이다)
  const capRow = officeCapacityRow({ pc, subscriptions, manualCap: settings.manualCap ?? null, active: head.active, ui, now, tasking });
  rows.push({ ...capRow, gap: rows.length > 0 });
  rows.push(officeSettingsRow({ view, roots: snap.roots || {}, ui }));
  rows.push(officeLooksRow({ skin, staff: list, departments, pick, ui }));
  rows.push(officeAddRow({ ui }));
  const readAt = Number(snap.readAt);
  const foot = [Number.isFinite(readAt) ? (now - readAt < 2 * 60e3 ? '방금 읽었습니다.' : hm(readAt) + '에 읽었습니다.') : '', '이 방이 열려 있는 동안 15초마다 기록을 살핍니다.', ui.roomNote || ''].filter(Boolean).join(' ');
  return {
    visible: true, alert: list.some(v => v.alert), say: head.say, then: head.then, hint: head.hint, rows, foot, lookPick: pick,
    floor: officeFloorScene({ departments, list, cap, view, viewSeq: ui.viewSeq || 0, skin, skinSeq: ui.skinSeq || 0, pick, picking: !!ui.lookOpen, ui }),
    sessions: list.length,
    departments, seated: list,
  };
}

/* ── 이 방의 상태와 동작 ──
   api: window.synkDesktop.office({ snapshot, watch, saveDepartment, removeDepartment, assign, saveSettings, addRoot, removeRoot, seen, onChanged }).
   snapshot(): 지금 가진 사무실 판. reread(): 판을 다시 읽게 한다. changed(): 다시 그린다.
   한 번에 한 일만 보낸다(orb-rooms.mjs의 run과 같다). 계정이 바뀌면(reset) 늦게 온 답을 버린다 */
// todoDone: 「한 번에 처리」가 끝냈다고 적은 일({ [열쇠]: 때 }). 대화 목록의 「확인 기다림」이 같은 기록을 본다(Fable 최종 F4)
export function createOfficeRoom({ api = null, snapshot = () => null, reread = () => {}, changed = () => {}, todoDone = () => null } = {}) {
  const tasks = createOfficeTaskRoom({ api, reread, changed });
  const biz = createBizplanRoom({ api, changed });
  const fresh = () => ({ grps: new Set(), asking: null, notes: new Map(), busy: null, addName: '', addSeq: 0, view: null, viewSeq: 0, roomNote: '',
    skinWant: null, skinSeq: 0, lookWant: new Map(), pick: null, lookSeq: 0, lookOpen: false,
    // 부서별 책상: 눌렀지만 아직 판에 오지 않은 값, 조금 전까지 놓였던 수와 남기 시작한 때, 손님이 고른 차례
    deskWant: new Map(), deskHold: new Map(), deskSeq: 0,
    // 대화 짜임(PC앱_옮기기.md): 고른 상대, 보낸 뒤 「부서 없는 일」이 비면 갈 상대, 더한 부서 이름(판에 오면 고른다), 더하기 칸 열림,
    // 상대마다 마지막으로 본 때와 처음 그린 때(새 결과 느낌표), 「한 번에 처리」에서 온 일
    chat: null, chatAfter: null, chatWantName: null, addOpen: false, chatSeen: new Map(), chatBase: null });
  let st = fresh(), gen = 0, seq = 0, focusReq = null, openReq = null, seenAt = null; // seenAt: 마지막으로 그린 때. 자리는 손님이 본 그때로 센다
  const ask = req => ({ ...req, seq: ++seq });
  const note = (key, text) => { if (text) st.notes.set(key, text); else st.notes.delete(key); };
  const call = (name, ...args) => { try { return typeof api?.[name] === 'function' ? Promise.resolve(api[name](...args)) : Promise.resolve({ ok: false, code: 'NOT_ALLOWED' }); } catch { return Promise.resolve({ ok: false }); } };
  async function run(key, task) {
    if (st.busy) { note(key, OFFICE_BUSY_SAY); changed(); return null; }
    const my = gen;
    st.busy = key;
    changed();
    let res;
    try { res = await task(); } catch { res = { ok: false }; }
    if (my !== gen) return null;
    st.busy = null;
    return res && typeof res === 'object' ? res : { ok: false };
  }
  const departments = () => (Array.isArray(snapshot()?.departments) ? snapshot().departments : []);
  const deptOf = id => departments().find(d => d.id === id) || null;
  /* 이름을 먼저 여기서 본다(본체도 다시 본다). 틀리면 그 줄에 까닭을 쓰고 보내지 않는다 */
  function nameProblem(name, id = null) {
    if (!name || [...name].length > NAME_MAX) return 'NAME';
    if (departments().some(d => d.id !== id && nameKey(d.name) === nameKey(name))) return 'NAME_TAKEN';
    return null;
  }
  // 고친 뒤에는 판을 다시 읽는다. 폴더 고르기 창을 닫으면(CANCELLED) 아무 말도 남기지 않는다
  function after(key, res, okText, done) {
    if (res === null) return true;
    if (res.ok === false) { if (res.code !== 'CANCELLED') note(key, officeCodeSay(res.code)); if (res.code === 'NOT_FOUND') reread(); changed(); return true; }
    note(key, okText);
    done?.();
    reread();
    changed();
    return true;
  }
  /* 지금 선 직원의 자리(꾸미기). 판과 손님이 누른 값으로 센다 */
  function seatsNow() {
    const snap = snapshot();
    if (!snap || snap.available !== true) return [];
    const depts = departments(), all = officeSessions(snap.state, seenAt ?? Date.now(), { departments: depts, assignments: snap.assignments && typeof snap.assignments === 'object' ? snap.assignments : {} });
    return officeSeated(all, depts, looksOf(snap.settings, st)).filter(v => v.seat);
  }
  /* 판에 온 값과 같아진 「누른 값」은 지운다. 그 뒤로는 판을 따른다(설계 검토 9) */
  function settle(snap) {
    const s = snap?.settings && typeof snap.settings === 'object' ? snap.settings : {};
    if (st.skinWant && skinOf(s.skin) === st.skinWant) st.skinWant = null;
    const looks = s.looks && typeof s.looks === 'object' ? s.looks : {};
    for (const [seat, w] of [...st.lookWant]) {
      const l = looks[seat] && typeof looks[seat] === 'object' ? looks[seat] : {};
      if (['hat', 'name'].every(f => !Object.hasOwn(w, f) || (l[f] || null) === (w[f] || null))) st.lookWant.delete(seat);
    }
    for (const [id, w] of [...st.deskWant]) {
      const d = departments().find(x => x.id === id);
      if (!d || ['size', 'count', 'finish'].every(f => !Object.hasOwn(w, f) || (d.desk?.[f] ?? null) === (w[f] ?? null))) st.deskWant.delete(id);
    }
  }
  /* 책상은 바로 늘고 늦게 준다. 남는 책상이 desk 시간만큼 이어 남아야 거둔다. 손님이 책상을 고르거나 방을 다시 열면 바로 맞춘다 */
  function holdDesks(snap, now) {
    if (!snap || snap.available !== true) return;
    const depts = departments(), count = new Map();
    for (const v of officeSessions(snap.state, now, { departments: depts, assignments: snap.assignments && typeof snap.assignments === 'object' ? snap.assignments : {} })) count.set(v.departmentId, (count.get(v.departmentId) || 0) + 1);
    for (const id of [...st.deskHold.keys()]) if (!depts.some(d => d.id === id)) st.deskHold.delete(id);
    for (const d of depts) {
      const need = officeDeskPlan(deskOf(d, st), count.get(d.id) || 0).desks, h = st.deskHold.get(d.id);
      if (!h || need >= h.desks) st.deskHold.set(d.id, { desks: need, spareAt: null });
      else if (h.spareAt == null) h.spareAt = now;
      else if (now - h.spareAt >= OFFICE_TIMING.desk) st.deskHold.set(d.id, { desks: need, spareAt: null });
    }
  }
  /* 누르기 전 값으로 되돌린다(실패 · 바쁨) */
  function unwant(seat, before) { if (before === undefined) st.lookWant.delete(seat); else st.lookWant.set(seat, before); }
  /* 대화 상대 바꾸기. 떠나는 부서 대화의 끝냄 느낌표를 지우고(고른 순간이 아니라 떠날 때, 설계 검토 8), 보낼 부서를 맞춘다(설계 검토 1) */
  // 때는 마지막으로 그린 때(seenAt)로 센다. 장면의 now와 같은 시계라 「새 결과」가 어긋나지 않는다
  // 방을 닫을 때(close)는 다시 읽지 않는다. 숨은 창이 기록 지켜보기를 다시 켜지 않게 한다(본체가 바뀜을 알리면 그때 읽는다)
  function leaveChat(at = seenAt ?? Date.now(), { again = true } = {}) {
    const was = st.chat;
    if (!was) return;
    st.chatSeen.set(was, at);
    // 떠나는 대화의 펼친 묶음과 「빼시겠습니까?」 물음을 거둔다(옛 짜임의 줄 접기와 같다, Fable 최종 F6)
    foldRow(was);
    st.chatAfter = null;
    // 「사무실」을 떠나면 꾸미기와 수용 인원의 줄이 없어진다. 그림의 고른 직원 표시와 「직접 정하기」가 남지 않게 함께 거둔다(0.5.12 공개 후보 Fable F1)
    if (was === OFFICE_CHAT_ALL) { st.lookOpen = false; for (const g of [...st.grps]) if (g.startsWith('cap:')) st.grps.delete(g); }
    if (was === 'lobby' || was.startsWith('d:')) {
      const id = was === 'lobby' ? null : was.slice(2);
      void call('seen', id).then(res => { if (again && res?.ok !== false) reread(); });
    }
  }
  function pickChat(key, at = seenAt ?? Date.now()) {
    st.chatSeen.set(key, at);
    if (st.chat === key) return; // 같은 대화를 다시 고르면 이어서 맡기기를 풀지 않는다
    leaveChat(at);
    st.chat = key;
    st.chatSeen.set(key, at);
    if (key !== 'lobby') tasks.pickDepartment(officeChatDepartment(key));
  }
  const foldRow = key => { for (const g of [...st.grps]) if (g.startsWith(key + ':')) st.grps.delete(g); if (key.startsWith('d:') && st.asking === key.slice(2)) st.asking = null; };

  async function handle(p = {}) {
    if (typeof p.act === 'string' && p.act.startsWith('task-')) {
      const was = tasks.current().departmentId;
      await tasks.handle(p);
      // 그림의 직원 · 「이어서 맡기기」 · 「다시 맡기기」 · 「사무실」 입력칸의 부서 칸이 부서를 바꾸면 고른 대화도 그 부서로 간다(설계 검토 1, Fable 최종 F1).
      // 부서가 없으면 「사무실」
      if (p.act === 'task-open' || p.act === 'task-follow' || p.act === 'task-retry' || p.act === 'task-department') {
        const now = tasks.current().departmentId, key = now && deptOf(now) ? 'd:' + now : OFFICE_CHAT_ALL;
        if (key !== st.chat && (now !== was || p.act === 'task-open')) { leaveChat(); st.chat = key; st.chatSeen.set(key, seenAt ?? Date.now()); }
        changed();
      }
      return true;
    }
    // 대화 상대를 고른다(왼쪽 목록 · 그림의 책상)
    if (p.act === 'chat-pick') {
      const key = String(p.arg || ''), snap = snapshot();
      const lobby = !!(snap && snap.available === true && officeSessions(snap.state, seenAt ?? Date.now(), { departments: departments(), assignments: snap.assignments && typeof snap.assignments === 'object' ? snap.assignments : {} }).some(v => v.departmentId == null));
      if (!officeChatKeyOk(key, { departments: departments(), lobby })) return true;
      pickChat(key);
      if (p.focus) focusReq = ask({ key: p.focus });
      changed();
      return true;
    }
    // 「한 번에 처리」에서 맡긴 일로 왔다: 그 일의 부서 대화를 고르고 그 말로 간다(설계 검토 4)
    if (p.act === 'chat-task') {
      const id = String(p.arg || ''), list = snapshot()?.tasking?.tasks;
      const t = Array.isArray(list) ? list.find(x => x && String(x.id) === id) : null;
      if (!t) return true;
      pickChat(officeTaskChatKey(t, departments()));
      focusReq = ask({ task: id });
      changed();
      return true;
    }
    // 목록 머리의 「+」: 부서 더하기 칸을 열고 닫는다
    if (p.act === 'chat-add') {
      st.addOpen = p.arg === 'close' ? false : p.arg === 'open' ? true : !st.addOpen;
      focusReq = st.addOpen ? ask({ key: 'add', field: officeAddField(st) }) : ask({ addBtn: true });
      changed();
      return true;
    }
    // 기능의 작업 화면: 부서 줄의 기능 줄을 누르면 열리고, 「← 사무실」로 닫는다
    if (p.act === 'feature-open' && String(p.key || '').startsWith('d:') && p.arg === 'bizplan') { biz.open(String(p.key).slice(2)); changed(); return true; }
    if (p.act === 'biz-close') { const back = biz.departmentId; biz.close(); if (back && deptOf(back)) pickChat('d:' + back); focusReq = ask({ say: true }); changed(); return true; }
    if (typeof p.act === 'string' && p.act.startsWith('biz-')) { await biz.handle(p); return true; }
    const key = String(p.key || ''), act = String(p.act || ''), arg = p.arg == null ? '' : String(p.arg), fields = p.fields && typeof p.fields === 'object' ? p.fields : {};
    if (act === 'disarm') return true;
    // 부서 줄을 열었다 닫으면 그 부서의 끝냄 느낌표를 지운다(4.1). 닫힌 부서는 다음에 열 때 기능이 접힌 채로 열린다(시안 sync)
    if (key === 'look' && (act === 'row-open' || act === 'row-fold')) { st.lookOpen = act === 'row-open'; changed(); return true; }
    if (act === 'row-open') return true;
    if (act === 'row-fold') {
      // 수용 인원 줄을 접으면 저장하지 않고 펼쳐 둔 「직접 정하기」도 접는다. 다시 열면 실제 값(자동)이 골라져 있다(카본 A6)
      if (key === 'cap' && [...st.grps].some(g => g.startsWith('cap:'))) { foldRow(key); changed(); }
      if (key.startsWith('d:') || key === 'lobby') {
        foldRow(key);
        const id = key === 'lobby' ? null : key.slice(2);
        void call('seen', id).then(res => { if (res?.ok !== false) reread(); });
        changed();
      }
      return true;
    }
    if (act !== 'grp' && act !== 'dept-name') { note(key, ''); st.roomNote = ''; }
    switch (act) {
      case 'grp': {
        const name = key + ':' + arg;
        if (st.grps.has(name)) { st.grps.delete(name); focusReq = ask({ key, act: 'grp', arg }); } else { st.grps.add(name); focusReq = ask({ key, grp: arg }); }
        if (key.startsWith('d:') && arg === 'set' && !st.grps.has(name) && st.asking === key.slice(2)) st.asking = null;
        changed(); return true;
      }
      case 'dept-name': st.addName = arg; focusReq = ask({ key, field: officeAddField(st) }); changed(); return true;
      case 'dept-add': {
        const field = officeAddField(st), name = cleanName(fields[field] ?? fields.name);
        const bad = nameProblem(name);
        if (bad) { note(key, officeCodeSay(bad)); focusReq = ask({ key, field }); changed(); return true; }
        const res = await run(key, () => call('saveDepartment', { name, folder: 'choose' }));
        return after(key, res, `「${name}」 부서를 더했습니다.`, () => { st.addName = ''; st.addSeq += 1; st.addOpen = false; st.chatWantName = name; st.roomNote = `「${name}」 부서를 더했습니다.`; focusReq = ask({ say: true }); });
      }
      case 'dept-from': {
        const name = cleanName(fields['nm-' + arg]);
        const bad = nameProblem(name);
        if (bad) { note(key, officeCodeSay(bad)); changed(); return true; }
        const res = await run(key, () => call('saveDepartment', { name, folder: { fromSession: arg } }));
        // 이 세션이 새 부서로 가면 「부서 없는 일」 줄이 없어질 수 있어 방 아래의 글에 적는다(카본 A2)
        return after(key, res, '', () => { st.grps.delete(key + ':mk-' + arg); st.roomNote = `「${name}」 부서를 만들었습니다. 이 세션은 그 부서로 갑니다.`; focusReq = ask({ say: true }); });
      }
      case 'dept-rename': {
        const d = deptOf(arg), name = cleanName(fields.name);
        if (!d) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        if (name === d.name) { note(key, '이름이 그대로입니다.'); changed(); return true; }
        const bad = nameProblem(name, d.id);
        if (bad) { note(key, officeCodeSay(bad)); changed(); return true; }
        const res = await run(key, () => call('saveDepartment', { id: d.id, name }));
        return after(key, res, '이름을 바꿨습니다.');
      }
      case 'dept-folder': {
        const d = deptOf(arg);
        if (!d) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        const res = await run(key, () => call('saveDepartment', { id: d.id, folder: 'choose' })); // 이름은 싣지 않는다. 본체가 저장된 이름 그대로 둔다(GA3)
        return after(key, res, '폴더를 바꿨습니다.');
      }
      // 부서 빼기는 그 자리에서 한 번 더 묻는다(2단계 둘째 조각 설계 8.3의 확인 묶음). 줄이 접히면 물음도 거둔다
      case 'dept-remove-ask':
        st.asking = st.asking === arg ? null : arg;
        focusReq = st.asking ? ask({ key, ask: true }) : ask({ key, act, arg });
        changed(); return true;
      case 'dept-remove-keep': st.asking = null; focusReq = ask({ key, act: 'dept-remove-ask', arg }); changed(); return true;
      case 'dept-remove': {
        const d = deptOf(arg);
        if (!d || st.asking !== arg) { st.asking = null; changed(); return true; }
        const res = await run(key, () => call('removeDepartment', d.id));
        return after(key, res, '', () => { st.asking = null; foldRow(key); if (st.chat === key) { st.chat = OFFICE_CHAT_ALL; tasks.pickDepartment(null); } st.roomNote = `「${d.name}」 부서를 뺐습니다.`; focusReq = ask({ say: true }); });
      }
      case 'assign': {
        const [sid, did] = arg.split('|');
        const d = deptOf(did);
        if (!sid || !d) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        const res = await run(key, () => call('assign', sid, d.id));
        // 보낸 부서의 줄을 열어 둔다(시안 send → pin)
        return after(key, res, '', () => { note('lobby', `이 세션을 ${ro(d.name)} 보냈습니다.`); note('d:' + d.id, `이 세션을 ${ro(d.name)} 보냈습니다.`); if (st.chat === 'lobby') st.chatAfter = { key: 'd:' + d.id, sid, did: d.id }; });
      }
      case 'view': {
        const view = arg === 'top' ? 'top' : 'tilted';
        const was = st.view;
        if (st.view !== view) { st.view = view; st.viewSeq += 1; }
        changed();
        const res = await run(key, () => call('saveSettings', { view }));
        if (res === null || res.ok === false) { if (st.view !== was) { st.view = was; st.viewSeq += 1; } changed(); }
        return after(key, res, '');
      }
      case 'skin': {
        if (!OFFICE_SKINS.some(([k]) => k === arg)) return true;
        const was = st.skinWant, shown = skinOf(st.skinWant || snapshot()?.settings?.skin);
        if (shown === arg) { changed(); return true; }
        st.skinWant = arg; st.skinSeq += 1;
        changed();
        const res = await run(key, () => call('saveSettings', { skin: arg }));
        if (res === null || res.ok === false) { st.skinWant = was; st.skinSeq += 1; changed(); }
        return after(key, res, `${skinWord(arg)} 스킨을 입혔습니다.`);
      }
      case 'look-pick': {
        if (!seatsNow().some(v => v.seat === arg)) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        if (st.pick !== arg) { st.pick = arg; st.lookSeq += 1; }
        changed(); return true;
      }
      case 'look-hat': {
        const cut = arg.lastIndexOf('|'), seat = arg.slice(0, cut), id = arg.slice(cut + 1);
        const v = seatsNow().find(x => x.seat === seat);
        if (!v || !(id === 'none' || HAT_IDS.has(id))) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        const hat = id === 'none' ? null : id;
        st.pick = seat;
        if ((v.hat || null) === hat) { changed(); return true; }
        const before = st.lookWant.get(seat);
        st.lookWant.set(seat, { ...(before || {}), hat });
        changed();
        const res = await run(key, () => call('saveSettings', { look: { seat, hat } }));
        if (res === null || res.ok === false) { unwant(seat, before); changed(); }
        return after(key, res, hat ? `${whoOf(v)}에게 ${eul(hatWord(hat))} 씌웠습니다.` : `${whoOf(v)}의 모자를 벗겼습니다.`);
      }
      case 'look-rename': {
        const v = seatsNow().find(x => x.seat === arg);
        if (!v) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        const typed = cleanName(fields[officeLookField(st, arg)]);
        // 처음 이름을 그대로 적으면 비운 것과 같다. 처음 이름은 12자를 넘을 수 있어 길이보다 먼저 본다(검수 A1)
        const name = typed === v.seatName ? '' : typed;
        if (LOOK_HIDDEN.test(name)) { note(key, '이름에 쓸 수 없는 글자가 있습니다.'); changed(); return true; }
        if ([...name].length > OFFICE_LOOK_NAME_MAX) { note(key, `이름은 ${OFFICE_LOOK_NAME_MAX}자까지 적어 주세요.`); changed(); return true; }
        if (name === v.lookName) { note(key, '이름이 그대로입니다.'); changed(); return true; }
        const before = st.lookWant.get(arg);
        st.lookWant.set(arg, { ...(before || {}), name: name || null });
        st.pick = arg;
        changed();
        const res = await run(key, () => call('saveSettings', { look: { seat: arg, name } }));
        if (res === null || res.ok === false) { unwant(arg, before); changed(); }
        return after(key, res, name ? `이름을 ${ro('「' + name + '」')} 바꿨습니다.` : `처음 이름 ${ro('「' + v.seatName + '」')} 되돌렸습니다.`, () => { st.lookSeq += 1; });
      }
      // 부서의 책상: 크기 · 수 · 재질. 그림과 줄을 먼저 바꾸고 저장한다. 실패하거나 바쁘면 누르기 전 값으로 되돌린다(스킨 · 모자와 같다)
      case 'desk-size': case 'desk-count': case 'desk-finish': {
        const cut = arg.lastIndexOf('|'), d = deptOf(arg.slice(0, cut)), raw = arg.slice(cut + 1), field = act.slice(5);
        if (!d) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        const value = field === 'finish' ? (raw === 'office' ? null : raw) : Number(raw);
        const good = field === 'size' ? OFFICE_DESK_SIZES.includes(value) : field === 'count' ? Number.isInteger(value) && value >= 1 && value <= OFFICE_DESK_COUNT_MAX : value === null || OFFICE_DESK_FINISHES.includes(value);
        if (!good) return true;
        const shown = deskOf(d, st), had = field === 'finish' ? shown.finish ?? null : shown[field] ?? (field === 'size' ? 3 : 1);
        if (had === value) { changed(); return true; }
        const before = st.deskWant.get(d.id), hold = st.deskHold.get(d.id);
        st.deskWant.set(d.id, { ...(before || {}), [field]: value });
        if (field !== 'finish') st.deskHold.delete(d.id);
        st.deskSeq += 1;
        changed();
        const res = await run(key, () => call('saveSettings', { desk: { department: d.id, [field]: value } }));
        if (res === null || res.ok === false) {
          if (before === undefined) st.deskWant.delete(d.id); else st.deskWant.set(d.id, before);
          if (hold) st.deskHold.set(d.id, hold);
          st.deskSeq += 1;
          changed();
        }
        return after(key, res, field === 'size' ? `${value}인 책상으로 바꿨습니다.` : field === 'count' ? `책상을 ${ro(countWord(value))} 정했습니다.` : value === null ? '사무실과 같은 재질로 되돌렸습니다.' : `${finishWord(value)} 책상으로 바꿨습니다.`);
      }
      case 'cap-mode': {
        if (arg === 'manual') { st.grps.add('cap:manual'); focusReq = ask({ key, field: 'cap' }); changed(); return true; }
        st.grps.delete('cap:manual');
        if (snapshot()?.settings?.manualCap == null) { changed(); return true; }
        const res = await run(key, () => call('saveSettings', { manualCap: null }));
        return after(key, res, '자동으로 정합니다.');
      }
      case 'cap-save': {
        const cores = Math.max(1, Math.floor(Number(snapshot()?.pc?.cores) || 1));
        const n = Number(String(fields.cap ?? '').replace(/[,\s]/g, ''));
        if (!Number.isInteger(n) || n < 1 || n > cores) { note(key, `1에서 ${cores}까지의 수를 적어 주세요.`); focusReq = ask({ key, field: 'cap' }); changed(); return true; }
        const res = await run(key, () => call('saveSettings', { manualCap: n }));
        return after(key, res, `동시에 ${countWord(n)}까지로 정했습니다.`);
      }
      case 'root-add': { const res = await run(key, () => call('addRoot')); return after(key, res, '폴더를 더했습니다.'); }
      case 'root-remove': { const res = await run(key, () => call('removeRoot', arg)); return after(key, res, '폴더를 뺐습니다.'); }
      default: return false;
    }
  }

  /* 대화 짜임의 자료. 고른 상대를 정한다: 더한 부서가 판에 오면 그 부서, 없어진 상대는 「사무실」(보낸 뒤 비운 「부서 없는 일」은 보낸 부서),
     처음 열 때만 느낌표가 있는 첫 부서(설계 검토 9). 고른 상대가 바뀌면 보낼 부서도 맞춘다 */
  function chatScene(room, plain, now, assigned) {
    const taskList = Array.isArray(plain?.tasks) ? plain.tasks : [];
    const depts = room.departments || [], lobby = (room.rows || []).some(r => r.key === 'lobby');
    if (st.chatBase == null) st.chatBase = now;
    if (st.chatWantName) {
      const d = depts.find(x => x.name === st.chatWantName);
      if (d) { st.chatWantName = null; pickChat('d:' + d.id, now); }
    }
    // 보낸 세션이 부서로 간 뒤에도 「부서 없는 일」이 남으면 따라갈 까닭이 없다. 남은 세션이 나중에 저절로 끝날 때 방과 초점이 옮겨 가지 않게 한다(0.5.12 다시 검수 FA1)
    if (st.chatAfter && lobby && assigned?.[st.chatAfter.sid] === st.chatAfter.did) st.chatAfter = null;
    if (st.chat && !officeChatKeyOk(st.chat, { departments: depts, lobby })) {
      const next = st.chat === 'lobby' && st.chatAfter && officeChatKeyOk(st.chatAfter.key, { departments: depts, lobby }) ? st.chatAfter.key : OFFICE_CHAT_ALL;
      // 마지막 세션을 부서로 보내 「부서 없는 일」이 없어졌으면 누른 단추도 사라진다. 자판 초점을 방 머리로 보낸다(0.5.12 공개 후보 Fable F2)
      if (next !== OFFICE_CHAT_ALL) focusReq = ask({ say: true });
      st.chat = null; st.chatAfter = null;
      pickChat(next, now);
    }
    const contacts = () => officeChatContacts(room, { tasks: taskList, chat: st.chat, seen: st.chatSeen, base: st.chatBase, now, done: todoDone() });
    let list = contacts();
    if (!st.chat) { pickChat(officeChatFirst(list), now); list = contacts(); }
    const panes = officeChatPanes(room, st.chat, { tasking: Array.isArray(plain?.tasks), contacts: list });
    // 「사무실」과 부서를 고른 동안 보낼 부서는 늘 고른 상대와 같다(장면마다 맞춘다. 맡기기가 꺼진 판에서는 일이 없다)
    if (st.chat !== 'lobby' && tasks.current().departmentId !== officeChatDepartment(st.chat)) tasks.pickDepartment(officeChatDepartment(st.chat));
    return { ...panes, sel: st.chat, contacts: list, addOpen: st.addOpen, foot: room.foot };
  }

  return {
    handle,
    /* 장면. 한 번만 따를 요청(열 줄, 초점)을 붙인다 */
    scene(snap, now, subs) {
      seenAt = now;
      settle(snap);
      holdDesks(snap, now);
      const room = officeRoom(snap, st, now, { subs });
      // 고른 직원의 자리가 비어 다른 직원으로 넘어갔으면 그 직원을 고른 것으로 둔다. 옛 자리에 새 세션이 서도 손님이 누르지 않은 고르기로 돌아가지 않는다(최종 검수 F1)
      if (room.visible && st.pick && room.lookPick !== st.pick) st.pick = room.lookPick;
      // 기능 줄(사업계획서 읽기)은 부서 줄과 작업 화면에만 보이고 일 맡기기 카드에는 섞지 않는다(코드 검수 P2-5)
      const plain = room.visible && snap.tasking && Array.isArray(snap.tasking.tasks) ? { ...snap.tasking, tasks: snap.tasking.tasks.filter(t => !t.feature) } : (room.visible ? snap.tasking : null);
      const chat = room.visible ? chatScene(room, plain, now, snap.assignments) : null;
      const tasking = tasks.scene(plain, snap?.departments);
      const deptId = biz.departmentId, depts = Array.isArray(snap?.departments) ? snap.departments : [];
      const dept = deptId && depts.find(d => d.id === deptId);
      // 작업 화면은 일 맡기기가 켜진 판에서 부서가 남아 있을 때만 선다. 부서를 빼면 사무실로 돌아간다
      if (deptId && (!room.visible || !dept || !Array.isArray(snap?.tasking?.tasks))) biz.close();
      const feature = biz.departmentId ? biz.scene(featureTask(snap.tasking.tasks, 'bizplan', deptId), { departments: depts, deptName: dept.name }) : null;
      return room.visible ? { ...room, ...(tasking ? {tasking} : {}), ...(feature ? { feature } : {}), ...(chat ? { chat } : {}), focus: focusReq, opening: openReq } : room;
    },
    /* 방을 떠날 때: 열어 둔 묶음과 물음, 알림 줄을 지운다(보기 고른 것은 남긴다) */
    close() { leaveChat(seenAt ?? Date.now(), { again: false }); st.grps.clear(); st.asking = null; st.notes.clear(); st.roomNote = ''; st.lookOpen = false; st.addOpen = false; st.deskHold.clear(); focusReq = null; openReq = null; biz.close(); },
    /* 계정이 바뀌면 다 비운다 */
    reset() { gen += 1; tasks.reset(); biz.reset(); st = fresh(); focusReq = null; openReq = null; },
    busy: () => st.busy,
  };
}
