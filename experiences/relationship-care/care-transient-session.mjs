/**
 * 플레저 임시 편집 세션 — 화면에만 있는 작업의 주인과 수명.
 *
 * 수첩 자료(state)는 저장과 계정 동기화가 맡는다. 여기서는 저장하기 전의 임시 작업, 곧
 * 원고·고른 녹음과 받아쓰기·object URL·카드/연락처/사람/달력 창·확인창이 수첩 주인이
 * 바뀌거나 화면이 잠기고 풀릴 때 각자의 주인을 통해 정리되게 한다. 앱의 replaceState는
 * 기능별 DOM id나 정리 순서를 모르고 이 표면 하나만 부른다.
 *
 * 주인 하나가 가질 수 있는 단계
 * - clearForOwnerChange(): 다른 수첩이 들어온다(계정 전환·로그아웃·계정 수첩 교체·백업
 *   되살리기). 진행 중 작업을 끊고 자원을 놓고 입력과 창을 비운다. 여러 번 불러도 안전하다.
 * - suspend(): 같은 계정을 다시 확인하거나 계정 수첩을 불러오는 동안 화면을 잠근다. 입력과
 *   자원은 그대로 두고 창과 재생만 멈춘다.
 * - restore(): 같은 계정이 확인되어 잠금이 풀리면 멈춘 창을 다시 연다.
 * - pageHide({ persisted }): 페이지를 떠날 때. BFCache로 돌아올 수 있으면 다시 쓸 자원은 남긴다.
 *
 * 계정 세대(authEpoch)와 손님 수첩 보관(guestSnapshot)은 앱이 갖는다. readOwnerTransition은
 * 계정 상태 하나를 hold(같은 계정을 다시 확인하는 동안 잠금)·same(같은 주인)·change(주인
 * 교체)로 읽어 준다. 일시 장애는 로그아웃이 아니라 hold다.
 */

const PHASES = Object.freeze(['clearForOwnerChange', 'suspend', 'restore', 'pageHide']);

/**
 * 등록한 순서대로 주인들의 단계를 부른다. 한 주인이 실패해도 나머지 주인은 끝까지 정리하고,
 * 첫 오류를 다시 던진다(앞 주인 하나 때문에 object URL이나 진행 중 요청이 남지 않게).
 */
export function createTransientSession(entries = []) {
  const owners = [];
  const run = (phase, detail) => {
    let failure = null;
    for (const { lifecycle } of owners) {
      if (typeof lifecycle[phase] !== 'function') continue;
      try { lifecycle[phase](detail); } catch (error) { failure ??= error; }
    }
    if (failure) throw failure;
  };
  const session = {
    register(name, lifecycle) {
      if (typeof name !== 'string' || !name.trim()) throw new TypeError('A transient owner needs a name.');
      if (owners.some(owner => owner.name === name)) throw new Error(`Transient owner already registered: ${name}`);
      if (!lifecycle || typeof lifecycle !== 'object' || !PHASES.some(phase => typeof lifecycle[phase] === 'function')) throw new TypeError(`Transient owner ${name} has no lifecycle.`);
      for (const phase of PHASES) if (lifecycle[phase] !== undefined && typeof lifecycle[phase] !== 'function') throw new TypeError(`Transient owner ${name}.${phase} must be a function.`);
      owners.push({ name, lifecycle });
      return lifecycle;
    },
    owners: () => owners.map(owner => owner.name),
    clearForOwnerChange: () => run('clearForOwnerChange'),
    suspend: () => run('suspend'),
    restore: () => run('restore'),
    pageHide: ({ persisted = false } = {}) => run('pageHide', { persisted: persisted === true }),
  };
  for (const [name, lifecycle] of entries) session.register(name, lifecycle);
  return Object.freeze(session);
}

/**
 * object URL 한 자리. begin()이 준 표가 지금 표일 때만 publish가 URL을 만든다. 그래서
 * release()나 다음 begin() 뒤에 늦게 끝난 작업은 새 URL을 만들지 못한다. release는 몇 번
 * 불러도 같은 URL을 두 번 놓지 않는다.
 */
export function createObjectUrlSlot({ urls = globalThis.URL } = {}) {
  let url = null, name = '', generation = 0;
  return Object.freeze({
    get url() { return url; },
    get name() { return name; },
    begin: () => ++generation,
    isCurrent: ticket => ticket === generation,
    publish(blob, { ticket = generation, name: label = '' } = {}) {
      if (ticket !== generation) return null;
      if (url) urls.revokeObjectURL(url);
      url = urls.createObjectURL(blob); name = String(label ?? '');
      return url;
    },
    release() {
      generation++;
      const previous = url; url = null; name = '';
      if (previous) urls.revokeObjectURL(previous);
    },
  });
}

/**
 * 고른 녹음 파일, 재생용 object URL, 받아쓰기 요청 하나를 함께 맡는다. 화면은 view가 그린다:
 * show(file, url) · stopped()(진행 중 받아쓰기를 끊었을 때) · reset() · pause().
 * 녹음은 어디에도 저장하지 않으므로 주인이 바뀌면 파일·URL·요청을 모두 놓는다.
 */
export function createRecordingWorkspace({ view, urls = globalThis.URL, AbortControllerClass = globalThis.AbortController } = {}) {
  if (!view || typeof view.show !== 'function' || typeof view.reset !== 'function') throw new TypeError('A recording workspace needs a view with show() and reset().');
  const media = createObjectUrlSlot({ urls });
  let file = null, job = null;
  function clear() {
    if (job) { const previous = job; job = null; previous.controller.abort(); view.stopped?.(); }
    media.release(); file = null; view.reset();
  }
  return Object.freeze({
    get file() { return file; },
    get url() { return media.url; },
    get transcribing() { return job !== null; },
    /** 앞 녹음은 clear()로 먼저 정리한다(잘못 고른 파일도 앞 녹음은 지운다). */
    take(nextFile) {
      file = nextFile;
      const url = media.publish(nextFile);
      view.show(nextFile, url);
      return url;
    },
    startTranscription() {
      if (!file) throw new Error('No recording is selected.');
      const current = { controller: new AbortControllerClass(), file };
      job = current;
      return Object.freeze({
        file: current.file, signal: current.controller.signal,
        /** 이 요청이 지금 녹음의 마지막 요청일 때만 결과를 화면에 쓴다. */
        isCurrent: () => job === current && file === current.file,
        /** 끝난 요청이 지금 요청이면 비우고 true. 더 새 요청이나 정리가 있었으면 false. */
        finish: () => { if (job !== current) return false; job = null; return true; },
      });
    },
    clear,
    clearForOwnerChange: clear,
    suspend() { view.pause?.(); },
    pageHide({ persisted = false } = {}) { view.pause?.(); if (!persisted) media.release(); },
  });
}

/**
 * 잠금 동안 닫아 둔 창. suspend는 열린 창을 닫고 기억하며, restore는 기억한 창을 다시 연다.
 * 주인이 바뀌면 기억만 버린다(창 자체는 그 창의 주인이 닫는다).
 */
export function createDialogSuspension({ ids, dialog }) {
  const watched = Object.freeze([...ids]);
  let suspended = [];
  return Object.freeze({
    isSuspended: id => suspended.includes(id),
    suspendedIds: () => [...suspended],
    suspend() {
      for (const id of watched) {
        const node = dialog(id);
        if (node.open) { if (!suspended.includes(id)) suspended.push(id); node.close(); }
      }
    },
    restore() { const reopen = suspended; suspended = []; for (const id of reopen) dialog(id).showModal(); },
    clearForOwnerChange() { suspended = []; },
  });
}

/**
 * 확인창 하나. 묻는 순간의 주인 표(ownerToken)를 붙잡아, 창이 닫힐 때 주인이 바뀌었으면
 * 「확인」을 눌렀어도 false로 끝난다. 잠그면 「취소」로 닫는다.
 */
export function createConfirmation({ dialog, present, ownerToken }) {
  return Object.freeze({
    ask({ message, title, button }) {
      const token = ownerToken(), node = dialog();
      present({ title, message, button });
      node.returnValue = 'cancel'; node.showModal();
      return new Promise(resolve => node.addEventListener('close', () => resolve(token === ownerToken() && node.returnValue === 'confirm'), { once: true }));
    },
    suspend() { const node = dialog(); if (node.open) { node.returnValue = 'cancel'; node.close(); } },
  });
}

/**
 * 계정 상태 하나를 수첩 주인 전환으로 읽는다.
 * - hold: 로그인한 계정을 다시 확인하는 중(restoring)이거나 다시 시도할 수 있는 일시 장애.
 *   로그아웃이 아니므로 임시 작업은 잠근 채 그대로 둔다.
 * - same: 주인이 그대로다.
 * - change: 주인이 바뀐다. 손님에서 계정으로 들어가면 손님 수첩을 보관하고(parkGuest),
 *   계정에서 손님으로 나오면 보관한 손님 수첩을 되돌린다(restoreGuest). 계정 A에서 B로 바로
 *   바뀌면 보관한 손님 수첩은 건드리지 않는다.
 */
export function readOwnerTransition(currentAccountId, status) {
  if (currentAccountId && (status.status === 'restoring' || !status.signedIn && status.status === 'error' && status.error?.retryable === true)) return { kind: 'hold' };
  const nextId = status.signedIn ? status.accountId || status.account?.synk_user_id : null;
  if (nextId === currentAccountId) return { kind: 'same', nextId };
  const hadAccount = !!currentAccountId;
  return { kind: 'change', nextId, parkGuest: !hadAccount && !!nextId, restoreGuest: hadAccount && !nextId };
}
