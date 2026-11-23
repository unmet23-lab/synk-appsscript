// 솔리오 「사무실」 방(PC 클라이언트 첫 조각 「보기」, 2026-11-20)의 줄 자료와 그 방의 동작. DOM이 없다.
// 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 5~7절 · 11절, 시안 사무실.html과 README 「담은 것」 1~17. 직원의 상태와 문장, 수용 인원 셈은 office-model.mjs가 정한다.
// 줄 하나의 꼴과 안쪽 [종류, …]는 solio-rooms.mjs와 같다. 이 방에서 더한 안쪽 종류는 둘이다.
//   ['staff', 세션 번호, 도구, 모델, 상태 문장, 하는 일, 표시('alert' · 'now')] — 직원 줄. 그림에서 그 직원을 가리키면 줄이 밝아진다
//   ['item', 이름, 한 문장, 열림, 묶음 이름, 오른쪽] — 부서의 기능 줄(담은 것 16). 누르면 바로 아래 묶음(grp)이 열린다
// 줄의 flag가 참이면 이름 옆에 느낌표가 붙는다(7절). 부서 줄과 「부서 없는 일」은 watch 줄이라, 열었다 닫으면 seen을 부른다(4.1 끝냄).
import { officeSessions, officeHeadline, officeCapacity, officeSeats, countWord } from './office-model.mjs';
import { createOfficeTaskRoom, officeTaskHeadline } from './office-task-room.mjs';
import { createBizplanRoom } from './office-bizplan-room.mjs';
import { bizplanLine, attachesBizplan } from './office-bizplan-model.mjs';
import { limitGauge } from './subscriptions-model.mjs';
import { josa, whenWords } from './solio-today.mjs';

export const OFFICE_NAME = '사무실';
/* 방이 보이는 동안 분 글을 다시 쓰는 사이, 솔리오가 보이는 동안 오브제의 느낌표를 맞추려고 다시 읽는 사이, 바뀜 알림을 모으는 시간(ms) */
export const OFFICE_TIMING = Object.freeze({ clock: 15000, poll: 60000, changed: 250 });
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
/* 경로의 끝 두 마디(「문서\마케팅」). 줄에는 짧게 쓰고 온전한 경로는 부서 설정 안에 둔다 */
export const folderTail = p => String(p ?? '').replace(/[\\/]+$/, '').split(/[\\/]+/).filter(Boolean).slice(-2).join('\\');
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
/* 직원 줄의 작은 글: 작업 폴더와 마지막 도구, 도우미 수, 모르는 것 */
export function officeStaffDetail(v) {
  const helpers = v.subagents > 0 ? wa('도우미 ' + countWord(v.subagents)) + ' 함께' : '';
  return [v.activity, helpers, v.note].filter(Boolean).join(' · ');
}
function staffItem(v) {
  return ['staff', v.id, TOOL_NAME[v.tool] || v.tool || '', modelWord(v.model), v.say, officeStaffDetail(v), flags(v.alert && 'alert', v.status === 'asked' && 'now')];
}
function staffItems(v, tasking) {
  const rows = [staffItem(v)];
  if (tasking && Object.hasOwn(TOOL_NAME, v.tool)) {
    const name = v.tool === 'codex' ? 'GPT (Codex)' : TOOL_NAME[v.tool];
    rows.push(['acts', [[name + '에게 새 일 맡기기', 'task-open', v.tool]]]);
  }
  return rows;
}
const rowLabel = parts => parts.filter(Boolean).join(', ');

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
  const count = claude.length + codex.length;
  const more = [
    ['pick', '보기', [['비스듬히', 'tilted'], ['위에서', 'top']], view === 'top' ? 'top' : 'tilted', '', 'view'],
    ['note', '같은 사무실을 보는 각도입니다. 고른 보기는 다음에 열 때도 그대로입니다.'],
    ...claude.map(dir => ['row', 'Claude Code', String(dir), addedOf(dir) != null ? ['빼기', 'root-remove', String(addedOf(dir)), ui.busy ? 'off' : ''] : '', '']),
    ...resting.map(dir => ['row', 'Claude Code', String(dir) + ' · 지금은 보지 않음', ['빼기', 'root-remove', String(dir), ui.busy ? 'off' : ''], '']),
    ...(resting.length ? [['note', '「지금은 보지 않음」은 구독 방의 계정 폴더이거나, 2초 안에 답하지 않거나 실제 위치를 알 수 없는 폴더입니다.']] : []),
    ...codex.map(dir => ['row', 'Codex', String(dir), '', '']),
    ['acts', [['폴더 더하기', 'root-add', '', ui.busy ? 'off' : '']], '보는 폴더'],
    ['note', 'Claude Code의 기본 설정 폴더와 Codex의 기록 폴더는 늘 봅니다. 다른 설정 폴더를 쓰면 더해 주세요.'],
    ['live', note],
  ];
  const mid = `보기 · ${shown} · 보는 폴더 ${countWord(count)}`;
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
function departmentRow(d, staff, ui, tasking, tasks = []) {
  const key = 'd:' + d.id, lead = officeLead(staff), alert = staff.some(v => v.alert);
  const mid = lead ? lead.activity || lead.say : folderTail(d.folder);
  const val = officeGroupStatus(staff);
  const more = staff.flatMap(v => staffItems(v, tasking));
  if (tasking) more.push(['acts', [['이 부서에 일 맡기기', 'task-open', '']]]);
  else if (!staff.length) more.push(['note', '이 폴더에서 Claude Code나 Codex를 켜면 여기에 섭니다.']);
  // 기능 줄은 누르면 작업 화면이 열린다(사업계획서_설계.md 2절). 일 맡기기가 켜진 판에서만 선다
  if (tasking && attachesBizplan(d)) {
    const l = bizplanLine(featureTask(tasks, 'bizplan', d.id));
    more.push(['item', '사업계획서', l.line, false, 'bizplan', l.when, 'feature']);
  }
  const open = !!ui.grps?.has?.(key + ':set'), asking = ui.asking === d.id;
  more.push(['item', '부서 설정', folderTail(d.folder), open, 'set', '']);
  const inner = [
    ['fld', '부서 이름', d.name, NAME_MAX + '자까지', 'name', 'text'],
    ['acts', [['이름 저장', 'dept-rename', d.id, flags('enter', ui.busy && 'off')], ['폴더 바꾸기', 'dept-folder', d.id, ui.busy ? 'off' : ''], ['부서 빼기', 'dept-remove-ask', d.id, flags('toggle', asking && 'on', 'far')]]],
    ['row', '폴더', String(d.folder || ''), '', ''],
  ];
  if (asking) inner.push(['confirm', eul(d.name) + ' 빼시겠습니까?', ['이 부서에 선 직원은 「부서 없는 일」로 갑니다.', '폴더와 그 안의 파일은 그대로 둡니다.'], [['부서 빼기', 'dept-remove', d.id, ui.busy ? 'off' : ''], ['그만두기', 'dept-remove-keep', d.id]]]);
  more.push(['grp', 'set', inner, !open]);
  more.push(['live', ui.notes?.get?.(key) || '']);
  return { key, nm: d.name, flag: alert, mid, val, when: '', now: staff.some(v => v.status === 'asked'), watch: true, label: rowLabel([d.name, alert && '새 소식', mid, val]), more };
}

/* 「부서 없는 일」: 솔리오 밖에서 연 일 가운데 부서 폴더 밖의 것(5절). 세션마다 그 작업 폴더로 부서를 만들거나 보낼 부서를 고른다 */
function lobbyRow(staff, departments, ui, tasking) {
  const lead = officeLead(staff), alert = staff.some(v => v.alert);
  const mid = lead.activity || lead.say, val = officeGroupStatus(staff);
  const more = [];
  for (const v of staff) {
    more.push(...staffItems(v, tasking));
    if (departments.length) more.push(['acts', departments.map(d => [d.name, 'assign', v.id + '|' + d.id, ui.busy ? 'off' : '']), '보낼 부서']);
    if (v.cwd) {
      const grp = 'mk-' + v.id, open = !!ui.grps?.has?.('lobby:' + grp);
      more.push(['acts', [['이 폴더로 부서 만들기', 'grp', grp, open ? 'on' : '']]]);
      more.push(['grp', grp, [
        ['fld', '부서 이름', lastPart(v.cwd).slice(0, NAME_MAX), NAME_MAX + '자까지', 'nm-' + v.id, 'text'],
        ['acts', [['만들기', 'dept-from', v.id, flags('enter', ui.busy && 'off')], ['닫기', 'grp', grp]]],
      ], !open]);
    }
  }
  more.push(['note', '솔리오 밖에서 직접 연 일은 여기에 섭니다. 작업 폴더가 부서의 폴더이거나 그 아래이면 그 부서로 갑니다.']);
  more.push(['live', ui.notes?.get?.('lobby') || '']);
  return { key: 'lobby', nm: '부서 없는 일', flag: alert, mid, val, when: '', now: staff.some(v => v.status === 'asked'), watch: true, label: rowLabel(['부서 없는 일', alert && '새 소식', mid, val]), more };
}

/* 그림의 자료(office-floor.mjs). 부서 여섯까지 따로 그리고, 일곱째부터는 「그 밖」 한 구역으로 묶는다(5절) */
export function officeFloorScene({ departments = [], list = [], cap = null, view = 'tilted', viewSeq = 0 } = {}) {
  const staffOf = v => ({
    id: v.id, status: v.status, alert: !!v.alert, subagents: v.subagents || 0,
    provider: Object.hasOwn(TOOL_NAME, v.tool) ? v.tool : null,
    zone: v.departmentId == null ? 'lobby' : 'd:' + v.departmentId,
  });
  const zones = departments.slice(0, OFFICE_FLOOR_DEPTS).map(d => {
    const staff = list.filter(v => v.departmentId === d.id);
    return { key: 'd:' + d.id, kind: 'dept', name: d.name, urgent: staff.some(v => v.status === 'asked'), staff: staff.map(staffOf) };
  });
  const rest = departments.slice(OFFICE_FLOOR_DEPTS);
  const lobby = list.filter(v => v.departmentId == null);
  if (lobby.length) zones.push({ key: 'lobby', kind: 'lobby', name: '부서 없는 일', urgent: lobby.some(v => v.status === 'asked'), staff: lobby.map(staffOf) });
  if (rest.length) {
    const ids = new Set(rest.map(d => d.id)), staff = list.filter(v => ids.has(v.departmentId));
    zones.push({ key: 'other', kind: 'other', name: '그 밖 ' + countWord(rest.length), urgent: staff.some(v => v.status === 'asked'), staff: staff.map(staffOf) });
  }
  return { view: view === 'top' ? 'top' : 'tilted', viewSeq, seats: officeSeats(cap ?? 1), zones };
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
  const list = all.some(v => v.hooked) ? all : all.map(v => ({ ...v, note: '' }));
  const subscriptions = officeSubscriptions(subs, now);
  const settings = snap.settings && typeof snap.settings === 'object' ? snap.settings : {};
  const pc = snap.pc && typeof snap.pc === 'object' ? snap.pc : null;
  // 쉬는 때는 수용 인원 줄이 숫자 대신 쉰다고 말하므로, 맨 위 글도 「몇까지인데」를 세지 않는다(0.5.2 공개 검수 A4)
  const capInfo = countableCapacity(pc, subscriptions, settings.manualCap);
  const cap = capInfo && capInfo.counted && !officeResting(capInfo) ? capInfo.cap : null;
  const head = officeTaskHeadline(officeHeadline(list, { cap }), list, snap.tasking);
  const view = ui.view || (settings.view === 'top' ? 'top' : 'tilted');
  const tasking = Array.isArray(snap.tasking?.tasks);
  const rows = departments.map(d => departmentRow(d, list.filter(v => v.departmentId === d.id), ui, tasking, snap.tasking?.tasks));
  const lobby = list.filter(v => v.departmentId == null);
  if (lobby.length) rows.push(lobbyRow(lobby, departments, ui, tasking));
  // 종류가 다른 줄 앞의 틈은 위에 부서 줄이 있을 때만 둔다(세션도 부서도 없으면 수용 인원이 첫 줄이다)
  const capRow = officeCapacityRow({ pc, subscriptions, manualCap: settings.manualCap ?? null, active: head.active, ui, now, tasking });
  rows.push({ ...capRow, gap: rows.length > 0 });
  rows.push(officeSettingsRow({ view, roots: snap.roots || {}, ui }));
  rows.push(officeAddRow({ ui }));
  const readAt = Number(snap.readAt);
  const foot = [Number.isFinite(readAt) ? (now - readAt < 2 * 60e3 ? '방금 읽었습니다.' : hm(readAt) + '에 읽었습니다.') : '', '이 방이 열려 있는 동안 15초마다 기록을 살핍니다.', ui.roomNote || ''].filter(Boolean).join(' ');
  return {
    visible: true, alert: list.some(v => v.alert), say: head.say, then: head.then, hint: head.hint, rows, foot,
    floor: officeFloorScene({ departments, list, cap, view, viewSeq: ui.viewSeq || 0 }),
    sessions: list.length,
  };
}

/* ── 이 방의 상태와 동작 ──
   api: window.synkDesktop.office({ snapshot, watch, saveDepartment, removeDepartment, assign, saveSettings, addRoot, removeRoot, seen, onChanged }).
   snapshot(): 지금 가진 사무실 판. reread(): 판을 다시 읽게 한다. changed(): 다시 그린다.
   한 번에 한 일만 보낸다(orb-rooms.mjs의 run과 같다). 계정이 바뀌면(reset) 늦게 온 답을 버린다 */
export function createOfficeRoom({ api = null, snapshot = () => null, reread = () => {}, changed = () => {} } = {}) {
  const tasks = createOfficeTaskRoom({ api, reread, changed });
  const biz = createBizplanRoom({ api, changed });
  const fresh = () => ({ grps: new Set(), asking: null, notes: new Map(), busy: null, addName: '', addSeq: 0, view: null, viewSeq: 0, roomNote: '' });
  let st = fresh(), gen = 0, seq = 0, focusReq = null, openReq = null;
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
  const foldRow = key => { for (const g of [...st.grps]) if (g.startsWith(key + ':')) st.grps.delete(g); if (key.startsWith('d:') && st.asking === key.slice(2)) st.asking = null; };

  async function handle(p = {}) {
    if (typeof p.act === 'string' && p.act.startsWith('task-')) { await tasks.handle(p); return true; }
    // 기능의 작업 화면: 부서 줄의 기능 줄을 누르면 열리고, 「← 사무실」로 닫는다
    if (p.act === 'feature-open' && String(p.key || '').startsWith('d:') && p.arg === 'bizplan') { biz.open(String(p.key).slice(2)); changed(); return true; }
    if (p.act === 'biz-close') { const back = biz.departmentId; biz.close(); if (back) openReq = ask({ key: 'd:' + back }); changed(); return true; }
    if (typeof p.act === 'string' && p.act.startsWith('biz-')) { await biz.handle(p); return true; }
    const key = String(p.key || ''), act = String(p.act || ''), arg = p.arg == null ? '' : String(p.arg), fields = p.fields && typeof p.fields === 'object' ? p.fields : {};
    if (act === 'disarm') return true;
    // 부서 줄을 열었다 닫으면 그 부서의 끝냄 느낌표를 지운다(4.1). 닫힌 부서는 다음에 열 때 기능이 접힌 채로 열린다(시안 sync)
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
        return after(key, res, `「${name}」 부서를 더했습니다.`, () => { st.addName = ''; st.addSeq += 1; focusReq = ask({ key, field: officeAddField(st) }); });
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
        return after(key, res, '', () => { st.asking = null; foldRow(key); st.roomNote = `「${d.name}」 부서를 뺐습니다.`; focusReq = ask({ say: true }); });
      }
      case 'assign': {
        const [sid, did] = arg.split('|');
        const d = deptOf(did);
        if (!sid || !d) { note(key, officeCodeSay('NOT_FOUND')); reread(); changed(); return true; }
        const res = await run(key, () => call('assign', sid, d.id));
        // 보낸 부서의 줄을 열어 둔다(시안 send → pin)
        return after(key, res, '', () => { note('d:' + d.id, `이 세션을 ${ro(d.name)} 보냈습니다.`); openReq = ask({ key: 'd:' + d.id }); });
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

  return {
    handle,
    /* 장면. 한 번만 따를 요청(열 줄, 초점)을 붙인다 */
    scene(snap, now, subs) {
      const room = officeRoom(snap, st, now, { subs });
      const tasking = tasks.scene(room.visible ? snap.tasking : null, snap?.departments);
      const deptId = biz.departmentId, depts = Array.isArray(snap?.departments) ? snap.departments : [];
      const dept = deptId && depts.find(d => d.id === deptId);
      // 작업 화면은 일 맡기기가 켜진 판에서 부서가 남아 있을 때만 선다. 부서를 빼면 사무실로 돌아간다
      if (deptId && (!room.visible || !dept || !Array.isArray(snap?.tasking?.tasks))) biz.close();
      const feature = biz.departmentId ? biz.scene(featureTask(snap.tasking.tasks, 'bizplan', deptId), { departments: depts, deptName: dept.name }) : null;
      return room.visible ? { ...room, ...(tasking ? {tasking} : {}), ...(feature ? { feature } : {}), focus: focusReq, opening: openReq } : room;
    },
    /* 방을 떠날 때: 열어 둔 묶음과 물음, 알림 줄을 지운다(보기 고른 것은 남긴다) */
    close() { st.grps.clear(); st.asking = null; st.notes.clear(); st.roomNote = ''; focusReq = null; openReq = null; biz.close(); },
    /* 계정이 바뀌면 다 비운다 */
    reset() { gen += 1; tasks.reset(); biz.reset(); st = fresh(); focusReq = null; openReq = null; },
    busy: () => st.busy,
  };
}
