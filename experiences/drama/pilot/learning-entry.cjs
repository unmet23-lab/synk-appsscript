'use strict';
// 드라마 말하기 시범판의 학습 기록(Atlas Trail, 응답 꼴 spoken, 2026-11-02). tools/build-drama-learning.mjs가 atlas-learning.js로 묶는다.
// WORLD 게임과 같은 길(experiences/hangul-stage/learning-entry.cjs): 이 창이나 같은 출처 부모 창의 계정 학습 호스트(SYNKLearningHost)가
// 있을 때만 기록하고, 호스트는 계정의 학습 기록 동의가 켜져 있을 때만 서버로 보낸다. 호스트가 없으면(로그인 전 · 이PC 시범) 아무것도
// 남기지 않는다. 사건에는 대사 · 능력 이름 · 판정 · 도움 종류 · 시도 순서만 들고, 받아 적은 글 · 소리는 넣지 않는다.
const { createMap } = require('../../../strata');
const learning = require('../../../atlas/game-learning');
const { createWorldLearningHost } = require('../../synk-account/src/generated/world-learning-host.cjs');
// 드라마 말하기 지도(ko.speaking.*)는 WORLD 지도와 따로 둔다(결정 10-31 ②).
const map = createMap(require('../../../strata/maps/ko-speaking.json'));
const GAME_ID = 'drama-s1';
const factory = config => learning.createGame({ ...config, map });
const engine = Object.freeze({ createGame: factory, createLearningSync: learning.createLearningSync });
const PHASES = ['scene', 'retake', 'transfer'];
// explanation: 장면이 끝난 뒤 그 줄에 준 코치 노트(11-03, 몽골 시범 §7 ①). 노트 종류는 그 줄 마지막 판정 시도의 choice가 말한다.
const HELPS = ['text', 'answer', 'explanation'];
const NOTE_KINDS = ['ending', 'length', 'missing'];
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);

function findHost(win) {
  if (!win) return null;
  if (win.SYNKLearningHost) return win.SYNKLearningHost;
  try { if (win.parent !== win && win.parent.location.origin === win.location.origin) return win.parent.SYNKLearningHost || null; } catch { /* separate origin has no implicit account access */ }
  return null;
}

// 화면이 아는 테이크 결과를 Atlas 답 하나로. 판정이 있는 테이크는 서버가 정한 trail({correct, assessable, reason})을 그대로 쓴다 —
// 「혼자 해 봄」은 검수 통과 명세 · 모범을 보기 전 · 첫 판정 · 규칙이 확신한 것뿐이라 명세를 아는 서버가 정한다(기획 §3-5).
// 받아쓰기를 끈 녹음 · 서버 사정은 연습 시도(판정 없음), 소리가 안 들린 테이크는 대답 없음으로 남긴다.
// 판정 종류(11-03, 몽골 시범 §7 ①): 받아 적힌 테이크는 규칙 판정의 갈래를 choice의 고른 칸에 남긴다 — pass · note-ending · note-length ·
// note-missing · hold(판정 보류) · unclear(글은 받아 적혔지만 한국어인지 · 말 빠르기를 가리지 못함). 장면 · 테이크 2는 그대로 판정 없음
// (unassessed — 결정 10-31 ②)이고, 갈래는 Trail이 받는 기존 칸(choice는 고른 칸 · 맞는 칸 id만)이라 학습 기록 꼴이 바뀌지 않는다.
// 받아 적은 글 · 빠진 낱말(note.word)은 넣지 않는다.
function judgedAs(data) {
  if (data?.status === 'ok') {
    const o = data.observation;
    if (o?.kind === 'pass') return 'pass';
    if (o?.kind === 'note' && NOTE_KINDS.includes(o.note?.kind)) return `note-${o.note.kind}`;
    return 'hold';
  }
  if (data?.status === 'unclear' && String(data.transcript || '').trim()) return 'unclear';
  return null;
}
function answerOf(outcome) {
  if (outcome?.kind === 'result') {
    const t = outcome.data?.trail, judged = judgedAs(outcome.data);
    const choice = judged ? { choice: { selectedId: judged, correctId: 'pass' } } : {};
    if (t && [true, false, null].includes(t.correct) && typeof t.assessable === 'boolean') return { correct: t.correct, assessable: t.assessable, ...(t.reason === 'unanswered' ? { reason: 'unanswered' } : {}), ...choice };
    return { correct: null, assessable: false, ...choice };
  }
  if (outcome?.kind === 'unheard') return { correct: null, assessable: false, reason: 'unanswered' };
  if (outcome?.kind === 'off' || outcome?.kind === 'down') return { correct: null, assessable: false };
  return null;
}

// 차례 하나(장면의 한 줄 · 테이크 2 · 새 상황) = Atlas 보임(present) 하나. 그 차례의 테이크가 시도 1, 2, …가 된다.
// 기록이 실패해도 장면은 멈추지 않는다 — 학습 기록은 곁의 일이다.
function createRecorder({ win = typeof window === 'undefined' ? null : window, owner = findHost(win), onError = () => {} } = {}) {
  if (!owner || typeof owner.createGame !== 'function') return null;
  let coach = null;
  const game = () => coach || (coach = owner.createGame({ gameId: GAME_ID }, factory, learning.createLearningSync));
  const safe = fn => { try { return fn(); } catch (error) { try { onError(error); } catch { /* observers cannot stop the scene */ } return null; } };
  // lazy: 측정 문항을 아끼는 늦은 기록. 그 전의 시도는 남기지 않아 문항을 쓰지 않는다 — 학생은 다음에 다시 할 수 있다.
  //  · true(C, 설계 §17): 판정(맞음 · 고칠 점)이 난 첫 테이크가 올 때 보임 · 도움 · 답을 한꺼번에 남긴다 — 받아쓰기 꺼짐 · 서버 사정 ·
  //    안 들림 · 판정 보류도 남기지 않는다(설계 검토 P1).
  //  · 'transcribed'(B, 11-03 몽골 시범 §7 ④): 받아 적기까지 간 첫 테이크(안 들림 · 판정 보류 포함)가 올 때 남긴다. 받아쓰기 꺼짐 ·
  //    서버 사정(받아 적기 크레딧 소진 등)만 남기지 않는다 — 안 들린 첫 테이크가 「혼자 해 봄」을 쓰는 11-02 규칙은 그대로다(17-1 P2).
  function open({ lineId, skillId, phase, lazy = false }) {
    if (!identifier(lineId) || !PHASES.includes(phase) || map.getNode(skillId)?.kind !== 'skill') return null;
    const present = () => safe(() => game().present({ id: `${GAME_ID}.${phase}.${lineId}`, itemKey: lineId, familyKey: lineId, skillId, modality: 'speaking',
      // 장면 · 테이크 2는 한국어 대사 카드를 보고 말하기(1), 새 상황은 상황만 보고 스스로 만들어 말하기(2).
      difficulty: phase === 'transfer' ? 2 : 1, responseFormat: 'spoken', audioRequired: false }));
    let pid = lazy ? null : present();
    if (!lazy && !pid) return null;
    const helped = new Set(), attempts = [], excluded = new Set();
    return Object.freeze({
      // text: 한국어 대사 카드가 보임, answer: 빈칸을 열었거나 새 상황의 모범을 봄. lazy이면 보이기 전 도움은 모았다가 보일 때 남긴다.
      // 다만 lazy 문항의 모범(answer)을 보면 그 자리에서 보임 · 도움을 남긴다 — 정답을 본 학생이 다음에 다시 와서 「혼자 해 봄」으로 잡히지 않게(화면 검수 A2).
      help(kind) {
        if (!HELPS.includes(kind) || helped.has(kind)) return; helped.add(kind);
        if (!pid && lazy && kind === 'answer') { pid = present(); if (pid) for (const k of helped) safe(() => game().help(pid, k)); return; }
        if (pid) safe(() => game().help(pid, kind));
      },
      // 「혼자 해 봄」은 그 차례의 첫 시도만이다 — Trail은 같은 문항에 앞 시도(안 들린 테이크 포함)가 있으면 반복(repeat)으로 본다(11-02 설계 검토).
      take(outcome) {
        const answered = answerOf(outcome); if (!answered) return null;
        if (!pid) {
          if (lazy === 'transcribed' ? !['result', 'unheard'].includes(outcome?.kind) : ![true, false].includes(answered.correct)) return null;
          pid = present(); if (!pid) return null;
          for (const kind of helped) safe(() => game().help(pid, kind));
        }
        const result = attempts.length && answered.assessable ? { ...answered, assessable: false } : answered;
        const recorded = safe(() => game().answer(pid, { ...result, attemptNo: attempts.length + 1 }));
        if (recorded?.eventId) attempts.push(recorded.eventId);
        return recorded;
      },
      // 「제가 한 말과 달라요」: 그 받아쓰기로 판정한 마지막 시도를 기록에서 뺀다(record.excluded, 결정 10-31 ②).
      excludeLast() { const id = attempts.at(-1); if (id && !excluded.has(id)) { excluded.add(id); safe(() => game().exclude(id)); } },
      // lazy 문항이 기록에 남았는지(그 문항을 쓴 테이크 · 모범 보기가 왔는지) — 화면이 첫 화면 카드를 거둘지 정한다.
      get recorded() { return !!pid; },
    });
  }
  // 7~10일 뒤 처음 보는 문항(설계 §17): Atlas 지연 관측(followups, d7 창)이 이 문항의 측정 칸(같은 게임 · 지도판 · 능력 · 새 상황 난이도 2 ·
  // spoken · speaking)으로 「due」이고, 이 문항을 한 번도 보이지 않았을 때만 참. 기록이 아직 덜 모였으면(동기화 전 · 저장 실패) null —
  // 화면은 잠시 뒤 다시 묻고, 모르면 내보내지 않는다(거짓 관측 · 문항 낭비를 막는다). 리듬 게임 delayedSupplemental과 같은 꼴.
  function delayedDue({ lineId, skillId }) {
    if (!identifier(lineId) || map.getNode(skillId)?.kind !== 'skill') return false;
    return safe(() => {
      const c = game();
      if (typeof c.followups !== 'function' || typeof c.exposure !== 'function') return false;
      const report = c.followups();
      if (report?.evidenceComplete !== true) return null;
      const due = report.items.some(row => row.status === 'due' && row.window === 'd7' && row.gameId === GAME_ID
        && row.measure.taskVersion === map.map_ver && row.measure.skillId === skillId && row.measure.difficulty === 2
        && row.measure.responseFormat === 'spoken' && row.measure.modality === 'speaking' && row.measure.audioRequired === false);
      if (!due) return false;
      const seen = c.exposure({ itemKey: lineId, familyKey: lineId }).seen;
      return seen === false ? true : seen === true ? false : null;
    });
  }
  // 이 계정이 그 대사를 본 적이 있는지(Atlas 노출 — 접힌 기록 포함). 기록이 아직 덜 모였으면 null. 받아쓰기가 막혀 남겨 둔 새 상황(B)을
  // 첫 화면에서 다시 내밀지 정할 때 쓴다(장면 줄은 봤고 B는 안 봄).
  function seen(lineId) {
    if (!identifier(lineId)) return null;
    return safe(() => { const v = game().exposure({ itemKey: lineId, familyKey: lineId }).seen; return v === true || v === false ? v : null; });
  }
  return Object.freeze({ open, delayedDue, seen, flush: () => safe(() => coach?.flush?.()) });
}

// 이PC 시범 서버의 리허설 계정(합성 계정)으로 왕복을 볼 때만 쓴다. WORLD 안에서는 WORLD가 세운 호스트를 쓴다(findHost).
function createRehearsalHost({ accountKey, revision, connected, transport, storage, win = typeof window === 'undefined' ? null : window }) {
  const prefix = `synk.drama.rehearsal.${accountKey}.r${revision}.`;
  const scoped = { getItem: key => storage.getItem(prefix + key), setItem: (key, value) => storage.setItem(prefix + key, value), removeItem: key => storage.removeItem(prefix + key) };
  const host = createWorldLearningHost({ accountKey, revision, connected, guard: () => {}, engine, storage: scoped, ...(connected ? { transport } : {}) });
  if (win) win.SYNKLearningHost = host;
  return host;
}

module.exports = { GAME_ID, mapVersion: map.map_ver, engine, answerOf, judgedAs, createRecorder, createRehearsalHost };
