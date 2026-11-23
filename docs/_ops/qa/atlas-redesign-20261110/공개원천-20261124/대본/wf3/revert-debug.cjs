'use strict';
// app-shell 내 판(M 원천)에서 라이브 밖 앞면 커밋을 새것부터 되돌릴 때 겹치는 곳을 찍는다(cand.cjs와 같은 차례 · 같은 merge-file).
//   node revert-debug.cjs <M> [--쓰기 <파일>]
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const worktree = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const src = 'experiences/synk-world-app/app-shell.mjs';
const M = process.argv[2];
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const show = (rev, file) => execFileSync('git', ['-C', worktree, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, env }).toString('utf8').replace(/\r\n/g, '\n');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-'));
function merge3(current, base, other, label) {
  const c = path.join(tmp, 'c'), b = path.join(tmp, 'b'), o = path.join(tmp, 'o');
  fs.writeFileSync(c, current); fs.writeFileSync(b, base); fs.writeFileSync(o, other);
  const r = spawnSync('git', ['merge-file', '-p', '-L', label + '(내 판)', '-L', '그 커밋 뒤', '-L', '그 커밋 앞', c, b, o], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return { text: r.stdout, conflicts: r.status };
}
let mine = show(M, src);
for (const c of ['ffdd763c24', 'd1e3f5efd', '245db7a0f', '00f803b63']) {
  const r = merge3(mine, show(c, src), show(c + '^', src), '되돌리기 ' + c);
  console.log(`== ${c}: 겹침 ${r.conflicts}`);
  const re = /^<{7} [^\n]*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7} [^\n]*\n/gm;
  let m;
  while ((m = re.exec(r.text))) {
    const line = r.text.slice(0, m.index).split('\n').length;
    console.log(`-- ${line}행  [내 판]\n${m[1].split('\n').map(l => '   ' + l.slice(0, 230)).join('\n')}\n   [그 커밋 앞]\n${m[2].split('\n').map(l => '   ' + l.slice(0, 230)).join('\n')}`);
  }
  mine = r.text;
}
const at = process.argv.indexOf('--쓰기');
if (at > 0) fs.writeFileSync(process.argv[at + 1], mine);
