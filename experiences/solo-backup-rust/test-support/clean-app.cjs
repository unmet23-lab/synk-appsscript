'use strict';
// Stands in for the window app of an installed SYNK 업무 백업 on a clean-Windows runner (STAGE1_DESIGN.md 4.11):
// runs that installation's own worker (resources\node.exe and its engine) on this user's real state folder,
// answering its host calls as the window does (DPAPI secrets, scripted dialogs). The scheduled runs themselves
// are the installed WorkBackupRun.exe. Never on a person's PC: it writes %APPDATA%\SynkWorkBackup.
//   node clean-app.cjs setup <data> <repository parent> <recovery kit out>
//   node clean-app.cjs automatic on|off
//   node clean-app.cjs restore <recovery kit> <repository> <output parent>
// One JSON line out; exit 0 done, 1 failed.
const fs = require('node:fs'), path = require('node:path');
const { setupLocal, setAutomatic, restoreFromKit } = require('./run-setup.cjs');

const installed = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'SYNK 업무 백업');
function folders() {
  const state = path.join(process.env.APPDATA, 'SynkWorkBackup'), cacheDir = path.join(process.env.LOCALAPPDATA, 'SynkWorkBackup');
  for (const dir of [state, cacheDir]) fs.mkdirSync(dir, { recursive: true });
  return { state, cacheDir, installed };
}

async function main([mode, ...args]) {
  if (mode === 'setup' && args.length === 3) {
    const [data, repoParent, keyFile] = args.map(a => path.resolve(a));
    // A person picks folders that are there: the repository's and the kit's.
    for (const dir of [repoParent, path.dirname(keyFile)]) fs.mkdirSync(dir, { recursive: true });
    await setupLocal({ ...folders(), data, repoParent, keyFile });
    return { setup: true };
  }
  if (mode === 'automatic' && ['on', 'off'].includes(args[0])) { await setAutomatic({ ...folders(), enabled: args[0] === 'on' }); return { automatic: args[0] }; }
  if (mode === 'restore' && args.length === 3) {
    const [keyFile, repository, output] = args.map(a => path.resolve(a));
    fs.mkdirSync(output, { recursive: true });
    return { restored: await restoreFromKit({ ...folders(), keyFile, repository, output }) };
  }
  throw Error('usage: clean-app.cjs setup <data> <repo parent> <kit> | automatic on|off | restore <kit> <repo> <output>');
}
main(process.argv.slice(2)).then(r => console.log(JSON.stringify({ ok: true, ...r })), e => { console.log(JSON.stringify({ ok: false, error: String(e.message).slice(0, 200) })); process.exitCode = 1; });
