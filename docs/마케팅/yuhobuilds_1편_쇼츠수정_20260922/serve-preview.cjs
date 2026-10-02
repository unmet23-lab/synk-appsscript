'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const port=4374;
const files={'/preview.html':'text/html; charset=utf-8','/preview-720.webm':'video/webm','/yuhobuilds_EP01.mp4':'video/mp4','/poster.png':'image/png','/captions.srt':'application/x-subrip; charset=utf-8'};
const finalDir='업로드_최종_20260926',aliases={'/original-preview.html':'preview.html'};
files['/original-preview.html']='text/html; charset=utf-8';
for(const [name,type] of Object.entries({'preview.html':'text/html; charset=utf-8','yuhobuilds_EP01_FINAL_1080x1920.mp4':'video/mp4','yuhobuilds_EP01_COVER.png':'image/png','yuhobuilds_EP01_자막.srt':'application/x-subrip; charset=utf-8'})){
  const route='/upload-20260926/'+name;files[route]=type;aliases[route]=path.join(finalDir,name);
}
http.createServer((req,res)=>{
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end();}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let route;try{route=decodeURIComponent(new URL(req.url,`http://127.0.0.1:${port}`).pathname);}catch{res.writeHead(400);return res.end();}
  if((route==='/'||route==='/preview.html')&&fs.existsSync(path.join(__dirname,finalDir,'preview.html'))){res.writeHead(302,{Location:'/upload-20260926/preview.html'});return res.end();}
  if(route==='/'){res.writeHead(302,{Location:'/preview.html'});return res.end();}
  if(!files[route]){res.writeHead(404);return res.end();}
  const file=path.join(__dirname,aliases[route]||route.slice(1));if(!fs.existsSync(file)){res.writeHead(404);return res.end('The video is still being prepared.');}
  const {size}=fs.statSync(file);let start=0,end=size-1,status=200;
  const headers={'Content-Type':files[route],'Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  if(req.headers.range){
    const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!m){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    if(m[1]){start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}else{start=Math.max(0,size-Number(m[2]));}
    if(start>=size||start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);
  if(req.method==='HEAD')return res.end();fs.createReadStream(file,{start,end}).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`yuhobuilds episode 1 preview: http://127.0.0.1:${port}/preview.html`));
