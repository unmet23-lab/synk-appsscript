'use strict';
// 2단계 후보의 2단 알림 WORLD 판(4-8 가지 claude/atlas-2step-push-world, 바탕 8e7b568889 → 끝 a0237627fe)을 얹는다(설계 주인 11-20 · 4-8 정정 07:20).
//   app-shell · world-reminder-device: 셋째 후보(첫째 · 둘째 · 셋째가 라이브가 된 뒤의 바이트) 위 3방향
//   world-push: 지금 라이브 위 3방향
// 바탕 · 끝 원천은 공개 빌드와 같은 고쳐 쓰기를 건다. 겹침이 나면 그 블록을 찍고 멈춘다(4-8에 알린다 — 그쪽이 고친다).
//   node step2-push.cjs [--쓰기 <폴더>]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { makeRewrite } = require('./rewrite-lib.cjs');
const worktree = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const C = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1';
const BASE = '8e7b568889', END = 'a0237627fe';
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const lf = s => s.replace(/\r\n/g, '\n');
const show = (rev, file) => lf(execFileSync('git', ['-C', worktree, '-c', 'core.autocrlf=false', 'show', `${rev}:${file}`], { maxBuffer: 1 << 28, env }).toString('utf8'));
const rewrite = makeRewrite({ basePath: '/world/', account: { learningUrl: 'https://synk.im/try/learning-hub/' } });
const tree = JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'], { maxBuffer: 1 << 28, env }).toString('utf8'));
const liveSha = new Map(tree.tree.filter(t => t.type === 'blob').map(t => [t.path, t.sha]));
const liveText = p => lf(Buffer.from(JSON.parse(execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/blobs/' + liveSha.get(p)], { maxBuffer: 1 << 28, env }).toString('utf8')).content, 'base64').toString('utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 's2p-'));
function merge3(current, base, other) {
  const c = path.join(tmp, 'c'), b = path.join(tmp, 'b'), o = path.join(tmp, 'o');
  fs.writeFileSync(c, current); fs.writeFileSync(b, base); fs.writeFileSync(o, other);
  const r = spawnSync('git', ['merge-file', '-p', '-L', '지금 후보', '-L', '2단 바탕', '-L', '2단 끝', c, b, o], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return { text: r.stdout, conflicts: r.status };
}
const files = [
  ['experiences/synk-world-app/app-shell.mjs', 'app-shell.mjs', () => lf(fs.readFileSync(path.join(C, 'new/world/app-shell.mjs'), 'utf8')), '셋째 후보'],
  ['experiences/synk-world-app/world-reminder-device.mjs', 'world-reminder-device.mjs', () => lf(fs.readFileSync(path.join(C, 'new/world/world-reminder-device.mjs'), 'utf8')), '셋째 후보'],
  ['experiences/synk-world-app/world-push.mjs', 'world-push.mjs', () => liveText('world/world-push.mjs'), '라이브'],
];
const at = process.argv.indexOf('--쓰기');
let stop = 0;
for (const [src, p, current, from] of files) {
  const base = rewrite(show(BASE, src), p), end = rewrite(show(END, src), p);
  const cur = current();
  const r = merge3(cur, base, end);
  const delta = r.text.split('\n').length - cur.split('\n').length;
  console.log(`${p.padEnd(28)} 바탕 위치 ${from} · 겹침 ${r.conflicts} · 줄 수 차이 ${delta >= 0 ? '+' : ''}${delta}`);
  const re = /^<{7} [^\n]*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7} [^\n]*\n/gm;
  let m;
  while ((m = re.exec(r.text))) {
    const line = r.text.slice(0, m.index).split('\n').length;
    console.log(`  -- ${line}행 [지금 후보]\n${m[1].split('\n').map(l => '     ' + l.slice(0, 220)).join('\n')}\n     [2단 끝]\n${m[2].split('\n').map(l => '     ' + l.slice(0, 220)).join('\n')}`);
  }
  if (r.conflicts) stop++;
  if (at > 0 && !r.conflicts) {
    const out = path.join(process.argv[at + 1], 'world', p);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, r.text);
  }
}
console.log(stop ? `겹침 있는 파일 ${stop} — 4-8에 알린다` : '겹침 0');
