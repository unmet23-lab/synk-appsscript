// A style-only follow-up to the published SYNK ID page: id/style.css from this checkout, in the published line ends.
//   node experiences/synk-account/qa/login-one-form-20261111/patch-style.mjs <live dir> <out dir> <prior rev> [<next rev> | WORKTREE]
// <live dir> holds the published id/style.css as id__style.css (raw bytes of synk-policy origin/main). The published file must
// be <prior rev>'s style.css (so nothing published since is dropped), and between <prior rev> and the next one nothing else
// that the page is built from may have changed (portal modules, index.html) — those go out with patch-live.mjs instead.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, '../../../..');
const [liveDir, outDir, priorRev, nextRev = 'HEAD'] = process.argv.slice(2);
if (!liveDir || !outDir || !priorRev) throw new Error('usage: patch-style.mjs <live dir> <out dir> <prior rev> [<next rev> | WORKTREE]');
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 28 });
const lf = text => text.replace(/\r\n/g, '\n'), crlf = text => lf(text).replace(/\n/g, '\r\n');
const source = (rev, file) => rev === 'WORKTREE' ? lf(fs.readFileSync(path.join(repo, file), 'utf8')) : git('show', `${rev}:${file}`).toString('utf8');
const STYLE = 'experiences/synk-account/style.css';
// What else the published page is made from: unchanged since the prior publish, or this is not a style-only follow-up.
const REST = ['experiences/synk-account/index.html', 'experiences/synk-account/src/portal.mjs', 'experiences/synk-account/src/google-auth.mjs', 'experiences/synk-account/src/portal-security.mjs', 'experiences/synk-account/src/portal-account.mjs', 'experiences/synk-account/src/recent-login.mjs'];
const moved = REST.filter(file => source(priorRev, file) !== source(nextRev, file));
if (moved.length) throw new Error('not a style-only follow-up — also changed since the published page: ' + moved.join(', '));
const liveStyle = fs.readFileSync(path.join(liveDir, 'id__style.css'), 'utf8');
if (lf(liveStyle) !== source(priorRev, STYLE)) throw new Error(`the published style.css is not ${priorRev}'s`);
const next = source(nextRev, STYLE);
if (next === lf(liveStyle)) throw new Error('style.css has not changed since the published page');
const style = (liveStyle.includes('\r\n') ? crlf : lf)(next);
for (const needle of ['.method-btn{', '.method-choices{', '@media(max-width:340px){.method-btn{', ".sb-stitch{border-image-source:url('./assets/thread-shift.webp')}"]) if (!style.includes(needle)) throw new Error('style.css lacks ' + needle);
// The lines that differ, for the review.
const before = lf(liveStyle).split('\n'), after = next.split('\n');
const changed = { removed: before.filter(line => !after.includes(line)).map(line => line.slice(0, 200)), added: after.filter(line => !before.includes(line)).map(line => line.slice(0, 200)) };
const report = { priorRev: git('rev-parse', priorRev).toString().trim(), nextRev: nextRev === 'WORKTREE' ? nextRev : git('rev-parse', nextRev).toString().trim(), liveBytes: Buffer.byteLength(liveStyle), outBytes: Buffer.byteLength(style), priorStyleMatched: true, changed };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__style.css'), style);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 1));
