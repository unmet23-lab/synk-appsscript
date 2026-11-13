'use strict';
// The machine-wide installer (STAGE1_DESIGN.md 4.2 「컴퓨터 전체 설치」): Tauri's own NSIS template, pinned by hash,
// with each of our changes applied exactly once; the hooks that run the machine setup; the bundle settings.
// The installer itself is built, installed and removed on a clean runner (workbackup-clean-windows).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { patched, CHANGES, upstream: read } = require('../scripts/nsis-template.cjs');

const upstream = read();
// The end must be there too: a missing one would quietly run the block to the end of the file (카본 끝판 D1).
const block = (text, start, end) => {
  const at = text.indexOf(start); assert.ok(at >= 0, start);
  const stop = text.indexOf(end, at + start.length); assert.ok(stop > at, `${start} … ${end}`);
  return text.slice(at, stop);
};
// The hooks as NSIS reads them: whole-line and block comments out, so a step that is commented out (or only
// named in a comment) never counts (카본 끝판 D2). The hooks keep no comment after a statement on its line.
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((line) => !/^\s*[;#]/.test(line)).join('\n');
const hooksSource = fs.readFileSync(path.join(__dirname, '../src-tauri/nsis/hooks.nsh'), 'utf8').replace(/\r\n/g, '\n');
const hooks = code(hooksSource);
const macro = (name) => block(hooks, `!macro ${name}\n`, '!macroend');

// What each change must leave in the template. Every one fails if its change is taken out (checked below).
function properties(out) {
  const init = block(out, 'Function .onInit', 'FunctionEnd');
  // Our own assignment at function level (upstream only sets it inside the /P check), before the downgrade check (review GA5).
  const passive = init.search(/\$\{EndIf\}\n\n(?: *;[^\n]*\n)* {2}StrCpy \$PassiveMode 1\n/);
  const success = block(out, 'Function .onInstSuccess', 'FunctionEnd');
  return {
    passive: passive > 0 && passive < init.indexOf('!if "${ALLOWDOWNGRADES}" == "false"'),
    programFiles: /\n {2}\$\{EndIf\}\n(?: *;[^\n]*\n)* {2}StrCpy \$INSTDIR "\$PROGRAMFILES64\\\$\{PRODUCTNAME\}"\n/.test(init),
    // Right after the WiX case, unconditionally: the existing version's uninstaller (which removes every user's runs) never runs.
    inPlace: /\$\{If\} \$WixMode = 1\n\s+Goto reinst_uninstall\n\s+\$\{EndIf\}\n(?: *;[^\n]*\n)* {2}Goto reinst_done\n/.test(block(out, 'Function PageLeaveReinstall', 'FunctionEnd')),
    noDesktop: !/CreateOrUpdateDesktopShortcut/.test(block(out, 'Section Install', 'SectionEnd')),
    // The app opens only through WorkBackupRun.exe --open-app (the shell's token, no fallback — review GA4), a silent install only with /R.
    openApp: /ClearErrors\n {2}\$\{GetOptions\} \$CMDLINE "\/R" \$R0\n {2}\$\{IfNot\} \$\{Silent\}\n {2}\$\{OrIfNot\} \$\{Errors\}\n {4}Exec '"\$INSTDIR\\WorkBackupRun\.exe" --open-app'\n {2}\$\{EndIf\}\n/.test(success)
      && !/nsis_tauri_utils::RunAsUser/.test(success),
    finishPage: /Function RunMainBinary\n(?: *;[^\n]*\n)* {2}Exec '"\$INSTDIR\\WorkBackupRun\.exe" --open-app'\nFunctionEnd/.test(out),
  };
}

test('the upstream template is the pinned one and every change applies exactly once', () => {
  const out = patched(upstream);
  assert.equal(out.split('; SYNK:').length - 1, CHANGES.length);
  assert.throws(() => patched(upstream + '\n'), /upstream NSIS template changed/);
  assert.equal(patched(upstream), out, 'the same input gives the same template');
});

test('an install shows only progress, lands in Program Files, updates in place and opens the app only as the person at the desktop', () => {
  const out = patched(upstream);
  assert.deepEqual(properties(out), { passive: true, programFiles: true, inPlace: true, noDesktop: true, openApp: true, finishPage: true });
  assert.doesNotMatch(out, /nsis_tauri_utils::RunAsUser/, 'no start that can fall back to the installer token is left');
  // Upstream has none of them, so each property is the change's own doing.
  assert.deepEqual(properties(upstream), { passive: false, programFiles: false, inPlace: false, noDesktop: false, openApp: false, finishPage: false });
});

test('taking out any one change fails a property', () => {
  const names = { 0: 'passive', 1: 'programFiles', 2: 'inPlace', 3: 'noDesktop', 4: 'openApp', 5: 'finishPage' };
  CHANGES.forEach((change, index) => {
    let out = upstream;
    CHANGES.forEach((other, at) => { if (at !== index) out = out.replace(other.find, () => other.replace); });
    assert.equal(properties(out)[names[index]], false, change.why);
  });
});

// Every part there, first occurrences in this order — and each exactly once, so a step that comes again
// after a later one is caught as well (카본 끝판 D2).
const inOrder = (text, parts) => {
  const at = parts.map((part) => text.indexOf(part));
  return at.every((p, i) => p >= 0 && (i === 0 || p > at[i - 1])) && parts.every((part) => text.split(part).length === 2);
};
// Anything that stops NSIS — with or without a message, in any case (카본 끝판 D3).
const STOP = /\b(?:Abort|Quit)\b/gi;

test('the hooks keep runs from starting, never overwrite a mapped executable, ask first, and an update never removes tasks', () => {
  // Install: marker, then everything closed (an install never asks), then both executables moved aside before the template writes the new ones (review GA3).
  assert.ok(inOrder(macro('NSIS_HOOK_PREINSTALL'), ['SWB_MARK_INSTALLING', 'SWB_CLOSE\n', 'SWB_SET_ASIDE "WorkBackupRun.exe"', 'SWB_SET_ASIDE "${MAINBINARYNAME}.exe"']));
  assert.match(macro('SWB_SET_ASIDE name'), /Rename "\$INSTDIR\\\$\{name\}" "\$INSTDIR\\\$\{name\}\.old"/);
  assert.ok(inOrder(macro('NSIS_HOOK_POSTINSTALL'), ['ExecWait \'"$INSTDIR\\WorkBackupRun.exe" --install\' $0', 'Delete /REBOOTOK "$INSTDIR\\WorkBackupRun.exe.old"',
    'Delete /REBOOTOK "$INSTDIR\\${MAINBINARYNAME}.exe.old"', 'Delete "$INSTDIR\\.installing"']));
  // A stopped install puts the moved executables back, drops a moved copy whose new file was written, and lets runs start again (re-review GA1 · GA3).
  const failed = block(hooks, 'Function .onInstFailed\n', 'FunctionEnd');
  assert.ok(inOrder(failed, ['SWB_PUT_BACK "WorkBackupRun.exe"', 'SWB_PUT_BACK "WorkBackup.exe"', 'Delete "$INSTDIR\\.installing"']));
  // Put back only where the new file is not there (카본 끝판 D4): with the test turned round the moved copy would be deleted instead.
  assert.ok(inOrder(macro('SWB_PUT_BACK name'), ['${IfNot} ${FileExists} "$INSTDIR\\${name}"\n', '${AndIf} ${FileExists} "$INSTDIR\\${name}.old"\n',
    'Rename "$INSTDIR\\${name}.old" "$INSTDIR\\${name}"', '${EndIf}', 'Delete /REBOOTOK "$INSTDIR\\${name}.old"']));
  // A file the installer cannot write is never skipped (NSIS skips it by default — a silent install then reports success over
  // mixed files; Fable 5.2 design review 1): set before any macro, and nothing turns overwriting off.
  assert.ok(hooks.indexOf('\nAllowSkipFiles off\n') > 0 && hooks.indexOf('\nAllowSkipFiles off\n') < hooks.indexOf('!macro '), 'AllowSkipFiles off at the top');
  assert.doesNotMatch(hooks + patched(upstream), /^\s*SetOverwrite\b/m);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../src-tauri/tauri.conf.json'), 'utf8'));
  assert.equal(`${config.mainBinaryName}.exe`, 'WorkBackup.exe', 'the name written out in .onInstFailed is the window app');
  // Uninstall: everything closed first (the one question there is — a cancel stops before anything changed), then the marker,
  // and nothing after the marker asks or stops (review GA1 · re-review c).
  const before = macro('NSIS_HOOK_PREUNINSTALL');
  const uninstall = 'ExecWait \'"$INSTDIR\\WorkBackupRun.exe" --uninstall\' $0';
  assert.ok(inOrder(before, ['SWB_CLOSE\n', 'SWB_MARK_INSTALLING', uninstall]));
  assert.doesNotMatch(before.slice(before.indexOf('SWB_MARK_INSTALLING')), /CheckIfAppIsRunning|SWB_CLOSE|MessageBox|\bAbort\b|\bQuit\b/i, 'nothing after the marker asks or stops');
  assert.match(before, /\$\{If\} \$UpdateMode <> 1\n\s+ExecWait '"\$INSTDIR\\WorkBackupRun\.exe" --uninstall' \$0/);
  // After the marker the template's own check closes without asking (Fable 5.2 review 5); the setting comes back first thing after.
  assert.ok(inOrder(before, ['SWB_MARK_INSTALLING', 'StrCpy $SwbPassiveMode $PassiveMode', 'StrCpy $PassiveMode 1', uninstall]));
  assert.equal(before.split('StrCpy $PassiveMode').length - 1, 1, 'the setting is not put back before --uninstall');
  assert.match(macro('NSIS_HOOK_POSTUNINSTALL'), /^!macro NSIS_HOOK_POSTUNINSTALL\n\s*StrCpy \$PassiveMode \$SwbPassiveMode\n/);
  assert.match(block(hooks, 'Function un.onUninstFailed\n', 'FunctionEnd'), /Delete "\$INSTDIR\\\.installing"/);
  // Both moved executables, or the install folder the RMDir removes only when empty stays (카본 끝판 D5).
  assert.ok(inOrder(macro('NSIS_HOOK_POSTUNINSTALL'), ['Delete "$INSTDIR\\.installing"', 'Delete /REBOOTOK "$INSTDIR\\WorkBackupRun.exe.old"',
    'Delete /REBOOTOK "$INSTDIR\\${MAINBINARYNAME}.exe.old"', 'RMDir "$INSTDIR"', 'DeleteRegKey HKLM "${MANUPRODUCTKEY}"']));
  // One Restart Manager session over all four images: one question at most, on the first pass only, and every stop takes the
  // install's marker away itself first, so no failure window holds it (re-review c GA2 · GA3).
  assert.ok(inOrder(macro('SWB_CLOSE'), ['$(appRunning)', '$(appRunningOkKill)', '$(failedToKillApp)', 'SWB_CLOSE_PASS 1', 'SWB_CLOSE_PASS 0']));
  const pass = macro('SWB_CLOSE_PASS ask');
  for (const exe of ['${MAINBINARYNAME}.exe', 'WorkBackupRun.exe', 'resources\\node.exe', 'resources\\restic.exe']) {
    assert.ok(pass.includes(`RestartManager_RegisterFile $R0 "$INSTDIR\\${exe}"`), exe);
  }
  assert.equal(pass.split('MessageBox').length - 1, 1);
  assert.match(block(pass, '!if "${ask}" == "1"', '!endif'), /\$\{IfNot\} \$\{Silent\}\n\s+\$\{AndIf\} \$PassiveMode != 1\n\s+\$\{AndIf\} \$\{Cmd\} `MessageBox MB_OKCANCEL/, 'asks only on the first pass, never silent or passive');
  const stops = [...pass.matchAll(STOP)].map((m) => m.index);
  assert.equal(stops.length, 2);
  assert.equal([...macro('SWB_CLOSE').matchAll(STOP)].length, 0, 'the passes are the only stops');
  for (const at of stops) assert.match(pass.slice(0, at), /Delete "\$INSTDIR\\\.installing"\n\s*$/, 'every stop takes the marker away first');
  // When another session holds the files, the message says so (Restart Manager cannot close another session's processes — review 4).
  assert.match(pass, /IntOp \$3 \$3 & \$\{RmRebootReasonSessionMismatch\}\n\s+\$\{If\} \$3 <> 0\n\s+StrCpy \$R3 "다른 사용자가 [^"]+"\n\s+\$\{EndIf\}\n\s+Delete "\$INSTDIR\\\.installing"\n\s+Abort "\$R3"/);
  assert.doesNotMatch(macro('SWB_CLOSE') + pass, /\bGoto\b|^\s*\w+:\s*$/m, 'no hand-written labels: the pass goes in twice');
  // The template's own check (a session and a question per file, its stop after our marker) is not used by the hooks.
  assert.doesNotMatch(hooks, /CheckIfAppIsRunning/);
  assert.match(macro('SWB_MARK_INSTALLING'), /FileOpen \$0 "\$INSTDIR\\\.installing" w/);
  // Functions are read before the template's defines: no define may appear in them.
  for (const name of ['.onInstFailed', 'un.onUninstFailed']) assert.doesNotMatch(block(hooks, `Function ${name}\n`, 'FunctionEnd'), /\$\{[A-Z]+\}/, name);
  // The template has no failure callbacks of its own, so these are the ones that run.
  assert.doesNotMatch(upstream, /Function (?:\.onInstFailed|un\.onUninstFailed)\b/);
  // The marker the hooks write is the one the run executable reads.
  assert.match(fs.readFileSync(path.join(__dirname, '../src-tauri/src/platform.rs'), 'utf8'), /pub const INSTALLING: &str = "\.installing";/);
});

test('the bundle is the machine-wide Korean NSIS installer without downgrades, its staged paths given by the build', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../src-tauri/tauri.conf.json'), 'utf8'));
  assert.equal(config.identifier, 'im.synk.workbackup');
  assert.equal(config.mainBinaryName, 'WorkBackup');
  assert.equal(config.bundle.active, true);
  assert.deepEqual(config.bundle.targets, ['nsis']);
  assert.equal(config.bundle.windows.allowDowngrades, false);
  assert.deepEqual(config.bundle.windows.nsis, { installMode: 'perMachine', languages: ['Korean'] });
  assert.equal(config.bundle.resources, undefined, 'build.ps1 gives the staged resources, so a plain cargo build needs none');
  const build = fs.readFileSync(path.join(__dirname, '../scripts/build.ps1'), 'utf8');
  assert.match(build, /tauri build --ci --bundles nsis --config \$bundleConfig -- --locked/);
  assert.match(build, /nsis-template\.cjs/);
});
