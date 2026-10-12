import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS={save_deliverables:['items','notes','deliverableRevision'],request_deliverable_review:['deliverableRevision'],confirm_deliverables:['deliverableRevision'],link_deliverable_version:['deliverableRevision','itemId','versionIds']};
const ITEM_FIELDS=['id','label','kind','platform','placement','durationSeconds','aspectRatio','language','subtitles','fileFormat','quantity','notes'];
const ENUMS={kind:['video','image','subtitle','other'],platform:['','instagram','youtube','facebook','tiktok','website','blog','offline','tv','other'],aspectRatio:['','9:16','16:9','1:1','4:5','other'],subtitles:['','none','burned','separate','both']};
const LIMIT=30,HISTORY_LIMIT=20;
const text=(value,max=1000)=>{if(value===undefined)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('납품 규격의 입력 내용과 길이를 확인해 주세요.');return value.trim();};
const keys=(value,allowed)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('납품 규격 입력 항목을 확인해 주세요.');};
const id=value=>{if(typeof value!=='string'||!UUID.test(value))throw fail('납품 항목을 확인해 주세요.');return value;};
const stampView=value=>object(value)?{deliverableRevision:value.deliverableRevision,author:value.author,authorName:value.authorName,at:value.at}:null;
const safeItem=value=>Object.fromEntries(ITEM_FIELDS.map(key=>[key,key==='durationSeconds'?(Number.isFinite(value?.[key])?value[key]:null):key==='quantity'?(Number.isSafeInteger(value?.[key])?value[key]:1):typeof value?.[key]==='string'?value[key]:'']));

export function deliverableActions(action){return Object.hasOwn(ACTIONS,action)?[...ACTIONS[action]]:null;}
export function emptyDeliverables(){return {revision:0,items:[],notes:'',request:null,confirmation:null,links:[],history:[]};}
function stateOf(value){const state=emptyDeliverables();if(!object(value))return state;return {...structuredClone(value),revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0,items:Array.isArray(value.items)?structuredClone(value.items):[],notes:typeof value.notes==='string'?value.notes:'',request:object(value.request)?structuredClone(value.request):null,confirmation:object(value.confirmation)?structuredClone(value.confirmation):null,links:Array.isArray(value.links)?structuredClone(value.links):[],history:Array.isArray(value.history)?structuredClone(value.history):[]};}
function normalizeItems(input,previous){
  if(!Array.isArray(input)||input.length>LIMIT)throw fail('납품 항목은 최대 30개까지 정리할 수 있습니다.');
  const seen=new Set();return input.map(value=>{
    keys(value,ITEM_FIELDS);const itemId=value.id?id(value.id):randomUUID();
    if(value.id&&!previous.some(item=>item.id===itemId))throw fail('현재 납품 목록의 항목을 확인해 주세요.',404);
    if(seen.has(itemId))throw fail('같은 납품 항목을 중복해서 저장할 수 없습니다.');seen.add(itemId);
    const result={id:itemId,label:text(value.label,160),placement:text(value.placement,160),language:text(value.language,120),fileFormat:text(value.fileFormat,80),notes:text(value.notes,1000)};
    for(const [key,values]of Object.entries(ENUMS)){const selected=value[key]===undefined?(key==='kind'?'video':''):value[key];if(!values.includes(selected))throw fail('납품 규격의 선택 항목을 확인해 주세요.');result[key]=selected;}
    const duration=value.durationSeconds??null;if(duration!==null&&(typeof duration!=='number'||!Number.isFinite(duration)||duration<1||duration>600))throw fail('영상 길이는 1~600초 범위로 입력해 주세요.');result.durationSeconds=duration;
    const quantity=value.quantity??1;if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw fail('납품 수량은 1~100개 범위로 입력해 주세요.');result.quantity=quantity;
    return result;
  });
}
function missingFor(item){const fields=['label','platform','placement','language','fileFormat'];if(['video','image'].includes(item.kind))fields.push('aspectRatio');if(item.kind==='video')fields.push('durationSeconds','subtitles');return fields.filter(key=>!item[key]);}
export function deliverableReadiness(state){const missing=(state.items||[]).flatMap(item=>missingFor(item).map(field=>({itemId:item.id,field})));if(!state.items?.length)missing.push({itemId:'',field:'items'});return {ready:missing.length===0,missing};}
function snapshot(state){const {history,...record}=structuredClone(state);return record;}
function safeSnapshot(state,row){
  const finalVersions=new Map((row?.versions||[]).filter(version=>version.kind==='final').map(version=>[version.id,version]));
  const latest=(row?.versions||[]).filter(version=>version.kind==='preview').at(-1);
  return {revision:state.revision,items:state.items.map(safeItem),notes:state.notes,request:stampView(state.request),confirmation:stampView(state.confirmation),links:state.links.map(link=>({itemId:link.itemId,versionIds:(Array.isArray(link.versionIds)?link.versionIds:[]).filter(versionId=>finalVersions.has(versionId)),...stampView(link),current:link.deliverableRevision===state.revision&&state.confirmation?.deliverableRevision===state.revision&&!!latest?.approvedAt&&(link.versionIds||[]).every(versionId=>finalVersions.get(versionId)?.approvedPreviewId===latest.id)})),updatedAt:state.updatedAt||'',author:state.author||'',authorName:state.authorName||''};
}

export function deliverableView(studio,row,staff=false){
  const state=stateOf(studio?.deliverables),result=safeSnapshot(state,row);
  return {...result,readiness:deliverableReadiness(state),history:state.history.map(record=>{const previous=safeSnapshot(stateOf(record),row);return {...previous,links:previous.links.map(link=>({...link,current:false}))};})};
}

export function applyDeliverableAction({studio,row,input,staff,stamp}){
  const allowed=deliverableActions(input?.action);if(!allowed)throw fail('납품 규격 요청을 확인해 주세요.');keys(input,['action','revision',...allowed]);
  const isStaff=staff===true;if(!stamp||stamp.author!==(isStaff?'staff':'customer'))throw fail('납품 규격의 작업 권한을 확인해 주세요.',403);
  if(['request_deliverable_review','link_deliverable_version'].includes(input.action)&&!isStaff)throw fail('제작 담당자만 확인 요청과 최종 파일 연결을 할 수 있습니다.',403);
  if(input.action==='confirm_deliverables'&&isStaff)throw fail('납품 규격 확인은 고객 화면에서만 기록합니다.',403);
  const state=stateOf(studio.deliverables);
  if(!Number.isSafeInteger(input.deliverableRevision)||input.deliverableRevision!==state.revision)throw fail('납품 규격이 변경되었습니다. 최신 목록을 확인해 주세요.',409);
  if(input.action==='save_deliverables'){
    if(state.revision>=Number.MAX_SAFE_INTEGER)throw fail('납품 규격 버전 한도에 도달했습니다.',409);
    const items=normalizeItems(input.items,state.items),notes=text(input.notes,2000);
    const history=state.revision?[...state.history,snapshot(state)].slice(-HISTORY_LIMIT):state.history.slice(-HISTORY_LIMIT);
    studio.deliverables={...state,revision:state.revision+1,items,notes,request:null,confirmation:null,links:[],history,updatedAt:stamp.at,author:stamp.author,authorName:stamp.authorName,authorId:stamp.authorId};
  }else if(input.action==='request_deliverable_review'){
    if(!state.revision||!deliverableReadiness(state).ready)throw fail('납품 항목의 사용 위치·길이·비율·언어·자막·형식 등 필요한 규격을 정리해 주세요.',409);
    if(state.request?.deliverableRevision===state.revision)throw fail('이미 이 납품 규격의 확인을 요청했습니다.',409);
    state.request={deliverableRevision:state.revision,...stamp};state.confirmation=null;studio.deliverables=state;
  }else if(input.action==='confirm_deliverables'){
    if(!state.revision||state.request?.deliverableRevision!==state.revision)throw fail('담당자가 확인을 요청한 납품 규격을 살펴봐 주세요.',409);
    if(state.confirmation?.deliverableRevision===state.revision)throw fail('이미 이 납품 규격을 확인했습니다.',409);
    state.confirmation={deliverableRevision:state.revision,...stamp};studio.deliverables=state;
  }else{
    if(!state.revision||state.confirmation?.deliverableRevision!==state.revision)throw fail('현재 납품 규격의 고객 확인을 먼저 받아 주세요.',409);
    const itemId=id(input.itemId);if(!state.items.some(item=>item.id===itemId))throw fail('연결할 납품 항목을 찾을 수 없습니다.',404);
    if(!Array.isArray(input.versionIds)||input.versionIds.length>100||new Set(input.versionIds).size!==input.versionIds.length)throw fail('연결할 최종 파일을 확인해 주세요.');
    const latest=(row?.versions||[]).filter(version=>version.kind==='preview').at(-1);
    for(const versionId of input.versionIds){id(versionId);const version=(row?.versions||[]).find(version=>version.id===versionId);if(!version||version.kind!=='final')throw fail('이 프로젝트에 등록한 최종 납품 파일만 연결할 수 있습니다.',404);if(!latest?.approvedAt||version.approvedPreviewId!==latest.id)throw fail('최근 승인 시안에 연결된 최종 파일을 선택해 주세요.',409);}
    state.links=state.links.filter(link=>link.itemId!==itemId);if(input.versionIds.length)state.links.push({itemId,versionIds:[...input.versionIds],deliverableRevision:state.revision,...stamp});studio.deliverables=state;
  }
  return studio;
}
