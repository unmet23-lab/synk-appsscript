const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const port=4376,types={'.mp4':'video/mp4','.html':'text/html; charset=utf-8','.png':'image/png','.srt':'application/x-subrip; charset=utf-8'};
const allow=new Set(['preview.html','yuhobuilds_EP01_FINISH_1080x1920.mp4','수정구간_미리보기.mp4','yuhobuilds_EP01_COVER.png','yuhobuilds_EP01_자막.srt']);
http.createServer((req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}`||!['GET','HEAD'].includes(req.method)){res.writeHead(403);return res.end();}
 let name;try{name=decodeURIComponent(new URL(req.url,`http://127.0.0.1:${port}`).pathname).slice(1)||'preview.html';}catch{res.writeHead(400);return res.end();}
 if(!allow.has(name)){res.writeHead(404);return res.end();}const file=path.join(__dirname,name);if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 const size=fs.statSync(file).size,headers={'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};let start=0,end=size-1,status=200;
 if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416);return res.end();}if(m[1]){start=+m[1];end=m[2]?Math.min(+m[2],size-1):end;}else start=Math.max(0,size-Number(m[2]));if(start> end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
 headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();fs.createReadStream(file,{start,end}).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/preview.html`));
