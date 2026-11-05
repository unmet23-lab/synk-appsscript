// 시간표(초). 원본 sQ0YrQ-F4ww(28.8초 · 박자 1.8 · 4.1 · 5.9 · 7.9 · 10.1 · 12.3 · 14.6 · 17.0 · 19.4 · 26.1)의 자리를 따른다.
// 원본은 두 사람이 영어 ↔ 한국어를 2초마다 잇는 목록이고, 우리는 그 박자에 한 낱말을 얻는 실수극을 얹는다(오마주.json 「다르게」).
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  total: 22.8,
  pass1: 1.8, // 직원이 그냥 지나간다
  um: 4.1, // 저… 저기… — 아무도 못 듣는다
  pass2: 4.9, // 화면 앞을 휙
  hi: 5.9, // 안녕하세요?
  bow: 6.4, // 직원이 깍듯이 인사만 하고
  left: 6.85, // 「He just says hi back」
  leave: 7.2, // 달려간다
  auntie: 7.9, // 옆자리 손님 「여기요!」
  rush0: 8.45, // 직원 셋이 달려온다
  auntie2: 9.25, // 옆자리 상에 도착(구운 판)
  word: 10.1, // 여기요 — yeo-gi-yo · 네 차례
  puff: 10.5, // 몸이 부푼다
  hush: 11.8, // 소리가 다 멎는다(0.5초)
  shout: 12.3, // 「여기요!」
  turn: 13.1, // 직원 셋이 동시에 돌아본다
  rush1: 13.6, // 달려온다
  arrive: 14.6, // 상이 차고 — 여기 = here · 요 = polite
  yo: 15.3,
  more1: 16.1, // 또 「여기요!」
  more2: 17.2, // 또 「여기요!」
  pile: 18.3, // 음식 산에 묻혔다
  whisper: 19.0, // …여기요
  rush2: 19.8, // 직원 셋이 또 달려온다
  end: 20.4, // 또 뭐 드릴까요?(구운 판 · 몽글 눈 질끈)
} as const;

export const TOTAL_FRAMES = fr(T.total);
