// PATH 「물어보기」 · 「사람에게 연결」 · 「내 상담」의 앱 쪽 조정자. app.mjs가 자기 상태(S) · 그리기 · 화면 옮기기 · 계정 세션을 넘겨 만든다.
// 이 파일은 창 전역(confirm · crypto · fetch)을 직접 쓰지 않고 넘겨받은 것만 쓴다(app.test.mjs의 가짜 DOM에서도 같은 코드가 돈다).
// 대화는 이 탭(sessionStorage)에 가린 글로만 두고, 계정이 바뀌거나 로그아웃하면 지운다. 서버가 준 AI 차례는 서명째 그대로 둔다.
import { allAskSources, askSourceIndex } from './ask-sources.mjs';
import {
  createAskStore, askBody, askOutcome, askProfile, briefBody, briefOutcome, briefExpired, briefDraft, briefEdits, editsProblem, briefEditBody, editsWithKo,
  handoffCase, urgentCase, teenCase, teenReady, caseConversation, caseMessage, readCases, openCases, screenTarget, opensHandoff, maskedQuestion,
  WORKSPACE_CASES_PATH, MAX_QUESTION_CHARS, BRIEF_TURNS
} from './ask-flow.mjs';
import { renderAsk, renderBrief, renderCases, renderCaseMarker, M } from './ask-ui.mjs';

const KNOWN_KEY = 'synk-path-cases-known';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const freshUrgent = () => ({ open: false, agree: false, guardian: false, last: false, phase: 'idle' });
const freshTeen = () => ({ kind: null, note: '', guardian: false, agree: false, phase: 'edit', error: null });
/** Workspace 오류 코드를 화면 안내 열쇠로. */
export function caseErrorKey(err) {
  const code = err?.code || '';
  if (code === 'CASE_OPEN_EXISTS' || err?.status === 409) return 'caseOpen';
  if (code === 'CASE_LIMIT' || code === 'CASE_WEEKLY_LIMIT' || err?.status === 429) return 'caseLimit';
  if (code === 'PATH_CASES_CLOSED' || err?.status === 503) return 'closed';
  if (code === 'CASE_TICKET_EXPIRED' || code === 'CASE_TICKET_USED') return 'expired';
  return 'caseFail';
}

/**
 * @param d { S, root, session, render(focus), go(page), say(text), page(), lang(), confirm(text), uuid(), now(), storage, rAF?,
 *   studyProfile(), programs, posts, studyOn, channelOn, pathPick(id), officialHtml() }
 */
export function createAskController(d) {
  const store = createAskStore(d.storage);
  let ask = null, urgent = freshUrgent(), teen = null, brief = null, cases = null, wsOpen = null, wsAsking = false, off = false, langFrom = null, teenFrom = null;
  let sources = null;
  const index = () => (sources ||= askSourceIndex(allAskSources()));
  const owner = () => { const st = d.session.status(); return st.signedIn && st.accountId ? st.accountId : null; };
  const uiLang = () => (d.lang() === 'en' ? 'en' : 'ko');
  const P = (a) => (uiLang() === 'en' ? a[1] : a[0]);
  const q = (sel) => d.root.querySelector(sel);
  const focus = (...sels) => { for (const s of sels) { const el = s && q(s); if (el && !el.disabled) { el.focus(); return; } } };
  const known = () => { try { return d.storage?.getItem(KNOWN_KEY) === owner() && owner() !== null; } catch { return false; } };
  const markKnown = () => { try { if (owner()) d.storage?.setItem(KNOWN_KEY, owner()); } catch { /* 이 탭만 모른다 */ } };
  const program = (id) => d.programs.find((p) => p.id === id) || null;
  const validTopic = (id) => (id && program(id) ? id : null);

  /** 지금 계정의 물어보기 상태. 계정이 바뀌거나 로그아웃하면 이 탭의 대화와 넘김 요약을 지운다. */
  function cur() {
    const o = owner();
    if (!ask || ask.owner !== o) {
      const switched = ask !== null && ask.owner !== null && ask.owner !== o;
      if (switched) { store.clear(); brief = null; teen = null; cases = null; urgent = freshUrgent(); try { d.storage?.removeItem(KNOWN_KEY); } catch { /* 위와 같음 */ } }
      const rec = o ? store.load(o) : null;
      ask = { owner: o, lang: rec?.lang || uiLang(), age: rec?.age ?? null, consent: rec?.consent === true, agree: false, withProfile: rec?.withProfile ?? true,
        turns: rec?.turns || [], topic: switched ? null : ask?.topic ?? null, text: '', phase: 'idle', notice: switched || (ask?.notice === 'account' && !ask.turns.length) ? 'account' : null, error: null, remaining: null, seq: 0 };
    }
    return ask;
  }
  const save = () => { if (ask?.owner) store.save(ask.owner, ask); };
  const lastStudent = () => {
    const a = cur(), typed = maskedQuestion(a.text);
    if (typed) return typed;
    for (let i = a.turns.length - 1; i >= 0; i--) if (a.turns[i].role === 'student') return a.turns[i].text;
    return '';
  };
  /** 젤리 알약을 앞 자리에서 지금 자리로 옮긴다(다음 그림에서). */
  function slide() {
    const run = () => d.root.querySelectorAll('.sx-jelly').forEach((j) => { const to = j.getAttribute('data-to'); if (to !== null) j.setAttribute('data-at', to); });
    if (d.rAF) d.rAF(run); else run();
    langFrom = null; teenFrom = null;
  }

  /* ── 화면 자리 풀기 ── */
  function canOpen(screen) {
    const t = screenTarget(screen);
    if (!t) return false;
    if (t.page === 'univDetail') return d.studyOn && !!program(t.id);
    if (t.page === 'post') return d.channelOn && d.posts.some((p) => p.id === t.id);
    if (t.page === 'path') return d.studyOn && (t.id === null || !!program(t.id));
    return true;
  }
  function openScreen(screen) {
    const t = screenTarget(screen);
    if (!t || !canOpen(screen)) return;
    if (t.page === 'univDetail') { d.S.univId = t.id; d.go('univDetail'); return; }
    if (t.page === 'post') { d.S.postId = t.id; d.go('post'); return; }
    if (t.page === 'path' && t.id) {
      if (d.studyProfile().target !== t.id) d.pathPick(t.id);
      if (d.studyProfile().target === t.id) d.go('path');
      return;
    }
    d.go(t.page);
  }

  /* ── Workspace ── */
  function askStatus() {
    if (wsAsking || wsOpen !== null || !owner()) return;
    wsAsking = true;
    Promise.resolve().then(() => d.session.workspaceStatus()).then((v) => v === true, () => false).then((v) => { wsOpen = v; wsAsking = false; d.render(false); });
  }
  // quiet: 목록이 이미 있으면 그대로 보이며 뒤에서 다시 불러온다(글 칸 · 보내는 중인 글을 건드리지 않는다).
  async function loadCases({ quiet = false } = {}) {
    const o = owner();
    if (!o) return;
    const keep = cases && cases.owner === o ? cases : null;
    // 보내는 중 표시와 요청 번호는 같은 것을 잇는다(다시 불러오는 사이에 같은 글이 두 번 가지 않게).
    const c = cases = { owner: o, phase: quiet && keep?.phase === 'ok' ? 'ok' : 'loading', refreshing: true, list: keep?.list || [], note: keep?.note ?? null,
      text: keep?.text || {}, sending: keep?.sending || {}, rids: keep?.rids || {}, at: d.now() };
    let list = null;
    try { list = readCases(await d.session.workspace('GET', WORKSPACE_CASES_PATH)); } catch { list = null; }
    c.refreshing = false;
    if (cases !== c || owner() !== o) return;
    if (list) { c.list = list; c.phase = 'ok'; if (openCases(list).length) markKnown(); } else if (!(quiet && c.phase === 'ok')) c.phase = 'error';
    d.render(false);
  }
  const casePath = (id, tail = '') => (UUID_RE.test(id) ? `${WORKSPACE_CASES_PATH}/${id}${tail}` : null);

  /* ── 물어보기 ── */
  async function send() {
    const a = cur();
    if (a.phase === 'sending' || !owner() || a.age !== 'adult' || !a.consent) return;
    const masked = maskedQuestion(a.text);
    if (!masked) { a.error = 'empty'; d.render(false); focus('#ask-text'); d.say(P(M.empty)); return; }
    if ([...masked].length > MAX_QUESTION_CHARS) { a.error = 'long'; d.render(false); focus('#ask-text'); d.say(P(M.long)); return; }
    let body;
    try { body = askBody({ requestId: d.uuid(), lang: a.lang, question: a.text, entries: a.turns, profile: a.withProfile ? askProfile(d.studyProfile()) : null, topic: validTopic(a.topic) }); }
    catch { a.notice = 'failed'; d.render(false); focus('#ask-notice'); d.say(P(M.failed)); return; }
    const seq = ++a.seq;
    Object.assign(a, { phase: 'sending', error: null, notice: null });
    d.render(false); focus('#ask-wait'); d.say(P(M.waiting));
    let reply = null, failed = null;
    try { reply = await d.session.translate(body); } catch (err) { failed = err; }
    if (ask !== a || a.seq !== seq) return;
    const out = askOutcome(reply, failed, body.question);
    a.phase = 'idle';
    if (out.remaining !== null) a.remaining = out.remaining;
    if (out.keep) { a.turns.push({ role: 'student', text: body.question }, out.entry); a.turns = a.turns.slice(-BRIEF_TURNS * 2); a.text = ''; }
    a.notice = out.notice;
    if (out.off) off = true;
    if (out.openCard) urgent.open = true;
    save();
    d.render(false);
    if (out.openCard) { focus('#ask-urgent-h'); d.say(q('#ask-urgent-h')?.textContent || ''); }
    else if (out.notice) { focus('#ask-notice', '#ask-title'); d.say(P(M[out.notice] || M.failed)); }
    else { focus('#ask-text'); d.say(uiLang() === 'en' ? 'The answer is ready.' : '답이 왔어요.'); }
  }

  /* ── 넘김 요약 ── */
  /** 넘김 요약 · 고친 줄에서 서버가 급함 고정 문안을 내면, 요약 쪽을 닫고 물어보기로 돌아가 위험해요 카드를 연다. */
  function toUrgent() {
    brief = null; urgent.open = true;
    d.go('ask');
    focus('#ask-urgent-h'); d.say(q('#ask-urgent-h')?.textContent || '');
  }
  async function fetchBrief() {
    const a = cur(), b = brief;
    if (!b) return;
    const seq = ++b.seq;
    Object.assign(b, { phase: 'loading', got: null, draft: null, notice: null, agree: false });
    let body;
    try { body = briefBody({ requestId: d.uuid(), lang: a.lang, kind: b.kind, entries: a.turns, profile: a.withProfile ? askProfile(d.studyProfile()) : null, topic: validTopic(a.topic) }); }
    catch { b.phase = 'failed'; b.notice = 'failed'; d.render(false); focus('#brief-notice'); return; }
    d.render(false); focus('#brief-wait'); d.say(P(M.bLoading));
    let reply = null, failed = null;
    try { reply = await d.session.translate(body); } catch (err) { failed = err; }
    if (brief !== b || b.seq !== seq || ask !== a) return;
    const out = briefOutcome(reply, failed, d.now());
    if (out.urgent) { toUrgent(); return; }
    if (out.notice) { b.phase = 'failed'; b.notice = out.notice; d.render(false); focus('#brief-notice', '#brief-title'); d.say(P(M[out.notice] || M.failed)); return; }
    Object.assign(b, { phase: 'ready', got: out, draft: briefDraft(out.brief.student) });
    d.render(false); focus('#brief-title'); d.say(P(M.bTitle));
  }
  const programFor = () => validTopic(cur().topic) || validTopic(d.studyProfile().target);
  async function sendBrief() {
    const a = cur(), b = brief;
    if (!b || !b.got || b.phase === 'sending' || !b.agree || wsOpen !== true) return;
    if (briefExpired(b.got, d.now())) { d.render(false); focus('#brief-notice'); d.say(P(M.expired)); return; }
    const edits = briefEdits(b.got.brief.student, b.draft), problem = editsProblem(edits);
    if (problem) { b.notice = problem; d.render(false); focus('#brief-notice'); d.say(P(M[problem])); return; }
    const seq = ++b.seq;
    b.phase = 'sending'; b.notice = null;
    d.render(false); focus('#brief-wait'); d.say(P(M.cSending));
    const stale = () => brief !== b || b.seq !== seq || ask !== a;
    let full, edReply = null;
    try {
      // 학생 말이 한국어면 옮기지 않는다(넘김 요약 몫을 아낀다).
      edReply = a.lang !== 'ko' && edits.some((e) => e.text) ? await d.session.translate(briefEditBody({ requestId: d.uuid(), lang: a.lang, edits })) : null;
      full = editsWithKo(edits, a.lang, edReply);
    } catch {
      if (stale()) return;
      if (edReply?.status === 'urgent') { toUrgent(); return; }
      b.phase = 'ready'; b.notice = 'editFail'; d.render(false); focus('#brief-notice'); d.say(P(M.editFail)); return;
    }
    if (stale()) return;
    if (briefExpired(b.got, d.now())) { b.phase = 'ready'; d.render(false); focus('#brief-notice'); d.say(P(M.expired)); return; }
    const prog = programFor();
    let body;
    try {
      body = handoffCase({ requestId: d.uuid(), lang: a.lang, got: b.got, edits: full, note: b.note,
        conversation: b.with.conversation ? caseConversation(a.turns) : null, profile: b.with.profile ? askProfile(d.studyProfile()) : null, program: b.with.program ? prog : null });
    } catch { b.phase = 'ready'; b.notice = 'caseFail'; d.render(false); focus('#brief-notice'); d.say(P(M.caseFail)); return; }
    let failed = null;
    try { await d.session.workspace('POST', WORKSPACE_CASES_PATH, body); } catch (err) { failed = err; }
    if (stale()) return;
    if (failed) { b.phase = 'ready'; b.notice = caseErrorKey(failed); d.render(false); focus('#brief-notice'); d.say(P(M[b.notice])); return; }
    b.phase = 'sent'; markKnown(); cases = null;
    d.render(false); focus('#brief-sent'); d.say(P(M.cSent));
  }

  const actions = {
    askOpen() {
      const a = cur(), page = d.page();
      // 내 길 · 대학 자세히에서 열면 그 과정을 주제로 미리 잡는다.
      if (page === 'univDetail' && validTopic(d.S.univId)) a.topic = d.S.univId;
      else if (page === 'path' && validTopic(d.studyProfile().target)) a.topic = d.studyProfile().target;
      d.go('ask');
    },
    askUrgent() {
      urgent.open = !urgent.open;
      if (!urgent.open && urgent.phase !== 'sending') urgent = { ...freshUrgent() };
      d.render(false);
      if (urgent.open) { focus('#ask-urgent-h'); d.say(q('#ask-urgent-h')?.textContent || ''); } else focus('[data-action="askUrgent"]');
    },
    askStart() {
      const a = cur();
      if (!a.agree || a.age !== 'adult') return;
      a.consent = true; save(); d.render(false); focus('#ask-text');
    },
    askAgeReset() { const a = cur(); if (a.phase === 'sending') return; a.age = null; save(); d.render(false); focus('#ask-age-adult'); },
    askLang(el) {
      const a = cur(), id = el.dataset.id;
      if (!['ko', 'en', 'mn'].includes(id) || id === a.lang) return;
      langFrom = a.lang; a.lang = id; save(); d.render(false); slide(); focus(`[data-action="askLang"][data-id="${id}"]`);
    },
    askTopicOff() { cur().topic = null; d.render(false); focus('#ask-text'); },
    askSend: () => send(),
    askClear() {
      const a = cur();
      if (a.phase === 'sending' || !a.turns.length) return;
      if (!d.confirm(uiLang() === 'en' ? 'Clear the conversation in this tab? It is not stored anywhere, so it cannot be restored.' : '이 탭의 대화를 지울까요? 어디에도 저장하지 않아 되돌릴 수 없어요.')) return;
      a.turns = []; a.notice = 'cleared'; brief = null; save(); d.render(false); focus('#ask-notice'); d.say(P(M.cleared));
    },
    askScreen(el) { const it = index().get(el.dataset.id); if (it) openScreen(it.screen); },
    askHandoff(el) {
      const a = cur(), e = a.turns[Number(el.dataset.id)];
      if (!e || e.role !== 'ai' || !opensHandoff(e.kind) || wsOpen !== true) return;
      const prog = programFor();
      brief = { kind: e.kind, phase: 'loading', got: null, draft: null, notice: null, note: '', agree: false, seq: 0,
        with: { conversation: false, profile: a.withProfile && askProfile(d.studyProfile()) !== null, program: prog !== null } };
      d.go('askBrief');
      return fetchBrief();
    },
    askBriefLeave() {
      if (brief?.phase === 'ready' && brief.got && briefEdits(brief.got.brief.student, brief.draft).length
        && !d.confirm(uiLang() === 'en' ? 'Leaving deletes this summary and your edits. Leave?' : '떠나면 이 요약과 고친 줄이 지워져요. 떠날까요?')) return;
      brief = null; d.go('ask');
    },
    askBriefRetry: () => fetchBrief(),
    briefRemove(el) {
      const b = brief, f = el.dataset.id, i = Number(el.dataset.value);
      if (!b?.draft || b.phase === 'sending') return;
      if (f === 'situation' || f === 'wants') b.draft[f].removed = true;
      else if (b.draft[f]?.[i]) { if (b.draft[f][i].index === null) b.draft[f].splice(i, 1); else b.draft[f][i].removed = true; }
      d.render(false); focus(`[data-action="briefRestore"][data-id="${f}"][data-value="${f === 'situation' || f === 'wants' ? 0 : i}"]`, `#brief-${f}-h`);
    },
    briefRestore(el) {
      const b = brief, f = el.dataset.id, i = Number(el.dataset.value);
      if (!b?.draft || b.phase === 'sending') return;
      if (f === 'situation' || f === 'wants') b.draft[f].removed = false; else if (b.draft[f]?.[i]) b.draft[f][i].removed = false;
      d.render(false); focus(`#brief-${f}-${f === 'situation' || f === 'wants' ? 0 : i}`);
    },
    briefAdd(el) {
      const b = brief, f = el.dataset.id;
      if (!b?.draft || b.phase === 'sending' || !['open', 'task'].includes(f)) return;
      b.draft[f].push({ index: null, text: '', removed: false });
      d.render(false); focus(`#brief-${f}-${b.draft[f].length - 1}`);
    },
    briefSend: () => sendBrief(),
    async urgentSend() {
      const a = cur(), u = urgent;
      if (!owner() || wsOpen !== true || !['adult', 'teen'].includes(a.age) || !u.agree || (a.age === 'teen' && !u.guardian) || u.phase === 'sending') return;
      let body;
      try { body = urgentCase({ requestId: d.uuid(), lang: a.lang, age: a.age, guardian: a.age === 'teen' && u.guardian === true, last: u.last ? lastStudent() : null }); }
      catch { u.phase = 'failed'; d.render(false); return; }
      u.phase = 'sending'; d.render(false); d.say(P(M.urgentSending));
      let failed = null;
      try { await d.session.workspace('POST', WORKSPACE_CASES_PATH, body); } catch (err) { failed = err; }
      if (urgent !== u) return;
      u.phase = failed ? 'failed' : 'sent';
      if (!failed) { markKnown(); cases = null; }
      d.render(false); focus('#urgent-sent', '#ask-urgent-h'); d.say(P(failed ? M.urgentFail : M.urgentSent));
    },
    teenKind(el) {
      const t = teen ||= freshTeen(), id = el.dataset.id;
      if (!['act', 'synk'].includes(id) || t.phase === 'sending') return;
      teenFrom = t.kind; t.kind = id; d.render(false); slide(); focus(`[data-action="teenKind"][data-id="${id}"]`);
    },
    async teenSend() {
      const a = cur(), t = teen;
      if (!owner() || a.age !== 'teen' || wsOpen !== true || !teenReady(t)) return;
      let body;
      try { body = teenCase({ requestId: d.uuid(), lang: a.lang, kind: t.kind, note: t.note }); }
      catch { t.error = 'caseFail'; d.render(false); return; }
      t.phase = 'sending'; t.error = null; d.render(false); d.say(P(M.cSending));
      let failed = null;
      try { await d.session.workspace('POST', WORKSPACE_CASES_PATH, body); } catch (err) { failed = err; }
      if (teen !== t) return;
      if (failed) { t.phase = 'edit'; t.error = caseErrorKey(failed); d.render(false); focus('[data-action="teenSend"]'); d.say(P(M[t.error])); return; }
      t.phase = 'sent'; markKnown(); cases = null; d.render(false); focus('#teen-h'); d.say(P(M.cSent));
    },
    casesLoad: () => loadCases(),
    async caseRead(el) {
      const path = casePath(el.dataset.id, '/read');
      if (!path) return;
      try { await d.session.workspace('POST', path, {}); } catch { /* 읽음 표시만 못 했다. 다음에 다시 */ }
      return loadCases();
    },
    async caseSend(el) {
      const id = el.dataset.id, path = casePath(id, '/messages');
      if (!path || !cases) return;
      // 보내는 동안은 다시 누르지 못하고, 같은 글을 다시 보내면 같은 요청 번호를 쓴다(서버가 한 번만 받는다).
      cases.sending ||= {}; cases.rids ||= {};
      if (cases.sending[id]) return;
      const text = cases.text[id] || '';
      if (!cases.rids[id] || cases.rids[id].text !== text) cases.rids[id] = { text, rid: d.uuid() };
      let body;
      try { body = caseMessage({ requestId: cases.rids[id].rid, text }); } catch { return; }
      const c = cases; c.sending[id] = true; el.disabled = true;
      try { await d.session.workspace('POST', path, body); c.text[id] = ''; c.note = null; delete c.rids[id]; }
      catch { c.note = 'moreFail'; c.sending[id] = false; d.render(false); focus(`#case-text-${id}`); d.say(P(M.moreFail)); return; }
      c.sending[id] = false;
      return loadCases();
    },
    async caseDelete(el) {
      const id = el.dataset.id, path = casePath(id);
      if (!path || !cases) return;
      if (!d.confirm(`${P(M.delNote)} ${uiLang() === 'en' ? 'Delete it?' : '지울까요?'}`)) return;
      try { await d.session.workspace('DELETE', path); cases.note = 'deleted'; }
      catch { cases.note = 'delFail'; d.render(false); d.say(P(M.delFail)); return; }
      d.say(P(M.deleted));
      return loadCases();
    }
  };

  /** 체크 · 고르기(change). 맡은 것이면 true. */
  function change(el) {
    const a = el?.dataset?.action;
    if (!a) return false;
    const keep = () => { const id = el.id; d.render(false); if (id) focus('#' + id); };
    if (a === 'askAge') { const x = cur(); if (['adult', 'teen', 'under14'].includes(el.value) && x.phase !== 'sending') { x.age = el.value; if (x.age === 'teen' && !teen) teen = freshTeen(); save(); } keep(); return true; }
    if (a === 'askAgree') { cur().agree = !!el.checked; keep(); return true; }
    if (a === 'askProfile') { const x = cur(); if (x.phase !== 'sending') { x.withProfile = !!el.checked; save(); } keep(); return true; }
    if (['urgentAgree', 'urgentGuardian', 'urgentLast'].includes(a)) { if (urgent.phase !== 'sending') urgent[{ urgentAgree: 'agree', urgentGuardian: 'guardian', urgentLast: 'last' }[a]] = !!el.checked; keep(); return true; }
    if (a === 'teenGuardian' || a === 'teenAgree') { const t = teen ||= freshTeen(); if (t.phase !== 'sending') t[a === 'teenGuardian' ? 'guardian' : 'agree'] = !!el.checked; keep(); return true; }
    if (a === 'briefWith') { if (brief?.with && brief.phase !== 'sending' && Object.hasOwn(brief.with, el.dataset.id)) brief.with[el.dataset.id] = !!el.checked; return true; }
    if (a === 'briefAgree') { if (brief && brief.phase !== 'sending') brief.agree = !!el.checked; keep(); return true; }
    return false;
  }
  /** 글 칸(input). 다시 그리지 않고 상태와 단추만 고친다(한글 · 키릴 입력 중에 칸을 덮지 않게). */
  function input(el) {
    const a = el?.dataset?.action;
    if (a === 'askText') {
      const x = cur();
      if (x.phase === 'sending') return true;
      x.text = el.value;
      const cnt = q('#ask-count'); if (cnt) cnt.textContent = `${[...x.text].length.toLocaleString('en-US')} / ${MAX_QUESTION_CHARS.toLocaleString('en-US')}${uiLang() === 'en' ? '' : '자'}`;
      const btn = q('[data-action="askSend"]'); if (btn) btn.disabled = !x.text.trim();
      if (x.error) { x.error = null; el.removeAttribute('aria-invalid'); el.setAttribute('aria-describedby', 'ask-count'); q('#ask-err')?.remove(); }
      return true;
    }
    if (a === 'teenNote') { const t = teen ||= freshTeen(); if (t.phase !== 'sending') t.note = el.value; const btn = q('[data-action="teenSend"]'); if (btn) btn.disabled = !teenReady(t); return true; }
    if (a === 'briefLine') {
      const b = brief, f = el.dataset.id, i = Number(el.dataset.value);
      if (!b?.draft || b.phase === 'sending') return true;
      if (f === 'situation' || f === 'wants') b.draft[f].text = el.value; else if (b.draft[f]?.[i]) b.draft[f][i].text = el.value;
      return true;
    }
    if (a === 'briefNote') { if (brief && brief.phase !== 'sending') brief.note = el.value; return true; }
    if (a === 'caseText') {
      if (!cases) return true;
      const id = el.dataset.id; cases.text[id] = el.value;
      const btn = q(`[data-action="caseSend"][data-id="${id}"]`); if (btn) btn.disabled = !el.value.trim();
      return true;
    }
    return false;
  }

  /** 그리기 전에 부른다: 계정 확인, Workspace 스위치 묻기, 「내 상담」 불러오기. */
  function sync() {
    cur();
    const page = d.page();
    if (owner() && ['ask', 'askBrief', 'today', 'path'].includes(page)) askStatus();
    // 담당자 답을 놓치지 않게 오늘 · 내 길에 들어올 때 1분 넘게 지났으면 다시 불러온다.
    if (owner() && ['today', 'path'].includes(page)) {
      if (!cases || cases.owner !== owner()) void loadCases();
      // 보내는 중인 글이 있으면 다시 불러오기를 미룬다.
      else if (cases.phase !== 'loading' && !cases.refreshing && d.now() - (cases.at || 0) > 60000 && !Object.values(cases.sending || {}).some(Boolean)) void loadCases({ quiet: true });
    }
    if (page === 'askBrief' && !brief) d.S.page = 'ask';
  }
  function view() {
    const a = cur(), p = askProfile(d.studyProfile()), topic = program(validTopic(a.topic));
    return { lang: uiLang(), signedIn: owner() !== null, off, open: wsOpen, ask: a, urgent, teen: teen || freshTeen(), askLang: a.lang, lastStudent: lastStudent(),
      topicName: topic ? topic.name : null, profileFields: p ? Object.keys(p) : [], sources: index(), canOpen, officialHtml: d.officialHtml(), langFrom, teenFrom };
  }
  return Object.freeze({
    actions, change, input, sync,
    page: () => renderAsk(view()),
    briefPage: () => { const prog = program(programFor()); return renderBrief({ lang: uiLang(), open: wsOpen, now: d.now(), brief, hasProfile: askProfile(d.studyProfile()) !== null, programName: prog ? prog.name : null }); },
    casesHtml: () => (owner() && cases && cases.owner === owner() ? renderCases({ lang: uiLang(), cases, known: known() }) : ''),
    markerHtml: () => (owner() && cases?.owner === owner() && cases.phase === 'ok' && openCases(cases.list).length ? renderCaseMarker({ lang: uiLang() }) : ''),
    /** 시험용: 지금 상태를 들여다본다(바꾸지 않는다). */
    peek: () => ({ ask: cur(), urgent, teen, brief, cases, wsOpen, off })
  });
}
