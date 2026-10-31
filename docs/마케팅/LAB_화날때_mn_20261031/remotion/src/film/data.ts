// LAB 몽골 M1 「화날 때 네 마디」 화면 글 정본. 몽골어는 세 겹 검수(../../../검문/화면글.txt)를 거친 글만 둔다.
// 원본 Yerok 「When you're angry!」(sxujuQNn7rY · 33.9초)의 뼈대 — 머리 글 → 표현 넷을 차례로 → 끝. 진행자 대신 몽글의 나쁜 하루(상황 칸 + 표현 칸 넷)로.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н). 소리는 소진(세기 1.0) · 효과음은 직접 합성(../../소리.py).
export const FPS = 30;
export const TOTAL = 28.6;

export type Bubble = {
  n: number; // 1~4
  ko: string;
  read: string;
  mn: string;
  gauge: number; // 이 칸에서 차오르는 화 게이지(0~1)
  side: 'left' | 'right'; // 말풍선이 붙는 쪽
  bottom: number; // 말풍선 아래 끝(px)
  width: number;
  tip: [number, number]; // 꼬리 끝
};

export type Cell = {
  at: number;
  img: string;
  x?: number; // 그림 왼쪽 자리(기본 -100)
  sit?: string; // 상황 칸의 몽골어 한 줄
  next?: { at: number; img: string }; // 칸 안에서 그림이 한 번 더 바뀌는 때(김밥 뺏긴 뒤 얼굴)
  bubble?: Bubble;
  tremble?: boolean; // 화가 나서 화면이 떨림
  vo?: { id: string; at: number }[];
};

export const TEXT = {
  hook: 'Уурласан үедээ\nхэлэх 4 хэллэг',
  gauge: 'УУР',
  endKo: '네, 사장님~',
  endRead: 'нэ, сажанним',
  endMn: 'За, дарга аа~',
  end1: 'Ахмад хүний өмнө —',
  end2: 'дотроо л бодоорой!',
};

export const CELLS: Cell[] = [
  { at: 0.0, img: 'hook.jpg', tremble: true },
  { at: 3.2, img: 'bus1.jpg', sit: 'Автобус яг нүдэн дээр минь явчихлаа…' },
  {
    at: 5.0, img: 'bus2.jpg', tremble: false, vo: [{ id: 'a1', at: 5.12 }, { id: 'a1', at: 6.5 }],
    bubble: { n: 1, ko: '짜증 나!', read: 'жажын на', mn: 'Ямар бухимдмаар юм бэ!', gauge: 0.25, side: 'right', bottom: 620, width: 700, tip: [560, 700] },
  },
  { at: 7.7, img: 'kim1.jpg', next: { at: 8.6, img: 'kim2.jpg' }, sit: 'Сүүлчийн кимбабыг өөр хүн авчихлаа…' },
  {
    at: 9.6, img: 'kettle.jpg', tremble: true, vo: [{ id: 'a2', at: 9.72 }, { id: 'a2', at: 11.1 }],
    bubble: { n: 2, ko: '열받아!', read: 'ёлбада', mn: 'Дотор минь\nбуцалж байна!', gauge: 0.5, side: 'right', bottom: 590, width: 430, tip: [760, 740] },
  },
  { at: 12.5, img: 'fr1.jpg', sit: 'Надаас мөнгө зээлсэн найз\nшинэ гутал авчихсан байна…' },
  {
    at: 14.4, img: 'soul.jpg', vo: [{ id: 'a3', at: 14.52 }, { id: 'a3', at: 16.0 }],
    bubble: { n: 3, ko: '어이없어…', read: 'өи өбсө', mn: 'Хэлэх үг олдохгүй байна…', gauge: 0.75, side: 'left', bottom: 640, width: 720, tip: [470, 870] },
  },
  { at: 17.5, img: 'cafe1.jpg', sit: 'Аягыг би хагалаагүй шүү дээ…' },
  {
    at: 19.4, img: 'cafe2.jpg', tremble: true, vo: [{ id: 'a4', at: 19.52 }, { id: 'a4', at: 21.0 }],
    bubble: { n: 4, ko: '억울해!', read: 'өгурэ', mn: 'Ямар гомдмоор юм бэ!', gauge: 1, side: 'right', bottom: 620, width: 700, tip: [470, 676] },
  },
  { at: 22.5, img: 'end.jpg', x: -180, vo: [{ id: 'a5', at: 22.7 }], next: { at: 26.9, img: 'end2.jpg' } },
];

// 끝 칸 — 겉말 뒤 속으로 터지는 소리, 그다음 맺음 줄 · 26.9초 사장이 돌아서자 고양이가 컵을 또 민다(볼 이유 심사 v5 「교훈 자막만 얹혀 웃음이 식는다」)
export const END_LINE_AT = 25.3; // 원본 끝 자리(32.5초)를 길이에 맞춘 초 — 이때 화면이 화산 쪽으로 당겨진다
export const INNER_VO = { id: 'a4in', at: 23.75 };

// 배경음 — public/bgm.wav는 보유곡 따뜻_118(docs/홍보물/BGM, 몽글 릴 곡)의 앞 29초다. 없을 때는 말 사이가 완전 무음이라 올리기 전 검사 ⑰에 걸렸다(10-31)
export const BGM_VOL = 0.22;
export const BGM_DUCK = 0.5; // 배울 말이 나오는 동안 −6dB
export const VO_LEN: Record<string, number> = { a1: 0.71, a2: 0.95, a3: 1.03, a4: 1.24, a5: 1.03, a4in: 1.3 };

export const SFX: { file: string; at: number; vol: number }[] = [
  { file: 'boil.wav', at: 0.0, vol: 0.7 },
  { file: 'engine.wav', at: 3.2, vol: 0.8 },
  { file: 'splash.wav', at: 4.92, vol: 1 },
  { file: 'tok.wav', at: 8.6, vol: 0.9 },
  { file: 'whistle.wav', at: 9.6, vol: 0.32 },
  { file: 'pop.wav', at: 12.6, vol: 0.7 },
  { file: 'wind.wav', at: 14.4, vol: 0.5 },
  { file: 'crash.wav', at: 17.5, vol: 0.9 },
  { file: 'sting.wav', at: 22.5, vol: 0.6 },
  { file: 'boom.wav', at: 23.7, vol: 0.7 },
  { file: 'crash.wav', at: 27.5, vol: 1 },
];
