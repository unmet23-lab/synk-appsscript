'use strict';
// PC 앱이 켜질 때의 synk-solio: 주소와 원격 디버깅 거절(src/solio-launch.cjs), main.cjs · package.cjs의 연결(SOLIO_ONE_CLIENT.md 2.3 · 2.5).
// 레지스트리의 실제 synk-solio 키는 건드리지 않는다. 등록은 포장된 판의 main.cjs만 하고, 여기서는 글자로만 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../src/solio-launch.cjs');

const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.cjs'), 'utf8');
const EXE = 'C:\\Users\\x\\AppData\\Local\\Programs\\SYNK Platform Preview\\SYNKPlatformPreview.exe';

test('synk-solio: only the last argument, only backup?topic=<one of the nine words>, letter for letter', () => {
  assert.deepEqual(L.SOLIO_TOPICS, ['status', 'folders', 'changes', 'devices', 'restore', 'space', 'signin', 'update', 'move']);
  for (const topic of L.SOLIO_TOPICS) assert.equal(L.solioTopic([EXE, '--', `synk-solio:backup?topic=${topic}`]), topic);
  for (const bad of [
    'synk-solio:backup?topic=settings', 'synk-solio:backup?topic=start', 'synk-solio:backup?topic=Restore', 'SYNK-SOLIO:backup?topic=restore',
    'synk-solio:backup?topic=restore&x=1', 'synk-solio:backup/?topic=restore', 'synk-solio://backup?topic=restore', 'synk-solio:backup?topic=restore ',
    'synk-solio:backup?topic=', 'synk-solio:backup', 'synk-workbackup:open?topic=restore', 'https://synk.im/?topic=restore', '--office-unhook',
  ]) assert.equal(L.solioTopic([EXE, '--', bad]), null, bad);
  assert.equal(L.solioTopic([EXE, 'synk-solio:backup?topic=restore', '--other']), null, 'not the last argument');
  assert.equal(L.solioTopic([]), null);
  assert.equal(L.solioTopic(null), null);
});

test('debug switches: remote debugging, with -- · - · / heads, before the -- separator; the Node inspector stays for the package QA tools', () => {
  for (const arg of ['--remote-debugging-port=9222', '--remote-debugging-pipe', '-remote-debugging-port=1', '/remote-debugging-port=1', '--REMOTE-DEBUGGING-PORT=1', '--remote-allow-origins=*'])
    assert.equal(L.debugSwitch([EXE, arg]), true, arg);
  for (const arg of ['--inspect', '--inspect-brk=127.0.0.1:0', '--debug=5858'])
    assert.equal(L.debugSwitch([EXE, arg]), false, arg);
  assert.equal(L.debugSwitch([EXE, '--synk-autostart', '--', 'synk-solio:backup?topic=status']), false);
  assert.equal(L.debugSwitch([EXE, '--', '--remote-debugging-port=1']), false, 'after -- it is an argument, not a switch');
  assert.equal(L.debugSwitch([EXE, '--inspector-ui']), false);
  assert.equal(L.debugSwitch([EXE], name => name === 'remote-debugging-port'), true, 'what Chromium itself parsed counts');
  assert.equal(L.debugSwitch([EXE], () => { throw Error('no command line'); }), true, 'a failed check counts as a switch');
});

test('main.cjs: the workbackup-ui scheme before ready, the guard right after the runtime check, synk-solio only in the packaged Windows platform', () => {
  assert.match(MAIN, /protocol\.registerSchemesAsPrivileged\(\[\{scheme:'synk-desktop',privileges:\{standard:true,secure:true,supportFetchAPI:true\}\},\{scheme:'workbackup-ui',privileges:\{standard:true,secure:true\}\}\]\);/);
  assert.equal((MAIN.match(/registerSchemesAsPrivileged\(/g) || []).length, 1, 'registered once');
  const guard = MAIN.indexOf("if(packaged&&runtime.clientId==='platform'&&debugSwitch(process.argv,app.commandLine?name=>app.commandLine.hasSwitch(name):undefined))process.exit(1);");
  assert.ok(guard > 0, 'the guard is there');
  assert.ok(guard < MAIN.indexOf('const smoke='), 'before anything else is made');
  assert.ok(guard > MAIN.indexOf("throw Error('Invalid desktop runtime configuration')"));
  assert.match(MAIN, /if\(packaged&&!smoke&&process\.platform==='win32'\)\{try\{app\.setAsDefaultProtocolClient\(SOLIO_SCHEME,process\.execPath,\['--'\]\);\}catch\{\}\}/);
  assert.match(MAIN, /const firstTopic=smoke\?null:solioTopic\(process\.argv\);/);
  // second-instance: --office-unhook은 그대로 먼저, 그다음 platform은 synk-solio 인자를 읽는다
  const second = MAIN.match(/app\.on\('second-instance',\(_event,argv\)=>\{([^\n]*)\}\);/)?.[1] || '';
  assert.ok(second.indexOf("argv.includes('--office-unhook'))return;") >= 0 && second.indexOf("argv.includes('--office-unhook'))return;") < second.indexOf('receiveSolioTopic(argv)'), second);
  assert.match(second, /if\(runtime\.clientId==='platform'\)\{if\(!receiveSolioTopic\(argv\)\)requestPlatformWindow\(\);return;\}/);
  // 로그인 없이 비상 창을 여는 길은 낱말을 받은 뒤 30분뿐이다
  assert.match(MAIN, /const SOLIO_ASK_FOR=30\*60000;/);
  assert.match(MAIN, /return asked\?solioBackup\(\)\.openWindow\(null,\{anyone:true\}\):\{ok:false,code:'SIGN_IN_REQUIRED'\};/);
  assert.match(MAIN, /app\.on\('before-quit',\(\)=>\{try\{solioDoorService\?\.dispose\(\);\}catch\{\}\}\);/, 'bye on quit, never a kill');
});

test('package.cjs: the platform package turns off RunAsNode and NODE_OPTIONS; other clients keep their builds', () => {
  const { configFor, PLATFORM_FUSES } = require('../tools/package.cjs');
  assert.deepEqual(PLATFORM_FUSES, { runAsNode: false, enableNodeOptionsEnvironmentVariable: false });
  for (const mode of ['development', 'release']) {
    assert.deepEqual(configFor('platform', { mode }).electronFuses, PLATFORM_FUSES, mode);
    assert.equal(configFor('world', { mode }).electronFuses, undefined, 'world keeps its packaged smoke tools');
    assert.equal(configFor('messenger', { mode }).electronFuses, undefined);
  }
});

test('build-platform-release.cjs: the release platform build turns off the same fuses as the preview package', () => {
  const { PLATFORM_FUSES } = require('../tools/package.cjs');
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../tools/build-platform-release.cjs'), 'utf8');
  const match = /electronFuses:(\{[^}]*\})/.exec(source);
  assert.ok(match, 'the release config names electronFuses');
  assert.deepEqual(Function(`return (${match[1]})`)(), PLATFORM_FUSES);
});
