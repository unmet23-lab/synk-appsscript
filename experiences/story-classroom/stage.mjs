// 이야기 교실 무대 — 교실 그림 위의 가구·소품·두 친구 단추, 고르기·끌어 놓기, 친구가 물건을 옮기는 움직임.
// 교실·선생님·소품 그림은 이 게임용으로 만든 것, 마린·까몽은 승인 원본을 그대로 쓴다(투명 여백까지 그대로 두고, 보이는 상자만 CSS로 맞춘다).
// 자리는 무대 크기에서 계산한다. 교실 그림을 무대에 꽉 채우고 칠판·문은 그림 속 위치를 따라가며, 가구·소품·친구는
// 바닥 좌표(u: 가로 0~1, v: 바닥선 0 ~ 무대 아래 1)에 놓는다. 세로로 긴 무대(휴대폰)는 tall, 나머지는 wide 배치다.
// 움직임은 한 번 미끄러지기·나타나기만 쓴다(걷기 흔들림·흔들기 없음 — 유호님이 반복 움직임에 멀미를 느낀다).

export const names = { marin: '마린', kkamong: '까몽', teacher: '선생님', snacks: '과자', paper: '종이', cake: '케이크', ribbon: '리본', flowers: '꽃', letter: '편지', box: '상자', drawer: '서랍', table: '책상', bin: '쓰레기통', shelf: '선반', board: '칠판' };

const PROPS = ['snacks', 'paper', 'cake', 'ribbon', 'flowers', 'letter'];
const FURNITURE = ['shelf', 'drawer', 'box', 'table', 'bin'];
const FRIENDS = ['marin', 'kkamong'];

// 교실 그림(1586×992) 속 자리: 칠판 틀, 문, 바닥선(벽 아래 띠)
const ROOM = { w: 1586, h: 992, board: [0.328, 0.055, 0.670, 0.318], door: [0.855, 0.93, 0.50], floor: 0.445 };

// 그림 속 물체 상자(투명 여백 밖): [파일, 캔버스 폭, 캔버스 높이, 왼쪽, 위, 폭, 높이]
const SPRITES = {
  box: ['prop-box', 256, 256, 16, 33, 224, 189], drawer: ['prop-drawer', 256, 256, 22, 16, 211, 224],
  table: ['prop-table', 384, 384, 25, 56, 335, 271], bin: ['prop-bin', 256, 256, 33, 19, 186, 218],
  shelf: ['prop-shelf', 256, 256, 29, 18, 197, 219], board: ['prop-board', 256, 256, 16, 45, 222, 167],
  snacks: ['prop-snacks', 256, 256, 21, 18, 215, 222], paper: ['prop-paper', 256, 256, 16, 30, 224, 198],
  cake: ['prop-cake', 256, 256, 17, 18, 223, 217], ribbon: ['prop-ribbon', 256, 256, 16, 31, 221, 195],
  flowers: ['prop-flowers', 256, 256, 39, 18, 178, 222], letter: ['prop-letter', 256, 256, 16, 48, 224, 162],
  marin: ['marin-body', 1024, 1024, 255, 183, 527, 812], kkamong: ['kkamong-body', 1024, 1024, 126, 141, 817, 771],
  teacher: ['teacher', 1024, 1536, 0, 14, 1012, 1498],
};
export const sprite = (id) => SPRITES[id];

// 놓인 물건이 앉는 높이(가구 그림 높이에서 아래부터의 비율): 상자·쓰레기통은 안에서 삐죽, 책상·서랍은 윗면,
// 선반은 가운데 칸(꼭대기에 두면 작은 화면에서 칠판 이름표에 닿는다)
const SEAT = { box: 0.42, bin: 0.5, table: 0.8, shelf: 0.58, drawer: 0.97 };

// 배치: [u, v, 크기]. 가구·바닥 소품·친구의 v는 그림 아래 끝(바닥에 닿는 곳), 크기는 단위(unit) 배수의 그림 폭.
// 선생님은 [u, v, 키]. cols·rows는 단위를 정하는 가로·세로 칸 수. 세 줄: 뒤(선반·서랍) · 가운데(상자·책상·쓰레기통) · 앞(종이·마린·까몽·리본).
// 처음부터 가구 위에 있는 과자·케이크·꽃·편지의 바닥 자리는 되돌리기 같은 드문 경우를 위한 것이다.
const FLOOR_EXTRA = { snacks: [0.3, 0.9, 0.8], cake: [0.7, 0.9, 0.8], flowers: [0.5, 0.9, 0.8], letter: [0.55, 0.9, 0.8] };
const LAYOUTS = {
  // 휴대폰 세로
  tall: {
    cols: 7, rows: 3.5,
    spots: {
      shelf: [0.15, 0.24, 1.15], drawer: [0.72, 0.24, 1.05],
      box: [0.16, 0.58, 1.18], table: [0.5, 0.58, 1.9], bin: [0.86, 0.58, 0.82],
      paper: [0.13, 0.9, 0.82], marin: [0.38, 0.9, 0.86], kkamong: [0.63, 0.9, 1.22], ribbon: [0.88, 0.9, 0.84], ...FLOOR_EXTRA,
    },
    teacher: [0.92, 0.16, 2.5],
  },
  // 작은 휴대폰(가로가 좁고 키도 낮은 무대): 이름표가 닿지 않게 계산한 자리(320×568 기준).
  // 상자·책상에 물건이 둘씩 놓여도 두 무리가 떨어지게 상자는 왼쪽·책상은 가운데 오른쪽, 서랍은 오른쪽 끝(책상 무리 위를 비움),
  // 앞 줄 친구는 가운데 줄 이름표 사이 틈에 둔다
  compact: {
    cols: 9, rows: 3.3,
    spots: {
      shelf: [0.11, 0.16, 1.15], drawer: [0.82, 0.16, 1.05],
      box: [0.2, 0.58, 1.2], table: [0.56, 0.58, 1.85], bin: [0.89, 0.58, 0.85],
      paper: [0.08, 0.96, 0.85], marin: [0.34, 0.96, 0.9], kkamong: [0.7, 0.96, 1.18], ribbon: [0.9, 0.96, 0.85], ...FLOOR_EXTRA,
    },
    teacher: [0.93, 0.03, 2.35],
  },
  // 넓은 무대(컴퓨터·태블릿): 뒤 벽 앞에 선반·서랍, 문 앞에 선생님
  wide: {
    cols: 9.5, rows: 3.4,
    spots: {
      shelf: [0.1, 0.2, 1.15], drawer: [0.74, 0.2, 1.05],
      box: [0.22, 0.56, 1.15], table: [0.5, 0.56, 1.9], bin: [0.8, 0.56, 0.82],
      paper: [0.12, 0.9, 0.82], marin: [0.4, 0.9, 0.86], kkamong: [0.6, 0.9, 1.22], ribbon: [0.9, 0.9, 0.84], ...FLOOR_EXTRA,
    },
    teacher: [0.915, 0.08, 2.5],
  },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const artRatio = (id) => { const s = SPRITES[id]; return s[6] / s[5]; };   // 높이 ÷ 폭

/** 투명 여백을 뺀 물체 상자에 그림을 맞춘다(원본 캔버스는 그대로, 상자 밖 여백은 상자 밖으로 넘친다). */
function art(id, file = SPRITES[id][0]) {
  const [, cw, , x, y, w, h] = SPRITES[id];
  const box = document.createElement('span');
  box.className = 'art';
  box.style.aspectRatio = `${w} / ${h}`;
  const img = document.createElement('img');
  img.src = `./assets/${file}.webp`; img.alt = ''; img.draggable = false;
  img.style.width = `${(cw / w) * 100}%`;
  img.style.left = `${(-x / w) * 100}%`;
  img.style.top = `${(-y / h) * 100}%`;
  box.append(img);
  return box;
}

export class StoryStage {
  /** callbacks: onActor(id) · onObject(id) · onPlace(destination) · onCancel(). coveredBottom(): 무대 아래가 판에 가린 높이(px). */
  constructor(el, callbacks, { coveredBottom = () => 0 } = {}) {
    this.el = el; this.callbacks = callbacks; this.coveredBottom = coveredBottom;
    this.nodes = {}; this.game = null; this.busy = false; this.drag = null; this.geo = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mount();
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.el);
  }

  mount() {
    this.el.replaceChildren();
    const board = document.createElement('button');
    board.type = 'button'; board.className = 'board-spot'; board.dataset.destination = 'board'; board.dataset.id = 'board';
    board.setAttribute('aria-label', '칠판');
    board.innerHTML = '<span class="garland" aria-hidden="true"></span><span class="name">칠판</span>';
    board.addEventListener('click', () => this.callbacks.onPlace('board'));
    this.el.append(board); this.nodes.board = board;
    for (const id of FURNITURE) {
      const b = this.thing('furniture', id);
      b.dataset.destination = id;
      b.addEventListener('click', () => this.callbacks.onPlace(id));
    }
    for (const id of PROPS) {
      const b = this.thing('prop', id);
      b.dataset.object = id;
      b.addEventListener('click', () => { if (!this.justDragged) this.tapProp(id); });
      this.installDrag(b, id);
    }
    for (const id of FRIENDS) {
      const b = this.thing(`actor ${id}`, id);
      b.dataset.actor = id;
      b.addEventListener('click', () => this.callbacks.onActor(id));
    }
    const teacher = document.createElement('div');
    teacher.className = 'teacher offstage'; teacher.setAttribute('aria-hidden', 'true');
    teacher.append(art('teacher'));
    this.el.append(teacher); this.nodes.teacher = teacher;
    this.fx = document.createElement('div'); this.fx.className = 'stage-fx'; this.fx.setAttribute('aria-hidden', 'true');
    this.el.append(this.fx);
    const garland = board.querySelector('.garland');
    for (let i = 0; i < 5; i++) { const r = document.createElement('img'); r.src = './assets/prop-ribbon.webp'; r.alt = ''; garland.append(r); }
  }

  thing(cls, id) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `thing ${cls}`; b.dataset.id = id;
    b.setAttribute('aria-label', names[id]);
    const tag = document.createElement('span');
    tag.className = 'name'; tag.textContent = names[id];
    if (names[id].length >= 3) tag.classList.add('long');
    b.append(art(id), tag);
    this.el.append(b); this.nodes[id] = b;
    return b;
  }

  /** 물건을 누름: 들고 있는 물건이면 내려놓기 취소, 다른 물건을 들고 있으면 그 물건이 놓인 가구(칠판)에 놓기, 아니면 고르기. */
  tapProp(id) {
    const g = this.game;
    if (g?.held && g.held === id) return this.callbacks.onCancel();
    const on = g?.scene?.[id];
    if (g?.held && on && on !== 'floor') return this.callbacks.onPlace(on);
    return this.callbacks.onObject(id);
  }

  /* ── 자리 계산 ── */
  geometry() {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W || !H) return null;
    const h = Math.max(120, H - this.coveredBottom());
    const s = Math.max(W / ROOM.w, H / ROOM.h), dw = ROOM.w * s, dh = ROOM.h * s;
    const f = W / dw;
    // 그림 가로: 칠판을 다 보이게 두고, 남는 폭으로 오른쪽 문까지 보이게 민다
    const left = f >= 1 ? 0 : clamp(0.95 - f, 0, Math.min(0.3, 1 - f));
    const ox = -left * dw, oy = dh > H ? -(dh - H) * 0.35 : 0;
    const floorY = oy + ROOM.floor * dh, floorH = h - floorY;
    const layout = W / h < 0.9 ? 'tall' : W < 540 ? 'compact' : 'wide', L = LAYOUTS[layout];
    const unit = clamp(Math.min(W / L.cols, floorH / L.rows), 26, 92);
    const css = getComputedStyle(this.el);
    const tagH = parseFloat(css.getPropertyValue('--tag-h')) || 26, tagLift = parseFloat(css.getPropertyValue('--tag-lift')) || 9;
    const [bx0, by0, bx1, by1] = ROOM.board;
    const board = { x: ox + bx0 * dw, y: oy + by0 * dh, w: (bx1 - bx0) * dw, h: (by1 - by0) * dh };
    return { W, H, h, dw, dh, ox, oy, floorY, floorH, unit, layout, L, tagH, tagLift, board };
  }

  layout() {
    const geo = this.geometry();
    if (!geo) return;
    this.geo = geo;
    this.el.dataset.layout = geo.layout;
    this.el.style.backgroundSize = `${geo.dw}px ${geo.dh}px`;
    this.el.style.backgroundPosition = `${geo.ox}px ${geo.oy}px`;
    this.el.style.setProperty('--unit', `${geo.unit}px`);
    const b = this.nodes.board;
    Object.assign(b.style, { left: `${geo.board.x}px`, top: `${geo.board.y}px`, width: `${geo.board.w}px`, height: `${geo.board.h}px` });
    this.home = {};
    for (const id of [...FURNITURE, ...FRIENDS]) this.home[id] = this.spot(id);
    // 선생님: 발이 닿는 곳(넓은 화면은 문 앞)에 키만큼. 이름표 없이 이야기에만 나온다
    const [tu, tv, tk] = geo.L.teacher, feet = geo.floorY + tv * geo.floorH;
    Object.assign(this.nodes.teacher.style, { left: `${tu * geo.W}px`, top: `${feet}px`, width: `${(tk * geo.unit) / artRatio('teacher')}px`, zIndex: String(Math.round(feet)) });
    for (const id of [...FURNITURE, ...FRIENDS]) this.put(id, this.home[id]);
    if (this.game) this.update(this.game);
  }

  /** 바닥 자리: 그림 아래 끝 가운데(x, y)와 그림 폭 w. 이름표가 판 아래로 내려가지 않게 아래 끝을 막는다. */
  spot(id) {
    const g = this.geo, [u, v, k] = g.L.spots[id];
    return { x: u * g.W, y: Math.min(g.floorY + v * g.floorH, g.h - (g.tagH - g.tagLift) - 3), w: k * g.unit };
  }

  /** 물건 하나가 차지하는 폭: 이름표와 그림 중 넓은 쪽(이름표는 실제로 잰다) */
  footprint(id, artW) {
    const tag = this.nodes[id].querySelector('.name').getBoundingClientRect().width || names[id].length * 13 + 24;
    return Math.max(tag, artW);
  }

  /** 같은 곳에 놓인 물건들을 이름표가 닿지 않게 가구 가운데로 나란히 놓고, 무대(칠판은 칠판) 안에 맞춘다. */
  lineUp(siblings, center, artW, { lo = 4, hi = this.geo.W - 4 } = {}) {
    const widths = siblings.map((k) => this.footprint(k, artW)), gap = 5;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (siblings.length - 1);
    let left = clamp(center - total / 2, lo, Math.max(lo, hi - total));
    const xs = [];
    for (const w of widths) { xs.push(left + w / 2); left += w + gap; }
    return xs;
  }

  /** 단추를 그림 아래 끝 가운데에 맞춘다(이름표는 그 아래로 늘어진다) */
  put(id, p, z = Math.round(p.y)) {
    const n = this.nodes[id], g = this.geo;
    n.style.left = `${p.x}px`;
    n.style.top = `${p.y + g.tagH - g.tagLift}px`;
    n.querySelector('.art').style.width = `${p.w}px`;
    n.style.zIndex = String(z);
  }

  /** 물건 자리: 바닥이면 바닥 자리, 가구·칠판 위면 앉는 곳에 나란히 */
  propSpot(id, scene) {
    const g = this.geo, dest = scene[id];
    if (!dest || dest === 'floor') return { ...this.spot(id), z: Math.round(this.spot(id).y) };
    const siblings = PROPS.filter((k) => scene[k] === dest), i = siblings.indexOf(id);
    if (dest === 'board') {
      const b = g.board, w = Math.min(g.unit * 0.66, b.h * 0.42);
      const xs = this.lineUp(siblings, b.x + b.w / 2, w, { lo: b.x + 6, hi: b.x + b.w - 6 });
      return { x: xs[i], y: b.y + b.h * 0.6, w, z: 60 + i };
    }
    const f = this.home[dest], fh = f.w * artRatio(dest), w = g.unit * 0.66;
    const xs = this.lineUp(siblings, f.x, w);
    // 놓인 물건의 이름표가 가구 이름표에 닿지 않게, 앉는 높이는 이름표 높이보다 낮아지지 않는다
    const seat = Math.max(SEAT[dest] * fh, g.tagH + 3);
    return { x: xs[i], y: f.y - seat, w, z: Math.round(f.y) + 1 + i };
  }

  /* ── 상태 그리기 ── */
  update(game) {
    this.game = game;
    if (!this.geo) return;
    const active = game.phase === 'play' || game.phase === 'review';
    this.el.dataset.phase = game.phase;
    this.el.classList.toggle('holding', active && !!game.held);
    for (const id of PROPS) {
      const n = this.nodes[id], on = game.scene[id];
      if (!this.busy) { const p = this.propSpot(id, game.scene); this.put(id, p, p.z); }
      n.classList.toggle('on-furniture', !!on && on !== 'floor');
      n.classList.toggle('selected', game.held === id);
      n.setAttribute('aria-pressed', String(game.held === id));
      n.setAttribute('aria-label', on && on !== 'floor' ? `${names[id]} · ${names[on]}에 있음` : `${names[id]} · 바닥에 있음`);
      n.disabled = !active || this.busy;
    }
    for (const id of FRIENDS) {
      const n = this.nodes[id], picked = game.actor === id;
      n.classList.toggle('selected', picked);
      n.setAttribute('aria-pressed', String(picked));
      n.disabled = !active || this.busy;
      if (!this.busy) this.face(id, picked ? 'focus' : 'body');
    }
    for (const id of [...FURNITURE, 'board']) {
      const n = this.nodes[id];
      n.disabled = !active || this.busy;
      n.classList.toggle('available', active && !!game.held && !this.busy);
    }
    this.party(game.completedIds.includes('surprise-ribbon'));
  }

  face(id, mood) { const img = this.nodes[id].querySelector('img'), src = `./assets/${id}-${mood}.webp`; if (!img.src.endsWith(src.slice(1))) img.src = src; }

  teacher(show = true) {
    const t = this.nodes.teacher, was = !t.classList.contains('offstage');
    t.classList.toggle('offstage', !show);
    if (show && !was && !this.reduced) t.animate([{ opacity: 0, translate: '24px 0' }, { opacity: 1, translate: '0 0' }], { duration: 600, easing: 'ease-out' });
  }

  party(on) {
    const b = this.nodes.board, was = b.classList.contains('party');
    b.classList.toggle('party', on);
    if (on && !was && !this.reduced) b.querySelector('.garland').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out' });
  }

  /** 무대 기준 px: 물건이 놓인 곳의 가운데 위. 칭찬 글자·반짝이 자리. 그려진 상자가 아니라 정한 자리로 잰다
   *  (움직임 줄이기에서는 모든 전환이 0.01ms라 바꾼 직후 상자는 한 프레임 동안 옛 자리에 있다). */
  pointOf(id) {
    const n = this.nodes[id];
    if (!n) return null;
    const h = n.offsetHeight, top = parseFloat(n.style.top) - h;
    return { x: parseFloat(n.style.left), y: top + Math.min(h * 0.35, 40) };
  }

  /* ── 끌어 놓기: 친구를 고른 뒤 물건을 끌어 놓을 곳에 ── */
  installDrag(button, id) {
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.busy || !this.game?.actor || !['play', 'review'].includes(this.game.phase)) return;
      this.drag = { id, x: e.clientX, y: e.clientY, pointer: e.pointerId, moved: false };
      button.setPointerCapture?.(e.pointerId);
    });
    button.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.pointer !== e.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) {
        d.moved = true;
        if (this.game.held !== id) this.callbacks.onObject(id);
        this.ghost = document.createElement('div');
        this.ghost.className = 'drag-ghost';
        this.ghost.append(art(id));
        this.ghost.querySelector('.art').style.width = `${Math.max(48, this.geo?.unit || 48)}px`;
        document.body.append(this.ghost);
      }
      if (d.moved) { e.preventDefault(); this.ghost.style.left = `${e.clientX}px`; this.ghost.style.top = `${e.clientY}px`; }
    });
    const finish = (e) => {
      const d = this.drag;
      if (!d || d.pointer !== e.pointerId) return;
      this.drag = null; this.ghost?.remove(); this.ghost = null;
      if (!d.moved) return;
      this.justDragged = true; setTimeout(() => { this.justDragged = false; }, 100);
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const dest = hit?.closest('[data-destination]')?.dataset.destination;
      const onProp = hit?.closest('[data-object]')?.dataset.object;
      const target = dest || (onProp && onProp !== id && this.game.scene[onProp] !== 'floor' ? this.game.scene[onProp] : null);
      if (target) this.callbacks.onPlace(target);
    };
    button.addEventListener('pointerup', finish);
    button.addEventListener('pointercancel', () => { this.drag = null; this.ghost?.remove(); this.ghost = null; });
  }

  /** 친구가 설 자리: 물건 옆(교실 가운데 쪽), 벽 위로 올라가지 않게 바닥 위 */
  beside(pt, w) {
    const g = this.geo, side = pt.x > g.W / 2 ? -1 : 1;
    return { x: clamp(pt.x + side * w * 0.75, w / 2, g.W - w / 2), y: Math.max(pt.y, g.floorY + g.floorH * 0.3), w };
  }

  /* ── 친구가 물건을 옮긴다: 물건 앞으로 가서 → 들고 놓을 곳으로 → 제자리. 한 번 미끄러지기만 한다(걷기 흔들림 없음). ── */
  async act(actor, object, destination, result, scene) {
    if (!this.geo || !this.nodes[actor] || !this.nodes[object]) return;
    this.busy = true;
    const a = this.nodes[actor], p = this.nodes[object], home = this.home[actor];
    const start = { x: parseFloat(p.style.left), y: parseFloat(p.style.top) - (this.geo.tagH - this.geo.tagLift) };
    const dest = this.propSpot(object, scene);
    const step = this.reduced ? 1 : 380;
    this.face(actor, 'focus');
    a.style.transition = `left ${step}ms ease-in-out, top ${step}ms ease-in-out`;
    this.put(actor, this.beside(start, home.w), 1900);
    await delay(step);
    p.classList.add('carried');
    p.style.transition = `left ${step + 120}ms ease-in-out, top ${step + 120}ms ease-in-out`;
    this.put(object, { ...dest, y: dest.y - 8 }, 2000);
    this.put(actor, this.beside(dest, home.w), 1900);
    await delay(step + 120);
    p.classList.remove('carried');
    this.put(object, dest, dest.z);
    this.face(actor, result.correct ? 'happy' : 'body');
    if (result.correct) this.sparkle(object);
    else if (object === 'paper' && destination === 'bin') this.paperBurst();
    a.style.transition = `left ${this.reduced ? 1 : 320}ms ease-in-out, top ${this.reduced ? 1 : 320}ms ease-in-out`;
    this.put(actor, home);
    await delay(this.reduced ? 1 : 320);
    a.style.transition = ''; p.style.transition = '';
    this.busy = false;
  }

  /** 맞게 놓으면 펠트 반짝이 몇 개가 한 번 톡 나타났다 사라진다 */
  sparkle(id) {
    if (this.reduced) return;
    const pt = this.pointOf(id);
    if (!pt) return;
    const at = (ang, r, scale) => `translate(calc(-50% + ${Math.cos(ang) * r}px), calc(-50% + ${Math.sin(ang) * r}px)) scale(${scale})`;
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      const ang = (i / 5) * Math.PI * 2 - Math.PI / 2, r = 26 + (i % 2) * 12;
      s.style.left = `${pt.x}px`; s.style.top = `${pt.y}px`;
      this.fx.append(s);
      const frames = [{ transform: at(ang, 0, 0.3), opacity: 0 }, { transform: at(ang, r, 1), opacity: 1, offset: 0.45 }, { transform: at(ang, r + 10, 0.8), opacity: 0 }];
      s.animate(frames, { duration: 820, easing: 'ease-out' }).finished.then(() => s.remove());
    }
  }

  /** 종이를 쓰레기통에 버리면 종잇조각이 통 위로 한 번 흩어진다 */
  paperBurst() {
    if (this.reduced) return;
    const pt = this.pointOf('bin');
    if (!pt) return;
    for (let i = 0; i < 4; i++) {
      const s = document.createElement('img');
      s.src = './assets/prop-paper.webp'; s.alt = ''; s.className = 'paper-bit';
      s.style.left = `${pt.x}px`; s.style.top = `${pt.y}px`;
      this.fx.append(s);
      const dx = (i - 1.5) * 26, dy = -34 - (i % 2) * 18;
      const frames = [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9) rotate(${(i - 1.5) * 40}deg)`, opacity: 0 }];
      s.animate(frames, { duration: 1100, easing: 'ease-out' }).finished.then(() => s.remove());
    }
  }

  reset() {
    this.teacher(false); this.party(false);
    for (const id of FRIENDS) { this.nodes[id].style.transition = ''; this.face(id, 'body'); }
    this.fx.replaceChildren();
    if (this.geo) for (const id of FRIENDS) this.put(id, this.home[id]);
  }

  /** 확인용: 단추마다 무대 안의 상자 */
  boxes() {
    const s = this.el.getBoundingClientRect();
    return Object.fromEntries(Object.entries(this.nodes).filter(([id]) => id !== 'teacher').map(([id, n]) => {
      const r = n.getBoundingClientRect();
      return [id, { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }];
    }));
  }
}
