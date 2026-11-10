// 위 노선 줄(11-10 A 「노선도」, 유호님 고르심): 노선 배지 · 노선 선 · 시계 한 줄과 그 아래 상태 글.
// 안내가 나오는 동안 노선 선이 목소리 크기에 맞춰 물결친다 — 들어야 하는 순간이 화면에 보이되 글(답)은 보이지 않는다.
// led.mjs와 같은 꼴(setClock · setStatus · setLevels · flash · render · invalidate)이라 흐름(app.mjs)은 부르는 이름만 바꾼다.
const NS = 'http://www.w3.org/2000/svg';
export function createHud({ route, clock, status, badge, stage, calm = () => false }) {
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'none'); path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-linecap', 'round');
  const start = document.createElementNS(NS, 'circle'); start.setAttribute('r', '3.6'); start.setAttribute('fill', '#fff');
  const end = document.createElementNS(NS, 'circle'); end.setAttribute('r', '3.6'); end.setAttribute('fill', 'none'); end.setAttribute('stroke', '#ffffffb0'); end.setAttribute('stroke-width', '1.5');
  route.append(path, start, end);
  const label = status.querySelector('span');
  const state = { clock: '', status: '', tone: 'amber', flash: null, level: 0, shown: 0, phase: 0, w: 0, dirty: true, line: 2 };

  function size() {
    const w = Math.round(route.getBoundingClientRect().width);
    if (w && w !== state.w) { state.w = w; route.setAttribute('viewBox', `0 0 ${w} 30`); start.setAttribute('cx', '4'); start.setAttribute('cy', '15'); end.setAttribute('cx', String(w - 4)); end.setAttribute('cy', '15'); state.dirty = true; }
  }
  function paintStatus() {
    const f = state.flash, text = f ? f.text : state.status, tone = f ? f.tone : state.tone;
    if (label.textContent !== text) label.textContent = text;
    status.dataset.tone = tone; status.hidden = !text;
  }
  return {
    state,
    setLine(n, color) { state.line = n; badge.textContent = String(n); stage.style.setProperty('--line', color); stage.style.setProperty('--line-hi', lighten(color)); state.dirty = true; },
    setClock(text) { if (state.clock !== text) { state.clock = text; clock.textContent = text; clock.setAttribute('aria-label', `지금 시각 ${text}`); } },
    setStatus(text, tone = 'amber') { state.status = text; state.tone = tone; paintStatus(); },
    setLevels(levels) { state.level = Math.min(1, Math.max(0, ...levels.map((v) => v || 0)) * 1.15); },
    flash(text, seconds = 2.2, tone = 'green') { state.flash = { text, tone, left: seconds }; paintStatus(); },
    render(dt) {
      size(); if (!state.w) return;
      if (state.flash) { state.flash.left -= dt; if (state.flash.left <= 0) { state.flash = null; paintStatus(); } }
      // 목소리 크기를 부드럽게 따라가고, 흐름은 움직임 줄이기면 멈춘 채 크기만 보인다
      const target = state.level; state.shown += (target - state.shown) * Math.min(1, dt * 14);
      if (!calm()) state.phase += dt;
      const v = state.shown;
      if (v < 0.004 && !state.dirty) return;
      state.dirty = false;
      const w = state.w, n = 72, t = state.phase; let d = '';
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = 4 + (w - 8) * u, env = Math.pow(Math.sin(Math.PI * u), 0.8);
        const y = 15 + (calm() ? Math.sin(u * 24) : Math.sin(u * 30 - t * 20) * 0.7 + Math.sin(u * 11 + t * 6) * 0.3) * v * 12 * env;
        d += (k ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      path.setAttribute('d', d);
      path.setAttribute('stroke', v > 0.03 ? 'var(--line-hi)' : 'var(--line)');
    },
    invalidate() { state.w = 0; state.dirty = true; },
  };
}

/** 노선 색을 밝힌 강조색(목소리 · 고른 길). */
export function lighten(hex, k = 0.32) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `rgb(${c.join(',')})`;
}
