/** Staying (vertical slice W7b, village design §4-4): sit on a seat and the screen goes quiet — the seat's still
 * view, darker, with no words over it — and only sound goes on, the background of studying with the app left open.
 * Nothing is asked of the hands (Steam lens 8 — 「몇 분마다 손이 가야 해서 방치형이 아니다」): it stays as long as the
 * person leaves it, with no timer, no count and no 「still there?」 (G2·G9); a dropped connection does not stand the
 * player up either. A touch device keeps its screen on while seated (staying lasts while the screen is on; a desktop
 * leaves that to its own lock). A touch, a key or a moved mouse brings the seat's card back for a while — the two
 * sound switches; 「일어나기」 stays in sight, faint. Moving, Esc, B or 일어나기 stands up. Device only — no command,
 * no record. The controls are made here, not in day.html, and their look is day-stay.css: a browser still holding
 * an older day.html for the cache's ten minutes simply has no seat to sit on.
 */
import { seatNear, SEATS, QUIET, dimAlpha } from './town/stay.mjs';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const NOTES = { village: '바람·비·새 소리예요. 계절과 날씨, 낮과 밤을 따라요.', music: '앉아 있을 때만 흘러요.' };
const SWITCHES = [['village', '마을 소리'], ['music', 'SYNK 음악']];
const coarse = matchMedia('(pointer: coarse)');
const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); node.append(...children); return node; };

/** A switch for one sound (role=switch); every copy of it on the page follows the same setting. */
function soundSwitch(sound, [name, title], place) {
  const button = el('button', { type: 'button', className: 'stay-switch' }, el('span', { className: 'stay-switch-title', textContent: title }), el('span', { className: 'stay-switch-state' }));
  button.setAttribute('role', 'switch'); button.dataset.soundPref = name; button.setAttribute('aria-describedby', `stay-note-${name}-${place}`);
  // The person's own click on this very switch is the only way on (prefAfter): the event goes along to prove it.
  button.addEventListener('click', event => sound.setPref(name, button.getAttribute('aria-checked') !== 'true', event));
  return el('div', { className: 'stay-switch-row' }, button, el('p', { className: 'stay-switch-note', id: `stay-note-${name}-${place}`, textContent: NOTES[name] }));
}

export function createStay({ scene, hud, nearby, settings, sound, renderer, beforeSit = async () => {}, onChange = () => {}, onStand = () => {} }) {
  let seat = null, context = {}, cardTimer = 0, wakeLock = null, inputMode = 'keyboard', pad = { x: false, b: false, a: false }, disposed = false;
  if (!document.querySelector('link[data-stay-style]')) { const link = el('link', { rel: 'stylesheet', href: new URL('./day-stay.css', import.meta.url).href }); link.dataset.stayStyle = ''; document.head.append(link); }
  const homeSeat = SEATS.find(s => s.id === 'home-window-bench') || null;

  // The sit button sits above the talk button in the walking view.
  const sit = el('button', { type: 'button', id: 'stay-sit', className: 'felt walk-sit', hidden: true });
  sit.addEventListener('click', event => { const near = canSitNow(); if (near) enter(near, event); });
  hud?.append(sit);
  // Over the scene: the dark veil and the seat's card. The card's words and switches fade when left alone (and take
  // no taps then — the first touch only brings them back); 「일어나기」 stays in sight. Nothing is hidden from reading.
  const veil = el('div', { id: 'stay-veil', className: 'stay-veil', hidden: true }); veil.setAttribute('aria-hidden', 'true');
  const title = el('h2', { id: 'stay-title', className: 'stay-title' }), line = el('p', { className: 'stay-line' });
  const stand = el('button', { type: 'button', className: 'felt stay-stand', textContent: '일어나기' });
  stand.addEventListener('click', () => leave('button'));
  const face = el('div', { className: 'stay-face' }, title, line, el('div', { className: 'stay-switches' }, ...SWITCHES.map(row => soundSwitch(sound, row, 'card'))));
  const card = el('section', { id: 'stay-card', className: 'stay-card', hidden: true, tabIndex: -1 }, face, stand);
  card.setAttribute('aria-labelledby', 'stay-title');
  const live = el('p', { className: 'visually-hidden' }); live.setAttribute('aria-live', 'polite');
  scene.append(veil, card, live);
  // The home's sound box (the village design's 「집의 소리 상자」): the two switches and the window seat, in the home panel.
  const homeSit = el('button', { type: 'button', className: 'felt', textContent: '창가 벤치에 앉아 머물기' });
  homeSit.addEventListener('click', event => { if (homeSeat && context.connected && !context.busy) enter(homeSeat, event); });
  const box = el('section', { id: 'sound-box', className: 'cafe-first sound-box', hidden: true }, el('p', { className: 'eyebrow', textContent: '소리' }), ...SWITCHES.map(row => soundSwitch(sound, row, 'home')), homeSit);
  box.setAttribute('aria-label', '집의 소리');
  nearby?.querySelector('.permission-note')?.before(box);
  // And in the 「내 속도」 settings, from anywhere.
  const field = el('fieldset', { className: 'sound-settings' }, el('legend', { textContent: '소리' }), ...SWITCHES.map(row => soundSwitch(sound, row, 'settings')),
    el('p', { className: 'field-note', textContent: '꺼 둔 소리는 직접 켤 때까지 다시 나지 않아요. 이 기기에 기억해요.' }));
  settings?.append(field);

  function paintSwitches() {
    const prefs = sound.prefs(), music = sound.hasMusic(), held = sound.musicHeld?.() === 'data';
    for (const button of document.querySelectorAll('.stay-switch')) {
      const name = button.dataset.soundPref, on = prefs[name] === true;
      button.setAttribute('aria-checked', String(on)); button.querySelector('.stay-switch-state').textContent = on ? '켜짐' : '꺼짐';
      // SYNK music has no switch until there is a song (W7b: released with the village sound alone); on a saving or
      // cellular connection it waits for Wi-Fi with its switch left as it is.
      if (name === 'music') { button.closest('.stay-switch-row').hidden = !music; const note = button.closest('.stay-switch-row').querySelector('.stay-switch-note'); note.textContent = on && held ? '와이파이에서만 흘러요.' : NOTES.music; }
    }
    // Paused from a headset, a media key or the lock screen: the switch stays on and the words say the music rests.
    const musicPaused = music && prefs.music && !held && !!sound.musicPaused?.(), musicOn = music && prefs.music && !held && !musicPaused;
    line.textContent = prefs.village || musicOn ? musicOn ? prefs.village ? '마을 소리와 SYNK 음악이 흘러요.' : 'SYNK 음악이 흘러요.' : '마을 소리만 흘러요.' : musicPaused ? 'SYNK 음악이 멈춰 있어요. 화면만 조용히 머물러요.' : '소리를 모두 꺼 두었어요. 화면만 조용히 머물러요.';
  }
  sound.onPrefs(() => { paintSwitches(); onChange(); });
  paintSwitches();

  function canSitNow() {
    if (seat || disposed || !context.connected || context.busy || context.dialog || context.panel || !context.walking) return null;
    return seatNear(context.point);
  }
  function showCard() {
    if (!seat) return;
    card.classList.add('awake'); clearTimeout(cardTimer);
    // Bright while focus is in it; otherwise it fades after a while.
    cardTimer = setTimeout(() => { if (!face.contains(document.activeElement)) card.classList.remove('awake'); }, QUIET?.cardMs ?? 6000);
  }
  async function lockScreen() {
    if (!seat || !QUIET?.wakeLock || !coarse.matches || wakeLock || document.hidden || !navigator.wakeLock?.request) return;
    try { const lock = await navigator.wakeLock.request('screen'); if (!seat) { lock.release().catch(() => {}); return; } wakeLock = lock; lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; }); } catch { wakeLock = null; }
  }
  function release() { const lock = wakeLock; wakeLock = null; lock?.release().catch(() => {}); }
  function paintVeil() { if (seat) veil.style.setProperty('--stay-dim', dimAlpha(context.light ?? null).toFixed(3)); }

  async function enter(next, event) {
    if (seat || disposed) return;
    sound.unlock(event);
    // A walk that could not reach the server leaves the person standing, the error in sight (beforeSit says false).
    const ready = await beforeSit();
    if (seat || disposed || ready === false) return;
    seat = next; sit.hidden = true;
    document.body.classList.add('stay-mode');
    renderer()?.setStay?.(next, QUIET || {});
    veil.hidden = false; card.hidden = false; title.textContent = `${next.label}에 앉아 있어요`;
    paintVeil(); veil.style.setProperty('--stay-dim-in', `${(QUIET?.dimInMs ?? 8000) / 1000}s`);
    // The veil darkens through a CSS transition (reduced motion makes it immediate).
    veil.classList.remove('dim'); requestAnimationFrame(() => requestAnimationFrame(() => { if (seat) veil.classList.add('dim'); }));
    showCard(); card.focus({ preventScroll: true });
    live.textContent = `${next.label}에 앉았어요. ${line.textContent} 일어나려면 일어나기를 눌러요.`;
    lockScreen(); onChange();
  }
  function leave(reason = 'button') {
    if (!seat) return;
    const focusWasIn = card.contains(document.activeElement);
    seat = null; clearTimeout(cardTimer); release();
    document.body.classList.remove('stay-mode');
    renderer()?.setStay?.(null);
    veil.classList.remove('dim'); veil.hidden = true; card.classList.remove('awake'); card.hidden = true; live.textContent = '일어났어요.';
    onStand(reason); onChange();
    if (focusWasIn) (sit.hidden ? scene : sit).focus({ preventScroll: true });
  }

  // Seated, every person's act wakes the card; Esc and walking keys stand up (walking goes on with the same key —
  // this capture listener runs before the walking controls'). F sits where a seat is near.
  const keydown = event => {
    if (event.code === 'KeyF' && !seat && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !document.activeElement?.matches('input, textarea, select') && !document.querySelector('dialog[open]')) {
      const near = canSitNow(); if (near) { event.preventDefault(); enter(near, event); } return;
    }
    if (!seat) return;
    if (event.code === 'Escape') { event.preventDefault(); leave('escape'); return; }
    if (MOVE_KEYS.has(event.code)) { leave('move'); return; }
    showCard();
  };
  const wake = () => { if (seat) showCard(); };
  const visibility = () => { if (seat && !document.hidden) { lockScreen(); paintVeil(); } };
  addEventListener('keydown', keydown, true); document.addEventListener('pointerdown', wake, true); document.addEventListener('mousemove', wake, { passive: true });
  card.addEventListener('focusin', showCard); document.addEventListener('visibilitychange', visibility);

  return {
    /** The walking state now: { walking, point, connected, busy, dialog, panel, inputMode, location, homePanel, light }.
     * Called every walking frame: it writes to the page only when something it shows changed. */
    update(next) {
      const lightChanged = next.light !== context.light;
      context = next; inputMode = next.inputMode || inputMode;
      const near = canSitNow(), label = near ? `${inputMode === 'touch' ? '' : inputMode === 'gamepad' ? 'X · ' : 'F · '}${near.label}에 앉아 머물기` : '';
      if (sit.hidden !== !near) sit.hidden = !near;
      if (near && sit.textContent !== label) sit.textContent = label;
      // The home's sound box shows where the home's panel does (talking at home, or the home in the classic view).
      const boxHidden = next.location !== 'home' || !next.homePanel; if (box.hidden !== boxHidden) box.hidden = boxHidden;
      const homeSitHidden = !!seat || !homeSeat; if (homeSit.hidden !== homeSitHidden) homeSit.hidden = homeSitHidden;
      if (lightChanged) paintVeil();
    },
    /** The sound's own state changed (a switch elsewhere, music waiting for Wi-Fi). */
    paint: paintSwitches,
    /** Each app frame: a gamepad's X sits where a seat is near; seated, B or the stick stands up and A wakes the card.
     * Says whether a gamepad is connected — seated, the app then reads it at the scene's pace. */
    frame() {
      const gamepad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected && p.mapping === 'standard'); if (!gamepad) return false;
      const pressed = i => !!gamepad.buttons[i]?.pressed, moved = Math.hypot(gamepad.axes[0] || 0, gamepad.axes[1] || 0) > .5 || [12, 13, 14, 15].some(pressed);
      const now = { x: pressed(2), b: pressed(1), a: pressed(0) };
      if (!seat && now.x && !pad.x) { const near = canSitNow(); if (near) enter(near, null); }
      else if (seat && (now.b && !pad.b || moved)) leave('move');
      else if (seat && now.a && !pad.a) showCard();
      pad = now; return true;
    },
    active: () => !!seat,
    seat: () => seat,
    leave,
    metrics: () => ({ seated: seat?.id ?? null, sitShown: !sit.hidden, cardAwake: card.classList.contains('awake'), dim: seat ? Number(veil.style.getPropertyValue('--stay-dim') || 0) : 0, wakeLock: !!wakeLock, homeBox: !box.hidden }),
    dispose() {
      disposed = true; leave('dispose'); removeEventListener('keydown', keydown, true); document.removeEventListener('pointerdown', wake, true); document.removeEventListener('mousemove', wake);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
