import * as THREE from './scene-assets/three.module.js';

// Fixed, mipmapped surface maps: no per-pixel procedural material loop at runtime.
// Values describe material only; directional illumination remains in the lights.
export function createSurfaceLibrary() {
  const owned = [], size = 256;
  const fract = n => n - Math.floor(n);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7 + 741.3) * 43758.5453);
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), dx = fract(x), dy = fract(y), u = dx * dx * (3 - 2 * dx), v = dy * dy * (3 - 2 * dy);
    return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v;
  };
  function map(field, color = false, repeats = [1, 1]) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const context = canvas.getContext('2d'), pixels = context.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const values = field(x / size, y / size, x, y), index = (y * size + x) * 4;
      for (let i = 0; i < 3; i++) pixels.data[index + i] = Math.max(0, Math.min(255, Math.round(values[i])));
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0); const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeats);
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    owned.push(texture); return texture;
  }
  function normals(height, repeats = [1, 1], amplitude = 3) {
    const delta = 1 / size;
    return map((u, v) => {
      const dx = (height(u + delta, v) - height(u - delta, v)) * amplitude;
      const dy = (height(u, v + delta) - height(u, v - delta)) * amplitude;
      const l = Math.hypot(dx, dy, 1); return [128 - dx / l * 127, 128 - dy / l * 127, 128 + 127 / l];
    }, false, repeats);
  }
  const woodHeight = (u, v) => {
    const longGrain = v * 74 + Math.sin(u * 7 + v * 6) * 1.3 + Math.sin(u * 17 - v * 9) * .25;
    return Math.sin(longGrain * Math.PI) * .14 + noise(u * 13, v * 160) * .36 + noise(u * 2, v * 12) * .2;
  };
  const wood = map((u, v) => {
    const grain = woodHeight(u, v), slow = noise(u * 3, v * 9) - .5, fibre = noise(u * 40, v * 230) - .5;
    return [191 + grain * 19 + slow * 16 + fibre * 9, 151 + grain * 20 + slow * 13 + fibre * 7, 101 + grain * 22 + slow * 10 + fibre * 6];
  }, true);
  const woodNormal = normals(woodHeight, [1, 1], 1.15);
  const woodRoughness = map((u, v) => { const r = 170 + woodHeight(u, v) * 20; return [r, r, r]; });
  const stoneHeight = (u, v) => noise(u * 58, v * 58) * .42 + noise(u * 139, v * 139) * .13 + noise(u * 8, v * 8) * .12;
  const stone = map((u, v) => {
    const n = noise(u * 8, v * 8) - .5, fleck = noise(u * 110, v * 110) - .5, pore = Math.max(0, .27 - noise(u * 67, v * 67)) * 42;
    return [225 + n * 10 + fleck * 7 - pore, 222 + n * 11 + fleck * 7 - pore, 211 + n * 11 + fleck * 7 - pore];
  }, true);
  const stoneNormal = normals(stoneHeight, [1, 1], .95);
  const stoneRoughness = map((u, v) => { const r = 208 + (noise(u * 28, v * 28) - .5) * 28; return [r, r, r]; });
  // Leaf pigment is distinct from its veins/normal. A broad central rib should
  // catch light gently, not become a white stripe baked into every leaf.
  const leafHeight = (u, v) => {
    const distance = Math.abs(u - .5), rib = Math.exp(-distance * 120) * .3;
    const veins = Math.pow(Math.max(0, Math.cos((v * 10 - distance * 2.9) * Math.PI * 2)), 14) * .065 * (1 - distance * 1.7);
    return rib + veins + noise(u * 90, v * 160) * .012;
  };
  const leaf = map((u, v) => {
    const ribs = leafHeight(u, v), patch = noise(u * 4, v * 8) - .5;
    const center = Math.exp(-Math.abs(u - .5) * 95), edge = Math.abs(u - .5) * 2;
    return [174 + patch * 16 + ribs * 25 + center * 8 - edge * 12, 198 + patch * 15 + ribs * 18 + center * 7 - edge * 11, 127 + patch * 10 + ribs * 16 - edge * 8];
  }, true);
  const leafNormal = normals(leafHeight, [1, 1], 1.8);
  const leafRoughness = map((u, v) => { const r = 174 + noise(u * 7, v * 11) * 20 - leafHeight(u, v) * 17; return [r, r, r]; });
  return { wood, woodNormal, woodRoughness, stone, stoneNormal, stoneRoughness, leaf, leafNormal, leafRoughness,
    stats: { textures: owned.length, edge: size }, dispose() { owned.forEach(texture => texture.dispose()); } };
}
