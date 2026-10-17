// Application estimates, never a provider invoice or an employee activity log.
export const VOICE_LIMITS = Object.freeze({ maxConcurrentParticipants: 4, maxSessionSeconds: 7200, monthlyParticipantMinutes: 1000, monthlyDownstreamBytes: 1000000000 });
export const MEDIA_FRESH_MS = 15000;

export function voiceLimits(input = {}) {
  const bounds = { maxConcurrentParticipants: [1, 16], maxSessionSeconds: [60, 7200], monthlyParticipantMinutes: [1, 1000000], monthlyDownstreamBytes: [1, 1000000000000] };
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.hasOwn(bounds, key))) throw new Error('통화 사용 한도 설정을 확인해 주세요.');
  const result = { ...VOICE_LIMITS, ...input };
  for (const [key, [min, max]] of Object.entries(bounds)) if (!Number.isSafeInteger(result[key]) || result[key] < min || result[key] > max) throw new Error('통화 사용 한도 설정을 확인해 주세요.');
  return result;
}

export function createVoiceUsage({ db, now, limits, fail }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_usage_months (
      month TEXT PRIMARY KEY, reserved_ms INTEGER NOT NULL DEFAULT 0, observed_ms INTEGER NOT NULL DEFAULT 0,
      unverified_ms INTEGER NOT NULL DEFAULT 0, estimated_downstream_bytes INTEGER NOT NULL DEFAULT 0,
      reported_sent_bytes INTEGER NOT NULL DEFAULT 0, reported_received_bytes INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS voice_usage_samples (
      admission_id TEXT NOT NULL REFERENCES voice_admissions(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL, sequence INTEGER NOT NULL, sent INTEGER NOT NULL, received INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, PRIMARY KEY(admission_id,connection_id)
    );
  `);
  const monthAt = stamp => new Date(stamp).toISOString().slice(0, 7);
  function add(month, reserved, observed, estimated, sent = 0, received = 0) {
    db.prepare(`INSERT INTO voice_usage_months(month,reserved_ms,observed_ms,unverified_ms,estimated_downstream_bytes,reported_sent_bytes,reported_received_bytes) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(month) DO UPDATE SET reserved_ms=reserved_ms+excluded.reserved_ms, observed_ms=observed_ms+excluded.observed_ms,
      unverified_ms=unverified_ms+excluded.unverified_ms, estimated_downstream_bytes=estimated_downstream_bytes+excluded.estimated_downstream_bytes,
      reported_sent_bytes=reported_sent_bytes+excluded.reported_sent_bytes, reported_received_bytes=reported_received_bytes+excluded.reported_received_bytes`).run(month, reserved, observed, reserved - observed, estimated, sent, received);
  }
  function meter(row, end, peers = 0, screens = 0, screenAudio = 0) {
    let start = row.metered_until || row.joined_at || row.first_seen_at;
    if (end <= start) return;
    // 64 kbit/s per other reserved seat. This is an explicit planning assumption,
    // not a bandwidth ceiling; RTP overhead, codecs and missing reports differ.
    while (start < end) {
      const d = new Date(start), stop = Math.min(end, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const freshEnd = row.state === 'active' && row.media_state === 'connected' ? Math.min(stop, (row.observed_at || 0) + MEDIA_FRESH_MS) : start;
      const observed = Math.max(0, freshEnd - start);
      add(monthAt(start), stop - start, observed, Math.ceil((stop - start) * (Math.max(0, peers) * 8 + screens * 187.5 + screenAudio * 16)));
      start = stop;
    }
    if (row.id) db.prepare('UPDATE voice_admissions SET metered_until=? WHERE id=?').run(end, row.id);
    else db.prepare('UPDATE voice_orphans SET metered_until=? WHERE call_id=? AND identity=?').run(end, row.call_id, row.identity);
  }
  function meterAll() {
    const stamp = now();
    const rows = db.prepare("SELECT * FROM voice_admissions WHERE state<>'ended'").all();
    const shares = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='voice_shares'").get()
      ? db.prepare("SELECT s.*,a.call_id FROM voice_shares s JOIN voice_admissions a ON a.id=s.admission_id WHERE s.state<>'ended'").all() : [];
    for (const row of rows) {
      const incoming = shares.filter(share => share.call_id === row.call_id && share.admission_id !== row.id);
      meter(row, stamp, rows.filter(peer => peer.call_id === row.call_id && peer.id !== row.id).length, incoming.length, incoming.filter(share => share.with_audio).length);
    }
    for (const row of db.prepare('SELECT * FROM voice_orphans').all()) meter(row, stamp);
  }
  function snapshot() {
    const month = monthAt(now());
    const row = db.prepare('SELECT * FROM voice_usage_months WHERE month=?').get(month) || {};
    const participantMinutes = (row.reserved_ms || 0) / 60000;
    const estimated = row.estimated_downstream_bytes || 0, reported = row.reported_received_bytes || 0;
    const exhausted = participantMinutes >= limits.monthlyParticipantMinutes || Math.max(estimated, reported) >= limits.monthlyDownstreamBytes;
    return { month, timezone: 'UTC', limits, participantMinutes, observedParticipantMinutes: (row.observed_ms || 0) / 60000,
      unverifiedParticipantMinutes: (row.unverified_ms || 0) / 60000, estimatedDownstreamBytes: estimated,
      clientReportedSentBytes: row.reported_sent_bytes || 0, clientReportedReceivedBytes: reported,
      exhausted, source: 'application-estimate', providerBillingVerified: false, assumedAudioBitrateBps: 64000, assumedScreenBitrateBps: 1500000, assumedScreenAudioBitrateBps: 128000,
      transferReportsComplete: false, observedAt: new Date(now()).toISOString() };
  }
  function report(admissionId, input, validateRequestId) {
    if (!input || Object.keys(input).sort().join(',') !== 'bytesReceived,bytesSent,connectionId,sequence') fail('VOICE_USAGE_INVALID', 400, '통화 사용량 보고를 확인해 주세요.');
    const connectionId = validateRequestId(input.connectionId, '통화 연결');
    for (const key of ['sequence', 'bytesSent', 'bytesReceived']) if (!Number.isSafeInteger(input[key]) || input[key] < (key === 'sequence' ? 1 : 0) || input[key] > 1000000000000) fail('VOICE_USAGE_INVALID', 400, '통화 사용량 보고를 확인해 주세요.');
    const prior = db.prepare('SELECT * FROM voice_usage_samples WHERE admission_id=? AND connection_id=?').get(admissionId, connectionId);
    if (prior && input.sequence <= prior.sequence) {
      if (input.sequence === prior.sequence && (input.bytesSent !== prior.sent || input.bytesReceived !== prior.received)) fail('VOICE_USAGE_CONFLICT', 409, '같은 사용량 보고의 내용이 다릅니다.');
      return { accepted: true, replayed: true };
    }
    if (!prior && db.prepare('SELECT COUNT(*) n FROM voice_usage_samples WHERE admission_id=?').get(admissionId).n >= 32) fail('VOICE_USAGE_CONNECTION_LIMIT', 409, '연결 사용량 보고가 너무 많습니다. 새로 참가해 주세요.');
    const sent = input.bytesSent - (prior?.sent || 0), received = input.bytesReceived - (prior?.received || 0);
    // Bound erroneous/malicious counters. Reports can increase an app guard but
    // cannot establish media presence, release quota, or change a provider bill.
    const bound = Math.min(100000000000, Math.max(1000, now() - (prior?.updated_at || db.prepare('SELECT joined_at FROM voice_admissions WHERE id=?').get(admissionId).joined_at)) * 10000);
    if (sent < 0 || received < 0 || sent > bound || received > bound) fail('VOICE_USAGE_COUNTER_RESET', 409, '새 연결의 식별자로 사용량 보고를 다시 시작해 주세요.');
    add(monthAt(now()), 0, 0, 0, sent, received);
    db.prepare(`INSERT INTO voice_usage_samples(admission_id,connection_id,sequence,sent,received,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(admission_id,connection_id) DO UPDATE SET sequence=excluded.sequence,sent=excluded.sent,received=excluded.received,updated_at=excluded.updated_at`).run(admissionId, connectionId, input.sequence, input.bytesSent, input.bytesReceived, now());
    return { accepted: true, replayed: false };
  }
  return { meterAll, snapshot, report };
}
