export const TUTORIAL_KEY = 'SYNK_RACING_TUTORIAL_V1';

function writableStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

// Only a finished practice run should call saveTutorialCompleted. The tutorial
// controller deliberately has no storage, learning-record or reward side effects.
export function loadTutorial(storage) {
  try {
    if (!writableStorage(storage)) return { completed: false, available: false };
    const raw = storage.getItem(TUTORIAL_KEY);
    if (raw == null) return { completed: false, available: true };
    let saved;
    try { saved = JSON.parse(raw); } catch { return { completed: false, available: true }; }
    return { completed: saved?.version === 1 && saved.completed === true, available: true };
  } catch {
    return { completed: false, available: false };
  }
}

export function saveTutorialCompleted(storage) {
  try {
    if (!writableStorage(storage)) return false;
    storage.setItem(TUTORIAL_KEY, JSON.stringify({ version: 1, completed: true }));
    return true;
  } catch {
    return false;
  }
}

const validAnswer = id => typeof id === 'string' && id.trim().length > 0;

// The chase camera reverses the world-road lateral axis: screen left is a
// positive world offset. Progress requires a real steering observation, rather
// than a held button, elapsed time, or merely opening an instruction.
export function createTutorial({ answerId = 'school' } = {}) {
  if (!validAnswer(answerId)) throw new TypeError('A tutorial answer ID is required.');
  let step = 'steer-left', correctAnswer = answerId, mistakes = 0, boostElapsed = 0;
  return Object.freeze({
    get step() { return step; },
    get mistakes() { return mistakes; },
    get boostElapsed() { return boostElapsed; },
    observeOffset(worldOffset) {
      if (!Number.isFinite(worldOffset)) return false;
      if (step === 'steer-left' && worldOffset >= 1.8) { step = 'steer-right'; return true; }
      if (step === 'steer-right' && worldOffset <= -1.8) { step = 'listen'; return true; }
      return false;
    },
    beginQuestion(nextAnswerId = correctAnswer) {
      if (step !== 'listen' || !validAnswer(nextAnswerId)) return false;
      correctAnswer = nextAnswerId;
      step = 'choose';
      return true;
    },
    resolveAnswer(id) {
      if (step !== 'choose' || !validAnswer(id)) return false;
      if (id !== correctAnswer) { mistakes++; return false; }
      step = 'boost-ready';
      return true;
    },
    activateBoost() {
      if (step !== 'boost-ready') return false;
      step = 'boosting';
      return true;
    },
    tick(deltaSeconds) {
      if (step !== 'boosting' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return false;
      boostElapsed = Math.min(2.5, boostElapsed + deltaSeconds);
      if (boostElapsed >= 2.5) { step = 'complete'; return true; }
      return false;
    }
  });
}
