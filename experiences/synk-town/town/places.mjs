/** Places and spots, one list for the server, browser and talk (vertical slice design §5).
 * The data lives in town/data/places.json; this module only shapes it for callers.
 */
import { PLACES, SPOTS, SPOT_GROUPS } from './data.gen.mjs';

export { PLACES, SPOTS, SPOT_GROUPS };

const freeze = value => Object.freeze(value);

export const PLACE_BY_ID = freeze(Object.fromEntries(PLACES.map(place => [place.id, place])));
/** The four places the player can stand at, in their fixed order. */
export const PLAYER_PLACES = freeze(PLACES.filter(place => place.player).map(place => place.id));
export const SPOT_BY_ID = freeze(Object.fromEntries(SPOTS.map(spot => [spot.id, spot])));

/** A spot ID or a group name (cafe.seats) → the spots it stands for. */
export function spotsOf(name) {
  if (Object.hasOwn(SPOT_GROUPS, name)) return SPOT_GROUPS[name].map(id => SPOT_BY_ID[id]);
  if (Object.hasOwn(SPOT_BY_ID, name)) return [SPOT_BY_ID[name]];
  throw new RangeError(`unknown spot or group: ${name}`);
}

/** FT10 seats by their old IDs: 3D point, branch and the old 2D screen point. */
export const FT_SEATS = freeze(Object.fromEntries(SPOTS.filter(spot => spot.ftSeat)
  .map(spot => [spot.ftSeat, freeze({ spot: spot.id, at: spot.at, branch: spot.branch, legacy2d: spot.legacy2d })])));
/** FT51 sign slots by their old IDs (old 2D screen points). */
export const SIGN_SLOTS = freeze(Object.fromEntries(SPOTS.filter(spot => spot.signSlot)
  .map(spot => [spot.signSlot, freeze({ spot: spot.id, at: spot.at, legacy2d: spot.legacy2d })])));
/** H00 cushion slots at home. */
export const HOME_SLOTS = freeze(Object.fromEntries(SPOTS.filter(spot => spot.homeSlot).map(spot => [spot.homeSlot, spot.at])));
