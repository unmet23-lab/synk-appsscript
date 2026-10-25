/** The village's sound (vertical slice W7b, village design §4-4): how loud each layer of the village sound is,
 * from the hour's light and rain (town/light.mjs lightAt — the same seed, time zone and server clock, so two
 * devices hear the same weather), the Korean date's month, where the listener is (the seat, or the player
 * walking) and whether the cafe owner is up. Then the two buses: the village sound and SYNK music, each on or off
 * by the person's own switch, and both silent while a microphone is open, the window hidden or another window holds
 * the town. Plain functions: no three.js, no WebAudio — day-sound.mjs turns the levels into sound.
 * The table is data/stay.json's sound section (〔initial values〕), read through the namespace: for up to the
 * cache's ten minutes after a publish a browser may still hold the generated data from before it existed, and then
 * the village is simply silent (a named import would stop the whole town from loading).
 */
import { LIGHT_KEYS, DAY, MINUTE, civilFromDays } from './clock.mjs';
import * as generated from './data.gen.mjs';

const STAY = generated.STAY ?? null, MUSIC = generated.MUSIC ?? null;
// Numbers the stay table also holds are never written here (tests/town-sound.test.js): per-mille is 1e3 and a
// millimetre 1e-3 m. The Korean date is clock.mjs's own (UTC+9, no daylight saving); its offset is written here
// rather than exported there — a name new to an already published module would stop the town's module links for a
// browser still holding the older one.
const PER_MILLE = 1e3, MM = 1e-3, KST_MS = 9 * 60 * MINUTE;
const NOON = Object.freeze({ from: 'noon', to: 'noon', t: 0 });
const DRY = Object.freeze({ drops: 0, overcast: 0, wet: 0 });
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
// A day past any month's end lands in the next month: how far into it says how long this month is.
const PAST_MONTH = 32;

/** The layers the table names, in its order (wind, rain in the open and on a roof, drips, the wind chime, birds,
 * crickets, frogs, the cafe). */
export const LAYERS = Object.freeze(Object.keys(STAY?.sound.layers || {}));
/** The songs on the list (none until Yuho chooses — the music switch stays out of sight then). */
export const TRACKS = Object.freeze(MUSIC?.tracks || []);

/** A twelve-month row read on the Korean date, anchored at each month's middle and blended in between. */
export function monthShare(row, ms) {
  const today = Math.floor((ms + KST_MS) / DAY), { month, day } = civilFromDays(today);
  const days = PAST_MONTH + 1 - civilFromDays(today - (day - 1) + PAST_MONTH).day;
  const at = month - 1 + (day - .5) / days - .5, i = Math.floor(at), t = at - i;
  return lerp(row[(i + 12) % 12], row[(i + 13) % 12], t) / PER_MILLE;
}

/** Whether a point (town metres) is under one of the table's roofs. */
export function shelteredAt(x, z) {
  return !!STAY && STAY.sound.shelters.some(([minX, minZ, maxX, maxZ]) => x >= minX * MM && x <= maxX * MM && z >= minZ * MM && z <= maxZ * MM);
}

/** Each layer's level now (0~1). listener: { x, z, sheltered? } in town metres (a seat says whether it is under a
 * roof; a walking point asks the table). awake: { [resident]: boolean } (a layer that needs its resident up). */
export function soundscapeAt({ light = null, ms, listener, awake = {} }) {
  if (!STAY || !Number.isSafeInteger(ms) || !listener || !Number.isFinite(listener.x) || !Number.isFinite(listener.z)) return { layers: {}, sheltered: false };
  const key = light?.key || NOON, rain = light?.rain || DRY, sheltered = typeof listener.sheltered === 'boolean' ? listener.sheltered : shelteredAt(listener.x, listener.z);
  const drivers = { always: 1, drops: rain.drops, wet: rain.wet }, layers = {};
  for (const [name, layer] of Object.entries(STAY.sound.layers)) {
    const time = lerp(layer.time[key.from], layer.time[key.to], key.t) / PER_MILLE;
    const w = layer.weather, weather = lerp(1, w.drops / PER_MILLE, rain.drops) * lerp(1, w.overcast / PER_MILLE, rain.overcast) * lerp(1, w.wet / PER_MILLE, rain.wet);
    let near = 1;
    if (layer.source) {
      const d = Math.hypot(listener.x - layer.source.at[0] * MM, listener.z - layer.source.at[1] * MM);
      near = 1 - ease((d - layer.source.near * MM) / ((layer.source.far - layer.source.near) * MM));
    }
    const up = layer.awake ? awake[layer.awake] === true : true;
    layers[name] = up ? clamp01(drivers[layer.driver] * time * monthShare(layer.month, ms) * weather * (layer.shelter[sheltered ? 1 : 0] / PER_MILLE) * near) : 0;
  }
  return { layers, sheltered };
}

/** The two buses (0~1): the village sound and SYNK music. Each follows only its own switch (village, music); music
 * plays only while seated and only when there are songs; the village sound is quieter while walking, quieter again
 * under a dialog or under music. Both are 0 while a microphone is open (recording), the window is hidden, or another
 * window holds the town (owner false — one window sounds at a time). */
export function busLevels({ village = false, music = false, staying = false, dialog = false, recording = false, hidden = false, owner = false, tracks = TRACKS.length }) {
  if (!STAY || recording || hidden || !owner) return { village: 0, music: 0 };
  const b = STAY.sound.bus, m = music && staying && tracks > 0 ? b.music / PER_MILLE : 0;
  const v = village ? (staying ? b.stay : b.walk) / PER_MILLE * (dialog ? b.dialog / PER_MILLE : 1) * (m > 0 ? b.underMusic / PER_MILLE : 1) : 0;
  return { village: v, music: m };
}

/** A switch's next value. Turning a sound on takes the person's own act (a trusted input event); nothing else may —
 * no seat, no new song, no season, no other setting, no visit brings back a sound the person turned off (village
 * design acceptance 11). Turning off is always allowed. */
export function prefAfter({ current, wanted, trusted = false }) {
  if (wanted === true && trusted !== true) return current === true;
  return wanted === true;
}

/** Whether a microphone is open somewhere in this origin (a WORLD recording window says so on a broadcast
 * channel: opened, still open every heartbeat, closed). heardAt is when it last said open, closedAt when it last
 * said closed. Open until it says closed — or until it has said nothing for the table's stale time (a window that
 * crashed mid-recording). */
export function micOpen({ heardAt = null, closedAt = null, now }) {
  if (!STAY || !Number.isFinite(heardAt) || !Number.isFinite(now)) return false;
  if (Number.isFinite(closedAt) && closedAt >= heardAt) return false;
  return now - heardAt < STAY.sound.record.staleMs;
}

/** Fades and the recording heartbeat, in milliseconds (the screen's own timing). */
export const FADES = Object.freeze(STAY ? { ...STAY.sound.fade, heartbeatMs: STAY.sound.record.heartbeatMs } : {});
/** Each layer's reference gain for the screen (0~1). */
export const GAINS = Object.freeze(Object.fromEntries(Object.entries(STAY?.sound.layers || {}).map(([name, layer]) => [name, layer.gain / PER_MILLE])));
/** The light keys the time rows name (LIGHT_KEYS of clock.mjs), for the checker and tests. */
export const TIME_KEYS = Object.freeze(LIGHT_KEYS.map(key => key.id));
