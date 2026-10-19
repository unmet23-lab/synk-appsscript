'use strict';
// SYNK Vellum: the words of 「내 성향」, the member insight screen. Core's account summary and the
// member's own answers supply the facts; these functions only say them. They never score a person,
// name a level or a personality, and never say that a count went down: when the number of
// independent answers falls, the headline moves to the next rule and only the table shows the
// numbers as they are. (Fable reviewed the order and the sentences on 2026-10-19.)
// The older member-understanding wording in vellum.js stays only for the bundles that still carry
// that file; member-understanding.js reads the wording here.
const DAY = 86400000;
const fail = what => { throw new TypeError(`Vellum insight: invalid ${what}`); };
const count = value => Number.isSafeInteger(value) && value >= 0;
const label = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

// The final consonant (받침) of a word's last sound: Hangul by its syllable, digits and Latin letters
// by how they are read aloud. 0 means none; 8 is ㄹ, which takes 로 rather than 으로.
const DIGIT_FINALS = { 0: 21, 1: 8, 3: 16, 6: 1, 7: 8, 8: 8 };
const LATIN_FINALS = { l: 8, m: 16, n: 4, k: 1, c: 1, p: 17, b: 17, t: 7, g: 21 };
function finalOf(word) {
  for (const char of [...String(word ?? '')].reverse()) {
    const code = char.codePointAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28;
    if (/[0-9]/.test(char)) return DIGIT_FINALS[char] || 0;
    if (/[A-Za-z]/.test(char)) return LATIN_FINALS[char.toLowerCase()] || 0;
    // Closing quotes, brackets and spaces do not change the particle.
    if (/[\s)\]」』"'’”.·…~-]/.test(char)) continue;
    return 0;
  }
  return 0;
}
const josa = (word, withFinal, withoutFinal) => `${word}${finalOf(word) ? withFinal : withoutFinal}`;
const euro = word => { const final = finalOf(word); return `${word}${final && final !== 8 ? '으로' : '로'}`; };
// "가와 나", "가, 나와 다": the last pair takes 와/과, longer lists use commas before it.
function joinAnd(words) {
  if (words.length <= 1) return words[0] || '';
  return `${words.length > 2 ? words.slice(0, -2).join(', ') + ', ' : ''}${josa(words.at(-2), '과', '와')} ${words.at(-1)}`;
}
const COUNTERS = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const countWord = n => COUNTERS[n] || String(n);
// Dates are said in Korea's calendar, as the person sees them.
const seoul = value => new Date(Date.parse(value) + 9 * 3600000);
const seoulDay = value => { const d = seoul(value); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
function dayLabel(value, at = null) {
  if (!instant(value)) fail('date');
  const d = seoul(value), year = at && instant(at) && seoul(at).getUTCFullYear() !== d.getUTCFullYear() ? `${d.getUTCFullYear()}년 ` : '';
  return `${year}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
const RELATIVE = ['오늘', '어제', '이틀 전', '사흘 전', '나흘 전', '닷새 전', '엿새 전'];
function relativeDay(value, at) {
  if (!instant(value) || !instant(at)) fail('date');
  const days = Math.round((seoulDay(at) - seoulDay(value)) / DAY);
  return days <= 0 ? '오늘' : RELATIVE[days] || dayLabel(value, at);
}
// Practice content is a word or grammar point (표현), a situation (상황) or a broader topic (주제).
const kindWord = kind => ['grammar_point', 'word'].includes(kind) ? '표현' : kind === 'situation' ? '상황' : '주제';

// The member's own confirmed statement, said back in one sentence. A meaning that cannot be said
// this way (an avoidance, a topic, a work style) leaves the whole phrase out rather than showing
// part of what the person meant.
const STATEMENT_VERBS = Object.freeze({
  support: Object.freeze({ example: '예시부터 보고', step: '단계별로 도움을 받고', independent: '혼자 해 보고', choose: '필요할 때 도움을 골라 받고', together: '함께 해 보고' }),
  explanation: Object.freeze({ brief: '짧은 설명을 보고', standard: '보통 길이 설명을 보고', detailed: '자세한 설명을 보고' }),
});
const STATEMENT_CONDITIONS = Object.freeze({ 'first-try': '처음 배울 땐', familiar: '익숙한 내용은', busy: '바쁠 땐', 'after-example': '예시를 본 다음엔',
  'first-try-after-example': '예시를 본 다음엔', 'familiar-after-example': '익숙한 내용은 예시를 본 다음엔', 'busy-after-example': '바쁠 땐 예시를 본 다음엔',
  meeting: '회의할 땐', teamwork: '함께 일할 땐', planning: '계획을 세울 땐', decision: '결정할 땐' });
function memberInsightStatement(meanings = []) {
  if (!Array.isArray(meanings) || meanings.length > 8 || meanings.some(m => !m || typeof m !== 'object')) fail('statement');
  if (!meanings.length || meanings.some(m => m.polarity !== 'prefer' || !STATEMENT_VERBS[m.field]?.[m.value]
    || m.condition != null && !Object.hasOwn(STATEMENT_CONDITIONS, m.condition))) return '';
  const parts = meanings.map((m, index) => {
    const prefix = index && /after-example$/.test(m.condition || '') ? '그다음엔' : m.condition ? STATEMENT_CONDITIONS[m.condition] : '';
    return `${prefix ? prefix + ' ' : ''}${STATEMENT_VERBS[m.field][m.value]}`;
  });
  return `${parts.join(', ')} 싶다고 알려 줬어요.`;
}

// 「지금의 나」: one headline and at most two lines under it. The rules go in this order:
// connection off, independent answers went up, something done alone, how much was answered,
// a single day's practice, practice before the last 30 days, the reasons given, nothing yet.
function periodOf(value, what) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || !['answered', 'independent', 'assisted', 'activeDays'].every(key => count(value[key]))
    || value.independent + value.assisted > value.answered) fail(what);
  return value;
}
function memberInsightNow({ connected, reasons = [], chosen = [], interests = [], statement = [], practice = null, at } = {}) {
  if (typeof connected !== 'boolean' || !instant(at) || !Array.isArray(reasons) || !reasons.every(label)
    || !Array.isArray(chosen) || !chosen.every(label) || !Array.isArray(interests) || !interests.every(label)) fail('summary');
  const said = memberInsightStatement(statement);
  const recent = periodOf(practice?.recent, 'recent practice'), previous = periodOf(practice?.previous, 'earlier practice');
  const answered = practice?.answered ?? 0, independent = practice?.independent ?? 0;
  if (!count(answered) || !count(independent) || practice?.lastAt != null && !instant(practice.lastAt)
    || practice?.strong != null && !label(practice.strong)) fail('practice');
  const topics = Array.isArray(practice?.topics) ? practice.topics : [];
  if (topics.some(topic => !topic || !label(topic.label) || typeof topic.kind !== 'string' || !count(topic.count) || !count(topic.activeDays))) fail('topics');
  // The practised topic said under the headline is the one with the most answers in the window.
  const top = [...topics].sort((a, b) => b.count - a.count || b.activeDays - a.activeDays)[0] || null;
  const declaredLine = () => said || (reasons.length && chosen.length ? `${joinAnd(reasons)} 때문에 배우고, ${josa(joinAnd(chosen), '을', '를')} 골랐어요.`
    : reasons.length ? `${joinAnd(reasons)} 때문에 배우고 있어요.` : chosen.length ? `${josa(joinAnd(chosen), '을', '를')} 골랐어요.` : '');
  const lines = (...rows) => rows.filter(Boolean).slice(0, 2);
  if (!connected) return { kind: 'disconnected', headline: '학습 기록 연결이 꺼져 있어 연습 기록은 보지 않아요.',
    support: [reasons.length ? '배우는 이유만 보여요. 연결을 켜면 해 본 것과 다음에 할 것도 함께 봐요.' : '연결을 켜면 해 본 것과 다음에 할 것을 여기서 함께 봐요.'] };
  const practised = answered > 0, topicLine = top ? `요즘은 ${josa(top.label, '을', '를')} 가장 많이 연습했어요.` : '';
  if (practised && practice.comparable === true && recent && previous && recent.independent > previous.independent) {
    // "처음으로" only when no independent answer exists outside this window either.
    const headline = previous.independent ? `최근 30일, 혼자 답한 횟수가 ${previous.independent}번에서 ${recent.independent}번으로 늘었어요.`
      : independent === recent.independent ? `최근 30일, 처음으로 혼자 ${recent.independent}번 답했어요.`
        : `최근 30일, 혼자 답한 횟수가 0번에서 ${recent.independent}번으로 늘었어요.`;
    return { kind: 'growth', headline, support: lines(declaredLine(), topicLine) };
  }
  if (practised && practice.strong) return { kind: 'strong', headline: `${josa(practice.strong, '을', '를')} 최근 혼자 해냈어요.`, support: lines(declaredLine(), topicLine) };
  if (practised && recent?.answered && recent.activeDays >= 2)
    return { kind: 'volume', headline: `최근 30일 동안 ${recent.activeDays}일, ${recent.answered}번 답했어요.`, support: lines(declaredLine(), topicLine) };
  if (practised && recent?.answered) {
    const when = practice.lastAt ? relativeDay(practice.lastAt, at) : '최근';
    const first = recent.activeDays === 1 && previous?.answered === 0 && answered === recent.answered;
    const word = top ? kindWord(top.kind) : '';
    const alike = top ? topics.filter(topic => kindWord(topic.kind) === word).length : 0;
    const did = top ? `${alike > 1 ? `${top.label} 같은 ${word} ${countWord(alike)} 가지를` : josa(top.label, '을', '를')} ${recent.independent ? '' : '도움 받으며 '}연습했어요.` : '연습 기록이 생겼어요.';
    return { kind: 'one-day', headline: first ? `${when}, 처음으로 ${recent.answered}번 답했어요.` : `${when} ${recent.answered}번 답했어요.`,
      support: [did, recent.independent ? '같은 걸 한 번 더 해 볼까요?' : '이번엔 혼자 한 번 해 볼까요? 틀려도 괜찮아요.'] };
  }
  if (practised) {
    // Practice before the last 30 days is still the person's own record, never "nothing yet".
    const headline = recent && practice.lastAt ? `최근 30일에는 연습 기록이 없어요. 마지막 연습은 ${dayLabel(practice.lastAt, at)}이에요.` : `지금까지 ${answered}번 답했어요.`;
    return { kind: 'quiet', headline, support: lines(declaredLine(), '다시 연습하면 해 본 것과 다음에 할 것을 여기서 이어서 보여 드려요.') };
  }
  if (reasons.length || said || chosen.length || interests.length) {
    // The first thing the person told the screen leads; one more follows it.
    const told = [reasons.length ? `${joinAnd(reasons)} 때문에 배우기로 했어요.` : '', said,
      chosen.length ? `${josa(joinAnd(chosen), '을', '를')} 골랐어요.` : '', interests.length ? `관심 주제로 ${josa(joinAnd(interests), '을', '를')} 골랐어요.` : ''].filter(Boolean);
    return { kind: 'declared', headline: told[0], support: lines(told[1], '첫 연습을 하면 해 본 것과 다음에 할 것을 여기서 보여 드려요.') };
  }
  return { kind: 'empty', headline: '아직 나를 설명할 기록이 없어요. 하나만 하면 다음엔 달라져요.',
    support: ['연습을 하면 해 본 것과 다음에 할 것을 여기서 보여 드려요. 기록이 없다고 실력이 없다는 뜻은 아니에요.'] };
}

// One practice cell, said as what happened: independent first answers in the recent window.
function memberInsightPracticeFact({ recent, correct, assisted = 0 } = {}) {
  if (!count(recent) || !count(correct) || !count(assisted) || correct > recent) fail('practice fact');
  if (!recent) return assisted ? `도움을 받으며 ${assisted}번 맞혔어요.` : '아직 기록이 적어요.';
  return `이 연습에서 최근 혼자 답한 ${recent}번 중 ${correct}번 맞혔어요.${assisted ? ` 도움 받고 맞힌 건 ${assisted}번이에요.` : ''}`;
}
// The app opened on most days, said as what happened (never as a liking).
function memberInsightUsage({ label: name, count: times, activeDays } = {}) {
  if (!label(name) || !count(times) || !count(activeDays) || activeDays > times) fail('usage');
  return `${josa(name, '을', '를')} ${activeDays}일 동안 ${times}번 열었어요.`;
}
// A repeated pattern in the record is a question to the person, never a conclusion about them.
function memberInsightQuestion({ facet, label: name, kind = null } = {}) {
  if (!label(name)) fail('question');
  if (facet === 'practice-mode') return `${euro(name)} 하는 연습이 나와 맞나요?`;
  if (facet === 'practice-response') return '이런 문제가 나에게 편한가요?';
  if (facet === 'learning-topic') { const word = kindWord(kind); return word === '표현' ? '더 연습하고 싶은 표현인가요?' : `더 배우고 싶은 ${word}인가요?`; }
  return fail('question');
}

// Facet lines and the correction history, in the screen's plain words. A choice is said as a
// choice; a pattern in the record stays a fact about the record.
// Evidence lines keep the full date: a summary read weeks later still names its own window.
const memberDate = value => { if (!instant(value)) fail('member evidence date'); const d = seoul(value); return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };
// What was chosen, said before the choice: 「설명 길이로 ‘자세히’를 골랐어요」 rather than 「자세히를」.
const FACET_WORDS = Object.freeze({ topics: '관심 주제', support: '도움 방식', explanation: '설명 길이', 'usage-repeat': '이어서 쓸 앱', 'practice-mode': '연습 방식', 'practice-response': '문제 방식' });
function choiceLine(facet, labels) {
  const what = FACET_WORDS[facet];
  if (!what) return `${josa(joinAnd(labels), '을', '를')} 골랐어요.`;
  if (labels.length > 1) return `${euro(what)} ${josa(joinAnd(labels), '을', '를')} 골랐어요.`;
  return `${euro(what)} ‘${labels[0]}’${finalOf(labels[0]) ? '을' : '를'} 골랐어요.`;
}
// `labels` (declared) are the chosen labels one by one; `label` names what a line is about.
function memberUnderstandingLine({ kind, label: name, labels = null, count: times = 0, activeDays = 0, state = 'observed', selection = null, periodEnd = null } = {}) {
  if (typeof name !== 'string' || !['observed', 'agreed', 'contextual', 'disagreed', 'declared', 'empty', 'disabled'].includes(state)) fail('member understanding');
  if (state === 'disabled') return '이 기록은 연결이 꺼져 있어 쓰지 않아요.';
  if (state === 'empty') return '아직 여러 날의 기록이 없어요. 원하는 방식을 직접 고를 수 있어요.';
  if (state === 'declared') {
    if (kind === 'learning-topic') {
      if (selection === 'interested') return `${josa(name, '을', '를')} 더 배우고 싶다고 알려 줬어요.`;
      if (selection === 'practice-only') return `${josa(name, '은', '는')} 연습에서 나온 것뿐이라고 알려 줬어요.`;
      if (selection === 'not-now') return `${josa(name, '은', '는')} 지금 배우고 싶은 게 아니라고 알려 줬어요.`;
      fail('member topic selection');
    }
    const chosen = Array.isArray(labels) && labels.length && labels.every(label) ? labels : [name];
    return choiceLine(kind, chosen);
  }
  if (!Number.isSafeInteger(times) || !Number.isSafeInteger(activeDays)) fail('member observation count');
  const period = periodEnd ? `${memberDate(periodEnd)} 기준 최근 30일` : '최근 30일';
  const fact = kind === 'usage-repeat' ? `${period} 동안 ${josa(name, '을', '를')} ${activeDays}일, ${times}번 열었어요.`
    : kind === 'learning-topic' ? `${period} 동안 ${josa(name, '을', '를')} ${activeDays}일에 걸쳐 ${times}번 연습했어요.`
      : `${period} 동안 ${euro(name)} ${activeDays}일에 걸쳐 ${times}번 답했어요.`;
  if (state === 'agreed') return `${fact} ${kind === 'learning-topic' ? '더 배우고 싶은 내용이라고 알려 줬어요.' : '나에게 맞는 방식이라고 알려 줬어요.'}`;
  if (state === 'contextual') return `${fact} 때에 따라 다르다고 알려 줬어요.`;
  if (state === 'disagreed') return `${fact} 내 관심이나 선호로 보지 않기로 했어요.`;
  return `${fact} ${kind === 'learning-topic' ? '연습했다는 것만으로 관심이라고 정하지 않아요.' : '기록된 방식일 뿐 선호를 뜻하지 않아요.'}`;
}
// What the person told the screen, as it appears in their correction history.
const ANSWERS = Object.freeze({ interested: '더 배우고 싶다고 답했어요.', 'practice-only': '연습에서 나온 것뿐이라고 답했어요.', 'not-now': '지금은 아니라고 답했어요.' });
// `answer` is a practised topic's answer (interested, practice-only, not-now); other choices pass
// the facet and their labels.
function memberCorrectionLine({ kind, verdict = null, labels = [], answer = null, facet = null } = {}) {
  if (kind === 'review') {
    const lines = { agree: '맞다고 답했어요.', disagree: '아니라고 답했어요.', contextual: '때에 따라 다르다고 답했어요.' };
    if (!Object.hasOwn(lines, verdict)) fail('correction');
    return lines[verdict];
  }
  if (kind !== 'override') fail('correction');
  if (answer !== null) { if (!Object.hasOwn(ANSWERS, answer)) fail('correction'); return ANSWERS[answer]; }
  if (!Array.isArray(labels) || !labels.length || !labels.every(label)) fail('correction');
  return choiceLine(facet, labels);
}
// Core supplies validated, consent-scoped facts. A compact overview describes
// what is known and missing without promoting practice content to a preference.
function memberUnderstandingSummary({ hasDeclaration, hasFeedback, practice = null, learning, usage, learningAt = null, usageAt = null }) {
  if (typeof hasDeclaration !== 'boolean' || typeof hasFeedback !== 'boolean'
    || !['ready', 'disabled', 'unavailable'].includes(learning) || !['ready', 'disabled', 'unavailable'].includes(usage)) fail('member summary');
  let observation = '';
  if (learning === 'ready' && practice) {
    const { answered, independent, assisted, activeDays, to } = practice;
    if (![answered, independent, assisted, activeDays].every(n => Number.isSafeInteger(n) && n >= 0)
      || independent + assisted > answered || activeDays > Math.min(answered, 31)) fail('member practice summary');
    const period = `${memberDate(to)} 기준 최근 30일`;
    observation = answered ? `${period} 동안 ${activeDays}일, ${answered}번 답했어요. 그중 혼자 답한 건 ${independent}번, 도움 받고 답한 건 ${assisted}번이에요. ${activeDays === 1 ? '하루치 기록으로는 늘 그렇다고 정하지 않아요.' : '연습에서 쓴 방식과 내가 원하는 방식은 다를 수 있어요.'}`
      : `${period}에는 연습 기록이 없어요. 기록이 없다고 관심이나 실력이 없다는 뜻은 아니에요.`;
  }
  const scope = [];
  if (learning === 'disabled') scope.push('학습 기록 연결이 꺼져 있어 이번 설명에 쓰지 않았어요.');
  else if (learning === 'unavailable') scope.push('학습 기록은 이번 설명에 연결되지 않았어요.');
  else if (!practice) scope.push(learningAt ? `학습 기록은 ${memberDate(learningAt)} 기준이에요. 기간별 답한 횟수를 확인할 수 없어 줄여 말하지 않았어요.` : '기간별 답한 횟수를 확인할 수 없어 줄여 말하지 않았어요.');
  else if (hasDeclaration) scope.push(`학습 기록은 ${memberDate(practice.to)} 기준 최근 30일이에요. 내가 알려 준 것과 연습에서 보인 것을 나눠 봐요.`);
  if (usage === 'disabled') scope.push('앱 이용 기록 연결이 꺼져 있어 이번 설명에 쓰지 않았어요.');
  else if (usage === 'unavailable') scope.push('앱 이용 기록은 이번 설명에 연결되지 않았어요.');
  else if (usageAt) scope.push(`앱 이용 기록은 ${memberDate(usageAt)} 기준이에요. 앱을 열었다는 것만으로 관심을 정하지 않아요.`);
  return {
    headline: hasDeclaration ? '내가 알려 준 것과 지금의 기록' : '아직 나를 알아 가는 중이에요',
    opening: hasDeclaration ? '' : hasFeedback ? '기록에 대한 내 답을 먼저 썼어요. 아직 답하지 않은 관심이나 편한 방식은 짐작하지 않아요.'
      : '아직 관심사와 편한 방식을 정리할 만큼 알려 준 것이 없어요. 원하는 방식을 알려 주면 다음 설명에 먼저 써요.',
    observation, scope: scope.join(' '),
  };
}
function memberUnderstandingNote({ line, note }) {
  if (typeof line !== 'string' || typeof note !== 'string' || [...note].length > 200
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDFFF]/u.test(note)) fail('member note');
  // A literal quotation, never input to an instruction interpreter or classifier.
  return note.trim() ? `${line} 덧붙인 말: “${note}”` : line;
}
function memberUnderstandingActivityReason({ kind, labels }) {
  if (!['topic', 'learning', 'app'].includes(kind) || !Array.isArray(labels) || !labels.length || labels.some(name => typeof name !== 'string')) fail('member activity link');
  const named = labels.join(' · ');
  if (kind === 'learning') return `더 배우고 싶다고 한 ‘${named}’ 연습을 WORLD에서 골라 볼 수 있어요.`;
  if (kind === 'app') return `${josa(named, '을', '를')} 이어서 쓸 앱으로 골랐어요.`;
  return `고른 관심 주제 ‘${named}’${finalOf(named) ? '과' : '와'} 이어지는 앱이에요.`;
}
module.exports = { finalOf, josa, euro, joinAnd, dayLabel, relativeDay, kindWord, memberInsightStatement, memberInsightNow, memberInsightPracticeFact,
  memberInsightUsage, memberInsightQuestion, memberCorrectionLine, memberUnderstandingLine, memberUnderstandingSummary, memberUnderstandingNote, memberUnderstandingActivityReason };
