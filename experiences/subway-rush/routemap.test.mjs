// 아래 역 지도(routemap.mjs): 갈래 끝 · 이름 칸이 누름 칸(아래 28% · 폭 ⅓)과 맞고, 결정마다 갈래 모양이 뜻대로인지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMap, labelHtml, MAP } from './routemap.mjs';

const DOORS = [{ id: 'left', text: '왼쪽 문', arrow: 'left' }, { id: 'stay', text: '그대로', arrow: 'stay' }, { id: 'right', text: '오른쪽 문', arrow: 'right' }];
const FORK = [{ id: 'out', text: '나가는 곳' }, { id: 'way', line: 1, color: '#0052A4', text: '서울역 방면' }, { id: 'other', line: 1, color: '#0052A4', text: '청량리 방면' }];
const EXIT = [{ id: 'e3', exit: 3 }, { id: 'e4', exit: 4 }, { id: 'e5', exit: 5 }];
const BOARD = [{ id: 'board', text: '이 열차 타기', arrow: 'stay' }, { id: 'wait', text: '다음 열차 기다리기', arrow: 'left' }, { id: 'opposite', text: '반대편 승강장 가기', arrow: 'right' }];

for (const [W, H] of [[390, 844], [430, 932], [520, 840]]) {
  for (const [kind, options] of [['door', DOORS], ['fork', FORK], ['exit', EXIT], ['board', BOARD]]) {
    test(`${kind} ${W}×${H}: 이름 칸 · 갈래 끝이 누름 칸 안, 칸마다 하나`, () => {
      const L = layoutMap(kind, options, W, H);
      assert.equal(L.ways.length, 3);
      L.ways.forEach((w, i) => {
        const [lx, ly] = w.label, third = [0, W / 3, (2 * W) / 3][i];
        assert.ok(lx >= third && lx <= third + W / 3, `${kind} ${i}: 이름 가로 ${lx}`);
        assert.ok(ly > H * 0.72 && ly < H, `${kind} ${i}: 이름 세로 ${ly} — 누름 칸 안`);
        assert.ok(w.to[1] > H * 0.72, `${kind} ${i}: 점이 달려갈 끝이 누름 칸 안`);
      });
      assert.ok(L.ty > H * MAP.top && L.ty < H * 0.95, '노선 줄은 누름 칸 아래쪽');
    });
  }
}

test('문: 왼쪽 · 오른쪽 갈래는 화면 밖(문)으로 가고, 가운데는 위로 간다', () => {
  const L = layoutMap('door', DOORS, 390, 844);
  assert.equal(L.ways[0].head.dir, 'left'); assert.equal(L.ways[2].head.dir, 'right'); assert.equal(L.ways[1].head.dir, 'up');
  assert.match(L.ways[0].d, /L10,/); assert.match(L.ways[2].d, /L380,/);   // 화면 가장자리(문)까지 — 꺾쇠가 가장자리에 걸린다
});

test('통로 · 출구: 세 갈래 모두 앞(위)으로, 승강장 「기다리기」는 멈춤 막대', () => {
  for (const [kind, o] of [['fork', FORK], ['exit', EXIT]]) assert.deepEqual(layoutMap(kind, o, 390, 844).ways.map((w) => w.head.dir), ['up', 'up', 'up']);
  assert.deepEqual(layoutMap('board', BOARD, 390, 844).ways.map((w) => w.head.dir), ['left', 'stop', 'right']);
});

test('이름 칸 글: 문은 한글 + 영문, 통로는 노선 동그라미, 출구는 노란 번호, 글은 이스케이프', () => {
  assert.match(labelHtml('door', DOORS[0]), /왼쪽 문<\/b><span class="rm-en">Left door/);
  assert.match(labelHtml('fork', FORK[1]), /rm-line" style="--c:#0052A4">1<\/span>서울역 방면/);
  assert.match(labelHtml('exit', EXIT[0]), /rm-exit">3<\/span>번 출구/);
  assert.doesNotMatch(labelHtml('door', { id: 'x', text: '<b>' }), /<b><\/b>|<b>&/);
});
