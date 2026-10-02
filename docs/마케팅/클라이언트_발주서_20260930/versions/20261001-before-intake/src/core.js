(function(root){'use strict';
const OPTIONS={
format:[['product','제품 광고','제품의 매력을 짧고 선명하게'],['brand','브랜드필름·CF','이야기와 분위기로 전하는 브랜드'],['fashion','모델·패션필름','모델과 의상, 움직임을 중심으로'],['explain','설명·사용법 영상','기능과 사용 과정을 이해하기 쉽게'],['ugc','상황극·소개 영상','사람이 자연스럽게 소개하는 형식']],
subjectType:[['product','제품'],['fashion','의류·패션'],['space','매장·공간'],['service','서비스·앱'],['brand','회사·브랜드'],['other','기타']],
goal:[['purchase','구매로 이어지게'],['contact','문의·예약을 늘리게'],['launch','신제품·행사를 알리게'],['awareness','브랜드를 기억하게'],['understand','기능·사용법을 이해하게'],['consult','함께 정하고 싶어요']],
distribution:[['organic','직접 올리는 콘텐츠'],['paid','광고비를 집행하는 영상'],['both','둘 다 사용']],
familiarity:[['new','브랜드를 처음 보는 고객'],['known','이미 브랜드를 아는 고객'],['mixed','두 고객 모두']],
offerMode:[['yes','알릴 가격·혜택·기간이 있어요'],['no','별도 혜택은 없어요']],
successMetric:[['inquiry','문의·예약'],['visit','페이지 방문'],['purchase','구매'],['awareness','브랜드 인지도'],['understanding','제품·서비스 이해']],
count:[['one','1종'],['few','2~3종'],['many','4종 이상']],
moods:[['premium','고급스럽고 절제된'],['fresh','산뜻하고 밝은'],['natural','자연스러운 일상'],['warm','따뜻하고 감성적인'],['dynamic','강렬하고 역동적인'],['dream','몽환적이고 비현실적인']],
genres:[['product','장르 없이 제품 중심'],['sf','SF·미래'],['romance','멜로·로맨스'],['comic','코믹·유머'],['fantasy','판타지'],['mystery','미스터리·긴장감'],['documentary','다큐·인터뷰']],
model:[['none','모델 없이','제품·공간·그래픽을 중심으로'],['virtual','새로운 AI 모델','브랜드에 어울리는 가상 인물'],['reference','제공한 인물 활용','사용 허락을 받은 인물 사진·영상'],['real','실제 모델 촬영','직접 촬영할 모델이 있거나 섭외 예정'],['hands','손·뒷모습만','얼굴 노출 없이 제품 사용 장면']],
roles:[['pose','포즈·표정'],['use','제품 사용'],['walk','워킹·움직임'],['talk','말하기·소개'],['acting','상황극·연기']],
modelCount:[['one','1명'],['two','2명'],['many','3명 이상']],
permission:[['self','본인 인물이에요'],['approved','사용 허락을 받았어요'],['pending','허락 여부 확인이 필요해요'],['consult','상담이 필요해요']],
scenes:[['whole','제품 전체 모습'],['detail','소재·디테일 가까이'],['use','사용하는 순간'],['walk','모델 포즈·워킹'],['space','공간·분위기'],['reveal','등장·변형·놀라운 장면'],['logo','로고·메시지 마무리']],
background:[['studio','깔끔한 스튜디오'],['home','집·일상 공간'],['city','도시·거리'],['nature','자연·야외'],['virtual','상상 속 공간'],['original','기존 촬영 배경']],
camera:[['still','차분하게 고정'],['push','가까워지거나 멀어짐'],['slide','옆으로 부드럽게 이동'],['follow','인물·제품 따라가기'],['orbit','주위를 돌며 보여주기'],['quick','빠른 전환·속도감']],
preserve:[['shape','제품 형태·비율'],['color','실제 색상·소재'],['logo','로고·라벨 글자'],['face','인물의 실제 얼굴'],['motion','원본 동작·타이밍'],['consult','상담 후 결정']],
channels:[['instagram','인스타그램 릴스·광고'],['shorts','유튜브 쇼츠'],['youtube','유튜브 일반 영상·광고'],['tiktok','틱톡'],['shop','쇼핑몰·상세페이지'],['website','홈페이지'],['screen','매장·전시 화면'],['tv','TV·옥외 광고']],
duration:[['6','6초 내외'],['15','15초 내외'],['30','30초 내외'],['60','60초 내외'],['custom','길이 직접 입력']],
ratios:[['vertical','세로 9:16'],['square','정사각형 1:1'],['wide','가로 16:9'],['custom','별도 규격']],
resolution:[['fhd','FHD'],['4k','4K 필요']],
delivery:[['single','완성 영상 1편'],['variants','같은 영상의 도입·문구 변형'],['concepts','서로 다른 콘셉트 여러 편'],['regular','정기 제작'],['consult','상담 후 결정']],
extras:[['clean','자막 없는 버전'],['short','짧게 줄인 버전'],['still','썸네일·스틸 이미지'],['project','편집 프로젝트 파일 상담']],
budget:[['under30','30만 원 미만'],['30to60','30~60만 원'],['60to100','60~100만 원'],['100to200','100~200만 원'],['over200','200만 원 이상'],['consult','범위를 보고 상담']],
deadlineMode:[['flexible','일정 협의 가능'],['fixed','희망 날짜가 있어요']],
approval:[['self','제가 최종 확인해요'],['other','다른 담당자가 확인해요'],['team','여러 사람이 함께 확인해요']],
assetStatus:[['ready','자료가 있어요'],['pending','나중에 전달할게요'],['create','제작·추천이 필요해요'],['consult','무엇이 필요한지 상담할게요']]
};
for(const options of Object.values(OPTIONS))if(!options.some(([id])=>id==='other'))options.push(['other','기타','원하는 내용을 직접 알려주세요']);
const NOTE_KEYS=Object.keys(OPTIONS).filter(k=>k!=='assetStatus').concat('primaryChannel');
const MULTI=new Set(['moods','genres','roles','scenes','camera','preserve','channels','ratios','extras']);
const LABELS={format:'영상 형식',subject:'브랜드·제품·서비스 이름',subjectType:'광고 대상',intro:'제품·서비스 소개',goal:'광고 목적',count:'제품·의상 수',productVariants:'제품·의상 구성',productUrl:'제품·브랜드 링크',audience:'주로 보여줄 고객',message:'꼭 기억할 한 가지',cta:'시청 후 원하는 행동',moods:'분위기',genres:'장르',colors:'선호 색상·브랜드 색',avoid:'피하고 싶은 표현',model:'모델 방식',roles:'모델의 역할',modelCount:'모델 수',modelDetails:'모델·의상·헤어 기준',permission:'인물 사용 허락',scenes:'원하는 장면',sceneNote:'장면·이야기 메모',background:'촬영 배경',camera:'카메라 움직임',preserve:'꼭 유지할 것',channels:'사용 채널',primaryChannel:'가장 중요한 채널',duration:'희망 영상 길이',customDuration:'상세 영상 길이',ratios:'화면 비율',resolution:'희망 해상도',language:'자막 언어',onScreenText:'필수 화면 문구',delivery:'완성물 구성',quantity:'편수·변형·주기',extras:'추가 희망 결과물',budget:'예산 범위',deadlineMode:'일정 조건',deadline:'희망 전달일',scheduleNotes:'공개 일정·검토 시간',contact:'브랜드·담당자 / 크몽 닉네임',approval:'최종 확인 방식',assetLink:'자료 공유 링크',notes:'추가 요청·자료 설명'};
Object.assign(LABELS,{usageSituation:'고객의 사용 상황',purchaseBarrier:'구매 전 궁금한 점',difference:'제품을 고를 이유',proof:'이를 보여줄 근거',offerDetails:'가격·혜택·기간',destinationUrl:'광고 이후 연결 페이지',successTarget:'목표·확인할 변화',measurementPeriod:'성과 확인 기간',previousContentUrl:'이전 콘텐츠 링크',previousContentNotes:'이전 콘텐츠에서 배운 점',baselineNotes:'기준 사진 설명',distribution:'게시·광고 집행 방식',familiarity:'브랜드를 아는 정도',offerMode:'가격·혜택 안내 여부',successMetric:'확인할 성과'});
const ASSET_IDS=['product','logo','model','footage','reference','brand','spec'];
const BASELINE_LABELS={color:'색상',fit:'핏',length:'기장',detail:'디테일'};
const SCENE_PRIORITY_LABELS={must:'반드시 포함',prefer:'가능하면 포함'};
function defaults(){const d={};for(const k of Object.keys(LABELS))d[k]=MULTI.has(k)?[]:'';d.references=[{url:'',likes:''}];d.assetStatus={};d.fieldNotes={};d.assetNotes={};d.attachments=[];d.scenePriority={};d.baselineImages={};return d;}
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function label(k,v){if(Array.isArray(v))return v.map(x=>label(k,x)).join(' · ')||'미정 · 상담 필요';return OPTIONS[k]?.find(o=>o[0]===v)?.[1]||'미정 · 상담 필요';}
function safeName(s){return String(s||'자료').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^\.+/,'').trim().slice(0,110)||'자료';}
function sanitize(raw){
  const out=defaults();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  for(const k of Object.keys(LABELS)){
    const v=raw[k];
    if(OPTIONS[k]){
      const ids=new Set(OPTIONS[k].map(o=>o[0]));
      if(MULTI.has(k)){
        out[k]=Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&ids.has(x)))].slice(0,k==='moods'||k==='genres'?2:12):[];
        if(out[k].includes('consult'))out[k]=['consult'];
      }else out[k]=typeof v==='string'&&ids.has(v)?v:'';
    }else out[k]=typeof v==='string'?v.slice(0,k==='subject'?120:4000):'';
  }
  for(const k of NOTE_KEYS)if(typeof raw.fieldNotes?.[k]==='string')out.fieldNotes[k]=raw.fieldNotes[k].slice(0,2000);
  for(const id of ASSET_IDS)if(typeof raw.assetNotes?.[id]==='string')out.assetNotes[id]=raw.assetNotes[id].slice(0,2000);
  if(!out.channels.includes(out.primaryChannel))out.primaryChannel='';
  if(Array.isArray(raw.references)){
    out.references=raw.references.slice(0,3).filter(x=>x&&typeof x==='object').map(x=>({url:typeof x.url==='string'?x.url.slice(0,2000):'',likes:typeof x.likes==='string'?x.likes.slice(0,2000):''}));
    if(!out.references.length)out.references=[{url:'',likes:''}];
  }
  for(const id of ASSET_IDS){const v=raw.assetStatus?.[id];if(OPTIONS.assetStatus.some(o=>o[0]===v))out.assetStatus[id]=v;}
  if(Array.isArray(raw.attachments))out.attachments=raw.attachments.slice(0,60).filter(x=>x&&typeof x.name==='string'&&Number.isSafeInteger(x.size)&&x.size>=0&&ASSET_IDS.includes(x.category)).map(x=>({name:x.name.slice(0,255),size:x.size,category:x.category}));
  if(raw.scenePriority&&typeof raw.scenePriority==='object'&&!Array.isArray(raw.scenePriority)){
    for(const [id] of OPTIONS.scenes){const value=raw.scenePriority[id];if(value==='must'||value==='prefer')out.scenePriority[id]=value;}
  }
  if(raw.baselineImages&&typeof raw.baselineImages==='object'&&!Array.isArray(raw.baselineImages)){
    for(const key of Object.keys(BASELINE_LABELS)){
      const image=raw.baselineImages[key];
      if(!image||typeof image!=='object'||Array.isArray(image)||typeof image.name!=='string'||image.name.length>255||!/^.+\.(jpe?g|png|webp|avif|heic|gif)$/i.test(image.name)||!Number.isSafeInteger(image.size)||image.size<0||image.category!=='product')continue;
      out.baselineImages[key]={name:image.name,size:image.size,category:'product'};
    }
  }
  return out;
}
function activeAssets(d){let p={title:'제품 사진·정보',tip:'정면·측면·뒷면, 라벨 확대 사진과 크기·색상 정보를 준비해주세요. 배경이 단순하고 선명할수록 좋아요.'};if(d.subjectType==='fashion')p={title:'의류 사진·착장 정보',tip:'앞·뒤·디테일 사진, 소재·실제 색상, 착장 조합과 사이즈를 알려주세요.'};if(d.subjectType==='service')p={title:'서비스 화면·소개 자료',tip:'앱 화면, 사용 과정, 기능 설명 등 사실대로 보여줄 기준 자료를 준비해주세요.'};if(d.subjectType==='space')p={title:'공간 사진·위치 정보',tip:'공간의 전체 모습과 특징, 촬영 가능한 구역을 알려주세요.'};if(d.subjectType==='brand')p={title:'브랜드 소개·기존 비주얼',tip:'브랜드 소개서와 기존 이미지 등 브랜드를 이해할 수 있는 자료를 준비해주세요.'};
const a=[{id:'product',...p,essential:true},{id:'logo',title:'로고·브랜드 요소',tip:'가능하면 배경이 투명한 PNG 또는 원본 AI·SVG를 주세요. 없으면 상태만 알려주세요.'}];
if(['reference','real'].includes(d.model))a.push({id:'model',title:'인물·모델 기준 자료',tip:'사용 허락을 받은 인물의 선명한 정면·측면 사진과 원하는 의상·헤어 기준을 준비해주세요.',essential:true});
a.push({id:'footage',title:'기존 영상·촬영 원본',tip:'기존 영상이 있다면 첨부해주세요. 가능하면 압축하지 않은 원본을 주세요. 큰 파일은 아래 공유 링크로 전달할 수 있어요.'});
a.push({id:'reference',title:'참고 이미지·영상',tip:'좋아하는 장면·조명·색감의 참고 자료예요. 참고 링크도 3단계에 남길 수 있어요.'},{id:'brand',title:'브랜드 가이드·필수 문구',tip:'색상, 서체, 로고 배치 규칙, 반드시 표시할 설명과 검토된 광고 문구를 알려주세요.'});
if(d.channels.includes('tv')||d.channels.includes('screen')||d.ratios.includes('custom'))a.push({id:'spec',title:'송출처 납품 규격',tip:'송출 담당자가 준 화면 크기·길이·파일 형식·음량 등 규격을 준비해주세요.',essential:true});return a;}
function effective(raw){
  const d=sanitize(raw);
  if(!d.model||d.model==='none'){d.roles=[];d.modelCount='';d.modelDetails='';delete d.fieldNotes.roles;delete d.fieldNotes.modelCount;}
  if(!['reference','real'].includes(d.model)){d.permission='';delete d.fieldNotes.permission;}
  if(d.duration!=='custom')d.customDuration='';
  if(['','single','consult'].includes(d.delivery))d.quantity='';
  if(d.deadlineMode!=='fixed')d.deadline='';
  if(!['few','many'].includes(d.count))d.productVariants='';
  if(!['yes','other'].includes(d.offerMode))d.offerDetails='';
  if(!['paid','both'].includes(d.distribution)){d.successTarget='';d.measurementPeriod='';}
  d.scenePriority=Object.fromEntries(Object.entries(d.scenePriority).filter(([id])=>d.scenes.includes(id)));
  if(!['product','fashion'].includes(d.subjectType)){d.baselineImages={};d.baselineNotes='';}
  else if(d.subjectType!=='fashion'){delete d.baselineImages.fit;delete d.baselineImages.length;}
  const ids=new Set(activeAssets(d).map(a=>a.id));
  d.assetStatus=Object.fromEntries(Object.entries(d.assetStatus).filter(([k])=>ids.has(k)));
  d.attachments=d.attachments.filter(a=>ids.has(a.category));
  d.assetNotes=Object.fromEntries(Object.entries(d.assetNotes).filter(([k])=>ids.has(k)));
  if(d.channels.length<2)delete d.fieldNotes.primaryChannel;
  return d;
}
const SECTIONS=[
  ['프로젝트',0,['subject','format','subjectType','intro','goal','audience','productUrl','count','productVariants']],
  ['고객·강점',1,['usageSituation','familiarity','purchaseBarrier','difference','proof','message','cta']],
  ['느낌·장면',2,['moods','genres','colors','avoid','model','roles','modelCount','modelDetails','permission','scenes','sceneNote','background','camera','preserve']],
  ['사용·결과',3,['channels','primaryChannel','distribution','duration','customDuration','ratios','resolution','language','onScreenText','delivery','quantity','extras','offerMode','offerDetails','destinationUrl','successMetric','successTarget','measurementPeriod','previousContentUrl','previousContentNotes']],
  ['일정·예산·기타',5,['budget','deadlineMode','deadline','scheduleNotes','contact','approval','assetLink','notes']]
];
function has(v){return Array.isArray(v)?v.length>0:typeof v==='string'&&!!v.trim();}
function hasAnswer(d,k){return has(d[k])||has(d.fieldNotes?.[k]);}
function display(d,k){let value=k==='primaryChannel'?label('channels',d[k]):OPTIONS[k]?label(k,d[k]):String(d[k]||'');if(k==='scenes'&&Array.isArray(d.scenes)&&d.scenes.length)value=d.scenes.map(id=>`${label('scenes',id)} (${SCENE_PRIORITY_LABELS[d.scenePriority?.[id]]||'우선순위 미지정'})`).join(' · ');const note=d.fieldNotes?.[k]?.trim();return value+(note?'\n메모: '+note:'');}
function strategy(raw){
  const d=effective(raw),join=parts=>parts.filter(Boolean).join('\n');
  return [
    {key:'audience',label:'누구에게',value:join([d.audience.trim(),d.usageSituation.trim()?'사용 상황: '+d.usageSituation.trim():''])},
    {key:'barrier',label:'어떤 궁금함을 풀어줄지',value:d.purchaseBarrier.trim()},
    {key:'message',label:'무엇을 전할지',value:join([d.message.trim(),d.difference.trim()?'제품을 고를 이유: '+d.difference.trim():''])},
    {key:'proof',label:'무엇으로 보여줄지',value:d.proof.trim()},
    {key:'action',label:'어떤 행동으로 이어질지',value:join([d.cta.trim(),d.destinationUrl.trim()?'연결 페이지: '+d.destinationUrl.trim():''])}
  ].map(row=>({...row,value:row.value||'아직 정하지 않았어요'}));
}
function questions(raw){const d=effective(raw),q=[];for(const k of ['format','goal','moods','genres','model','channels','duration','ratios','budget'])if(!has(d[k])||d[k]==='consult'||Array.isArray(d[k])&&d[k].includes('consult'))q.push(`${LABELS[k]} 제안·협의`);if(!d.message.trim())q.push('고객에게 전달할 핵심 메시지 정하기');if(['reference','real'].includes(d.model)&&!['self','approved'].includes(d.permission))q.push('인물 사용 허락과 사용 범위 확인');if(d.channels.includes('tv')||d.channels.includes('screen'))q.push('송출처 규격과 납품 조건 확인');if(d.deadlineMode==='fixed'&&!d.deadline)q.push('희망 전달일 확인');return q;}
function sameFile(a,b){return a.category===b.category&&a.name===b.name&&a.size===b.size;}
function baselineRows(raw,files=[]){const d=effective(raw);return Object.entries(d.baselineImages).map(([key,image])=>({key,label:BASELINE_LABELS[key],...image,attached:files.some(file=>sameFile(file,image))}));}
function assetRows(raw,files=[]){const d=effective(raw);return activeAssets(d).map(a=>{const matched=files.filter(f=>f.category===a.id),missing=d.attachments.filter(f=>f.category===a.id&&!matched.some(x=>sameFile(x,f)));return {...a,files:matched,missing,note:d.assetNotes[a.id]||'',status:matched.length?'첨부 완료':label('assetStatus',d.assetStatus[a.id])};});}
function validation(raw){
  const d=effective(raw),e=[];
  if(!d.subject.trim())e.push({step:0,key:'subject',message:'브랜드·제품·서비스 이름을 입력해주세요.'});
  if(!d.goal)e.push({step:0,key:'goal',message:'광고 목적을 골라주세요. 아직 모르겠다면 함께 정하기를 선택해주세요.'});
  const urlOk=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!!u.hostname;}catch{return false;}};
  for(const [key,step] of [['productUrl',0],['assetLink',4],['destinationUrl',3],['previousContentUrl',3]]){
    if(d[key].trim()&&!urlOk(d[key].trim()))e.push({step,key,message:'링크는 https:// 또는 http://로 시작하는 주소를 입력해주세요.'});
  }
  d.references.forEach((r,i)=>{if(r.url.trim()&&!urlOk(r.url.trim()))e.push({step:2,key:'ref-url-'+i,message:'참고 링크는 https:// 또는 http://로 시작하는 주소를 입력해주세요.'});});
  if(d.duration==='custom'&&!d.customDuration.trim())e.push({step:3,key:'customDuration',message:'희망 영상 길이를 적거나 다른 길이를 골라주세요.'});
  if(d.deadlineMode==='fixed'){
    const today=new Date(),localDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10),parsed=new Date(d.deadline+'T12:00:00');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==d.deadline||d.deadline<localDate)e.push({step:5,key:'deadline',message:'오늘 이후의 희망 전달일을 선택하거나 일정 협의 가능을 골라주세요.'});
  }
  return e;
}
function reportBody(raw,files=[]){
  const d=effective(raw),baselines=baselineRows(d,files);
  const summary=`<section class="strategy-brief"><h2>제작 방향 한눈에 보기</h2><p>고객이 작성한 내용을 정리한 요약입니다.</p><dl>${strategy(d).map(row=>`<dt>${escape(row.label)}</dt><dd>${escape(row.value)}</dd>`).join('')}</dl></section>`;
  const sections=SECTIONS.map(([title,,keys])=>`<section><h2>${escape(title)}</h2><dl>${keys.filter(k=>hasAnswer(d,k)).map(k=>`<dt>${escape(LABELS[k])}</dt><dd>${escape(display(d,k))}</dd>`).join('')||'<dd>상담 후 결정</dd>'}</dl></section>`).join('');
  const baselineSection=baselines.length||d.baselineNotes.trim()?`<section><h2>제품 기준 사진</h2>${baselines.map(row=>`<p><b>${escape(row.label)} 기준</b><br>${escape(row.name)}<br>${row.attached?'현재 첨부됨':'재첨부 필요 (현재 패키지에 없음)'}</p>`).join('')}${d.baselineNotes.trim()?`<p><b>${escape(LABELS.baselineNotes)}</b><br>${escape(d.baselineNotes)}</p>`:''}</section>`:'';
  return `<h1>${escape(d.subject||'영상 제작')} · 제작 발주서</h1><p>작성일 ${new Date().toLocaleDateString('ko-KR')} · SYNK PULSE</p><p>제작 방향과 자료를 협의하기 위한 문서입니다. 견적·범위·납기·수정 조건은 제작자와 최종 확인해주세요.</p>`+summary+sections+baselineSection+`<section><h2>참고 자료</h2>${d.references.filter(r=>r.url.trim()||r.likes.trim()).map((r,i)=>`<p><b>참고 ${i+1}</b><br>${escape(r.url)}<br>${escape(r.likes)}</p>`).join('')||'<p>아직 없음</p>'}</section><section><h2>자료 준비 상태</h2>${assetRows(d,files).map(a=>`<p><b>${escape(a.title)}</b> — ${escape(a.status)}${a.note?'<br>메모: '+escape(a.note):''}${a.files.map(f=>'<br>첨부: '+escape(f.name)).join('')}${a.missing.map(f=>'<br>재첨부 필요 (현재 패키지에 없음): '+escape(f.name)).join('')}</p>`).join('')}</section><section><h2>상담에서 함께 정할 것</h2><ul>${questions(d).map(q=>`<li>${escape(q)}</li>`).join('')||'<li>최종 견적·범위·납기·수정 조건 확인</li>'}</ul></section>`;
}
function reportHtml(d,files=[]){return '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK PULSE · 영상 제작 발주서</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 24px;color:#19263b}h1{font-size:28px;color:#99295d;border-top:4px solid #99295d;padding-top:18px}h2{font-size:20px;border-bottom:1px solid #ccc;padding-bottom:8px}section{break-inside:avoid}dt{font-weight:bold;margin-top:12px}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0;font-size:11pt}}</style><body>'+reportBody(d,files)+'</body></html>';}
function reportText(raw,files=[]){
  const d=effective(raw),lines=[`${d.subject||'영상 제작'} · 제작 발주서`,'SYNK PULSE · '+new Date().toLocaleDateString('ko-KR'),'제작 방향과 자료를 협의하기 위한 문서입니다. 견적·범위·납기·수정 조건은 최종 확인해주세요.','','[제작 방향 한눈에 보기]','고객이 작성한 내용을 정리한 요약입니다.',...strategy(d).map(row=>`${row.label}: ${row.value}`),''];
  for(const [title,,keys] of SECTIONS){lines.push('['+title+']');for(const k of keys)if(hasAnswer(d,k))lines.push(`${LABELS[k]}: ${display(d,k)}`);lines.push('');}
  const baselines=baselineRows(d,files);
  if(baselines.length||d.baselineNotes.trim()){
    lines.push('[제품 기준 사진]');
    for(const row of baselines)lines.push(`${row.label} 기준: ${row.name} — ${row.attached?'현재 첨부됨':'재첨부 필요 (현재 패키지에 없음)'}`);
    if(d.baselineNotes.trim())lines.push(`${LABELS.baselineNotes}: ${d.baselineNotes}`);
    lines.push('');
  }
  lines.push('[참고 자료]');d.references.filter(r=>r.url.trim()||r.likes.trim()).forEach((r,i)=>lines.push(`${i+1}. ${r.url}\n좋았던 점: ${r.likes}`));
  lines.push('','[자료 준비 상태]');for(const a of assetRows(d,files)){lines.push(`${a.title}: ${a.status}`);if(a.note)lines.push('  메모: '+a.note);a.files.forEach(f=>lines.push('  첨부: '+f.name));a.missing.forEach(f=>lines.push('  재첨부 필요 (패키지에 없음): '+f.name));}
  lines.push('','[상담에서 함께 정할 것]',...questions(d).map(q=>'• '+q));return lines.join('\n');
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function zip(entries){const enc=new TextEncoder(),chunks=[],central=[];let offset=0;for(const e of entries){const name=enc.encode(e.name),bytes=e.data instanceof Blob?new Uint8Array(await e.data.arrayBuffer()):typeof e.data==='string'?enc.encode(e.data):new Uint8Array(e.data),crc=crc32(bytes),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,bytes);const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,crc,true);w.setUint32(20,bytes.length,true);w.setUint32(24,bytes.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+bytes.length;}const size=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
const api={OPTIONS,NOTE_KEYS,MULTI,LABELS,SECTIONS,BASELINE_LABELS,defaults,escape,label,safeName,sanitize,activeAssets,effective,has,hasAnswer,display,strategy,questions,sameFile,assetRows,baselineRows,validation,reportBody,reportHtml,reportText,crc32,zip};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SynkBriefCore=api;
})(typeof window==='undefined'?globalThis:window);
