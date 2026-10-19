// Product presentation of Core's existing account summary. No profile inference or storage.
// Keep this module inside the renderer so the web and packaged desktop can share it.
import Understanding from './generated/member-understanding.mjs';
const REASONS = Object.freeze({ culture: '드라마·음악·웹툰', travel: '한국 여행', people: '가족·친구와 이야기', life: '한국 생활', study: '한국에서 공부', work: '한국에서 일', career: '지금 하는 일', exam: '시험·자격', hobby: '배우는 즐거움', other: '다른 이유' });
const SETTINGS = Object.freeze({
  support: { title: '편한 도움 방식', values: { step: '단계별로 도와줘요', choose: '그때그때 맞춰 줘요', independent: '혼자 해 볼게요' } },
  explanation: { title: '편한 설명 길이', values: { brief: '짧은 설명', standard: '보통 설명', detailed: '자세한 설명' } },
  textSize: { title: '편한 글씨 크기', values: { standard: '보통 글씨', large: '큰 글씨' } },
  motion: { title: '화면 움직임', values: { full: '움직임 그대로', reduced: '움직임 줄이기' } },
  audio: { title: '소리 이용 방식', values: { off: '소리 끄기', available: '소리 쓰기' } },
});
// The same help and explanation choices said inside a sentence (「…을 골랐어요」).
const SETTING_WORDS = Object.freeze({
  support: { step: '단계별 도움', choose: '필요할 때 고르는 도움', independent: '혼자 해 보기' },
  explanation: { brief: '짧은 설명', standard: '보통 길이 설명', detailed: '자세한 설명' },
});
// Strata kinds of practised content (trail-member-observations.js).
const TOPIC_KINDS = new Set(['situation', 'topic', 'word', 'grammar_point', 'skill', 'concept']);
const STATUSES = new Set(['unseen', 'checking', 'practice', 'supported', 'recent-independent', 'review']);
// Whether WORLD's practice choice reads the answers given here (topic interest and "not now").
// True since 2026-10-19: the account server's read path (talk synk-personal v48) and WORLD's reading
// (synk.im 11617ab) are both live (docs/_ops/트랙.md).
export const WORLD_READS_ANSWERS = true;
// Whether WORLD follows the help style and explanation length saved here (world-learning-ui.mjs
// reads the account's presentation and writes it only on an explicit save). True since that WORLD
// went live on 2026-10-19 (synk.im 11617ab); before it, opening WORLD wrote its own goals back.
export const WORLD_FOLLOWS_SETTINGS = true;
const ACTIVITY_TARGETS = Object.freeze({ world: 'WORLD에서 연습 고르기', messenger: 'Workspace 열기', path: 'PATH 열기', pulse: 'PULSE 열기' });
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw Object.assign(new TypeError('내 성향 요약의 형식을 확인하지 못했어요. 다시 불러와 주세요.'), { code: 'INVALID_INSIGHT_SUMMARY' }); };
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : invalid();
const text = (value, max = 500) => typeof value === 'string' && value.trim() && value.length <= max && !/[<>\x00-\x1f\x7f]/.test(value) ? value : invalid();
// A user's explicit explanation is literal text, including angle brackets and
// line breaks. The view escapes it; it is never interpreted as markup or data.
const literalText = (value, max = 900) => typeof value === 'string' && value.trim() && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|[\uD800-\uDFFF]/u.test(value) ? value : invalid();
const unicodeText = (value, max) => typeof value === 'string' && value.trim() && [...value].length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|[\uD800-\uDFFF]/u.test(value) ? value : invalid();
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value) ? value : invalid();
function instant(value, asOf = null) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value || asOf && Date.parse(value) > Date.parse(asOf)) invalid();
  return value;
}
const optionalInstant = (value, asOf) => value === null ? null : instant(value, asOf);
function uniqueRows(value, max) {
  if (!Array.isArray(value) || value.length > max || value.some(row => !record(row))) invalid();
  const seen = new Set();
  for (const row of value) { const key = id(row.id);if (seen.has(key)) invalid();seen.add(key); }
  return value;
}
function periodsOf(value, fields, asOf = null) {
  if (!record(value) || value.days !== 30 || typeof value.sufficient !== 'boolean') invalid();
  const windowOf = source => {
    if (!record(source)) invalid();
    const from = instant(source.from, asOf), to = instant(source.to, asOf);
    if (Date.parse(to) - Date.parse(from) !== PERIOD_MS) invalid();
    const window = { from, to };
    for (const field of [...fields, 'activeDays']) window[field] = count(source[field]);
    // A rolling 30-day interval can touch 31 calendar dates in Asia/Seoul.
    if (window.activeDays > 31) invalid();
    if (fields.includes('answered') && (window.independent > window.answered || window.assisted > window.answered || window.independent + window.assisted > window.answered)) invalid();
    return window;
  };
  const recent = windowOf(value.recent), previous = windowOf(value.previous);
  if (previous.to !== recent.from) invalid();
  const reason = text(value.reason);
  let delta = null;
  if (value.sufficient) {
    if (!record(value.delta)) invalid();
    delta = {};
    for (const field of [...fields, 'activeDays']) {
      if (!Number.isSafeInteger(value.delta[field]) || value.delta[field] !== recent[field] - previous[field]) invalid();
      delta[field] = value.delta[field];
    }
  } else if (value.delta !== null) invalid();
  return { days: 30, recent, previous, sufficient: value.sufficient, reason, delta };
}
function activityOf(value, status) {
  const empty = status => ({ status, enabledAt: null, periods: null, interests: [], activities: [] });
  if (['unavailable', 'loading', 'error'].includes(status)) return empty(status);
  if (!record(value) || value.version !== 1 || !['ready', 'empty', 'disabled'].includes(value.availability)) invalid();
  // A disabled response cannot revive old observations, even if mixed into it.
  if (value.availability === 'disabled') return empty('disabled');
  const periods = periodsOf(value.periods, ['observations']);
  const enabledAt = instant(value.enabledAt, periods.recent.to);
  const interests = uniqueRows(value.interests, 4).map(row => {
    if (!own(ACTIVITY_TARGETS, row.id) || !['favorite', 'opened'].includes(row.kind)) invalid();
    return { id: row.id, label: text(row.label, 100), kind: row.kind,
      recentCount: count(row.recentCount), previousCount: count(row.previousCount),
      lastAt: optionalInstant(row.lastAt, periods.recent.to), detail: text(row.detail) };
  });
  const activities = uniqueRows(value.activities, 3).map(row => {
    if (!own(ACTIVITY_TARGETS, row.targetId) || row.id !== 'open-' + row.targetId || !['self-declared', 'observed'].includes(row.basis)) invalid();
    text(row.label, 100);
    return { id: row.id, targetId: row.targetId, label: ACTIVITY_TARGETS[row.targetId], reason: text(row.reason), basis: row.basis };
  });
  if (value.availability === 'empty' && (interests.length || activities.length || periods.recent.observations || periods.previous.observations)) invalid();
  return { status: value.availability, enabledAt, periods, interests, activities };
}
function practiceOf(value, asOf) {
  if (!record(value)) invalid();
  const answered = count(value.answered), independent = count(value.independent), assisted = count(value.assisted);
  // Independent and assisted are disjoint answer counts, not correct-answer counts.
  if (independent > answered || assisted > answered || independent + assisted > answered) invalid();
  const lastAt = optionalInstant(value.lastAt, asOf);
  if (answered && !lastAt) invalid();
  const skills = uniqueRows(value.skills, 12).map(row => {
    if (!STATUSES.has(row.status)) invalid();
    const recent = count(row.recent), correct = count(row.correct), helped = count(row.assisted);
    if (recent > 12 || correct > recent) invalid();
    return { id: row.id, label: text(row.label, 160), status: row.status, line: text(row.line), recent, correct, assisted: helped, lastAt: optionalInstant(row.lastAt, asOf),
      fact: Understanding.memberInsightPracticeFact({ recent, correct, assisted: helped }) };
  });
  const content = uniqueRows(value.content, 12).map(row => {
    if (!['practice', 'review'].includes(row.status)) invalid();
    return { id: row.id, label: text(row.label, 160), status: row.status };
  });
  const periods = own(value, 'periods') && value.periods !== null ? periodsOf(value.periods, ['answered', 'independent', 'assisted'], asOf) : null;
  return { answered, independent, assisted, skills, content, topics: topicsOf(value.observations), empty: !answered && !skills.length && !content.length, lastAt, periods };
}
// Practised topics of the recent window, only to say which one came up most. A malformed list
// leaves the sentence out; it never breaks the rest of the summary.
function topicsOf(value) {
  try {
    if (value == null) return [];
    if (!record(value) || !Array.isArray(value.topics) || value.topics.length > 12) invalid();
    return uniqueRows(value.topics, 12).map(row => {
      if (!TOPIC_KINDS.has(row.kind) || !Number.isSafeInteger(row.count) || row.count < 1 || !Number.isSafeInteger(row.activeDays) || row.activeDays < 1 || row.activeDays > 31) invalid();
      return { id: row.id, label: text(row.label, 160), kind: row.kind, word: Understanding.insightKindWord(row.kind), count: row.count, activeDays: row.activeDays };
    });
  } catch { return []; }
}

function understandingOf({ accountSummary, activity, document, status, asOf }) {
  const empty = state => ({ status: state, headline: '', paragraphs: [], facets: [], history: [], statementHistory: [], relations: [], activities: [], limitations: [] });
  if (status !== 'ready') return empty(['loading', 'error'].includes(status) ? status : 'unavailable');
  try {
    instant(asOf);
    const value = Understanding.summarizeMemberUnderstanding({ accountSummary, activity, document, asOf });
    if (!record(value) || value.version !== 1 || !Array.isArray(value.paragraphs) || value.paragraphs.length > 4
      || !Array.isArray(value.limitations) || value.limitations.length > 3) invalid();
    const facets = uniqueRows(value.facets, 10).map(row => {
      const definition = Understanding.understandingFacet(row.id);
      if (!['observed', 'self-declared', 'empty'].includes(row.basis) || typeof row.available !== 'boolean'
        || row.multiple !== definition.multiple || !Array.isArray(row.selected)) invalid();
      const choices = uniqueRows(row.choices, 9).map(choice => {
        if (!definition.choices.some(allowed => allowed.id === choice.id && allowed.label === choice.label)) invalid();
        return { id: choice.id, label: text(choice.label, 160) };
      });
      const selected = row.selected.length ? Understanding.validateUnderstandingValues(row.id, row.selected) : [];
      const claim = row.available && row.claim !== null ? Understanding.validateUnderstandingClaim(row.claim, { facetId: row.id }) : null;
      let review = null, override = null;
      if (row.review !== null) {
        if (!record(row.review) || !['agree', 'disagree', 'contextual'].includes(row.review.verdict)) invalid();
        review = { verdict: row.review.verdict, at: instant(row.review.at, asOf) };
      }
      if (row.override !== null) {
        if (!record(row.override)) invalid();
        override = { values: Understanding.validateUnderstandingValues(row.id, row.override.values), at: instant(row.override.at, asOf) };
      }
      const topic = row.id.startsWith('learning-topic:');
      const topicKind = row.topicKind == null ? null : topic && TOPIC_KINDS.has(row.topicKind) ? row.topicKind : invalid();
      // A repeated pattern is asked about, never concluded (vellum-insight.cjs).
      const asked = topic ? 'learning-topic' : ['practice-mode', 'practice-response'].includes(row.id) ? row.id : null;
      const askedLabel = !claim || !asked ? null : topic ? row.title : choices.find(choice => choice.id === claim.reference)?.label;
      const question = askedLabel ? Understanding.memberInsightQuestion({ facet: asked, label: askedLabel, kind: topicKind }) : null;
      return { id: row.id, title: text(row.title, 160), line: literalText(row.line), basis: row.basis, claim, topicKind,
        topicWord: topicKind ? Understanding.insightKindWord(topicKind) : null, question,
        evidenceLine: row.evidenceLine === '' ? '' : text(row.evidenceLine), choices, multiple: row.multiple, selected, review, override, available: row.available };
    });
    if (!Array.isArray(value.history) || value.history.length > 100) invalid();
    const seen = new Set();
    const history = value.history.map(row => {
      if (!record(row) || !['review', 'override'].includes(row.kind)) invalid();
      const key = `${row.kind}:${id(row.id)}`;
      if (seen.has(key)) invalid();seen.add(key);
      Understanding.understandingFacet(row.facetId);
      if (typeof row.note !== 'string' || [...row.note].length > 200 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|[\uD800-\uDFFF]/u.test(row.note)) invalid();
      return { kind: row.kind, id: row.id, facetId: row.facetId, title: text(row.title, 160), line: text(row.line), note: row.note, at: instant(row.at, asOf) };
    });
    if (!Array.isArray(value.activities) || value.activities.length > 3) invalid();
    const targets = new Set();
    const activities = value.activities.map(row => {
      if (!record(row) || !own(ACTIVITY_TARGETS, row.targetId) || row.basis !== 'self-declared' || targets.has(row.targetId)) invalid();
      targets.add(row.targetId);
      return { targetId: row.targetId, label: ACTIVITY_TARGETS[row.targetId], reason: text(row.reason), basis: 'self-declared' };
    });
    const relations = uniqueRows(value.relations === undefined ? [] : value.relations, 4).map(row => {
      if (!['conditional-preference', 'preference-change', 'preference-observation', 'activity-change'].includes(row.kind)
        || !['declared', 'observed', 'needs-check'].includes(row.certainty) || !Array.isArray(row.evidence) || row.evidence.length > 6) invalid();
      const evidence = row.evidence.map(item => {
        if (!record(item) || !['statement', 'selection', 'observation', 'period'].includes(item.kind)) invalid();
        return { kind: item.kind, ref: id(item.ref), label: unicodeText(item.label, 120) };
      });
      return { id: row.id, kind: row.kind, line: unicodeText(row.line, 700), evidence, certainty: row.certainty };
    });
    const statementHistory = uniqueRows(value.statementHistory === undefined ? [] : value.statementHistory, 20).map(row => {
      if (typeof row.active !== 'boolean') invalid();
      const vocabulary = value => value == null ? null : typeof value === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(value) ? value : invalid();
      const meanings = uniqueRows(row.meanings, 8).map(meaning => {
        if (typeof meaning.active !== 'boolean' || ![null, 'first-try', 'familiar', 'busy', 'after-example', 'first-try-after-example', 'familiar-after-example', 'busy-after-example', 'meeting', 'teamwork', 'planning', 'decision'].includes(meaning.condition)
          || meaning.polarity != null && !['prefer', 'avoid'].includes(meaning.polarity)) invalid();
        return { id: meaning.id, line: unicodeText(meaning.line, 300), condition: meaning.condition, quote: unicodeText(meaning.quote, 500), active: meaning.active,
          field: vocabulary(meaning.field), value: vocabulary(meaning.value), polarity: meaning.polarity ?? null };
      });
      const answers = row.clarificationAnswers === undefined ? [] : row.clarificationAnswers;
      if (!Array.isArray(answers) || answers.length > 12) invalid();
      const answered = new Set();
      const clarificationAnswers = answers.map(answer => {
        if (!record(answer) || answered.has(answer.questionId)) invalid();
        answered.add(answer.questionId);
        return { questionId: id(answer.questionId), optionId: id(answer.optionId), questionLabel: unicodeText(answer.questionLabel, 900), optionLabel: unicodeText(answer.optionLabel, 300) };
      });
      return { id: row.id, text: unicodeText(row.text, 500), at: instant(row.at, asOf), active: row.active, meanings, clarificationAnswers };
    });
    return { status: 'ready', asOf, headline: text(value.headline), paragraphs: value.paragraphs.map(line => unicodeText(line, 900)), facets, history, statementHistory, relations, activities, limitations: value.limitations.map(line => text(line)) };
  } catch { return empty('error'); }
}

export function buildMemberInsightReport(result, { activity = null, activityStatus = 'unavailable', activityError = null,
  understanding = null, understandingStatus = 'unavailable', understandingAsOf = null } = {}) {
  if (!record(result) || result.ok !== true || result.scope !== 'synk-atlas-summary' || !record(result.learning)
    || typeof result.learning.enabled !== 'boolean' || !Number.isSafeInteger(result.learning.revision) || result.learning.revision < 0
    || !['practice-and-settings', 'declared-only'].includes(result.shared) || !record(result.summary)) invalid();
  const summary = result.summary;
  if (summary.version !== 'atlas-account-summary-1'
    || own(summary, 'abilityClaim') && summary.abilityClaim !== false
    || own(summary, 'learningEffectClaim') && summary.learningEffectClaim !== false
    || own(summary, 'grade') && summary.grade !== null) invalid();
  const asOf = instant(summary.asOf);
  if (summary.reasons !== null && (!Array.isArray(summary.reasons) || summary.reasons.length > 3
    || new Set(summary.reasons).size !== summary.reasons.length || summary.reasons.some(reason => typeof reason !== 'string' || !own(REASONS, reason)))) invalid();
  const declared = summary.reasons || [];
  // Both flags must allow practice. An inconsistent or stale response never reveals it.
  const shared = result.learning.enabled && result.shared === 'practice-and-settings' ? 'practice-and-settings' : 'declared-only';
  const personal = declared.length ? [{ id: 'reasons', title: '직접 밝힌 관심과 목표', value: declared.map(reason => REASONS[reason]).join(' · '), basis: 'self-declared', detail: '한국어를 배우는 이유로 직접 고른 내용이에요. 다른 관심사나 성격까지 뜻하지는 않아요.' }] : [];
  let practice = { answered: 0, independent: 0, assisted: 0, skills: [], content: [], topics: [], empty: true, lastAt: null, periods: null };
  // The chosen values themselves, for editing them in place (the learning memory's presentation).
  const settings = Object.fromEntries(Object.keys(SETTINGS).map(field => [field, null]));
  if (shared === 'practice-and-settings') {
    if (summary.presentation !== null && !record(summary.presentation)) invalid();
    for (const [field, value] of Object.entries(summary.presentation || {})) {
      if (!own(SETTINGS, field) || typeof value !== 'string' || !own(SETTINGS[field].values, value)) invalid();
    }
    for (const [field, setting] of Object.entries(SETTINGS)) {
      const value = summary.presentation?.[field];
      if (value !== undefined) { settings[field] = value; personal.push({ id: field, title: setting.title, value: setting.values[value], basis: 'self-declared', detail: '직접 고른 이용 설정이에요. 실제 수행 능력이나 고정된 성향을 판단한 결과는 아니에요.' }); }
    }
    practice = practiceOf(summary.practice, asOf);
  }
  if (!Array.isArray(summary.forReasons) || summary.forReasons.length > 3) invalid();
  const seen = new Set(), reasons = [];
  for (const entry of summary.forReasons) {
    if (!record(entry) || typeof entry.reason !== 'string' || !declared.includes(entry.reason) || seen.has(entry.reason)
      || !Array.isArray(entry.situations) || entry.situations.length > 100) invalid();
    seen.add(entry.reason);
    for (const situation of entry.situations) {
      if (!record(situation)) invalid();
      id(situation.id);text(situation.label, 160);text(situation.line);
    }
    if (entry.situations.length) reasons.push({ label: REASONS[entry.reason], line: entry.situations[0].line });
  }
  const { lastAt, ...learning } = practice;
  // Errors are deliberately generic; upstream errors can include private data.
  void activityError;
  let activityReport;
  try { activityReport = activityOf(activity, activityStatus); }
  catch { activityReport = { status: 'error', enabledAt: null, periods: null, interests: [], activities: [] }; }
  const analysisAt = understandingAsOf || asOf;
  const understandingReport = understandingOf({ accountSummary: result,
    activity: ['ready', 'empty', 'disabled'].includes(activityReport.status) ? activity : null,
    document: understanding, status: understandingStatus, asOf: analysisAt });
  // 「지금의 나」: Vellum says it (vellum-insight.cjs); the facts come from this summary and, once
  // loaded, the person's own answers. Their newest confirmed statement is said back if it can be.
  const ready = understandingReport.status === 'ready';
  const statement = ready ? understandingReport.statementHistory.find(row => row.active)?.meanings.filter(meaning => meaning.active) || [] : [];
  const topicsFacet = ready ? understandingReport.facets.find(facet => facet.id === 'topics') : null;
  let now = null;
  try {
    now = Understanding.memberInsightNow({ connected: shared === 'practice-and-settings', at: analysisAt,
      reasons: declared.map(reason => REASONS[reason]),
      chosen: ['support', 'explanation'].map(field => SETTING_WORDS[field][settings[field]]).filter(Boolean),
      interests: (topicsFacet?.selected || []).map(value => topicsFacet.choices.find(choice => choice.id === value)?.label).filter(Boolean),
      statement: statement.map(({ field, value, polarity, condition }) => ({ field, value, polarity, condition })),
      practice: shared === 'practice-and-settings' ? { answered: learning.answered, independent: learning.independent, lastAt,
        recent: learning.periods?.recent || null, previous: learning.periods?.previous || null, comparable: learning.periods?.sufficient === true,
        strong: learning.skills.find(skill => skill.status === 'recent-independent')?.label || null,
        topics: learning.topics.map(({ label, kind, count, activeDays }) => ({ label, kind, count, activeDays })) } : null });
  } catch { now = null; }
  // The app opened on most days, only while the app-use connection is on.
  const usage = ready && ['ready', 'empty'].includes(activityReport.status) ? understandingReport.facets.find(facet => facet.id === 'usage-repeat' && facet.claim) : null;
  let usageLine = '';
  try { const name = usage?.choices.find(choice => choice.id === usage.claim.reference)?.label; usageLine = name ? Understanding.memberInsightUsage({ label: name, count: usage.claim.count, activeDays: usage.claim.activeDays }) : ''; }
  catch { usageLine = ''; }
  // The choices offered when a setting is changed here, in the words of the account's own buttons.
  const settingChoices = Object.fromEntries(['support', 'explanation'].map(field => [field, Object.entries(SETTINGS[field].values).map(([id, label]) => ({ id, label }))]));
  return {
    asOf, lastAt, shared, now, settings, settingChoices, reasonIds: [...declared], worldReadsAnswers: WORLD_READS_ANSWERS, worldFollowsSettings: WORLD_FOLLOWS_SETTINGS, usageLine,
    // The learning memory's fence (synk-learning ?view=memory) for saving a setting from here.
    learningRevision: result.learning.revision, learningEnabled: result.learning.enabled,
    headline: '내가 고른 방향과 실제 이용에서 보인 모습',
    description: personal.length || !learning.empty || activityReport.interests.length
      ? '직접 밝힌 관심과 이용 방식, 연결을 허용한 앱 이용·연습 기록을 두 영역으로 정리했어요.'
      : '아직 정리할 정보가 없어요. 배우는 이유를 고르거나 계정에 연결해 연습하면 이곳에서 확인할 수 있어요.',
    personal, learning, reasons, activity: activityReport, understanding: understandingReport,
    limits: [
      ...(shared === 'declared-only' ? ['학습 기록 연결이 꺼져 있거나 공유되지 않아, 학습 정보는 직접 밝힌 배우는 이유만 보여요. 앱 이용 기록 연결은 별도예요.'] : []),
      '독립 응답은 도움 없이 처음 답한 기록이며 오답도 포함해요. 전체 응답 수와 도움받은 응답 수는 누적 기록이에요.',
      '항목별 최근 응답·정답 수는 최근 30일 중 선택된 난이도·응답 형식의 독립 첫 응답 최대 12개예요. 도움받은 정답 수는 같은 범위의 별도 기록이에요.',
      '요약 확인 시각과 마지막 연습 시각을 구분해요. 관심·설정을 선택한 날짜는 현재 요약에 포함되지 않아요.',
      '한 시점의 기록과 기간별 활동 횟수를 정리해요. 횟수 차이는 성격 유형, 관심의 강도, 전체 실력·TOPIK 급수나 학습 효과를 뜻하지 않아요.',
    ],
  };
}
