// LAB 몽골 M63 「배달 시킬 때 네 마디」 장면 정본(11-20) — 그림 · 한국어(말의 한글 · 목소리) · 소리 · 박자. 판본마다 같다.
// 원본: 몽골 인스타 릴스 「한국 가서 헤매지 않게 가게 이름 다섯」(https://www.instagram.com/reel/DfelQk-Cu03/ · 12.5초) — 번호 붙은 낱말 카드를 칸마다 하나씩
// (1.4 · 2.6 · 4.0 · 5.3 · 6.6초) 바꾸다가 8.0초부터 끝 장치. 우리는 그 뼈대(머리 칸 → 번호 붙은 네 마디 → 다섯째 칸 → 끝 장치)를 원본 길이에 맞춰 17.5초(140%)로 옮긴다.
// 이야기: 한밤 원룸, 룸메이트가 잔다. 배고픈 몽글이 배달 앱 요청 사항에 네 마디를 적는다(덜 맵게 · 문 앞에 · 벨 누르지 말고 · 문자로).
// 기사님은 벨 앞에서 손가락을 거두고 문 앞에 살며시 놓고 간다 → 폰에 「도착했어요」 → 몽글이 뚜껑을 열자 떡볶이 김이 방을 건너가
// 룸메이트 코에 닿는다 → 룸메이트 벌떡 「나도…!」. 벨이 아니라 냄새가 깨웠다(끝 줄).
// 그 나라 글(머리 글 · 이름표 · 회상 표시 · 읽는 법 · 뜻 · 끝 줄)은 판본 글 하나(./판본/<KEY>.json — ./판본.ts)가 원천이다.
// 소리는 소진(몽글) · 범수(룸메이트) · 효과음은 직접 합성(../../../소리/만들기.py) · 음악은 보유곡 따뜻_118 한 토막.
export const FPS = 30;
export const TOTAL = 18.5; // 원본 12.5초의 148% — 끝 장치(정리 카드)를 사건 다섯 칸으로 바꿔 「다르게」(오마주.json)

// 칸 — 원본 박자(1.4 · 2.6 · 4.0 · 5.3 · 6.6 · 8.0초)를 17.5 / 12.52배로 늘린 자리 둘레(오마주 나란히 ±0.84초 안)
export const OPEN_AT = 0.0;
export const SPICY_AT = 1.8;
export const DOOR_AT = 4.0;
export const BELL_AT = 6.1;
export const BUZZ_AT = 8.1;
export const RIDER_AT = 9.9;
export const LID_AT = 11.4;
export const MSG_AT = 11.5; // 폰에 「도착했어요」(벨 대신 온 문자)
export const SNIFF_AT = 13.0; // 김이 코에 닿고 킁킁
export const WAKE_AT = 14.0; // 얼굴 가까이 — 눈이 번쩍(첫 컷 다른 눈 v2 「#33 놀람의 얼굴이 작다」)
export const UP_AT = 14.6; // 룸메이트 벌떡 · 손을 뻗음
export const NA_AT = 14.7; // 「나도…!」
export const MOVE_AT = 16.2; // 침대에서 내려와 포크를 집음(첫 컷 다른 눈 v2 「#41 · L05 자리 옮김과 포크 집기가 빠짐」)
export const END_AT = 16.8; // 같이 먹음 + 끝 줄

// 몽글의 네 마디 — 카드 자리(위 가운데 그늘 위), n / 4 · 큰 한글 · 읽는 법 · 뜻
export type Phrase = {
  n: number; // 1~4 — 판본 글 reads · means의 차례(n - 1)
  ko: string;
  top: number; // 글 덩이 위 끝(px)
  koSize: number;
  left?: number; // 글 덩이 왼쪽 끝(기본 70)
  width?: number; // 글 덩이 폭(기본 840)
  koShow?: string; // 화면에 그릴 한글(줄 바꿈 문자로 두 줄) — 없으면 ko
};

export type Cell = {
  at: number;
  img: string;
  phrase?: Phrase;
  vo?: { id: string; at: number }[];
};

export const CELLS: Cell[] = [
  { at: OPEN_AT, img: 'open.jpg' },
  { at: SPICY_AT, img: 'spicy.jpg', vo: [{ id: 'm1', at: 1.95 }], phrase: { n: 1, ko: '덜 맵게 해 주세요', top: 330, koSize: 104 } },
  { at: DOOR_AT, img: 'door.jpg', vo: [{ id: 'm2', at: 4.12 }], phrase: { n: 2, ko: '문 앞에 놔 주세요', top: 330, koSize: 104 } },
  { at: BELL_AT, img: 'bell.jpg', vo: [{ id: 'm3', at: 6.22 }], phrase: { n: 3, ko: '벨 누르지 말아 주세요', top: 270, koSize: 86 } },
  { at: BUZZ_AT, img: 'buzz.jpg', vo: [{ id: 'm4', at: 8.22 }], phrase: { n: 4, ko: '도착하면 문자 주세요', top: 290, koSize: 96, left: 380, width: 540, koShow: '도착하면\n문자 주세요' } },
  { at: RIDER_AT, img: 'rider.jpg' },
  { at: LID_AT, img: 'lid.jpg' },
  // 첫 컷 다른 눈 v1(11-20): 킁킁하는 동작이 안 보임 · 놀람에 가까운 칸 없이 같은 넓은 구도 · 「나도」 뒤 자세가 굳음 · 끝 줄만 새로 붙음
  // → 킁킁(반쯤 끌려 일어남) · 벌떡(얼굴 가까이) · 같이 먹음(끝 줄과 함께)을 따로 구웠다(v2)
  { at: SNIFF_AT, img: 'sniff.jpg' },
  { at: WAKE_AT, img: 'wake.jpg' },
  { at: UP_AT, img: 'up.jpg', vo: [{ id: 'r1', at: NA_AT }] },
  { at: MOVE_AT, img: 'move.jpg' },
  { at: END_AT, img: 'eat.jpg' },
];

export const KO_LINES = {
  msg: '도착했어요', // 폰 문자 — msgRead · msgMean
  na: '나도 먹을래!', // 룸메이트 — naRead · naMean(이해 시험 v1 · v2 둘씩 「나도…!」가 무엇에 대한 말인지 짚어 「먹을래」를 붙임)
};

// 자리(그림옮기기로 1080×1920에 맞춘 좌표) — 움직임 조각 · 글 자리가 여기서 난다. 그림을 다시 구우면 다시 잰다.
export const MONGLE: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'open.jpg': { cx: 786, cy: 1500, rx: 170, ry: 185 },
  'spicy.jpg': { cx: 333, cy: 1195, rx: 255, ry: 280 },
  'door.jpg': { cx: 448, cy: 1205, rx: 140, ry: 165 },
  'bell.jpg': { cx: 735, cy: 850, rx: 205, ry: 210 },
  'buzz.jpg': { cx: 671, cy: 1217, rx: 310, ry: 340 },
  'lid.jpg': { cx: 872, cy: 1185, rx: 130, ry: 135 },
  'sniff.jpg': { cx: 908, cy: 1080, rx: 140, ry: 150 },
  'up.jpg': { cx: 975, cy: 920, rx: 110, ry: 200 },
  'eat.jpg': { cx: 816, cy: 1195, rx: 140, ry: 165 },
  'move.jpg': { cx: 889, cy: 1205, rx: 150, ry: 165 },
};

// 잠든 룸메이트 머리(숨 쉬는 조각 · 💤 자리)
export const MATE: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'open.jpg': { cx: 200, cy: 1170, rx: 175, ry: 165 },
  'door.jpg': { cx: 895, cy: 1125, rx: 235, ry: 230 },
  'bell.jpg': { cx: 380, cy: 1300, rx: 300, ry: 280 },
  'buzz.jpg': { cx: 218, cy: 643, rx: 170, ry: 170 },
  'lid.jpg': { cx: 207, cy: 1136, rx: 165, ry: 160 },
  'sniff.jpg': { cx: 255, cy: 1060, rx: 240, ry: 270 },
  'up.jpg': { cx: 400, cy: 1000, rx: 390, ry: 430 },
  'eat.jpg': { cx: 345, cy: 1180, rx: 250, ry: 300 },
  'move.jpg': { cx: 390, cy: 1100, rx: 230, ry: 260 },
  'wake.jpg': { cx: 585, cy: 1150, rx: 430, ry: 470 },
};

// 끝 장면 — 폰(문자 자리) · 김이 지나가는 길(떡볶이 → 룸메이트 코) · 룸메이트 입(말풍선 꼬리)
export const PHONE = { x: 631, y: 1492 };
export const STEAM = { from: [760, 1330] as [number, number], to: [330, 1172] as [number, number] };
export const MATE_MOUTH: [number, number] = [640, 1105]; // 이해 시험 v1 둘이 「나도」가 누구 말인지 짚어 꼬리 끝을 입 가까이로 // 벌떡 그림 — 입 오른쪽 바로 밖(꼬리가 얼굴을 덮지 않게) — 그림을 다시 구우면 다시 잰다
// 기사 장면(기사2 — 쉿 하고 발끝으로 물러남) — 윗몸이 발끝에서 살짝 흔들리는 조각 · 쉿 손가락 자리
export const FINGER = { cx: 480, cy: 840, rx: 250, ry: 380 };
export const SHH = { x: 505, y: 870 };

// 배경음 — public/sfx/bgm.wav는 보유곡 따뜻_118의 4~23초(곡 안 빈 마디 62.25~63.75초 밖). 밤이라 낮게, 끝에서 조금 올린다
export const BGM_LOW = 0.18; // 올리기 전 검사(11-20): 0.14는 음악이 전체보다 12.4dB 작아 말 없는 자리가 빈 듯 — 12dB 안쪽으로
export const BGM_END = 0.2;

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'growl.wav', at: 0.25, vol: 0.5 },
  { file: 'tap.wav', at: 1.82, vol: 0.35 },
  { file: 'memory.wav', at: 1.8, vol: 0.3 },
  { file: 'sizzle.wav', at: 2.05, vol: 0.3 },
  { file: 'puff.wav', at: 2.75, vol: 0.35 },
  { file: 'tap.wav', at: 4.02, vol: 0.35 },
  { file: 'tick.wav', at: 4.7, vol: 0.3 },
  { file: 'tap.wav', at: 6.12, vol: 0.35 },
  { file: 'heart.wav', at: 6.4, vol: 0.6 },
  { file: 'tap.wav', at: 8.12, vol: 0.35 },
  { file: 'buzz.wav', at: 8.55, vol: 0.45 },
  { file: 'step.wav', at: 9.92, vol: 0.5 },
  { file: 'rustle.wav', at: 10.45, vol: 0.45 },
  { file: 'step.wav', at: 10.95, vol: 0.35 },
  { file: 'buzz.wav', at: MSG_AT, vol: 0.5 },
  { file: 'lid.wav', at: 12.05, vol: 0.5 },
  { file: 'steam.wav', at: 12.1, vol: 0.32 },
  { file: 'sniff.wav', at: SNIFF_AT + 0.1, vol: 0.6 },
  { file: 'sniff.wav', at: SNIFF_AT + 0.6, vol: 0.5 },
  { file: 'pop.wav', at: WAKE_AT, vol: 0.5 },
  { file: 'boing.wav', at: UP_AT - 0.02, vol: 0.55 },
  { file: 'rustle.wav', at: MOVE_AT, vol: 0.4 },
  { file: 'tick.wav', at: MOVE_AT + 0.3, vol: 0.4 },
  { file: 'ding.wav', at: END_AT, vol: 0.4 },
  { file: 'munch.wav', at: END_AT + 0.15, vol: 0.5 },
  { file: 'munch.wav', at: END_AT + 0.75, vol: 0.45 },
  { file: 'munch.wav', at: END_AT + 1.3, vol: 0.4 },
];
