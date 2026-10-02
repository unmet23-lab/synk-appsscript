import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.wasm':'application/wasm','.glb':'model/gltf-binary','.hdr':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  // Local-only QA capture; excluded from the static website package.
  if(req.method==='POST'&&req.url.startsWith('/_qa/capture/')){
    const name=req.url.split('/').pop();if(!/^[a-z0-9-]{1,60}\.(jpg|png|webm)$/.test(name)){res.writeHead(400).end();return;}
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
    await fs.mkdir(path.join(root,'qa'),{recursive:true});await fs.writeFile(path.join(root,'qa',name),Buffer.concat(chunks));res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({saved:name}));return;
  }
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const match=/^\/play\/(rhythm|runner)\/(.*)$/.exec(pathname);const base=match?path.resolve(root,`../korean-${match[1]}`):root;const relativeUrl=match?'/'+match[2]:pathname;const target=path.resolve(base,'.'+relativeUrl+(relativeUrl.endsWith('/')?'index.html':''));const relative=path.relative(base,target);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403).end();return;}const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);}catch{res.writeHead(404).end('Not found');}
}).listen(5197,'127.0.0.1',()=>console.log('SYNK LAB PLAY: http://127.0.0.1:5197'));
