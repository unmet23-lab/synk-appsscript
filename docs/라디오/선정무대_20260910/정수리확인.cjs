'use strict';
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'정수리수정');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const sources=[['원본','docs/Loom_자산/옷/GPT/까몽_3개월출석잎망토.png',{left:850,top:205,width:200,height:160}],['라디오','docs/라디오/선정무대_20260910/라이브13/leaf-base-48823c235151.webp',{left:377,top:175,width:90,height:80}]];
 for(const [name,rel,box] of sources){await sharp(path.join(root,rel)).extract(box).resize(box.width*4,box.height*4,{kernel:'nearest'}).png().toFile(path.join(out,name+'-점확대.png'));}
})();
