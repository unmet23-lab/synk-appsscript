// The file-work service (STAGE1_DESIGN.md 4.4 표 「서버 · 파일 일」, 「개통 서버 구현 설계」).
// It holds a key with listBuckets · listFiles · readFiles · writeFiles on the
// customer bucket and nothing else: no deleteFiles, no key or bucket powers.
// It answers three questions about one customer prefix — what is stored (usage and
// the detection summary), what a restore to time T would do, and doing it (always
// by copy and hide; restore-hidden.mjs has no delete call). It takes only
// (prefix, time) and builds every plan from its own listing, never from the api,
// and it counts restores per customer per day on its own volume.
import fs from 'node:fs';
import path from 'node:path';
import { planRestore, applyPlan } from './restore-hidden.mjs';
import { summarize } from './detect.mjs';
import { rpcServer } from './rpc.mjs';
import { lazySession } from './keys-worker.mjs';
import { PREFIX, BUCKET_ID, listenHost, need, secretFile } from './config.mjs';

export const RESTORES_PER_DAY = 3;
export const MAX_ROUNDS = 4;
const err = (code) => Object.assign(new Error(code), { code });
const checkPrefix = (prefix) => { if (!PREFIX.test(prefix || '')) throw err('BAD_INPUT'); return prefix; };
const MAX_BETWEEN = 50000;
const checkTime = (v) => { if (!Number.isSafeInteger(v) || v < 0) throw err('BAD_INPUT'); return v; };

const DAY = 86400000;
const PRE_AT_BACK_MS = 3600000, ID = /^[a-z0-9]{16}$/;
// B2 deletes a hidden version 30 days after it was hidden (the bucket's lifecycle rule). A version
// current at `at` was hidden at `at` or later, so until `at` + 30 days everything a restore to
// `at` needs is still there. Half a day is kept back for when the rule runs (GPT 끝판 GC1).
const SAFE_AGE_MS = 29.5 * DAY;
// The restore ledger, on this worker's own volume (Fable 5.2 설계 관문 셋째 다): per customer
// prefix one record — the run in progress or the last one that finished — and the day's count.
// A run is known by the api's job ids (`runIds`; a continued run gathers the new ids). The ids
// only name runs; what is free is decided here:
// · the same unfinished run (same time) continues free, whatever id asks;
// · a finished run asked again by one of its ids answers what it did (GPT r7 GB1);
// · the undo of the last finished run — its id as `undoOf` and back to its moment before — is
//   free once (Fable 2); an unfinished undo continues free like any run;
// · anything else is a new restore and counts, after its first plan passed.
// An unfinished record is kept however long it waits (GPT r6 GB1); a finished one is forgotten
// after 29 days.
function restoreLedger(stateDir, now) {
  const file = path.join(stateDir, 'restore-days.json');
  const load = (t = now()) => {
    let all = {};
    try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw err('WORKER_STATE'); }
    // A finished run is kept 29 days from when it finished (a retry gets its answer, its undo is
    // free); an unfinished one until it can no longer be continued (카본 끝판 C2).
    all.started = Object.fromEntries(Object.entries(all.started || {}).filter(([, v]) => v && (v.done ? t - (v.doneAt ?? v.t) < 29 * DAY : !(t - v.at > SAFE_AGE_MS + DAY))));
    return all;
  };
  const save = (all) => { const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(all)); fs.renameSync(tmp, file); };
  const ids = (run) => run?.runIds || (run?.runId ? [run.runId] : []);
  return {
    replay(prefix, at, runId, undoOf = null) {
      const run = load().started[prefix];
      if (!run?.done || !run.result || run.at !== at) return null;
      if (runId && ids(run).includes(runId)) return run.result;
      // The undo of the same restore, finished here but its answer lost, asked again by a new
      // job: what it did, not a second (counted) restore (카본 끝판2 C3).
      if (undoOf && run.undo && run.undoOf === undoOf) return run.result;
      return null;
    },
    // `unchanged(p)`: nothing but this worker's own copies and hides came after time p.
    peek(prefix, at, runId = null, undoOf = null, unchanged = () => true) {
      const t = now(), run = load(t).started[prefix];
      // The same unfinished run: the same time, the same kind (an undo continues an undo, a
      // restore a restore), and either the same job or nothing new on top since its moment
      // before. A new restore over backups made after a failed undo is a new restore: it counts,
      // and its own undo is free (카본 끝판 C3).
      const sameId = !!runId && ids(run).includes(runId);
      if (run && !run.done && run.at === at && !!run.undo === !!undoOf && (sameId || !Number.isSafeInteger(run.preAt) || unchanged(run.preAt))) return { free: true, t0: run.t, sameId };
      if (run?.done && !run.undo && undoOf && ids(run).includes(undoOf) && Number.isSafeInteger(run.preAt) && run.preAt === at) return { free: true, undo: true, t0: t };
      return { free: false, t0: t };
    },
    take(prefix, at, { free, undo, t0 }, runId = null, undoOf = null) {
      const t = now(), day = new Date(t).toISOString().slice(0, 10), all = load(t);
      let counts = all.day === day ? all.counts || {} : {};
      const run = all.started[prefix];
      let next;
      if (free && !undo) next = { ...run, runIds: [...new Set([...ids(run), ...(runId ? [runId] : [])])] };
      else {
        const n = (counts[prefix] || 0) + (undo ? 0 : 1);
        if (n > RESTORES_PER_DAY) throw err('LIMIT_WORKER_DAY');
        counts = { ...counts, [prefix]: n };
        // A new run over an unfinished one (asked again after a failure, by a new id or to
        // another time): the chain's moment before goes on, checked in apply (Fable 1).
        const chain = run && !run.done && Number.isSafeInteger(run.preAt) ? { preAt: run.preAt, preBase: run.preBase ?? 0 } : {};
        next = { at, t: t0, runIds: runId ? [runId] : [], ...(undo ? { undo: true, undoOf } : {}), ...chain };
      }
      delete next.runId;
      save({ day, counts, started: { ...all.started, [prefix]: next } });
      return next;
    },
    update(prefix, at, patch) {
      const all = load(), run = all.started[prefix];
      if (!run || run.at !== at) return;
      all.started[prefix] = { ...run, ...patch, ...(patch.done ? { doneAt: now() } : {}) };
      save(all);
    },
  };
}

// What this worker's restores did (copies made, hide markers set), per customer, written
// the moment each step is done. Detection reads it to tell our own copies and hides
// from someone else's; it never takes that list from the api.
function restoreJournal(stateDir, now) {
  const fileOf = (prefix) => path.join(stateDir, `journal-${prefix.slice(2, 18)}.jsonl`);
  return {
    add(prefix, entry) {
      const line = { t: now(), type: entry.type, ...(entry.newFileId ? { newFileId: entry.newFileId } : {}), ...(entry.hideMarkerId ? { hideMarkerId: entry.hideMarkerId } : {}) };
      fs.appendFileSync(fileOf(prefix), JSON.stringify(line) + '\n');
    },
    read(prefix) {
      const copies = [], hides = [];
      let text = '';
      try { text = fs.readFileSync(fileOf(prefix), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw err('WORKER_STATE'); }
      for (const raw of text.split('\n')) {
        if (!raw) continue;
        try { const e = JSON.parse(raw); if (e.newFileId) copies.push(e.newFileId); if (e.hideMarkerId) hides.push(e.hideMarkerId); } catch {}
      }
      return { copies, hides };
    },
    // Every version this worker made for the prefix (copies and hide markers).
    ids(prefix) { const { copies, hides } = this.read(prefix); return new Set([...copies, ...hides]); },
  };
}

export function fileHandlers({ withSession, bucketId, stateDir, now = () => Date.now() }) {
  if (!BUCKET_ID.test(bucketId)) throw new Error('CONFIG_INVALID:bucketId');
  const ledger = restoreLedger(stateDir, now);
  const applying = new Set();
  const ours = restoreJournal(stateDir, now);
  // The raw session is for listings only. This worker changes B2 through `writeGate` alone.
  const versions = (prefix) => withSession((s) => s.listFileVersions({ bucketId, prefix }));
  // The one way this worker changes B2 (Fable 5.2 설계 관문 넷째 1): copy and hide for a restore
  // to `at`, refused once B2 may have deleted what `at` needs. The limit is checked inside the
  // session callback (a call made again after a renewed sign-in is checked again — GPT r14 GA1)
  // and before every attempt inside the call (its retries — 설계 관문 넷째 3). Each call goes
  // through the session on its own, so a renewed sign-in retries that one call, never a whole
  // round that would copy again what was copied (카본 끝판 C4).
  const writeGate = (at) => {
    const young = () => { if (now() - at > SAFE_AGE_MS) throw err('TOO_OLD'); };
    const guarded = (method) => (a) => withSession((s) => { young(); return s[method](a, { beforeAttempt: young }); });
    return { young, copyFile: guarded('copyFile'), hideFile: guarded('hideFile') };
  };
  const plan = (list, at, repo, t0 = now()) => {
    try { return planRestore(list, { at, now: t0, prefix: repo }); }
    catch (e) { if (/^RESTORE_/.test(e?.message || '')) throw err(e.message === 'RESTORE_TIME_TOO_OLD' ? 'TOO_OLD' : 'BAD_INPUT'); throw e; }
  };
  return {
    // `from`: the customer's baseline (the last restore). Events before it are history; with
    // more than 1,000 after it, the 500 earliest (where a restore should go back to) and the
    // 500 latest (what is new) are returned, so a long-gone incident never hides a new one.
    async 'prefix.scan'({ prefix, since, from = 0, to = null }) {
      checkPrefix(prefix); checkTime(since); checkTime(from); if (to !== null) checkTime(to);
      const s = summarize(await versions(prefix), { customerPrefix: prefix, since, to, now: now(), journal: ours.read(prefix), hourlyFrom: from });
      const after = s.events.filter((e) => e.at >= from);
      const events = after.length > 1000 ? [...after.slice(0, 500), ...after.slice(-500)] : after;
      // The ones in between, by id only, to be marked seen (카본 r7 B5).
      const between = after.length > 1000 ? after.slice(500, -500).slice(0, MAX_BETWEEN).map((e) => [e.fileId, e.kind, e.at]) : [];
      return { ...s, events, between, eventCount: after.length };
    },
    async 'restore.plan'({ prefix, at }) {
      checkPrefix(prefix); checkTime(at);
      const p = plan(await versions(prefix + 'r/'), at, prefix + 'r/');
      return { at: p.at, counts: p.counts, copyBytes: p.copyBytes };
    },
    // Lists right before acting and records the latest upload time of that listing
    // (B2's clock) as the moment before the restore — 「되돌리기 취소」 goes back to it.
    // After a round it lists and plans again, up to MAX_ROUNDS, so a write that B2
    // still accepted from a just-deleted key is caught. A stopped run continues on
    // the next call (done items drop out of a new plan).
    // `resume` is accepted for older callers; the worker decides from its own record.
    async 'restore.apply'({ prefix, at, runId = null, undoOf = null }) {
      checkPrefix(prefix); checkTime(at);
      if ((runId !== null && !ID.test(runId)) || (undoOf !== null && !ID.test(undoOf))) throw err('BAD_INPUT');
      // One run per prefix at a time: an api that gave up waiting may ask again while this
      // worker still runs the first (Fable 5.2 설계 관문 셋째 7).
      if (applying.has(prefix)) throw err('BUSY');
      applying.add(prefix);
      try {
        const replay = ledger.replay(prefix, at, runId, undoOf);
        if (replay) return { ...replay, journal: [], replayed: true };
        // Whatever the run's start, nothing is changed once B2 may have deleted what `at` needs
        // (GPT 끝판 GC1 · 카본 끝판 C2): checked before the listing, after it (a listing can take
        // long), and by the write gate before every copy and hide, so a run that crosses the line
        // stops there (GPT r13 GA1).
        const gate = writeGate(at), { young } = gate;
        young();
        const repo = prefix + 'r/';
        let list = await versions(repo);
        young();
        const own = ours.ids(prefix);
        const unchanged = (p) => !list.some((v) => (v.uploadTimestamp || 0) > p && !own.has(v.fileId));
        const run = ledger.peek(prefix, at, runId, undoOf, unchanged);
        plan(list, at, repo, run.t0); // a bad time is refused before the day's count is used
        const rec = ledger.take(prefix, at, run, runId, undoOf);
        // The moment before belongs to the chain. The same run (same id) keeps it as it was
        // taken — a write a just-deleted key made meanwhile does not move it. A run over it by a
        // new id keeps it only while nothing but this worker's copies and hides came after it:
        // once backups ran on top, a new chain starts, so an undo never takes those backups
        // away. A new chain's moment is the listing's latest upload, or an hour before the run
        // began when that is older (an empty or long quiet folder: the same state, and the
        // undo stays inside the 29 days — 카본 r7 B1); lowered below to just before our first
        // own change if B2's clock is behind ours (Fable 6).
        let preAt = rec.preAt, preBase = rec.preBase ?? 0;
        const intact = Number.isSafeInteger(preAt) && (run.sameId || unchanged(preAt));
        if (!intact) {
          preBase = list.reduce((m, v) => Math.max(m, v.uploadTimestamp || 0), 0);
          preAt = Math.max(preBase, run.t0 - PRE_AT_BACK_MS);
          ledger.update(prefix, at, { preAt, preBase });
        }
        // Each own change as it is made (a round that stops half-way, or whose session is
        // renewed, keeps what it learned); a loop, not a spread, for very long rounds (카본 끝판 C4 · C5).
        const lower = (entries) => {
          let firstOwn = Infinity;
          for (const e of entries) if (Number.isSafeInteger(e.uploadTimestamp) && e.uploadTimestamp < firstOwn) firstOwn = e.uploadTimestamp;
          if (firstOwn !== Infinity && firstOwn - 1 < preAt) { preAt = Math.max(preBase, firstOwn - 1); ledger.update(prefix, at, { preAt }); }
        };
        const journal = []; let first = null, rounds = 0, left = 0;
        for (; rounds < MAX_ROUNDS; rounds++) {
          const p = plan(list, at, repo, run.t0);
          first ||= p;
          left = p.items.length;
          if (!left) break;
          let done;
          done = await applyPlan(gate, { bucketId, plan: p, now: now(), onItem: (e) => { ours.add(prefix, e); lower([e]); } });
          lower(done.journal);
          journal.push(...done.journal);
          list = await versions(repo);
        }
        if (rounds === MAX_ROUNDS) left = plan(list, at, repo, run.t0).items.length;
        // Something still left after the last round: the same run may continue, free. What it
        // did (without the per-file journal, which the journal file keeps) answers a retry.
        // `counted`: this worker took one of the day's restores for it. The api, which cannot see
        // whether backups ran on top of a failed run, takes this as the answer (카본 r13 A1).
        const result = { at, preAt, rounds, remaining: left, counts: first.counts, copyBytes: first.copyBytes, counted: !run.free };
        if (!left) ledger.update(prefix, at, { done: true, result });
        return { ...result, journal };
      } finally { applying.delete(prefix); }
    },
  };
}

export function startFilesWorker({ env = process.env } = {}) {
  const handlers = fileHandlers({ withSession: lazySession(secretFile('WB_FILES_B2', { env, json: true })), bucketId: need('WB_BUCKET_ID', { env, pattern: BUCKET_ID }), stateDir: need('WB_STATE_DIR', { env }) });
  return rpcServer({ secret: secretFile('WB_FILES_RPC', { env }), handlers, log: (e) => console.log(JSON.stringify({ at: new Date().toISOString(), service: 'files', ...e })) })
    .listen(Number(env.WB_PORT || 4191), listenHost(env));
}
