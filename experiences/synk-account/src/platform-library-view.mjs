import { createAccountNotebook } from './account-notebook.mjs';
import { emptyPlatformLibrary, validatePlatformLibrary, updatePlatformLibrary, projectPlatformLibrary, platformAppId, platformDisplayAppIds, PLATFORM_APP_IDS, ACTIVE_PLATFORM_APP_IDS, PLATFORM_NOTE_LIMIT } from './platform-library-data.mjs';
import { validatePlatformLibraryState } from './platform-library-state.mjs';
import { platformLibraryAccount } from './platform-library-account.mjs';
import { createLibraryRecovery } from './platform-library-recovery.mjs';

const names = { world: "WORLD", messenger: "Workspace", teacher: "Workspace 내 수업", path: "PATH", pulse: "PULSE", partners: "PULSE의 옛 메모", care: "플레저", fortune: "무료 운세" };
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let librarySequence = 0;
export function mountPlatformLibrary(root, { getHost, ensureReady = async () => {
}, native = false, getDevice = () => ({}), getAppIds = () => ACTIVE_PLATFORM_APP_IDS, onChange = () => {
}, onFavoritesChanged = () => {}, onOpen = () => {
}, onLogin = () => {
}, onManage = onLogin, storage = globalThis.localStorage } = {}) {
  let notebook = null, doc = emptyPlatformLibrary(), draft = { appId: "world", title: "" }, message = "", modeVersion = 0, submitting = false, pageSuspended = false, connecting = false, disposed = false, resumeId = null, initialExpansionPending = false, connectOnResume = false;
  let editing = null, parkedDraft = null, deletedNotes = [], completedExpanded = false, noteQuery = "", noteFilter = "all";
  let recoveryOwner = null;
  let accountAdapter = null, nativeVerification = null, nativeVerificationNotice = null;
  let documentOwner = null, documentReady = false;
  let favoriteIntent = null;
  const favoriteSignature = value => JSON.stringify(projectPlatformLibrary(value, { appIds: entryIds() }).favorites);
  const readyWaiters = new Set();
  function readiness() {
    if (disposed || pageSuspended) return false;
    const status = notebook?.status;
    if (connecting || status?.status === "loading" || status?.hydrating || notebook?.active && status?.status === "closed") return null;
    if (!notebook?.active) return true;
    // A successful empty response may not apply the same empty document twice.
    // Its verified revision still distinguishes it from a failed first read.
    return documentReady && Number.isSafeInteger(status.revision) && status.accountId === documentOwner && notebook.canEdit;
  }
  function notifyReady() {
    const value = readiness();
    if (value === null) return;
    for (const resolve of readyWaiters) resolve(value);
    readyWaiters.clear();
  }
  function ready() {
    const value = readiness();
    return value === null ? new Promise(resolve => readyWaiters.add(resolve)) : Promise.resolve(value);
  }
  const panelId = "synk-library-panel-" + ++librarySequence;
  root.classList.add("platform-continuity");
  root.innerHTML = '<header class="continuity-overview"><div class="continuity-preview"><p class="continuity-eyebrow">MY LIBRARY</p><h2 data-library-title>계정 라이브러리</h2><p data-library-detail>로그인하면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.</p><span class="continuity-status" data-library-status role="status" aria-live="polite"></span></div><div class="continuity-overview-actions"><span data-connect><button type="button" data-connect-button>계정 라이브러리 연결</button></span><button type="button" data-resume hidden>이어서 열기</button><button type="button" data-panel-toggle hidden aria-expanded="false" aria-controls="' + panelId + '">메모·계정 설정</button></div></header><div id="' + panelId + '" data-library-panel hidden><section data-notebook-mount hidden></section><section data-cloud-content hidden></section></div>';
  const mount = root.querySelector("[data-notebook-mount]"), content = root.querySelector("[data-cloud-content]"), panel = root.querySelector("[data-library-panel]"), toggle = root.querySelector("[data-panel-toggle]"), connect = root.querySelector("[data-connect-button]"), resumeButton = root.querySelector("[data-resume]");
  function verifyNativeConnection(event) {
    const target = event.target?.closest?.('button[data-notebook="signin"]'), identity = accountAdapter?.status();
    if (!native || disposed || !target || !nativeVerification && (identity?.signedIn || identity?.error?.retryable !== true)) return;
    // Identity verification stays in this panel. The notebook's navigation and
    // draft-discard handler belongs only to explicit fresh login choices.
    event.preventDefault();event.stopImmediatePropagation();
    if (nativeVerification) return;
    const expected = modeVersion;
    message = '';
    target.disabled = true;target.setAttribute('aria-busy', 'true');
    const task = (async () => {
      try {
        await accountAdapter.retryConnection();
        const verified = accountAdapter.status();
        const sameIdentity = Number.isSafeInteger(identity.sessionGeneration) && verified.sessionGeneration === identity.sessionGeneration && verified.accountId === identity.accountId;
        if (!disposed && (expected === modeVersion || sameIdentity) && !verified.signedIn && verified.error?.code === 'SUITE_UNAVAILABLE') {
          message = '다시 로그인하라는 안내가 보이면 위 계정 메뉴에서 「새로 로그인」을 눌러 주세요. 기기 저장 문제라면 PC 저장 공간을 비운 뒤 다시 눌러 주세요.';
          nativeVerificationNotice = { text: message, accountId: verified.accountId, generation: verified.sessionGeneration };
        }
      }
      catch (error) { if (!disposed && expected === modeVersion) message = error.message || '계정을 다시 불러오지 못했어요.'; }
      finally {
        if (nativeVerification === task) nativeVerification = null;
        if (!disposed) {
          const button = mount.querySelector('button[data-notebook="signin"]'), latest = accountAdapter.status();
          button?.setAttribute('aria-busy', 'false');
          if (button && !latest.signedIn && latest.error?.retryable === true) button.disabled = false;
          render();
        }
      }
    })();
    nativeVerification = task;
  }
  if (native) mount.addEventListener('click', verifyNativeConnection, true);
  const recovery = createLibraryRecovery({ getHost, getOwner: () => recoveryOwner, canUse: () => native && !pageSuspended && !disposed && !!notebook?.active && notebook.canEdit && doc.consent, getPayload: () => { capture(); return { draft, editing, parkedDraft }; }, onChange: () => render() });
  const entryIds = () => getAppIds().filter((id2) => ACTIVE_PLATFORM_APP_IDS.includes(id2));
  const displayIds = () => platformDisplayAppIds(entryIds());
  function expand(value) {
    panel.hidden = !value;
    toggle.setAttribute("aria-expanded", String(value));
    toggle.textContent = value ? "접어두기" : "메모·계정 설정";
  }
  // 아직 계정에 저장하지 않을 때 다음 한 걸음: 로그인 전 / 로그인했지만 연결 전 / 연결했지만 계정 저장을 켜기 전.
  function nextStep() {
    const signedIn = !!(accountAdapter?.status?.()?.signedIn ?? getHost?.()?.identity?.()?.signedIn);
    if (notebook?.active && !doc.consent) return "「계정 저장 켜기」를 누르면 즐겨찾기와 최근 기록을 계정에 저장해 다른 기기에서도 봐요.";
    if (signedIn && !notebook?.active) return "「계정 라이브러리 연결」을 누르면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.";
    if (signedIn) return "즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.";
    return "로그인하면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.";
  }
  function summary() {
    const available = !pageSuspended && !disposed && !!notebook?.active && notebook.canEdit && doc.consent;
    const note2 = available ? doc.notes.find((row) => !row.done && ACTIVE_PLATFORM_APP_IDS.includes(platformAppId(row.appId))) : null, recent = available ? projectPlatformLibrary(doc, { appIds: entryIds() }).recent[0] : null, hasDraft = available && (!!draft.title.trim() || !!parkedDraft?.title.trim());
    resumeId = note2?.appId || recent?.entryId || recent?.id || null;
    root.querySelector("[data-library-title]").textContent = hasDraft ? editing ? "수정 중인 메모가 있어요" : "작성 중인 메모가 있어요" : note2?.title || (recent ? "최근에 연 " + names[recent.id] : "계정 라이브러리");
    root.querySelector("[data-library-detail]").textContent = message || (hasDraft ? "접어두어도 이 화면의 입력은 유지돼요." : note2 ? (names[note2.appId] || "이전 앱의 메모") + " · 남겨 둔 다음 할 일" : recent ? "「이어서 열기」를 누르면 바로 열려요." : available ? "다음에 할 일을 메모로 남기면 여기서 바로 이어 가요." : nextStep());
    root.querySelector("[data-library-status]").textContent = connecting ? "연결 준비 중…" : hasDraft && notebook.status.status === "synced" && !notebook.status.error && !notebook.pending ? "메모는 아직 계정에 저장하지 않았어요" : mount.querySelector("[data-notebook-status]")?.textContent || "";
    resumeButton.hidden = !available || !resumeId && !hasDraft;
    resumeButton.textContent = hasDraft ? "계속 작성" : "이어서 열기";
    toggle.hidden = !notebook;
  }
  function capture() {
    const field = content.querySelector("[name=title]");
    if (field) draft = { appId: content.querySelector("[name=appId]").value, title: field.value };
  }
  function hasUnsavedDraft() {
    capture();
    return !!draft.title.trim() || !!parkedDraft?.title.trim();
  }
  function clearNoteSession() {
    editing = null;
    parkedDraft = null;
    deletedNotes = [];
    completedExpanded = false;
    noteQuery = "";
    noteFilter = "all";
  }
  function discardDraft() {
    capture();
    const previous = { draft: { ...draft }, editing, parkedDraft }, expected = modeVersion;
    clearNoteSession();
    draft.title = "";
    render({ captureDraft: false });
    return recovery.clear().then((cleared) => {
      // A failed deletion must keep a retryable exit guard. Never overwrite
      // newer typing or input belonging to another account while restoring it.
      if (!cleared && !disposed && modeVersion === expected && !draft.title.trim() && !parkedDraft?.title.trim()) {
        draft = previous.draft; editing = previous.editing; parkedDraft = previous.parkedDraft;
        render({ captureDraft: false });
      }
      return cleared;
    });
  }
  function focusDraft() {
    expand(true);
    content.querySelector("[name=title]")?.focus?.();
  }
  function editorOptions(selected) {
    let ids3 = displayIds();
    if (selected === "teacher" && entryIds().includes("teacher")) ids3 = ids3.filter((id2) => id2 !== "messenger").concat("teacher");
    // 고치는 메모의 앱이 목록에 없으면(옛 Partners·서비스를 마친 앱) 그 앱을 그대로 둘 수 있게 한 칸 더 보인다.
    if (editing && !ids3.includes(editing.appId)) ids3 = ids3.concat(editing.appId);
    return ids3.map((id2) => '<option value="' + id2 + '" ' + (selected === id2 ? "selected" : "") + ">" + (names[id2] || "이전 앱의 메모") + "</option>").join("");
  }
  function favoriteSelected(id2) {
    return projectPlatformLibrary(doc, { appIds: entryIds() }).favorites.includes(id2);
  }
  function setEditorDraft(value) {
    draft = { ...value };
    const field = content.querySelector("[name=title]"), select = content.querySelector("[name=appId]");
    if (field) field.value = draft.title;
    if (select) {
      select.innerHTML = editorOptions(draft.appId);
      select.value = draft.appId;
    }
    recovery.schedule();
  }
  function finishEditing() {
    const next = parkedDraft || { appId: "world", title: "" };
    editing = null;
    parkedDraft = null;
    setEditorDraft(next);
  }
  function beginEditing(id2) {
    const row = doc.notes.find((note2) => note2.id === id2);
    if (!row || !notebook?.canEdit) return;
    capture();
    if (editing?.id === id2) {
      focusDraft();
      return;
    }
    if (editing && (draft.title !== editing.title || draft.appId !== editing.appId) && !globalThis.confirm("수정 중인 내용을 취소하고 다른 메모를 수정할까요?")) return;
    if (!editing) parkedDraft = { ...draft };
    editing = { ...row };
    setEditorDraft({ appId: row.appId, title: row.title });
    message = "";
    render();
    focusDraft();
  }
  function noteCard(row) {
    return '<article tabindex="-1" data-note-id="' + esc(row.id) + '"><strong>' + esc(row.title) + "</strong><p>" + (names[row.appId] || "이전 앱의 메모") + '</p><div class="continuity-note-actions">' + (ACTIVE_PLATFORM_APP_IDS.includes(platformAppId(row.appId)) ? '<button type="button" data-cloud="open" data-id="' + row.appId + '">이어가기</button>' : '') + '<button type="button" data-cloud="edit-note" data-id="' + esc(row.id) + '" aria-label="' + esc(row.title) + ' 수정">수정</button><button type="button" data-cloud="toggle-note" data-id="' + esc(row.id) + '" aria-pressed="' + row.done + '">' + (row.done ? "완료됨 · 다시 열기" : "완료 표시") + '</button><button type="button" data-cloud="remove-note" data-id="' + esc(row.id) + '" aria-label="' + esc(row.title) + ' 삭제">메모 삭제</button></div></article>';
  }
  function matchingNotes(query = "", filter = "all") {
    const terms = String(query).normalize("NFKC").toLocaleLowerCase("ko-KR").trim().split(/\s+/).filter(Boolean);
    return doc.notes.filter((row) => (filter === "all" || row.done === (filter === "done")) && terms.every((term) => (row.title + " " + (names[row.appId] || "이전 앱의 메모")).normalize("NFKC").toLocaleLowerCase("ko-KR").includes(term)));
  }
  function favoritesMarkup() {
    const favorites = projectPlatformLibrary(doc, { appIds: entryIds() }).favorites.filter((id) => displayIds().includes(id));
    return favorites.length > 1 ? '<h3>즐겨찾기 순서</h3><ol class="continuity-favorite-order">' + favorites.map((id, index) => '<li><span>' + names[id] + '</span><div><button type="button" data-cloud="favorite-up" data-id="' + id + '" aria-label="' + names[id] + ' 즐겨찾기 위로"' + (index === 0 ? ' data-order-edge disabled' : '') + '>위로</button><button type="button" data-cloud="favorite-down" data-id="' + id + '" aria-label="' + names[id] + ' 즐겨찾기 아래로"' + (index === favorites.length - 1 ? ' data-order-edge disabled' : '') + '>아래로</button></div></li>').join("") + '</ol>' : '';
  }
  function notesMarkup() {
    const matched = matchingNotes(noteQuery, noteFilter), pending = matched.filter((row) => !row.done), completed = matched.filter((row) => row.done);
    if (noteQuery.trim() || noteFilter !== "all") return '<section aria-label="메모 검색 결과"><h3>검색 결과 <span role="status">' + matched.length + '개</span></h3>' + (matched.length ? '<div class="continuity-note-grid">' + [...pending, ...completed].map(noteCard).join("") + '</div>' : '<p class="continuity-empty">조건에 맞는 메모가 없어요. 검색어나 상태를 바꿔 보세요.</p>') + '</section>';
    const emptyText = completed.length ? "남겨 둔 할 일을 모두 마쳤어요. 다음에 할 일을 메모로 남겨 보세요." : "아직 남겨 둔 할 일이 없어요. 다음에 할 일을 메모로 남겨 보세요.";
    return '<section aria-label="다음에 할 일"><h3>다음에 할 일 <span>' + pending.length + "개</span></h3>" + (pending.length ? '<div class="continuity-note-grid">' + pending.map(noteCard).join("") + "</div>" : '<p class="continuity-empty">' + emptyText + "</p>") + "</section>" + (completed.length ? '<section class="continuity-completed"><button type="button" data-cloud="show-completed" aria-expanded="' + completedExpanded + '" aria-controls="' + panelId + '-completed">완료한 메모 ' + completed.length + "개 " + (completedExpanded ? "접기" : "보기") + '</button><div id="' + panelId + '-completed" data-completed-notes class="continuity-note-grid" ' + (completedExpanded ? "" : "hidden") + ">" + completed.map(noteCard).join("") + "</div></section>" : "");
  }
  function recoveryControls() {
    const banner = content.querySelector("[data-note-recovery]");
    if (!banner) return;
    const state = recovery.state();
    banner.hidden = !state.candidate && !state.error;
    banner.querySelector("[data-recovery-detail]").textContent = state.error || "이 기기에 쓰던 메모의 임시 저장본이 있어요. 되살리면 내용을 확인한 뒤 계정에 저장할 수 있어요.";
    banner.querySelector('[data-cloud="recover-draft"]').hidden = !state.candidate;
    const discard = banner.querySelector('[data-cloud="discard-recovery"]');
    discard.hidden = !state.candidate && !state.removalFailed;
    discard.textContent = state.removalFailed ? "임시 저장본 지우기 다시 시도" : "임시 저장본 버리기";
  }
  function noteControls(editable) {
    const submit = content.querySelector("[data-note-submit]");
    if (!submit) return;
    const full = doc.notes.length >= PLATFORM_NOTE_LIMIT, last = deletedNotes.at(-1);
    content.querySelector("[data-editor-heading]").textContent = editing ? "메모 수정" : "새 메모";
    content.querySelector("[data-edit-detail]").hidden = !editing;
    content.querySelector("[data-edit-detail]").textContent = parkedDraft?.title.trim() ? "새로 작성하던 메모는 보관 중이에요. 수정을 마치거나 취소하면 돌아와요." : "수정을 취소하면 기존 메모가 그대로 남아요.";
    content.querySelector("[data-note-capacity]").textContent = "메모 " + doc.notes.length + "/" + PLATFORM_NOTE_LIMIT + "개 · " + (full ? "보관함이 가득 찼어요. 필요 없는 메모를 삭제하면 새로 남길 수 있어요." : PLATFORM_NOTE_LIMIT - doc.notes.length + "개 더 남길 수 있어요.");
    submit.textContent = editing ? "수정 저장" : "계정에 메모 남기기";
    submit.disabled = !editable || submitting || full && !editing;
    content.querySelector('[data-cloud="cancel-edit"]').hidden = !editing;
    const undo = content.querySelector("[data-note-undo]");
    undo.hidden = !last;
    content.querySelector("[data-note-undo-message]").textContent = last ? "“" + last.note.title + "” 메모를 삭제했어요. 이 화면에서 최근 삭제한 " + deletedNotes.length + "개를 되돌릴 수 있어요." : "";
    const undoButton = content.querySelector('[data-cloud="undo-note"]');
    undoButton.disabled = !editable || !last || full;
    content.querySelector("[data-note-undo-detail]").textContent = full ? "보관함이 가득 차 지금은 되돌릴 수 없어요. 다른 저장 기록을 불러오기 전까지 삭제한 메모를 보관해요." : "화면을 닫거나 계정을 바꾸거나 다른 저장 기록을 불러오면 되돌리기가 끝나요.";
  }
  let renderedNotes = "", renderedCatalog = "", renderedFavorites = "";
  function render({ captureDraft = true } = {}) {
    notifyReady();
    if (pageSuspended || disposed) return;
    if (captureDraft) capture();
    const active = !!notebook?.active, editable = !!notebook?.canEdit;
    if (initialExpansionPending && notebook && (editable && notebook.status.status === "synced" || notebook.status.error || ["error", "offline", "storage-error", "conflict", "local-conflict"].includes(notebook.status.status))) {
      initialExpansionPending = false;
      expand(!editable || !doc.consent);
    }
    const nextNotes = notesMarkup(), nextFavorites = favoritesMarkup(), catalog = displayIds().join(",");
    if (active && doc.consent && captureDraft && content.querySelector("[data-note-form]") && catalog === renderedCatalog) {
      content.querySelector("[data-cloud-message]").textContent = message;
      content.querySelector('[data-cloud="remember"]').checked = doc.rememberRecent;
      for (const button of content.querySelectorAll('[data-cloud="favorite"]')) {
        const selected = favoriteSelected(button.dataset.id);
        button.setAttribute("aria-pressed", String(selected));
        button.textContent = (selected ? "★ " : "☆ ") + names[button.dataset.id];
      }
      if (nextNotes !== renderedNotes) content.querySelector(".continuity-notes").innerHTML = nextNotes;
      if (nextFavorites !== renderedFavorites) content.querySelector("[data-favorite-order]").innerHTML = nextFavorites;
    } else {
      content.innerHTML = active ? '<h2>계정에 저장한 즐겨찾기와 메모</h2><p role="status" data-cloud-message>' + esc(message) + "</p>" + (!doc.consent ? '<p>켜면 지금부터 고르는 즐겨찾기와 최근 기록을 계정에 저장해요. 이 기기에 있던 목록은 위의 「기기 기록을 계정으로 옮기기」로 가져와요.</p><button data-cloud="enable">계정 저장 켜기</button>' : '<label><input type="checkbox" data-cloud="remember" ' + (doc.rememberRecent ? "checked" : "") + '> 최근에 연 시각도 계정에 저장</label><div class="continuity-apps">' + displayIds().map((id2) => '<button type="button" data-cloud="favorite" data-id="' + id2 + '" aria-pressed="' + favoriteSelected(id2) + '">' + (favoriteSelected(id2) ? "★ " : "☆ ") + names[id2] + "</button>").join("") + '</div><section data-favorite-order>' + nextFavorites + '</section><section data-note-recovery class="continuity-undo" hidden><p data-recovery-detail role="status"></p><button type="button" data-cloud="recover-draft">쓰던 메모 되살리기</button><button type="button" data-cloud="discard-recovery">임시 저장본 버리기</button></section><form data-note-form><h3 data-editor-heading>새 메모</h3><p data-edit-detail hidden></p><p id="' + panelId + '-capacity" data-note-capacity role="status"></p><label>이어 쓸 앱<select name="appId">' + editorOptions(draft.appId) + '</select></label><label>다음에 할 일<input name="title" maxlength="240" required aria-describedby="' + panelId + '-capacity" value="' + esc(draft.title) + '" placeholder="예: 다음 학습에서 확인할 내용 정리하기"></label><button type="submit" data-note-submit>계정에 메모 남기기</button><button type="button" data-cloud="cancel-edit" hidden>수정 취소</button></form><div class="continuity-undo" data-note-undo hidden><p role="status" data-note-undo-message></p><button type="button" data-cloud="undo-note">삭제 되돌리기</button><p data-note-undo-detail></p></div><div class="continuity-note-tools"><label>메모 검색<input type="search" data-note-search placeholder="메모 내용이나 앱 이름" aria-label="메모 검색"></label><label>메모 상태<select data-note-filter><option value="all">모두</option><option value="pending">미완료</option><option value="done">완료</option></select></label></div><div class="continuity-notes">' + nextNotes + "</div><p>최근 기록은 앱을 연 시각일 뿐, 학습 결과가 아니에요.</p>") : "<p>로그인하면 계정 라이브러리를 켤 수 있어요. 이 기기의 바로가기는 그대로 남아요.</p>";
    }
    renderedNotes = nextNotes;
    renderedCatalog = catalog;
    renderedFavorites = nextFavorites;
    for (const el of content.querySelectorAll("button,input,select")) el.disabled = !editable;
    for (const el of content.querySelectorAll("[data-order-edge]")) el.disabled = true;
    const search = content.querySelector("[data-note-search]"), filter = content.querySelector("[data-note-filter]");
    if (search) search.value = noteQuery;
    if (filter) filter.value = noteFilter;
    noteControls(editable);
    recoveryControls();
    summary();
    onChange();
    void recovery.refresh();
  }
  async function change(action) {
    if (!notebook?.canEdit) throw new Error("계정 라이브러리가 아직 준비되지 않았어요. 잠시 뒤 다시 해 주세요.");
    const expected = modeVersion, next = updatePlatformLibrary(doc, action, Date.now(), entryIds());
    const favoriteChange = ['favorite', 'move-favorite'].includes(action.type) && favoriteSignature(next) !== favoriteSignature(doc)
      ? { version: expected, owner: documentOwner, signature: favoriteSignature(next) } : null;
    if (favoriteChange) favoriteIntent = favoriteChange;
    doc = next;
    message = "";
    const result = notebook.change(next);
    render();
    if (!await result) {
      if (favoriteIntent === favoriteChange) favoriteIntent = null;
      if (expected !== modeVersion) return false;
      throw new Error("변경을 보관하지 못했어요. 「저장 다시 시도」를 눌러 주세요.");
    }
    return true;
  }
  async function connectLibrary() {
    if (notebook || connecting || disposed) return;
    connecting = true;
    message = "";
    connect.disabled = true;
    connect.setAttribute("aria-busy", "true");
    connect.textContent = "연결 준비 중…";
    summary();
    try {
      await ensureReady();
      if (disposed) return;
      if (pageSuspended) {
        connectOnResume = true;
        return;
      }
      const host = getHost();
      if (!host || !native && !host.identity()?.configured) throw new Error("로그인 설정을 못 불러왔어요. 「계정 라이브러리 연결」을 다시 눌러 주세요.");
      const device = getDevice(), favorites = (device.favorites || []).filter((id2) => PLATFORM_APP_IDS.includes(id2));
      doc = validatePlatformLibrary({ ...emptyPlatformLibrary(), consent: true, favorites: [...new Set(favorites)], recent: (device.recent || []).filter((row) => PLATFORM_APP_IDS.includes(row.id)), rememberRecent: device.rememberRecent !== false });
      mount.hidden = false;
      content.hidden = false;
      root.querySelector("[data-connect]").hidden = true;
      initialExpansionPending = true;
      notebook = createAccountNotebook({
        resource: "platform-library",
        validateState: validatePlatformLibraryState,
        preferRemoteOnOpen: true,
        mount,
        content,
        description: "즐겨찾기, 최근 기록, 직접 적은 메모만 계정에 저장해요. 앱 안의 기록은 각 앱에 남아요.",
        getState: () => doc,
        applyState: (value, { guest = false } = {}) => {
          favoriteIntent = null;
          doc = validatePlatformLibrary(value);
          documentReady = !guest;
          clearNoteSession();
          draft = { appId: "world", title: "" };
          render({ captureDraft: false });
        },
        emptyDocument: emptyPlatformLibrary,
        storage,
        signOutLabel: native ? "로그아웃" : "계정 관리로 이동",
        deleteLabel: "계정 라이브러리 지우고 끄기",
        deleteConfirmation: "이 계정의 즐겨찾기, 최근 기록, 할 일 메모를 지우고 저장을 끌까요? 다른 기기에서도 다시 불러올 수 없어요. 각 앱 안의 기록은 그대로예요.",
        onStatusChange: () => queueMicrotask(render), statusLabel: (text, { active, status }) => active && status === "synced" && !doc.consent ? "계정 저장 꺼짐" : text, detailLabel: (text, { active, status, problem }) => active && !problem && status === "synced" && !doc.consent ? "아직 이 계정에는 저장하지 않았어요. 아래에서 「계정 저장 켜기」를 누르면 저장해요." : text,
        // change() only queues the edit. Observe the validated server ACK, and
        // only the latest still-visible choice in the same account generation.
        onDocumentSaved: value => {
          const intent = favoriteIntent;
          if (!intent || disposed || pageSuspended || intent.version !== modeVersion || intent.owner !== documentOwner
            || favoriteSignature(value) !== intent.signature || favoriteSignature(doc) !== intent.signature) return;
          favoriteIntent = null;
          void Promise.resolve().then(() => {
            if (!disposed && !pageSuspended && intent.version === modeVersion && intent.owner === documentOwner) return onFavoritesChanged();
          }).catch(() => {});
        },
        onDocumentRemoved: () => { favoriteIntent = null;void recovery.clear(); },
        beforeNavigate: () => {
          if (!hasUnsavedDraft()) return true;
          if (!globalThis.confirm("작성 중인 메모를 닫을까요?")) return false;
          discardDraft();
          return true;
        },
        accountFactory: (options) => (accountAdapter = platformLibraryAccount({ host, native, onLogin, onManage, onStatus: (value) => {
          if (nativeVerificationNotice && (value.signedIn || value.error?.code !== 'SUITE_UNAVAILABLE' || value.accountId !== nativeVerificationNotice.accountId || value.sessionGeneration !== nativeVerificationNotice.generation)) {
            if (message === nativeVerificationNotice.text) message = '';
            nativeVerificationNotice = null;
          }
          const nextOwner = value.signedIn ? value.accountId : null;
          if (nextOwner !== documentOwner && (nextOwner || !["restoring", "signing-in", "error"].includes(value.status))) {
            documentOwner = nextOwner;
            documentReady = false;
          }
          if (recoveryOwner !== nextOwner) { recoveryOwner = nextOwner; recovery.reset(); }
          modeVersion++;
          options.onStatus(value);
          queueMicrotask(render);
        } })),
        onMode: () => queueMicrotask(render)
      });
      mount.querySelector("[data-notebook-status]").hidden = true;await notebook.start();
      if (!notebook.active) {
        initialExpansionPending = false;
        expand(true);
      }
      render();
    } catch (error) {
      if (!disposed) {
        message = error.message || "계정 라이브러리를 켜지 못했어요. 다시 눌러 주세요.";
        summary();
      }
    } finally {
      connecting = false;
      notifyReady();
      if (!disposed) {
        connect.disabled = false;
        connect.setAttribute("aria-busy", "false");
        connect.textContent = "계정 라이브러리 연결";
        summary();
      }
    }
  }
  connect.onclick = connectLibrary;
  toggle.onclick = () => {
    capture();
    initialExpansionPending = false;
    expand(panel.hidden);
    summary();
  };
  resumeButton.onclick = () => {
    capture();
    if (draft.title.trim() || parkedDraft?.title.trim()) {
      focusDraft();
      return;
    }
    if (resumeId) onOpen(platformAppId(resumeId));
  };
  content.addEventListener("input", (event) => {
    if (event.target.matches("[data-note-search]")) {
      if (event.isComposing) return;
      noteQuery = event.target.value;
      render();
      return;
    }
    capture();
    summary();
    recovery.schedule();
  });
  content.addEventListener("compositionend", (event) => {
    if (event.target.matches("[data-note-search]")) { noteQuery = event.target.value; render(); }
  });
  content.addEventListener("change", (event) => {
    if (event.target.matches("[data-note-filter]")) {
      noteFilter = ["all", "pending", "done"].includes(event.target.value) ? event.target.value : "all";
      render();
      return;
    }
    if (event.target.matches("[name=appId]")) { capture(); recovery.schedule(); }
    if (event.target.dataset.cloud === "remember") void change({ type: "remember", value: event.target.checked }).catch((error) => {
      message = error.message;
      render();
    });
  });
  content.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cloud]");
    if (!button || button.disabled) return;
    const action = button.dataset.cloud, id2 = button.dataset.id;
    if (action === "open") {
      if (hasUnsavedDraft() && !globalThis.confirm("작성 중인 메모를 닫고 이동할까요?")) return;
      onOpen(platformAppId(id2));
      return;
    }
    if (!notebook?.canEdit) return;
    if (action === "recover-draft") {
      if (hasUnsavedDraft() && !globalThis.confirm("지금 쓰는 내용을 닫고 이 기기의 임시 저장본을 열까요?")) return;
      const saved = recovery.take();
      if (!saved) return;
      const original = saved.editing && doc.notes.find((row) => row.id === saved.editing.id);
      editing = original && original.title === saved.editing.title && original.appId === saved.editing.appId ? { ...original } : null;
      parkedDraft = saved.parkedDraft;
      setEditorDraft(saved.draft);
      message = saved.editing && !editing ? "원래 메모가 바뀌어 되살린 내용을 새 메모로 열었어요. 확인한 뒤 저장해 주세요." : "쓰던 메모를 되살렸어요. 확인한 뒤 계정에 저장해 주세요.";
      render();
      focusDraft();
      void recovery.persist();
      return;
    }
    if (action === "discard-recovery") { void recovery.discard(); return; }
    if (action === "show-completed") {
      completedExpanded = !completedExpanded;
      render();
      content.querySelector('[data-cloud="show-completed"]')?.focus?.();
      return;
    }
    if (action === "edit-note") {
      beginEditing(id2);
      return;
    }
    if (action === "cancel-edit") {
      finishEditing();
      message = "";
      render();
      focusDraft();
      return;
    }
    let operation;
    if (action === "remove-note") {
      const index = doc.notes.findIndex((row) => row.id === id2);
      if (index < 0) return;
      if (editing?.id === id2) {
        capture();
        if ((draft.title !== editing.title || draft.appId !== editing.appId) && !globalThis.confirm("수정 중인 내용을 취소하고 이 메모를 삭제할까요?")) return;
        finishEditing();
      }
      const entry = { note: structuredClone(doc.notes[index]), index };
      operation = change({ type: action, noteId: id2 });
      if (!doc.notes.some((row) => row.id === id2)) {
        deletedNotes.push(entry);
        deletedNotes = deletedNotes.slice(-PLATFORM_NOTE_LIMIT);
        render();
        content.querySelector('[data-cloud="undo-note"]')?.focus?.();
      }
    } else if (action === "undo-note") {
      const entry = deletedNotes.at(-1);
      if (!entry) return;
      operation = change({ type: "restore-note", note: entry.note, index: Math.min(entry.index, doc.notes.length) });
      if (doc.notes.some((row) => row.id === entry.note.id)) {
        deletedNotes.pop();
        if (entry.note.done) completedExpanded = true;
        render();
      }
    } else if (action === "favorite-up" || action === "favorite-down") {
      operation = change({ type: "move-favorite", id: id2, direction: action === "favorite-up" ? -1 : 1 });
      const focus = content.querySelector('[data-cloud="' + action + '"][data-id="' + id2 + '"]');
      if (focus?.disabled) content.querySelector('[data-cloud="' + (action === "favorite-up" ? "favorite-down" : "favorite-up") + '"][data-id="' + id2 + '"]')?.focus?.();
      else focus?.focus?.();
    } else operation = change(action === "enable" ? { type: "consent", value: true } : action === "favorite" ? { type: "favorite", id: id2 } : { type: action, noteId: id2 });
    const expected = modeVersion;
    void operation.catch((error) => {
      if (expected !== modeVersion || disposed) return;
      message = error.message;
      render();
    });
  });
  content.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-note-form]")) return;
    event.preventDefault();
    if (submitting || !notebook?.canEdit) return;
    capture();
    const expected = modeVersion;
    submitting = true;
    void change(editing ? { type: "edit-note", noteId: editing.id, id: draft.appId, title: draft.title } : { type: "note", id: draft.appId, title: draft.title }).then(() => {
      if (expected !== modeVersion || disposed) return;
      if (editing) finishEditing();
      else { const next = parkedDraft || { ...draft, title: "" }; parkedDraft = null; setEditorDraft(next); }
      render();
    }).catch((error) => {
      if (expected !== modeVersion || disposed) return;
      message = error.message;
      render();
    }).finally(() => {
      submitting = false;
      if (!disposed) render();
    });
  });
  const suspend = () => {
    capture();
    void recovery.persist();
    pageSuspended = true;
    notifyReady();
    notebook?.suspend();
    summary();
  }, resume = () => {
    pageSuspended = false;
    notebook?.resume();
    render();
    if (connectOnResume) {
      connectOnResume = false;
      void connectLibrary();
    }
  };
  const beforeUnload = (event) => {
    void recovery.persist();
    if (hasUnsavedDraft()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  globalThis.addEventListener("pagehide", suspend);
  globalThis.addEventListener("pageshow", resume);
  globalThis.addEventListener("beforeunload", beforeUnload);
  return {
    connect: connectLibrary,
    ready,
    connected: () => !!notebook?.active && doc.consent,
    projection() {
      return notebook?.active && notebook.canEdit && doc.consent ? projectPlatformLibrary(doc, { appIds: entryIds() }) : null;
    },
    async dispatch(action) {
      if (!notebook?.active || !doc.consent) return false;
      return change(action);
    },
    hasPending: () => !!notebook?.pending,
    hasUnsavedDraft,
    discardDraft,
    flushDraft: () => recovery.persist(),
    focusDraft,
    searchNotes(query = "", { limit = 8 } = {}) {
      if (pageSuspended || disposed || !notebook?.active || !notebook.canEdit || !doc.consent) return [];
      return matchingNotes(query).sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt).slice(0, Math.max(0, Math.min(60, Number.isInteger(limit) ? limit : 8))).map((row) => ({ ...row }));
    },
    openNote(id) {
      if (pageSuspended || disposed || !notebook?.active || !notebook.canEdit || !doc.consent || !doc.notes.some((row) => row.id === id)) return false;
      noteQuery = "";
      noteFilter = "all";
      if (doc.notes.find((row) => row.id === id).done) completedExpanded = true;
      expand(true);
      render();
      const card = content.querySelector('[data-note-id="' + id + '"]');
      card?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
      card?.focus?.({ preventScroll: true });
      return true;
    },
    dispose() {
      disposed = true;
      notifyReady();
      if (native) mount.removeEventListener?.('click', verifyNativeConnection, true);
      recovery.dispose();
      notebook?.dispose();
      globalThis.removeEventListener("pagehide", suspend);
      globalThis.removeEventListener("pageshow", resume);
      globalThis.removeEventListener("beforeunload", beforeUnload);
    },
    render
  };
}
