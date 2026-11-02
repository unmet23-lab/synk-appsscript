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
const HELPS = ['text', 'answer'];
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
function answerOf(outcome) {
  if (outcome?.kind === 'result') {
    const t = outcome.data?.trail;
    if (t && [true, false, null].includes(t.correct) && typeof t.assessable === 'boolean') return { correct: t.correct, assessable: t.assessable, ...(t.reason === 'unanswered' ? { reason: 'unanswered' } : {}) };
    return { correct: null, assessable: false };
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
  function open({ lineId, skillId, phase }) {
    if (!identifier(lineId) || !PHASES.includes(phase) || map.getNode(skillId)?.kind !== 'skill') return null;
    const pid = safe(() => game().present({ id: `${GAME_ID}.${phase}.${lineId}`, itemKey: lineId, familyKey: lineId, skillId, modality: 'speaking',
      // 장면 · 테이크 2는 한국어 대사 카드를 보고 말하기(1), 새 상황은 상황만 보고 스스로 만들어 말하기(2).
      difficulty: phase === 'transfer' ? 2 : 1, responseFormat: 'spoken', audioRequired: false }));
    if (!pid) return null;
    const helped = new Set(), attempts = [], excluded = new Set();
    return Object.freeze({
      // text: 한국어 대사 카드가 보임, answer: 빈칸을 열었거나 새 상황의 모범을 봄.
      help(kind) { if (!HELPS.includes(kind) || helped.has(kind)) return; helped.add(kind); safe(() => game().help(pid, kind)); },
      // 「혼자 해 봄」은 그 차례의 첫 시도만이다 — Trail은 같은 문항에 앞 시도(안 들린 테이크 포함)가 있으면 반복(repeat)으로 본다(11-02 설계 검토).
      take(outcome) {
        const answered = answerOf(outcome); if (!answered) return null;
        const result = attempts.length && answered.assessable ? { ...answered, assessable: false } : answered;
        const recorded = safe(() => game().answer(pid, { ...result, attemptNo: attempts.length + 1 }));
        if (recorded?.eventId) attempts.push(recorded.eventId);
        return recorded;
      },
      // 「제가 한 말과 달라요」: 그 받아쓰기로 판정한 마지막 시도를 기록에서 뺀다(record.excluded, 결정 10-31 ②).
      excludeLast() { const id = attempts.at(-1); if (id && !excluded.has(id)) { excluded.add(id); safe(() => game().exclude(id)); } },
    });
  }
  return Object.freeze({ open, flush: () => safe(() => coach?.flush?.()) });
}

// 이PC 시범 서버의 리허설 계정(합성 계정)으로 왕복을 볼 때만 쓴다. WORLD 안에서는 WORLD가 세운 호스트를 쓴다(findHost).
function createRehearsalHost({ accountKey, revision, connected, transport, storage, win = typeof window === 'undefined' ? null : window }) {
  const prefix = `synk.drama.rehearsal.${accountKey}.r${revision}.`;
  const scoped = { getItem: key => storage.getItem(prefix + key), setItem: (key, value) => storage.setItem(prefix + key, value), removeItem: key => storage.removeItem(prefix + key) };
  const host = createWorldLearningHost({ accountKey, revision, connected, guard: () => {}, engine, storage: scoped, ...(connected ? { transport } : {}) });
  if (win) win.SYNKLearningHost = host;
  return host;
}

module.exports = { GAME_ID, mapVersion: map.map_ver, engine, answerOf, createRecorder, createRehearsalHost };
