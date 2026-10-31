// Synthetic fixtures: no customer text, credentials, transcription or API calls.
export function random(seed) {
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0x100000000; };
}

export function benchmarkCases() {
  const cases = [];
  for (const size of [100, 1000, 4000, 12000]) {
    const rand = random(20261031 + size);
    const letters = Array.from({ length: size }, () => String.fromCodePoint(0xac00 + Math.floor(rand() * 120)));
    const expected = letters.join('');
    const changed = letters.map((c, i) => i % 29 === 0 ? String.fromCodePoint(0xb000 + i % 120) : c).join('');
    const mixed = letters.flatMap((c, i) => {
      if (i % 97 === 0) return [];
      if (i % 97 === 33) return [c, '힣'];
      return [i % 97 === 66 ? '뿜' : c];
    }).join('');
    for (const [kind, observed] of [
      ['substitutions', changed], ['mixed-edits', mixed], ['identical', expected],
      ['local-edit', expected.slice(0, Math.floor(size / 2)) + '힣' + expected.slice(Math.floor(size / 2) + 1)],
      ['unrelated', Array.from({ length: size }, (_, i) => String.fromCodePoint(0xc000 + i % 120)).join('')],
    ]) cases.push({ id: `${size}-${kind}`, kind, size, expected, observed });
  }
  cases.unshift({ id: 'short-korean-script', kind: 'short-script', size: null,
    expected: '오늘은 인공지능으로 자막을 만드는 방법을 알아볼게요. 먼저 영상을 불러오고, 언어를 한국어로 선택하세요. 결과를 확인한 다음 틀린 단어를 고쳐주세요.',
    observed: '오늘은 AI로 자막을 만드는 방법을 알아볼게요 먼저 영상을 불러오고 언어를 한국어로 선택해요 결과를 확인한 다음 틀린 단어를 고쳐 주세요' });
  return cases;
}

export function correctnessCases() {
  const cases = [
    ['', ''], ['', '가나다'], ['가나다', ''], [null, undefined], [123, '１２３'],
    ['안녕하세요, 유호입니다.', '안녕하세요 유호 입니다'], ['가나다', '가나다'],
    ['İ ΟΣ K Ａ ① ㍿ 𐐀 𝟠', 'i ος k a 1 株式会社 𐐨 8'],
    ['😀💡!!!\u0301\uD800', ''], ['𠮷𠮷𐐀', '𠮷𐐨'],
    ['abc', 'acb'], ['abababab', 'babababa'], ['aaaaab', 'baaaaa'],
  ];
  const rand = random(7919), alphabet = [...'가나다라마바abc012𐐀𠮷'];
  for (let k = 0; k < 2000; k++) {
    const n = Math.floor(rand() * 100), m = Math.floor(rand() * 100);
    const a = Array.from({ length: n }, () => alphabet[Math.floor(rand() * alphabet.length)]);
    const b = k % 2 ? Array.from({ length: m }, () => alphabet[Math.floor(rand() * alphabet.length)]) : a.flatMap(c => {
      const r = rand();
      return r < .1 ? [] : r < .2 ? [c, '힣'] : r < .3 ? ['쀼'] : [c];
    });
    cases.push([a.join(''), b.join('')]);
  }
  return cases;
}

export function smallStrings() {
  const strings = [''];
  let level = [''];
  for (let length = 1; length <= 5; length++) {
    level = level.flatMap(s => ['a', 'b', '가'].map(c => s + c));
    strings.push(...level);
  }
  return strings;
}
