// BGM 박자 격자. public/bgm.mp3(Joyful Happy Upbeat) 실측: 129.82 BPM, 첫 박 0.150초, 킥은 짝수 박.
// 컷·등장·효과음을 이 격자에 붙이면 화면이 음악에 맞아 떨어진다.
export const FPS = 30;
export const BPM = 129.82;
export const BEAT_SEC = 60 / BPM;
export const FIRST_BEAT_SEC = 0.15;

/** k번째 박의 프레임(반올림). 반 박은 k에 .5를 준다. */
export const beat = (k: number) => Math.round((FIRST_BEAT_SEC + k * BEAT_SEC) * FPS);
/** 박 수만큼의 길이(프레임). */
export const beats = (n: number) => Math.round(n * BEAT_SEC * FPS);
