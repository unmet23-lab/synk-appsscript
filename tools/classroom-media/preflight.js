'use strict';

const fs = require('node:fs');
const DEFAULT_MINIMUM_FREE_BYTES = 20 * 1024 ** 3;
const PLACEHOLDER = /YOUR_PROJECT|REPLACE_[A-Z0-9_]*/i;
const MANUAL_CHECKS = [
  { code: 'OBS_STREAM_AND_RECORDING_SETTINGS', description: 'OBS 교실 스트림 연결, 녹화 완료 스크립트, 자동 remux·파일 분할 끄기를 확인하세요.' },
  { code: 'CAMERA_INPUT', description: '실제 송출 화면에서 해당 교실 카메라 영상과 구도를 확인하세요.' },
  { code: 'MICROPHONE_AND_AUDIO', description: '실제 송출을 들어 교사 목소리, 음량, 잡음과 영상·음성 동기를 확인하세요.' },
  { code: 'LOCAL_RECORDING_PLAYBACK', description: '시험 녹화를 종료한 뒤 보존된 파일의 영상과 소리를 끝까지 확인하세요.' },
  { code: 'STUDENT_PRIVATE_VIDEO_ACCESS', description: '비공개 영상의 학생 계정 초대와 실제 재생, 미초대 계정 차단을 확인하세요.' },
];

function placeholderCount(value) {
  if (typeof value === 'string') return PLACEHOLDER.test(value) ? 1 : 0;
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce((count, item) => count + placeholderCount(item), 0);
}

function credentialCheck(value, minimumLength) {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, reason: 'MISSING' };
  if (PLACEHOLDER.test(value)) return { ok: false, reason: 'PLACEHOLDER' };
  if (value !== value.trim() || /[\r\n\0]/.test(value)) return { ok: false, reason: 'INVALID_FORMAT' };
  if (value.length < minimumLength) return { ok: false, reason: 'TOO_SHORT' };
  return { ok: true };
}

// Read-only checks only. ok does NOT certify OBS, media quality, YouTube access,
// filesystem durability or student playback. No folders/files are created here.
// fsImpl is a test seam; config structure is validated by the caller.
function checkLocal(config, { env = process.env, minimumFreeBytes, fsImpl = fs } = {}) {
  const checks = [];
  const placeholders = placeholderCount(config);
  checks.push({ code: 'CONFIG_PLACEHOLDERS', ok: placeholders === 0, count: placeholders });
  checks.push({ code: 'ANON_KEY', ...credentialCheck(env[config.anonKeyEnv], 1) });
  config.classes.forEach((cls, index) => {
    checks.push({ code: 'CLASS_SYNC_KEY', classIndex: index + 1, ...credentialCheck(env[cls.syncKeyEnv], 32) });
  });

  for (const directory of ['stateDir', 'inboxDir', 'recordingsRoot']) {
    const entry = { code: 'DIRECTORY_READY', directory, ok: false };
    try {
      if (!fsImpl.statSync(config[directory]).isDirectory()) entry.reason = 'NOT_DIRECTORY';
      else {
        try { fsImpl.accessSync(config[directory], fs.constants.R_OK); }
        catch { entry.reason = 'NOT_READABLE'; }
        if (!entry.reason) {
          try { fsImpl.accessSync(config[directory], fs.constants.W_OK); }
          catch { entry.reason = 'NOT_WRITABLE'; }
        }
        entry.ok = !entry.reason;
      }
    } catch (error) { entry.reason = error?.code === 'ENOENT' ? 'MISSING' : 'UNAVAILABLE'; }
    checks.push(entry);
  }

  const threshold = minimumFreeBytes ?? config.minimumFreeBytes ?? DEFAULT_MINIMUM_FREE_BYTES;
  const validThreshold = Number.isSafeInteger(threshold) && threshold > 0;
  checks.push({ code: 'MINIMUM_FREE_BYTES', ok: validThreshold, ...(validThreshold ? { minimumFreeBytes: threshold } : { reason: 'POSITIVE_SAFE_INTEGER_REQUIRED' }) });
  const disk = { code: 'RECORDING_DISK_SPACE', ok: false };
  if (!validThreshold) disk.reason = 'INVALID_MINIMUM';
  else {
    disk.minimumFreeBytes = threshold;
    try {
      const stat = fsImpl.statfsSync(config.recordingsRoot, { bigint: true });
      const blockSize = BigInt(stat.bsize), availableBlocks = BigInt(stat.bavail);
      if (blockSize <= 0n || availableBlocks < 0n) throw new Error('INVALID_DISK_METADATA');
      const bytes = blockSize * availableBlocks;
      disk.freeBytes = Number(bytes > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : bytes);
      if (bytes > BigInt(Number.MAX_SAFE_INTEGER)) disk.freeBytesCapped = true;
      disk.ok = bytes >= BigInt(threshold);
      if (!disk.ok) disk.reason = 'INSUFFICIENT_SPACE';
    } catch { disk.reason = 'SPACE_UNAVAILABLE'; }
  }
  checks.push(disk);

  return {
    ok: checks.every(check => check.ok),
    scope: 'local-automatic-only',
    checks,
    manualChecksRequired: MANUAL_CHECKS.map(check => ({ ...check })),
  };
}

module.exports = { checkLocal, DEFAULT_MINIMUM_FREE_BYTES };
