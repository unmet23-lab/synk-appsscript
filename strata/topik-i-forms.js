'use strict';
// Which TOPIK I grammar point (topik-i.grammar.json) a filled blank uses, read from the form that
// fills it (`answer`) and the words right after the blank (`after`): 빵{을} 먹어요 → G203,
// 영화를 {보러} 갔어요 → G303, 이사를 {도와줄} 거예요 → G302. Particles come straight from the
// forms in the grammar file; endings from how each form is written out in a sentence. It names
// none when the form alone cannot tell: a conjunction (그래서, 하지만) or a plain present ending.
// For an item that practises grammar; a noun answer that merely ends like an ending is not one.
// The links are drafts like the grammar layer itself: teacher review comes later.
const grammar = require('./topik-i.grammar.json');

const HANGUL = 0xac00, SYLLABLES = 11172;
const syllable = ch => { const c = (ch || '').charCodeAt(0) - HANGUL; return c >= 0 && c < SYLLABLES ? { vowel: Math.floor((c % 588) / 28), final: c % 28 } : null; };
const FINAL_N = 4, FINAL_L = 8, FINAL_SS = 20;
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
  ['G506', (w, a) => /면$/.test(w) && /^\s*안 (되|돼)/.test(a) || /면 안 (되|돼)/.test(w)],
  ['G505', (w, a) => /[아어여와워해]도$/.test(w) && /^\s*(되|돼)/.test(a) || /도 (되|돼)/.test(w)],
  ['G402', (w, a) => finalOf(w) === FINAL_L && /^\s*수 (있|없)/.test(a) || /(.) 수 (있|없)/.test(w) && finalOf(w.split(' 수 ')[0]) === FINAL_L],
  ['G509', (w, a) => finalOf(w) === FINAL_N && /^\s*적이 (있|없)/.test(a) || / 적이 (있|없)/.test(w) && finalOf(w.split(' 적이 ')[0]) === FINAL_N],
  ['G608', (w, a) => finalOf(w) === FINAL_L && /^\s*것 같/.test(a) || / 것 같/.test(w) && finalOf(w.split(' 것 같')[0]) === FINAL_L],
  ['G302', (w, a) => finalOf(w) === FINAL_L && /^\s*거(예|에)요/.test(a) || / 거(예|에)요$/.test(w) && finalOf(w.split(' 거')[0]) === FINAL_L],
  ['G603', (w, a) => finalOf(w) === FINAL_L && /^\s*때/.test(a) || / 때$/.test(w) && finalOf(w.split(' 때')[0]) === FINAL_L],
  ['G406', (w, a) => /^(후에|전에)$/.test(w) || /기$/.test(w) && /^\s*전에/.test(a) || /기 전에$/.test(w)
    || finalOf(w) === FINAL_N && /^\s*후에/.test(a) || / 후에$/.test(w) && finalOf(w.split(' 후에')[0]) === FINAL_N],
  ['G407', (w, a) => /는$/.test(w) && /^\s*(것|거)/.test(a) || /는 (것|거)/.test(w)],
  ['G301', (w, a) => /고 싶/.test(w) || /고$/.test(w) && /^\s*싶/.test(a)],
  ['G409', (w, a) => /고 (있|계)/.test(w) || /고$/.test(w) && /^\s*(있|계)/.test(a)],
  ['G405', (w, a) => /려고 (하|해|했|합)/.test(w) || /려고$/.test(w) && /^\s*(하|해|했|합)/.test(a)],
  ['G403', (w, a) => /야 (하|해|했|합)/.test(w) || /야$/.test(w) && /^\s*(하|해|했|합)/.test(a)],
  ['G404', w => /.(주세요|줘요)$/.test(w) && !/^(주세요|줘요)$/.test(w)],
  ['G408', w => /[아어여와워해가] (봐|봤|보세요|볼)/.test(w)],
  ['G304', (w, a) => /지 않/.test(w) || /지$/.test(w) && /^\s*않/.test(a)],
  ['G313', (w, a) => /지 못/.test(w) || /지$/.test(w) && /^\s*못/.test(a)],
  ['G303', w => /러$/.test(w)],
  ['G311', w => /까요\??$/.test(w) && finalOf(before(w.replace(/\?$/, ''), '까요')) === FINAL_L],
  ['G612', w => /(게요|래요)$/.test(w) && finalOf(before(w, '게요')) === FINAL_L],
  ['G410', w => /니까$/.test(w)],
  ['G610', w => /는데$/.test(w) || /데$/.test(w) && finalOf(before(w, '데')) === FINAL_N],
  ['G307', w => /지만$/.test(w)],
  ['G401', w => /면$/.test(w)],
  ['G308', w => /서$/.test(w) && w.length > 1 && A_EO.has(syllable(before(w, '서').slice(-1))?.vowel) && finalOf(before(w, '서')) === 0],
  ['G306', w => /고$/.test(w) && w.length > 1],
  ['G411', w => /네요$/.test(w)],
  ['G412', w => /(지요|죠)\??$/.test(w)],
  ['G211', w => /세요$/.test(w)],
  ['G204', w => /(이에요|예요)$/.test(w)],
  // A past ending: the syllable before 어요 carries ㅆ (갔어요, 쉬었어요), but 있어요 is the present of 있다.
  ['G208', w => /어요$/.test(w) && finalOf(before(w, '어요')) === FINAL_SS && !/있어요$/.test(w)],
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
module.exports = { grammarOf, PARTICLES, ENDING_POINTS };
