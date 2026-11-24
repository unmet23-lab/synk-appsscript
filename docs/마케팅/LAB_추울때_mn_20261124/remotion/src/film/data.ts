// LAB 몽골 M65 「추울 때 네 마디」 장면 정본(11-24) — 그림 · 한국어(말의 한글 · 목소리) · 소리 · 박자. 판본마다 같다.
// 우리편 M37 「피곤할 때 네 마디」(검증된 틀 ③ 상황 쌓임 + 게이지 — 11-15 인스타 72시간 10,917회 · 평소의 3.9배 · 공유 157 · 저장 263)의 뼈대를 1:1로 —
// 머리 칸 → 상황 칸 + 표현 칸 넷 → 끝 칸. M37은 몽글의 배터리가 줄었다면, 이 편은 친구의 추위 단계(왼쪽 온도계)가 오른다.
// 상황 칸에서는 추위가 한 겹씩 더해지고(찬 바람 · 버스 15분 · 30분째 안 옴 · 집), 표현 칸에서는 한국 친구가 네 마디를 한다(추워~ · 손 시려… · 얼어 죽겠다! · 이불 밖은 위험해…).
// 몽골에서 온 몽글은 내내 아이스크림을 들고 태연하다. 끝은 몽글 「몽골은 영하 30도야~」 → 친구가 이불 밖으로 머리를 내밀고 「삼… 삼십 도?!」(게이지 999%) → 이불 산 속으로 사라진다.
// 그 나라 글(머리 글 · 온도 · 상황 글 · 말 읽는 법 · 뜻 · 게이지 이름표 · 끝 줄)은 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다.
// 소리는 범수(친구) · 소진(몽글) · 효과음은 직접 합성(../../../소리/만들기.py) · 음악은 보유곡 05_Toddler-Kids 한 토막.
export const FPS = 30;
export const PULL_AT = 26.8; // 이불을 끌어 덮는 칸(머리 내밂과 이불 산 사이)
export const TOTAL = 30.4;

// 친구의 네 마디(표현 칸)
export type Phrase = {
  n: number; // 1~4 — 판본 글 reads · means의 차례(n - 1)
  ko: string;
  cold: number; // 이 칸에서 오르는 친구의 추위 단계(0~1)
  riseAt: number; // 게이지가 오르는 초 — 친구가 말한 뒤 둘째 박자
  right: number; // 글 덩이 오른쪽 끝(px, 화면 왼쪽에서)
  bottom: number; // 글 덩이 아래 끝(px, 화면 위에서)
  width: number;
  koSize?: number; // 한글 글자 크기(기본 124)
  koShow?: string; // 화면에 그릴 한글(줄 바꿈 문자로 두 줄) — 없으면 ko
};

export type Cell = {
  at: number;
  img: string;
  sit?: number; // 상황 칸 — 판본 글 sits의 차례(0~3)
  phrase?: Phrase;
  vo?: { id: string; at: number }[];
};

export const KO_LINES = {
  invite: '편의점 가자~!', // 18.05초 몽글 — inviteRead · inviteMean
  mong: '몽골은 영하 30도야~', // 22.7초 몽글 — mongRead · mongMean
  shock: '삼… 삼십 도?!', // 24.8초 친구 — shockRead · shockMean
};

export const CELLS: Cell[] = [
  // 머리 칸 — 편의점 앞, 덜덜 떠는 친구와 아이스크림을 든 태연한 몽글(밖은 영하 5도)
  { at: 0.0, img: 'open.jpg' },
  { at: 3.2, img: 'gust.jpg', sit: 0 },
  {
    at: 5.0, img: 'hug.jpg', vo: [{ id: 'f1', at: 5.12 }],
    phrase: { n: 1, ko: '추워~', cold: 0.25, riseAt: 6.45, right: 960, bottom: 760, width: 520 },
  },
  { at: 7.7, img: 'busstop.jpg', sit: 1 },
  {
    at: 9.6, img: 'hands.jpg', vo: [{ id: 'f2', at: 9.72 }],
    phrase: { n: 2, ko: '손 시려…', cold: 0.5, riseAt: 11.1, right: 960, bottom: 700, width: 600, koSize: 116 },
  },
  { at: 12.5, img: 'snowpile.jpg', sit: 2 },
  {
    at: 14.4, img: 'frozen.jpg', vo: [{ id: 'f3', at: 14.52 }],
    phrase: { n: 3, ko: '얼어 죽겠다!', cold: 0.75, riseAt: 16.0, right: 1010, bottom: 610, width: 680, koSize: 96 }, // 11-24 15시 회차: 얼굴(눈 · 입)과 화면 위 머리 자리(269px)를 피해 한 줄로
  },
  { at: 17.2, img: 'room.jpg', sit: 3, vo: [{ id: 'm1', at: 18.05 }] }, // 11-24 15시 회차: 17.5 · 17.75 → 17.2 · 18.05 — 위 글과 몽글 말 사이를 0.83초 넘게(화면 글 검사)
  {
    at: 19.4, img: 'burrito.jpg', vo: [{ id: 'f4', at: 19.52 }],
    phrase: { n: 4, ko: '이불 밖은 위험해…', cold: 1.0, riseAt: 21.0, right: 1000, bottom: 760, width: 760, koSize: 100, koShow: '이불 밖은\n위험해…' },
  },
  // 끝 — 몽글 「몽골은 영하 30도야~」 → 친구가 이불 밖으로 머리를 내밀고 「삼… 삼십 도?!」(게이지 999%) → 이불 산(한 장면 — 끝 3초가 이 장면이다)
  { at: 22.5, img: 'mongle.jpg', vo: [{ id: 'm2', at: 22.7 }] },
  // 원본 M37의 반전(25.3초 100% 번쩍) · 끝 장치(28.6초 다음 날) 자리에 「삼… 삼십 도?!」와 이불 산을 둔다(나란히 뼈대 자리)
  { at: 24.7, img: 'pop.jpg', vo: [{ id: 'f5', at: 24.82 }] }, // 장면 심사 v2 「몽글만 떠 있는 2.5초」로 25.3 → 24.7(원본 반전 자리 ±0.7초 안)
  // 11-24 첫 컷 검사 「다시」(친구가 3초 굳음 · 이불 산이 쌓는 칸 없이 나타남) — 친구가 겁에 질려 이불을 끌어 덮는 칸을 사이에 둔다
  { at: PULL_AT, img: 'pull.jpg' },
  { at: 28.6, img: 'mountain.jpg' },
];

export const MONG_AT = 22.7;
export const POP_AT = 24.7;
export const BURST_AT = 24.95; // 게이지가 넘쳐 999%
export const PILE_AT = 28.6;
export const END_AT = 27.0; // 11-24 15시 회차: 끝 줄(몽골어 31자 — 읽는 데 2.4초)을 이불을 끌어 덮는 칸부터 띄운다. 길이를 늘리면 원본 박자 · 끝 자리가 어긋난다(올리기 전 검사 ⑮)

// 몽글 · 친구 자리(1080×1920에 맞춘 좌표) — 움직임 조각이 여기서 난다. 그림을 다시 구우면 다시 잰다.
export type Spot = { cx: number; cy: number; rx: number; ry: number };
export const MONGLE: Record<string, Spot> = {
  'open.jpg': { cx: 725, cy: 1235, rx: 190, ry: 205 },
  'gust.jpg': { cx: 945, cy: 1150, rx: 135, ry: 165 },
  'busstop.jpg': { cx: 760, cy: 1290, rx: 115, ry: 115 },
  'snowpile.jpg': { cx: 765, cy: 1400, rx: 225, ry: 245 },
  'room.jpg': { cx: 260, cy: 1110, rx: 150, ry: 135 },
  'mongle.jpg': { cx: 620, cy: 1080, rx: 340, ry: 300 },
  'mountain.jpg': { cx: 640, cy: 660, rx: 140, ry: 115 },
  'pull.jpg': { cx: 880, cy: 1150, rx: 165, ry: 140 },
};
export const FRIEND: Record<string, Spot> = {
  'open.jpg': { cx: 340, cy: 1210, rx: 200, ry: 490 },
  'gust.jpg': { cx: 390, cy: 1300, rx: 410, ry: 650 },
  'hug.jpg': { cx: 510, cy: 1230, rx: 450, ry: 720 },
  'busstop.jpg': { cx: 570, cy: 1295, rx: 115, ry: 265 },
  'hands.jpg': { cx: 570, cy: 1230, rx: 430, ry: 700 },
  'snowpile.jpg': { cx: 405, cy: 1210, rx: 160, ry: 545 },
  'frozen.jpg': { cx: 590, cy: 1180, rx: 480, ry: 760 },
  'burrito.jpg': { cx: 540, cy: 1190, rx: 450, ry: 730 },
  'pop.jpg': { cx: 380, cy: 820, rx: 330, ry: 320 },
  'pull.jpg': { cx: 450, cy: 1090, rx: 300, ry: 170 },
  'mountain.jpg': { cx: 540, cy: 1240, rx: 540, ry: 500 },
};

// 배경음 — public/sfx/bgm.wav는 보유곡 05_Toddler-Kids의 21.0~52.0초(빈 마디 없음). 내내 낮게, 넘침에서 한 번 낮추고 끝에서 다시
export const BGM_LOW = 0.16;
export const BGM_DIP = 0.1; // 넘침에서 1초 안만 낮춘다(11-24 15시 회차 음악층 — 3.6초 10dB 꺼짐을 고침)

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'chatter.wav', at: 0.4, vol: 0.18 }, // 첫 1초 효과음은 음악 아래로(영상 기준 #36 · 11-24)
  { file: 'gust.wav', at: 3.15, vol: 0.6 },
  { file: 'chatter.wav', at: 5.6, vol: 0.4 },
  { file: 'rise.wav', at: 6.47, vol: 0.45 },
  { file: 'phone.wav', at: 7.8, vol: 0.4 },
  { file: 'breath.wav', at: 10.4, vol: 0.5 },
  { file: 'rise.wav', at: 11.12, vol: 0.45 },
  { file: 'gust.wav', at: 12.45, vol: 0.35 },
  { file: 'freeze.wav', at: 14.42, vol: 0.55 },
  { file: 'rise.wav', at: 16.02, vol: 0.5 },
  { file: 'door.wav', at: 17.2, vol: 0.45 },
  { file: 'rustle.wav', at: 17.3, vol: 0.45 },
  { file: 'rustle.wav', at: 19.45, vol: 0.3 },
  { file: 'rise.wav', at: 21.02, vol: 0.55 },
  { file: 'pop.wav', at: POP_AT, vol: 0.6 },
  { file: 'rustle.wav', at: PULL_AT, vol: 0.55 }, // 이불을 확 끌어 덮음
  { file: 'whoosh.wav', at: PULL_AT - 0.05, vol: 0.3 },
  { file: 'alarm.wav', at: BURST_AT, vol: 0.45 },
  { file: 'whoosh.wav', at: PILE_AT - 0.2, vol: 0.45 },
  { file: 'thud.wav', at: PILE_AT, vol: 0.7 },
  { file: 'rustle.wav', at: PILE_AT + 0.25, vol: 0.4 },
];
