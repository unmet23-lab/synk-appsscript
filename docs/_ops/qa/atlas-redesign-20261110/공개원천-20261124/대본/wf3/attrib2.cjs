'use strict';
// 후보의 공용 파일 14개에서 라이브보다 더한 코드 줄(주석만인 줄 빼고)이 어느 커밋에서 왔는지 X의 blame으로 가른다.
// Atlas 커밋(단계 4 꼴의 제목)이 아닌 줄이 있으면 라이브 밖 다른 일이 섞인 것이다.
//   node attrib2.cjs
const fs = require('node:fs'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { makeRewrite } = require('./rewrite-lib.cjs');
const worktree = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const C = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1';
const X = '1ebc932569d817343f5175fe63ee03ff9582bd74';
const ATLAS = /Atlas (?:재설계 )?단계 ?4|Atlas 엔진 · WORLD 셸|Atlas 엔진\(단계 4|Atlas 4-4d|Atlas 단계4/;
const rewrite = makeRewrite({ basePath: '/world/', account: { learningUrl: 'https://synk.im/try/learning-hub/' } });
const report = JSON.parse(fs.readFileSync(path.join(C, 'report.json'), 'utf8'));
const norm = s => s.replace(/\bGPT\b ?/g, '').replace(/\s+/g, ' ').trim();
const isComment = s => /^\s*(\/\/|\*|\/\*)/.test(s) || s.trim() === '';
const subjects = new Map();
const subject = h => {
  if (!subjects.has(h)) subjects.set(h, execFileSync('git', ['-C', worktree, 'log', '-1', '--format=%s', h]).toString().trim());
  return subjects.get(h);
};
let foreign = 0;
for (const f of report.files.filter(x => x.kind === 'merged')) {
  const blame = execFileSync('git', ['-C', worktree, 'blame', '--line-porcelain', X, '--', f.src], { maxBuffer: 1 << 28 }).toString('utf8').split('\n');
  const byLine = new Map();
  let commit = null;
  for (const line of blame) {
    const head = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
    if (head) { commit = head[1]; continue; }
    if (line.startsWith('\t')) {
      const text = norm(rewrite(line.slice(1).replace(/\r$/, ''), f.p));
      if (!byLine.has(text)) byLine.set(text, new Set());
      byLine.get(text).add(commit);
    }
  }
  const r = spawnSync('git', ['diff', '--no-index', '-U0', '--', path.join(C, 'pubbase/world', f.p), path.join(C, 'pub/world', f.p)], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const added = r.stdout.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1).replace(/\r$/, '')).filter(l => !isComment(l));
  const tally = new Map();
  const odd = [];
  for (const line of added) {
    const commits = byLine.get(norm(line));
    if (!commits) { odd.push(['(blame에 없음 — 손으로 푼 줄?)', line]); continue; }
    const atlas = [...commits].some(h => ATLAS.test(subject(h)));
    const key = atlas ? 'Atlas' : [...commits].map(h => h.slice(0, 9) + ' ' + subject(h).slice(0, 60)).join(' / ');
    tally.set(key, (tally.get(key) || 0) + 1);
    if (!atlas) odd.push([key, line]);
  }
  console.log(`${f.p}: 더한 코드 줄 ${added.length} — ${[...tally].map(([k, n]) => `${k.slice(0, 80)} ${n}`).join(' · ')}`);
  for (const [k, line] of odd.slice(0, 8)) console.log(`   ? ${k.slice(0, 90)} :: ${line.trim().slice(0, 150)}`);
  foreign += odd.length;
}
console.log('Atlas 밖으로 보이는 줄', foreign);
