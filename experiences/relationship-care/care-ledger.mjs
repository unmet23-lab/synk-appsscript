/**
 * 경조사 장부. 기존 「주고받은 기록」(activities)에서 경조금·선물·참석을 모아
 * 사람별·행사 종류별·연도별 합계를 낸다. 새 저장 목록을 만들지 않는다.
 * CSV 내보내기(엑셀용 BOM)와 가져오기 미리보기(이름 일치·동명이인 표시)를 제공하며,
 * 가져오기는 사용자가 고른 줄만 새 기록으로 더하고 기존 기록을 덮지 않는다.
 */
import { OCCASION_TYPES, importBackup, makePerson } from './model.mjs';
import { koreanDate } from './care-memorial.mjs';

export const CARE_LEDGER_VERSION = 'care-ledger-1';
export const LEDGER_FILE_LIMIT = 4 * 1024 * 1024;
export const LEDGER_ROW_LIMIT = 5000;
export const LEDGER_KIND_LABELS = Object.freeze({ money: '경조금', gift: '선물', attend: '참석', contact: '연락', remember: '조용히 기억' });
export const LEDGER_DIRECTION_LABELS = Object.freeze({ sent: '보냄', received: '받음' });
export const CSV_HEADER = Object.freeze(['날짜', '이름', '관계', '방향', '종류', '행사', '금액(원)', '물품', '참석', '메모']);
// 일정 종류 → 장부 행사 분류. 기록에 occasion이 있으면 그것을 먼저 쓴다.
const EVENT_OCCASION = Object.freeze({ wedding: 'wedding', condolence: 'funeral', memorial: 'memorial', birthday: 'birthday', anniversary: 'other' });
const won = value => `${value.toLocaleString('ko-KR')}원`;
const nameKey = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko');

/** 장부에 들어가는 기록: 경조금·선물·참석, 또는 금액이 적힌 기록. */
const inLedger = item => item.kind === 'money' || item.kind === 'gift' || item.kind === 'attend' || item.amountWon !== null;

function entryOf(item, person, event) {
  const occasion = item.occasion ?? (event ? EVENT_OCCASION[event.type] : null) ?? 'other';
  const attended = typeof item.attended === 'boolean' ? item.attended : item.kind === 'attend' ? true : null;
  return {
    id: item.id, personId: person.id, personName: person.name, relationship: person.relationship, deceased: person.deceased === true,
    date: item.occurredOn, year: Number(item.occurredOn.slice(0, 4)), direction: item.direction, directionLabel: LEDGER_DIRECTION_LABELS[item.direction],
    kind: item.kind, kindLabel: LEDGER_KIND_LABELS[item.kind], occasion, occasionLabel: OCCASION_TYPES[occasion],
    occasionSource: item.occasion ? 'record' : event ? 'event' : 'none',
    amountWon: item.amountWon, item: item.item ?? '', attended, note: item.note, eventId: item.eventId, eventTitle: event?.title ?? '',
  };
}

/** 장부 줄 목록(최근 날짜 먼저). filters: year·personId·occasion·direction */
export function ledgerEntries(state, { year = null, personId = null, occasion = null, direction = null } = {}) {
  if (year !== null && !Number.isInteger(year)) throw new Error('연도를 확인해 주세요.');
  if (occasion !== null && !Object.hasOwn(OCCASION_TYPES, occasion)) throw new Error('행사 종류를 확인해 주세요.');
  if (direction !== null && !Object.hasOwn(LEDGER_DIRECTION_LABELS, direction)) throw new Error('보냄·받음을 확인해 주세요.');
  const current = importBackup(state);
  const people = new Map(current.people.map(item => [item.id, item])), events = new Map(current.events.map(item => [item.id, item]));
  return current.activities.filter(inLedger).map(item => entryOf(item, people.get(item.personId), events.get(item.eventId)))
    .filter(entry => (year === null || entry.year === year) && (personId === null || entry.personId === personId)
      && (occasion === null || entry.occasion === occasion) && (direction === null || entry.direction === direction))
    .sort((a, b) => b.date.localeCompare(a.date) || a.personName.localeCompare(b.personName, 'ko') || a.id.localeCompare(b.id));
}

const emptySide = () => ({ totalWon: 0, moneyWon: 0, giftWon: 0, count: 0 });
function addTo(side, entry) {
  side.count++;
  if (entry.amountWon === null) return;
  side.totalWon += entry.amountWon;
  if (entry.kind === 'gift') side.giftWon += entry.amountWon; else side.moneyWon += entry.amountWon;
}
const brief = entry => entry ? { date: entry.date, amountWon: entry.amountWon, item: entry.item, kind: entry.kind, occasion: entry.occasion, occasionLabel: entry.occasionLabel } : null;

/**
 * 장부 요약. 합계(totalWon)는 경조금과 금액을 적은 선물을 더한 값이며, 금액 없는 선물·참석은 건수(count)에만 들어간다.
 * people: 사람별 보낸·받은 합계, 마지막 보낸·받은 것, 마지막 금액, 참석 횟수와 마지막 참석 여부.
 */
export function ledgerSummary(state, filters = {}) {
  const entries = ledgerEntries(state, filters);
  const totals = { sent: emptySide(), received: emptySide() };
  const people = new Map(), occasions = new Map(), years = new Map();
  for (const entry of [...entries].reverse()) { // 오래된 것부터 넣어 「마지막」이 최근 기록이 되게 한다.
    addTo(totals[entry.direction], entry);
    if (!people.has(entry.personId)) people.set(entry.personId, { personId: entry.personId, name: entry.personName, relationship: entry.relationship, deceased: entry.deceased,
      sent: emptySide(), received: emptySide(), lastSent: null, lastReceived: null, lastAmount: null, lastDate: '', attendance: { count: 0, last: null, lastDate: null } });
    const row = people.get(entry.personId);
    addTo(row[entry.direction], entry);
    if (entry.direction === 'sent') row.lastSent = brief(entry); else row.lastReceived = brief(entry);
    if (entry.amountWon !== null) row.lastAmount = { date: entry.date, direction: entry.direction, amountWon: entry.amountWon, label: `${LEDGER_DIRECTION_LABELS[entry.direction]} ${won(entry.amountWon)}` };
    if (entry.attended !== null && entry.direction === 'sent') { row.attendance.last = entry.attended; row.attendance.lastDate = entry.date; if (entry.attended) row.attendance.count++; }
    row.lastDate = entry.date;
    for (const [map, key, label] of [[occasions, entry.occasion, entry.occasionLabel], [years, entry.year, `${entry.year}년`]]) {
      if (!map.has(key)) map.set(key, { key, label, sent: emptySide(), received: emptySide() });
      addTo(map.get(key)[entry.direction], entry);
    }
  }
  const personRows = [...people.values()].map(row => ({ ...row, balanceWon: row.received.totalWon - row.sent.totalWon }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, 'ko'));
  return {
    version: CARE_LEDGER_VERSION, filters, entries,
    totals: { ...totals, balanceWon: totals.received.totalWon - totals.sent.totalWon },
    people: personRows,
    byOccasion: Object.keys(OCCASION_TYPES).filter(key => occasions.has(key)).map(key => occasions.get(key)),
    byYear: [...years.values()].sort((a, b) => b.key - a.key),
    years: [...years.keys()].sort((a, b) => b - a),
    note: '합계는 경조금과 금액을 적은 선물을 더한 값이에요. 금액 없는 선물·참석은 건수에만 들어가요.',
  };
}

/** 금액 도우미(care-amount)에 넘길 지난 기록. 한 사람의 마지막 받은·보낸 금액. */
export function amountContext(state, personId) {
  const entries = ledgerEntries(state, { personId }).filter(entry => entry.amountWon !== null);
  const lastReceived = entries.find(entry => entry.direction === 'received') ?? null, lastSent = entries.find(entry => entry.direction === 'sent') ?? null;
  return { personId, lastReceived: brief(lastReceived), lastSent: brief(lastSent),
    receivedWon: lastReceived?.amountWon ?? null, receivedOn: lastReceived?.date ?? null };
}

// ── CSV 내보내기 ─────────────────────────────────────────────
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // 엑셀에서 수식으로 실행되지 않게 글자 칸 앞의 = + - @ 탭을 막는다.
  if (typeof value === 'string' && /^[=+\-@\t\r]/u.test(text)) text = `'${text}`;
  return /[",\r\n]|^\s|\s$/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 엑셀에서 한글이 깨지지 않게 UTF-8 BOM과 CRLF로 만든다. 오래된 날짜부터. */
export function exportLedgerCsv(state, filters = {}) {
  const rows = ledgerEntries(state, filters).reverse().map(entry => [
    entry.date, entry.personName, entry.relationship, entry.directionLabel, entry.kindLabel, entry.occasionLabel,
    entry.amountWon ?? '', entry.item, entry.attended === null ? '' : entry.attended ? '참석' : '불참', entry.note,
  ]);
  return `﻿${[CSV_HEADER, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// ── CSV 가져오기 미리보기 ─────────────────────────────────────
function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false, endedQuote = false;
  const field = () => { row.push(cell); cell = ''; endedQuote = false; if (row.length > 50) throw new Error('CSV는 50개 이하의 열로 준비해 주세요.'); };
  const line = () => { field(); if (row.some(value => value.trim())) rows.push(row); row = []; if (rows.length > LEDGER_ROW_LIMIT + 1) throw new Error(`한 번에 최대 ${LEDGER_ROW_LIMIT.toLocaleString('ko-KR')}줄까지 가져올 수 있어요.`); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; endedQuote = true; }
      else cell += c;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; line(); }
    else if (c === '"' && !cell && !endedQuote) quoted = true;
    else { if (endedQuote || c === '"') throw new Error('CSV의 따옴표와 쉼표 구분을 확인해 주세요.'); cell += c; }
  }
  if (quoted) throw new Error('CSV의 닫히지 않은 따옴표를 확인해 주세요.');
  if (cell || row.length || endedQuote) line();
  return rows;
}
const headerKey = value => value.normalize('NFKC').trim().toLowerCase().replace(/[\s_\-()（）[\]]/gu, '');
const COLUMNS = Object.freeze({
  date: ['날짜', '일자', '일시', 'date'], name: ['이름', '성명', '상대', '상대방', '대상', 'name'], relationship: ['관계', 'relationship'],
  direction: ['방향', '구분', '주고받음', '보냄받음', '입출', 'direction'], kind: ['종류', '형태', '방법', 'kind'],
  occasion: ['행사', '경조사', '경조사종류', '행사종류', '내용', 'occasion'], amount: ['금액', '금액원', '액수', 'amount'],
  sentAmount: ['보낸금액', '낸금액', '나간금액', '지출', '보낸돈'], receivedAmount: ['받은금액', '들어온금액', '수입', '받은돈'],
  item: ['물품', '선물', '품목', 'item'], attended: ['참석', '참석여부', 'attended'], note: ['메모', '비고', 'note', 'memo'],
});
const OCCASION_WORDS = [
  ['first-birthday', /돌잔치|^돌$|첫\s*돌|돌\s*선물/u], ['milestone-birthday', /환갑|회갑|칠순|고희|팔순|산수|구순|진갑/u],
  ['wedding', /결혼|축의|웨딩|예식|혼사|청첩/u], ['funeral', /장례|조의|부고|조문|부의|상가|빈소|부친상|모친상|발인/u],
  ['opening', /개업|개원|창업|오픈/u], ['housewarming', /집들이|이사|입주/u], ['hospital', /병문안|입원|수술|문병/u],
  ['memorial', /기일|제사|추도|추모/u], ['holiday', /명절|설날|^설$|추석|세배/u], ['birthday', /생일|생신/u],
];
function parseOccasion(raw) {
  const text = raw.trim();
  if (!text) return null;
  const direct = Object.entries(OCCASION_TYPES).find(([key, label]) => key === text || label === text);
  if (direct) return direct[0];
  return OCCASION_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
}
function parseDirection(raw) {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (/^(?:보냄|보낸|냄|낸|나감|지출|줌|준|드림|sent|give|gave|out)/u.test(text)) return 'sent';
  if (/^(?:받음|받은|들어옴|수입|received|receive|in)/u.test(text)) return 'received';
  return undefined;
}
function parseKind(raw) {
  const text = raw.trim();
  if (!text) return null;
  if (/경조금|현금|돈|축의금|조의금|부조|부의금|money|cash/iu.test(text)) return 'money';
  if (/선물|물품|화환|화분|gift/iu.test(text)) return 'gift';
  if (/참석|attend/iu.test(text)) return 'attend';
  return undefined;
}
function parseAttended(raw) {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  if (/^(?:참석|o|○|예|네|yes|y|true|1|갔음|감)$/u.test(text)) return true;
  if (/^(?:불참|x|×|아니오|아니요|no|n|false|0|못\s*감|안\s*감)$/u.test(text)) return false;
  return undefined;
}
/** 「100,000」·「100000원」·「10만」·「10만 원」·「₩50,000」·「15만5천」 */
export function parseWon(raw) {
  const text = String(raw ?? '').normalize('NFKC').replace(/[\s,₩원]/gu, '');
  if (!text) return null;
  let value;
  if (/^\d+$/u.test(text)) value = Number(text);
  else {
    const match = text.match(/^(?:(\d+)억)?(?:(\d+)천만)?(?:(\d+)만)?(?:(\d+)천)?(\d+)?$/u);
    if (!match || match[0] === '') return undefined;
    const [, eok = 0, cheonman = 0, man = 0, cheon = 0, rest = 0] = match;
    value = Number(eok) * 100000000 + Number(cheonman) * 10000000 + Number(man) * 10000 + Number(cheon) * 1000 + Number(rest);
  }
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000000000 ? value : undefined;
}
/** 「2026-05-01」·「2026.5.1」·「2026/05/01」·「2026년 5월 1일」 */
export function parseLedgerDate(raw) {
  const text = String(raw ?? '').normalize('NFKC').trim();
  const match = text.match(/^(\d{4})\s*(?:[-./]|년)\s*(\d{1,2})\s*(?:[-./]|월)\s*(\d{1,2})\s*일?\.?$/u);
  if (!match) return null;
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date >= '1900-01-01' ? date : null;
}
const sameEntry = (a, b) => a.date === b.date && a.direction === b.direction && a.kind === b.kind && a.amountWon === b.amountWon && (a.item || '') === (b.item || '');

/**
 * CSV 글(파일을 UTF-8로 읽은 문자열)을 미리 본다. 저장하지 않는다.
 * rows[].match.status: one(한 사람과 일치) · many(동명이인, 골라야 함) · none(수첩에 없음)
 * rows[].duplicate: existing(이미 같은 기록이 있음) · file(파일 안에서 겹침) · null
 */
export function previewLedgerCsv(state, text, { now = new Date() } = {}) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > LEDGER_FILE_LIMIT) throw new Error('파일은 4 MB 이내로 준비해 주세요.');
  if (text.includes('�')) throw new Error('글자가 깨져 있어요. 엑셀에서 「CSV UTF-8」로 다시 저장해 주세요.');
  const current = importBackup(state), today = koreanDate(now);
  const parsed = csvRows(text.replace(/^﻿/u, ''));
  const headers = (parsed.shift() ?? []).map(headerKey);
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error('CSV에 같은 이름의 열이 있어요. 중복된 열을 정리해 주세요.');
  const column = Object.fromEntries(Object.entries(COLUMNS).map(([field, aliases]) => [field, headers.findIndex(value => aliases.map(headerKey).includes(value))]));
  if (column.name < 0 || column.date < 0) throw new Error('첫 줄에 「날짜」와 「이름」 열을 넣어 주세요.');
  if (column.amount < 0 && column.sentAmount < 0 && column.receivedAmount < 0 && column.item < 0 && column.attended < 0) throw new Error('「금액」·「물품」·「참석」 중 하나 이상의 열이 필요해요.');
  const byName = new Map();
  for (const person of current.people) { const key = nameKey(person.name); byName.set(key, [...(byName.get(key) ?? []), person]); }
  const existing = ledgerEntries(current);
  const seenInFile = [];
  const rows = parsed.map((cells, index) => {
    const cell = field => column[field] >= 0 ? String(cells[column[field]] ?? '').trim() : '';
    const errors = [];
    if (cells.slice(headers.length).some(value => value.trim())) errors.push('열 개수가 첫 줄보다 많아요. 쉼표와 따옴표를 확인해 주세요.');
    const name = cell('name').replace(/\s+/gu, ' ');
    if (!name) errors.push('이름이 비어 있어요.');
    else if (name.length > 80 || /[\x00-\x1f\x7f]/u.test(name)) errors.push('이름을 80자 이내로 확인해 주세요.');
    const date = parseLedgerDate(cell('date'));
    if (!date) errors.push('날짜를 2026-05-01처럼 적어 주세요.');
    else if (date > today) errors.push('오늘보다 뒤의 날짜는 장부에 넣을 수 없어요.');
    let amountWon = column.amount >= 0 ? parseWon(cell('amount')) : null;
    const sent = column.sentAmount >= 0 ? parseWon(cell('sentAmount')) : null, received = column.receivedAmount >= 0 ? parseWon(cell('receivedAmount')) : null;
    if ([amountWon, sent, received].includes(undefined)) errors.push('금액을 숫자로 확인해 주세요. 「100000」이나 「10만」처럼 적을 수 있어요.');
    let direction = parseDirection(cell('direction'));
    if (direction === undefined) { errors.push('방향은 「보냄」이나 「받음」으로 적어 주세요.'); direction = null; }
    if (sent && received) errors.push('한 줄에 보낸 금액과 받은 금액이 함께 있어요. 두 줄로 나눠 주세요.');
    else if (sent || received) {
      const inferred = sent ? 'sent' : 'received';
      if (direction && direction !== inferred) errors.push('방향과 금액 열이 서로 달라요.');
      direction = inferred; amountWon = sent || received;
    }
    if (!direction && !errors.length) errors.push('보냈는지 받았는지 「방향」 열에 적어 주세요.');
    const item = cell('item').slice(0, 120), note = cell('note').slice(0, 2000), relationship = cell('relationship').slice(0, 80);
    let attended = parseAttended(cell('attended'));
    if (attended === undefined) { errors.push('참석 칸은 「참석」이나 「불참」으로 적어 주세요.'); attended = null; }
    let kind = parseKind(cell('kind'));
    if (kind === undefined) { errors.push('종류는 「경조금」·「선물」·「참석」 중에서 적어 주세요.'); kind = null; }
    if (!kind) kind = amountWon !== null && amountWon !== undefined && !item ? 'money' : item ? 'gift' : attended ? 'attend' : null;
    if (!kind && !errors.length) errors.push('금액이나 물품, 참석 여부 중 하나를 적어 주세요.');
    const occasion = parseOccasion(cell('occasion'));
    const candidates = name ? byName.get(nameKey(name)) ?? [] : [];
    const narrowed = candidates.length > 1 && relationship ? candidates.filter(person => nameKey(person.relationship) === nameKey(relationship)) : candidates;
    const chosen = narrowed.length === 1 ? narrowed[0] : null;
    const match = { status: chosen ? 'one' : candidates.length > 1 ? 'many' : 'none', personId: chosen?.id ?? null,
      byRelationship: candidates.length > 1 && !!chosen,
      candidates: candidates.map(person => ({ personId: person.id, name: person.name, relationship: person.relationship, deceased: person.deceased === true })) };
    const record = { date, direction, kind, amountWon: amountWon ?? null, item };
    let duplicate = null;
    if (!errors.length) {
      if (chosen && existing.some(entry => entry.personId === chosen.id && sameEntry(entry, record))) duplicate = 'existing';
      else if (seenInFile.some(other => other.key === nameKey(name) && sameEntry(other, record))) duplicate = 'file';
      seenInFile.push({ key: nameKey(name), ...record });
    }
    return { index, line: index + 2, name, relationship, date, direction, kind, occasion, amountWon: amountWon ?? null, item, attended, note,
      match, duplicate, errors, ready: !errors.length && match.status === 'one' && !duplicate };
  });
  const count = predicate => rows.filter(predicate).length;
  return {
    version: CARE_LEDGER_VERSION, rows, columns: Object.fromEntries(Object.entries(column).filter(([, index]) => index >= 0).map(([field, index]) => [field, index])),
    counts: { total: rows.length, ready: count(row => row.ready), sameName: count(row => !row.errors.length && row.match.status === 'many'),
      newName: count(row => !row.errors.length && row.match.status === 'none'), duplicates: count(row => row.duplicate), errors: count(row => row.errors.length) },
    notes: ['아직 저장하지 않았어요. 고른 줄만 새 기록으로 더하고 기존 기록은 바꾸지 않아요.', '동명이인은 누구인지 골라 주세요. 수첩에 없는 이름은 새 사람으로 더할 수 있어요.'],
  };
}

/**
 * 고른 줄만 더한다. choices: [{ index, personId? , newPerson?: true, allowDuplicate?: true }]
 *  - personId: 수첩의 사람(동명이인 중 고른 사람 등) · newPerson: 이름·관계로 새 사람을 만든다(같은 이름·관계는 한 명으로 묶음)
 *  - 일치가 한 명(one)이면 personId를 생략해도 된다. 겹치는 줄은 allowDuplicate가 있어야 더한다.
 * 돌려주는 값: { state, added, createdPeople }
 */
export function applyLedgerImport(state, preview, choices, now = new Date()) {
  if (!preview || !Array.isArray(preview.rows)) throw new Error('먼저 CSV를 미리 봐 주세요.');
  if (!Array.isArray(choices) || !choices.length) throw new Error('더할 줄을 직접 골라 주세요.');
  const current = importBackup(state), at = new Date(now);
  if (!Number.isFinite(at.getTime())) throw new Error('기준 시간을 확인해 주세요.');
  const createdAt = at.toISOString(), today = koreanDate(at);
  const people = new Map(current.people.map(person => [person.id, person]));
  const existing = ledgerEntries(current), created = new Map(), activities = [], usedIndexes = new Set();
  const newId = prefix => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object' || Object.keys(choice).some(key => !['index', 'personId', 'newPerson', 'allowDuplicate'].includes(key))) throw new Error('고른 줄의 형식을 확인해 주세요.');
    const row = preview.rows[choice.index];
    if (!Number.isSafeInteger(choice.index) || !row || usedIndexes.has(choice.index)) throw new Error('고른 줄을 다시 확인해 주세요.');
    usedIndexes.add(choice.index);
    if (row.errors.length) throw new Error(`${row.line}번째 줄을 먼저 고쳐 주세요: ${row.errors[0]}`);
    if (row.date > today) throw new Error(`${row.line}번째 줄의 날짜가 오늘보다 뒤예요.`);
    let personId;
    if (choice.newPerson === true) {
      if (choice.personId) throw new Error(`${row.line}번째 줄은 새 사람과 기존 사람 중 하나만 골라 주세요.`);
      const key = `${nameKey(row.name)}\u0000${nameKey(row.relationship)}`;
      if (!created.has(key)) created.set(key, makePerson({ name: row.name, relationship: row.relationship }));
      personId = created.get(key).id;
    } else {
      personId = choice.personId ?? (row.match.status === 'one' ? row.match.personId : null);
      if (!personId) throw new Error(`${row.line}번째 줄의 「${row.name}」이 누구인지 골라 주세요.`);
      if (!people.has(personId)) throw new Error(`${row.line}번째 줄의 사람이 수첩에서 바뀌었어요. 다시 미리 봐 주세요.`);
    }
    const record = { date: row.date, direction: row.direction, kind: row.kind, amountWon: row.amountWon, item: row.item };
    const repeated = existing.some(entry => entry.personId === personId && sameEntry(entry, record))
      || activities.some(item => item.personId === personId && sameEntry({ date: item.occurredOn, direction: item.direction, kind: item.kind, amountWon: item.amountWon, item: item.item ?? '' }, record));
    if (repeated && choice.allowDuplicate !== true) throw new Error(`${row.line}번째 줄은 이미 같은 기록이 있어요. 그래도 더하려면 다시 확인해 주세요.`);
    activities.push({ id: newId('activity'), personId, eventId: '', kind: row.kind, occurredOn: row.date, amountWon: row.amountWon, direction: row.direction,
      note: row.note, createdAt, ...(row.occasion ? { occasion: row.occasion } : {}), ...(row.attended !== null ? { attended: row.attended } : {}), ...(row.item ? { item: row.item } : {}) });
  }
  const next = importBackup({ ...current, people: [...current.people, ...created.values()], activities: [...current.activities, ...activities] });
  return { state: next, added: activities.length, createdPeople: created.size };
}
