'use strict';
(function () {
  const api = window.backup;
  const $ = (id) => document.getElementById(id);
  let state = null;
  let pending = false;
  let unsub = null;
  let subscribing = false;
  let pollTimer = null;
  const JOBS = { setup: '백업을 준비하는 중', backup: '백업하는 중', protect: '보호를 시작하는 중', probe: '작은 파일 1개로 복구를 시험하는 중', restore: '새 폴더로 복구하고 해시를 확인하는 중', check: '전체 데이터를 점검하는 중 (오래 걸릴 수 있습니다)', import: '기존 백업을 불러오는 중', key: '복구 키를 저장하고 확인하는 중', prune: '오래된 기록을 정리하는 중', credential: '인증 정보를 확인하는 중', credentials: '인증 정보를 확인하는 중' };
  const PHASE = { startup: 'Windows 시작 등록 확인', enable: '자동 백업 켜기', backup: '백업 실행', done: '완료', failed: '실패' };
  const LEVELS = ['running', 'restoreOnly', 'setup', 'attention', 'paused', 'off', 'partial', 'active'];
  let prefilled = false;
  let recoSearched = false;
  let candKey = '';
  let initText = null;
  let connecting = false;
  let recoNeedPrev = null;
  let recoForce = false;
  let heroAction = 'none';
  Object.assign(JOBS, { restoreSelected: '골라 둔 파일을 새 폴더로 복구하고 해시를 확인하는 중', selectedRestore: '골라 둔 파일을 새 폴더로 복구하고 해시를 확인하는 중', catalog: '파일 목록을 불러오는 중' });
  const PK_PAGE = 100;
  const pk = { open: false, profile: null, token: null, meta: null, page: null, seq: 0, msg: '', note: '', offer: '', started: false, watchAt: null, watchErr: null, dirty: false };
  const PK_MSG = {
    CATALOG_EXPIRED: '파일 목록이 만료되었거나 닫혔습니다(목록은 연 뒤 30분 동안만 쓸 수 있습니다). 골라 둔 선택은 비워졌습니다. ‘다시 불러오기’를 눌러 주세요.',
    SELECTION_LIMIT: '한 번에 최대 1,000개까지 고를 수 있습니다. 선택은 바뀌지 않았습니다. 검색어를 좁히거나 나눠서 복구해 주세요.',
    CATALOG_TOO_LARGE: '백업에 파일이 너무 많아 목록을 만들 수 없습니다. ‘전체 복구로 진행’으로 모든 파일을 새 폴더에 복구해 주세요.',
    UNSAFE_MANIFEST: '백업 안에 Windows에서 그대로 만들 수 없는 이름이나 경로(대소문자만 다른 이름 등)가 있어 안전하게 복구할 수 없습니다. 선택한 항목은 복구하지 않았습니다.',
    SNAPSHOT_GONE: '목록을 연 뒤 이 백업본이 정리되어 더 이상 없습니다. 다른 백업으로 바꾸지 않았습니다. 선택은 비워졌으니 ‘다시 불러오기’를 눌러 주세요.',
    REPOSITORY_CHANGED: '백업 저장소가 목록을 열 때와 달라졌습니다. 선택은 비워졌으니 ‘다시 불러오기’를 눌러 주세요.',
    CREDENTIAL_REQUIRED: '인증 정보를 다시 연결해야 합니다. 인증을 복구한 뒤 다시 시도해 주세요.',
    NO_SNAPSHOT: '아직 완료된 백업이 없어 고를 파일이 없습니다.',
    NOT_CONFIGURED: '백업 설정이 끝나지 않았습니다.',
    JOB_BUSY: '다른 작업이 진행 중입니다. 끝난 뒤 다시 시도해 주세요.',
    DIALOG_BUSY: '다른 창이 열려 있습니다. 그 창을 닫은 뒤 다시 시도해 주세요.',
    QUERY_INVALID: '검색어가 200자를 넘거나 쓸 수 없는 문자가 들어 있습니다.',
    SELECTION_STALE: '선택 상태가 바뀌어 목록을 다시 불러왔습니다. 확인한 뒤 다시 눌러 주세요.',
    SELECTION_EMPTY: '복구할 파일을 먼저 골라 주세요.',
    REMOTE_MAINTENANCE: '저장소를 정리하는 중이라 지금은 복구할 수 없습니다. 잠시 뒤 다시 시도해 주세요.',
    OUTPUT_UNSAFE: '그 위치에는 복구할 수 없습니다. 보호 중인 폴더나 백업 저장소와 겹치지 않는 다른 위치를 골라 주세요.',
    NO_SPACE: '고른 위치에 공간이 부족합니다. 폴더는 만들지 않았습니다. 다른 위치를 골라 주세요.',
    INTEGRITY_FAILED: '백업의 파일 정보가 목록과 맞지 않아 복구를 멈췄습니다. 점검 기록에서 전체 점검을 권합니다.'
  };
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
    setText('readyNote', init ? '저장된 연결 정보가 준비되어 있습니다. 키 칸을 비워 둔 채 ‘연결 다시 시도’를 눌러 주세요.' : n ? '클라우드 연결 정보가 준비되어 있습니다. ‘클라우드 연결 준비’를 눌러 주세요.' : '클라우드 연결 정보가 준비되어 있습니다. 작업 폴더를 선택해 주세요.');
    show('readyNote', !!cc && m && !$('cKeyId').value && !$('cAppKey').value);
  }
  const SECRETS = ['cKeyId', 'cAppKey', 'iKeyId', 'iAppKey', 'xKeyId', 'xAppKey', 'rKeyId', 'rAppKey'];
  const RETYPE = ' 보안을 위해 키 입력란을 비웠습니다. 키를 다시 입력해 주세요.';

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function ts(iso) { const t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }
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
    if (state && s.profile !== state.profile) { clearSecrets(); recoNeedPrev = null; pkReset(true); }
    state = s;
    render();
  }
  function goTo(id) {
    const el = $(id);
    if (!el) return;
    let d = el.closest('details');
    while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ }
    if (!el.disabled && !el.hidden) el.focus();
  }

  function pkNum(x) { return (Number(x) || 0).toLocaleString('ko-KR'); }
  function pkReset(close) {
    pk.seq++; pk.token = null; pk.meta = null; pk.page = null; pk.dirty = true;
    if (close) { pk.open = false; pk.profile = null; pk.msg = ''; pk.note = ''; pk.offer = ''; pk.started = false; }
  }
  function pkRev() { const x = pk.meta && pk.meta.selection; return x && Number.isInteger(x.revision) ? x.revision : 0; }
  function pkOkMeta(v) { return !!(v && typeof v === 'object' && typeof v.token === 'string' && v.selection && typeof v.selection === 'object'); }
  function pkLive() {
    if (!pk.token || !pk.meta) return false;
    const e = ts(pk.meta.expiresAt);
    if (e && Date.now() >= e) { pkReset(false); pk.offer = 'refresh'; pk.msg = PK_MSG.CATALOG_EXPIRED; return false; }
    return true;
  }
  function pkFail(res) {
    const c = res && typeof res.code === 'string' ? res.code : '';
    if (['CATALOG_EXPIRED', 'SNAPSHOT_GONE', 'REPOSITORY_CHANGED'].indexOf(c) >= 0) { pkReset(false); pk.offer = 'refresh'; }
    else if (c === 'CATALOG_TOO_LARGE') { pkReset(false); pk.offer = 'full'; }
    else if (c === 'UNSAFE_MANIFEST') { pkReset(false); }
    if (c === 'RESTORE_INCOMPLETE') pk.msg = errText(res.msg) + ' 만들어진 폴더는 그대로 남아 있고, 자동으로 다시 시도하거나 이어받지 않습니다.';
    else pk.msg = Object.prototype.hasOwnProperty.call(PK_MSG, c) ? PK_MSG[c] : errText(res && res.msg);
  }
  async function pkReq(name, arg) {
    if (!api || typeof api[name] !== 'function') return { code: '', msg: '앱 기능에 연결할 수 없습니다. 앱을 다시 시작해 주세요.' };
    const my = ++pk.seq;
    const prof = arg.profile;
    const tok = 'token' in arg ? arg.token : undefined;
    let r = null;
    try { r = await api[name](arg); } catch (e) { r = null; }
    if (my !== pk.seq || !pk.open || pk.profile !== prof || !state || state.profile !== prof || (tok !== undefined && pk.token !== tok)) return { stale: true };
    if (!r || r.ok !== true) return { code: r && typeof r.code === 'string' ? r.code : '', msg: r && r.error };
    const v = r.value;
    if (!v || typeof v !== 'object' || v.profile !== prof || (tok !== undefined && v.token !== tok)) return { stale: true };
    return { v: v };
  }
  async function pkRun(fn) {
    if (pending || !state || !pk.open || state.job || (state.recovery && state.recovery.busy) || state.profile !== pk.profile) return false;
    pending = true; pk.msg = ''; pk.note = ''; pk.offer = ''; showError(''); render();
    try { await fn(); } catch (e) { pk.msg = '요청을 처리하지 못했습니다. 다시 시도해 주세요.'; } finally { pending = false; render(); }
    return true;
  }
  async function pkQuery(q, off) {
    const res = await pkReq('queryFileCatalog', { profile: pk.profile, token: pk.token, query: q, offset: off });
    if (res.stale) return false;
    if (!pkOkMeta(res.v) || !Array.isArray(res.v.rows)) { pkFail(res.v ? {} : res); return false; }
    pk.meta = res.v; pk.page = res.v; pk.dirty = true;
    return true;
  }
  async function pkErr(res) {
    pkFail(res);
    pk.dirty = true;
    if (res.code === 'SELECTION_STALE' && pk.token && pk.page) await pkQuery(String(pk.page.query || ''), Number(pk.page.offset) || 0);
  }
  async function pkOpen() {
    pkReset(false);
    const res = await pkReq('openFileCatalog', { profile: pk.profile });
    if (res.stale) return;
    if (!pkOkMeta(res.v)) { pkFail(res.v ? {} : res); return; }
    pk.token = res.v.token; pk.meta = res.v;
    $('pickQuery').value = '';
    await pkQuery('', 0);
  }
  function pkStart() {
    if (pending || !state || state.job || (state.recovery && state.recovery.busy)) return;
    if (pk.open && pk.token) { goTo('pickQuery'); return; }
    pk.open = true; pk.profile = state.profile;
    pkRun(pkOpen).then(() => { goTo(pk.open && pk.token ? 'pickQuery' : 'pickCard'); });
  }
  function pkClose() {
    if (pending) return;
    if (!pk.token) { pkReset(true); render(); return; }
    pkRun(async () => {
      const res = await pkReq('closeFileCatalog', { profile: pk.profile, token: pk.token });
      if (res.stale) return;
      if (!res.v && (res.code === 'JOB_BUSY' || res.code === 'DIALOG_BUSY')) { pkFail(res); return; }
      pkReset(true);
    });
  }
  function pkToggle(row, cb) {
    const want = cb.checked;
    if (pending || !state || state.job) { cb.checked = !!row.selected; return; }
    pkRun(async () => {
      if (!pkLive()) return;
      const res = await pkReq('setFileSelection', { profile: pk.profile, token: pk.token, revision: pkRev(), action: want ? 'add' : 'remove', ids: [row.id] });
      if (res.stale) return;
      if (!pkOkMeta(res.v)) { cb.checked = !!row.selected; await pkErr(res.v ? {} : res); return; }
      pk.meta = res.v; row.selected = want;
    }).then((ran) => { if (!ran) cb.checked = !!row.selected; });
  }
  function pkSet(action) {
    pkRun(async () => {
      if (!pkLive() || !pk.page) return;
      const q = String(pk.page.query || '');
      const arg = { profile: pk.profile, token: pk.token, revision: pkRev(), action: action };
      if (action === 'all') arg.query = q;
      const res = await pkReq('setFileSelection', arg);
      if (res.stale) return;
      if (!pkOkMeta(res.v)) { await pkErr(res.v ? {} : res); return; }
      pk.meta = res.v;
      await pkQuery(q, Number(pk.page.offset) || 0);
    });
  }
  function pkGo(d) {
    pkRun(async () => {
      if (!pkLive() || !pk.page) return;
      const size = Number(pk.page.pageSize) || PK_PAGE;
      await pkQuery(String(pk.page.query || ''), Math.max(0, (Number(pk.page.offset) || 0) + d * size));
    });
  }
  function pkRestore() {
    pkRun(async () => {
      if (!pkLive()) return;
      const cnt = Number(pk.meta.selection.count) || 0;
      if (!cnt) { pk.msg = PK_MSG.SELECTION_EMPTY; return; }
      const l0 = state.lastSelectedRestore;
      const e0 = state.lastSelectedRestoreError;
      const res = await pkReq('restoreSelected', { profile: pk.profile, token: pk.token, revision: pkRev() });
      if (res.stale) return;
      if (!res.v) { await pkErr(res); return; }
      const v = res.v;
      if (v.canceled === true) { pk.note = '복구할 위치 선택을 취소했습니다. 고른 파일은 그대로 남아 있습니다.'; return; }
      if (v.started === true) {
        pk.started = true; pk.watchAt = l0 ? l0.at : null; pk.watchErr = e0 ? e0.at : null;
        pk.note = '선택한 파일 ' + pkNum(cnt) + '개 복구를 시작했습니다. 끝날 때까지 기다려 주세요. 결과는 여기와 복구 카드에 표시됩니다.';
      } else if (v.path) pk.note = '선택한 파일 ' + pkNum(v.files) + '개를 새 폴더로 복구했습니다. 복구 카드에서 폴더를 열 수 있습니다.';
      else pk.msg = '복구 결과를 확인하지 못했습니다. 복구 카드의 최근 결과를 확인해 주세요.';
      if (v.state && typeof v.state === 'object') accept(v.state);
    });
  }
  function pkList(pg, q) {
    const ul = $('pickList');
    const rows = pg && Array.isArray(pg.rows) ? pg.rows : [];
    const items = [];
    rows.forEach((row) => {
      if (!row || typeof row.id !== 'string') return;
      const li = document.createElement('li');
      const lab = document.createElement('label');
      lab.className = 'pickRow';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!row.selected;
      cb.addEventListener('change', () => pkToggle(row, cb));
      const tx = document.createElement('span');
      tx.className = 'pickTxt';
      const nm = document.createElement('span');
      nm.className = 'pickName';
      nm.textContent = String(row.name == null ? '' : row.name);
      const ph = document.createElement('span');
      ph.className = 'pickPath';
      ph.textContent = String(row.source == null ? '' : row.source) + ' / ' + String(row.path == null ? '' : row.path);
      const sz = document.createElement('span');
      sz.className = 'pickSize';
      sz.textContent = fmtBytes(row.size) + (row.mtime ? ' · 수정 ' + fmtTime(row.mtime) : '');
      tx.append(nm, ph, sz);
      lab.append(cb, tx);
      li.appendChild(lab);
      items.push(li);
    });
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = !pg ? '목록을 불러오지 못했습니다. ‘새로 불러오기’를 눌러 주세요.' : q ? '검색 결과가 없습니다. 다른 검색어를 넣어 보세요.' : '이 백업에는 고를 수 있는 파일이 없습니다.';
      items.push(li);
    }
    ul.replaceChildren(...items);
  }
  function pkRender(s, act, canPick) {
    const lsr = s.lastSelectedRestore && typeof s.lastSelectedRestore === 'object' ? s.lastSelectedRestore : null;
    const le = s.lastSelectedRestoreError && typeof s.lastSelectedRestoreError === 'object' ? s.lastSelectedRestoreError : null;
    if (pk.started && !s.job) {
      if (lsr && lsr.at !== pk.watchAt) { pk.started = false; pk.note = '골라 둔 파일 ' + pkNum(lsr.files) + '개를 복구했습니다. 복구 카드의 ‘골라 복구한 폴더 열기’로 확인하세요.'; }
      else if (le && le.at !== pk.watchErr) { pk.started = false; pk.note = ''; pk.msg = '파일 골라 복구가 끝나지 못했습니다. 복구 카드의 안내를 확인해 주세요.'; }
    }
    show('pickEntry', canPick);
    $('btnPick').disabled = act;
    show('pickResult', !!lsr);
    if (lsr) { setText('pickResTime', fmtTime(lsr.at) + ' · 파일 ' + pkNum(lsr.files) + '개 · ' + fmtBytes(lsr.bytes)); setText('pickResPath', lsr.path || ''); }
    $('btnPickOpen').disabled = act;
    setText('pickErr', le ? '최근 파일 골라 복구가 끝나지 못했습니다' + (le.at ? ' (' + fmtTime(le.at) + ')' : '') + ': ' + errText(le.message) + (le.path ? ' 남아 있는 미완료 폴더: ' + le.path : '') + ' 자동으로 이어받지 않으니 다시 골라 복구하거나 전체 복구를 써 주세요.' : '');
    show('pickErr', !!le);
    show('pickCard', pk.open);
    if (!pk.open) return;
    if (pk.token && !pending && !s.job) pkLive();
    const m = pk.token ? pk.meta : null;
    setText('pickMeta', m ? '최신 완료 백업 ' + (fmtTime(m.snapshotAt) || '시각 확인 필요') + ' 기준 · 파일 ' + pkNum(m.fileCount) + '개 · ' + fmtBytes(m.totalBytes) : pending ? '최신 완료 백업의 파일 목록을 불러오는 중입니다…' : '파일 목록이 열려 있지 않습니다.');
    setText('pickExpire', m ? '목록을 연 뒤 30분 동안(' + fmtTime(m.expiresAt) + '까지) 쓸 수 있습니다. 그 사이 새 백업이 끝나도 이 목록의 백업본은 바뀌지 않습니다.' : '');
    const un = m ? Number(m.unavailableCount) || 0 : 0;
    setText('pickUnavail', un ? '바로가기(심볼릭 링크) 같은 특수 항목 ' + pkNum(un) + '개는 목록에 나오지 않으며, 이 베타에서는 골라서 복구하든 전체 복구하든 복구할 수 없습니다. 일반 파일은 그대로 골라서 복구할 수 있습니다.' : '');
    show('pickUnavail', !!un);
    show('pickCloud', s.profile === 'b2');
    setText('pickMsg', pk.msg);
    show('pickMsg', !!pk.msg);
    setText('pickNote', pk.note);
    show('pickNote', !!pk.note);
    show('btnPickFull', pk.offer === 'full' && canPick);
    $('btnPickFull').disabled = act;
    setText('btnPickRefresh', m ? '새로 불러오기(선택 비움)' : '다시 불러오기');
    $('btnPickRefresh').className = 'btn' + (pk.offer === 'refresh' ? ' primary' : '');
    $('btnPickRefresh').disabled = act || !canPick;
    $('btnPickClose').disabled = act;
    show('pickTools', !!m);
    if (!m) return;
    const pg = pk.page;
    const sel = m.selection || {};
    const cnt = Number(sel.count) || 0;
    const total = pg ? Number(pg.total) || 0 : 0;
    const off = pg ? Number(pg.offset) || 0 : 0;
    const size = pg ? Number(pg.pageSize) || PK_PAGE : PK_PAGE;
    const q = pg ? String(pg.query || '') : '';
    setText('pickCount', '선택 ' + pkNum(cnt) + '개 · ' + fmtBytes(sel.bytes) + ' (모든 검색·페이지 합계, 최대 1,000개)');
    setText('btnPickAll', (q ? '검색 결과 전체 선택 (' : '모든 파일 선택 (') + pkNum(total) + '개)');
    $('btnPickAll').disabled = act || !canPick || !total || total > 1000;
    setText('pickAllHint', !pg || !total ? '' : total > 1000 ? '결과가 1,000개를 넘어 한 번에 모두 고를 수 없습니다. 검색어를 좁혀 주세요.' : '이 페이지만이 아니라 ' + (q ? '검색 결과' : '백업') + '의 모든 페이지 ' + pkNum(total) + '개를 선택에 더합니다. 이미 고른 파일은 그대로 둡니다.');
    $('btnPickClear').disabled = act || !cnt;
    setText('pickPage', total ? pkNum(off + 1) + '–' + pkNum(Math.min(off + size, total)) + ' / 총 ' + pkNum(total) + '개' + (q ? ' (검색 결과)' : '') : '');
    show('btnPickPrev', total > size);
    show('btnPickNext', total > size);
    $('btnPickPrev').disabled = act || !pg || off <= 0;
    $('btnPickNext').disabled = act || !pg || off + size >= total;
    setText('btnPickRestore', cnt ? '선택한 ' + pkNum(cnt) + '개 복구' : '선택한 파일 복구');
    $('btnPickRestore').disabled = act || !canPick || !cnt;
    if (pk.dirty) { pk.dirty = false; pkList(pg, q); }
    $('pickList').querySelectorAll('input').forEach((el) => { el.disabled = act || !canPick; });
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

  function pausedFuture(x) { return !!(x && x.pausedUntil && ts(x.pausedUntil) > Date.now()); }

  function summary(x) {
    if (!x || typeof x !== 'object') return '상태를 아직 모릅니다';
    const p = [];
    if (!x.configured) p.push('설정 전');
    else {
      p.push(x.lastBackup ? '최근 완료 ' + fmtTime(x.lastBackup.at) : '아직 완료된 백업 없음');
      if (x.mode === 'restore') p.push('복구 전용');
      else if (!x.automatic) p.push('자동 꺼짐');
      else if (pausedFuture(x)) p.push('일시정지 ~' + fmtTime(x.pausedUntil));
      else p.push('자동 켜짐');
    }
    if (x.job) p.push((JOBS[x.job.kind] || '작업 중'));
    if (x.credentialRequired) p.push('인증 복구 필요');
    if (x.clockHold) p.push('PC 시계 확인 필요');
    if (x.lastProbe && x.lastProbe.result === 'failed') p.push('복구 시험 문제');
    if (x.lastError) p.push('문제: ' + x.lastError);
    return p.join(' · ');
  }
  function renderTab(id, sumId, name, s, lock) {
    const x = s && s.profiles ? s.profiles[name] : null;
    const t = $(id);
    t.disabled = lock;
    t.setAttribute('aria-pressed', s && s.profile === name ? 'true' : 'false');
    t.classList.toggle('bad', !!(x && (x.lastError || x.credentialRequired || (x.lastProbe && x.lastProbe.result === 'failed'))));
    setText(sumId, s ? summary(x) : '');
  }

  function protOf(s) {
    const p = s.protection;
    if (p && typeof p === 'object' && LEVELS.indexOf(p.level) >= 0) return p;
    const MIN = 60000;
    const now = Date.now();
    const lb = s.lastBackup;
    const lbt = ts(lb && lb.at);
    const probeCurrent = !!s.lastProbe && s.lastProbe.result === 'passed' && s.lastProbe.snapshotId === (lb ? lb.id : undefined);
    const interrupted = !!s.protectRun && ['done', 'failed'].indexOf(s.protectRun.phase) < 0 && !s.job;
    const res = (level, reason, nextAction) => ({ level: level, reason: reason, nextAction: nextAction, nextBackupAt: s.nextBackupAt || null, probeCurrent: probeCurrent, interrupted: interrupted });
    if (s.job) return res('running', 'job', 'none');
    if (s.credentialRequired) return res('attention', 'credential', 'credentials');
    if (!s.configured) return res('setup', 'setup', 'setup');
    if (s.mode === 'restore' || s.readOnly) return res('restoreOnly', 'restoreOnly', 'restore');
    if (!s.recoverySaved) return res('attention', 'recovery', 'recovery');
    if (s.clockHold || lbt > now + 5 * MIN) return res('attention', 'clock', 'backup');
    if (s.probeHold) return res('attention', 'probe', 'probe');
    if (s.health && s.health.status === 'attention') return res('attention', 'health', 'check');
    if (s.lastError || interrupted) return res('attention', 'error', 'protect');
    if (ts(s.pausedUntil) > now) return res('paused', 'paused', 'resume');
    if (!s.automatic) return res('off', 'off', 'protect');
    if (!lbt) return res('attention', 'empty', 'protect');
    if (now - lbt > (2 * s.intervalMinutes + 15) * MIN) return res('attention', 'overdue', 'protect');
    if (!s.launchAtLogin) return res('partial', 'startup', 'protect');
    return res('active', 'active', 'backup');
  }

  function heroCopy(p, s) {
    const lb = s.lastBackup;
    const r = p.reason;
    switch (p.level) {
      case 'running': return ['작업 중', '작업이 진행 중입니다', '끝나면 결과가 여기에 표시됩니다. 완료되기 전에는 완료된 백업으로 표시하지 않습니다.', 'run'];
      case 'restoreOnly': return ['복구 전용', '이 PC는 복구 전용으로 연결되어 있습니다', '완료된 백업을 새 폴더로 복구할 수 있습니다. 이 PC에서는 새 백업을 만들지 않습니다.', 'neutral'];
      case 'setup': return ['준비 중', r === 'recovery' ? '복구 정보를 먼저 보관해 주세요' : '설정을 마쳐 주세요', r === 'recovery' ? '복구 정보를 보관한 뒤에 보호를 시작할 수 있습니다. 아직 업무 파일을 백업하지 않았습니다.' : '아직 보호가 시작되지 않았습니다.', 'warn'];
      case 'attention': {
        const m = { credential: ['인증 정보를 다시 연결해야 합니다', '해결될 때까지 이 백업의 백업과 복구가 멈춥니다.'], recovery: s.profile === 'b2' && s.recovery && s.recovery.available ? ['복구 정보를 먼저 보관해 주세요', (lb ? '아래 Google 자동 복구로 보관이 확인되거나 복구 키 파일을 저장하면 보호를 다시 시작할 수 있습니다. 마지막으로 완료된 백업은 아래 표시된 시각 그대로 남아 있습니다.' : '아래 Google 자동 복구로 보관이 확인되거나 복구 키 파일을 저장하면 보호를 시작할 수 있습니다. 아직 업무 파일을 백업하지 않았습니다.')] : ['복구 키 파일을 먼저 보관해 주세요', (lb ? '복구 키 파일을 저장하면 보호를 다시 시작할 수 있습니다. 마지막으로 완료된 백업은 아래 표시된 시각 그대로 남아 있습니다.' : '복구 키 파일을 저장하면 보호를 시작할 수 있습니다. 아직 업무 파일을 백업하지 않았습니다.')], empty: ['아직 완료된 백업이 없습니다', '자동 백업은 켜져 있지만 완료된 백업이 아직 없습니다. ‘보호 시작’을 누르면 Windows 로그인 시 시작을 켜고 바로 백업합니다.'], overdue: ['백업이 예정보다 늦어지고 있습니다', '마지막 완료 이후 시간이 꽤 지났습니다. ‘보호 다시 시작’을 누르면 Windows 로그인 시 시작을 켜고 바로 백업합니다.'], error: ['최근 백업 시도에 문제가 있었습니다', '마지막으로 완료된 백업은 아래와 같습니다. 다시 시도해 주세요.'], health: ['전체 점검에서 확인이 필요합니다', '점검 기록에서 내용을 확인해 주세요.'], probe: ['복구 시험에서 문제가 발견되었습니다', '오래된 기록 정리를 멈추고 기존 기록을 보관하고 있습니다. 복구 시험을 다시 하거나 전체 점검을 해 주세요.'], clock: ['PC 시계를 확인해 주세요', '저장된 백업 시각이 PC의 현재 시각보다 뒤로 되어 있습니다. Windows 날짜·시각이 맞는지 확인한 뒤 ‘지금 백업’을 눌러 다시 시도해 주세요. 기록 순서는 저장된 백업 시각을 기준으로 판단합니다.'] }[r] || ['확인이 필요합니다', '아래 내용을 확인해 주세요.'];
        return ['확인 필요', m[0], m[1], 'warn'];
      }
      case 'paused': return ['일시정지', '자동 백업이 잠시 멈춰 있습니다', pausedFuture(s) ? fmtTime(s.pausedUntil) + '까지 새 자동 백업이 없습니다.' : '일시정지가 곧 끝납니다.', 'warn'];
      case 'off': return ['보호 꺼짐', r === 'empty' || !lb ? '아직 보호를 시작하지 않았습니다' : '자동 백업이 꺼져 있습니다', '‘' + (lb ? '보호 다시 시작' : '보호 시작') + '’을 누르면 Windows 로그인 시 시작을 켜고 바로 백업합니다.', 'warn'];
      case 'partial': {
        if (r === 'startup') return ['일부 꺼짐', 'Windows 로그인 시 시작이 꺼져 있습니다', 'PC를 다시 켠 뒤 앱을 직접 열기 전까지 자동 백업이 동작하지 않습니다.', 'warn'];
        if (r === 'overdue') return ['늦어짐', '백업이 예정보다 늦어지고 있습니다', '마지막 완료 이후 시간이 꽤 지났습니다. 지금 백업하거나 보호를 다시 시작해 주세요.', 'warn'];
        return ['확인 필요', '일부 상태를 확인해 주세요', '아래 내용을 확인해 주세요.', 'warn'];
      }
      case 'active': return ['보호 중', '자동 백업이 동작하고 있습니다', '선택한 폴더를 정해진 간격으로 백업합니다.', 'good'];
      default: return ['상태', '상태를 확인하는 중', '', 'neutral'];
    }
  }

  function actionLabel(a, s) {
    return { protect: s.lastBackup ? '보호 다시 시작' : '보호 시작', backup: '지금 백업', resume: '자동 백업 다시 시작', probe: '복구 시험 실행', check: '점검 기록 보기', credentials: '인증 다시 연결', recovery: '복구 정보 보관하기', setup: '설정 계속하기', restore: '새 폴더로 복구' }[a] || '';
  }

  function runHero() {
    const s = state;
    if (!s) return;
    switch (heroAction) {
      case 'protect': call('protectNow', undefined, true); break;
      case 'backup': call('backupNow', undefined, true); break;
      case 'resume': call('resumeAutomatic', undefined, true); break;
      case 'probe': call('probeRestore', undefined, true); break;
      case 'restore': call('restoreLatest', undefined, true); break;
      case 'check': goTo('btnCheck'); break;
      case 'credentials':
        if (s.credentialRequired) goTo(s.profile === 'b2' ? 'xKeyId' : 'btnRecover');
        else { recoForce = true; render(); goTo('btnRConnect'); }
        break;
      case 'recovery':
        if (!s.recoverySaved) goTo(s.profile === 'b2' && s.recovery && s.recovery.available ? 'recoBox' : 'btnKey');
        else { recoForce = true; render(); goTo('recoBox'); }
        break;
      default: break;
    }
  }

  function recoNeeds(s, r, restoreMode) {
    if (recoForce || recoSearched) return true;
    if (!s.configured) return true;
    if (r.error || r.needsLogin || r.status === 'attention') return true;
    if (restoreMode) return false;
    if (!s.recoverySaved) return true;
    if (s.credentialRequired) return false;
    return !!(r.available && r.connected && !r.readKeyReady);
  }

  function renderReco(s, act, cloud, restoreMode) {
    const r = s.recovery && typeof s.recovery === 'object' ? s.recovery : null;
    show('recoView', cloud && !!r);
    if (!cloud || !r) return;
    const av = !!r.available;
    const on = av && !!r.connected;
    const bm = !!s.configured && !restoreMode && !s.credentialRequired;
    const cands = Array.isArray(r.candidates) ? r.candidates : [];
    show('recoUnavail', !av);
    setText('recoConn', !av ? '사용할 수 없음' : r.needsLogin ? '다시 로그인이 필요합니다' : r.connected ? '연결됨' + (r.email ? ' · ' + r.email : '') : '연결 안 됨');
    const st = { notSaved: '아직 보관 전', pending: '보관 대기 중', working: '처리 중', verified: '보관 확인됨', attention: '확인이 필요합니다' }[r.status] || '아직 보관 전';
    const okV = r.status === 'verified' && !r.error;
    const vt = r.verifiedAt ? fmtTime(r.verifiedAt) : '';
    let stt = st + (vt ? ' · 마지막 확인 ' + vt : '');
    if (restoreMode && okV) stt = '복구 정보 가져옴 · 복구 준비됨' + (vt ? ' (' + vt + ' 확인)' : '');
    else if (!r.connected && vt) stt = (okV ? '마지막으로 보관이 확인된 시각 ' + vt : st + ' · 마지막 확인 ' + vt) + ' · 연결되어 있지 않아 지금은 확인하지 않습니다';
    setText('recoStatus', stt);
    $('recoStatus').className = okV && (r.connected || restoreMode) ? 'ok' : (r.status === 'attention' || r.error) ? 'attention' : '';
    const eMsg = r.error ? (r.canImport ? '복구 정보를 확인하지 못했습니다: ' + r.error : '자동 복구 정보 확인이 필요합니다: ' + r.error + ' 이 알림이 백업 파일이 사라졌다는 뜻은 아닙니다.') : r.status === 'attention' ? '복구 정보 보관 상태를 다시 확인해 주세요. Google 연결을 확인한 뒤 다시 확인·보관을 눌러 주세요.' : '';
    setText('recoError', eMsg);
    show('recoError', !!eMsg);
    let sum = '';
    let sumWarn = false;
    if (!av) sum = '이 빌드에서는 쓸 수 없음';
    else if (r.needsLogin) { sum = '다시 로그인이 필요합니다' + (vt ? ' · 마지막 확인 ' + vt : ''); sumWarn = true; }
    else if (r.error || r.status === 'attention') { sum = '확인이 필요합니다' + (vt ? ' · 마지막 확인 ' + vt : '') + ' (백업 파일과는 별개)'; sumWarn = true; }
    else if (okV) sum = (restoreMode ? '복구 정보 가져옴' : '보관 확인됨') + (vt ? ' · ' + vt : '');
    else sum = r.connected ? '연결됨 · ' + st : '연결 안 됨';
    setText('recoSum', sum);
    $('recoSum').className = 'sumNote' + (sumWarn ? ' attention' : '');
    let note = '';
    if (av && bm && !r.readKeyReady) note = '복구 전용 연결 준비가 필요합니다. 준비되기 전에는 자동 보관이 완료되지 않습니다.' + (s.manualRecoverySaved ? '' : ' 그동안 복구 키 파일을 직접 보관해 주세요.');
    else if (av && !s.configured && !r.connected) note = '처음 한 번만 Google 권한을 허용하면 됩니다. 클라우드 연결 준비를 마치고 복구 전용 연결이 준비되어 있으면 복구 정보가 자동으로 보관됩니다. 시험판에서는 소유자가 복구 전용 연결을 준비하며, 아직 직접 준비할 수는 없습니다. 새 PC라면 연결한 뒤 ‘내 백업 찾기’를 누르세요.';
    else if (on && !s.configured && !r.canImport) note = '이 PC에 끝나지 않은 클라우드 연결 준비가 남아 있어, 그 위에 다른 백업을 가져올 수 없습니다. 원래 연결 준비를 다시 시도해 마치거나, 새 PC에서 백업을 찾아 가져오세요.';
    else if (s.configured && restoreMode) note = '이 PC는 복구 전용으로 연결되어 파일 복구만 할 수 있습니다. 시험판에서 이 PC의 새 자동 백업은 소유자 설정이 필요합니다.';
    setText('recoNote', note);
    show('recoNote', !!note);
    show('btnRConnect', av && (!r.connected || !!r.needsLogin));
    setText('btnRConnect', r.needsLogin ? '다시 로그인' : 'Google로 연결');
    show('btnRSync', on && bm && !!r.readKeyReady);
    show('btnRFind', on && !!r.canImport);
    show('btnRDisc', on);
    show('btnRKit', bm && !!s.recoverySaved);
    setText('btnRKit', s.manualRecoverySaved ? '복구 키 파일 다시 저장(선택)' : '복구 키 파일도 따로 저장(선택)');
    const sel = $('recoSel');
    const key = JSON.stringify(cands.map((c) => (c ? [c.id, c.createdAt, c.bucket, c.repositoryLabel] : null)));
    if (key !== candKey) {
      candKey = key;
      const keep = sel.value;
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '백업을 골라 주세요';
      const opts = [ph];
      cands.forEach((c) => {
        if (!c || c.id == null) return;
        const o = document.createElement('option');
        o.value = String(c.id);
        o.textContent = (fmtTime(c.createdAt) || '날짜 모름') + ' · ' + String(c.bucket || '') + ' · ' + String(c.repositoryLabel || '');
        opts.push(o);
      });
      sel.replaceChildren(...opts);
      sel.value = opts.some((o) => o.value && o.value === keep) ? keep : '';
    }
    show('recoPick', on && !!r.canImport && (recoSearched || cands.length > 0));
    show('recoNone', recoSearched && !cands.length && !r.busy);
    show('recoSelLabel', cands.length > 0);
    show('btnRImport', !!r.canImport && cands.length > 0);
    sel.disabled = act || !cands.length;
    $('btnRImport').disabled = act || !r.canImport || !sel.value;
    const need = recoNeeds(s, r, restoreMode);
    if (need !== recoNeedPrev) { recoNeedPrev = need; if (need) $('recoBox').open = true; else if (!recoForce) $('recoBox').open = false; }
  }

  function renderProbe(s, p, restoreMode) {
    const lp = s.lastProbe;
    const lb = s.lastBackup;
    const pt = $('probeText');
    let t = '아직 확인하지 않음';
    let cls = 'big';
    let d = '';
    if (lp && typeof lp === 'object') {
      const earlier = !!(lb && lp.snapshotId && lp.snapshotId !== lb.id) || p.probeCurrent === false && !!lb && lp.snapshotId !== lb.id;
      const when = fmtTime(lp.at);
      if (lp.result === 'passed') { t = '작은 파일 1개를 내려받아 복호화했습니다'; cls += ' ok'; d = when + ' 시험 · ' + fmtBytes(lp.bytes) + (earlier ? ' · 이전 스냅숏 기준(최신 백업은 아직 시험하지 않음)' : ' · 최신 완료 백업 기준') + '. 파일 1개만 확인한 것이며 전체 복구나 저장소 전체를 확인한 것은 아닙니다.'; }
      else if (lp.result === 'failed') { t = '복구 시험에서 문제가 발견되었습니다'; cls += ' attention'; d = when + ' · 내려받은 파일 크기가 예상과 달랐습니다' + '. 전체 점검을 권합니다.'; }
      else if (lp.result === 'incomplete') { t = '복구 시험을 끝내지 못했습니다'; cls += ' attention'; d = when + ' · 연결이나 처리 문제로 중단되었습니다' + '. 데이터 손상을 뜻하지는 않습니다. 확인되지 않은 상태입니다.'; }
      else if (lp.result === 'skipped') { t = '복구 시험을 건너뛰었습니다'; d = when + ' · 알맞은 작은 파일이 없거나 목록이 너무 커서 시험하지 않았습니다' + '. 확인되지 않은 상태입니다.'; }
      if (lp.detail) d += ' ' + lp.detail;
    }
    if (s.probeHold) d += ' 복구 시험 문제로 ' + fmtTime(s.probeHold.since) + '부터 오래된 기록 정리를 멈추고 보관 중입니다.';
    pt.className = cls;
    setText('probeText', t);
    setText('probeDetail', d.trim());
    const can = !!s.configured && !restoreMode && !s.readOnly;
    show('btnProbe', can);
    return t;
  }

  function render() {
    const s = state;
    const lock = pending || !s;
    const rb = !!(s && s.recovery && s.recovery.busy);
    const act = lock || !!(s && s.job) || rb;
    $('app').setAttribute('aria-busy', act ? 'true' : 'false');
    document.querySelectorAll('button, input').forEach((el) => { if (el.closest('#rpCard')) return; el.disabled = act; });
    SECRETS.forEach((id) => { $(id).disabled = lock; });
    renderTab('tabLocal', 'sumLocal', 'local', s, lock || rb);
    renderTab('tabB2', 'sumB2', 'b2', s, lock || rb);
    const j = s ? s.job : null;
    show('jobBox', !!j || pending || rb);
    show('jobHint', !!j || pending || rb);
    setText('jobHint', rb && !pending ? '자동 복구 정보를 확인하는 동안 다른 작업은 잠시 기다립니다.' : pending || rb ? '요청을 처리하고 있습니다. 잠시 기다려 주세요. 진행 중인 작업은 앱 안에서 취소할 수 없습니다.' : '작업이 실행 중입니다. 진행 중인 작업은 앱 안에서 취소할 수 없습니다. 위의 탭으로 다른 백업 종류는 볼 수 있습니다.');
    if (j) {
      const pct = typeof j.percent === 'number' ? Math.max(0, Math.min(100, Math.round(j.percent))) : null;
      const pr = s.protectRun;
      const ph = j.kind === 'protect' && pr && PHASE[pr.phase] ? ' · ' + PHASE[pr.phase] : '';
      setText('jobText', (JOBS[j.kind] || '작업 중') + ph + (j.stage ? ' · ' + j.stage : '') + (pct !== null ? ' (' + pct + '%)' : ''));
      if (pct !== null) $('jobBar').value = pct; else $('jobBar').removeAttribute('value');
    } else if (pending || rb) {
      setText('jobText', rb && connecting ? 'Google 연결 중입니다. 브라우저 창에서 로그인과 권한 허용을 마쳐 주세요. 연결 대기를 취소하려면 트레이 메뉴에서 ‘앱 종료’를 누르세요. 5분 안에 마치지 않으면 연결 시도가 자동으로 끝납니다.' : rb ? '복구 정보를 확인하는 중입니다…' : '잠시만 기다려 주세요…');
      $('jobBar').removeAttribute('value');
    }
    if (!s) { ['recoView', 'setupView', 'cloudView', 'credView', 'keyView', 'dashView'].forEach((id) => show(id, false)); return; }
    if (pk.open && !s.configured) pkReset(true);
    setText('version', '버전 ' + (s.version || '확인 필요'));
    const cloud = s.profile === 'b2';
    const restoreMode = s.mode === 'restore';
    const cred = !!s.credentialRequired;
    const kind = cloud ? '클라우드' : '외장·로컬';
    setText('modeLabel', kind + ' · ' + (!s.configured ? (s.initializing ? '연결 준비 중단됨' : '처음 설정') : restoreMode || s.readOnly ? '복구 전용 모드' : '백업 모드'));
    show('setupView', !cloud && !s.configured);
    show('cloudView', cloud && !s.configured);
    show('credView', !!s.configured && cred);
    show('keyView', !!s.configured && !restoreMode && !s.readOnly && !s.recoverySaved && !cred);
    show('keyCloudNote', cloud);
    show('keyGoogleNote', cloud && !!(s.recovery && s.recovery.available));
    show('dashView', !!s.configured);
    show('credFields', cloud);
    renderReco(s, act, cloud, restoreMode);
    if (!(cloud && !s.configured)) prefilled = false;
    const sel = s.selection || {};

    if (!s.configured && !cloud) {
      const srcs = Array.isArray(sel.sources) ? sel.sources : [];
      fillList('selSources', srcs);
      setText('selTarget', sel.target || '');
      setText('btnSources', srcs.length ? '폴더 다시 고르기' : '폴더 고르기');
      setText('btnTarget', sel.target ? '저장 위치 다시 고르기' : '저장 위치 고르기');
      $('btnSetup').disabled = act || !srcs.length || !sel.target;
      $('btnFindOtherL').disabled = act || !(s.recovery && s.recovery.available);
      setText('setupNext', '다음 단계: ' + (!srcs.length ? '백업할 업무 폴더를 고르세요.' : !sel.target ? '백업을 저장할 위치를 고르세요.' : '‘백업 준비’를 누르세요. 아직 백업은 시작되지 않습니다.'));
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
      $('btnFindOther').disabled = act || !(s.recovery && s.recovery.available);
      setText('cloudNext', '다음 단계: ' + (init ? '연결 준비를 다시 시도하세요.' : !srcs.length ? '백업할 업무 폴더를 고르세요.' : 'B2 연결 정보를 입력하고 ‘클라우드 연결 준비’를 누르세요. 아직 업로드하지 않습니다.'));
      return;
    }

    setText('lastError', s.lastError ? '최근 시도에서 문제가 발생했습니다: ' + s.lastError : '');
    show('lastError', !!s.lastError);
    setText('warning', s.warning || '');
    show('warning', !!s.warning);
    setText('retryNote', s.retryAfter ? '사용 한도에 도달해 잠시 멈췄습니다. ' + fmtTime(s.retryAfter) + ' 이후 다시 시도합니다.' : '');
    show('retryNote', !!s.retryAfter);

    const p = protOf(s);
    const iv = Number(s.intervalMinutes) || (cloud ? 60 : 15);
    const days = Number(s.fullCheckDays) || (cloud ? 30 : 1);
    const every = days === 1 ? '하루에 한 번' : days + '일마다';
    const lb = s.lastBackup;
    const paused = pausedFuture(s);
    const ro = !!s.readOnly || restoreMode;

    const hc = heroCopy(p, s);
    setText('heroKicker', hc[0]);
    setText('backupTitle', hc[1]);
    setText('heroState', hc[2]);
    $('heroDot').className = 'dot ' + hc[3];
    $('hero').className = 'card heroCard lv-' + hc[3];
    setText('backupTime', lb ? fmtTime(lb.at) : '아직 완료된 백업이 없습니다');
    let stats = lb ? '파일 ' + (Number(lb.files) || 0).toLocaleString('ko-KR') + '개 · ' + fmtBytes(lb.bytes) : (ro ? '' : '첫 백업이 끝나면 여기에 표시됩니다.');
    if (s.lastAttemptAt && (!lb || ts(s.lastAttemptAt) > ts(lb.at))) stats += (stats ? ' · ' : '') + '마지막 시도 ' + fmtTime(s.lastAttemptAt) + (s.lastError ? ' (완료되지 않음)' : '');
    setText('backupStats', stats);
    const nb = p.nextBackupAt || s.nextBackupAt;
    let nxt = '';
    let nh = '';
    if (ro) nxt = '복구 전용에서는 백업하지 않음';
    else if (cred) nxt = '인증 복구 전까지 멈춤';
    else if (s.clockHold) { nxt = 'PC 시계 확인 필요'; nh = 'Windows 날짜·시각을 확인한 뒤 ‘지금 백업’을 눌러 다시 시도해 주세요.'; }
    else if (!s.recoverySaved) nxt = '복구 정보 보관 후 시작 가능';
    else if (!s.automatic) nxt = '자동 백업 꺼짐';
    else if (paused) { nxt = '일시정지 · ' + fmtTime(s.pausedUntil) + '까지'; nh = '일시정지가 끝나면 다시 예약됩니다.'; }
    else { nxt = nb ? fmtTime(nb) + ' 예정' : iv + '분마다'; nh = '앱 또는 트레이가 실행 중이고 PC가 깨어 있을 때 동작합니다.'; }
    if (!ro && s.automatic && !s.launchAtLogin) nh = (nh ? nh + ' ' : '') + 'Windows 로그인 시 시작이 꺼져 있습니다.';
    setText('autoState', nxt);
    setText('nextHint', nh);

    const warns = [];
    if (s.startupWarning) warns.push('백업은 진행했지만 Windows 로그인 시 시작 등록을 확인하지 못했습니다: ' + s.startupWarning);
    if (s.protectRun && s.protectRun.phase === 'failed') warns.push('보호 시작 과정이 끝나지 못했습니다' + (s.protectRun.finishedAt ? ' (' + fmtTime(s.protectRun.finishedAt) + ')' : '') + '. 완료된 백업으로 표시하지 않았습니다.');
    if (p.interrupted) warns.push('지난 작업이 중간에 끊겼습니다. 끊긴 백업은 완료된 백업으로 치지 않습니다.');
    const r = s.recovery;
    if (cloud && r && (r.error || r.needsLogin)) warns.push('Google 자동 복구 확인이 필요합니다' + (r.verifiedAt ? ' (마지막 확인 ' + fmtTime(r.verifiedAt) + ')' : '') + '. 백업 파일과는 별개이며, 아래 Google 자동 복구에서 확인할 수 있습니다.');
    setText('heroWarn', warns.join(' '));
    show('heroWarn', warns.length > 0);

    heroAction = p.nextAction || 'none';
    if (heroAction === 'clock' || heroAction === 'setup' && s.configured && s.recoverySaved) heroAction = 'none';
    if (ro && ['protect', 'backup', 'resume', 'probe', 'check'].indexOf(heroAction) >= 0) heroAction = lb ? 'restore' : 'none';
    if (heroAction === 'restore' && (!lb || cred)) heroAction = 'none';
    if (heroAction === 'check' && s.readOnly) heroAction = 'none';
    const hb = $('btnHero');
    setText('btnHero', actionLabel(heroAction, s));
    show('btnHero', heroAction !== 'none' && !!actionLabel(heroAction, s));
    const needsJob = ['protect', 'backup', 'resume', 'probe', 'restore'].indexOf(heroAction) >= 0;
    hb.disabled = act || (needsJob && cred);
    const backupMode = !!s.configured && !ro && !!s.recoverySaved && !cred;
    show('btnNow', backupMode && heroAction !== 'backup' && heroAction !== 'protect' && !!lb);
    setText('btnNow', '지금 한 번 백업');
    $('btnNow').disabled = act || cred;
    show('btnHeroRestore', !!lb && heroAction !== 'restore' && !cred);
    $('btnHeroRestore').disabled = act || cred;
    show('btnHeroPick', !!lb && !cred);
    $('btnHeroPick').disabled = act;
    show('backupActions', !$('btnHero').hidden || !$('btnNow').hidden || !$('btnHeroRestore').hidden || !$('btnHeroPick').hidden);

    const canPause = backupMode && !s.readOnly && !!s.automatic;
    show('pauseBox', canPause);
    show('pauseBtns', canPause && !paused);
    show('btnResume', canPause && paused);
    setText('pauseText', paused ? '자동 백업 일시정지 중 · ' + fmtTime(s.pausedUntil) + '에 자동으로 다시 시작합니다.' : '잠깐 PC를 무겁게 쓰거나 이동 중이라면 자동 백업을 잠시 멈출 수 있습니다. 진행 중인 작업은 멈추지 않습니다.');
    ['btnP60', 'btnP240', 'btnP720'].forEach((id) => { $(id).disabled = act || !!j; });
    $('btnResume').disabled = act || !!j;

    $('btnRestore').disabled = act || !lb || cred;
    $('btnCheck').disabled = act || !lb || cred;
    show('btnCheck', !s.readOnly);
    $('btnProbe').disabled = act || !lb || cred;
    const probeT = renderProbe(s, p, restoreMode);

    const h = s.health;
    $('healthText').className = 'big' + (h ? (h.status === 'ok' ? ' ok' : ' attention') : '');
    setText('healthText', !h ? '아직 점검 전' : h.status === 'ok' ? '그 시점에 문제가 발견되지 않았습니다' : '확인이 필요합니다');
    const older = !!(h && lb && ts(h.checkedAt) < ts(lb.at));
    setText('healthDetail', h ? fmtTime(h.checkedAt) + ' 점검' + (h.detail ? ' · ' + h.detail : '') + (older ? ' · 그 뒤에 만든 백업은 이 점검에 포함되지 않았습니다.' : ' · 점검 시점의 저장소 기준입니다.') : ro ? (s.readOnly ? '복구 전용 연결에서는 전체 점검을 할 수 없습니다. 복구할 때 모든 파일의 해시를 확인합니다.' : '복구 전에 전체 점검을 실행해 볼 수 있습니다. 오래 걸릴 수 있습니다.') : '첫 백업 후 자동으로 진행되고, 이후 ' + every + ' 실행됩니다. 오래 걸릴 수 있습니다.');
    show('checkNote', cloud && !s.readOnly);
    show('restoreNote', cloud);
    const hs = !h ? '전체 점검 전' : h.status === 'ok' ? '전체 점검 ' + fmtTime(h.checkedAt) : '전체 점검 확인 필요';
    const pw = s.lastProbe && (s.lastProbe.result === 'failed' || s.lastProbe.result === 'incomplete') || (h && h.status !== 'ok');
    setText('advSum', (ro ? '' : '복구 시험: ' + probeT + ' · ') + hs);
    $('advSum').className = 'sumNote' + (pw ? ' attention' : '');

    const lr = s.lastRestore;
    show('restoreResult', !!lr);
    if (lr) { setText('restoreTime', fmtTime(lr.at)); setText('restorePath', lr.path); }
    pkRender(s, act, !!lb && !cred);
    const srcs = Array.isArray(s.sources) ? s.sources : [];
    fillList('srcList', srcs);
    setText('srcCount', srcs.length ? '(' + srcs.length + '개)' : '');
    setText('repoLabel', cloud ? '클라우드 저장소' : '백업 위치');
    const pv = s.provider;
    setText('repoPath', cloud ? (pv ? 'B2 · ' + (pv.endpoint || '') + ' · ' + (pv.bucket || '') + (pv.prefix ? ' / ' + pv.prefix : '') : '') : (s.repository || ''));
    show('lifeNote', cloud);
    show('detCloud', cloud);
    show('rotCard', cloud && !s.readOnly);
    setText('detTiming', '백업할 때마다 구조 점검을 합니다. 전체 데이터 점검은 첫 백업 후 자동으로, 이후 ' + every + ' 진행하며' + (cloud ? ' 전체 데이터를 내려받으므로 다운로드 요금이 생길 수 있습니다.' : ' 데이터가 많으면 오래 걸릴 수 있습니다.') + ' 자동 백업(' + iv + '분마다)은 앱 또는 트레이가 실행 중이고 PC가 깨어 있을 때만 동작합니다.');
    show('settings', !ro);
    $('chkLogin').checked = !!s.launchAtLogin;
    show('btnAuto', backupMode && !!s.automatic);
    show('autoHint', backupMode && !!s.automatic);
    setText('btnAuto', '자동 백업 끄기');
    $('btnAuto').dataset.action = 'pause';
    $('btnAuto').className = 'btn';
    $('btnAuto').disabled = act || cred;
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
    if (pending || !state || state.profile === p) return Promise.resolve(null);
    clearSecrets();
    showError('');
    return call('selectProfile', p, true);
  }
  function needKeys() { showError('키 ID와 애플리케이션 키를 모두 입력해 주세요.' + RETYPE); }
  function revealFind() {
    recoForce = true;
    render();
    $('recoBox').open = true;
    const r = state && state.recovery;
    goTo(r && r.connected && !r.needsLogin ? 'btnRFind' : 'btnRConnect');
  }

  $('tabLocal').addEventListener('click', () => pickTab('local'));
  $('tabB2').addEventListener('click', () => pickTab('b2'));
  $('btnSources').addEventListener('click', async () => { await call('chooseSources'); await refresh(); });
  $('btnTarget').addEventListener('click', async () => { await call('chooseTarget'); await refresh(); });
  $('setupForm').addEventListener('submit', (e) => { e.preventDefault(); call('setup', undefined, true); });
  $('btnImport').addEventListener('click', () => call('importRecoveryKit', undefined, true));
  $('btnFindOther').addEventListener('click', revealFind);
  $('btnFindOtherL').addEventListener('click', async () => { await pickTab('b2'); if (state && state.profile === 'b2') revealFind(); });
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
  $('btnRKit').addEventListener('click', () => call('saveRecoveryKit', undefined, true));
  $('btnRConnect').addEventListener('click', async () => { if (pending) return; connecting = true; render(); try { await call('connectRecovery', undefined, true); } finally { connecting = false; render(); } });
  $('btnRSync').addEventListener('click', () => call('syncRecovery', undefined, true));
  $('btnRDisc').addEventListener('click', async () => { if (await call('disconnectRecovery', undefined, true)) { recoSearched = false; render(); } });
  $('btnRFind').addEventListener('click', async () => { if (await call('findRecoveryBackups', undefined, true)) { recoSearched = true; render(); } });
  $('recoSel').addEventListener('change', () => render());
  $('recoBox').addEventListener('toggle', () => { if (!$('recoBox').open) recoForce = false; });
  $('btnRImport').addEventListener('click', async () => {
    const id = $('recoSel').value;
    if (!id || pending || !state || !state.recovery || !state.recovery.canImport) return;
    if (await call('importAccountRecovery', id, true)) { recoSearched = false; recoForce = false; render(); }
  });
  $('btnHero').addEventListener('click', runHero);
  $('btnHeroRestore').addEventListener('click', () => call('restoreLatest', undefined, true));
  $('btnAuto').addEventListener('click', () => call('setAutomatic', false, true));
  ['btnP60', 'btnP240', 'btnP720'].forEach((id) => { $(id).addEventListener('click', (e) => { const m = Number(e.currentTarget.dataset.min); if (m === 60 || m === 240 || m === 720) call('pauseAutomatic', m, true); }); });
  $('btnResume').addEventListener('click', () => call('resumeAutomatic', undefined, true));
  $('btnNow').addEventListener('click', () => call('backupNow', undefined, true));
  $('btnProbe').addEventListener('click', () => call('probeRestore', undefined, true));
  $('btnCheck').addEventListener('click', () => call('checkRepository', undefined, true));
  $('btnRestore').addEventListener('click', () => call('restoreLatest', undefined, true));
  $('btnOpen').addEventListener('click', () => call('openRestoreFolder'));
  $('btnPick').addEventListener('click', pkStart);
  $('btnHeroPick').addEventListener('click', pkStart);
  $('btnPickClose').addEventListener('click', pkClose);
  $('btnPickRefresh').addEventListener('click', () => { pkRun(pkOpen); });
  $('btnPickFull').addEventListener('click', () => call('restoreLatest', undefined, true));
  $('btnPickOpen').addEventListener('click', () => { if (state) call('openSelectedRestoreFolder', { profile: state.profile }); });
  $('pickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = String($('pickQuery').value || '').trim();
    if (q.length > 200) { pk.msg = PK_MSG.QUERY_INVALID; render(); return; }
    pkRun(async () => { if (!pkLive()) return; await pkQuery(q, 0); });
  });
  $('btnPickAll').addEventListener('click', () => pkSet('all'));
  $('btnPickClear').addEventListener('click', () => pkSet('clear'));
  $('btnPickPrev').addEventListener('click', () => pkGo(-1));
  $('btnPickNext').addEventListener('click', () => pkGo(1));
  $('btnPickRestore').addEventListener('click', pkRestore);
  setInterval(() => { if (pk.open && pk.token && !pending) render(); }, 30000);
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


(function(){
'use strict';
var api=window.backup;
if(!api||typeof api.previewRecommended!=='function')return;
function $(id){return document.getElementById(id)}
var card=$('rpCard');if(!card)return;
card.hidden=false;
var st=null,pending=false,localErr='',seeded=null,usdTouched=false,unsub=null,poll=0,dead=false;
var nf=new Intl.NumberFormat('ko-KR');
function txt(e){if(e==null||e==='')return '';var s=typeof e==='string'?e:(e.message||e.reason||e.code||'');if(!s){try{s=JSON.stringify(e)}catch(_){s='알 수 없는 오류'}}return String(s).slice(0,600)}
function num(n){return nf.format(Number(n)||0)}
function size(n){n=Number(n)||0;return num(n)+'바이트(약 '+(n/1e9).toFixed(2)+' GB)'}
function when(t){var d=new Date(t);return isNaN(d)?txt(t):d.toLocaleString('ko-KR')}
function money(x){return x==null||!isFinite(Number(x))?'-':'$'+Number(x).toFixed(2)}
function set(id,s){var el=$(id);if(el)el.textContent=s==null?'':String(s)}
function show(id,on){var el=$(id);if(el)el.hidden=!on}
function list(id,items,fmt){
  var ul=$(id);if(!ul)return;
  while(ul.firstChild)ul.removeChild(ul.firstChild);
  (items||[]).forEach(function(it){var li=document.createElement('li');fmt(li,it);ul.appendChild(li)});
}
var WHY={cache:'캐시',temp:'임시 파일',tmp:'임시 파일',system:'시스템 파일',os:'시스템 파일',node_modules:'개발 도구 파일',build:'빌드 결과물',vcs:'버전 관리 폴더',git:'버전 관리 폴더',recycle:'휴지통','recycle-bin':'휴지통',symlink:'바로가기 링크',reparse:'바로가기 링크',junction:'바로가기 링크',placeholder:'클라우드 전용 파일','cloud-placeholder':'클라우드 전용 파일','too-large':'너무 큰 파일',large:'너무 큰 파일',media:'미디어 파일',video:'동영상',duplicate:'중복 파일',synced:'이미 동기화됨',app:'프로그램 파일',program:'프로그램 파일',hidden:'숨김 파일',locked:'사용 중이라 읽지 못함',ebusy:'사용 중이라 읽지 못함',eperm:'권한 없음',eacces:'권한 없음',permission:'권한 없음',enoent:'파일이 사라짐',missing:'파일이 사라짐',eloop:'링크 반복',enametoolong:'경로가 너무 김','path-too-long':'경로가 너무 김',eio:'디스크 읽기 오류'};
Object.assign(WHY,{explicit_exclusion:'보호 규칙에 따라 제외',existing_restic_repository:'기존 암호화 백업 저장소',reparse_or_cloud_placeholder:'연결 지점(reparse) 또는 클라우드 자리표시자 파일',node_modules_with_package_json:'package.json이 있는 node_modules (재설치 가능)',target_with_cargo_toml:'Cargo.toml이 있는 target 빌드 폴더 (재생성 가능)',venv_with_pyvenv_cfg:'pyvenv.cfg가 있는 Python 가상환경 (재생성 가능)',not_found:'경로를 찾을 수 없음',access_denied:'접근 권한 없음',scan_limit:'검사 한도 도달',time_limit:'검사 시간 한도 도달',entry_limit:'항목 수 한도 도달',exclusion_limit:'제외 항목 수 한도 도달',depth_limit:'폴더 깊이 한도 도달',ambiguous_path:'모호한 경로'});
function why(x){var k=txt(x),l=k.toLowerCase();return Object.prototype.hasOwnProperty.call(WHY,l)?WHY[l]:k}
var VER={'all-file-sha256-against-authenticated-stream':1,'sha-256':1};
function ver(x){var k=txt(x);return Object.prototype.hasOwnProperty.call(VER,k.toLowerCase())?'파일 내용 검증 완료':k}
function lockDest(r){var cfg=!!(r&&r.configured),d=cfg?r.destination:'',rs=document.querySelectorAll('input[name=rpDest]'),has=false,i;for(i=0;i<rs.length;i++)if(rs[i].value===d)has=true;for(i=0;i<rs.length;i++){if(has)rs[i].checked=rs[i].value===d;rs[i].disabled=cfg||(!!(r&&r.cloudDeferred)&&rs[i].value==='b2')}}
function pathItem(li,it){
  if(it==null||typeof it!=='object'){li.textContent=txt(it);return}
  var p=document.createElement('span');p.textContent=txt(it.path);li.appendChild(p);
  if(it.reason){var r=document.createElement('span');r.className='rpWhy';r.textContent=' · '+why(it.reason);li.appendChild(r)}
}
function dest(){var r=document.querySelector('input[name=rpDest]:checked');return r?r.value:'local'}
function cap(){var v=Number($('rpCap').value);return Number.isSafeInteger(v)&&v>=1&&v<=1000000?v:0}
function usd(){var s=$('rpUsd').value,v=Number(s);return s!==''&&isFinite(v)&&v>=0?v:-1}
function rate(p){return (p&&p.price&&Number(p.price.rate))||6.95}
function defUsd(p){return Math.ceil(cap()*1e9/1e12*rate(p)*100)/100}
function seed(p){
  if(!p||!p.hash||p.hash===seeded)return;
  seeded=p.hash;usdTouched=false;
  $('rpCap').value=Math.max(1,Math.ceil((Number(p.bytes)||0)*1.3/1e9));
  $('rpUsd').value=defUsd(p);$('rpOk').checked=false;
}
function render(){
  var r=st||{},p=r.preview||null,busy=!!r.busy||pending,cfg=!!r.configured,lb=r.lastBackup||null,na=cfg&&!!r.needsApproval,canSet=!cfg||na;
  card.setAttribute('aria-busy',busy?'true':'false');
  set('rpStatus',busy?(r.stage?'진행 중: '+txt(r.stage):'진행 중입니다…'):na?'목록이 바뀌었습니다. 확인 후 다시 시작해 주세요.':(p?'자료 찾기가 끝났습니다. 아래 내용을 확인하세요.':(cfg?'':'‘자료 찾기’를 누르면 이 PC에서 추천 자료를 찾습니다.')));
  show('rpBar',busy);
  var err=localErr||txt(r.error);set('rpErr',err);show('rpErr',!!err);
  $('rpPreview').disabled=busy;
  show('rpResult',!!p);
  if(p){
    seed(p);
    var db=Array.isArray(p.databases)?p.databases.length:Number(p.databases)||0;
    set('rpTotal','파일 '+num(p.files)+'개 · '+size(p.bytes)+(db?' · 데이터베이스 '+num(db)+'개':''));
    show('rpScope',p.discoveryComplete===false);
    show('rpIncomplete',p.complete!==true);
    var src=p.sources||[];set('rpSrcN',num(src.length)+'곳');list('rpSrc',src,pathItem);
    var ex=(p.exclusions||[]).slice(0,100),exN=Math.max(Number(p.exclusionCount)||0,ex.length);
    set('rpExcN',num(exN)+'개');list('rpExc',ex,pathItem);
    set('rpExcMore',exN>ex.length?'총 '+num(exN)+'개 중 처음 '+num(ex.length)+'개만 표시합니다. 화면 목록은 일부입니다. 전체 목록 열기는 준비 중입니다.':'');
    var man=p.manual||[];show('rpManBox',man.length>0);list('rpMan',man,pathItem);
    var errs=p.errors||[];show('rpErrsBox',errs.length>0);set('rpErrsN',num(errs.length)+'개');list('rpErrs',errs,pathItem);
    var pr=p.price||{};set('rpM1',money(pr.month1USD));set('rpM12',money(pr.month12USD));
    set('rpRate',(r.cloudDeferred?'향후 클라우드 확장 시 참고용 추정이며 현재 청구 금액이 아닙니다. ':'')+'B2 단가 $'+rate(p)+'/TB·월'+(pr.date?' ('+txt(pr.date)+' 기준)':'')+(pr.changeRate!=null?' · 월 변경률 '+Math.round(Number(pr.changeRate)*100)+'% 가정':'')+(pr.assumption?' · '+txt(pr.assumption):''));
  }
  lockDest(r);
  var b2=dest()==='b2';
  show('rpSetup',!!p&&canSet);
  var def=!!r.cloudDeferred;show('rpDeferred',def);
  show('rpCloudNote',b2&&!def);show('rpCloudMissing',b2&&!r.cloudReady&&!def);show('rpGoCloud',!def);
  $('rpStart').disabled=!(p&&canSet&&p.hash&&p.complete===true&&$('rpOk').checked&&!busy&&(!b2||(r.cloudReady&&!def))&&cap()>0&&usd()>=0);
  show('rpSaved',cfg);
  if(cfg){
    set('rpWhere',r.destination==='b2'?(lb&&lb.verifiedAt?'클라우드 사본 · 업로드 확인됨':'클라우드 · 업로드 확인과 복구 키 외부 보관이 끝나야 보호가 완료됩니다'):'로컬 사본 · 노트북 분실 보호 아님');
    set('rpAuto','자동 백업: '+(r.automatic?'켜짐':'꺼짐')+(r.storedBytes!=null?' · 백업 데이터 용량(참조 데이터) '+size(r.storedBytes):''));
    set('rpLast',lb?'마지막 백업 '+when(lb.at)+' · 파일 '+num(lb.files)+'개 · '+size(lb.bytes)+(lb.verifiedAt?' · 확인 '+when(lb.verifiedAt):' · 확인 전'):'아직 완료된 백업이 없습니다.');
    var lr=r.lastRestore;show('rpRestBox',!!lr);
    if(lr){
      set('rpRest','최근 복구 확인 '+when(lr.at)+' · 파일 '+num(lr.files)+'개 · '+size(lr.bytes)+(lr.verification?' · '+ver(lr.verification):''));
      set('rpRestPath',txt(lr.path));
    }
  }
  $('rpNow').disabled=busy||!cfg||na;
  $('rpRestore').disabled=busy||!cfg||!lb;
}
function accept(s){
  if(dead||!s||typeof s!=='object')return;
  var v=('ok' in s)?(s.ok?s.value:null):s;
  if(v&&typeof v==='object'){st=v.recommended||null;render()}
}
function refresh(){
  if(dead||typeof api.getState!=='function')return;
  try{Promise.resolve(api.getState()).then(accept,function(){})}catch(_){}
}
function safe(f){try{var x=f();if(x&&typeof x.catch==='function')x.catch(function(){})}catch(_){}}
function startPoll(){if(!poll&&!dead)poll=setInterval(refresh,2000)}
function act(name,args){
  if(pending)return;
  var f=api[name];
  if(typeof f!=='function'){localErr='이 버전에서는 이 기능을 쓸 수 없습니다.';render();return}
  pending=true;localErr='';render();
  var pr;
  try{pr=Promise.resolve(args?f.call(api,args):f.call(api))}catch(e){pr=Promise.reject(e)}
  pr.then(function(env){if(!env||env.ok!==true)localErr=txt(env&&env.error)||'작업을 시작하지 못했습니다.'},
    function(e){localErr=txt(e)||'작업을 시작하지 못했습니다.'})
  .then(function(){pending=false;render();refresh()});
}
$('rpPreview').addEventListener('click',function(){act('previewRecommended')});
$('rpStart').addEventListener('click',function(){
  var p=st&&st.preview;
  if(!p||$('rpStart').disabled||(st.configured&&!st.needsApproval)||!$('rpOk')||!$('rpOk').checked||p.complete!==true||st.busy||((st.configured&&st.destination?st.destination:dest())==='b2'&&(st.cloudReady!==true||st.cloudDeferred)))return;
  act('startRecommended',{planHash:p.hash,destination:st.configured&&st.destination?st.destination:dest(),maxBytes:cap()*1e9,monthlyUSD:usd()});
});
$('rpNow').addEventListener('click',function(){if(!st||!st.configured||st.needsApproval)return;act('backupRecommended')});
$('rpRestore').addEventListener('click',function(){act('restoreRecommended')});
$('rpGoCloud').addEventListener('click',function(){if(st&&st.cloudDeferred)return;var t=$('tabB2');if(t&&!t.disabled)t.click()});
$('rpCap').addEventListener('input',function(){if(!usdTouched)$('rpUsd').value=cap()?defUsd(st&&st.preview):'';render()});
$('rpUsd').addEventListener('input',function(){usdTouched=true;render()});
card.addEventListener('change',render);
if(typeof api.onState==='function'){
  try{
    Promise.resolve(api.onState(accept)).then(function(u){
      if(typeof u!=='function')return;
      if(dead)safe(u);else unsub=u;
    },function(){startPoll()});
  }catch(_){startPoll()}
}else startPoll();
window.addEventListener('pagehide',function(){
  dead=true;
  if(poll){clearInterval(poll);poll=0}
  if(unsub){var u=unsub;unsub=null;safe(u)}
});
render();refresh();
})();
