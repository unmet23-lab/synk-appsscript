// Range-aware localhost preview so chapter buttons can seek through WebM/MP4.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf','.zip':'application/zip','.txt':'text/plain; charset=utf-8','.srt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end()}
  let file=path.resolve(root,'.'+pathname);
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);return res.end()}
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html')}catch{res.writeHead(404);return res.end()}
  let stat;try{stat=fs.statSync(file);if(!stat.isFile())throw Error()}catch{res.writeHead(404);return res.end()}
  const headers={'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
  let start=0,end=stat.size-1,status=200;
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
  if(match){
    start=match[1]?Number(match[1]):Math.max(0,stat.size-Number(match[2]));
    end=match[1]?(match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1):stat.size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end()}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length']=end-start+1;
  res.writeHead(status,headers);
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(file,{start,end}).pipe(res);
}).listen(5197,'127.0.0.1',()=>console.log('synkbrief preview ready on http://127.0.0.1:5197'));
