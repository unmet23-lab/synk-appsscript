'use strict';
// Shared file/lock/ref primitives. Importing this module starts no backup.
const fs = require('node:fs'), path = require('node:path');
const OID = /^[0-9a-f]{40}$/;
const PREFIX = 'refs/synk-backup/';

function remoteIdentity(url) {
  const match = String(url).trim().match(/^(?:git@github\.com:|https:\/\/github\.com\/)(unmet23-lab\/[A-Za-z0-9_.-]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}
function parseRefs(buffer) {
  return buffer.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => {
    const split = line.search(/\s/), sha = line.slice(0, split), ref = line.slice(split + 1).trim();
    if (!OID.test(sha) || !ref.startsWith('refs/')) throw new Error('INVALID_GIT_REFERENCE');
    return { sha, ref };
  });
}
function replaceFile(temp, file, { beforeRetry = null } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return fs.renameSync(temp, file); }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 20) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
      // The caller may refuse a retry, e.g. when another process wrote the target while it held the lock.
      if (beforeRetry && !beforeRetry()) throw Object.assign(new Error(`REPLACE_TARGET_CHANGED: ${file}`), { code: 'REPLACE_TARGET_CHANGED', cause: error });
    }
  }
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  replaceFile(temp, file);
}
// 감싸개가 제한에 백업 나무를 끝내면(TerminateJobObject) 잠금이 남는다. Windows는 PID를 금방 다시 주므로, 그 PID가 다른 프로세스로
// 살아 있으면 다음 실행이 「already-running」으로 조용히 건너뛴다(10-21 09:30 실행이 남긴 PID 45096 잠금). 그래서 PID가 살아 있어도
// 같은 PID로 쓴 영수증(잠금 이름에서 .lock을 뺀 파일)이 running인 채 heartbeat가 45분 넘게 멈췄거나 잠금이 4시간을 넘으면 주인 없는
// 잠금으로 본다. 살아 있는 실행은 heartbeat를 15초마다 쓰고(긴 동기 git 호출 동안 멈춘 가장 긴 틈이 28분), 적용 실행은 24분·확인 실행은
// 3시간에 끝난다(10-21).
const LOCK_HEARTBEAT_STALE_MS = 45 * 60000, LOCK_MAX_AGE_MS = 4 * 3600000;
function abandonedLock(file, owner, now = Date.now()) {
  const started = Date.parse(owner.startedAt);
  if (Number.isFinite(started) && now - started > LOCK_MAX_AGE_MS) return true;
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(file.replace(/\.lock$/, ''), 'utf8')); } catch (_) { return false; }
  const beat = Date.parse(receipt.heartbeatAt || receipt.checkedAt);
  return receipt.pid === owner.pid && receipt.status === 'running' && Number.isFinite(beat) && now - beat > LOCK_HEARTBEAT_STALE_MS;
}
function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      fs.closeSync(fd);
      return () => { try {
        const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (owner.pid === process.pid) fs.unlinkSync(file);
      } catch (_) {} };
    } catch (error) {
      if (error.code !== 'EEXIST') throw new Error('GITHUB_LOCK_FAILED');
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
      if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) return null;
      let alive = true;
      try { process.kill(owner.pid, 0); } catch (probe) { alive = probe.code !== 'ESRCH'; }
      if (alive && !abandonedLock(file, owner)) return null;
      // Re-read before removing only this stale lock; never kill its process.
      const current = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (current.pid !== owner.pid || current.startedAt !== owner.startedAt) return null;
      fs.unlinkSync(file);
    }
  }
  return null;
}

module.exports = { remoteIdentity, parseRefs, replaceFile, atomicJson, acquireLock, abandonedLock, PREFIX };
