'use strict';
// Unbroken polls prove the PC stayed awake. Hermes runs this every 5 minutes (about 6 in practice), so one
// missed poll still fits; a gap over 15 minutes means sleep, shutdown or a gateway outage and the streak starts again.
const AWAKE_GAP_MS = 15 * 60000;
function awakeSince(previous, now) {
  const time = value => typeof value === 'string' ? Date.parse(value) : NaN;
  const last = time(previous?.checkedAt), since = time(previous?.awakeSince), gap = now.getTime() - last;
  return gap >= 0 && gap <= AWAKE_GAP_MS && since <= last ? new Date(since).toISOString() : now.toISOString();
}

module.exports = { awakeSince, AWAKE_GAP_MS };
