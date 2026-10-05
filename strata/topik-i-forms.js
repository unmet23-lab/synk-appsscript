'use strict';
// Which TOPIK I grammar point (topik-i.grammar.json) a filled blank uses, read from the form that
// fills it (`answer`) and the words right after the blank (`after`): 빵{을} 먹어요 → G203,
// 영화를 {보러} 갔어요 → G303, 이사를 {도와줄} 거예요 → G302. Particles come straight from the
// forms in the grammar file; endings from how each form is written out in a sentence. It names
// none when the form alone cannot tell: a conjunction (그래서, 하지만) or a plain present ending.
// For an item that practises grammar; a noun answer that merely ends like an ending is not one.
// The links are drafts like the grammar layer itself: teacher review comes later.
const grammar = require('./topik-i.grammar.json');
const words = require('./topik-i.words.json');

const HANGUL = 0xac00, SYLLABLES = 11172;
const syllable = ch => { const c = (ch || '').charCodeAt(0) - HANGUL; return c >= 0 && c < SYLLABLES ? { vowel: Math.floor((c % 588) / 28), final: c % 28 } : null; };
const FINAL_N = 4, FINAL_L = 8, FINAL_B = 17, FINAL_SS = 20;
// ㅏ ㅐ ㅓ ㅕ ㅘ ㅙ ㅝ: the vowels a stem ends in before -아/어서 (가서, 해서, 먹어서, 마셔서, 와서, 봬서, 추워서).
const A_EO = new Set([0, 1, 4, 6, 9, 10, 14]);
const finalOf = word => syllable(word.slice(-1))?.final;
// Conjunctions are words of their own, though some end like an ending (그리고, 그러니까, 하지만).
const CONJUNCTIONS = new Set(['그리고', '그래서', '그러나', '그런데', '하지만', '그렇지만', '그러면', '그러니까', '그래도', '그럼', '또']);

// 이/가, (으)로, 하고/와/과 … written out: 이, 가, 으로, 로, 하고, 와, 과.
const PARTICLES = new Map();
for (const [id, , forms] of grammar.points) {
  for (const form of forms) {
    if (form.startsWith('-') || /\s/.test(form)) continue;
    for (const part of form.split('/')) for (const surface of part.startsWith('(으)') ? [`으${part.slice(3)}`, part.slice(3)] : [part]) {
      if (PARTICLES.has(surface) && PARTICLES.get(surface) !== id) throw new Error(`Strata: particle ${surface} belongs to two points`);
      PARTICLES.set(surface, id);
    }
  }
}

// Endings, the more particular first: 찍으면 + 안 돼요 is -(으)면 안 되다, not -(으)면.
const before = (word, tail) => word.slice(0, word.length - tail.length);
const ENDINGS = [
  ['G305', w => /^못( |$)/.test(w)],
  ['G209', w => /^안( |$)/.test(w)],
  ['G506', (w, a) => /면$/.test(w) && /^\s*안 (되|돼|됩)/.test(a) || /면 안 (되|돼|됩)/.test(w)],
  ['G505', (w, a) => /[아어여와워해]도$/.test(w) && /^\s*(되|돼|됩)/.test(a) || /도 (되|돼|됩)/.test(w)],
  ['G402', (w, a) => finalOf(w) === FINAL_L && /^\s*수 (있|없)/.test(a) || /(.) 수 (있|없)/.test(w) && finalOf(w.split(' 수 ')[0]) === FINAL_L],
  ['G509', (w, a) => finalOf(w) === FINAL_N && /^\s*적이 (있|없)/.test(a) || / 적이 (있|없)/.test(w) && finalOf(w.split(' 적이 ')[0]) === FINAL_N],
  ['G608', (w, a) => finalOf(w) === FINAL_L && /^\s*것 같/.test(a) || / 것 같/.test(w) && finalOf(w.split(' 것 같')[0]) === FINAL_L],
  ['G302', (w, a) => finalOf(w) === FINAL_L && /^\s*거(예|에)요/.test(a) || / 거(예|에)요$/.test(w) && finalOf(w.split(' 거')[0]) === FINAL_L],
  ['G603', (w, a) => finalOf(w) === FINAL_L && /^\s*때/.test(a) || / 때$/.test(w) && finalOf(w.split(' 때')[0]) === FINAL_L],
  // -(으)ㄴ 뒤에 and -(으)ㄴ 다음에 say what -(으)ㄴ 후에 says and are taught with it. 저는 다음 주에 is 는.
  ['G406', (w, a) => /^(후에|전에)$/.test(w) || /기$/.test(w) && /^\s*전에/.test(a) || /기 전에$/.test(w)
    || finalOf(w) === FINAL_N && !/는$/.test(w) && /^\s*(후|뒤|다음)(에)?([,.\s]|$)/.test(a) || / (후|뒤|다음)에$/.test(w) && finalOf(w.split(' ')[0]) === FINAL_N],
  ['G407', (w, a) => /는$/.test(w) && /^\s*(것|거)/.test(a) || /는 (것|거)/.test(w)],
  ['G301', (w, a) => /고 싶/.test(w) || /고$/.test(w) && /^\s*싶/.test(a)],
  ['G409', (w, a) => /고 (있|계)/.test(w) || /고$/.test(w) && /^\s*(있|계)/.test(a)],
  ['G405', (w, a) => /려고 (하|해|했|합)/.test(w) || /려고$/.test(w) && /^\s*(하|해|했|합)/.test(a)],
  // -아/어야 하다 and -아/어야 되다 are one point (해야 해요, 해야 돼요).
  ['G403', (w, a) => /야 (하|해|했|합|되|돼|됐|됩)/.test(w) || /야$/.test(w) && /^\s*(하|해|했|합|되|돼|됐|됩)/.test(a)],
  ['G404', w => /.(주세요|줘요)$/.test(w) && !/^(주세요|줘요)$/.test(w)],
  ['G408', w => /[아어여와워해가] (봐|봤|보세요|볼)/.test(w)],
  ['G304', (w, a) => /지 않/.test(w) || /지$/.test(w) && /^\s*않/.test(a)],
  ['G313', (w, a) => /지 못/.test(w) || /지$/.test(w) && /^\s*못/.test(a)],
  // 넣지 마세요, 가지 말고: -지 말다. The word after tells it (가지 alone is also a noun).
  ['S226', (w, a) => /지$/.test(w) && /^\s*(마|말|맙)/.test(a) || /지 (마|말|맙)/.test(w)],
  ['G303', w => /러$/.test(w)],
  ['G311', w => /까요\??$/.test(w) && finalOf(before(w.replace(/\?$/, ''), '까요')) === FINAL_L],
  ['G612', w => /(게요|래요)$/.test(w) && finalOf(before(w, '게요')) === FINAL_L],
  // 안녕하십니까, 갑니까 are -습니까/-ㅂ니까: -(으)니까 never follows a syllable ending in ㅂ (입으니까, 추우니까).
  ['G410', w => /니까$/.test(w) && finalOf(before(w, '니까')) !== FINAL_B],
  ['G610', w => /는데$/.test(w) || /데$/.test(w) && finalOf(before(w, '데')) === FINAL_N],
  // 5시까지만 is 까지 and 만, not -지만.
  ['G307', w => /지만$/.test(w) && !/까지만$/.test(w)],
  ['G401', w => /면$/.test(w)],
  ['G308', w => /서$/.test(w) && w.length > 1 && A_EO.has(syllable(before(w, '서').slice(-1))?.vowel) && finalOf(before(w, '서')) === 0],
  ['G306', w => /고$/.test(w) && w.length > 1],
  ['G411', w => /네요$/.test(w)],
  ['G412', w => /(지요|죠)\??$/.test(w)],
  ['G211', w => /세요$/.test(w)],
  ['G204', w => /(이에요|예요)$/.test(w)],
  // A past ending: the syllable before 어요 carries ㅆ (갔어요, 쉬었어요), but 있어요 is the present of 있다
  // and 모르겠어요, 알겠어요 carry -겠-.
  ['G208', w => /어요$/.test(w) && finalOf(before(w, '어요')) === FINAL_SS && !/(있|겠)어요$/.test(w)],
  ['G501', (w, a) => /.는$/.test(w) && /^\s+[가-힣]/.test(a)],
];

function grammarOf(answer, { after = '' } = {}) {
  const word = String(answer ?? '').trim();
  if (!word) return null;
  if (PARTICLES.has(word)) return PARTICLES.get(word);
  if (CONJUNCTIONS.has(word)) return null;
  for (const [id, test] of ENDINGS) if (test(word, String(after))) return id;
  return null;
}
// The points the endings above can name; a point not here (숫자/시간 표현, -아/어요) is named by none.
const ENDING_POINTS = Object.freeze(ENDINGS.map(([id]) => id));

// A TOPIK I noun or pronoun (topik-i.words.json), alone or with a particle: 병원, 동생은, 편지만.
const NOUNS = new Set(words.words.filter(([, , pos]) => pos === '명' || pos === '대').map(([, word]) => word));
const TAILS = [...PARTICLES.keys(), '만', '도', '의', '까지', '부터'];
const isNoun = word => NOUNS.has(word) || TAILS.some(t => word.length > t.length && word.endsWith(t) && NOUNS.has(word.slice(0, -t.length)));
const TIME_UNITS = new Set(['분', '초', '년', '주일', '개월']);
// 만·까지·부터 after a noun, a numeral or a number are often what a rule turns on (5시까지만, 13살 이하만,
// 지금부터), so a sentence names them. 편지만 is 만; 먹지만 is -지만.
const NUMERALS = new Set(words.words.filter(([, , pos]) => pos === '수').map(([, word]) => word));
const ADVERBS = new Set(words.words.filter(([, , pos]) => pos === '부').map(([, word]) => word));
const stemLike = s => !!s && (NOUNS.has(s) || NUMERALS.has(s) || /\d/.test(s));
function cruxParticles(word) {
  const ids = [];
  for (const [tail, id] of [['부터', 'S104'], ['까지', 'S105']]) { const at = word.indexOf(tail); if (at > 0 && stemLike(word.slice(0, at))) ids.push(id); }
  if (word.length > 1 && word.endsWith('만')) { const stem = word.slice(0, -1); if (stemLike(stem) || /(까지|부터)$/.test(stem) && stemLike(stem.slice(0, -2))) ids.push('S107'); }
  return ids;
}

// The grammar points a whole sentence uses, in the order they come: endings read word by word (each
// with the words after it) and a number with its unit (7살, 오후 5시 30분: 숫자/시간 표현). A blank
// is known to hold a form; a word in a sentence may be a noun, so some endings read more narrowly:
// -고, -(으)러, -아/어서 and the noun-modifying -는 are not read at all (친구하고, 달러, 학교에서,
// 어린이는), -(으)면 only where the word cannot be a noun (있으면, 하면; not 라면), and a TOPIK I noun
// is no verb before 후·뒤·다음 (병원 뒤에, 1시간 후에, 동생은 다음에) and has no -지만 or -(으)ㄴ데
// (편지만, 가운데). A verb that is also such a noun is missed (옷을 산 후에) rather than misread.
// Particles are read with particleAfter, for a word the caller knows.
const NOT_IN_SENTENCES = new Set(['G306', 'G303', 'G308', 'G501']);
const IN_SENTENCES = new Map([
  ['G406', (w, a) => /기$/.test(w) && /^\s*전에/.test(a)
    || finalOf(w) === FINAL_N && !/는$/.test(w) && !/\d/.test(w) && !TIME_UNITS.has(w) && !isNoun(w) && /^\s*(후|뒤|다음)(에)?([,.\s]|$)/.test(a)],
  // 저는 거기에 is 는 and 거기.
  ['G407', (w, a) => /는$/.test(w) && /^\s*(것|거(예요|에요|야|를|는|가|도|만)?)([\s.,!?]|$)/.test(a)],
  ['G307', w => /지만$/.test(w) && !/까지만$/.test(w) && !isNoun(before(w, '만'))],
  ['G610', w => !isNoun(w) && (/는데$/.test(w) || /데$/.test(w) && finalOf(before(w, '데')) === FINAL_N)],
  ['G401', w => /(으|하|되|이)면$/.test(w)],
  // 갈 거예요: this 거예요 belongs to -(으)ㄹ 거예요.
  ['G204', w => /(이에요|예요)$/.test(w) && !/^(거|것이)(예요|에요)$/.test(w)],
]);
const NUMBER = /\d+\s*(시간|시|분|초|살|세|개월|월|일|년|주|명|개|원|번|층|장|권)/;
// 빼 주세요, 넣어 주세요, 따뜻하게 해 주세요: -아/어 주세요 written with a space. The word before is a verb
// in its -아/어 form (a stem ending in ㅏ ㅐ ㅓ ㅕ ㅘ ㅙ ㅝ with no final consonant); a TOPIK I noun is not
// (사과 주세요, 차 주세요), and 한 잔 주세요 keeps plain -(으)세요. Only the polite 주세요: the plain
// 넣어 줘 of a story request is left as it is. A TOPIK I adverb or numeral before 주세요 is no verb either
// (더 주세요, 먼저 주세요, 하나 주세요).
const SPACED_GIVE = w => !!w && w.length > 0 && !isNoun(w) && !ADVERBS.has(w) && !NUMERALS.has(w) && finalOf(w) === 0 && A_EO.has(syllable(w.slice(-1))?.vowel);
function grammarIn(sentence) {
  const text = String(sentence ?? ''), found = [];
  const add = (id, at) => { if (!found.some(f => f.id === id)) found.push({ id, at }); };
  const number = NUMBER.exec(text);
  if (number) add('G212', number.index);
  let previous = '';
  for (const m of text.matchAll(/\S+/g)) {
    const word = m[0].replace(/^[("“‘'«]+|[.,!?…"”’'»)]+$/g, '');
    const last = previous; previous = word;
    if (!word || PARTICLES.has(word) || CONJUNCTIONS.has(word)) continue;
    if (word === '주세요' && SPACED_GIVE(last)) { add('G404', m.index); continue; }
    for (const id of cruxParticles(word)) add(id, m.index);
    // 서랍이 아니라, 일 층이 아니에요: 이/가 아니다. 아니 alone (아니, 괜찮아요) has no 이/가 before it.
    if (/^(아니|아닙|아냐)/.test(word) && /[이가]$/.test(last) && last.length > 1) { add('S115', m.index); continue; }
    const after = text.slice(m.index + m[0].length);
    for (const [id, ending] of ENDINGS) {
      if (NOT_IN_SENTENCES.has(id)) continue;
      // 찍으면 안 됩니다: this 안 belongs to -(으)면 안 되다.
      if (id === 'G209' && /면$/.test(last)) continue;
      if ((IN_SENTENCES.get(id) || ending)(word, after)) { add(id, m.index); break; }
    }
  }
  return found.sort((x, y) => x.at - y.at).map(f => f.id);
}
// The point of the particle right after `word` in a sentence: 마린은 → G202, 과자를 → G203. A place
// noun between them carries it for the word before it: 상자 안에, 책상 위에 → G206.
const PLACE = /^\s+(안|위|밑|아래|앞|뒤|옆|속)(?=[가-힣])/;
function particleAfter(text, word) {
  const source = String(text ?? ''), at = word ? source.indexOf(word) : -1;
  if (at < 0) return null;
  let rest = source.slice(at + word.length);
  const place = PLACE.exec(rest);
  if (place) rest = rest.slice(place[0].length);
  const tail = (/^[가-힣]+/.exec(rest) || [''])[0];
  for (let n = tail.length; n > 0; n--) if (PARTICLES.has(tail.slice(0, n))) return PARTICLES.get(tail.slice(0, n));
  return null;
}
// Points a whole sentence names by its own rules above (besides the endings and particles).
const SENTENCE_POINTS = Object.freeze(['S104', 'S105', 'S107', 'S115']);
module.exports = { grammarOf, grammarIn, particleAfter, PARTICLES, ENDING_POINTS, SENTENCE_POINTS };
