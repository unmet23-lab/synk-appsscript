import { ALL_FIELDS, PREFERENCE_CONTRACT, DOMAIN_SCOPE, EXECUTION_FIELDS } from './profile.mjs';

// Deliberately bounded Korean input adapter. Core Interpretation verifies the
// source and the review; it does not certify the semantics of these patterns.
export const EXTRACTOR_VERSION = 'path-travel-explicit-ko-1';
const fields = new Map(ALL_FIELDS.map(field => [field.id, field]));
const clone = value => JSON.parse(JSON.stringify(value));
const MONEY = '(?:[0-9][0-9,]*(?:\\.[0-9]+)?\\s*만(?:\\s*[0-9]+\\s*천)?|[0-9]+\\s*천|[0-9][0-9,]*)\\s*원';
const END = '(?:이에요|예요|이요|요|입니다|으로요|로요|으로 할게요|로 할게요|으로 해 주세요|로 해 주세요|으로 부탁해요|로 부탁해요|까지만요|까지만 쓸래요|까지 쓸래요|이내여야 해요|이하여야 해요|이어야 해요|여야 해요)?';
const rules = [];
const rule = (field, pattern, value, mode) => rules.push({ field, re: new RegExp(`^(?:${pattern})$`, 'u'), value, mode });
const amount = text => {
  if (text.includes(',') && !/^(?:[1-9]\d{0,2}(?:,\d{3})+)\s*원$/.test(text.trim())) return NaN;
  const clean = text.replace(/[\s,원]/g, '');
  const match = /^(?:(\d+(?:\.\d+)?)만)?(?:(\d+)천)?(\d+)?$/.exec(clean);
  return match ? Number(match[1] ?? 0) * 10000 + Number(match[2] ?? 0) * 1000 + Number(match[3] ?? 0) : NaN;
};
const minutes = text => {
  const clean = text.replace(/\s/g, '');
  if (/^(?:한|1)시간$/.test(clean)) return 60;
  if (/^(?:두|2)시간$/.test(clean)) return 120;
  return /시간$/.test(clean) ? Number(clean.replace('시간', '')) * 60 : Number(clean.replace('분', ''));
};
rule('budget', `(?:총\\s*예산|전체\\s*예산|여행\\s*예산|예산)(?:은|는|이)?\\s*(${MONEY})\\s*(?:이하|이내|까지)?\\s*${END}`, m => amount(m[1]), 'require');
rule('hotelMaxPrice', `(?:숙소|호텔|숙박)(?:는|은)?\\s*(?:1박에|한 박에)?\\s*(${MONEY})\\s*(?:이하|이내|까지)\\s*${END}`, m => amount(m[1]), 'require');
rule('hotelMaxPrice', `(?:숙소|호텔|숙박)(?:의)?\\s*(?:예산|비용|상한)(?:은|는|이)?\\s*(${MONEY})\\s*(?:이하|이내|까지)?\\s*${END}`, m => amount(m[1]), 'require');
rule('mealMaxPrice', `(?:한\\s*끼|한\\s*끼 식사)(?:에|는|당)?\\s*(?:예산(?:은)?\\s*)?(${MONEY})\\s*(?:이하|이내|까지)?\\s*${END}`, m => amount(m[1]), 'require');
rule('maxWait', `(?:식당\\s*(?:대기|웨이팅)|대기|웨이팅)(?:는|은)?\\s*(\\d+\\s*분)\\s*(?:이내|이하|까지)?\\s*${END}`, m => minutes(m[1]), 'require');
rule('maxWait', '식당에서\\s*(\\d+\\s*분)\\s*넘게 기다리고 싶지는 않아요', m => minutes(m[1]), 'require');
rule('walkLimit', `(?:하루\\s*(?:걷기|걷는 시간)|걷는 시간|도보 시간)(?:는|은)?\\s*((?:\\d+|한|두)\\s*(?:분|시간))\\s*(?:이내|이하|까지)?\\s*${END}`, m => minutes(m[1]), 'require');
rule('returnBy', '(다음 날 새벽|새벽|밤|오후)\\s*(\\d{1,2})시(?:\\s*(\\d{1,2})분)?까지\\s*(?:숙소로|숙소에)?\\s*(?:돌아갈래요|돌아가야 해요|돌아올래요|귀가할래요)', m => {
  const hour = Number(m[2]), minute = Number(m[3] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return NaN;
  return (m[1].includes('새벽') ? 24 + hour % 12 : 12 + hour % 12) * 60 + minute;
}, 'require');
rule('dayStart', '(?:출발|시작)(?:은|는)?\\s*오전\\s*(\\d{1,2})시(?:요|에요|예요|에 시작할래요|에 출발할래요)?', m => Number(m[1]), 'require');

rule('hotelNoise', '(?:숙소|호텔|방)(?:는|은|이|가)?\\s*(?:아주|매우|정말)?\\s*조용해야(?: 해요| 합니다| 해)?', 0.2, 'require');
rule('hotelNoise', '(?:숙소|호텔|방)(?:는|은|이|가)?\\s*(?:아주|매우)?\\s*조용(?:한 곳이 좋아요|했으면 좋겠어요|하면 좋겠어요)', 0.2);
rule('hotelNoise', '(?:숙소|호텔)(?:는|은)?\\s*생활 소음(?:은|은 좀| 정도는)?\\s*괜찮아요', 0.5);
rule('hotelCleanliness', '(?:숙소|호텔|방)(?:는|은|이|가)?\\s*(?:아주|매우|정말)?\\s*깨끗해야 해요', 0.95, 'require');
rule('hotelCentrality', '(?:숙소|호텔)(?:는|은)?\\s*중심지(?:에|와)?\\s*가까(?:워야 해요|운 곳이 좋아요)', 0.9);
rule('spice', '(?:음식(?:은|는)?\\s*)?(?:맵지 않은 음식|안 매운 음식)(?:이|을)?\\s*(?:꼭 |반드시 )?(?:필요해요|원해요|좋아요)', 0, 'require');
rule('spice', '(?:매운 (?:음식|걸|것)(?:은|을)?|매운맛(?:은|을)?)\\s*못 먹(?:어요|습니다)', 0, 'require');
rule('spice', '(?:음식(?:은|는)?\\s*)?약간 매워도 괜찮아요', 1);
rule('spice', '매운 음식도 (?:좋아요|좋아해요|괜찮아요)', 2);
rule('vegetarian', '채식 메뉴(?:가|는)?\\s*(?:꼭 |반드시 )?(?:필요해요|있어야 해요)', true, 'require');
rule('vegetarian', '채식(?: 여부| 메뉴)?(?:는|은)?\\s*(?:상관없어요|제한하지 않아요)', false);
rule('foodNovelty', '(?:음식(?:은|는)?\\s*)?새로운 음식(?:을|에)?\\s*(?:도전하고 싶어요|먹어 보고 싶어요)', 0.9);
rule('foodNovelty', '(?:음식(?:은|는)?\\s*)?익숙한 음식(?:이|을)?\\s*(?:좋아요|원해요)', 0.2);
rule('crowd', '(?:활동(?:은|는)?\\s*)?(?:한적한 곳|사람이 적은 곳)(?:이|을)?\\s*(?:좋아요|원해요)', 0.2);
rule('activityIndoor', '(?:활동(?:은|는)?\\s*)?실내(?:가|를)?\\s*(?:좋아요|원해요)', true);
rule('activityIndoor', '(?:활동(?:은|는)?\\s*)?야외(?:가|를)?\\s*(?:좋아요|원해요)', false);
rule('nightMusic', '(?:밤에는\\s*)?라이브 음악(?:이|은|을)?\\s*(?:좋아요|좋아해요|듣고 싶어요)', 'live');
rule('nightMusic', '(?:밤에는\\s*)?잔잔한 배경음악(?:이|을)?\\s*(?:좋아요|듣고 싶어요)', 'background');
rule('nightMusic', '(?:밤에는\\s*)?댄스 음악(?:이|을)?\\s*(?:좋아요|듣고 싶어요)', 'dance');
rule('conversation', '(?:밤에는\\s*)?(?:음악보다\\s*)?대화가 잘 들(?:려야 해요|렸으면 (?:좋겠어요|해요))', true);
rule('alcohol', '술(?:은|을)?\\s*(?:안 마실래요|마시지 않을래요|마시지 않아요|안 마셔요)', false, 'require');
rule('alcohol', '술 중심 장소(?:는|를)?\\s*(?:피할래요|빼 주세요)', false, 'require');
rule('alcohol', '술 중심 장소(?:도|는|를)?\\s*(?:괜찮아요|포함해도 좋아요)', true, 'require');
rule('transport', '(대중교통|택시|도보)(?:으로|로)?\\s*(?:이동할래요|다닐래요|이동하고 싶어요)', m => ({대중교통:'transit',택시:'taxi',도보:'walk'})[m[1]], 'require');
rule('pace', '(?:일정(?:은|는)?\\s*)?(?:여유 있게|여유롭게)(?:\\s*(?:다닐래요|하고 싶어요|보내고 싶어요))', 'easy', 'require');
rule('night', '(?:밤에는|저녁에는|저녁 이후에는)\\s*(?:숙소에서 쉬고 싶어요|일찍 쉬고 싶어요)', 'none');
rule('priority', '(음식|숙소)(?:에|에는)\\s*돈을 더 쓰고 싶어요', m => m[1] === '음식' ? 'food' : 'hotel');

function segments(text) {
  const result = []; let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const numeric = /[\d]/.test(text[i - 1] ?? '') && /[\d]/.test(text[i + 1] ?? '');
    if (i === text.length || /[\n;!?。]/.test(text[i]) || /[.,]/.test(text[i]) && !numeric) {
      let a = start, b = i;
      while (a < b && /\s/u.test(text[a])) a++;
      while (b > a && /\s/u.test(text[b - 1])) b--;
      if (a < b) result.push({start:a,end:b,quote:text.slice(a,b)});
      start = i + 1;
    }
  }
  return result;
}
function identity(text) {
  // Stable within a draft, different source text never shares a source ID.
  let hash = 2166136261;
  for (let i=0;i<text.length;i++) hash = Math.imul(hash ^ text.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
}

export function extractTravelText(text, {at = new Date().toISOString(), encounterId = 'seoul-trip-1'} = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new TypeError('여행에서 원하는 것을 1~4,000자로 적어 주세요.');
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at)) || !/^seoul-trip-[1-9]\d*$/.test(encounterId)) throw new TypeError('문장의 시각과 여행 구분을 확인해 주세요.');
  const sourceId = `speech-${identity(text + at + encounterId)}`;
  const source = {id:sourceId,scope:clone(DOMAIN_SCOPE),at,text,actor:'self'};
  const proposals = [], hints = {}, unhandled = [];
  // A later correction may revoke an earlier clause. Do not expose that earlier
  // number as an independently confirmable suggestion after splitting commas.
  if (/[,.!?\n;]\s*(?:아니(?:요|고)?(?:\s|[,，])|정정|수정할게)/.test(text)) {
    return {version:EXTRACTOR_VERSION,encounterId,packet:{contract:PREFERENCE_CONTRACT,scope:clone(DOMAIN_SCOPE),sources:[source],proposals,at},hints,
      unhandled:[{text,reason:'앞의 내용을 정정하는 표현이 있어요. 최종으로 원하는 조건만 다시 적어 주세요.'}]};
  }
  let subjectContext = 'self', stanceContext = 'current';
  for (const segment of segments(text)) {
    const raw = segment.quote;
    const other = /친구|엄마|아빠|부모|동행|남편|아내|그녀|그는|다른 사람/.test(raw);
    const self = /저는|나는|제가|내가|나의|제 취향/.test(raw);
    if (other) subjectContext = 'other';
    if (self && !other) subjectContext = 'self';
    if (/이번|지금|현재|오늘/.test(raw)) stanceContext = 'current';
    const stance = /만약|다면|라면|생기면|가정|일 경우/.test(raw) ? 'hypothetical'
      : /아마|모르|일지도|일 수도|고민|것 같/.test(raw) || text[segment.end] === '?' ? 'uncertain'
      : /예전|과거|작년|지난|좋아했|싫어했|었어요|였어요|었는데|전에는/.test(raw) ? 'past' : stanceContext;
    if (['past','hypothetical'].includes(stance)) stanceContext = stance;
    if (/\d+\s*(?:명|인)|두 명|둘이|세 명|가족|알레르기|알러지|휠체어|유아|아기|연봉|재산|부자|가난|돈이 (?:많|없)|직업|의사|원 정도|만 정도|[~～]|(?:에서|부터).*(?:까지|만원)|아니\s|아니에요|(?<!까)지만|인데|었는데/.test(raw) || other && self) {
      unhandled.push({text:raw,reason:'여러 사람·조건·부정·범위가 섞였거나 아직 지원하지 않는 내용입니다. 한 조건씩 직접 확인해 주세요.'}); continue;
    }
    let body = raw.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u,'');
    const prefix = /^(?:그리고\s*|(?:저는|나는|제가|내가|전|난|친구는|친구의|엄마는|아빠는)\s*|(?:이번 여행에서는|이번 여행은|이번 여행|이번에는|이번엔|평소에는|평소|보통|항상|늘|앞으로도|원래|예전에는|예전엔|작년에는|지난 여행에서는|지금은|지금|현재는|현재|오늘은|오늘|아마)\s*)/;
    while (prefix.test(body)) body = body.replace(prefix,'');
    // Declarations explicitly scoped to hypothetical situations remain blocked.
    body = body.replace(/^만약\s*/,'').replace(/^돈이 더 생기면\s*/,'');
    const found = rules.map(rule => ({rule,match:rule.re.exec(body)})).find(item=>item.match);
    if (!found) { unhandled.push({text:raw,reason:'뜻을 확실히 읽지 못했어요. 숫자와 단위를 넣거나 한 조건씩 나눠 적어 주세요.'}); continue; }
    const {rule:matched,match} = found;
    const value = typeof matched.value === 'function' ? matched.value(match) : matched.value;
    const field = fields.get(matched.field);
    if (field.kind === 'number' && (!Number.isFinite(value) || value < field.range[0] || value > field.range[1] || !Number.isInteger(value) && !['hotelNoise','hotelCleanliness','hotelCentrality','foodNovelty','crowd','nightEnergy'].includes(field.id)) || field.id === 'dayStart' && ![9,11].includes(value)) {
      unhandled.push({text:raw,reason:`${field.label}이 시제품에서 지원하는 범위 밖입니다. 임의로 값을 줄이거나 바꾸지 않았어요.`}); continue;
    }
    const id = `${sourceId}-p${proposals.length+1}`;
    proposals.push({id,field:matched.field,value,subject:subjectContext,stance,evidence:[{sourceId,...segment}]});
    hints[id] = {mode:EXECUTION_FIELDS.includes(field.id)?'require':matched.mode??(/꼭|반드시|해야|필수/.test(raw)?'require':'prefer'),duration:/평소|보통|항상|늘|앞으로도|원래/.test(raw)?'ongoing':'once',importance:3};
  }
  return {version:EXTRACTOR_VERSION,encounterId,packet:{contract:PREFERENCE_CONTRACT,scope:clone(DOMAIN_SCOPE),sources:[source],proposals,at},hints,unhandled};
}
