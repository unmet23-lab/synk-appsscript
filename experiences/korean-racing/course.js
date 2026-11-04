// One road definition for the scene and the terrain worker. Keep the exact
// procedural samples; an interpolated height map would move coast/road edges.
export const ROAD_END = 2250;
export const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
export const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
export const pathAngle = s => Math.atan(Math.cos(s / 235) * 25 / 235 + Math.cos(s / 580) * 31 / 580);
// WORLD의 MT 자전거 레이스만 쓰는 길 높이(설계 qa/world-mt-20261104/설계.md 4-5): 언덕 위 대여소(약 30m)에서 바닷가 숙소(약 10m)로 내려간다.
// 게이트(길 위 169m부터 174m마다)는 작은 고개 위에 서고, 지나면 100m 내리막이 질주 구간과 겹친다. 지금 pathY는 경사가 2.2%뿐이라 1인칭에서 내리막으로 느껴지지 않는다.
// 도로 · 절벽 · 도시 · 바위 · 나무는 createLandscapeHeight로 이 값을 따라온다. LAB은 pathY 그대로다.
export const RIDE_GATE_FIRST = 169, RIDE_GATE_SPACING = 174, RIDE_DOWNHILL = 100;
export function rideY(s) {
  const t = Math.max(0, Math.min(1, (s - 75) / 830)), base = 30 - 20 * t * t * (3 - 2 * t);
  const phase = ((s - RIDE_GATE_FIRST) % RIDE_GATE_SPACING + RIDE_GATE_SPACING) % RIDE_GATE_SPACING;
  const wave = phase < RIDE_DOWNHILL ? Math.cos(Math.PI * phase / RIDE_DOWNHILL) : -Math.cos(Math.PI * (phase - RIDE_DOWNHILL) / (RIDE_GATE_SPACING - RIDE_DOWNHILL));
  const fade = Math.max(0, Math.min(1, (1000 - s) / 120));   // 레이스 뒤로는 물결을 접는다
  return base + 2.2 * wave * fade;
}

const lerp = (a, b, t) => (1 - t) * a + t * b;
const hash = (x, z) => {const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123; return v - Math.floor(v);};
export function noise(x, z) {
  const a = Math.floor(x), b = Math.floor(z), fx = x - a, fz = z - b;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(a, b), hash(a + 1, b), u), lerp(hash(a, b + 1), hash(a + 1, b + 1), u), v);
}
function fbm(x, z) {return noise(x, z) * .55 + noise(x * 2, z * 2) * .28 + noise(x * 4, z * 4) * .12 + noise(x * 8, z * 8) * .05;}
export function terrainColorAt(x, z) {
  const shade = .90 + fbm(x * .08, z * .08) * .20;
  return [shade, shade, shade];
}
