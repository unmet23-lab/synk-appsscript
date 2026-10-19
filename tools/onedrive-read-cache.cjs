'use strict';
// OneDrive 백업의 읽기 기록(10-19). 지난 실행이 실제로 읽어 SHA·안전 분류를 확인한 파일은 stat(크기·수정 시각·
// 변경 시각·파일 ID)가 그대로면 다시 읽지 않고 그 결과를 쓴다. 다른 무거운 작업이 돌 때는 파일을 한 번 여는 데
// 백신 검사까지 수십~수백 ms가 걸려, 매번 2만여 원본과 작업트리 문서 5만여 개를 다시 읽던 것이 실행 제한을 넘겼다.
// - 분류 규칙(이어하기꾸러미.js와 검토 목록 두 개)의 지문이 다르면 기록 전체를 버린다. 실행 중 규칙이 바뀌면 저장하지 않는다.
// - 기록 파일이 깨졌거나 형식이 다르면 전체를 버리고 전부 읽는다. 항목 하나가 이상하면 그 항목만 버린다.
// - 매 실행 1/48(30분 간격이면 하루 한 바퀴)은 stat가 같아도 다시 읽어 대조하고, 내용이 달랐으면 그 수를 남긴다.
// - 이번 실행에서 실제로 읽은 결과는 같은 실행 안에서 다시 읽지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { replaceFile } = require('./GitHub백업.cjs');
const SCHEMA = 1, SLOTS = 48, SLOT_MS = 30 * 60 * 1000, KEEP_DAYS = 3;
const digits = value => typeof value === 'string' && /^\d{1,30}$/.test(value);
const isSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isReason = value => value === null || (typeof value === 'string' && /^[A-Za-z0-9-]{1,60}$/.test(value));
const keyOf = file => path.resolve(file);
const statKey = st => [String(st.size), String(st.mtimeNs), String(st.ctimeNs), String(st.ino)];
const sameStat = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
// stat는 { bigint: true }로 읽은 값이어야 한다. 수정·변경 시각을 100ns 단위 그대로, 파일 ID를 잘림 없이 비교한다.
function bigintStat(st) {
  if (!st || typeof st.mtimeNs !== 'bigint' || typeof st.ino !== 'bigint') throw new Error('read-cache-needs-bigint-stat');
  return statKey(st);
}
function slotOf(file, slots = SLOTS) {
  return parseInt(crypto.createHash('sha256').update(keyOf(file).toLowerCase()).digest('hex').slice(0, 8), 16) % slots;
}
function currentSlot(now = Date.now(), slots = SLOTS) { return Math.floor(now / SLOT_MS) % slots; }
// [stat4, sha256, bytes, reasons, tags, day]
function validEntry(entry) {
  if (!Array.isArray(entry) || entry.length !== 6) return false;
  const [stat, sha256, bytes, reasons, tags, day] = entry;
  return Array.isArray(stat) && stat.length === 4 && stat.every(digits) && isSha(sha256) &&
    Number.isSafeInteger(bytes) && bytes >= 0 && String(bytes) === stat[0] &&
    reasons && typeof reasons === 'object' && !Array.isArray(reasons) &&
    Object.entries(reasons).every(([key, value]) => key.length <= 1000 && isReason(value)) &&
    tags && typeof tags === 'object' && !Array.isArray(tags) && Object.values(tags).every(isSha) &&
    Number.isSafeInteger(day) && day > 0;
}
// 메모: 파일 하나가 아니라 여러 입력의 지문(key)으로 묶은 결과(예: 작업트리의 git 결과). [key, 문자열 목록, day]
const validMemo = memo => Array.isArray(memo) && memo.length === 3 && typeof memo[0] === 'string' && memo[0].length <= 200 &&
  Array.isArray(memo[1]) && memo[1].every(item => typeof item === 'string' && item.length <= 2000) && Number.isSafeInteger(memo[2]) && memo[2] > 0;
function open(file, { fingerprint, now = Date.now(), slots = SLOTS } = {}) {
  if (!isSha(fingerprint)) throw new Error('read-cache-fingerprint-required');
  const today = Math.floor(now / 86400000), slot = currentSlot(now, slots);
  let previous = new Map(), previousMemos = new Map(), status = 'loaded', dropped = 0;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || raw.schemaVersion !== SCHEMA) status = 'schema-mismatch';
    else if (raw.policyFingerprint !== fingerprint) status = 'policy-changed';
    else if (!raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) status = 'invalid';
    else {
      for (const [key, entry] of Object.entries(raw.entries)) {
        if (path.isAbsolute(key) && validEntry(entry)) previous.set(key, entry); else dropped++;
      }
      if (raw.memos && typeof raw.memos === 'object' && !Array.isArray(raw.memos))
        for (const [name, memo] of Object.entries(raw.memos)) { if (validMemo(memo)) previousMemos.set(name, memo); else dropped++; }
      else if (raw.memos !== undefined) dropped++;
    }
  } catch (error) { status = error.code === 'ENOENT' ? 'missing' : 'unreadable'; }
  if (status !== 'loaded') { previous = new Map(); previousMemos = new Map(); }
  const current = new Map(), currentMemos = new Map(), verifiedThisRun = new Set();
  const counts = { hits: 0, misses: 0, rechecked: 0, statInvisibleChanges: 0, remembered: 0, memoHits: 0, memoMisses: 0 };
  const entryFor = (key, stat) => {
    const entry = current.get(key) || previous.get(key);
    return entry && sameStat(entry[0], stat) ? entry : null;
  };
  const cache = {
    status, slot, dropped, counts,
    // stat가 기록과 같고 이번 실행의 다시 읽기 몫이 아니면 기록을 돌려준다. classifyPath를 주면 그 경로 이름의 분류 결과도 있어야 한다.
    lookup(target, st, classifyPath) {
      const key = keyOf(target), stat = bigintStat(st), entry = entryFor(key, stat);
      const usable = entry && (classifyPath === undefined || Object.prototype.hasOwnProperty.call(entry[3], classifyPath));
      if (!usable) { counts.misses++; return null; }
      if (!verifiedThisRun.has(key) && slotOf(key, slots) === slot) { counts.rechecked++; return null; }
      if (!current.has(key)) current.set(key, [...entry.slice(0, 5), today]);
      counts.hits++;
      const result = { sha256: entry[1], bytes: entry[2], tags: entry[4] };
      if (classifyPath !== undefined) result.reason = entry[3][classifyPath];
      return result;
    },
    // 실제로 읽은 결과만 기록한다. 읽기 전후 stat가 다르면 기록하지 않는다(호출하는 쪽이 before·after를 준다).
    // dependsOnIndex: 분류가 창고 색인(보존 사본의 원래 경로)에 기댄 결과는 기록하지 않고 매번 다시 분류한다.
    remember(target, before, after, sha256, bytes, classifyPath, reason, { dependsOnIndex = false, tags } = {}) {
      const key = keyOf(target), stat = bigintStat(before);
      if (!sameStat(stat, bigintStat(after)) || !isSha(sha256) || String(bytes) !== stat[0]) return false;
      const old = current.get(key) || previous.get(key);
      if (old && sameStat(old[0], stat) && old[1] !== sha256) counts.statInvisibleChanges++;
      const keep = old && sameStat(old[0], stat) && old[1] === sha256;
      const reasons = keep ? { ...old[3] } : {};
      if (classifyPath !== undefined) {
        if (dependsOnIndex || !isReason(reason)) delete reasons[classifyPath];
        else reasons[classifyPath] = reason;
      }
      const nextTags = { ...(keep ? old[4] : {}), ...(tags || {}) };
      current.set(key, [stat, sha256, bytes, reasons, nextTags, today]);
      verifiedThisRun.add(key);
      counts.remembered++;
      return true;
    },
    // 지금 stat 그대로인 기록의 파생 지문(예: 색인 파일의 내용 지문)을 본다. 다시 읽기 몫이면 null을 돌려 원래대로 읽게 한다.
    tagged(target, st, name) {
      const key = keyOf(target), entry = entryFor(key, bigintStat(st));
      if (!entry || !entry[4][name]) { counts.misses++; return null; }
      if (!verifiedThisRun.has(key) && slotOf(key, slots) === slot) { counts.rechecked++; return null; }
      if (!current.has(key)) current.set(key, [...entry.slice(0, 5), today]);
      counts.hits++;
      return entry[4][name];
    },
    inSlot(target) { return slotOf(keyOf(target), slots) === slot; },
    // 입력 지문(key)이 지난번과 같을 때만 그때의 결과를 돌려준다.
    memo(name, key) {
      const memo = currentMemos.get(name) || previousMemos.get(name);
      if (!memo || memo[0] !== key) { counts.memoMisses++; return null; }
      if (!currentMemos.has(name)) currentMemos.set(name, [memo[0], memo[1], today]);
      counts.memoHits++;
      return [...memo[1]];
    },
    setMemo(name, key, value) {
      const memo = [key, [...value], today];
      if (validMemo(memo)) currentMemos.set(name, memo);
      return validMemo(memo);
    },
    summary() { return { status, entries: current.size, previousEntries: previous.size, memos: currentMemos.size, dropped, slot, slots, ...counts }; },
    // 이번 실행에서 확인한 기록과, 최근 3일 안에 본 기록만 남긴다. 실행 중 분류 규칙이 바뀌었으면 저장하지 않는다.
    save(currentFingerprint = fingerprint) {
      if (currentFingerprint !== fingerprint) return { saved: false, reason: 'policy-changed-during-run' };
      const entries = {}, memos = {};
      for (const [key, entry] of previous) if (today - entry[5] <= KEEP_DAYS) entries[key] = entry;
      for (const [key, entry] of current) entries[key] = entry;
      for (const [name, memo] of previousMemos) if (today - memo[2] <= KEEP_DAYS) memos[name] = memo;
      for (const [name, memo] of currentMemos) memos[name] = memo;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = file + '.' + process.pid + '.tmp';
      fs.writeFileSync(temp, JSON.stringify({ schemaVersion: SCHEMA, policyFingerprint: fingerprint, savedAt: new Date(now).toISOString(), entries, memos }));
      // 백신·색인기가 여는 순간의 짧은 거절(EPERM·EACCES·EBUSY)은 GitHub백업.cjs의 replaceFile이 다시 한다.
      replaceFile(temp, file);
      return { saved: true, entries: Object.keys(entries).length };
    },
  };
  return cache;
}
module.exports = { open, slotOf, currentSlot, statKey, SLOTS, SLOT_MS };
