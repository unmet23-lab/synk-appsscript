import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2','.ttf':'font/ttf','.md':'text/plain; charset=utf-8'};
export function createServer(){return http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');const decoded=decodeURIComponent(url.pathname);const target=path.resolve(root,'.'+decoded+(decoded.endsWith('/')?'index.html':''));const relative=path.relative(root,target);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403).end('Forbidden');return;}const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"}).end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404).end('Not found');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.SYNK_RHYTHM_PORT||5201);createServer().listen(port,'127.0.0.1',()=>console.log(`SYNK 말의 리듬: http://127.0.0.1:${port}`));}
