// LAB 몽골 M22 「-지 마」 정본 — 한국어 말풍선 · 목소리 · 말풍선 자리. 몽골어는 세 겹 검수(../검문/화면글.txt)를 거친 글만 판본/MN.json에 둔다.
// 11-10 판본 틀: 나라마다 다른 글(머리 글 · 읽는 법 · 뜻 · -지 마 표지판 · 마지막 날 띠 · 끝 카드 · 끝 질문)은 판본/<KEY>.json(판본.ts)에 있다(원본 동결).
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н, 「아는 단어 총동원」 data.ts와 같음) — 몽골판만 키릴, 다른 판은 로마자.

// tip = 말풍선 꼬리 끝(화면 1080×1920 좌표)
// 말풍선 여섯 — 판본 reads · means의 차례와 같다
export type Line = { ko: string; vo: string; left: number; width: number; tip: [number, number] };
export const LINES: Line[] = [
  { ko: '먹지 마!', vo: 'm1', left: 60, width: 640, tip: [650, 700] },
  { ko: '눕지 마!', vo: 'm2', left: 60, width: 640, tip: [620, 700] },
  { ko: '열지 마!', vo: 'm3', left: 60, width: 640, tip: [430, 610] },
  { ko: '가지 마…', vo: 'm4', left: 60, width: 640, tip: [320, 690] },
  { ko: '울지 마.', vo: 'm5', left: 50, width: 450, tip: [560, 660] },
  { ko: '먹어.', vo: 'm6', left: 430, width: 480, tip: [0, 0] },
];
