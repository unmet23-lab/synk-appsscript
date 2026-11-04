// A 시사실 2판 — 시안 확인. 어두운 방에 영상 한 편, 아래는 초별 프레임 띠(달라진 곳만 밝게), 말하고 정하는 것은 모두 오른쪽 한 기둥에. 손을 놓으면 영상만 남는다.
import { REVIEW, M, fmtShort, fmt, reduced, trapTab } from '../shared/copy.mjs';
import { createReview, bindFilm, bindKeys, scrubber } from '../shared/review-core.mjs';

const R = createReview(), s = R.s;
const app = document.getElementById('app');
const secSrc = (v, n) => `${v.sec}s${String(Math.min(15, Math.max(1, n))).padStart(2, '0')}.webp`;
const arrow = '<svg class="arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const CH = REVIEW.changed;
const START = REVIEW.startAt; // 수정본은 달라진 곳에서 시작한다.
app.innerHTML = `
  <div class="room">
    <div class="films">
      <figure class="film-box is-main"><video class="film" data-main playsinline preload="auto" poster="${secSrc(R.current(), START + 1)}" src="${R.current().src}"></video><figcaption class="film-label small" data-main-label></figcaption><button type="button" class="bigplay" data-play><i></i><span>재생</span></button></figure>
      <figure class="film-box is-other" hidden><video class="film" data-other playsinline muted preload="metadata" src="${REVIEW.versions[0].src}"></video><figcaption class="film-label small">${REVIEW.versions[0].label}</figcaption></figure>
    </div>

    <header class="left">
      <a class="logo" href="./"><img src="${M('brand/logo-paper.webp')}" alt="SYNK PULSE" width="164" height="44"></a>
      <div class="credit">
        <h1 class="serif">${REVIEW.project}</h1>
        <p class="small" data-ver-line></p>
        <p class="memo"><span class="small">담당자 ${REVIEW.owner}</span>${REVIEW.memo}</p>
      </div>
      <div class="left-foot">
        <nav class="stages small" aria-label="단계">${REVIEW.stages.map((n, i) => `<span class="${i === REVIEW.stageAt ? 'is-now' : i < REVIEW.stageAt ? 'is-done' : ''}"${i === REVIEW.stageAt ? ' aria-current="step"' : ''}>${n}</span>`).join('')}</nav>
        <p class="demo small">${REVIEW.disclaimer}</p>
      </div>
    </header>

    <aside class="right">
      <div class="vers small" role="group" aria-label="시안">${REVIEW.versions.map((v) => `<button type="button" data-ver="${v.id}">${v.label}</button>`).join('')}<button type="button" data-compare class="vs">나란히 보기</button></div>
      <p class="changed" data-changed></p>
      <form class="say" data-say>
        <label><span class="mono tc" data-tc>00:00.00</span><span class="sr">${REVIEW.noteLabel}</span><input name="text" type="text" maxlength="1000" autocomplete="off" placeholder="${REVIEW.noteLabel}"></label>
        <button type="submit" class="small">남기기</button>
      </form>
      <ol class="notes" data-notes></ol>
      <p class="memo-m"><span class="small">담당자 ${REVIEW.owner}</span>${REVIEW.memo}</p>
      <p class="demo-m small">${REVIEW.disclaimer}</p>
      <p class="small sent-line" data-sent hidden>${REVIEW.approve.sent}</p>
      <div class="decide">
        <p class="small" data-decide-hint></p>
        <button type="button" class="go is-solid" data-decide><span data-decide-label>${REVIEW.approve.label}</span>${arrow}</button>
        <div class="decide-sub small"><a href="${R.current().src}" download data-file>${REVIEW.file}</a><button type="button" data-ask>${REVIEW.ask}</button></div>
      </div>
    </aside>

    <div class="bottom">
      <div class="diff small" data-diff>달라진 곳 <span class="mono">${fmtShort(CH.from)}~${fmtShort(CH.to)}</span></div>
      <div class="line" data-line role="slider" tabindex="0" aria-label="영상 시간" aria-valuemin="0" aria-valuemax="15" aria-valuenow="0">
        <div class="cells" data-cells aria-hidden="true">${Array.from({ length: 15 }, (_, i) => `<img class="cell${i >= CH.from && i < CH.to ? ' is-diff' : ''}" alt="" decoding="async" src="${secSrc(R.current(), i + 1)}">`).join('')}</div>
        <i class="head" data-head></i>
        <div class="marks" data-marks></div>
        <figure class="peek" data-peek hidden><img alt=""><figcaption class="mono"></figcaption></figure>
      </div>
      <ol class="scenes small">${REVIEW.scenes.map((c) => `<li data-scene="${c.no}"><button type="button" data-seek="${c.from}">${c.title}</button></li>`).join('')}</ol>
    </div>
  </div>
  <div class="sheet" data-sheet hidden role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-in">
      <h2 class="serif" id="sheet-title">${REVIEW.approve.dialogTitle}</h2>
      <p class="sheet-ver small" data-sheet-ver></p>
      <p class="body">${REVIEW.approve.dialogText}</p>
      <p class="small">${REVIEW.approve.dialogNote}</p>
      <div class="sheet-act"><button type="button" class="go is-solid" data-sheet-ok><span>${REVIEW.approve.confirm}</span>${arrow}</button><button type="button" class="small sheet-back" data-sheet-back>${REVIEW.approve.back}</button></div>
    </div>
  </div>`;

const $ = (q) => app.querySelector(q);
const main = $('[data-main]'), other = $('[data-other]');
const film = bindFilm(R, main, { follower: other });
bindKeys(film, R);
main.addEventListener('click', () => film.toggle());
$('[data-play]').addEventListener('click', () => film.toggle());

// 그리기
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderVer() {
  const v = R.current();
  app.querySelectorAll('[data-ver]').forEach((b) => { const on = b.dataset.ver === v.id; b.classList.toggle('is-now', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $('[data-ver-line]').textContent = `${REVIEW.stage} · ${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-main-label]').textContent = `${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-sheet-ver]').textContent = `${v.label}${v.note ? ` · ${v.note}` : ''}`;
  $('[data-file]').href = v.src;
  const asked = R.notesFor('v1').filter((n) => n.who !== '나').length, done = R.notesFor('v2').filter((n) => !n.mine).length;
  $('[data-changed]').textContent = v.id === 'v2' ? `${v.label}이에요. 지난 의견 ${asked}개 중 ${done}개를 반영했고, 달라진 곳은 ${CH.from}~${CH.to}초예요.` : `${v.label}이에요. 지금 보고 계신 판은 수정 전이에요.`;
  document.body.classList.toggle('is-first-ver', v.id !== 'v2');
  [...$('[data-cells]').children].forEach((im, i) => { im.src = secSrc(v, i + 1); });
}
function renderNotes() {
  const v = R.current();
  const old = R.notesFor(v.id).concat(v.id === 'v2' ? R.notesFor('v1') : []).sort((a, b) => a.at - b.at);
  const rows = [
    ...s.drafts.map((d) => `<li class="note is-draft" data-at="${d.at}"><button type="button" class="note-at mono" data-seek="${d.at}">${fmtShort(d.at)}</button><div><p class="body">${esc(d.text)}</p><button type="button" class="small note-x" data-rm="${d.id}">빼기</button></div></li>`),
    ...old.map((n) => `<li class="note" data-at="${n.at}"><button type="button" class="note-at mono" data-seek="${n.at}">${fmtShort(n.at)}</button><div><p class="small who">${esc(n.who)}${n.version !== v.id ? ` · ${REVIEW.versions.find((x) => x.id === n.version).short}에 남긴 의견` : ''}</p><p class="body">${esc(n.text)}</p></div></li>`),
  ];
  $('[data-notes]').innerHTML = rows.join('');
  const marks = [...s.drafts.map((d) => ({ at: d.at, draft: true })), ...old.map((n) => ({ at: n.at }))];
  $('[data-marks]').innerHTML = marks.map((m) => `<i class="mark${m.draft ? ' is-draft' : ''}"></i>`).join('');
  [...$('[data-marks]').children].forEach((el, i) => el.style.setProperty('--x', String(marks[i].at / s.duration)));
  const n = s.drafts.length;
  $('[data-decide-label]').textContent = s.approved ? REVIEW.approve.done : n ? REVIEW.approve.send(n) : REVIEW.approve.label;
  $('[data-decide-hint]').textContent = s.approved ? '' : n ? '보내기 전까지는 저희에게 보이지 않아요.' : REVIEW.approve.question;
  $('[data-decide]').classList.toggle('is-done', s.approved);
  $('[data-sent]').hidden = !s.justSent;
}
function renderTime() {
  const p = s.t / (s.duration || 15);
  $('[data-head]').style.setProperty('--p', String(p));
  $('[data-tc]').textContent = fmt(s.t);
  const l = $('[data-line]'); l.setAttribute('aria-valuenow', String(Math.round(s.t))); l.setAttribute('aria-valuetext', fmtShort(s.t));
  const now = R.scene(s.t);
  app.querySelectorAll('[data-scene]').forEach((li) => li.classList.toggle('is-now', Number(li.dataset.scene) === now.no));
  app.querySelectorAll('.note').forEach((li) => li.classList.toggle('is-near', Math.abs(Number(li.dataset.at) - s.t) < 0.8));
}
R.on((what) => {
  if (what === 'time') renderTime();
  if (what === 'notes') renderNotes();
  if (what === 'version') { renderVer(); renderNotes(); }
  if (what === 'play') { document.body.classList.toggle('is-playing', s.playing); wake(); }
  if (what === 'approved') { renderNotes(); document.body.classList.add('is-approved'); }
});

// 손을 놓으면 UI가 물러난다.
let idleT = 0;
function wake() { document.body.classList.remove('is-idle'); clearTimeout(idleT); if (s.playing && !reduced()) idleT = setTimeout(() => { if (!document.querySelector('input:focus')) document.body.classList.add('is-idle'); }, 2200); }
addEventListener('pointermove', wake); addEventListener('pointerdown', wake); addEventListener('keydown', wake);

// 달라진 곳 표시는 자료에서 온다.
$('[data-diff]').style.setProperty('--from', String(CH.from / REVIEW.duration));
$('[data-diff]').style.setProperty('--to', String(CH.to / REVIEW.duration));
const sceneRow = $('.scenes');
sceneRow.style.setProperty('--cols', REVIEW.scenes.map((c) => `${c.to - c.from}fr`).join(' '));

// 조작
scrubber($('[data-line]'), {
  duration: () => s.duration,
  onSeek: (t) => film.seek(t),
  onHover: (t) => { const pk = $('[data-peek]'); pk.hidden = false; pk.querySelector('img').src = secSrc(R.current(), Math.floor(t) + 1); pk.querySelector('figcaption').textContent = fmtShort(t); pk.style.setProperty('--x', String(t / s.duration)); },
  onLeave: () => { $('[data-peek]').hidden = true; },
});
$('[data-line]').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.stopPropagation(); film.seek(s.t - 1); } if (e.key === 'ArrowRight') { e.stopPropagation(); film.seek(s.t + 1); } });
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
  R.setCompare(on); document.body.classList.toggle('is-compare', on); $('.is-other').hidden = !on;
  if (on) { if (s.version !== 'v2') { R.setVersion('v2'); film.load(R.current().src, s.t); } other.currentTime = s.t; if (s.playing) other.play().catch(() => {}); } else other.pause();
  $('[data-compare]').textContent = on ? '한 편만 보기' : '나란히 보기';
}
let sheetOpener = null;
trapTab($('[data-sheet]'));
function openSheet() { const sh = $('[data-sheet]'); sheetOpener = document.activeElement; sh.hidden = false; requestAnimationFrame(() => sh.classList.add('is-on')); sh.querySelector('[data-sheet-ok]').focus(); if (s.playing) main.pause(); }
function closeSheet() { const sh = $('[data-sheet]'); sh.classList.remove('is-on'); setTimeout(() => { sh.hidden = true; }, reduced() ? 0 : 400); sheetOpener?.focus?.(); }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('[data-sheet]').hidden) closeSheet(); });

renderVer(); renderNotes();
const q = new URLSearchParams(location.search).get('t');
film.seek(q ? Number(q) : START);
renderTime();
