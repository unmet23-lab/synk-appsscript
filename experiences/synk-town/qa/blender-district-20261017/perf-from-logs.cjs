// Merges perf.cjs line logs (one JSON row per measured view) into the summary
// shape assemble.cjs reads. Logs survive an interrupted run; the final JSON may not.
// node perf-from-logs.cjs --gpu=default --dpr=2 --adapter="..." --out=<json> <log> [<log>...]
const fs = require('node:fs'), path = require('node:path');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.replace(/^--/, '').split('=')));
const logs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const rows = logs.flatMap(file => fs.readFileSync(path.resolve(file), 'utf8').split(/\r?\n/).filter(l => l.startsWith('{')).map(l => ({ ...JSON.parse(l), log: path.basename(file) })));
const summary = {};
for (const row of rows.filter(r => !r.failed && Number.isFinite(r.fps))) {
  const k = `${row.variant}|${row.key}|${row.view}`;
  (summary[k] ||= { variant: row.variant, viewport: row.key, view: row.view, fps: [], intervalP50: [], cpuP50: [], adapter: args.adapter || null });
  summary[k].fps.push(row.fps); summary[k].intervalP50.push(row.p50); if (Number.isFinite(row.cpu)) summary[k].cpuP50.push(row.cpu);
}
for (const s of Object.values(summary)) { s.fpsMedian = median(s.fps); s.intervalP50Median = median(s.intervalP50); s.cpuP50Median = median(s.cpuP50); }
const rounds = Math.max(...Object.values(summary).map(s => s.fps.length));
fs.writeFileSync(path.resolve(args.out), JSON.stringify({ source: logs.map(l => path.basename(l)), gpu: args.gpu || 'default', dpr: +(args.dpr || 1), rounds, failed: rows.filter(r => r.failed), summary: Object.values(summary) }, null, 2) + '\n');
console.log(JSON.stringify({ out: args.out, rows: rows.length, failed: rows.filter(r => r.failed).length, rounds }));
