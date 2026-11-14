'use strict';
// 업무 백업 Rust 시험판 렌더러 브리지. 원래 Electron preload와 같은 window.backup 모양을 제공합니다.
// 모든 메서드는 네이티브 명령 backup_call 하나로만 갑니다. 요청 검증은 네이티브가 직접 합니다.
(function () {
  const SAFE_ERROR = '앱 내부 연결에 문제가 생겼습니다. 앱을 다시 실행해 주세요.';
  const METHODS = [
    'previewRecommended', 'startRecommended', 'backupRecommended', 'restoreRecommended',
    'connectRecovery', 'disconnectRecovery', 'syncRecovery',
    'findRecoveryBackups', 'importAccountRecovery',
    'selectProfile', 'reuseLocalSources', 'setupCloud',
    'updateCloudCredentials', 'recoverCredential',
    'getState', 'chooseSources', 'chooseTarget', 'setup',
    'addSources', 'removeSource',
    'saveRecoveryKit', 'startAutomatic', 'setAutomatic',
    'backupNow', 'restoreLatest', 'checkRepository',
    'protectNow', 'pauseAutomatic', 'resumeAutomatic', 'probeRestore',
    'openFileCatalog', 'queryFileCatalog', 'setFileSelection',
    'closeFileCatalog', 'restoreSelected', 'openSelectedRestoreFolder',
    'importRecoveryKit', 'setLaunchAtLogin', 'openRestoreFolder'
  ];

  const failure = () => ({ ok: false, error: SAFE_ERROR });

  const part = name => {
    const tauri = window.__TAURI__;
    const value = tauri && typeof tauri === 'object' ? tauri[name] : null;
    return value && typeof value === 'object' ? value : null;
  };

  const isEnvelope = r => r !== null && typeof r === 'object' &&
    (r.ok === true || (r.ok === false && typeof r.error === 'string'));

  const call = method => async (...args) => {
    try {
      const core = part('core');
      if (!core || typeof core.invoke !== 'function') return failure();
      const result = await core.invoke('backup_call', { method, args });
      return isEnvelope(result) ? result : failure();
    } catch (_) {
      return failure();
    }
  };

  const release = fn => {
    try {
      const r = fn();
      if (r && typeof r.then === 'function') r.then(undefined, () => {});
    } catch (_) { /* 이미 해제되었거나 연결이 끊김 */ }
  };

  // Promise<cleanup>을 반환합니다. 구독에 실패하면 고정된 안전 오류로 거부되어 앱이 폴링으로 전환합니다.
  const onState = callback => {
    if (typeof callback !== 'function') throw new TypeError('onState callback must be a function');
    let active = true;
    const handler = event => {
      if (!active) return;
      try {
        callback(event !== null && typeof event === 'object' ? event.payload : undefined);
      } catch (error) {
        setTimeout(() => { throw error; }, 0);
      }
    };
    const fail = () => {
      active = false;
      throw new Error(SAFE_ERROR);
    };
    let pending;
    try {
      const events = part('event');
      if (!events || typeof events.listen !== 'function') fail();
      pending = Promise.resolve(events.listen('backup:state', handler));
    } catch (_) {
      active = false;
      return Promise.reject(new Error(SAFE_ERROR));
    }
    return pending.then(fn => {
      if (typeof fn !== 'function') fail();
      let unlisten = fn;
      return () => {
        if (!active) return;
        active = false;
        const f = unlisten;
        unlisten = null;
        if (f) release(f);
      };
    }, fail);
  };

  const api = {};
  for (const name of METHODS) api[name] = call(name);
  api.onState = onState;
  Object.defineProperty(window, 'backup', { value: Object.freeze(api), enumerable: true, configurable: false, writable: false });
})();
