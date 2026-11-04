// 작품과 쇼릴. 쇼릴은 작품 여럿의 깨끗한 구간을 이은 소리 없는 반복 영상이다(media/works/build_reel.cjs).
import { M, reduced, trapTab } from './copy.mjs';
import { TIMELINE, REEL_TOTAL as TOTAL } from './reel-timeline.mjs';

const VIRTUAL = '가상 브랜드로 만든 자체 작품';
export const FILMS = {
  gift: { id: 'gift', name: '유리결', line: '홀리데이 기프트 · 15초', tag: '대표작', note: VIRTUAL, film: M('gift/film.mp4'), ratio: '9:16' },
  maejin: { id: 'maejin', name: '매진 임박', line: '홈쇼핑 × 공포 코미디', note: VIRTUAL, film: M('works/maejin-film.mp4'), ratio: '16:9' },
  cf: { id: 'cf', name: '1억 년의 빛', line: '화성 CF · 55초', note: '공모전 출품작', film: M('works/cf-film.mp4'), ratio: '16:9' },
};
// 승인 원고대로 작품은 완성된 둘이다. 공모전 출품작은 가상 브랜드 꼬리표 아래에 넣지 않고 한 줄로 따로 둔다. 모두의코스 · 첨벙댕은 완성되면 더한다.
export const WORK_ORDER = ['gift', 'maejin'];
export const CONTEST = 'cf';
// 목록에서는 자체 작품이라는 말을 절 머리에 한 번만 쓰고 줄마다 되풀이하지 않는다.
export const ownNote = (f) => (f.note === VIRTUAL ? '' : f.note);
export { TIMELINE };
const isTall = () => matchMedia('(max-aspect-ratio: 1/1)').matches;
export const reelSrc = () => (isTall() ? M('works/reel-tall.mp4') : M('works/reel-wide.mp4'));
export const reelPoster = (second) => M(`works/reel-${isTall() ? 'tall' : 'wide'}-poster${second ? '2' : ''}.webp`);

// 쇼릴 하나를 video에 잇는다. focus(id)를 부르면 그 작품의 컷만 돌고, focus(null)이면 전체가 돈다.
export function mountReel(video, { onCut, startCut = 0 } = {}) {
  video.muted = true; video.playsInline = true; video.loop = true; video.preload = 'auto'; video.setAttribute('aria-hidden', 'true');
  video.poster = reelPoster(startCut > 0); video.src = reelSrc();
  if (startCut) video.addEventListener('loadedmetadata', () => { video.currentTime = TIMELINE[startCut].at + 0.02; }, { once: true });
  let only = null, idx = 0, wanted = true, raf = 0;
  const cutAt = (t) => { let k = 0; for (let i = 0; i < TIMELINE.length; i++) if (t >= TIMELINE[i].at) k = i; return k; };
  const endOf = (k) => (k + 1 < TIMELINE.length ? TIMELINE[k + 1].at : TOTAL);
  const cutsOf = (id) => TIMELINE.map((c, i) => [c, i]).filter(([c]) => c.work === id).map(([, i]) => i);
  const report = () => onCut?.(FILMS[TIMELINE[idx].work]);
  const go = (k) => { idx = k; video.currentTime = TIMELINE[k].at + 0.02; report(); };
  // 고른 작품만 돌 때는 다음 컷이 한 프레임도 비치지 않도록 매 프레임 본다.
  const watch = () => {
    raf = requestAnimationFrame(watch);
    if (!only || video.seeking) return;
    const t = video.currentTime;
    if (t >= endOf(idx) - 0.07 || t < TIMELINE[idx].at) { const list = cutsOf(only); go(list[(list.indexOf(idx) + 1) % list.length]); }
  };
  video.addEventListener('timeupdate', () => { if (only) return; const k = cutAt(video.currentTime); if (k !== idx) { idx = k; report(); } });
  const play = () => { wanted = true; if (!reduced()) video.play().catch(() => {}); if (only && !raf) raf = requestAnimationFrame(watch); };
  const pause = () => { wanted = false; video.pause(); cancelAnimationFrame(raf); raf = 0; };
  report();
  return {
    play, pause, video,
    focus(id) {
      if (id === only) { if (wanted) play(); return; }
      only = id; cancelAnimationFrame(raf); raf = 0;
      if (id) { go(cutsOf(id)[0]); raf = requestAnimationFrame(watch); } else report();
      if (wanted) play();
    },
    current: () => FILMS[TIMELINE[idx].work],
  };
}

// 소리와 함께 트는 방. 세 방향이 각자 옷을 입힌다.
export function screen(work, { className = 'screening', html = '', t = 0, onOpen } = {}) {
  const opener = document.activeElement;
  const box = document.createElement('div');
  box.className = className; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', `${work.name} 상영`); box.dataset.ratio = work.ratio;
  box.innerHTML = `<video class="film" playsinline src="${work.film}"></video>${html}`;
  document.body.append(box);
  requestAnimationFrame(() => box.classList.add('is-on'));
  const v = box.querySelector('video');
  if (t) v.addEventListener('loadedmetadata', () => { v.currentTime = t; }, { once: true });
  v.muted = false; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  let cleanup = null;
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === ' ' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); if (v.paused) v.play(); else v.pause(); } };
  const close = () => { v.pause(); box.classList.remove('is-on'); setTimeout(() => box.remove(), reduced() ? 0 : 420); removeEventListener('keydown', key); opener?.focus?.(); cleanup?.(); };
  addEventListener('keydown', key);
  box.querySelector('[data-close]')?.addEventListener('click', close);
  // 닫기 단추가 아니라 창에 초점을 둬야 스페이스가 재생 · 멈춤이 된다.
  box.tabIndex = -1; box.focus(); trapTab(box);
  cleanup = onOpen?.(box, v) || null;
  return { close, box, v };
}
