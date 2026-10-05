// Pure procedural sampling shared by the worker and the synchronous fallback.
// No THREE, DOM, renderer or baked/interpolated height map is needed here.
export const CHUNK_LENGTH = 125;
const ROAD_EDGE = 7.1;
const SURFACE_OFFSET = -.055;
export const LEVELS = ['near', 'mid', 'far'];
const unique = values => values.sort((a, b) => a - b).filter((n, i, all) => i === 0 || n - all[i - 1] > .00001);

function originalOffsets() {
  const offsets = [];
  for (let x = -350; x < -100; x += 10) offsets.push(x);
  for (let x = -100; x < -40; x += 4) offsets.push(x);
  for (let x = -40; x < -8; x += 2) offsets.push(x);
  for (let x = -8; x < 8; x++) offsets.push(x);
  for (let x = 8; x < 90; x += 1.5) offsets.push(x);
  for (let x = 90; x < 170; x += 8) offsets.push(x);
  offsets.push(170);
  return offsets;
}

const DENSE_OFFSETS = originalOffsets();
export const SOURCE_TRIANGLES = 550 * (DENSE_OFFSETS.length - 1) * 2;
const CROSS_SECTIONS = {
  near: unique([...DENSE_OFFSETS, -ROAD_EDGE, ROAD_EDGE]),
  mid: unique([
    ...DENSE_OFFSETS.filter(x => x < -100 ? x % 20 === -10 || x === -350 : x < -40 ? x % 8 === 0 : x < -8 ? x % 4 === 0 : x < 8 ? x % 2 === 0 : x < 90 ? (x - 8) % 3 === 0 : x % 16 === 10),
    -350, -ROAD_EDGE, 0, ROAD_EDGE, 170,
  ]),
  far: [-350, -320, -290, -260, -230, -200, -170, -140, -110, -85, -65, -48, -36, -26, -18, -12, -8, -ROAD_EDGE, 0, ROAD_EDGE, 8, 12, 70, 90, 130, 170],
};
const STEPS = {near: 5, mid: 12.5, far: 25};

export function buildCourseTerrainData({pathX, groundHeight, ROAD_END = 2250, colorAt} = {}) {
  if (typeof pathX !== 'function' || typeof groundHeight !== 'function') throw new TypeError('Course terrain needs path/height functions.');
  if (!Number.isFinite(ROAD_END) || ROAD_END < 100) throw new RangeError('ROAD_END must be at least 100m.');
  if (colorAt !== undefined && typeof colorAt !== 'function') throw new TypeError('colorAt must be a function.');
  const start = -150, end = ROAD_END + 350, cachedRows = new Map(), geometries = [];

  function section(s, level) {
    // Exact cliff transitions and the foam/water intersection survive every LOD.
    const extra = [];
    if (typeof groundHeight.cliffOffset === 'function') {
      const cliff = groundHeight.cliffOffset(s);
      extra.push(cliff - 5, cliff - 2, cliff, cliff + 3.5, cliff + 13.5, cliff + 58.5);
    }
    if (typeof groundHeight.shoreOffset === 'function') extra.push(groundHeight.shoreOffset(s));
    return unique([...CROSS_SECTIONS[level], ...extra.filter(x => Number.isFinite(x) && x > ROAD_EDGE && x < 170)]);
  }

  function sample(s, offset) {
    let row = cachedRows.get(s);
    if (!row) {row = new Map(); cachedRows.set(s, row);}
    if (row.has(offset)) return row.get(offset);
    const x = pathX(s) + offset, h = groundHeight(x, s);
    if (!Number.isFinite(x) || !Number.isFinite(h)) throw new RangeError(`Invalid terrain sample at ${s}m.`);
    // A shared world-space derivative avoids lighting seams at independent
    // chunk borders, including a border between different detail levels.
    const dx = groundHeight(x + .5, s) - groundHeight(x - .5, s);
    const dz = groundHeight(x, s + .5) - groundHeight(x, s - .5);
    const length = Math.hypot(dx, 1, dz);
    const surface = typeof groundHeight.surfaceAt === 'function' ? groundHeight.surfaceAt(x, s, h, Math.hypot(dx,dz)) : 0;
    let rgb = [1, 1, 1];
    if (colorAt) {
      const value = colorAt(x, s, h, surface);
      if (Array.isArray(value) || ArrayBuffer.isView(value)) rgb = [value[0], value[1], value[2]];
      else if (value !== undefined) throw new TypeError('Terrain data colors must be linear RGB arrays.');
    }
    const value = {position: [x, h + SURFACE_OFFSET, s], normal: [-dx / length, 1 / length, -dz / length], colour: rgb, surface};
    if (![...value.position, ...value.normal, ...rgb, surface].every(Number.isFinite)) throw new RangeError(`Invalid terrain attributes at ${s}m.`);
    row.set(offset, value); return value;
  }

  function geometryFor(a, b, level) {
    const positions = [], normals = [], colours = [], uv = [], surfaces = [], indices = [];
    const rowStarts = [], rowCounts = [], rowOffsets = [], rows = [];
    const divisions = Math.ceil((b - a) / STEPS[level]);
    for (let j = 0; j <= divisions; j++) {
      const s = j === divisions ? b : a + (b - a) * j / divisions;
      // All LODs keep the exact same dense boundary row. The strip between
      // sparse and dense rows is triangulated, so there are no T-junction gaps.
      const offsets = section(s, j === 0 || j === divisions ? 'near' : level);
      rows.push(s); rowStarts.push(positions.length / 3); rowCounts.push(offsets.length); rowOffsets.push(offsets);
      for (const offset of offsets) {
        const point = sample(s, offset);
        positions.push(...point.position); normals.push(...point.normal); colours.push(...point.colour);
        uv.push(point.position[0] / 3.4, s / 3.4); surfaces.push(point.surface);
      }
    }
    // Both rows are monotonic across the road, even as the coast meanders.
    // Advancing the next transverse sample gives a complete upward-facing strip.
    for (let j = 0; j < divisions; j++) {
      const top = rowOffsets[j], bottom = rowOffsets[j + 1];
      let i = 0, k = 0;
      while (i < top.length - 1 || k < bottom.length - 1) {
        const p = rowStarts[j] + i, q = rowStarts[j + 1] + k;
        if (k === bottom.length - 1 || (i < top.length - 1 && top[i + 1] <= bottom[k + 1])) {
          indices.push(p, q, p + 1); i++;
        } else {indices.push(p, q, q + 1); k++;}
      }
    }
    const attributes = Object.fromEntries(Object.entries({position: [positions, 3], normal: [normals, 3], color: [colours, 3], uv: [uv, 2], surface: [surfaces, 1]}).map(([name, [array, itemSize]]) => [name, {array: new Float32Array(array), itemSize}]));
    const index = indices.some(value => value > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
    return {attributes, index, terrain: {start: a, end: b, level, rows, rowStarts, rowCounts}, ...bounds(attributes.position.array)};
  }

  for (let a = start; a < end; a += CHUNK_LENGTH) {
    const b = Math.min(a + CHUNK_LENGTH, end);
    for (const level of LEVELS) geometries.push(geometryFor(a, b, level));
    // Keep only the shared boundary; release temporary samples chunk by chunk.
    const boundary = cachedRows.get(b); cachedRows.clear();
    if (boundary) cachedRows.set(b, boundary);
  }
  return {version: 1, roadEnd: ROAD_END, geometries};
}

// Match BufferGeometry bounds using the final Float32 positions. The scene can
// attach these bounds without scanning or copying the transferred arrays again.
function bounds(positions) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], positions[i + axis]);
    max[axis] = Math.max(max[axis], positions[i + axis]);
  }
  const center = min.map((value, i) => (value + max[i]) * .5);
  let radiusSquared = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - center[0], y = positions[i + 1] - center[1], z = positions[i + 2] - center[2];
    radiusSquared = Math.max(radiusSquared, x * x + y * y + z * z);
  }
  return {box: [min, max], sphere: [center, Math.sqrt(radiusSquared)]};
}
