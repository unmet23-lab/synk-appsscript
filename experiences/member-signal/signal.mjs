// SYNK FOR YOU 회원 혜택 앱 공통 화면 도우미 (2026-10-14).
// 모양은 signal.css가 정하고, 여기에는 여러 앱이 같은 방식으로 쓰는 작은 동작만 둔다.
// 상태·저장·계정은 각 앱이 맡는다.

export const THEME_KEY = 'synk.platform.theme';
const THEMES = new Set(['night', 'day', 'system']);

/** 웹 플랫폼에서 고른 밤·낮·기기 설정을 따른다. 저장소를 못 읽으면 밤. */
export function initTheme(root = globalThis.document?.documentElement, storage = globalThis.localStorage) {
  let value = 'night';
  try { const saved = storage?.getItem(THEME_KEY); if (THEMES.has(saved)) value = saved; } catch { /* 밤으로 둔다 */ }
  if (root) root.dataset.theme = value === 'night' ? 'night' : value;
  return value;
}

/** 밤 → 낮 → 기기 설정 차례로 바꾸고 이 기기에 남긴다. */
export function cycleTheme(root = globalThis.document?.documentElement, storage = globalThis.localStorage) {
  const order = ['night', 'day', 'system'];
  const next = order[(order.indexOf(root?.dataset.theme || 'night') + 1) % order.length];
  if (root) root.dataset.theme = next;
  try { storage?.setItem(THEME_KEY, next); } catch { /* 이번 화면에만 */ }
  return next;
}
export const THEME_LABEL = Object.freeze({ night: '밤 화면', day: '낮 화면', system: '기기 설정' });

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** 「·」으로 이은 덩어리가 줄바꿈으로 갈리지 않게 묶는다(keep-all은 「·」 앞뒤를 지키지 않는다). 입력은 이스케이프한다. */
export function keepDots(text) {
  return esc(text).replace(/[^\s·]+(?:·[^\s·]+)+/gu, chunk => `<span class="nw">${chunk}</span>`);
}

/** 포스터 한 장. word는 아주 큰 한글, art는 펠트 물건 누끼 주소. */
export function poster({ word = '', art = '', alt = '', label = '', chip = '', chipTone = '', sticker = '', size = '', extra = '' } = {}) {
  const len = Math.max(1, Math.min(5, [...word].length || 1));
  return `<div class="poster${size ? ` ${size}` : ''}" data-word="${esc(word)}" data-len="${len}">${label ? `<span class="label">${esc(label)}</span>` : ''}${chip ? `<span class="led-chip${chipTone ? ` ${chipTone}` : ''}">${esc(chip)}</span>` : ''}${sticker ? `<span class="sticker">${esc(sticker)}</span>` : ''}${art ? `<img class="cut" src="${esc(art)}" alt="${esc(alt)}" width="720" height="720" decoding="async">` : ''}${extra}</div>`;
}

/** 「01 · 제목」 구역 머리 */
export function secHead(number, title, side = '') {
  return `<div class="sec-head"><span class="n" aria-hidden="true">${String(number).padStart(2, '0')}</span><h2>${esc(title)}</h2>${side ? `<span class="side">${side}</span>` : ''}</div>`;
}

/** 기운 다섯 칸(숫자 대신). value 1~5 */
export function level(value, label = '') {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return `<span class="level" role="img" aria-label="${esc(label || `다섯 칸 중 ${n}칸`)}">${Array.from({ length: 5 }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
}

const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2M7 14h10v6H7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.3 3.6-5 6.5-5s5.5 1.7 6.5 5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c1.7.6 3 2.1 3.5 4.7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M20.5 16l-5-5-9 8.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3.5-5.5-3.5-5.5-1S10 8 12 8zM12 8c1.5-3.5 5.5-3.5 5.5-1S14 8 12 8z"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};
export function icon(name, label = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}>${ICONS[name] || ''}</svg>`;
}

/** 아래 가운데 알림. 화면 읽기 프로그램에도 읽힌다. */
export function createToast(element) {
  let timer;
  return text => { clearTimeout(timer); element.textContent = text; timer = setTimeout(() => { element.textContent = ''; }, 6000); };
}

/** 판(시트) 열기·닫기. Esc·바탕 누르기로 닫고, 닫으면 연 단추로 초점을 돌려준다. */
export function createSheet(sheet, { onClose = () => {} } = {}) {
  let opener = null;
  const panel = sheet.querySelector('.sheet-panel');
  const close = () => { if (sheet.hidden) return; sheet.hidden = true; document.body.style.removeProperty('overflow'); onClose(); opener?.focus?.(); opener = null; };
  sheet.addEventListener('click', event => { if (event.target.closest('[data-sheet-close]') || event.target.classList.contains('sheet-backdrop')) close(); });
  sheet.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(node => !node.disabled && !node.closest('[hidden]') && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  return {
    open(from = document.activeElement) { opener = from; sheet.hidden = false; document.body.style.setProperty('overflow', 'hidden'); panel.focus(); },
    close,
    get open_() { return !sheet.hidden; },
  };
}

/** 한국 날짜(YYYY-MM-DD). 운세·플레저의 날짜 경계와 같은 기준. */
export function seoulDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 「10월 14일 (화)」, 올해가 아니면 연도를 붙인다. */
export function dayLabel(isoDate, { weekday = true, today = seoulDate() } = {}) {
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${String(today).slice(0, 4) === String(y) ? '' : `${y}년 `}${m}월 ${d}일${weekday ? ` (${w})` : ''}`;
}
/** 「10월 13일 오전 8:54」 */
export function stampLabel(iso, now = new Date()) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(date).map(p => [p.type, p.value]));
  const thisYear = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now);
  return `${parts.year === thisYear ? '' : `${parts.year}년 `}${parts.month}월 ${parts.day}일 ${parts.dayPeriod} ${parts.hour}:${parts.minute}`;
}
