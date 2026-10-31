// LAB 몽골 M22 「-지 마」 화면 글 정본. 몽골어는 세 겹 검수(../검문/화면글.txt)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н, 「아는 단어 총동원」 data.ts와 같음).
export const TEXT = {
  hook: 'Тэр надад үргэлж ингэж хэлдэг байсан…',
  rule: 'битгий',
  last: 'Түүний ажлын сүүлчийн өдөр…',
};

// tip = 말풍선 꼬리 끝(화면 1080×1920 좌표)
export type Line = { ko: string; read: string; mn: string; vo: string; left: number; width: number; tip: [number, number] };
export const LINES: Line[] = [
  { ko: '먹지 마!', read: 'мөгжи ма', mn: 'Битгий ид!', vo: 'm1', left: 60, width: 640, tip: [650, 700] },
  { ko: '눕지 마!', read: 'нубжи ма', mn: 'Битгий хэвт!', vo: 'm2', left: 60, width: 640, tip: [620, 700] },
  { ko: '열지 마!', read: 'ёлжи ма', mn: 'Битгий нээ!', vo: 'm3', left: 60, width: 640, tip: [430, 610] },
  { ko: '가지 마…', read: 'гажи ма', mn: 'Битгий яв…', vo: 'm4', left: 60, width: 640, tip: [320, 690] },
  { ko: '울지 마.', read: 'улжи ма', mn: 'Битгий уйл.', vo: 'm5', left: 50, width: 450, tip: [560, 660] },
  { ko: '먹어.', read: 'мөгө', mn: 'Идээрэй.', vo: 'm6', left: 430, width: 480, tip: [0, 0] },
];
