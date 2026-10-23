/** File mechanics of the local store's branches (vertical slice design §14-2·§14-6, W2 plan D9·F21).
 * One account is one folder: world.json (the commit point, replaced atomically), events.jsonl (the
 * event lines — Trail facts and deliveries, and the town events — appended), receipts.jsonl (command
 * receipts, appended), lease.json (who holds the town and the effective play time, replaced at every
 * pulse), seen.json (the seen ledger) and eval.jsonl (evaluation-only visit lines, present only while
 * there are any). A commit appends its lines and fsyncs before the world is replaced, so a crash leaves
 * at most lines past the world, which the next load cuts. What counts as past the world is the store's
 * call (it knows the sequences); this module only writes, reads and cuts. Node only — it stays out of
 * the town runtime layer and talk's bundle (F22).
 */
import fs from 'node:fs';
import path from 'node:path';

export const BRANCH_FILES = Object.freeze({ world: 'world.json', events: 'events.jsonl', receipts: 'receipts.jsonl',
  lease: 'lease.json', seen: 'seen.json', eval: 'eval.jsonl' });
export const branchPaths = dir => Object.fromEntries(Object.entries(BRANCH_FILES).map(([key, name]) => [key, path.join(dir, name)]));

/** Replace a file whole: a temporary file, fsynced, renamed over it. */
export function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(temporary, 'w');
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
export function removeFile(file) { fs.rmSync(file, { force: true }); }

/** Append JSON lines after the committed length, fsynced. Anything past that length (an attempt whose
 * commit failed) is cut first, so a line is in the file only once. Returns the new committed length. */
export function appendLines(file, committedBytes, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, fs.existsSync(file) ? 'r+' : 'w+');
  try {
    const size = fs.fstatSync(fd).size;
    if (size < committedBytes) throw new Error(`${path.basename(file)} is shorter than its committed length`);
    if (size > committedBytes) fs.ftruncateSync(fd, committedBytes);
    if (!lines.length) return committedBytes;
    const text = Buffer.from(lines.map(line => `${JSON.stringify(line)}\n`).join(''), 'utf8');
    fs.writeSync(fd, text, 0, text.length, committedBytes);
    fs.fsyncSync(fd);
    return committedBytes + text.length;
  } finally { fs.closeSync(fd); }
}

/** Read JSON lines up to the first one past the world (classify(line) === 'beyond') or a torn last
 * line, which never committed. A whole line that is not JSON, or that classify rejects by throwing, is
 * a damaged branch. Returns the committed lines, their length in bytes, and the file's length. */
export function readLines(file, classify) {
  if (!fs.existsSync(file)) return { lines: [], committed: 0, size: 0 };
  const buffer = fs.readFileSync(file), lines = [];
  let start = 0;
  while (start < buffer.length) {
    const end = buffer.indexOf(0x0a, start);
    if (end < 0) break;
    const line = JSON.parse(buffer.subarray(start, end).toString('utf8'));
    if (classify(line) === 'beyond') break;
    lines.push(line); start = end + 1;
  }
  return { lines, committed: start, size: buffer.length };
}
/** Cut a branch back to its committed length (a crash left lines past the world). */
export function truncateTo(file, bytes) {
  if (fs.existsSync(file) && fs.statSync(file).size > bytes) fs.truncateSync(file, bytes);
}
