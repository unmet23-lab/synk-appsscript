/** Time-of-day light and rain (vertical slice design §2-2·§4-2·§4-4, W7). One plain function of the
 * village seed, its time-zone history and the server's time: the same village at the same instant
 * shows the same light on every device. My time picks the light (the seven LIGHT_KEYS of clock.mjs,
 * the same clock as the bands); the Korean date picks the rain (weatherAt). The values are the
 * light table (data/light.json 〔initial values〕): light colours there are sRGB per-mille, the baked
 * sky and sun shares LINEAR per-mille multipliers; here everything leaves as plain fractions. No
 * three.js: day-light.mjs turns this into lights, uniforms and materials. Noon in clear weather is
 * the approved v20 look and the bake as it was.
 */
import { LIGHT_KEYS, MINUTE, HOUR, DAY, offsetAt, bandAt, weatherAt, weatherChangesBetween } from './clock.mjs';
import * as generated from './data.gen.mjs';

// Read through the namespace: for up to the cache's ten minutes after a publish a browser may still hold the
// generated data from before the light table existed. Then LIGHT is missing, lightAt throws and the screen keeps
// the approved noon — a named import would instead stop the whole town from loading.
const LIGHT = generated.LIGHT;

// Numbers the light table also holds are never written here (tests/town-light.test.js):
// per-mille is 1e3, a second 1e3 ms, half a turn HALF_TURN degrees.
const PER_MILLE = 1e3, SECOND = 1e3, DAY_MINUTES = DAY / MINUTE, HALF_TURN = 1.8e2;
/** The rain windows read around an instant: longer than any lead, ramp or drying time. */
const LOOK_MS = 3 * HOUR;
const mod = (a, b) => ((a % b) + b) % b;
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const luminance = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** A colour moved toward the grey of its own brightness. */
const toward = (c, share) => { const y = luminance(c); return c.map(v => lerp(v, y, share)); };
/** Shortest way round between two compass angles in degrees, kept in [0, 360). */
const turn = (a, b, t) => { const d = mod(b - a + 3 * HALF_TURN, 2 * HALF_TURN) - HALF_TURN; return mod(a + d * t, 2 * HALF_TURN); };

/** Minutes past my midnight at ms, with the seconds kept so the light never steps. */
export function localMinuteAt(tz, ms) {
  return mod(ms + offsetAt(tz, ms) * MINUTE, DAY) / MINUTE;
}

/** The two light keys around a minute and how far the light has gone from one to the next. Each key
 * says how long before it the light starts to move (rampMinutes, at most the gap): until then the
 * earlier key holds, so 02:30 is still deep night and the night band at 21:00 arrives already lit. */
export function lightKeyAt(minute, keys = LIGHT.keys) {
  let i = LIGHT_KEYS.length - 1;
  while (i > 0 && LIGHT_KEYS[i].at > minute) i--;
  const from = LIGHT_KEYS[i], to = LIGHT_KEYS[(i + 1) % LIGHT_KEYS.length];
  const gap = mod(to.at - from.at, DAY_MINUTES) || DAY_MINUTES, since = mod(minute - from.at, DAY_MINUTES);
  const ramp = Math.max(1, Math.min(gap, keys[to.id].rampMinutes));
  return { from: from.id, to: to.id, t: ease((since - (gap - ramp)) / ramp) };
}

/** Rain at ms, from the village's weather windows: drops (the streaks, inside a rain window only),
 * overcast (the clouds come a little before and go a little after) and wet (surfaces darken while it
 * rains and dry after). All from the seed and the time, so two devices agree. */
export function rainAt(villageSeed, ms, rain = LIGHT.rain) {
  if (typeof villageSeed !== 'string' || !villageSeed) return { raining: false, drops: 0, overcast: 0, wet: 0 };
  const raining = weatherAt(villageSeed, ms) === 'rain';
  let start = -Infinity, end = Infinity, lastStart = -Infinity, lastEnd = -Infinity, nextStart = Infinity;
  for (const change of weatherChangesBetween(villageSeed, ms - LOOK_MS, ms + LOOK_MS)) {
    if (change.atMs <= ms) {
      if (change.to === 'rain') start = change.atMs;
      else { lastStart = start; lastEnd = change.atMs; start = -Infinity; }
    } else if (change.to === 'clear') end = Math.min(end, change.atMs);
    else nextStart = Math.min(nextStart, change.atMs);
  }
  const ramp = rain.rampSeconds * SECOND, lead = rain.overcastLeadMinutes * MINUTE;
  const wetIn = rain.wetInMinutes * MINUTE, dry = rain.dryMinutes * MINUTE;
  if (raining) return { raining, drops: ease(Math.min(ms - start, end - ms) / ramp), overcast: 1, wet: ease((ms - start) / wetIn) };
  const wetAtEnd = lastStart === -Infinity ? 1 : ease((lastEnd - lastStart) / wetIn);
  return { raining, drops: 0, overcast: Math.max(ease(1 - (ms - lastEnd) / lead), ease(1 - (nextStart - ms) / lead)),
    wet: lastEnd === -Infinity ? 0 : wetAtEnd * ease(1 - (ms - lastEnd) / dry) };
}

/** One key's values as fractions (light colours sRGB 0~1, baked shares linear multipliers). */
function keyValues(key) {
  const out = {};
  for (const [name, value] of Object.entries(key)) out[name] = name === 'sunElevation' || name === 'sunAzimuth' || name === 'rampMinutes' ? value
    : Array.isArray(value) ? value.map(v => v / PER_MILLE) : value / PER_MILLE;
  return out;
}
function mixKeys(a, b, t) {
  const out = {};
  for (const name of Object.keys(a)) out[name] = Array.isArray(a[name]) ? a[name].map((v, i) => lerp(v, b[name][i], t))
    : name === 'sunAzimuth' ? turn(a[name], b[name], t) : lerp(a[name], b[name], t);
  return out;
}
const direction = (elevation, azimuth) => {
  const e = elevation * Math.PI / HALF_TURN, a = azimuth * Math.PI / HALF_TURN;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
};

/** The whole light at ms (light: the light table, data/light.json when absent). The fixed sun is the noon
 * direction: a baked town keeps it, because its shadows were baked there. */
export function lightAt({ villageSeed = null, tz, ms, light = LIGHT }) {
  if (!Number.isSafeInteger(ms)) throw new RangeError('ms is epoch milliseconds (a safe integer)');
  if (!light?.keys || !light.rain) throw new RangeError('no light table');
  for (const key of LIGHT_KEYS) if (!light.keys[key.id]) throw new RangeError(`light has no key ${key.id}`);
  const minute = localMinuteAt(tz, ms), key = lightKeyAt(minute, light.keys);
  const k = mixKeys(keyValues(light.keys[key.from]), keyValues(light.keys[key.to]), key.t);
  const r = light.rain, f = v => v / PER_MILLE, w = rainAt(villageSeed, ms, r), o = w.overcast;
  // A grey day turns the lights on a little; a sleeping village (the night keys' stars) does not.
  const dim = lerp(1, f(r.sun), o), grey = f(r.grey) * o, noon = light.keys.noon, lights = f(r.lights) * o * (1 - k.stars);
  return {
    atMs: ms, localMinute: minute, band: bandAt(tz, ms).band, key,
    baked: { sky: k.bakedSky.map((v, i) => v * lerp(1, f(r.bakedSky[i]), o)), sun: k.bakedSun.map(v => v * dim) },
    sun: { color: toward(k.sunColor, grey), intensity: k.sunIntensity * dim, direction: direction(k.sunElevation, k.sunAzimuth),
      fixedDirection: direction(noon.sunElevation, noon.sunAzimuth), shadow: k.shadow * lerp(1, f(r.shadow), o) },
    hemi: { sky: toward(k.hemiSky, grey), ground: toward(k.hemiGround, grey), intensity: k.hemiIntensity * lerp(1, f(r.hemi), o) },
    fill: k.fill * lerp(1, f(r.hemi), o), env: k.env * lerp(1, f(r.env), o), skyMap: k.skyMap * lerp(1, f(r.env), o),
    overlay: { top: toward(k.overlayTop, f(r.overlayGrey) * o), horizon: toward(k.overlayHorizon, f(r.overlayGrey) * o),
      alpha: Math.max(k.overlayAlpha, f(r.overlayAlpha) * o) },
    fog: { color: toward(k.fog, f(r.fogGrey) * o), near: k.fogNear * lerp(1, f(r.fogNear), o), far: k.fogFar * lerp(1, f(r.fogFar), o) },
    glass: clamp01(k.glass + lights), lantern: clamp01(k.lantern + lights), stars: k.stars * (1 - o),
    rain: { raining: w.raining, drops: w.drops, overcast: o, wet: w.wet, dropsPc: r.dropsPc, dropsPhone: r.dropsPhone,
      reducedShare: f(r.reducedShare), radius: r.radius, height: r.height,
      wetGround: f(r.wetGround), wetRoof: f(r.wetRoof), wetWall: f(r.wetWall), wetSheen: f(r.wetSheen), wetRough: f(r.wetRough) },
  };
}
