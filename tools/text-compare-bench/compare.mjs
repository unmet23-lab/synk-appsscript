// Experimental only. The production compareText in 영상사전검사.mjs is unchanged.
export const MAX_CHARACTERS = 12000;
export const LIMIT_MESSAGE = '대본 대조는 문장부호·공백을 뺀 12,000자까지 지원합니다. 편을 나눠 주세요.';

// Keep Node's Unicode version, contextual lowercase and String(value) semantics
// identical for BOTH candidates. Rust receives Unicode scalar values, not bytes.
export function prepare(expected, observed) {
  const points = value => Uint32Array.from(
    String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''),
    c => c.codePointAt(0),
  );
  const a = points(expected), b = points(observed);
  if (a.length > MAX_CHARACTERS || b.length > MAX_CHARACTERS) throw new Error(LIMIT_MESSAGE);
  return { a, b };
}

export function result(a, b, distance) {
  const longest = Math.max(a.length, b.length);
  return { expectedCharacters: a.length, observedCharacters: b.length,
    editDistance: distance, similarity: longest ? 1 - distance / longest : 1,
    method: 'normalized-character-edit-distance' };
}

// Exact Levenshtein: remove equal ends, then widen a diagonal band until the
// exact distance fits. The positional substitution + tail insertion script
// supplies a valid upper bound; this never returns an approximate distance.
export function distanceJs(a, b) {
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  a = a.subarray(start, endA); b = b.subarray(start, endB);
  if (a.length < b.length) [a, b] = [b, a];
  const n = a.length, m = b.length;
  if (!m) return n;
  let upper = n - m;
  for (let j = 0; j < m; j++) upper += a[j] === b[j] ? 0 : 1;
  let band = Math.min(upper, Math.max(4, n - m));
  const row = new Uint16Array(m + 1);
  for (;;) {
    const infinity = band + 1;
    row.fill(infinity);
    for (let j = 0; j <= Math.min(m, band); j++) row[j] = j;
    let distance = infinity;
    for (let i = 1; i <= n; i++) {
      const low = Math.max(1, i - band), high = Math.min(m, i + band);
      let diagonal = row[low - 1];
      row[low - 1] = low === 1 ? (i <= band ? i : infinity) : infinity;
      let minimum = row[low - 1];
      const letter = a[i - 1];
      for (let j = low; j <= high; j++) {
        const above = row[j];
        const value = Math.min(row[j - 1] + 1, above + 1, diagonal + (letter === b[j - 1] ? 0 : 1));
        row[j] = value;
        diagonal = above;
        if (value < minimum) minimum = value;
      }
      if (high < m) row[high + 1] = infinity;
      if (minimum > band) break;
      if (i === n) distance = row[m];
    }
    if (distance <= band) return distance;
    band = Math.min(upper, band * 2);
  }
}

export function compareTextJs(expected, observed) {
  const { a, b } = prepare(expected, observed);
  return result(a, b, distanceJs(a, b));
}
