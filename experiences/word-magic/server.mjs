import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4316);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'};
http.createServer((req,res)=>{let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}const filename=path.resolve(root,`.${p.endsWith('/')?p+'index.html':p}`);if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.stat(filename,(e,s)=>{if(e||!s.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-cache'});fs.createReadStream(filename).pipe(res);});}).listen(port,'127.0.0.1',()=>console.log(`Word Magic: http://127.0.0.1:${port}/`));
