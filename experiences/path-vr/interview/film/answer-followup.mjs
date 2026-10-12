import { classifyAnswer, isShortExperienceDenial } from '../dialogue.mjs';

/** Fixed dialogue contracts, not text to dub over a different performance.
 * Only experience/plan have current media. Planned entries stay inactive unless
 * the caller supplies their generated and verified clip ids. */
export const FOLLOWUP_CATALOG = Object.freeze(Object.fromEntries(Object.entries({
  experience: '그 경험에서 직접 맡았던 일과 그 결과를 구체적으로 말씀해 주세요.',
  plan: '현장에 투입되기 전에 무엇을 어떻게 준비하실 겁니까.',
  meal: '식사 보조에서 무엇을 확인하고 어떻게 도왔습니까?',
  mobility: '이동을 도울 때, 먼저 확인해야 할 것은 무엇입니까?',
  refusal: '어르신이 돌봄을 거부하면 어떻게 대응하시겠습니까?',
  family: '가족을 돌보면서 가장 어려웠던 점과 대응을 말씀해 주세요.',
  handoff: '동료에게 무엇을 언제 보고해야 한다고 생각하십니까?',
  learning: '배운 내용 중 현장에서 적용할 한 가지를 설명해 주세요.',
  evidence: '방금 말씀하신 결과는 무엇을 근거로 확인하셨습니까?',
  role: '그중 본인이 직접 했거나 준비한 일을 구분해서 말씀해 주세요.',
}).map(([id, question]) => [id, Object.freeze({ id, clip: `strict-followup-${id}`, question })])));

const DEFAULT_CLIPS = Object.freeze(['strict-followup-experience', 'strict-followup-plan']);
const TOPIC = /요양|돌봄|돌보|돌봐|돌봤|간병|어르신|노인|할머니|할아버지|부모|아버지|어머니|가족|환자|식사|식단|섭취|삼킴|수저|휠체어|이동|부축|낙상|보행|목욕|배변|청결|안전|자격증|교육|실습|봉사|경험|근무|보고|인수인계|배우|배워|공부|훈련|준비|지원|보람|돕|도왔|도와|도움|경력/u;
const PAST = /돌봤|돌보았|돌본|보살폈|보살핀|간병했|간병한|부축했|부축한|도왔|도운|도와드렸|모셨|근무했|근무한|일했|봉사했|봉사한|실습했|실습한|보조했|보조한|수행했|담당했|맡았|준비했|확인했|기록했|보고했|살폈|(?:보조|수행|담당|준비|확인|기록|보고|봉사|실습|근무|간병|부축|청소|수발|돌봄활동)(?:을|를)?(?:해드렸|했|하였)|한적(?:이|은)?있|해본적(?:이|은)?있|경험(?:이|은|는)?(?:조금|많이)?있/u;
const ACTION = /돌보|돌봐|돌봤|돌본|보살|간병|부축|돕|도왔|도운|도와|모셨|보조|준비|확인|기록|보고|관찰|담당|맡|수행|살폈/u;
const NEGATED = /(?:경험|경력|실습|봉사)(?:이|은|는|을|를)?(?:(?:아직|전혀|별로|거의)*)?(?:없|부족|안해|못해|하지않|해보지않)|(?:적|경험)(?:이|은|는)?(?:전혀|아직)?없|(?:경험|경력)(?:이|은|는)?(?:많지|있지)(?:는)?않|(?:돌보|돕|하|일하|근무하|보조하|부축하|간병하|준비하|확인하|기록하|보고하)지(?:않|못)|(?:안|못)(?:돌봤|돌보았|도왔|도와드렸|부축했|간병했|근무했|일했|봉사했|실습했|보조했|했)|하지는않|(?:돌본|도운|간병한|부축한|맡은|돌봤던|도왔던|간병했던|부축했던|맡았던)(?:건|것은|것이|게)(?:아니|아닙)|(?:돌봤|도왔|도와드렸|간병했|부축했|일했|근무했)다고(?:는)?(?:할수|말할수)(?:는)?없/u;
const UNCLEAR_NEGATION = /없지(?:는)?않|(?:없|안했|못했)다고[^.!?]{0,12}(?:않|아니|아닙)/u;
const HYPOTHETICAL = /(?:만약|가령|가정하면)|(?:했다|돌봤다|돌보았다|도왔다|있다|없다|받았다|됐다|했더라|돌봤더라|도왔더라|라|이라)면|(?:했|돌봤|돌보았|도왔|맡았|일했|근무했)으면|(?:돌본|도운|맡은)다면|(?:돌보|돌봐|돕|하|도우|맡|일하|지원하|입사하|거부하|이동하|근무하)(?:게되)?면(?!서)|(?:였|했|돌봤|도왔)을(?:것|겁)|(?:하는|할|했을|돌보는|돌볼|돕는|도울)경우/u;
const FUTURE = /고싶|겠습니다|하려고|(?:할|받을|배울|준비할)(?:예정|계획)|배우려고|준비하려|해야|할것|할겁|될것|될겁|한다면|하고자/u;
const RESULT = /(?:식사량|섭취량|체중|상태|통증|불편|안전|사고|낙상|증상|수치|만족도|참여|혈압|혈당|횟수|시간)(?:이|가|은|는|도|을|를)?[^.!?]{0,18}(?:늘|줄|개선|좋아졌|나아졌|회복|감소|증가|유지|없어졌|높아졌|낮아졌)|(?:결과|덕분에|그래서|그후|이후)[^.!?]{0,30}(?:개선|좋아졌|나아졌|회복|감소|증가|줄었|늘었|만족|편해|안정)|감사하셨|고맙다고|편해졌다고|만족하셨/u;
const RESULT_NEGATION = /좋아지지않|나아지지않|개선되지않|늘지않|줄지않|회복되지않|확인하지(?:않|못)|모르/u;
const SELF = /제가|저는|저도|나는|내가|본인은|본인이/u;
const OTHER = /(?:동료|친구|선배|후배|언니|누나|형|오빠|동생|어머니|아버지|엄마|아빠|남편|아내|배우자|딸|아들|가족|할머니|할아버지|어르신|환자|간호사|요양보호사|팀원|저희팀|우리팀|씨|선생님)(?:들)?(?:이(?!동)|가(?!족)|는|은)/u;
const REPORTED = /(?:다고|라고)(?:들었|했습니다|했어요|말했|하셨)|(?:봤|보았|읽었|들었)(?:습니다|어요)/u;
const QUOTED = /(?:다는|라는)[^.!?]{0,30}(?:얘기|이야기|말|문장|표현)|(?:다고|라고)(?:합니다|상상|들었|말했)|(?:봤|왔|았|었|했|있)다고생각/u;
const CORRECTED = /(?:뜻|의미)(?:은|는|이)?(?:아니|아닙)|(?:그건|그것은)?(?:제가|내가|본인이)(?:아니|아닙)|아니요|정정/u;
const TENTATIVE = /(?:것|거|듯)(?:같|합니다)|(?:봤|았|었|했)을수도|아마|어쩌면/u;
const LEARNING = /공부|자격증|교육|훈련|연습|배우|배웠|배운|배워|실습/u;
const STUDIED = /공부(?:를)?(?:하고|중|했)|배우고|배우는|배웠|배운|배워|(?:교육|훈련)(?:을)?받(?:았|고)|수료|자격증(?:을)?취득|실습(?:을)?(?:했|하고)/u;
const PREPARING = /준비(?:를)?(?:하고|중)|지원(?:했|하였|하고)|원했|생각했|관심(?:이|을)|보람(?:이|을)|좋아/u;

function repair(reason) { return { kind: 'repair', reason, category: null, evidence: null, ruleId: null }; }
function compact(text) { return text.normalize('NFC').replace(/\s/gu, ''); }

/** Keep offsets into the unmodified input. Each evidence quote is a full
 * clause, including its negation, not an isolated positive keyword. */
function clauses(text) {
  const parts = [];
  const boundary = /[.!?。！？;\n]+|[,，]|(?:지만|으나|(?:없|있|했|됐|보았|돌봤)는데)|(?:고|며|면서)(?=\s*(?:저는|제가|나는|내가|동료(?:가|는)|친구(?:가|는)|어머니(?:가|는)|아버지(?:가|는)|앞으로|지금은|현재는|이제는))|(?:습니다|어요|해요)(?=\s+(?:저는|제가|나는|내가|그리고|그래서|이후|그후|식사량|섭취량|상태|결과))/gu;
  let start = 0;
  for (const match of text.matchAll(boundary)) {
    const end = match.index + match[0].length;
    parts.push({ start, end }); start = end;
  }
  if (start < text.length) parts.push({ start, end: text.length });
  return parts.map((part) => {
    const raw = text.slice(part.start, part.end);
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const start = part.start + leading, end = part.end - trailing;
    return { start, end, quote: text.slice(start, end), value: compact(text.slice(start, end)) };
  }).filter((part) => part.value);
}

function describe(text) {
  let previousSubject = 'self', previousPolarity = 'affirmed';
  return clauses(text).map((part) => {
    const value = part.value;
    const self = SELF.exec(value), other = OTHER.exec(value);
    const pastCue = PAST.exec(value);
    // An explicit, unrecognised subject ("김철수가", "제 딸이") is not an
    // omitted "I". Do not guess names or add them to a claimed self-history.
    const raw = part.quote.normalize('NFC');
    const unknown = [...raw.matchAll(/(?:^|\s)([가-힣]{2,12})(?:이|가)(?=\s)/gu)]
      .find((match) => pastCue && compact(raw.slice(0, match.index)).length < pastCue.index
        && !SELF.test(match[0]) && !TOPIC.test(match[1]));
    const unknownIndex = unknown ? compact(raw.slice(0, unknown.index)).length : -1;
    // Explicit third-party reporting cannot become the applicant's history
    // just because the sentence starts with "저는".
    let subject = other && (!self || other.index > self.index) ? 'other' : self ? 'self' : previousSubject;
    if (unknown && !other && (!self || unknownIndex > self.index)) subject = 'unknown';
    if (REPORTED.test(value) && other) subject = 'other';
    if (QUOTED.test(value)) subject = other ? 'other' : 'reported';
    const shortDenial = isShortExperienceDenial(value);
    const negated = NEGATED.test(value) || shortDenial;
    const hypothetical = HYPOTHETICAL.test(value);
    // "돌봤고 배우고 싶다" contains an affirmed past action. "돌봤다고
    // 생각하고 싶다" does not: only a direct verb conjunction qualifies.
    const pastThenIntention = pastCue && /^(?:고|으며|기때문에)/u.test(value.slice(pastCue.index + pastCue[0].length));
    const future = FUTURE.test(value) && !pastThenIntention;
    let polarity = hypothetical ? 'hypothetical' : negated ? 'negated' : future ? 'future' : 'affirmed';
    const result = RESULT.test(value) && !RESULT_NEGATION.test(value);
    // "...했다면. 결과가 좋아졌을 겁니다" is not measured experience.
    if (!self && !other && result && previousPolarity === 'hypothetical') polarity = 'hypothetical';
    const relevant = TOPIC.test(value) || shortDenial;
    const past = PAST.test(value) && polarity === 'affirmed';
    const action = ACTION.test(value) && past;
    const observation = /봤|보았|들었|읽었/u.test(value) && !/(?:돌봤|살펴봤|도와드렸|확인했|기록했)/u.test(value);
    previousSubject = subject; previousPolarity = polarity;
    return { ...part, subject, polarity, relevant, past, action, result, observation };
  });
}

function evidence(part) {
  return { quote: part.quote, start: part.start, end: part.end, subject: part.subject, polarity: part.polarity };
}

/** A bounded phrase planner. It never verifies an applicant's history, stores
 * their answer, performs network calls or invents speech for an existing clip.
 * availableClipIds must contain only media the caller has verified, including
 * exact spoken dialogue. Missing new media falls back to the original clips. */
export function planAnswerFollowup(text, { availableClipIds = DEFAULT_CLIPS, ...options } = {}) {
  const meaning = classifyAnswer(text, options);
  if (meaning.kind === 'repair') return { ...meaning, evidence: null };
  const value = compact(text);
  // A positive token cannot override a later correction or a tentative memory.
  // Recognition confidence is deliberately not a shortcut around this check.
  const parts = describe(text);
  if (UNCLEAR_NEGATION.test(value) || PAST.test(value) && CORRECTED.test(value)
    || parts.some((part) => PAST.test(part.value) && TENTATIVE.test(part.value) && !HYPOTHETICAL.test(part.value))) return repair('uncertain');
  const relevant = parts.filter((part) => part.relevant);
  if (!relevant.length && meaning.category === 'off-topic') return repair('off-topic');
  if (!relevant.length && /^(?:네|예|아니요|음|어|그렇습니다|그렇군요|알겠습니다|열심히하겠습니다|잘하겠습니다|그냥|좋습니다|맞습니다|감사합니다|열심히|성실히)[.!?\s]*$/u.test(text.trim())) return repair('detail');
  const selfExperience = relevant.find((part) => part.subject === 'self' && part.past && !part.observation);
  const directAction = relevant.find((part) => part.subject === 'self' && part.action && !part.observation);
  const selectedResult = parts.find((part) => part.subject === 'self' && part.result && part.polarity === 'affirmed');
  const otherExperience = relevant.find((part) => part.subject === 'other' && (part.past || part.observation));
  const denied = relevant.find((part) => part.subject === 'self' && part.polarity === 'negated');
  const preparation = denied || parts.find((part) => (part.relevant || ACTION.test(part.value)) && (
    part.polarity === 'hypothetical' || part.polarity === 'future' && part.subject === 'self'
    || part.subject === 'self' && part.polarity === 'affirmed' && (STUDIED.test(part.value) || PREPARING.test(part.value))
    || part.subject === 'other' && !PAST.test(part.value) && /좋다고생각/u.test(part.value)
  ));
  if (!selfExperience && !otherExperience && !preparation) return repair(parts.some((part) => part.subject === 'reported') ? 'uncertain' : 'detail');
  let selected = selfExperience || relevant[0] || parts[0];
  let desiredId, reason, ruleId;
  if (selectedResult && directAction) {
    selected = selectedResult; desiredId = 'evidence'; reason = '답변에 명시된 행동의 결과와 확인 근거를 이어 묻습니다.'; ruleId = 'stated-result';
  } else if (otherExperience && !selfExperience && !preparation) {
    selected = otherExperience; desiredId = 'role'; reason = '타인의 경험을 본인의 경험으로 단정하지 않고 본인 역할을 확인합니다.'; ruleId = 'other-person';
  } else {
    const refusal = relevant.find((part) => /거부|싫어|원하지|거절/u.test(part.value) && /어르신|환자|돌봄|식사|목욕/u.test(part.value));
    const mobility = relevant.find((part) => /이동|휠체어|부축|낙상|보행/u.test(part.value));
    const handoff = relevant.find((part) => /인수인계|보고|동료|담당자|간호사/u.test(part.value));
    const meal = relevant.find((part) => part.subject === 'self' && part.action && part.polarity === 'affirmed' && /식사|섭취|식단|수저|삼킴/u.test(part.value));
    const family = relevant.find((part) => part.subject === 'self' && part.action && part.polarity === 'affirmed' && /가족|할머니|할아버지|부모|아버지|어머니|엄마|아빠/u.test(part.value));
    const learning = relevant.find((part) => LEARNING.test(part.value) && STUDIED.test(part.value) && part.subject === 'self' && part.polarity === 'affirmed');
    if (refusal) { selected = refusal; desiredId = 'refusal'; reason = '돌봄 거부 상황에 어떻게 대응할지 이어 묻습니다.'; ruleId = 'refusal-topic'; }
    else if (mobility) { selected = mobility; desiredId = 'mobility'; reason = '언급한 이동 보조에서 먼저 확인할 점을 묻습니다.'; ruleId = 'mobility-topic'; }
    else if (handoff) { selected = handoff; desiredId = 'handoff'; reason = '언급한 협업 상황에서 보고 시점과 내용을 묻습니다.'; ruleId = 'handoff-topic'; }
    else if (meal) { selected = meal; desiredId = 'meal'; reason = '직접 했다고 말한 식사 보조를 구체적으로 묻습니다.'; ruleId = 'meal-action'; }
    else if (family) { selected = family; desiredId = 'family'; reason = '직접 했다고 말한 가족 돌봄의 어려움과 대응을 묻습니다.'; ruleId = 'family-action'; }
    else if (learning) { selected = learning; desiredId = 'learning'; reason = '언급한 학습과 현장 적용을 연결합니다.'; ruleId = 'learning-topic'; }
    else if (selfExperience) { selected = selfExperience; desiredId = 'experience'; reason = '본인이 경험했다고 말한 내용을 구체적으로 묻습니다.'; ruleId = 'past-action'; }
    else { selected = preparation; desiredId = 'plan'; reason = '답변에서 밝힌 준비나 앞으로의 행동을 구체적으로 묻습니다.'; ruleId = denied ? 'no-experience' : selected.polarity === 'hypothetical' ? 'hypothetical' : 'preparation-plan'; }
  }
  const available = new Set(Array.isArray(availableClipIds) || availableClipIds instanceof Set ? availableClipIds : []);
  const desired = FOLLOWUP_CATALOG[desiredId];
  const fallbackId = selfExperience ? 'experience' : 'plan';
  const chosen = available.has(desired.clip) ? desired : FOLLOWUP_CATALOG[fallbackId];
  if (chosen.id === 'plan' && !preparation) return repair('detail');
  if (!available.has(chosen.clip)) return repair('media');
  const fallback = chosen.id !== desiredId;
  // The fallback's evidence must support its actual question. Do not label an
  // experience clip with a different person's action or an isolated outcome.
  if (fallback) selected = selfExperience || preparation;
  const category = selfExperience ? 'experience' : denied || LEARNING.test(compact(text)) ? 'preparation' : meaning.category === 'experience' ? 'preparation' : meaning.category;
  return {
    kind: 'usable', ...chosen, category,
    evidence: evidence(selected), reason: fallback ? (selfExperience ? '답변에서 본인이 경험했다고 말한 내용을 바탕으로 준비된 경험 질문을 골랐습니다.' : '본인의 실제 경험으로 단정하지 않고 현장 투입 전 준비를 묻습니다.') : reason,
    ruleId: denied && !selfExperience && chosen.id === 'plan' ? 'no-experience' : ruleId,
    negatedExperience: !!denied && !selfExperience,
    desiredId, fallback,
  };
}
