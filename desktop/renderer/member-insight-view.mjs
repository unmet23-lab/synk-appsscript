// Shared, read-only member view. The account controller owns loading and consent;
// this module only renders the server's Atlas projection and retains no data.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const count = value => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0).toLocaleString('ko-KR');
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;
const statusLabels = new Map([['unseen', '기록 대기'], ['checking', '기록 확인 중'], ['practice', '연습 중'], ['supported', '도움과 함께 연습'], ['recent-independent', '최근 혼자 응답'], ['review', '다시 살펴보기']]);
const statusLabel = value => statusLabels.get(value) || '';
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';

function stamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(date);
}

function dateLine(value, label) {
  const formatted = stamp(value);
  return formatted ? `<span>${escape(label)} <time datetime="${escape(new Date(value).toISOString())}">${escape(formatted)}</time></span>` : '';
}

function action(name, label, primary = false) {
  return `<button type="button" class="mi-button${primary ? ' mi-button-primary' : ''}" data-insight-action="${name}">${escape(label)}</button>`;
}

function sectionHeading(number, id, title, description) {
  return `<header class="mi-section-heading"><span class="mi-section-number" aria-hidden="true">${number}</span><div><h2 id="${id}">${title}</h2><p>${description}</p></div></header>`;
}

function empty(title, description) {
  return `<div class="mi-empty"><p class="mi-empty-title">${title}</p><p>${description}</p></div>`;
}

function personalSection(report, declaredOnly) {
  const items = list(report.personal).filter(item => !declaredOnly || item.basis === 'self-declared');
  const interest = items.find(item => item.id === 'reasons' || item.id === 'goal');
  const settings = items.filter(item => item !== interest);
  const allDeclared = settings.every(item => item.basis === 'self-declared');
  let body = interest ? `<dl class="mi-personal-list"><div class="mi-personal-row"><dt><span class="mi-basis">${interest.basis === 'self-declared' ? '직접 알려준 정보' : '이용 기록에서 확인'}</span><span>${escape(interest.title)}</span></dt><dd><p class="mi-personal-value">${escape(interest.value)}</p>${interest.detail ? `<p class="mi-row-detail">${escape(interest.detail)}</p>` : ''}${dateLine(interest.at, '정보 기록')}</dd></div></dl>` : '';
  if (settings.length) body += `<div class="mi-preferences"><h3>${allDeclared ? '직접 고른 이용 설정' : '이용 방식'}</h3><dl class="mi-preference-list">${settings.map(item => `<div><dt>${escape(item.title)}${allDeclared ? '' : `<span class="mi-basis">${item.basis === 'self-declared' ? '직접 알려준 정보' : '이용 기록에서 확인'}</span>`}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl></div>`;
  if (!items.length) body = empty('아직 나를 소개할 정보가 없어요.', 'SYNK에서 직접 알려준 배우는 이유와 선호 설정이 모이면 이곳에서 함께 볼 수 있어요.');
  return `<section class="mi-section" aria-labelledby="insight-personal-title">${sectionHeading('01', 'insight-personal-title', '나의 관심사·선호', '내가 알려준 선호와 이용 기록을 구분해서 살펴봐요.')}${body}<p class="mi-section-note">현재는 직접 고른 배우는 이유와 이용 설정을 중심으로 보여요.</p></section>`;
}

function learningSection(report, declaredOnly) {
  const learning = report.learning && typeof report.learning === 'object' ? report.learning : {};
  const skills = list(learning.skills), content = list(learning.content);
  const hasPractice = !declaredOnly && learning.empty !== true && (learning.answered > 0 || skills.length > 0 || content.length > 0);
  let body;
  if (declaredOnly) {
    body = empty('학습 기록 연결이 꺼져 있어요.', '연습 기록을 함께 보고 싶다면 계정에서 Atlas 연결 설정을 확인해 주세요.');
  } else if (!hasPractice) {
    body = empty('첫 연습 기록을 기다리고 있어요.', 'Atlas에 연결되는 학습 활동을 하면 혼자 응답한 기록과 도움을 받은 기록을 나눠 보여드려요.');
  } else {
    body = `<dl class="mi-counters"><div><dt>응답 기록</dt><dd>${count(learning.answered)}<span>회</span></dd></div><div><dt>혼자 응답</dt><dd>${count(learning.independent)}<span>회</span></dd></div><div><dt>도움 받고 응답</dt><dd>${count(learning.assisted)}<span>회</span></dd></div></dl><p class="mi-counter-note">혼자 응답한 기록에는 맞힌 답과 틀린 답이 함께 포함돼요. 같은 문항에 다시 응답한 기록도 셀 수 있어요.</p>`;
    if (skills.length) body += `<div class="mi-practice"><h3>연습에서 보인 것</h3><ul class="mi-skill-list">${skills.map(skill => `<li><div class="mi-skill-title"><h4>${escape(skill.label)}</h4>${statusLabel(skill.status) ? `<span class="mi-skill-status">${escape(statusLabel(skill.status))}</span>` : ''}</div><p>${escape(skill.line)}</p>${dateLine(skill.lastAt, '마지막 기록')}</li>`).join('')}</ul></div>`;
    if (content.length) body += `<div class="mi-practice"><h3>이어서 살펴볼 내용</h3><ul class="mi-content-list">${content.map(item => `<li><span>${escape(item.label)}</span>${statusLabel(item.status) ? `<span>${escape(statusLabel(item.status))}</span>` : ''}</li>`).join('')}</ul></div>`;
  }
  return `<section class="mi-section" aria-labelledby="insight-learning-title">${sectionHeading('02', 'insight-learning-title', '학습 성향·성장', '실제 연습 기록에서 응답한 내용과 도움을 쓴 순간을 돌아봐요.')}${body}<p class="mi-section-note">연습 요약이며 전체 실력이나 학습 효과를 판정하지 않아요.</p></section>`;
}

function evidence(report) {
  const reasons = list(report.reasons);
  const limits = Array.isArray(report.limits) ? report.limits.filter(item => typeof item === 'string' && item.trim()) : [];
  const detailGroups = new Map();
  for (const item of list(report.personal)) {
    if (item.id === 'reasons' || item.id === 'goal' || !item.detail || report.shared === 'declared-only' && item.basis !== 'self-declared') continue;
    if (!detailGroups.has(item.detail)) detailGroups.set(item.detail, []);
    detailGroups.get(item.detail).push(item.title);
  }
  const preferenceEvidence = detailGroups.size ? `<h3>선택 정보의 근거</h3><dl>${[...detailGroups].map(([detail, titles]) => `<div><dt>${escape(titles.join(' · '))}</dt><dd>${escape(detail)}</dd></div>`).join('')}</dl>` : '';
  return `<details class="mi-evidence"><summary><span>어떤 정보를 바탕으로 했나요?</span><span class="mi-evidence-toggle" aria-hidden="true"></span></summary><div class="mi-evidence-body"><p>내가 직접 알려준 정보와 연결된 연습 기록을 바탕으로 정리했어요. 기록이 쌓이거나 설정이 바뀌면 이 화면도 달라질 수 있어요.</p>${preferenceEvidence}${reasons.length ? `<dl>${reasons.map(reason => `<div><dt>${escape(reason.label)}</dt><dd>${escape(reason.line)}</dd></div>`).join('')}</dl>` : ''}${limits.length ? `<h3>함께 알아둘 점</h3><ul>${limits.map(limit => `<li>${escape(limit)}</li>`).join('')}</ul>` : ''}<p class="mi-evidence-date">${dateLine(report.asOf, '요약 확인')}${dateLine(report.lastAt, '마지막 연습')}</p><p class="mi-evidence-footnote">요약 확인 시각은 이 화면의 정보를 확인한 때예요. 성향이나 실력이 바뀐 시각을 뜻하지 않아요.</p></div></details>`;
}

function pending(state) {
  const status = state.status;
  if (status === 'loading') return `<div class="mi-state" role="status" aria-live="polite"><span class="mi-state-dot" aria-hidden="true"></span><h2>내 기록을 살펴보고 있어요.</h2><p>Atlas에 연결된 정보로 두 영역을 정리하고 있어요.</p></div>`;
  if (status === 'signed-out') return `<div class="mi-state"><span class="mi-state-label">SYNK ID</span><h2>내 계정으로 이어서 살펴봐요.</h2><p>로그인하면 내가 알려준 정보와 연결된 학습 기록을 한곳에서 볼 수 있어요.</p>${action('account', '로그인하기', true)}</div>`;
  if (status === 'unconfigured') return `<div class="mi-state" role="status"><span class="mi-state-label">계정 연결</span><h2>지금은 내 기록을 연결할 수 없어요.</h2><p>이 환경에서 SYNK ID 연결이 준비되면 내 성향을 확인할 수 있어요.</p>${action('account', '계정 확인하기', true)}</div>`;
  return `<div class="mi-state" role="alert"><span class="mi-state-label">다시 확인</span><h2>기록을 불러오지 못했어요.</h2><p>${escape(text(state.message, '잠시 후 다시 확인해 주세요. 연결된 기록을 가져와야 내 성향을 보여드릴 수 있어요.'))}</p>${action('refresh', '다시 불러오기', true)}</div>`;
}

export function renderMemberInsight(state = {}, { native = false } = {}) {
  state = state && typeof state === 'object' ? state : {};
  const report = state.status === 'ready' && state.report && typeof state.report === 'object' ? state.report : null;
  const status = report ? 'ready' : ['loading', 'signed-out', 'unconfigured', 'error'].includes(state.status) ? state.status : 'error';
  const back = native ? `<button type="button" class="mi-back" data-view="benefits">${arrow}회원 혜택 모두 보기</button>` : `<a class="mi-back" href="#benefits">${arrow}회원 혜택 모두 보기</a>`;
  const intro = `<header class="mi-hero"><span class="mi-eyebrow">SYNK FOR YOU / ATLAS</span><div class="mi-hero-title"><h1 id="benefit-title" tabindex="-1">내 성향</h1><p>내가 고른 것과 <br>해본 것에서 발견하는 나.</p></div><p class="mi-hero-note">관심사·선호와 학습 기록, 두 가지 시선으로 살펴봐요.</p></header>`;
  let body;
  if (!report) body = pending({ ...state, status });
  else {
    const declaredOnly = report.shared === 'declared-only';
    body = `<div class="mi-summary"><div><span class="mi-summary-label">지금 확인할 수 있는 나</span><h2>${escape(text(report.headline, '기록에서 나를 조금씩 알아가요.'))}</h2><p>${escape(text(report.description, '직접 알려준 내용과 연습한 기록을 함께 정리했어요.'))}</p></div>${action('refresh', '새로 확인하기', true)}</div>`;
    if (declaredOnly) body += `<aside class="mi-consent" aria-label="학습 기록 연결 상태"><div><strong>학습 기록 연결이 꺼져 있어요.</strong><p>직접 알려준 배우는 이유만 보여요. 연결 설정은 계정에서 바꿀 수 있어요.</p></div>${action('account', '계정 설정')}</aside>`;
    body += personalSection(report, declaredOnly) + learningSection(report, declaredOnly);
    if (!declaredOnly) body += `<div class="mi-settings"><p>내 정보가 달라졌다면</p>${action('account', '내 정보·연결 설정 확인')}</div>`;
    body += evidence(report);
  }
  return `<article class="member-insight" data-insight-status="${status}" aria-labelledby="benefit-title"${status === 'loading' ? ' aria-busy="true"' : ''}>${back}${intro}${body}</article>`;
}
