'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=4375;
const mime={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname==='/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({project:'yuhobuilds-ep02-redesign',videoReady:fs.existsSync(path.join(root,'yuhobuilds_EP02_v2.mp4'))}));return;}
 if(pathname==='/')pathname='/preview-v2.html';
 const file=path.resolve(root,'.'+pathname);
 if(!file.toLowerCase().startsWith(root.toLowerCase()+path.sep)){res.writeHead(403).end();return;}
 let stat;try{stat=fs.statSync(file);if(!stat.isFile())throw Error();}catch{res.writeHead(404).end();return;}
 const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
 const range=req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
 if(range){let start=range[1]?Number(range[1]):Math.max(0,stat.size-Number(range[2]));let end=range[1]?(range[2]?Number(range[2]):stat.size-1):stat.size-1;end=Math.min(end,stat.size-1);if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);}
 else{res.writeHead(200,{...headers,'Content-Length':stat.size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);}
}).listen(port,'127.0.0.1');
