'use strict';

// 관리자 화면의 「반」 · 「이용 권한」 칸, 맨 위 「최근 부여」, 관리자 올리기 · 내리기(관리자 직접부여 설계 5절).
// 서버 계약은 회사 서버 /api/admin/synk-grants(중앙 synk-account로 넘김)와 /api/members/:id/admin-role이다.
// 두 칸은 관리자가 SYNK ID로 로그인했을 때만 보인다. 쓰기는 확인 창을 거치고, 확인 창을 열 때 만든 requestId를 다시 보낼 때도 그대로 쓴다.

const GRANTS_MODES = ['classes', 'entitlements'];
const GRANTS_PAGE_SIZE = 25;
const GRANTS_RESTORE_KEY = 'synk.admin.grants.pending';
const GRANTS_RESTORE_MS = 10 * 60 * 1000;
const GRANTS_OP_LABELS = {
  'class.create': '반 만들기', 'class.setActive': '반 켜고 끄기', 'learner.add': '학생 넣기', 'learner.remove': '학생 빼기',
  'teacher.add': '선생님 넣기', 'teacher.remove': '선생님 빼기', 'entitlement.grant': '이용 권한 주기', 'entitlement.revoke': '이용 권한 거두기',
  'classes.list': '반 목록 보기', 'class.people': '반 사람 보기', 'entitlements.list': '이용 권한 보기', 'audit.list': '최근 부여 보기'
};
// 중앙 쓰기 응답의 change(무엇이 바뀌었나)를 확인 뒤 알림 글로 바꾼다. outcome duplicate는 「이미 되어 있었어요」다.
const GRANTS_CHANGES = {
  'learner.add': { created: '학생을 새 명부 줄로 이 반에 넣었어요.', linked: '빈 명부 줄에 SYNK ID를 이었어요.', reactivated: '학생을 이 반에 다시 넣었어요.', moved: '학생을 이 반으로 옮겼어요.', assigned: '학생을 이 반에 넣었어요. 반 없이 남아 있던 이 학생의 명부 줄과 학생 번호를 그대로 썼어요.' },
  'learner.remove': { removed: '학생을 이 반에서 뺐어요.' },
  'teacher.add': { created: '선생님을 이 반에 넣었어요. 직원(교사) 줄을 새로 만들었어요.', reopened: '선생님을 이 반에 넣었어요. 이 도구가 닫았던 직원 줄을 다시 켰어요.', assigned: '선생님을 이 반에 넣었어요.' },
  'teacher.remove': { unassigned: '선생님을 이 반에서 뺐어요.', closed: '선생님을 이 반에서 뺐어요. 맡은 반이 없어 직원(교사) 자격도 닫았어요.' },
  'entitlement.grant': { granted: '이용 권한을 줬어요.' },
  'entitlement.revoke': { revoked: '이용 권한을 거뒀어요.' }
};
const GRANTS_AUDIT_OUTCOMES = { applied: '했어요', duplicate: '이미 되어 있었어요', rejected: '거절됐어요' };
const GRANTS_SOURCES = { 'workspace-admin': '관리자 화면', manual: '운영', billing: '결제', payment: '결제', 'learning-check': '학습 확인' };
const GRANTS_FORBIDDEN_TEXT = '이 SYNK ID에는 반과 이용 권한을 관리할 권한이 없어요.';
const GRANTS_STAFF_FORBIDDEN_TEXT = '이 SYNK ID에는 선생님을 넣고 빼는 권한이 없어요.';
// 쓰기가 중앙에 닿았는지 모르는 실패(회사 서버의 503 GRANTS_UNAVAILABLE, 연결 끊김). 같은 요청 번호로만 다시 묻는다.
const GRANTS_UNCERTAIN_TEXT = '결과를 확인하지 못했어요. 이미 반영됐을 수도 있어요. 「다시 확인」을 누르면 같은 요청으로 결과를 확인해요.';
const GRANTS_LOCKING_CODES = ['REAUTH_REQUIRED', 'REQUEST_CONFLICT', 'GRANTS_FORBIDDEN', 'SYNK_LOGIN_REQUIRED'];

function newAdminGrantsState() {
  return {
    forbidden: false, forbiddenText: '', staffForbidden: false,
    audit: { rows: null, error: '', busy: false, seq: 0 },
    classes: { q: '', active: 'all', page: 1, data: null, error: '', busy: false, seq: 0 },
    classId: '', people: { data: null, error: '', busy: false, seq: 0 },
    person: null, ents: { data: null, choices: [], viewOnly: [], error: '', busy: false, seq: 0 },
    pending: null, picker: null
  };
}
let adminGrants = newAdminGrantsState();
function resetAdminGrants() { adminGrants = newAdminGrantsState(); }

function adminGrantsVisible() {
  return Boolean(typeof state !== 'undefined' && state.synkUserId && typeof adminCanUse === 'function' && adminCanUse());
}
function adminGrantsMode(mode) { return GRANTS_MODES.includes(mode); }
function grantsStamp() { return typeof companyAuthSnapshot === 'function' ? companyAuthSnapshot() : { userId: state.user?.id || null }; }
function grantsCurrent(stamp) { return typeof companyAuthCurrent === 'function' ? companyAuthCurrent(stamp) : state.user?.id === stamp.userId; }
function grantsShortId(value) { return typeof value === 'string' && value ? value.slice(0, 8) : ''; }
function grantsDate(value) { return value ? adminFormatDateTime(value) : '없음'; }
function grantsRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function grantsCall(body, options = {}) { return api('/api/admin/synk-grants', body, 'POST', options); }
function grantsClassName(row) { return row?.displayName || row?.classKey || '이름 없는 반'; }
function grantsSelectedClass() {
  const fromPeople = adminGrants.people.data?.class;
  if (fromPeople && fromPeople.id === adminGrants.classId) return fromPeople;
  return (adminGrants.classes.data?.rows || []).find(row => row.id === adminGrants.classId) || null;
}
// 중앙은 교사 열람권(admin.workspace-staff)을 따로 알려 주지 않는다. 교사 op가 GRANTS_FORBIDDEN이면 그때부터 교사 단추를 숨기고 안내한다.
function grantsCanStaff() { return !adminGrants.staffForbidden; }

// 중앙이 이 SYNK ID를 거절하면 단추를 모두 숨긴다. 교사 op의 거절은 교사 단추만 숨긴다.
function grantsNoteForbidden(err, op = '') {
  if (!err || err.status !== 403 || !['GRANTS_FORBIDDEN', 'SYNK_LOGIN_REQUIRED'].includes(err.code)) return false;
  if (err.code === 'GRANTS_FORBIDDEN' && /^teacher\./.test(op)) { adminGrants.staffForbidden = true; return true; }
  adminGrants.forbidden = true;
  adminGrants.forbiddenText = err.code === 'SYNK_LOGIN_REQUIRED' ? '반과 이용 권한은 SYNK ID로 로그인했을 때만 관리할 수 있어요.' : GRANTS_FORBIDDEN_TEXT;
  return true;
}

/* 맨 위 「최근 부여」 */
function adminGrantsAuditMarkup() {
  if (!adminGrantsVisible()) return '';
  const a = adminGrants.audit;
  let body;
  if (adminGrants.forbidden) body = `<p class="grants-feedback">${escape(adminGrants.forbiddenText || GRANTS_FORBIDDEN_TEXT)}</p>`;
  else if (a.error) body = `<p class="grants-feedback" role="alert">${escape(a.error)} <button type="button" class="btn small" data-grants-action="audit-refresh">다시 읽기</button></p>`;
  else if (a.busy || !a.rows) body = '<p class="grants-feedback" role="status">최근 부여를 불러오는 중이에요.</p>';
  else if (!a.rows.length) body = '<p class="grants-feedback">지난 7일 동안 반과 이용 권한에서 한 일이 없어요.</p>';
  else {
    const item = row => {
      const ok = row.outcome !== 'rejected';
      const targets = [row.targetSynkUserId && `사람 ${grantsShortId(row.targetSynkUserId)}`, row.classId && `반 ${grantsShortId(row.classId)}`, row.entitlementRef && row.entitlementRef.split('.').slice(1).join('.')].filter(Boolean).join(' · ');
      return `<li class="grants-audit-row"><time datetime="${escape(row.at)}">${escape(adminFormatDateTime(row.at))}</time><strong>${escape(GRANTS_OP_LABELS[row.op] || row.op)}</strong><span class="grants-outcome ${ok ? 'is-ok' : 'is-denied'}">${escape(GRANTS_AUDIT_OUTCOMES[row.outcome] || '했어요')}</span>${targets ? `<small>${escape(targets)}</small>` : ''}</li>`;
    };
    const first = a.rows.slice(0, 6), rest = a.rows.slice(6);
    body = `<ol class="grants-audit-list">${first.map(item).join('')}</ol>${rest.length ? `<details class="grants-audit-more"><summary>${number(rest.length)}건 더 보기</summary><ol class="grants-audit-list">${rest.map(item).join('')}</ol></details>` : ''}`;
  }
  return `<section class="grants-audit" aria-labelledby="grants-audit-title">
    <div class="grants-audit-head"><div><h2 id="grants-audit-title">최근 부여</h2><p>지난 7일 동안 반과 이용 권한에서 한 일과 거절된 일이에요. SYNK ID 서버의 기록에서 읽어요.</p></div>
    ${adminGrants.forbidden ? '' : '<button type="button" class="btn small quiet" data-grants-action="audit-refresh">새로 읽기</button>'}</div>${body}</section>`;
}
function grantsPaintAudit() {
  const element = document.querySelector('.admin-workspace [data-grants-audit]');
  if (element) element.innerHTML = adminGrantsAuditMarkup();
}
async function adminGrantsLoadAudit() {
  if (!adminGrantsVisible() || adminGrants.forbidden) return;
  const a = adminGrants.audit, seq = ++a.seq, stamp = grantsStamp();
  a.busy = true; a.error = ''; grantsPaintAudit();
  try {
    const result = await grantsCall({ op: 'audit.list', days: 7 });
    if (seq !== a.seq || !grantsCurrent(stamp)) return;
    a.rows = result.rows;
  } catch (err) {
    if (seq !== a.seq || !grantsCurrent(stamp) || err?.code === 'SESSION_CHANGED') return;
    if (!grantsNoteForbidden(err)) a.error = err?.message || '최근 부여를 불러오지 못했어요.';
  } finally {
    if (seq === a.seq) { a.busy = false; grantsPaintAudit(); if (adminGrants.forbidden) grantsPaintPanel(); }
  }
}

/* 「반」 칸 */
function grantsClassesListMarkup() {
  const c = adminGrants.classes;
  if (c.error) return `<p class="grants-feedback" role="alert">${escape(c.error)} <button type="button" class="btn small" data-grants-action="classes-retry">다시 시도</button></p>`;
  if (c.busy || !c.data) return '<p class="grants-feedback" role="status">반 목록을 불러오는 중이에요.</p>';
  const { rows, total, page } = c.data, pages = Math.max(1, Math.ceil(total / GRANTS_PAGE_SIZE));
  if (!rows.length) return '<p class="grants-feedback">조건에 맞는 반이 없어요.</p>';
  return `<p class="directory-total" role="status">반 <strong>${adminInt(total)}개</strong></p>
    <div class="admin-table-wrap"><table class="admin-table grants-table"><thead><tr><th scope="col">반</th><th scope="col">상태</th><th scope="col">선생님</th><th scope="col">학생</th><th scope="col">빈 명부 줄</th><th scope="col"><span class="admin-sr">열기</span></th></tr></thead>
    <tbody>${rows.map(row => `<tr class="${row.id === adminGrants.classId ? 'is-selected' : ''}">
      <td data-label="반"><strong>${escape(grantsClassName(row))}</strong><small class="grants-sub">${escape(row.classKey)}</small></td>
      <td data-label="상태"><span class="admin-chip ${row.active ? 'active' : 'stopped'}">${row.active ? '켜짐' : '꺼짐'}</span>${row.test ? ' <span class="admin-chip">시험 반</span>' : ''}</td>
      <td data-label="선생님">${adminInt(row.teachers)}명</td>
      <td data-label="학생">${adminInt(row.learners)}명</td>
      <td data-label="빈 명부 줄">${adminInt(row.openRows)}줄</td>
      <td data-label="열기"><button type="button" class="btn small" data-grants-action="class-open" data-class-id="${escape(row.id)}" aria-label="${escape(grantsClassName(row))} 사람 보기">사람 보기</button></td></tr>`).join('')}</tbody></table></div>
    ${pages > 1 || page > 1 ? `<nav class="directory-paging" aria-label="반 목록 페이지"><button type="button" class="btn small" data-grants-action="classes-page" data-step="-1" ${page <= 1 ? 'disabled' : ''}>이전</button><span>${adminInt(page)} / ${adminInt(pages)}</span><button type="button" class="btn small" data-grants-action="classes-page" data-step="1" ${page >= pages ? 'disabled' : ''}>다음</button></nav>` : ''}`;
}
function grantsClassDetailMarkup() {
  if (!adminGrants.classId) return '';
  const p = adminGrants.people, cls = grantsSelectedClass();
  const heading = `<div class="grants-detail-head"><div><h3 tabindex="-1" id="grants-class-title">${escape(grantsClassName(cls))}</h3><p>${cls ? `${escape(cls.classKey)} · ${cls.active ? '켜진 반' : '꺼진 반'}${cls.test ? ' · 시험 반' : ''}` : '반 정보를 불러오는 중이에요.'}</p></div>
    ${cls ? `<div class="admin-row-actions">${cls.active ? `<button type="button" class="btn small primary" data-grants-action="learner-add">학생 넣기</button>${grantsCanStaff() ? '<button type="button" class="btn small" data-grants-action="teacher-add">선생님 넣기</button>' : ''}` : ''}<button type="button" class="btn small quiet" data-grants-action="class-toggle">${cls.active ? '반 끄기' : '반 다시 켜기'}</button></div>` : ''}</div>`;
  if (p.error) return `${heading}<p class="grants-feedback" role="alert">${escape(p.error)} <button type="button" class="btn small" data-grants-action="people-retry">다시 시도</button></p>`;
  if (p.busy || !p.data) return `${heading}<p class="grants-feedback" role="status">반 사람을 불러오는 중이에요.</p>`;
  const teachers = p.data.teachers, learners = [...p.data.learners].sort((a, b) => Number(b.active) - Number(a.active) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  const teacherRows = teachers.length ? `<div class="admin-table-wrap"><table class="admin-table grants-table"><thead><tr><th scope="col">선생님</th><th scope="col">자격</th><th scope="col"><span class="admin-sr">관리</span></th></tr></thead><tbody>${teachers.map(row => `<tr>
      <td data-label="선생님"><strong>${escape(row.name || '이름 미등록')}</strong>${row.synkUserId ? `<small class="grants-sub">SYNK ID ${escape(row.synkUserId)}</small>` : ''}</td>
      <td data-label="자격">${escape(row.role === 'director' ? '원장' : row.role === 'inspector' ? '검수자' : '교사')}${row.active ? '' : ' <span class="admin-chip stopped">닫힘</span>'}</td>
      <td data-label="관리">${grantsCanStaff() ? `<button type="button" class="btn small quiet" data-grants-action="teacher-remove" data-staff-id="${escape(row.staffId)}">빼기</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="grants-feedback">아직 이 반에 선생님이 없어요.</p>';
  // 잇기와 다시 넣기는 중앙 learner.add라 꺼진 반에서는 CLASS_INACTIVE로 거절된다. 빼기는 꺼진 반에서도 된다.
  const learnerAction = row => {
    if (!cls?.active && !(row.linked && row.active)) return '';
    if (!row.linked && row.active) return `<button type="button" class="btn small" data-grants-action="learner-link" data-learner-id="${escape(row.learnerId)}">SYNK ID 잇기</button>`;
    if (row.linked && row.active) return `<button type="button" class="btn small quiet" data-grants-action="learner-remove" data-learner-id="${escape(row.learnerId)}">빼기</button>`;
    if (row.synkUserId) return `<button type="button" class="btn small quiet" data-grants-action="learner-readd" data-learner-id="${escape(row.learnerId)}">다시 넣기</button>`;
    return '';
  };
  const learnerRows = learners.length ? `<div class="admin-table-wrap"><table class="admin-table grants-table"><thead><tr><th scope="col">학생</th><th scope="col">학생 번호</th><th scope="col">상태</th><th scope="col"><span class="admin-sr">관리</span></th></tr></thead><tbody>${learners.map(row => `<tr>
      <td data-label="학생"><strong>${escape(row.name || (row.linked ? '이름 미등록' : '빈 명부 줄'))}</strong>${row.synkUserId ? `<small class="grants-sub">SYNK ID ${escape(row.synkUserId)}</small>` : row.linked ? '<small class="grants-sub">SYNK ID를 확인하지 못한 로그인 계정이에요</small>' : '<small class="grants-sub">아직 SYNK ID가 이어지지 않았어요</small>'}${row.test ? ' <span class="admin-chip">시험</span>' : ''}</td>
      <td data-label="학생 번호">${escape(row.studentCode || '없음')}</td>
      <td data-label="상태"><span class="admin-chip ${row.active ? 'active' : 'stopped'}">${row.active ? '이 반에 있음' : '빠짐'}</span></td>
      <td data-label="관리">${learnerAction(row)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="grants-feedback">아직 이 반에 학생이 없어요.</p>';
  const staffNote = adminGrants.staffForbidden ? `<p class="grants-note" role="status">${GRANTS_STAFF_FORBIDDEN_TEXT}</p>` : '';
  return `${heading}<h4 class="grants-subhead">선생님 ${adminInt(teachers.filter(row => row.active).length)}명</h4>${staffNote}${teacherRows}<h4 class="grants-subhead">학생 ${adminInt(learners.filter(row => row.active).length)}명</h4>${learnerRows}
    <p class="grants-note">학습 기록, 제출물, 녹음은 이 화면에서 보지 않아요.</p>`;
}
function grantsClassesPanelMarkup() {
  const c = adminGrants.classes;
  return `<div class="directory-heading"><h2>반</h2><p>반을 만들고 끄고, 학생과 선생님을 반 연결 코드 없이 넣고 빼요.</p></div>
    <div class="grants-toolbar"><form data-grants-form="class-search" class="directory-form" aria-label="반 찾기">
      <label class="directory-query"><span>반 이름 또는 키</span><input name="q" type="search" maxlength="160" autocomplete="off" value="${escape(c.q)}" placeholder="반 이름, 반 키"></label>
      <label><span>상태</span><select name="active">${directoryOptions([['all', '모든 반'], ['active', '켜진 반'], ['inactive', '꺼진 반']], c.active)}</select></label>
      <button type="submit" class="btn primary">찾기</button></form>
      <button type="button" class="btn small" data-grants-action="class-create">${typeof icon === 'function' ? icon('plus') : ''}반 만들기</button></div>
    <div data-grants-classes>${grantsClassesListMarkup()}</div>
    <section class="grants-detail" data-grants-class-detail aria-live="polite" ${adminGrants.classId ? '' : 'hidden'}>${grantsClassDetailMarkup()}</section>`;
}

/* 「이용 권한」 칸 */
function grantsChoiceLabel(product, capability) {
  const choice = [...adminGrants.ents.choices, ...adminGrants.ents.viewOnly].find(row => row.product === product && row.capability === capability);
  return choice ? choice.label : `${product} · ${capability}`;
}
// 거둘 수 없는 줄의 까닭. 마을 체험처럼 이 도구가 다루지 않는 권한은 서버가 준 까닭을 쓴다.
function grantsNotEditableReason(row) {
  const viewOnly = adminGrants.ents.viewOnly.find(item => item.product === row.product && item.capability === row.capability);
  return viewOnly?.reason || (row.revokedAt ? '' : '여기서 거둘 수 없어요');
}
function grantsPersonMarkup(person) {
  if (!person) return '';
  return `<dl class="grants-person"><div><dt>이름</dt><dd>${escape(person.name || '이름 미등록')}</dd></div><div><dt>로그인 이메일</dt><dd>${escape(person.loginId || '없음')}</dd></div><div><dt>가입일</dt><dd>${escape(person.createdAt ? adminFormatDateTime(person.createdAt) : '확인 전')}</dd></div><div><dt>SYNK ID</dt><dd>${escape(person.id)}</dd></div></dl>`;
}
function grantsEntsListMarkup() {
  const e = adminGrants.ents;
  if (!adminGrants.person) return '<p class="grants-feedback">먼저 사람을 골라 주세요. 「전체 SYNK ID」 목록의 「이용 권한」 단추로도 올 수 있어요.</p>';
  if (e.error) return `<p class="grants-feedback" role="alert">${escape(e.error)} <button type="button" class="btn small" data-grants-action="ents-retry">다시 시도</button></p>`;
  if (e.busy || !e.data) return '<p class="grants-feedback" role="status">이용 권한을 불러오는 중이에요.</p>';
  const rows = e.data.rows;
  const now = Date.now();
  const status = row => row.active ? '쓰는 중' : row.revokedAt ? '거둠' : row.validUntil && Date.parse(row.validUntil) <= now ? '기한 지남' : '시작 전';
  const table = rows.length ? `<div class="admin-table-wrap"><table class="admin-table grants-table"><thead><tr><th scope="col">권한</th><th scope="col">출처</th><th scope="col">기한</th><th scope="col">상태</th><th scope="col"><span class="admin-sr">관리</span></th></tr></thead><tbody>${rows.map(row => {
      const editable = row.editable && !row.revokedAt && !adminGrants.ents.viewOnly.some(item => item.product === row.product && item.capability === row.capability);
      return `<tr><td data-label="권한"><strong>${escape(grantsChoiceLabel(row.product, row.capability))}</strong><small class="grants-sub">${escape(row.product)}.${escape(row.capability)}</small></td>
        <td data-label="출처">${escape(GRANTS_SOURCES[row.source] || row.source)}</td>
        <td data-label="기한">${row.validUntil ? escape(adminFormatDateTime(row.validUntil)) + '까지' : '기한 없음'}</td>
        <td data-label="상태">${escape(status(row))}</td>
        <td data-label="관리">${editable ? `<button type="button" class="btn small quiet" data-grants-action="ent-revoke" data-product="${escape(row.product)}" data-capability="${escape(row.capability)}">거두기</button>` : `<span class="grants-sub">${escape(grantsNotEditableReason(row))}</span>`}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="grants-feedback">이 사람에게 아직 이용 권한이 없어요.</p>';
  return `${table}<p class="grants-note">관리자 화면에서 준 권한만 여기서 거둘 수 있어요. 결제, 학습 확인, 운영에서 준 권한은 보기만 해요.</p>`;
}
function grantsEntsPanelMarkup() {
  return `<div class="directory-heading"><h2>이용 권한</h2><p>사람을 고르면 그 사람의 이용 권한과 출처, 기한이 나와요.</p></div>
    <div class="grants-toolbar"><button type="button" class="btn small primary" data-grants-action="ents-pick">${adminGrants.person ? '다른 사람 고르기' : '사람 고르기'}</button>
    ${adminGrants.person ? '<button type="button" class="btn small" data-grants-action="ent-grant">권한 주기</button>' : ''}</div>
    ${grantsPersonMarkup(adminGrants.person)}<div data-grants-ents>${grantsEntsListMarkup()}</div>`;
}

function adminGrantsPanelMarkup(mode) {
  if (!adminGrantsVisible()) return '<p class="grants-feedback">반과 이용 권한은 관리자가 SYNK ID로 로그인했을 때만 관리할 수 있어요.</p>';
  if (adminGrants.forbidden) return `<div class="directory-heading"><h2>${mode === 'classes' ? '반' : '이용 권한'}</h2></div><p class="grants-feedback" role="alert">${escape(adminGrants.forbiddenText || GRANTS_FORBIDDEN_TEXT)}</p>`;
  return mode === 'classes' ? grantsClassesPanelMarkup() : grantsEntsPanelMarkup();
}
function grantsPaintPanel() {
  const body = document.querySelector('.admin-workspace [data-directory-body]');
  if (!body || !adminGrantsMode(memberDirectory.mode)) return;
  const pieces = memberDirectory.mode === 'classes'
    ? [['[data-grants-classes]', grantsClassesListMarkup], ['[data-grants-class-detail]', grantsClassDetailMarkup]]
    : [['[data-grants-ents]', grantsEntsListMarkup]];
  if (adminGrants.forbidden || pieces.some(([selector]) => !body.querySelector(selector))) { body.innerHTML = adminGrantsPanelMarkup(memberDirectory.mode); return; }
  for (const [selector, markup] of pieces) {
    const element = body.querySelector(selector), active = document.activeElement;
    // 반 자세히 칸을 다시 그리면 그 안의 초점(「사람 보기」로 옮긴 반 이름 포함)이 사라진다. 새 반 이름으로 되돌린다.
    const keepFocus = selector === '[data-grants-class-detail]' && active && active !== document.body && element.contains(active);
    element.innerHTML = markup();
    if (selector === '[data-grants-class-detail]') element.hidden = !adminGrants.classId;
    if (keepFocus) element.querySelector('#grants-class-title')?.focus({ preventScroll: true });
  }
}
function grantsRepaintEnts() {
  const body = document.querySelector('.admin-workspace [data-directory-body]');
  if (body && memberDirectory.mode === 'entitlements') body.innerHTML = adminGrantsPanelMarkup('entitlements');
}

async function grantsLoadClasses() {
  const c = adminGrants.classes, seq = ++c.seq, stamp = grantsStamp();
  c.busy = true; c.error = ''; grantsPaintPanel();
  try {
    const result = await grantsCall({ op: 'classes.list', q: c.q, active: c.active, page: c.page });
    if (seq !== c.seq || !grantsCurrent(stamp)) return;
    if (result.total > 0 && !result.rows.length && c.page > 1) { c.page = Math.max(1, Math.ceil(result.total / GRANTS_PAGE_SIZE)); c.busy = false; return grantsLoadClasses(); }
    c.data = result;
  } catch (err) {
    if (seq !== c.seq || !grantsCurrent(stamp) || err?.code === 'SESSION_CHANGED') return;
    if (!grantsNoteForbidden(err)) c.error = err?.message || '반 목록을 불러오지 못했어요.';
  } finally {
    if (seq === c.seq) { c.busy = false; grantsPaintPanel(); }
  }
}
async function grantsLoadPeople() {
  if (!adminGrants.classId) return;
  const p = adminGrants.people, seq = ++p.seq, stamp = grantsStamp(), classId = adminGrants.classId;
  p.busy = true; p.error = ''; grantsPaintPanel();
  try {
    const result = await grantsCall({ op: 'class.people', classId });
    if (seq !== p.seq || !grantsCurrent(stamp) || classId !== adminGrants.classId) return;
    p.data = result;
  } catch (err) {
    if (seq !== p.seq || !grantsCurrent(stamp) || err?.code === 'SESSION_CHANGED') return;
    if (!grantsNoteForbidden(err)) p.error = err?.message || '반 사람을 불러오지 못했어요.';
  } finally {
    if (seq === p.seq) { p.busy = false; grantsPaintPanel(); }
  }
}
async function grantsLoadEnts() {
  if (!adminGrants.person) return;
  const e = adminGrants.ents, seq = ++e.seq, stamp = grantsStamp(), synkUserId = adminGrants.person.id;
  e.busy = true; e.error = ''; grantsPaintPanel();
  try {
    const result = await grantsCall({ op: 'entitlements.list', synkUserId });
    if (seq !== e.seq || !grantsCurrent(stamp) || adminGrants.person?.id !== synkUserId) return;
    e.data = result; if (Array.isArray(result.choices)) e.choices = result.choices; if (Array.isArray(result.viewOnly)) e.viewOnly = result.viewOnly;
  } catch (err) {
    if (seq !== e.seq || !grantsCurrent(stamp) || err?.code === 'SESSION_CHANGED') return;
    if (!grantsNoteForbidden(err)) e.error = err?.message || '이용 권한을 불러오지 못했어요.';
  } finally {
    if (seq === e.seq) { e.busy = false; grantsPaintPanel(); }
  }
}
// 칸을 열거나 다시 그릴 때 부른다.
function adminGrantsLoad(mode = memberDirectory.mode) {
  if (!adminGrantsVisible() || adminGrants.forbidden) return;
  if (mode === 'classes') { void grantsLoadClasses(); if (adminGrants.classId) void grantsLoadPeople(); }
  if (mode === 'entitlements' && adminGrants.person) void grantsLoadEnts();
}
function adminGrantsRefresh() {
  void adminGrantsLoadAudit();
  if (adminGrantsMode(memberDirectory.mode)) adminGrantsLoad(memberDirectory.mode);
}

/* 사람 고르기: 「전체 SYNK ID」 검색을 고르기 창 안에서 다시 쓴다. SYNK ID를 직접 쳐서 넣는 칸은 두지 않는다. */
function grantsPickerResults() {
  const k = adminGrants.picker;
  if (!k) return '';
  if (k.error) return `<p class="grants-feedback" role="alert">${escape(k.error)}</p>`;
  if (k.busy) return '<p class="grants-feedback" role="status">찾는 중이에요.</p>';
  if (!k.data) return '<p class="grants-feedback">이름, 로그인 이메일, 회원 ID로 찾아요.</p>';
  if (!k.data.rows.length) return '<p class="grants-feedback">조건에 맞는 SYNK ID가 없어요.</p>';
  return `<p class="grants-feedback" role="status">${adminInt(k.data.total)}명 찾았어요${k.data.total > k.data.rows.length ? `. 앞의 ${adminInt(k.data.rows.length)}명만 보여요. 더 좁혀 찾아 주세요` : ''}.</p>
    <ul class="grants-pick-list">${k.data.rows.map((row, index) => `<li><div><strong>${escape(row.name || '이름 미등록')}</strong><span>${escape(row.loginId || '로그인 이메일 없음')}</span><small>가입 ${escape(adminFormatDateTime(row.createdAt))} · ${escape(directoryStatuses[row.status] || row.status)}</small></div>
      ${row.status === 'active' ? `<button type="button" class="btn small primary" data-grants-action="pick" data-index="${index}">고르기</button>` : '<span class="grants-sub">이용 중인 SYNK ID만 고를 수 있어요</span>'}</li>`).join('')}</ul>`;
}
function grantsOpenPicker(title, onPick) {
  adminGrants.picker = { title, q: '', data: null, error: '', busy: false, seq: 0, onPick };
  modal(escape(title), '전체 SYNK ID에서 찾아요', `<form data-grants-form="pick-search" class="grants-pick-form"><label class="field"><span>이름, 로그인 이메일 또는 회원 ID</span><input name="q" type="search" maxlength="160" autocomplete="off" required></label><button type="submit" class="btn primary">찾기</button></form>
    <div data-grants-pick-results>${grantsPickerResults()}</div><div class="modal-actions"><button type="button" class="btn quiet" data-action="close-modal">닫기</button></div>`);
}
async function grantsPickerSearch(q) {
  const k = adminGrants.picker; if (!k) return;
  const seq = ++k.seq, stamp = grantsStamp();
  k.q = q; k.busy = true; k.error = '';
  const paint = () => { const element = document.querySelector('[data-grants-pick-results]'); if (element) element.innerHTML = grantsPickerResults(); };
  paint();
  try {
    const result = await api('/api/admin/member-directory/synk', { q, page: 1, status: 'all' });
    if (adminGrants.picker !== k || seq !== k.seq || !grantsCurrent(stamp)) return;
    k.data = result;
  } catch (err) {
    if (adminGrants.picker !== k || seq !== k.seq || !grantsCurrent(stamp)) return;
    k.error = err?.status === 403 ? '전체 SYNK ID 명부를 볼 권한이 없어요. 계정 메뉴에서 로그인한 SYNK ID를 확인해 주세요.' : (err?.message || '찾지 못했어요.');
  } finally {
    if (adminGrants.picker === k && seq === k.seq) { k.busy = false; paint(); }
  }
}

/* 확인 창. pending은 데이터만 담는다(다시 확인 뒤 sessionStorage로 되살린다). */
function grantsOpenConfirm(pending) {
  adminGrants.pending = { busy: false, error: '', code: null, details: null, values: {}, ...pending, requestId: pending.requestId || grantsRequestId() };
  grantsRenderConfirm();
  void grantsCheckReauth(adminGrants.pending);
}
async function grantsCheckReauth(pending) {
  try {
    const response = await fetch('/api/synk-id/status', { credentials: 'same-origin' });
    const status = await response.json();
    if (adminGrants.pending !== pending || pending.busy || pending.code) return;
    if (status?.reauthNeeded === true) { pending.code = 'REAUTH_REQUIRED'; pending.error = '15분 안에 SYNK ID로 다시 로그인해야 이 일을 할 수 있어요.'; grantsRenderConfirm(); }
  } catch { /* 서버가 쓰기 때 다시 본다. */ }
}
// 「권한 주기」 확인 창은 열 때의 줄 권한 목록을 pending에 담는다. 다시 확인하고 돌아와 목록을 아직 못 읽었어도 같은 창을 그린다.
function grantsPendingChoices(p) { return Array.isArray(p?.choices) ? p.choices : adminGrants.ents.choices; }
function grantsValidChoices(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every(row => row && typeof row.product === 'string' && typeof row.capability === 'string' && typeof row.label === 'string' && ['optional', 'required'].includes(row.expiry));
}
function grantsLocked(p) { return Boolean(p.busy || GRANTS_LOCKING_CODES.includes(p.code)); }
function grantsFieldsMarkup(p) {
  const v = p.values || {};
  if (p.fields === 'class-create') return `<label class="field"><span>반 이름</span><input name="displayName" maxlength="80" required value="${escape(v.displayName || '')}" placeholder="예: TOPIK 4급 저녁반"></label>
    <label class="field"><span>반 키 (영문 소문자, 숫자, 하이픈 60자까지. 첫 글자는 영문 소문자나 숫자)</span><input name="classKey" maxlength="60" required pattern="[a-z0-9][a-z0-9\\-]{0,59}" value="${escape(v.classKey || '')}" placeholder="예: topik4-evening"></label>
    <label class="grants-check"><input type="checkbox" name="test" ${v.test ? 'checked' : ''}><span>시험 반이에요. 시험 반의 키는 test-로 시작해야 해요.</span></label>`;
  if (p.fields === 'ent-grant') {
    const choices = grantsPendingChoices(p);
    return `<label class="field"><span>줄 권한</span><select name="choice" required>${choices.map((row, index) => `<option value="${index}" ${String(v.choice) === String(index) ? 'selected' : ''}>${escape(row.label)}</option>`).join('')}</select></label>
      <label class="field"><span>기한 (그날 밤 12시까지)</span><input name="validUntil" type="date" value="${escape(v.validUntil || '')}"></label>
      <p class="grants-note">WORLD 권한은 기한을 꼭 정하고 6개월 안이어야 해요. 서재 메뉴 권한은 기한을 비우면 기한 없이 줘요.</p>`;
  }
  if (p.fields === 'demote') {
    const teams = (state.data?.teams || []).filter(team => team.active !== false);
    return `<label class="field"><span>바꿀 역할</span><select name="role" required>${[['manager', '팀장'], ['member', '실무자'], ['viewer', '보기 전용']].map(([key, label]) => `<option value="${key}" ${v.role === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="field"><span>소속 팀</span><select name="teamId"><option value="">팀 없음</option>${teams.map(team => `<option value="${escape(team.id)}" ${v.teamId === team.id ? 'selected' : ''}>${escape(team.name)}</option>`).join('')}</select></label>`;
  }
  return '';
}
function grantsRenderConfirm() {
  const p = adminGrants.pending; if (!p) return;
  const lines = (p.lines || []).map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
  const nameCheck = p.requireName ? `<label class="field"><span>확인하려면 직원 이름을 그대로 적어 주세요: ${escape(p.requireName)}</span><input name="confirmName" autocomplete="off" data-grants-confirm-name value="${escape(p.values?.confirmName || '')}"></label>` : '';
  const desktop = typeof getSynkDesktopBridge === 'function' && getSynkDesktopBridge();
  const reauth = p.code === 'REAUTH_REQUIRED'
    ? `<div class="grants-reauth" role="alert"><p>${escape(p.error || '15분 안에 SYNK ID로 다시 로그인해야 이 일을 할 수 있어요.')}</p>${desktop ? '<p>데스크톱 앱 안에서는 SYNK ID로 다시 로그인할 수 없어요. 브라우저에서 Workspace를 열어 해 주세요.</p>' : '<button type="button" class="btn primary synk-id-button" data-grants-action="reauth">SYNK ID로 다시 로그인</button><p class="grants-sub">SYNK ID 로그인 화면에서 한 번 더 로그인해 확인해요. 이미 로그인되어 있어도 다시 로그인해요. 마치면 이 확인 창으로 돌아와요.</p>'}</div>`
    : (p.error || p.uncertain) ? `<p class="form-error grants-error" role="alert">${escape(p.error || GRANTS_UNCERTAIN_TEXT)}</p>` : '';
  const move = p.code === 'ACCOUNT_ALREADY_ENROLLED' && p.op === 'learner.add' && !p.payload?.move
    ? `<button type="button" class="btn" data-grants-action="learner-move">${escape(p.details?.className ? `「${p.details.className}」 반에서 이 반으로 옮기기` : '다른 반에서 이 반으로 옮기기')}</button>` : '';
  const nameMismatch = p.requireName && (p.values?.confirmName || '') !== p.requireName;
  // 결과를 모르는 요청은 같은 내용으로만 다시 묻는다. 칸을 잠가 내용이 바뀌지 않게 한다.
  const fields = grantsFieldsMarkup(p);
  modal(escape(p.title), p.subtitle ? escape(p.subtitle) : '', `<form data-grants-form="confirm" class="form-stack grants-confirm">
    ${lines ? `<dl class="grants-lines">${lines}</dl>` : ''}
    ${fields && p.uncertain ? `<fieldset class="grants-fields" disabled>${fields}</fieldset>` : fields}
    ${(p.warnings || []).map(text => `<p class="grants-warning">${escape(text)}</p>`).join('')}
    ${nameCheck}${reauth}
    <div class="modal-actions"><button type="button" class="btn quiet" data-action="close-modal">닫기</button>${move}<button type="submit" class="btn ${p.danger ? 'danger' : 'primary'}" data-grants-submit ${grantsLocked(p) || nameMismatch ? 'disabled' : ''}>${p.busy ? '처리 중' : escape(p.uncertain ? '다시 확인' : p.confirmLabel || '확인')}</button></div>
  </form>`);
}
function grantsCollect(p, form) {
  const data = new FormData(form), values = Object.fromEntries(data);
  p.values = { ...values, test: data.get('test') === 'on' };
  const payload = { ...(p.payload || {}) };
  if (p.fields === 'class-create') {
    payload.displayName = String(values.displayName || '').trim(); payload.classKey = String(values.classKey || '').trim(); payload.test = data.get('test') === 'on';
    if (!payload.displayName) return '반 이름을 적어 주세요.';
    if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(payload.classKey)) return '반 키는 영문 소문자나 숫자로 시작하고, 영문 소문자, 숫자, 하이픈만 60자까지 써요.';
    if (payload.test !== payload.classKey.startsWith('test-')) return payload.test ? '시험 반의 키는 test-로 시작해야 해요.' : 'test-로 시작하는 키는 시험 반에만 써요.';
  }
  if (p.fields === 'ent-grant') {
    const choice = grantsPendingChoices(p)[Number(values.choice)];
    if (!choice) return '줄 권한을 골라 주세요.';
    payload.product = choice.product; payload.capability = choice.capability;
    const date = String(values.validUntil || '');
    if (!date) {
      if (choice.expiry === 'required') return 'WORLD 권한은 기한을 꼭 정해야 해요.';
      payload.validUntil = null;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '기한을 날짜로 골라 주세요.';
      // 달력에 없는 날(2월 30일 등)은 Date가 다음 달로 넘기므로 먼저 막는다. 서버와 중앙도 INVALID_VALID_UNTIL로 거절한다.
      const [year, month, day] = date.split('-').map(Number), calendar = new Date(Date.UTC(year, month - 1, day));
      if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return '기한을 달력에 있는 날짜로 골라 주세요.';
      // 고른 날의 한국 시간 밤 12시(23:59:59)까지 쓴다.
      const until = Date.parse(`${date}T14:59:59Z`), limit = new Date(); limit.setUTCMonth(limit.getUTCMonth() + 6);
      if (!(until > Date.now() + 60000)) return '기한은 오늘이나 그 뒤로 골라 주세요.';
      if (choice.expiry === 'required' && until > limit.getTime()) return 'WORLD 권한의 기한은 6개월 안에서 골라 주세요.';
      payload.validUntil = new Date(until).toISOString();
    }
  }
  if (p.fields === 'demote') {
    payload.role = values.role; payload.teamId = values.teamId || null;
    if (payload.role === 'manager' && !payload.teamId) return '팀장은 팀을 꼭 골라야 해요.';
  }
  if (p.requireName && values.confirmName !== p.requireName) return '이름을 그대로 적어 주세요.';
  p.payload = payload;
  return '';
}
async function grantsSubmit(form) {
  const p = adminGrants.pending; if (!p || grantsLocked(p)) return;
  // 결과를 모르는 요청은 처음 보낸 내용(p.payload)과 같은 요청 번호로만 다시 보낸다.
  const invalid = p.uncertain ? '' : grantsCollect(p, form);
  if (invalid) { p.error = invalid; p.code = null; grantsRenderConfirm(); return; }
  const stamp = grantsStamp();
  p.busy = true; p.error = ''; p.code = null; p.details = null; grantsRenderConfirm();
  try {
    const result = p.kind === 'admin-role'
      ? await api(`/api/members/${encodeURIComponent(p.memberId)}/admin-role`, { ...p.payload, confirm: true })
      : await grantsCall({ op: p.op, ...p.payload, requestId: p.requestId, confirm: true });
    if (!grantsCurrent(stamp) || adminGrants.pending !== p) return;
    adminGrants.pending = null; closeModal();
    const outcome = result?.outcome === 'duplicate' ? '이미 되어 있었어요. 바뀐 것은 없어요.' : GRANTS_CHANGES[p.op]?.[result?.change] || p.doneMessage || '반영했어요.';
    notify(result?.warnings?.length ? `${outcome} ${result.warnings.join(' ')}` : outcome);
    grantsAfterWrite(p, result);
  } catch (err) {
    if (!grantsCurrent(stamp) || adminGrants.pending !== p || err?.code === 'SESSION_CHANGED') return;
    p.busy = false; p.code = err?.code || null; p.details = err?.details || null;
    // GRANTS_UNCONFIRMED: 중앙은 답했지만 회사 서버가 그사이 세션을 다시 확인해야 해서 결과를 넘기지 않았다. 같은 요청으로 다시 확인한다.
    const unknown = ['GRANTS_UNAVAILABLE', 'GRANTS_UNCONFIRMED'].includes(err?.code) || (!err?.status && !err?.code && err?.name !== 'AbortError');
    if (p.kind === 'grants' && unknown) p.uncertain = true;
    p.error = err?.code === 'ACCOUNT_ALREADY_ENROLLED' && err.details?.className ? `이 사람은 「${err.details.className}」 반 명부에 있어요. 옮기려면 아래 단추를 눌러 주세요.`
      : p.uncertain && unknown ? GRANTS_UNCERTAIN_TEXT : (err?.message || '처리하지 못했어요.');
    if (grantsNoteForbidden(err, p.op || '')) {
      p.error = err.code === 'GRANTS_FORBIDDEN' && /^teacher\./.test(p.op || '') ? GRANTS_STAFF_FORBIDDEN_TEXT : (adminGrants.forbiddenText || GRANTS_FORBIDDEN_TEXT);
      grantsPaintAudit(); grantsPaintPanel();
    }
    grantsRenderConfirm();
  }
}
function grantsAfterWrite(p, result) {
  if (p.kind === 'admin-role') return;
  void adminGrantsLoadAudit();
  if (p.op === 'class.create' && result?.class?.id) { adminGrants.classId = result.class.id; adminGrants.people.data = null; }
  if (p.op.startsWith('class') || p.op.startsWith('learner') || p.op.startsWith('teacher')) { void grantsLoadClasses(); void grantsLoadPeople(); }
  if (p.op.startsWith('entitlement')) void grantsLoadEnts();
}

/* 다시 로그인: reauth:true로 시작하면 SYNK ID 포털이 지금 로그인을 끊고 같은 SYNK ID(expectedAccountId)로 실제 로그인을 다시 받는다.
   중앙은 이미 로그인된 브라우저로 승인만 다시 받은 것을 로그인으로 치지 않는다. 마치면 이 확인 창으로 돌아온다. */
async function grantsReauth(button) {
  const p = adminGrants.pending; if (!p || !state.synkUserId || !state.user) return;
  if (button) button.disabled = true;
  try {
    const saved = { version: 1, userId: state.user.id, synkUserId: state.synkUserId, savedAt: Date.now(), mode: memberDirectory.mode, classId: adminGrants.classId, person: adminGrants.person,
      pending: { ...p, busy: false, error: '', code: null, details: null } };
    sessionStorage.setItem(GRANTS_RESTORE_KEY, JSON.stringify(saved));
    const response = await fetch('/api/synk-id/start', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', expectedAccountId: state.synkUserId, returnTo: 'admin', reauth: true }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.authorizationUrl !== 'string') throw new Error(data.error || 'SYNK ID 확인을 시작하지 못했어요.');
    const url = new URL(data.authorizationUrl);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('SYNK ID 확인 주소를 확인하지 못했어요.');
    try { sessionStorage.setItem('synk.workspace.synkAction', 'login'); } catch {}
    location.assign(url.href);
  } catch (err) {
    try { sessionStorage.removeItem(GRANTS_RESTORE_KEY); } catch {}
    if (button?.isConnected) button.disabled = false;
    p.error = err?.message || 'SYNK ID 확인을 시작하지 못했어요.'; grantsRenderConfirm();
  }
}
// 관리자 화면에 처음 들어올 때 한 번. 다시 확인하고 돌아왔으면 하던 칸과 확인 창을 되살린다.
function adminGrantsRestore() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(GRANTS_RESTORE_KEY) || 'null'); sessionStorage.removeItem(GRANTS_RESTORE_KEY); } catch { saved = null; }
  if (!saved || saved.version !== 1 || !saved.pending || saved.userId !== state.user?.id || saved.synkUserId !== state.synkUserId || !(Date.now() - saved.savedAt < GRANTS_RESTORE_MS)) return false;
  if (typeof saved.classId === 'string') adminGrants.classId = saved.classId;
  if (saved.person && typeof saved.person.id === 'string') adminGrants.person = saved.person;
  const mode = directoryModes.some(([key]) => key === saved.mode) ? saved.mode : 'workspace';
  if (mode !== memberDirectory.mode) showDirectoryMode(mode);
  else if (adminGrantsMode(mode)) adminGrantsLoad(mode);
  // 목록은 막 다시 읽기 시작했으니 기다리지 않는다. 「권한 주기」 창은 저장해 둔 줄 권한 목록으로 그린다.
  if (saved.pending.fields === 'ent-grant' && (!grantsValidChoices(saved.pending.choices) || !adminGrants.person)) {
    adminGrants.pending = null; notify('이용 권한 확인 창을 되살리지 못했어요. 「권한 주기」를 다시 눌러 주세요.'); return true;
  }
  grantsOpenConfirm(saved.pending);
  return true;
}

/* 확인 창 열기 */
function grantsPersonLines(person) {
  return [['이름', person.name || '이름 미등록'], ['로그인 이메일', person.loginId || '없음'], ['가입일', person.createdAt ? adminFormatDateTime(person.createdAt) : '확인 전'], ['SYNK ID', person.id]];
}
function grantsOpenLearnerAdd(person, { learnerId = null } = {}) {
  const cls = grantsSelectedClass(); if (!cls) return;
  grantsOpenConfirm({ kind: 'grants', op: 'learner.add', title: learnerId ? '빈 명부 줄에 SYNK ID 잇기' : '학생 넣기', subtitle: grantsClassName(cls),
    payload: { classId: cls.id, synkUserId: person.id, ...(learnerId ? { learnerId } : {}) },
    lines: [['반', grantsClassName(cls)], ...grantsPersonLines(person)],
    warnings: ['코드 없이 바로 이 반에 들어가요. 이 학생이 내는 과제 글은 반 공유와 상관없이 이 반 선생님이 봐요.'],
    confirmLabel: '이 반에 넣기', doneMessage: '학생을 이 반에 넣었어요.', person });
}
function grantsOpenLearnerMove(p) {
  const cls = grantsSelectedClass(); if (!cls || !p) return;
  const oldName = p.details?.className || '지금 반';
  grantsOpenConfirm({ kind: 'grants', op: 'learner.add', title: '다른 반에서 옮기기', subtitle: `${oldName} → ${grantsClassName(cls)}`,
    payload: { ...p.payload, move: true },
    lines: [['옛 반', oldName], ['새 반', grantsClassName(cls)], ...(Array.isArray(p.personLines) ? p.personLines : p.person ? grantsPersonLines(p.person) : [])],
    warnings: ['옛 학습 기록이 새 반 선생님에게 보여요. 과제 글은 옛 반에 남아요. 옛 반의 수업 영상 이용은 멈춰요.'],
    confirmLabel: '이 반으로 옮기기', doneMessage: '학생을 이 반으로 옮겼어요.', danger: true, person: p.person || null, personLines: p.personLines || null });
}
function grantsOpenTeacherAdd(person) {
  const cls = grantsSelectedClass(); if (!cls) return;
  grantsOpenConfirm({ kind: 'grants', op: 'teacher.add', title: '선생님 넣기', subtitle: grantsClassName(cls),
    payload: { classId: cls.id, synkUserId: person.id }, lines: [['반', grantsClassName(cls)], ...grantsPersonLines(person)],
    warnings: ['이 사람에게 직원(교사) 자격이 생겨요. 이 반 학생이 낸 과제 글과 옛 학습 기록(녹음 받아쓰기, AI 첨삭)을 보게 돼요.'],
    confirmLabel: '선생님으로 넣기', doneMessage: '선생님을 이 반에 넣었어요.', danger: true });
}

/* 관리자 올리기 · 내리기(회원 줄). 회사 주인(manageAdmins)에게만 보인다. */
function adminGrantsRoleButtons(member, extra) {
  if (!state.data?.permissions?.manageAdmins || member.id === state.user?.id || !extra?.adminRole) return '';
  if (member.role === 'admin') return extra.adminRole.owner ? '' : `<button type="button" class="btn small quiet" data-grants-action="admin-demote" data-id="${escape(member.id)}">관리자에서 내리기</button>`;
  if (member.active === false) return '';
  return extra.adminRole.synkLinked ? `<button type="button" class="btn small" data-grants-action="admin-promote" data-id="${escape(member.id)}">관리자로 올리기</button>` : '';
}
function grantsOpenAdminRole(memberId, promote) {
  const member = adminAllMembers().find(row => row.id === memberId); if (!member) return;
  if (promote) grantsOpenConfirm({ kind: 'admin-role', memberId, title: '관리자로 올리기', subtitle: member.name,
    payload: { admin: true, expectedRole: member.role }, lines: [['직원', member.name], ['로그인 이메일', member.email || '없음'], ['지금 역할', roleLabel(member.role)]],
    warnings: ['회사 자료 전부를 열 수 있어요. 반과 이용 권한은 따라가지 않아요.', '바꾸면 이 직원의 로그인이 모두 끊겨요. 다시 로그인하면 관리자로 들어와요.'],
    requireName: member.name, confirmLabel: '관리자로 올리기', doneMessage: `${member.name} 님을 관리자로 올렸어요.`, danger: true });
  else grantsOpenConfirm({ kind: 'admin-role', memberId, title: '관리자에서 내리기', subtitle: member.name, fields: 'demote',
    payload: { admin: false, expectedRole: member.role }, values: { role: 'member', teamId: member.teamId || '' },
    lines: [['직원', member.name], ['로그인 이메일', member.email || '없음']],
    warnings: ['회사 자료 전부를 여는 권한이 바로 멈춰요. 이 직원의 로그인은 모두 끊겨요.'],
    confirmLabel: '관리자에서 내리기', doneMessage: `${member.name} 님을 관리자에서 내렸어요.`, danger: true });
}

/* 「전체 SYNK ID」 줄의 「이용 권한」 단추 */
function adminGrantsDirectoryButton(row) {
  if (!adminGrantsVisible() || adminGrants.forbidden) return '';
  return `<button type="button" class="btn small" data-grants-action="ents-from-directory" data-synk-id="${escape(row.id)}" data-name="${escape(row.name || '')}" data-login="${escape(row.loginId || '')}" data-created="${escape(row.createdAt || '')}" data-status="${escape(row.status || '')}">이용 권한</button>`;
}

document.addEventListener('input', event => {
  if (event.target.matches?.('[data-grants-confirm-name]') && adminGrants.pending) {
    adminGrants.pending.values = { ...(adminGrants.pending.values || {}), confirmName: event.target.value };
    const submit = event.target.form?.querySelector('[data-grants-submit]');
    if (submit) submit.disabled = grantsLocked(adminGrants.pending) || event.target.value !== adminGrants.pending.requireName;
  }
});
document.addEventListener('submit', event => {
  const form = event.target?.closest?.('[data-grants-form]'); if (!form) return;
  event.preventDefault();
  const kind = form.dataset.grantsForm, data = new FormData(form);
  if (kind === 'class-search') {
    const c = adminGrants.classes; c.q = String(data.get('q') || '').trim(); c.active = String(data.get('active') || 'all'); c.page = 1; void grantsLoadClasses();
  } else if (kind === 'pick-search') {
    const q = String(data.get('q') || '').trim(); if (q) void grantsPickerSearch(q);
  } else if (kind === 'confirm') void grantsSubmit(form);
});
document.addEventListener('change', event => {
  if (event.target.closest?.('[data-grants-form="class-search"]') && event.target.matches('select')) event.target.form.requestSubmit();
});
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-grants-action]'); if (!button || button.disabled) return;
  const action = button.dataset.grantsAction;
  if (action === 'audit-refresh') return void adminGrantsLoadAudit();
  if (action === 'classes-retry') return void grantsLoadClasses();
  if (action === 'people-retry') return void grantsLoadPeople();
  if (action === 'ents-retry') return void grantsLoadEnts();
  if (action === 'classes-page') { adminGrants.classes.page = Math.max(1, adminGrants.classes.page + Number(button.dataset.step)); return void grantsLoadClasses(); }
  if (action === 'class-open') {
    adminGrants.classId = button.dataset.classId; adminGrants.people.data = null; adminGrants.people.error = '';
    grantsPaintPanel(); void grantsLoadPeople();
    document.getElementById('grants-class-title')?.focus({ preventScroll: false });
    return;
  }
  if (action === 'class-create') return grantsOpenConfirm({ kind: 'grants', op: 'class.create', title: '반 만들기', fields: 'class-create', payload: {},
    warnings: ['새 반은 켜진 채로 만들어요. 만든 반은 지우지 않고 끄기만 해요.'], confirmLabel: '반 만들기', doneMessage: '반을 만들었어요.' });
  if (action === 'class-toggle') {
    const cls = grantsSelectedClass(); if (!cls) return;
    return grantsOpenConfirm({ kind: 'grants', op: 'class.setActive', title: cls.active ? '반 끄기' : '반 다시 켜기', subtitle: grantsClassName(cls),
      payload: { classId: cls.id, active: !cls.active }, lines: [['반', grantsClassName(cls)], ['반 키', cls.classKey]],
      warnings: [cls.active ? '이 반의 선생님과 학생이 바로 이 반을 볼 수 없어요. 명부와 기록은 지우지 않아요.' : '이 반의 선생님과 학생이 다시 이 반을 봐요.'],
      confirmLabel: cls.active ? '반 끄기' : '다시 켜기', doneMessage: cls.active ? '반을 껐어요.' : '반을 다시 켰어요.', danger: cls.active });
  }
  if (action === 'learner-add') return grantsOpenPicker('이 반에 넣을 학생 고르기', person => grantsOpenLearnerAdd(person));
  if (action === 'learner-link') { const learnerId = button.dataset.learnerId; return grantsOpenPicker('빈 명부 줄에 이을 SYNK ID 고르기', person => grantsOpenLearnerAdd(person, { learnerId })); }
  if (action === 'teacher-add') return grantsOpenPicker('이 반에 넣을 선생님 고르기', person => grantsOpenTeacherAdd(person));
  if (action === 'learner-remove' || action === 'learner-readd') {
    const cls = grantsSelectedClass(), row = adminGrants.people.data?.learners.find(item => item.learnerId === button.dataset.learnerId); if (!cls || !row) return;
    const personLines = [['학생', row.name || '이름 미등록'], ['학생 번호', row.studentCode || '없음'], ['SYNK ID', row.synkUserId || '없음']], lines = [['반', grantsClassName(cls)], ...personLines];
    // 다른 반에 들어가 있어 「옮기기」로 넘어가도 학생 줄을 그대로 보여 준다.
    if (action === 'learner-readd') return grantsOpenConfirm({ kind: 'grants', op: 'learner.add', title: '학생 다시 넣기', subtitle: grantsClassName(cls), payload: { classId: cls.id, synkUserId: row.synkUserId }, lines, personLines,
      warnings: ['코드 없이 바로 이 반에 다시 들어가요. 이 학생이 내는 과제 글은 반 공유와 상관없이 이 반 선생님이 봐요.', '수업 영상 이용은 돌아오지 않아요. 영상 이용은 운영에서 다시 줘요.'], confirmLabel: '다시 넣기', doneMessage: '학생을 이 반에 다시 넣었어요.' });
    return grantsOpenConfirm({ kind: 'grants', op: 'learner.remove', title: '학생 빼기', subtitle: grantsClassName(cls), payload: { classId: cls.id, learnerId: row.learnerId }, lines,
      warnings: ['명부 줄은 남아요. 이 사람은 다른 반 코드로 들어갈 수 없고, 다른 반에는 여기서 옮겨야 해요. 다시 넣어도 수업 영상 이용은 돌아오지 않아요.'],
      confirmLabel: '이 반에서 빼기', doneMessage: '학생을 이 반에서 뺐어요.', danger: true });
  }
  if (action === 'teacher-remove') {
    const cls = grantsSelectedClass(), row = adminGrants.people.data?.teachers.find(item => item.staffId === button.dataset.staffId); if (!cls || !row) return;
    return grantsOpenConfirm({ kind: 'grants', op: 'teacher.remove', title: '선생님 빼기', subtitle: grantsClassName(cls), payload: { classId: cls.id, staffId: row.staffId },
      lines: [['반', grantsClassName(cls)], ['선생님', row.name || '이름 미등록'], ['SYNK ID', row.synkUserId || '없음']],
      warnings: ['이 선생님에게 이 반 학생의 과제 글과 학습 기록이 바로 안 보여요. 이 선생님이 만든 이 반 연결 코드도 함께 지워져요.', ...(row.role === 'director' ? ['원장 자격은 반 배정과 상관없이 그대로 남아요. 이 반 배정만 지워요.'] : [])],
      confirmLabel: '이 반에서 빼기', doneMessage: '선생님을 이 반에서 뺐어요.', danger: true });
  }
  if (action === 'learner-move') return grantsOpenLearnerMove(adminGrants.pending);
  if (action === 'ents-pick') return grantsOpenPicker('이용 권한을 볼 사람 고르기', person => { closeModal(); adminGrants.person = person; adminGrants.ents.data = null; grantsRepaintEnts(); void grantsLoadEnts(); });
  if (action === 'ents-from-directory') {
    adminGrants.person = { id: button.dataset.synkId, name: button.dataset.name, loginId: button.dataset.login, createdAt: button.dataset.created, status: button.dataset.status };
    adminGrants.ents.data = null;
    showDirectoryMode('entitlements');
    return;
  }
  if (action === 'ent-grant') {
    if (!adminGrants.person || !adminGrants.ents.choices.length) return notify('이용 권한 목록을 먼저 불러와 주세요.');
    return grantsOpenConfirm({ kind: 'grants', op: 'entitlement.grant', title: '이용 권한 주기', subtitle: adminGrants.person.name || '', fields: 'ent-grant', payload: { synkUserId: adminGrants.person.id },
      lines: grantsPersonLines(adminGrants.person), values: { choice: '0' }, choices: adminGrants.ents.choices.map(row => ({ ...row })),
      warnings: ['메뉴 권한은 자료 권한이 아니에요. 교사 앱 메뉴를 줘도 맡은 반이 없으면 학생을 볼 수 없어요.'], confirmLabel: '권한 주기', doneMessage: '이용 권한을 줬어요.' });
  }
  if (action === 'ent-revoke') {
    const { product, capability } = button.dataset;
    return grantsOpenConfirm({ kind: 'grants', op: 'entitlement.revoke', title: '이용 권한 거두기', subtitle: adminGrants.person?.name || '', payload: { synkUserId: adminGrants.person.id, product, capability },
      lines: [...grantsPersonLines(adminGrants.person), ['권한', grantsChoiceLabel(product, capability)]],
      warnings: ['이 권한으로 열던 메뉴나 기능이 바로 닫혀요.'], confirmLabel: '거두기', doneMessage: '이용 권한을 거뒀어요.', danger: true });
  }
  if (action === 'pick') {
    const k = adminGrants.picker, row = k?.data?.rows[Number(button.dataset.index)]; if (!row) return;
    const person = { id: row.id, name: row.name, loginId: row.loginId, createdAt: row.createdAt, status: row.status };
    adminGrants.picker = null; k.onPick(person); return;
  }
  if (action === 'reauth') return void grantsReauth(button);
  if (action === 'admin-promote' || action === 'admin-demote') return grantsOpenAdminRole(button.dataset.id, action === 'admin-promote');
});
