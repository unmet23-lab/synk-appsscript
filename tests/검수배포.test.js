'use strict';
// 실제 git·파일·검수 증거·고정 버전 내용 대조를 사용하고 clasp 프로세스만 모의로 막는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const cp = require('node:child_process');
const { 검수증거 } = require('./lib/검수증명.js');
const 실제 = require('../tools/deploy-security-check.js');

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
Object.assign(process.env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'synk-reviewed-deploy-no-global'),
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'test@example.invalid' });

async function 시나리오(t, 옵션 = {}) {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'synk-reviewed-deploy-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 }));
  const root = path.join(temp, 'repo');
  fs.mkdirSync(root);
  const 파일 = { 'Code.js': 'function doGet() { return "ok"; }\n', 'appsscript.json': '{"timeZone":"Asia/Seoul"}\n',
    '.clasp.json': '{"scriptId":"fixture-script","rootDir":"","scriptExtensions":[".js"]}\n',
    '.claspignore': '**/*\n!Code.js\n!appsscript.json\n' };
  for (const [p, b] of Object.entries(파일)) fs.writeFileSync(path.join(root, p), b);
  const git = args => cp.execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  git(['init', '-q', '-b', 'master']); git(['add', '-A']); git(['commit', '-q', '-m', 'fixture']);
  git(['update-ref', 'refs/remotes/origin/master', 'HEAD']);
  const 바탕 = git(['rev-parse', 'HEAD']).trim();
  const 후보 = 실제.후보쓰기(path.join(temp, 'candidate'), 실제.배포후보읽기(root));
  const 검수 = await 검수증거({ 저장소: root, 바탕, 배포후보: 후보, 폴더: path.join(temp, 'review') });
  const calls = [], snapshots = new Set(), versions = new Map();
  let remote = null, currentVersion = 7, countLists = 0;
  const run = (bin, args, opts) => {
    if (bin === 'git') {
      if (args[0] === 'fetch') {
        if (옵션.받기실패) throw new Error('fixture fetch failed');
        if (옵션.새원격) {
          const old = fs.readFileSync(path.join(root, 'Code.js'));
          fs.writeFileSync(path.join(root, 'Code.js'), '더 새 원격 코드\n');
          git(['add', 'Code.js']); git(['commit', '-qm', 'remote change']); git(['update-ref', 'refs/remotes/origin/master', 'HEAD']);
          fs.writeFileSync(path.join(root, 'Code.js'), old);
        }
        return Buffer.from('');
      }
      if (opts.cwd !== root && ['log', 'rev-list'].includes(args[0])) return '';
      return cp.execFileSync(bin, args, opts);
    }
    calls.push({ args, cwd: opts.cwd });
    assert.equal(opts.windowsHide, true);
    const cmd = ['deployments', 'push', 'version', 'pull', 'deploy'].find(x => args.includes(x));
    assert.ok(cmd, `모의에 없는 외부 호출 ${args.join(' ')}`);
    if (cmd === 'deployments') {
      countLists++;
      return JSON.stringify([{ deploymentId: 'existing-deployment', versionNumber: 옵션.배포경합 && countLists > 1 ? 8 : currentVersion },
        ...(옵션.임시배포 ? [{ deploymentId: 'leftover', versionNumber: 3, description: 'temp runner' }] : [])]);
    }
    if (cmd === 'push') {
      snapshots.add(opts.cwd);
      assert.notEqual(opts.cwd, root);
      if (옵션.전송중변조) fs.writeFileSync(path.join(opts.cwd, 'Code.js'), '전송 중 바뀐 snapshot\n');
      remote = Object.fromEntries(['Code.js', 'appsscript.json'].map(p => [p, fs.readFileSync(path.join(opts.cwd, p))]));
      if (옵션.작업본변경) fs.writeFileSync(path.join(root, 'Code.js'), '작업본은 push 뒤 바뀜\n');
      return 'pushed';
    }
    if (cmd === 'version') {
      const data = { ...remote };
      if (옵션.버전경합) data['Code.js'] = Buffer.from('다른 작업의 HEAD\n');
      if (옵션.매니페스트경합) data['appsscript.json'] = Buffer.from('{}\n');
      if (옵션.남은파일) data['removed.js'] = Buffer.from('원격 잔존\n');
      versions.set('11', data);
      return JSON.stringify({ versionNumber: 11 });
    }
    if (cmd === 'pull') {
      const n = args[args.indexOf('--versionNumber') + 1];
      assert.equal(n, '11', '현재 HEAD가 아니라 만들어 둔 불변 버전을 읽는다');
      for (const [p, b] of Object.entries(versions.get(n))) fs.writeFileSync(path.join(opts.cwd, p), b);
      return 'pulled';
    }
    assert.equal(args[args.indexOf('-i') + 1], 'existing-deployment');
    assert.equal(args[args.indexOf('--versionNumber') + 1], '11');
    currentVersion = 옵션.사후불일치 ? 8 : 11;
    return JSON.stringify({ deploymentId: 'existing-deployment', versionNumber: 11 });
  };
  const load = (rel, fsImpl = fs) => {
    const entry = path.resolve(__dirname, '..', rel), req = createRequire(entry), module = { exports: {} };
    new Function('require', 'module', '__dirname', fs.readFileSync(entry, 'utf8').replace(/^#![^\r\n]*/, ''))(
      id => id === 'child_process' ? { execFileSync: run } : id === 'fs' ? fsImpl : id === './배포판점검.js' ? load('tools/배포판점검.js') : req(id), module, path.dirname(entry));
    return module.exports;
  };
  const fakeFs = 옵션.복사변조 ? { ...fs, writeFileSync(p, b, ...args) {
    return fs.writeFileSync(p, String(p).includes('synk-reviewed-deploy-') && !String(p).startsWith(temp) && path.basename(p) === 'Code.js' ? '복사 중 변조\n' : b, ...args);
  } } : fs;
  const 도구 = load('tools/deploy-security-check.js', fakeFs);
  t.after(() => { for (const p of snapshots) assert.equal(fs.existsSync(p), false, '스냅샷이 남지 않는다'); });
  return { root, 검수, 후보, calls, 도구, git, args: { root, 검수, deployment: 'existing-deployment', description: '검수 반영 "설명" & 그대로' } };
}

test('Apps Script: snapshot push → 불변 버전 내용 대조 → 정확한 버전으로 기존 ID 갱신', async t => {
  const f = await 시나리오(t, { 작업본변경: true });
  const r = await f.도구.검수반영(f.args);
  assert.equal(r.통과, true);
  assert.equal(r.versionNumber, 11);
  assert.deepEqual(f.calls.map(x => ['deployments', 'push', 'version', 'pull', 'deploy'].find(k => x.args.includes(k))),
    ['deployments', 'push', 'version', 'pull', 'deployments', 'deploy', 'deployments']);
  assert.match(fs.readFileSync(path.join(f.root, 'Code.js'), 'utf8'), /작업본은 push 뒤/);
});

for (const [이름, 옵션, 메시지] of [
  ['snapshot 복사 변조', { 복사변조: true }, /snapshot 작성 뒤/],
  ['snapshot 전송 중 변조', { 전송중변조: true }, /버전 생성 중 검수 snapshot/],
  ['버전 생성 사이 다른 HEAD', { 버전경합: true }, /고정 버전 원문/],
  ['고정 버전 manifest 변경', { 매니페스트경합: true }, /고정 버전 원문/],
  ['삭제한 원격 파일 잔존', { 남은파일: true }, /고정 버전 원문/],
  ['다른 deployment 갱신', { 배포경합: true }, /다른 작업이/],
  ['임시 runner 배포 잔존', { 임시배포: true }, /임시 runner/],
  ['새 origin의 관련 파일 변경', { 새원격: true }, /origin\/master와 다르다/],
  ['origin fetch 실패', { 받기실패: true }, /fetch failed/],
]) test(`Apps Script: ${이름}이면 기존 deployment를 갱신하지 않는다`, async t => {
  const f = await 시나리오(t, 옵션);
  await assert.rejects(f.도구.검수반영(f.args), 메시지);
  assert.equal(f.calls.some(x => x.args.includes('deploy')), false);
  if (옵션.복사변조) assert.equal(f.calls.length, 0, 'snapshot 변조는 clasp 호출 전에 차단한다');
});

test('Apps Script: ID 누락·후보 변경·rootDir 탈출은 원격 호출 전에 차단한다', async t => {
  const f = await 시나리오(t);
  await assert.rejects(f.도구.검수반영({ ...f.args, 검수: null }), /--검수/);
  fs.writeFileSync(path.join(f.root, 'Code.js'), '검수 뒤 바뀜\n');
  await assert.rejects(f.도구.검수반영(f.args), /후보와 현재/);
  fs.writeFileSync(path.join(f.root, '.clasp.json'), '{"scriptId":"fixture-script","rootDir":".."}');
  await assert.rejects(f.도구.검수반영(f.args), /rootDir/);
  assert.equal(f.calls.length, 0);
});

test('Apps Script: 검수한 파일과 origin 내용·모드가 다르면 원격 호출 전에 차단한다', async t => {
  const f = await 시나리오(t);
  const old = fs.readFileSync(path.join(f.root, 'Code.js'));
  fs.writeFileSync(path.join(f.root, 'Code.js'), 'origin의 다른 내용\n');
  f.git(['add', 'Code.js']); f.git(['commit', '-qm', 'origin change']); f.git(['update-ref', 'refs/remotes/origin/master', 'HEAD']);
  fs.writeFileSync(path.join(f.root, 'Code.js'), old);
  await assert.rejects(f.도구.검수반영(f.args), /origin\/master와 다르다/);
  f.git(['add', 'Code.js']); f.git(['commit', '-qm', 'restore']); f.git(['update-ref', 'refs/remotes/origin/master', 'HEAD']);
  f.git(['update-index', '--chmod=+x', 'Code.js']);
  await assert.rejects(f.도구.검수반영(f.args), /파일 모드/);
  assert.equal(f.calls.length, 0);
});

test('Apps Script: 무관한 HEAD 변화는 검수와 후보 일치를 깨지 않는다', async t => {
  const f = await 시나리오(t);
  fs.writeFileSync(path.join(f.root, 'unrelated.txt'), '다른 작업\n');
  f.git(['add', 'unrelated.txt']); f.git(['commit', '-qm', 'unrelated']); f.git(['update-ref', 'refs/remotes/origin/master', 'HEAD']);
  assert.equal((await f.도구.검수반영(f.args)).통과, true);
});

test('Apps Script: allowlist 아래 연결 폴더로 밖의 파일을 읽지 않는다', async t => {
  const f = await 시나리오(t);
  const outside = path.join(path.dirname(f.root), 'outside');
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'hidden.js'), 'outside\n');
  fs.symlinkSync(outside, path.join(f.root, 'nested'), 'junction');
  fs.appendFileSync(path.join(f.root, '.claspignore'), '!nested/hidden.js\n');
  assert.throws(() => f.도구.배포후보읽기(f.root), /연결 폴더/);
  assert.equal(f.calls.length, 0);
});

test('Apps Script: nested .gs도 배포 표면 검사 범위에 포함한다', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-reviewed-surface-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, '.claspignore'), '**/*\n!appsscript.json\n!nested/Code.gs\n');
  fs.writeFileSync(path.join(root, 'appsscript.json'), '{}');
  fs.writeFileSync(path.join(root, 'nested', 'Code.gs'), 'function doGet() { sheet.deleteRow(1); }');
  assert.match(실제.checkCode(root).join('\n'), /nested\/Code\.gs.*파괴적 연산/);
});

test('Apps Script: 사후 ID 버전 불일치는 완료라고 하지 않는다', async t => {
  const f = await 시나리오(t, { 사후불일치: true });
  await assert.rejects(f.도구.검수반영(f.args), /갱신 후.*확인하지 못했다.*deployment 갱신/);
});
