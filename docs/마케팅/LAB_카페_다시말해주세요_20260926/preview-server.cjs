'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=5208;
const mime={'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.srt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
 const size=fs.statSync(file).size,headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){const a=+range[1],b=range[2]?Math.min(+range[2],size-1):size-1;if(a>b||a>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}res.writeHead(206,{...headers,'Content-Range':`bytes ${a}-${b}/${size}`,'Content-Length':b-a+1});if(req.method==='HEAD')return res.end();fs.createReadStream(file,{start:a,end:b}).pipe(res);}
 else{res.writeHead(200,{...headers,'Content-Length':size});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);}
 }catch{res.writeHead(500);res.end('Unable to serve file');}
}).listen(port,'127.0.0.1',()=>console.log(`LAB preview ready at http://127.0.0.1:${port}`));
