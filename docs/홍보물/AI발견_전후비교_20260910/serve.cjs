'use strict';
// 비교 자료와 바로 옆 원본 자료만 이 컴퓨터에서 미리 본다.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..'),allowed=new Set([path.basename(__dirname),'회사별콘텐츠_20260910']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.zip':'application/zip'};
const server=http.createServer((req,res)=>{try{
 const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(base,rel);
 if(!file.startsWith(base+path.sep)||!allowed.has(path.relative(base,file).split(path.sep)[0])){res.writeHead(404).end();return}
 const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
 }catch{res.writeHead(404).end('Not found')}});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+'/'+encodeURIComponent(path.basename(__dirname))+'/'));
