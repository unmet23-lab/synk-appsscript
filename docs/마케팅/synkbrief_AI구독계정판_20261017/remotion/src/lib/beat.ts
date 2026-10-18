// 박자 격자. 아직 배경음을 고르기 전이라 S16처럼 120 BPM으로 짜 두고, 곡을 고르면 실측 BPM·첫 박으로 바꾼다.
export const FPS = 30;
export const BPM = 120;
export const BEAT_SEC = 60 / BPM;
export const FIRST_BEAT_SEC = 0;

/** k번째 박의 프레임(반올림). 반 박은 k에 .5를 준다. */
export const beat = (k: number) => Math.round((FIRST_BEAT_SEC + k * BEAT_SEC) * FPS);
/** 박 수만큼의 길이(프레임). */
export const beats = (n: number) => Math.round(n * BEAT_SEC * FPS);
