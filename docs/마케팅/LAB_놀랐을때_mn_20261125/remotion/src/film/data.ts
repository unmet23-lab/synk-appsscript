// LAB 몽골 M76 「놀랐을 때 네 마디」 장면 정본(11-25) — 영상 · 한국어(말의 한글 · 목소리) · 소리 · 박자. 판본마다 같다.
// 편 전체를 영상으로(제작 절차 lab-whole-video): 샷 다섯은 Flow Omni 1.2 Flash로 구운 720×1280 영상(public/vid — git 밖, tools/플로우영상.js 「넣기」)이고 글 · 소리를 그 위에 얹는다.
// 귀신의 집 방 넷(깜짝 상자 해골 · 국수 먹는 유령 · 거미 · 안 열리는 문)에서 몽글이 한 마디씩 놀라고, 마지막에는 겁주려던 직원이 몽글을 보고 첫 마디 「깜짝이야!」를 외치며 달아난다.
// 그 나라 글(머리 글 · 방마다 한 줄 · 말 읽는 법 · 뜻 · 끝 줄)은 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다.

export const FPS = 30;
export const fr = (s: number) => Math.round(s * FPS);

// 샷 — at: 편 초 · len: 쓸 길이 · from: 영상 안 시작 초
export type Shot = { at: number; len: number; vid: string; from?: number; rate?: number };
export const SHOTS: Shot[] = [
  { at: 0, len: 4.0, vid: 'h1.mp4' }, // 방 1 — 깜짝 상자에서 해골 인형이 튀어나오고 몽글이 입을 벌리고 뒤로 젖힌다
  { at: 4.0, len: 3.7, vid: 'h2.mp4' }, // 방 2 — 유령이 국수를 먹다 젓가락으로 인사, 몽글은 무표정
  { at: 7.7, len: 3.55, vid: 'h3.mp4', from: 0.45 }, // 방 3 — 거미가 얼굴 앞으로 내려오고 몽글이 눈을 꼭 감고 입을 벌려 운다
  { at: 11.25, len: 3.55, vid: 'h4.mp4', from: 0.4 }, // 방 4 — 불이 깜박, 문에 부딪혀도 안 열려 울상이 된다
  { at: 14.8, len: 1.6, vid: 'h5.mp4', from: 0.1, rate: 0.55 }, // 끝 — 숨어 있던 직원이 엿본다(넓은 컷, 늦춤 — 위 두 줄을 읽을 틈)
  { at: 16.4, len: 0.7, vid: 'h5.mp4', from: 0.98, rate: 0.8 }, // 바로 아래 몽글을 보고 손을 들며 펄쩍(이해 시험 v1 「무엇에 놀랐는지 안 보인다」)
  { at: 17.1, len: 1.95, vid: 'h5c.mp4' }, // 몽글을 본 직원 얼굴 가까이 — 「깜짝이야!」(첫 컷 판정 v1 「놀라는 얼굴이 작다」)
  { at: 19.05, len: 1.5, vid: 'h5.mp4', from: 1.75 }, // 돌아서 왼쪽으로 달아난다(넓은 컷)
  { at: 20.55, len: 3.0, vid: 'h6.mp4', from: 0.45, rate: 0.86 }, // 혼자 남은 몽글 — 카메라를 보고 깜박, 갸웃하며 입이 작게 벌어짐(첫 컷 판정 v1 「몽글이 폴짝 뜬다」 자리를 새 샷으로, 11-25 몽글 표정)
];
export const FILM = 23.55;
export const SCENE = { from: 14.8, to: 23.55 }; // 한 장면 먼저(장면 심사) — h5

// 몽글의 네 마디와 직원의 한 마디 — 온전한 말풍선(제작 절차 lab-lettering · 11-26 유호님 「이런 식으로 안짤리고 잘 나오는거는 이렇게 써줘도 좋을것같아」). x는 말풍선 가운데, y는 꼬리 끝, 꼬리x는 꼬리 끝 x(1080×1920 좌표)
export type Phrase = { n: number; at: number; to: number; ko: string; key: string; x: number; y: number; 꼬리x: number; 크기?: number };
export const PHRASES: Phrase[] = [
  { n: 1, at: 1.1, to: 4.0, ko: '깜짝이야!', key: '깜짝이야', x: 690, y: 960, 꼬리x: 800, 크기: 96 },
  { n: 2, at: 5.25, to: 7.7, ko: '헐…', key: '헐', x: 640, y: 985, 꼬리x: 760, 크기: 110 },
  { n: 3, at: 8.55, to: 11.25, ko: '엄마야!', key: '엄마야', x: 668, y: 1000, 꼬리x: 660, 크기: 100 },
  { n: 4, at: 12.55, to: 14.8, ko: '어떡해!', key: '어떡해', x: 690, y: 1240, 꼬리x: 760, 크기: 100 },
];
// 직원 — 첫 마디가 그대로 돌아온다(읽는 법은 첫 마디 것)
export const STAFF = { at: 17.15, to: 19.05, ko: '깜짝이야!', key: '깜짝이야', x: 540, y: 790, 꼬리x: 520, 크기: 92 };
// 위 한 줄 — 방 2 · 3 · 4와 끝 방(판본 글 sits 차례)
export const SITS: { at: number; to: number }[] = [
  { at: 4.05, to: 7.7 },
  { at: 7.7, to: 11.25 },
  { at: 11.3, to: 14.8 },
  { at: 14.85, to: 19.05 },
];
export const HOOK = { at: 0, to: 4.0 };
export const END = { at: 20.7, to: FILM, x: 560, y: 975, 꼬리x: 560 }; // 몽글의 속말 — 꼬리가 몽글 머리로

// 목소리(초 · 파일) — public/vo
export const VO: [number, string][] = [
  [1.1, 'm1'], // 깜짝이야!
  [5.35, 'm2'], // 헐…
  [8.57, 'm3'], // 엄마야!
  [12.6, 'm4'], // 어떡해!
  [17.17, 's1'], // 깜짝이야!(직원 — 범수)
];
// 효과음(초 · 파일 · 크기)
export const SFX: [number, string, number][] = [
  [0.72, 'pop.wav', 0.4], // 뚜껑이 열림
  [0.8, 'boing.wav', 0.55], // 해골이 튀어나옴
  [1.0, 'thud.wav', 0.3], // 몽글이 뒤로
  [1.7, 'boing.wav', 0.18], // 용수철이 흔들
  [4.1, 'slurp.wav', 0.42], // 후루룩
  [4.95, 'tok.wav', 0.3], // 젓가락 인사
  [6.6, 'slurp.wav', 0.28],
  [7.7, 'thread.wav', 0.42], // 거미줄을 타고 내려옴
  [8.25, 'boing.wav', 0.24],
  [9.3, 'shiver.wav', 0.35],
  [11.35, 'flicker.wav', 0.4], // 불이 깜박
  [12.0, 'thud.wav', 0.5], // 문에 쿵
  [12.28, 'thud.wav', 0.4],
  [13.4, 'shiver.wav', 0.3],
  [14.95, 'steps.wav', 0.14], // 살금살금
  [16.65, 'sting.wav', 0.45], // 몽글을 발견
  [18.05, 'shiver.wav', 0.3], // 부들부들
  [19.05, 'whoosh.wav', 0.35], // 망토 펄럭
  [19.15, 'run.wav', 0.5], // 달아남
  [20.72, 'pop.wav', 0.2], // 끝 줄
  [20.96, 'tok.wav', 0.16], // 깜박
  [21.65, 'pop.wav', 0.2], // 갸웃하며 얼굴이 바뀜
];
export const BGM_VOL = 0.2;
