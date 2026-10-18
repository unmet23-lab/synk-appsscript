'use strict';
// Immutable pages first, one root pointer last. A failed write leaves the previous
// root readable; callers advance the network cursor only after this returns.
const PAGE_ITEMS = 128, THRESHOLD = 1024;
const failure = () => Object.assign(new Error('Atlas: unreadable paged history'), { code: 'STORAGE_ERROR' });
// Pages repeat field names, scopes, timestamps and policy identifiers. A page-local
// string table preserves every JSON value while avoiding a second full history's
// worth of repeated text in the browser's finite synchronous storage quota.
function encodePage(rows) {
  const plain = JSON.stringify(rows), strings = [], ids = new Map();
  const intern = value => { if (!ids.has(value)) { ids.set(value, strings.length); strings.push(value); } return ids.get(value); };
  const pack = value => typeof value === 'string' ? [2, intern(value)] : Array.isArray(value) ? [0, ...value.map(pack)]
    : value && typeof value === 'object' ? [1, ...Object.entries(value).flatMap(([name, entry]) => [intern(name), pack(entry)])] : value;
  const entries = JSON.parse(plain).map(pack), packed = JSON.stringify({ codec: 1, strings, entries });
  return packed.length < plain.length ? packed : plain;
}
function decodePage(text) {
  const value = JSON.parse(text);
  if (Array.isArray(value)) return value; // Previously saved plain JSON pages remain readable.
  if (!value || value.codec !== 1 || Object.keys(value).some(k => !['codec', 'strings', 'entries'].includes(k))
    || !Array.isArray(value.strings) || !value.strings.every(s => typeof s === 'string') || !Array.isArray(value.entries)) throw failure();
  const string = index => { if (!Number.isInteger(index) || index < 0 || index >= value.strings.length) throw failure(); return value.strings[index]; };
  function unpack(entry, depth = 0) {
    if (depth > 64) throw failure();
    if (entry === null || typeof entry === 'boolean' || typeof entry === 'number') return entry;
    if (!Array.isArray(entry)) throw failure();
    if (entry[0] === 2 && entry.length === 2) return string(entry[1]);
    if (entry[0] === 0) return entry.slice(1).map(child => unpack(child, depth + 1));
    if (entry[0] === 1 && entry.length % 2 === 1) {
      const out = {};
      for (let at = 1; at < entry.length; at += 2) {
        const name = string(entry[at]); if (Object.hasOwn(out, name)) throw failure();
        Object.defineProperty(out, name, { value: unpack(entry[at + 1], depth + 1), enumerable: true, configurable: true, writable: true });
      }
      return out;
    }
    throw failure();
  }
  return value.entries.map(entry => unpack(entry));
}
function createPages(storage, key, arrays) {
  const prefix = `${key}.page.`, cache = new Map();
  let root = null, decodedRaw = null;
  const validKey = name => typeof name === 'string' && name.startsWith(prefix) && /^[a-zA-Z0-9_.:-]+$/.test(name.slice(prefix.length));
  const manifest = value => value && value.paged === 1 && value.version === 1 && value.data && typeof value.data === 'object' && !Array.isArray(value.data)
    && value.arrays && typeof value.arrays === 'object' && !Array.isArray(value.arrays);
  function decodeOnce(raw) {
    const value = JSON.parse(raw);
    if (value?.paged !== 1) { root = null; decodedRaw = raw; return value; }
    if (!manifest(value) || Object.keys(value).some(k => !['paged', 'version', 'data', 'arrays'].includes(k))
      || Object.keys(value.arrays).some(k => !arrays.includes(k))) throw failure();
    const data = { ...value.data }, seen = new Set();
    for (const [name, pages] of Object.entries(value.arrays)) {
      if (Object.hasOwn(data, name) || !Array.isArray(pages)) throw failure();
      data[name] = [];
      for (const page of pages) {
        if (!page || !validKey(page.key) || seen.has(page.key) || !Number.isInteger(page.count) || page.count < 1 || page.count > PAGE_ITEMS) throw failure();
        seen.add(page.key);
        const text = storage.getItem(page.key);
        if (typeof text !== 'string') throw failure();
        const rows = decodePage(text);
        if (!Array.isArray(rows) || rows.length !== page.count) throw failure();
        cache.set(page.key, text); data[name].push(...rows);
      }
    }
    root = value; decodedRaw = raw; return data;
  }
  function decode(raw) {
    // Another tab can publish a new root and retire its old tail between our
    // root read and page read. Retry only when the root actually changed.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return decodeOnce(raw); }
      catch (error) { const current = storage.getItem(key); if (current === raw || current == null || attempt === 2) throw error; raw = current; }
    }
  }
  const remove = names => { if (typeof storage.removeItem === 'function') for (const name of names) { try { storage.removeItem(name); } catch { /* Unreferenced pages may be reclaimed later. */ } } };
  function write(data, expectedRaw) {
    const next = { paged: 1, version: 1, data: { ...data }, arrays: {} }, created = [];
    let publishedRaw = null;
    try {
      for (const name of arrays) {
        if (!Object.hasOwn(data, name)) continue;
        if (!Array.isArray(data[name])) throw failure();
        delete next.data[name]; next.arrays[name] = [];
        for (let at = 0; at < data[name].length; at += PAGE_ITEMS) {
          const rows = data[name].slice(at, at + PAGE_ITEMS), text = encodePage(rows), prior = root?.arrays?.[name]?.[at / PAGE_ITEMS];
          if (prior && (cache.get(prior.key) ?? storage.getItem(prior.key)) === text) next.arrays[name].push(prior);
          else {
            const pageKey = `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${at}-${name}`;
            created.push(pageKey); storage.setItem(pageKey, text); cache.set(pageKey, text);
            next.arrays[name].push({ key: pageKey, count: rows.length });
          }
        }
      }
      // A newer tab must be merged by the adapter, never replaced by an old root.
      if (storage.getItem(key) !== expectedRaw) throw Object.assign(failure(), { message: 'Atlas: history changed during persistence' });
      const raw = JSON.stringify(next); publishedRaw = raw; storage.setItem(key, raw);
      const retained = new Set(Object.values(next.arrays).flat().map(page => page.key));
      const obsolete = Object.values(root?.arrays || {}).flat().map(page => page.key).filter(name => !retained.has(name));
      root = next; remove(obsolete); for (const name of obsolete) cache.delete(name);
      return raw;
    } catch (error) {
      // A Storage wrapper may throw after its root write succeeded. Never erase
      // pages a committed root already owns, even when its acknowledgement failed.
      if (publishedRaw && storage.getItem(key) === publishedRaw) { root = next; return publishedRaw; }
      remove(created); for (const name of created) cache.delete(name); throw error;
    }
  }
  return { decode, write, active: () => !!root, decodedRaw: () => decodedRaw };
}
module.exports = { createPages, encodePage, decodePage, PAGE_ITEMS, THRESHOLD };
