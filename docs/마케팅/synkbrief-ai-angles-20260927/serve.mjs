import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.woff2':'font/woff2'};
http.createServer((req,res)=>{
 let requested;try{requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
 const target=path.resolve(root,'.'+(requested==='/'?'/watch.html':requested));
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return}
 let stat;try{stat=fs.statSync(target);if(!stat.isFile())throw 0}catch{res.writeHead(404).end();return}
 const headers={'Content-Type':types[path.extname(target)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;if(start>end||start>=stat.size){res.writeHead(416).end();return}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});fs.createReadStream(target,{start,end}).pipe(res)}else{res.writeHead(200,{...headers,'Content-Length':stat.size});if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res)}
}).listen(4387,'127.0.0.1',()=>console.log('http://127.0.0.1:4387'));
