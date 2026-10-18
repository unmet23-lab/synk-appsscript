// Small, seamless procedural surface maps for the local 3D material study.
// These maps describe microstructure; they do not replace garment thickness,
// silhouette, seams, or the approved character model with an image.
const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const wrap = value => value - Math.floor(value);
const smooth = value => value * value * (3 - 2 * value);

function hash(x, y, seed) {
  let value = Math.imul(x + seed * 31, 374761393) ^ Math.imul(y + seed * 17, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

// Integer periods make both the sampled surface and its normal map tile.
function noise(u, v, cells, seed) {
  const x = wrap(u) * cells, y = wrap(v) * cells;
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy, seed), b = hash((ix + 1) % cells, iy, seed);
  const c = hash(ix, (iy + 1) % cells, seed), d = hash((ix + 1) % cells, (iy + 1) % cells, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return { distance: Math.hypot(x - ax - t * dx, y - ay - t * dy), along: t };
}

function felt(u, v) {
  const broad = noise(u, v, 12, 31), fine = noise(u, v, 48, 57);
  const fibers = (
    Math.sin(TAU * (31 * u + 19 * v)) * Math.sin(TAU * (7 * u - 9 * v)) +
    Math.sin(TAU * (17 * u - 37 * v)) * Math.sin(TAU * (11 * u + 5 * v))
  ) * 0.25;
  const height = 0.48 + (broad - 0.5) * 0.18 + (fine - 0.5) * 0.15 + fibers * 0.10;
  return { height, tone: 0.95 + (broad - 0.5) * 0.055 + fibers * 0.02, rough: 0.95 + fine * 0.05 };
}

function knit(u, v) {
  const x = wrap(u * 8), y = wrap(v * 8);
  let yarn = 0;
  // Two rounded strands form each stockinette V; the neighbouring rows overlap
  // softly at the base rather than presenting a stamped chevron outline.
  for (let row = -1; row <= 1; row++) {
    for (const side of [-1, 1]) {
      const sample = segmentDistance(x, y - row, 0.5 + side * 0.33, 0.91, 0.5 + side * 0.035, 0.10);
      const core = Math.exp(-((sample.distance / 0.105) ** 2));
      const strand = 0.92 + 0.08 * Math.cos(sample.along * TAU * 5 + side * Math.PI / 3);
      yarn = Math.max(yarn, core * strand);
    }
  }
  const fluff = noise(u, v, 64, 73);
  return {
    height: 0.20 + yarn * 0.64 + (fluff - 0.5) * 0.026,
    tone: 0.86 + yarn * 0.12 + (fluff - 0.5) * 0.012,
    rough: 0.96 - yarn * 0.09,
  };
}

function cotton(u, v) {
  const x = wrap(u * 16), y = wrap(v * 16);
  const cellX = Math.floor(wrap(u) * 16), cellY = Math.floor(wrap(v) * 16);
  const warp = Math.sin(Math.PI * x) ** 4;
  const weft = Math.sin(Math.PI * y) ** 4;
  // The crossing changes height continuously along each yarn. A cell-parity
  // step would create little hard ledges instead of an interlaced weave.
  const warpLift = Math.cos(Math.PI * (wrap(v) * 16 - 0.5 + cellX));
  const weftLift = -Math.cos(Math.PI * (wrap(u) * 16 - 0.5 + cellY));
  const twist = Math.sin(TAU * (u * 64 + v * 32)) * 0.012;
  const height = 0.28 + warp * (0.23 + warpLift * 0.10) + weft * (0.23 + weftLift * 0.10) + twist * Math.max(warp, weft);
  return { height, tone: 0.94 + (height - 0.5) * 0.07, rough: 0.93 + (1 - Math.max(warp, weft)) * 0.065 };
}

function leather(u, v) {
  const grain = noise(u, v, 24, 109), pores = noise(u, v, 64, 127);
  const creases = Math.exp(-(((grain - 0.5) / 0.065) ** 2));
  return {
    height: 0.53 + (grain - 0.5) * 0.10 - creases * 0.08 + (pores - 0.5) * 0.025,
    tone: 0.95 + (grain - 0.5) * 0.055 - creases * 0.018,
    rough: 0.84 + pores * 0.13,
  };
}

function wood(u, v) {
  // Long continuous grain with periodic drift, not random cloth-like speckles.
  const drift = 0.045 * Math.sin(TAU * v) + 0.014 * Math.sin(TAU * (3 * v + 2 * u));
  const wave = (Math.sin(TAU * (u * 9 + drift)) + 1) * 0.5;
  const rings = wave ** 12;
  const fine = (Math.sin(TAU * (u * 39 + drift * 2)) + 1) * 0.5;
  return {
    height: 0.52 - rings * 0.13 + (fine - 0.5) * 0.025,
    tone: [0.97 - rings * 0.13, 0.96 - rings * 0.20, 0.94 - rings * 0.26],
    rough: 0.86 + rings * 0.09 + fine * 0.04,
  };
}

function ceramic(u, v) {
  const broad = noise(u, v, 6, 173), glaze = noise(u, v, 24, 191);
  return {
    height: 0.50 + (broad - 0.5) * 0.065 + (glaze - 0.5) * 0.018,
    tone: 0.99 + (broad - 0.5) * 0.015,
    rough: 0.88 + glaze * 0.10,
  };
}

/**
 * Return twelve shared PBR materials, descriptive metadata, and one owner-level
 * dispose(). Pass the same THREE namespace as the renderer (no extra library).
 * All colours remain on materials; map bytes are neutral sRGB modulation.
 */
export function createWardrobeMaterials(THREE) {
  if (!THREE?.DataTexture || !THREE?.MeshPhysicalMaterial) {
    throw new TypeError('Pass the renderer\'s THREE namespace to createWardrobeMaterials().');
  }
  const ownedTextures = new Set(), ownedMaterials = new Set();

  function texture(bytes, size, repeat, name, colorSpace) {
    const map = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    map.name = `wardrobe:${name}`;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(...repeat);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.colorSpace = colorSpace;
    map.flipY = false;
    map.anisotropy = 2;
    map.needsUpdate = true;
    ownedTextures.add(map);
    return map;
  }

  function surface(name, sample, { size = 128, repeat = [2, 2], relief = 1 } = {}) {
    const heights = new Float32Array(size * size);
    const albedo = new Uint8Array(size * size * 4);
    const normals = new Uint8Array(size * size * 4);
    const roughness = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, n = i * 4;
      const point = sample(x / size, y / size);
      heights[i] = point.height;
      const tone = Array.isArray(point.tone) ? point.tone : [point.tone, point.tone, point.tone];
      for (let channel = 0; channel < 3; channel++) {
        albedo[n + channel] = Math.round(clamp(tone[channel]) * 255);
        // Three's roughnessMap reads green; fill RGB to keep maps inspectable.
        roughness[n + channel] = Math.round(clamp(point.rough) * 255);
      }
      albedo[n + 3] = roughness[n + 3] = normals[n + 3] = 255;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const left = heights[y * size + (x + size - 1) % size];
      const right = heights[y * size + (x + 1) % size];
      const down = heights[((y + size - 1) % size) * size + x];
      const up = heights[((y + 1) % size) * size + x];
      const nx = (left - right) * relief, ny = (down - up) * relief;
      const inverseLength = 1 / Math.hypot(nx, ny, 1);
      normals[i] = Math.round((nx * inverseLength * 0.5 + 0.5) * 255);
      normals[i + 1] = Math.round((ny * inverseLength * 0.5 + 0.5) * 255);
      normals[i + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
    }
    return {
      map: texture(albedo, size, repeat, `${name}:albedo`, THREE.SRGBColorSpace),
      normalMap: texture(normals, size, repeat, `${name}:normal`, THREE.NoColorSpace),
      roughnessMap: texture(roughness, size, repeat, `${name}:roughness`, THREE.NoColorSpace),
    };
  }

  const surfaces = {
    felt: surface('felt', felt, { repeat: [4, 4], relief: 0.9 }),
    knit: surface('knit', knit, { size: 256, repeat: [2, 2], relief: 3.5 }),
    cotton: surface('cotton', cotton, { repeat: [5, 5], relief: 1.36 }),
    leather: surface('leather', leather, { repeat: [3, 3], relief: 1.4 }),
    wood: surface('wood', wood, { repeat: [1, 2], relief: 0.8 }),
    ceramic: surface('ceramic', ceramic, { repeat: [1, 1], relief: 0.35 }),
  };
  const descriptors = {};
  function material(key, label, family, color, properties) {
    const result = new THREE.MeshPhysicalMaterial({
      name: `wardrobe:${key}`, color, metalness: 0,
      ...surfaces[family], ...properties,
    });
    result.userData.surfaceFamily = family;
    result.userData.procedural = true;
    ownedMaterials.add(result);
    descriptors[key] = Object.freeze({
      label, family, color, textureSize: result.map.image.width,
      repeat: Object.freeze(result.map.repeat.toArray()),
      roughness: result.roughness, sheen: result.sheen, clearcoat: result.clearcoat,
      relief: 'tangent-space normal from periodic height field',
    });
    return result;
  }
  const feltProperties = { roughness: 0.99, sheen: 0.38, sheenColor: '#b2a49a', sheenRoughness: 0.95 };
  const knitProperties = { roughness: 0.92, sheen: 0.48, sheenColor: '#fff4e5', sheenRoughness: 0.86 };
  const cottonProperties = { roughness: 0.86, sheen: 0.16, sheenColor: '#fff8ef', sheenRoughness: 0.78 };
  const result = {
    feltBrown: material('feltBrown', '압축 펠트 · 몸', 'felt', '#403330', feltProperties),
    innerEar: material('innerEar', '압축 펠트 · 귀 안쪽', 'felt', '#65514b', feltProperties),
    tailCoral: material('tailCoral', '압축 펠트 · 산호 꼬리', 'felt', '#cf605b', feltProperties),
    tailDark: material('tailDark', '압축 펠트 · 짙은 꼬리', 'felt', '#342c2a', feltProperties),
    knitCream: material('knitCream', '크림 니트 · V자 뜨개코', 'knit', '#ede2cf', knitProperties),
    knitCoral: material('knitCoral', '산호 니트 · V자 뜨개코', 'knit', '#cf605b', knitProperties),
    cottonCream: material('cottonCream', '크림 면 · 평직', 'cotton', '#ede2cf', cottonProperties),
    cottonTrim: material('cottonTrim', '면 · 가장자리 바이어스', 'cotton', '#cf605b', cottonProperties),
    cottonStitch: material('cottonStitch', '면 · 봉제실', 'cotton', '#f7eddd', { ...cottonProperties, roughness: 0.91 }),
    leather: material('leather', '가죽 · 고운 표면 결', 'leather', '#76513b', { roughness: 0.61, clearcoat: 0.16, clearcoatRoughness: 0.45 }),
    wood: material('wood', '목재 · 세로 나뭇결', 'wood', '#bd9668', { roughness: 0.58, clearcoat: 0.08, clearcoatRoughness: 0.46 }),
    ceramic: material('ceramic', '도자기 · 매끄러운 유약', 'ceramic', '#e3e9e5', { roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.12, ior: 1.48 }),
  };
  let disposed = false;
  return {
    ...result,
    descriptors: Object.freeze(descriptors),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of ownedMaterials) material.dispose();
      for (const map of ownedTextures) map.dispose();
      ownedMaterials.clear(); ownedTextures.clear();
    },
  };
}
