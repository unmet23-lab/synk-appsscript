// Shared deterministic ground movement for host authority and browser prediction.
import { TOWN_LAYOUT, layoutSolids } from './town-layout.mjs';
export const WALK_SPEED = 3.2;
// Soft bodies can lean beyond their planted feet; only walls need full-height clearance.
export const WALK_RADIUS = .34;
const WALL_CLEARANCE = .42;
export const WALK_NEAR_RADIUS = 2.15;
// The level garden loop is shared by authoritative movement and browser prediction.
export const WALK_BOUNDS = TOWN_LAYOUT.bounds;
export const WALK_SPAWNS = Object.freeze({ home: Object.freeze({ x: -6, z: 1.7 }), cafe: Object.freeze({ x: 0, z: 2.5 }),
  workshop: Object.freeze({ x: 6, z: 1.7 }), greenhouse: Object.freeze({ x: 0, z: -4 }) });
const rect = (id, x, z, width, depth, radius = WALK_RADIUS) => Object.freeze({ id, radius,
  minX: x - width / 2 - radius, maxX: x + width / 2 + radius,
  minZ: z - depth / 2 - radius, maxZ: z + depth / 2 + radius });
const ellipse = (id, x, z, rx, rz = rx) => Object.freeze({ id, type: 'ellipse', x, z, rx: rx + WALK_RADIUS, rz: rz + WALK_RADIUS });
export const WALK_SOLIDS = Object.freeze([
  ...[-6, 0, 6].flatMap((x, i) => [rect(`wall-${i}`, x, -2, 3.85, .25, WALL_CLEARANCE),
    rect(`pier-left-${i}`, x - 1.8, -1.65, .28, .9, WALL_CLEARANCE), rect(`pier-right-${i}`, x + 1.8, -1.65, .28, .9, WALL_CLEARANCE)]),
  rect('greenhouse-back', 0, -7.9, 3.85, .07, WALL_CLEARANCE), rect('greenhouse-left', -1.9, -6.7, .07, 2.6, WALL_CLEARANCE), rect('greenhouse-right', 1.9, -6.7, .07, 2.6, WALL_CLEARANCE),
  rect('home-bench', -5.18, -.7, 1.25, .64), ellipse('cafe-table', 1.05, -.3, .56),
  rect('workshop-table', 6.2, -.65, 2.08, .79),
  rect('greenhouse-bed-left', -1.25, -6.67, .88, 1.85), rect('greenhouse-bed-right', 1.15, -6.67, .88, 1.85),
  rect('street-bench-left', -5, 3.06, 1.8, .64), rect('street-bench-right', 5, 3.06, 1.8, .64),
  ellipse('street-planter-left', -8.6, 2.7, .3), ellipse('street-planter-right', 8.6, 2.7, .3), ellipse('pond', 5.35, -5.6, 1.82, 1.11),
  ...layoutSolids(),
]);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function rectOffset(solid, point) {
  if (solid.type === 'obb') {
    const dx = point.x - solid.x, dz = point.z - solid.z;
    const lx = dx * solid.cos - dz * solid.sin, lz = dx * solid.sin + dz * solid.cos;
    const ox = lx - clamp(lx, -solid.halfWidth, solid.halfWidth), oz = lz - clamp(lz, -solid.halfDepth, solid.halfDepth);
    return { x: ox * solid.cos + oz * solid.sin, z: -ox * solid.sin + oz * solid.cos };
  }
  return { x: point.x - clamp(point.x, solid.minX + solid.radius, solid.maxX - solid.radius),
    z: point.z - clamp(point.z, solid.minZ + solid.radius, solid.maxZ - solid.radius) };
}
function contains(solid, point) {
  // Cached outer boxes reject distant architecture before its inverse rotation.
  if (solid.minX !== undefined && (point.x < solid.minX || point.x > solid.maxX || point.z < solid.minZ || point.z > solid.maxZ)) return false;
  if (solid.type === 'ellipse') return ((point.x - solid.x) / solid.rx) ** 2 + ((point.z - solid.z) / solid.rz) ** 2 < 1;
  // A circular foot clearance rounds the corners instead of blocking the empty diagonal square.
  const offset = rectOffset(solid, point);
  return offset.x ** 2 + offset.z ** 2 < solid.radius ** 2;
}
function outwardNormal(solid, point) {
  const offset = solid.type === 'ellipse' ? { x: (point.x - solid.x) / solid.rx ** 2, z: (point.z - solid.z) / solid.rz ** 2 } : rectOffset(solid, point);
  const length = Math.hypot(offset.x, offset.z);
  return length > 0 ? { x: offset.x / length, z: offset.z / length } : null;
}
export function isWalkable(point) {
  return !!point && finite(point.x) && finite(point.z) && point.x >= WALK_BOUNDS.minX && point.x <= WALK_BOUNDS.maxX
    && point.z >= WALK_BOUNDS.minZ && point.z <= WALK_BOUNDS.maxZ
    && !WALK_SOLIDS.some(solid => contains(solid, point));
}
export function nearbyPlace(point) {
  if (!point || !finite(point.x) || !finite(point.z)) return null;
  const ranked = Object.entries(WALK_SPAWNS).map(([id, p]) => ({ id, distance: Math.hypot(point.x - p.x, point.z - p.z) })).sort((a, b) => a.distance - b.distance);
  return ranked[0].distance <= WALK_NEAR_RADIUS ? ranked[0].id : null;
}
export function movePoint(point, input, seconds) {
  if (!isWalkable(point) || !input || !finite(input.x) || !finite(input.z) || Math.abs(input.x) > 1 || Math.abs(input.z) > 1
    || !finite(seconds) || seconds < 0) throw new TypeError('invalid-walk-input');
  const magnitude = Math.max(1, Math.hypot(input.x, input.z)), distance = WALK_SPEED * Math.min(.25, seconds);
  const dx = input.x / magnitude * distance, dz = input.z / magnitude * distance;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .035));
  let { x, z } = point;
  for (let i = 0; i < steps; i++) {
    const bounded = (sx, sz) => ({ x: clamp(x + sx, WALK_BOUNDS.minX, WALK_BOUNDS.maxX), z: clamp(z + sz, WALK_BOUNDS.minZ, WALK_BOUNDS.maxZ) });
    const wanted = bounded(dx / steps, dz / steps);
    if (isWalkable(wanted)) { ({ x, z } = wanted); continue; }
    let sx = wanted.x - x, sz = wanted.z - z;
    for (const solid of WALK_SOLIDS) {
      if (!contains(solid, wanted)) continue;
      const normal = outwardNormal(solid, { x, z });
      if (!normal) continue;
      const inward = sx * normal.x + sz * normal.z;
      // Orthogonal projection removes the blocked part, so sliding cannot add speed.
      if (inward < 0) { sx -= inward * normal.x; sz -= inward * normal.z; }
    }
    const slide = bounded(sx, sz);
    if (isWalkable(slide) && Math.hypot(slide.x - x, slide.z - z) > 1e-10) { ({ x, z } = slide); continue; }
    // Intersecting solids may reject a tangent. Keep the longest legal input axis.
    const axes = [bounded(dx / steps, 0), bounded(0, dz / steps)].filter(isWalkable)
      .sort((a, b) => Math.hypot(b.x - x, b.z - z) - Math.hypot(a.x - x, a.z - z));
    if (axes.length) ({ x, z } = axes[0]);
  }
  return { x, z };
}
export function walkSegments(payload) {
  const parts = payload?.segments ?? [{ ...(payload?.input || {}), durationMs: payload?.durationMs }];
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 32 || parts.some(p => !p || !finite(p.x) || !finite(p.z)
    || Math.abs(p.x) > 1 || Math.abs(p.z) > 1 || !finite(p.durationMs) || p.durationMs < 0 || p.durationMs > 250)
    || parts.reduce((n, p) => n + p.durationMs, 0) > 250.001) throw new TypeError('invalid-walk-segments');
  return parts.map(p => ({ x: p.x, z: p.z, durationMs: p.durationMs }));
}
