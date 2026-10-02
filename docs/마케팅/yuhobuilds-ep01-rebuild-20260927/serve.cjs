const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=4377;
const allowed=new Set(['preview.html','practice.html','practice.js','cover.jpg','yuhobuilds_EP01_REBUILD_FINAL_1080x1920.mp4','복사용_첫완성질문.txt','yuhobuilds_EP01_자막.srt','assets/SUIT-Variable.woff2']);
for(const name of ["revision-v2/preview.html","revision-v2/practice.html","revision-v2/practice.js","revision-v2/cover.jpg","revision-v2/yuhobuilds_EP01_V2_FINAL_1080x1920.mp4","revision-v2/복사용_첫완성질문.txt","revision-v2/yuhobuilds_EP01_자막.srt","revision-v2/assets/SUIT-Variable.woff2"])allowed.add(name);allowed.add('preview-v1.html');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.srt':'text/plain; charset=utf-8','.mp4':'video/mp4','.jpg':'image/jpeg','.woff2':'font/woff2'};
http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'')||'preview.html';
  if(!allowed.has(name)){res.writeHead(404);return res.end('Not found');}
  const file=path.join(root,name),stat=fs.statSync(file);let start=0,end=stat.size-1,status=200;
  const headers={'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416);return res.end();}start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),end);if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
 }catch{res.writeHead(404);res.end('File not ready');}
}).listen(port,'127.0.0.1',()=>console.log('Preview ready: http://127.0.0.1:'+port+'/preview.html'));
