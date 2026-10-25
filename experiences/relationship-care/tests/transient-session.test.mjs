import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransientSession, createObjectUrlSlot, createRecordingWorkspace, createDialogSuspension, createConfirmation, readOwnerTransition } from '../care-transient-session.mjs';

// 실제 모듈만 import해서 돈다. 창은 HTMLDialogElement처럼 닫힐 때 close 이벤트를 다음 차례에 보낸다.
class FakeDialog extends EventTarget {
  constructor(id) { super(); this.id = id; this.open = false; this.returnValue = ''; this.shown = 0; }
  showModal() { this.open = true; this.shown++; }
  close() { if (!this.open) return; this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))); }
}
const dialogs = ids => { const map = new Map(ids.map(id => [id, new FakeDialog(id)])); return { map, find: id => map.get(id) }; };
const alive = async url => { try { await (await fetch(url)).arrayBuffer(); return true; } catch { return false; } };
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function countingUrls(t) {
  const created = [], revoked = [];
  const urls = { createObjectURL: blob => { const url = URL.createObjectURL(blob); created.push(url); return url; }, revokeObjectURL: url => { revoked.push(url); URL.revokeObjectURL(url); } };
  t.after(() => { for (const url of created) URL.revokeObjectURL(url); });
  return { urls, created, revoked };
}
function recordingFixture(t) {
  const { urls, created, revoked } = countingUrls(t), calls = [], player = { src: '', pauses: 0 };
  const recording = createRecordingWorkspace({ urls, view: {
    show(file, url) { calls.push('show:' + file.name); player.src = url; },
    stopped() { calls.push('stopped'); },
    reset() { calls.push('reset'); player.src = ''; },
    pause() { calls.push('pause'); player.pauses++; },
  } });
  const audio = name => Object.assign(new Blob(['synthetic audio ' + name], { type: 'audio/wav' }), { name });
  return { recording, calls, player, created, revoked, audio };
}

test('세션은 등록한 순서대로 주인의 단계를 부르고, 같은 정리를 여러 번 불러도 안전하다', () => {
  const log = [];
  const session = createTransientSession([
    ['dialogs', { clearForOwnerChange: () => log.push('dialogs:clear'), suspend: () => log.push('dialogs:suspend'), restore: () => log.push('dialogs:restore') }],
    ['draft', { clearForOwnerChange: () => log.push('draft:clear') }],
  ]);
  session.register('recording', { clearForOwnerChange: () => log.push('recording:clear'), suspend: () => log.push('recording:suspend'), pageHide: detail => log.push('recording:pagehide:' + detail.persisted) });
  assert.deepEqual(session.owners(), ['dialogs', 'draft', 'recording']);

  session.clearForOwnerChange(); session.clearForOwnerChange();
  assert.deepEqual(log.splice(0), ['dialogs:clear', 'draft:clear', 'recording:clear', 'dialogs:clear', 'draft:clear', 'recording:clear']);
  session.suspend(); session.restore();
  assert.deepEqual(log.splice(0), ['dialogs:suspend', 'recording:suspend', 'dialogs:restore']);
  session.pageHide({ persisted: true }); session.pageHide({ persisted: 'yes' }); session.pageHide();
  assert.deepEqual(log.splice(0), ['recording:pagehide:true', 'recording:pagehide:false', 'recording:pagehide:false']);
  assert.throws(() => { session.extra = true; }, TypeError, 'the session surface is fixed');
});

test('주인 등록은 이름 중복·빈 이름·단계 없는 수명을 거부한다', () => {
  const session = createTransientSession([['draft', { clearForOwnerChange() {} }]]);
  assert.throws(() => session.register('draft', { clearForOwnerChange() {} }), /already registered: draft/);
  assert.throws(() => session.register('', { clearForOwnerChange() {} }), TypeError);
  assert.throws(() => session.register('empty', {}), /no lifecycle/);
  assert.throws(() => session.register('typo', { clearForOwnerChange() {}, suspend: 'pause' }), /suspend must be a function/);
  assert.deepEqual(session.owners(), ['draft']);
});

test('한 주인이 실패해도 뒤 주인은 끝까지 정리하고 첫 오류를 다시 던진다', () => {
  const log = [];
  const session = createTransientSession([
    ['first', { clearForOwnerChange: () => { log.push('first'); throw Error('first failed'); } }],
    ['second', { clearForOwnerChange: () => { log.push('second'); throw Error('second failed'); } }],
    ['recording', { clearForOwnerChange: () => log.push('recording released') }],
  ]);
  assert.throws(() => session.clearForOwnerChange(), /first failed/);
  assert.deepEqual(log, ['first', 'second', 'recording released']);
});

test('카드 object URL: 주인이 바뀐 뒤 늦게 끝난 작업은 URL을 만들지 못하고, 놓은 URL은 두 번 놓지 않는다', async t => {
  const { urls, created, revoked } = countingUrls(t), slot = createObjectUrlSlot({ urls });
  const late = slot.begin();
  slot.release();
  assert.equal(slot.isCurrent(late), false);
  assert.equal(slot.publish(new Blob(['old account card']), { ticket: late, name: 'old.png' }), null);
  assert.deepEqual(created, [], 'a late completion after the owner change creates no object URL');
  assert.equal(slot.url, null);

  const ticket = slot.begin(), url = slot.publish(new Blob(['card']), { ticket, name: 'card.png' });
  assert.equal(slot.url, url); assert.equal(slot.name, 'card.png'); assert.equal(await alive(url), true);
  const superseded = slot.begin(), newer = slot.begin();
  assert.equal(slot.publish(new Blob(['older preview']), { ticket: superseded }), null, 'an older preview cannot replace a newer one');
  assert.equal(slot.url, url, 'the visible card stays until the current preview finishes');
  const next = slot.publish(new Blob(['newer preview']), { ticket: newer, name: 'next.png' });
  assert.equal(await alive(url), false, 'replacing a card releases the previous URL');
  assert.equal(await alive(next), true);

  slot.release(); slot.release();
  assert.equal(slot.url, null); assert.equal(slot.name, '');
  assert.equal(await alive(next), false);
  assert.deepEqual(revoked, [url, next], 'each URL is released exactly once');
});

test('녹음: 주인이 바뀌면 진행 중 받아쓰기를 끊고 녹음 URL을 놓고 화면을 비우며, 다시 정리해도 안전하다', async t => {
  const { recording, calls, player, revoked, audio } = recordingFixture(t);
  const file = audio('old-account.wav'), url = recording.take(file);
  assert.equal(recording.file, file); assert.equal(recording.url, url); assert.equal(player.src, url);
  assert.equal(await alive(url), true);
  const job = recording.startTranscription();
  assert.equal(recording.transcribing, true); assert.equal(job.file, file); assert.equal(job.isCurrent(), true);

  recording.clearForOwnerChange();
  assert.equal(job.signal.aborted, true, 'the browser request is cancelled');
  assert.equal(recording.transcribing, false); assert.equal(recording.file, null); assert.equal(recording.url, null);
  assert.equal(player.src, '');
  assert.equal(await alive(url), false, 'the recording object URL is revoked');
  assert.equal(job.isCurrent(), false, 'a late transcript cannot be written for the new owner');
  assert.equal(job.finish(), false, 'a late finish cannot reset the transcription controls');
  assert.deepEqual(calls, ['show:old-account.wav', 'stopped', 'reset']);

  recording.clearForOwnerChange(); recording.clear();
  assert.deepEqual(calls, ['show:old-account.wav', 'stopped', 'reset', 'reset', 'reset'], 'repeated cleanup only resets the view again');
  assert.deepEqual(revoked, [url]);
  assert.throws(() => recording.startTranscription(), /No recording/);
});

test('녹음: 이전 녹음의 늦은 결과는 새 녹음의 진행 상태를 풀거나 결과를 쓰지 못한다', t => {
  const { recording, audio } = recordingFixture(t);
  recording.take(audio('first.wav'));
  const first = recording.startTranscription();
  recording.clear(); recording.take(audio('second.wav'));
  const second = recording.startTranscription();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false); assert.equal(first.finish(), false);
  assert.equal(recording.transcribing, true, 'the newer request is still running');
  assert.equal(second.isCurrent(), true); assert.equal(second.finish(), true);
  assert.equal(recording.transcribing, false); assert.equal(second.finish(), false);

  // 같은 녹음 파일을 다시 골라도 정리 전에 시작한 요청은 지금 요청이 아니다.
  const same = audio('same.wav');
  recording.clear(); recording.take(same);
  const before = recording.startTranscription();
  recording.clear(); recording.take(same);
  const after = recording.startTranscription();
  assert.equal(before.file, after.file);
  assert.equal(before.isCurrent(), false, 'an earlier request for the same file is not the current request');
  assert.equal(after.isCurrent(), true);
});

test('녹음: 잠금은 재생만 멈추고, BFCache로 숨으면 URL을 남기며, 완전히 떠나면 URL만 놓는다', async t => {
  const { recording, player, audio } = recordingFixture(t);
  const file = audio('kept.wav'), url = recording.take(file);
  recording.suspend();
  assert.equal(player.pauses, 1); assert.equal(recording.file, file); assert.equal(await alive(url), true);
  recording.pageHide({ persisted: true });
  assert.equal(player.pauses, 2); assert.equal(recording.url, url); assert.equal(await alive(url), true);
  recording.pageHide({ persisted: false });
  assert.equal(player.pauses, 3); assert.equal(recording.url, null); assert.equal(await alive(url), false);
  assert.equal(recording.file, file, 'leaving the page releases the URL, not the chosen file');
});

test('잠금 동안 닫은 창은 같은 계정이 확인되면 다시 열리고, 주인이 바뀌면 다시 열리지 않는다', () => {
  const { map, find } = dialogs(['person-dialog', 'memory-card-dialog', 'followup-calendar-dialog', 'contact-import-dialog']);
  const locked = createDialogSuspension({ ids: [...map.keys()], dialog: find });
  find('memory-card-dialog').showModal(); find('person-dialog').showModal();

  locked.suspend(); locked.suspend();
  assert.equal(find('person-dialog').open, false); assert.equal(find('memory-card-dialog').open, false);
  assert.deepEqual(locked.suspendedIds(), ['person-dialog', 'memory-card-dialog'], 'repeated lock renders remember each dialog once');
  assert.equal(locked.isSuspended('person-dialog'), true); assert.equal(locked.isSuspended('contact-import-dialog'), false);

  locked.restore();
  assert.equal(find('person-dialog').open, true); assert.equal(find('memory-card-dialog').open, true);
  assert.deepEqual(locked.suspendedIds(), []);
  locked.restore();
  assert.equal(find('person-dialog').shown, 2, 'a second unlock does not reopen again');

  // 잠금 중에 같은 창이 다시 열렸다 닫혀도 한 번만 기억하고 한 번만 되살린다.
  locked.suspend(); find('person-dialog').showModal(); locked.suspend();
  assert.deepEqual(locked.suspendedIds(), ['person-dialog', 'memory-card-dialog']);
  locked.restore();
  assert.equal(find('person-dialog').shown, 4, 'one reopen per remembered dialog');

  locked.suspend(); locked.clearForOwnerChange(); locked.clearForOwnerChange(); locked.restore();
  assert.equal(find('person-dialog').open, false, 'a dialog of the previous owner is never reopened for the next owner');
  assert.equal(locked.isSuspended('person-dialog'), false);
});

test('확인창: 묻는 동안 주인이 바뀌면 「확인」을 눌러도 false이고, 잠그면 「취소」로 닫힌다', async () => {
  let owner = 1; const presented = [], node = new FakeDialog('confirm-dialog');
  const confirmation = createConfirmation({ dialog: () => node, ownerToken: () => owner, present: value => presented.push(value) });

  const accepted = confirmation.ask({ title: '새 초안으로 바꾸기', message: '다듬던 문구를 새 초안으로 바꿀까요?', button: '바꾸기' });
  assert.equal(node.open, true); assert.equal(node.returnValue, 'cancel');
  assert.deepEqual(presented.at(-1), { title: '새 초안으로 바꾸기', message: '다듬던 문구를 새 초안으로 바꿀까요?', button: '바꾸기' });
  node.returnValue = 'confirm'; node.close();
  assert.equal(await accepted, true);

  const canceled = confirmation.ask({ title: 't', message: 'm', button: 'b' });
  node.close();
  assert.equal(await canceled, false);

  const stale = confirmation.ask({ title: 't', message: '이전 계정의 원고를 바꿀까요?', button: 'b' });
  owner++;
  node.returnValue = 'confirm'; node.close();
  assert.equal(await stale, false, 'an old-owner confirmation never applies to the new owner');

  const locked = confirmation.ask({ title: 't', message: 'm', button: 'b' });
  confirmation.suspend();
  assert.equal(node.open, false); assert.equal(node.returnValue, 'cancel');
  assert.equal(await locked, false);
  let events = 0; node.addEventListener('close', () => events++);
  confirmation.suspend(); await settle();
  assert.equal(events, 0, 'locking with no open confirmation does nothing');
});

test('계정 상태 읽기: 일시 장애와 같은 계정 재확인은 hold, 손님↔계정 전환만 손님 수첩을 보관·복원한다', () => {
  const signedIn = id => ({ configured: true, signedIn: true, status: 'signed-in', accountId: id });
  const viaAccount = id => ({ configured: true, signedIn: true, status: 'signed-in', account: { synk_user_id: id } });
  const retryable = { signedIn: false, status: 'error', error: { code: 'NETWORK', retryable: true } };
  const fatal = { signedIn: false, status: 'error', error: { code: 'AUTH_REQUIRED', retryable: false } };
  assert.deepEqual(readOwnerTransition('a', retryable), { kind: 'hold' }, 'a temporary network failure is hidden, not a logout');
  assert.deepEqual(readOwnerTransition('a', { signedIn: false, status: 'restoring' }), { kind: 'hold' });
  assert.deepEqual(readOwnerTransition('a', signedIn('a')), { kind: 'same', nextId: 'a' });
  assert.deepEqual(readOwnerTransition('a', viaAccount('a')), { kind: 'same', nextId: 'a' });
  assert.deepEqual(readOwnerTransition(null, signedIn('a')), { kind: 'change', nextId: 'a', parkGuest: true, restoreGuest: false });
  assert.deepEqual(readOwnerTransition('a', signedIn('b')), { kind: 'change', nextId: 'b', parkGuest: false, restoreGuest: false }, 'A to B keeps the parked guest notebook');
  assert.deepEqual(readOwnerTransition('a', { signedIn: false, status: 'signed-out' }), { kind: 'change', nextId: null, parkGuest: false, restoreGuest: true });
  assert.deepEqual(readOwnerTransition('a', fatal), { kind: 'change', nextId: null, parkGuest: false, restoreGuest: true }, 'a non-retryable failure ends the account session');
  assert.deepEqual(readOwnerTransition(null, retryable), { kind: 'same', nextId: null }, 'a guest has no account work to hold');
  assert.deepEqual(readOwnerTransition(null, { signedIn: false, status: 'restoring' }), { kind: 'same', nextId: null });
});

// 앱처럼 주인들을 한 세션에 등록한다. 수첩(state)과 손님 수첩 보관은 세션 밖(앱)에 둔다.
function careSession(t) {
  const { map, find } = dialogs(['person-dialog', 'memory-card-dialog', 'followup-calendar-dialog', 'contact-import-dialog', 'confirm-dialog']);
  let authEpoch = 0;
  const { recording, player, audio } = recordingFixture(t);
  const { urls } = countingUrls(t), card = createObjectUrlSlot({ urls });
  const drafts = new Map(), screen = { draftText: '', transcript: '' };
  const locked = createDialogSuspension({ ids: ['person-dialog', 'memory-card-dialog', 'followup-calendar-dialog', 'contact-import-dialog'], dialog: find });
  const confirmation = createConfirmation({ dialog: () => find('confirm-dialog'), ownerToken: () => authEpoch, present() {} });
  const session = createTransientSession([
    ['locked-dialogs', locked], ['confirmation', confirmation],
    ['memory-card', { clearForOwnerChange: () => { card.release(); find('memory-card-dialog').close(); }, pageHide: () => card.release() }],
    ['recording', recording],
    ['draft', { clearForOwnerChange: () => { drafts.clear(); screen.draftText = ''; } }],
  ]);
  return { session, recording, player, audio, card, drafts, screen, locked, confirmation, map, find, nextEpoch: () => ++authEpoch };
}

test('원고 확인창과 받아쓰기 도중 계정이 바뀌면 늦은 확인·늦은 받아쓰기·늦은 카드는 새 계정에 적용되지 않는다', async t => {
  const care = careSession(t);
  care.drafts.set('person-a', { text: '계정 A에서 다듬던 안부' }); care.screen.draftText = '계정 A에서 다듬던 안부';
  const recordingUrl = care.recording.take(care.audio('account-a.wav'));
  const response = deferred(), job = care.recording.startTranscription();
  const transcribing = (async () => { const text = await response.promise; if (job.isCurrent()) care.screen.transcript = text; job.finish(); })();
  const cardTicket = care.card.begin();
  const replacing = care.confirmation.ask({ title: '새 초안으로 바꾸기', message: '다듬던 문구를 새 초안으로 바꿀까요?', button: '바꾸기' });

  // handleAccountStatus: 세대를 올리고 replaceState(clearForOwnerChange) 뒤 계정 수첩을 불러오는 잠금을 그린다.
  care.nextEpoch(); care.session.clearForOwnerChange(); care.session.suspend();
  assert.equal(await replacing, false, 'the open confirmation is canceled for the new account');
  assert.equal(care.find('confirm-dialog').open, false);
  assert.equal(job.signal.aborted, true);
  assert.equal(await alive(recordingUrl), false, 'the recording object URL of account A is revoked');
  assert.equal(care.recording.file, null); assert.equal(care.drafts.size, 0); assert.equal(care.screen.draftText, '');
  assert.equal(care.card.publish(new Blob(['account A card']), { ticket: cardTicket }), null, 'a late card preview is discarded');

  care.screen.draftText = '계정 B의 새 안부';
  response.resolve('계정 A 녹음의 늦은 받아쓰기'); await transcribing;
  assert.equal(care.screen.transcript, '', 'the late transcript is not written into account B');
  assert.equal(care.recording.transcribing, false);
  assert.equal(care.screen.draftText, '계정 B의 새 안부');
});

test('로그아웃으로 손님 화면이 되면 열린 확인창이 남아도 늦은 「확인」은 적용되지 않는다', async t => {
  const care = careSession(t);
  const pending = care.confirmation.ask({ title: '로그아웃', message: '저장하지 않은 문구가 있어요.', button: '로그아웃' });
  // 계정에서 손님으로: 잠금이 없어(connected=false) 확인창은 열린 채로 남고, 세대만 바뀐다.
  care.nextEpoch(); care.session.clearForOwnerChange();
  assert.equal(care.find('confirm-dialog').open, true);
  care.find('confirm-dialog').returnValue = 'confirm'; care.find('confirm-dialog').close();
  assert.equal(await pending, false);
});

test('일시 장애 잠금과 같은 계정 복원은 임시 작업과 보관한 손님 수첩을 그대로 두고, 로그아웃은 손님 수첩을 되돌리며 임시 작업을 비운다', async t => {
  const care = careSession(t);
  // 앱의 손님 수첩 보관 규칙: readOwnerTransition이 parkGuest/restoreGuest를 알려 준다.
  let accountId = null, guestSnapshot = null, notebook = { people: ['손님 수첩의 사람'] };
  const apply = status => {
    const transition = readOwnerTransition(accountId, status);
    if (transition.kind === 'hold') { care.session.suspend(); return transition; }
    if (transition.kind === 'same') { care.session.restore(); return transition; }
    care.nextEpoch();
    if (transition.parkGuest) guestSnapshot = { state: structuredClone(notebook) };
    if (transition.nextId) { accountId = transition.nextId; notebook = { people: [] }; }
    else if (transition.restoreGuest) { accountId = null; const guest = guestSnapshot; guestSnapshot = null; notebook = guest?.state ?? { people: [] }; }
    care.session.clearForOwnerChange();
    return transition;
  };

  apply({ signedIn: true, status: 'signed-in', accountId: 'a' });
  assert.deepEqual(guestSnapshot, { state: { people: ['손님 수첩의 사람'] } });
  notebook = { people: ['계정 A의 사람'] };
  care.drafts.set('person-a', { text: '아직 보내지 않은 안부' });
  const url = care.recording.take(care.audio('kept-during-lock.wav'));
  care.find('person-dialog').showModal();

  assert.equal(apply({ signedIn: false, status: 'error', error: { code: 'NETWORK', retryable: true } }).kind, 'hold');
  assert.equal(care.find('person-dialog').open, false, 'the dialog is concealed while locked');
  assert.equal(care.player.pauses, 1);
  assert.equal(care.drafts.get('person-a').text, '아직 보내지 않은 안부');
  assert.equal(await alive(url), true, 'the recording survives a temporary failure');
  assert.equal(accountId, 'a'); assert.deepEqual(guestSnapshot, { state: { people: ['손님 수첩의 사람'] } });

  assert.equal(apply({ signedIn: true, status: 'signed-in', accountId: 'a' }).kind, 'same');
  assert.equal(care.find('person-dialog').open, true, 'the same verified account gets its dialog back');
  assert.equal(care.drafts.size, 1);

  apply({ signedIn: true, status: 'signed-in', accountId: 'b' });
  assert.deepEqual(guestSnapshot, { state: { people: ['손님 수첩의 사람'] } }, 'switching A to B never parks account A as the guest notebook');
  assert.equal(care.drafts.size, 0); assert.equal(await alive(url), false);

  care.drafts.set('person-b', { text: '계정 B 원고' });
  apply({ signedIn: false, status: 'signed-out' });
  assert.deepEqual(notebook, { people: ['손님 수첩의 사람'] }, 'signing out restores the parked guest notebook');
  assert.equal(guestSnapshot, null); assert.equal(accountId, null); assert.equal(care.drafts.size, 0);
});

test('페이지를 완전히 떠나면 카드와 녹음 URL을 놓고, BFCache로 숨으면 녹음 URL은 남긴다', async t => {
  const care = careSession(t);
  const recordingUrl = care.recording.take(care.audio('page.wav'));
  let ticket = care.card.begin(); const cardUrl = care.card.publish(new Blob(['card']), { ticket });
  care.session.pageHide({ persisted: true });
  assert.equal(await alive(recordingUrl), true); assert.equal(await alive(cardUrl), false, 'the card preview is always released on pagehide');
  ticket = care.card.begin(); const nextCard = care.card.publish(new Blob(['card again']), { ticket });
  care.session.pageHide({ persisted: false });
  assert.equal(await alive(recordingUrl), false); assert.equal(await alive(nextCard), false);
});
