import * as expressionModule from '../../atlas/vellum-expression.js';
import * as followupModule from './care-followup.js';
import { makePerson, nextOccurrence } from './model.mjs';

const Vellum = expressionModule.default || globalThis.SynkVellumExpression;
const Trail = followupModule.default || globalThis.SynkTrailFollowup;
export const SUPPORT_ENGINES = Object.freeze({ expression: Vellum.VERSION, followup: Trail.VERSION });
const DAY = 86400000;
const LIMITS = ['정해 둔 표현과 날짜만 기계적으로 살펴요. 문장의 뜻이나 상대의 기분까지 읽지는 못해요.', '걸린 곳이 없어도 이름과 날짜, 약속은 한 번 더 읽어 주세요. 문구를 대신 고치거나 보내지 않아요.'];
const value = (text, max = 5000) => { if (typeof text !== 'string' || text.length > max) throw new Error(`글은 ${max.toLocaleString('ko-KR')}자까지 넣을 수 있어요.`); return text; };
function currentDate(input) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) { Trail.date(input); return input; }
  const now = input === undefined ? new Date() : new Date(input);
  if (!Number.isFinite(now.getTime())) throw new Error('날짜를 읽지 못했어요.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const pad = number => String(number).padStart(2, '0');
const dateValue = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
const isDate = date => { try { Trail.date(date); return true; } catch { return false; } };

/** Visible edits produce candidates only. A deletion never becomes a preference by itself. */
export function compareDraftEdits({ before, after } = {}) {
  value(before); value(after);
  return Vellum.compareEdits({ before, after }).observations.map(observation => {
    const kind = observation.kind;
    const common = { id: `preference-${kind}${kind === 'avoid-phrase' ? `-${observation.start}-${observation.end}` : ''}`, kind,
      evidence: { before, after, ...(observation.removed ? { removed: observation.removed } : {}) }, requiresConfirmation: true };
    if (kind === 'shorter') return { ...common, label: '다음에도 짧게 쓰기', reason: `이번에 ${observation.beforeLength}자를 ${observation.afterLength}자로 줄였어요.`, patch: { length: 'short' } };
    if (kind === 'no-emoji') return { ...common, label: '다음에는 이모지 빼기', reason: '이번에 이모지를 모두 뺐어요.', patch: { allowEmoji: false } };
    return { ...common, label: `“${observation.removed}” 피하기`, reason: '이번에 뺀 표현이에요. 이번에만 뺀 거라면 그냥 두세요.', patch: { avoidPhrase: observation.removed } };
  });
}

/** Confirmation applies the existing person preference contract; no hidden profile. */
export function applyPreferenceCandidate(personInput, candidate, { confirmed = false } = {}) {
  if (confirmed !== true) throw new Error('「기억해 두기」를 눌러야 저장돼요.');
  const person = makePerson(personInput);
  if (!candidate?.evidence) throw new Error('고친 문구를 다시 불러오지 못했어요. 표현 점검을 다시 해 주세요.');
  const fresh = compareDraftEdits(candidate.evidence).find(item => item.id === candidate.id && item.kind === candidate.kind);
  if (!fresh || JSON.stringify(fresh.patch) !== JSON.stringify(candidate.patch)) throw new Error('문구가 바뀌었어요. 표현 점검을 다시 해 주세요.');
  // confirmed covers the whole existing preference record. A single edit must
  // not activate other saved but unconfirmed settings or erase them to proceed.
  if (!person.recipientPreference.confirmed) {
    const defaults = makePerson({ id: person.id, name: person.name }).recipientPreference;
    if (Object.keys(defaults).some(key => key !== 'confirmed' && JSON.stringify(person.recipientPreference[key]) !== JSON.stringify(defaults[key]))) {
      throw new Error('「대화와 말투」 탭의 표현 설정을 먼저 저장해 주세요. 그다음 이 표현을 기억할 수 있어요.');
    }
  }
  const recipientPreference = { ...person.recipientPreference, confirmed: true };
  // The unconfirmed UI defaults to warm. Confirming an unrelated edit must not
  // turn the schema's legacy short default into an explicit length preference.
  if (!person.recipientPreference.confirmed && fresh.kind !== 'shorter') recipientPreference.length = 'balanced';
  if (fresh.kind === 'shorter') recipientPreference.length = 'short';
  else if (fresh.kind === 'no-emoji') recipientPreference.allowEmoji = false;
  else recipientPreference.avoidPhrases = [...new Set([...recipientPreference.avoidPhrases, fresh.patch.avoidPhrase])];
  return makePerson({ ...person, recipientPreference });
}

function dateMentions(text, today, expectedDate = null) {
  const dates = [];
  const pattern = /(?<!\d)(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})(?!\d)|(?<!\d)(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/gu;
  for (const match of text.matchAll(pattern)) {
    const explicitYear = match[1] || match[4], year = explicitYear || (expectedDate || today).slice(0, 4);
    const parsed = dateValue(year, match[2] || match[5], match[3] || match[6]);
    // A written lunar date is not a Gregorian event occurrence. In particular,
    // lunar 2/30 must not be labelled impossible or scheduled as solar 2/30.
    const lunar = /음력\s*(?:\d{4}\s*년\s*)?(?:윤\s*)?$/u.test(text.slice(0, match.index));
    const month = Number(match[2] || match[5]), day = Number(match[3] || match[6]);
    dates.push({ quote: match[0], start: match.index, end: match.index + match[0].length, value: parsed,
      valid: lunar ? month >= 1 && month <= 12 && day >= 1 && day <= 30 : isDate(parsed), uncertain: lunar || !explicitYear, calendar: lunar ? 'lunar' : 'solar' });
  }
  for (const match of text.matchAll(/(?<![가-힣])(?:오늘|내일|모레)(?![가-힣])/gu)) {
    const offset = { 오늘: 0, 내일: 1, 모레: 2 }[match[0]];
    dates.push({ quote: match[0], start: match.index, end: match.index + match[0].length, value: new Date(Trail.date(today) + offset * DAY).toISOString().slice(0, 10), valid: true, uncertain: true });
  }
  return dates;
}
function promiseMentions(text) {
  // Explicit endings only, including common polite commitments. A marker is a
  // review cue, never proof of intent or speaker identity (including quotations).
  // Direct 안/못 and question endings are excluded; this is not a negation parser.
  const pattern = /(?<![가-힣])(?:(안|못)[ \t]+)?(?:꼭[ \t]*)?(?:(?:찾아갈|갈|참석할|보내줄|보낼|송금할|사줄|도와줄|전화할|연락할|챙겨줄)게(?:요)?|(?:찾아뵐|(?:보내|사|도와|전화|연락|챙겨)[ \t]*드릴)게(?:요)?|(?:찾아가|가|찾아뵙|참석하|보내|송금하|전화하|연락하|(?:보내|사|도와|전화|연락|챙겨)[ \t]*드리)겠습니다)(?![가-힣])/gu;
  return [...text.matchAll(pattern)]
    .filter(match => !match[1] && !/^[ \t]*[?？]/u.test(text.slice(match.index + match[0].length)))
    .map(match => ({ quote: match[0], start: match.index, end: match.index + match[0].length }));
}

/** The product supplies date/recipient meaning; Vellum compares exact observed spans. */
export function reviewMessage({ text, person: personInput, event = null, people = [], today, expectedDate, confirmedPromises = [] } = {}) {
  value(text); const person = makePerson(personInput), current = currentDate(today);
  if (!Array.isArray(people)) throw new Error('사람 목록을 읽지 못했어요.');
  let occurrenceDate = expectedDate || null;
  if (occurrenceDate) Trail.date(occurrenceDate);
  else if (event) {
    if (event.personId !== person.id) throw new Error('점검할 사람과 일정이 달라요.');
    occurrenceDate = nextOccurrence(event, `${current}T00:00:00+09:00`)?.date || null;
  }
  const pref = person.recipientPreference;
  const result = Vellum.review({ text, expectedDate: occurrenceDate, dates: dateMentions(text, current, occurrenceDate),
    forbiddenPhrases: pref.confirmed ? pref.avoidPhrases : [],
    otherNames: people.filter(item => item.id !== person.id).map(item => value(item.name, 80)).filter(name => name.trim()),
    recipientNames: [person.name, ...(pref.confirmed && pref.salutation ? [pref.salutation] : [])],
    nameSuffixes: ['님', '씨', '아', '야', '에게', '께', '의', '과', '와', '은', '는', '이', '가', '님께', '씨에게'],
    promises: promiseMentions(text), confirmedPromises });
  const descriptions = {
    'avoid-phrase': ['피하기로 한 표현', '이 사람에게 쓰지 않기로 한 표현이 들어 있어요.', '이 표현이 든 문장을 고치거나 빼 주세요.'],
    'other-name': ['다른 사람 이름', '수첩에 있는 다른 사람의 이름이 들어 있어요. 일부러 함께 말한 거라면 괜찮아요.', `받는 사람을 부르는 말이라면 이렇게 바꿔 주세요. “${pref.confirmed && pref.salutation || person.name}”`],
    'invalid-date': ['없는 날짜', '달력에 없는 날짜이거나 고를 수 있는 범위 밖의 날짜예요.', '달력에서 날짜를 다시 찾아 고쳐 주세요.'],
    'date-mismatch': ['일정과 다른 날짜', '고른 일정과 다른 날짜가 적혀 있어요. 다른 일을 말한 거라면 괜찮아요.', `이번 일정을 말한 거라면 ${occurrenceDate} 날짜와 맞춰 주세요.`],
    'date-confirmation': ['헷갈릴 수 있는 날짜', '연도가 없거나 음력이거나, 「오늘」「내일」처럼 보내는 날에 따라 달라지는 날짜예요.', '받는 사람이 헷갈리지 않게 연도와 월·일을 함께 적어 주세요.'],
    'promise-confirmation': ['약속하는 말', '「갈게」「보낼게요」처럼 약속하는 말이 있어요. 정말 지킬 수 있는 약속인지 생각해 보세요.', '아직 정하지 않았다면 그 문장을 빼거나 할 수 있는 만큼만 적어 주세요.'],
  };
  return { ...result, issues: result.issues.map(issue => { const [label, message, alternative] = descriptions[issue.kind]; return { ...issue, label, message, alternative }; }),
    summary: result.issues.length ? `다시 볼 곳이 ${result.issues.length}곳 있어요.` : '걸리는 표현은 없어요. 보내기 전에 한 번 더 읽어 주세요.', limits: [...LIMITS] };
}

/** Candidates are never saved here. Even a written ISO date still needs user confirmation. */
export function extractFollowupCandidates(text, { today } = {}) {
  value(text, 50000); const current = currentDate(today), candidates = [];
  // Splitting numeric dates on dots would discard their source: line-level blocks
  // keeps punctuated numeric dates intact while retaining exact quoted text.
  const blocks = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  for (const block of blocks) {
    if (!/(?:연락|전화|안부|물어|확인|결과|이사|만나|밥\s*먹|도와|챙겨|다시\s*얘기)/u.test(block)) continue;
    if (block.length > 5000) continue;
    const dates = dateMentions(block, current).filter(item => item.valid && !item.uncertain);
    const hints = /(?:다음\s*주|이번\s*주|다음\s*달|나중|뒤에|후에|오늘|내일|모레|\d{1,2}\s*월\s*\d{1,2}\s*일)/u.test(block);
    if (!dates.length && !hints) continue;
    const uniqueDates = [...new Map(dates.map(item => [item.value, item])).values()];
    const chosen = uniqueDates.length === 1 ? uniqueDates[0] : null;
    const candidate = { id: `followup-candidate-${candidates.length}`, title: block.slice(0, 120), dueOn: chosen?.value || '', dueDate: chosen?.value || '', sourceQuote: block,
      dateEvidence: chosen ? { quote: chosen.quote, start: chosen.start, end: chosen.end } : null, needsDateConfirmation: true,
      cautions: [chosen ? '글에 적힌 날짜가 다시 챙길 날이 맞는지 보고 저장해 주세요.' : uniqueDates.length > 1 ? '날짜가 여러 개라 비워 두었어요. 다시 챙길 날을 골라 주세요.' : '정확한 날짜를 알 수 없어 비워 두었어요. 다시 챙길 날을 골라 주세요.', '누가 한 약속인지는 따지지 않았어요. 챙길 내용이 맞는지 보고 골라 주세요.'] };
    if (!candidates.some(item => item.sourceQuote === candidate.sourceQuote)) candidates.push(candidate);
    if (candidates.length === 20) break;
  }
  return candidates;
}

export function followupRows(state, { today, personId } = {}) {
  const current = currentDate(today), people = new Map((state.people || []).map(person => [person.id, person]));
  const items = (state.followups || []).filter(item => !personId || item.personId === personId);
  const summary = Trail.summarize({ items, today: current }), byId = new Map(items.map(item => [item.id, item]));
  const decorate = row => ({ ...byId.get(row.id), ...row, person: people.get(byId.get(row.id).personId) || null,
    dueLabel: row.phase === 'overdue' ? `${Math.abs(row.daysUntil)}일 지났어요` : row.phase === 'today' ? '오늘 다시 챙기기' : row.phase === 'upcoming' ? `${row.daysUntil}일 뒤` : row.phase === 'done' ? '챙김 완료' : '그만 챙기기' });
  return { ...summary, pending: summary.pending.map(decorate), completed: summary.completed.map(decorate), dismissed: summary.dismissed.map(decorate) };
}
export function planFollowupAction(followup, { action, today, dueOn } = {}) {
  return Trail.planAction(followup, { action, today: currentDate(today), dueOn });
}
