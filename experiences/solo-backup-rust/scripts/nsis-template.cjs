'use strict';
// The NSIS template for the machine-wide installer (STAGE1_DESIGN.md 4.2 「컴퓨터 전체 설치」).
// src-tauri/nsis/upstream-installer.nsi is Tauri's own template exactly as @tauri-apps/cli 2.12.4
// ships it (tauri-apps/tauri tag tauri-cli-v2.12.4, crates/tauri-bundler/src/bundle/windows/nsis/
// installer.nsi, MIT OR Apache-2.0). This script checks its hash, applies the few changes below —
// each must match exactly once — and writes the template `tauri build` is pointed at. A CLI upgrade
// means a new upstream copy, a new hash and these changes checked again.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

const UPSTREAM = path.resolve(__dirname, '../src-tauri/nsis/upstream-installer.nsi');
const UPSTREAM_SHA256 = 'd00089d3b1a2c4a30d7b6e098079100cb8f25e980f84d4515aca4597b95e967d';

const CHANGES = [
  {
    why: 'no wizard pages: every interactive install runs like /P, the progress window only — one administrator prompt and done',
    find: '  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode\n  ${IfNot} ${Errors}\n    StrCpy $UpdateMode 1\n  ${EndIf}\n\n  !if "${DISPLAYLANGUAGESELECTOR}" == "true"',
    replace: '  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode\n  ${IfNot} ${Errors}\n    StrCpy $UpdateMode 1\n  ${EndIf}\n\n' +
      '  ; SYNK: no wizard pages — every install shows only its progress (STAGE1_DESIGN.md 4.2)\n  StrCpy $PassiveMode 1\n\n  !if "${DISPLAYLANGUAGESELECTOR}" == "true"',
  },
  {
    why: 'the install folder is always Program Files\\<product name>: /D= and a recorded earlier location are not used',
    find: '    Call RestorePreviousInstallLocation\n  ${EndIf}\n',
    replace: '    Call RestorePreviousInstallLocation\n  ${EndIf}\n' +
      '  ; SYNK: always Program Files (administrators-only writes) — /D= and an earlier location are not used\n  StrCpy $INSTDIR "$PROGRAMFILES64\\${PRODUCTNAME}"\n',
  },
  {
    why: 'an install over an existing one updates it in place; the old uninstaller would delete every user\'s scheduled runs',
    find: '  ; If migrating from Wix, always uninstall\n  ${If} $WixMode = 1\n    Goto reinst_uninstall\n  ${EndIf}\n',
    replace: '  ; If migrating from Wix, always uninstall\n  ${If} $WixMode = 1\n    Goto reinst_uninstall\n  ${EndIf}\n' +
      '  ; SYNK: install over the existing version in place — never run its uninstaller first, which removes\n' +
      '  ; every user\'s scheduled runs (STAGE1_DESIGN.md 4.2). Downgrades stop in .onInit (allowDowngrades false).\n  Goto reinst_done\n',
  },
  {
    why: 'Start menu only (it carries the notification identity); no desktop shortcut',
    find: '  ; Create desktop shortcut for silent and passive installers\n  ; because finish page will be skipped\n  ${If} $PassiveMode = 1\n  ${OrIf} ${Silent}\n    Call CreateOrUpdateDesktopShortcut\n  ${EndIf}\n',
    replace: '  ; SYNK: the Start menu shortcut only (it carries the notification identity) — no desktop shortcut\n',
  },
  {
    why: 'the app opens at the end as the signed-in user at normal privilege, never with the installer\'s administrator token; a silent install opens it only with /R',
    find: '  ${If} $PassiveMode = 1\n  ${OrIf} ${Silent}\n    ${GetOptions} $CMDLINE "/R" $R0\n    ${IfNot} ${Errors}\n      ${GetOptions} $CMDLINE "/ARGS" $R0\n      nsis_tauri_utils::RunAsUser "$INSTDIR\\${MAINBINARYNAME}.exe" "$R0"\n    ${EndIf}\n  ${EndIf}\n',
    replace: '  ; SYNK: open the app as the signed-in user, never with this installer\'s administrator token\n' +
      '  ; (STAGE1_DESIGN.md 4.2). RunAsUser falls back to starting it from this process when the shell\'s token\n' +
      '  ; cannot (review GA4); WorkBackupRun.exe --open-app never does. A silent install opens it only with /R.\n' +
      '  ClearErrors\n  ${GetOptions} $CMDLINE "/R" $R0\n  ${IfNot} ${Silent}\n  ${OrIfNot} ${Errors}\n    Exec \'"$INSTDIR\\WorkBackupRun.exe" --open-app\'\n  ${EndIf}\n',
  },
  {
    why: 'the finish page is never shown (every install is passive), but its run button would use RunAsUser too',
    find: 'Function RunMainBinary\n  nsis_tauri_utils::RunAsUser "$INSTDIR\\${MAINBINARYNAME}.exe" ""\nFunctionEnd\n',
    replace: 'Function RunMainBinary\n  ; SYNK: as .onInstSuccess — the shell\'s token only (review GA4)\n  Exec \'"$INSTDIR\\WorkBackupRun.exe" --open-app\'\nFunctionEnd\n',
  },
];

function patched(text) {
  const sha = crypto.createHash('sha256').update(text).digest('hex');
  if (sha !== UPSTREAM_SHA256) throw Error(`upstream NSIS template changed (${sha}); check every change again`);
  let out = text;
  for (const change of CHANGES) {
    const count = out.split(change.find).length - 1;
    if (count !== 1) throw Error(`template change matched ${count} times: ${change.why}`);
    out = out.replace(change.find, () => change.replace);
  }
  return out;
}

// Upstream is LF (.gitattributes keeps it so); a CRLF checkout is read as the same text.
const upstream = () => fs.readFileSync(UPSTREAM, 'utf8').replace(/\r\n/g, '\n');

function write(destination) {
  const text = patched(upstream());
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, text, { flag: 'wx' });
  return destination;
}

module.exports = { patched, write, upstream, CHANGES, UPSTREAM, UPSTREAM_SHA256 };
if (require.main === module) {
  const [destination] = process.argv.slice(2);
  if (!destination) { console.error('Usage: nsis-template <new output .nsi>'); process.exitCode = 64; }
  else console.log(write(path.resolve(destination)));
}
