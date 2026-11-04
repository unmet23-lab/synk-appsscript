// 말 랠리 — WORLD 캠퍼스 판의 상대 명단(2026-11-04 유호님 「난이도마다 상대 캐릭터가 바뀌었으면 · 남자가 할 때는 여자 상대, 여자가 할 때는 남자 상대 · 스토리에 나오는 등장인물을 난이도마다 · 캐릭터가 추가될 때마다 추가」).
// 인물 한 명 = 이 표 한 줄 + 폴더 assets/world/cast/<id>/(plates · clips · voice · lobby.webp · result.webp). 만드는 법은 qa/world-campus-20261104/README.md 「상대 추가」.
// 탁구장 사진 · 3D 카메라는 모두 같다: 새 인물의 판은 같은 기준 판에서 사람만 바꿔 구워 탁구대가 같은 자리에 있다(world-scene.mjs).
// 학습 기록 · 문항 · 판정은 상대와 상관없다 — 보이고 들리는 것만 바뀐다.

export const CAST = Object.freeze([
  // 태오: 드라마 1화 선배(얼굴 기준 F1, 목소리는 드라마 1화 배역 그대로 — 결정 10-30 · 11-02). 지금은 한 사람이라 모든 난이도 · 모든 학생의 상대다.
  // clips: 영상에서 라켓이 공에 닿는 시각(초), reach: 그때 라켓 자리(칸 1 · 2 · 3, 3D), serveAt: 공 띄워 칠 때 공을 친 자리 — 모두 qa/.../움직임맞추기.py가 잰다.
  Object.freeze({ id: 'taeo', name: '태오', title: '선배', gender: 'm', levels: Object.freeze([1, 2]),
    clips: Object.freeze({ hitL: 0.52, hitC: 0.57, hitR: 0.79, serve: 0.97 }),
    reach: Object.freeze([{ x: -0.78, y: 0.165 }, { x: 0.03, y: 0.37 }, { x: 0.77, y: 0.93 }]),
    serveAt: Object.freeze({ x: 0.016, y: 0.393 }) }),
]);

/** 학생 성별: 드라마 1화 「부르는 말」(형 · 누나 / 오빠 · 언니 / 선배, 제2의 나 설계 2절)이 앱에 들어오면 그 답에서 읽는다. 아직 없어서, 또 「선배」로 답한 학생은 null — 성별로 나누지 않는다. */
export const readPlayerGender = () => null;

/** 난이도(1 쉬운 말 · 2 조금 어려운 말)와 학생 성별로 상대를 고른다: 그 난이도의 반대 성별 → 그 난이도 누구나 → 명단 첫 사람. 엄격하게 막지 않는다. */
export function pickOpponent({ level = 1, playerGender = null } = {}, cast = CAST) {
  const fit = cast.filter((c) => c.levels.includes(level));
  const opposite = playerGender ? fit.find((c) => c.gender !== playerGender) : null;
  return opposite || fit[0] || cast[0];
}

export const castDir = (c) => `assets/world/cast/${c.id}`;

/** 이번 판의 상대. 지금은 앱에 난이도 고르기가 없어 1이다(난이도가 생기면 그 값을 넘긴다). */
export const OPPONENT = pickOpponent({ level: 1, playerGender: readPlayerGender() });
