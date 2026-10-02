'use strict';
const fs=require('node:fs');const path=require('node:path');
const root='C:/Users/q1212/Documents/SYNK-deploy-mn-20260909';
const ink=require(path.join(root,'tools/lib/룸잉크.js'));
const names=['Core','Loom','Prism','Reed','Temper','Trail','Vellum'];
const files=names.map(n=>`docs/엔진/SYNK_${n}_소개서.html`).concat('docs/엔진/SYNK_엔진_지도.html');
const reports=[];
for(const file of files){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const sanitize=s=>s.replace(/data:[^;"')]+;base64,[A-Za-z0-9+/=]+/g,'[embedded asset]');
  const numbers=[...html.matchAll(/<span\b([^>]*\bclass=["'][^"']*번호[^"']*["'][^>]*)>([\s\S]*?)<\/span>/g)].map(m=>({line:html.slice(0,m.index).split('\n').length,attributes:m[1].trim(),content:sanitize(m[2]).slice(0,500),hasImage:/<img\b/.test(m[2]),baked:/구운번호/.test(m[1]),text:m[2].replace(/<[^>]*>/g,'').trim()}));
  const css=[...html.matchAll(/\.엔진전시\s+\.번호[^{}]*\{[^{}]*\}|\.엔진전시\s+\.구운번호\s+img[^{}]*\{[^{}]*\}/g)].map(m=>({line:html.slice(0,m.index).split('\n').length,rule:sanitize(m[0])}));
  reports.push({file,findings:ink.충돌들(html),numberCount:numbers.length,allImageOnly:numbers.every(n=>n.hasImage&&n.baked&&!n.text),css,numbers});
}
fs.writeFileSync(path.join(__dirname,'룸잉크원인.json'),JSON.stringify({checkedAt:new Date().toISOString(),reports},null,2)+'\n');
console.log(JSON.stringify(reports.map(r=>({file:r.file,numberCount:r.numberCount,allImageOnly:r.allImageOnly,findings:r.findings,css:r.css})),null,2));
