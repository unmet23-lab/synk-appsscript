// 박자 격자. 배경음 「Building Momentum」(Gemini Ultra · Lyria 3.5, 2026-10-17, docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3) 실측:
// 122.863 BPM, 첫 박 0.054초, 마디 첫 박 = 첫 박 + 4k박. 드럼이 빠지는 마디 5.91·37.17초, 조용한 구간 23.49~31.31초,
// 다시 터지는 박 7.87(16박)·31.31(64박)·39.12(80박)초, 끝맺음 52.80초(108박)부터.
export const FPS = 30;
export const BPM = 122.863;
export const BEAT_SEC = 60 / BPM;
export const FIRST_BEAT_SEC = 0.054;

/** k번째 박의 프레임(반올림). 반 박은 k에 .5를 준다. */
export const beat = (k: number) => Math.round((FIRST_BEAT_SEC + k * BEAT_SEC) * FPS);
/** 박 수만큼의 길이(프레임). */
export const beats = (n: number) => Math.round(n * BEAT_SEC * FPS);
