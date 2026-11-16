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
  'home-restored': { ...base, lastSelectedRestore: { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 2026-11-13', at: at('2026-11-13T14:20:00+09:00'), files: 3, bytes: 6381567 } },
  start: { version: '0.7.0', configured: false, sources: [], job: null, protection: { level: 'setup', reason: 'setup', nextAction: 'setup' } },
};
