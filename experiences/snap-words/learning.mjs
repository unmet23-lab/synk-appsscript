// 찰칵 낱말 — 공통 학습 기록(설계 5-3). 게임은 판 짜기와 판정을 맡고, 아틀라스는 기록과 다음 연습의 선택을 맡는다. 연습이지 측정(B/C)이 아니다.
// 부탁 = 판을 찍어 답하는 한 문항(보기 = 그 무리의 판들), 인화 = 사진 · 판을 보고 낱말이나 뜻을 고르는 회상 문항이다. 찍기만 한 것은 문항이 아니라 기록하지 않는다.
// 맵은 strata/maps/topik-i.json(tools/build-game-learning.js)이다. 난도(2중 검수 11-04): TOPIK I 칸이라 안내문 2, 그 밖은 짧은 기초 문장 · 낱말 하나라 1.
import { wordOf } from './words.mjs';

export const GAME_ID = 'snap-words';
export const FORMAT = 'single-choice';
// 문항 내용(낱말 · 부탁 글 · 보기)을 바꾸면 그 낱말의 판을 올린다. 계열은 v1 그대로 두어 예전 판을 본 사람에게 반복으로 남는다.
export const ITEM_VERSION = Object.freeze({});

const BASIC_ABOVE = new Set(['water', 'tray', 'copier', 'vending']);   // 기초 낱말 목록 밖의 물건 이름(2중 검수 11-04)
export const difficultyOf = (word) => (wordOf(word)?.band === 'notice' || BASIC_ABOVE.has(word) ? 2 : 1);
export const SKILL = Object.freeze({ meaning: 'ko.reading.vocabulary', word: 'ko.reading.vocabulary', recall: 'ko.reading.vocabulary', notice: 'ko.reading.detail', sound: 'ko.listening.word' });

/** 문항 하나의 기록 칸. form: meaning · word · sound · notice(부탁) / recall-word · recall-meaning(인화). */
export function itemMetadata(form, word) {
  const version = ITEM_VERSION[`${form}.${word}`] || 1, sound = form === 'sound', notice = wordOf(word)?.band === 'notice';
  const skillId = sound ? SKILL.sound : notice || form === 'notice' ? SKILL.notice : SKILL.meaning;
  return { id: `${GAME_ID}.${form}.${word}`, itemKey: `${GAME_ID}.${form}.${word}.v${version}`, familyKey: `${GAME_ID}.${form}.${word}.v1`, skillId,
    difficulty: difficultyOf(word), modality: sound ? 'listening' : 'reading', responseFormat: FORMAT, audioRequired: sound, confounded: false, conceptIds: [] };
}
export const missionMetadata = (m) => itemMetadata(m.kind, m.word);
export const recallMetadata = (q) => itemMetadata(q.mode === 'word' ? 'recall-word' : 'recall-meaning', q.answer);

/** 부탁 후보(뜻 부탁만 — 약한 낱말을 먼저 고르는 데 쓴다). */
export function missionCandidates(place) {
  const out = [];
  for (const group of Object.values(place.groups)) {
    if (group.noMission || group.notice) continue;
    for (const word of group.pool) {
      if (!wordOf(word)?.ask) continue;
      const m = itemMetadata('meaning', word);
      out.push({ id: m.id, word, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds });
    }
  }
  return out;
}

/**
 * 게임이 쓰는 기록 통로. 아틀라스가 없거나 던져도 게임은 그대로 돈다(기록만 빠진다).
 * createCoach: () => 코치(브라우저는 window.SynkLearning.createGame, 시험은 atlas/game-learning.js).
 */
export function createLearning(createCoach) {
  let coach = null;
  try { coach = createCoach() || null; } catch { coach = null; }
  const atlas = (fn, fallback = null) => { if (!coach) return fallback; try { return fn(coach); } catch { return fallback; } };
  const open = new Set();
  const choice = (selectedId, correctId) => ({ selectedId: String(selectedId), correctId: String(correctId) });
  return {
    available: () => !!coach,
    /** 약한 낱말 몇 개(부탁 정답을 먼저 고른다). 기록이 모자라면 빈 목록 — 그때는 앨범 차례대로 고른다. */
    weak(place, count = 2) {
      return atlas((c) => {
        const cands = missionCandidates(place);
        if (!cands.length) return [];
        const r = c.recommend(cands, { audioAvailable: true });
        if (r?.status !== 'ready' || !r.focusSkillId) return [];
        return [r.selected, ...(r.alternatives || [])].map((x) => x.word).filter(Boolean).slice(0, count);
      }, []) || [];
    },
    /** 부탁을 내보였다. */
    present(m) { m.pid = atlas((c) => c.present(missionMetadata(m))); if (m.pid) open.add(m.pid); },
    /** 소리 부탁의 소리를 끝까지 들었다(듣기 문항은 이것이 있어야 평가된다). */
    heard(m) { if (m?.pid) atlas((c) => c.delivery(m.pid, { audio: 'completed' })); },
    /** 정답 낱말이나 자리를 보여 줬다 — 그 뒤의 맞힘은 혼자 해낸 것으로 세지 않는다. */
    helped(m) { if (m?.pid) atlas((c) => c.help(m.pid, 'answer')); },
    /** 찍어서 답했다. attemptNo는 1부터 차례로. */
    answer(m, { correct, selected, attemptNo }) {
      if (!m?.pid) return;
      atlas((c) => c.answer(m.pid, { correct, assessable: true, attemptNo, choice: choice(selected, m.word) }));
      if (correct) open.delete(m.pid);
    },
    /** 인화 한 문제(내보이고 바로 답). */
    recall(q, selected) {
      atlas((c) => { const pid = c.present(recallMetadata(q)); c.answer(pid, { correct: selected === q.answer, assessable: true, choice: choice(selected, q.answer) }); });
    },
    /** 판을 그만두었다: 답하지 않은 부탁을 닫는다. */
    leave() { for (const pid of open) atlas((c) => c.answer(pid, { correct: null, assessable: false, reason: 'unanswered' })); open.clear(); },
  };
}
