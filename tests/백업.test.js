'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { 파일복사, 큰파일한계 } = require('../tools/백업.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-backup-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), destination = path.join(root, 'destination');
  fs.mkdirSync(source);
  const put = (name, data) => {
    const file = path.join(source, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    return file;
  };
  return { root, source, destination, put };
}

test('문서·소스는 검증한 원문 바이트 그대로 복사한다', t => {
  const f = fixture(t), bytes = Buffer.from('# 작업 원문\nconst 값 = 3;\n');
  const source = f.put('원문.md', bytes), target = path.join(f.destination, '원문.md');
  assert.deepEqual(파일복사(source, target), { 바이트: bytes.length });
  assert.deepEqual(fs.readFileSync(target), bytes);
});

test('미디어·자격 파일·인라인 미디어·위장 ts를 이유별로 제외한다', t => {
  const f = fixture(t);
  const rows = [
    ['image.png', Buffer.from([137, 80, 78, 71]), 'non-text-extension'],
    ['.env', 'SYNTHETIC=fixture-only', 'credential-path'],
    ['secrets/settings.json', '{}', 'credential-path'],
    ['inline.html', '<img src="data:image/png;base64,AAAA">', 'embedded-media-or-base64'],
    ['audio.ts', Buffer.from([0x47, 0, 1, 2, 0x47]), 'binary-control-bytes'],
    ['settings.json', JSON.stringify({ api_key: 'synthetic-private-value' }), 'secret-literal'],
  ];
  for (const [name, data, reason] of rows) {
    const source = f.put(name, data), target = path.join(f.destination, name);
    const result = 파일복사(source, target);
    assert.equal(result.건너뜀, true, name);
    assert.equal(result.사유, reason, name);
    assert.equal(fs.existsSync(target), false, name);
  }
  assert.equal(fs.existsSync(f.destination), false);
});

test('10MiB 초과 문서는 크기 사유로 제외한다', t => {
  const f = fixture(t), source = f.put('large.md', Buffer.alloc(큰파일한계 + 1, 0x20));
  assert.deepEqual(파일복사(source, path.join(f.destination, 'large.md')), {
    건너뜀: true, 사유: 'over-10MiB', 바이트: 큰파일한계 + 1,
  });
  assert.equal(fs.existsSync(f.destination), false);
});

test('원본과 목적의 상위 junction·symlink를 따라 읽거나 쓰지 않는다', t => {
  const f = fixture(t), source = f.put('safe.md', 'safe fixture');
  const linkedSource = path.join(f.root, 'linked-source');
  fs.symlinkSync(f.source, linkedSource, process.platform === 'win32' ? 'junction' : 'dir');
  const result = 파일복사(path.join(linkedSource, 'safe.md'), path.join(f.destination, 'source.md'), {
    목적클라우드: f.root,
  });
  assert.equal(result.사유, 'link-or-reparse-point');
  fs.mkdirSync(f.destination);
  const linkedTarget = path.join(f.root, 'linked-target');
  fs.symlinkSync(f.destination, linkedTarget, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(파일복사(source, path.join(linkedTarget, 'target.md'), { 목적클라우드: f.root }).사유, 'link-or-reparse-point');
  assert.deepEqual(fs.readdirSync(f.destination), []);
});

test('진단은 원격 git 호출·인덱스 갱신·파일 쓰기 없이 동일 제외 사유를 돌려준다', t => {
  const f = fixture(t), repo = path.join(f.root, 'project'), cloud = path.join(f.root, 'cloud');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(cloud);
  fs.writeFileSync(path.join(repo, 'code.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(repo, 'picture.png'), Buffer.from([137, 80, 78, 71]));
  fs.writeFileSync(path.join(f.root, 'note.md'), '# fixture\n');
  fs.writeFileSync(path.join(f.root, 'voice.mp3'), Buffer.from([73, 68, 51]));
  const calls = [], output = [], linkCalls = [];
  const toolPath = path.resolve(__dirname, '../tools/백업.js'), realRequire = createRequire(toolPath);
  const policy = realRequire('./이어하기꾸러미.js');
  const readOnlyFs = { ...fs };
  for (const method of ['mkdirSync', 'writeFileSync', 'copyFileSync', 'renameSync', 'unlinkSync']) {
    readOnlyFs[method] = () => { throw new Error('진단에서 쓰기 시도: ' + method); };
  }
  const fakeExec = (command, args) => {
    assert.equal(command, 'git');
    calls.push(args);
    if (args.includes('rev-parse')) return path.join(repo, '.git');
    if (args.includes('log')) return 'abc123 unpushed synthetic commit';
    if (args.includes('status')) return ' M code.js\n?? picture.png\n';
    throw new Error('진단에서 허용하지 않은 git 호출');
  };
  const context = {
    module: { exports: {} }, Buffer, __dirname: path.dirname(toolPath), __filename: toolPath,
    process: { env: { OneDrive: cloud } }, console: { log: value => output.push(value) },
    require(name) {
      if (name === 'fs') return readOnlyFs;
      if (name === 'child_process') return { execFileSync: fakeExec };
      if (name === './이어하기꾸러미.js') return { ...policy, linkPaths(files, options) {
        linkCalls.push({ files, options });
        return policy.linkPaths(files, options);
      } };
      return realRequire(name);
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(toolPath, 'utf8'), context, { filename: toolPath });
  const report = context.module.exports.실행({ 진단만: true });
  assert.equal(calls.some(args => args.includes('fetch') || args.includes('push')), false);
  assert.equal(calls.filter(args => args.includes('status')).length, 1);
  assert.equal(calls.find(args => args.includes('status')).includes('--no-optional-locks'), true);
  assert.equal(report.저장소[0].담음, 1);
  assert.match(report.저장소[0].건너뜀[0], /picture\.png — non-text-extension/);
  assert.equal(report.낱개.담음, 1);
  assert.match(report.낱개.건너뜀[0], /voice\.mp3 — non-text-extension/);
  assert.match(report.안내, /로컬 origin\/master/);
  assert.equal(linkCalls.length, 4);
  for (const { files, options } of linkCalls) {
    const destination = files[0].startsWith(cloud + path.sep);
    assert.equal(options?.cloudDestinationRoot, destination ? cloud : undefined,
      '클라우드 예외는 확인된 OneDrive 목적지에만 전달한다');
  }
  assert.deepEqual(fs.readdirSync(cloud), []);
  context.fixtureReport = report;
  vm.runInContext('찍기(fixtureReport, true)', context);
  assert.equal(output.some(line => line.includes('너무 커서')), false);
  assert.equal(output.some(line => line.includes('non-text-extension')), true);
});
