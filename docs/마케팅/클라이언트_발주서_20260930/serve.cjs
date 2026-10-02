const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'dist/SYNK_영상제작_발주서.html');
const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURI((req.url||'/').split('?')[0]);}catch{res.writeHead(400);res.end('Bad request');return;}if(pathname==='/'||pathname==='/SYNK_영상제작_발주서.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}else{res.writeHead(404);res.end('Not found');}});
server.listen(Number(process.env.BRIEF_PREVIEW_PORT||4317),'127.0.0.1',()=>console.log(`Preview http://127.0.0.1:${server.address().port}/`));
