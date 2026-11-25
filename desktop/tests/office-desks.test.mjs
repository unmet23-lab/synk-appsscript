// 부서별 책상(docs/디자인/솔리오_사무실책상_20261125/README.md): 책상 수의 셈, 배치, 줄과 동작. 저장은 office-desks-store.test.cjs, 그림은 office-desks-floor.test.mjs가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { officeDeskPlan, officeDeskLine, officeReduce, officeState } from '../renderer/office-model.mjs';
import { floorLayout, floorSeatCount } from '../renderer/office-floor.mjs';
import { officeRoom, officeFloorScene, createOfficeRoom, OFFICE_TIMING, OFFICE_FINISHES } from '../renderer/office-room.mjs';

/* ── 셈 ── */
test('a department gets one more desk as soon as a staff member has no seat, and the text says so', () => {
  const at = (desk, n, seats = 2, o) => officeDeskPlan(desk, n, seats, o);
  assert.deepEqual([0, 1, 3, 4, 6, 7, 24, 25].map(n => at(null, n).desks), [1, 1, 1, 2, 2, 3, 8, 8]);
  assert.deepEqual([1, 2, 3, 4].map(size => [1, 4, 7, 24, 40].map(n => at({ size }, n).desks)), [[1, 4, 7, 24, 24], [1, 2, 4, 12, 12], [1, 2, 3, 8, 8], [1, 1, 2, 6, 6]]);
  // 고른 수는 가장 적은 수다. 직원이 더 많으면 넘어 늘어난다
  assert.deepEqual([0, 6, 7, 10].map(n => at({ count: 2 }, n).desks), [2, 2, 3, 4]);
  assert.deepEqual([0, 6, 7, 10].map(n => at({ count: 2 }, n).grown), [0, 0, 1, 2]);
  assert.equal(officeDeskLine(at(null, 2)), '3인 책상 하나');
  assert.equal(officeDeskLine(at(null, 7)), '3인 책상 셋 · 직원이 늘어 둘 더 놓음');
  assert.equal(officeDeskLine(at({ size: 4, count: 2 }, 9)), '4인 책상 셋 · 직원이 늘어 하나 더 놓음');
  // 직원이 떠난 뒤 들고 있는 동안에는 남는 책상을 곧 치운다고 쓴다(Fable 최종 F3)
  const kept = (desk, n, held) => officeDeskLine(officeDeskPlan(desk, n, 3, { held }));
  assert.deepEqual([kept(null, 2, 3), kept(null, 5, 3), kept(null, 7, 3), kept({ count: 2 }, 1, 2)], ['3인 책상 셋 · 빈 책상 둘은 잠시 뒤 치움', '3인 책상 셋 · 빈 책상 하나는 잠시 뒤 치움', '3인 책상 셋 · 직원이 늘어 둘 더 놓음', '3인 책상 둘']);
});
test('the one desk of a department shows seats by capacity as before; any other desk shows all its seats', () => {
  assert.deepEqual([[0, 1], [0, 3], [2, 1], [3, 1], [1, 2]].map(([n, seats]) => officeDeskPlan(null, n, seats).seats), [1, 3, 2, 3, 2]);
  assert.equal(officeDeskPlan(null, 4, 1).seats, 3);
  // 값으로 가른다: 다시 3인 · 하나를 고르면 고르지 않은 부서와 같다(설계 검토 P2-1)
  assert.equal(officeDeskPlan({ size: 3, count: 1 }, 1, 1).seats, 1);
  assert.equal(officeDeskPlan({ size: 2 }, 1, 1).seats, 2);
  assert.equal(officeDeskPlan({ count: 2 }, 0, 1).seats, 3);
});
test('a desk of a wrong shape counts as not chosen; held keeps desks, cap trims only the ones that grew by themselves', () => {
  for (const bad of [null, undefined, 'x', [], 7, { size: 0, count: 0 }, { size: 5, count: 7 }, { size: '2', count: '3' }, { size: 1.5, count: 2.5, finish: 'marble' }]) assert.deepEqual(officeDeskPlan(bad, 4, 2), { size: 3, base: 1, desks: 2, grown: 1, spare: 0, seats: 3, finish: null }, JSON.stringify(bad));
  assert.equal(officeDeskPlan({ finish: 'walnut' }, 1, 2).finish, 'walnut');
  assert.equal(officeDeskPlan(null, 2, 2, { held: 3 }).desks, 3);
  assert.equal(officeDeskPlan(null, 20, 2, { cap: 6 }).desks, 2);
  assert.equal(officeDeskPlan({ size: 4, count: 6 }, 2, 2, { cap: 6 }).desks, 6, 'the number the user chose stays');
  assert.equal(officeDeskPlan(null, 2, 2, { held: 99 }).desks, 8);
});

/* ── 배치 ── */
const staff = (n, zone, status = 'working') => Array.from({ length: n }, (_, i) => ({ id: `${zone}-${i}`, status: typeof status === 'function' ? status(i) : status, alert: false, subagents: 0, zone }));
const dept = (key, n, desk = {}, more = {}) => ({ key: 'd:' + key, kind: 'dept', name: key, desk, staff: staff(n, 'd:' + key), ...more });
const lobby = (n, status) => ({ key: 'lobby', kind: 'lobby', name: '부서 없는 일', staff: staff(n, 'lobby', status) });
const scene = (zones, seats = 3) => ({ seats, zones });
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('an office where nothing was chosen and no department has more than three staff keeps the places of 11-24', () => {
  // 11-24 C판의 좌표(옛 floorLayout): 부서 판 3.2 × 2.4, 사이 0.6, 셋씩 두 줄. 넷째 · 다섯째 부서는 첫 줄의 칸 왼쪽부터다(설계 검토 P1-3)
  for (let n = 1; n <= 6; n++) {
    const out = floorLayout(scene(Array.from({ length: n }, (_, i) => dept('k' + i, i % 4))), null, { w: 900, h: 500 });
    const cols = Math.min(3, n), rows = Math.ceil(n / cols);
    out.forEach((z, i) => {
      const cx = (i % cols - (cols - 1) / 2) * 3.8, cz = (Math.floor(i / cols) - (rows - 1) / 2) * 3;
      for (const [a, b] of [[z.rect.x0, cx - 1.6], [z.rect.x1, cx + 1.6], [z.rect.z0, cz - 1.2], [z.rect.z1, cz + 1.2]]) assert.ok(near(a, b), `${n} departments, number ${i}: ${a} is ${b}`);
      assert.deepEqual(z.spots.map(s => [+(s.x - cx).toFixed(6) + 0, +(s.z - cz).toFixed(6)]), [[-0.896, -0.18], [0, -0.18], [0.896, -0.18]]);
      assert.equal(z.wide, true);
    });
  }
  const [only] = floorLayout(scene([dept('a', 0)], 1));
  assert.deepEqual(only.spots.map(s => [s.x, +s.z.toFixed(6)]), [[0, -0.18]], 'one seat stands in the middle');
});
test('the fourth staff member turns the wide desk into two desks, and later desks join without moving the first ones of a column', () => {
  const at = n => floorLayout(scene([dept('mkt', n), dept('dev', 1)]), null, { w: 750, h: 231 })[0];
  assert.deepEqual([3, 4, 6, 7, 12].map(n => [at(n).desks.length, at(n).wide]), [[1, true], [2, false], [2, false], [3, false], [4, false]]);
  // 앉은 자리: 처음 본 차례로 첫 책상부터 찬다
  const seven = at(7);
  assert.deepEqual(seven.staff.map((s, i) => [s.id, seven.spots[i].desk]), [0, 1, 2, 3, 4, 5, 6].map(i => ['d:mkt-' + i, Math.floor(i / 3)]));
  for (const size of [1, 2, 3, 4]) {
    for (let n = 2; n <= 24; n++) {
      const box = { w: 900, h: 500 }, a = floorLayout(scene([dept('mkt', n, { size })]), null, box)[0], b = floorLayout(scene([dept('mkt', n + 1, { size })]), null, box)[0];
      const rows = z => z.desks.filter(q => near(q.x0, z.desks[0].x0)).length;
      if (rows(a) !== rows(b) || a.wide !== b.wide) continue;
      a.desks.forEach((q, k) => assert.ok(near(q.x0 - a.rect.x0, b.desks[k].x0 - b.rect.x0) && near(q.z0 - a.rect.z0, b.desks[k].z0 - b.rect.z0), `${size}인 ${n}: desk ${k} stays in its group`));
    }
  }
});
const overlap = (a, b) => a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.z0 < b.z1 - 1e-9 && b.z0 < a.z1 - 1e-9;
test('groups, desks, seats and names never overlap, at any size of office and window', () => {
  const boxes = [null, { w: 750, h: 231 }, { w: 750, h: 308 }, { w: 620, h: 126 }, { w: 380, h: 144 }, { w: 900, h: 500 }, { w: 400, h: 480 }];
  for (const box of boxes) for (let nd = 0; nd <= 7; nd++) for (const n of [0, 1, 3, 4, 9, 24, 30]) for (const size of [1, 2, 3, 4]) for (const lob of [0, 1, 8, 9, 33, 60]) {
    if (!nd && !lob) continue;
    const zones = Array.from({ length: Math.min(6, nd) }, (_, i) => dept('k' + i, i === 0 ? n : (n + i) % 7, { size: i % 2 ? (size % 4) + 1 : size, ...(i === 2 ? { count: 6 } : {}) }));
    if (lob) zones.push(lobby(lob, i => (i % 2 ? 'working' : 'quiet')));
    if (nd > 6) zones.push({ key: 'other', kind: 'other', name: '그 밖 하나', staff: staff(n, 'd:rest') });
    const out = floorLayout(scene(zones), null, box), where = JSON.stringify({ box, nd, n, size, lob });
    // 얕은 무리의 이름은 앞 바닥에 선다(0.48). 그 자리까지 구역으로 친다
    const area = z => ({ ...z.rect, x1: Math.max(z.rect.x1, z.rect.x0 + (z.slot || 0)), z1: z.rect.z1 + (z.kind === 'dept' && !z.wide ? 0.48 : 0) });
    out.forEach((z, i) => {
      for (const o of out.slice(i + 1)) assert.equal(overlap(area(z), area(o)), false, `${where}: ${z.key} and ${o.key}`);
      (z.desks || []).forEach((q, k) => {
        for (const o of z.desks.slice(k + 1)) assert.equal(overlap(q, o), false, `${where}: two desks of ${z.key}`);
        assert.ok(q.x0 >= z.rect.x0 - 1e-9 && q.x1 <= z.rect.x1 + 1e-9 && q.z0 >= z.rect.z0 - 1e-9 && q.z1 <= z.rect.z1 + 1e-9, `${where}: a desk stands in its group`);
      });
      z.spots.forEach((p, a) => {
        const q = z.desks ? z.desks[p.desk] : z.rect;
        assert.ok(p.x - 0.3 >= q.x0 - 1e-9 && p.x + 0.3 <= q.x1 + 1e-9 && p.z >= q.z0 && p.z + 0.3 <= q.z1 + 1e-9, `${where}: a seat of ${z.key} is on its own desk`);
        for (const o of z.spots.slice(a + 1)) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) > 0.85, `${where}: two seats of ${z.key}`);
      });
      assert.ok(z.staff.length <= z.spots.length && z.staff.length + z.hidden === zones.find(q => q.key === z.key).staff.length, where);
      assert.equal(new Set(z.staff.map(s => s.id)).size, z.staff.length, where);
    });
  }
});
test('rows line up on the left and at the back, so a growing department moves only what is to its right or in front', () => {
  const out = floorLayout(scene([dept('a', 9, { size: 1 }), dept('b', 2), dept('c', 12), dept('d', 1), dept('e', 5, { size: 2 })]), null, { w: 900, h: 500 });
  const by = Object.fromEntries(out.map(z => [z.key, z.rect]));
  assert.ok(near(by['d:a'].x0, by['d:d'].x0));
  assert.ok(near(by['d:a'].z0, by['d:b'].z0) && near(by['d:b'].z0, by['d:c'].z0) && near(by['d:d'].z0, by['d:e'].z0));
});
/* 그림판에 들어가는 크기(office-floor.mjs의 카메라 식) */
function scaleOf(out, box) {
  const yaw = -16 * Math.PI / 180, pitch = 47 * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw), ca = Math.cos(pitch), sa = Math.sin(pitch);
  let a = 1e9, b = -1e9, c = 1e9, e = -1e9;
  const take = (x, y, z) => { const xr = x * cy - z * sy, zr = x * sy + z * cy, d = zr * ca + y * sa, s = 1 / (1 - d * 0.028), px = xr * s, py = (zr * sa - y * ca) * s; a = Math.min(a, px); b = Math.max(b, px); c = Math.min(c, py); e = Math.max(e, py); };
  for (const z of out) for (const x of [z.rect.x0, Math.max(z.rect.x1, z.rect.x0 + (z.slot || 0))]) for (const zz of [z.rect.z0, z.rect.z1 + (z.wide ? 0 : 0.48)]) for (const y of [0, 1.05]) take(x, y, zz);
  return Math.min((box.w - 20) / (b - a), (box.h - 20) / (e - c), 120);
}
test('staff are never drawn as dots to fit more of them: past a 5.4 px radius the picture seats fewer, the strip first', () => {
  const big = [dept('a', 24), dept('b', 20), ...['c', 'd', 'e', 'f'].map(k => dept(k, 10)), lobby(60)];
  const boxes = [{ w: 900, h: 500 }, { w: 750, h: 308 }, { w: 750, h: 231 }, { w: 620, h: 190 }, { w: 620, h: 126 }, { w: 380, h: 144 }];
  const seen = boxes.map(box => {
    const out = floorLayout(scene(big), null, box), least = out.pack.cap === 6;
    const r = scaleOf(out, box) * 0.3;
    if (!least) assert.ok(r >= 4.9, `${box.w}x${box.h}: radius ${r.toFixed(1)}`);
    return { cap: out.pack.cap, lobby: out.find(z => z.key === 'lobby').spots.length, first: out[0].spots.length };
  });
  assert.deepEqual(seen[0], { cap: 0, lobby: 40, first: 24 });
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i].cap >= seen[i - 1].cap || boxes[i].h > boxes[i - 1].h, JSON.stringify(seen));
  assert.deepEqual([seen.at(-1).lobby, seen.at(-1).first], [8, 6], 'the smallest window seats as many as before (eight and six)');
  // 손님이 정한 책상 수는 좁은 창에서도 지킨다
  assert.equal(floorLayout(scene([dept('a', 2, { size: 4, count: 6 }), lobby(60)]), null, { w: 380, h: 144 })[0].desks.length, 6);
});
test('a strip that grew goes back to one row once its staff rest, and not for one staff fewer (carbon A)', () => {
  const box = { w: 900, h: 500 }, of = busy => ({ ...lobby(12), staff: Array.from({ length: 12 }, (_, i) => ({ id: 'l' + i, status: i < busy ? 'working' : 'quiet' })) });
  const at = (busy, prev) => floorLayout(scene([dept('a', 1), of(busy)]), prev, box), seats = out => out.find(z => z.key === 'lobby').spots.length;
  const grown = at(10, null), calmer = at(6, grown), rest = at(0, calmer);
  assert.deepEqual([seats(grown), seats(calmer), seats(rest)], [12, 12, 8]);
});
test('in the small window a department that grows still gets its desks: seven and ten staff at 960x680, with and without other work', () => {
  const box = { w: 624, h: 208 }, rest = ['b', 'c', 'd', 'e', 'f'].map((k, i) => dept(k, [2, 1, 0, 0, 0][i]));
  for (const [n, desks] of [[4, 2], [7, 3], [10, 4]]) {
    const out = floorLayout(scene([dept('a', n), ...rest]), null, box);
    assert.deepEqual([out[0].staff.length, out[0].desks.length], [n, desks]);
  }
  const withStrip = floorLayout(scene([dept('a', 7), ...rest, lobby(9)]), null, box);
  assert.deepEqual([withStrip[0].staff.length, withStrip[0].desks.length], [7, 3]);
});
test('the row counts stay unless another pair is clearly bigger, and a layout made before the size was known is not carried on', () => {
  const box = { w: 750, h: 231 };
  let prev = null, flips = 0, last = '';
  // 직원 하나가 오가도 줄 수가 이리저리 바뀌지 않는다
  for (let t = 0; t < 40; t++) {
    const out = floorLayout(scene([dept('a', 9 + (t % 2)), dept('b', 5), dept('c', 3), lobby(12)]), prev, box), key = out.pack.desk + '/' + out.pack.strip + '/' + out.pack.cap;
    if (last && key !== last) flips += 1;
    last = key; prev = out;
  }
  assert.ok(flips <= 1, flips + ' flips');
  const blind = floorLayout(scene([dept('a', 12)]), null, null);
  assert.equal(blind.pack.known, false);
  const sized = floorLayout(scene([dept('a', 12)]), blind, { w: 380, h: 480 }), fresh = floorLayout(scene([dept('a', 12)]), null, { w: 380, h: 480 });
  assert.deepEqual(sized.pack, fresh.pack);
});
test('the strip shows every working staff member, by fours, and narrows only when eight seats are spare', () => {
  const at = (busy, all, prev = null, box = { w: 900, h: 500 }) => floorLayout(scene([lobby(all, i => (i < busy ? 'working' : 'quiet'))]), prev, box);
  assert.deepEqual([[3, 5], [3, 33], [9, 33], [17, 33], [33, 33], [50, 60]].map(([b, n]) => at(b, n)[0].spots.length), [5, 8, 12, 20, 33, 40]);
  let prev = at(17, 33);
  for (const [busy, want] of [[14, 20], [13, 20], [12, 12], [13, 16], [9, 16], [8, 8]]) { prev = at(busy, 33, prev); assert.equal(prev[0].spots.length, want, `${busy} working`); }
  const user = at(17, 33)[0];
  assert.deepEqual([user.staff.filter(s => s.status === 'working').length, user.hidden], [17, 13], 'the 11-25 screen: all seventeen working staff are drawn');
  assert.ok(new Set(user.spots.map(s => s.z.toFixed(2))).size >= 2, 'in more than one row');
  // 여덟에서 아홉을 오갈 때 한 줄과 두 줄을 오가지 않는다
  const narrow = { w: 400, h: 480 }, nine = at(9, 9, null, narrow), eight = at(8, 8, nine, narrow), six = at(6, 6, eight, narrow);
  assert.deepEqual([nine, eight, six].map(o => new Set(o[0].spots.map(s => s.z.toFixed(2))).size > 1), [true, true, false]);
});
test('floorSeatCount counts what a roomy picture would seat', () => {
  assert.equal(floorSeatCount(scene([dept('a', 0), dept('b', 4), dept('c', 2, { size: 1, count: 4 }), lobby(33, i => (i < 17 ? 'working' : 'quiet'))], 2)), 2 + 6 + 4 + 20);
  assert.equal(floorSeatCount(null), 0);
});

/* ── 줄과 동작 ── */
const MKT = 'C:\\work\\mkt', DEV = 'C:\\work\\dev';
const DEPTS = [{ id: 'dmkt', name: '마케팅부', folder: MKT }, { id: 'ddev', name: '개발부', folder: DEV }];
const NOW = 1_800_000_000_000;
const sessions = (counts, at = NOW - 20e3) => {
  let state = officeState();
  for (const [cwd, n] of counts) for (let i = 0; i < n; i++) state = officeReduce(state, { kind: 'record', sessionId: `sess-${cwd.slice(-3)}-${String(i).padStart(4, '0')}`, cwd, tool: 'claude', changedAt: at + i }, { departments: DEPTS, assignments: {} });
  return state;
};
const snapOf = (patch = {}) => ({ ok: true, available: true, state: sessions([[MKT, 2], [DEV, 1]]), departments: JSON.parse(JSON.stringify(DEPTS)), assignments: {}, settings: { view: 'tilted', manualCap: null, skin: 'black', looks: {} }, roots: {}, pc: { cores: 16, totalMemGb: 32 }, readAt: NOW, ...patch });
const deskRow = (room, id) => { const more = room.rows.find(r => r.key === 'd:' + id).more, i = more.findIndex(m => m[0] === 'item' && m[1] === '책상'); return { item: more[i], grp: more[i + 1], live: more.at(-1)[1] }; };
function harness(snap = snapOf(), save = async () => ({ ok: true })) {
  let now = NOW, current = snap, rereads = 0;
  const calls = [];
  const room = createOfficeRoom({ api: { saveSettings: async v => { calls.push(v); return save(v); }, seen: async () => ({ ok: true }) }, snapshot: () => current, reread: () => { rereads += 1; } });
  return { room, calls, scene: () => room.scene(current, now, null), set: patch => { current = { ...current, ...patch }; }, tick: ms => { now += ms; }, rereads: () => rereads, zone: id => room.scene(current, now, null).floor.zones.find(z => z.key === 'd:' + id) };
}

test('a department row carries 「책상」 with what stands now, folded until pressed, and the picks name the department', () => {
  const { item, grp } = deskRow(officeRoom(snapOf(), {}, NOW), 'dmkt');
  assert.deepEqual(item, ['item', '책상', '3인 책상 하나', false, 'desk', '']);
  assert.equal(grp[3], true);
  assert.deepEqual(grp[2].filter(m => m[0] === 'pick').map(m => [m[1], m[3], m[5], m[2].map(([t]) => t).join(' ')]), [
    ['책상 크기', 'dmkt|3', 'desk-size', '1인 2인 3인 4인'],
    ['책상 수', 'dmkt|1', 'desk-count', '1 2 3 4 5 6'],
    ['재질', 'dmkt|office', 'desk-finish', '사무실과 같게 검정 호두나무'],
  ]);
  assert.deepEqual(OFFICE_FINISHES.map(([k]) => k), ['office', 'black', 'walnut']);
  const open = deskRow(officeRoom(snapOf(), { grps: new Set(['d:dmkt:desk']) }, NOW), 'dmkt');
  assert.deepEqual([open.item[3], open.grp[3]], [true, false]);
  const grown = deskRow(officeRoom(snapOf({ state: sessions([[MKT, 7]]) }), {}, NOW), 'dmkt');
  assert.equal(grown.item[2], '3인 책상 셋 · 직원이 늘어 둘 더 놓음');
  const chosen = deskRow(officeRoom(snapOf({ departments: [{ ...DEPTS[0], desk: { size: 2, count: 3, finish: 'walnut' } }, DEPTS[1]] }), {}, NOW), 'dmkt');
  assert.equal(chosen.item[2], '2인 책상 셋');
  assert.deepEqual(chosen.grp[2].filter(m => m[0] === 'pick').map(m => m[3]), ['dmkt|2', 'dmkt|3', 'dmkt|walnut']);
});
test('the seventh department says where desks are drawn; 꾸미기 points to the departments only when there are some', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ id: 'dep' + i, name: '부서' + i, folder: 'C:\\d' + i }));
  const room = officeRoom(snapOf({ departments: many, state: officeState() }), {}, NOW);
  const notes = id => deskRow(room, id).grp[2].filter(m => m[0] === 'note').map(m => m[1]);
  assert.equal(notes('dep5').some(t => t.includes('여섯째')), false);
  assert.equal(notes('dep6').some(t => t === '그림에는 여섯째 부서까지 책상이 놓입니다.'), true);
  const hint = r => r.rows.find(x => x.key === 'look').more.some(m => m[0] === 'note' && m[1].startsWith('책상은'));
  assert.equal(hint(room), true);
  assert.equal(hint(officeRoom(snapOf({ departments: [], state: officeState() }), {}, NOW)), false);
});
test('the scene carries the desk of each department and only that department', () => {
  const s = officeFloorScene({ departments: [{ ...DEPTS[0], desk: { size: 1 } }, DEPTS[1]], list: [], cap: 8 });
  assert.deepEqual(s.zones.map(z => [z.key, z.desk, z.held]), [['d:dmkt', { size: 1 }, 0], ['d:ddev', {}, 0]]);
  assert.equal(s.deskSeq, 0);
});
test('a pick changes the picture and the line at once, saves one field, and settles when the board brings it', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ key: 'd:dmkt', act: 'desk-size', arg: 'dmkt|1' });
  await h.room.handle({ key: 'd:dmkt', act: 'desk-count', arg: 'dmkt|4' });
  await h.room.handle({ key: 'd:dmkt', act: 'desk-finish', arg: 'dmkt|walnut' });
  assert.deepEqual(h.calls, [{ desk: { department: 'dmkt', size: 1 } }, { desk: { department: 'dmkt', count: 4 } }, { desk: { department: 'dmkt', finish: 'walnut' } }]);
  const s = h.scene();
  assert.deepEqual(s.floor.zones.find(z => z.key === 'd:dmkt').desk, { size: 1, count: 4, finish: 'walnut' });
  assert.deepEqual(s.floor.zones.find(z => z.key === 'd:ddev').desk, {}, 'the other department keeps its own');
  assert.equal(s.floor.deskSeq, 3);
  assert.equal(deskRow(s, 'dmkt').item[2], '1인 책상 넷');
  assert.equal(deskRow(s, 'dmkt').live, '호두나무 책상으로 바꿨습니다.');
  assert.equal(h.rereads(), 3);
  h.set({ departments: [{ ...DEPTS[0], desk: { size: 1, count: 4, finish: 'walnut' } }, DEPTS[1]] });
  h.scene();
  // 판이 같은 값을 가져온 뒤에는 판을 따른다
  h.set({ departments: [{ ...DEPTS[0], desk: { size: 2 } }, DEPTS[1]] });
  assert.deepEqual(h.zone('dmkt').desk, { size: 2 });
  await h.room.handle({ key: 'd:dmkt', act: 'desk-finish', arg: 'dmkt|office' });
  assert.equal(h.calls.length, 3, 'already the same as the office: nothing to save');
});
test('the words after a pick, the same value again, and values that do not exist', async () => {
  const h = harness();
  h.scene();
  const say = async (act, v) => { await h.room.handle({ key: 'd:dmkt', act, arg: 'dmkt|' + v }); return deskRow(h.scene(), 'dmkt').live; };
  assert.equal(await say('desk-size', 2), '2인 책상으로 바꿨습니다.');
  assert.deepEqual([await say('desk-count', 2), await say('desk-count', 3), await say('desk-count', 1)], ['책상을 둘로 정했습니다.', '책상을 셋으로 정했습니다.', '책상을 하나로 정했습니다.']);
  assert.equal(await say('desk-finish', 'black'), '검정 책상으로 바꿨습니다.');
  assert.equal(await say('desk-finish', 'office'), '사무실과 같은 재질로 되돌렸습니다.');
  const n = h.calls.length;
  for (const [act, v] of [['desk-size', 2], ['desk-size', 5], ['desk-size', 'x'], ['desk-count', 0], ['desk-count', 7], ['desk-finish', 'marble'], ['desk-finish', 'office']]) await h.room.handle({ key: 'd:dmkt', act, arg: 'dmkt|' + v });
  assert.equal(h.calls.length, n);
  await h.room.handle({ key: 'd:gone', act: 'desk-size', arg: 'gone|2' });
  assert.equal(h.calls.length, n, 'a department that is gone is read again, not saved');
});
test('a failed or busy save goes back to what stood before and says why', async () => {
  const h = harness(snapOf(), async () => ({ ok: false, code: 'WRITE' }));
  h.scene();
  await h.room.handle({ key: 'd:dmkt', act: 'desk-size', arg: 'dmkt|4' });
  assert.deepEqual(h.zone('dmkt').desk, {});
  assert.equal(deskRow(h.scene(), 'dmkt').live, '저장하지 못했습니다. 잠시 뒤 다시 해 주세요.');
  let free;
  const b = harness(snapOf(), () => new Promise(r => { free = r; }));
  b.scene();
  const first = b.room.handle({ key: 'd:dmkt', act: 'desk-size', arg: 'dmkt|4' });
  await b.room.handle({ key: 'd:ddev', act: 'desk-size', arg: 'ddev|2' });
  assert.deepEqual([b.zone('dmkt').desk, b.zone('ddev').desk], [{ size: 4 }, {}], 'the second pick waits its turn and is taken back');
  free({ ok: true });
  await first;
  assert.deepEqual(b.calls, [{ desk: { department: 'dmkt', size: 4 } }]);
});
test('another account does not inherit picks that had not come back', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ key: 'd:dmkt', act: 'desk-size', arg: 'dmkt|1' });
  h.room.reset();
  assert.deepEqual(h.zone('dmkt').desk, {});
  assert.equal(h.scene().floor.deskSeq, 0);
});
test('desks grow at once and are taken away only after three quiet minutes; a pick or leaving the room settles them', async () => {
  const h = harness(snapOf({ state: sessions([[MKT, 7]]) }));
  const desks = () => officeDeskPlan(h.zone('dmkt').desk, h.zone('dmkt').staff.length, 3, { held: h.zone('dmkt').held }).desks;
  assert.equal(OFFICE_TIMING.desk, 180000);
  assert.equal(desks(), 3);
  h.set({ state: sessions([[MKT, 2]]) });
  assert.equal(desks(), 3, 'still three right after they left');
  assert.equal(deskRow(h.scene(), 'dmkt').item[2], '3인 책상 셋 · 빈 책상 둘은 잠시 뒤 치움', 'the line says what stands');
  h.tick(170e3); h.scene();
  assert.equal(desks(), 3);
  h.set({ state: sessions([[MKT, 8]]) });
  assert.equal(desks(), 3, 'they came back: the count starts over');
  h.set({ state: sessions([[MKT, 2]]) });
  h.scene(); h.tick(100e3);
  assert.equal(desks(), 3);
  h.tick(81e3); h.scene();
  assert.equal(desks(), 1);
  h.set({ state: sessions([[MKT, 10]]) });
  assert.equal(desks(), 4, 'growing is at once');
  h.set({ state: sessions([[MKT, 1]]) });
  h.scene();
  await h.room.handle({ key: 'd:dmkt', act: 'desk-size', arg: 'dmkt|2' });
  assert.equal(desks(), 1, 'a pick of the user stands as it is');
  h.set({ state: sessions([[MKT, 9]]) });
  assert.equal(desks(), 5);
  h.set({ state: sessions([[MKT, 1]]) });
  h.scene();
  h.room.close();
  assert.equal(desks(), 1, 'the next time the room opens it starts from now');
});
