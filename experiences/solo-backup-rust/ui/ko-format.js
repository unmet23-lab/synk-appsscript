// 날짜 · 시각 · 크기 · 개수 표기. 화면에 나오는 값은 모두 여기서 실제 값으로 셈한다(시안 README 5절 — 마감일은 T + 29일, 요일은 날짜에서).
// 시각은 「오후 2:02」 꼴(시안 A · Fable F14), 날짜는 「11월 10일 화」 꼴이다.

const DAY = 86400000;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 문자열 · 숫자 · Date를 받아 밀리초로. 읽을 수 없으면 null. */
export function ms(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value) { const t = Date.parse(value); return Number.isFinite(t) ? t : null; }
  return null;
}

/** 오전 9:05 · 오후 2:02 · 오전 12:30(자정 뒤) · 오후 12:10(정오 뒤) */
export function timeKo(value) {
  const t = ms(value); if (t === null) return '';
  const d = new Date(t), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

/** 11월 10일 화 */
export function dayKo(value) {
  const t = ms(value); if (t === null) return '';
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}`;
}

/** 11월 10일(화) — 문장 안에 넣을 때 */
export function dayParen(value) {
  return dayKo(value).replace(/ ([일월화수목금토])$/, '($1)');
}

function localDay(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

/** 같은 날이면 「오늘」, 하루 전이면 「어제」, 아니면 「11월 10일 화」 */
export function dayWord(value, now = Date.now()) {
  const t = ms(value); if (t === null) return '';
  const diff = Math.round((localDay(now) - localDay(t)) / DAY);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  return dayKo(t);
}

/** 오늘이면 시각만, 아니면 「어제 오후 6:02」 · 「11월 10일 화 오후 6:02」 */
export function whenKo(value, now = Date.now()) {
  const t = ms(value); if (t === null) return '';
  const w = dayWord(t, now);
  return w === '오늘' ? timeKo(t) : `${w} ${timeKo(t)}`;
}

/** 「오후 3:02 무렵」 · 정각이면 「오전 11시 무렵」. 앞날(다음 확인)은 지금보다 이르게 쓰지 않는다 */
export function aroundKo(value, now = Date.now()) {
  const t0 = ms(value); if (t0 === null) return '';
  const t = t0 > now - 60000 ? Math.max(t0, now) : t0, d = new Date(t);
  const w = whenKo(t, now);
  return `${d.getMinutes() === 0 ? w.replace(/(\d+):00$/, '$1시') : w} 무렵`;
}

/** 지난 시간 — 「3시간」 · 「2일」 */
export function agoKo(value, now = Date.now()) {
  const t = ms(value); if (t === null) return '';
  const h = Math.max(0, Math.floor((now - t) / 3600000));
  if (h < 1) return `${Math.max(1, Math.floor((now - t) / 60000))}분`;
  if (h < 48) return `${h}시간`;
  return `${Math.floor(h / 24)}일`;
}

/** 숨긴 지 30일에 지우므로 되돌릴 수 있는 끝은 T + 29일(설계 4.4-7) */
export function undoDeadline(value) {
  const t = ms(value); return t === null ? null : t + 29 * DAY;
}

/** 남은 날(올림 없이 내림) */
export function daysLeft(until, now = Date.now()) {
  const t = ms(until); if (t === null) return null;
  return Math.max(0, Math.floor((t - now) / DAY));
}

/** 12,480 */
export function count(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('ko-KR') : '';
}

/** 탐색기와 같은 1024 단위 — 18.4GB · 860MB · 4KB */
export function size(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  if (i === 0) return `${Math.round(v)}B`;
  const shown = v < 100 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
  return `${shown}${units[i]}`;
}

/** 받침 따라 조사 고르기(시안 copy.mjs와 같은 규칙). josa('Outlook', '이/가') → 'Outlook이' */
export function josa(word, pair) {
  const [a, b] = pair.split('/');
  const c = String(word).trim().slice(-1);
  const code = c.charCodeAt(0);
  let batchim, rieul = false;
  if (code >= 0xac00 && code <= 0xd7a3) { batchim = (code - 0xac00) % 28 !== 0; rieul = (code - 0xac00) % 28 === 8; }
  else if (/[0-9]/.test(c)) { batchim = '013678'.includes(c); rieul = '178'.includes(c); }
  else {
    // 대문자 약어(PC · HP · IBM)는 글자 이름으로 읽는다 — 받침은 엘 · 엠 · 엔 · 알뿐이다(「거실 PC를」 · 「IBM을」). 낱말(Outlook · Dell)은 끝소리로
    const run = (String(word).trim().match(/[A-Za-z]+$/) || [''])[0];
    if (run && run.length <= 4 && run === run.toUpperCase()) { batchim = /[LMNR]$/.test(run); rieul = /[LR]$/.test(run); }
    else { batchim = /[bcdgjklmnpqrtvxz]$/i.test(c) && !/[aeiouy]$/i.test(c); rieul = /l$/i.test(c); }
  }
  // 「으로/로」는 ㄹ 받침 뒤에서도 「로」다(사무실로 · 1로 · Dell로)
  if (a === '으로' && rieul) return word + b;
  return word + (batchim ? a : b);
}

/** 한국어로 셀 때의 숫자 말(폴더 「네 곳」) — 열까지만, 넘으면 숫자 */
export function placesKo(n) {
  const w = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][n];
  return w ? `${w} 곳` : `${count(n)}곳`;
}

/** 경로의 마지막 이름(「C:\Users\a\Documents」 → 「Documents」) */
export function baseName(p) {
  const s = String(p || '').replace(/[\\/]+$/, '');
  const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  return i >= 0 ? s.slice(i + 1) || s : s;
}
