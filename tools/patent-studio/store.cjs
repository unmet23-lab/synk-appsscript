'use strict';

const {
  DatabaseSync
} = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./core.cjs');
const projection = require('./projection.cjs');
const coreSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'core.cjs'))).digest('hex');
const engineKey = projection.digest(['core.cjs', 'projection.cjs'].map(name => ({ name,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, name))).digest('hex') })));
function calculate(state, previousAnalysis) {
  const start = performance.now();
  const result = core.evaluate(state, { previousProjection: previousAnalysis?.projectionCache, engineKey });
  result.execution = {
    durationMs: Number((performance.now() - start).toFixed(3)),
    engineSha256: coreSha256,
    engineBundleSha256: engineKey,
    hypothesisCount: [state.original, ...state.responses].reduce((n, u) => n + u.alternatives.length, 0),
    cellCount: result.cells.length,
    comparisonCount: result.comparisons?.length ?? 0,
    scope: '현재 기계에서 이 한 번의 계산을 잰 값'
  };
  return result;
}
const canonical = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
const digest = v => crypto.createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : canonical(v)).digest('hex');
function problem(code, message, status = 400) {
  return Object.assign(new Error(message), {
    code,
    status
  });
}
class StudioStore {
  constructor(directory) {
    fs.mkdirSync(directory, {
      recursive: true
    });
    this.directory = directory;
    this.db = new DatabaseSync(path.join(directory, 'studio.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL, analysis TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(session_id TEXT NOT NULL, event_id TEXT NOT NULL, revision INTEGER NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(session_id,event_id),FOREIGN KEY(session_id) REFERENCES sessions(id));
 CREATE TABLE IF NOT EXISTS audio(sha256 TEXT PRIMARY KEY,mime_type TEXT NOT NULL,bytes BLOB NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS session_audio(session_id TEXT NOT NULL,event_id TEXT NOT NULL,sha256 TEXT NOT NULL,role TEXT NOT NULL,response_id TEXT,transcription TEXT,created_at TEXT NOT NULL,PRIMARY KEY(session_id,event_id),FOREIGN KEY(session_id) REFERENCES sessions(id),FOREIGN KEY(sha256) REFERENCES audio(sha256));
 CREATE TABLE IF NOT EXISTS transcription_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,audio_event_id TEXT NOT NULL,payload TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(session_id) REFERENCES sessions(id));
 CREATE TABLE IF NOT EXISTS effect_ledger(session_id TEXT NOT NULL,revision INTEGER NOT NULL,event_id TEXT,payload TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(session_id,revision),FOREIGN KEY(session_id) REFERENCES sessions(id));
 `);
    // Old sessions start a declared baseline at their current revision. No
    // historical effects are invented for versions that were never recorded.
    for (const row of this.db.prepare('SELECT s.* FROM sessions s WHERE NOT EXISTS (SELECT 1 FROM effect_ledger e WHERE e.session_id=s.id)').all()) {
      this.transaction(() => {
        const state = JSON.parse(row.state), analysis = calculate(state);
        this.insertLedger(row.id, projection.buildLedgerEntry({ afterCells: analysis.cells, baselineState: state,
          fromRevision: null, toRevision: row.revision, engineKey }));
        this.db.prepare('UPDATE sessions SET analysis=? WHERE id=?').run(JSON.stringify(analysis), row.id);
      });
    }
  }
  insertLedger(id, entry) {
    this.db.prepare('INSERT INTO effect_ledger VALUES(?,?,?,?,?)').run(id, entry.toRevision,
      entry.cause.eventId, JSON.stringify(entry), entry.sha256);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  create(input = {}) {
    if (!['example', 'recording'].includes(input.mode)) throw problem('MODE', '예제 또는 직접 녹음을 선택해 주세요.');
    if (input.sourceKind === 'synthetic-speech' && !['original.wav', 'assisted.wav', 'unexpected.wav'].includes(input.sampleName)) throw problem('SAMPLE', '알 수 없는 합성 음성입니다.');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const state = core.createSession({
      ...input,
      id,
      createdAt: now
    });
    state.sourceKind = input.mode === 'example' ? 'authored-example' : input.sourceKind === 'synthetic-speech' ? 'synthetic-speech' : 'user-audio';
    if (input.sourceKind === 'synthetic-speech') state.sampleName = input.sampleName;
    const analysis = calculate(state);
    this.transaction(() => {
      this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(id, 0, JSON.stringify(state), JSON.stringify(analysis), now, now);
      this.insertLedger(id, projection.buildLedgerEntry({ afterCells: analysis.cells, baselineState: state,
        fromRevision: null, toRevision: 0, engineKey }));
    });
    return this.get(id);
  }
  row(id) {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id=?').get(id);
    if (!row) throw problem('NOT_FOUND', '이 기록을 찾을 수 없습니다.', 404);
    return row;
  }
  get(id) {
    const row = this.row(id),
      state = JSON.parse(row.state);
    const events = this.db.prepare('SELECT payload,revision,created_at FROM events WHERE session_id=? ORDER BY revision').all(id).map(x => ({
      ...JSON.parse(x.payload),
      revision: x.revision,
      recordedAt: x.created_at
    }));
    const audios = this.db.prepare('SELECT sa.*,a.mime_type,length(a.bytes) AS size FROM session_audio sa JOIN audio a ON a.sha256=sa.sha256 WHERE sa.session_id=? ORDER BY sa.created_at,sa.rowid').all(id).map(a => ({
      audioEventId: a.event_id,
      audioRef: 'sha256:' + a.sha256,
      sha256: a.sha256,
      mimeType: a.mime_type,
      bytes: a.size,
      role: a.role,
      responseId: a.response_id,
      url: '/api/audio/' + a.sha256,
      createdAt: a.created_at,
      transcription: a.transcription ? JSON.parse(a.transcription) : null
    }));
    const ledger = this.db.prepare('SELECT payload FROM effect_ledger WHERE session_id=? ORDER BY revision').all(id).map(x => JSON.parse(x.payload));
    return {
      ...state,
      id,
      revision: row.revision,
      analysis: JSON.parse(row.analysis),
      events,
      audios,
      effectLedger: { schemaVersion: 1, entries: ledger, headSha256: ledger.at(-1)?.sha256 || null,
        startsAtRevision: ledger[0]?.toRevision ?? null, throughRevision: ledger.at(-1)?.toRevision ?? null,
        legacyBaseline: (ledger[0]?.toRevision ?? 0) > 0 },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  list() {
    return this.db.prepare('SELECT id,revision,state,created_at,updated_at FROM sessions ORDER BY updated_at DESC LIMIT 40').all().map(r => {
      const s = JSON.parse(r.state);
      return {
        id: r.id,
        revision: r.revision,
        mode: s.mode,
        exampleId: s.exampleId,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });
  }
  apply(id, expectedRevision, event, inside) {
    if (!event || typeof event.id !== 'string' || event.id.length > 150 || !event.id) throw problem('EVENT_ID', '사건 식별자가 필요합니다.');
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw problem('REVISION', '기록 판본을 확인해 주세요.');
    const fingerprint = digest(event);
    this.transaction(() => {
      const row = this.row(id);
      const prior = this.db.prepare('SELECT fingerprint FROM events WHERE session_id=? AND event_id=?').get(id, event.id);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw problem('EVENT_CONFLICT', '같은 사건 번호에 다른 내용이 도착했습니다.', 409);
        return;
      }
      if (row.revision !== expectedRevision) throw problem('STALE_REVISION', '다른 창에서 기록이 바뀌었습니다. 최신 기록을 확인해 주세요.', 409);
      const at = event.at ?? new Date().toISOString();
      const stamped = {
        ...event,
        at
      };
      const previousAnalysis = JSON.parse(row.analysis);
      const next = core.applyEvent(JSON.parse(row.state), stamped);
      const analysis = calculate(next, previousAnalysis);
      const revision = row.revision + 1;
      const now = new Date().toISOString();
      if (inside) inside(this.db, stamped);
      const head = this.db.prepare('SELECT fingerprint FROM effect_ledger WHERE session_id=? ORDER BY revision DESC LIMIT 1').get(id);
      const transition = projection.buildLedgerEntry({ beforeCells: previousAnalysis.cells, afterCells: analysis.cells,
        event: stamped, fromRevision: row.revision, toRevision: revision, previousSha256: head.fingerprint, engineKey });
      this.insertLedger(id, transition);
      this.db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(id, event.id, revision, fingerprint, JSON.stringify(stamped), now);
      this.db.prepare('UPDATE sessions SET revision=?,state=?,analysis=?,updated_at=? WHERE id=?').run(revision, JSON.stringify(next), JSON.stringify(analysis), now, id);
    });
    return this.get(id);
  }
  attach(id, expectedRevision, {
    eventId,
    role,
    bytes,
    mimeType,
    acquisition = 'file',
    captureStartedAt,
    captureEndedAt
  }) {
    if (!['original', 'response'].includes(role)) throw problem('AUDIO_ROLE', '원음 또는 새 응답을 선택해 주세요.');
    if (!['file', 'microphone'].includes(acquisition)) throw problem('CAPTURE_METHOD', '녹음 또는 파일의 출처를 확인해 주세요.');
    const sha = digest(bytes),
      audioRef = 'sha256:' + sha;
    const responseId = role === 'response' ? eventId : undefined;
    const capture = acquisition === 'microphone' ? {
      captureStartedAt,
      captureEndedAt
    } : {};
    return this.apply(id, expectedRevision, {
      id: eventId,
      type: 'audio-attached',
      role,
      audioRef,
      mimeType,
      bytes: bytes.length,
      acquisition,
      ...capture,
      ...(responseId ? {
        responseId
      } : {})
    }, db => {
      if (role === 'original' && db.prepare("SELECT 1 FROM session_audio WHERE session_id=? AND role='original'").get(id)) throw problem('IMMUTABLE_AUDIO', '처음 녹음은 보존됩니다. 새 시도는 새 기록에서 시작해 주세요.', 409);
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO audio VALUES(?,?,?,?)').run(sha, mimeType, bytes, now);
      db.prepare('INSERT INTO session_audio VALUES(?,?,?,?,?,?,?)').run(id, eventId, sha, role, responseId ?? null, JSON.stringify({
        status: 'pending'
      }), now);
    });
  }
  audio(ref) {
    const sha = String(ref).replace(/^sha256:/, '');
    if (!/^[a-f0-9]{64}$/.test(sha)) throw problem('AUDIO_REF', '올바른 원음 참조가 아닙니다.');
    const a = this.db.prepare('SELECT * FROM audio WHERE sha256=?').get(sha);
    if (!a) throw problem('NOT_FOUND', '원음을 찾을 수 없습니다.', 404);
    return {
      bytes: Buffer.from(a.bytes),
      mimeType: a.mime_type,
      sha256: sha
    };
  }
  audioForSession(id, ref, audioEventId) {
    const sha = String(ref).replace(/^sha256:/, '');
    const rows = audioEventId ? this.db.prepare('SELECT * FROM session_audio WHERE session_id=? AND sha256=? AND event_id=?').all(id, sha, audioEventId) : this.db.prepare('SELECT * FROM session_audio WHERE session_id=? AND sha256=? ORDER BY rowid').all(id, sha);
    if (!rows.length) throw problem('NOT_FOUND', '이 기록에 연결된 원음이 아닙니다.', 404);
    if (rows.length > 1) throw problem('AMBIGUOUS_AUDIO', '같은 파일의 여러 사용 기록이 있습니다. 확인할 녹음 사건을 선택해 주세요.', 409);
    return rows[0];
  }
  recordTranscription(id, eventId, data, db = this.db) {
    const payload = JSON.stringify(data);
    db.prepare('UPDATE session_audio SET transcription=? WHERE session_id=? AND event_id=?').run(payload, id, eventId);
    db.prepare('INSERT INTO transcription_attempts(session_id,audio_event_id,payload,fingerprint,created_at) VALUES(?,?,?,?,?)').run(id, eventId, payload, digest(data), new Date().toISOString());
  }
  setTranscription(id, eventId, data) {
    this.transaction(() => this.recordTranscription(id, eventId, data));
    return this.get(id);
  }
  export(id) {
    const session = this.get(id);
    const attempts = this.db.prepare('SELECT id,audio_event_id,payload,fingerprint,created_at FROM transcription_attempts WHERE session_id=? ORDER BY id').all(id).map(r => ({
      id: r.id,
      audioEventId: r.audio_event_id,
      ...JSON.parse(r.payload),
      fingerprint: r.fingerprint,
      createdAt: r.created_at
    }));
    return {
      schemaVersion: 'synk.evidence-studio.v1',
      exportedAt: new Date().toISOString(),
      engineVersion: core.VERSION ?? '1.0.0',
      session,
      transcriptionAttempts: attempts,
      replay: {
        events: this.db.prepare('SELECT revision,payload FROM events WHERE session_id=? ORDER BY revision').all(id).map(r => ({ revision: r.revision, event: JSON.parse(r.payload) })),
        finalState: JSON.parse(this.row(id).state),
        engineBundleSha256: engineKey
      },
      files: session.audios.map(a => ({
        ...a,
        encoding: 'base64',
        data: this.audio(a.audioRef).bytes.toString('base64')
      })),
      integrity: {
        sessionSha256: digest(session),
        attemptsSha256: digest(attempts),
        effectLedgerSha256: projection.digest(session.effectLedger),
        algorithm: 'SHA-256'
      },
      scope: 'Local executable evidence record. Example assumptions and human-confirmed scope are explicit in session.'
    };
  }
  verify(id) {
    const session = this.get(id), state = JSON.parse(this.row(id).state);
    const events = this.db.prepare('SELECT revision,payload FROM events WHERE session_id=? ORDER BY revision').all(id).map(r => ({ revision: r.revision, event: JSON.parse(r.payload) }));
    return projection.verifyLedger({ entries: session.effectLedger.entries, events,
      finalState: state, finalCells: session.analysis.cells, engineKey }, core);
  }
  close() {
    this.db.close();
  }
}
module.exports = {
  StudioStore,
  problem,
  digest,
  canonical
};
