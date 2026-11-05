'use strict';
// What a verification checkout holds. docs/ is 25,000 of the 41,000 tracked files and 69% of the backlog changed nothing else, while the local tests read only the paths below
// (tracing every process of a full run, then passing 79/79 with the rest physically gone: 11-05, README #tested-tree). So the rest stays out of every checkout:
// a test that needs a file left out fails instead of quietly reading it, and the trace below turns even a probe into a failure.
const fs = require('node:fs'), path = require('node:path');
const { sha256 } = require('./contract.cjs');
// A folder ends in '/'. Keep a whole folder when tests run its code, so a commit touching any of it is verified itself.
const KEPT_DOCS = Object.freeze(require('./tested-tree.json').kept);
const SPARSE_PATTERNS = Object.freeze(['/*', '!/docs/', ...KEPT_DOCS.map(entry => `/${entry}`)]);
const LIST_DIGEST = sha256(SPARSE_PATTERNS.join('\n'));
const kept = file => KEPT_DOCS.some(entry => entry.endsWith('/') ? file.startsWith(entry) : file === entry);
const outsideTestedTree = file => file.startsWith('docs/') && !kept(file);
// Listing or stat-ing a folder on the way to a kept path says nothing about what was left out.
const onTheWay = file => KEPT_DOCS.some(entry => entry.startsWith(`${file}/`));
// The first-parent line from..to: each commit's parent and whether anything under test changed. A commit that cannot be read never counts as unchanged.
function testedChanges(root, from, to, runGit) {
  const text = runGit(root, ['log', '--first-parent', '--diff-merges=first-parent', '--no-renames', '--name-only', '-z', '--format=%x01%H %P', `${from}..${to}`]);
  const entries = text.split('\u0001').slice(1), found = new Map();
  // A file name holding this separator could pass for a commit and cut the real one's list short. Nothing can be read from such a range, so nothing in it carries.
  if (Number(runGit(root, ['rev-list', '--first-parent', '--count', `${from}..${to}`])) !== entries.length) throw Error('A file name holds the log separator');
  for (const entry of entries) {
    // git puts one newline before the first name. A name is otherwise left exactly as it is: " docs/x" is not under docs/.
    const [head, ...names] = entry.split('\0'), [commit, parent] = head.trim().split(' ');
    found.set(commit, { parent, unchanged: names.map(name => name.replace(/^\n/, '')).filter(Boolean).every(outsideTestedTree) });
  }
  return found;
}
// Every verification records what its test processes touched outside the tested tree. A process that touched nothing writes nothing, so a clean run leaves no folder.
const TRACER = path.join(__dirname, 'read-trace.cjs');
const traceEnvironment = (root, folder) => ({ CQA_TRACE_ROOT: root, CQA_TRACE_DIR: folder, NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require "${TRACER.split(path.sep).join('/')}"`].filter(Boolean).join(' ') });
function touchedOutside(folder) {
  let names;
  try { names = fs.readdirSync(folder); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return [...new Set(names.flatMap(name => fs.readFileSync(path.join(folder, name), 'utf8').split('\n').filter(Boolean)))].sort();
}
module.exports = { KEPT_DOCS, SPARSE_PATTERNS, LIST_DIGEST, outsideTestedTree, onTheWay, testedChanges, traceEnvironment, touchedOutside };
