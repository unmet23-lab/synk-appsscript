// 한글 단계 노래(2026-10-04, Suno 케이팝 — 가사·프롬프트·만든 기록은 songs/README.md).
// 노래는 순서만 외우는 노래가 아니라 글자마다 소리·동작이 붙은 노래다: 모음은 몸동작(짧은 획이 가리키는 쪽으로 손을 뻗는다),
// 자음은 합치기(그 → 아 → 가). 화면은 노래 시각에 맞춰 글자를 켠다. 아틀라스 기록과 글자 진도에는 넣지 않는다(설계 §6 장단 — 세지 않는다).
//
// 시각은 받아쓰기(faster-whisper 낱말 시각, 10-05)에서 줄의 시작을 잡고, 후렴은 줄 안에서 고르게 나눴다. 노래 받아쓰기는 거칠어
// ±0.2초쯤 어긋날 수 있다 — 귀로 듣고 이 표의 숫자만 고치면 된다.
//
// 신호(cue) 꼴: line(가사 한 줄), vowel(모음 하나 — 동작과 함께), sweep(글자 여럿을 차례로), blend(자음 + 모음 = 음절, 세 걸음),
// batchim(바탕 음절 + 받침 = 음절, 세 걸음 — 10-08 받침 노래).

const MOVE = { 'v-a': 'right', 'v-eo': 'left', 'v-o': 'up', 'v-u': 'down', 'v-eu': 'wide', 'v-i': 'tall',
  'v-ya': 'right2', 'v-yeo': 'left2', 'v-yo': 'up2', 'v-yu': 'down2' };
export const moveOf = id => MOVE[id] || null;
// 같은 간격으로 n개(줄의 처음부터 끝 조금 앞까지).
const spread = (t, end, n) => Array.from({ length: n }, (_, k) => +(t + ((end - t) * k) / n).toFixed(3));
const BASIC = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i'];
const TEN = ['v-a', 'v-ya', 'v-eo', 'v-yeo', 'v-o', 'v-yo', 'v-u', 'v-yu', 'v-eu', 'v-i'];
const ROW1 = ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s'];        // 가 나 다 라 마 바 사
const ROW2 = ['c-ng', 'c-j', 'c-ch', 'c-k', 'c-t', 'c-p', 'c-h'];     // 아 자 차 카 타 파 하 (ㅊㅋㅌㅍ은 거센소리 U5)
const sweep = (t, end, letters, extra = {}) => ({ kind: 'sweep', t, end, letters, at: spread(t, end, letters.length), ...extra });
const vowel = (t, end, letter, at, text) => ({ kind: 'vowel', t, end, letter, at, move: MOVE[letter], text });
// 합치기: 자음 소리 → 아 → 음절. 세 걸음은 줄 길이를 셋으로 나눈다.
const blend = (t, end, consonant, text, vowelId = 'v-a') => ({ kind: 'blend', t, end, consonant, vowel: vowelId, at: spread(t, end, 3), text });
const line = (t, end, text) => ({ kind: 'line', t, end, text });
// 받침 노래의 음절: 첫소리(ㅇ은 null — 소리 없는 자리라 글자로 세지 않는다) · 모음 · 받침. 낱말이면 그림(결과 칸 위).
const FS = {
  '아': [null, 'v-a'], '사': ['c-s', 'v-a'], '무': ['c-m', 'v-u'], '바': ['c-b', 'v-a'], '가': ['c-g', 'v-a'], '마': ['c-m', 'v-a'],
  '소': ['c-s', 'v-o'], '누': ['c-n', 'v-u'], '벼': ['c-b', 'v-yeo'], '고': ['c-g', 'v-o'], '모': ['c-m', 'v-o'],
  '안': [null, 'v-a', 'f-n'], '알': [null, 'v-a', 'f-r'], '암': [null, 'v-a', 'f-m'], '앙': [null, 'v-a', 'f-ng'],
  '산': ['c-s', 'v-a', 'f-n'], '물': ['c-m', 'v-u', 'f-r'], '밤': ['c-b', 'v-a', 'f-m'], '강': ['c-g', 'v-a', 'f-ng'],
  '손': ['c-s', 'v-o', 'f-n'], '눈': ['c-n', 'v-u', 'f-n'], '별': ['c-b', 'v-yeo', 'f-r'], '말': ['c-m', 'v-a', 'f-r'],
  '곰': ['c-g', 'v-o', 'f-m'], '몸': ['c-m', 'v-o', 'f-m'], '공': ['c-g', 'v-o', 'f-ng'], '방': ['c-b', 'v-a', 'f-ng'],
};
const FPIC = { '산': 'assets/mnemonic/c-s.webp', '손': 'assets/mnemonic/f-n.webp', '별': 'assets/mnemonic/f-r.webp', '곰': 'assets/mnemonic/f-m.webp',
  '공': 'assets/mnemonic/f-ng.webp', '물': 'assets/words/mul.webp', '밤': 'assets/words/bam.webp', '강': 'assets/words/gang.webp',
  '눈': 'assets/words/nun.webp', '말': 'assets/words/mal.webp', '몸': 'assets/words/mom.webp', '방': 'assets/words/bang.webp' };
const BAT_SOUND = { 'f-n': '은', 'f-r': '을', 'f-m': '음', 'f-ng': '응' };
// 받침 합치기: 바탕 음절 → 받침 소리(은·을·음·응) → 결과 음절. at은 세 걸음의 시각.
const batchim = (t, end, base, made, at) => ({ kind: 'batchim', t, end, base, final: FS[made][2], made, at,
  text: `${base} ${BAT_SOUND[FS[made][2]]} ${made}!`, ...(FPIC[made] ? { pic: FPIC[made] } : {}) });
// 받침 음절 줄(후렴): 칸마다 음절 글자와 그 글자들(tiles).
const bsweep = (t, end, sylls, at, text) => ({ kind: 'sweep', t, end, letters: [...sylls], texts: [...sylls], tiles: sylls.map(s => FS[s].filter(Boolean)), at, text });

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
      // ㅡ·ㅣ는 소리를 재서 고쳤다(10-06): 가수가 「쭉」을 두 번 부르고 「으」를 17.36~18.15초 끌어 「차렷」 18.19초, 「이」 18.57초.
      // 받아쓰기 시각(으 16.9·차렷 17.4)이라 ㅣ 카드가 0.8초 일찍 바뀌었다.
      vowel(16.06, 18.19, 'v-eu', 17.36, '옆으로 쭉 으!'),
      vowel(18.19, 21.4, 'v-i', 18.57, '차렷 이!'),
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
    // 10-08 노래 v2(Suno 644b446b): 옛 곡(61cb6e8e)이 후렴에서 「바바」「타타」처럼 음절을 두 번 불러 처음 배우는 사람이 헷갈려서, 줄마다
    // 8음절로 맞춘 가사(후렴 끝 「짝!」, 둘째 절 끝 「짝 짝!」)로 다시 만들었다(유호님 「C로 가자」). 시각은 박자 눈금
    // (100.02 BPM, 첫 박 0.284초) 위에 둔다 — 받아쓰기 낱말 시각은 빠른 줄에서 1~2박씩 틀린다. 노래는 후렴을 한 번 더 이어 부른다.
    // 10-08 영상 v3(유호님 「초반 타이밍·리듬이 안 맞는다」): 반주를 걷어 낸 목소리로 음절 시작을 다시 쟀다. 1절이 한 박 빨랐고,
    // 마디 뒤 줄(느 아 나 · 르 아 라 …)은 셋잇단 느낌(아 +1/3박 · 음절 +5/6박)으로 부르며, 1절 앞에 「그, 아, 가!」를 한 번 더 부른다.
    id: 'geu-a-ga', title: '그 아 가', src: 'assets/songs/geu-a-ga.mp3', duration: 81.16, bpm: 100.0,
    suno: '644b446b-0387-48f2-a6cc-58163c232f4f', teaches: ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s', 'c-ng', 'c-j', 'c-h', 'c-k', 'c-t', 'c-p', 'c-ch'],
    review: [13.9, 43.3], // 회차 끝 30초 장단: 합치기 열네 자음 → 「그 더하기 아는? 가!」 → 「합쳐 봐」 → 후렴 두 줄
    cues: (() => {
      const g = k => +(0.284 + (60 / 100.02) * k).toFixed(3);
      const on = k => +(g(k) - 0.15).toFixed(3); // 줄 신호는 첫 소리보다 조금 먼저 켠다
      const CONS = ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s', 'c-ng', 'c-j', 'c-ch', 'c-k', 'c-t', 'c-p', 'c-h'];
      const TEXT = ['그 아 가!', '느 아 나!', '드 아 다!', '르 아 라!', '므 아 마!', '브 아 바!', '스 아 사!', '쉿! 아!', '즈 아 자!', '츠 아 차!', '크 아 카!', '트 아 타!', '프 아 파!', '흐 아 하!'];
      const bl = (t, end, consonant, at, text) => ({ kind: 'blend', t, end, consonant, vowel: 'v-a', at, text });
      // 글자 줄은 8분음표마다 한 칸(후렴 일곱 칸 + 「짝」, 둘째 절 여섯 칸 + 「짝 짝」)
      const sw = (L, letters, text, extra) => sweep(on(L), on(L + 4), letters, { at: [0, 0.5, 1, 1.5, 2, 2.5, 3].slice(0, letters.length).map(o => g(L + o)), text, ...extra });
      // 도입 그 3.57 · 아 3.88 · 가 4.47, (반주 · 군소리 「아~」) 둘째 「그, 아, 가!」 g(20 · 21 · 22)
      const out = [line(0, 3.0, 'Ready? 한글!'), bl(3.0, on(20), 'c-g', [3.57, 3.88, 4.47], '그, 아, 가!'), bl(on(20), on(24), 'c-g', [g(20), g(21), g(22)], '그, 아, 가!')];
      // 1절: 한 줄 2박, 줄 시작 g(24+2k). 마디 앞 줄은 아 +1/2박 · 음절 +1박, 마디 뒤 줄은 아 +1/3박 · 음절 +5/6박. 쉿 줄은 쉿 g(37.83) · 아 g(39)
      const PRE1 = g(51.42); // 「그 더하기」의 그(앞 줄 「하!」 바로 뒤)
      CONS.forEach((c, k) => {
        const L = 24 + 2 * k, back = k % 2 === 1;
        const at = c === 'c-ng' ? [g(L - 1 / 6), g(L + 1), g(L + 1)] : [g(L), g(L + (back ? 1 / 3 : 0.5)), g(L + (back ? 5 / 6 : 1))];
        out.push(bl(on(L), k === 13 ? +(PRE1 - 0.12).toFixed(3) : on(L + 2), c, at, TEXT[k]));
      });
      out.push(bl(+(PRE1 - 0.12).toFixed(3), on(55.5), 'c-g', [PRE1, g(53), g(54)], '그 더하기 아는? 가!'));
      out.push(bl(on(55.5), on(59), 'c-n', [g(55.5), g(57), g(58)], '느 더하기 아는? 나!'));
      out.push(line(on(59), on(64), '합쳐 봐, 하나 둘 셋!'));
      const chorus = starts => starts.forEach((L, n) => out.push(sw(L, n % 2 ? ROW2 : ROW1, n % 2 ? '아 자 차 카 타 파 하 짝!' : '가 나 다 라 마 바 사 짝!', { syllables: true })));
      chorus([64, 68, 72, 76, 80, 84, 88, 92]);
      [['c-g', '가 거 고 구 그 기 짝 짝!'], ['c-n', '나 너 노 누 느 니 짝 짝!'], ['c-d', '다 더 도 두 드 디 짝 짝!'], ['c-r', '라 러 로 루 르 리 짝 짝!']]
        .forEach(([c, text], n) => out.push(sw(96 + 4 * n, BASIC, text, { consonant: c })));
      chorus([112, 116, 120, 124]);
      out.push(bl(on(128), 78.47, 'c-g', [g(128), g(129), g(130)], '그, 아, 가!'));
      out.push(line(78.47, 81.16, '이제 읽을 수 있어!')); // 이제 78.55 · 읽을 78.86 · 수 79.18 · 있어 79.32
      return out;
    })(),
  },
  {
    // 10-08 받침 노래(Suno c3610361, 유호님 「A로 가자」): 받침 하나(ㄴ·ㄹ·ㅁ·ㅇ, 6단원). 받침 소리는 「은·을·음·응」으로 부른다(아 + 은 → 안).
    // 시각은 노래에서 목소리만 떼어 쟀다(102.48 BPM, 첫 박 0.388초 — 마스코트 영상 v1과 같은 표). 합치기 줄은 바탕 +0 · 받침 소리 +½ · 결과 +1박,
    // 후렴은 「안 알 암 앙」 반 박씩 · 「산물 밤강」 둘씩 / 「손눈 별말」 둘씩 · 「곰 몸 공 방」 반 박씩 부른다.
    id: 'batchim', title: '받침 노래', src: 'assets/songs/batchim.mp3', duration: 61.2, bpm: 102.5,
    suno: 'c3610361-6e52-41f7-a758-feea28b4ec09', teaches: ['f-n', 'f-r', 'f-m', 'f-ng'],
    review: [10.7, 38.9], // 회차 끝 30초 장단: 1절 합치기 여덟 줄 → 「밑에 오면 받침이야!」·「위에선 쉿! 밑에선 응!」 → 후렴 네 줄
    cues: (() => {
      const g = k => +(0.388 + (60 / 102.48) * k).toFixed(3);
      const on = k => +(g(k) - 0.15).toFixed(3); // 줄 신호는 첫 소리보다 조금 먼저 켠다
      const O1 = [0, 0.5, 1, 1.5, 1.92, 2.22, 2.71, 3], O2 = [0, 0.27, 0.73, 1, 1.46, 2, 2.49, 3];
      const C1 = ['안', '알', '암', '앙', '산', '물', '밤', '강'], C2 = ['손', '눈', '별', '말', '곰', '몸', '공', '방'];
      const chorus = starts => starts.map((L, n) => (n % 2
        ? bsweep(on(L), on(L + 4), C2, O2.map(o => g(L + o)), '손 눈 별 말 곰 몸 공 방!')
        : bsweep(on(L), on(L + 4), C1, O1.map(o => g(L + o)), '안 알 암 앙 산 물 밤 강!')));
      const verse = (L0, pairs) => pairs.map(([base, made], k) => batchim(on(L0 + 2 * k), on(L0 + 2 * k + 2), base, made, [g(L0 + 2 * k), g(L0 + 2 * k + 0.5), g(L0 + 2 * k + 1)]));
      const out = [line(0, 3.3, 'Ready? 받침!'), batchim(3.3, on(18), '아', '안', [3.86, 4.48, 5.04])];
      out.push(...verse(18, [['아', '안'], ['아', '알'], ['아', '암'], ['아', '앙'], ['사', '산'], ['무', '물'], ['바', '밤'], ['가', '강']]));
      // 연결: 「받침이야~」의 「야」를 b(40.7)까지 끌고, 「쉿!」(24.88) 뒤 25.08~26.43초는 노래가 멈춘다. 「응!」 뒤 「응~」 군소리
      out.push(line(on(34), on(40.8), '밑에 오면 받침이야!'), line(on(40.8), +(g(44.5) - 0.12).toFixed(3), '위에선 쉿!'), line(+(g(44.5) - 0.12).toFixed(3), on(50), '밑에선 응!'));
      out.push(...chorus([50, 54, 58, 62]));
      out.push(...verse(66, [['소', '손'], ['누', '눈'], ['벼', '별'], ['마', '말'], ['고', '곰'], ['모', '몸'], ['고', '공'], ['바', '방']]));
      out.push(...chorus([82, 86, 90, 94]));
      out.push(batchim(on(98), 59.1, '아', '안', [57.76, g(99), g(100)]), line(59.1, 61.2, '안녕!')); // 안녕 59.23 · 녕 59.58
      return out;
    })(),
  },
]);

// 배우는 길에 없는 자음이 노래에 나올 때 쓰는 글자 모양과 유니코드 첫소리 번호(10-05 거센소리 U5가 길에 들어와 지금은 대비용).
export const EXTRA_CONSONANTS = Object.freeze({ 'c-ch': ['ㅊ', 14], 'c-k': ['ㅋ', 15], 'c-t': ['ㅌ', 16], 'c-p': ['ㅍ', 17] });

export const songById = id => SONGS.find(s => s.id === id) || null;
/** 신호의 글자 칸 i가 가리키는 글자 id들. 회차 끝 장단은 이 글자를 다 만났을 때만 그 칸을 켠다(설계 §6 「익힌 글자까지만 장단에 들어와 날마다 길어진다」). */
export function tileLetters(cue, i) {
  if (cue.kind === 'vowel') return [cue.letter];
  if (cue.kind === 'blend') return i === 0 ? [cue.consonant] : i === 1 ? [cue.vowel] : [cue.consonant, cue.vowel];
  if (cue.kind === 'batchim') { const base = FS[cue.base].filter(Boolean); return i === 0 ? base : i === 1 ? [cue.final] : [...base, cue.final]; }
  if (cue.kind === 'sweep' && cue.tiles) return cue.tiles[i];
  if (cue.kind === 'sweep') { const id = cue.letters[i]; return cue.syllables ? [id, 'v-a'] : cue.consonant ? [cue.consonant, id] : [id]; }
  return [];
}
/** 구간 [from, to]의 신호에 나오는 글자 id(겹치지 않게). */
export function lettersIn(song, from, to) {
  const out = new Set();
  for (const cue of song.cues) {
    if (cue.end <= from || cue.t >= to) continue;
    const n = cue.kind === 'vowel' ? 1 : cue.kind === 'blend' || cue.kind === 'batchim' ? 3 : cue.kind === 'sweep' ? cue.letters.length : 0;
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
