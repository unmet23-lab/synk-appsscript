// LAB 몽골 M20 「4층 F」 화면 글 정본. 그림 · 소리는 영어 편 E19(LAB_사층F_20261031)를 나눠 쓴다(장부 관문 조건). 몽골어는 세 겹 검수(../../검문/화면글.txt)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н).
export const COUNT = [
  { ko: '일', read: 'ил', n: '1' },
  { ko: '이', read: 'и', n: '2' },
  { ko: '삼', read: 'сам', n: '3' },
  { ko: '사', read: 'са', n: '4' },
];

// 버튼 자리(그림 940×1672 좌표) — 아래 1부터 위 5까지
export const BTN = { x: 298, r: 112, y1: 1270, y2: 996, y3: 718, yF: 440, y5: 158 };

export const P = {
  font: "'Inter Tight', 'SUIT', sans-serif",
  hook: '4-р давхар хаана байна?',
  hookSize: 60,
  death: 'Үхэл ч бас',
  sameSound: 'Адилхан дуудагддаг!',
  floorA: '4-р давхар =',
  floorF: 'Сүнснүүдийн давхар',
  so: 'Тиймээс 4-ийн оронд F',
  soSub: 'F = Four (дөрөв)',
  soSize: 66,
  phew: 'Арай гэж зугтлаа…',
  phewSize: 62,
  whisper: 'са',
  lineH: 1.15,
};
export type LocPack = typeof P;
