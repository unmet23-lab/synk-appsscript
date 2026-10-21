// Local preview for the packaged offline checklist only.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'dist/SYNK_실사영상_제작체크.html');
const port=Number(process.argv[2]||4209);
http.createServer((req,res)=>{
 if(req.url==='/'||req.url==='/index.html'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(fs.readFileSync(file));
 }else{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Film checklist: http://127.0.0.1:'+port));
