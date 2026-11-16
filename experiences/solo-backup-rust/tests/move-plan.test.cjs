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
  assert.deepEqual(check, ['app:git', 'app:claude-code', 'program:Kakao.KakaoTalk', 'browser', 'google-2sv', 'certificate']);
});

test('move kit: built from a profile, read back as untrusted input, settings put back without replacing (M15)', async t => {
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
  const host = moveHost({ snapshot: snap(oldP) });
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
  raw.apps.find(a => a.app === 'claude-code').files.push({ entry: 'instructions', rel: '..\\..\\evil.ps1', size: 1, sha256: 'x', data: 'eA==' });
  raw.apps.find(a => a.app === 'git').files[0].data = Buffer.from('[user]\n\tname = 남\n').toString('base64');
  raw.apps.push({ app: 'evil', files: [] });
  const checked = kitLib.parseKit(JSON.stringify(raw));
  assert.deepEqual(checked.problems.sort(), ['app', 'file:claude-code', 'file:git']);
  assert.ok(!checked.kit.apps.some(a => a.app === 'git'));
  // Put back on a new PC where VS Code already has its own settings.
  w(path.join(newP, 'AppData', 'Roaming', 'Code', 'User', 'settings.json'), '{"editor.fontSize": 20}');
  fs.mkdirSync(path.join(newP, 'Documents', 'vault'), { recursive: true });
  const now = snap(newP); const host2 = moveHost({ snapshot: now });
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
  const declined = new MoveService({ engine: null, host: async (m, a) => m === 'reinstall.elevate' ? { started: false, reason: 'DECLINED_OR_FAILED' } : host(m, a), stateDir: path.join(root, 's2'), localDir: path.join(root, 'l2') });
  assert.deepEqual((await declined.reinstall({ ids: ['Git.Git'] })).map(r => r.state), ['declined']);
  // 「다시 깔 것」 as the screen gets it: winget's state apart from the outside-the-table list (the two used to share a name).
  const listing = new MoveService({ engine: null, stateDir: path.join(root, 's3'), localDir: path.join(root, 'l3'),
    host: async (m, a) => m === 'reinstall.status' ? { ready: true, version: 'v1.29.380' } : m === 'reinstall.installed' ? ['7zip.7zip'] : m === 'reinstall.show' ? { found: true, title: 'Some Other', publisher: 'Someone', license: 'MIT' } : host(m, a) });
  listing.context = async () => ({ kit: { programs: { winget: [{ id: 'Git.Git' }, { id: '7zip.7zip' }, { id: 'Some.Other' }], installed: [] } } });
  const view = await listing.reinstallList();
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

test('GPT 2차 지적(11-16): two names differing by case, a resumed move keeps the first run\'s results, an unchecked OneDrive file (GB3 · GB4 · GB5)', async t => {
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

test('GPT 2차 지적(11-16): the kit never reads through a junction in the profile (GA4)', async t => {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swb-kitlink-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const oldP = path.join(root, 'old'), outside = path.join(root, 'outside');
  const w = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  w(path.join(outside, 'skills', 'stolen', 'SKILL.md'), 'OUTSIDE_SKILL');
  w(path.join(outside, 'User', 'settings.json'), '{"editor.fontSize": 99, "x": "OUTSIDE_SETTINGS"}');
  w(path.join(oldP, '.claude', 'CLAUDE.md'), '# 지침');
  // .claude\skills itself, and the folder above a file entry (Code\User), point elsewhere.
  fs.symlinkSync(path.join(outside, 'skills'), path.join(oldP, '.claude', 'skills'), 'junction');
  fs.mkdirSync(path.join(oldP, 'AppData', 'Roaming', 'Code'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'User'), path.join(oldP, 'AppData', 'Roaming', 'Code', 'User'), 'junction');
  const { apps: collected } = await kitLib.collectApps(snap(oldP));
  const text = JSON.stringify(collected);
  assert.ok(!text.includes(Buffer.from('OUTSIDE_SKILL').toString('base64')) && !text.includes(Buffer.from('{"editor.fontSize": 99').toString('base64').slice(0, 16)), 'nothing from where a junction points');
  assert.deepEqual(collected.map(a => a.app), ['claude-code']);
  assert.deepEqual(collected[0].files.map(f => f.entry), ['instructions']);
  assert.equal(await kitLib.linkFree(oldP, path.join(oldP, '.claude', 'skills', 'stolen')), false);
  assert.equal(await kitLib.linkFree(oldP, path.join(oldP, '.claude', 'CLAUDE.md')), true);
  // Fable D9: a `never` path with `*` matches any version folder.
  const blender = apps.TABLE.settings.find(s => s.app === 'blender');
  assert.ok(kitLib.never(blender, 'C:\\R', 'C:\\R\\Blender Foundation\\Blender\\4.5\\scripts\\addons\\x.py'));
  assert.ok(kitLib.never(blender, 'C:\\R', 'C:\\R\\Blender Foundation\\Blender\\4.5\\config\\userpref.blend'));
  assert.ok(!kitLib.never(blender, 'C:\\R', 'C:\\R\\Blender Foundation\\Blender\\4.5\\config\\bookmarks.txt'));
});
