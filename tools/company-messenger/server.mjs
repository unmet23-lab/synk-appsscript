import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, createReadStream } from 'node:fs';
import { open, unlink, stat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createDriveStorage } from './drive-storage.mjs';
import { createCompanyIdentityBridge } from './company-integration.mjs';
import { createCollaborationService } from './collaboration-service.mjs';
import { createDirectTaskService } from './direct-task-service.mjs';
import { resolvePlatformUrl } from './platform-navigation.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const scrypt = promisify(scryptCallback);
const FILE_LIMIT = 100 * 1024 * 1024;
const SESSION_MS = 7 * 86400000;
const EMOJI = new Set(['👍', '❤️', '✅', '👀', '🎉']);
const CHANNEL_CATEGORIES = new Set(['generic', 'team', 'project']);
const FILE_EXTENSIONS = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff', 'heic', 'avif'],
  video: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpeg', 'mpg'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'],
  document: ['pdf', 'txt', 'md', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx', 'odt', 'ods', 'rtf'],
  archive: ['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz'],
};
const FILE_TYPE_SQL = `CASE ${Object.entries(FILE_EXTENSIONS).map(([type, extensions]) => `WHEN ${['image', 'video', 'audio'].includes(type) ? `lower(f.mime) LIKE '${type}/%' OR ` : ''}${extensions.map(extension => `lower(f.name) LIKE '%.${extension}'`).join(' OR ')} THEN '${type}'`).join(' ')} ELSE 'other' END`;
function fileType(file) {
  const extension = path.extname(file.name).slice(1).toLowerCase();
  for (const [type, extensions] of Object.entries(FILE_EXTENSIONS)) if ((['image', 'video', 'audio'].includes(type) && file.mime.toLowerCase().startsWith(`${type}/`)) || extensions.includes(extension)) return type;
  return 'other';
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const basicPublicUser = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.created_at });
class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function assert(test, status, message) { if (!test) throw new AppError(status, message); }
function requestId(value, label) {
  assert(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 400, `${label} 식별자를 확인해 주세요.`);
  return value.toLowerCase();
}
function recoveryError(code, message, details = {}) { return Object.assign(new AppError(409, message), { code, ...details }); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function textField(value, label, max, min = 0) {
  assert(typeof value === 'string', 400, `${label}을(를) 입력해 주세요.`);
  const text = value.trim();
  assert(text.length >= min && text.length <= max, 400, `${label}은(는) ${min}~${max}자여야 합니다.`);
  return text;
}
function accountInput(body) {
  const name = textField(body.name, '이름', 40, 1);
  const username = textField(body.username, '아이디', 32, 3).toLowerCase();
  assert(/^[a-z0-9_.-]{3,32}$/.test(username), 400, '아이디는 영문, 숫자, 점, 밑줄, 하이픈으로 입력해 주세요.');
  assert(typeof body.password === 'string' && body.password.length >= 10 && body.password.length <= 128, 400, '비밀번호는 10~128자여야 합니다.');
  return { name, username, password: body.password };
}
async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password, encoded) {
  const [salt, digest] = encoded.split(':');
  const result = await scrypt(password, salt, 64);
  return timingSafeEqual(result, Buffer.from(digest, 'hex'));
}
async function jsonBody(req) {
  if (Number(req.headers['content-length']) > 65536) {
    req.resume();
    throw new AppError(413, '요청이 너무 큽니다.');
  }
  const parts = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 65536) parts.push(chunk);
  }
  assert(size <= 65536, 413, '요청이 너무 큽니다.');
  try {
    const body = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
    assert(body && typeof body === 'object' && !Array.isArray(body), 400, '올바른 요청 형식이 아닙니다.');
    return body;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, '요청 내용을 읽을 수 없습니다.');
  }
}

export function createMessenger({ dataDir = process.env.MESSENGER_DATA_DIR || path.join(ROOT, 'data'), port = Number(process.env.MESSENGER_PORT || 4197), host = '127.0.0.1', driveStorage, integration = null, basePath = '', platformUrl = process.env.SYNK_PLATFORM_URL, backgroundJobsEnabled = true, workNotificationsEnabled = backgroundJobsEnabled } = {}) {
  assert(typeof backgroundJobsEnabled === 'boolean', 400, '백그라운드 작업 설정은 boolean이어야 합니다.');
  assert(typeof workNotificationsEnabled === 'boolean', 400, '업무 알림 설정은 boolean이어야 합니다.');
  // This first version is deliberately local-only. Network deployment needs TLS and an explicit hosting design.
  assert(integration || ['127.0.0.1', '::1', 'localhost'].includes(host), 400, '현재 버전은 이 컴퓨터에서만 실행할 수 있습니다.');
  assert(basePath === '' || basePath === '/messenger', 400, '메신저 경로 설정을 확인해 주세요.');
  assert(Number.isInteger(port) && port >= 0 && port <= 65535, 400, '포트 번호가 올바르지 않습니다.');
  const platformEntryUrl = resolvePlatformUrl(platformUrl, { origin: integration?.origin || `http://${host === '::1' ? '[::1]' : host}:${port}` });
  dataDir = path.resolve(dataDir);
  const uploadDir = path.join(dataDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const drive = driveStorage ?? createDriveStorage({ dataDir });
  const db = new DatabaseSync(path.join(dataDir, 'messenger.sqlite'));
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
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS channels_company_team ON channels(team_id) WHERE team_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS channels_system_key ON channels(system_key) WHERE system_key IS NOT NULL');
  const existingMessageColumns = new Set(db.prepare('PRAGMA table_info(messages)').all().map(column => column.name));
  // Keep the original identifier after deletion so replies can show a deleted-parent marker, without keeping its text or files.
  if (!existingMessageColumns.has('reply_to_id')) db.exec('ALTER TABLE messages ADD COLUMN reply_to_id INTEGER CHECK(reply_to_id IS NULL OR reply_to_id>0)');
  db.exec('CREATE INDEX IF NOT EXISTS messages_reply ON messages(reply_to_id,id)');
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const bridge = integration ? createCompanyIdentityBridge({ db, listUsers: integration.listUsers, listTeams: integration.listTeams, identityLinks: integration.identityLinks, ensurePublicChannels: ensureSystemChannels }) : null;
  if (bridge) bridge.sync();
  else transaction(() => ensureSystemChannels(all('SELECT id FROM users').map(user => user.id)));
  const publicUser = user => ({ ...basicPublicUser(user), ...(bridge?.profile(user.id) || { teamId: null, teamName: null, companyRole: null }) });
  const workspaceName = () => integration?.workspaceName?.() || one("SELECT value FROM settings WHERE key='workspace_name'")?.value || 'SYNK';
  const hasSetup = () => Boolean(one('SELECT id FROM users LIMIT 1'));
  const members = () => (bridge ? bridge.members() : all('SELECT * FROM users ORDER BY created_at,id')).map(publicUser);
  const subscribers = new Set();
  const authAttempts = new Map();
  let listeningPort = port;
  let closed = false;
  let deletionTask = null;
  let deletionTimer = null;
  let reminderTimer = null;
  const activeDownloads = new Set();
  const activeUploadRequests = new Set();
  const collaboration = createCollaborationService({ db, assert, textField, now, transaction, members, requireChannel, requireMessage, requirePosting, messageShape, publish, fileTypeSql: FILE_TYPE_SQL, integrated: Boolean(integration), origin: () => integration?.origin || `http://${host}:${listeningPort}`, resolveLink: resolveWorkspaceLink, backgroundJobsEnabled, workNotificationsEnabled,
    externalNotifications: integration?.notifications ? {
      list: userId => integration.notifications.list(bridge.companyUserId(userId)),
      read: (userId, notificationId) => integration.notifications.read(bridge.companyUserId(userId), notificationId),
      readAll: userId => integration.notifications.readAll(bridge.companyUserId(userId)),
    } : null,
  });
  const directTasks = createDirectTaskService({ db, assert, textField, validateRequestId: requestId, now, transaction, requirePosting, channelShape, channelMembers, collaboration, messageShape,
    onPublishError: error => console.error('[messenger] Committed task update publication:', String(error?.code || error?.name || 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80)),
  });

  function resolveWorkspaceLink({ userId, channelId, workspaceLink, recipientIds, purpose = 'share' }) {
    if (integration?.resolveWorkspaceLink) {
      const memberIds = members().filter(member => recipientIds ? recipientIds.includes(member.id) : one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, member.id)).map(member => bridge.companyUserId(member.id)).filter(Boolean);
      try { return integration.resolveWorkspaceLink({ companyUserId: bridge.companyUserId(userId), recipientCompanyUserIds: memberIds, workspaceLink, purpose }); }
      catch (error) {
        if (error?.status === 403) throw new AppError(403, '이 대화의 참여자에게 공유할 권한이 없습니다. 기획을 볼 수 있는 다른 크루나 대화방을 선택해 주세요.');
        if (error?.status === 404) throw new AppError(404, '공유할 기획을 찾을 수 없거나 열람 권한이 변경되었습니다. 회사 화면에서 기획을 다시 확인해 주세요.');
        throw error;
      }
    }
    assert(!workspaceLink.url.includes('draftId='), 403, '이 기획의 공유 권한을 확인할 수 없습니다. 회사 화면에서 공유해 주세요.');
    return workspaceLink;
  }

  function enqueueDriveDeletion({ fileId, connectionId, remoteId }) {
    run('INSERT OR IGNORE INTO drive_delete_outbox(file_id,connection_id,remote_id,created_at) VALUES(?,?,?,?)', fileId, connectionId, remoteId, now());
  }
  function queueFileDeletion(file) {
    if (file.storage_provider === 'google-drive') enqueueDriveDeletion({ fileId: file.id, connectionId: file.storage_connection_id, remoteId: file.storage_remote_id });
  }
  function recordFileCancellation(file, userId) {
    run('INSERT OR IGNORE INTO file_deletion_receipts(user_id,file_id,channel_id,deleted_at) VALUES(?,?,?,?)', userId, file.id, file.channel_id, now());
  }
  function retryDriveDeletions() {
    if (deletionTask) return deletionTask;
    // Keep deletion intent durable while restored data is awaiting acceptance.
    if (closed || !backgroundJobsEnabled) return Promise.resolve();
    deletionTask = (async () => {
      const pending = all('SELECT * FROM drive_delete_outbox ORDER BY created_at LIMIT 20');
      for (const job of pending) {
        try {
          await drive.trash({ connectionId: job.connection_id, remoteId: job.remote_id, fileId: job.file_id });
          run('DELETE FROM drive_delete_outbox WHERE file_id=?', job.file_id);
        } catch (error) {
          run('UPDATE drive_delete_outbox SET attempts=attempts+1,last_attempt_at=?,last_error=? WHERE file_id=?', now(), typeof error.publicMessage === 'string' ? error.publicMessage : 'Drive 파일 정리를 다시 시도할 예정입니다.', job.file_id);
        }
      }
    })().finally(() => { deletionTask = null; });
    return deletionTask;
  }
  function pendingDeletions() { return one('SELECT COUNT(*) AS n FROM drive_delete_outbox').n; }
  async function driveStatus(options) { return { ...await drive.status(options), pendingDeletions: pendingDeletions() }; }

  function rateLimit(req, identity = '') {
    const stamp = Date.now();
    for (const [key, limit] of [[`${req.socket.remoteAddress}:all`, 100], [`${req.socket.remoteAddress}:${identity.toLowerCase()}`, 15]]) {
      const prior = authAttempts.get(key);
      const entry = !prior || prior.until < stamp ? { count: 0, until: stamp + 15 * 60000 } : prior;
      entry.count++;
      authAttempts.set(key, entry);
      assert(entry.count <= limit, 429, '시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
    }
    if (authAttempts.size > 1000) for (const [k, v] of authAttempts) if (v.until < stamp) authAttempts.delete(k);
  }
  function session(req) {
    if (integration) {
      syncDirectory();
      const identity = integration.authenticate(req);
      if (!identity) return null;
      const user = bridge.resolve(identity.companyUserId);
      if (!user) return null;
      return { user: { ...user, role: identity.canManage ? 'owner' : 'member' }, token: identity.token, identity };
    }
    const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('synk_messenger_session='))?.slice('synk_messenger_session='.length);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const token = hash(raw);
    const user = one('SELECT u.*,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?', token);
    if (!user || user.expires_at <= now()) return null;
    return { user, token };
  }
  function issueSession(res, userId) {
    const raw = randomBytes(32).toString('hex');
    run('DELETE FROM sessions WHERE expires_at <= ?', now());
    run('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)', hash(raw), userId, new Date(Date.now() + SESSION_MS).toISOString());
    res.setHeader('Set-Cookie', `synk_messenger_session=${raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`);
  }
  function requireChannel(userId, channelId) {
    const channel = one('SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id WHERE c.id=? AND m.user_id=?', channelId, userId);
    assert(channel && !channel.deleted_at && (channel.scope !== 'team' || bridge?.inTeam(channel.team_id, userId)), 404, '대화방을 찾을 수 없습니다.');
    return channel;
  }
  function canPostInChannel(channel, userId) {
    const role = bridge ? bridge.profile(userId).companyRole : one('SELECT role FROM users WHERE id=?', userId)?.role;
    if (!role || role === 'viewer' || channel.deleted_at) return false;
    return channel.system_key !== 'announcements' || role === (bridge ? 'admin' : 'owner');
  }
  function requirePosting(userId, channelId) {
    const channel = requireChannel(userId, channelId);
    assert(canPostInChannel(channel, userId), 403, channel.system_key === 'announcements' ? '공지는 관리자만 작성하거나 파일을 올릴 수 있습니다. 읽기와 반응은 사용할 수 있습니다.' : '이 대화방에 메시지나 파일을 올릴 수 없습니다.');
    return channel;
  }
  function selectedProject(channel) { return channel.kind === 'channel' && channel.scope === 'private' && channel.category === 'project'; }
  function projectChannel(channel) { return !channel.system_key && channel.kind === 'channel' && channel.category === 'project' && ['public', 'private'].includes(channel.scope); }
  function projectManager(channel) {
    if (channel.creator_id && one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channel.id, channel.creator_id) && canPostInChannel({ ...channel, deleted_at: null }, channel.creator_id)) return channel.creator_id;
    const eligible = channelMembers(channel.id).filter(member => canPostInChannel({ ...channel, deleted_at: null }, member.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return eligible[0]?.id || null;
  }
  function departureVersion(channelId, userId) { return one('SELECT revision FROM channel_departures WHERE channel_id=? AND user_id=?', channelId, userId)?.revision || 0; }
  function canManageChannel(channel, userId, allowDeleted = false) {
    return !channel.system_key && channel.kind === 'channel' && (channel.scope === 'public' || selectedProject(channel)) && canPostInChannel(allowDeleted ? { ...channel, deleted_at: null } : channel, userId) && Boolean(one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channel.id, userId)) && ((projectChannel(channel) ? projectManager(channel) === userId : channel.creator_id === userId) || one('SELECT role FROM users WHERE id=?', userId)?.role === 'owner');
  }
  function managedProject(channel, userId) { return channel.category === 'project' && canManageChannel(channel, userId, true); }
  function canRestoreProject(channel, userId) {
    if (!projectChannel(channel)) return false;
    if (channel.archived_by_leave) return channel.archived_by_leave === userId && members().some(member => member.id === userId) && Boolean(one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channel.id, userId));
    return managedProject(channel, userId);
  }
  function selectedMemberIds(value) {
    assert(Array.isArray(value) && value.length <= 500 && value.every(id => typeof id === 'string'), 400, '참여할 크루를 목록에서 선택해 주세요.');
    const activeIds = new Set(members().map(member => member.id));
    const ids = [...new Set(value)];
    assert(ids.every(id => activeIds.has(id)), 400, '현재 참여할 수 없는 크루가 포함되어 있습니다. 크루 목록을 새로고침해 주세요.');
    return ids;
  }
  function channelMembers(channelId) { return members().filter(member => one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, member.id)); }
  function verifyProjectHistoryAudience(channel, userId, recipientIds, purpose = 'share') {
    for (const row of all('SELECT workspace_link FROM messages WHERE channel_id=? AND workspace_link IS NOT NULL', channel.id)) {
      try { resolveWorkspaceLink({ userId, channelId: channel.id, recipientIds, workspaceLink: JSON.parse(row.workspace_link), purpose }); }
      catch (error) {
        if (error.status === 403 || error.status === 404) throw new AppError(error.status, '이 대화방에 공유된 기획을 볼 권한이 없는 크루가 포함되어 있거나 기획의 열람 권한이 변경되었습니다. 기획 권한을 확인하거나 새로운 대화방을 이용해 주세요.');
        throw error;
      }
    }
  }
  function channelShape(c, userId) {
    const memberIds = all('SELECT user_id FROM memberships WHERE channel_id=? ORDER BY user_id', c.id).map(r => r.user_id);
    const activeMemberCount = bridge ? memberIds.filter(id => Boolean(bridge.profile(id).companyRole)).length : memberIds.length;
    const other = c.kind === 'dm' ? one('SELECT name FROM users WHERE id=?', memberIds.find(id => id !== userId)) : null;
    const unread = c.deleted_at ? 0 : one('SELECT COUNT(*) AS n FROM messages WHERE channel_id=? AND user_id<>? AND id>COALESCE((SELECT last_read FROM memberships WHERE channel_id=? AND user_id=?),0)', c.id, userId, c.id, userId).n;
    const canManage = canManageChannel(c, userId);
    const canInvite = canManage && (selectedProject(c) || (projectChannel(c) && Boolean(one('SELECT 1 FROM channel_departures WHERE channel_id=? AND rejoined_at IS NULL', c.id))));
    return { id: c.id, name: c.kind === 'self' ? '나에게' : other?.name || c.name, description: c.description, kind: c.kind, scope: c.kind === 'channel' ? c.scope : 'private', teamId: c.team_id || null, category: c.kind === 'channel' ? c.category : null, systemKey: c.system_key || null, canPost: canPostInChannel(c, userId), canManage, canInvite, canLeave: !c.deleted_at && projectChannel(c) && memberIds.includes(userId), canDelete: !c.deleted_at && projectChannel(c) && canManage, canRestore: Boolean(c.deleted_at) && canRestoreProject(c, userId), archivedByLeave: Boolean(c.archived_by_leave), deletedAt: c.deleted_at || null, deletedBy: c.deleted_by ? publicUser(one('SELECT * FROM users WHERE id=?', c.deleted_by)) : null, notificationMode: collaboration.notificationMode(userId, c.id), memberIds, activeMemberCount, unread, lastMessageAt: c.deleted_at ? null : one('SELECT created_at FROM messages WHERE channel_id=? ORDER BY id DESC LIMIT 1', c.id)?.created_at || null };
  }
  function channelsFor(userId) {
    return all("SELECT c.* FROM channels c JOIN memberships m ON m.channel_id=c.id WHERE m.user_id=? AND c.deleted_at IS NULL ORDER BY CASE c.kind WHEN 'channel' THEN 0 WHEN 'self' THEN 1 ELSE 2 END,c.created_at,c.id", userId).filter(c => c.scope !== 'team' || bridge?.inTeam(c.team_id, userId)).map(c => channelShape(c, userId));
  }
  async function bootstrap(user, identity) {
    const active = await drive.active();
    syncDirectory();
    const basic = { needsSetup: !hasSetup(), workspace: { name: workspaceName() }, storage: { provider: active ? 'google-drive' : 'local' }, platformUrl: platformEntryUrl, sendRecovery: { messages: true, uploads: true } };
    if (!user) return basic;
    return { ...basic, user: publicUser(user), channels: channelsFor(user.id), members: members(), teams: bridge?.teamsFor(user.id) || [], notificationUnread: collaboration.unreadCount(user.id), scheduledNotifications: { enabled: workNotificationsEnabled }, limits: { fileBytes: FILE_LIMIT }, ...(identity ? { integrated: { csrfToken: identity.csrfToken, companyUserId: identity.companyUserId, role: identity.role, canWrite: identity.canWrite, canManage: identity.canManage, parentOrigin: identity.parentOrigin } } : {}) };
  }
  function createChannel(name, description, kind, userIds, pairKey = null, category = 'generic', creatorId = null, teamId = null, scope = 'public') {
    const id = randomUUID();
    run('INSERT INTO channels(id,name,description,kind,pair_key,created_at,category,creator_id,scope,team_id) VALUES(?,?,?,?,?,?,?,?,?,?)', id, name, description, kind, pairKey, now(), category, creatorId, kind !== 'channel' ? 'private' : teamId ? 'team' : scope, teamId);
    for (const userId of userIds) run('INSERT INTO memberships(channel_id,user_id) VALUES(?,?)', id, userId);
    return one('SELECT * FROM channels WHERE id=?', id);
  }
  // Call inside the caller's transaction. Only untouched, unambiguous original defaults are adopted.
  function ensureSystemChannels(userIds) {
    if (!userIds.length) return;
    const defaults = [
      { key: 'announcements', name: '공지', description: '팀에 필요한 소식을 모아 두세요', legacyName: '공지사항' },
      { key: 'info', name: '정보방', description: '업무에 도움이 되는 정보와 자료를 나누세요' },
      { key: 'social', name: '수다방', description: '함께 나누는 이야기와 업무 소식', legacyName: '팀 라운지' },
    ];
    for (const room of defaults) {
      let channel = one('SELECT * FROM channels WHERE system_key=?', room.key);
      if (!channel) {
        const candidates = room.legacyName ? all("SELECT * FROM channels WHERE system_key IS NULL AND kind='channel' AND scope='public' AND category='generic' AND creator_id IS NULL AND pair_key IS NULL AND team_id IS NULL AND name=? AND description=?", room.legacyName, room.description) : [];
        if (candidates.length === 1) {
          channel = candidates[0];
          run('UPDATE channels SET name=?,system_key=? WHERE id=?', room.name, room.key, channel.id);
        } else {
          channel = createChannel(room.name, room.description, 'channel', []);
          run('UPDATE channels SET system_key=? WHERE id=?', room.key, channel.id);
        }
      }
      for (const userId of userIds) run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, userId);
    }
  }
  function createUser(input, password, role) {
    assert(!one('SELECT id FROM users WHERE username=?', input.username), 409, '이미 사용 중인 아이디입니다.');
    const id = randomUUID();
    run('INSERT INTO users(id,username,name,role,password,created_at) VALUES(?,?,?,?,?,?)', id, input.username, input.name, role, password, now());
    run("INSERT INTO memberships(channel_id,user_id) SELECT id,? FROM channels WHERE kind='channel' AND scope='public' AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM channel_departures d WHERE d.channel_id=channels.id AND d.user_id=? AND d.rejoined_at IS NULL)", id, id);
    createChannel('나에게', '메모와 파일을 나만 볼 수 있는 공간', 'self', [id], `self:${id}`);
    return one('SELECT * FROM users WHERE id=?', id);
  }
  function fileShape(f) { return { id: f.id, name: f.name, size: f.size, mime: f.mime, type: fileType(f), url: `${basePath}/api/files/${f.id}`, createdAt: f.created_at, uploaderId: f.uploader_id, channelId: f.channel_id, messageId: f.message_id === null ? null : String(f.message_id), storageProvider: f.storage_provider }; }
  function messageShape(m, userId) {
    const reactions = all('SELECT emoji,COUNT(*) AS count,MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS mine FROM reactions WHERE message_id=? GROUP BY emoji ORDER BY emoji', userId, m.id).map(r => ({ emoji: r.emoji, count: r.count, mine: Boolean(r.mine) }));
    const parent = m.reply_to_id ? one('SELECT * FROM messages WHERE id=? AND channel_id=?', m.reply_to_id, m.channel_id) : null;
    const replyTo = !m.reply_to_id ? null : { id: String(m.reply_to_id), body: parent?.body || '', user: parent ? publicUser(one('SELECT * FROM users WHERE id=?', parent.user_id)) : null, files: parent ? all('SELECT * FROM files WHERE message_id=? ORDER BY created_at,id', parent.id).map(fileShape) : [], deleted: !parent };
    const pin = one('SELECT * FROM message_pins WHERE message_id=?', m.id);
    return { id: String(m.id), channelId: m.channel_id, body: m.body, user: publicUser(one('SELECT * FROM users WHERE id=?', m.user_id)), files: all('SELECT * FROM files WHERE message_id=? ORDER BY created_at,id', m.id).map(fileShape), createdAt: m.created_at, editedAt: m.edited_at, reactions, replyToId: m.reply_to_id ? String(m.reply_to_id) : null, replyTo, replyCount: one('SELECT COUNT(*) AS n FROM messages WHERE reply_to_id=? AND channel_id=?', m.id, m.channel_id).n, pinned: Boolean(pin), pinnedAt: pin?.created_at || null, pinnedBy: pin ? publicUser(one('SELECT * FROM users WHERE id=?', pin.user_id)) : null, ...collaboration.messageExtras(m, userId) };
  }
  function requireMessage(id, userId) {
    const m = /^\d+$/.test(id) ? one('SELECT * FROM messages WHERE id=?', id) : null;
    assert(m, 404, '메시지를 찾을 수 없습니다.');
    requireChannel(userId, m.channel_id);
    return m;
  }
  function publish(type, channelId, onlyUserId) {
    syncDirectory();
    if (channelId && type !== 'channel' && one('SELECT deleted_at FROM channels WHERE id=?', channelId)?.deleted_at) return;
    const data = `event: update\ndata: ${JSON.stringify({ type, ...(channelId ? { channelId } : {}) })}\n\n`;
    for (const client of subscribers) {
      if (!validSubscriber(client, false)) { client.res.end(); subscribers.delete(client); continue; }
      if (onlyUserId && onlyUserId !== client.userId) continue;
      if (channelId && !one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, client.userId)) continue;
      if (!client.res.writableEnded) client.res.write(data);
    }
  }
  function syncDirectory() {
    if (!bridge) return;
    const before = bridge.revision;
    bridge.sync();
    if (before !== bridge.revision) for (const client of subscribers) {
      if (!validSubscriber(client, false)) { client.res.end(); subscribers.delete(client); }
      else if (!client.res.writableEnded) client.res.write('event: update\ndata: {"type":"member"}\n\n');
    }
  }
  function validSubscriber(client, synchronize = true) {
    if (integration) {
      if (synchronize) syncDirectory();
      const fresh = integration.authenticate(client.req);
      return fresh && fresh.token === client.token && bridge.resolve(fresh.companyUserId)?.id === client.userId && bridge.accessKey(client.userId) === client.accessKey;
    }
    return Boolean(one('SELECT 1 FROM sessions WHERE token=? AND expires_at>?', client.token, now()));
  }
  function disconnectRevoked() { syncDirectory(); for (const client of subscribers) if (!validSubscriber(client, false)) { client.res.end(); subscribers.delete(client); } }
  async function removeDiskFile(diskName) {
    // Disk names are generated internally, never supplied by a client.
    try { await unlink(path.join(uploadDir, diskName)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  function headers(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', integration ? 'SAMEORIGIN' : 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors ${integration ? "'self'" : "'none'"}; form-action 'self'`);
    res.setHeader('Cache-Control', 'no-store');
  }
  function json(res, status, value) {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  }
  function guardRequest(req) {
    if (integration) {
      if (req.headers.origin) assert(req.headers.origin === integration.origin, 403, '회사 프로그램 화면에서 요청해 주세요.');
      assert(req.headers['sec-fetch-site'] !== 'cross-site', 403, '다른 사이트에서 보낸 요청은 허용되지 않습니다.');
      return;
    }
    const allowedHosts = new Set([`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`, `[::1]:${listeningPort}`]);
    assert(allowedHosts.has(req.headers.host), 403, '허용되지 않은 접속 주소입니다.');
    if (req.headers.origin) assert(req.headers.origin === `http://${req.headers.host}`, 403, '다른 사이트에서 보낸 요청은 허용되지 않습니다.');
    assert(req.headers['sec-fetch-site'] !== 'cross-site', 403, '다른 사이트에서 보낸 요청은 허용되지 않습니다.');
  }
  function sentRequestResult(receipt, userId) {
    if (receipt.state === 'cancelled') throw recoveryError('MESSAGE_CANCELLED', '취소한 전송입니다. 같은 식별자로 다시 보내지 않습니다.');
    const message = receipt.message_id && one('SELECT * FROM messages WHERE id=?', receipt.message_id);
    if (!message) throw recoveryError('MESSAGE_DELETED', '이미 전송된 메시지가 삭제되었습니다. 다시 전송하지 않습니다.');
    if (message.workspace_link) {
      try { resolveWorkspaceLink({ userId, channelId: message.channel_id, workspaceLink: JSON.parse(message.workspace_link) }); }
      catch (error) {
        // The receipt already belongs to this authenticated author and accessible channel.
        // Confirm only completion when the linked plan was removed or its access changed.
        if (error.status === 403 || error.status === 404) return { status: 'sent', unavailable: true };
        throw error;
      }
    }
    return { status: 'sent', message: messageShape(message, userId) };
  }
  function uploadedRequestFile(receipt, key) {
    if (receipt.state === 'cancelled') throw recoveryError('UPLOAD_CANCELLED', '취소한 파일 전송입니다. 같은 식별자로 다시 올리지 않습니다.');
    if (receipt.state === 'pending') {
      const active = activeUploadRequests.has(key);
      throw recoveryError(active ? 'UPLOAD_IN_PROGRESS' : 'UPLOAD_UNCERTAIN', active ? '파일 저장이 진행 중입니다. 잠시 후 전송 결과를 확인해 주세요.' : '이전 파일 저장 결과를 확인할 수 없어 중복 업로드를 중단했습니다.', { recoveryStatus: active ? 'pending' : 'uncertain', retryable: false });
    }
    if (receipt.state !== 'complete') return null;
    const file = receipt.file_id && one('SELECT * FROM files WHERE id=?', receipt.file_id);
    if (!file) throw recoveryError('UPLOAD_DELETED', '이미 삭제한 첨부파일입니다. 다시 올리지 않습니다.');
    if (file.message_id !== null) throw recoveryError('UPLOAD_CONSUMED', '이미 메시지에 첨부한 파일입니다. 해당 메시지의 전송 결과를 확인해 주세요.');
    return file;
  }
  async function upload(req, res, user, channelId, revalidate = () => {}) {
    const lifecycleVersion = requirePosting(user.id, channelId).lifecycle_version;
    const membershipVersion = departureVersion(channelId, user.id);
    const uploadId = req.headers['x-upload-id'] === undefined ? null : requestId(req.headers['x-upload-id'], '파일 전송');
    const validateUpload = () => {
      revalidate();
      assert(requirePosting(user.id, channelId).lifecycle_version === lifecycleVersion, 409, '대화방이 삭제 또는 복원되어 업로드가 취소되었습니다. 다시 파일을 선택해 주세요.');
      assert(departureVersion(channelId, user.id) === membershipVersion, 409, '프로젝트 참여 상태가 변경되어 업로드가 취소되었습니다. 다시 파일을 선택해 주세요.');
      if (uploadId && one('SELECT state FROM file_upload_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, uploadId)?.state === 'cancelled') throw recoveryError('UPLOAD_CANCELLED', '취소한 파일 전송입니다. 같은 식별자로 다시 올리지 않습니다.');
    };
    const uploadKey = JSON.stringify([user.id, channelId, uploadId]);
    // Capture storage once, preserving the existing account-switch semantics.
    const activeConnection = await drive.active();
    validateUpload();
    let original;
    try { original = decodeURIComponent(req.headers['x-file-name'] || ''); } catch { throw new AppError(400, '파일 이름을 읽을 수 없습니다.'); }
    original = original.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim();
    assert(original && original.length <= 240, 400, '파일 이름은 1~240자여야 합니다.');
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      assert(Number(contentLength) > 0, 400, '빈 파일은 올릴 수 없습니다.');
      if (Number(contentLength) > FILE_LIMIT) { req.resume(); throw new AppError(413, '파일은 하나당 100MB까지 올릴 수 있습니다.'); }
    }
    const id = randomUUID(); const diskName = `${id}.bin`; const diskPath = path.join(uploadDir, diskName);
    let handle; let size = 0; let saved = false; let remote = null; let claimed = false;
    const digest = createHash('md5');
    const payloadDigest = createHash('sha256');
    try {
      handle = await open(diskPath, 'wx', 0o600);
      for await (const chunk of req) {
        size += chunk.length;
        if (size <= FILE_LIMIT) {
          digest.update(chunk);
          payloadDigest.update(chunk);
          let offset = 0;
          while (offset < chunk.length) {
            const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
            offset += bytesWritten;
          }
        }
      }
      await handle.sync();
      await handle.close(); handle = null;
      assert(size <= FILE_LIMIT, 413, '파일은 하나당 100MB까지 올릴 수 있습니다.');
      assert(size > 0, 400, '빈 파일은 올릴 수 없습니다.');
      assert(!res.destroyed, 499, '파일 업로드가 취소되었습니다.');
      validateUpload();
      const md5 = digest.digest('hex');
      if (uploadId) {
        const fingerprint = hash(JSON.stringify([original, size, payloadDigest.digest('hex')]));
        const existing = transaction(() => {
          const prior = one('SELECT * FROM file_upload_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, uploadId);
          if (prior && prior.payload_hash !== fingerprint) throw recoveryError('UPLOAD_REQUEST_CONFLICT', '같은 전송 식별자로 다른 파일을 올릴 수 없습니다.');
          const complete = prior && uploadedRequestFile(prior, uploadKey);
          if (complete) return complete;
          if (prior) run("UPDATE file_upload_requests SET state='pending' WHERE user_id=? AND channel_id=? AND request_id=?", user.id, channelId, uploadId);
          else run("INSERT INTO file_upload_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'pending',?)", user.id, channelId, uploadId, fingerprint, now());
          return null;
        });
        if (existing) return fileShape(existing);
        claimed = true;
        activeUploadRequests.add(uploadKey);
      }
      if (activeConnection) {
        remote = await drive.upload({ connectionId: activeConnection.id, localPath: diskPath, name: original, size, md5, fileId: id });
        assert(remote?.connectionId === activeConnection.id && typeof remote.remoteId === 'string' && remote.remoteId && typeof remote.md5 === 'string' && remote.md5.toLowerCase() === md5, 502, 'Drive에 저장된 파일을 검증하지 못했습니다. 다시 시도해 주세요.');
        // Survives a failed SQLite insert or a crash before the file record is committed.
        enqueueDriveDeletion({ fileId: id, connectionId: activeConnection.id, remoteId: remote.remoteId });
      }
      // A completed keyed upload remains discoverable even when only the response was lost.
      if (!uploadId) assert(!res.destroyed, 499, '파일 업로드가 취소되었습니다.');
      validateUpload();
      // MIME intentionally inert. Any extension may be downloaded, never executed or rendered inline.
      transaction(() => {
        run('INSERT INTO files(id,channel_id,uploader_id,name,size,mime,disk_name,created_at,storage_provider,storage_connection_id,storage_remote_id,md5) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, channelId, user.id, original, size, 'application/octet-stream', diskName, now(), activeConnection ? 'google-drive' : 'local', activeConnection?.id ?? null, remote?.remoteId ?? null, md5);
        if (uploadId) run("UPDATE file_upload_requests SET state='complete',file_id=? WHERE user_id=? AND channel_id=? AND request_id=?", id, user.id, channelId, uploadId);
        if (remote) run('DELETE FROM drive_delete_outbox WHERE file_id=?', id);
      });
      saved = true;
      return fileShape(one('SELECT * FROM files WHERE id=?', id));
    } catch (error) {
      const cleanup = remote?.remoteId ? { fileId: id, connectionId: activeConnection.id, remoteId: remote.remoteId } : error.remoteCleanup;
      if (!saved && cleanup?.fileId === id && cleanup.connectionId === activeConnection?.id && typeof cleanup.remoteId === 'string' && cleanup.remoteId) {
        try {
          enqueueDriveDeletion(cleanup);
          await retryDriveDeletions();
        } catch {
          // If SQLite itself is unavailable, make one guarded cleanup attempt without touching other files.
          await drive.trash(cleanup).catch(() => {});
        }
      }
      // Known failures can retry. A durable pending row after process interruption is never
      // blindly replayed into Drive, where its previous write may already have succeeded.
      if (claimed && !saved && (!cleanup || !one('SELECT 1 FROM drive_delete_outbox WHERE file_id=?', id))) run("UPDATE file_upload_requests SET state='failed' WHERE user_id=? AND channel_id=? AND request_id=? AND state='pending'", user.id, channelId, uploadId);
      throw error;
    } finally {
      if (claimed) activeUploadRequests.delete(uploadKey);
      if (handle) await handle.close().catch(() => {});
      if (!saved || activeConnection) await removeDiskFile(diskName).catch(error => console.error('[messenger] Upload staging cleanup:', error.code || error.name));
    }
  }

  const handler = async (req, res) => {
    headers(res);
    try {
      guardRequest(req);
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (basePath) {
        assert(url.pathname.startsWith(`${basePath}/`), 404, '메신저 주소를 확인해 주세요.');
        url.pathname = url.pathname.slice(basePath.length);
      }
      const p = url.pathname; const method = req.method;
      if (method === 'GET' && p === '/api/health') return json(res, 200, { ok: true, service: 'synk-company-messenger', version: 1 });
      let auth = session(req);
      let user = auth?.user;
      const originalToken = auth?.token;
      const originalRole = auth?.identity?.role;
      const originalAccess = user && bridge?.accessKey(user.id);
      const mutation = !['GET', 'HEAD'].includes(method);
      const readMarker = method === 'POST' && /^\/api\/channels\/[^/]+\/read$/.test(p);
      const personalMutation = collaboration.personalMutation(p, method);
      const revalidate = () => {
        if (!integration) return;
        const latest = session(req);
        assert(latest && latest.token === originalToken, 401, '회사 계정으로 다시 로그인해 주세요.');
        assert(latest.identity.role === originalRole, 401, '회사 계정의 권한이 변경되었습니다. 다시 로그인해 주세요.');
        assert(bridge.accessKey(latest.user.id) === originalAccess, 401, '소속 팀이 변경되었습니다. 대화 목록을 새로고침해 주세요.');
        if (mutation) {
          assert(req.headers.origin === integration.origin && req.headers['x-csrf-token'] === latest.identity.csrfToken, 403, '로그인 상태를 다시 확인해 주세요.');
          assert(latest.identity.canWrite || readMarker || personalMutation, 403, '열람 계정은 메시지나 파일을 변경할 수 없습니다.');
        }
        auth = latest; user = latest.user;
      };
      const readBody = async () => { const body = await jsonBody(req); revalidate(); return body; };
      const respond = (status, body) => { if (integration && p.startsWith('/api/')) revalidate(); return json(res, status, body); };
      if (integration && p.startsWith('/api/')) {
        assert(user, 401, '회사 계정으로 로그인해 주세요.');
        if (/^\/api\/(setup|login|join|logout|invites)(\/|$)/.test(p)) throw new AppError(403, '계정과 초대는 회사 앱에서 관리해 주세요.');
        revalidate();
      }
      if (method === 'GET' && p === '/api/bootstrap') return respond(200, await bootstrap(user, auth?.identity));
      if (method === 'POST' && p === '/api/setup') {
        assert(!hasSetup(), 409, '이미 초기 설정이 끝났습니다. 로그인해 주세요.');
        rateLimit(req, 'setup');
        const body = await readBody();
        const input = accountInput(body);
        const name = textField(body.workspaceName, '워크스페이스 이름', 60, 1);
        const password = await passwordHash(input.password);
        const created = transaction(() => {
          assert(!hasSetup(), 409, '이미 초기 설정이 끝났습니다. 로그인해 주세요.');
          run("INSERT INTO settings(key,value) VALUES('workspace_name',?)", name);
          const owner = createUser(input, password, 'owner');
          ensureSystemChannels([owner.id]);
          return owner;
        });
        issueSession(res, created.id);
        return respond(201, await bootstrap(created));
      }
      if (method === 'POST' && p === '/api/login') {
        const body = await readBody();
        assert(typeof body.username === 'string' && typeof body.password === 'string' && body.password.length <= 128, 400, '아이디와 비밀번호를 입력해 주세요.');
        rateLimit(req, `login:${body.username.trim().toLowerCase()}`);
        const found = one('SELECT * FROM users WHERE username=?', body.username.trim());
        const encoded = found?.password || `${'0'.repeat(32)}:${'0'.repeat(128)}`;
        assert(await passwordMatches(body.password, encoded) && found, 401, '아이디 또는 비밀번호가 올바르지 않습니다.');
        issueSession(res, found.id);
        return respond(200, await bootstrap(found));
      }
      if (method === 'POST' && p === '/api/join') {
        rateLimit(req, 'join');
        const body = await readBody();
        const input = accountInput(body);
        const code = textField(body.code, '초대 코드', 100, 1).toUpperCase();
        const password = await passwordHash(input.password);
        const created = transaction(() => {
          const invitation = one('SELECT * FROM invites WHERE code_hash=?', hash(code));
          assert(invitation && !invitation.used_at && !invitation.revoked_at && invitation.expires_at > now(), 400, '사용할 수 없는 초대 코드입니다. 관리자에게 새 코드를 요청해 주세요.');
          const member = createUser(input, password, 'member');
          run('UPDATE invites SET used_at=? WHERE id=?', now(), invitation.id);
          return member;
        });
        issueSession(res, created.id);
        publish('member');
        return respond(201, await bootstrap(created));
      }
      if (p.startsWith('/api/')) {
        assert(user, 401, '로그인이 필요합니다.');
        if (method === 'GET' && p === '/api/tasks/create-options') return respond(200, directTasks.options(user.id));
        if (method === 'POST' && p === '/api/tasks') {
          const body = await readBody(), result = directTasks.create(user.id, body);
          return respond(result.created ? 201 : 200, result);
        }
        if (await collaboration.handle({ p, method, url, user, readBody, respond })) return;
        revalidate();
        if (method === 'POST' && p === '/api/logout') {
          run('DELETE FROM sessions WHERE token=?', auth.token);
          res.setHeader('Set-Cookie', 'synk_messenger_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
          for (const client of subscribers) if (client.token === auth.token) { client.res.end(); subscribers.delete(client); }
          return respond(200, { ok: true });
        }
        if (method === 'GET' && p === '/api/members') return respond(200, { members: members() });
        if (method === 'GET' && p === '/api/directory') return respond(200, { members: members(), teams: bridge?.teamsFor(user.id) || [] });
        if (p === '/api/invites' || p.startsWith('/api/invites/')) {
          assert(user.role === 'owner', 403, '관리자만 초대 코드를 관리할 수 있습니다.');
          if (method === 'POST' && p === '/api/invites') {
            const code = `${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`.toUpperCase();
            const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
            run('INSERT INTO invites(id,code_hash,created_at,expires_at) VALUES(?,?,?,?)', randomUUID(), hash(code), now(), expiresAt);
            return respond(201, { code, expiresAt });
          }
          if (method === 'GET' && p === '/api/invites') return respond(200, { invites: all('SELECT id,created_at AS createdAt,expires_at AS expiresAt,used_at AS usedAt,revoked_at AS revokedAt FROM invites ORDER BY created_at DESC') });
          if (method === 'DELETE' && /^\/api\/invites\/[^/]+$/.test(p)) {
            assert(run('UPDATE invites SET revoked_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL', now(), p.split('/')[3]).changes, 404, '취소할 수 있는 초대 코드를 찾을 수 없습니다.');
            return respond(200, { ok: true });
          }
        }
        if (method === 'GET' && p === '/api/channels') return respond(200, { channels: channelsFor(user.id) });
        if (method === 'GET' && p === '/api/channels/deleted') {
          const rows = all('SELECT c.* FROM channels c WHERE c.deleted_at IS NOT NULL AND (c.archived_by_leave=? OR EXISTS(SELECT 1 FROM memberships m WHERE m.channel_id=c.id AND m.user_id=?)) ORDER BY c.deleted_at DESC,c.id', user.id, user.id).filter(channel => canRestoreProject(channel, user.id));
          return respond(200, { channels: rows.map(channel => channelShape(channel, user.id)) });
        }
        const projectLeave = p.match(/^\/api\/channels\/([^/]+)\/leave$/);
        if (method === 'POST' && projectLeave) {
          await readBody();
          const channelId = projectLeave[1];
          // Repeating one's own completed departure is safe, without exposing a room to outsiders.
          if (!one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, user.id) && one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channelId, user.id)) return respond(200, { ok: true, newManagerId: null, archived: one('SELECT archived_by_leave FROM channels WHERE id=?', channelId)?.archived_by_leave === user.id });
          const channel = requireChannel(user.id, channelId);
          assert(projectChannel(channel), 403, '나가기는 프로젝트 대화방에서만 사용할 수 있습니다.');
          const result = transaction(() => {
            run('INSERT INTO channel_departures(channel_id,user_id,left_at) VALUES(?,?,?) ON CONFLICT(channel_id,user_id) DO UPDATE SET left_at=excluded.left_at,rejoined_at=NULL,revision=channel_departures.revision+1', channelId, user.id, now());
            run('DELETE FROM memberships WHERE channel_id=? AND user_id=?', channelId, user.id);
            const newManagerId = projectManager(channel);
            run('UPDATE channels SET creator_id=? WHERE id=?', newManagerId, channelId);
            const archived = channelMembers(channelId).length === 0;
            if (archived) run('UPDATE channels SET deleted_at=?,deleted_by=?,archived_by_leave=?,lifecycle_version=lifecycle_version+1 WHERE id=?', now(), user.id, user.id, channelId);
            return { newManagerId, archived };
          });
          for (const download of activeDownloads) if (download.channelId === channelId && download.userId === user.id) { download.stream.destroy(); download.res.destroy(); }
          publish('channel', channelId);
          publish('channel', null, user.id);
          return respond(200, { ok: true, ...result });
        }
        const projectLifecycle = p.match(/^\/api\/channels\/([^/]+)(\/restore)?$/);
        if (projectLifecycle && ((method === 'DELETE' && !projectLifecycle[2]) || (method === 'POST' && projectLifecycle[2]))) {
          if (method === 'POST') await readBody();
          const channel = one('SELECT c.* FROM channels c WHERE c.id=? AND (EXISTS(SELECT 1 FROM memberships m WHERE m.channel_id=c.id AND m.user_id=?) OR (?=1 AND c.archived_by_leave=?))', projectLifecycle[1], user.id, method === 'POST' ? 1 : 0, user.id);
          assert(channel, 404, '대화방을 찾을 수 없습니다.');
          assert(method === 'POST' ? canRestoreProject(channel, user.id) : managedProject(channel, user.id), 403, '참여 중인 프로젝트의 생성자나 관리자만 대화방을 삭제하거나 복원할 수 있습니다.');
          if (method === 'DELETE') {
            if (!channel.deleted_at) {
              run('UPDATE channels SET deleted_at=?,deleted_by=?,lifecycle_version=lifecycle_version+1 WHERE id=? AND deleted_at IS NULL', now(), user.id, channel.id);
              for (const download of activeDownloads) if (download.channelId === channel.id) { download.stream.destroy(); download.res.destroy(); }
              publish('channel', channel.id);
            }
            return respond(200, { ok: true });
          }
          if (channel.deleted_at) {
            transaction(() => {
              if (channel.scope === 'public') {
                const activeIds = members().filter(member => (channel.archived_by_leave === user.id && member.id === user.id) || !one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channel.id, member.id)).map(member => member.id);
                // A public restoration admits current crew, including people who joined while it was deleted.
                verifyProjectHistoryAudience(channel, user.id, activeIds, 'restore');
                for (const id of activeIds) run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, id);
              }
              if (channel.archived_by_leave === user.id) {
                if (channel.scope !== 'public') verifyProjectHistoryAudience(channel, user.id, [...new Set([...channelMembers(channel.id).map(member => member.id), user.id])], 'restore');
                run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, user.id);
                run('UPDATE channel_departures SET rejoined_at=? WHERE channel_id=? AND user_id=?', now(), channel.id, user.id);
              }
              run('UPDATE channels SET deleted_at=NULL,deleted_by=NULL,archived_by_leave=NULL,lifecycle_version=lifecycle_version+1 WHERE id=?', channel.id);
              run('UPDATE channels SET creator_id=? WHERE id=?', projectManager(one('SELECT * FROM channels WHERE id=?', channel.id)), channel.id);
            });
            publish('channel', channel.id);
          }
          return respond(200, { channel: channelShape(one('SELECT * FROM channels WHERE id=?', channel.id), user.id) });
        }
        const teamChannel = p.match(/^\/api\/teams\/([^/]+)\/channel$/);
        if (method === 'POST' && teamChannel) {
          await readBody();
          const teamId = teamChannel[1];
          assert(bridge?.inTeam(teamId, user.id), 404, '참여할 수 있는 회사 팀을 찾을 수 없습니다.');
          const team = bridge.teamsFor(user.id).find(team => team.id === teamId);
          const existing = one("SELECT * FROM channels WHERE scope='team' AND team_id=?", teamId);
          const channel = existing || transaction(() => createChannel(team.name, '현재 이 팀에 소속된 구성원만 참여하는 대화입니다.', 'channel', bridge.teamMembers(teamId), null, 'team', user.id, teamId));
          if (!existing) publish('channel', channel.id);
          return respond(existing ? 200 : 201, { channel: channelShape(channel, user.id) });
        }
        if (method === 'POST' && p === '/api/channels') {
          const body = await readBody();
          assert(body.systemKey === undefined, 400, '기본 대화방 표시는 직접 지정할 수 없습니다.');
          assert(body.teamId === undefined, 400, '팀 전용 대화는 회사 팀 목록에서 열어 주세요.');
          const name = textField(body.name, '채널 이름', 40, 1);
          const description = textField(body.description ?? '', '설명', 200);
          const category = body.category ?? 'generic';
          assert(CHANNEL_CATEGORIES.has(category), 400, '일반·팀·프로젝트 중 대화방 분류를 선택해 주세요.');
          const scope = body.scope ?? (category === 'project' ? 'private' : 'public');
          assert(scope === 'public' || (scope === 'private' && category === 'project'), 400, '선택한 크루만 참여하는 대화방은 프로젝트로 만들어 주세요.');
          assert(scope === 'private' || body.memberIds === undefined, 400, '전체 공개 대화방에는 이미 모든 크루가 참여합니다. 크루를 선택하려면 프로젝트 참여 범위를 선택해 주세요.');
          const memberIds = scope === 'private' ? [...new Set([user.id, ...selectedMemberIds(body.memberIds ?? [])])] : members().map(m => m.id);
          const channel = transaction(() => createChannel(name, description, 'channel', memberIds, null, category, user.id, null, scope));
          publish('channel', channel.id);
          return respond(201, { channel: channelShape(channel, user.id) });
        }
        const participants = p.match(/^\/api\/channels\/([^/]+)\/members$/);
        if (participants && (method === 'GET' || method === 'POST')) {
          // Recheck after the body has arrived; an earlier membership must not authorize a delayed request.
          const body = method === 'POST' ? await readBody() : null;
          const channel = requireChannel(user.id, participants[1]);
          if (method === 'GET') return respond(200, { channel: channelShape(channel, user.id), members: channelMembers(channel.id) });
          assert(channel.scope !== 'public' || projectChannel(channel), 409, '이 대화방에는 이미 모든 크루가 참여하고 있습니다. 선택한 크루만 초대하려면 새로운 프로젝트 대화방을 만들어 주세요.');
          assert(projectChannel(channel) && canManageChannel(channel, user.id), 403, '이 프로젝트에 참여 중인 대화방 생성자나 관리자만 크루를 초대할 수 있습니다.');
          const ids = selectedMemberIds(body.memberIds);
          const currentIds = channelMembers(channel.id).map(member => member.id);
          const addedIds = ids.filter(id => !currentIds.includes(id));
          if (channel.scope === 'public') assert(addedIds.length && addedIds.every(id => one('SELECT 1 FROM channel_departures WHERE channel_id=? AND user_id=? AND rejoined_at IS NULL', channel.id, id)), 409, '이 대화방에는 이미 모든 크루가 참여하고 있습니다. 나간 크루만 다시 초대할 수 있습니다.');
          if (addedIds.length) transaction(() => {
            verifyProjectHistoryAudience(channel, user.id, [...currentIds, ...addedIds]);
            for (const id of addedIds) {
              run('INSERT OR IGNORE INTO memberships(channel_id,user_id) VALUES(?,?)', channel.id, id);
              run('UPDATE channel_departures SET rejoined_at=? WHERE channel_id=? AND user_id=?', now(), channel.id, id);
            }
          });
          if (addedIds.length) publish('channel', channel.id);
          return respond(200, { channel: channelShape(channel, user.id), members: channelMembers(channel.id), addedIds });
        }
        if (method === 'PATCH' && /^\/api\/channels\/[^/]+$/.test(p)) {
          const body = await readBody();
          const channel = requireChannel(user.id, p.split('/')[3]);
          assert(!channel.system_key && body.systemKey === undefined, 403, '기본 대화방의 이름과 설정은 변경할 수 없습니다.');
          assert(canManageChannel(channel, user.id), 403, '대화방에 참여 중인 생성자나 관리자만 대화방 정보를 변경할 수 있습니다.');
          assert((body.scope === undefined || body.scope === channel.scope) && body.teamId === undefined && body.memberIds === undefined, 400, '기존 대화방의 참여 범위는 변경할 수 없습니다. 크루 추가는 초대 메뉴를 이용해 주세요.');
          const name = body.name === undefined ? channel.name : textField(body.name, '채널 이름', 40, 1);
          const description = body.description === undefined ? channel.description : textField(body.description, '설명', 200);
          const category = body.category === undefined ? channel.category : body.category;
          assert(CHANNEL_CATEGORIES.has(category), 400, '일반·팀·프로젝트 중 대화방 분류를 선택해 주세요.');
          assert(!selectedProject(channel) || category === 'project', 400, '선택한 크루만 참여하는 프로젝트의 분류는 변경할 수 없습니다.');
          run('UPDATE channels SET name=?,description=?,category=? WHERE id=?', name, description, category, channel.id);
          publish('channel', channel.id);
          return respond(200, { channel: channelShape(one('SELECT * FROM channels WHERE id=?', channel.id), user.id) });
        }
        if (method === 'POST' && p === '/api/dms') {
          const body = await readBody();
          assert(typeof body.userId === 'string' && members().some(member => member.id === body.userId), 404, '구성원을 찾을 수 없습니다.');
          if (body.userId === user.id) {
            const self = one('SELECT * FROM channels WHERE pair_key=?', `self:${user.id}`);
            return respond(200, { channel: channelShape(self, user.id) });
          }
          const pair = [user.id, body.userId].sort().join(':');
          const existing = one('SELECT * FROM channels WHERE pair_key=?', pair);
          const channel = existing || transaction(() => createChannel('개인 대화', '두 사람만 볼 수 있는 대화', 'dm', [user.id, body.userId], pair));
          if (!existing) publish('channel', channel.id);
          return respond(existing ? 200 : 201, { channel: channelShape(channel, user.id) });
        }
        let match = p.match(/^\/api\/channels\/([^/]+)\/(messages|files)\/requests\/([^/]+)$/);
        if (match && ['GET', 'DELETE'].includes(method)) {
          const [, channelId, action, rawId] = match;
          requirePosting(user.id, channelId);
          const id = requestId(rawId, '전송');
          if (method === 'DELETE' && action === 'files') {
            const file = transaction(() => {
              const existing = one('SELECT * FROM file_upload_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, id);
              const savedFile = existing?.file_id && one('SELECT * FROM files WHERE id=?', existing.file_id);
              if (savedFile && savedFile.message_id !== null) throw recoveryError('UPLOAD_CONSUMED', '이미 메시지에 첨부한 파일은 전송 취소로 삭제할 수 없습니다.');
              if (savedFile) { recordFileCancellation(savedFile, user.id); queueFileDeletion(savedFile); run('DELETE FROM files WHERE id=?', savedFile.id); }
              // Pending means no file record was committed. Stop future commits and leave
              // any remote-cleanup outbox intact; cancellation does not promise Drive deletion.
              if (existing) run("UPDATE file_upload_requests SET state='cancelled' WHERE user_id=? AND channel_id=? AND request_id=?", user.id, channelId, id);
              else run("INSERT INTO file_upload_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'cancelled',?)", user.id, channelId, id, '', now());
              return savedFile;
            });
            if (file?.storage_provider === 'local') await removeDiskFile(file.disk_name);
            if (file) await retryDriveDeletions();
            return respond(200, { status: 'cancelled' });
          }
          const receipt = method === 'DELETE' ? transaction(() => {
            const existing = one('SELECT * FROM message_send_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, id);
            if (existing) return existing;
            run("INSERT INTO message_send_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'cancelled',?)", user.id, channelId, id, '', now());
            return { state: 'cancelled' };
          }) : one(`SELECT * FROM ${action === 'messages' ? 'message_send_requests' : 'file_upload_requests'} WHERE user_id=? AND channel_id=? AND request_id=?`, user.id, channelId, id);
          if (method === 'DELETE' && receipt.state === 'cancelled') return respond(200, { status: 'cancelled' });
          assert(receipt, 404, '저장된 전송 결과가 없습니다. 같은 내용으로 다시 시도할 수 있습니다.');
          if (action === 'messages') return respond(200, sentRequestResult(receipt, user.id));
          const file = uploadedRequestFile(receipt, JSON.stringify([user.id, channelId, id]));
          if (!file) throw Object.assign(new AppError(404, '파일 저장이 완료되지 않았습니다. 같은 파일로 다시 시도해 주세요.'), { code: 'UPLOAD_NOT_COMPLETE' });
          return respond(200, { status: 'uploaded', file: fileShape(file) });
        }
        match = p.match(/^\/api\/channels\/([^/]+)\/(messages|read|files|pins)$/);
        if (match) {
          const channelId = match[1]; const action = match[2];
          requireChannel(user.id, channelId);
          if (action === 'pins' && method === 'GET') {
            const rows = all('SELECT m.* FROM messages m JOIN message_pins p ON p.message_id=m.id WHERE m.channel_id=? ORDER BY p.created_at DESC,m.id DESC', channelId);
            return respond(200, { messages: rows.map(message => messageShape(message, user.id)) });
          }
          if (action === 'messages' && method === 'GET') {
            const requested = url.searchParams.get('limit');
            const limit = requested === null ? 50 : Number(requested);
            assert(Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '한 번에 1~100개 메시지를 읽을 수 있습니다.');
            const before = url.searchParams.get('before');
            if (before !== null) {
              assert(/^\d+$/.test(before) && one('SELECT 1 FROM messages WHERE id=? AND channel_id=?', before, channelId), 400, '이전 메시지 위치가 올바르지 않습니다.');
            }
            const rows = all('SELECT * FROM messages WHERE channel_id=? AND id<? ORDER BY id DESC LIMIT ?', channelId, before ? Number(before) : Number.MAX_SAFE_INTEGER, limit + 1);
            return respond(200, { messages: rows.slice(0, limit).reverse().map(m => messageShape(m, user.id)), hasMore: rows.length > limit });
          }
          if (action === 'read' && method === 'POST') {
            const body = await readBody();
            requireChannel(user.id, channelId);
            let lastRead = one('SELECT COALESCE(MAX(id),0) AS id FROM messages WHERE channel_id=?', channelId).id;
            if (body.messageId !== undefined) {
              assert(typeof body.messageId === 'string' && /^[1-9]\d*$/.test(body.messageId) && Number.isSafeInteger(Number(body.messageId)) && one('SELECT 1 FROM messages WHERE id=? AND channel_id=?', body.messageId, channelId), 400, '화면에서 읽은 메시지 위치를 확인해 주세요.');
              lastRead = Number(body.messageId);
            }
            run('UPDATE memberships SET last_read=MAX(last_read,?) WHERE channel_id=? AND user_id=?', lastRead, channelId, user.id);
            publish('read', channelId, user.id);
            return respond(200, { ok: true });
          }
          if (action === 'files' && method === 'POST') return respond(201, { file: await upload(req, res, user, channelId, revalidate) });
          if (action === 'messages' && method === 'POST') {
            requirePosting(user.id, channelId);
            const body = await readBody();
            const channel = requirePosting(user.id, channelId);
            const content = textField(body.body ?? '', '메시지', 8000);
            const fileIds = body.fileIds ?? [];
            assert(Array.isArray(fileIds) && fileIds.length <= 5 && fileIds.every(id => typeof id === 'string') && new Set(fileIds).size === fileIds.length, 400, '파일은 메시지당 최대 5개까지 첨부할 수 있습니다.');
            const mentionIds = body.mentionIds ?? [];
            assert(Array.isArray(mentionIds) && mentionIds.length <= 30 && mentionIds.every(id => typeof id === 'string') && new Set(mentionIds).size === mentionIds.length, 400, '멘션할 크루를 최대 30명까지 선택해 주세요.');
            const replyToId = body.replyToId ?? null;
            if (replyToId !== null) {
              assert(typeof replyToId === 'string' && /^[1-9]\d*$/.test(replyToId) && Number.isSafeInteger(Number(replyToId)), 400, '답글을 달 메시지를 확인해 주세요.');
            }
            const clientMessageId = body.clientMessageId === undefined ? null : requestId(body.clientMessageId, '메시지 전송');
            const fingerprint = clientMessageId ? hash(JSON.stringify(canonical({ content, fileIds: [...fileIds].sort(), replyToId, mentionIds: [...mentionIds].sort(), workspaceLink: body.workspaceLink ?? null, ackRequired: body.ackRequired ?? (channel.system_key === 'announcements') }))) : null;
            // Resolve retries before consumed-file or deleted-parent checks. The receipt and
            // original message are committed together; a deleted original retains a tombstone.
            const prior = clientMessageId && one('SELECT * FROM message_send_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, clientMessageId);
            if (prior) {
              if (prior.state === 'cancelled') throw recoveryError('MESSAGE_CANCELLED', '취소한 전송입니다. 같은 식별자로 다시 보내지 않습니다.');
              if (prior.payload_hash !== fingerprint) throw recoveryError('MESSAGE_REQUEST_CONFLICT', '같은 전송 식별자로 다른 메시지를 보낼 수 없습니다.');
              return respond(200, { ...sentRequestResult(prior, user.id), replayed: true });
            }
            const extras = collaboration.prepareMessage(body, channel, user.id, null, integration?.origin || `http://${req.headers.host}`);
            assert(content || fileIds.length || extras.workspaceLink, 400, '메시지를 입력하거나 파일 또는 화면 링크를 첨부해 주세요.');
            if (replyToId !== null) assert(one('SELECT id FROM messages WHERE id=? AND channel_id=?', replyToId, channelId), 404, '이 대화방에서 답글을 달 메시지를 찾을 수 없습니다.');
            const created = transaction(() => {
              for (const id of fileIds) assert(one('SELECT 1 FROM files WHERE id=? AND channel_id=? AND uploader_id=? AND message_id IS NULL', id, channelId, user.id), 400, '첨부할 수 없는 파일이 있습니다. 파일을 다시 올려 주세요.');
              const id = Number(run('INSERT INTO messages(channel_id,user_id,body,created_at,reply_to_id) VALUES(?,?,?,?,?)', channelId, user.id, content, now(), replyToId === null ? null : Number(replyToId)).lastInsertRowid);
              for (const fileId of fileIds) run('UPDATE files SET message_id=? WHERE id=?', id, fileId);
              collaboration.applyMessage(id, extras);
              if (clientMessageId) run('INSERT INTO message_send_requests(user_id,channel_id,request_id,payload_hash,message_id,created_at) VALUES(?,?,?,?,?,?)', user.id, channelId, clientMessageId, fingerprint, id, now());
              return one('SELECT * FROM messages WHERE id=?', id);
            });
            collaboration.notifyMessage(created);
            publish('message', channelId);
            return respond(201, { message: messageShape(created, user.id) });
          }
        }
        match = p.match(/^\/api\/messages\/(\d+)(\/(?:reactions|pin|replies))?$/);
        if (match) {
          let message = requireMessage(match[1], user.id);
          if (method === 'GET' && !match[2]) return respond(200, { message: messageShape(message, user.id) });
          if (method === 'GET' && match[2] === '/replies') {
            const limit = Number(url.searchParams.get('limit') ?? 50);
            const before = url.searchParams.get('before');
            assert(Number.isInteger(limit) && limit >= 1 && limit <= 100, 400, '한 번에 1~100개 답글을 읽을 수 있습니다.');
            if (before !== null) assert(/^[1-9]\d*$/.test(before) && one('SELECT 1 FROM messages WHERE id=? AND channel_id=? AND reply_to_id=?', before, message.channel_id, message.id), 400, '이전 답글 위치가 올바르지 않습니다.');
            const rows = all('SELECT * FROM messages WHERE reply_to_id=? AND channel_id=? AND id<? ORDER BY id DESC LIMIT ?', message.id, message.channel_id, before ? Number(before) : Number.MAX_SAFE_INTEGER, limit + 1);
            return respond(200, { parent: messageShape(message, user.id), messages: rows.slice(0, limit).reverse().map(reply => messageShape(reply, user.id)), hasMore: rows.length > limit });
          }
          if (match[2] === '/pin' && ['POST', 'DELETE'].includes(method)) {
            if (method === 'POST') await readBody();
            message = requireMessage(match[1], user.id);
            requirePosting(user.id, message.channel_id);
            if (method === 'POST') {
              assert(one('SELECT 1 FROM message_pins WHERE message_id=?', message.id) || one('SELECT COUNT(*) AS n FROM message_pins p JOIN messages m ON m.id=p.message_id WHERE m.channel_id=?', message.channel_id).n < 50, 409, '대화방마다 중요한 메시지를 최대 50개까지 고정할 수 있습니다.');
              run('INSERT OR IGNORE INTO message_pins(message_id,user_id,created_at) VALUES(?,?,?)', message.id, user.id, now());
            } else run('DELETE FROM message_pins WHERE message_id=?', message.id);
            publish('message', message.channel_id);
            return respond(200, { message: messageShape(message, user.id) });
          }
          if (method === 'POST' && match[2] === '/reactions') {
            const body = await readBody();
            message = requireMessage(match[1], user.id);
            assert(EMOJI.has(body.emoji), 400, '지원하지 않는 반응입니다.');
            transaction(() => {
              const removed = run('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?', message.id, user.id, body.emoji);
              if (!removed.changes) run('INSERT INTO reactions(message_id,user_id,emoji) VALUES(?,?,?)', message.id, user.id, body.emoji);
            });
            publish('message', message.channel_id);
            return respond(200, { message: messageShape(message, user.id) });
          }
          if (method === 'PATCH' && !match[2]) {
            assert(message.user_id === user.id, 403, '내가 쓴 메시지만 수정할 수 있습니다.');
            const body = await readBody();
            message = requireMessage(match[1], user.id);
            const channel = requirePosting(user.id, message.channel_id);
            collaboration.productivity.assertMessageMutable(message.id);
            const content = textField(body.body, '메시지', 8000);
            const extras = collaboration.prepareMessage(body, channel, user.id, message, integration?.origin || `http://${req.headers.host}`);
            assert(content || extras.workspaceLink || one('SELECT id FROM files WHERE message_id=? LIMIT 1', message.id), 400, '빈 메시지로 수정할 수 없습니다.');
            transaction(() => { run('UPDATE messages SET body=?,edited_at=? WHERE id=?', content, now(), message.id); collaboration.applyMessage(message.id, extras, { edit: true }); });
            collaboration.notifyMessage(one('SELECT * FROM messages WHERE id=?', message.id), { edit: true });
            publish('message', message.channel_id);
            return respond(200, { message: messageShape(one('SELECT * FROM messages WHERE id=?', message.id), user.id) });
          }
          if (method === 'DELETE' && !match[2]) {
            const channel = requireChannel(user.id, message.channel_id);
            assert(message.user_id === user.id || (user.role === 'owner' && channel.kind === 'channel'), 403, '이 메시지를 삭제할 수 없습니다.');
            collaboration.productivity.assertMessageMutable(message.id);
            const files = all('SELECT * FROM files WHERE message_id=?', message.id);
            transaction(() => {
              for (const f of files) queueFileDeletion(f);
              run('DELETE FROM messages WHERE id=?', message.id);
            });
            for (const f of files) if (f.storage_provider === 'local') await removeDiskFile(f.disk_name);
            await retryDriveDeletions();
            publish('message', message.channel_id);
            return respond(200, { ok: true });
          }
        }
        if (method === 'GET' && p === '/api/files') {
          const channelId = url.searchParams.get('channelId');
          if (channelId) requireChannel(user.id, channelId);
          const query = textField(url.searchParams.get('q') ?? '', '파일 검색어', 200);
          const type = url.searchParams.get('type') || 'all';
          const uploaderId = url.searchParams.get('uploaderId') || null;
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 200);
          assert(type === 'all' || type === 'other' || Object.hasOwn(FILE_EXTENSIONS, type), 400, '파일 종류를 확인해 주세요.');
          assert(uploaderId === null || uploaderId.length <= 100, 400, '파일을 올린 사람을 확인해 주세요.');
          assert(Number.isSafeInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 200, 400, '파일 목록 위치와 개수를 확인해 주세요.');
          const escaped = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
          const rows = all(`SELECT f.* FROM files f JOIN memberships c ON c.channel_id=f.channel_id AND c.user_id=? JOIN channels r ON r.id=f.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1) AND f.message_id IS NOT NULL AND (? IS NULL OR f.channel_id=?) AND f.name LIKE ? ESCAPE '\\' AND (? IS NULL OR f.uploader_id=?) AND (?='all' OR (${FILE_TYPE_SQL})=?) ORDER BY f.created_at DESC,f.id DESC LIMIT ? OFFSET ?`, user.id, bridge ? 1 : 0, channelId, channelId, escaped, uploaderId, uploaderId, type, type, limit + 1, offset);
          return respond(200, { files: rows.slice(0, limit).map(fileShape), hasMore: rows.length > limit, nextOffset: rows.length > limit ? offset + limit : null });
        }
        match = p.match(/^\/api\/files\/([^/]+)$/);
        if (match) {
          const f = one('SELECT * FROM files WHERE id=?', match[1]);
          if (!f && method === 'DELETE') {
            const receipt = one('SELECT channel_id FROM file_deletion_receipts WHERE user_id=? AND file_id=?', user.id, match[1]);
            if (receipt) {
              requireChannel(user.id, receipt.channel_id);
              throw Object.assign(new AppError(404, '이미 취소한 첨부파일입니다.'), { code: 'UPLOAD_DELETED' });
            }
          }
          assert(f, 404, '파일을 찾을 수 없습니다.');
          const lifecycleVersion = requireChannel(user.id, f.channel_id).lifecycle_version;
          const membershipVersion = departureVersion(f.channel_id, user.id);
          assert(f.message_id !== null || f.uploader_id === user.id, 404, '파일을 찾을 수 없습니다.');
          if (method === 'DELETE') {
            assert(f.uploader_id === user.id, 403, '아직 전송하지 않은 내 파일만 취소할 수 있습니다.');
            if (f.message_id !== null) throw recoveryError('UPLOAD_CONSUMED', '이미 전송된 첨부파일은 대화에 그대로 남겨 둡니다.');
            transaction(() => { recordFileCancellation(f, user.id); queueFileDeletion(f); run('DELETE FROM files WHERE id=?', f.id); });
            if (f.storage_provider === 'local') await removeDiskFile(f.disk_name);
            await retryDriveDeletions();
            return respond(200, { ok: true });
          }
          if (method === 'GET') {
            let stream;
            if (f.storage_provider === 'google-drive') {
              stream = await drive.download({ connectionId: f.storage_connection_id, remoteId: f.storage_remote_id, fileId: f.id, expectedSize: f.size, expectedMd5: f.md5 });
            } else {
              const filePath = path.join(uploadDir, f.disk_name);
              let handle;
              try { handle = await open(filePath, 'r'); } catch { throw new AppError(404, '저장된 파일을 찾을 수 없습니다.'); }
              stream = handle.createReadStream();
            }
            try {
              revalidate();
              assert(requireChannel(user.id, f.channel_id).lifecycle_version === lifecycleVersion, 409, '대화방이 삭제 또는 복원되었습니다. 파일을 다시 열어 주세요.');
              assert(departureVersion(f.channel_id, user.id) === membershipVersion, 409, '프로젝트 참여 상태가 변경되었습니다. 파일을 다시 열어 주세요.');
            } catch (error) { stream.destroy(); throw error; }
            const download = { channelId: f.channel_id, userId: user.id, stream, res };
            activeDownloads.add(download);
            res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': f.size, 'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`, 'Content-Security-Policy': "default-src 'none'; sandbox" });
            try { await pipeline(stream, res); } finally { activeDownloads.delete(download); }
            return;
          }
        }
        if (method === 'GET' && p === '/api/storage/drive') {
          assert(user.role === 'owner', 403, '관리자만 Drive 연결 정보를 확인할 수 있습니다.');
          return respond(200, await driveStatus({ fresh: true }));
        }
        if (method === 'POST' && p === '/api/storage/drive/active') {
          assert(user.role === 'owner', 403, '관리자만 파일 저장 위치를 변경할 수 있습니다.');
          const body = await readBody();
          assert(body.connectionId === null || (typeof body.connectionId === 'string' && body.connectionId.length > 0 && body.connectionId.length <= 200), 400, '등록된 Drive 연결을 선택해 주세요.');
          const status = await drive.setActive(body.connectionId, { beforeCommit: revalidate });
          publish('storage');
          return respond(200, { ...status, pendingDeletions: pendingDeletions() });
        }
        if (method === 'GET' && p === '/api/storage') {
          const owner = user.role === 'owner';
          const provider = await drive.active() ? 'google-drive' : 'local';
          const driveInfo = owner ? await driveStatus() : null;
          revalidate();
          const storage = owner && !integration ? one("SELECT COALESCE(SUM(f.size),0) AS bytes,COUNT(*) AS fileCount FROM files f JOIN channels r ON r.id=f.channel_id WHERE r.deleted_at IS NULL AND r.scope<>'team' AND (r.kind<>'channel' OR (r.scope<>'private' AND r.category<>'project') OR EXISTS(SELECT 1 FROM memberships c WHERE c.channel_id=r.id AND c.user_id=?))", user.id) : one("SELECT COALESCE(SUM(f.size),0) AS bytes,COUNT(*) AS fileCount FROM files f JOIN memberships c ON c.channel_id=f.channel_id AND c.user_id=? JOIN channels r ON r.id=f.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1) AND (f.message_id IS NOT NULL OR f.uploader_id=?)", user.id, bridge ? 1 : 0, user.id);
          const messageCount = owner && !integration ? one("SELECT COUNT(*) AS n FROM messages m JOIN channels r ON r.id=m.channel_id WHERE r.deleted_at IS NULL AND r.scope<>'team' AND (r.kind<>'channel' OR (r.scope<>'private' AND r.category<>'project') OR EXISTS(SELECT 1 FROM memberships c WHERE c.channel_id=r.id AND c.user_id=?))", user.id).n : one("SELECT COUNT(*) AS n FROM messages m JOIN memberships c ON c.channel_id=m.channel_id AND c.user_id=? JOIN channels r ON r.id=m.channel_id WHERE r.deleted_at IS NULL AND (r.scope<>'team' OR ?=1)", user.id, bridge ? 1 : 0).n;
          return respond(200, { ...storage, messageCount, memberCount: one('SELECT COUNT(*) AS n FROM users').n, provider, ...(owner ? { drive: driveInfo } : {}) });
        }
        if (method === 'GET' && p === '/api/events') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write('retry: 2000\n: connected\n\n');
          const client = { res, userId: user.id, token: auth.token, req, accessKey: bridge?.accessKey(user.id) };
          subscribers.add(client);
          const heartbeat = setInterval(() => {
            if (!validSubscriber(client)) { res.end(); return; }
            res.write(': keepalive\n\n');
          }, 20000);
          heartbeat.unref();
          res.on('close', () => { clearInterval(heartbeat); subscribers.delete(client); });
          return;
        }
        throw new AppError(404, '요청한 기능을 찾을 수 없습니다.');
      }
      assert(method === 'GET' || method === 'HEAD', 405, '허용되지 않은 요청 방식입니다.');
      let relative;
      try { relative = decodeURIComponent(p); } catch { throw new AppError(400, '올바르지 않은 주소입니다.'); }
      assert(!relative.includes('\0') && !relative.includes('\\'), 404, '파일을 찾을 수 없습니다.');
      const publicDir = path.join(ROOT, 'public');
      const staticPath = path.resolve(publicDir, `.${relative === '/' ? '/index.html' : relative}`);
      assert(staticPath.startsWith(`${publicDir}${path.sep}`), 404, '파일을 찾을 수 없습니다.');
      let info;
      try { info = await stat(staticPath); } catch { throw new AppError(404, '파일을 찾을 수 없습니다.'); }
      assert(info.isFile(), 404, '파일을 찾을 수 없습니다.');
      if (basePath && ['.html', '.css'].includes(path.extname(staticPath))) {
        let content = await readFile(staticPath, 'utf8');
        content = content.replace(/((?:src|href)=["'])\/(?!\/)/g, `$1${basePath}/`).replace(/(url\(["']?)\/assets\//g, `$1${basePath}/assets/`);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(staticPath)], 'Content-Length': Buffer.byteLength(content) });
        res.end(method === 'HEAD' ? undefined : content);
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(staticPath).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size });
      if (method === 'HEAD') { res.end(); return; }
      await pipeline(createReadStream(staticPath), res);
    } catch (error) {
      if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
      if (!(error instanceof AppError) && !error.publicMessage) console.error('[messenger] Request failed:', error.code || error.name);
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      json(res, status, { error: error instanceof AppError ? error.message : typeof error.publicMessage === 'string' ? error.publicMessage : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', ...(error.code === 'SYNK_WORK_NOTIFICATIONS_PAUSED' || /^(MESSAGE_|UPLOAD_)/.test(error.code || '') ? { code: error.code } : {}), ...(error.recoveryStatus ? { status: error.recoveryStatus, retryable: error.retryable } : {}) });
    }
  };
  const server = http.createServer(handler);
  server.requestTimeout = 5 * 60000;
  server.headersTimeout = 30000;
  server.keepAliveTimeout = 5000;

  let initialized = false;
  async function initialize() {
      if (initialized || closed) return;
      initialized = true;
      // A crash may leave an incomplete upload. Remove only generated files absent from the database.
      const known = new Set(all("SELECT disk_name FROM files WHERE storage_provider='local'").map(f => f.disk_name));
      for (const name of await readdir(uploadDir)) if (/^[a-f0-9-]{36}\.bin$/.test(name) && !known.has(name)) await removeDiskFile(name);
      syncDirectory();
      if (backgroundJobsEnabled) {
        deletionTimer = setInterval(() => { void retryDriveDeletions().catch(() => {}); }, 60000);
        deletionTimer.unref();
        void retryDriveDeletions().catch(() => {});
      }
      if (workNotificationsEnabled) {
        const remind = () => { if (closed) return; syncDirectory(); collaboration.deliverReminders(); };
        remind(); reminderTimer = setInterval(() => { try { remind(); } catch { console.error('[messenger] Reminder delivery will retry.'); } }, 15000); reminderTimer.unref();
      }
  }
  return {
    server, db, handler, startMounted: initialize, disconnectRevoked,
    notificationsForCompanyUser(companyUserId) {
      if (!bridge) return [];
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      return member ? collaboration.notificationsForPush(member.id) : [];
    },
    notifyCompanyUsers(companyUserIds) {
      if (!bridge || !Array.isArray(companyUserIds)) return;
      syncDirectory();
      const ids = new Set(companyUserIds);
      for (const member of members()) if (ids.has(bridge.companyUserId(member.id))) publish('notification', null, member.id);
    },
    weeklySummaryForCompanyUser(companyUserId, period) {
      assert(bridge, 403, '회사 작업실에서 확인해 주세요.');
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      assert(member, 403, '현재 회사 계정의 업무를 확인할 수 없습니다.');
      return collaboration.productivity.weeklySummary(member.id, period);
    },
    productivityOverview(req, kind, query = {}) {
      const auth = session(req); assert(auth, 401, '회사 계정으로 로그인해 주세요.');
      const service = collaboration.productivity;
      assert(['workday', 'catchUp', 'decisions'].includes(kind), 400, '확인할 업무 범위를 선택해 주세요.');
      return service[kind](auth.user.id, kind === 'decisions' ? new URLSearchParams(query) : query);
    },
    assistantDirectory(req, { include, query = '', completed = false } = {}) {
      const auth = session(req); assert(auth, 401, '회사 계정으로 로그인해 주세요.');
      const channels = channelsFor(auth.user.id).map(channel => ({ id: channel.id, name: channel.name, kind: channel.kind, scope: channel.scope }));
      const result = { channels, members: members().map(member => ({ id: member.id, name: member.name, teamName: member.teamName || null, companyUserId: bridge?.companyUserId(member.id) || null })) };
      if (!['files', 'tasks'].includes(include)) return result;
      const ids = channels.map(channel => channel.id); if (!ids.length) return { ...result, items: [], hasMore: false };
      const placeholders = ids.map(() => '?').join(','), pattern = `%${String(query).slice(0,200).replace(/[\\%_]/g, '\\$&')}%`;
      const rows = include === 'files'
        ? all(`SELECT id,name,channel_id,message_id FROM files WHERE channel_id IN (${placeholders}) AND message_id IS NOT NULL AND name LIKE ? ESCAPE '\\' ORDER BY created_at DESC,id DESC LIMIT 4`, ...ids, pattern)
        : all(`SELECT t.id,t.title,t.status,t.due_date,t.message_id,m.channel_id FROM message_tasks t JOIN messages m ON m.id=t.message_id WHERE m.channel_id IN (${placeholders}) AND t.assignee_id=? AND t.title LIKE ? ESCAPE '\\' AND ${completed ? "t.status='done'" : "t.status<>'done'"} ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,t.due_date,t.created_at DESC LIMIT 4`, ...ids, auth.user.id, pattern);
      return { ...result, hasMore: rows.length > 3, items: rows.slice(0,3).map(row => ({ id: row.id, title: row.name || row.title, channelId: row.channel_id, channelName: channels.find(channel => channel.id === row.channel_id)?.name || '', messageId: String(row.message_id), ...(include === 'tasks' ? { status: row.status, dueDate: row.due_date } : {}) })) };
    },
    workspaceShareTargets(req) {
      const auth = session(req); assert(auth, 401, '회사 계정으로 로그인해 주세요.');
      const people = members(), activeIds = new Set(people.map(member => member.id));
      return { channels: channelsFor(auth.user.id).filter(channel => channel.canPost).map(channel => ({ ...channel, companyUserIds: channel.memberIds.filter(id => activeIds.has(id)).map(id => bridge?.companyUserId(id)).filter(Boolean) })), members: people.map(member => ({ ...member, companyUserId: bridge?.companyUserId(member.id) || null })) };
    },
    endConnections() { for (const client of subscribers) client.res.end(); subscribers.clear(); },
    summary(req) {
      const auth = session(req);
      assert(auth, 401, '회사 계정으로 로그인해 주세요.');
      const channels = channelsFor(auth.user.id);
      return { href: `${basePath}/`, unread: channels.reduce((sum, channel) => sum + channel.unread, 0), notificationUnread: collaboration.unreadCount(auth.user.id), channels: channels.length };
    },
    async authenticateLinkedUsername(username, password) {
      if (!bridge || typeof username !== 'string' || typeof password !== 'string' || password.length > 128) return null;
      const row = one('SELECT u.*,l.company_user_id FROM users u JOIN company_identity_links l ON l.messenger_user_id=u.id WHERE u.username=?', username.trim());
      if (!row || !await passwordMatches(password, row.password)) return null;
      return row.company_user_id;
    },
    async listen() {
      assert(!integration, 400, '통합 메신저는 회사 서버에서 실행해야 합니다.');
      await initialize();
      await new Promise((resolve, reject) => {
        const onError = error => { server.off('listening', onListen); reject(error); };
        const onListen = () => { server.off('error', onError); resolve(); };
        server.once('error', onError); server.once('listening', onListen); server.listen(port, host);
      });
      listeningPort = server.address().port;
      return { url: `http://${host === '::1' ? '[::1]' : host}:${listeningPort}`, port: listeningPort };
    },
    async close() {
      if (closed) return;
      closed = true;
      clearInterval(deletionTimer);
      clearInterval(reminderTimer);
      for (const client of subscribers) client.res.end();
      subscribers.clear();
      if (server.listening) await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); });
      if (deletionTask) await deletionTask.catch(() => {});
      db.close();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createMessenger();
  app.listen().then(({ url }) => console.log(`SYNK 팀 메신저: ${url}`)).catch(error => { console.error(`실행하지 못했습니다: ${error.code || error.message}`); app.close().finally(() => process.exit(1)); });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (stopping) return; stopping = true;
    app.close().then(() => process.exit(0));
  });
}
