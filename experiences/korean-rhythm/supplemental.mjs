// Supplemental listening keeps the original source family across four-choice and O/X tasks.
// Song charts and their narration timing stay separate from this untimed practice.
import supply from './supplemental.json' with {type:'json'};
import {HOLDOUT} from '../topik-items/holdout.mjs';
function presented(item){
 const itemKey=`korean-rhythm.${item.id}.v${item.rev}`;
 return Object.freeze({id:item.id,itemKey,familyKey:item.familyKey,setId:item.setId||null,
  skillId:item.skillId,difficulty:item.difficulty,modality:'listening',responseFormat:'binary-choice',audioRequired:true,confounded:false,
  conceptIds:[...(item.conceptIds||[])],source:'korean-rhythm',sourceItemKey:item.sourceItemKey,supplyRole:item.role,
  audio:`topik-items/${item.audio.file}`,plays:item.audio.plays,seconds:item.audio.seconds,
  script:item.script,prompt:null,question:`다음 설명이 대화의 내용과 맞나요?\n${item.claim}`,
  choices:[{id:`${itemKey}.O`,label:'O · 맞아요'},{id:`${itemKey}.X`,label:'X · 달라요'}],
  correctId:`${itemKey}.${item.answer}`,explanation:{ko:item.explanation},choiceNotes:[],label:item.claim,
  exposurePeers:HOLDOUT.find(row=>row.sourceItemId===item.sourceItemId)?.exposurePeers||[{itemKey:item.sourceItemKey,familyKey:item.familyKey}]});
}
export function supplementalItems({purpose='practice',seen,skillId,difficulty}={}){
 if(!['practice','delayed'].includes(purpose))throw TypeError('unknown supplemental purpose');
 const pool=supply.items.filter(item=>item.review?.status==='passed'&&item.role===purpose&&item.audio?.status==='ready')
  .filter(item=>(!skillId||item.skillId===skillId)&&(difficulty==null||item.difficulty===difficulty)).map(presented);
 if(purpose==='practice')return Object.freeze(pool);
 if(typeof seen!=='function')return Object.freeze([]);
 return Object.freeze(pool.filter(item=>{
  try{return seen(item)===false&&item.exposurePeers.every(peer=>seen(peer)===false);}catch{return false;}
 }));
}
