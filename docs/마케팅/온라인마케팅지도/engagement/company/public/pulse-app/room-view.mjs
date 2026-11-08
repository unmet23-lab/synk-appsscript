import {CASTING_MODELS} from './casting-catalog.mjs';
import {KINDS,MODEL_LINES,briefRows,slotsFor,emptyAnswers,ratioOf,pkgOf,PACKAGES,price,channelText} from './request-data.mjs';

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
  // 영상 전 확인 1/3은 방향과 모델(11-07). 옛 프로젝트의 열린 모델 제안은 그대로 돈다.
  if(!round&&r.directionProposal?.status==='open')return 'direction';
  if(!round&&r.directionProposal?.status==='declined')return 'redirect';
  if(r.modelProposal?.status==='open')return 'model';
  if(round&&!round.approvedAt&&!round.feedbackAt)return round.kind==='script'?'script':'images';
  if(round&&!round.approvedAt)return 'revise';
  if(round?.kind==='script'&&round.approvedAt)return 'prepare-images';
  if(r.status==='confirmed')return 'prepare';
  return 'check';
}
// 단계는 다섯(판 3, 11-08): 영상 확인과 납품은 같은 화면이라 한 단계다.
export const ROOM_STAGES=Object.freeze([
  {id:'request',no:'01',name:'의뢰서'},{id:'check',no:'02',name:'확인'},{id:'draft',no:'03',name:'1차안'},
  {id:'make',no:'04',name:'제작'},{id:'review',no:'05',name:'영상 · 납품'},
]);
const STAGE_OF={write:'request',check:'check',ask:'check',direction:'draft',redirect:'draft',model:'draft',prepare:'draft','prepare-images':'draft',script:'draft',images:'draft',revise:'draft',make:'make',review:'review',deliver:'review'};
export const roomStage=state=>STAGE_OF[state]||'check';
// 단계 id · 옛 탭 이름을 고객 방의 화면 하나로. 머리의 단계 줄 · 방 안 이동 · 알림 이동이 이것만 쓴다.
// 묻기(contact)는 판 3b부터 화면이 아니라 일지다 — 옛 이름으로 오면 고객 방(app.mjs가 일지를 연다).
export const roomTab=id=>id==='history'||id==='review'?'review':['draft','films','pick'].includes(id)?id:'overview';
// 알림을 누르면 의뢰 흐름 손님이 갈 화면. 대화(담당자 답 · 자동 안내 · 프로젝트 답변)는 화면을 옮기지 않고 지금 화면의 일지 그 줄로(tab ''),
// 최종본은 영상 화면의 그 최종본, 옛 탭 소식은 고객 방.
export function roomRoute(item,p){
  if(item?.tab==='history')return {tab:'review',versionId:item.versionId||finals(p).at(-1)?.id||'',focus:'delivery'};
  if(item?.tab==='review'){
    if(item.feedbackRoundId||item.target==='approval')return {tab:'review',versionId:item.versionId||''};
    if(item.messageId)return {tab:'',versionId:'',journal:'m:'+item.messageId};
    if(item.commentId)return {tab:'',versionId:'',journal:'c:'+item.commentId};
    return {tab:'review',versionId:item.versionId||''};
  }
  if(item?.tab==='draft')return {tab:lastRound(requestOf(p))?'draft':'overview',versionId:''};
  return {tab:'overview',versionId:''};
}
// 영상 전 세 번 확인 중 몇 번째인지. 손님이 지금 어디쯤인지 한눈에 보이게 한다.
export const CONFIRM_OF=Object.freeze({direction:'1/3',model:'1/3',script:'2/3',images:'3/3'});
export const ROOM_COPY={
  write:{turn:'you',title:'의뢰서를 써 주세요',text:'제품 이름, 올릴 곳, 사진 몇 장이면 시작할 수 있어요. 모르는 칸은 저희가 제안해요.',action:{label:'의뢰서 쓰기',go:'write'}},
  check:{turn:'us',title:'지금은 저희 차례예요',text:'보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 확인이 끝나면 방향 두 안을 보내 드려요.'},
  ask:{turn:'you',title:'이것만 더 알려 주세요',text:'아래 칸만 채워 주시면 바로 1차안을 만들어요.'},
  direction:{turn:'you',title:'두 방향 중 하나를 골라 주세요',text:'요청하신 내용은 그대로 두고, 무엇으로 기억에 남길지만 나눠 봤어요. 고르시면 글 콘티를 보내 드려요.'},
  redirect:{turn:'us',title:'새 방향을 준비하고 있어요',text:'주신 말씀으로 같은 값에 한 번 더 제안해 드려요.'},
  model:{turn:'you',title:'이 모델로 갈까요?',text:'장면을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.'},
  prepare:{turn:'us',title:'1차안을 만들고 있어요',text:'광고가 남길 한 문장과 글 콘티를 먼저 보내 드려요.'},
  'prepare-images':{turn:'us',title:'장면 이미지를 만들고 있어요',text:'확인하신 글 콘티대로 컷마다 장면 이미지를 만들어요. 다 되면 알려 드려요.'},
  script:{turn:'you',title:'글 콘티가 도착했어요',text:'한 문장과 컷마다 들어갈 내용을 봐 주세요. 맞으면 장면 이미지를 만들어요.',action:{label:'글 콘티 보기',go:'draft'}},
  images:{turn:'you',title:'장면 이미지가 도착했어요',text:'컷마다 보고 의견을 남겨 주세요. 괜찮으면 그대로 제작을 시작해요.',action:{label:'장면 이미지 보기',go:'draft'}},
  revise:{turn:'us',title:'의견을 반영하고 있어요',text:'보내 주신 의견대로 고쳐서 새 판을 보내 드려요.'},
  make:{turn:'us',title:'확인하신 컷으로 만들고 있어요',text:'목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 다음에 받으실 것은 소리까지 들어간 영상이에요.'},
  review:{turn:'you',title:'영상이 도착했어요',text:'영상을 보면서 고칠 시점에 의견을 남겨 주세요.',action:{label:'영상 보기',go:'review'}},
  deliver:{turn:'you',title:'완성본을 받으세요',text:'올릴 곳에 맞는 파일을 내려받으실 수 있어요.',action:{label:'파일 받기',go:'review'}},
};
export const modelCard=id=>{const item=CASTING_MODELS.find(model=>model.id===id);return item?{id,name:item.name,line:MODEL_LINES[id]?.line||item.description,image:item.image}:null;};
const assetUrl=asset=>asset?.media?.url||asset?.url||'';
function slotsWithFiles(answers,files=[]){const slots={...(answers.slots||{})};for(const file of files){slots[file.slot]={...slots[file.slot],files:[...(slots[file.slot]?.files||[]),file]};}return slots;}
const filled=r=>({...emptyAnswers(),...(r?.answers||{}),slots:slotsWithFiles(r?.answers||{},r?.files)});
// 영상이 도착한 상태면 고객 방 스크린에 그 영상을 소리 없이 튼다.
const screenFilm=(p,state)=>{const version=state==='deliver'?finals(p).at(-1):state==='review'?previews(p).at(-1):null,src=version?.media?.mimeType?.startsWith('video/')?version.media.url:'';return src?{src,label:version.label,go:'review'}:null;};
// 보내 주신 의뢰서: 길이 · 구성 다음에 받으실 날(접수일 + 기간, 달력 기준 — 결정 11-07)을 둔다.
function roomBrief(r,answers){
  const rows=briefRows(answers).filter(row=>!row.missing).slice(0,8).map(row=>[row.key,row.value]),pkg=pkgOf(answers),at=rows.findIndex(([key])=>key==='길이 · 구성');
  // 날짜는 방향을 보내 드릴 때 한 번 정해 보인다(결제 · 자료 시점이 정해지기 전 달력 날짜를 약속하지 않는다 — 설계 검토 3).
  // 방향 제안이 오면 거기 적힌 날 하나만 보인다(같은 화면에 날짜 둘이 서지 않게 — 설계 검토 9).
  const due=r.directionProposal?.dueDate;
  if(r.submittedAt&&at>=0)rows.splice(at+1,0,['받으실 날',due?`${Number(due.slice(5,7))}월 ${Number(due.slice(8,10))}일 · 방향 제안에 적힌 날`:pkg?.days?(pkg.photo?`자료가 다 모인 날부터 ${pkg.days}일`:`자료가 다 모인 날부터 ${pkg.days}일 · 날짜는 방향을 보내 드릴 때 알려 드려요`):'구성에 맞춰 함께 정해요']);
  return rows;
}
export function roomModel(p){
  const r=requestOf(p),state=roomState(p),answers=filled(r);
  const slotLabel=asset=>slotsFor(answers.kind).find(slot=>slot.id===(r?.files||[]).find(file=>file.id===asset.id)?.slot)?.label||'';
  // 받은 자료 칸에는 손님이 보낸 파일만 둔다. 직원이 올린 장면 그림이 여기 섞이면 보내기 전의 작업물이 손님에게 보인다.
  const sent=new Set((r?.files||[]).map(file=>file.id));
  const images=(p?.studio?.assets||[]).filter(asset=>sent.has(asset.id)&&assetUrl(asset)&&asset.mimeType?.startsWith('image/'));
  const files=images.slice(0,6).map(asset=>({src:assetUrl(asset),label:slotLabel(asset)||asset.fileName,size:''}));
  const shown=new Set(files.map(file=>file.src)),drawn=new Set(images.map(asset=>asset.id)),others=[...images.filter(asset=>!shown.has(assetUrl(asset))).map(asset=>asset.fileName),...(r?.files||[]).filter(file=>!drawn.has(file.id)).map(file=>file.fileName)];
  const proposed=r?.modelProposal?.status==='open'?modelCard(r.modelProposal.modelId):null,proposal=proposed?{...proposed,note:r.modelProposal.note||''}:null,direction=directionModel(p);
  return {
    state,stage:roomStage(state),photo:answers.package==='photo',options:r?.directionProposal?.options?.length||0,title:p?.title||'',number:r?.number||'',manager:p?.ownerName||'PULSE 담당자',hasRound:!!lastRound(r),lastKind:lastRound(r)?.kind||'',
    brief:r?roomBrief(r,answers):[],
    files,others,proposal,direction,asks:(r?.asks||[]).filter(ask=>ask.status==='open'),answered:(r?.asks||[]).filter(ask=>ask.status==='answered'),canEdit:!!r&&r.status!=='confirmed',
    draft:['script','images','revise','prepare-images'].includes(state)?draftModel(p):null,film:screenFilm(p,state),
    // 메일 알림이 실제로 나갈 때만 가린 주소(서버가 정함). 꺼져 있으면 화면에 메일 말이 없다.
    mail:p?.mail?.mailOn&&typeof p.mail.mailTo==='string'?p.mail.mailTo:'',
  };
}
// 방향 제안(영상 전 확인 1/3)을 화면 자료로. 그림 · 견본은 손님 보기의 자산 주소, 값 · 기간은 제안에 적힌 것(손님이 실제로 내는 값 · 정한 날).
const assetById=(p,id)=>(p?.studio?.assets||[]).find(asset=>asset.id===id);
const won=value=>value>=10000&&value%1000===0?price(value/10000):`${Number(value).toLocaleString('ko-KR')}원`;
const longDay=day=>{const [y,m,d]=String(day||'').split('-').map(Number);return y?`${m}월 ${d}일`:'';};
export function directionModel(p){
  const r=requestOf(p),d=r?.directionProposal;if(!d)return null;
  const a=r.answers||{},pkg=PACKAGES.find(item=>item.id===a.package);
  const options=d.options.map((option,i)=>({id:option.id,no:String(i+1).padStart(2,'0'),name:option.name,sentence:option.sentence,flow:option.flow,why:option.why||'',recommended:!!option.recommended,src:assetUrl(assetById(p,option.assetId)),film:option.filmAssetId?assetUrl(assetById(p,option.filmAssetId)):'',filmNote:option.filmNote||'',workId:option.workId||''}));
  const chosen=options.find(option=>option.id===d.chosenId)||null;
  return {round:d.round,status:d.status,lead:d.lead||'',options,chosen,note:d.answer||'',model:d.modelId?modelCard(d.modelId):null,noModel:!d.modelId,kind:a.kind||'',
    price:won(d.price),due:longDay(d.dueDate),dueDate:d.dueDate||'',revisions:d.revisions,title:p?.title||'',line:[pkg?`${pkg.label}`:'',channelText({channels:a.channels||[]})].filter(Boolean).join(' · '),gets:pkg?.gets||'',photo:!!pkg?.photo,
    canPick:['open','chosen'].includes(d.status)&&!lastRound(r),last:d.round>=2};
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
// ── 일지(판 3b) ──
// 담당자가 한 말과 손님이 한 일을 한 줄기로. 손님 보기에 이미 오는 필드만 쓴다(서버 읽음 기록 없음). 그리기는 film-views.mjs journalView.
// 줄 종류: talk(말 — 전문), quote(일감의 말 — 첫 줄만, 정본은 그 일감), event(한 일 — 한 줄). 새 것이 위.
const timeOf=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:null;};
const both=n=>n>2?'모두':'둘 다';
const withEul=word=>{const last=String(word).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);return code>=0xAC00&&code<=0xD7A3&&(code-0xAC00)%28?'을':'를';};
const roundName=round=>`${round.kind==='script'?'글 콘티':'장면 이미지'} ${round.round}판`;
export function journalModel(p){
  const r=requestOf(p),st=p?.studio||{},owner=p?.ownerName||'PULSE 담당자',items=[];
  const add=item=>{items.push({text:'',go:null,...item,t:item.t??timeOf(item.at)});};
  if(r?.submittedAt)add({id:'q:sent',at:r.submittedAt,who:'me',name:'나',kind:'event',what:'의뢰서를 보냈어요'});
  if(r?.confirmedAt)add({id:'q:ok',at:r.confirmedAt,who:'staff',name:r.confirmedBy||owner,kind:'event',what:'의뢰서를 확인했어요'});
  for(const ask of r?.asks||[])if(ask.status==='answered')add({id:'a:'+ask.id,at:ask.answeredAt||ask.at,who:'me',name:'나',kind:'talk',what:`「${ask.label}」에 답했어요`,text:ask.answer||(ask.fileName?`파일 ${ask.fileName}`:'')});
  const model=r?.modelProposal,modelName=id=>modelCard(id)?.name||'';
  if(model?.at&&modelName(model.modelId)){
    const name=modelName(model.modelId);
    add(model.note?{id:'o:'+model.at,at:model.at,who:'staff',name:model.by||owner,kind:'quote',what:`모델 제안 · ${name}`,text:model.note,go:model.status==='open'?{tab:'overview'}:null}:{id:'o:'+model.at,at:model.at,who:'staff',name:model.by||owner,kind:'event',what:`모델 ${name}${withEul(name)} 제안했어요`});
    if(model.answeredAt&&model.status==='accepted'){const chosen=modelName(r.answers?.models?.[0])||name;add({id:'o:'+model.at+':ok',at:model.answeredAt,who:'me',name:'나',kind:model.answer?'talk':'event',what:`모델 ${chosen}${withRoOf(chosen)} 정했어요`,text:model.answer||''});}
    if(model.answeredAt&&model.status==='declined')add({id:'o:'+model.at+':no',at:model.answeredAt,who:'me',name:'나',kind:'talk',what:'모델을 말로 알려 드렸어요',text:model.answer||''});
  }
  const d=r?.directionProposal;
  if(d?.at){
    const t=timeOf(d.at),count=d.options?.length||2;
    // 다시 받은 제안이면 앞 판의 답(시각 없음)을 이 줄 바로 앞에 둔다.
    if(d.prior)add({id:'d:'+d.prior.round+':no',at:'',t:t===null?null:t-1,who:'me',name:'나',kind:d.prior.answer?'talk':'event',what:`방향 제안 ${d.prior.round}판 · ${(d.prior.names||[]).map(name=>`「${name}」`).join(' ')} ${both((d.prior.names||[]).length)} 아니에요`,text:d.prior.answer||''});
    const pickable=['open','chosen'].includes(d.status)&&!lastRound(r);
    add({id:'d:'+d.round,at:d.at,who:'staff',name:d.by||owner,kind:'quote',what:`방향 제안${d.round>1?` ${d.round}판`:''}`,text:d.lead||`${count}가지 방향을 보내 드렸어요`,go:pickable?{tab:'pick'}:null});
    const chosen=d.options?.find(option=>option.id===d.chosenId);
    if(d.answeredAt&&d.status==='declined')add({id:'d:'+d.round+':no',at:d.answeredAt,who:'me',name:'나',kind:d.answer?'talk':'event',what:`방향 ${both(count)} 아니에요`,text:d.answer||''});
    if(d.answeredAt&&chosen&&d.status==='chosen')add({id:'d:'+d.round+':ok',at:d.answeredAt,who:'me',name:'나',kind:d.answer?'talk':'event',what:`「${chosen.name}」${withRoOf(chosen.name)} 정했어요`,text:d.answer?`덧붙인 말 · ${d.answer}`:''});
    if(d.answeredAt&&chosen&&d.status==='settled')add({id:'d:'+d.round+':ok',at:d.answeredAt,who:'staff',name:d.settledBy||owner,kind:d.answer?'talk':'event',what:`「${chosen.name}」${withRoOf(chosen.name)} 함께 정했어요`,text:d.answer||''});
  }
  const rounds=r?.rounds||[],last=rounds.at(-1);
  for(const round of rounds){
    const name=roundName(round);
    add(round.note?{id:'r:'+round.round,at:round.sentAt,who:'staff',name:round.by||owner,kind:'quote',what:name,text:round.note,go:round===last?{tab:'draft'}:null}:{id:'r:'+round.round,at:round.sentAt,who:'staff',name:round.by||owner,kind:'event',what:`${name}${withEul(name)} 보냈어요`,go:round===last?{tab:'draft'}:null});
    if(round.feedbackAt)add({id:'r:'+round.round+':fix',at:round.feedbackAt,who:'me',name:'나',kind:'event',what:round.changes?`${name}에 고칠 곳 ${round.changes}개를 보냈어요`:`${name} 컷 확인을 보냈어요`});
    if(round.approvedAt)add({id:'r:'+round.round+':ok',at:round.approvedAt,who:'me',name:'나',kind:'event',what:`${name}${withEul(name)} 확인했어요`});
  }
  for(const v of p?.versions||[]){
    if(!['preview','final'].includes(v.kind))continue;
    const name=v.kind==='final'?`최종본 ${v.label}`:v.label,go={tab:'review',versionId:v.id,...(v.kind==='final'?{final:true}:{})};
    add(v.guide?{id:'v:'+v.id,at:v.createdAt,who:'staff',name:owner,kind:'quote',what:name,text:v.guide,go}:{id:'v:'+v.id,at:v.createdAt,who:'staff',name:owner,kind:'event',what:`${name}${josaOf(name)} 도착했어요`,go});
    if(v.kind==='preview'&&v.approvedAt)add({id:'v:'+v.id+':ok',at:v.approvedAt,who:'me',name:'나',kind:'event',what:`${v.label}${withEul(v.label)} 승인했어요`});
  }
  for(const fb of st.feedbackRounds?.rounds||[])if(fb.submittedAt)add({id:'f:'+fb.id,at:fb.submittedAt,who:'me',name:'나',kind:'event',what:`${fb.versionLabel||'영상'}에 의견 ${(fb.items||[]).length}개를 보냈어요`});
  // 문의와 답: 3a 묻기 화면과 같은 거름(영상 의견 하나하나는 영상 화면에만).
  for(const m of p?.messages||[])if(m.action==='support'&&m.author!=='staff'||m.author==='staff')add({id:'m:'+m.id,ref:m.id,at:m.at,who:m.author==='staff'?(m.automated?'auto':'staff'):'me',name:m.author==='staff'?(m.automated?'자동 안내':m.authorName||owner):'나',kind:'talk',what:m.author==='staff'?'':'문의',text:m.text||''});
  for(const c of st.comments||[])if(c.targetType==='project')add({id:'c:'+c.id,ref:c.id,at:c.at,who:c.author==='customer'?'me':'staff',name:c.author==='customer'?'나':c.authorName||owner,kind:'talk',what:'',text:c.text||''});
  const receipt=p?.closeout?.receipt;
  if(receipt?.confirmedAt)add({id:'k:'+(p.closeout.deliveryKey||'now'),at:receipt.confirmedAt,who:'me',name:'나',kind:'event',what:'파일과 안내를 확인했어요'});
  // 새 것이 위. 시각이 같으면 받은 것 → 내 것 차례, 시각을 못 읽는 줄은 맨 아래.
  items.sort((a,b)=>(b.t??-Infinity)-(a.t??-Infinity)||(a.who==='me')-(b.who==='me'));
  const asks=(r?.asks||[]).filter(ask=>ask.status==='open').map(ask=>({id:ask.id,label:ask.label,why:ask.why||'',at:ask.at,t:timeOf(ask.at)}));
  const latestAt=Math.max(0,...items.map(item=>item.t||0),...asks.map(ask=>ask.t||0));
  return {pinned:{asks,next:String(p?.nextStep||'').trim()},items,latestAt};
}
const josaOf=word=>{const last=String(word).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);if(code>=0xAC00&&code<=0xD7A3)return (code-0xAC00)%28?'이':'가';return /[0-9]/.test(last)?('013678'.includes(last)?'이':'가'):'이';};
function withRoOf(word){const last=String(word).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);const batchim=code>=0xAC00&&code<=0xD7A3?(code-0xAC00)%28:/[0-9]/.test(last)?('013678'.includes(last)?1:0):1;return batchim&&batchim!==8?'으로':'로';}
// 「본 시각」보다 뒤에 온 담당자 · 자동 안내 줄과 열린 되묻기 수. 머리 「나눈 말」 숫자.
export const journalNew=(j,seen)=>Number.isFinite(seen)?j.items.filter(item=>item.who!=='me'&&item.t>seen).length+j.pinned.asks.filter(ask=>ask.t>seen).length:0;
// 직원 쪽 말로 옮긴 지금 상태(내부 확인의 새 의뢰 목록).
const DESK_STATE={write:'의뢰서 쓰는 중',check:'새 의뢰',ask:'답을 기다려요',direction:'방향 답을 기다려요',redirect:'방향을 다시 제안해요',model:'모델 답을 기다려요',prepare:'1차안 준비 중','prepare-images':'장면 이미지 준비 중',script:'글 콘티를 보는 중',images:'장면 이미지를 보는 중',revise:'의견 반영 중',make:'제작 중',review:'영상 확인 중',deliver:'납품'};
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
  const direction=r.directionProposal;
  if(direction)checks.push(['chosen','settled'].includes(direction.status)?{ok:true,label:`손님이 방향 「${direction.options.find(option=>option.id===direction.chosenId)?.name||''}」${direction.status==='settled'?'으로 정리했어요':'을 골랐어요'}`,note:direction.answer?`손님 말: ${direction.answer}`:''}:direction.status==='declined'?{ok:false,label:direction.round>=2?'두 번째 방향도 아니래요 — 손님과 이야기해 정리해 주세요':'손님이 두 방향 다 아니래요',note:direction.answer?`손님 말: ${direction.answer}`:''}:{ok:false,label:'방향 제안을 보냈어요',note:'손님 답을 기다려요.'});
  else if(!a.models?.length&&a.modelChoice!=='none'&&r.modelProposal?.status!=='accepted')checks.push({ok:false,label:'모델을 제안해 확인받아야 해요',note:r.modelProposal?.status==='open'?'제안을 보냈어요. 답을 기다려요.':r.modelProposal?.answer?`손님 답: ${r.modelProposal.answer}`:'글 콘티를 보내기 전에 먼저 정해요.'});
  const claim=(a.screenText||'').split('\n').find(line=>/\d|출시|할인|무료|한정/.test(line))?.trim();
  if(claim){const answered=(r.asks||[]).find(ask=>ask.status==='answered'&&ask.label.includes(claim));checks.push(answered?{ok:true,label:'화면 글자 사실을 확인받았어요',note:`손님 답: ${answered.answer||answered.fileName||'파일로 답했어요'}`}:{ok:false,label:'화면 글자에 사실 확인이 필요해요',note:`「${claim}」이 확정인지 물어봐요.`});}
  const words=[...(a.avoid||[])].filter(word=>a.screenText?.includes(word)||a.oneThing?.includes(word));
  if(words.length)checks.push({ok:false,label:'피할 말이 글에 들어 있어요',note:words.join(', ')});
  if(a.approver==='many')checks.push({ok:false,label:'여러 명이 확인해요',note:'의견을 모아 받도록 안내해요.'});
  // 고객 방에는 옛 제작 설계 확인이 보이지 않는다(뒷문을 막았다). 요청해 두면 손님이 모른 채 기다리게 된다.
  const st=p.studio?.strategy;if(st?.request&&Number(st.request.strategyRevision)===Number(st.revision)&&Number(st.confirmation?.strategyRevision)!==Number(st.revision))checks.push({ok:false,label:'고객 방에는 제작 설계 확인이 보이지 않아요',note:'물을 것은 「빠진 것 다시 묻기」로 보내 주세요.'});
  return checks;
}
export function deskModel(p){
  const r=requestOf(p);if(!r)return null;
  const note=(r.notes||[]).at(-1)||null,assets=p?.studio?.assets||[],a=r.answers||{},proposal=r.modelProposal,direction=r.directionProposal;
  const canDirect=r.status==='confirmed'&&!(r.rounds||[]).length&&a.package!=='photo'&&(!direction||direction.status==='open'||direction.status==='declined'&&direction.round<2);
  return {id:p.id,number:r.number,status:r.status,at:r.submittedAt||'',title:p.title,contact:p.contact||'',mail:p.mail||null,brief:briefRows(filled(r)).map(row=>[row.key,row.missing==='없음'?'없음':row.missing?`비어 있음 — ${row.missing}`:row.value]),files:assets.filter(asset=>asset.mimeType?.startsWith('image/')).map(asset=>({src:assetUrl(asset),label:asset.fileName,size:''})),attachments:[...assets.filter(asset=>!asset.mimeType?.startsWith('image/')&&assetUrl(asset)).map(asset=>({id:asset.id,label:asset.fileName,url:assetUrl(asset)})),...(p.intake?.files||[]).map(file=>({id:file.id,label:file.fileName,url:`/api/client-projects/${p.id}/intake-files/${file.id}`}))],checks:deskChecks(p),note,asks:r.asks||[],rounds:r.rounds||[],modelProposal:proposal?{...proposal,modelName:modelCard(proposal.modelId)?.name||''}:null,needsModel:!direction&&!canDirect&&!a.models?.length&&a.modelChoice!=='none'&&proposal?.status!=='accepted'&&proposal?.status!=='open',confirmed:r.status==='confirmed',
    direction:direction?{round:direction.round,status:direction.status,names:direction.options.map(option=>option.name),chosen:direction.options.find(option=>option.id===direction.chosenId)?.name||'',answer:direction.answer||'',options:direction.options.map(option=>({id:option.id,name:option.name}))}:null,
    canDirect,
    canSettle:direction?.status==='declined'&&direction.round>=2&&!(r.rounds||[]).length};
}
