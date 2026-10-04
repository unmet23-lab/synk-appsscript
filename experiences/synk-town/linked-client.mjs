export function createTownTransport({ windowObject = globalThis.window, fetcher = globalThis.fetch } = {}) {
  const linked = windowObject.location.pathname === '/synk-town/linked.html';
  let host = null;
  function active() {
    try {
      const parent = windowObject.parent;
      if (parent === windowObject || parent.location.origin !== windowObject.location.origin) throw Error();
      const current = parent.SYNKTownHost;
      if (!current || typeof current.read !== 'function' || typeof current.command !== 'function' || (host && current !== host)) throw Error();
      host ||= current; return host;
    } catch { throw new Error('연결된 WORLD의 내 공간에서 다시 열어 주세요.'); }
  }
  async function request(method, payload) {
    if (linked) {
      const owner = active(), value = await owner[method](payload); active();
      if (!value?.state || !value?.view || !['local-linked','account-linked'].includes(value.mode)) throw Error('내 체험 기록을 확인할 수 없어요.');
      return value;
    }
    const response = await fetcher(`/api/preview/${method === 'read' ? 'state' : 'command'}`, method === 'read'
      ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
    const value = await response.json();
    if (!response.ok || value.error || !value.state || !value.view) throw Error(value.message || '체험 기록을 다시 확인해 주세요.');
    return value;
  }
  return { linked, read: () => request('read'), command: payload => request('command', payload),
    learningReady() { if (!linked) return false; active(); return windowObject.parent.SYNKLearningHost?.status()?.complete === true; } };
}
