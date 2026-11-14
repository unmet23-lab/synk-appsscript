'use strict';

const ADMIN_COMPANY_FILTERS = [
  ['all', '전체 회사'],
  ['LAB', 'SYNK LAB'],
  ['PATH', 'SYNK PATH'],
  ['SHIFT', 'SYNK SHIFT'],
  ['PULSE', 'SYNK PULSE'],
  ['legacy', '회사 미지정 기존 권한 계정'],
  ['admin', '전체 접근 관리자'],
  ['common', '소속 해제 전사 공통 계정']
];

const ADMIN_STATUS_FILTERS = [
  ['all', '전체 이용 상태'],
  ['active', '이용 중'],
  ['inactive', '이용 중지']
];

const ADMIN_INVITE_FILTERS = [
  ['all', '전체'],
  ['pending', '대기 중'],
  ['accepted', '수락 완료'],
  ['revoked', '취소됨'],
  ['expired', '만료됨']
];

const ADMIN_METRICS = [
  ['views', '조회수'],
  ['likes', '좋아요'],
  ['comments', '댓글'],
  ['shares', '공유'],
  ['saves', '저장'],
  ['reach', '도달'],
  ['followers', '팔로워']
];

const ADMIN_PULSE_STAGES = [
  ['received', '접수'],
  ['planning', '기획'],
  ['producing', '제작'],
  ['review', '검토'],
  ['delivered', '납품'],
  ['archived', '보관']
];

function adminTodayDate() {
  if (typeof dateToday === 'function') return dateToday();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function adminShiftDate(base, offset) {
  if (typeof shiftDate === 'function') return shiftDate(base, offset);
  return new Date(Date.parse(`${base}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}

function adminDefaultRange() {
  const end = adminTodayDate();
  return { start: adminShiftDate(end, -29), end };
}

function createInitialAdminState() {
  const { start, end } = adminDefaultRange();
  return {
    entered: false,
    tab: 'members',
    search: '',
    company: 'all',
    status: 'all',
    inviteStatus: 'all',
    start,
    end,
    draftStart: start,
    draftEnd: end,
    rangeError: '',
    selectedMemberId: '',
    data: null,
    loading: false,
    refreshing: false,
    error: '',
    forbidden: false,
    request: 0,
    abortController: null,
    pendingReloadStamp: null,
    needsStateReload: false,
    invitesModalOpen: false,
    composing: false,
    deferredRender: false
  };
}

const adminState = createInitialAdminState();

function adminCancelInFlight() {
  if (adminState.abortController) {
    try { adminState.abortController.abort(); } catch {}
    adminState.abortController = null;
  }
  adminState.request++;
}

function resetAdminWorkspace() {
  adminCancelInFlight();
  Object.assign(adminState, createInitialAdminState(), { request: adminState.request });
}

function adminCanUse() {
  return Boolean(
    typeof state !== 'undefined'
    && state.user
    && typeof isAdmin === 'function'
    && isAdmin()
    && !(typeof isDemoMode === 'function' && isDemoMode())
  );
}

function adminIsComposing() {
  if (!adminState.composing) return false;
  const root = document.querySelector('.admin-workspace');
  if (!root || !root.contains(document.activeElement)) {
    adminState.composing = false;
    return false;
  }
  return true;
}

function adminIsTrackedWrite(path) {
  if (typeof path !== 'string') return false;
  const clean = path.split('?')[0];
  return (
    clean === '/api/members/invite'
    || /^\/api\/members\/[^/]+\/(?:workspace-profile|organization|assignment|status)$/.test(clean)
    || /^\/api\/channels(?:\/|$)/.test(clean)
    || clean === '/api/collect'
    || /^\/api\/teams(?:\/|$)/.test(clean)
  );
}

function adminNoteWriteSucceeded(stamp) {
  if (!adminCanUse()) return;
  adminCancelInFlight();
  if (state.tab !== 'admin') return;
  adminState.pendingReloadStamp = stamp || (typeof companyAuthSnapshot === 'function' ? companyAuthSnapshot() : null);
  adminState.needsStateReload = true;
  adminState.data = null;
  adminState.error = '';
  adminState.loading = true;
  adminState.refreshing = true;
  adminPaint();
}

function adminOnStateLoaded() {
  const stamp = adminState.pendingReloadStamp;
  adminState.pendingReloadStamp = null;
  adminState.needsStateReload = false;
  if (!stamp) return;
  if (typeof companyAuthCurrent === 'function' && !companyAuthCurrent(stamp)) return;
  if (!adminCanUse() || state.tab !== 'admin') return;
  adminState.data = null;
  adminState.loading = true;
  adminState.refreshing = true;
  adminState.error = '';
  void loadAdminWorkspace({ reason: 'state-saved' });
}

function adminOnStateLoadFailed(err) {
  if (!adminState.pendingReloadStamp && !adminState.needsStateReload) return;
  adminState.pendingReloadStamp = null;
  if (err?.code === 'SESSION_CHANGED') return;
  adminCancelInFlight();
  if (!adminCanUse() || state.tab !== 'admin') {
    adminState.needsStateReload = false;
    return;
  }
  adminState.data = null;
  adminState.loading = false;
  adminState.refreshing = false;
  adminState.error = err?.message || '변경 내용을 반영한 직원 상태를 다시 불러오지 못했어요. 다시 시도해 주세요.';
  adminPaint();
}

function adminNoteInvitesModalOpened() {
  if (adminCanUse() && state.tab === 'admin') {
    adminState.invitesModalOpen = true;
  } else {
    adminState.invitesModalOpen = false;
  }
}

function adminOnModalClosed() {
  const wasOpen = adminState.invitesModalOpen;
  adminState.invitesModalOpen = false;
  if (!wasOpen) return;
  if (!adminCanUse() || state.tab !== 'admin') return;
  void loadAdminWorkspace({ reason: 'invites-close' });
}

function adminLeaveIfNeeded() {
  if (typeof state === 'undefined' || state.tab !== 'admin' || !adminCanUse()) {
    if (adminState.entered || adminState.loading || adminState.data || adminState.invitesModalOpen) {
      adminCancelInFlight();
      adminState.entered = false;
      adminState.loading = false;
      adminState.refreshing = false;
      adminState.data = null;
      adminState.error = '';
      adminState.forbidden = false;
      adminState.pendingReloadStamp = null;
      adminState.needsStateReload = false;
      adminState.invitesModalOpen = false;
    }
  }
}

function adminWorkspaceSyncMount() {
  adminLeaveIfNeeded();
  if (!adminCanUse() || state.tab !== 'admin') return;
  if (!adminState.entered) {
    adminState.entered = true;
    void loadAdminWorkspace({ reason: 'enter' });
  }
}

function adminValidateRange(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end || ''))) {
    return '시작일과 종료일을 날짜 형식으로 입력해 주세요.';
  }
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return '올바른 날짜를 선택해 주세요.';
  }
  if (start > end) {
    return '시작일은 종료일보다 늦을 수 없어요.';
  }
  const today = adminTodayDate();
  if (end > today) {
    return '오늘 뒤 날짜는 조회할 수 없어요.';
  }
  if (Math.round((endMs - startMs) / 86400000) > 365) {
    return '조회 기간은 최대 366일 안에서 선택해 주세요.';
  }
  return '';
}

async function loadAdminWorkspace({ reason = 'enter' } = {}) {
  if (!adminCanUse() || state.tab !== 'admin') return null;
  adminCancelInFlight();
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  adminState.abortController = controller;
  const requestId = adminState.request;
  const stamp = typeof companyAuthSnapshot === 'function' ? companyAuthSnapshot() : { userId: state.user?.id || null };
  const isCurrent = () => (
    (!controller || !controller.signal.aborted)
    && requestId === adminState.request
    && (typeof companyAuthCurrent === 'function' ? companyAuthCurrent(stamp) : state.user?.id === stamp.userId)
  );

  adminState.data = null;
  adminState.loading = true;
  adminState.refreshing = reason !== 'enter';
  adminState.error = '';
  adminState.rangeError = '';
  adminState.forbidden = false;
  adminPaint();

  try {
    const params = new URLSearchParams({ start: adminState.start, end: adminState.end }).toString();
    const response = await api(`/api/admin-workspace?${params}`, undefined, 'GET', controller ? { signal: controller.signal } : {});
    if (!isCurrent() || state.tab !== 'admin' || !adminCanUse()) return null;
    adminState.data = response;
    if (typeof response?.start === 'string') {
      adminState.start = response.start;
      adminState.draftStart = response.start;
    }
    if (typeof response?.end === 'string') {
      adminState.end = response.end;
      adminState.draftEnd = response.end;
    }
    adminState.loading = false;
    adminState.refreshing = false;
    adminState.error = '';
    adminState.forbidden = false;
    adminSyncDateInputs();
    adminPaint();
    return response;
  } catch (err) {
    if (err?.name === 'AbortError' || controller?.signal?.aborted || err?.code === 'SESSION_CHANGED') return null;
    if (requestId !== adminState.request) return null;
    adminState.data = null;
    adminState.loading = false;
    adminState.refreshing = false;
    if (err?.status === 401) {
      resetAdminWorkspace();
      if (state.user && typeof clearCompanySessionView === 'function') clearCompanySessionView();
      else adminPaint();
      void api('/api/me').then(me => {
        if (!me?.user && state.user && typeof clearCompanySessionView === 'function') {
          clearCompanySessionView();
        }
      }).catch(() => {});
      return null;
    }
    if (err?.status === 403) {
      adminState.forbidden = true;
      adminState.error = err.message || '관리자 권한이 변경되어 이 화면을 열람할 수 없어요.';
      adminPaint();
      void loadState().catch(() => {});
      return null;
    }
    if (typeof companyAuthCurrent === 'function' && !companyAuthCurrent(stamp)) return null;
    adminState.error = err?.message || '관리자 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    adminPaint();
    return null;
  } finally {
    if (adminState.abortController === controller) {
      adminState.abortController = null;
    }
  }
}

async function adminManualRefresh() {
  if (!adminCanUse() || state.tab !== 'admin') return;
  const stamp = typeof companyAuthSnapshot === 'function' ? companyAuthSnapshot() : { userId: state.user?.id || null };
  adminState.pendingReloadStamp = null;
  adminState.needsStateReload = true;
  adminCancelInFlight();
  adminState.data = null;
  adminState.loading = true;
  adminState.refreshing = true;
  adminState.error = '';
  adminState.rangeError = '';
  adminPaint();
  try {
    await loadState();
    adminState.needsStateReload = false;
  } catch (err) {
    if (err?.code === 'SESSION_CHANGED') return;
    if (typeof companyAuthCurrent === 'function' && !companyAuthCurrent(stamp)) return;
    adminState.loading = false;
    adminState.refreshing = false;
    adminState.error = err?.message || '직원 목록을 새로 불러오지 못했어요. 다시 시도해 주세요.';
    adminPaint();
    return;
  }
  if (typeof companyAuthCurrent === 'function' && !companyAuthCurrent(stamp)) return;
  if (!adminCanUse() || state.tab !== 'admin') return;
  await loadAdminWorkspace({ reason: 'refresh' });
}

async function adminOpenMemberAnalysis(memberId) {
  if (!memberId || !adminCanUse()) return;
  const activeStart = adminState.data?.start || adminState.start;
  const activeEnd = adminState.data?.end || adminState.end;
  if (typeof wa !== 'undefined') wa.company = 'all';
  adminLeaveIfNeeded();
  state.tab = 'analysis';
  state.scope = 'all';
  state.teamId = '';
  state.platform = '';
  state.channel = '';
  state.ownerId = memberId;
  state.range = 'custom';
  state.start = activeStart;
  state.end = activeEnd;
  state.error = '';
  state.report = null;
  await loadReport();
  window.scrollTo?.(0, 0);
}

function adminFormatDateTime(value) {
  if (!value) return '기록 없음';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(parsed);
}

function adminInt(value) {
  return typeof value === 'number' && Number.isFinite(value) ? number(value) : '0';
}

function adminCompanyRoleLabel(companyId, roleId) {
  const catalog = typeof waCatalog === 'function' ? waCatalog() : { companies: [] };
  const company = (catalog.companies || []).find(item => item.id === companyId);
  const found = company?.roles?.find(([id]) => id === roleId);
  return found ? found[1] : roleId || '';
}

function adminDutyLabel(dutyId) {
  const catalog = typeof waCatalog === 'function' ? waCatalog() : { duties: [] };
  const found = (catalog.duties || []).find(item => item.id === dutyId);
  return found ? found.label : dutyId;
}

function adminStoredMemberships(member) {
  return Array.isArray(member?.workspaceAccess?.memberships) ? member.workspaceAccess.memberships : [];
}

function adminStoredDuties(member) {
  return Array.isArray(member?.workspaceAccess?.duties) ? member.workspaceAccess.duties : [];
}

function adminIsLegacyAccount(member) {
  return Boolean(member && member.role !== 'admin' && !member.workspaceAccess?.configured);
}

function adminIsCommonOnlyAccount(member) {
  return Boolean(
    member
    && member.role !== 'admin'
    && member.workspaceAccess?.configured
    && adminStoredMemberships(member).length === 0
  );
}

function adminTeamName(teamId) {
  if (!teamId) return '팀 미지정';
  const found = (state.data?.teams || []).find(team => team.id === teamId);
  return found ? found.name : '팀 미지정';
}

function adminAllMembers() {
  const rows = Array.isArray(state.data?.members) ? state.data.members : [];
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
}

function adminMatchesCompany(member, filter) {
  if (!filter || filter === 'all') return true;
  const memberships = adminStoredMemberships(member);
  if (['LAB', 'PATH', 'SHIFT', 'PULSE'].includes(filter)) {
    return memberships.some(item => item.company === filter);
  }
  if (filter === 'legacy') return adminIsLegacyAccount(member);
  if (filter === 'admin') return member.role === 'admin';
  if (filter === 'common') return adminIsCommonOnlyAccount(member);
  return true;
}

function adminMatchesStatus(member, filter) {
  if (!filter || filter === 'all') return true;
  const active = member.active !== false;
  return filter === 'active' ? active : !active;
}

function adminMatchesSearch(member, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = `${member.name || ''} ${member.email || ''}`.toLowerCase();
  return hay.includes(q);
}

function adminFilteredMembers(allMembers = adminAllMembers()) {
  return allMembers.filter(member => (
    adminMatchesCompany(member, adminState.company)
    && adminMatchesStatus(member, adminState.status)
    && adminMatchesSearch(member, adminState.search)
  ));
}

function adminSupplementaryMap() {
  const map = new Map();
  if (!adminState.data || adminState.loading || adminState.refreshing || adminState.error || adminState.forbidden) {
    return map;
  }
  for (const row of adminState.data.members || []) {
    if (row && typeof row.id === 'string') map.set(row.id, row);
  }
  return map;
}

function adminStoredChipsMarkup(member) {
  const memberships = adminStoredMemberships(member);
  const duties = adminStoredDuties(member);
  const chips = [];
  if (member.role === 'admin') {
    chips.push('<span class="admin-chip admin-role">전체 접근 관리자</span>');
  }
  for (const item of memberships) {
    const roleName = adminCompanyRoleLabel(item.company, item.role);
    chips.push(`<span class="admin-chip company">${escape(item.company)}${roleName ? ` (${escape(roleName)})` : ''}</span>`);
  }
  if (adminIsLegacyAccount(member)) {
    chips.push('<span class="admin-chip legacy">회사 미지정 기존 권한 계정</span>');
  } else if (adminIsCommonOnlyAccount(member)) {
    chips.push('<span class="admin-chip">전사 공통 도구 전용</span>');
  }
  for (const dutyId of duties) {
    chips.push(`<span class="admin-chip">${escape(adminDutyLabel(dutyId))}</span>`);
  }
  return `<div class="admin-chip-list">${chips.join('')}</div>`;
}

function adminStoredSummaryLine(member) {
  const memberships = adminStoredMemberships(member);
  if (memberships.length) {
    return memberships.map(item => `${item.company} ${adminCompanyRoleLabel(item.company, item.role)}`.trim()).join(', ');
  }
  if (member.role === 'admin') return '전체 회사 접근 관리자';
  if (adminIsLegacyAccount(member)) return '회사 미지정 기존 권한 계정';
  return '전사 공통 도구 전용';
}

function adminPerformanceStateLabel(perfState) {
  const map = {
    observed: '관측 기록 확인됨',
    historyOnly: '과거 담당 관측 기록',
    inactiveOnly: '담당 채널 모두 보관됨',
    awaitingObservation: '첫 관측 대기 중',
    notConnected: '운영 채널 연결 필요',
    unassigned: '담당 채널 없음'
  };
  return map[perfState] || '상태 확인 전';
}

function adminPulseActiveSum(stageMap) {
  if (!stageMap || typeof stageMap !== 'object') return 0;
  return (
    (Number(stageMap.received) || 0)
    + (Number(stageMap.planning) || 0)
    + (Number(stageMap.producing) || 0)
    + (Number(stageMap.review) || 0)
    + (Number(stageMap.delivered) || 0)
  );
}

function adminMemberActionsMarkup(member, { includeSelect = false } = {}) {
  const own = member.id === state.user?.id;
  const otherAdmin = member.role === 'admin' && !own;
  const buttons = [];

  if (includeSelect) {
    buttons.push(`<button type="button" class="btn small quiet" data-admin-member="${escape(member.id)}">성과와 업무</button>`);
  }
  buttons.push(`<button type="button" class="btn small" data-admin-action="member-detail" data-id="${escape(member.id)}">직원 상세</button>`);

  if (!otherAdmin) {
    buttons.push(`<button type="button" class="btn small" data-action="wa-member" data-id="${escape(member.id)}">회사와 직무</button>`);
    buttons.push(`<button type="button" class="btn small" data-action="member-assignment" data-id="${escape(member.id)}">${own ? '내 팀 정하기' : '팀과 접근 권한'}</button>`);
  }
  if (!own && !otherAdmin) {
    buttons.push(`<button type="button" class="btn small quiet" data-action="member-status" data-id="${escape(member.id)}">${member.active === false ? '이용 재개' : '이용 중지'}</button>`);
  }

  let guardNote = '';
  if (otherAdmin) {
    guardNote = '<p class="admin-guard-note">다른 관리자 계정의 권한과 이용 상태는 변경할 수 없어요.</p>';
  } else if (own) {
    guardNote = '<p class="admin-guard-note">내 계정의 관리자 권한 해제와 이용 중지는 허용되지 않아요.</p>';
  }

  return `<div class="admin-row-actions">${buttons.join('')}</div>${guardNote}`;
}

function adminSummaryMarkup(allMembers) {
  const activeCount = allMembers.filter(m => m.active !== false).length;
  const inactiveCount = allMembers.length - activeCount;
  const assignedCount = allMembers.filter(m => adminStoredMemberships(m).length > 0).length;
  const legacyCount = allMembers.filter(adminIsLegacyAccount).length;
  const adminCount = allMembers.filter(m => m.role === 'admin').length;

  const hasFreshData = Boolean(adminState.data && !adminState.loading && !adminState.refreshing && !adminState.error && !adminState.forbidden);
  const invitations = hasFreshData && Array.isArray(adminState.data.invitations) ? adminState.data.invitations : null;
  const pendingInvites = invitations ? invitations.filter(row => row.status === 'pending').length : null;
  const acceptedInvites = invitations ? invitations.filter(row => row.status === 'accepted').length : null;

  let pulseReassign = 0;
  if (hasFreshData) {
    const memberIds = new Set(allMembers.map(m => m.id));
    for (const row of adminState.data.members || []) {
      if (!memberIds.has(row.id)) continue;
      pulseReassign += (Number(row.work?.PULSE?.ownerInactive) || 0) + (Number(row.work?.PULSE?.reviewerInactive) || 0);
    }
  }

  const shownStart = adminState.data?.start || adminState.start;
  const shownEnd = adminState.data?.end || adminState.end;

  return `
    <article class="admin-summary-card">
      <span class="admin-summary-label">전체 인원</span>
      <strong class="admin-summary-value">${number(allMembers.length)}명</strong>
      <div class="admin-summary-sub">
        <span class="admin-summary-meta">이용 중 ${number(activeCount)}명</span>
        <span class="admin-summary-meta">중지 ${number(inactiveCount)}명</span>
      </div>
    </article>
    <article class="admin-summary-card">
      <span class="admin-summary-label">소속 지정</span>
      <strong class="admin-summary-value">${number(assignedCount)}명</strong>
      <div class="admin-summary-sub">
        <span class="admin-summary-meta ${legacyCount ? 'is-warn' : ''}">미지정 ${number(legacyCount)}명</span>
        <span class="admin-summary-meta">관리자 ${number(adminCount)}명</span>
      </div>
    </article>
    <article class="admin-summary-card">
      <span class="admin-summary-label">초대 대기</span>
      <strong class="admin-summary-value ${invitations === null ? 'is-muted' : ''}">${invitations === null ? (adminState.loading ? '갱신 중' : '확인 전') : `${number(pendingInvites)}건`}</strong>
      <div class="admin-summary-sub">
        ${invitations === null
          ? '<span class="admin-summary-meta">현황 확인 뒤 표시</span>'
          : `<span class="admin-summary-meta">최근 수락 ${number(acceptedInvites)}건</span>`}
      </div>
    </article>
    <article class="admin-summary-card">
      <span class="admin-summary-label">성과 조회 기간</span>
      <strong class="admin-summary-value is-muted"><span class="admin-summary-date">${escape(shownStart)}부터</span> <span class="admin-summary-date">${escape(shownEnd)}까지</span></strong>
      <div class="admin-summary-sub">
        ${hasFreshData && adminState.data.asOf
          ? `<span class="admin-summary-meta">기준 ${escape(adminFormatDateTime(adminState.data.asOf))}</span>`
          : '<span class="admin-summary-meta">한국 시간 기준</span>'}
        ${hasFreshData && pulseReassign > 0
          ? `<span class="admin-summary-meta is-warn">PULSE 재지정 ${number(pulseReassign)}건</span>`
          : ''}
      </div>
    </article>
  `;
}

function adminBannerMarkup() {
  if (adminState.rangeError) {
    return `<div class="admin-status-box is-error" role="alert"><div class="admin-status-copy"><strong>조회 기간을 확인해 주세요</strong><span>${escape(adminState.rangeError)}</span></div></div>`;
  }
  if (adminState.loading) {
    const title = adminState.refreshing ? '관리자 데이터를 새로 불러오고 있어요.' : '관리자 데이터를 불러오고 있어요.';
    const detail = '최신 수치를 확인하고 있습니다. 잠시만 기다려 주세요.';
    return `<div class="admin-status-box is-loading" role="status"><div class="admin-status-copy"><strong>${escape(title)}</strong><span>${escape(detail)}</span></div></div>`;
  }
  if (adminState.error) {
    return `<div class="admin-status-box is-error" role="alert"><div class="admin-status-copy"><strong>관리자 정보를 불러오지 못했어요</strong><span>${escape(adminState.error)}</span></div>${adminState.forbidden ? '' : `<button type="button" class="btn small" data-admin-action="retry">${icon('refresh')}다시 시도</button>`}</div>`;
  }
  return '';
}

function adminFilterNoteMarkup(allMembers, filteredMembers) {
  const hasFilter = adminState.search.trim() !== '' || adminState.company !== 'all' || adminState.status !== 'all';
  if (!hasFilter) {
    return `전체 직원 ${number(allMembers.length)}명을 표시하고 있습니다. 여러 회사를 겸임하는 직원도 전체 인원에서는 한 번만 셉니다.`;
  }
  return `전체 ${number(allMembers.length)}명 가운데 조건에 맞는 ${number(filteredMembers.length)}명을 표시하고 있습니다.`;
}

function adminMemberSupplementarySummary(extra) {
  if (adminState.loading || adminState.refreshing) {
    return '<div class="admin-cell-lines"><span>보충 지표를 갱신하고 있습니다.</span></div>';
  }
  if (adminState.error || adminState.forbidden || !adminState.data) {
    return '<div class="admin-cell-lines"><span>보충 지표를 아직 확인하지 못했습니다.</span></div>';
  }
  if (!extra) {
    return '<div class="admin-cell-lines"><span>보충 기록이 없습니다.</span></div>';
  }
  const channels = Array.isArray(extra.channels) ? extra.channels : [];
  const ownedCount = channels.filter(ch => ch.relation === 'owner').length;
  const incomingCount = channels.filter(ch => ch.relation === 'incoming').length;
  const perfState = adminPerformanceStateLabel(extra.performance?.state);
  const views = extra.performance?.metrics?.views;
  const viewsLine = typeof views?.latest === 'number' && Number.isFinite(views.latest)
    ? `조회수 누적 <strong>${number(views.latest)}</strong>`
    : '조회수 누적 미확인';
  const inviteLine = extra.invitation
    ? `초대 수락 ${escape(adminFormatDateTime(extra.invitation.acceptedAt))}`
    : '초대 기록 없음';

  return `
    <div class="admin-cell-lines">
      <span>담당 채널 <strong>${number(ownedCount)}개</strong>${incomingCount ? `, 인계 대기 ${number(incomingCount)}개` : ''}</span>
      <span>${escape(perfState)} (${viewsLine})</span>
      <span>${inviteLine}</span>
    </div>
  `;
}

function adminMembersPanelMarkup(allMembers, filteredMembers, extraMap) {
  if (adminState.forbidden) {
    return `<div class="admin-empty"><h3>관리자 권한이 필요해요</h3><p>권한 상태를 다시 확인하고 있습니다.</p></div>`;
  }
  if (!allMembers.length) {
    return `<div class="admin-empty"><h3>등록된 직원이 없어요</h3><p>초대코드를 발급해 첫 직원을 워크스페이스에 합류시켜 주세요.</p><button type="button" class="btn primary" data-action="invite">${icon('plus')}초대코드 발급</button></div>`;
  }
  if (!filteredMembers.length) {
    return `<div class="admin-empty"><h3>조건에 맞는 직원이 없어요</h3><p>검색어나 소속 회사 또는 이용 상태 필터를 초기화해 다시 확인해 보세요.</p><button type="button" class="btn small" data-admin-action="reset-filters">필터 초기화</button></div>`;
  }

  return `
    <div class="admin-section-head">
      <div>
        <h2>직원 명부와 권한 관리 <span class="admin-count-tag">${number(filteredMembers.length)}명</span></h2>
        <p>이름을 누르면 해당 직원의 채널 성과와 등록 업무 보기로 이동합니다. 중지된 계정도 저장된 소속 회사를 그대로 표시합니다.</p>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table admin-members-table">
        <thead>
          <tr>
            <th scope="col">직원</th>
            <th scope="col">저장된 소속 회사와 직무</th>
            <th scope="col">팀과 이용 상태</th>
            <th scope="col">초대와 채널 요약</th>
            <th scope="col">관리 작업</th>
          </tr>
        </thead>
        <tbody>
          ${filteredMembers.map(member => {
            const extra = extraMap.get(member.id) || null;
            const initial = Array.from((member.name || '?').trim())[0] || '?';
            const selected = member.id === adminState.selectedMemberId;
            return `
              <tr class="${selected ? 'is-selected' : ''}">
                <td data-label="직원">
                  <div class="admin-person">
                    <span class="admin-avatar" aria-hidden="true">${escape(initial)}</span>
                    <div class="admin-person-meta">
                      <div class="admin-person-name">
                        <button type="button" class="admin-name-btn" data-admin-member="${escape(member.id)}" aria-label="${escape(member.name)} 성과와 업무 보기">${escape(member.name)}</button>
                        ${member.id === state.user?.id ? '<span class="admin-chip">나</span>' : ''}
                      </div>
                      ${member.email ? `<span class="admin-person-email">${escape(member.email)}</span>` : ''}
                      ${member.organization?.jobTitle ? `<span class="admin-cell-sub">${escape(member.organization.jobTitle)}</span>` : ''}
                    </div>
                  </div>
                </td>
                <td data-label="저장된 소속 회사와 직무">
                  ${adminStoredChipsMarkup(member)}
                  ${member.active === false ? '<span class="admin-cell-sub">계정이 중지된 동안에는 저장된 소속만 유지되며 실제 접근은 열리지 않습니다.</span>' : ''}
                </td>
                <td data-label="팀과 이용 상태">
                  <div class="admin-chip-list">
                    <span class="admin-chip ${member.active === false ? 'stopped' : 'active'}">${member.active === false ? '이용 중지' : '이용 중'}</span>
                    <span class="admin-chip">${escape(roleLabel(member.role))}</span>
                  </div>
                  <span class="admin-cell-sub">소속 팀: ${escape(adminTeamName(member.teamId))}</span>
                </td>
                <td data-label="초대와 채널 요약">
                  ${adminMemberSupplementarySummary(extra)}
                </td>
                <td data-label="관리 작업">
                  ${adminMemberActionsMarkup(member, { includeSelect: true })}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function adminInviteMembershipSummary(invite) {
  const memberships = Array.isArray(invite?.memberships) ? invite.memberships : [];
  const duties = Array.isArray(invite?.duties) ? invite.duties : [];
  const chips = [];
  if (memberships.length) {
    for (const row of memberships) {
      const roleName = adminCompanyRoleLabel(row.company, row.role);
      chips.push(`<span class="admin-chip company">${escape(row.company)}${roleName ? ` (${escape(roleName)})` : ''}</span>`);
    }
  } else {
    chips.push('<span class="admin-chip">전사 공통 초대</span>');
  }
  for (const dutyId of duties) {
    chips.push(`<span class="admin-chip">${escape(adminDutyLabel(dutyId))}</span>`);
  }
  return `<div class="admin-chip-list">${chips.join('')}</div>`;
}

function adminInviteStatusChip(status) {
  const map = {
    pending: ['대기 중', 'warn'],
    accepted: ['수락 완료', 'active'],
    revoked: ['취소됨', 'stopped'],
    expired: ['만료됨', '']
  };
  const [label, cls] = map[status] || [status || '확인 필요', ''];
  return `<span class="admin-chip ${cls}">${escape(label)}</span>`;
}

function adminInvitationsPanelMarkup(allMembers) {
  const ctaHeader = `
    <div class="admin-invite-actions-bar">
      <div class="admin-invite-guide">
        <h2>초대코드 발급과 초대 관리</h2>
        <p>초대코드 발급에서 직원 정보와 소속 회사를 지정한 뒤 나온 코드나 링크를 복사해 전달해 주세요.</p>
        <p>초대 관리에서는 방금 발급한 코드를 다시 확인하거나 대기 중인 초대를 취소할 수 있습니다.</p>
      </div>
      <div class="admin-invite-cta-group">
        <button type="button" class="btn primary" data-action="invite">${icon('plus')}초대코드 발급</button>
        <button type="button" class="btn" data-action="wa-invites">초대 관리</button>
      </div>
    </div>
  `;

  if (adminState.forbidden) {
    return `${ctaHeader}<div class="admin-empty"><h3>초대 현황을 열람할 수 없어요</h3><p>관리자 권한이 있는 계정에서만 초대 목록을 볼 수 있습니다.</p></div>`;
  }
  if (adminState.loading || adminState.refreshing) {
    return `${ctaHeader}<div class="admin-empty"><h3>초대 목록을 불러오고 있어요</h3><p>잠시만 기다려 주세요.</p></div>`;
  }
  if (adminState.error || !adminState.data) {
    return `${ctaHeader}<div class="admin-empty"><h3>초대 목록을 확인하지 못했어요</h3><p>상단의 다시 시도 단추를 눌러 초대 내역을 다시 불러와 주세요.</p><button type="button" class="btn small" data-admin-action="retry">${icon('refresh')}다시 시도</button></div>`;
  }

  const invitations = Array.isArray(adminState.data.invitations) ? adminState.data.invitations : [];
  const limit = Number(adminState.data.invitationHistoryLimit) || 100;
  const memberById = new Map(allMembers.map(member => [member.id, member]));

  const countFor = status => status === 'all' ? invitations.length : invitations.filter(row => row.status === status).length;
  const visibleInvites = adminState.inviteStatus === 'all'
    ? invitations
    : invitations.filter(row => row.status === adminState.inviteStatus);

  const filterTabs = `
    <div class="admin-invite-status-tabs" role="group" aria-label="초대 상태 선택">
      ${ADMIN_INVITE_FILTERS.map(([key, label]) => `
        <button type="button" class="admin-filter-pill" data-admin-invite-status="${key}" aria-pressed="${adminState.inviteStatus === key}">
          ${escape(label)} (${number(countFor(key))})
        </button>
      `).join('')}
    </div>
  `;

  const limitNote = `
    <p class="admin-limit-note">
      대기 중인 초대는 모두 표시하며 수락이나 취소 또는 만료로 종료된 초대 이력은 최근 ${number(limit)}개까지만 표시합니다.
    </p>
  `;

  if (!invitations.length) {
    return `${ctaHeader}${filterTabs}<div class="admin-empty"><h3>아직 발급한 초대가 없어요</h3><p>초대코드 발급 단추를 눌러 합류할 직원의 초대를 만들어 보세요.</p></div>${limitNote}`;
  }

  if (!visibleInvites.length) {
    return `${ctaHeader}${filterTabs}<div class="admin-empty"><h3>선택한 상태의 초대가 없어요</h3><p>다른 초대 상태를 선택해 이력을 확인해 보세요.</p></div>${limitNote}`;
  }

  return `
    ${ctaHeader}
    ${filterTabs}
    <div class="admin-table-wrap">
      <table class="admin-table admin-invites-table">
        <thead>
          <tr>
            <th scope="col">대상자</th>
            <th scope="col">지정 소속과 권한</th>
            <th scope="col">상태</th>
            <th scope="col">발급과 수락 및 만료 시각</th>
            <th scope="col">연결 작업</th>
          </tr>
        </thead>
        <tbody>
          ${visibleInvites.map(row => {
            const linkedMember = row.status === 'accepted' && typeof row.userId === 'string' && row.userId
              ? memberById.get(row.userId) || null
              : null;
            return `
              <tr>
                <td data-label="대상자">
                  <div class="admin-person-meta">
                    <div class="admin-person-name"><strong>${escape(row.name || '이름 미지정')}</strong></div>
                    ${row.email ? `<span class="admin-person-email">${escape(row.email)}</span>` : ''}
                  </div>
                </td>
                <td data-label="지정 소속과 권한">
                  ${adminInviteMembershipSummary(row)}
                  <span class="admin-cell-sub">접근 권한: ${escape(roleLabel(row.role || 'member'))}, 팀: ${escape(adminTeamName(row.teamId))}</span>
                </td>
                <td data-label="상태">
                  ${adminInviteStatusChip(row.status)}
                </td>
                <td data-label="발급과 수락 및 만료 시각">
                  <dl class="admin-time-list">
                    <div><dt>발급 시각</dt><dd>${escape(adminFormatDateTime(row.createdAt))}</dd></div>
                    ${row.acceptedAt ? `<div><dt>수락 시각</dt><dd>${escape(adminFormatDateTime(row.acceptedAt))}</dd></div>` : ''}
                    ${row.revokedAt ? `<div><dt>취소 시각</dt><dd>${escape(adminFormatDateTime(row.revokedAt))}</dd></div>` : ''}
                    <div><dt>만료 시각</dt><dd>${escape(adminFormatDateTime(row.expiresAt))}</dd></div>
                  </dl>
                </td>
                <td data-label="연결 작업">
                  <div class="admin-row-actions">
                    ${row.status === 'pending'
                      ? '<button type="button" class="btn small quiet" data-action="wa-invites">초대 관리에서 취소</button>'
                      : row.status === 'accepted'
                        ? (linkedMember
                          ? `<button type="button" class="btn small" data-admin-action="view-accepted-member" data-id="${escape(linkedMember.id)}">직원 보기</button>`
                          : '<span class="admin-cell-sub">연결된 직원 정보를 찾을 수 없어요.</span>')
                        : '<span class="admin-cell-sub">종료된 초대</span>'}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${limitNote}
  `;
}

function adminPerformanceCalloutMarkup(perf) {
  const st = perf?.state || 'unassigned';
  const count = Number(perf?.observedChannelCount) || 0;
  if (st === 'observed') {
    return `<div class="admin-state-callout"><strong>선택 종료일까지 담당 채널 ${number(count)}개의 관측 기록을 확인했어요</strong><span>현재 연결이 끊어진 채널이 있더라도 이미 수집된 관측 기록은 아래 표에 유지합니다. 각 채널의 현재 연결 상태는 채널 목록에서 따로 확인해 주세요.</span></div>`;
  }
  if (st === 'historyOnly') {
    return `<div class="admin-state-callout"><strong>현재 담당 채널은 없지만 과거 담당 채널 ${number(count)}개의 관측 기록이 있어요</strong><span>이 직원이 담당했던 기간에 수집된 관측 기록을 표시합니다.</span></div>`;
  }
  if (st === 'inactiveOnly') {
    return `<div class="admin-state-callout warn"><strong>담당 채널이 모두 보관되어 있어요</strong><span>보관된 채널은 자동 수집을 진행하지 않습니다. 선택 종료일까지 확인된 관측 기록이 없습니다.</span></div>`;
  }
  if (st === 'awaitingObservation') {
    return `<div class="admin-state-callout"><strong>첫 관측 기록을 기다리고 있어요</strong><span>운영 중이며 연결된 담당 채널이 있습니다. 다음 수집이 끝나면 아래 지표가 채워집니다.</span></div>`;
  }
  if (st === 'notConnected') {
    return `<div class="admin-state-callout warn"><strong>운영 중인 채널의 연결이 없어요</strong><span>현재 맡고 있는 운영 채널에 계정이 연결되지 않아 자동 수집을 시작할 수 없습니다.</span></div>`;
  }
  return `<div class="admin-state-callout"><strong>배정된 채널과 관측 기록이 없어요</strong><span>현재 맡고 있는 채널이 없으며 선택 종료일까지 기록된 과거 담당 관측도 없습니다.</span></div>`;
}

function adminMetricsTableMarkup(perf, activeEnd) {
  const metrics = perf?.metrics || {};
  return `
    <div class="admin-table-wrap">
      <table class="admin-table admin-metrics-table">
        <thead>
          <tr>
            <th scope="col">지표</th>
            <th scope="col">최신 누적값</th>
            <th scope="col">선택 기간 증감</th>
            <th scope="col">데이터 확인 범위</th>
            <th scope="col">관측 기준일</th>
          </tr>
        </thead>
        <tbody>
          ${ADMIN_METRICS.map(([key, label]) => {
            const metric = metrics[key] ?? null;
            const hasLatest = typeof metric?.latest === 'number' && Number.isFinite(metric.latest);
            const hasDelta = typeof metric?.period?.delta === 'number' && Number.isFinite(metric.period.delta);
            const deltaVal = hasDelta ? metric.period.delta : null;
            const hasRate = typeof metric?.period?.rate === 'number' && Number.isFinite(metric.period.rate);
            const newest = typeof metric?.newest === 'string' && metric.newest ? metric.newest : '';
            const oldest = typeof metric?.oldest === 'string' && metric.oldest ? metric.oldest : '';
            const isStale = Boolean(newest && activeEnd && newest < activeEnd);

            let deltaHtml = '<span class="admin-metric-missing">미확인</span>';
            if (hasDelta) {
              const cls = deltaVal > 0 ? 'positive' : deltaVal < 0 ? 'negative' : '';
              const text = deltaVal > 0 ? `+${number(deltaVal)}` : number(deltaVal);
              const rateText = hasRate ? ` (${metric.period.rate > 0 ? '+' : ''}${number(metric.period.rate)}%)` : '';
              deltaHtml = `<span class="delta ${cls}">${escape(text)}${escape(rateText)}</span>`;
            }

            return `
              <tr>
                <td data-label="지표"><strong>${escape(label)}</strong></td>
                <td data-label="최신 누적값">
                  ${hasLatest
                    ? `<span class="admin-metric-num">${escape(number(metric.latest))}</span>`
                    : '<span class="admin-metric-missing">미확인</span>'}
                </td>
                <td data-label="선택 기간 증감">
                  ${deltaHtml}
                </td>
                <td data-label="데이터 확인 범위">
                  <div class="admin-cell-lines">
                    <span>누적 ${adminInt(metric?.latestCount)} / 대상 ${adminInt(metric?.eligible)}</span>
                    <span>기간 비교 ${adminInt(metric?.period?.count)} / 대상 ${adminInt(metric?.period?.eligible)}</span>
                  </div>
                </td>
                <td data-label="관측 기준일">
                  ${newest
                    ? `<div class="admin-cell-lines">
                        <span>최근 관측일 ${escape(newest)}</span>
                        ${oldest ? `<span>최초 관측일 ${escape(oldest)}</span>` : ''}
                        ${isStale ? `<span class="admin-stale-tag">선택 종료일(${escape(activeEnd)}) 이전 기록</span>` : ''}
                      </div>`
                    : '<span class="admin-metric-missing">관측 기록 없음</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function adminChannelItemMarkup(channel) {
  const fullChannel = (state.data?.channels || []).find(row => row.id === channel.id) || null;
  const canChangeOwners = Boolean(fullChannel && (typeof canManageChannelOwners === 'function' ? canManageChannelOwners(fullChannel) : isAdmin()));
  const href = channel.url ? safeUrl(channel.url) : '#';
  const badges = [];

  if (channel.relation === 'incoming') {
    badges.push('<span class="admin-chip warn">인계 대기</span>');
  } else if (channel.shared) {
    badges.push('<span class="admin-chip company">공동 담당</span>');
  } else {
    badges.push('<span class="admin-chip">단독 담당</span>');
  }

  if (channel.active === false) {
    badges.push('<span class="admin-chip">보관됨</span>');
  } else if (channel.connected) {
    badges.push('<span class="admin-chip active">연결됨</span>');
  } else {
    badges.push('<span class="admin-chip warn">연결 안 됨</span>');
  }

  if (channel.relation === 'owner' && channel.handoffPending) {
    badges.push('<span class="admin-chip warn">담당자 인계 진행 중</span>');
  }

  return `
    <article class="admin-channel-item">
      <div class="admin-channel-main">
        <div class="admin-channel-title-row">
          ${typeof platformMark === 'function' ? platformMark(channel.platform) : ''}
          <strong>${escape(channel.displayName || channel.url || '이름 없는 채널')}</strong>
          <span class="admin-chip">${escape(typeof platformLabel === 'function' ? platformLabel(channel.platform) : channel.platform || '채널')}</span>
          ${channel.active !== false && typeof statusBadge === 'function' ? statusBadge(channel.status, channel.connected) : ''}
        </div>
        <div class="admin-chip-list admin-cell-sub">${badges.join('')}</div>
        ${href !== '#' ? `<a class="admin-channel-link" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(channel.url)} ${icon('external')}</a>` : ''}
      </div>
      <div class="admin-row-actions">
        ${canChangeOwners ? `<button type="button" class="btn small quiet" data-action="owners" data-id="${escape(channel.id)}">담당자 변경</button>` : ''}
        ${fullChannel ? `<button type="button" class="btn small quiet" data-action="channel-history" data-id="${escape(channel.id)}">담당 기록</button>` : ''}
      </div>
    </article>
  `;
}

function adminChannelsCardMarkup(extra) {
  const channels = Array.isArray(extra?.channels) ? extra.channels : [];
  const owned = channels.filter(ch => ch.relation === 'owner');
  const incoming = channels.filter(ch => ch.relation === 'incoming');

  return `
    <section class="admin-detail-card" aria-label="담당 채널과 인계 상태">
      <div class="admin-section-head">
        <div>
          <h3>담당 채널과 인계 상태</h3>
          <p>현재 담당 채널 ${number(owned.length)}개와 인계 대기 채널 ${number(incoming.length)}개를 구분해 표시합니다. 인계 대기 채널은 현재 담당 수에 포함하지 않습니다.</p>
        </div>
      </div>
      <div class="admin-channel-group">
        <h4 class="admin-subhead">현재 담당 채널 (${number(owned.length)}개)</h4>
        ${owned.length
          ? `<div class="admin-channel-list">${owned.map(adminChannelItemMarkup).join('')}</div>`
          : '<p class="admin-cell-sub">현재 담당하고 있는 채널이 없습니다.</p>'}
      </div>
      ${incoming.length ? `
        <div class="admin-channel-group">
          <h4 class="admin-subhead">인계 대기 채널 (${number(incoming.length)}개)</h4>
          <p class="admin-cell-sub">새 담당자가 계정 연결을 마치기 전까지는 기존 담당자가 그대로 맡습니다.</p>
          <div class="admin-channel-list">${incoming.map(adminChannelItemMarkup).join('')}</div>
        </div>
      ` : ''}
    </section>
  `;
}

function adminPulseStageGridMarkup(stageCounts) {
  return `
    <div class="admin-stage-grid">
      ${ADMIN_PULSE_STAGES.map(([stageKey, label]) => `
        <div class="admin-stage-cell ${stageKey === 'archived' ? 'is-archived' : ''}">
          <span>${escape(label)}</span>
          <strong>${number(Number(stageCounts?.[stageKey]) || 0)}건</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function adminWorkCardMarkup(extra) {
  const work = extra?.work || {};
  const pathOpen = Number(work.PATH?.open) || 0;
  const pathDone = Number(work.PATH?.done) || 0;
  const shiftOpen = Number(work.SHIFT?.open) || 0;
  const shiftDone = Number(work.SHIFT?.done) || 0;

  const pulseOwner = work.PULSE?.owner || {};
  const pulseReviewer = work.PULSE?.reviewer || {};
  const ownerActive = adminPulseActiveSum(pulseOwner);
  const ownerArchived = Number(pulseOwner.archived) || 0;
  const reviewerActive = adminPulseActiveSum(pulseReviewer);
  const reviewerArchived = Number(pulseReviewer.archived) || 0;
  const ownerInactive = Number(work.PULSE?.ownerInactive) || 0;
  const reviewerInactive = Number(work.PULSE?.reviewerInactive) || 0;

  return `
    <section class="admin-detail-card" aria-label="회사별 등록 업무 현황">
      <div class="admin-section-head">
        <div>
          <h3>회사별 등록 업무 현황</h3>
          <p>업무 건수는 현재 등록된 상태이며 선택 기간의 실적이 아닙니다. 완료 건수는 누적 건수이고 보관 건수는 진행 중 수에 포함하지 않습니다.</p>
        </div>
      </div>
      <div class="admin-work-grid">
        <div class="admin-work-box">
          <h4>SYNK PATH 상담과 정착 업무</h4>
          <div class="admin-work-stats">
            <span>진행 중 <strong>${number(pathOpen)}건</strong></span>
            <span>누적 완료 <strong>${number(pathDone)}건</strong></span>
          </div>
        </div>
        <div class="admin-work-box">
          <h4>SYNK SHIFT 강의 일정</h4>
          <div class="admin-work-stats">
            <span>진행 중 <strong>${number(shiftOpen)}건</strong></span>
            <span>누적 완료 <strong>${number(shiftDone)}건</strong></span>
          </div>
        </div>
        <div class="admin-work-box is-wide">
          <h4>SYNK PULSE 담당 프로젝트</h4>
          <div class="admin-work-stats">
            <span>진행 중(보관 제외) <strong>${number(ownerActive)}건</strong></span>
            <span>보관 <strong>${number(ownerArchived)}건</strong></span>
          </div>
          ${adminPulseStageGridMarkup(pulseOwner)}
        </div>
        <div class="admin-work-box is-wide">
          <h4>SYNK PULSE 검토 프로젝트</h4>
          <div class="admin-work-stats">
            <span>진행 중(보관 제외) <strong>${number(reviewerActive)}건</strong></span>
            <span>보관 <strong>${number(reviewerArchived)}건</strong></span>
          </div>
          ${adminPulseStageGridMarkup(pulseReviewer)}
          <div class="admin-work-alerts">
            ${ownerInactive > 0
              ? `<span class="admin-chip warn">다시 지정할 필요가 있는 보관되지 않은 담당 배정 ${number(ownerInactive)}건</span>`
              : '<span class="admin-cell-sub">다시 지정할 담당 배정 0건</span>'}
            ${reviewerInactive > 0
              ? `<span class="admin-chip warn">다시 지정할 필요가 있는 보관되지 않은 검토 배정 ${number(reviewerInactive)}건</span>`
              : '<span class="admin-cell-sub">다시 지정할 검토 배정 0건</span>'}
          </div>
        </div>
        <div class="admin-work-box is-wide">
          <h4>SYNK LAB 수업</h4>
          <p class="admin-cell-sub">LAB 수업과 학급 수치는 아직 이 화면에 연결되지 않았습니다. 학급과 수업 진행 현황은 기존 수업 화면에서 확인해 주세요.</p>
          <div class="admin-row-actions">
            <button type="button" class="btn small" data-action="tab" data-tab="teaching">수업 화면으로 이동</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function adminPerformancePanelMarkup(allMembers, filteredMembers, extraMap) {
  if (adminState.forbidden) {
    return `<div class="admin-empty"><h3>관리자 권한이 필요해요</h3><p>권한 상태를 확인하고 있습니다.</p></div>`;
  }
  if (!allMembers.length) {
    return `<div class="admin-empty"><h3>등록된 직원이 없어요</h3><p>직원이 합류하면 채널 성과와 업무 현황을 이곳에서 확인할 수 있습니다.</p></div>`;
  }
  if (!filteredMembers.length) {
    return `<div class="admin-empty"><h3>조건에 맞는 직원이 없어요</h3><p>검색어나 소속 회사 또는 이용 상태 필터를 바꾸어 직원을 선택해 주세요.</p><button type="button" class="btn small" data-admin-action="reset-filters">필터 초기화</button></div>`;
  }

  const activeMember = filteredMembers.find(m => m.id === adminState.selectedMemberId) || filteredMembers[0];
  const extra = extraMap.get(activeMember.id) || null;
  const activeStart = adminState.data?.start || adminState.start;
  const activeEnd = adminState.data?.end || adminState.end;
  const defs = adminState.data?.definitions || {};

  const basisSection = `
    <div class="admin-perf-basis">
      <div class="admin-basis-card">
        <strong>채널 성과 보는 법</strong>
        <span>${escape(defs.history || '담당 당시의 관측을 기준으로 집계합니다. 공동 담당자의 수치를 더하면 중복될 수 있습니다.')} 기간 증감은 선택한 시작일과 종료일 사이의 변화량입니다.</span>
      </div>
      <div class="admin-basis-card">
        <strong>업무 건수와 미확인 표시</strong>
        <span>${escape(defs.work || '업무 건수는 조회 시점에 등록된 상태입니다. 완료 건수는 선택 기간의 실적이 아닌 누적 건수입니다.')} ${escape(defs.missing || '확인되지 않은 값은 0이 아닌 미확인으로 표시합니다.')}</span>
      </div>
    </div>
  `;

  const rosterHtml = `
    <aside class="admin-roster-panel" aria-label="성과를 확인할 직원 선택">
      <div class="admin-roster-head">직원 선택 (${number(filteredMembers.length)}명)</div>
      <div class="admin-roster-list">
        ${filteredMembers.map(member => {
          const mExtra = extraMap.get(member.id) || null;
          const ownedCount = Array.isArray(mExtra?.channels) ? mExtra.channels.filter(ch => ch.relation === 'owner').length : null;
          const isSelected = member.id === activeMember.id;
          return `
            <button type="button" class="admin-roster-item" data-admin-member="${escape(member.id)}" aria-pressed="${isSelected}">
              <span class="admin-roster-top">
                <strong>${escape(member.name)}</strong>
                <span class="admin-chip ${member.active === false ? 'stopped' : 'active'}">${member.active === false ? '이용 중지' : '이용 중'}</span>
              </span>
              <span class="admin-roster-sub">${escape(adminStoredSummaryLine(member))}</span>
              <span class="admin-roster-sub">
                ${adminState.loading || adminState.refreshing
                  ? '데이터 갱신 중'
                  : mExtra
                    ? `담당 채널 ${number(ownedCount)}개, ${escape(adminPerformanceStateLabel(mExtra.performance?.state))}`
                    : '보충 데이터 확인 전'}
              </span>
            </button>
          `;
        }).join('')}
      </div>
    </aside>
  `;

  let inviteSummaryText = '초대 기록을 확인하기 전입니다.';
  if (adminState.loading || adminState.refreshing) {
    inviteSummaryText = '초대 이력을 갱신하고 있습니다.';
  } else if (extra) {
    inviteSummaryText = extra.invitation
      ? `발급 ${adminFormatDateTime(extra.invitation.createdAt)}, 수락 ${adminFormatDateTime(extra.invitation.acceptedAt)}`
      : '초대 기록 없음';
  }

  const profileCard = `
    <section class="admin-detail-card" aria-labelledby="admin-selected-member-name">
      <div class="admin-detail-head">
        <div class="admin-detail-title">
          <h3 id="admin-selected-member-name" tabindex="-1">${escape(activeMember.name)}</h3>
          <p>${activeMember.email ? escape(activeMember.email) : '이메일 정보 없음'}</p>
        </div>
        <div class="admin-row-actions">
          <button type="button" class="btn small primary" data-admin-action="member-analysis" data-id="${escape(activeMember.id)}">자세한 성과${icon('arrow')}</button>
        </div>
      </div>
      <dl class="admin-detail-meta">
        <div>
          <dt>저장된 소속 회사와 직무</dt>
          <dd>${adminStoredChipsMarkup(activeMember)}</dd>
        </div>
        <div>
          <dt>팀과 이용 상태</dt>
          <dd>${escape(adminTeamName(activeMember.teamId))}, ${escape(roleLabel(activeMember.role))}, ${activeMember.active === false ? '이용 중지' : '이용 중'}</dd>
        </div>
        <div>
          <dt>수락한 초대 이력</dt>
          <dd>${escape(inviteSummaryText)}</dd>
        </div>
        <div>
          <dt>업무 역할</dt>
          <dd>${escape(activeMember.organization?.jobTitle || '업무 역할 미입력')}</dd>
        </div>
      </dl>
      <div class="admin-cell-sub">
        ${adminMemberActionsMarkup(activeMember, { includeSelect: false })}
      </div>
    </section>
  `;

  if (adminState.loading || adminState.refreshing) {
    return `
      ${basisSection}
      <div class="admin-perf-layout">
        ${rosterHtml}
        <div class="admin-detail-panel">
          ${profileCard}
          <div class="admin-empty" role="status">
            <h3>선택한 직원의 성과와 업무를 갱신하고 있어요</h3>
            <p>최신 기록을 불러오는 동안 잠시만 기다려 주세요.</p>
          </div>
        </div>
      </div>
    `;
  }

  if (adminState.error || !adminState.data || !extra) {
    return `
      ${basisSection}
      <div class="admin-perf-layout">
        ${rosterHtml}
        <div class="admin-detail-panel">
          ${profileCard}
          <div class="admin-empty">
            <h3>성과와 업무 데이터를 불러오지 못했어요</h3>
            <p>다시 시도 단추를 눌러 최신 데이터를 조회해 주세요.</p>
            <button type="button" class="btn small" data-admin-action="retry">${icon('refresh')}다시 시도</button>
          </div>
        </div>
      </div>
    `;
  }

  const metricsCard = `
    <section class="admin-detail-card" aria-label="채널 성과 지표">
      <div class="admin-section-head">
        <div>
          <h3>채널 성과 (${escape(activeStart)}부터 ${escape(activeEnd)}까지)</h3>
          <p>최신 누적값과 선택 기간 증감을 구분해 표시합니다. 일별 추이와 게시물별 상세 분석은 자세한 성과에서 이어서 볼 수 있습니다.</p>
        </div>
        <button type="button" class="btn small" data-admin-action="member-analysis" data-id="${escape(activeMember.id)}">자세한 성과${icon('arrow')}</button>
      </div>
      ${adminPerformanceCalloutMarkup(extra.performance)}
      ${adminMetricsTableMarkup(extra.performance, activeEnd)}
    </section>
  `;

  return `
    ${basisSection}
    <div class="admin-perf-layout">
      ${rosterHtml}
      <div class="admin-detail-panel">
        ${profileCard}
        ${metricsCard}
        ${adminChannelsCardMarkup(extra)}
        ${adminWorkCardMarkup(extra)}
      </div>
    </div>
  `;
}

function adminPanelMarkup(allMembers, filteredMembers, extraMap) {
  if (adminState.tab === 'invitations') {
    return adminInvitationsPanelMarkup(allMembers);
  }
  if (adminState.tab === 'performance') {
    return adminPerformancePanelMarkup(allMembers, filteredMembers, extraMap);
  }
  return adminMembersPanelMarkup(allMembers, filteredMembers, extraMap);
}

function adminSyncDateInputs() {
  const root = document.querySelector('.admin-workspace');
  if (!root) return;
  const startInput = root.querySelector('form[data-admin-range] input[name="start"]');
  const endInput = root.querySelector('form[data-admin-range] input[name="end"]');
  const today = adminTodayDate();
  if (startInput && document.activeElement !== startInput) {
    startInput.value = adminState.draftStart;
    startInput.max = today;
  }
  if (endInput && document.activeElement !== endInput) {
    endInput.value = adminState.draftEnd;
    endInput.max = today;
  }
}

function adminPaint() {
  const root = document.querySelector('.admin-workspace');
  if (!root) return;

  const allMembers = adminAllMembers();
  const filteredMembers = adminFilteredMembers(allMembers);
  const extraMap = adminSupplementaryMap();
  const hasFilter = adminState.search.trim() !== '' || adminState.company !== 'all' || adminState.status !== 'all';

  const overlayOpen = Boolean(document.getElementById('overlay')?.children.length);
  const panelEl = root.querySelector('[data-admin-panel]');
  const activeEl = !overlayOpen && panelEl && panelEl.contains(document.activeElement) ? document.activeElement : null;
  const activeMemberAttr = activeEl?.getAttribute?.('data-admin-member') || '';
  const activeInviteStatusAttr = activeEl?.getAttribute?.('data-admin-invite-status') || '';

  const summaryEl = root.querySelector('[data-admin-summary]');
  if (summaryEl) summaryEl.innerHTML = adminSummaryMarkup(allMembers);

  const bannerEl = root.querySelector('[data-admin-banner]');
  if (bannerEl) bannerEl.innerHTML = adminBannerMarkup();

  root.querySelectorAll('[data-admin-tab]').forEach(btn => {
    const active = btn.dataset.adminTab === adminState.tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  const filterWrap = root.querySelector('[data-admin-filter-wrap]');
  if (filterWrap) {
    filterWrap.hidden = adminState.tab === 'invitations';
  }

  const filterNote = root.querySelector('[data-admin-filter-note]');
  if (filterNote) {
    filterNote.textContent = adminFilterNoteMarkup(allMembers, filteredMembers);
  }

  const resetWrap = root.querySelector('[data-admin-reset-wrap]');
  if (resetWrap) {
    resetWrap.hidden = !hasFilter;
  }

  const refreshBtn = root.querySelector('[data-admin-action="refresh"]');
  if (refreshBtn) {
    refreshBtn.disabled = Boolean(adminState.loading);
  }

  if (panelEl) {
    panelEl.innerHTML = adminPanelMarkup(allMembers, filteredMembers, extraMap);
    if (!overlayOpen && activeMemberAttr) {
      panelEl.querySelector(`[data-admin-member="${CSS.escape(activeMemberAttr)}"]`)?.focus({ preventScroll: true });
    } else if (!overlayOpen && activeInviteStatusAttr) {
      panelEl.querySelector(`[data-admin-invite-status="${CSS.escape(activeInviteStatusAttr)}"]`)?.focus({ preventScroll: true });
    }
  }
}

function adminWorkspacePage() {
  if (!adminCanUse()) return '';

  const allMembers = adminAllMembers();
  const filteredMembers = adminFilteredMembers(allMembers);
  const extraMap = adminSupplementaryMap();
  const hasFilter = adminState.search.trim() !== '' || adminState.company !== 'all' || adminState.status !== 'all';
  const today = adminTodayDate();
  const showInitialLoading = !adminState.entered && !adminState.data && !adminState.error;

  return `
    <section class="admin-workspace" aria-labelledby="admin-workspace-title">
      <header class="admin-head">
        <div class="admin-head-copy">
          <p class="admin-eyebrow">전사 운영 관리</p>
          <h1 id="admin-workspace-title">관리자</h1>
          <p class="admin-head-desc">직원 소속과 초대를 관리하고 채널 성과와 업무 현황을 확인합니다.</p>
        </div>
        <div class="admin-head-actions">
          <button type="button" class="btn small quiet" data-admin-action="refresh" ${adminState.loading ? 'disabled' : ''}>${icon('refresh')}새로고침</button>
          <button type="button" class="btn small" data-action="wa-invites">초대 관리</button>
          <button type="button" class="btn small primary" data-action="invite">${icon('plus')}초대코드 발급</button>
        </div>
      </header>

      <div class="admin-summary-grid" data-admin-summary aria-label="관리자 핵심 요약">
        ${adminSummaryMarkup(allMembers)}
      </div>

      <div class="admin-banner" data-admin-banner>
        ${showInitialLoading
          ? '<div class="admin-status-box is-loading" role="status"><div class="admin-status-copy"><strong>관리자 데이터를 불러오고 있어요.</strong><span>수치를 확인하는 동안 잠시만 기다려 주세요.</span></div></div>'
          : adminBannerMarkup()}
      </div>

      <div class="admin-top-controls">
        <div class="admin-tabs" role="group" aria-label="관리자 보기 선택">
          <button type="button" class="admin-tab-btn ${adminState.tab === 'members' ? 'is-active' : ''}" data-admin-tab="members" aria-pressed="${adminState.tab === 'members'}">직원</button>
          <button type="button" class="admin-tab-btn ${adminState.tab === 'invitations' ? 'is-active' : ''}" data-admin-tab="invitations" aria-pressed="${adminState.tab === 'invitations'}">초대</button>
          <button type="button" class="admin-tab-btn ${adminState.tab === 'performance' ? 'is-active' : ''}" data-admin-tab="performance" aria-pressed="${adminState.tab === 'performance'}">성과</button>
        </div>

        <form class="admin-range-form" data-admin-range aria-label="성과 조회 기간 선택">
          <label class="admin-range-field">
            <span>시작일</span>
            <input type="date" name="start" aria-label="조회 시작일" value="${escape(adminState.draftStart)}" max="${escape(today)}" required>
          </label>
          <label class="admin-range-field">
            <span>종료일</span>
            <input type="date" name="end" aria-label="조회 종료일" value="${escape(adminState.draftEnd)}" max="${escape(today)}" required>
          </label>
          <div class="admin-range-actions">
            <button type="submit" class="btn small primary">기간 적용</button>
            <button type="button" class="btn small quiet" data-admin-preset="7">최근 7일</button>
            <button type="button" class="btn small quiet" data-admin-preset="30">최근 30일</button>
          </div>
        </form>
      </div>

      <div data-admin-filter-wrap ${adminState.tab === 'invitations' ? 'hidden' : ''}>
        <div class="admin-filter-bar" role="search" aria-label="직원 검색과 필터">
          <label class="admin-filter-field">
            <span>이름 검색</span>
            <input type="search" data-admin-search aria-label="직원 이름 검색" value="${escape(adminState.search)}" placeholder="직원 이름이나 이메일로 찾기" autocomplete="off" maxlength="160">
          </label>
          <label class="admin-filter-field">
            <span>소속 회사</span>
            <select data-admin-company aria-label="소속 회사 선택">
              ${ADMIN_COMPANY_FILTERS.map(([val, label]) => `<option value="${escape(val)}" ${adminState.company === val ? 'selected' : ''}>${escape(label)}</option>`).join('')}
            </select>
          </label>
          <label class="admin-filter-field">
            <span>이용 상태</span>
            <select data-admin-status aria-label="이용 상태 선택">
              ${ADMIN_STATUS_FILTERS.map(([val, label]) => `<option value="${escape(val)}" ${adminState.status === val ? 'selected' : ''}>${escape(label)}</option>`).join('')}
            </select>
          </label>
          <div class="admin-filter-reset" data-admin-reset-wrap ${hasFilter ? '' : 'hidden'}>
            <button type="button" class="btn small quiet" data-admin-action="reset-filters">필터 초기화</button>
          </div>
        </div>
        <p class="admin-filter-note" data-admin-filter-note>${escape(adminFilterNoteMarkup(allMembers, filteredMembers))}</p>
      </div>

      <div class="admin-panel" data-admin-panel>
        ${adminPanelMarkup(allMembers, filteredMembers, extraMap)}
      </div>
    </section>
  `;
}

document.addEventListener('compositionstart', event => {
  if (event.target?.closest?.('.admin-workspace')) {
    adminState.composing = true;
  }
});

document.addEventListener('compositionend', event => {
  if (!event.target?.closest?.('.admin-workspace')) return;
  adminState.composing = false;
  if (event.target.matches?.('[data-admin-search]')) {
    adminState.search = event.target.value;
  }
  if (adminState.deferredRender) {
    adminState.deferredRender = false;
    if (typeof render === 'function') render();
  } else {
    adminPaint();
  }
});

document.addEventListener('input', event => {
  const target = event.target;
  if (!target?.closest?.('.admin-workspace')) return;
  if (target.matches('[data-admin-search]')) {
    adminState.search = target.value;
    adminPaint();
    return;
  }
  if (target.closest('form[data-admin-range]')) {
    if (target.name === 'start') adminState.draftStart = target.value;
    if (target.name === 'end') adminState.draftEnd = target.value;
    if (adminState.rangeError) {
      adminState.rangeError = '';
      adminPaint();
    }
  }
});

document.addEventListener('change', event => {
  const target = event.target;
  if (!target?.closest?.('.admin-workspace')) return;
  if (target.matches('[data-admin-company]')) {
    adminState.company = target.value;
    adminPaint();
    return;
  }
  if (target.matches('[data-admin-status]')) {
    adminState.status = target.value;
    adminPaint();
    return;
  }
  if (target.closest('form[data-admin-range]')) {
    if (target.name === 'start') adminState.draftStart = target.value;
    if (target.name === 'end') adminState.draftEnd = target.value;
  }
});

document.addEventListener('submit', event => {
  const form = event.target?.closest?.('form[data-admin-range]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const start = String(data.get('start') || '').trim();
  const end = String(data.get('end') || '').trim();
  adminState.draftStart = start;
  adminState.draftEnd = end;
  const validationError = adminValidateRange(start, end);
  if (validationError) {
    adminState.rangeError = validationError;
    adminPaint();
    return;
  }
  adminState.start = start;
  adminState.end = end;
  adminState.rangeError = '';
  void loadAdminWorkspace({ reason: 'range' });
});

document.addEventListener('click', event => {
  const root = event.target?.closest?.('.admin-workspace');
  if (!root) return;

  const tabBtn = event.target.closest('[data-admin-tab]');
  if (tabBtn && !tabBtn.disabled) {
    const nextTab = tabBtn.dataset.adminTab;
    if (['members', 'invitations', 'performance'].includes(nextTab)) {
      adminState.tab = nextTab;
      adminPaint();
    }
    return;
  }

  const memberBtn = event.target.closest('[data-admin-member]');
  if (memberBtn && !memberBtn.disabled) {
    const memberId = memberBtn.dataset.adminMember;
    if (memberId) {
      const wasInRoster = Boolean(memberBtn.closest('.admin-roster-list'));
      adminState.selectedMemberId = memberId;
      adminState.tab = 'performance';
      adminPaint();
      if (!wasInRoster) {
        root.querySelector('#admin-selected-member-name')?.focus({ preventScroll: false });
      }
    }
    return;
  }

  const inviteFilterBtn = event.target.closest('[data-admin-invite-status]');
  if (inviteFilterBtn && !inviteFilterBtn.disabled) {
    const nextStatus = inviteFilterBtn.dataset.adminInviteStatus;
    if (ADMIN_INVITE_FILTERS.some(([key]) => key === nextStatus)) {
      adminState.inviteStatus = nextStatus;
      adminPaint();
    }
    return;
  }

  const presetBtn = event.target.closest('[data-admin-preset]');
  if (presetBtn && !presetBtn.disabled) {
    const days = Number(presetBtn.dataset.adminPreset);
    if (Number.isFinite(days) && days >= 1) {
      const end = adminTodayDate();
      const start = adminShiftDate(end, -(days - 1));
      adminState.start = start;
      adminState.end = end;
      adminState.draftStart = start;
      adminState.draftEnd = end;
      adminState.rangeError = '';
      adminSyncDateInputs();
      void loadAdminWorkspace({ reason: 'range' });
    }
    return;
  }

  const actionBtn = event.target.closest('[data-admin-action]');
  if (!actionBtn || actionBtn.disabled) return;
  const action = actionBtn.dataset.adminAction;
  const id = actionBtn.dataset.id || '';

  if (action === 'refresh') {
    void adminManualRefresh();
    return;
  }
  if (action === 'retry') {
    if (adminState.needsStateReload || !state.data) {
      void adminManualRefresh();
    } else {
      void loadAdminWorkspace({ reason: 'refresh' });
    }
    return;
  }
  if (action === 'reset-filters') {
    adminState.search = '';
    adminState.company = 'all';
    adminState.status = 'all';
    const searchInput = root.querySelector('[data-admin-search]');
    const companySelect = root.querySelector('[data-admin-company]');
    const statusSelect = root.querySelector('[data-admin-status]');
    if (searchInput) searchInput.value = '';
    if (companySelect) companySelect.value = 'all';
    if (statusSelect) statusSelect.value = 'all';
    adminPaint();
    searchInput?.focus({ preventScroll: true });
    return;
  }
  if (action === 'member-detail') {
    if (id && typeof organizationDetail === 'function') organizationDetail(id);
    return;
  }
  if (action === 'view-accepted-member') {
    const targetMember = adminAllMembers().find(m => m.id === id);
    if (!targetMember) return;
    if (!adminFilteredMembers().some(m => m.id === id)) {
      adminState.search = '';
      adminState.company = 'all';
      adminState.status = 'all';
      const searchInput = root.querySelector('[data-admin-search]');
      const companySelect = root.querySelector('[data-admin-company]');
      const statusSelect = root.querySelector('[data-admin-status]');
      if (searchInput) searchInput.value = '';
      if (companySelect) companySelect.value = 'all';
      if (statusSelect) statusSelect.value = 'all';
    }
    adminState.selectedMemberId = id;
    adminState.tab = 'performance';
    adminPaint();
    root.querySelector('#admin-selected-member-name')?.focus({ preventScroll: false });
    return;
  }
  if (action === 'member-analysis') {
    void adminOpenMemberAnalysis(id).catch(err => {
      if (err?.code !== 'SESSION_CHANGED' && typeof notify === 'function') notify(err.message);
    });
  }
});
