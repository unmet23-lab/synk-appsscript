// 한글 단계의 재료. 한국어만 쓴다(2026-10-03 유호님 「일단 한국어로 mvp」).
// 글자·단원·짝은 Strata 한글 층(strata/hangul.json)이 정본이고, 여기서는 그 글자로 만드는
// 음절·낱말·간판·명패와 필요한 소리의 목록을 만든다. 화면·저장·소리 재생은 모른다.

export const PACK_VER = 'hangul-4';
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
const A = 0;       // 자음은 ㅏ를 붙여 소리 낸다(가·나·다), 받침은 아에 붙여 소리 낸다(안·알·암)
// 같은 소리: ㅐ와 ㅔ, ㅒ와 ㅖ, ㅚ·ㅙ·ㅞ는 지금 한국어에서 소리가 같다. 자음 뒤의 ㅖ는 [ㅔ]로(시계 [시게]), ㅢ는 [ㅣ]로(희 [히]) 난다.
// 받침은 일곱 소리로 난다(ㄷ·ㅅ·ㅈ·ㅊ·ㅌ·ㅎ → [ㄷ] 등). 소리로 가르는 문항에서 같은 소리를 함께 내지 않는다.
const SAME_SOUND_MEDIAL = new Map([[1, 'e'], [5, 'e'], [3, 'ye'], [7, 'ye'], [10, 'we'], [11, 'we'], [15, 'we']]);
// 모음의 쓰임. 자음 문항의 모음 틀은 홑모음 열(ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ)만 쓴다 — ㅐ·ㅔ는 소리가 겹치고, 겹모음은 자음 소리를 듣는 데 방해가 된다.
// ㅒ·ㅖ·ㅢ는 자음과 붙이면 잘 쓰지 않거나 소리가 달라져서(걔, 계 [게], 희 [히]) 문항에서는 ㅇ하고만 음절을 만든다.
const FRAME_MEDIALS = new Set([0, 2, 4, 6, 8, 12, 13, 17, 18, 20]);
const ALONE_MEDIALS = new Set([3, 7, 19]);
const COMPOUND_MEDIALS = new Set([3, 7, 9, 10, 11, 14, 15, 16, 19]); // 겹모음(U9)
const FINAL_SOUND = new Map([[1, 'k'], [2, 'k'], [24, 'k'], [4, 'n'], [7, 't'], [19, 't'], [20, 't'], [22, 't'], [23, 't'], [25, 't'], [27, 't'],
  [8, 'l'], [16, 'm'], [17, 'p'], [26, 'p'], [21, 'ng']]);
// 받침 문항의 음절 틀: 받침마다 이 첫소리·모음으로만 만든다(소리 목록을 작게 두려고). null은 첫소리 ㅇ.
export const FINAL_FRAME = Object.freeze({ initials: [null, 'c-g', 'c-n', 'c-b', 'c-s'], vowels: ['v-a', 'v-o', 'v-u', 'v-i'] });

// 낱말. 고른 기준: 흔히 쓰는 말, 이 판의 글자(U1~U9)로만 쓸 수 있는 말(도구가 거른다 — 받침은 U6·U7의 아홉만).
// 단원마다 맨 앞의 낱말이 그 글자의 만나기 카드에 나온다(그 글자가 든 세 글자 이하의 첫 낱말).
// 같은 소리로 들리는 짝(개/게, 낟/낮)은 소리 문항에서 함께 내지 않는다.
const WORDS = ['아이', '오이', '이모', '아기', '나무', '다리', '머리', '누나', '오리', '우리', '나라', '고기', '거미', '구두',
  '어머니', '모기', '나비', '바다', '모자', '가지', '아버지', '사자', '두부', '바지', '지도', '하마', '도시', '소리', '하나',
  '오후', '바나나', '부모', '시소', '우유', '노래', '가게', '여우', '요리', '야구', '휴지', '모래', '여자', '세수', '메뉴',
  '개', '배', '새', '해', '게', '비', '소',
  // 받침 하나(ㄴ·ㄹ·ㅁ·ㅇ)
  '산', '물', '밤', '강', '눈', '문', '말', '발', '별', '곰', '몸', '방', '공', '손', '사랑', '안녕', '이름', '사람', '가방', '엄마',
  '아들', '이불', '여름', '겨울', '시간', '지금', '오늘', '내일', '생일', '은행', '시장', '공부', '운동', '한글', '라면', '갈비',
  '마음', '소금', '하늘', '노랑', '선물', '신문', '남자', '냉면', '노래방',
  // 받침 둘(ㄱ·ㄷ·ㅂ, [ㄷ]으로 나는 ㅅ·ㅈ)
  '한국어', '학교', '수업', '밥', '집', '국', '약', '옷', '낮', '음식', '가족', '김밥', '비빔밥', '식당', '불고기', '수박', '책상',
  // 거센소리(U5, ㅋㅌㅍㅊ — 받침이 든 말은 받침을 만난 뒤에 읽힌다)
  '차', '코', '키', '파', '표', '커피', '포도', '피자', '치마', '기차', '고추', '치즈', '카메라', '토마토', '피아노', '카드', '포크', '케이크',
  '친구', '책', '축구', '컴퓨터', '토요일', '편지', '택시', '칼', '콩', '우체국',
  // 된소리(U8, ㄲㄸㅃㅆㅉ)
  '토끼', '딸기', '아빠', '아저씨', '찌개', '오빠', '꼬리', '빵', '떡', '땅', '딸', '꿀', '꿈', '끈', '쌀', '뼈', '짝', '또', '꼭', '아까',
  '어깨', '가짜', '뿌리', '코끼리', '까치', '짜장면', '쓰레기', '빵집', '씨앗', '빨리', '이따가', '뽀뽀',
  // 겹모음(U9, ㅘㅝㅟㅢㅚㅙㅞㅖㅒ)
  '사과', '샤워', '가위', '의자', '회사', '돼지', '웨이터', '시계', '얘기', '과자', '과일', '화장실', '화요일', '전화', '영화', '왕', '원',
  '공원', '병원', '원숭이', '뭐', '왜', '돼지고기', '회사원', '외국', '외국인', '외계인', '귀', '쥐', '바퀴', '뒤', '위', '취미', '의사',
  '의미', '계란', '세계', '예', '예약', '스웨터', '꽈배기'];
// 앞으로 만날 마을의 간판 미리보기. 단원마다 하나씩 읽히게 골랐다(설계 §6의 2).
const SIGNS = [['오이', 'U1'], ['나무', 'U2'], ['바다', 'U3'], ['가게', 'U4'], ['카페', 'U5'], ['시장', 'U6'], ['식당', 'U7'], ['빵집', 'U8'], ['화장실', 'U9']];
// 자음 그림 연상(2026-10-05 유호님 「그 조합으로」 — 조사: 글자 모양을 그림 안에 넣으면 소리가 더 잘 붙는다, 한글 성인 초급은 자음을 그림으로).
// 그림의 생김새가 글자 모양이고 이름이 그 자음 소리로 시작한다. 그림은 assets/mnemonic/<id>.webp(Codex 그림 만들기 — ChatGPT 구독, API 아님).
// 영어 단어 연상(ㄱ=gun)은 쓰지 않는다 — 20개국에 통하는 물건과 한국어 낱말. 글자는 그림에 굽지 않는다.
const MNEMONICS = [['c-g', '가로등', '기둥과 위로 꺾인 팔'], ['c-n', '노트북', '세운 화면과 바닥'], ['c-d', '달', '오른쪽이 열린 초승달'],
  ['c-r', '라면', '꼬불꼬불한 면'], ['c-m', '문', '네모'], ['c-b', '바구니', '손잡이 둘 달린 바구니'], ['c-s', '산', '뾰족한 봉우리'],
  ['c-ng', '알', '동그라미 — 첫소리 ㅇ은 소리가 없어 「아」'], ['c-j', '자전거', ''], ['c-h', '해', '모자 쓴 해'],
  // 거센소리(U5): ㄱ에 획을 더한 ㅋ처럼 모양도 짝과 닮는다.
  ['c-k', '캣타워', '기둥과 판 둘(ㄱ에 판 하나 더)'], ['c-t', '토마토', ''], ['c-p', '피아노', '건반 판과 다리'], ['c-ch', '청바지', '리본·허리띠·두 다리'],
  // 받침(10-06): 모양은 첫소리와 같으니 그 받침 소리로 끝나는 낱말 그림. ㄷ·ㅈ은 그릴 만한 흔한 낱말이 없어 두지 않는다.
  ['f-n', '손', '받침 ㄴ으로 끝남'], ['f-r', '별', '받침 ㄹ로 끝남'], ['f-m', '곰', '받침 ㅁ으로 끝남'], ['f-ng', '공', '받침 ㅇ으로 끝남'],
  ['f-g', '책', '받침 ㄱ으로 끝남'], ['f-b', '밥', '받침 ㅂ으로 끝남'], ['f-s', '옷', '받침 ㅅ — [옫]처럼 읽음'],
  // 된소리(U8, 10-06): 그 된소리로 시작하는 낱말. 모양(같은 글자 둘)은 만나기 카드의 「ㄱ + ㄱ = ㄲ」이 맡는다.
  ['c-kk', '꿀', '꿀단지'], ['c-tt', '딸기', ''], ['c-pp', '빵', ''], ['c-ss', '씨앗', '싹이 난 씨앗'], ['c-jj', '짜장면', ''],
  // 겹모음(U9, 10-06): 그 모음이 든 낱말 — 그 음절을 강조한다(사과의 「과」). ㅒ는 그릴 만한 흔한 낱말이 없어 두지 않는다.
  ['v-wa', '사과', ''], ['v-wo', '원숭이', ''], ['v-wi', '가위', ''], ['v-ui', '의자', ''], ['v-oe', '외계인', ''], ['v-wae', '돼지', ''],
  ['v-we', '스웨터', ''], ['v-ye', '시계', '자음 뒤 ㅖ는 [ㅔ]처럼']];
// 한글 이름 표기가 없으니 명패는 「한국어」 세 글자 판이다(설계 §9). 받침 칸은 받침 단원에서 채운다.
const PLATE = '한국어';

export function createPack(layer) {
  const letters = layer.letters.map(([id, glyph, role, jamo]) => ({ id, glyph, role, jamo }));
  const byId = new Map(letters.map(l => [l.id, l]));
  const unitOf = new Map(layer.units.flatMap(u => u.letters.map(id => [id, u.id])));
  for (const l of letters) l.unit = unitOf.get(l.id) || null;
  const consonantByJamo = new Map(letters.filter(l => l.role === 'consonant').map(l => [l.jamo, l]));
  const vowelByJamo = new Map(letters.filter(l => l.role === 'vowel').map(l => [l.jamo, l]));
  const finalByJamo = new Map(letters.filter(l => l.role === 'final').map(l => [l.jamo, l]));
  // 글자의 소리: 모음은 ㅇ을 받친 음절(아·어), 자음은 ㅏ를 붙인 음절(가·나), 받침은 「아」 밑에 붙인 음절(안·알).
  // ㅇ은 첫소리에서 소리가 없어 「아」다.
  const voiceOf = l => (l.role === 'vowel' ? compose(SILENT, l.jamo) : l.role === 'final' ? compose(SILENT, A, l.jamo) : compose(l.jamo, A));
  for (const l of letters) l.voice = voiceOf(l);
  // 모음의 쓰임: frame은 자음 문항의 모음 틀(홑모음 열), alone은 ㅇ하고만 음절을 만드는 모음(ㅒ·ㅖ·ㅢ), compound는 겹모음(U9).
  for (const l of letters.filter(x => x.role === 'vowel')) Object.assign(l, { frame: FRAME_MEDIALS.has(l.jamo), alone: ALONE_MEDIALS.has(l.jamo), compound: COMPOUND_MEDIALS.has(l.jamo) });

  // 음절 한 글자를 이루는 글자 id들. 첫소리 ㅇ은 받쳐 주는 자리라 따로 셈하지 않는다. 이 판에 없는 글자가 있으면 null.
  function lettersIn(syllable) {
    const d = decompose(syllable);
    if (!d) return null;
    const c = d.initial === SILENT ? null : consonantByJamo.get(d.initial);
    const v = vowelByJamo.get(d.medial);
    const f = d.final ? finalByJamo.get(d.final) : null;
    if ((d.initial !== SILENT && !c) || !v || (d.final && !f)) return null;
    return { consonant: c ? c.id : null, vowel: v.id, final: f ? f.id : null };
  }
  const partsOf = p => [p.consonant, p.vowel, p.final].filter(Boolean);
  const wordLetters = text => {
    const ids = [];
    for (const ch of text) { const parts = lettersIn(ch); if (!parts) return null; ids.push(...partsOf(parts)); }
    return [...new Set(ids)];
  };
  const words = WORDS.map(text => ({ id: `w-${[...text].map(ch => ch.charCodeAt(0).toString(36)).join('')}`, text, letters: wordLetters(text) }))
    .filter(w => w.letters);
  const signs = SIGNS.map(([text, unit]) => ({ text, unit, letters: wordLetters(text),
    syllables: [...text].map(ch => ({ text: ch, letters: partsOf(lettersIn(ch)) })) }));
  // 명패 칸: 글자 하나씩. 받침 칸은 받침 글자가 이 판에 있으면 그 글자로 채워진다.
  const plate = [...PLATE].map(ch => {
    const d = decompose(ch), c = consonantByJamo.get(d.initial), v = vowelByJamo.get(d.medial), f = d.final ? finalByJamo.get(d.final) : null;
    const cells = [{ glyph: c?.glyph || INITIALS[d.initial], letter: c?.id || null }, { glyph: v?.glyph || '', letter: v?.id || null }];
    if (d.final) cells.push({ glyph: FINALS[d.final], letter: f?.id || null, final: true, later: !f });
    return { text: ch, cells };
  });

  const mnemonics = Object.fromEntries(MNEMONICS.filter(([id]) => byId.has(id)).map(([id, word, shape]) => [id, { word, shape, img: `assets/mnemonic/${id}.webp` }]));

  // 같은 소리로 들리는지: ㅐ/ㅔ·ㅒ/ㅖ·ㅚ/ㅙ/ㅞ를 같은 모음으로, 자음 뒤 ㅢ는 ㅣ로, ㄹ이 아닌 자음 뒤 ㅖ는 ㅔ로, 받침은 일곱 소리로 묶어 비교한다.
  const medialKey = d => (d.initial !== SILENT && d.medial === 19 ? 20 : d.initial !== SILENT && d.initial !== 5 && d.medial === 7 ? 'e' : SAME_SOUND_MEDIAL.get(d.medial) ?? d.medial);
  const soundKey = text => [...text].map(ch => { const d = decompose(ch); return d ? `${d.initial}.${medialKey(d)}.${d.final ? FINAL_SOUND.get(d.final) ?? d.final : 0}` : ch; }).join('|');
  const sameSound = (a, b) => soundKey(a) === soundKey(b);

  // 짝: 모양이 닮은 것과 소리가 헷갈리는 것. by_ear:false는 소리로 묻지 않는다.
  const relation = new Map();
  const key = (a, b) => [a, b].sort().join('|');
  for (const p of layer.pairs) relation.set(key(...p.letters), { sound: true, byEar: p.by_ear, shape: false });
  for (const [a, b] of layer.shapes) relation.set(key(a, b), { ...(relation.get(key(a, b)) || { sound: false, byEar: true }), shape: true });
  const related = (a, b) => relation.get(key(a, b)) || null;

  const syllable = (consonantId, vowelId, finalId = null) => compose(consonantId ? byId.get(consonantId).jamo : SILENT, byId.get(vowelId).jamo, finalId ? byId.get(finalId).jamo : 0);

  // 필요한 소리의 목록(설계 §10): 정한 목소리로 이 목록대로 한 번에 만든다.
  function audioManifest() {
    const clips = new Set(letters.map(l => l.voice));
    const consonants = [null, ...letters.filter(l => l.role === 'consonant' && l.jamo !== SILENT).map(l => l.id)];
    for (const c of consonants) for (const v of letters.filter(l => l.role === 'vowel')) if (!c || !v.alone) clips.add(syllable(c, v.id)); // ㅒ·ㅖ·ㅢ는 ㅇ하고만
    for (const f of letters.filter(l => l.role === 'final')) for (const c of FINAL_FRAME.initials) for (const v of FINAL_FRAME.vowels) clips.add(syllable(c, v, f.id));
    for (const w of words) clips.add(w.text);
    for (const s of signs) clips.add(s.text);
    for (const m of Object.values(mnemonics)) clips.add(m.word);
    clips.add(PLATE);
    return { pack_ver: PACK_VER, voice: null, clips: [...clips].sort() };
  }

  return Object.freeze({ version: PACK_VER, letters, byId, units: layer.units, later: layer.later || [], words, signs, plate, mnemonics,
    lettersIn, wordLetters, syllable, sameSound, related, audioManifest, SILENT, FINAL_FRAME });
}
