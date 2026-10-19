// synk-policy에 「origin/main + 공개 후보 파일만」 커밋을 만든다(별도 인덱스, 작업본·가지는 건드리지 않음, push 없음).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const pub = 'C:/Users/q1212/Documents/synk-policy', dir = path.join(__dirname, 'candidate');
const index = path.join(os.tmpdir(), `policy-path-${process.pid}.index`);
const env = { ...process.env, GIT_INDEX_FILE: index };
const git = (args, opt = {}) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: pub, env, maxBuffer: 1 << 28, ...opt });
const text = args => git(args).toString('utf8').trim();
git(['fetch', '-q', 'origin', 'main']);
const parent = text(['rev-parse', 'origin/main']);
const files = []; const walk = (d, rel = '') => { for (const name of fs.readdirSync(d)) { const p = path.join(d, name), r = rel ? rel + '/' + name : name; if (fs.statSync(p).isDirectory()) walk(p, r); else if (name !== 'report.json') files.push(r); } }; walk(dir);
git(['read-tree', parent]);
for (const rel of files) {
  const oid = text(['hash-object', '-w', '--no-filters', path.join(dir, rel)]);
  git(['update-index', '--add', '--cacheinfo', `100644,${oid},try/travel/${rel}`]);
}
const tree = text(['write-tree']);
fs.rmSync(index, { force: true });
const msgFile = path.join(__dirname, 'policy-msg.txt');
const commit = text(['commit-tree', tree, '-p', parent, '-F', msgFile]);
const changed = text(['diff', '--name-status', parent, commit]).split('\n');
fs.writeFileSync(path.join(__dirname, 'policy-commit.txt'), commit + '\n');
console.log(JSON.stringify({ parent: parent.slice(0, 9), commit, files: files.length, changed: changed.length, added: changed.filter(l => l.startsWith('A')).length, modified: changed.filter(l => l.startsWith('M')).length, outside: changed.filter(l => !/\ttry\/travel\//.test(l)) }, null, 1));
