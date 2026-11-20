// 솔리오 「사무실」 방(PC 클라이언트 첫 조각 「보기」, 2026-11-20)의 줄 자료와 그 방의 동작. DOM이 없다.
// 설계: docs/디자인/솔리오_사무실_20261119/구현설계.md 5~7절 · 11절, 시안 사무실.html과 README 「담은 것」 1~17. 직원의 상태와 문장, 수용 인원 셈은 office-model.mjs가 정한다.
// 줄 하나의 꼴과 안쪽 [종류, …]는 solio-rooms.mjs와 같다. 이 방에서 더한 안쪽 종류는 둘이다.
//   ['staff', 세션 번호, 도구, 모델, 상태 문장, 하는 일, 표시('alert' · 'now')] — 직원 줄. 그림에서 그 직원을 가리키면 줄이 밝아진다
//   ['item', 이름, 한 문장, 열림, 묶음 이름, 오른쪽] — 부서의 기능 줄(담은 것 16). 누르면 바로 아래 묶음(grp)이 열린다
// 줄의 flag가 참이면 이름 옆에 느낌표가 붙는다(7절). 부서 줄과 「부서 없는 일」은 watch 줄이라, 열었다 닫으면 seen을 부른다(4.1 끝냄).
import { officeSessions, officeHeadline, officeCapacity, officeSeats, countWord } from './office-model.mjs';
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

/* ── 「승인 물음도 보기」(12.3) ── 켜기는 두 번 확인한다. 안내문은 12.3의 글을 알림 여섯 가지에 맞춘 것이다.
   솔리오가 받아 쓰는 값(작업 폴더, 도구 이름, 파일 이름이나 명령의 첫 낱말)을 빠짐없이 적는다 */
export const OFFICE_HOOKS_NAME = '승인 물음도 보기';
export const OFFICE_HOOKS_ASK = 'Claude Code 설정 파일에 알림을 더할까요?';
export const OFFICE_HOOKS_NOTICE = 'Claude Code의 설정 파일(목록의 폴더마다 settings.json)에 알림 여섯 가지를 더합니다. 승인을 물은 때, 일이 끝난 때, 도구의 이름과 입력, 결과를 이 PC 안의 솔리오로 보냅니다. 솔리오는 그 가운데 작업 폴더, 도구 이름, 파일 이름이나 명령의 첫 낱말만 쓰고 나머지는 버립니다. 솔리오가 꺼져 있는 동안 다른 프로그램이 같은 포트를 열면 그 프로그램이 받을 수 있습니다. 끄면 솔리오가 더한 것만 지웁니다.';
export const OFFICE_HOOKS_NEW_FILE = '설정 파일이 없어 새로 만듭니다';
export const OFFICE_HOOKS_NO_FOLDER = '폴더가 없어 건너뜁니다';
/* 본체가 판에 싣는 알림 까닭(hooks.message) */
export const OFFICE_HOOKS_SAY = Object.freeze({
  port: '받는 자리가 바뀌어 알림을 껐습니다. 다시 켜려면 설정 파일을 고쳐야 합니다.',
  silent: '알림이 오지 않습니다. Claude Code 설정에서 이 주소가 막혀 있을 수 있습니다.',
});
/* 켜기 · 끄기가 거절된 까닭(office-hooks의 code) */
export const OFFICE_HOOKS_ON_SAY = Object.freeze({
  READ: '설정 파일을 읽지 못해 켜지 않았습니다.',
  BUSY: '설정 파일이 바뀌는 중이라 켜지 않았습니다.',
  WRITE: '설정 파일에 쓰지 못해 켜지 않았습니다.',
  NOT_HERE: '이 실행에서는 켤 수 없습니다.',
  NO_DIRS: '알림을 더할 설정 폴더가 없습니다.',
  PORT: '알림을 받을 자리를 열지 못해 켜지 않았습니다.',
});
export const OFFICE_HOOKS_OFF_SAY = Object.freeze({
  READ: '설정 파일을 읽지 못해 끄지 못했습니다.',
  BUSY: '설정 파일이 바뀌는 중이라 끄지 못했습니다.',
  WRITE: '설정 파일에 쓰지 못해 끄지 못했습니다.',
});
/* 보는 폴더 줄의 짧은 상태(훅이 켜져 있을 때) */
const HOOK_DIR_SAY = Object.freeze({ READ: '설정 파일을 읽지 못함', BUSY: '설정 파일이 바뀌는 중', WRITE: '설정 파일에 쓰지 못함' });
export const OFFICE_HOOKS_ON_DONE = '알림을 더했습니다. 새로 켜는 Claude Code 세션부터 승인 물음을 봅니다.';
export const OFFICE_HOOKS_OFF_DONE = '알림을 껐습니다. 솔리오가 더한 줄만 지웠습니다.';
/* 구 곁의 설정 방에 서는 줄(11.1). 볼 계정이 아니어도 훅이 켜져 있으면 보이고 끌 수 있다 */
export const OFFICE_HOOKS_LINE = 'Claude Code의 알림이 솔리오로 오고 있습니다';
const hookOnSay = code => OFFICE_HOOKS_ON_SAY[code] || OFFICE_CODE_SAY[code] || '알림을 더하지 못했습니다. 잠시 뒤 다시 해 주세요.';
const hookOffSay = code => OFFICE_HOOKS_OFF_SAY[code] || OFFICE_CODE_SAY[code] || '알림을 끄지 못했습니다. 잠시 뒤 다시 해 주세요.';
/** 켜기의 답을 한두 문장으로. 몇 폴더가 거절되면 그 수와 까닭을 붙인다 */
export function officeHooksOnWords(res) {
  if (!res || res.ok === false) return hookOnSay(res?.code);
  const n = Number(res.refused) || 0;
  return n > 0 && res.code ? `${OFFICE_HOOKS_ON_DONE} 폴더 ${josa(countWord(n), ['은', '는'])} ${hookOnSay(res.code)}` : OFFICE_HOOKS_ON_DONE;
}
export const officeHooksOffWords = res => (!res || res.ok === false ? hookOffSay(res?.code) : OFFICE_HOOKS_OFF_DONE);

const eul = w => josa(w, ['을', '를']), ga = w => josa(w, ['이', '가']), wa = w => josa(w, ['과', '와']);
/* 「로 · 으로」: 받침이 없거나 ㄹ이면 「로」다 */
const ro = w => { const c = String(w).charCodeAt(String(w).length - 1), j = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : 0; return w + (j === 0 || j === 8 ? '로' : '으로'); };
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
const rowLabel = parts => parts.filter(Boolean).join(', ');

/* ── 수용 인원 줄(6절, 시안 pcHTML) ── 첫 조각은 보이기만 한다. 구독을 둘 다 다 썼으면 숫자 대신 쉰다고 말한다(6절 11-20) */
export const OFFICE_REST_SAY = '구독을 다 써서 다시 찰 때까지 쉽니다';
export function officeCapacityRow({ pc = null, subscriptions = {}, manualCap = null, active = 0, ui = {}, now = Date.now() } = {}) {
  const note = ui.notes?.get?.('cap') || '';
  if (!pc || !Number.isFinite(Number(pc.cores)) || !Number.isFinite(Number(pc.totalMemGb))) {
    return { key: 'cap', gap: true, nm: '수용 인원', mid: '이 PC의 프로세서와 메모리를 아직 읽지 못했습니다', val: '', when: '', label: rowLabel(['수용 인원', '이 PC의 프로세서와 메모리를 아직 읽지 못했습니다']), more: [['note', '사무실을 열어 두면 곧 다시 읽습니다.'], ['live', note]] };
  }
  const c = officeCapacity({ cores: pc.cores, totalMemGb: pc.totalMemGb, subscriptions, manual: manualCap });
  const cores = Math.max(1, Math.floor(Number(pc.cores))), mem = Math.round(Math.max(0, Number(pc.totalMemGb)));
  const resting = c.missing.length === 0 && c.toolCaps.claude === 0 && c.toolCaps.codex === 0;
  const low = ['claude', 'codex'].filter(t => subscriptions[t] && subscriptions[t].leftPercent < 50).map(t => ` · ${t === 'codex' ? 'Codex' : 'Claude'} ${subscriptions[t].leftPercent}%`).join('');
  const mid = resting ? OFFICE_REST_SAY : `${cores}코어 · ${mem}GB${low}`;
  const val = resting ? '' : countWord(c.cap) + '까지';
  const per = n => (n >= 1 ? countWord(n) : '없음');
  const cpu = Number.isFinite(pc.cpuPercent) ? ` · 지금 ${Math.round(pc.cpuPercent)}% 쓰는 중` : '';
  const free = Number.isFinite(pc.freeMemGb) ? ` · 지금 ${Math.round(pc.freeMemGb * 10) / 10}GB 비어 있음` : '';
  const toolRow = tool => {
    const s = subscriptions[tool], name = TOOL_NAME[tool];
    if (!s) return ['row', name, '남은 양을 모릅니다', countWord(c.toolCaps[tool]) + '까지', ''];
    const again = s.resetsAt ? ` · ${whenWords(s.resetsAt, now, { withTime: true })}에 다시 찹니다` : '';
    return ['row', name, `${s.leftPercent}% 남음${again}`, c.toolCaps[tool] ? countWord(c.toolCaps[tool]) + '까지' : '쉬는 중', ''];
  };
  const manualOpen = c.source === 'manual' || ui.grps?.has?.('cap:manual');
  const more = [
    ['row', '프로세서', `논리 코어 ${cores}개${cpu}`, '둘마다 하나 · ' + per(Math.floor(cores / 2)), ''],
    ['row', '메모리', `${mem}GB${free}`, '4GB마다 하나 · ' + per(Math.floor(mem / 4)), ''],
    toolRow('claude'), toolRow('codex'),
    ['row', '합쳐서', resting ? OFFICE_REST_SAY + '.' : `PC와 구독 가운데 적은 쪽입니다. ${active ? '지금 ' + ga(countWord(active)) + ' 일하고 있습니다.' : '지금은 아무도 일하지 않습니다.'}`, resting ? '' : (c.source === 'manual' ? '직접 정함 · ' : '') + '동시에 ' + countWord(c.cap) + '까지', ''],
  ];
  if (c.note) more.push(['note', c.note]);
  more.push(['pick', '정하는 방법', [['자동', 'auto'], ['직접 정하기', 'manual']], manualOpen ? 'manual' : 'auto', '', 'cap-mode']);
  more.push(['grp', 'manual', [
    ['fld', '함께 일할 수', String(manualCap ?? c.cap), `1에서 ${cores}까지`, 'cap', 'number'],
    ['acts', [['저장', 'cap-save', '', flags('enter', ui.busy && 'off')]]],
  ], !manualOpen]);
  more.push(['note', '구독이 절반 넘게 남으면 PC 한도까지, 절반 아래면 그 절반, 20% 아래면 한 사람이 일합니다. 다 쓰면 다시 찰 때까지 쉽니다. 지금은 이 PC에서 도는 일을 세어 보이기만 합니다. 이 값은 계정과 PC마다 따로 기억합니다.']);
  more.push(['live', note]);
  return { key: 'cap', gap: true, nm: '수용 인원', mid, val, when: '', label: rowLabel(['수용 인원', mid, val]), more };
}

/* ── 설정 줄(11.4) ── 보기 두 가지, 「승인 물음도 보기」, 보는 폴더. 「승인 물음도 보기」는 이 실행에서 켤 수 있거나(hooks.available) 켜져 있을 때만 선다.
   hooks: 본체의 { on, available, dirs:[{ dir, on, folder, file, code }], message }. 켜기는 줄 안의 「켜기」가 안내문을 펼치고, 그 안의 「설정 파일에 더하기」가 고친다 */
const sameDir = (a, b) => String(a).replace(/[\\/]+$/, '').toLowerCase() === String(b).replace(/[\\/]+$/, '').toLowerCase();
const settingsFile = dir => String(dir).replace(/[\\/]+$/, '') + '\\settings.json';
function hooksItems(hooks, ui) {
  const on = hooks.on === true, dirs = Array.isArray(hooks.dirs) ? hooks.dirs.filter(d => d && typeof d.dir === 'string') : [];
  const asking = ui.hooksAsk === true, busy = !!ui.busy;
  // 더할 폴더: 꺼져 있으면 목록의 모든 폴더, 켜져 있으면 아직 잇지 않은 폴더
  const todo = dirs.filter(d => !d.on);
  const canAdd = hooks.available === true && todo.some(d => d.folder);
  const out = [on
    ? ['row', OFFICE_HOOKS_NAME, '켜져 있습니다', ['끄기', 'hooks-off', '', busy ? 'off' : ''], '']
    : ['row', OFFICE_HOOKS_NAME, '꺼져 있습니다', hooks.available === true ? ['켜기', 'hooks-ask', '', flags('toggle', asking && 'on', busy && 'off')] : '', '']];
  if (hooks.message && Object.hasOwn(OFFICE_HOOKS_SAY, hooks.message)) out.push(['note', OFFICE_HOOKS_SAY[hooks.message]]);
  if (on && canAdd) out.push(['acts', [[todo.filter(d => d.folder).length > 1 ? '나머지 폴더에도 더하기' : '이 폴더에도 더하기', 'hooks-ask', '', flags('toggle', asking && 'on', busy && 'off')]], '알림이 없는 폴더']);
  if (asking && canAdd) {
    const lines = [OFFICE_HOOKS_NOTICE, ...todo.map(d => (!d.folder ? `${d.dir} · ${OFFICE_HOOKS_NO_FOLDER}` : d.file ? settingsFile(d.dir) : `${settingsFile(d.dir)} · ${OFFICE_HOOKS_NEW_FILE}`))];
    out.push(['confirm', OFFICE_HOOKS_ASK, lines, [['설정 파일에 더하기', 'hooks-on', '', busy ? 'off' : ''], ['그만두기', 'hooks-keep', '']]]);
  }
  return out;
}
/* 보는 폴더 줄의 경로 뒤에 붙는 말: 훅이 켜져 있으면 그 폴더가 알림을 보내는지, 고치지 못했으면 그 까닭(오른쪽 칸에는 「빼기」가 설 수 있어 경로 칸에 잇는다) */
function hookDirWhen(hooks, dir) {
  if (!hooks || (hooks.on !== true && hooks.available !== true)) return '';
  const d = (Array.isArray(hooks.dirs) ? hooks.dirs : []).find(x => x && sameDir(x.dir, dir));
  if (!d) return '';
  if (d.code && HOOK_DIR_SAY[d.code]) return HOOK_DIR_SAY[d.code];
  return hooks.on === true ? (d.on ? '알림 받음' : '알림 없음') : '';
}
export function officeSettingsRow({ view = 'tilted', roots = {}, hooks = null, ui = {} } = {}) {
  const note = ui.notes?.get?.('cfg') || '';
  const claude = Array.isArray(roots.claude) ? roots.claude : [], codex = Array.isArray(roots.codex) ? roots.codex : [], added = Array.isArray(roots.added) ? roots.added : [];
  const mine = dir => added.some(a => String(a).toLowerCase() === String(dir).toLowerCase());
  const shown = view === 'top' ? '위에서' : '비스듬히';
  const count = claude.length + codex.length;
  const h = hooks && typeof hooks === 'object' && (hooks.available === true || hooks.on === true) ? hooks : null;
  const more = [
    ['pick', '보기', [['비스듬히', 'tilted'], ['위에서', 'top']], view === 'top' ? 'top' : 'tilted', '', 'view'],
    ['note', '같은 사무실을 보는 각도입니다. 고른 보기는 다음에 열 때도 그대로입니다.'],
    ...(h ? hooksItems(h, ui) : []),
    ...claude.map(dir => { const w = hookDirWhen(h, dir); return ['row', 'Claude Code', String(dir) + (w ? ' · ' + w : ''), mine(dir) ? ['빼기', 'root-remove', String(dir), ui.busy ? 'off' : ''] : '', '']; }),
    ...codex.map(dir => ['row', 'Codex', String(dir), '', '']),
    ['acts', [['폴더 더하기', 'root-add', '', ui.busy ? 'off' : '']], '보는 폴더'],
    ['note', 'Claude Code의 기본 설정 폴더와 Codex의 기록 폴더는 늘 봅니다. 다른 설정 폴더를 쓰면 더해 주세요.'],
    ['live', note],
  ];
  const mid = `보기 · ${shown}${h ? ' · 승인 물음 ' + (h.on === true ? '켜짐' : '꺼짐') : ''} · 보는 폴더 ${countWord(count)}`;
  return { key: 'cfg', nm: '설정', mid, val: '', when: '', label: rowLabel(['설정', mid]), more };
}

/* 구 곁의 설정 방(orb-rooms.mjs)에 서는 줄: 훅이 켜져 있을 때만. status: 본체의 { ok, on }. ui: { busy, note } */
export function officeHooksAsideRow(status, ui = {}) {
  if (!status || status.on !== true) return null;
  return { key: 'office-hooks', nm: 'Claude Code 알림', mid: OFFICE_HOOKS_LINE, val: '', when: '', label: rowLabel(['Claude Code 알림', OFFICE_HOOKS_LINE]), more: [
    ['note', '사무실의 「승인 물음도 보기」가 Claude Code 설정 파일에 더한 알림입니다. 끄면 솔리오가 더한 줄만 지웁니다.'],
    ['acts', [['끄기', 'office-hooks-off', '', ui.busy ? 'off' : '']]],
    ['live', ui.note || ''],
  ] };
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

/* 부서 하나의 줄. 안쪽은 직원 줄, 그다음 기능 줄(첫 조각은 「부서 설정」 하나)이다 */
function departmentRow(d, staff, ui) {
  const key = 'd:' + d.id, lead = officeLead(staff), alert = staff.some(v => v.alert);
  const mid = lead ? lead.activity || lead.say : folderTail(d.folder);
  const val = officeGroupStatus(staff);
  const more = staff.length ? staff.map(staffItem) : [['note', '이 폴더에서 Claude Code나 Codex를 켜면 여기에 섭니다.']];
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
function lobbyRow(staff, departments, ui) {
  const lead = officeLead(staff), alert = staff.some(v => v.alert);
  const mid = lead.activity || lead.say, val = officeGroupStatus(staff);
  const more = [];
  for (const v of staff) {
    more.push(staffItem(v));
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
  const staffOf = v => ({ id: v.id, status: v.status, alert: !!v.alert, subagents: v.subagents || 0, zone: v.departmentId == null ? 'lobby' : 'd:' + v.departmentId });
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
   snap: 본체의 사무실 판 { ok, available, state, departments, assignments, settings, roots, pc, hooks, readAt }
   ui: 이 방의 화면 상태(createOfficeRoom의 st). subs: 구독 방이 가진 스냅숏 */
export function officeRoom(snap, ui = {}, now = Date.now(), { subs = null } = {}) {
  if (!snap || typeof snap !== 'object' || snap.ok === false || snap.available !== true) return { visible: false };
  const departments = (Array.isArray(snap.departments) ? snap.departments : []).filter(d => d && typeof d.id === 'string');
  const assignments = snap.assignments && typeof snap.assignments === 'object' ? snap.assignments : {};
  const list = officeSessions(snap.state, now, { departments, assignments });
  const subscriptions = officeSubscriptions(subs, now);
  const settings = snap.settings && typeof snap.settings === 'object' ? snap.settings : {};
  const pc = snap.pc && typeof snap.pc === 'object' ? snap.pc : null;
  const cap = pc && Number.isFinite(Number(pc.cores)) ? officeCapacity({ cores: pc.cores, totalMemGb: pc.totalMemGb, subscriptions, manual: settings.manualCap }).cap : null;
  const hooks = snap.hooks && typeof snap.hooks === 'object' ? snap.hooks : {};
  const head = officeHeadline(list, { cap, hooksOn: hooks.available ? hooks.on : undefined });
  const view = ui.view || (settings.view === 'top' ? 'top' : 'tilted');
  const rows = departments.map(d => departmentRow(d, list.filter(v => v.departmentId === d.id), ui));
  const lobby = list.filter(v => v.departmentId == null);
  if (lobby.length) rows.push(lobbyRow(lobby, departments, ui));
  // 종류가 다른 줄 앞의 틈은 위에 부서 줄이 있을 때만 둔다(세션도 부서도 없으면 수용 인원이 첫 줄이다)
  const capRow = officeCapacityRow({ pc, subscriptions, manualCap: settings.manualCap ?? null, active: head.active, ui, now });
  rows.push({ ...capRow, gap: rows.length > 0 });
  rows.push(officeSettingsRow({ view, roots: snap.roots || {}, hooks, ui }));
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
   api: window.synkDesktop.office({ snapshot, watch, saveDepartment, removeDepartment, assign, saveSettings, addRoot, removeRoot, seen, hooksSet, hooksOff, onChanged }).
   snapshot(): 지금 가진 사무실 판. reread(): 판을 다시 읽게 한다. changed(): 다시 그린다.
   한 번에 한 일만 보낸다(orb-rooms.mjs의 run과 같다). 계정이 바뀌면(reset) 늦게 온 답을 버린다 */
export function createOfficeRoom({ api = null, snapshot = () => null, reread = () => {}, changed = () => {} } = {}) {
  // hooksAsk: 「승인 물음도 보기」의 안내문을 펼친 첫 누름(두 번 확인의 첫째). 설정 줄이 접히거나 방을 떠나면 거둔다
  const fresh = () => ({ grps: new Set(), asking: null, hooksAsk: false, notes: new Map(), busy: null, addName: '', addSeq: 0, view: null, viewSeq: 0, roomNote: '' });
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
    const key = String(p.key || ''), act = String(p.act || ''), arg = p.arg == null ? '' : String(p.arg), fields = p.fields && typeof p.fields === 'object' ? p.fields : {};
    if (act === 'disarm') return true;
    // 부서 줄을 열었다 닫으면 그 부서의 끝냄 느낌표를 지운다(4.1). 닫힌 부서는 다음에 열 때 기능이 접힌 채로 열린다(시안 sync)
    if (act === 'row-open') return true;
    if (act === 'row-fold') {
      if (key === 'cfg' && st.hooksAsk) { st.hooksAsk = false; changed(); }
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
        return after(key, res, `「${name}」 부서를 만들었습니다. 이 세션은 그 부서로 갑니다.`, () => { st.grps.delete(key + ':mk-' + arg); });
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
        return after(key, res, '', () => { note('d:' + d.id, `이 세션을 ${ro(d.name)} 보냈습니다. 세션이 끝나면 이 기억도 지웁니다.`); openReq = ask({ key: 'd:' + d.id }); });
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
      // 「승인 물음도 보기」(12.3): 「켜기」가 안내문을 펼치고, 그 안의 「설정 파일에 더하기」를 눌러야 설정 파일을 고친다. 끄기는 묻지 않는다
      case 'hooks-ask':
        st.hooksAsk = !st.hooksAsk;
        focusReq = st.hooksAsk ? ask({ key, ask: true }) : ask({ key, act, arg });
        changed(); return true;
      case 'hooks-keep': st.hooksAsk = false; focusReq = ask({ key, act: 'hooks-ask', arg: '' }); changed(); return true;
      case 'hooks-on': {
        if (!st.hooksAsk) { changed(); return true; }
        const res = await run(key, () => call('hooksSet', true));
        if (res === null) return true;
        st.hooksAsk = false;
        note(key, officeHooksOnWords(res));
        focusReq = ask({ key, act: res.ok === false ? 'hooks-ask' : 'hooks-off', arg: '' });
        reread(); changed(); return true;
      }
      case 'hooks-off': {
        st.hooksAsk = false;
        const res = await run(key, () => call('hooksOff'));
        if (res === null) return true;
        note(key, officeHooksOffWords(res));
        focusReq = ask({ key, act: res.ok === false ? 'hooks-off' : 'hooks-ask', arg: '' });
        reread(); changed(); return true;
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
      return room.visible ? { ...room, focus: focusReq, opening: openReq } : room;
    },
    /* 방을 떠날 때: 열어 둔 묶음과 물음, 알림 줄을 지운다(보기 고른 것은 남긴다) */
    close() { st.grps.clear(); st.asking = null; st.hooksAsk = false; st.notes.clear(); st.roomNote = ''; focusReq = null; openReq = null; },
    /* 계정이 바뀌면 다 비운다 */
    reset() { gen += 1; st = fresh(); focusReq = null; openReq = null; },
    busy: () => st.busy,
  };
}
