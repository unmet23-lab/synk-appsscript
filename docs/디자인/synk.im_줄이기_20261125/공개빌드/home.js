/* synk.im 홈 v12. 강의장 화면(서울 시각과 예약된 일), 창 셋(묻기 · 새 소식 · 솔리오 받기), 들어오는 주소, 영상과 큰 synk. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const en = document.documentElement.lang === 'en';
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 날마다 같은 시각에 걸어 둔 일. 예약된 시각을 보이고 끝났는지는 재지 않는다. 새 광고 의뢰 확인은 10분마다 5분에 돈다.
   근거: 저장소 docs/_ops/관문_자동화.md (2026-11-26) */
const J = [
  ['03:30', '회사 자료 백업', 'Data backup'], ['04:00', '복원본 만들기', 'Restore copies'], ['05:00', '잘된 콘텐츠 조사', 'Content research'],
  ['05:10', '지원사업 공고 읽기', 'Grant notice scan'], ['05:30', '서버 암호화 백업', 'Encrypted backup'], ['06:00', '앱 새 판 올리기', 'App updates'],
  ['07:00', '오늘 영상 만들기', 'Today’s videos'], ['08:30', '공모전 찾기', 'Contest search'], ['09:00', '게시물 성과 모으기', 'Post results'],
  ['09:10', '나라별 말로 옮기기', 'Local translations'], ['10:30', '여행 자료 다시 확인', 'Travel data check'], ['10:40', '유학 접수 마감 확인', 'Admission dates'],
  ['12:30', '영상 원본 백업', 'Video backup'], ['13:10', '지원사업 공고 읽기', 'Grant notice scan'], ['14:00', 'SNS 검수와 게시', 'Review and publish'],
  ['15:00', '오늘 영상 만들기', 'Today’s videos'], ['17:00', '앱 새 판 올리기', 'App updates'], ['18:30', '메일 훑어보기', 'Mail scan'],
  ['19:30', '내일 주제 찾기', 'Topic search'], ['20:00', '인기 영상 조사', 'Video research'], ['21:00', '스레드 글 올리기', 'Threads post'],
  ['22:10', '나라별 말로 옮기기', 'Local translations'], ['23:00', '브랜드 광고 조사', 'Ad research'],
].map(x => [+x[0].slice(0, 2) * 60 + +x[0].slice(3), x[0], x[en ? 2 : 1]]);
const T = en ? { now: 'just now', ten: 'every 10 min', ad: 'Ad requests' } : { now: '방금', ten: '10분마다', ad: '새 광고 의뢰 확인' };
const p2 = n => String(n).padStart(2, '0');
const later = m => { const h = Math.floor(m / 60), r = m % 60; return en ? 'in ' + (h ? h + 'h' + (r ? ' ' + r + 'm' : '') : r + ' min') : (h ? h + '시간' + (r ? ' ' + r + '분' : '') : r + '분') + ' 뒤'; };
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const scr = $('.scr');
let shown = '';
function tick() {
  const [h, m, s] = clock.format(new Date()).split(':'), k = h + ':' + m;
  $('.sec', scr).textContent = s;
  if (k === shown) return;
  shown = k; $('.now', scr).textContent = k;
  const n = +h * 60 + +m, gap = x => (x - n + 1440) % 1440, past = x => (n - x + 1440) % 1440;
  let i = J.findIndex(x => x[0] > n); if (i < 0) i = 0;
  const a = J[(i + J.length - 1) % J.length], b = J[i], c = J[(i + 1) % J.length];
  const q = (Math.floor((n - 5) / 10) * 10 + 5 + 1440) % 1440;
  const first = past(a[0]) <= past(q) ? [a[1], a[2], T.now] : [p2(Math.floor(q / 60)) + ':' + p2(q % 60), T.ad, T.ten];
  $('.jb', scr).replaceChildren(...[first, [b[1], b[2], later(gap(b[0]))], [c[1], c[2], later(gap(c[0]))]].map(x => {
    const li = document.createElement('li');
    ['time', 'span', 'em'].forEach((t, j) => li.appendChild(document.createElement(t)).textContent = x[j]);
    return li;
  }));
  $('.pg i', scr).style.width = past(a[0]) / (past(a[0]) + gap(b[0])) * 100 + '%';
  scr.classList.add('on'); fit();
}
/* 이름이 잘리면 남은 시간 칸을 세 줄에서 함께 뺀다 */
function fit() { scr.classList.remove('tight'); scr.classList.toggle('tight', $$('.jb span', scr).some(x => x.scrollWidth > x.clientWidth + 1)); }
tick(); setInterval(tick, 1000);
if ('ResizeObserver' in window) new ResizeObserver(fit).observe(scr);
document.fonts?.ready.then(fit);

/* 영상: 움직임 줄이기면 멈춘 그림, 화면 밖이면 쉰다 */
const film = $('.k3 video');
if (calm) { film.removeAttribute('autoplay'); film.pause(); }
else if ('IntersectionObserver' in window) new IntersectionObserver(e => { e[e.length - 1].isIntersecting ? film.play().catch(() => {}) : film.pause(); }, { threshold: .05 }).observe(film);

/* 맨 아래 큰 synk */
const wm = $('.wm');
if ('IntersectionObserver' in window) { wm.classList.add('io'); new IntersectionObserver((e, o) => { if (e.some(x => x.isIntersecting)) { wm.classList.add('on'); o.disconnect(); } }, { threshold: .2 }).observe(wm); }

/* 창: 다른 쪽이 부르는 /#platform · /#now · /#contact도 이 창을 연다 */
const SHEET = { ask: ['ask', 'contact', 'contact-web', 'questions'], now: ['now', 'news'], platform: ['platform', 'platform-get', 'start'] };
const sheetOf = id => Object.keys(SHEET).find(k => SHEET[k].includes(id));
let back = null;
function open(k, from) {
  const d = $('#sheet-' + k);
  if (!d) return d;
  /* 이미 열린 창을 다시 부르면(답의 「문의하기」) 맨 위로 올리고 첫 링크에 선다 */
  if (d.open) { d.scrollTop = 0; $('.head a, .pf-get a, li a', d)?.focus({ preventScroll: true }); return d; }
  $$('.sheet[open]').forEach(x => x.close());
  back = from || back;
  d.showModal(); d.scrollTop = 0;
  return d;
}
$$('.sheet').forEach(d => {
  d.addEventListener('close', () => { if ($('.sheet[open]')) return; if (sheetOf(location.hash.slice(1))) history.replaceState(null, '', location.pathname + location.search); back?.focus?.(); back = null; });
});
$$('[data-sheet]').forEach(b => b.addEventListener('click', () => open(b.dataset.sheet, b)));
/* 창을 닫되 초점을 돌려보내지 않는다(쪽의 다른 자리로 갈 때) */
const leave = () => { const d = $('.sheet[open]'); if (d) { back = null; d.close(); } };
/* 같은 쪽 주소: 창을 가리키면 그 창으로, 쪽의 자리를 가리키면 창을 닫고 그 자리로. 사업자 정보 단추는 묻기 창으로 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-ask-q],[data-ask-record]') && !e.target.closest('#sheet-ask')) open('ask', e.target.closest('button'));
  const a = e.target.closest('a[href*="#"]');
  if (!a || a.target || a.origin !== location.origin || a.pathname !== location.pathname || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const k = sheetOf(a.hash.slice(1));
  if (k) { e.preventDefault(); open(k); } else leave();
}, true);
const byHash = () => { const k = sheetOf(location.hash.slice(1)); if (k) open(k); else leave(); };
/* 브라우저도 주소 자리로 창 안을 내린다 — 다 불러온 뒤 한 번 맨 위로 되돌린다(그사이 사람이 움직였으면 그대로 둔다) */
let touched = false;
for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(e, () => { touched = true; }, { passive: true, once: true });
const toTop = () => { const d = $('.sheet[open]'); if (d && !touched) d.scrollTop = 0; };
addEventListener('hashchange', () => { byHash(); requestAnimationFrame(toTop); }); byHash();
addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(toTop)));

const out = $('#ask-out');
$('#ask-copy')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('hello@synk.im'); out.textContent = en ? 'Email address copied.' : '이메일 주소를 복사했습니다.'; }
  catch { out.textContent = en ? 'Copying is not available. The address is hello@synk.im.' : '복사하지 못했습니다. 주소는 hello@synk.im입니다.'; }
});
