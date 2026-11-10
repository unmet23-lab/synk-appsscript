import {CASTING_MODELS} from './casting-catalog.mjs';
import {t,k,locale,intlLocale} from './i18n.mjs';

// 의뢰서에서 무엇을 왜 묻는지(2026-11-04). 칸마다 근거는 docs/마케팅/PULSE_의뢰흐름_20261104/README.md 「받는 정보 판단」.
// 값은 결정 10-29 정가의 「부터」만 쓴다. 기간 · 수정 횟수는 결정 11-07(가격표 · 크몽 상품 글과 같게)대로 보인다.
// 다국어 판 2: 표의 글은 k('한국어')로 표시만 하고 값은 한국어 그대로 둔다(그리는 자리가 t(값)으로 옮긴다). 서버 허용 목록과 같은 저장값(REFERENCE_POINTS · 피할 말 칩)도 값은 그대로다.
const shot=code=>`./assets/request/model-scene-${code}.webp`;
export const KINDS=Object.freeze([
  // 11-09: 업종마다 완성 광고가 있으면 그 작품 그림을 둔다(음료 오미톡 · 앱 모두의코스 · 기업 도담중공업 — 진열 정본 docs/마케팅/PULSE_포트폴리오_제작준비_20261012/진열). 없는 업종은 예시 장면 그대로.
  {id:'food',label:k('음료 · 식품'),note:k('먹고 마시는 제품'),shot:'./assets/films/omitok-court-poster-v1.webp',who:k('「치익이 톡이 될 때까지」 오미톡 · 가상 브랜드로 만든 자체 작품'),group:'product'},
  {id:'beauty',label:k('화장품 · 뷰티'),note:k('스킨케어, 색조, 뷰티 기기'),shot:'./assets/request/w-gift-sphere.webp',who:k('「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품'),group:'product'},
  {id:'fashion',label:k('패션 · 잡화'),note:k('옷, 가방, 신발, 액세서리'),shot:shot('m09'),who:k('예시 장면 · 서율 · 블루 그레이빛 차가운 비주얼'),group:'wear'},
  {id:'living',label:k('생활용품 · 가전'),note:k('집과 일상에서 쓰는 물건'),shot:'./assets/films/maejin-imbak-poster-v1.webp',who:k('「매진 임박」 홈쇼핑 × 공포 코미디 · 가상 브랜드로 만든 자체 작품'),group:'product'},
  {id:'app',label:k('앱 · 웹 서비스'),note:k('화면으로 쓰는 서비스'),shot:'./assets/films/modu-course-poster-v1.webp',who:k('「가는 데마다 또 그 사람」 모두의코스 · 가상 브랜드로 만든 자체 작품'),group:'app'},
  {id:'place',label:k('매장 · 공간 · 서비스'),note:k('찾아오거나 예약하는 곳'),shot:'./assets/films/hwaseong-cf-light-poster-v1.webp',who:k('「1억 년의 빛」 화성 CF · 공모전 출품작'),group:'place'},
  {id:'brand',label:k('브랜드 · 기업 전체'),note:k('제품 하나가 아니라 회사 이야기'),shot:'./assets/films/dodam-heavy-poster-v1.webp',who:k('「이 아이를 보냅니다」 도담중공업 · 가상 브랜드로 만든 자체 작품'),group:'brand'},
]);
export const CHANNELS=Object.freeze([
  {id:'shorts',label:k('릴스 · 쇼츠 · 틱톡'),ratio:'9:16'},
  {id:'youtube',label:k('유튜브 · 웹사이트'),ratio:'16:9'},
  {id:'store',label:k('상세페이지 · 자사몰'),ratio:'1:1'},
  {id:'screen',label:k('매장 화면 · 행사'),ratio:'16:9',note:k('화면 규격을 나중에 알려 주세요')},
]);
// 컷 수는 상품 글 FAQ와 같은 어림(15초 5~8컷 · 30초 10~16컷)이다.
// 기간은 달력 기준(주말 · 공휴일 포함)이고 사진 · 로고 · 꼭 넣을 말이 다 모인 날부터 센다. 수정은 영상(사진)이 나온 뒤에 쓰는 횟수다.
// 기업은 기간 · 수정을 협의로 둔다(days · revisions 없음). gets는 방향 제안의 「받으시는 것」 한 줄.
// 영상 세 패키지의 값은 크몽 패키지 값과 같다(결정 11-10 D1 — 결제는 크몽에서 같은 값으로 받는다). 바꿀 때는 크몽 · synk.im과 같은 날 함께 바꾼다.
export const PACKAGES=Object.freeze([
  {id:'s15',label:k('15초'),title:k('한 편'),note:k('릴스 · 쇼츠에 맞는 길이'),price:29,cuts:6,days:10,revisions:2,gets:k('영상 파일 한 편(자막 있는 판 · 없는 판), 확정한 글 콘티와 장면 이미지')},
  {id:'s30',label:k('30초'),title:k('30초 + 15초 · 6초 편집본'),note:k('한 번 만들어 채널마다 나눠 써요'),price:59,cuts:12,days:14,revisions:3,gets:k('30초 · 15초 · 6초 영상 파일(자막 있는 판 · 없는 판), 확정한 글 콘티와 장면 이미지')},
  {id:'s60',label:k('60초'),title:k('브랜드 필름, 또는 같은 모델 시리즈 3편'),note:'',price:149,cuts:20,days:21,revisions:3,gets:k('60초 한 편이나 시리즈 세 편의 영상 파일(자막 있는 판 · 없는 판), 확정한 글 콘티와 장면 이미지')},
  {id:'corp',label:k('기업'),title:k('기업 캠페인'),note:k('30~60초 + 편집본, 기획서 포함'),price:250,cuts:16,gets:k('협의한 구성의 영상 파일과 기획서, 확정한 글 콘티와 장면 이미지')},
  {id:'photo',label:k('사진'),title:k('모델이 제품을 든 사진 5장'),note:k('영상 전에 먼저 써 보는 분이 많아요'),price:9.9,cuts:5,photo:true,days:3,revisions:2,gets:k('모델이 제품을 든 사진 다섯 장(긴 변 2048px)')},
]);
// 「10일 · 수정 2회」. 기업은 협의.
export const termsOf=pkg=>pkg?.days?t('{days}일 · 수정 {revisions}회',{days:pkg.days,revisions:pkg.revisions}):pkg?t('기간 · 수정 협의'):'';
// 받으실 날: 기준일(보내기 전 오늘, 보낸 뒤 접수일)에서 달력으로 days일 뒤. 「11월 17일」, 다른 언어는 그 언어의 날짜 꼴(영어 「Nov 17」).
// 한국어 날짜 꼴은 값 포맷터라 번역 키가 아니다(i18n-skip).
export function dueDay(pkg,from=new Date()){if(!pkg?.days)return '';const at=new Date(from);if(Number.isNaN(at.getTime()))return '';at.setDate(at.getDate()+pkg.days);if(locale()!=='ko')return new Intl.DateTimeFormat(intlLocale(locale()),{month:'short',day:'numeric'}).format(at);return `${at.getMonth()+1}월 ${at.getDate()}일`;} // i18n-skip
// 수정 횟수 한 줄. 수가 드는 문장이라 자리표는 count다(영어 복수형).
export const revisionNote=pkg=>!pkg?.days?'':pkg.photo?t('사진이 나온 뒤 {count}번. 첫 장으로 방향을 맞춘 뒤 나머지를 만들어요',{count:pkg.revisions}):t('영상이 나온 뒤 {count}번. 글 콘티 · 장면 이미지 의견은 세지 않아요',{count:pkg.revisions});
// 준비물: 「꼭」은 없으면 그 자리를 비워 두고 1차안을 만들어야 하는 것, 「있으면」은 있으면 수정이 줄어드는 것이다. 어느 쪽도 보내기를 막지 않는다.
const LOGO={id:'logo',label:k('로고 파일'),need:true,accept:'image/*,.svg,.ai,.eps,.pdf',why:k('끝 화면과 자막에 그대로 얹어요. AI · SVG가 가장 좋고, 배경이 없는 PNG도 괜찮아요.'),kind:'logo'};
const USE={id:'use',label:k('쓰는 모습'),accept:'image/*,video/*',why:k('여는 법, 쓰는 법이 틀리면 장면을 다시 만들어야 해요. 찍어 둔 게 없으면 한 줄로 적어 주세요.'),note:k('예) 뚜껑을 돌려 열고 손등에 펴 발라요')};
const ETC={id:'etc',label:k('그 밖에 보낼 자료'),accept:'image/*,video/*,.svg,.ai,.eps,.pdf,.ppt,.pptx',why:k('상세페이지, 회사 소개서, 지난 광고처럼 도움이 될 것 같은 건 뭐든 좋아요.'),multiple:true};
export const SLOTS=Object.freeze({
  product:[
    {id:'front',label:k('제품 정면 사진'),need:true,accept:'image/*',why:k('화면에 나오는 제품은 AI로 그리지 않고 이 사진으로 합성해요.'),kind:'photo',multiple:true},
    {id:'side',label:k('옆면 · 뒷면 사진'),need:true,accept:'image/*',why:k('돌아가는 컷과 손에 든 컷의 모양을 이 사진으로 잡아요.'),kind:'photo',multiple:true},
    LOGO,
    {id:'label',label:k('라벨 · 패키지 인쇄 파일'),accept:'image/*,.svg,.ai,.eps,.pdf',why:k('있으면 제품 위 글자가 훨씬 또렷해요.'),kind:'logo'},
    USE,
    ETC,
  ],
  wear:[
    {id:'front',label:k('제품 사진 · 입은 사진'),need:true,accept:'image/*',why:k('색과 실루엣의 기준이 돼요. 정면과 옆면이 있으면 좋아요.'),kind:'photo',multiple:true},
    {id:'detail',label:k('원단 · 로고 · 디테일 사진'),need:true,accept:'image/*',why:k('가까이 찍는 컷에서 질감과 디테일이 달라지지 않게 해요.'),kind:'photo',multiple:true},
    LOGO,
    {...USE,label:k('입거나 쓰는 모습'),why:k('입는 법, 드는 법이 틀리면 장면을 다시 만들어야 해요. 찍어 둔 게 없으면 한 줄로 적어 주세요.'),note:k('예) 앞을 열어 가볍게 걸쳐 입어요')},
    ETC,
  ],
  app:[
    {id:'screens',label:k('앱 화면 캡처 · 녹화'),need:true,accept:'image/*,video/*',why:k('앱 화면도 그리지 않고 실제 화면을 얹어요. 보여 주고 싶은 화면을 순서대로 넣어 주세요.'),multiple:true},
    {...LOGO,label:k('로고 · 앱 아이콘')},
    {...USE,label:k('쓰는 순서'),why:k('어떤 순서로 쓰는지 알아야 화면을 맞게 보여 드려요. 녹화가 없으면 한 줄로 적어 주세요.'),note:k('예) 사진을 올리면 3초 뒤 결과가 떠요')},
    ETC,
  ],
  place:[
    {id:'space',label:k('공간 · 서비스 사진'),need:true,accept:'image/*,video/*',why:k('실제 공간의 분위기와 구조를 장면의 기준으로 삼아요. 석 장 이상이면 좋아요.'),kind:'photo',multiple:true},
    LOGO,
    {id:'menu',label:k('대표 메뉴 · 서비스 사진'),accept:'image/*',why:k('화면에 크게 보일 대표 장면이에요.'),kind:'photo',multiple:true},
    ETC,
  ],
  brand:[
    LOGO,
    {id:'guide',label:k('브랜드 가이드 · 회사 소개서'),accept:'image/*,.pdf,.ppt,.pptx',why:k('색과 글꼴, 쓰는 말이 정해져 있으면 그대로 따라요.'),multiple:true},
    {id:'scene',label:k('대표 사진 · 지난 광고'),accept:'image/*,video/*',why:k('지금까지의 결을 이어 갈지 바꿀지 판단할 수 있어요.'),multiple:true},
    ETC,
  ],
});
export const slotsFor=kind=>SLOTS[KINDS.find(item=>item.id===kind)?.group||'product'];
// 맞춤 인물 사진 칸(판 3 — 스위치 personaRequest가 켜진 공개 의뢰서에서만 그린다). id는 서버 pulse-personas.mjs PERSONA_SLOTS와 같다.
// 이 칸의 사진은 프로젝트 자료가 아니라 인물 검토 자료라 받은 자료 수 · 스크린의 「보내 주신 사진」에 넣지 않는다.
// 「같은 사람」 칸은 실제 인물 출연일 때만 연다(가상 인물에 남의 얼굴을 재현하는 길이 되지 않게 — 의뢰서 권리 칸 「실존 인물을 닮게 만드는 요청은 받지 않아요」와 같은 약속).
const PERSONA_ACCEPT='image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif';
export const PERSONA_SLOTS=Object.freeze([
  {id:'persona-identity',label:k('출연하실 분의 사진'),accept:PERSONA_ACCEPT,why:k('얼굴이 또렷한 사진 1~3장이면 상담을 시작할 수 있어요. 같은 얼굴로 만들려면 사진이 더 필요할 수 있어요. 검토한 뒤 어떤 사진이 필요한지 알려 드려요.'),multiple:true,persona:true},
  {id:'persona-mood',label:k('분위기 참고 사진'),accept:PERSONA_ACCEPT,why:k('이런 느낌이면 좋겠다 싶은 사진이에요. 사진 속 사람을 닮게 만들지는 않아요.'),multiple:true,persona:true},
]);
export const isPersonaSlot=id=>PERSONA_SLOTS.some(slot=>slot.id===id);
// 맞춤 인물 요청의 고르는 값(서버 pulse-requests.mjs personaRequestOf의 허용 목록과 같은 저장값 — 보일 때만 번역한다).
export const PERSONA_KINDS=Object.freeze([{id:'virtual',label:k('새 가상 인물')},{id:'real',label:k('실제 인물 출연')}]);
export const PERSONA_KEEPS=Object.freeze([{id:'once',label:k('이번 광고만')},{id:'reuse',label:k('다음 광고에도')}]);
export const PERSONA_RELATIONS=Object.freeze([{id:'self',label:k('본인')},{id:'agency',label:k('소속 모델')},{id:'other',label:k('그 밖의 분')}]);
export const PERSONA_CONSENTS=Object.freeze([{id:'link',label:k('확인 링크로')},{id:'document',label:k('서류로')}]);
// 종류를 고르지 않았으면 새 가상 인물이다(서버도 보낼 때 그렇게 채운다).
export const personaKindLabel=a=>t(a?.personaRequest?.kind==='real'?PERSONA_KINDS[1].label:PERSONA_KINDS[0].label);
// 자주 걸리는 말. 법률 판단이 아니라 「한 번 더 볼 말」을 먼저 꺼내 놓는 것이다.
// 고른 말은 한국어 그대로 저장한다(피할 말 칩 — 저장값이라 i18n-skip). 보일 때는 문맥 claim으로 번역한다: 「재생」은 영상 재생 단추와 낱말이 같다.
export const WATCH_WORDS=Object.freeze({
  food:['갈증 해소','피로 회복','다이어트','면역','치료'], // i18n-skip
  beauty:['재생','치료','여드름 개선','주름 제거','피부과 추천'], // i18n-skip
  living:['살균 100%','세계 최초','업계 1위'], // i18n-skip
  fashion:['세계 최초','업계 1위'], // i18n-skip
  app:['업계 1위','수익 보장'], // i18n-skip
  place:['업계 1위','예약 1위'], // i18n-skip
  brand:['세계 최초','업계 1위'], // i18n-skip
});
// 피할 말 칩 한 개를 지금 언어로(문맥 claim).
export const claimText=word=>t(word,null,'claim');
export const ACTIONS=Object.freeze([
  {id:'buy',label:k('사러 가요')},{id:'install',label:k('설치해요')},{id:'visit',label:k('찾아와요')},{id:'ask',label:k('문의해요')},{id:'remember',label:k('기억만 해도 돼요')},
]);
export const WIN=Object.freeze([
  // 11-09: 「이야기로 여운을」 예시는 도담중공업(끝의 노을 · 「이 아이를 보냅니다」 12초, 소리 없음)으로 — 매진 임박은 웃음으로 이기는 편이라 여운의 예로는 어긋났다.
  {id:'story',label:k('이야기로 여운을'),note:k('끝까지 보게 하고, 끝에서 마음이 움직여요.'),work:k('도담중공업'),poster:'./assets/request/w-dodam.webp',film:'./assets/request/film-dodam.mp4',kind:k('1분 1초 · 16:9'),ratio:'16:9'},
  {id:'impact',label:k('한 장면의 임팩트로'),note:k('한 번 보면 잊히지 않는 그림 하나로 이겨요.'),work:'霜の肌理',poster:'./assets/request/w-gift-sphere.webp',film:'./assets/request/film-gift.mp4',kind:k('15초 · 9:16'),ratio:'9:16'},
]);
// 참고 광고의 좋았던 곳: 서버 허용 목록(pulse-requests.mjs POINTS)과 같은 한국어 값이다(보일 때만 번역).
export const REFERENCE_POINTS=Object.freeze([k('전개 · 구성'),k('색감 · 빛'),k('카메라 · 속도'),k('모델 연기'),k('소리 · 음악')]);
// 모델 추천: 캐스팅북 명세(roster-v2.json의 tagline · fits)에서 옮긴 한 줄과 업종이다.
export const MODEL_LINES=Object.freeze({
  M01:{line:k('책 읽는 남자친구'),fits:['fashion','beauty','app','brand']},
  F01:{line:k('도시의 뮤즈'),fits:['fashion','beauty','brand']},
  F02:{line:k('상큼한 막내'),fits:['food','beauty','fashion','app']},
  F03:{line:k('똑 부러진 선배'),fits:['app','brand','beauty']},
  M02:{line:k('위스키가 어울리는 남자'),fits:['food','fashion','brand']},
  F04:{line:k('맑은 새내기'),fits:['beauty','food','fashion']},
  M03:{line:k('동네 특이한 형'),fits:['app','food','living']},
  F05:{line:k('믿고 사는 언니'),fits:['living','beauty','food','place']},
  M04:{line:k('옆집 자취생'),fits:['living','app','food']},
  F06:{line:k('관리 잘한 40대'),fits:['beauty','living','brand','place']},
  F07:{line:k('운동하는 언니'),fits:['food','fashion','living','place']},
  M05:{line:k('믿음직한 생활형'),fits:['living','brand','place','app']},
  M06:{line:k('청량한 운동부 후배'),fits:['food','app','fashion']},
  F08:{line:k('반달 웃음의 믿음직한 리더'),fits:['beauty','fashion']},
  F09:{line:k('바이올렛빛 우아한 비주얼'),fits:['beauty','fashion']},
  F10:{line:k('통통 튀는 애플 그린 막내'),fits:['food','fashion','app']},
  F11:{line:k('맑은 블론드의 상큼한 리드보컬'),fits:['beauty','food','fashion']},
  M07:{line:k('믿음직한 눈웃음 리더'),fits:['fashion','beauty']},
  M08:{line:k('햇살 같은 메인댄서'),fits:['food','fashion']},
  M09:{line:k('블루 그레이빛 차가운 비주얼'),fits:['fashion','beauty','brand']},
  M10:{line:k('장난기 가득 래퍼 막내'),fits:['food','app','fashion']},
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
  {id:'what',part:k('무엇을')},{id:'where',part:k('무엇을')},
  {id:'files',part:k('준비물')},
  {id:'message',part:k('전할 말')},{id:'words',part:k('전할 말')},
  {id:'feel',part:k('느낌')},{id:'model',part:k('모델')},
  {id:'contact',part:k('연락')},{id:'review',part:k('확인')},
]);
export const emptyAnswers=()=>({
  name:'',kind:'',channels:[],paid:false,package:'',
  slots:{},size:'',useNote:'',pageUrl:'',driveUrl:'',
  audience:'',oneThing:'',action:'',
  screenText:'',avoid:[],avoidNote:'',facts:'',
  win:'',refs:[{url:'',points:[],why:''}],avoidFeel:'',
  models:[],modelChoice:'',hair:'',
  date:'',dateFree:false,approver:'',approverName:'',contactName:'',company:'',email:'',phone:'',consent:false,rights:false,
  contactLocale:'',outputLocales:[],targetMarket:[],quoteCurrency:'',
  personaRequest:{kind:'',look:'',use:'',keep:'',relation:'',consentWay:''},
});
// 다국어 · 전용 인물 판 1(11-09)에 더한 칸(서버 pulse-requests.mjs ANSWER_FIELDS와 같은 이름). 비어 있으면 보내지 않는다 —
// 이 칸을 모르는 옛 서버도 자동 저장을 거절하지 않게. 서버는 빠진 칸을 빈 값으로 채우므로 지운 값도 그대로 전해진다.
// 판 3의 맞춤 인물 요청(personaRequest)도 같다 — 칸이 모두 비어 있으면 보내지 않는다.
const LATER_FIELDS=['hair','contactLocale','outputLocales','targetMarket','quoteCurrency','personaRequest'];
const blank=value=>value===''||value==null||Array.isArray(value)&&!value.length||typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(item=>item===''||item==null);
// 이미지 원본 점검(브라우저에서 바로). 막지 않고, 어느 컷에 어떤 영향이 있는지만 말한다. 글은 부를 때의 언어다(화면은 그릴 때마다 다시 부른다).
export function photoAdvice(width,height,kind){
  const long=Math.max(width,height),size={width,height};
  if(kind==='logo')return long>=800?{state:'good',text:t('{width} × {height} · 그대로 얹을 수 있어요',size)}:{state:'note',text:t('{width} × {height} · 끝 화면에서 조금 흐릴 수 있어요. AI · SVG 파일이 있으면 더 좋아요',size)};
  if(long>=2000)return {state:'good',text:t('{width} × {height} · 가까이 찍는 컷에도 충분해요',size)};
  if(long>=1200)return {state:'note',text:t('{width} × {height} · 쓸 수 있어요. 더 큰 원본이 있으면 접사가 더 또렷해요',size)};
  return {state:'note',text:t('{width} × {height} · 작은 사진이에요. 멀리 보이는 컷에는 괜찮고, 접사는 다시 부탁드릴 수 있어요',size)};
}
// 값은 만 원 단위로 받는다. 한국어는 「39만원」, 영어는 원화 그대로 「KRW 390,000」(통화를 바꾸지 않는다). 한국어 꼴은 값 포맷터다(i18n-skip).
export const price=value=>locale()==='en'?`KRW ${Math.round(value*10000).toLocaleString('en-US')}`:`${value<10?Math.round(value*10)/10:Math.round(value)}만원`; // i18n-skip
export const DRAFT_FILES_GONE=k('쓰던 의뢰서의 보관 기간이 지나 올리신 자료가 지워졌어요. 쓰신 글은 그대로예요. 자료만 다시 올려 주세요.');
export const pkgOf=a=>PACKAGES.find(item=>item.id===a.package);
export const kindOf=a=>KINDS.find(item=>item.id===a.kind);
export const channelText=a=>a.channels.map(id=>CHANNELS.find(item=>item.id===id)?.label).filter(Boolean).map(label=>t(label)).join(', ');
export const modelOf=id=>CASTING_MODELS.find(item=>item.id===id);
export const modelList=a=>a.models.map(id=>modelOf(id)?.name).filter(Boolean).map(name=>t(name,null,'model')).join(', ');
export const filesOf=(a,id)=>a.slots[id]?.files||[];
export const ratioOf=a=>[...new Set((a.channels||[]).map(id=>CHANNELS.find(item=>item.id===id)?.ratio).filter(Boolean))][0]||'9:16';
export const slotCount=a=>Object.entries(a.slots).reduce((sum,[id,slot])=>isPersonaSlot(id)?sum:sum+(slot.files?.length||0),0);
// 의뢰서 한 장. 비어 있으면 막지 않고, 없으면 어떻게 하는지를 그 자리에 쓴다.
export function briefRows(a){
  // 줄 이름(key)과 빈칸 안내(missing)는 한국어 키 그대로 두고 그리는 자리에서 번역한다(내부 확인이 그 글로 견준다). 값의 고정 낱말은 여기서 번역한다.
  const pkg=pkgOf(a),slots=slotsFor(a.kind),missing=slots.filter(slot=>slot.need&&!filesOf(a,slot.id).length).map(slot=>t(slot.label));
  const win=WIN.find(item=>item.id===a.win)?.label||(a.win==='ask'?k('맡길게요'):'');
  const fileCount=slotCount(a),written=[a.pageUrl&&k('제품 페이지'),a.driveUrl&&k('드라이브 링크'),a.useNote&&k('쓰는 모습 설명')].filter(Boolean).map(text=>t(text));
  const refs=(a.refs||[]).map(ref=>[ref.url,(ref.points||[]).map(point=>t(point)).join(', '),ref.why].filter(Boolean).join(' · ')).filter(Boolean).join(' / ');
  const rows=[
    {key:k('광고할 것'),step:'what',value:[a.name,kindOf(a)&&t(kindOf(a).label)].filter(Boolean).join(' · '),missing:a.name?'':k('이름을 알려 주세요')},
    {key:k('올릴 곳'),step:'where',value:[channelText(a),a.paid?t('광고비 집행'):''].filter(Boolean).join(' · '),missing:a.channels.length?'':k('모르면 저희가 제안해요')},
    {key:k('길이 · 구성'),step:'where',value:pkg?t('{label} · {title} · {price}부터 · {terms}',{label:t(pkg.label),title:t(pkg.title),price:price(pkg.price),terms:termsOf(pkg)}):a.package==='ask'?t('추천해 주세요'):'',missing:a.package?'':k('모르면 저희가 제안해요')},
    {key:k('받은 자료'),step:'files',value:[fileCount?t('파일 {count}개',{count:fileCount}):'',...written,missing.length?t('아직 없음: {list}',{list:missing.join(', ')}):''].filter(Boolean).join(' · '),missing:fileCount||written.length?'':k('아직 없어요. 1차안에는 자리만 잡아 둘게요')},
    {key:k('보는 사람'),step:'message',value:a.audience,missing:a.audience?'':k('저희가 제안해요')},
    {key:k('남길 것'),step:'message',value:a.oneThing,missing:a.oneThing?'':k('저희가 한 문장으로 제안해요')},
    {key:k('보고 나서'),step:'message',value:a.action&&ACTIONS.find(item=>item.id===a.action)?t(ACTIONS.find(item=>item.id===a.action).label):undefined,missing:a.action?'':k('저희가 제안해요')},
    {key:k('화면 글자'),step:'words',value:a.screenText,missing:a.screenText?'':k('제품 이름만 얹어요')},
    {key:k('피할 말'),step:'words',value:[...a.avoid.map(claimText),a.avoidNote].filter(Boolean).join(', '),missing:(a.avoid.length||a.avoidNote)?'':k('없음')},
    {key:k('자랑할 사실'),step:'words',value:a.facts,missing:a.facts?'':k('없음')},
    {key:k('무엇으로'),step:'feel',value:win&&t(win),missing:win?'':k('저희가 제안해요')},
    {key:k('참고 광고'),step:'feel',value:refs,missing:refs?'':k('없음')},
    {key:k('모델'),step:'model',value:a.modelChoice==='none'?t('사람 없이 제품만'):a.modelChoice==='ask'?t('추천해 주세요'):a.modelChoice==='custom'?t('맞춤 인물 요청 · {kind}',{kind:personaKindLabel(a)}):modelList(a),missing:(a.models.length||a.modelChoice)?'':k('저희가 제안해요')},
    {key:k('받고 싶은 날'),step:'contact',value:a.dateFree?t('정해진 날짜 없음'):a.date,missing:(a.date||a.dateFree)?'':k('미정')},
    {key:k('최종 확인'),step:'contact',value:a.approver==='one'?t('의뢰하신 분'):a.approver==='many'?(a.approverName?t('여러 명 · 최종 {name}',{name:a.approverName}):t('여러 명')):'',missing:a.approver?'':k('미정')},
    {key:k('연락처'),step:'contact',value:[a.contactName,a.company,a.email,a.phone].filter(Boolean).join(' · '),missing:a.contactName&&(a.email||a.phone)?'':k('성함과 이메일이나 휴대폰이 있어야 연락드릴 수 있어요')},
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
  const out={};for(const key of Object.keys(emptyAnswers()))if(!(LATER_FIELDS.includes(key)&&blank(answers[key])))out[key]=answers[key];
  const slots={};for(const [key,value]of Object.entries(answers.slots||{}))if(value?.none)slots[key]={none:true};
  return {...out,slots,refs:(answers.refs||[]).filter(ref=>ref.url||ref.points?.length||ref.why)};
}
