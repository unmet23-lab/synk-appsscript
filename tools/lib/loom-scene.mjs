/** Loom scene motion, independent of React, DOM and renderer.
 * Seconds, radians and normalized scene coordinates. The caller owns one state
 * per scene, calls stepScene once per frame, and shares the pose with all assets.
 * These visual coefficients are a starting point, not a measured device budget.
 */
export const LIMITS = Object.freeze({
  step: 1 / 120, maxDt: 1 / 15, compression: 0.04,
  turn: 0.055, lean: 0.012, breathe: 0.0012, wind: 1,
});
export const CONFIG = Object.freeze({
  seed: 23, windStrength: 0, gustStrength: 0.32,
  gustInterval: 15, gustDuration: 3, gustPeak: 2,
  breathPeriod: 5.8, blinkMin: 5, blinkMax: 10,
  leafMin: 20, leafMax: 32, leafDuration: 7,
});
export const defaultConfig = CONFIG;
export const limits = LIMITS;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function gustEnvelope(age,c){
  if(age<=0||age>=c.gustDuration-1e-9)return 0;
  return age<=c.gustPeak?smooth(age/c.gustPeak)
    :1-smooth((age-c.gustPeak)/(c.gustDuration-c.gustPeak));
}
function beginGust(state,start,withLeaf=false){
  state.gustStart=start;state.gustDirection=1;
  state.nextGust=start+state.config.gustInterval;
  // A seed can catch a scheduled breeze; it never starts an extra grass burst.
  if(withLeaf||start>=state.nextLeaf){
    state.leafStart=start;
    state.nextLeaf=start+state.config.leafMin+random(state)*(state.config.leafMax-state.config.leafMin);
  }
}

function random(state) {
  let n = state.rng;
  n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
  state.rng = n >>> 0;
  return state.rng / 4294967296;
}
function spring(value, velocity, target, speed, dt) {
  // Critically damped spring, integrated on the shared fixed time step.
  velocity += ((target - value) * speed * speed - 2 * speed * velocity) * dt;
  return [value + velocity * dt, velocity];
}

export function createScene(config = {}) {
  const c = { ...CONFIG, ...config };
  c.seed = (finite(c.seed, CONFIG.seed) >>> 0) || CONFIG.seed;
  c.windStrength = clamp(finite(c.windStrength, CONFIG.windStrength), 0, 0.4);
  c.gustStrength = clamp(finite(c.gustStrength, CONFIG.gustStrength), 0, 1);
  c.gustInterval=clamp(finite(c.gustInterval,CONFIG.gustInterval),4,60);
  c.gustDuration=clamp(finite(c.gustDuration,CONFIG.gustDuration),.5,Math.min(8,c.gustInterval));
  c.gustPeak=clamp(finite(c.gustPeak,CONFIG.gustPeak),.1,c.gustDuration-.1);
  c.breathPeriod = clamp(finite(c.breathPeriod, CONFIG.breathPeriod), 3, 12);
  c.blinkMin = clamp(finite(c.blinkMin, 5), 5, 10);
  c.blinkMax = clamp(finite(c.blinkMax, 10), c.blinkMin, 10);
  c.leafMin = Math.max(8, finite(c.leafMin, CONFIG.leafMin));
  c.leafMax = Math.max(c.leafMin, finite(c.leafMax, CONFIG.leafMax));
  c.leafDuration = clamp(finite(c.leafDuration, CONFIG.leafDuration), 3, 8);
  const state = {
    config: Object.freeze(c), rng: c.seed, time: 0, timestamp: 0,
    wind: 0, attention: { x: 0, y: 0 },
    body: { turn: 0, lean: 0, compression: 0 }, mode: 'rest',
    velocity: { x: 0, y: 0, turn: 0, lean: 0, compression: 0 },
    leaf: { x: -1.15, y: 0.3, rotation: 0, visible: false },
    phase: 0, nextBlink: 0, blinkStart: -100, nextLeaf: 0,
    leafStart: -100, gustStart: -100, gustDirection: 1,
    nextGust:c.gustInterval-c.gustDuration,
    accumulator: 0, frozen: false, gustHeld: false, reading: false,
  };
  state.phase = random(state) * Math.PI * 2;
  state.nextBlink = c.blinkMin + random(state) * (c.blinkMax - c.blinkMin);
  state.nextLeaf = 8 + random(state) * 4;
  return state;
}

function advance(state, dt, pointer) {
  state.time += dt;
  state.timestamp = state.time;
  const c = state.config, t = state.time;
  if (t >= state.nextBlink) {
    state.blinkStart = t;
    state.nextBlink = t + c.blinkMin + random(state) * (c.blinkMax - c.blinkMin);
  }
  if(t+1e-9>=state.nextGust)beginGust(state,state.nextGust);
  const gustAge = t - state.gustStart;
  const gust=gustEnvelope(gustAge,c)*c.gustStrength*state.gustDirection;
  const ambient = c.windStrength * (0.65 * Math.sin(t * 0.37 + state.phase)
    + 0.35 * Math.sin(t * 0.19 + state.phase * 1.7));
  state.wind = clamp((ambient + gust) * (state.reading ? 0.25 : 1), -1, 1);
  const leafAge = t - state.leafStart;
  const leafProgress = leafAge / c.leafDuration;
  state.leaf.visible = leafAge >= 0 && leafAge < c.leafDuration && !state.reading;
  if (state.leaf.visible) {
    state.leaf.x = -1.15 + leafProgress * 2.3;
    state.leaf.y = 0.32 - leafProgress * 0.3 + Math.sin(leafProgress * 6) * 0.06;
    state.leaf.rotation = leafProgress * 2.4 + state.wind * 0.2;
  }
  const active = !!pointer.active && !state.reading;
  const targetX = active ? pointer.x : state.leaf.visible ? clamp(state.leaf.x, -0.7, 0.7) : 0;
  const targetY = active ? pointer.y : state.leaf.visible ? state.leaf.y : 0;
  const a = state.attention, b = state.body, v = state.velocity;
  [a.x, v.x] = spring(a.x, v.x, targetX, 12, dt);
  [a.y, v.y] = spring(a.y, v.y, targetY, 12, dt);
  // Eyes acquire the target first; the slower body follows their actual position.
  [b.turn, v.turn] = spring(b.turn, v.turn, a.x * LIMITS.turn, 4, dt);
  [b.lean, v.lean] = spring(b.lean, v.lean,
    a.x * LIMITS.lean * 0.65 + state.wind * LIMITS.lean * 0.2, 3.5, dt);
  [b.compression, v.compression] = spring(b.compression, v.compression,
    active && pointer.pressed ? LIMITS.compression : 0, 14, dt);
  b.turn = clamp(b.turn, -LIMITS.turn, LIMITS.turn);
  b.lean = clamp(b.lean, -LIMITS.lean, LIMITS.lean);
  b.compression = clamp(b.compression, 0, LIMITS.compression);
  state.mode = state.reading ? 'reading' : active && pointer.pressed ? 'touch'
    : active ? 'attention' : state.leaf.visible ? 'curious' : 'rest';
}

/** Mutates state, returns a renderer-friendly value snapshot.
 * Pausing freezes the current pose. Resume discards its first dt, preventing a
 * background interval from turning into motion. gust is rising-edge triggered.
 */
export function stepScene(state, dt, input = {}) {
  const freeze = !!(input.hidden || input.paused || input.reducedMotion);
  if (freeze) {
    state.frozen = true;
    state.accumulator = 0;
    state.gustHeld = !!input.gust;
    state.mode = input.hidden ? 'hidden' : input.reducedMotion ? 'reduced-motion' : 'paused';
    return getScenePose(state);
  }
  if (state.frozen) {
    state.frozen = false;
    state.mode = input.reading ? 'reading' : 'rest';
    dt = 0;
  }
  state.reading = !!input.reading;
  // Repeated clicks cannot restart or extend the current three-second burst.
  if(input.gust&&!state.gustHeld&&state.time-state.gustStart>=state.config.gustDuration-1e-9)
    beginGust(state,state.time,true);
  state.gustHeld = !!input.gust;
  const p = input.pointer || {};
  const pointer = {
    x: clamp(finite(p.x), -1, 1), y: clamp(finite(p.y), -1, 1),
    active: !!p.active, pressed: !!p.pressed,
  };
  state.accumulator += clamp(finite(dt), 0, LIMITS.maxDt);
  while (state.accumulator + 1e-12 >= LIMITS.step) {
    advance(state, LIMITS.step, pointer);
    state.accumulator = Math.max(0, state.accumulator - LIMITS.step);
  }
  return getScenePose(state);
}

/** All props sample this field instead of starting independent random winds.
 * Spatial variation is small and preserves the common direction and gust phase.
 */
export function sampleWind(state, x = 0, y = 0) {
  const spatial = 0.96 + 0.04 * Math.cos(clamp(finite(x), -1, 1) * 0.7
    + clamp(finite(y), -1, 1) * 0.5 + state.phase);
  return state.wind * spatial;
}

export function getScenePose(state) {
  const age = state.time - state.blinkStart;
  const blink = age < 0 || age >= 0.19 ? 0
    : age < 0.07 ? smooth(age / 0.07) : 1 - smooth((age - 0.07) / 0.12);
  const reading = state.reading ? 0.3 : 1;
  const gustAge=state.time-state.gustStart;
  return {
    time: state.time, wind: state.wind,
    gustAge:Math.max(0,gustAge),
    gustActive:gustAge>=-1e-9&&gustAge<state.config.gustDuration-1e-9,
    gustEnvelope:gustEnvelope(gustAge,state.config)*(state.reading?.25:1),
    gustPeak:state.config.gustPeak,
    breathe: Math.sin(state.time * Math.PI * 2 / state.config.breathPeriod)
      * LIMITS.breathe * reading,
    lookX: state.attention.x, lookY: state.attention.y,
    // Wind moves small objects; it must not modulate the whole scene's exposure.
    ...state.body, blink, light: 1,
    leaf: { ...state.leaf }, mode: state.mode,
  };
}
