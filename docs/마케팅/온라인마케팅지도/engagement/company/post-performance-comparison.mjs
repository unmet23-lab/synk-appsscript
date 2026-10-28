// A comparison exists only for this synchronous read. No user, permission or
// record is cached between requests.
// 1. Partition by channel / publication format / checkpoint / metric / source.
// 2. Walk publication times in ascending order; query a whole tie before adding
//    it, so equal or later publications can never enter an earlier baseline.
// 3. Each value-tree node counts observation delays with a Fenwick tree. Range
//    counts and kth values give the exact median within +/- 15 minutes without
//    filtering and sorting all previous posts for every displayed post.
// Building uses O(n log n) storage; an insertion / median uses O(log^2 n).
const DELAY = 15 * 60000;
const lower = (values, value) => bound(values, value, false);
const upper = (values, value) => bound(values, value, true);
function bound(values, value, inclusive) {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (values[mid] < value || inclusive && values[mid] === value) lo = mid + 1; else hi = mid; }
  return lo;
}
function branch(points, values, lo, hi) {
  const offsets = [...new Set(points.map(point => point.offset))].sort((a, b) => a - b);
  const node = { offsets, counts: new Int32Array(offsets.length + 1), lo, hi };
  if (lo < hi) {
    const mid = (lo + hi) >>> 1, split = values[mid + 1], left = [], right = [];
    for (const point of points) (point.value < split ? left : right).push(point);
    node.split = split; node.left = branch(left, values, lo, mid); node.right = branch(right, values, mid + 1, hi);
  }
  return node;
}
function add(node, point, delta) {
  for (let i = lower(node.offsets, point.offset) + 1; i < node.counts.length; i += i & -i) node.counts[i] += delta;
  if (node.left) add(point.value < node.split ? node.left : node.right, point, delta);
}
function prefix(node, length) { let count = 0; for (let i = length; i > 0; i -= i & -i) count += node.counts[i]; return count; }
function count(node, from, to) { return prefix(node, upper(node.offsets, to)) - prefix(node, lower(node.offsets, from)); }
function kth(node, values, from, to, rank) {
  if (!node.left) return values[node.lo];
  const left = count(node.left, from, to);
  return rank < left ? kth(node.left, values, from, to, rank) : kth(node.right, values, from, to, rank - left);
}
function prepare(bucket) {
  bucket.values = [...new Set(bucket.points.map(point => point.value))].sort((a, b) => a - b);
  bucket.root = branch(bucket.points, bucket.values, 0, bucket.values.length - 1);
}
function median(bucket, offset, windowed) {
  if (!bucket || !windowed && !Number.isFinite(offset)) return { sampleCount: 0, median: null };
  const from = windowed ? -Infinity : offset - DELAY, to = windowed ? Infinity : offset + DELAY;
  const sampleCount = count(bucket.root, from, to), middle = Math.floor(sampleCount / 2);
  if (!sampleCount) return { sampleCount, median: null };
  const right = kth(bucket.root, bucket.values, from, to, middle);
  return { sampleCount, median: sampleCount % 2 ? right : (kth(bucket.root, bucket.values, from, to, middle - 1) + right) / 2 };
}
function nested(map, key) { if (!map.has(key)) map.set(key, new Map()); return map.get(key); }
function bucketAt(group, hours, key, kind, source, create = false) {
  // Map equates NaN with itself, whereas the existing strict comparison does not.
  if (Number.isNaN(hours) || Number.isNaN(source)) return null;
  let map = group.buckets;
  for (const value of [hours, key, kind]) { if (create) map = nested(map, value); else { map = map.get(value); if (!map) return null; } }
  if (create && !map.has(source)) { const bucket = { points: [] }; map.set(source, bucket); group.allBuckets.push(bucket); }
  return map.get(source);
}
function result(current, summary) {
  const { sampleCount, median } = summary, value = current.value;
  return { sampleCount, median, delta: value !== null && value !== undefined && median !== null ? value - median : null,
    deltaPercent: value !== null && value !== undefined && median > 0 ? Math.round((value - median) / median * 1000) / 10 : null };
}

export function performanceComparisons(rows, definitions, { windowDetail, targets = rows } = {}) {
  const requested = new Set(targets), results = new WeakMap(), groups = new Map(), parsed = new Map();
  const ms = value => { if (!parsed.has(value)) parsed.set(value, Date.parse(value)); return parsed.get(value); };
  const windowValid = meta => { try { return windowDetail(meta); } catch { return false; } };
  const describe = (checkpoint, definition) => {
    const meta = checkpoint.metricProvenance?.[definition.id], windowed = meta?.kind === 'window';
    const valid = windowed ? windowValid(meta) && meta.unit === definition.unit : checkpoint.status === 'recorded' && meta && !meta.measurementWindowMissed;
    return { valid, windowed, source: meta?.source, offset: valid && !windowed ? ms(meta.observedAt) - ms(checkpoint.dueAt) : 0,
      value: valid ? checkpoint.metrics[definition.id] : null };
  };
  for (const row of rows) {
    const byFormat = nested(groups, row.channelId), format = row.publicationFormat || null;
    if (!byFormat.has(format)) byFormat.set(format, { rows: [], buckets: new Map(), allBuckets: [], contributions: new Map() });
    byFormat.get(format).rows.push(row);
  }
  for (const byFormat of groups.values()) for (const group of byFormat.values()) {
    // Normal stored publication times are normalized ISO strings. Malformed old
    // data keeps JavaScript's original relational semantics via the
    // fallback below, rather than being assigned an invented chronological rank.
    const ordinary = group.rows.every(row => typeof row.publishedAt === 'string' && !Number.isNaN(row.channelId));
    // A mutation returning one entry needs only one scan, not a history index.
    if (!ordinary || targets.length === 1) { fallback(group.rows); continue; }
    for (const row of group.rows) {
      const contributions = [], hours = new Set(); group.contributions.set(row, contributions);
      for (const checkpoint of row.checkpoints) {
        if (hours.has(checkpoint.hours)) continue; hours.add(checkpoint.hours); // .find() used the first matching checkpoint.
        const onTime = checkpoint.status === 'recorded' && checkpoint.observedAt && ms(checkpoint.observedAt) <= ms(checkpoint.closesAt);
        for (const definition of definitions) {
          const meta = checkpoint.metricProvenance?.[definition.id], value = checkpoint.metrics?.[definition.id];
          if (!meta || meta.unit !== definition.unit || typeof value !== 'number' || !Number.isFinite(value)) continue;
          const windowed = meta.kind === 'window';
          if (windowed ? !windowValid(meta) : !onTime || meta.measurementWindowMissed) continue;
          const offset = windowed ? 0 : ms(meta.observedAt) - ms(checkpoint.dueAt);
          if (!Number.isFinite(offset)) continue;
          const bucket = bucketAt(group, checkpoint.hours, definition.id, windowed ? 'window' : 'snapshot', meta.source, true);
          if (!bucket) continue;
          const point = { value, offset }; bucket.points.push(point); contributions.push({ bucket, point });
        }
      }
    }
    for (const bucket of group.allBuckets) prepare(bucket);
    const ordered = group.rows.slice().sort((a, b) => a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0), activeById = new Map();
    for (let first = 0; first < ordered.length;) {
      let end = first + 1; while (end < ordered.length && ordered[end].publishedAt === ordered[first].publishedAt) end++;
      for (let i = first; i < end; i++) {
        const row = ordered[i]; if (!requested.has(row)) continue;
        // Store IDs are unique. Also preserve exclusion for duplicated legacy /
        // synthetic IDs: no row can compare with an earlier copy of itself.
        const own = Number.isNaN(row.id) ? [] : activeById.get(row.id) || [];
        for (const { bucket, point } of own) add(bucket.root, point, -1);
        results.set(row, row.checkpoints.map(checkpoint => Object.fromEntries(definitions.map(definition => {
          const current = describe(checkpoint, definition), bucket = current.valid ? bucketAt(group, checkpoint.hours, definition.id, current.windowed ? 'window' : 'snapshot', current.source) : null;
          return [definition.id, result(current, median(bucket, current.offset, current.windowed))];
        }))));
        for (const { bucket, point } of own) add(bucket.root, point, 1);
      }
      for (let i = first; i < end; i++) {
        const row = ordered[i], points = group.contributions.get(row);
        for (const { bucket, point } of points) add(bucket.root, point, 1);
        if (!activeById.has(row.id)) activeById.set(row.id, []); activeById.get(row.id).push(...points);
      }
      first = end;
    }
  }
  return results;

  function fallback(groupRows) {
    for (const row of groupRows) {
      if (!requested.has(row)) continue;
      results.set(row, row.checkpoints.map(checkpoint => {
        const points = groupRows.filter(other => other.id !== row.id && other.channelId === row.channelId && (other.publicationFormat || null) === (row.publicationFormat || null) && other.publishedAt < row.publishedAt)
          .map(other => other.checkpoints.find(item => item.hours === checkpoint.hours)).filter(Boolean);
        return Object.fromEntries(definitions.map(definition => {
          const current = describe(checkpoint, definition), values = current.valid ? points.filter(point => {
            const meta = point.metricProvenance?.[definition.id]; if (!meta || meta.unit !== definition.unit || meta.source !== current.source) return false;
            if (current.windowed) return windowValid(meta);
            return point.status === 'recorded' && point.observedAt && ms(point.observedAt) <= ms(point.closesAt) && meta.kind !== 'window' && !meta.measurementWindowMissed
              && Math.abs(ms(meta.observedAt) - ms(point.dueAt) - current.offset) <= DELAY;
          }).map(point => point.metrics?.[definition.id]).filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b) : [];
          const middle = Math.floor(values.length / 2), median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null;
          return [definition.id, result(current, { sampleCount: values.length, median })];
        }));
      }));
    }
  }
}
