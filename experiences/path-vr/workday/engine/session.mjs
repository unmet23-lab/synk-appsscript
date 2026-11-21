/** Workday session: a pure state machine over a validated scene table (job.json).
 * It owns what happens next, what the learner chose and how often help was opened. It never
 * scores: an option that departs from the occupation's principle only changes the next line.
 * Media, microphone and screen belong to the page; nothing here touches the DOM or the network.
 * Speech text is used to accept a turn and is not kept: only how the turn was answered
 * (voice / text / example / unheard — the device could not make out the speech, which is never
 * counted against the learner). Name, reasons and reflections are never part of this data. */
export const SESSION_DATA_VERSION = 2;
export const SAY_MODES = Object.freeze(['voice', 'text', 'example', 'unheard']);
const clone = (value) => JSON.parse(JSON.stringify(value));
// works: tool steps the learner handled (id → scene). The option picked lives in forks, so `when` can use it.
const blankData = (job) => ({ v: SESSION_DATA_VERSION, job: job.id, edition: job.edition, forks: {}, forkScene: {}, scenes: {}, says: {}, works: {}, counts: { replays: 0, hints: 0, examples: 0 }, hinted: [], tour: { places: [], points: [] } });

/** Turns a scene asks the learner to answer, in order (fork branches never add one). All are in
 * Korean except a relay out, which is said on in the learner's own language. */
export function sceneSayIds(scene) {
  return (scene?.steps || []).filter((step) => step.type === 'say' || step.type === 'report' || step.type === 'relay').map((step) => step.id);
}
/** Tool steps of a scene, in order. */
export function sceneWorkIds(scene) {
  return (scene?.steps || []).filter((step) => step.type === 'work').map((step) => step.id);
}

function restore(job, saved) {
  if (!saved || saved.v !== SESSION_DATA_VERSION || saved.job !== job.id || saved.edition !== job.edition) return blankData(job);
  const data = blankData(job), sceneIds = new Set(job.scenes.map((scene) => scene.id));
  // Keep only fields this version writes, and only for scenes and forks the table still has.
  for (const [id, scene] of Object.entries(saved.scenes || {})) if (sceneIds.has(id)) data.scenes[id] = { done: scene?.done === true, runs: Math.max(0, Math.trunc(Number(scene?.runs) || 0)), finishes: Math.max(0, Math.trunc(Number(scene?.finishes) || (scene?.done === true ? 1 : 0))), activeMs: Math.max(0, Number(scene?.activeMs) || 0) };
  for (const [id, option] of Object.entries(saved.forks || {})) if (typeof option === 'string' && sceneIds.has(saved.forkScene?.[id])) { data.forks[id] = option; data.forkScene[id] = saved.forkScene[id]; }
  for (const [id, say] of Object.entries(saved.says || {})) if (sceneIds.has(say?.scene) && SAY_MODES.includes(say.produced)) data.says[id] = { scene: say.scene, produced: say.produced, helped: say.helped === true };
  for (const [id, work] of Object.entries(saved.works || {})) if (sceneIds.has(work?.scene)) data.works[id] = { scene: work.scene };
  for (const key of ['replays', 'hints', 'examples']) data.counts[key] = Math.max(0, Math.trunc(Number(saved.counts?.[key]) || 0));
  data.hinted = (Array.isArray(saved.hinted) ? saved.hinted : []).filter((key) => typeof key === 'string').slice(0, 400);
  data.tour.places = (saved.tour?.places || []).filter((id) => Object.hasOwn(job.places, id));
  data.tour.points = (saved.tour?.points || []).filter((id) => typeof id === 'string');
  return data;
}

export function createWorkdaySession(job, { saved = null } = {}) {
  let data = restore(job, saved);
  let phase = 'idle', sceneIndex = -1, pending = [], current = null, lastLine = null, paused = false;
  let place = null, placeCaption = '', placeSerial = 0;
  let say = null, tour = null;
  const hinted = new Set(data.hinted);
  // Work options already tried in this run of the scene (retry), by step id.
  const tried = new Map();
  const scene = () => job.scenes[sceneIndex] || null;
  // runs: times started (a stop half way counts); finishes: times it reached its end.
  const sceneData = (id) => (data.scenes[id] ||= { done: false, runs: 0, finishes: 0, activeMs: 0 });
  const matches = (when) => !when || Object.entries(when).every(([fork, option]) => (Array.isArray(option) ? option.includes(data.forks[fork]) : data.forks[fork] === option));
  const missing = (item) => (item.requires || []).filter((id) => data.scenes[id]?.done !== true);
  function setPlace(id, caption) { place = id; placeCaption = caption || ''; placeSerial++; }
  function next() {
    say = null; tour = null;
    while (pending.length) {
      const step = pending.shift();
      // A step can depend on an earlier choice; one that does not match is simply not there.
      if (!matches(step.when)) continue;
      if (step.type === 'move') { setPlace(step.place, step.caption || ''); continue; }
      current = step;
      if (step.type === 'line') { if (step.place && step.place !== place) setPlace(step.place, ''); lastLine = step; phase = 'line'; return; }
      if (step.type === 'note') { phase = 'note'; return; }
      if (step.type === 'tour') { tour = { current: step.home, openPoint: null }; phase = 'tour'; return; }
      say = { chosen: null, exampleOpen: false, hintOpen: false, selected: new Set() };
      phase = 'say'; return;
    }
    current = null; lastLine = null;
    const finished = sceneData(scene().id); finished.done = true; finished.finishes = (finished.finishes || 0) + 1;
    phase = 'scene-end';
  }
  function startScene(id) {
    const index = job.scenes.findIndex((item) => item.id === id);
    if (index < 0 || !['idle', 'scene-end', 'closing'].includes(phase) || missing(job.scenes[index]).length) return snapshot();
    sceneIndex = index; paused = false;
    // Running a scene again replaces what it recorded; other scenes keep theirs.
    for (const [sayId, entry] of Object.entries(data.says)) if (entry.scene === id) delete data.says[sayId];
    for (const [forkId, owner] of Object.entries(data.forkScene)) if (owner === id) { delete data.forks[forkId]; delete data.forkScene[forkId]; }
    for (const [workId, work] of Object.entries(data.works)) if (work.scene === id) delete data.works[workId];
    const record = sceneData(id); record.done = false; record.runs++; record.activeMs = 0; tried.clear();
    pending = [...job.scenes[index].steps]; lastLine = null;
    setPlace(job.scenes[index].place, job.scenes[index].title);
    next();
    return snapshot();
  }
  function advance() {
    if (paused || !['line', 'note'].includes(phase)) return snapshot();
    next(); return snapshot();
  }
  const sayOption = () => current?.options?.find((option) => option.id === say?.chosen) || null;
  function reportItems() {
    // Alternatives share an id; the earlier choices leave at most one of them.
    return (current?.items || []).filter((item) => matches(item.when));
  }
  function choose(optionId) {
    if (paused || phase !== 'say' || !current.options?.some((option) => option.id === optionId)) return snapshot();
    if (current.type === 'work' && tried.get(current.id)?.has(optionId)) return snapshot();
    say.chosen = optionId;
    // A tool step ends on the pick: the colleague answers what was picked, and the day goes on.
    if (current.type === 'work') {
      const owner = scene().id, option = sayOption();
      data.forks[current.id] = optionId; data.forkScene[current.id] = owner; data.works[current.id] = { scene: owner };
      // retry: the colleague says where to look, then the same tool comes back without the option just tried.
      if (option.retry === true) { if (!tried.has(current.id)) tried.set(current.id, new Set()); tried.get(current.id).add(optionId); pending.unshift(...option.then, current); }
      else pending.unshift(...option.then);
      next();
    }
    return snapshot();
  }
  function toggleItem(itemId) {
    if (paused || phase !== 'say' || current.type !== 'report' || !reportItems().some((item) => item.id === itemId)) return snapshot();
    if (say.selected.has(itemId)) say.selected.delete(itemId); else say.selected.add(itemId);
    return snapshot();
  }
  function hintKey() {
    // A line without a clip is told apart by its words.
    if (phase === 'line') return `line:${sceneIndex}:${current.clip || current.text}`;
    if (phase === 'say') return `say:${current.id}`;
    if (phase === 'note') return `note:${current.note}`;
    if (phase === 'tour') return tour.openPoint ? `point:${tour.current}:${tour.openPoint}` : `tour:${sceneIndex}`;
    return null;
  }
  /** Count one hint per line, prompt, note or point however often it is toggled. */
  function openHint() {
    const key = hintKey();
    if (!key || paused) return snapshot();
    if (phase === 'say') say.hintOpen = true;
    if (!hinted.has(key)) { hinted.add(key); data.hinted.push(key); data.counts.hints++; }
    return snapshot();
  }
  function openExample() {
    if (paused || phase !== 'say' || current.type === 'report' || current.type === 'work' || (current.options && !say.chosen) || say.exampleOpen) return snapshot();
    say.exampleOpen = true; data.counts.examples++;
    return snapshot();
  }
  /** The page replays the returned clip; the session only counts the request. */
  function replay() {
    if (paused || !['line', 'say'].includes(phase) || !lastLine) return null;
    data.counts.replays++;
    return lastLine.clip;
  }
  function canSubmit(mode, text) {
    if (paused || phase !== 'say' || current.type === 'work') return false;
    if (current.type === 'report' ? say.selected.size === 0 : current.options ? !say.chosen : false) return false;
    // A turn is accepted on one Korean syllable (「네」) or two letters of anything else; what was said is never judged.
    const bare = String(text || '').replace(/[\s.,!?…~'"「」]/gu, '');
    const enough = bare.length >= 2 || /[가-힣]/u.test(bare);
    // Said on to a guest in the learner's own language: aloud (never transcribed) or written in any letters.
    if (current.type === 'relay' && current.direction === 'out') return mode === 'example' || mode === 'own-voice' || (mode === 'own-text' && enough);
    return mode === 'example' || mode === 'unheard' || (['voice', 'text'].includes(mode) && enough);
  }
  function submitSay({ mode, text = '' } = {}) {
    if (!canSubmit(mode, text)) return snapshot();
    if (mode === 'example' && !say.exampleOpen) { say.exampleOpen = true; data.counts.examples++; }
    const id = current.id, owner = scene().id;
    let branch = [];
    if (current.type === 'report') {
      const key = current.items.find((item) => item.key === true && !item.when).id;
      const outcome = say.selected.has(key) ? 'included' : 'omitted';
      data.forks[id] = outcome; data.forkScene[id] = owner;
      branch = current.then[outcome];
    } else if (current.options) {
      const option = sayOption();
      data.forks[id] = option.id; data.forkScene[id] = owner;
      branch = option.then;
    }
    data.says[id] = { scene: owner, produced: mode, helped: say.exampleOpen || say.hintOpen };
    pending.unshift(...branch);
    next(); return snapshot();
  }
  function goTo(placeId) {
    if (paused || phase !== 'tour' || (placeId !== current.home && !current.board.includes(placeId)) || placeId === tour.current) return snapshot();
    tour.current = placeId; tour.openPoint = null;
    if (placeId !== current.home && !data.tour.places.includes(placeId)) data.tour.places.push(placeId);
    setPlace(placeId, job.places[placeId].name);
    return snapshot();
  }
  function hear(pointId) {
    if (paused || phase !== 'tour') return snapshot();
    const point = job.places[tour.current].points.find((item) => item.id === pointId);
    if (!point) return snapshot();
    tour.openPoint = pointId;
    const key = `${tour.current}/${pointId}`;
    if (!data.tour.points.includes(key)) data.tour.points.push(key);
    return snapshot();
  }
  function closePoint() { if (phase === 'tour') tour.openPoint = null; return snapshot(); }
  function finishTour() {
    if (paused || phase !== 'tour') return snapshot();
    if (tour.current !== current.home) setPlace(current.home, job.places[current.home].name);
    next(); return snapshot();
  }
  function nextScene() {
    if (phase !== 'scene-end') return snapshot();
    const open = (item) => !data.scenes[item.id]?.done && !missing(item).length;
    const following = job.scenes.slice(sceneIndex + 1).find(open) || job.scenes.find(open);
    return following ? startScene(following.id) : openClosing();
  }
  function openClosing() {
    if (!['idle', 'scene-end'].includes(phase) || !job.scenes.some((item) => data.scenes[item.id]?.done)) return snapshot();
    phase = 'closing'; sceneIndex = -1; current = null; lastLine = null; paused = false;
    setPlace(job.closing.place, '맺음');
    return snapshot();
  }
  /** Leave a scene part-way: it stays not done and can be opened again from the start. */
  function leave() {
    if (['line', 'say', 'tour', 'note'].includes(phase)) { pending = []; current = null; lastLine = null; say = null; tour = null; }
    phase = 'idle'; sceneIndex = -1; paused = false;
    return snapshot();
  }
  function pause() { if (['line', 'say', 'tour', 'note'].includes(phase)) paused = true; return snapshot(); }
  function resume() { paused = false; return snapshot(); }
  function addActiveMs(ms) {
    if (!paused && scene() && ['line', 'say', 'tour', 'note'].includes(phase) && Number.isFinite(ms) && ms > 0) sceneData(scene().id).activeMs += Math.min(ms, 5000);
  }
  function reset() { data = blankData(job); hinted.clear(); tried.clear(); phase = 'idle'; sceneIndex = -1; pending = []; current = null; lastLine = null; say = null; tour = null; paused = false; place = null; placeCaption = ''; return snapshot(); }
  // names: the same person's name in each hint language; the page picks the learner's.
  const person = (id) => ({ who: id, name: job.cast[id].name, names: job.cast[id].names ? { ...job.cast[id].names } : null, role: job.cast[id].role });
  const lineView = (step) => step ? { clip: step.clip, ...person(step.who), text: step.text, foreign: step.foreign ? { ...step.foreign } : null, hint: step.hint || null, action: step.action === true, channel: step.channel || null } : null;
  function snapshot() {
    const active = scene();
    const view = {
      phase, paused, place, placeCaption, placeSerial,
      scene: active ? { id: active.id, title: active.title, index: sceneIndex, total: job.scenes.length } : null,
      line: ['line', 'say'].includes(phase) ? lineView(lastLine) : null,
      say: null, tour: null, note: null,
      progress: { scenes: job.scenes.map((item) => ({ id: item.id, title: item.title, minutes: item.minutes, done: data.scenes[item.id]?.done === true, waitsFor: missing(item).map((id) => job.scenes.find((other) => other.id === id)?.title || id) })), allDone: job.scenes.every((item) => data.scenes[item.id]?.done === true), anyDone: job.scenes.some((item) => data.scenes[item.id]?.done === true) },
      counts: { ...data.counts },
    };
    if (phase === 'say') {
      const option = sayOption(), report = current.type === 'report', work = current.type === 'work', relay = current.type === 'relay';
      const out = relay && current.direction === 'out';
      view.say = {
        id: current.id, kind: report ? 'report' : work ? 'work' : relay ? 'relay' : current.options ? 'fork' : 'free',
        tool: work ? current.tool : null,
        // in: foreign is the guest's words. out: meaning is the Korean to pass on, and foreign its example.
        foreign: relay ? { ...person(current.who), text: { ...current.foreign } } : null,
        direction: relay ? (out ? 'out' : 'in') : null, meaning: out ? current.meaning : null, channel: current.channel || null,
        prompt: current.prompt, hint: current.hint || null, listen: current.listen || null,
        options: (current.options || []).map((item) => ({ id: item.id, label: item.label, hint: item.hint || null, tried: !!tried.get(current.id)?.has(item.id) })),
        chosen: say.chosen,
        example: report || work || out ? null : option ? option.example : current.options ? null : current.example,
        exampleOpen: say.exampleOpen, hintOpen: say.hintOpen,
        items: report ? reportItems().map((item) => ({ id: item.id, text: item.text, hint: item.hint || null, selected: say.selected.has(item.id) })) : [],
        ready: report ? say.selected.size > 0 : work ? false : current.options ? !!say.chosen : true,
      };
    }
    if (phase === 'tour') {
      const here = job.places[tour.current], point = here.points.find((item) => item.id === tour.openPoint) || null;
      view.tour = {
        prompt: current.prompt, hint: current.hint || null, home: current.home, current: tour.current,
        board: current.board.map((id) => ({ id, name: job.places[id].name, visited: data.tour.places.includes(id) })),
        points: here.points.map((item) => ({ id: item.id, x: item.x, y: item.y, label: item.label, heard: data.tour.points.includes(`${tour.current}/${item.id}`) })),
        openPoint: point ? { id: point.id, label: point.label, hint: point.hint || null, audio: point.audio || null, note: point.note ? { id: point.note, ...job.notes[point.note] } : null } : null,
      };
    }
    if (phase === 'note') view.note = { id: current.note, ...job.notes[current.note] };
    return view;
  }
  return Object.freeze({ snapshot, startScene, advance, choose, toggleItem, openHint, openExample, replay, canSubmit, submitSay, goTo, hear, closePoint, finishTour, nextScene, openClosing, leave, pause, resume, addActiveMs, reset, serialize: () => clone(data) });
}
