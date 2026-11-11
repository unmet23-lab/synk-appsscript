import {CASTING_MODELS,modelLooks} from './casting-catalog.mjs';
import {KINDS,MODEL_LINES,briefRows,slotsFor,emptyAnswers,ratioOf,pkgOf,PACKAGES,price,channelText} from './request-data.mjs';
import {t,k,locale,intlLocale} from './i18n.mjs';
import {castingOf,MODEL_OPTIONAL_CHOICES} from './casting-choice.mjs';
import {personaModel,personaJournal,personaFace} from './persona-view.mjs';

// 실제 프로젝트를 슬레이트 판 화면(film-views.mjs)의 자료로 옮긴다. 판단은 여기 한 곳에서 한다.
// 흐름: 의뢰서 → 확인(되묻기) → 1차안(모델 → 글 콘티 판 → 장면 이미지 판) → 제작 → 영상 확인 → 납품. 공개 약속 「영상 전에 세 번 확인」과 같은 순서다.
export const usesRoom=p=>!!(p?.requestFlow||p?.studio?.request);
const requestOf=p=>p?.studio?.request||null;
const previews=p=>(p?.versions||[]).filter(v=>v.kind==='preview');
const finals=p=>(p?.versions||[]).filter(v=>v.kind==='final');
const lastRound=r=>(r?.rounds||[]).at(-1)||null;

// 결제 차례(판 4, 결정 11-10 D2): 결제가 확인되지 않았고 ① 담당자가 크몽 결제를 요청했거나(취소 뒤 포함) ② 영상은 글 콘티를 승인했고 장면 이미지 판이 아직 없을 때 · 사진은 첫 장을 승인했을 때.
// 서버가 결제 상태를 아직 모르는 판(payment 없음)도 ②로 같은 카드를 띄운다 — 담당자는 결제를 확인한 뒤 장면 이미지 판을 보낸다.
export function payState(r){
  if(!r||r.payment?.status==='confirmed')return false;
  if(r.payment?.status==='requested'||r.payment?.status==='cancelled')return true;
  if(r.answers?.package==='photo')return (r.rounds||[]).some(round=>round.kind==='images'&&round.approvedAt);
  return !!r.scriptApprovedAt&&!(r.rounds||[]).some(round=>round.kind==='images');
}
export function roomState(p){
  const r=requestOf(p),round=lastRound(r);
  // 수령 확인을 남긴 뒤에는 누구의 차례도 아니다(끝맺음 — 판 4 B4).
  if(p?.stage==='delivered'||finals(p).length)return p?.closeout?.receipt?'done':'deliver';
  if(previews(p).length)return 'review';
  if(r?.approvedAt||p?.stage==='producing')return 'make';
  if(!r||r.status==='writing')return 'write';
  if(r.asks?.some(ask=>ask.status==='open'))return 'ask';
  if(payState(r))return 'pay';
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
// 이름은 한국어 원문이다 — 화면은 film-views.mjs stageName이 단계 문맥(stage)의 문장으로 옮겨 그린다(「확인」이 의뢰서 칸 이름과 영어가 갈려 k로 감싸지 않는다).
export const ROOM_STAGES=Object.freeze([
  {id:'request',no:'01',name:'의뢰서'},{id:'check',no:'02',name:'확인'},{id:'draft',no:'03',name:'1차안'}, // i18n-skip
  {id:'make',no:'04',name:'제작'},{id:'review',no:'05',name:'영상 · 납품'}, // i18n-skip
]);
const STAGE_OF={write:'request',check:'check',ask:'check',direction:'draft',redirect:'draft',model:'draft',prepare:'draft','prepare-images':'draft',script:'draft',images:'draft',revise:'draft',pay:'draft',make:'make',review:'review',deliver:'review',done:'review'};
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
// 글은 한국어 원문으로 두고(k — 번역 표시만) 그리는 자리(film-views.mjs roomView · copyOf)에서 그 언어로 옮긴다.
export const ROOM_COPY={
  write:{turn:'you',title:k('의뢰서를 써 주세요'),text:k('제품 이름, 올릴 곳, 사진 몇 장이면 시작할 수 있어요. 모르는 칸은 저희가 제안해요.'),action:{label:k('의뢰서 쓰기'),go:'write'}},
  check:{turn:'us',title:k('지금은 저희 차례예요'),text:k('보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 확인이 끝나면 방향 두 안을 보내 드려요.')},
  ask:{turn:'you',title:k('이것만 더 알려 주세요'),text:k('아래 칸만 채워 주시면 바로 1차안을 만들어요.')},
  direction:{turn:'you',title:k('두 방향 중 하나를 골라 주세요'),text:k('요청하신 내용은 그대로 두고, 무엇으로 기억에 남길지만 나눠 봤어요. 고르시면 글 콘티를 보내 드려요.')},
  redirect:{turn:'us',title:k('새 방향을 준비하고 있어요'),text:k('주신 말씀으로 같은 값에 한 번 더 제안해 드려요.')},
  model:{turn:'you',title:k('이 모델로 갈까요?'),text:k('장면을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.')},
  prepare:{turn:'us',title:k('1차안을 만들고 있어요'),text:k('광고가 남길 한 문장과 글 콘티를 먼저 보내 드려요.')},
  'prepare-images':{turn:'us',title:k('장면 이미지를 만들고 있어요'),text:k('확인하신 글 콘티대로 컷마다 장면 이미지를 만들어요. 다 되면 알려 드려요.')},
  script:{turn:'you',title:k('글 콘티가 도착했어요'),text:k('한 문장과 컷마다 들어갈 내용을 봐 주세요. 맞으면 장면 이미지를 만들어요.'),action:{label:k('글 콘티 보기'),go:'draft'}},
  images:{turn:'you',title:k('장면 이미지가 도착했어요'),text:k('컷마다 보고 의견을 남겨 주세요. 괜찮으면 그대로 제작을 시작해요.'),action:{label:k('장면 이미지 보기'),go:'draft'}},
  revise:{turn:'us',title:k('의견을 반영하고 있어요'),text:k('보내 주신 의견대로 고쳐서 새 판을 보내 드려요.')},
  make:{turn:'us',title:k('확인하신 컷으로 만들고 있어요'),text:k('목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 다음에 받으실 것은 소리까지 들어간 영상이에요.')},
  review:{turn:'you',title:k('영상이 도착했어요'),text:k('영상을 보면서 고칠 시점에 의견을 남겨 주세요.'),action:{label:k('영상 보기'),go:'review'}},
  deliver:{turn:'you',title:k('완성본을 받으세요'),text:k('올릴 곳에 맞는 파일을 내려받으실 수 있어요.'),action:{label:k('파일 받기'),go:'review'}},
  pay:{turn:'you',title:k('글 콘티를 확인해 주셨어요'),text:k('이제 크몽에서 결제해 주세요. 결제가 확인되면 장면 이미지를 만들기 시작해요.')},
  done:{turn:'done',title:k('완성본을 받으셨어요'),text:k('함께 만들어 주셔서 고마워요. 크몽에서 작업물을 확인하시고 구매확정을 눌러 주시면 이 의뢰가 끝나요.'),action:{label:k('완성본 다시 보기'),go:'review'}},
};
export const modelCard=id=>{const item=CASTING_MODELS.find(model=>model.id===id);return item?{id,name:item.name,line:MODEL_LINES[id]?.line||item.description,image:item.image}:null;};
// 옷 · 머리(11-10): 그 모델의 옷 · 머리 id를 이름(카탈로그 한국어 — 그리는 자리에서 번역)과 사진으로. 고르지 않았거나 그 모델에 없는 값은 ''(맡김).
export function lookOf(modelId,{outfit='',hair=''}={}){
  const looks=modelLooks(modelId),o=looks?.outfits.find(item=>item.id===outfit),h=looks?.hairs.find(item=>item.id===hair);
  return {outfit:o?o.id:'',hair:h?h.id:'',outfitLabel:o?.label||'',hairLabel:h?.label||'',outfitSrc:o?.src||''};
}
// 「옷 스트라이프 원피스 · 머리 맡김」 — 고른 카드 · 글 콘티 · 일지 · 방향 화면 요약이 같은 한 줄을 쓴다.
export const lookLine=look=>t('옷 {outfit} · 머리 {hair}',{outfit:look.outfitLabel?t(look.outfitLabel):t('맡김'),hair:look.hairLabel?t(look.hairLabel):t('맡김')});
const assetUrl=asset=>asset?.media?.url||asset?.url||'';
function slotsWithFiles(answers,files=[]){const slots={...(answers.slots||{})};for(const file of files){slots[file.slot]={...slots[file.slot],files:[...(slots[file.slot]?.files||[]),file]};}return slots;}
const filled=r=>({...emptyAnswers(),...(r?.answers||{}),slots:slotsWithFiles(r?.answers||{},r?.files)});
// 영상이 도착한 상태면 고객 방 스크린에 그 영상을 소리 없이 튼다.
const screenFilm=(p,state)=>{const version=state==='deliver'||state==='done'?finals(p).at(-1):state==='review'?previews(p).at(-1):null,src=version?.media?.mimeType?.startsWith('video/')?version.media.url:'';return src?{src,label:version.label,go:'review'}:null;};
// 보내 주신 의뢰서: 길이 · 구성 다음에 받으실 날(접수일 + 기간, 달력 기준 — 결정 11-07)을 둔다.
// 「길이 · 구성」은 briefRows의 줄 이름과 견주는 값이라 번역하지 않는다(보일 때는 roomPaper가 옮긴다).
function roomBrief(r,answers){
  const rows=briefRows(answers).filter(row=>!row.missing).slice(0,8).map(row=>[row.key,row.value]),pkg=pkgOf(answers),at=rows.findIndex(([key])=>key==='길이 · 구성'); // i18n-skip
  // 날짜는 방향을 보내 드릴 때 한 번 정해 보인다(결제 · 자료 시점이 정해지기 전 달력 날짜를 약속하지 않는다 — 설계 검토 3).
  // 방향 제안이 오면 거기 적힌 날 하나만 보인다(같은 화면에 날짜 둘이 서지 않게 — 설계 검토 9).
  // 판 4(화면 검수 F1): 결제를 확인한 뒤에는 그때 정한 날(payment.dueDate — 결제일 + 기간, 담당자가 고칠 수 있음), 결제 차례에는 날짜 대신 결제 카드와 같은 「결제한 날부터 N일」.
  const due=r.directionProposal?.dueDate,paidDue=r.payment?.status==='confirmed'?r.payment.dueDate||'':'',paying=payState(r)&&pkg?.days;
  if(r.submittedAt&&at>=0)rows.splice(at+1,0,[k('받으실 날'),paidDue?t('{date} · 결제 확인 때 정한 날',{date:longDay(paidDue)}):paying?t('결제한 날부터 {days}일',{days:pkg.days}):due?t('{date} · 방향 제안에 적힌 날',{date:longDay(due)}):pkg?.days?(pkg.photo?t('자료가 다 모인 날부터 {days}일',{days:pkg.days}):t('자료가 다 모인 날부터 {days}일 · 날짜는 방향을 보내 드릴 때 알려 드려요',{days:pkg.days})):t('구성에 맞춰 함께 정해요')]);
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
    state,stage:roomStage(state),photo:answers.package==='photo',options:r?.directionProposal?.options?.length||0,title:p?.title||'',number:r?.number||'',manager:p?.ownerName||t('PULSE 담당자'),hasRound:!!lastRound(r),lastKind:lastRound(r)?.kind||'',
    brief:r?roomBrief(r,answers):[],
    files,others,proposal,direction,asks:(r?.asks||[]).filter(ask=>ask.status==='open'),answered:(r?.asks||[]).filter(ask=>ask.status==='answered'),canEdit:!!r&&r.status!=='confirmed',
    draft:['script','images','revise','prepare-images'].includes(state)?draftModel(p):null,film:screenFilm(p,state),
    // 메일 알림이 실제로 나갈 때만 가린 주소(서버가 정함). 꺼져 있으면 화면에 메일 말이 없다.
    mail:p?.mail?.mailOn&&typeof p.mail.mailTo==='string'?p.mail.mailTo:'',
    // 메일이 나가는 순간(서버가 알림 — 판 4의 여덟 순간). 옛 서버는 목록이 없어 11-07의 네 순간으로 본다.
    moments:Array.isArray(p?.mail?.moments)?p.mail.moments:['direction_proposed','draft_ready','preview_ready','final_ready'],
    pay:['pay','prepare-images'].includes(state)?payModel(p):null,
    // 고객 전용 인물(판 3): 서버 손님 보기 project.persona가 있을 때만(없으면 null — 고객 방은 판 3 전 그대로).
    persona:personaModel(p),
  };
}
// 결제 안내 카드(판 4): 값 · 받으실 날 · 수정 · 접수 번호 · 결제 상태. 값은 결제 요청에 적힌 값, 없으면 고른 방향의 값, 없으면 패키지 값.
export function payModel(p){
  const r=requestOf(p);if(!r)return null;
  const a=r.answers||{},pkg=pkgOf(a),pay=r.payment||null,d=r.directionProposal;
  const amount=Number.isSafeInteger(pay?.amount)?pay.amount:Number.isSafeInteger(d?.price)?d.price:pkg?Math.round(pkg.price*10000):null;
  const requested=Date.parse(pay?.requestedAt||'');
  return {status:pay?.status||'',requestedDay:Number.isFinite(requested)?longDay(new Date(requested+9*3600000).toISOString().slice(0,10)):'',price:amount?won(amount):'',days:pkg?.days||null,revisions:d?.revisions??pkg?.revisions??null,number:r.number||'',photo:a.package==='photo'};
}
// 방향 제안(영상 전 확인 1/3)을 화면 자료로. 그림 · 견본은 손님 보기의 자산 주소, 값 · 기간은 제안에 적힌 것(손님이 실제로 내는 값 · 정한 날).
const assetById=(p,id)=>(p?.studio?.assets||[]).find(asset=>asset.id===id);
// 값: 한국어는 만 원으로 떨어지면 「39만원」, 10만 원 아래의 천 원 단위는 「1.5만원」, 그 밖은 원 단위 그대로 「395,000원」 · 「395,500원」
// (만 원으로 반올림하지 않는다 — 395,000원이 「40만원」으로 보였다). 다른 언어는 늘 원화 그대로(request-data price — 「KRW 395,500」).
// 「원」이 붙는 갈래는 한국어 화면에서만 돈다(번역하지 않는다).
const won=value=>locale()!=='ko'||value>=10000&&(value%10000===0||value<100000&&value%1000===0)?price(value/10000):`${Number(value).toLocaleString('ko-KR')}원`; // i18n-skip
// 「11월 17일」 · 영어 「Nov 17」(사전이 {mon}을 쓴다).
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const longDay=day=>{const [y,m,d]=String(day||'').split('-').map(Number);return y?t('{m}월 {d}일',{m,d,mon:MONTHS[m-1]||''}):'';};
export function directionModel(p){
  const r=requestOf(p),d=r?.directionProposal;if(!d)return null;
  const a=r.answers||{},pkg=PACKAGES.find(item=>item.id===a.package);
  const options=d.options.map((option,i)=>({id:option.id,no:String(i+1).padStart(2,'0'),name:option.name,sentence:option.sentence,flow:option.flow,why:option.why||'',recommended:!!option.recommended,src:assetUrl(assetById(p,option.assetId)),film:option.filmAssetId?assetUrl(assetById(p,option.filmAssetId)):'',filmNote:option.filmNote||'',workId:option.workId||''}));
  const chosen=options.find(option=>option.id===d.chosenId)||null,canPick=['open','chosen'].includes(d.status)&&!lastRound(r);
  // 옷 · 머리(11-10, 설계 4-1): 이 서버가 받는다고 알리고(castingLooks) 카탈로그 모델로 가는 방향을 고를 수 있을 때만 줄을 그린다.
  // 맞춤 인물 요청 · 전용 인물은 줄이 없다. 처음 값(look)은 같은 모델로 앞서 고른 값 — 의뢰 기록(answers)에서 읽어
  // 다시 보낸 제안(2회차)에서도 「맡김」으로 지워지지 않는다. 모델이 다르면 맡김. picked는 그때 고른 값의 기록(고른 카드가 읽는다).
  const persona=['custom','persona'].includes(a.modelChoice)||castingOf(r,p?.studio?.strategy?.data?.castingSelection).kind==='persona';
  const looks=!!r.castingLooks&&!!d.modelId&&!!modelLooks(d.modelId)&&canPick&&!persona;
  const look=looks&&a.models?.[0]===d.modelId?lookOf(d.modelId,a):lookOf('');
  const picked=d.modelId&&d.look&&modelLooks(d.modelId)?lookOf(d.modelId,d.look):null;
  return {round:d.round,status:d.status,lead:d.lead||'',options,chosen,note:d.answer||'',model:d.modelId?modelCard(d.modelId):null,noModel:!d.modelId,kind:a.kind||'',
    price:won(d.price),due:longDay(d.dueDate),dueDate:d.dueDate||'',revisions:d.revisions,title:p?.title||'',line:[pkg?t(pkg.label):'',channelText({channels:a.channels||[]})].filter(Boolean).join(' · '),gets:pkg?.gets||'',photo:!!pkg?.photo,
    canPick,last:d.round>=2,looks,look:{outfit:look.outfit,hair:look.hair},picked};
}
export function draftModel(p){
  const st=p?.studio||{},r=requestOf(p),round=lastRound(r);
  if(!round)return null;
  const scenes=round.scenes.map(ref=>(st.scenes||[]).find(scene=>scene.id===ref.id)).filter(Boolean);
  if(!scenes.length)return null;
  const casting=castingOf(r,st.strategy?.data?.castingSelection),modelId=casting.modelId;
  const assetSrc=scene=>scene.assetId?assetUrl((st.assets||[]).find(asset=>asset.id===scene.assetId)):'';
  // 전용 인물이 붙은 프로젝트(판 3 — 이번 광고 사용을 확인한 뒤)는 모델 칸 대신 그 인물의 기준 얼굴. 없으면 키가 없다(판 3 전 모양).
  const persona=casting.kind==='persona'?personaFace(p,casting.personaRef):null;
  // 옷 · 머리(11-10): 정본(제작 설계)이 이 모델이면 그 값, 아니면 의뢰 기록(같은 모델일 때만). 고른 것이 있거나 방향을 고른 의뢰일 때만 한 줄을 둔다
  // (방향 화면이 없던 사진 상품에 「맡김」만 보이지 않게). 없으면 키가 없다(전 판 모양).
  const selection=st.strategy?.data?.castingSelection,answers=r.answers||{};
  const look=r.castingLooks&&casting.kind==='catalog'&&modelCard(modelId)?lookOf(modelId,selection?.modelId===modelId?selection:answers.models?.[0]===modelId?answers:{}):null;
  const showLook=!!look&&(!!(look.outfit||look.hair)||!!r.directionProposal);
  return {round:round.round,kind:round.kind,oneLine:round.oneLine,note:round.note||'',approved:!!round.approvedAt,feedbackAt:round.feedbackAt||'',model:modelCard(modelId),...(persona?{persona}:{}),...(showLook?{look}:{}),ratio:ratioOf({channels:r.answers?.channels||[]}),
    cuts:scenes.map(scene=>({id:scene.id,revision:scene.revision,seconds:Number(scene.duration)||3,what:scene.description||scene.title||'',say:scene.narration||'',text:scene.screenText||'',src:round.kind==='images'?scene.media?.url||assetSrc(scene)||scene.imageUrl||'':''}))};
}
// ── 일지(판 3b) ──
// 담당자가 한 말과 손님이 한 일을 한 줄기로. 손님 보기에 이미 오는 필드만 쓴다(서버 읽음 기록 없음). 그리기는 film-views.mjs journalView.
// 줄 종류: talk(말 — 전문), quote(일감의 말 — 첫 줄만, 정본은 그 일감), event(한 일 — 한 줄). 새 것이 위.
const timeOf=value=>{const t=Date.parse(value||'');return Number.isFinite(t)?t:null;};
// 조사 도우미는 한국어 문장에만 쓴다(다른 언어 사전은 그 자리표를 쓰지 않는다).
const withEul=word=>{const last=String(word).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);return code>=0xAC00&&code<=0xD7A3&&(code-0xAC00)%28?'을':'를';}; // i18n-skip
// 결제 줄(운영 조각 2): 서버의 paymentTrail(옛 순서 그대로), 없으면(옛 서버) 지금 결제 상태에 남은 때로 — 옛 서버는 다시 요청하면 앞 줄이 사라진다.
// [줄, 결제 카드로 가는가] — 가는 줄은 아직 열린 마지막 요청 하나뿐이다(확인 · 취소된 요청은 갈 곳이 없다). 때를 못 읽는 줄 · 모르는 종류는 뺀다.
const PAY_KINDS=['requested','confirmed','cancelled'];
function paymentLines(r){
  const pay=r?.payment&&typeof r.payment==='object'?r.payment:null;
  const trail=Array.isArray(r?.paymentTrail)?r.paymentTrail:[
    // 요청 줄의 값은 그 값이 아직 요청한 값일 때만(확인 때 담당자가 실제 결제액으로 바꿨을 수 있다).
    ...(pay?.requestedAt?[{kind:'requested',at:pay.requestedAt,...(!pay.confirmedAt&&Number.isSafeInteger(pay.amount)?{amount:pay.amount}:{})}]:[]),
    ...(pay?.confirmedAt?[{kind:'confirmed',at:pay.confirmedAt,...(Number.isSafeInteger(pay.amount)?{amount:pay.amount}:{}),...(pay.dueDate?{dueDate:pay.dueDate}:{})}]:[]),
    ...(pay?.status==='cancelled'&&pay.cancelledAt?[{kind:'cancelled',at:pay.cancelledAt}]:[])];
  const lines=trail.filter(entry=>entry&&PAY_KINDS.includes(entry.kind)&&timeOf(entry.at)!==null);
  const last=lines.at(-1);
  // 취소 줄이 무엇을 취소했는지는 바로 앞 줄로 안다 — 확인한 결제면 결제 취소(환불), 요청뿐이면 결제 요청 취소(낸 돈이 없다 — 카본 검수 A2).
  return lines.map((entry,i)=>[entry.kind==='cancelled'?{...entry,paid:lines[i-1]?.kind==='confirmed'}:entry,entry===last&&entry.kind==='requested'&&pay?.status==='requested']);
}
// 줄 글: 값 · 받으실 날이 있으면 붙인다. 이름(담당자)이 앞에 서는 줄이라 영어는 동사로 시작한다(journal 문맥).
const paymentWhat=entry=>{
  const amount=Number.isSafeInteger(entry.amount)&&entry.amount>0?won(entry.amount):'';
  if(entry.kind==='requested')return amount?t('크몽 결제 요청을 보냈어요 · {amount}',{amount}):t('크몽 결제 요청을 보냈어요');
  if(entry.kind==='confirmed')return entry.dueDate&&longDay(entry.dueDate)?t('결제를 확인했어요 · 받으실 날 {date}',{date:longDay(entry.dueDate)}):t('결제를 확인했어요',null,'journal');
  return entry.paid?t('결제를 취소했어요'):t('결제 요청을 취소했어요');
};
// 「이름」 여럿(방향 이름): 한국어는 띄어 잇고, 다른 언어는 그 언어의 목록 꼴로(“A” and “B”).
const quoteList=names=>{const list=names.map(name=>t('「{name}」',{name:String(name)}));return locale()==='ko'||typeof Intl.ListFormat!=='function'?list.join(' '):new Intl.ListFormat(intlLocale(locale()),{type:'conjunction'}).format(list);};
export function journalModel(p){
  const r=requestOf(p),st=p?.studio||{},owner=p?.ownerName||t('PULSE 담당자'),items=[],photo=r?.answers?.package==='photo';
  const add=item=>{items.push({text:'',go:null,...item,t:item.t??timeOf(item.at)});};
  // 줄 글은 문장 하나씩 번역한다. 조사는 한국어 낱말에서 고르고(영어 사전은 쓰지 않는다), 이름은 그 언어로.
  const me=t('나',null,'me'),mname=name=>t(name,null,'model');
  if(r?.submittedAt)add({id:'q:sent',at:r.submittedAt,who:'me',name:me,kind:'event',what:t('의뢰서를 보냈어요')});
  if(r?.confirmedAt)add({id:'q:ok',at:r.confirmedAt,who:'staff',name:r.confirmedBy||owner,kind:'event',what:t('의뢰서를 확인했어요')});
  for(const ask of r?.asks||[])if(ask.status==='answered')add({id:'a:'+ask.id,at:ask.answeredAt||ask.at,who:'me',name:me,kind:'talk',what:t('「{label}」에 답했어요',{label:ask.label}),text:ask.answer||(ask.fileName?t('파일 {name}',{name:ask.fileName}):'')});
  const model=r?.modelProposal,modelName=id=>modelCard(id)?.name||'';
  if(model?.at&&modelName(model.modelId)){
    const name=modelName(model.modelId);
    add(model.note?{id:'o:'+model.at,at:model.at,who:'staff',name:model.by||owner,kind:'quote',what:t('모델 제안 · {name}',{name:mname(name)}),text:model.note,go:model.status==='open'?{tab:'overview'}:null}:{id:'o:'+model.at,at:model.at,who:'staff',name:model.by||owner,kind:'event',what:t('모델 {name}{eul} 제안했어요',{name:mname(name),eul:withEul(name)})});
    if(model.answeredAt&&model.status==='accepted'){const chosen=modelName(r.answers?.models?.[0])||name;add({id:'o:'+model.at+':ok',at:model.answeredAt,who:'me',name:me,kind:model.answer?'talk':'event',what:t('모델 {name}{ro} 정했어요',{name:mname(chosen),ro:withRoOf(chosen)}),text:model.answer||''});}
    if(model.answeredAt&&model.status==='declined')add({id:'o:'+model.at+':no',at:model.answeredAt,who:'me',name:me,kind:'talk',what:t('모델을 말로 알려 드렸어요'),text:model.answer||''});
  }
  const d=r?.directionProposal;
  if(d?.at){
    const atMs=timeOf(d.at),count=d.options?.length||2;
    // 다시 받은 제안이면 앞 판의 답을 둔다. 서버가 그 판의 시각을 내려 주면(판 3c) 1판을 보낸 줄과 답한 줄을 제자리에, 옛 기록(시각 없음)은 이 줄 바로 앞에.
    if(d.prior){
      const sentAt=timeOf(d.prior.at),noAt=timeOf(d.prior.answeredAt),round=String(d.prior.round),list=d.prior.names||[],names=quoteList(list);
      if(sentAt!==null)add({id:'d:'+d.prior.round,at:d.prior.at,who:'staff',name:d.prior.by||owner,kind:'event',what:t('방향 제안 {round}판을 보냈어요',{round})});
      add({id:'d:'+d.prior.round+':no',at:noAt===null?'':d.prior.answeredAt,t:noAt??(atMs===null?null:atMs-1),who:'me',name:me,kind:d.prior.answer?'talk':'event',what:list.length>2?t('방향 제안 {round}판 · {names} 모두 아니에요',{round,names}):t('방향 제안 {round}판 · {names} 둘 다 아니에요',{round,names}),text:d.prior.answer||''});
    }
    const pickable=['open','chosen'].includes(d.status)&&!lastRound(r);
    // 인용 줄의 이름(「방향 제안」)은 다른 언어에서 「보냈다」는 말이 된다 — 일지 문맥으로 따로 옮긴다.
    add({id:'d:'+d.round,at:d.at,who:'staff',name:d.by||owner,kind:'quote',what:d.round>1?t('방향 제안 {round}판',{round:String(d.round)},'journal'):t('방향 제안',null,'journal'),text:d.lead||t('{count}가지 방향을 보내 드렸어요',{count}),go:pickable?{tab:'pick'}:null});
    const chosen=d.options?.find(option=>option.id===d.chosenId);
    // 옷 · 머리를 하나라도 골랐으면 고른 줄 끝에 함께 적는다(proposal.look — 그때 고른 값). 다 맡겼으면 전처럼 이름만.
    const look=chosen&&d.modelId&&d.look?lookOf(d.modelId,d.look):null,lookText=look&&(look.outfit||look.hair)?lookLine(look):'';
    if(d.answeredAt&&d.status==='declined')add({id:'d:'+d.round+':no',at:d.answeredAt,who:'me',name:me,kind:d.answer?'talk':'event',what:count>2?t('방향 모두 아니에요'):t('방향 둘 다 아니에요'),text:d.answer||''});
    if(d.answeredAt&&chosen&&d.status==='chosen')add({id:'d:'+d.round+':ok',at:d.answeredAt,who:'me',name:me,kind:d.answer?'talk':'event',what:lookText?t('「{name}」{ro} 정했어요 · {look}',{name:chosen.name,ro:withRoOf(chosen.name),look:lookText}):t('「{name}」{ro} 정했어요',{name:chosen.name,ro:withRoOf(chosen.name)}),text:d.answer?t('덧붙인 말 · {note}',{note:d.answer}):''});
    if(d.answeredAt&&chosen&&d.status==='settled')add({id:'d:'+d.round+':ok',at:d.answeredAt,who:'staff',name:d.settledBy||owner,kind:d.answer?'talk':'event',what:t('「{name}」{ro} 함께 정했어요',{name:chosen.name,ro:withRoOf(chosen.name)}),text:d.answer||''});
  }
  const rounds=r?.rounds||[],last=rounds.at(-1);
  // 판 이름(「글 콘티 1판」)이 든 줄은 종류마다 문장 하나 — 판 이름은 늘 「판」으로 끝나 조사가 정해져 있다.
  for(const round of rounds){
    const script=round.kind==='script',no=String(round.round);
    add(round.note?{id:'r:'+round.round,at:round.sentAt,who:'staff',name:round.by||owner,kind:'quote',what:script?t('글 콘티 {round}판',{round:no},'journal'):t('장면 이미지 {round}판',{round:no},'journal'),text:round.note,go:round===last?{tab:'draft'}:null}:{id:'r:'+round.round,at:round.sentAt,who:'staff',name:round.by||owner,kind:'event',what:script?t('글 콘티 {round}판을 보냈어요',{round:no}):t('장면 이미지 {round}판을 보냈어요',{round:no}),go:round===last?{tab:'draft'}:null});
    if(round.feedbackAt)add({id:'r:'+round.round+':fix',at:round.feedbackAt,who:'me',name:me,kind:'event',what:round.changes?(script?t('글 콘티 {round}판에 고칠 곳 {count}개를 보냈어요',{round:no,count:round.changes}):t('장면 이미지 {round}판에 고칠 곳 {count}개를 보냈어요',{round:no,count:round.changes})):(script?t('글 콘티 {round}판 컷 확인을 보냈어요',{round:no}):t('장면 이미지 {round}판 컷 확인을 보냈어요',{round:no}))});
    if(round.approvedAt)add({id:'r:'+round.round+':ok',at:round.approvedAt,who:'me',name:me,kind:'event',what:script?t('글 콘티 {round}판을 확인했어요',{round:no}):t('장면 이미지 {round}판을 확인했어요',{round:no})});
  }
  // 결제(운영 조각 2 · 11-11): 요청 · 확인 · 취소를 일지 줄로 — 결제 요청이 언제 왔고 언제 확인됐는지를 나눈 말 사이에서 본다.
  // 서버가 내린 결제 줄(paymentTrail — 종류 · 때 · 값 · 받으실 날뿐)을 쓰고, 옛 서버면 지금 결제 상태의 때로 대신 그린다. 열린 요청 줄만 결제 카드로 간다.
  for(const [entry,open] of paymentLines(r))add({id:'p:'+entry.kind+':'+entry.at,at:entry.at,who:'staff',name:owner,kind:'event',what:paymentWhat(entry),go:open?{tab:'overview'}:null});
  // 시안 · 최종본 이름은 서버가 준 판 이름(label). 최종본은 사진 상품이면 다른 말이라 문맥을 나눈다.
  for(const v of p?.versions||[]){
    if(!['preview','final'].includes(v.kind))continue;
    const final=v.kind==='final',label=String(v.label),josa=josaOf(label),go={tab:'review',versionId:v.id,...(final?{final:true}:{})};
    const quote=final?(photo?t('최종본 {label}',{label},'journal-photo'):t('최종본 {label}',{label},'journal')):t('{label}',{label:v.label},'journal');
    const arrived=final?(photo?t('최종본 {label}{josa} 도착했어요',{label,josa},'photo'):t('최종본 {label}{josa} 도착했어요',{label,josa})):t('{label}{josa} 도착했어요',{label,josa});
    add({id:'v:'+v.id,at:v.createdAt,who:'staff',name:owner,kind:v.guide?'quote':'event',what:v.guide?quote:arrived,...(v.guide?{text:v.guide}:{}),go});
    if(v.kind==='preview'&&v.approvedAt)add({id:'v:'+v.id+':ok',at:v.approvedAt,who:'me',name:me,kind:'event',what:t('{label}{eul} 승인했어요',{label,eul:withEul(label)})});
  }
  for(const fb of st.feedbackRounds?.rounds||[])if(fb.submittedAt){const count=(fb.items||[]).length;add({id:'f:'+fb.id,at:fb.submittedAt,who:'me',name:me,kind:'event',what:fb.versionLabel?t('{label}에 의견 {count}개를 보냈어요',{label:fb.versionLabel,count}):t('영상에 의견 {count}개를 보냈어요',{count})});}
  // 문의와 답: 3a 묻기 화면과 같은 거름(영상 의견 하나하나는 영상 화면에만).
  for(const m of p?.messages||[])if(m.action==='support'&&m.author!=='staff'||m.author==='staff')add({id:'m:'+m.id,ref:m.id,at:m.at,who:m.author==='staff'?(m.automated?'auto':'staff'):'me',name:m.author==='staff'?(m.automated?t('자동 안내'):m.authorName||owner):me,kind:'talk',what:m.author==='staff'?'':t('문의',null,'journal'),text:m.text||''});
  for(const c of st.comments||[])if(c.targetType==='project')add({id:'c:'+c.id,ref:c.id,at:c.at,who:c.author==='customer'?'me':'staff',name:c.author==='customer'?me:c.authorName||owner,kind:'talk',what:'',text:c.text||''});
  const receipt=p?.closeout?.receipt;
  // 앞선 수령 확인(판 3c — 최종본을 더 올려 묶음이 바뀌어도 남는다). 옛 서버는 이 목록을 안 내려 지금 묶음 확인만 보인다.
  for(const earlier of p?.closeout?.earlierReceipts||[])if(timeOf(earlier?.confirmedAt)!==null)add({id:'k:at:'+earlier.confirmedAt,at:earlier.confirmedAt,who:'me',name:me,kind:'event',what:t('파일과 안내를 확인했어요')});
  if(receipt?.confirmedAt)add({id:'k:'+(p.closeout.deliveryKey||'now'),at:receipt.confirmedAt,who:'me',name:me,kind:'event',what:t('파일과 안내를 확인했어요')});
  // 고객 전용 인물(판 3)의 일 — 요청 · 사진 · 견적 · 기준 얼굴 · 동작 시안 · 사용 범위와 그 확인. 인물이 없으면 줄이 없다.
  for(const item of personaJournal(p,{me,owner}))add(item);
  // 새 것이 위. 시각이 같으면 받은 것 → 내 것 차례, 시각을 못 읽는 줄은 맨 아래.
  items.sort((a,b)=>(b.t??-Infinity)-(a.t??-Infinity)||(a.who==='me')-(b.who==='me'));
  const asks=(r?.asks||[]).filter(ask=>ask.status==='open').map(ask=>({id:ask.id,label:ask.label,why:ask.why||'',at:ask.at,t:timeOf(ask.at)}));
  const latestAt=Math.max(0,...items.map(item=>item.t||0),...asks.map(ask=>ask.t||0));
  return {pinned:{asks,next:String(p?.nextStep||'').trim()},items,latestAt};
}
// 조사 도우미(한국어 문장에만 — 번역하지 않는다).
const josaOf=word=>{const last=String(word).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);if(code>=0xAC00&&code<=0xD7A3)return (code-0xAC00)%28?'이':'가';return /[0-9]/.test(last)?('013678'.includes(last)?'이':'가'):'이';}; // i18n-skip
function withRoOf(word){const last=String(word).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);const batchim=code>=0xAC00&&code<=0xD7A3?(code-0xAC00)%28:/[0-9]/.test(last)?('013678'.includes(last)?1:0):1;return batchim&&batchim!==8?'으로':'로';} // i18n-skip
// 「본 시각」보다 뒤에 온 담당자 · 자동 안내 줄과 열린 되묻기 수. 머리 「나눈 말」 숫자.
export const journalNew=(j,seen)=>Number.isFinite(seen)?j.items.filter(item=>item.who!=='me'&&item.t>seen).length+j.pinned.asks.filter(ask=>ask.t>seen).length:0;
// ── 여기부터 직원 화면(내부 확인 · 새 의뢰 목록)만 쓴다 — 직원 화면은 한국어로 둔다(번역하지 않는다). ──
// i18n-skip-start
// 직원 쪽 말로 옮긴 지금 상태(내부 확인의 새 의뢰 목록).
const DESK_STATE={write:'의뢰서 쓰는 중',check:'새 의뢰',ask:'답을 기다려요',direction:'방향 답을 기다려요',redirect:'방향을 다시 제안해요',model:'모델 답을 기다려요',prepare:'1차안 준비 중','prepare-images':'장면 이미지 준비 중',script:'글 콘티를 보는 중',images:'장면 이미지를 보는 중',revise:'의견 반영 중',make:'제작 중',review:'영상 확인 중',deliver:'납품',pay:'결제 안내 중',done:'수령 확인 끝'};
// 결제 차례는 결제 상태로 가른다(판 4 화면 검수 F3 — 결제 확인은 담당자 손 단계라 목록에서 보여야 한다).
const PAY_DESK={requested:'크몽 결제 요청 보냄',cancelled:'결제 취소'};
export function deskQueue(projects=[],when=value=>value){
  return projects.filter(p=>p.studio?.request&&p.studio.request.status!=='retired'&&!['archived','delivered'].includes(p.stage)).sort((a,b)=>String(b.studio.request.submittedAt||b.updatedAt).localeCompare(String(a.studio.request.submittedAt||a.updatedAt))).map(p=>{const state=roomState(p),a=p.studio.request.answers||{};return {id:p.id,title:p.title,meta:[KINDS.find(item=>item.id===a.kind)?.label,when(p.studio.request.submittedAt)].filter(Boolean).join(' · '),state:state==='pay'&&PAY_DESK[p.studio.request.payment?.status]||DESK_STATE[state]||'',tone:state==='check'?'is-new':''};});
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
  const direction=r.directionProposal,casting=castingOf({...r,answers:a},p.studio?.strategy?.data?.castingSelection);
  // 맞춤 인물(판 3)은 이 프로젝트의 가장 최근 인물 요청이 아직 열려 있을 때만 「맞춤 인물 의뢰」다. 거뒀거나 사용을 마쳤으면 모델 점검으로 넘긴다(판 3 화면 검수 F4).
  const latest=(p.personas||[]).filter(item=>item.originProjectId===p.id).at(-1),customLive=casting.kind==='custom'&&!['withdrawn','retired'].includes(latest?.status);
  if(direction)checks.push(['chosen','settled'].includes(direction.status)?{ok:true,label:`손님이 방향 「${direction.options.find(option=>option.id===direction.chosenId)?.name||''}」${direction.status==='settled'?'으로 정리했어요':'을 골랐어요'}`,note:direction.answer?`손님 말: ${direction.answer}`:''}:direction.status==='declined'?{ok:false,label:direction.round>=2?'두 번째 방향도 아니래요 — 손님과 이야기해 정리해 주세요':'손님이 두 방향 다 아니래요',note:direction.answer?`손님 말: ${direction.answer}`:''}:{ok:false,label:'방향 제안을 보냈어요',note:'손님 답을 기다려요.'});
  else if(!customLive&&casting.kind!=='persona'&&!casting.agreed)checks.push({ok:false,label:'모델을 제안해 확인받아야 해요',note:r.modelProposal?.status==='open'?'제안을 보냈어요. 답을 기다려요.':r.modelProposal?.answer?`손님 답: ${r.modelProposal.answer}`:'글 콘티를 보내기 전에 먼저 정해요.'});
  // 맞춤 인물(판 3): 손님이 이번 광고 사용까지 확인해야 제작 설계에 인물이 붙고, 그 전에는 제작 시작(이미지 판 확인)을 서버가 막는다.
  if(customLive)checks.push({ok:false,label:'맞춤 인물 의뢰예요 — 아래 맞춤 인물 칸에서 검토 · 확인을 받아요',note:'손님이 이번 광고 사용까지 확인하면 제작 설계에 인물이 붙어요. 그 전에는 제작을 시작할 수 없어요.'});
  // 내 모델 다시 쓰기 의뢰(판 4): 인물 참조가 붙기 전에는 고객 브랜드 화면에서 연결 확인 → 손님 사용 확인 차례다.
  if(casting.kind==='persona')checks.push(casting.personaRef?{ok:true,label:'전용 인물이 붙었어요',note:'손님이 이번 광고 사용을 확인했어요.'}:p.workspaceRequest?.confirmedAt?{ok:false,label:'내 모델 연결을 확인했어요 — 손님이 이번 광고 사용을 확인하기를 기다려요',note:'사용 범위를 고치려면 고객 브랜드 화면에서 고쳐요. 확인 전에는 제작을 시작할 수 없어요.'}:{ok:false,label:'내 모델 다시 쓰기 의뢰예요 — 고객 브랜드 화면에서 연결을 확인하고 사용 범위를 보내요',note:'연결을 확인하기 전에는 손님 방에 인물이 열리지 않아요.'});
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
  return {id:p.id,number:r.number,status:r.status,at:r.submittedAt||'',title:p.title,contact:p.contact||'',mail:p.mail||null,brief:briefRows(filled(r)).map(row=>[row.key,row.missing==='없음'?'없음':row.missing?`비어 있음 — ${row.missing}`:row.value]),files:assets.filter(asset=>asset.mimeType?.startsWith('image/')&&asset.author==='customer').map(asset=>({src:assetUrl(asset),label:asset.fileName,size:''})),staffFiles:assets.filter(asset=>asset.mimeType?.startsWith('image/')&&asset.author!=='customer').map(asset=>({src:assetUrl(asset),label:asset.fileName,size:''})),payment:r.payment||null,paymentFlow:!!r.paymentFlow,payWaiting:payState(r),payAmount:Number.isSafeInteger(r.payment?.amount)?r.payment.amount:Number.isSafeInteger(direction?.price)?direction.price:pkgOf(a)?Math.round(pkgOf(a).price*10000):null,payDays:pkgOf(a)?.days||null,attachments:[...assets.filter(asset=>!asset.mimeType?.startsWith('image/')&&assetUrl(asset)).map(asset=>({id:asset.id,label:asset.fileName,url:assetUrl(asset)})),...(p.intake?.files||[]).map(file=>({id:file.id,label:file.fileName,url:`/api/client-projects/${p.id}/intake-files/${file.id}`}))],checks:deskChecks(p),note,asks:r.asks||[],rounds:r.rounds||[],modelProposal:proposal?{...proposal,modelName:modelCard(proposal.modelId)?.name||''}:null,needsModel:!direction&&!canDirect&&!a.models?.length&&!MODEL_OPTIONAL_CHOICES.includes(a.modelChoice)&&proposal?.status!=='accepted'&&proposal?.status!=='open',confirmed:r.status==='confirmed',
    direction:direction?{round:direction.round,status:direction.status,names:direction.options.map(option=>option.name),chosen:direction.options.find(option=>option.id===direction.chosenId)?.name||'',answer:direction.answer||'',options:direction.options.map(option=>({id:option.id,name:option.name})),
      // 옷 · 머리(11-10): 손님이 방향과 함께 고른 값(proposal.look). 고른 · 정리한 방향에 카탈로그 모델이 있을 때만.
      ...(['chosen','settled'].includes(direction.status)&&direction.modelId&&direction.look&&modelLooks(direction.modelId)?{look:(look=>`옷 ${look.outfitLabel||'맡김'} · 머리 ${look.hairLabel||'맡김'}`)(lookOf(direction.modelId,direction.look))}:{})}:null,
    canDirect,
    canSettle:direction?.status==='declined'&&direction.round>=2&&!(r.rounds||[]).length};
}
// i18n-skip-end
