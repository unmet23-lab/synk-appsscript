// Frozen pre-optimization oracle from e93481078 (tools/영상사전검사.mjs).
// Keep independent from production and optimized helpers. Benchmark/test use only.
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function compareText(expected, observed) {
  const a = [...normalize(expected)], b = [...normalize(observed)];
  if (a.length > 12000 || b.length > 12000) throw new Error('대본 대조는 문장부호·공백을 뺀 12,000자까지 지원합니다. 편을 나눠 주세요.');
  let previous = Uint16Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = new Uint16Array(b.length + 1); current[0] = i;
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return { expectedCharacters: a.length, observedCharacters: b.length, editDistance: previous[b.length], similarity: Math.max(a.length, b.length) ? 1 - previous[b.length] / Math.max(a.length, b.length) : 1, method: 'normalized-character-edit-distance' };
}
