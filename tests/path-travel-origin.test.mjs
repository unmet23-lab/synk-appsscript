import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN_BOUNDS, originPoint, originPosition, createMapOrigin } from '../experiences/path-travel/planner-origin.mjs';
import { createTravelMemory, validateTravelMemory } from '../experiences/path-travel/planner-storage.mjs';
test('지도 좌표와 실제 출발 좌표는 경계와 중심에서 왕복한다', () => {
  for (const [x, y] of [[0, 0], [1, 1], [.5, .5], [.22, .71]]) {
    const p = originPoint(x, y), back = originPosition(p);
    assert.ok(Math.abs(back.x - x) < .00002); assert.ok(Math.abs(back.y - y) < .00002);
  }
  assert.equal(originPoint(0, 0).lat, ORIGIN_BOUNDS[2]);
  for (const point of [[NaN, 0], [0, 1.1], [-.1, 0]]) assert.throws(() => originPoint(...point));
  assert.throws(() => createMapOrigin({lat: 37.6, lon: 126.98}), /종로/);
});
test('서로 다른 지도 출발점은 별도 ID를 가지며 여행 파일에서 보존된다', () => {
  const one = createMapOrigin(originPoint(.4, .5), ' 숙소 정문 '), two = createMapOrigin(originPoint(.41, .5));
  assert.notEqual(one.id, two.id); assert.equal(one.name, '숙소 정문');
  const memory = createTravelMemory(); memory.query.origin = one;
  assert.deepEqual(validateTravelMemory(memory).query.origin, one);
  assert.throws(() => createMapOrigin(originPoint(.5, .5), '가'.repeat(161)), /160/);
});
