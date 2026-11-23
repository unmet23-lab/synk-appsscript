/* 기획부 「사업계획서」 작업 화면의 장면(사업계획서_설계.md 6절). 순수 함수다.
   snap: 본체의 기능 판(office-feature-bizplan.cjs snapshot), task: 이 부서의 가장 최근 기능 업무 줄, ui: 방의 화면 상태 */

const WORD = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
export const countWord = n => (n > 0 && n <= 10 ? WORD[n] : n > 10 && n < 20 ? '열' + WORD[n - 10] : String(n));
const batchim = w => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
export const iga = w => w + (batchim(w) ? '이' : '가');
export const eul = w => w + (batchim(w) ? '을' : '를');
const wa = w => w + (batchim(w) ? '과' : '와');
export const eseo = w => w + '에';
export const eunneun = w => w + (batchim(w) ? '은' : '는');
const kindLabel = { mismatch: '자료와 다른 숫자', unsupported: '근거를 찾지 못한 문장', thin: '빈약한 평가 항목' };

/* 실패 까닭 → 둘째 줄(설계 6절 까닭 표) */
export function reasonText(reason, { provider = 'claude', failedChunks = 0, totalChunks = 0, dataName = '' } = {}) {
  const tool = provider === 'codex' ? 'Codex' : 'Claude Code';
  switch (reason) {
    case 'LIMIT': return '구독 사용량이 다 차서 읽지 못했습니다. 다시 차면 읽을 수 있습니다.';
    case 'LOGIN': return `이 PC의 ${tool}에 로그인이 필요합니다.`;
    case 'NO_CLI': return `이 PC의 ${tool}를 찾지 못했거나 판이 낮습니다. 새 판으로 올린 뒤 다시 읽어 주세요.`;
    case 'PLAN_MISSING': return '계획서 파일을 찾지 못했습니다. 다시 골라 주세요.';
    case 'PLAN_FORMAT': return '한글과 PDF는 아직 읽지 못합니다. Word(.docx)로 저장해 넣어 주세요.';
    case 'PLAN_LOCKED': return '이 파일은 Word 문서로 열리지 않습니다. 암호나 문서 보안이 걸렸으면 풀고 다시 저장해 주세요.';
    case 'PLAN_EMPTY': return '계획서 본문에서 글을 찾지 못했습니다. 글상자에만 쓴 양식이면 본문에 옮겨 주세요.';
    case 'PLAN_TOO_LONG': case 'TOO_BIG': return '계획서가 너무 깁니다. 20만 자, 10MB까지 읽습니다.';
    case 'DATA_MISSING': return `회사 자료 ${dataName ? '「' + dataName + '」' : ''}를 찾지 못했습니다. 빼거나 다시 골라 주세요.`;
    case 'DATA_LOCKED': case 'DATA_FORMAT': return `회사 자료 ${dataName ? '「' + dataName + '」' : ''}를 읽지 못했습니다.`;
    case 'DATA_TOO_BIG': case 'DATA_TOO_LONG': return '회사 자료가 너무 깁니다. 파일 하나에 5MB, 모두 합쳐 40만 자까지 읽습니다.';
    case 'CHUNKS': return `묶음 ${countWord(totalChunks)} 가운데 ${eul(countWord(failedChunks))} 읽지 못했습니다.`;
    case 'LIST': return '목록 파일을 읽지 못했습니다. 기록 지우기를 누르면 처음부터 할 수 있습니다.';
    case 'FOLDER': return '읽는 데 쓰는 폴더가 비어 있지 않습니다. 잠시 뒤 다시 읽어 주세요.';
    default: return '직원이 답을 주지 못했습니다. 다시 읽기로 다시 할 수 있습니다.';
  }
}

export function privacyLine(provider) {
  return provider === 'codex'
    ? '이 PC의 GPT(Codex)로 읽습니다. 계획서와 고른 자료는 OpenAI로 가고 사용량은 내 ChatGPT 구독에서 나갑니다. SYNK로는 보내지 않습니다.'
    : '이 PC의 Claude Code로 읽습니다. 계획서와 고른 자료는 Anthropic으로 가고 사용량은 내 Claude 구독에서 나갑니다. SYNK로는 보내지 않습니다.';
}

/* 메모 하나의 글과 단추 */
function noteView(n, ui, depts) {
  const c = n.choice;
  const state = !c ? 'open' : c.kind === 'handed' ? 'handed' : c.kind === 'keep' ? 'kept' : 'done';
  const done = { fix: '고친 문장으로 바꿨습니다.', edit: '직접 고쳤습니다.', keep: '그대로 둡니다.' }[c?.kind] ||
    (c?.kind === 'handed' ? `${eseo(depts.find(d => d.id === c.departmentId)?.name || '다른 부서')} 맡겼습니다.` : '');
  const acts = [];
  if (state === 'open') {
    // 근거 없는 문장도 고친 문장이 있으면 넣을 수 있다. 보이기만 하고 단추가 없던 것(11-23 앱 창 확인)
    if (n.fix && n.canReplace) acts.push(['고친 문장으로 바꾸기', 'biz-choose', n.key + '|fix', 'main']);
    if (n.canReplace) acts.push(['직접 고치기', 'biz-edit', n.key, '']);
    if (n.kind === 'unsupported' && depts.length) acts.push(['만들어서 사실로 맡기기', 'biz-hand', n.key, '']);
    acts.push(['그대로 두기', 'biz-choose', n.key + '|keep', 'quiet']);
  } else if (state !== 'handed') acts.push(['되돌리기', 'biz-choose', n.key + '|undo', 'quiet']);
  return {
    key: n.key, kind: n.kind, label: kindLabel[n.kind], what: n.why, quote: n.quote, fix: n.fix,
    evidence: n.evidence ? { text: n.evidence, from: n.sourceName } : null,
    locked: !n.canReplace ? '이 문장은 표나 필드에 걸쳐 있어 Word에서 직접 고쳐 주세요.' : '',
    state, done, acts, sel: ui.sel === n.key,
    editing: ui.edit === n.key ? { text: ui.editText ?? (c?.kind === 'edit' ? c.text : n.fix || n.quote) } : null,
    handing: ui.hand === n.key ? { text: n.handoff, depts: depts.map(d => [d.name, d.id]), dept: ui.handDept || (depts.find(d => /개발/.test(d.name)) || depts[0])?.id || '', provider: ui.handProvider || 'claude' } : null,
  };
}

/* 빈약한 평가 항목 메모(같이 쓰기) */
function itemView(it, ui, drafts) {
  const draft = drafts[it.item];
  const asking = ui.ask === it.item;
  const answers = ui.answers?.[it.item] || draft?.answers || [];
  return {
    key: 'i:' + it.item, kind: 'thin', label: kindLabel.thin, what: it.why, item: it.item,
    state: draft ? 'done' : 'open', done: draft ? `「${it.item}」에 초안을 넣었습니다.` : '',
    sel: ui.sel === 'i:' + it.item,
    acts: draft ? [['초안 빼기', 'biz-draft-remove', it.item, 'quiet']] : it.asks.length ? [['같이 쓰기', 'biz-ask', it.item, 'main']] : [],
    asking: asking ? {
      asks: it.asks.map((a, j) => ({ q: a.q, opts: a.opts.map((o, k) => [o.label, `${it.item}|${j}|${k}`, answers[j] === k]) })),
      draft: it.asks.every((_, j) => Number.isInteger(answers[j])) ? it.asks.map((a, j) => a.opts[answers[j]].sentence).join(' ') : '',
      ready: it.asks.every((_, j) => Number.isInteger(answers[j])),
    } : null,
    draft: draft?.text || '',
  };
}

/* 종이 위 문단: 고른 고침을 그 자리에 넣어 보인다 */
function paperOf(read, notes, drafts, progress, reading) {
  const byPara = new Map();
  for (const n of read.notes) { if (!byPara.has(n.para)) byPara.set(n.para, []); byPara.get(n.para).push(n); }
  const lit = reading && progress ? Math.max(0, (progress.part || 1) - 1) : null;
  const secs = read.sections.map((s, si) => {
    const paras = s.paras.map(i => {
      let text = read.paragraphs[i]?.text || '';
      const ns = (byPara.get(i) || []).slice().sort((a, b) => b.from - a.from);
      let changed = false;
      for (const n of ns) {
        const c = n.choice;
        const next = c?.kind === 'fix' ? n.fix : c?.kind === 'edit' ? c.text : null;
        if (next) { text = text.slice(0, n.from) + next + text.slice(n.to); changed = true; }
      }
      const mark = (byPara.get(i) || []).map(n => n.key);
      return { i, text, changed, notes: mark, inTable: !!read.paragraphs[i]?.inTable };
    });
    const item = read.items.find(it => it.secs.includes(s.id) && drafts[it.item]);
    const last = item && Math.max(...read.sections.filter(x => item.secs.includes(x.id)).map(x => x.id)) === s.id;
    return { id: s.id, title: s.title, paras, draft: last ? drafts[item.item].text : '', has: paras.some(p => p.notes.length), dim: lit != null && si > lit, on: lit != null && si === lit };
  });
  return { secs };
}

/* 장면 */
export function bizplanScene(snap, task, ui = {}, { departments = [], deptName = '기획부' } = {}) {
  const depts = departments.filter(d => d && d.id !== ui.departmentId).map(d => ({ id: d.id, name: d.name }));
  if (!snap || snap.ok === false) {
    if (snap?.ok === false && snap.code !== 'NOT_AVAILABLE')
      return { stage: 'error', head: ['사업계획서 기록을 읽지 못했습니다.', '기록 지우기를 누르면 처음부터 할 수 있습니다. 계획서와 회사 자료 파일은 그대로 둡니다.'], back: '← 사무실', live: ui.live || '', busy: ui.busy || null, clearAsk: !!ui.clearAsk };
    return { stage: 'loading', head: [snap?.code === 'NOT_AVAILABLE' ? '이 판에서는 사업계획서 기능을 쓸 수 없습니다.' : '사업계획서를 여는 중입니다.', ''], back: '← 사무실', live: ui.live || '' };
  }
  const read = snap.read;
  const running = task && ['queued', 'running', 'terminal', 'paused'].includes(task.status);
  const provider = ui.provider || read?.provider || task?.provider || 'claude';
  const base = {
    back: '← 사무실', provider, privacy: privacyLine(provider), live: ui.live || '', busy: ui.busy || null,
    list: snap.list, broken: !!snap.broken, planChanged: !!snap.planChanged && !running,
    criteria: { mode: ui.criteriaMode || snap.list.criteria.mode, text: ui.criteriaText ?? snap.list.criteria.text, open: !!ui.criteriaOpen },
    clearAsk: !!ui.clearAsk,
  };
  if (running) {
    const reading = task.status === 'running';
    const p = snap.progress && snap.progress.taskId === task.id ? snap.progress : null;
    return {
      ...base, stage: reading ? 'reading' : 'waiting',
      head: reading ? [`${iga(deptName)} 계획서를 읽고 있습니다.`, p ? `${p.total}번 가운데 ${p.part}번째 · ${p.title}` : '종이에서 어디까지 읽었는지 보입니다.'] : ['자리가 비면 읽습니다.', `앞에 맡긴 일이 끝나면 ${deptName} 직원이 읽기 시작합니다.`],
      paper: read && read.status !== 'failed' && read.plan?.samePlan ? paperOf({ ...read, notes: [] }, [], {}, p, reading) : null,
      planName: snap.list.plan?.name || '', progress: p, taskId: task.id,
    };
  }
  const taskNewer = task && read ? task.updatedAt > read.at + 1000 : !!task;
  if (task && taskNewer && task.status === 'interrupted') {
    return { ...base, stage: 'stopped', head: ['읽기를 멈췄습니다.', '다시 읽기를 누르면 처음부터 읽습니다.'], paper: null };
  }
  if (task && taskNewer && task.status === 'failed') {
    return { ...base, stage: 'failed', head: ['이번에는 읽지 못했습니다.', reasonText(task.reason, { provider: task.provider })], paper: null };
  }
  if (!read) {
    // 계획서를 고른 뒤에도 「넣어 주세요」가 남던 것(11-23 앱 창 확인). 고른 뒤에는 다음에 누를 것을 말한다
    const dataCount = snap.list.data?.length || 0;
    const head = !snap.list.plan ? ['사업계획서 파일을 넣어 주세요.', '회사 자료와 견주어 다른 숫자와 빠진 내용을 짚고, 고친 문장을 새 파일로 저장합니다.']
      : dataCount ? ['「읽기 시작」을 누르면 읽습니다.', `계획서를 회사 자료 ${wa(countWord(dataCount))} 견주어 읽습니다. 몇 분 걸립니다.`]
      : ['회사 자료를 더하면 숫자까지 견줍니다.', '자료 없이 읽으면 근거 없는 문장과 빈약한 평가 항목만 짚습니다.'];
    return { ...base, stage: 'start', head, paper: null };
  }
  if (read.status === 'failed') {
    return { ...base, stage: 'failed', head: ['이번에는 읽지 못했습니다.', reasonText(read.reason, { provider: read.provider, failedChunks: read.failedChunks, totalChunks: read.totalChunks, dataName: read.dataName })], paper: null };
  }
  const drafts = snap.drafts || {};
  const notes = read.notes.map(n => noteView(n, ui, depts));
  const thin = read.items.filter(it => it.thin).map(it => itemView(it, ui, drafts));
  const all = [...notes, ...thin];
  const open = all.filter(n => n.state === 'open').length;
  const sel = ui.sel && all.some(n => n.key === ui.sel) ? ui.sel : all.find(n => n.state === 'open')?.key || all[0]?.key || null;
  for (const n of all) n.sel = n.key === sel;
  const items = read.items.filter(it => !it.unread).map(it => ({ item: it.item, state: it.thin ? '약함' : '있음', secs: it.secs }));
  const unreadItems = read.items.filter(it => it.unread).length;
  const changes = read.notes.filter(n => ['fix', 'edit'].includes(n.choice?.kind)).length + Object.keys(drafts).length;
  const partial = read.status === 'partial' ? `묶음 ${countWord(read.totalChunks)} 가운데 ${eunneun(countWord(read.failedChunks))} 읽지 못했습니다. 다시 읽으면 그 묶음도 봅니다.` : '';
  let head;
  if (snap.saved) head = ['고친 계획서를 새 파일로 저장했습니다.', `원본은 그대로 두고 같은 폴더에 고친 판을 만들었습니다.${snap.saved.skipped ? ` 바꿀 수 없는 고침 ${eunneun(countWord(snap.saved.skipped))} 빼고 저장했습니다.` : ''}`];
  else if (!all.length) head = [read.dataNames.length ? '회사 자료와 다른 숫자를 찾지 못했습니다.' : '회사 자료 없이 읽어 숫자는 견주지 않았습니다.',
    partial || (unreadItems ? `평가 항목 ${eunneun(countWord(unreadItems))} 읽지 못했습니다.` : `평가 항목 ${countWord(items.length)} 모두 계획서에 있습니다.`)];
  else if (open) head = [`고칠 곳이 ${countWord(open)} 있습니다.`, partial || '메모를 하나씩 보고 고치면 새 파일로 저장할 수 있습니다.'];
  else head = ['고를 것을 다 골랐습니다.', changes ? '새 파일로 저장하면 원본 옆에 고친 판이 생깁니다.' : '바꾼 문장이 없어 저장할 것이 없습니다.'];
  return {
    ...base, stage: 'notes', head, notes: all, sel, items, changes, saved: snap.saved || null,
    planName: read.plan.name, samePlan: read.plan.samePlan, dataNames: read.dataNames,
    paper: paperOf(read, notes, drafts, null, false),
  };
}

/* 사무실의 부서 안쪽 기능 줄(기능줄_경쟁사_설계.md 6.3과 같은 꼴): 한 문장과 때 */
export function bizplanLine(task, now = Date.now()) {
  const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  if (!task) return { line: '계획서를 넣으면 회사 자료와 견주어 고칠 곳을 짚어 드립니다', when: '시작' };
  if (task.status === 'queued') return { line: '자리가 비면 읽습니다', when: '기다림' };
  if (task.status === 'running') return { line: '계획서를 읽고 있습니다', when: '읽는 중' };
  if (task.status === 'completed') return { line: task.answer.replace(/\.$/, ''), when: hm(task.updatedAt) + ' 읽음', alert: !!task.featureAlert };
  if (task.status === 'interrupted') return { line: '읽기를 멈췄습니다', when: '다시 읽기' };
  return { line: '이번에는 읽지 못했습니다', when: '다시 읽기' };
}
export const attachesBizplan = dept => /기획/.test(String(dept?.name || ''));
