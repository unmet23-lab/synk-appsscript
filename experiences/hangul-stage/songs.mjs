// 한글 단계 노래(2026-10-04, Suno 케이팝 — 가사·프롬프트·만든 기록은 songs/README.md).
// 노래는 순서만 외우는 노래가 아니라 글자마다 소리·동작이 붙은 노래다: 모음은 몸동작(짧은 획이 가리키는 쪽으로 손을 뻗는다),
// 자음은 합치기(그 → 아 → 가). 화면은 노래 시각에 맞춰 글자를 켠다. 아틀라스 기록과 글자 진도에는 넣지 않는다(설계 §6 장단 — 세지 않는다).
//
// 시각은 노래에서 목소리만 떼어(Demucs) 잰 음절 시작이다(그 아 가·받침 노래 10-08, 모음 댄스 10-09). 처음(10-05)에 쓴 받아쓰기
// 낱말 시각과 반주 섞인 소리로 잰 시각은 0.1초에서 한 박까지 일렀다. 귀로 듣고 어긋나면 그 줄의 숫자만 고친다.
//
// 신호(cue) 꼴: line(가사 한 줄), vowel(모음 하나 — 동작과 함께), sweep(글자 여럿을 차례로), blend(자음 + 모음 = 음절, 세 걸음),
// batchim(바탕 음절 + 받침 = 음절, 세 걸음 — 10-08 받침 노래), compound(모음·음절 + 모음 = 겹모음 음절, 세 걸음 — 10-09 겹모음 댄스).
// ask가 있는 합치기는 떠올리기 줄이다(노래 영상 가이드): 노래가 답을 부를 때까지 결과 칸과 가사 줄의 답이 「?」로 비어 있다.

const MOVE = { 'v-a': 'right', 'v-eo': 'left', 'v-o': 'up', 'v-u': 'down', 'v-eu': 'wide', 'v-i': 'tall',
  'v-ya': 'right2', 'v-yeo': 'left2', 'v-yo': 'up2', 'v-yu': 'down2' };
export const moveOf = id => MOVE[id] || null;
// 같은 간격으로 n개(줄의 처음부터 끝 조금 앞까지).
const spread = (t, end, n) => Array.from({ length: n }, (_, k) => +(t + ((end - t) * k) / n).toFixed(3));
const BASIC = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i'];
const TEN = ['v-a', 'v-ya', 'v-eo', 'v-yeo', 'v-o', 'v-yo', 'v-u', 'v-yu', 'v-eu', 'v-i'];
const ROW1 = ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s'];        // 가 나 다 라 마 바 사
const ROW2 = ['c-ng', 'c-j', 'c-ch', 'c-k', 'c-t', 'c-p', 'c-h'];     // 아 자 차 카 타 파 하 (ㅊㅋㅌㅍ은 거센소리 U5)
// 글자 여럿을 차례로: 음절 시각(extra.at)을 주면 그 시각에, 안 주면 줄 안에서 고르게 켠다.
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
// 겹모음 댄스의 음절과 그 글자(첫소리 ㅇ은 소리 없는 자리라 세지 않는다).
const CV = { '오': ['v-o'], '아': ['v-a'], '와': ['v-wa'], '우': ['v-u'], '어': ['v-eo'], '워': ['v-wo'], '이': ['v-i'], '위': ['v-wi'],
  '으': ['v-eu'], '의': ['v-ui'], '고': ['c-g', 'v-o'], '과': ['c-g', 'v-wa'], '구': ['c-g', 'v-u'], '귀': ['c-g', 'v-wi'],
  '주': ['c-j', 'v-u'], '쥐': ['c-j', 'v-wi'], '무': ['c-m', 'v-u'], '뭐': ['c-m', 'v-wo'] };
const FOUR = ['와', '워', '위', '의'];
// 겹모음 합치기: 앞 칸(모음 또는 음절) + 뒤 모음 = 겹모음 음절, 세 걸음. ask는 떠올리기 줄의 물음(답 앞까지 보이는 가사).
const vv = (t, end, texts, at, text, extra = {}) => ({ kind: 'compound', t, end, texts, tiles: texts.map(s => CV[s]), at, text, ...extra });

export const SONGS = Object.freeze([
  {
    // 10-09 모음 댄스 영상 v6: 노래에서 목소리만 떼어(Demucs) 음절 시작을 다시 쟀다(126곳 중 125곳이 시작 봉우리와 0.07초 안 — 측정 도구는
    // Documents/synk-vendor/hangul-mascot-video/vowel-dance-full-v6/scripts/). 받아쓰기 시각과 「후렴은 줄 안에서 고르게」였던 옛 표는 1절 모음이
    // 0.1~0.5초(「차렷 이!」의 「이」 18.57 → 19.085), 2절·후렴이 0.1초쯤 일렀고, 「Ready」는 반주만 나오는 5.8초에 켰다.
    id: 'vowel-dance', title: '모음 댄스', src: 'assets/songs/vowel-dance.mp3', duration: 54.76, bpm: 105.5,
    suno: '399224fa-4ca7-42ee-854d-fbd7ea288bde', teaches: [...TEN],
    review: [11.4, 41.9], // 회차 끝 30초 장단: 첫 절(모음 여섯) → 후렴 → 둘째 절(ㅑㅕㅛㅠ) → 둘째 후렴 앞부분
    cues: (() => {
      const on = s => +(s - 0.15).toFixed(3); // 줄 신호는 줄의 첫 가사 소리보다 조금 먼저 켠다
      // 1절·2절 줄: [모음, 방향 낱말(줄의 첫 소리), 모음 소리, 가사]. 「쭉」 16.77, 「이」는 21.3초까지 끈다.
      // 2절은 「오른쪽(16분) 두 번 야(8분)」 — 두 · 번 30.54 · 30.83 / 31.68 · 31.97 / 32.82 · 33.11 / 33.97 · 34.25
      const V1 = [['v-a', 11.66, 12.21, '오른쪽 아!'], ['v-eo', 12.69, 13.33, '왼쪽 어!'], ['v-o', 13.85, 14.49, '위로 오!'], ['v-u', 15.05, 15.64, '아래 우!'],
        ['v-eu', 16.39, 17.35, '옆으로 쭉 으!'], ['v-i', 18.44, 19.085, '차렷 이!']];
      const V2 = [['v-ya', 30.12, 31.11, '오른쪽 두 번 야!'], ['v-yeo', 31.40, 32.25, '왼쪽 두 번 여!'], ['v-yo', 32.54, 33.38, '위로 두 번 요!'],
        ['v-yu', 33.68, 34.52, '아래 두 번 유!']];
      // 후렴 줄의 음절 시작. 모음 여섯 줄은 앞에 「Hey!」(21.36 · 23.66 · 28.23 · 48.65)를 외치고 「아」부터 — 「Hey!」는 앞 줄에 둔다.
      // 모음 열 줄은 4박마다 같은 엇박(아 0 · 야 ½ · 어 1 · 여 1⅓ · 오 1¾ · 요 2 · 우 2½ · 유 3 · 으 3¼ · 이 3½박).
      const SIX = [[21.67, 21.95, 22.25, 22.53, 22.82, 22.96], [23.96, 24.24, 24.535, 24.82, 25.09, 25.25],
        [28.53, 28.82, 29.11, 29.39, 29.67, 29.82], [49.05, 49.34, 49.63, 49.91, 50.19, 50.34]];
      const ROW = [[35.08, 35.37, 35.66, 35.85, 36.10, 36.25, 36.53, 36.81, 36.95, 37.10], [37.38, 37.67, 37.95, 38.13, 38.38, 38.53, 38.81, 39.10, 39.25, 39.38],
        [39.66, 39.95, 40.25, 40.41, 40.67, 40.81, 41.09, 41.38, 41.51, 41.67], [41.94, 42.24, 42.51, 42.70, 42.95, 43.10, 43.37, 43.65, 43.80, 43.95],
        [46.49, 46.78, 47.06, 47.25, 47.50, 47.65, 47.93, 48.22, 48.36, 48.50]];
      // 「따라 해 봐, 한글 댄스!」의 「따라」: 25.97(해 26.54 · 봐 26.83 · 한글 27.12 · 댄스 27.69), 44.23(44.74 · 45.08 · 45.37 · 45.94)
      const FOLLOW = [25.97, 44.23];
      // 줄은 다음 줄의 신호까지 이어진다(next = 다음 줄의 첫 소리).
      const verse = (rows, next) => rows.map(([id, first, sing, text], k) => vowel(on(first), on(rows[k + 1]?.[1] ?? next), id, sing, text));
      const six = (at, next) => sweep(on(at[0]), on(next), BASIC, { at, text: '아! 어! 오! 우! 으! 이!' });
      const ten = (at, next) => sweep(on(at[0]), on(next), TEN, { at, text: '아 야 어 여 오 요 우 유 으 이!' });
      const follow = (first, next) => line(on(first), on(next), '따라 해 봐, 한글 댄스!');
      return [
        line(0, on(6.18), 'Hey! 한글 댄스!'), // 헤이 0.38 · 0.95 · 1.52(3·2·1) · 한글 2.09 · 댄스 2.42
        line(on(6.18), on(7.89), 'Ready, set, go!'), // Ready 6.18 · set 6.76 · go 7.04
        line(on(7.89), on(V1[0][1]), 'Hey!'), // 7.89 · 8.34 · 8.76 · 9.18 · 9.63 · 10.21(11.5초까지 끈다)
        ...verse(V1, SIX[0][0]),
        six(SIX[0], SIX[1][0]), six(SIX[1], FOLLOW[0]), follow(FOLLOW[0], SIX[2][0]), six(SIX[2], V2[0][1]),
        ...verse(V2, ROW[0][0]),
        ten(ROW[0], ROW[1][0]), ten(ROW[1], ROW[2][0]), ten(ROW[2], ROW[3][0]), ten(ROW[3], FOLLOW[1]),
        follow(FOLLOW[1], ROW[4][0]), ten(ROW[4], SIX[3][0]), six(SIX[3], 51.01),
        line(on(51.01), 54.76, '한글 댄스!'), // 한 51.01 · 글 51.61 · 댄 52.18 · 스 52.77
      ];
    })(),
  },
  {
    // 10-08 노래 v2(Suno 644b446b): 옛 곡(61cb6e8e)이 후렴에서 「바바」「타타」처럼 음절을 두 번 불러 처음 배우는 사람이 헷갈려서, 줄마다
    // 8음절로 맞춘 가사(후렴 끝 「짝!」, 둘째 절 끝 「짝 짝!」)로 다시 만들었다(유호님 「C로 가자」). 시각은 박자 눈금
    // (100.02 BPM, 첫 박 0.284초) 위에 둔다 — 받아쓰기 낱말 시각은 빠른 줄에서 1~2박씩 틀린다. 노래는 후렴을 한 번 더 이어 부른다.
    // 10-08 영상 v3(유호님 「초반 타이밍·리듬이 안 맞는다」): 반주를 걷어 낸 목소리로 음절 시작을 다시 쟀다. 1절이 한 박 빨랐고,
    // 마디 뒤 줄(느 아 나 · 르 아 라 …)은 셋잇단 느낌(아 +1/3박 · 음절 +5/6박)으로 부르며, 1절 앞에 「그, 아, 가!」를 한 번 더 부른다.
    // 10-09 노래 v4(영상 v4와 같은 소리, 유호님 「오케이 이어서 남은것도 전부 하자」): 「그 더하기 아는?」·「느 더하기 아는?」 뒤에 반주만
    // 흐르는 한 마디씩을 끼웠다(노래 영상 가이드의 떠올리기 — 물음 → 쉼 → 답). 답 칸은 노래가 답을 부를 때까지 「?」다(ask).
    // 아래 표는 원곡 시각으로 적고 끝에서 sh()로 옮긴다 — 끼운 곳 원곡 32.672 · 35.057초(답 「가」·「나」 바로 앞), 노래 81.16 → 85.959초.
    // 원본·끼우기 스크립트 Documents/synk-vendor/hangul-songs/geu-a-ga-v4-20261009/
    id: 'geu-a-ga', title: '그 아 가', src: 'assets/songs/geu-a-ga.mp3', duration: 85.959, bpm: 100.0,
    suno: '644b446b-0387-48f2-a6cc-58163c232f4f', teaches: ['c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b', 'c-s', 'c-ng', 'c-j', 'c-h', 'c-k', 'c-t', 'c-p', 'c-ch'],
    // 회차 끝 장단(31.8초): 합치기 열네 자음 → 「그 더하기 아는? … 가!」 → 「합쳐 봐」 → 후렴 첫 줄 「가나다라마바사 짝!」.
    // 쉼 두 마디만큼 길어져서 끝을 후렴 둘째 줄(옛 끝 원곡 43.3초) 대신 첫 줄 끝(원곡 40.93초 = 새 45.7초)으로 당겼다 — 둘째 줄 글자는 1절에 다 나온다.
    review: [13.9, 45.7],
    cues: (() => {
      const BAR = 4 * (60 / 100.02), INS = [32.672, 35.057];
      const sh = t => +(t + INS.filter(c => t >= c).length * BAR).toFixed(3);
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
      // 떠올리기: 「…아는?」 뒤 쉼 한 마디 동안 결과 칸과 가사 줄의 답이 「?」로 비어 있다(ask = 답 앞까지 보이는 가사)
      out.push({ ...bl(+(PRE1 - 0.12).toFixed(3), on(55.5), 'c-g', [PRE1, g(53), g(54)], '그 더하기 아는? 가!'), ask: '그 더하기 아는?' });
      out.push({ ...bl(on(55.5), on(59), 'c-n', [g(55.5), g(57), g(58)], '느 더하기 아는? 나!'), ask: '느 더하기 아는?' });
      out.push(line(on(59), on(64), '합쳐 봐, 하나 둘 셋!'));
      const chorus = starts => starts.forEach((L, n) => out.push(sw(L, n % 2 ? ROW2 : ROW1, n % 2 ? '아 자 차 카 타 파 하 짝!' : '가 나 다 라 마 바 사 짝!', { syllables: true })));
      chorus([64, 68, 72, 76, 80, 84, 88, 92]);
      [['c-g', '가 거 고 구 그 기 짝 짝!'], ['c-n', '나 너 노 누 느 니 짝 짝!'], ['c-d', '다 더 도 두 드 디 짝 짝!'], ['c-r', '라 러 로 루 르 리 짝 짝!']]
        .forEach(([c, text], n) => out.push(sw(96 + 4 * n, BASIC, text, { consonant: c })));
      chorus([112, 116, 120, 124]);
      out.push(bl(on(128), 78.47, 'c-g', [g(128), g(129), g(130)], '그, 아, 가!'));
      out.push(line(78.47, 81.16, '이제 읽을 수 있어!')); // 이제 78.55 · 읽을 78.86 · 수 79.18 · 있어 79.32
      return out.map(c => ({ ...c, t: sh(c.t), end: sh(c.end), ...(Array.isArray(c.at) ? { at: c.at.map(sh) } : {}) }));
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
  {
    // 10-09 겹모음 댄스(Suno 827ae68f, 10-08 유호님 「C로 가자」 · 콘티 「추천안대로 갈게」): 모양과 소리가 맞는 합치기 넷(오+아=와 · 우+어=워 ·
    // 우+이=위 · 으+이=의)과 자음이 붙은 2절(고+아=과 · 구+이=귀 · 주+이=쥐 · 무+어=뭐). 노래 영상 가이드를 처음 적용한 곡이다.
    // 노래 v3(영상 v3·v4와 같은 소리, 유호님 「오더하기 아는 와! 이때 와가 0.1초만에 지나가는데 조금 0.5초는 있어야」): 떠올리기 두 곳 앞에
    // 반주만 흐르는 한 마디씩, 「와!」 뒤에 한 박을 끼웠다 — 원곡 시각 t는 sh(t)로 옮긴다. 시각은 노래에서 목소리만 떼어 잰 값
    // (99.98 BPM, 첫 박 0.580초). 원본·끼우기 스크립트 Documents/synk-vendor/hangul-songs/compound-dance-v3-20261009/
    id: 'compound-dance', title: '겹모음 댄스', src: 'assets/songs/compound-dance.mp3', duration: 49.0, bpm: 99.98,
    suno: '827ae68f-65d7-448f-899e-8d8f0191ed96', teaches: ['v-wa', 'v-wo', 'v-wi', 'v-ui'],
    review: [6.13, 35.54], // 회차 끝 장단(29.4초): 1절 합치기 넷 → 떠올리기 둘 → 후렴 · 「따라 해 봐」 → 2절 과 귀 쥐 뭐
    cues: (() => {
      const BEAT = 60 / 99.98, PH = 0.580, BAR = 4 * BEAT;
      const INS = [[12.73, BAR], [13.17, BEAT], [15.21, BAR]];
      const sh = t => +(t + INS.filter(([c]) => t >= c).reduce((n, [, len]) => n + len, 0)).toFixed(3);
      const b = k => sh(PH + BEAT * k);
      const on = k => +(b(k) - 0.15).toFixed(3); // 줄 신호는 첫 소리보다 조금 먼저 켠다
      const four = (t, end, L) => ({ kind: 'sweep', t, end, letters: [...FOUR], texts: [...FOUR], tiles: FOUR.map(s => CV[s]),
        at: [0, 0.8, 1.5, 2].map(o => b(L + o)), text: '와! 워! 위! 의!' });
      const dance = (t, end) => line(t, end, '따라 해 봐, 모음 댄스!');
      const out = [line(0, 1.63, 'Ready? 모음 둘!')];
      // 도입 「오, 아, 와!」 b(2·3·4)와 메아리 b(5·6·7)(뒤 「와~」 늘임)
      out.push(vv(1.63, 3.43, ['오', '아', '와'], [b(2), b(3), b(4)], '오, 아, 와!'), vv(3.43, on(9.5), ['오', '아', '와'], [b(5), b(6), b(7)], '오, 아, 와!'));
      // 1절 b(9.5 + 2k): 앞 모음 +0 · 뒤 모음 +½ · 결과 +1박. 첫 줄은 자음 없이 이어 불러 입이 열리는 순간으로 잰 값(아 6.64 · 와 7.05)
      [['오', '아', '와'], ['우', '어', '워'], ['우', '이', '위'], ['으', '이', '의']].forEach((tx, k) => {
        const L = 9.5 + 2 * k;
        out.push(vv(on(L), k === 3 ? 10.73 : on(L + 2), tx, k === 0 ? [b(L), 6.64, 7.05] : [b(L), b(L + 0.5), b(L + 1)], `${tx[0]} ${tx[1]} ${tx[2]}!`));
      });
      // 떠올리기: 「…이는?」 뒤 쉼 한 마디 동안 결과 칸과 가사 줄의 답이 「?」 → 답(와 15.28 · 의 20.65)
      out.push(vv(10.73, on(21), ['오', '아', '와'], [b(17), b(19), sh(12.88)], '오 더하기 아는? 와!', { ask: '오 더하기 아는?' }));
      out.push(vv(on(21), b(25.5), ['으', '이', '의'], [b(21), b(23), sh(15.25)], '으 더하기 이는? 의!', { ask: '으 더하기 이는?' }));
      // 후렴 줄 b(L): 와 +0 · 워 +0.8 · 위 +1.5 · 의 +2박. 첫 줄은 「의!」가 0.63초 보이게 「와」 소리에 맞춰 켠다
      out.push(four(b(25.5), on(29.5), 25.5), four(on(29.5), sh(20.54), 29.5), dance(sh(20.54), on(37.5)), four(on(37.5), on(41.5), 37.5));
      // 2절 b(41.5 + 2k)
      [['고', '아', '과'], ['구', '이', '귀'], ['주', '이', '쥐'], ['무', '어', '뭐']].forEach((tx, k) => {
        const L = 41.5 + 2 * k;
        out.push(vv(on(L), on(L + 2), tx, [b(L), b(L + 0.5), b(L + 1)], `${tx[0]} ${tx[1]} ${tx[2]}!`));
      });
      out.push(four(on(49.5), on(53.5), 49.5), four(on(53.5), sh(34.94), 53.5), dance(sh(34.94), on(61.5)), four(on(61.5), on(65.5), 61.5));
      // 마무리 「오, 아, 와! 안녕!」(안녕 46.72초) — 노래 끝까지 와가 켜져 있다
      out.push(vv(on(65.5), 49.0, ['오', '아', '와'], [b(65.5), b(66.5), b(67.5)], '오, 아, 와! 안녕!'));
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
  if ((cue.kind === 'sweep' || cue.kind === 'compound') && cue.tiles) return cue.tiles[i];
  if (cue.kind === 'sweep') { const id = cue.letters[i]; return cue.syllables ? [id, 'v-a'] : cue.consonant ? [cue.consonant, id] : [id]; }
  return [];
}
/** 구간 [from, to]의 신호에 나오는 글자 id(겹치지 않게). */
export function lettersIn(song, from, to) {
  const out = new Set();
  for (const cue of song.cues) {
    if (cue.end <= from || cue.t >= to) continue;
    const n = cue.kind === 'vowel' ? 1 : cue.kind === 'blend' || cue.kind === 'batchim' || cue.kind === 'compound' ? 3 : cue.kind === 'sweep' ? cue.letters.length : 0;
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
