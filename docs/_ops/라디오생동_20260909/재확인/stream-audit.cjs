const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const script = fs.readFileSync(path.join(__dirname, 'stream-audit.py')).toString('base64');
const command = 'python3 -c ' + JSON.stringify("import base64;exec(base64.b64decode('" + script + "'))");
const run = cp.spawnSync('ssh', ['-i', 'C:/Users/q1212/.ssh/synk_radio', '-o', 'BatchMode=yes', 'synk@34.71.111.97', command], {encoding: 'utf8', maxBuffer: 5_000_000});
if (run.status !== 0) { process.stderr.write(run.stderr); process.exit(run.status || 1); }
const report = JSON.parse(run.stdout);
fs.writeFileSync(path.join(__dirname, 'stream-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({timeUTC: report.timeUTC, service: report.service, speedSummary: report.speedSummary, priorRestartStats: report.priorRestartStats}, null, 2));
