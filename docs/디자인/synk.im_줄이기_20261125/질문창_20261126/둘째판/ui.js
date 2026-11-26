/* 세 시안이 함께 쓰는 작은 도구 */
export const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
export const para = t => el('p', '', t);
/* 답의 행동 링크. 홈 안 주소(/#…)는 시안에서 그 자리를 보이고, 밖 주소는 새 창으로 연다 */
export function linkOut(action, cls, hooks) {
  const a = el('a', cls);
  a.append(el('span', '', action.label), el('span', 'arr', action.href.startsWith('/#') ? '→' : '↗'));
  if (action.href.startsWith('/#')) { a.href = '#'; a.addEventListener('click', e => { e.preventDefault(); hooks.home(action.href.slice(1)); }); }
  else { a.href = action.href; a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}
