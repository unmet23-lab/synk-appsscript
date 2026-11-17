'use strict';
// The installed MCP server on a clean Windows runner (STAGE1_DESIGN.md 4.16, T32 in part): `WorkBackupRun.exe --mcp` over
// standard input and output, the way an AI tool starts it. It answers initialize, lists its tools and gives the status
// file through protection_status (no consent needed). Then the install marker (`.installing`) is put in the install
// folder, as an install or update does, and the server must end by itself within 60 seconds; the marker is taken away
// again whatever happens. The runner has no cloud profile, so find_restorable's first search on a big repository is
// not measured here. Synthetic only; it writes into the install folder, so never on a person's PC.
//   node clean-mcp.cjs <WorkBackupRun.exe> <install folder>
const { spawn } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');

async function main(runExe, installFolder) {
  const marker = path.join(installFolder, '.installing');
  if (fs.existsSync(marker)) throw Error('an install marker is already there');
  const started = Date.now();
  const child = spawn(runExe, ['--mcp'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const exited = new Promise(resolve => child.on('exit', code => resolve({ code, at: Date.now() })));
  const waiting = new Map();
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    for (let i = buffer.indexOf('\n'); i >= 0; i = buffer.indexOf('\n')) {
      const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
      if (!line) continue;
      let message; try { message = JSON.parse(line); } catch { continue; }
      const resolve = waiting.get(message.id); if (resolve) { waiting.delete(message.id); resolve(message); }
    }
  });
  let next = 1;
  const ask = (method, params, ms = 30000) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => { waiting.delete(id); reject(Error(`${method}: no answer in ${ms} ms`)); }, ms);
    waiting.set(id, m => { clearTimeout(timer); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const result = {};
  try {
    const init = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'clean-windows', version: '1' } });
    result.initializeMs = Date.now() - started;
    result.protocolVersion = init.result?.protocolVersion ?? null;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const list = await ask('tools/list', {});
    result.tools = (list.result?.tools || []).map(t => t.name);
    const status = await ask('tools/call', { name: 'protection_status', arguments: {} });
    result.statusAnswered = Boolean(status.result && !status.result.isError);
    // The install marker: the server must notice it and end by itself. A server that already ended does not count
    // (GPT GA1), and the wait's timer is cleared so this script ends as soon as the server does (GPT GA2).
    if (child.exitCode !== null || child.signalCode !== null) throw Error(`the server ended before the marker (exit ${child.exitCode})`);
    const markedAt = Date.now();
    fs.writeFileSync(marker, '', { flag: 'wx' });
    let timer;
    try {
      const end = await Promise.race([exited, new Promise(resolve => { timer = setTimeout(() => resolve(null), 90000); })]);
      result.endedAfterMarkerMs = end ? end.at - markedAt : null;
      result.exitCode = end ? end.code : null;
    } finally { clearTimeout(timer); fs.rmSync(marker, { force: true }); }
  } finally {
    if (child.exitCode === null) child.kill();
  }
  return result;
}

if (require.main === module) {
  const [runExe, installFolder] = process.argv.slice(2);
  main(runExe, installFolder).then(r => console.log(JSON.stringify(r)), e => { console.log(JSON.stringify({ error: e.message })); process.exitCode = 1; });
}
module.exports = { main };
