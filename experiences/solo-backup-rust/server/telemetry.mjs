// Pilot measurement intake (STAGE1_DESIGN.md 4.9 · 5.5, 「측정 받기」). Only numbers,
// fixed words and version-shaped strings are kept, so a file name or path that an
// app bug puts into a batch never reaches the database (T25). Unknown fields are
// counted and dropped; an item with a bad value is dropped whole.

const TRIGGER = new Set(['hourly', 'logon', 'wake', 'unlock', 'manual', 'window']);
const RESULT = new Set(['complete', 'partial', 'fill', 'skipped', 'failed', 'busy', 'not-due', 'paused']);
const PAUSE = new Set(['battery', 'saver', 'metered', 'clock', 'user', 'none']);
const FILL = new Set(['none', 'done', 'failed', 'skipped']);
const STANDBY = new Set(['S3', 'S0', 'unknown']);
// Closed word lists (shape alone would let a folder name like 'secret-project' through).
// notify.rs topics and problems, plus the stage-1 notices still to come (2.2 table).
export const NOTICE_KINDS = new Set(['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update',
  'first-backup', 'stale', 'partial', 'missing', 'unreadable', 'check-failed', 'repo-changed', 'proof-damage', 'mass-change',
  'new-device', 'seat-moved', 'restore-requested', 'restore-choice', 'over-quota', 'envelope', 'update-ready', 'moved-away']);
export const INSTALL_STEPS = new Set(['download', 'smartscreen', 'uac', 'install', 'first-open', 'google-signin', 'provision',
  'repository-init', 'envelope', 'schedule', 'first-backup', 'done', 'helper-register', 'migration', 'uninstall']);
export const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,40}$/;
// The codes a help bundle may carry: those the app (engine/src, worker/, ui/, src-tauri/src) and this server raise. A
// customer or project name in the shape of a code is dropped (GPT r7 GD1). A new code is added here.
export const KNOWN_ERROR_CODES = new Set(('ACCOUNT ALREADY ALREADY_RUNNING B2_BAD_RESPONSE BAD_INPUT BUNDLE_INTEGRITY BUNDLE_INVALID BUNDLE_MISSING '
  + 'BUNDLE_READ BUNDLE_UNSEALED BUSY CANCELED CATALOG_EXPIRED CATALOG_TOO_LARGE CREDENTIAL_REQUIRED '
  + 'DECLINED_OR_FAILED DENIED DEVICE DEVICE_FILE DEVICE_GONE DEVICE_STATE DIALOG_BUSY ENVELOPE FILE_ABOVE '
  + 'FILL_INPUT FOLDERS_FREE FOLDERS_PROFILE GOOGLE_STEP HOST_BUSY HOST_METHOD HOST_REQUEST INSTALLING '
  + 'INSTALL_INCOMPLETE INSTANCE_SIGNAL INTEGRITY_FAILED INVALID INVALID_ARGUMENT INVALID_FRAME INVALID_REQUEST '
  + 'IN_ONEDRIVE IN_SYNC_FOLDER JOB_BUSY KEY_GONE LEGACY_SECRET LIMIT_DEVICES LIMIT_KEYS_DAY LIMIT_RESTORE_DAY '
  + 'LIMIT_WORKER_DAY LINK_ABOVE MIGRATION_FORMAT MIGRATION_INCOMPLETE MIGRATION_INPUT MIGRATION_OUTPUT '
  + 'MIGRATION_SOURCE MIGRATION_SOURCE_CHANGED MOVED MOVE_BUSY MOVE_COPY_NAMES MOVE_GONE MOVE_KIT_SIZE MOVE_MKDIR '
  + 'MOVE_LIST_TOO_BIG MOVE_NETWORK MOVE_NO_SPACE MOVE_PROFILE MOVE_SNAPSHOT_GONE SOURCES_MISSING '
  + 'MOVE_NOT_READABLE MOVE_PATH MOVE_PROTECTED MOVE_RENAME_DENIED MOVE_REQUEST MOVE_SIZE MOVE_SKIP_FILE '
  + 'MOVE_SKIP_LINK NETWORK NONCE NOTIFY_BUSY NOTIFY_JSON NOTIFY_SHOW NOTIFY_TOAST NOTIFY_WRITE NOTIFY_XML '
  + 'NOT_CONFIGURED NOT_ELEVATED NOT_FIXED NOT_FOUND NOT_INVITED NOT_LOCAL NOT_OURS NOT_SIGNED_IN NOT_WRITER '
  + 'NO_ENVELOPE NO_GOOGLE NO_SNAPSHOT NO_SPACE OPEN_FAILED OPEN_FORBIDDEN OPEN_NO_SHELL OPEN_PRIVILEGE '
  + 'OPEN_SHELL_PROCESS OPEN_SHELL_TOKEN OPEN_START OPERATION_FAILED OTHER_BACKUP OUTPUT_UNSAFE OVER_QUOTA '
  + 'PAYLOAD_TOO_LARGE PIPE_FAILED PROBE_LIMIT PROBE_MANIFEST PROBE_SIZE PROCESS_JOB PRODUCTION_STATE_FORBIDDEN '
  + 'PROGRESS_JSON PROGRESS_WRITE PROTECTED QUERY_INVALID RATE READ_KEY READ_KEY_REQUIRED READ_ONLY REAUTH '
  + 'RECOVERY_REQUIRED REINSTALL_CLOCK REINSTALL_EXE REINSTALL_LIST_FAILED REINSTALL_NEEDS_ELEVATION REINSTALL_NOT_IN_TABLE '
  + 'REINSTALL_REQUEST REINSTALL_WORK REMOTE_MAINTENANCE REPOSITORY_CHANGED REPO_EXISTS REQUEST_BUSY '
  + 'REQUEST_TIMEOUT RESTORE_PENDING RUNLOG_JSON RUNLOG_OPEN RUNLOG_WRITE RUN_ACTIVE RUN_EXE_MISSING '
  + 'SCHEDULE_FOLDER SCHEDULE_FOLDER_NOT_OURS SCHEDULE_FOREIGN SCHEDULE_HELPER_CHECK '
  + 'SCHEDULE_HELPER_FOLDER_NOT_OURS SCHEDULE_HELPER_MISSING SCHEDULE_NOT_APPLIED SCHEDULE_PATH SCHEDULE_TIME '
  + 'SCHEDULE_USER SECRET_FORMAT SECRET_SIZE SECRET_UNAVAILABLE SELECTION_EMPTY SELECTION_LIMIT SELECTION_STALE '
  + 'SERVER SNAPSHOT_GONE SOLIO_FOLDER SOLIO_STATUS_SIZE STATE_LOCK STATE_ROOT SUB_MISMATCH TOKEN TOO_OLD TRUNCATED_FRAME UNSAFE_MANIFEST '
  + 'UPDATE_FAILED UPDATE_FEED UPDATE_NOT_CONFIGURED UPDATE_RECORD UPDATE_SIGNATURE UPDATE_START UPDATE_STOPPED '
  + 'UPDATE_UNCONFIRMED UP_TO_DATE WINGET_EXPORT WINGET_MISSING WINGET_OLD WINGET_START WINGET_TIMEOUT WINGET_WAIT '
  + 'WORKER_EXIT WORKER_FAILED WORKER_SPAWN WORKER_STATE WORKER_UNAVAILABLE WRITE_KEY '
  // worker/, ui/ and the engine's default failure codes (조율 세션 부탁, 11-16 밤)
  + 'DECLINED DUPLICATE_BOOT EXECUTABLE FAILED HOST_FAILED HOST_TIMEOUT INTERRUPTED INVALID_METHOD LAST_FOLDER MOVE_FAILED MOVE_NOT_IN_STREAM MOVE_WRITE_CHANGED NO_BRIDGE NO_METHOD NOT_READY PARENT_CLOSED QUOTA READ_FAILED REINSTALL_FAILED RESTORE_FAILED RESTORE_INCOMPLETE RUN_BUSY RUN_INPUT RUN_SKIP RUN_TRIGGER START_FAILED STARTUP_READ_FAILED TIMEOUT WINGET_ADMIN_MISSING '
  // the system error names Node gives (fixed words, useful to tell a locked file from a full disk)
  + 'EACCES EAI_AGAIN EBUSY ECONNREFUSED ECONNRESET EEXIST EISDIR EMFILE ENOENT ENOSPC ENOTDIR ENOTEMPTY ENOTFOUND EPERM EPIPE EROFS ETIMEDOUT EXDEV').split(' '));
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}(?:-[a-z0-9.]{1,20})?$/;
const WINDOWS = /^\d{1,2}\.\d{1,2}\.\d{1,6}(?:\.\d{1,6})?$/;
const MAX_RUNS = 200, MAX_ITEMS = 500, WEEK = 7 * 86400000, HELP_AGE = 30 * 86400000;

class Drop extends Error {}
const int = (v) => { if (!Number.isSafeInteger(v) || v < 0) throw new Drop(); return v; };
const opt = (v, f) => (v === undefined || v === null ? undefined : f(v));
const time = (now, age = WEEK + 86400000) => (v) => { int(v); if (v > now + 3600000 || v < now - age) throw new Drop(); return v; };
const word = (set) => (v) => { if (typeof v !== 'string' || !set.has(v)) throw new Drop(); return v; };
const pattern = (re) => (v) => { if (typeof v !== 'string' || !re.test(v)) throw new Drop(); return v; };

function shape(input, spec, counter) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Drop();
  const out = {};
  for (const k of Object.keys(input)) if (!Object.hasOwn(spec, k)) counter.unknown++;
  for (const [k, f] of Object.entries(spec)) {
    const v = input[k];
    if (v === undefined || v === null) continue;
    out[k] = typeof f === 'function' ? f(v) : shape(v, f, counter);
  }
  return out;
}

export function cleanBatch(body, { now = Date.now(), age } = {}) {
  const counter = { unknown: 0, items: 0 };
  const t = time(now, age);
  const runSpec = {
    trigger: word(TRIGGER), startedAt: t, durationMs: int, result: word(RESULT), pause: word(PAUSE), exitCode: (v) => { if (!Number.isSafeInteger(v) || v < -(2 ** 31) || v > 2 ** 32 - 1) throw new Drop(); return v; },
    unreadable: int, files: { new: int, changed: int, unmodified: int }, bytes: { added: int, processed: int },
    peakMemory: int, cpuMs: int, workerReadyMs: int, resticStartMs: int, fill: { tried: (v) => { if (typeof v !== 'boolean') throw new Drop(); return v; }, result: word(FILL) },
    proof: { checked: int, damaged: int, changedSource: int, noSample: int }, prunedSnapshots: int, transferred: { up: int, down: int },
    massChangeConfirmed: (v) => { if (typeof v !== 'boolean') throw new Drop(); return v; },
  };
  const take = (list, max, spec, required) => {
    if (list === undefined) return [];
    if (!Array.isArray(list)) throw Object.assign(new Error('BAD_INPUT'), { code: 'BAD_INPUT' });
    const out = [];
    for (const item of list.slice(0, max)) {
      try { const v = shape(item, spec, counter); for (const r of required) if (v[r] === undefined) throw new Drop(); out.push(v); }
      catch (e) { if (!(e instanceof Drop)) throw e; counter.items++; }
    }
    counter.items += Math.max(0, list.length - max);
    return out;
  };
  let env = {};
  try { env = body?.env === undefined ? {} : shape(body.env, { appVersion: pattern(VERSION), windows: pattern(WINDOWS), standby: word(STANDBY) }, counter); }
  catch (e) { if (!(e instanceof Drop)) throw e; counter.items++; env = {}; }
  const runs = take(body?.runs, MAX_RUNS, runSpec, ['startedAt', 'result']);
  const notifications = take(body?.notifications, MAX_ITEMS, { kind: word(NOTICE_KINDS), shownAt: t, clickedAt: t }, ['kind']);
  const installs = take(body?.installs, MAX_ITEMS, { step: word(INSTALL_STEPS), durationMs: int, ok: (v) => { if (typeof v !== 'boolean') throw new Drop(); return v; } }, ['step']);
  for (const k of Object.keys(body || {})) if (!['env', 'runs', 'notifications', 'installs'].includes(k)) counter.unknown++;
  return { env, runs, notifications, installs, dropped: { unknownFields: counter.unknown, items: counter.items } };
}

// A help request bundle (4.9 「도움 요청」): the same checks as measurements — environment,
// up to 50 recent run records, error codes (upper-case words), and a settings summary of
// counts and fixed words. Free text lives only in the customer's own message.
export function cleanBundle(bundle, { now = Date.now() } = {}) {
  const b = bundle && typeof bundle === 'object' && !Array.isArray(bundle) ? bundle : {};
  const batch = cleanBatch({ env: b.env, runs: Array.isArray(b.runs) ? b.runs.slice(0, 50) : undefined }, { now, age: HELP_AGE });
  const codes = (Array.isArray(b.errorCodes) ? b.errorCodes : []).filter((c) => typeof c === 'string' && ERROR_CODE.test(c) && KNOWN_ERROR_CODES.has(c)).slice(0, 50);
  const st = b.settings && typeof b.settings === 'object' ? b.settings : {};
  const settings = {};
  for (const k of ['sources', 'removedSources', 'profiles']) if (Number.isSafeInteger(st[k]) && st[k] >= 0) settings[k] = st[k];
  for (const k of ['automatic', 'readOnly', 'paused', 'helper', 'tray']) if (typeof st[k] === 'boolean') settings[k] = st[k];
  if (['backup', 'restore'].includes(st.mode)) settings.mode = st.mode;
  return { env: batch.env, runs: batch.runs, errorCodes: codes, settings };
}
