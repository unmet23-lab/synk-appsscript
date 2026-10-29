// 박자 격자. 배경음 「밝은_052」(docs/홍보물/BGM/밝은_052.wav, 회사 보유 곡 · LAB 「처음 쓰는 ㄹ」 · 「댓글 이름 한글로」에서 씀) 실측:
// 95.45 BPM, 첫 박 0.553초(GPTs·젬 편 10-17 실측, 곡 처음부터). 한 박 0.6286초 = 약 18.9프레임.
export const FPS = 30;
export const BPM = 95.45;
export const BEAT_SEC = 60 / BPM;
export const FIRST_BEAT_SEC = 0.553;

/** k번째 박의 프레임(반올림). */
export const beat = (k: number) => Math.round((FIRST_BEAT_SEC + k * BEAT_SEC) * FPS);
/** 박 수만큼의 길이(프레임). */
export const beats = (n: number) => Math.round(n * BEAT_SEC * FPS);
