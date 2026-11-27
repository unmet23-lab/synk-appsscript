/* 기획부 「사업계획서」 작업 화면의 상태와 동작(사업계획서_설계.md 2, 6절).
   api: window.synkDesktop.office(featureSnapshot, featureAction). 본체가 파일을 고르고 쓰며, 이 방은 이름과 번호만 보낸다.
   한 번에 한 동작만 보낸다. 방을 닫거나 계정이 바뀌면 늦게 온 답을 버린다 */
import { bizplanScene, nextWrite, revealPlan, scoreBoard } from './office-bizplan-model.mjs';

const FEATURE = 'bizplan';
const SAY = {
  CANCELLED: '', BUSY: '이미 읽고 있습니다.', PLAN_FORMAT: '한글과 PDF는 아직 읽지 못합니다. Word(.docx)로 저장해 넣어 주세요.',
  DATA_FORMAT: '회사 자료는 txt, md, csv, docx, xlsx 파일을 받습니다.', DATA_COUNT: '회사 자료는 열 개까지 고를 수 있습니다.',
  PLAN_MISSING: '계획서 파일을 찾지 못했습니다. 다시 골라 주세요.', PLAN_CHANGED: '계획서가 읽은 뒤에 바뀌었습니다. 다시 읽은 뒤 저장할 수 있습니다.',
  NOTHING: '바꾼 문장이 없어 저장할 것이 없습니다.', SAVE: '저장하지 못했습니다. 원본은 그대로입니다.', CRITERIA: '평가 항목을 한 줄에 하나씩 적어 주세요.',
  BROKEN: '목록 파일을 읽지 못했습니다. 기록 지우기를 누르면 처음부터 할 수 있습니다.', NOT_FOUND: '그 메모를 찾지 못했습니다. 화면을 다시 읽었습니다.',
  WRITE_EMPTY: '한 장 이상 써야 초안을 만들 수 있습니다.',
  CRITERIA_CHANGED: '평가 기준이 바뀌어 다시 읽은 뒤 심사할 수 있습니다.',
  RESCORE_OLD: '심사 기록이 예전 판이라 다시 읽은 뒤 심사할 수 있습니다.',
  PANEL_CLAUDE: '처음 심사한 심사위원은 Claude 직원으로 다시 심사합니다. 직원을 Claude로 바꿔 주세요.',
  PANEL_CODEX: '처음 심사한 심사위원은 GPT 직원으로 다시 심사합니다. 직원을 GPT로 바꿔 주세요.',
  AUTH_CHANGED: '계정이 바뀌어 멈췄습니다.', NOT_AVAILABLE: '이 판에서는 쓸 수 없습니다.', STORAGE_FULL: '업무 기록이 가득 찼습니다.',
};
const say = code => (code in SAY ? SAY[code] : '하지 못했습니다. 잠시 뒤 다시 해 주세요.');

/* 이미 보인 점수(부서마다 scores.at). 같은 점수의 무대를 두 번 틀지 않는다. 앱을 다시 켜도 남게 창의 저장소에도 적는다 */
const SEEN_KEY = 'solio.bizplan.scoreSeen';
function sharedSeen() {
  const mem = new Map();
  const box = () => { try { return globalThis.window?.localStorage || null; } catch { return null; } };
  const all = () => { try { const v = JSON.parse(box()?.getItem(SEEN_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  return {
    get: id => (mem.has(id) ? mem.get(id) : Number(all()[id]) || 0),
    set: (id, at) => { mem.set(id, at); try { const v = all(); v[id] = at; box()?.setItem(SEEN_KEY, JSON.stringify(v)); } catch { /* 저장소가 없어도 이번 실행에서는 기억한다 */ } },
  };
}
const SEEN = sharedSeen();
const reducedDefault = () => {
  try { return globalThis.document?.documentElement?.dataset?.motion === 'reduced' || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; }
};

// hidden(): 앱 창이 가려져 있는가. 가려진 동안은 읽는 진행을 다시 묻지 않는다
export function createBizplanRoom({ api = null, changed = () => {}, hidden = () => false, now = () => Date.now(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, seen = SEEN, reducedMotion = reducedDefault } = {}) {
  const fresh = () => ({ departmentId: null, snap: null, busy: null, live: '', sel: null, edit: null, editText: null, hand: null, handDept: null, handProvider: null,
    ask: null, answers: {}, provider: null, criteriaOpen: false, criteriaMode: null, criteriaText: null, clearAsk: false, loadedAt: 0, sig: '',
    menu: null, sheet: false, toast: null, write: null, writeText: {}, writeSeen: [],
    // 점수(14.3): reveal은 지금 트는 무대({at, step}), results는 열어 둔 점수 결과의 scores.at, scoreRow는 펼친 항목(undefined면 가장 약한 항목)
    reveal: null, results: null, scoreRow: undefined });
  let st = fresh(), gen = 0, timer = null, toastTimer = null, revealTimer = null;
  const stopReveal = () => { if (revealTimer) clearTimer(revealTimer); revealTimer = null; };
  const showResults = at => { stopReveal(); st.reveal = null; st.results = at; st.scoreRow = undefined; if (st.departmentId) seen.set(st.departmentId, at); };
  /* 무대의 박자를 센다. 다시 그려도 처음부터 틀지 않는다(박자는 방이 가진다) */
  function armReveal(plan) {
    stopReveal();
    const r = st.reveal, b = plan.beats;
    if (!r) return;
    if (r.step >= b.length - 1) { showResults(r.at); return; }
    revealTimer = setTimer(() => {
      revealTimer = null;
      if (st.reveal !== r) return;
      r.step += 1;
      if (b[r.step].kind === 'end') showResults(r.at); else armReveal(plan);
      changed();
    }, Math.max(0, b[r.step + 1].at - b[r.step].at));
  }
  /* 새 점수가 왔으면 무대를 한 번 튼다. 움직임을 줄인 설정이면 바로 결과 */
  function maybeReveal(task) {
    const sc = st.snap?.scores;
    if (!sc || !Number.isFinite(sc.at) || !Array.isArray(sc.judges) || st.write != null) return;
    if (task && ['queued', 'running', 'terminal', 'paused'].includes(task.status)) return;
    if (st.reveal && st.reveal.at !== sc.at) { stopReveal(); st.reveal = null; }
    if (st.reveal || st.results === sc.at || sc.at <= (seen.get(st.departmentId) || 0) || hidden()) return;
    const plan = revealPlan(sc, st.snap.read);
    if (!plan || reducedMotion()) { showResults(sc.at); return; }
    st.reveal = { at: sc.at, step: 0 };
    armReveal(plan);
  }
  /* 고른 뒤 잠깐 「되돌리기」를 보인다(14.1). 고른 장은 비워 다음 고칠 곳이 앞에 선다 */
  const toast = (text, key) => { if (toastTimer) clearTimer(toastTimer); st.toast = { text, key }; st.live = text; toastTimer = setTimer(() => { toastTimer = null; st.toast = null; if (st.live === text) st.live = ''; changed(); }, 4200); };
  const call = (name, ...a) => { try { return typeof api?.[name] === 'function' ? Promise.resolve(api[name](...a)) : Promise.resolve({ ok: false, code: 'NOT_AVAILABLE' }); } catch { return Promise.resolve({ ok: false }); } };
  let loadSeq = 0;
  async function load() {
    if (!st.departmentId) return;
    const my = gen, dept = st.departmentId, seq = ++loadSeq;
    const snap = await call('featureSnapshot', FEATURE, dept);
    if (my !== gen || st.departmentId !== dept || seq !== loadSeq) return;
    const before = st.snap?.read?.id ?? null;
    st.snap = snap && typeof snap === 'object' ? snap : { ok: false };
    if ((st.snap.read?.id ?? null) !== before) {
      if (toastTimer) clearTimer(toastTimer);
      toastTimer = null;
      Object.assign(st, { sel: null, edit: null, editText: null, hand: null, ask: null, answers: {}, sheet: false, toast: null });
    }
    st.loadedAt = now();
    changed();
  }
  // 쓰던 장 가운데 본체 글과 다른 것을 남긴다. 결과를 기다리지 않는다(닫기 · 창 가림)
  function sendTexts(fields) {
    if (st.write == null || !st.departmentId) return;
    const q = st.write, dept = st.departmentId, dr = st.snap?.draft;
    const texts = { ...st.writeText, ...(fields && typeof fields['answer-' + q] === 'string' ? { [q]: fields['answer-' + q] } : {}) };
    for (const [k, t] of Object.entries(texts)) {
      const n = Number(k);
      if (n >= 0 && n < 7 && String(t) !== (dr?.chapters?.[n] ?? '')) Promise.resolve().then(() => call('featureAction', FEATURE, dept, 'write-save', { chapter: n, text: String(t).slice(0, 4000) })).catch(() => {});
    }
  }
  async function act(action, args = {}, okText = '') {
    if (st.busy) { st.live = '앞의 일을 하는 중입니다.'; changed(); return null; }
    const my = gen, dept = st.departmentId;
    st.busy = action; st.live = ''; changed();
    let res;
    try { res = await call('featureAction', FEATURE, dept, action, args); } catch { res = { ok: false }; }
    if (my !== gen || st.departmentId !== dept) return null;
    st.busy = null;
    if (!res || res.ok === false) st.live = say(res?.code);
    else if (okText) st.live = okText;
    await load();
    return res;
  }
  function schedule(running) {
    if (timer) { clearTimer(timer); timer = null; }
    if (!running || !st.departmentId || hidden()) return;
    timer = setTimer(() => { timer = null; if (!hidden()) void load(); }, 1500);
  }
  return {
    open(departmentId) { gen += 1; stopReveal(); st = { ...fresh(), departmentId }; void load(); changed(); },
    close({ fields = null } = {}) {
      sendTexts(fields);
      gen += 1; if (timer) clearTimer(timer); if (toastTimer) clearTimer(toastTimer); stopReveal(); timer = null; toastTimer = null; st = fresh(); },
    /* 창이 가려지거나 닫힐 때(계정 생명주기 flushDraft) 쓰던 장을 남긴다. 화면은 그대로 둔다(설계 검토 지적 3) */
    flush() { sendTexts(null); },
    get departmentId() { return st.departmentId; },
    /* 사무실 판이 바뀔 때(업무 줄의 상태) 기능 판도 다시 읽는다. 읽는 동안은 1.5초마다 진행을 읽는다 */
    scene(task, { departments = [], deptName = '기획부' } = {}) {
      if (!st.departmentId) return null;
      st.depts = departments;
      const sig = task ? task.id + ':' + task.status + ':' + task.updatedAt : '';
      if (sig !== st.sig) { st.sig = sig; if (st.snap) void load(); }
      const live = task && ['queued', 'running'].includes(task.status);
      schedule(live);
      if (live) st.lastLive = task;
      // 업무가 끝난 첫 판은 끝난 뒤의 기록을 읽을 때까지 앞 판(심사 무대)을 그대로 둔다. 옛 기록으로 다른 화면이 잠깐 서지 않게(카본 A2)
      const view = !live && task && st.lastLive?.id === task.id && !(st.loadedAt >= (Number(task.updatedAt) || 0)) && now() - (Number(task.updatedAt) || 0) < 4000 ? st.lastLive : task;
      maybeReveal(view);
      return { departmentId: st.departmentId, ...bizplanScene(st.snap, view, st, { departments, deptName }) };
    },
    async handle(p = {}) {
      const act_ = String(p.act || ''), arg = p.arg == null ? '' : String(p.arg), fields = p.fields && typeof p.fields === 'object' ? p.fields : {};
      switch (act_) {
        case 'biz-pick-plan': await act('pick-plan', {}, '계획서 파일을 골랐습니다.'); return true;
        case 'biz-pick-data': await act('pick-data', {}, '회사 자료를 더했습니다.'); return true;
        case 'biz-remove-data': await act('remove-data', { index: Number(arg) }); return true;
        case 'biz-criteria-open': st.criteriaOpen = !st.criteriaOpen; changed(); return true;
        case 'biz-criteria': {
          const mode = arg === 'pasted' ? 'pasted' : 'default';
          st.criteriaMode = mode; st.menu = null; st.criteriaOpen = mode === 'pasted';
          if (mode === 'default') { st.criteriaText = null; await act('criteria', { mode }); }
          else changed();
          return true;
        }
        case 'biz-criteria-save': {
          const text = String(fields.criteria ?? '').slice(0, 4000);
          st.criteriaText = text;
          const res = await act('criteria', { mode: 'pasted', text }, '평가 항목을 저장했습니다.');
          if (res?.ok) { st.criteriaOpen = false; st.criteriaText = null; st.criteriaMode = null; }
          return true;
        }
        case 'biz-provider': st.provider = arg === 'codex' ? 'codex' : 'claude'; st.menu = null; changed(); return true;
        /* 손님 설정(설계 14.7): 다른 회사 심사위원도 부르기. 메뉴는 열어 둔다 */
        case 'biz-others': await act('setting', { name: 'others', value: st.snap?.list?.settings?.others !== true }); return true;
        /* 점수(14.3): 무대 건너뛰기, 결과 열고 닫기, 항목 펼치기, 다시 심사 */
        case 'biz-score-skip': if (st.reveal) showResults(st.reveal.at); changed(); return true;
        case 'biz-score-open': {
          const at = st.snap?.scores?.at;
          // 결과를 본 것으로 적는다. 닫은 뒤 같은 점수의 무대를 다시 틀지 않는다(카본 A1)
          if (Number.isFinite(at)) { showResults(at); st.menu = null; st.sheet = false; }
          changed(); return true;
        }
        case 'biz-score-close': stopReveal(); st.reveal = null; st.results = null; changed(); return true;
        case 'biz-score-row': {
          // 처음 펼친 줄은 화면과 같은 셈(가장 약한 항목, 없으면 평균이 가장 낮은 항목)으로 안다(카본 A5)
          const openNow = st.scoreRow === undefined ? scoreBoard(st.snap?.scores, st.snap?.read).weak : st.scoreRow;
          st.scoreRow = openNow === arg ? null : arg; changed(); return true;
        }
        case 'biz-rescore': {
          const s = st.snap;
          await act('rescore', { provider: st.provider || s?.read?.provider || 'claude' }, '고친 계획서로 다시 심사를 맡겼습니다.');
          return true;
        }
        case 'biz-start': {
          st.write = null; st.writeText = {};
          const s = st.snap, unsaved = s?.read?.notes?.some(n => n.choice && n.choice.kind !== 'handed') && !s.saved;
          // 저장 안 한 고름이 있으면 한 번 묻고, 두 번째 누름은 다시 읽는다(코드 검수 P1-2)
          if (unsaved && arg !== 'yes' && !st.startAsk) { st.live = '고른 것이 아직 저장되지 않았습니다. 다시 읽으면 사라집니다. 한 번 더 누르면 다시 읽습니다.'; st.startAsk = true; changed(); return true; }
          st.startAsk = false;
          // 붙여 넣고 저장하지 않은 평가 항목이 있으면 먼저 저장한다(코드 검수 P2-6)
          if (st.criteriaMode === 'pasted' && typeof fields.criteria === 'string' && fields.criteria.trim() !== (s?.list?.criteria?.text || '').trim()) {
            const saved = await act('criteria', { mode: 'pasted', text: fields.criteria.slice(0, 4000) });
            if (!saved?.ok) return true;
            st.criteriaMode = null; st.criteriaText = null;
          }
          await act('start', { provider: st.provider || s?.read?.provider || 'claude' }, '읽기를 맡겼습니다.');
          return true;
        }
        case 'biz-sel': st.sel = arg; st.edit = null; st.hand = null; st.ask = null; st.startAsk = false; changed(); return true;
        case 'biz-choose': {
          if (st.busy) { st.live = '앞의 일을 하는 중입니다.'; changed(); return true; }
          const [key, kind] = arg.split('|');
          st.sel = key; st.edit = null; st.sheet = false;
          const res = await act('choose', { key, kind });
          if (res?.ok && kind !== 'undo') { st.sel = null; toast(kind === 'keep' ? '그대로 두었습니다.' : '고쳤습니다.', key); changed(); }
          else if (res?.ok) { st.toast = null; changed(); }
          return true;
        }
        case 'biz-edit': st.sel = arg; st.edit = arg; st.editText = null; st.hand = null; changed(); return true;
        case 'biz-edit-cancel': st.edit = null; st.editText = null; changed(); return true;
        case 'biz-edit-save': {
          const text = String(fields.edit ?? '').trim();
          if (!text) { st.live = '고칠 문장을 적어 주세요.'; changed(); return true; }
          st.editText = text;
          const key = st.edit;
          const res = await act('choose', { key, kind: 'edit', text: text.slice(0, 2000) }, '문장을 고쳤습니다.');
          if (res?.ok) { st.edit = null; st.editText = null; st.sel = null; toast('고쳤습니다.', key); changed(); }
          return true;
        }
        case 'biz-hand': st.sel = arg; st.hand = st.hand === arg ? null : arg; st.edit = null; changed(); return true;
        case 'biz-hand-dept': st.handDept = arg; changed(); return true;
        case 'biz-hand-provider': st.handProvider = arg === 'codex' ? 'codex' : 'claude'; changed(); return true;
        case 'biz-hand-send': {
          const key = st.hand;
          const sc = bizplanScene(st.snap, null, st, { departments: st.depts || [] });
          const n = sc.notes?.find(x => x.key === key);
          if (!n?.handing?.dept) { st.live = '맡길 부서를 골라 주세요.'; changed(); return true; }
          const extra = String(fields.extra ?? '').trim().slice(0, 2000);
          const res = await act('handoff', { key, departmentId: n.handing.dept, provider: n.handing.provider, ...(extra ? { extra } : {}) }, '맡겼습니다. 답은 사무실의 업무 카드에 옵니다.');
          if (res?.ok) { st.hand = null; st.sel = null; changed(); }
          return true;
        }
        case 'biz-ask': st.sel = 'i:' + arg; st.ask = st.ask === arg ? null : arg; st.edit = null; st.hand = null; changed(); return true;
        case 'biz-answer': {
          const [item, j, k] = arg.split('|');
          st.answers = { ...st.answers, [item]: Object.assign([...(st.answers[item] || [])], { [Number(j)]: Number(k) }) };
          changed(); return true;
        }
        case 'biz-draft-put': {
          const answers = st.answers[arg] || [];
          const res = await act('draft', { item: arg, answers }, `「${arg}」에 초안을 넣었습니다.`);
          if (res?.ok) { st.ask = null; st.sel = null; changed(); }
          return true;
        }
        case 'biz-draft-remove': st.sel = 'i:' + arg; await act('draft', { item: arg, answers: st.snap?.drafts?.[arg]?.answers || [], remove: true }); return true;
        case 'biz-reanswer': {
          const [item, k] = arg.split('|');
          const had = st.answers[item] || st.snap?.drafts?.[item]?.answers || [];
          st.answers = { ...st.answers, [item]: had.slice(0, Math.max(0, Number(k) || 0)) };
          changed(); return true;
        }
        case 'biz-save': await act('save', {}); return true;
        case 'biz-cancel': {
          if (st.busy) return true;
          st.busy = 'cancel'; changed();
          const my = gen, res = await call('taskAction', arg, 'cancel');
          if (my !== gen) return true;
          st.busy = null; if (res?.ok === false) st.live = say(res.code);
          await load(); return true;
        }
        case 'biz-reveal': await act('reveal', {}); return true;
        /* 한 장씩 보기(14.1): 알약 메뉴, 전체 보기, 앞뒤 장 */
        case 'biz-menu': st.menu = st.menu === arg ? null : (['crit', 'staff'].includes(arg) ? arg : null); changed(); return true;
        case 'biz-sheet': st.sheet = !st.sheet; changed(); return true;
        case 'biz-go': if (st.busy) return true; st.sel = arg; st.sheet = false; st.edit = null; st.hand = null; st.ask = null; changed(); return true;
        /* 직접 쓰기(사업계획서_설계.md 14.2). 쓰는 칸 이름은 장마다 다르다(answer-<장>) */
        case 'biz-write-open': {
          const k = Number(arg);
          if (!Number.isInteger(k) || k < 0 || k > 6) return true;
          const s = st.snap, kept = (s?.read?.notes || []).filter(n => ['fix', 'edit'].includes(n.choice?.kind)).length + Object.keys(s?.drafts || {}).length;
          if (s?.read && kept && !s.saved && st.writeAsk !== k) {
            st.writeAsk = k; st.live = `고른 고침 ${kept}개는 초안을 다시 만들면 다시 읽어야 해서 사라집니다. 먼저 저장하거나, 그래도 쓰려면 「직접 쓰기」를 한 번 더 누르세요.`; changed(); return true;
          }
          Object.assign(st, { write: k, writeAsk: null, writeSeen: [], menu: null, sheet: false, edit: null, hand: null, ask: null });
          changed(); return true;
        }
        case 'biz-write-type': {
          if (st.write == null || Number(arg) !== st.write) return true;
          st.writeText = { ...st.writeText, [st.write]: String(fields['answer-' + st.write] ?? '').slice(0, 4000) };
          return true;
        }
        case 'biz-write-go': {
          const k = Number(arg);
          if (st.write == null || !Number.isInteger(k) || k < 0 || k > 6) return true;
          st.writeText = { ...st.writeText, [st.write]: String(fields['answer-' + st.write] ?? st.writeText[st.write] ?? '') };
          st.write = k; changed(); return true;
        }
        case 'biz-write-next': case 'biz-write-skip': case 'biz-write-later': {
          if (st.write == null || st.busy) return true;
          const q = st.write, text = String(fields['answer-' + q] ?? st.writeText[q] ?? '').slice(0, 4000);
          st.writeText = { ...st.writeText, [q]: text };
          const later = act_ === 'biz-write-later';
          const res = await act('write-save', { chapter: q, text, ...(act_ === 'biz-write-skip' ? { skipped: true } : {}) }, later ? '쓴 데까지 남겨 두었습니다.' : '');
          // 깨진 기록만 「기록 지우기」를 가리킨다. 잠시 읽지 못한 것은 지우게 하지 않는다(GPT 다시 검수 r3 GA2)
          const broken = r => {
            if (!['BROKEN', 'STORAGE'].includes(r?.code)) return;
            if (r.code === 'BROKEN') { st.write = null; st.sel = null; st.live = '쓰던 초안 기록이 깨져 읽지 못했습니다. 아래 「기록 지우기」로 지운 뒤 다시 써 주세요.'; }
            else st.live = '쓰던 초안 기록을 지금 읽지 못했습니다. 쓴 글은 그대로 있으니 잠시 뒤 다시 눌러 주세요.';
            changed();
          };
          if (!res?.ok) { broken(res); return true; }
          // 막대로 옮겨 다니며 쓴 다른 장도 닫거나 초안을 만들기 전에 남긴다(카본 A1)
          const unsaved = () => Object.entries(st.writeText).map(([k, t]) => [Number(k), String(t ?? '')]).filter(([k, t]) => k !== q && k >= 0 && k < 7 && t !== (st.snap?.draft?.chapters?.[k] ?? ''));
          const flush = async () => { for (const [k, t] of unsaved()) { const r = await act('write-save', { chapter: k, text: t.slice(0, 4000) }); if (!r?.ok) { broken(r); return false; } } return true; };
          if (later) { if (await flush()) { st.write = null; st.writeText = {}; st.live = '쓴 데까지 남겨 두었습니다.'; changed(); } return true; }
          // 이번 쓰기에서 지나간 장은 다시 들르지 않는다(r4 P1)
          st.writeSeen = [...new Set([...(st.writeSeen || []), q])];
          const k = nextWrite(q, st.snap?.draft, st.writeText, (st.snap?.read?.empty || []).map(e => e.chapter), st.writeSeen);
          if (k >= 0) { st.write = k; changed(); return true; }
          if (!await flush()) return true;
          const hadRead = !!st.snap?.read, provider = st.provider || st.snap?.read?.provider || 'claude';
          const done = await act('write-done', {}, '사업계획서 초안을 만들었습니다.');
          if (!done?.ok) return true;
          st.write = null; st.writeText = {}; st.sel = null;
          const kept = done.kept ? ' 앞 초안 파일은 그대로 두었습니다.' : '';
          if (done.kept) st.live = '사업계획서 초안을 새로 만들었습니다.' + kept;
          else if (done.edited) st.live = '화면 글이 그대로라, 파일에서 고친 초안을 그대로 계획서로 둡니다.';
          if (hadRead && done.changed) await act('start', { provider }, '초안을 새로 만들어 다시 읽습니다.' + kept);
          changed();
          return true;
        }
        case 'biz-clear-ask': st.clearAsk = !st.clearAsk; changed(); return true;
        case 'biz-clear': st.clearAsk = false; await act('clear', { confirm: true }, '읽은 결과와 고른 것을 지웠습니다.'); return true;
        default: return false;
      }
    },
    reset() { gen += 1; if (timer) clearTimer(timer); if (toastTimer) clearTimer(toastTimer); stopReveal(); timer = null; toastTimer = null; st = fresh(); },
    state: () => st,
  };
}
