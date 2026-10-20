'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const clean=(value,max=400)=>String(value||'').replace(/<!--[^]*?-->/g,'').replace(/[`*<>]/g,'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
function nextAction(text){
  const markers=[...String(text).matchAll(/(?:남은\s*(?:것|일)|다음\s*(?:할 일|단계)|후속(?:\s*확인)?|유호님\s*차례)(?:\s*\([^)]*\))?\s*[:：]/g)];
  if(!markers.length)return null;
  const marker=markers.at(-1),value=text.slice(marker.index+marker[0].length).trim();
  return clean(value.split(/\n(?=\s*(?:-|\*\*|#))/)[0]);
}
function references(root,text){
  const result=[],seen=new Set();
  for(const match of String(text).matchAll(/\[([^\]]{1,120})\]\(([^)\s]+)\)/g)){
    const [_,label,reference]=match;if(seen.has(reference)||result.length>=8)continue;seen.add(reference);
    if(/^https:\/\//i.test(reference)){
      try{const u=new URL(reference);if(u.username||u.password||[...u.searchParams.keys()].some(k=>/token|key|secret|auth/i.test(k)))continue;
        result.push({label:clean(label,120),reference:u.href,kind:'remote',state:'not_checked'});}catch{}continue;
    }
    if(/^[a-z]+:|^[/\\]|(?:^|[/\\])(?:\.env|[^/\\]*(?:token|credential|secret)[^/\\]*)(?:[/\\]|$)/i.test(reference))continue;
    try{
      const location=decodeURIComponent(reference.split('#')[0]),absolute=path.resolve(root,'docs/_ops',location),relative=path.relative(root,absolute);
      if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))continue;
      let state='missing';try{const real=fs.realpathSync(absolute),rel=path.relative(fs.realpathSync(root),real);if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))continue;state=fs.statSync(real).isFile()?'present':'directory';}catch{}
      result.push({label:clean(label,120),reference:relative.replace(/\\/g,'/'),kind:'local',state});
    }catch{}
  }
  return result;
}
function runView(row){
  const proof=row.integrationReceipt,verified=proof?.verified===true&&!row.needsAttention&&['integrated','no_changes'].includes(row.integration);
  const stage=row.needsAttention||row.attention?'판단·조치 대기':verified?(row.integration==='integrated'?'원본 반영 확인':'변경 없음 확인'):
    row.finalizationState==='validating'?'검증 중':row.finalizationState==='integrating'?'원본 반영 중':
    row.state==='exited'?'실행 종료 · 완료 근거 미확인':['running','launching','prepared'].includes(row.state)?'실행 중':'실행 상태 확인 필요';
  const evidence=[];
  if(row.validationReceipt)evidence.push({label:'검증 '+({passed:'통과',no_changes:'변경 없음',needs_attention:'확인 필요'}[row.validationReceipt.status]||'상태 미확인'),reference:`runtime/synk-tasks/${row.id}/validation.json`,kind:'receipt',state:row.validationReceipt.status});
  if(proof)evidence.push({label:verified?'원본 반영 대조 확인':'원본 반영 확인 필요',reference:`runtime/synk-tasks/${row.id}/integration.json`,kind:'receipt',state:verified?'verified':'unverified'});
  const times=[proof?.completedAt,row.createdAt].filter(value=>typeof value==='string'&&Number.isFinite(Date.parse(value))).map(value=>new Date(value).toISOString()).sort();
  return {id:row.id,owner:row.engine==='claude'?'Claude':'Codex',stage,verified,at:times.at(-1)||null,
    nextAction:row.attention?.summary||row.integrationReceipt?.reasonCode||row.validationReceipt?.reasonCode||null,evidence};
}
function operationsStatus({root,pending=[],taskRecords={available:false,items:[]},modifiedAt=null}={}){
  const runs=(taskRecords.items||[]).map(runView),byId=new Map(runs.map(row=>[row.id,row]));
  const items=pending.map(row=>{
    const linked=[...new Set([...String(row.text).matchAll(/\bsynk-[a-f0-9]{12}\b/g)].map(m=>m[0]))].map(id=>byId.get(id)).filter(Boolean)
      .sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||a.id.localeCompare(b.id));
    const latest=linked.filter(run=>run.at===linked[0]?.at);
    const linkedStage=linked.some(run=>!run.at)?'실행 순서 미확인':
      latest.find(run=>run.stage==='판단·조치 대기')?.stage||latest.find(run=>!run.verified)?.stage||linked[0]?.stage;
    const next=nextAction(row.text),owner=clean(row.owner,80)||'원문에서 확인';
    return {id:'track-'+crypto.createHash('sha256').update(row.heading+'\n'+row.title).digest('hex').slice(0,16),
      title:clean(row.title,220),owner,stage:linked.length?linkedStage:owner.includes('유호')?'선택·확인 대기 기록':next?'후속 작업 기록':'현재 단계 미확인',
      nextAction:next,decision:owner.includes('유호')?next||'트랙 원문에서 요청한 선택·확인을 확인하세요.':null,
      evidence:references(root,row.text),runs:linked,source:{file:'docs/_ops/트랙.md',line:row.line,modifiedAt},
      note:'원문 기록이며 링크의 존재와 실제 완료는 구분합니다.'};
  });
  return {items,runs,runSourceAvailable:taskRecords.available===true,runSourceComplete:taskRecords.complete===true,
    counts:{items:items.length,decisions:items.filter(row=>row.decision).length,runs:runs.length},
    scope:'담당과 다음 일은 트랙 원문, 실행·검증·원본 반영은 기존 영수증에서 읽습니다. 세션 종료를 사업 완료로 바꾸지 않습니다.'};
}
module.exports={operationsStatus,nextAction,references,runView};
