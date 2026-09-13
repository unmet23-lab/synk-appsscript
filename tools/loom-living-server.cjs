#!/usr/bin/env node
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const root = path.join(repo, 'experiences/loom-living');
const port = Number(process.env.LOOM_PORT || 4319);
const allowedModules = new Set(['loom-scene.mjs','loom-scene-webgl.mjs']);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webm':'video/webm','.woff2':'font/woff2','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
  // Opt-in local artifact capture. Exact filenames, same origin, no arbitrary paths or credentials.
  if(process.env.LOOM_CAPTURE==='1'&&req.method==='PUT'&&req.url.startsWith('/__qa/')){
    const name=req.url.slice(6),allowed=new Set(['preview.webm','desktop.png','mobile.png','blink.png','turn.png','report.json','dialogue-desktop.png','dialogue-mobile.png','dialogue.json']);
    if(!allowed.has(name)||req.headers.origin!==`http://127.0.0.1:${port}`||req.headers['x-loom-capture']!=='1'){res.writeHead(403);res.end();return;}
    const chunks=[];let size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size>25*1024*1024){res.writeHead(413);res.end();req.destroy();return;}chunks.push(chunk);});
    req.on('end',()=>{fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa',name),Buffer.concat(chunks));res.writeHead(201);res.end('saved');});return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  let file;
  if(pathname.startsWith('/engine/')){
    const name=pathname.slice(8);
    if(!allowedModules.has(name)){res.writeHead(404);res.end();return;}
    file=path.join(repo,'tools/lib',name);
  }else{
    file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  }
  try{
    const stat=fs.statSync(file);if(!stat.isFile())throw new Error('not-file');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('파일을 찾을 수 없습니다.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Loom scene ready: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
