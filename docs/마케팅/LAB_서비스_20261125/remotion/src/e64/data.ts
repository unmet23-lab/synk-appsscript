// LAB 영어 E64 「서비스」(11-25 07시 회차) — 편 전체를 영상으로(제작 절차 lab-whole-video)의 첫 LAB 편.
// 샷은 Flow Omni 1.2 Flash로 구운 720×1280 영상(public/vid — git 밖, tools/플로우영상.js 「넣기」)이고, 글 · 소리는 그 위에 얹는다.
export const FPS = 30;
export const fr = (s: number) => Math.round(s * FPS);

// 샷 — at: 편 초 · len: 쓸 길이 · from: 영상 안 시작 초
export type Shot = { at: number; len: number; vid: string; from?: number };
export const SHOTS: Shot[] = [
  { at: 0, len: 3.2, vid: 's1.mp4' }, // 사장님이 군만두를 내려놓고 오른손을 지갑 곁 탁자에 얹음 · 「서비스~!」
  { at: 3.2, len: 4.0, vid: 's2.mp4' }, // 핵심 장면 — 땀 흘리는 몽글이 몸으로 지갑을 밀어 사장님 손끝에 댐 · 「얼마예요…?」
  { at: 7.2, len: 5.0, vid: 's3.mp4' }, // 사장님이 웃음을 터뜨리며 손을 젓고 지갑을 되밀어 줌 · 「아니 아니~ 서비스!」
  { at: 12.2, len: 6.0, vid: 's4.mp4' }, // 몇 분 뒤 — 관광객이 공짜 만두에 지갑을 내밀고, 몽글이 「서비스예요~!」
];
export const SCENE = 7.2; // 한 장면 먼저(장면 심사) — s1 + s2
export const FILM = 18.2;

// 목소리(초 · 파일) — public/vo
// v4(시험 없이): 끝 「허허~」를 뺐다 — 이해 시험 v3 sonnet · haiku가 둘 다 「웃음 소리로 짐작」으로 짚음. 지갑은 👛로 짚는다(GPT v1 · v2, sonnet v3 「노란 · 초록 물건이 무엇인지」)
export const VO: [number, string][] = [
  [0.85, 'o1'], // 서비스~!
  [3.9, 'm1'], // 얼마예요…? — v3: 밀기 전에 묻는다(이해 시험 v2 sonnet 「4초 몽글이 왜 우는지 모름」 — 땀방울을 눈물로 읽음)
  [7.9, 'o2'], // 아니 아니~ 서비스! (1.95초) — v2: 7.85초 말풍선과 함께(이해 시험 v1 셋이 「아니 아니」를 못 봄 — 8초 칸에 아직 안 떴다)
  [12.6, 'o1'], // v3: 관광객 앞에서도 「서비스~!」(이해 시험 v2 sonnet · haiku 「14초 새 장면이 왜 나오는지 · 말이 없음」)
  [15.6, 'm2'], // 서비스예요~! — 관광객 말풍선(1.3초) 뒤(화면글검사: 새 글 1.2초 넘게)
];
// 효과음(초 · 파일 · 크기)
export const SFX: [number, string, number][] = [
  [0.35, 'cling.wav', 0.35], // 접시가 탁자에 닿음
  [3.4, 'tok.wav', 0.18], // 땀방울
  [4.4, 'squish.wav', 0.3], // 몸으로 밀기 시작
  [6.35, 'plop.wav', 0.3], // 지갑이 사장님 손끝에 닿음
  [9.4, 'whoosh.wav', 0.18], // 지갑을 되밀어 줌
  [9.9, 'sparkle.wav', 0.2], // 가격표 뜻 카드
  [12.4, 'whoosh_up.wav', 0.14], // 「Later…」 한 줄
  [12.5, 'cling.wav', 0.25], // 관광객 앞 접시
  [14.5, 'tok.wav', 0.16], // 관광객이 지갑을 듦
  [15.4, 'pop.wav', 0.16], // 몽글이 흔들기 시작
];

// 화면 글 — 말풍선(말한 사람 머리 곁 · 꼬리를 그 사람에게, 교훈 L21 · L08), 머리 글, 뜻 카드
export type Say = { at: number; to: number; ko?: string; en: string; x: number; y: number; tail?: number; koSize?: number; enSize?: number };
export const SAYS: Say[] = [
  { at: 0.85, to: 3.2, ko: '서비스~!', en: '“Service”~!', x: 400, y: 735, tail: 0.18 },
  { at: 3.9, to: 7.2, ko: '얼마예요…?', en: 'How much is it…? 👛', x: 640, y: 1150, tail: 0.5 },
  { at: 7.85, to: 9.9, ko: '아니 아니~ 서비스!', en: 'No, no~ it’s 서비스!', x: 400, y: 660, tail: 0.3, koSize: 78 },
  { at: 13.15, to: 14.4, ko: '서비스~!', en: '“Service”~!', x: 640, y: 640, tail: 0.45, koSize: 76, enSize: 48 },
  { at: 14.4, to: 15.6, en: 'Uh… how much? 👛😰', x: 250, y: 770, tail: 0.25 },
  { at: 15.6, to: 18.2, ko: '서비스예요~!', en: 'It’s on the house~!', x: 760, y: 1135, tail: 0.5, koSize: 80 },
];
export const HEAD = { at: 0.05, to: 3.2, l1: 'In Korea, when you hear', l2: '서비스…' };
// 뜻 카드 — v2: 위쪽 종이 카드(아까워와 같은 꼴 — 이해 시험 v1 haiku · GPT 「같아 보임」) 대신 사장님 옆 벽에 걸린 가격표 「₩0」
export const CARD = { at: 9.9, to: 12.4, ko: '서비스', read: 'seo-bi-seu', mean: '₩0 = FREE!', sub: 'on the house 🥟' };
// 시간이 넘어가는 칸을 한 줄로 잇는다(교훈 L05 — 이해 시험 v1 셋이 14초 새 손님을 모름)
export const LATER = { at: 12.4, to: 15.6, text: 'Later — a new customer… 👀' }; // v3: 관광객 말풍선까지 남긴다
