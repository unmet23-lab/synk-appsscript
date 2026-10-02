'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const port=Number(process.env.ATLAS_PREVIEW_PORT||4327);
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname!=='/'&&pathname!=='/index.html') {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"});
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(path.join(__dirname,'index.html')).pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`Atlas preview: http://127.0.0.1:${port}`));
