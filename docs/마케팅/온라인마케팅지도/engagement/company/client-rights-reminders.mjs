import {clientMaterialSourceVisible} from './client-material-usage.mjs';
const DAY=86400000;
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export const clientRightsSourceVisible=clientMaterialSourceVisible;

// Consume the current, permission-checked rights view. Unrecorded materials,
// superseded files and consent bound to a different source never create tasks.
export function buildClientRightsReminders(workspace){
  if(!workspace||!validDay(workspace.today)||!Array.isArray(workspace.items))throw new TypeError('사용 기간 기록을 읽지 못했어요.');
  const todayAt=Date.parse(workspace.today+'T00:00:00Z'),targets=[],items=[];
  for(const target of workspace.items){
    const record=target.record;
    if(!target.available||target.current===false||!target.appliesToCurrent||target.kind==='material'&&target.referenceOnly===true||record?.status!=='allowed'||record.expiryMode!=='date'||!validDay(record.expiresAt))continue;
    const daysRemaining=Math.round((Date.parse(record.expiresAt+'T00:00:00Z')-todayAt)/DAY),status=daysRemaining<0?'expired':daysRemaining===0?'due':'upcoming';
    const entry={targetId:target.targetId,label:target.label,kind:target.kind,recordId:record.id,sourceFingerprint:target.sourceFingerprint,expiresAt:record.expiresAt,recordedAt:record.recordedAt,daysRemaining,status,statusLabel:daysRemaining<0?'기간 지남':daysRemaining===0?'오늘까지':`${daysRemaining}일 뒤 끝남`};
    targets.push(entry);if(daysRemaining<=7)items.push(entry);
  }
  items.sort((a,b)=>a.expiresAt.localeCompare(b.expiresAt)||a.targetId.localeCompare(b.targetId));
  return {projectId:workspace.projectId,projectRevision:workspace.projectRevision,revision:workspace.revision,today:workspace.today,generatedAt:workspace.generatedAt,targets:targets.length,items,lastResultAt:targets.map(target=>target.recordedAt).filter(Boolean).sort().at(-1)||null,nextDueAt:targets.filter(target=>target.daysRemaining>7).map(target=>new Date(Date.parse(target.expiresAt+'T00:00:00+09:00')-7*DAY).toISOString()).sort()[0]||null};
}
