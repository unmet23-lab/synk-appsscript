// PULSE 의뢰서 탭 시안 서버(2026-11-13) — 운영 서버 없이 의뢰서 화면만 띄운다.
//   /before/…  지금 운영 코드 그대로(pulse-app 폴더)
//   /after/…   over/에 있는 파일이 먼저, 없으면 pulse-app 폴더
//   두 쪽 모두 harness.html은 이 폴더 것을 준다. 127.0.0.1에만 연다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(here,'../../온라인마케팅지도/engagement/company/public/pulse-app');
const port=Number(process.argv[2])||4871;
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const inside=(root,file)=>{const full=path.resolve(root,file);return full===root||full.startsWith(root+path.sep)?full:null;};

http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);}catch{res.writeHead(400);return res.end();}
  // 시안 쪽(올리기 전 확인용): 올릴 때 붙는 문서 뼈대를 여기서 흉내 내어 감싼다.
  if(pathname==='/page'){const file=path.join(here,'page','의뢰서탭시안.html');if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fs.readFileSync(file,'utf8')}</body></html>`);}
  const m=/^\/(before|after)\/(.*)$/.exec(pathname);
  if(!m){res.writeHead(302,{location:'/after/harness.html?step=feel'});return res.end();}
  const [,side,rest]=m,name=rest||'harness.html';
  const tries=name==='harness.html'?[inside(here,'harness.html')]:side==='after'?[inside(path.join(here,'over'),name),inside(app,name)]:[inside(app,name)];
  const file=tries.find(f=>f&&fs.existsSync(f)&&fs.statSync(f).isFile());
  if(!file){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});return res.end('없음');}
  const stat=fs.statSync(file),type=types[path.extname(file).toLowerCase()]||'application/octet-stream';
  // 영상은 범위 요청에 답한다(브라우저가 범위로 받는다).
  const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
  if(range&&type==='video/mp4'){
    const start=range[1]?Number(range[1]):0,end=range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;
    res.writeHead(206,{'content-type':type,'content-range':`bytes ${start}-${end}/${stat.size}`,'accept-ranges':'bytes','content-length':end-start+1,'cache-control':'no-store'});
    return fs.createReadStream(file,{start,end}).pipe(res);
  }
  res.writeHead(200,{'content-type':type,'content-length':stat.size,'accept-ranges':'bytes','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`의뢰서 탭 시안 http://127.0.0.1:${port}/after/harness.html?step=feel`));
