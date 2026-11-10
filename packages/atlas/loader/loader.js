/* SYNK Atlas 입구 — EDITION 한 줄이 판 하나를 가리킨다(올리기 · 되돌리기 모두 이 한 줄). 클래식 스크립트로도 ES 모듈로도 부른다.
   const coach = SynkAtlas.coach(options); await coach.ready; — 계약은 packages/atlas/README.md */
(() => {
  'use strict';
  const EDITION = '__ATLAS_EDITION__';
  const METHODS = [
    'recommend',
    'present',
    'help',
    'delivery',
    'answer',
    'exclude',
    'recheck',
    'summary',
    'exposure',
    'finishSet',
    'feedback',
    'live',
    'today',
    'presentation',
    'reset',
    'dispose',
    'plan',
    'due',
    'tell',
  ];
  const TIMEOUT_MS = 20000;
  const scope = globalThis;
  const fail = (code, message, extra) =>
    Object.assign(new Error(`Atlas: ${message}`), { code }, extra);

  const here = scope.SynkAtlas;
  if (here) {
    if (here.edition !== EDITION && Array.isArray(here.conflicts))
      here.conflicts.push({ edition: EDITION, where: 'document' });
    return;
  }

  // 같은 출처의 가장 위 창에 먼저 실린 입구가 있으면 그 판을 따른다.
  const ancestor = () => {
    let found = null;
    try {
      for (let w = scope.window; w && w.parent && w.parent !== w; ) {
        w = w.parent;
        if (w.SynkAtlas) found = w.SynkAtlas;
      }
    } catch {
      // 다른 출처의 창에서 멈춘다.
    }
    return found;
  };

  const baseOf = edition => {
    const script = scope.document && scope.document.currentScript;
    const from =
      script && script.src
        ? script.src
        : scope.location
          ? new URL('/atlas/loader.js', scope.location.href).href
          : null;
    return from ? new URL(`./${edition}/`, from).href : null;
  };

  const above = ancestor();
  const conflicts =
    above && above.edition !== EDITION ? [{ edition: EDITION, where: 'ancestor' }] : [];
  const edition = above ? above.edition : EDITION;
  const base = above ? above.base : baseOf(edition);

  let pending = null;
  const load = (timeoutMs = TIMEOUT_MS) => {
    if (pending) return pending;
    if (!base)
      return Promise.reject(fail('LOAD_FAILED', '판 주소를 정하지 못했다', { reason: 'NO_BASE' }));
    let timer;
    const late = new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            fail('LOAD_FAILED', `판 ${edition}을 ${timeoutMs}ms 안에 받지 못했다`, {
              reason: 'TIMEOUT',
            }),
          ),
        timeoutMs,
      );
    });
    pending = Promise.race([import(`${base}atlas.mjs`), late])
      .then(
        module => {
          if (module.EDITION !== edition)
            throw fail('LOAD_FAILED', `판 ${edition} 자리에 ${module.EDITION}이 있다`, {
              reason: 'EDITION_MISMATCH',
            });
          return module;
        },
        error => {
          throw error && error.code === 'LOAD_FAILED'
            ? error
            : fail('LOAD_FAILED', `판 ${edition}을 받지 못했다`, {
                reason: 'IMPORT',
                cause: error,
              });
        },
      )
      .finally(() => clearTimeout(timer));
    pending.catch(() => {
      pending = null;
    });
    return pending;
  };

  const coach = (options, settings = {}) => {
    let real = null;
    let disposed = false;
    const facade = { edition };
    for (const name of METHODS) {
      facade[name] = (...args) => {
        if (disposed) throw fail('DISPOSED', `${name}: 이미 닫은 코치다`);
        if (!real) throw fail('NOT_READY', `${name}: await coach.ready 뒤에 부른다`);
        return real[name](...args);
      };
    }
    facade.dispose = (...args) => {
      if (disposed) return undefined;
      disposed = true;
      return real ? real.dispose(...args) : undefined;
    };
    facade.ready = load(settings.timeoutMs)
      .then(module => {
        if (disposed) return undefined;
        const made = module.createCoach(options);
        const drop = () => {
          try {
            made.dispose();
          } catch {
            // 아무도 쓰지 않는 코치의 정리다.
          }
        };
        return Promise.resolve(made.ready).then(
          () => {
            if (disposed) drop();
            else real = made;
          },
          error => {
            drop();
            throw error;
          },
        );
      })
      .catch(error => {
        // 닫은 뒤의 실패는 알릴 곳이 없다 — 떠난 화면에 처리되지 않은 거절을 남기지 않는다.
        if (disposed) return undefined;
        throw error;
      });
    return Object.freeze(facade);
  };

  scope.SynkAtlas = Object.freeze({ edition, base, conflicts, load, coach });
})();
