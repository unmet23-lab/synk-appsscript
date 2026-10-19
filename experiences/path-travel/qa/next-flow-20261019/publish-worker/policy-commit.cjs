// synk-policy에 「origin/main + 공개 후보 파일만」 커밋을 만든다(별도 인덱스, 작업본·가지는 건드리지 않음, push 없음).
// 지난 공개의 ../publish/policy-commit.cjs와 같은 방식. 올리기는 승인 뒤 `git -C ../synk-policy push origin <커밋>:refs/heads/main` 한 줄로 한다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const pub = 'C:/Users/q1212/Documents/synk-policy', dir = path.join(__dirname, 'candidate');
const index = path.join(os.tmpdir(), `policy-path-worker-${process.pid}.index`);
const env = { ...process.env, GIT_INDEX_FILE: index };
const git = args => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: pub, env, maxBuffer: 1 << 28 });
const text = args => git(args).toString('utf8').trim();
git(['fetch', '-q', 'origin', 'main']);
const parent = text(['rev-parse', 'origin/main']);
const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
// 후보를 만든 공개본 위에서만 커밋한다(그새 main이 움직였으면 후보부터 다시).
if (report.publicBase !== parent) throw new Error(`후보는 ${report.publicBase.slice(0, 9)} 위에서 만들었는데 origin/main은 ${parent.slice(0, 9)} — 후보부터 다시`);
const files = fs.readdirSync(dir).filter(name => name !== 'report.json');
git(['read-tree', parent]);
for (const rel of files) {
  const oid = text(['hash-object', '-w', '--no-filters', path.join(dir, rel)]);
  git(['update-index', '--add', '--cacheinfo', `100644,${oid},try/travel/${rel}`]);
}
const tree = text(['write-tree']);
fs.rmSync(index, { force: true });
const commit = text(['commit-tree', tree, '-p', parent, '-F', path.join(__dirname, 'policy-msg.txt')]);
const changed = text(['diff', '--name-status', parent, commit]).split('\n');
fs.writeFileSync(path.join(__dirname, 'policy-commit.txt'), commit + '\n');
console.log(JSON.stringify({ parent: parent.slice(0, 9), commit, files: files.length, changed, outside: changed.filter(line => !/\ttry\/travel\//.test(line)) }, null, 1));
