'use strict';
const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { entryPath } = require('./restore-tar.cjs');
const { directory } = require('./paths.cjs');

const LIMITS = Object.freeze({ bytes: 128 * 1024 * 1024, nodes: 200000, line: 1024 * 1024, selected: 1000, page: 100, ttl: 30 * 60000 });
const MESSAGES = Object.freeze({
  INVALID_REQUEST: '요청을 확인하지 못했습니다. 목록을 새로 열어 주세요.',
  NOT_CONFIGURED: '백업 저장소를 먼저 연결해 주세요.', CREDENTIAL_REQUIRED: '저장된 인증 정보를 다시 연결해 주세요.',
  JOB_BUSY: '진행 중인 작업이 끝난 뒤 다시 눌러 주세요.',
  CATALOG_EXPIRED: '파일 목록이 만료되었거나 연결이 바뀌었습니다. 목록을 새로 열어 주세요.',
  CATALOG_TOO_LARGE: '선택 복구 목록의 크기 한도를 넘었습니다. 전체 복구를 이용해 주세요.',
  UNSAFE_MANIFEST: '안전하게 복구할 수 없는 파일 경로나 중복 이름이 있습니다. 목록을 확인하지 못했습니다.',
  NO_SNAPSHOT: '완료된 백업이 없습니다.', SNAPSHOT_GONE: '선택한 백업본이 더 이상 보관되어 있지 않습니다. 목록을 새로 열어 주세요.',
  REPOSITORY_CHANGED: '연결된 백업 저장소가 바뀌었습니다. 목록을 새로 열어 주세요.',
  REMOTE_MAINTENANCE: '다른 PC에서 백업 정리가 진행 중입니다. 작업이 끝난 뒤 다시 시도해 주세요.',
  QUERY_INVALID: '검색어는 제어 문자 없이 200자 이내로 입력해 주세요.',
  SELECTION_STALE: '선택 상태가 바뀌었습니다. 목록을 다시 확인해 주세요.',
  SELECTION_EMPTY: '복구할 파일을 선택해 주세요.', SELECTION_LIMIT: '한 번에 1,000개 파일까지 선택할 수 있습니다. 검색 범위를 줄여 주세요.',
  OUTPUT_UNSAFE: '작업 폴더·백업 저장소·앱 설정과 분리된 실제 폴더를 선택해 주세요.',
  NO_SPACE: '복구할 파일을 저장할 여유 공간이 부족합니다. 다른 드라이브를 선택해 주세요.',
  INTEGRITY_FAILED: '파일 목록이나 복구한 내용의 크기·검증 결과가 일치하지 않습니다. 복구는 완료되지 않았습니다.',
  OPERATION_FAILED: '파일 목록을 읽지 못했습니다. 연결 상태를 확인한 뒤 다시 열어 주세요.',
  RESTORE_INCOMPLETE: '선택 복구가 끝나지 않았습니다. 미완료 폴더와 이전 복구 결과를 유지합니다.'
});
class CatalogError extends Error { constructor(code) { super(MESSAGES[code] || MESSAGES.OPERATION_FAILED); this.code = Object.hasOwn(MESSAGES, code) ? code : 'OPERATION_FAILED'; } }
const issue = code => new CatalogError(code);
const safeError = (e, fallback = 'OPERATION_FAILED') => e instanceof CatalogError ? issue(e.code) : issue(fallback);
function request(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(value, k))) throw issue('INVALID_REQUEST');
  return value;
}
function sourcePlans(snapshot) {
  if (!/^[a-f0-9]{64}$/.test(snapshot?.id || '') || !Array.isArray(snapshot.paths) || !snapshot.paths.length || snapshot.paths.length > 30) throw issue('UNSAFE_MANIFEST');
  const sources = [];
  return snapshot.paths.map((original, index) => {
    if (typeof original !== 'string' || !/^[A-Za-z]:[\\/]/.test(original) || original.includes('\0') || original.split(/[\\/]/).some(p => p === '.' || p === '..')) throw issue('UNSAFE_MANIFEST');
    const normalized = path.win32.resolve(original).toLowerCase();
    if (sources.some(p => p === normalized || normalized.startsWith(p.replace(/\\$/, '') + '\\') || p.startsWith(normalized.replace(/\\$/, '') + '\\'))) throw issue('UNSAFE_MANIFEST');
    sources.push(normalized);
    const subtree = '/' + original.replace(/^([A-Za-z]):/, '$1').replaceAll('\\', '/').replace(/\/+$/, '');
    // Leave room for the numbered prefix within Windows' component limit.
    const basename = path.win32.basename(original).replace(/[<>:"/\\|?*]/g, '_').slice(0, 250).replace(/[\uD800-\uDBFF]$/u, '').replace(/[ .]+$/, '_');
    const label = `${String(index + 1).padStart(2, '0')}-${basename || '드라이브'}`;
    return { index, original, label, selector: `${snapshot.id}:${subtree}` };
  });
}
function budget(limits = LIMITS) { return { bytes: 0, nodes: 0, limits: { ...LIMITS, ...limits } }; }
async function parseCatalog(input, { root, snapshotId, budget: meter = budget() }) {
  const nodes = new Map(), decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '', snapshots = 0, unavailableCount = 0;
  function line(text) {
    if (Buffer.byteLength(text) > meter.limits.line) throw issue('CATALOG_TOO_LARGE');
    if (!text.trim()) return;
    let node; try { node = JSON.parse(text); } catch { throw issue('UNSAFE_MANIFEST'); }
    if (node?.message_type === 'snapshot') { if (++snapshots !== 1 || node.id !== snapshotId) throw issue('UNSAFE_MANIFEST'); return; }
    if (++meter.nodes > meter.limits.nodes) throw issue('CATALOG_TOO_LARGE');
    if (node?.message_type !== 'node' || typeof node.path !== 'string' || !node.path.startsWith('/') || typeof node.type !== 'string') throw issue('UNSAFE_MANIFEST');
    const name = node.path.slice(1);
    try { if (!entryPath(root, name)) throw issue('UNSAFE_MANIFEST'); } catch { throw issue('UNSAFE_MANIFEST'); }
    const key = name.toLowerCase();
    if (nodes.has(key)) throw issue('UNSAFE_MANIFEST');
    if (node.type === 'file' && (!Number.isSafeInteger(node.size) || node.size < 0)) throw issue('UNSAFE_MANIFEST');
    const mtime = typeof node.mtime === 'string' && Number.isFinite(Date.parse(node.mtime)) ? new Date(node.mtime).toISOString() : null;
    nodes.set(key, { path: name, type: node.type, size: node.type === 'file' ? node.size : 0, mtime });
    if (!['file', 'dir'].includes(node.type)) unavailableCount++;
  }
  function drain() {
    let end;
    while ((end = pending.indexOf('\n')) >= 0) { line(pending.slice(0, end)); pending = pending.slice(end + 1); }
    if (Buffer.byteLength(pending) > meter.limits.line) throw issue('CATALOG_TOO_LARGE');
  }
  for await (const chunk of input) {
    meter.bytes += chunk.length; if (meter.bytes > meter.limits.bytes) throw issue('CATALOG_TOO_LARGE');
    try { pending += decoder.decode(chunk, { stream: true }); } catch { throw issue('UNSAFE_MANIFEST'); }
    drain();
  }
  try { pending += decoder.decode(); } catch { throw issue('UNSAFE_MANIFEST'); }
  drain(); if (pending) line(pending);
  if (snapshots !== 1) throw issue('UNSAFE_MANIFEST');
  for (const node of nodes.values()) {
    let parent = path.posix.dirname(node.path);
    while (parent !== '.') {
      if (nodes.get(parent.toLowerCase())?.type !== 'dir') throw issue('UNSAFE_MANIFEST');
      parent = path.posix.dirname(parent);
    }
  }
  return { nodes, unavailableCount };
}
function queryKey(query) {
  if (typeof query !== 'string' || query.length > 200 || /[\x00-\x1f\x7f]/.test(query)) throw issue('QUERY_INVALID');
  return query.normalize('NFC').trim().toLowerCase();
}
class FileCatalog {
  constructor({ snapshot, plans, manifests, repositoryId, vaultId, profile, now }) {
    this.snapshotId = snapshot.id; this.snapshotAt = snapshot.time; this.plans = plans;
    this.repositoryId = repositoryId; this.vaultId = vaultId; this.profile = profile;
    this.token = crypto.randomBytes(16).toString('hex'); this.openedAt = now; this.expiresAt = now + LIMITS.ttl;
    this.files = []; this.byId = new Map(); this.selected = new Set(); this.revision = 0; this.totalBytes = 0; this.unavailableCount = 0;
    for (const [index, manifest] of manifests.entries()) {
      this.unavailableCount += manifest.unavailableCount;
      const files = [...manifest.nodes.values()].filter(n => n.type === 'file').sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      for (const f of files) {
        this.totalBytes += f.size; if (!Number.isSafeInteger(this.totalBytes)) throw issue('CATALOG_TOO_LARGE');
        const file = Object.freeze({ ...f, id: String(this.files.length), sourceIndex: index, source: plans[index].label, name: path.posix.basename(f.path), searchKey: f.path.normalize('NFC').toLowerCase() });
        this.files.push(file); this.byId.set(file.id, file);
      }
    }
  }
  assert(token, config, now) {
    if (token !== this.token || now >= this.expiresAt || now < this.openedAt || config?.repositoryId !== this.repositoryId || config?.vaultId !== this.vaultId) throw issue('CATALOG_EXPIRED');
  }
  meta() {
    return { profile: this.profile, token: this.token, snapshotAt: this.snapshotAt, expiresAt: new Date(this.expiresAt).toISOString(), fileCount: this.files.length, totalBytes: this.totalBytes, unavailableCount: this.unavailableCount,
      selection: { revision: this.revision, count: this.selected.size, bytes: [...this.selected].reduce((sum, id) => sum + this.byId.get(id).size, 0) } };
  }
  matches(query) { const key = queryKey(query); return this.files.filter(f => f.searchKey.includes(key)); }
  query(query, offset) {
    const matches = this.matches(query);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > matches.length) throw issue('INVALID_REQUEST');
    return { ...this.meta(), query, offset, total: matches.length, pageSize: LIMITS.page,
      rows: matches.slice(offset, offset + LIMITS.page).map(f => ({ id: f.id, source: f.source, path: f.path, name: f.name, size: f.size, mtime: f.mtime, selected: this.selected.has(f.id) })) };
  }
  select({ revision, action, ids, query }) {
    if (!Number.isSafeInteger(revision) || revision !== this.revision) throw issue('SELECTION_STALE');
    let selected = new Set(this.selected);
    if (action === 'clear') { if (ids !== undefined || query !== undefined) throw issue('INVALID_REQUEST'); selected.clear(); }
    else if (action === 'all') { if (ids !== undefined) throw issue('INVALID_REQUEST'); for (const f of this.matches(query)) { selected.add(f.id); if (selected.size > LIMITS.selected) throw issue('SELECTION_LIMIT'); } }
    else if (action === 'add' || action === 'remove') {
      if (query !== undefined || !Array.isArray(ids) || !ids.length || ids.length > LIMITS.page || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !/^\d+$/.test(id) || !this.byId.has(id))) throw issue('INVALID_REQUEST');
      for (const id of ids) action === 'add' ? selected.add(id) : selected.delete(id);
    } else throw issue('INVALID_REQUEST');
    if (selected.size > LIMITS.selected) throw issue('SELECTION_LIMIT');
    this.selected = selected; this.revision++; return this.meta();
  }
  capture(revision) {
    if (!Number.isSafeInteger(revision) || revision !== this.revision) throw issue('SELECTION_STALE');
    if (!this.selected.size) throw issue('SELECTION_EMPTY');
    return { snapshotId: this.snapshotId, repositoryId: this.repositoryId, vaultId: this.vaultId, plans: this.plans.map(p => ({ ...p })), files: this.files.filter(f => this.selected.has(f.id)).map(f => ({ ...f })) };
  }
}
async function hashFile(file) { const hash = crypto.createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
async function writeFileStream(input, target, expectedSize, root) {
  await directory(root); await directory(path.dirname(target));
  let bytes = 0; const digest = crypto.createHash('sha256');
  const measure = new Transform({ transform(chunk, _encoding, done) { bytes += chunk.length; if (bytes > expectedSize) return done(issue('INTEGRITY_FAILED')); digest.update(chunk); done(null, chunk); } });
  await pipeline(input, measure, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
  const sha256 = digest.digest('hex');
  if (await hashFile(target) !== sha256) throw issue('INTEGRITY_FAILED');
  // Check a short stream only after the caller also observes restic exit 0.
  return { bytes, sha256 };
}
async function spaceRequired(base, files, plans, statfs = fs.statfs) {
  const space = await statfs(base, { bigint: true }), dirs = new Set();
  let required = 16n * 1024n * 1024n;
  for (const file of files) {
    required += ((BigInt(file.size) + space.bsize - 1n) / space.bsize) * space.bsize;
    let dir = path.posix.dirname(plans[file.sourceIndex].label + '/' + file.path);
    while (dir !== '.') { dirs.add(dir); dir = path.posix.dirname(dir); }
  }
  required += BigInt(dirs.size + 1) * space.bsize;
  if (required > space.bavail * space.bsize) throw issue('NO_SPACE');
}
module.exports = { LIMITS, MESSAGES, CatalogError, issue, safeError, request, sourcePlans, budget, parseCatalog, FileCatalog, writeFileStream, spaceRequired };
