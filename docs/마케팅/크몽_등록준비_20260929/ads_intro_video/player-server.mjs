import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const mp4=path.resolve(dir,'../서비스소개_AI제품광고.mp4');
const server=http.createServer((req,res)=>{
if(req.url==='/video.mp4'){
if(!fs.existsSync(mp4)){res.writeHead(503);res.end('Render pending');return;}
const size=fs.statSync(mp4).size;let start=0,end=size-1,status=200;
if(req.headers.range){const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range);if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;status=206;}}
res.writeHead(status,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(status===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});fs.createReadStream(mp4,{start,end}).pipe(res);return;
}
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>AI 제품 광고 서비스 소개</title><style>body{margin:0;background:#252035;color:#faf6ff;font:20px sans-serif;padding:24px}video{display:block;width:min(100%,1280px);margin:24px auto}h1{font-size:24px;text-align:center}</style><h1>AI 제품 광고 서비스 소개 · 20초 · 무음</h1><video src="/video.mp4" controls playsinline preload="auto"></video></html>`);
});server.listen(4342,'127.0.0.1',()=>console.log('http://127.0.0.1:4342/'));
