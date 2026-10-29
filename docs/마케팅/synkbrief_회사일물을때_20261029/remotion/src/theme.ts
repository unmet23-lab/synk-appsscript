// B16 무대: 흰 종이(키트 안쪽 장) 위에 실제 ChatGPT 어두운 화면을 얹는다. 청금석은 이름표 점 하나만(장부 「오마주 — 우리 색」).
// 지난 두 편(B14 청금석 면 · B2)과 무대를 다르게 하려고 색 면 대신 종이를 쓴다. 새 색을 들이지 않는다(kit.css 값).
import { KO, MONO } from './lib/fonts';

export const C = {
  paper: '#f6f4ef',
  paperShade: '#ebe7de',
  ink: '#0a0a0a',
  muted: '#5a5f66',
  hair: '#d9d4c8',
  lapis: '#3d6bc9',
  lapisDeep: '#24448c',
  mark: '#ffe07a',
  crayon: '#f96859',
  screen: '#0d0d0d',
  ok: '#1f9d55',
};

// cover916: 위 안전선 269, 아래 1428(키트), 좌우 84/160.
export const L = { W: 1080, H: 1920, X: 84, R: 160, SAFE_TOP: 269, SAFE_BOTTOM: 1428 + 180 };

export const F = { ko: KO, mono: MONO };
