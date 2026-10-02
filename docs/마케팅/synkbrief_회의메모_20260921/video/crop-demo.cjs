'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const assets=path.join(__dirname,'../assets');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const crops=[
  {source:'demo-input.png',target:'crop-input-memo.png',region:{left:290,top:239,width:730,height:132}},
  {source:'demo-input.png',target:'crop-input-columns.png',region:{left:290,top:106,width:440,height:34}},
  {source:'demo-input.png',target:'crop-input-rule.png',region:{left:290,top:133,width:610,height:34}},
  {source:'demo-result.png',target:'crop-result-table.png',region:{left:275,top:215,width:510,height:161}},
  {source:'demo-result.png',target:'crop-result-questions.png',region:{left:274,top:414,width:566,height:118}},
];
(async()=>{for(const c of crops){await sharp(path.join(assets,c.source)).extract(c.region).png().toFile(path.join(assets,c.target));c.sourceSha256=hash(path.join(assets,c.source));c.sha256=hash(path.join(assets,c.target));}fs.writeFileSync(path.join(assets,'demo-crops.json'),JSON.stringify({transform:'Crop only; original screenshot pixels preserved, no UI reconstruction',crops},null,2)+'\n');console.log('Saved '+crops.length+' exact screenshot crops.');})().catch(e=>{console.error(e);process.exit(1)});
