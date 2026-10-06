import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from './vendor/three.module.js';
import { LANES, RunnerModel } from './core.mjs';
import { loopedWorldZ, eventWorldZ, runnerYaw, forwardForYaw, groundOffset, texelWorldZ, SCENERY_RECYCLE_Z } from './course-motion.mjs';
import { sceneryLayout, itemBounds, TILE, TILES, LOOP, TILE_EXTENT, CLEARANCE, VIEW } from './scenery.mjs';

// 바람길의 좌표 기준: 카메라와 몽글은 -Z를 보고, 길·풍경·표시선은 달린 만큼 +Z로 지나간다(2026-10-05 뒤로 달리던 오류의 수정을 옮김).
const close = (actual, expected, message, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} ≠ ${expected}`);

test('몽글의 얼굴(로컬 +Z)은 늘 길 앞(-Z)을 보고, 옆 길로 옮길 때는 실제로 움직이는 쪽으로 돌아본다', () => {
  close(runnerYaw(0), Math.PI, '곧게 달릴 때');
  for (const delta of [-100, -2.35, -0.5, 0, 0.5, 2.35, 100]) {
    const yaw = runnerYaw(delta), forward = new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
    assert.ok(forward.z < -0.9, `카메라(+Z) 쪽으로 돌아서지 않는다 (delta ${delta}, z ${forward.z})`);
    close(forwardForYaw(yaw).x, forward.x, '확인용 X가 실제 회전과 같다');
    close(forwardForYaw(yaw).z, forward.z, '확인용 Z가 실제 회전과 같다');
  }
  for (const action of ['left', 'right']) {
    const model = new RunnerModel({ seed: 1 }), before = model.x;
    model.input(action); model.step(0.016);
    const forward = forwardForYaw(runnerYaw(LANES[model.lane] - model.x));
    assert.ok((model.x - before) * forward.x > 0, `${action}: 몸이 도는 쪽과 움직이는 쪽이 같다`);
  }
});

test('길·풍경·표시선은 달린 거리만큼 +Z(카메라 쪽)로 지나가고, 표시선은 지나는 순간 몽글 자리에 있다', () => {
  const before = 31.5, advance = 2.25;
  for (const [base, length, near, offset] of [[0, LOOP, SCENERY_RECYCLE_Z, 0], [3 * TILE, LOOP, SCENERY_RECYCLE_Z, -12.5], [7 * TILE, LOOP, SCENERY_RECYCLE_Z, -24]]) {
    close(loopedWorldZ(base, before + advance, length, near, offset) - loopedWorldZ(base, before, length, near, offset), advance, '풍경이 다가온 거리');
  }
  close(eventWorldZ(90, before + advance) - eventWorldZ(90, before), advance, '표시선이 다가온 거리');
  close(eventWorldZ(90, 90, VIEW.playerZ), VIEW.playerZ, '지나는 순간 몽글 자리');
  assert.ok(eventWorldZ(90, 89) < VIEW.playerZ && eventWorldZ(90, 91) > VIEW.playerZ, '앞에 있는 것은 -Z, 지난 것은 카메라 쪽');
});

test('바닥 펠트 결도 같은 방향·같은 거리로 흐른다(실제 three.js 바닥 판과 텍스처 행렬로 잰다)', () => {
  // 눕힌 바닥 판: v가 커지는 쪽이 -Z인지 실제 꼭짓점으로 확인한다
  const length = 180, centerZ = -70, plane = new T.Mesh(new T.PlaneGeometry(10, length));
  plane.rotation.x = -Math.PI / 2; plane.position.z = centerZ; plane.updateMatrixWorld(true);
  const pos = plane.geometry.attributes.position, uv = plane.geometry.attributes.uv, v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(plane.matrixWorld);
    close(v.z, centerZ + (0.5 - uv.getY(i)) * length, `꼭짓점 ${i}의 Z와 v`, 1e-4);
  }
  // 텍스처 행렬(uv' = uv·repeat + offset)로 같은 결 한 점이 움직인 거리를 잰다
  const meters = 2.4, repeat = length / meters, texture = new T.Texture();
  for (const [d, step] of [[0, 1.7], [41.3, 2.25], [1e6 + 0.37, 0.8]]) {
    texture.repeat.set(1, repeat);
    texture.offset.set(0, groundOffset(d, meters)); texture.updateMatrix();
    const vAt = 0.62, t = new T.Vector3(0, vAt, 1).applyMatrix3(texture.matrix).y;   // 화면에서 그 자리의 결
    const z0 = texelWorldZ(t, texture.offset.y, { repeat, length, centerZ });
    close(z0, centerZ + (0.5 - vAt) * length, '행렬과 식이 같은 자리를 가리킨다', 1e-3);
    texture.offset.set(0, groundOffset(d + step, meters)); texture.updateMatrix();
    const z1 = texelWorldZ(t, texture.offset.y, { repeat, length, centerZ });
    // offset은 0~1로 감기므로 결 한 장(meters) 단위로는 같은 무늬다 → 한 장 안에서 잰다. 거꾸로 흐르면 meters−step이 나온다
    const moved = ((z1 - z0) % meters + meters) % meters;
    close(moved, step, `거리 ${d}에서 ${step}m 달리면 결도 +Z로 ${step}m`, 1e-3);
  }
});

test('되풀이되는 풍경 여덟 칸은 빈틈없이 이어지고, 이음매를 지날 때도 앞으로만 흐른다', () => {
  for (const distance of [0, 0.1, TILE - 0.001, TILE, LOOP - 0.001, LOOP, LOOP + 0.001, 1e6 + 0.125]) {
    const zs = Array.from({ length: TILES }, (_, i) => loopedWorldZ(i * TILE, distance, LOOP, SCENERY_RECYCLE_Z)).sort((a, b) => a - b);
    for (const z of zs) assert.ok(z > SCENERY_RECYCLE_Z - LOOP - 1e-6 && z <= SCENERY_RECYCLE_Z + 1e-6, `칸 자리 ${z}`);
    for (let i = 1; i < zs.length; i++) close(zs[i] - zs[i - 1], TILE, '칸 사이', 1e-5);
    close(loopedWorldZ(2 * TILE, distance + LOOP, LOOP, SCENERY_RECYCLE_Z), loopedWorldZ(2 * TILE, distance, LOOP, SCENERY_RECYCLE_Z), '한 바퀴 뒤 같은 자리', 1e-5);
  }
  const a = loopedWorldZ(TILE, TILE - 0.01, LOOP, SCENERY_RECYCLE_Z), b = loopedWorldZ(TILE, TILE + 0.01, LOOP, SCENERY_RECYCLE_Z);
  close(b + LOOP - a, 0.02, '이음매에서도 0.02m 앞으로', 1e-6);
});

test('마을 풍경은 길(세 칸 + 연석)에 들어오지 않고, 칸이 돌아갈 때 카메라 앞에서 사라지거나 안개 안쪽에서 생기지 않는다', () => {
  const items = sceneryLayout();
  assert.ok(items.length > TILES * 30, `물건 ${items.length}개`);
  assert.deepEqual([...new Set(items.map((x) => x.tile))].sort(), Array.from({ length: TILES }, (_, i) => i));
  for (const item of items) {
    const b = itemBounds(item);
    const outside = b.min[0] >= CLEARANCE.course || b.max[0] <= -CLEARANCE.course || b.min[1] >= CLEARANCE.overhead;
    assert.ok(outside, `${item.kind} ${item.p.map((n) => n.toFixed(2))}가 달리는 길에 들어옴 (x ${b.min[0].toFixed(2)}~${b.max[0].toFixed(2)})`);
    assert.ok(b.min[2] >= TILE_EXTENT.back && b.max[2] <= TILE_EXTENT.front, `${item.kind}가 칸 밖으로 나감 (z ${b.min[2].toFixed(2)}~${b.max[2].toFixed(2)})`);
    assert.ok(b.max[1] > 0.05, `${item.kind}가 땅 밑에 다 묻힘`);
  }
  // 칸이 통째로 앞으로 돌아가는 순간: 가장 뒤 조각까지 가장 뒤에 선 카메라를 지났다
  assert.ok(SCENERY_RECYCLE_Z + TILE_EXTENT.back > VIEW.cameraZMax, '사라지는 칸의 마지막 조각이 카메라 뒤');
  // 앞으로 돌아간 칸이 나타나는 곳은 안개가 다 덮은 곳(카메라에서 fogFar보다 멀다)
  const appear = SCENERY_RECYCLE_Z - LOOP + TILE_EXTENT.front;
  assert.ok(VIEW.cameraZMin - appear > VIEW.fogFar, `나타나는 자리 ${appear}가 안개 안쪽`);
  // 실제 흐름: 칸이 돌아가는 바로 그 순간 전후로 모든 물건을 놓아 보고, 사라진 것은 모두 카메라 뒤였는지 본다
  let recycled = 0;
  for (let tile = 0; tile < TILES; tile++) {
    const flip = tile * TILE;   // loopedWorldZ의 phase가 0이 되는(칸이 돌아가는) 거리
    const before = loopedWorldZ(tile * TILE, flip - 0.001 + LOOP, LOOP, SCENERY_RECYCLE_Z), after = loopedWorldZ(tile * TILE, flip + 0.001 + LOOP, LOOP, SCENERY_RECYCLE_Z);
    if (after < before) {
      recycled += 1;
      for (const item of items.filter((x) => x.tile === tile)) assert.ok(before + itemBounds(item).min[2] > VIEW.cameraZMax, `칸 ${tile}의 ${item.kind}가 카메라 앞에서 사라짐`);
    }
  }
  assert.equal(recycled, TILES, '여덟 칸 모두 한 번씩 이음매를 지난다');
});

test('world.mjs는 이 좌표 기준으로만 길·풍경·표시선·몽글을 놓는다', async () => {
  const src = await readFile(new URL('./world.mjs', import.meta.url), 'utf8');
  for (const name of ['loopedWorldZ', 'eventWorldZ', 'runnerYaw', 'groundOffset', 'SCENERY_RECYCLE_Z']) assert.ok(src.includes(name), `world.mjs가 ${name}를 쓴다`);
  assert.ok(!/\(\s*[\w.]*base\s*\+\s*distance\s*\)\s*%/.test(src), '옛 식(base+distance)%는 길을 뒤로 흘렸다');
});
