// 한글 단계 ↔ 아틀라스. 게임은 문항과 판정을 맡고, 아틀라스는 공통 기록을 맡는다.
// 문항 하나 = 아틀라스 문항 하나(present → delivery → help → answer). 그 기록이 다른 게임과 같은 학습 기록에 남고,
// WORLD 계정 호스트 안에서는 그 계정 기록으로 동기화된다(learning-entry.cjs).
// 글자별 진도(만남·익히는 중·익힘·다음 복습)는 이 경험의 판단이라 따로 둔다(core.mjs). 아틀라스의 증거 규칙은
// 문항 묶음의 「첫 시도」를 세는데, 글자 익히기는 같은 글자를 되풀이하는 일이라서다.

export const GAME_ID = 'hangul-stage';
const FORMAT = { build: 'cup-compose', match: 'single-choice' };
const CHOICE = new Set(['listen_pick', 'see_pick', 'pair', 'teach']); // 보기 고르기: 보기 둘이면 binary-choice
const MODALITY = { 'ko.hangul.sound': 'listening', 'ko.hangul.read': 'reading' };
const safe = text => [...text].map(ch => ch.codePointAt(0).toString(36)).join('');

/** 문항 → 아틀라스 문항. 짝 맞추기는 글자 한 쌍이 문항 하나다(pairLetter). */
export function itemMetadata(item, pairLetter = null) {
  const letter = pairLetter || item.target.letter || `w${safe(item.target.text)}`; // 낱말 문항은 낱말이 묶음이다
  const text = pairLetter ? item.cards.find(c => c.letter === pairLetter).voice : item.target.text;
  const options = item.options ? item.options.map(o => safe(o.text)).sort().join('.') : item.pieces ? [...item.pieces.consonants, ...item.pieces.vowels, ...(item.pieces.finals || [])].sort().join('.') : item.cards.map(c => c.letter).sort().join('.');
  const responseFormat = CHOICE.has(item.type) ? (item.options.length === 2 ? 'binary-choice' : 'single-choice') : FORMAT[item.type];
  return { id: `${GAME_ID}.${item.type}.${letter}`, itemKey: `${GAME_ID}.${item.type}.${letter}.${safe(text)}.${options}`.slice(0, 120),
    familyKey: `${GAME_ID}.${item.type}.${letter}`, skillId: item.skill, modality: MODALITY[item.skill], difficulty: item.difficulty,
    responseFormat, audioRequired: item.type !== 'see_pick', confounded: false };
}

// 아틀라스를 쓸 수 없으면(묶음이 없거나 저장 실패) 경험은 그대로 돌고 기록만 남지 않는다.
export function createCoach(win = globalThis.window) {
  try { return win?.SynkLearning?.createGame({ gameId: GAME_ID, storage: win.localStorage }) || null; } catch { return null; }
}
export const isHosted = coach => !!coach && typeof coach.assignment === 'function';

/**
 * 글자 진도를 둘 자리. 혼자 열면 이 기기, WORLD 안에서는 그 계정·학습 동의 판(revision)의 구역이다
 * (synk-account/src/core.mjs의 `synk.account.{id}.r{revision}.` 접두와 같은 이름). 계정을 알 수 없으면 저장하지 않는다.
 */
export function progressKey(win = globalThis.window, coach = null) {
  if (!isHosted(coach)) return 'synk.hangul-stage.v1';
  try {
    const host = win.SYNKLearningHost || (win.parent !== win && win.parent.location.origin === win.location.origin ? win.parent.SYNKLearningHost : null);
    const s = host?.status?.();
    if (s && /^[a-zA-Z0-9_.:-]{1,120}$/.test(String(s.accountKey)) && Number.isInteger(s.revision)) return `synk.account.${s.accountKey}.r${s.revision}.hangul-stage.v1`;
  } catch { /* 다른 출처: 계정 구역을 모르면 저장하지 않는다 */ }
  return null;
}

/** 문항 하나의 기록. 실패해도 경험을 멈추지 않는다. */
export function createRecorder(coach) {
  const call = fn => { if (!coach) return null; try { return fn(); } catch { return null; } };
  return {
    present: (item, pairLetter) => call(() => coach.present(itemMetadata(item, pairLetter))),
    delivered: (pid, ok) => pid && call(() => coach.delivery(pid, { audio: ok ? 'completed' : 'failed' })),
    replay: pid => pid && call(() => coach.help(pid, 'replay')),
    helped: pid => pid && call(() => coach.help(pid, 'hint')),
    shown: pid => pid && call(() => coach.help(pid, 'answer')), // 시범이 이 문항의 답을 보여 준 경우
    answer: (pid, correct) => pid && call(() => coach.answer(pid, { correct, assessable: true })),
    leave: pid => pid && call(() => coach.answer(pid, { correct: null, assessable: false, reason: 'unanswered' })),
    flush: () => call(() => coach.flush?.()),
  };
}
