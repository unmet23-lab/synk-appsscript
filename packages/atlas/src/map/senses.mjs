// 낱말 뜻 고르기(단계 1 · 11-11 — map/senses.json): 원천 낱말 목록(strata/topik-i.words.json)의 줄에 뜻 고르기를 얹어 지도의
// 낱말 단위를 만든다. 순수 함수다 — 파일 읽기는 tools/map-sources.mjs가 한다. 낱말 단위 하나 = 표제어 하나이고, 원천이 같은 글
// 표제어 여럿 가운데 하나만 골라 생긴 어긋남(주제 단계 낱말 · 보조 용언)을 고친다. 단위 id는 바꾸지 않는다 — 품사 · 뜻만 바뀌고,
// 자리를 빼앗긴 뜻은 새 번호로 덧붙인다(계획 §1 「ko.word.*에 번호를 이어 붙인다」). 그래서 이름 표(renames)에 적을 것이 없다.
//   멈춤: 고르기의 낱말이 원천에 없음 · from(원천 값)이 원천과 다름(원천이 바뀌어 낡은 고르기) · entry만 적은 줄이 원천 표제어와
//         다름 · 덧붙인 번호가 원천과 겹치거나 원천 끝 다음부터 빈틈없지 않음 · 같은 글 · 품사 · 뜻의 단위 둘 · 같은 글 단위 둘인데
//         뜻(sense)이 없는 줄
export const SENSES_FORMAT = 'atlas-map-senses/1';

const numberOf = id => Number(/^w(\d{4,})$/.exec(id)?.[1] ?? Number.NaN);

function overrideProblems(id, row, pick) {
  if (!row) return [`뜻 고르기의 낱말이 원천에 없다: ${id}`];
  const [, , pos, , entry] = row;
  if (pick.from) {
    if (pick.from.pos !== pos || pick.from.entry !== entry)
      return [
        `뜻 고르기의 from이 원천과 다르다(원천이 바뀌었다 — 다시 본다): ${id} ${pos}/${entry}`,
      ];
    return [];
  }
  if (pick.pos && pick.pos !== pos) return [`품사를 바꾸는 줄에 from이 없다: ${id}`];
  if (pick.entry && pick.entry !== entry)
    return [
      `풀이의 표제어가 원천과 다르다(from 없이 표제어를 바꿀 수 없다): ${id} ${entry} ≠ ${pick.entry}`,
    ];
  return [];
}

function addedProblems(added, rows) {
  const problems = [];
  const ids = new Set(rows.map(([id]) => id));
  let next = Math.max(...rows.map(([id]) => numberOf(id)).filter(Number.isFinite)) + 1;
  for (const word of added) {
    if (ids.has(word.id)) problems.push(`덧붙인 낱말 번호가 원천과 겹친다: ${word.id}`);
    else if (numberOf(word.id) !== next)
      problems.push(`덧붙인 낱말 번호는 원천 끝 다음부터 빈틈없이: ${word.id}(다음은 w${next})`);
    if (!word.word || !word.pos || !word.sense)
      problems.push(`덧붙인 낱말에 글 · 품사 · 뜻이 없다: ${word.id}`);
    next += 1;
  }
  return problems;
}

// 같은 글의 단위가 둘 이상이면 모두 뜻이 있어야 하고, 글 · 품사 · 뜻이 같은 단위는 둘일 수 없다.
function nameProblems(out) {
  const problems = [];
  const byLabel = new Map();
  for (const row of out) byLabel.set(row[1], [...(byLabel.get(row[1]) ?? []), row]);
  for (const [label, same] of byLabel) {
    if (same.length < 2) continue;
    if (same.some(row => !row[4])) problems.push(`같은 글 낱말 단위가 둘인데 뜻이 없다: ${label}`);
    const names = new Set(same.map(([, , pos, , sense]) => `${pos}·${sense}`));
    if (names.size < same.length) problems.push(`같은 글 · 품사 · 뜻의 낱말 단위가 둘: ${label}`);
  }
  return problems;
}

// rows: 원천 줄 [id, 글, 품사, 등급, 표제어]. senses: map/senses.json(없으면 원천 그대로). 반환: 지도 낱말 줄
// [id, 글, 품사, 등급] + 뜻이 있으면 [.., 뜻].
export function applySenses(rows, senses = null) {
  const words = senses?.words ?? {};
  const added = senses?.added ?? [];
  if (senses && senses.format !== SENSES_FORMAT)
    throw new Error(`Atlas map: 뜻 고르기 꼴이 다르다(${senses.format})`);
  const byId = new Map(rows.map(row => [row[0], row]));
  const problems = [
    ...Object.entries(words).flatMap(([id, pick]) => overrideProblems(id, byId.get(id), pick)),
    ...addedProblems(added, rows),
  ];
  const out = rows.map(([id, word, pos, band]) => {
    const pick = words[id];
    const row = [id, word, pick?.pos ?? pos, band];
    return pick?.sense ? [...row, pick.sense] : row;
  });
  for (const word of added) out.push([word.id, word.word, word.pos, word.band ?? null, word.sense]);
  problems.push(...nameProblems(out));
  if (problems.length) throw new Error(`Atlas map: ${problems.join(' · ')}`);
  return out;
}
