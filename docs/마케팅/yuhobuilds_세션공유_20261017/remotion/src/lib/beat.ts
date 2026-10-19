// 박자 격자. 시험판 배경음은 SHIFT 편 곡 「Building Momentum」(Gemini Ultra · Lyria 3.5, 2026-10-17)을 빌렸다.
// 실측(SHIFT 콘티): 122.863 BPM, 첫 박 0.054초, 드럼이 빠지는 마디 5.91초(12박), 다시 터지는 박 7.87초(16박).
export const FPS = 30;
export const BPM = 122.863;
export const BEAT_SEC = 60 / BPM;
export const FIRST_BEAT_SEC = 0.054;

/** k번째 박의 프레임(반올림). 반 박은 k에 .5를 준다. */
export const beat = (k: number) => Math.round((FIRST_BEAT_SEC + k * BEAT_SEC) * FPS);
