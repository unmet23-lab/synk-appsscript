'use strict';
const crypto = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');

const SAMPLE_BYTES = 8 * 1024 * 1024;
const LIST_BYTES = 32 * 1024 * 1024;
const LIST_NODES = 100000;
function issue(code, message) { return Object.assign(new Error(message), { code }); }

// Choose one eligible file without retaining the whole tree. The output path
// is only an argument to restic; it is never used as a local filesystem path.
async function selectSample(input, snapshotId, { maxBytes = LIST_BYTES, maxNodes = LIST_NODES } = {}) {
  const decoder = new StringDecoder('utf8');
  let pending = '', bytes = 0, nodes = 0, snapshots = 0, chosen = null, rank = null;
  function line(text) {
    if (!text.trim()) return;
    const node = JSON.parse(text);
    if (node.message_type === 'snapshot') { snapshots++; return; }
    if (++nodes > maxNodes) throw issue('PROBE_LIMIT', '표본 확인용 목록의 크기 제한을 넘었습니다.');
    if (node.message_type !== 'node' || typeof node.path !== 'string' || !node.path.startsWith('/') || /[\x00-\x1f\\]/.test(node.path) || (node.path !== '/' && node.path.slice(1).split('/').some(p => !p || p === '.' || p === '..'))) throw issue('PROBE_MANIFEST', '표본 파일 목록을 확인하지 못했습니다.');
    if (node.type !== 'file') return;
    if (!Number.isSafeInteger(node.size) || node.size < 0) throw issue('PROBE_MANIFEST', '표본 파일 크기를 확인하지 못했습니다.');
    if (!node.size || node.size > SAMPLE_BYTES) return;
    const score = crypto.createHash('sha256').update(snapshotId).update('\0').update(node.path).digest('hex');
    if (rank === null || score < rank) { rank = score; chosen = { path: node.path, size: node.size }; }
  }
  function drain() {
    let at;
    while ((at = pending.indexOf('\n')) >= 0) {
      if (at > 1024 * 1024) throw issue('PROBE_LIMIT', '표본 목록의 한 항목이 너무 큽니다.');
      line(pending.slice(0, at)); pending = pending.slice(at + 1);
    }
    if (pending.length > 1024 * 1024) throw issue('PROBE_LIMIT', '표본 목록의 한 항목이 너무 큽니다.');
  }
  for await (const chunk of input) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw issue('PROBE_LIMIT', '표본 확인용 목록의 크기 제한을 넘었습니다.');
    pending += decoder.write(chunk); drain();
  }
  pending += decoder.end(); drain(); if (pending) line(pending);
  if (snapshots !== 1) throw issue('PROBE_MANIFEST', '표본의 백업 목록을 확인하지 못했습니다.');
  return chosen;
}

// restic authenticates/decrypts data before writing stdout. Count and hash the
// bounded plaintext stream in memory only. A short read is judged only AFTER
// restic exits successfully, so network truncation isn't labelled corruption.
async function consumeSample(input, expectedBytes) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > SAMPLE_BYTES) throw issue('PROBE_SIZE', '표본 크기가 허용 범위를 벗어납니다.');
  const digest = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of input) {
    bytes += chunk.length;
    if (bytes > expectedBytes || bytes > SAMPLE_BYTES) throw issue('PROBE_SIZE', '표본 내용이 기록된 크기를 넘었습니다.');
    digest.update(chunk);
  }
  return { bytes, sha256: digest.digest('hex') };
}
module.exports = { SAMPLE_BYTES, LIST_BYTES, LIST_NODES, selectSample, consumeSample, issue };
