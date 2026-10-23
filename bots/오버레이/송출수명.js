'use strict';

// 한 번의 송출이 만든 자원만 소유한다. 중간 시작 실패도 같은 종료 경로를 쓴다.
function 만들기({ timers = globalThis } = {}) {
  const controller = new AbortController();
  const disposers = [];
  let stopping = null, stopResult = null, finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const check = () => controller.signal.throwIfAborted();
  function own(dispose) {
    if (controller.signal.aborted) { void Promise.resolve().then(() => dispose(stopResult)).catch(() => {}); }
    else disposers.push(dispose);
    return dispose;
  }
  function interval(fn, ms) {
    check();
    const timer = timers.setInterval(() => { if (!controller.signal.aborted) fn(); }, ms);
    own(() => timers.clearInterval(timer));
    return timer;
  }
  function wait(ms) {
    check();
    return new Promise((resolve, reject) => {
      const abort = () => { timers.clearTimeout(timer); reject(controller.signal.reason); };
      const timer = timers.setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, ms);
      controller.signal.addEventListener('abort', abort, { once: true });
    });
  }
  function stop(result = { code: 0 }) {
    if (stopping) return stopping;
    // Abort listeners can call stop again synchronously.
    let settle;
    stopping = new Promise((resolve) => { settle = resolve; });
    stopResult = result;
    controller.abort(new DOMException('송출을 종료했습니다', 'AbortError'));
    Promise.allSettled(disposers.splice(0).reverse().map((dispose) => Promise.resolve().then(() => dispose(result))))
      .then(() => { finish(result); settle(result); });
    return stopping;
  }
  return { signal: controller.signal, own, interval, wait, check, stop, done };
}

module.exports = { 만들기 };
