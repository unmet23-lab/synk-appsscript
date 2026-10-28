// The already reviewed Town packet is a fixed extension of one user-authorized task.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {TASK,AUTHORIZATION,digest} from './topik-review-atlas-20261028.mjs';
import {teaReviewUnit,stableTeaReview,TEA_JUDGE} from './town-tea-review-unit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=`.tmp/${TASK}/tea-content-review`;
const OUTPUT=`experiences/topik-items/review/${TASK}-tea.json`;
const PACKET_SHA='76a6ee9df5d6714d9e75c4212146417af620273784467f9602dd7e9bf31550fc';
const AUTHOR='/root/world_integration_review',REVIEWER='/root';
const read=file=>fs.readFileSync(path.resolve(root,file),'utf8');
const model='GPT (Codex session; exact model identifier not exposed)';
const teaReviewHash=value=>digest(stableTeaReview(value));
const checks=['naturalness','explicitAxesOnly','l1l2Equivalent','sameTeaRequiresVisiblePrior','familyPreserved','noOfficialTypeClaim','helpSeparated'];
export function validateTeaException({packetRaw=read(`${dir}/full.json`),result=JSON.parse(read(`${dir}/root-result.json`)),blindRaw=read(`${dir}/blind-all.json`),solved=JSON.parse(read(`${dir}/root-blind-solved.json`)),readSource=read}={}){
 if(digest(packetRaw)!==PACKET_SHA||result.packetSha256!==PACKET_SHA)throw Error('Changed fixed Town review packet');
 const packet=JSON.parse(packetRaw);
 if(result.task!==TASK||result.author!==AUTHOR||result.reviewer!==REVIEWER||result.author===result.reviewer||result.verdict!=='pass'||result.remainingBlocking!==0||checks.some(k=>result.checks?.[k]!==true))throw Error('Independent Town review required');
 if(solved.reviewer!==REVIEWER||solved.phase!=='before-full-answer-access'||solved.blindSha256!==digest(blindRaw)||!Number.isFinite(Date.parse(solved.at))||!(Date.parse(result.reviewedAt)>Date.parse(solved.at)))throw Error('Missing blind Town evidence');
 if(packet.source.lines!=='experiences/synk-town/town/data/lines/tea.json'||packet.source.axes!=='experiences/synk-town/town/data/tea.json')throw Error('Town sources outside fixed scope');
 const linesRaw=readSource(packet.source.lines),axesRaw=readSource(packet.source.axes);
 if(digest(linesRaw)!==packet.source.linesHash||digest(axesRaw)!==packet.source.axesHash||teaReviewHash(packet.judge)!==teaReviewHash(TEA_JUDGE))throw Error('Changed Town source or judge contract');
 const lines=JSON.parse(linesRaw),axes=JSON.parse(axesRaw).axes;
 if(packet.units.length!==12||result.results?.length!==12||result.frames!==12||result.expandedCases!==152||result.acceptedAlternativeChecks!==2736)throw Error('Incomplete Town review');
 const answers=new Map(solved.items.map(row=>[row.id,row]));let count=0;
 if(answers.size!==152||solved.items.length!==152||new Set(result.results.map(r=>r.id)).size!==12)throw Error('Incomplete or duplicated Town evidence');
 for(const entry of packet.units){
  const frame=lines.find(l=>l.id===entry.unit.frame),row=result.results.find(r=>r.id===entry.unit.frame);
  if(!frame||frame.when.part!=='request'||teaReviewHash(teaReviewUnit(frame,axes))!==entry.unitHash||teaReviewHash(entry.unit)!==entry.unitHash||row?.hash!==entry.unitHash||row.verdict!=='pass'||JSON.stringify(row.levels)!=='["L1","L2"]')throw Error(`Stale or unapproved Town frame ${entry.unit.frame}`);
  for(const c of entry.cases){const answer=answers.get(c.id);if(!answer||answer.unspecified!=='free'||teaReviewHash(answer.solved)!==teaReviewHash(c.expected))throw Error(`Blind Town answer differs ${c.id}`);count++;}
 }
 if(count!==152)throw Error('Incomplete Town cases');
 return {packet,result};
}
export function applyTeaException(){
 const {packet,result}=validateTeaException();
 const evidence=['full.json','blind-all.json','root-blind-solved.json','root-result.json'].map(file=>{
  const data=read(`${dir}/${file}`),target=`experiences/topik-items/review/reports/${TASK}-tea-${file}`;
  fs.mkdirSync(path.dirname(path.resolve(root,target)),{recursive:true});fs.writeFileSync(path.resolve(root,target),data);
  return {path:target,sha256:digest(data)};
 });
 const output={task:TASK,authorization:AUTHORIZATION,author:{id:AUTHOR,model},reviewer:{id:REVIEWER,model},packetSha256:PACKET_SHA,reviewedAt:result.reviewedAt,source:packet.source,judge:packet.judge,evidence,
  results:result.results,limitations:result.limitations};
 fs.writeFileSync(path.resolve(root,OUTPUT),JSON.stringify(output,null,2)+'\n');
 return {passed:output.results.length,levels:['L1','L2'],expandedCases:152,output:OUTPUT};
}
