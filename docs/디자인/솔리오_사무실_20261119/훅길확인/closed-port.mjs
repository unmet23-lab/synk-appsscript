// 닫힌 포트와 열린 포트로 가는 HTTP POST가 얼마나 걸리는지 잰다(이 PC 안에서만).
import net from 'node:net';
import http from 'node:http';

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const post = async (url) => {
  const t0 = performance.now();
  let how = 'ok';
  try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"hook_event_name":"PostToolUse"}' }); how = 'http ' + r.status; await r.arrayBuffer(); }
  catch (e) { how = (e.cause && e.cause.code) || e.name; }
  return { ms: Math.round(performance.now() - t0), how };
};
const stats = (a) => { const v = a.map((x) => x.ms).sort((x, y) => x - y); return { min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1], how: [...new Set(a.map((x) => x.how))] }; };

const closed = await freePort();
const out = {};
for (const host of ['127.0.0.1', 'localhost']) {
  const runs = []; for (let i = 0; i < 6; i++) runs.push(await post(`http://${host}:${closed}/synk-office/x`));
  out['closed ' + host] = stats(runs);
}
const srv = http.createServer((q, s) => { q.resume(); q.on('end', () => { s.writeHead(204); s.end(); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const open = srv.address().port;
{ const runs = []; for (let i = 0; i < 6; i++) runs.push(await post(`http://127.0.0.1:${open}/synk-office/x`)); out['open 127.0.0.1'] = stats(runs); }
srv.close();
console.log(JSON.stringify({ node: process.version, out }, null, 1));
