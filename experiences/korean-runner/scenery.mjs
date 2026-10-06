// 바람길 마을 — 길 옆 펠트 풍경의 배치(숫자만). 그리기는 world.mjs가 이 목록을 펠트 결 재질 하나로 칸마다 한 덩어리로 묶어 그린다.
// 그림이 없어 node 시험(course-motion.test.mjs)에서 바로 잰다: 길(세 칸 + 연석)에는 아무것도 들어오지 않고, 칸이 통째로 앞으로 돌아갈 때
// 카메라 앞에서 사라지거나 안개 밖이 아닌 곳에서 나타나지 않는다.
// 색은 펠트 결(크림 펠트 사진)에 곱하는 빛깔이다 — 크림 땅, 모래빛 길, 풀빛·꽃빛 나무, 크림 벽에 라피스·코랄·풀빛·버터 지붕.

export const TILE = 25;                 // 칸 하나의 길이(m)
export const TILES = 8;
export const LOOP = TILE * TILES;       // 200m마다 같은 마을이 되풀이된다
export const TILE_EXTENT = Object.freeze({ front: 1, back: -25 });   // 칸 안의 물건이 놓이는 로컬 Z 범위
export const CLEARANCE = Object.freeze({ course: 4.45, overhead: 5.4 });   // 길 가운데 |x|<4.45(길·연석)에는 머리 위 5.4m 아래로 들어오지 않는다
// 카메라·안개(world.mjs가 같은 값을 쓴다). 카메라는 화면 비율에 따라 Z 10.5~13.6 사이에 고정된다.
export const VIEW = Object.freeze({ playerZ: 3, cameraZMin: 10.5, cameraZMax: 13.6, fogNear: 46, fogFar: 160 });

export const PALETTE = Object.freeze({
  cream: 0xfff9ee, wall: 0xfdf3e3, sand: 0xecd9bb, stone: 0xdfd2c0, stoneDark: 0xc9b9a4,
  wood: 0xb98b6c, woodDark: 0x936650,
  meadow: Object.freeze([0xa9d08b, 0x93c276, 0xc0dea2]),
  blossom: Object.freeze([0xf9cfc4, 0xf5b7aa]),
  butter: 0xf8cf5c, coral: 0xf47b6b, lapis: 0x5d84d8, blush: 0xfbd5c8,
  roof: Object.freeze([0x5d84d8, 0xef7466, 0x86b86e, 0xeab84a]),
  flower: Object.freeze([0xf8cf5c, 0xf5aeb8, 0xfff6e6, 0xf47b6b]),
});
export const SIGNS = Object.freeze(['꽃집', '책방', '빵집', '찻집']);

const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * 칸마다 놓을 물건. { tile, kind:'ball'|'box'|'cyl'|'prism'|'sign', color, p:[x,y,z](칸 안 로컬), s:[sx,sy,sz], ry, sign? }
 * ball은 반지름(축마다), box·prism은 폭·높이·깊이(prism은 바닥이 y), cyl은 반지름·높이·반지름, sign은 폭·높이(+Z를 보는 판).
 * 회전은 Y축만 쓴다(덤불·지붕 모두) — 그래서 아래 bounds가 정확하다.
 */
export function sceneryLayout() {
  const items = [];
  const add = (tile, kind, color, p, s, ry = 0, extra = {}) => items.push({ tile, kind, color, p, s, ry, ...extra });
  let house = 0;
  for (let tile = 0; tile < TILES; tile++) {
    for (const side of [-1, 1]) {
      const seed = tile * 37 + (side > 0 ? 19 : 3);
      // 1) 길가 덤불과 작은 꽃: 연석 바로 밖에 낮게
      for (let k = 0; k < 4; k++) {
        const r = 0.46 + rnd(seed + k * 3) * 0.2, sx = r * 1.18;
        const x = side * (CLEARANCE.course + sx + 0.18 + rnd(seed + k * 5) * 0.5), z = -2.6 - k * 5.8 - rnd(seed + k * 7) * 2;
        add(tile, 'ball', PALETTE.meadow[(k + tile) % 3], [x, r * 0.62, z], [sx, r * 0.82, r]);
        for (let f = 0; f < 3; f++) {
          const fx = x + side * (0.25 + f * 0.32), fz = z + (f - 1) * 0.55 + 0.4;
          add(tile, 'ball', PALETTE.flower[(k + f + tile) % 4], [fx, 0.16, fz], [0.13, 0.11, 0.13]);
        }
      }
      // 2) 길가 나무 둘(가까이 하나, 마을 뒤 하나 — 넓은 화면에서 보인다)
      const tree = (x, z, scale, blossom) => {
        add(tile, 'cyl', PALETTE.wood, [x, 0.9 * scale, z], [0.17 * scale, 1.8 * scale, 0.17 * scale]);
        const leaf = blossom ? PALETTE.blossom : PALETTE.meadow;
        add(tile, 'ball', leaf[0], [x, 2.45 * scale, z], [1.25 * scale, 1.08 * scale, 1.2 * scale]);
        add(tile, 'ball', leaf[1 % leaf.length], [x - 0.62 * scale, 2.08 * scale, z + 0.32 * scale], [0.78 * scale, 0.7 * scale, 0.76 * scale]);
        add(tile, 'ball', leaf[(2) % leaf.length], [x + 0.58 * scale, 2.18 * scale, z - 0.3 * scale], [0.8 * scale, 0.72 * scale, 0.78 * scale]);
        add(tile, 'ball', leaf[0], [x + 0.1 * scale, 3.12 * scale, z], [0.7 * scale, 0.6 * scale, 0.68 * scale]);
      };
      const hasHouse = (tile + (side > 0 ? 1 : 0)) % 2 === 0;
      tree(side * (6.9 + rnd(seed + 11) * 1.2), hasHouse ? -4.5 - rnd(seed + 13) * 1.5 : -6 - rnd(seed + 13) * 10, 1, (tile * 2 + (side > 0 ? 1 : 0)) % 5 === 2);
      tree(side * (15.5 + rnd(seed + 17) * 6), -6 - rnd(seed + 19) * 13, 1.35 + rnd(seed + 23) * 0.3, (tile + (side > 0 ? 2 : 0)) % 4 === 1);
      if (!hasHouse) tree(side * (9.6 + rnd(seed + 29) * 1.4), -16 - rnd(seed + 31) * 4, 1.1, false);
      // 3) 집(한 칸에 하나, 왼쪽·오른쪽 번갈아): 크림 벽, 색 지붕, 나무 문, 버터 창, 크림 간판(꽃집·책방·빵집·찻집)
      if (hasHouse) {
        const cx = side * (10.4 + rnd(seed + 37) * 0.8), cz = -12.5 + (rnd(seed + 41) - 0.5) * 3, ry = -side * 0.34;
        const c = Math.cos(ry), s = Math.sin(ry);
        const at = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
        const part = (kind, color, lx, y, lz, size, extra) => add(tile, kind, color, at(lx, y, lz), size, ry, extra);
        const roof = PALETTE.roof[house % 4];
        part('box', PALETTE.stone, 0, 0.12, 0, [4.9, 0.24, 3.9]);
        part('box', PALETTE.wall, 0, 1.39, 0, [4.2, 2.3, 3.3]);
        part('prism', roof, 0, 2.52, 0, [5.2, 1.4, 4.3]);
        part('box', PALETTE.woodDark, 0, 2.5, 0, [5.0, 0.12, 4.1]);           // 처마 밑 나무 띠
        part('box', PALETTE.stoneDark, 1.35, 3.35, -0.7, [0.38, 0.9, 0.38]);    // 굴뚝
        part('box', PALETTE.wood, 1.05, 0.98, 1.66, [0.92, 1.5, 0.12]);        // 문
        part('ball', PALETTE.butter, 1.38, 0.98, 1.74, [0.06, 0.06, 0.04]);     // 문고리
        part('box', PALETTE.wood, -0.95, 1.5, 1.65, [1.12, 0.92, 0.1]);        // 창틀
        part('box', PALETTE.butter, -0.95, 1.5, 1.69, [0.94, 0.74, 0.06]);     // 창
        part('box', PALETTE.wood, -0.95, 1.5, 1.73, [0.06, 0.74, 0.04]);       // 창살
        part('box', PALETTE.wood, -0.95, 0.98, 1.78, [1.1, 0.2, 0.28]);        // 꽃 상자
        for (let f = 0; f < 4; f++) part('ball', PALETTE.flower[(f + house) % 4], -1.33 + f * 0.25, 1.15, 1.8, [0.12, 0.11, 0.12]);
        part('box', PALETTE.cream, 0, 2.2, 1.7, [1.6, 0.46, 0.08]);           // 간판 판
        part('sign', 0, 0, 2.2, 1.75, [1.44, 0.38, 1], { sign: house % SIGNS.length });
        part('box', PALETTE.stone, 1.05, 0.04, 2.25, [1.2, 0.08, 0.7]);        // 디딤돌
        house += 1;
      }
      // 4) 납작한 돌 하나
      add(tile, 'ball', PALETTE.stoneDark, [side * (5.9 + rnd(seed + 43) * 1.4), 0.12, -9 - rnd(seed + 47) * 12], [0.46, 0.24, 0.4], rnd(seed + 53) * 3);
    }
  }
  return items;
}

/** 물건 하나가 차지하는 상자(칸 안 로컬). 회전은 Y축만이라 정확하다. */
export function itemBounds(item) {
  const [x, y, z] = item.p, [sx, sy, sz] = item.s, c = Math.abs(Math.cos(item.ry || 0)), s = Math.abs(Math.sin(item.ry || 0));
  let ax, ay, az, y0, y1;
  if (item.kind === 'ball') { ax = sx; az = sz; y0 = y - sy; y1 = y + sy; }
  else if (item.kind === 'cyl') { ax = sx; az = sz; y0 = y - sy / 2; y1 = y + sy / 2; }
  else if (item.kind === 'prism') { ax = sx / 2; az = sz / 2; y0 = y; y1 = y + sy; }
  else if (item.kind === 'sign') { ax = sx / 2; az = 0.01; y0 = y - sy / 2; y1 = y + sy / 2; }
  else { ax = sx / 2; az = sz / 2; y0 = y - sy / 2; y1 = y + sy / 2; }
  ay = (y1 - y0) / 2;
  const hx = c * ax + s * az, hz = s * ax + c * az;
  return { min: [x - hx, y0, z - hz], max: [x + hx, y1, z + hz], half: [hx, ay, hz] };
}
