// Shared member view. The account controller owns loading, consent and explicit saves;
// this module only renders the server's Atlas projection and retains no data.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const count = value => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0).toLocaleString('ko-KR');
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;
const statusLabels = new Map([['unseen', '기록 대기'], ['checking', '기록 확인 중'], ['practice', '연습 중'], ['supported', '도움과 함께 연습'], ['recent-independent', '최근 혼자 응답'], ['review', '다시 살펴보기']]);
const statusLabel = value => statusLabels.get(value) || '';
const activityTargets = new Map([['world', 'WORLD에서 연습 고르기'], ['messenger', 'Workspace 열기'], ['path', 'PATH 열기'], ['pulse', 'PULSE 열기']]);
const verdictLabels = new Map([['agree', '맞아요'], ['disagree', '달라요'], ['contextual', '상황마다 달라요']]);
const facetId = value => typeof value === 'string' && /^(?:topics|support|explanation|usage-repeat|practice-mode|practice-response|learning-topic:[A-Za-z0-9][A-Za-z0-9_.-]{0,79})$/.test(value);
const personalFacets = new Set(['topics', 'support', 'explanation', 'usage-repeat']);
const conditionLabels = new Map([['first-try', '처음 시도할 때'], ['familiar', '익숙한 내용일 때'], ['busy', '바쁠 때'],
  ['after-example', '예시를 본 다음'], ['first-try-after-example', '처음 시도하며 예시를 본 다음'], ['familiar-after-example', '익숙한 내용의 예시를 본 다음'], ['busy-after-example', '바쁠 때 예시를 본 다음'],
  ['meeting', '회의할 때'], ['teamwork', '함께 일할 때'], ['planning', '계획을 세울 때'], ['decision', '결정할 때']]);
const evidenceLabels = new Map([['statement', '내가 확인한 서술'], ['selection', '직접 고른 내용'], ['observation', '실제 이용 기록'], ['period', '기간별 기록']]);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
const stampFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
});

function stamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return stampFormatter.format(date);
}

function dateLine(value, label) {
  const formatted = stamp(value);
  return formatted ? `<span>${escape(label)} <time datetime="${escape(new Date(value).toISOString())}">${escape(formatted)}</time></span>` : '';
}

function action(name, label, primary = false, disabled = false) {
  return `<button type="button" class="mi-button${primary ? ' mi-button-primary' : ''}" data-insight-action="${name}"${disabled ? ' disabled' : ''}>${escape(label)}</button>`;
}

function activityAction(target, disabled = false) {
  if (!activityTargets.has(target)) return '';
  return `<button type="button" class="mi-button" data-insight-action="activity" data-insight-target="${target}"${disabled ? ' disabled' : ''}>${escape(activityTargets.get(target))}</button>`;
}

function difference(value, unit) {
  if (!Number.isSafeInteger(value)) return '비교하지 않음';
  return value === 0 ? '같음' : `${count(Math.abs(value))}${unit} ${value > 0 ? '더 많음' : '더 적음'}`;
}

function periodComparison(periods, kind) {
  if (!periods || !periods.recent || !periods.previous) return `<p class="mi-period-unavailable">기간별 비교 정보가 아직 없어요. 연결된 기록이 준비되면 최근 30일과 이전 30일을 함께 보여드려요.</p>`;
  const learning = kind === 'learning';
  const metrics = learning ? [['answered', '응답 기록', '회'], ['independent', '혼자 응답', '회'], ['assisted', '도움 받고 응답', '회'], ['activeDays', '응답한 날짜', '일']] : [['observations', '앱 열기', '회'], ['activeDays', '앱을 연 날짜', '일']];
  const comparable = periods.sufficient === true && periods.delta && typeof periods.delta === 'object';
  return `<div class="mi-periods"><div class="mi-period-heading"><h3>${learning ? '기간별 연습 기록' : '기간별 앱 이용 기록'}</h3><span>${comparable ? '두 기간의 관측 횟수 비교' : '아직 비교하기 어려워요'}</span></div><p class="mi-period-reason">${escape(text(periods.reason, '충분한 기록이 쌓이면 두 기간을 비교해요.'))}</p><table class="mi-period-table"><caption class="mi-visually-hidden">${learning ? '연습 기록' : '앱 이용 기록'}의 최근 30일과 이전 30일 비교</caption><thead><tr><th scope="col">기록</th><th scope="col">이전 30일</th><th scope="col">최근 30일</th><th scope="col">관측 차이</th></tr></thead><tbody>${metrics.map(([key, label, unit]) => `<tr><th scope="row">${label}</th><td>${count(periods.previous[key])}<span>${unit}</span></td><td>${count(periods.recent[key])}<span>${unit}</span></td><td>${comparable ? escape(difference(periods.delta[key], unit)) : '<span aria-label="기록이 부족해 비교하지 않음">비교 보류</span>'}</td></tr>`).join('')}</tbody></table><details class="mi-period-dates"><summary>비교한 기간 보기</summary><p>${dateLine(periods.previous.from, '이전 30일 시작 이후')}${dateLine(periods.previous.to, '끝 시각까지')}</p><p>${dateLine(periods.recent.from, '최근 30일 시작 이후')}${dateLine(periods.recent.to, '끝 시각까지')}</p><p>시각은 한국 기준이에요. 각 기간은 정확히 30일이며, 양 끝에 일부만 포함되는 날짜가 있어 활동한 날짜는 최대 31일로 셀 수 있어요.</p></details></div>`;
}

function activityInterest(report, pending) {
  const activity = report.activity || { status: 'unavailable' };
  const enabled = ['ready', 'empty'].includes(activity.status);
  const loading = activity.status === 'loading';
  const interests = enabled ? list(activity.interests).filter(item => activityTargets.has(item.id) && ['favorite', 'opened'].includes(item.kind)) : [];
  const suggestions = enabled && !list(report.understanding?.activities).length ? list(activity.activities).filter(item => activityTargets.has(item.targetId) && ['self-declared', 'observed'].includes(item.basis)) : [];
  let body = `<div class="mi-activity-consent"><div><h3>앱 이용 기록으로 관심사 보기</h3><p>허용하면 이 계정으로 앱을 연 사실과 즐겨찾기를 살펴봐요. 메모 본문이나 고객 자료의 내용은 읽지 않아요.</p><p class="mi-consent-status">${enabled ? '앱 이용 기록 연결 켜짐 · 학습 기록 연결과 별도예요.' : loading ? '앱 이용 기록 연결 상태를 확인하고 있어요.' : activity.status === 'disabled' ? '현재 꺼져 있어요. 켠 뒤부터 기록을 모아요.' : activity.status === 'error' ? '앱 이용 기록을 불러오지 못했어요. 다시 연결을 확인해 주세요.' : '이 환경에서는 앱 이용 기록 연결 상태를 확인할 수 없어요.'}</p>${enabled ? '<p class="mi-consent-delete">끄면 지금까지 모은 앱 이용 관찰 기록도 지워져요.</p>' : ''}</div>${action(enabled ? 'disable-activity' : 'enable-activity', pending ? '처리 중…' : enabled ? '앱 이용 기록 연결 끄기' : '앱 이용 기록 연결 켜기', false, pending || loading)}</div>`;
  if (enabled) {
    body += `<div class="mi-observed"><h3>앱 선택과 실제 이용</h3>${interests.length ? `<ul class="mi-interest-list">${interests.map(item => `<li><div class="mi-interest-title"><h4>${escape(item.label)}</h4><span class="mi-basis">${item.kind === 'favorite' ? '직접 고른 즐겨찾기' : '실제 앱 열기에서 관찰'}</span></div><p>${escape(item.detail)}</p><p class="mi-interest-counts">앱 열기 관측 · 이전 30일 ${count(item.previousCount)}회 · 최근 30일 ${count(item.recentCount)}회</p>${dateLine(item.lastAt, '마지막 관측')}</li>`).join('')}</ul>` : empty('아직 앱 이용에서 확인할 관심 정보가 없어요.', '연결을 켠 뒤 앱을 열거나 즐겨찾기를 고르면, 직접 선택한 것과 실제 이용한 것을 구분해 보여드려요.')}</div>`;
    body += periodComparison(activity.periods, 'activity');
    if (suggestions.length) body += `<div class="mi-next-activities"><h3>이어서 해 볼 활동</h3><ul>${suggestions.map(item => `<li><div><span class="mi-basis">${item.basis === 'self-declared' ? '직접 고른 즐겨찾기에서' : '관찰한 앱 이용에서'}</span><p>${escape(item.reason)}</p></div>${activityAction(item.targetId, pending)}</li>`).join('')}</ul></div>`;
    body += `<p class="mi-section-note">앱을 연 횟수만으로 관심의 강도나 구체적인 취향을 단정하지 않아요.${activity.enabledAt ? ` ${dateLine(activity.enabledAt, '기록 연결 시작')}` : ''}</p>`;
  }
  return `<div class="mi-member-activity" aria-busy="${pending || loading}">${body}</div>`;
}

function sectionHeading(number, id, title, description) {
  return `<header class="mi-section-heading"><span class="mi-section-number" aria-hidden="true">${number}</span><div><h2 id="${id}">${title}</h2><p>${description}</p></div></header>`;
}

function empty(title, description) {
  return `<div class="mi-empty"><p class="mi-empty-title">${title}</p><p>${description}</p></div>`;
}

function understandingAction(name, label, attributes = {}, disabled = false, primary = false) {
  const data = Object.entries(attributes).map(([key, value]) => ` data-insight-${key}="${escape(value)}"`).join('');
  return `<button type="button" class="mi-button${primary ? ' mi-button-primary' : ''}" data-insight-action="understanding-${name}"${data}${disabled ? ' disabled' : ''}>${escape(label)}</button>`;
}

function understandingEditor(facet, state) {
  const editor = state.understandingEditor;
  if (!editor || editor.facetId !== facet.id || !['review', 'override'].includes(editor.mode)) return '';
  const busy = state.understandingPending === true;
  const reviewing = editor.mode === 'review';
  if (facet.available !== true || reviewing && (!facet.claim || !verdictLabels.has(editor.verdict))) return '';
  const choices = list(facet.choices).filter(choice => typeof choice.id === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(choice.id));
  const selected = new Set(Array.isArray(editor.values) ? editor.values : []);
  const note = typeof editor.note === 'string' ? [...editor.note].slice(0, 200).join('') : '';
  const heading = reviewing ? `이 설명에 “${verdictLabels.get(editor.verdict)}”라고 알려줄게요` : facet.id === 'topics' ? '내 관심 주제 고르기' : `${text(facet.title, '내 정보')} 수정하기`;
  const selection = reviewing ? `<p class="mi-edit-preview">${escape(facet.line)}</p><p>${editor.verdict === 'disagree' ? '관찰한 기록은 유지하고, 이 해석에 동의하지 않는다는 점을 다음 설명에 반영해요.' : editor.verdict === 'contextual' ? '이 방식을 언제나 선호한다고 단정하지 않도록 알려줘요.' : '현재 설명이 나와 맞는다고 직접 확인한 내용으로 남겨요.'}</p>` : `<fieldset><legend>${facet.multiple ? '해당하는 관심 주제를 최대 5개 골라 주세요.' : '지금 나에게 맞는 설명을 하나 골라 주세요.'}</legend><div class="mi-choice-list">${choices.map(choice => `<label><input type="${facet.multiple ? 'checkbox' : 'radio'}" name="insight-choice" value="${escape(choice.id)}"${selected.has(choice.id) ? ' checked' : ''}${busy ? ' disabled' : ''}><span>${escape(choice.label)}</span></label>`).join('')}</div></fieldset>`;
  return `<form class="mi-understanding-editor" data-insight-editor data-insight-facet="${escape(facet.id)}" aria-label="${escape(heading)}"${busy ? ' aria-busy="true"' : ''}><h4 tabindex="-1" data-insight-editor-title>${escape(heading)}</h4>${selection}${!reviewing && ['support', 'explanation'].includes(facet.id) ? '<p>이 화면의 설명에 쓸 선택이에요. 실제 앱 설정은 계정에서 바꿀 수 있어요.</p>' : ''}<label class="mi-note-label">덧붙이고 싶은 말 <span>선택 · 200자 이내</span><textarea data-insight-field="note" name="insight-note" maxlength="400" rows="3"${busy ? ' disabled' : ''}>${escape(note)}</textarea></label><p class="mi-save-explanation">다음 설명에 반영하도록 저장해요. 덧붙인 말은 직접 남긴 설명으로 표시하며, 의미를 추측하지 않아요.</p><div class="mi-editor-actions">${understandingAction('save', busy ? '저장 중…' : '이 내용으로 반영', {}, busy, true)}${understandingAction('cancel', '취소', {}, busy)}</div></form>`;
}

function understandingFacets(report, state, area) {
  const understanding = report.understanding;
  if (!understanding || understanding.status !== 'ready') return '';
  const facets = list(understanding.facets).filter(facet => facetId(facet.id) && (area === 'personal' ? personalFacets.has(facet.id) : !personalFacets.has(facet.id)));
  if (!facets.length) return '';
  const busy = state.understandingPending === true;
  return `<div class="mi-understanding-facets">${facets.map(facet => {
    const reviewing = facet.available === true && facet.claim;
    const editable = facet.available === true && list(facet.choices).length > 0;
    const current = facet.review && verdictLabels.get(facet.review.verdict);
    const basis = facet.review && !facet.override ? '기록에 대한 내 확인' : facet.basis === 'self-declared' ? '내가 직접 알려준 내용' : facet.basis === 'observed' ? '연결한 기록에서 관찰' : '아직 충분한 근거가 없어요';
    const evidenceLine = text(facet.evidenceLine, facet.basis === 'self-declared' ? '직접 고른 내용을 바탕으로 정리했어요.' : '연결한 자료만으로는 아직 설명할 근거가 부족해요.');
    return `<div class="mi-understanding-facet" data-insight-facet-row="${escape(facet.id)}"><div class="mi-facet-heading"><h3>${escape(facet.title)}</h3><span class="mi-basis">${basis}</span></div><p class="mi-facet-line">${escape(facet.line)}</p><details class="mi-facet-evidence"><summary>이 설명의 근거 보기</summary><p>${escape(evidenceLine)}</p></details>${current || facet.override ? `<p class="mi-confirmed">${current ? `내 확인: ${escape(current)}` : '내가 직접 고른 내용을 반영했어요.'}${dateLine(facet.review?.at || facet.override?.at, '저장')}</p>` : ''}${reviewing || editable ? `<div class="mi-facet-actions">${reviewing ? [...verdictLabels].map(([verdict, label]) => understandingAction('review', label, { facet: facet.id, verdict }, busy)).join('') : ''}${editable ? understandingAction('edit', facet.id === 'topics' ? '관심 주제 고르기' : '직접 수정하기', { facet: facet.id }, busy) : ''}</div>` : ''}${understandingEditor(facet, state)}</div>`;
  }).join('')}</div>`;
}

function relationEvidence(row) {
  if (!list(row.evidence).length) return '';
  return `<details class="mi-facet-evidence mi-relation-evidence"><summary>이 설명을 연결한 근거</summary><p class="mi-relation-certainty">${row.certainty === 'declared' ? '내가 확인한 내용에서 연결했어요.' : row.certainty === 'observed' ? '연결한 기록에서 함께 살펴봤어요.' : '확정하기 전에 함께 확인할 부분이에요.'}</p><ul>${list(row.evidence).slice(0, 6).map(item => `<li><span>${escape(evidenceLabels.get(item.kind) || '연결된 근거')}</span>${escape(item.label)}</li>`).join('')}</ul></details>`;
}

function understandingRelations(report, summarized = []) {
  if (report.understanding?.status !== 'ready') return '';
  const relations = list(report.understanding.relations).slice(0, 4).filter(row => !summarized.includes(row.line));
  if (!relations.length) return '';
  return `<section class="mi-relations" aria-label="관심과 이용 방식을 함께 살펴본 설명"><h3>관심과 이용 방식을 함께 보면</h3>${relations.map(row => `<div class="mi-relation"><p>${escape(row.line)}</p>${relationEvidence(row)}</div>`).join('')}</section>`;
}

function clarificationHistory(value, { editable = false, busy = false } = {}) {
  const answers = list(value).filter(row => typeof row.questionLabel === 'string' && typeof row.optionLabel === 'string').slice(0, 12);
  if (!answers.length) return '';
  return `<details class="mi-clarification-history"><summary>뜻을 보완한 답변 ${count(answers.length)}개</summary><ol>${answers.map(row => `<li><p>${escape(row.questionLabel)}</p><strong>${escape(row.optionLabel)}</strong></li>`).join('')}</ol>${editable ? understandingAction('reset-answers', '답변 다시 고르기', {}, busy) : ''}</details>`;
}

function statementPanel(report, state) {
  const editor = state.understandingStatementEditor;
  const busy = state.understandingPending === true;
  if (!editor) {
    if (report.understanding?.status !== 'ready' || state.understandingEditor) return '';
    return `<div class="mi-statement-entry"><div><h3>내 말로 설명을 고쳐 볼까요?</h3><p>좋아하는 것과 편한 방식, 상황에 따라 다른 점을 적고 해석을 확인할 수 있어요.</p></div>${understandingAction('describe', '내 말로 고치기', {}, busy)}</div>`;
  }
  const source = typeof editor.text === 'string' ? [...editor.text].slice(0, 500).join('') : '';
  const preview = editor.stage === 'preview' && editor.preview?.text === source
    && JSON.stringify(editor.preview.clarifications || []) === JSON.stringify(editor.clarifications || []) ? editor.preview : null;
  if (!preview) return `<form class="mi-understanding-editor mi-statement-editor" data-insight-statement-editor aria-label="내 말로 설명 고치기"${busy ? ' aria-busy="true"' : ''}><h3 tabindex="-1" data-insight-editor-title>내 말로 설명 고치기</h3><label class="mi-note-label">나에 대해 알려 주세요 <span>500자 이내</span><textarea data-insight-field="statement" name="insight-statement" maxlength="1000" rows="5" placeholder="예: 회의에서는 다른 사람의 의견을 듣고 정리하는 편이에요."${busy ? ' disabled' : ''}>${escape(source)}</textarea></label><p>배우는 방식, 소통과 일 처리 방식, 관심사를 적어 주세요. 이해한 뜻을 먼저 보여드리고, 직접 확인한 해석만 다음 설명에 반영해요.</p><div class="mi-editor-actions">${understandingAction('preview', busy ? '확인 중…' : '해석 미리보기', {}, busy || !source.trim(), true)}${understandingAction('cancel', '취소', {}, busy)}</div></form>`;
  const proposals = list(preview.proposals).filter(row => safeId(row.id) && ['prefer', 'avoid'].includes(row.polarity) && (row.condition === null || conditionLabels.has(row.condition)) && ['pending', 'conflict'].includes(row.status) && typeof row.confirmable === 'boolean').slice(0, 8);
  const accepted = new Set(Array.isArray(editor.acceptedIds) ? editor.acceptedIds : []);
  const selected = proposals.filter(row => row.confirmable === true && accepted.has(row.id));
  const unresolved = list(preview.unresolved).slice(0, 12);
  const question = preview.question && safeId(preview.question.id) && typeof preview.question.label === 'string' ? preview.question : null;
  const options = question ? list(question.options).filter(option => safeId(option.id) && typeof option.label === 'string').slice(0, 12) : [];
  const answerHistory = clarificationHistory(preview.clarificationAnswers, { editable: true, busy });
  const questionPanel = question ? `<section class="mi-statement-question" aria-labelledby="mi-statement-question-title"><h4 id="mi-statement-question-title" tabindex="-1" data-insight-question-title>${escape(question.label)}</h4><p>뜻을 단정하지 않도록 하나만 확인할게요. 답변만으로 저장되지는 않아요.</p><div class="mi-question-options">${options.map(option => understandingAction('answer-statement', option.label, { question: question.id, option: option.id }, busy)).join('')}</div></section>` : '';
  const proposalPanel = proposals.length ? `<div class="mi-statement-proposals">${proposals.map(row => `<div class="mi-statement-proposal"><label><input type="checkbox" name="insight-proposal" data-insight-proposal="${escape(row.id)}" value="${escape(row.id)}"${row.confirmable === true && accepted.has(row.id) ? ' checked' : ''}${busy || question || row.confirmable !== true ? ' disabled' : ''}><span>${escape(row.summary)}</span></label><p class="mi-statement-meaning">${row.polarity === 'avoid' ? '선호하지 않음' : '선호하는 내용'}${conditionLabels.has(row.condition) ? ` · ${escape(conditionLabels.get(row.condition))}에만` : ' · 별도 조건 없음'}</p><blockquote>${escape(row.evidence?.quote || '')}</blockquote>${row.reasonLabel ? `<p class="mi-statement-reason">${escape(row.reasonLabel)}</p>` : ''}</div>`).join('')}</div>` : question ? '' : '<p class="mi-statement-empty">아직 확인해 반영할 해석을 찾지 못했어요. 아래 내용을 참고해 말을 조금 바꿔 보세요.</p>';
  const unresolvedPanel = unresolved.length ? `<div class="mi-unresolved"><h4>아직 반영하지 않은 부분</h4><p>뜻이나 적용 범위를 단정하기 어려워 남겨 두었어요.</p>${unresolved.map(row => `<div><blockquote>${escape(row.quote)}</blockquote><p>${escape(text(row.reasonLabel, '이 부분의 뜻을 아직 확인하지 못했어요.'))}</p></div>`).join('')}</div>` : '';
  return `<div class="mi-understanding-editor mi-statement-editor" data-insight-statement-editor aria-label="내 서술의 해석 미리보기"${busy ? ' aria-busy="true"' : ''}><h3 tabindex="-1" data-insight-editor-title>${question ? '한 가지만 더 알려 주세요' : '이렇게 이해했어요'}</h3><p>${question ? '추가 질문을 확인한 뒤 반영할 해석을 고를 수 있어요. 아직 모르겠다면 건너뛰어도 돼요.' : '맞는 해석만 골라 주세요. 선택하지 않은 뜻과 아래의 미해석 부분은 반영하지 않아요.'}</p><details class="mi-statement-source"><summary>내가 쓴 원문</summary><blockquote>${escape(source)}</blockquote></details>${answerHistory ? `<p class="mi-clarification-notice" role="status">답변으로 뜻을 보완했어요. 마지막에 선택한 해석만 저장해요.</p>${answerHistory}` : ''}${questionPanel}${proposalPanel}${unresolvedPanel}<p class="mi-save-explanation">선택한 해석과 그 근거가 된 원문${answerHistory ? '·답변' : ''}을 저장하고 다음 설명에 반영해요. 실제 앱 설정이나 이용 기록은 바꾸지 않아요.</p><div class="mi-editor-actions">${proposals.some(row => row.confirmable === true) ? understandingAction('confirm-statement', busy ? '반영 중…' : `선택한 해석 ${count(selected.length)}개 반영`, {}, busy || !!question || !selected.length, true) : ''}${understandingAction('edit-text', '원문 고치기', {}, busy)}${understandingAction('cancel', '취소', {}, busy)}</div></div>`;
}

function understandingHistory(report, state) {
  const understanding = report.understanding;
  if (!understanding || understanding.status !== 'ready') return '';
  const rows = list(understanding.history).filter(row => ['review', 'override'].includes(row.kind) && facetId(row.facetId));
  const statements = list(understanding.statementHistory).filter(row => safeId(row.id)).slice(0, 20);
  const busy = state.understandingPending === true;
  const statementRows = statements.map(row => `<li class="mi-statement-history-row"><div><h3>내 말로 확인한 내용</h3><p>${row.active ? '현재 설명에 반영 중이에요.' : '현재 설명에는 반영되지 않는 내역이에요.'}</p><div class="mi-statement-meanings">${list(row.meanings).slice(0, 8).map(meaning => `<div><p>${escape(meaning.line)}</p><span>${conditionLabels.has(meaning.condition) ? escape(conditionLabels.get(meaning.condition)) + '에만 · ' : ''}${meaning.active ? '현재 반영' : '현재 미반영'}</span></div>`).join('')}</div><details class="mi-statement-source"><summary>내 원문과 해석 근거 보기</summary><blockquote>${escape(row.text)}</blockquote>${list(row.meanings).map(meaning => `<p>${escape(meaning.line)}</p><blockquote>${escape(meaning.quote)}</blockquote>`).join('')}</details>${clarificationHistory(row.clarificationAnswers)}${dateLine(row.at, '확인·저장')}</div>${understandingAction('remove-statement', '이 서술 되돌리기', { id: row.id }, busy)}</li>`).join('');
  return `<details class="mi-understanding-history"><summary>내가 확인·수정한 내용 <span>${count(rows.length + statements.length)}건</span></summary><div><p>되돌리면 이 확인·수정을 이후 설명에 사용하지 않아요. 실제 이용 기록은 그대로 남아요.</p>${rows.length || statements.length ? `<ul>${statementRows}${rows.map(row => `<li><div><h3>${escape(row.title)}</h3><p>${escape(row.line)}</p>${row.note ? `<p class="mi-history-note">내가 덧붙인 말: ${escape(row.note)}</p>` : ''}${dateLine(row.at, '저장')}</div>${understandingAction('remove', row.kind === 'review' ? '이 확인 되돌리기' : '이 수정 되돌리기', { kind: row.kind, id: row.id, facet: row.facetId }, busy)}</li>`).join('')}</ul><div class="mi-history-clear"><p>확인·수정한 내용과 직접 쓴 서술을 모두 지우고, 연결한 원래 기록을 기준으로 다시 설명해요.</p>${understandingAction('clear', '확인·수정한 내용 모두 지우기', {}, busy)}</div>` : '<p class="mi-history-empty">아직 직접 확인하거나 수정해 저장한 내용이 없어요.</p>'}</div></details>`;
}

function understandingNotice(report, state) {
  const status = report.understanding?.status;
  const message = text(state.understandingMessage);
  if (message) return `<p class="mi-understanding-notice" role="status" aria-live="polite">${escape(message)}</p>`;
  if (status === 'loading') return '<p class="mi-understanding-notice" role="status">직접 확인·수정한 내용을 불러오고 있어요.</p>';
  if (status === 'error') return `<p class="mi-understanding-notice" role="status">확인·수정한 내용을 불러오지 못했어요. 새로 확인하기로 다시 불러와 주세요.</p>`;
  return '';
}

function interruptedUnderstandingEditor(report, state) {
  const editor = state.understandingEditor;
  if (!editor?.facet || editor.facet.id !== editor.facetId || !facetId(editor.facetId)) return '';
  if (report.understanding?.status === 'ready') {
    const current = list(report.understanding.facets).find(facet => facet.id === editor.facetId);
    if (current?.available && (editor.mode === 'override' || current.claim && verdictLabels.has(editor.verdict))) return '';
    // A removed or disconnected observation cannot reuse its captured claim or choices.
    // Keep the user's unsaved words accessible, with cancellation but no save action.
    const note = typeof editor.note === 'string' ? [...editor.note].slice(0, 200).join('') : '';
    return `<div class="mi-interrupted-editor"><p>현재 연결한 기록으로 이 항목을 확인할 수 없어 저장을 멈췄어요. 입력은 아직 저장되지 않았어요.</p><div class="mi-understanding-editor"><h4>저장 전 입력</h4>${note ? `<label class="mi-note-label">내가 덧붙인 말<textarea rows="3" readonly>${escape(note)}</textarea></label>` : '<p>덧붙인 말은 없어요.</p>'}<p>취소하거나 연결을 확인한 뒤 새로 확인해 주세요.</p><div class="mi-editor-actions">${understandingAction('cancel', '취소', {}, state.understandingPending === true)}</div></div></div>`;
  }
  // The captured facet belongs only to this unsaved editor, never the analysis.
  return `<div class="mi-interrupted-editor"><p>저장되지 않은 입력이에요. 연결을 다시 확인한 뒤 반영하거나 취소할 수 있어요.</p>${understandingEditor(editor.facet, state)}</div>`;
}

function understandingActivities(report, state) {
  if (report.understanding?.status !== 'ready') return '';
  const activities = list(report.understanding.activities).filter(item => activityTargets.has(item.targetId) && item.basis === 'self-declared').slice(0, 3);
  if (!activities.length) return '';
  return `<div class="mi-next-activities mi-understanding-next"><h3>내가 알려준 관심에서 이어가기</h3><ul>${activities.map(item => `<li><div><p>${escape(item.reason)}</p></div>${activityAction(item.targetId, state.activityPending === true || state.understandingPending === true)}</li>`).join('')}</ul></div>`;
}

function personalSection(report, declaredOnly, pending, state) {
  const items = list(report.personal).filter(item => !declaredOnly || item.basis === 'self-declared');
  const interest = items.find(item => item.id === 'reasons' || item.id === 'goal');
  const settings = items.filter(item => item !== interest);
  const allDeclared = settings.every(item => item.basis === 'self-declared');
  const understanding = report.understanding?.status === 'ready' ? report.understanding : null;
  const hasDeclaredUnderstanding = list(understanding?.facets).some(facet => facet.available === true && facet.basis === 'self-declared')
    || list(understanding?.statementHistory).some(statement => statement.active === true && list(statement.meanings).some(meaning => meaning.active === true));
  let body = interest ? `<dl class="mi-personal-list"><div class="mi-personal-row"><dt><span class="mi-basis">${interest.basis === 'self-declared' ? '직접 알려준 정보' : '이용 기록에서 확인'}</span><span>${escape(interest.title)}</span></dt><dd><p class="mi-personal-value">${escape(interest.value)}</p>${interest.detail ? `<p class="mi-row-detail">${escape(interest.detail)}</p>` : ''}${dateLine(interest.at, '정보 기록')}</dd></div></dl>` : '';
  if (settings.length) body += `<div class="mi-preferences"><h3>${allDeclared ? '직접 고른 이용 설정' : '이용 방식'}</h3><dl class="mi-preference-list">${settings.map(item => `<div><dt>${escape(item.title)}${allDeclared ? '' : `<span class="mi-basis">${item.basis === 'self-declared' ? '직접 알려준 정보' : '이용 기록에서 확인'}</span>`}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl></div>`;
  if (!items.length && !hasDeclaredUnderstanding) body = empty('아직 나를 소개할 정보가 없어요.', 'SYNK에서 직접 알려준 배우는 이유와 선호 설정이 모이면 이곳에서 함께 볼 수 있어요.');
  return `<section class="mi-section" aria-labelledby="insight-personal-title">${sectionHeading('01', 'insight-personal-title', '나의 관심사·선호', '내가 알려준 선호와 이용 기록을 구분해서 살펴봐요.')}${understandingFacets(report, state, 'personal')}${body}${activityInterest(report, pending)}</section>`;
}

function learningSection(report, declaredOnly, pending, state) {
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
    if (content.length) body += `<div class="mi-practice"><h3>이어서 살펴볼 내용</h3><ul class="mi-content-list">${content.map(item => `<li><div><h4>${escape(item.label)}</h4><p>${item.status === 'review' ? '연결된 연습 기록에서 다시 살펴볼 내용으로 정리됐어요.' : '연결된 기록에서 연습 중인 내용이에요.'} WORLD에서 관련 연습을 골라 보세요.</p></div>${activityAction('world', pending)}</li>`).join('')}</ul></div>`;
  }
  if (!declaredOnly) body += periodComparison(learning.periods, 'learning');
  return `<section class="mi-section" aria-labelledby="insight-learning-title">${sectionHeading('02', 'insight-learning-title', '학습 성향·성장', '실제 연습 기록에서 응답한 내용과 도움을 쓴 순간을 돌아봐요.')}${understandingFacets(report, state, 'learning')}${body}<p class="mi-section-note">연습 요약이며 전체 실력이나 학습 효과를 판정하지 않아요.</p></section>`;
}

function evidence(report) {
  const reasons = list(report.reasons);
  const limits = [...(Array.isArray(report.limits) ? report.limits : []), ...(report.understanding?.status === 'ready' && Array.isArray(report.understanding.limitations) ? report.understanding.limitations : [])].filter(item => typeof item === 'string' && item.trim());
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

export function renderMemberInsight(state = {}, { native = false, poster = null } = {}) {
  state = state && typeof state === 'object' ? state : {};
  const report = state.status === 'ready' && state.report && typeof state.report === 'object' ? state.report : null;
  const status = report ? 'ready' : ['loading', 'signed-out', 'unconfigured', 'error'].includes(state.status) ? state.status : 'error';
  const back = native ? `<button type="button" class="mi-back" data-view="benefits">${arrow}회원 혜택 모두 보기</button>` : `<a class="mi-back" href="#benefits">${arrow}회원 혜택 모두 보기</a>`;
  // 포스터(물건·번호 라벨·상태 스티커)는 PC 앱만 넘긴다 — 다른 혜택 소개 머리와 같은 틀. 웹 플랫폼은 그림 없이 원래 머리.
  const art = poster && typeof poster.art === 'string' ? poster.art : '';
  const top = art
    ? `<img class="mi-object" src="${escape(art)}" alt=""><div class="mi-hero-top"><span class="mi-eyebrow">${escape(text(poster.label, 'SYNK FOR YOU / ATLAS'))}</span>${poster.badge ? `<span class="mi-badge${poster.status === 'integrated' ? ' is-integrated' : ''}"><span class="mi-led" aria-hidden="true"></span>${escape(poster.badge)}</span>` : ''}</div>`
    : '<span class="mi-eyebrow">SYNK FOR YOU / ATLAS</span>';
  const intro = `<header class="mi-hero${art ? ' has-art' : ''}">${top}<div class="mi-hero-title"><h1 id="benefit-title" tabindex="-1">내 성향</h1><p>내가 고른 것과 <br>해본 것에서 발견하는 나.</p></div><p class="mi-hero-note">관심사·선호와 학습 기록, 두 가지 시선으로 살펴봐요.</p></header>`;
  let body;
  if (!report) body = pending({ ...state, status });
  else {
    const declaredOnly = report.shared === 'declared-only';
    const understanding = report.understanding?.status === 'ready' ? report.understanding : null;
    const paragraphs = understanding && Array.isArray(understanding.paragraphs) ? understanding.paragraphs.filter(line => typeof line === 'string').slice(0, 8) : [];
    const summaryParagraph = line => {
      const relation = list(understanding?.relations).find(row => row.line === line);
      return `<div class="mi-summary-paragraph"><p>${escape(line)}</p>${relation ? relationEvidence(relation) : ''}</div>`;
    };
    body = `<div class="mi-summary"><div><span class="mi-summary-label">${understanding ? '최근 기록을 이렇게 읽었어요' : '지금 확인할 수 있는 나'}</span><h2>${escape(text(understanding?.headline, text(report.headline, '기록에서 나를 조금씩 알아가요.')))}</h2>${paragraphs.length ? paragraphs.map(summaryParagraph).join('') : `<p>${escape(text(report.description, '직접 알려준 내용과 연습한 기록을 함께 정리했어요.'))}</p>`}</div>${action('refresh', '새로 확인하기', !state.understandingEditor && !state.understandingStatementEditor, state.understandingPending === true)}</div>`;
    body += understandingNotice(report, state);
    body += understandingRelations(report, paragraphs);
    body += statementPanel(report, state);
    body += interruptedUnderstandingEditor(report, state);
    body += understandingActivities(report, state);
    if (declaredOnly) body += `<aside class="mi-consent" aria-label="학습 기록 연결 상태"><div><strong>학습 기록 연결이 꺼져 있어요.</strong><p>학습 정보는 직접 알려준 배우는 이유만 보여요. 앱 이용 기록은 별도로 연결할 수 있어요.</p></div>${action('account', '계정 설정')}</aside>`;
    body += personalSection(report, declaredOnly, state.activityPending === true, state) + learningSection(report, declaredOnly, state.activityPending === true, state);
    body += understandingHistory(report, state);
    if (!declaredOnly) body += `<div class="mi-settings"><p>내 정보가 달라졌다면</p>${action('account', '내 정보·연결 설정 확인')}</div>`;
    body += evidence(report);
  }
  return `<article class="member-insight" data-insight-status="${status}" aria-labelledby="benefit-title"${status === 'loading' ? ' aria-busy="true"' : ''}>${back}${intro}${body}</article>`;
}
