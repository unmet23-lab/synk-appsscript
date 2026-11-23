/* 기획부 「사업계획서」 작업 화면의 상태와 동작(사업계획서_설계.md 2, 6절).
   api: window.synkDesktop.office(featureSnapshot, featureAction). 본체가 파일을 고르고 쓰며, 이 방은 이름과 번호만 보낸다.
   한 번에 한 동작만 보낸다. 방을 닫거나 계정이 바뀌면 늦게 온 답을 버린다 */
import { bizplanScene } from './office-bizplan-model.mjs';

const FEATURE = 'bizplan';
const SAY = {
  CANCELLED: '', BUSY: '이미 읽고 있습니다.', PLAN_FORMAT: '한글과 PDF는 아직 읽지 못합니다. Word(.docx)로 저장해 넣어 주세요.',
  DATA_FORMAT: '회사 자료는 txt, md, csv, docx, xlsx 파일을 받습니다.', DATA_COUNT: '회사 자료는 열 개까지 고를 수 있습니다.',
  PLAN_MISSING: '계획서 파일을 찾지 못했습니다. 다시 골라 주세요.', PLAN_CHANGED: '계획서 파일이 읽은 뒤에 바뀌었습니다. 다시 읽은 뒤 저장할 수 있습니다.',
  NOTHING: '바꾼 문장이 없어 저장할 것이 없습니다.', SAVE: '저장하지 못했습니다. 원본은 그대로입니다.', CRITERIA: '평가 항목을 한 줄에 하나씩 적어 주세요.',
  BROKEN: '목록 파일을 읽지 못했습니다. 기록 지우기를 누르면 처음부터 할 수 있습니다.', NOT_FOUND: '그 메모를 찾지 못했습니다. 화면을 다시 읽었습니다.',
  AUTH_CHANGED: '계정이 바뀌어 멈췄습니다.', NOT_AVAILABLE: '이 판에서는 쓸 수 없습니다.', STORAGE_FULL: '업무 기록이 가득 찼습니다.',
};
const say = code => (code in SAY ? SAY[code] : '하지 못했습니다. 잠시 뒤 다시 해 주세요.');

export function createBizplanRoom({ api = null, changed = () => {}, now = () => Date.now(), setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  const fresh = () => ({ departmentId: null, snap: null, busy: null, live: '', sel: null, edit: null, editText: null, hand: null, handDept: null, handProvider: null,
    ask: null, answers: {}, provider: null, criteriaOpen: false, criteriaMode: null, criteriaText: null, clearAsk: false, loadedAt: 0, sig: '' });
  let st = fresh(), gen = 0, timer = null;
  const call = (name, ...a) => { try { return typeof api?.[name] === 'function' ? Promise.resolve(api[name](...a)) : Promise.resolve({ ok: false, code: 'NOT_AVAILABLE' }); } catch { return Promise.resolve({ ok: false }); } };
  let loadSeq = 0;
  async function load() {
    if (!st.departmentId) return;
    const my = gen, dept = st.departmentId, seq = ++loadSeq;
    const snap = await call('featureSnapshot', FEATURE, dept);
    if (my !== gen || st.departmentId !== dept || seq !== loadSeq) return;
    st.snap = snap && typeof snap === 'object' ? snap : { ok: false };
    st.loadedAt = now();
    changed();
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
    if (!running || !st.departmentId) return;
    timer = setTimer(() => { timer = null; void load(); }, 1500);
  }
  return {
    open(departmentId) { gen += 1; st = { ...fresh(), departmentId }; void load(); changed(); },
    close() { gen += 1; if (timer) clearTimer(timer); timer = null; st = fresh(); },
    get departmentId() { return st.departmentId; },
    /* 사무실 판이 바뀔 때(업무 줄의 상태) 기능 판도 다시 읽는다. 읽는 동안은 1.5초마다 진행을 읽는다 */
    scene(task, { departments = [], deptName = '기획부' } = {}) {
      if (!st.departmentId) return null;
      st.depts = departments;
      const sig = task ? task.id + ':' + task.status + ':' + task.updatedAt : '';
      if (sig !== st.sig) { st.sig = sig; if (st.snap) void load(); }
      schedule(task && ['queued', 'running'].includes(task.status));
      return { departmentId: st.departmentId, ...bizplanScene(st.snap, task, st, { departments, deptName }) };
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
          st.criteriaMode = mode;
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
        case 'biz-provider': st.provider = arg === 'codex' ? 'codex' : 'claude'; changed(); return true;
        case 'biz-start': {
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
          const [key, kind] = arg.split('|');
          st.sel = key; st.edit = null;
          await act('choose', { key, kind });
          return true;
        }
        case 'biz-edit': st.sel = arg; st.edit = arg; st.editText = null; st.hand = null; changed(); return true;
        case 'biz-edit-cancel': st.edit = null; st.editText = null; changed(); return true;
        case 'biz-edit-save': {
          const text = String(fields.edit ?? '').trim();
          if (!text) { st.live = '고칠 문장을 적어 주세요.'; changed(); return true; }
          st.editText = text;
          const res = await act('choose', { key: st.edit, kind: 'edit', text: text.slice(0, 2000) }, '종이의 문장을 고쳤습니다.');
          if (res?.ok) { st.edit = null; st.editText = null; }
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
          if (res?.ok) st.hand = null;
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
          if (res?.ok) st.ask = null;
          return true;
        }
        case 'biz-draft-remove': await act('draft', { item: arg, answers: st.snap?.drafts?.[arg]?.answers || [], remove: true }); return true;
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
        case 'biz-clear-ask': st.clearAsk = !st.clearAsk; changed(); return true;
        case 'biz-clear': st.clearAsk = false; await act('clear', { confirm: true }, '읽은 결과와 고른 것을 지웠습니다.'); return true;
        default: return false;
      }
    },
    reset() { gen += 1; if (timer) clearTimer(timer); timer = null; st = fresh(); },
    state: () => st,
  };
}
