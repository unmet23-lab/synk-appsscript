import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';

export const E2EE_PROTOCOL = 'synk-livekit-e2ee-v1';
const ROUND_MS = 30000;

// The application server is the trusted key authority. LiveKit never receives
// keys. This deliberately does not claim protection from a compromised SYNK
// server or authorized endpoint. No key material is persisted in SQLite.
export function createVoiceEncryption({ db, required, now, fail, provider, publish, invalidate, validate, cleanupPending, fenceShares }) {
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const rounds = new Map();
  // A pause fences the current credential, not just one membership round. The
  // SDK may already have discarded its Room when that round is superseded.
  const pausedCredentials = new Map();
  const active = callId => all("SELECT * FROM voice_admissions WHERE call_id=? AND state='active' ORDER BY id", callId);
  const signature = rows => rows.map(row => row.id).join(',');
  const wipe = round => { round?.key?.fill(0); if (round) { round.key = null; round.challenges.clear(); round.acks.clear(); } };
  function clear(callId) { wipe(rounds.get(callId)); rounds.delete(callId); }
  function fence(callId) {
    if (!required) return;
    const round = rounds.get(callId);
    if (round) { wipe(round); round.status = 'pausing'; round.signature = ''; }
  }
  function summary(callId, admissionId) {
    if (!required) return { required: false, status: 'disabled', mode: 'none' };
    const round = rounds.get(callId);
    return { required: true, protocol: E2EE_PROTOCOL, mode: 'application-managed-shared-key', applicationServerTrusted: true,
      status: round?.status || 'pausing', epoch: round?.epoch || null, keyIndex: 0, ready: Boolean(round?.status === 'ready' && (!admissionId || round.acks.has(admissionId))),
      pendingParticipants: round ? active(callId).filter(row => !round.acks.has(row.id)).length : 0,
      mediaVerified: false, metadataEncrypted: false, sdkRoomResetRequired: true };
  }
  function ready(row) { return !required || Boolean(summary(row.call_id, row.id).ready && rounds.get(row.call_id)?.signature === signature(active(row.call_id))); }
  function assertClient(input) {
    if (!required) return;
    if (!input || Object.keys(input).sort().join(',') !== 'protocol,supported' || input.protocol !== E2EE_PROTOCOL || input.supported !== true) fail('VOICE_E2EE_REQUIRED', 426, '암호화 통화를 지원하는 최신 화면에서 다시 참가해 주세요.');
  }
  async function reconcile() {
    if (!required) return;
    const activeIds = new Set(all("SELECT id FROM voice_admissions WHERE state='active'").map(row => row.id));
    for (const id of pausedCredentials.keys()) if (!activeIds.has(id)) pausedCredentials.delete(id);
    const calls = all('SELECT * FROM voice_calls WHERE ended_at IS NULL');
    const liveIds = new Set(calls.map(call => call.id));
    for (const callId of rounds.keys()) if (!liveIds.has(callId)) clear(callId);
    for (const call of calls) {
      let rows = active(call.id);
      if (!rows.length) { clear(call.id); continue; }
      let round = rounds.get(call.id), sig = signature(rows);
      if (!round || round.signature !== sig) {
        wipe(round);
        round = { signature: sig, status: 'pausing', epoch: randomUUID(), key: null, deadline: now() + ROUND_MS, paused: new Set(rows.filter(row => pausedCredentials.has(row.id)).map(row => row.id)), challenges: new Map(), acks: new Set() };
        rounds.set(call.id, round); fenceShares(call.id);
        db.prepare("UPDATE voice_admissions SET media_state='securing',deadline_at=? WHERE call_id=? AND state='active'").run(round.deadline, call.id);
        publish('voice', call.channel_id);
      }
      if (now() >= round.deadline && round.status !== 'ready') {
        for (const row of rows) invalidate(row, 'encryption_timeout');
        clear(call.id); continue;
      }
      if (round.status !== 'pausing') continue;
      // UpdateParticipant on Cloud revokes old tokens as well as changing live
      // permissions. Never distribute a new epoch while old media is flowing.
      for (const row of rows.filter(row => row.token_issued && !round.paused.has(row.id))) {
        try {
          const paused = await provider.updatePermissions(call.room_name, row.id, { paused: true });
          const notBefore = paused?.tokenNotBeforeMs ?? 0;
          if (!Number.isSafeInteger(notBefore) || notBefore < 0) throw new Error('Invalid credential fence');
          pausedCredentials.set(row.id, notBefore); round.paused.add(row.id);
        }
        catch { invalidate(row, 'encryption_pause_failed'); }
        validate();
      }
      rows = active(call.id);
      if (rounds.get(call.id) !== round || signature(rows) !== round.signature || cleanupPending()) continue;
      if (round.paused.size) {
        let remote;
        try { remote = await provider.listParticipants(call.room_name); } catch { continue; }
        validate(); rows = active(call.id);
        if (rounds.get(call.id) !== round || signature(rows) !== round.signature || cleanupPending()) continue;
        if (remote.some(participant => participant.state !== 'DISCONNECTED' && (participant.tracks.length || !rows.some(row => row.id === participant.identity)))) continue;
      }
      round.key = randomBytes(32); round.status = 'awaiting_acks';
      publish('voice', call.channel_id);
    }
  }
  return {
    required, assertClient, summary, ready, fence, reconcile,
    tokenReady(row) { return !required || now() >= (pausedCredentials.get(row.id) || 0); },
    tokenIssued(row) { pausedCredentials.delete(row.id); },
    keyFor(row) {
      if (!required) fail('VOICE_E2EE_DISABLED', 409, '이 통화는 암호화 키를 사용하지 않습니다.');
      const round = rounds.get(row.call_id);
      if (!round?.key || !['awaiting_acks', 'ready'].includes(round.status) || cleanupPending() || signature(active(row.call_id)) !== round.signature) fail('VOICE_E2EE_PENDING', 409, '통화의 암호화 키를 교체하고 있습니다. 잠시 후 다시 확인해 주세요.');
      if (!round.challenges.has(row.id)) round.challenges.set(row.id, randomBytes(32).toString('base64url'));
      return { ...summary(row.call_id, row.id), callId: row.call_id, admissionId: row.id, key: round.key.toString('base64url'), challenge: round.challenges.get(row.id),
        proofContext: `${E2EE_PROTOCOL}|${row.call_id}|${round.epoch}|${row.id}|${round.challenges.get(row.id)}` };
    },
    acknowledge(row, input) {
      const round = rounds.get(row.call_id);
      if (!required || !round?.key || !['awaiting_acks', 'ready'].includes(round.status) || cleanupPending() || signature(active(row.call_id)) !== round.signature) fail('VOICE_E2EE_PENDING', 409, '통화의 암호화 준비 상태를 다시 확인해 주세요.');
      if (!input || Object.keys(input).sort().join(',') !== 'epoch,proof,sdkEnabled,workerReset' || input.epoch !== round.epoch || input.sdkEnabled !== true || input.workerReset !== true || typeof input.proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.proof) || !round.challenges.has(row.id)) fail('VOICE_E2EE_ACK_INVALID', 409, '현재 암호화 키로 SDK를 새로 준비해 주세요.');
      const context = `${E2EE_PROTOCOL}|${row.call_id}|${round.epoch}|${row.id}|${round.challenges.get(row.id)}`;
      // The SDK receives the base64url string as its shared-key passphrase.
      const expected = createHmac('sha256', round.key.toString('base64url')).update(context).digest();
      const proof = Buffer.from(input.proof, 'base64url');
      if (proof.length !== expected.length || !timingSafeEqual(proof, expected)) fail('VOICE_E2EE_ACK_INVALID', 409, '암호화 키 확인에 실패했습니다. 현재 키를 다시 준비해 주세요.');
      round.acks.add(row.id);
      if (active(row.call_id).every(member => round.acks.has(member.id)) && round.status !== 'ready') {
        round.status = 'ready';
        db.prepare("UPDATE voice_admissions SET deadline_at=?,media_state=CASE WHEN connected_at IS NULL THEN 'connecting' ELSE 'reconnecting' END WHERE call_id=? AND state='active'").run(now() + 30000, row.call_id);
      }
      return summary(row.call_id, row.id);
    },
    invalidTracks(row, tracks) { return required && tracks.length > 0 && (tracks.some(track => track.encryption !== 'GCM') || !ready(row) && rounds.get(row.call_id)?.status !== 'pausing'); },
    close() { for (const id of rounds.keys()) clear(id); pausedCredentials.clear(); },
  };
}
