// Product projection of Temper's observation windows. No second schedule, grade or event log.
const seenFalse=(seen,item)=>{try{return seen(item)===false&&(item.exposurePeers||[]).every(peer=>seen(peer)===false);}catch{return false;}};
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
export function followupRows({projection,pool=[],seen,taskVersion,audioAvailable=true}={}){
 if(!projection||!Array.isArray(projection.items)||typeof seen!=='function')return {available:false,limited:true,rows:[]};
 const limited=projection.evidenceComplete!==true||projection.coverage?.limited===true||projection.coverage?.retentionLimited===true;
 const rows=projection.items.filter(row=>row.gameId==='world-practice').map(row=>{
  const m=row.measure||{};
  const candidates=!limited&&row.status==='due'&&m.taskVersion===taskVersion&&(!m.audioRequired||audioAvailable)?pool.filter(item=>
   item.skillId===m.skillId&&item.difficulty===m.difficulty&&item.responseFormat===m.responseFormat&&item.modality===m.modality&&
   (item.audioRequired??item.modality==='listening')===m.audioRequired&&seenFalse(seen,item)&&
   (!item.setId||pool.filter(peer=>peer.setId===item.setId).every(peer=>seenFalse(seen,peer)))):[];
  // Reserving supply protects opportunities; the exact first later attempt is still chosen by Temper.
  candidates.sort((a,b)=>Number(b.supplyRole==='delayed')-Number(a.supplyRole==='delayed')||hash(row.id+a.itemKey)-hash(row.id+b.itemKey));
  return {...row,item:candidates[0]||null,available:candidates.length>0};
 });
 return {available:true,limited,rows:rows.sort((a,b)=>Number(b.status==='due')-Number(a.status==='due')||Date.parse(a.dueAt)-Date.parse(b.dueAt)).slice(0,12)};
}
export function advisoryRows({targets=[],summary,lookup,supply={}}={}){
 if(summary?.evidenceComplete!==true||typeof lookup!=='function')return [];
 const skills=new Map((summary.skills||[]).map(row=>[row.id,row])),out=[],seen=new Set();
 for(const target of targets){for(const suggestion of lookup(target)||[]){
  const id=suggestion.node?.id;if(!id||suggestion.blocking!==false||suggestion.reviewed!==true||seen.has(id)||!(supply[id]>0)||skills.get(id)?.status==='recent-independent')continue;
  seen.add(id);out.push({id,target,basis:suggestion.basis,reason:suggestion.reason_ko});
 }}
 return out.slice(0,3);
}
