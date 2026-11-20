'use strict';

(() => {
  const DEFAULT_LIMITS = { stories: 200, title: 120, body: 4000, displayName: 40, note: 4000, url: 2000 };
  const SS_PAGE_SIZE = 5;
  const ss = {
    userId: null,
    data: null,
    loading: false,
    queued: false,
    error: '',
    errorCode: '',
    loadSeq: 0,
    loadedAt: 0,
    storyFilter: 'all',
    storyLimit: SS_PAGE_SIZE,
    inquiryStoryId: '',
    inquiryLimit: SS_PAGE_SIZE,
    heldLimit: SS_PAGE_SIZE,
    held: { open: false, loaded: false, loading: false, error: '', inquiries: [], seq: 0 },
    modalCtx: null,
    csrfCache: ''
  };

  function ssEsc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ssIcon(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }

  function ssNotify(message) {
    if (!message) return;
    if (typeof notify === 'function') notify(message);
  }

  function ssIsDemo() {
    return typeof isDemoMode === 'function' && Boolean(isDemoMode());
  }

  function ssIsAdmin() {
    if (typeof isAdmin === 'function') return Boolean(isAdmin());
    return Boolean(typeof state !== 'undefined' && (state.user?.workspaceAccess?.admin || state.user?.role === 'admin'));
  }

  function ssIsViewer() {
    if (ss.data && ss.data.canWrite === false) return true;
    if (typeof isViewer === 'function' && isViewer()) return true;
    return Boolean(typeof state !== 'undefined' && state.user?.role === 'viewer');
  }

  function ssCanWrite() {
    if (ssIsDemo() || !state?.user) return false;
    if (ss.data && typeof ss.data.canWrite === 'boolean') return ss.data.canWrite;
    return !ssIsViewer();
  }

  function ssAuthSnapshot() {
    if (typeof companyAuthSnapshot === 'function') return companyAuthSnapshot();
    return { userId: typeof state !== 'undefined' ? state.user?.id || null : null };
  }

  function ssAuthCurrent(stamp) {
    if (!stamp) return false;
    if (typeof companyAuthCurrent === 'function') return companyAuthCurrent(stamp);
    return (typeof state !== 'undefined' ? state.user?.id || null : null) === stamp.userId;
  }

  function ssUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function ssResolveRequestId(holder, signature) {
    if (holder.requestId && holder.signature === signature) return holder.requestId;
    holder.requestId = ssUuid();
    holder.signature = signature;
    return holder.requestId;
  }

  function ssFormatDate(iso) {
    if (!iso || !Number.isFinite(Date.parse(iso))) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(iso));
  }

  function ssFormatDateTime(iso) {
    if (!iso || !Number.isFinite(Date.parse(iso))) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  function ssSafeHttpsUrl(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 2000 || /[\u0000-\u0020]/.test(trimmed)) return '';
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function ssValidateExternalUrl(raw, maxLen = 2000) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return { ok: true, value: '' };
    if (trimmed.length > maxLen) {
      return { ok: false, message: `원문 주소는 ${maxLen}자 이내로 입력해 주세요.` };
    }
    if (/[\u0000-\u0020]/.test(trimmed)) {
      return { ok: false, message: '원문 주소에 공백이나 제어 문자를 넣을 수 없어요.' };
    }
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { ok: false, message: '올바른 https:// 전체 주소를 입력해 주세요.' };
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, message: 'https://로 시작하는 보안 주소만 등록할 수 있어요.' };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, message: '주소 안에 계정·비밀번호 정보가 포함되어 있으면 등록할 수 없어요.' };
    }
    return { ok: true, value: trimmed };
  }

  async function ssApi(path, body) {
    if (typeof api === 'function') {
      return body === undefined ? api(path) : api(path, body);
    }
    const isPost = body !== undefined;
    const headers = {};
    if (isPost) {
      if (!ss.csrfCache) {
        const meRes = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
        if (meRes.ok) {
          const meData = await meRes.json().catch(() => ({}));
          ss.csrfCache = meData?.csrfToken || '';
        }
      }
      headers['Content-Type'] = 'application/json';
      if (ss.csrfCache) headers['X-CSRF-Token'] = ss.csrfCache;
    }
    const res = await fetch(path, {
      method: isPost ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(isPost ? { body: JSON.stringify(body) } : {})
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(payload?.error || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      err.status = res.status;
      if (payload?.code) err.code = payload.code;
      if (payload?.field) err.field = payload.field;
      if (payload?.story) err.story = payload.story;
      throw err;
    }
    return payload;
  }

  function resetStaffStories({ clearStorage = true } = {}) {
    void clearStorage;
    ss.userId = null;
    ss.data = null;
    ss.loading = false;
    ss.queued = false;
    ss.error = '';
    ss.errorCode = '';
    ss.loadSeq += 1;
    ss.loadedAt = 0;
    ss.storyFilter = 'all';
    ss.storyLimit = SS_PAGE_SIZE;
    ss.inquiryStoryId = '';
    ss.inquiryLimit = SS_PAGE_SIZE;
    ss.heldLimit = SS_PAGE_SIZE;
    ss.held = { open: false, loaded: false, loading: false, error: '', inquiries: [], seq: ss.held.seq + 1 };
    ss.heldFocus = null;
    ss.modalCtx = null;
    ss.csrfCache = '';
  }

  function ssClearHeld({ bumpSeq = true } = {}) {
    ss.heldFocus = null;
    if (ss.data) ss.data.heldInquiryCounts = null;
    if (!ss.held.open && !ss.held.loaded && !ss.held.loading && !ss.held.error && !ss.held.inquiries.length) return;
    ss.held = { open: false, loaded: false, loading: false, error: '', inquiries: [], seq: ss.held.seq + (bumpSeq ? 1 : 0) };
  }

  function ssEnsureUser() {
    const userId = typeof state !== 'undefined' ? state.user?.id || null : null;
    if (!userId) {
      if (ss.userId) resetStaffStories({ clearStorage: false });
      return false;
    }
    if (ss.userId !== userId) {
      resetStaffStories({ clearStorage: false });
      ss.userId = userId;
    } else if (!ssIsAdmin()) {
      ssClearHeld();
    }
    return true;
  }

  function ssLimits() {
    return { ...DEFAULT_LIMITS, ...(ss.data?.limits || {}) };
  }

  function ssFindStory(storyId) {
    if (!storyId || !Array.isArray(ss.data?.stories)) return null;
    return ss.data.stories.find(item => item.id === storyId) || null;
  }

  function ssUpsertStory(story) {
    if (!story || !story.id || !ss.data) return;
    const list = Array.isArray(ss.data.stories) ? [...ss.data.stories] : [];
    const index = list.findIndex(item => item.id === story.id);
    if (index >= 0) list[index] = story;
    else list.unshift(story);
    ss.data = { ...ss.data, stories: list };
  }

  function ssCaptureSectionFocus() {
    const root = document.getElementById('staff-stories-root');
    if (!root) return null;
    const active = document.activeElement;
    if (!active || !root.contains(active)) return null;
    const btn = active.closest?.('[data-action]');
    if (btn) {
      return {
        action: btn.dataset.action || '',
        id: btn.dataset.id || '',
        filter: btn.dataset.filter || ''
      };
    }
    if (active.matches?.('[data-ss-held] > summary')) return { heldSummary: true };
    return null;
  }

  function ssRestoreSectionFocus(saved) {
    const root = document.getElementById('staff-stories-root');
    if (!root || !saved) return;
    if (saved.heldSummary) {
      root.querySelector('[data-ss-held] > summary')?.focus({ preventScroll: true });
      return;
    }
    if (saved.action) {
      const candidates = [...root.querySelectorAll('[data-action]')];
      const match = candidates.find(el =>
        el.dataset.action === saved.action &&
        (el.dataset.id || '') === saved.id &&
        (el.dataset.filter || '') === saved.filter &&
        !el.disabled
      );
      match?.focus({ preventScroll: true });
    }
  }

  function ssCaptureHeldReloadFocus() {
    if (typeof state === 'undefined' || state.tab !== 'home' || !state.user || !ss.held.open) {
      ss.heldFocus = null;
      return;
    }
    const root = document.getElementById('staff-stories-root');
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (!root || !active || !root.contains(active)) {
      ss.heldFocus = null;
      return;
    }
    if (ss.heldFocus?.anchor && active === ss.heldFocus.anchor && ss.heldFocus.userId === ss.userId) {
      return;
    }
    const heldEl = active.closest?.('[data-ss-held]');
    const btn = heldEl ? active.closest?.('[data-action]') : null;
    const action = btn?.dataset?.action || '';
    if (btn && (action === 'ss-held-refresh' || action === 'ss-held-open' || action === 'ss-held-more')) {
      ss.heldFocus = {
        action,
        id: btn.dataset.id || '',
        filter: btn.dataset.filter || '',
        userId: ss.userId,
        anchor: null
      };
    } else {
      ss.heldFocus = null;
    }
  }

  function syncStaffStories() {
    if (typeof state === 'undefined' || state.tab !== 'home' || !state.user) {
      ss.heldFocus = null;
      return;
    }
    const root = document.getElementById('staff-stories-root');
    if (!root) {
      ss.heldFocus = null;
      return;
    }
    const activeBefore = typeof document !== 'undefined' ? document.activeElement : null;
    const pendingHeld = ss.heldFocus;
    const canRestoreHeld = Boolean(
      pendingHeld &&
      pendingHeld.userId === ss.userId &&
      ss.held.open &&
      ssIsAdmin() &&
      !ssIsDemo() &&
      (!pendingHeld.anchor || activeBefore === pendingHeld.anchor)
    );
    if (pendingHeld && !canRestoreHeld) {
      ss.heldFocus = null;
    }
    const focusHeading = activeBefore?.id === 'ss-heading' && root.contains?.(activeBefore);
    const focusState = canRestoreHeld ? null : ssCaptureSectionFocus();
    root.setAttribute('aria-busy', String(ss.loading));
    root.innerHTML = ssInnerHtml();
    if (canRestoreHeld && ss.heldFocus) {
      const heldDetails = root.querySelector('[data-ss-held]');
      if (!heldDetails || !heldDetails.open) {
        ss.heldFocus = null;
      } else if (ss.held.loading) {
        const summary = heldDetails.querySelector('summary');
        if (summary) {
          summary.focus({ preventScroll: true });
          ss.heldFocus.anchor = summary;
        } else {
          ss.heldFocus = null;
        }
      } else {
        const target = ss.heldFocus;
        ss.heldFocus = null;
        const candidates = [...heldDetails.querySelectorAll('[data-action]')];
        const match = candidates.find(el =>
          el.dataset.action === target.action &&
          (el.dataset.id || '') === target.id &&
          (el.dataset.filter || '') === target.filter &&
          !el.disabled
        );
        const fallback = heldDetails.querySelector('summary');
        (match || fallback)?.focus({ preventScroll: true });
      }
    } else {
      ssRestoreSectionFocus(focusState);
    }
    if (focusHeading && !root.contains?.(document.activeElement)) {
      const heading = document.getElementById('ss-heading');
      if (heading && root.contains?.(heading)) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
  }

  async function ssLoad({ silent = false, authRetry = false, syncHeld = true } = {}) {
    if (!ssEnsureUser() || ssIsDemo()) return null;
    const stamp = ssAuthSnapshot();
    const heldSeq = ss.held.seq;
    const seq = ++ss.loadSeq;
    ss.loading = true;
    if (!silent) {
      ss.error = '';
      ss.errorCode = '';
    }
    syncStaffStories();
    try {
      const result = await ssApi('/api/my-stories');
      if (seq !== ss.loadSeq || !ssAuthCurrent(stamp)) return null;
      const hadHeldCounts = Boolean(ss.data?.heldInquiryCounts);
      const rawHeld = ssIsAdmin() && result?.heldInquiryCounts && typeof result.heldInquiryCounts === 'object'
        ? result.heldInquiryCounts
        : null;
      const heldInquiryCounts =
        rawHeld && rawHeld.total != null && rawHeld.new != null && Number.isFinite(Number(rawHeld.total)) && Number.isFinite(Number(rawHeld.new))
          ? {
              total: Math.max(0, Math.trunc(Number(rawHeld.total))),
              new: Math.max(0, Math.trunc(Number(rawHeld.new)))
            }
          : null;
      ss.data = {
        stories: Array.isArray(result?.stories) ? result.stories : [],
        inquiries: Array.isArray(result?.inquiries) ? result.inquiries : [],
        totals: {
          stories: Number(result?.totals?.stories) || 0,
          live: Number(result?.totals?.live) || 0,
          received: Number(result?.totals?.received) || 0,
          open: Number(result?.totals?.open) || 0
        },
        heldInquiryCounts,
        limits: { ...DEFAULT_LIMITS, ...(result?.limits || {}) },
        retentionDays: Number(result?.retentionDays) || 90,
        canWrite: result?.canWrite !== false
      };
      if (!ssIsAdmin() || (!heldInquiryCounts && hadHeldCounts)) {
        ssClearHeld();
      } else if (!ss.held.open && !ss.held.loading) {
        ss.held.loaded = false;
        ss.held.inquiries = [];
        ss.held.error = '';
      } else if (
        syncHeld &&
        ss.held.open &&
        ss.held.loaded &&
        !ss.held.loading &&
        !ss.held.error &&
        ss.held.seq === heldSeq
      ) {
        if (typeof state !== 'undefined' && state.tab === 'home') {
          void ssLoadHeld();
        } else {
          ss.held.loaded = false;
          ss.held.inquiries = [];
        }
      }
      ss.error = '';
      ss.errorCode = '';
      ss.loadedAt = Date.now();
      if (ss.inquiryStoryId && !ss.data.stories.some(s => s.id === ss.inquiryStoryId) && !ss.data.inquiries.some(i => i.storyId === ss.inquiryStoryId)) {
        ss.inquiryStoryId = '';
      }
      return ss.data;
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED' || seq !== ss.loadSeq || !ssAuthCurrent(stamp)) return null;
      if (!ssIsAdmin() || error?.status === 401 || error?.status === 403 || error?.code === 'SYNK_STORY_ADMIN') {
        ssClearHeld();
      }
      ss.error = error?.message || '내 글감을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
      ss.errorCode = error?.code || '';
      return null;
    } finally {
      if (seq === ss.loadSeq) {
        if (ssAuthCurrent(stamp)) {
          ss.loading = false;
          syncStaffStories();
        } else {
          const nextStamp = ssAuthSnapshot();
          if (stamp?.userId && nextStamp.userId === stamp.userId && ss.userId === stamp.userId && nextStamp.generation !== stamp.generation) {
            ss.loading = false;
            ss.csrfCache = '';
            if (!authRetry && typeof state !== 'undefined' && state.tab === 'home' && !ssIsDemo()) {
              void ssLoad({ silent, authRetry: true, syncHeld });
            } else {
              syncStaffStories();
            }
          }
        }
      }
    }
  }

  async function ssLoadHeld({ authRetry = false } = {}) {
    if (!ssEnsureUser() || ssIsDemo()) {
      ss.heldFocus = null;
      return;
    }
    if (!ssIsAdmin()) {
      ssClearHeld();
      syncStaffStories();
      return;
    }
    if (!ss.held.open) {
      ss.heldFocus = null;
      ss.held.loading = false;
      ss.held.loaded = false;
      ss.held.inquiries = [];
      syncStaffStories();
      return;
    }
    ssCaptureHeldReloadFocus();
    const stamp = ssAuthSnapshot();
    const seq = ++ss.held.seq;
    ss.held.loading = true;
    ss.held.loaded = false;
    ss.held.inquiries = [];
    ss.held.error = '';
    syncStaffStories();
    try {
      const result = await ssApi('/api/my-stories/held-inquiries');
      if (seq !== ss.held.seq || !ssAuthCurrent(stamp)) return;
      if (!ssIsAdmin()) {
        ssClearHeld({ bumpSeq: false });
        return;
      }
      const rows = Array.isArray(result?.inquiries) ? result.inquiries : [];
      if (ss.data) {
        ss.data.heldInquiryCounts = {
          total: rows.length,
          new: rows.filter(row => row?.status === 'new').length
        };
      }
      if (!ss.held.open) {
        ss.heldFocus = null;
        ss.held.loaded = false;
        ss.held.inquiries = [];
        return;
      }
      ss.held.inquiries = rows;
      ss.held.loaded = true;
      ss.held.error = '';
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED' || seq !== ss.held.seq || !ssAuthCurrent(stamp)) return;
      if (!ssIsAdmin() || error?.status === 401 || error?.status === 403 || error?.code === 'SYNK_STORY_ADMIN') {
        ssClearHeld({ bumpSeq: false });
      } else {
        ss.held.error = error?.message || '중지된 직원의 문의 목록을 불러오지 못했어요.';
      }
    } finally {
      if (seq === ss.held.seq) {
        if (ssAuthCurrent(stamp)) {
          ss.held.loading = false;
          syncStaffStories();
        } else {
          const nextStamp = ssAuthSnapshot();
          if (stamp?.userId && nextStamp.userId === stamp.userId && ss.userId === stamp.userId && nextStamp.generation !== stamp.generation) {
            ss.held.loading = false;
            ss.csrfCache = '';
            if (!authRetry && typeof state !== 'undefined' && state.tab === 'home' && !ssIsDemo() && ss.held.open && ssIsAdmin()) {
              void ssLoadHeld({ authRetry: true });
            } else {
              ss.heldFocus = null;
              if (!ssIsAdmin()) ssClearHeld({ bumpSeq: false });
              syncStaffStories();
            }
          } else {
            ss.heldFocus = null;
          }
        }
      }
    }
  }

  function ssStoryCardHtml(story, inquiriesByStory, canWrite) {
    const id = ssEsc(story.id);
    const status = story.status;
    const pub = story.public;
    const extUrl = ssSafeHttpsUrl(story.external?.url || '');
    const draftTitle = String(story.draft?.title || '').trim();
    const pubTitle = String(pub?.title || '').trim();
    const headingTitle = draftTitle || pubTitle || '제목 없는 비공개 글감';
    const displayName = String(story.draft?.displayName || pub?.displayName || '').trim();
    const hasNote = Boolean(String(story.draft?.note || '').trim());
    const received = Number(story.inquiries?.received) || 0;
    const openCount = Number(story.inquiries?.open) || 0;
    const listItems = inquiriesByStory.get(story.id) || [];
    const newCount = listItems.filter(row => row.status === 'new').length;

    let statusBadge = '<span class="ss-badge is-draft">비공개 초안</span>';
    if (status === 'live') {
      statusBadge = pub?.open === false
        ? '<span class="ss-badge is-warn">접수 닫힘 · 보기 전용</span>'
        : '<span class="ss-badge is-live">공개 중</span>';
    } else if (status === 'unpublished') {
      statusBadge = '<span class="ss-badge is-off">내림 · 접수 닫힘</span>';
    }

    const firstBadge = story.inquiries?.firstAt
      ? '<span class="ss-badge is-verified">첫 문의 접수 확인</span>'
      : '';
    const changedBadge = story.changedSincePublish
      ? '<span class="ss-badge is-warn">공개본과 다른 초안 있음</span>'
      : '';
    const noteChip = hasNote
      ? '<span class="ss-chip">비공개 개인 노트 있음</span>'
      : '';
    const bodyMode = status !== 'draft' && pub && pub.body === ''
      ? ' · 문의 전용'
      : '';

    const diffHint = pub && story.changedSincePublish
      ? `<p class="ss-diff-hint">현재 방문자에게 보이는 공개 제목: <strong>${ssEsc(pubTitle || '제목 없음')}</strong> · 초안을 수정했지만 다시 공개하기 전까지는 이전 공개본이 그대로 보여요.</p>`
      : '';

    let publicLinkRow = '';
    if (status === 'live' && pub?.url) {
      publicLinkRow = `<div class="ss-link-row"><div class="ss-link-info"><span class="ss-link-label">고유 문의 링크 · ${pub.open === false ? '접수 닫힘' : '접수 열림'}</span><span class="ss-url-code">${ssEsc(pub.url)}</span></div><div class="ss-card-actions"><button type="button" class="ss-btn is-quiet" data-action="ss-copy-link" data-id="${id}">문의 링크 복사</button><button type="button" class="ss-btn is-quiet" data-action="ss-share" data-id="${id}">링크·원문 안내</button></div></div>`;
    } else if (status === 'unpublished' && pub?.url) {
      publicLinkRow = `<div class="ss-link-row"><div class="ss-link-info"><span class="ss-link-label">고유 문의 링크 · 내린 상태</span><span class="ss-card-sub">다시 공개하면 기존 주소 ${ssEsc(pub.url)}로 다시 열려요.</span></div></div>`;
    } else if (!(status === 'draft' && received === 0 && openCount === 0 && listItems.length === 0)) {
      publicLinkRow = `<div class="ss-link-row"><div class="ss-link-info"><span class="ss-link-label">고유 문의 링크</span><span class="ss-card-sub">글감을 공개하면 개인 채널에 붙일 문의 링크가 만들어져요.</span></div></div>`;
    }

    const isQuietDraft = status === 'draft' && !pub?.url && received === 0 && openCount === 0 && listItems.length === 0;
    const extRow = extUrl
      ? `<div class="ss-link-row"><div class="ss-link-info"><span class="ss-link-label"><span class="ss-self-tag">본인 등록</span>개인 채널 원문 주소</span><a class="ss-ext-anchor" href="${ssEsc(extUrl)}" target="_blank" rel="noopener noreferrer">${ssEsc(story.external.url)}</a></div>${canWrite ? `<button type="button" class="ss-btn is-quiet" data-action="ss-link-modal" data-id="${id}">원문 주소 변경</button>` : ''}</div>`
      : isQuietDraft
        ? ''
        : `<div class="ss-link-row"><div class="ss-link-info"><span class="ss-link-label">개인 채널 원문 주소 · 미등록</span><span class="ss-card-sub">글을 올린 개인 채널 주소가 있으면 남겨 두세요. 비워 두어도 괜찮아요.</span></div>${canWrite ? `<button type="button" class="ss-btn is-quiet" data-action="ss-link-modal" data-id="${id}">원문 주소 본인 등록</button>` : ''}</div>`;
    const linksPanel = publicLinkRow || extRow
      ? `<div class="ss-links-panel">${publicLinkRow}${extRow}</div>`
      : '';
    const extLinkBtn = canWrite && isQuietDraft && !extUrl
      ? `<button type="button" class="ss-btn is-quiet" data-action="ss-link-modal" data-id="${id}">원문 주소 본인 등록</button>`
      : '';

    let primaryPublishBtn = '';
    if (canWrite) {
      if (status === 'draft') {
        primaryPublishBtn = `<button type="button" class="ss-btn is-primary" data-action="ss-publish-modal" data-id="${id}">공개 확인 · 발행</button>`;
      } else if (status === 'unpublished') {
        primaryPublishBtn = `<button type="button" class="ss-btn is-primary" data-action="ss-publish-modal" data-id="${id}">다시 공개</button>`;
      } else if (status === 'live' && story.changedSincePublish) {
        primaryPublishBtn = `<button type="button" class="ss-btn is-primary" data-action="ss-publish-modal" data-id="${id}">수정본 다시 공개</button>`;
      }
    }

    const editBtn = canWrite
      ? `<button type="button" class="ss-btn" data-action="ss-edit" data-id="${id}">글감 편집</button>`
      : `<button type="button" class="ss-btn" data-action="ss-view-readonly" data-id="${id}">글감 보기</button>`;
    const unpublishBtn = canWrite && status === 'live'
      ? `<button type="button" class="ss-btn is-quiet" data-action="ss-unpublish-modal" data-id="${id}">공개 내리기</button>`
      : '';
    const inquiryFilterBtn = listItems.length > 0 || openCount > 0
      ? `<button type="button" class="ss-btn is-quiet" data-action="ss-filter-inquiries" data-id="${id}">문의 확인 (${openCount})</button>`
      : '';
    const deleteBtn = canWrite
      ? `<button type="button" class="ss-btn is-quiet" data-action="ss-delete-modal" data-id="${id}">삭제</button>`
      : '';

    const firstAtText = story.inquiries?.firstAt ? ` · 첫 접수 ${ssEsc(ssFormatDate(story.inquiries.firstAt))}` : '';

    return `<article class="ss-card" data-story-id="${id}">
      <div class="ss-card-meta">${statusBadge}${firstBadge}${changedBadge}${noteChip}</div>
      <h3 class="ss-card-title">${ssEsc(headingTitle)}</h3>
      <p class="ss-card-sub">${displayName ? `표시 이름: ${ssEsc(displayName)} · ` : ''}수정 ${ssEsc(ssFormatDateTime(story.updatedAt) || '-')}${ssEsc(bodyMode)}</p>
      ${diffHint}
      ${linksPanel}
      <div class="ss-card-foot">
        <div class="ss-card-counts">실제 접수 누적 <strong>${received}건</strong> · 열람 가능 <strong>${openCount}건</strong>${received > 0 ? firstAtText : ''}${newCount > 0 ? `<span class="ss-new-pill">새 문의 ${newCount}건</span>` : ''}</div>
        <div class="ss-card-actions">${editBtn}${primaryPublishBtn}${extLinkBtn}${inquiryFilterBtn}${unpublishBtn}${deleteBtn}</div>
      </div>
    </article>`;
  }

  function ssPagerHtml(shown, total, unit, action) {
    if (total <= SS_PAGE_SIZE) return '';
    const moreBtn = shown < total
      ? `<button type="button" class="ss-btn is-quiet" data-action="${action}">5개씩 더 보기</button>`
      : '';
    return `<div class="ss-card-actions" data-ss-pager="${action}"><span class="ss-card-sub">현재 ${shown} / ${total}${unit}</span>${moreBtn}</div>`;
  }

  function ssInquiriesHtml(data) {
    const allInquiries = data.inquiries || [];
    const filtered = ss.inquiryStoryId
      ? allInquiries.filter(row => row.storyId === ss.inquiryStoryId)
      : allInquiries;
    const filterStory = ss.inquiryStoryId ? ssFindStory(ss.inquiryStoryId) : null;
    const filterLabel = filterStory?.public?.title || filterStory?.draft?.title || filtered[0]?.storyTitle || '선택한 글';

    const filterNotice = ss.inquiryStoryId
      ? `<div class="ss-filter-notice"><span>선택한 글 문의만 보는 중: <strong>${ssEsc(filterLabel)}</strong> · ${filtered.length}건</span><button type="button" class="ss-btn is-quiet" data-action="ss-clear-inquiry-filter">전체 문의 보기</button></div>`
      : '';

    const pagedInquiries = filtered.slice(0, ss.inquiryLimit);
    const listHtml = filtered.length
      ? `<ul class="ss-inquiry-list">${pagedInquiries.map(row => {
          const isNew = row.status === 'new';
          return `<li class="ss-inquiry-row">
            <div class="ss-inquiry-main">
              <div class="ss-card-meta">
                <span class="ss-badge ${isNew ? 'is-verified' : 'is-draft'}">${isNew ? '새 문의' : '확인 완료'}</span>
                <span class="ss-inquiry-time">${ssEsc(ssFormatDateTime(row.createdAt))}</span>
              </div>
              <span class="ss-inquiry-title">${ssEsc(row.storyTitle || '공개 글 문의')}</span>
            </div>
            <button type="button" class="ss-btn ${isNew ? 'is-primary' : ''}" data-action="ss-inquiry-open" data-id="${ssEsc(row.id)}">문의 열기</button>
          </li>`;
        }).join('')}</ul>${ssPagerHtml(pagedInquiries.length, filtered.length, '건', 'ss-inquiries-more')}`
      : `<div class="ss-empty"><p>${ss.inquiryStoryId
          ? '이 글에 현재 열람 가능한 문의가 없어요.'
          : '현재 열람 가능한 문의가 없어요. 공개 링크로 방문자가 문의를 남기면 여기에 표시돼요.'}</p></div>`;

    return `<div id="ss-inquiries-panel" class="ss-inquiries">
      <div class="ss-inquiries-head">
        <h3 tabindex="-1">접수된 문의 ${allInquiries.length}건</h3>
        <small>접수 후 ${ssEsc(String(data.retentionDays || 90))}일 보관 · 답장은 공식 회사 계정으로 진행해요</small>
      </div>
      ${filterNotice}
      ${listHtml}
    </div>`;
  }

  function ssHeldAdminHtml() {
    if (!ssIsAdmin() || ssIsDemo()) {
      ssClearHeld();
      return '';
    }
    const counts = ss.held.loaded
      ? {
          total: ss.held.inquiries.length,
          new: ss.held.inquiries.filter(row => row?.status === 'new').length
        }
      : ss.data?.heldInquiryCounts || null;
    if (ss.held.loaded && ss.data) {
      ss.data.heldInquiryCounts = counts;
    }
    let body = '';
    if (ss.held.loading && !ss.held.loaded) {
      body = '<p class="ss-status" role="status">이용 중지된 직원의 남은 문의를 확인하고 있어요…</p>';
    } else if (ss.held.error) {
      body = `<div class="ss-banner is-error" role="alert"><div>${ssEsc(ss.held.error)}</div><div class="ss-banner-actions"><button type="button" class="ss-btn is-quiet" data-action="ss-held-refresh" ${ss.held.loading ? 'disabled' : ''}>다시 확인</button></div></div>`;
    } else if (ss.held.loaded) {
      const heldTotal = ss.held.inquiries.length;
      const pagedHeld = ss.held.inquiries.slice(0, ss.heldLimit);
      body = heldTotal
        ? `<ul class="ss-inquiry-list">${pagedHeld.map(row => `<li class="ss-inquiry-row">
            <div class="ss-inquiry-main">
              <div class="ss-card-meta">
                <span class="ss-badge ${row.status === 'new' ? 'is-warn' : 'is-draft'}">${row.status === 'new' ? '미처리' : '확인 완료'}</span>
                <span class="ss-chip">작성 직원: ${ssEsc(row.ownerName || '중지된 직원')}</span>
                <span class="ss-inquiry-time">${ssEsc(ssFormatDateTime(row.createdAt))}</span>
              </div>
              <span class="ss-inquiry-title">${ssEsc(row.storyTitle || '공개 글 문의')}</span>
            </div>
            <button type="button" class="ss-btn" data-action="ss-held-open" data-id="${ssEsc(row.id)}">상세 · 정리</button>
          </li>`).join('')}</ul>${ssPagerHtml(pagedHeld.length, heldTotal, '건', 'ss-held-more')}`
        : '<p class="ss-status">현재 이용 중지된 직원의 미정리 문의가 없어요.</p>';
    } else {
      body = '<p class="ss-status">펼치면 이용 중지된 직원의 남은 문의 목록을 불러와요.</p>';
    }

    return `<details class="ss-held-details" data-ss-held ${ss.held.open ? 'open' : ''}>
      <summary>
        <span>이용 중지된 직원의 남은 문의 관리 · 관리자 전용</span>
        <span class="ss-chip">${counts ? `보관 중 ${counts.total}건 · 미처리 ${counts.new}건` : '조회'}</span>
      </summary>
      <div class="ss-held-body">
        <p class="ss-held-help">계정이 중지된 직원의 문의만 접수일부터 ${ssEsc(String(ss.data?.retentionDays || 90))}일간의 보관 기간 중 남은 기간 동안 관리자가 확인·삭제할 수 있어요. 활동 중인 직원의 초안과 문의는 표시되지 않아요.</p>
        ${ss.held.loaded ? `<div class="ss-banner-actions"><button type="button" class="ss-btn is-quiet" data-action="ss-held-refresh" ${ss.held.loading ? 'disabled' : ''}>목록 새로고침</button></div>` : ''}
        ${body}
      </div>
    </details>`;
  }

  function ssInnerHtml() {
    if (ssIsDemo() || ss.errorCode === 'SYNK_STORY_DEMO') {
      return `<div class="ss-head"><div class="ss-head-copy"><h2 id="ss-heading">내 글감</h2><p class="ss-sub">수업이나 상담에서 자주 받은 질문을 글감으로 남겨 보세요.</p></div></div>
      <div class="ss-banner" role="note">체험 화면에서는 내 글감과 문의를 열거나 저장할 수 없어요. 직원 계정으로 로그인하면 내 업무에서 바로 이용할 수 있어요.</div>`;
    }

    const canWrite = ssCanWrite();
    const hasRecords = Boolean(ss.data) && (
      (ss.data.stories?.length || 0) > 0 ||
      (ss.data.inquiries?.length || 0) > 0 ||
      (Number(ss.data.totals?.received) || 0) > 0
    );
    const showRefresh = Boolean(ss.data) && !ss.error && (hasRecords || !canWrite || ssIsAdmin());
    const headActions = (canWrite || showRefresh)
      ? `<div class="ss-head-actions">
        ${showRefresh ? `<button type="button" class="ss-btn is-quiet" data-action="ss-refresh" ${ss.loading ? 'disabled' : ''}>${ssIcon('refresh')}<span>새로고침</span></button>` : ''}
        ${canWrite ? `<button type="button" class="ss-btn is-primary" data-action="ss-new" ${ss.loading && !ss.data ? 'disabled' : ''}>${ssIcon('plus')}<span>새 글감 쓰기</span></button>` : ''}
      </div>`
      : '';

    const header = `<div class="ss-head"><div class="ss-head-copy"><h2 id="ss-heading">내 글감</h2><p class="ss-sub">수업이나 상담에서 자주 받은 질문을 글감으로 남겨 보세요.</p></div>${headActions}</div>`;

    if (!ss.data && ss.loading) {
      return `${header}<p class="ss-status" role="status">내 글감과 접수된 문의를 불러오고 있어요…</p>`;
    }

    if (!ss.data && ss.error) {
      return `${header}<div class="ss-banner is-error" role="alert"><div>${ssEsc(ss.error)}</div><div class="ss-banner-actions"><button type="button" class="ss-btn" data-action="ss-refresh">다시 불러오기</button></div></div>`;
    }

    if (!ss.data) {
      return `${header}<p class="ss-status" role="status">내 글감을 준비하고 있어요…</p>`;
    }

    const data = ss.data;
    const stories = data.stories || [];
    const inquiries = data.inquiries || [];
    const inquiriesByStory = new Map();
    for (const row of inquiries) {
      const arr = inquiriesByStory.get(row.storyId) || [];
      arr.push(row);
      inquiriesByStory.set(row.storyId, arr);
    }
    const newTotal = inquiries.filter(row => row.status === 'new').length;
    const liveTotal = Number(data.totals?.live) || 0;
    const receivedTotal = Number(data.totals?.received) || 0;

    const refreshError = ss.error
      ? `<div class="ss-banner is-error" role="alert"><div>${ssEsc(ss.error)}</div><div class="ss-banner-actions"><button type="button" class="ss-btn is-quiet" data-action="ss-refresh">다시 시도</button></div></div>`
      : '';
    const readonlyBanner = !data.canWrite
      ? `<div class="ss-banner is-warn" role="note">보기 전용 계정이에요. 작성해 둔 글감과 지난 문의는 열람할 수 있지만 새 작성·수정·공개·상태 변경은 제한되며, 공개 중이던 글의 방문자 접수는 현재 닫혀 있어요.</div>`
      : '';

    const hasStats = liveTotal > 0 || receivedTotal > 0 || inquiries.length > 0;
    const totalsHtml = hasStats
      ? `<div class="ss-totals" aria-label="내 글감과 문의 현황">
        <div class="ss-stat"><span class="ss-stat-label">공개 글</span><strong class="ss-stat-value">${liveTotal}개</strong></div>
        <div class="ss-stat"><span class="ss-stat-label">받은 문의</span><strong class="ss-stat-value">${receivedTotal}건</strong>${newTotal > 0 ? `<span class="ss-stat-note is-new">새 문의 ${newTotal}건</span>` : ''}</div>
      </div>`
      : '';

    let storiesHtml = '';
    if (!stories.length) {
      storiesHtml = `<div class="ss-empty">
        <p>아직 작성한 글감이 없어요. 글감을 공개하면 글별 전용 링크로 문의를 받고 이곳에서 바로 확인할 수 있어요.</p>
      </div>`;
    } else {
      const counts = {
        all: stories.length,
        live: stories.filter(s => s.status === 'live').length,
        draft: stories.filter(s => s.status === 'draft').length,
        unpublished: stories.filter(s => s.status === 'unpublished').length
      };
      const filterBar = `<div class="ss-filter-bar" role="group" aria-label="글감 상태 필터">
        ${[
          ['all', `전체 ${counts.all}`],
          ['live', `공개 중 ${counts.live}`],
          ['draft', `비공개 초안 ${counts.draft}`],
          ['unpublished', `내림 ${counts.unpublished}`]
        ].map(([key, label]) => `<button type="button" class="ss-filter-chip" data-action="ss-story-filter" data-filter="${key}" aria-pressed="${ss.storyFilter === key}">${ssEsc(label)}</button>`).join('')}
      </div>`;

      const visibleStories = ss.storyFilter === 'all'
        ? stories
        : stories.filter(s => s.status === ss.storyFilter);
      const pagedStories = visibleStories.slice(0, ss.storyLimit);

      storiesHtml = filterBar + (visibleStories.length
        ? `<div class="ss-story-list">${pagedStories.map(story => ssStoryCardHtml(story, inquiriesByStory, data.canWrite)).join('')}</div>${ssPagerHtml(pagedStories.length, visibleStories.length, '개', 'ss-stories-more')}`
        : '<div class="ss-empty"><p>선택한 상태에 해당하는 글감이 없어요.</p></div>');
    }

    const inquiriesHtml = stories.length || inquiries.length || receivedTotal > 0 || ss.inquiryStoryId
      ? ssInquiriesHtml(data)
      : '';
    const inquiriesFirst = inquiries.length > 0;

    return `${header}${refreshError}${readonlyBanner}${totalsHtml}${inquiriesFirst ? inquiriesHtml : ''}${storiesHtml}${inquiriesFirst ? '' : inquiriesHtml}${ssHeldAdminHtml()}`;
  }

  function staffStoriesSection() {
    if (typeof state === 'undefined' || !state.user) return '';
    ssEnsureUser();
    if (!ssIsDemo() && !ss.queued) {
      if (!ss.data && !ss.loading && !ss.error) {
        ss.queued = true;
        queueMicrotask(() => {
          ss.queued = false;
          void ssLoad();
        });
      } else if (ssIsAdmin() && ss.held.open && !ss.held.loaded && !ss.held.loading && !ss.held.error) {
        ss.queued = true;
        queueMicrotask(() => {
          ss.queued = false;
          if (typeof state !== 'undefined' && state.tab === 'home' && ssIsAdmin() && ss.held.open && !ss.held.loaded && !ss.held.loading && !ss.held.error) {
            void ssLoadHeld();
          }
        });
      }
    }
    return `<section id="staff-stories-root" class="ss-section" aria-labelledby="ss-heading" aria-busy="${ss.loading}">${ssInnerHtml()}</section>`;
  }

  function ssModalBody() {
    return (typeof overlay !== 'undefined' && overlay?.querySelector?.('.modal-body')) || document.querySelector?.('.modal-body') || null;
  }

  function ssOpenModal(title, subtitle, contentHtml, wide = true) {
    if (typeof modal === 'function') {
      modal(title, subtitle, `<div class="ss-modal">${contentHtml}</div>`, wide);
    }
    return typeof state !== 'undefined' ? state.modalRequest : 0;
  }

  function ssCloseModal() {
    ss.modalCtx = null;
    if (typeof closeModal === 'function') closeModal();
  }

  function ssDiscardPromptHtml() {
    return `<div class="ss-zone" data-ss-discard-prompt role="group" aria-labelledby="ss-discard-heading" aria-describedby="ss-discard-desc" hidden>
          <div class="ss-zone-head">
            <strong id="ss-discard-heading">작성 중인 내용을 버리고 닫을까요?</strong>
          </div>
          <p class="ss-zone-desc" id="ss-discard-desc">아직 저장하거나 공개에 반영하지 않은 변경 내용이 있어요. 그대로 쓰거나 변경 내용을 버리고 닫을 수 있어요.</p>
          <div class="ss-confirm-actions">
            <button type="button" class="btn primary" data-action="ss-discard-keep">그대로 쓰기</button>
            <button type="button" class="btn quiet" data-action="ss-discard-confirm">작성 내용 버리기</button>
          </div>
        </div>`;
  }

  function ssNormFieldText(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n');
  }

  function ssNormDraftEquals(a, b) {
    return ssNormFieldText(a?.title) === ssNormFieldText(b?.title) &&
      ssNormFieldText(a?.displayName) === ssNormFieldText(b?.displayName) &&
      ssNormFieldText(a?.body) === ssNormFieldText(b?.body) &&
      ssNormFieldText(a?.note) === ssNormFieldText(b?.note);
  }

  function ssReadModalEditorDraft(form) {
    return {
      title: String(form?.querySelector?.('[name="title"]')?.value ?? ''),
      displayName: String(form?.querySelector?.('[name="displayName"]')?.value ?? ''),
      body: String(form?.querySelector?.('[name="body"]')?.value ?? ''),
      note: String(form?.querySelector?.('[name="note"]')?.value ?? '')
    };
  }

  function ssActiveModalCtx() {
    if (!ss.modalCtx) return null;
    if (typeof state !== 'undefined' && ss.modalCtx.modalReq !== state.modalRequest) return null;
    return ss.modalCtx;
  }

  function ssActiveProtectedForm() {
    if (typeof overlay === 'undefined' || !overlay?.children?.length) return null;
    return overlay.querySelector?.('form[data-form="ss-editor"], form[data-form="ss-publish"]') || null;
  }

  function ssShouldBypassCloseGuard() {
    if (!ssCanWrite()) return true;
    const ctx = ssActiveModalCtx();
    if (ctx?.authStamp && !ssAuthCurrent(ctx.authStamp)) return true;
    return false;
  }

  function ssIsModalFormDirty(form) {
    if (!form || form.isConnected === false) return false;
    const ctx = ssActiveModalCtx();
    const storyId = form.dataset.id || '';
    const savedDraft = (storyId ? ssFindStory(storyId)?.draft : null) || {};
    if (form.dataset.form === 'ss-editor') {
      const clean = ctx?.kind === 'editor' && ctx.cleanDraft ? ctx.cleanDraft : savedDraft;
      return !ssNormDraftEquals(ssReadModalEditorDraft(form), clean);
    }
    if (form.dataset.form === 'ss-publish') {
      const clean = ctx?.kind === 'publish' && ctx.baseDraft ? ctx.baseDraft : savedDraft;
      const titleVal = form.querySelector('[name="title"]')?.value ?? '';
      const nameVal = form.querySelector('[name="displayName"]')?.value ?? '';
      return ssNormFieldText(titleVal) !== ssNormFieldText(clean.title) ||
        ssNormFieldText(nameVal) !== ssNormFieldText(clean.displayName);
    }
    return false;
  }

  function ssSnapshotFieldSelection(el) {
    if (!el || typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') return null;
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  function ssFormActionsEl(form) {
    return form?.querySelector?.('[data-ss-form-actions]') ||
      [...(form?.children || [])].find(el => el.classList?.contains('modal-actions')) ||
      null;
  }

  function ssHideDiscardPrompt(form) {
    const promptEl = form?.querySelector?.('[data-ss-discard-prompt]');
    if (promptEl && !promptEl.hidden) promptEl.hidden = true;
    const actionsEl = ssFormActionsEl(form);
    if (actionsEl && actionsEl.hidden) actionsEl.hidden = false;
  }

  function ssRequestCloseConfirmation(form) {
    const promptEl = form?.querySelector?.('[data-ss-discard-prompt]');
    if (!promptEl) return;
    const ctx = ssActiveModalCtx();
    const modalBody = ssModalBody();
    if (promptEl.hidden && ctx) {
      const active = document.activeElement;
      const activeInFormField = active && form.contains(active) &&
        !active.closest?.('[data-action="close-modal"]') &&
        !active.closest?.('[data-ss-discard-prompt]') &&
        active.matches?.('input, textarea, select');
      const target = activeInFormField
        ? active
        : (ctx.lastField && form.contains(ctx.lastField) ? ctx.lastField : null);
      ctx.restoreTarget = target;
      ctx.restoreSelection = target ? (ssSnapshotFieldSelection(target) || ctx.lastSelection || null) : null;
      ctx.restoreScrollTop = modalBody ? modalBody.scrollTop : null;
    }
    const actionsEl = ssFormActionsEl(form);
    if (actionsEl) actionsEl.hidden = true;
    promptEl.hidden = false;
    try {
      promptEl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    } catch {
      promptEl.scrollIntoView?.({ block: 'nearest' });
    }
    if (modalBody && modalBody.contains(promptEl) && typeof modalBody.getBoundingClientRect === 'function') {
      const bodyRect = modalBody.getBoundingClientRect();
      const promptRect = promptEl.getBoundingClientRect();
      if (bodyRect.height > 0 && promptRect.height > 0) {
        if (promptRect.bottom > bodyRect.bottom - 16) {
          modalBody.scrollTop += promptRect.bottom - (bodyRect.bottom - 16);
        }
        const nextRect = promptEl.getBoundingClientRect();
        if (nextRect.top < bodyRect.top + 16) {
          modalBody.scrollTop -= (bodyRect.top + 16) - nextRect.top;
        }
      }
    }
    promptEl.querySelector('[data-action="ss-discard-keep"]')?.focus({ preventScroll: true });
  }

  function ssCancelCloseConfirmation(form) {
    if (!form) return;
    ssHideDiscardPrompt(form);
    const ctx = ssActiveModalCtx();
    const modalBody = ssModalBody();
    if (modalBody && typeof ctx?.restoreScrollTop === 'number') {
      modalBody.scrollTop = ctx.restoreScrollTop;
    }
    const candidate = (ctx?.restoreTarget && form.contains(ctx.restoreTarget) && !ctx.restoreTarget.disabled)
      ? ctx.restoreTarget
      : (ctx?.lastField && form.contains(ctx.lastField) && !ctx.lastField.disabled)
        ? ctx.lastField
        : form.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
    if (candidate) {
      candidate.focus({ preventScroll: true });
      if (modalBody && modalBody.contains(candidate) && typeof modalBody.getBoundingClientRect === 'function') {
        const bodyRect = modalBody.getBoundingClientRect();
        const actionsEl = ssFormActionsEl(form);
        const actionsRect = actionsEl && !actionsEl.hidden ? actionsEl.getBoundingClientRect() : null;
        const visibleBottom = actionsRect && actionsRect.height > 0 ? Math.min(bodyRect.bottom, actionsRect.top) : bodyRect.bottom;
        const candRect = candidate.getBoundingClientRect();
        if (bodyRect.height > 0 && candRect.height > 0) {
          if (candRect.top < bodyRect.top + 8) {
            modalBody.scrollTop -= (bodyRect.top + 8) - candRect.top;
          } else if (candRect.bottom > visibleBottom - 8 && candRect.height < visibleBottom - bodyRect.top) {
            modalBody.scrollTop += candRect.bottom - (visibleBottom - 8);
          }
        }
      }
      const sel = ctx?.restoreSelection;
      if (sel && typeof candidate.setSelectionRange === 'function') {
        try {
          candidate.setSelectionRange(sel.start, sel.end);
        } catch {}
      }
    }
    if (ctx) {
      ctx.restoreScrollTop = null;
      ctx.restoreTarget = null;
      ctx.restoreSelection = null;
    }
  }

  async function ssCopyText(text, fallbackInputSelector = '') {
    if (!text) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        ssNotify('클립보드에 복사했어요.');
        return;
      }
    } catch {
      // Fallback to selecting visible readonly input if present
    }
    const input = fallbackInputSelector ? document.querySelector(fallbackInputSelector) : null;
    if (input && typeof input.select === 'function') {
      input.focus();
      input.select();
      ssNotify('복사할 값을 선택했어요. Ctrl+C(또는 복사 메뉴)로 복사해 주세요.');
      return;
    }
    ssNotify('자동 복사가 제한된 환경이에요. 화면에 표시된 값을 직접 선택해 복사해 주세요.');
  }

  async function ssFetchLatestStoryForConflict(storyId, errorObj) {
    if (errorObj?.story && errorObj.story.id === storyId) {
      ssUpsertStory(errorObj.story);
      syncStaffStories();
      return errorObj.story;
    }
    const refreshed = await ssLoad({ silent: true });
    return refreshed?.stories?.find(item => item.id === storyId) || ssFindStory(storyId);
  }

  function ssConflictHtml(mineDraft, latestStory) {
    if (!latestStory) return '';
    const latest = latestStory.draft || {};
    return `<div class="ss-conflict-box" role="alert">
      <h4>다른 화면에서 먼저 저장된 최신 내용이 있어요</h4>
      <p>작성 중이던 글은 아래 입력칸에 그대로 유지했어요. 최신 내용과 비교한 뒤 반영 방식을 선택해 주세요.</p>
      <div class="ss-conflict-grid">
        <div class="ss-conflict-col">
          <strong>내가 작성 중인 내용</strong>
          <div>제목: ${ssEsc(mineDraft.title || '(비어 있음)')}</div>
          <div>표시 이름: ${ssEsc(mineDraft.displayName || '(비어 있음)')}</div>
          <div class="ss-conflict-pre">${ssEsc(mineDraft.body || '(본문 없음)')}</div>
        </div>
        <div class="ss-conflict-col">
          <strong>저장된 최신 내용</strong>
          <div>제목: ${ssEsc(latest.title || '(비어 있음)')}</div>
          <div>표시 이름: ${ssEsc(latest.displayName || '(비어 있음)')}</div>
          <div class="ss-conflict-pre">${ssEsc(latest.body || '(본문 없음)')}</div>
        </div>
      </div>
      <div class="ss-confirm-actions">
        <button type="button" class="btn small primary" data-action="ss-conflict-keep-mine">내 작성 내용으로 저장 준비</button>
        <button type="button" class="btn small" data-action="ss-conflict-use-latest">저장된 최신 내용으로 입력칸 교체</button>
      </div>
    </div>`;
  }

  function ssOpenEditorModal(storyId = '', { overrideDraft = null, conflictStory = null } = {}) {
    if (!ssCanWrite()) return;
    const story = storyId ? ssFindStory(storyId) : null;
    if (storyId && !story) {
      ssNotify('글감을 찾지 못해 목록을 다시 불러왔어요.');
      void ssLoad();
      return;
    }
    const limits = ssLimits();
    const storyDraft = story?.draft || {};
    const baseDraft = {
      title: overrideDraft?.title !== undefined ? String(overrideDraft.title) : (storyDraft.title || ''),
      displayName: overrideDraft?.displayName !== undefined ? String(overrideDraft.displayName) : (storyDraft.displayName || ''),
      body: overrideDraft?.body !== undefined ? String(overrideDraft.body) : (storyDraft.body || ''),
      note: overrideDraft?.note !== undefined ? String(overrideDraft.note) : (storyDraft.note || '')
    };
    const revision = conflictStory ? conflictStory.revision : (story?.revision || 0);
    const defaultNameHint = state?.user?.name ? String(state.user.name).trim().slice(0, limits.displayName) : '';

    const modalReq = ssOpenModal(
      story ? '내 경험 글감 편집' : '새 경험 글감 쓰기',
      '비공개 초안 저장만으로는 외부에 공개되지 않아요. 공개할 내용은 미리보기 확인 단계에서 발행해요.',
      `<form class="form-stack" data-form="ss-editor" data-id="${ssEsc(story?.id || '')}" data-revision="${ssEsc(String(revision))}" novalidate>
        <div class="form-error" role="alert"></div>
        <div id="ss-editor-conflict">${conflictStory ? ssConflictHtml(baseDraft, conflictStory) : ''}</div>
        <div class="ss-zone is-private">
          <div class="ss-zone-head">
            <strong>1. 비공개 개인 경험 노트 (나만 봄)</strong>
            <span class="ss-badge is-draft">외부·관리자 비공개</span>
          </div>
          <p class="ss-zone-desc">수업·상담 중 겪은 상황, 내부 배경, 거친 메모를 자유롭게 적어 두세요. 공개 화면·관리자 화면·문의 응답 어디에도 나가지 않아요.</p>
          <label class="field">개인 노트 (선택, 최대 ${limits.note}자)
            <textarea name="note" rows="4" maxlength="${limits.note}" placeholder="예: 3주차 실습에서 비전공 수강생이 반복해서 질문한 지점과 해결 방식 메모">${ssEsc(baseDraft.note)}</textarea>
          </label>
        </div>
        <div class="ss-zone">
          <div class="ss-zone-head">
            <strong>2. 공개 화면에 실을 초안 골라 적기</strong>
            <span class="ss-chip">${story?.status === 'live' ? '초안만 저장하면 현재 공개본은 유지됨' : '공개 확인 전까지 비공개'}</span>
          </div>
          <p class="ss-zone-desc">방문자에게 보여 줄 제목·표시 이름·본문만 골라 적으세요. 본문을 비우고 공개하면 개인 채널 글에 먼저 붙일 수 있는 <strong>문의 전용 화면</strong>이 열려요.</p>
          <div class="field-row">
            <label class="field">공개 표시 이름 (공개 시 필수, 최대 ${limits.displayName}자)
              <input name="displayName" type="text" maxlength="${limits.displayName}" value="${ssEsc(baseDraft.displayName)}" placeholder="예: ${ssEsc(defaultNameHint || '홍길동')} · SHIFT 직무 강의">
            </label>
            ${defaultNameHint ? `<div class="field"><span class="ss-stat-label">빠른 입력</span><button type="button" class="ss-btn is-quiet" data-action="ss-fill-my-name" data-name="${ssEsc(defaultNameHint)}">내 이름(${ssEsc(defaultNameHint)}) 넣기</button></div>` : ''}
          </div>
          <label class="field">공개 제목 (공개 시 필수, 최대 ${limits.title}자)
            <input name="title" type="text" maxlength="${limits.title}" value="${ssEsc(baseDraft.title)}" placeholder="예: 첫 업무 자동화 수업에서 가장 많이 막혔던 질문 정리">
          </label>
          <label class="field">공개 본문 (선택, 최대 ${limits.body}자 · 비우면 문의 전용 화면)
            <textarea name="body" rows="6" maxlength="${limits.body}" placeholder="방문자가 읽을 경험 이야기를 적어 주세요. 외부 블로그·SNS에 본문을 올리고 문의 창구로만 쓰려면 비워 두어도 괜찮아요.">${ssEsc(baseDraft.body)}</textarea>
          </label>
        </div>
        ${ssDiscardPromptHtml()}
        <div class="modal-actions" data-ss-form-actions>
          <button type="button" class="btn quiet" data-action="close-modal">취소</button>
          <button type="submit" class="btn">비공개 초안 저장</button>
          <button type="button" class="btn primary" data-action="ss-go-publish">공개 확인 · 발행 준비</button>
        </div>
      </form>`,
      true
    );

    const savedSource = (conflictStory || story)?.draft || {};
    ss.modalCtx = {
      kind: 'editor',
      modalReq,
      authStamp: ssAuthSnapshot(),
      storyId: story?.id || '',
      expectedRevision: revision,
      cleanDraft: {
        title: String(savedSource.title ?? ''),
        displayName: String(savedSource.displayName ?? ''),
        body: String(savedSource.body ?? ''),
        note: String(savedSource.note ?? '')
      },
      lastField: null,
      lastSelection: null,
      restoreTarget: null,
      restoreSelection: null,
      latestConflictStory: conflictStory || null,
      reqHolder: { requestId: '', signature: '' }
    };
  }

  function ssOpenReadonlyModal(storyId) {
    const story = ssFindStory(storyId);
    if (!story) return;
    const pub = story.public;
    ssOpenModal(
      '내 글감 열람 (보기 전용)',
      '보기 전용 계정에서는 기존 초안과 공개본을 확인할 수 있어요.',
      `<div class="form-stack">
        <div class="ss-zone is-private">
          <div class="ss-zone-head"><strong>비공개 개인 노트</strong><span class="ss-badge is-draft">본인 전용</span></div>
          <div class="ss-preview-body">${ssEsc(story.draft?.note || '(적어 둔 개인 노트가 없어요)')}</div>
        </div>
        <div class="ss-zone">
          <div class="ss-zone-head"><strong>초안 내용</strong><span class="ss-chip">${story.changedSincePublish ? '공개본과 다른 초안' : '저장된 초안'}</span></div>
          <p class="ss-zone-desc">표시 이름: ${ssEsc(story.draft?.displayName || '(미입력)')}</p>
          <h4 class="ss-preview-title">${ssEsc(story.draft?.title || '(제목 없음)')}</h4>
          <div class="ss-preview-body">${ssEsc(story.draft?.body || '(본문 없음)')}</div>
        </div>
        ${pub ? `<div class="ss-zone"><div class="ss-zone-head"><strong>마지막 공개본</strong><span class="ss-badge is-warn">현재 방문자 접수 닫힘</span></div><p class="ss-zone-desc">주소: ${ssEsc(pub.url)}</p><h4 class="ss-preview-title">${ssEsc(pub.title)}</h4><div class="ss-preview-body">${ssEsc(pub.body || '(문의 전용 화면 · 본문 없음)')}</div></div>` : ''}
        <div class="modal-actions"><button type="button" class="btn primary" data-action="close-modal">닫기</button></div>
      </div>`,
      true
    );
  }

  function ssOpenPublishModal(storyId, { conflictStory = null } = {}) {
    if (!ssCanWrite()) return;
    const story = conflictStory || ssFindStory(storyId);
    if (!story) return;
    const limits = ssLimits();
    const draft = story.draft || { title: '', displayName: '', body: '', note: '' };
    const isRepublish = Boolean(story.public);

    const modalReq = ssOpenModal(
      isRepublish ? '공개 내용 확인 · 다시 공개' : '공개 미리보기 · 발행 확인',
      '방문자에게 실제로 공개될 제목·표시 이름·본문과 2가지 확인 사항을 직접 점검해 주세요.',
      `<form class="form-stack" data-form="ss-publish" data-id="${ssEsc(story.id)}" data-revision="${ssEsc(String(story.revision))}" novalidate>
        <div class="form-error" role="alert"></div>
        ${conflictStory ? '<p class="notice" role="status">다른 화면에서 수정된 최신 초안을 불러왔어요. 아래 미리보기를 다시 확인한 뒤 공개해 주세요.</p>' : ''}
        <div class="ss-zone">
          <div class="ss-zone-head">
            <strong>공개 필수 정보 점검</strong>
            <span class="ss-chip">비공개 개인 노트는 공개본에서 제외됨</span>
          </div>
          <div class="field-row">
            <label class="field">공개 제목 (필수, 1~${limits.title}자)
              <input name="title" type="text" required maxlength="${limits.title}" value="${ssEsc(draft.title)}" data-ss-publish-preview="title" placeholder="방문자에게 보여 줄 공개 제목">
            </label>
            <label class="field">공개 표시 이름 (필수, 1~${limits.displayName}자)
              <input name="displayName" type="text" required maxlength="${limits.displayName}" value="${ssEsc(draft.displayName)}" data-ss-publish-preview="displayName" placeholder="예: 김하늘 · PATH 상담">
            </label>
          </div>
          <div class="ss-preview-card" aria-label="방문자 공개 화면 미리보기">
            <div class="ss-preview-meta" id="ss-pub-preview-name">${ssEsc(draft.displayName.trim() || '(표시 이름을 입력해 주세요)')}</div>
            <h3 class="ss-preview-title" id="ss-pub-preview-title">${ssEsc(draft.title.trim() || '(공개 제목을 입력해 주세요)')}</h3>
            ${draft.body
              ? `<div class="ss-preview-body">${ssEsc(draft.body)}</div>`
              : '<p class="ss-preview-empty">공개 본문이 비어 있어 <strong>문의 전용 화면</strong>으로 열리며, 방문자에게는 제목과 문의 양식만 보여요. 본문을 추가하려면 초안 편집으로 돌아가 주세요.</p>'}
          </div>
          ${isRepublish && story.public?.url ? `<p class="ss-zone-desc">다시 공개해도 기존 고유 문의 링크(<strong>${ssEsc(story.public.url)}</strong>)는 그대로 유지돼요.</p>` : ''}
        </div>
        <div class="ss-check-group" role="group" aria-label="발행 전 필수 확인">
          <label class="ss-check-row">
            <input type="checkbox" name="peopleConsent" value="yes">
            <span>글에 나오는 학생·고객의 동의를 받았어요(미성년자는 보호자 동의 포함). 등장하는 사람이 없어도 체크해 주세요.</span>
          </label>
          <label class="ss-check-row">
            <input type="checkbox" name="noPromise" value="yes">
            <span>합격·비자·급수를 약속하는 표현이 없어요.</span>
          </label>
        </div>
        ${ssDiscardPromptHtml()}
        <div class="modal-actions" data-ss-form-actions>
          <button type="button" class="btn quiet" data-action="ss-edit" data-id="${ssEsc(story.id)}">초안 편집으로 돌아가기</button>
          <button type="button" class="btn quiet" data-action="close-modal">취소</button>
          <button type="submit" class="btn primary">${isRepublish ? '확인 완료 · 공개 반영하기' : '확인 완료 · 공개하고 링크 받기'}</button>
        </div>
      </form>`,
      true
    );

    ss.modalCtx = {
      kind: 'publish',
      modalReq,
      authStamp: ssAuthSnapshot(),
      storyId: story.id,
      expectedRevision: story.revision,
      baseDraft: {
        title: String(draft.title ?? ''),
        displayName: String(draft.displayName ?? ''),
        body: String(draft.body ?? ''),
        note: String(draft.note ?? '')
      },
      lastField: null,
      lastSelection: null,
      restoreTarget: null,
      restoreSelection: null,
      saveHolder: { requestId: '', signature: '' },
      pubHolder: { requestId: '', signature: '' }
    };
  }

  function ssOpenShareModal(storyId, { justPublished = false } = {}) {
    const story = ssFindStory(storyId);
    if (!story) return;
    const limits = ssLimits();
    const pubUrl = story.public?.url || '';
    const currentExt = story.external?.url || '';
    const safeExt = ssSafeHttpsUrl(currentExt);
    const canWrite = ssCanWrite();

    const modalReq = ssOpenModal(
      justPublished ? '공개 완료 · 문의 링크 및 원문 연결' : '고유 문의 링크 · 원문 주소 관리',
      justPublished
        ? '내 글 전용 문의 링크가 열렸어요. 개인 채널 글에 링크를 붙이고, 원문 주소는 준비되었을 때 등록해 주세요.'
        : '공유 링크 복사와 개인 채널 원문 주소(본인 등록)를 관리해요.',
      `<div class="form-stack">
        ${pubUrl ? `<div class="ss-zone">
          <div class="ss-zone-head">
            <strong>내 글 고유 문의 링크</strong>
            <span class="ss-badge ${story.status === 'live' && story.public?.open !== false ? 'is-live' : 'is-off'}">${story.status === 'live' && story.public?.open !== false ? '공개 중 · 접수 열림' : '접수 닫힘'}</span>
          </div>
          <p class="ss-zone-desc">아래 주소를 그대로 복사해 개인 블로그·SNS 글에 붙여 주세요. 방문자가 실제로 보낸 문의만 건수로 집계돼요.</p>
          <div class="ss-copy-input-row">
            <input id="ss-share-public-url" type="text" readonly value="${ssEsc(pubUrl)}" aria-label="고유 문의 링크 주소">
            <button type="button" class="btn primary" data-action="ss-copy-modal-url">문의 링크 복사</button>
          </div>
        </div>` : ''}
        <form class="ss-zone form-stack" data-form="ss-link" data-id="${ssEsc(story.id)}" data-revision="${ssEsc(String(story.revision))}" novalidate>
          <div class="form-error" role="alert"></div>
          <div class="ss-zone-head">
            <strong>개인 채널 원문 주소 (선택)</strong>
            <span class="ss-self-tag">본인 등록</span>
          </div>
          <p class="ss-zone-desc">직접 올린 외부 글의 <code>https://</code> 주소를 기록해 둘 수 있어요. 아직 올리기 전이거나 예약 게시라면 비워 두세요.</p>
          ${safeExt ? `<p class="ss-zone-desc">현재 등록 주소: <a class="ss-ext-anchor" href="${ssEsc(safeExt)}" target="_blank" rel="noopener noreferrer">${ssEsc(currentExt)}</a></p>` : ''}
          <label class="field">외부 원문 주소 (https://, 최대 ${limits.url}자)
            <input name="externalUrl" type="url" maxlength="${limits.url}" value="${ssEsc(currentExt)}" placeholder="https://blog.example.com/..." ${canWrite ? '' : 'readonly'}>
          </label>
          <div class="modal-actions">
            ${canWrite && currentExt ? `<button type="button" class="btn quiet" data-action="ss-clear-external" data-id="${ssEsc(story.id)}">등록 주소 지우기</button>` : ''}
            <button type="button" class="btn quiet" data-action="close-modal">닫기</button>
            ${canWrite ? `<button type="submit" class="btn ${pubUrl ? '' : 'primary'}">원문 주소 저장</button>` : ''}
          </div>
        </form>
      </div>`,
      true
    );

    ss.modalCtx = {
      kind: 'link',
      modalReq,
      storyId: story.id,
      expectedRevision: story.revision,
      reqHolder: { requestId: '', signature: '' }
    };
  }

  function ssOpenUnpublishModal(storyId) {
    if (!ssCanWrite()) return;
    const story = ssFindStory(storyId);
    if (!story) return;
    const modalReq = ssOpenModal(
      '공개 내리기',
      ssEsc(story.public?.title || story.draft?.title || '공개 글'),
      `<form class="form-stack" data-form="ss-unpublish" data-id="${ssEsc(story.id)}" data-revision="${ssEsc(String(story.revision))}">
        <div class="form-error" role="alert"></div>
        <p class="notice">공개를 내리면 방문자 화면이 바로 닫히고 새 문의도 접수되지 않아요. 이미 받은 문의는 내 업무에서 계속 확인할 수 있고, 나중에 다시 공개하면 같은 링크 주소로 다시 열려요.</p>
        <div class="modal-actions">
          <button type="button" class="btn quiet" data-action="close-modal">취소</button>
          <button type="submit" class="btn primary">공개 내리기</button>
        </div>
      </form>`,
      false
    );
    ss.modalCtx = {
      kind: 'unpublish',
      modalReq,
      storyId: story.id,
      expectedRevision: story.revision,
      reqHolder: { requestId: '', signature: '' }
    };
  }

  function ssOpenDeleteModal(storyId) {
    if (!ssCanWrite()) return;
    const story = ssFindStory(storyId);
    if (!story) return;
    const openCount = Number(story.inquiries?.open) || 0;
    if (openCount > 0) {
      ssOpenModal(
        '글감을 삭제할 수 없어요',
        ssEsc(story.public?.title || story.draft?.title || '내 글감'),
        `<div class="form-stack">
          <div class="ss-banner is-warn" role="alert">열람 가능한 문의가 <strong>${openCount}건</strong> 남아 있는 글은 삭제할 수 없어요. 방문자 접수를 멈추려면 <strong>공개 내리기</strong>를 이용해 주세요.</div>
          <div class="modal-actions">
            <button type="button" class="btn quiet" data-action="close-modal">닫기</button>
            ${story.status === 'live' ? `<button type="button" class="btn primary" data-action="ss-unpublish-modal" data-id="${ssEsc(story.id)}">공개 내리기로 전환</button>` : ''}
          </div>
        </div>`,
        false
      );
      return;
    }

    const modalReq = ssOpenModal(
      '글감 영구 삭제',
      ssEsc(story.draft?.title || story.public?.title || '제목 없는 글감'),
      `<form class="form-stack" data-form="ss-delete" data-id="${ssEsc(story.id)}" data-revision="${ssEsc(String(story.revision))}">
        <div class="form-error" role="alert"></div>
        <div class="ss-confirm-box">삭제한 글감은 복구할 수 없으며, 발급되었던 문의 링크도 영구히 닫혀 다시 열리지 않아요. 정말 삭제할까요?</div>
        <div class="modal-actions">
          <button type="button" class="btn quiet" data-action="close-modal">취소</button>
          <button type="submit" class="btn danger">글감 삭제 확정</button>
        </div>
      </form>`,
      false
    );
    ss.modalCtx = {
      kind: 'delete',
      modalReq,
      storyId: story.id,
      expectedRevision: story.revision,
      reqHolder: { requestId: '', signature: '' }
    };
  }

  function ssInquiryModalMarkup(inquiry, { heldMode = false, canWrite = true } = {}) {
    const id = ssEsc(inquiry.id);
    const isNew = inquiry.status === 'new';
    const statusBadgeClass = isNew ? (heldMode ? 'is-warn' : 'is-verified') : 'is-draft';
    const statusLabel = isNew ? (heldMode ? '미처리' : '새 문의') : '확인 완료';
    return `<div class="form-stack" data-ss-inquiry-detail="${id}" data-held="${heldMode ? '1' : '0'}">
      <div class="form-error" role="alert"></div>
      <dl class="ss-detail-dl">
        ${heldMode ? `<div><dt>원래 작성 직원 · 이용 중지</dt><dd>${ssEsc(inquiry.ownerName || '중지된 직원')}</dd></div>` : ''}
        <div><dt>유입된 공개 글</dt><dd>${ssEsc(inquiry.storyTitle || '공개 글')}</dd></div>
        <div><dt>처리 상태</dt><dd><span class="ss-badge ${statusBadgeClass}">${statusLabel}</span></dd></div>
        <div><dt>방문자 이름</dt><dd>${ssEsc(inquiry.name || '미입력')}</dd></div>
        <div>
          <dt>답장받을 이메일</dt>
          <dd>
            <span>${ssEsc(inquiry.email || '')}</span>
            ${inquiry.email ? ` <button type="button" class="ss-btn is-quiet" data-action="ss-copy-email" data-email="${ssEsc(inquiry.email)}">이메일 복사</button>` : ''}
          </dd>
        </div>
        <div><dt>접수 시각</dt><dd>${ssEsc(ssFormatDateTime(inquiry.createdAt) || '-')}</dd></div>
        <div><dt>보관 만료 예정</dt><dd>${ssEsc(ssFormatDateTime(inquiry.expiresAt) || '-')}</dd></div>
      </dl>
      <div>
        <span class="ss-stat-label">문의 원문</span>
        <div class="ss-message-box">${ssEsc(inquiry.message || '')}</div>
      </div>
      <div id="ss-inquiry-delete-confirm" class="ss-confirm-box" hidden>
        <div>삭제하면 방문자 연락처와 문의 내용이 즉시 영구 삭제되며 되돌릴 수 없어요. 글별 누적 접수 건수는 그대로 유지돼요. 정말 삭제할까요?</div>
        <div class="ss-confirm-actions">
          <button type="button" class="btn small danger" data-action="${heldMode ? 'ss-held-delete-confirm' : 'ss-inquiry-delete-confirm'}" data-id="${id}">영구 삭제 확정</button>
          <button type="button" class="btn small quiet" data-action="ss-inquiry-delete-cancel">취소</button>
        </div>
      </div>
      <div class="modal-actions">
        ${(heldMode || canWrite) ? `<button type="button" class="btn danger" data-action="ss-inquiry-delete-ask">문의 삭제</button>` : ''}
        ${!heldMode && canWrite ? `<button type="button" class="btn primary" data-action="ss-inquiry-toggle" data-id="${id}" data-next="${isNew ? 'done' : 'reopen'}">${isNew ? '확인 완료로 표시' : '새 문의로 되돌리기'}</button>` : ''}
        <button type="button" class="btn quiet" data-action="close-modal">닫기</button>
      </div>
    </div>`;
  }

  async function ssOpenInquiryModal(inquiryId, { heldMode = false } = {}) {
    if (!inquiryId || !ssEnsureUser()) return;
    const stamp = ssAuthSnapshot();
    const modalReq = ssOpenModal(
      heldMode ? '중지된 직원의 남은 문의 상세' : '직접 문의 상세 확인',
      '개인 연락처 대신 공식 회사 계정으로 답장해 주세요.',
      '<p class="muted" role="status">문의 상세 내용을 불러오고 있어요…</p>',
      true
    );
    ss.modalCtx = { kind: heldMode ? 'held-detail' : 'inquiry-detail', modalReq, inquiryId };

    const endpoint = heldMode
      ? `/api/my-stories/held-inquiries/${encodeURIComponent(inquiryId)}`
      : `/api/my-stories/inquiries/${encodeURIComponent(inquiryId)}`;

    try {
      const result = await ssApi(endpoint);
      if (!ssAuthCurrent(stamp) || state.modalRequest !== modalReq) return;
      const body = ssModalBody();
      if (!body || !result?.inquiry) return;
      body.innerHTML = `<div class="ss-modal">${ssInquiryModalMarkup(result.inquiry, { heldMode, canWrite: ssCanWrite() })}</div>`;
    } catch (error) {
      if (error?.code === 'SESSION_CHANGED' || !ssAuthCurrent(stamp) || state.modalRequest !== modalReq) return;
      const body = ssModalBody();
      const notFoundMsg = heldMode
        ? '이미 삭제되었거나 직원 계정이 다시 활성화되어 본인 보관함으로 돌아간 문의예요.'
        : '이미 삭제되었거나 90일 보관 기간이 만료된 문의예요.';
      if (body) {
        body.innerHTML = `<div class="ss-modal form-stack"><div class="ss-banner is-error" role="alert">${ssEsc(error?.status === 404 ? notFoundMsg : (error?.message || '문의를 불러오지 못했어요.'))}</div><div class="modal-actions"><button type="button" class="btn quiet" data-action="close-modal">닫기</button></div></div>`;
      }
      if (error?.status === 404) {
        if (heldMode) void ssLoadHeld();
        else void ssLoad({ silent: true });
      }
    }
  }

  function ssReadDraftFromEditorForm(form) {
    const fd = new FormData(form);
    return {
      title: String(fd.get('title') ?? ''),
      displayName: String(fd.get('displayName') ?? ''),
      body: String(fd.get('body') ?? ''),
      note: String(fd.get('note') ?? '')
    };
  }

  function ssDraftEquals(a, b) {
    return String(a?.title ?? '') === String(b?.title ?? '') &&
      String(a?.displayName ?? '') === String(b?.displayName ?? '') &&
      String(a?.body ?? '') === String(b?.body ?? '') &&
      String(a?.note ?? '') === String(b?.note ?? '');
  }

  async function ssSaveEditorForm(form, { goToPublish = false } = {}) {
    if (!ssCanWrite() || !form) return;
    ssHideDiscardPrompt(form);
    const errorEl = form.querySelector('.form-error');
    const submitBtns = [...form.querySelectorAll('button[type="submit"], [data-action="ss-go-publish"]')];
    if (submitBtns.some(btn => btn.disabled)) return;
    submitBtns.forEach(btn => { btn.disabled = true; });
    if (errorEl) errorEl.textContent = '';

    const stamp = ssAuthSnapshot();
    const startModalReq = state.modalRequest;
    const ownsModal = () => ssAuthCurrent(stamp) && form.isConnected !== false && state.modalRequest === startModalReq;

    const storyId = form.dataset.id || '';
    const expectedRevision = Number(form.dataset.revision) || 0;
    const draft = ssReadDraftFromEditorForm(form);
    const ctx = ss.modalCtx?.modalReq === startModalReq ? ss.modalCtx : { reqHolder: { requestId: '', signature: '' } };

    try {
      let savedStory = storyId ? ssFindStory(storyId) : null;
      const unchangedExisting = Boolean(storyId && savedStory && savedStory.revision === expectedRevision && ssDraftEquals(draft, savedStory.draft));

      if (!unchangedExisting) {
        const signature = JSON.stringify({ mode: storyId ? 'save' : 'create', storyId, expectedRevision, draft });
        const requestId = ssResolveRequestId(ctx.reqHolder, signature);
        const result = storyId
          ? await ssApi(`/api/my-stories/${encodeURIComponent(storyId)}`, {
              action: 'save',
              requestId,
              expectedRevision,
              draft
            })
          : await ssApi('/api/my-stories', {
              action: 'create',
              requestId,
              draft
            });

        if (!ssAuthCurrent(stamp)) return;
        savedStory = result?.story || null;
        if (savedStory) ssUpsertStory(savedStory);
        void ssLoad({ silent: true });
      }

      if (!ssAuthCurrent(stamp)) return;

      if (goToPublish && savedStory) {
        if (ownsModal()) ssOpenPublishModal(savedStory.id);
        return;
      }

      if (ownsModal()) ssCloseModal();
      ssNotify('비공개 초안을 저장했어요.');
    } catch (err) {
      if (err?.code === 'SESSION_CHANGED' || !ssAuthCurrent(stamp)) return;
      if (err?.code === 'SYNK_STORY_REQUEST_CONFLICT') {
        ctx.reqHolder.requestId = '';
        ctx.reqHolder.signature = '';
      }
      if (storyId && (err?.status === 409 || err?.code === 'SYNK_STORY_CONFLICT') && err?.code !== 'SYNK_STORY_REQUEST_CONFLICT') {
        const latest = await ssFetchLatestStoryForConflict(storyId, err);
        if (!ownsModal()) return;
        if (latest) {
          ctx.latestConflictStory = latest;
          if (ctx.cleanDraft && latest.draft) {
            ctx.cleanDraft = {
              title: String(latest.draft.title ?? ''),
              displayName: String(latest.draft.displayName ?? ''),
              body: String(latest.draft.body ?? ''),
              note: String(latest.draft.note ?? '')
            };
          }
          const conflictHost = form.querySelector('#ss-editor-conflict');
          if (conflictHost) conflictHost.innerHTML = ssConflictHtml(draft, latest);
          if (errorEl) errorEl.textContent = '다른 화면에서 먼저 수정된 내용이 있어요. 작성 중이던 글은 지우지 않았으니 위 비교 내용을 확인해 주세요.';
          return;
        }
      }
      if (ownsModal() && errorEl) {
        errorEl.textContent = err?.message || '초안을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
      } else {
        ssNotify(err?.message || '초안을 저장하지 못했어요.');
      }
    } finally {
      if (ownsModal()) submitBtns.forEach(btn => { btn.disabled = false; });
    }
  }

  async function ssSubmitPublishForm(form) {
    if (!ssCanWrite() || !form) return;
    const errorEl = form.querySelector('.form-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn || submitBtn.disabled) return;
    if (errorEl) errorEl.textContent = '';

    const limits = ssLimits();
    const titleInput = form.elements.namedItem('title');
    const nameInput = form.elements.namedItem('displayName');
    const consentPeople = form.elements.namedItem('peopleConsent');
    const consentNoPromise = form.elements.namedItem('noPromise');

    const title = String(titleInput?.value ?? '').trim();
    const displayName = String(nameInput?.value ?? '').trim();
    const peopleChecked = Boolean(consentPeople?.checked);
    const noPromiseChecked = Boolean(consentNoPromise?.checked);

    if (!title || title.length > limits.title) {
      if (errorEl) errorEl.textContent = `공개 제목을 1~${limits.title}자로 입력해 주세요.`;
      titleInput?.focus();
      return;
    }
    if (!displayName || displayName.length > limits.displayName) {
      if (errorEl) errorEl.textContent = `공개 표시 이름을 1~${limits.displayName}자로 입력해 주세요.`;
      nameInput?.focus();
      return;
    }
    if (!peopleChecked) {
      if (errorEl) errorEl.textContent = '학생·고객 동의 확인 항목을 점검하고 체크해 주세요.';
      consentPeople?.focus();
      return;
    }
    if (!noPromiseChecked) {
      if (errorEl) errorEl.textContent = '합격·비자·급수 약속 표현이 없다는 확인 항목을 체크해 주세요.';
      consentNoPromise?.focus();
      return;
    }

    submitBtn.disabled = true;
    const stamp = ssAuthSnapshot();
    const startModalReq = state.modalRequest;
    const ownsModal = () => ssAuthCurrent(stamp) && form.isConnected !== false && state.modalRequest === startModalReq;

    const storyId = form.dataset.id || '';
    let expectedRevision = Number(form.dataset.revision) || 0;
    let currentStory = ssFindStory(storyId);
    const ctx = ss.modalCtx?.modalReq === startModalReq
      ? ss.modalCtx
      : { saveHolder: { requestId: '', signature: '' }, pubHolder: { requestId: '', signature: '' } };

    try {
      const mergedDraft = {
        title,
        displayName,
        body: String(currentStory?.draft?.body ?? ''),
        note: String(currentStory?.draft?.note ?? '')
      };

      if (!currentStory || !ssDraftEquals(mergedDraft, currentStory.draft)) {
        const saveSig = JSON.stringify({ storyId, expectedRevision, mergedDraft });
        const saveReqId = ssResolveRequestId(ctx.saveHolder, saveSig);
        const saveRes = await ssApi(`/api/my-stories/${encodeURIComponent(storyId)}`, {
          action: 'save',
          requestId: saveReqId,
          expectedRevision,
          draft: mergedDraft
        });
        if (!ssAuthCurrent(stamp)) return;
        if (saveRes?.story) {
          currentStory = saveRes.story;
          expectedRevision = currentStory.revision;
          form.dataset.revision = String(expectedRevision);
          ssUpsertStory(currentStory);
        }
      }

      const confirmations = { peopleConsent: true, noPromise: true };
      const pubSig = JSON.stringify({ storyId, expectedRevision, confirmations });
      const pubReqId = ssResolveRequestId(ctx.pubHolder, pubSig);
      const pubRes = await ssApi(`/api/my-stories/${encodeURIComponent(storyId)}`, {
        action: 'publish',
        requestId: pubReqId,
        expectedRevision,
        confirmations
      });
      if (!ssAuthCurrent(stamp)) return;
      if (pubRes?.story) ssUpsertStory(pubRes.story);
      void ssLoad({ silent: true });

      if (ownsModal()) {
        ssOpenShareModal(storyId, { justPublished: true });
      }
      ssNotify('공개 확인을 마치고 문의 링크를 열었어요.');
    } catch (err) {
      if (err?.code === 'SESSION_CHANGED' || !ssAuthCurrent(stamp)) return;
      if (err?.code === 'SYNK_STORY_REQUEST_CONFLICT') {
        ctx.saveHolder.requestId = '';
        ctx.pubHolder.requestId = '';
      }
      if (err?.status === 409 || err?.code === 'SYNK_STORY_CONFLICT') {
        const latest = await ssFetchLatestStoryForConflict(storyId, err);
        if (ownsModal() && latest) {
          ssOpenPublishModal(storyId, { conflictStory: latest });
          return;
        }
      }
      if (ownsModal()) {
        const field = err?.field;
        if (field === 'title') titleInput?.focus();
        else if (field === 'displayName') nameInput?.focus();
        else if (field === 'peopleConsent') consentPeople?.focus();
        else if (field === 'noPromise') consentNoPromise?.focus();
        if (errorEl) errorEl.textContent = err?.message || '공개 처리에 실패했어요. 입력 내용을 확인하고 다시 시도해 주세요.';
      }
    } finally {
      if (ownsModal()) submitBtn.disabled = false;
    }
  }

  async function ssSubmitLinkForm(form, overrideUrl = null) {
    if (!ssCanWrite() || !form) return;
    const errorEl = form.querySelector('.form-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    const urlInput = form.elements.namedItem('externalUrl');
    if (submitBtn?.disabled) return;
    if (errorEl) errorEl.textContent = '';

    const rawUrl = overrideUrl !== null ? overrideUrl : String(urlInput?.value ?? '');
    const check = ssValidateExternalUrl(rawUrl, ssLimits().url);
    if (!check.ok) {
      if (errorEl) errorEl.textContent = check.message;
      urlInput?.focus();
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    const stamp = ssAuthSnapshot();
    const startModalReq = state.modalRequest;
    const ownsModal = () => ssAuthCurrent(stamp) && form.isConnected !== false && state.modalRequest === startModalReq;

    const storyId = form.dataset.id || '';
    const expectedRevision = Number(form.dataset.revision) || 0;
    const ctx = ss.modalCtx?.modalReq === startModalReq ? ss.modalCtx : { reqHolder: { requestId: '', signature: '' } };

    try {
      const sig = JSON.stringify({ storyId, expectedRevision, externalUrl: check.value });
      const requestId = ssResolveRequestId(ctx.reqHolder, sig);
      const res = await ssApi(`/api/my-stories/${encodeURIComponent(storyId)}`, {
        action: 'link',
        requestId,
        expectedRevision,
        externalUrl: check.value
      });
      if (!ssAuthCurrent(stamp)) return;
      if (res?.story) ssUpsertStory(res.story);
      void ssLoad({ silent: true });
      if (ownsModal()) ssOpenShareModal(storyId, { justPublished: false });
      ssNotify(check.value ? '개인 채널 원문 주소(본인 등록)를 저장했어요.' : '등록된 원문 주소를 지웠어요.');
    } catch (err) {
      if (err?.code === 'SESSION_CHANGED' || !ssAuthCurrent(stamp)) return;
      if (err?.status === 409 || err?.code === 'SYNK_STORY_CONFLICT') {
        const latest = await ssFetchLatestStoryForConflict(storyId, err);
        if (ownsModal() && latest) {
          form.dataset.revision = String(latest.revision);
          ctx.reqHolder.requestId = '';
          if (errorEl) errorEl.textContent = '글 버전이 갱신되어 최신 버전을 불러왔어요. 한 번 더 저장을 눌러 주세요.';
          return;
        }
      }
      if (ownsModal()) {
        if (errorEl) errorEl.textContent = err?.message || '원문 주소를 저장하지 못했어요.';
        urlInput?.focus();
      }
    } finally {
      if (ownsModal() && submitBtn) submitBtn.disabled = false;
    }
  }

  async function ssSubmitSimpleStoryAction(form, actionName) {
    if (!ssCanWrite() || !form) return;
    const errorEl = form.querySelector('.form-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn || submitBtn.disabled) return;
    submitBtn.disabled = true;
    if (errorEl) errorEl.textContent = '';

    const stamp = ssAuthSnapshot();
    const startModalReq = state.modalRequest;
    const ownsModal = () => ssAuthCurrent(stamp) && form.isConnected !== false && state.modalRequest === startModalReq;

    const storyId = form.dataset.id || '';
    const expectedRevision = Number(form.dataset.revision) || 0;
    const ctx = ss.modalCtx?.modalReq === startModalReq ? ss.modalCtx : { reqHolder: { requestId: '', signature: '' } };

    try {
      const sig = JSON.stringify({ actionName, storyId, expectedRevision });
      const requestId = ssResolveRequestId(ctx.reqHolder, sig);
      const res = await ssApi(`/api/my-stories/${encodeURIComponent(storyId)}`, {
        action: actionName,
        requestId,
        expectedRevision
      });
      if (!ssAuthCurrent(stamp)) return;
      if (actionName === 'delete') {
        if (ss.data?.stories) {
          ss.data = { ...ss.data, stories: ss.data.stories.filter(s => s.id !== storyId) };
        }
      } else if (res?.story) {
        ssUpsertStory(res.story);
      }
      if (ownsModal()) ssCloseModal();
      void ssLoad({ silent: true });
      ssNotify(actionName === 'delete' ? '글감을 삭제했어요.' : '공개를 내리고 접수를 닫았어요.');
    } catch (err) {
      if (err?.code === 'SESSION_CHANGED' || !ssAuthCurrent(stamp)) return;
      if (err?.code === 'SYNK_STORY_HAS_INQUIRIES') {
        void ssLoad({ silent: true });
      } else if (err?.status === 409 || err?.code === 'SYNK_STORY_CONFLICT') {
        const latest = await ssFetchLatestStoryForConflict(storyId, err);
        if (ownsModal() && latest) {
          form.dataset.revision = String(latest.revision);
          ctx.reqHolder.requestId = '';
        }
      }
      if (ownsModal() && errorEl) {
        errorEl.textContent = err?.message || '요청을 처리하지 못했어요.';
      }
    } finally {
      if (ownsModal()) submitBtn.disabled = false;
    }
  }

  async function ssMutateInquiry(inquiryId, action, { heldMode = false, triggerBtn = null } = {}) {
    if (!inquiryId || !ssEnsureUser()) return;
    if (!heldMode && !ssCanWrite()) return;
    if (triggerBtn) triggerBtn.disabled = true;

    const stamp = ssAuthSnapshot();
    const startModalReq = state.modalRequest;
    const container = document.querySelector(`[data-ss-inquiry-detail="${CSS?.escape ? CSS.escape(inquiryId) : inquiryId}"]`);
    const errorEl = container?.querySelector('.form-error');
    if (errorEl) errorEl.textContent = '';

    const endpoint = heldMode
      ? `/api/my-stories/held-inquiries/${encodeURIComponent(inquiryId)}`
      : `/api/my-stories/inquiries/${encodeURIComponent(inquiryId)}`;

    try {
      await ssApi(endpoint, { action });
      if (!ssAuthCurrent(stamp)) return;

      if (action === 'delete') {
        if (state.modalRequest === startModalReq) ssCloseModal();
        ssNotify('문의 연락처와 내용을 영구 삭제했어요.');
        if (heldMode) void ssLoadHeld();
        else void ssLoad({ silent: true });
        return;
      }

      void ssLoad({ silent: true });
      if (state.modalRequest === startModalReq) {
        await ssOpenInquiryModal(inquiryId, { heldMode: false });
      }
      ssNotify(action === 'done' ? '확인 완료로 표시했어요.' : '새 문의 상태로 되돌렸어요.');
    } catch (err) {
      if (err?.code === 'SESSION_CHANGED' || !ssAuthCurrent(stamp)) return;
      if (errorEl && state.modalRequest === startModalReq) {
        errorEl.textContent = err?.message || '문의 상태를 바꾸지 못했어요.';
      } else {
        ssNotify(err?.message || '문의 상태를 바꾸지 못했어요.');
      }
    } finally {
      if (triggerBtn && triggerBtn.isConnected !== false) triggerBtn.disabled = false;
    }
  }

  document.addEventListener('focusin', event => {
    const target = typeof event.target?.closest === 'function' ? event.target : null;
    if (!target) return;
    const form = ssActiveProtectedForm();
    if (!form || !form.contains(target)) return;
    if (target.closest('[data-action="close-modal"], [data-ss-discard-prompt]')) return;
    if (target.matches?.('input, textarea, select')) {
      const ctx = ssActiveModalCtx();
      if (ctx) {
        ctx.lastField = target;
        ctx.lastSelection = ssSnapshotFieldSelection(target);
      }
    }
  });

  document.addEventListener('focusout', event => {
    const target = event.target;
    const ctx = ssActiveModalCtx();
    if (ctx && target && ctx.lastField === target) {
      ctx.lastSelection = ssSnapshotFieldSelection(target);
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form?.matches?.('form[data-form="ss-editor"], form[data-form="ss-publish"]')) {
      ssHideDiscardPrompt(form);
    }
  }, true);

  document.addEventListener('click', event => {
    const form = ssActiveProtectedForm();
    if (!form) return;
    const targetEl = typeof event.target?.closest === 'function' ? event.target : null;
    if (!targetEl || !overlay.contains(targetEl)) return;
    const isBackdrop = targetEl.classList?.contains('modal-backdrop');
    const closeBtn = isBackdrop ? null : targetEl.closest('[data-action="close-modal"]');
    if (!isBackdrop && (!closeBtn || closeBtn.disabled)) return;
    if (ssShouldBypassCloseGuard()) {
      ss.modalCtx = null;
      return;
    }
    if (!ssIsModalFormDirty(form)) {
      ss.modalCtx = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ssRequestCloseConfirmation(form);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const form = ssActiveProtectedForm();
    if (!form) return;
    if (ssShouldBypassCloseGuard()) {
      ss.modalCtx = null;
      return;
    }
    const promptEl = form.querySelector('[data-ss-discard-prompt]');
    if (promptEl && !promptEl.hidden) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      ssCancelCloseConfirmation(form);
      return;
    }
    if (!ssIsModalFormDirty(form)) {
      ss.modalCtx = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ssRequestCloseConfirmation(form);
  }, true);

  document.addEventListener('input', event => {
    const target = event.target;
    const protectedForm = typeof target?.closest === 'function'
      ? target.closest('form[data-form="ss-editor"], form[data-form="ss-publish"]')
      : null;
    if (protectedForm) {
      ssHideDiscardPrompt(protectedForm);
      const ctx = ssActiveModalCtx();
      if (ctx && target.matches?.('input, textarea, select')) {
        ctx.lastField = target;
        ctx.lastSelection = ssSnapshotFieldSelection(target);
      }
    }
    if (!target?.dataset?.ssPublishPreview) return;
    const field = target.dataset.ssPublishPreview;
    if (field === 'title') {
      const out = document.getElementById('ss-pub-preview-title');
      if (out) out.textContent = target.value.trim() || '(공개 제목을 입력해 주세요)';
    } else if (field === 'displayName') {
      const out = document.getElementById('ss-pub-preview-name');
      if (out) out.textContent = target.value.trim() || '(표시 이름을 입력해 주세요)';
    }
  });

  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!details?.matches?.('[data-ss-held]')) return;
    const wasOpen = ss.held.open;
    ss.held.open = details.open;
    if (!details.open) {
      ss.heldFocus = null;
      const hadSensitiveOrLoading = ss.held.loading || ss.held.loaded || ss.held.inquiries.length > 0;
      if (ss.held.loading) ss.held.seq += 1;
      ss.held.loading = false;
      ss.held.loaded = false;
      ss.held.inquiries = [];
      if (wasOpen && hadSensitiveOrLoading) {
        syncStaffStories();
      }
      return;
    }
    if (!wasOpen && !ss.held.loaded && !ss.held.loading && !ss.held.error) {
      void ssLoadHeld();
    }
  }, true);

  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-action]');
    const action = target?.dataset?.action;
    if (!action || !action.startsWith('ss-') || target.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const id = target.dataset.id || '';
    if (action === 'ss-refresh') {
      const refreshHeld = ss.held.open && ssIsAdmin();
      void ssLoad({ syncHeld: !refreshHeld });
      if (refreshHeld) {
        if (!ss.held.loading) void ssLoadHeld();
      } else if (!ssIsAdmin()) {
        ssClearHeld();
      }
      return;
    }
    if (action === 'ss-held-refresh') {
      if (!ss.held.loading) void ssLoadHeld();
      return;
    }
    if (action === 'ss-stories-more' || action === 'ss-inquiries-more' || action === 'ss-held-more') {
      const rowSelector = action === 'ss-stories-more'
        ? '#staff-stories-root .ss-story-list > [data-story-id]'
        : action === 'ss-inquiries-more'
          ? '#ss-inquiries-panel .ss-inquiry-row'
          : '#staff-stories-root [data-ss-held] .ss-inquiry-row';
      const prevCount = document.querySelectorAll(rowSelector).length;
      if (action === 'ss-stories-more') ss.storyLimit += SS_PAGE_SIZE;
      else if (action === 'ss-inquiries-more') ss.inquiryLimit += SS_PAGE_SIZE;
      else ss.heldLimit += SS_PAGE_SIZE;
      syncStaffStories();
      const moreBtn = document.querySelector(`#staff-stories-root [data-action="${action}"]`);
      if (moreBtn) {
        moreBtn.focus({ preventScroll: true });
      } else {
        const rows = document.querySelectorAll(rowSelector);
        const newRow = rows[prevCount] || rows[rows.length - 1];
        const focusEl = newRow?.querySelector('button:not([disabled]), a[href]');
        if (focusEl) {
          focusEl.focus({ preventScroll: true });
        } else if (newRow) {
          newRow.tabIndex = -1;
          newRow.focus({ preventScroll: true });
        }
      }
      return;
    }
    if (action === 'ss-story-filter') {
      const nextFilter = target.dataset.filter || 'all';
      ss.storyFilter = nextFilter;
      ss.storyLimit = SS_PAGE_SIZE;
      syncStaffStories();
      const restored = Array.from(document.querySelectorAll('#staff-stories-root [data-action="ss-story-filter"]'))
        .find(btn => (btn.dataset.filter || 'all') === nextFilter);
      restored?.focus({ preventScroll: true });
      return;
    }
    if (action === 'ss-filter-inquiries') {
      ss.inquiryStoryId = id;
      ss.inquiryLimit = SS_PAGE_SIZE;
      syncStaffStories();
      const panel = document.getElementById('ss-inquiries-panel');
      panel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      panel?.querySelector('button')?.focus({ preventScroll: true });
      return;
    }
    if (action === 'ss-clear-inquiry-filter') {
      const prevStoryId = ss.inquiryStoryId;
      ss.inquiryStoryId = '';
      ss.inquiryLimit = SS_PAGE_SIZE;
      syncStaffStories();
      const panel = document.getElementById('ss-inquiries-panel');
      const prevCard = prevStoryId
        ? Array.from(document.querySelectorAll('#staff-stories-root [data-story-id]')).find(el => el.dataset.storyId === prevStoryId)
        : null;
      const nextFocus = panel?.querySelector('button:not([disabled])')
        || prevCard?.querySelector('[data-action="ss-filter-inquiries"]:not([disabled]), button:not([disabled])')
        || panel?.querySelector('[tabindex="-1"]')
        || document.querySelector('#staff-stories-root button:not([disabled])');
      nextFocus?.focus({ preventScroll: true });
      return;
    }
    if (action === 'ss-new') {
      ssOpenEditorModal('');
      return;
    }
    if (action === 'ss-edit') {
      const publishForm = target.closest('form[data-form="ss-publish"]');
      if (publishForm) {
        const currentStory = ssFindStory(id);
        const ctxDraft = ss.modalCtx?.kind === 'publish' && ss.modalCtx.storyId === id ? ss.modalCtx.baseDraft : null;
        const sourceDraft = currentStory?.draft || ctxDraft || {};
        const titleField = publishForm.elements.namedItem('title');
        const nameField = publishForm.elements.namedItem('displayName');
        ssOpenEditorModal(id, {
          overrideDraft: {
            title: titleField ? String(titleField.value ?? '') : String(sourceDraft.title ?? ''),
            displayName: nameField ? String(nameField.value ?? '') : String(sourceDraft.displayName ?? ''),
            body: String(sourceDraft.body ?? ''),
            note: String(sourceDraft.note ?? '')
          }
        });
        return;
      }
      ssOpenEditorModal(id);
      return;
    }
    if (action === 'ss-view-readonly') {
      ssOpenReadonlyModal(id);
      return;
    }
    if (action === 'ss-fill-my-name') {
      const form = target.closest('form');
      if (form) ssHideDiscardPrompt(form);
      const input = form?.elements?.namedItem('displayName');
      if (input) {
        input.value = target.dataset.name || '';
        input.focus();
      }
      return;
    }
    if (action === 'ss-discard-keep') {
      const form = target.closest('form[data-form="ss-editor"], form[data-form="ss-publish"]');
      if (form) ssCancelCloseConfirmation(form);
      return;
    }
    if (action === 'ss-discard-confirm') {
      const form = target.closest('form[data-form="ss-editor"], form[data-form="ss-publish"]');
      if (form) ssCloseModal();
      return;
    }
    if (action === 'ss-go-publish') {
      const form = target.closest('form[data-form="ss-editor"]');
      if (form) void ssSaveEditorForm(form, { goToPublish: true });
      return;
    }
    if (action === 'ss-conflict-keep-mine') {
      const form = target.closest('form[data-form="ss-editor"]');
      const latest = ss.modalCtx?.latestConflictStory;
      if (form && latest) {
        form.dataset.revision = String(latest.revision);
        ss.modalCtx.expectedRevision = latest.revision;
        ss.modalCtx.reqHolder = { requestId: '', signature: '' };
        const conflictHost = form.querySelector('#ss-editor-conflict');
        if (conflictHost) conflictHost.innerHTML = '';
        const errorEl = form.querySelector('.form-error');
        if (errorEl) errorEl.textContent = '';
        form.querySelector('button[type="submit"]:not([disabled])')?.focus({ preventScroll: true });
        ssNotify('최신 내용을 기준으로 내 작성 내용을 저장할 수 있게 준비했어요. 저장 버튼을 눌러 주세요.');
      }
      return;
    }
    if (action === 'ss-conflict-use-latest') {
      const form = target.closest('form[data-form="ss-editor"]');
      const latest = ss.modalCtx?.latestConflictStory;
      if (form && latest) {
        const d = latest.draft || {};
        if (form.elements.namedItem('title')) form.elements.namedItem('title').value = d.title || '';
        if (form.elements.namedItem('displayName')) form.elements.namedItem('displayName').value = d.displayName || '';
        if (form.elements.namedItem('body')) form.elements.namedItem('body').value = d.body || '';
        if (form.elements.namedItem('note')) form.elements.namedItem('note').value = d.note || '';
        form.dataset.revision = String(latest.revision);
        ss.modalCtx.expectedRevision = latest.revision;
        ss.modalCtx.reqHolder = { requestId: '', signature: '' };
        const conflictHost = form.querySelector('#ss-editor-conflict');
        if (conflictHost) conflictHost.innerHTML = '';
        const errorEl = form.querySelector('.form-error');
        if (errorEl) errorEl.textContent = '';
        form.elements.namedItem('title')?.focus?.({ preventScroll: true });
        ssNotify('저장된 최신 내용을 입력칸에 불러왔어요.');
      }
      return;
    }
    if (action === 'ss-publish-modal') {
      ssOpenPublishModal(id);
      return;
    }
    if (action === 'ss-share' || action === 'ss-link-modal') {
      ssOpenShareModal(id, { justPublished: false });
      return;
    }
    if (action === 'ss-copy-link') {
      const story = ssFindStory(id);
      if (story?.public?.url) void ssCopyText(story.public.url);
      return;
    }
    if (action === 'ss-copy-modal-url') {
      const input = document.getElementById('ss-share-public-url');
      if (input?.value) void ssCopyText(input.value, '#ss-share-public-url');
      return;
    }
    if (action === 'ss-clear-external') {
      const form = target.closest('form[data-form="ss-link"]');
      if (form) void ssSubmitLinkForm(form, '');
      return;
    }
    if (action === 'ss-unpublish-modal') {
      ssOpenUnpublishModal(id);
      return;
    }
    if (action === 'ss-delete-modal') {
      ssOpenDeleteModal(id);
      return;
    }
    if (action === 'ss-inquiry-open') {
      void ssOpenInquiryModal(id, { heldMode: false });
      return;
    }
    if (action === 'ss-held-open') {
      void ssOpenInquiryModal(id, { heldMode: true });
      return;
    }
    if (action === 'ss-copy-email') {
      if (target.dataset.email) void ssCopyText(target.dataset.email);
      return;
    }
    if (action === 'ss-inquiry-toggle') {
      const next = target.dataset.next === 'reopen' ? 'reopen' : 'done';
      void ssMutateInquiry(id, next, { heldMode: false, triggerBtn: target });
      return;
    }
    if (action === 'ss-inquiry-delete-ask') {
      const box = document.getElementById('ss-inquiry-delete-confirm');
      if (box) {
        box.hidden = false;
        box.querySelector('button')?.focus({ preventScroll: true });
      }
      return;
    }
    if (action === 'ss-inquiry-delete-cancel') {
      const container = target.closest('[data-ss-inquiry-detail]') || ssModalBody();
      const box = document.getElementById('ss-inquiry-delete-confirm');
      if (box) box.hidden = true;
      const restoreBtn = container?.querySelector('[data-action="ss-inquiry-delete-ask"]:not([disabled])')
        || container?.querySelector('[data-action="close-modal"]:not([disabled])');
      restoreBtn?.focus({ preventScroll: true });
      return;
    }
    if (action === 'ss-inquiry-delete-confirm') {
      void ssMutateInquiry(id, 'delete', { heldMode: false, triggerBtn: target });
      return;
    }
    if (action === 'ss-held-delete-confirm') {
      void ssMutateInquiry(id, 'delete', { heldMode: true, triggerBtn: target });
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    const kind = form?.dataset?.form;
    if (!kind || !kind.startsWith('ss-')) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (kind === 'ss-editor') {
      void ssSaveEditorForm(form, { goToPublish: false });
    } else if (kind === 'ss-publish') {
      void ssSubmitPublishForm(form);
    } else if (kind === 'ss-link') {
      void ssSubmitLinkForm(form, null);
    } else if (kind === 'ss-unpublish') {
      void ssSubmitSimpleStoryAction(form, 'unpublish');
    } else if (kind === 'ss-delete') {
      void ssSubmitSimpleStoryAction(form, 'delete');
    }
  }, true);

  window.addEventListener('focus', () => {
    if (typeof state !== 'undefined' && state.user && state.tab === 'home' && ss.data && !ss.loading && Date.now() - ss.loadedAt > 60000) {
      void ssLoad({ silent: true });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof state !== 'undefined' && state.user && state.tab === 'home' && ss.data && !ss.loading && Date.now() - ss.loadedAt > 60000) {
      void ssLoad({ silent: true });
    }
  });

  globalThis.staffStoriesSection = staffStoriesSection;
  globalThis.resetStaffStories = resetStaffStories;
  globalThis.syncStaffStories = syncStaffStories;
})();
