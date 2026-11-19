// 훅이 보내는 것을 이 PC 안에서 받아, 사건 이름과 칸 이름만 적는다(값은 적지 않는다). 5분 뒤 스스로 꺼진다.
import http from 'node:http';
import fs from 'node:fs';
const [port, logPath] = [Number(process.argv[2]), process.argv[3]];
fs.writeFileSync(logPath, '');
const t0 = Date.now();
http.createServer((q, s) => {
  const chunks = [];
  q.on('data', (c) => chunks.push(c));
  q.on('end', () => {
    const buf = Buffer.concat(chunks);
    let row = { at: Date.now() - t0, path: q.url.replace(/[0-9a-f]{16,}/g, '<값>'), bytes: buf.length };
    try {
      const j = JSON.parse(buf.toString('utf8'));
      row.event = j.hook_event_name;
      row.keys = Object.keys(j).sort();
      row.session = String(j.session_id || '').slice(0, 8);
      for (const k of ['tool_name', 'notification_type', 'agent_id', 'agent_type', 'source', 'reason', 'permission_mode', 'model']) if (j[k] !== undefined) row[k] = typeof j[k] === 'string' ? j[k].slice(0, 40) : j[k];
      if (j.tool_input) row.tool_input_keys = Object.keys(j.tool_input);
      if (j.cwd) row.cwd_tail = String(j.cwd).split(/[\\/]/).slice(-2).join('/');
    } catch (e) { row.parse = 'not json'; }
    fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
    s.writeHead(204); s.end();
  });
}).listen(port, '127.0.0.1', () => console.log('listening ' + port));
setTimeout(() => process.exit(0), 5 * 60 * 1000);
