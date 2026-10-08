import { EVENT_TYPES, makeEvent, nextOccurrence } from './model.mjs';

const DAY = 86400000;
export const PEOPLE_GROUPS = Object.freeze({ family: '가족', friend: '친구', work: '직장·업무', other: '기타' });
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/gu, ' ').trim();
const pad = value => String(value).padStart(2, '0');
const dayNumber = value => Date.parse(`${value}T00:00:00Z`);
const moveDay = (value, count) => new Date(dayNumber(value) + count * DAY).toISOString().slice(0, 10);
function koreanDate(now = new Date()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('기준 날짜를 확인해 주세요.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function validSolarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2199-12-31';
}
function monthParts(value) {
  if (!/^\d{4}-\d{2}$/u.test(String(value))) throw new Error('달은 YYYY-MM 형식으로 입력해 주세요.');
  const [year, month] = value.split('-').map(Number);
  if (year < 1900 || year > 2199 || month < 1 || month > 12) throw new Error('1900~2199년 사이의 달을 골라 주세요.');
  return { year, month };
}

/** 직접 고른 분류만 사용한다. 관계 문구로 가족이나 친구를 자동 추정하지 않는다. */
export function filterPeople(people = [], { query = '', group = 'all' } = {}) {
  if (group !== 'all' && !Object.hasOwn(PEOPLE_GROUPS, group)) throw new Error('사람 분류를 확인해 주세요.');
  const words = normalize(query).split(' ').filter(Boolean);
  return people.filter(person => {
    const savedGroup = Object.hasOwn(PEOPLE_GROUPS, person.group) ? person.group : 'other';
    if (group !== 'all' && savedGroup !== group) return false;
    const memories = Array.isArray(person.memories) ? person.memories.map(item => typeof item === 'string' ? item : item?.text ?? item?.note ?? '').join(' ') : '';
    const haystack = normalize([person.name, person.relationship, person.notes, memories].join(' '));
    return words.every(word => haystack.includes(word));
  });
}

export function shiftMonth(month, delta) {
  const { year, month: index } = monthParts(month);
  if (!Number.isInteger(delta) || Math.abs(delta) > 3600) throw new Error('이동할 달을 확인해 주세요.');
  const target = new Date(Date.UTC(year, index - 1 + delta, 1)).toISOString().slice(0, 7);
  monthParts(target);
  return target;
}

function occurrencesBetween(state, start, end, now) {
  const current = koreanDate(now);
  const people = new Map((state.people ?? []).map(person => [person.id, person]));
  const done = new Set((state.completions ?? []).map(item => item.occurrenceId));
  const result = [];
  for (const input of state.events ?? []) {
    const person = people.get(input.personId);
    if (!person) continue;
    const event = makeEvent(input);
    let cursor = start;
    for (let attempts = 0; attempts < 5; attempts++) {
      const occurrence = nextOccurrence(event, `${cursor}T00:00:00+09:00`);
      if (!occurrence || occurrence.date > end) break;
      occurrence.daysUntil = Math.round((dayNumber(occurrence.date) - dayNumber(current)) / DAY);
      const completed = done.has(occurrence.occurrenceId);
      result.push({ event, person, occurrence, completed, status: completed ? 'completed' : occurrence.date < current ? 'overdue' : 'upcoming' });
      if (event.repeat !== 'yearly' || occurrence.date >= '2199-12-31') break;
      cursor = moveDay(occurrence.date, 1);
    }
  }
  return result.sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date) || a.event.time.localeCompare(b.event.time) || a.event.id.localeCompare(b.event.id));
}

/** 완료한 회차도 달력에 남긴다. 음력 회차는 기존 모델이 산출한 양력 날짜로 배치한다. */
export function monthCalendar(state, month = koreanDate().slice(0, 7), now = new Date()) {
  const { year, month: index } = monthParts(month);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
  const rows = occurrencesBetween(state, start, end, now);
  const first = moveDay(start, -new Date(`${start}T00:00:00Z`).getUTCDay());
  const current = koreanDate(now);
  const days = Array.from({ length: 42 }, (_, offset) => {
    const date = moveDay(first, offset);
    return { date, day: Number(date.slice(-2)), inMonth: date.startsWith(month), today: date === current, rows: rows.filter(row => row.occurrence.date === date) };
  });
  return { month, label: `${year}년 ${index}월`, days, rows };
}

/** 지난 1년 안의 미완료 회차. 이미 챙긴 날짜와 오늘의 일정은 제외한다. */
export function pastUnfinishedEvents(state, now = new Date(), { lookbackDays = 365 } = {}) {
  if (!Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > 366) throw new Error('지난 일정은 1~366일 범위로 살펴볼 수 있어요.');
  const current = koreanDate(now);
  const start = moveDay(current, -lookbackDays);
  if (current <= '1900-01-01') return [];
  return occurrencesBetween(state, start < '1900-01-01' ? '1900-01-01' : start, moveDay(current, -1), now)
    .filter(row => !row.completed)
    .sort((a, b) => b.occurrence.date.localeCompare(a.occurrence.date) || a.event.id.localeCompare(b.event.id))
    .map(row => ({ ...row, daysAgo: -row.occurrence.daysUntil }));
}

const TYPE_WORDS = [
  { type: 'condolence', pattern: /부고|별세|장례|조문|발인/gu },
  { type: 'memorial', pattern: /기일|제사|추모/gu },
  { type: 'birthday', pattern: /생일|생신/gu },
  { type: 'wedding', pattern: /결혼|예식|청첩|웨딩/gu },
  { type: 'anniversary', pattern: /기념일|주년/gu },
];
function typeNear(text, offset) {
  const words = TYPE_WORDS.flatMap(item => [...text.matchAll(item.pattern)].map(match => ({ type: item.type, at: match.index, distance: Math.abs(match.index - offset) })));
  return words.sort((a, b) => a.distance - b.distance || b.at - a.at)[0]?.type ?? 'anniversary';
}
function readTime(text) {
  const match = text.match(/(?:(오전|오후|아침|저녁|밤|낮)\s*)?(\d{1,2})\s*(?::\s*(\d{1,2})|시(?:\s*(?:(\d{1,2})\s*분|(반)))?)/u);
  if (!match) return { time: '', caution: '' };
  const [raw, period, hour, minuteColon, minuteKorean, half] = match;
  let h = Number(hour); const m = Number(minuteColon ?? minuteKorean ?? (half ? 30 : 0));
  if (h > 23 || m > 59 || (period && (h < 1 || h > 12))) return { time: '', caution: `시간 표현 “${raw}”을 직접 확인해 주세요.` };
  if (period && ['오후', '저녁', '밤', '낮'].includes(period)) h = h === 12 ? 12 : h + 12;
  if (period && ['오전', '아침'].includes(period)) h = h === 12 ? 0 : h;
  return { time: `${pad(h)}:${pad(m)}`, caution: !period && h >= 1 && h <= 12 ? `오전·오후가 없는 “${raw}”은 ${pad(h)}시로 표시했어요. 시간을 확인해 주세요.` : '' };
}
function readLocation(text) {
  const explicit = text.match(/(?:장소|위치|예식장|빈소)\s*[:：]\s*([^\n]+)/u);
  if (explicit) return explicit[1].trim().slice(0, 300);
  const nearVenue = text.match(/(?:^|\s)([가-힣A-Za-z0-9· -]{2,45}(?:웨딩홀|장례식장|예식장|회관|호텔)(?:\s*\d+층)?(?:\s*[가-힣A-Za-z0-9]+홀)?)/u);
  return nearVenue?.[1]?.trim() ?? '';
}
function dateMentions(text, current) {
  const mentions = [];
  const taken = [];
  const add = (match, date, caution = '') => { mentions.push({ date, raw: match[0], index: match.index, caution }); taken.push([match.index, match.index + match[0].length]); };
  for (const match of text.matchAll(/(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})|(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/gu)) {
    const year = match[1] ?? match[4] ?? current.slice(0, 4);
    const month = match[2] ?? match[5]; const day = match[3] ?? match[6];
    add(match, `${year}-${pad(month)}-${pad(day)}`, !match[1] && !match[4] ? `연도가 없어 ${year}년으로 표시했어요. 날짜를 확인해 주세요.` : '');
  }
  for (const match of text.matchAll(/(?:이번\s*주|다음\s*주)\s*[월화수목금토일]요일|오늘|내일|모레/gu)) {
    if (taken.some(([start, end]) => match.index >= start && match.index < end)) continue;
    let date;
    if (['오늘', '내일', '모레'].includes(match[0])) date = moveDay(current, { 오늘: 0, 내일: 1, 모레: 2 }[match[0]]);
    else {
      const currentWeekday = new Date(`${current}T00:00:00Z`).getUTCDay();
      const monday = moveDay(current, -((currentWeekday + 6) % 7));
      const target = '월화수목금토일'.indexOf(match[0].match(/([월화수목금토일])요일/u)[1]);
      date = moveDay(monday, target + (/다음/u.test(match[0]) ? 7 : 0));
    }
    add(match, date, `“${match[0]}”은 오늘(${current}) 기준으로 풀었어요. 원문을 받은 날짜가 다르면 고쳐 주세요.`);
  }
  return mentions.sort((a, b) => a.index - b.index);
}

/** 문장에 드러난 날짜·종류·선호를 후보로만 정리한다. 모든 후보는 원문과 함께 사람이 확인한다. */
export function captureCandidates(text, { person = null, now = new Date() } = {}) {
  if (typeof text !== 'string' || text.length > 50000) throw new Error('가져올 대화는 5만 자 이내의 글로 입력해 주세요.');
  const source = text.trim();
  if (!source) return { events: [], memories: [], warnings: ['먼저 대화나 안내 문자를 붙여넣어 주세요.'] };
  const current = koreanDate(now);
  const events = [], memories = [], warnings = [];
  const blocks = source.split(/\n\s*\n/u).map(block => block.trim()).filter(Boolean);
  for (const block of blocks) {
    const mentions = dateMentions(block, current);
    const location = readLocation(block);
    for (const mention of mentions) {
      const start = block.lastIndexOf('\n', mention.index) + 1;
      const next = block.indexOf('\n', mention.index);
      const line = block.slice(start, next < 0 ? block.length : next).trim();
      const type = typeNear(block, mention.index);
      const lunarLeapMonth = /윤달|윤\s*\d{1,2}\s*월/u.test(line) || (mentions.length === 1 && /윤달|윤\s*\d{1,2}\s*월/u.test(block));
      const calendar = lunarLeapMonth || /음력/u.test(line) || (/음력/u.test(block) && !/양력/u.test(block)) ? 'lunar' : 'solar';
      const cautions = [mention.caution].filter(Boolean);
      if (calendar === 'solar' && !validSolarDate(mention.date)) { warnings.push(`“${mention.raw}”은 실제 날짜인지 확인해 주세요. 일정 후보에서 뺐어요.`); continue; }
      if (calendar === 'lunar') cautions.push('음력 표현을 찾았어요. 윤달과 실제 음력 날짜를 저장 전에 확인해 주세요.');
      const time = readTime(mentions.length === 1 ? block : line);
      if (time.caution) cautions.push(time.caution);
      if (mentions.length > 1) cautions.push('날짜가 여러 개 있어요. 이 날짜의 행사 종류·시간·장소를 원문과 대조해 주세요.');
      if (type === 'anniversary' && !/기념일|주년/u.test(block)) cautions.push('행사 종류가 명확하지 않아 기념일로 표시했어요. 종류를 직접 골라 주세요.');
      const title = `${person?.name ? `${person.name} ` : ''}${EVENT_TYPES[type]}`;
      const quoteStart = Math.max(0, mention.index - 1500);
      events.push({ personId: person?.id ?? '', type, title, date: mention.date, time: time.time, location, calendar, lunarLeapMonth, sourceQuote: block.slice(quoteStart, quoteStart + 4000), cautions });
    }
    for (const line of block.split(/\n|(?<=[.!?。！？])\s+/u).map(value => value.trim()).filter(Boolean)) {
      if (/(?:답장|연락).{0,25}(?:안\s*해도|하지\s*않아도|괜찮|부담|천천히)|(?:나이|이모지|존댓말|반말).{0,25}(?:말아|말고|싫|좋|편|빼|넣|써|쓰지)|(?:좋아해|좋아하|싫어해|싫어하|불편해|부르지\s*말|불러\s*줘|불러줘)/u.test(line)) {
        memories.push({ text: line.slice(0, 1000), kind: 'preference', sourceQuote: line.slice(0, 4000) });
      } else if (/(?:기억해|기억할|잊지\s*말|함께\s*갔|같이\s*갔|함께\s*했던|좋아하는\s*것)/u.test(line)) {
        memories.push({ text: line.slice(0, 1000), kind: 'memory', sourceQuote: line.slice(0, 4000) });
      }
    }
  }
  const uniqueEvents = events.filter((item, index) => events.findIndex(other => other.type === item.type && other.date === item.date && other.time === item.time && other.calendar === item.calendar) === index);
  const uniqueMemories = memories.filter((item, index) => memories.findIndex(other => other.text === item.text) === index);
  if (!uniqueEvents.length && !uniqueMemories.length && !warnings.length) warnings.push('날짜나 명시적인 선호 표현을 찾지 못했어요. 직접 기억을 추가하거나 날짜를 적어 다시 정리해 주세요.');
  return { events: uniqueEvents.slice(0, 40), memories: uniqueMemories.slice(0, 40), warnings: [...new Set(warnings)] };
}
