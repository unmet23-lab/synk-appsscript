'use strict';
(function () {
  const api = window.backup;
  const $ = (id) => document.getElementById(id);
  let state = null;
  let pending = false;
  let unsub = null;
  let subscribing = false;
  let pollTimer = null;
  const JOBS = { setup: '백업을 준비하는 중', backup: '백업하는 중', restore: '새 폴더로 복구하고 해시를 확인하는 중', check: '전체 데이터를 점검하는 중 (오래 걸릴 수 있습니다)', import: '기존 백업을 불러오는 중', key: '복구 키를 저장하고 확인하는 중' };

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function fmtBytes(n) {
    n = Number(n) || 0;
    const u = ['바이트', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i ? n.toFixed(1) : String(n)) + ' ' + u[i];
  }
  function setText(id, t) { $(id).textContent = t == null ? '' : String(t); }
  function show(id, on) { $(id).hidden = !on; }
  function fillList(id, items) {
    const ul = $(id);
    ul.replaceChildren();
    (Array.isArray(items) ? items : []).forEach((p) => {
      const li = document.createElement('li');
      li.textContent = String(p);
      ul.appendChild(li);
    });
  }
  function showError(msg) { const box = $('apiError'); box.textContent = msg || ''; box.hidden = !msg; }
  function normalize(s) {
    if (s && typeof s === 'object' && 'ok' in s) return s.ok ? s.value : null;
    return s;
  }
  function accept(s) {
    s = normalize(s);
    if (s && typeof s === 'object') { state = s; render(); }
  }
  function busy() { return pending || !!(state && state.job); }

  async function call(name, arg, stateResult) {
    if (!api || typeof api[name] !== 'function') { showError('앱 기능에 연결할 수 없습니다. 앱을 다시 시작해 주세요.'); return null; }
    if (busy()) return null;
    pending = true;
    showError('');
    render();
    try {
      const r = arg === undefined ? await api[name]() : await api[name](arg);
      if (!r || r.ok !== true) { showError(r && r.error ? String(r.error) : '알 수 없는 문제가 발생했습니다. 다시 시도해 주세요.'); return null; }
      if (stateResult) accept(r.value);
      return r;
    } catch (e) {
      showError('작업을 실행하지 못했습니다: ' + (e && e.message ? e.message : String(e)));
      return null;
    } finally {
      pending = false;
      render();
    }
  }

  async function refresh() {
    if (!api || typeof api.getState !== 'function') return;
    try {
      const r = await api.getState();
      if (r && r.ok) accept(r.value);
      else showError(r && r.error ? String(r.error) : '상태를 불러오지 못했습니다.');
    } catch (e) {
      showError('상태를 불러오지 못했습니다.');
    }
  }

  function render() {
    const s = state;
    const b = busy();
    $('app').setAttribute('aria-busy', b ? 'true' : 'false');
    document.querySelectorAll('button, input').forEach((el) => { el.disabled = b || !s; });
    const j = s ? s.job : null;
    show('jobBox', !!j || pending);
    show('jobHint', !!j);
    if (j) {
      const pct = typeof j.percent === 'number' ? Math.max(0, Math.min(100, Math.round(j.percent))) : null;
      setText('jobText', (JOBS[j.kind] || '작업 중') + (j.stage ? ' · ' + j.stage : '') + (pct !== null ? ' (' + pct + '%)' : ''));
      if (pct !== null) $('jobBar').value = pct; else $('jobBar').removeAttribute('value');
    } else if (pending) {
      setText('jobText', '잠시만 기다려 주세요…');
      $('jobBar').removeAttribute('value');
    }
    if (!s) { ['setupView', 'keyView', 'dashView'].forEach((id) => show(id, false)); return; }
    setText('version', '버전 ' + (s.version || ''));
    const restoreMode = s.mode === 'restore';
    setText('modeLabel', !s.configured ? '처음 설정' : restoreMode ? '복구 전용 모드' : '백업 모드');
    show('setupView', !s.configured);
    show('keyView', s.configured && !restoreMode && !s.recoverySaved);
    show('dashView', !!s.configured);

    if (!s.configured) {
      const sel = s.selection || {};
      const srcs = Array.isArray(sel.sources) ? sel.sources : [];
      fillList('selSources', srcs);
      setText('selTarget', sel.target || '');
      setText('btnSources', srcs.length ? '폴더 다시 고르기' : '폴더 고르기');
      setText('btnTarget', sel.target ? '저장 위치 다시 고르기' : '저장 위치 고르기');
      $('btnSetup').disabled = b || !srcs.length || !sel.target;
      return;
    }

    setText('lastError', s.lastError ? '최근 시도에서 문제가 발생했습니다: ' + s.lastError : '');
    show('lastError', !!s.lastError);
    setText('warning', s.warning || '');
    show('warning', !!s.warning);

    const lb = s.lastBackup;
    setText('backupTitle', lb ? '백업 저장 완료' : '아직 백업 전');
    $('btnRestore').disabled = b || !lb;
    $('btnCheck').disabled = b || !lb;
    setText('backupTime', lb ? fmtTime(lb.at) : '아직 완료된 백업이 없습니다');
    setText('backupStats', lb ? '파일 ' + (Number(lb.files) || 0).toLocaleString('ko-KR') + '개 · ' + fmtBytes(lb.bytes) : (restoreMode ? '' : '첫 백업이 끝나면 여기에 표시됩니다.'));
    show('backupActions', !restoreMode && !!s.recoverySaved);
    show('autoState', !restoreMode);
    setText('autoState', s.automatic ? '자동 백업 켜짐 · 15분마다 실행' : s.recoverySaved ? '자동 백업 꺼짐' : '복구 키를 보관하면 백업을 시작할 수 있습니다.');
    const auto = $('btnAuto');
    auto.dataset.action = s.automatic ? 'pause' : lb ? 'resume' : 'start';
    setText('btnAuto', s.automatic ? '자동 백업 일시 중지' : lb ? '자동 백업 다시 시작' : '자동 백업 시작');
    auto.className = s.automatic ? 'btn' : 'btn primary';

    const h = s.health;
    $('healthText').className = 'big' + (h ? (h.status === 'ok' ? ' ok' : ' attention') : '');
    setText('healthText', !h ? '아직 점검 전' : h.status === 'ok' ? '마지막 점검에서 문제가 발견되지 않았습니다' : '확인이 필요합니다');
    setText('healthDetail', h ? fmtTime(h.checkedAt) + ' 점검' + (h.detail ? ' · ' + h.detail : '') : restoreMode ? '복구 전에 전체 점검을 실행해 볼 수 있습니다. 오래 걸릴 수 있습니다.' : '첫 백업 후 자동으로 진행되고, 이후 하루에 한 번 실행됩니다. 오래 걸릴 수 있습니다.');

    const lr = s.lastRestore;
    show('restoreResult', !!lr);
    if (lr) { setText('restoreTime', fmtTime(lr.at)); setText('restorePath', lr.path); }
    fillList('srcList', s.sources);
    setText('repoPath', s.repository || '');
    show('settings', !restoreMode);
    $('chkLogin').checked = !!s.launchAtLogin;
  }

  function startPoll() { if (!pollTimer) pollTimer = setInterval(refresh, 3000); }
  async function subscribe() {
    if (unsub || subscribing) return;
    subscribing = true;
    if (!api || typeof api.onState !== 'function') { startPoll(); return; }
    try {
      let r = api.onState(accept);
      if (r && typeof r.then === 'function') r = await r;
      if (r && typeof r === 'object' && 'ok' in r) { if (!r.ok) throw new Error(r.error); r = r.value; }
      unsub = typeof r === 'function' ? r : function () {};
    } catch (e) {
      startPoll();
    }
  }

  $('btnSources').addEventListener('click', async () => { await call('chooseSources'); await refresh(); });
  $('btnTarget').addEventListener('click', async () => { await call('chooseTarget'); await refresh(); });
  $('setupForm').addEventListener('submit', (e) => { e.preventDefault(); call('setup', undefined, true); });
  $('btnImport').addEventListener('click', () => call('importRecoveryKit', undefined, true));
  $('btnKey').addEventListener('click', () => call('saveRecoveryKit', undefined, true));
  $('btnAuto').addEventListener('click', (e) => {
    const a = e.currentTarget.dataset.action;
    if (a === 'pause') call('setAutomatic', false, true);
    else if (a === 'resume') call('setAutomatic', true, true);
    else call('startAutomatic', undefined, true);
  });
  $('btnNow').addEventListener('click', () => call('backupNow', undefined, true));
  $('btnCheck').addEventListener('click', () => call('checkRepository', undefined, true));
  $('btnRestore').addEventListener('click', () => call('restoreLatest', undefined, true));
  $('btnOpen').addEventListener('click', () => call('openRestoreFolder'));
  $('chkLogin').addEventListener('change', (e) => { call('setLaunchAtLogin', !!e.target.checked, true); });
  window.addEventListener('beforeunload', () => {
    if (unsub) { try { unsub(); } catch (e) { /* ignore */ } }
    if (pollTimer) clearInterval(pollTimer);
  });

  render();
  if (!api) { showError('앱 기능에 연결할 수 없습니다. 앱을 다시 시작해 주세요.'); return; }
  subscribe();
  refresh();
})();
