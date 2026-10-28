#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {currentUnits,digest,TASK,AUTHOR,AUTHORIZATION} from './lib/topik-review-atlas-20261028.mjs';
import {ORDERS,REVIEW,DELAYED_ORDERS,ADDITIONAL_ORDERS} from '../experiences/order-rush/core.mjs';
import {orderMetadata} from '../experiences/order-rush/learning.mjs';
import {supplementalItems} from '../experiences/korean-rhythm/supplemental.mjs';
import {publicTopikBank,publicFollowupBank} from './build-world-topik-items.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
export function checkContentSupply(){
 const review=read('experiences/topik-items/review/atlas-world-learning-20261028.json');
 if(review.task!==TASK||review.authorization!==AUTHORIZATION||review.author.id!==AUTHOR||review.reviewer.id===AUTHOR)throw Error('Invalid authorized independent review');
 if(!review.evidence.path.startsWith('experiences/topik-items/review/reports/')||digest(fs.readFileSync(path.join(root,review.evidence.path),'utf8'))!==review.evidence.sha256)throw Error('Missing durable reviewer evidence');
 for(const round of review.rounds||[]){if(!round.reviewer?.id||round.reviewer.id===AUTHOR||!round.evidence?.path?.startsWith('experiences/topik-items/review/reports/')||round.evidence.path.includes('..')||digest(fs.readFileSync(path.join(root,round.evidence.path),'utf8'))!==round.evidence.sha256)throw Error('Missing cumulative independent evidence');}
 const units=currentUnits();
 for(const unit of units){const record=review.results.find(r=>r.id===unit.id),allowed=review.allowlist.find(r=>r.id===unit.id);if(!record||record.hash!==unit.hash||record.verdict!=='pass'||allowed?.hash!==unit.hash||allowed.file!==unit.file)throw Error(`Unreviewed current content ${unit.id}`);}
 const clips=read('experiences/order-rush/additional-audio.json').clips,audioProof=read('experiences/order-rush/qa/transfer-audio-check.json');
 for(const item of ADDITIONAL_ORDERS){const clip=clips[item.id],proof=audioProof.items.find(i=>i.id===item.id),played=audioProof.browser.find(i=>i.id===item.id);if(!clip||clip.status!=='ready'||!proof||proof.sourceText!==item.text||proof.similarity!==1||proof.sha256!==clip.sha256||played?.state!=='ready')throw Error(`Unverified audio ${item.id}`);
  // Binary audio bytes are hashed directly, not through the structured unit hash helper.
  const file=path.join(root,'experiences/order-rush',clip.file);
  if(!fs.existsSync(file)||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==clip.sha256)throw Error(`Missing or changed audio ${item.id}`);
 }
 const inventory=[];
 const add=(items,role,source)=>{for(const item of items){let row=inventory.find(r=>r.source===source&&r.skillId===item.skillId&&r.difficulty===item.difficulty&&r.responseFormat===item.responseFormat&&r.role===role);if(!row){row={source,skillId:item.skillId,difficulty:item.difficulty,responseFormat:item.responseFormat,role,families:[]};inventory.push(row);}if(!row.families.includes(item.familyKey))row.families.push(item.familyKey);}};
 add([...ORDERS,...REVIEW].map(orderMetadata),'practice','order-rush');add(DELAYED_ORDERS.map(orderMetadata),'delayed','order-rush');
 add(supplementalItems(),'practice','korean-rhythm');add(supplementalItems({purpose:'delayed',seen:()=>false}),'delayed','korean-rhythm');
 for(const row of [...inventory].filter(r=>r.role==='practice'))if(!inventory.some(r=>r.source===row.source&&r.skillId===row.skillId&&r.difficulty===row.difficulty&&r.responseFormat===row.responseFormat&&r.role==='delayed'))inventory.push({...row,role:'delayed',families:[]});
 return {reviewedUnits:units.length,publicOrdinaryItems:publicTopikBank().items.length,reservedOriginalItems:publicFollowupBank().items.length,
  inventory:inventory.map(({families,...row})=>({...row,independentSourceFamilies:families.length,minimum:row.role==='delayed'?2:4,shortage:Math.max(0,(row.role==='delayed'?2:4)-families.length)}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(checkContentSupply(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
