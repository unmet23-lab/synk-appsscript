// SYNK LAB PLAY 키트 — 게임들이 같이 쓰는 작은 화면 도우미(원본: experiences/play-common/kit/, 게임마다 kit/ 사본).

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** 그림을 미리 받아 둔다(디코드까지). 실패한 그림도 끝난 것으로 친다. */
export const preloadImages = (urls) => Promise.all(urls.map((u) => { const im = new Image(); im.src = u; return im.decode().catch(() => {}); }));

// ‘만날 거예요’처럼 매인 말은 앞말과 떼지 않는다
const BOUND = /(\S+ 거예요\S*)/;
const nodesOf = (s) => s.split(BOUND).filter(Boolean).map((p) => (BOUND.test(p) ? Object.assign(document.createElement('span'), { className: 'nb', textContent: p }) : p));

/**
 * 카드 글자 맞춤. 한 줄에 안 들어가면 쉼표 뒤에서 줄을 바꾸고(뒷말이 한 줄에 들 때만, 아니면 고르게 접는다),
 * 낱말 하나가 상자보다 길거나 maxLines를 넘으면 그 글자만 0.5px씩 줄인다. 낱말 중간에서 끊지 않게 글 상자는
 * overflow-wrap:normal로 두고 재며, 가장 작게(minPx) 줄여도 넘칠 때만 끊는다. 글 상자는 폭이 정해진 블록이어야 한다.
 */
export function fitText(say, { maxLines = 2, minPx = 12, commaBreak = true } = {}) {
  const text = (say.dataset.text ??= say.textContent), cut = commaBreak ? text.indexOf(', ') : -1;
  say.replaceChildren(...nodesOf(text)); say.style.fontSize = ''; say.style.overflowWrap = '';
  const line = () => parseFloat(getComputedStyle(say).lineHeight);
  const over = () => say.scrollWidth > say.clientWidth + 0.5 || say.scrollHeight > line() * maxLines + 2;
  if (cut > 0 && say.scrollHeight > line() * 1.5) {
    say.replaceChildren(...nodesOf(text.slice(0, cut + 2)), document.createElement('br'), ...nodesOf(text.slice(cut + 2)));
    if (over()) say.replaceChildren(...nodesOf(text));
  }
  for (let size = parseFloat(getComputedStyle(say).fontSize); over() && size > minPx; ) { size -= 0.5; say.style.fontSize = `${size}px`; }
  if (over()) say.style.overflowWrap = 'anywhere';
}

/** 소리 켜기/끄기 단추([data-sound-toggle])를 한 상태로 묶는다. isOn()·setOn(bool)은 게임의 소리 모듈이 준다. */
export function bindSoundToggles({ isOn, setOn, label = (on) => (on ? '소리 끄기' : '소리 켜기') }) {
  const sync = () => {
    for (const b of $$('[data-sound-toggle]')) {
      const on = isOn();
      b.setAttribute('aria-pressed', String(on));
      if (b.classList.contains('sound-toggle')) b.setAttribute('aria-label', label(on));
      else b.textContent = on ? '소리 켜짐' : '소리 꺼짐';
    }
  };
  for (const b of $$('[data-sound-toggle]')) b.addEventListener('click', () => { setOn(!isOn()); sync(); });
  sync();
  return sync;
}
