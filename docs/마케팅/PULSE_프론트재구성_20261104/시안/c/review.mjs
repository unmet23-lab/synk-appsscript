// C 한글 창 2판 — 시안 확인. 영상이 가장 크고, 그 옆의 큰 글자는 지금 몇 초인지다. 숫자를 끌면 영상이 따라오고, 그 자리에서 말을 남긴다. 맨 아래 띠에서 정한다.
import { REVIEW, M, fmtShort, reduced, trapTab } from '../shared/copy.mjs';
import { createReview, bindFilm, bindKeys, scrubber } from '../shared/review-core.mjs';

const R = createReview(), s = R.s;
const pad = (n) => String(n).padStart(2, '0');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const arrow = '<svg class="arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const CH = REVIEW.changed;
const app = document.getElementById('app');
app.innerHTML = `
  <header class="top">
    <a class="logo" href="./"><img src="${M('brand/logo-paper.webp')}" alt="SYNK PULSE" width="164" height="44"></a>
    <p class="proj">${REVIEW.project}</p>
    <nav class="stages" aria-label="단계">${REVIEW.stages.map((n, i) => `<span class="${i === REVIEW.stageAt ? 'is-now' : i < REVIEW.stageAt ? 'is-done' : 'is-next'}"${i === REVIEW.stageAt ? ' aria-current="step"' : ''}>${n}</span>`).join('')}</nav>
    <button type="button" class="ask" data-ask>${REVIEW.ask}</button>
  </header>
  <main class="wrap">
    <div class="films">
      <figure class="film-box"><video class="film" data-main playsinline preload="auto" poster="${R.current().sec}s${pad(REVIEW.startAt + 1)}.webp" src="${R.current().src}"></video><figcaption data-main-label></figcaption><button type="button" class="pp" data-play><i></i><span>재생</span></button></figure>
      <figure class="film-box is-other" data-other-box hidden><video class="film" data-other playsinline muted preload="metadata" src="${REVIEW.versions[0].src}"></video><figcaption>${REVIEW.versions[0].label}</figcaption></figure>
    </div>
    <section class="board">
      <div class="clock" data-clock role="slider" tabindex="0" aria-label="영상 시간. 좌우로 끌어 옮겨요" aria-valuemin="0" aria-valuemax="${REVIEW.duration}" aria-valuenow="0"><span class="digits" data-digits>00</span><span class="unit">초</span><span class="of">끌어서 옮겨요</span></div>
      <div class="ticks" data-ticks aria-hidden="true">${Array.from({ length: REVIEW.duration + 1 }, (_, i) => `<i class="t${i >= CH.from && i <= CH.to ? ' is-changed' : ''}"></i>`).join('')}<b class="ph" data-ph></b><span class="tl" data-at="0">0</span><span class="tl" data-at="5">5</span><span class="tl" data-at="10">10</span><span class="tl" data-at="15">15</span></div>
      <p class="scene" data-scene></p>
      <p class="line" data-line></p>
      <p class="memo"><b>${REVIEW.owner}</b> ${REVIEW.memo}</p>
      <div class="vers" role="group" aria-label="시안">${REVIEW.versions.map((v) => `<button type="button" data-ver="${v.id}">${v.label}</button>`).join('')}<button type="button" data-compare class="vs">나란히 보기</button><a href="${R.current().src}" download data-file class="vs">${REVIEW.file}</a></div>
      <form class="say" data-say><label class="sr" for="c-say">${REVIEW.noteLabel}</label><input id="c-say" name="text" type="text" maxlength="1000" autocomplete="off" placeholder="${REVIEW.noteLabel}"><button type="submit">남기기</button></form>
      <p class="sent" data-sent hidden>${REVIEW.approve.sent}</p>
      <ol class="notes" data-notes></ol>
      <p class="demo">${REVIEW.disclaimer}</p>
    </section>
  </main>
  <button type="button" class="band" data-decide><span data-decide-label></span>${arrow}</button>
  <div class="sheet" data-sheet hidden role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-in">
      <h2 id="sheet-title">${REVIEW.approve.dialogTitle}</h2>
      <p class="sv" data-sheet-ver></p>
      <p>${REVIEW.approve.dialogText}</p>
      <p class="dim">${REVIEW.approve.dialogNote}</p>
      <div class="sheet-act"><button type="button" class="back" data-sheet-back>${REVIEW.approve.back}</button><button type="button" class="ok" data-sheet-ok><span>${REVIEW.approve.confirm}</span>${arrow}</button></div>
    </div>
  </div>`;
const $ = (q) => app.querySelector(q), $$ = (q) => [...app.querySelectorAll(q)];
const main = $('[data-main]'), other = $('[data-other]');
const film = bindFilm(R, main, { follower: other });
bindKeys(film, R);
main.addEventListener('click', () => film.toggle());
$('[data-play]').addEventListener('click', () => film.toggle());
// 큰 숫자는 잡는 순간 튀지 않고, 끈 만큼만 옮긴다.
const clock = $('[data-clock]'); let drag = null;
clock.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: s.t, perSec: clock.parentElement.clientWidth / s.duration }; clock.setPointerCapture?.(e.pointerId); });
clock.addEventListener('pointermove', (e) => { if (drag) film.seek(drag.t + (e.clientX - drag.x) / drag.perSec); });
const endDrag = () => { drag = null; };
clock.addEventListener('pointerup', endDrag); clock.addEventListener('pointercancel', endDrag);
scrubber($('[data-ticks]'), { duration: () => s.duration, onSeek: (t) => film.seek(t) });
$('[data-clock]').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.stopPropagation(); film.seek(s.t - 1); } if (e.key === 'ArrowRight') { e.stopPropagation(); film.seek(s.t + 1); } });

function renderVer() {
  const v = R.current();
  const asked = R.notesFor('v1').filter((n) => n.who !== '나').length, done = R.notesFor('v2').filter((n) => !n.mine).length;
  $$('[data-ver]').forEach((b) => { const on = b.dataset.ver === v.id; b.classList.toggle('is-now', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $('[data-line]').textContent = v.id === 'v2' ? `${v.label}이에요. 지난 의견 ${asked}개 중 ${done}개를 반영했고, 달라진 곳은 ${CH.from}~${CH.to}초예요.` : `${v.label}이에요. 수정 전 판이에요.`;
  $('[data-main-label]').textContent = `${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-sheet-ver]').textContent = `${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-file]').href = v.src;
}
function renderNotes() {
  const v = R.current();
  const rows = [...s.drafts.map((d) => ({ ...d, draft: true })), ...s.sent].sort((a, b) => a.at - b.at);
  $('[data-notes]').innerHTML = rows.map((n) => `<li class="${n.draft ? 'is-draft' : ''}"><button type="button" class="at mono" data-seek="${n.at}">${fmtShort(n.at)}</button><div><p class="who">${n.draft ? '보내기 전' : esc(n.who)}${!n.draft && n.version !== v.id ? ` · ${REVIEW.versions.find((x) => x.id === n.version).short}` : ''}</p><p>${esc(n.text)}</p></div>${n.draft ? `<button type="button" class="rm" data-rm="${n.id}">빼기</button>` : ''}</li>`).join('');
  const c = s.drafts.length;
  $('[data-decide-label]').textContent = s.approved ? REVIEW.approve.done : c ? REVIEW.approve.send(c) : REVIEW.approve.label;
  $('[data-decide]').classList.toggle('is-done', s.approved);
  $('[data-sent]').hidden = !s.justSent;
}
function renderTime() {
  const sec = Math.floor(s.t);
  const d = $('[data-digits]'); if (d.textContent !== pad(sec)) d.textContent = pad(sec);
  $('[data-ph]').style.setProperty('--p', String(s.t / (s.duration || 15)));
  $('[data-scene]').textContent = R.scene(s.t).title;
  const c = $('[data-clock]'); c.setAttribute('aria-valuenow', String(sec)); c.setAttribute('aria-valuetext', fmtShort(s.t));
  $$('[data-notes] li').forEach((li) => { const b = li.querySelector('[data-seek]'); li.classList.toggle('is-near', b && Math.abs(Number(b.dataset.seek) - s.t) < 0.8); });
}
R.on((what) => {
  if (what === 'time') renderTime();
  if (what === 'notes') renderNotes();
  if (what === 'version') { renderVer(); renderNotes(); }
  if (what === 'play') document.body.classList.toggle('is-playing', s.playing);
  if (what === 'approved') { renderNotes(); document.body.classList.add('is-approved'); }
});
app.addEventListener('click', (e) => {
  const seek = e.target.closest('[data-seek]'); if (seek) { film.seek(Number(seek.dataset.seek)); return; }
  const ver = e.target.closest('[data-ver]'); if (ver) { if (s.compare) setCompare(false); if (ver.dataset.ver !== s.version) { R.setVersion(ver.dataset.ver); film.load(R.current().src, s.t); } return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { R.removeDraft(Number(rm.dataset.rm)); return; }
  if (e.target.closest('[data-compare]')) { setCompare(!s.compare); return; }
  if (e.target.closest('[data-decide]')) { if (s.approved) return; if (s.drafts.length) R.send(); else openSheet(); return; }
  if (e.target.closest('[data-sheet-back]')) { closeSheet(); return; }
  if (e.target.closest('[data-sheet-ok]')) { closeSheet(); R.approve(); return; }
  if (e.target.closest('[data-ask]')) { const input = $('[data-say] input'); input.placeholder = `${REVIEW.owner}에게 물을 말`; input.focus(); return; }
});
$('[data-say]').addEventListener('submit', (e) => { e.preventDefault(); const input = e.target.text; if (R.addDraft(Math.round(s.t * 10) / 10, input.value)) input.value = ''; input.blur(); });
$('[data-say] input').addEventListener('focus', () => { if (s.playing) main.pause(); });
// 나란히 보기는 언제나 왼쪽 2차 · 오른쪽 1차다.
function setCompare(on) {
  R.setCompare(on); document.body.classList.toggle('is-compare', on); $('[data-other-box]').hidden = !on;
  if (on) { if (s.version !== 'v2') { R.setVersion('v2'); film.load(R.current().src, s.t); } other.currentTime = s.t; if (s.playing) other.play().catch(() => {}); } else other.pause();
  $('[data-compare]').textContent = on ? '한 편만 보기' : '나란히 보기';
}
let sheetOpener = null;
trapTab($('[data-sheet]'));
function openSheet() { const sh = $('[data-sheet]'); sheetOpener = document.activeElement; sh.hidden = false; requestAnimationFrame(() => sh.classList.add('is-on')); sh.querySelector('[data-sheet-ok]').focus(); if (s.playing) main.pause(); }
function closeSheet() { const sh = $('[data-sheet]'); sh.classList.remove('is-on'); setTimeout(() => { sh.hidden = true; }, reduced() ? 0 : 340); sheetOpener?.focus?.(); }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('[data-sheet]').hidden) closeSheet(); });
renderVer(); renderNotes();
const q = new URLSearchParams(location.search).get('t');
film.seek(q ? Number(q) : REVIEW.startAt);
renderTime();
