import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.wav':'audio/wav','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=path.resolve(root,'.'+pathname);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}if((await stat(target)).isDirectory())target=path.join(target,'index.html');const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404).end('Not found');}});
server.listen(Number(process.env.PORT||5243),'127.0.0.1',()=>process.stdout.write('Order Rush (SNS kit trial): http://127.0.0.1:'+server.address().port+'/\n'));
