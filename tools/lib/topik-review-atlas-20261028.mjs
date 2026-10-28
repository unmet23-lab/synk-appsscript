// A single user-authorized review exception; no model runner and no general policy switch.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {BASE_ORDERS,ADDITIONAL_ORDERS,REVIEW,judgeOrder,makeCup} from '../../experiences/order-rush/core.mjs';
import {orderMetadata} from '../../experiences/order-rush/learning.mjs';
import {ALL_ITEMS} from '../../experiences/topik-items/bank.mjs';
export const TASK='atlas-world-learning-20261028';
export const AUTHOR='/root/support_engines_review';
export const AUTHORIZATION='2026-10-28 사용자가 이번 Atlas·WORLD·학습 보완 작업에 GPT 구현 및 작성자와 다른 GPT의 독립 검수 예외를 명시 승인했다. 일반 Claude·Argon 문항 검수 정책은 유지한다.';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'.tmp',TASK,'content-review');
const rels={relations:'strata/topik-i.recommendations.json',supplemental:'experiences/korean-rhythm/supplemental.json',orders:'experiences/order-rush/core.mjs',additional:'experiences/order-rush/additional-orders.json'};
const output='experiences/topik-items/review/atlas-world-learning-20261028.json';
const read=rel=>JSON.parse(fs.readFileSync(path.resolve(root,rel),'utf8'));
const write=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const omitReview=({review,reviewed,...value})=>value;
const sourceHash=item=>digest(item);
export function orderReviewUnit(order){
 const meta=orderMetadata(order);
 return {id:meta.itemKey,kind:'cup-compose',file:order.role?rels.additional:rels.orders,meta,
  content:{text:order.text,skill:order.skill,cups:order.cups,meta,
   responseContract:'컵 1~2개를 조립한다. base coffee/tea, milk·ice·sugar boolean, temp hot/cold. 명시되지 않은 설탕·얼음은 자유이며 컵 순서는 자유다. 다른 음료명·컵수는 추측하지 않는다.',
   officialTypeClaim:'공식 TOPIK 유형이 아닌 듣고 주문을 수행하는 컵 조립 연습이다.'}};
}
export function currentUnits(){
 const relations=read(rels.relations).edges.map(e=>({id:e.id,kind:'recommended-before',file:rels.relations,content:omitReview(e)}));
 const supplemental=read(rels.supplemental).items.map(i=>({id:i.id,kind:'binary-choice',file:rels.supplemental,content:omitReview(i)}));
 const bank=new Map(ALL_ITEMS.map(i=>[i.id,i]));
 for(const u of supplemental){const i=bank.get(u.content.sourceItemId);if(!i||i.reviewStatus!=='ai-reviewed'||sourceHash(i)!==u.content.sourceHash)throw Error(`changed source: ${u.id}`);}
 return [...relations,...supplemental,...[...BASE_ORDERS,...REVIEW,...ADDITIONAL_ORDERS].map(orderReviewUnit)].map(unit=>({...unit,hash:digest(unit.content)}));
}
export function blindUnit(unit){
 const {answer,explanation,cups,...content}=unit.content;
 return {id:unit.id,hash:unit.hash,kind:unit.kind,content};
}
export function prepareException(){
 const prior=fs.existsSync(path.resolve(root,output))?read(output):null;
 const units=currentUnits().filter(unit=>!prior?.results.some(row=>row.id===unit.id&&row.hash===unit.hash&&row.verdict==='pass'));
 if(!units.length)throw Error('No changed or unreviewed units');
 const allowlist=units.map(({id,kind,file,hash})=>({id,kind,file,hash}));
 const manifest={task:TASK,authorization:AUTHORIZATION,author:{id:AUTHOR,model:'GPT (Codex session; exact model identifier not exposed)'},allowlist};
 const packet={...manifest,packetHash:digest(manifest),units};
 const previousPacket=path.join(dir,'packet.json');
 if(fs.existsSync(previousPacket)){const old=read(previousPacket);write(path.join(dir,`packet-${old.packetHash}.json`),old);}
 write(path.join(dir,'packet.json'),packet);
 write(path.join(dir,'blind.json'),{task:TASK,packetHash:packet.packetHash,instructions:'작성자와 다른 검수자가 정답을 보기 전에 푼다. OX는 solved O/X, 컵은 solved에 컵 배열, 권장관계는 source scope와 해석 분리·비차단·직접목표 타당성만 판정. 그 다음 full packet과 비교해 검수한다. 반례·모호함·능력/난도 불일치를 고친다.',units:units.map(blindUnit)});
 return {packet:path.relative(root,path.join(dir,'packet.json')),blind:path.relative(root,path.join(dir,'blind.json')),packetHash:packet.packetHash,units:units.length};
}
const REQUIREMENTS={
 'binary-choice':['answer_unique','naturalness','skill_fit','difficulty_fit','explanation','family_preserved','audio_source_unchanged'],
 'cup-compose':['answer_unique','naturalness','skill_fit','difficulty_fit','response_contract','no_official_type_claim'],
 'recommended-before':['source_scope','interpretation_separate','nonblocking','direct_target','no_required_order_claim'],
};
export function validateException(packet,result,{units=currentUnits(),readEvidence=rel=>fs.readFileSync(path.resolve(root,rel))}={}){
 const {packetHash,units:ignored,...manifest}=packet;
 if(packet.task!==TASK||packet.authorization!==AUTHORIZATION||packet.author?.id!==AUTHOR||digest(manifest)!==packetHash)throw Error('invalid fixed authorization manifest');
 if(result.task!==TASK||result.packetHash!==packetHash||!result.reviewer?.id||result.reviewer.id===AUTHOR||!result.reviewer?.model||!Number.isFinite(Date.parse(result.reviewedAt)))throw Error('independent reviewer metadata required');
 if(!Array.isArray(result.results)||result.results.length!==packet.units.length)throw Error('incomplete review results');
 const evidencePath=result.evidence?.path;
 if(typeof evidencePath!=='string'||!evidencePath.startsWith(`.tmp/${TASK}/`)||evidencePath.includes('..'))throw Error('review evidence must be in task folder');
 const evidence=readEvidence(evidencePath);
 if(!evidence.length||digest(evidence.toString())!==result.evidence.sha256)throw Error('missing or changed reviewer evidence');
 const live=new Map(units.map(u=>[u.id,u])),seen=new Set();
 for(const row of result.results){
  const unit=packet.units.find(u=>u.id===row.id),allowed=packet.allowlist.find(u=>u.id===row.id);
  if(!unit||seen.has(row.id)||!allowed||allowed.file!==unit.file||allowed.kind!==unit.kind||allowed.hash!==unit.hash||digest(unit.content)!==unit.hash||live.get(row.id)?.hash!==unit.hash||row.hash!==unit.hash)throw Error(`stale or unapproved unit ${row.id}`);
  seen.add(row.id);
  if(!['pass','fix','drop'].includes(row.verdict)||typeof row.reason!=='string'||!row.reason.trim())throw Error(`verdict evidence required ${row.id}`);
  if(row.verdict!=='pass')continue;
  if(REQUIREMENTS[unit.kind].some(check=>row.checks?.[check]!==true))throw Error(`incomplete criteria ${row.id}`);
  if(unit.kind==='binary-choice'&&row.solved!==unit.content.answer)throw Error(`blind answer differs ${row.id}`);
  if(unit.kind==='cup-compose'){
   if(!Array.isArray(row.solved)||!row.solved.length||row.solved.some(c=>!['coffee','tea'].includes(c.base)||!['hot','cold'].includes(c.temp)||['milk','ice','sugar'].some(k=>typeof c[k]!=='boolean')||c.temp==='hot'&&c.ice))throw Error(`invalid blind cups ${row.id}`);
   if(!judgeOrder({cups:unit.content.cups},row.solved.map(c=>({...makeCup(),...c}))).correct)throw Error(`blind cups differ ${row.id}`);
  }
 }
 return true;
}
export function applyException(resultFile){
 const packet=read(path.join(dir,'packet.json')),result=read(resultFile);
 validateException(packet,result);
 const prior=fs.existsSync(path.resolve(root,output))?read(output):null;
 const byId=new Map([...(prior?.results||[]),...result.results].map(r=>[r.id,r]));
 const recordFor=id=>{const r=byId.get(id);return {status:r.verdict==='pass'?'passed':'held',task:TASK,hash:r.hash,reviewer:r.reviewer?.id||result.reviewer.id,evidence:output};};
 const relations=read(rels.relations);for(const edge of relations.edges){edge.review=recordFor(edge.id);edge.reviewed=edge.review.status==='passed';}
 const supplemental=read(rels.supplemental);for(const item of supplemental.items)item.review=recordFor(item.id);
 const additional=read(rels.additional);for(const item of additional.items)item.review=recordFor(orderMetadata(item).itemKey);
 // The ordinary Claude/Argon item reviews and existing verdict file are never overwritten.
 const durableEvidence=`experiences/topik-items/review/reports/${TASK}-${packet.packetHash.slice(0,12)}-independent.md`;
 fs.mkdirSync(path.dirname(path.resolve(root,durableEvidence)),{recursive:true});
 fs.copyFileSync(path.resolve(root,result.evidence.path),path.resolve(root,durableEvidence));
 const round={packetHash:packet.packetHash,reviewer:result.reviewer,reviewedAt:result.reviewedAt,evidence:{...result.evidence,path:durableEvidence},unitIds:result.results.map(r=>r.id)};
 const previousRounds=prior?.rounds|| (prior?[{packetHash:prior.packetHash,reviewer:prior.reviewer,reviewedAt:prior.reviewedAt,evidence:prior.evidence,unitIds:prior.results.map(r=>r.id)}]:[]);
 const previousResults=(prior?.results||[]).map(row=>({...row,reviewer:row.reviewer||prior.reviewer,reviewedAt:row.reviewedAt||prior.reviewedAt}));
 const results=[...new Map([...previousResults,...result.results.map(row=>({...row,reviewer:result.reviewer,reviewedAt:result.reviewedAt}))].map(row=>[row.id,row])).values()];
 const allowlist=[...new Map([...(prior?.allowlist||[]),...packet.allowlist].map(row=>[row.id,row])).values()];
 write(path.resolve(root,output),{...result,evidence:round.evidence,authorization:packet.authorization,author:packet.author,results,allowlist,rounds:[...previousRounds.filter(r=>r.packetHash!==round.packetHash),round]});
 write(path.resolve(root,rels.relations),relations);write(path.resolve(root,rels.supplemental),supplemental);write(path.resolve(root,rels.additional),additional);
 return {passed:result.results.filter(r=>r.verdict==='pass').length,held:result.results.filter(r=>r.verdict!=='pass').length,output};
}
export async function exceptionCommand(command,name,args){
 if(name!==TASK)throw Error(`Only the approved task ${TASK} is supported`);
 if(command==='예외준비')return prepareException();
 if(command==='예외반영'&&args.length===1&&args[0]==='town-tea-fixed')return (await import('./topik-review-atlas-tea-20261028.mjs')).applyTeaException();
 if(command==='예외반영'){if(args.length!==1)throw Error('review result JSON path required');return applyException(args[0]);}
 throw Error('unknown exception command');
}
