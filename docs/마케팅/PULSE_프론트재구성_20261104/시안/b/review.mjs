// B 콘택트 시트 2판 — 시안 확인. 편집 책상: 왼쪽에 영상, 오른쪽에 두 판을 초별로 인화해 위아래로 놓는다. 기본은 달라진 곳만 크게, 나머지는 접어 둔다. 의견은 그리스 펜 표시로 그 장면 위에 남는다.
import { REVIEW, M, fmt, fmtShort, reduced, trapTab } from '../shared/copy.mjs';
import { createReview, bindFilm, bindKeys } from '../shared/review-core.mjs';

const R = createReview(), s = R.s;
const pad = (n) => String(n).padStart(2, '0');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CH = REVIEW.changed;
const ARW = '<svg class="arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const secs = Array.from({ length: REVIEW.duration }, (_, i) => i);
const same = (i) => i < CH.from || i >= CH.to;
const fold = (v, from, to) => `<button type="button" class="fold" data-unfold tabindex="${v.id === 'v2' ? 0 : -1}" aria-label="${from}초부터 ${to}초까지 펼치기"><img src="${v.sec}s${pad(from + 1)}.webp" alt="" decoding="async"><span>${from}~${to}초<br>그대로</span></button>`;
const stripHTML = (v) => `<div class="strip" data-strip="${v.id}">
  <p class="strip-name">${v.label}${v.note ? `<span> · ${v.note}</span>` : ''}</p>
  <div class="frames">${fold(v, 0, CH.from)}${secs.map((i) => `<button type="button" class="fr${same(i) ? ' is-same' : ' is-changed'}" data-sec="${i}" data-v="${v.id}" tabindex="${v.id === 'v2' && !same(i) ? 0 : -1}" aria-label="${v.label} ${i}초"><img src="${v.sec}s${pad(i + 1)}.webp" alt="" decoding="async"></button>`).join('')}${fold(v, CH.to, REVIEW.duration)}</div>
</div>`;
// 그리스 펜: 사람이 그린 듯 조금 삐뚤게 네모를 두른다.
const penPath = 'M5 7C30 4 70 3 96 5c1 28 1 60-1 90-28 2-60 2-90 1C3 68 3 36 4 4';

const app = document.getElementById('app');
app.innerHTML = `
  <header class="bar">
    <a class="logo" href="./"><img src="${M('brand/brand-pulse.webp')}" alt="SYNK PULSE" width="154" height="41"></a>
    <p class="proj"><b>${REVIEW.project}</b></p>
    <nav class="stages" aria-label="단계">${REVIEW.stages.map((n, i) => `<span class="${i === REVIEW.stageAt ? 'is-now' : i < REVIEW.stageAt ? 'is-done' : 'is-next'}"${i === REVIEW.stageAt ? ' aria-current="step"' : ''}>${n}</span>`).join('')}</nav>
    <button type="button" class="ask" data-ask>${REVIEW.ask}</button>
  </header>
  <main class="desk">
    <section class="stage">
      <div class="films">
        <figure class="film-box" data-box="main"><video class="film" data-main playsinline preload="auto" poster="${R.current().sec}s${pad(REVIEW.startAt + 1)}.webp" src="${R.current().src}"></video><figcaption data-main-label></figcaption><button type="button" class="bigplay" data-play><i></i><span>재생</span></button></figure>
        <figure class="film-box is-other" data-box="other" hidden><video class="film" data-other playsinline muted preload="metadata" src="${REVIEW.versions[0].src}"></video><figcaption>${REVIEW.versions[0].label}</figcaption></figure>
      </div>
      <div class="transport">
        <span class="mono tc" data-tc>00:00.00</span>
        <span class="scene-name" data-scene-name></span>
        <button type="button" class="link vs" data-compare>나란히 보기</button>
      </div>
    </section>
    <section class="table">
      <h1 class="say" data-say-head></h1>
      <p class="memo"><b>${REVIEW.owner}</b> ${REVIEW.memo}</p>
      <div class="sheets" data-sheets data-allow-overflow>
        <div class="sheets-in" data-sheets-in>
          <div class="bracket" data-bracket aria-hidden="true"><span>달라진 곳 ${CH.from}~${CH.to}초</span></div>
          ${stripHTML(REVIEW.versions[0])}
          ${stripHTML(REVIEW.versions[1])}
          <svg class="pens" data-pens aria-hidden="true"></svg>
        </div>
      </div>
      <button type="button" class="link all" data-all>${REVIEW.duration}초 전체 보기</button>
      <div class="compose" data-compose>
        <label><span class="mono" data-compose-at>00:00</span><span class="sr">${REVIEW.noteLabel}</span><input name="text" type="text" maxlength="1000" autocomplete="off" placeholder="${REVIEW.noteLabel}"></label>
        <button type="button" class="link" data-add>남기기</button>
      </div>
      <ol class="notes" data-notes></ol>
      <p class="demo">${REVIEW.disclaimer}</p>
    </section>
  </main>
  <footer class="decide">
    <p data-decide-hint></p>
    <div class="decide-act"><a class="link" href="${R.current().src}" download data-file>${REVIEW.file}</a><button type="button" class="cta" data-decide><span data-decide-label></span>${ARW}</button></div>
  </footer>
  <div class="sheet" data-sheet hidden role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-in">
      <p class="sheet-ver" data-sheet-ver></p>
      <h2 id="sheet-title">${REVIEW.approve.dialogTitle}</h2>
      <p>${REVIEW.approve.dialogText}</p>
      <p class="dim">${REVIEW.approve.dialogNote}</p>
      <div class="sheet-act"><button type="button" class="link" data-sheet-back>${REVIEW.approve.back}</button><button type="button" class="cta" data-sheet-ok><span>${REVIEW.approve.confirm}</span>${ARW}</button></div>
    </div>
  </div>`;

const $ = (q) => app.querySelector(q), $$ = (q) => [...app.querySelectorAll(q)];
const main = $('[data-main]'), other = $('[data-other]');
const film = bindFilm(R, main, { follower: other });
bindKeys(film, R);
let noteAt = 0;
main.addEventListener('click', () => film.toggle());
$('[data-play]').addEventListener('click', () => film.toggle());

function renderHead() {
  const v = R.current();
  const asked = R.notesFor('v1').filter((n) => n.who !== '나').length;
  const done = R.notesFor('v2').filter((n) => !n.mine).length;
  $('[data-say-head]').textContent = v.id === 'v2'
    ? `${v.label}이에요. 지난 의견 ${asked}개 중 ${done}개를 반영했고, 달라진 곳은 ${CH.from}~${CH.to}초예요.`
    : `${v.label}이에요. 지금 보고 계신 판은 수정 전이에요.`;
  $('[data-main-label]').textContent = `${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-sheet-ver]').textContent = `${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-file]').href = v.src;
  $$('[data-strip]').forEach((el) => el.classList.toggle('is-current', el.dataset.strip === v.id));
}
function renderNotes() {
  const v1 = R.notesFor('v1'), v2 = R.notesFor('v2');
  const pairs = v1.map((n, i) => ({ q: n, a: v2.filter((m) => !m.mine)[i] }));
  const mine = s.sent.filter((n) => n.who === '나');
  $('[data-notes]').innerHTML = [
    ...s.drafts.map((d) => `<li class="note is-draft"><button type="button" class="at mono" data-go="${d.at}">${fmtShort(d.at)}</button><p>${esc(d.text)}</p><button type="button" class="link rm" data-rm="${d.id}">빼기</button></li>`),
    ...mine.map((n) => `<li class="note"><button type="button" class="at mono" data-go="${n.at}">${fmtShort(n.at)}</button><p>${esc(n.text)}</p><span class="state dim">보냈어요</span></li>`),
    ...pairs.filter((p) => p.q.who !== '나').map((p) => `<li class="note is-pair"><button type="button" class="at mono" data-go="${p.q.at}">${fmtShort(p.q.at)}</button><div><p class="q">${esc(p.q.text)}</p>${p.a ? `<p class="a"><b>${esc(p.a.who)}</b> ${esc(p.a.text)}</p>` : ''}</div><span class="state">반영</span></li>`),
  ].join('');
  const n = s.drafts.length;
  $('[data-decide-label]').textContent = s.approved ? REVIEW.approve.done : n ? REVIEW.approve.send(n) : REVIEW.approve.label;
  $('[data-decide-hint]').textContent = s.approved ? '' : s.justSent ? REVIEW.approve.sent : n ? '보내기 전까지는 저희에게 보이지 않아요.' : REVIEW.approve.question;
  $('[data-decide]').classList.toggle('is-done', s.approved);
  drawPens();
}
// 펜 자국과 「달라진 곳」 괄호는 지금 보이는 칸의 자리를 재서 놓는다. 띠 안쪽 상자를 기준으로 재므로 띠를 밀어도 어긋나지 않는다.
function place() {
  const box = $('[data-sheets-in]').getBoundingClientRect();
  const first = app.querySelector(`[data-v="v2"][data-sec="${CH.from}"]`).getBoundingClientRect();
  const last = app.querySelector(`[data-v="v2"][data-sec="${CH.to - 1}"]`).getBoundingClientRect();
  const br = $('[data-bracket]');
  br.style.setProperty('--l', `${first.left - box.left}px`);
  br.style.setProperty('--w', `${last.right - first.left}px`);
}
function drawPens() {
  place();
  const svg = $('[data-pens]'), box = $('[data-sheets-in]').getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const old = new Set([...svg.querySelectorAll('[data-key]')].map((p) => p.dataset.key));
  const want = [
    ...s.sent.filter((n) => n.who === '나').map((n, k) => ({ v: n.version, at: n.at, key: `s-${n.version}-${n.at}`, no: k + 1 })),
    ...s.drafts.map((d, k) => ({ v: d.version, at: d.at, key: `d-${d.id}`, no: s.sent.filter((n) => n.who === '나').length + k + 1 })),
  ];
  svg.textContent = '';
  for (const w of want) {
    const fr = app.querySelector(`[data-v="${w.v}"][data-sec="${Math.floor(w.at)}"]`);
    if (!fr || !fr.offsetWidth) continue;
    const r = fr.getBoundingClientRect(), g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const x = r.left - box.left - 3, y = r.top - box.top - 3;
    g.setAttribute('transform', `translate(${x} ${y}) scale(${((r.width + 6) / 100).toFixed(3)} ${((r.height + 6) / 100).toFixed(3)})`);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', penPath); p.setAttribute('class', 'pen'); p.dataset.key = w.key; p.setAttribute('pathLength', '1'); p.setAttribute('vector-effect', 'non-scaling-stroke');
    if (!old.has(w.key) && !reduced()) p.classList.add('is-new');
    g.append(p); svg.append(g);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', String(x + 7)); t.setAttribute('y', String(y + 19)); t.setAttribute('class', 'pen-no'); t.textContent = String(w.no);
    svg.append(t);
  }
}
let lastSec = -1, lastVer = '';
function renderTime() {
  $('[data-tc]').textContent = fmt(s.t);
  $('[data-scene-name]').textContent = R.scene(s.t).title;
  if (document.activeElement?.tagName !== 'INPUT') { noteAt = Math.round(s.t * 10) / 10; $('[data-compose-at]').textContent = fmtShort(noteAt); }
  const sec = Math.floor(s.t);
  if (sec === lastSec && s.version === lastVer) return;
  lastSec = sec; lastVer = s.version;
  $$('.fr').forEach((f) => f.classList.toggle('is-at', Number(f.dataset.sec) === sec && f.dataset.v === s.version));
  // 휴대폰에서는 띠가 옆으로 길어 지금 칸이 화면 밖에 있을 수 있다.
  const sheets = $('[data-sheets]'), at = app.querySelector('.fr.is-at');
  if (at?.offsetWidth && sheets.scrollWidth > sheets.clientWidth + 1) { const b = sheets.getBoundingClientRect(), r = at.getBoundingClientRect(); if (r.left < b.left + 8 || r.right > b.right - 8) sheets.scrollBy({ left: r.left - b.left - b.width / 2 + r.width / 2, behavior: reduced() ? 'auto' : 'smooth' }); }
}
R.on((what) => {
  if (what === 'time') renderTime();
  if (what === 'notes') renderNotes();
  if (what === 'version') { renderHead(); renderNotes(); renderTime(); }
  if (what === 'play') document.body.classList.toggle('is-playing', s.playing);
  if (what === 'approved') { renderNotes(); document.body.classList.add('is-approved'); }
});
function add() { const input = $('[data-compose] input'); if (R.addDraft(noteAt, input.value)) { input.value = ''; input.blur(); } }
$('[data-compose] input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
$('[data-compose] input').addEventListener('focus', () => { if (s.playing) main.pause(); });
const toggleAll = (on) => { document.body.classList.toggle('is-all', on); $$('.fr.is-same').forEach((f) => { f.tabIndex = -1; }); $('[data-all]').textContent = on ? '달라진 곳만 보기' : `${REVIEW.duration}초 전체 보기`; drawPens(); };
app.addEventListener('click', (e) => {
  // 나란히 보기에서는 어느 띠를 눌러도 왼쪽 2차 · 오른쪽 1차를 그대로 두고 시간만 옮긴다.
  const fr = e.target.closest('.fr'); if (fr) { const at = Number(fr.dataset.sec) + 0.5; if (!s.compare && fr.dataset.v !== s.version) { R.setVersion(fr.dataset.v); film.load(R.current().src, at); } else film.seek(at); noteAt = at; $('[data-compose-at]').textContent = fmtShort(noteAt); $('[data-compose] input').focus(); return; }
  if (e.target.closest('[data-unfold]')) { toggleAll(true); return; }
  if (e.target.closest('[data-all]')) { toggleAll(!document.body.classList.contains('is-all')); return; }
  const go = e.target.closest('[data-go]'); if (go) { film.seek(Number(go.dataset.go)); return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { R.removeDraft(Number(rm.dataset.rm)); return; }
  if (e.target.closest('[data-add]')) { add(); return; }
  if (e.target.closest('[data-compare]')) { R.setCompare(!s.compare); document.body.classList.toggle('is-compare', s.compare); $('[data-box=other]').hidden = !s.compare; if (s.compare) { other.currentTime = s.t; if (s.playing) other.play().catch(() => {}); } else other.pause(); e.target.closest('[data-compare]').textContent = s.compare ? '한 편만 보기' : '나란히 보기'; requestAnimationFrame(drawPens); setTimeout(drawPens, 300); return; }
  if (e.target.closest('[data-decide]')) { if (s.approved) return; if (s.drafts.length) R.send(); else openSheet(); return; }
  if (e.target.closest('[data-sheet-back]')) { closeSheet(); return; }
  if (e.target.closest('[data-sheet-ok]')) { closeSheet(); R.approve(); return; }
  if (e.target.closest('[data-ask]')) { const input = $('[data-compose] input'); input.placeholder = `${REVIEW.owner}에게 물을 말`; input.focus(); return; }
});
let sheetOpener = null;
trapTab($('[data-sheet]'));
function openSheet() { const sh = $('[data-sheet]'); sheetOpener = document.activeElement; sh.hidden = false; requestAnimationFrame(() => sh.classList.add('is-on')); sh.querySelector('[data-sheet-ok]').focus(); if (s.playing) main.pause(); }
function closeSheet() { const sh = $('[data-sheet]'); sh.classList.remove('is-on'); setTimeout(() => { sh.hidden = true; }, reduced() ? 0 : 340); sheetOpener?.focus?.(); }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('[data-sheet]').hidden) closeSheet(); });
addEventListener('resize', drawPens);
document.fonts?.ready.then(drawPens);
renderHead(); renderNotes();
const q = new URLSearchParams(location.search).get('t');
film.seek(q ? Number(q) : REVIEW.startAt);
renderTime();
requestAnimationFrame(() => { drawPens(); document.body.classList.add('is-ready'); });
