// 옛 엔진의 두 문(Atlas 재설계 단계 4-5 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §22-4 · world-atlas-next.mjs의 oldEngine). 셸(app-shell.mjs)이
// 새 길 입구를 만들 때 넘기고, 연습 기록 비우기만 부른다.
//   flush() — 계정의 옛 올리기 대기열을 다 올린다. 옛 학습 호스트(window.SYNKLearningHost — account/world-learning-host.js)의 retry로 다시 보내고, 그
//     답의 대기열이 비었을 때만 참이다. 호스트가 없거나, 남았거나, 던지면 거짓이다 — 입구가 아무것도 지우지 않는다(「아직 보내지 못한 기록」).
//   clear({ check, read }?) — 옛 엔진의 손님 기록을 비운다. 옛 손님 코치를 열어 그 기록의 쓰기 임대를 기다린다(다른 창이 쥐고 있으면 한도 뒤
//     STORAGE_BUSY). check가 오면(계정 비우기의 4b) 임대를 쥔 채 read()로 옛 로그를 다시 읽어, check가 참일 때만 비우고 거짓이면 'kept'를 돌려준다
//     (4-5 코드 검수 GPT GA1 — 판단과 비우기 사이에 다른 탭이 옮기지 않은 손님 기록을 쓰면 그 기록까지 지워졌다). 다시 읽기 · 판단 · 비우기는 기다림
//     없이 한 번에 한다 — 임대를 쥔 동안 다른 창은 옛 로그를 쓰지 못한다. 비우면 'cleared'. 연 코치는 늘 닫는다.
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

export function oldEngineDoors({ openGame, host, leaseWaitMs = LEASE_WAIT_MS }) {
  return {
    async flush() {
      try {
        const state = await host()?.retry?.();
        return state?.queued === 0;
      } catch {
        return false;
      }
    },
    async clear({ check = null, read = null } = {}) {
      const game = openGame();
      if (!game) throw Object.assign(new Error('옛 기록을 열지 못했다'), { code: 'STORAGE_ERROR' });
      try {
        await leased(game, leaseWaitMs);
        if (typeof check === 'function' && !check(typeof read === 'function' ? read() : null))
          return 'kept';
        game.reset();
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
