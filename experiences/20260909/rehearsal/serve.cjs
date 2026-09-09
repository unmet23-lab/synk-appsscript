'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.json':'application/json; charset=utf-8' };
function createServer() {
  return http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    if (pathname === '/') { response.writeHead(302,{Location:'/rehearsal/'}).end(); return; }
    if (!pathname.startsWith('/rehearsal/')) { response.writeHead(404).end(); return; }
    const relative = pathname.slice('/rehearsal/'.length) || 'index.html';
    const file = path.resolve(__dirname, relative);
    if (!file.startsWith(__dirname + path.sep) || !['GET','HEAD'].includes(request.method)) { response.writeHead(404).end(); return; }
    fs.readFile(file,(error,data)=>{
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data:; script-src 'self'; connect-src 'none'; object-src 'none'"});
      response.end(request.method === 'HEAD' ? undefined : data);
    });
  });
}
module.exports = { createServer };
if (require.main === module) {
  const port = Number(process.argv[2] || 4177);
  createServer().listen(port,'127.0.0.1',()=>console.log(`Rehearsal: http://127.0.0.1:${port}/rehearsal/`));
}
