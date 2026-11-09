'use strict';
// 공개본(synk-policy) 스크립트를 훑어 이번에 고칠 엔진 모듈 사본이 든 파일을 센다(읽기만).
const path = require('node:path'), { execFileSync } = require('node:child_process');
const LIVE = path.join(process.env.USERPROFILE || process.env.HOME, 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const git = args => execFileSync('git', ['-C', LIVE, ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
if (process.argv.includes('--fetch')) git(['fetch', '--quiet', 'origin']);
const head = git(['rev-parse', 'origin/main']).toString().trim();
const rows = git(['ls-tree', '-r', '-l', 'origin/main']).toString('utf8').split('\n').map(line => line.match(/^\d+ blob ([0-9a-f]+)\s+(\d+)\t(.+)$/)).filter(Boolean)
  .filter(m => /\.(?:m?js|cjs)$/.test(m[3]) && !m[3].startsWith('.github/'));
const MARKS = { core: 'Core: invalid learning candidate', vellum: 'Vellum: invalid learning reason', store: 'Atlas: unreadable paged history', host: 'Verified WORLD account required', snap: 'snap-words.', strings: "'msg.vellum.review'" };
const found = {};
for (const m of rows) {
  const text = git(['cat-file', 'blob', m[1]]).toString('utf8'), kinds = Object.entries(MARKS).filter(([, mark]) => text.includes(mark)).map(([k]) => k);
  if (!kinds.length) continue;
  const policy = (text.match(/learning-priority-\d/g) || []).filter((v, i, a) => a.indexOf(v) === i).join(',');
  const guard = /if\s*\(\s*!folding\s*\|\|\s*paged\s*\)\s*return/.test(text) ? 'paged-guard' : '';
  found[m[3]] = `${kinds.join('+')} ${policy} ${guard} ${(Number(m[2]) / 1024).toFixed(0)}KB`;
}
console.log('live', head, 'files', rows.length);
for (const [file, info] of Object.entries(found)) console.log(file.padEnd(70), info);
