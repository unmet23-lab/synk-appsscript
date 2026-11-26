/* 세 시안이 함께 쓰는 작은 도구 */
export const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
export const para = t => el('p', '', t);
/* 답이 낱말 단위로 차례로 나타난다(한 번, 1초 안). 움직임을 줄인 설정이면 바로 보인다 */
export function words(node, text, step = 16, max = 700) {
  node.replaceChildren();
  String(text).split(/(\s+)/).forEach((w, i) => {
    if (/^\s+$/.test(w)) { node.append(w); return; }
    const s = el('span', 'w', w); s.style.animationDelay = Math.min(i * step / 2, max) + 'ms'; node.append(s);
  });
}
/* 답의 행동 링크. 홈 안 주소(/#…)는 창을 닫고, 밖 주소는 새 창으로 연다 */
export function linkOut(action, cls, hooks) {
  const a = el('a', cls);
  a.append(el('span', '', action.label), el('span', 'arr', action.href.startsWith('/#') ? '→' : '↗'));
  if (action.href.startsWith('/#')) { a.href = '#'; a.addEventListener('click', e => { e.preventDefault(); hooks.home(action.href.slice(1)); }); }
  else { a.href = action.href; a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}
export const svg = {
  x: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mag: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  arr: '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M1 6h9M6.5 2.5L10 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 3.2A1.5 1.5 0 0 0 9 2H4a2 2 0 0 0-2 2v5a1.5 1.5 0 0 0 1.2 1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
};
export const icon = k => { const s = el('span', 'ic'); s.innerHTML = svg[k]; return s; };
/* 사업 색: 흰 바탕용과 검정 바탕용 */
/* 꼬리표와 출처 줄에 쓰는 이름: 처음 온 사람이 아는 말로 */
export const KIND = { path: '한국 유학', lab: '한국어 공부', shift: 'AI 강의', pulse: '광고 제작', company: '회사 소개', vision: '회사 소개', philosophy: '회사 소개', guide: '이용 안내' };
export const FROM = id => `${KIND[id] || '이용 안내'} 안내에서 찾았어요`;
export const DOT_LIGHT = { company: '#f96859', path: '#7f9bd2', lab: '#8fa255', shift: '#141414', pulse: '#4d5661', vision: '#22304d', philosophy: '#b89a5e', guide: '#a89676' };
export const DOT_DARK = { company: '#f96859', path: '#c5d3ed', lab: '#a8b86f', shift: '#f4ead9', pulse: '#aab4c0', vision: '#8ea0c8', philosophy: '#d6c095', guide: '#cdbfa6' };
