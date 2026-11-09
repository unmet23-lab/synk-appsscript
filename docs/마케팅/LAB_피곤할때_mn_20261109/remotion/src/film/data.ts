// LAB 몽골 M37 「피곤할 때 네 마디」 화면 글 정본(11-09). 몽골어는 세 겹 검수(../../../게시/검문/)를 거친 글만 둔다.
// 우리편 M1 「화날 때 네 마디」(10-31, 인스타 72시간 19,463회 · 평소의 136배)의 뼈대를 1:1로 — 머리 칸 → 상황 칸 + 표현 칸 넷 → 끝 칸.
// M1이 화 게이지가 차올랐다면 이 편은 배터리가 줄어든다. 끝은 1%에 친구 문자 「노래방 갈래?」 → 100%로 번쩍 → 노래방 「한 곡 더!」.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н · ㅈ=ж). 소리는 소진(세기 1.0) 몽글 · 범수 친구 · 효과음은 직접 합성(../../../소리/만들기.py).
export const FPS = 30;
export const TOTAL = 30.4;

export type Bubble = {
  n: number; // 1~4
  ko: string;
  read: string;
  mn: string;
  battery: number; // 이 칸에서 내려가는 배터리(0~1)
  side: 'left' | 'right';
  bottom: number;
  width: number;
  tip: [number, number];
};

export type Cell = {
  at: number;
  img: string;
  sit?: string;
  bubble?: Bubble;
  vo?: { id: string; at: number }[];
};

export const TEXT = {
  hook: 'Ядарсан үедээ найздаа\nхэлэх 4 үг',
  gauge: 'ЭРЧ ХҮЧ',
  openKo: '지쳤어…',
  openRead: 'жичөссө',
  openMn: 'Туйлдлаа…', // 시험관(그록) 「0~3초 지쳤어의 뜻이 안 보인다」 — 4/4 칸과 같은 말을 첫 칸에도
  msgFrom: 'Найз',
  msgKo: '노래방 갈래?',
  msgRead: 'норэбан галлэ?',
  msgMn: 'Караоке явах уу?',
  goKo: '가자!',
  goRead: 'гажа!',
  goMn: 'Явъя!',
  moreKo: '한 곡 더!',
  moreRead: 'хан гог дө!',
  moreMn: 'Дахиад нэг дуу!',
  end: 'Караоке гэхээр л цэнэг дүүрчихдэг!',
};

export const CELLS: Cell[] = [
  // 머리 칸 — 하루 끝 모습을 앞에서 먼저: 1%, 책상에 녹아내린 몽글
  { at: 0.0, img: 'open.jpg', vo: [{ id: 'a4', at: 0.55 }] },
  { at: 3.2, img: 'class1.jpg', sit: 'Өглөөний 1-р хичээл…' },
  {
    at: 5.0, img: 'class2.jpg', vo: [{ id: 'a1', at: 5.12 }, { id: 'a1', at: 6.5 }],
    bubble: { n: 1, ko: '졸려…', read: 'жоллё', mn: 'Нойр хүрч байна…', battery: 0.75, side: 'right', bottom: 790, width: 640, tip: [640, 860] },
  },
  { at: 7.7, img: 'sub1.jpg', sit: 'Өглөөний метро пиг дүүрэн…' },
  {
    at: 9.6, img: 'sub2.jpg', vo: [{ id: 'a2', at: 9.72 }, { id: 'a2', at: 11.1 }],
    bubble: { n: 2, ko: '힘들어…', read: 'химдырө', mn: 'Хэцүү байна…', battery: 0.5, side: 'right', bottom: 1110, width: 640, tip: [560, 1190] },
  },
  { at: 12.5, img: 'store1.jpg', sit: 'Цагийн ажил — хайрцаг дуусахгүй…' },
  {
    at: 14.4, img: 'store2.jpg', vo: [{ id: 'a3', at: 14.52 }, { id: 'a3', at: 16.0 }],
    // 지하철 눌림과 같은 그림이던 상자 더미를 「상자에 머리부터 처박힌 몽글」로 바꿨다(볼 이유 심사 v3 답 4) →
    // 얼굴이 안 보여 「캐릭터로 안 읽히는 붉은 주머니」(아르곤 맹검 v6 [C137]) — 상자 앞 날개에 축 늘어져 얼굴을 기댄 판(판/알바4.txt)
    bubble: { n: 3, ko: '피곤해…', read: 'пигонхэ', mn: 'Ядарч байна…', battery: 0.25, side: 'right', bottom: 950, width: 640, tip: [460, 1030] }, // 꼬리가 길게 찌른다(맹검 v7 · v8) — 말풍선을 내려 짧게
  },
  { at: 17.5, img: 'desk1.jpg', sit: 'Шөнийн 3 цаг — даалгавар дуусахгүй…' },
  {
    at: 19.4, img: 'desk2.jpg', vo: [{ id: 'a4', at: 19.52 }, { id: 'a4', at: 21.0 }],
    bubble: { n: 4, ko: '지쳤어…', read: 'жичөссө', mn: 'Туйлдлаа…', battery: 0.01, side: 'right', bottom: 860, width: 640, tip: [620, 1080] },
  },
  // 끝 — 1%에 문자 → 100% → 노래방
  { at: 22.5, img: 'phone.jpg', vo: [{ id: 'b1', at: 23.2 }] },
  { at: 25.3, img: 'up.jpg', vo: [{ id: 'a5', at: 25.42 }] },
  { at: 26.9, img: 'karaoke.jpg', vo: [{ id: 'a6', at: 27.05 }] },
  // 끝 장치(M1의 「고양이가 컵을 또 민다」 자리) — 다음 날 아침 1교시, 마이크를 곁에 둔 채 다시 1%(장면 심사 v1 답 3)
  // 시험관 둘이 「끝 장면의 마이크 · 종이 조각 · 1교시」를 같이 짚어 밤새 노래한 다음 날임을 글로 잇는다(v4)
  { at: 28.6, img: 'next.jpg', sit: 'Шөнөжин дуулсны маргааш —\n1-р хичээл…', vo: [{ id: 'a1', at: 28.95 }] },
];

export const MSG_AT = 23.0;
export const CHARGE_AT = 24.6; // 충전 차오름 소리 — 25.3에 번쩍
export const UP_AT = 25.3;
export const KARAOKE_AT = 26.9;
export const END_AT = 27.15;
export const NEXT_AT = 28.6;

// 몽글 자리(판옮기기로 1080×1920에 맞춘 좌표) — 움직임 조각이 여기서 난다
export const MONGLE: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  'open.jpg': { cx: 528, cy: 1356, rx: 540, ry: 360 },
  'class1.jpg': { cx: 563, cy: 1287, rx: 360, ry: 380 },
  'class2.jpg': { cx: 597, cy: 1103, rx: 500, ry: 320 },
  'sub1.jpg': { cx: 563, cy: 1632, rx: 260, ry: 260 },
  'sub2.jpg': { cx: 505, cy: 1436, rx: 450, ry: 300 },
  'store1.jpg': { cx: 460, cy: 1448, rx: 260, ry: 260 },
  'store2.jpg': { cx: 545, cy: 1190, rx: 320, ry: 225 },
  'desk1.jpg': { cx: 402, cy: 1360, rx: 330, ry: 300 },
  'desk2.jpg': { cx: 483, cy: 1402, rx: 500, ry: 380 },
  'phone.jpg': { cx: 632, cy: 1080, rx: 440, ry: 260 },
  'up.jpg': { cx: 600, cy: 1080, rx: 300, ry: 520 }, // 머리 위 흐린 띠에 걸리면 늘일 때 머리가 납작해진다
  'karaoke.jpg': { cx: 425, cy: 1195, rx: 400, ry: 440 },
  'next.jpg': { cx: 597, cy: 1103, rx: 500, ry: 320 },
};

// 배경음 — public/sfx/bgm.wav는 보유곡 01_Joyful의 앞 31초. 하루 내내 낮게, 100%부터 크게
export const BGM_LOW = 0.11;
export const BGM_HIGH = 0.24;

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'low.wav', at: 0.15, vol: 0.35 },
  { file: 'low.wav', at: 1.9, vol: 0.3 },
  { file: 'class.wav', at: 3.2, vol: 0.4 },
  { file: 'thud.wav', at: 5.0, vol: 0.6 },
  { file: 'drain.wav', at: 5.25, vol: 0.4 },
  { file: 'subway.wav', at: 7.7, vol: 0.6 },
  { file: 'squish.wav', at: 9.6, vol: 0.6 },
  { file: 'drain.wav', at: 9.85, vol: 0.4 },
  { file: 'beep.wav', at: 12.6, vol: 0.4 },
  { file: 'beep.wav', at: 13.4, vol: 0.4 },
  { file: 'boxes.wav', at: 14.3, vol: 0.7 },
  { file: 'drain.wav', at: 14.65, vol: 0.4 },
  { file: 'keys.wav', at: 17.5, vol: 0.55 },
  { file: 'thud.wav', at: 19.4, vol: 0.5 },
  { file: 'drain.wav', at: 19.65, vol: 0.45 },
  { file: 'low.wav', at: 20.4, vol: 0.35 },
  { file: 'low.wav', at: 21.6, vol: 0.4 },
  { file: 'buzz.wav', at: 22.65, vol: 0.7 },
  { file: 'charge.wav', at: CHARGE_AT, vol: 0.75 },
  { file: 'pop.wav', at: UP_AT + 0.02, vol: 0.3 },
  { file: 'tamb.wav', at: KARAOKE_AT, vol: 0.35 },
  { file: 'pop.wav', at: END_AT, vol: 0.25 },
  { file: 'thud.wav', at: 28.6, vol: 0.6 },
  { file: 'low.wav', at: 28.68, vol: 0.45 },
  { file: 'drain.wav', at: 28.62, vol: 0.45 },
  { file: 'class.wav', at: 28.65, vol: 0.3 },
];
