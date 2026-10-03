// 한글 단계 MVP의 재료. 한국어만 쓴다(2026-10-03 유호님 「일단 한국어로 mvp」).
// 글자·단원·짝은 Strata 한글 층(strata/hangul.json)이 정본이고, 여기서는 그 글자로 만드는
// 음절·낱말·간판·명패와 필요한 소리의 목록을 만든다. 화면·저장·소리 재생은 모른다.

export const PACK_VER = 'hangul-mvp-1';
// 유니코드 한글 음절 = 0xAC00 + (초성 × 21 + 중성) × 28 + 종성
const BASE = 0xac00;
export const compose = (initial, medial, final = 0) => String.fromCharCode(BASE + (initial * 21 + medial) * 28 + final);
export function decompose(ch) {
  const code = ch.charCodeAt(0) - BASE;
  if (code < 0 || code > 11171) return null;
  return { initial: Math.floor(code / 588), medial: Math.floor((code % 588) / 28), final: code % 28 };
}
const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const SILENT = 11; // 첫소리 ㅇ: 소리가 없고 모음을 받쳐 준다
const A = 0;       // 자음은 ㅏ를 붙여 소리 낸다(가·나·다)
// ㅐ와 ㅔ는 지금 한국어에서 소리가 같다. 소리로 가르는 문항에서 둘을 함께 내지 않는다.
const SAME_SOUND_MEDIAL = new Map([[1, 'e'], [5, 'e']]);

// 받침 없는 낱말. 고른 기준: 흔히 쓰는 말, U1~U4 글자로만 쓸 수 있는 말(도구가 거른다).
// 같은 소리로 들리는 짝(개/게)은 소리 문항에서 함께 내지 않는다.
const WORDS = ['아이', '오이', '이모', '아기', '나무', '다리', '머리', '누나', '오리', '우리', '나라', '고기', '거미', '구두',
  '어머니', '모기', '나비', '바다', '모자', '가지', '아버지', '사자', '두부', '바지', '지도', '하마', '도시', '소리', '하나',
  '오후', '바나나', '부모', '시소', '우유', '노래', '가게', '여우', '요리', '야구', '휴지', '모래', '여자', '세수', '메뉴',
  '개', '배', '새', '해', '게', '비', '소'];
// 앞으로 만날 마을의 간판 미리보기. 단원마다 하나씩 읽히게 골랐다(설계 §6의 2).
const SIGNS = [['오이', 'U1'], ['나무', 'U2'], ['바다', 'U3'], ['가게', 'U4']];
// 한글 이름 표기가 없으니 명패는 「한국어」 세 글자 판이다(설계 §9). 받침 칸은 받침 단원에서 채운다.
const PLATE = '한국어';

export function createPack(layer) {
  const letters = layer.letters.map(([id, glyph, role, jamo]) => ({ id, glyph, role, jamo }));
  const byId = new Map(letters.map(l => [l.id, l]));
  const unitOf = new Map(layer.units.flatMap(u => u.letters.map(id => [id, u.id])));
  for (const l of letters) l.unit = unitOf.get(l.id) || null;
  const consonantByJamo = new Map(letters.filter(l => l.role === 'consonant').map(l => [l.jamo, l]));
  const vowelByJamo = new Map(letters.filter(l => l.role === 'vowel').map(l => [l.jamo, l]));
  // 글자의 소리: 모음은 ㅇ을 받친 음절(아·어), 자음은 ㅏ를 붙인 음절(가·나). ㅇ은 첫소리에서 소리가 없어 「아」다.
  const voiceOf = l => (l.role === 'vowel' ? compose(SILENT, l.jamo) : compose(l.jamo, A));
  for (const l of letters) l.voice = voiceOf(l);

  // 음절 한 글자를 이루는 글자 id들. 첫소리 ㅇ은 받침 글자(받쳐 주는 자리)라 따로 셈하지 않는다.
  function lettersIn(syllable) {
    const d = decompose(syllable);
    if (!d || d.final) return null; // 받침 있는 음절은 이 판에 없다
    const c = d.initial === SILENT ? null : consonantByJamo.get(d.initial);
    const v = vowelByJamo.get(d.medial);
    if ((d.initial !== SILENT && !c) || !v) return null;
    return { consonant: c ? c.id : null, vowel: v.id };
  }
  const wordLetters = text => {
    const ids = [];
    for (const ch of text) { const parts = lettersIn(ch); if (!parts) return null; if (parts.consonant) ids.push(parts.consonant); ids.push(parts.vowel); }
    return [...new Set(ids)];
  };
  const words = WORDS.map(text => ({ id: `w-${[...text].map(ch => ch.charCodeAt(0).toString(36)).join('')}`, text, letters: wordLetters(text) }))
    .filter(w => w.letters);
  const signs = SIGNS.map(([text, unit]) => ({ text, unit, letters: wordLetters(text),
    syllables: [...text].map(ch => { const p = lettersIn(ch); return { text: ch, letters: [p.consonant, p.vowel].filter(Boolean) }; }) }));
  // 명패 칸: 글자 하나씩. 받침은 아직 이 판의 글자가 아니라 「다음에」 칸으로 남는다.
  const plate = [...PLATE].map(ch => {
    const d = decompose(ch), c = consonantByJamo.get(d.initial), v = vowelByJamo.get(d.medial);
    const cells = [{ glyph: c?.glyph || INITIALS[d.initial], letter: c?.id || null }, { glyph: v?.glyph || '', letter: v?.id || null }];
    if (d.final) cells.push({ glyph: FINALS[d.final], letter: null, later: true });
    return { text: ch, cells };
  });

  // 같은 소리로 들리는지: ㅐ/ㅔ를 같은 모음으로 보고 비교한다.
  const soundKey = text => [...text].map(ch => { const d = decompose(ch); return d ? `${d.initial}.${SAME_SOUND_MEDIAL.get(d.medial) ?? d.medial}.${d.final}` : ch; }).join('|');
  const sameSound = (a, b) => soundKey(a) === soundKey(b);

  // 짝: 모양이 닮은 것과 소리가 헷갈리는 것. by_ear:false는 소리로 묻지 않는다.
  const relation = new Map();
  const key = (a, b) => [a, b].sort().join('|');
  for (const p of layer.pairs) relation.set(key(...p.letters), { sound: true, byEar: p.by_ear, shape: false });
  for (const [a, b] of layer.shapes) relation.set(key(a, b), { ...(relation.get(key(a, b)) || { sound: false, byEar: true }), shape: true });
  const related = (a, b) => relation.get(key(a, b)) || null;

  const syllable = (consonantId, vowelId) => compose(consonantId ? byId.get(consonantId).jamo : SILENT, byId.get(vowelId).jamo);

  // 필요한 소리의 목록(설계 §10): 목소리가 정해지면 이 목록대로 한 번에 만든다. 지금은 만들지 않는다.
  function audioManifest() {
    const clips = new Set(letters.map(l => l.voice));
    const consonants = [null, ...letters.filter(l => l.role === 'consonant' && l.jamo !== SILENT).map(l => l.id)];
    for (const c of consonants) for (const v of letters.filter(l => l.role === 'vowel')) clips.add(syllable(c, v.id));
    for (const w of words) clips.add(w.text);
    for (const s of signs) clips.add(s.text);
    clips.add(PLATE);
    return { pack_ver: PACK_VER, voice: null, clips: [...clips].sort() };
  }

  return Object.freeze({ version: PACK_VER, letters, byId, units: layer.units, later: layer.later || [], words, signs, plate,
    lettersIn, wordLetters, syllable, sameSound, related, audioManifest, SILENT });
}
