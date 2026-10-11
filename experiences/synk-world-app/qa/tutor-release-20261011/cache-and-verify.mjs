import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const work=path.resolve('.tmp/tutor-release-20261011'),file=path.join(work,'candidate.json'),plan=JSON.parse(fs.readFileSync(file));
const revision='tutor-'+plan.sourceCommit,root=path.join(plan.payload,'world'),changed=new Set(plan.changes.map(e=>e.path.slice(6)));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),blob=b=>crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
for(const p of walk(root).filter(p=>/\.(mjs|js|css|html)$/.test(p))){
 const rel=path.relative(root,p).replaceAll('\\','/'),before=fs.readFileSync(p,'utf8');
 const version=value=>{if(/^(https?:|data:|#)/.test(value)||value.includes('${'))return value;const u=new URL(value,'https://synk.im/world/'+rel);if(!u.pathname.startsWith('/world/')||!changed.has(decodeURIComponent(u.pathname.slice(7))))return value;return value.includes('?')?value:value+'?v='+revision;};
 let after=before.replace(/((?:\bfrom|\bimport)\s*["'])([^"']+)(["'])/g,(_,a,v,b)=>a+version(v)+b).replace(/(\bimport\(\s*["'])([^"']+)(["'])/g,(_,a,v,b)=>a+version(v)+b);
 if(rel.endsWith('.html'))after=after.replace(/(\b(?:src|href)=["'])([^"']+)(["'])/g,(_,a,v,b)=>a+version(v)+b);
 if(rel==='app-shell.mjs'){
  after=after.replace(/\$\{worldUrl\(game.path\)\}(?:\?v=tutor-[a-z0-9]+)*/g,'${worldUrl(game.path)}?v='+revision);
  after=after.replace("worldUrl('brand-opening/opening.mjs')","worldUrl('brand-opening/opening.mjs?v="+revision+"')");
  after=after.replace("worldUrl('brand-opening/game-tutor-support.mjs')","worldUrl('brand-opening/game-tutor-support.mjs?v="+revision+"')");
 }
 if(before!==after){fs.writeFileSync(p,after);let e=plan.changes.find(e=>e.path==='world/'+rel);if(!e){e={path:'world/'+rel,source:'preserved public entry; versioned changed module reference',status:'modified',previousSha256:sha(Buffer.from(before))};plan.changes.push(e);}e.cacheVersioned=true;}
}
const missing=[];
for(const p of walk(root).filter(p=>/\.(mjs|js|css|html)$/.test(p))){
 const rel=path.relative(root,p).replaceAll('\\','/'),s=fs.readFileSync(p,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 const patterns=rel.endsWith('.html')?[/\b(?:src|href)=["']([^"']+)["']/g]:rel.endsWith('.css')?[/url\(\s*["']?([^"')]+)["']?\s*\)/g]:[/\b(?:from|import)\s*["']([^"']+)["']/g,/import\(\s*["']([^"']+)["']\s*\)/g,/new URL\(\s*["']([^"']+)["']/g];
 for(const pattern of patterns)for(const m of s.matchAll(pattern)){const v=m[1];if(!v||/^(https?:|data:|blob:|#|javascript:)/.test(v)||v.includes('${'))continue;if(!v.startsWith('.')&&!v.startsWith('/')&&!/^[a-zA-Z0-9_./-]+\.[a-z0-9]+(?:[?#].*)?$/i.test(v))continue;const u=new URL(v,'https://synk.im/world/'+rel);if(!u.pathname.startsWith('/world/'))continue;let dest=decodeURIComponent(u.pathname.slice(7));if(dest.endsWith('/')&&fs.existsSync(path.join(root,dest)))continue;if(dest.endsWith('/'))dest+='index.html';if(!fs.existsSync(path.join(root,dest)))missing.push({from:rel,value:v});}
}
for(const e of plan.changes){
 const target=path.join(plan.payload,e.path);let b=fs.readFileSync(target);
 if(e.path.endsWith('.png')){const chunks=[b.subarray(0,8)],removed=[];for(let n=8;n<b.length;){const size=b.readUInt32BE(n)+12,type=b.subarray(n+4,n+8).toString('ascii');if(n+size>b.length)throw Error('Invalid PNG chunk');if(type==='caBX')removed.push({type,bytes:size});else chunks.push(b.subarray(n,n+size));n+=size;}if(removed.length){b=Buffer.concat(chunks);fs.writeFileSync(target,b);e.metadataOnlyRemoved=removed;}}
 e.bytes=b.length;e.sha256=sha(b);e.blob=blob(b);if(/\.(mjs|js)$/.test(e.path))execFileSync(process.execPath,['--check',target],{stdio:'pipe'});
}
plan.cacheRevision=revision;plan.referenceMissing=missing;plan.changedBytes=plan.changes.reduce((n,e)=>n+e.bytes,0);fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({changes:plan.changes.length,missing,bytes:plan.changedBytes}));if(missing.length)process.exitCode=1;
