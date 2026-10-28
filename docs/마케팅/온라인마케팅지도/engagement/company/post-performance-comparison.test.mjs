import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { performanceComparisons } from './post-performance-comparison.mjs';
import { createPostPerformanceService, POST_PERFORMANCE_METRICS } from './post-performance.mjs';

const HOUR = 3600000, BASE = Date.parse('2025-01-01T00:00:00Z');
const iso = hours => new Date(BASE + hours * HOUR).toISOString();
const definitions = POST_PERFORMANCE_METRICS.filter(metric => ['views', 'likes', 'averageViewPct'].includes(metric.id));
const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00.000Z') + days * 24 * HOUR).toISOString().slice(0, 10);
const windowDetail = meta => meta?.kind === 'window' && meta.timeZone === 'America/Los_Angeles' && meta.days === 3 && /^\d{4}-\d{2}-\d{2}$/.test(meta.startDate || '') && meta.endDate === addDays(meta.startDate, 2);
const windowMeta = (source = 'youtube-analytics', unit = 'count') => ({ kind: 'window', timeZone: 'America/Los_Angeles', days: 3, startDate: '2025-01-01', endDate: '2025-01-03', source, unit });
function row(id, published = Number(id), offset = 0) {
  return { id: String(id), platform: 'instagram', channelId: 'channel', publicationFormat: 'instagram-reels', publishedAt: iso(published),
    checkpoints: [24, 72].map(hours => ({ hours, status: 'recorded', dueAt: iso(published + hours), closesAt: iso(published + hours + 6), observedAt: iso(published + hours + offset),
      metrics: { views: Number(id), likes: Number(id) % 3, averageViewPct: Number(id) * 1.5 },
      metricProvenance: Object.fromEntries(definitions.map(def => [def.id, { source: 'api', unit: def.unit, observedAt: iso(published + hours + offset) }])) })) };
}

// Independent pre-optimization algorithm. Keep its filtering / median formula
// here as an output oracle, rather than reproducing the new tree operations.
function reference(row, checkpoint, all, metrics = definitions) {
  const points = all.filter(other => other.id !== row.id && other.channelId === row.channelId && (other.publicationFormat || null) === (row.publicationFormat || null) && other.publishedAt < row.publishedAt)
    .map(other => other.checkpoints.find(item => item.hours === checkpoint.hours)).filter(Boolean);
  const prior = points.filter(item => item.status === 'recorded' && item.observedAt && Date.parse(item.observedAt) <= Date.parse(item.closesAt));
  return Object.fromEntries(metrics.map(({ id: key, unit }) => {
    const meta = checkpoint.metricProvenance?.[key], windowed = meta?.kind === 'window';
    const valid = windowed ? windowDetail(meta) && meta.unit === unit : checkpoint.status === 'recorded' && meta && !meta.measurementWindowMissed;
    const offset = valid && !windowed ? Date.parse(meta.observedAt) - Date.parse(checkpoint.dueAt) : null;
    const values = valid ? (windowed ? points : prior).filter(item => {
      const previous = item.metricProvenance?.[key];
      if (windowed) return windowDetail(previous) && windowDetail(meta) && previous.source === meta.source && previous.unit === meta.unit;
      return previous && previous.kind !== 'window' && !previous.measurementWindowMissed && previous.unit === unit && previous.source === meta.source
        && Math.abs((Date.parse(previous.observedAt) - Date.parse(item.dueAt)) - offset) <= 15 * 60000;
    }).map(item => item.metrics?.[key]).filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b) : [];
    const middle = Math.floor(values.length / 2), median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null, value = valid ? checkpoint.metrics[key] : null;
    return [key, { sampleCount: values.length, median, delta: value !== null && value !== undefined && median !== null ? value - median : null,
      deltaPercent: value !== null && value !== undefined && median > 0 ? Math.round((value - median) / median * 1000) / 10 : null }];
  }));
}
function matches(rows, targets = rows) {
  const before = structuredClone(rows), actual = performanceComparisons(rows, definitions, { windowDetail, targets });
  for (const entry of targets) assert.deepEqual(actual.get(entry), entry.checkpoints.map(checkpoint => reference(entry, checkpoint, rows)), 'entry ' + entry.id);
  assert.deepEqual(rows, before, 'comparisons must not mutate their input');
  return actual;
}

test('comparison retains exact time boundaries, ties, same-ID exclusion and the first checkpoint', () => {
  const rows = [row(1, 1, 0), row(2, 2, .25), row(3, 3, .250001), row(4, 4, -.25), row(5, 5, -.250001), row(6, 6), row(7, 6), row(8, 8)];
  for (const [index, offset] of [[2, 900001], [4, -900001]]) for (const point of rows[index].checkpoints) {
    const at = new Date(Date.parse(point.dueAt) + offset).toISOString(); point.observedAt = at;
    for (const meta of Object.values(point.metricProvenance)) meta.observedAt = at;
  }
  rows[1].id = rows[5].id; rows[0].checkpoints.push({ ...structuredClone(rows[0].checkpoints[0]), metrics: { views: 99999 } });
  const view = matches(rows);
  assert.equal(view.get(rows[5])[0].views.sampleCount, 2, 'only IDs 1 and 4 are in range; duplicate self and 1ms-outside observations are excluded');
  assert.equal(view.get(rows[6])[0].views.sampleCount, 3, 'equal publication time is excluded');
  for (const target of rows) matches(rows, [target]);
});

test('window recounts preserve source, unit and window shape without snapshot status or delay restrictions', () => {
  const rows = Array.from({ length: 10 }, (_, i) => row(i, i));
  for (const entry of rows) for (const point of entry.checkpoints) { point.status = 'missed'; point.observedAt = null; point.metricProvenance.views = windowMeta(); }
  rows[1].checkpoints[0].metricProvenance.views.source = 'different';
  rows[2].checkpoints[0].metricProvenance.views.unit = 'percent';
  rows[3].checkpoints[0].metricProvenance.views.days = 2;
  rows[4].checkpoints[0].metricProvenance.views.timeZone = 'UTC';
  rows[5].checkpoints[0].metricProvenance.views.endDate = '2025-01-04';
  rows[6].checkpoints[0].metricProvenance.views = { source: 'youtube-analytics', unit: 'count', observedAt: iso(30) };
  const result = matches(rows); assert.equal(result.get(rows[9])[0].views.sampleCount, 3);
});

test('missing dates, NaN/Infinity metrics and absent provenance stay out of baselines', () => {
  const rows = Array.from({ length: 14 }, (_, i) => row(i, i));
  rows[1].checkpoints[0].metrics.views = NaN; rows[2].checkpoints[0].metrics.views = Infinity;
  rows[3].checkpoints[0].metrics.views = null; rows[4].checkpoints[0].metrics.views = '4';
  delete rows[5].checkpoints[0].metricProvenance.views; delete rows[6].checkpoints[0].observedAt;
  delete rows[7].checkpoints[0].dueAt; rows[8].checkpoints[0].closesAt = 'invalid';
  rows[9].checkpoints[0].metricProvenance.views.observedAt = 'invalid'; rows[10].checkpoints[0].metricProvenance.views.measurementWindowMissed = true;
  matches(rows);
  delete rows[11].publishedAt; rows[12].publishedAt = NaN; matches(rows);
  rows[11].channelId = NaN; matches(rows);
});

test('seeded mixed histories match the independent old algorithm including one-entry responses', () => {
  let state = 0x581072;
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  for (let trial = 0; trial < 24; trial++) {
    const rows = Array.from({ length: 30 + random(80) }, (_, i) => {
      const entry = row(i, random(40), (random(120) - 20) / 60);
      entry.channelId = 'channel-' + random(3); entry.publicationFormat = [null, 'instagram-reels', 'legacy'][random(3)];
      for (const point of entry.checkpoints) {
        point.status = ['recorded', 'recorded', 'pending', 'missed'][random(4)];
        if (random(9) === 0) point.observedAt = iso(1000);
        for (const def of definitions) {
          const meta = point.metricProvenance[def.id]; meta.source = ['api', 'manual', undefined][random(3)];
          point.metrics[def.id] = random(7) ? random(500) / (def.unit === 'count' ? 1 : 3) : null;
          if (random(4) === 0) point.metricProvenance[def.id] = windowMeta(meta.source, def.unit);
          else if (random(9) === 0) meta.measurementWindowMissed = true;
          if (random(12) === 0) delete point.metricProvenance[def.id];
        }
      }
      return entry;
    });
    rows.sort(() => random(3) - 1); // Deliberately unsorted stored insertion order.
    matches(rows); matches(rows, [rows[random(rows.length)]]);
  }
});

test('invalid calendar metadata cannot turn a comparison into an exception', () => {
  const rows = [row(1), row(2)];
  for (const entry of rows) entry.checkpoints[0].metricProvenance.views = { ...windowMeta(), startDate: '2025-99-99' };
  const result = performanceComparisons(rows, definitions, { windowDetail });
  assert.deepEqual(result.get(rows[1])[0].views, { sampleCount: 0, median: null, delta: null, deltaPercent: null });
});

test('list rechecks current access and data on every read and isolates returned objects', () => {
  const user = { id: 'owner', active: true, role: 'member', teamId: 'a' }, channel = { id: 'channel', active: true, platform: 'instagram', ownerIds: ['owner'], teamId: 'a' };
  const rows = [row(1), row(2), row(3)];
  const store = { all: kind => structuredClone(kind === 'channels' ? [channel] : kind === 'postPerformanceEntries' ? rows : []), get: kind => structuredClone(kind === 'users' ? user : kind === 'channels' ? channel : null) };
  const service = createPostPerformanceService({ store, isConnected: () => false, collector: () => { throw Error('External collection forbidden'); }, fetchImpl: () => { throw Error('External fetch forbidden'); } });
  const first = service.list({ ...user, role: 'admin' }); assert.equal(first.entries[0].checkpoints[0].comparison.views.median, 1.5);
  first.entries[0].checkpoints[0].comparison.views.median = 999; first.entries[0].checkpoints[0].metrics.views = 999;
  rows[0].checkpoints[0].metrics.views = 9;
  assert.equal(service.list(user).entries[0].checkpoints[0].comparison.views.median, 5.5);
  channel.ownerIds = ['someone-else']; assert.equal(service.list({ ...user, role: 'admin' }).entries.length, 0);
  user.role = 'viewer'; assert.equal(service.list(user).entries[0].canEdit, false);
  channel.active = false; assert.equal(service.list(user).entries.length, 0);
  user.active = false; assert.throws(() => service.list({ ...user, active: true }), { status: 403 });
});

test('a 3000-post single-channel history reads values linearly and gives exact final medians', t => {
  let reads = 0; const size = 3000, rows = Array.from({ length: size }, (_, i) => row(i, i, (i % 31) / 60));
  for (const entry of rows) for (const point of entry.checkpoints) Object.defineProperty(point.metrics, 'views', { enumerable: true, get() { reads++; return Number(entry.id); } });
  const started = performance.now(), actual = performanceComparisons(rows, definitions, { windowDetail }), elapsedMs = performance.now() - started;
  assert.ok(reads < size * 10, `historical values were reread ${reads} times`);
  const countedReads = reads;
  for (const entry of rows.slice(-3)) assert.deepEqual(actual.get(entry), entry.checkpoints.map(point => reference(entry, point, rows)));
  t.diagnostic(JSON.stringify({ synthetic: true, node: process.version, posts: size, comparisonMs: Math.round(elapsedMs), metricReadsBeforeOracle: countedReads }));
});
