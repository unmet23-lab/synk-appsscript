// 우리 동네 바탕(지금 앱과 같은 그림 · 이름표 · 위 막대 · 몽글 카드 · 탭) + 입구 시안 셋이 같이 쓰는 것.
import { sfx } from './공용.js';
export { sfx };
export const $ = (s, r = document) => r.querySelector(s);
export const wide = matchMedia('(min-width:1024px)').matches;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = {
  home: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
  tabHome: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 5.5c3-1.4 6-1.4 9 .5 3-1.9 6-1.9 9-.5V19c-3-1.4-6-1.4-9 .5-3-1.9-6-1.9-9-.5z"/><path d="M12 6v13.5"/></svg>',
  pad: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="16" cy="11.5" r=".6" fill="currentColor"/><circle cx="18" cy="13.5" r=".6" fill="currentColor"/></svg>',
  hanger: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5V8a2 2 0 1 1 2-2"/><path d="M12 8.5 3 15.5c-.8.7-.3 2 .8 2h16.4c1.1 0 1.6-1.3.8-2z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
};
export { ICON };
// 이름표 자리(%, home-town.mjs TOWN_SCENES와 같은 값)
const PINS = {
  port: { home: [49, 15.5], cafe: [11.5, 32.5], store: [37, 30.5], clock: [78, 20], bus: [86, 42.5] },
  land: { home: [64, 23], cafe: [37.5, 47.5], store: [54, 44.5], clock: [78, 35.5], bus: [93, 64], friends: [57, 57.5] },
};
const NAMES = { home: '우리 집', cafe: '카페', store: '편의점', clock: '시계탑', bus: '버스 정류장', friends: '세 친구' };
const STATE = { cafe: 'doing', store: 'done' };
export function pinAt(key) { return PINS[wide ? 'land' : 'port'][key]; }
export function mountTown() {
  const l = wide ? 'land' : 'port';
  const img = wide ? 't/town-land-v2-night.webp' : 't/town-port-v1-night.webp';
  const pins = Object.entries(PINS[l]).map(([k, [x, y]]) => `<span class="pin" data-k="${k}" ${STATE[k] ? `data-s="${STATE[k]}"` : ''} style="left:${x}%;top:${y}%">${k === 'home' ? `<span class="ic">${ICON.home}</span>` : '<i></i>'}${NAMES[k]}</span>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<main class="town" data-l="${l}">
  <div class="scene" id="scene"><img src="${img}" alt="펠트로 만든 우리 동네">${pins}</div>
  <div class="dim" id="dim"></div>
  <header class="bar"><span class="acct"><img src="t/mongle-smile.webp" alt=""><span><small><i></i>볼로르</small><b>내 계정</b></span></span><span class="sp"></span><button class="road" id="road" type="button">내 길</button><span class="gear">${ICON.gear}</span></header>
  <section class="lobby" id="lobby"><div class="tutor"><span class="pt"><img src="t/friend-mongle.webp" alt=""></span><div><small><b>몽글</b>함께하는 AI 튜터</small><p id="say">어? 왔구나! 오늘은 「주문하기」부터 같이 만나 볼까?</p></div></div><p class="ctx">어제 카페에서 배운 말이 오늘 다시 왔어요.</p><button class="go" type="button">맞춤 연습 시작 ${ICON.arrow}</button><span class="alt">다른 연습 고르기</span></section>
  <nav class="tabs"><span class="on">${ICON.tabHome}우리 동네</span><span>${ICON.book}배우기</span><span>${ICON.pad}놀이</span><span>${ICON.hanger}옷장</span></nav>
 </main>`);
  // 들어오면 이름표가 하나씩 톡톡 뜨고 사진이 4% 다가온다(지금 앱의 동네 움직임)
  gsap.fromTo('#scene', { scale: 1.04 }, { scale: 1, duration: 2.4, ease: 'power2.out' });
  gsap.fromTo('.pin', { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .42, ease: 'back.out(2.4)', stagger: .09, delay: .25 });
  gsap.from('.lobby, .tabs, .bar, .ttl', { opacity: 0, y: 10, duration: .5, ease: 'power2.out', stagger: .05 });
  setTimeout(preloadToday, 900);
  window.__ready = performance.now(); // 녹화 도구가 이때부터 초를 센다
  // 세로 화면: 동네 아래 하늘이 남으면 그 절반(최대 56px)만 내린다(지금 앱의 맞춤 규칙, WORLD 시그널 「맞춤」)
  if (!wide) { const img = $('#scene img'); const fit = () => { const left = $('#lobby').getBoundingClientRect().top - img.offsetHeight * .6; $('#scene').style.top = `${Math.max(0, Math.min(56, left / 2))}px`; }; img.complete ? fit() : img.addEventListener('load', fit, { once: true }); }
}
// 태오 얼굴: 소리 없이 말하는 동그란 영상, 노랑 고리가 말하는 만큼 찬다
export function face(size, extra = '') {
  return `<span class="tf" style="--s:${size}px" ${extra}><span class="in"><video muted loop playsinline preload="auto" src="a/taeo-talk.mp4"></video></span><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="47.5"/><circle class="pg" cx="50" cy="50" r="47.5" pathLength="1"/></svg></span>`;
}
export function playFace(root) {
  const v = $('video', root), pg = $('.pg', root);
  v.currentTime = 1.2;
  v.play().catch(() => {});
  const tick = () => { if (!v.isConnected) return; pg.style.strokeDashoffset = 1 - Math.min(1, v.currentTime / (v.duration || 8)); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return v;
}
// 몽글의 말이 바뀔 때 — 글자가 한 자씩 놓인다(지금 앱 튜터 띠의 말투 글자)
export function retype(el, text) {
  el.textContent = '';
  const chars = [...text];
  chars.forEach((c, i) => setTimeout(() => { el.textContent += c; }, i * 34));
}
// 「오늘」 화면은 동네가 뜬 뒤 미리 불러 둔다 — 그 화면은 동네가 __go를 부를 때까지 멈춰 있다(today.html ?from=entrance).
let ifr = null, loaded = null;
export function preloadToday() {
  if (ifr) return;
  ifr = document.createElement('iframe'); ifr.className = 'today'; ifr.src = 'today.html?from=entrance';
  loaded = new Promise((res) => ifr.addEventListener('load', res, { once: true }));
  document.body.append(ifr);
}
// 누르면 — 누른 자리에서 밝은 메신저 바탕이 동그랗게 화면 가득 열리고(Motion 「Doors」의 원리), 태오 얼굴은 가운데의 영상 메시지 자리로 커진다.
let opened = false;
export async function openToday(from, faceEl) {
  if (opened) return; opened = true;
  preloadToday();
  sfx('whoosh.mp3', .5);
  const r = from.getBoundingClientRect(), f = $('.in', faceEl).getBoundingClientRect();
  const cx = f.left + f.width / 2, cy = f.top + f.height / 2, R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  const door = document.createElement('div'); door.className = 'door';
  door.style.clipPath = `circle(${f.width / 2}px at ${cx}px ${cy}px)`;
  const fly = document.createElement('div'); fly.className = 'fly';
  Object.assign(fly.style, { left: `${f.left}px`, top: `${f.top}px`, width: `${f.width}px`, height: `${f.height}px` });
  const v = $('video', faceEl); fly.append(v); v.play().catch(() => {});
  document.body.append(door, fly);
  gsap.to(door, { clipPath: `circle(${R}px at ${cx}px ${cy}px)`, duration: .75, ease: 'power3.inOut' });
  gsap.to('.town', { scale: .97, duration: .75, ease: 'power3.inOut' });
  await loaded;
  let nr = null; try { nr = ifr.contentWindow.__noteRect?.(); } catch { /* */ }
  if (!nr) { const g = wide ? 444 : 284; nr = { left: innerWidth / 2 - g / 2, top: innerHeight * .42 - g / 2, width: g, height: g }; }
  await new Promise((res) => gsap.to(fly, { left: nr.left, top: nr.top, width: nr.width, height: nr.height, duration: .78, ease: 'power3.inOut', onComplete: res }));
  ifr.classList.add('on');
  try { ifr.contentWindow.__go?.(); } catch { /* */ }
  gsap.to(ifr, { opacity: 1, duration: .25, onComplete: () => { fly.remove(); door.remove(); } });
}
