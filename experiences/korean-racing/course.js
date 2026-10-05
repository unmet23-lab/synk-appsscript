// One road definition for the scene and the terrain worker. Keep the exact
// procedural samples; an interpolated height map would move coast/road edges.
export const ROAD_END = 2250;
export const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
export const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
export const pathAngle = s => Math.atan(Math.cos(s / 235) * 25 / 235 + Math.cos(s / 580) * 31 / 580);

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
