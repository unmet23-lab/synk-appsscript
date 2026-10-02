const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname;
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.zip':'application/zip'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/preview.html':pathname));
 if(!file.toLowerCase().startsWith(root.toLowerCase()+path.sep)){res.writeHead(403).end();return;}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
server.listen(0,'127.0.0.1',()=>{fs.writeFileSync(path.join(root,'qa','preview-server.json'),JSON.stringify({pid:process.pid,url:'http://127.0.0.1:'+server.address().port+'/'},null,2));console.log(server.address().port);});
