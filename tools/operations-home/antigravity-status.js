'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { companyRoots } = require('./native-status');

const runFile = promisify(execFile);
const SOURCE = 'Antigravity';
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORD_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;
const AGY_NAME = /^agy(?:\.exe)?$/i;

function fail(code) { throw Object.assign(new Error(code), { code }); }
function clock(options) {
  const now = options.now ? options.now() : Date.now();
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) fail('INVALID_TIME');
  return now;
}
function directory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) return null;
  try {
    const actual = fs.realpathSync.native(directory);
    return fs.statSync(actual).isDirectory() ? actual : null;
  } catch { return null; }
}
function key(value) { return process.platform === 'win32' ? value.toLowerCase() : value; }
function allowedDirectories(root) { return new Set(companyRoots(root).map(value => key(value))); }
function text(value, maximum) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
}
function pid(value) { return Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff; }

function cacheDirectory(root, options = {}) {
  const actual = directory(path.resolve(root));
  if (!actual) fail('INVALID_ROOT');
  const digest = crypto.createHash('sha256').update(key(actual)).digest('hex').slice(0, 16);
  return path.join(options.cacheBase || os.tmpdir(), 'synk-antigravity-status', digest);
}

function normalize(payload, allowed) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('INVALID_PAYLOAD');
  const id = payload.conversation_id === undefined ? payload.session_id : payload.conversation_id;
  if (typeof id !== 'string' || !UUID.test(id)) fail('INVALID_SESSION');
  if (payload.session_id !== undefined && (typeof payload.session_id !== 'string' || payload.session_id.toLowerCase() !== id.toLowerCase())) fail('INVALID_SESSION');
  const suppliedCwd = payload.cwd === undefined ? payload.workspace?.current_dir : payload.cwd;
  if (!text(suppliedCwd, 4096)) fail('INVALID_CWD');
  const cwd = directory(suppliedCwd);
  if (!cwd || !allowed.has(key(cwd))) fail('OUTSIDE_COMPANY');
  const state = payload.agent_state === undefined ? 'unknown' : payload.agent_state;
  if (!text(state, 64)) fail('INVALID_STATE');
  if (payload.tool_confirmation_pending !== undefined && typeof payload.tool_confirmation_pending !== 'boolean') fail('INVALID_STATE');
  if (payload.task_count !== undefined && (!Number.isSafeInteger(payload.task_count) || payload.task_count < 0 || payload.task_count > 10000)) fail('INVALID_STATE');
  const model = {};
  if (payload.model !== undefined) {
    if (!payload.model || typeof payload.model !== 'object' || Array.isArray(payload.model)) fail('INVALID_MODEL');
    for (const field of ['id', 'display_name']) {
      if (payload.model[field] !== undefined) {
        if (!text(payload.model[field], 240)) fail('INVALID_MODEL');
        model[field] = payload.model[field];
      }
    }
  }
  return {
    conversation_id: id.toLowerCase(), cwd, model, agent_state: state,
    tool_confirmation_pending: payload.tool_confirmation_pending === true,
    ...(payload.task_count === undefined ? {} : { task_count: payload.task_count }),
  };
}

function normalizedStatus(payload) {
  if (payload.tool_confirmation_pending) return 'needs_attention';
  if (payload.task_count > 0) return 'running';
  if (['thinking', 'working', 'tool_use', 'initializing'].includes(payload.agent_state)) return 'running';
  return payload.agent_state === 'idle' ? 'idle' : 'unknown';
}

// Query process metadata only. No command lines, credentials, or conversation contents.
async function processLookup(options) {
  if (typeof options.getProcessInfo === 'function') return options.getProcessInfo;
  if (process.platform !== 'win32') throw new Error('PROCESS_LOOKUP_UNAVAILABLE');
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = "$ErrorActionPreference='Stop'; $rows=@(Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{pid=[long]$_.ProcessId;parentPid=[long]$_.ParentProcessId;name=$_.Name;createdAt=$(if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {$null})} }); ConvertTo-Json -InputObject $rows -Compress";
  const { stdout } = await runFile(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true, timeout: 2500, maxBuffer: 1024 * 1024, encoding: 'utf8',
  });
  const rows = JSON.parse(stdout.replace(/^\uFEFF/, ''));
  if (!Array.isArray(rows)) throw new Error('PROCESS_LOOKUP_UNAVAILABLE');
  const byPid = new Map(rows.filter(row => row && pid(row.pid)).map(row => [row.pid, row]));
  return async processId => byPid.get(processId) || null;
}

function identity(info, now) {
  if (!info || !pid(info.pid) || typeof info.name !== 'string' || !AGY_NAME.test(info.name) || typeof info.createdAt !== 'string') return null;
  const created = Date.parse(info.createdAt);
  if (!Number.isFinite(created) || created > now) return null;
  return { pid: info.pid, name: info.name, createdAt: new Date(created).toISOString() };
}

async function processExists(processId, options) {
  if (!pid(processId)) return false;
  try {
    const check = options.processExists || options.exists;
    if (check) return (await check(processId)) === true;
    process.kill(processId, 0);
    return true;
  } catch (error) { return error.code === 'EPERM'; }
}

async function findParent(options, now) {
  try {
    const lookup = await processLookup(options);
    let current = options.parentPid === undefined ? process.ppid : options.parentPid;
    const seen = new Set();
    for (let depth = 0; depth < 4 && pid(current) && !seen.has(current); depth++) {
      seen.add(current);
      const info = await lookup(current);
      if (!info || info.pid !== current) return null;
      const found = identity(info, now);
      if (found) return found;
      current = info.parentPid;
    }
  } catch {}
  return null;
}

async function selectIdentity(previous, payload, options, now) {
  const previousTime = Date.parse(previous?.receivedAt);
  const sameSession = previous?.conversation_id === payload.conversation_id && previous?.cwd === payload.cwd && Number.isFinite(previousTime) && previousTime <= now;
  const prior = sameSession ? identity(previous.processIdentity, previousTime) : null;
  const priorAlive = prior && await processExists(prior.pid, options);
  const initializing = payload.agent_state === 'initializing' && previous?.agent_state !== 'initializing';
  let conflict = sameSession ? identity(previous.conflictingProcessIdentity, previousTime) : null;
  if (conflict && !await processExists(conflict.pid, options)) conflict = null;
  if (priorAlive && !initializing) {
    return { processIdentity: prior, ...(conflict ? { conflictingProcessIdentity: conflict } : {}) };
  }
  const found = await findParent(options, now);
  if (!found && priorAlive) return { processIdentity: prior, ...(conflict ? { conflictingProcessIdentity: conflict } : {}) };
  if (found && priorAlive && (found.pid !== prior.pid || found.createdAt !== prior.createdAt)) conflict = prior;
  if (conflict && found && conflict.pid === found.pid && conflict.createdAt === found.createdAt) conflict = null;
  return { processIdentity: found, ...(conflict && found ? { conflictingProcessIdentity: conflict } : {}) };
}

async function lockSession(file) {
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 300; attempt++) {
    try {
      const handle = fs.openSync(file, 'wx', 0o600);
      try { fs.writeFileSync(handle, token); } finally { fs.closeSync(handle); }
      return () => {
        try { if (fs.readFileSync(file, 'utf8') === token) fs.unlinkSync(file); } catch {}
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // Cold identity lookup is bounded at 2.5 seconds; hot receivers only reuse it.
      try { if (Date.now() - fs.statSync(file).mtimeMs > 30_000) fs.unlinkSync(file); } catch {}
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  fail('CACHE_BUSY');
}

async function saveAntigravity(root, payload, options = {}) {
  let temporary, unlock;
  try {
    const now = clock(options);
    const sanitized = normalize(payload, allowedDirectories(root));
    const parentPid = options.parentPid === undefined ? process.ppid : options.parentPid;
    const receivedAt = new Date(now).toISOString();
    const folder = cacheDirectory(root, options);
    await fs.promises.mkdir(folder, { recursive: true });
    const target = path.join(folder, sanitized.conversation_id + '.json');
    unlock = await lockSession(path.join(folder, sanitized.conversation_id + '.lock'));
    // Concurrent receivers can finish out of order. Compare while holding the session lock.
    let previous;
    try {
      previous = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (Number.isFinite(Date.parse(previous.receivedAt)) && Date.parse(previous.receivedAt) > now) {
        return { saved: false, errorCode: 'SUPERSEDED', id: sanitized.conversation_id, checkedAt: previous.receivedAt };
      }
    } catch {}
    const binding = await selectIdentity(previous, sanitized, options, now);
    const record = { schemaVersion: 1, ...sanitized, receivedAt, receiverParentPid: pid(parentPid) ? parentPid : null, ...binding };
    temporary = path.join(folder, sanitized.conversation_id + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp');
    fs.writeFileSync(temporary, JSON.stringify(record), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, target);
    return { saved: true, id: sanitized.conversation_id, checkedAt: receivedAt };
  } catch (error) {
    if (temporary) await fs.promises.unlink(temporary).catch(() => {});
    const known = new Set(['INVALID_ROOT', 'INVALID_TIME', 'INVALID_PAYLOAD', 'INVALID_SESSION', 'INVALID_CWD', 'OUTSIDE_COMPANY', 'INVALID_STATE', 'INVALID_MODEL', 'CACHE_BUSY']);
    return { saved: false, errorCode: known.has(error.code) ? error.code : 'WRITE_FAILED' };
  } finally {
    if (unlock) unlock();
  }
}

function isConfigured(options) {
  try {
    const settingsPath = options.settingsPath || path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''));
    const line = settings.statusLine;
    if (!line || line.enabled === false || line.type !== 'command' || typeof line.command !== 'string') return false;
    const command = key(line.command.replace(/\\/g, '/'));
    const receiverFile = path.resolve(options.receiverPath || __filename);
    if (!fs.existsSync(receiverFile)) return false;
    const receiver = key(receiverFile.replace(/\\/g, '/'));
    const escaped = receiver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(?:^|[\\s\"\'])' + escaped + '(?:$|[\\s\"\'])').test(command);
  } catch { return false; }
}

async function readAntigravity(root, options = {}) {
  const configured = isConfigured(options);
  const base = { source: SOURCE, configured, connected: false, stale: true, checkedAt: null, coverage: 'statusline-reported-sessions', tasks: [] };
  try {
    const now = clock(options);
    const allowed = allowedDirectories(root);
    const folder = cacheDirectory(root, options);
    let entries;
    try { entries = await fs.promises.readdir(folder, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return base; throw error; }
    const records = [];
    for (const entry of entries) {
      if (!entry.isFile() || !RECORD_NAME.test(entry.name)) continue;
      try {
        const file = path.join(folder, entry.name);
        const stat = await fs.promises.stat(file);
        if (stat.size > 8192) continue;
        const record = JSON.parse(await fs.promises.readFile(file, 'utf8'));
        const received = Date.parse(record.receivedAt);
        if (record.schemaVersion !== 1 || !Number.isFinite(received) || received > now) continue;
        const sanitized = normalize(record, allowed);
        if (entry.name.toLowerCase() !== sanitized.conversation_id + '.json') continue;
        records.push({
          ...sanitized, receivedAt: new Date(received).toISOString(),
          receiverParentPid: pid(record.receiverParentPid) ? record.receiverParentPid : null,
          processIdentity: identity(record.processIdentity, received),
          conflictingProcessIdentity: identity(record.conflictingProcessIdentity, received),
        });
      } catch {}
    }
    if (!records.length) return base;
    let lookup;
    try { lookup = await processLookup(options); } catch {}
    const tasks = [];
    for (const record of records) {
      let processState = 'unverified';
      const sourcePid = record.processIdentity?.pid || record.receiverParentPid;
      if (sourcePid && lookup) {
        try {
          const info = await lookup(sourcePid);
          if (!info) processState = record.processIdentity ? 'exited' : 'unverified';
          else {
            const current = identity(info, now);
            if (record.processIdentity) {
              if (current && current.pid === sourcePid && current.createdAt === record.processIdentity.createdAt) processState = 'alive';
              else if (pid(info.pid) && Number.isFinite(Date.parse(info.createdAt))) processState = 'pid_reused';
            } else if (record.receiverParentPid) {
              // A process created after this receiver reported cannot be its original parent.
              if (Number.isFinite(Date.parse(info.createdAt)) && Date.parse(info.createdAt) > Date.parse(record.receivedAt)) processState = 'unverified';
              else if (current && current.pid === sourcePid) processState = 'alive';
              // Shell wrappers are intentionally unverified, rather than treated as AGY.
            }
          }
        } catch {}
      }
      if (processState === 'alive' && record.conflictingProcessIdentity && lookup) {
        try {
          const conflict = identity(await lookup(record.conflictingProcessIdentity.pid), now);
          if (conflict && conflict.createdAt === record.conflictingProcessIdentity.createdAt) processState = 'ambiguous';
        } catch { processState = 'unverified'; }
      }
      const observedStatus = normalizedStatus(record);
      const ended = processState === 'exited' || processState === 'pid_reused';
      if (ended && now - Date.parse(record.receivedAt) > DAY_MS) continue;
      tasks.push({
        id: record.conversation_id, title: path.basename(record.cwd) + ' 작업', cwd: record.cwd,
        source: SOURCE, status: ended || processState === 'ambiguous' ? 'unknown' : observedStatus, observedStatus,
        sourceStatus: { agent_state: record.agent_state, tool_confirmation_pending: record.tool_confirmation_pending, ...(record.task_count === undefined ? {} : { task_count: record.task_count }) },
        model: record.model.display_name || record.model.id || null, modelId: record.model.id || null,
        checkedAt: record.receivedAt, stale: !configured || processState !== 'alive', processState,
        processCheckedAt: lookup && sourcePid ? new Date(now).toISOString() : null,
      });
    }
    if (!tasks.length) return base;
    tasks.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
    return { ...base, connected: configured && tasks.some(task => !task.stale), stale: !configured || tasks.every(task => task.stale), checkedAt: tasks[0].checkedAt, tasks };
  } catch {
    return { ...base, error: 'Antigravity 작업 상태를 읽지 못했습니다' };
  }
}

if (require.main === module) {
  let input = '', tooLarge = false;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (tooLarge) return;
    input += chunk;
    if (Buffer.byteLength(input, 'utf8') > 65536) { tooLarge = true; input = ''; }
  });
  process.stdin.on('error', () => { process.exitCode = 0; });
  process.stdin.on('end', async () => {
    try {
      if (tooLarge) fail('INVALID_PAYLOAD');
      const args = process.argv.slice(2);
      if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1])) fail('INVALID_ROOT');
      const root = args.length ? path.resolve(args[1]) : path.resolve(__dirname, '../..');
      const result = await saveAntigravity(root, JSON.parse(input.replace(/^\uFEFF/, '')), {});
      if (!result.saved && !['OUTSIDE_COMPANY', 'SUPERSEDED'].includes(result.errorCode)) process.stderr.write('Antigravity 상태 기록을 건너뛰었습니다.\n');
    } catch { process.stderr.write('Antigravity 상태 기록을 건너뛰었습니다.\n'); }
    process.exitCode = 0;
  });
}

module.exports = { readAntigravity, saveAntigravity, cacheDirectory };
