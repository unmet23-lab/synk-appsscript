import {CASTING_MODELS} from './casting-catalog.mjs';
import {KINDS,MODEL_LINES,briefRows,slotsFor,emptyAnswers,ratioOf} from './request-data.mjs';

// 실제 프로젝트를 슬레이트 판 화면(film-views.mjs)의 자료로 옮긴다. 판단은 여기 한 곳에서 한다.
// 흐름: 의뢰서 → 확인(되묻기) → 1차안(모델 → 글 콘티 판 → 장면 이미지 판) → 제작 → 영상 확인 → 납품. 공개 약속 「영상 전에 세 번 확인」과 같은 순서다.
export const usesRoom=p=>!!(p?.requestFlow||p?.studio?.request);
const requestOf=p=>p?.studio?.request||null;
const previews=p=>(p?.versions||[]).filter(v=>v.kind==='preview');
const finals=p=>(p?.versions||[]).filter(v=>v.kind==='final');
const lastRound=r=>(r?.rounds||[]).at(-1)||null;

export function roomState(p){
  const r=requestOf(p),round=lastRound(r);
  if(p?.stage==='delivered'||finals(p).length)return 'deliver';
  if(previews(p).length)return 'review';
  if(r?.approvedAt||p?.stage==='producing')return 'make';
  if(!r||r.status==='writing')return 'write';
  if(r.asks?.some(ask=>ask.status==='open'))return 'ask';
  if(r.modelProposal?.status==='open')return 'model';
  if(round&&!round.approvedAt&&!round.feedbackAt)return round.kind==='script'?'script':'images';
  if(round&&!round.approvedAt)return 'revise';
  if(round?.kind==='script'&&round.approvedAt)return 'prepare-images';
  if(r.status==='confirmed')return 'prepare';
  return 'check';
}
export const ROOM_STAGES=Object.freeze([
  {id:'request',no:'01',name:'의뢰서'},{id:'check',no:'02',name:'확인'},{id:'draft',no:'03',name:'1차안'},
  {id:'make',no:'04',name:'제작'},{id:'review',no:'05',name:'영상 확인'},{id:'history',no:'06',name:'납품'},
]);
const STAGE_OF={write:'request',check:'check',ask:'check',model:'draft',prepare:'draft','prepare-images':'draft',script:'draft',images:'draft',revise:'draft',make:'make',review:'review',deliver:'history'};
export const roomStage=state=>STAGE_OF[state]||'check';
// 영상 전 세 번 확인 중 몇 번째인지. 손님이 지금 어디쯤인지 한눈에 보이게 한다.
export const CONFIRM_OF=Object.freeze({model:'1/3',script:'2/3',images:'3/3'});
export const ROOM_COPY={
  write:{turn:'you',title:'의뢰서를 써 주세요',text:'제품 이름, 올릴 곳, 사진 몇 장이면 시작할 수 있어요. 모르는 칸은 저희가 제안해요.',action:{label:'의뢰서 쓰기',go:'write'}},
  check:{turn:'us',title:'지금은 저희 차례예요',text:'보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요.'},
  ask:{turn:'you',title:'이것만 더 알려 주세요',text:'아래 칸만 채워 주시면 바로 1차안을 만들어요.'},
  model:{turn:'you',title:'이 모델로 갈까요?',text:'장면을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.'},
  prepare:{turn:'us',title:'1차안을 만들고 있어요',text:'광고가 남길 한 문장과 글 콘티를 먼저 보내 드려요.'},
  'prepare-images':{turn:'us',title:'장면 이미지를 만들고 있어요',text:'확인하신 글 콘티대로 컷마다 장면 이미지를 만들어요. 다 되면 알려 드려요.'},
  script:{turn:'you',title:'글 콘티가 도착했어요',text:'한 문장과 컷마다 들어갈 내용을 봐 주세요. 맞으면 장면 이미지를 만들어요.',action:{label:'글 콘티 보기',go:'draft'}},
  images:{turn:'you',title:'장면 이미지가 도착했어요',text:'컷마다 보고 의견을 남겨 주세요. 괜찮으면 그대로 제작을 시작해요.',action:{label:'장면 이미지 보기',go:'draft'}},
  revise:{turn:'us',title:'의견을 반영하고 있어요',text:'보내 주신 의견대로 고쳐서 새 판을 보내 드려요.'},
  make:{turn:'us',title:'확인하신 컷으로 만들고 있어요',text:'목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 다음에 받으실 것은 소리까지 들어간 영상이에요.'},
  review:{turn:'you',title:'영상이 도착했어요',text:'영상을 보면서 고칠 시점에 의견을 남겨 주세요.',action:{label:'영상 보기',go:'review'}},
  deliver:{turn:'you',title:'완성본을 받으세요',text:'올릴 곳에 맞는 파일을 내려받으실 수 있어요.',action:{label:'파일 받기',go:'history'}},
};
export const modelCard=id=>{const item=CASTING_MODELS.find(model=>model.id===id);return item?{id,name:item.name,line:MODEL_LINES[id]?.line||item.description,image:item.image}:null;};
const assetUrl=asset=>asset?.media?.url||asset?.url||'';
function slotsWithFiles(answers,files=[]){const slots={...(answers.slots||{})};for(const file of files){slots[file.slot]={...slots[file.slot],files:[...(slots[file.slot]?.files||[]),file]};}return slots;}
const filled=r=>({...emptyAnswers(),...(r?.answers||{}),slots:slotsWithFiles(r?.answers||{},r?.files)});
// 영상이 도착한 상태면 고객 방 스크린에 그 영상을 소리 없이 튼다.
const screenFilm=(p,state)=>{const version=state==='deliver'?finals(p).at(-1):state==='review'?previews(p).at(-1):null,src=version?.media?.mimeType?.startsWith('video/')?version.media.url:'';return src?{src,label:version.label,go:state==='deliver'?'history':'review'}:null;};
export function roomModel(p){
  const r=requestOf(p),state=roomState(p),answers=filled(r);
  const slotLabel=asset=>slotsFor(answers.kind).find(slot=>slot.id===(r?.files||[]).find(file=>file.id===asset.id)?.slot)?.label||'';
  // 받은 자료 칸에는 손님이 보낸 파일만 둔다. 직원이 올린 장면 그림이 여기 섞이면 보내기 전의 작업물이 손님에게 보인다.
  const sent=new Set((r?.files||[]).map(file=>file.id));
  const images=(p?.studio?.assets||[]).filter(asset=>sent.has(asset.id)&&assetUrl(asset)&&asset.mimeType?.startsWith('image/'));
  const files=images.slice(0,6).map(asset=>({src:assetUrl(asset),label:slotLabel(asset)||asset.fileName,size:''}));
  const shown=new Set(files.map(file=>file.src)),drawn=new Set(images.map(asset=>asset.id)),others=[...images.filter(asset=>!shown.has(assetUrl(asset))).map(asset=>asset.fileName),...(r?.files||[]).filter(file=>!drawn.has(file.id)).map(file=>file.fileName)];
  const proposed=r?.modelProposal?.status==='open'?modelCard(r.modelProposal.modelId):null,proposal=proposed?{...proposed,note:r.modelProposal.note||''}:null;
  return {
    state,stage:roomStage(state),title:p?.title||'',number:r?.number||'',manager:p?.ownerName||'PULSE 담당자',hasRound:!!lastRound(r),
    brief:r?briefRows(answers).filter(row=>!row.missing).slice(0,8).map(row=>[row.key,row.value]):[],
    files,others,proposal,asks:(r?.asks||[]).filter(ask=>ask.status==='open'),answered:(r?.asks||[]).filter(ask=>ask.status==='answered'),canEdit:!!r&&r.status!=='confirmed',
    draft:['script','images','revise','prepare-images'].includes(state)?draftModel(p):null,film:screenFilm(p,state),
  };
}
export function draftModel(p){
  const st=p?.studio||{},r=requestOf(p),round=lastRound(r);
  if(!round)return null;
  const scenes=round.scenes.map(ref=>(st.scenes||[]).find(scene=>scene.id===ref.id)).filter(Boolean);
  if(!scenes.length)return null;
  const modelId=st.strategy?.data?.castingSelection?.modelId||(r.modelProposal?.status==='accepted'?r.modelProposal.modelId:'')||r.answers?.models?.[0]||'';
  const assetSrc=scene=>scene.assetId?assetUrl((st.assets||[]).find(asset=>asset.id===scene.assetId)):'';
  return {round:round.round,kind:round.kind,oneLine:round.oneLine,note:round.note||'',approved:!!round.approvedAt,feedbackAt:round.feedbackAt||'',model:modelCard(modelId),ratio:ratioOf({channels:r.answers?.channels||[]}),
    cuts:scenes.map(scene=>({id:scene.id,revision:scene.revision,seconds:Number(scene.duration)||3,what:scene.description||scene.title||'',say:scene.narration||'',text:scene.screenText||'',src:round.kind==='images'?scene.media?.url||assetSrc(scene)||scene.imageUrl||'':''}))};
}
// 직원 쪽 말로 옮긴 지금 상태(내부 확인의 새 의뢰 목록).
const DESK_STATE={write:'의뢰서 쓰는 중',check:'새 의뢰',ask:'답을 기다려요',model:'모델 답을 기다려요',prepare:'1차안 준비 중','prepare-images':'장면 이미지 준비 중',script:'글 콘티를 보는 중',images:'장면 이미지를 보는 중',revise:'의견 반영 중',make:'제작 중',review:'영상 확인 중',deliver:'납품'};
export function deskQueue(projects=[],when=value=>value){
  return projects.filter(p=>p.studio?.request&&p.studio.request.status!=='retired'&&!['archived','delivered'].includes(p.stage)).sort((a,b)=>String(b.studio.request.submittedAt||b.updatedAt).localeCompare(String(a.studio.request.submittedAt||a.updatedAt))).map(p=>{const state=roomState(p),a=p.studio.request.answers||{};return {id:p.id,title:p.title,meta:[KINDS.find(item=>item.id===a.kind)?.label,when(p.studio.request.submittedAt)].filter(Boolean).join(' · '),state:DESK_STATE[state]||'',tone:state==='check'?'is-new':''};});
}
// 내부 확인 화면: 답을 그대로 믿지 않고 빠진 칸을 코드가 먼저 짚는다. 판단(묻기 · 넘기기)은 사람이 한다.
export function deskChecks(p){
  const r=requestOf(p);if(!r)return [];
  const a=filled(r),files=r.files||[],checks=[];
  for(const slot of slotsFor(a.kind).filter(slot=>slot.need)){
    const got=files.filter(file=>file.slot===slot.id),none=a.slots?.[slot.id]?.none;
    checks.push(got.length?{ok:true,label:`${slot.label} ${got.length}개를 받았어요`}:{ok:false,label:`${slot.label}이 없어요`,note:none?'손님이 지금 없다고 표시했어요.':'비워 두고 보냈어요.'});
  }
  checks.push(a.channels?.length?{ok:true,label:'올릴 곳을 알려 주셨어요'}:{ok:false,label:'올릴 곳이 비어 있어요',note:'저희가 제안해요.'});
  if(!a.models?.length&&a.modelChoice!=='none'&&r.modelProposal?.status!=='accepted')checks.push({ok:false,label:'모델을 제안해 확인받아야 해요',note:r.modelProposal?.status==='open'?'제안을 보냈어요. 답을 기다려요.':r.modelProposal?.answer?`손님 답: ${r.modelProposal.answer}`:'글 콘티를 보내기 전에 먼저 정해요.'});
  const claim=(a.screenText||'').split('\n').find(line=>/\d|출시|할인|무료|한정/.test(line))?.trim();
  if(claim){const answered=(r.asks||[]).find(ask=>ask.status==='answered'&&ask.label.includes(claim));checks.push(answered?{ok:true,label:'화면 글자 사실을 확인받았어요',note:`손님 답: ${answered.answer||answered.fileName||'파일로 답했어요'}`}:{ok:false,label:'화면 글자에 사실 확인이 필요해요',note:`「${claim}」이 확정인지 물어봐요.`});}
  const words=[...(a.avoid||[])].filter(word=>a.screenText?.includes(word)||a.oneThing?.includes(word));
  if(words.length)checks.push({ok:false,label:'피할 말이 글에 들어 있어요',note:words.join(', ')});
  if(a.approver==='many')checks.push({ok:false,label:'여러 명이 확인해요',note:'의견을 모아 받도록 안내해요.'});
  return checks;
}
export function deskModel(p){
  const r=requestOf(p);if(!r)return null;
  const note=(r.notes||[]).at(-1)||null,assets=p?.studio?.assets||[],a=r.answers||{},proposal=r.modelProposal;
  return {id:p.id,number:r.number,status:r.status,at:r.submittedAt||'',title:p.title,contact:p.contact||'',brief:briefRows(filled(r)).map(row=>[row.key,row.missing==='없음'?'없음':row.missing?`비어 있음 — ${row.missing}`:row.value]),files:assets.filter(asset=>asset.mimeType?.startsWith('image/')).map(asset=>({src:assetUrl(asset),label:asset.fileName,size:''})),attachments:[...assets.filter(asset=>!asset.mimeType?.startsWith('image/')&&assetUrl(asset)).map(asset=>({id:asset.id,label:asset.fileName,url:assetUrl(asset)})),...(p.intake?.files||[]).map(file=>({id:file.id,label:file.fileName,url:`/api/client-projects/${p.id}/intake-files/${file.id}`}))],checks:deskChecks(p),note,asks:r.asks||[],rounds:r.rounds||[],modelProposal:proposal?{...proposal,modelName:modelCard(proposal.modelId)?.name||''}:null,needsModel:!a.models?.length&&a.modelChoice!=='none'&&proposal?.status!=='accepted'&&proposal?.status!=='open',confirmed:r.status==='confirmed'};
}
