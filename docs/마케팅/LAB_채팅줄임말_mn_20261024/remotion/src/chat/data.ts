// LAB 몽골 M2 「한국 친구와 채팅할 때」 화면 글 정본. 몽골어는 세 겹 검수(../검문/)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы, 「아는 단어 총동원」 data.ts와 같음).

export type Item = {
  bubble: string; // 친구가 보낸 말
  syl: string[]; // 원래 낱말(음절)
  init: (string | null)[]; // 음절마다 첫 글자(줄임말에 안 쓰인 음절은 null)
  read: string; // 키릴 읽는 법
  mean: string; // 몽골 뜻
};

export const MN = {
  band: 'Солонгос найзтайгаа чатлахдаа',
  hook: 'Найз чинь юу гэсэн бол?',
  rule: 'Товчлохдоо үе бүрийн эхний үсгийг л бичдэг',
  endQ: 'Өөр ямар товчлол мэддэг вэ?',
  endC: 'Сэтгэгдэлд бичээрэй',
  endS: 'Солонгос хэл сурч байгаа найздаа явуулаарай',
  friend: '민지',
};

// ㅇㅋ(오케이)는 「이」가 빠져 「음절마다」 규칙과 어긋나 풀이에서 뺐다(Fable 1차 P1 · 이해 시험 1 · 2차). 끝 맞히기 「ㅇㅋ = ?」도 답이 없어 허전하다는 말이 두 번 나와 열린 질문으로 바꿨다 — ㅇㅋ는 캡션에만.
export const ITEMS: Item[] = [
  { bubble: 'ㅋㅋ', syl: ['크', '크'], init: ['ㅋ', 'ㅋ'], read: 'кы кы', mean: 'Хаха (инээж байна)' },
  { bubble: 'ㅇㅇ', syl: ['응', '응'], init: ['ㅇ', 'ㅇ'], read: 'ын ын', mean: 'Тийм тийм' },
  { bubble: 'ㄱㅅ', syl: ['감', '사'], init: ['ㄱ', 'ㅅ'], read: 'гамса', mean: 'Баярлалаа' },
];

// 내가 보내는 말은 이모지만(시청자가 모를 한국어 낱말을 늘리지 않는다)
export type Msg = { from: 'me' | 'friend'; text: string; emoji?: boolean; at: number; typing?: number; item?: number };
