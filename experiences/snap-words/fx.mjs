// 찰칵 낱말 — 움직임(설계 7절). 값은 주문 폭주 2판의 토큰 여섯(Material 3 Expressive 공식 웹 변환표)과 같다.
// 튐은 위치 · 크기에만, 색 · 투명도는 튀기지 않는다. 기기 「동작 줄이기」나 WORLD 「움직임 줄이기」에서는 공간 이동을 하지 않고 효과(150ms)만 남긴다.
export const M = Object.freeze({
  fast: { duration: 350, easing: 'cubic-bezier(.42,1.67,.21,.90)' },
  base: { duration: 500, easing: 'cubic-bezier(.38,1.21,.22,1)' },
  slow: { duration: 650, easing: 'cubic-bezier(.39,1.29,.35,.98)' },
  efast: { duration: 150, easing: 'cubic-bezier(.31,.94,.34,1)' },
  ebase: { duration: 200, easing: 'cubic-bezier(.34,.80,.34,1)' },
  eslow: { duration: 300, easing: 'cubic-bezier(.34,.88,.34,1)' },
});

export function motionOn() {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch { /* 없는 환경 */ }
  for (const doc of [document, (() => { try { return window.parent?.document; } catch { return null; } })()]) {
    if (doc?.documentElement?.dataset?.motion === 'reduced') return false;
  }
  return true;
}
// 끝난 WAAPI를 요소에 남기지 않는다(합성기로 못 가는 까닭 — 주문 폭주 11-03 추적).
const animate = (el, frames, opts) => {
  if (!el || typeof el.animate !== 'function') return null;
  const a = el.animate(frames, { fill: 'backwards', ...opts });
  const fill = a.effect?.getTiming?.().fill;
  if (fill !== 'forwards' && fill !== 'both') a.finished.then(() => a.cancel(), () => {});
  return a;
};
export function spatial(el, frames, token = M.base, opts = {}) {
  if (!el) return null;
  if (!motionOn()) {
    const fade = frames.some((f) => 'opacity' in f) ? frames.map((f) => ({ opacity: f.opacity ?? 1 })) : null;
    return fade ? animate(el, fade, { ...M.efast, ...opts }) : null;
  }
  return animate(el, frames, { ...token, ...opts });
}
export const effect = (el, frames, token = M.ebase, opts = {}) => animate(el, frames, { ...(motionOn() ? token : M.efast), ...opts });
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const finished = (a) => (a?.finished ? a.finished.catch(() => {}) : Promise.resolve());

/** 인화지 날아들기: 지금 자리에서 to(화면 사각형) 가운데로 포물선 450ms, 작아지며 들어간다. */
export function flyTo(el, to, { lift = 110, duration = 450, end = 0.16 } = {}) {
  const from = el.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  if (!motionOn()) return Promise.resolve();
  const frames = [];
  for (let i = 0; i <= 12; i += 1) {
    const p = i / 12, e = 1 - (1 - p) ** 2;
    frames.push({ transform: `translate(${dx * e}px,${dy * p - lift * 4 * p * (1 - p) * 0.5}px) scale(${1 + (end - 1) * e}) rotate(${(1 - e) * -3}deg)` });
  }
  return finished(el.animate(frames, { duration, easing: 'linear', fill: 'forwards' }));
}

/** 숫자 굴리기(자리마다). 글은 target 안에 그대로 두고 그림 층만 굴린다 — 읽기 프로그램이 끝 값을 읽는다. */
export function rollTo(target, to) {
  const text = String(to), prev = target.dataset.shown ?? '';
  target.dataset.shown = text;
  if (!motionOn() || prev === text) { target.textContent = text; return; }
  target.replaceChildren(...[...text].map((ch, i) => {
    const slot = document.createElement('span'); slot.className = 'roll-slot'; slot.setAttribute('aria-hidden', 'true');
    if (!/\d/.test(ch)) { slot.textContent = ch; return slot; }
    const strip = document.createElement('span'); strip.className = 'roll-strip'; strip.textContent = '0123456789';
    strip.style.setProperty('--d', ch);
    slot.append(strip);
    const before = prev[i - (text.length - prev.length)];
    if (before !== ch) strip.animate([{ transform: `translateY(${-(/\d/.test(before || '') ? Number(before) : 0)}em)` }, { transform: `translateY(${-Number(ch)}em)` }], { ...M.base, delay: i * 40, fill: 'backwards' });
    return slot;
  }));
  const read = document.createElement('span'); read.className = 'vh'; read.textContent = text; target.prepend(read);
}
export const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
