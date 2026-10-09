import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.SYNK_HOME_PORT||4295);
const games=new Set(['korean-runner','korean-rhythm','hangul-stage']);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.hdr':'application/octet-stream'};
http.createServer((req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const first=pathname.split('/')[1];
    const isGame=games.has(first);
    let base=isGame?path.resolve(root,'..',first):root;
    if(isGame)pathname=pathname.slice(first.length+1);
    if(!isGame&&['/','/mobile.html','/desktop.html'].includes(pathname))pathname='/index.html';
    if(pathname.endsWith('/'))pathname+='index.html';
    const target=path.resolve(base,'.'+pathname);
    const rel=path.relative(base,target);
    if(rel.startsWith('..')||path.isAbsolute(rel)||!types[path.extname(target)]||rel.split(path.sep).some(p=>p.startsWith('.'))||(!isGame&&/^(qa|server|prepare-assets|asset-sources|README)/.test(rel))){res.writeHead(403).end();return;}
    const stat=fs.statSync(target);if(!stat.isFile())throw Error();
    const headers={'Content-Type':types[path.extname(target)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    let start=0,end=stat.size-1,status=200;
    if(range){start=+range[1];end=range[2]?Math.min(+range[2],end):end;if(start>end){res.writeHead(416).end();return;}headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;status=206;}
    headers['Content-Length']=end-start+1;res.writeHead(status,headers);
    if(req.method==='HEAD')res.end();else fs.createReadStream(target,{start,end}).pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('찾을 수 없는 페이지입니다.');}
}).listen(port,'127.0.0.1',()=>console.log(`SYNK WORLD home: http://127.0.0.1:${port}/desktop.html\nMobile: http://127.0.0.1:${port}/mobile.html`));
