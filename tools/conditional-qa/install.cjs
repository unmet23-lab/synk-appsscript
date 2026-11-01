'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { loadConfig, git, write } = require('./inputs.cjs');
const { initialize, defaultState } = require('./worker.cjs');
const TASK = 'SYNK 조건부 시험';
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function plan({ state = defaultState(), ops, pythonw }) {
  loadConfig(state);
  for (const file of [pythonw, path.join(ops, 'tools/숨김실행.py'), path.join(ops, 'tools/conditional-qa/worker.cjs')]) if (!fs.existsSync(file)) throw Error(`Required installed file is absent: ${file}`);
  if (!path.isAbsolute(state) || !path.isAbsolute(ops) || !path.isAbsolute(pythonw) || [state, ops, pythonw].some(x => /["\r\n]/.test(x))) throw Error('Use absolute Windows paths without quotes/newlines');
  const args = `-X utf8 -B "${path.join(ops, 'tools/숨김실행.py')}" --한도 7200 "${path.join(ops, 'tools/conditional-qa/worker.cjs')}" --state "${state}"`;
  const script = `$ErrorActionPreference='Stop'\n$action=New-ScheduledTaskAction -Execute ${quote(pythonw)} -Argument ${quote(args)} -WorkingDirectory ${quote(ops)}\n` +
    `$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)\n` +
    `$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew\n` +
    `$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited\n` +
    `Register-ScheduledTask -TaskName ${quote(TASK)} -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'SYNK trusted master: complete registered local test coverage and publish exact-commit status' -Force | Out-Null\n` +
    `Get-ScheduledTask -TaskName ${quote(TASK)} | Select-Object TaskName,State | ConvertTo-Json -Compress\n`;
  return { task: TASK, state, ops, pythonw, args, script };
}
function install(options) {
  const result = plan(options);
  if (!options.apply) return result;
  if (process.platform !== 'win32') throw Error('This local verifier needs Windows');
  initialize(result.state, options.firstCommit);
  const installed = cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(result.script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  write(path.join(result.state, 'installation.json'), { ...result, script: undefined, installedAt: new Date().toISOString(), firstCommit: options.firstCommit, opsCommit: git(result.ops, ['rev-parse', 'HEAD']), installed });
  return { task: TASK, installed: true, firstCommit: options.firstCommit };
}
if (require.main === module) {
  const args = process.argv.slice(2), value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  try { console.log(JSON.stringify(install({ state: value('--state') || defaultState(), ops: value('--ops'), pythonw: value('--pythonw'), firstCommit: value('--first'), apply: args.includes('--apply') }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { TASK, plan, install };
