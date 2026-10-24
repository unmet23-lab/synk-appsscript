'use strict';
const {EMAIL}=require('./subscription-common.cjs');
// 한 번에 한 계정만 읽히는 공급자의 식별·숨김·결과 배분을 소유한다.
// 저장 필드와 안내 문구는 공급자 정책에서 받으므로 계정판/로그인에는 공급자 이름 분기가 없다.
function createSharedAccounts({service,policy,load,now,applyRead,addRow}){
  const rows=()=>load().rows.filter(row=>row.source==='auto'&&row.service===service);
  const hidden=()=>{const list=load().settings?.[policy.hiddenKey];return Array.isArray(list)?list.filter(e=>typeof e==='string'&&EMAIL.test(e)).map(e=>e.toLowerCase()).slice(0,policy.hiddenMax):[];};
  const setHidden=list=>{const board=load();board.settings={...board.settings,[policy.hiddenKey]:[...new Set(list)].slice(0,policy.hiddenMax)};};
  function reconnect(email){if(email&&hidden().includes(email))setHidden(hidden().filter(e=>e!==email));}
  function remove(row){if(row.source==='auto'&&row.email){const lower=String(row.email).toLowerCase();setHidden([lower,...hidden().filter(e=>e!==lower)]);}}
  function apply(result){
    if(!result)return;
    const away=(row,reason)=>{row.state='elsewhere';row.awayReason=reason;row.stateMessage=reason==='none'?policy.nobodyMessage:policy.awayMessage;row.stateAt=now();};
    if(result.email){
      const lower=String(result.email).toLowerCase(),known=rows().find(row=>String(row.email||'').toLowerCase()===lower);
      const target=known||(hidden().includes(lower)?null:addRow(service,null,{email:result.email}));
      if(target)applyRead(target,result);
      for(const row of rows())if(row!==target)away(row,null);
      return;
    }
    const all=rows(),maybe=all.filter(row=>row.state!=='elsewhere');
    if(result.state==='ok'){
      if(all.length===1&&maybe.length===1){applyRead(all[0],result);return;}
      for(const row of maybe)applyRead(row,{state:'error',message:policy.unknownMessage});
      return;
    }
    for(const row of maybe)applyRead(row,result);
    if(result.state==='needs-login')for(const row of all)if(row.state==='elsewhere')away(row,'none');
  }
  return {rows,reconnect,remove,apply};
}
// 실제 읽기 하나가 책임지는 줄과 진행 수를 함께 결정한다. 공유 로그인은 첫 줄 위치에서 한 번만 읽는다.
function groupSubscriptionReads(targets,rows,shared){
  const groups=[],seen=new Set(),covered=new Set(targets.map(row=>row.id));
  for(const row of targets){
    const owner=Object.hasOwn(shared,row.service)?shared[row.service]:null;
    if(!owner){groups.push({row,count:1,owner:null});continue;}
    if(seen.has(row.service))continue;
    seen.add(row.service);
    for(const other of rows)if(other.source==='auto'&&other.service===row.service)covered.add(other.id);
    groups.push({service:row.service,count:targets.filter(other=>other.service===row.service).length,owner});
  }
  return {groups,covered};
}
module.exports={createSharedAccounts,groupSubscriptionReads};
