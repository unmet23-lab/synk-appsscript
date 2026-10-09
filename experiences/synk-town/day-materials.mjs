import * as THREE from '/scene-assets/three.module.js';

// Approved shared colour roles: docs/디자인_토큰.json. Character IP colours
// remain on the approved avatar/cast; these accents belong to lived-in objects.
export const TOWN_BRAND = Object.freeze({
  coral: '#F96859', lapis: '#3D6BC9', lapisDeep: '#24448C', meadow: '#7DB45A',
  butter: '#F5C445', pop: '#E05C97', paper: '#FFFFFF', black: '#000000',
});

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const hash = (x, y, seed) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed * 31.3) * 43758.5453; return n - Math.floor(n); };
function noise(x, y, seed, periodX = 0, periodY = periodX) {
  const ix = Math.floor(x), iy = Math.floor(y), dx = x - ix, dy = y - iy, u = dx * dx * (3 - 2 * dx), v = dy * dy * (3 - 2 * dy);
  const x0 = periodX ? (ix % periodX + periodX) % periodX : ix, x1 = periodX ? ((ix + 1) % periodX + periodX) % periodX : ix + 1;
  const y0 = periodY ? (iy % periodY + periodY) % periodY : iy, y1 = periodY ? ((iy + 1) % periodY + periodY) % periodY : iy + 1;
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(x0, y0, seed), hash(x1, y0, seed), u), THREE.MathUtils.lerp(hash(x0, y1, seed), hash(x1, y1, seed), u), v);
}

// Authored albedo, height-derived normals and roughness at the material scale.
// These are generated surface data, not a photograph stretched across the world.
function surface(kind, anisotropy) {
  const size = kind === 'water' ? 128 : 256, count = size * size, relief = new Float32Array(count), colors = new Uint8Array(count * 4), rough = new Uint8Array(count), normals = new Uint8Array(count * 4);
  // Pigment belongs in one layer: a warm timber albedo needs a neutral material
  // multiplier. Doubling those colours made the old surfaces muddy and yellow.
  const palette = kind === 'wood' ? [204, 168, 119] : kind === 'plaster' ? [250, 248, 242] : kind === 'roof' ? [249, 250, 251] : kind === 'stone' ? [228, 230, 225] : [255, 255, 255];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, p = i * 4, nx = x / size, ny = y / size;
    const broad = noise(nx * 6, ny * 6, 19, 6), mid = noise(nx * 33, ny * 33, 3, 33), fine = hash(x, y, 53);
    let value = 1, h = .5, r = .84;
    if (kind === 'wood') {
      // A broad growth band and fine longitudinal pores remain legible on a
      // smooth, oiled timber face. The colour is authored once, in this albedo.
      const knotRadius = (nx - .63) ** 2 / .004 + (ny - .46) ** 2 / .048;
      const knot = Math.exp(-knotRadius), knotRings = Math.pow(.5 + .5 * Math.cos(Math.sqrt(knotRadius) * 17), 3) * knot;
      const wandering = noise(nx * 4, ny * 2, 7, 4, 2) - .5;
      const flow = nx * 18 + Math.sin(ny * Math.PI * 2) * .31 + wandering * .89 + knot * .86;
      const rings = Math.pow(.5 + .5 * Math.sin(flow * Math.PI * 2), 9), pores = noise(nx * 128, ny * 8, 16, 128, 8);
      const earlywood = Math.sin((nx * 3 + Math.sin(ny * Math.PI * 2) * .13) * Math.PI * 2);
      // Narrow latewood wanders through broader uneven growth bands. A soft
      // oval knot has its own rings without a painted black spot or groove.
      value = .957 + broad * .038 + earlywood * .036 - rings * .068 - knotRings * .027 + (pores - .5) * .018 + (fine - .5) * .003;
      h = .49 - rings * .035 - knotRings * .012 + (pores - .5) * .018; r = .50 + rings * .12 + knotRings * .034 + pores * .039;
    } else if (kind === 'plaster') {
      value = .978 + (broad - .5) * .026 + (mid - .5) * .014 + (fine - .5) * .010;
      h = .50 + (mid - .5) * .037 + (fine - .5) * .017; r = .83 + mid * .10;
    } else if (kind === 'roof') {
      // Soft kiln variation and a satin highlight preserve the curved tiles
      // at the walking distance without a glittering high-frequency pattern.
      const firing = noise(nx * 3 + Math.sin(ny * Math.PI * 2) * .12, ny * 4, 47, 3, 4);
      const kiln = noise(nx * 7, ny * 5, 83, 7, 5), glaze = noise(nx * 11, ny * 9, 92, 11, 9);
      value = .918 + firing * .050 + kiln * .028 + (fine - .5) * .003;
      h = .50 + (mid - .5) * .027 + (kiln - .5) * .012 + (fine - .5) * .008;
      r = .43 + firing * .12 + kiln * .043 + (glaze - .5) * .018;
    } else if (kind === 'cotton') {
      // Fine woven threads, rather than the loose pile of the player's felt.
      // Periodic warp/weft keep tile borders continuous and light at distance.
      const warp = Math.pow(.5 + .5 * Math.cos(nx * Math.PI * 64), 5);
      const weft = Math.pow(.5 + .5 * Math.cos(ny * Math.PI * 64), 5);
      const crossing = Math.cos(nx * Math.PI * 32) * Math.cos(ny * Math.PI * 32);
      value = .979 + (warp + weft) * .007 + (fine - .5) * .004;
      h = .48 + (warp + weft) * .032 + crossing * .010; r = .83 + broad * .055;
    } else if (kind === 'leaf') {
      const spine = Math.exp(-((nx - .5) ** 2) / .0012), veins = Math.pow(Math.max(0, Math.cos((ny * 9 - Math.abs(nx - .5) * 3) * Math.PI * 2)), 12);
      value = .936 + broad * .040 + spine * .017 + veins * .011;
      h = .48 + spine * .057 + veins * .026 + (mid - .5) * .011; r = .75 + broad * .095;
    } else if (kind === 'water') {
      value = 1; h = .5 + Math.sin((nx * 3 + ny * 4) * Math.PI * 2) * .055 + Math.sin((nx * 7 - ny * 5) * Math.PI * 2) * .025; r = .16 + mid * .04;
    } else {
      const pore = Math.max(0, .28 - noise(nx * 67, ny * 67, 71, 67));
      const sediment = noise(nx * 4 + Math.sin(ny * Math.PI * 2) * .19, ny * 6, 62, 4, 6);
      const cloud = noise(nx * 3 + Math.sin(ny * Math.PI * 2) * .35, ny * 3, 97, 3, 3);
      const mineral = Math.max(0, cloud - .52);
      value = .969 + (cloud - .5) * .076 + (sediment - .5) * .032 + (mid - .5) * .012 - pore * .075 + mineral * .029 + (fine - .5) * .004;
      h = .50 + (mid - .5) * .048 - pore * .13 + (fine - .5) * .011;
      r = .75 + mid * .072 + pore * .10 - mineral * .11;
    }
    relief[i] = h;
    for (let k = 0; k < 3; k++) colors[p + k] = clamp(Math.round(palette[k] * value), 0, 255);
    colors[p + 3] = 255; rough[i] = Math.round(clamp(r) * 255);
  }
  const at = (x, y) => relief[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * 2.4, dy = (at(x, y - 1) - at(x, y + 1)) * 2.4, inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1), p = (y * size + x) * 4;
    normals[p] = (dx * inverseLength * .5 + .5) * 255; normals[p + 1] = (dy * inverseLength * .5 + .5) * 255; normals[p + 2] = (inverseLength * .5 + .5) * 255; normals[p + 3] = rough[y * size + x];
  }
  function texture(data, color) {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = anisotropy; t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
  }
  // Linear roughness shares the otherwise unused normal alpha. Diffuse alpha
  // stays opaque, so glass, cloth and shadow transparency never depend on it.
  return { map: texture(colors, true), normalMap: texture(normals, false) };
}

function cloneTownMaterial() {
  // Three's stock clone deliberately omits callbacks. Town clones must keep
  // both their surface lookup and existing timber/leaf hooks, even two levels
  // deep. Copy all ordinary properties using Three's own implementation.
  const clone = new this.constructor().copy(this);
  clone.onBeforeCompile = this.onBeforeCompile;
  clone.customProgramCacheKey = this.customProgramCacheKey;
  clone.clone = cloneTownMaterial;
  clone.needsUpdate = true;
  return clone;
}

function usePackedSurface(material) {
  const beforeCompile = material.onBeforeCompile, beforeKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    beforeCompile.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec4 townSurfaceTexel = texture2D(normalMap, vNormalMapUv);
        roughnessFactor *= townSurfaceTexel.a;
      #else
        #ifdef USE_ROUGHNESSMAP
          roughnessFactor *= texture2D(roughnessMap, vRoughnessMapUv).g;
        #endif
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',
      THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = townSurfaceTexel.rgb * 2.0 - 1.0;'));
  };
  material.customProgramCacheKey = () => `${beforeKey}|town-normal-roughness-v10`;
  material.clone = cloneTownMaterial;
  material.needsUpdate = true;
}

export function applyTownMaterials(materials, anisotropy = 4) {
  const owned = [], packed = new Set(), groups = Object.fromEntries(['wood', 'plaster', 'roof', 'stone', 'leaf', 'water', 'cotton'].map(k => [k, surface(k, anisotropy)]));
  function apply(material, kind, color, repeat, strength = .35) {
    material.color.set(color); material.bumpMap = null; material.roughnessMap = null;
    for (const [key, source] of Object.entries(groups[kind])) { const t = source.clone(); t.repeat.set(...repeat); t.needsUpdate = true; material[key] = t; owned.push(t); }
    material.normalScale.set(strength, strength); material.roughness = 1; material.needsUpdate = true; packed.add(material);
  }
  apply(materials.wood, 'wood', '#ffffff', [1, 1], .34);
  apply(materials.darkWood, 'wood', '#8c7d6e', [1, 1], .30);
  materials.wood.envMapIntensity = .88; materials.darkWood.envMapIntensity = .84;
  // The timber is instanced in three orientations. Its UVs follow the longest
  // physical axis, instead of stretching the same vertical grain over every
  // beam. Non-instanced authored window/frame meshes keep their own UVs.
  for (const material of [materials.wood, materials.darkWood]) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec3 townTimberScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec3 townTimberPosition = position * townTimberScale;
          vec3 townTimberNormal = abs(normal);
          vec2 townTimberUv;
          if (townTimberScale.x > townTimberScale.y && townTimberScale.x > townTimberScale.z) {
            townTimberUv = vec2(townTimberNormal.y > townTimberNormal.z ? townTimberPosition.z : townTimberPosition.y, townTimberPosition.x);
          } else if (townTimberScale.z > townTimberScale.y) {
            townTimberUv = vec2(townTimberNormal.y > townTimberNormal.x ? townTimberPosition.x : townTimberPosition.y, townTimberPosition.z);
          } else {
            townTimberUv = vec2(townTimberNormal.z > townTimberNormal.x ? townTimberPosition.x : townTimberPosition.z, townTimberPosition.y);
          }
          townTimberUv = townTimberUv / vec2(.26, 1.15) + vec2(dot(instanceMatrix[3].xyz, vec3(.31, .47, .23)), dot(instanceMatrix[3].xyz, vec3(.19, .37, .41)));
          #ifdef USE_MAP
            vMapUv = (mapTransform * vec3(townTimberUv, 1.0)).xy;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv = (normalMapTransform * vec3(townTimberUv, 1.0)).xy;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = (roughnessMapTransform * vec3(townTimberUv, 1.0)).xy;
          #endif
        #endif
      `);
    };
    material.customProgramCacheKey = () => 'town-longitudinal-timber-v9';
  }
  apply(materials.plaster, 'plaster', '#ffffff', [3, 3], .30);
  apply(materials.plasterWarm, 'plaster', '#fffdf7', [3, 3], .28);
  apply(materials.stone, 'stone', '#ffffff', [1.5, 1.5], .46);
  apply(materials.roofSlate, 'roof', '#344b64', [1.6, 2], .24);
  apply(materials.roofTerra, 'roof', '#3a5067', [1.6, 2], .24);
  apply(materials.roofSage, 'roof', '#425970', [1.6, 2], .24);
  for (const roof of [materials.roofSlate, materials.roofTerra, materials.roofSage]) {
    roof.metalness = 0; roof.envMapIntensity = 1.16;
  }
  materials.paving = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  apply(materials.paving, 'stone', '#ffffff', [1, 1], .43);
  materials.ceramic.color.set('#fcfbf6'); materials.ceramic.roughness = .23; materials.ceramic.metalness = 0;
  materials.ceramic.clearcoat = .92; materials.ceramic.clearcoatRoughness = .16; materials.ceramic.ior = 1.48; materials.ceramic.envMapIntensity = 1.10;
  materials.glass.color.set('#d6e7eb'); materials.glass.metalness = 0; materials.glass.roughness = .075;
  materials.glass.ior = 1.48; materials.glass.clearcoat = 1; materials.glass.clearcoatRoughness = .07; materials.glass.envMapIntensity = 1.24;
  materials.brass.color.set('#baa17d'); materials.brass.metalness = .72; materials.brass.roughness = .33;
  materials.frame.color.set('#3c4b57'); materials.frame.metalness = .58; materials.frame.roughness = .32;
  materials.paper.color.set(TOWN_BRAND.paper);
  materials.cotton = new THREE.MeshPhysicalMaterial({ color: TOWN_BRAND.paper, roughness: .95, sheen: .55, sheenRoughness: .79, sheenColor: '#ffffff', side: THREE.DoubleSide });
  apply(materials.cotton, 'cotton', TOWN_BRAND.paper, [2, 2], .20);
  apply(materials.awning, 'cotton', TOWN_BRAND.paper, [2, 2], .20);
  materials.awning.sheen = .55; materials.awning.sheenRoughness = .79; materials.awning.sheenColor.set('#ffffff');
  for (const key of ['lapis', 'coral', 'butter', 'pop']) {
    materials[key] = materials.cotton.clone(); materials[key].color.set(TOWN_BRAND[key]); packed.add(materials[key]);
  }
  const ripple = groups.water.normalMap.clone(); ripple.repeat.set(4, 4); ripple.needsUpdate = true; owned.push(ripple);
  materials.water.color.set('#709da0'); materials.water.normalMap = ripple; materials.water.normalScale.set(.30, .30);
  materials.water.metalness = 0; materials.water.roughness = .18; materials.water.ior = 1.333; materials.water.envMapIntensity = 1.15;
  materials.foliage = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .83, side: THREE.DoubleSide, emissive: '#597b36', emissiveIntensity: 0 });
  apply(materials.foliage, 'leaf', '#ffffff', [1, 1], .28);
  // A thin leaf passes a little warm light through its shaded side. This stays
  // in the existing foliage shader: no extra lights, targets or geometry.
  materials.foliage.onBeforeCompile = shader => {
    shader.uniforms.townLeafSunDirection = { value: new THREE.Vector3(-9, 11, 7).normalize() };
    shader.uniforms.townLeafSunColor = { value: new THREE.Color('#fff4e5') };
    shader.fragmentShader = 'uniform vec3 townLeafSunDirection; uniform vec3 townLeafSunColor;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      vec3 townLeafSunView = normalize((viewMatrix * vec4(townLeafSunDirection, 0.0)).xyz);
      float townLeafThrough = pow(max(0.0, -dot(normal, townLeafSunView)), 1.6);
      reflectedLight.directDiffuse += diffuseColor.rgb * townLeafSunColor * vec3(.82, 1.0, .52) * townLeafThrough * .18;
    `);
  };
  materials.foliage.customProgramCacheKey = () => 'town-thin-leaf-v6';
  packed.forEach(usePackedSurface);
  Object.values(groups).forEach(g => Object.values(g).forEach(t => t.dispose()));
  return { textures: owned, version: 10 };
}
