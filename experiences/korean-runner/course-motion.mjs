// 바람길의 좌표 기준 하나(2026-10-05 뒤로 달리던 오류의 수정을 옮김 — 어디서 옮겼는지는 README 「좌표 기준」).
// 쫓아가는 카메라는 -Z를 바라보고, 몽글도 -Z(길 앞)를 바라본다. 길·풍경·부탁 표시는 달린 거리만큼 +Z(카메라 쪽)로 지나간다.
// 예전에는 몽글 얼굴이 카메라를 보거나, 길·마을은 -Z로 물러나는데 장애물은 +Z로 다가와 서로 반대로 흘렀다.
// world.mjs는 모든 움직임을 여기 함수로만 놓는다(시험: course-motion.test.mjs).

// 풍경 한 칸(scenery.mjs TILE)은 자기 자리에서 뒤(-Z)로 25m까지 뻗는다. 그 마지막 조각이 가장 뒤에 선 카메라(휴대폰 Z≈13.5)를
// 지나간 뒤에야 칸을 통째로 앞으로 옮긴다(41 − 25 = 16 > 13.5).
export const SCENERY_RECYCLE_Z = 41;

/** 되풀이되는 것(풍경 칸)의 Z. 달린 거리가 늘면 +Z로 다가오고, nearZ를 넘으면 length만큼 앞으로 돌아간다. */
export function loopedWorldZ(base, distance, length, nearZ = 16, offset = 0) {
  const phase = ((base - distance) % length + length) % length;
  return nearZ - phase + offset;
}

/** 한 번 지나가는 것(장애물·표시선)의 Z. 몽글(playerZ)에 닿는 순간이 그 거리를 지나는 순간이다. */
export function eventWorldZ(eventDistance, distance, playerZ = 3) {
  return playerZ - (eventDistance - distance);
}

/** 몽글 몸의 Y 회전. 눈이 있는 로컬 +Z가 π 돌아 -Z(길 앞)를 본다. 옆 길로 옮기는 동안만 그쪽으로 조금(최대 0.35) 돌아본다. */
export function runnerYaw(lateralDelta, sway = 0) {
  const steering = Math.max(-0.35, Math.min(0.35, lateralDelta * 0.22));
  return Math.PI - steering + sway;
}

/** 그 회전에서 몽글이 바라보는 방향(로컬 +Z를 Y축으로 yaw만큼 돌린 것). */
export function forwardForYaw(yaw) {
  return { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
}

/**
 * 바닥 결(펠트 사진)을 길과 같이 흘린다. 바닥 판은 -π/2 눕혀 텍스처 v가 -Z 쪽으로 커진다. 펠트 한 장이 metersPerRepeat(m)를 덮으면
 * offset.y를 거리/metersPerRepeat만큼 키워야 결이 달린 만큼 +Z로 온다. 오래 달려도 소수점이 흐려지지 않게 0~1 안에서 돈다.
 */
export function groundOffset(distance, metersPerRepeat) {
  const turns = distance / metersPerRepeat;
  return turns - Math.floor(turns);
}

/** 눕힌 바닥 판(가운데 centerZ, 길이 length, 결 repeat번)에서 텍스처 좌표 t가 놓이는 Z — 시험과 확인(?qa)에서 흐름을 잰다. */
export function texelWorldZ(t, offset, { repeat, length, centerZ }) {
  const v = (t - offset) / repeat;          // three.js: uv' = uv·repeat + offset
  return centerZ + (0.5 - v) * length;      // v=0은 판의 +Z 끝, v=1은 -Z 끝
}
