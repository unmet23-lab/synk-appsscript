/** Staying (vertical slice W7b, village design §4-4): the seats where the screen goes quiet and only sound goes
 * on — the two street benches and the bench under the home's round window, the village's own furniture (no new
 * place or art, §0). A seat's place is its walking solid (walk.mjs), so the bench the player bumps into is the
 * bench the player sits on. The quiet drawing's values and how dark the screen gets are here too. Nothing here
 * is sent anywhere: staying lives on the device (no command, no record — G2·G3).
 * The table is data/stay.json (〔initial values〕), read through the namespace: for up to the cache's ten minutes
 * after a publish a browser may still hold the generated data from before the table existed, and then there is
 * simply no seat (a named import would stop the whole town from loading).
 */
import * as generated from './data.gen.mjs';
import { WALK_SOLIDS } from '../walk.mjs';

const STAY = generated.STAY ?? null;
// Numbers the stay table also holds are never written here (tests/town-stay.test.js): a millimetre is 1e-3 m,
// per-mille 1e3, half a turn HALF_TURN degrees.
const MM = 1e-3, PER_MILLE = 1e3, HALF_TURN = 1.8e2;
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const luminance = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The seats in town metres: { id, label, x, z, halfX, halfZ (the solid's walking box), seatTop, sit ([x, z] from the
 * seat's middle to where the player sits), heading (radians, 0 faces +z), reach, sheltered, camera }. A seat whose
 * solid is missing is left out rather than guessed. */
export const SEATS = Object.freeze((STAY?.seats || []).flatMap(seat => {
  const solid = WALK_SOLIDS.find(s => s.id === seat.solid);
  if (!solid || solid.minX === undefined) return [];
  const c = seat.camera;
  return [Object.freeze({ id: seat.id, label: seat.label, x: (solid.minX + solid.maxX) / 2, z: (solid.minZ + solid.maxZ) / 2,
    halfX: (solid.maxX - solid.minX) / 2, halfZ: (solid.maxZ - solid.minZ) / 2, sit: Object.freeze(seat.sit.map(v => v * MM)),
    seatTop: seat.seatTop * MM, heading: seat.heading * Math.PI / HALF_TURN, reach: seat.reach * MM, sheltered: seat.sheltered,
    camera: Object.freeze({ look: c.look.map(v => v * MM), dir: c.dir.map(v => v * MM), width: c.width * MM, portraitWidth: c.portraitWidth * MM, height: c.height * MM, fov: c.fov }) })];
}));

/** The seat the player can sit on from where it stands (the nearest within its reach), or null. The reach runs from
 * the edge of the seat's walking box — where the player can stand — so a long bench reaches all along. */
export function seatNear(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
  let best = null, bestDistance = Infinity;
  for (const seat of SEATS) {
    const distance = Math.hypot(Math.max(0, Math.abs(point.x - seat.x) - seat.halfX), Math.max(0, Math.abs(point.z - seat.z) - seat.halfZ));
    if (distance <= seat.reach && distance < bestDistance) { best = seat; bestDistance = distance; }
  }
  return best;
}

/** The quiet drawing while seated: the frame rate and the app's own loop while something moves (a walking resident,
 * rain) and the loop while nothing does (the scene then draws only on a change), pixel ratio, pulse and light every
 * so often, the dark veil's timing, how long the seat's card stays bright after a touch, and whether a touch device
 * keeps its screen on. */
export const QUIET = Object.freeze(STAY ? { fps: STAY.quiet.fps, appHz: STAY.quiet.appHz, idleHz: STAY.quiet.idleHz, pixelRatio: STAY.quiet.pixelRatio / PER_MILLE,
  pulseMs: STAY.quiet.pulseMs, lightMs: STAY.quiet.lightMs, dimInMs: STAY.quiet.dimInMs, cardMs: STAY.quiet.cardMs, wakeLock: STAY.quiet.wakeLock === 1 } : null);

/** How dark the veil over the seated screen is (0~1): darker by day, lighter at night — a scene already dark keeps
 * its shapes. light is lightAt's (null: the approved noon). */
export function dimAlpha(light) {
  if (!STAY) return 0;
  const q = STAY.quiet, bright = light ? clamp01(luminance(light.baked.sky)) : 1;
  return (q.dimNight + (q.dimDay - q.dimNight) * bright) / PER_MILLE;
}
