import {CASTING_MODELS} from './casting-catalog.mjs';

// 의뢰서에서 무엇을 왜 묻는지(2026-11-04). 칸마다 근거는 docs/마케팅/PULSE_의뢰흐름_20261104/README.md 「받는 정보 판단」.
// 값은 결정 10-29 정가의 「부터」만 쓴다. 기간·수정 횟수는 아직 공개하지 않기로 한 약속이라(트랙 §1) 여기 두지 않는다.
const shot=code=>`./assets/request/model-scene-${code}.webp`;
export const KINDS=Object.freeze([
  {id:'food',label:'음료 · 식품',note:'먹고 마시는 제품',shot:shot('f02'),who:'하린 · 상큼한 막내',group:'product'},
  {id:'beauty',label:'화장품 · 뷰티',note:'스킨케어, 색조, 뷰티 기기',shot:'./assets/request/w-gift-sphere.webp',who:'「유리결」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품',group:'product'},
  {id:'fashion',label:'패션 · 잡화',note:'옷, 가방, 신발, 액세서리',shot:shot('m09'),who:'서율 · 블루 그레이빛 차가운 비주얼',group:'wear'},
  {id:'living',label:'생활용품 · 가전',note:'집과 일상에서 쓰는 물건',shot:'./assets/films/maejin-imbak-poster-v1.webp',who:'「매진 임박」 홈쇼핑 × 공포 코미디 · 가상 브랜드로 만든 자체 작품',group:'product'},
  {id:'app',label:'앱 · 웹 서비스',note:'화면으로 쓰는 서비스',shot:shot('m04'),who:'민재 · 옆집 자취생',group:'app'},
  {id:'place',label:'매장 · 공간 · 서비스',note:'찾아오거나 예약하는 곳',shot:'./assets/films/hwaseong-cf-light-poster-v1.webp',who:'「1억 년의 빛」 화성 CF · 공모전 출품작',group:'place'},
  {id:'brand',label:'브랜드 · 기업 전체',note:'제품 하나가 아니라 회사 이야기',shot:shot('m05'),who:'준호 · 믿음직한 생활형',group:'brand'},
]);
export const CHANNELS=Object.freeze([
  {id:'shorts',label:'릴스 · 쇼츠 · 틱톡',ratio:'9:16'},
  {id:'youtube',label:'유튜브 · 웹사이트',ratio:'16:9'},
  {id:'store',label:'상세페이지 · 자사몰',ratio:'1:1'},
  {id:'screen',label:'매장 화면 · 행사',ratio:'16:9',note:'화면 규격을 나중에 알려 주세요'},
]);
// 컷 수는 상품 글 FAQ와 같은 어림(15초 5~8컷 · 30초 10~16컷)이다.
export const PACKAGES=Object.freeze([
  {id:'s15',label:'15초',title:'한 편',note:'릴스 · 쇼츠에 맞는 길이',price:39,cuts:6},
  {id:'s30',label:'30초',title:'30초 + 15초 · 6초 편집본',note:'한 번 만들어 채널마다 나눠 써요',price:89,cuts:12},
  {id:'s60',label:'60초',title:'브랜드 필름, 또는 같은 모델 시리즈 3편',note:'',price:199,cuts:20},
  {id:'corp',label:'기업',title:'기업 캠페인',note:'30~60초 + 편집본, 기획서 포함',price:250,cuts:16},
  {id:'photo',label:'사진',title:'모델이 제품을 든 사진 5장',note:'영상 전에 먼저 써 보는 분이 많아요',price:9.9,cuts:5,photo:true},
]);
// 준비물: 「꼭」은 없으면 그 자리를 비워 두고 1차안을 만들어야 하는 것, 「있으면」은 있으면 수정이 줄어드는 것이다. 어느 쪽도 보내기를 막지 않는다.
const LOGO={id:'logo',label:'로고 파일',need:true,accept:'image/*,.svg,.ai,.eps,.pdf',why:'끝 화면과 자막에 그대로 얹어요. AI · SVG가 가장 좋고, 배경이 없는 PNG도 괜찮아요.',kind:'logo'};
const USE={id:'use',label:'쓰는 모습',accept:'image/*,video/*',why:'여는 법, 쓰는 법이 틀리면 장면을 다시 만들어야 해요. 찍어 둔 게 없으면 한 줄로 적어 주세요.',note:'예) 뚜껑을 돌려 열고 손등에 펴 발라요'};
const ETC={id:'etc',label:'그 밖에 보낼 자료',accept:'image/*,video/*,.svg,.ai,.eps,.pdf,.ppt,.pptx',why:'상세페이지, 회사 소개서, 지난 광고처럼 도움이 될 것 같은 건 뭐든 좋아요.',multiple:true};
export const SLOTS=Object.freeze({
  product:[
    {id:'front',label:'제품 정면 사진',need:true,accept:'image/*',why:'화면에 나오는 제품은 AI로 그리지 않고 이 사진으로 합성해요.',kind:'photo',multiple:true},
    {id:'side',label:'옆면 · 뒷면 사진',need:true,accept:'image/*',why:'돌아가는 컷과 손에 든 컷의 모양을 이 사진으로 잡아요.',kind:'photo',multiple:true},
    LOGO,
    {id:'label',label:'라벨 · 패키지 인쇄 파일',accept:'image/*,.svg,.ai,.eps,.pdf',why:'있으면 제품 위 글자가 훨씬 또렷해요.',kind:'logo'},
    USE,
    ETC,
  ],
  wear:[
    {id:'front',label:'제품 사진 · 입은 사진',need:true,accept:'image/*',why:'색과 실루엣의 기준이 돼요. 정면과 옆면이 있으면 좋아요.',kind:'photo',multiple:true},
    {id:'detail',label:'원단 · 로고 · 디테일 사진',need:true,accept:'image/*',why:'가까이 찍는 컷에서 질감과 디테일이 달라지지 않게 해요.',kind:'photo',multiple:true},
    LOGO,
    {...USE,label:'입거나 쓰는 모습',why:'입는 법, 드는 법이 틀리면 장면을 다시 만들어야 해요. 찍어 둔 게 없으면 한 줄로 적어 주세요.',note:'예) 앞을 열어 가볍게 걸쳐 입어요'},
    ETC,
  ],
  app:[
    {id:'screens',label:'앱 화면 캡처 · 녹화',need:true,accept:'image/*,video/*',why:'앱 화면도 그리지 않고 실제 화면을 얹어요. 보여 주고 싶은 화면을 순서대로 넣어 주세요.',multiple:true},
    {...LOGO,label:'로고 · 앱 아이콘'},
    {...USE,label:'쓰는 순서',why:'어떤 순서로 쓰는지 알아야 화면을 맞게 보여 드려요. 녹화가 없으면 한 줄로 적어 주세요.',note:'예) 사진을 올리면 3초 뒤 결과가 떠요'},
    ETC,
  ],
  place:[
    {id:'space',label:'공간 · 서비스 사진',need:true,accept:'image/*,video/*',why:'실제 공간의 분위기와 구조를 장면의 기준으로 삼아요. 석 장 이상이면 좋아요.',kind:'photo',multiple:true},
    LOGO,
    {id:'menu',label:'대표 메뉴 · 서비스 사진',accept:'image/*',why:'화면에 크게 보일 대표 장면이에요.',kind:'photo',multiple:true},
    ETC,
  ],
  brand:[
    LOGO,
    {id:'guide',label:'브랜드 가이드 · 회사 소개서',accept:'image/*,.pdf,.ppt,.pptx',why:'색과 글꼴, 쓰는 말이 정해져 있으면 그대로 따라요.',multiple:true},
    {id:'scene',label:'대표 사진 · 지난 광고',accept:'image/*,video/*',why:'지금까지의 결을 이어 갈지 바꿀지 판단할 수 있어요.',multiple:true},
    ETC,
  ],
});
export const slotsFor=kind=>SLOTS[KINDS.find(item=>item.id===kind)?.group||'product'];
// 자주 걸리는 말. 법률 판단이 아니라 「한 번 더 볼 말」을 먼저 꺼내 놓는 것이다.
export const WATCH_WORDS=Object.freeze({
  food:['갈증 해소','피로 회복','다이어트','면역','치료'],
  beauty:['재생','치료','여드름 개선','주름 제거','피부과 추천'],
  living:['살균 100%','세계 최초','업계 1위'],
  fashion:['세계 최초','업계 1위'],
  app:['업계 1위','수익 보장'],
  place:['업계 1위','예약 1위'],
  brand:['세계 최초','업계 1위'],
});
export const ACTIONS=Object.freeze([
  {id:'buy',label:'사러 가요'},{id:'install',label:'설치해요'},{id:'visit',label:'찾아와요'},{id:'ask',label:'문의해요'},{id:'remember',label:'기억만 해도 돼요'},
]);
export const WIN=Object.freeze([
  {id:'story',label:'이야기로 여운을',note:'끝까지 보게 하고, 끝에서 마음이 움직여요.',work:'매진 임박',poster:'./assets/request/w-maejin.webp',film:'./assets/request/film-maejin.mp4',kind:'1m 13s · 16:9',ratio:'16:9'},
  {id:'impact',label:'한 장면의 임팩트로',note:'한 번 보면 잊히지 않는 그림 하나로 이겨요.',work:'유리결',poster:'./assets/request/w-gift-sphere.webp',film:'./assets/request/film-gift.mp4',kind:'15초 · 9:16',ratio:'9:16'},
]);
export const REFERENCE_POINTS=Object.freeze(['전개 · 구성','색감 · 빛','카메라 · 속도','모델 연기','소리 · 음악']);
// 모델 추천: 캐스팅북 명세(roster-v2.json의 tagline · fits)에서 옮긴 한 줄과 업종이다.
export const MODEL_LINES=Object.freeze({
  M01:{line:'책 읽는 남자친구',fits:['fashion','beauty','app','brand']},
  F01:{line:'도시의 뮤즈',fits:['fashion','beauty','brand']},
  F02:{line:'상큼한 막내',fits:['food','beauty','fashion','app']},
  F03:{line:'똑 부러진 선배',fits:['app','brand','beauty']},
  M02:{line:'위스키가 어울리는 남자',fits:['food','fashion','brand']},
  F04:{line:'맑은 새내기',fits:['beauty','food','fashion']},
  M03:{line:'동네 특이한 형',fits:['app','food','living']},
  F05:{line:'믿고 사는 언니',fits:['living','beauty','food','place']},
  M04:{line:'옆집 자취생',fits:['living','app','food']},
  F06:{line:'관리 잘한 40대',fits:['beauty','living','brand','place']},
  F07:{line:'운동하는 언니',fits:['food','fashion','living','place']},
  M05:{line:'믿음직한 생활형',fits:['living','brand','place','app']},
  M06:{line:'청량한 운동부 후배',fits:['food','app','fashion']},
  F08:{line:'반달 웃음의 믿음직한 리더',fits:['beauty','fashion']},
  F09:{line:'바이올렛빛 우아한 비주얼',fits:['beauty','fashion']},
  F10:{line:'통통 튀는 애플 그린 막내',fits:['food','fashion','app']},
  F11:{line:'맑은 블론드의 상큼한 리드보컬',fits:['beauty','food','fashion']},
  M07:{line:'믿음직한 눈웃음 리더',fits:['fashion','beauty']},
  M08:{line:'햇살 같은 메인댄서',fits:['food','fashion']},
  M09:{line:'블루 그레이빛 차가운 비주얼',fits:['fashion','beauty','brand']},
  M10:{line:'장난기 가득 래퍼 막내',fits:['food','app','fashion']},
});
// 모델 단계의 첫 판: 제작사가 업종마다 고른 넷. 빛 · 나이 · 성별이 겹치지 않게 골랐다. 21명 전체는 손님이 「모두 보기」를 누를 때만 펼친다(맹검 6차 「얼굴 격자는 판매 목록 같다」).
export const MODEL_PICKS=Object.freeze({
  beauty:['F01','F09','M09','F06'],
  food:['F02','M02','F11','M06'],
  fashion:['M09','F01','F08','M02'],
  living:['F05','M04','F06','M05'],
  app:['M04','F03','M10','F10'],
  place:['F05','F07','M05','F06'],
  brand:['F03','M01','F06','M02'],
});
export const STEPS=Object.freeze([
  {id:'what',part:'무엇을'},{id:'where',part:'무엇을'},
  {id:'files',part:'준비물'},
  {id:'message',part:'전할 말'},{id:'words',part:'전할 말'},
  {id:'feel',part:'느낌'},{id:'model',part:'모델'},
  {id:'contact',part:'연락'},{id:'review',part:'확인'},
]);
export const emptyAnswers=()=>({
  name:'',kind:'',channels:[],paid:false,package:'',
  slots:{},size:'',useNote:'',pageUrl:'',driveUrl:'',
  audience:'',oneThing:'',action:'',
  screenText:'',avoid:[],avoidNote:'',facts:'',
  win:'',refs:[{url:'',points:[],why:''}],avoidFeel:'',
  models:[],modelChoice:'',
  date:'',dateFree:false,approver:'',approverName:'',contactName:'',company:'',email:'',phone:'',consent:false,rights:false,
});
// 이미지 원본 점검(브라우저에서 바로). 막지 않고, 어느 컷에 어떤 영향이 있는지만 말한다.
export function photoAdvice(width,height,kind){
  const long=Math.max(width,height);
  if(kind==='logo')return long>=800?{state:'good',text:`${width} × ${height} · 그대로 얹을 수 있어요`}:{state:'note',text:`${width} × ${height} · 끝 화면에서 조금 흐릴 수 있어요. AI · SVG 파일이 있으면 더 좋아요`};
  if(long>=2000)return {state:'good',text:`${width} × ${height} · 가까이 찍는 컷에도 충분해요`};
  if(long>=1200)return {state:'note',text:`${width} × ${height} · 쓸 수 있어요. 더 큰 원본이 있으면 접사가 더 또렷해요`};
  return {state:'note',text:`${width} × ${height} · 작은 사진이에요. 멀리 보이는 컷에는 괜찮고, 접사는 다시 부탁드릴 수 있어요`};
}
export const price=value=>`${value<10?Math.round(value*10)/10:Math.round(value)}만원`;
export const DRAFT_FILES_GONE='쓰던 의뢰서의 보관 기간이 지나 올리신 자료가 지워졌어요. 쓰신 글은 그대로예요. 자료만 다시 올려 주세요.';
export const pkgOf=a=>PACKAGES.find(item=>item.id===a.package);
export const kindOf=a=>KINDS.find(item=>item.id===a.kind);
export const channelText=a=>a.channels.map(id=>CHANNELS.find(item=>item.id===id)?.label).filter(Boolean).join(', ');
export const modelOf=id=>CASTING_MODELS.find(item=>item.id===id);
export const modelList=a=>a.models.map(id=>modelOf(id)?.name).filter(Boolean).join(', ');
export const filesOf=(a,id)=>a.slots[id]?.files||[];
export const ratioOf=a=>[...new Set((a.channels||[]).map(id=>CHANNELS.find(item=>item.id===id)?.ratio).filter(Boolean))][0]||'9:16';
export const slotCount=a=>Object.values(a.slots).reduce((sum,slot)=>sum+(slot.files?.length||0),0);
// 의뢰서 한 장. 비어 있으면 막지 않고, 없으면 어떻게 하는지를 그 자리에 쓴다.
export function briefRows(a){
  const pkg=pkgOf(a),slots=slotsFor(a.kind),missing=slots.filter(slot=>slot.need&&!filesOf(a,slot.id).length).map(slot=>slot.label);
  const win=WIN.find(item=>item.id===a.win)?.label||(a.win==='ask'?'맡길게요':'');
  const fileCount=slotCount(a),written=[a.pageUrl&&'제품 페이지',a.driveUrl&&'드라이브 링크',a.useNote&&'쓰는 모습 설명'].filter(Boolean);
  const refs=(a.refs||[]).map(ref=>[ref.url,(ref.points||[]).join(', '),ref.why].filter(Boolean).join(' · ')).filter(Boolean).join(' / ');
  const rows=[
    {key:'광고할 것',step:'what',value:[a.name,kindOf(a)?.label].filter(Boolean).join(' · '),missing:a.name?'':'이름을 알려 주세요'},
    {key:'올릴 곳',step:'where',value:[channelText(a),a.paid?'광고비 집행':''].filter(Boolean).join(' · '),missing:a.channels.length?'':'모르면 저희가 제안해요'},
    {key:'길이 · 구성',step:'where',value:pkg?`${pkg.label} · ${pkg.title} · ${price(pkg.price)}부터`:a.package==='ask'?'추천해 주세요':'',missing:a.package?'':'모르면 저희가 제안해요'},
    {key:'받은 자료',step:'files',value:[fileCount?`파일 ${fileCount}개`:'',...written,missing.length?`아직 없음: ${missing.join(', ')}`:''].filter(Boolean).join(' · '),missing:fileCount||written.length?'':'아직 없어요. 1차안에는 자리만 잡아 둘게요'},
    {key:'보는 사람',step:'message',value:a.audience,missing:a.audience?'':'저희가 제안해요'},
    {key:'남길 것',step:'message',value:a.oneThing,missing:a.oneThing?'':'저희가 한 문장으로 제안해요'},
    {key:'보고 나서',step:'message',value:ACTIONS.find(item=>item.id===a.action)?.label,missing:a.action?'':'저희가 제안해요'},
    {key:'화면 글자',step:'words',value:a.screenText,missing:a.screenText?'':'제품 이름만 얹어요'},
    {key:'피할 말',step:'words',value:[...a.avoid,a.avoidNote].filter(Boolean).join(', '),missing:(a.avoid.length||a.avoidNote)?'':'없음'},
    {key:'자랑할 사실',step:'words',value:a.facts,missing:a.facts?'':'없음'},
    {key:'무엇으로',step:'feel',value:win,missing:win?'':'저희가 제안해요'},
    {key:'참고 광고',step:'feel',value:refs,missing:refs?'':'없음'},
    {key:'모델',step:'model',value:a.modelChoice==='none'?'사람 없이 제품만':a.modelChoice==='ask'?'추천해 주세요':modelList(a),missing:(a.models.length||a.modelChoice)?'':'저희가 제안해요'},
    {key:'받고 싶은 날',step:'contact',value:a.dateFree?'정해진 날짜 없음':a.date,missing:(a.date||a.dateFree)?'':'미정'},
    {key:'최종 확인',step:'contact',value:a.approver==='one'?'의뢰하신 분':a.approver==='many'?['여러 명',a.approverName].filter(Boolean).join(' · 최종 '):'',missing:a.approver?'':'미정'},
    {key:'연락처',step:'contact',value:[a.contactName,a.company,a.email,a.phone].filter(Boolean).join(' · '),missing:a.contactName&&(a.email||a.phone)?'':'성함과 이메일이나 휴대폰이 있어야 연락드릴 수 있어요'},
  ];
  return rows;
}
// 서버 답 ↔ 화면 답. 서버는 파일 목록을 따로 쥐고(답 안에는 「지금 없어요」 표시만), 화면은 칸마다 파일을 묶어 쓴다. 옮기는 곳은 여기 하나다.
export function answersFromServer(stored={},files=[],previewOf=()=>''){
  const slots={};for(const [key,value]of Object.entries(stored.slots||{}))slots[key]={...value,files:[]};
  for(const file of files){const slot=slots[file.slot]||(slots[file.slot]={files:[]});slot.files.push({...file,preview:previewOf(file)});}
  const refs=(stored.refs||[]).map(ref=>({url:ref.url||'',points:[...(ref.points||[])],why:ref.why||''}));
  return {...emptyAnswers(),...stored,slots,refs:refs.length?refs:[{url:'',points:[],why:''}]};
}
export function answersForServer(answers){
  const out={};for(const key of Object.keys(emptyAnswers()))out[key]=answers[key];
  const slots={};for(const [key,value]of Object.entries(answers.slots||{}))if(value?.none)slots[key]={none:true};
  return {...out,slots,refs:(answers.refs||[]).filter(ref=>ref.url||ref.points?.length||ref.why)};
}
