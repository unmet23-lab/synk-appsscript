'use strict';

// Read the scheduled worker's receipts, never credentials or an authentication probe.
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('../lib/공용작업본.js');
const { readText } = require('./status.cjs');

const TIP_WORKER_STATUS = 'output/크레딧작업/팁적용안/마지막확인.json';
const TIP_WORKER_QUOTA = 'output/크레딧작업/구독한도.json';
// A run may take two hours; allow another two hours before marking the receipt old.
const TIP_WORKER_STALE_MS = 4 * 60 * 60_000;
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)
  && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const key = value => {
  const resolved = fs.realpathSync(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

function workerRoot(root) {
  const common = 공용작업본(root);
  const pointer = readText(common, '.git/synk-ops-path', 4096).content.trim();
  if (!path.isAbsolute(pointer) || /[\r\n\0]/.test(pointer) || key(공용작업본(pointer)) !== key(common)) throw new Error('WORKER_SOURCE');
  return pointer;
}

function tipWorkerSnapshot({ root, now = new Date(), sourceRoot } = {}) {
  const unknown = { available: false, state: '미확인', observedState: null, checkedAt: null, stale: true,
    keyAvailability: '미확인', cooldownUntil: null, cooldownActive: false, route: null, directNotificationAttempted: null, source: '운영 사본 마지막확인' };
  let base;
  try { base = sourceRoot || workerRoot(root); } catch { return { ...unknown, coverage: '운영 사본 경로 미확인' }; }
  let receipt;
  try { receipt = JSON.parse(readText(base, TIP_WORKER_STATUS, 8192).content); } catch { return { ...unknown, coverage: '마지막확인 없음 또는 읽기 실패' }; }
  const checkedAt = iso(receipt?.시각);
  const states = { 한도쉼: '한도쉼', 키없음: '키없음', 실패: '실패', 할일없음: '할일없음', 끝: '성공', 성공: '성공' };
  const observedState = Object.hasOwn(states, receipt?.상태) ? states[receipt.상태] : null;
  const age = checkedAt ? new Date(now).getTime() - Date.parse(checkedAt) : NaN;
  if (receipt?.이름 !== '팁적용안' || !observedState || !Number.isFinite(age) || age < -60_000) return { ...unknown, coverage: '마지막확인 형식 또는 시각 미확인' };
  let cooldownUntil = null;
  if (observedState === '한도쉼') {
    cooldownUntil = iso(receipt.풀림);
    if (!cooldownUntil) {
      try { cooldownUntil = iso(JSON.parse(readText(base, TIP_WORKER_QUOTA, 8192).content)?.풀림); } catch {}
    }
  }
  const stale = age > TIP_WORKER_STALE_MS;
  return { ...unknown, available: true, state: stale ? '오래됨' : observedState, observedState, checkedAt, stale,
    keyAvailability: observedState === '키없음' ? '부재 기록' : '미확인', cooldownUntil,
    cooldownActive: !!cooldownUntil && Date.parse(cooldownUntil) > new Date(now).getTime(),
    directNotificationAttempted: typeof receipt.directNotificationAttempted === 'boolean' ? receipt.directNotificationAttempted : null,
    route: ['구독', '크레딧'].includes(receipt.경로) ? receipt.경로 : null, coverage: '저장된 종료 상태 · 현재 인증 미조회' };
}

module.exports = { tipWorkerSnapshot, workerRoot, TIP_WORKER_STATUS, TIP_WORKER_QUOTA, TIP_WORKER_STALE_MS };
