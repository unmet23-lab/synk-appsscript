import { dispatchRequest } from './routes/request-router.mjs';
import { createPublicAccountRoutes } from './routes/public-account.mjs';
import { createVoiceRoutes, personalVoiceMutation } from './routes/voice.mjs';
import { createMemberAccountRoutes } from './routes/member-account.mjs';
import { createChannelsRoutes } from './routes/channels.mjs';
import { createMessagesRoutes, messageReadMarker } from './routes/messages.mjs';
import { createFilesRoutes } from './routes/files.mjs';
import { createEventsRoutes } from './routes/events.mjs';
import { initializeMessengerBaseSchema, initializeCollaborationSchema } from './messenger-schema.mjs';
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
import { voiceOptionsFromEnv } from './voice-livekit.mjs';
import { createVoiceService } from './voice-service.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const scrypt = promisify(scryptCallback);
const FILE_LIMIT = 100 * 1024 * 1024;
const SESSION_MS = 7 * 86400000;
const EMOJI = new Set(['👍', '❤️', '✅', '👀', '🎉']);
const CHANNEL_CATEGORIES = new Set(['generic', 'team', 'project']);
// Team rooms always carry this default (no one can edit it). Rooms made before 2026-10-20 stored the older wording.
const TEAM_CHANNEL_DESCRIPTION = '우리 팀 크루만 보는 대화방';
const LEGACY_TEAM_CHANNEL_DESCRIPTION = '현재 이 팀에 소속된 구성원만 참여하는 대화입니다.';
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
  assert(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 400, `${label} 정보를 읽지 못했어요. 새로고침한 뒤 다시 해 주세요.`);
  return value.toLowerCase();
}
function recoveryError(code, message, details = {}) { return Object.assign(new AppError(409, message), { code, ...details }); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function textField(value, label, max, min = 0) {
  assert(typeof value === 'string', 400, `‘${label}’ 칸을 채워 주세요.`);
  const text = value.trim();
  assert(text.length >= min && text.length <= max, 400, `‘${label}’ 칸에는 ${min ? `${min}~${max}자를 적어 주세요` : `${max}자까지 적을 수 있어요`}.`);
  return text;
}
function accountInput(body) {
  const name = textField(body.name, '이름', 40, 1);
  const username = textField(body.username, '아이디', 32, 3).toLowerCase();
  assert(/^[a-z0-9_.-]{3,32}$/.test(username), 400, '아이디는 영문·숫자·점·밑줄·하이픈으로만 적어 주세요.');
  assert(typeof body.password === 'string' && body.password.length >= 10 && body.password.length <= 128, 400, '비밀번호는 10~128자로 정해 주세요.');
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
    throw new AppError(413, '보낸 내용이 너무 커요. 줄여서 다시 보내 주세요.');
  }
  const parts = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= 65536) parts.push(chunk);
  }
  assert(size <= 65536, 413, '보낸 내용이 너무 커요. 줄여서 다시 보내 주세요.');
  try {
    const body = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
    assert(body && typeof body === 'object' && !Array.isArray(body), 400, '요청 형식이 맞지 않아요. 새로고침한 뒤 다시 해 주세요.');
    return body;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, '요청 내용을 읽지 못했어요. 새로고침한 뒤 다시 해 주세요.');
  }
}

async function voiceWebhookBody(req) {
  assert((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() === 'application/webhook+json', 415, '통화 이벤트 형식을 확인해 주세요.');
  if (Number(req.headers['content-length']) > 65536) { req.resume(); throw new AppError(413, '보낸 내용이 너무 커요. 줄여서 다시 보내 주세요.'); }
  const parts = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size <= 65536) parts.push(chunk); }
  assert(size <= 65536, 413, '보낸 내용이 너무 커요. 줄여서 다시 보내 주세요.');
  return Buffer.concat(parts);
}

export function createMessenger({ dataDir = process.env.MESSENGER_DATA_DIR || path.join(ROOT, 'data'), port = Number(process.env.MESSENGER_PORT || 4197), host = '127.0.0.1', driveStorage, integration = null, basePath = '', platformUrl = process.env.SYNK_PLATFORM_URL, backgroundJobsEnabled = true, workNotificationsEnabled = backgroundJobsEnabled, staticResponderFactory = null, publicFile = file => file, voice = voiceOptionsFromEnv() } = {}) {
  assert(typeof backgroundJobsEnabled === 'boolean', 400, '백그라운드 작업 설정은 boolean이어야 합니다.');
  assert(typeof workNotificationsEnabled === 'boolean', 400, '업무 알림 설정은 boolean이어야 합니다.');
  // This first version is deliberately local-only. Network deployment needs TLS and an explicit hosting design.
  assert(integration || ['127.0.0.1', '::1', 'localhost'].includes(host), 400, '현재 버전은 이 컴퓨터에서만 실행할 수 있습니다.');
  assert(basePath === '' || basePath === '/messenger', 400, '메신저 경로 설정을 확인해 주세요.');
  assert(Number.isInteger(port) && port >= 0 && port <= 65535, 400, '포트 번호가 올바르지 않습니다.');
  assert(staticResponderFactory === null || typeof staticResponderFactory === 'function', 400, '정적 응답 설정을 확인해 주세요.');
  assert(typeof publicFile === 'function', 400, '정적 응답 설정을 확인해 주세요.');
  const versionedMessengerAssets=new Set(['/app.js','/styles.css','/messenger-design.css','/signal.css','/messenger-state.js','/messenger-session.js','/messenger-shell.js','/messenger-task-model.js']);
  // Hash and compress the final public bytes, including embedded CSS URLs.
  async function readPublicAsset(file) {
    const content = await readFile(file);
    if (!basePath || !['.html', '.css'].includes(path.extname(file))) return content;
    return Buffer.from(content.toString('utf8').replace(/((?:src|href)=["'])\/(?!\/)/g, `$1${basePath}/`).replace(/(url\(["']?)\/assets\//g, `$1${basePath}/assets/`));
  }
  const respondPublicStatic = staticResponderFactory?.({ read: readPublicAsset });
  const platformEntryUrl = resolvePlatformUrl(platformUrl, { origin: integration?.origin || `http://${host === '::1' ? '[::1]' : host}:${port}` });
  dataDir = path.resolve(dataDir);
  const uploadDir = path.join(dataDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const drive = driveStorage ?? createDriveStorage({ dataDir });
  const db = new DatabaseSync(path.join(dataDir, 'messenger.sqlite'));
  initializeMessengerBaseSchema(db, { teamDescription: TEAM_CHANNEL_DESCRIPTION, legacyTeamDescription: LEGACY_TEAM_CHANNEL_DESCRIPTION });
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
  initializeCollaborationSchema(db);
  const collaboration = createCollaborationService({ db, assert, textField, now, transaction, members, requireChannel, requireMessage, requirePosting, messageShape: baseMessageShape, publish, fileTypeSql: FILE_TYPE_SQL, integrated: Boolean(integration), origin: () => integration?.origin || `http://${host}:${listeningPort}`, resolveLink: resolveWorkspaceLink, backgroundJobsEnabled, workNotificationsEnabled,
    externalNotifications: integration?.notifications ? {
      list: userId => integration.notifications.list(bridge.companyUserId(userId)),
      read: (userId, notificationId) => integration.notifications.read(bridge.companyUserId(userId), notificationId),
      readAll: userId => integration.notifications.readAll(bridge.companyUserId(userId)),
    } : null,
  });
  const directTasks = createDirectTaskService({ db, assert, textField, validateRequestId: requestId, now, requirePosting, channelShape, channelMembers, collaboration, messageShape, publish,
    onPublishError: error => console.error('[messenger] Committed task update publication:', String(error?.code || error?.name || 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80)),
  });
  const voiceService = createVoiceService({ ...voice, db, assert, validateRequestId: requestId, publish, invitationVisible: voiceInvitationVisible });
  collaboration.setPersonalNotifications({ list: voiceService.invitationNotifications, read: voiceService.readInvitationNotification });

  function voiceInvitationVisible(userId, channelId) {
    syncDirectory();
    if (!members().some(row => row.id === userId)) return false;
    try { requireChannel(userId, channelId); return true; } catch { return false; }
  }
  function voiceRecipientCheck(channelId, userId) {
    const original = requireChannel(userId, channelId), lifecycle = original.lifecycle_version, departure = departureVersion(channelId, userId), access = bridge?.accessKey(userId);
    return () => {
      assert(voiceInvitationVisible(userId, channelId), 404, '이 동료는 지금 이 대화방에 없어요. 다른 동료를 불러 주세요.');
      const channel = requireChannel(userId, channelId);
      assert(channel.lifecycle_version === lifecycle && departureVersion(channelId, userId) === departure && bridge?.accessKey(userId) === access, 409, '동료의 대화방 참여가 바뀌었어요. 다시 불러 주세요.');
      const user = one('SELECT * FROM users WHERE id=?', userId);
      const companyUser = integration?.listUsers().find(row => row.id === bridge.companyUserId(userId) && row.active !== false);
      const identity = companyUser ? { role: companyUser.role, canWrite: companyUser.canWrite ?? companyUser.role !== 'viewer', canManage: companyUser.role === 'admin' } : null;
      const permission = voicePermissions({ user, identity }, channel);
      if (collaboration.notificationMode(userId, channelId) === 'mute') return { ...permission, canJoin: false };
      return permission;
    };
  }

  function voicePermissions(auth, channel) {
    const policy = voiceService.policyFor(channel.id), supported = channel.kind !== 'self' && !channel.system_key;
    const writer = (!auth.identity || auth.identity.canWrite === true) && canPostInChannel(channel, auth.user.id);
    const canModerate = Boolean(supported && writer && (canManageChannel(channel, auth.user.id) || (channel.scope === 'team' && auth.identity?.canManage === true && ['admin', 'manager'].includes(auth.identity.role))));
    const canRemain = Boolean(voiceService.capabilities().enabled && supported && policy.enabled && (writer || (auth.identity?.role === 'viewer' && policy.viewerCanJoin)));
    const canShare = Boolean(canRemain && writer && policy.screenShareEnabled && (policy.memberCanShare || canModerate));
    return { canRemain, canJoin: canRemain && !policy.locked, canSpeak: canRemain && writer && (policy.memberCanSpeak || canModerate), canShare, canShareAudio: canShare && policy.screenAudioAllowed, canModerate };
  }
  function publicVoicePermissions(auth, channel) {
    const { canRemain, ...permissions } = voicePermissions(auth, channel); return permissions;
  }
  function voiceState(auth, channelId) {
    const channel = requireChannel(auth.user.id, channelId);
    return { ...voiceService.channelState(channelId), permissions: publicVoicePermissions(auth, channel) };
  }
  function voicePermissionCheck(req, auth, channelId) {
    const original = requireChannel(auth.user.id, channelId);
    assert(original.kind !== 'self' && !original.system_key, 400, '이 대화방에서는 통화할 수 없어요. 개인 대화나 팀·프로젝트 대화방에서 시작해 주세요.');
    const lifecycle = original.lifecycle_version, departure = departureVersion(channelId, auth.user.id);
    const access = bridge?.accessKey(auth.user.id), role = auth.identity?.role;
    // Keep only the cookie needed to re-check the original session, never a
    // request body, response, or a persisted credential.
    const probe = { headers: { cookie: req.headers.cookie } };
    return () => {
      const latest = session(probe);
      assert(latest && latest.token === auth.token && latest.user.id === auth.user.id, 401, '로그인 상태가 바뀌었어요. 회사 계정으로 다시 로그인해 주세요.');
      assert(latest.identity?.role === role && bridge?.accessKey(auth.user.id) === access, 403, '통화 권한이나 소속 팀이 바뀌었어요. 다시 참가해 주세요.');
      const channel = requireChannel(latest.user.id, channelId);
      assert(channel.lifecycle_version === lifecycle && departureVersion(channelId, latest.user.id) === departure, 409, '대화방 참여가 바뀌었어요. 다시 참가해 주세요.');
      return voicePermissions(latest, channel);
    };
  }

  function resolveWorkspaceLink({ userId, channelId, workspaceLink, recipientIds, purpose = 'share' }) {
    if (integration?.resolveWorkspaceLink) {
      const memberIds = members().filter(member => recipientIds ? recipientIds.includes(member.id) : one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, member.id)).map(member => bridge.companyUserId(member.id)).filter(Boolean);
      try { return integration.resolveWorkspaceLink({ companyUserId: bridge.companyUserId(userId), recipientCompanyUserIds: memberIds, workspaceLink, purpose }); }
      catch (error) {
        if (error?.status === 403) throw new AppError(403, '이 대화방에 기획을 볼 수 없는 크루가 있어요. 기획을 볼 수 있는 크루나 다른 대화방을 골라 주세요.');
        if (error?.status === 404) throw new AppError(404, '공유할 기획이 없거나 볼 권한이 바뀌었어요. 회사 화면에서 기획을 다시 열어 주세요.');
        throw error;
      }
    }
    assert(!workspaceLink.url.includes('draftId='), 403, '여기서는 기획 공유 권한을 알 수 없어요. 회사 화면에서 공유해 주세요.');
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
      assert(entry.count <= limit, 429, '시도가 너무 많아요. 15분 뒤 다시 해 주세요.');
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
    assert(channel && !channel.deleted_at && (channel.scope !== 'team' || bridge?.inTeam(channel.team_id, userId)), 404, '대화방을 찾지 못했어요. 대화 목록을 새로 불러와 주세요.');
    return channel;
  }
  function canPostInChannel(channel, userId) {
    const role = bridge ? bridge.profile(userId).companyRole : one('SELECT role FROM users WHERE id=?', userId)?.role;
    if (!role || role === 'viewer' || channel.deleted_at) return false;
    return channel.system_key !== 'announcements' || role === (bridge ? 'admin' : 'owner');
  }
  function requirePosting(userId, channelId) {
    const channel = requireChannel(userId, channelId);
    assert(canPostInChannel(channel, userId), 403, channel.system_key === 'announcements' ? '공지는 관리자만 쓰거나 파일을 올릴 수 있어요. 읽기와 반응은 누구나 할 수 있어요.' : '이 대화방에는 메시지나 파일을 올릴 수 없어요.');
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
    assert(Array.isArray(value) && value.length <= 500 && value.every(id => typeof id === 'string'), 400, '들어올 크루를 목록에서 골라 주세요.');
    const activeIds = new Set(members().map(member => member.id));
    const ids = [...new Set(value)];
    assert(ids.every(id => activeIds.has(id)), 400, '고른 크루 가운데 지금 들어올 수 없는 사람이 있어요. 크루 목록을 새로 불러와 주세요.');
    return ids;
  }
  function channelMembers(channelId) { return members().filter(member => one('SELECT 1 FROM memberships WHERE channel_id=? AND user_id=?', channelId, member.id)); }
  function verifyProjectHistoryAudience(channel, userId, recipientIds, purpose = 'share') {
    for (const row of all('SELECT workspace_link FROM messages WHERE channel_id=? AND workspace_link IS NOT NULL', channel.id)) {
      try { resolveWorkspaceLink({ userId, channelId: channel.id, recipientIds, workspaceLink: JSON.parse(row.workspace_link), purpose }); }
      catch (error) {
        if (error.status === 403 || error.status === 404) throw new AppError(error.status, '이 대화방에 공유한 기획을 볼 수 없는 크루가 있어요. 기획 볼 권한을 먼저 주거나 새 대화방을 만들어 주세요.');
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
    return { ...basic, user: publicUser(user), channels: channelsFor(user.id), members: members(), teams: bridge?.teamsFor(user.id) || [], notificationUnread: collaboration.unreadCount(user.id), scheduledNotifications: { enabled: workNotificationsEnabled }, voice: voiceService.capabilities(), limits: { fileBytes: FILE_LIMIT }, ...(identity ? { integrated: { csrfToken: identity.csrfToken, companyUserId: identity.companyUserId, role: identity.role, canWrite: identity.canWrite, canManage: identity.canManage, parentOrigin: identity.parentOrigin } } : {}) };
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
    assert(!one('SELECT id FROM users WHERE username=?', input.username), 409, '이미 쓰고 있는 아이디예요. 다른 아이디를 정해 주세요.');
    const id = randomUUID();
    run('INSERT INTO users(id,username,name,role,password,created_at) VALUES(?,?,?,?,?,?)', id, input.username, input.name, role, password, now());
    run("INSERT INTO memberships(channel_id,user_id) SELECT id,? FROM channels WHERE kind='channel' AND scope='public' AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM channel_departures d WHERE d.channel_id=channels.id AND d.user_id=? AND d.rejoined_at IS NULL)", id, id);
    createChannel('나에게', '메모와 파일을 나만 볼 수 있는 공간', 'self', [id], `self:${id}`);
    return one('SELECT * FROM users WHERE id=?', id);
  }
  function fileShape(f) { return { id: f.id, name: f.name, size: f.size, mime: f.mime, type: fileType(f), url: `${basePath}/api/files/${f.id}`, createdAt: f.created_at, uploaderId: f.uploader_id, channelId: f.channel_id, messageId: f.message_id === null ? null : String(f.message_id), storageProvider: f.storage_provider }; }
  function messageShape(message, userId) { return collaboration.messageShape(message, userId); }
  function baseMessageShape(m, userId) {
    const reactions = all('SELECT emoji,COUNT(*) AS count,MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS mine FROM reactions WHERE message_id=? GROUP BY emoji ORDER BY emoji', userId, m.id).map(r => ({ emoji: r.emoji, count: r.count, mine: Boolean(r.mine) }));
    const parent = m.reply_to_id ? one('SELECT * FROM messages WHERE id=? AND channel_id=?', m.reply_to_id, m.channel_id) : null;
    const replyTo = !m.reply_to_id ? null : { id: String(m.reply_to_id), body: parent?.body || '', user: parent ? publicUser(one('SELECT * FROM users WHERE id=?', parent.user_id)) : null, files: parent ? all('SELECT * FROM files WHERE message_id=? ORDER BY created_at,id', parent.id).map(fileShape) : [], deleted: !parent };
    const pin = one('SELECT * FROM message_pins WHERE message_id=?', m.id);
    return { id: String(m.id), channelId: m.channel_id, body: m.body, user: publicUser(one('SELECT * FROM users WHERE id=?', m.user_id)), files: all('SELECT * FROM files WHERE message_id=? ORDER BY created_at,id', m.id).map(fileShape), createdAt: m.created_at, editedAt: m.edited_at, reactions, replyToId: m.reply_to_id ? String(m.reply_to_id) : null, replyTo, replyCount: one('SELECT COUNT(*) AS n FROM messages WHERE reply_to_id=? AND channel_id=?', m.id, m.channel_id).n, pinned: Boolean(pin), pinnedAt: pin?.created_at || null, pinnedBy: pin ? publicUser(one('SELECT * FROM users WHERE id=?', pin.user_id)) : null };
  }
  function requireMessage(id, userId) {
    const m = /^\d+$/.test(id) ? one('SELECT * FROM messages WHERE id=?', id) : null;
    assert(m, 404, '메시지를 찾지 못했어요. 대화를 새로 불러와 주세요.');
    requireChannel(userId, m.channel_id);
    return m;
  }
  function publish(type, channelId, onlyUserId) {
    syncDirectory();
    if (type === 'channel' || type === 'member') void voiceService.sweep().catch(() => {});
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
  function disconnectRevoked() { syncDirectory(); void voiceService.sweep().catch(() => {}); for (const client of subscribers) if (!validSubscriber(client, false)) { client.res.end(); subscribers.delete(client); } }
  async function removeDiskFile(diskName) {
    // Disk names are generated internally, never supplied by a client.
    try { await unlink(path.join(uploadDir, diskName)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  function headers(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', integration ? 'SAMEORIGIN' : 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    // Calls need the microphone, screen capture and LiveKit Cloud signalling only
    // while the feature is on. Camera stays blocked; the E2EE worker is same-origin.
    const calls = voiceService.capabilities().enabled;
    res.setHeader('Permissions-Policy', calls ? 'camera=(), microphone=(self), display-capture=(self), geolocation=()' : 'camera=(), microphone=(), display-capture=(), geolocation=()');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${calls ? ' wss://*.livekit.cloud https://*.livekit.cloud' : ''}; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors ${integration ? "'self'" : "'none'"}; form-action 'self'`);
    res.setHeader('Cache-Control', 'no-store');
  }
  function json(res, status, value) {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  }
  function guardRequest(req) {
    if (integration) {
      if (req.headers.origin) assert(req.headers.origin === integration.origin, 403, '회사 화면 밖에서 온 요청이에요. 회사 화면에서 다시 열어 주세요.');
      assert(req.headers['sec-fetch-site'] !== 'cross-site', 403, '다른 사이트에서 온 요청은 받지 않아요.');
      return;
    }
    const allowedHosts = new Set([`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`, `[::1]:${listeningPort}`]);
    assert(allowedHosts.has(req.headers.host), 403, '이 주소로는 열 수 없어요. 이 컴퓨터의 메신저 주소로 열어 주세요.');
    if (req.headers.origin) assert(req.headers.origin === `http://${req.headers.host}`, 403, '다른 사이트에서 온 요청은 받지 않아요.');
    assert(req.headers['sec-fetch-site'] !== 'cross-site', 403, '다른 사이트에서 온 요청은 받지 않아요.');
  }
  function sentRequestResult(receipt, userId) {
    if (receipt.state === 'cancelled') throw recoveryError('MESSAGE_CANCELLED', '보내기를 취소한 메시지라 보내지 않았어요. 필요하면 새로 보내 주세요.');
    const message = receipt.message_id && one('SELECT * FROM messages WHERE id=?', receipt.message_id);
    if (!message) throw recoveryError('MESSAGE_DELETED', '이미 보낸 뒤 지운 메시지라 다시 보내지 않았어요.');
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
    if (receipt.state === 'cancelled') throw recoveryError('UPLOAD_CANCELLED', '올리기를 취소한 파일이라 올리지 않았어요. 필요하면 다시 골라 주세요.');
    if (receipt.state === 'pending') {
      const active = activeUploadRequests.has(key);
      throw recoveryError(active ? 'UPLOAD_IN_PROGRESS' : 'UPLOAD_UNCERTAIN', active ? '파일을 아직 저장하고 있어요. 잠시 뒤 다시 확인해 주세요.' : '앞서 올린 결과를 알 수 없어 또 올리지 않았어요. 첨부를 빼고 다시 골라 주세요.', { recoveryStatus: active ? 'pending' : 'uncertain', retryable: false });
    }
    if (receipt.state !== 'complete') return null;
    const file = receipt.file_id && one('SELECT * FROM files WHERE id=?', receipt.file_id);
    if (!file) throw recoveryError('UPLOAD_DELETED', '이미 지운 첨부 파일이라 다시 올리지 않았어요.');
    if (file.message_id !== null) throw recoveryError('UPLOAD_CONSUMED', '이미 메시지에 첨부한 파일이에요. 그 메시지가 보내졌는지 확인해 주세요.');
    return file;
  }
  async function upload(req, res, user, channelId, revalidate = () => {}) {
    const lifecycleVersion = requirePosting(user.id, channelId).lifecycle_version;
    const membershipVersion = departureVersion(channelId, user.id);
    const uploadId = req.headers['x-upload-id'] === undefined ? null : requestId(req.headers['x-upload-id'], '파일 전송');
    const validateUpload = () => {
      revalidate();
      assert(requirePosting(user.id, channelId).lifecycle_version === lifecycleVersion, 409, '올리는 사이 대화방이 삭제되거나 복원돼 업로드를 멈췄어요. 파일을 다시 골라 주세요.');
      assert(departureVersion(channelId, user.id) === membershipVersion, 409, '올리는 사이 프로젝트 참여가 바뀌어 업로드를 멈췄어요. 파일을 다시 골라 주세요.');
      if (uploadId && one('SELECT state FROM file_upload_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, uploadId)?.state === 'cancelled') throw recoveryError('UPLOAD_CANCELLED', '올리기를 취소한 파일이라 올리지 않았어요. 필요하면 다시 골라 주세요.');
    };
    const uploadKey = JSON.stringify([user.id, channelId, uploadId]);
    // Capture storage once, preserving the existing account-switch semantics.
    const activeConnection = await drive.active();
    validateUpload();
    let original;
    try { original = decodeURIComponent(req.headers['x-file-name'] || ''); } catch { throw new AppError(400, '파일 이름을 읽지 못했어요. 이름을 바꾼 뒤 다시 올려 주세요.'); }
    original = original.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim();
    assert(original && original.length <= 240, 400, '파일 이름을 1~240자로 바꾼 뒤 다시 올려 주세요.');
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      assert(Number(contentLength) > 0, 400, '빈 파일은 올릴 수 없어요. 내용이 있는 파일을 골라 주세요.');
      if (Number(contentLength) > FILE_LIMIT) { req.resume(); throw new AppError(413, '파일은 하나에 100MB까지 올릴 수 있어요.'); }
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
      assert(size <= FILE_LIMIT, 413, '파일은 하나에 100MB까지 올릴 수 있어요.');
      assert(size > 0, 400, '빈 파일은 올릴 수 없어요. 내용이 있는 파일을 골라 주세요.');
      assert(!res.destroyed, 499, '파일 올리기가 취소됐어요.');
      validateUpload();
      const md5 = digest.digest('hex');
      if (uploadId) {
        const fingerprint = hash(JSON.stringify([original, size, payloadDigest.digest('hex')]));
        const existing = transaction(() => {
          const prior = one('SELECT * FROM file_upload_requests WHERE user_id=? AND channel_id=? AND request_id=?', user.id, channelId, uploadId);
          if (prior && prior.payload_hash !== fingerprint) throw recoveryError('UPLOAD_REQUEST_CONFLICT', '다른 파일과 전송 정보가 겹쳐 올리지 않았어요. 첨부를 빼고 다시 골라 주세요.');
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
        assert(remote?.connectionId === activeConnection.id && typeof remote.remoteId === 'string' && remote.remoteId && typeof remote.md5 === 'string' && remote.md5.toLowerCase() === md5, 502, 'Drive에 저장된 파일을 확인하지 못했어요. 다시 올려 주세요.');
        // Survives a failed SQLite insert or a crash before the file record is committed.
        enqueueDriveDeletion({ fileId: id, connectionId: activeConnection.id, remoteId: remote.remoteId });
      }
      // A completed keyed upload remains discoverable even when only the response was lost.
      if (!uploadId) assert(!res.destroyed, 499, '파일 올리기가 취소됐어요.');
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

  const publicAccountRoutes = createPublicAccountRoutes({ accountInput, assert, bootstrap, createUser, ensureSystemChannels, hasSetup, hash, issueSession, now, one, passwordHash, passwordMatches, publish, rateLimit, run, textField, transaction });
  const voiceRoutes = createVoiceRoutes({ assert, integration, publicVoicePermissions, rateLimit, requestId, requireChannel, voiceInvitationVisible, voicePermissionCheck, voiceRecipientCheck, voiceService, voiceState });
  const memberAccountRoutes = createMemberAccountRoutes({ SESSION_MS, all, assert, bridge, hash, members, now, randomBytes, randomUUID, run, subscribers, voiceService });
  const channelsRoutes = createChannelsRoutes({ CHANNEL_CATEGORIES, TEAM_CHANNEL_DESCRIPTION, activeDownloads, all, assert, bridge, canManageChannel, canRestoreProject, channelMembers, channelShape, channelsFor, createChannel, managedProject, members, now, one, projectChannel, projectManager, publish, requireChannel, run, selectedMemberIds, selectedProject, textField, transaction, verifyProjectHistoryAudience });
  const messagesRoutes = createMessagesRoutes({ AppError, EMOJI, all, assert, canonical, collaboration, fileShape, hash, integration, messageShape, now, one, publish, queueFileDeletion, recordFileCancellation, recoveryError, removeDiskFile, requestId, requireChannel, requireMessage, requirePosting, retryDriveDeletions, run, sentRequestResult, textField, transaction, upload, uploadedRequestFile });
  const filesRoutes = createFilesRoutes({ AppError, FILE_EXTENSIONS, FILE_TYPE_SQL, activeDownloads, all, assert, bridge, departureVersion, drive, driveStatus, fileShape, integration, one, open, path, pendingDeletions, pipeline, publish, queueFileDeletion, recordFileCancellation, recoveryError, removeDiskFile, requireChannel, retryDriveDeletions, run, textField, transaction, uploadDir });
  const eventsRoutes = createEventsRoutes({ bridge, subscribers, validSubscriber });

  const privateRoutes = [memberAccountRoutes, channelsRoutes, messagesRoutes, filesRoutes, eventsRoutes];

  const handler = async (req, res) => {
    headers(res);
    try {
      guardRequest(req);
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (basePath) {
        assert(url.pathname.startsWith(`${basePath}/`), 404, '메신저 주소가 맞지 않아요. 회사 화면에서 메신저를 다시 열어 주세요.');
        url.pathname = url.pathname.slice(basePath.length);
      }
      const p = url.pathname; const method = req.method;
      if (method === 'GET' && p === '/api/health') return json(res, 200, { ok: true, service: 'synk-company-messenger', version: 1 });
      // Only this exact provider callback bypasses cookie/CSRF authentication.
      // The service verifies the signed JWT and the original body hash.
      if (method === 'POST' && p === '/api/voice/webhook') {
        const raw = await voiceWebhookBody(req);
        return json(res, 200, await voiceService.webhook(raw, req.headers.authorization));
      }
      let auth = session(req);
      let user = auth?.user;
      const originalToken = auth?.token;
      const originalRole = auth?.identity?.role;
      const originalAccess = user && bridge?.accessKey(user.id);
      const mutation = !['GET', 'HEAD'].includes(method);
      const readMarker = messageReadMarker(p, method);
      const personalMutation = collaboration.personalMutation(p, method) || personalVoiceMutation(p, method);
      const revalidate = () => {
        // Standalone sessions can also be revoked while the body or file IO waits.
        // Public entry points without an original session retain their own checks.
        if (!integration && !originalToken) return;
        const latest = session(req);
        assert(latest && latest.token === originalToken && latest.user.id === user.id, 401, integration ? '로그인 상태가 바뀌었어요. 회사 계정으로 다시 로그인해 주세요.' : '로그인 상태가 바뀌었어요. 다시 로그인해 주세요.');
        if (!integration) { auth = latest; user = latest.user; return; }
        assert(latest.identity.role === originalRole, 401, '회사 계정의 권한이 바뀌었어요. 다시 로그인해 주세요.');
        assert(bridge.accessKey(latest.user.id) === originalAccess, 401, '소속 팀이 바뀌었어요. 대화 목록을 새로 불러와 주세요.');
        if (mutation) {
          assert(req.headers.origin === integration.origin && req.headers['x-csrf-token'] === latest.identity.csrfToken, 403, '로그인 정보가 바뀌었어요. 새로고침한 뒤 다시 해 주세요.');
          assert(latest.identity.canWrite || readMarker || personalMutation, 403, '보기 전용 계정이라 메시지나 파일을 바꿀 수 없어요.');
        }
        auth = latest; user = latest.user;
      };
      const readBody = async () => { const body = await jsonBody(req); revalidate(); return body; };
      const sessionEntry = ['/api/setup', '/api/login', '/api/join', '/api/logout'].includes(p);
      const respond = (status, body) => {
        if (p.startsWith('/api/') && (integration || (originalToken && !sessionEntry))) revalidate();
        return json(res, status, body);
      };
      if (integration && p.startsWith('/api/')) {
        assert(user, 401, '회사 계정으로 로그인해 주세요.');
        if (/^\/api\/(setup|login|join|logout|invites)(\/|$)/.test(p)) throw new AppError(403, '계정과 초대는 회사 앱에서 관리해 주세요.');
        revalidate();
      }
      // Getters retain the freshly revalidated actor after delayed request bodies/IO.
      const context = { req, res, p, method, url, readBody, respond, revalidate, get user() { return user; }, get auth() { return auth; } };
      const publicResult = dispatchRequest(context, [publicAccountRoutes]);
      if (publicResult !== false) { if (await publicResult) return; revalidate(); }
      if (p.startsWith('/api/')) {
        assert(user, 401, '로그인이 필요해요. 다시 로그인해 주세요.');
        const voiceResult = dispatchRequest(context, [voiceRoutes]);
        if (voiceResult !== false) { if (await voiceResult) return; revalidate(); }
        if (method === 'GET' && p === '/api/tasks/create-options') return respond(200, directTasks.options(user.id));
        if (method === 'POST' && p === '/api/tasks') {
          const body = await readBody(), result = directTasks.create(user.id, body);
          return respond(result.created ? 201 : 200, result);
        }
        if (await collaboration.handle({ p, method, url, user, readBody, respond })) return;
        revalidate();
        if (await dispatchRequest(context, privateRoutes)) return;
        throw new AppError(404, '요청한 기능을 찾지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      }
      assert(method === 'GET' || method === 'HEAD', 405, '이 방식의 요청은 받지 않아요.');
      let relative;
      try { relative = decodeURIComponent(p); } catch { throw new AppError(400, '주소가 맞지 않아요.'); }
      assert(!relative.includes('\0') && !relative.includes('\\'), 404, '파일을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      const publicDir = path.join(ROOT, 'public');
      const imagePath = path.resolve(publicDir, `.${relative === '/' ? '/index.html' : relative}`);
      assert(imagePath.startsWith(`${publicDir}${path.sep}`), 404, '파일을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      // The company host may serve this file from its static set.
      const staticPath = publicFile(imagePath);
      let info;
      try { info = await stat(staticPath); } catch { throw new AppError(404, '파일을 찾지 못했어요. 목록을 새로 불러와 주세요.'); }
      assert(info.isFile(), 404, '파일을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      if (respondPublicStatic && ['.js', '.css'].includes(path.extname(staticPath))) {
        return await respondPublicStatic(req, res, { path: staticPath, type: MIME[path.extname(staticPath)], versioned: versionedMessengerAssets.has(relative) });
      }
      if (basePath && ['.html', '.css'].includes(path.extname(staticPath))) {
        let content = await readPublicAsset(staticPath);
      if (relative === '/' || relative === '/index.html') {
        if (respondPublicStatic?.versionHTML) content = await respondPublicStatic.versionHTML(content, {
          documentPath: basePath + '/',
          resolveAsset: urlPath => {
            if (!urlPath.startsWith(basePath + '/')) return null;
            const asset = urlPath.slice(basePath.length);
            return versionedMessengerAssets.has(asset) ? publicFile(path.join(publicDir, asset.slice(1))) : null;
          },
        });
      }
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
      json(res, status, { error: error instanceof AppError ? error.message : typeof error.publicMessage === 'string' ? error.publicMessage : '처리하지 못했어요. 잠시 뒤 다시 해 주세요.', ...(error.code === 'SYNK_WORK_NOTIFICATIONS_PAUSED' || /^(MESSAGE_|UPLOAD_|VOICE_)/.test(error.code || '') ? { code: error.code } : {}), ...(error.recoveryStatus ? { status: error.recoveryStatus, retryable: error.retryable } : {}) });
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
    taskOptionsForCompanyUser(companyUserId) {
      assert(bridge, 403, '회사 작업실에서 확인해 주세요.');
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      assert(member, 403, '이 계정의 업무를 불러오지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      const options = directTasks.options(member.id);
      return {...options, channels: options.channels.map(channel => ({...channel,
        companyUserIds: channel.memberIds.map(id => bridge.companyUserId(id) || null),
        taskAssignees: channel.taskAssignees.map(person => ({...person, companyUserId: bridge.companyUserId(person.id) || null})),
      }))};
    },
    createTaskForCompanyUser(companyUserId, input) {
      assert(bridge, 403, '회사 작업실에서 확인해 주세요.');
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      assert(member, 403, '이 계정의 업무를 불러오지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      return directTasks.create(member.id, input);
    },
    findTaskForCompanyUser(companyUserId, {requestId: registrationId}) {
      assert(bridge, 403, '회사 작업실에서 확인해 주세요.');
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      assert(member, 403, '이 계정의 업무를 불러오지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      const receipt = one('SELECT state,message_id FROM message_send_requests WHERE user_id=? AND request_id=?', member.id, 'direct-task:' + requestId(registrationId, '업무 등록'));
      if(!receipt)return null;
      assert(receipt.state === 'sent' && receipt.message_id, 409, '업무 등록 결과를 아직 확인하고 있어요. 잠시 뒤 다시 확인해 주세요.');
      const message = requireMessage(String(receipt.message_id), member.id);
      const task = collaboration.productivity.getTask(String(message.id), member.id);
      assert(task, 404, '후속 업무를 찾지 못했어요. 목록을 새로 불러와 주세요.');
      return {task: {...task, assignee: task.assignee ? {...task.assignee, companyUserId: bridge.companyUserId(task.assignee.id) || null} : null}, message: {id: String(message.id), channelId: message.channel_id}, created: false};
    },
    removeTaskForCompanyUser(companyUserId, input) {
      assert(bridge, 403, '회사 작업실에서 확인해 주세요.');
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      assert(member, 403, '이 계정의 업무를 불러오지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      return directTasks.remove(member.id, input);
    },
    taskForCompanyUser(companyUserId, {messageId}) {
      assert(bridge, 403, '회사 작업실에서 확인해 주세요.');
      syncDirectory();
      const member = members().find(row => bridge.companyUserId(row.id) === companyUserId);
      assert(member, 403, '이 계정의 업무를 불러오지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      const message = requireMessage(String(messageId), member.id);
      const task = collaboration.productivity.getTask(String(message.id), member.id);
      assert(task, 404, '후속 업무를 찾지 못했어요. 목록을 새로 불러와 주세요.');
      return {task: {...task, assignee: task.assignee ? {...task.assignee, companyUserId: bridge.companyUserId(task.assignee.id) || null} : null}, message: {id: String(message.id), channelId: message.channel_id}};
    },
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
      assert(member, 403, '이 계정의 업무를 불러오지 못했어요. 새로고침한 뒤 다시 해 주세요.');
      return collaboration.productivity.weeklySummary(member.id, period);
    },
    productivityOverview(req, kind, query = {}) {
      const auth = session(req); assert(auth, 401, '회사 계정으로 로그인해 주세요.');
      const service = collaboration.productivity;
      assert(['workday', 'catchUp', 'decisions'].includes(kind), 400, '볼 업무 범위를 골라 주세요.');
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
      await voiceService.close();
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
