// 한글 단계 노래(2026-10-04, Suno 케이팝 — 가사·프롬프트·만든 기록은 songs/README.md).
// 노래는 순서만 외우는 노래가 아니라 글자마다 소리·동작이 붙은 노래다: 모음은 몸동작(짧은 획이 가리키는 쪽으로 손을 뻗는다),
// 자음은 합치기(그 → 아 → 가). 화면은 노래 시각에 맞춰 글자를 켠다. 아틀라스 기록과 글자 진도에는 넣지 않는다(설계 §6 장단 — 세지 않는다).
//
// 시각은 받아쓰기(faster-whisper 낱말 시각, 10-05)에서 줄의 시작을 잡고, 후렴은 줄 안에서 고르게 나눴다. 노래 받아쓰기는 거칠어
// ±0.2초쯤 어긋날 수 있다 — 귀로 듣고 이 표의 숫자만 고치면 된다.
//
// 신호(cue) 꼴: line(가사 한 줄), vowel(모음 하나 — 동작과 함께), sweep(글자 여럿을 차례로), blend(자음 + 모음 = 음절, 세 걸음).

const MOVE = { 'v-a': 'right', 'v-eo': 'left', 'v-o': 'up', 'v-u': 'down', 'v-eu': 'wide', 'v-i': 'tall',
  'v-ya': 'right2', 'v-yeo': 'left2', 'v-yo': 'up2', 'v-yu': 'down2' };
export const moveOf = id => MOVE[id] || null;
// 같은 간격으로 n개(줄의 처음부터 끝 조금 앞까지).
const spread = (t, end, n) => Array.from({ length: n }, (_, k) => +(t + ((end - t) * k) / n).toFixed(3));
const BASIC = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i'];
const TEN = ['v-a', 'v-ya', 'v-eo', 'v-yeo', 'v-o', 'v-yo', 'v-u', 'v-yu', 'v-eu', 'v-i'];
const ROW1 = ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s'];        // 가 나 다 라 마 바 사
const ROW2 = ['c-ng', 'c-j', 'c-ch', 'c-k', 'c-t', 'c-p', 'c-h'];     // 아 자 차 카 타 파 하 (ㅊㅋㅌㅍ은 아직 배우지 않은 글자)
const sweep = (t, end, letters, extra = {}) => ({ kind: 'sweep', t, end, letters, at: spread(t, end, letters.length), ...extra });
const vowel = (t, end, letter, at, text) => ({ kind: 'vowel', t, end, letter, at, move: MOVE[letter], text });
// 합치기: 자음 소리 → 아 → 음절. 세 걸음은 줄 길이를 셋으로 나눈다.
const blend = (t, end, consonant, text, vowelId = 'v-a') => ({ kind: 'blend', t, end, consonant, vowel: vowelId, at: spread(t, end, 3), text });
const line = (t, end, text) => ({ kind: 'line', t, end, text });

export const SONGS = Object.freeze([
  {
    id: 'vowel-dance', title: '모음 댄스', src: 'assets/songs/vowel-dance.mp3', duration: 54.76, bpm: 105.5,
    suno: '399224fa-4ca7-42ee-854d-fbd7ea288bde', teaches: [...TEN],
    review: [11.4, 41.9], // 회차 끝 30초 장단: 첫 절(모음 여섯) → 후렴 → 둘째 절(ㅑㅕㅛㅠ) → 둘째 후렴 앞부분
    cues: [
      line(0, 5.6, 'Hey! 한글 댄스!'),
      line(5.8, 7.7, 'Ready, set, go!'),
      line(7.76, 11.5, 'Hey!'),
      vowel(11.56, 12.7, 'v-a', 12.12, '오른쪽 아!'),
      vowel(12.72, 13.82, 'v-eo', 13.2, '왼쪽 어!'),
      vowel(13.84, 15.05, 'v-o', 14.26, '위로 오!'),
      vowel(15.1, 16.04, 'v-u', 15.42, '아래 우!'),
      vowel(16.06, 17.36, 'v-eu', 16.9, '옆으로 쭉 으!'),
      vowel(17.4, 21.4, 'v-i', 17.85, '차렷 이!'),
      sweep(21.58, 23.3, BASIC, { text: '아! 어! 오! 우! 으! 이!' }),
      sweep(23.86, 25.6, BASIC, { text: '아! 어! 오! 우! 으! 이!' }),
      line(26.12, 28.1, '따라 해 봐, 한글 댄스!'),
      sweep(28.2, 29.9, BASIC, { text: '아! 어! 오! 우! 으! 이!' }),
      vowel(29.98, 31.2, 'v-ya', 31.04, '오른쪽 두 번 야!'),
      vowel(31.24, 32.36, 'v-yeo', 32.16, '왼쪽 두 번 여!'),
      vowel(32.4, 33.5, 'v-yo', 33.28, '위로 두 번 요!'),
      vowel(33.54, 34.74, 'v-yu', 34.48, '아래 두 번 유!'),
      sweep(34.78, 37.0, TEN, { text: '아 야 어 여 오 요 우 유 으 이!' }),
      sweep(37.15, 39.4, TEN, { text: '아 야 어 여 오 요 우 유 으 이!' }),
      sweep(39.52, 41.8, TEN, { text: '아 야 어 여 오 요 우 유 으 이!' }),
      sweep(41.88, 44.05, TEN, { text: '아 야 어 여 오 요 우 유 으 이!' }),
      line(44.14, 46.4, '따라 해 봐, 한글 댄스!'),
      sweep(46.44, 48.6, TEN, { text: '아 야 어 여 오 요 우 유 으 이!' }),
      sweep(48.72, 50.6, BASIC, { text: '아! 어! 오! 우! 으! 이!' }),
      line(50.7, 54.76, '한글 댄스!'),
    ],
  },
  {
    id: 'geu-a-ga', title: '그 아 가', src: 'assets/songs/geu-a-ga.mp3', duration: 74.4, bpm: 101.3,
    suno: '61cb6e8e-bb9b-4660-bba6-51e4a66a487f', teaches: ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s', 'c-ng', 'c-j', 'c-h'],
    review: [10.7, 43.4], // 회차 끝 30초 장단: 합치기 열네 자음 → 「그 더하기 아는? 가!」 → 후렴 앞부분
    cues: [
      line(0, 4.1, 'Ready? 한글!'),
      blend(4.26, 6.9, 'c-g', '그, 아, 가!'),
      blend(10.89, 12.1, 'c-g', '그 아 가!'),
      blend(12.1, 13.3, 'c-n', '느 아 나!'),
      blend(13.3, 14.55, 'c-d', '드 아 다!'),
      blend(14.55, 15.8, 'c-r', '르 아 라!'),
      blend(15.8, 17.0, 'c-m', '므 아 마!'),
      blend(17.0, 18.12, 'c-b', '브 아 바!'),
      blend(18.12, 19.3, 'c-s', '스 아 사!'),
      blend(19.3, 20.5, 'c-ng', '쉿! 아!'),
      blend(20.5, 21.72, 'c-j', '즈 아 자!'),
      blend(21.72, 22.96, 'c-ch', '츠 아 차!'),
      blend(22.96, 24.16, 'c-k', '크 아 카!'),
      blend(24.16, 25.42, 'c-t', '트 아 타!'),
      blend(25.42, 26.9, 'c-p', '프 아 파!'),
      blend(27.0, 28.9, 'c-h', '흐 아 하!'),
      { kind: 'blend', t: 28.96, end: 32.4, consonant: 'c-g', vowel: 'v-a', at: [28.96, 30.0, 31.9], text: '그 더하기 아는? 가!' },
      { kind: 'blend', t: 32.42, end: 34.7, consonant: 'c-n', vowel: 'v-a', at: [32.42, 33.26, 34.4], text: '느 더하기 아는? 나!' },
      line(34.78, 39.4, '합쳐 봐, 하나 둘 셋!'),
      sweep(39.54, 41.0, ROW1, { text: '가 나 다 라 마 바 사!', syllables: true }),
      sweep(41.0, 43.0, ROW2, { text: '아 자 차 카 타 파 하!', syllables: true }),
      sweep(43.52, 45.7, ROW1, { text: '가 나 다 라 마 바 사!', syllables: true }),
      sweep(48.06, 49.4, ROW2, { text: '아 자 차 카 타 파 하!', syllables: true }),
      sweep(49.46, 51.8, BASIC, { text: '가 거 고 구 그 기!', consonant: 'c-g' }),
      sweep(51.9, 54.0, BASIC, { text: '나 너 노 누 느 니!', consonant: 'c-n' }),
      sweep(54.12, 56.5, BASIC, { text: '다 더 도 두 드 디!', consonant: 'c-d' }),
      sweep(56.62, 58.4, BASIC, { text: '라 러 로 루 르 리!', consonant: 'c-r' }),
      sweep(58.44, 60.4, ROW1, { text: '가 나 다 라 마 바 사!', syllables: true }),
      sweep(60.4, 62.5, ROW2, { text: '아 자 차 카 타 파 하!', syllables: true }),
      sweep(63.18, 65.6, ROW1, { text: '가 나 다 라 마 바 사!', syllables: true }),
      sweep(65.6, 68.2, ROW2, { text: '아 자 차 카 타 파 하!', syllables: true }),
      blend(68.5, 70.3, 'c-g', '그, 아, 가!'),
      line(70.38, 74.4, '이제 읽을 수 있어!'),
    ],
  },
]);

// 노래에는 나오지만 아직 배우는 길에 없는 자음(거센소리 U5): 글자 모양과 유니코드 첫소리 번호.
export const EXTRA_CONSONANTS = Object.freeze({ 'c-ch': ['ㅊ', 14], 'c-k': ['ㅋ', 15], 'c-t': ['ㅌ', 16], 'c-p': ['ㅍ', 17] });

export const songById = id => SONGS.find(s => s.id === id) || null;
/** 신호의 글자 칸 i가 가리키는 글자 id들. 회차 끝 장단은 이 글자를 다 만났을 때만 그 칸을 켠다(설계 §6 「익힌 글자까지만 장단에 들어와 날마다 길어진다」). */
export function tileLetters(cue, i) {
  if (cue.kind === 'vowel') return [cue.letter];
  if (cue.kind === 'blend') return i === 0 ? [cue.consonant] : i === 1 ? [cue.vowel] : [cue.consonant, cue.vowel];
  if (cue.kind === 'sweep') { const id = cue.letters[i]; return cue.syllables ? [id, 'v-a'] : cue.consonant ? [cue.consonant, id] : [id]; }
  return [];
}
/** 구간 [from, to]의 신호에 나오는 글자 id(겹치지 않게). */
export function lettersIn(song, from, to) {
  const out = new Set();
  for (const cue of song.cues) {
    if (cue.end <= from || cue.t >= to) continue;
    const n = cue.kind === 'vowel' ? 1 : cue.kind === 'blend' ? 3 : cue.kind === 'sweep' ? cue.letters.length : 0;
    for (let i = 0; i < n; i += 1) for (const id of tileLetters(cue, i)) out.add(id);
  }
  return out;
}
/** 시각 t의 신호(없으면 null)와 그 안의 걸음(켜진 글자 번호, 아직이면 -1). */
export function cueAt(song, t) {
  const cue = song.cues.find(c => t >= c.t && t < c.end) || null;
  if (!cue) return { cue: null, step: -1 };
  const marks = Array.isArray(cue.at) ? cue.at : cue.at != null ? [cue.at] : [];
  let step = -1;
  marks.forEach((m, i) => { if (t >= m) step = i; });
  return { cue, step };
}
