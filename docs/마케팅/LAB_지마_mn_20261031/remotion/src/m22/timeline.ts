// 시간표(초). 원본 RqduGlTXlV8(27.8초 · 「-지 마」 열여섯 마디가 약 1.75초마다 바뀌고 끝 넷이 울지 마 · 걱정하지 마 · 포기하지 마로 정서가 뒤집힘)의
// 「잔소리처럼 되풀이하다 끝에서 마음으로 뒤집힘」을 옮긴다 — 화면 글 세 줄을 읽을 시간이 필요해 마디 수 · 박자는 오마주.json 「다르게」.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

export const T = {
  total: 20.6,
  scold: [1.6, 3.7, 5.8], // 먹지 마 · 자지 마 · 보지 마
  rule: 7.7, // -지 마 = битгий
  dusk: 9.3, // 저녁 — 코트 · 가방의 바리스타, 눈물 맺힌 몽글
  go: 10.6, // 가지 마…
  pat: 12.8, // 울지 마.
  end: 15.2, // 밤 — 혼자 남은 몽글과 케이크, 창밖으로 멀어지는 사람
  eat: 15.6, // 먹어.
  bite: 17.7, // 몽글이 울면서 한 입(v2 볼 이유 심사 — 표로 끊지 않고 그림으로 끝낸다)
} as const;

export const TOTAL_FRAMES = fr(T.total);
