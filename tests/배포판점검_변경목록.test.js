const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const checker = require.resolve('../tools/배포판점검');

test('1 MiB가 넘는 변경 목록에서 루트와 하위 프로젝트의 추가·삭제·이동을 판별한다', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-deploy-diff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = path.join(root, 'no-global-config');
  const git = (args, input) => execFileSync('git', args, {
    cwd: root, env, input, encoding: 'utf8', windowsHide: true,
  }).trim();
  git(['init', '--quiet', '-b', 'master']);
  git(['config', 'core.autocrlf', 'false']);
  git(['config', 'diff.renames', 'true']);
  const nested = path.join(root, 'child');
  fs.mkdirSync(nested);
  const defaults = path.join(root, 'defaults');
  fs.mkdirSync(defaults);
  fs.writeFileSync(path.join(defaults, 'old.js'), 'initially included by default\n');
  fs.writeFileSync(path.join(defaults, 'new.txt'), 'included by a new rule\n');
  const currentRules = '**/*\n!*.js\n!added.txt\n';
  fs.writeFileSync(path.join(root, '.claspignore'), '**/*\n!*.js\n!lib/drop.gs\n!removed.txt\n');
  fs.writeFileSync(path.join(nested, 'shared-rules'), '**/*\n!worker.js\n!old.txt\n');
  fs.writeFileSync(path.join(root, 'Code.js'), "const SYNK_VERSION = '9';\n");
  fs.writeFileSync(path.join(root, 'gone.js'), 'move outside\n');
  fs.writeFileSync(path.join(root, 'deleted.js'), 'delete\n');
  fs.writeFileSync(path.join(root, 'before.js'), 'move inside\n');
  fs.mkdirSync(path.join(root, 'lib'));
  fs.writeFileSync(path.join(root, 'lib', 'drop.gs'), 'removed from rules and moved\n');
  fs.writeFileSync(path.join(root, 'removed.txt'), 'unchanged bytes, removed from deployment\n');
  fs.writeFileSync(path.join(root, 'added.txt'), 'unchanged bytes, added to deployment\n');
  fs.writeFileSync(path.join(nested, 'ignored-deleted.js'), 'never deployed\n');
  fs.writeFileSync(path.join(nested, 'old.txt'), 'unchanged\n');
  fs.writeFileSync(path.join(nested, 'new.txt'), 'unchanged\n');
  fs.writeFileSync(path.join(nested, 'note.txt'), 'move into deployment\n');
  git(['add', '.']);
  const link = git(['hash-object', '-w', '--stdin'], './shared-rules');
  git(['update-index', '--add', '--cacheinfo', '120000,' + link + ',child/.claspignore']);
  git(['-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=unused-hooks', 'commit', '--quiet', '-m', 'base']);
  const base = git(['rev-parse', 'HEAD']);
  const blob = git(['hash-object', '-w', '--stdin'], 'new\n');
  const rulesBlob = git(['hash-object', '-w', '--stdin'], currentRules);
  const sharedRules = git(['hash-object', '-w', '--stdin'], '**/*\n!worker.js\n!new.txt\n');
  const newRules = git(['hash-object', '-w', '--stdin'], '**/*\n!new.txt\n');
  // 같은 blob을 재사용해 긴 변경 목록만 만들고 수천 개의 작업 파일은 쓰지 않는다.
  const prefix = 'docs/' + 'x'.repeat(140);
  const noise = Array.from({ length: 7400 }, (_, i) => `M 100644 ${blob} ${prefix}/${i}.md`);
  git(['fast-import', '--quiet'], [
    'commit refs/heads/master', 'committer QA <qa@example.invalid> 1700000000 +0000',
    'data 4', 'next', 'from ' + base, ...noise, 'M 100644 ' + blob + ' engine.js',
    'R child/note.txt child/worker.js', 'R gone.js notes.md', 'R before.js after.js',
    'R lib/drop.gs docs/drop.txt', 'M 100644 ' + rulesBlob + ' .claspignore', 'D child/ignored-deleted.js',
    'M 100644 ' + sharedRules + ' child/shared-rules', 'M 100644 ' + newRules + ' defaults/.claspignore',
    'M 100644 ' + blob + ' "odd\\177name.js"',
    'M 100644 ' + blob + ' ignored.json', 'M 100644 ' + blob + ' child/ignored.js', 'D deleted.js', '', 'done', '',
  ].join('\n'));
  assert.ok(noise.length * prefix.length > 1024 * 1024);
  const run = 'const [checker, root, ...projects] = process.argv.slice(1);' +
    'console.log(JSON.stringify(require(checker).안나간변경(root, [root, ...projects], { 도장: false })));';
  const check = () => JSON.parse(execFileSync(process.execPath, ['-e', run, checker, root, nested, defaults],
    { cwd: root, env: { ...env, GIT_LITERAL_PATHSPECS: '1' }, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }));
  const result = check();
  assert.ok(result, 'Git이 반환한 변경 목록을 읽어야 한다');
  assert.equal(result.배포커밋, base.slice(0, 7));
  assert.deepEqual(result.프로젝트들.map(project => [project.이름, project.파일들]), [
    ['(루트)', ['added.txt', 'after.js', 'before.js', 'deleted.js', 'engine.js', 'gone.js', 'lib/drop.gs', 'odd\x7fname.js', 'removed.txt']],
    ['child', ['child/new.txt', 'child/old.txt', 'child/worker.js']],
    ['defaults', ['defaults/new.txt', 'defaults/old.js']],
  ]);
  const change = (...operations) => git(['fast-import', '--quiet'], [
    'commit refs/heads/master', 'committer QA <qa@example.invalid> 1700000001 +0000', 'data 4', 'next',
    'from ' + git(['rev-parse', 'HEAD']), ...operations, '', 'done', '',
  ].join('\n'));
  const excludeAll = git(['hash-object', '-w', '--stdin'], '**/*\n');
  const dirLink = git(['hash-object', '-w', '--stdin'], 'config/sub');
  const indirect = git(['hash-object', '-w', '--stdin'], 'redirect/../shared-rules');
  change('M 120000 ' + indirect + ' child/.claspignore', 'M 120000 ' + dirLink + ' child/redirect',
    'M 100644 ' + sharedRules + ' child/config/shared-rules', 'M 100644 ' + blob + ' child/config/sub/keep.txt',
    'M 100644 ' + excludeAll + ' child/shared-rules');
  assert.deepEqual(check().프로젝트들.find(p => p.이름 === 'child').파일들,
    ['child/new.txt', 'child/old.txt', 'child/worker.js'], '중간 디렉터리 링크를 먼저 따라간 뒤 상위 디렉터리로 올라간다');
  const upper = git(['hash-object', '-w', '--stdin'], '../other-rules');
  change('M 120000 ' + upper + ' child/.claspignore', 'M 100644 ' + sharedRules + ' other-rules',
    'M 100644 ' + sharedRules + ' child/shared-rules');
  assert.deepEqual(check().프로젝트들.find(p => p.이름 === 'child').파일들, ['child/new.txt', 'child/old.txt', 'child/worker.js']);
  change('M 100644 ' + excludeAll + ' .claspignore');
  assert.ok(check().프로젝트들[0].파일들.includes('Code.js'), '마지막 허용 줄을 없애면 기존 파일이 배포에서 빠진다');
  for (const rules of ['worker*.js\n', '**/*\n!*.js\ndraft.js\n']) {
    const unsupported = git(['hash-object', '-w', '--stdin'], rules);
    change('M 100644 ' + unsupported + ' .claspignore');
    assert.equal(check(), null, '명시 허용 방식으로 판정할 수 없는 규칙은 기본값으로 바꾸지 않는다');
  }
  change('M 100644 ' + rulesBlob + ' .claspignore', 'D child/.claspignore', 'M 100644 ' + blob + ' child/.claspignore/nested');
  assert.equal(check(), null, '커밋된 규칙이 읽을 수 있는 파일이 아니면 판정을 중단한다');
  for (const target of ['../missing-file', '../../outside-repo']) {
    const brokenLink = git(['hash-object', '-w', '--stdin'], target);
    change('D child/.claspignore', 'M 120000 ' + brokenLink + ' child/.claspignore');
    assert.equal(check(), null, '커밋 트리 안에서 확인할 수 없는 링크는 판정을 중단한다');
  }
  change('M 120000 ' + link + ' child/.claspignore');
  assert.ok(check(), '규칙 blob을 빼기 직전에는 세 프로젝트 모두 판정할 수 있다');
  // 부분 클론처럼 트리에는 규칙 파일이 있지만 해당 blob을 아직 받지 않은 상황을 만든다.
  const unavailable = git(['hash-object', '--stdin'], 'unavailable rules blob\n');
  const listing = git(['ls-tree', 'HEAD']).replace(/^100644 blob [a-f0-9]+\t\.claspignore$/m, '100644 blob ' + unavailable + '\t.claspignore');
  const tree = git(['mktree', '--missing'], listing + '\n');
  const previous = git(['rev-parse', 'HEAD']);
  const incomplete = git(['-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit-tree', tree, '-p', previous, '-m', 'partial']);
  git(['update-ref', 'refs/heads/master', incomplete, previous]);
  assert.equal(check(), null, '등록된 규칙 blob이 없으면 판정을 중단한다');
});
