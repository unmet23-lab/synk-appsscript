// LAB 몽골 M19 「ах = 형 · 오빠」 화면 글 정본. 몽골어는 세 겹 검수(../검문/화면글.txt)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н, 「아는 단어 총동원」 data.ts와 같음).
export const TEXT = {
  hook: 'Ах эгчээ солонгосоор юу гэж дууддаг вэ?',
  reveal: 'Нэг ах — хоёр нэр!',
  colA: 'Ах',
  colB: 'Эгч',
  rowM: 'Та эрэгтэй бол',
  rowF: 'Та эмэгтэй бол',
  end: 'Хэн дуудахаас хамаарна!',
};

// bubble = 그 장면에서 부르는 아이 머리 위 말풍선 자리(그림 941×1672 좌표) · tail = 꼬리 방향(-1 왼쪽 아래 · 1 오른쪽 아래)
export type Scene = { img: string; ko: string; read: string; mn: string; vo: string; bubble: [number, number]; tail: -1 | 1; cam: [number, number] };
export const SCENES: Scene[] = [
  { img: 'img/hyeong.jpg', ko: '형', read: 'хён', mn: 'Эрэгтэй хүн ахаа ингэж дууддаг', vo: 'h1', bubble: [190, 700], tail: 1, cam: [400, 900] },
  { img: 'img/oppa.jpg', ko: '오빠', read: 'оппа', mn: 'Эмэгтэй хүн ахаа ингэж дууддаг', vo: 'o1', bubble: [250, 790], tail: 1, cam: [420, 950] },
  { img: 'img/nuna.jpg', ko: '누나', read: 'нуна', mn: 'Эрэгтэй хүн эгчээ ингэж дууддаг', vo: 'n1', bubble: [260, 650], tail: 1, cam: [500, 900] },
  { img: 'img/eonni.jpg', ko: '언니', read: 'өнни', mn: 'Эмэгтэй хүн эгчээ ингэж дууддаг', vo: 'e1', bubble: [660, 580], tail: -1, cam: [470, 950] },
];

// 핵심 장면(둘이) 말풍선 — 왼쪽 남동생 「형!」 · 오른쪽 여동생 「오빠!」
// oops = 6.6~8.6초 반응 컷(형 「나…?」 · 남동생 웃음 · 여동생 머쓱 — v3 볼 이유 심사), oopsGirl = 그 그림의 여동생 말풍선 자리
export const OOPS = { img: 'img/oops.jpg', girl: [700, 760] as [number, number], cam: [560, 900] as [number, number] };
export const KEY = { img: 'img/key.jpg', boy: [190, 740] as [number, number], girl: [720, 770] as [number, number], cam: [470, 820] as [number, number] };
// 끝 가족 사진 이름표 자리(그림 좌표) — 형(오빠) 머리 위 · 누나(언니) 머리 위
export const END = { img: 'img/family.jpg', cam: [470, 1000] as [number, number], ah: [615, 500] as [number, number], egch: [250, 540] as [number, number] };
