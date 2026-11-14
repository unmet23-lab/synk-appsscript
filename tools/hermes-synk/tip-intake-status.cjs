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
const PRIVATE_QUERY = /token|auth|secret|password|signature|credential|api.?key|^key$|^sig$|^x-amz-/i;
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
  // Same pattern as tip_intake.py PRIVATE_QUERY. Ordinary words such as design/monkey are not secrets.
  if (keys.some(key => PRIVATE_QUERY.test(key))) return null;
  const tracking = key => /^utm_/i.test(key) || ['fbclid', 'gclid', 'dclid', 'msclkid'].includes(key.toLowerCase());
  const instagram = ['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am'].includes(host) && /^\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  // Same rule as tip_intake.py: the unambiguous post path is the identity; non-private
  // share/tracking query keys do not change the post. Private-looking keys returned null above.
  if (instagram) return instagram[1];
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

function tipIntakeSnapshot({ hermesHome, now = new Date(), ledger, cards } = {}) {
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
  const items = [], traces = []; let unreadable = 0;
  for (const file of files.slice(0, TIP_INTAKE_LIMIT)) {
    try {
      if (!file.readable) throw new Error('RECEIPT_PATH');
      const raw = JSON.parse(readText(hermesHome, TIP_INTAKE_DIR + '/' + file.name, 64_000).content);
      items.push(projectReceipt(raw, file.name, ledger, new Date(now)));
      // The trace is display only; it never changes the projected status or monitor events.
      if (cards) traces.push(traceReceipt(raw, { ledger, cards }));
    } catch { unreadable++; }
  }
  const counts = { pending: 0, reconciled: 0, ambiguous: 0, stale: 0 };
  for (const item of items) { counts[item.status]++; if (item.stale) counts.stale++; }
  return { ...empty, available: true, complete: !empty.limited && unreadable === 0, unreadable, items, counts, ...(cards ? { traceCounts: traceSummary(traces, { ledger, cards }) } : {}) };
}

// ── Read-time trace: receipt → ledger row → card → applied record → verified outcome ──
// Nothing here writes a receipt, the ledger or a card. Each step only reports its own evidence.
const INSTAGRAM_POST_URL = /^https:\/\/www\.instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/$/;
function refIdentity(ref) {
  if (ref?.kind !== 'url' || typeof ref.url !== 'string') return { key: null, basis: 'none' };
  if (ref.exact === true && ref.lookupKey && lookupKey(ref.url) === ref.lookupKey) return { key: ref.lookupKey, basis: 'receipt' };
  // An older receipt stayed exact=false only because of an unknown Instagram query; its stored URL is the
  // sanitized post path only the unambiguous Instagram branch produces. A display candidate, never written back.
  const match = INSTAGRAM_POST_URL.exec(ref.url);
  if (match && ref.exact === false && ref.lookupKey === null) return { key: match[1], basis: 'recovered' };
  return { key: null, basis: 'none' };
}
function cardStage(value) {
  const text = String(value || '');
  if (text.startsWith('적용함')) return 'applied';
  if (text.startsWith('새로')) return 'new';
  if (/^적용 ?중/.test(text)) return 'applying';
  if (/^(?:버림|안 맞음)/.test(text)) return 'discarded';
  return 'other';
}
function traceRef(ref, { ledger, cards }) {
  const identity = refIdentity(ref);
  const step = { identity: identity.basis,
    ignoredQueryKeys: Array.isArray(ref?.ignoredQueryKeys) ? ref.ignoredQueryKeys.filter(k => typeof k === 'string' && /^[a-z0-9_?]{1,24}$/.test(k)).slice(0, 8) : [],
    url: identity.key && typeof ref?.url === 'string' ? ref.url : null, kind: ref?.kind === 'url' || ref?.kind === 'media' ? ref.kind : 'message',
    ledger: { state: 'not_checked', rows: [] }, card: { state: 'not_checked', items: [] }, applied: 'not_checked', verified: 'unverified', issues: [] };
  if (!identity.key) { step.ledger.state = 'no_identity'; step.card.state = 'no_identity'; step.applied = 'unknown'; return step; }
  const keyHash = lookupHash(identity.key);
  if (!ledger?.available) step.ledger.state = 'unavailable';
  else {
    const rows = ledger.rows.filter(row => row.lookupHash === keyHash);
    step.ledger.rows = rows.map(row => ({ row: row.row, status: row.status }));
    step.ledger.state = rows.length === 1 ? 'one' : rows.length > 1 ? 'duplicate' : ledger.limited ? 'outside_coverage' : 'absent';
    step.ledger.stale = ledger.stale !== false;
    step.ledger.limited = ledger.limited !== false;
    step.ledger.checkedAt = ledger.checkedAt || null;
    // A row found in a bounded (recent-50) or stale copy is a candidate: a duplicate or a
    // conflicting row may sit outside it. The row itself stays visible.
    step.ledger.certain = rows.length === 1 && !step.ledger.stale && !step.ledger.limited;
    if (rows.length > 1) step.issues.push('ledger_duplicate');
  }
  if (!cards?.available) { step.card.state = 'unavailable'; step.applied = 'unknown'; }
  else {
    const items = cards.items.filter(card => card.postId && lookupKey(card.postId) === identity.key);
    step.card.items = items.map(card => ({ title: card.title, file: card.file, status: card.status, ledgerRow: card.ledgerRow ?? null }));
    step.card.state = items.length === 1 ? 'one' : items.length > 1 ? 'duplicate' : cards.complete ? 'absent' : 'unknown';
    // With unread cards another card for the same post may exist, so one found card is a candidate.
    step.card.partial = cards.complete !== true;
    step.card.certain = items.length === 1 && !step.card.partial;
    if (items.length > 1) step.issues.push('card_duplicate');
    const card = items.length === 1 ? items[0] : null;
    step.applied = card ? cardStage(card.status) : items.length > 1 || !cards.complete ? 'unknown' : 'none';
    const sheet = step.ledger.state === 'one' ? step.ledger.rows[0] : null;
    if (card && sheet && card.ledgerRow && card.ledgerRow !== sheet.row) step.issues.push('card_row_mismatch');
    if (card && sheet && cardStage(sheet.status) !== step.applied) step.issues.push('card_ledger_status_mismatch');
  }
  return step;
}
// verified stays 'unverified': neither the ledger nor a card records a deployment or user-effect
// check, and linking a task result needs exact evidence that is not recorded yet.
function traceReceipt(raw, sources) {
  const refs = Array.isArray(raw?.refs) ? raw.refs.slice(0, 10) : [];
  return { id: typeof raw?.id === 'string' ? raw.id : null, receivedAt: iso(raw?.receivedAt), refs: refs.map(ref => traceRef(ref, sources)), taskLink: 'none_recorded' };
}
// Confirmed counts need a complete, fresh source; matches from a bounded or stale source are
// counted separately as candidates. `sources` describes the coverage the counts came from.
function traceSummary(traces, sources = null) {
  const counts = { receipts: traces.length, recovered: 0, ledgerLinked: 0, ledgerCandidate: 0, outsideCoverage: 0, carded: 0, cardCandidate: 0,
    appliedRecord: 0, appliedCandidate: 0, verified: 0, issues: 0, noIdentity: 0 };
  for (const trace of traces) {
    const refs = trace.refs;
    if (refs.some(ref => ref.identity === 'recovered')) counts.recovered++;
    if (!refs.length || refs.every(ref => ref.identity === 'none')) counts.noIdentity++;
    if (refs.some(ref => ref.ledger.state === 'one' && ref.ledger.certain)) counts.ledgerLinked++;
    else if (refs.some(ref => ref.ledger.state === 'one')) counts.ledgerCandidate++;
    if (refs.some(ref => ref.ledger.state === 'outside_coverage')) counts.outsideCoverage++;
    if (refs.some(ref => ref.card.state === 'one' && ref.card.certain)) counts.carded++;
    else if (refs.some(ref => ref.card.state === 'one')) counts.cardCandidate++;
    if (refs.some(ref => ref.applied === 'applied' && ref.card.certain)) counts.appliedRecord++;
    else if (refs.some(ref => ref.applied === 'applied')) counts.appliedCandidate++;
    if (refs.some(ref => ref.issues.length)) counts.issues++;
  }
  if (sources) counts.sources = sourceCoverage(sources);
  return counts;
}
function sourceCoverage({ ledger, cards } = {}) {
  return { ledgerAvailable: ledger?.available === true, ledgerCheckedAt: ledger?.checkedAt || null, ledgerStale: ledger?.stale !== false,
    ledgerLimited: ledger?.limited !== false, cardsAvailable: cards?.available === true, cardsComplete: cards?.complete === true };
}
// Sentences that say what the counts and lines were read from. One fact per sentence.
function sourceSentences(coverage, { formatTime = value => value || '미확인' } = {}) {
  const lines = [];
  if (!coverage.ledgerAvailable) lines.push('장부 조회 사본이 없어서 장부 연결은 모두 미확인입니다.');
  else {
    lines.push(`장부 사본은 ${formatTime(coverage.ledgerCheckedAt)}에 조회했습니다.`);
    if (coverage.ledgerStale) lines.push('이 장부 사본은 오래됐습니다.');
    if (coverage.ledgerLimited) lines.push('장부 조회는 최근 50행까지입니다.');
  }
  if (!coverage.cardsAvailable) lines.push('참고 카드를 조회하지 못했습니다.');
  else if (!coverage.cardsComplete) lines.push('참고 카드 일부를 읽지 못했습니다.');
  return lines;
}
// One entry per receipt for the list view. The record saved at intake and the live lookup are kept apart.
const STORED_LABEL = Object.freeze({ pending: '장부와 대조하기 전', reconciled: '장부와 일치', ambiguous: '장부 중복 확인 필요' });
const SHORT_LEDGER = Object.freeze({ duplicate: '장부에 같은 게시물이 여러 행 있습니다.', outside_coverage: '최근 장부 50행에는 없어서 장부 연결은 미확인입니다.',
  absent: '최근 장부에서 찾지 못했습니다.' });
const SHORT_CARD = Object.freeze({ applied: '참고 카드에 적용 기록이 있습니다.', applying: '참고 카드에는 적용 중이라고 적혀 있습니다.', new: '참고 카드는 아직 적용 전입니다.',
  discarded: '참고 카드에는 쓰지 않기로 했다고 적혀 있습니다.', other: '참고 카드 상태는 원문 확인이 필요합니다.' });
function traceLine(trace, storedStatus, { formatTime = value => value || '미확인' } = {}) {
  const parts = trace.refs.map((ref, index) => {
    const prefix = trace.refs.length > 1 ? `자료 ${index + 1}: ` : '';
    if (ref.identity === 'none') return prefix + '게시물을 식별할 수 없습니다.';
    const ledger = ref.ledger.state === 'one' ? `장부 ${ref.ledger.rows[0].row}행에서 찾았습니다.`
      + (ref.ledger.certain ? '' : ' 이 장부 연결은 부분 조회나 오래된 사본에서 찾은 후보입니다.') : SHORT_LEDGER[ref.ledger.state] || '장부 연결은 미확인입니다.';
    const card = ref.card.state === 'one' ? (SHORT_CARD[ref.applied] || '참고 카드의 적용 여부는 미확인입니다.')
      + (ref.card.certain ? '' : ' 이 카드 연결은 일부만 읽은 카드에서 찾은 후보입니다.')
      : ref.card.state === 'duplicate' ? '참고 카드가 여러 장 있습니다.' : ref.card.state === 'absent' ? '연결된 참고 카드가 없습니다.' : '참고 카드 연결은 미확인입니다.';
    return prefix + [ledger, card, ref.identity === 'recovered' ? '저장된 주소 경로로 식별했습니다.' : '', ref.issues.length ? '확인할 점이 있습니다.' : ''].filter(Boolean).join(' ');
  });
  return `- ${trace.id}\n  ${formatTime(trace.receivedAt)}에 접수했습니다. 접수 당시 기록은 「${STORED_LABEL[storedStatus] || '미확인'}」입니다.\n`
    + `  지금 조회한 결과: ${parts.join(' ') || '자료가 없습니다.'}`;
}
const TRACE_LABEL = Object.freeze({
  identity: { receipt: '게시물은 접수할 때 확인한 ID로 식별했습니다.',
    recovered: '게시물은 저장된 주소 경로에서 ID를 다시 찾아 식별했습니다. 이 식별은 후보이고, 접수 기록은 바꾸지 않았습니다.',
    none: '이 자료는 게시물을 식별할 수 없습니다. 그래서 장부와 카드에 잇지 않았습니다.' },
  ledger: { outside_coverage: '최근 장부 50행에서는 찾지 못했습니다. 더 오래된 행에 있을 수 있어 장부 연결은 미확인입니다.', absent: '최근 장부 조회에서 찾지 못했습니다.',
    unavailable: '장부 조회 사본이 없어서 장부 연결은 미확인입니다.', no_identity: '식별할 수 없어서 장부와 대조하지 않았습니다.', not_checked: '장부 연결은 미확인입니다.' },
  card: { duplicate: '같은 게시물을 가리키는 참고 카드가 여러 장 있습니다.', absent: '연결된 참고 카드가 없습니다. 아직 적용안이 없다는 뜻입니다.',
    unknown: '참고 카드 일부를 읽지 못해서 카드 연결은 미확인입니다.', unavailable: '참고 카드를 조회하지 못해서 카드 연결은 미확인입니다.',
    no_identity: '식별할 수 없어서 참고 카드와 대조하지 않았습니다.', not_checked: '카드 연결은 미확인입니다.' },
  applied: { applied: '카드 원문에 적용 기록이 있습니다.', applying: '카드 원문에는 적용 중이라고 적혀 있습니다.', new: '카드 원문에는 아직 적용 전이라고 적혀 있습니다.',
    discarded: '카드 원문에는 쓰지 않기로 했다고 적혀 있습니다.', other: '카드 상태가 정해진 값이 아니어서 원문 확인이 필요합니다.',
    none: '적용 기록이 없습니다.', unknown: '적용 여부는 미확인입니다.', not_checked: '적용 여부는 미확인입니다.' },
  issue: { ledger_duplicate: '장부에 같은 게시물이 여러 행 있습니다.', card_duplicate: '같은 게시물의 참고 카드가 여러 장 있습니다.',
    card_row_mismatch: '카드에 적힌 장부 행 번호가 실제 장부 행과 다릅니다.',
    card_ledger_status_mismatch: '카드 상태와 장부 상태가 다릅니다. 카드 원문을 우선하고 자동으로 고치지 않았습니다.' },
});
function formatTrace(trace, { formatTime = value => value || '미확인', clip = (value, n) => String(value || '').slice(0, n) } = {}) {
  const lines = [trace.id, `이 자료는 ${formatTime(trace.receivedAt)}에 접수했습니다. 접수 당시 기록이 남아 있습니다.`];
  trace.refs.forEach((ref, index) => {
    lines.push('', `자료 ${index + 1}: ${ref.url ? clip(ref.url, 200) : ref.kind === 'media' ? '사진이나 영상 첨부' : '주소는 숨겼고 참조만 남아 있습니다'}`);
    lines.push('  ' + TRACE_LABEL.identity[ref.identity]);
    if (ref.ignoredQueryKeys.length) lines.push(`  주소 뒤에 붙은 모르는 꼬리표 ${ref.ignoredQueryKeys.length}개는 식별에 쓰지 않았습니다.`);
    if (ref.ledger.state === 'one') {
      lines.push(`  장부 ${ref.ledger.rows[0].row}행에서 찾았습니다. 장부에 적힌 상태는 「${clip(ref.ledger.rows[0].status, 40)}」입니다.`);
      if (ref.ledger.limited) lines.push('  장부 조회는 최근 50행까지라서 더 오래된 행에 같은 게시물이 있는지는 미확인입니다.');
      if (ref.ledger.stale) lines.push('  장부 사본이 오래돼서 지금 장부와 같은지는 미확인입니다.');
    }
    else if (ref.ledger.state === 'duplicate') lines.push(`  같은 게시물이 장부의 ${ref.ledger.rows.map(row => row.row + '행').join(', ')}에 있습니다. 중복인지 확인이 필요합니다.`);
    else lines.push('  ' + TRACE_LABEL.ledger[ref.ledger.state]);
    if (ref.ledger.checkedAt) lines.push(`  장부 사본은 ${formatTime(ref.ledger.checkedAt)}에 조회한 것입니다.${ref.ledger.stale ? ' 이 사본은 오래됐습니다.' : ''}`);
    if (ref.card.state === 'one') {
      lines.push(`  참고 카드가 연결됐습니다. 카드 제목은 「${clip(ref.card.items[0].title, 70)}」입니다. 파일은 ${ref.card.items[0].file} 입니다.`);
      if (!ref.card.certain) lines.push('  참고 카드 일부를 읽지 못해서 같은 게시물의 다른 카드가 있는지는 미확인입니다.');
    } else lines.push('  ' + TRACE_LABEL.card[ref.card.state]);
    lines.push('  ' + TRACE_LABEL.applied[ref.applied]);
    if (ref.card.state === 'one' && !ref.card.certain && ref.applied === 'applied') lines.push('  그래서 이 적용 기록은 후보로 봅니다.');
    if (ref.card.state === 'one') lines.push(`  카드에 적힌 상태는 「${clip(ref.card.items[0].status, 80)}」입니다.`);
    lines.push('  배포와 사용자 효과는 검증 기록이 없습니다. 적용 기록이 있어도 배포가 확인된 것은 아닙니다.');
    for (const issue of ref.issues) lines.push('  확인 필요: ' + TRACE_LABEL.issue[issue]);
  });
  lines.push('', '이 접수를 가리키는 맡긴 작업 연결 기록은 없습니다.');
  lines.push('접수 기록, 장부, 카드는 읽기만 했고 바꾸지 않았습니다.');
  return lines.join('\n');
}

module.exports = { PRIVATE_QUERY, traceLine, sourceCoverage, sourceSentences, refIdentity, cardStage, traceRef, traceReceipt, traceSummary, formatTrace, TRACE_LABEL,
  tipIntakeSnapshot, projectReceipt, lookupKey, lookupHash, TIP_INTAKE_DIR, TIP_INTAKE_LIMIT, TIP_INTAKE_CAP, TIP_INTAKE_STALE_MS };
