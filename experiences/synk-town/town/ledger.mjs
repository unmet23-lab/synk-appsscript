/** The account's one ledger of things (vertical slice design §20-7 ①, §20-9 2; economy :31·:130~134).
 * Holdings are lines { itemId, source, qty, costBasis, saleAllowed }; the same item from another
 * source is never merged into the same line. Holdings change only through events the server
 * confirms with the command that caused them — item.granted (its id is a hash of the account, the
 * cause event and the item, so the same cause never pays twice), item.transferred and
 * item.consumed. A device never states a balance: these functions take ids and quantities only. A
 * grant over a line's limit changes nothing and says so before anything is confirmed. The field
 * guide (discoveries) keeps each item's first grant only; it never makes a thing by itself.
 */
import { ITEMS } from './data.gen.mjs';
import { seedKey, hashString } from './rng.mjs';

export const ITEM_BY_ID = Object.freeze(Object.fromEntries(ITEMS.map(item => [item.id, item])));
/** Grant ids the ledger keeps to stay idempotent across a retried settlement; a command id's own
 * receipt covers everything older. */
export const RECENT_GRANTS = 64;
export const emptyLedger = () => ({ inventory: [], discoveries: {}, grants: [] });

export class LedgerError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new LedgerError(code, message); };
const item = itemId => ITEM_BY_ID[itemId] || fail('unknown-item', `unknown item ${itemId}`);
const quantity = qty => Number.isSafeInteger(qty) && qty > 0 ? qty : fail('invalid-quantity', 'a quantity is a positive whole number');
const lineOf = (ledger, itemId, source) => ledger.inventory.find(line => line.itemId === itemId && line.source === source);

export const grantId = (accountId, causeId, itemId) => `G-${hashString(seedKey('grant', accountId, causeId, itemId)).toString(36)}`;
export const held = (ledger, itemId) => ledger.inventory.reduce((sum, line) => sum + (line.itemId === itemId ? line.qty : 0), 0);

/** Grant qty of an item for a cause: { ledger, events } with a new ledger, or the same ledger and
 * no event when this grant was already made. Gathered things cost nothing and are not for sale. */
export function grant(ledger, { accountId, causeId, itemId, qty, source = 'gather' }) {
  const definition = item(itemId); quantity(qty);
  if (!definition.sources.includes(source)) fail('invalid-source', `${itemId} does not come from ${source}`);
  const id = grantId(accountId, causeId, itemId);
  if (ledger.grants.includes(id)) return { ledger, events: [] };
  const line = lineOf(ledger, itemId, source);
  if ((line?.qty || 0) + qty > definition.stackMax) fail('stack-full', `${itemId} is full`);
  const next = structuredClone(ledger);
  const target = lineOf(next, itemId, source);
  if (target) target.qty += qty;
  else next.inventory.push({ itemId, source, qty, costBasis: 0, saleAllowed: false });
  if (!Object.hasOwn(next.discoveries, itemId)) next.discoveries[itemId] = id;
  next.grants = [...next.grants, id].slice(-RECENT_GRANTS);
  return { ledger: next, events: [{ id, kind: 'item.granted', grantId: id, itemId, qty, source, cause: causeId }] };
}

/** Take qty out of one line: lines from different sources never merge, so one event names one
 * source. Without a source the oldest line that holds enough gives; a quantity only several sources
 * together hold is refused (the caller takes it source by source, one event each). An emptied line goes. */
function take(ledger, itemId, qty, source) {
  quantity(qty);
  if (held(ledger, itemId) < qty) fail('not-enough', `not enough ${itemId}`);
  const next = structuredClone(ledger);
  const line = next.inventory.find(row => row.itemId === itemId && (source === undefined ? row.qty >= qty : row.source === source));
  if (!line) source === undefined ? fail('mixed-sources', `${itemId} is held under more than one source`) : fail('not-enough', `no ${itemId} from ${source}`);
  if (line.qty < qty) fail('not-enough', `not enough ${itemId} from ${source}`);
  line.qty -= qty;
  next.inventory = next.inventory.filter(row => row.qty > 0);
  return { next, source: line.source };
}

/** Giving moves things, never copies them (to a world object such as the cafe's leaf tin). */
export function transfer(ledger, { eventId, itemId, qty, to, source }) {
  item(itemId);
  if (typeof to !== 'string' || !to) fail('invalid-target', 'a transfer names where it goes');
  const taken = take(ledger, itemId, qty, source);
  return { ledger: taken.next, events: [{ id: eventId, kind: 'item.transferred', itemId, qty, from: taken.source, to }] };
}

export function consume(ledger, { eventId, itemId, qty, causeId, source }) {
  item(itemId);
  const taken = take(ledger, itemId, qty, source);
  return { ledger: taken.next, events: [{ id: eventId, kind: 'item.consumed', itemId, qty, source: taken.source, cause: causeId }] };
}

/** Whether a stored ledger is whole. */
export function validLedger(ledger) {
  const keys = new Set();
  return !!ledger && Array.isArray(ledger.inventory) && ledger.inventory.every(line => {
    const key = `${line?.itemId}|${line?.source}`, definition = ITEM_BY_ID[line?.itemId];
    if (!definition || keys.has(key) || !definition.sources.includes(line.source) || !Number.isSafeInteger(line.qty) || line.qty < 1
      || line.qty > definition.stackMax || !Number.isSafeInteger(line.costBasis) || line.costBasis < 0 || typeof line.saleAllowed !== 'boolean') return false;
    keys.add(key); return true;
  }) && !!ledger.discoveries && typeof ledger.discoveries === 'object' && Object.keys(ledger.discoveries).every(id => Object.hasOwn(ITEM_BY_ID, id))
    && Array.isArray(ledger.grants) && ledger.grants.length <= RECENT_GRANTS && ledger.grants.every(id => typeof id === 'string');
}
