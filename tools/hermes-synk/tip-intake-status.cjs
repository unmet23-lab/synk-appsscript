'use strict';

// Bounded, read-only projection. Ledger matching never calls the remote ledger.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { isIP } = require('node:net');
const { readText, safePath } = require('./status.cjs');
const TIP_INTAKE_DIR = 'runtime/synk-tip-intake';
const TIP_INTAKE_LIMIT = 100;
const TIP_INTAKE_CAP = 2000;
const TIP_INTAKE_STALE_MS = 24 * 60 * 60_000;
const receiptName = /^tip-[a-f0-9]{24}\.json$/;
// Match the producer's Path.glob('tip-*.json'), including malformed names and
// directories. It counts those entries before validating receipt contents.
const producerName = new RegExp('^tip-[\\s\\S]*\\.json$', process.platform === 'win32' ? 'i' : '');
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

// Keep the producer's conservative identity rules: uncertain query/fragment semantics
// and signed/private references cannot establish that a shared item reached the ledger.
function lookupKey(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  if (/^[A-Za-z0-9_-]{3,100}$/.test(value)) return value;
  // WHATWG URL removes dot segments while Python preserves them. Do not infer
  // identity from either normalization when the original path is ambiguous.
  const rawPath = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i.exec(value);
  if (!rawPath || value.includes('\\') || (rawPath[1] || '').split('/').some(segment => ['.', '..'].includes(segment.replace(/%2e/gi, '.')))) return null;
  let url;
  try { url = new URL(value.replace(/[.,);!！。]+$/u, '')); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // No network or DNS lookup. Literal IPs are conservatively ineligible here.
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || isIP(host.replace(/^\[|\]$/g, ''))
    || !host.includes('.') || /(^|\.)(localhost|local|internal|telegram\.org)$/.test(host)
    || host === 't.me' && (url.search || /^\/(?:\+|joinchat\/)/.test(url.pathname))) return null;
  url.hostname = host;
  const keys = [...url.searchParams.keys()];
  if (keys.some(key => /token|auth|key|secret|password|signature|sig|credential|^x-amz-/i.test(key))) return null;
  const tracking = key => /^utm_/i.test(key) || ['fbclid', 'gclid', 'dclid', 'msclkid'].includes(key.toLowerCase());
  const instagram = ['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am'].includes(host) && /^\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  if (instagram) return keys.every(key => tracking(key) || ['igsh', 'igshid', 'img_index'].includes(key.toLowerCase())) ? instagram[1] : null;
  const youtubeHost = /^(?:(?:www|m)\.)?youtube\.com$/.test(host);
  const youtube = ['youtu.be', 'www.youtu.be'].includes(host) ? /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1]
    : youtubeHost && url.pathname === '/watch' && url.searchParams.getAll('v').length === 1 ? url.searchParams.get('v')
    : youtubeHost ? /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] : null;
  if (youtube && /^[A-Za-z0-9_-]{11}$/.test(youtube)) {
    return keys.every(key => tracking(key) || ['v', 'si', 'feature', 't', 'start', 'list', 'index'].includes(key.toLowerCase())) ? 'https://www.youtube.com/watch?v=' + youtube : null;
  }
  if (url.hash || keys.some(key => !tracking(key))) return null;
  url.search = ''; url.hash = '';
  return url.href;
}

const lookupHash = value => { const key = lookupKey(value); return key ? createHash('sha256').update(key).digest('hex') : null; };

function projectReceipt(raw, filename, ledger, now) {
  const id = filename.slice(0, -5), receivedAt = iso(raw?.receivedAt), updatedAt = iso(raw?.updatedAt);
  if (raw?.schemaVersion !== 1 || raw.id !== id || !['pending', 'reconciled', 'ambiguous'].includes(raw.status)
    || !receivedAt || !updatedAt || Date.parse(updatedAt) < Date.parse(receivedAt) || Date.parse(updatedAt) > now.getTime() + 60_000
    || !Array.isArray(raw.refs) || !raw.refs.length || raw.refs.length > 10 || !Array.isArray(raw.ledgerMatches) || raw.ledgerMatches.length > 30) throw new Error('RECEIPT_SHAPE');
  const exact = raw.refs.every(ref => ref?.kind === 'url' && ref.exact === true && typeof ref.url === 'string' && lookupKey(ref.url) === ref.lookupKey && ref.lookupKey !== null);
  const keys = exact ? [...new Set(raw.refs.map(ref => ref.lookupKey))] : [];
  const ledgerUsable = ledger?.available === true && ledger.stale === false;
  let projectedStatus = raw.status === 'reconciled' && exact && keys.every(key => raw.ledgerMatches.filter(match => match?.lookupKey === key && Number.isSafeInteger(match.row) && match.row >= 2).length === 1)
    ? 'reconciled' : raw.status === 'ambiguous' ? 'ambiguous' : 'pending';
  let projection = projectedStatus === 'reconciled' ? 'receipt' : 'none';
  if (exact && ledgerUsable) {
    const matches = keys.map(key => ledger.rows.filter(row => row.lookupHash === lookupHash(key)));
    if (matches.some(rows => rows.length > 1)) { projectedStatus = 'ambiguous'; projection = 'ledger'; }
    // A partial or unspecified scope cannot prove uniqueness outside recent-50.
    // It can expose duplicates, but cannot clear one already recorded either.
    else if (ledger.limited === false && raw.status !== 'ambiguous' && matches.every(rows => rows.length === 1)) { projectedStatus = 'reconciled'; projection = 'ledger'; }
  }
  return { id, status: projectedStatus, observedStatus: raw.status, projection,
    stale: projectedStatus !== 'reconciled' && now.getTime() - Date.parse(updatedAt) > TIP_INTAKE_STALE_MS,
    requiresCoverage: !exact || projectedStatus === 'pending', receivedAt, updatedAt };
}

function tipIntakeSnapshot({ hermesHome, now = new Date(), ledger } = {}) {
  const empty = { available: false, complete: false, limited: false, scanLimited: false, capReached: null, receiptCount: null, unreadable: 0, items: [], counts: { pending: 0, reconciled: 0, ambiguous: 0, stale: 0 },
    coverage: '이 연결의 접수 기록만 · 완전한 장부 조회의 정확한 한 행 또는 검증된 접수 기록으로 연결 확인' };
  let files;
  try {
    const directory = safePath(hermesHome, TIP_INTAKE_DIR);
    files = fs.readdirSync(directory).filter(name => producerName.test(name));
    empty.receiptCount = files.length;
    empty.capReached = files.length >= TIP_INTAKE_CAP;
    if (empty.capReached) empty.coverage += ' · 새 접수 저장 한도 도달';
    // Bound metadata reads too. When larger, the shown set is explicitly incomplete.
    const oversized = files.length > TIP_INTAKE_CAP;
    empty.scanLimited = oversized;
    files = files.slice(0, TIP_INTAKE_CAP).map(name => {
      try { const stat = fs.lstatSync(path.join(directory, name)); return { name, time: stat.mtimeMs, readable: receiptName.test(name) && stat.isFile() && !stat.isSymbolicLink() }; }
      catch { return { name, time: 0, readable: false }; }
    }).sort((a, b) => b.time - a.time || a.name.localeCompare(b.name));
    empty.limited = oversized || files.length > TIP_INTAKE_LIMIT;
  } catch { return empty; }
  const items = []; let unreadable = 0;
  for (const file of files.slice(0, TIP_INTAKE_LIMIT)) {
    try {
      if (!file.readable) throw new Error('RECEIPT_PATH');
      const raw = JSON.parse(readText(hermesHome, TIP_INTAKE_DIR + '/' + file.name, 64_000).content);
      items.push(projectReceipt(raw, file.name, ledger, new Date(now)));
    } catch { unreadable++; }
  }
  const counts = { pending: 0, reconciled: 0, ambiguous: 0, stale: 0 };
  for (const item of items) { counts[item.status]++; if (item.stale) counts.stale++; }
  return { ...empty, available: true, complete: !empty.limited && unreadable === 0, unreadable, items, counts };
}

module.exports = { tipIntakeSnapshot, projectReceipt, lookupKey, lookupHash, TIP_INTAKE_DIR, TIP_INTAKE_LIMIT, TIP_INTAKE_CAP, TIP_INTAKE_STALE_MS };
