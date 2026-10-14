// 가족 이야기 앨범의 읽기 전용 모아 보기: 연도·나이 축 타임라인과 사람별 모아 보기.
// 앨범을 바꾸지 않으며 페이지의 기존 칸(date, person)만 읽는다. 날짜를 짐작해 채우지 않는다.

const collator = new Intl.Collator('ko-KR');
const entryOf = (page, birthYear) => {
  const year = page.date ? Number(page.date.slice(0, 4)) : null;
  const age = year !== null && birthYear !== null ? year - birthYear : null;
  return {
    id: page.id, title: page.title, date: page.date || '', year,
    age: age !== null && age >= 0 ? age : null, beforeBirth: age !== null && age < 0,
    questionId: page.questionId ?? null, recipe: Boolean(page.recipe), hasPhoto: Boolean(page.photo), hasAudio: Boolean(page.audio),
  };
};
const byDate = (a, b) => a.date.localeCompare(b.date) || collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
const ageText = n => n === 0 ? '태어난 해' : `${n}살`;
function ageLabel(entries) {
  const ages = entries.map(e => e.age).filter(age => age !== null);
  if (!ages.length) return entries.some(e => e.beforeBirth) ? '태어나기 전' : null;
  const min = Math.min(...ages), max = Math.max(...ages);
  const range = min === max ? ageText(min) : min === 0 ? `태어난 해~${max}살` : `${min}~${max}살`;
  return `${entries.some(e => e.beforeBirth) ? '태어나기 전부터 ' : ''}${range} 무렵`;
}
function ageBucket(entry) {
  if (entry.beforeBirth) return { key: 'before-birth', label: '태어나기 전', order: -1 };
  const decade = Math.floor(entry.age / 10) * 10;
  return { key: `age-${decade}`, label: decade === 0 ? '열 살 전' : `${decade}대`, order: decade };
}

/**
 * 연대별(by: 'decade', 기본) 또는 나이대별(by: 'age') 타임라인.
 * storyteller를 주지 않으면 album.storyteller를 쓴다. 태어난 해를 모르면 나이 칸은 null이고
 * 'age'를 골라도 연대별로 묶는다(결과의 by로 알린다).
 * 반환: { by, birthYear, groups: [{ key, label, from, to, ageLabel, pages }], undated: [...] }
 * pages 항목: { id, title, date, year, age, beforeBirth, questionId, recipe, hasPhoto, hasAudio }
 */
export function timeline(album, storyteller, { by = 'decade' } = {}) {
  const teller = storyteller === undefined ? album?.storyteller ?? null : storyteller;
  const birthYear = Number.isInteger(teller?.birthYear) ? teller.birthYear : null;
  const mode = by === 'age' && birthYear !== null ? 'age' : 'decade';
  const dated = [], undated = [];
  for (const page of album?.pages ?? []) (page.date ? dated : undated).push(entryOf(page, birthYear));
  dated.sort(byDate);
  undated.sort((a, b) => collator.compare(a.title, b.title) || a.id.localeCompare(b.id));
  const groups = new Map();
  for (const entry of dated) {
    const bucket = mode === 'age'
      ? ageBucket(entry)
      : { key: `decade-${Math.floor(entry.year / 10) * 10}`, label: `${Math.floor(entry.year / 10) * 10}년대`, order: Math.floor(entry.year / 10) * 10 };
    if (!groups.has(bucket.key)) groups.set(bucket.key, { ...bucket, pages: [] });
    groups.get(bucket.key).pages.push(entry);
  }
  return {
    by: mode, birthYear,
    groups: [...groups.values()].sort((a, b) => a.order - b.order).map(({ key, label, pages }) => ({
      key, label, from: pages[0].year, to: pages[pages.length - 1].year, ageLabel: ageLabel(pages), pages,
    })),
    undated,
  };
}

// 「함께한 사람」 칸은 자유 글이다. 쉼표·가운뎃점·빗금과 '와/과/하고/랑/이랑/그리고' 뒤 띄어쓰기에서만 나눈다.
// '큰 이모'처럼 띄어 쓴 한 사람은 나누지 않는다.
const SPLIT = /\s*(?:[,，、·ㆍ/&+\n]|\s그리고\s)\s*|(?<=[가-힣A-Za-z0-9)])(?:와|과|하고|이랑|랑)\s+/u;
const keyOf = name => name.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ko-KR');

/** 페이지의 「함께한 사람」 칸에서 사람 이름을 나눈다(화면에서 미리 보여 줄 때도 쓴다). */
export function splitPeople(value) {
  if (typeof value !== 'string') return [];
  const seen = new Set(), names = [], parts = value.split(SPLIT);
  for (const [index, raw] of parts.entries()) {
    let name = raw.replace(/\s+/gu, ' ').trim();
    // '아빠랑 엄마랑'처럼 여러 사람을 적었을 때만 마지막 이름 끝의 이음말을 뗀다('김사랑' 한 사람은 그대로).
    if (parts.length > 1 && index === parts.length - 1) name = name.replace(/(?<=[가-힣A-Za-z0-9)])(?:이랑|랑|하고)$/u, '');
    if (!name || seen.has(keyOf(name))) continue;
    seen.add(keyOf(name)); names.push(name);
  }
  return names;
}

/**
 * 사람별 모아 보기. 반환: { people: [{ key, name, count, pages }], withoutPerson: [...] }
 * 이름은 처음 나온 표기를 쓰고, 같은 사람(NFKC·띄어쓰기·대소문자만 다른 표기)은 한데 묶는다.
 * 페이지가 많은 사람부터, 같으면 가나다순. 각 사람의 페이지는 날짜순(날짜 없는 페이지는 뒤).
 */
export function peopleIndex(album) {
  const people = new Map(), withoutPerson = [];
  for (const page of album?.pages ?? []) {
    const entry = { id: page.id, title: page.title, date: page.date || '', questionId: page.questionId ?? null };
    const names = splitPeople(page.person);
    if (!names.length) { withoutPerson.push(entry); continue; }
    for (const name of names) {
      const key = keyOf(name);
      if (!people.has(key)) people.set(key, { key, name, pages: [] });
      people.get(key).pages.push(entry);
    }
  }
  const datedFirst = (a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || byDate(a, b);
  const list = [...people.values()].map(person => ({ ...person, count: person.pages.length, pages: person.pages.sort(datedFirst) }));
  list.sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
  return { people: list, withoutPerson: withoutPerson.sort(datedFirst) };
}
