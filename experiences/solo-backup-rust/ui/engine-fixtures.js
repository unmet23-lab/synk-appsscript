// 예시 상태 — 시안 A의 예시 자료(ui-mockups/_src/copy.mjs)와 같은 하루(2026-11-13 금)를 워커 state() 모양으로 옮겼다.
// 시험과 tauri-driver 시험이 쓰고, 엔진에 아직 없는 상태(screen-model.js FUTURE)의 화면을 그려 보는 데만 쓴다. 앱이 저절로 읽지 않는다.

const at = (s) => new Date(s).toISOString();
export const NOW = Date.parse('2026-11-13T14:40:00+09:00');

const SOURCES = ['C:\\Users\\studio\\Documents', 'C:\\Users\\studio\\Desktop', 'C:\\Users\\studio\\Pictures', 'D:\\Projects'];
const GB = 1024 ** 3;

const base = {
  version: '0.7.0', configured: true, mode: 'backup', readOnly: false, automatic: true, providerType: 'b2', profile: 'b2',
  device: '작업 노트북', sources: SOURCES, missingSources: [], intervalMinutes: 60, recoverySaved: true, credentialRequired: false,
  lastBackup: { id: 'a'.repeat(64), at: at('2026-11-13T14:02:00+09:00'), files: 12480, bytes: Math.round(18.4 * GB),
    folders: [
      { path: SOURCES[0], files: 5310, bytes: Math.round(8.2 * GB) }, { path: SOURCES[1], files: 420, bytes: Math.round(1.1 * GB) },
      { path: SOURCES[2], files: 4880, bytes: Math.round(6.9 * GB) }, { path: SOURCES[3], files: 1870, bytes: Math.round(2.2 * GB) },
    ] },
  lastPartial: null, nextBackupAt: at('2026-11-13T15:02:00+09:00'), pausedUntil: null, clockHold: false,
  lastProbe: { result: 'passed', at: at('2026-11-10T10:02:00+09:00'), files: 23, bytes: 61 * 1024 * 1024, nextAt: at('2026-11-17T10:02:00+09:00'), reason: 'sample-decrypted' },
  probeHold: null, health: null, lastError: null, warning: null, job: null, launchAtLogin: true,
  protection: { level: 'active', reason: 'active', nextAction: 'backup' },
};

const acct = (v = {}) => ({ available: true, signedIn: false, email: null, connected: false, role: null, deviceId: null, device: '새 데스크톱', writer: null,
  googleStepRequired: false, needs: [], envelope: null, envelopeInvalid: false, damaged: [], ...v });
const signed = (role) => ({ signedIn: true, email: 'studio@example.com', connected: true, role, deviceId: 'd'.repeat(12) });
const restoreOf = (v) => ({ hold: true, jobId: 'job-1', state: null, awaitingChoice: false, at: Date.parse('2026-11-12T14:59:00+09:00'), byThisDevice: true, error: null, undo: false, ...v });
const first = { version: '0.7.0', configured: false, mode: 'backup', profile: 'b2', device: '새 데스크톱', sources: [], selection: { sources: [], target: null }, job: null,
  protection: { level: 'setup', reason: 'setup', nextAction: 'setup' } };

export const STATES = {
  home: base,
  'home-run': { ...base, job: { kind: 'backup', stage: '예약 백업 · 작업 파일 백업 중', percent: 62, scheduled: true }, nextBackupAt: at('2026-11-13T16:02:00+09:00'), protection: { level: 'running', reason: 'job', nextAction: 'none' } },
  'home-partial': { ...base, lastBackup: { ...base.lastBackup, at: at('2026-11-13T13:02:00+09:00') }, lastPartial: { id: 'b'.repeat(64), at: at('2026-11-13T14:02:00+09:00'), unreadable: 2, cut: false, files: 12480, bytes: Math.round(18.4 * GB), program: 'Outlook' }, admin: true },
  'home-missing': { ...base, missingSources: [SOURCES[3]], lastBackup: { ...base.lastBackup, files: 10610, bytes: Math.round(16.2 * GB) } },
  'home-mass': { ...base, massHold: { at: at('2026-11-13T11:00:00+09:00'), path: SOURCES[0], removed: 3980, left: 1330, totalNow: 8500, bytesNow: Math.round(12.3 * GB), before: 12480 } },
  'home-moved': { ...base, movedTo: { device: '새 데스크톱', at: at('2026-11-13T15:40:00+09:00') }, nextBackupAt: null },
  'home-overdue': { ...base, lastBackup: { ...base.lastBackup, at: at('2026-11-10T18:02:00+09:00') }, protection: { level: 'attention', reason: 'overdue', nextAction: 'protect' } },
  'home-credential': { ...base, credentialRequired: true, protection: { level: 'attention', reason: 'credential', nextAction: 'credentials' } },
  'home-health': { ...base, health: { status: 'attention', detail: '저장소 점검이 끝나지 않았습니다.' }, protection: { level: 'attention', reason: 'health', nextAction: 'check' } },
  'home-paused': { ...base, pausedUntil: at('2026-11-13T18:00:00+09:00'), protection: { level: 'paused', reason: 'paused', nextAction: 'resume' } },
  'home-off': { ...base, automatic: false, nextBackupAt: null, protection: { level: 'off', reason: 'off', nextAction: 'protect' } },
  'home-probe': { ...base, lastProbe: { ...base.lastProbe, result: 'failed', reason: 'size-mismatch' }, probeHold: { since: at('2026-11-13T10:02:00+09:00'), cause: 'size-mismatch' } },
  'home-error': { ...base, lastError: 'B2 저장소에 연결하지 못했습니다: restic exit 1', protection: { level: 'attention', reason: 'error', nextAction: 'protect' } },
  'home-startup': { ...base, launchAtLogin: false, protection: { level: 'partial', reason: 'startup', nextAction: 'protect' } },
  // 전체 되살리기 실패(lastRestoreError — 조율 세션 25d66f324). 엔진은 restic 단계의 실패에 점검 주의도 건다
  'home-restore-error': { ...base, health: { status: 'attention', checkedAt: at('2026-11-13T14:21:00+09:00'), detail: '복구 또는 검증이 끝나지 않았습니다.' }, protection: { level: 'attention', reason: 'health', nextAction: 'check' },
    lastRestoreError: { code: 'RESTORE_FAILED', at: at('2026-11-13T14:21:00+09:00') } },
  'home-restore-unsafe': { ...base, lastRestoreError: { code: 'OUTPUT_UNSAFE', at: at('2026-11-13T14:21:00+09:00') } },
  // 다운로드도 지키는 PC — 되살릴 자리를 처음부터 고르게 한다
  'home-downloads': { ...base, sources: [...SOURCES.slice(0, 3), 'C:\\Users\\studio\\Downloads'] },
  'home-restored': { ...base, lastSelectedRestore: { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 2026-11-13', at: at('2026-11-13T14:20:00+09:00'), files: 3, bytes: 6381567 } },
  start: { version: '0.7.0', configured: false, sources: [], job: null, protection: { level: 'setup', reason: 'setup', nextAction: 'setup' } },
  // 개통(account) 갈래 — 워커 state()의 account · selection 모양(engine/src/account.cjs state())
  'start-noclient': { ...first, account: acct({ available: false }) },
  'start-signin': { ...first, account: acct() },
  'start-write': { ...first, account: acct(signed('write')) },
  'start-write-picked': { ...first, selection: { sources: SOURCES.slice(0, 3), target: null }, account: acct(signed('write')) },
  'start-google-step': { ...first, selection: { sources: SOURCES.slice(0, 3), target: null }, account: acct({ ...signed('write'), googleStepRequired: true }) },
  'start-read': { ...first, account: acct({ ...signed('read'), writer: '작업 노트북' }) },
  'home-writekey': { ...base, account: acct({ ...signed('write'), device: base.device, needs: ['write-key'] }) },
  // 이 PC에 앞서 깔았던 연결이 계정에 남은 PC(account.sameInstall — 조율 세션 616e9dce5)
  'home-same-install': { ...base, account: acct({ ...signed('write'), device: base.device, sameInstall: ['e'.repeat(12)] }) },
  'home-lost-step': { ...base, account: acct({ ...signed('write'), device: base.device, googleStepRequired: true, needs: ['read-key'], googleRemovalUrl: 'https://myaccount.google.com/connections' }) },
  'home-continue': { ...base, mode: 'restore', automatic: false, nextBackupAt: null, sources: [], lastBackup: null, lastProbe: null, selection: { sources: SOURCES.slice(0, 3), target: null }, protection: { level: 'restoreOnly', reason: 'restoreOnly', nextAction: 'restore' }, account: acct({ ...signed('write'), device: base.device }) },
  // 되돌리기(account.restore — 조율 세션 c725f319c). 되돌린 시각은 11-12 오후 2:59
  'home-restore-run': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, restore: restoreOf({ state: 'running' }) }) },
  'home-restore-choose': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, restore: restoreOf({ state: 'done', awaitingChoice: true }) }) },
  'home-restore-failed': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, restore: restoreOf({ state: 'failed', error: 'INTERRUPTED', hold: false }) }) },
  'home-restore-undo': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, restore: restoreOf({ state: 'running', undo: true, jobId: 'job-undo-2' }) }) },
  'home-restore-read': { ...base, mode: 'restore', automatic: false, nextBackupAt: null, sources: [], lastBackup: null, lastProbe: null, nextSources: [SOURCES[0], SOURCES[3]], protection: { level: 'restoreOnly', reason: 'restoreOnly', nextAction: 'restore' }, account: acct({ ...signed('read'), writer: '작업 노트북' }) },
  // 되돌리기 셋(조율 세션 57c3d17e6): 끝난 결과 · 취소 실패 부호 · 복구 전용 PC의 되돌리기
  'home-restore-ended': { ...base, account: acct({ ...signed('write'), device: base.device, restore: null, restoreEnded: { jobId: 'job-1', result: 'continued', at: Date.parse('2026-11-13T11:20:00+09:00') } }) },
  'home-restore-undofail': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, restore: restoreOf({ state: 'done', awaitingChoice: true, undoError: 'FAILED' }) }) },
  'home-restore-read-hold': { ...base, device: '새 데스크톱', mode: 'restore', automatic: false, nextBackupAt: null, sources: [], lastBackup: null, lastProbe: null, protection: { level: 'restoreOnly', reason: 'restoreOnly', nextAction: 'restore' },
    account: acct({ ...signed('write'), device: '새 데스크톱', restore: restoreOf({ state: 'done', awaitingChoice: true }) }) },
  'home-restore-wait': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, needs: ['restore'] }) },
};

// 새 PC로 옮겨 오기(조율 세션 d32d25233 · moveState · folders[].roots) — 새 데스크톱이 같은 계정의 백업을 되살리기 전용으로 열고
// 작업 노트북의 백업을 옮겨 온다. 꼴은 engine/src/move-service.cjs · move-restore.cjs의 것이다
export const { MOVE_ACCT, MOVE_MV } = (() => {
  const OLD = 'f'.repeat(12), ME = 'd'.repeat(12), HOME = 'C:\\Users\\studio', MOVED = `${HOME}\\옮겨 온 자료`, SIDE = `${MOVED}\\따로 둔 것`;
  const reader = { ...STATES['home-restore-read'], device: '새 데스크톱', nextSources: [], account: acct({ ...signed('read'), deviceId: ME, device: '새 데스크톱', writer: '작업 노트북' }) };
  STATES['home-move-read'] = reader;
  STATES['home-move-run'] = { ...reader, job: { kind: 'move', stage: '옮겨 오는 중', percent: 42 } };
  STATES['home-move-reading'] = { ...reader, job: { kind: 'move', stage: '준비 중', percent: null } };
  STATES['home-move-quit'] = { ...reader, nextSources: [`${HOME}\\Documents`, 'D:\\Projects'] };

  const folders = [
    { original: `${HOME}\\Documents`, label: '문서', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'local', destination: `${HOME}\\Documents`, newFolder: `${MOVED}\\문서`, sameDrive: null, files: 5310, bytes: Math.round(8.2 * GB), skipped: 4, backupAt: at('2026-11-13T14:02:00+09:00') },
    { original: `${HOME}\\Desktop`, label: '바탕화면', mode: 'newFolder', modes: ['original', 'newFolder', 'skip'], why: 'new-synced', destination: `${HOME}\\OneDrive\\바탕 화면`, newFolder: `${MOVED}\\바탕화면`, sameDrive: null, files: 420, bytes: Math.round(1.1 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00') },
    { original: `${HOME}\\Pictures`, label: '사진', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'local', destination: `${HOME}\\Pictures`, newFolder: `${MOVED}\\사진`, sameDrive: null, files: 4880, bytes: Math.round(6.9 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00') },
    { original: 'D:\\Projects', label: 'Projects', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'local', destination: `${MOVED}\\D 드라이브\\Projects`, newFolder: `${MOVED}\\Projects`, sameDrive: { letter: 'D', fixed: true }, files: 1870, bytes: Math.round(2.2 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00') },
  ];
  const preview = { from: OLD, kitAt: at('2026-11-13T10:00:00+09:00'), kitProblems: [], suggestKeepAsIs: false, folders,
    volumes: [{ volume: 'C:\\', bytes: Math.round(18.4 * GB), free: Math.round(212 * GB), enough: true }], bytes: Math.round(18.4 * GB), files: 12480 };
  const started = { from: OLD, choices: {}, startedAt: at('2026-11-13T14:10:00+09:00'), unfinished: true, released: null, resultAt: null, complete: null, running: false };
  const ended = { ...started, unfinished: false, resultAt: at('2026-11-13T14:36:00+09:00'), complete: false };
  const docs = (name, extra) => ({ original: `${HOME}\\Documents`, name, ...extra });
  const result = {
    at: at('2026-11-13T14:36:00+09:00'), complete: false, removedTemp: 0, side: SIDE,
    counts: { placed: 12109, same: 352, copy: 12, side: 2, skip: 4, fail: 1 },
    items: [
      docs('My Music', { result: 'skip', c: 'link' }), docs('My Pictures', { result: 'skip', c: 'link' }), docs('My Videos', { result: 'skip', c: 'link' }), docs('옛 견적 바로 가기', { result: 'skip', c: 'link' }),
      docs('견적/견적서_1112.xlsx', { result: 'fail', c: 'MOVE_BUSY', p: `${HOME}\\Documents\\견적\\견적서_1112.xlsx` }),
      docs('WindowsPowerShell/profile.ps1', { result: 'side', p: `${SIDE}\\문서\\WindowsPowerShell\\profile.ps1` }),
      docs('양식/견적 양식.xlsx', { result: 'copy', p: `${HOME}\\Documents\\양식\\견적 양식 (복구본).xlsx` }),
    ],
    folders: [
      { original: `${HOME}\\Documents`, label: '문서', mode: 'original', sameDrive: false, destination: `${HOME}\\Documents`, newFolder: `${MOVED}\\문서`, roots: [{ path: `${HOME}\\Documents`, kind: 'place' }, { path: SIDE, kind: 'side' }] },
      { original: `${HOME}\\Desktop`, label: '바탕화면', mode: 'newFolder', sameDrive: false, destination: `${HOME}\\OneDrive\\바탕 화면`, newFolder: `${MOVED}\\바탕화면`, roots: [{ path: `${MOVED}\\바탕화면`, kind: 'newFolder' }] },
      { original: `${HOME}\\Pictures`, label: '사진', mode: 'original', sameDrive: false, destination: `${HOME}\\Pictures`, newFolder: `${MOVED}\\사진`, roots: [{ path: `${HOME}\\Pictures`, kind: 'place' }] },
      { original: 'D:\\Projects', label: 'Projects', mode: 'original', sameDrive: false, destination: `${MOVED}\\D 드라이브\\Projects`, newFolder: `${MOVED}\\Projects`, roots: [{ path: `${MOVED}\\D 드라이브\\Projects`, kind: 'moved' }] },
    ],
  };
  const first = Object.fromEntries(folders.map((f) => [f.original, { files: f.files, bytes: f.bytes }]));
  const devices = [{ from: OLD, lastBackupAt: at('2026-11-13T14:02:00+09:00') }];
  /** 계정의 기기 목록(devicesList) — 옛 기기 번호의 이름을 찾는다 */
  const MOVE_ACCT = { devices: [
    { id: OLD, name: '작업 노트북', role: 'write', state: 'active', lastSeenAt: Date.parse('2026-11-13T14:02:00+09:00'), current: false },
    { id: ME, name: '새 데스크톱', role: 'read', state: 'active', lastSeenAt: Date.parse('2026-11-13T14:30:00+09:00'), current: true },
  ] };
  /** 창이 기억하는 옮겨 오기(app.js의 mv) — 캡처와 시험이 화면마다 고른다 */
  const MOVE_MV = {
    plan: { state: null, devices, from: OLD, preview, first, choices: {} },
    open: { state: null, devices, from: OLD, preview, first, open: true, dirty: true, choices: { 'D:\\Projects': { mode: 'original', sameDrive: true }, [`${HOME}\\Desktop`]: { mode: 'original' }, [`${HOME}\\Pictures`]: { mode: 'skip' } } },
    short: { state: null, devices, from: OLD, first, choices: {}, preview: { ...preview, volumes: [{ volume: 'C:\\', bytes: Math.round(18.4 * GB), free: Math.round(9.6 * GB), enough: false }] } },
    nokit: { state: started, from: OLD, first, choices: {}, devices: [...devices, { from: 'OLD-DESKTOP', lastBackupAt: at('2026-09-02T18:10:00+09:00') }],
      preview: { ...preview, kitAt: null, kitProblems: ['no-kit'], suggestKeepAsIs: true } },
    loading: { state: null, devices, from: OLD },
    empty: { state: null, devices: [] },
    run: { state: started, from: OLD, preview, first, choices: {} },
    reading: { state: started, from: OLD },
    stopped: { state: started, from: OLD },
    result: { state: ended, from: OLD, result, devices },
    ok: { state: { ...ended, complete: true }, from: OLD, devices,
      result: { ...result, complete: true, counts: { placed: 12116, same: 352, copy: 12 }, items: result.items.filter((x) => x.result === 'copy') } },
    fresh: { state: ended, from: OLD, result, devices: [{ from: OLD, lastBackupAt: at('2026-11-13T14:38:00+09:00') }] },
    quit: { state: started, from: OLD, quit: true, devices },
  };
  return { MOVE_ACCT, MOVE_MV };
})();
