'use strict';
// OneDrive 백업의 읽기 기록(10-19). 지난 실행이 실제로 읽어 SHA·안전 분류를 확인한 파일은 stat(크기·수정 시각·
// 변경 시각·파일 ID)가 그대로면 다시 읽지 않고 그 결과를 쓴다. 다른 무거운 작업이 돌 때는 파일을 한 번 여는 데
// 백신 검사까지 수십~수백 ms가 걸려, 매번 2만여 원본과 작업트리 문서 5만여 개를 다시 읽던 것이 실행 제한을 넘겼다.
// - 분류 규칙(이어하기꾸러미.js와 검토 목록 두 개)의 지문이 다르면 기록 전체를 버린다. 실행 중 규칙이 바뀌면 저장하지 않는다.
// - 기록 파일이 깨졌거나 형식이 다르면 전체를 버리고 전부 읽는다. 항목 하나가 이상하면 그 항목만 버린다.
// - 매 실행 1/48(30분 간격이면 하루 한 바퀴)은 stat가 같아도 다시 읽어 대조하고, 내용이 달랐으면 그 수를 남긴다.
// - 이번 실행에서 실제로 읽은 결과는 같은 실행 안에서 다시 읽지 않는다.
// - 저장은 바뀐 항목만(10-20): 기록 파일(read-cache.json, 4만~10만 항목·44MB)을 실행마다 통째로 다시 쓰던 것을, 바뀐 항목만
//   옆의 read-cache.journal.jsonl에 한 줄로 덧붙인다. 그날 처음 저장할 때, 덧붙인 양이 기록 파일의 절반을 넘을 때, 기록을 새로
//   시작할 때만 기록 파일을 통째로 다시 쓰고(3일 지난 항목도 그때 뺀다) 덧붙인 줄을 비운다. 덧붙인 줄마다 바탕 기록의 저장 시각을
//   적어, 다른 바탕 위에 쌓인 줄(정리 도중 끊긴 경우)은 읽지 않는다. 바뀐 것이 없으면 아무것도 쓰지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { replaceFile } = require('./lib/backup-primitives.cjs');
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
const journalOf = file => file.replace(/\.json$/i, '') + '.journal.jsonl';
const JOURNAL_SHARE = 0.5; // 덧붙인 줄이 기록 파일의 이만큼을 넘으면 통째로 정리한다
function open(file, { fingerprint, now = Date.now(), slots = SLOTS } = {}) {
  if (!isSha(fingerprint)) throw new Error('read-cache-fingerprint-required');
  const today = Math.floor(now / 86400000), slot = currentSlot(now, slots), journal = journalOf(file);
  let previous = new Map(), previousMemos = new Map(), status = 'loaded', dropped = 0;
  let base = null, baseBytes = 0, journalBytes = 0, journalLines = 0;
  try {
    const text = fs.readFileSync(file, 'utf8'), raw = JSON.parse(text);
    baseBytes = Buffer.byteLength(text);
    if (!raw || raw.schemaVersion !== SCHEMA) status = 'schema-mismatch';
    else if (raw.policyFingerprint !== fingerprint) status = 'policy-changed';
    else if (!raw.entries || typeof raw.entries !== 'object' || Array.isArray(raw.entries)) status = 'invalid';
    else {
      base = typeof raw.savedAt === 'string' ? raw.savedAt : null;
      for (const [key, entry] of Object.entries(raw.entries)) {
        if (path.isAbsolute(key) && validEntry(entry)) previous.set(key, entry); else dropped++;
      }
      if (raw.memos && typeof raw.memos === 'object' && !Array.isArray(raw.memos))
        for (const [name, memo] of Object.entries(raw.memos)) { if (validMemo(memo)) previousMemos.set(name, memo); else dropped++; }
      else if (raw.memos !== undefined) dropped++;
    }
  } catch (error) { status = error.code === 'ENOENT' ? 'missing' : 'unreadable'; }
  if (status !== 'loaded') { previous = new Map(); previousMemos = new Map(); base = null; }
  // 이 바탕 위에 덧붙인 줄을 차례로 얹는다. 줄 하나가 깨졌으면(쓰다 끊긴 끝줄 등) 그 줄만 버린다.
  if (base) {
    let lines = [];
    try { const text = fs.readFileSync(journal, 'utf8'); journalBytes = Buffer.byteLength(text); lines = text.split('\n'); }
    catch (error) { if (error.code !== 'ENOENT') dropped++; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let row;
      try { row = JSON.parse(line); } catch { dropped++; continue; }
      if (!row || row.base !== base || row.policyFingerprint !== fingerprint) continue;
      journalLines++;
      for (const [key, entry] of Object.entries(row.entries || {})) { if (path.isAbsolute(key) && validEntry(entry)) previous.set(key, entry); else dropped++; }
      for (const [name, memo] of Object.entries(row.memos || {})) { if (validMemo(memo)) previousMemos.set(name, memo); else dropped++; }
    }
  }
  const current = new Map(), currentMemos = new Map(), verifiedThisRun = new Set();
  // 마지막 저장 뒤 바뀐 항목(덧붙일 것). 그날 처음 본 항목의 날짜만 바뀐 것도 든다.
  const changed = new Set(), changedMemos = new Set();
  const counts = { hits: 0, misses: 0, rechecked: 0, statInvisibleChanges: 0, remembered: 0, memoHits: 0, memoMisses: 0 };
  const sameEntry = (a, b) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
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
      if (!current.has(key)) { current.set(key, [...entry.slice(0, 5), today]); if (entry[5] !== today) changed.add(key); }
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
      const next = [stat, sha256, bytes, reasons, nextTags, today];
      if (!sameEntry(old, next)) changed.add(key);
      current.set(key, next);
      verifiedThisRun.add(key);
      counts.remembered++;
      return true;
    },
    // 지금 stat 그대로인 기록의 파생 지문(예: 색인 파일의 내용 지문)을 본다. 다시 읽기 몫이면 null을 돌려 원래대로 읽게 한다.
    tagged(target, st, name) {
      const key = keyOf(target), entry = entryFor(key, bigintStat(st));
      if (!entry || !entry[4][name]) { counts.misses++; return null; }
      if (!verifiedThisRun.has(key) && slotOf(key, slots) === slot) { counts.rechecked++; return null; }
      if (!current.has(key)) { current.set(key, [...entry.slice(0, 5), today]); if (entry[5] !== today) changed.add(key); }
      counts.hits++;
      return entry[4][name];
    },
    inSlot(target) { return slotOf(keyOf(target), slots) === slot; },
    // 입력 지문(key)이 지난번과 같을 때만 그때의 결과를 돌려준다.
    memo(name, key) {
      const memo = currentMemos.get(name) || previousMemos.get(name);
      if (!memo || memo[0] !== key) { counts.memoMisses++; return null; }
      if (!currentMemos.has(name)) { currentMemos.set(name, [memo[0], memo[1], today]); if (memo[2] !== today) changedMemos.add(name); }
      counts.memoHits++;
      return [...memo[1]];
    },
    setMemo(name, key, value) {
      const memo = [key, [...value], today];
      if (!validMemo(memo)) return false;
      if (!sameEntry(currentMemos.get(name) || previousMemos.get(name), memo)) changedMemos.add(name);
      currentMemos.set(name, memo);
      return true;
    },
    summary() { return { status, entries: current.size, previousEntries: previous.size, memos: currentMemos.size, dropped, slot, slots,
      journalLines, journalBytes, ...counts }; },
    // 바뀐 항목만 덧붙이고, 정리할 때가 되면(그날 처음, 덧붙인 양이 많을 때, 기록을 새로 시작할 때) 최근 3일 안에 본 기록만 남겨 통째로 쓴다.
    // 실행 중 분류 규칙이 바뀌었으면 저장하지 않는다.
    save(currentFingerprint = fingerprint) {
      if (currentFingerprint !== fingerprint) return { saved: false, reason: 'policy-changed-during-run' };
      const baseDay = base ? Math.floor(Date.parse(base) / 86400000) : NaN;
      const compact = !base || baseDay !== today || journalBytes > baseBytes * JOURNAL_SHARE;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!compact) {
        if (!changed.size && !changedMemos.size) return { saved: false, unchanged: true, mode: 'none' };
        const entries = {}, memos = {};
        for (const key of changed) { const entry = current.get(key); if (entry) entries[key] = entry; }
        for (const name of changedMemos) { const memo = currentMemos.get(name); if (memo) memos[name] = memo; }
        const line = JSON.stringify({ base, policyFingerprint: fingerprint, savedAt: new Date(now).toISOString(), entries, memos }) + '\n';
        fs.appendFileSync(journal, line);
        journalBytes += Buffer.byteLength(line); journalLines++;
        for (const [key, entry] of Object.entries(entries)) previous.set(key, entry);
        for (const [name, memo] of Object.entries(memos)) previousMemos.set(name, memo);
        changed.clear(); changedMemos.clear();
        return { saved: true, mode: 'journal', appended: Object.keys(entries).length + Object.keys(memos).length, bytes: Buffer.byteLength(line) };
      }
      const entries = {}, memos = {};
      for (const [key, entry] of previous) if (today - entry[5] <= KEEP_DAYS) entries[key] = entry;
      for (const [key, entry] of current) entries[key] = entry;
      for (const [name, memo] of previousMemos) if (today - memo[2] <= KEEP_DAYS) memos[name] = memo;
      for (const [name, memo] of currentMemos) memos[name] = memo;
      const savedAt = new Date(now).toISOString(), text = JSON.stringify({ schemaVersion: SCHEMA, policyFingerprint: fingerprint, savedAt, entries, memos });
      const temp = file + '.' + process.pid + '.tmp';
      fs.writeFileSync(temp, text);
      // 백신·색인기가 여는 순간의 짧은 거절(EPERM·EACCES·EBUSY)은 lib/backup-primitives.cjs의 replaceFile이 다시 한다.
      replaceFile(temp, file);
      // 새 바탕을 쓴 뒤에 덧붙인 줄을 비운다. 그 사이 끊겨도 남은 줄은 바탕 시각이 달라 다음에 읽히지 않는다.
      try { fs.unlinkSync(journal); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      base = savedAt; baseBytes = Buffer.byteLength(text); journalBytes = 0; journalLines = 0;
      previous = new Map(Object.entries(entries)); previousMemos = new Map(Object.entries(memos));
      changed.clear(); changedMemos.clear();
      return { saved: true, mode: 'full', entries: Object.keys(entries).length, bytes: baseBytes };
    },
  };
  return cache;
}
module.exports = { open, slotOf, currentSlot, statKey, SLOTS, SLOT_MS };
