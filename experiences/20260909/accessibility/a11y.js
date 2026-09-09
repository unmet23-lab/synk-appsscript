/* SYNK accessibility helpers. Optional enhancement; no automatic audio or tracking. */
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.SynkA11y = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CHOICES = ['system', 'reduce', 'allow'];
  function resolveMotion(choice, systemReduced) {
    if (!CHOICES.includes(choice)) throw new TypeError('Unknown motion choice');
    return choice === 'reduce' || (choice === 'system' && Boolean(systemReduced));
  }
  function createSpeech(options) {
    const synth = options.synth;
    const Utterance = options.Utterance;
    const onState = options.onState || function () {};
    let generation = 0;
    let active = false;
    const available = () => Boolean(synth && typeof synth.speak === 'function'
      && typeof synth.cancel === 'function' && typeof Utterance === 'function');
    function cancel() {
      generation += 1;
      if (active && available()) synth.cancel();
      active = false;
      onState('idle');
    }
    function speak(text, settings) {
      const config = settings || {};
      if (!available()) return { ok: false, reason: 'unsupported' };
      if (!String(text || '').trim()) return { ok: false, reason: 'empty' };
      const lang = config.lang || 'ko-KR';
      const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
      const voice = voices.find(v => v.lang.toLowerCase().split('-')[0] === lang.toLowerCase().split('-')[0]);
      // A present API does not establish that a usable Korean voice is installed.
      if (!voice) return { ok: false, reason: 'voice-unavailable' };
      cancel();
      const token = generation;
      const utterance = new Utterance(String(text));
      utterance.lang = lang;
      utterance.voice = voice;
      utterance.rate = 0.94;
      utterance.onstart = () => { if (token === generation) onState('speaking'); };
      utterance.onend = () => { if (token === generation) { active = false; onState('idle'); } };
      utterance.onerror = (event) => {
        if (token !== generation) return;
        active = false;
        onState('error', event.error || 'unavailable');
      };
      try {
        active = true;
        onState('pending');
        synth.speak(utterance);
        return { ok: true };
      } catch (error) {
        active = false;
        onState('error', 'unavailable');
        return { ok: false, reason: 'unavailable' };
      }
    }
    return { available, speak, cancel };
  }
  function install(options) {
    const config = options || {};
    const win = config.window || window;
    const doc = config.document || win.document;
    const root = config.root || doc.documentElement;
    const key = config.storageKey || 'synk.motion.preference.v1';
    const media = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const removers = [];
    let choice = 'system';
    let destroyed = false;
    let announcementTimer;
    let region = config.liveRegion || doc.querySelector('[data-synk-live]');
    const createdRegion = !region;
    if (!region) {
      region = doc.createElement('div');
      region.className = 'synk-sr-only';
      doc.body.appendChild(region);
    }
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    const listen = (node, event, callback) => {
      if (!node || !node.addEventListener) return;
      node.addEventListener(event, callback);
      removers.push(() => node.removeEventListener(event, callback));
    };
    function announce(text) {
      if (destroyed) return;
      win.clearTimeout(announcementTimer);
      region.textContent = '';
      announcementTimer = win.setTimeout(() => { region.textContent = String(text); }, 30);
    }
    function getMotion() { return { choice, reduced: resolveMotion(choice, media.matches) }; }
    function applyMotion() {
      const state = getMotion();
      root.dataset.synkMotion = state.reduced ? 'reduce' : 'allow';
      root.dataset.synkMotionChoice = choice;
      if (config.motionSelect) config.motionSelect.value = choice;
      if (config.onMotionChange) config.onMotionChange(state);
    }
    function setMotion(value) {
      if (destroyed || !CHOICES.includes(value)) return false;
      choice = value;
      try { win.localStorage.setItem(key, choice); } catch (_) { /* Preference is optional. */ }
      applyMotion();
      return true;
    }
    try {
      const saved = win.localStorage.getItem(key);
      if (CHOICES.includes(saved)) choice = saved;
    } catch (_) { /* Storage restrictions must not block the page. */ }
    if (media.addEventListener) listen(media, 'change', applyMotion);
    else if (media.addListener) { media.addListener(applyMotion); removers.push(() => media.removeListener(applyMotion)); }
    listen(config.motionSelect, 'change', event => setMotion(event.target.value));
    listen(win, 'storage', event => {
      if (event.key !== key) return;
      choice = CHOICES.includes(event.newValue) ? event.newValue : 'system';
      applyMotion();
    });
    const speech = createSpeech({
      synth: win.speechSynthesis, Utterance: win.SpeechSynthesisUtterance,
      onState: config.onSpeechState
    });
    doc.querySelectorAll('.synk-skip-link').forEach(link => listen(link, 'click', event => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = doc.getElementById(href.slice(1));
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }));
    listen(win, 'pagehide', speech.cancel);
    applyMotion();
    return {
      announce, setMotion, getMotion,
      speechAvailable: speech.available,
      speak: (text, settings) => destroyed ? { ok: false, reason: 'destroyed' } : speech.speak(text, settings),
      cancelSpeech: speech.cancel,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        speech.cancel();
        win.clearTimeout(announcementTimer);
        removers.forEach(remove => remove());
        if (createdRegion) region.remove();
      }
    };
  }
  return { install, resolveMotion, createSpeech };
});
