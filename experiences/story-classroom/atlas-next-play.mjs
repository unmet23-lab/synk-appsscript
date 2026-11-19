// 이야기 교실의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7 · §23-8). 새 코치를 키트
// (kit/atlas-next.mjs)로 받아 learning.mjs StoryLearning과 같은 겉으로 잇는다 — app.mjs의 본문은 이 겉을 옛 겉처럼 부른다.
// 이 게임은 WORLD 밖(학습 허브 · 교사 앱 · 계정 과제 · LAB)에서만 열리므로 4-6에서는 로컬 개발 깃발(?atlas=next) 길로만 쓴다. 위 창에 옛
// 학습 호스트가 있으면 깃발이 있어도 옛 길이다(키트 devFlag). app.mjs는 문이나 깃발이 있을 때만 이 파일을 동적으로 싣는다.
//   판      이야기 한 판(장면 셋의 부탁 여섯 + 바뀐 부탁 셋 = 9, 맞춤 연습 · 목표 판은 그보다 짧다)이 판 하나다. 이 게임은 recommend를
//           부르지 않으므로 판 길이를 코치 startSet으로 넘긴다(설계 주인 11-19 밤). 이야기를 열 때(beginRun) 그 코치에 열린 판을 기록 없이
//           닫고, 그 판의 첫 제시 바로 앞에서 키트 setPlay(코치, { length }).open()으로 판을 연다 — length는 app.mjs가 game.missionsAhead()로
//           센 이번 판의 제시 수, 새것 한도는 recommend 길과 같은 3n이다. 길이가 없거나 코치에 startSet이 없으면(앞 판 엔진) 첫 제시가 코치의
//           기본 판(판 옵션 없음 — coach/session.mjs ensure)을 연다. 판은 첫 제시보다 먼저 서고 이야기 가운데 다시 열리지 않는다.
//           판 끝(결과) · 그만두기(입구) · 떠남에 기록 없이 닫는다(endRun · dispose).
//   고르기   없다. 장면의 부탁은 장면 차례로 한꺼번에 present만 한다(제품 차례 — 제시 사건은 모두 arm: host). recommend는 부르지 않는다 —
//           판 옵션(set)을 주면 판을 새로 열어 먼저 낸 부탁이 PRESENTATION_GONE이 되고, set 없이 불러도 코치가 고른 줄을 들고 있어 그
//           부탁의 제시가 arm: adaptive로 남는다(GPT GA3 · 다시 검토 GA4). 활성 탭은 app.mjs의 장면 차례(requires를 채운 첫 부탁)다.
//   답      놓을 때마다 답이다 — 같은 제시의 뒤 답(고쳐 놓기 · 되돌린 뒤 다시 놓기)도 기록되고, 두뇌 판 상태는 첫 판정 답만 움직인다(§23-5).
//           옛 답 꼴을 키트 answerOf로 옮긴다. 이어 하기로 되살린 이미 답한 부탁은 처음이 아니므로 firstExposure: false · confounded로 내고
//           그 답은 판정하지 않는다(reason 'storage' — 옛 길과 같다).
//   도움    글 힌트(답을 알려 줌)는 answer, 실제로 소리가 난 읽어 주기는 replay, 그 밖의 글 도움은 hint. 제시 전의 도움은 제시를 기다린다.
//   표시 설정 자동 읽기의 처음 값은 새 코치의 presentation()(혼자 뜨는 길은 옛 기기 열쇠를 읽는다)을 같은 대응(Flow.declaredFrom ·
//           FLOW_VOICE)으로 읽는다. 순간 맞춤(live)은 쓰지 않는다.
//   오류    code로만 가른다. RUN_ENDED(겉이 닫힘) · 판을 다시 정함(onRetired)이면 이번 판은 기록 없이 잇고, 다음 판(app.mjs start)에서
//           renew로 문을 다시 연다. PRESENTATION_GONE은 그 부탁만 기록 없이 잇는다. 그 밖의 오류는 옛 겉처럼 상태에 남긴다.
// 옛 return-practice · 즉시 확인 · 옛 요약 여섯 상태 · 사건 읽기 · 기록 지우기 · 동기 알림 · 과제는 새 길에서 쓰지 않는다(§23-6) — 그런
// 메서드는 null을 돌려준다.
import { EPISODE } from './story.mjs';
import { FLOW_VOICE, GAME_ID, missionMetadata, resolveLearningHost } from './learning.mjs';
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['story-classroom'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['story-classroom']);
const MISSION_IDS = new Set([...EPISODE.acts.flatMap((act) => act.missions), ...EPISODE.review].map((mission) => mission.id));
const GONE = 'PRESENTATION_GONE';
const QUIET = Object.freeze({ phase: 'quiet', warning: null });

/**
 * 기록의 길을 연다. 새 길이면 새 겉(NextStoryLearning), 문이 지금 판이라고 하면(open이 null) 또는 문도 깃발도 없으면 old()(옛 길 —
 * 지금처럼 만든 StoryLearning). 문이 open을 거절하면(RUN_ENDED — 패널이 닫히는 중이거나 틀 문서가 바뀜) 옛 길을 열지 않고 안내 없이
 * 놀기만 하는 겉, 그 밖의 실패도 옛 길을 열지 않고 「학습 기록을 사용할 수 없어요」 겉을 준다 — 새 길로 정해진 판에 옛 동기가 켜지지 않게.
 */
export async function openStoryLearning({ win = globalThis.window, old = () => null } = {}) {
  let coach;
  try {
    coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  } catch (error) {
    if (!ended(error)) console.error(error);
    return new NextStoryLearning(null, { win, old, quiet: ended(error) });
  }
  return coach ? new NextStoryLearning(coach, { win, old }) : old();
}

/** coach: 키트가 감싼 게임 겉(openNext의 값). 없으면 기록 없이 논다(quiet면 안내도 없이). */
export class NextStoryLearning {
  constructor(coach, { win = globalThis.window, old = () => null, quiet = false } = {}) {
    this.atlasNext = true;
    this.runtime = win;
    this.coach = coach ?? null;
    this.quiet = quiet === true;
    this.restored = false;
    this._old = old;
    this._live = this.coach; // RUN_ENDED를 보거나 판을 다시 정하면 null — 그 판은 기록 없이 잇는다
    this._retired = false;
    this._disposed = false;
    this._error = null;
    this._set = this.coach ? setPlay(this.coach) : null; // 판마다 beginRun이 그 판의 길이로 다시 만든다
    this._open = false; // 이번 판을 열었다(startSet이 판을 주었거나 제시가 나갔다)
    this._renewing = null;
    this._run = 0;
    this._tickets = new Map();
    this._pendingHelp = new Map();
    this._unhear = null;
    try {
      // 판을 다시 정했다 — 겉이 닫혔다. 이번 판은 기록 없이 잇고 다음 판에서 문을 다시 연다(§23-2).
      const off = this.coach?.onRetired?.(() => {
        this._retired = true;
        this._live = null;
      });
      this._unhear = typeof off === 'function' ? off : null;
    } catch {
      // 알림을 걸지 못해도 닫힌 겉의 RUN_ENDED가 같은 일을 한다
    }
  }

  /** 겉이 닫혔다(판을 다시 정함 · RUN_ENDED) — app.mjs가 다음 판을 열 때 renew로 문을 다시 연다. */
  get retired() {
    return Boolean(this.coach) && !this._disposed && (this._retired || !this._live);
  }

  /** 문을 다시 연다 — openStoryLearning과 같은 꼴(새 겉 · 옛 길 · 조용한 겉)을 돌려준다. 여러 번 불러도 한 번만 연다. */
  renew() {
    this._renewing ??= (async () => {
      this._endSet();
      this._unhear?.();
      return openStoryLearning({ win: this.runtime, old: this._old });
    })();
    return this._renewing;
  }

  /** 자동 읽기의 처음 값(true = 스스로 읽음). 옛 겉과 같은 대응이고 값만 새 코치의 표시 설정에서 읽는다. */
  voiceDefault({ target = false } = {}) {
    try {
      const Flow = this.runtime?.SynkLearning?.Flow, presentation = this._call((coach) => coach.presentation());
      if (!Flow?.declaredFrom || !presentation) return !target;
      const index = Flow.declaredFrom(FLOW_VOICE, presentation).knobs.voice;
      return index === undefined ? !target : FLOW_VOICE.knobs[0].values[index] === '자동';
    } catch {
      return !target;
    }
  }

  /** 이야기 한 판을 연다 — 이 코치에 열린 판(앞 이야기 · 같은 코치를 받은 앞 겉의 판)을 기록 없이 닫는다. 새 판은 첫 제시 바로 앞에서
   *  length(이번 판에서 낼 제시 수)로 연다. 공유 기록을 지우지 않는다. */
  beginRun({ restored = false, length = null } = {}) {
    this._endSet({ always: true });
    this._run += 1;
    this.restored = restored === true;
    if (this.coach) this._set = setPlay(this.coach, { length });
    this._tickets.clear();
    this._pendingHelp.clear();
    return this.status();
  }
  resetRun(options = {}) {
    return this.beginRun(options);
  }
  /** 판 끝(결과) · 그만두기(입구) — 판을 기록 없이 닫는다. */
  endRun() {
    this._endSet();
  }

  /** 부탁 글이 실제로 보인 뒤에 부른다. 다시 그려도 한 번만 낸다. 은행에 없는 부탁은 내지 않는다(새 단위로 세어 새것 한도를 깎는다). */
  present(mission, { record = null, visible = true } = {}) {
    if (!visible || !mission || this._tickets.has(mission.id)) return this._tickets.get(mission?.id)?.pid || null;
    let metadata;
    try {
      metadata = missionMetadata(mission);
    } catch (error) {
      this._fail(error);
      return null;
    }
    const historical = this.restored && Number.isInteger(record?.attempts) && record.attempts > 0;
    // 되살린 이미 답한 부탁 — 진행 중이던 제시를 이어 받을 수 없으므로 판정하지 않는 제시로 낸다(옛 길과 같다). 처음 만난 것도 아니다.
    if (historical) metadata.confounded = true;
    if (!this._call((coach) => coach.itemUnits(metadata.itemKey).length > 0)) return null;
    if (!this._open) this._openSet();
    const pid =this._call((coach) => (historical ? coach.present(metadata, { firstExposure: false }) : coach.present(metadata)));
    if (!pid) return null;
    this._open = true;
    const ticket = { pid, mission, historical, offset: historical ? record.attempts : 0, responses: new Map(), count: 0, help: new Set(), gone: false };
    this._tickets.set(mission.id, ticket);
    if (record?.helpUsed) this.help(mission.id, { kind: 'text', revealsAnswer: true, requestId: 'restored-text-help' });
    if (record?.audioHelpUsed) {
      const revealsAnswer = record.audioHelps?.some((h) => ['explanation', 'feedback'].includes(h.source)) || false;
      this.help(mission.id, { kind: 'audio', revealsAnswer, requestId: 'restored-audio-help' });
    }
    for (const help of this._pendingHelp.get(mission.id) || []) this._deliverHelp(ticket, help);
    this._pendingHelp.delete(mission.id);
    return pid;
  }

  /** 소리는 실제로 말이 시작될 때 센다. 보이는 부탁 글 자체는 도움이 아니다. ids는 하나 또는 여럿(제시 전의 소개 대사 포함). */
  help(ids, { kind = 'text', source = null, revealsAnswer = false, requestId = null } = {}) {
    const missionIds = typeof ids === 'string' ? [ids] : Array.isArray(ids) ? ids : [];
    if (!['text', 'audio'].includes(kind)) return [];
    const level = revealsAnswer || ['explanation', 'feedback'].includes(source) ? 'answer' : kind === 'audio' ? 'replay' : 'hint';
    const help = { level, token: `${kind}:${level}:${requestId || source || 'shown'}` };
    const marked = [];
    for (const id of new Set(missionIds)) {
      if (!MISSION_IDS.has(id)) continue;
      const ticket = this._tickets.get(id);
      if (ticket) this._deliverHelp(ticket, help);
      else {
        const pending = this._pendingHelp.get(id) || [];
        if (!pending.some((p) => p.token === help.token)) pending.push(help);
        this._pendingHelp.set(id, pending);
      }
      marked.push(id);
    }
    return marked;
  }

  /** 놓을 때마다 부른다(게임의 누적 시도 수). 같은 시도를 두 번 받으면 처음 것을 돌려준다. 뒤 답도 기록한다 — 판은 첫 판정 답만 움직인다. */
  recordResponse(result, { attemptNo, requestId = null } = {}) {
    if (!result?.mission || ![true, false].includes(result.correct) || result.kind === 'already') return null;
    const ticket = this._tickets.get(result.mission.id);
    if (!ticket || ticket.gone || !this._live || !Number.isInteger(attemptNo) || attemptNo < 1 || attemptNo <= ticket.offset) return null;
    if (ticket.responses.has(attemptNo)) return { ...ticket.responses.get(attemptNo) };
    const relative = attemptNo - ticket.offset;
    if (relative !== ticket.count + 1) {
      this._fail(Object.assign(new Error('Response callback skipped an attempt'), { code: 'INCOMPLETE_GAME_ATTEMPTS' }));
      return null;
    }
    const old = { correct: result.correct, assessable: !ticket.historical, attemptNo: relative, ...(ticket.historical ? { reason: 'storage' } : {}) };
    let gone = false;
    const answer = this._call((coach) => coach.answer(ticket.pid, answerOf(old)), () => (gone = true));
    if (gone) ticket.gone = true;
    if (!answer) return null;
    ticket.count += 1;
    const recorded = { ...answer, missionId: result.mission.id, gameAttemptNo: attemptNo, historical: ticket.historical, ...(requestId ? { requestId } : {}) };
    ticket.responses.set(attemptNo, recorded);
    return { ...recorded };
  }

  summary() {
    return this._call((coach) => coach.summary());
  }
  // 새 길에서 쓰지 않는 옛 겉(§23-6): 놓친 부탁 연습 · 약한 제안 · 과제 · 탭 추천.
  missedPractice() {
    return null;
  }
  supportedOffer() {
    return null;
  }
  assignment() {
    return null;
  }
  recommend() {
    return null;
  }

  status() {
    const scope = resolveLearningHost(this.runtime) ? 'account' : 'device';
    const base = { scope, queued: 0, evidenceComplete: false, canRetry: false, sharing: false };
    // 문이 닫히는 중이었거나 판을 다시 정했다 — 이번 판은 안내 없이 기록 없이 논다.
    if (this.quiet || this.retired) return { ...base, ...QUIET, available: false, code: null };
    const profile = this._call((coach) => coach.summary());
    const available = profile?.storage?.available === true;
    const phase = !available ? 'unavailable' : profile.storage.guest === false ? 'account' : 'device';
    const warning = this._error
      ? '학습 기록 연결을 확인하지 못했어요. 게임은 계속할 수 있어요.'
      : !this.coach
        ? '학습 기록을 사용할 수 없어 이번 이야기만 연습해요.'
        : null;
    return { ...base, phase, available, warning, code: this._error?.code || null };
  }

  /** 진행 저장의 칸 — 신원이 아니다. 손님 진행을 옮겨 받지 않는다(옛 겉과 같은 열쇠). */
  progressScope() {
    const owner = resolveLearningHost(this.runtime);
    const scope = owner ? 'account' : 'device';
    if (this._error) return { scope, key: null, persistent: false };
    if (!owner) return { scope, key: `synk.${GAME_ID}.progress.v3.guest`, persistent: true };
    try {
      const state = owner.status();
      if (!state?.accountKey || !Number.isSafeInteger(state.revision) || ['stopped', 'blocked'].includes(state.phase))
        return { scope, key: null, persistent: false };
      return { scope, key: `synk.${GAME_ID}.progress.v3.account.${encodeURIComponent(state.accountKey)}.r${state.revision}`, persistent: true };
    } catch {
      return { scope, key: null, persistent: false };
    }
  }

  async retry() {
    return this.status();
  }

  /** 떠남(pagehide) — 판을 기록 없이 닫는다. 문을 거친 겉은 키트가 셸에 떠남을 알린다. */
  dispose() {
    if (this._disposed) return;
    this._endSet();
    this._disposed = true;
    this._unhear?.();
    this._tickets.clear();
    this._pendingHelp.clear();
  }

  // 이번 판의 첫 제시 앞 — 판 길이를 코치에 넘겨 판을 연다(startSet). 코치가 판을 주면(이미 열린 판이면 그 판 — opened: false) 판이
  // 열린 것으로 친다. null(길이 없음 · 코치에 startSet 없음 · 겉이 닫힘)이면 이 제시가 기본 판을 연다.
  _openSet() {
    if (!this._live || this._disposed) return;
    try {
      if (this._set.open()) this._open = true;
    } catch (error) {
      this._caught(error);
    }
  }
  // 판을 기록 없이 닫는다. 판 끝 · 그만두기 · 떠남은 이번 판을 열었을 때만, 이야기를 열 때는 늘(always).
  _endSet({ always = false } = {}) {
    if (!this._open && !always) return;
    this._open = false;
    if (!this._live || this._disposed) return;
    try {
      this._set.end();
    } catch (error) {
      this._caught(error);
    }
  }
  _deliverHelp(ticket, help) {
    if (ticket.help.has(help.token)) return;
    if (!ticket.gone) this._call((coach) => coach.help(ticket.pid, help.level), () => (ticket.gone = true));
    ticket.help.add(help.token);
  }
  // 코치 부르기 하나. 실패해도 놀이는 멈추지 않는다 — 오류는 code로만 가른다.
  _call(fn, onGone = null) {
    if (!this._live || this._disposed) return null;
    try {
      return fn(this._live);
    } catch (error) {
      if (error?.code === GONE) onGone?.();
      this._caught(error);
      return null;
    }
  }
  _caught(error) {
    if (ended(error)) this._live = null;
    else if (error?.code !== GONE) this._fail(error);
  }
  _fail(error) {
    this._error = { code: error?.code || 'LEARNING_UNAVAILABLE' };
  }
}
