import { importBackup, makePerson } from './model.mjs';

export const CONTACT_FILE_LIMIT = 4 * 1024 * 1024;
const nameKey = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko');
const headerKey = value => value.normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g, '');
const GROUPS = { family: 'family', 가족: 'family', friend: 'friend', 친구: 'friend', work: 'work', 업무: 'work', 직장: 'work', other: 'other', 기타: 'other' };

function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false, endedQuote = false;
  const field = () => { row.push(cell); cell = ''; endedQuote = false; if (row.length > 100) throw Error('CSV는 100개 이하의 열로 준비해 주세요.'); };
  const line = () => { field(); if (row.some(value => value.trim())) rows.push(row); row = []; if (rows.length > 1001) throw Error('한 번에 최대 1,000명의 이름을 가져올 수 있어요.'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; endedQuote = true; }
      else cell += c;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; line(); }
    else if (c === '"' && !cell && !endedQuote) quoted = true;
    else { if (endedQuote || c === '"') throw Error('CSV의 따옴표와 쉼표 구분을 확인해 주세요.'); cell += c; }
  }
  if (quoted) throw Error('CSV의 닫히지 않은 따옴표를 확인해 주세요.');
  if (cell || row.length || endedQuote) line();
  return rows;
}

/** Read only the minimum contact fields. Phone numbers, emails and source notes never enter the result. */
export function parseContactFile(text, filename = '') {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > CONTACT_FILE_LIMIT) throw Error('파일은 4 MB 이내로 준비해 주세요.');
  text = text.replace(/^\uFEFF/, '');
  let rows;
  if (/\.json$/i.test(filename)) rows = importBackup(text).people.map(({ name, relationship, group }) => ({ name, relationship, group }));
  else if (/\.csv$/i.test(filename)) {
    const parsed = csvRows(text), headers = parsed.shift()?.map(headerKey) || [];
    const column = aliases => headers.findIndex(value => aliases.includes(value));
    const name = column(['name', 'fullname', 'displayname', '이름', '성명']);
    const first = column(['firstname', 'givenname']), middle = column(['middlename']), last = column(['lastname', 'familyname']);
    const relation = column(['relationship', '관계', '회사', 'organizationname', 'organization1name']), group = column(['group', '분류']);
    if (name < 0 && first < 0 && last < 0) throw Error('첫 줄에 이름 또는 Name 열을 넣어 주세요. First Name·Last Name 열도 사용할 수 있어요.');
    if (new Set(headers).size !== headers.length) throw Error('CSV에 같은 이름의 열이 있어요. 중복된 열을 정리해 주세요.');
    rows = parsed.map(row => {
      if (row.length > headers.length) throw Error('CSV의 열 개수가 첫 줄과 달라요. 쉼표와 따옴표를 확인해 주세요.');
      return { name: name >= 0 ? row[name] || '' : [first, middle, last].filter(i => i >= 0).map(i => row[i] || '').filter(Boolean).join(' '), relationship: relation >= 0 ? row[relation] || '' : '', group: GROUPS[(group >= 0 ? row[group] || '' : '').trim().toLowerCase()] || 'other' };
    });
  } else throw Error('이름이 담긴 UTF-8 CSV 또는 플레저 JSON 백업 파일을 선택해 주세요.');
  const contacts = []; let skipped = 0;
  for (const row of rows) {
    if (!row.name?.trim()) { skipped++; continue; }
    if (/[\x00-\x1f\x7f\uFFFD]/.test(row.name + row.relationship)) throw Error('이름·관계의 줄바꿈이나 깨진 글자를 확인해 주세요. CSV는 UTF-8로 저장해 주세요.');
    const person = makePerson({ name: row.name, relationship: row.relationship, group: row.group });
    contacts.push({ name: person.name, relationship: person.relationship, group: person.group });
  }
  if (!contacts.length) throw Error('가져올 이름을 찾지 못했어요. 이름 열에 한 명 이상 입력해 주세요.');
  return { contacts, skipped };
}

export function previewContacts(state, contacts) {
  const existing = new Set(state.people.map(person => nameKey(person.name))), seen = new Set();
  return contacts.map((contact, index) => {
    const key = nameKey(contact.name), duplicate = existing.has(key) ? 'existing' : seen.has(key) ? 'file' : null;
    seen.add(key); return { ...contact, index, duplicate };
  });
}

/** Selection is mandatory; create fresh person IDs and preserve every existing record. */
export function addSelectedContacts(state, contacts, selected) {
  if (!Array.isArray(selected) || !selected.length || selected.some(index => !Number.isSafeInteger(index) || index < 0 || index >= contacts.length)) throw Error('추가할 사람을 직접 선택해 주세요.');
  const wanted = new Set(selected), planned = previewContacts(state, contacts);
  const additions = planned.filter(item => wanted.has(item.index) && !item.duplicate).map(({ name, relationship, group }) => makePerson({ name, relationship, group }));
  if (state.people.length + additions.length > 1000) throw Error('수첩에는 최대 1,000명을 보관할 수 있어요. 추가할 사람 수를 줄여 주세요.');
  const next = importBackup({ ...state, people: [...state.people, ...additions] });
  return { state: next, added: additions.length, skipped: wanted.size - additions.length };
}
