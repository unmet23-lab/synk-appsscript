// v6(10-30 다시 살림) 시간표(초). 원본 sJgXggLWheU 「Print vs. Cursive」(30.5초 · 0초부터 한 꼴로 한 낱말을 다 쓰고 20.1초에 물러나
// 그 아래 둘째 꼴을 쓴다)의 뼈대를 우리 길이로 줄였다 — 원본 20.1초 컷 = 우리 CUT(20.1 × 우리 길이 / 30.53).
// 목소리 시각은 public/vo/*.wav 길이(g1 1.85 · m1 1.30 · m2 1.21 · m3 0.59 · k2 0.51 · g3 1.59초)로 맞췄다.
// v5 → v6: 볼 이유 심사 「획을 처음부터 모자 · 얼굴로 부르고 동그라미가 끝나는 순간 웃는 얼굴이 되게」 — 두 시험관이 같이 짚은
// 「모자 쓴 두 사람이 무슨 뜻인지」 · 「번호」가 함께 풀리고, haiku 「번호 순서로 쓰는 틀」(E1과 같음)도 번호를 빼서 벗긴다.
// 컷 뒤(원본 둘째 꼴 자리)는 두 사람이 모자를 들어 인사하며 웃는다 — 끝까지 멈추지 않게 마지막에 한 번 더.
export const FPS = 30;
export const fr = (sec: number) => Math.round(sec * FPS);

const TOTAL = 15.0;
const CUT = Math.round(((20.1 * TOTAL) / 30.53) * 10) / 10; // 9.9

export const T = {
  total: TOTAL,
  cut: CUT,
  // 위 줄 — 영어 haha(연필, 0초부터 쓰는 중 · 훅) → 아래로 화살표
  g1: 0.12, // How do you write 'haha' in Korean?
  en: [0.0, 1.55] as const,
  arrow: [1.62, 1.98] as const,
  // 아래 줄 — 첫 하. 「모자」(짧은 줄 · 긴 줄 → 모자 몸통이 칠해짐) · 「얼굴」(동그라미 → 웃는 얼굴)
  m1: 2.05, // First, a hat.
  st1: [2.15, 2.55] as const,
  st2: [2.68, 3.25] as const,
  hat1: [3.28, 3.6] as const,
  m2: 3.55, // Then a face!
  st3: [3.62, 4.5] as const, // 12시에서 왼쪽으로
  face1: [4.52, 4.95] as const,
  m3: 5.1, // And 'a'.
  a1: [5.15, 5.5] as const, // ㅏ 세로
  a2: [5.58, 5.75] as const, // ㅏ 점
  // 둘째 하 — 빠르게, 끝나면 모자 · 얼굴이 함께
  s2: [5.95, 7.0] as const,
  hat2: [7.02, 7.3] as const,
  face2: [7.15, 7.55] as const,
  pencilOut: [7.05, 7.6] as const,
  // 영어 haha 네 글자가 내려와 ㅎ · ㅏ 밑에 앉는다(h = ㅎ · a = ㅏ)
  drop: [7.55, 8.65] as const,
  k2: 8.75, // 하하.
  laugh: 9.0, // 두 사람이 번갈아 들썩이기 시작(천천히 커짐)
  // 컷 — 원본 20.1초 자리. 하하로 다가가 두 사람이 모자를 들어 인사하며 웃는다
  tip1: [CUT + 0.15, CUT + 1.25] as const,
  bubble: CUT + 0.35, // 「하!」 말풍선 둘
  k2b: CUT + 0.4, // 하하. — 모자 인사와 같이
  g3: CUT + 1.55, // Now you can laugh in Korean.
  tip2: [TOTAL - 1.95, TOTAL - 0.8] as const, // 끝에서 한 번 더(멈춘 끝 화면이 되지 않게)
} as const;

export const TOTAL_FRAMES = fr(T.total);
