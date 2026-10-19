// Shared member view of 「내 성향」 (web platform and PC launcher). Six layers: the poster and
// 「지금의 나」 side by side, what I chose and what I tried, the 30-day comparison, and the floor
// (basis, my corrections, app-use consent). The account controllers own loading, consent and saves;
// this module renders the report and keeps no data. Sentences come from Vellum through the report
// (atlas/vellum-insight.js); only labels and fixed explanations live here.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const number = value => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0).toLocaleString('ko-KR');
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const facetId = value => typeof value === 'string' && /^(?:topics|support|explanation|usage-repeat|practice-mode|practice-response|learning-topic:[A-Za-z0-9][A-Za-z0-9_.-]{0,79})$/.test(value);
const activityTargets = new Map([['world', 'WORLD에서 연습 고르기'], ['messenger', 'Workspace 열기'], ['path', 'PATH 열기'], ['pulse', 'PULSE 열기']]);
const VERDICTS = [['agree', '맞아요'], ['disagree', '아니에요'], ['contextual', '때에 따라 달라요']];
const TOPIC_ANSWERS = [['interested', '더 배우고 싶어요'], ['practice-only', '연습에서 나온 것뿐이에요'], ['not-now', '지금은 아니에요']];
// A practice cell is never a grade: 「혼자 해냄」 says what happened in the recent window.
const STATUS = {
  'recent-independent': { group: 'strong', tag: '혼자 해냄' }, supported: { group: 'strong', tag: '도움 받고 해냄' },
  practice: { group: 'more', tag: '한 번 더' }, review: { group: 'more', tag: '다시 볼 때' }, checking: { group: 'more', tag: '확인 중' }, unseen: { group: 'more', tag: '기록이 적음' },
};
const FACET_TITLES = { topics: '관심 주제', support: '도움 방식', explanation: '설명 길이', 'usage-repeat': '자주 연 앱', 'practice-mode': '연습 방식', 'practice-response': '문제 방식' };
const conditionLabels = new Map([['first-try', '처음 시도할 때'], ['familiar', '익숙한 내용일 때'], ['busy', '바쁠 때'],
  ['after-example', '예시를 본 다음'], ['first-try-after-example', '처음 시도하며 예시를 본 다음'], ['familiar-after-example', '익숙한 내용의 예시를 본 다음'], ['busy-after-example', '바쁠 때 예시를 본 다음'],
  ['meeting', '회의할 때'], ['teamwork', '함께 일할 때'], ['planning', '계획을 세울 때'], ['decision', '결정할 때']]);
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
const seoulDate = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
const dateLabel = value => { const time = Date.parse(value); return Number.isFinite(time) ? seoulDate.format(new Date(time)) : ''; };
const dateTag = value => { const label = dateLabel(value); return label ? `<time datetime="${escape(new Date(Date.parse(value)).toISOString())}">${escape(label)}</time>` : ''; };

const attributes = (values = {}) => Object.entries(values).map(([key, value]) => ` data-insight-${key}="${escape(value)}"`).join('');
const pill = (name, label, values = {}, disabled = false) => `<button type="button" class="mi2-pill" data-insight-action="${name}"${attributes(values)}${disabled ? ' disabled' : ''}><span class="mi2-led" aria-hidden="true"></span>${escape(label)}</button>`;
const ghost = (name, label, values = {}, disabled = false, extra = '') => `<button type="button" class="mi2-ghost${extra ? ' ' + extra : ''}" data-insight-action="${name}"${attributes(values)}${disabled ? ' disabled' : ''}>${escape(label)}</button>`;
const link = (name, label, values = {}, disabled = false, extra = '') => `<button type="button" class="mi2-link${extra ? ' ' + extra : ''}" data-insight-action="${name}"${attributes(values)}${disabled ? ' disabled' : ''}>${escape(label)}</button>`;
const choiceLabel = (facet, id) => list(facet?.choices).find(choice => choice.id === id)?.label || '';

// ── What the report says, arranged for the screen ─────────────────────────────────────────────
function present(report, state) {
  const learning = report.learning && typeof report.learning === 'object' ? report.learning : {};
  const periods = learning.periods || null, recent = periods?.recent || null, previous = periods?.previous || null;
  const understanding = report.understanding?.status === 'ready' ? report.understanding : null;
  const facets = list(understanding?.facets);
  const facet = id => facets.find(row => row.id === id);
  const disconnected = report.shared === 'declared-only';
  const answeredAny = !disconnected && learning.answered > 0;
  const skills = list(learning.skills), content = list(learning.content), topics = list(learning.topics);
  // If Vellum could not say it, keep every block of a member who has records rather than an empty page.
  const now = report.now && typeof report.now.headline === 'string' ? report.now
    : { kind: answeredAny ? 'volume' : disconnected ? 'disconnected' : 'declared', headline: '내 기록을 정리했어요.', support: [] };
  const kind = now.kind;
  const busy = state.understandingPending === true;
  const worldReads = report.worldReadsAnswers === true, worldFollows = report.worldFollowsSettings === true;
  // A setting is changed here only where WORLD follows it; otherwise WORLD would write its own back.
  const settingsWritable = worldFollows && state.settingsWritable === true && !disconnected && report.learningEnabled === true;

  // 다음 한 걸음: 다시 볼 내용 → 더 연습할 항목 → 이어서 연습 → 첫 연습.
  const review = content.find(row => row.status === 'review') || content[0] || null;
  const practiceSkill = skills.find(skill => STATUS[skill.status]?.group === 'more') || null;
  const next = disconnected ? { title: '', why: '', action: 'account', label: '계정에서 연결 켜기' }
    : answeredAny ? { title: review?.label || practiceSkill?.label || '', why: review ? '연습 기록에서 다시 보면 좋은 내용으로 정리됐어요.' : practiceSkill ? practiceSkill.fact || '' : '', action: 'activity', label: 'WORLD에서 이어서 하기' }
      : { title: '', why: '', action: 'activity', label: 'WORLD에서 첫 연습 해 보기' };

  // 숫자 셋(최근 30일). 혼자 답한 횟수가 0이면 그 칸에 연습한 가짓수를 둔다.
  const top = [...topics].sort((a, b) => b.count - a.count || b.activeDays - a.activeDays)[0] || null;
  const alike = top ? topics.filter(row => row.word === top.word).length : 0;
  const numbers = answeredAny && recent?.answered ? [
    [recent.answered, '번', '답함'],
    recent.independent ? [recent.independent, '번', '혼자 답함'] : alike ? [alike, '가지', `연습한 ${top.word}`] : [recent.assisted, '번', '도움 받고 답함'],
    [recent.activeDays, '일', '연습한 날'],
  ] : [];

  // 내가 고른 것.
  const personal = id => list(report.personal).find(row => row.id === id);
  const topicsFacet = facet('topics');
  const told = [];
  told.push({ key: 'reasons', label: '배우는 이유', value: personal('reasons')?.value || '', empty: '아직 안 골랐어요', detail: list(report.reasons)[0]?.line || '',
    action: link('account', personal('reasons') ? '바꾸기' : '알려 주기', {}, false, 'mi2-row-action') });
  const topicLabels = (topicsFacet?.selected || []).map(id => choiceLabel(topicsFacet, id)).filter(Boolean);
  told.push({ key: 'topics', label: '관심 주제', value: topicLabels.join(' · '), empty: '아직 안 골랐어요',
    mark: topicsFacet?.override?.at ? { label: '내가 고름', at: topicsFacet.override.at, undo: understanding?.history?.find(row => row.kind === 'override' && row.facetId === 'topics') } : null,
    action: topicsFacet?.available && list(topicsFacet.choices).length ? link('understanding-edit', topicLabels.length ? '고치기' : '고르기', { facet: 'topics' }, busy, 'mi2-row-action') : '' });
  // 학습 기록 연결이 꺼지면 설정 값도 넘어오지 않으므로 「안 골랐어요」라고 쓰지 않고 줄을 감춘다.
  if (!disconnected) {
    for (const [field, label] of [['support', '편한 도움 방식'], ['explanation', '편한 설명 길이']]) {
      told.push({ key: field, label, value: personal(field)?.value || '', empty: '아직 안 골랐어요',
        action: settingsWritable ? link('settings-edit', personal(field) ? '고치기' : '고르기', { field }, state.settingsPending === true, 'mi2-row-action') : '' });
    }
    const looks = ['textSize', 'motion', 'audio'].map(id => personal(id)?.value).filter(Boolean);
    told.push({ key: 'looks', label: '글씨·움직임·소리', value: looks.join(' · '), empty: '기본 설정' });
  }
  const statement = list(understanding?.statementHistory).find(row => row.active && safeId(row.id));
  if (statement) told.push({ key: 'statement', label: '내 말', value: `「${statement.text}」`, mark: { label: '내가 알려 줌', at: statement.at, undoStatement: statement.id } });
  const toldCount = told.filter(row => row.value).length;

  // 내가 해본 것.
  const strongRows = skills.filter(skill => STATUS[skill.status]?.group === 'strong').map(skill => ({ title: skill.label, tag: STATUS[skill.status].tag,
    fact: skill.fact || '도움을 받으며 해냈어요.' }));
  const moreRows = [
    // The item chosen as the next step already has its reason above; here it only says so.
    ...content.map(row => ({ title: row.label, tag: row.status === 'review' ? '다시 볼 때' : '연습 중', next: row === review,
      fact: row === review ? '다음 한 걸음으로 골랐어요.' : row.status === 'review' ? '연습 기록에서 다시 보면 좋은 내용으로 정리됐어요.' : '지금 연습하고 있는 내용이에요.' })),
    ...skills.filter(skill => STATUS[skill.status]?.group === 'more').map(skill => ({ title: skill.label, tag: STATUS[skill.status].tag, fact: skill.fact || '아직 기록이 적어요.' })),
  ].filter((row, index, rows) => rows.findIndex(other => other.title === row.title) === index);
  const asked = [], tried = [];
  for (const row of facets) {
    if (!row.claim || !row.available || row.id === 'usage-repeat' || !row.question || !facetId(row.id)) continue;
    const reviewed = row.review ? VERDICTS.find(([id]) => id === row.review.verdict)?.[1] : null;
    const days = `${row.claim.activeDays}일 동안 ${row.claim.count}번`;
    if (row.id === 'practice-mode') asked.push({ facet: row, title: `${choiceLabel(row, row.claim.reference)} 연습`, fact: days, answers: VERDICTS, kind: 'verdict', answered: reviewed, current: row.review?.verdict, at: row.review?.at });
    else if (row.id === 'practice-response') asked.push({ facet: row, title: choiceLabel(row, row.claim.reference), fact: days, answers: VERDICTS, kind: 'verdict', answered: reviewed, current: row.review?.verdict, at: row.review?.at });
    else if (row.id.startsWith('learning-topic:')) {
      // 하루치 기록은 묻지 않는다. 이미 혼자 해낸 것·한 번 더 볼 것에 나온 이름도 다시 묻지 않는다.
      if ([...strongRows, ...moreRows].some(other => other.title === row.title)) continue;
      if (row.claim.activeDays < 2 && !row.override && !row.review) { tried.push({ title: row.title, fact: `${row.claim.count}번` }); continue; }
      const chosen = row.override ? TOPIC_ANSWERS.find(([id]) => row.override.values?.includes(id)) : null;
      asked.push({ facet: row, title: row.title, fact: days, answers: TOPIC_ANSWERS, kind: 'value', answered: chosen?.[1] || reviewed, current: chosen?.[0] || null, at: row.override?.at || row.review?.at });
    }
  }

  // 30일 비교(「늘었어요」는 답한 횟수·혼자 답한 횟수·연습한 날에만).
  const activity = report.activity || { status: 'unavailable' };
  const compare = answeredAny && periods?.sufficient && previous && recent ? [
    ['답한 횟수', previous.answered, recent.answered, '번', true], ['혼자 답한 횟수', previous.independent, recent.independent, '번', true],
    ['도움 받고 답한 횟수', previous.assisted, recent.assisted, '번', false], ['연습한 날', previous.activeDays, recent.activeDays, '일', true],
    ...(activity.status === 'ready' && activity.periods?.sufficient ? [['앱을 연 날', activity.periods.previous.activeDays, activity.periods.recent.activeDays, '일', false]] : []),
  ] : [];
  const history = list(understanding?.history).length + list(understanding?.statementHistory).length;
  return { kind, now, next, numbers, told, toldCount, strongRows, moreRows, asked, tried, compare, history, busy, worldReads, worldFollows, settingsWritable,
    disconnected, answeredAny, understanding, activities: list(understanding?.activities).filter(row => activityTargets.has(row.targetId) && row.basis === 'self-declared').slice(0, 3),
    empty: ['empty', 'declared', 'disconnected'].includes(kind), periodsShort: answeredAny && !periods?.sufficient, asOf: report.asOf, activity };
}

// ── Editors (kept from the earlier view: same actions, same saves) ─────────────────────────────
function understandingEditor(facet, state) {
  const editor = state.understandingEditor;
  if (!editor || editor.facetId !== facet.id || editor.mode !== 'override' || facet.available !== true) return '';
  const busy = state.understandingPending === true;
  const choices = list(facet.choices).filter(choice => safeId(choice.id));
  const selected = new Set(Array.isArray(editor.values) ? editor.values : []);
  const note = typeof editor.note === 'string' ? [...editor.note].slice(0, 200).join('') : '';
  const heading = facet.id === 'topics' ? '관심 주제 고르기' : `${FACET_TITLES[facet.id] || text(facet.title, '내 정보')} 고치기`;
  return `<form class="mi2-editor mi-understanding-editor" data-insight-editor data-insight-facet="${escape(facet.id)}" aria-label="${escape(heading)}"${busy ? ' aria-busy="true"' : ''}><h4 tabindex="-1" data-insight-editor-title>${escape(heading)}</h4><fieldset><legend>${facet.multiple ? '해당하는 주제를 다섯 개까지 골라 주세요.' : '지금 나에게 맞는 것을 하나 골라 주세요.'}</legend><div class="mi-choice-list">${choices.map(choice => `<label><input type="${facet.multiple ? 'checkbox' : 'radio'}" name="insight-choice" value="${escape(choice.id)}"${selected.has(choice.id) ? ' checked' : ''}${busy ? ' disabled' : ''}><span>${escape(choice.label)}</span></label>`).join('')}</div></fieldset><label class="mi-note-label">덧붙이고 싶은 말 <span>선택 · 200자 이내</span><textarea data-insight-field="note" name="insight-note" maxlength="400" rows="3"${busy ? ' disabled' : ''}>${escape(note)}</textarea></label><p class="mi-save-explanation">이 화면 설명에 쓰도록 저장해요. 덧붙인 말은 내가 쓴 그대로 보여 주고, 뜻을 짐작하지 않아요.</p><div class="mi-editor-actions">${pill('understanding-save', busy ? '저장 중…' : '저장', {}, busy)}${ghost('understanding-cancel', '취소', {}, busy)}</div></form>`;
}

function settingsEditor(report, state) {
  const editor = state.settingsEditor;
  // The promise below holds only once WORLD follows these settings (WORLD_FOLLOWS_SETTINGS).
  if (!editor || report.worldFollowsSettings !== true || !['support', 'explanation'].includes(editor.field)) return '';
  const busy = state.settingsPending === true;
  const choices = list(report.settingChoices?.[editor.field]).filter(choice => safeId(choice.id));
  const current = editor.value ?? report.settings?.[editor.field] ?? null;
  const heading = editor.field === 'support' ? '편한 도움 방식 고치기' : '편한 설명 길이 고치기';
  return `<form class="mi2-editor mi-understanding-editor" data-insight-settings-editor data-insight-field="${escape(editor.field)}" aria-label="${escape(heading)}"${busy ? ' aria-busy="true"' : ''}><h4 tabindex="-1" data-insight-editor-title>${escape(heading)}</h4><fieldset><legend>하나를 골라 주세요.</legend><div class="mi-choice-list">${choices.map(choice => `<label><input type="radio" name="insight-setting" value="${escape(choice.id)}"${current === choice.id ? ' checked' : ''}${busy ? ' disabled' : ''}><span>${escape(choice.label)}</span></label>`).join('')}</div></fieldset><p class="mi-save-explanation">계정 설정에 바로 저장돼요. WORLD 연습과 다른 기기도 같은 설정을 써요.</p><div class="mi-editor-actions">${pill('settings-save', busy ? '저장 중…' : '저장', {}, busy || !current)}${ghost('settings-cancel', '취소', {}, busy)}</div></form>`;
}

function clarificationHistory(value, { editable = false, busy = false } = {}) {
  const answers = list(value).filter(row => typeof row.questionLabel === 'string' && typeof row.optionLabel === 'string').slice(0, 12);
  if (!answers.length) return '';
  return `<details class="mi-clarification-history"><summary>뜻을 보완한 답 ${number(answers.length)}개</summary><ol>${answers.map(row => `<li><p>${escape(row.questionLabel)}</p><strong>${escape(row.optionLabel)}</strong></li>`).join('')}</ol>${editable ? ghost('understanding-reset-answers', '답 다시 고르기', {}, busy) : ''}</details>`;
}

// 「내 말로 알려 주기」: write, see how it was understood, keep only the meanings chosen.
function statementEditor(report, state) {
  const editor = state.understandingStatementEditor;
  if (!editor || report.understanding?.status !== 'ready') return '';
  const busy = state.understandingPending === true;
  const source = typeof editor.text === 'string' ? [...editor.text].slice(0, 500).join('') : '';
  const preview = editor.stage === 'preview' && editor.preview?.text === source
    && JSON.stringify(editor.preview.clarifications || []) === JSON.stringify(editor.clarifications || []) ? editor.preview : null;
  if (!preview) return `<form class="mi2-editor mi-understanding-editor mi-statement-editor" data-insight-statement-editor aria-label="내 말로 알려 주기"${busy ? ' aria-busy="true"' : ''}><h4 tabindex="-1" data-insight-editor-title>내 말로 알려 주기</h4><label class="mi-note-label">나에 대해 알려 주세요 <span>500자 이내</span><textarea data-insight-field="statement" name="insight-statement" maxlength="1000" rows="5" placeholder="예: 처음엔 예시부터 보고, 그다음엔 혼자 해 보고 싶어요."${busy ? ' disabled' : ''}>${escape(source)}</textarea></label><p>배우는 방식, 편한 설명, 관심 있는 것을 적어 주세요. 이해한 뜻을 먼저 보여 드리고, 맞다고 고른 뜻만 저장해요.</p><div class="mi-editor-actions">${pill('understanding-preview', busy ? '확인 중…' : '이해한 뜻 보기', {}, busy || !source.trim())}${ghost('understanding-cancel', '취소', {}, busy)}</div></form>`;
  const proposals = list(preview.proposals).filter(row => safeId(row.id) && ['prefer', 'avoid'].includes(row.polarity) && (row.condition === null || conditionLabels.has(row.condition)) && ['pending', 'conflict'].includes(row.status) && typeof row.confirmable === 'boolean').slice(0, 8);
  const accepted = new Set(Array.isArray(editor.acceptedIds) ? editor.acceptedIds : []);
  const selected = proposals.filter(row => row.confirmable === true && accepted.has(row.id));
  const unresolved = list(preview.unresolved).slice(0, 12);
  const question = preview.question && safeId(preview.question.id) && typeof preview.question.label === 'string' ? preview.question : null;
  const options = question ? list(question.options).filter(option => safeId(option.id) && typeof option.label === 'string').slice(0, 12) : [];
  const answerHistory = clarificationHistory(preview.clarificationAnswers, { editable: true, busy });
  const questionPanel = question ? `<section class="mi-statement-question" aria-labelledby="mi-statement-question-title"><h4 id="mi-statement-question-title" tabindex="-1" data-insight-question-title>${escape(question.label)}</h4><p>뜻을 단정하지 않도록 하나만 확인할게요. 답만으로는 저장되지 않아요.</p><div class="mi-question-options">${options.map(option => ghost('understanding-answer-statement', option.label, { question: question.id, option: option.id }, busy)).join('')}</div></section>` : '';
  const proposalPanel = proposals.length ? `<div class="mi-statement-proposals">${proposals.map(row => `<div class="mi-statement-proposal"><label><input type="checkbox" name="insight-proposal" data-insight-proposal="${escape(row.id)}" value="${escape(row.id)}"${row.confirmable === true && accepted.has(row.id) ? ' checked' : ''}${busy || question || row.confirmable !== true ? ' disabled' : ''}><span>${escape(row.summary)}</span></label><p class="mi-statement-meaning">${row.polarity === 'avoid' ? '원하지 않는 것' : '원하는 것'}${conditionLabels.has(row.condition) ? ` · ${escape(conditionLabels.get(row.condition))}에만` : ' · 언제나'}</p><blockquote>${escape(row.evidence?.quote || '')}</blockquote>${row.reasonLabel ? `<p class="mi-statement-reason">${escape(row.reasonLabel)}</p>` : ''}</div>`).join('')}</div>` : question ? '' : '<p class="mi-statement-empty">아직 저장할 뜻을 찾지 못했어요. 아래를 참고해 말을 조금 바꿔 보세요.</p>';
  const unresolvedPanel = unresolved.length ? `<div class="mi-unresolved"><h4>아직 쓰지 않는 부분</h4><p>뜻이나 언제 그런지를 단정하기 어려워 남겨 두었어요.</p>${unresolved.map(row => `<div><blockquote>${escape(row.quote)}</blockquote><p>${escape(text(row.reasonLabel, '이 부분의 뜻을 아직 확인하지 못했어요.'))}</p></div>`).join('')}</div>` : '';
  return `<div class="mi2-editor mi-understanding-editor mi-statement-editor" data-insight-statement-editor aria-label="내 말을 이해한 뜻"${busy ? ' aria-busy="true"' : ''}><h4 tabindex="-1" data-insight-editor-title>${question ? '한 가지만 더 알려 주세요' : '이렇게 이해했어요'}</h4><p>${question ? '이 질문에 답한 뒤 저장할 뜻을 고를 수 있어요. 모르겠다면 건너뛰어도 돼요.' : '맞는 뜻만 골라 주세요. 고르지 않은 뜻과 아래 남겨 둔 부분은 저장하지 않아요.'}</p><details class="mi-statement-source"><summary>내가 쓴 말</summary><blockquote>${escape(source)}</blockquote></details>${answerHistory ? `<p class="mi-clarification-notice" role="status">답으로 뜻을 보완했어요. 마지막에 고른 뜻만 저장해요.</p>${answerHistory}` : ''}${questionPanel}${proposalPanel}${unresolvedPanel}<p class="mi-save-explanation">고른 뜻과 그 근거가 된 내 말${answerHistory ? '·답' : ''}을 저장해요. 앱 설정이나 이용 기록은 바꾸지 않아요.</p><div class="mi-editor-actions">${proposals.some(row => row.confirmable === true) ? pill('understanding-confirm-statement', busy ? '저장 중…' : `고른 뜻 ${number(selected.length)}개 저장`, {}, busy || !!question || !selected.length) : ''}${ghost('understanding-edit-text', '말 고치기', {}, busy)}${ghost('understanding-cancel', '취소', {}, busy)}</div></div>`;
}

// An editor whose source changed under it keeps the unsaved words, with cancel but no save.
function interruptedEditor(report, state) {
  const editor = state.understandingEditor;
  if (!editor?.facet || editor.facet.id !== editor.facetId || !facetId(editor.facetId)) return '';
  if (report.understanding?.status === 'ready') {
    const current = list(report.understanding.facets).find(row => row.id === editor.facetId);
    if (current?.available && editor.mode === 'override') return '';
    const note = typeof editor.note === 'string' ? [...editor.note].slice(0, 200).join('') : '';
    return `<div class="mi2-editor mi-understanding-editor mi-interrupted-editor"><p>지금 연결한 기록으로는 이 항목을 확인할 수 없어 저장을 멈췄어요. 입력한 내용은 아직 저장되지 않았어요.</p>${note ? `<label class="mi-note-label">덧붙인 말<textarea rows="3" readonly>${escape(note)}</textarea></label>` : ''}<div class="mi-editor-actions">${ghost('understanding-cancel', '취소', {}, state.understandingPending === true)}</div></div>`;
  }
  return `<div class="mi-interrupted-editor"><p class="mi2-foot">저장되지 않은 입력이에요. 연결을 다시 확인한 뒤 저장하거나 취소할 수 있어요.</p>${understandingEditor(editor.facet, state)}</div>`;
}

// ── Blocks ────────────────────────────────────────────────────────────────────────────────────
function answerControl(row, busy) {
  const chips = row.answers.map(([id, label]) => `<button type="button" class="mi2-chip" data-insight-action="understanding-answer" data-insight-facet="${escape(row.facet.id)}" data-insight-${row.kind}="${escape(id)}"${row.current === id ? ' aria-pressed="true"' : ''}${busy ? ' disabled' : ''} aria-label="${escape(row.title)}: ${escape(label)}">${escape(label)}</button>`).join('');
  if (row.answered) return `<details class="mi2-ask is-answered"><summary><span class="mi2-answer">내 답 · ${escape(row.answered)}</span>${row.at ? `<span class="mi2-date">${dateTag(row.at)}</span>` : ''}<span class="mi2-ask-btn">바꾸기</span></summary><div class="mi2-chips">${chips}</div></details>`;
  return `<details class="mi2-ask"><summary><span>${escape(row.facet.question)}</span><span class="mi2-ask-btn">답하기</span></summary><div class="mi2-chips">${chips}</div></details>`;
}

function toldBlock(report, state, vm) {
  const busy = vm.busy;
  const rows = vm.told.map(row => `<div class="mi2-told-row" data-insight-row="${escape(row.key)}"><dt>${escape(row.label)}</dt><dd><span class="${row.value ? 'mi2-value' : 'mi2-unset'}">${escape(row.value || row.empty)}</span>${row.detail && row.value ? `<span class="mi2-detail">${escape(row.detail)}</span>` : ''}${row.mark ? `<span class="mi2-edited">${escape(row.mark.label)} · ${dateTag(row.mark.at)}${row.mark.undo ? ` · ${link('understanding-remove', '되돌리기', { kind: row.mark.undo.kind, id: row.mark.undo.id, facet: row.mark.undo.facetId }, busy)}` : ''}${row.mark.undoStatement ? ` · ${link('understanding-remove-statement', '되돌리기', { id: row.mark.undoStatement }, busy)}` : ''}</span>` : ''}${row.action || ''}</dd></div>`).join('');
  const foot = vm.disconnected ? '학습 기록 연결을 켜면 도움 방식과 설명 길이도 여기서 함께 보여요.'
    : vm.settingsWritable ? '도움 방식·설명 길이를 여기서 고치면 계정 설정에 바로 저장되고, WORLD 연습도 같은 설정을 써요.'
      : vm.worldFollows ? '도움 방식·설명 길이는 지금 여기서 바꿀 수 없어요. WORLD 학습 목표에서 바꿔 주세요.'
        : '도움 방식·설명 길이는 WORLD 학습 목표에서 바꿔요.';
  const topics = vm.understanding ? list(vm.understanding.facets).find(row => row.id === 'topics') : null;
  const editors = `${topics ? understandingEditor(topics, state) : ''}${settingsEditor(report, state)}${statementEditor(report, state)}${interruptedEditor(report, state)}`;
  const say = vm.understanding && !state.understandingStatementEditor ? link('understanding-describe', '내 말로 알려 주기', {}, busy, 'mi2-say') : '';
  const apps = vm.activities.length ? `<div class="mi2-apps"><h4 class="mi2-sub">고른 관심과 이어지는 앱</h4><ul>${vm.activities.map(row => `<li><p>${escape(row.reason)}</p>${ghost('activity', activityTargets.get(row.targetId), { target: row.targetId }, busy || state.activityPending === true, 'mi2-small')}</li>`).join('')}</ul></div>` : '';
  const head = `<div class="mi2-block-head"><div><span class="mi2-label mi2-en">CHOSEN</span><h3 id="mi2-told-title">내가 고른 것</h3><p class="mi2-block-sub">직접 고르거나 알려 준 것이에요.</p></div></div>`;
  if (!vm.toldCount && !editors) return `<section class="mi2-block" id="mi2-told" aria-labelledby="mi2-told-title">${head}<p class="mi2-invite">아직 고른 것이 없어요. 배우는 이유를 알려 주면 그 이유에 맞는 연습 상황을 함께 보여 드려요.</p><div class="mi2-row">${ghost('account', '배우는 이유 알려 주기')}${topics?.available ? ghost('understanding-edit', '관심 주제 고르기', { facet: 'topics' }, busy) : ''}${say ? ghost('understanding-describe', '내 말로 알려 주기', {}, busy) : ''}</div></section>`;
  return `<section class="mi2-block" id="mi2-told" aria-labelledby="mi2-told-title">${head}<dl class="mi2-told">${rows}</dl>${editors}<p class="mi2-foot">${escape(foot)}</p>${say}${apps}</section>`;
}

function seenBlock(vm) {
  const rowList = rows => rows.map(row => `<li class="mi2-seen-row${row.next ? ' is-next' : ''}"><div class="mi2-seen-top"><h4>${escape(row.title)}</h4><span class="mi2-tag">${escape(row.tag)}</span></div><p>${escape(row.fact)}</p></li>`).join('');
  const askedRows = vm.asked.map(row => `<li class="mi2-seen-row" data-insight-facet-row="${escape(row.facet.id)}"><div class="mi2-seen-top"><h4>${escape(row.title)}</h4><span class="mi2-count">${escape(row.fact)}</span></div>${answerControl(row, vm.busy)}</li>`).join('');
  const askedFoot = vm.worldReads ? '기록일 뿐 내 취향으로 정하지 않았어요. 맞는지 알려 주면 WORLD 연습 고르기에 써요.'
    : '기록일 뿐 내 취향으로 정하지 않았어요. 맞는지 알려 주면 이 화면 설명에 먼저 써요. WORLD 연습 고르기에는 아직 쓰지 않아요.';
  const body = `${vm.strongRows.length ? `<h4 class="mi2-sub">혼자 해낸 것</h4><ul class="mi2-seen">${rowList(vm.strongRows)}</ul>` : ''}${vm.moreRows.length ? `<h4 class="mi2-sub">한 번 더 보면 좋은 것</h4><ul class="mi2-seen">${rowList(vm.moreRows)}</ul>` : ''}${vm.tried.length ? `<h4 class="mi2-sub">해 본 것</h4><p class="mi2-foot mi2-foot-top">하루치 기록이라 아직 묻지 않아요. 며칠 더 하면 맞는지 물어볼게요.</p><ul class="mi2-tried">${vm.tried.map(row => `<li><span>${escape(row.title)}</span><span class="mi2-count">${escape(row.fact)}</span></li>`).join('')}</ul>` : ''}${vm.asked.length ? `<h4 class="mi2-sub">자주 한 연습</h4><p class="mi2-foot mi2-foot-top">${escape(askedFoot)}</p><ul class="mi2-seen">${askedRows}</ul>` : ''}`;
  return `<section class="mi2-block mi2-seen-block" aria-labelledby="mi2-seen-title"><div class="mi2-block-head"><div><span class="mi2-label mi2-en">DONE</span><h3 id="mi2-seen-title">내가 해본 것</h3><p class="mi2-block-sub">연습 기록에서 보인 것이에요.</p></div></div>${body || '<p class="mi2-invite">연습 기록이 쌓이면 혼자 해낸 것과 한 번 더 볼 것을 여기서 나눠 보여 드려요.</p>'}</section>`;
}

function compareBlock(vm) {
  if (vm.compare.length) return `<section class="mi2-block mi2-compare" aria-labelledby="mi2-compare-title"><div class="mi2-block-head"><div><span class="mi2-label mi2-en">30 DAYS</span><h3 id="mi2-compare-title">그 전 30일과 비교</h3></div></div><table><caption class="mi2-hidden">그 전 30일과 최근 30일 비교</caption><thead><tr><th scope="col">기록</th><th scope="col">그 전 30일</th><th scope="col">최근 30일</th></tr></thead><tbody>${vm.compare.map(([label, before, after, unit, mark]) => `<tr><th scope="row">${escape(label)}</th><td>${number(before)}${unit}</td><td><b>${number(after)}${unit}</b>${mark && after > before ? ' <span class="mi2-up">늘었어요</span>' : ''}</td></tr>`).join('')}</tbody></table><p class="mi2-foot">해 본 횟수만 비교해요. 실력 점수가 아니에요.</p></section>`;
  return vm.periodsShort ? '<section class="mi2-block mi2-compare" aria-label="그 전 30일과 비교"><p class="mi2-foot">아직 비교할 만큼 기록이 쌓이지 않았어요. 며칠 더 쌓이면 그 전 30일과 견줘 보여 드려요.</p></section>' : '';
}

function historyFold(vm, state) {
  const understanding = vm.understanding;
  if (!understanding || !vm.history) return '';
  const busy = vm.busy;
  const rows = list(understanding.history).filter(row => ['review', 'override'].includes(row.kind) && facetId(row.facetId));
  const statements = list(understanding.statementHistory).filter(row => safeId(row.id)).slice(0, 20);
  const statementRows = statements.map(row => `<li><div><h4>내 말</h4><p>「${escape(row.text)}」</p><p class="mi2-foot">${row.active ? '지금 쓰고 있어요.' : '새로 알려 준 말이 있어 지금은 쓰지 않아요.'}</p>${clarificationHistory(row.clarificationAnswers)}<span class="mi2-date">${dateTag(row.at)}</span></div>${link('understanding-remove-statement', '되돌리기', { id: row.id }, busy)}</li>`).join('');
  const correctionRows = rows.map(row => `<li><div><h4>${escape(row.facetId.startsWith('learning-topic:') ? row.title : FACET_TITLES[row.facetId] || row.title)}</h4><p>${escape(row.line)}</p>${row.note ? `<p class="mi-history-note">덧붙인 말: ${escape(row.note)}</p>` : ''}<span class="mi2-date">${dateTag(row.at)}</span></div>${link('understanding-remove', '되돌리기', { kind: row.kind, id: row.id, facet: row.facetId }, busy)}</li>`).join('');
  const note = vm.worldReads ? '되돌리면 이 화면과 WORLD 연습에 더는 쓰지 않아요. 원래 연습 기록은 그대로 남아요.' : '되돌리면 이 화면 설명에 더는 쓰지 않아요. 원래 연습 기록은 그대로 남아요.';
  return `<details class="mi2-fold mi2-history"><summary>내가 고친 내역 ${number(vm.history)}건</summary><p>${escape(note)}</p><ul class="mi2-history-list">${statementRows}${correctionRows}</ul>${ghost('understanding-clear', '모두 지우기', {}, busy, 'mi2-small')}</details>`;
}

function floor(vm, state) {
  const activity = vm.activity;
  const on = ['ready', 'empty'].includes(activity.status), loading = activity.status === 'loading';
  const pending = state.activityPending === true;
  const basis = `<details class="mi2-fold" id="mi2-why"><summary>어떤 정보를 바탕으로 했나요?</summary><ul><li>내가 고른 것: 배우는 이유, 관심 주제, 도움 방식, 설명 길이, 글씨·움직임·소리 설정.</li>${vm.asOf && !vm.disconnected ? `<li>연습 기록: ${escape(dateLabel(vm.asOf))} 기준 최근 30일. 혼자 답한 횟수에는 틀린 답도 들어 있어요.</li>` : ''}<li>앱 이용 기록: ${on ? '켜져 있어요. 어떤 앱을 며칠 열었는지만 봐요.' : '꺼져 있어요.'} 메모나 고객 자료의 내용은 읽지 않아요.</li><li>점수, 급수, 성격 유형은 매기지 않아요.</li></ul>${link('refresh', '새로 불러오기', {}, vm.busy, 'mi2-refresh')}</details>`;
  const status = on ? `${vm.usageLine ? escape(vm.usageLine) + ' ' : ''}${activity.enabledAt ? escape(dateLabel(activity.enabledAt)) + '부터 모았고, ' : ''}끄면 모은 기록도 지워져요.`
    : loading ? '앱 이용 기록 연결 상태를 확인하고 있어요.' : activity.status === 'error' ? '앱 이용 기록을 불러오지 못했어요. 새로 불러오기로 다시 확인해 주세요.'
      : activity.status === 'unavailable' ? '이 환경에서는 앱 이용 기록 연결 상태를 확인할 수 없어요.' : '켜면 어떤 앱을 며칠 열었는지 함께 보여 드려요. 메모 내용은 읽지 않고, 끄면 모은 기록도 지워져요.';
  const toggle = ['ready', 'empty', 'disabled'].includes(activity.status) || loading ? ghost(on ? 'disable-activity' : 'enable-activity', pending ? '처리 중…' : on ? '끄기' : '켜기', {}, pending || loading, 'mi2-small') : '';
  const consent = `<div class="mi2-consent" aria-busy="${pending || loading}"><div><h4>${on ? '앱 이용 기록 켜짐' : '앱 이용 기록도 볼까요?'}</h4><p>${status}</p></div><div class="mi2-consent-actions">${toggle}${link('account', '내 정보·연결 설정', {}, false, 'mi2-account')}</div></div>`;
  return `<footer class="mi2-floor">${basis}${historyFold(vm, state)}${consent}</footer>`;
}

function poster(value) {
  const art = value && typeof value.art === 'string' ? value.art : '';
  return `<header class="mi2-poster">${art ? `<img class="mi2-object" src="${escape(art)}" alt="">` : ''}<div class="mi2-poster-top"><span class="mi2-eyebrow">${escape(text(value?.label, 'SYNK FOR YOU'))}</span>${value?.badge ? `<span class="mi2-badge${value.status === 'integrated' ? ' is-integrated' : ''}"><span class="mi2-badge-led" aria-hidden="true"></span>${escape(value.badge)}</span>` : ''}</div><div class="mi2-poster-title"><h1 id="benefit-title" tabindex="-1">내 성향</h1><p>내가 고른 것과 해본 것에서 발견하는 나.</p></div></header>`;
}

function notice(state, report) {
  const lines = [text(state.understandingMessage), text(state.settingsMessage)].filter(Boolean);
  if (!lines.length && report?.understanding?.status === 'error') lines.push('고친 내역을 불러오지 못했어요. 새로 불러오기로 다시 확인해 주세요.');
  return lines.length ? `<p class="mi2-notice" role="status" aria-live="polite">${lines.map(escape).join(' ')}</p>` : '';
}

function nowBlock(vm, state) {
  const numbers = vm.numbers.length ? `<dl class="mi2-numbers">${vm.numbers.map(([value, unit, label]) => `<div><dt>${escape(label)}</dt><dd><b>${number(value)}</b>${escape(unit)}</dd></div>`).join('')}</dl><p class="mi2-note">${vm.asOf ? escape(dateLabel(vm.asOf)) + ' 기준 ' : ''}최근 30일 기록이에요. 점수나 급수는 매기지 않아요.</p>` : '';
  const next = vm.next.title ? `<div class="mi2-next"><span class="mi2-next-label">다음 한 걸음</span><p class="mi2-next-title">${escape(vm.next.title)}</p>${vm.next.why ? `<p class="mi2-next-why">${escape(vm.next.why)}</p>` : ''}</div>` : '';
  const primary = vm.next.action === 'account' ? pill('account', vm.next.label) : pill('activity', vm.next.label, { target: 'world' }, state.activityPending === true);
  const say = vm.understanding ? ghost('understanding-describe', '내 말로 알려 주기', {}, vm.busy) : '';
  const secondary = vm.kind === 'empty' ? `<div class="mi2-row">${ghost('account', '배우는 이유 알려 주기')}${say}</div>`
    : vm.kind === 'disconnected' && !vm.toldCount ? `<div class="mi2-row">${ghost('account', '배우는 이유 알려 주기')}</div>`
      : `<div class="mi2-links">${link('jump', '왜 이렇게 봤나요?', { target: 'mi2-why' }, false, 'mi2-jump')}</div>`;
  const support = (Array.isArray(vm.now.support) ? vm.now.support : []).filter(line => typeof line === 'string' && line.trim()).slice(0, 2);
  return `<section class="mi2-now" aria-labelledby="mi2-now-title"><span class="mi2-label">지금의 나</span><h2 id="mi2-now-title">${escape(vm.now.headline)}</h2>${support.map(line => `<p class="mi2-support">${escape(line)}</p>`).join('')}${next}<div class="mi2-actions">${primary}</div>${numbers}${secondary}</section>`;
}

function pendingBody(state, head) {
  const status = state.status;
  const block = status === 'loading' ? `<section class="mi2-now mi2-state" role="status" aria-live="polite"><span class="mi2-label">지금의 나</span><h2>내 기록을 살펴보고 있어요.</h2><p class="mi2-support">내가 고른 것과 연결한 연습 기록을 정리하고 있어요.</p></section>`
    : status === 'signed-out' ? `<section class="mi2-now mi2-state"><span class="mi2-label">SYNK ID</span><h2>내 계정으로 이어서 볼 수 있어요.</h2><p class="mi2-support">로그인하면 내가 알려 준 것과 연결한 연습 기록을 한곳에서 봐요.</p><div class="mi2-actions">${pill('account', '로그인하기')}</div></section>`
      : status === 'unconfigured' ? `<section class="mi2-now mi2-state" role="status"><span class="mi2-label">계정 연결</span><h2>지금은 내 기록을 연결할 수 없어요.</h2><p class="mi2-support">이 환경에서 SYNK ID 연결이 준비되면 내 성향을 볼 수 있어요.</p><div class="mi2-actions">${pill('account', '계정 확인하기')}</div></section>`
        : `<section class="mi2-now mi2-state" role="alert"><span class="mi2-label">다시 확인</span><h2>기록을 불러오지 못했어요.</h2><p class="mi2-support">${escape(text(state.message, '잠시 뒤 다시 확인해 주세요. 연결한 기록을 가져와야 내 성향을 보여 드릴 수 있어요.'))}</p><div class="mi2-actions">${pill('refresh', '다시 불러오기')}</div></section>`;
  return `<div class="mi2-top">${head}${block}</div>`;
}

export function renderMemberInsight(state = {}, { native = false, poster: art = null } = {}) {
  state = state && typeof state === 'object' ? state : {};
  const report = state.status === 'ready' && state.report && typeof state.report === 'object' ? state.report : null;
  const status = report ? 'ready' : ['loading', 'signed-out', 'unconfigured', 'error'].includes(state.status) ? state.status : 'error';
  const back = native ? `<button type="button" class="mi2-back" data-view="benefits">${arrow}회원 혜택 모두 보기</button>` : `<a class="mi2-back" href="#benefits">${arrow}회원 혜택 모두 보기</a>`;
  const head = poster(art);
  if (!report) return `<article class="member-insight mi2" data-insight-status="${status}" aria-labelledby="benefit-title"${status === 'loading' ? ' aria-busy="true"' : ''}>${back}${pendingBody({ ...state, status }, head)}</article>`;
  const vm = present(report, state);
  vm.usageLine = text(report.usageLine);
  const top = vm.kind === 'empty'
    ? `<div class="mi2-top">${head}<div class="mi2-stack">${nowBlock(vm, state)}${state.understandingStatementEditor || state.understandingEditor || state.settingsEditor ? toldBlock(report, state, vm) : ''}${floor(vm, state)}</div></div>`
    : `<div class="mi2-top">${head}${nowBlock(vm, state)}</div>`;
  const body = vm.kind === 'empty' ? `${notice(state, report)}${top}`
    : vm.empty ? `${top}${notice(state, report)}${toldBlock(report, state, vm)}${floor(vm, state)}`
      : `${top}${notice(state, report)}<div class="mi2-pair">${toldBlock(report, state, vm)}${seenBlock(vm)}${compareBlock(vm)}</div>${floor(vm, state)}`;
  return `<article class="member-insight mi2" data-insight-status="ready" data-mi2-kind="${escape(vm.kind)}" aria-labelledby="benefit-title">${back}${body}</article>`;
}
