import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const kinds={'video/mp4':'video','video/webm':'video','image/png':'image','image/jpeg':'image','application/x-subrip':'subtitle','text/vtt':'subtitle'};
const formats={'video/mp4':'mp4','video/webm':'webm','image/png':'png','image/jpeg':'jpg','application/x-subrip':'srt','text/vtt':'vtt'};
const labels={not_configured:'납품 규격 없음',waiting_confirmation:'규격 고객 확인 전',needs_check:'검사 전',attention:'없거나 안 맞는 파일 있음',manual:'직접 볼 것 있음',ready:'검사 통과',archived:'보관함',existing_delivery:'전에 올린 최종본'};
const active=draft=>(draft?.items||[]).filter(item=>!item.removed);
const specification=row=>row.studio?.deliverables||{revision:0,items:[]};
const preview=row=>(row.versions||[]).filter(version=>version.kind==='preview').at(-1);
const confirmedSpec=row=>{const spec=specification(row);return !!spec.revision&&spec.items?.length>0&&spec.confirmation?.deliverableRevision===spec.revision;};
const identity=item=>({id:item.id,requirementId:item.requirementId,deliverableItemId:item.deliverableItemId||'',versionId:item.versionId||'',source:item.source,media:item.media?{id:item.media.id,diskName:item.media.diskName,mimeType:item.media.mimeType,byteSize:item.media.byteSize}:null,url:item.url||''});
const itemKind=(draft,item)=>item.media?kinds[item.media.mimeType]||'unknown':draft.requirements?.find(value=>value.id===item.requirementId)?.kind||'unknown';
const safeSpec=item=>({id:item.id,label:item.label||'납품 항목',kind:item.kind,quantity:item.quantity||1,durationSeconds:item.durationSeconds??null,aspectRatio:item.aspectRatio||'',subtitles:item.subtitles||'',fileFormat:item.fileFormat||'',language:item.language||''});

export function deliveryCheckFingerprint(row,draft){const latest=preview(row),spec=specification(row);return hash({projectId:row.id,preview:latest?{id:latest.id,approvedAt:latest.approvedAt||null}:null,approvedPreviewId:draft.approvedPreviewId,specification:{revision:spec.revision,confirmation:spec.confirmation?.deliverableRevision||null,items:spec.items||[]},requirements:draft.requirements||[],items:active(draft).map(identity)});}
export function deliveryCheckMedia(draft){return [...new Map(active(draft).filter(item=>item.media).map(item=>[item.media.id,item.media])).values()];}
export function deliveryItemConfirmationKey(row,draft,item,inspection){const fingerprint=deliveryCheckFingerprint(row,draft),current=inspection?.fingerprint===fingerprint,probe=current?inspection.results?.[item.media?.id]:null;return hash({specificationRevision:specification(row).revision,approvedPreviewId:draft.approvedPreviewId,item:identity(item),probe:item.media?(probe?{status:probe.status,code:probe.code||'',sha256:probe.sha256||'',metadata:probe.metadata||null}:null):null});}
export function deliveryItemConfirmed(row,draft,item,inspection){return item.confirmed===true&&(!confirmedSpec(row)||item.confirmationToken===deliveryItemConfirmationKey(row,draft,item,inspection));}

export function buildDeliveryCheck(row,draft,{inspection=null,now=new Date().toISOString(),canInspect=false}={}){
  const spec=specification(row),isConfirmed=confirmedSpec(row),items=active(draft),fingerprint=deliveryCheckFingerprint(row,draft),local=deliveryCheckMedia(draft),inspectionCurrent=!local.length||inspection?.fingerprint===fingerprint;
  const checks=[],add=(id,label,status,text,extra={})=>checks.push({id,label,status,text,...extra});
  const result={specificationRevision:spec.revision||0,confirmed:isConfirmed,items:(spec.items||[]).map(safeSpec),fingerprint,inspectionCurrent,checkedAt:inspection?.checkedAt||'',calculatedAt:now,canInspect:!!canInspect&&!!draft.approvedPreviewId&&isConfirmed,inspectReason:!isConfirmed?'고객이 납품 규격을 확인하면 검사를 시작해요.':!draft.approvedPreviewId?'고객이 최신 시안을 먼저 승인해야 해요.':!canInspect?'담당자가 검사를 다시 돌릴 수 있어요.':'',checks};
  if(!items.length&&draft.approvedPreviewId&&(row.versions||[]).some(version=>version.kind==='final'&&version.approvedPreviewId===draft.approvedPreviewId))return {...result,status:'existing_delivery',statusLabel:labels.existing_delivery,canInspect:false,canPublish:false,pendingCount:0,blockingCount:0,manualCount:0,inspectReason:'납품 준비를 거치지 않고 올린 최종본이에요. 「시안과 최종본」과 PULSE 규격 연결을 봐 주세요.'};
  if(!spec.revision||!spec.items?.length)return {...result,status:'not_configured',statusLabel:labels.not_configured,pendingCount:0,blockingCount:0,manualCount:0,canPublish:true};
  if(!isConfirmed)return {...result,status:'waiting_confirmation',statusLabel:labels.waiting_confirmation,pendingCount:0,blockingCount:0,manualCount:0,canPublish:true};
  const latest=preview(row),approvalCurrent=!!latest?.approvedAt&&draft.approvedPreviewId===latest.id;
  add('approval','승인한 시안',approvalCurrent?'ready':'missing',approvalCurrent?'고객이 승인한 최신 시안 기준이에요.':'최신 시안을 고객이 승인한 뒤 파일을 다시 준비해 주세요.');
  const records=new Map((spec.items||[]).map(item=>[item.id,item]));
  const probeFor=item=>inspectionCurrent?inspection?.results?.[item.media?.id]:null;
  const distinct=list=>[...new Map(list.map(item=>{const probe=probeFor(item);return [item.media?(probe?.sha256?'sha:'+probe.sha256:'media:'+item.media.id):'url:'+item.url,item];})).values()];
  const usable=item=>{const probe=probeFor(item);return !item.media||!probe||probe.status!=='corrupt'&&probe.code!=='missing';};
  for(const requirement of spec.items){
    const mapped=items.filter(item=>item.deliverableItemId===requirement.id),primary=distinct(mapped.filter(item=>(requirement.kind==='other'||itemKind(draft,item)===requirement.kind)&&usable(item))),quantity=requirement.quantity||1;
    const status=primary.length<quantity?'missing':primary.length>quantity?'manual':'ready';
    const extra={deliverableItemId:requirement.id};
    add('quantity:'+requirement.id,requirement.label+' · 수량',status,`합의 ${quantity}개 · 연결 ${primary.length}개${primary.length>quantity?' — 더 넣은 파일이 무엇인지 봐 주세요.':''}`,extra);
    if(status==='manual'&&primary.every(item=>deliveryItemConfirmed(row,draft,item,inspection)))checks.at(-1).status='ready';
    if(requirement.kind==='video'&&['separate','both'].includes(requirement.subtitles)){
      const subtitles=distinct(mapped.filter(item=>itemKind(draft,item)==='subtitle'&&usable(item))),status=subtitles.length<quantity?'missing':subtitles.length>quantity?'manual':'ready';
      add('subtitle:'+requirement.id,requirement.label+' · 별도 자막',status,`영상 ${quantity}개에 필요한 별도 자막 · 연결 ${subtitles.length}개`,extra);
      if(status==='manual'&&subtitles.every(item=>deliveryItemConfirmed(row,draft,item,inspection)))checks.at(-1).status='ready';
    }
  }
  for(const item of items){
    const requirement=records.get(item.deliverableItemId),extra={itemId:item.id,deliverableItemId:item.deliverableItemId||''},kind=itemKind(draft,item),ack=deliveryItemConfirmed(row,draft,item,inspection),manual=(suffix,label,text)=>add(item.id+':'+suffix,label,ack?'ready':'manual',ack?'직접 볼 것: '+text:text,extra);
    if(!requirement)manual('mapping',item.label+' · 규격 연결','어느 납품 항목인지 정하지 않았어요. 더 주는 파일이면 그대로 둬도 돼요.');
    const sidecar=kind==='subtitle'&&requirement?.kind==='video';
    if(requirement?.kind==='other')manual('kind',item.label+' · 기타 파일 종류','기타 항목이라 파일 종류를 직접 봐 주세요.');
    else if(requirement&&kind!==requirement.kind&&!sidecar){add(item.id+':kind',item.label+' · 파일 종류','fail','정한 항목과 파일 종류가 달라요.',extra);continue;}
    if(item.source==='approved'&&item.versionId!==latest?.id)add(item.id+':version',item.label+' · 승인 버전','fail','승인한 최신 시안의 파일이 아니에요.',extra);
    if(!item.media){manual('external',item.label+' · 외부 파일','링크는 자동으로 열지 않아요. 열리는지, 개수·길이·비율·형식이 맞는지 직접 봐 주세요.');continue;}
    const probe=probeFor(item);
    if(!probe){add(item.id+':inspection',item.label+' · 파일 검사','pending','「검사하기」를 눌러 주세요.',extra);continue;}
    if(probe.code==='missing'){add(item.id+':inspection',item.label+' · 파일 검사','missing','저장한 파일을 찾지 못했어요. 다시 올려 주세요.',extra);continue;}
    if(probe.status==='corrupt'){add(item.id+':inspection',item.label+' · 파일 검사','fail',probe.message||'파일을 읽지 못했거나 저장 정보와 달라요.',extra);continue;}
    if(probe.status!=='inspected'){manual('inspection',item.label+' · 파일 검사',probe.message||'자동으로 읽지 못했어요. 파일을 열어 직접 봐 주세요.');continue;}
    const metadata=probe.metadata||{};
    if(metadata.kind!==kind){add(item.id+':inspection',item.label+' · 파일 내용','fail','파일 속 종류가 적어 둔 종류와 달라요.',extra);continue;}
    add(item.id+':inspection',item.label+' · 파일 읽기','ready','파일을 열어 형식을 읽었어요.',extra);
    if(!sidecar&&kind==='video'&&Number.isFinite(requirement?.durationSeconds)){
      if(!Number.isFinite(metadata.duration))manual('duration',item.label+' · 길이','영상 길이를 자동으로 읽지 못했어요.');
      else add(item.id+':duration',item.label+' · 길이',Math.abs(metadata.duration-requirement.durationSeconds)<=0.1+Number.EPSILON*100?'ready':'fail',`합의 ${requirement.durationSeconds}초 · 실제 ${Number(metadata.duration.toFixed(3))}초 (0.1초까지는 같은 걸로 봐요)`,extra);
    }
    if(!sidecar&&['video','image'].includes(kind)&&requirement?.aspectRatio){
      const ratio=requirement.aspectRatio.match(/^(\d+):(\d+)$/),expected=ratio?Number(ratio[1])/Number(ratio[2]):null,actual=Number.isFinite(metadata.displayAspectRatio)?metadata.displayAspectRatio:metadata.width&&metadata.height?metadata.width/metadata.height:null;
      if(!expected||!actual)manual('ratio',item.label+' · 화면 비율','화면 비율을 직접 봐 주세요.');
      else add(item.id+':ratio',item.label+' · 화면 비율',Math.abs(actual/expected-1)<=0.01?'ready':'fail',`합의 ${requirement.aspectRatio} · 실제 표시 비율 ${Number(actual.toFixed(4))} (1%까지는 같은 걸로 봐요)`,extra);
    }
    if(!sidecar&&requirement?.fileFormat){
      const requested=requirement.fileFormat.trim().toLowerCase().replace(/^\./,''),expected=requested==='jpeg'?'jpg':requested;
      if(['mp4','webm','png','jpg','srt','vtt','mov','mxf','avi','gif','pdf','psd','ai','tiff'].includes(expected))add(item.id+':format',item.label+' · 파일 형식',formats[item.media.mimeType]===expected?'ready':'fail',`합의 ${requirement.fileFormat} · 실제 ${formats[item.media.mimeType]||'확인 필요'}`,extra);
      else manual('format',item.label+' · 세부 형식',`“${requirement.fileFormat}”의 코덱 같은 세부 조건은 직접 봐 주세요.`);
    }
    if(kind==='subtitle'){
      if(!metadata.cueCount)add(item.id+':cues',item.label+' · 자막 시간 형식','fail','자막 구간이 하나도 없어요.',extra);
      else add(item.id+':cues',item.label+' · 자막 시간 형식','ready',`${metadata.cueCount}개 자막 구간의 시간을 읽었어요.`,extra);
      if(Number(metadata.subtitleWarnings)>0||metadata.subtitleWarnings?.length)manual('subtitle_warnings',item.label+' · 자막 시간 검토','겹치는 자막 구간이 있어요. 한 번 봐 주세요.');
      if(sidecar&&Number.isFinite(requirement.durationSeconds)&&Number.isFinite(metadata.lastCueEnd)&&metadata.lastCueEnd>requirement.durationSeconds+0.1)add(item.id+':subtitle_end',item.label+' · 자막 종료','fail',`자막 종료 ${Number(metadata.lastCueEnd.toFixed(3))}초가 합의 영상 길이 ${requirement.durationSeconds}초를 초과합니다. (0.1초까지는 같은 걸로 봐요)`,extra);
    }
    manual('content',item.label+' · 내용 확인','승인한 시안과 내용·언어·입힌 자막·소리가 맞는지 직접 봐 주세요.');
  }
  const blockingCount=checks.filter(check=>['fail','missing','pending'].includes(check.status)).length,manualCount=checks.filter(check=>check.status==='manual').length,pendingCount=blockingCount+manualCount;
  const status=row.stage==='archived'?'archived':checks.some(check=>['fail','missing'].includes(check.status))?'attention':checks.some(check=>check.status==='pending')?'needs_check':manualCount?'manual':'ready';
  return {...result,status,statusLabel:labels[status],pendingCount,blockingCount,manualCount,canPublish:blockingCount===0&&manualCount===0};
}
