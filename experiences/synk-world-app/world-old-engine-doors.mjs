// 옛 엔진의 두 문(Atlas 재설계 단계 4-5 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §22-4 · world-atlas-next.mjs의 oldEngine). 셸(app-shell.mjs)이
// 새 길 입구를 만들 때 넘기고, 연습 기록 비우기만 부른다.
//   flush() — 계정의 옛 올리기 대기열을 다 올린다. 옛 학습 호스트(window.SYNKLearningHost — account/world-learning-host.js)의 retry로 다시 보내고, 그
//     답의 대기열이 비었고 동기화가 막힘 · 쉼 · 오류 없이 섰을 때만 참이다. 서버가 사건을 받지 않아 옛 동기화가 막혔으면 { ok: false, code:
//     'UNSENT_SKIPPED', skipped }다 — 그 사건은 지금 보낼 수 없어, 입구가 수를 알려 한 번 더 묻는다(4-5 Opus 대체 설계 검토 F4). 수는 호스트가
//     기록부에서 다시 센 것이다(막힌 뒤에 든 답까지 — GC1), 다시 세지 못하면 거짓이다. 호스트가
//     없거나, 남았거나, 다른 탭이 임대를 쥐었거나, 던지면 거짓이다 — 입구가 아무것도 지우지 않는다(「아직 보내지 못한 기록」).
//   clear({ check, read, wait }?) — 옛 엔진의 손님 기록을 비운다. 옛 손님 코치를 열어 그 기록의 쓰기 임대를 기다린다(다른 창이 쥐고 있으면
//     한도 뒤 STORAGE_BUSY — wait로 한도를 준다. 남은 걸음은 0이라 기다리지 않는다, F7). check가 오면(계정 비우기의 4b) 임대를 쥔 채 read()로 옛 로그를 다시 읽어, check가 참일 때만 비우고 거짓이면 'kept'를 돌려준다
//     (4-5 코드 검수 GA1 — 판단과 비우기 사이에 다른 탭이 옮기지 않은 손님 기록을 쓰면 그 기록까지 지워졌다). 다시 읽기 · 판단 · 비우기는 기다림
//     없이 한 번에 한다 — 임대를 쥔 동안 다른 창은 옛 로그를 쓰지 못한다. 손님이 고른 화면 값은 남긴다. 비우면 'cleared'. 연 코치는 늘 닫는다.
// openGame(): 옛 손님 코치(셸 — worldLearning.engine.createGame, 기기 저장소). host(): 옛 학습 호스트(없으면 null).
export const LEASE_WAIT_MS = 3000;

const busy = () =>
  Object.assign(new Error('옛 기록을 다른 창이 쥐고 있다'), { code: 'STORAGE_BUSY' });

// 쓰기 임대를 받을 때까지 기다린다(옛 코치의 요약이 storage.available을 참으로 낼 때). 한도를 넘으면 STORAGE_BUSY.
function leased(game, wait) {
  const ready = () => {
    try {
      return game.summary()?.storage?.available === true;
    } catch {
      return false;
    }
  };
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let off = () => {};
    const timer = setTimeout(() => {
      off();
      reject(busy());
    }, wait);
    try {
      off = game.syncPort.subscribe(() => {
        if (!ready()) return;
        clearTimeout(timer);
        off();
        resolve();
      });
    } catch {
      clearTimeout(timer);
      reject(busy());
    }
  });
}

// 옛 동기화가 대기열을 실제로 다 올린 상태인가 — 대기열 0만으로는 모른다. 쓰기 임대가 없는 탭의 retry는 공유 대기열을 다시 읽지 않고 이 탭이
// 마지막으로 읽은 수를 offline · STORAGE_BUSY와 함께 돌려준다. 그래서 막힘 · 쉼 · 오류가 없는 상태(synced · idle, code 없음)일 때만 0을 믿는다
// (4-5 Opus 대체 설계 검토 F1 — 다른 탭이 임대를 쥔 채 못 올린 숙제 답이 판이 오르며 버려지던 것). 셸의 다른 기다림(quietTownCheck)과 같은 꼴이다.
const drained = state =>
  state?.queued === 0 && (state.phase === 'synced' || state.phase === 'idle') && !state.code;

// 옛 동기화가 서버가 사건을 받지 않아 막혔나 — 그 대기열의 사건은 지금 보낼 수 없다(atlas/learning-sync.js의 FATAL 가운데 사건을 거절한 것).
// 계정 · 동의 · 인증 · 저장소 · 답 꼴 까닭의 막힘은 사건 탓이 아니라 들지 않는다 — 그때는 비우기도 서버에 닿지 못하거나 다시 해 볼 일이다.
const REFUSED = new Set(['EVENT_CONFLICT', 'INVALID_EVENTS', 'HISTORY_FOLDED', 'EVENT_RUN_CONFLICT', 'EVENT_BEFORE_RUN', 'WRONG_RUN_CONTENT', 'FORBIDDEN']);
const refused = state =>
  state?.phase === 'blocked' && REFUSED.has(state.code) && Number.isSafeInteger(state.queued) && state.queued > 0;

export function oldEngineDoors({ openGame, host, leaseWaitMs = LEASE_WAIT_MS }) {
  return {
    async flush() {
      try {
        const owner = host();
        const state = await owner?.retry?.();
        if (drained(state)) return true;
        if (!refused(state)) return false;
        // 막힌 동기화는 막힌 뒤의 답을 대기열에 모으지 않아 그 수(queued)가 낡는다 — 쓰기 임대를 쥔 탭이 기록부에서 서버가 받지 않은 사건을 다시
        // 센다(옛 학습 호스트의 unsent). 셀 수 없으면(임대 없음 · 다시 세지 못하는 호스트) 아무것도 지우지 않는다(4-5 끝 판 GC1 — 막힌 뒤에
        // 낸 답까지 학생이 확인한 수보다 많이 지워졌다).
        const left = owner.unsent?.();
        return Number.isSafeInteger(left) && left > 0 ? { ok: false, code: 'UNSENT_SKIPPED', skipped: left } : false;
      } catch {
        return false;
      }
    },
    async clear({ check = null, read = null, wait = null } = {}) {
      const game = openGame();
      if (!game) throw Object.assign(new Error('옛 기록을 열지 못했다'), { code: 'STORAGE_ERROR' });
      try {
        await leased(game, Number.isFinite(wait) && wait >= 0 ? wait : leaseWaitMs);
        if (typeof check === 'function' && !check(typeof read === 'function' ? read() : null))
          return 'kept';
        // 손님이 고른 화면 값은 남긴다(설계 주인 답 5) — 옛 reset은 .flow · .today와 함께 .presentation도 지우므로, 임대를 쥔 같은 동기 구간에서
        // 읽어 두었다가 다시 쓴다(4-5 Opus 대체 설계 검토 F2). 다시 쓰지 못해도 비우기는 된 것이다.
        let kept = null;
        try {
          kept = game.presentation?.() ?? null;
        } catch {
          kept = null;
        }
        game.reset();
        if (kept)
          try {
            game.setPresentation(kept);
          } catch {
            // 화면 값은 다음에 학생이 다시 고른다 — 비우기의 결과는 그대로다.
          }
        return 'cleared';
      } finally {
        try {
          game.dispose?.();
        } catch {
          // 닫기 실패는 비우기의 결과를 바꾸지 않는다.
        }
      }
    },
  };
}
