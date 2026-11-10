// 아래 역 지도(11-10 A 「노선도」, 유호님 고르심): 고를 차례에 화면 아래 누름 칸(아래 28% · 폭 ⅓) 위로 지하철 노선도를 그린다.
// 내 자리 점(가운데)에서 세 갈래가 나가고, 갈래 끝 · 역 위에 고를 것의 이름이 역 이름처럼 붙는다. 고르면 그 갈래만 밝아지고 점이 그리로 달린다.
//   문(열차 안): 가로 노선 — 왼쪽 · 오른쪽은 화면 밖(문)으로, 가운데는 위로(그대로)
//   통로 · 출구(갈림 앞): 세 갈래 모두 앞으로 — 왼쪽 · 가운데 · 오른쪽
//   승강장: 왼쪽은 열차(타기), 가운데는 멈춤 막대(기다리기), 오른쪽은 화면 밖(반대편)
// 바닥에 칠하지 않는다(11-10 맹검 · 점검표 46 · 58) — 사진 위에 설계된 그래픽 층으로 둔다.
const NS = 'http://www.w3.org/2000/svg';
export const MAP = Object.freeze({ track: 0.878, top: 0.806, cols: Object.freeze([1 / 6, 1 / 2, 5 / 6]) });
const EN = Object.freeze({ left: 'Left door', stay: 'Stay', right: 'Right door', board: 'Board', wait: 'Wait', opposite: 'Other side' });

/** 화면 크기 W × H에서 갈래 · 역 · 이름 자리. 그리지 않는다(시험이 누름 칸과 맞는지 잰다). */
export function layoutMap(kind, options, W, H) {
  const ty = H * MAP.track, top = H * MAP.top, cx = W / 2, xs = MAP.cols.map((c) => c * W), R = Math.min(18, W * 0.045);
  const ways = options.map((o, i) => {
    const x = xs[i], side = i === 0 ? -1 : i === 2 ? 1 : 0;
    if (kind === 'door' || (kind === 'board' && i !== 1)) {
      if (!side) return { d: `M${cx},${ty} L${cx},${top}`, head: { x: cx, y: top, dir: 'up' }, to: [cx, top + 6], label: [cx, top - 20], station: null };
      const edge = side < 0 ? -30 : W + 30;
      return { d: `M${cx},${ty} L${side < 0 ? 10 : W - 10},${ty}`, head: { x: side < 0 ? 10 : W - 10, y: ty, dir: side < 0 ? 'left' : 'right' }, to: [x, ty], label: [x, ty - 22], station: [x, ty] };
    }
    if (kind === 'board') return { d: `M${cx},${ty} L${cx},${top + 12}`, head: { x: cx, y: top + 12, dir: 'stop' }, to: [cx, top + 12], label: [cx, top - 6], station: null };
    // 통로 · 출구: 가로로 나가 둥글게 꺾여 앞으로
    if (!side) return { d: `M${cx},${ty} L${cx},${top}`, head: { x: cx, y: top, dir: 'up' }, to: [cx, top + 6], label: [cx, top - 20], station: null };
    const turn = x - side * R;
    return { d: `M${cx},${ty} L${turn},${ty} Q${x},${ty} ${x},${ty - R} L${x},${top}`, head: { x, y: top, dir: 'up' }, to: [x, top + 6], label: [x, top - 20], station: null };
  });
  return { ty, top, cx, ways };
}

const headPath = ({ x, y, dir }) => dir === 'left' ? `M${x + 12},${y - 11} L${x},${y} L${x + 12},${y + 11}` : dir === 'right' ? `M${x - 12},${y - 11} L${x},${y} L${x - 12},${y + 11}` : dir === 'up' ? `M${x - 11},${y + 12} L${x},${y} L${x + 11},${y + 12}` : `M${x - 15},${y} L${x + 15},${y}`;

/** 이름 칸 글: 문 · 승강장은 한글 + 작은 영문, 통로는 노선 동그라미 + 방면, 출구는 노란 번호 + 「번 출구」. */
export function labelHtml(kind, o) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  if (o.exit != null) return `<b class="rm-name"><span class="rm-exit">${o.exit}</span>번 출구</b>`;
  if (o.line) return `<b class="rm-name"><span class="rm-line" style="--c:${o.color}">${o.line}</span>${esc(o.text)}</b>`;
  const en = EN[o.id] || EN[o.arrow] || '';
  return `<b class="rm-name">${esc(o.text)}</b>${en ? `<span class="rm-en">${en}</span>` : ''}`;
}

const brighten = (hex, k = 0.28) => { const n = parseInt(hex.slice(1), 16); return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k)).join(',')})`; };

export function createRouteMap({ svg, labels, stage, calm = () => false, beat = 0.56 }) {
  let L = null, t = 0, picked = -1, tp = 0, on = false, out = 0, W = 0, H = 0, colors = [];
  const segs = [], heads = [], dots = [], labs = [], cases = [], headCases = [];
  const me = document.createElementNS(NS, 'circle'), ring = document.createElementNS(NS, 'circle');
  me.setAttribute('class', 'rm-me'); ring.setAttribute('class', 'rm-ring');
  const clamp = (x) => Math.min(1, Math.max(0, x)), seg = (a, b) => clamp((t - a) / (b - a)), expo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
  const eio = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2), back = (k) => Math.max(0, 1 + 2.6 * Math.pow(k - 1, 3) + 1.6 * Math.pow(k - 1, 2));

  function build(kind, options) {
    const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.replaceChildren(); labels.replaceChildren(); segs.length = heads.length = dots.length = labs.length = cases.length = headCases.length = 0;
    L = layoutMap(kind, options, W, H);
    // 갈래 색: 통로는 가는 노선의 색, 나가는 곳 · 출구는 흰색, 그 밖은 지금 노선 색
    colors = options.map((o) => (o.line ? brighten(o.color) : kind === 'exit' || o.id === 'out' ? '#f4f6f8' : 'var(--line)'));
    L.ways.forEach((w, i) => {
      const hp = headPath(w.head);
      const pc = document.createElementNS(NS, 'path'); pc.setAttribute('d', w.d); pc.setAttribute('class', 'rm-case'); svg.append(pc); cases.push(pc);
      const hc = document.createElementNS(NS, 'path'); hc.setAttribute('d', hp); hc.setAttribute('class', 'rm-head-case'); svg.append(hc); headCases.push(hc);
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', w.d); p.setAttribute('class', 'rm-seg'); p.style.stroke = colors[i]; svg.append(p); segs.push(p);
      const h = document.createElementNS(NS, 'path'); h.setAttribute('d', hp); h.setAttribute('class', 'rm-head'); h.style.stroke = colors[i]; svg.append(h); heads.push(h);
      if (w.station) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', w.station[0]); c.setAttribute('cy', w.station[1]); c.setAttribute('class', 'rm-dot'); svg.append(c); dots.push(c); } else dots.push(null);
      const lab = document.createElement('div'); lab.className = 'rm-label'; lab.innerHTML = labelHtml(kind, options[i]); lab.style.left = `${w.label[0]}px`; lab.style.top = `${w.label[1]}px`; labels.append(lab); labs.push(lab);
    });
    me.setAttribute('cx', L.cx); me.setAttribute('cy', L.ty); ring.setAttribute('cx', L.cx); ring.setAttribute('cy', L.ty);
    svg.append(ring, me);
    segs.forEach((p, i) => { const n = p.getTotalLength(); for (const q of [p, cases[i]]) { q.style.strokeDasharray = n; q.dataset.len = n; } });
  }
  return {
    show(kind, options) { svg.removeAttribute('hidden'); labels.hidden = false; build(kind, options); t = 0; picked = -1; tp = 0; on = true; out = 0; this.render(0); },
    pick(i) { picked = i; tp = 0; },
    hide() { on = false; },
    get visible() { return on || out < 1; },
    render(dt) {
      if (!L) return;
      if (!on) { out = Math.min(1, out + dt / 0.22); svg.style.opacity = labels.style.opacity = String(1 - out); if (out >= 1) { svg.setAttribute('hidden', ''); labels.hidden = true; L = null; } return; }
      svg.style.opacity = labels.style.opacity = '1';
      const still = calm(); t += still ? 10 : dt; if (picked >= 0) tp += dt;
      const kp = still ? 1 : expo(clamp(tp / 0.4)), run = still ? 1 : eio(clamp(tp / 0.42));
      L.ways.forEach((w, i) => {
        const k = expo(seg(i === 1 ? 0.12 : 0, i === 1 ? 0.82 : 0.7)), mine = picked === i, dim = picked >= 0 && !mine ? 1 - 0.78 * kp : 1;
        const p = segs[i]; for (const q of [p, cases[i]]) { q.style.strokeDashoffset = String(Number(q.dataset.len) * (1 - k)); q.style.opacity = String(dim); }
        p.classList.toggle('on', mine); heads[i].classList.toggle('on', mine);
        heads[i].style.opacity = headCases[i].style.opacity = String(k > 0.92 ? dim : 0);
        if (dots[i]) { dots[i].setAttribute('r', String(7.5 * back(seg(0.3, 0.62)))); dots[i].style.opacity = String(picked >= 0 && !mine ? 0.3 : 1); }
        const lk = expo(seg(0.36 + i * 0.06, 0.86 + i * 0.06)), lab = labs[i];
        lab.style.opacity = String(lk * (picked >= 0 && !mine ? 1 - 0.7 * kp : 1));
        lab.style.transform = `translate(-50%,calc(-100% + ${((1 - lk) * 12).toFixed(1)}px)) scale(${mine ? 1 + 0.14 * kp : 1})`;
        lab.classList.toggle('on', mine);
      });
      // 내 자리 점: 박자에 숨쉬다가 고른 갈래 끝으로 달린다
      const tgt = picked >= 0 ? L.ways[picked].to : [L.cx, L.ty];
      me.setAttribute('cx', String(L.cx + (tgt[0] - L.cx) * (picked >= 0 ? run : 0))); me.setAttribute('cy', String(L.ty + (tgt[1] - L.ty) * (picked >= 0 ? run : 0)));
      const b = picked < 0 && t > 0.7 && !still ? Math.pow(Math.max(0, Math.cos(((t - 0.7) / beat) * Math.PI * 2)), 10) : 0;
      me.setAttribute('r', String(9 * back(seg(0.1, 0.45)) * (1 + b * 0.12)));
      const rp = ((((t - 0.7) / beat) % 1) + 1) % 1; ring.setAttribute('r', String(9 + rp * 22)); ring.style.opacity = String(picked < 0 && t > 0.7 && !still ? (1 - rp) * 0.8 : 0);
    },
  };
}
