// 솔리오 「사무실」(PC 클라이언트 첫 조각 「보기」, 2026-11-20)의 직원 상태 · 맨 위 문장 · 부서 · 수용 인원을 정한다. DOM이 없다.
// 규칙의 원문은 docs/디자인/솔리오_사무실_20261119/구현설계.md 3.4 · 4~7절과 같은 폴더 README의 「이 PC의 수용 인원」이다.
// 훅 소식과 기록 살피기를 officeReduce로 접고, officeSessions와 officeHeadline이 화면의 말을 만든다. 때는 모두 ms이고 시계를 읽지 않는다.
import { josa } from './solio-today.mjs';

const SEC = 1e3, MIN = 60e3, HOUR = 3600e3;
/* 경계 시간(설계의 표 그대로). 본체의 기록 살피기도 drop을 쓴다 */
export const OFFICE_TIMES = Object.freeze({
  recordWork: 90 * SEC, // 기록이 이보다 짧게 그대로면 일하는 중(4.1, 4.2)
  recordBusy: 12 * MIN, // 기록 끝이 차례 중(도구 결과를 기다림 · 답을 쓰는 중)이면 기록이 이만큼 그대로일 때까지 일하는 중(4.5)
  silent: 12 * MIN, // 일하는 중인데 훅과 기록이 둘 다 이만큼 조용하면 「소식이 없습니다」(4.1)
  longTurn: 2 * MIN, // 이보다 오래 걸린 차례만 끝냄 느낌표를 붙인다(D12)
  stopGrace: 10 * SEC, // Stop 뒤 이 안의 기록 바뀜은 그 차례의 마무리다(4.1)
  drop: 30 * MIN, // 훅과 기록이 둘 다 이만큼 조용하면 내린다(3.4의 3, 4.2)
  askKeep: 12 * HOUR, // 승인을 물은 채인 세션은 이만큼까지 둔다(3.4의 3)
});
const T = OFFICE_TIMES;
const TOOLS = ['claude', 'codex'];
const HOOK_EVENTS = new Set(['SessionStart', 'PostToolUse', 'Notification', 'Stop', 'SubagentStart', 'SubagentStop', 'SessionEnd']);
const UNKNOWN_NOTE = '승인 요청은 여기에 뜨지 않습니다';
const RECORD_TURNS = new Set(['ended', 'waiting', 'working']);
const timeOrNull = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const later = (a, b) => (a == null ? b : Math.max(a, b));
const ga = w => josa(w, ['이', '가']), neun = w => josa(w, ['은', '는']);

/* 사람 수를 우리말로: 1 하나, 8 여덟, 10 열, 12 열둘, 20 스물. 100부터는 「100명」 */
const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
export function countWord(n) {
  const k = Math.floor(Number(n));
  return k >= 1 && k <= 99 ? TENS[Math.floor(k / 10)] + ONES[k % 10] : k + '명';
}

/* ── 경로 ── Windows 경로를 견주기 좋게: 빗금 방향을 \로, 겹친 빗금을 하나로, 끝 빗금을 떼고, 작은 글자로 */
function normPath(p) {
  const s = String(p ?? '').trim();
  if (!s) return '';
  const unc = /^[\\/]{2}/.test(s);
  return ((unc ? '\\' : '') + s.replace(/[\\/]+/g, '\\').replace(/\\+$/, '')).toLowerCase();
}
/* 작업 폴더의 이름. Claude Code가 만든 작업 사본(워크트리) 폴더는 무작위 이름이라(「peaceful-rhodes-e8e7dc」) 처음 보는 사람이 무엇인지 모른다.
   그 폴더는 저장소 이름으로 쓴다: 「저장소\.claude\worktrees\이름」과 「…worktrees\저장소\이름」(11-23 맹검이 닫힌 줄의 폴더 이름을 짚음) */
const WORKTREE_NAME = /^[a-z]+-[a-z]+-[0-9a-f]{6}$/;
export function officeFolderName(cwd) {
  const parts = String(cwd ?? '').trim().replace(/[\\/]+$/, '').split(/[\\/]/);
  const last = parts.at(-1) || '', up = parts.length - 2;
  if (WORKTREE_NAME.test(last) && up >= 1) {
    if (/^worktrees$/i.test(parts[up]) && /^\.claude$/i.test(parts[up - 1] || '') && parts[up - 2]) return parts[up - 2];
    if (/worktrees$/i.test(parts[up - 1] || '') && parts[up]) return parts[up];
  }
  return last;
}
const folderName = officeFolderName;

/* 앱이 남은 양을 읽으려고 스스로 돌리는 Claude Code는 직원이 아니다. userData가 셋이라 끝이 AiSubscriptions\run인 꼴로 거른다(4.4) */
export function officeIgnoredCwd(cwd) {
  const p = normPath(cwd);
  return p === 'aisubscriptions\\run' || p.endsWith('\\aisubscriptions\\run');
}

/* 부서를 정하지 않고 솔리오에 맡긴 일의 작업 폴더. 본체가 userData\OfficeWork\<회원 번호>에 만든다(office-task-runtime.cjs taskDirectory).
   손님의 폴더 이름과 섞이지 않게 경로의 끝이 그 꼴일 때만이다(Fable solio-office-words F3) */
export function officeOwnWorkCwd(cwd) { return /(?:^|\\)officework\\[a-z0-9_-]{8,80}$/.test(normPath(cwd)); }

/* ── 부서(5절) ── 손님이 보낸 부서가 먼저고, 그다음은 작업 폴더가 부서 폴더이거나 그 아래인 부서 가운데 가장 깊은 것이다.
   폴더는 마디 경계에서만 맞는다(C:\work\shop2는 C:\work\shop 아래가 아니다). 어디에도 안 걸리면 null(「부서 없는 일」) */
export function officeDepartmentOf({ sessionId = null, cwd = null } = {}, departments = [], assignments = {}) {
  const list = Array.isArray(departments) ? departments.filter(d => d && d.id != null) : [];
  if (sessionId != null && own(assignments, sessionId)) {
    const sent = assignments[sessionId];
    if (list.some(d => d.id === sent)) return sent; // 지운 부서로 보낸 기억은 폴더로 다시 고른다
  }
  const here = normPath(cwd);
  if (!here) return null;
  let best = null, depth = -1;
  for (const d of list) {
    const f = normPath(d.folder);
    if (f && (here === f || here.startsWith(f + '\\')) && f.length > depth) { best = d.id; depth = f.length; }
  }
  return best;
}

/* ── 세션 모음 ── 세션 번호 하나가 직원 하나다. 훅의 session_id와 기록 파일의 번호가 같으면 같은 직원이다(4.4) */
export const officeState = () => ({ sessions: {}, ignored: {} });

const fresh = (id, tool) => ({
  id, tool, cwd: null, model: null, modelAt: null, hooked: false,
  firstAt: null, hookedAt: null, lastHookAt: null, lastRecordAt: null,
  recordTurn: null, recordTurnAt: null, recordHelperAt: null, // 마지막으로 닿은 기록 살피기가 읽은 끝 줄의 갈래 · 그 줄의 때 · 도우미 기록의 고친 때(4.5)
  postAt: null, // 마지막 PostToolUse(도우미 것까지)
  askAt: null, clearAt: null, // 승인 물음과 그것을 푸는 소식(도우미 것이 아닌 PostToolUse, Stop)의 마지막 때. 끝(SessionEnd)은 그 앞의 물음을 지운다
  idleAt: null, stopAt: null, turnStartAt: null, seenAt: null,
  stopFrom: null, doneLong: false, // 마지막 Stop이 끝낸 차례의 첫 소식(모르면 null)과, 그 차례가 2분을 넘었는지
  endedAt: null, // 지금 꺼져 있으면 그 끝의 때. 끝 뒤의 소식이 있으면 null
  lastEndAt: null, // 받은 끝 가운데 가장 늦은 때. 늦게 닿아 세션을 내리지 않은 끝도 센다. 이 때와 그보다 이른 소식은 받지 않는다
  agents: {}, // 번호 있는 도우미: 시작한 때(숫자) 또는 false(끝남)
  anonAgents: 0, lastTool: null, lastToolAt: null,
});
const lastNews = s => Math.max(s.lastHookAt ?? -Infinity, s.lastRecordAt ?? -Infinity);
/* 승인을 물은 표시. 같은 때에 온 것끼리는 가를 수 없으므로 남긴다(4.1 「가를 수 없으면 남긴다」) */
const isAsked = s => s.askAt != null && (s.clearAt == null || s.askAt >= s.clearAt);
const keepFor = s => (isAsked(s) ? T.askKeep : T.drop);
const afterStop = (s, at, grace) => s.stopAt == null || at > s.stopAt + grace;
/* 그 차례의 첫 소식. SessionStart와 idle_prompt는 입력을 기다리는 때라 세지 않는다. idle_prompt보다 앞선 소식은 앞 대기의 것이다(GPT 검수 GA11) */
const turnNews = (s, at) => {
  if (s.idleAt != null && at <= s.idleAt) return;
  if (s.turnStartAt == null || at < s.turnStartAt) s.turnStartAt = at;
};
const running = s => Object.values(s.agents).filter(v => typeof v === 'number');
const subagentCount = s => running(s).length + s.anonAgents;
const earliest = list => list.reduce((m, v) => (v != null && (m == null || v < m) ? v : m), null);
/* 남은 칸에 있는 차례 소식(도구, 승인 물음, 도우미 시작, 훅을 받은 뒤의 기록) 가운데 lo보다 늦고 hi보다 이른 가장 이른 때.
   기록은 lo 뒤 10초 안의 바뀜을 세지 않는다 */
function earliestTurnNews(s, lo, hi = Infinity) {
  const r = s.lastRecordAt;
  const record = s.hooked && r != null && r >= s.hookedAt && r > lo + T.stopGrace ? r : null;
  return earliest([s.postAt, s.askAt, ...running(s)].filter(v => v != null && v > lo).concat(record).filter(v => v == null || v < hi));
}

/* t와 그보다 이른 때에 생긴 칸을 모두 지운다. 기록은 t 뒤 10초 안의 바뀜(끝의 마무리)까지 지운다.
   끝(SessionEnd)과 오래 조용한 세션이 다시 설 때가 이 함수 하나를 지난다. 시각 순서로 접어 끝 뒤에 다시 선 세션과
   끝이 늦게 닿은 세션이 같은 칸을 갖게 하려는 것이다(GPT 검수 be GA10 · be3 GA11, 설계 검토 2026-11-21 (마)).
   · 「마지막」 칸(lastHookAt, postAt, askAt, clearAt, idleAt, stopAt, modelAt, lastToolAt)은 t보다 늦게 남은 값이 곧 끝 뒤의 값이다.
   · 번호 있는 도우미는 t 이전에 시작한 것을 지운다. 끝남(false)은 남겨 늦게 닿은 시작을 다시 세지 않는다.
     번호 없는 도우미는 시작 때를 둘 수 없으므로 0으로 둔다(끝 뒤에 시작한 것이 먼저 닿았으면 덜 센다).
   · 「처음」 칸(firstAt, hookedAt, turnStartAt)은 남은 칸 가운데 가장 이른 때로 다시 잡는다. 덮어쓴 때는 알 수 없으므로
     실제보다 늦을 수 있다. 차례는 짧게 세어 느낌표를 덜 붙이는 쪽이다. 끝 앞에서부터 센 차례(stopFrom)는 느낌표를 뗀다.
   · 작업 폴더와 도구 이름은 같은 세션 번호면 같으므로 남긴다 */
function dropUpTo(s, t) {
  const tr = t + T.stopGrace;
  const gone = v => v != null && v <= t;
  for (const k of ['lastHookAt', 'postAt', 'askAt', 'clearAt', 'idleAt']) if (gone(s[k])) s[k] = null;
  if (s.lastRecordAt != null && s.lastRecordAt <= tr) s.lastRecordAt = null;
  if (gone(s.modelAt)) { s.model = null; s.modelAt = null; }
  if (gone(s.lastToolAt)) { s.lastTool = null; s.lastToolAt = null; }
  if (gone(s.stopAt)) { s.stopAt = null; s.stopFrom = null; s.doneLong = false; }
  if (s.stopAt == null || gone(s.seenAt)) s.seenAt = null;
  s.agents = Object.fromEntries(Object.entries(s.agents).filter(([, v]) => !(typeof v === 'number' && v <= t)));
  s.anonAgents = 0;
  s.hooked = s.lastHookAt != null;
  const hookTimes = [s.lastHookAt, s.postAt, s.askAt, s.clearAt, s.idleAt, s.stopAt, s.modelAt, s.lastToolAt, ...running(s)];
  if (!s.hooked) s.hookedAt = null; else if (gone(s.hookedAt)) s.hookedAt = earliest(hookTimes);
  if (s.firstAt != null && s.firstAt <= tr) s.firstAt = earliest(hookTimes.concat(s.lastRecordAt));
  // 늦게 닿은 Stop이 끝 뒤 차례의 첫 소식을 지웠을 수 있어 남은 칸과 견준다. 남은 칸은 모두 끝 뒤 차례의 소식이라 실제보다 이르지 않다.
  // 지금 차례의 시작이 기록에서 왔으면 끝 뒤의 첫 훅보다 이르지 않아야 차례 소식이다(훅을 받기 전의 기록은 모른다)
  const kept = s.hooked && s.turnStartAt != null && s.turnStartAt > tr && s.turnStartAt >= s.hookedAt ? s.turnStartAt : null;
  s.turnStartAt = earliest([kept, earliestTurnNews(s, Math.max(t, s.stopAt ?? -Infinity, s.idleAt ?? -Infinity))]);
  // 끝 앞에서 시작한 것으로 센 차례는 끝 뒤의 첫 소식을 모른다. 느낌표를 뗀다
  if (s.stopFrom != null && s.stopFrom <= tr) { s.stopFrom = null; s.doneLong = false; }
}

/* 소식 하나를 접는다. 들어오는 것:
   { kind:'hook', event, sessionId, cwd, at, toolName?, toolDetail?, notificationType?, agentId?, model? }
   { kind:'record', sessionId, cwd, tool:'claude'|'codex', changedAt, turn?, turnAt?, helperAt?, seenAt? } — changedAt은 도우미 기록까지 본 가장 늦은 고친 때,
     turn은 본 기록 끝 줄의 갈래('ended' · 'waiting' · 'working', 모르면 null), turnAt은 그 줄의 때, helperAt은 도우미 기록의 고친 때, seenAt은 살핀 때(4.5)
   { kind:'seen', departmentId, at } — 그 부서의 줄을 열었다 닫음. departmentId null은 「부서 없는 일」. ctx의 부서로 직원을 고른다
   { kind:'reset' } — 계정이 바뀌면 다 비운다
   늦게 닿은 소식도 있으므로 순서가 아니라 때(at)로 견준다. 주어진 상태는 고치지 않고 새 상태를 돌려준다.
   SessionEnd는 늦게 닿아도 dropUpTo로 그 때까지의 칸을 지우고 lastEndAt을 늘린다. 본체는 lastEndAt이 늘어난 세션의 「보낼 부서」 기억을 지운다 */
export function officeReduce(state, event, ctx = {}) {
  const base = state && state.sessions && state.ignored ? state : officeState();
  if (!event || typeof event !== 'object') return base;
  if (event.kind === 'reset') return officeState();
  if (event.kind === 'seen') return applySeen(base, event, ctx);
  const isRecord = event.kind === 'record';
  if (!isRecord && !(event.kind === 'hook' && HOOK_EVENTS.has(event.event))) return base;
  const id = typeof event.sessionId === 'string' ? event.sessionId : '';
  const at = Number(isRecord ? event.changedAt : event.at);
  if (!id || !Number.isFinite(at)) return base;
  if (officeIgnoredCwd(event.cwd) || own(base.ignored, id)) {
    const { [id]: _gone, ...sessions } = base.sessions;
    return { sessions, ignored: { ...base.ignored, [id]: later(base.ignored[id], at) } };
  }
  let s = own(base.sessions, id) ? base.sessions[id] : null;
  // 가장 늦은 끝과 그보다 이른 소식은 그 끝이 이미 지웠다. 끝 뒤 10초 안의 기록 바뀜은 그 끝의 마무리다. 세션이 다시 선 뒤에 닿아도 같다
  if (s && s.lastEndAt != null && at <= s.lastEndAt + (isRecord ? T.stopGrace : 0)) return base;
  s = s ? { ...s, agents: { ...s.agents } } : fresh(id, isRecord && event.tool === 'codex' ? 'codex' : 'claude');
  if (s.endedAt != null) s.endedAt = null; // 꺼진 세션에 끝 뒤의 소식이 오면 다시 선다. 끝까지의 칸은 끝이 이미 지웠다(3.4의 3)
  else if (Number.isFinite(lastNews(s)) && at - lastNews(s) >= keepFor(s)) dropUpTo(s, lastNews(s)); // 내린 세션도 같은 함수로 비우고 다시 선다
  s.firstAt = s.firstAt == null ? at : Math.min(s.firstAt, at);
  const cwd = typeof event.cwd === 'string' && event.cwd.trim() ? event.cwd : null;
  // 작업 폴더는 훅의 값이 먼저다. 기록의 값은 형식이 약속된 것이 아니다(3.1)
  if (cwd && (!isRecord || !s.hooked || !s.cwd)) s.cwd = cwd;
  if (isRecord) {
    if (event.tool === 'codex' || event.tool === 'claude') s.tool = event.tool;
    // 끝 줄의 갈래는 마지막으로 닿은 살피기의 것을 쓴다(4.5). 본체는 기록을 한 번에 하나씩 살피고 그 차례대로 접는다(office.cjs).
    // 그래서 고친 때나 살핀 때로 견주지 않는다. 도우미 파일이 지워져 고친 때가 앞으로 돌아가도, 시계를 뒤로 돌려도 새 살피기가 이긴다
    // (GPT 검수 solio-office-turn GA3, -r2 GA2)
    s.recordTurn = RECORD_TURNS.has(event.turn) ? event.turn : null;
    s.recordTurnAt = timeOrNull(event.turnAt);
    s.recordHelperAt = timeOrNull(event.helperAt);
    s.lastRecordAt = later(s.lastRecordAt, at);
    // 훅을 받기 전의 기록은 모른다(4.1 「훅을 중간에 켠 세션」). Stop 뒤 10초 안의 바뀜은 새 차례가 아니다
    if (s.hooked && at >= s.hookedAt && afterStop(s, at, T.stopGrace)) turnNews(s, at);
    return { ...base, sessions: { ...base.sessions, [id]: s } };
  }
  s.hooked = true;
  s.hookedAt = s.hookedAt == null ? at : Math.min(s.hookedAt, at);
  s.lastHookAt = later(s.lastHookAt, at);
  const agentId = event.agentId != null && event.agentId !== '' ? String(event.agentId) : '';
  switch (event.event) {
    case 'SessionStart':
      if (event.model && (s.modelAt == null || at >= s.modelAt)) { s.model = String(event.model); s.modelAt = at; }
      break;
    case 'PostToolUse':
      s.postAt = later(s.postAt, at);
      if (!agentId) s.clearAt = later(s.clearAt, at); // 도우미의 도구로는 승인 물음 표시를 풀지 않는다
      if (event.toolName && (s.lastToolAt == null || at >= s.lastToolAt)) {
        s.lastTool = { name: String(event.toolName), detail: event.toolDetail ? String(event.toolDetail).trim() : '' };
        s.lastToolAt = at;
      }
      if (afterStop(s, at, 0)) turnNews(s, at);
      break;
    case 'Notification':
      if (event.notificationType === 'permission_prompt') {
        s.askAt = later(s.askAt, at);
        if (afterStop(s, at, 0)) turnNews(s, at);
      } else if (event.notificationType === 'idle_prompt') {
        s.idleAt = later(s.idleAt, at);
        // 입력을 기다린다는 소식 앞의 소식은 새 차례의 첫 소식이 아니다. 늦게 닿았으면 새 차례의 첫 소식을 모르는 채로 둔다(느낌표를 붙이지 않는 쪽)
        if (s.turnStartAt != null && s.turnStartAt <= s.idleAt) s.turnStartAt = null;
      }
      break;
    case 'Stop':
      s.clearAt = later(s.clearAt, at);
      if (s.stopAt == null || at > s.stopAt) {
        // 그 차례의 첫 소식부터 Stop까지가 2분을 넘을 때만 느낌표. 첫 소식을 모르면 붙이지 않는다
        s.stopFrom = s.turnStartAt != null && s.turnStartAt < at ? s.turnStartAt : null;
        s.doneLong = s.stopFrom != null && at - s.stopFrom > T.longTurn;
        s.stopAt = at;
        s.turnStartAt = null;
      }
      break;
    case 'SubagentStart':
      // 시작한 때를 둔다. 같은 도우미의 시작이 둘 닿으면 이른 쪽이다
      if (agentId) { const was = s.agents[agentId]; if (!own(s.agents, agentId) || (typeof was === 'number' && at < was)) s.agents[agentId] = at; } else s.anonAgents += 1;
      if (afterStop(s, at, 0)) turnNews(s, at);
      break;
    case 'SubagentStop':
      // 끝남이 시작보다 먼저 닿아도 그 도우미는 다시 세지 않는다. 번호가 없으면 0 밑으로 내려가지 않는다
      if (agentId) s.agents[agentId] = false; else s.anonAgents = Math.max(0, s.anonAgents - 1);
      break;
    case 'SessionEnd':
      // 이 끝과 그보다 이른 칸을 모두 지운다. 이 끝보다 늦은 소식이 남았으면 그 세션은 끝난 뒤 다시 섰으므로 내리지 않는다.
      // 시각 순서로 접었을 때와 끝이 늦게 닿았을 때가 같은 칸을 갖는다(GPT 검수 be GA10 · be3 GA11)
      s.lastEndAt = later(s.lastEndAt, at);
      dropUpTo(s, at);
      s.endedAt = Number.isFinite(lastNews(s)) ? null : at;
      break;
  }
  return { ...base, sessions: { ...base.sessions, [id]: s } };
}

/* 끝냄을 본 것으로: 그 부서에 지금 선 직원 가운데 그때까지 끝낸 차례만. 그 뒤에 끝낸 차례는 다시 끝냄이다 */
function applySeen(base, { departmentId = null, at } = {}, { departments = [], assignments = {} } = {}) {
  const t = Number(at);
  if (!Number.isFinite(t)) return base;
  let sessions = null;
  for (const [id, s] of Object.entries(base.sessions)) {
    if (s.stopAt == null || s.stopAt > t || (s.seenAt != null && s.seenAt >= s.stopAt)) continue;
    if (officeDepartmentOf({ sessionId: id, cwd: s.cwd }, departments, assignments) !== (departmentId ?? null)) continue;
    sessions = { ...(sessions || base.sessions), [id]: { ...s, seenAt: t } };
  }
  return sessions ? { ...base, sessions } : base;
}

/* 내린 세션과 오래된 거르기 기억을 지운다. 꺼진 세션은 기록 살피기가 옛 고친 때로 되살리지 않게 30분 더 둔다 */
export function officePrune(state, now) {
  const base = state && state.sessions && state.ignored ? state : officeState();
  return {
    sessions: Object.fromEntries(Object.entries(base.sessions).filter(([, s]) => now - Math.max(lastNews(s), s.endedAt ?? -Infinity) < keepFor(s))),
    ignored: Object.fromEntries(Object.entries(base.ignored).filter(([, at]) => now - at < T.askKeep)),
  };
}

/* ── 화면의 말(4.1, 4.2) ── */
const minutes = ms => Math.max(1, Math.floor(ms / MIN));
const askWords = ms => (ms < MIN ? '방금' : ms < HOUR ? Math.floor(ms / MIN) + '분 전에' : Math.floor(ms / HOUR) + '시간 전에') + ' 승인을 물었습니다';
const view = (status, say, alert = false) => ({ status, say, alert });

function statusOf(s, now) {
  if (s.endedAt != null) return null;
  const quiet = now - lastNews(s);
  if (!s.hooked) {
    // 훅 소식이 없는 세션은 기록만 안다. 승인 · 끝냄을 말하지 않고 느낌표도 없다
    const age = now - s.lastRecordAt;
    if (!(age < T.drop)) return null;
    const turn = s.recordTurn;
    if (turn) {
      // 갈래를 아는 세션은 파일의 고친 때가 아니라 끝 줄의 때로 잰다(4.5). 차례와 상관없는 줄(대기열 · 제목 · 비용)이 오래된 기록을 고쳐도
      // 끊긴 차례가 일하는 중이 되거나 며칠 전에 끝난 차례가 서지 않는다(설계 검토 solio-office-turn-20261123 고칠 것 1).
      // 끝 줄의 때가 없거나 고친 때보다 늦게 적혀 있으면 고친 때로 잰다
      const turnFrom = s.recordTurnAt != null && s.recordTurnAt <= s.lastRecordAt ? s.recordTurnAt : s.lastRecordAt;
      if (turn === 'ended' || turn === 'waiting') {
        // 차례가 끝났거나 손님의 답을 기다린다. 끝 줄보다 늦게 도우미 기록이 바뀌었고 그것이 90초 안이면 도우미가 일하는 중이다.
        // 끝 줄 앞에 적은 도우미는 그 결과를 본 차례가 이미 끝냈다(GPT 검수 solio-office-turn GA2)
        if (s.recordHelperAt != null && s.recordHelperAt > turnFrom && now - s.recordHelperAt < T.recordWork) return view('working', '일하는 중');
        if (!(now - turnFrom < T.drop)) return null;
        return view('quiet', minutes(now - turnFrom) + '분째 조용합니다');
      }
      // 차례 중이면 긴 명령이 도는 동안에도 일하는 중이다. 도우미가 적으면 그때부터 다시 잰다.
      // 12분 넘게 아무것도 적히지 않았으면 멈췄거나 승인을 기다릴 수 있어 조용하다고 한다
      const busyFrom = Math.max(turnFrom, s.recordHelperAt ?? -Infinity);
      if (!(now - busyFrom < T.drop)) return null;
      return now - busyFrom < T.recordBusy ? view('working', '일하는 중') : view('quiet', minutes(now - busyFrom) + '분째 조용합니다');
    }
    return age < T.recordWork ? view('working', '일하는 중') : view('quiet', minutes(age) + '분째 조용합니다');
  }
  if (!(quiet < keepFor(s))) return null;
  if (isAsked(s)) return view('asked', askWords(now - s.askAt), true);
  const stop = s.stopAt ?? -Infinity, idle = s.idleAt ?? -Infinity;
  const byTool = s.postAt != null && s.postAt > stop && s.postAt > idle;
  const byRecord = s.lastRecordAt != null && s.lastRecordAt > stop + T.stopGrace && s.lastRecordAt > idle;
  const recordAge = now - s.lastRecordAt;
  if (byTool || (byRecord && recordAge < T.recordWork)) {
    return quiet >= T.silent ? view('silent', minutes(quiet) + '분째 소식이 없습니다', true) : view('working', '일하는 중');
  }
  // Stop 뒤에 기록만 바뀌고 90초가 지났다. 새 차례가 일하는지 쉬는지 가를 수 없어 기록이 조용하다고만 말한다
  if (byRecord) return view('quiet', minutes(recordAge) + '분째 조용합니다');
  if (s.stopAt != null) return s.seenAt != null && s.seenAt >= s.stopAt ? view('resting', '쉬는 중') : view('done', '끝냄', s.doneLong);
  if (s.idleAt != null) return view('resting', '쉬는 중');
  // 받은 훅이 SessionStart나 도우미 소식뿐이라 표의 어느 줄에도 들지 않는다
  return view('quiet', minutes(quiet) + '분째 조용합니다');
}

/* 줄의 글: 작업 폴더 이름과 마지막 도구(「shop · 읽기 · auth.ts」). AI로 요약하지 않는다(4.4) */
const TOOL_WORDS = Object.freeze({ Read: '읽기', Edit: '쓰기', MultiEdit: '쓰기', Write: '쓰기', NotebookEdit: '쓰기', Bash: '명령', PowerShell: '명령', Grep: '찾기', Glob: '찾기', WebFetch: '웹 읽기', WebSearch: '웹 찾기', Task: '도우미', Agent: '도우미' });
export function officeActivity({ cwd = null, lastTool = null } = {}) {
  const name = lastTool?.name ? String(lastTool.name) : '';
  const tool = name ? (own(TOOL_WORDS, name) ? TOOL_WORDS[name] : name) : '';
  return [folderName(cwd), tool, tool ? String(lastTool.detail || '').trim() : ''].filter(Boolean).join(' · ');
}

/* 지금 화면에 선 직원들. 돌려주는 값(하나마다):
   { id, tool, hooked, model, status('working'|'asked'|'silent'|'done'|'resting'|'quiet'), say, alert, note, askedAt,
     activity, subagents, departmentId(null은 「부서 없는 일」), departmentName, folder, cwd } */
export function officeSessions(state, now, { departments = [], assignments = {} } = {}) {
  const list = Array.isArray(departments) ? departments : [];
  const out = [];
  for (const s of Object.values(state?.sessions || {})) {
    const v = statusOf(s, now);
    if (!v) continue;
    const departmentId = officeDepartmentOf({ sessionId: s.id, cwd: s.cwd }, list, assignments);
    out.push({
      id: s.id, tool: s.tool, hooked: s.hooked, model: s.model, ...v,
      note: s.hooked ? '' : UNKNOWN_NOTE, askedAt: v.status === 'asked' ? s.askAt : null,
      activity: officeActivity(s), subagents: s.hooked ? subagentCount(s) : 0,
      departmentId, departmentName: departmentId == null ? null : list.find(d => d && d.id === departmentId)?.name ?? null,
      folder: folderName(s.cwd), cwd: s.cwd, since: s.firstAt,
    });
  }
  return out.sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(({ since, ...v }) => v);
}

/* ── 맨 위 두 줄(4.3, 6절, 7절) ──
   차례: 승인을 물은 세션 · 수용 인원을 넘음 · 일하는 수 · 모두 쉼. 훅 소식이 없는 세션(Codex 포함)이 있으면 둘째 줄이 그 수를 말한다.
   input: officeSessions의 값, { cap 수용 인원, hooksOn 「승인 물음도 보기」를 켰는지 }. 돌려주는 값: { say, then, hint, active, unknown } */
const whoOf = v => v.departmentName || (v.folder ? v.folder + ' 폴더의 일' : '부서 없는 일');
export function officeHeadline(list, { cap = null, hooksOn = true } = {}) {
  const shown = Array.isArray(list) ? list : [];
  const asks = shown.filter(v => v.status === 'asked').sort((a, b) => a.askedAt - b.askedAt);
  const busy = shown.filter(v => v.status === 'working' || v.status === 'silent');
  const active = busy.length + asks.length; // 수용 인원에 세는 것은 일하는 직원과 승인을 물은 직원이다(6절)
  const unknown = shown.filter(v => !v.hooked).length;
  const over = Number.isFinite(cap) && cap >= 1 && active > cap ? countWord(cap) + '까지인데 지금 직원 ' + ga(countWord(active)) + ' 일하고 있습니다.' : '';
  // 모두가 모르면 어디서 승인하는지를 말한다(11-23 맹검 「모두 승인 물음을 모릅니다」가 어색하다). 일부만 모르면 그 수를 말한다.
  // 창의 이름(「Claude Code 창」)은 처음 보는 사람이 모르는 개발 도구 이름이고(11-23 맹검), 「AI를 켠 창」 · 「솔리오 밖에서 켠 AI」는 어디를 말하는지 몰랐다(11-25 맹검 두 번)
  const unknownSay = !unknown ? '' : unknown < shown.length ? neun(countWord(unknown)) + ' 승인 요청이 여기에 뜨지 않습니다.' : '이 PC에서 따로 켠 AI가 허락을 물으면 그 AI 화면에서 답해 주세요.';
  const silent = shown.find(v => v.status === 'silent'), done = shown.find(v => v.status === 'done' && v.alert);
  const news = silent ? ga(whoOf(silent)) + ' ' + silent.say + '.' : done ? ga(whoOf(done)) + ' 일을 하나 끝냈습니다.' : '';
  const hint = hooksOn === false ? '승인 요청은 설정에서 켜면 여기에 뜹니다.' : '';
  let say, then;
  if (asks.length) {
    say = ga(whoOf(asks[0])) + ' ' + asks[0].say + '.';
    then = unknownSay || (asks.length > 1 ? ga(countWord(asks.length - 1)) + ' 더 승인을 물었습니다.' : '') || over
      || (busy.length ? '그 밖에 ' + ga(countWord(busy.length)) + ' 일하고 있습니다.' : '')
      || (shown.some(v => v.status === 'quiet') ? '' : '다른 일은 없습니다.');
  } else if (busy.length) {
    // 「아홉이 일하고 있습니다」는 누가 일하는지 몰랐다(11-23 맹검). 사무실의 낱말 「직원」을 붙인다
    say = over || '직원 ' + ga(countWord(busy.length)) + ' 일하고 있습니다.';
    then = unknownSay || news;
  } else if (!shown.length) {
    say = '지금 이 PC에서 도는 일이 없습니다.';
    then = 'Claude Code나 Codex에서 일을 시작하면 여기에 섭니다.';
  } else if (shown.every(v => v.status === 'done' || v.status === 'resting')) {
    say = '지금은 모두 쉬고 있습니다.';
    then = news;
  } else {
    // 조용한 세션은 긴 명령을 돌리고 있을 수 있어 「모두 쉬고 있습니다」라고 하지 않는다(4.2)
    say = '지금 일하는 중으로 보이는 직원은 없습니다.';
    then = unknownSay || news;
  }
  return { say, then, hint, active, unknown };
}

/* ── 수용 인원(6절, README 「이 PC의 수용 인원」) ──
   논리 코어 둘마다 하나, 메모리 4GB마다 하나, 적은 쪽, 가장 적어도 하나가 PC 한도다. 도구마다 구독이 50% 넘게 남으면 PC 한도,
   그 아래는 절반(올림), 20% 아래는 하나, 다 쓰면 0이다. 구독 값이 없으면 그 도구는 PC 한도만 쓴다.
   합친 인원은 PC 한도와 도구별 인원의 합 가운데 적은 쪽이고 가장 적어도 하나다. 직접 정한 값(1~논리 코어 수)이 이긴다 */
export function officeCapacity({ cores, totalMemGb, subscriptions = {}, manual = null } = {}) {
  const c = Math.max(1, Math.floor(Number(cores) || 0));
  const m = Number(manual), mine = manual != null && manual !== '' && Number.isInteger(m) && m >= 1 && m <= c;
  // 본체가 메모리를 읽지 못하면 null을 보낸다. 그때 PC 한도는 셀 수 없어 하나로 둔다(못 읽은 메모리를 0GB로 셈하지 않는다).
  const memKnown = totalMemGb != null && totalMemGb !== '' && Number.isFinite(Number(totalMemGb));
  // Windows는 16GB PC의 메모리를 15.7쯤으로 알려 준다. GB로 반올림해 셈해야 「8코어 16GB는 넷」이 맞는다
  const pcCap = memKnown ? Math.max(1, Math.min(Math.floor(c / 2), Math.floor(Math.round(Math.max(0, Number(totalMemGb))) / 4))) : 1;
  // 직접 정한 수는 메모리를 읽었든 못 읽었든 PC 한도를 대신하고, 도구별 수도 그 수에서 구독 규칙으로 센다. 그래서 메모리와 직접 정한 수에 대해서는
  // 화면(수용 인원 줄)과 일 맡기기 실행(office-task-runtime.cjs)이 이 함수로 같은 수를 쓴다(P2 묶음 GA1, 검수 solio-office-ga1 F2, 설계 검토 solio-office-model-20261122 고칠 것 1).
  // 구독 남은 양은 지금 실행이 넘기지 않아 그 몫은 다를 수 있다(같은 검토 고칠 것 3, 구현설계 6절)
  const base = mine ? m : pcCap;
  const toolCaps = {}, missing = [];
  for (const tool of TOOLS) {
    const left = subscriptions?.[tool]?.leftPercent;
    if (typeof left !== 'number' || !Number.isFinite(left)) { toolCaps[tool] = base; missing.push(tool); continue; }
    toolCaps[tool] = left >= 50 ? base : left >= 20 ? Math.ceil(base / 2) : left > 0 ? 1 : 0;
  }
  const auto = Math.max(1, Math.min(pcCap, TOOLS.reduce((sum, t) => sum + toolCaps[t], 0)));
  return { pcCap, toolCaps, cap: mine ? m : auto, source: mine ? 'manual' : 'auto', memKnown, missing, note: missing.length ? '구독 방에 계정을 이으면 남은 양도 봅니다.' : '' };
}
/* 부서 하나의 자리: 수용 인원을 셋으로 나눠 올린 수, 하나부터 셋까지 */
export const officeSeats = cap => Math.min(3, Math.max(1, Math.ceil((Number(cap) || 0) / 3)));

/* ── 부서의 책상(솔리오_사무실책상_20261125/README.md 6절) ──
   책상 하나에 앉는 수(size)와 책상 수(count)는 부서마다 고른다. 직원이 자리보다 많으면 같은 책상이 저절로 더 놓인다.
   그림(office-floor.mjs)과 부서 줄(office-room.mjs)이 같은 함수를 쓴다. 3인 책상 하나인 부서(고르지 않은 부서)는 지금처럼 수용 인원에 따른 자리(1~3)만 보인다.
   held: 조금 전까지 놓였던 수. 직원이 떠나도 바로 줄이지 않는다(office-room.mjs가 3분 들고 있다). cap: 그림이 앉히는 한도. 저절로 느는 책상만 줄이고 손님이 정한 책상 수는 지킨다.
   돌려주는 값: { size, base, desks 놓인 수, grown 저절로 더 놓인 수, seats 책상마다 보이는 자리, finish 재질(null은 사무실 스킨) } */
export const OFFICE_DESK_SIZES = Object.freeze([1, 2, 3, 4]);
export const OFFICE_DESK_COUNT_MAX = 6;
export const OFFICE_DESK_FINISHES = Object.freeze(['black', 'walnut']);
export const OFFICE_DEPT_SEATS = 24; // 그림에서 부서 하나가 앉히는 직원의 위 끝
export function officeDeskPlan(desk, staffCount, seats = 1, { held = 0, cap = OFFICE_DEPT_SEATS } = {}) {
  const d = desk && typeof desk === 'object' ? desk : {};
  const size = OFFICE_DESK_SIZES.includes(d.size) ? d.size : 3;
  const base = Number.isInteger(d.count) && d.count >= 1 && d.count <= OFFICE_DESK_COUNT_MAX ? d.count : 1;
  const n = Math.max(0, Math.floor(Number(staffCount) || 0));
  const most = Math.max(1, Math.floor(Math.min(OFFICE_DEPT_SEATS, Math.max(1, Number(cap) || 1)) / size));
  const desks = Math.max(base, Math.min(most, Math.max(Math.ceil(n / size), Math.floor(Number(held) || 0))));
  return {
    size, base, desks, grown: desks - base, spare: desks - Math.max(base, Math.min(most, Math.ceil(n / size))),
    seats: size === 3 && desks === 1 ? Math.min(3, Math.max(1, Math.floor(Number(seats) || 1), n)) : size,
    finish: OFFICE_DESK_FINISHES.includes(d.finish) ? d.finish : null,
  };
}
/* 「책상」 줄의 글: 지금 놓인 것 */
/* 직원이 떠난 뒤 들고 있는 동안에는 「직원이 늘어」가 맞지 않는다. 남는 책상을 곧 치운다고 쓴다(Fable 최종 F3) */
export const officeDeskLine = p => `${p.size}인 책상 ${countWord(p.desks)}` + (p.spare > 0 ? ` · 빈 책상 ${neun(countWord(p.spare))} 잠시 뒤 치움` : p.grown ? ` · 직원이 늘어 ${countWord(p.grown)} 더 놓음` : '');
