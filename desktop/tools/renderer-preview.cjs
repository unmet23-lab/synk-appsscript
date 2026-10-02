'use strict';
// Presentation-only browser QA. Native actions require the actual PC client.
const http=require('node:http'),path=require('node:path');
const {createNativeContent}=require('../src/native-content.cjs');
const content=createNativeContent({appRoot:path.resolve(__dirname,'..')});
const port=Number(process.env.SYNK_RENDERER_PORT||63240);
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');const response=await content({method:req.method,url:'synk-desktop://platform'+(u.pathname==='/'?'/index.html':u.pathname)+u.search});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500).end();}}).listen(port,'127.0.0.1',()=>console.log(`Renderer preview: http://127.0.0.1:${port}/`));
