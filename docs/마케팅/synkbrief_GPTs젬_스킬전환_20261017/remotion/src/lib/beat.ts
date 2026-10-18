// BGM 박자 격자. public/bgm.wav(docs/홍보물/BGM/밝은_052.wav 앞 20초) 실측(.tmp/synkbrief-gpts-20261017/beat_grid.py):
// 95.45 BPM, 첫 박 0.553초. 선택 표시·도장·컷·커서 클릭을 이 격자에 붙인다(장부 S16의 박자 격자 방식).
export const FPS = 30;
export const BPM = 95.45;
export const BEAT_SEC = 60 / BPM;
export const FIRST_BEAT_SEC = 0.553;

/** k번째 박의 프레임(반올림). 반 박은 k에 .5를 준다. */
export const beat = (k: number) => Math.round((FIRST_BEAT_SEC + k * BEAT_SEC) * FPS);
