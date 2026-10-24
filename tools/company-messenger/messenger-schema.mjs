// Core message, collaboration and productivity schema initialization lives here.
// Voice, integration and push services retain their own schema initialization.
// Call these functions before constructing the corresponding services.
// Existing table names, defaults, indexes and backfills are deliberately unchanged.
export function initializeMessengerBaseSchema(db, { teamDescription, legacyTeamDescription }) {
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','member')), password TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, revoked_at TEXT);
    CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL CHECK(kind IN ('channel','self','dm')), pair_key TEXT UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships (channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_read INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(channel_id,user_id));
    CREATE TABLE IF NOT EXISTS channel_departures (channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, left_at TEXT NOT NULL, rejoined_at TEXT, revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(channel_id,user_id));
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL, edited_at TEXT);
    CREATE INDEX IF NOT EXISTS messages_channel ON messages(channel_id,id);
    CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, uploader_id TEXT NOT NULL REFERENCES users(id), message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE, name TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT NOT NULL, disk_name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS files_message ON files(message_id);
    CREATE TABLE IF NOT EXISTS reactions (message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji TEXT NOT NULL, PRIMARY KEY(message_id,user_id,emoji));
    CREATE TABLE IF NOT EXISTS message_pins (message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS drive_delete_outbox (file_id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, remote_id TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT, last_error TEXT);
    CREATE TABLE IF NOT EXISTS message_send_requests (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL, state TEXT NOT NULL DEFAULT 'sent' CHECK(state IN ('sent','cancelled')), created_at TEXT NOT NULL, PRIMARY KEY(user_id,channel_id,request_id));
    CREATE TABLE IF NOT EXISTS file_upload_requests (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','failed','complete','cancelled')), file_id TEXT REFERENCES files(id) ON DELETE SET NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,channel_id,request_id));
    CREATE TABLE IF NOT EXISTS file_deletion_receipts (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, file_id TEXT NOT NULL, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, deleted_at TEXT NOT NULL, PRIMARY KEY(user_id,file_id));
  `);
  const existingFileColumns = new Set(db.prepare('PRAGMA table_info(files)').all().map(column => column.name));
  for (const [name, type] of [['storage_provider', "TEXT NOT NULL DEFAULT 'local'"], ['storage_connection_id', 'TEXT'], ['storage_remote_id', 'TEXT'], ['md5', 'TEXT']]) {
    if (!existingFileColumns.has(name)) db.exec(`ALTER TABLE files ADD COLUMN ${name} ${type}`);
  }
  const existingChannelColumns = new Set(db.prepare('PRAGMA table_info(channels)').all().map(column => column.name));
  if (!existingChannelColumns.has('category')) db.exec("ALTER TABLE channels ADD COLUMN category TEXT NOT NULL DEFAULT 'generic' CHECK(category IN ('generic','team','project'))");
  if (!existingChannelColumns.has('creator_id')) db.exec('ALTER TABLE channels ADD COLUMN creator_id TEXT REFERENCES users(id)');
  if (!existingChannelColumns.has('scope')) {
    db.exec("ALTER TABLE channels ADD COLUMN scope TEXT NOT NULL DEFAULT 'public' CHECK(scope IN ('public','team','private'))");
    db.exec("UPDATE channels SET scope='private' WHERE kind IN ('self','dm')");
  }
  if (!existingChannelColumns.has('team_id')) db.exec('ALTER TABLE channels ADD COLUMN team_id TEXT');
  if (!existingChannelColumns.has('system_key')) db.exec("ALTER TABLE channels ADD COLUMN system_key TEXT CHECK(system_key IS NULL OR system_key IN ('announcements','info','social'))");
  if (!existingChannelColumns.has('deleted_at')) db.exec('ALTER TABLE channels ADD COLUMN deleted_at TEXT');
  if (!existingChannelColumns.has('deleted_by')) db.exec('ALTER TABLE channels ADD COLUMN deleted_by TEXT REFERENCES users(id)');
  if (!existingChannelColumns.has('archived_by_leave')) db.exec('ALTER TABLE channels ADD COLUMN archived_by_leave TEXT REFERENCES users(id)');
  if (!existingChannelColumns.has('lifecycle_version')) db.exec('ALTER TABLE channels ADD COLUMN lifecycle_version INTEGER NOT NULL DEFAULT 0');
  db.prepare("UPDATE channels SET description=? WHERE scope='team' AND description=?").run(teamDescription, legacyTeamDescription);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS channels_company_team ON channels(team_id) WHERE team_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS channels_system_key ON channels(system_key) WHERE system_key IS NOT NULL');
  const existingMessageColumns = new Set(db.prepare('PRAGMA table_info(messages)').all().map(column => column.name));
  // Keep the original identifier after deletion so replies can show a deleted-parent marker, without keeping its text or files.
  if (!existingMessageColumns.has('reply_to_id')) db.exec('ALTER TABLE messages ADD COLUMN reply_to_id INTEGER CHECK(reply_to_id IS NULL OR reply_to_id>0)');
  db.exec('CREATE INDEX IF NOT EXISTS messages_reply ON messages(reply_to_id,id)');
}
// Directory adoption must run after the base schema and before collaboration
// backfills, so legacy announcement messages retain their acknowledgement flag.


// Also used by isolated services/tests with a minimal pre-existing chat schema.
export function initializeCollaborationSchema(db) {
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const columns = new Set(all('PRAGMA table_info(messages)').map(row => row.name));
  if (!columns.has('workspace_link')) db.exec('ALTER TABLE messages ADD COLUMN workspace_link TEXT');
  if (!columns.has('ack_required')) {
    db.exec('ALTER TABLE messages ADD COLUMN ack_required INTEGER NOT NULL DEFAULT 0 CHECK(ack_required IN (0,1))');
    db.exec("UPDATE messages SET ack_required=1 WHERE channel_id IN (SELECT id FROM channels WHERE system_key='announcements')");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_mentions (message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(message_id,user_id));
    CREATE TABLE IF NOT EXISTS channel_notifications (channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL CHECK(mode IN ('all','mentions','mute')),PRIMARY KEY(channel_id,user_id));
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,kind TEXT NOT NULL,dedupe_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,read_at TEXT);
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS announcement_acks (message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,acknowledged_at TEXT NOT NULL,PRIMARY KEY(message_id,user_id));
    CREATE TABLE IF NOT EXISTS message_tasks (id TEXT PRIMARY KEY,message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,assignee_id TEXT NOT NULL REFERENCES users(id),creator_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,due_date TEXT,status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS saved_messages (message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(message_id,user_id));
    CREATE TABLE IF NOT EXISTS message_reminders (id TEXT PRIMARY KEY,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,remind_at TEXT NOT NULL,created_at TEXT NOT NULL,delivered_at TEXT,UNIQUE(message_id,user_id));
    CREATE INDEX IF NOT EXISTS reminders_due ON message_reminders(delivered_at,remind_at);
  `);
  initializeProductivitySchema(db);
}

export function initializeProductivitySchema(db) {
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const columns = new Set(all('PRAGMA table_info(message_tasks)').map(row => row.name));
  for (const [name, type] of [['stage', "TEXT NOT NULL DEFAULT 'requested'"], ['reviewer_id', 'TEXT REFERENCES users(id)'], ['result_message_id', 'INTEGER REFERENCES messages(id) ON DELETE SET NULL']]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE message_tasks ADD COLUMN ${name} ${type}`);
  }
  if (!columns.has('stage')) db.exec("UPDATE message_tasks SET stage=CASE status WHEN 'doing' THEN 'doing' WHEN 'done' THEN 'done' ELSE 'requested' END");
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_decisions (
      id TEXT PRIMARY KEY,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,effective_date TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('decision','final')),
      result_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      creator_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
      replaces_id TEXT UNIQUE REFERENCES message_decisions(id) ON DELETE SET NULL,request_id TEXT,
      superseded_by_id TEXT,UNIQUE(creator_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS productivity_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,task_id TEXT REFERENCES message_tasks(id) ON DELETE CASCADE,
      decision_id TEXT REFERENCES message_decisions(id) ON DELETE CASCADE,changes TEXT NOT NULL,created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS productivity_reads (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,sequence INTEGER NOT NULL DEFAULT 0,
      offered_sequence INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS due_digest_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      include_weekends INTEGER NOT NULL DEFAULT 0 CHECK(include_weekends IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS due_digests (
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kst_date TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,kst_date)
    );
    CREATE TABLE IF NOT EXISTS due_digest_tasks (
      digest_id TEXT NOT NULL REFERENCES due_digests(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES message_tasks(id) ON DELETE CASCADE,PRIMARY KEY(digest_id,task_id)
    );
  `);
  if (!all('PRAGMA table_info(message_decisions)').some(row => row.name === 'superseded_by_id')) db.exec('ALTER TABLE message_decisions ADD COLUMN superseded_by_id TEXT');
}
