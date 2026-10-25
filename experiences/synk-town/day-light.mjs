// Time-of-day light and rain on the town screen (vertical slice design §2-2·§4-4, W7). The numbers come
// from town/light.mjs (lightAt: the same village at the same server time gives the same light); this
// rig turns them into the sun, hemisphere and fill lights, the sky (the photo dimmed under a gradient
// overlay with stars), the fog, the baked town's two shares, lit windows and lanterns, wet ground and
// roofs, and the rain streaks. It never adds or removes a light, flips `transparent` or changes a
// define after the first frame, so an hour going by compiles nothing. apply(null) is the approved noon.
// No three.js import: THREE comes in, so the plain helpers below run under node tests too.

const SKY_RADIUS = 95, MAX_SHELTERS = 16, WINDOW_GLOW = '#ffcf8a';
const WINDOW_NIGHT_OPACITY = .78, THIN_NIGHT_OPACITY = .5, WINDOW_NIGHT_GLOW = 1.15, LANTERN_NIGHT = 1.6;
/** The rain's clock folds every minute; each drop falls a whole number of laps in it, so the fold is seamless. */
const RAIN_PERIOD_MS = 60000;
const quantize = list => list.map(v => Math.round(v * 500)).join(',');

/** The shadow camera's focus on the light's own texel grid for a unit sun direction d (W7: d follows the
 * hour in v20) — r across the light, u its up seen on the ground — so the shadow does not crawl. */
export function shadowFocus(x, z, extent, mapSize, d) {
  const horizontal = Math.hypot(d.x, d.z), rx = d.z / horizontal, rz = -d.x / horizontal,
    ux = -d.x * d.y / horizontal, uz = -d.z * d.y / horizontal, step = 2 * extent / mapSize;
  const r = Math.round((x * rx + z * rz) / step) * step, u = Math.round((x * ux + z * uz) / step) * step, determinant = rx * uz - rz * ux;
  return { x: (r * uz - rz * u) / determinant, z: (rx * u - r * ux) / determinant, step };
}
/** How far the sun sits from the focus and how deep its shadow box reaches. It never sits lower than the
 * approved 11 m above the focus — noon keeps the approved √251 and depth — and a low evening sun reaches
 * far enough for its long shadows. */
export function sunReach(d, scale, extent, far) {
  const reach = Math.max(Math.sqrt(251), 11 / d.y) * scale;
  return { reach, far: Math.max(far, reach + extent * Math.hypot(d.x, d.z) / d.y + 5) };
}

const SKY_VERTEX = `varying vec3 vSkyDirection;
void main() { vSkyDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAGMENT = `uniform vec3 skyTop; uniform vec3 skyHorizon; uniform float skyAlpha; uniform float skyStars;
varying vec3 vSkyDirection;
float skyHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vSkyDirection);
  vec3 color = mix(skyHorizon, skyTop, pow(clamp(d.y, 0.0, 1.0), 0.6));
  if (skyStars > 0.0 && d.y > 0.06) {
    vec2 grid = vec2(atan(d.z, d.x), asin(d.y)) * 150.0, cell = floor(grid);
    float lit = step(0.986, skyHash(cell)) * smoothstep(0.26, 0.0, length(fract(grid) - 0.5));
    color += vec3(0.85, 0.9, 1.0) * lit * skyStars * smoothstep(0.06, 0.3, d.y) * (0.55 + 0.45 * skyHash(cell + 7.0));
  }
  gl_FragColor = vec4(color, skyAlpha);
  #include <colorspace_fragment>
}`;
// One quad per drop. The vertex shader drops it with the server's time and wraps it round the view
// centre, so the CPU never moves a drop; under a roof (a shelter rectangle below its top) none is drawn.
const RAIN_VERTEX = `uniform float rainTime; uniform vec3 rainCenter; uniform float rainRadius; uniform float rainHeight; uniform float rainPixel;
uniform vec4 rainShelters[${MAX_SHELTERS}]; uniform float rainShelterTops[${MAX_SHELTERS}]; uniform int rainShelterCount;
attribute vec4 drop; attribute vec2 corner;
varying float vRainAlpha;
#include <fog_pars_vertex>
void main() {
  float span = 2.0 * rainRadius, laps = floor(47.0 + 17.0 * drop.w);
  vec2 xz = rainCenter.xz + mod(drop.xy * span - rainCenter.xz + rainRadius, span) - rainRadius;
  float y = rainCenter.y - 1.5 + mod(drop.z * rainHeight - rainTime * laps * rainHeight / ${RAIN_PERIOD_MS / 1000}.0, rainHeight);
  vec3 fall = normalize(vec3(0.08, -1.0, 0.05));
  vec3 p = vec3(xz.x, y, xz.y) + fall * (0.34 + 0.2 * drop.w) * corner.y;
  float hidden = step(p.y, 0.03);
  for (int i = 0; i < ${MAX_SHELTERS}; i++) {
    if (i >= rainShelterCount) break;
    vec4 r = rainShelters[i];
    if (p.x > r.x && p.x < r.z && p.z > r.y && p.z < r.w && p.y < rainShelterTops[i]) hidden = 1.0;
  }
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vec3 axis = normalize((viewMatrix * vec4(fall, 0.0)).xyz);
  // About a CSS pixel and a half wide at any distance: a thin bright line, never a smear or a gap.
  mvPosition.xyz += normalize(cross(axis, normalize(mvPosition.xyz))) * rainPixel * length(mvPosition.xyz) * 0.75 * corner.x;
  float edge = 1.0 - smoothstep(rainRadius * 0.72, rainRadius, length(xz - rainCenter.xz));
  vRainAlpha = (1.0 - hidden) * edge * smoothstep(1.4, 3.2, length(mvPosition.xyz)) * (0.55 + 0.45 * drop.w);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const RAIN_FRAGMENT = `uniform vec3 rainColor; uniform float rainAlpha; varying float vRainAlpha;
#include <fog_pars_fragment>
void main() {
  float a = rainAlpha * vRainAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(rainColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** The shared uniforms every baked material reads (day-district.mjs bakedMaterial binds them in its hook,
 * so the faded copies the occlusion fade makes keep reading them). */
export function bakedLightUniforms(THREE) {
  return { synkSkyTint: { value: new THREE.Color(1, 1, 1) }, synkSunTint: { value: new THREE.Color(1, 1, 1) },
    synkWet: { value: 0 }, synkWetDark: { value: new THREE.Vector3() }, synkWetSheen: { value: 0 } };
}

export function createTownLight({ THREE, scene, renderer, sun, hemi, fill, baked, phone = false }) {
  const srgb = (target, rgb) => target.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
  const base = { sunColor: sun.color.clone(), sunIntensity: sun.intensity, shadow: sun.shadow.intensity ?? 1, hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(),
    hemiIntensity: hemi.intensity, fill: fill.intensity, fog: scene.fog.color.clone(), env: scene.environmentIntensity, sky: .95 };
  // The approved axis exactly: a baked town and the noon fallback keep it.
  const approvedDirection = sun.position.clone().normalize(), direction = approvedDirection.clone();
  const fogRange = { near: scene.fog.near, far: scene.fog.far };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ name: 'town-sky-overlay',
    uniforms: { skyTop: { value: new THREE.Color() }, skyHorizon: { value: new THREE.Color() }, skyAlpha: { value: 0 }, skyStars: { value: 0 } },
    vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  // Drawn first among the see-through things, behind every opaque one (its depth test keeps it to the sky).
  Object.assign(sky, { name: 'town-sky-overlay', visible: false, frustumCulled: false, renderOrder: -1 }); sky.scale.setScalar(SKY_RADIUS);
  sky.userData.noContactAO = true; scene.add(sky);
  let rain = null, rainCapacity = 0;
  const shelters = { rects: Array.from({ length: MAX_SHELTERS }, () => new THREE.Vector4()), tops: new Array(MAX_SHELTERS).fill(0), count: 0 };
  const glass = new Map(), lanterns = new Map(), wet = new Map(), glow = new THREE.Color(WINDOW_GLOW);
  let last = null, signature = '', bakedTown = false, drawnDrops = 0, appliedAt = 0, reducedNow = false;
  // The sky overlay and the rain are drawn once on the first frames (alpha 0, no drops: nothing shows) so their
  // programs exist before the first dusk or the first rain — an hour going by then compiles nothing at all.
  let warm = 0;

  function makeRain(capacity) {
    const drops = new Float32Array(capacity * 16), corners = new Float32Array(capacity * 8), index = new Uint32Array(capacity * 6);
    // A fixed sequence: the same drops on every device (only how many are drawn follows the weather).
    let seed = 7919; const next = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < capacity; i++) {
      const d = [next(), next(), next(), next()];
      for (let k = 0; k < 4; k++) { drops.set(d, (i * 4 + k) * 4); corners.set([k & 1 ? 1 : -1, k >> 1], (i * 4 + k) * 2); }
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 12), 3));
    geometry.setAttribute('drop', new THREE.BufferAttribute(drops, 4)); geometry.setAttribute('corner', new THREE.BufferAttribute(corners, 2));
    geometry.setIndex(new THREE.BufferAttribute(index, 1)); geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({ name: 'town-rain', vertexShader: RAIN_VERTEX, fragmentShader: RAIN_FRAGMENT, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { rainTime: { value: 0 }, rainCenter: { value: new THREE.Vector3() }, rainRadius: { value: 11 }, rainHeight: { value: 9 }, rainPixel: { value: .001 },
        rainShelters: { value: shelters.rects }, rainShelterTops: { value: shelters.tops }, rainShelterCount: { value: 0 }, rainColor: { value: new THREE.Color() }, rainAlpha: { value: 0 } }]) });
    // merge() copies values: keep the shelter arrays shared so later shelters reach the shader.
    material.uniforms.rainShelters.value = shelters.rects; material.uniforms.rainShelterTops.value = shelters.tops;
    const mesh = new THREE.Mesh(geometry, material);
    Object.assign(mesh, { name: 'town-rain', frustumCulled: false, renderOrder: 4, visible: false }); mesh.userData.noContactAO = true;
    scene.add(mesh); rainCapacity = capacity; return mesh;
  }

  /** Materials the hour changes: window glass and its clones, the wall lanterns, walkable ground and roofs. */
  function register(root) {
    root.traverse(object => {
      for (const material of [object.material].flat()) {
        if (!material || material.userData.townBaked) continue;
        if (material.userData.townGlass && !glass.has(material)) glass.set(material, { opacity: material.opacity, emissive: material.emissive.clone(), intensity: material.emissiveIntensity });
        if (material.userData.townLantern && !lanterns.has(material)) lanterns.set(material, material.emissiveIntensity);
        if ((material.userData.townGround || material.userData.townSurface === 'roof') && !wet.has(material) && material.color)
          wet.set(material, { color: material.color.clone(), roughness: material.roughness, roof: material.userData.townSurface === 'roof' });
      }
    });
    paintMaterials(last);
  }
  function paintMaterials(state) {
    const g = state?.glass ?? 0, l = state?.lantern ?? 0, w = state?.rain.wet ?? 0;
    for (const [material, b] of glass) {
      const night = Math.max(b.opacity, b.opacity < .2 ? THIN_NIGHT_OPACITY : WINDOW_NIGHT_OPACITY);
      material.opacity = b.opacity + (night - b.opacity) * g;
      material.emissive.copy(b.emissive).lerp(glow, g); material.emissiveIntensity = b.intensity + (WINDOW_NIGHT_GLOW - b.intensity) * g;
    }
    for (const [material, intensity] of lanterns) material.emissiveIntensity = intensity + (LANTERN_NIGHT - intensity) * l;
    for (const [material, b] of wet) {
      const dark = state ? (b.roof ? state.rain.wetRoof : state.rain.wetGround) * w : 0;
      material.color.copy(b.color).multiplyScalar(1 - dark); material.roughness = b.roughness * (1 - (state?.rain.wetRough ?? 0) * w);
    }
  }
  /** Shelter rectangles (world boxes of the buildings and houses), the largest footprints first. */
  function setShelters(boxes) {
    const area = b => (b.max.x - b.min.x) * (b.max.z - b.min.z);
    const list = boxes.filter(b => b && !b.isEmpty()).sort((a, b) => area(b) - area(a)).slice(0, MAX_SHELTERS);
    list.forEach((b, i) => { shelters.rects[i].set(b.min.x, b.min.z, b.max.x, b.max.z); shelters.tops[i] = b.max.y; });
    shelters.count = list.length; if (rain) rain.material.uniforms.rainShelterCount.value = shelters.count;
  }
  /** The camera layout's own fog distances; the hour scales them (dawn mist comes close). */
  function setFogRange(near, far) {
    fogRange.near = near; fogRange.far = far;
    scene.fog.near = near * (last?.fog.near ?? 1); scene.fog.far = far * (last?.fog.far ?? 1);
  }

  /** Paint one light state (lightAt's), or the approved noon look for null. Returns whether it changed. */
  function apply(state = null, { reducedMotion = false } = {}) {
    const next = state ? [quantize([state.sun.intensity, state.hemi.intensity, state.overlay.alpha, state.glass, state.lantern, state.stars, state.rain.drops, state.rain.wet,
      state.rain.overcast, state.env, state.fog.near, state.fog.far]), quantize(state.baked.sky), quantize(state.baked.sun), quantize(state.sun.direction), quantize(state.fog.color),
      bakedTown, reducedMotion].join('|') : `noon|${bakedTown}`;
    if (state) { appliedAt = performance.now(); last = state; }
    reducedNow = reducedMotion;
    if (next === signature) return false;
    signature = next; last = state;
    if (!state) {
      sun.color.copy(base.sunColor); sun.intensity = base.sunIntensity; if ('intensity' in sun.shadow) sun.shadow.intensity = base.shadow;
      hemi.color.copy(base.hemiSky); hemi.groundColor.copy(base.hemiGround); hemi.intensity = base.hemiIntensity; fill.intensity = base.fill;
      scene.fog.color.copy(base.fog); scene.fog.near = fogRange.near; scene.fog.far = fogRange.far;
      scene.environmentIntensity = base.env; scene.backgroundIntensity = base.sky; direction.copy(approvedDirection);
      sky.visible = false; if (rain) rain.visible = false; drawnDrops = 0;
      if (baked) { baked.synkSkyTint.value.setRGB(1, 1, 1); baked.synkSunTint.value.setRGB(1, 1, 1); baked.synkWet.value = 0; }
      paintMaterials(null); return true;
    }
    srgb(sun.color, state.sun.color); sun.intensity = state.sun.intensity; if ('intensity' in sun.shadow) sun.shadow.intensity = state.sun.shadow;
    if (bakedTown) direction.copy(approvedDirection); else direction.fromArray(state.sun.direction).normalize();
    srgb(hemi.color, state.hemi.sky); srgb(hemi.groundColor, state.hemi.ground); hemi.intensity = state.hemi.intensity; fill.intensity = state.fill;
    srgb(scene.fog.color, state.fog.color); scene.fog.near = fogRange.near * state.fog.near; scene.fog.far = fogRange.far * state.fog.far;
    scene.environmentIntensity = state.env; scene.backgroundIntensity = state.skyMap;
    const u = sky.material.uniforms; srgb(u.skyTop.value, state.overlay.top); srgb(u.skyHorizon.value, state.overlay.horizon);
    u.skyAlpha.value = state.overlay.alpha; u.skyStars.value = state.stars; sky.visible = state.overlay.alpha > .001;
    if (baked) {
      // Linear multipliers of the baked radiance: no colour-space conversion.
      baked.synkSkyTint.value.setRGB(...state.baked.sky); baked.synkSunTint.value.setRGB(...state.baked.sun);
      baked.synkWet.value = state.rain.wet; baked.synkWetDark.value.set(state.rain.wetGround, state.rain.wetRoof, state.rain.wetWall); baked.synkWetSheen.value = state.rain.wetSheen;
    }
    paintMaterials(state);
    const capacity = phone ? state.rain.dropsPhone : state.rain.dropsPc;
    drawnDrops = Math.round(capacity * state.rain.drops * (reducedMotion ? state.rain.reducedShare : 1));
    if (!rain) { rain = makeRain(capacity); rain.material.uniforms.rainShelterCount.value = shelters.count; }
    if (rain) {
      const r = rain.material.uniforms, lit = Math.min(1, .2126 * state.baked.sky[0] + .7152 * state.baked.sky[1] + .0722 * state.baked.sky[2]);
      // Streaks catch the sky: lighter than what they fall past, quiet in the dark.
      r.rainColor.value.setRGB(.86, .9, .95).multiplyScalar(.25 + .75 * lit); r.rainAlpha.value = .2 + .12 * lit; r.rainHeight.value = state.rain.height;
      rain.geometry.setDrawRange(0, Math.min(drawnDrops, rainCapacity) * 6); rain.visible = drawnDrops > 0;
    }
    return true;
  }
  /** Each drawn frame: the sky follows the camera; the rain the view centre (wider over the whole town) and the
   * server's clock, held still under reduced motion. */
  function frame(now, camera, center, wideRadius = 0) {
    // Just inside the far plane, whatever the view: a dome nearer than far would paint over the hills behind it
    // (the map overview's far is about 135 m — W7 screen review).
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * .95);
    if (warm === 1) { sky.visible = sky.material.uniforms.skyAlpha.value > .001; rain.visible = drawnDrops > 0; warm = 2; }
    if (warm === 0 && rain) { sky.visible = rain.visible = true; warm = 1; }
    if (!rain?.visible || !last) return;
    const r = rain.material.uniforms; r.rainCenter.value.copy(center); r.rainRadius.value = Math.max(last.rain.radius, wideRadius);
    r.rainPixel.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, renderer?.domElement.clientHeight || 900);
    if (!reducedNow) r.rainTime.value = (((last.atMs + now - appliedAt) % RAIN_PERIOD_MS) + RAIN_PERIOD_MS) % RAIN_PERIOD_MS / 1000;
  }
  function setBaked(value) { if (bakedTown === !!value) return; bakedTown = !!value; const state = last; signature = ''; apply(state, { reducedMotion: reducedNow }); }
  // The photo sky arrives late and sets its own intensity: paint the hour over it again.
  function reapply() { const state = last; signature = ''; apply(state, { reducedMotion: reducedNow }); }
  const sunMode = () => (bakedTown ? 'baked-noon-axis' : last ? 'hour-sun-axis' : 'unchanged-sun-axis');
  function stats() {
    return { revision: 1, applied: !!last, key: last?.key ?? null, band: last?.band ?? null, localMinute: last ? Math.round(last.localMinute * 10) / 10 : null,
      sunIntensity: sun.intensity, sunDirection: direction.toArray().map(v => Math.round(v * 1000) / 1000), sunMode: sunMode(), shadowIntensity: sun.shadow.intensity ?? null,
      overlayAlpha: sky.visible ? sky.material.uniforms.skyAlpha.value : 0, glass: last?.glass ?? 0, lantern: last?.lantern ?? 0, stars: last?.stars ?? 0,
      fog: { near: scene.fog.near, far: scene.fog.far, color: scene.fog.color.getHexString() },
      baked: baked ? { sky: baked.synkSkyTint.value.toArray(), sun: baked.synkSunTint.value.toArray(), wet: baked.synkWet.value } : null,
      rain: { drops: last?.rain.drops ?? 0, overcast: last?.rain.overcast ?? 0, wet: last?.rain.wet ?? 0, drawn: rain?.visible ? drawnDrops : 0, capacity: rainCapacity, shelters: shelters.count },
      materials: { glass: glass.size, lanterns: lanterns.size, wet: wet.size }, programs: renderer?.info.programs?.length ?? null };
  }
  function dispose() {
    sky.geometry.dispose(); sky.material.dispose(); scene.remove(sky);
    if (rain) { rain.geometry.dispose(); rain.material.dispose(); scene.remove(rain); }
  }
  // Whether streaks are falling now (a seated still view keeps drawing while they do — W7b).
  const rainVisible = () => !!rain?.visible && drawnDrops > 0;
  return { apply, register, setShelters, setFogRange, setBaked, reapply, frame, rainVisible, sunDirection: () => direction, sunMode, stats, dispose };
}
