// 입장 검사 — WORLD 캠퍼스 판의 움직임(2026-11-04). 주문 폭주 world-fx.mjs(11-03 2판)를 그대로 옮겼다 — 토큰 여섯은 두 게임이 같다(고치면 둘 다 고친다).
// 튐은 위치 · 크기에만, 색 · 투명도는 튀기지 않는다. 기기 「동작 줄이기」나 WORLD 「움직임 줄이기」(부모 창 :root[data-motion=reduced])에서는
// 공간 이동을 하지 않고 효과(150ms)만 남긴다. 글은 처음부터 DOM에 그대로 있다(읽기 프로그램 · textContent가 바뀌지 않게).
// LAB 화면은 이 파일을 불러오지 않는다.

export const M = Object.freeze({
  fast: { duration: 350, easing: 'cubic-bezier(.42,1.67,.21,.90)' },   // 빠른 공간: 카드 눌림 복귀 · 컵 출렁 · 칩 · 얼굴 원
  base: { duration: 500, easing: 'cubic-bezier(.38,1.21,.22,1)' },     // 기본 공간: 손님 들어옴 · 말풍선 · 컵 미끄러짐 · 영수증
  slow: { duration: 650, easing: 'cubic-bezier(.39,1.29,.35,.98)' },   // 느린 공간: 화면 전환
  efast: { duration: 150, easing: 'cubic-bezier(.31,.94,.34,1)' },     // 빠른 효과: 눌림 어둡힘 · 색
  ebase: { duration: 200, easing: 'cubic-bezier(.34,.80,.34,1)' },     // 기본 효과: 얼굴 바꿈 · 투명도
  eslow: { duration: 300, easing: 'cubic-bezier(.34,.88,.34,1)' },     // 느린 효과: 흐림 → 또렷 · 흑백 → 색
});

/** 움직여도 되나: 기기 설정과 WORLD 앱 설정(부모 창) 둘 다 본다. */
export function motionOn() {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch { /* 없는 환경 */ }
  for (const doc of [document, (() => { try { return window.parent?.document; } catch { return null; } })()]) {
    if (doc?.documentElement?.dataset?.motion === 'reduced') return false;
  }
  return true;
}
// 끝난 상태를 붙잡지 않는다(fill backwards — 늦게 시작하는 동안만 첫 장면): 붙잡으면 그 위에 CSS 움직임(입구 제목 박자 · 재료 카드 :active 눌림)이
// 덮여 두 번째부터 안 움직인다(11-03 찾음). 끝 상태를 남겨야 하는 것(손님 떠남)만 opts로 fill을 준다.
// 끝나면 떼어 낸다(끝 모습 = 본래 모습이라 보이는 변화 없음): 끝난 WAAPI가 요소에 남아 있으면 그 요소에 나중에 거는 CSS 애니메이션 · 전환이
// 합성기로 못 가고 메인 스레드에서 돌았다(11-03 밤 추적 compositeFailed 64 — 입구 제목 박자). 누를 때마다 더하는 카드 튕김도 쌓이지 않는다.
const animate = (el, frames, opts) => {
  if (!el || typeof el.animate !== 'function') return null;
  const a = el.animate(frames, { fill: 'backwards', ...opts });
  const fill = a.effect?.getTiming?.().fill;
  if (fill !== 'forwards' && fill !== 'both') a.finished.then(() => a.cancel(), () => {});
  return a;
};
/** 공간 움직임: 줄이기면 투명도만 짧게. */
export function spatial(el, frames, token = M.base, opts = {}) {
  if (!el) return null;
  if (!motionOn()) {
    const fade = frames.some((f) => 'opacity' in f) ? frames.map((f) => ({ opacity: f.opacity ?? 1 })) : null;
    return fade ? animate(el, fade, { ...M.efast, ...opts }) : null;
  }
  return animate(el, frames, { ...token, ...opts });
}
export const effect = (el, frames, token = M.ebase, opts = {}) => animate(el, frames, { ...(motionOn() ? token : M.efast), ...opts });

/** 위에 얹는 층(누르지 못함). 날아드는 재료 사진이 여기 그려진다. */
function overlay() {
  let layer = document.getElementById('w-fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'w-fx'; layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;z-index:40;pointer-events:none;overflow:hidden;contain:strict';
    document.body.append(layer);
  }
  return layer;
}

/** 재료 사진 조각이 카드에서 컵으로 포물선을 그리며 날아든다(350~450ms). 다 그려지면 resolve. */
export function fly(src, fromEl, toRect, { size = 46, lift = 90 } = {}) {
  if (!motionOn() || !fromEl || !toRect) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height * 0.42 - size / 2;
  const x1 = toRect.left + toRect.width / 2 - size / 2, y1 = toRect.top + toRect.height * 0.38 - size / 2;
  const dist = Math.hypot(x1 - x0, y1 - y0), duration = Math.round(Math.min(450, Math.max(350, dist * 1.2)));
  const img = document.createElement('img');
  img.src = src; img.alt = '';
  img.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${size}px;height:${size}px;border-radius:12px;object-fit:cover;box-shadow:0 8px 18px rgba(0,0,0,.35);will-change:transform,opacity`;
  overlay().append(img);
  const dx = x1 - x0, dy = y1 - y0, apexY = Math.min(0, dy) - lift;
  const anim = img.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
    { transform: `translate(${dx * 0.5}px,${apexY}px) scale(.82)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px,${dy}px) scale(.32)`, opacity: 0, offset: 1 },
  ], { duration, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
  return anim.finished.then(() => img.remove(), () => img.remove());
}

/**
 * 자리마다 굴러가는 숫자(토스 숫자 굴리기): 늘 때는 왼쪽 자리부터 위로, 줄 때는 오른쪽 자리부터 아래로.
 * target(원래 숫자 노드)은 그대로 두고(app.mjs가 textContent를 쓴다) 옆 그림 층만 굴린다 — 읽기 프로그램은 원래 노드를 읽는다.
 */
export function roller(target) {
  const view = document.createElement('span');
  view.className = 'w-roll'; view.setAttribute('aria-hidden', 'true');
  target.after(view);
  target.classList.add('w-roll-src');
  let shown = null, hold = 0;
  // prev: 직전에 보인 숫자 글(그림 층의 글자가 아니다 — 띠마다 0~9가 다 들어 있다). 자리는 오른쪽 끝에 맞춰 견준다(9 → 10이면 둘째 자리는 0에서).
  const draw = (text, dir, prev) => {
    const wait = hold; hold = 0;
    const shift = text.length - prev.length;
    view.replaceChildren(...[...text].map((ch, i) => {
      const slot = document.createElement('span');
      slot.className = /\d/.test(ch) ? 'w-roll-d' : 'w-roll-c';
      if (!/\d/.test(ch)) { slot.textContent = ch; return slot; }
      const strip = document.createElement('span');
      strip.className = 'w-roll-s';
      strip.textContent = '0123456789';
      strip.style.setProperty('--d', ch);
      slot.append(strip);
      const before = prev[i - shift];
      if (before !== ch && dir && motionOn()) {
        const from = /\d/.test(before || '') ? Number(before) : Math.min(9, Math.max(0, Number(ch) - dir));
        const order = dir > 0 ? i : text.length - 1 - i;
        strip.animate([{ transform: `translateY(${-from}em)` }, { transform: `translateY(${-Number(ch)}em)` }], { ...M.fast, delay: wait + order * 30, fill: 'backwards' });
      }
      return slot;
    }));
  };
  const sync = () => {
    const text = target.textContent.trim();
    if (text === shown) return;
    const a = Number(String(shown ?? '').replace(/\D/g, '')), b = Number(text.replace(/\D/g, ''));
    const dir = shown == null || !Number.isFinite(a) || !Number.isFinite(b) ? 0 : Math.sign(b - a);
    const previous = shown ?? '';
    shown = text;
    draw(text, dir, previous);
  };
  new MutationObserver(sync).observe(target, { childList: true, characterData: true, subtree: true });
  sync();
  /** 다음 바뀜을 ms만큼 늦게 굴린다(맞음 한 박자: 점수는 서빙 뒤 180ms에). */
  return { sync, hold(ms) { hold = Math.max(0, ms); } };
}

/** 큰 숫자를 0부터 세어 올린다(결과): 한 칸마다 onTick, 끝에 onLand. 줄이기면 바로 끝 숫자. 탭하면 바로 끝(skip). */
export function countUp(el, to, { duration = 700, onTick = null, onLand = null } = {}) {
  if (!motionOn() || to <= 0) { el.textContent = String(to); onLand?.(); return { skip() {} }; }
  let done = false, raf = 0, last = -1;
  const t0 = performance.now();
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); el.textContent = String(to); onLand?.(); };
  const step = (now) => {
    const k = Math.max(0, Math.min(1, (now - t0) / duration)), eased = 1 - Math.pow(1 - k, 3), v = Math.round(eased * to);
    if (v !== last) { last = v; el.textContent = String(v); if (v < to) onTick?.(); }
    if (k < 1) raf = requestAnimationFrame(step); else finish();
  };
  el.textContent = '0';
  raf = requestAnimationFrame(step);
  return { skip: finish };
}
