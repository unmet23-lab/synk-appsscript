// Explicit opt-in, device-local fictional walkthrough storage. No network or account data.
// IndexedDB read/write transactions make revision checks atomic across tabs.
export function createJourneyMemory({ indexedDB = globalThis.indexedDB, name = 'synk-atlas-fictional-journey-v1' } = {}) {
  const empty = () => ({ version: 1, revision: 0, generation: 0, enabled: false, value: null });
  const clone = value => JSON.parse(JSON.stringify(value));
  const newEpoch = () => {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const epochOf = row => row.version === 2 ? row.epoch : null;
  const matches = (row, expected) => row.revision === expected.revision && row.generation === expected.generation && epochOf(row) === (expected.epoch ?? null);
  const increment = value => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER ? value + 1 : 0;
  let connection;
  function open() {
    if (!indexedDB) return Promise.reject(new Error('storage-unavailable'));
    return connection ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshot');
      request.onerror = () => { connection = null; reject(new Error('storage-unavailable')); };
      request.onblocked = () => { connection = null; reject(new Error('storage-blocked')); };
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
    });
  }
  function valid(row) {
    if (![1, 2].includes(row?.version) || row.version === 2 && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.epoch || '')
      || !Number.isSafeInteger(row.revision) || row.revision < 0
      || !Number.isSafeInteger(row.generation) || row.generation < 0 || typeof row.enabled !== 'boolean'
      || (row.enabled ? !row.value?.discovery : row.value !== null)) throw new Error('invalid-saved-state');
    return row;
  }
  async function transact(change, discardUnreadable = false) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshot', change ? 'readwrite' : 'readonly'), store = tx.objectStore('snapshot');
      let result, failure;
      tx.oncomplete = () => {
        try { resolve(clone(result)); } catch { reject(new Error('invalid-saved-state')); }
      };
      tx.onerror = tx.onabort = () => reject(failure || new Error('storage-unavailable'));
      const request = store.get('current');
      request.onsuccess = () => {
        try {
          const raw = request.result === undefined ? empty() : request.result;
          const prior = discardUnreadable ? raw : valid(raw); result = change ? valid(change(prior)) : prior;
          if (change) store.put(result, 'current');
        } catch (error) { failure = error; tx.abort(); }
      };
    });
  }
  return Object.freeze({
    read: () => transact(),
    save({ revision, generation, epoch, value, enable = false }) {
      const serialized = JSON.stringify(value);
      if (!serialized || serialized.length > 1500000 || !value?.discovery || !Object.hasOwn(value, 'meeting')) return Promise.reject(new Error('invalid-saved-state'));
      const safe = JSON.parse(serialized);
      return transact(prior => {
        if (!matches(prior, { revision, generation, epoch })) throw new Error('storage-conflict');
        if (!prior.enabled && !enable) throw new Error('storage-disabled');
        return { version: 2, revision: prior.revision + 1, generation: prior.generation, epoch: epochOf(prior) || newEpoch(), enabled: true, value: safe };
      });
    },
    forget({ revision, generation, epoch }) {
      return transact(prior => {
        if (!matches(prior, { revision, generation, epoch })) throw new Error('storage-conflict');
        return { version: 2, revision: prior.revision + 1, generation: prior.generation + 1, epoch: newEpoch(), enabled: false, value: null };
      });
    },
    // Only the explicit delete button uses this path. A corrupt envelope cannot
    // prevent its own erasure. A fresh epoch prevents counter reuse after repair;
    // v2 also makes an already-open v1 client reject rather than overwrite it.
    forgetStored() {
      return transact(prior => ({ version: 2, revision: increment(prior?.revision), generation: increment(prior?.generation),
        epoch: newEpoch(), enabled: false, value: null }), true);
    }
  });
}

export function mountJourneyMemory({ root = document, discovery, meeting }) {
  const area = root.getElementById('journey-memory');
  const allowed = area?.dataset.localMemory === 'optional' && ['http:', 'https:'].includes(location.protocol);
  let row = null, enabled = false, restoring = false, queued = false, queue = Promise.resolve();
  const memory = allowed ? createJourneyMemory() : null;
  const make = (tag, text) => { const el = root.createElement(tag); el.textContent = text; return el; };
  const title = make('h3', '다시 와도 이어서 보기'), status = make('p', ''), actions = make('div', '');
  status.id = 'journey-memory-status'; status.className = 'mini'; status.setAttribute('role', 'status'); actions.className = 'interpret-actions';
  area.replaceChildren(title, make('p', allowed ? '켜면 이 기기에 가상 체험의 답·후보 선택·만남과 비공개 회고를 저장해요. 실제 계정이나 다른 기기에는 보내지 않아요.' : '공유판은 체험 내용을 저장하지 않아요.'), actions, status);
  const snapshot = () => ({ discovery: discovery.exportState(), meeting: meeting.exportState() });
  function notice(error) {
    enabled = false;
    status.textContent = error.message === 'storage-conflict' ? '다른 탭에서 저장하거나 삭제했어요. 이 화면의 수정은 저장하지 않았어요. 저장된 내용을 다시 확인해 주세요.' : '기기에 저장하지 못했어요. 이 화면에서는 계속 체험할 수 있어요.';
    render();
  }
  function enqueue(fn) { queue = queue.then(fn).catch(notice); return queue; }
  function btn(text, action, fn) { const b = make('button', text); b.type = 'button'; b.className = 'slab'; b.dataset.memoryAction = action; b.onclick = () => enqueue(fn); return b; }
  function render() {
    actions.replaceChildren(); if (!allowed) return;
    if (!enabled) actions.append(btn('이 기기에 기억하기', 'enable', async () => {
      const current = await memory.read();
      if (current.enabled) { row = current; status.textContent = '기억해 둔 체험이 있어요. 먼저 이어 보거나 지워 주세요.'; render(); return; }
      row = await memory.save({ ...current, value: snapshot(), enable: true }); enabled = true; status.textContent = '이 기기에 기억했어요. 이후 선택도 같은 범위로 저장해요.'; render();
    }));
    if (!enabled) actions.append(btn('기억한 체험 이어 보기', 'resume', async () => {
      const current = await memory.read(); row = current;
      if (!current.enabled) { status.textContent = '이 기기에 기억한 체험이 없어요.'; render(); return; }
      const before = snapshot(); restoring = true;
      try { meeting.restoreState(current.value.meeting); discovery.restoreState(current.value.discovery); }
      catch (error) { meeting.restoreState(before.meeting); discovery.restoreState(before.discovery); throw error; }
      finally { restoring = false; }
      enabled = true; status.textContent = '기억한 체험을 이어 왔어요. 이번 상황이 달라졌다면 그 항목만 고쳐 주세요.'; render();
    }));
    actions.append(btn('기억 지우고 저장 끄기', 'forget', async () => {
      row = await memory.forgetStored(); enabled = false;
      status.textContent = '기억한 답과 회고를 지웠고 자동 저장을 껐어요. 현재 탭의 체험은 남아 있어요.'; render();
    }));
  }
  render();
  if (allowed) enqueue(async () => { row = await memory.read(); status.textContent = row.enabled ? '기억한 체험이 있어요. 원할 때 이어 볼 수 있어요.' : '지금은 저장하지 않고 체험하고 있어요.'; });
  return Object.freeze({
    changed() {
      if (!enabled || restoring || queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false; if (!enabled || restoring) return;
        const value = snapshot(); status.textContent = '기기에 기억하고 있어요…';
        enqueue(async () => { if (!enabled) return; row = await memory.save({ ...row, value }); status.textContent = '이 기기에 기억했어요.'; });
      });
    },
    inspect: () => ({ enabled, revision: row?.revision ?? null, generation: row?.generation ?? null }),
    settled: () => queue
  });
}
