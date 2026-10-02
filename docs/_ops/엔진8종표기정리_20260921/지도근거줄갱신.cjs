'use strict';
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../../..');const dir=path.join(root,'docs/엔진/지도_20260921');
const shift=n=>String(Number(n)+(Number(n)>=22?3:Number(n)>=6?2:0));
for(const n of ['data-core-trail-temper.json','data-prism-strata.json','data-vellum-loom-reed.json']){const p=path.join(dir,n),d=JSON.parse(fs.readFileSync(p,'utf8'));for(const e of d)for(const s of e.sources)if(s.path.endsWith('엔진8종_상향설계_v3.md'))s.lines=s.lines.replace(/\d+/g,shift);fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');}
for(const n of ['audit-core-trail-temper.md','audit-prism-strata.md','audit-vellum-loom-reed.md']){const p=path.join(dir,n),s=fs.readFileSync(p,'utf8');fs.writeFileSync(p,s.replace(/엔진8종_상향설계_v3\.md:(\d+(?:[-–]\d+)?)/g,(m,r)=>m.replace(r,r.replace(/\d+/g,shift))));}
console.log('Canonical source line references refreshed after the eight-engine role table update.');
