import { randomUUID } from 'node:crypto';

const iso = value => value == null ? null : new Date(value).toISOString();
export function createVoiceSharing({ db, now, fail, provider, validateRequestId, permissionFor, encryptionReady, invalidate, publish, meter }) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  db.exec(`CREATE TABLE IF NOT EXISTS voice_shares (
    id TEXT PRIMARY KEY,admission_id TEXT NOT NULL REFERENCES voice_admissions(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,with_audio INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('starting','sharing','stopping','ended')),
    created_at INTEGER NOT NULL,deadline_at INTEGER NOT NULL,observed_at INTEGER,ended_at INTEGER,
    UNIQUE(admission_id,request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS voice_share_owner ON voice_shares(admission_id) WHERE state<>'ended';`);
  run("UPDATE voice_shares SET state='stopping' WHERE state<>'ended'");
  const current = admissionId => one("SELECT * FROM voice_shares WHERE admission_id=? AND state<>'ended'", admissionId);
  const callFor = admission => one('SELECT * FROM voice_calls WHERE id=?', admission.call_id);
  function shape(row) { return row ? { id: row.id, admissionId: row.admission_id, state: row.state, withAudio: Boolean(row.with_audio), createdAt: iso(row.created_at), observedAt: iso(row.observed_at), expiresAt: row.state === 'starting' ? iso(row.deadline_at) : null } : null; }
  function changed(admission) { const call = callFor(admission); if (call) publish('voice', call.channel_id); }
  function stop(admission) {
    const row = current(admission.id);
    if (row && row.state !== 'stopping') { meter(); run("UPDATE voice_shares SET state='stopping' WHERE id=?", row.id); changed(admission); }
    return row;
  }
  function permissions(admission) {
    if (!encryptionReady(admission)) return { paused: true, canSpeak: false, canShare: false, shareAudio: false };
    const share = current(admission.id), permission = permissionFor(admission);
    const allowed = Boolean(share && ['starting', 'sharing'].includes(share.state) && permission.canShare);
    return { canSpeak: Boolean(admission.can_speak), canShare: allowed, shareAudio: Boolean(allowed && share.with_audio && permission.canShareAudio) };
  }
  function complete(row) { meter(); run("UPDATE voice_shares SET state='ended',ended_at=? WHERE id=?", now(), row.id); }
  function startRequest(input) {
    if (!input || Object.keys(input).sort().join(',') !== 'requestId,withAudio' || typeof input.withAudio !== 'boolean') fail('VOICE_SHARE_INVALID', 400, '화면 공유 요청과 화면 소리 선택을 확인해 주세요.');
    return validateRequestId(input.requestId, '화면 공유');
  }
  async function reconcile() {
    for (const row of all("SELECT s.*,a.call_id,a.state admission_state FROM voice_shares s JOIN voice_admissions a ON a.id=s.admission_id WHERE s.state<>'ended'")) {
      const admission = one('SELECT * FROM voice_admissions WHERE id=?', row.admission_id);
      if (row.admission_state === 'ended') { complete(row); changed(admission); continue; }
      if (row.admission_state !== 'active') { stop(admission); continue; }
      let permission;
      try { permission = permissionFor(admission); } catch { invalidate(admission, 'permission_revoked'); stop(admission); continue; }
      if (!permission.canShare || row.with_audio && !permission.canShareAudio || row.state === 'starting' && now() >= row.deadline_at) stop(admission);
      const latest = current(admission.id);
      if (latest?.state !== 'stopping') continue;
      const call = callFor(admission);
      try {
        await provider.updatePermissions(call.room_name, admission.id, permissions(admission));
        // The old broader JWT is revoked by Cloud UpdateParticipant. Still wait
        // for current media disappearance before releasing the single slot.
        const remote = await provider.listParticipants(call.room_name);
        permissionFor(admission);
        const participant = remote.find(member => member.identity === admission.id && member.state !== 'DISCONNECTED');
        if (participant?.tracks.some(track => ['SCREEN_SHARE', 'SCREEN_SHARE_AUDIO'].includes(track.source))) { invalidate(admission, 'share_stop_unconfirmed'); continue; }
        complete(latest); changed(admission);
      } catch { invalidate(admission, 'share_cleanup_failed'); }
    }
  }
  return {
    current: admissionId => shape(current(admissionId)), permissions, stop, reconcile,
    cancelStart(admission, input) {
      const requestId = startRequest(input);
      const prior = one('SELECT * FROM voice_shares WHERE admission_id=? AND request_id=?', admission.id, requestId);
      if (prior) { if (prior.state !== 'ended') stop(admission); return; }
      // Stop can precede reservation creation. Keep a terminal receipt so a
      // delayed duplicate POST cannot revive the cancelled capture request.
      const stamp = now();
      run("INSERT INTO voice_shares(id,admission_id,request_id,with_audio,state,created_at,deadline_at,ended_at) VALUES(?,?,?,?,'ended',?,?,?)", randomUUID(), admission.id, requestId, +input.withAudio, stamp, stamp, stamp);
    },
    fence(callId) {
      meter();
      run("UPDATE voice_shares SET state='stopping' WHERE state<>'ended' AND admission_id IN (SELECT id FROM voice_admissions WHERE call_id=?)", callId);
    },
    async start(admission, input) {
      const requestId = startRequest(input), permission = permissionFor(admission);
      if (!permission.canShare || input.withAudio && !permission.canShareAudio) fail('VOICE_SHARE_FORBIDDEN', 403, '이 통화에서 화면이나 화면 소리를 공유할 권한이 없습니다.');
      if (!encryptionReady(admission)) fail('VOICE_E2EE_PENDING', 409, '암호화 통화 준비를 먼저 완료해 주세요.');
      let row = one('SELECT * FROM voice_shares WHERE admission_id=? AND request_id=?', admission.id, requestId);
      if (row && (row.state === 'ended' || row.state === 'stopping' || Boolean(row.with_audio) !== input.withAudio)) fail('VOICE_SHARE_REQUEST_ENDED', 409, '이미 종료되었거나 다른 화면 공유 요청입니다.');
      if (row) return { share: shape(row) };
      if (one("SELECT 1 FROM voice_shares WHERE state<>'ended'")) fail('VOICE_SHARE_CAPACITY', 409, '현재 다른 화면 공유가 진행 중이거나 정리 중입니다.');
      if (admission.media_state !== 'connected') fail('VOICE_SHARE_NOT_CONNECTED', 409, '음성 통화가 연결된 뒤 화면을 공유해 주세요.');
      meter(); const id = randomUUID();
      run("INSERT INTO voice_shares(id,admission_id,request_id,with_audio,state,created_at,deadline_at) VALUES(?,?,?,?,'starting',?,?)", id, admission.id, requestId, +input.withAudio, now(), now() + 45000);
      row = current(admission.id);
      try {
        await provider.updatePermissions(callFor(admission).room_name, admission.id, permissions(admission));
        const latest = permissionFor(admission);
        if (!latest.canShare || input.withAudio && !latest.canShareAudio || !encryptionReady(admission) || current(admission.id)?.state === 'stopping') fail('VOICE_SHARE_CANCELLED', 409, '화면 공유 요청이 취소되었거나 권한이 변경되었습니다.');
        changed(admission); return { share: shape(row) };
      } catch (error) { stop(admission); await reconcile(); throw error; }
    },
    observe(admission, tracks) {
      const row = current(admission.id), video = tracks.find(track => track.source === 'SCREEN_SHARE');
      if (!row || row.state === 'stopping') return;
      if (video) { meter(); run("UPDATE voice_shares SET state='sharing',observed_at=? WHERE id=?", now(), row.id); }
      else if (row.state === 'sharing') stop(admission);
    },
    invalidTracks(admission, tracks, grants) {
      const counts = new Map();
      for (const track of tracks) {
        const count = (counts.get(track.source) || 0) + 1; counts.set(track.source, count);
        if (count > 1 || !(track.source === 'MICROPHONE' && track.type === 'AUDIO' && admission.can_speak ||
          track.source === 'SCREEN_SHARE' && track.type === 'VIDEO' && grants.canShare ||
          track.source === 'SCREEN_SHARE_AUDIO' && track.type === 'AUDIO' && grants.shareAudio)) return true;
      }
      return false;
    },
  };
}
