'use strict';
// Thin host adapter for Core's moment-level challenge (flow.js) in a game that uses game-learning.
// Learning evidence still goes to Trail through the game's coach; the same responses also move
// the content's knobs. One small memory per content is kept next to the learning log: no identity,
// no answers, no text. Resetting the log clears it.
// Today's condition (good / okay / tired / no_time) lasts until the end of the local day, on this
// device only.
// The presentation the person chose (help style, text size, motion, explanation; Flow.PRESENTATION)
// stays until they change it or reset the log, and every game's live() follows it.
// A device store keeps all of this on the device. For an account whose learning storage is on,
// memory-sync.js keeps the chosen presentation, the content memories and declined offers the same
// on every device (state, merge and subscribe below).
const Flow = require('./flow');
const VellumFlow = require('./vellum-flow');
const localDay = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
// Only the presentation vocabulary, with a value the person can choose (null means not chosen).
const presentationOf = value => object(value) && Object.keys(value).length > 0
  && Object.entries(value).every(([key, choice]) => Object.hasOwn(Flow.PRESENTATION, key) && (choice === null || Flow.PRESENTATION[key].includes(choice)));

// `epoch` is the learning log's current epoch: a reset (in this tab or another) starts a new one,
// and memory written under an older epoch is never read or written back.
function createFlowPort({ storage, key, clock, epoch = () => null }) {
  const FLOW = `${key}.flow`, TODAY = `${key}.today`, PRESENT = `${key}.presentation`;
  const listeners = new Set();
  const notify = change => { for (const listener of listeners) { try { listener(change); } catch { /* an observer cannot change the memory */ } } };
  const read = name => { try { const raw = storage?.getItem(name); return raw == null || raw === '' ? null : JSON.parse(raw); } catch { return null; } };
  const write = (name, value) => {
    try {
      if (!storage) return false;
      if (value == null) { if (typeof storage.removeItem === 'function') storage.removeItem(name); else storage.setItem(name, ''); }
      else storage.setItem(name, JSON.stringify(value));
      return true;
    } catch { return false; }
  };
  const memories = (current = epoch()) => {
    const value = read(FLOW);
    return value && value.v === 1 && (value.epoch ?? null) === current && object(value.contents) && object(value.declined)
      ? value : { v: 1, epoch: current, contents: {}, declined: {} };
  };
  // A write from a round that began before a reset is dropped, so a reset cannot be undone by an open tab.
  const update = (since, change) => { const current = epoch(); if (since !== undefined && since !== current) return false; const all = memories(current); change(all); return write(FLOW, all); };
  const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  // A value with a readable time replaces one without.
  const later = (at, than) => !instant(than) || Date.parse(at) > Date.parse(than);
  // The stored choice with its time. `presentation: null` is a choice forgotten at that time.
  const chosen = () => { const value = read(PRESENT); return value && value.v === 1 && instant(value.at) && (value.presentation === null || presentationOf(value.presentation)) ? value : null; };
  return Object.freeze({
    today() { const value = read(TODAY); return value && value.day === localDay(clock()) && Flow.CONDITIONS.includes(value.condition) ? value.condition : null; },
    setToday(condition) {
      if (condition !== null && !Flow.CONDITIONS.includes(condition)) throw new TypeError('Atlas: invalid condition');
      return write(TODAY, condition === null ? null : { day: localDay(clock()), condition });
    },
    // Set only by the person's own choice (a hub or settings screen); a value that is not in the
    // vocabulary is never read back. null forgets it, and the forgetting keeps its time so another
    // device's older choice does not come back.
    presentation() { const value = chosen(); return value?.presentation ? { ...value.presentation } : null; },
    setPresentation(presentation) {
      if (presentation !== null && !presentationOf(presentation)) throw new TypeError(`Atlas: presentation accepts only ${Object.keys(Flow.PRESENTATION).join(', ')}`);
      const done = write(PRESENT, { v: 1, presentation: presentation === null ? null : { ...presentation }, at: clock() });
      if (done) notify({ kind: 'presentation', key: 'chosen' });
      return done;
    },
    epoch,
    memories: () => memories(),
    save(contentId, memory, since) { const done = update(since, all => { all.contents[contentId] = memory; }); if (done) notify({ kind: 'flow', key: contentId }); return done; },
    decline(contentId, at, since) { const done = update(since, all => { all.declined[contentId] = at; }); if (done) notify({ kind: 'declined', key: contentId }); return done; },
    // Everything a synchroniser exchanges, each with its own time: the chosen presentation,
    // each content's memory (memory.at) and each declined offer.
    state() {
      const all = memories(), present = chosen();
      return { presentation: present ? { value: present.presentation && { ...present.presentation }, at: present.at } : null,
        flow: JSON.parse(JSON.stringify(all.contents)), declined: { ...all.declined } };
    },
    // Takes another device's values where they are newer than this device's, entry by entry.
    // Subscribers hear it as 'import', so a synchroniser does not send it back.
    merge(remote) {
      if (!object(remote)) throw new TypeError('Atlas: invalid memory');
      let changed = false;
      const present = remote.presentation;
      if (object(present) && instant(present.at) && (present.value === null || presentationOf(present.value)) && later(present.at, chosen()?.at)
        && write(PRESENT, { v: 1, presentation: present.value && { ...present.value }, at: present.at })) changed = true;
      const all = memories();
      let touched = false;
      for (const [id, memory] of Object.entries(object(remote.flow) ? remote.flow : {})) {
        if (!object(memory) || memory.content !== id || !instant(memory.at) || !later(memory.at, all.contents[id]?.at)) continue;
        all.contents[id] = JSON.parse(JSON.stringify(memory)); touched = true;
      }
      for (const [id, at] of Object.entries(object(remote.declined) ? remote.declined : {})) {
        if (!instant(at) || !later(at, all.declined[id])) continue;
        all.declined[id] = at; touched = true;
      }
      if (touched && write(FLOW, all)) changed = true;
      if (changed) notify({ kind: 'import' });
      return changed;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Atlas: listener required');
      listeners.add(listener); return () => listeners.delete(listener);
    },
    clear() { write(FLOW, null); write(TODAY, null); write(PRESENT, null); },
  });
}

function createLive({ coach, port, clock }) {
  return function live(input, { declared = {}, presentation, skillIds = [], arm = 'adapted', condition, level = 'standard', words = {} } = {}) {
    const spec = Flow.defineContent(input);
    // The settings the person chose (Core personalization) hold help and declared knobs;
    // a lock this content set for itself (`declared.knobs`) still wins. Without a value from the
    // game, the presentation remembered on this device applies; null means none for this round.
    if (presentation === undefined) presentation = typeof port.presentation === 'function' ? port.presentation() : null;
    if (presentation != null) {
      const knobs = { ...Flow.declaredFrom(spec, presentation).knobs, ...(declared && declared.knobs) };
      if (Object.keys(knobs).length) declared = { ...declared, knobs };
    }
    const since = port.epoch();
    const memory = port.memories().contents[spec.id] || null;
    let prior = null;
    // A first visit starts from what other practice already showed, if anything did.
    if (!memory && skillIds.length) { try { prior = Flow.priorFromSummary(spec, coach.summary(), skillIds); } catch { prior = null; } }
    const run = Flow.start({ spec, memory, prior, declared, condition: condition === undefined ? port.today() : condition, arm, now: clock() });
    const say = event => VellumFlow.line(event, { level, words });
    const save = () => port.save(spec.id, run.memory(clock()), since);
    const shown = new Map();
    const snapshot = () => { const s = run.settings(); return { content: s.content, policy: s.policy, arm: s.arm, mode: s.mode, values: s.values, level: s.level }; };
    const result = observed => ({ ...observed, line: observed.change ? say(observed.change) : null });
    return Object.freeze({
      spec,
      settings: run.settings,
      intro() { const intro = run.intro(); return { ...intro, line: say(intro) }; },
      level: run.level,
      // Core's learning priority decides what to practise; the flow level decides how hard,
      // among the leading choices only.
      pick(candidates, options = {}) {
        const { within = 5, ...rest } = options;
        const recommendation = coach.recommend(candidates, rest);
        if (recommendation.status !== 'ready' || !spec.items) return recommendation;
        const leading = [recommendation.selected, ...recommendation.alternatives].slice(0, within);
        const wanted = run.level(leading.map(candidate => candidate.difficulty));
        const chosen = leading.find(candidate => candidate.difficulty === wanted) || recommendation.selected;
        // The reason, focus skill and evidence shown are the chosen item's own, not the first choice's.
        const own = chosen === recommendation.selected ? recommendation : coach.recommend([chosen], rest);
        return { ...own, selected: chosen, alternatives: [recommendation.selected, ...recommendation.alternatives].filter(c => c !== chosen), flowLevel: wanted };
      },
      // The settings in force are kept with the decision, so the choice can be reviewed later.
      present(item) { const pid = coach.present(item, { flow: snapshot() }); shown.set(pid, item.difficulty); return pid; },
      /* Learning evidence to Trail first; then the same response moves the challenge. `flow` may
       * name the outcome for the challenge (a missed order is a 'timeout' there, yet not a language
       * error) and pass the share of time used as `pressure`. Trail decides assisted and repeat. */
      answer(pid, response, flow = {}) {
        const recorded = coach.answer(pid, response);
        const outcome = flow.outcome ?? (response.correct === true ? 'success' : response.correct === false ? 'fail' : 'void');
        const level = spec.items && spec.items.levels.includes(shown.get(pid)) ? shown.get(pid) : null;
        const observed = run.observe({ outcome, assisted: flow.assisted ?? recorded.assisted === true, repeat: flow.repeat ?? recorded.exposure === 'repeat',
          pressure: flow.pressure ?? null, latencyMs: flow.latencyMs ?? null, level });
        save();
        return { recorded, ...result(observed) };
      },
      // A response that is not a Strata item (a game action, a missed customer).
      observe(input) { const observed = run.observe(input); save(); return result(observed); },
      stuck: base => VellumFlow.stuckFor({ latencies: run.latencies(), ...(base ? { base } : {}) }),
      offerLessHelp() {
        const support = spec.knobs.find(knob => knob.kind === 'support' && knob.follows !== 'declared');
        if (!support || !run.settings().adaptive) return { offer: false, reason: 'not-available' };
        const step = VellumFlow.supportStep({ at: run.settings().indices[support.id], last: support.values.length - 1, streak: run.quietStreak(),
          declared: Object.hasOwn(declared.knobs || {}, support.id), declinedAt: port.memories().declined[spec.id] ?? null, now: clock() });
        // Never stacked on a change that just happened; the offer can come at a calmer moment.
        return step.offer && !run.lessHelpAllowed() ? { offer: false, reason: 'not-now' } : step;
      },
      acceptLessHelp() { const change = run.acceptLessHelp(); save(); return change && { ...change, line: say(change) }; },
      declineLessHelp() { return port.decline(spec.id, clock(), since); },
      floor: run.floor,
      end() { save(); return { settings: run.settings(), changes: run.changes(), floor: run.floor() }; },
      trace: run.trace,
    });
  };
}
module.exports = { createFlowPort, createLive, localDay };
