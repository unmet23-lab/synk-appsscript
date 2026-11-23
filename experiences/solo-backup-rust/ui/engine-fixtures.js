// 예시 상태 — 시안 A의 예시 자료(ui-mockups/_src/copy.mjs)와 같은 하루(2026-11-13 금)를 워커 state() 모양으로 옮겼다.
// 시험과 tauri-driver 시험이 쓰고, 엔진에 아직 없는 상태(screen-model.js FUTURE)의 화면을 그려 보는 데만 쓴다. 앱이 저절로 읽지 않는다.

const at = (s) => new Date(s).toISOString();
export const NOW = Date.parse('2026-11-13T14:40:00+09:00');

const SOURCES = ['C:\\Users\\studio\\Documents', 'C:\\Users\\studio\\Desktop', 'C:\\Users\\studio\\Pictures', 'D:\\Projects'];
const GB = 1024 ** 3;

// 솔리오 잇기(설계 4.13 · 4.14 · 4.16 — 엔진 305e380fe): 창 상태의 solio 칸
const SOLIO = { setup: null, restNetworks: [], aiTools: { tools: { space_report: false, find_restorable: false }, masks: [], clients: [] } };
// 공간 비우기 2판(시험 표식이 있는 PC): 켜기 전 미리 보기 한 번과 드라이브 둘
const SPACE_FREE = { open: true, on: false, since: null, lines: [{ drive: 'C', size: 953 * 2 ** 30, free: 102 * 2 ** 30, gb: 400, set: true }, { drive: 'D', size: 1907 * 2 ** 30, free: 357 * 2 ** 30, gb: 150, set: false }],
  last: { at: '2026-11-24T01:10:00.000Z', preview: true, bytes: 9.6 * 2 ** 30, count: 41, items: [
    { kind: 'node_modules', path: 'C:\\Users\\studio\\dev\\landing-2025\\node_modules', n: 1, bytes: 1.9 * 2 ** 30 },
    { kind: 'target', path: 'C:\\Users\\studio\\dev\\cli-tool\\target', n: 1, bytes: 5.2 * 2 ** 30 },
    { kind: 'temp', path: null, n: 39, bytes: 2.5 * 2 ** 30 }] } };
const SOLIO_SET = { setup: null, restNetworks: ['휴대폰 핫스팟', 'Cafe_Free', '사무실 손님'], spaceFree: SPACE_FREE, aiTools: { tools: { space_report: false, find_restorable: true }, masks: ['건강', '계약'],
  clients: [{ name: 'claude-code', version: '2.1.0', exe: 'C:\\Users\\studio\\AppData\\Local\\AnthropicClaude\\claude.exe', firstSeen: '2026-11-10T01:00:00Z', lastSeen: '2026-11-13T04:40:00Z' }] } };
// 한꺼번에 지워짐 · 바뀜(설계 4.4 — 엔진 massHold, 조율 세션 9ddcbeb40). 어제 오전 판과 오늘 오후 2시 판 사이에 「문서」에서 3,980개가 사라지고
// 「사진」에서 12개가 바뀌었다. 목록은 엔진처럼 500개까지다
const massItems = [];
for (const [dir, stem, ext] of [['계약/2026', '계약서', 'docx'], ['견적', '견적', 'xlsx'], ['회계/세금계산서', '세금계산서', 'pdf'], ['회의록', '회의록', 'hwp']]) {
  for (let i = 1; i <= 122; i++) massItems.push({ folder: SOURCES[0], name: `${dir}/${stem} ${String(i).padStart(3, '0')}.${ext}`, kind: 'removed' });
}
for (let i = 1; i <= 12; i++) massItems.push({ folder: SOURCES[2], name: `2026 송년회/IMG_${4100 + i}.jpg`, kind: 'changed' });
const MASS = { since: at('2026-11-13T14:05:00+09:00'), at: at('2026-11-13T14:02:00+09:00'), kind: 'removed', path: SOURCES[0], removed: 3980, changed: 12,
  removedBytes: Math.round(3.1 * GB), left: 1330, totalNow: 8500, bytesNow: Math.round(12.3 * GB), before: 12480, beforeId: 'c'.repeat(64),
  beforeAt: at('2026-11-12T11:02:00+09:00'), afterId: 'a'.repeat(64), folders: [{ path: SOURCES[0], removed: 3980, changed: 0 }, { path: SOURCES[2], removed: 0, changed: 12 }],
  list: massItems, compared: [{ path: SOURCES[0], at: at('2026-11-13T14:02:00+09:00') }, { path: SOURCES[2], at: at('2026-11-13T14:02:00+09:00') }] };
const MASS_CHANGED = { ...MASS, kind: 'changed', path: SOURCES[2], removed: 0, changed: 2412, removedBytes: 0, left: 4880, totalNow: 12480, bytesNow: Math.round(18.9 * GB),
  folders: [{ path: SOURCES[2], removed: 0, changed: 2400 }, { path: SOURCES[3], removed: 0, changed: 12 }],
  list: Array.from({ length: 500 }, (_, i) => ({ folder: i < 488 ? SOURCES[2] : SOURCES[3], name: i < 488 ? `2026 송년회/IMG_${4000 + i}.jpg` : `견적서/견적 ${i}.xlsx`, kind: 'changed' })) };
const MASS_BYTES = { ...MASS, kind: 'bytes', path: SOURCES[3], removed: 3, changed: 0, removedBytes: Math.round(4.1 * GB), left: 1867, totalNow: 12477, bytesNow: Math.round(14.3 * GB),
  folders: [{ path: SOURCES[3], removed: 3, changed: 0 }], list: ['촬영 원본/1일차.mp4', '촬영 원본/2일차.mp4', '편집본/최종.mov'].map((name) => ({ folder: SOURCES[3], name, kind: 'removed' })) };
// 판의 폴더를 가르지 못한 판 — path · folder가 null이고 이름이 판 안의 경로다
const MASS_NOFOLDER = { ...MASS, path: null, left: null, folders: [],
  list: [{ folder: null, name: '/C/Users/studio/Documents/계약/2026/계약서 001.docx', kind: 'removed' }, { folder: null, name: '/C/Users/studio/Documents/견적/견적 001.xlsx', kind: 'removed' }] };
const MASS_DONE = { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일)', at: at('2026-11-13T14:30:00+09:00'), fromEarlier: 0, inNone: 0, mass: { beforeId: MASS.beforeId, beforeAt: MASS.beforeAt, folder: null, sub: '' } };
const MASS_P = { level: 'attention', reason: 'mass', nextAction: 'mass' };
// 이 백업에 담지 못하는 이름(설계 4.2 — leftOutNames, 엔진 b18e0775b — 다 본 걷기면 checked 칸이 없다). 이름 끝이 점(.)이나 빈칸이라 Windows에서 백업하지 못한다
const LEFT = { at: at('2026-11-13T14:02:00+09:00'), count: 3, cut: false,
  names: ['C:\\Users\\studio\\Documents\\견적\\2026 견적서.', 'C:\\Users\\studio\\Desktop\\회의록 ', 'D:\\Projects\\맥에서 옮김.'] };
const LEFT_MANY = { ...LEFT, count: 1000, cut: true, names: Array.from({ length: 1000 }, (_, i) => `D:\\Projects\\내려받은 자료\\묶음 ${String(i + 1).padStart(4, '0')}.`) };
const LEFT_UNCHECKED = { ...LEFT, count: 2, names: LEFT.names.slice(0, 2), checked: false };
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
  protection: { level: 'active', reason: 'active', nextAction: 'backup' }, solio: SOLIO,
};

const acct = (v = {}) => ({ available: true, signedIn: false, email: null, connected: false, role: null, deviceId: null, device: '새 데스크톱', writer: null,
  googleStepRequired: false, needs: [], envelope: null, envelopeInvalid: false, damaged: [], ...v });
const signed = (role) => ({ signedIn: true, email: 'studio@example.com', connected: true, role, deviceId: 'd'.repeat(12) });
const restoreOf = (v) => ({ hold: true, jobId: 'job-1', state: null, awaitingChoice: false, at: Date.parse('2026-11-12T14:59:00+09:00'), byThisDevice: true, error: null, undo: false, ...v });
const first = { version: '0.7.0', configured: false, mode: 'backup', profile: 'b2', device: '새 데스크톱', sources: [], selection: { sources: [], target: null }, job: null,
  protection: { level: 'setup', reason: 'setup', nextAction: 'setup' }, solio: SOLIO };

export const STATES = {
  home: base,
  // 쉬는 Wi-Fi 셋 · 백업 안 파일 찾기를 켜고 가리는 낱말 둘 · 이어 온 AI 도구 하나
  'home-solio': { ...base, solio: SOLIO_SET },
  // 공간 비우기 2판을 켠 뒤 — 지난 누름에 실제로 비운 것
  'home-space-on': { ...base, solio: { ...SOLIO_SET, spaceFree: { ...SPACE_FREE, on: true, since: '2026-11-24T00:40:00.000Z', last: { ...SPACE_FREE.last, preview: false } } } },
  'home-run': { ...base, job: { kind: 'backup', stage: '예약 백업 · 작업 파일 백업 중', percent: 62, scheduled: true }, nextBackupAt: at('2026-11-13T16:02:00+09:00'), protection: { level: 'running', reason: 'job', nextAction: 'none' } },
  'home-partial': { ...base, lastBackup: { ...base.lastBackup, at: at('2026-11-13T13:02:00+09:00') }, lastPartial: { id: 'b'.repeat(64), at: at('2026-11-13T14:02:00+09:00'), unreadable: 2, cut: false, files: 12480, bytes: Math.round(18.4 * GB), program: 'Outlook' }, admin: true },
  'home-missing': { ...base, missingSources: [SOURCES[3]], lastBackup: { ...base.lastBackup, files: 10610, bytes: Math.round(16.2 * GB) } },
  'home-mass': { ...base, massHold: MASS, protection: MASS_P },
  'home-mass-changed': { ...base, massHold: MASS_CHANGED, protection: MASS_P },
  'home-mass-bytes': { ...base, massHold: MASS_BYTES, protection: MASS_P },
  'home-mass-nofolder': { ...base, massHold: MASS_NOFOLDER, protection: MASS_P },
  // 지워지기 전 판에서 되살린 뒤(lastRestore.mass) — 멈춤은 「확인을 마침」까지 남는다
  'home-mass-restored': { ...base, massHold: MASS, protection: MASS_P, lastRestore: MASS_DONE },
  // 받은 범위(E31, 엔진 b18e0775b — { folder, sub }): 「사진」 하나만 받음 · 범위를 모름(범위를 적기 전 엔진, 창을 다시 연 뒤)
  'home-mass-restored-one': { ...base, massHold: MASS, protection: MASS_P, lastRestore: { ...MASS_DONE, mass: { ...MASS_DONE.mass, folder: SOURCES[2], sub: '' } } },
  'home-mass-restored-unknown': { ...base, massHold: MASS, protection: MASS_P, lastRestore: { ...MASS_DONE, mass: { beforeId: MASS.beforeId, beforeAt: MASS.beforeAt } } },
  // 지키는 네 폴더가 모두 바뀐 멈춤(랜섬웨어 꼴) — 확인서에는 많이 바뀐 두 곳만 줄로 둔다
  'home-mass-four': { ...base, massHold: { ...MASS, kind: 'changed', removed: 0, changed: 12470, folders: SOURCES.map((path, i) => ({ path, removed: 0, changed: [5310, 420, 4870, 1870][i] })), list: massItems.map((x) => ({ ...x, kind: 'changed' })) }, protection: MASS_P },
  // 멈춤이 있는 동안 끝난 되살리기의 실패 — 100만 개를 넘는 폴더
  'home-mass-failed': { ...base, massHold: MASS, protection: MASS_P, lastRestoreError: { code: 'CATALOG_TOO_LARGE', at: at('2026-11-13T14:20:00+09:00') } },
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
  // 도는 되살리기 · 그만두는 중 · 그만둔 뒤(요청 16, 조율 세션 60a9de51e). 그만둔 뒤 엔진은 실패 칸에 CANCELED와 만들다 만 폴더를 적고 건강은 그대로 둔다
  'home-restoring': { ...base, job: { kind: 'restore', stage: '파일 복구 및 내용 검증 중', percent: null }, protection: { level: 'running', reason: 'job', nextAction: 'none' } },
  'home-restore-stopping': { ...base, job: { kind: 'restore-selected', stage: '되살리기를 그만두는 중', percent: null, cancelled: true }, protection: { level: 'running', reason: 'job', nextAction: 'none' } },
  // 옛 PC 판의 범위를 통째로 받음 · 그 실패 · 고른 파일 받기의 겹침(E27 · E26 알림 · E29, 조율 세션 ced52da00)
  'home-scope-done': { ...base, lastRestore: { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일)', at: at('2026-11-13T14:21:00+09:00'), fromEarlier: 0, inNone: 0, skipped: 2,
    scope: { from: 'f'.repeat(12), folder: 'C:\\Users\\studio\\Pictures', sub: '2024/여행', snapshotAt: at('2026-11-12T21:00:00+09:00') } } },
  'home-scope-big': { ...base, lastRestoreError: { code: 'CATALOG_TOO_LARGE', at: at('2026-11-13T14:21:00+09:00'), from: 'f'.repeat(12) } },
  'home-scope-unsafe-sel': { ...base, lastSelectedRestoreError: { code: 'OUTPUT_UNSAFE', at: at('2026-11-13T14:21:00+09:00'), from: 'f'.repeat(12) } },
  'home-scope-failed': { ...base, health: { status: 'attention', checkedAt: at('2026-11-13T14:21:00+09:00'), detail: '복구 또는 검증이 끝나지 않았습니다.' }, protection: { level: 'attention', reason: 'health', nextAction: 'check' },
    lastRestoreError: { code: 'RESTORE_FAILED', at: at('2026-11-13T14:21:00+09:00'), from: 'f'.repeat(12), path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일)' } },
  'home-restore-stopped': { ...base, lastRestoreError: { code: 'CANCELED', at: at('2026-11-13T14:21:00+09:00'), path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 13일)', named: true } },
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
  // 솔리오의 「보호 시작」 · 「이 PC로 옮겨 오기」로 온 처음 시작(state.solio.setup, 30분)
  'start-solio': { ...first, account: acct(), solio: { ...SOLIO, setup: { mode: 'protect', hint: 'studio@example.com', at: '2026-11-17T04:00:00.000Z' } } },
  'start-solio-move': { ...first, account: acct(), solio: { ...SOLIO, setup: { mode: 'move', hint: null, at: '2026-11-17T04:00:00.000Z' } } },
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
  'home-leftout': { ...base, leftOutNames: LEFT },
  'home-leftout-many': { ...base, leftOutNames: LEFT_MANY },
  'home-leftout-unchecked': { ...base, leftOutNames: LEFT_UNCHECKED },
  // 이름을 다 보지 못했지만 찾은 것이 없음 — 기본 화면은 그대로 「안전합니다」
  'home-leftout-none': { ...base, leftOutNames: { at: LEFT.at, count: 0, names: [], cut: false, checked: false } },
  'home-restore-wait': { ...base, nextBackupAt: null, account: acct({ ...signed('write'), device: base.device, needs: ['restore'] }) },
};

// 옛 PC 백업에서 꺼내기(조율 세션 793e0d6dc — browseBackupFolder · openFileCatalog의 from · folder · sub). 창이 기억하는 고름(app.js의 old)과
// 그 범위로 연 목록(catalog.req). 옛 기기는 MOVE_MV의 작업 노트북(f×12)이고, 사진 폴더는 100만 개를 넘어 옮기지 않았다(toobigResult)
export const { OLD_PC, OLD_CATALOG } = (() => {
  const from = 'f'.repeat(12), PIC = 'C:\\Users\\studio\\Pictures', snapshotAt = '2026-11-13T14:02:00+09:00';
  const level = { profile: 'b2', from, folder: PIC, sub: '', snapshotAt, folders: ['2023', '2024', '2025', '카메라 원본'], files: 12 };
  const OLD_PC = {
    root: { from, folder: null, label: null, sub: '' },
    reading: { from, folder: PIC, label: '사진', sub: '', level: undefined, error: null, code: null },
    browse: { from, folder: PIC, label: '사진', sub: '', level, error: null, code: null },
    // 안쪽 층 — 100만 개 넘는 「사진」 안이라 통째로 꺼낼 수 있다(E27)
    inner: { from, folder: PIC, label: '사진', sub: '2025', level: { ...level, sub: '2025', folders: ['01월', '02월', '03월'], files: 48 }, error: null, code: null },
    deep: { from, folder: PIC, label: '사진', sub: '2024', level: { ...level, sub: '2024', folders: ['01월', '02월', '03월', '04월', '05월', '06월', '07월', '08월', '09월', '10월', '11월', '여행'], files: 3, leftOut: 1 }, error: null, code: null },
    // 바로 안에 파일만 20만 개 넘게 둔 층 — 나눌 수 없다(browseBackupFolder의 CATALOG_TOO_LARGE)
    noSplit: { from, folder: PIC, label: '사진', sub: '카메라 원본', level: null, code: 'CATALOG_TOO_LARGE', error: '' },
    stale: { from, folder: PIC, label: '사진', sub: '2024/여행', level: null, code: 'INVALID_REQUEST', error: '백업의 폴더가 바뀌어 고른 자리를 찾지 못했습니다. 처음부터 다시 골라 주세요.' },
  };
  // 창이 연 범위 — 옛 기기 이름은 화면이 그릴 때 계정의 기기 목록에서 정한다(MOVE_ACCT)
  const req = { from, folder: PIC, label: '사진', sub: '2024/여행' };
  const OLD_CATALOG = {
    ok: { profile: 'b2', token: 't', from, snapshotAt, scope: [{ source: '03-Pictures', folder: PIC, sub: '2024/여행' }], fileCount: 1842, totalBytes: 9663676416, query: '', offset: 0, total: 1842, loading: false, req,
      selection: { revision: 2, count: 2, bytes: 10485760 },
      rows: [
        { id: '1', name: 'IMG_2041.jpg', source: '03-Pictures', path: '/2024/여행/제주/IMG_2041.jpg', size: 5242880, mtime: '2024-07-21T10:00:00+09:00', selected: true },
        { id: '2', name: 'IMG_2042.jpg', source: '03-Pictures', path: '/2024/여행/제주/IMG_2042.jpg', size: 5242880, mtime: '2024-07-21T10:01:00+09:00', selected: true },
        { id: '3', name: '일정표.xlsx', source: '03-Pictures', path: '/2024/여행/일정표.xlsx', size: 31744, mtime: '2024-07-02T10:00:00+09:00', selected: false },
      ] },
    tooLarge: { loading: false, req: { ...req, sub: '2024' }, rows: [], errorCode: 'CATALOG_TOO_LARGE', error: '이 폴더는 파일이 너무 많아 한 번에 열 수 없습니다. 「다른 폴더 고르기」에서 안쪽 폴더를 골라 나눠 열어 주세요.' },
  };
  OLD_PC.noSplit.error = '이 폴더는 이 앱으로는 꺼낼 수 없습니다. 바로 안에 파일이 너무 많아 안쪽 폴더로 나눠 열 수 없습니다. 옛 PC의 백업에는 그대로 있습니다. 옛 PC를 아직 쓸 수 있으면, 정리하기 전에 그 폴더를 USB나 외장 디스크로 직접 옮겨 두세요.';
  return { OLD_PC, OLD_CATALOG };
})();

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
  // 앞선 판에서 100만 개 넘는 폴더로 멈춘 옮겨 오기 — 지금 판은 그 폴더만 빼고 이어서 옮겨 온다(E25)
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
    // 사진 폴더가 100만 개를 넘음(E25) — 미리 보기는 거절하지 않고 그 폴더만 tooBig · skip · files 0으로 준다. 손님이 고른 자리가 있어도 엔진은 건너뛴다
    toobig: (() => {
      const fs2 = preview.folders.map((x) => (x.label === '사진' ? { ...x, tooBig: true, mode: 'skip', modes: ['skip'], files: 0, bytes: 0 } : x));
      const files = fs2.reduce((n, x) => n + x.files, 0), bytes = fs2.reduce((n, x) => n + x.bytes, 0);
      return { state: null, devices, from: OLD, first, choices: { [`${HOME}\\Pictures`]: { mode: 'original' } },
        preview: { ...preview, files, bytes, volumes: [{ ...preview.volumes[0], bytes }], folders: fs2 } };
    })(),
    // 그 옮겨 오기의 결과 — 사진은 folder-skip 항목(tooBig)과 결과 folders[]의 tooBig · roots []로 남고 complete는 거짓이다
    toobigResult: { state: ended, from: OLD, devices,
      result: { ...result, counts: { placed: 7229, same: 352, copy: 12, side: 2, skip: 4, 'folder-skip': 1 },
        items: [...result.items.filter((x) => x.result !== 'fail'), { original: `${HOME}\\Pictures`, result: 'folder-skip', tooBig: true }],
        folders: result.folders.map((x) => (x.label === '사진' ? { ...x, mode: 'skip', roots: [], tooBig: true } : x)) } },
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
  // from · kitAt · kitProblems · installedKnown(E21): 옮겨 온 옛 PC, 꾸러미를 만든 때, 꾸러미를 읽으며 걸린 것, 이 PC의 목록을 읽었는지
  const OLD = 'OLD-LAPTOP', kitAt = at('2026-11-13T13:02:00+09:00');
  const list = { from: OLD, kitAt, kitProblems: [], installedKnown: true, wingetStatus: { ready: true, version: 'v1.12.340' }, table, others, manual, machine: ids('machine'), user: ids('user') };
  // winget이 준비되지 않았으면 이 PC에 깔린 것을 읽지 못해 표는 모두 「깔 것」으로 온다(installedKnown은 null)
  const notReady = (reason) => ({ ...list, installedKnown: null, wingetStatus: { ready: false, reason }, table: table.map((p) => ({ ...p, installed: false, chosen: true })), others: others.map((p) => ({ ...p, name: null, publisher: null, license: null })) });
  // 창 상태 move.reinstall — current · left · approval(E18): 지금 까는 ID, 지금 것을 포함한 남은 수, 관리자 쪽이 아직 「확인」을 받지 못함
  const job = (stage, extra = {}) => ({ running: !['done', 'failed'].includes(stage), stage, at: at('2026-11-13T14:44:00+09:00'), results: null, error: null, current: null, left: null, approval: false, ...extra });
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
  const empty = { from: OLD, kitAt, kitProblems: [], installedKnown: true, wingetStatus: { ready: true, version: 'v1.12.340' }, table: [], others: [], manual: [], machine: [], user: [] };
  // 확인 창 10분 초과(E23 approval-timeout — 아무것도 깔지 않았다)와 사용자용 20분 초과(timeout)
  const late = results.map((r) => (r.scope === 'machine' ? { id: r.id, name: r.name, state: 'approval-timeout', scope: 'machine' } : r.id === 'Anthropic.ClaudeCode' ? { id: r.id, name: r.name, state: 'timeout', scope: 'user', listed: false } : r));
  // 창 상태 — 깔기의 진행과 결과는 작업자 기억(move.reinstall)이다
  const read = STATES['home-move-read'], withJob = (j) => ({ ...read, move: { reinstall: j, progress: null } });
  // 관리자 확인을 기다림(approval) · 확인 뒤 컴퓨터 전체용을 깔고 있음 · 사용자용을 하나씩(지금 Obsidian, 이것까지 2개)
  STATES['home-move-apps-approval'] = withJob(job('elevated', { approval: true, left: 6 }));
  STATES['home-move-apps-elevated'] = withJob(job('elevated', { current: 'OpenJS.NodeJS.LTS', left: 5 }));
  STATES['home-move-apps-user'] = withJob(job('user', { current: 'Obsidian.Obsidian', left: 2 }));
  STATES['home-move-apps-late'] = withJob(job('done', { results: late }));
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
    // 꾸러미 없음 · 규칙 판이 달라 앱 설정을 쓰지 않음 · 이 PC에 깔린 목록을 읽지 못함(E21)
    'apps-nokit': apps({ list: { ...empty, kitAt: null, kitProblems: ['no-kit'] }, checks: always }),
    'apps-rulesold': apps({ list: { ...list, kitProblems: ['rules-old'] } }),
    'apps-unknown': apps({ list: { ...list, installedKnown: false, table: table.map((p) => ({ ...p, installed: false, chosen: true })) } }),
    'apps-late': apps({ ran }),
  });
  // 앱을 다시 켠 뒤 — 작업자 기억(move.reinstall)은 비고, 엔진이 적은 마지막 결과(moveState.reinstall · settings, E17)만 남았다
  const ended = MOVE_MV.result.state, did = at('2026-11-13T14:38:00+09:00'), put = at('2026-11-13T14:39:00+09:00');
  const savedState = { ...ended, checklistLeft: checklist.filter((c) => !c.done).length, begun: true, reinstall: { at: did, results }, settings: { at: put, results: settings } };
  Object.assign(MOVE_MV, {
    'apps-saved': { ...base, state: savedState, apps: { list, checks: checklist } },
    // 깐 뒤 설정을 되돌리기 전에 앱이 끝남 — 적힌 깔기가 적힌 설정보다 뒤다
    'apps-unrestored': { ...base, state: { ...savedState, settings: { at: at('2026-11-13T14:20:00+09:00'), results: okSettings } }, apps: { list, checks: checklist } },
  });
  // 넘긴 뒤(이 PC가 백업한다) — 「프로그램과 설정」을 기본 화면과 설정 서랍에서 연다(E19). 첫 백업 중에 둔 꾸러미가 없으면 목록을 못 읽는다
  const handedState = { ...ended, checklistLeft: checklist.filter((c) => !c.done).length, begun: true, reinstall: null, settings: null };
  STATES['home-handed-run'] = { ...STATES['home-run'], job: { kind: 'backup', stage: '첫 백업 · 작업 파일 백업 중', percent: 12, scheduled: false } };
  STATES['home-handed-installing'] = { ...STATES.home, move: { reinstall: job('user', { current: 'Obsidian.Obsidian', left: 2 }), progress: null } };
  Object.assign(MOVE_MV, {
    handed: { state: handedState },
    'apps-handed': { state: handedState, apps: { list, checks: checklist } },
    'apps-handed-busy': { state: handedState, apps: { list: null, listError: 'JOB_BUSY', checks: null } },
    'apps-handed-done': { state: { ...handedState, checklistLeft: 0 }, apps: { list, checks: checklist.map((c) => ({ ...c, done: true })) } },
  });
  return { list, notReady, empty, job, results, ok, declined, late, settings, okSettings, checklist, always };
})();

// 쓰는 중인 파일 · 자동 백업 꺼짐과 함께
STATES['home-leftout-partial'] = { ...STATES['home-partial'], leftOutNames: LEFT };
STATES['home-leftout-off'] = { ...STATES['home-off'], leftOutNames: LEFT };
// 담지 못한 이름보다 먼저 서는 주의 화면에도 한 줄과 고리(Opus 대체 검수 F1) — 760×640에서 주 단추가 첫 화면에 남는지 캡처가 잰다
for (const k of ['home-lost-step', 'home-writekey', 'home-missing', 'home-probe', 'home-mass', 'home-mass-failed', 'home-restore-error', 'home-health', 'home-error', 'home-overdue', 'home-credential', 'home-startup', 'home-paused']) {
  STATES[`${k}-leftout`] = { ...STATES[k], leftOutNames: LEFT };
}
// 쓰는 중인 파일 · 하루 안의 되살리기 결과 · 긴 이름이 한꺼번에(F3)
STATES['home-leftout-busy'] = { ...STATES['home-restored'], lastPartial: STATES['home-partial'].lastPartial, lastBackup: STATES['home-partial'].lastBackup,
  leftOutNames: { ...LEFT, names: ['C:\\Users\\studio\\Documents\\견적\\2026년 11월 거래처별 견적서 최종 수정본 (부가세 포함) v3 - 김대리 검토 반영본 회신용.', ...LEFT.names.slice(1)] } };
