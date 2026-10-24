// 시간표(초). 소리 없는 화면 글 편이라 한 줄을 2초 넘게 보이게 둔다(몽골 조사 「자막 2초 이상」), 화면은 2~3초마다 바뀐다.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  count: 1.8, // 3 · 2 · 1(스스로 읽어 보는 3초)
  wrong: 4.8, // 「이렇게 읽었나요?」 십이천 원 ✗
  rule: 7.0, // 10,000 = 만
  split: 8.4, // 영수증 숫자를 만 자리에서 끊어 만 | 이천
  answer: 10.6, // 만 이천 원 · 읽는 법 · 뜻 ✓
  end: 14.0, // 영수증이 15,000원으로 바뀌고 「이제 네 차례」
  total: 18.0,
};

export const TOTAL_FRAMES = fr(T.total);
