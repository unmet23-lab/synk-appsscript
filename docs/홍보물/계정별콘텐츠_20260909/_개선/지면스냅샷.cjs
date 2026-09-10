'use strict';
// Reuse the currently rendered introduction pages; do not substitute a split logo into the DOM.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const intro=path.resolve(__dirname,'../../브랜드소개_20260909'),out=path.join(__dirname,'지면스냅샷');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const items=[];
for(const name of ['lab-1','lab-2','shift-1','pulse-1','synk-1']){
 const source=path.join(intro,'소개서_4K',name+'.png'),target=path.join(out,name+'.png'),bytes=fs.readFileSync(source);
 fs.writeFileSync(target,bytes);items.push({file:name+'.png',source:'브랜드소개_20260909/소개서_4K/'+name+'.png',sha256:hash(bytes),sourceFileUnchanged:true,operation:'Exact copy of the current complete-logo introduction page.'});
}
fs.writeFileSync(path.join(out,'검증.json'),JSON.stringify({createdAt:new Date().toISOString(),items},null,2));console.log(JSON.stringify({pages:items.length}));
