// 말 랠리 — WORLD 캠퍼스 판의 한 장면(2026-11-04): 동아리 탁구장 실사(1536×2752, 9:16)와 거기에 맞춘 3D 카메라 · 자리.
// camera는 qa/world-campus-20261104/장면맞추기.py가 사진의 탁구대 네 점(먼 쪽 두 모서리, 네트 자리의 양옆)에서 푼 값이다 — 점 오차 1.4px.
// 다섯 표정 판은 그 판(ready)에 맞춰 판맞추기.py가 다듬어 탁구대 · 네트가 같은 자리에 있다. 자리는 3D 좌표(탁구대 윗면 y = 0, 내 쪽 +z).
// 표정 판: 기다림 · 공 들고 말 걺 · 받아치며 말함 · 받아침 · 맞음(끄덕) · 빠른 대답 · 놓침 · 연달아 놓침(응원) · 스매시(3) · 긴 랠리(6) · 아주 긴 랠리(9) · 오래 기다림.
import { OPPONENT, castDir } from './world-cast.mjs';

const CAST_DIR = castDir(OPPONENT);   // 이번 판의 상대(world-cast.mjs)
const PLATE = (k) => `${CAST_DIR}/plates/${k}.webp`;
export const CAST_ART = Object.freeze({ lobby: `${CAST_DIR}/lobby.webp`, result: `${CAST_DIR}/result.webp`, ready: PLATE('ready') });
export const PLATES = Object.freeze(Object.fromEntries(['ready', 'talk', 'speak', 'return', 'nod', 'quick', 'miss', 'cheerup', 'cheer', 'wow', 'pump', 'wait'].map((k) => [k, PLATE(k)])));
// 움직임 영상: 좌 · 가운데 · 우로 움직여 치기 · 공 띄워 치기. contact = 라켓이 공에 닿는 시각(초, 움직임맞추기.py가 찍는다), 사진 위쪽 box만큼 덮는다(아래 탁구대는 사진 그대로)
export const CLIPS = Object.freeze(Object.fromEntries(Object.entries(OPPONENT.clips).map(([k, contact]) => [k, { src: `${CAST_DIR}/clips/${k}.mp4`, contact }])));
export const CLIP_BOX = Object.freeze({ top: 5 / 1290, height: 820 / 1290 });   // 영상 720×820이 놓이는 자리(사진 높이에 대한 몫): 영상 좌표 = 사진 좌표 × 0.46875 − (0, 5)
const PHOTO = Object.freeze({ w: 1536, h: 2752, farEdge: 1638 / 2752 });

export const SCENE = {
  photo: PHOTO,
  camera: { fov: 52.6337, position: [0.01082, 0.99083, 2.74413], quaternion: [-0.071115, 0.001304, -0.000672, 0.997467] },
  padZ: -0.82,                 // 대답 칸(먼 쪽 절반의 가운데)
  hit: { y: 0.2, z: 0.96 },    // 내 라켓이 공을 받는 자리: 대답 카드 바로 위에 보이는 높이(사진 y ≈ 2160)
  opp: { y: 0.12, z: -1.62 },  // 태오가 공을 치는 자리: 먼 끝 뒤, 탁구대 높이(말 걺 판의 라켓)
  serveX: OPPONENT.serveAt.x, serveY: OPPONENT.serveAt.y,   // 공 띄워 치기 영상에서 라켓이 공에 닿는 자리(마지막으로 보인 공의 자리) — 여기서 3D 공이 이어받는다
  contact: OPPONENT.reach,     // 받아칠 때 라켓이 공에 닿는 자리(칸 1 · 2 · 3)
  bounceZ: 0.45,
  /** 사진이 놓일 자리(px): 세로 화면은 천장을 잘라 태오를 키우고(폭은 탁구대 먼 모서리가 남을 만큼), 넓은 화면은 높이를 맞춰 가운데 — 양옆은 world-skin.css의 흐린 사진. */
  layout(W, H) {
    const a = PHOTO.w / PHOTO.h;
    if (W / H > 0.82) {
      const h = H * 1.2, w = h * a;
      return { x: (W - w) / 2, y: H - h, w, h, wide: true };
    }
    const h = Math.max(H, W / a) * 1.12, w = h * a;
    const y = Math.min(0, Math.max(H - h, H * 0.54 - h * PHOTO.farEdge));
    return { x: (W - w) / 2, y, w, h, wide: false };
  },
  onLayout: null,
};
