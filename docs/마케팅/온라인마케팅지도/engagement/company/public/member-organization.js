'use strict';

const organizationBrands = ['LAB', 'SHIFT', 'PULSE', 'PATH'];
let organizationWriteVersion = 0;
let organizationDetailEpoch = 0;
function organizationFoldSearch(value) { return String(value || '').toLowerCase(); }
function organizationNormalizeText(value) { return String(value ?? '').replace(/\r\n?/g, '\n'); }
function organizationSameDraft(a, b) {
  return organizationNormalizeText(a?.jobTitle) === organizationNormalizeText(b?.jobTitle)
    && organizationNormalizeText(a?.responsibilities) === organizationNormalizeText(b?.responsibilities);
}
function organizationReadDraft(form) {
  return {
    jobTitle: String(form?.elements.namedItem('jobTitle')?.value ?? ''),
    responsibilities: String(form?.elements.namedItem('responsibilities')?.value ?? '')
  };
}
function organizationWriteStamp() { return organizationWriteVersion; }
function organizationLockForm(form) {
  const controls = Array.from(form?.elements || []).map(element => [element, element.disabled]);
  for (const [element] of controls) element.disabled = true;
  return () => { for (const [element, disabled] of controls) if (element.isConnected) element.disabled = disabled; };
}
const organizationView = { userId: null, brand: 'all', query: '', team: 'all', status: 'active', incomplete: false };

function organizationSyncIdentity() {
  if (organizationView.userId !== state.user?.id) Object.assign(organizationView, { userId: state.user?.id, brand: 'all', query: '', team: 'all', status: 'active', incomplete: false });
}
function organizationDetails(member) {
  const details = member.organization || {};
  return { brands: organizationBrands.filter(brand => details.brands?.includes(brand)), jobTitle: details.jobTitle || '', responsibilities: details.responsibilities || '', revision: details.revision || null, updatedAt: details.updatedAt || null };
}
function organizationIncomplete(member) {
  const details = organizationDetails(member);
  return !details.brands.length || !details.jobTitle || !details.responsibilities;
}
function organizationTeam(member) { return (state.data.teams || []).find(team => team.id === member.teamId)?.name || '팀 미지정'; }
function organizationIncompleteCount() { return organizationMembers({ ignoreIncomplete: true }).filter(organizationIncomplete).length; }
function organizationMembers({ ignoreIncomplete = false } = {}) {
  const query = organizationFoldSearch(organizationView.query.trim());
  return (state.data.members || []).filter(member => {
    const details = organizationDetails(member), active = member.active !== false;
    return (organizationView.status === 'all' || (organizationView.status === 'active' ? active : !active))
      && (organizationView.brand === 'all' || (organizationView.brand === 'unassigned' ? !details.brands.length : details.brands.includes(organizationView.brand)))
      && (organizationView.team === 'all' || (organizationView.team === 'unassigned' ? !member.teamId : member.teamId === organizationView.team))
      && (ignoreIncomplete || !organizationView.incomplete || organizationIncomplete(member))
      && (!query || organizationFoldSearch([member.name, member.email, organizationTeam(member), details.jobTitle, details.responsibilities, ...details.brands].join(' ')).includes(query));
  }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
}
function organizationButton(label, action, attributes = '', css = '') {
  return `<button type="button" class="btn ${css}" data-org-action="${action}" ${attributes}>${escape(label)}</button>`;
}
function organizationBadges(member) {
  const brands = organizationDetails(member).brands;
  return brands.length ? brands.map(brand => `<span class="org-badge" data-brand="${brand}">${brand}</span>`).join('') : '<span class="org-unset">소속 미지정</span>';
}
function organizationResults() {
  const members = organizationMembers();
  return `<div class="org-results-head"><h2>직원 목록 <span data-org-result-count>${members.length}명</span></h2><span class="org-hint">${isAdmin() ? '업무 정보에서 담당 업무를 확인·수정하세요' : '현재 열람할 수 있는 직원만 표시해요'}</span></div>${members.length ? `<div class="org-table-wrap"><table class="org-table"><thead><tr><th scope="col">직원</th><th scope="col">소속 회사 · 팀</th><th scope="col">업무 역할 · 맡은 일</th><th scope="col">이용 권한 · 상태</th><th scope="col"><span class="org-sr">업무 정보</span></th></tr></thead><tbody>${members.map(member => {
    const details = organizationDetails(member);
    return `<tr><td data-label="직원"><span class="org-person"><span class="org-avatar" aria-hidden="true">${escape(Array.from(member.name || '?')[0])}</span><span><strong>${escape(member.name)}</strong>${member.email ? `<small class="org-email">${escape(member.email)}</small>` : ''}${member.id === state.user.id ? '<small>나</small>' : ''}</span></span></td><td data-label="소속 회사 · 팀"><div class="org-badges">${organizationBadges(member)}</div><small>${escape(organizationTeam(member))}</small></td><td data-label="업무 역할 · 맡은 일"><strong class="${details.jobTitle ? '' : 'org-unset'}">${escape(details.jobTitle || '업무 역할 미입력')}</strong><p class="org-responsibilities ${details.responsibilities ? '' : 'org-unset'}">${escape(details.responsibilities || '맡은 일 미입력')}</p></td><td data-label="이용 권한 · 상태"><span>${escape(roleLabel(member.role))}</span><small>${member.active === false ? '이용 멈춤' : '이용 중'}</small></td><td class="org-row-action">${organizationButton(isAdmin() ? '업무 정보' : '자세히', 'detail', `data-id="${escape(member.id)}" aria-label="${escape(member.name)} ${isAdmin() ? '업무 정보' : '자세히'}"`, 'small')}</td></tr>`;
  }).join('')}</tbody></table></div>` : `<div class="org-empty"><h3>이 조건에 맞는 직원이 없어요</h3><p>검색어, 소속 회사 또는 이용 상태를 바꿔 보세요.</p>${organizationButton('전체 직원 보기', 'reset')}</div>`}`;
}
function organizationTeams() {
  if (!canManageTeam()) return '';
  const teams = state.data.teams || [];
  return `<details class="org-team-management" id="organization-teams"><summary>팀 관리 <span>${teams.length}개 팀</span></summary><p>팀은 함께 일하는 단위예요. 소속 회사와 별도로 관리해요.</p>${isAdmin() ? button('새 팀', 'team-edit', 'plus', 'small') : ''}<div class="org-team-list">${teams.map(team => `<div><span><strong>${escape(team.name)}</strong><small>${team.active === false ? '운영 멈춤' : `직원 ${team.memberCount || 0}명`}</small></span><div>${typeof waFeature!=='function'||waFeature('social') ? button('현황 보기','team-scope','arrow','small quiet',`data-id="${escape(team.id)}"`) : ''}${isAdmin() ? button('팀 수정', 'team-edit', '', 'small quiet', `data-id="${escape(team.id)}"`) : ''}</div></div>`).join('') || '<p class="org-hint">아직 만든 팀이 없어요. 소속 배정은 팀을 만들기 전에도 할 수 있어요.</p>'}</div></details>`;
}
function organizationPage() {
  organizationSyncIdentity();
  const members = state.data.members || [], active = members.filter(member => member.active !== false), incomplete = organizationIncompleteCount();
  const scope = isAdmin() ? '전체' : state.user.role === 'manager' && state.user.teamId ? '우리 팀' : '열람 가능한';
  return `<section class="organization-page"><header class="org-heading"><div><p class="org-eyebrow">PEOPLE & ORGANIZATION</p><h1>사람·조직</h1><p>${scope} 직원 <strong>${active.length}명</strong> · 누가 어떤 회사에서 무엇을 맡는지 확인해요.</p></div><div class="org-heading-actions">${organizationButton('새로고침', 'refresh', '', 'quiet')}${isAdmin() ? `${typeof waInvites==='function'?button('초대 관리','wa-invites','','quiet'):''}${button('직원 초대', 'invite', 'plus', 'primary')}` : ''}</div></header><div class="org-brand-grid" role="group" aria-label="소속 회사로 직원 찾기">${organizationBrands.map(brand => `<button type="button" class="org-brand-card" data-org-action="brand" data-brand="${brand}" aria-pressed="${organizationView.brand === brand}"><span>${brand}</span><strong>${active.filter(member => organizationDetails(member).brands.includes(brand)).length}<small>명</small></strong><span class="org-brand-caption">담당 직원 보기 ${icon('right')}</span></button>`).join('')}</div><p class="org-count-note">이용 중인 직원 기준 · 여러 회사를 맡으면 각각에 표시하며, 전체 인원에는 한 번만 세어요.</p><div class="org-toolbar"><div class="org-brand-filters" role="group" aria-label="직원 범위">${organizationButton('전체', 'brand', `data-brand="all" aria-pressed="${organizationView.brand === 'all'}"`, 'small')}${organizationButton('소속 미지정', 'brand', `data-brand="unassigned" aria-pressed="${organizationView.brand === 'unassigned'}"`, 'small')}${organizationButton(`업무 정보 미완성 ${incomplete}`, 'incomplete', `aria-pressed="${organizationView.incomplete}"`, 'small')}</div><div class="org-filters"><label class="org-search">직원 찾기<input type="search" data-org-filter="query" value="${escape(organizationView.query)}" placeholder="이름, 회사, 팀, 맡은 일" autocomplete="off" maxlength="160"></label><label>팀<select data-org-filter="team"><option value="all" ${organizationView.team === 'all' ? 'selected' : ''}>모든 팀</option><option value="unassigned" ${organizationView.team === 'unassigned' ? 'selected' : ''}>팀 미지정</option>${(state.data.teams || []).map(team => `<option value="${escape(team.id)}" ${organizationView.team === team.id ? 'selected' : ''}>${escape(team.name)}${team.active === false ? ' (운영 멈춤)' : ''}</option>`).join('')}</select></label><label>이용 상태<select data-org-filter="status">${[['active', '이용 중'], ['inactive', '이용 멈춤'], ['all', '전체 상태']].map(([value, label]) => `<option value="${value}" ${organizationView.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div></div><div class="org-live-count org-sr" role="status" aria-live="polite" aria-atomic="true"></div><div class="org-results">${organizationResults()}</div>${organizationTeams()}<footer class="org-footer"><span>내 업무로 이어가기</span>${button('오늘 할 일', 'tab', 'clock', 'small quiet', 'data-tab="home"')}${typeof waViewAllowed!=='function'||waViewAllowed('workroom') ? button('작업실', 'tab', 'bookmark', 'small quiet', 'data-tab="workroom"') : ''}${button('메신저', 'tab', 'chat', 'small quiet', 'data-tab="messenger"')}</footer></section>`;
}
function organizationRefreshResults() {
  const page = document.querySelector('.organization-page');
  if (!page) return;
  page.querySelector('.org-results').innerHTML = organizationResults();
  page.querySelector('.org-live-count').textContent = `${organizationMembers().length}명 표시`;
  page.querySelectorAll('[data-org-action="brand"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.brand === organizationView.brand)));
  const incompleteButton = page.querySelector('[data-org-action="incomplete"]');
  if (incompleteButton) {
    incompleteButton.textContent = `업무 정보 미완성 ${organizationIncompleteCount()}`;
    incompleteButton.setAttribute('aria-pressed', String(organizationView.incomplete));
  }
}
function organizationDetail(userId, { conflict = false, draft = null, base = null, pending = null, auth = null, dirty = false } = {}) {
  const member = (state.data.members || []).find(row => row.id === userId);
  if (!member) { notify('목록이 바뀌었어요. 새로고침한 뒤 직원을 다시 골라 주세요.'); return; }
  organizationDetailEpoch++;
  const details = organizationDetails(member), editable = isAdmin();
  const baseState = base || { jobTitle: details.jobTitle, responsibilities: details.responsibilities, revision: details.revision };
  const currentDraft = draft || { jobTitle: details.jobTitle, responsibilities: details.responsibilities };
  const pendingLatest = editable ? pending : null;
  const conflictBox = pendingLatest ? `<div role="status" class="org-conflict org-read-profile" data-org-conflict><strong>다른 관리자가 바꾼 최신 정보가 있어요. 작성 중인 초안을 유지할지 최신 정보로 바꿀지 골라 주세요.</strong><p>최신 업무 역할 · ${escape(pendingLatest.jobTitle || '미입력')}\n최신 맡은 일 · ${escape(pendingLatest.responsibilities || '미입력')}</p><div class="modal-actions">${organizationButton('작성한 초안 유지', 'keep-draft', `data-id="${escape(member.id)}"`, 'small')}${organizationButton('최신 정보로 바꾸기', 'apply-latest', `data-id="${escape(member.id)}"`, 'small')}</div></div>` : '';
  const accessActions = editable ? `${typeof waMemberModal==='function'?button('회사·직무 정하기','wa-member','','small',`data-id="${escape(member.id)}"`):''}${member.id === state.user.id ? button('내 팀 정하기', 'member-assignment', '', 'small', `data-id="${escape(member.id)}"`) : member.role !== 'admin' ? button('팀·권한 바꾸기', 'member-assignment', '', 'small', `data-id="${escape(member.id)}"`) : ''}${member.id !== state.user.id && member.role !== 'admin' ? `${member.active !== false ? button('비밀번호 재설정 링크', 'member-password-reset', '', 'small quiet', `data-id="${escape(member.id)}"`) : ''}${button(member.active !== false ? '이용 멈추기' : '다시 허용하기', 'member-status', '', 'small quiet', `data-id="${escape(member.id)}"`)}` : ''}` : '';
  const body = `${!pendingLatest && conflict ? '<p role="status" class="org-conflict">최신 업무 정보를 불러왔어요. 내용을 확인하고 다시 수정해 주세요.</p>' : ''}<div class="org-profile-summary">${typeof waMembershipText==='function'?`<span>${escape(waMembershipText(member.workspaceAccess))}</span>`:''}${member.email ? `<span class="org-email">${escape(member.email)}</span>` : ''}<span>${escape(organizationTeam(member))}</span><span>이용 권한 · ${escape(roleLabel(member.role))}</span><span>${member.active === false ? '이용 멈춤' : '이용 중'}</span></div>${editable ? `<form data-org-form data-id="${escape(member.id)}" class="form-stack"><div class="form-error" role="alert"></div>${conflictBox}<div><h3>소속 회사</h3><div class="org-badges">${organizationBadges(member)}</div><p class="org-hint">회사와 회사별 직무는 회사·직무 설정에서 관리해요.</p></div><label class="field">업무 역할<input name="jobTitle" maxlength="80" value="${escape(currentDraft.jobTitle)}" placeholder="예: 한국어 교육, 영상 제작, 고객 운영"></label><label class="field">맡은 일<textarea name="responsibilities" maxlength="600" rows="4" placeholder="담당 업무와 동료가 도움을 요청할 수 있는 일을 적어 주세요">${escape(currentDraft.responsibilities)}</textarea></label><p class="org-hint">업무 역할과 맡은 일만 저장해요. 소속과 이용 권한은 아래에서 관리해요.</p><div class="modal-actions">${organizationButton('최신 정보 다시 읽기', 'reload-detail', `data-id="${escape(member.id)}"`, 'quiet')}<button type="submit" class="btn primary"${pendingLatest ? ' disabled' : ''}>업무 정보 저장</button></div></form>` : `<div class="org-read-profile"><h3>소속 회사</h3><div class="org-badges">${organizationBadges(member)}</div><h3>업무 역할</h3><p>${escape(details.jobTitle || '미입력')}</p><h3>맡은 일</h3><p>${escape(details.responsibilities || '미입력')}</p><p class="org-hint">업무 정보를 바꾸려면 관리자에게 알려 주세요.</p></div>`}${accessActions ? `<details class="org-account-management"><summary>소속·팀·계정 관리</summary><p>팀과 이용 권한을 바꾸면 직원이 다시 로그인해야 할 수 있어요.</p><div>${accessActions}</div></details>` : ''}`;
  modal(escape(member.name) + ' · 업무 정보', '소속 회사와 실제 맡은 일을 함께 확인해요.', body, true);
  const form = overlay.querySelector('[data-org-form]');
  if (form) {
    form.elements.namedItem('jobTitle').value = currentDraft.jobTitle;
    form.elements.namedItem('responsibilities').value = currentDraft.responsibilities;
    form._organizationBase = baseState;
    form._organizationRevision = baseState.revision;
    form._organizationPending = pendingLatest;
    form._organizationDirty = Boolean(dirty);
    form._organizationAuth = auth || companyAuthSnapshot();
  }
}

document.addEventListener('input', event => {
  if (event.target.matches('[data-org-filter="query"]')) { organizationView.query = event.target.value; organizationRefreshResults(); }
  const form = event.target.closest?.('[data-org-form]');
  if (form) form._organizationDirty = true;
});
document.addEventListener('change', event => {
  const filter = event.target.dataset.orgFilter;
  if (['team', 'status'].includes(filter)) { organizationView[filter] = event.target.value; organizationRefreshResults(); }
});
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-org-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.orgAction;
  try {
    if (action === 'brand') { organizationView.brand = target.dataset.brand; organizationRefreshResults(); }
    else if (action === 'incomplete') { organizationView.incomplete = !organizationView.incomplete; organizationRefreshResults(); }
    else if (action === 'reset') { Object.assign(organizationView, { brand: 'all', query: '', team: 'all', status: 'all', incomplete: false }); render(); }
    else if (action === 'detail') organizationDetail(target.dataset.id);
    else if (action === 'keep-draft' || action === 'apply-latest') {
      const form = target.closest('[data-org-form]'), pending = form?._organizationPending;
      if (!form || !pending) return;
      if (!companyAuthCurrent(form._organizationAuth)) throw companyAuthChanged();
      if (action === 'apply-latest') {
        form.elements.namedItem('jobTitle').value = pending.jobTitle;
        form.elements.namedItem('responsibilities').value = pending.responsibilities;
        form._organizationDirty = false;
      } else {
        form._organizationDirty = true;
      }
      form._organizationBase = pending;
      form._organizationRevision = pending.revision;
      form._organizationPending = null;
      form.querySelector('.form-error').textContent = '';
      form.querySelector('[data-org-conflict]')?.remove();
      const submit = form.querySelector('[type="submit"]');
      if (submit) { submit.disabled = false; submit.focus(); }
      notify(action === 'keep-draft' ? '작성한 초안을 유지했어요. 저장하면 반영돼요.' : '최신 업무 정보로 바꿨어요.');
    }
    else if (action === 'refresh') { target.disabled = true; await loadState(); notify('직원 정보를 새로 불러왔어요.'); }
    else if (action === 'reload-detail') {
      const form = target.closest('[data-org-form]');
      if (!form) return;
      const id = form.dataset.id, request = state.modalRequest, epoch = ++organizationDetailEpoch;
      const draft = organizationReadDraft(form), base = form._organizationBase || { ...draft, revision: form._organizationRevision ?? null };
      const hadPending = Boolean(form._organizationPending), dirty = Boolean(form._organizationDirty) || !organizationSameDraft(draft, base);
      const auth = form._organizationAuth, unlock = organizationLockForm(form);
      try {
        if (!companyAuthCurrent(auth)) throw companyAuthChanged();
        await loadState();
        if (!companyAuthCurrent(auth) || epoch !== organizationDetailEpoch || request !== state.modalRequest || !form.isConnected) return;
        const member = (state.data.members || []).find(row => row.id === id);
        if (!member) { notify('목록이 바뀌었어요. 새로고침한 뒤 직원을 다시 골라 주세요.'); return; }
        const latest = organizationDetails(member);
        const nextBase = { jobTitle: latest.jobTitle, responsibilities: latest.responsibilities, revision: latest.revision };
        if (organizationSameDraft(latest, base)) {
          organizationDetail(id, { draft, base: nextBase, auth, dirty });
          notify('최신 업무 정보를 확인했어요.');
        } else if (!hadPending && !dirty) {
          organizationDetail(id, { draft: { jobTitle: latest.jobTitle, responsibilities: latest.responsibilities }, base: nextBase, auth, dirty: false });
          notify('최신 업무 정보를 불러왔어요.');
        } else if (organizationSameDraft(latest, draft)) {
          organizationDetail(id, { draft, base: nextBase, auth, dirty: false });
          notify('최신 업무 정보와 작성한 내용이 같아 그대로 유지했어요.');
        } else {
          organizationDetail(id, { draft, base, pending: nextBase, auth, dirty: true });
        }
      }
      finally { unlock(); }
    }
  } catch (error) { if (error.code !== 'SESSION_CHANGED') notify(error.message); }
  finally { if (target.isConnected) target.disabled = false; }
});
document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-org-form]');
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]'), errorBox = form.querySelector('.form-error');
  if (form._organizationPending) {
    errorBox.textContent = '작성한 초안을 유지할지 최신 정보로 바꿀지 먼저 골라 주세요.';
    return;
  }
  if (submit.disabled) return;
  form._organizationDirty = true;
  const data = new FormData(form), request = state.modalRequest;
  const unlock = organizationLockForm(form);
  errorBox.textContent = '';
  organizationWriteVersion++;
  try {
    if (!companyAuthCurrent(form._organizationAuth)) throw companyAuthChanged();
    const result = await api(`/api/members/${encodeURIComponent(form.dataset.id)}/organization`, { jobTitle: data.get('jobTitle'), responsibilities: data.get('responsibilities'), expectedRevision: form._organizationRevision });
    if (!companyAuthCurrent(form._organizationAuth)) return;
    form._organizationRevision = result.organization.revision;
    form._organizationBase = { jobTitle: result.organization.jobTitle || '', responsibilities: result.organization.responsibilities || '', revision: result.organization.revision };
    form._organizationDirty = false;
    // A delayed write response may already be superseded by another administrator.
    // Refresh canonical state after the write; never apply that response to the directory.
    organizationWriteVersion++;
    await loadState();
    if (request === state.modalRequest && form.isConnected) closeModal();
    notify('업무 정보를 저장했어요.');
  } catch (error) {
    if (error.code !== 'SESSION_CHANGED' && form.isConnected) errorBox.textContent = error.message;
  } finally {
    organizationWriteVersion++;
    unlock();
  }
});
