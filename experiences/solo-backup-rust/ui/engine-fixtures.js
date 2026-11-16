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
  // 진행(E7 move.progress)은 옮겨 오기가 도는 동안만 있다
  STATES['home-move-run'] = { ...reader, job: { kind: 'move', stage: '옮겨 오는 중', percent: 42 },
    move: { reinstall: null, progress: { bytes: Math.round(7.7 * GB), total: Math.round(18.4 * GB), folder: `${HOME}\\Pictures`, bytesPerSecond: 24 * 1024 ** 2 } } };
  // 공간이 모자라 멈춘 옮겨 오기(E4) — 놓기 시작한 뒤 이어 할 때도 나므로 공간을 비우고 이어 한다(카본 A2). 실패는 시작(14:10) 뒤에 적혔다
  STATES['home-move-nospace'] = { ...reader, lastMoveError: { code: 'MOVE_NO_SPACE', at: at('2026-11-13T14:12:00+09:00') } };
  // 폴더 하나가 100만 개를 넘어 목록 읽기에서 멈춤 — 미리 보기도 같은 까닭으로 거절되어 자리를 다시 골라도 풀리지 않는다(Fable F1)
  STATES['home-move-listbig'] = { ...reader, lastMoveError: { code: 'MOVE_LIST_TOO_BIG', at: at('2026-11-13T14:12:00+09:00') } };
  STATES['home-move-reading'] = { ...reader, job: { kind: 'move', stage: '준비 중', percent: null } };
  STATES['home-move-quit'] = { ...reader, nextSources: [`${HOME}\\Documents`, 'D:\\Projects'] };

  const folders = [
    { original: `${HOME}\\Documents`, label: '문서', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'local', destination: `${HOME}\\Documents`, newFolder: `${MOVED}\\문서`, sameDrive: null, files: 5310, bytes: Math.round(8.2 * GB), skipped: 4, backupAt: at('2026-11-13T14:02:00+09:00') },
    { original: `${HOME}\\Desktop`, label: '바탕화면', mode: 'newFolder', modes: ['original', 'newFolder', 'skip'], why: 'new-synced', destination: `${HOME}\\OneDrive\\바탕 화면`, newFolder: `${MOVED}\\바탕화면`, sameDrive: null, files: 420, bytes: Math.round(1.1 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00'),
      side: false, sameAccount: false, oldSync: null, newSync: 'oneDrive', partial: false, roots: [{ path: `${MOVED}\\바탕화면`, kind: 'newFolder' }] },
    { original: `${HOME}\\Pictures`, label: '사진', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'local', destination: `${HOME}\\Pictures`, newFolder: `${MOVED}\\사진`, sameDrive: null, files: 4880, bytes: Math.round(6.9 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00') },
    { original: 'D:\\Projects', label: 'Projects', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'local', destination: `${MOVED}\\D 드라이브\\Projects`, newFolder: `${MOVED}\\Projects`, sameDrive: { letter: 'D', fixed: true }, files: 1870, bytes: Math.round(2.2 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00') },
  ];
  const preview = { from: OLD, kitAt: at('2026-11-13T10:00:00+09:00'), kitProblems: [], suggestKeepAsIs: false, folders,
    volumes: [{ volume: 'C:\\', bytes: Math.round(18.4 * GB), free: Math.round(212 * GB), enough: true }], bytes: Math.round(18.4 * GB), files: 12480 };
  // 옛 PC에서 OneDrive 안이던 폴더(E3 partial) — 같은 OneDrive 계정이 아니라 일부만 올 수 있다
  folders.push({ original: `${HOME}\\OneDrive\\견적`, label: '견적', mode: 'original', modes: ['original', 'newFolder', 'skip'], why: 'old-synced', destination: `${MOVED}\\OneDrive\\견적`, newFolder: `${MOVED}\\견적`, sameDrive: null, files: 36, bytes: Math.round(0.2 * GB), skipped: 0, backupAt: at('2026-11-13T14:02:00+09:00'),
    side: false, sameAccount: false, oldSync: 'oneDrive', newSync: null, partial: true, roots: [{ path: `${MOVED}\\OneDrive\\견적`, kind: 'moved' }] });
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
    // 다시 돌린 옮겨 오기 — 앞서 놓고 그대로인 11,800개는 넘겨받았다(E11 counts.carried는 placed · same의 일부)
    carried: { state: { ...ended, complete: true }, from: OLD, devices,
      result: { ...result, complete: true, counts: { placed: 12116, same: 352, copy: 12, carried: 11800 }, items: result.items.filter((x) => x.result === 'copy') } },
    quit: { state: started, from: OLD, quit: true, devices },
    // 멈춘 옮겨 오기(home-move-nospace · home-move-listbig와 함께)
    nospace: { state: started, from: OLD, preview, first, choices: {}, devices },
    // 한 파일도 놓기 전에 공간이 모자라 멈춤 — 엔진이 begun을 주면(E24) 자리를 다시 고른다
    nospaceFresh: { state: { ...started, begun: false }, from: OLD, preview, first, choices: {}, devices },
    // 미리 보기가 목록 초과로 거절됨(state-store.js failureText MOVE_LIST_TOO_BIG의 글)
    listbig: { state: started, from: OLD, devices, errorCode: 'MOVE_LIST_TOO_BIG', error: '파일과 폴더가 100만 개를 넘는 폴더가 있어 지금은 옮겨 올 수 없습니다. 필요한 파일은 「파일 되살리기」로 꺼내 주세요.' },
    // 끝난 옮겨 오기(14:36)를 14:40에 다시 시작했다가 멈춤 — 앞선 결과는 새 결과가 적힐 때까지 남는다(E13)
    rerun: { state: { ...ended, startedAt: at('2026-11-13T14:40:00+09:00'), unfinished: true }, from: OLD, result, devices },
    // 옮겨 온 자리 가운데 지금 이 PC에 없는 곳(E15 exists false) — 사진의 파일이 모두 놓이지 못했다
    gone: { state: ended, from: OLD, devices, result: { ...result, folders: result.folders.map((f) => ({ ...f, roots: f.roots.map((r) => ({ ...r, exists: f.label !== '사진' })) })) } },
    // 옮겨 오기 전에 고른 폴더(nextSources)가 남은 채 옮겨 왔다 — 넘기기 고름은 그것으로 짐작하지 않는다(카본 A3, home-move-saved와 함께)
    saved: { state: ended, from: OLD, result, devices },
  };
  STATES['home-move-saved'] = { ...reader, nextSources: [`${HOME}\\Documents`, 'E:\\거래처'] };
  return { MOVE_ACCT, MOVE_MV };
})();

// 옮겨 오기 4b(다시 깔기 · 앱 설정 되돌리기 · 다시 로그인할 곳) — 꼴은 engine/src/move-service.cjs의 reinstallList · reinstall ·
// restoreSettings · checklist와 worker/handlers.cjs의 창 상태 move.reinstall의 것이다. 표의 주소는 engine/src/move-apps.json의 것이다
export const MOVE_APPS = (() => {
  const HOME = 'C:\\Users\\studio', SIDE = `${HOME}\\옮겨 온 자료\\따로 둔 것\\앱 설정`;
  const row = (id, name, scope, site, license, installed = false) => ({ id, name, scope, site, license, installed, chosen: !installed, command: `winget install --id ${id} -e` });
  const table = [
    row('Git.Git', 'Git', 'machine', 'https://gitforwindows.org/', 'https://github.com/git-for-windows/build-extra/blob/HEAD/LICENSE.txt'),
    row('OpenJS.NodeJS.LTS', 'Node.js LTS', 'machine', 'https://nodejs.org/', 'https://github.com/nodejs/node/blob/main/LICENSE'),
    row('Google.Chrome', 'Google Chrome', 'machine', 'https://www.google.com/chrome/', 'https://www.google.com/chrome/terms/', true),
    row('Kakao.KakaoTalk', '카카오톡', 'machine', 'https://www.kakaocorp.com/', 'https://www.kakao.com/policy/terms'),
    row('Microsoft.VisualStudioCode', 'Visual Studio Code', 'user', 'https://code.visualstudio.com/', 'https://code.visualstudio.com/license'),
    row('Microsoft.WindowsTerminal', 'Windows Terminal', 'user', 'https://aka.ms/terminal', 'https://github.com/microsoft/terminal/blob/main/LICENSE', true),
    row('Obsidian.Obsidian', 'Obsidian', 'user', 'https://obsidian.md/', 'https://obsidian.md/terms'),
    row('Anthropic.ClaudeCode', 'Claude Code', 'user', 'https://claude.com/product/claude-code', 'https://www.anthropic.com/legal/commercial-terms'),
  ];
  const others = [
    { id: 'Notepad++.Notepad++', installed: false, chosen: false, command: 'winget install --id Notepad++.Notepad++ -e', name: 'Notepad++', publisher: 'Notepad++ Team', license: 'https://github.com/notepad-plus-plus/notepad-plus-plus/blob/master/LICENSE' },
    { id: 'VideoLAN.VLC', installed: false, chosen: false, command: 'winget install --id VideoLAN.VLC -e', name: 'VLC media player', publisher: 'VideoLAN', license: 'https://www.videolan.org/legal.html' },
    { id: 'Studio.InvoiceTool', installed: false, chosen: false, command: 'winget install --id Studio.InvoiceTool -e', name: null, publisher: null, license: null },
  ];
  const manual = [
    { name: '네이버 웨일', site: 'https://whale.naver.com/' },
    { name: '한컴오피스', site: 'https://www.hancom.com/' },
    { name: 'Gemini CLI', site: 'https://github.com/google-gemini/gemini-cli', command: 'npm install -g @google/gemini-cli' },
    { name: '세무 회계 프로그램', site: null },
  ];
  const ids = (scope) => table.filter((p) => p.chosen && p.scope === scope).map((p) => p.id);
  const list = { wingetStatus: { ready: true, version: 'v1.12.340' }, table, others, manual, machine: ids('machine'), user: ids('user') };
  // winget이 준비되지 않았으면 이 PC에 깔린 것을 읽지 못해 표는 모두 「깔 것」으로 온다
  const notReady = (reason) => ({ ...list, wingetStatus: { ready: false, reason }, table: table.map((p) => ({ ...p, installed: false, chosen: true })), others: others.map((p) => ({ ...p, name: null, publisher: null, license: null })) });
  const job = (stage, extra = {}) => ({ running: !['done', 'failed'].includes(stage), stage, at: at('2026-11-13T14:44:00+09:00'), results: null, error: null, ...extra });
  const results = [
    { id: 'Git.Git', name: 'Git', state: 'installed', scope: 'machine', listed: true },
    { id: 'OpenJS.NodeJS.LTS', name: 'Node.js LTS', state: 'installed', scope: 'machine', listed: true },
    { id: 'Kakao.KakaoTalk', name: '카카오톡', state: 'failed', scope: 'machine', code: 'EXIT_1603', listed: false },
    { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', state: 'installed', scope: 'user', listed: true },
    { id: 'Obsidian.Obsidian', name: 'Obsidian', state: 'already', scope: 'user', listed: true },
    { id: 'Anthropic.ClaudeCode', name: 'Claude Code', state: 'installed', scope: 'user', listed: null },
  ];
  const ok = results.map((r) => (r.state === 'failed' ? { ...r, state: 'installed', listed: true, code: undefined } : r));
  const declined = results.map((r) => (r.scope === 'machine' ? { id: r.id, name: r.name, state: 'declined', scope: 'machine' } : r));
  const app = (name, label, extra) => ({ app: name, name: label, restored: [], kept: [], side: [], notInstalled: false, dropped: 0, droppedProfiles: [], extensions: [], instructions: false, failed: [], left: [], ...extra });
  const settings = [
    app('git', 'Git', { restored: [`${HOME}\\.gitconfig`] }),
    app('vscode', 'Visual Studio Code', {
      restored: [`${HOME}\\AppData\\Roaming\\Code\\User\\settings.json`, `${HOME}\\AppData\\Roaming\\Code\\User\\keybindings.json`],
      extensions: ['ms-python.python', 'esbenp.prettier-vscode', 'dbaeumer.vscode-eslint'].map((id) => ({ id, command: `code --install-extension ${id}` })) }),
    app('terminal', 'Windows Terminal', {
      kept: [`${HOME}\\AppData\\Local\\Packages\\Microsoft.WindowsTerminal_8wekyb3d8bbwe\\LocalState\\settings.json`],
      side: [`${SIDE}\\Windows Terminal\\Packages\\Microsoft.WindowsTerminal_8wekyb3d8bbwe\\LocalState\\settings.json`], droppedProfiles: ['서버 접속'] }),
    app('obsidian', 'Obsidian', { restored: [`${HOME}\\AppData\\Roaming\\obsidian\\obsidian.json`] }),
    app('claude-code', 'Claude Code', { restored: [`${HOME}\\.claude\\CLAUDE.md`], instructions: true, left: [{ entry: 'settings', rel: null, why: 'secret-looking' }] }),
    app('codex', 'Codex CLI', { notInstalled: true, side: [`${SIDE}\\Codex CLI\\.codex\\AGENTS.md`] }),
  ];
  const checklist = [
    { id: 'app:git', text: 'Git: 처음 push할 때 뜨는 브라우저 창에서 GitHub에 로그인합니다.', done: true },
    { id: 'app:vscode', text: 'Visual Studio Code: 왼쪽 아래 계정 단추로 설정 동기화와 GitHub에 다시 로그인합니다.', done: false },
    { id: 'app:obsidian', text: 'Obsidian: 동기화를 쓰셨다면 설정의 「동기화」에서 다시 로그인합니다.', done: false },
    { id: 'app:claude-code', text: 'Claude Code: 터미널에서 claude를 열고 /login으로 다시 로그인합니다.', done: false },
    { id: 'program:Google.Chrome', text: 'Chrome을 열고 동기화 계정으로 로그인합니다.', done: true },
    { id: 'program:Kakao.KakaoTalk', text: '카카오톡을 열고 휴대폰으로 PC 인증을 합니다.', done: false },
    { id: 'browser', text: '쓰시던 브라우저(Chrome · Edge · 웨일)를 열고 동기화 계정으로 로그인합니다.', done: false },
    { id: 'google-2sv', text: 'Google 계정의 2단계 인증이 켜져 있는지 확인합니다. Google 계정에 들어갈 수 있는 사람은 백업도 읽을 수 있습니다.', done: false },
    { id: 'certificate', text: '공동인증서는 은행이나 정부 누리집의 「인증서 복사(내보내기 · 가져오기)」로 옮깁니다.', done: false },
  ];
  const always = checklist.slice(-3).map((c) => ({ ...c, done: false }));
  const empty = { wingetStatus: { ready: true, version: 'v1.12.340' }, table: [], others: [], manual: [], machine: [], user: [] };
  // 창 상태 — 깔기의 진행과 결과는 작업자 기억(move.reinstall)이다
  const read = STATES['home-move-read'], withJob = (j) => ({ ...read, move: { reinstall: j, progress: null } });
  STATES['home-move-apps-elevated'] = withJob(job('elevated'));
  STATES['home-move-apps-user'] = withJob(job('user'));
  STATES['home-move-apps-done'] = withJob(job('done', { results }));
  STATES['home-move-apps-ok'] = withJob(job('done', { results: ok }));
  // 컴퓨터 전체 몫만 고르고 관리자 확인을 받지 못함 — 하나도 깔리지 않아 설정은 저절로 되돌리지 않는다(Fable D9)
  STATES['home-move-apps-declined'] = withJob(job('done', { results: declined.filter((r) => r.scope === 'machine') }));
  STATES['home-move-apps-failed'] = withJob(job('failed', { error: 'REINSTALL_FAILED' }));
  // 창이 기억하는 「프로그램과 설정」(mv.apps) — 옮겨 온 결과(MOVE_MV.result)와 함께
  const okSettings = settings.filter((a) => !a.notInstalled);
  const ran = list.machine.concat(list.user), base = { ...MOVE_MV.result };
  const apps = (extra) => ({ ...base, apps: { list, checks: checklist, ...extra } });
  Object.assign(MOVE_MV, {
    'apps-loading': { ...base, apps: { checks: checklist } },
    'apps-pick': apps({}),
    'apps-open': apps({ picks: { 'VideoLAN.VLC': true, 'Studio.InvoiceTool': true, 'Kakao.KakaoTalk': false }, open: { others: true, manual: true, cmds: true } }),
    'apps-none': apps({ picks: Object.fromEntries(ran.map((id) => [id, false])) }),
    'apps-notready': apps({ list: notReady('WINGET_MISSING') }),
    'apps-empty': apps({ list: empty, checks: always }),
    'apps-error': apps({ list: null, listError: 'NETWORK' }),
    'apps-running': apps({ ran, names: {} }),
    'apps-restoring': apps({ ran, restoring: true }),
    'apps-result': apps({ ran, settings }),
    'apps-ok': apps({ ran, settings: okSettings }),
    'apps-declined': apps({ ran: list.machine }),
    'apps-failed': apps({ ran }),
    'apps-settings-error': apps({ ran, settingsError: 'RUN_ACTIVE' }),
  });
  return { list, notReady, empty, job, results, ok, declined, settings, okSettings, checklist, always };
})();
