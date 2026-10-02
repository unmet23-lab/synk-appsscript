/**
 * Story supplies the text and semantic response; Atlas owns learning evidence.
 * The wrapper keeps only this run's presentation handles, never another log,
 * authenticated identity, consent decision or proficiency score.
 */
import { EPISODE, STORY_VERSION } from './story.mjs';

export const GAME_ID = 'story-classroom';
export const RESPONSE_FORMAT = 'action';
// Moment-level declaration (Atlas 순간 맞춤 §5): reading the request aloud is help, most help first.
// The help style chosen at the hub reaches it through Core's own mapping (Flow.declaredFrom):
// step-by-step keeps automatic reading, working alone reads only when asked. The person's own
// auto-read button in this game always wins for the session.
export const FLOW_VOICE = Object.freeze({ id: 'story-classroom.voice', version: 1, target: 0.8,
  knobs: Object.freeze([Object.freeze({ id: 'voice', kind: 'support', label: '부탁 읽어 주기', values: Object.freeze(['자동', '누르면']), start: 0 })]) });
export const SKILL_LABELS = Object.freeze({
  'ko.reading.detail': '읽고 대상·위치 찾기',
  'ko.reading.negation': '읽고 부정·변경 이해하기',
  'ko.reading.sequence': '읽고 행동 순서 이해하기',
});
const MAPPING = Object.freeze({
  'cleanup-snacks': ['detail', 1], 'cleanup-paper': ['negation', 2],
  'clue-flowers': ['detail', 1], 'clue-letter': ['sequence', 2],
  'surprise-cake': ['detail', 1], 'surprise-ribbon': ['sequence', 2],
  'review-snacks': ['detail', 1], 'review-paper': ['negation', 2],
  'review-cake': ['sequence', 2],
});
// The TOPIK I grammar each request uses (strata/topik-i.grammar.json): the particles after who
// moves, what moves and where it goes (마린은, 과자를, 상자 안에), then the endings of the sentence
// (놓은 뒤 → -(으)ㄴ 후에). Strata's particleAfter and grammarIn (strata/topik-i-forms.js) read them
// and a test keeps the two the same. Drafts until teachers review them.
export const GRAMMAR = Object.freeze({
  'cleanup-snacks': ['G202', 'G203', 'G206'], 'cleanup-paper': ['G202', 'G203', 'G206'],
  'clue-flowers': ['G202', 'G203', 'G206'], 'clue-letter': ['G202', 'G203', 'G206', 'G406'],
  'surprise-cake': ['G202', 'G203', 'G206'], 'surprise-ribbon': ['G202', 'G203', 'G206', 'G406'],
  'review-snacks': ['G201', 'G203', 'G206'], 'review-paper': ['G202', 'G203', 'G206'],
  'review-cake': ['G202', 'G203', 'G206', 'G406'],
});
const MISSIONS = new Map([...EPISODE.acts.flatMap(act => act.missions), ...EPISODE.review].map(m => [m.id, m]));
const STATUS_LABELS = Object.freeze({
  unseen: '아직 기록이 적어요', checking: '확인하는 중이에요', practice: '조금 더 연습하면 좋아요',
  supported: '도움과 함께 해냈어요', 'recent-independent': '최근 혼자 해냈어요', review: '다시 볼 때예요',
});

export function missionMetadata(mission) {
  const mapped = MAPPING[mission?.id];
  if (!mapped || !MISSIONS.has(mission.id)) throw new TypeError('Authored story mission required');
  const key = `${GAME_ID}.${mission.id}.${STORY_VERSION}`;
  return { id: `${GAME_ID}.${mission.id}`, itemKey: key, familyKey: key,
    skillId: `ko.reading.${mapped[0]}`, difficulty: mapped[1], modality: 'reading',
    responseFormat: RESPONSE_FORMAT, audioRequired: false, confounded: false, conceptIds: [...GRAMMAR[mission.id]] };
}
export function assignmentMissions(missions,target){
  if(!target)return missions;
  return missions.filter(m=>{const meta=missionMetadata(m);return meta.skillId===target.skillId&&meta.difficulty===target.difficulty&&meta.modality===target.modality&&meta.responseFormat===target.responseFormat&&target.familyKeys?.includes(meta.familyKey)&&(!target.itemKeys?.length||target.itemKeys.includes(meta.itemKey));});
}
export function storyTargetLabel(target){return `이번 목표: ${SKILL_LABELS[target.skillId]||'지정 부탁 읽기'} · 난도 ${target.difficulty}. 지정된 ${target.requiredAttempts}개 부탁을 행동으로 옮겨요.`;}

export function missionCandidates(missions) {
  return missions.map(mission => { const m = missionMetadata(mission); return {
    id: m.id, missionId: mission.id, skillIds: [m.skillId], difficulty: m.difficulty,
    modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, conceptIds: m.conceptIds,
  }; });
}

export function resolveLearningHost(runtime = globalThis) {
  if (runtime?.SYNKLearningHost) return runtime.SYNKLearningHost;
  try {
    if (runtime?.parent && runtime.parent !== runtime && runtime.parent.location.origin === runtime.location.origin)
      return runtime.parent.SYNKLearningHost || null;
  } catch { /* An unrelated origin has no implicit account access. */ }
  return null;
}

export function skillReport(summary) {
  if (!summary?.skills) return [];
  return Object.entries(SKILL_LABELS).map(([id, label]) => {
    const skill = summary.skills.find(s => s.id === id);
    const formats = [1, 2, 3].map(d => skill?.levels?.[d]?.formats?.[RESPONSE_FORMAT]).filter(Boolean);
    const observed = formats.filter(f => f.n || f.assisted || f.unassessed);
    const focus = observed.sort((a, b) => b.priority - a.priority)[0];
    const status = focus?.status || 'unseen';
    return { id, label, status, text: STATUS_LABELS[status] || STATUS_LABELS.unseen,
      independent: formats.reduce((n, f) => n + (f.n || 0), 0),
      correct: formats.reduce((n, f) => n + (f.correct || 0), 0),
      assisted: formats.reduce((n, f) => n + (f.assisted || 0), 0),
      unassessed: formats.reduce((n, f) => n + (f.unassessed || 0), 0) };
  });
}

export class StoryLearning {
  constructor({ runtime = globalThis, storage, createGame = null, host, coach = null } = {}) {
    this.runtime = runtime;
    this._explicitHost = host !== undefined;
    this.owner = this._explicitHost ? host : resolveLearningHost(runtime);
    this._error = null;
    this._disposed = false;
    this._run = 0;
    this._tickets = new Map();
    this._pendingHelp = new Map();
    try {
      const factory = createGame || runtime?.SynkLearning?.createGame;
      // The browser factory itself routes through WORLD's guarded host. Do not
      // supply storageScope/accountKey here, or manufacture an account session.
      this.coach = coach || factory?.({ gameId: GAME_ID, storage: storage ?? runtime?.localStorage }) || null;
    } catch (error) { this.coach = null; this._fail(error); }
  }

  /** Automatic reading at the start, from the help style chosen at the hub (true = read aloud by
   * itself). Nothing chosen, no engine or anything unexpected keeps today's default: automatic.
   * A WORLD reading task (`target`) is a check of reading: its requests are read when asked, unless the
   * person chose step-by-step help, which always wins. */
  voiceDefault({ target = false } = {}) {
    try {
      const Flow = this.runtime?.SynkLearning?.Flow, presentation = this.coach?.presentation?.();
      if (!Flow?.declaredFrom || !presentation) return !target;
      const index = Flow.declaredFrom(FLOW_VOICE, presentation).knobs.voice;
      return index === undefined ? !target : FLOW_VOICE.knobs[0].values[index] === '자동';
    } catch { return !target; }
  }

  /** A fresh playthrough, never deletion/reset of the shared learning log. */
  beginRun({ restored = false } = {}) {
    this._run += 1;
    this.restored = restored === true;
    this._tickets.clear();
    this._pendingHelp.clear();
    return this.status();
  }
  resetRun(options = {}) { return this.beginRun(options); }

  /** Call after the mission text is actually visible. Re-renders are idempotent. */
  present(mission, { record = null, visible = true } = {}) {
    if (!visible || !mission || this._tickets.has(mission.id)) return this._tickets.get(mission?.id)?.pid || null;
    let metadata;
    try { metadata = missionMetadata(mission); } catch (error) { this._fail(error); return null; }
    const historical = this.restored && Number.isInteger(record?.attempts) && record.attempts > 0;
    // An active Core presentation cannot be resumed from a game snapshot. A
    // recreated already-answered mission is conservatively unassessed, even if
    // its old Atlas events are unavailable; it cannot become a new first answer.
    if (historical) metadata.confounded = true;
    const pid = this._call('present', metadata);
    if (!pid) return null;
    const ticket = { pid, mission, historical, offset: historical ? record.attempts : 0,
      responses: new Map(), count: 0, help: new Set() };
    this._tickets.set(mission.id, ticket);
    if (record?.helpUsed) this.help(mission.id, { kind: 'text', revealsAnswer: true, requestId: 'restored-text-help' });
    if (record?.audioHelpUsed) {
      const revealsAnswer = record.audioHelps?.some(h => ['explanation', 'feedback'].includes(h.source)) || false;
      this.help(mission.id, { kind: 'audio', revealsAnswer, requestId: 'restored-audio-help' });
    }
    for (const help of this._pendingHelp.get(mission.id) || []) this._deliverHelp(ticket, help);
    this._pendingHelp.delete(mission.id);
    return pid;
  }

  /**
   * Audio counts when semantic speech starts, not a click or failed fetch.
   * Visible mission text itself is reading material, never an optional help.
   * ids may be one ID or an array, including intro clues before text appears.
   */
  help(ids, { kind = 'text', source = null, revealsAnswer = false, requestId = null } = {}) {
    const missionIds = typeof ids === 'string' ? [ids] : Array.isArray(ids) ? ids : [];
    if (!['text', 'audio'].includes(kind)) return [];
    const level = revealsAnswer || ['explanation', 'feedback'].includes(source) ? 'answer' : kind === 'audio' ? 'replay' : 'hint';
    const help = { level, token: `${kind}:${level}:${requestId || source || 'shown'}` };
    const marked = [];
    for (const id of new Set(missionIds)) {
      if (!MISSIONS.has(id)) continue;
      const ticket = this._tickets.get(id);
      if (ticket) this._deliverHelp(ticket, help);
      else {
        const pending = this._pendingHelp.get(id) || [];
        if (!pending.some(p => p.token === help.token)) pending.push(help);
        this._pendingHelp.set(id, pending);
      }
      marked.push(id);
    }
    return marked;
  }

  /** Root supplies Core's absolute attempts count; duplicate callbacks do not log twice. */
  recordResponse(result, { attemptNo, requestId = null } = {}) {
    if (!result?.mission || ![true, false].includes(result.correct) || result.kind === 'already') return null;
    const ticket = this._tickets.get(result.mission.id);
    if (!ticket || !Number.isInteger(attemptNo) || attemptNo < 1 || attemptNo <= ticket.offset) return null;
    if (ticket.responses.has(attemptNo)) return { ...ticket.responses.get(attemptNo) };
    const relative = attemptNo - ticket.offset;
    if (relative !== ticket.count + 1) {
      this._fail(Object.assign(new Error('Response callback skipped an attempt'), { code: 'INCOMPLETE_GAME_ATTEMPTS' }));
      return null;
    }
    const answer = this._call('answer', ticket.pid, { correct: result.correct, assessable: !ticket.historical,
      attemptNo: relative, ...(ticket.historical ? { reason: 'storage' } : {}) });
    if (!answer) return null;
    ticket.count += 1;
    const recorded = { ...answer, missionId: result.mission.id, gameAttemptNo: attemptNo,
      historical: ticket.historical, ...(requestId ? { requestId } : {}) };
    ticket.responses.set(attemptNo, recorded);
    return { ...recorded };
  }

  summary() { return this._call('summary'); }
  assignment() { return typeof this.coach?.assignment==='function'?this._call('assignment'):null; }
  recommend(missions = EPISODE.review) {
    let candidates;
    try { const target=assignmentMissions(missions,this.assignment());candidates = missionCandidates(target.length?target:missions); } catch (error) { this._fail(error); return null; }
    return this._call('recommend', candidates, { audioAvailable: true });
  }

  status() {
    const valid = this._sessionCurrent();
    const profile = valid && this.coach ? this._call('summary') : null;
    let world = null;
    try { world = this.owner?.status?.() || null; } catch (error) { this._fail(error); }
    const available = profile?.storage?.available === true;
    const phase = !valid ? 'ended' : world?.phase || (available ? 'device' : 'unavailable');
    const warning = !valid ? '계정 연결이 바뀌었어요. WORLD에서 게임을 다시 열어 주세요.'
      : profile?.storage?.warning || (this._error ? '학습 기록 연결을 확인하지 못했어요. 게임은 계속할 수 있어요.'
        : !this.coach ? '학습 기록을 사용할 수 없어 이번 이야기만 연습해요.'
          : phase === 'offline' ? '연결을 기다리는 기록이 있어요. 다시 연결하면 전송해요.'
            : phase === 'blocked' ? '계정 기록 연결이 중단됐어요. WORLD에서 연결 상태를 확인해 주세요.' : null);
    return { scope: this.owner ? 'account' : 'device', phase, available, warning,
      code: this._error?.code || world?.code || null, queued: world?.queued || 0,
      evidenceComplete: profile?.evidenceComplete === true,
      canRetry: !!this.owner && valid && phase === 'offline', sharing: !!this.owner && phase !== 'local' };
  }

  /** A partition key, not identity/authentication. Never adopt guest progress. */
  progressScope() {
    if (!this._sessionCurrent() || this._error) return { scope: this.owner ? 'account' : 'device', key: null, persistent: false };
    if (!this.owner) return { scope: 'device', key: `synk.${GAME_ID}.progress.v3.guest`, persistent: true };
    try {
      const state = this.owner.status();
      if (!state?.accountKey || !Number.isSafeInteger(state.revision) || ['stopped', 'blocked'].includes(state.phase))
        return { scope: 'account', key: null, persistent: false };
      return { scope: 'account', key: `synk.${GAME_ID}.progress.v3.account.${encodeURIComponent(state.accountKey)}.r${state.revision}`, persistent: true };
    } catch { return { scope: 'account', key: null, persistent: false }; }
  }

  async retry() {
    if (!this._sessionCurrent()) return this.status();
    try { await this.owner?.retry?.(); } catch (error) { this._fail(error); }
    return this.status();
  }

  dispose() {
    if (this._disposed) return;
    try { this.coach?.disconnect?.(); } catch { /* WORLD may already be closed */ }
    this._disposed = true;
    this._tickets.clear();
    this._pendingHelp.clear();
  }

  _deliverHelp(ticket, help) {
    if (ticket.help.has(help.token)) return;
    this._call('help', ticket.pid, help.level);
    ticket.help.add(help.token);
  }
  _sessionCurrent() {
    if (this._disposed) return false;
    if (!this._explicitHost && resolveLearningHost(this.runtime) !== this.owner) {
      this._fail(Object.assign(new Error('WORLD owner changed'), { code: 'ACCOUNT_SESSION_CHANGED' }));
      return false;
    }
    try { if (this.owner?.status?.().phase === 'stopped') return false; } catch { return false; }
    return true;
  }
  _call(method, ...args) {
    if (!this.coach || !this._sessionCurrent()) return null;
    try { return this.coach[method](...args); } catch (error) { this._fail(error); return null; }
  }
  _fail(error) { this._error = { code: error?.code || 'LEARNING_UNAVAILABLE' }; }
}

export const createStoryLearning = options => new StoryLearning(options);
