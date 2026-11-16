'use strict';
// A local update feed for the clean-Windows update test (STAGE1_DESIGN.md 4.10 · T19): serves the files of one folder
// over plain HTTP on 127.0.0.1 at the port the test build was given — only that build allows plain HTTP
// (dangerousInsecureTransportProtocol in its override; the release accepts https only). The test swaps
// workbackup.json between cases; every request is logged beside the folder.
//   node clean-feed-server.cjs <folder> <port>
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const [folder, port] = process.argv.slice(2);
const root = path.resolve(folder), log = path.join(path.dirname(root), 'feed-requests.log');
http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
  const file = path.join(root, name);
  fs.appendFileSync(log, `${new Date().toISOString()} ${name}\n`);
  if (!name || /[\\/]/.test(name) || path.dirname(file) !== root || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const data = fs.readFileSync(file);
  res.writeHead(200, { 'content-type': name.endsWith('.json') ? 'application/json' : 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-store' }).end(data);
}).listen(Number(port), '127.0.0.1');
