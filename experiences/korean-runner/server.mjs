import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
const root=fileURLToPath(new URL('./',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
const port=Number(process.env.SYNK_RUNNER_PORT||4273);
const lan=process.argv.includes('--lan'),host=lan?'0.0.0.0':'127.0.0.1';
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    const relative=path.relative(root,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403).end();return;}
    const data=await fs.readFile(target);
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,host,()=>{
  console.log(`바람길: http://127.0.0.1:${port}`);
  if(lan)for(const items of Object.values(networkInterfaces()))for(const item of items||[])if(item.family==='IPv4'&&!item.internal)console.log(`같은 Wi-Fi 휴대폰: http://${item.address}:${port}`);
});
