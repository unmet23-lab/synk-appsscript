(function () {
  'use strict';

  var PROVIDERS = ['gmail', 'naver', 'outlook'];
  var PROVIDER_LABELS = {
    gmail: 'Gmail',
    naver: '네이버',
    outlook: 'Outlook'
  };
  var HANDOFF_TARGETS = ['견적 담당', '디자인 담당', '고객지원 담당'];
  var TAX_OPTIONS = [
    { value: 'undecided', label: '부가세 미정' },
    { value: 'add10', label: '부가세 10% 추가' },
    { value: 'none', label: '부가세 없음' }
  ];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function normalizeThreadStatus(thread) {
    if (!thread) return 'excluded';
    var s = String(thread.status || '').trim().toLowerCase();
    if (s === 'reply' || s === 'promise' || s === 'draft') {
      return s;
    }
    if (s === 'review') {
      return 'review';
    }
    if (s === 'waiting') {
      return 'waiting';
    }
    if (
      s === 'done' ||
      s === 'marked' ||
      s === 'completed' ||
      s === 'closed' ||
      s === 'resolved' ||
      s === 'handled' ||
      thread.status === '완료'
    ) {
      return 'done';
    }
    if (s === 'excluded' || s === 'spam' || s === 'auto') {
      return 'excluded';
    }
    return 'review';
  }

  function getThreadBucket(thread) {
    var st = normalizeThreadStatus(thread);
    if (st === 'reply' || st === 'promise' || st === 'draft') {
      return 'action';
    }
    if (st === 'review') {
      return 'review';
    }
    if (st === 'waiting' || st === 'done') {
      return 'waiting_done';
    }
    return 'excluded';
  }

  function isActionableThread(thread) {
    return getThreadBucket(thread) === 'action';
  }

  function threadStatusLabel(thread) {
    var st = normalizeThreadStatus(thread);
    if (st === 'reply') return '답장 필요';
    if (st === 'promise') return '약속';
    if (st === 'draft') return '미발송';
    if (st === 'review') return '직접 확인';
    if (st === 'waiting') return '회신 대기';
    if (st === 'done') return '완료';
    return '자동·스팸';
  }

  function isHandoffFinished(item) {
    if (!item) return false;
    var s = String(item.status || item.phase || '').toLowerCase();
    return (
      s === 'done' ||
      s === 'finished' ||
      s === 'completed' ||
      s === 'closed' ||
      Boolean(item.finishedAt) ||
      item.status === '완료'
    );
  }

  function isHandoffAccepted(item) {
    if (!item || isHandoffFinished(item)) return false;
    var s = String(item.status || item.phase || '').toLowerCase();
    return (
      s === 'accepted' ||
      s === 'in_progress' ||
      s === 'working' ||
      s === 'active' ||
      Boolean(item.acceptedAt) ||
      item.accepted === true ||
      item.status === '접수'
    );
  }

  function formatSubtotal(val) {
    if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) {
      return '미정';
    }
    return Number(val).toLocaleString('ko-KR') + '원';
  }

  function formatTax(val) {
    if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) {
      return '부가세 미정';
    }
    return Number(val).toLocaleString('ko-KR') + '원';
  }

  function formatTotal(val) {
    if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) {
      return '부가세 미정 (합계 보류)';
    }
    return Number(val).toLocaleString('ko-KR') + '원';
  }

  function parseOptionalInt(raw) {
    var trimmed = String(raw === null || raw === undefined ? '' : raw).trim();
    if (trimmed === '') {
      return { blank: true, valid: true, value: null };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { blank: false, valid: false, value: null };
    }
    return { blank: false, valid: true, value: parseInt(trimmed, 10) };
  }

  function phaseLabel(phase) {
    var p = String(phase || '').trim().toLowerCase();
    if (p === 'complete' || p === 'completed') {
      return '전체 확인 완료';
    }
    if (p === 'partial') {
      return '일부 확인됨';
    }
    if (p === 'scanning' || p === 'syncing' || p === 'checking' || p === 'running' || p === 'reading' || p === 'loading') {
      return '확인 중';
    }
    if (p === 'ready' || p === 'connected' || p === 'idle' || p === 'ok') {
      return '연결됨';
    }
    if (p === 'error' || p === 'failed') {
      return '점검 필요';
    }
    if (p === 'pending' || p === 'waiting' || p === 'queued' || p === '') {
      return '대기';
    }
    if (/[가-힣]/.test(String(phase))) {
      return String(phase);
    }
    return '상태 확인';
  }

  function formatKoreanTime(val) {
    if (val === null || val === undefined) return '';
    var s = String(val).trim();
    if (!s) return '';
    if (/[가-힣]/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var dp = s.split('-');
      return Number(dp[0]) + '년 ' + Number(dp[1]) + '월 ' + Number(dp[2]) + '일';
    }
    var d = new Date(typeof val === 'number' ? val : s);
    if (!Number.isNaN(d.getTime())) {
      var y = d.getFullYear();
      var m = d.getMonth() + 1;
      var day = d.getDate();
      var hr = d.getHours();
      var min = d.getMinutes();
      var ampm = hr < 12 ? '오전' : '오후';
      var hr12 = hr % 12 || 12;
      var minStr = min < 10 ? '0' + min : String(min);
      return y + '년 ' + m + '월 ' + day + '일 ' + ampm + ' ' + hr12 + ':' + minStr;
    }
    return '확인 기록 있음';
  }

  function getThreadExcerpt(thread) {
    if (!thread) return '';
    if (thread.excerpt !== undefined && thread.excerpt !== null && String(thread.excerpt).trim() !== '') {
      return String(thread.excerpt).trim();
    }
    if (thread.evidence !== undefined && thread.evidence !== null && String(thread.evidence).trim() !== '') {
      return String(thread.evidence).trim();
    }
    return '';
  }

  function getThreadEvidenceKey(thread) {
    if (!thread) return '';
    var eid = thread.evidenceId !== undefined && thread.evidenceId !== null ? String(thread.evidenceId) : '';
    return eid + '::' + getThreadExcerpt(thread);
  }

  function isExactIsoDate(val) {
    if (val == null || typeof val === 'object') return false;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(val).trim());
    if (!m) return false;
    var year = Number(m[1]);
    var month = Number(m[2]);
    var day = Number(m[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    var isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    var maxDay = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    return day <= maxDay;
  }

  function createEmptyQuoteForm(thread) {
    return {
      referenceId: '',
      title: '',
      scope: '',
      deadline: '',
      deadlineMode: 'exact',
      terms: '',
      quantity: '',
      buildMinutes: '',
      revisionMinutes: '',
      hourlyRate: '',
      directCost: '',
      subcontractCost: '',
      allocation: '',
      taxMode: 'undecided',
      replyFormat: 'paragraph',
      loadedEvidenceKey: thread ? getThreadEvidenceKey(thread) : null,
      loadedEvidenceId: thread && thread.evidenceId != null ? String(thread.evidenceId) : null,
      stale: false
    };
  }

  function createEmptyJobForm() {
    return {
      title: '',
      scope: '',
      deadline: '',
      deadlineMode: 'exact',
      terms: '',
      quantity: '',
      buildMinutes: '',
      revisionMinutes: '',
      directCost: '',
      subcontractCost: ''
    };
  }

  function createEmptyHandoffForm(thread) {
    return {
      to: HANDOFF_TARGETS[0],
      conditions: '',
      next: '',
      due: '',
      dueMode: 'exact',
      reference: '',
      loadedEvidenceKey: thread ? getThreadEvidenceKey(thread) : null,
      loadedEvidenceId: thread && thread.evidenceId != null ? String(thread.evidenceId) : null,
      confirmedEvidenceKey: null,
      confirmedEvidenceId: null,
      stale: false
    };
  }

  function hasQuoteUserEdits(qf) {
    if (!qf) return false;
    var keys = [
      'referenceId',
      'title',
      'scope',
      'deadline',
      'terms',
      'quantity',
      'buildMinutes',
      'revisionMinutes',
      'hourlyRate',
      'directCost',
      'subcontractCost',
      'allocation'
    ];
    for (var i = 0; i < keys.length; i++) {
      if (String(qf[keys[i]] || '').trim() !== '') return true;
    }
    return Boolean(
      (qf.taxMode && qf.taxMode !== 'undecided') ||
      (qf.deadlineMode && qf.deadlineMode !== 'exact') ||
      (qf.replyFormat && qf.replyFormat !== 'paragraph')
    );
  }

  function hasHandoffUserEdits(hf) {
    if (!hf) return false;
    var keys = ['conditions', 'next', 'due', 'reference'];
    for (var i = 0; i < keys.length; i++) {
      if (String(hf[keys[i]] || '').trim() !== '') return true;
    }
    return Boolean(hf.confirmedEvidenceKey) || Boolean(hf.to && hf.to !== HANDOFF_TARGETS[0]);
  }

  function mountApp() {
    var root = document.getElementById('estimate-root');
    if (!root) return;

    var hasLiveApi = Boolean(window.solioEstimate);
    var hasPortableDemo = !hasLiveApi && Boolean(window.solioEstimateDemo);
    var api = hasLiveApi ? window.solioEstimate : (hasPortableDemo ? window.solioEstimateDemo : null);
    if (!api) {
      clearNode(root);
      var unavailableWrap = el('div', 'shell');
      unavailableWrap.appendChild(el('p', 'notice', '견적 비서를 열지 못했어요. 솔리오에서 다시 열어 주세요.'));
      root.appendChild(unavailableWrap);
      return;
    }

    var state = {
      data: {
        boxes: [],
        threads: [],
        jobs: [],
        quotes: [],
        handoffs: [],
        capabilities: {
          providers: PROVIDERS.slice(),
          readyProviders: [],
          connect: false,
          connectionNote: ''
        },
        hasMore: false,
        scanning: false
      },
      activeTab: 'mail',
      pendingScan: false,
      busyCount: 0,
      noticeText: '',
      noticeError: false,
      selectedBoxId: null,
      confirmDisconnectBoxId: null,
      connectForm: {
        provider: 'gmail',
        address: '',
        password: ''
      },
      renderedConnectKey: '',
      openBuckets: {
        review: false,
        waiting_done: false,
        excluded: false
      },
      openHandoffDocs: {},
      quoteThreadId: null,
      quoteThreadCache: {},
      quoteForms: {},
      jobFormOpen: false,
      jobForm: createEmptyJobForm(),
      handoffThreadId: null,
      handoffThreadCache: {},
      handoffForms: {},
      handoffFilter: 'all'
    };

    var refs = {
      shell: el('div', 'shell'),
      topRegion: el('header', 'section'),
      connectionsView: el('div', ''),
      mailView: el('div', ''),
      quoteView: el('div', ''),
      handoffView: el('div', ''),

      boxesListRegion: el('div', ''),
      boxConnectWrapper: el('section', 'section'),
      boxConnectHeader: el('div', ''),
      boxConnectProviderRow: el('div', 'actions'),
      boxConnectBody: el('div', ''),
      naverPasswordInput: null,
      connectSubmitBtn: null,
      threadsRegion: el('div', ''),

      quoteThreadsRegion: el('section', 'section'),
      quoteJobsRegion: el('section', 'section'),
      jobFormSection: el('section', 'section'),
      jobSubmitBtn: null,
      quoteEditorSection: el('section', 'section'),
      quoteFormHeader: el('div', ''),
      quoteFormFields: el('div', ''),
      quoteSubmitBtn: null,
      quotesListRegion: el('section', 'section'),

      handoffPickerRegion: el('section', 'section'),
      handoffEditorSection: el('section', 'section'),
      handoffFormHeader: el('div', ''),
      handoffFormFields: el('div', ''),
      handoffSubmitBtn: null,
      handoffListRegion: el('section', 'section')
    };

    refs.boxConnectWrapper.appendChild(refs.boxConnectHeader);
    refs.boxConnectWrapper.appendChild(refs.boxConnectProviderRow);
    refs.boxConnectWrapper.appendChild(refs.boxConnectBody);

    refs.connectionsView.appendChild(refs.boxConnectWrapper);
    refs.connectionsView.appendChild(refs.boxesListRegion);

    refs.mailView.appendChild(refs.threadsRegion);

    refs.quoteEditorSection.appendChild(refs.quoteFormHeader);
    refs.quoteEditorSection.appendChild(refs.quoteFormFields);

    refs.quoteView.appendChild(refs.quoteThreadsRegion);
    refs.quoteView.appendChild(refs.quoteJobsRegion);
    refs.quoteView.appendChild(refs.jobFormSection);
    refs.quoteView.appendChild(refs.quoteEditorSection);
    refs.quoteView.appendChild(refs.quotesListRegion);

    refs.handoffEditorSection.appendChild(refs.handoffFormHeader);
    refs.handoffEditorSection.appendChild(refs.handoffFormFields);

    refs.handoffView.appendChild(refs.handoffPickerRegion);
    refs.handoffView.appendChild(refs.handoffEditorSection);
    refs.handoffView.appendChild(refs.handoffListRegion);

    refs.shell.appendChild(refs.topRegion);
    refs.shell.appendChild(refs.connectionsView);
    refs.shell.appendChild(refs.mailView);
    refs.shell.appendChild(refs.quoteView);
    refs.shell.appendChild(refs.handoffView);

    clearNode(root);
    root.appendChild(refs.shell);

    function isDemoMode() {
      return hasPortableDemo;
    }

    var origState = { seq: 0, active: null, dialog: null, title: null, meta: null, note: null, body: null, closeBtn: null, expandedChoices: Object.create(null) };

    const displayedReceiptMap = new Map();

    function displayedReceiptKey(ctx) {
      const parts = [ctx?.memberKey ?? '', ctx?.boxId ?? '', ctx?.threadId ?? '', ctx?.evidenceId ?? ''];
      return parts.some(Boolean) ? JSON.stringify(parts) : '';
    }

    function displayedReceiptToken(ctx) {
      const token = ctx?.thread?.receiptToken || '';
      return token && displayedReceiptMap.get(displayedReceiptKey(ctx)) === token ? token : '';
    }

    function rememberDisplayedReceipt(ctx, token) {
      const key = displayedReceiptKey(ctx);
      if (!key || !token) return;
      displayedReceiptMap.delete(key);
      displayedReceiptMap.set(key, token);
      while (displayedReceiptMap.size > 100) {
        displayedReceiptMap.delete(displayedReceiptMap.keys().next().value);
      }
    }

    function isOrigAuthValid() {
      if (!state || !state.data) return false;
      if (state.authenticated === false || state.data.authenticated === false) return false;
      if (state.auth && state.auth.authenticated === false) return false;
      if (state.data.auth && state.data.auth.authenticated === false) return false;
      return true;
    }

    function pickOrigEntityId(obj, keys) {
      if (!obj) return '';
      if (typeof obj === 'string' || typeof obj === 'number') return String(obj).trim();
      if (typeof obj !== 'object') return '';
      for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]];
        if (typeof v === 'string' && v.trim()) return keys[i] + '=' + v.trim();
        if (typeof v === 'number' && isFinite(v)) return keys[i] + '=' + String(v);
      }
      return '';
    }

    function getOrigMemberKey(box) {
      var idKeys = ['id', 'memberId', 'userId', 'accountId', 'email', 'loginId'];
      var topKeys = ['memberId', 'userId', 'accountId', 'memberEmail', 'userEmail'];
      var d = (state && state.data) || null;
      return [
        pickOrigEntityId(state, topKeys),
        pickOrigEntityId(state && state.member, idKeys),
        pickOrigEntityId(state && state.user, idKeys),
        pickOrigEntityId(state && state.account, idKeys),
        pickOrigEntityId(state && state.auth, idKeys),
        pickOrigEntityId(d, topKeys),
        pickOrigEntityId(d && d.member, idKeys),
        pickOrigEntityId(d && d.user, idKeys),
        pickOrigEntityId(d && d.account, idKeys),
        pickOrigEntityId(d && d.auth, idKeys),
        pickOrigEntityId(d && d.session, idKeys),
        box ? String(box.id || '') : '',
        box ? String(box.email || '').trim().toLowerCase() : '',
        pickOrigEntityId(box, ['memberId', 'userId', 'accountId'])
      ].join('|');
    }

    function getOrigConvKey() {
      if (!state) return '';
      var handoffId = state.handoffThreadId || (state.handoff && typeof state.handoff === 'object' ? state.handoff.threadId : '') || '';
      return [
        String(state.quoteThreadId || ''),
        String(handoffId || ''),
        String(state.selectedThreadId || ''),
        String(state.activeThreadId || '')
      ].join('|');
    }

    function normalizeOriginalChoices(rawChoices) {
      if (!Array.isArray(rawChoices) || !rawChoices.length) return [];
      var list = [];
      var seenReadIds = Object.create(null);
      var subjCounts = Object.create(null);
      for (var i = 0; i < rawChoices.length; i++) {
        var item = rawChoices[i];
        if (!item || typeof item !== 'object') continue;
        var readId = typeof item.readId === 'string'
          ? item.readId.trim()
          : (typeof item.readId === 'number' && isFinite(item.readId) ? String(item.readId) : '');
        if (!readId || seenReadIds[readId]) continue;
        seenReadIds[readId] = true;
        var label = typeof item.label === 'string' ? item.label.trim() : '';
        var subject = typeof item.subject === 'string' ? item.subject.trim() : '';
        var baseSubject = subject || '(제목 없음)';
        subjCounts[baseSubject] = (subjCounts[baseSubject] || 0) + 1;
        list.push({ readId: readId, label: label, subject: subject, baseSubject: baseSubject });
      }
      var subjSeen = Object.create(null);
      var usedSubjects = Object.create(null);
      for (var j = 0; j < list.length; j++) {
        var c = list[j];
        var total = subjCounts[c.baseSubject] || 0;
        c.displayLabel = c.label || ('후보 ' + (j + 1));
        var disp = c.baseSubject;
        if (total > 1 || usedSubjects[disp]) {
          var n = (subjSeen[c.baseSubject] || 0) + 1;
          subjSeen[c.baseSubject] = n;
          disp = c.baseSubject + ' (' + n + ')';
          while (usedSubjects[disp] || (disp !== c.baseSubject && subjCounts[disp])) {
            n++;
            subjSeen[c.baseSubject] = n;
            disp = c.baseSubject + ' (' + n + ')';
          }
        }
        usedSubjects[disp] = true;
        c.displaySubject = disp;
      }
      return list;
    }

    function getChoicesSig(choices) {
      if (!Array.isArray(choices)) return '';
      var out = [];
      for (var i = 0; i < choices.length; i++) {
        out.push(choices[i].readId + '\t' + choices[i].displayLabel + '\t' + choices[i].displaySubject);
      }
      return out.join('\n');
    }

    function findOriginalChoice(ctx, readId) {
      if (!ctx || !ctx.choiceMode || !readId || !Array.isArray(ctx.choices)) return null;
      for (var i = 0; i < ctx.choices.length; i++) {
        if (ctx.choices[i].readId === readId) return ctx.choices[i];
      }
      return null;
    }

    function sameOriginalTarget(cur, ref) {
      if (!cur || !ref) return false;
      if (cur.threadId !== ref.threadId || cur.boxId !== ref.boxId || cur.memberKey !== ref.memberKey) return false;
      if (Boolean(cur.choiceMode) !== Boolean(ref.choiceMode)) return false;
      if (ref.choiceMode) {
        if (ref.readId && !findOriginalChoice(cur, ref.readId)) return false;
        return Array.isArray(cur.choices) && cur.choices.length > 0;
      }
      return cur.evidenceId === ref.evidenceId;
    }

    function getOriginalCtx(threadOrId) {
      let thread = findThread(
        typeof threadOrId === 'string'
          ? threadOrId
          : (threadOrId && typeof threadOrId === 'object' ? threadOrId.id : null)
      );
      if (!thread || isDemoMode() || !isOrigAuthValid()) return null;
      if (!state.data || !Array.isArray(state.data.boxes)) return null;
      var box = state.data.boxes.find(function (item) { return item.id === thread.boxId; });
      if (!box) return null;
      var memberKey = getOrigMemberKey(box);
      var evId = typeof thread.evidenceId === 'string'
        ? thread.evidenceId.trim()
        : (thread.evidenceId == null ? '' : String(thread.evidenceId).trim());
      if (thread.awaitingEvidence) {
        if (evId) return null;
        var choices = normalizeOriginalChoices(thread.originalChoices);
        if (!choices.length) return null;
        return {
          thread: thread, box: box, threadId: thread.id, evidenceId: '', boxId: box.id,
          memberKey: memberKey, choiceMode: true, choices: choices,
          directOriginal: false, canReadOriginal: true, canOpenMailbox: true
        };
      }
      if (!evId) return null;
      return {
        thread: thread, box: box, threadId: thread.id, evidenceId: evId, boxId: box.id,
        memberKey: memberKey, choiceMode: false, choices: [],
        directOriginal: thread.directOriginal === true, canReadOriginal: thread.canReadOriginal === true,
        canOpenMailbox: true
      };
    }

    function onOrigKeydown(e) {
      if (origState.active && (e.key === 'Escape' || e.key === 'Esc')) {
        e.preventDefault();
        closeOriginalDialog(true);
      }
    }

    function closeOriginalDialog(restoreFocus) {
      var prev = origState.active;
      origState.active = null;
      origState.seq++;
      document.removeEventListener('keydown', onOrigKeydown, true);
      var dlg = origState.dialog;
      if (dlg) {
        origState.title.textContent = '';
        origState.meta.textContent = '';
        origState.note.textContent = '';
        origState.note.hidden = true;
        origState.body.textContent = '';
        if (typeof dlg.close === 'function' && dlg.open) {
          try { dlg.close(); } catch (_) {}
        }
        dlg.removeAttribute('open');
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      }
      if (restoreFocus && prev) {
        var target = prev.opener && prev.opener.isConnected ? prev.opener : null;
        if (!target && prev.openerKey) {
          var scopeRoot = prev.inQuoteHeader && refs.quoteFormHeader ? refs.quoteFormHeader : refs.shell;
          var list = scopeRoot.querySelectorAll('button[data-orig-key]');
          for (var i = 0; i < list.length; i++) {
            if (list[i].getAttribute('data-orig-key') === prev.openerKey) { target = list[i]; break; }
          }
        }
        if (target && !target.disabled && typeof target.focus === 'function') target.focus();
      }
    }

    function syncOriginalContext() {
      var expKeys = Object.keys(origState.expandedChoices);
      for (var i = 0; i < expKeys.length; i++) {
        var expKey = expKeys[i];
        var exp = origState.expandedChoices[expKey];
        var expCur = exp ? getOriginalCtx(exp.threadId) : null;
        var invalidQuoteScope = exp && exp.scope === 'quote' && state.quoteThreadId !== exp.threadId;
        if (!exp || invalidQuoteScope || !expCur || !expCur.choiceMode || expCur.boxId !== exp.boxId || expCur.memberKey !== exp.memberKey) {
          if (exp && exp.panel) {
            exp.panel.textContent = '';
            exp.panel.hidden = true;
          }
          if (exp && exp.toggleBtn) {
            exp.toggleBtn.setAttribute('aria-expanded', 'false');
          }
          delete origState.expandedChoices[expKey];
        } else if (exp.panel && !exp.panel.hidden) {
          var nextSig = getChoicesSig(expCur.choices);
          if (nextSig !== exp.sig) {
            exp.sig = nextSig;
            fillOriginalChoicePanel(exp.panel, expCur);
          }
        }
      }
      var act = origState.active;
      if (!act) return;
      if (state.quoteThreadId !== act.quoteThreadId || getOrigConvKey() !== act.convKey) {
        closeOriginalDialog(false);
        return;
      }
      var cur = getOriginalCtx(act.threadId);
      if (!sameOriginalTarget(cur, act) || !cur.canReadOriginal) {
        closeOriginalDialog(false);
      }
    }

    function matchDoneAction(req) {
      if (!req || req.seq !== origState.seq) return null;
      if (state.quoteThreadId !== req.quoteThreadId || getOrigConvKey() !== req.convKey) return null;
      var cur = getOriginalCtx(req.threadId);
      if (!sameOriginalTarget(cur, req)) return null;
      return cur;
    }

    function ensureOrigDialog() {
      if (origState.dialog) return origState.dialog;
      var dlg = el('dialog', 'card');
      dlg.setAttribute('aria-modal', 'true');
      dlg.style.cssText = 'position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(680px,92vw);max-width:92vw;max-height:85vh;overflow-y:auto;overflow-x:hidden;padding:16px;';
      dlg.addEventListener('cancel', function (e) {
        e.preventDefault();
        closeOriginalDialog(true);
      });
      var head = el('div', 'row');
      var headText = el('div', '');
      var title = el('h3', '', '');
      title.id = 'solio-orig-title';
      dlg.setAttribute('aria-labelledby', title.id);
      var meta = el('p', 'muted', '');
      headText.appendChild(title);
      headText.appendChild(meta);
      var act = el('div', 'actions');
      var closeBtn = el('button', '', '닫기');
      closeBtn.type = 'button';
      closeBtn.addEventListener('click', function () { closeOriginalDialog(true); });
      act.appendChild(closeBtn);
      head.appendChild(headText);
      head.appendChild(act);
      var note = el('p', 'muted', '');
      note.hidden = true;
      var body = el('div', '', '');
      body.style.cssText = 'margin-top:12px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;';
      dlg.appendChild(head);
      dlg.appendChild(note);
      dlg.appendChild(body);
      origState.dialog = dlg;
      origState.title = title;
      origState.meta = meta;
      origState.note = note;
      origState.body = body;
      origState.closeBtn = closeBtn;
      return dlg;
    }

    function runOriginalAction(kind, ctx, btn, openerKey, readId) {
      if (!api || typeof api.action !== 'function') return;
      var targetReadId = ctx && ctx.choiceMode && typeof readId === 'string' ? readId.trim() : '';
      var checkRef = ctx ? {
        threadId: ctx.threadId,
        boxId: ctx.boxId,
        memberKey: ctx.memberKey,
        choiceMode: Boolean(ctx.choiceMode),
        evidenceId: ctx.evidenceId,
        readId: targetReadId
      } : null;
      var curCtx = ctx ? getOriginalCtx(ctx.threadId) : null;
      var validKind = curCtx && (curCtx.choiceMode
        ? (Boolean(targetReadId) && (kind === 'readOriginal' || kind === 'openMailbox'))
        : (kind === 'openMailbox' ? curCtx.canOpenMailbox : (kind === 'openOriginal' ? curCtx.directOriginal : (kind === 'readOriginal' && curCtx.canReadOriginal))));
      if (!curCtx || !validKind || !sameOriginalTarget(curCtx, checkRef)) {
        closeOriginalDialog(false);
        setNotice('메일함을 다시 확인하고 현재 문의를 열어 주세요.',true,btn);
        return;
      }
      if (origState.active) closeOriginalDialog(false);
      var seq = ++origState.seq;
      var req = {
        seq: seq,
        threadId: curCtx.threadId,
        evidenceId: curCtx.evidenceId,
        readId: targetReadId,
        choiceMode: curCtx.choiceMode,
        boxId: curCtx.boxId,
        memberKey: curCtx.memberKey,
        quoteThreadId: state.quoteThreadId,
        convKey: getOrigConvKey()
      };
      if (kind === 'readOriginal' || (kind === 'openOriginal' && curCtx && curCtx.thread && curCtx.thread.needsReceiptReview === true)) {
        var curChoice = curCtx.choiceMode ? findOriginalChoice(curCtx, req.readId) : null;
        origState.active = {
          seq: seq,
          threadId: req.threadId,
          evidenceId: req.evidenceId,
          readId: req.readId,
          choiceMode: req.choiceMode,
          boxId: req.boxId,
          memberKey: req.memberKey,
          quoteThreadId: req.quoteThreadId,
          convKey: req.convKey,
          opener: btn,
          openerKey: openerKey || '',
          inQuoteHeader: Boolean(btn && refs.quoteFormHeader && refs.quoteFormHeader.contains(btn))
        };
        var dlg = ensureOrigDialog();
        var boxLabel = curCtx.box.label || curCtx.thread.boxLabel || curCtx.box.email || curCtx.box.id;
        origState.title.textContent = (curChoice ? curChoice.displaySubject : curCtx.thread.subject) || '메일 원문';
        origState.meta.textContent = '메일함: ' + boxLabel + (curChoice && curChoice.displayLabel ? ' · ' + curChoice.displayLabel : '');
        origState.note.textContent = '';
        origState.note.hidden = true;
        origState.body.textContent = '원문을 불러오는 중…';
        if (!dlg.parentNode) refs.shell.appendChild(dlg);
        if (typeof dlg.showModal === 'function') {
          try { if (!dlg.open) dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); }
        } else {
          dlg.setAttribute('open', '');
        }
        document.addEventListener('keydown', onOrigKeydown, true);
        origState.closeBtn.focus();
        var readPayload = req.choiceMode
          ? { threadId: req.threadId, readId: req.readId }
          : { threadId: req.threadId, evidenceId: req.evidenceId };
        Promise.resolve().then(function () {
          return api.action(kind, readPayload);
        }).then(function (res) {
          if (!origState.active || origState.active.seq !== req.seq) return;
          var live = matchDoneAction(req);
          if (!live || !live.canReadOriginal) { closeOriginalDialog(false); return; }
          var liveChoice = req.choiceMode ? findOriginalChoice(live, req.readId) : null;
          if (req.choiceMode && !liveChoice) { closeOriginalDialog(false); return; }
          var orig = res && res.ok && res.original;
          var respIdOk = Boolean(orig && (req.choiceMode
            ? (typeof orig.readId === 'string' ? orig.readId.trim() : '') === req.readId
            : String(orig.evidenceId || '').trim() === req.evidenceId));
          if (!orig || orig.threadId !== req.threadId || !respIdOk || typeof orig.text !== 'string') {
            var mismatch = Boolean(orig && (orig.threadId !== req.threadId || !respIdOk));
            closeOriginalDialog(true);
            if (!mismatch) {
              setNotice((res && (res.error || res.message)) || '원문을 불러오지 못했어요. 메일함에서 확인해 주세요.', true, btn);
            }
            return;
          }
          var liveBoxLabel = live.box.label || live.thread.boxLabel || live.box.email || live.box.id;
          var origSubject = typeof orig.subject === 'string' ? orig.subject.trim() : '';
          var resolvedSubject = origSubject
            ? (liveChoice && origSubject === liveChoice.subject ? liveChoice.displaySubject : origSubject)
            : ((liveChoice && liveChoice.displaySubject) || live.thread.subject || '메일 원문');
          origState.title.textContent = resolvedSubject;
          origState.meta.textContent = '메일함: ' + liveBoxLabel + (liveChoice && liveChoice.displayLabel ? ' · ' + liveChoice.displayLabel : '');
          origState.note.textContent = orig.partial ? '일부 내용만 불러왔어요.' : '';
          origState.note.hidden = !orig.partial;
          origState.body.textContent = orig.text;
          if (origState.dialog.open && !req.choiceMode && !orig.partial && orig.text.trim() && res.receiptToken) {
            rememberDisplayedReceipt(live, res.receiptToken);
            renderDataRegions();
          }
        }, function (err) {
          if (!origState.active || origState.active.seq !== req.seq) return;
          var live = matchDoneAction(req);
          closeOriginalDialog(Boolean(live));
          if (live) {
            setNotice((err && err.message) || '원문을 불러오지 못했어요. 메일함에서 확인해 주세요.', true, btn);
          }
        });
        return;
      }
      var payload = req.choiceMode
        ? { threadId: req.threadId, readId: req.readId }
        : (kind === 'openMailbox'
          ? { boxId: req.boxId, threadId: req.threadId, evidenceId: req.evidenceId }
          : { threadId: req.threadId, evidenceId: req.evidenceId });
      Promise.resolve().then(function () {
        return api.action(kind, payload);
      }).then(function (res) {
        var live = matchDoneAction(req);
        if (!live) return;
        if (!res || res.ok === false || res.opened === false) {
          var msg = (res && (res.error || res.message)) || (kind === 'openMailbox' ? '메일함을 열지 못했어요.' : '메일 링크를 열지 못했어요. 메일함에서 확인해 주세요.');
          setNotice(msg, true, btn);
        }
      }, function (err) {
        var live = matchDoneAction(req);
        if (!live) return;
        var msg = (err && err.message) || (kind === 'openMailbox' ? '메일함을 열지 못했어요.' : '메일 링크를 열지 못했어요. 메일함에서 확인해 주세요.');
        setNotice(msg, true, btn);
      });
    }

    function fillOriginalChoicePanel(panel, ctx) {
      panel.textContent = '';
      panel.appendChild(el('p', 'muted', '순서를 단정할 수 없는 메일 후보입니다. 확인할 원문을 골라 주세요.'));
      for (var i = 0; i < ctx.choices.length; i++) {
        (function (choice) {
          var row = el('div', 'row');
          row.setAttribute('data-orig-choice', choice.readId);

          var badge = choice.displayLabel.charAt(0) === '[' ? choice.displayLabel : ('[' + choice.displayLabel + ']');
          var choiceTitle = badge + ' ' + choice.displaySubject;

          var readBtn = el('button', '', choiceTitle + ' · 원문 보기');
          readBtn.type = 'button';
          readBtn.disabled = state.busyCount > 0;
          var readKey = ctx.threadId + ':read:' + choice.readId;
          readBtn.setAttribute('data-orig-key', readKey);
          readBtn.addEventListener('click', function () {
            runOriginalAction('readOriginal', ctx, readBtn, readKey, choice.readId);
          });
          row.appendChild(readBtn);

          var mailActions = el('div', 'actions');
          var mailBtn = el('button', '', '메일함 열기');
          mailBtn.type = 'button';
          mailBtn.disabled = state.busyCount > 0;
          var mailKey = ctx.threadId + ':mailbox:' + choice.readId;
          mailBtn.setAttribute('data-orig-key', mailKey);
          mailBtn.setAttribute('aria-label', choiceTitle + ' 메일함 열기');
          mailBtn.addEventListener('click', function () {
            runOriginalAction('openMailbox', ctx, mailBtn, mailKey, choice.readId);
          });
          mailActions.appendChild(mailBtn);
          row.appendChild(mailActions);

          panel.appendChild(row);
        })(ctx.choices[i]);
      }
    }

    function appendOriginalControls(host, thread, scope) {
      if (!host) return null;
      var ctx = getOriginalCtx(thread);
      if (!ctx) return null;
      var wrap = host.classList && host.classList.contains('actions') ? host : el('div', 'actions');
      var count = 0;
      if (ctx.choiceMode) {
        var scopeName = scope || 'card';
        var scopeKey = scopeName + ':' + ctx.threadId;
        var prevExp = origState.expandedChoices[scopeKey];
        if (prevExp && (prevExp.boxId !== ctx.boxId || prevExp.memberKey !== ctx.memberKey || (scopeName === 'quote' && state.quoteThreadId !== ctx.threadId))) {
          delete origState.expandedChoices[scopeKey];
          prevExp = null;
        }
        var isExpanded = Boolean(prevExp);
        var panelId = 'orig-choices-' + scopeName + '-' + String(ctx.threadId).replace(/[^a-zA-Z0-9_-]/g, '_');

        var toggleBtn = el('button', '', '자세히 보기');
        toggleBtn.type = 'button';
        toggleBtn.disabled = state.busyCount > 0;
        var toggleKey = ctx.threadId + ':primary';
        toggleBtn.setAttribute('data-orig-key', toggleKey);
        toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        toggleBtn.setAttribute('aria-controls', panelId);

        var panel = el('div', 'orig-choices');
        panel.id = panelId;
        panel.hidden = !isExpanded;
        panel.setAttribute('data-orig-panel', scopeKey);
        if (isExpanded) {
          fillOriginalChoicePanel(panel, ctx);
          origState.expandedChoices[scopeKey] = {
            scope: scopeName,
            threadId: ctx.threadId,
            boxId: ctx.boxId,
            memberKey: ctx.memberKey,
            sig: getChoicesSig(ctx.choices),
            panel: panel,
            toggleBtn: toggleBtn
          };
        }

        toggleBtn.addEventListener('click', function () {
          var liveCtx = getOriginalCtx(ctx.threadId);
          if (!liveCtx || !liveCtx.choiceMode || liveCtx.boxId !== ctx.boxId || liveCtx.memberKey !== ctx.memberKey) {
            delete origState.expandedChoices[scopeKey];
            panel.textContent = '';
            panel.hidden = true;
            toggleBtn.setAttribute('aria-expanded', 'false');
            closeOriginalDialog(false);
            setNotice('메일함을 다시 확인하고 현재 문의를 열어 주세요.', true, toggleBtn);
            return;
          }
          var nextOpen = panel.hidden;
          if (origState.active && (origState.active.threadId !== liveCtx.threadId || !nextOpen)) {
            closeOriginalDialog(false);
          }
          if (nextOpen) {
            fillOriginalChoicePanel(panel, liveCtx);
            panel.hidden = false;
            toggleBtn.setAttribute('aria-expanded', 'true');
            origState.expandedChoices[scopeKey] = {
              scope: scopeName,
              threadId: liveCtx.threadId,
              boxId: liveCtx.boxId,
              memberKey: liveCtx.memberKey,
              sig: getChoicesSig(liveCtx.choices),
              panel: panel,
              toggleBtn: toggleBtn
            };
          } else {
            delete origState.expandedChoices[scopeKey];
            panel.textContent = '';
            panel.hidden = true;
            toggleBtn.setAttribute('aria-expanded', 'false');
          }
        });

        wrap.appendChild(toggleBtn);
        if (wrap !== host) host.appendChild(wrap);
        if (!scope) {
          host.appendChild(panel);
          return null;
        }
        return panel;
      }
      function addBtn(label, kind, roleKey) {
        var b = el('button', '', label);
        b.type = 'button';
        b.disabled = state.busyCount > 0;
        var key = ctx.threadId + ':' + roleKey;
        b.setAttribute('data-orig-key', key);
        b.addEventListener('click', function () { runOriginalAction(kind, ctx, b, key); });
        wrap.appendChild(b);
        count++;
      }
      if (ctx.directOriginal) {
        addBtn('자세히 보기', 'openOriginal', 'primary');
        if (ctx.canReadOriginal) addBtn('솔리오에서 원문 보기', 'readOriginal', 'reader');
      } else if (ctx.canReadOriginal) {
        addBtn('자세히 보기', 'readOriginal', 'primary');
      }
      if (ctx.canOpenMailbox) addBtn('메일함 열기', 'openMailbox', 'mailbox');
      if (ctx.thread && ctx.thread.needsReceiptReview === true) {
        var receiptToken = displayedReceiptToken(ctx);
        var receiptBtn = el('button', '', ctx.thread.needsTermsReview === true ? (ctx.thread.sentQuoteReply === true ? '이 회신은 별도 안내예요' : '아직 견적을 보내지 않았어요') : '수신 확인만 보냈어요');
        receiptBtn.type = 'button';
        receiptBtn.disabled = Boolean(isLocked()) || !receiptToken;
        if (!receiptToken) {
          receiptBtn.title = '원문을 먼저 열어 확인해 주세요.';
        }
        receiptBtn.addEventListener('click', function () {
          var live = getOriginalCtx(ctx.threadId);
          var liveToken = displayedReceiptToken(live);
          if (!live || live.memberKey !== ctx.memberKey || live.boxId !== ctx.boxId || live.evidenceId !== ctx.evidenceId || !live.thread || live.thread.needsReceiptReview !== true || !liveToken || isLocked()) {
            return;
          }
          runAction('confirmReceipt', { threadId: live.threadId, evidenceId: live.evidenceId, receiptToken: live.thread.receiptToken }, live.thread.needsTermsReview === true ? '이 회신을 확인했어요.' : '보낸 메일을 수신 확인으로 처리했어요.', false);
        });
        wrap.appendChild(receiptBtn);
        count++;
      }
      if (count > 0 && wrap !== host) host.appendChild(wrap);
      return null;
    }

    function isScanRunning() {
      if (state.pendingScan) return true;
      if (state.data && state.data.scanning) return true;
      var boxes = (state.data && state.data.boxes) || [];
      for (var i = 0; i < boxes.length; i++) {
        var p = String((boxes[i] && boxes[i].phase) || '').trim().toLowerCase();
        if (p === 'scanning' || p === 'syncing' || p === 'checking' || p === 'running' || p === 'reading' || p === 'loading') {
          return true;
        }
      }
      return false;
    }

    function isLocked() {
      return state.busyCount > 0;
    }

    function getConnectRenderKey() {
      var cap = state.data && state.data.capabilities;
      var prov = state.connectForm.provider;
      var ready = Boolean(cap && cap.readyProviders && cap.readyProviders.indexOf(prov) !== -1);
      return prov + '|' + String(Boolean(cap && cap.connect)) + '|' + String(ready) + '|' + String(isDemoMode()) + '|' + String((cap && cap.connectionNote) || '');
    }

    function getShownQuoteThread(threadId) {
      if (!threadId) return null;
      var live = findThread(threadId);
      if (live) return live;
      if (threadId !== state.quoteThreadId) return null;
      var cached = state.quoteThreadCache ? state.quoteThreadCache[threadId] : null;
      return cached && cached.awaitingEvidence === true ? cached : null;
    }

    function getShownHandoffThread(threadId) {
      if (!threadId) return null;
      var live = findThread(threadId);
      if (live) return live;
      if (threadId !== state.handoffThreadId) return null;
      var cached = state.handoffThreadCache ? state.handoffThreadCache[threadId] : null;
      return cached && cached.awaitingEvidence === true ? cached : null;
    }

    function hasCurrentEvidence(item) {
      if (typeof item.currentEvidence === 'boolean') return item.currentEvidence;
      var thread = findThread(item.threadId);
      return Boolean(thread && item.evidenceId && item.evidenceId === thread.evidenceId);
    }

    function isHandoffExcerptConfirmed(threadId) {
      if (!threadId) return false;
      var hf = state.handoffForms[threadId];
      var th = threadId ? findThread(threadId) : null;
      if (!hf || !th || hf.stale) return false;
      if (th.awaitingEvidence || typeof th.evidenceId !== "string" || !th.evidenceId.trim()) return false;
      if (!getThreadExcerpt(th)) return false;
      var curKey = getThreadEvidenceKey(th);
      if (hf.confirmedEvidenceKey !== curKey) return false;
      if (th.evidenceId != null && String(th.evidenceId) !== '' && hf.confirmedEvidenceId !== String(th.evidenceId)) {
        return false;
      }
      return true;
    }

    function findThread(threadId) {
      if (!threadId) return null;
      var threads = (state.data && Array.isArray(state.data.threads) ? state.data.threads : []).concat(
        state.data && Array.isArray(state.data.selectedThreads) ? state.data.selectedThreads : []
      );
      for (var i = 0; i < threads.length; i++) {
        if (threads[i].id === threadId) {
          return threads[i];
        }
      }
      return null;
    }

    function getQuotesForThread(threadId) {
      var quotes = (state.data && state.data.quotes) || [];
      var list = [];
      for (var i = 0; i < quotes.length; i++) {
        if (quotes[i].threadId === threadId) {
          list.push(quotes[i]);
        }
      }
      list.sort(function (a, b) {
        return Number(b.version || 0) - Number(a.version || 0);
      });
      return list;
    }

    function currentThreadQuote(thread) {
      if (!thread || !thread.evidenceId) return null;
      return getQuotesForThread(thread.id).find(function (quote) {
        return quote.evidenceId === thread.evidenceId;
      }) || null;
    }

    function ensureQuoteForm(threadId, thread) {
      var refThread = thread || getShownQuoteThread(threadId);
      if (!state.quoteForms[threadId]) {
        state.quoteForms[threadId] = createEmptyQuoteForm(refThread);
      } else if (refThread && state.quoteForms[threadId].loadedEvidenceKey === null) {
        state.quoteForms[threadId].loadedEvidenceKey = getThreadEvidenceKey(refThread);
        state.quoteForms[threadId].loadedEvidenceId = refThread.evidenceId != null ? String(refThread.evidenceId) : null;
      }
      if (!state.quoteForms[threadId].replyFormat) {
        state.quoteForms[threadId].replyFormat = 'paragraph';
      }
      return state.quoteForms[threadId];
    }

    function ensureHandoffForm(threadId, thread) {
      var refThread = thread || getShownHandoffThread(threadId);
      if (!state.handoffForms[threadId]) {
        state.handoffForms[threadId] = createEmptyHandoffForm(refThread);
      } else if (refThread && state.handoffForms[threadId].loadedEvidenceKey === null) {
        state.handoffForms[threadId].loadedEvidenceKey = getThreadEvidenceKey(refThread);
        state.handoffForms[threadId].loadedEvidenceId = refThread.evidenceId != null ? String(refThread.evidenceId) : null;
      }
      return state.handoffForms[threadId];
    }

    function setNotice(text, isError, button) {
      if (isError) {
        button = button || document.activeElement;
        if (button && button.matches('button') && button.isConnected) {
          var label = button.parentNode.querySelector('.action-error') || el('p', 'action-error');
          label.setAttribute('role', 'alert');
          label.textContent = text;
          button.insertAdjacentElement('afterend', label);
        }
      }
      state.noticeText = text || '';
      state.noticeError = Boolean(isError);
      renderTopRegion();
    }

    function normalizeData(raw) {
      var d = raw || {};
      var boxes = Array.isArray(d.boxes) ? d.boxes : [];
      var threads = Array.isArray(d.threads) ? d.threads : [];
      var jobs = Array.isArray(d.jobs) ? d.jobs : [];
      var selectedThreads = Array.isArray(d.selectedThreads) ? d.selectedThreads : [];
      var observedThreads = threads.concat(selectedThreads);
      var checkedIds = new Set(Array.isArray(d.checkedThreadIds) ? d.checkedThreadIds : []);
      var quotes = Array.isArray(d.quotes) ? d.quotes : [];
      var handoffs = Array.isArray(d.handoffs) ? d.handoffs : [];
      var cap = d.capabilities && typeof d.capabilities === 'object' ? d.capabilities : {};
      var providers = PROVIDERS.slice();
      if (Array.isArray(cap.providers)) {
        cap.providers.forEach(function (p) {
          var key = String(p || '').toLowerCase();
          if (key && providers.indexOf(key) === -1) providers.push(key);
        });
      }
      var readyProviders = Array.isArray(cap.readyProviders)
        ? cap.readyProviders.map(function (p) { return String(p || '').toLowerCase(); })
        : [];
      var connectAllowed = hasLiveApi && cap.connect === true;
      var connectionNote = String(cap.connectionNote || d.connectionNote || '').trim();
      var topPhase = String(d.phase || '').trim().toLowerCase();
      var topScanning = Boolean(d.scanning) || topPhase === 'scanning' || topPhase === 'syncing' || topPhase === 'checking' || topPhase === 'running';

      function purge(id) {
        delete state.quoteThreadCache?.[id];
        delete state.handoffThreadCache?.[id];
        delete state.quoteForms?.[id];
        delete state.handoffForms?.[id];
        if (state.quoteThreadId === id) {
          state.quoteThreadId = null;
          clearNode(refs.quoteFormFields); refs.quoteSubmitBtn = null;
        }
        if (state.handoffThreadId === id) {
          state.handoffThreadId = null;
          clearNode(refs.handoffFormFields); refs.handoffSubmitBtn = null;
        }
      }
      var boxIds = new Set(boxes.map(function (box) { return box.id; }));
      var threadIds = new Set(observedThreads.map(function (thread) { return thread.id; }));
      var selectedIds = new Set([state.quoteThreadId, state.handoffThreadId]);
      Object.entries(Object.assign({}, state.handoffThreadCache, state.quoteThreadCache)).forEach(function (entry) {
        var id = entry[0];
        var cached = entry[1];
        if (!cached || !boxIds.has(cached.boxId)) {
          purge(id);
          return;
        }
        if (!threadIds.has(id) && (checkedIds.has(id) || selectedIds.has(id) || !d.hasMore)) {
          if (
            !selectedIds.has(id) &&
            !(state.quoteForms && state.quoteForms[id] ? hasQuoteUserEdits(state.quoteForms[id]) : false) &&
            !(state.handoffForms && state.handoffForms[id] ? hasHandoffUserEdits(state.handoffForms[id]) : false) &&
            !Object.values(repeatStates || {}).some(function (saved) {
              return (
                saved &&
                saved.threadId === id &&
                (String(saved.rev || '').trim() || String(saved.alloc || '').trim())
              );
            })
          ) {
            purge(id);
            return;
          }
          var awaiting = {
            id: id, boxId: cached.boxId, subject: cached.subject, kind: cached.kind,
            awaitingEvidence: true, evidenceId: '', evidence: '', request: '',
            status: 'review', reason: '원문 확인이 필요합니다.'
          };
          state.quoteThreadCache[id] = awaiting;
          state.handoffThreadCache[id] = awaiting;
          if (state.quoteForms && state.quoteForms[id]) {
            state.quoteForms[id].stale = true;
          }
          if (state.handoffForms && state.handoffForms[id]) {
            state.handoffForms[id].stale = true;
            state.handoffForms[id].confirmedEvidenceKey = null;
            state.handoffForms[id].confirmedEvidenceId = null;
          }
        }
      });
      if (state.selectedBoxId && !boxes.some(function (box) { return box.id === state.selectedBoxId; })) state.selectedBoxId = null;

      for (var i = 0; i < observedThreads.length; i++) {
        var th = observedThreads[i];
        if (th && th.id) {
          var nextKey = getThreadEvidenceKey(th);
          var nextEid = th.evidenceId != null ? String(th.evidenceId) : null;

          var qf = state.quoteForms[th.id];
          if (qf) {
            var qChanged = (qf.loadedEvidenceKey !== null && qf.loadedEvidenceKey !== nextKey) ||
              (qf.loadedEvidenceId !== null && nextEid !== null && qf.loadedEvidenceId !== nextEid);
            if (qChanged) {
              if (hasQuoteUserEdits(qf)) {
                qf.stale = true;
              } else {
                qf.loadedEvidenceKey = nextKey;
                qf.loadedEvidenceId = nextEid;
              }
            } else if (qf.loadedEvidenceKey === null) {
              qf.loadedEvidenceKey = nextKey;
              qf.loadedEvidenceId = nextEid;
            }
          }

          var hf = state.handoffForms[th.id];
          if (hf) {
            var hChanged = (hf.loadedEvidenceKey !== null && hf.loadedEvidenceKey !== nextKey) ||
              (hf.loadedEvidenceId !== null && nextEid !== null && hf.loadedEvidenceId !== nextEid);
            if (hChanged) {
              if (state.handoffThreadId === th.id || hasHandoffUserEdits(hf)) {
                hf.stale = true;
                hf.confirmedEvidenceKey = null;
                hf.confirmedEvidenceId = null;
              } else {
                hf.loadedEvidenceKey = nextKey;
                hf.loadedEvidenceId = nextEid;
              }
            } else if (hf.loadedEvidenceKey === null) {
              hf.loadedEvidenceKey = nextKey;
              hf.loadedEvidenceId = nextEid;
            }
          }

          state.quoteThreadCache[th.id] = th;
          state.handoffThreadCache[th.id] = th;
        }
      }

      if (isDemoMode()) {
        state.confirmDisconnectBoxId = null;
      } else if (state.confirmDisconnectBoxId) {
        var stillExists = false;
        for (var b = 0; b < boxes.length; b++) {
          if (boxes[b].id === state.confirmDisconnectBoxId) {
            stillExists = true;
          }
        }
        if (!stillExists) {
          state.confirmDisconnectBoxId = null;
        }
      }

      return {
        boxes: boxes,
        threads: threads,
        selectedThreads: selectedThreads,
        checkedThreadIds: Array.from(checkedIds),
        jobs: jobs,
        quotes: quotes,
        handoffs: handoffs,
        capabilities: {
          providers: providers,
          readyProviders: readyProviders,
          connect: connectAllowed,
          connectionNote: connectionNote
        },
        hasMore: Boolean(d.hasMore),
        scanning: topScanning
      };
    }

    var requestOrder = 0, lastAppliedOrder = 0, lastSnapshotSequence = 0;
    function applyIncomingData(raw, order) {
      if (order === undefined) order = ++requestOrder;
      if (Number.isSafeInteger(raw.snapshotSequence) && raw.snapshotSequence > 0) {
        if (raw.snapshotSequence <= lastSnapshotSequence) return;
        lastSnapshotSequence = raw.snapshotSequence;
      } else if (lastSnapshotSequence || order < lastAppliedOrder) return;
      lastAppliedOrder = Math.max(lastAppliedOrder, order);
      state.data = normalizeData(raw);
      syncOriginalContext();
      renderDataRegions();
    }

    function syncTabVisibility() {
      refs.shell.className = isDemoMode() ? 'shell demo' : 'shell';
      refs.connectionsView.hidden = state.activeTab !== 'connections';
      refs.mailView.hidden = state.activeTab !== 'mail';
      refs.quoteView.hidden = state.activeTab !== 'quote';
      refs.handoffView.hidden = state.activeTab !== 'handoff';
    }

    function syncInteractiveLocks() {
      var actionBusy = state.busyCount > 0;
      if (refs.connectSubmitBtn) {
        var cap = state.data.capabilities;
        var providerReady = cap.readyProviders.indexOf(state.connectForm.provider) !== -1;
        refs.connectSubmitBtn.disabled = isDemoMode() || !cap.connect || !providerReady || actionBusy;
      }
      if (refs.jobSubmitBtn) {
        refs.jobSubmitBtn.disabled = actionBusy;
      }
      if (refs.quoteSubmitBtn) {
        var qf = state.quoteThreadId ? state.quoteForms[state.quoteThreadId] : null;
        var liveQuoteThread = state.quoteThreadId ? findThread(state.quoteThreadId) : null;
        var hasValidQuoteEvidence = Boolean(
          liveQuoteThread &&
          typeof liveQuoteThread.evidenceId === "string" &&
          liveQuoteThread.evidenceId.trim() &&
          !liveQuoteThread.awaitingEvidence
        );
        refs.quoteSubmitBtn.disabled = Boolean(actionBusy) || Boolean(qf && qf.stale) || !hasValidQuoteEvidence;
      }
      if (refs.handoffSubmitBtn) {
        refs.handoffSubmitBtn.disabled = actionBusy || !isHandoffExcerptConfirmed(state.handoffThreadId);
      }
    }

    function runAction(name, payload, successMessage, isScan) {
      var order = ++requestOrder;
      function markSubmittedFormStale() {
        if (!payload || (name !== 'quote' && name !== 'handoff')) return;
        var forms = name === 'quote' ? state.quoteForms : state.handoffForms;
        var form = forms[payload.threadId];
        if (!form || !payload.evidenceId || form.loadedEvidenceId !== String(payload.evidenceId)) return;
        form.stale = true;
        if (name === 'handoff') {
          form.confirmedEvidenceKey = null;
          form.confirmedEvidenceId = null;
        }
      }
      var button = ({ connect: refs.connectSubmitBtn, job: refs.jobSubmitBtn, quote: refs.quoteSubmitBtn, handoff: refs.handoffSubmitBtn })[name];
      if (button) button.parentNode.querySelector('.action-error')?.remove();
      if (isScan && isScanRunning()) {
        return Promise.resolve(false);
      }
      if (!isScan && state.busyCount > 0) {
        return Promise.resolve(false);
      }

      if (isScan) {
        state.pendingScan = true;
      } else {
        state.busyCount += 1;
      }
      renderTopRegion();
      renderBoxesList();
      renderThreadsList();
      renderHandoffList();
      syncInteractiveLocks();

      return Promise.resolve()
        .then(function () {
          return api.action(name, payload || {});
        })
        .then(function (res) {
          if (res && res.ok) {
            if (successMessage) {
              state.noticeText = successMessage;
              state.noticeError = false;
            } else {
              state.noticeText = '';
              state.noticeError = false;
            }
            if (res.data) {
              applyIncomingData(res.data, order);
              return true;
            }
            return loadSnapshotQuietly().then(function () {
              return true;
            });
          }
          var isStale = Boolean(
            res && (
              String(res.code || '').toUpperCase() === 'STALE' ||
              String(res.error || '').toUpperCase() === 'STALE' ||
              /stale/i.test(String(res.message || ''))
            )
          );
          if (isStale) {
            markSubmittedFormStale();
            var staleNotice = (res && res.message && /[가-힣]/.test(String(res.message)))
              ? String(res.message)
              : '작성 중 새 메일이 도착했습니다. 최신 메일 내용을 확인한 뒤 다시 시도해 주세요.';
            if (res && res.data) {
              applyIncomingData(res.data, order);
            } else {
              loadSnapshotQuietly();
            }
            setNotice(staleNotice, true, button);
            return false;
          }
          if (res && res.data) {
            applyIncomingData(res.data, order);
          } else if (res && res.connectionNote) {
            state.data.capabilities.connectionNote = String(res.connectionNote).trim();
            renderBoxConnectHeaderAndButtons();
          }
          var errMsg = (res && (res.message || res.connectionNote)) ? String(res.message || res.connectionNote) : '요청을 처리하지 못했습니다.';
          setNotice(errMsg, true, button);
          return false;
        })
        .catch(function (err) {
          var rawErr = err && err.message ? String(err.message) : '';
          if (/stale/i.test(rawErr)) {
            markSubmittedFormStale();
            loadSnapshotQuietly();
            setNotice('작성 중 새 메일이 도착했습니다. 최신 메일 내용을 확인해 주세요.', true, button);
            return false;
          }
          var fallbackMsg = rawErr || '작업 중 오류가 발생했습니다.';
          setNotice(fallbackMsg, true, button);
          return false;
        })
        .finally(function () {
          if (isScan) {
            state.pendingScan = false;
          } else {
            state.busyCount = Math.max(0, state.busyCount - 1);
          }
          renderTopRegion();
          renderBoxesList();
          renderThreadsList();
          renderQuoteFormHeader();
          renderHandoffFormHeader();
          renderHandoffList();
          renderQuoteThreads();
          renderQuotesList();
          renderHandoffPicker();
          syncInteractiveLocks();
        });
    }

    function closeConnectCapabilities(note) {
      state.data.capabilities.connect = false;
      state.data.capabilities.readyProviders = [];
      if (note) state.data.capabilities.connectionNote = String(note).trim();
      renderBoxConnectHeaderAndButtons();
      if (!refs.boxConnectBody.firstChild || state.renderedConnectKey !== getConnectRenderKey()) {
        renderBoxConnectBody();
      }
      syncInteractiveLocks();
    }

    function loadSnapshotQuietly() {
      var order = ++requestOrder;
      return Promise.resolve()
        .then(function () {
          return isDemoMode()
            ? api.snapshot()
            : api.snapshot(
                [state.quoteThreadId, state.handoffThreadId]
                  .map(function (id) { return typeof id === 'string' ? id.trim() : ''; })
                  .filter(function (id, index, list) { return Boolean(id) && list.indexOf(id) === index; })
              );
        })
        .then(function (res) {
          if (res && res.ok && res.data) {
            applyIncomingData(res.data, order);
          } else {
            if (order < lastAppliedOrder) return;
            if (res && res.data) {
              applyIncomingData(res.data, order);
            }
            closeConnectCapabilities(res && res.connectionNote);
            if (res && !res.ok && (res.message || res.connectionNote)) {
              setNotice(String(res.message || res.connectionNote), true);
            }
          }
        })
        .catch(function (err) {
          if (order < lastAppliedOrder) return;
          closeConnectCapabilities();
          setNotice(err && err.message ? String(err.message) : '데이터를 불러오지 못했습니다.', true);
        });
    }

    function openQuoteForThread(thread) {
      if (!thread || !thread.id) return;
      var prevId = state.quoteThreadId;
      state.quoteThreadId = thread.id;
      if (state.quoteThreadId !== prevId && !isDemoMode()) {
        loadSnapshotQuietly();
      }
      state.quoteThreadCache[thread.id] = thread;
      ensureQuoteForm(thread.id, thread);
      state.activeTab = 'quote';
      syncTabVisibility();
      renderTopRegion();
      renderQuoteThreads();
      renderQuoteJobs();
      renderQuoteFormHeader();
      if (prevId !== thread.id || !refs.quoteFormFields.firstChild) {
        renderQuoteFormFields();
      }
      syncInteractiveLocks();
    }

    function openQuoteFromHandoff(item) {
      if (!item) return;
      var thread = findThread(item.threadId);
      if (!thread || !item.evidenceId || item.evidenceId !== thread.evidenceId) {
        setNotice('메일 목록에서 최신 문의를 확인한 뒤 견적을 작성해 주세요.', true);
        return;
      }
      openQuoteForThread(thread);
    }

    function openHandoffForThread(thread) {
      if (!thread || !thread.id) return;
      var prevId = state.handoffThreadId;
      state.handoffThreadId = thread.id;
      if (state.handoffThreadId !== prevId && !isDemoMode()) {
        loadSnapshotQuietly();
      }
      state.handoffThreadCache[thread.id] = thread;
      ensureHandoffForm(thread.id, thread);
      state.activeTab = 'handoff';
      syncTabVisibility();
      renderTopRegion();
      renderHandoffPicker();
      renderHandoffFormHeader();
      if (prevId !== thread.id || !refs.handoffFormFields.firstChild) {
        renderHandoffFormFields();
      }
      syncInteractiveLocks();
    }

    function switchTab(tab, focusMode) {
      closeOriginalDialog(false);
      state.activeTab = tab;
      syncTabVisibility();
      renderTopRegion();
      if (state.activeTab === 'quote') {
        renderQuoteFormHeader();
      }
      if (focusMode === 'connections') {
        var provBtn = refs.boxConnectProviderRow.querySelector('button.selected') || refs.boxConnectProviderRow.querySelector('button');
        if (provBtn) provBtn.focus();
      } else if (focusMode === 'tab') {
        var activeTabBtn = refs.topRegion.querySelector('button[data-tab="' + tab + '"]');
        if (activeTabBtn) activeTabBtn.focus();
      }
    }

    function focusMailThread(threadId) {
      switchTab('mail');
      var key = threadId == null ? '' : String(threadId);
      var target = null;
      if (key && refs.threadsRegion) {
        var items = refs.threadsRegion.querySelectorAll('[data-thread-id]');
        for (var i = 0; i < items.length; i++) {
          if (items[i].getAttribute('data-thread-id') === key) {
            target = items[i];
            break;
          }
        }
      }
      if (!target) {
        var activeTabBtn = refs.topRegion && refs.topRegion.querySelector('button[data-tab="mail"]');
        if (activeTabBtn) activeTabBtn.focus();
        return;
      }
      var card = null;
      var node = target;
      while (node && node !== refs.threadsRegion) {
        var tag = (node.tagName || '').toUpperCase();
        if (!card && tag === 'SECTION') {
          card = node;
        }
        if (tag === 'DETAILS' && !node.open) {
          node.open = true;
        }
        node = node.parentElement;
      }
      var scrollEl = card || target;
      if (typeof scrollEl.scrollIntoView === 'function') {
        scrollEl.scrollIntoView({ block: 'nearest' });
      }
      if (typeof target.focus === 'function') {
        target.focus();
      }
    }

    function pickUrgentLead() {
      var threads = state.data.threads || [];
      for (var i = 0; i < threads.length; i++) {
        var t = threads[i];
        if (isActionableThread(t)) {
          var st = normalizeThreadStatus(t);
          if (t.sentQuoteReply === true) {
            return {
              title: (st === 'promise') ? '지금 먼저 할 일 · 약속 이행 확인' : '지금 먼저 할 일 · 메일 확인',
              detail: [t.subject, t.reason].filter(Boolean).join(' · '),
              actionLabel: '메일 보기',
              onAction: function () { focusMailThread(t.id); }
            };
          }
          if (t.kind === 'quote' && !currentThreadQuote(t)) {
            return {
              title: '지금 먼저 할 일 · 견적 초안 작성',
              detail: t.subject + (t.reason ? ' — ' + t.reason : ''),
              actionLabel: '견적 작성',
              onAction: function () { openQuoteForThread(t); }
            };
          }
          var stepTitle = st === 'promise'
            ? '지금 먼저 할 일 · 약속 이행 확인'
            : (st === 'draft' ? '지금 먼저 할 일 · 미발송 초안 확인' : '지금 먼저 할 일 · 답장 초안 확인');
          return {
            title: stepTitle,
            detail: t.subject + (t.reason ? ' — ' + t.reason : ''),
            actionLabel: t.kind === 'quote' ? '견적 열기' : (state.activeTab === 'mail' ? '완료 표시' : '메일 보기'),
            onAction: function () {
              if (t.kind === 'quote') {
                openQuoteForThread(t);
              } else if (state.activeTab === 'mail') {
                runAction('mark', { threadId: t.id, evidenceId: t.evidenceId }, '메일을 완료 처리했습니다.', false);
              } else {
                focusMailThread(t.id);
              }
            }
          };
        }
      }

      var handoffs = state.data.handoffs || [];
      for (var h = 0; h < handoffs.length; h++) {
        var item = handoffs[h];
        if (!isHandoffFinished(item) && hasCurrentEvidence(item)) {
          var linked = findThread(item.threadId) || state.handoffThreadCache[item.threadId];
          var subj = item.subject || (linked && linked.subject) || '(제목 없음)';
          var stepLabel = isHandoffAccepted(item) ? '인계 완료 처리 필요' : '인계 접수 필요';
          return {
            title: '지금 먼저 할 일 · ' + item.to + ' ' + stepLabel,
            detail: subj + (item.due ? ' (기한: ' + item.due + ')' : ''),
            actionLabel: '직원 인계 보기',
            onAction: function () { switchTab('handoff', 'tab'); }
          };
        }
      }

      var boxes = state.data.boxes || [];
      if (!isDemoMode() && boxes.length === 0) {
        var cap = state.data.capabilities;
        return {
          title: '연결된 메일함이 없습니다.',
          detail: cap && cap.connect
            ? '메일함을 연결하면 답장할 메일과 견적 문의를 이곳에서 바로 정리할 수 있습니다.'
            : '메일 연결 탭에서 서비스별 연결 방법과 준비 상태를 확인할 수 있습니다.',
          actionLabel: state.activeTab === 'connections' ? null : '첫 메일함 연결',
          onAction: state.activeTab === 'connections' ? null : function () { switchTab('connections', 'connections'); }
        };
      }

      return {
        title: '급한 메일과 대기 중인 인계가 없습니다.',
        detail: '새 메일이 오면 다시 확인 버튼으로 불러올 수 있습니다.',
        actionLabel: null,
        onAction: null
      };
    }

    function renderTopRegion() {
      clearNode(refs.topRegion);

      var titleRow = el('div', 'row');
      titleRow.appendChild(el('h1', '', '솔리오 견적 비서'));
      refs.topRegion.appendChild(titleRow);

      if (isDemoMode()) {
        var demoBanner = el('div', 'notice demo');
        var demoRow = el('div', 'row');
        demoRow.appendChild(el('strong', '', '예시 메일함'));
        demoRow.appendChild(el('span', 'muted', '실제 메일 연결이나 발송 없이 견적과 직원 인계를 연습합니다.'));
        demoBanner.appendChild(demoRow);
        refs.topRegion.appendChild(demoBanner);
      }

      if (isScanRunning()) {
        var scanNotice = el('div', 'notice');
        scanNotice.appendChild(el('strong', '', '메일함 확인 중 · '));
        scanNotice.appendChild(el('span', '', '재확인이 끝난 뒤 원문을 열거나 견적을 저장하거나 인계를 수락할 수 있습니다. 재검색 중이 아닌 다른 메일함은 계속 사용할 수 있습니다.'));
        refs.topRegion.appendChild(scanNotice);
      }

      var urgent = pickUrgentLead();
      var leadBox = el('div', 'lead');
      var leadRow = el('div', 'row');
      var leadTextWrap = el('div', '');
      leadTextWrap.appendChild(el('strong', '', urgent.title));
      leadTextWrap.appendChild(el('p', 'muted', urgent.detail));
      leadRow.appendChild(leadTextWrap);

      if (urgent.actionLabel && urgent.onAction) {
        var leadActions = el('div', 'actions');
        var leadBtn = el('button', 'primary', urgent.actionLabel);
        leadBtn.type = 'button';
        leadBtn.disabled = state.busyCount > 0;
        leadBtn.addEventListener('click', urgent.onAction);
        leadActions.appendChild(leadBtn);
        leadRow.appendChild(leadActions);
      }
      leadBox.appendChild(leadRow);
      refs.topRegion.appendChild(leadBox);

      if (state.noticeText) {
        var noticeEl = el('div', 'notice', state.noticeText);
        refs.topRegion.appendChild(noticeEl);
      }

      var openCount = 0;
      var threads = state.data.threads || [];
      for (var i = 0; i < threads.length; i++) {
        if (isActionableThread(threads[i])) openCount += 1;
      }
      var activeHandoffCount = 0;
      var handoffs = state.data.handoffs || [];
      for (var j = 0; j < handoffs.length; j++) {
        if (!isHandoffFinished(handoffs[j]) && hasCurrentEvidence(handoffs[j])) activeHandoffCount += 1;
      }

      var navBar = el('nav', 'nav');
      var tabGroup = el('div', 'actions');

      var tabs = [
        { id: 'mail', label: '답장할 메일' + (openCount ? ' (' + openCount + ')' : '') },
        { id: 'quote', label: '견적' + (state.data.quotes.length ? ' (' + state.data.quotes.length + ')' : '') },
        { id: 'handoff', label: '직원 인계' + (activeHandoffCount ? ' (' + activeHandoffCount + ')' : '') },
        { id: 'connections', label: '메일 연결' }
      ];

      for (var t = 0; t < tabs.length; t++) {
        (function (tabInfo) {
          var btn = el('button', state.activeTab === tabInfo.id ? 'selected' : '', tabInfo.label);
          btn.type = 'button';
          btn.dataset.tab = tabInfo.id;
          if (state.activeTab === tabInfo.id) btn.setAttribute('aria-current', 'page');
          if (tabInfo.id === 'connections') {
            btn.id = 'connections';
          }
          btn.addEventListener('click', function () {
            switchTab(tabInfo.id, 'tab');
          });
          tabGroup.appendChild(btn);
        })(tabs[t]);
      }
      navBar.appendChild(tabGroup);

      var refreshGroup = el('div', 'actions');
      if (isScanRunning()) {
        refreshGroup.appendChild(el('span', 'muted', '확인 중...'));
      }
      var scanBtn = el('button', '', '다시 확인');
      scanBtn.type = 'button';
      scanBtn.disabled = isScanRunning() || state.busyCount > 0 || (!isDemoMode() && state.data.boxes.length === 0);
      scanBtn.addEventListener('click', function () {
        runAction('scan', {}, '메일함을 다시 확인했습니다.', true);
      });
      refreshGroup.appendChild(scanBtn);
      navBar.appendChild(refreshGroup);

      refs.topRegion.appendChild(navBar);
    }

    function renderThreadCard(thread, isUrgentFirst) {
      var bucket = getThreadBucket(thread);
      var stLabel = threadStatusLabel(thread);
      var isAction = bucket === 'action';
      var isReview = bucket === 'review';
      var hideWorkItems = bucket === 'waiting_done' || bucket === 'excluded';

      var cardClass = isAction && isUrgentFirst ? 'section selected' : 'section';
      var card = el('section', cardClass);

      var headerRow = el('div', 'row');
      var titleSide = el('div', '');
      var badgeText = '';
      if (isAction) {
        badgeText = (isUrgentFirst ? '[급한 메일] ' : '') + '[' + stLabel + '] ' + (thread.kind === 'quote' ? '[견적 요청] ' : '');
      } else {
        badgeText = '[' + stLabel + '] ';
      }
      titleSide.appendChild(el('span', 'muted', badgeText));
      var titleBtn = el('strong', '', thread.subject || '(제목 없음)');
      if (thread && thread.id != null && thread.id !== '') titleBtn.setAttribute('data-thread-id', String(thread.id));
      titleBtn.tabIndex = -1;
      titleSide.appendChild(titleBtn);
      headerRow.appendChild(titleSide);

      var statusText = stLabel + (thread.reason ? ' · ' + thread.reason : '');
      headerRow.appendChild(el('span', 'muted', statusText));
      card.appendChild(headerRow);

      if (!hideWorkItems && thread.request) {
        var reqBlock = el('div', '');
        reqBlock.appendChild(el('strong', '', isReview ? '확인 내용: ' : '요청·약속 확인: '));
        reqBlock.appendChild(el('span', '', thread.request));
        card.appendChild(reqBlock);
        var facts = thread.quoteRequest;
        if (facts && (facts.review || !facts.scope || !facts.quantity)) {
          var details = [];
          if (Number.isInteger(facts.revisions)) details.push('수정 ' + facts.revisions + '회');
          if (facts.deadline) details.push(facts.deadlineIsLimit === true ? facts.deadline + '까지 납품' : '희망 납품일 ' + facts.deadline);
          if (details.length) card.appendChild(el('p', '', '이번 메일에 적힌 조건은 ' + details.join(', ') + '입니다. 금액을 정하기 전에 원문을 확인해 주세요.'));
        }
      }

      var latestQuote = hideWorkItems ? null : currentThreadQuote(thread);
      var shownDraft = (hideWorkItems || thread.sentQuoteReply === true) ? '' : ((latestQuote && latestQuote.replyDraft) ? latestQuote.replyDraft : thread.replyDraft);

      if ((isAction || (isReview && shownDraft)) && thread.sentQuoteReply !== true) {
        var draftBox = el('div', 'notice');
        draftBox.appendChild(
          el(
            'div',
            'muted',
            latestQuote && latestQuote.replyDraft
              ? '답장 초안 (최신 견적 기준 · 발송은 메일함에서 직접 진행)'
              : '답장 초안 (발송은 메일함에서 직접 진행)'
          )
        );
        if (shownDraft) {
          var replyText=el('p', '', shownDraft);
          replyText.style.whiteSpace='pre-line';
          draftBox.appendChild(replyText);
        } else {
          draftBox.appendChild(el('p', 'muted', '아직 준비된 답장 초안이 없습니다.'));
        }
        card.appendChild(draftBox);
      }

      var actionsRow = el('div', 'actions');
      if (isAction) {
        if (thread.kind === 'quote' && thread.sentQuoteReply !== true) {
          var quoteBtn = el('button', 'primary', '견적 작성');
          quoteBtn.type = 'button';
          quoteBtn.disabled = state.busyCount > 0;
          quoteBtn.addEventListener('click', function () {
            openQuoteForThread(thread);
          });
          actionsRow.appendChild(quoteBtn);
        }

        var markBtn = el('button', thread.kind === 'quote' ? '' : 'primary', '완료 표시');
        markBtn.type = 'button';
        markBtn.disabled = state.busyCount > 0;
        markBtn.addEventListener('click', function () {
          runAction('mark', { threadId: thread.id, evidenceId: thread.evidenceId }, '완료로 표시했습니다.', false);
        });
        actionsRow.appendChild(markBtn);

        var handoffBtn = el('button', '', '직원에게 넘기기');
        handoffBtn.type = 'button';
        handoffBtn.disabled = state.busyCount > 0;
        handoffBtn.addEventListener('click', function () {
          openHandoffForThread(thread);
        });
        actionsRow.appendChild(handoffBtn);
      } else if (isReview) {
        var reviewReopenBtn = el('button', 'primary', '다시 열기');
        reviewReopenBtn.type = 'button';
        reviewReopenBtn.disabled = state.busyCount > 0;
        reviewReopenBtn.addEventListener('click', function () {
          runAction('reopen', { threadId: thread.id, evidenceId: thread.evidenceId }, '답장할 메일로 다시 열었습니다.', false);
        });
        actionsRow.appendChild(reviewReopenBtn);

        var reviewMarkBtn = el('button', '', '완료 표시');
        reviewMarkBtn.type = 'button';
        reviewMarkBtn.disabled = state.busyCount > 0;
        reviewMarkBtn.addEventListener('click', function () {
          runAction('mark', { threadId: thread.id, evidenceId: thread.evidenceId }, '완료로 표시했습니다.', false);
        });
        actionsRow.appendChild(reviewMarkBtn);

        if (thread.kind === 'quote' && thread.sentQuoteReply !== true) {
          var reviewQuoteBtn = el('button', '', '견적 작성');
          reviewQuoteBtn.type = 'button';
          reviewQuoteBtn.disabled = state.busyCount > 0;
          reviewQuoteBtn.addEventListener('click', function () {
            openQuoteForThread(thread);
          });
          actionsRow.appendChild(reviewQuoteBtn);
        }

        var reviewHandoffBtn = el('button', '', '직원에게 넘기기');
        reviewHandoffBtn.type = 'button';
        reviewHandoffBtn.disabled = state.busyCount > 0;
        reviewHandoffBtn.addEventListener('click', function () {
          openHandoffForThread(thread);
        });
        actionsRow.appendChild(reviewHandoffBtn);
      } else {
        var reopenBtn = el('button', '', '다시 열기');
        reopenBtn.type = 'button';
        reopenBtn.disabled = state.busyCount > 0;
        reopenBtn.addEventListener('click', function () {
          runAction('reopen', { threadId: thread.id, evidenceId: thread.evidenceId }, '답장할 메일로 다시 열었습니다.', false);
        });
        actionsRow.appendChild(reopenBtn);
      }
      var origChoicePanel = appendOriginalControls(actionsRow, thread, 'card');
      card.appendChild(actionsRow);
      if (origChoicePanel) card.appendChild(origChoicePanel);

      var details = el('details', '');
      var summary = el('summary', 'muted', '검토 근거·참고 상세 보기');
      details.appendChild(summary);
      if (thread.boxLabel) {
        details.appendChild(el('p', 'muted', '메일함: ' + thread.boxLabel));
      }
      if (thread.reason) {
        details.appendChild(el('p', 'muted', '분류·상태 이유: ' + thread.reason));
      }
      if (thread.reading && !thread.reading.complete) {
        details.appendChild(el('p', 'muted', thread.reading.source === 'snippet'
          ? '메일 미리보기만 확인했어요. 견적을 작성하기 전에 원문을 열어 주세요.'
          : thread.reading.reason || '견적을 작성하기 전에 메일 원문을 확인해 주세요.'));
      }
      if (getThreadExcerpt(thread)) {
        details.appendChild(el('p', '', '검토 근거: ' + getThreadExcerpt(thread)));
      }
      if (!hideWorkItems && latestQuote) {
        details.appendChild(
          el(
            'p',
            'muted',
            '최근 견적: v' +
              latestQuote.version +
              ' ' +
              latestQuote.title +
              ' · 합계 ' +
              formatTotal(latestQuote.total)
          )
        );
      }
      card.appendChild(details);

      return card;
    }

    function renderFoldedBucket(bucketKey, titleText, items) {
      if (!items || items.length === 0) return null;
      var details = el('details', 'section');
      details.open = Boolean(state.openBuckets[bucketKey]);
      details.addEventListener('toggle', function () {
        state.openBuckets[bucketKey] = details.open;
      });
      var summary = el('summary', '', titleText + ' (' + items.length + '건)');
      details.appendChild(summary);
      for (var i = 0; i < items.length; i++) {
        details.appendChild(renderThreadCard(items[i], false));
      }
      return details;
    }

    function renderThreadsList() {
      clearNode(refs.threadsRegion);

      var threads = state.data.threads || [];
      var actionThreads = [];
      var reviewThreads = [];
      var waitingDoneThreads = [];
      var excludedThreads = [];

      for (var i = 0; i < threads.length; i++) {
        var b = getThreadBucket(threads[i]);
        if (b === 'action') {
          actionThreads.push(threads[i]);
        } else if (b === 'review') {
          reviewThreads.push(threads[i]);
        } else if (b === 'waiting_done') {
          waitingDoneThreads.push(threads[i]);
        } else {
          excludedThreads.push(threads[i]);
        }
      }

      var openWrap = el('section', 'section');
      var openHead = el('div', 'row');
      openHead.appendChild(el('h2', '', '답장할 메일'));
      openHead.appendChild(el('span', 'muted', '메일 ' + actionThreads.length + '건'));
      openWrap.appendChild(openHead);

      if (actionThreads.length === 0) {
        openWrap.appendChild(el('p', 'muted', '답장이나 약속 확인이 필요한 메일이 없습니다.'));
      } else {
        for (var o = 0; o < actionThreads.length; o++) {
          openWrap.appendChild(renderThreadCard(actionThreads[o], o === 0));
        }
      }

      if (state.data.hasMore) {
        var moreRow = el('div', 'actions');
        var moreBtn = el('button', '', '더 보기');
        moreBtn.type = 'button';
        moreBtn.disabled = isLocked();
        moreBtn.addEventListener('click', function () {
          runAction('more', {}, '', false);
        });
        moreRow.appendChild(moreBtn);
        openWrap.appendChild(moreRow);
      }

      refs.threadsRegion.appendChild(openWrap);

      var reviewSec = renderFoldedBucket('review', '직접 확인할 메일', reviewThreads);
      if (reviewSec) refs.threadsRegion.appendChild(reviewSec);

      var waitingSec = renderFoldedBucket('waiting_done', '대기 중이거나 처리를 마친 메일', waitingDoneThreads);
      if (waitingSec) refs.threadsRegion.appendChild(waitingSec);

      var excludedSec = renderFoldedBucket('excluded', '자동 안내·스팸', excludedThreads);
      if (excludedSec) refs.threadsRegion.appendChild(excludedSec);
    }

    function renderBoxesList() {
      clearNode(refs.boxesListRegion);
      var sec = el('section', 'section');
      var head = el('div', 'row');
      head.appendChild(el('h2', '', '연결된 메일함'));
      head.appendChild(el('span', 'muted', isDemoMode() ? '예시 계정 목록 · 실제 메일함과 연결되지 않습니다.' : '원본 메일함은 읽기 전용으로 안전하게 유지됩니다.'));
      sec.appendChild(head);

      var boxes = state.data.boxes || [];
      if (boxes.length === 0) {
        sec.appendChild(el('p', 'muted', '연결된 메일함이 없습니다.'));
      } else {
        for (var i = 0; i < boxes.length; i++) {
          (function (box) {
            var isSelected = state.selectedBoxId === box.id;
            var boxCard = el('div', isSelected ? 'row selected' : 'row');
            var info = el('div', '');
            var providerName = PROVIDER_LABELS[box.provider] || '메일 서비스';
            var boxTitle = isDemoMode()
              ? '[예시 계정] ' + (box.label || providerName) + ' (' + providerName + ' · 예시)'
              : (box.label || providerName) + ' (' + providerName + ')';
            info.appendChild(el('strong', '', boxTitle));
            var metaParts = [phaseLabel(box.phase)];
            var completedText = formatKoreanTime(box.completedAt);
            if (completedText) {
              metaParts.push('마지막 전체 확인 시각: ' + completedText);
            } else {
              metaParts.push('마지막 전체 확인 시각: 아직 없음');
            }
            if (Number.isInteger(box.checked) && box.checked >= 0) {
              metaParts.push('확인한 항목 ' + box.checked + '개');
            }
            if (box.detail) metaParts.push(box.detail);
            if (box.connectionNote && box.connectionNote !== box.detail) metaParts.push(box.connectionNote);
            info.appendChild(el('p', 'muted', metaParts.join(' · ')));
            boxCard.appendChild(info);

            var btnGroup = el('div', 'actions');
            var selectBtn = el('button', isSelected ? 'selected' : '', isSelected ? '선택됨' : '선택');
            selectBtn.type = 'button';
            selectBtn.dataset.boxSelect = String(box.id);
            selectBtn.addEventListener('click', function () {
              state.selectedBoxId = box.id;
              if (state.confirmDisconnectBoxId && state.confirmDisconnectBoxId !== box.id) {
                state.confirmDisconnectBoxId = null;
              }
              renderBoxesList();
              var nextSelect = refs.boxesListRegion.querySelector('button[data-box-select="' + String(box.id) + '"]');
              if (nextSelect) nextSelect.focus();
            });
            btnGroup.appendChild(selectBtn);

            var askDisconnectBtn = el('button', '', '연결 해제');
            askDisconnectBtn.type = 'button';
            askDisconnectBtn.disabled = isDemoMode() || isLocked();
            askDisconnectBtn.addEventListener('click', function () {
              if (isDemoMode() || isLocked()) return;
              state.selectedBoxId = box.id;
              state.confirmDisconnectBoxId = box.id;
              renderBoxesList();
              var cancelBtn = refs.boxesListRegion.querySelector('button[data-cancel-disconnect="' + String(box.id) + '"]');
              if (cancelBtn) cancelBtn.focus();
            });
            btnGroup.appendChild(askDisconnectBtn);

            boxCard.appendChild(btnGroup);
            sec.appendChild(boxCard);

            if (!isDemoMode() && state.confirmDisconnectBoxId === box.id) {
              var guardExplicitActivation = function (btn) {
                var repeatBlocked = false;
                var spaceArmed = false;
                function clearRepeatBlock() {
                  repeatBlocked = false;
                }
                btn.addEventListener('pointerdown', clearRepeatBlock);
                btn.addEventListener('mousedown', clearRepeatBlock);
                btn.addEventListener('keydown', function (e) {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    if (e.repeat) {
                      repeatBlocked = true;
                      e.preventDefault();
                      Promise.resolve().then(clearRepeatBlock);
                      return;
                    }
                    repeatBlocked = false;
                    if (e.key === ' ' || e.key === 'Spacebar') {
                      spaceArmed = true;
                    }
                  }
                });
                btn.addEventListener('keyup', function (e) {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    if (e.key === ' ' || e.key === 'Spacebar') {
                      if (!spaceArmed) {
                        repeatBlocked = true;
                        e.preventDefault();
                        Promise.resolve().then(clearRepeatBlock);
                        return;
                      }
                      spaceArmed = false;
                    }
                    repeatBlocked = false;
                  }
                });
                btn.addEventListener('blur', function () {
                  repeatBlocked = false;
                  spaceArmed = false;
                });
                return function (e) {
                  if (repeatBlocked && (!e || e.detail === 0)) {
                    repeatBlocked = false;
                    if (e) e.preventDefault();
                    return true;
                  }
                  return false;
                };
              };
              var confirmBox = el('div', 'notice');
              var noticeId = 'disconnect-notice-' + String(box.id).replace(/[^a-zA-Z0-9_-]/g, '_');
              var confirmNotice = el(
                'p',
                '',
                '선택한 메일함(' +
                  (box.label || providerName) +
                  ')을 솔리오에서 연결 해제할까요? 이 PC에 저장한 이 메일함의 문의, 견적, 인계 기록과 여기서 기억한 가격표가 삭제됩니다. 원본 메일은 메일 서비스에 남습니다.'
              );
              confirmNotice.id = noticeId;
              confirmBox.setAttribute('role', 'group');
              confirmBox.setAttribute('aria-labelledby', noticeId);
              confirmBox.appendChild(confirmNotice);
              var confirmActions = el('div', 'actions');
              var confirmYes = el('button', 'primary', '연결 해제 확인');
              confirmYes.type = 'button';
              confirmYes.dataset.confirmDisconnect = String(box.id);
              confirmYes.setAttribute('aria-describedby', noticeId);
              confirmYes.disabled = isLocked();
              var ignoreConfirmRepeatClick = guardExplicitActivation(confirmYes);
              confirmYes.addEventListener('click', function (e) {
                if (ignoreConfirmRepeatClick(e)) return;
                if (isLocked()) return;
                var targetId = box.id;
                confirmYes.disabled = true;
                if (confirmNo) confirmNo.disabled = true;
                runAction('disconnect', { id: targetId, confirm: true }, '메일함 연결을 해제했습니다. 원본 메일함은 그대로 유지됩니다.', false).then(function (ok) {
                  if (ok) {
                    state.confirmDisconnectBoxId = null;
                    if (state.selectedBoxId === targetId) {
                      state.selectedBoxId = null;
                    }
                  }
                  renderBoxesList();
                });
              });
              var confirmNo = el('button', '', '취소');
              confirmNo.type = 'button';
              confirmNo.dataset.cancelDisconnect = String(box.id);
              confirmNo.disabled = !!isLocked();
              var ignoreCancelRepeatClick = guardExplicitActivation(confirmNo);
              confirmNo.addEventListener('click', function (e) {
                if (ignoreCancelRepeatClick(e)) return;
                if (isLocked()) return;
                state.confirmDisconnectBoxId = null;
                renderBoxesList();
                var backBtn = refs.boxesListRegion.querySelector('button[data-box-select="' + String(box.id) + '"]');
                if (backBtn) backBtn.focus();
              });
              confirmActions.appendChild(confirmYes);
              confirmActions.appendChild(confirmNo);
              confirmBox.appendChild(confirmActions);
              sec.appendChild(confirmBox);
            }
          })(boxes[i]);
        }
      }

      refs.boxesListRegion.appendChild(sec);
    }

    function renderBoxConnectHeaderAndButtons() {
      clearNode(refs.boxConnectHeader);
      var cap = state.data.capabilities;
      var head = el('div', 'row');
      head.appendChild(el('h2', '', '메일함 연결'));
      if (isDemoMode()) {
        head.appendChild(el('span', 'muted demo', '실제 연결 경로: PC Solio > 견적 비서 열기 > 메일 연결'));
      } else if (!cap.connect) {
        head.appendChild(el('span', 'muted', '현재 앱에 메일 연결 설정이 구성되지 않았습니다.'));
      } else {
        head.appendChild(el('span', 'muted', '연결할 서비스를 선택하세요.'));
      }
      refs.boxConnectHeader.appendChild(head);

      if (cap.connectionNote) {
        refs.boxConnectHeader.appendChild(el('p', 'notice', cap.connectionNote));
      }

      clearNode(refs.boxConnectProviderRow);
      var providers = cap.providers || PROVIDERS;

      if (providers.indexOf(state.connectForm.provider) === -1 && providers.length > 0) {
        state.connectForm.provider = providers[0];
      }
      // 처음 고른 서비스는 연결할 수 있는 첫 서비스로 둔다. 회원이 고른 뒤에는 바꾸지 않는다(0.5.8 Fable — 공개 빌드는 네이버만 준비돼 있다).
      if (!state.connectForm.chosen && !isDemoMode() && cap.readyProviders.length && cap.readyProviders.indexOf(state.connectForm.provider) === -1) {
        state.connectForm.provider = cap.readyProviders[0];
      }

      for (var i = 0; i < providers.length; i++) {
        (function (prov) {
          var isReady = Boolean(cap.connect && cap.readyProviders.indexOf(prov) !== -1);
          var label = (PROVIDER_LABELS[prov] || '메일 서비스') + (isDemoMode() || isReady ? '' : ' (준비 중)');
          var btn = el('button', state.connectForm.provider === prov ? 'selected' : '', label);
          btn.type = 'button';
          btn.dataset.provider = prov;
          btn.addEventListener('click', function () {
            state.connectForm.chosen = true;
            if (state.connectForm.provider !== prov) {
              state.connectForm.provider = prov;
              state.connectForm.password = '';
              renderBoxConnectHeaderAndButtons();
              renderBoxConnectBody();
            }
            var focusedBtn = refs.boxConnectProviderRow.querySelector('button[data-provider="' + prov + '"]');
            if (focusedBtn) focusedBtn.focus();
          });
          refs.boxConnectProviderRow.appendChild(btn);
        })(providers[i]);
      }
      syncInteractiveLocks();
    }

    function renderBoxConnectBody() {
      clearNode(refs.boxConnectBody);
      refs.naverPasswordInput = null;
      refs.connectSubmitBtn = null;
      state.renderedConnectKey = getConnectRenderKey();

      var prov = state.connectForm.provider;
      var cap = state.data.capabilities;
      var isReady = Boolean(cap.connect && cap.readyProviders.indexOf(prov) !== -1);
      var providerTitle = PROVIDER_LABELS[prov] || '메일 서비스';

      if (isDemoMode()) {
        var demoGuides = {
          gmail: 'PC의 솔리오에서 견적 비서를 열고 메일 연결을 선택하세요. 브라우저에서 Google 계정에 로그인해 메일 읽기를 허용하면 연결됩니다.',
          naver: '네이버 메일 환경설정에서 IMAP을 켜고, 앱 비밀번호는 네이버ID 보안설정의 2단계 인증 관리에서 발급하세요. PC의 솔리오에서 견적 비서를 열고 메일 연결에 주소와 앱 비밀번호를 입력하세요.',
          outlook: 'PC의 솔리오에서 견적 비서를 열고 메일 연결을 선택하세요. 브라우저에서 Microsoft 계정에 로그인해 메일 읽기를 허용하면 연결됩니다.'
        };
        refs.boxConnectBody.appendChild(
          el('p', '', demoGuides[prov] || 'PC의 솔리오에서 견적 비서를 열고 메일 연결을 선택하세요.')
        );
        return;
      }

      if (prov === 'naver') {
        if (!hasLiveApi || !isReady) {
          refs.boxConnectBody.appendChild(
            el(
              'p',
              'muted',
              '네이버 메일은 메일 환경설정에서 IMAP 사용을 켜고, 앱 비밀번호는 네이버ID 보안설정의 2단계 인증 관리에서 발급해 연결합니다. 연결 준비가 확인되기 전에는 앱 비밀번호 입력칸이 열리지 않습니다.'
            )
          );
          var disabledNaverActions = el('div', 'actions');
          var disabledNaverBtn = el('button', 'primary', '네이버 메일함 연결');
          disabledNaverBtn.type = 'button';
          disabledNaverBtn.disabled = true;
          refs.connectSubmitBtn = disabledNaverBtn;
          disabledNaverActions.appendChild(disabledNaverBtn);
          refs.boxConnectBody.appendChild(disabledNaverActions);
          syncInteractiveLocks();
          return;
        }

        var note = el(
          'p',
          'muted',
          '네이버 메일은 메일 환경설정에서 IMAP을 켠 뒤, 기본 로그인 비밀번호가 아닌 네이버ID 보안설정의 2단계 인증 관리에서 발급한 앱 비밀번호를 입력해야 합니다. 연결 요청 직후 비밀번호 입력칸은 즉시 비워집니다.'
        );
        refs.boxConnectBody.appendChild(note);

        var grid = el('div', 'grid');

        var addrField = el('label', 'field');
        addrField.appendChild(el('span', '', '네이버 메일 주소'));
        var addrInput = el('input', '');
        addrInput.type = 'email';
        addrInput.name = 'address';
        addrInput.placeholder = 'example@naver.com'; // 공개허용: 주소 입력 형식을 보여 주는 예시 자리표시자.
        addrInput.autocomplete = 'off';
        addrInput.value = state.connectForm.address;
        addrInput.addEventListener('input', function () {
          state.connectForm.address = addrInput.value;
        });
        addrField.appendChild(addrInput);
        grid.appendChild(addrField);

        var pwField = el('label', 'field');
        pwField.appendChild(el('span', '', '네이버 앱 비밀번호'));
        var pwInput = el('input', '');
        pwInput.type = 'password';
        pwInput.name = 'password';
        pwInput.placeholder = '앱 비밀번호 입력';
        pwInput.autocomplete = 'new-password';
        pwInput.value = state.connectForm.password;
        pwInput.addEventListener('input', function () {
          state.connectForm.password = pwInput.value;
        });
        pwField.appendChild(pwInput);
        grid.appendChild(pwField);

        refs.naverPasswordInput = pwInput;
        refs.boxConnectBody.appendChild(grid);

        var naverActions = el('div', 'actions');
        var naverBtn = el('button', 'primary', '네이버 메일함 연결');
        naverBtn.type = 'button';
        naverBtn.addEventListener('click', function () {
          var address = String(state.connectForm.address || '').trim();
          var password = String(state.connectForm.password || '');
          if (!address || !password) {
            setNotice('네이버 메일 주소와 앱 비밀번호를 모두 입력해 주세요.', true);
            return;
          }
          var payload = {
            provider: 'naver',
            address: address,
            password: password
          };
          state.connectForm.password = '';
          pwInput.value = '';
          runAction('connect', payload, '네이버 메일함을 연결했습니다.', false);
        });
        refs.connectSubmitBtn = naverBtn;
        naverActions.appendChild(naverBtn);
        refs.boxConnectBody.appendChild(naverActions);
      } else {
        if (!isReady) {
          var vendor = prov === 'gmail' ? 'Google' : (prov === 'outlook' ? 'Microsoft' : providerTitle);
          refs.boxConnectBody.appendChild(
            el(
              'p',
              'muted',
              providerTitle + '(' + vendor + ') 연결을 사용하려면 ' + vendor + ' 앱 등록이 필요합니다. 앱 등록이 완료되면 브라우저 로그인으로 읽기 전용 연결을 진행할 수 있습니다.'
            )
          );
        } else {
          refs.boxConnectBody.appendChild(
            el('p', 'muted', providerTitle + ' 계정은 브라우저 로그인 창에서 인증해 연결합니다.')
          );
        }
        var oauthActions = el('div', 'actions');
        var oauthBtn = el('button', 'primary', providerTitle + ' 브라우저 로그인 연결');
        oauthBtn.type = 'button';
        oauthBtn.disabled = !isReady;
        oauthBtn.addEventListener('click', function () {
          if (!state.data.capabilities.connect || state.data.capabilities.readyProviders.indexOf(prov) === -1) return;
          runAction('connect', { provider: prov }, providerTitle + ' 메일함을 연결했습니다.', false);
        });
        refs.connectSubmitBtn = oauthBtn;
        oauthActions.appendChild(oauthBtn);
        refs.boxConnectBody.appendChild(oauthActions);
      }

      syncInteractiveLocks();
    }

    function renderQuoteThreads() {
      clearNode(refs.quoteThreadsRegion);
      var head = el('div', 'row');
      head.appendChild(el('h2', '', '견적 대상 메일 선택'));
      head.appendChild(el('span', 'muted', '메일을 선택하면 아래 견적 작성 칸이 열립니다.'));
      refs.quoteThreadsRegion.appendChild(head);

      var threads = state.data.threads || [];
      var quoteThreads = [];
      for (var i = 0; i < threads.length; i++) {
        var bt = getThreadBucket(threads[i]);
        if (threads[i].kind === 'quote' && (bt === 'action' || bt === 'review')) {
          quoteThreads.push(threads[i]);
        }
      }

      if (state.quoteThreadId) {
        var ensuredQuoteThread = getShownQuoteThread(state.quoteThreadId);
        if (
          ensuredQuoteThread &&
          !quoteThreads.some(function (t) { return t.id === state.quoteThreadId; })
        ) {
          quoteThreads.unshift(ensuredQuoteThread);
        }
      }

      if (quoteThreads.length === 0) {
        if (state.data && state.data.hasMore) {
          refs.quoteThreadsRegion.appendChild(el('p', 'muted', '현재 불러온 메일 범위에는 견적 요청으로 분류된 메일이 없습니다. 아직 더 불러올 수 있는 메일이 있습니다.'));
        } else {
          refs.quoteThreadsRegion.appendChild(el('p', 'muted', '현재 견적 요청으로 분류된 메일이 없습니다.'));
          return;
        }
      }

      for (var q = 0; q < quoteThreads.length; q++) {
        (function (thread) {
          var isSelected = state.quoteThreadId === thread.id;
          var hideReq = getThreadBucket(thread) === 'waiting_done' || getThreadBucket(thread) === 'excluded';
          var itemRow = el('div', isSelected ? 'row selected' : 'row');
          var info = el('div', '');
          info.appendChild(el('strong', '', thread.subject || '(제목 없음)'));
          info.appendChild(el('p', 'muted', hideReq ? '' : (thread.request || '')));
          itemRow.appendChild(info);

          var act = el('div', 'actions');
          var openBtn = el('button', isSelected ? 'selected' : 'primary', isSelected ? '작성 중' : '선택해 견적 작성');
          openBtn.type = 'button';
          openBtn.addEventListener('click', function () {
            openQuoteForThread(thread);
          });
          act.appendChild(openBtn);

          var passBtn = el('button', '', '직원에게 넘기기');
          passBtn.type = 'button';
          passBtn.disabled = state.busyCount > 0;
          passBtn.addEventListener('click', function () {
            openHandoffForThread(thread);
          });
          act.appendChild(passBtn);

          itemRow.appendChild(act);
          refs.quoteThreadsRegion.appendChild(itemRow);
        })(quoteThreads[q]);
      }
      if (state.data && state.data.hasMore) {
        var quoteMoreBtn = el('button', '', '메일 더 보기');
        quoteMoreBtn.type = 'button';
        quoteMoreBtn.disabled = isLocked();
        quoteMoreBtn.addEventListener('click', function () {
          if (isLocked()) {
            return;
          }
          runAction('more', {}, '', false);
        });
        refs.quoteThreadsRegion.appendChild(quoteMoreBtn);
      }
      if (quoteThreads.length === 0) {
        return;
      }
    }

    function applyJobToQuoteForm(job) {
      if (!state.quoteThreadId) {
        setNotice('먼저 위에서 견적 대상 메일을 선택해 주세요.', true);
        return;
      }
      var form = ensureQuoteForm(state.quoteThreadId);
      form.referenceId = job.id;
      form.buildMinutes = job.buildMinutes !== undefined && job.buildMinutes !== null ? String(job.buildMinutes) : '';
      form.revisionMinutes = job.revisionMinutes !== undefined && job.revisionMinutes !== null ? String(job.revisionMinutes) : '';
      form.directCost = job.directCost !== undefined && job.directCost !== null ? String(job.directCost) : '';
      form.subcontractCost = job.subcontractCost !== undefined && job.subcontractCost !== null ? String(job.subcontractCost) : '';
      renderQuoteJobs();
      renderQuoteFormHeader();
      renderQuoteFormFields();
    }

    function renderQuoteJobs() {
      clearNode(refs.quoteJobsRegion);
      var head = el('div', 'row');
      var titleSide = el('div', '');
      titleSide.appendChild(el('h2', '', '기준 작업 참고'));
      titleSide.appendChild(el('p', 'muted', '기준 작업에서 한 단위당 시간과 비용을 가져옵니다. 수량은 이번 문의에 맞게 입력해 주세요.'));
      head.appendChild(titleSide);

      var headActions = el('div', 'actions');
      var toggleJobBtn = el('button', state.jobFormOpen ? 'selected' : '', state.jobFormOpen ? '실제 작업 입력 닫기' : '실제 작업 기록 추가');
      toggleJobBtn.type = 'button';
      toggleJobBtn.addEventListener('click', function () {
        state.jobFormOpen = !state.jobFormOpen;
        refs.jobFormSection.hidden = !state.jobFormOpen;
        if (state.jobFormOpen && !refs.jobFormSection.firstChild) {
          renderJobForm();
        }
        renderQuoteJobs();
      });
      headActions.appendChild(toggleJobBtn);
      head.appendChild(headActions);
      refs.quoteJobsRegion.appendChild(head);

      var jobs = state.data.jobs || [];
      var activeForm = state.quoteThreadId ? ensureQuoteForm(state.quoteThreadId) : null;
      var activeRefId = activeForm ? activeForm.referenceId : '';

      if (jobs.length === 0) {
        refs.quoteJobsRegion.appendChild(el('p', 'muted', '등록된 실제 작업 기록이 없습니다.'));
      } else {
        for (var i = 0; i < jobs.length; i++) {
          (function (job) {
            var isSelected = Boolean(activeRefId && activeRefId === job.id);
            var row = el('div', isSelected ? 'row selected' : 'row');
            var info = el('div', '');
            info.appendChild(el('strong', '', job.title || '기준 작업'));
            var summaryParts = [];
            if (job.scope) summaryParts.push(job.scope);
            if (job.deadline) summaryParts.push('당시 납기 ' + job.deadline);
            if (job.terms) summaryParts.push('당시 조건 ' + job.terms);
            if (job.quantity !== null && job.quantity !== undefined) summaryParts.push('수량 ' + job.quantity);
            if (job.buildMinutes !== null && job.buildMinutes !== undefined) summaryParts.push('제작 시간 (개당 분) ' + job.buildMinutes + '분');
            if (job.revisionMinutes !== null && job.revisionMinutes !== undefined) summaryParts.push('수정 시간 (개당 분) ' + job.revisionMinutes + '분');
            if (job.directCost !== null && job.directCost !== undefined) summaryParts.push('직접 생성비 (개당 원) ' + formatSubtotal(job.directCost));
            if (job.subcontractCost !== null && job.subcontractCost !== undefined) summaryParts.push('외주비 (개당 원) ' + formatSubtotal(job.subcontractCost));
            info.appendChild(el('p', 'muted', summaryParts.join(' · ')));
            row.appendChild(info);

            var act = el('div', 'actions');
            var pickBtn = el('button', isSelected ? 'selected' : '', isSelected ? '기준 적용됨' : '이 작업 채우기');
            pickBtn.type = 'button';
            pickBtn.addEventListener('click', function () {
              applyJobToQuoteForm(job);
            });
            act.appendChild(pickBtn);

            if (isSelected && activeForm) {
              var clearRefBtn = el('button', '', '기준 해제');
              clearRefBtn.type = 'button';
              clearRefBtn.addEventListener('click', function () {
                activeForm.referenceId = '';
                renderQuoteJobs();
                renderQuoteFormHeader();
              });
              act.appendChild(clearRefBtn);
            }

            row.appendChild(act);
            refs.quoteJobsRegion.appendChild(row);
          })(jobs[i]);
        }
      }
    }

    function makeBoundField(labelText, tagName, inputType, fieldName, holder, key, placeholder) {
      var wrap = el('label', 'field');
      wrap.appendChild(el('span', '', labelText));
      var control = el(tagName, '');
      if (tagName === 'input') {
        control.type = inputType || 'text';
        if (inputType === 'number') {
          control.min = '0';
          control.step = '1';
        }
      }
      if (tagName === 'textarea') {
        control.rows = 2;
      }
      control.name = fieldName;
      control.required = labelText.endsWith('*');
      if (fieldName === 'quantity' || fieldName === 'hourlyRate') control.min = '1';
      if (placeholder) {
        control.placeholder = placeholder;
      }
      control.value = holder[key] !== undefined && holder[key] !== null ? String(holder[key]) : '';
      control.addEventListener('input', function () {
        holder[key] = control.value;
      });
      wrap.appendChild(control);
      return { wrap: wrap, control: control };
    }

    function makeDateOrTextField(labelText, fieldName, holder, valueKey, modeKey, textPlaceholder) {
      var wrap = el('div', 'field');
      var topRow = el('div', 'row');
      topRow.appendChild(el('span', '', labelText));

      if (!holder[modeKey]) {
        var initVal = String(holder[valueKey] || '').trim();
        holder[modeKey] = (!initVal || isExactIsoDate(initVal)) ? 'exact' : 'text';
      }

      var modeSelect = el('select', '');
      modeSelect.name = fieldName + 'Mode';
      modeSelect.setAttribute('aria-label', labelText + ' 입력 방식');
      var modeItems = [
        { value: 'exact', label: '정확한 날짜 선택' },
        { value: 'text', label: '문구 직접 입력' },
        { value: 'undecided', label: '미정' }
      ];
      for (var i = 0; i < modeItems.length; i++) {
        var opt = el('option', '', modeItems[i].label);
        opt.value = modeItems[i].value;
        if (holder[modeKey] === modeItems[i].value) {
          opt.selected = true;
        }
        modeSelect.appendChild(opt);
      }
      topRow.appendChild(modeSelect);
      wrap.appendChild(topRow);

      var inputSlot = el('div', '');
      var stateNote = el('span', 'muted', '');
      wrap.appendChild(inputSlot);
      wrap.appendChild(stateNote);

      function syncStateNote() {
        var mode = holder[modeKey];
        var val = String(holder[valueKey] || '').trim();
        if (mode === 'undecided') {
          stateNote.textContent = '상태: 미정';
        } else if (mode === 'exact') {
          stateNote.textContent = isExactIsoDate(val)
            ? ('상태: 정확한 날짜 지정 (' + val + ')')
            : '상태: 날짜 미선택 (미정)';
        } else {
          stateNote.textContent = val ? ('상태: 조건·문구 (' + val + ')') : '상태: 미입력';
        }
      }

      function mountModeControl() {
        clearNode(inputSlot);
        var mode = holder[modeKey];
        if (mode === 'undecided') {
          holder[valueKey] = '';
          syncStateNote();
          return;
        }
        var input = el('input', '');
        input.name = fieldName;
        input.setAttribute('aria-label', labelText);
        if (mode === 'exact') {
          input.type = 'date';
          var curVal = String(holder[valueKey] || '').trim();
          input.value = isExactIsoDate(curVal) ? curVal : '';
        } else {
          input.type = 'text';
          if (textPlaceholder) {
            input.placeholder = textPlaceholder;
          }
          input.value = holder[valueKey] !== undefined && holder[valueKey] !== null ? String(holder[valueKey]) : '';
        }
        input.addEventListener('input', function () {
          holder[valueKey] = input.value;
          syncStateNote();
        });
        input.addEventListener('change', function () {
          holder[valueKey] = input.value;
          syncStateNote();
        });
        inputSlot.appendChild(input);
        syncStateNote();
      }

      modeSelect.addEventListener('change', function () {
        holder[modeKey] = modeSelect.value;
        if (holder[modeKey] === 'exact' && !isExactIsoDate(holder[valueKey])) {
          holder[valueKey] = '';
        } else if (holder[modeKey] === 'undecided') {
          holder[valueKey] = '';
        }
        mountModeControl();
      });

      mountModeControl();
      return { wrap: wrap };
    }

    function renderJobForm() {
      clearNode(refs.jobFormSection);
      refs.jobFormSection.hidden = !state.jobFormOpen;
      refs.jobSubmitBtn = null;

      var head = el('div', 'row');
      head.appendChild(el('h3', '', '새 실제 작업 기록'));
      head.appendChild(el('span', 'muted', '지난 작업 기록의 시간과 직접비는 개당 기준이에요. 작업명, 납품 범위, 수량과 숫자 항목은 모두 필수예요.'));
      refs.jobFormSection.appendChild(head);

      var jf = state.jobForm;
      var textGrid = el('div', 'grid');
      textGrid.appendChild(makeBoundField('작업 이름 *', 'input', 'text', 'title', jf, 'title', '예: 브로슈어 8p 제작').wrap);
      textGrid.appendChild(makeBoundField('납품 범위 *', 'input', 'text', 'scope', jf, 'scope', '예: 시안 2종 및 인쇄 데이터').wrap);
      textGrid.appendChild(makeDateOrTextField('납기 기록', 'deadline', jf, 'deadline', 'deadlineMode', '예: 5영업일 소요').wrap);
      textGrid.appendChild(makeBoundField('작업 조건', 'input', 'text', 'terms', jf, 'terms', '예: 수정 1회 포함').wrap);
      refs.jobFormSection.appendChild(textGrid);

      var numGrid = el('div', 'grid');
      numGrid.appendChild(makeBoundField('수량 *', 'input', 'number', 'quantity', jf, 'quantity', '').wrap);
      numGrid.appendChild(makeBoundField('제작 시간 (개당 분) *', 'input', 'number', 'buildMinutes', jf, 'buildMinutes', '').wrap);
      numGrid.appendChild(makeBoundField('수정 시간 (개당 분) *', 'input', 'number', 'revisionMinutes', jf, 'revisionMinutes', '').wrap);
      var directField = makeBoundField('직접 생성비 (개당 원) *', 'input', 'number', 'directCost', jf, 'directCost', '없으면 0 입력');
      var subField = makeBoundField('외주비 (개당 원) *', 'input', 'number', 'subcontractCost', jf, 'subcontractCost', '없으면 0 입력');
      numGrid.appendChild(directField.wrap);
      numGrid.appendChild(subField.wrap);
      refs.jobFormSection.appendChild(numGrid);

      var act = el('div', 'actions');
      var zeroBtn = el('button', '', '선택 비용 0원 채우기');
      zeroBtn.type = 'button';
      zeroBtn.addEventListener('click', function () {
        if (String(jf.directCost).trim() === '') {
          jf.directCost = '0';
          directField.control.value = '0';
        }
        if (String(jf.subcontractCost).trim() === '') {
          jf.subcontractCost = '0';
          subField.control.value = '0';
        }
      });
      act.appendChild(zeroBtn);

      var saveJobBtn = el('button', 'primary', '실제 작업 저장');
      saveJobBtn.type = 'button';
      saveJobBtn.addEventListener('click', function () {
        var numericKeys = ['quantity', 'buildMinutes', 'revisionMinutes', 'directCost', 'subcontractCost'];
        var dlVal = jf.deadlineMode === 'undecided' ? '' : String(jf.deadline || '').trim();
        var dlExact = jf.deadlineMode === 'exact' && isExactIsoDate(dlVal);
        var payload = {
          title: String(jf.title || '').trim(),
          scope: String(jf.scope || '').trim(),
          deadline: dlVal,
          deadlineMode: dlExact ? 'exact' : (dlVal ? 'text' : 'undecided'),
          deadlineState: dlExact ? 'exact' : (dlVal ? 'text' : 'undecided'),
          terms: String(jf.terms || '').trim()
        };
        for (var k = 0; k < numericKeys.length; k++) {
          var key = numericKeys[k];
          var parsed = parseOptionalInt(jf[key]);
          if (!parsed.valid) {
            setNotice('숫자 항목에는 0 이상의 정수만 입력해 주세요.', true);
            return;
          }
          payload[key] = parsed.blank ? null : parsed.value;
        }
        var submittedSnapshot = JSON.stringify(jf);
        runAction('job', payload, '실제 작업 기록을 추가했습니다.', false).then(function (ok) {
          if (ok && state.jobForm === jf && JSON.stringify(state.jobForm) === submittedSnapshot) {
            state.jobForm = createEmptyJobForm();
            renderJobForm();
          }
        });
      });
      refs.jobSubmitBtn = saveJobBtn;
      act.appendChild(saveJobBtn);

      refs.jobFormSection.appendChild(act);
      syncInteractiveLocks();
    }

    var repeatStates = {};
    var repeatReqSeq = 0;

    function renderRepeat(container, thread) {
      function parseVal(raw, bad) {
        if (bad) return { present: true, invalid: true, token: '!' };
        var s = String(raw == null ? '' : raw).trim();
        if (s === '') return { present: false, token: '' };
        var n = Number(s);
        return Number.isFinite(n) ? { present: true, value: n, token: 'n:' + n } : { present: true, value: s, token: 's:' + s };
      }

      function getCtx(threadId) {
        var live = findThread(threadId);

        // 최신 고객 요청 뒤에 답장을 보낸 문의는 반복 견적 칸을 열지 않는다. 일반 견적 작성과 답장 초안은 그대로 보인다.
        if (!live || live.awaitingEvidence || live.needsReceiptReview === true || !live.evidenceId || live.sentQuoteReply === true || live.repliedSinceRequest !== false) return null;
        if (live.kind !== 'quote' || ['reply','draft','promise'].indexOf(normalizeThreadStatus(live)) === -1) return null;
        var active = ((state.data && state.data.quotes) || []).find(function (q) { return q && q.repeatMethod; });
        var rm = active && active.repeatMethod;
        var methodId = !rm ? '' : (typeof rm === 'string' ? rm : String(rm.id || rm.methodId || active.methodId || active.id || ''));
        if (!active || !methodId || (active.threadId === live.id && live.canRepeatSameThread !== true)) return null;
        var ev = live.evidence;
        var evidenceId = live.evidenceId != null && live.evidenceId !== ''
          ? String(live.evidenceId)
          : String((ev && (ev.id || ev.evidenceId)) || live.latestEvidenceId || live.currentEvidenceId || '');
        var scope = (rm && rm.source && rm.source.scope) || (rm && rm.scope) || (active.source && active.source.scope) || active.scope || '';
        return { threadId: live.id, evidenceId: evidenceId, methodId: methodId, scope: scope, unit: rm.unit || '개', key: JSON.stringify([live.id, evidenceId, methodId, getThreadEvidenceKey(live)]) };
      }

      var ctx = container && thread && getCtx(thread.id);
      for (const key of Object.keys(repeatStates)) {
        var saved = repeatStates[key];
        var id = saved && saved.threadId;
        var current = id ? getCtx(id) : null;
        if (current) {
          if (current.key !== key) delete repeatStates[key];
        } else if (
          id &&
          state.quoteThreadCache &&
          state.quoteThreadCache[id] &&
          (state.quoteThreadCache[id].awaitingEvidence ||
            (findThread(id) && findThread(id).awaitingEvidence) ||
            (!findThread(id) &&
              state.data &&
              state.data.hasMore === true &&
              (state.data.checkedThreadIds || []).indexOf(id) === -1))
        ) {
          saved.loading = false;
          saved.reqId = ++repeatReqSeq;
          saved.valid = false;
          saved.preview = null;
          saved.confirmTitle = false;
          saved.askedTitle = false;
          saved.previewOpts = {};
        } else {
          delete repeatStates[key];
        }
      }
      if (!ctx) {
        // 기억한 방식이 있는데 보낸 답장 때문에 반복 견적이 닫힌 문의에는 까닭을 한 줄로 알린다(0.5.8 — 접수 인사만 보냈어도 닫힌다).
        var lockedLive = container && thread && findThread(thread.id);
        var hasMethod = ((state.data && state.data.quotes) || []).some(function (q) { return q && q.repeatMethod; });
        if (lockedLive && hasMethod && lockedLive.kind === 'quote' && lockedLive.repliedSinceRequest === true && lockedLive.sentQuoteReply !== true) {
          var lockedNote = el('div', 'notice');
          lockedNote.textContent = '고객 요청 뒤에 보낸 답장이 있어 이 문의에는 「지난번처럼 해줘」를 쓰지 않아요. 보낸 답장과 맞게 아래에서 견적을 정해 주세요.';
          container.appendChild(lockedNote);
        }
        return;
      }
      var st = repeatStates[ctx.key] || (repeatStates[ctx.key] = {
        key: ctx.key, threadId: ctx.threadId, reqId: 0, loading: false, preview: null, valid:false,
        askedRev: false, askedAlloc: false, rev: '', alloc: '', revBad: false, allocBad: false,
        previewKey: '|', previewOpts: {}
      });
      var box = el('div', 'notice');
      st.box = box;
      container.appendChild(box);

      function inputKey() {
        return (st.askedRev ? parseVal(st.rev, st.revBad).token : '') + '|' + (st.askedAlloc ? parseVal(st.alloc, st.allocBad).token : '') + '|' + (st.askedTitle && st.confirmTitle ? '1' : '0');
      }

      function canSave() {
        var cur = getCtx(ctx.threadId);
        var p = st.preview;
        if (!cur || cur.key !== st.key || state.busyCount > 0 || st.loading || !st.valid || !p || !p.canSave) return false;
        if (p.threadId !== cur.threadId || String(p.evidenceId || '') !== cur.evidenceId || String(p.methodId || '') !== cur.methodId) return false;
        return inputKey() === st.previewKey;
      }

      function makeBtn(label, name, disabled, onClick) {
        var b = el('button', '', label);
        b.type = 'button';
        b.name = name;
        b.setAttribute('aria-label', label);
        b.disabled = disabled;
        b.addEventListener('click', onClick);
        return b;
      }

      function makeInput(label, name, val, onChange) {
        var id = 'repeat-' + name;
        var wrap = el('label', '', label);
        wrap.htmlFor = id;
        var inp = el('input', '');
        inp.id = id;
        inp.type = 'number';
        inp.step = 'any';
        inp.name = name;
        inp.value = val;
        inp.disabled = state.busyCount > 0 || st.loading;
        inp.addEventListener('input', function () { onChange(inp.value, Boolean(inp.validity && inp.validity.badInput)); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); requestPreview(); } });
        wrap.appendChild(inp);
        return wrap;
      }

      function requestPreview() {
        var cur = getCtx(ctx.threadId);
        if (!cur || cur.key !== st.key || state.busyCount > 0 || st.loading) return;
        var r = st.askedRev ? parseVal(st.rev, st.revBad) : { present: false, token: '' };
        var a = st.askedAlloc ? parseVal(st.alloc, st.allocBad) : { present: false, token: '' };
        if (r.invalid || a.invalid) return setNotice('숫자 형식을 확인해 주세요.', true);
        var payload = { threadId: cur.threadId, evidenceId: cur.evidenceId, methodId: cur.methodId };
        if (r.present) payload.revisionMinutes = r.value;
        if (a.present) payload.allocation = a.value;
        var c = Boolean(st.askedTitle && st.confirmTitle);
        if (c) payload.confirmedTitle = true;
        var sentKey = r.token + '|' + a.token + '|' + (c ? '1' : '0');
        if (payload.confirmedTitle === true) payload.titleConfirmationKey = st.preview && st.preview.titleConfirmationKey;
        var reqId = ++repeatReqSeq;
        st.reqId = reqId;
        st.loading = true;
        st.valid = false;
        st.redraw();
        api.action('repeatPreview', payload).then(function (res) {
          if (repeatStates[st.key] !== st || st.reqId !== reqId) return;
          st.loading = false;
          var latest = getCtx(cur.threadId);
          if (!latest || latest.key !== st.key) return;
          var p = res && res.preview;
          if (!res || !res.ok || !p) {
            setNotice((res && res.message) || '미리보기를 불러오지 못했습니다.', true);
            if (res && res.code === 'STALE') void loadSnapshotQuietly();
            return st.redraw();
          }
          if (p.threadId !== cur.threadId || String(p.evidenceId || '') !== cur.evidenceId || String(p.methodId || '') !== cur.methodId) {
            void loadSnapshotQuietly();
            return st.redraw();
          }
          if (state.noticeError) setNotice('', false);
          st.preview = p;
          st.valid = true;
          st.askedRev = Boolean(st.askedRev || p.needsRevisionMinutes);
          st.askedAlloc = Boolean(st.askedAlloc || p.needsAllocation);
          st.previewKey = sentKey;
          st.askedTitle = Boolean(st.askedTitle || p.needsTitleConfirmation);
          st.previewOpts = { revPresent: r.present, rev: r.value, allocPresent: a.present, alloc: a.value, confirmedTitle: c };
          st.redraw();
        }, function (err) {
          if (repeatStates[st.key] !== st || st.reqId !== reqId) return;
          st.loading = false;
          var latest = getCtx(cur.threadId);
          if (!latest || latest.key !== st.key) return;
          setNotice((err && err.message) || '미리보기를 불러오지 못했습니다.', true);
          st.redraw();
        });
      }

      st.redraw = function () {
        var target = st.box;
        if (!target || !target.parentNode) return;
        clearNode(target);
        var cur = getCtx(ctx.threadId);
        if (!cur || cur.key !== st.key) return target.remove();
        var busy = state.busyCount > 0 || st.loading;
        var headRow = el('div', 'row');
        if (cur.scope) headRow.appendChild(el('span', 'muted', '기준 범위: ' + cur.scope));
        headRow.appendChild(makeBtn('지난번처럼 해줘', 'repeatPreview', busy, requestPreview));
        target.appendChild(headRow);
        var p = st.preview;
        if (!p) return;
        var resultBlock = el('div', '');
        var draft = el('div', '', p.replyDraft || '');
        draft.style.whiteSpace = 'pre-line';
        resultBlock.appendChild(draft);
        if (Array.isArray(p.notes) && p.notes.length) {
          var ul = el('ul', 'muted');
          for (var i = 0; i < p.notes.length; i++) ul.appendChild(el('li', '', p.notes[i]));
          resultBlock.appendChild(ul);
        }
        target.appendChild(resultBlock);
        var pending = el('p', 'muted', st.loading ? '견적을 다시 계산하고 있습니다.' : '현재 조건으로 다시 계산하면 답장 초안을 볼 수 있습니다.');
        target.appendChild(pending);
        var saveBtn = makeBtn('이 견적 초안 저장', 'saveRepeatedQuote', !canSave(), function () {
          if (!canSave()) { saveBtn.disabled = true; return; }
          var live = getCtx(ctx.threadId);
          if (!live || live.key !== st.key) return;
          var savePayload = {
            threadId: live.threadId, evidenceId: live.evidenceId, methodId: live.methodId,
            expectedQuoteId: p.expectedQuoteId, expectedDraft: p.replyDraft, previewKey: p.previewKey
          };
          if (st.previewOpts.revPresent) savePayload.revisionMinutes = st.previewOpts.rev;
          if (st.previewOpts.allocPresent) savePayload.allocation = st.previewOpts.alloc;
          if (st.previewOpts.confirmedTitle) savePayload.confirmedTitle = true;
          if (savePayload.confirmedTitle === true) savePayload.titleConfirmationKey = p.titleConfirmationKey;
          var savedInputKey = inputKey();
          Promise.resolve(runAction('saveRepeatedQuote', savePayload, '견적 초안을 저장했습니다.', false)).then(function (ok) {
            if (ok && repeatStates[st.key] === st && inputKey() === savedInputKey) { delete repeatStates[st.key]; renderQuoteFormHeader(); }
          });
        });
        function syncPreview() {
          resultBlock.hidden = st.loading || !st.valid || inputKey() !== st.previewKey;
          pending.hidden = !resultBlock.hidden;
          saveBtn.disabled = !canSave();
        }
        syncPreview();
        if (st.askedTitle) {
          var th = findThread(cur.threadId);

          var subjEl = el('div', 'muted', '제목: ' + ((th && th.subject) || ''));
          var reqEl = el('div', 'muted', '최근 메일 발췌문: ' + ((th && getThreadExcerpt(th)) || '메일함에서 원문을 확인해 주세요.'));
          reqEl.style.whiteSpace = 'pre-line';
          var chkRow = el('div', 'row');
          var chkWrap = el('label', '', '메일함에서 최신 원문을 읽고 제목에 별도 견적 조건이 없음을 확인했습니다');
          chkWrap.htmlFor = 'repeat-repeatConfirmTitle';
          var chk = el('input', '');
          chk.id = 'repeat-repeatConfirmTitle';
          chk.type = 'checkbox';
          chk.name = 'repeatConfirmTitle';
          chk.checked = Boolean(st.confirmTitle);
          chk.disabled = busy;
          var onChk = function () { st.confirmTitle = Boolean(chk.checked); syncPreview(); };
          chk.addEventListener('change', onChk);
          chk.addEventListener('input', onChk);
          chkWrap.appendChild(chk);
          chkRow.appendChild(chkWrap);
          target.appendChild(subjEl);
          target.appendChild(reqEl);
          target.appendChild(chkRow);
        }
        if (st.askedRev || st.askedAlloc || st.askedTitle) {
          var row = el('div', 'row');
          if (st.askedRev) row.appendChild(makeInput(cur.unit + '당 수정 시간(분)', 'repeatRevisionMinutes', st.rev, function (v, bad) { st.rev = v; st.revBad = bad; syncPreview(); }));
          if (st.askedAlloc) row.appendChild(makeInput('구독료 배분액(원)', 'repeatAllocation', st.alloc, function (v, bad) { st.alloc = v; st.allocBad = bad; syncPreview(); }));
          row.appendChild(makeBtn('다시 계산', 'repeatRecalculate', busy, requestPreview));
          target.appendChild(row);
        }
        target.appendChild(saveBtn);
      };

      st.redraw();
    }

    function renderQuoteFormHeader() {
      syncOriginalContext();
      clearNode(refs.quoteFormHeader);
      if (!state.quoteThreadId) {
        refs.quoteFormHeader.appendChild(el('h2', '', '견적 작성'));
        refs.quoteFormHeader.appendChild(el('p', 'muted', '위 견적 대상 메일 목록에서 메일을 선택하면 견적 입력 칸이 열립니다.'));
        return;
      }

      var thread = getShownQuoteThread(state.quoteThreadId);
      var form = ensureQuoteForm(state.quoteThreadId, thread);

      var head = el('div', 'row');
      var left = el('div', '');
      left.appendChild(el('h2', '', '견적 작성 · ' + (thread && thread.subject ? thread.subject : '선택한 문의')));
      if (thread && thread.request && getThreadBucket(thread) !== 'waiting_done' && getThreadBucket(thread) !== 'excluded') {
        left.appendChild(el('p', '', '요청 내용: ' + thread.request));
      }
      if (form.referenceId) {
        var jobs = state.data.jobs || [];
        var refName = '선택한 기준 작업';
        for (var i = 0; i < jobs.length; i++) {
          if (jobs[i].id === form.referenceId && jobs[i].title) {
            refName = jobs[i].title;
          }
        }
        left.appendChild(el('p', 'muted', '적용된 기준 작업: ' + refName));
      }
      head.appendChild(left);

      if (thread) {
        var rightAct = el('div', 'actions');
        var handoffBtn = el('button', '', '직원에게 넘기기');
        handoffBtn.type = 'button';
        handoffBtn.disabled = state.busyCount > 0;
        handoffBtn.addEventListener('click', function () {
          openHandoffForThread(thread);
        });
        rightAct.appendChild(handoffBtn);
        var quoteChoicePanel = appendOriginalControls(rightAct, thread, 'quote');
        head.appendChild(rightAct);
      }
      refs.quoteFormHeader.appendChild(head);
      if (quoteChoicePanel) refs.quoteFormHeader.appendChild(quoteChoicePanel);
      renderRepeat(refs.quoteFormHeader, thread);

      if (form.stale && (!thread || thread.awaitingEvidence || !thread.evidenceId || !getThreadExcerpt(thread))) {
        var quoteStaleNotice = el('div', 'notice');
        quoteStaleNotice.textContent = '현재 원문을 확인할 수 없어 입력은 유지했습니다.';
        refs.quoteFormHeader.appendChild(quoteStaleNotice);
      } else if (form.stale) {
        var staleBox = el('div', 'notice');
        staleBox.appendChild(el('strong', '', '현재 문의를 다시 확인해 주세요'));
        staleBox.appendChild(
          el('p', '', '작성한 견적은 그대로 있습니다. 아래 메일 내용이 이번 견적의 기준인지 확인해 주세요.')
        );
        if (thread && getThreadExcerpt(thread)) {
          staleBox.appendChild(el('p', 'muted', '최신 검토 근거: ' + getThreadExcerpt(thread)));
        }
        var reconfirmActions = el('div', 'actions');
        var reconfirmBtn = el('button', 'primary', '최신 메일 내용 수락 재확인');
        reconfirmBtn.type = 'button';
        reconfirmBtn.addEventListener('click', function () {
          var curThread = getShownQuoteThread(state.quoteThreadId);
          form.loadedEvidenceKey = curThread ? getThreadEvidenceKey(curThread) : null;
          form.loadedEvidenceId = curThread && curThread.evidenceId != null ? String(curThread.evidenceId) : null;
          form.stale = false;
          renderQuoteFormHeader();
          syncInteractiveLocks();
        });
        reconfirmActions.appendChild(reconfirmBtn);
        staleBox.appendChild(reconfirmActions);
        refs.quoteFormHeader.appendChild(staleBox);
      }

      var handoffs = state.data.handoffs || [];
      for (var h = 0; h < handoffs.length; h++) {
        var hItem = handoffs[h];
        if (thread && hItem.threadId === thread.id && hItem.evidenceId && hItem.evidenceId === thread.evidenceId &&
            hItem.to === '견적 담당' && !isHandoffFinished(hItem)) {
          var hoNote = el('div', 'notice');
          hoNote.appendChild(el('strong', '', '견적 담당 인계 전달 사항'));
          hoNote.appendChild(el('p', '', '다음 할 일: ' + (hItem.next || '-') + ' · 기한: ' + (hItem.due || '-')));
          if (hItem.conditions) hoNote.appendChild(el('p', 'muted', '조건: ' + hItem.conditions));
          refs.quoteFormHeader.appendChild(hoNote);
          break;
        }
      }

      if (thread && (getThreadExcerpt(thread) || thread.boxLabel)) {
        var det = el('details', '');
        det.open = Boolean(form.stale);
        det.appendChild(el('summary', 'muted', '검토 근거·출처 확인'));
        if (thread.boxLabel) det.appendChild(el('p', 'muted', '메일함: ' + thread.boxLabel));
        if (getThreadExcerpt(thread)) det.appendChild(el('p', '', '검토 근거: ' + getThreadExcerpt(thread)));
        refs.quoteFormHeader.appendChild(det);
      }
    }

    function renderQuoteFormFields() {
      clearNode(refs.quoteFormFields);
      refs.quoteSubmitBtn = null;

      if (!state.quoteThreadId) {
        return;
      }

      var threadId = state.quoteThreadId;
      var qf = ensureQuoteForm(threadId);

      refs.quoteFormFields.appendChild(
        el('p', 'muted', '작업 이름과 범위, 수량, 개당 제작 시간과 수정 시간, 시간당 목표 금액, 개당 생성비와 외주비, 일감 전체 구독료 배분을 모두 입력해야 금액 견적을 저장할 수 있어요. 없는 비용은 0원으로 적으면 돼요.')
      );

      var textGrid = el('div', 'grid');
      textGrid.appendChild(makeBoundField('작업 이름 *', 'input', 'text', 'title', qf, 'title', '예: 신제품 패키지 3종 디자인').wrap);
      textGrid.appendChild(makeBoundField('납품 범위 *', 'textarea', 'text', 'scope', qf, 'scope', '포함 작업과 산출물').wrap);
      textGrid.appendChild(makeDateOrTextField('마감일 (납기)', 'deadline', qf, 'deadline', 'deadlineMode', '예: 착수 후 7영업일').wrap);
      textGrid.appendChild(makeBoundField('진행·결제 조건', 'textarea', 'text', 'terms', qf, 'terms', '예: 선금 50%, 수정 2회 포함').wrap);
      refs.quoteFormFields.appendChild(textGrid);

      var workGrid = el('div', 'grid');
      workGrid.appendChild(makeBoundField('수량 *', 'input', 'number', 'quantity', qf, 'quantity', '').wrap);
      workGrid.appendChild(makeBoundField('제작 시간 (개당 분) *', 'input', 'number', 'buildMinutes', qf, 'buildMinutes', '').wrap);
      workGrid.appendChild(makeBoundField('수정 시간 (개당 분) *', 'input', 'number', 'revisionMinutes', qf, 'revisionMinutes', '').wrap);
      workGrid.appendChild(makeBoundField('목표 단가 (시간당 원) *', 'input', 'number', 'hourlyRate', qf, 'hourlyRate', '').wrap);
      refs.quoteFormFields.appendChild(workGrid);

      var costGrid = el('div', 'grid');
      var directF = makeBoundField('직접 생성비 (개당 원) *', 'input', 'number', 'directCost', qf, 'directCost', '없으면 0 입력');
      var subF = makeBoundField('외주비 (개당 원) *', 'input', 'number', 'subcontractCost', qf, 'subcontractCost', '없으면 0 입력');
      var allocF = makeBoundField('구독료 배분 (일감 전체 원) *', 'input', 'number', 'allocation', qf, 'allocation', '없으면 0 입력');
      costGrid.appendChild(directF.wrap);
      costGrid.appendChild(subF.wrap);
      costGrid.appendChild(allocF.wrap);

      var taxWrap = el('label', 'field');
      taxWrap.appendChild(el('span', '', '부가세 방식'));
      var taxSelect = el('select', '');
      taxSelect.name = 'taxMode';
      for (var t = 0; t < TAX_OPTIONS.length; t++) {
        var opt = el('option', '', TAX_OPTIONS[t].label);
        opt.value = TAX_OPTIONS[t].value;
        if (qf.taxMode === TAX_OPTIONS[t].value) {
          opt.selected = true;
        }
        taxSelect.appendChild(opt);
      }
      taxSelect.addEventListener('change', function () {
        qf.taxMode = taxSelect.value;
      });
      taxWrap.appendChild(taxSelect);
      costGrid.appendChild(taxWrap);

      if (qf.replyFormat !== 'items' && qf.replyFormat !== 'paragraph') {
        qf.replyFormat = 'paragraph';
      }
      var replyFormatWrap = el('div', taxWrap.tagName === 'DIV' ? taxWrap.className : '');
      var replyFormatLabel = el('label', taxWrap.tagName === 'LABEL' ? taxWrap.className : '', '답장 형식');
      replyFormatLabel.htmlFor = 'qf-reply-format';
      var replyFormatSelect = el('select', taxSelect.className || '');
      replyFormatSelect.id = 'qf-reply-format';
      replyFormatSelect.name = 'replyFormat';
      var replyFormatOptions = [
        { value: 'paragraph', label: '문장형' },
        { value: 'items', label: '항목형' }
      ];
      for (var rf = 0; rf < replyFormatOptions.length; rf++) {
        var rfOpt = el('option', '', replyFormatOptions[rf].label);
        rfOpt.value = replyFormatOptions[rf].value;
        if (qf.replyFormat === replyFormatOptions[rf].value) {
          rfOpt.selected = true;
        }
        replyFormatSelect.appendChild(rfOpt);
      }
      replyFormatSelect.addEventListener('change', function () {
        qf.replyFormat = replyFormatSelect.value;
      });
      replyFormatWrap.appendChild(replyFormatLabel);
      replyFormatWrap.appendChild(replyFormatSelect);
      costGrid.appendChild(replyFormatWrap);

      refs.quoteFormFields.appendChild(costGrid);
      refs.quoteFormFields.appendChild(el('p', 'muted', '단위당 제작·수정 시간(분)을 60으로 나눠 시간당 목표 금액을 곱하고 개당 생성비와 외주비를 더한 값에 수량을 곱한 뒤, 전체 구독료 배분을 한 번 더해 계산해요.'));

      var actionsRow = el('div', 'actions');
      var fillZeroCostBtn = el('button', '', '선택 비용 0원 채우기');
      fillZeroCostBtn.type = 'button';
      fillZeroCostBtn.addEventListener('click', function () {
        if (String(qf.directCost).trim() === '') {
          qf.directCost = '0';
          directF.control.value = '0';
        }
        if (String(qf.subcontractCost).trim() === '') {
          qf.subcontractCost = '0';
          subF.control.value = '0';
        }
        if (String(qf.allocation).trim() === '') {
          qf.allocation = '0';
          allocF.control.value = '0';
        }
      });
      actionsRow.appendChild(fillZeroCostBtn);

      var saveQuoteBtn = el('button', 'primary', '견적 초안 저장');
      saveQuoteBtn.type = 'button';
      saveQuoteBtn.addEventListener('click', function () {
        if (qf.stale) {
          setNotice('새 메일이 도착했습니다. 위에서 최신 내용을 확인한 뒤 저장해 주세요.', true);
          return;
        }
        var shownThread = getShownQuoteThread(threadId);
        var dlVal = qf.deadlineMode === 'undecided' ? '' : String(qf.deadline || '').trim();
        var dlExact = qf.deadlineMode === 'exact' && isExactIsoDate(dlVal);
        var intFields = [
          'quantity',
          'buildMinutes',
          'revisionMinutes',
          'hourlyRate',
          'directCost',
          'subcontractCost',
          'allocation'
        ];
        var payload = {
          threadId: threadId,
          title: String(qf.title || '').trim(),
          scope: String(qf.scope || '').trim(),
          deadline: dlVal,
          deadlineMode: dlExact ? 'exact' : (dlVal ? 'text' : 'undecided'),
          deadlineState: dlExact ? 'exact' : (dlVal ? 'text' : 'undecided'),
          terms: String(qf.terms || '').trim(),
          taxMode: qf.taxMode || 'undecided',
          replyFormat: qf.replyFormat === 'items' ? 'items' : 'paragraph'
        };
        if (shownThread && shownThread.evidenceId !== undefined && shownThread.evidenceId !== null) {
          payload.evidenceId = shownThread.evidenceId;
        }
        if (qf.referenceId) {
          payload.referenceId = qf.referenceId;
        }
        for (var k = 0; k < intFields.length; k++) {
          var fieldKey = intFields[k];
          var parsed = parseOptionalInt(qf[fieldKey]);
          if (!parsed.valid) {
            setNotice('숫자 항목에는 0 이상의 정수만 입력해 주세요.', true);
            return;
          }
          payload[fieldKey] = parsed.blank ? null : parsed.value;
        }
        runAction('quote', payload, '견적 초안을 저장했습니다.', false);
      });
      refs.quoteSubmitBtn = saveQuoteBtn;
      actionsRow.appendChild(saveQuoteBtn);

      refs.quoteFormFields.appendChild(actionsRow);
      syncInteractiveLocks();
    }

    var REPEAT_UNIT_OPTIONS = ['편', '개', '장', '건', '세트', '부', '종'];

    function findRememberedQuote() {
      var quotes = (state.data && state.data.quotes) || [];
      for (var i = 0; i < quotes.length; i++) {
        if (quotes[i] && quotes[i].repeatMethod) {
          return quotes[i];
        }
      }
      return null;
    }

    function canRememberQuote(q, linkedThread) {
      if (!q || !linkedThread) return false;
      if (q.evidenceId == null || q.evidenceId === '' || linkedThread.evidenceId == null || linkedThread.evidenceId === '') {
        return false;
      }
      var targetEvidenceId = String(linkedThread.evidenceId);
      if (String(q.evidenceId) !== targetEvidenceId) return false;
      var sameEvidenceQuotes = (getQuotesForThread(q.threadId) || []).filter(function (item) {
        return item && item.evidenceId != null && item.evidenceId !== '' && String(item.evidenceId) === targetEvidenceId;
      });
      var latest = sameEvidenceQuotes[0];
      return Boolean(latest && latest.id === q.id);
    }

    function getQuoteTaxLabel(taxMode) {
      for (var i = 0; i < TAX_OPTIONS.length; i++) {
        if (TAX_OPTIONS[i].value === taxMode) {
          return TAX_OPTIONS[i].label;
        }
      }
      return taxMode || '미정';
    }

    function getReplyFormatLabel(replyFormat) {
      return replyFormat === 'items' ? '항목형' : '문장형';
    }

    function createRepeatControls(q) {
      var savedMethod = q.repeatMethod || null;
      var disabled = state.busyCount > 0;

      var unitId = 'repeat-unit-' + q.id;
      var unitWrap = el('div', '');
      var unitLabel = el('label', '', '수량 단위');
      unitLabel.htmlFor = unitId;
      var unitSelect = el('select', '');
      unitSelect.id = unitId;
      unitSelect.name = 'unit';
      var initialUnit = savedMethod && savedMethod.unit ? savedMethod.unit : REPEAT_UNIT_OPTIONS[0];
      for (var i = 0; i < REPEAT_UNIT_OPTIONS.length; i++) {
        var opt = el('option', '', REPEAT_UNIT_OPTIONS[i]);
        opt.value = REPEAT_UNIT_OPTIONS[i];
        if (REPEAT_UNIT_OPTIONS[i] === initialUnit) {
          opt.selected = true;
        }
        unitSelect.appendChild(opt);
      }
      unitSelect.disabled = disabled;
      unitWrap.appendChild(unitLabel);
      unitWrap.appendChild(unitSelect);

      var revId = 'repeat-revisions-' + q.id;
      var revWrap = el('div', '');
      var revLabel = el('label', '', '기준 수정 횟수');
      revLabel.htmlFor = revId;
      var revInput = el('input', '');
      revInput.id = revId;
      revInput.name = 'includedRevisions';
      revInput.type = 'number';
      revInput.min = '0';
      revInput.step = '1';
      revInput.required = true;
      revInput.value = savedMethod && savedMethod.includedRevisions !== undefined && savedMethod.includedRevisions !== null
        ? String(savedMethod.includedRevisions)
        : '';
      revInput.disabled = disabled;
      revWrap.appendChild(revLabel);
      revWrap.appendChild(revInput);

      return { unitWrap: unitWrap, unitSelect: unitSelect, revWrap: revWrap, revInput: revInput };
    }

    function buildRepeatMethodForm(q, linkedThread, source) {
      var form = el('form', '');
      form.noValidate = true;

      var fmtWon = function (v) {
        return v != null && v !== '' && isFinite(Number(v)) ? Number(v).toLocaleString('ko-KR') + '원' : '-';
      };
      var fmtMin = function (v) {
        return v != null && v !== '' && isFinite(Number(v)) ? String(Number(v)) + '분' : '-';
      };
      var scopeText = q.scope != null && String(q.scope).trim() !== '' ? String(q.scope).trim() : '미지정';
      var summaryText = '납품 범위 ' + scopeText
        + ' · 시간당 ' + fmtWon(q.hourlyRate)
        + ' · 수량 한 단위당 제작 ' + fmtMin(q.buildMinutes)
        + ' · 한 단위당 수정 ' + fmtMin(q.revisionMinutes)
        + ' · 수량 한 단위의 직접 생성비 ' + fmtWon(q.directCost) + ' 및 외주비 ' + fmtWon(q.subcontractCost)
        + ' · 작업 전체의 구독료 배분액 ' + fmtWon(q.allocation)
        + ' · 세금 ' + (getQuoteTaxLabel(q.taxMode) || '-')
        + ' · 답장 형식 ' + (getReplyFormatLabel(q.replyFormat) || '-');
      form.appendChild(el('p', 'muted', summaryText + ' 기준으로 기억합니다. 고객별 납기와 조건은 매번 새 문의에서 읽습니다.'));

      var savedMethod = q.repeatMethod || null;
      if (source && source.id !== q.id) {
        form.appendChild(el('p', 'notice', '확정하면 기존(' + (source.title || '이전 견적') + ') 대신 이 견적으로 회원 가격표를 교체합니다.'));
      } else if (savedMethod) {
        var curRev = savedMethod.includedRevisions != null ? String(savedMethod.includedRevisions) : '0';
        form.appendChild(el('p', 'muted', '이미 기억한 견적입니다 · 저장된 단위: ' + (savedMethod.unit || '-') + ' · 기준 수정 횟수: ' + curRev + '회'));
      } else {
        form.appendChild(el('p', 'muted', '확정하면 이 단가와 답장 형식을 다음 견적에 쓸 방식으로 기억합니다.'));
      }

      var controls = createRepeatControls(q);
      form.appendChild(controls.unitWrap);
      form.appendChild(controls.revWrap);

      var errEl = el('p', 'muted', '');
      errEl.hidden = true;
      form.appendChild(errEl);
      controls.revInput.addEventListener('input', function () {
        errEl.textContent = '';
        errEl.hidden = true;
      });

      var actRow = el('div', 'actions');
      var saveBtn = el('button', '', '방식 확정 저장');
      saveBtn.type = 'submit';
      saveBtn.name = 'confirmRepeatMethod';
      saveBtn.disabled = state.busyCount > 0;
      actRow.appendChild(saveBtn);
      form.appendChild(actRow);

      form.addEventListener('submit', function (evt) {
        evt.preventDefault();
        if (state.busyCount > 0) return;
        var rawVal = String(controls.revInput.value || '').trim();
        var revNum = Number(rawVal);
        var badInput = Boolean(controls.revInput.validity && controls.revInput.validity.badInput);
        if (badInput || rawVal === '' || !isFinite(revNum) || revNum < 0 || Math.floor(revNum) !== revNum) {
          errEl.textContent = rawVal === '' && !badInput
            ? '기준 수정 횟수를 입력해 주세요.'
            : '기준 수정 횟수는 0 이상의 정수로 입력해 주세요.';
          errEl.hidden = false;
          controls.revInput.focus();
          return;
        }
        runAction('rememberQuote', {
          threadId: q.threadId,
          evidenceId: linkedThread.evidenceId,
          quoteId: q.id,
          expectedMethodId: source && source.repeatMethod ? (source.repeatMethod.id || '') : '',
          unit: controls.unitSelect.value,
          includedRevisions: revNum === 0 ? 0 : revNum
        }, '방식을 기억했습니다.', false);
      });

      return form;
    }

    function renderRepeatMethodControl(q, linkedThread, drafts) {
      var hasSaved = Boolean(q && q.repeatMethod);
      var eligible = canRememberQuote(q, linkedThread);
      if (!hasSaved && !eligible) {
        return null;
      }
      var wrap = el('div', '');
      if (hasSaved) {
        var savedRevText = q.repeatMethod.includedRevisions != null ? String(q.repeatMethod.includedRevisions) + '회' : '-';
        wrap.appendChild(el('p', 'muted', '기억된 방식: 수량 단위 ' + (q.repeatMethod.unit || '-') + ' · 기준 수정 횟수 ' + savedRevText));
      }
      if (!eligible) {
        return wrap;
      }
      var source = findRememberedQuote();
      var details = el('details', '');
      var key = JSON.stringify([q.id, linkedThread.evidenceId, source && source.repeatMethod.id]);
      details.dataset.repeatDraft = key;
      details.appendChild(el('summary', '', '다음에도 이렇게'));
      details.appendChild(buildRepeatMethodForm(q, linkedThread, source));
      var previous = drafts.get(key);
      if (previous) {
        details.open = previous.open;
        details.querySelector('[name="unit"]').value = previous.unit;
        details.querySelector('[name="includedRevisions"]').value = previous.revisions;
      }
      wrap.appendChild(details);
      return wrap;
    }

var drafts = new Map();
    function renderQuotesList() {
      var openHistory = new Set(Array.from(refs.quotesListRegion.querySelectorAll('details[data-quote-history][open]')).map(function (entry) { return entry.dataset.quoteHistory; }));
      var focusKey, focusName;
      refs.quotesListRegion.querySelectorAll('details[data-repeat-draft]').forEach(function (details) {
        var focused = document.activeElement;
        if (details.contains(focused) && (focused.name === 'unit' || focused.name === 'includedRevisions')) {
          focusKey = details.dataset.repeatDraft;
          focusName = focused.name;
        }
        drafts.set(details.dataset.repeatDraft, { open: details.open, unit: details.querySelector('[name="unit"]').value,
          revisions: details.querySelector('[name="includedRevisions"]').value });
      });
      var storedQuotes = (state.data && state.data.quotes) || [];
      var currentRemembered = findRememberedQuote();
      var currentRepeatMethodId = currentRemembered && currentRemembered.repeatMethod && currentRemembered.repeatMethod.id;
      var validDraftKeys = new Set();
      storedQuotes.forEach(function (q) {
        if (!q) return;
        var thread = findThread(q.threadId);
        if (thread && thread.evidenceId && thread.evidenceId !== q.evidenceId) {
          return;
        }
        validDraftKeys.add(JSON.stringify([q.id, q.evidenceId, currentRepeatMethodId]));
      });
      Array.from(drafts.keys()).forEach(function (key) {
        if (!validDraftKeys.has(key)) {
          drafts.delete(key);
        }
      });
      clearNode(refs.quotesListRegion);
      var head = el('div', 'row');
      head.appendChild(el('h2', '', '저장된 견적 초안'));
      head.appendChild(el('span', 'muted', '총 ' + state.data.quotes.length + '건'));
      refs.quotesListRegion.appendChild(head);

      var quotes = state.data.quotes || [];
      if (quotes.length === 0) {
        refs.quotesListRegion.appendChild(el('p', 'muted', '아직 저장된 견적 초안이 없습니다.'));
        return;
      }

      for (var i = 0; i < quotes.length; i++) {
        var q = quotes[i];
        var card = el('div', 'section');
        var topRow = el('div', 'row');
        var left = el('div', '');
        var verPrefix = q.version !== undefined && q.version !== null ? 'v' + q.version + ' · ' : '';
        left.appendChild(el('strong', '', verPrefix + (q.title || '견적 초안')));
        var linkedThread = findThread(q.threadId);
        var current = hasCurrentEvidence(q) && getQuotesForThread(q.threadId).find(hasCurrentEvidence)?.id === q.id;
        var originalSubject = q.subject || (linkedThread && q.evidenceId && q.evidenceId === linkedThread.evidenceId && linkedThread.subject);
        if (originalSubject) {
          left.appendChild(el('p', 'muted', '대상 메일: ' + originalSubject));
        }
        topRow.appendChild(left);

        card.appendChild(topRow);
        var content = card;
        if (current) {
          topRow.appendChild(el('strong', '', '합계: ' + formatTotal(q.total)));
        } else {
          content = el('details', '');
          content.dataset.quoteHistory = q.id;
          content.open = openHistory.has(q.id);
          content.appendChild(el('summary', '', '이전 견적 이력 보기'));
          card.appendChild(content);
        }

        var breakdownParts = [
          '공급가액: ' + formatSubtotal(q.subtotal),
          '부가세: ' + formatTax(q.tax),
          '총액: ' + formatTotal(q.total)
        ];
        if (q.deadline) {
          breakdownParts.push(isExactIsoDate(q.deadline) ? ('정확한 마감일: ' + q.deadline) : ('납기: ' + q.deadline));
        }
        content.appendChild(el('p', 'muted', breakdownParts.join(' · ')));

        if (q.replyDraft) {
          var draftNotice = el('div', 'notice');
          draftNotice.appendChild(el('div', 'muted', current ? '견적 답장 초안' : '당시 견적 답장 초안'));
          var draftBody = el('p', '', q.replyDraft);
          draftBody.style.whiteSpace = 'pre-line';
          draftNotice.appendChild(draftBody);
          content.appendChild(draftNotice);
        }

        if (q.referenceTitle) {
          var refDetails = el('details', '');
          refDetails.appendChild(el('summary', 'muted', '참고 기준 작업 보기'));
          refDetails.appendChild(el('p', '', '기준 작업: ' + q.referenceTitle));
          content.appendChild(refDetails);
        }

        var repeatControl = renderRepeatMethodControl(q, current ? linkedThread : null, drafts);
        if (repeatControl) {
          content.appendChild(repeatControl);
        }

        if (current && canRememberQuote(q, linkedThread)) {
          var cardAct = el('div', 'actions');
          var handoffBtn = el('button', '', '직원에게 넘기기');
          handoffBtn.type = 'button';
          handoffBtn.disabled = state.busyCount > 0;
          (function (targetThread) {
            handoffBtn.addEventListener('click', function () {
              openHandoffForThread(targetThread);
            });
          })(linkedThread);
          cardAct.appendChild(handoffBtn);
          card.appendChild(cardAct);
        }

        refs.quotesListRegion.appendChild(card);
      }
      if (focusKey) {
        var restored = Array.from(refs.quotesListRegion.querySelectorAll('details[data-repeat-draft]')).find(function (details) {
          return details.open && details.dataset.repeatDraft === focusKey;
        });
        if (restored) restored.querySelector('[name="' + focusName + '"]').focus({preventScroll:true});
      }
    }

    function renderHandoffPicker() {
      clearNode(refs.handoffPickerRegion);
      var head = el('div', 'row');
      head.appendChild(el('h2', '', '직원에게 넘길 메일 선택'));
      head.appendChild(el('span', 'muted', '요청과 노출된 발췌문을 검토한 뒤 담당자에게 넘길 수 있습니다.'));
      refs.handoffPickerRegion.appendChild(head);

      var rawThreads = state.data.threads || [];
      var threads = [];
      for (var k = 0; k < rawThreads.length; k++) {
        var b = getThreadBucket(rawThreads[k]);
        if (b === 'action' || b === 'review') {
          threads.push(rawThreads[k]);
        }
      }
      if (state.handoffThreadId) {
        var ensuredHandoffThread = getShownHandoffThread(state.handoffThreadId);
        if (
          ensuredHandoffThread &&
          !threads.some(function (t) { return t.id === state.handoffThreadId; })
        ) {
          threads.unshift(ensuredHandoffThread);
        }
      }

      if (threads.length === 0) {
        refs.handoffPickerRegion.appendChild(el('p', 'muted', '선택할 수 있는 메일이 없습니다.'));
        return;
      }

      for (var i = 0; i < threads.length; i++) {
        (function (t) {
          var selected = state.handoffThreadId === t.id;
          var hideReq = getThreadBucket(t) === 'waiting_done' || getThreadBucket(t) === 'excluded';
          var r = el('div', selected ? 'row selected' : 'row');
          var info = el('div', '');
          info.appendChild(el('strong', '', t.subject || '(제목 없음)'));
          info.appendChild(el('p', 'muted', hideReq ? '' : (t.request || '')));
          r.appendChild(info);

          var act = el('div', 'actions');
          var pickBtn = el('button', selected ? 'selected' : '', selected ? '선택됨' : '직원에게 넘기기');
          pickBtn.type = 'button';
          pickBtn.addEventListener('click', function () {
            openHandoffForThread(t);
          });
          act.appendChild(pickBtn);
          r.appendChild(act);
          refs.handoffPickerRegion.appendChild(r);
        })(threads[i]);
      }
    }

    function renderHandoffFormHeader() {
      clearNode(refs.handoffFormHeader);
      if (!state.handoffThreadId) {
        refs.handoffFormHeader.appendChild(el('h2', '', '인계 작성'));
        refs.handoffFormHeader.appendChild(el('p', 'muted', '메일 목록에서 직원에게 넘기기를 누르면 노출된 발췌문 검토 후 작성할 수 있습니다.'));
        return;
      }

      var thread = getShownHandoffThread(state.handoffThreadId);
      var hf = ensureHandoffForm(state.handoffThreadId, thread);
      var excerpt = getThreadExcerpt(thread);

      refs.handoffFormHeader.appendChild(el('h2', '', '인계 작성 · ' + (thread && thread.subject ? thread.subject : '선택한 문의')));

      if (hf.stale && (!thread || thread.awaitingEvidence || !thread.evidenceId || !getThreadExcerpt(thread))) {
        var handoffStaleNotice = el('div', 'notice');
        handoffStaleNotice.textContent = '입력은 유지됐고 선택한 메일 원문을 다시 확인해야 인계할 수 있습니다.';
        refs.handoffFormHeader.appendChild(handoffStaleNotice);
      } else if (hf.stale) {
        var staleWarn = el('div', 'notice');
        staleWarn.appendChild(el('strong', '', '현재 문의를 다시 확인해 주세요'));
        staleWarn.appendChild(
          el('p', '', '작성한 인계 내용은 그대로 있습니다. 아래 발췌문을 확인한 뒤 직원에게 전달할 내용을 다시 승인해 주세요.')
        );
        refs.handoffFormHeader.appendChild(staleWarn);
      }

      var reviewBox = el('div', 'notice');
      reviewBox.appendChild(el('strong', '', '전달 전 노출된 발췌문·근거 검토'));
      if (thread && thread.request && getThreadBucket(thread) !== 'waiting_done' && getThreadBucket(thread) !== 'excluded') {
        reviewBox.appendChild(el('p', '', '요청 내용: ' + thread.request));
      }
      if (excerpt) {
        reviewBox.appendChild(el('p', '', '노출된 발췌문: ' + excerpt));
      } else {
        reviewBox.appendChild(el('p', 'muted', '노출된 발췌문이 없어 인계할 수 없습니다.'));
      }
      if (thread && thread.boxLabel) {
        reviewBox.appendChild(el('p', 'muted', '메일함: ' + thread.boxLabel));
      }
      var latest = currentThreadQuote(thread);
      if (latest) {
        reviewBox.appendChild(
          el('p', 'muted', '저장된 견적 참고: v' + latest.version + ' ' + latest.title + ' (' + formatTotal(latest.total) + ')')
        );
      }

      if (excerpt) {
        var confirmLabel = el('label', 'row');
        var confirmCheck = el('input', '');
        confirmCheck.type = 'checkbox';
        confirmCheck.name = 'excerptReviewed';
        confirmCheck.checked = isHandoffExcerptConfirmed(state.handoffThreadId);
        confirmCheck.addEventListener('change', function () {
          var curTh = getShownHandoffThread(state.handoffThreadId);
          if (confirmCheck.checked && curTh && getThreadExcerpt(curTh)) {
            hf.loadedEvidenceKey = getThreadEvidenceKey(curTh);
            hf.loadedEvidenceId = curTh.evidenceId != null ? String(curTh.evidenceId) : null;
            hf.confirmedEvidenceKey = hf.loadedEvidenceKey;
            hf.confirmedEvidenceId = hf.loadedEvidenceId;
            hf.stale = false;
          } else {
            hf.confirmedEvidenceKey = null;
            hf.confirmedEvidenceId = null;
          }
          renderHandoffFormHeader();
          syncInteractiveLocks();
        });
        var checkWrap = el('div', 'actions');
        checkWrap.appendChild(confirmCheck);
        checkWrap.appendChild(el('span', '', '위 노출된 발췌문을 검토했으며 직원 인계에 포함하는 것을 승인합니다.'));
        confirmLabel.appendChild(checkWrap);
        reviewBox.appendChild(confirmLabel);
      }

      if (!isHandoffExcerptConfirmed(state.handoffThreadId)) {
        reviewBox.appendChild(
          el('p', 'muted', '발췌문 검토 승인란에 체크한 상태에서만 인계 전달 버튼이 활성화됩니다.')
        );
      }

      refs.handoffFormHeader.appendChild(reviewBox);
    }

    function renderHandoffFormFields() {
      clearNode(refs.handoffFormFields);
      refs.handoffSubmitBtn = null;

      if (!state.handoffThreadId) {
        return;
      }

      var threadId = state.handoffThreadId;
      var hf = ensureHandoffForm(threadId);

      var grid = el('div', 'grid');

      var toWrap = el('label', 'field');
      toWrap.appendChild(el('span', '', '받는 담당'));
      var toSelect = el('select', '');
      toSelect.name = 'to';
      for (var i = 0; i < HANDOFF_TARGETS.length; i++) {
        var opt = el('option', '', HANDOFF_TARGETS[i]);
        opt.value = HANDOFF_TARGETS[i];
        if (hf.to === HANDOFF_TARGETS[i]) {
          opt.selected = true;
        }
        toSelect.appendChild(opt);
      }
      toSelect.addEventListener('change', function () {
        hf.to = toSelect.value;
      });
      toWrap.appendChild(toSelect);
      grid.appendChild(toWrap);

      grid.appendChild(makeBoundField('다음 할 일 *', 'input', 'text', 'next', hf, 'next', '예: 인쇄 사양 확인 후 시안 착수').wrap);
      grid.appendChild(makeDateOrTextField('기한 (마감일)', 'due', hf, 'due', 'dueMode', '예: 금요일 15:00').wrap);
      grid.appendChild(makeBoundField('참고 자료', 'input', 'text', 'reference', hf, 'reference', '예: 견적 초안 v1, 첨부 사양서').wrap);
      grid.appendChild(makeBoundField('전달 조건·주의사항', 'textarea', 'text', 'conditions', hf, 'conditions', '고객 요청 조건과 주의사항').wrap);

      refs.handoffFormFields.appendChild(grid);

      var act = el('div', 'actions');
      var submitBtn = el('button', 'primary', '인계 전달');
      submitBtn.type = 'button';
      submitBtn.addEventListener('click', function () {
        var shownThread = getShownHandoffThread(threadId);
        if (!shownThread || hf.stale || !isHandoffExcerptConfirmed(threadId)) {
          setNotice(
            hf.stale
              ? '새 메일이 도착했습니다. 최신 메일에서 직원에게 전달할 내용을 다시 확인해 주세요.'
              : '노출된 발췌문을 먼저 검토하고 승인 체크박스를 선택해 주세요.',
            true
          );
          return;
        }
        var dueVal = hf.dueMode === 'undecided' ? '' : String(hf.due || '').trim();
        var dueExact = hf.dueMode === 'exact' && isExactIsoDate(dueVal);
        var payload = {
          threadId: threadId,
          to: hf.to || HANDOFF_TARGETS[0],
          conditions: String(hf.conditions || '').trim(),
          next: String(hf.next || '').trim(),
          due: dueVal,
          dueMode: dueExact ? 'exact' : (dueVal ? 'text' : 'undecided'),
          dueState: dueExact ? 'exact' : (dueVal ? 'text' : 'undecided'),
          reference: String(hf.reference || '').trim()
        };
        if (shownThread.evidenceId !== undefined && shownThread.evidenceId !== null) {
          payload.evidenceId = shownThread.evidenceId;
        }
        var submittedForm = JSON.stringify(hf);
        runAction('handoff', payload, payload.to + '에게 인계를 등록했습니다.', false).then(function (ok) {
          if (ok && state.handoffForms[threadId]?.loadedEvidenceId === payload.evidenceId &&
              JSON.stringify(state.handoffForms[threadId]) === submittedForm) {
            if (state.handoffFilter !== 'all' && state.handoffFilter !== payload.to) {
              state.handoffFilter = 'all';
            }
            state.handoffForms[threadId] = createEmptyHandoffForm(getShownHandoffThread(threadId));
            renderHandoffFormHeader();
            renderHandoffFormFields();
            renderHandoffList();
            syncInteractiveLocks();
          }
        });
      });
      refs.handoffSubmitBtn = submitBtn;
      act.appendChild(submitBtn);
      refs.handoffFormFields.appendChild(act);
      syncInteractiveLocks();
    }

    function renderSingleHandoffCard(item) {
      var finished = isHandoffFinished(item);
      var accepted = isHandoffAccepted(item);
      var linked = getShownHandoffThread(item.threadId);
      var subject = item.subject || (linked && linked.subject) || '(제목 없음)';
      var current = hasCurrentEvidence(item);

      var card = el('div', 'section');
      var top = el('div', 'row');
      var left = el('div', '');
      left.appendChild(el('strong', '', subject));
      left.appendChild(el('span', 'muted', ' · 받는 담당: ' + (item.to || '-')));
      top.appendChild(left);

      var stateLabel = finished ? '인계 완료됨' : !current ? '이전 메일 인계 · 최신 문의 확인 필요' : (accepted ? '접수됨 · 업무 시작 가능' : '접수 대기');
      top.appendChild(el('span', 'muted', stateLabel));
      card.appendChild(top);

      var content = card;
      if (!current) {
        content = el('details', '');
        content.appendChild(el('summary', '', '이전 메일의 인계 기록 보기'));
        card.appendChild(content);
      }
      if (item.request) content.appendChild(el('p', '', '고객 요청 · ' + item.request));
      content.appendChild(el('p', '', '조건: ' + (item.conditions || '-')));
      var dueText = item.due
        ? (isExactIsoDate(item.due) ? (item.due + ' (정확한 날짜)') : item.due)
        : '-';
      content.appendChild(el('p', '', '다음 할 일: ' + (item.next || '-') + ' · 기한: ' + dueText));
      content.appendChild(el('p', 'muted', '참고: ' + (item.reference || '-')));
      if (!current) {
        content.appendChild(el('p', 'muted', '당시 승인한 발췌문 · ' + (item.excerpt || '-')));
        if (!finished) card.appendChild(el('p', 'muted', '메일 목록에서 최신 문의를 확인한 뒤 다시 인계해 주세요.'));
        return card;
      }

      var act = el('div', 'actions');
      if (!accepted && !finished) {
        var acceptBtn = el('button', 'primary', '인계 접수');
        acceptBtn.type = 'button';
        acceptBtn.disabled = state.busyCount > 0;
        acceptBtn.addEventListener('click', function () {
          runAction('accept', { id: item.id }, '인계를 접수했습니다. 이제 업무를 시작할 수 있습니다.', false);
        });
        act.appendChild(acceptBtn);
      }

      if (item.to === '견적 담당') {
        var currentMail = findThread(item.threadId);
        if (!currentMail || !item.evidenceId || currentMail.evidenceId !== item.evidenceId) {
          act.appendChild(el('p', 'muted', '메일 목록에서 최신 문의를 확인한 뒤 견적을 작성해 주세요.'));
        } else {
          var writeQuoteBtn = el('button', accepted && !finished ? 'primary' : '', '이 문의로 견적 작성');
          writeQuoteBtn.type = 'button';
          writeQuoteBtn.disabled = state.busyCount > 0;
          writeQuoteBtn.addEventListener('click', function () {
            openQuoteFromHandoff(item);
          });
          act.appendChild(writeQuoteBtn);
        }
      }

      if (accepted && !finished) {
        var finishBtn = el('button', item.to === '견적 담당' ? '' : 'primary', '인계 완료');
        finishBtn.type = 'button';
        finishBtn.disabled = state.busyCount > 0;
        finishBtn.addEventListener('click', function () {
          runAction('finish', { id: item.id }, '인계를 완료했습니다.', false);
        });
        act.appendChild(finishBtn);
      }
      if (act.firstChild) {
        card.appendChild(act);
      }

      if (accepted || finished) {
        var docDetails = el('details', '');
        var docKey = String(item.id || (String(item.threadId || '') + ':' + String(item.to || '')));
        docDetails.open = Boolean(state.openHandoffDocs[docKey]);
        docDetails.addEventListener('toggle', function () {
          state.openHandoffDocs[docKey] = docDetails.open;
        });
        docDetails.appendChild(el('summary', '', '인계문 보기'));
        var docTextarea = el('textarea', '');
        docTextarea.readOnly = true;
        docTextarea.rows = 6;
        docTextarea.name = 'handoffDocument';
        docTextarea.setAttribute('aria-label', '직원에게 전달할 인계문');
        docTextarea.value = [
          '받는 담당: ' + (item.to || '-'),
          '다음 할 일: ' + (item.next || '-'),
          '전달 조건: ' + (item.conditions || '-'),
          '기한: ' + (item.due || '-'),
          '참고 자료: ' + (item.reference || '-'),
          '승인 발췌문: ' + (item.excerpt || '-')
        ].join('\n');
        docDetails.appendChild(docTextarea);
        card.appendChild(docDetails);
      }

      return card;
    }

    function renderHandoffList() {
      clearNode(refs.handoffListRegion);
      var head = el('div', 'row');
      head.appendChild(el('h2', '', '담당자별 수신 인계함'));

      var filterBar = el('div', 'actions');
      var filterOptions = [{ value: 'all', label: '전체' }];
      for (var t = 0; t < HANDOFF_TARGETS.length; t++) {
        filterOptions.push({ value: HANDOFF_TARGETS[t], label: HANDOFF_TARGETS[t] });
      }
      for (var f = 0; f < filterOptions.length; f++) {
        (function (opt) {
          var btn = el('button', state.handoffFilter === opt.value ? 'selected' : '', opt.label);
          btn.type = 'button';
          btn.addEventListener('click', function () {
            state.handoffFilter = opt.value;
            renderHandoffList();
          });
          filterBar.appendChild(btn);
        })(filterOptions[f]);
      }
      head.appendChild(filterBar);
      refs.handoffListRegion.appendChild(head);

      var handoffs = state.data.handoffs || [];
      if (handoffs.length === 0) {
        refs.handoffListRegion.appendChild(el('p', 'muted', '등록된 직원 인계가 없습니다.'));
        return;
      }

      if (state.handoffFilter !== 'all') {
        var filtered = handoffs.filter(function (item) {
          return item.to === state.handoffFilter;
        });
        if (filtered.length === 0) {
          refs.handoffListRegion.appendChild(el('p', 'muted', state.handoffFilter + ' 앞으로 전달된 인계가 없습니다.'));
          return;
        }
        for (var i = 0; i < filtered.length; i++) {
          refs.handoffListRegion.appendChild(renderSingleHandoffCard(filtered[i]));
        }
        return;
      }

      var groups = HANDOFF_TARGETS.slice();
      for (var k = 0; k < handoffs.length; k++) {
        if (handoffs[k].to && groups.indexOf(handoffs[k].to) === -1) {
          groups.push(handoffs[k].to);
        }
      }

      for (var g = 0; g < groups.length; g++) {
        var groupName = groups[g];
        var items = [];
        for (var m = 0; m < handoffs.length; m++) {
          if (handoffs[m].to === groupName) {
            items.push(handoffs[m]);
          }
        }
        if (items.length > 0) {
          var groupWrap = el('div', '');
          groupWrap.appendChild(el('h3', '', groupName + ' (' + items.length + '건)'));
          for (var n = 0; n < items.length; n++) {
            groupWrap.appendChild(renderSingleHandoffCard(items[n]));
          }
          refs.handoffListRegion.appendChild(groupWrap);
        }
      }
    }

    function renderDataRegions() {
      syncTabVisibility();
      renderTopRegion();
      renderThreadsList();
      renderBoxesList();
      renderBoxConnectHeaderAndButtons();
      if (!refs.boxConnectBody.firstChild || state.renderedConnectKey !== getConnectRenderKey()) {
        renderBoxConnectBody();
      }
      renderQuoteThreads();
      renderQuoteJobs();
      refs.jobFormSection.hidden = !state.jobFormOpen;
      renderQuoteFormHeader();
      renderQuotesList();
      renderHandoffPicker();
      renderHandoffFormHeader();
      renderHandoffList();
      syncInteractiveLocks();
    }

    renderBoxConnectHeaderAndButtons();
    renderBoxConnectBody();
    renderJobForm();
    renderDataRegions();

    if (typeof api.onChanged === 'function') {
      api.onChanged(function (incoming) {
        if (incoming && typeof incoming === 'object') {
          if (incoming.ok === true && incoming.data) {
            applyIncomingData(incoming.data);
            return;
          }
          if (
            Array.isArray(incoming.threads) ||
            Array.isArray(incoming.boxes) ||
            Array.isArray(incoming.quotes) ||
            Array.isArray(incoming.handoffs)
          ) {
            applyIncomingData(incoming);
            return;
          }
        }
        loadSnapshotQuietly();
      });
    }

    loadSnapshotQuietly();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
  } else {
    mountApp();
  }
})();
