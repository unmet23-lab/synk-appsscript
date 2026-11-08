'use strict';
(function () {
  const api = window.backup;
  const $ = (id) => document.getElementById(id);
  let state = null;
  let pending = false;
  let unsub = null;
  let subscribing = false;
  let pollTimer = null;
  const JOBS = { setup: '백업을 준비하는 중', backup: '백업하는 중', restore: '새 폴더로 복구하고 해시를 확인하는 중', check: '전체 데이터를 점검하는 중 (오래 걸릴 수 있습니다)', import: '기존 백업을 불러오는 중', key: '복구 키를 저장하고 확인하는 중', prune: '오래된 기록을 정리하는 중', credential: '인증 정보를 확인하는 중', credentials: '인증 정보를 확인하는 중' };
  let prefilled = false;
  let initText = null;
  function normEp(v) { return String(v || '').trim().replace(/^https:\/\//i, '').replace(/\/+$/, ''); }
  function savedConn() { return state && state.profile === 'b2' && !state.configured && state.cloudConnection && typeof state.cloudConnection === 'object' ? state.cloudConnection : null; }
  function connMatch() {
    const cc = savedConn();
    if (!cc) return false;
    return normEp($('cEndpoint').value) === normEp(cc.endpoint) && String($('cBucket').value || '').trim() === String(cc.bucket || '') && !!normEp(cc.endpoint);
  }
  function updateReady() {
    const cc = savedConn();
    const m = connMatch();
    const init = !!(state && state.initializing);
    show('savedNote', !!cc && !(init && !m));
    const sel = (state && state.selection) || {};
    const fixed = state && Array.isArray(state.sources) && state.sources.length ? state.sources : sel.sources;
    const list = init ? fixed : sel.sources;
    const n = Array.isArray(list) ? list.length : 0;
    setText('readyNote', init ? '저장된 연결 정보가 준비되어 있습니다. 키 칸을 비워 둔 채 \'연결 다시 시도\'를 눌러 주세요.' : n ? '클라우드 연결 정보가 준비되어 있습니다. \'클라우드 연결 준비\'를 눌러 주세요.' : '클라우드 연결 정보가 준비되어 있습니다. 작업 폴더를 선택해 주세요.');
    show('readyNote', !!cc && m && !$('cKeyId').value && !$('cAppKey').value);
  }
  const SECRETS = ['cKeyId', 'cAppKey', 'iKeyId', 'iAppKey', 'xKeyId', 'xAppKey', 'rKeyId', 'rAppKey'];
  const RETYPE = ' 보안을 위해 키 입력란을 비웠습니다. 키를 다시 입력해 주세요.';

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
  function errText(x) {
    if (typeof x === 'string' && x) return x;
    return '알 수 없는 문제가 발생했습니다. 다시 시도해 주세요.';
  }
  function clearSecrets() { SECRETS.forEach((id) => { $(id).value = ''; }); }
  function takeKeys(a, b) {
    const o = { keyId: String($(a).value || '').trim(), applicationKey: String($(b).value || '').trim() };
    $(a).value = '';
    $(b).value = '';
    return o;
  }
  function keysOk(o) { return !!(o.keyId && o.applicationKey); }
  function normalize(s) {
    if (s && typeof s === 'object' && 'ok' in s) return s.ok ? s.value : null;
    return s;
  }
  function accept(s) {
    s = normalize(s);
    if (!s || typeof s !== 'object') return;
    if (state && s.profile !== state.profile) clearSecrets();
    state = s;
    render();
  }

  async function call(name, arg, stateResult, secret) {
    if (!api || typeof api[name] !== 'function') { showError('앱 기능에 연결할 수 없습니다. 앱을 다시 시작해 주세요.'); return null; }
    if (pending) return null;
    pending = true;
    showError('');
    render();
    try {
      const r = arg === undefined ? await api[name]() : await api[name](arg);
      if (!r || r.ok !== true) { showError(errText(r && r.error) + (secret ? RETYPE : '')); return null; }
      if (stateResult) accept(r.value);
      return r;
    } catch (e) {
      showError('작업을 실행하지 못했습니다: ' + errText(e && e.message) + (secret ? RETYPE : ''));
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
      else showError(errText(r && r.error));
    } catch (e) {
      showError('상태를 불러오지 못했습니다.');
    }
  }

  function summary(x) {
    if (!x || typeof x !== 'object') return '상태를 아직 모릅니다';
    const p = [];
    if (!x.configured) p.push('설정 전');
    else {
      p.push(x.lastBackup ? '최근 성공 ' + fmtTime(x.lastBackup.at) : '아직 백업한 적 없음');
      p.push(x.automatic ? '자동 켜짐' : '자동 꺼짐');
    }
    if (x.job) p.push((JOBS[x.job.kind] || '작업 중'));
    if (x.credentialRequired) p.push('인증 복구 필요');
    if (x.lastError) p.push('문제: ' + x.lastError);
    return p.join(' · ');
  }
  function renderTab(id, sumId, name, s, lock) {
    const x = s && s.profiles ? s.profiles[name] : null;
    const t = $(id);
    t.disabled = lock;
    t.setAttribute('aria-pressed', s && s.profile === name ? 'true' : 'false');
    t.classList.toggle('bad', !!(x && (x.lastError || x.credentialRequired)));
    setText(sumId, s ? summary(x) : '');
  }

  function render() {
    const s = state;
    const lock = pending || !s;
    const act = lock || !!(s && s.job);
    $('app').setAttribute('aria-busy', act ? 'true' : 'false');
    document.querySelectorAll('button, input').forEach((el) => { el.disabled = act; });
    SECRETS.forEach((id) => { $(id).disabled = lock; });
    renderTab('tabLocal', 'sumLocal', 'local', s, lock);
    renderTab('tabB2', 'sumB2', 'b2', s, lock);
    const j = s ? s.job : null;
    show('jobBox', !!j || pending);
    show('jobHint', !!j || pending);
    setText('jobHint', pending ? '요청을 처리하고 있습니다. 잠시 기다려 주세요. 진행 중인 작업은 앱 안에서 취소할 수 없습니다.' : '작업이 실행 중입니다. 진행 중인 작업은 앱 안에서 취소할 수 없습니다. 위의 탭으로 다른 백업 종류는 볼 수 있습니다.');
    if (j) {
      const pct = typeof j.percent === 'number' ? Math.max(0, Math.min(100, Math.round(j.percent))) : null;
      setText('jobText', (JOBS[j.kind] || '작업 중') + (j.stage ? ' · ' + j.stage : '') + (pct !== null ? ' (' + pct + '%)' : ''));
      if (pct !== null) $('jobBar').value = pct; else $('jobBar').removeAttribute('value');
    } else if (pending) {
      setText('jobText', '잠시만 기다려 주세요…');
      $('jobBar').removeAttribute('value');
    }
    if (!s) { ['setupView', 'cloudView', 'credView', 'keyView', 'dashView'].forEach((id) => show(id, false)); return; }
    setText('version', '버전 ' + (s.version || ''));
    const cloud = s.profile === 'b2';
    const restoreMode = s.mode === 'restore';
    const cred = !!s.credentialRequired;
    const kind = cloud ? '클라우드' : '외장·로컬';
    setText('modeLabel', kind + ' · ' + (!s.configured ? (s.initializing ? '연결 준비 중단됨' : '처음 설정') : restoreMode ? '복구 전용 모드' : '백업 모드'));
    show('setupView', !cloud && !s.configured);
    show('cloudView', cloud && !s.configured);
    show('credView', !!s.configured && cred);
    show('keyView', !!s.configured && !restoreMode && !s.recoverySaved && !cred);
    show('keyCloudNote', cloud);
    show('dashView', !!s.configured);
    show('credFields', cloud);
    if (!(cloud && !s.configured)) prefilled = false;
    const sel = s.selection || {};

    if (!s.configured && !cloud) {
      const srcs = Array.isArray(sel.sources) ? sel.sources : [];
      fillList('selSources', srcs);
      setText('selTarget', sel.target || '');
      setText('btnSources', srcs.length ? '폴더 다시 고르기' : '폴더 고르기');
      setText('btnTarget', sel.target ? '저장 위치 다시 고르기' : '저장 위치 고르기');
      $('btnSetup').disabled = act || !srcs.length || !sel.target;
      return;
    }
    if (!s.configured && cloud) {
      const init = !!s.initializing;
      const fixed = Array.isArray(s.sources) && s.sources.length ? s.sources : sel.sources;
      const srcs = Array.isArray(init ? fixed : sel.sources) ? (init ? fixed : sel.sources) : [];
      fillList('cSources', srcs);
      setText('cloudError', s.lastError ? '최근 시도에서 문제가 발생했습니다: ' + s.lastError : '');
      show('cloudError', !!s.lastError);
      show('initNote', init);
      setText('btnCSources', srcs.length ? '폴더 다시 고르기' : '폴더 고르기');
      $('btnCSources').disabled = act || init;
      const lc = s.profiles && s.profiles.local && s.profiles.local.configured;
      show('btnReuse', !!lc);
      $('btnReuse').disabled = act || init;
      const pv = s.provider;
      ['cEndpoint', 'cBucket'].forEach((id) => { $(id).readOnly = init && !!pv; });
      if (init && pv) { $('cEndpoint').value = pv.endpoint || ''; $('cBucket').value = pv.bucket || ''; }
      const cc = s.cloudConnection;
      if (!prefilled) {
        prefilled = true;
        if (cc) {
          if (!$('cEndpoint').value) $('cEndpoint').value = cc.endpoint || '';
          if (!$('cBucket').value) $('cBucket').value = cc.bucket || '';
        }
      }
      if (initText === null) initText = $('initNote').textContent;
      setText('initNote', cc && connMatch() ? '이전 연결 준비가 끝나지 않았습니다. 저장소와 폴더는 그대로 유지됩니다. 저장된 연결 정보로 연결을 다시 시도하세요.' : initText);
      updateReady();
      setText('btnCloudSetup', init ? '연결 다시 시도' : '클라우드 연결 준비');
      $('btnCloudSetup').disabled = act || !srcs.length;
      $('btnCImport').disabled = act || init;
      return;
    }

    setText('lastError', s.lastError ? '최근 시도에서 문제가 발생했습니다: ' + s.lastError : '');
    show('lastError', !!s.lastError);
    setText('warning', s.warning || '');
    show('warning', !!s.warning);
    setText('retryNote', s.retryAfter ? '사용 한도에 도달해 잠시 멈췄습니다. ' + fmtTime(s.retryAfter) + ' 이후 다시 시도합니다.' : '');
    show('retryNote', !!s.retryAfter);

    const iv = Number(s.intervalMinutes) || (cloud ? 60 : 15);
    const days = Number(s.fullCheckDays) || (cloud ? 30 : 1);
    const every = days === 1 ? '하루에 한 번' : days + '일마다';
    const lb = s.lastBackup;
    setText('backupTitle', lb ? '마지막 성공한 백업' : '아직 백업 전');
    $('btnRestore').disabled = act || !lb || cred;
    $('btnCheck').disabled = act || !lb || cred;
    $('btnAuto').disabled = act || cred;
    $('btnNow').disabled = act || cred;
    setText('backupTime', lb ? fmtTime(lb.at) : '아직 완료된 백업이 없습니다');
    setText('backupStats', lb ? '파일 ' + (Number(lb.files) || 0).toLocaleString('ko-KR') + '개 · ' + fmtBytes(lb.bytes) : (restoreMode ? '' : '첫 백업이 끝나면 여기에 표시됩니다.'));
    show('backupActions', !restoreMode && !!s.recoverySaved);
    show('autoState', !restoreMode);
    setText('autoState', cred ? '인증 복구 전까지 자동 백업이 멈춰 있습니다.' : s.automatic ? '자동 백업 켜짐 · ' + iv + '분마다 실행' : s.recoverySaved ? '자동 백업 꺼짐' : '복구 키를 보관하면 백업을 시작할 수 있습니다.');
    const auto = $('btnAuto');
    auto.dataset.action = s.automatic ? 'pause' : lb ? 'resume' : 'start';
    setText('btnAuto', s.automatic ? '자동 백업 일시 중지' : lb ? '자동 백업 다시 시작' : '자동 백업 시작');
    auto.className = s.automatic ? 'btn' : 'btn primary';

    const h = s.health;
    $('healthText').className = 'big' + (h ? (h.status === 'ok' ? ' ok' : ' attention') : '');
    setText('healthText', !h ? '아직 점검 전' : h.status === 'ok' ? '마지막 점검에서 문제가 발견되지 않았습니다' : '확인이 필요합니다');
    setText('healthDetail', h ? fmtTime(h.checkedAt) + ' 점검' + (h.detail ? ' · ' + h.detail : '') + ' (최근 백업 시각과는 별개입니다)' : restoreMode ? '복구 전에 전체 점검을 실행해 볼 수 있습니다. 오래 걸릴 수 있습니다.' : '첫 백업 후 자동으로 진행되고, 이후 ' + every + ' 실행됩니다. 오래 걸릴 수 있습니다.');
    show('checkNote', cloud);
    show('restoreNote', cloud);

    const lr = s.lastRestore;
    show('restoreResult', !!lr);
    if (lr) { setText('restoreTime', fmtTime(lr.at)); setText('restorePath', lr.path); }
    fillList('srcList', s.sources);
    setText('repoLabel', cloud ? '클라우드 저장소' : '백업 위치');
    const pv = s.provider;
    setText('repoPath', cloud ? (pv ? 'B2 · ' + (pv.endpoint || '') + ' · ' + (pv.bucket || '') + (pv.prefix ? ' / ' + pv.prefix : '') : '') : (s.repository || ''));
    show('lifeNote', cloud);
    show('detCloud', cloud);
    show('rotCard', cloud);
    setText('detTiming', '백업할 때마다 구조 점검을 합니다. 전체 데이터 점검은 첫 백업 후 자동으로, 이후 ' + every + ' 진행하며' + (cloud ? ' 데이터를 내려받으므로 다운로드 요금이 생길 수 있습니다.' : ' 데이터가 많으면 오래 걸릴 수 있습니다.') + ' 자동 백업(' + iv + '분마다)은 앱 또는 트레이가 실행 중이고 PC가 깨어 있을 때만 동작합니다.');
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
      if (r && typeof r === 'object' && 'ok' in r) { if (!r.ok) throw new Error('subscribe'); r = r.value; }
      unsub = typeof r === 'function' ? r : function () {};
    } catch (e) {
      startPoll();
    }
  }

  function pickTab(p) {
    if (pending || !state || state.profile === p) return;
    clearSecrets();
    showError('');
    call('selectProfile', p, true);
  }
  function needKeys() { showError('키 ID와 애플리케이션 키를 모두 입력해 주세요.' + RETYPE); }

  $('tabLocal').addEventListener('click', () => pickTab('local'));
  $('tabB2').addEventListener('click', () => pickTab('b2'));
  $('btnSources').addEventListener('click', async () => { await call('chooseSources'); await refresh(); });
  $('btnTarget').addEventListener('click', async () => { await call('chooseTarget'); await refresh(); });
  $('setupForm').addEventListener('submit', (e) => { e.preventDefault(); call('setup', undefined, true); });
  $('btnImport').addEventListener('click', () => call('importRecoveryKit', undefined, true));
  $('btnCSources').addEventListener('click', async () => { await call('chooseSources'); await refresh(); });
  $('btnReuse').addEventListener('click', () => call('reuseLocalSources', undefined, true));
  $('cloudForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (pending) return;
    const k = takeKeys('cKeyId', 'cAppKey');
    const req = { endpoint: String($('cEndpoint').value || '').trim(), bucket: String($('cBucket').value || '').trim(), keyId: k.keyId, applicationKey: k.applicationKey };
    if (!req.endpoint || !req.bucket) { showError('Endpoint와 버킷 이름을 입력해 주세요.' + ((k.keyId || k.applicationKey) ? RETYPE : '')); updateReady(); return; }
    if (!k.keyId && !k.applicationKey) {
      if (!connMatch()) { showError(savedConn() ? '키 ID와 애플리케이션 키를 모두 입력해 주세요. 저장된 연결은 Endpoint와 버킷이 같을 때만 다시 쓸 수 있습니다.' : '키 ID와 애플리케이션 키를 모두 입력해 주세요.'); return; }
    } else if (!keysOk(k)) { showError('키 ID와 애플리케이션 키를 모두 입력하거나, 저장된 연결을 쓰려면 두 칸을 모두 비워 두세요.' + RETYPE); updateReady(); return; }
    updateReady();
    call('setupCloud', req, true, true);
  });
  ['cEndpoint', 'cBucket', 'cKeyId', 'cAppKey'].forEach((id) => { $(id).addEventListener('input', updateReady); });
  $('btnCImport').addEventListener('click', () => {
    if (pending) return;
    const k = takeKeys('iKeyId', 'iAppKey');
    if (!keysOk(k)) { needKeys(); return; }
    call('importRecoveryKit', { keyId: k.keyId, applicationKey: k.applicationKey }, true, true);
  });
  $('btnRecover').addEventListener('click', () => {
    if (pending || !state) return;
    if (state.profile !== 'b2') { call('recoverCredential', undefined, true); return; }
    const k = takeKeys('xKeyId', 'xAppKey');
    if (!keysOk(k)) { needKeys(); return; }
    call('recoverCredential', { keyId: k.keyId, applicationKey: k.applicationKey }, true, true);
  });
  $('btnRotate').addEventListener('click', () => {
    if (pending) return;
    const k = takeKeys('rKeyId', 'rAppKey');
    if (!keysOk(k)) { needKeys(); return; }
    call('updateCloudCredentials', { keyId: k.keyId, applicationKey: k.applicationKey }, true, true);
  });
  $('btnRepair').addEventListener('click', () => {
    if (pending) return;
    const k = takeKeys('rKeyId', 'rAppKey');
    if (!keysOk(k)) { needKeys(); return; }
    call('recoverCredential', { keyId: k.keyId, applicationKey: k.applicationKey }, true, true);
  });
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
    clearSecrets();
    if (unsub) { try { unsub(); } catch (e) { /* ignore */ } }
    if (pollTimer) clearInterval(pollTimer);
  });

  render();
  if (!api) { showError('앱 기능에 연결할 수 없습니다. 앱을 다시 시작해 주세요.'); return; }
  subscribe();
  refresh();
})();
