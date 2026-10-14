// Product presentation of Core's existing account summary. No profile inference or storage.
// Keep this module inside the renderer so the web and packaged desktop can share it.
const REASONS = Object.freeze({ culture: '드라마·음악·웹툰', travel: '한국 여행', people: '가족·친구와 이야기', life: '한국 생활', study: '한국에서 공부', work: '한국에서 일', career: '지금 하는 일', exam: '시험·자격', hobby: '배우는 즐거움', other: '다른 이유' });
const SETTINGS = Object.freeze({
  support: { title: '편한 도움 방식', values: { step: '단계별로 도와줘요', choose: '그때그때 맞춰 줘요', independent: '혼자 해 볼게요' } },
  explanation: { title: '편한 설명 길이', values: { brief: '짧은 설명', standard: '보통 설명', detailed: '자세한 설명' } },
  textSize: { title: '편한 글씨 크기', values: { standard: '보통 글씨', large: '큰 글씨' } },
  motion: { title: '화면 움직임', values: { full: '움직임 그대로', reduced: '움직임 줄이기' } },
  audio: { title: '소리 이용 방식', values: { off: '소리 끄기', available: '소리 쓰기' } },
});
const STATUSES = new Set(['unseen', 'checking', 'practice', 'supported', 'recent-independent', 'review']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw Object.assign(new TypeError('내 성향 요약의 형식을 확인하지 못했어요. 다시 불러와 주세요.'), { code: 'INVALID_INSIGHT_SUMMARY' }); };
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : invalid();
const text = (value, max = 500) => typeof value === 'string' && value.trim() && value.length <= max && !/[<>\x00-\x1f\x7f]/.test(value) ? value : invalid();
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
    return { id: row.id, label: text(row.label, 160), status: row.status, line: text(row.line), recent, correct, assisted: helped, lastAt: optionalInstant(row.lastAt, asOf) };
  });
  const content = uniqueRows(value.content, 12).map(row => {
    if (!['practice', 'review'].includes(row.status)) invalid();
    return { id: row.id, label: text(row.label, 160), status: row.status };
  });
  return { answered, independent, assisted, skills, content, empty: !answered && !skills.length && !content.length, lastAt };
}

export function buildMemberInsightReport(result) {
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
  let practice = { answered: 0, independent: 0, assisted: 0, skills: [], content: [], empty: true, lastAt: null };
  if (shared === 'practice-and-settings') {
    if (summary.presentation !== null && !record(summary.presentation)) invalid();
    for (const [field, value] of Object.entries(summary.presentation || {})) {
      if (!own(SETTINGS, field) || typeof value !== 'string' || !own(SETTINGS[field].values, value)) invalid();
    }
    for (const [field, setting] of Object.entries(SETTINGS)) {
      const value = summary.presentation?.[field];
      if (value !== undefined) personal.push({ id: field, title: setting.title, value: setting.values[value], basis: 'self-declared', detail: '직접 고른 이용 설정이에요. 실제 수행 능력이나 고정된 성향을 판단한 결과는 아니에요.' });
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
  return {
    asOf, lastAt, shared,
    headline: '내가 고른 방향과 연습에서 보인 모습',
    description: personal.length || !learning.empty
      ? '직접 밝힌 관심과 이용 방식, 계정에 연결된 연습 기록을 두 영역으로 정리했어요.'
      : '아직 정리할 정보가 없어요. 배우는 이유를 고르거나 계정에 연결해 연습하면 이곳에서 확인할 수 있어요.',
    personal, learning, reasons,
    limits: [
      ...(shared === 'declared-only' ? ['학습 기록 연결이 꺼져 있거나 공유되지 않아, 직접 밝힌 배우는 이유만 보여요.'] : []),
      '독립 응답은 도움 없이 처음 답한 기록이며 오답도 포함해요. 전체 응답 수와 도움받은 응답 수는 누적 기록이에요.',
      '항목별 최근 응답·정답 수는 최근 30일 중 선택된 난이도·응답 형식의 독립 첫 응답 최대 12개예요. 도움받은 정답 수는 같은 범위의 별도 기록이에요.',
      '요약 확인 시각과 마지막 연습 시각을 구분해요. 관심·설정을 선택한 날짜는 현재 요약에 포함되지 않아요.',
      '한 시점의 기록을 정리한 화면이에요. 성격 유형, 전체 실력·TOPIK 급수, 이전보다 성장한 정도를 판정하지 않아요.',
    ],
  };
}
