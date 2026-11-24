// 솔리오 「한 번에 처리」(2026-11-24 유호님 「버튼 하나 누르면 1순위 먼저 이동해서 그거 해결하게」, 「해결해야할 순위를 파악해서 원클릭으로 중요순서대로 전부 해결」). DOM이 없다.
// 솔리오 안에서 사람이 끝내야 할 일을 한 줄 대기열로 세운다. 순위 규칙은 워크스페이스와 같다(설계: docs/디자인/솔리오_한번에처리_20261124/README.md 3절,
// 워크스페이스 설계_실제화면.md 13절 #one-click-queue).
//   ① 밖의 사람(고객 · 학생)이 기다리고 기한이 오늘이거나 지난 일 ② 내 결정을 기다리느라 다른 사람(직원 · 고객)이 멈춘 일 ③ 기한이 오늘이거나 지난 일 ④ 그 밖의 일
//   같은 칸 안에서는 기한이 이른 것, 그다음 오래된 것이 먼저다.
// AI가 스스로 끝내는 일은 줄에 넣지 않고 ai로만 돌려준다(화면은 「AI가 처리 중」 한 줄로 보인다).
// 할 일은 방마다의 자료(구독 스냅숏, 사무실 판, 원클릭 장면)에서 모은다(solioTodoItems). 카드의 단추는 그 방이 이미 가진 동작을 그대로 부른다.
import { officeSessions, countWord } from './office-model.mjs';
import { SOLIO_TODAY_NAMES, whenWords, josa } from './solio-today.mjs';
import { nameOf } from './subscriptions-model.mjs';
import { classifyCodexTask } from './office-task-room.mjs';

const HOUR = 3600e3, DAY = 24 * HOUR;
/* 「나중에」로 미룬 일이 다시 줄에 서기까지 */
export const QUEUE_LATER_MS = 3 * HOUR;
/* 「보냈어요」처럼 솔리오가 끝을 알 수 없는 일에 이 PC가 적어 두는 기간 */
export const QUEUE_DONE_KEEP_MS = 30 * DAY;
/* 끝나지 못한 맡긴 일은 이 안의 것만 줄에 세운다. 더 오래된 실패는 사무실 카드에만 남는다 */
export const QUEUE_FAILED_MS = 72 * HOUR;
/* 로그인 기한은 이 안에 끝날 때만 할 일이다(solio-rooms.mjs loginSoon과 같은 7일) */
const LOGIN_SOON_MS = 7 * DAY;
export const QUEUE_TIER = Object.freeze({ outsideToday: 1, waitingOnMe: 2, dueToday: 3, rest: 4 });
/* 카드 머리의 「왜 이 차례인가」. 워크스페이스의 「고객이 기다려요 · 오늘까지」와 같은 말을 솔리오의 말씨로 쓴다 */
export function solioQueueWhy(item, tier, now) {
  const due = num(item?.dueAt), late = due != null && due < now;
  if (tier === QUEUE_TIER.outsideToday) return '고객이 기다립니다 · ' + (late ? '기한 지남' : '오늘까지');
  if (tier === QUEUE_TIER.waitingOnMe) return item?.outside ? '고객이 기다립니다' : '내 결정을 기다립니다';
  if (tier === QUEUE_TIER.dueToday) return late ? '기한이 지났습니다' : '오늘까지입니다';
  return '';
}

const endOfDay = t => { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime(); };
const num = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const timeOf = v => { const n = num(v); if (n != null) return n; const p = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(p) ? p : null; };
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const ga = w => josa(w, ['이', '가']);

/* 한 일의 순위 칸. outside: 밖의 사람이 기다림, waiting: 내 결정을 기다리느라 누가 멈춤, dueAt: 기한(지난 기한은 오늘 기한으로 센다) */
export function solioQueueTier(item, now) {
  const due = num(item?.dueAt), today = due != null && due <= endOfDay(now);
  if (item?.outside && today) return QUEUE_TIER.outsideToday;
  if (item?.waiting || item?.outside) return QUEUE_TIER.waitingOnMe;
  if (today) return QUEUE_TIER.dueToday;
  return QUEUE_TIER.rest;
}

/* 같은 칸 안의 차례: 기한이 이른 것, 그다음 오래된 것. 기한이 없으면 뒤다. 같으면 열쇠 글자 차례로 늘 같은 줄이 서게 한다 */
function within(a, b) {
  const early = (x, y) => (num(x) ?? Infinity) - (num(y) ?? Infinity);
  return early(a.dueAt, b.dueAt) || early(a.since, b.since) || (String(a.key) < String(b.key) ? -1 : String(a.key) > String(b.key) ? 1 : 0);
}

/* 일의 대상(맡긴 일 하나, 계정 하나, 원클릭, 직원 하나). 상태가 바뀌면 열쇠는 바뀌어도 대상은 같다.
   카드의 일이 줄에서 빠졌을 때 같은 대상이 다른 상태로 남아 있으면 끝낸 것이 아니다(카본 solio-todo-20261124 A2) */
export function solioTodoObj(key) {
  const k = String(key || ''), m = /^(task|quote|quote-held|quote-retry|quote-paused|quote-stopped|login|read|until|ask|done|staff):([^:]+)/.exec(k);
  if (k.startsWith('backup:')) return 'backup';
  if (!m) return k;
  return ({ task: 'task', quote: 'task', 'quote-held': 'task', 'quote-retry': 'task', 'quote-paused': 'task', 'quote-stopped': 'task', login: 'acct', read: 'acct', until: 'acct', ask: 'staff', done: 'staff', staff: 'staff' })[m[1]] + ':' + m[2];
}

/* 일 목록을 대기열로 세운다.
   later: { [key]: 미룬 때 } — QUEUE_LATER_MS 안의 것은 줄에서 빼 later로 돌려준다. done: { [key]: 끝낸 때 } — 적어 둔 일은 빼고 센다.
   돌려주는 값: { queue 차례대로(tier · why를 붙여), ai AI가 하는 일, later 미뤄 둔 일 } */
export function solioQueue(items = [], now = Date.now(), { later = {}, done = {} } = {}) {
  const seen = new Set(), queue = [], ai = [], held = [];
  for (const it of items) {
    if (!it || !it.key || seen.has(it.key)) continue;
    seen.add(it.key);
    if (it.ai) { ai.push({ ...it, obj: solioTodoObj(it.key) }); continue; }
    if (num(done?.[it.key]) != null) continue;
    const at = num(later?.[it.key]);
    if (at != null && now >= at && now - at < QUEUE_LATER_MS) { held.push({ ...it, back: at + QUEUE_LATER_MS }); continue; }
    const tier = solioQueueTier(it, now);
    queue.push({ ...it, obj: solioTodoObj(it.key), tier, why: it.why || solioQueueWhy(it, tier, now) });
  }
  queue.sort((a, b) => a.tier - b.tier || within(a, b));
  held.sort((a, b) => a.back - b.back);
  return { queue, ai, later: held };
}

/* 이 PC에 적은 기록(나중에 · 끝냄)에서 지난 것을 지운다(저장소를 키우지 않게) */
export function solioQueueMemoPrune(memo = {}, now = Date.now()) {
  const keep = (map, ms) => Object.fromEntries(Object.entries(map && typeof map === 'object' ? map : {}).filter(([k, at]) => k && Number.isFinite(at) && now >= at && now - at < ms));
  return { later: keep(memo?.later, QUEUE_LATER_MS), done: keep(memo?.done, QUEUE_DONE_KEEP_MS) };
}

/* ── 할 일 모으기 ──
   카드 하나: { key, src, where, outside, waiting, dueAt, since, say, then, acts, wait }
   acts의 kind: do(그 자리에서 끝냄, 끝나면 줄에서 빠진다) · open(밖의 창을 연다, 그 창에서 끝나면 빠진다) · go(솔리오의 그 방으로 간다) · copy(글을 복사한다) · mark(이 PC에 끝냈다고 적는다).
   run: { office: 사무실 방 동작 } · { backup: [동작, 인자] } · { prog: 프로그램 } · { aside: 방 } · { copy: 글 } */
const TOOL = Object.freeze({ claude: 'Claude Code', codex: 'Codex' });
const taskTool = t => (t?.provider === 'codex' ? 'GPT (Codex)' : 'Claude Code');
const taskTitle = t => clip(String(t?.prompt ?? '').split('\n').find(l => l.trim()) || '', 28);
const taskWhere = t => (typeof t?.departmentName === 'string' && t.departmentName.trim() ? t.departmentName.trim() : '사무실');
const quoteFrom = q => { const f = String(q?.from ?? '').trim(); const m = /^"?([^"<]+?)"?\s*<[^>]+>$/.exec(f); return clip(m ? m[1] : f.replace(/^<|>$/g, ''), 24); };
const goOffice = label => ({ id: 'go', label, kind: 'go', run: { prog: 'office' } });
/* 맡긴 일 동작은 본체(office.taskAction)를 바로 부른다. 거절하면 카드가 그 자리에서 말한다(Fable F3) */
const taskRun = (id, kind) => ({ task: { id, kind } });

/* 맡긴 일 하나. 사람이 할 일이 없으면 null, AI가 하는 중이면 { ai } */
function taskItem(t, now) {
  if (!t || typeof t !== 'object' || t.id == null || !['claude', 'codex'].includes(t.provider)) return null;
  const id = String(t.id), status = String(t.status || ''), reason = String(t.reason || '').trim();
  const since = timeOf(t.updatedAt) ?? timeOf(t.createdAt);
  const title = taskTitle(t), job = title ? `「${title}」 일` : '맡긴 일', where = taskWhere(t);
  const base = { src: 'office', where, since };
  const q = t.quoteSource && typeof t.quoteSource === 'object' && !Array.isArray(t.quoteSource) ? t.quoteSource : null;
  if (status === 'running' || status === 'queued') return { key: 'task:' + id, ai: true, src: 'office', who: taskTool(t) };
  // 공식 터미널에서 이어 간 Codex 일: 수기로 보관한 일과 옛 기록은 끝난 일이고, 답을 붙여 넣을 일은 사람의 차례다(사무실 카드와 같은 가름, Fable F5)
  const cs = classifyCodexTask(t);
  if (cs.memberResult || cs.legacyViaTerminal) return null;
  if (cs.manualResult) return { ...base, key: `task:${id}:manual`, waiting: true, say: `${job}의 답을 직접 붙여 넣어 보관해야 합니다.`, then: '공식 터미널에서 확인한 답을 사무실의 그 업무에 붙여 넣어 주세요.', acts: [goOffice('사무실에서 붙여 넣기')] };
  if (q) {
    const from = quoteFrom(q), subject = clip(q.subject, 34), asked = timeOf(q.date) ?? since;
    const whoAsked = from ? from + '님' : '고객';
    if (status === 'completed' && t.quoteOutcome === 'draft' && typeof t.answer === 'string' && t.answer.trim()) {
      return { ...base, key: 'quote:' + id, outside: true, since: asked,
        say: `${whoAsked}의 견적 문의에 보낼 답장 초안이 있습니다.`,
        then: (subject ? `「${subject}」 · ` : '') + '초안을 복사해 메일에서 보내 주세요.',
        acts: [{ id: 'copy', label: '초안 복사', kind: 'copy', run: { copy: t.answer } }, { id: 'sent', label: '보냈어요', kind: 'mark' }, goOffice('사무실에서 보기')],
        copied: '복사했습니다. 메일에서 보낸 뒤 「보냈어요」를 눌러 주세요.' };
    }
    if (status === 'completed' && t.quoteOutcome === 'held') {
      return { ...base, key: 'quote-held:' + id, outside: true, since: asked,
        say: `${whoAsked}의 견적 문의를 직원이 보류했습니다.`, then: '사무실에서 보류한 까닭을 보고 답할지 정해 주세요.', acts: [goOffice('사무실에서 보기')] };
    }
    if (status === 'failed' && t.canRetry === true && reason !== 'CANCELLED') {
      return { ...base, key: 'quote-retry:' + id, outside: true, since: asked,
        say: `${whoAsked}의 견적 답장 초안을 쓰지 못했습니다.`, then: '「다시 작성」을 누르면 견적 담당이 다시 씁니다.',
        acts: [{ id: 'resume', label: '다시 작성', kind: 'do', run: taskRun(id, 'resume') }, goOffice('사무실에서 보기')] };
    }
    // 견적 담당 일은 멈춘 채 만들어지기도 한다(본체 addRecipients). 멈춘 일은 그 자리에서 다시 시작하고, 중단된 일은 사무실에서 본다(Fable F7)
    if (status === 'paused') {
      return { ...base, key: 'quote-paused:' + id, outside: true, since: asked, say: `${whoAsked}의 견적 답장 일이 멈춰 있습니다.`, then: '「다시 시작」을 누르면 견적 담당이 이어서 씁니다.',
        acts: [{ id: 'resume', label: '다시 시작', kind: 'do', run: taskRun(id, 'resume') }, goOffice('사무실에서 보기')] };
    }
    if (status === 'interrupted' && reason !== 'CANCELLED') {
      return { ...base, key: 'quote-stopped:' + id, outside: true, since: asked, say: `${whoAsked}의 견적 답장 일이 중단됐습니다.`, then: '사무실에서 까닭을 보고 다시 맡겨 주세요.', acts: [goOffice('사무실에서 보기')] };
    }
    return null;
  }
  if (status === 'terminal') {
    const can = t.canOpenTerminal === true && !(t.provider === 'codex' && t.viaTerminal === true && reason === 'MEMBER_RESULT');
    return { ...base, key: `task:${id}:terminal`, waiting: true,
      say: `${job}을 맡은 ${taskTool(t)} 직원이 공식 터미널에서 확인을 기다립니다.`, then: '터미널에서 승인하거나 로그인하면 일이 이어집니다.',
      acts: can ? [{ id: 'terminal', label: '터미널 열기', kind: 'open', run: taskRun(id, 'terminal') }, goOffice('사무실에서 보기')] : [goOffice('사무실에서 보기')],
      wait: '터미널에서 마치면 여기서 다음 일로 넘어갑니다.' };
  }
  if (status === 'paused') {
    return { ...base, key: `task:${id}:paused`, waiting: true, say: `${job}이 멈춰 있습니다.`, then: '「다시 시작」을 누르면 직원이 이어서 합니다.',
      acts: [{ id: 'resume', label: '다시 시작', kind: 'do', run: taskRun(id, 'resume') }, goOffice('사무실에서 보기')] };
  }
  if (status === 'failed' && reason === 'MAIL_CHOOSE') {
    return { ...base, key: `task:${id}:choose`, waiting: true, say: `${job}을 어떻게 할지 골라야 직원이 이어 갑니다.`, then: '사무실에서 메일에서 찾을지, 일반 업무로 맡길지 골라 주세요.', acts: [goOffice('사무실에서 고르기')] };
  }
  if (status === 'failed' && reason === 'MAIL_REVIEW') {
    return { ...base, key: `task:${id}:review`, waiting: true, say: `${job}의 메일 검색 조건을 확인해 주세요.`, then: '사무실에서 조건을 보고 「이 조건으로 찾기」를 누르면 이어 갑니다.', acts: [goOffice('사무실에서 확인')] };
  }
  const failed = (status === 'failed' || status === 'interrupted') && reason !== 'CANCELLED';
  if (failed && since != null && now - since < QUEUE_FAILED_MS) {
    return { ...base, key: `task:${id}:failed`, say: `${job}을 끝내지 못했습니다.`, then: '사무실에서 까닭을 보고 다시 맡길 수 있습니다.', acts: [goOffice('사무실에서 보기')] };
  }
  return null;
}

/* 사무실 판(본체 office.snapshot)에서. 세션의 승인 물음과 끝냄은 훅 소식이 있을 때만 생긴다(지금 실제 앱은 기록만 읽어 생기지 않는다) */
function officeItems(snap, now) {
  if (!snap || typeof snap !== 'object' || snap.ok === false || snap.available !== true) return [];
  const out = [];
  const departments = (Array.isArray(snap.departments) ? snap.departments : []).filter(d => d && typeof d.id === 'string');
  const assignments = snap.assignments && typeof snap.assignments === 'object' ? snap.assignments : {};
  let sessions = [];
  try { sessions = officeSessions(snap.state, now, { departments, assignments }); } catch { sessions = []; }
  for (const v of sessions) {
    const who = v.departmentName || (v.folder ? v.folder + ' 폴더' : '부서 없는 일'), tool = TOOL[v.tool] || '프로그램';
    if (v.status === 'working') out.push({ key: 'staff:' + v.id, ai: true, src: 'office', who: tool });
    else if (v.status === 'asked') {
      out.push({ key: 'ask:' + v.id, src: 'office', where: '사무실', waiting: true, since: num(v.askedAt),
        say: `${who}의 ${tool} 직원이 승인을 기다립니다.`, then: `${tool} 창에서 승인하면 일이 이어집니다.`,
        acts: [goOffice('사무실에서 보기')], wait: `${tool} 창에서 승인하면 여기서 다음 일로 넘어갑니다.` });
    } else if (v.status === 'done' && v.alert) {
      const row = v.departmentId == null ? 'lobby' : 'd:' + v.departmentId;
      out.push({ key: 'done:' + v.id, src: 'office', where: '사무실', since: null,
        say: `${ga(who)} 일을 하나 끝냈습니다.`, then: `결과는 ${tool} 창에 있습니다. 보셨으면 「확인했어요」를 눌러 주세요.`,
        acts: [{ id: 'seen', label: '확인했어요', kind: 'do', run: { office: { room: 'solio-office', act: 'row-fold', key: row } } }] });
    }
  }
  for (const t of Array.isArray(snap.tasking?.tasks) ? snap.tasking.tasks : []) {
    const it = taskItem(t, now);
    if (it) out.push(it);
  }
  return out;
}

/* 구독 스냅숏에서: 다시 로그인 · 못 읽음 · 로그인 기한. Gemini처럼 사용량을 읽지 않는 계정과 다른 PC 계정은 세지 않는다 */
function subsItems(snapshot, now) {
  const out = [];
  for (const r of Array.isArray(snapshot?.rows) ? snapshot.rows : []) {
    if (!r || r.source !== 'auto' || r.service === 'gemini' || r.usageDisabled || r.state === 'elsewhere') continue;
    const svc = SOLIO_TODAY_NAMES[r.service] || String(r.label || '').trim() || '구독', nm = nameOf(r), acct = [svc, nm].filter(Boolean).join(' ') + ' 계정';
    const go = { id: 'go', label: '계정 관리 열기', kind: 'go', run: { aside: 'manage' } };
    const since = num(r.live?.readAt);
    if (r.state === 'needs-login') out.push({ key: 'login:' + r.id, src: 'subs', where: '구독', since, say: `${acct}에 다시 로그인해야 합니다.`, then: '계정 관리에서 다시 로그인하면 남은 양을 다시 읽습니다.', acts: [go] });
    else if (r.state === 'error') out.push({ key: 'read:' + r.id, src: 'subs', where: '구독', since, say: `${acct}의 남은 양을 읽지 못했습니다.`, then: '계정 관리에서 연결을 확인해 주세요.', acts: [go] });
    else if (r.state === 'ok' && num(r.loginUntil) != null && r.loginUntil - now <= LOGIN_SOON_MS) {
      const past = r.loginUntil <= now;
      out.push({ key: 'until:' + r.id, src: 'subs', where: '구독', dueAt: r.loginUntil, since,
        say: past ? `${acct}의 로그인 기한이 지났습니다.` : `${acct}의 로그인 기한이 ${whenWords(r.loginUntil, now, { withTime: true })}에 끝납니다.`,
        then: past ? '계정 관리에서 다시 로그인해 주세요.' : '기한 전에 다시 로그인하면 끊기지 않습니다.', acts: [go] });
    }
  }
  return out;
}

/* 원클릭 장면(solioBackupView)에서. 엔진이 스스로 하는 일(지키는 중 · 첫 백업 준비 · 설치 진행)은 넣지 않는다.
   관리자 확인을 기다리는 설치는 사람이 「예」를 눌러야 이어지므로 ②다 */
const BACKUP_TODO = new Set(['시작 전', '엔진 없음', '확인 필요', '멈춤', '꺼짐', '업데이트 필요']);
function backupItems(scene, raw, now) {
  if (!scene || scene.visible !== true) return [];
  const where = '원클릭', phase = raw?.install?.phase;
  // 원클릭 방의 「보호 시작」 · 「엔진 창에서 …」만 카드에 옮긴다. 둘 다 엔진 창을 열고, 그 창에서 끝나면 줄에서 빠진다
  const toAct = a => ({ id: a.act + ':' + (a.arg || ''), label: a.label, kind: 'open', run: { backup: [a.act, a.arg || ''] } });
  const acts = (scene.acts || []).filter(a => a && !a.disabled && ['backup-start', 'backup-open'].includes(a.act));
  if (phase === 'admin') return [{ key: 'backup:admin', src: 'backup', where, waiting: true, since: null, say: scene.say, then: scene.then, acts: [], wait: '「예」를 누르면 여기서 다음 일로 넘어갑니다.' }];
  if (phase === 'error' && acts.length) return [{ key: 'backup:install-error', src: 'backup', where, since: null, say: scene.say, then: scene.then, acts: acts.slice(0, 2).map(toAct), wait: '엔진 창에서 이어서 하면 여기서 다음 일로 넘어갑니다.' }];
  if (scene.busy) return [{ key: 'backup:busy', ai: true, src: 'backup', who: '백업 엔진', install: !!phase && !['idle', 'opened', 'done', 'error'].includes(phase) }];
  if (!BACKUP_TODO.has(scene.note) || !acts.length) return [];
  const since = timeOf(raw?.status?.writtenAt);
  return [{ key: 'backup:' + scene.note, src: 'backup', where, since, say: scene.say, then: scene.then, acts: acts.slice(0, 2).map(toAct), wait: '엔진 창에서 마치면 여기서 다음 일로 넘어갑니다.' }];
}

/* 세 방의 할 일을 한 목록으로 */
export function solioTodoItems({ subs = null, office = null, backup = null, backupRaw = null } = {}, now = Date.now()) {
  return [...officeItems(office, now), ...subsItems(subs, now), ...backupItems(backup, backupRaw, now)];
}

/* 「AI가 처리 중」 한 문장. AI 직원(맡긴 일 · 일하는 세션)과 백업 엔진을 따로 센다 */
export function solioTodoAiSay(ai = []) {
  const staff = ai.filter(a => a.src === 'office').length, engine = ai.find(a => a.src === 'backup');
  const parts = [staff ? `AI 직원 ${ga(countWord(staff))} 일하고 있습니다.` : '', engine ? (engine.install ? '백업 엔진이 설치를 이어 가고 있습니다.' : '백업 엔진이 일하고 있습니다.') : ''].filter(Boolean);
  return parts.join(' ');
}

/* 다 끝났을 때의 둘째 줄: 미룬 일, 건너뛴 일, AI가 하는 일 */
export function solioTodoEndThen({ later = [], skipped = 0, ai = [] } = {}, now = Date.now()) {
  const parts = [];
  if (skipped) parts.push(`건너뛴 일 ${skipped}개가 남았습니다.`);
  if (later.length) parts.push(`미룬 일 ${later.length}개는 ${whenWords(later[0].back, now, { withTime: true })}에 다시 줄에 섭니다.`);
  const aiSay = solioTodoAiSay(ai);
  if (aiSay) parts.push(aiSay);
  return parts.join(' ');
}

