'use strict';
// 옮겨 오기의 계획 · 꾸러미 · 거르개 · 설정 되돌리기 (STAGE1_DESIGN.md 4.6 · 4.6b). No restic: pure functions, a temp
// profile and the stand-in host (tests/move-host.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path').win32;
const { Readable } = require('node:stream');
const plan = require('../engine/src/move-plan.cjs');
const apps = require('../engine/src/move-apps.cjs');
const kitLib = require('../engine/src/move-kit.cjs');
const { readMoveList } = require('../engine/src/move-restore.cjs');
const { restoreSettings } = require('../engine/src/move-settings.cjs');
/** Tests that make real files under Windows paths (`path.win32`, junctions): they mean nothing on Linux, so they skip
 *  off Windows. Each is a conditional-QA case on GitHub Windows (tools/conditional-qa/cases.json S146 ~ S152), which runs
 *  it there; a new one needs its own entry, or wide-tests stops on an unregistered skip. The entry goes in three files:
 *  cases.json (and its `expectedCount`), tests/conditional-qa.test.cjs (the counts and `moveFiles`), and the table in
 *  tools/conditional-qa/README.md (현장 노트 시험_화면확인, 11-16). */
const windowsOnly = (name, fn) => test(name, { skip: process.platform !== 'win32' && 'Windows paths and junctions' }, fn);
const { moveHost } = require('./move-host.cjs');

const snap = (profile, extra = {}) => {
  const k = name => ({ path: path.join(profile, name), oneDrive: false, synced: false });
  return { known: { profile: { path: profile }, documents: k('Documents'), desktop: k('Desktop'), pictures: k('Pictures'), music: k('Music'), videos: k('Videos'), downloads: k('Downloads'),
    roaming: k('AppData\\Roaming'), local: k('AppData\\Local'), ...extra.known }, oneDrive: extra.oneDrive || [], syncRoots: extra.syncRoots || [], drives: extra.drives || [{ letter: 'C' }] };
};
const OLD = snap('C:\\Users\\kim'), NOW = snap('C:\\Users\\lee', { drives: [{ letter: 'C' }, { letter: 'D', label: 'DATA' }] });

test('놓는 자리 (M1): only the six known folders and plain profile folders go back in place', () => {
  const r = p => plan.routeOriginal(p, { old: OLD, now: NOW });
  assert.deepEqual(r('C:\\Users\\kim\\Documents\\보고서\\a.hwp'), { path: 'C:\\Users\\lee\\Documents\\보고서\\a.hwp', side: false });
  assert.deepEqual(r('C:\\Users\\kim\\Desktop\\b.txt'), { path: 'C:\\Users\\lee\\Desktop\\b.txt', side: false });
  assert.equal(r('C:\\Users\\kim\\작업\\c.js').path, 'C:\\Users\\lee\\작업\\c.js');
  // Auto-run and app places go to 따로 둔 것.
  for (const [p, rest] of [
    ['C:\\Users\\kim\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1', '문서\\PowerShell\\Microsoft.PowerShell_profile.ps1'],
    ['C:\\Users\\kim\\Documents\\WindowsPowerShell\\Modules\\x\\x.psm1', '문서\\WindowsPowerShell\\Modules\\x\\x.psm1'],
    ['C:\\Users\\kim\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\a.lnk', 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\a.lnk'],
    ['C:\\Users\\kim\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe', 'AppData\\Local\\Microsoft\\WindowsApps\\python.exe'],
    ['C:\\Users\\kim\\.claude\\settings.json', '.claude\\settings.json'],
    ['C:\\Users\\kim\\.ssh\\config', '.ssh\\config'],
    ['C:\\Users\\kim\\.bashrc', '.bashrc'],
    ['C:\\Users\\kim\\notes.txt', 'notes.txt'],
  ]) { assert.deepEqual(r(p), { path: `C:\\Users\\lee\\옮겨 온 자료\\따로 둔 것\\${rest}`, side: true, reason: p.includes('PowerShell') ? 'autorun' : 'profile' }, p); }
  // The system drive's other places go to 옮겨 온 자료\C 드라이브; another drive too unless the person picks it.
  assert.equal(r('C:\\ProgramData\\x\\y.dat').path, 'C:\\Users\\lee\\옮겨 온 자료\\C 드라이브\\ProgramData\\x\\y.dat');
  assert.equal(r('C:\\Users\\Public\\z.txt').path, 'C:\\Users\\lee\\옮겨 온 자료\\C 드라이브\\Users\\Public\\z.txt');
  assert.equal(r('D:\\Projects\\a\\b.js').path, 'C:\\Users\\lee\\옮겨 온 자료\\D 드라이브\\Projects\\a\\b.js');
  assert.equal(plan.routeOriginal('D:\\Projects\\a\\b.js', { old: OLD, now: NOW, sameDrive: true }).path, 'D:\\Projects\\a\\b.js');
  assert.equal(plan.routeOriginal('E:\\x.txt', { old: OLD, now: NOW, sameDrive: true }).path, 'C:\\Users\\lee\\옮겨 온 자료\\E 드라이브\\x.txt', 'no E: here');
  // A known folder OneDrive moved on the new PC.
  const od = snap('C:\\Users\\lee', { known: { documents: { path: 'C:\\Users\\lee\\OneDrive\\문서', oneDrive: true, synced: true } } });
  assert.equal(plan.routeOriginal('C:\\Users\\kim\\Documents\\a.txt', { old: OLD, now: od }).path, 'C:\\Users\\lee\\OneDrive\\문서\\a.txt');
});

test('OneDrive defaults (4.6 table, M4)', () => {
  const sources = ['C:\\Users\\kim\\Documents', 'C:\\Users\\kim\\Desktop', 'D:\\Projects'];
  const local = plan.folderPlans(sources, { old: OLD, now: NOW });
  assert.deepEqual(local.map(f => f.mode), ['original', 'original', 'original']);
  assert.equal(local[2].sameDrive.letter, 'D', 'a same-letter drive is offered, not chosen');
  assert.deepEqual(local.map(f => f.newFolder), ['C:\\Users\\lee\\옮겨 온 자료\\문서', 'C:\\Users\\lee\\옮겨 온 자료\\바탕 화면', 'C:\\Users\\lee\\옮겨 온 자료\\Projects']);
  const newOd = snap('C:\\Users\\lee', { known: { documents: { path: 'C:\\Users\\lee\\OneDrive\\문서', oneDrive: true, synced: true } }, oneDrive: [{ kind: 'Personal', path: 'C:\\Users\\lee\\OneDrive', emailSha256: 'a'.repeat(64) }] });
  assert.equal(plan.folderPlans(sources, { old: OLD, now: newOd })[0].mode, 'newFolder', 'local → OneDrive: outside OneDrive');
  const oldOd = snap('C:\\Users\\kim', { known: { documents: { path: 'C:\\Users\\kim\\OneDrive\\Documents', oneDrive: true, synced: true } }, oneDrive: [{ kind: 'Personal', path: 'C:\\Users\\kim\\OneDrive', emailSha256: 'a'.repeat(64) }] });
  const same = plan.folderPlans(['C:\\Users\\kim\\OneDrive\\Documents'], { old: oldOd, now: newOd })[0];
  assert.equal(same.mode, 'oneDriveGaps'); assert.ok(same.modes.includes('oneDriveGaps'));
  const other = snap('C:\\Users\\lee', { known: { documents: { path: 'C:\\Users\\lee\\OneDrive\\문서', oneDrive: true, synced: true } }, oneDrive: [{ kind: 'Personal', path: 'C:\\Users\\lee\\OneDrive', emailSha256: 'b'.repeat(64) }] });
  assert.equal(plan.folderPlans(['C:\\Users\\kim\\OneDrive\\Documents'], { old: oldOd, now: other })[0].mode, 'newFolder', 'another account: all of the backup outside');
  assert.equal(plan.folderPlans(['C:\\Users\\kim\\OneDrive\\Documents'], { old: oldOd, now: NOW })[0].mode, 'newFolder', 'no OneDrive here');
  // Another sync client (M18): a folder in Dropbox on the new PC is treated like OneDrive.
  const drop = snap('C:\\Users\\lee', { syncRoots: ['C:\\Users\\lee'] });
  assert.equal(plan.folderPlans(['C:\\Users\\kim\\Documents'], { old: OLD, now: drop })[0].mode, 'newFolder');
  // Two folders with one name get distinct new-folder names.
  assert.deepEqual(plan.labels(['D:\\a\\work', 'E:\\b\\work'], OLD), ['work', 'work (2)']);
});

test('names Windows cannot hold, links and case-only twins are set aside in the listing (M19)', async () => {
  const line = (p, type = 'file', size = 1) => JSON.stringify({ message_type: 'node', struct_type: 'node', path: '/' + p, type, size, mtime: '2026-11-16T09:50:05.2710126+09:00' });
  const text = [JSON.stringify({ message_type: 'snapshot' }), line('a', 'dir', 0), line('a/ok.txt'), line('a/odd.'), line('a/nul.txt'), line('a/CON'), line('a/link', 'symlink', 0), line('a/link/in.txt'),
    line('a/Readme.md'), line('a/README.md'), line('b.', 'dir', 0), line('b./x.txt'), line('B', 'dir', 0), line('b', 'dir', 0), line('b/y.txt')].join('\n');
  const list = await readMoveList(Readable.from([Buffer.from(text)]));
  assert.deepEqual([...list.nodes.keys()].sort(), ['a', 'a/ok.txt', 'a/readme.md', 'b', 'b/y.txt']);
  assert.equal(list.aside.get('a/README.md').name, 'a/README.md', 'the second case-only name is kept aside, not dropped');
  const reasons = Object.fromEntries(list.skipped.map(s => [s.name, s.reason]));
  assert.deepEqual(reasons, { 'a/odd.': 'name', 'a/nul.txt': 'name', 'a/CON': 'name', 'a/link': 'link', 'a/link/in.txt': 'link', 'b.': 'name', 'b./x.txt': 'name' });
  assert.ok(list.merged.has('b'), 'a folder differing only by case merges');
  assert.equal(list.nodes.get('a/ok.txt').mtime, Date.parse('2026-11-16T09:50:05.271+09:00'));
  for (const bad of ['a.', 'b ', 'aux', 'LPT1.txt', 'COM¹', 'x:y', 'a|b', 'x'.repeat(256)]) assert.ok(!plan.safeName(bad), bad);
  for (const ok of ['보고서.hwp', '.gitignore', 'COMPUTER', 'con.txt.bak'.replace('con', 'cone')]) assert.ok(plan.safeName(ok), ok);
});

test('filters let only plain settings back (M7 · M13 · M14) and the originals lose their secrets (M16)', () => {
  const git = apps.gitconfig('[user]\n\tname = 김\n\temail = a@b.c\n[core]\n\tfsmonitor = evil.exe\n\thooksPath = C:/x\n\tautocrlf = true\n[alias]\n\tx = !rm -rf\n[credential]\n\thelper = manager\n[credential "https://x"]\n\thelper = store\n[include]\n\tpath = other\n[url "https://t@github.com/"]\n\tinsteadOf = https://github.com/\n');
  assert.equal(git.bytes.toString(), '[user]\n\tname = 김\n\temail = a@b.c\n[core]\n\tautocrlf = true\n[credential]\n\thelper = manager\n');
  assert.ok(git.dropped >= 6);
  const vs = apps.vscodeSettings('{\n // comment\n "editor.fontSize": 14, "workbench.colorTheme": "Dark", "terminal.integrated.profiles.windows": {"x": {"path": "evil"}}, "git.path": "x", "python.defaultInterpreterPath": "x",\n "workbench.externalBrowser": "x", "files.exclude": {"**/.git": true}, "editor.codeActionsOnSave": {"x": true}, "http.proxy": "x", "task.allowAutomaticTasks": "on",\n "[python]": {"editor.tabSize": 4, "python.analysis.extraPaths": []}, "chat.tools.autoApprove": true, "mcp": {"servers": {}}, "security.workspace.trust.enabled": false,\n}');
  assert.deepEqual(JSON.parse(vs.bytes), { 'editor.fontSize': 14, 'workbench.colorTheme': 'Dark', 'files.exclude': { '**/.git': true }, '[python]': { 'editor.tabSize': 4 } });
  const keys = apps.vscodeKeys('[{"key":"ctrl+k","command":"editor.action.commentLine"},{"key":"ctrl+t","command":"workbench.action.terminal.sendSequence","args":{"text":"x"}},{"key":"ctrl+r","command":"runCommands","args":{"commands":["workbench.action.terminal.new"]}},{"key":"f5","command":"workbench.action.tasks.runTask"}]');
  assert.deepEqual(JSON.parse(keys.bytes).map(k => k.command), ['editor.action.commentLine']);
  const wt = apps.terminalSettings(JSON.stringify({ theme: 'dark', startOnUserLogin: true, defaultProfile: '{p1}', 'experimental.pixelShaderPath': 'x',
    profiles: { defaults: { fontSize: 12, commandline: 'evil.exe', environment: { A: 'b' } }, list: [{ guid: '{p1}', name: 'PowerShell', source: 'Windows.Terminal.PowershellCore', fontSize: 11, elevate: true }, { guid: '{p2}', name: '내 셸', commandline: 'cmd /c evil' }] },
    actions: [{ command: 'copy', keys: 'ctrl+c' }, { command: { action: 'sendInput', input: 'rm -rf\r' }, keys: 'ctrl+x' }, { command: { action: 'newTab', commandline: 'x' } }, { command: 'paste', id: 'User.paste' }] }));
  const w = JSON.parse(wt.bytes);
  assert.deepEqual(w.profiles, { defaults: { fontSize: 12 }, list: [{ guid: '{p1}', name: 'PowerShell', source: 'Windows.Terminal.PowershellCore', fontSize: 11 }] });
  assert.deepEqual(w.actions.map(a => a.command), ['copy', 'paste']);
  assert.equal(w.defaultProfile, '{p1}'); assert.ok(!('startOnUserLogin' in w) && !('experimental.pixelShaderPath' in w));
  assert.deepEqual(wt.droppedProfiles, ['내 셸']);
  const claude = apps.claudeSettings('{"model":"opus","hooks":{"Stop":[]},"statusLine":{"command":"x"},"apiKeyHelper":"x","env":{"K":"v"},"permissions":{"allow":["Bash(*)"],"deny":["Read(.env)"]},"enabledPlugins":{}}');
  assert.deepEqual(JSON.parse(claude.bytes), { model: 'opus', permissions: { deny: ['Read(.env)'] } });
  const obs = apps.obsidianVaults('{"vaults":{"abc123":{"path":"C:\\\\Users\\\\kim\\\\Documents\\\\v","ts":1,"open":true},"def456":{"path":"C:\\\\gone"}}}', { mapPath: p => p.includes('Documents') ? 'C:\\Users\\lee\\Documents\\v' : null });
  assert.deepEqual(JSON.parse(obs.bytes), { vaults: { abc123: { path: 'C:\\Users\\lee\\Documents\\v', ts: 1 } } });
});

test('Fable 5.2 설계 검토(11-16) D1 · D2 · D5 · D6 · D7: the kit carries filter output, never an original; key-shaped text is left out', () => {
  const entry = (app, id) => apps.TABLE.settings.find(s => s.app === app).entries.find(e => e.id === id);
  const data = (app, id, text) => { const k = apps.keep(entry(app, id), Buffer.from(text)); return k?.data ? k.data.toString('utf8') : k; };
  // D1: VS Code settings — a proxy password, MCP arguments and a terminal profile never reach the kit; only editor look does.
  const vs = data('vscode', 'settings', JSON.stringify({ 'editor.fontSize': 15, 'http.proxy': 'http://u:PW@proxy:8080', mcp: { servers: { x: { args: ['--api-key', 'SKSECRET'], url: 'https://h/sse?api_key=SKSECRET' } } },
    'terminal.integrated.profiles.windows': { a: { args: ['/k', 'set OPENAI_API_KEY=SKSECRET'] } }, 'jira.pat': 'SKSECRET', 'x.connectionString': 'Password=SKSECRET' }));
  assert.deepEqual(JSON.parse(vs), { 'editor.fontSize': 15 });
  // D1: Windows Terminal — a profile's command line and a sendInput action stay out.
  const wt = data('terminal', 'settings', JSON.stringify({ theme: 'dark', profiles: { list: [{ name: 'mine', commandline: 'cmd /k set TOKEN=SKSECRET' }, { name: 'PS', source: 'Windows.Terminal.PowershellCore', fontSize: 11 }] },
    actions: [{ command: { action: 'sendInput', input: 'SKSECRET\r' }, keys: 'ctrl+k' }, { command: 'copy', keys: 'ctrl+c' }] }));
  assert.ok(!wt.includes('SKSECRET') && JSON.parse(wt).actions.length === 1);
  // D1: Claude — allow rules, hooks and the status line stay out; the model and deny rules come back.
  const cl = data('claude-code', 'settings', JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(curl -H "Authorization: Bearer SKSECRET" x)'], deny: ['Read(.env)'] }, hooks: { Stop: [{ command: 'echo SKSECRET' }] }, statusLine: { command: 'x SKSECRET' } }));
  assert.deepEqual(JSON.parse(cl), { model: 'opus', permissions: { deny: ['Read(.env)'] } });
  // D1: keybindings — a sendSequence text stays out, the shortcut `key` stays in.
  const kb = data('vscode', 'keybindings', JSON.stringify([{ key: 'ctrl+s', command: 'workbench.action.files.save' }, { key: 'ctrl+k', command: 'workbench.action.terminal.sendSequence', args: { text: 'SKSECRET' } }]));
  assert.deepEqual(JSON.parse(kb), [{ key: 'ctrl+s', command: 'workbench.action.files.save' }]);
  // D2: Git — only the allowed keys; a mail password, a token, a shell helper and an alias stay out.
  const git = data('git', 'gitconfig', '[user]\n\tname = 김\n[sendemail]\n\tsmtppass = SKSECRET\n[github]\n\ttoken = SKSECRET\n[credential]\n\thelper = "!f() { echo password=SKSECRET; }; f"\n[alias]\n\tx = !curl -H "Authorization: token SKSECRET"\n[http]\n\textraheader = AUTHORIZATION: \\\n\tbasic SKSECRET\n');
  assert.equal(git, '[user]\n\tname = 김\n');
  // Obsidian on the old PC: only each vault's place and time.
  assert.deepEqual(JSON.parse(data('obsidian', 'vaults', JSON.stringify({ vaults: { abc: { path: 'C:\\Users\\김\\v', ts: 1, open: true, extra: 'SKSECRET' } }, other: 'SKSECRET' }))), { vaults: { abc: { path: 'C:\\Users\\김\\v', ts: 1 } } });
  // D5: text carried as it is — left out when something shaped like a key is in it.
  for (const secret of ['sk-ant-api03-' + 'a'.repeat(30), 'ghp_' + 'a'.repeat(36), 'AKIA' + 'A'.repeat(16), '-----BEGIN OPENSSH PRIVATE KEY-----', 'https://me:pa55@github.com/x', 'Authorization: Bearer ' + 'a'.repeat(24)])
    assert.deepEqual(apps.keep(entry('claude-code', 'instructions'), Buffer.from('# 지침\n' + secret)), { left: 'secret-looking' }, secret);
  assert.equal(data('claude-code', 'instructions', '# 지침\nAPI 키는 환경 변수에서 읽는다.'), '# 지침\nAPI 키는 환경 변수에서 읽는다.');
  // D6: snippets are not blanked by name — a snippet called 「Auth header」 comes back whole.
  const snip = JSON.stringify({ 'Auth header': { prefix: 'auth', body: ['Authorization: $1'] } });
  assert.equal(data('vscode', 'snippets', snip), snip);
  // D7: the new PC filters and checks again — a kit with an original (or key-shaped text in an allowed value) is not put back as is.
  assert.deepEqual(JSON.parse(apps.filtered(entry('vscode', 'settings'), Buffer.from(JSON.stringify({ 'editor.fontSize': 15, 'http.proxy': 'x' }))).bytes), { 'editor.fontSize': 15 });
  assert.deepEqual(apps.filtered(entry('vscode', 'settings'), Buffer.from(JSON.stringify({ 'editor.fontFamily': 'ghp_' + 'a'.repeat(36) }))), { left: 'secret-looking' });
  assert.deepEqual(apps.filtered(entry('claude-code', 'instructions'), Buffer.from('sk-' + 'a'.repeat(40))), { left: 'secret-looking' });
  assert.equal(typeof apps.redact, 'undefined', 'no name-based redaction of originals is left to rely on');
});

test('다시 깔 것 and 다시 로그인할 곳 from a kit', () => {
  const kit = { programs: { winget: [{ id: 'Git.Git' }, { id: '7zip.7zip' }, { id: 'Microsoft.VCRedist.2015+.x64' }, { id: 'Some.Other' }, { id: 'bad id;calc' }, { id: 'Kakao.KakaoTalk' }],
    installed: [{ name: 'Hancom Office 2024' }, { name: 'NAVER Whale' }, { name: 'Obsidian 1.7' }, { name: '어떤 사내 도구' }] }, apps: [{ app: 'claude-code', files: [] }] };
  const list = apps.reinstallList(kit, ['7zip.7zip']);
  assert.deepEqual(list.table.map(p => [p.id, p.chosen, p.installed]), [['Git.Git', true, false], ['Kakao.KakaoTalk', true, false], ['7zip.7zip', false, true], ['Obsidian.Obsidian', true, false]]);
  assert.deepEqual(list.machine, ['Git.Git', 'Kakao.KakaoTalk']); assert.deepEqual(list.user, ['Obsidian.Obsidian']);
  assert.deepEqual(list.others.map(p => [p.id, p.chosen]), [['Some.Other', false]], 'runtimes dropped, bad ids dropped, others not chosen');
  assert.deepEqual(list.manual.map(m => [m.name, m.site]), [['네이버 웨일', 'https://whale.naver.com/'], ['한컴오피스', 'https://www.hancom.com/'], ['어떤 사내 도구', null]]);
  const check = apps.checklist(kit).map(c => c.id);
  // Obsidian came in by its installed name, not by winget: it is on the checklist too (카본 끝판 A8).
  assert.deepEqual(check, ['app:git', 'app:obsidian', 'app:claude-code', 'program:Kakao.KakaoTalk', 'browser', 'google-2sv', 'certificate']);
});

windowsOnly('move kit: built from a profile, read back as untrusted input, settings put back without replacing (M15)', async t => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-kit-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldP = path.join(root, 'old'), newP = path.join(root, 'new');
  const w = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  w(path.join(oldP, '.gitconfig'), '[user]\n\tname = 김\n[core]\n\tfsmonitor = evil\n[http]\n\textraHeader = AUTHORIZATION: basic xyz\n');
  w(path.join(oldP, '.git-credentials'), 'https://me:secret@github.com');
  w(path.join(oldP, '.claude', 'CLAUDE.md'), '# 지침');
  w(path.join(oldP, '.claude', 'settings.json'), '{"model":"opus","env":{"KEY":"sk-x"},"hooks":{}}');
  w(path.join(oldP, '.claude', '.credentials.json'), '{"token":"never"}');
  w(path.join(oldP, '.claude', 'skills', 'a', 'SKILL.md'), '---\nhooks: x\n---');
  w(path.join(oldP, 'AppData', 'Roaming', 'Code', 'User', 'settings.json'), '{"editor.fontSize": 15, "terminal.integrated.shell.windows": "evil"}');
  w(path.join(oldP, 'AppData', 'Roaming', 'Code', 'User', 'snippets', 'js.json'), '{}');
  w(path.join(oldP, 'AppData', 'Roaming', 'Blender Foundation', 'Blender', '4.5', 'config', 'bookmarks.txt'), '[Bookmarks]');
  w(path.join(oldP, 'AppData', 'Roaming', 'Blender Foundation', 'Blender', '4.5', 'config', 'userpref.blend'), 'BLENDER');
  w(path.join(oldP, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'), JSON.stringify({ vaults: { abc: { path: path.join(oldP, 'Documents', 'vault'), ts: 1 } } }));
  w(path.join(oldP, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'), '$env:OPENAI_API_KEY = "sk"');
  w(path.join(oldP, 'AppData', 'Local', 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    JSON.stringify({ theme: 'dark', profiles: { list: [{ name: '내 셸', commandline: 'cmd /k set TOKEN=x' }, { name: 'PS', source: 'Windows.Terminal.PowershellCore' }] } }));
  w(path.join(oldP, '.codex', 'AGENTS.md'), '# 지침\nOPENAI_API_KEY=sk-proj-' + 'b'.repeat(40));
  // Closed at the end: the real Rust host (SWB_MOVE_HOST) is a process that would keep the test from ending.
  const host = moveHost({ snapshot: snap(oldP) }); t.after(() => host.close());
  const fakeHost = (m, a) => m === 'reinstall.installed' ? Promise.resolve(['Git.Git', 'Anthropic.ClaudeCode', 'BlenderFoundation.Blender', 'bad;id']) : host(m, a);
  const text = await kitLib.buildKit({ host: fakeHost });
  // What the kit's files hold, decoded: no credential file, no secret value, no key-shaped text.
  const carried = JSON.parse(text).apps.flatMap(a => a.files.map(f => Buffer.from(f.data, 'base64').toString('utf8'))).join('\n');
  for (const s of ['secret', 'never', 'sk-x', 'basic xyz', 'sk-proj', 'fsmonitor', 'hooks']) assert.ok(!carried.includes(s), s);
  assert.ok(!text.includes('sk-x') && !text.includes('basic xyz'), 'nor in the kit around them');
  assert.ok(!text.includes(Buffer.from('---\nhooks').toString('base64').slice(0, 12)) && !text.includes(Buffer.from('BLENDER').toString('base64')), 'no skill folder, no userpref.blend');
  const { kit, problems } = kitLib.parseKit(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(kit.programs.winget.map(p => p.id), ['Git.Git', 'Anthropic.ClaudeCode', 'BlenderFoundation.Blender']);
  assert.deepEqual(kit.apps.map(a => a.app).sort(), ['blender', 'claude-code', 'git', 'obsidian', 'terminal', 'vscode']);
  assert.deepEqual(kit.apps.find(a => a.app === 'claude-code').files.map(f => f.entry).sort(), ['instructions', 'settings']);
  assert.deepEqual(kit.left, [{ app: 'codex', entry: 'instructions', rel: '', why: 'secret-looking' }]);
  // A kit made with the old rules (originals inside) gives no app files at all.
  const oldRules = JSON.parse(text); delete oldRules.rules;
  const fromOld = kitLib.parseKit(JSON.stringify(oldRules)); assert.deepEqual(fromOld.kit.apps, []); assert.ok(fromOld.problems.includes('rules-old'));
  assert.ok(!text.includes(Buffer.from('$env:OPENAI_API_KEY').toString('base64').slice(0, 20)), 'a PowerShell profile is not in the kit (its secrets cannot be told by name)');
  // Tampered parts are left out: a file outside the entry, a changed byte, an unknown app.
  const raw = JSON.parse(text);
  // The way out is in a folder entry, whose files may have a path below it, with its size and hash right (카본 끝판 J1:
  // a wrong hash alone would leave the file out too, so the path check would go untested).
  const x = Buffer.from('x'), xHash = require('node:crypto').createHash('sha256').update(x).digest('hex');
  raw.apps.find(a => a.app === 'vscode').files.push({ entry: 'snippets', rel: '..\\..\\evil.json', size: 1, sha256: xHash, data: x.toString('base64') });
  raw.apps.find(a => a.app === 'git').files[0].data = Buffer.from('[user]\n\tname = 남\n').toString('base64');
  raw.apps.push({ app: 'evil', files: [] });
  const checked = kitLib.parseKit(JSON.stringify(raw));
  assert.deepEqual(checked.problems.sort(), ['app', 'file:git', 'file:vscode']);
  assert.ok(!checked.kit.apps.some(a => a.app === 'git'));
  assert.ok(!checked.kit.apps.find(a => a.app === 'vscode').files.some(f => f.rel.includes('..')), 'the file outside the entry is not kept');
  // Put back on a new PC where VS Code already has its own settings.
  w(path.join(newP, 'AppData', 'Roaming', 'Code', 'User', 'settings.json'), '{"editor.fontSize": 20}');
  fs.mkdirSync(path.join(newP, 'Documents', 'vault'), { recursive: true });
  const now = snap(newP); const host2 = moveHost({ snapshot: now }); t.after(() => host2.close());
  const results = await restoreSettings({ kit, host: host2, now, moveId: 'a1b2c3d4', installed: new Set(['Git.Git', 'Anthropic.ClaudeCode', 'Microsoft.VisualStudioCode', 'Obsidian.Obsidian', 'Microsoft.WindowsTerminal']),
    mapPath: p => p === path.join(oldP, 'Documents', 'vault') ? path.join(newP, 'Documents', 'vault') : null });
  const by = Object.fromEntries(results.map(r => [r.app, r]));
  assert.equal(fs.readFileSync(path.join(newP, '.gitconfig'), 'utf8'), '[user]\n\tname = 김\n');
  assert.equal(fs.readFileSync(path.join(newP, 'AppData', 'Roaming', 'Code', 'User', 'settings.json'), 'utf8'), '{"editor.fontSize": 20}', 'the new PC\'s own settings are not replaced');
  assert.deepEqual(by.vscode.kept, [path.join(newP, 'AppData', 'Roaming', 'Code', 'User', 'settings.json')]);
  assert.ok(fs.existsSync(path.join(newP, 'AppData', 'Roaming', 'Code', 'User', 'snippets', 'js.json')));
  assert.equal(fs.readFileSync(path.join(newP, '.claude', 'CLAUDE.md'), 'utf8'), '# 지침'); assert.ok(by['claude-code'].instructions);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(newP, '.claude', 'settings.json'), 'utf8')), { model: 'opus' });
  assert.ok(!fs.existsSync(path.join(newP, '.claude', 'skills')), 'skills are not in the kit');
  const aside = path.join(newP, '옮겨 온 자료', '따로 둔 것', '앱 설정');
  assert.ok(!fs.existsSync(path.join(aside, 'Claude Code')), 'no original aside: the kit has none');
  // VS Code kept its own settings: the filtered one from the old PC is aside to compare.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(aside, 'Visual Studio Code', 'Code\\User\\settings.json'), 'utf8')), { 'editor.fontSize': 15 });
  assert.ok(by.blender.notInstalled && !fs.existsSync(path.join(newP, 'AppData', 'Roaming', 'Blender Foundation')), 'Blender not installed here: nothing in place');
  assert.ok(fs.existsSync(path.join(aside, 'Blender', 'Blender Foundation\\Blender\\4.5\\config\\bookmarks.txt')));
  assert.ok(!fs.existsSync(path.join(aside, 'Blender', 'Blender Foundation\\Blender\\4.5\\config\\userpref.blend')));
  assert.deepEqual(by.codex.left, [{ entry: 'instructions', rel: '', why: 'secret-looking' }], 'the 결과 says what was kept out and why');
  // GPT -d GA1: the profile the old PC's filter took out is still named in the 결과.
  assert.deepEqual(by.terminal.droppedProfiles, ['내 셸']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(newP, 'AppData', 'Local', 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'), 'utf8')).profiles.list.map(p => p.name), ['PS']);
  assert.ok(!fs.existsSync(path.join(newP, '.codex', 'AGENTS.md')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(newP, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'), 'utf8')).vaults.abc.path, path.join(newP, 'Documents', 'vault'));
  assert.ok(!fs.existsSync(path.join(newP, 'Documents', 'PowerShell')), 'PowerShell profile only aside');
  const temps = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/~synk-/.test(e.name)) temps.push(p); } })(newP);
  assert.deepEqual(temps, []);
});

test('다시 깔기 차례: machine-scope table programs in one elevation, the rest one by one, each checked after (4.6b)', async t => {
  const { MoveService } = require('../engine/src/move-service.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-reinstall-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const host = async (method, args) => {
    calls.push([method, ...args]);
    if (method === 'reinstall.elevate') return { started: true, exitCode: 1, progress: { programs: [{ id: 'Git.Git', state: 'installed' }, { id: '7zip.7zip', state: 'failed' }] } };
    if (method === 'reinstall.user') return { id: args[0], state: 'installed', exitCode: 0 };
    if (method === 'reinstall.listed') return args[0] !== '7zip.7zip';
    throw new Error('HOST_METHOD');
  };
  const service = new MoveService({ engine: null, host, stateDir: path.join(root, 'state'), localDir: path.join(root, 'local') });
  const results = await service.reinstall({ ids: ['Obsidian.Obsidian', 'Git.Git', 'Some.Other', '7zip.7zip', 'bad id', 'Git.Git'] });
  assert.deepEqual(calls.filter(c => c[0] !== 'reinstall.listed'), [['reinstall.elevate', ['Git.Git', '7zip.7zip']], ['reinstall.user', 'Obsidian.Obsidian'], ['reinstall.user', 'Some.Other']]);
  assert.deepEqual(results.map(r => [r.id, r.state, r.scope, r.listed]), [['Git.Git', 'installed', 'machine', true], ['7zip.7zip', 'failed', 'machine', false], ['Obsidian.Obsidian', 'installed', 'user', true], ['Some.Other', 'installed', 'outside', true]]);
  // The person said no to the administrator prompt: nothing ran elevated, the rest still goes.
  const declined = new MoveService({ engine: null, host: async (m, a) => m === 'reinstall.elevate' ? { started: false, reason: 'DECLINED' } : host(m, a), stateDir: path.join(root, 's2'), localDir: path.join(root, 'l2') });
  assert.deepEqual((await declined.reinstall({ ids: ['Git.Git'] })).map(r => r.state), ['declined']);
  // 「다시 깔 것」 as the screen gets it: winget's state apart from the outside-the-table list (the two used to share a name).
  const shows = [];
  const listing = new MoveService({ engine: null, stateDir: path.join(root, 's3'), localDir: path.join(root, 'l3'),
    host: async (m, a) => m === 'reinstall.status' ? { ready: true, version: 'v1.29.380' } : m === 'reinstall.installed' ? ['7zip.7zip'] : m === 'reinstall.show' ? (shows.push(a), { found: true, title: 'Some Other', publisher: 'Someone', license: 'MIT' }) : host(m, a) });
  listing.context = async () => ({ kit: { programs: { winget: [{ id: 'Git.Git' }, { id: '7zip.7zip' }, { id: 'Some.Other' }], installed: [] } } });
  const view = await listing.reinstallList();
  // GPT 2차 -g GB2: each call gets the time left of the 60 seconds as its own limit.
  assert.ok(shows.length === 1 && shows[0][1] > 0 && shows[0][1] <= 60000, JSON.stringify(shows));
  // 마지막 끝판 카본 C2: with a clock where each call takes 25 seconds, the limits shrink (60, 35, 10 seconds) and the
  // fourth is not asked once less than a second is left; it is still listed, without a name.
  let clock = 1_000_000; t.mock.method(Date, 'now', () => clock);
  const timed = [];
  const slow = new MoveService({ engine: null, stateDir: path.join(root, 's5'), localDir: path.join(root, 'l5'),
    host: async (m, a) => m === 'reinstall.status' ? { ready: true } : m === 'reinstall.installed' ? [] : m === 'reinstall.show' ? (timed.push(a[1]), clock += 25000, { found: true, title: a[0] }) : host(m, a) });
  slow.context = async () => ({ kit: { programs: { winget: ['A.One', 'B.Two', 'C.Three', 'D.Four'].map(id => ({ id })), installed: [] } } });
  const slowView = await slow.reinstallList();
  t.mock.restoreAll();
  assert.deepEqual(timed, [60000, 35000, 10000]);
  assert.deepEqual(slowView.others.map(p => [p.id, p.name]), [['A.One', 'A.One'], ['B.Two', 'B.Two'], ['C.Three', 'C.Three'], ['D.Four', null]]);
  assert.deepEqual(view.wingetStatus, { ready: true, version: 'v1.29.380' });
  assert.deepEqual(view.table.map(p => [p.id, p.installed, p.chosen]), [['Git.Git', false, true], ['7zip.7zip', true, false]]);
  assert.deepEqual(view.others.map(p => [p.id, p.name, p.publisher]), [['Some.Other', 'Some Other', 'Someone']]);
  assert.ok(!('winget' in view));
  assert.deepEqual(await service.check({ id: 'browser', done: true }), ['browser']);
  await assert.rejects(service.check({ id: 'x', done: 'yes' }), /MOVE_REQUEST/);
});

test('files.probe goes in parts of 500, so no answer passes the 128 KiB frame the worker takes', async () => {
  const plan = require('../engine/src/move-plan.cjs');
  const sizes = [];
  const host = async (method, [paths]) => { assert.equal(method, 'files.probe'); assert.ok(paths.length <= plan.PROBE_PART); sizes.push(paths.length); return paths.map(p => ({ kind: 'missing', p })); };
  const paths = Array.from({ length: 1201 }, (_, i) => 'C:\\Users\\이\\문서\\' + i + '.txt');
  assert.equal(new Set(paths).size, 1201, 'every path differs, so an order or a repeat would show (GPT GC1)');
  const seen = await plan.probeAll(host, paths);
  assert.deepEqual(sizes, [500, 500, 201]);
  assert.deepEqual(seen.map(s => s.p), paths);
  assert.deepEqual(await plan.probeAll(host, []), []);
  // The longest answer one part can give (an error code per path) stays far below the frame.
  const worst = JSON.stringify({ v: 1, callResult: 1, ok: true, value: Array.from({ length: plan.PROBE_PART }, () => ({ kind: 'error', code: 'MOVE_WRITE_CHANGED' })) });
  assert.ok(Buffer.byteLength(worst) < 131072 / 2, String(Buffer.byteLength(worst)));
});

test('GPT 2차 지적(11-16): settings filters and redaction, folder names, the 다시 깔 것 match, restic list lines', async () => {
  // GA1: comments and trailing commas only outside strings.
  assert.deepEqual(apps.parseJsonc('{"editor.wordSeparators": ",}", "a": [1, 2, ], // x\n "b": "/* not a comment */", }'), { 'editor.wordSeparators': ',}', a: [1, 2], b: '/* not a comment */' });
  assert.deepEqual(apps.parseJsonc('{"q": "a\\",}"}'), { q: 'a",}' });
  // GA2: a secret word anywhere in a name, and a last word 「key」; colours and shortcuts are not secrets.
  for (const name of ['key', 'apiKey', 'tokenValue', 'TOKENValue', 'githubToken', 'passwordValue', 'http.proxyAuthorization', 'X-Api-Key', 'XApiKey', 'bearer_token_env_var', 'licenseKey', 'OPENAI_API_KEY']) assert.ok(apps.secretName(name), name);
  for (const name of ['editor.tokenColorCustomizations', 'editor.semanticTokenColorCustomizations', 'keybindings', 'keys', 'editor.fontSize', 'monkey', 'git.terminalAuthentication']) assert.ok(!apps.secretName(name), name);
  // A blanked name never comes back empty: the filter leaves it out.
  assert.deepEqual(JSON.parse(apps.vscodeSettings('{"editor.fontSize": 14, "editor.fooToken": "x", "editor.tokenColorCustomizations": {}}').bytes), { 'editor.fontSize': 14, 'editor.tokenColorCustomizations': {} });
  // GA3 and the re-reviews (-b GA1 · GA3, -c GA1 · GA2), Fable D3 · D4: the table carries no TOML, no Gemini settings, no
  // PowerShell profile, none of Claude's skill folders, no Blender userpref.blend — files a name or a shape cannot vouch for.
  const paths = apps.TABLE.settings.flatMap(s => s.entries.map(e => e.path.toLowerCase()));
  assert.ok(!paths.some(p => /\.toml$|\.gemini\\settings\.json$|\\skills$|\\agents$|\\commands$|\\output-styles$|userpref\.blend$/.test(p)), paths.join(' '));
  assert.ok(!apps.TABLE.settings.some(s => s.app === 'powershell'));
  // GA5: a folder already called 「foo (2)」 does not share a name with the second 「foo」, and none is 「따로 둔 것」.
  const old = snap('C:\\Users\\김');
  assert.deepEqual(plan.labels(['C:\\a\\foo', 'D:\\foo', 'C:\\b\\foo (2)', 'C:\\c\\따로 둔 것'], old), ['foo', 'foo (2)', 'foo (2) (2)', '따로 둔 것 (2)']);
  // GA6: a table program is found by its own name with at most a version or bitness after it.
  const kit = n => ({ programs: { winget: [], installed: n.map(name => ({ name })) } });
  const found = names => apps.reinstallList(kit(names)).table.map(p => p.id).sort();
  assert.deepEqual(found(['GitHub CLI', 'Claude Code', 'Notion Calendar']), ['Anthropic.ClaudeCode', 'GitHub.cli']);
  assert.deepEqual(found(['Git', 'Python 3.13.1 (64-bit)', '7-Zip 24.08 (x64)', 'PotPlayer-64 bit', 'Zoom Workplace (64-bit)', 'Adobe Acrobat Reader DC', 'Ollama version 0.5.7', '카카오톡']),
    ['7zip.7zip', 'Adobe.Acrobat.Reader.64-bit', 'Daum.PotPlayer', 'Git.Git', 'Kakao.KakaoTalk', 'Ollama.Ollama', 'Python.Python.3.13', 'Zoom.Zoom']);
  // GB1: newer restic marks the lines with struct_type.
  const lines = [{ struct_type: 'snapshot', id: 'x' }, { struct_type: 'node', path: '/a.txt', type: 'file', size: 1, mtime: '2026-11-16T00:00:00Z' }].map(l => JSON.stringify(l)).join('\n');
  assert.equal((await readMoveList(Readable.from([Buffer.from(lines)]))).nodes.size, 1);
});

windowsOnly('GPT 2차 지적(11-16): two names differing by case, a resumed move keeps the first run\'s results, an unchecked OneDrive file (GB3 · GB4 · GB5)', async t => {
  const { Move } = require('../engine/src/move-restore.cjs');
  const { moveHost } = require('./move-host.cjs');
  const tar = require(require.resolve('tar-stream', { paths: [require('node:path').join(__dirname, '..', 'engine')] }));
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-gpt-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldP = path.join(root, 'old', 'Users', '김'), newP = path.join(root, 'new', 'Users', '이');
  fs.mkdirSync(path.join(newP, 'Documents'), { recursive: true }); fs.mkdirSync(path.join(newP, 'Desktop'), { recursive: true });
  // On the new PC 「x」 is a file where the backup has a folder: the file under it is 「skip」 (MOVE_SKIP_FILE).
  fs.writeFileSync(path.join(newP, 'Documents', 'x'), 'a file');
  const folders = {
    [path.join(oldP, 'Documents')]: [['A.txt', 'upper'], ['a.txt', 'lower'], ['x/inner.txt', 'inner']],
    [path.join(oldP, 'Desktop')]: [['d.txt', 'desk']],
  };
  const dirsOf = files => { const dirs = new Set(); for (const [n] of files) { const p = n.split('/'); for (let i = 1; i < p.length; i++) dirs.add(p.slice(0, i).join('/')); } return [...dirs]; };
  const at = '2026-11-16T00:00:00Z';
  const listing = files => readMoveList(Readable.from([Buffer.from([{ message_type: 'snapshot' },
    ...dirsOf(files).map(d => ({ message_type: 'node', path: '/' + d, type: 'dir', size: 0, mtime: at })),
    ...files.map(([n, c]) => ({ message_type: 'node', path: '/' + n, type: 'file', size: Buffer.byteLength(c), mtime: at }))].map(l => JSON.stringify(l)).join('\n'))]));
  const plans = [];
  for (const [original, files] of Object.entries(folders)) plans.push({ original, selector: 'f'.repeat(64) + ':' + original, manifest: await listing(files), backupAt: at, extra: [] });
  const tarOf = files => {
    const pack = tar.pack();
    for (const d of dirsOf(files)) pack.entry({ name: d + '/', type: 'directory' });
    for (const [n, c] of files) pack.entry({ name: n, size: Buffer.byteLength(c) }, c);
    pack.finalize(); return pack;
  };
  let failDesktop = true;
  const engine = { stateDir: path.join(root, 'state'), restorePlans: async () => plans,
    run: async (args, { consumeStdout }) => {
      const original = Object.keys(folders).find(o => args[1] === 'f'.repeat(64) + ':' + o);
      if (args[0] !== 'dump' || !original) throw new Error('unexpected ' + args.join(' '));
      if (original.endsWith('Desktop') && failDesktop) { failDesktop = false; throw new Error('restic killed'); }
      return consumeStdout(tarOf(folders[original]));
    } };
  const host = moveHost({ snapshot: snap(newP) }); t.after(() => host.close());
  const ledgerDir = path.join(root, 'state', 'migration');
  const make = id => new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: id, ledgerDir });
  await assert.rejects(make('5555ffff').run(), /restic killed/);
  const result = await make('5555ffff').run();
  // GB4: the first run's 「skip」 in Documents is still counted after resuming, so the move is not complete.
  assert.equal(result.counts.skip, 1, JSON.stringify(result.counts));
  assert.equal(result.complete, false);
  assert.ok(result.items.some(i => i.result === 'skip' && i.name === 'x/inner.txt'));
  // GB3: 「A.txt」 in place and 「a.txt」 in 따로 둔 것 — both, each with its own content.
  assert.equal(fs.readFileSync(path.join(newP, 'Documents', 'A.txt'), 'utf8'), 'upper');
  assert.equal(fs.readFileSync(path.join(newP, '옮겨 온 자료', '따로 둔 것', '대소문자만 다른 이름', '문서', 'a.txt'), 'utf8'), 'lower');
  assert.equal(fs.readFileSync(path.join(newP, 'Desktop', 'd.txt'), 'utf8'), 'desk');
  // GB5, and a folder the person chose not to take: not complete either.
  const m = make('6666aaaa'); await m.ledger.open();
  await m.record(path.join(oldP, 'Documents'), 'ok.txt', 'placed'); assert.equal(m.summary().complete, true);
  await m.record(path.join(oldP, 'Documents'), 'od.txt', 'onedrive', { u: true }); assert.equal(m.summary().complete, false);
  const n = make('7777bbbb'); await n.ledger.open();
  await n.record(path.join(oldP, 'Documents'), 'ok.txt', 'placed'); n.folderSkips.set('c:\\x', { original: 'C:\\x' });
  assert.equal(n.summary().complete, false);
  await m.ledger.close(); await n.ledger.close();
});

windowsOnly('GPT 2차 지적(11-16): the kit never reads through a junction in the profile (GA4)', async t => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-kitlink-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldP = path.join(root, 'old'), outside = path.join(root, 'outside');
  const w = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  w(path.join(outside, 'prompts', 'stolen.md'), 'OUTSIDE_PROMPT');
  w(path.join(outside, 'snips', 'stolen.json'), '{"OUTSIDE_SNIP":1}');
  w(path.join(outside, 'User', 'settings.json'), '{"editor.fontSize": 99, "x": "OUTSIDE_SETTINGS"}');
  w(path.join(oldP, '.claude', 'CLAUDE.md'), '# 지침');
  // A folder entry itself (.codex\prompts), a folder inside a folder entry (Cursor snippets\linked) and the folder above a
  // file entry (Code\User) point elsewhere — all entries the table collects (카본 끝판 K1: .claude\skills no longer is one).
  fs.mkdirSync(path.join(oldP, '.codex'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'prompts'), path.join(oldP, '.codex', 'prompts'), 'junction');
  w(path.join(oldP, 'AppData', 'Roaming', 'Cursor', 'User', 'snippets', 'own.json'), '{}');
  fs.symlinkSync(path.join(outside, 'snips'), path.join(oldP, 'AppData', 'Roaming', 'Cursor', 'User', 'snippets', 'linked'), 'junction');
  fs.mkdirSync(path.join(oldP, 'AppData', 'Roaming', 'Code'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'User'), path.join(oldP, 'AppData', 'Roaming', 'Code', 'User'), 'junction');
  const { apps: collected } = await kitLib.collectApps(snap(oldP));
  const text = JSON.stringify(collected);
  for (const s of ['OUTSIDE_PROMPT', '{"OUTSIDE_SNIP":1}']) assert.ok(!text.includes(Buffer.from(s).toString('base64')), s);
  assert.ok(!text.includes(Buffer.from('{"editor.fontSize": 99').toString('base64').slice(0, 16)), 'nothing from where a junction points');
  assert.deepEqual(collected.map(a => a.app), ['cursor', 'claude-code']);
  assert.deepEqual(collected[0].files.map(f => [f.entry, f.rel]), [['snippets', 'own.json']]);
  assert.deepEqual(collected[1].files.map(f => f.entry), ['instructions']);
  assert.equal(await kitLib.linkFree(oldP, path.join(oldP, '.codex', 'prompts', 'stolen.md')), false);
  assert.equal(await kitLib.linkFree(oldP, path.join(oldP, '.claude', 'CLAUDE.md')), true);
  // Fable D9: a `never` path with `*` matches any version folder.
  const blender = apps.TABLE.settings.find(s => s.app === 'blender');
  assert.ok(kitLib.never(blender, 'C:\\R', 'C:\\R\\Blender Foundation\\Blender\\4.5\\scripts\\addons\\x.py'));
  assert.ok(kitLib.never(blender, 'C:\\R', 'C:\\R\\Blender Foundation\\Blender\\4.5\\config\\userpref.blend'));
  assert.ok(!kitLib.never(blender, 'C:\\R', 'C:\\R\\Blender Foundation\\Blender\\4.5\\config\\bookmarks.txt'));
});

test('카본 끝판 지적(11-16): key-shaped text, git values, Windows Terminal, the 다시 깔 것 match, places on both PCs, names, the listing, the ledger, the kit', async t => {
  // A1: plain English after 「basic」 or 「bearer」 is not a key; a real credential still is.
  for (const s of ['basic configuration', 'Use basic instructions here.', 'basic error-handling', 'Bearer authentication-scheme']) assert.equal(apps.looksSecret(s), false, s);
  for (const s of ['Authorization: Basic dXNlcjpwYXNz', 'Authorization: Bearer abcdefghijklmnop', 'Bearer eyJhbGciOiJIUzI1NiJ9abc', 'Basic YWxhZGRpbjpvcGVuc2VzYW1l']) assert.equal(apps.looksSecret(s), true, s);
  // 마지막 끝판 카본 A1: a period or an emphasis mark around a credential does not hide it; a word that only ends in
  // 「basic」 is not the scheme.
  for (const s of ['Use Basic dXNlcjpwYXNzMTIz.', '_Basic dXNlcjpwYXNzMTIz_', 'Use Bearer YWRtaW46cGFzc3dvcmQ=.', '*Bearer YWRtaW46cGFzc3dvcmQ*']) assert.equal(apps.looksSecret(s), true, s);
  for (const s of ['basic information.', 'Bearer tokens are issued by the server.', 'mybasic XYZ1234567890123']) assert.equal(apps.looksSecret(s), false, s);
  // A2: 「Notion Calendar」 and 「TortoiseGit」 are not table programs, and stay in the list of what winget does not have.
  const re = apps.reinstallList({ programs: { winget: [], installed: [{ name: 'Notion Calendar' }, { name: 'TortoiseGit 2.15' }, { name: 'Git' }] } }, []);
  assert.deepEqual(re.table.map(p => p.id), ['Git.Git']);
  assert.deepEqual(re.manual.map(m => m.name), ['Notion Calendar', 'TortoiseGit 2.15']);
  // A3: a quoted value keeps its 「#」, a header the filter cannot read ends the section, a line that goes on is not carried.
  // 마지막 끝판 카본 C1: the line a value goes on to (`\` at the end) is that value, dropped with it — 「eol = crlf」 is
  // not a setting of its own, and 「[user]」 is not a header, so the email after it is not user.email. A `\` inside a
  // comment does not go on.
  const git = apps.gitconfig('[user]\n\tname = "Alice #1"\n[sec "a\\"b"]\n\tname = evil\n[user\n\temail = evil@x\n[core]\n\tautocrlf = true \\\n\teol = crlf\n\tlongpaths = true ; not \\\n\tquotepath = false ; comment\n\tpager = x \\\n[user]\n\temail = evil@x\n');
  assert.equal(git.bytes.toString(), '[user]\n\tname = "Alice #1"\n[core]\n\tlongpaths = true\n\tquotepath = false\n');
  // GPT 다시 검수 -j GA1: the line a value goes on to keeps the quote open from the line before — the quote closes on
  // it, the comment after has a `\` that does not go on, and the email after is a setting (`git config` reads it so).
  assert.equal(apps.gitconfig('[user]\n\tname = "Alice\\\n Smith" # comment \\\n\temail = alice@example.test\n').bytes.toString(), '[user]\n\temail = alice@example.test\n');
  // A5 · A6 · A7 · A9: Windows Terminal.
  const PS = '{61c54bbd-c2c6-5271-96e7-009a87ff44bf}';
  const wt = JSON.parse(apps.terminalSettings(JSON.stringify({
    profiles: { defaults: { fontSize: 11, unfocusedAppearance: { backgroundImage: '\\\\host\\share\\x.png', opacity: 50 } },
      list: [{ guid: PS, name: 'Windows PowerShell', commandline: '%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', fontSize: 12 },
        { guid: '{aaaa}', name: 'Ubuntu', source: 'Windows.Terminal.Wsl', unfocusedAppearance: { pixelShaderPath: 'C:\\s.hlsl', colorScheme: 'One' } }] },
    actions: [{ command: { action: 'newTab', commandline: 'calc' }, id: 'User.newTab.1' }, { command: 'copy', id: 'User.copy.1' }],
    keybindings: [{ id: 'User.newTab.1', keys: 'ctrl+t' }, { id: 'User.copy.1', keys: 'ctrl+c' }, { id: 'Terminal.PasteFromClipboard', keys: 'ctrl+v' }],
    defaultProfile: PS })).bytes.toString());
  assert.deepEqual(wt.keybindings.map(k => k.id), ['User.copy.1', 'Terminal.PasteFromClipboard'], 'no key left on the dropped newTab');
  assert.deepEqual(wt.profiles.defaults, { fontSize: 11, unfocusedAppearance: { opacity: 50 } });
  assert.deepEqual(wt.profiles.list.map(p => [p.guid, p.fontSize ?? null, p.unfocusedAppearance ?? null, 'commandline' in p]), [[PS, 12, null, false], ['{aaaa}', null, { colorScheme: 'One' }, false]]);
  assert.equal(wt.defaultProfile, PS);
  assert.equal(apps.terminalSettings('{}'), null);
  assert.equal(apps.terminalSettings(JSON.stringify({ $schema: 'x', actions: [{ command: 'wt' }], profiles: { list: [{ name: 'mine', commandline: 'cmd' }] } })), null);
  assert.equal(apps.claudeSettings(JSON.stringify({ permissions: { allow: ['Bash'], deny: [] } })), null);
  // C1: folders right in the profile go back in place, a file there still aside; a sync folder there is not filled.
  const withDropbox = snap('C:\\Users\\lee', { syncRoots: ['C:\\Users\\lee\\Dropbox'] });
  assert.deepEqual(plan.folderPlans(['C:\\Users\\kim\\Projects', 'C:\\Users\\kim\\Dropbox'], { old: OLD, now: withDropbox }).map(f => [f.destination, f.side, f.mode]),
    [['C:\\Users\\lee\\Projects', false, 'original'], ['C:\\Users\\lee\\Dropbox', false, 'newFolder']]);
  assert.equal(plan.routeOriginal('C:\\Users\\kim\\notes.txt', { old: OLD, now: NOW }).side, true);
  // C2: the new PC's own PowerShell folders, whatever the old PC's layout.
  const kfm = snap('C:\\Users\\kim', { known: { documents: { path: 'C:\\Users\\kim\\OneDrive\\문서', oneDrive: true, synced: true } } });
  assert.deepEqual(plan.routeOriginal('C:\\Users\\kim\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1', { old: kfm, now: NOW }),
    { path: 'C:\\Users\\lee\\옮겨 온 자료\\따로 둔 것\\문서\\PowerShell\\Microsoft.PowerShell_profile.ps1', side: true, reason: 'autorun' });
  const dDocs = snap('C:\\Users\\lee', { known: { documents: { path: 'D:\\Documents', oneDrive: false, synced: false } }, drives: [{ letter: 'C' }, { letter: 'D' }] });
  assert.equal(plan.routeOriginal('D:\\Documents\\WindowsPowerShell\\Modules\\m.psm1', { old: OLD, now: dDocs, sameDrive: true }).side, true);
  // C3: 「같은 드라이브에 그대로」 is offered only where it does something.
  const dOld = snap('C:\\Users\\kim', { known: { documents: { path: 'D:\\Documents', oneDrive: false, synced: false } } });
  assert.deepEqual(plan.folderPlans(['D:\\Documents', 'D:\\Projects'], { old: dOld, now: NOW }).map(f => !!f.sameDrive), [false, true]);
  // C4: very long paths go in more parts, each under the byte limit.
  const long = 'C:\\' + Array.from({ length: 60 }, () => '가'.repeat(200)).join('\\');
  const parts = [];
  await plan.probeAll(async (m, [ps]) => { parts.push(Buffer.byteLength(JSON.stringify(ps))); return ps.map(() => ({ kind: 'missing' })); }, Array.from({ length: 100 }, (_, i) => long + i));
  assert.ok(parts.length > 1 && parts.every(n => n <= plan.PROBE_BYTES + 2), JSON.stringify(parts));
  // C5 · C6 · C7 · C8 · C9: device names, paths, network places, long labels, synced known folders.
  for (const bad of ['NUL .txt', 'con  .log', 'COM1 .x']) assert.ok(!plan.safeName(bad), bad);
  assert.ok(!plan.safePath('C:\\a\\\\b') && !plan.safePath('C:\\a\\') && plan.safePath('D:\\') && plan.safePath('C:\\a\\b'));
  assert.equal(plan.routeOriginal('\\\\server\\share\\docs\\a.txt', { old: OLD, now: NOW }).path, 'C:\\Users\\lee\\옮겨 온 자료\\다른 자리\\server\\share\\docs\\a.txt');
  const longName = '가'.repeat(254), named = plan.labels(['C:\\a\\' + longName, 'D:\\' + longName], OLD);
  assert.ok(named[1].endsWith(' (2)') && named[1].length <= 255 && plan.safeName(named[1]), named[1].length);
  assert.ok(plan.inSync('C:\\Users\\lee\\Documents\\a', snap('C:\\Users\\lee', { known: { documents: { path: 'C:\\Users\\lee\\Documents', oneDrive: true, synced: true } } })));
  // D7: a folder whose first name is a file goes aside with what is under it; a skipped link `Docs` is not the folder `docs`.
  const at = '2026-11-16T00:00:00Z';
  const list = await readMoveList(Readable.from([Buffer.from([{ message_type: 'snapshot' },
    { path: '/BUILD', type: 'file', size: 1 }, { path: '/build', type: 'dir', size: 0 }, { path: '/build/app.exe', type: 'file', size: 2 },
    { path: '/Docs', type: 'symlink', size: 0 }, { path: '/docs', type: 'dir', size: 0 }, { path: '/docs/a.txt', type: 'file', size: 3 }]
    .map(n => JSON.stringify(n.message_type ? n : { message_type: 'node', mtime: at, ...n })).join('\n'))]));
  assert.deepEqual([...list.aside.keys()], ['build', 'build/app.exe']);
  assert.ok(list.nodes.has('docs/a.txt'));
  assert.deepEqual(list.skipped.map(s => s.name), ['Docs']);
  // D4: a ledger line cut when the PC stopped is cut off before new lines are added.
  const { Ledger } = require('../engine/src/move-restore.cjs');
  const native = require('node:path');
  const dir = fs.mkdtempSync(native.join(os.tmpdir(), 'swb-ledger-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = native.join(dir, 'm.jsonl');
  fs.writeFileSync(file, '{"t":"head"}\n{"t":"f","o":"C:\\\\x","n":"a","r":"placed"}\n{"t":"f","o":');
  assert.equal((await Ledger.repair(file)).length, 2);
  const ledger = new Ledger(file); await ledger.open(); await ledger.write({ t: 'end' }, true); await ledger.close();
  assert.deepEqual((await Ledger.read(file)).map(r => r.t), ['head', 'f', 'end']);
  // B3 · B4 · B7: the kit as untrusted input.
  const parsed = kitLib.parseKit(JSON.stringify({ schema: 1, kind: 'synk-move-kit', rules: apps.RULES,
    snapshot: { known: { profile: { path: 'C:\\Users\\kim' }, documents: { path: 'C:\\Users/kim/../../Windows' }, desktop: { path: 'C:\\Users\\kim\\Desktop:x' } }, drives: [{ letter: ['C'] }, { letter: 'D' }] },
    programs: { installed: [{ name: '' }, { name: ' ' }, { name: ' '.repeat(256) + 'x' }, { name: 'Git', source: 'registry' }] } }));
  assert.ok(parsed.problems.includes('known:documents') && parsed.problems.includes('known:desktop'), parsed.problems.join());
  assert.deepEqual(parsed.kit.snapshot.drives.map(d => d.letter), ['D']);
  assert.deepEqual(parsed.kit.programs.installed, [{ name: 'Git', version: '', publisher: '', source: 'registry' }]);
  // B6: an empty list from a skipped run is no list to carry on.
  const host = async m => m === 'folders.snapshot' ? { known: { profile: { path: 'C:\\nowhere-swb\\kim' } } } : null;
  assert.equal(JSON.parse(await kitLib.buildKit({ host, metered: true, previous: { programs: { winget: [], wingetStatus: 'skipped' } } })).programs.wingetStatus, 'skipped');
  assert.equal(JSON.parse(await kitLib.buildKit({ host, metered: true, previous: { programs: { winget: [{ id: 'Git.Git' }], wingetStatus: 'ok' } } })).programs.wingetStatus, 'skipped-previous');
});

windowsOnly('카본 끝판 지적(11-16): settings put back twice, a write that fails, many ticks at once, a start that failed (E1 · E2 · E3 · E5)', async t => {
  const { MoveService } = require('../engine/src/move-service.cjs');
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-carbon-e-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const newP = path.join(root, 'new'); fs.mkdirSync(newP, { recursive: true });
  const data = Buffer.from('[user]\n\tname = 김\n');
  const kit = { apps: [{ app: 'git', files: [{ entry: 'gitconfig', version: null, rel: '', data, mtime: 1 }] }], left: [] };
  const host = moveHost({ snapshot: snap(newP) }); t.after(() => host.close());
  // E2: the same step twice — the file put back the first time counts as put back, no copy goes aside.
  const first = await restoreSettings({ kit, host, now: snap(newP), installed: new Set(['Git.Git']), moveId: 'abcd1234' });
  const again = await restoreSettings({ kit, host, now: snap(newP), installed: new Set(['Git.Git']), moveId: 'abcd1234' });
  assert.deepEqual([first[0].restored, again[0].restored, again[0].kept, again[0].side], [[path.join(newP, '.gitconfig')], [path.join(newP, '.gitconfig')], [], []]);
  // 마지막 끝판 카본 B3: a profile the new PC's filter leaves out (the kit came with it) is named on both runs, also
  // when the second finds the same content already there.
  const wt = Buffer.from(JSON.stringify({ profiles: { list: [{ source: 'Windows.Terminal.Wsl', name: 'Ubuntu' }, { name: '내 셸', commandline: 'cmd.exe /k x' }] } }));
  const wtKit = { apps: [{ app: 'terminal', files: [{ entry: 'settings', version: null, rel: '', data: wt, mtime: 1 }] }], left: [] };
  const wtRuns = [];
  for (let i = 0; i < 2; i++) wtRuns.push((await restoreSettings({ kit: wtKit, host, now: snap(newP), installed: new Set(['Microsoft.WindowsTerminal']), moveId: 'abcd1234' }))[0]);
  assert.deepEqual(wtRuns.map(r => [r.restored.length, r.side.length, r.droppedProfiles]), [[1, 0, ['내 셸']], [1, 0, ['내 셸']]]);
  // E1: one file that cannot be written is written down; nothing throws, and no temporary file blocks a later run.
  const noDir = (m, a) => m === 'files.mkdirs' ? Promise.resolve({ ok: true }) : host(m, a);
  const failed = await restoreSettings({ kit, host: noDir, now: snap(path.join(root, 'not-there')), installed: new Set(['Git.Git']), moveId: 'abcd1234' });
  assert.equal(failed[0].failed.length, 1); assert.equal(failed[0].failed[0].code, 'ENOENT');
  // 마지막 끝판 카본 C3: a run whose place fails after its temporary file was written leaves none behind; a temporary file
  // an earlier run left, with the very name the next run draws first, does not block that run and stays as it is.
  fs.rmSync(path.join(newP, '.gitconfig'));
  const breaking = (m, a) => m === 'files.place' ? Promise.reject(new Error('TEST_PLACE')) : host(m, a);
  const broke = await restoreSettings({ kit, host: breaking, now: snap(newP), installed: new Set(['Git.Git']), moveId: 'abcd1234' });
  assert.deepEqual([broke[0].failed.map(f => f.code), fs.readdirSync(newP).filter(n => n.endsWith('.part'))], [['TEST_PLACE'], []]);
  const leftover = path.join(newP, '~synk-abcd1234-900000001.part'); fs.writeFileSync(leftover, 'earlier');
  const draws = [1, 2]; t.mock.method(require('node:crypto'), 'randomInt', () => draws.shift() ?? 3);
  const after = await restoreSettings({ kit, host, now: snap(newP), installed: new Set(['Git.Git']), moveId: 'abcd1234' });
  t.mock.restoreAll();
  assert.deepEqual([after[0].restored, after[0].failed, draws, fs.readFileSync(leftover, 'utf8')], [[path.join(newP, '.gitconfig')], [], [], 'earlier']);
  fs.rmSync(leftover);
  // E3: ticks at once all land.
  const service = new MoveService({ engine: null, host, stateDir: path.join(root, 'state'), localDir: path.join(root, 'local') });
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map(id => service.check({ id, done: true })));
  assert.deepEqual((await service.state()).checked.sort(), ['a', 'b', 'c', 'd', 'e']);
  // E5: an elevated start that failed is 「failed」 with its reason; 「아니요」 in the elevated side's question is declined.
  const failing = new MoveService({ engine: null, host: async m => m === 'reinstall.elevate' ? { started: false, reason: 'START_FAILED' } : null, stateDir: path.join(root, 's2'), localDir: path.join(root, 'l2') });
  assert.deepEqual((await failing.reinstall({ ids: ['Git.Git'] })).map(r => [r.state, r.code]), [['failed', 'START_FAILED']]);
  const no = new MoveService({ engine: null, host: async m => m === 'reinstall.elevate' ? { started: true, exitCode: 3, progress: null } : null, stateDir: path.join(root, 's3'), localDir: path.join(root, 'l3') });
  assert.deepEqual((await no.reinstall({ ids: ['Git.Git'] })).map(r => r.state), ['declined']);
  // H3 · H5: no winget for the approving administrator (exit 4) is a failure with its reason; a wait past the limit leaves
  // what did not end as 「timeout」, what ended as it ended. 화면 세션 E23: a confirmation left open (exit 5) installed
  // nothing, so it is 「approval-timeout」.
  const answer = run => new MoveService({ engine: null, host: async m => m === 'reinstall.elevate' ? run : null, stateDir: path.join(root, 's' + Math.random()), localDir: path.join(root, 'l' + Math.random()) });
  assert.deepEqual((await answer({ started: true, exitCode: 4, progress: null }).reinstall({ ids: ['Git.Git'] })).map(r => [r.state, r.code]), [['failed', 'WINGET_ADMIN_MISSING']]);
  assert.deepEqual((await answer({ started: true, exitCode: null, timedOut: true, progress: { programs: [{ id: 'Git.Git', state: 'installed' }] } }).reinstall({ ids: ['Git.Git', '7zip.7zip'] })).map(r => r.state), ['installed', 'timeout']);
  assert.deepEqual((await answer({ started: true, exitCode: 5, progress: null }).reinstall({ ids: ['Git.Git'] })).map(r => r.state), ['approval-timeout']);
  // 마지막 끝판 카본 B2: a program that failed before the run went past its limit keeps its own exit code; one without any
  // is 「FAILED」, never 「EXIT_null」.
  const late = answer({ started: true, exitCode: null, timedOut: true, progress: { programs: [{ id: 'Git.Git', state: 'failed', exitCode: -1978335212 }, { id: '7zip.7zip', state: 'failed' }] } });
  assert.deepEqual((await late.reinstall({ ids: ['Git.Git', '7zip.7zip'] })).map(r => [r.state, r.code]), [['failed', 'EXIT_-1978335212'], ['failed', 'FAILED']]);
  // 마지막 끝판 카본 B1: starting again for the same old device holds its backup again, so a release from before is gone
  // (the state changes before the kit is read; the kit read here fails).
  const resumed = new MoveService({ engine: { snapshots: async () => { throw new Error('TEST_OFFLINE'); } }, host, stateDir: path.join(root, 's4'), localDir: path.join(root, 'l4') });
  await resumed.save({ from: 'old', moveId: 'abcd1234', result: { complete: false }, released: '2026-11-16T00:00:00.000Z', checked: ['a'] });
  await assert.rejects(resumed.start({ from: 'old' }), /TEST_OFFLINE/);
  const st = await resumed.state();
  assert.deepEqual([st.released, st.checked, st.from], [null, ['a'], 'old'], 'the same old device keeps what was ticked');
});

windowsOnly('카본 끝판 지적(11-16): the first run takes a folder whole, top folders differing by case on resume, the space for earlier-backup files (D1 · D2 · D3)', async t => {
  const { Move } = require('../engine/src/move-restore.cjs');
  const tar = require(require.resolve('tar-stream', { paths: [require('node:path').join(__dirname, '..', 'engine')] }));
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-carbon-d-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldP = path.join(root, 'old', 'Users', '김'), newP = path.join(root, 'new', 'Users', '이');
  fs.mkdirSync(path.join(newP, 'Documents'), { recursive: true }); fs.mkdirSync(path.join(newP, 'Desktop'), { recursive: true });
  const at = '2026-11-16T00:00:00Z';
  // Documents: an empty folder and a link only. Desktop: `Src/a.txt` and `src/b.txt`.
  const docs = path.join(oldP, 'Documents'), desk = path.join(oldP, 'Desktop');
  const nodes = { [docs]: [['empty', 'dir'], ['link', 'symlink']], [desk]: [['Src', 'dir'], ['Src/a.txt', 'file', 'A'], ['src', 'dir'], ['src/b.txt', 'file', 'B']] };
  const listing = list => readMoveList(Readable.from([Buffer.from([{ message_type: 'snapshot' }, ...list.map(([n, type, c]) => ({ message_type: 'node', path: '/' + n, type, size: c ? Buffer.byteLength(c) : 0, mtime: at }))].map(l => JSON.stringify(l)).join('\n'))]));
  const sel = o => 'f'.repeat(64) + ':' + o;
  const plans = [{ original: docs, selector: sel(docs), manifest: await listing(nodes[docs]), backupAt: at, extra: [] },
    { original: desk, selector: sel(desk), manifest: await listing(nodes[desk]), backupAt: at, extra: [{ name: 'big.pst', size: 5, selector: 'e'.repeat(64) + ':' + desk, backupAt: at }] }];
  const dumps = [];
  const engine = { stateDir: path.join(root, 'state'), restorePlans: async () => plans,
    run: async (args, { consumeStdout }) => {
      dumps.push(args.slice(0, 2).join(' '));
      if (args[1].startsWith('e'.repeat(64))) return consumeStdout(Readable.from([Buffer.from('EXTRA')]));
      const [original, sub] = (() => { for (const o of [docs, desk]) { if (args[1] === sel(o)) return [o, '']; if (args[1].startsWith(sel(o) + '/')) return [o, args[1].slice(sel(o).length + 1)]; } return [null]; })();
      if (!original) throw new Error('unexpected ' + args.join(' '));
      const pack = tar.pack();
      for (const [n, type, c] of nodes[original]) {
        if (sub && !n.startsWith(sub + '/')) continue;
        const name = sub ? n.slice(sub.length + 1) : n;
        if (type === 'dir') pack.entry({ name: name + '/', type: 'directory' });
        else if (type === 'symlink') pack.entry({ name, type: 'symlink', linkname: 'elsewhere' });
        else pack.entry({ name, size: Buffer.byteLength(c) }, c);
      }
      pack.finalize(); return consumeStdout(pack);
    } };
  const host = moveHost({ snapshot: snap(newP) }); t.after(() => host.close());
  const ledgerDir = path.join(root, 'state', 'migration');
  // D2: the 「자리 고르기」 count takes in the file from an earlier backup.
  const view = await new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '1111aaaa', ledgerDir }).preview();
  assert.deepEqual(view.folders.map(f => [f.files, f.bytes]), [[0, 0], [3, 7]]);
  // D1: the first run takes Documents whole (its link's skip line does not make it a resume) and makes the empty folder.
  const first = new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '2222bbbb', ledgerDir });
  await first.run();
  assert.ok(fs.statSync(path.join(newP, 'Documents', 'empty')).isDirectory());
  assert.ok(dumps.includes('dump ' + sel(docs)));
  // D3: a resumed Desktop takes `Src` and `src` each by its own name; every listed file has a result.
  // GPT 2차 -g GC1: the first run's files are taken away, so what is there after the resume is the resume's own work.
  dumps.length = 0;
  fs.rmSync(path.join(newP, 'Desktop', 'Src'), { recursive: true, force: true });
  assert.ok(!fs.existsSync(path.join(newP, 'Desktop', 'src', 'b.txt')));
  const resumed = new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '3333cccc', ledgerDir });
  await resumed.ledger.open(); await resumed.record(desk, 'none.txt', 'fail', { c: 'X' }); await resumed.ledger.close();
  const out = await resumed.run();
  assert.ok(dumps.includes('dump ' + sel(desk) + '/Src') && dumps.includes('dump ' + sel(desk) + '/src'), dumps.join(' | '));
  assert.equal(fs.readFileSync(path.join(newP, 'Desktop', 'Src', 'a.txt'), 'utf8'), 'A');
  assert.equal(fs.readFileSync(path.join(newP, 'Desktop', 'src', 'b.txt'), 'utf8'), 'B');
  assert.ok(!out.items.some(i => i.original === desk && ['fail', 'skip'].includes(i.result) && i.name !== 'none.txt'), JSON.stringify(out.items));
  assert.equal(out.counts.placed, 2, JSON.stringify(out.counts));
});

windowsOnly('카본 끝판 지적(11-16): the kit leaves out only the file that is too big, and counts only the files an entry takes (B2 · B8)', async t => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-carbon-b-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const w = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  const user = path.join(root, 'AppData', 'Roaming', 'Code', 'User');
  w(path.join(user, 'settings.json'), JSON.stringify({ 'editor.fontSize': 14, pad: 'a'.repeat(kitLib.LIMIT.file + 10) }));
  w(path.join(user, 'keybindings.json'), JSON.stringify([{ key: 'ctrl+k', command: 'editor.action.formatDocument' }]));
  for (let i = 0; i < kitLib.LIMIT.dirFiles; i++) w(path.join(user, 'snippets', `s${String(i).padStart(3, '0')}.json`), '{}');
  w(path.join(user, 'snippets', 'zz-notes.txt'), 'not a snippet');
  const { apps: got, left } = await kitLib.collectApps(snap(root));
  const vscode = got.find(a => a.app === 'vscode');
  assert.ok(vscode, 'the app stays');
  assert.deepEqual([...new Set(vscode.files.map(f => f.entry))].sort(), ['keybindings', 'snippets']);
  assert.equal(vscode.files.filter(f => f.entry === 'snippets').length, kitLib.LIMIT.dirFiles);
  assert.deepEqual(left.filter(l => l.app === 'vscode').map(l => [l.entry, l.why]), [['settings', 'too-big']]);
});

test('GPT 2차 -g 지적(11-16): the kit search passes over a snapshot without the kit, never over a repository failure (GA1)', async () => {
  const kit = JSON.stringify({ schema: 1, kind: 'synk-move-kit', rules: apps.RULES, createdAt: '2026-11-16T00:00:00Z', snapshot: { known: { profile: { path: 'C:\\Users\\kim' } } } });
  const fail = message => Object.assign(new Error(message), { exitCode: 1 });
  const engine = answers => ({ snapshots: async () => [{ id: 'a'.repeat(64), hostname: 'old', time: '2' }, { id: 'b'.repeat(64), hostname: 'old', time: '1' }],
    run: async (args, { consumeStdout }) => { const a = answers.shift(); if (a instanceof Error) throw a; return consumeStdout(Readable.from([Buffer.from(a)])); } });
  const found = await kitLib.loadKit(engine([fail('Fatal: cannot dump file: path "\\workbackup-move-kit.json" not found in snapshot'), kit]), 'old');
  assert.equal(found.snapshotId, 'b'.repeat(64));
  await assert.rejects(kitLib.loadKit(engine([fail('Fatal: repository does not exist: unable to open config file: no such file or directory'), kit]), 'old'), /unable to open config file/);
  await assert.rejects(kitLib.loadKit(engine([new Error('백업 엔진의 출력이 중단되었습니다.'), kit]), 'old'), /중단/);
});

test('화면 세션 E1 · E2(11-16): the state of a move, and where each folder now lives — the same place on another drive too', async () => {
  const { MoveService, placed } = require('../engine/src/move-service.cjs');
  const sources = ['C:\\Users\\kim\\Documents', 'D:\\Projects', 'C:\\Users\\kim\\Desktop', 'C:\\Users\\kim\\Music'];
  const fps = plan.folderPlans(sources, { old: OLD, now: NOW });
  const folders = sources.map((original, i) => ({ original, fp: fps[i] }));
  const chosen = { 'D:\\Projects': { mode: 'original', sameDrive: true }, 'C:\\Users\\kim\\Desktop': { mode: 'newFolder' }, 'C:\\Users\\kim\\Music': { mode: 'skip' } };
  const out = placed(folders, chosen, { old: OLD, now: NOW });
  assert.deepEqual(out[0], { original: 'C:\\Users\\kim\\Documents', mode: 'original', sameDrive: false, destination: 'C:\\Users\\lee\\Documents',
    newFolder: 'C:\\Users\\lee\\옮겨 온 자료\\문서', label: '문서', roots: [{ path: 'C:\\Users\\lee\\Documents', kind: 'place' }] });
  // The same place on the other drive is where it is, not under 「옮겨 온 자료」 (E2).
  assert.deepEqual([out[1].sameDrive, out[1].destination, out[1].roots], [true, 'D:\\Projects', [{ path: 'D:\\Projects', kind: 'place' }]]);
  assert.deepEqual(placed(folders, {}, { old: OLD, now: NOW })[1].roots, [{ path: 'C:\\Users\\lee\\옮겨 온 자료\\D 드라이브\\Projects', kind: 'moved' }]);
  assert.deepEqual(out[2].roots, [{ path: 'C:\\Users\\lee\\옮겨 온 자료\\바탕 화면', kind: 'newFolder' }]);
  assert.deepEqual([out[3].mode, out[3].roots], ['skip', []]);
  // 'oneDriveGaps': the OneDrive place it was compared with, then the new folder.
  const sha = 'a'.repeat(64);
  const odOld = snap('C:\\Users\\kim', { known: { documents: { path: 'C:\\Users\\kim\\OneDrive\\문서', oneDrive: true, synced: true } }, oneDrive: [{ path: 'C:\\Users\\kim\\OneDrive', emailSha256: sha }] });
  const odNow = snap('C:\\Users\\lee', { known: { documents: { path: 'C:\\Users\\lee\\OneDrive\\문서', oneDrive: true, synced: true } }, oneDrive: [{ path: 'C:\\Users\\lee\\OneDrive', emailSha256: sha }] });
  const od = plan.folderPlans(['C:\\Users\\kim\\OneDrive\\문서'], { old: odOld, now: odNow });
  assert.equal(od[0].mode, 'oneDriveGaps');
  assert.deepEqual(placed([{ original: 'C:\\Users\\kim\\OneDrive\\문서', fp: od[0] }], {}, { old: odOld, now: odNow })[0].roots,
    [{ path: 'C:\\Users\\lee\\OneDrive\\문서', kind: 'oneDrive' }, { path: 'C:\\Users\\lee\\옮겨 온 자료\\문서', kind: 'newFolder' }]);

  // Every place the files went, not only the folder's own (GPT workbackup-movestate GA1): a profile folder puts its
  // documents where this PC keeps them (another drive here), its app places, dot folders and loose files in 「따로 둔 것」,
  // and a second name differing only by case there too.
  const docsElsewhere = snap('C:\\Users\\lee', { known: { documents: { path: 'D:\\Docs', oneDrive: false, synced: false } }, drives: [{ letter: 'C' }, { letter: 'D' }] });
  const [prof] = plan.folderPlans(['C:\\Users\\kim'], { old: OLD, now: docsElsewhere });
  const node = (name, type = 'file') => [name.toLowerCase(), { name, type }];
  const listing = { nodes: new Map([node('Documents', 'dir'), node('Documents/보고서/a.hwp'), node('AppData/Roaming/x.json'), node('.ssh/config'), node('notes.txt'), node('작업/c.js')]), aside: new Map() };
  const side = 'C:\\Users\\lee\\옮겨 온 자료\\따로 둔 것';
  assert.deepEqual(placed([{ original: 'C:\\Users\\kim', fp: prof, listing }], {}, { old: OLD, now: docsElsewhere })[0].roots,
    [{ path: 'C:\\Users\\lee', kind: 'place' }, { path: 'D:\\Docs', kind: 'place' }, { path: side, kind: 'side' }]);
  const onlyWork = { nodes: new Map([node('작업/c.js')]), aside: new Map([node('작업/C.js')]) };
  assert.deepEqual(placed([{ original: 'C:\\Users\\kim', fp: prof, listing: onlyWork }], { 'C:\\Users\\kim': { mode: 'newFolder' } }, { old: OLD, now: docsElsewhere })[0].roots,
    [{ path: prof.newFolder, kind: 'newFolder' }, { path: side, kind: 'side' }], 'a case twin goes apart in any way');
  // What an earlier backup added is placed the same way; a path the rules turn down has no root.
  assert.deepEqual(placed([{ original: 'C:\\Users\\kim', fp: prof, listing: { nodes: new Map([node('bad:name.txt')]), aside: new Map() }, extra: [{ name: 'Documents/b.txt' }] }], {}, { old: OLD, now: docsElsewhere })[0].roots,
    [{ path: 'C:\\Users\\lee', kind: 'place' }, { path: 'D:\\Docs', kind: 'place' }]);

  // E1: a move stopped part-way is told by its state; a finished one by its result's time.
  const service = new MoveService({ engine: null, host: null, stateDir: 'C:\\state', localDir: 'C:\\local' });
  service.state = async () => ({ moveId: 'm1', from: 'dev000000000', choices: chosen, startedAt: '2026-11-16T08:00:00.000Z', result: null, released: null, checked: ['x'] });
  assert.deepEqual(await service.status(), { from: 'dev000000000', choices: chosen, startedAt: '2026-11-16T08:00:00.000Z', unfinished: true, released: null, resultAt: null, complete: null, reinstall: null, settings: null, checklistLeft: null, begun: false });
  service.state = async () => ({ from: 'dev000000000', choices: chosen, startedAt: '2026-11-16T08:00:00.000Z', released: '2026-11-16T09:30:00.000Z', result: { at: '2026-11-16T09:00:00.000Z', complete: false, folders: out } });
  assert.deepEqual(await service.status(), { from: 'dev000000000', choices: chosen, startedAt: '2026-11-16T08:00:00.000Z', unfinished: false, released: '2026-11-16T09:30:00.000Z', resultAt: '2026-11-16T09:00:00.000Z', complete: false, reinstall: null, settings: null, checklistLeft: null, begun: false });
  service.state = async () => ({});
  assert.deepEqual(await service.status(), { from: null, choices: {}, startedAt: null, unfinished: false, released: null, resultAt: null, complete: null, reinstall: null, settings: null, checklistLeft: null, begun: false });
  service.state = async () => ({ from: 7, choices: [1], startedAt: 'yesterday', result: null });
  assert.deepEqual(await service.status(), { from: null, choices: {}, startedAt: null, unfinished: false, released: null, resultAt: null, complete: null, reinstall: null, settings: null, checklistLeft: null, begun: false }, 'a damaged state says nothing');
  // The vault mapping keeps the same-drive choice too (E2 — Obsidian on another drive); a result from before it moved there.
  service.context = async () => ({ old: OLD, now: NOW });
  service.state = async () => ({ from: 'dev000000000', result: { folders: out } });
  assert.equal((await service.mapper())('D:\\Projects\\vault\\a.md'), 'D:\\Projects\\vault\\a.md');
  service.state = async () => ({ from: 'dev000000000', result: { folders: out.map(({ sameDrive, ...rest }) => rest) } });
  assert.equal((await service.mapper())('D:\\Projects\\vault\\a.md'), 'C:\\Users\\lee\\옮겨 온 자료\\D 드라이브\\Projects\\vault\\a.md');
});

test('화면 세션 E3 · E4 · E6 · E9 · E10 · E13 · E15(11-16): starting again, failure codes, the preview kinds, roots on the disk, the places to open and keep', async () => {
  const { MoveService, startState, moveCode, unfinishedOf } = require('../engine/src/move-service.cjs');
  const t0 = new Date('2026-11-16T08:00:00.000Z'), t1 = new Date('2026-11-16T09:00:00.000Z');
  const A = { 'D:\\Projects': { mode: 'original', sameDrive: true } }, Bc = { 'D:\\Projects': { mode: 'newFolder' } };
  const first = startState({}, { from: 'dev1', choices: A, now: t0, id: () => 'm1' });
  assert.deepEqual(first, { moveId: 'm1', from: 'dev1', choices: A, startedAt: t0.toISOString(), released: null, carryFrom: null });
  // E9: an unfinished move goes on with the places it started with, whatever the screen sends (a writer's new folders too).
  assert.deepEqual(startState(first, { from: 'dev1', choices: Bc, now: t1, id: () => 'm2' }), { moveId: 'm1', from: 'dev1', choices: A, startedAt: t1.toISOString(), released: null });
  // E13: a finished one starts again under a new number and its result stays until the new one is written. E11: it takes
  // over what the finished one placed.
  const finished = { ...first, result: { at: '2026-11-16T08:30:00.000Z', complete: true } };
  const again = startState(finished, { from: 'dev1', choices: Bc, now: t1, id: () => 'm2' });
  assert.deepEqual(again, { moveId: 'm2', from: 'dev1', choices: Bc, startedAt: t1.toISOString(), released: null, carryFrom: 'm1' });
  const second = { ...finished, ...again };
  assert.deepEqual([unfinishedOf(second), unfinishedOf(finished), unfinishedOf({}), unfinishedOf(first)], [true, false, false, true]);
  assert.equal(startState(second, { from: 'dev1', choices: A, now: t1, id: () => 'm3' }).moveId, 'm2', 'the second run resumes');
  // One that stopped before placing anything (no space where it was to go) takes the new places (GPT workbackup-move4b GA1).
  assert.deepEqual(startState(first, { from: 'dev1', choices: Bc, now: t1, id: () => 'm2', started: false }), { moveId: 'm1', from: 'dev1', choices: Bc, startedAt: t1.toISOString(), released: null });
  const ledgers = new MoveService({ engine: null, host: null, stateDir: 'C:/state', localDir: 'C:/local' });
  assert.deepEqual([await ledgers.begun(undefined), await ledgers.begun('../x'), await ledgers.begun('0123456789abcdef')], [false, false, false], 'no ledger: nothing placed');
  // Another old device: its result and what was done for it go.
  assert.deepEqual(startState(finished, { from: 'dev2', choices: Bc, now: t1, id: () => 'm4' }),
    { moveId: 'm4', from: 'dev2', choices: Bc, startedAt: t1.toISOString(), released: null, checked: [], reinstall: null, settings: null, result: null, carryFrom: null });
  const service = new MoveService({ engine: null, host: null, stateDir: 'C:\\state', localDir: 'C:\\local' });
  service.state = async () => second;
  assert.deepEqual([(await service.status()).unfinished, (await service.status()).resultAt], [true, '2026-11-16T08:30:00.000Z']);

  // E4: failure codes.
  const codeOf = (message, code) => moveCode(Object.assign(new Error(message), code ? { code } : {})).code;
  assert.equal(codeOf('이 PC의 사용자 폴더를 확인하지 못했습니다.'), 'MOVE_PROFILE');
  assert.equal(codeOf('백업 저장소에 접근하지 못했거나 점검 중 오류가 발생했습니다.\nFatal: no matching ID found for prefix "abcd1234"'), 'MOVE_SNAPSHOT_GONE');
  assert.equal(codeOf('백업 저장소에 접근하지 못했거나 점검 중 오류가 발생했습니다.\nGet "https://s3.example/x": dial tcp: lookup s3.example: no such host'), 'MOVE_NETWORK');
  assert.equal(codeOf('되살릴 파일을 놓을 공간이 부족합니다.', 'MOVE_NO_SPACE'), 'MOVE_NO_SPACE');
  assert.equal(codeOf('복구 데이터의 끝이 잘렸습니다.'), undefined, 'the rest stays MOVE_FAILED in the engine');

  // E15 · E6 · E10: the result's roots say whether they are on the disk; the places to open, and to keep.
  const side = 'C:\\Users\\lee\\옮겨 온 자료\\따로 둔 것';
  const result = { at: '2026-11-16T08:30:00.000Z', side, folders: [{ original: 'C:\\Users\\kim', newFolder: 'C:\\Users\\lee\\옮겨 온 자료\\kim',
    roots: [{ path: 'C:\\Users\\lee', kind: 'place' }, { path: 'D:\\Docs', kind: 'place' }, { path: side, kind: 'side' }, { path: 'relative\\x', kind: 'moved' }] }] };
  const asked = [];
  const disk = new MoveService({ engine: null, stateDir: 'C:\\state', localDir: 'C:\\local',
    host: async (m, a) => { asked.push(m); return a[0].map(x => ({ kind: x === 'D:\\Docs' ? 'missing' : 'dir' })); } });
  disk.state = async () => ({ result });
  assert.deepEqual((await disk.result()).folders[0].roots.map(x => x.exists), [true, false, true, true]);
  assert.deepEqual(asked, ['files.probe']);
  disk.host = async () => { throw new Error('offline'); };
  assert.equal((await disk.result()).folders[0].roots[0].exists, undefined, 'without the host the roots say nothing');
  assert.deepEqual(await disk.places(), [side, 'C:\\Users\\lee\\옮겨 온 자료\\kim', 'C:\\Users\\lee', 'D:\\Docs'], 'only plain local paths, once each');
  assert.deepEqual(await disk.places({ keep: true }), ['C:\\Users\\lee', 'D:\\Docs'], 'never 「따로 둔 것」');
  disk.state = async () => ({});
  assert.deepEqual(await disk.places(), []);

  // E3: the preview says where each folder goes and in which sync, and that a folder OneDrive kept may come partly.
  const sha = 'b'.repeat(64);
  const here = snap('C:\\Users\\lee', { known: { documents: { path: 'C:\\Users\\lee\\OneDrive\\문서', oneDrive: true, synced: true } }, oneDrive: [{ path: 'C:\\Users\\lee\\OneDrive', emailSha256: sha }], drives: [{ letter: 'C' }, { letter: 'D' }] });
  const listing = (...names) => ({ nodes: new Map(names.map(([name, type = 'file']) => [name.toLowerCase(), { name, type, size: type === 'file' ? 5 : 0, mtime: 1 }])), aside: new Map(), skipped: [] });
  const plans = [{ original: 'C:\\Users\\lee\\OneDrive\\문서', selector: 'aaaaaaaa:/a', manifest: listing(['a.txt']), backupAt: '2026-11-15T00:00:00.000Z', extra: [] },
    { original: 'D:\\Projects', selector: 'aaaaaaaa:/b', manifest: listing(['src', 'dir'], ['src/a.js']), backupAt: '2026-11-15T00:00:00.000Z', extra: [] }];
  const preview = new MoveService({ engine: { stateDir: 'C:\\state', snapshots: async () => [], restorePlans: async () => plans }, stateDir: 'C:\\state', localDir: 'C:\\local',
    host: async (m, a) => (m === 'folders.snapshot' ? here : m === 'folders.free' ? a[0].map(() => 1e12) : m === 'files.probe' ? a[0].map(() => ({ kind: 'missing' })) : null) });
  preview.state = async () => ({});
  const view = await preview.preview({ from: 'dev000000000', choices: A });
  const [od, projects] = view.folders;
  assert.deepEqual([od.mode, od.oldSync, od.newSync, od.partial, od.sameAccount, od.side], ['oneDriveGaps', 'oneDrive', 'oneDrive', true, true, false]);
  assert.deepEqual(od.roots, [{ path: 'C:\\Users\\lee\\OneDrive\\문서', kind: 'oneDrive' }, { path: 'C:\\Users\\lee\\옮겨 온 자료\\문서', kind: 'newFolder' }]);
  assert.deepEqual([projects.mode, projects.oldSync, projects.newSync, projects.partial], ['original', null, null, false]);
  assert.deepEqual(projects.roots, [{ path: 'D:\\Projects', kind: 'place' }], 'the same place on the other drive, as chosen');
});

test('화면 세션 E5(11-16): an OneDrive file whose content could not be checked is counted on its own', () => {
  const { Move } = require('../engine/src/move-restore.cjs');
  const move = new Move({ engine: null, host: null, from: 'dev000000000', old: null, now: null, moveId: 'abcdef12', ledgerDir: 'C:\\l' });
  move.final.set('a', { result: 'onedrive', item: { original: 'x', name: 'a', u: true } });
  move.final.set('b', { result: 'onedrive', item: { original: 'x', name: 'b' } });
  move.final.set('c', { result: 'placed', item: { original: 'x', name: 'c' } });
  const sum = move.summary();
  assert.deepEqual(sum.counts, { onedrive: 2, placed: 1, unverified: 1 });
  assert.equal(sum.complete, false);
  move.final.delete('a');
  assert.deepEqual([move.summary().counts.unverified, move.summary().complete], [undefined, true]);
});

test('화면 세션 E11(11-16): what a finished move started again takes over, and what it fetches again', async () => {
  const { Move } = require('../engine/src/move-restore.cjs');
  const docs = 'C:\\Users\\kim\\Documents', T = n => 'C:\\Users\\lee\\Documents\\' + n, backupAt = '2026-11-15T00:00:00.000Z';
  const names = ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt', 'f.txt', 'g.txt', 'h.txt', 'i.txt', 'j.txt', 'k.txt', 'l.txt', 'm.txt', 'n.txt'];
  const size = n => names.indexOf(n) + 1, time = n => size(n) * 1000;
  const listing = { nodes: new Map(names.map(name => [name, { name, type: 'file', size: size(name), mtime: time(name) }])), aside: new Map(), skipped: [] };
  const f = (n, r, extra = {}) => ({ t: 'f', o: docs, n, r, p: T(n), s: size(n), h: 'a'.repeat(64), m: time(n), b: time(n), ...extra });
  const lines = [
    f('a.txt', 'placed', { p: T('A.TXT') }), // taken over (Windows compares the path by case)
    f('b.txt', 'placed'), // touched since: another time on the disk
    f('c.txt', 'same-unverified'), // its content was never checked
    f('d.txt', 'onedrive', { u: true }), // 「내용 확인 못 함」
    f('e.txt', 'placed', { b: 4999 }), // the backup holds another version now
    f('f.txt', 'copy', { p: T('f (복구본).txt') }), // a copy beside is not where this run puts it
    f('g.txt', 'placed', { p: 'C:\\Users\\lee\\옮겨 온 자료\\문서\\g.txt' }), // it went to another place then
    f('h.txt', 'placed'), // gone from the disk
    f('i.txt', 'placed'), // this run has its own result for it already
    f('j.txt', 'same'), // another size on the disk
    f('k.txt', 'same'), // its time on the disk 1.5 seconds off (FAT keeps two): taken over
    f('l.txt', 'placed'), { t: 'f', o: docs, n: 'l.txt', r: 'fail', c: 'MOVE_BUSY' }, // the last line counts
    { t: 'f', o: docs, n: 'm.txt', r: 'fail', c: 'MOVE_BUSY' }, f('m.txt', 'placed'),
    f('n.txt', 'placed', { m: undefined, b: undefined }), // a ledger from before the times were written
    { t: 'f', o: docs, n: 'old.pst', r: 'placed', p: T('old.pst'), s: 20, m: Date.parse(backupAt), b: Date.parse(backupAt) } // from an earlier backup
  ];
  const disk = new Map(names.map(n => [T(n).toLowerCase(), { kind: 'file', size: size(n), mtimeMs: time(n), placeholder: false }]));
  disk.set(T('b.txt').toLowerCase(), { kind: 'file', size: 2, mtimeMs: 99000, placeholder: false });
  disk.delete(T('h.txt').toLowerCase());
  disk.set(T('j.txt').toLowerCase(), { kind: 'file', size: 99, mtimeMs: time('j.txt'), placeholder: false });
  disk.set(T('k.txt').toLowerCase(), { kind: 'file', size: 11, mtimeMs: 12500, placeholder: false });
  disk.set(T('old.pst').toLowerCase(), { kind: 'file', size: 20, mtimeMs: Date.parse(backupAt), placeholder: false });
  const probed = [];
  const host = async (m, a) => { if (m !== 'files.probe') throw new Error(m); probed.push(...a[0]); return a[0].map(p => disk.get(p.toLowerCase()) || { kind: 'missing' }); };
  const make = (opts = {}) => {
    const move = new Move({ engine: null, host, from: 'dev000000000', old: OLD, now: NOW, moveId: '2222bbbb', ledgerDir: 'C:\\l', carryFrom: '1111aaaa', ...opts });
    move.folders = [{ original: docs, selector: 'x:/d', listing, fp: plan.folderPlans([docs], { old: OLD, now: NOW })[0], extra: [{ name: 'old.pst', size: 20, backupAt }] }];
    move.readCarry = async () => lines;
    return move;
  };
  const move = make();
  assert.equal(move.place(move.folders[0], listing.nodes.get('a.txt')).path, T('a.txt'));
  move.done.set(docs.toLowerCase() + '\u0000i.txt', 'fail'); // as a resume of this run reads it from its own ledger
  assert.equal(await move.carryOver(), 4);
  assert.deepEqual(probed, ['A.TXT', 'b.txt', 'h.txt', 'j.txt', 'k.txt', 'm.txt', 'old.pst'].map(T), 'only what can be taken over is looked at');
  assert.deepEqual(move.carried.map(l => [l.n, l.r, l.carried, l.m]), [['a.txt', 'placed', true, 1000], ['k.txt', 'same', true, 12500], ['m.txt', 'placed', true, 13000], ['old.pst', 'placed', true, Date.parse(backupAt)]]);
  assert.deepEqual(move.summary().counts, { placed: 3, same: 1, carried: 4 });
  assert.ok(move.startedFolders.has(docs.toLowerCase()), 'the folder goes by the resume: only what is left is fetched');
  // Nothing to take over from: the same move, a number that is not one, a folder not moved now, another way, no host.
  assert.equal(await make({ carryFrom: '2222bbbb' }).carryOver(), 0);
  assert.equal(await make({ carryFrom: '../x' }).carryOver(), 0);
  assert.equal(await make({ choices: { [docs]: { mode: 'skip' } } }).carryOver(), 0);
  assert.equal(await make({ choices: { [docs]: { mode: 'newFolder' } } }).carryOver(), 0);
  assert.equal(await make({ host: async () => { throw new Error('offline'); } }).carryOver(), 0);
});

test('화면 세션 E8(11-16): the old device\'s lists are kept a few minutes under the numbers of its backups', async () => {
  const { MoveService } = require('../engine/src/move-service.cjs');
  let list = [{ id: 'a'.repeat(64), hostname: 'dev000000000', time: '2026-11-15T00:00:00.000Z', tags: ['complete-structure-checked'] }];
  const asked = { snapshots: 0, kits: 0, plans: 0 };
  const engine = { stateDir: 'C:\\state', snapshots: async (tags = []) => { if (tags.length) { asked.kits++; return []; } asked.snapshots++; return list; }, restorePlans: async () => { asked.plans++; return []; } };
  const service = new MoveService({ engine, stateDir: 'C:\\state', localDir: 'C:\\local',
    host: async (m, a) => (m === 'folders.snapshot' ? NOW : m === 'folders.free' ? a[0].map(() => 1e12) : m === 'files.probe' ? a[0].map(() => ({ kind: 'missing' })) : null) });
  service.state = async () => ({});
  let at = 0; service.clock = () => at;
  const count = () => [asked.snapshots, asked.kits, asked.plans];
  await service.preview({ from: 'dev000000000' });
  await service.preview({ from: 'dev000000000', choices: { 'D:\\Projects': { mode: 'newFolder' } } });
  assert.deepEqual(count(), [1, 1, 1], 'another way a moment later reads nothing again');
  assert.equal((await service.devices()).length, 1);
  assert.deepEqual(count(), [1, 1, 1], 'the request names the device and reads its lists with the one backups list');
  at += 60000; await service.preview({ from: 'dev000000000' });
  assert.deepEqual(count(), [2, 1, 1], 'a minute later only the backups list is read');
  list = [...list, { id: 'c'.repeat(64), hostname: 'other', time: '2026-11-16T00:00:00.000Z', tags: [] }];
  at += 60000; await service.preview({ from: 'dev000000000' });
  assert.deepEqual(count(), [3, 1, 1], "another device's backup changes nothing here");
  list = [...list, { id: 'b'.repeat(64), hostname: 'dev000000000', time: '2026-11-16T01:00:00.000Z', tags: [] }];
  at += 60000; await service.preview({ from: 'dev000000000' });
  assert.deepEqual(count(), [4, 2, 2], 'a new backup of this device reads its lists again');
  at += 10 * 60000; await service.preview({ from: 'dev000000000' });
  assert.deepEqual(count(), [5, 3, 3], 'so does the time passing');
  at += 1000; await service.preview({ from: 'other' }); await service.preview({ from: 'dev000000000' });
  assert.deepEqual(count(), [5, 5, 5], 'one old device is kept at a time');
  // GPT workbackup-move-e8e11 GA1: what is kept goes when its time is up, and its timer with it (a timer that fired still
  // holds its callback, so the callback names nothing kept); a start lets both go too.
  const times = [0, 1e9]; service.clock = () => (times.length ? times.shift() : 1e9);
  service.keep({ from: 'x', ids: '', at: null, loaded: null }, []);
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual([service.kept, service.forget], [null, null]);
  service.clock = () => 0; service.keep({ from: 'x', ids: '', at: null, loaded: null }, []);
  service.drop();
  assert.deepEqual([service.kept, service.forget], [null, null]);
});

windowsOnly('화면 세션 E8 · E11(11-16): a finished move started again fetches only what changed; the preview and the start count and take the same', async t => {
  const { Move, Ledger } = require('../engine/src/move-restore.cjs');
  const { MoveService } = require('../engine/src/move-service.cjs');
  const tar = require(require.resolve('tar-stream', { paths: [require('node:path').join(__dirname, '..', 'engine')] }));
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-e11-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldP = path.join(root, 'old', 'Users', '김'), newP = path.join(root, 'new', 'Users', '이');
  fs.mkdirSync(path.join(newP, 'Desktop'), { recursive: true });
  const at = '2026-11-16T00:00:00Z', desk = path.join(oldP, 'Desktop'), selD = 'f'.repeat(64) + ':' + desk, selE = 'e'.repeat(64) + ':' + desk;
  const files = { 'a.txt': 'A', 'b.txt': 'BB', 'd.txt': 'DDDD', 'proj/x.txt': 'X', 'proj/y.txt': 'YY' };
  const listing = await readMoveList(Readable.from([Buffer.from([{ message_type: 'snapshot' }, { message_type: 'node', path: '/proj', type: 'dir', size: 0, mtime: at },
    ...Object.entries(files).map(([n, c]) => ({ message_type: 'node', path: '/' + n, type: 'file', size: Buffer.byteLength(c), mtime: at }))].map(l => JSON.stringify(l)).join('\n'))]));
  const plans = [{ original: desk, selector: selD, manifest: listing, backupAt: at, extra: [{ name: 'big.pst', size: 5, selector: selE, backupAt: at }] }];
  const dumps = []; let plansRead = 0;
  const engine = { stateDir: path.join(root, 'state'), snapshots: async () => [], restorePlans: async () => { plansRead++; return plans; },
    run: async (args, { consumeStdout }) => {
      dumps.push(args.slice(1, 3).join(' '));
      if (args[1] === selE) return consumeStdout(Readable.from([Buffer.from('EXTRA')]));
      const sub = args[1] === selD ? '' : args[1].startsWith(selD + '/') ? args[1].slice(selD.length + 1) : null;
      if (sub === null) throw new Error('unexpected ' + args.join(' '));
      if (!args.includes('--archive')) return consumeStdout(Readable.from([Buffer.from(files[args[2].slice(1)])]));
      const pack = tar.pack();
      if (!sub) pack.entry({ name: 'proj/', type: 'directory' });
      for (const [n, c] of Object.entries(files)) if (!sub || n.startsWith(sub + '/')) pack.entry({ name: sub ? n.slice(sub.length + 1) : n, size: Buffer.byteLength(c) }, c);
      pack.finalize(); return consumeStdout(pack);
    } };
  const host = moveHost({ snapshot: snap(newP) }); t.after(() => host.close());
  const ledgerDir = path.join(root, 'state', 'migration'), day = Date.parse(at);
  // The first move places everything and writes each file's two times: the disk's and the backup's.
  const first = await new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '1111aaaa', ledgerDir }).run();
  assert.deepEqual(first.counts, { placed: 6 });
  assert.deepEqual(dumps, [selD + ' /', selE + ' /big.pst']);
  assert.ok((await Ledger.read(path.join(ledgerDir, '1111aaaa.jsonl'))).filter(l => l.t === 'f').every(l => l.m === day && l.b === day));
  // Since then one file was touched and one deleted.
  const later = new Date(day + 3600000);
  fs.utimesSync(path.join(newP, 'Desktop', 'b.txt'), later, later);
  fs.rmSync(path.join(newP, 'Desktop', 'd.txt'));
  const service = new MoveService({ engine, host, stateDir: path.join(root, 'svc'), localDir: path.join(root, 'state') });
  service.context = async () => ({ kit: null, problems: ['no-kit'], old: snap(oldP), now: snap(newP) });
  await service.save({ moveId: '1111aaaa', from: 'old', choices: {}, startedAt: '2026-11-16T08:00:00.000Z', result: { moveId: '1111aaaa', at: '2026-11-16T08:30:00.000Z', complete: true } });
  // The preview counts what a start would fetch: the touched and the deleted file, not what is taken over.
  const view = await service.preview({ from: 'old' });
  assert.deepEqual([view.files, view.bytes], [2, 6]);
  assert.equal(plansRead, 2, 'the preview read the lists');
  // The start takes the lists the preview read (E8) and fetches the two files one by one; nothing else is read.
  dumps.length = 0;
  const second = await service.start({ from: 'old' });
  assert.equal(plansRead, 2, 'the start took the lists the preview read');
  assert.equal(service.kept, null, 'and let them go');
  // 화면 세션 E19: the kit the move used is kept on this PC — this old device had none.
  assert.equal(await service.savedKit('old'), null);
  const kitText = JSON.stringify({ schema: 1, kind: 'synk-move-kit', createdAt: '2026-11-16T07:00:00.000Z', snapshot: { known: { profile: { path: oldP } } }, programs: { winget: [{ id: 'Git.Git' }] } });
  await service.saveKit('old', { kit: {}, text: kitText, snapshotId: 'a'.repeat(64), at: '2026-11-16T07:00:00.000Z' });
  const kept = await service.savedKit('old');
  assert.deepEqual([kept.kit.createdAt, kept.kit.programs.winget, kept.snapshotId], ['2026-11-16T07:00:00.000Z', [{ id: 'Git.Git' }], 'a'.repeat(64)]);
  // 화면 세션 E17: the checklist ids beside it, for the state.
  const ids = await service.keptChecklist('old');
  assert.ok(ids.length >= 1 && ids.every(id => typeof id === 'string'), JSON.stringify(ids));
  assert.equal(await service.keptChecklist('another'), null);
  // GPT workbackup-move-e16e24 GA1: the ids are a small file of their own; the state reads them without the kit.
  assert.ok(fs.statSync(service.kitIdsFile).size < 4096 && !fs.readFileSync(service.kitIdsFile, 'utf8').includes('synk-move-kit'));
  const kitBytes = fs.readFileSync(service.kitFile); fs.rmSync(service.kitFile);
  assert.deepEqual(await service.keptChecklist('old'), ids, 'read without the kit');
  fs.writeFileSync(service.kitFile, kitBytes);
  assert.equal(await service.savedKit('another'), undefined, 'another old device has none kept');
  fs.writeFileSync(service.kitFile, JSON.stringify({ from: 'old', text: '{"schema":1,"kind":"synk-move-kit"}' }));
  assert.equal(await service.savedKit('old'), undefined, 'one that does not read as a kit is read from the repository again');
  assert.deepEqual(dumps, [selD + ' /b.txt', selD + ' /d.txt']);
  assert.deepEqual(second.counts, { placed: 5, same: 1, carried: 4 });
  assert.equal(second.complete, true);
  assert.equal(fs.readFileSync(path.join(newP, 'Desktop', 'd.txt'), 'utf8'), 'DDDD');
  const lines = await Ledger.read(path.join(ledgerDir, second.moveId + '.jsonl'));
  assert.equal(lines.find(l => l.t === 'head').carryFrom, '1111aaaa');
  assert.deepEqual(lines.filter(l => l.t === 'f' && l.carried).map(l => l.n).sort(), ['a.txt', 'big.pst', 'proj/x.txt', 'proj/y.txt']);
  // The touched file is 「이미 있음」 with its own time on the disk, so the next run takes it over too.
  assert.ok(Math.abs(lines.find(l => l.t === 'f' && l.n === 'b.txt').m - later.getTime()) < 2000);
  // A resume of the second run reads what it took over from its own ledger.
  const reread = new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: second.moveId, ledgerDir });
  await reread.resume({ tidy: false });
  assert.equal(reread.summary().counts.carried, 4);
  // Started once more: everything is taken over from the second run, nothing is fetched.
  dumps.length = 0;
  const third = await service.start({ from: 'old' });
  assert.deepEqual(dumps, []);
  assert.deepEqual(third.counts, { placed: 5, same: 1, carried: 6 });
  assert.equal(plansRead, 3, 'no preview before it: the start read the lists itself');
  // A top folder with a file left beside more in place: the folder's stream while it is small, the file alone when that
  // costs less than the folder's bytes.
  const touch = (n, ms) => fs.utimesSync(path.join(newP, 'Desktop', ...n.split('/')), new Date(ms), new Date(ms));
  touch('proj/y.txt', day + 7200000); dumps.length = 0;
  await new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '4444dddd', ledgerDir, carryFrom: third.moveId }).run();
  assert.deepEqual(dumps, [selD + '/proj /']);
  touch('proj/y.txt', day + 10800000); dumps.length = 0;
  const alone = new Move({ engine, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '5555eeee', ledgerDir, carryFrom: '4444dddd' });
  alone.singleBytes = 1;
  const last = await alone.run();
  assert.deepEqual(dumps, [selD + ' /proj/y.txt']);
  assert.deepEqual(last.counts, { placed: 4, same: 2, carried: 5 }, 'y.txt came again as 「이미 있음」 in the fourth run');
  // 화면 세션 E25: a folder whose listing is too big is not moved, whatever was chosen, and never read; the others come,
  // and the move is not complete for it (its backup stays the only copy).
  const big = path.join(oldP, 'Big'), bigListing = await readMoveList(Readable.from([Buffer.from([{ message_type: 'snapshot' }, ...['a', 'b', 'c'].map(n => ({ message_type: 'node', path: '/' + n, type: 'file', size: 1, mtime: at }))].map(l => JSON.stringify(l)).join('\n'))]), { max: 2 });
  const withBig = { ...engine, restorePlans: async () => [...plans, { original: big, selector: 'c'.repeat(64) + ':' + big, manifest: bigListing, backupAt: at, extra: [] }] };
  dumps.length = 0;
  const leftOut = await new Move({ engine: withBig, host, from: 'old', old: snap(oldP), now: snap(newP), moveId: '6666ffff', ledgerDir, carryFrom: '5555eeee', choices: { [big]: { mode: 'original' } } }).run();
  assert.deepEqual(dumps, [], 'nothing of it is read');
  assert.deepEqual([leftOut.counts['folder-skip'], leftOut.complete, leftOut.items.find(i => i.result === 'folder-skip')], [1, false, { result: 'folder-skip', original: big, tooBig: true }]);
  const bigDone = (await Ledger.read(path.join(ledgerDir, '6666ffff.jsonl'))).find(l => l.t === 'done' && l.o === big);
  assert.deepEqual([bigDone.skipped, bigDone.tooBig], [true, true]);
});

test('화면 세션 E17 · E18 · E19 · E21 ~ E24(11-16): 「프로그램과 설정」 beside a job, its progress, its results in the state', async () => {
  const { MoveService } = require('../engine/src/move-service.cjs');
  const gates = [];
  // E19: the kit kept on this PC first; the repository only without one, through the window's gate.
  const svc = new MoveService({ engine: null, stateDir: 'C:\\state', localDir: 'C:\\local', host: async m => (m === 'folders.snapshot' ? NOW : null), repo: async fn => { gates.push('repo'); return fn(); } });
  let kept;
  svc.savedKit = async from => (from === 'dev000000000' ? kept : undefined);
  svc.saveKit = async (from, loaded) => { gates.push(['save', from, loaded === null ? null : loaded?.text ?? 'none']); };
  svc.state = async () => ({ from: 'dev000000000' });
  const contextOf = svc.context.bind(svc);
  svc.context = async (from, loaded) => (loaded === undefined ? { kit: { createdAt: 'repo' }, problems: [], old: OLD, now: NOW, loaded: { kit: { createdAt: 'repo' }, problems: [], text: '{"repo":1}' } } : contextOf(from, loaded));
  assert.equal((await svc.kitContext('dev000000000')).kit.createdAt, 'repo');
  assert.deepEqual(gates, ['repo', ['save', 'dev000000000', '{"repo":1}']], 'without a kept kit: read through the gate and kept');
  gates.length = 0; kept = { kit: { createdAt: 'here', programs: { winget: [{ id: 'Git.Git' }] } }, problems: [] };
  assert.equal((await svc.kitContext('dev000000000')).kit.createdAt, 'here');
  kept = null;
  assert.equal((await svc.kitContext('dev000000000')).kit, null);
  assert.deepEqual(gates, [], 'a kept kit, or a kept 「none」, needs no repository');
  const shut = new MoveService({ engine: null, stateDir: 'C:\\state', localDir: 'C:\\local', host: async () => null, repo: async () => { throw Object.assign(new Error('busy'), { code: 'JOB_BUSY' }); } });
  shut.savedKit = async () => undefined;
  await assert.rejects(shut.kitContext('dev000000000'), e => e.code === 'JOB_BUSY', 'no kept kit while a job runs: the window says to wait');

  // E21 · E22: why a list is empty, and whether this PC's list was read.
  kept = { kit: { createdAt: '2026-11-16T07:00:00.000Z', programs: { winget: [{ id: 'Git.Git' }] } }, problems: ['rules-old'] };
  svc.host = async m => (m === 'folders.snapshot' ? NOW : m === 'reinstall.status' ? { ready: true } : m === 'reinstall.installed' ? ['Git.Git'] : null);
  const view = await svc.reinstallList();
  assert.deepEqual([view.from, view.kitAt, view.kitProblems, view.installedKnown, view.table.map(p => [p.id, p.installed])], ['dev000000000', '2026-11-16T07:00:00.000Z', ['rules-old'], true, [['Git.Git', true]]]);
  svc.host = async m => { if (m === 'folders.snapshot') return NOW; if (m === 'reinstall.status') return { ready: true }; if (m === 'reinstall.installed') throw new Error('WINGET_FAILED'); return null; };
  const unread = await svc.reinstallList();
  assert.deepEqual([unread.installedKnown, unread.table.map(p => p.installed)], [false, [false]]);
  await assert.rejects(svc.restoreSettings(), e => e.code === 'REINSTALL_LIST_FAILED', 'settings are not put back as if nothing were installed');
  svc.host = async m => (m === 'folders.snapshot' ? NOW : m === 'reinstall.status' ? { ready: false, reason: 'WINGET_MISSING' } : m === 'reinstall.installed' ? 'not a list' : null);
  assert.equal((await svc.reinstallList()).installedKnown, null, 'without winget nothing was asked');
  await assert.rejects(svc.restoreSettings(), e => e.code === 'REINSTALL_LIST_FAILED');

  // E18 · E23: the elevated side's progress while it runs, then each program at normal privilege.
  const events = [];
  const answers = [null, { schema: 1, programs: [{ id: 'Git.Git', state: 'installing' }, { id: '7zip.7zip', state: 'waiting' }] }];
  const runner = new MoveService({ engine: null, stateDir: 'C:\\state', localDir: 'C:\\local', host: async (m, a) => {
    if (m === 'reinstall.progress') return answers.length > 1 ? answers.shift() : answers[0];
    if (m === 'reinstall.elevate') { await new Promise(r => setTimeout(r, 120)); return { started: true, exitCode: 0, progress: { programs: [{ id: 'Git.Git', state: 'installed' }, { id: '7zip.7zip', state: 'installed' }] } }; }
    if (m === 'reinstall.user') { if (a[0] === 'Some.Other') throw new Error('WINGET_TIMEOUT'); return { id: a[0], state: 'installed', exitCode: 0 }; }
    if (m === 'reinstall.listed') return true;
    return null;
  } });
  runner.pollMs = 10; runner.save = async () => {};
  const results = await runner.reinstall({ ids: ['Git.Git', '7zip.7zip', 'Obsidian.Obsidian', 'Some.Other'], onProgress: p => events.push(p) });
  assert.deepEqual(events[0], { stage: 'elevated', ids: ['Git.Git', '7zip.7zip'], approval: true, current: null, left: 4 }, 'before its first line the person has yet to say yes');
  const installing = events.find(e => e.stage === 'elevated' && !e.approval);
  assert.deepEqual(installing, { stage: 'elevated', ids: ['Git.Git', '7zip.7zip'], approval: false, current: 'Git.Git', left: 4 });
  assert.deepEqual(events.filter(e => e.stage === 'user').map(e => [e.current, e.left, e.approval]), [['Obsidian.Obsidian', 2, false], ['Some.Other', 1, false]]);
  assert.deepEqual(results.map(r => [r.id, r.state]), [['Git.Git', 'installed'], ['7zip.7zip', 'installed'], ['Obsidian.Obsidian', 'installed'], ['Some.Other', 'timeout']], 'one past its 20 minutes is 「timeout」');
  const after = events.length;
  await new Promise(r => setTimeout(r, 50));
  assert.equal(events.length, after, 'the progress is no longer read once the elevated side ended');

  // E17 · E24: the state carries the last installs and settings, what is left to sign in to, and whether it began.
  const st = new MoveService({ engine: null, stateDir: 'C:\\state', localDir: 'C:\\local', host: async () => null });
  const apps = require('../engine/src/move-apps.cjs');
  const kit = { programs: { winget: [{ id: 'Git.Git' }] } };
  const all = apps.checklist(kit).map(i => i.id);
  st.state = async () => ({ from: 'dev000000000', moveId: 'abcd1234', checked: [all[0]], reinstall: { at: '2026-11-16T09:00:00.000Z', results: [{ id: 'Git.Git', state: 'installed' }] }, settings: { at: 'never', results: [] } });
  st.keptChecklist = async from => (from === 'dev000000000' ? all : null);
  st.begun = async id => id === 'abcd1234';
  const now = await st.status();
  assert.deepEqual([now.reinstall, now.settings, now.checklistLeft, now.begun], [{ at: '2026-11-16T09:00:00.000Z', results: [{ id: 'Git.Git', state: 'installed' }] }, null, all.length - 1, true]);
  st.keptChecklist = async () => null;
  assert.equal((await st.status()).checklistLeft, null, 'without a kept kit the state reads no repository and says nothing');
});

test('화면 세션 E25(11-16): a folder past a million names is marked, not refused, and only it is left out', async () => {
  const { Move } = require('../engine/src/move-restore.cjs');
  const { placed } = require('../engine/src/move-service.cjs');
  const lines = n => Readable.from([Buffer.from([{ message_type: 'snapshot' }, ...Array.from({ length: n }, (_, i) => ({ message_type: 'node', path: '/f' + i, type: 'file', size: 3, mtime: '2026-11-16T00:00:00Z' }))].map(l => JSON.stringify(l)).join('\n'))]);
  // The listing is read to its end and says only that it is too big.
  const big = await readMoveList(lines(5), { max: 3 });
  assert.deepEqual([big.tooBig, big.nodes.size, big.aside.size, big.skipped.length, big.bytes], [true, 0, 0, 0, 0]);
  const fits = await readMoveList(lines(3), { max: 3 });
  assert.deepEqual([fits.tooBig, fits.nodes.size, fits.bytes], [undefined, 3, 9]);
  // A broken line after the limit still stops the listing: the limit is not a way past the format check.
  await assert.rejects(readMoveList(Readable.from([Buffer.from([{ message_type: 'snapshot' }, ...Array.from({ length: 4 }, (_, i) => ({ message_type: 'node', path: '/f' + i, type: 'file', size: 1 })), { message_type: 'node', path: 'relative' }].map(l => JSON.stringify(l)).join('\n'))]), { max: 3 }), /형식/);
  // The preview: that folder has 「옮기지 않음」 as its only way and counts nothing; the other is counted as chosen.
  const docs = 'C:\\Users\\kim\\Documents', desk = 'C:\\Users\\kim\\Desktop';
  const [fpDocs, fpDesk] = plan.folderPlans([docs, desk], { old: OLD, now: NOW });
  const move = new Move({ engine: null, host: async (m, a) => (m === 'folders.free' ? a[0].map(() => 1e12) : null), from: 'dev000000000', old: OLD, now: NOW, moveId: '7777aaaa', ledgerDir: 'C:\\l', choices: { [docs]: { mode: 'original' } } });
  move.folders = [{ original: docs, selector: 'x:/d', listing: big, fp: fpDocs, extra: [] }, { original: desk, selector: 'x:/e', listing: fits, fp: fpDesk, extra: [] }];
  const view = await move.preview();
  assert.deepEqual(view.folders.map(f => [f.mode, f.modes, f.files, f.tooBig]), [['skip', ['skip'], 0, true], [fpDesk.mode, fpDesk.modes, 3, undefined]]);
  assert.equal(view.files, 3);
  // Where it lands: nowhere, and the result says why.
  const where = placed(move.folders, { [docs]: { mode: 'original' } }, { old: OLD, now: NOW });
  assert.deepEqual([where[0].mode, where[0].roots, where[0].tooBig, where[1].tooBig], ['skip', [], true, undefined]);
});
