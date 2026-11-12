// 고르는 판 — B 「길 안내 표지판」(11-11 유호님 「B 표지판으로」): 고를 차례에 화면 아래에서 어두운 표지판 하나가 올라온다.
// 11-10 · 11-11 맹검이 고르는 화면 넷 모두 첫 지적으로 짚은 것 — 사진 위 어두운 그러데이션에 기본 고딕 글 · 같은 굵기 꺾쇠만 얹은 「공장형」,
// 사진 속 길과 따로 노는 화살표(출구 갈래가 수레 · 기둥을 가리킴), 지시문과 단추가 같은 흰 글 — 을 사진 위 층 대신 제 면을 가진 판으로 푼다.
//   판 머리: 질문 한 줄(「어느 문으로 내릴까요?」 — 위 노선 줄의 상태 글은 고를 차례에 화면에서 숨고 aria-live로만 남는다)
//   세 칸: 1px 세로줄로 나눈 한 판(키오스크 타일 아님). 칸마다 위에 갈 곳의 색 띠 · 속이 찬 길 안내 화살(사진 속 「↑ 나가는 곳」 표지와 같은 꼴) ·
//          굵은 말(들어오며 260 → 800으로 선다) + 가는 말. 통로는 노선 동그라미, 출구는 노란 큰 번호. 고르면 그 칸이 갈 곳의 색으로 위에서부터 찬다.
// 누르기 · 밀기는 그대로 #zones(투명 단추 — 판의 세 칸과 같은 자리)가 받는다. 판의 칸은 그림이라 aria-hidden.
export const QUESTION = Object.freeze({ door: '어느 문으로 내릴까요?', fork: '어느 쪽으로 갈까요?', exit: '몇 번 출구로 나갈까요?', board: '어떻게 할까요?' });
const EN = Object.freeze({ left: 'Left door', stay: 'Stay on', right: 'Right door', board: 'Board', wait: 'Wait', opposite: 'Other side' });
const INK = '#16171a';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** 글을 굵은 말 + 가는 말로 가른다(마지막 띄어쓰기 앞뒤). 출구는 번호 | 「번 출구」.
 *  뒷말이 한 글자면(「문」 말고) 그 앞 띄어쓰기에서 가른다 — 「2호선 / 타는 곳」, 앞 띄어쓰기가 없으면 「나가는 곳」 그대로(「나가는 / 곳」은 뜻이 끊긴다). */
export function splitLabel(o) {
  if (o.exit != null) return [String(o.exit), '번 출구'];
  const t = String(o.text || ''), k = t.lastIndexOf(' ');
  if (k > 0 && (t.length - k - 1 >= 2 || /문$/.test(t))) return [t.slice(0, k), t.slice(k + 1)];
  const j = k > 0 ? t.lastIndexOf(' ', k - 1) : -1;
  return j > 0 ? [t.slice(0, j), t.slice(j + 1)] : [t, ''];
}

const lift = (hex, k = 0.38) => { const n = parseInt(hex.slice(1), 16); return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k)).join(',')})`; };
/** 칸 색: fill(고르면 칸이 이 색으로 찬다) · accent(어두운 판 위 화살 · 윗줄) · ink(채운 칸 위 글). 통로는 가는 노선, 출구는 출구 표지의 노랑, 나가는 곳은 흰색, 그 밖은 지금 노선. */
export function tileColor(o, line) {
  if (o.exit != null) return { fill: '#ffd400', accent: '#ffd400', ink: INK };
  if (o.id === 'out') return { fill: '#f4f4f5', accent: '#f4f4f5', ink: INK };
  const c = o.line ? o.color : line;
  return { fill: c, accent: lift(c), ink: '#fff' };
}
/** 화살 방향: 문 · 승강장은 왼쪽 · 가운데 · 오른쪽 — 문 가운데 「그대로」는 열차 앞모습(안 내리고 그대로 탄다 — ↑는 「앞으로 간다」로 읽혔다, 11-12 맹검), 승강장 가운데 「기다리기」는 멈춤 표. 통로 · 출구는 왼쪽 위 · 위 · 오른쪽 위. */
export const arrowOf = (kind, i) => (kind === 'door' && i === 1 ? 'stay' : kind === 'board' && i === 1 ? 'wait' : (kind === 'door' || kind === 'board' ? ['l', 'u', 'r'] : ['ul', 'u', 'ur'])[i]);

/** 칸 글: 노선 동그라미(통로) + 굵은 말 + 가는 말 + 영문(문 · 승강장만 — 역 이름엔 로마자를 달지 않는다). 출구는 큰 번호 + 「번 출구」. */
export function labelHtml(kind, o) {
  const [big, small] = splitLabel(o);
  if (o.exit != null) return `<b class="pk-num">${esc(big)}</b><span class="pk-small">${esc(small)}</span>`;
  const en = kind === 'door' || kind === 'board' ? EN[o.id] || '' : '';
  const mark = o.line ? `<span class="pk-line" style="--c:${esc(o.color)}">${esc(o.line)}</span>` : '';
  const size = big.length <= 3 ? 'l' : big.length <= 5 ? 'm' : 's';
  return `${mark}<span class="pk-words" data-size="${size}"><b class="pk-big">${esc(big)}</b>${small ? `<span class="pk-small">${esc(small)}</span>` : ''}</span>${en ? `<span class="pk-en">${en}</span>` : ''}`;
}

/** 칸 하나의 전체 꼴(시험이 읽는다). */
export function optionHtml(kind, o, i, line) {
  const { fill, accent, ink } = tileColor(o, line);
  return `<div class="pk-opt" data-i="${i}" data-dir="${arrowOf(kind, i)}" style="--c:${fill};--a:${accent};--t:${ink};--d:${i}"><i class="pk-arrow" aria-hidden="true"></i>${labelHtml(kind, o)}</div>`;
}

export function createPickPanel({ root }) {
  root.innerHTML = '<div class="pk-head"><p class="pk-q"><span class="pk-ask"></span><span class="pk-hint"></span></p></div><div class="pk-opts" aria-hidden="true"></div>';
  const opts = root.querySelector('.pk-opts');
  let on = false, picked = -1, hideTimer = 0;
  return {
    get visible() { return on; },
    /** hint: 처음 두 판에만 질문 뒤에 흐린 글로 「누르거나 밀어요」. */
    show(kind, options, { line = '#00A84D', hint = '' } = {}) {
      clearTimeout(hideTimer);
      root.querySelector('.pk-ask').textContent = QUESTION[kind] || QUESTION.door;
      root.querySelector('.pk-hint').textContent = hint;
      root.dataset.kind = kind;
      opts.innerHTML = options.map((o, i) => optionHtml(kind, o, i, line)).join('');
      delete root.dataset.picked; delete root.dataset.out; root.hidden = false; void root.offsetWidth;
      root.dataset.on = ''; on = true; picked = -1;
    },
    press(i, down) { opts.children[i]?.toggleAttribute('data-press', !!down); },
    /** 고르면 그 칸을 0.4초 채워 보인 뒤 판이 내려간다(0.38초). 문 열림(0.95초)은 그 뒤에 보이고, 통로 · 출구는 app.mjs가 0.45초 기다렸다 달려 나간다. */
    pick(i) { picked = i; root.dataset.picked = String(i); opts.children[i]?.setAttribute('data-mine', ''); this.hide(); },
    hide() {
      if (!on) return; on = false;
      hideTimer = setTimeout(() => { root.dataset.out = ''; delete root.dataset.on; hideTimer = setTimeout(() => { root.hidden = true; }, 420); }, picked >= 0 ? 400 : 0);
    },
  };
}
