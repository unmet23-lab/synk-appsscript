// 「내 계정」 on the SYNK ID page (synk.im/id/) after sign-in, in the PC app's order (desktop/renderer/account-page.mjs):
// first who is signed in — name, login e-mail, joining day, 소속 — with the sign-out right there; then, below the
// separate 「로그인과 보안」 card (portal-security.mjs), where the account is signed in, the learning link and its
// summary, the records download and account deletion. It replaces the shared account view (account-view.mjs) on this
// page only; WORLD's web client keeps that one. Every reply is bound to the account and the read it answered: a sign-out
// or another account drops what is shown and any reply still on its way. SYNK TOWN's 「마을 기록」 card (the PC app's
// town-records-card.mjs) sits under the learning link: what the town keeps of the person, taken out or cleared with the
// person's own rights commands even when the town no longer opens for them.
import { nameProblem, profileChange, sessionRows, membershipLines, pendingDeletion } from '../../../desktop/renderer/account-page.mjs';
import { SETTING_WORDS, REASON_WORDS } from './atlas-summary-words.mjs';
import { createTownRecords, attachTownRecords, townExport } from '../../../desktop/renderer/town-records-card.mjs';

const SESSIONS_SHOWN = 6;
// The town card in this page's own controls.
const TOWN_CLASSES = Object.freeze({ button: 'sb-btn soft', note: 'small', link: 'link-button', retry: 'sb-btn soft' });
const MESSAGES = Object.freeze({
  PROFILE_CONFLICT: '다른 곳에서 먼저 이름을 바꿨어요. 지금 이름을 확인한 뒤 다시 저장해 주세요.',
  REVISION_CONFLICT: '다른 곳에서 학습 기록 연결을 먼저 바꿨어요. 지금 상태를 다시 불러왔어요.',
  FEATURE_DISABLED: '지금은 학습 기록 연결을 켤 수 없어요.',
  ACCOUNT_UNAVAILABLE: '지금 이 계정 상태에서는 할 수 없어요.',
  DELETION_NOT_CANCELLABLE: '이미 처리하기 시작해 삭제 요청을 취소할 수 없어요. hello@synk.im으로 알려 주세요.',
  REQUEST_NOT_FOUND: '취소할 삭제 요청을 찾지 못했어요. 화면을 새로 불러왔어요.',
  SESSION_NOT_FOUND: '이미 끝난 로그인이에요. 목록을 새로 불러왔어요.',
});
const errorText = error => MESSAGES[error?.code] || (/[가-힣]/.test(error?.message || '') ? error.message : '처리하지 못했어요. 잠시 뒤 다시 해 주세요.');
const dayText = value => { const time = Date.parse(value || '');return Number.isFinite(time) ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(time)) : ''; };
const momentText = value => { const time = Date.parse(value || '');return Number.isFinite(time) ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time)) : ''; };

export function createPortalAccount({ client, user, guard, notice, logout, preview = false, confirm = defaultConfirm, randomId = () => crypto.randomUUID() }) {
  const doc = document, profileRoot = doc.getElementById('account-profile'), root = doc.getElementById('account');
  let data = null, ended = false, epoch = 0, pendingFocus = null, editingName = false, nameDraft = '', allSessions = false, deleteRequestId = null, summary = null, summaryState = 'idle';
  const busy = new Set();
  // The town card is read once per signed-in account and redrawn in place (drawTown — the block is rebuilt on every render).
  let drawTown = null, townFor = null;
  const town = createTownRecords({
    load: async () => { const reply = await client.townRecords();live();return reply; },
    send: async command => { const reply = await client.townRights(command);live();return reply; },
    confirm: ({ title, ok }) => confirm({ title, body: [], ok }), onChange: () => drawTown?.(), randomId,
  });
  const h = (tag, props = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(props)) { if (value === undefined || value === null || value === false) continue;if (key === 'className') node.className = value;else if (key === 'text') node.textContent = value;else if (key.startsWith('on')) node[key] = value;else node.setAttribute(key, value === true ? '' : String(value)); }
    // A lone text child is the node's text (so a button reads as its words); mixed children are appended in order.
    const kids = children.flat().filter(child => child !== null && child !== undefined && child !== false);
    if (kids.length === 1 && typeof kids[0] === 'string') node.textContent = kids[0];
    else for (const child of kids) node.append(typeof child === 'string' ? Object.assign(doc.createElement('span'), { textContent: child }) : child);
    return node;
  };
  const live = () => { guard();if (ended) throw Object.assign(new Error('closed'), { code: 'ACCOUNT_CHANGED' }); };
  // One change for this account at a time per control; the screen reloads after it.
  async function act(key, run, { reload = true } = {}) {
    if (busy.has(key) || ended) return;
    // The pressed control is disabled while it works; its key brings the keyboard back to it afterwards.
    const token = epoch;pendingFocus = doc.activeElement?.dataset?.key || pendingFocus;busy.add(key);render();
    try { await run();live();if (token !== epoch) return;if (reload) await load(); }
    catch (error) {
      if (ended || error?.code === 'ACCOUNT_CHANGED' || token !== epoch) return;
      if (['PROFILE_CONFLICT', 'REQUEST_NOT_FOUND', 'SESSION_NOT_FOUND', 'REVISION_CONFLICT', 'PARTIAL'].includes(error?.code)) { try { await load(); } catch { /* the message below still applies */ } }
      notice(errorText(error), true);
    } finally { busy.delete(key);if (!ended) render(); }
  }
  // The portal owns sign-out; a second press while one is running finds the screen already changed and does nothing.
  const signOut = (scope = 'current') => Promise.resolve(logout(undefined, { scope, sessionId: (data?.sessions || []).find(row => row.current && !row.revoked)?.id || null }))
    .catch(error => { if (!ended && error?.code !== 'ACCOUNT_CHANGED') notice(errorText(error), true); });

  function profile() {
    const account = data?.account || {}, name = account.profile?.display_name || '', deleting = account.status === 'deletion-requested';
    const memberships = membershipLines(data), joined = dayText(user?.created_at), email = user?.email || '';
    const nameRow = editingName
      ? h('form', { className: 'profile-name-form', onsubmit: event => { event.preventDefault();saveName(); } },
        h('label', { className: 'visually-hidden', for: 'profile-name-input' }, '새 이름'),
        h('input', { id: 'profile-name-input', value: nameDraft, maxlength: 60, autocomplete: 'nickname', required: true, oninput: event => { nameDraft = event.target.value; } }),
        h('button', { className: 'sb-btn', type: 'submit', 'data-key': 'name-save', disabled: busy.has('name') }, busy.has('name') ? '저장 중…' : '저장'),
        h('button', { className: 'link-button', type: 'button', 'data-key': 'name-cancel', onclick: () => { editingName = false;nameDraft = '';pendingFocus = 'name-edit';render(); } }, '취소'))
      : h('span', { className: 'profile-value' }, name || '아직 정하지 않았어요',
        h('button', { className: 'link-button', type: 'button', 'data-key': 'name-edit', disabled: deleting || preview, onclick: () => { editingName = true;nameDraft = name;render();doc.getElementById('profile-name-input')?.focus(); } }, name ? '바꾸기' : '정하기'));
    return h('div', { className: 'profile-card' },
      h('div', { className: 'profile-head' },
        h('span', { className: 'profile-avatar', 'aria-hidden': 'true' }, [...(name || email || 'S')][0].toUpperCase()),
        h('div', { className: 'profile-copy' },
          h('p', { className: 'sb-eyebrow' }, 'MY SYNK ID'),
          h('h2', { id: 'account-profile-heading', tabindex: '-1' }, name || 'SYNK 회원'),
          h('p', { className: 'profile-email' }, email || '로그인 이메일을 확인하고 있어요'),
          deleting ? h('p', { className: 'profile-status', 'data-tone': 'alert' }, pendingDeletion(data) ? '삭제 요청됨 · 아래에서 취소할 수 있어요' : '삭제를 처리하고 있어요') : null),
        h('div', { className: 'profile-actions' },
          h('button', { className: 'sb-btn soft', type: 'button', 'data-action': 'sign-out', 'data-key': 'sign-out', onclick: () => void signOut() }, '로그아웃'),
          h('p', { className: 'small' }, '이 브라우저에서만 로그아웃돼요.'))),
      h('dl', { className: 'profile-facts' },
        h('dt', {}, '이름'), h('dd', {}, nameRow),
        joined ? [h('dt', {}, '가입한 날'), h('dd', {}, joined)] : null,
        h('dt', {}, '소속'), h('dd', {}, memberships.length ? memberships.join(' / ') : '학교·회사와 연결된 소속이 없어요.')));
  }
  function saveName() {
    const value = doc.getElementById('profile-name-input')?.value ?? nameDraft, problem = nameProblem(value);
    if (problem) { nameDraft = value;notice(problem, true);return; }
    void act('name', async () => {
      if (value.trim() === (data?.account?.profile?.display_name || '')) { editingName = false;return; }
      const change = profileChange(data?.account, value);await client.updateProfile(change.profile, change.expected_profile_revision);live();
      editingName = false;nameDraft = '';notice('이름을 바꿨어요. SYNK 앱마다 다음에 열 때 새 이름이 보여요.', false, false, 'success');
    });
  }
  function sessionsBlock() {
    const rows = sessionRows(data), shown = allSessions ? rows : rows.slice(0, SESSIONS_SHOWN), endedRows = (data?.sessions || []).filter(row => row?.revoked).length;
    const others = rows.filter(row => !row.current);
    return h('section', { className: 'account-block', 'aria-labelledby': 'sessions-heading' },
      h('h3', { id: 'sessions-heading' }, '로그인한 곳'),
      h('p', { className: 'small' }, '이 계정으로 로그인해 있는 SYNK 앱이에요. 모르는 곳이 있으면 로그아웃시키고 비밀번호를 바꿔 주세요.'),
      h('ul', { className: 'session-list' }, shown.length ? shown.map(row => h('li', { className: 'session-row' },
        h('div', {}, h('strong', {}, row.name, row.current ? h('span', { className: 'session-current' }, '이 브라우저') : null),
          h('p', { className: 'small' }, [row.label, row.seen ? `${row.seen}에 사용` : ''].filter(Boolean).join(' · ') || '사용 기록 없음')),
        h('button', { className: 'link-button', type: 'button', 'data-key': 'session:' + row.id, disabled: busy.has('session:' + row.id) || preview, onclick: () => row.current ? void signOut() : void act('session:' + row.id, async () => { await client.revokeSession(row.id);live();notice('그곳의 로그인을 끝냈어요.', false, false, 'success'); }) },
          row.current ? '로그아웃' : '로그아웃시키기'))) : h('li', { className: 'small' }, '표시할 로그인 기록이 없어요.')),
      rows.length > SESSIONS_SHOWN ? h('button', { className: 'link-button', type: 'button', 'data-key': 'sessions-more', 'aria-expanded': String(allSessions), onclick: () => { allSessions = !allSessions;render(); } }, allSessions ? '줄여 보기' : `${rows.length - SESSIONS_SHOWN}곳 더 보기`) : null,
      endedRows ? h('p', { className: 'small session-ended' }, `이미 끝난 로그인 ${endedRows}곳은 목록에서 뺐어요.`) : null,
      // Both are undone by signing in again, so neither asks first (a confirmation is for what cannot be undone).
      h('div', { className: 'actions' },
        others.length ? h('button', { className: 'sb-btn soft', type: 'button', 'data-key': 'others', disabled: busy.has('others') || preview, onclick: () => void signOutOthers(others) }, busy.has('others') ? '로그아웃시키는 중…' : `이 브라우저만 남기고 로그아웃 (${others.length}곳)`) : null,
        h('button', { className: 'link-button', type: 'button', 'data-key': 'all', onclick: () => { if (!ended) void signOut('all'); } }, '모든 SYNK 앱에서 로그아웃')));
  }
  async function signOutOthers(rows) {
    if (ended) return;
    await act('others', async () => {
      let done = 0;
      for (const row of rows) { try { await client.revokeSession(row.id);done++; } catch (error) { if (error?.code === 'ACCOUNT_CHANGED') throw error;if (error?.code !== 'SESSION_NOT_FOUND') throw Object.assign(new Error(`${done}곳은 로그아웃시켰지만 나머지는 하지 못했어요. 다시 눌러 주세요.`), { code: 'PARTIAL' }); }live(); }
      notice(`다른 ${done}곳의 로그인을 끝냈어요. 이 브라우저는 그대로예요.`, false, false, 'success');
    });
  }
  function learningBlock() {
    const account = data?.account || {}, deleting = account.status === 'deletion-requested', on = data?.learning?.enabled === true, canEnable = data?.capabilities?.learningSync === true && !deleting;
    const usable = !preview && (on || canEnable);
    return h('section', { className: 'account-block', 'aria-labelledby': 'learning-heading' },
      h('h3', { id: 'learning-heading' }, '학습 기록'),
      h('div', { className: 'switch-row-line' },
        h('div', {}, h('strong', {}, '학습 기록 연결'),
          h('p', { className: 'small' }, on ? '켜져 있어요. 연습 기록을 계정에 저장해 다른 기기와 SYNK 앱에서 이어 가요.' : canEnable ? '꺼져 있어요. 켜면 연습 기록을 계정에 저장해 다른 기기에서도 이어 가요. 로그인 전에 한 기록은 옮기지 않아요.' : deleting ? '계정 삭제를 요청해서 켤 수 없어요. 요청을 취소하면 다시 켤 수 있어요.' : '지금은 켤 수 없어요. 이 기기에서 하는 연습은 그대로 할 수 있어요.')),
        h('button', { className: 'switch', type: 'button', 'data-key': 'learning', role: 'switch', 'aria-checked': String(on), 'aria-labelledby': 'learning-heading', disabled: !usable || busy.has('learning'), onclick: () => void act('learning', async () => {
          await client.setLearning(!on, data.learning.revision);live();notice(!on ? '학습 기록 연결을 켰어요.' : '학습 기록 연결을 껐어요.', false, false, 'success');
        }) }, h('span', { className: 'switch-knob', 'aria-hidden': 'true' }), on ? '켜짐' : '꺼짐')),
      summaryList());
  }
  function summaryList() {
    if (summaryState === 'loading') return h('p', { className: 'small' }, '학습 요약을 불러오고 있어요.');
    if (summaryState === 'failed') return h('p', { className: 'small' }, '학습 요약을 불러오지 못했어요. 계정은 그대로 쓸 수 있어요.');
    if (!summary?.summary) return h('p', { className: 'small' }, '아직 보여 줄 학습 요약이 없어요.');
    const s = summary.summary, practice = s.practice || {};
    const chosen = Object.entries(s.presentation || {}).filter(([key, value]) => SETTING_WORDS[key]?.[value]).map(([key, value]) => SETTING_WORDS[key][value]);
    const reasons = (s.reasons || []).map(reason => REASON_WORDS[reason]).filter(Boolean);
    return h('div', { className: 'learning-summary' }, h('strong', {}, '내 학습 요약'),
      h('ul', { className: 'details' },
        h('li', {}, chosen.length ? `고른 설정 · ${chosen.join(' · ')}` : '고른 설정 · 아직 없어요'),
        h('li', {}, reasons.length ? `배우는 이유 · ${reasons.join(' · ')}` : '배우는 이유 · 아직 고르지 않았어요'),
        h('li', {}, practice.answered ? `연습 · ${practice.answered}문항 · 혼자 맞힌 문항 ${practice.independent} · 도움 받은 문항 ${practice.assisted}` : '연습 · 아직 저장된 연습이 없어요'),
        (practice.skills || []).slice(0, 3).filter(skill => typeof skill?.line === 'string').map(skill => h('li', {}, skill.line))),
      h('p', { className: 'small' }, summary.shared === 'practice-and-settings' ? '다른 SYNK 앱도 이 요약을 보고 시작해요. 내가 고른 것과 실제 연습만 담고, 나이나 성격은 짐작하지 않아요.' : '「학습 기록 연결」이 꺼져 있어 다른 SYNK 앱에는 직접 고른 배우는 이유만 전해요.'));
  }
  function townBlock() {
    if (typeof client.townRecords !== 'function') return null;
    const body = h('div', {});
    const block = h('section', { className: 'account-block town-block', 'aria-labelledby': 'town-heading' }, h('h3', { id: 'town-heading' }, '마을 기록'), body);
    drawTown = attachTownRecords(town, body, { classes: TOWN_CLASSES, headingLevel: 4 });
    return block;
  }
  function rightsBlock() {
    const rows = (data?.entitlements || []).filter(Boolean);
    if (!rows.length) return null;
    const product = value => ({ platform: 'SYNK 플랫폼', world: 'SYNK WORLD', messenger: 'SYNK Workspace' })[value] || 'SYNK';
    return h('section', { className: 'account-block', 'aria-labelledby': 'rights-heading' }, h('h3', { id: 'rights-heading' }, '이용 권한'),
      h('ul', { className: 'details' }, rows.map(row => h('li', {}, `${product(row.product)}${dayText(row.valid_until) ? ` · ${dayText(row.valid_until)}까지` : ''}`))));
  }
  function dataBlock() {
    const account = data?.account || {}, deleting = account.status === 'deletion-requested', deletion = pendingDeletion(data);
    return h('section', { className: 'account-block account-danger', 'aria-labelledby': 'data-heading' },
      h('h3', { id: 'data-heading' }, '내 데이터와 계정 삭제'),
      h('div', { className: 'switch-row-line' },
        h('div', {}, h('strong', {}, '연습 기록 내려받기'), h('p', { className: 'small' }, '계정에 저장한 연습 기록과 내 정보, 마을 기록을 파일(JSON)로 받아요. 과제와 AI 기록은 들어 있지 않아요.')),
        h('button', { className: 'sb-btn soft', type: 'button', 'data-key': 'export', disabled: busy.has('export') || preview, onclick: () => void act('export', download, { reload: false }) }, busy.has('export') ? '준비 중…' : '연습 기록 내려받기')),
      h('div', { className: 'switch-row-line' },
        h('div', {}, h('strong', {}, deletion ? '삭제 요청을 받았어요' : deleting ? '삭제를 처리하고 있어요' : '계정 삭제'),
          h('p', { className: 'small' }, deletion ? `${momentText(deletion.due_at) ? `${momentText(deletion.due_at)}까지는` : '7일 동안은'} 여기서 취소할 수 있고, 그 뒤에 계정과 기록을 지워요(늦어도 요청 후 30일 안).`
            : deleting ? '늦어도 요청 후 30일 안에 계정과 기록을 지워요.' : '요청하면 7일 동안은 취소할 수 있고, 그 뒤 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지워요.')),
        deletion ? h('button', { className: 'sb-btn', type: 'button', 'data-key': 'delete', disabled: busy.has('delete') || preview, onclick: () => void act('delete', async () => {
          await client.cancelDeletion(deletion.request_id);live();deleteRequestId = null;notice('삭제 요청을 취소했어요. 학습 기록 연결은 꺼 둔 채예요. 다시 쓰려면 위에서 켜 주세요.', false, false, 'success');
        }) }, '삭제 요청 취소')
          : deleting ? null : h('button', { className: 'link-button danger', type: 'button', 'data-key': 'delete', disabled: busy.has('delete') || preview, onclick: () => void requestDeletion() }, '계정 삭제 요청')),
      data?.account?.synk_user_id ? h('details', { className: 'support-id' }, h('summary', {}, '문의할 때 쓰는 계정 번호'), h('p', { className: 'small' }, 'hello@synk.im에 문의할 때 이 번호를 같이 적어 주세요.'), h('code', {}, data.account.synk_user_id)) : null);
  }
  async function requestDeletion() {
    if (ended || busy.has('delete')) return;
    if (!await confirm({ title: '계정 삭제를 요청할까요?', danger: true, ok: '삭제 요청 보내기', body: ['요청하면 학습 기록 연결을 바로 멈춰요.', '7일 동안은 이 화면에서 요청을 취소할 수 있어요. 그 뒤 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지우고(늦어도 요청 후 30일 안), 지운 뒤에는 되돌릴 수 없어요.'] }) || ended) return;
    await act('delete', async () => {
      deleteRequestId ||= randomId();const result = await client.requestDeletion(deleteRequestId);live();const due = momentText(result?.request?.due_at);
      notice(`삭제 요청을 받았어요. 학습 기록 연결을 멈췄고, ${due ? `${due}까지는` : '7일 동안은'} 이 화면에서 취소할 수 있어요.`, false, false, 'success');
    });
  }
  async function download() {
    const events = [], meta = [];let after = 0, until, memory, myInfo, townData;
    for (let page = 0; page < 1000; page++) {
      const result = await client.exportPage({ after, until });live();
      if (after === 0 && Array.isArray(result.atlasMemory)) memory = result.atlasMemory;
      // The first page carries the town's first page (W6c); 「내 정보」 rides every page.
      if (after === 0 && Object.hasOwn(result, 'town')) townData = await townExport(result.town, async page => { const reply = await client.townExportPage(page);live();return reply; });
      if (Object.hasOwn(result, 'myInfo')) myInfo = result.myInfo;
      if (!Array.isArray(result.events) || !Number.isSafeInteger(result.cursor) || result.cursor < after || result.hasMore && result.cursor <= after) throw new Error('내려받기가 중간에 멈췄어요. 다시 해 주세요.');
      until ??= result.until;events.push(...result.events);if (Array.isArray(result.eventMeta)) meta.push(...result.eventMeta);after = result.cursor;
      if (!result.hasMore) {
        const blob = new Blob([JSON.stringify({ scope: 'connected-learning-records', account: result.account || data.account, ...(myInfo !== undefined ? { myInfo } : {}), ...(memory ? { atlasMemory: memory } : {}), ...(townData !== undefined ? { town: townData } : {}), until, events, eventMeta: meta }, null, 2)], { type: 'application/json' });
        const link = h('a', { href: URL.createObjectURL(blob), download: 'synk-connected-learning.json' });doc.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        notice('연습 기록을 내려받았어요. 과제와 AI 기록은 이 파일에 들어 있지 않아요.', false, false, 'success');return;
      }
    }
    throw new Error('기록이 많아 한 번에 마치지 못했어요. 잠시 뒤 다시 해 주세요.');
  }
  // scope 'main' redraws only the blocks under 「로그인과 보안」 (the summary arriving must not replace a name being typed).
  function render(scope = 'all') {
    if (ended || !data) return;
    doc.body.classList.add('account-open');
    const active = doc.activeElement, inside = !!active && (!!root.contains?.(active) || !!profileRoot?.contains?.(active));
    const key = inside ? active.dataset?.key : null, typing = inside && active.id === 'profile-name-input' ? [active.selectionStart, active.selectionEnd] : null;
    if (scope !== 'main') { profileRoot.hidden = false;profileRoot.replaceChildren(profile()); }
    root.hidden = false;root.replaceChildren(h('div', { className: 'account-blocks' }, sessionsBlock(), learningBlock(), townBlock(), rightsBlock(), dataBlock()));
    // The keyboard stays where it was, found by a control's key (its words may change), or comes back to the control
    // that started a change once it is enabled again.
    if (typing && editingName) { const input = doc.getElementById('profile-name-input');if (input && doc.activeElement !== input) { input.focus?.({ preventScroll: true });input.setSelectionRange?.(...typing); }return; }
    const want = key || (pendingFocus && (!active || active === doc.body || !active.isConnected) ? pendingFocus : null);
    if (!want) return;
    const target = [...(profileRoot.querySelectorAll?.('[data-key]') || []), ...(root.querySelectorAll?.('[data-key]') || [])].find(node => node.dataset?.key === want);
    if (target && !target.disabled) { if (doc.activeElement !== target) target.focus?.({ preventScroll: true });if (want === pendingFocus) pendingFocus = null; }
  }
  async function loadSummary(token) {
    if (typeof client.atlasSummary !== 'function') { summaryState = 'idle';return; }
    summaryState = 'loading';
    try { const result = await client.atlasSummary();live();if (token !== epoch) return;summary = result;summaryState = 'ready'; }
    catch (error) { if (ended || error?.code === 'ACCOUNT_CHANGED' || token !== epoch) return;summaryState = 'failed'; }
    render('main');
  }
  async function load() {
    const token = ++epoch, result = await client.load();live();if (token !== epoch) return;
    if (data?.account?.synk_user_id && result?.account?.synk_user_id !== data.account.synk_user_id) throw Object.assign(new Error('계정이 바뀌었어요. 다시 로그인해 주세요.'), { code: 'ACCOUNT_CHANGED' });
    data = result;render();void loadSummary(token);
    if (townFor !== data.account?.synk_user_id) { townFor = data.account?.synk_user_id ?? null;void town.refresh(); }
  }
  return Object.freeze({
    load,
    sessions: () => (data?.sessions || []).map(row => ({ ...row })),
    stop() { ended = true;epoch++;busy.clear();town.reset();drawTown = null;townFor = null;doc.body.classList.remove('account-open');profileRoot.replaceChildren();profileRoot.hidden = true;root.replaceChildren();root.hidden = true; },
  });
}

// A small modal question with a safe default (「취소」 keeps everything as it is).
function defaultConfirm({ title, body = [], ok, danger = false }) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');dialog.className = 'portal-confirm';
    if (typeof dialog.showModal !== 'function') { resolve(false);return; }
    const heading = document.createElement('h2');heading.textContent = title;dialog.append(heading);
    for (const line of body) { const p = document.createElement('p');p.className = 'small';p.textContent = line;dialog.append(p); }
    const form = document.createElement('form');form.method = 'dialog';form.className = 'actions';
    const yes = document.createElement('button');yes.value = 'ok';yes.className = danger ? 'sb-btn danger-fill' : 'sb-btn';yes.textContent = ok;
    const no = document.createElement('button');no.value = 'cancel';no.className = 'sb-btn soft';no.textContent = '취소';no.autofocus = true;
    form.append(yes, no);dialog.append(form);
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'ok');dialog.remove(); }, { once: true });
    document.body.append(dialog);dialog.showModal();
  });
}
