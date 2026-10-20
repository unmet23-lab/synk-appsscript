'use strict';
// The recovery task runs under Windows PowerShell 5.1, so these tests drive the script with it too.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'tools', 'hermes-synk', 'runtime', 'recover-gateway.ps1');
const ps51 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const skip = process.platform !== 'win32' && 'Windows PowerShell only';
const INSTALL = '11f4c88b7cdc62a3';
const OLD = '9810c096707e41959a8489f67c0c90f7';
const NEW = 'e3240b89a48f4632a4a798146f6a9034';

function run(command) {
  const result = spawnSync(ps51, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.stderr.trim(), '', result.stderr);
  return { status: result.status, out: result.stdout.trim() };
}

function home(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-hermes-recovery-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeFacts(hermes, environment) {
  const dir = path.join(hermes, 'installs', INSTALL);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify({ packages: { venv: { environment, extras: ['all', 'anthropic', 'telegram'] } }, schema: 1 }));
}

const generation = (hermes, name) => path.join(hermes, 'installs', INSTALL, 'environments', name, 'venv');
const moduleFile = (hermes, name) => path.join(generation(hermes, name), 'Lib', 'site-packages', 'pydantic_core', '_pydantic_core.cp314-win_amd64.pyd');
const statusFile = hermes => path.join(hermes, 'synk-gateway-recovery-status.json');

function drift(hermes, modules) {
  const input = path.join(hermes, 'input.json');
  fs.writeFileSync(input, JSON.stringify({ modules, root: path.join(hermes, 'installs') }));
  const { out } = run(`. '${script}'; $in = Get-Content -LiteralPath '${input}' -Raw | ConvertFrom-Json; $r = Get-DependencyDrift -ModulePaths @($in.modules) -InstallsRoot $in.root; if ($r) { $r | ConvertTo-Json -Compress } else { 'null' }`);
  return JSON.parse(out);
}

test('a gateway still on the generation it booted with is not touched', { skip }, (t) => {
  const hermes = home(t);
  writeFacts(hermes, generation(hermes, NEW));
  assert.equal(drift(hermes, ['C:\\Windows\\System32\\kernel32.dll', moduleFile(hermes, NEW)]), null);
});

test('the 10-19 case: anthropic published a new generation after the gateway booted', { skip }, (t) => {
  const hermes = home(t);
  writeFacts(hermes, generation(hermes, NEW));
  assert.deepEqual(drift(hermes, [moduleFile(hermes, OLD)]), { Loaded: OLD, Selected: NEW });
  // Windows paths compare without case; a differently cased drive letter is the same file.
  const lower = moduleFile(hermes, OLD).replace(/^[A-Z]:/, (d) => d.toLowerCase());
  assert.deepEqual(drift(hermes, [lower]), { Loaded: OLD, Selected: NEW });
});

test('drift that cannot be proven leaves the gateway alone', { skip }, (t) => {
  const hermes = home(t);
  writeFacts(hermes, generation(hermes, NEW));
  assert.equal(drift(hermes, ['C:\\Windows\\System32\\kernel32.dll']), null, 'no generation loaded');
  assert.equal(drift(hermes, [moduleFile(hermes, OLD), moduleFile(hermes, NEW)]), null, 'two generations loaded');
  writeFacts(hermes, path.join(hermes, 'installs', INSTALL, 'venv'));
  assert.equal(drift(hermes, [moduleFile(hermes, OLD)]), null, 'selection is not a generation');
  fs.writeFileSync(path.join(hermes, 'installs', INSTALL, 'facts.json'), '{ broken');
  assert.equal(drift(hermes, [moduleFile(hermes, OLD)]), null, 'unreadable facts');
  fs.rmSync(path.join(hermes, 'installs', INSTALL, 'facts.json'));
  assert.equal(drift(hermes, [moduleFile(hermes, OLD)]), null, 'missing facts');
});

const GATEWAY = 2147480000; // no such process, so it has no children

function idle(hermes, state, processes) {
  fs.writeFileSync(path.join(hermes, 'gateway_state.json'), JSON.stringify(state));
  if (processes !== undefined) fs.writeFileSync(path.join(hermes, 'processes.json'), processes);
  return run(`. '${script}'; Test-GatewayIdle -GatewayPid ${GATEWAY} -HermesHome '${hermes}'`).out;
}

test('restart waits for Hermes to report no active agents, background processes or tool children', { skip }, (t) => {
  const hermes = home(t);
  const serving = { pid: GATEWAY, gateway_state: 'running', active_agents: 0, active_work: null };
  assert.equal(idle(hermes, serving, '[]\n'), 'True');
  assert.equal(idle(hermes, { ...serving, gateway_state: 'degraded' }, '[]'), 'True');
  assert.equal(idle(hermes, { ...serving, active_agents: 1 }, '[]'), 'False');
  assert.equal(idle(hermes, { ...serving, gateway_state: 'draining', active_work: ['cron run'] }, '[]'), 'False', 'already stopping');
  assert.equal(idle(hermes, { ...serving, pid: GATEWAY - 1 }, '[]'), 'False', 'state written by another gateway');
  assert.equal(idle(hermes, serving, '[{"session_id":"synk-1","pid":4242}]'), 'False');
  assert.equal(idle(hermes, serving, '{ broken'), 'False', 'unreadable background state');
  fs.rmSync(path.join(hermes, 'processes.json'));
  assert.equal(idle(hermes, serving, undefined), 'True', 'no checkpoint yet means no background process has run');
  fs.rmSync(path.join(hermes, 'gateway_state.json'));
  assert.equal(run(`. '${script}'; Test-GatewayIdle -GatewayPid ${GATEWAY} -HermesHome '${hermes}'`).out, 'False', 'no runtime state');
});

test('a running tool child process counts as busy', { skip }, (t) => {
  const hermes = home(t);
  fs.writeFileSync(path.join(hermes, 'processes.json'), '[]');
  // The harness becomes the "gateway": it writes its own PID, then starts one hidden child.
  const out = run(`. '${script}'; @{ pid = $PID; gateway_state = 'running'; active_agents = 0 } | ConvertTo-Json | Set-Content -LiteralPath '${path.join(hermes, 'gateway_state.json')}'; Test-GatewayIdle -GatewayPid $PID -HermesHome '${hermes}'; $c = Start-Process -FilePath cmd.exe -ArgumentList '/c','ping -n 6 127.0.0.1 >nul' -WindowStyle Hidden -PassThru; Test-GatewayIdle -GatewayPid $PID -HermesHome '${hermes}'; $c | Stop-Process -Force`).out;
  assert.deepEqual(out.split(/\r?\n/), ['True', 'False']);
});

// Each call is a fresh Windows PowerShell, like one scheduled run; the stand-in restart appends a line.
function recover(hermes, { readOnly = false, restartExit = '0', selected = NEW } = {}) {
  const calls = path.join(hermes, 'restart-calls.txt');
  const command = `. '${script}'; $drift = [pscustomobject]@{ Loaded = '${OLD}'; Selected = '${selected}' }; ` +
    `$r = Invoke-DriftRecovery -Drift $drift -GatewayPid ${GATEWAY} -HermesHome '${hermes}' -ReadOnly:$${readOnly} -Restart { Add-Content -LiteralPath '${calls}' -Value 'restart'; ${restartExit} }; $r | ConvertTo-Json -Compress`;
  const result = JSON.parse(run(command).out);
  const state = path.join(hermes, 'synk-gateway-recovery.json');
  return {
    ...result,
    restarts: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split(/\r?\n/).length : 0,
    state: fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, 'utf8').replace(/^﻿/, '')) : null,
  };
}

test('a drifted gateway is restarted once: after a second sighting, only while idle, never twice', { skip }, (t) => {
  const hermes = home(t);
  const serving = { pid: GATEWAY, gateway_state: 'running', active_agents: 1, active_work: null };
  fs.writeFileSync(path.join(hermes, 'gateway_state.json'), JSON.stringify(serving));
  fs.writeFileSync(path.join(hermes, 'processes.json'), '[]');

  let r = recover(hermes, { readOnly: true });
  assert.equal(r.Code, 5);
  assert.equal(r.state, null, 'read-only writes nothing');

  r = recover(hermes);
  assert.equal(r.Code, 0);
  assert.match(r.Message, /Checking again/);
  assert.equal(r.restarts, 0, 'first sighting waits for `hermes update` to restart on its own');
  assert.equal(r.state.selected, NEW);

  r = recover(hermes);
  assert.match(r.Message, /busy; restart deferred/);
  assert.equal(r.restarts, 0);
  assert.equal(r.state.restartRequested, undefined);

  fs.writeFileSync(path.join(hermes, 'gateway_state.json'), JSON.stringify({ ...serving, active_agents: 0 }));
  r = recover(hermes);
  assert.equal(r.Code, 0);
  assert.match(r.Message, /restart completed/);
  assert.equal(r.restarts, 1);
  assert.ok(r.state.restartRequested);

  r = recover(hermes);
  assert.equal(r.Code, 4);
  assert.equal(r.Warn, true);
  assert.equal(r.restarts, 1, 'the same generation is never restarted twice');

  r = recover(hermes, { selected: 'f'.repeat(32) });
  assert.match(r.Message, /Checking again/, 'a newer generation starts over');
  assert.equal(r.restarts, 1);
});

test('a restart that times out or fails is reported and not retried', { skip }, (t) => {
  for (const [restartExit, code] of [['$null', 3], ['1', 1]]) {
    const hermes = home(t);
    fs.writeFileSync(path.join(hermes, 'gateway_state.json'), JSON.stringify({ pid: GATEWAY, gateway_state: 'running', active_agents: 0 }));
    fs.writeFileSync(path.join(hermes, 'processes.json'), '[]');
    recover(hermes);
    let r = recover(hermes, { restartExit });
    assert.equal(r.Code, code);
    assert.equal(r.Warn, true);
    r = recover(hermes, { restartExit });
    assert.equal(r.Code, 4);
    assert.equal(r.restarts, 1);
  }
});

test('a gateway that stays busy for half an hour is still left alone but no longer reported as routine', { skip }, (t) => {
  const hermes = home(t);
  fs.writeFileSync(path.join(hermes, 'gateway_state.json'), JSON.stringify({ pid: GATEWAY, gateway_state: 'running', active_agents: 2 }));
  fs.writeFileSync(path.join(hermes, 'processes.json'), '[]');
  const sighting = (minutesAgo) => fs.writeFileSync(path.join(hermes, 'synk-gateway-recovery.json'),
    JSON.stringify({ selected: NEW, loaded: OLD, firstSeenUnix: Math.floor(Date.now() / 1000) - minutesAgo * 60 }));
  sighting(29);
  let r = recover(hermes);
  assert.equal(r.Code, 0);
  assert.equal(r.Warn, false);
  sighting(31);
  r = recover(hermes);
  assert.equal(r.Code, 6);
  assert.equal(r.Warn, true);
  assert.equal(r.restarts, 0);
  assert.equal(r.state.restartRequested, undefined);
});

test('dot-sourcing loads the functions without running recovery, and a missing gateway is still reported', { skip }, (t) => {
  const hermes = home(t);
  assert.equal(run(`. '${script}' -HermesHome '${hermes}'; 'loaded'`).out, 'loaded');
  const result = spawnSync(ps51, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-HermesHome', hermes, '-ReadOnly'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /not proven running/);
  assert.equal(fs.existsSync(statusFile(hermes)), false, 'read-only checks leave no status record');
});

test('each check leaves a small ASCII status record that the AI-free monitor reads as is', { skip }, (t) => {
  const hermes = home(t);
  run(`. '${script}'; Write-RecoveryStatus -HermesHome '${hermes}' -Code 0`);
  const bytes = fs.readFileSync(statusFile(hermes));
  assert.ok(bytes.every(b => b < 128), 'ASCII only, so Windows PowerShell writes no BOM');
  let record = JSON.parse(bytes.toString('ascii'));
  assert.deepEqual({ ...record, checkedAt: undefined }, { schemaVersion: 1, checkedAt: undefined, code: 0, drift: false, selected: null, since: null });
  assert.ok(Math.abs(Date.parse(record.checkedAt) - Date.now()) < 120000);

  // A drift record names the generation and when recovery first saw it (the state file's Unix seconds).
  fs.writeFileSync(path.join(hermes, 'synk-gateway-recovery.json'), JSON.stringify({ selected: NEW, loaded: OLD, firstSeen: '2026-10-19T21:42:00+09:00', firstSeenUnix: 1792413720 }));
  run(`. '${script}'; Write-RecoveryStatus -HermesHome '${hermes}' -Code 4 -Drift ([pscustomobject]@{ Loaded = '${OLD}'; Selected = '${NEW}' })`);
  record = JSON.parse(fs.readFileSync(statusFile(hermes), 'ascii'));
  assert.deepEqual([record.code, record.drift, record.selected, Date.parse(record.since)], [4, true, NEW, 1792413720 * 1000]);
  const { gatewayRecoverySnapshot } = require('../tools/hermes-synk/overview.cjs');
  const seen = gatewayRecoverySnapshot({ hermesHome: hermes, now: new Date() });
  assert.deepEqual([seen.available, seen.stale, seen.code, seen.drift, seen.selected], [true, false, 4, true, NEW]);
});
