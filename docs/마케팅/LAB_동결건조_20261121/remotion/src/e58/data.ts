// LAB 영어 E58 「엄마 동결건조하고 싶다」(11-21 07시 회차) — 원본 같은분야 「시험 날 한국 할머니가 '엿 먹어라!' — 사실은 '붙어라'」(32.7초):
// 무섭게 들리는 한마디로 열고(0.3초) → 몽글(원본은 손녀)이 겁먹고 → 뜻을 알아보는 칸(13.6초) → 회상 속 진짜 뜻(19.2초) → 눈물(24초) → 같은 말을 다른 사람이 되받는 끝(27~31초).
// 우리: 기차역 플랫폼, 떠나는 엄마에게 매달린 딸이 「엄마 동결건조하고 싶다…」 → 몽글은 엄마를 기계에 넣어 말리는 상상(💭, 6.5~11.1초 — 핵심 장면)
// → 엄마가 건넨 동결건조 딸기 「그대로지?」 → 「잠깐…」 → 「엄마, 늙지 마…」 = 진짜 뜻(지금 그대로 오래 곁에) → 엄마 눈물 · 포옹 · 기차 창 하트
// → 몽글이 영상 통화로 제 엄마에게 「엄마, 동결건조하고 싶어!」 → 몽글 엄마가 얼어붙고 유리병 속 제 모습을 떠올린다(끝 3초 — 핵심 장면이 다시 온다).
// 그림 · 한국어 목소리 · 박자는 여기, 화면 글(영어 판 정본)은 LOCS.
export const FPS = 30;
export const TOTAL = 32.6; // 원본 32.7초의 100%

export type Cell = { at: number; img: string; push?: [number, number]; origin?: string; dream?: boolean };
export const CELLS: Cell[] = [
  { at: 0.0, img: 'p1.jpg', push: [1.0, 1.05], origin: '45% 50%' }, // 훅 — 떠나는 엄마에게 매달린 딸 · 옆의 몽글(원본 0~1.5초)
  { at: 1.5, img: 'p2.jpg', push: [1.0, 1.04], origin: '60% 60%' }, // 몽글 가까이 — 얼어붙음(원본 1.5초 컷)
  { at: 3.0, img: 'p3.jpg', push: [1.0, 1.03], origin: '45% 55%' }, // 엄마 가까이 — 웃으며 딸 머리를 쓰다듬음(원본 3.0초)
  { at: 3.7, img: 'p4.jpg', push: [1.0, 1.03], origin: '60% 60%' }, // 넓게 — 몽글이 뒷걸음질(원본 4.3초 넓은 칸 — 이해 시험 v6 볼 이유 「3~6초 엄마 얼굴 칸이 그대로라 기다리기만 한다」로 0.6초 당김)
  { at: 6.5, img: 'p5.jpg', push: [1.0, 1.03], origin: '45% 55%', dream: true }, // 💭 엄마가 동결건조 기계에 들어감(원본 6.5초 — 핵심 장면 시작)
  { at: 6.85, img: 'p5b.jpg', push: [1.0, 1.03], origin: '50% 55%', dream: true }, // 💭 기계 안에서 문을 당겨 닫음(첫 컷 다른 눈 v1 「문이 닫히는 동작이 없다」)
  { at: 7.2, img: 'p6.jpg', push: [1.0, 1.03], origin: '50% 55%', dream: true }, // 💭 문이 닫히고 창 너머 손을 흔드는 엄마(원본 7.2초)
  { at: 7.7, img: 'p7.jpg', push: [1.0, 1.04], origin: '50% 55%', dream: true }, // 💭 서리 · 김이 터지며 기계가 덜덜(원본 7.7초)
  { at: 8.6, img: 'p7b.jpg', push: [1.0, 1.08], origin: '55% 85%', dream: true }, // 💭 김이 걷히며 쟁반으로 유리병이 미끄러져 나옴(첫 컷 다른 눈 v1 #29 · L05 「병이 놓이는 과정이 없다」)
  { at: 9.8, img: 'p8.jpg', push: [1.0, 1.05], origin: '55% 50%', dream: true }, // 💭 띵 — 유리병 속 작은 엄마가 손을 흔든다(원본 9.8초)
  { at: 10.45, img: 'p8b.jpg', push: [1.02, 1.06], origin: '55% 50%', dream: true }, // 💭 병 속 작은 엄마가 두 손 들고 폴짝(첫 컷 다른 눈 v2 #26 「병 속 엄마가 같은 자세」)
  { at: 11.1, img: 'p9.jpg', push: [1.0, 1.04], origin: '50% 60%' }, // 다시 플랫폼 — 몽글 질겁 「엄마를… 말린다고?!」(원본 11.1초)
  { at: 13.6, img: 'p10.jpg', push: [1.0, 1.03], origin: '40% 55%' }, // 엄마가 딸기 간식 봉지를 건넴 「간식 챙겨 가~」(원본 13.6초 — 뜻을 알아보는 칸)
  { at: 15.0, img: 'p11.jpg', push: [1.0, 1.04], origin: '50% 60%' }, // 딸이 동결건조 딸기를 몽글 눈앞에 「봐, 동결건조 딸기. 그대로지?」
  { at: 17.4, img: 'p12.jpg', push: [1.0, 1.05], origin: '50% 55%' }, // 딸기 가까이 — 모양 그대로
  { at: 18.55, img: 'p13.jpg', push: [1.0, 1.04], origin: '60% 55%' }, // 몽글 깨달음 「잠깐…」(원본 18.3초)
  { at: 19.2, img: 'p14.jpg', push: [1.0, 1.03], origin: '55% 55%' }, // 딸이 엄마 두 손을 잡고 「엄마, 늙지 마…」 + 진짜 뜻(원본 19.2초 반전)
  { at: 20.8, img: 'p15.jpg', push: [1.0, 1.04], origin: '45% 50%' }, // 엄마 눈물(원본 20.8초)
  { at: 21.4, img: 'p16.jpg', push: [1.0, 1.03], origin: '45% 50%' }, // 꼭 안음 · 몽글도 글썽(원본 21.4초)
  { at: 24.0, img: 'p17f.jpg', push: [1.0, 1.04], origin: '50% 45%' }, // 기차 창가의 엄마가 「이렇게?」 꽃받침으로 얼음처럼 굳는 장난(원본 24.0초 — 이해 시험 v3 볼 이유 「눈물 · 포옹 · 김 하트는 매일 보는 짜임」이라 김 하트를 이 편만의 웃음으로 바꿈)
  { at: 24.9, img: 'p18f.jpg', push: [1.0, 1.04], origin: '50% 45%' }, // 굳은 자세 그대로 기차가 떠남 · 창에 서리(원본 24.6초)
  { at: 25.8, img: 'p19.jpg', push: [1.0, 1.03], origin: '60% 55%' }, // 혼자 남은 몽글이 벤치에서 제 엄마와 영상 통화(원본 25.8초)
  { at: 27.2, img: 'p20.jpg', push: [1.0, 1.04], origin: '50% 50%' }, // 화면 속 몽글 엄마 · 몽글 「엄마, 동결건조하고 싶어!」(원본 27.2초)
  { at: 29.8, img: 'p21.jpg', push: [1.0, 1.05], origin: '50% 50%' }, // 끝 — 얼어붙은 몽글 엄마와 유리병 상상 + 끝 띠(원본 29.8초)
];

// 목소리 — 딸 혜리(f1~f3), 엄마 미선(mo1), 몽글 소진(m1~m3)
export const VO: [number, string][] = [
  [0.3, 'vo/f1'], // 엄마 동결건조하고 싶다…
  [3.85, 'vo/m0'], // 동결… 건조?
  [11.2, 'vo/m1'], // 엄마를… 말린다고?!
  [13.7, 'vo/mo1'], // 간식 챙겨 가~
  [15.1, 'vo/f2'], // 봐, 동결건조 딸기. 그대로지?
  [18.6, 'vo/m2'], // 잠깐…
  [19.5, 'vo/f3'], // 엄마, 늙지 마…
  [22.05, 'vo/mo2'], // 얘는 참…
  [24.1, 'vo/mo3'], // 이렇게?
  [25.95, 'vo/m4'], // 엄마~!
  [27.3, 'vo/m3'], // 엄마, 동결건조하고 싶어!
];

export const T = {
  slangTo: 3.0, // 「Korean slang」 표지 — 훅 칸만
  name: 1.6, nameTo: 3.0, // 몽글 이름표(이해 시험 v3 s · h · K 「끝 통화의 Mongle's mom이 누구인지」 · h · K 「Mongle이 누구인지」)
  f1: 0.3, f1To: 1.5, // 몽글 칸(1.5초)부터는 말한 딸이 화면에 없어 표지가 같은 줄을 잇는다(교훈 L21)
  m0: 3.8, m0To: 6.5, // 몽글이 낱말을 되뇐다 — 다음 상상 칸의 까닭(이해 시험 v3 s · h · G 「왜 엄마가 병에 들어가는지」 · h · G 「6초쯤 넘김」)
  dream: 6.5, dreamTo: 11.1,
  tag: 10.0, // 유리병 꼬리표 「엄마」
  m1: 11.15, m1To: 13.55,
  mo1: 13.65, mo1To: 15.0,
  f2: 15.05, f2To: 17.4, // 딸 목소리를 서현으로 바꾼 뒤(11-21 엉킴) 줄이 길어져 17.4초까지
  fd: 17.4, fdTo: 18.55, // 말풍선과 겹치지 않게 딸기 가까이 칸에서만 // 「동결건조 = freeze-dried」 표지(4초 안 — 교훈 L07)
  m2: 18.6, m2To: 19.2, // 미학 맹검 「「잠깐…」 말풍선이 모녀 칸(19.2초)까지 남는다」
  f3: 19.5, f3To: 20.95,
  mo2: 21.85, mo2To: 23.6, // 이해 시험 v6 h · K 「22초 「얘는 참」 글이 없다」 — 22.0초 그림에서 막 뜨는 중이라 0.15초 당김
  mo3: 24.05, mo3To: 25.7,
  real: 19.6, realTo: 22.0, // 진짜 뜻 표지(엄마 「얘는 참…」 말풍선과 겹치지 않게 22.0초까지)
  call: 25.9, // 📱 몽글 엄마 머리 줄(교훈 L21)
  m4: 25.9, m4To: 27.2, // 몽글 「엄마~!」 — 화면 속이 몽글 엄마라는 것(이해 시험 v5 s · h 「영상 통화의 몽글 엄마가 갑자기 나온다」)
  m3: 27.25, m3To: 29.75,
  card: 30.1, // 끝 띠
};

export type Body = { cx: number; cy: number; rx: number; ry: number; baseY: number };
// 몽글 얼어붙음 — p2 몽글이 움찔 키가 커졌다 굳는다
export const FREEZE = { at: 1.75, dur: 0.6, img: 'p2.jpg', body: { cx: 680, cy: 1100, rx: 330, ry: 480, baseY: 1500 } as Body };
// 뒷걸음 — p4 몽글이 오른쪽으로 미끄러지며 물러난다
export const SLIDE = { from: 3.7, to: 6.5, img: 'p4.jpg', body: { cx: 735, cy: 1255, rx: 130, ry: 150, baseY: 1340 } as Body, dx: 70 };
// 기계 덜덜 — p6 · p7의 기계가 떤다
export const RUMBLE = [
  { from: 7.35, to: 7.7, img: 'p6.jpg', body: { cx: 540, cy: 1000, rx: 470, ry: 520, baseY: 1420 } as Body, px: 8 },
  { from: 7.7, to: 8.6, img: 'p7.jpg', body: { cx: 545, cy: 1000, rx: 480, ry: 540, baseY: 1420 } as Body, px: 18 }, // 첫 컷 다른 눈 v1 「덜덜 떠는 동작이 안 보인다」 — 9 → 18px
];
// 유리병이 톡 튀어나와 흔들 — p8
// 병이 쟁반으로 미끄러져 나옴 — p7b의 병 자리가 앞으로 쑥(장면 심사 v2 「1.5~2초 서리 상자가 1초 가까이 그대로」)
export const SLIDEOUT = { from: 8.6, to: 9.8, img: 'p7b.jpg', body: { cx: 620, cy: 1560, rx: 190, ry: 230, baseY: 1760 } as Body };
export const JAR = { at: 9.8, dur: 0.65, img: 'p8.jpg', body: { cx: 620, cy: 1110, rx: 250, ry: 420, baseY: 1420 } as Body };
// 몽글 질겁 덜덜 — p9
export const SHIVER = { from: 11.1, to: 13.6, img: 'p9.jpg', body: { cx: 540, cy: 1180, rx: 580, ry: 480, baseY: 1560 } as Body, px: 12 }; // 첫 컷 다른 눈 v1 「몽글이 떠는 동작이 안 보인다」 — 5 → 12px
// 깨달음 — p13 몽글이 쑥 커진다
export const REALIZE = { at: 18.35, dur: 0.7, img: 'p13.jpg', body: { cx: 720, cy: 1170, rx: 330, ry: 400, baseY: 1500 } as Body };
// 포옹 흔들 — p16
export const SWAY = { from: 21.4, to: 24.0, img: 'p16.jpg', body: { cx: 470, cy: 1050, rx: 300, ry: 620, baseY: 1640 } as Body };
// 통화 몽글 통통 — p19
export const HOP = { at: 26.1, dur: 0.45, img: 'p19.jpg', body: { cx: 895, cy: 1060, rx: 190, ry: 200, baseY: 1240 } as Body };

export const SFX: [number, string, number][] = [
  [0.3, 'sparkle.wav', 0.2],
  [1.5, 'boing.wav', 0.25],
  [1.75, 'drip.wav', 0.3],
  [3.0, 'pop.wav', 0.2],
  [3.7, 'slide.wav', 0.4],
  [3.75, 'shiver.wav', 0.3],
  [3.85, 'pop.wav', 0.2],
  [6.5, 'whoosh.wav', 0.35],
  [6.55, 'sparkle.wav', 0.3],
  [6.85, 'whoosh.wav', 0.25],
  [7.2, 'squish.wav', 0.3],
  [7.3, 'machine.wav', 0.45],
  [7.7, 'frost.wav', 0.5],
  [8.2, 'machine.wav', 0.5],
  [8.25, 'frost.wav', 0.45],
  [8.6, 'slide.wav', 0.35],
  [9.8, 'dingdong.wav', 0.4],
  [9.85, 'pop.wav', 0.3],
  [10.0, 'sparkle.wav', 0.3],
  [10.45, 'boing.wav', 0.3],
  [11.1, 'boing.wav', 0.35],
  [11.15, 'shiver.wav', 0.35],
  [12.4, 'shiver.wav', 0.25],
  [13.6, 'pop.wav', 0.2],
  [15.0, 'pop.wav', 0.25],
  [17.45, 'pop.wav', 0.2],
  [17.4, 'sparkle.wav', 0.35],
  [18.55, 'sparkle.wav', 0.3],
  [19.6, 'pop.wav', 0.2],
  [20.8, 'drip.wav', 0.3],
  [21.4, 'squish.wav', 0.25],
  [22.6, 'drip.wav', 0.25],
  [24.0, 'pop.wav', 0.2],
  [24.5, 'frost.wav', 0.3],
  [24.9, 'train.wav', 0.45],
  [25.0, 'frost.wav', 0.25],
  [25.8, 'dingdong.wav', 0.3],
  [25.95, 'pop.wav', 0.2],
  [26.1, 'boing.wav', 0.25],
  [27.2, 'pop.wav', 0.2],
  [29.8, 'frost.wav', 0.55],
  [29.85, 'boing.wav', 0.3],
  [30.1, 'pop.wav', 0.3],
  [30.9, 'frost.wav', 0.4],
  [31.4, 'sparkle.wav', 0.35],
];

// 화면 글(영어 판 정본) — 한국어는 모든 판 그대로, 영어 · 뜻만 판마다
export type Loc = 'en';
export type LocText = {
  font: string;
  slang: string;
  slangMean: string;
  f1: string;
  name: string;
  m0: string;
  dream: string;
  dreamWhat: string;
  m4: string;
  machine: string;
  jar: string;
  m1: string;
  mo1: string;
  f2: string;
  fdTop: string; fdMean: string;
  m2: string;
  f3: string;
  mo2: string;
  mo3: string;
  realTop: string; realMean: string;
  call: string;
  m3: string;
  cardKo: string;
  cardMean: string;
};
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const LOCS: Record<Loc, LocText> = {
  en: {
    font: FONT,
    slang: 'Korean slang',
    slangMean: 'Literally:\n“I want to FREEZE-DRY my mom” 😳', // 미학 맹검(11-21) 「셋째 줄이 판 오른쪽 밖으로 나가 'om'이 안 읽힘」 — 두 줄로
    f1: '“I want to FREEZE-DRY my mom…”',
    name: 'Mongle',
    m0: 'Freeze… dry?!',
    m4: 'Mom~!',
    dream: 'Mongle imagines…',
    dreamWhat: '“FREEZE-DRY my mom”',
    machine: 'FREEZE-DRYER',
    jar: 'Instant MOM ☕', // 이해 시험 v6 s · h · G 「왜 작아져 병에 담기는지」 — 동결건조한 인스턴트 커피처럼
    m1: 'You’d DRY your mom?!',
    mo1: 'Take your snacks~',
    f2: 'See? Freeze-dried. Same shape!',
    fdTop: 'freeze-dried',
    fdMean: 'keeps its shape for years',
    m2: 'Wait…',
    f3: 'Mom, don’t get old…',
    mo2: 'Oh, you…',
    mo3: 'Freeze-dry me like this? 🥶', // 이해 시험 v6 s · h · G 「「이렇게?」 자세의 뜻」
    realTop: 'What it really means',
    realMean: '“Mom, stay just as you are.” 💗',
    call: 'Video call · Mongle’s mom',
    m3: 'Mom, I want to freeze-dry you!',
    cardKo: '누구를 동결건조하고 싶어?',
    cardMean: 'Who would YOU freeze-dry? 👇',
  },
};
