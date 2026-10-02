import { EPISODE, STORY_VERSION, ACTOR_IDS, PROP_IDS, DESTINATION_IDS, INITIAL_SCENE } from './story.mjs';
import { VOICE_LINE_BY_ID, voiceForDialogue, voiceForFeedback } from './voice-lines.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const ALL_MISSIONS = [...EPISODE.acts.flatMap(act => act.missions), ...EPISODE.review];
const MISSION_IDS = new Set(ALL_MISSIONS.map(mission => mission.id));
const REVIEW_MISSION_IDS = new Set(EPISODE.review.map(mission => mission.id));
const PHASES = new Set(['opening', 'intro', 'play', 'outro', 'ending', 'review', 'complete']);
const AUDIO_SOURCES = new Set(['mission', 'explanation', 'feedback', 'dialogue']);

/** Stateful, deterministic reading practice. No clock and no audio answer. */
export class StoryGame {
  constructor() { this.restart(); }

  get currentAct() {
    if (this.phase === 'review' || this.phase === 'complete') {
      return { id: 'review', title: '새 글로 마지막 정리', subtitle: '그림은 같아도, 글이 바뀌면 행동이 달라져요.', missions: EPISODE.review, intro: [], outro: [] };
    }
    return EPISODE.acts[this.actIndex];
  }

  get missions() { return this.currentAct.missions; }
  get currentLines() {
    if (this.phase === 'opening') return EPISODE.opening;
    if (this.phase === 'intro') return this.currentAct.intro;
    if (this.phase === 'outro') return this.currentAct.outro;
    if (this.phase === 'ending') return EPISODE.ending;
    return [];
  }
  get currentLine() { return this.currentLines[this.dialogueIndex] ?? null; }
  get currentVoiceLine() { return voiceForDialogue(this.phase, this.currentAct.id, this.dialogueIndex); }
  get canUndo() { return this._history.length > 0 && !['opening', 'intro'].includes(this.phase); }

  restart() {
    this.phase = 'opening';
    this.actIndex = 0;
    this.dialogueIndex = 0;
    this.scene = { ...INITIAL_SCENE };
    this.actor = null;
    this.held = null;
    this.completedIds = [];
    this.records = [];
    this.events = [];
    this._history = [];
    return this;
  }

  /** Start at the first scene containing the assigned reading. Keep every
   * request in that scene: sequence prerequisites remain actual player actions.
   * No skipped scene is counted as a completed answer. */
  startPractice(missionIds) {
    const ids=new Set(missionIds);
    const index=EPISODE.acts.findIndex(act=>act.missions.some(m=>ids.has(m.id)));
    if(index<0&&!EPISODE.review.some(m=>ids.has(m.id)))return false;
    this.restart();
    this.actIndex=index<0?EPISODE.acts.length-1:index;
    this.phase=index<0?'review':'intro';
    return true;
  }

  advance() {
    if (['play', 'review', 'complete'].includes(this.phase)) return false;
    if (this.dialogueIndex + 1 < this.currentLines.length) {
      this.dialogueIndex += 1;
      return true;
    }
    this.dialogueIndex = 0;
    if (this.phase === 'opening') this.phase = 'intro';
    else if (this.phase === 'intro') this.phase = 'play';
    else if (this.phase === 'outro') {
      this._history = [];
      this.actor = this.held = null;
      if (this.actIndex < EPISODE.acts.length - 1) {
        this.actIndex += 1;
        this.phase = 'intro';
      } else this.phase = 'ending';
    } else if (this.phase === 'ending') return this.startReview();
    return true;
  }

  selectActor(id) {
    if (!this._playing() || !ACTOR_IDS.includes(id)) return false;
    this.actor = id;
    return true;
  }

  selectObject(id) {
    if (!this._playing() || !PROP_IDS.includes(id)) return false;
    this.held = id;
    return true;
  }

  place(destination) {
    if (!this._playing()) return this._lineFeedback(false, 'unavailable', 'feedback-unavailable-story');
    if (!DESTINATION_IDS.includes(destination)) return this._lineFeedback(false, 'invalid', 'feedback-invalid-destination');
    if (!this.actor || !this.held) return this._lineFeedback(false, 'selection', 'feedback-selection');

    const actor = this.actor;
    const object = this.held;
    const from = this.scene[object];
    const mission = this.missions.find(item => item.object === object);
    if (mission && this.completedIds.includes(mission.id) && actor === mission.actor && destination === mission.destination) {
      this.held = null;
      return this._voiceFeedback(true, 'already', voiceForFeedback(mission, 'already'), mission);
    }

    // Undo changes the scene, never the fact that a first answer or a hint happened.
    this._history.push({
      phase: this.phase, actIndex: this.actIndex, dialogueIndex: this.dialogueIndex,
      scene: { ...this.scene }, actor, held: object, completedIds: [...this.completedIds],
    });
    this.scene[object] = destination;
    this.held = null;

    if (!mission) {
      this.events.push({ type: 'extra-move', act: this.currentAct.id, actor, object, from, destination });
      return { ...this._lineFeedback(false, 'object', 'feedback-extra-object'), moved: { actor, object, from, destination } };
    }

    let kind = 'correct';
    if (actor !== mission.actor) kind = 'actor';
    else if (destination !== mission.destination) kind = 'destination';
    else if ((mission.requires ?? []).some(id => !this.completedIds.includes(id))) kind = 'order';
    const correct = kind === 'correct';
    const record = this._record(mission);
    record.attempts += 1;
    if (record.firstCorrect === null) {
      record.firstCorrect = correct;
      record.firstHelpUsed = record.helpUsed;
      record.firstAudioHelpUsed = record.audioHelpUsed;
    }
    record.responses.push({ actor, object, destination, correct, kind, helpUsed: record.helpUsed, audioHelpUsed: record.audioHelpUsed });
    if (!correct) record.mistakes.push({ attempt: record.attempts, kind, actor, destination });
    record.completed = correct;
    record.corrected = correct && record.mistakes.length > 0;
    this.completedIds = this.completedIds.filter(id => id !== mission.id);
    if (correct) this.completedIds.push(mission.id);

    const actComplete = this.missions.every(item => this.completedIds.includes(item.id));
    if (actComplete) {
      this.phase = this.phase === 'review' ? 'complete' : 'outro';
      this.dialogueIndex = 0;
    }
    const feedback = correct ? this._success(mission) : this._mistake(mission, kind, destination);
    return { ...feedback, mission, actComplete, moved: { actor, object, from, destination } };
  }

  help(missionId) {
    if (!this._playing()) return this._lineFeedback(false, 'unavailable', 'feedback-unavailable-story');
    const mission = missionId
      ? this.missions.find(item => item.id === missionId && !this.completedIds.includes(item.id))
      : this.missions.find(item => item.object === this.held && !this.completedIds.includes(item.id))
        ?? this.missions.find(item => !this.completedIds.includes(item.id));
    if (!mission) return this._lineFeedback(false, 'unavailable', 'feedback-help-unavailable');
    const record = this._record(mission);
    record.helpUsed = true;
    if (record.firstCorrect === null) record.helpBeforeFirst = true;
    record.helpCount += 1;
    return this._voiceFeedback(false, 'help', voiceForFeedback(mission, 'help'), mission);
  }

  /** Call when semantic speech actually starts, not on a click or failed load. */
  markAudioHelp(missionIds = null, { source = 'mission', voiceId = null } = {}) {
    if (!AUDIO_SOURCES.has(source)) return [];
    const ids = missionIds === null
      ? this.missions.filter(item => !this.completedIds.includes(item.id)).map(item => item.id)
      : typeof missionIds === 'string' ? [missionIds] : Array.isArray(missionIds) ? missionIds : [];
    const marked = [];
    for (const id of new Set(ids)) {
      const mission = this.missions.find(item => item.id === id);
      if (!mission) continue;
      const record = this._record(mission);
      const beforeFirst = record.firstCorrect === null;
      record.audioHelpUsed = true;
      record.audioBeforeFirst ||= beforeFirst;
      record.audioHelpCount += 1;
      record.audioHelps.push({ source, voiceId: typeof voiceId === 'string' ? voiceId : null, beforeFirst, afterAttempts: record.attempts });
      marked.push(id);
    }
    return marked;
  }

  undo() {
    if (!this.canUndo) return false;
    const previous = this._history.pop();
    this.phase = previous.phase;
    this.actIndex = previous.actIndex;
    this.dialogueIndex = previous.dialogueIndex;
    this.scene = { ...previous.scene };
    this.actor = previous.actor;
    this.held = previous.held;
    this.completedIds = [...previous.completedIds];
    for (const record of this.records) {
      const wasComplete = record.completed;
      record.completed = this.completedIds.includes(record.id);
      if (wasComplete !== record.completed) record.undoneCount += 1;
      record.corrected = record.completed && record.mistakes.length > 0;
    }
    this.events.push({ type: 'undo', act: this.currentAct.id, object: this.held });
    return true;
  }

  startReview() {
    if (this.phase !== 'ending') return false;
    this.phase = 'review';
    this.dialogueIndex = 0;
    this.actor = this.held = null;
    this._history = [];
    return true;
  }

  snapshot() {
    return clone({
      version: 2, storyVersion: STORY_VERSION, phase: this.phase,
      actIndex: this.actIndex, dialogueIndex: this.dialogueIndex,
      scene: this.scene, actor: this.actor, held: this.held,
      completedIds: this.completedIds, records: this.records,
      events: this.events, history: this._history,
    });
  }

  restore(saved) {
    if (!this._validSnapshot(saved)) return false;
    const state = clone(saved);
    this.phase = state.phase;
    this.actIndex = state.actIndex;
    this.dialogueIndex = state.dialogueIndex;
    this.scene = state.scene;
    this.actor = state.actor;
    this.held = state.held;
    this.completedIds = state.completedIds;
    this.records = state.records;
    this.events = state.events ?? [];
    this._history = state.history ?? [];
    return true;
  }

  _playing() { return this.phase === 'play' || this.phase === 'review'; }
  _record(mission) {
    let record = this.records.find(item => item.id === mission.id);
    if (!record) {
      record = {
        id: mission.id, mode: REVIEW_MISSION_IDS.has(mission.id) ? 'review' : 'story',
        area: 'reading', skill: mission.skill, attempts: 0,
        firstCorrect: null, firstHelpUsed: null, helpUsed: false,
        helpBeforeFirst: false, helpCount: 0, completed: false, corrected: false,
        firstAudioHelpUsed: null, audioHelpUsed: false, audioBeforeFirst: false,
        audioHelpCount: 0, audioHelps: [],
        undoneCount: 0, mistakes: [], responses: [],
      };
      this.records.push(record);
    }
    return record;
  }

  _lineFeedback(correct, kind, id, mission) {
    return this._voiceFeedback(correct, kind, VOICE_LINE_BY_ID[id], mission);
  }

  _voiceFeedback(correct, kind, line, mission) {
    if (!line) throw new Error(`Missing authored feedback: ${kind}/${mission?.id ?? 'general'}`);
    return { correct, kind, speaker: line.speaker, message: line.text, voiceId: line.id, assistanceMissionIds: [...line.assistanceMissionIds], ...(mission ? { mission } : {}) };
  }

  _success(mission) {
    return this._voiceFeedback(true, 'correct', voiceForFeedback(mission, 'correct'), mission);
  }

  _mistake(mission, kind, destination) {
    return this._voiceFeedback(false, kind, voiceForFeedback(mission, kind, destination), mission);
  }

  _validSnapshot(saved) {
    if (!saved || saved.version !== 2 || saved.storyVersion !== STORY_VERSION || !PHASES.has(saved.phase)) return false;
    if (!Number.isInteger(saved.actIndex) || saved.actIndex < 0 || saved.actIndex >= EPISODE.acts.length) return false;
    if (!Number.isInteger(saved.dialogueIndex) || saved.dialogueIndex < 0) return false;
    const validScene = scene => scene && PROP_IDS.every(id => scene[id] === 'floor' || DESTINATION_IDS.includes(scene[id]));
    if (!validScene(saved.scene) || (saved.actor !== null && !ACTOR_IDS.includes(saved.actor)) || (saved.held !== null && !PROP_IDS.includes(saved.held))) return false;
    if (!Array.isArray(saved.completedIds) || saved.completedIds.some(id => !MISSION_IDS.has(id)) || new Set(saved.completedIds).size !== saved.completedIds.length) return false;
    if (!Array.isArray(saved.records) || saved.records.some(record => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return true;
      if (!MISSION_IDS.has(record.id) || !Number.isInteger(record.attempts) || record.attempts < 0 || ![true, false, null].includes(record.firstCorrect) || !Array.isArray(record.responses) || !Array.isArray(record.mistakes)) return true;
      if (record.responses.length !== record.attempts || !Number.isInteger(record.helpCount) || record.helpCount < 0 || !Number.isInteger(record.undoneCount) || record.undoneCount < 0) return true;
      if (['helpUsed', 'helpBeforeFirst', 'completed', 'corrected'].some(key => typeof record[key] !== 'boolean')) return true;
      if (['audioHelpUsed', 'audioBeforeFirst'].some(key => typeof record[key] !== 'boolean')) return true;
      if (!Number.isInteger(record.audioHelpCount) || record.audioHelpCount < 0 || !Array.isArray(record.audioHelps) || record.audioHelps.length !== record.audioHelpCount) return true;
      if (record.audioHelps.some(aid => !aid || !AUDIO_SOURCES.has(aid.source) || typeof aid.beforeFirst !== 'boolean' || !Number.isInteger(aid.afterAttempts) || aid.afterAttempts < 0)) return true;
      if (record.completed !== saved.completedIds.includes(record.id)) return true;
      if (record.attempts === 0 ? record.firstCorrect !== null || record.firstHelpUsed !== null : record.firstCorrect !== record.responses[0]?.correct || record.firstHelpUsed !== record.responses[0]?.helpUsed) return true;
      if (record.attempts === 0 ? record.firstAudioHelpUsed !== null : record.firstAudioHelpUsed !== record.responses[0]?.audioHelpUsed) return true;
      if (record.responses.some(response => !response || typeof response.audioHelpUsed !== 'boolean')) return true;
      return !['story', 'review'].includes(record.mode);
    })) return false;
    if (new Set(saved.records.map(record => record.id)).size !== saved.records.length) return false;
    if (saved.completedIds.some(id => !saved.records.some(record => record.id === id && record.completed))) return false;
    if (saved.events !== undefined && !Array.isArray(saved.events)) return false;
    if (saved.history !== undefined && (!Array.isArray(saved.history) || saved.history.some(state => !state || typeof state !== 'object' || !['play', 'review'].includes(state.phase) || state.actIndex !== saved.actIndex || !validScene(state.scene) || !ACTOR_IDS.includes(state.actor) || !PROP_IDS.includes(state.held) || !Array.isArray(state.completedIds) || state.completedIds.some(id => !MISSION_IDS.has(id))))) return false;
    const lines = saved.phase === 'opening' ? EPISODE.opening : saved.phase === 'intro' ? EPISODE.acts[saved.actIndex].intro : saved.phase === 'outro' ? EPISODE.acts[saved.actIndex].outro : saved.phase === 'ending' ? EPISODE.ending : [];
    if (lines.length && saved.dialogueIndex >= lines.length) return false;
    const active = ['review', 'complete'].includes(saved.phase) ? EPISODE.review : EPISODE.acts[saved.actIndex].missions;
    const allDone = active.every(mission => saved.completedIds.includes(mission.id));
    if ((saved.phase === 'outro' || saved.phase === 'complete') && !allDone) return false;
    if (['play', 'review'].includes(saved.phase) && allDone) return false;
    if (['play', 'review', 'outro', 'complete'].includes(saved.phase) && active.some(mission => saved.completedIds.includes(mission.id) && saved.scene[mission.object] !== mission.destination)) return false;
    return true;
  }
}
