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
import { PREFIX, BUCKET_ID, need, secretFile } from './config.mjs';

export const RESTORES_PER_DAY = 3;
export const MAX_ROUNDS = 4;
const err = (code) => Object.assign(new Error(code), { code });
const checkPrefix = (prefix) => { if (!PREFIX.test(prefix || '')) throw err('BAD_INPUT'); return prefix; };
const checkTime = (v) => { if (!Number.isSafeInteger(v) || v < 0) throw err('BAD_INPUT'); return v; };

const DAY = 86400000;
// Restores per customer per day, kept on this worker's own volume. Continuing is free
// only for the very run this worker started and has not finished (same prefix and time);
// any other call — a claimed `resume` included — is a new restore and counts. An
// unfinished run keeps its record, and with it its moment before, however long it waits
// (GPT r6 GB1); a finished one is forgotten after two days.
// peek() tells whether a call is free and the time the run is planned with (its start, so a
// run that began just inside the 29 days is not refused on a later round — 카본 r6 B4); take()
// counts it, after its first plan passed. Free: the same unfinished run again (whatever the
// call says), or the undo of this worker's own last finished run (back to the moment before
// that run recorded, once — not an undo of an undo; 카본 r6 C2).
function restoreCounter(stateDir, now) {
  const file = path.join(stateDir, 'restore-days.json');
  const read = (t) => {
    let all = {};
    try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw err('WORKER_STATE'); }
    all.started = Object.fromEntries(Object.entries(all.started || {}).filter(([, v]) => v && (!v.done || t - v.t < 29 * DAY)));
    return all;
  };
  return {
    peek(prefix, at, runId = null) {
      const t = now(), run = read(t).started[prefix];
      // The same run asked again after its answer was lost: what it did, not a new restore (GPT r7 GB1).
      if (runId && run?.runId === runId && run.at === at && run.done && run.result) return { replay: run.result };
      if (run?.at === at && !run.done) return { free: true, t0: run.t };
      if (run?.done && !run.undo && Number.isSafeInteger(run.preAt) && run.preAt === at) return { free: true, undo: true, t0: t };
      return { free: false, t0: t };
    },
    take(prefix, at, { free, undo, t0 }, runId = null) {
      if (free && !undo) return;
      const t = now(), day = new Date(t).toISOString().slice(0, 10), all = read(t);
      const today = all.day === day ? all.counts || {} : {};
      const n = (today[prefix] || 0) + (undo ? 0 : 1);
      if (n > RESTORES_PER_DAY) throw err('LIMIT_WORKER_DAY');
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ day, counts: { ...today, [prefix]: n }, started: { ...all.started, [prefix]: { at, t: t0, ...(runId ? { runId } : {}), ...(undo ? { undo: true } : {}) } } })); fs.renameSync(tmp, file);
    },
  };
}
// The moment before a run is taken once, at its first listing (before it changed anything):
// a continued run keeps it — its own copies and hides would otherwise move it.
function preAtOf(stateDir, prefix, at, compute) {
  const file = path.join(stateDir, 'restore-days.json');
  let all = {};
  try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw err('WORKER_STATE'); }
  const run = all.started?.[prefix];
  if (run?.at === at && Number.isSafeInteger(run.preAt)) return run.preAt;
  const preAt = compute();
  if (run?.at === at) {
    run.preAt = preAt;
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all)); fs.renameSync(tmp, file);
  }
  return preAt;
}
// The run for (prefix, at) came back: a later `resume` of it is a new restore.
function markFinished(stateDir, prefix, at, result) {
  const file = path.join(stateDir, 'restore-days.json');
  let all = {};
  try { all = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw err('WORKER_STATE'); }
  if (all.started?.[prefix]?.at !== at) return;
  all.started[prefix].done = true;
  // What it did (without the per-file journal, which the journal file keeps): a retry of the
  // same run gets this answer instead of a new restore.
  all.started[prefix].result = result;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all)); fs.renameSync(tmp, file);
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
  };
}

export function fileHandlers({ withSession, bucketId, stateDir, now = () => Date.now() }) {
  if (!BUCKET_ID.test(bucketId)) throw new Error('CONFIG_INVALID:bucketId');
  const countRestore = restoreCounter(stateDir, now);
  const ours = restoreJournal(stateDir, now);
  const versions = (prefix) => withSession((s) => s.listFileVersions({ bucketId, prefix }));
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
      const s = summarize(await versions(prefix), { customerPrefix: prefix, since, to, now: now(), journal: ours.read(prefix) });
      const after = s.events.filter((e) => e.at >= from);
      const events = after.length > 1000 ? [...after.slice(0, 500), ...after.slice(-500)] : after;
      return { ...s, events, eventCount: after.length };
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
    async 'restore.apply'({ prefix, at, runId = null }) {
      checkPrefix(prefix); checkTime(at);
      if (runId !== null && !/^[a-z0-9]{16}$/.test(runId)) throw err('BAD_INPUT');
      const run = countRestore.peek(prefix, at, runId);
      if (run.replay) return { ...run.replay, journal: [], replayed: true };
      const repo = prefix + 'r/';
      let list = await versions(repo);
      plan(list, at, repo, run.t0); // a bad time is refused before the day's count is used
      countRestore.take(prefix, at, run, runId);
      const preAt = preAtOf(stateDir, prefix, at, () => list.reduce((m, v) => Math.max(m, v.uploadTimestamp || 0), 0));
      const journal = []; let first = null, rounds = 0, left = 0;
      for (; rounds < MAX_ROUNDS; rounds++) {
        const p = plan(list, at, repo, run.t0);
        first ||= p;
        left = p.items.length;
        if (!left) break;
        const done = await withSession((s) => applyPlan(s, { bucketId, plan: p, now: now(), onItem: (e) => ours.add(prefix, e) }));
        journal.push(...done.journal);
        list = await versions(repo);
      }
      if (rounds === MAX_ROUNDS) left = plan(list, at, repo, run.t0).items.length;
      // Something still left after the last round: the same run may continue, free.
      const result = { at, preAt, rounds, remaining: left, counts: first.counts, copyBytes: first.copyBytes };
      if (!left) markFinished(stateDir, prefix, at, result);
      return { ...result, journal };
    },
  };
}

export function startFilesWorker({ env = process.env } = {}) {
  const handlers = fileHandlers({ withSession: lazySession(secretFile('WB_FILES_B2', { env, json: true })), bucketId: need('WB_BUCKET_ID', { env, pattern: BUCKET_ID }), stateDir: need('WB_STATE_DIR', { env }) });
  return rpcServer({ secret: secretFile('WB_FILES_RPC', { env }), handlers, log: (e) => console.log(JSON.stringify({ at: new Date().toISOString(), service: 'files', ...e })) })
    .listen(Number(env.WB_PORT || 4191), '0.0.0.0');
}
