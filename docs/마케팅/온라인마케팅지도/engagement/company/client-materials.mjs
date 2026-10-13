import {lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {buildClientKickoff,clientKickoffSources} from './client-kickoff.mjs';
import {clientDeliveryIdentity} from './client-closeout.mjs';
import {visiblePreviewAssetIds} from './pulse-previews.mjs';

const records=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value.replace(/[\r\n\t]+/g,' ').trim():'';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const statuses={received:'열어 보기 전',ready:'쓸 수 있음',reference:'참고 자료',pending_preview:'지금 시안 · 승인 전',approved_preview:'지금 시안 · 고객 승인',previous_preview:'이전 시안',current_final:'지금 최종본',previous_final:'이전 최종본',unavailable:'파일·링크 볼 것'};
const groups=[{id:'received',label:'받은 자료'},{id:'reference',label:'참고'},{id:'preview',label:'시안'},{id:'delivery',label:'최종본'}];
const mediaTypes=new Set(['video/mp4','video/webm','image/png','image/jpeg','audio/mpeg','audio/wav','application/x-subrip','text/vtt']);
function external(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
function kind(name,mime='',fallback='other'){
  let value=text(name);mime=text(mime).toLowerCase();try{value=new URL(value).pathname;}catch{}
  const suffix=value.toLowerCase().split('.').at(-1);
  if(['srt','vtt','ass','ssa'].includes(suffix)||['application/x-subrip','text/vtt'].includes(mime))return 'subtitle';
  if(mime.startsWith('video/')||['mp4','webm','mov','m4v','avi'].includes(suffix))return 'video';
  if(mime.startsWith('image/')||['png','jpg','jpeg','gif','webp','svg','heic'].includes(suffix))return 'image';
  if(mime.startsWith('audio/')||['mp3','wav','m4a','ogg','aac'].includes(suffix))return 'audio';
  if(['pdf','doc','docx','xls','xlsx','ppt','pptx','hwp','hwpx'].includes(suffix)||mime==='application/pdf')return 'document';
  if(['txt','md','csv','json'].includes(suffix)||mime.startsWith('text/'))return 'text';
  return fallback;
}

// A read-only index of authoritative metadata. Never duplicate files, fetch an
// external URL, inspect feedback drafts or return storage names/authentication.
export function createClientMaterialsService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function stored(file,intake=false){
    if(!uuid(file?.id)||typeof store.directory!=='string'||typeof file.diskName!=='string')return false;
    const pattern=intake?/^[a-f0-9-]{36}\.intake$/:/^[a-f0-9-]{36}\.(?:mp4|webm|png|jpg|mp3|wav|srt|vtt)$/;
    if(!pattern.test(file.diskName)||!intake&&!mediaTypes.has(file.mimeType))return false;
    const root=resolve(store.directory,'studio-media'),path=resolve(root,file.diskName);
    if(dirname(path)!==root)return false;
    try{const info=lstatSync(path);return info.isFile()&&!info.isSymbolicLink()&&info.size===file.byteSize;}catch{return false;}
  }
  function workspace(user,id){
    if(typeof user?.id!=='string')throw Object.assign(new Error('먼저 로그인해 주세요.'),{status:401});
    const row=clientProjects.project(user,id),generatedAt=clock(),studio=row.studio||{},projectUrl='/?tab=workroom&section=clients&project='+row.id;
    const pulse=(tab='direction',sceneId='')=>'/pulse-app/?mode=staff&project='+row.id+'&tab='+tab+(sceneId?'&scene='+sceneId:'');
    const kickoff=buildClientKickoff(row,{now:generatedAt}),sources=clientKickoffSources(row);
    const publicAssets=new Set(sources.filter(source=>source.kind==='asset'&&source.customerVisible).map(source=>source.key.slice(6)));
    // PULSE also shares current comparison samples and animatic audio/video.
    const previewState=studio.previews;
    if(!previewState||Array.isArray(previewState.samples))for(const assetId of visiblePreviewAssetIds(studio))publicAssets.add(assetId);
    const items=[],assets=new Map(),byUrl=new Map();
    const relation=(item,label,url)=>{if(label&&url&&!item.relations.some(value=>value.label===label&&value.url===url))item.relations.push({label,url});};
    const add=(value)=>{const item={id:value.id,category:value.category,kind:value.kind||'other',label:text(value.label)||'이름 없는 자료',fileName:text(value.fileName),sourceLabel:value.sourceLabel,visibility:value.visibility||'internal',status:value.status||'reference',statusLabel:statuses[value.status||'reference'],sourceUrl:value.sourceUrl||'',openUrl:value.openUrl||'',downloadUrl:value.downloadUrl||'',updatedAt:instant(value.updatedAt)?value.updatedAt:'',relations:[],current:value.current!==false};if(Number.isSafeInteger(value.byteSize)&&value.byteSize>=0)item.byteSize=value.byteSize;if(value.mimeType)item.mimeType=value.mimeType;if(typeof value.receiptConfirmed==='boolean')item.receiptConfirmed=value.receiptConfirmed;items.push(item);return item;};
    const unavailable=item=>{if(!item.openUrl){item.status='unavailable';item.statusLabel=statuses.unavailable;}};
    const applyUse=(item,keys)=>{
      const linked=kickoff.enabled?kickoff.requirements.filter(requirement=>keys.includes(requirement.sourceKey)&&requirement.status!=='waived'):[];
      for(const requirement of linked)relation(item,'필요한 자료: '+text(requirement.label),projectUrl+'&kickoff=1');
      if(linked.length){item.status=linked.every(requirement=>requirement.status==='ready')?'ready':'received';item.statusLabel=statuses[item.status];}
      unavailable(item);
    };
    for(const file of records(row.intake?.files).filter(file=>file.kind==='attachment'&&uuid(file.id))){
      const url=stored(file,true)?'/api/client-projects/'+row.id+'/intake-files/'+file.id:'';
      const item=add({id:'intake:'+file.id,category:'received',kind:kind(file.fileName,file.mimeType),label:file.fileName,fileName:file.fileName,sourceLabel:'접수 때 첨부',visibility:'internal',status:'received',sourceUrl:projectUrl+'&intake=1',openUrl:url,downloadUrl:url,updatedAt:row.intake?.receivedAt||row.createdAt,byteSize:file.byteSize,mimeType:file.mimeType});applyUse(item,['intake:'+file.id]);
    }
    for(const asset of records(studio.assets).filter(asset=>uuid(asset.id))){
      const url=stored(asset)?'/api/client-projects/'+row.id+'/studio/media/'+asset.id:'';
      const item=add({id:'asset:'+asset.id,category:asset.author==='customer'?'received':'reference',kind:kind(asset.fileName,asset.mimeType),label:asset.fileName,fileName:asset.fileName,sourceLabel:asset.author==='customer'?'고객이 PULSE에 올림':'PULSE 제작 자료',visibility:publicAssets.has(asset.id)?'customer':'internal',status:asset.author==='customer'?'received':'reference',openUrl:url,downloadUrl:url,updatedAt:asset.at,byteSize:asset.byteSize,mimeType:asset.mimeType});assets.set(asset.id,item);
    }
    for(const [list,type,tab]of [[records(studio.references),'참고','direction'],[records(studio.concepts),'기획','concepts'],[records(studio.scenes),'장면','storyboard']])for(const card of list){
      if(!uuid(card.id))continue;
      const asset=assets.get(card.assetId),url=external(type==='참고'?card.url:card.imageUrl),title=text(card.label||card.title)||type+' 자료',sourceUrl=pulse(tab,type==='장면'?card.id:''),visibility=type==='참고'||card.visibility==='customer'?'customer':'internal';
      if(asset){relation(asset,type+': '+title,sourceUrl);if(type==='참고')asset._keys=[...(asset._keys||[]),'reference:'+card.id];}
      // References can contain a URL and a file simultaneously. Keep both
      // sources; only collapse repeated pointers to the same file or URL.
      if(url){let item=byUrl.get(url);if(!item){item=add({id:type==='참고'?'reference:'+card.id:type==='장면'?'scene:'+card.id:'concept:'+card.id,category:'reference',kind:kind(new URL(url).pathname,'','link'),label:title,sourceLabel:'PULSE '+type+' 링크',visibility,status:'reference',sourceUrl,openUrl:url,updatedAt:card.updatedAt||card.at});byUrl.set(url,item);}else if(visibility==='customer')item.visibility='customer';relation(item,type+': '+title,sourceUrl);if(type==='참고')item._keys=[...(item._keys||[]),'reference:'+card.id];}
      if(!asset&&!url&&(card.assetId||card.url||card.imageUrl)){const item=add({id:(type==='참고'?'reference:':type==='장면'?'scene:':'concept:')+card.id,category:'reference',label:title,sourceLabel:'PULSE '+type+' 자료',visibility,status:'unavailable',sourceUrl,updatedAt:card.updatedAt||card.at});relation(item,type+': '+title,sourceUrl);}
    }
    for(const item of items){if(item.id.startsWith('asset:')||item.category==='reference')applyUse(item,[item.id,...(item._keys||[])]);if(item.id.startsWith('asset:'))item.sourceUrl=item.relations[0]?.url||'';delete item._keys;}
    const delivery=clientDeliveryIdentity(row),preview=records(row.versions).filter(version=>version.kind==='preview').at(-1),currentFinals=new Set(delivery.finals.map(version=>version.id));
    const receipt=delivery.deliveryKey?records(row.deliveryReceipts).findLast(value=>value.deliveryKey===delivery.deliveryKey):null,receiptConfirmed=!!(receipt?.actor==='customer'&&instant(receipt.confirmedAt));
    for(const version of records(row.versions).filter(version=>uuid(version.id)&&['preview','final'].includes(version.kind))){
      const isPreview=version.kind==='preview',current=isPreview?version.id===preview?.id:currentFinals.has(version.id),status=isPreview?current?(instant(version.approvedAt)?'approved_preview':'pending_preview'):'previous_preview':current?'current_final':'previous_final';
      const media=version.media,url=media&&stored(media)?'/api/client-media/'+media.id:'',openUrl=url||external(version.url),sourceUrl=projectUrl+'&version='+version.id;
      const item=add({id:'version:'+version.id,category:isPreview?'preview':'delivery',kind:kind(media?.fileName||openUrl,media?.mimeType,openUrl?'link':'other'),label:version.label,fileName:media?.fileName,sourceLabel:'시안과 최종본',visibility:'customer',status,sourceUrl,openUrl,downloadUrl:url,updatedAt:version.approvedAt||version.createdAt,current,byteSize:media?.byteSize,mimeType:media?.mimeType,...(!isPreview&&current?{receiptConfirmed}:{})});
      const approved=records(row.versions).find(value=>value.kind==='preview'&&value.id===version.approvedPreviewId);
      if(approved)relation(item,'승인한 시안: '+text(approved.label),projectUrl+'&version='+approved.id);
      unavailable(item);
    }
    return {projectId:row.id,revision:row.revision,generatedAt,groups:groups.map(group=>({...group})),items};
  }
  return {workspace};
}
