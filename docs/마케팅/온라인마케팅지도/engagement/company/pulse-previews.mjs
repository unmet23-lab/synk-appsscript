import {createHash,randomUUID} from 'node:crypto';

// Preview choices stay in the project's existing revision/ACL transaction.
// A published sample snapshots a reference; editing that reference later must
// never silently replace what the customer chose.
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const ASPECTS=['format','visual','mood','pace','subtitle','voice','color','lighting'];
const FIELDS={
  preview_save_sample:['id','title','referenceId','assetId','aspects','description','visibility'],
  preview_choose_sample:['sampleId','sampleRevision','liked','avoided','reason'],
  preview_save_animatic:['audioAssetId','testClipAssetId','testClipStart','testClipDuration','note','testNote','visibility'],
  preview_confirm_animatic:['signature','scope','note'],
};
const txt=(value,max=1500,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');value=value.trim();if(required&&!value)throw fail('필수 내용을 입력해 주세요.');return value;};
const list=(value,max)=>{if(value.length>=max)throw fail('제작 확인 기록 한도에 도달했습니다. 기록을 보존하고 새 프로젝트에서 이어가 주세요.',409);};
const state=studio=>studio.previews||{samples:[],sampleHistory:[],sampleChoices:[],animatic:null,animaticHistory:[],confirmations:[]};
const publicScenes=studio=>(studio.scenes||[]).filter(scene=>scene.visibility==='customer');
const author=value=>{const {authorId,...safe}=value;return safe;};
function asset(studio,id,kind){
  if(!id)return null;
  const value=(studio.assets||[]).find(row=>row.id===id);
  if(!value||kind==='audio'&&!/^(audio\/|video\/)/.test(value.mimeType)||kind==='video'&&!value.mimeType.startsWith('video/'))throw fail('이 프로젝트에서 사용할 수 있는 자료를 선택해 주세요.',404);
  return value;
}
function media(studio,row,id,staff){const value=asset(studio,id);return value?{id:value.id,fileName:value.fileName,mimeType:value.mimeType,byteSize:value.byteSize,url:staff?`/api/client-projects/${row.id}/studio/media/${value.id}`:`/pulse/api/studio/media/${value.id}`}:null;}
function signature(studio,animatic){return createHash('sha256').update(JSON.stringify({revision:animatic?.revision||0,scenes:publicScenes(studio).map(scene=>[scene.id,scene.revision,scene.duration,scene.assetId||null,scene.imageUrl||'']),audio:animatic?.audioAssetId||null,clip:animatic?.testClipAssetId||null,start:animatic?.testClipStart||0,duration:animatic?.testClipDuration||7})).digest('hex');}
export function previewActions(action){return Object.hasOwn(FIELDS,action)?FIELDS[action]:null;}

export function applyPreviewAction({studio,row,input,staff,stamp}){
  const fields=previewActions(input?.action);if(!fields)return false;
  if(Object.keys(input).some(key=>!['action','revision',...fields].includes(key)))throw fail('제작 확인 입력 항목을 확인해 주세요.');
  const writing=['preview_save_sample','preview_save_animatic'].includes(input.action);
  if(writing&&!staff)throw fail('제작 담당자만 비교 예시와 시안을 준비할 수 있습니다.',403);
  if(!writing&&staff)throw fail('고객의 선택과 확인은 고객 화면에서 남겨 주세요.',403);
  const p=structuredClone(state(studio));
  if(input.action==='preview_save_sample'){
    const prior=input.id?p.samples.find(sample=>sample.id===input.id):null;
    if(input.id&&!prior)throw fail('비교 예시를 찾을 수 없습니다.',404);
    if(!['internal','customer'].includes(input.visibility))throw fail('예시 공개 범위를 선택해 주세요.');
    if(!!input.referenceId===!!input.assetId)throw fail('기존 참고자료 또는 파일 중 하나를 선택해 주세요.');
    const reference=input.referenceId?(studio.references||[]).find(ref=>ref.id===input.referenceId):null;
    if(input.referenceId&&!reference)throw fail('참고자료를 찾을 수 없습니다.',404);
    const sourceAsset=asset(studio,reference?.assetId||input.assetId);
    if(!sourceAsset&&!reference?.url)throw fail('볼 수 있는 참고자료를 선택해 주세요.');
    if(!input.aspects||typeof input.aspects!=='object'||Array.isArray(input.aspects)||Object.keys(input.aspects).some(key=>!ASPECTS.includes(key)))throw fail('예시의 비교 항목을 확인해 주세요.');
    const aspects=Object.fromEntries(ASPECTS.map(key=>[key,txt(input.aspects[key],160)]).filter(([,value])=>value));
    if(!Object.keys(aspects).length)throw fail('형식·분위기 등 비교할 요소를 하나 이상 입력해 주세요.');
    if(prior){list(p.sampleHistory,120);p.sampleHistory.push(prior);}else list(p.samples,24);
    const sample={id:prior?.id||randomUUID(),revision:(prior?.revision||0)+1,title:txt(input.title,160,true),referenceId:reference?.id||null,assetId:sourceAsset?.id||null,url:reference?.url||'',sourceLabel:reference?.label||sourceAsset?.fileName||'',aspects,description:txt(input.description),visibility:input.visibility,...stamp};
    if(prior)p.samples[p.samples.indexOf(prior)]=sample;else p.samples.push(sample);
  }else if(input.action==='preview_choose_sample'){
    const sample=p.samples.find(value=>value.id===input.sampleId&&value.visibility==='customer');
    if(!sample)throw fail('공개된 비교 예시를 찾을 수 없습니다.',404);
    if(sample.revision!==input.sampleRevision)throw fail('비교 예시가 변경되었습니다. 최신 예시를 확인해 주세요.',409);
    const chosen=values=>{if(!Array.isArray(values)||values.length>ASPECTS.length||new Set(values).size!==values.length||values.some(key=>!Object.hasOwn(sample.aspects,key)))throw fail('이 예시에 있는 비교 요소를 선택해 주세요.');return values;};
    const liked=chosen(input.liked),avoided=chosen(input.avoided),reason=txt(input.reason);
    if(liked.some(key=>avoided.includes(key)))throw fail('같은 요소를 원하는 것과 피할 것으로 동시에 선택할 수 없습니다.');
    if(!liked.length&&!avoided.length&&!reason)throw fail('원하는 요소, 피할 요소 또는 이유를 남겨 주세요.');
    list(p.sampleChoices,240);p.sampleChoices.push({id:randomUUID(),sampleId:sample.id,sampleRevision:sample.revision,title:sample.title,aspects:structuredClone(sample.aspects),liked,avoided,reason,...stamp});
  }else if(input.action==='preview_save_animatic'){
    if(!['internal','customer'].includes(input.visibility))throw fail('시안 공개 범위를 선택해 주세요.');
    if(input.visibility==='customer'&&!publicScenes(studio).length)throw fail('고객에게 공개한 장면을 먼저 준비해 주세요.',409);
    const audio=asset(studio,input.audioAssetId,'audio'),clip=asset(studio,input.testClipAssetId,'video');
    const start=input.testClipStart??0,duration=input.testClipDuration??7;
    if(typeof start!=='number'||!Number.isFinite(start)||start<0||start>36000||typeof duration!=='number'||!Number.isFinite(duration)||duration<5||duration>10)throw fail('시험 장면 시작 시각과 5~10초 구간을 확인해 주세요.');
    if(p.animatic){list(p.animaticHistory,100);p.animaticHistory.push(p.animatic);}
    p.animatic={revision:(p.animatic?.revision||0)+1,visibility:input.visibility,audioAssetId:audio?.id||null,testClipAssetId:clip?.id||null,testClipStart:start,testClipDuration:duration,note:txt(input.note),testNote:txt(input.testNote),...stamp};
  }else if(input.action==='preview_confirm_animatic'){
    if(p.animatic?.visibility!=='customer'||!publicScenes(studio).length)throw fail('공개된 전체 흐름 시안을 먼저 확인해 주세요.',404);
    const key=signature(studio,p.animatic);
    if(input.signature!==key)throw fail('장면·순서·음성 또는 시험 영상이 변경되었습니다. 새 시안을 다시 확인해 주세요.',409);
    if(!['flow','test'].includes(input.scope)||input.scope==='test'&&!p.animatic.testClipAssetId)throw fail('확인할 전체 흐름 또는 실제 시험 장면을 선택해 주세요.');
    if(p.confirmations.some(item=>item.signature===key&&item.scope===input.scope))throw fail('현재 시안에는 이미 고객 확인이 남아 있습니다.',409);
    const snapshot={scenes:publicScenes(studio).map(scene=>({id:scene.id,revision:scene.revision,title:scene.title,narration:scene.narration||'',screenText:scene.screenText||'',duration:scene.duration})),note:p.animatic.note,testNote:p.animatic.testNote,audioName:asset(studio,p.animatic.audioAssetId)?.fileName||'',testClipName:asset(studio,p.animatic.testClipAssetId)?.fileName||'',testClipStart:p.animatic.testClipStart,testClipDuration:p.animatic.testClipDuration};
    list(p.confirmations,160);p.confirmations.push({id:randomUUID(),signature:key,animaticRevision:p.animatic.revision,scope:input.scope,note:txt(input.note),snapshot,...stamp});
  }
  studio.previews=p;return true;
}

export function visiblePreviewAssetIds(studio){
  const p=state(studio),ids=new Set();
  for(const sample of p.samples)if(sample.visibility==='customer'&&sample.assetId)ids.add(sample.assetId);
  if(p.animatic?.visibility==='customer')for(const id of [p.animatic.audioAssetId,p.animatic.testClipAssetId])if(id)ids.add(id);
  return ids;
}

export function previewsView(studio,row,staff=false){
  const p=state(studio),samples=p.samples.filter(sample=>staff||sample.visibility==='customer');
  const choices=p.sampleChoices.filter(choice=>staff||samples.some(sample=>sample.id===choice.sampleId));
  const a=p.animatic&&(staff||p.animatic.visibility==='customer')?p.animatic:null;
  const key=a?signature(studio,a):'';
  const sampleView=sample=>({...author(sample),media:media(studio,row,sample.assetId,staff)});
  // Histories deliberately omit media pointers. Withdrawing a preview must
  // withdraw its private files too, even if an older choice is retained.
  return {
    samples:samples.map(sampleView),
    sampleChoices:choices.map(choice=>({...author(choice),current:samples.some(sample=>sample.id===choice.sampleId&&sample.revision===choice.sampleRevision&&sample.visibility==='customer')})),
    sampleHistory:p.sampleHistory.filter(sample=>staff||samples.some(current=>current.id===sample.id)&&sample.visibility==='customer').map(sample=>({id:sample.id,revision:sample.revision,title:sample.title,aspects:sample.aspects,description:sample.description,at:sample.at})),
    animatic:a?{...author(a),signature:key,audio:media(studio,row,a.audioAssetId,staff),testClip:media(studio,row,a.testClipAssetId,staff),scenes:publicScenes(studio).map(scene=>({id:scene.id,revision:scene.revision,title:scene.title,description:scene.description,narration:scene.narration,screenText:scene.screenText,duration:scene.duration,imageUrl:scene.imageUrl||'',media:media(studio,row,scene.assetId,staff)}))}:null,
    confirmations:p.confirmations.filter(()=>staff||!!a).map(confirmation=>({...author(confirmation),current:confirmation.signature===key&&a?.visibility==='customer'})),
  };
}
