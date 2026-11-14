import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readdir,rename,statfs,unlink,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {validMediaSignature} from './studio-media.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';
import {recordSceneReview} from './client-scene-requests.mjs';
import {CASTING_MODELS,OUTFIT_IDS,HAIR_IDS} from './public/pulse-app/casting-catalog.mjs';
import {castingOf,personaRefOf,MODEL_CHOICE_KINDS,MODEL_OPTIONAL_CHOICES} from './public/pulse-app/casting-choice.mjs';
import {LOCALES} from './public/pulse-app/i18n.mjs';
import {validPulseMailAddress} from './pulse-mail.mjs';
import {personaHoldsProject,PERSONA_SLOTS} from './pulse-personas.mjs';
import {applyInlineTranslations,missingTranslations,inlineObject} from './pulse-translations.mjs';
import {PROGRESS_FIELDS,applyProgressAction,progressOf,progressCustomerView} from './pulse-progress.mjs';

// 초대 없이 시작하는 공개 의뢰서(2026-11-04, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/README.md 5절).
// 공개 경로라 프로젝트는 「보내기」에서만 생긴다. 그 전의 초안 · 파일은 따로 두어 스팸이 직원 서버의 프로젝트 · 백업으로 번지지 않게 하고,
// 같은 볼륨을 쓰므로 주소별 · 전체 문턱과 디스크 여유를 먼저 본다. 어떤 칸도 보내기를 막지 않는다 — 막는 것은 연락처와 동의뿐이다.
const KIND='pulseRequests',TOKEN='pulse-request';
export const REQUEST_LIMITS=Object.freeze({
  draftDays:14,tokenDays:30,unconfirmedDays:90,resendMinutes:10,sendingMinutes:2,
  startsPerHourByClient:20,startsPerDay:300,submitsPerDay:50,savesPerHourByClient:1200,uploadsPerHourByClient:200,
  uploadBytesPerDayByClient:2*1024**3,uploadBytesPerDay:10*1024**3,
  filesPerDraft:30,bytesPerDraft:400*1024**2,fileBytes:100*1024**2,attachmentBytes:30*1024**2,
  messagePhotoBytes:15*1024**2, // 문의 사진 한 장(운영 조각 8-B) — 휴대폰 사진이 넉넉히 들어가는 크기
  minimumFreeBytes:20*1024**3,
});
// 오류 문장은 한국어 그대로 둔다 — 고정 문장은 화면이 그 문장을 키로 번역하고(i18n.mjs), 손님 글이 끼는 동적 문장만
// code(SYNK_PULSE_…, server.mjs가 SYNK_ 접두만 내린다)를 붙여 화면이 코드로 번역한다(기획 12-2 「서버 오류」).
const fail=(message,status=400,code='')=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const busy=()=>fail('지금 의뢰가 많아요. 잠시 뒤에 다시 시도하거나 hello@synk.im으로 알려 주세요.',429);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
function text(value,max){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max||CONTROL.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');return value.trim();}
// 주소는 쓰는 동안 막지 않는다(저장은 글자 그대로). 보낼 때만 고쳐 쓰고, 고칠 수 없으면 어느 칸인지 말한다.
// 칸마다 문장 하나를 통째로 받는다(번역 키가 고정 문장이 되게 — 이름을 끼워 잇지 않는다).
function link(value,strict,message){
  const raw=text(value,1000);if(!raw||!strict)return raw;
  const candidate=/^[a-z][a-z0-9+-]*:/i.test(raw)?raw:'https://'+raw;let parsed;
  try{parsed=new URL(candidate);}catch{throw fail(message);}
  if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw fail(message);
  return parsed.href;
}
// 빈 값은 안 보냄(undefined · null)과 빈 글뿐이다 — false · 0처럼 목록 밖의 다른 값은 거절한다(11-13 백엔드 검수 GA2: 그대로 저장되던 것).
const one=(value,list)=>{const found=value===undefined||value===null?'':value;if(found!==''&&!list.includes(found))throw fail('고른 값을 확인해 주세요.');return found;};
function many(value,list,max=list?.length??8,itemMax=40){if(value===undefined||value===null)return [];if(!Array.isArray(value)||value.length>max)throw fail('고른 값을 확인해 주세요.');const out=[...new Set(value.map(item=>text(item,itemMax)))].filter(Boolean);if(list&&out.some(item=>!list.includes(item)))throw fail('고른 값을 확인해 주세요.');return out;}

export const REQUEST_KINDS=['food','beauty','fashion','living','app','place','brand'];
export const REQUEST_CHANNELS=['shorts','youtube','store','screen'];
export const REQUEST_PACKAGES=['s15','s30','s60','corp','photo','ask'];
// 모델 정하는 법: 추천 · 사람 없이 · 새 전용 인물(custom) · 이미 있는 전용 인물(persona). 언어와 상관없는 ID다.
const ACTIONS=['buy','install','visit','ask','remember'],WINS=['story','impact','laugh','ask'],APPROVERS=['one','many'],MODEL_CHOICES=MODEL_CHOICE_KINDS;
// 의뢰서 탭(2026-11-13 — 더하기만): 얼마나 과감하게 · 광고에 꼭 붙일 표시가 있는 업종(none 해당 없음 · unsure 잘 모름) · 목소리. 화면 request-data.mjs의 BOLD · NOTICES · VOICES와 같은 ID다.
const BOLDS=['safe','twist','wild'],VOICES=['narration','model','none'];
const NOTICE_LABEL={'health-food':'건강기능식품',alcohol:'주류','functional-cosmetic':'기능성 화장품','beauty-device':'미용 기기','medical-device':'의료기기',sanitizer:'살균 · 소독 제품',kids:'어린이 제품',finance:'금융 · 투자',game:'게임',clinic:'병의원',academy:'학원','medical-pharma':'의료 · 제약'};
const NOTICES=[...Object.keys(NOTICE_LABEL),'none','unsure'];
const POINTS=['전개 · 구성','색감 · 빛','카메라 · 속도','모델 연기','소리 · 음악'];
export const REQUEST_SLOTS=['front','side','logo','label','use','detail','screens','space','menu','guide','scene','sound','etc'];
// 초안만 받는 인물 사진 칸(판 3): 접수 뒤 프로젝트 길(receiveProjectFile)은 이 칸을 받지 않는다 — 인물 사진이 프로젝트 자료(초대 링크로 열림)로 가면 안 된다.
const DRAFT_SLOTS=[...REQUEST_SLOTS,...PERSONA_SLOTS];
// 다국어 · 전용 인물 판 1(2026-11-09, 기획 12-2 「답 구조」 — 더하기만): 고른 모델의 헤어(캐스팅북 헤어 1 · 2 · 3), 소통 언어,
// 납품 언어, 대상 나라(ISO 두 글자), 견적을 보일 통화(표시만 — 값과 결제는 원화 그대로). 옛 화면이 안 보내면 빈 값으로 채운다.
// 옷(outfit, 2026-11-10 옷 · 머리 고르기): 고른 모델의 옷 세 벌(fullbody 기본 옷 · look-1 · look-2). 의뢰서에는 칸이 없고 방향을 고를 때 받는다.
const ANSWER_FIELDS=['name','kind','channels','paid','package','slots','size','useNote','pageUrl','driveUrl','audience','oneThing','action','screenText','avoid','avoidNote','facts','notice','noticeText','win','bold','refs','avoidFeel','models','modelChoice','hair','outfit','voice','date','dateFree','approver','approverName','contactName','company','email','phone','consent','rights','contactLocale','outputLocales','targetMarket','quoteCurrency','personaRequest'];
const MODEL_IDS=CASTING_MODELS.map(model=>model.id);
const HAIRS=HAIR_IDS,OUTFITS=OUTFIT_IDS,CURRENCIES=['KRW','USD','JPY','EUR'];
// 맞춤 인물 요청(판 3, modelChoice custom일 때만 쓰인다): 인물 종류, 원하는 인상 · 나이대 · 헤어와 참고할 점, 원하는 쓰임, 이번만 / 다음 광고에도,
// 실제 인물이면 관계(본인 · 소속 모델 · 그 밖)와 당사자 동의 확인 방법(확인 링크 · 서류). 국적 · 신체 치수 · 학습 설정은 묻지 않는다.
const PERSONA_REQUEST_KEYS=['kind','look','use','keep','relation','consentWay'];
export const emptyPersonaRequest=()=>({kind:'',look:'',use:'',keep:'',relation:'',consentWay:''});
function personaRequestOf(value){
  if(value===undefined||value===null)return emptyPersonaRequest();
  if(!object(value)||Object.keys(value).some(key=>!PERSONA_REQUEST_KEYS.includes(key)))throw fail('맞춤 인물 요청 항목을 확인해 주세요.');
  return {kind:one(value.kind,['virtual','real']),look:text(value.look,600),use:text(value.use,300),keep:one(value.keep,['once','reuse']),relation:one(value.relation,['self','agency','other']),consentWay:one(value.consentWay,['link','document'])};
}
const markets=value=>{const out=many(value,null,8,2);if(out.some(code=>!/^[A-Z]{2}$/.test(code)))throw fail('고른 값을 확인해 주세요.');return out;};

export function emptyRequestAnswers(){return {name:'',kind:'',channels:[],paid:false,package:'',slots:{},size:'',useNote:'',pageUrl:'',driveUrl:'',audience:'',oneThing:'',action:'',screenText:'',avoid:[],avoidNote:'',facts:'',notice:'',noticeText:'',win:'',bold:'',refs:[],avoidFeel:'',models:[],modelChoice:'',hair:'',outfit:'',voice:'',date:'',dateFree:false,approver:'',approverName:'',contactName:'',company:'',email:'',phone:'',consent:false,rights:false,contactLocale:'',outputLocales:[],targetMarket:[],quoteCurrency:'',personaRequest:emptyPersonaRequest()};}
// 저장(strict 아님)은 길이 · 제어문자 · 고르는 값만 본다. 칸을 쓰는 중에 형식 때문에 자동 저장이 끊기면 안 된다.
// 형식(메일 · 번호 · 주소 · 날짜)은 보낼 때 본다. 파일 목록은 서버가 쥐고, 답에서는 「지금 없어요」 표시만 받는다.
export function normalizeRequestAnswers(input,{strict=false}={}){
  if(!object(input)||Object.keys(input).some(key=>!ANSWER_FIELDS.includes(key)))throw fail('의뢰서 입력 항목을 확인해 주세요.');
  const slots={};if(input.slots!==undefined){if(!object(input.slots))throw fail('준비물 항목을 확인해 주세요.');for(const [key,value]of Object.entries(input.slots)){if(!REQUEST_SLOTS.includes(key)||!object(value))throw fail('준비물 항목을 확인해 주세요.');if(value.none===true)slots[key]={none:true};}}
  const refs=[];if(input.refs!==undefined){if(!Array.isArray(input.refs)||input.refs.length>3)throw fail('참고 광고는 셋까지 적어 주세요.');for(const ref of input.refs){if(!object(ref)||Object.keys(ref).some(key=>!['url','points','why'].includes(key)))throw fail('참고 광고 항목을 확인해 주세요.');const item={url:link(ref.url,strict,'참고 광고 주소를 확인해 주세요.'),points:many(ref.points,POINTS),why:text(ref.why,300)};if(item.url||item.points.length||item.why)refs.push(item);}}
  let date=text(input.date,10);if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)){if(strict)throw fail('받고 싶은 날을 확인해 주세요.');date='';}
  const email=text(input.email,254);if(strict&&email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('이메일 주소를 확인해 주세요.');
  // 점으로 나눈 번호(010.1234.5678 · +1 415.555.0134)도 받는다 — 국내 명함 · 북미에서 흔한 꼴인데 보내기 단계에서 거절되던 것(11-11 판 6 시나리오 12).
  const phone=text(input.phone,30);if(strict&&phone&&!/^[0-9+\-(). ]{7,30}$/.test(phone))throw fail('휴대폰 번호를 확인해 주세요.');
  // 「모델이 직접 말해요」는 사람이 나올 때만 뜻이 있다 — 「사람 없이」와 함께 오면 목소리를 비운다(화면도 같은 규칙).
  const modelChoice=one(input.modelChoice,MODEL_CHOICES),voice=one(input.voice,VOICES);
  return {
    name:text(input.name,120),kind:one(input.kind,REQUEST_KINDS),channels:many(input.channels,REQUEST_CHANNELS),paid:input.paid===true,package:one(input.package,REQUEST_PACKAGES),
    slots,size:text(input.size,120),useNote:text(input.useNote,200),pageUrl:link(input.pageUrl,strict,'제품 페이지 주소를 확인해 주세요.'),driveUrl:link(input.driveUrl,strict,'드라이브 주소를 확인해 주세요.'),
    audience:text(input.audience,300),oneThing:text(input.oneThing,300),action:one(input.action,ACTIONS),
    screenText:text(input.screenText,300),avoid:many(input.avoid,null,12,40),avoidNote:text(input.avoidNote,300),facts:text(input.facts,300),notice:one(input.notice,NOTICES),noticeText:text(input.noticeText,300),
    win:one(input.win,WINS),bold:one(input.bold,BOLDS),refs,avoidFeel:text(input.avoidFeel,200),models:many(input.models,MODEL_IDS,2),modelChoice,hair:one(input.hair,HAIRS),outfit:one(input.outfit,OUTFITS),voice:modelChoice==='none'&&voice==='model'?'':voice,
    date,dateFree:input.dateFree===true,approver:one(input.approver,APPROVERS),approverName:text(input.approverName,80),contactName:text(input.contactName,80),company:text(input.company,100),email,phone,consent:input.consent===true,rights:input.rights===true,
    contactLocale:one(input.contactLocale,LOCALES),outputLocales:many(input.outputLocales,LOCALES,LOCALES.length,8),targetMarket:markets(input.targetMarket),quoteCurrency:one(input.quoteCurrency,CURRENCIES),personaRequest:personaRequestOf(input.personaRequest),
  };
}
// 업로드 형식. 화면에 바로 띄우는 것은 서명을 재서 확인한 PNG · JPEG · MP4 · WebM뿐이고, 나머지는 내려받기 전용으로만 둔다.
// 소리(MP3 · WAV · M4A · AAC, 2026-11-13 의뢰서의 「브랜드 음악 · 로고 소리」 칸)도 내려받기 전용이다 — 화면에서 틀지 않는다.
const INLINE={'image/png':'png','image/jpeg':'jpg','video/mp4':'mp4','video/webm':'webm'};
const ATTACHMENT=/\.(webp|heic|heif|svg|ai|eps|pdf|ppt|pptx|mov|mp3|wav|m4a|aac)$/i;
const ftyp=head=>head.length>=12&&head.subarray(4,8).toString('ascii')==='ftyp';
// MPEG 소리 프레임 머리: 동기 11비트 뒤의 판(01은 없는 값) · 계층(II · III만 — 00은 ADTS, 11은 0xFF 0xFE로 시작하는 UTF-16 글과 겹친다) · 비트율(1111 없음) · 표본율(11 없음)까지 본다.
// 형식을 속인 파일을 거르는 확인일 뿐이고, 안전은 내려받기 전용으로만 내주는 데서 지킨다.
const mpegFrame=head=>head.length>=3&&head[0]===0xff&&(head[1]&0xe0)===0xe0&&(head[1]&0x18)!==0x08&&[0x02,0x04].includes(head[1]&0x06)&&(head[2]&0xf0)!==0xf0&&(head[2]&0x0c)!==0x0c;
const SIGNATURES={
  webp:head=>head.subarray(0,4).toString('ascii')==='RIFF'&&head.subarray(8,12).toString('ascii')==='WEBP',
  heic:ftyp,heif:ftyp,mov:head=>ftyp(head)||['moov','mdat','wide','free'].includes(head.subarray(4,8).toString('ascii')),
  svg:head=>/^\s*(?:﻿)?<(?:\?xml|svg|!--|!DOCTYPE)/i.test(head.toString('utf8')),
  pdf:head=>head.subarray(0,5).toString('ascii')==='%PDF-',
  ai:head=>['%PDF-','%!PS-'].includes(head.subarray(0,5).toString('ascii')),
  eps:head=>head.subarray(0,5).toString('ascii')==='%!PS-'||head.subarray(0,4).equals(Buffer.from([0xc5,0xd0,0xd3,0xc6])),
  pptx:head=>head.subarray(0,2).toString('ascii')==='PK',
  ppt:head=>head.subarray(0,4).equals(Buffer.from([0xd0,0xcf,0x11,0xe0])),
  // MP3는 ID3 머리나 MPEG 소리 프레임 머리, AAC는 ADTS 머리(계층 00 · 표본율 칸 0~12), WAV는 RIFF…WAVE, M4A는 ftyp.
  mp3:head=>head.subarray(0,3).toString('ascii')==='ID3'||mpegFrame(head),
  aac:head=>head.length>=3&&head[0]===0xff&&(head[1]&0xf6)===0xf0&&((head[2]>>2)&0x0f)<=12,
  wav:head=>head.subarray(0,4).toString('ascii')==='RIFF'&&head.subarray(8,12).toString('ascii')==='WAVE',
  m4a:ftyp,
};
export function requestFileKind(mimeType,fileName){
  const name=String(fileName||'');
  if(INLINE[mimeType]){const extension=INLINE[mimeType],suffix=name.split('.').pop().toLowerCase();if([extension,...(extension==='jpg'?['jpeg']:[])].includes(suffix))return {inline:true,extension};}
  const attachment=ATTACHMENT.exec(name);if(attachment)return {inline:false,extension:'intake',type:attachment[1].toLowerCase()};
  throw fail('이 형식은 받을 수 없어요. 사진(JPG · PNG), 영상(MP4), 로고(AI · SVG · PDF), 소리(MP3 · WAV · M4A) 같은 파일로 보내 주시거나 드라이브 링크를 적어 주세요.',415);
}
// 인물 사진: 화면에 띄우는 JPG · PNG, 또는 휴대폰 사진 HEIC · WebP(내려받기 전용 — 직원이 바꿔 판으로 올린다). 영상 · 문서는 받지 않는다.
export function personaFileKind(mimeType,fileName){
  let kind;try{kind=requestFileKind(mimeType,fileName);}catch{kind=null;}
  if(kind&&(kind.inline&&String(mimeType).startsWith('image/')||!kind.inline&&['webp','heic','heif'].includes(kind.type)))return kind;
  throw fail('인물 사진은 JPG · PNG로 보내 주세요. 휴대폰 사진(HEIC · WebP)도 받지만 담당자가 바꿔서 봐요.',415);
}
export const validRequestFile=(kind,mimeType,head)=>kind.inline?validMediaSignature(mimeType,head):!!SIGNATURES[kind.type]?.(head);
// 새 고객 방을 쓸 프로젝트: 의뢰서가 있거나, 담당자가 막 만들어 아직 아무 자료도 쌓이지 않은 프로젝트. 옛 자료가 쌓인 프로젝트는 옛 탭을 그대로 쓴다.
export function usesRequestFlow(row,studio){
  if(studio?.request)return true;
  return ['received','planning'].includes(row.stage)&&!studio?.strategy?.revision&&!studio?.scenes?.length&&!studio?.concepts?.length&&!studio?.references?.length&&!studio?.assets?.length&&!row.intake?.files?.length&&!row.messages?.length&&!row.versions?.length;
}
// 접수 번호의 날짜는 한국 날짜다(서버 시계는 UTC — 11-10 03:34 KST 접수가 P-1109로 찍혔다).
const kstMonthDay=at=>{const date=new Date(new Date(at).getTime()+9*3600000);return `${String(date.getUTCMonth()+1).padStart(2,'0')}${String(date.getUTCDate()).padStart(2,'0')}`;};
const requestNumber=at=>`P-${kstMonthDay(at)}-${randomBytes(2).toString('hex').toUpperCase()}`;
export function requestSummaryRows(a,files=[],personaFiles=null){
  return [a.oneThing&&`남길 것: ${a.oneThing}`,a.audience&&`보는 사람: ${a.audience}`,a.channels?.length&&`올릴 곳: ${a.channels.join(', ')}`,a.package&&`구성: ${a.package}`,`받은 자료: ${files.length}개`,personaFiles&&`맞춤 인물: ${a.personaRequest?.kind==='real'?'실제 인물':'새 가상 인물'} · 사진 ${personaFiles.length}장`].filter(Boolean).join('\n');
}

// personas: 인물 서비스(pulse-personas.mjs createPersonaService — 스위치 확인 · 인물 만들기). 없으면 맞춤 인물 요청을 받지 않는다.
// workspaces: 고객 브랜드 서비스(pulse-workspaces.mjs — 판 4 내 모델 다시 쓰기의 붙임 검사 · 담당자). 없으면 다시 쓰기 의뢰를 받지 않는다.
export function createPulseRequests({store,clientProjects,clock=()=>new Date().toISOString(),freeBytes,personas=null,workspaces=null,intakePaused=null,intakeFull=null}){
  const directory=()=>resolve(store.directory,'pulse-request-media'),media=()=>resolve(store.directory,'studio-media');
  const inDraft=name=>{if(!/^[a-f0-9-]{36}\.(?:part|mp4|webm|png|jpg|intake)$/.test(name))throw fail('파일 경로를 확인해 주세요.',404);const path=resolve(directory(),name);if(dirname(path)!==directory())throw fail('파일 경로를 확인해 주세요.',404);return path;};
  const inMedia=name=>{if(!/^[a-f0-9-]{36}\.(?:upload|mp4|webm|png|jpg|intake)$/.test(name))throw fail('파일 경로를 확인해 주세요.',404);const path=resolve(media(),name);if(dirname(path)!==media())throw fail('파일 경로를 확인해 주세요.',404);return path;};
  const now=()=>Date.parse(clock());
  // 문턱 값은 메모리에 둔다(쓰기 서버 하나). 시작 · 접수 수는 기록을 세어 재시작에도 이어지고, 파일 바이트 수는 재시작하면 다시 센다 — 디스크 여유 검사가 마지막 방어다.
  const counters=new Map();
  function count(key,amount,max,windowMs){
    const stamp=now();for(const [name,row]of counters)if(row.until<=stamp)counters.delete(name);
    if(counters.size>5000)throw busy();
    const row=counters.get(key)||{until:stamp+windowMs,value:0};if(row.value+amount>max)throw busy();
    row.value+=amount;counters.set(key,row);
  }
  const recent=hours=>store.all(KIND).filter(row=>now()-Date.parse(row.createdAt)<hours*3600000);
  async function assertDisk(){
    const check=freeBytes||(async()=>{const info=await statfs(store.directory);return Number(info.bavail)*Number(info.bsize);});
    let free;try{free=await check();}catch{return;}
    // 5xx는 회사 서버가 글을 가리므로(현장 노트 배포_공개) 손님이 읽어야 할 안내는 4xx로 낸다.
    if(free<REQUEST_LIMITS.minimumFreeBytes)throw fail('지금은 파일을 받을 수 없어요. 드라이브 링크를 적어 주시거나 hello@synk.im으로 알려 주세요.',409);
  }
  function draftOf(raw,csrf,{write=false}={}){
    const auth=store.readToken(raw,TOKEN);let row=auth&&store.get(KIND,auth.body.requestId);
    if(!row||row.status==='removing')throw fail('이어 쓸 의뢰서를 찾지 못했어요. 처음부터 시작해 주세요.',401);
    // 보내다 서버가 멈춘 초안은 잠시 뒤 다시 쓸 수 있다.
    if(row.status==='sending'&&now()-Date.parse(row.sendingAt)>REQUEST_LIMITS.sendingMinutes*60000){const {sendingAt,sendingId,...rest}=row;row={...rest,status:'draft'};}
    // 보낸 뒤의 토큰은 응답을 못 받은 경우의 다시 보내기만 잠깐 허용한다.
    if(row.status==='submitted'&&now()-Date.parse(row.submittedAt)>REQUEST_LIMITS.resendMinutes*60000)throw fail('이미 보낸 의뢰서예요. 받은 링크로 열어 주세요.',401);
    if(write&&(typeof csrf!=='string'||csrf!==auth.body.csrf))throw fail('화면을 새로 고친 뒤 다시 시도해 주세요.',403);
    return {auth,row};
  }
  const fileView=file=>({id:file.id,slot:file.slot,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,inline:file.inline});
  const view=(row,auth)=>({id:row.id,status:row.status,step:row.step||'',answers:row.answers||emptyRequestAnswers(),files:(row.files||[]).map(fileView),csrf:auth?.body?.csrf,number:row.number||''});

  function start(input={},{client=''}={}){
    pruneDrafts().catch(()=>{});
    if(!object(input)||input.website)throw fail('의뢰서 요청을 확인해 주세요.');
    // 접수를 쉬는 동안(운영 조각 3, pulse-capacity.mjs): 막는 자리는 새 초안을 여는 여기 하나뿐이다. 쓰던 초안의 저장 · 보내기 · 10분 재전송은 이 길을 지나지 않는다.
    if(intakePaused?.())throw fail('지금은 잠시 접수를 쉬어요. 다시 열리면 이 화면에서 바로 시작하실 수 있어요.',409,'SYNK_PULSE_INTAKE_PAUSED');
    // 제작 자리 · 대기가 모두 찼을 때(운영 조각 6-B): 새로 쓰기 시작만 막는다 — 쓰던 초안의 보내기 · 10분 재전송은 그대로 받는다(대기로).
    if(intakeFull?.())throw fail('지금은 예약이 찼어요. 자리가 나면 이 화면에서 다시 받아요.',409,'SYNK_PULSE_INTAKE_FULL');
    count('start:'+digest(client),1,REQUEST_LIMITS.startsPerHourByClient,3600000);
    if(recent(24).length>=REQUEST_LIMITS.startsPerDay)throw busy();
    const at=clock(),id=randomUUID(),csrf=randomBytes(24).toString('base64url');
    const row={id,revision:1,status:'draft',createdAt:at,updatedAt:at,step:'',answers:emptyRequestAnswers(),files:[],bytes:0};
    store.put(KIND,id,row);
    const token=store.mint(TOKEN,null,{requestId:id,csrf},REQUEST_LIMITS.tokenDays*1440);
    return {token,draft:view(row,{body:{csrf}})};
  }
  // 쓰던 의뢰서가 있는지 묻는 자리다. 없거나 기한이 지났으면 「없음」으로 답해 첫 손님의 콘솔에 오류가 남지 않게 한다.
  function read(raw){try{const {auth,row}=draftOf(raw);return {draft:view(row,auth)};}catch(error){if(error.status===401)return {draft:null};throw error;}}
  function save(raw,csrf,input,{client=''}={}){
    count('save:'+digest(client),1,REQUEST_LIMITS.savesPerHourByClient,3600000);
    return store.transaction(()=>{
      const {auth,row}=draftOf(raw,csrf,{write:true});
      if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
      if(!object(input)||Object.keys(input).some(key=>!['answers','step'].includes(key)))throw fail('의뢰서 입력 항목을 확인해 주세요.');
      const answers=normalizeRequestAnswers(input.answers);
      // 내 모델 다시 쓰기(판 4, 설계 5-4 · 5판 D8): persona는 붙이기(/api/customer/pulse/draft-persona)로만 생긴다 — 붙임이 있을 때만 그대로 두고(카탈로그 모델 · 헤어는 비운다),
      // 다른 선택으로 바꿔 저장하면 붙임을 지운다. 스위치가 꺼졌으면 붙임이 남아 있어도 persona를 받지 않는다.
      let personaAttach=row.personaAttach||null;
      if(answers.modelChoice==='persona'){if(!personaAttach||!workspaces?.enabled())throw fail('내 모델에서 다시 골라 주세요.',409);answers.models=[];answers.hair='';}
      else personaAttach=null;
      const {personaAttach:dropped,...rest}=row;
      const updated={...rest,answers,step:text(input.step,20),updatedAt:clock(),...(personaAttach?{personaAttach}:{})};
      store.put(KIND,row.id,updated);
      return {draft:view(updated,auth)};
    });
  }
  // 파일 받기: 스트림으로 쓰면서 재고, 끝난 뒤 서명을 확인한다. 실패하면 조각을 남기지 않는다.
  async function receive(req,raw,csrf,{client=''}={}){
    const before=draftOf(raw,csrf,{write:true}).row;
    if(before.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
    if(before.files.length>=REQUEST_LIMITS.filesPerDraft)throw fail('파일은 30개까지 보낼 수 있어요. 나머지는 드라이브 링크로 적어 주세요.',413);
    count('upload:'+digest(client),1,REQUEST_LIMITS.uploadsPerHourByClient,3600000);
    await assertDisk();
    const header=key=>{const value=req.headers[key];if(value==null)return '';try{return decodeURIComponent(value);}catch{throw fail('파일 이름을 확인해 주세요.');}};
    const fileName=text(header('x-file-name'),200),slot=one(header('x-request-slot'),DRAFT_SLOTS),mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!fileName||!slot)throw fail('파일 정보를 확인해 주세요.');
    const personaSlot=PERSONA_SLOTS.includes(slot);
    if(personaSlot&&!personas?.flags().personaRequest)throw fail('맞춤 인물 요청은 아직 받지 않아요. 다른 모델 선택으로 보내 주세요.',409);
    const kind=personaSlot?personaFileKind(mimeType,fileName):requestFileKind(mimeType,fileName),limit=kind.inline?REQUEST_LIMITS.fileBytes:REQUEST_LIMITS.attachmentBytes,tooBig=()=>fail(kind.inline?'파일은 100MB까지 받을 수 있어요. 더 크면 드라이브 링크로 적어 주세요.':'이 형식은 30MB까지 받을 수 있어요. 더 크면 드라이브 링크로 적어 주세요.',413);
    const declared=Number(req.headers['content-length']);if(declared>limit)throw tooBig();
    if(before.bytes+(declared||0)>REQUEST_LIMITS.bytesPerDraft)throw fail('파일이 많아요. 나머지는 드라이브 링크로 적어 주세요.',413);
    if(declared){count('bytes:'+digest(client),declared,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',declared,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
    const id=randomUUID(),temporary=inDraft(id+'.part');
    await mkdir(directory(),{recursive:true,mode:0o700});
    const handle=await open(temporary,'wx',0o600),sha=createHash('sha256');let size=0,head=Buffer.alloc(0);
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;if(size>limit){req.resume();throw tooBig();}
        if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
        sha.update(chunk);let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
      }
      await handle.close();
      if(!size||!validRequestFile(kind,mimeType,head))throw fail('파일 내용이 형식과 달라요. 다른 파일을 골라 주세요.',415);
      if(!declared){count('bytes:'+digest(client),size,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',size,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
      const diskName=`${id}.${kind.extension}`,file={id,slot,diskName,fileName,mimeType:kind.inline?mimeType:'application/octet-stream',byteSize:size,sha256:sha.digest('hex'),inline:kind.inline,at:clock()};
      await rename(temporary,inDraft(diskName));
      try{
        return store.transaction(()=>{
          const {auth,row}=draftOf(raw,csrf,{write:true});
          if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
          if(row.files.length>=REQUEST_LIMITS.filesPerDraft||row.bytes+size>REQUEST_LIMITS.bytesPerDraft)throw fail('파일이 많아요. 나머지는 드라이브 링크로 적어 주세요.',413);
          const updated={...row,files:[...row.files,file],bytes:row.bytes+size,updatedAt:clock()};store.put(KIND,row.id,updated);
          return {file:fileView(file),draft:view(updated,auth)};
        });
      }catch(error){await unlink(inDraft(diskName)).catch(()=>{});throw error;}
    }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  }
  async function removeFile(raw,csrf,fileId){
    const removed=store.transaction(()=>{
      const {row,auth}=draftOf(raw,csrf,{write:true});
      if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
      const file=row.files.find(item=>item.id===fileId);if(!file)throw fail('파일을 찾지 못했어요.',404);
      const updated={...row,files:row.files.filter(item=>item.id!==fileId),bytes:row.bytes-file.byteSize,updatedAt:clock()};store.put(KIND,row.id,updated);
      return {file,draft:view(updated,auth)};
    });
    await unlink(inDraft(removed.file.diskName)).catch(()=>{});
    // 앞서 보내다 실패했으면 프로젝트 쪽 폴더로 옮겨 가 있다(submit). 접수 전이라 어느 프로젝트도 가리키지 않는다.
    await unlink(inMedia(removed.file.diskName)).catch(()=>{});
    return {draft:removed.draft};
  }
  // 본인이 고르며 올린 사진을 다시 보여 줄 때. 화면에 바로 띄우는 형식만 내준다.
  function draftFilePath(raw,fileId){const {row}=draftOf(raw),file=(row.files||[]).find(item=>item.id===fileId);if(!file||!file.inline)throw fail('파일을 찾지 못했어요.',404);return {paths:[inDraft(file.diskName),inMedia(file.diskName)],file};}
  function newNumber(at){
    const day=kstMonthDay(at),used=new Set([...store.all(KIND).map(row=>row.number),...store.all('clientProjects').map(row=>row.studio?.request?.number)].filter(Boolean));
    for(let i=0;i<20;i++){const candidate=`P-${day}-${randomBytes(2).toString('hex').toUpperCase()}`;if(!used.has(candidate))return candidate;}
    throw busy();
  }
  async function submit(raw,csrf,input,{client=''}={}){
    const {row:peek}=draftOf(raw,csrf,{write:true});
    // 응답을 못 받고 다시 누른 경우(보낸 뒤 잠깐만): 원문 초대는 저장하지 않으므로 새로 발급해 같은 프로젝트로 잇는다.
    const again=row=>{const {invite,expiresAt}=clientProjects.reissueRequestInvite(row.projectId),opened=clientProjects.open(invite);return {number:row.number,at:row.submittedAt,projectId:row.projectId,invite,expiresAt,session:opened.session,csrf:opened.csrf,duplicate:true};};
    if(peek.status==='submitted')return store.transaction(()=>again(peek));
    if(!object(input)||Object.keys(input).some(key=>key!=='answers'))throw fail('의뢰서 입력 항목을 확인해 주세요.');
    const answers=normalizeRequestAnswers(input.answers,{strict:true});
    if(!answers.name)throw fail('제품이나 브랜드 이름을 알려 주세요.');
    if(!answers.contactName||!(answers.email||answers.phone))throw fail('성함과 연락받을 곳(이메일이나 휴대폰)을 알려 주세요.');
    if(!answers.consent||!answers.rights)throw fail('동의 칸을 확인해 주세요.');
    const custom=answers.modelChoice==='custom',flags=personas?.flags()||{personaRequest:false,personaReal:false};
    if(custom&&!flags.personaRequest)throw fail('맞춤 인물 요청은 아직 받지 않아요. 다른 모델 선택으로 보내 주세요.',409);
    if(custom&&answers.personaRequest.kind==='real'&&!flags.personaReal)throw fail('실제 인물 출연 요청은 아직 받지 않아요. 새 가상 인물로 요청해 주세요.',409);
    // 내 모델 다시 쓰기(판 4, 설계 5-4): 몸통이 persona면 붙임이 꼭 있어야 하고(24시간 안 · 붙인 사람이 그 브랜드의 지금 회원 · 브랜드 활성 · 다시 쓸 수 있음),
    // 아니면 「내 모델에서 다시 골라 주세요」 409. 몸통이 다른 선택이면 붙임을 보지 않는다(보낸 뒤 초안 줄이 바뀌며 사라진다). 잠근 뒤 같은 검사를 한 번 더 한다.
    const reuse=answers.modelChoice==='persona';
    if(reuse){if(!workspaces)throw fail('내 모델에서 다시 골라 주세요.',409);workspaces.attachedRequest(peek);answers.models=[];answers.hair='';}
    count('submit:'+digest(client),1,10,3600000);
    if(store.all(KIND).filter(row=>row.status==='submitted'&&now()-Date.parse(row.submittedAt)<86400000).length>=REQUEST_LIMITS.submitsPerDay)throw busy();
    // 보내는 동안에는 새 파일 · 저장을 받지 않는다. 기록하는 파일 목록이 잠근 때의 목록과 같아야 한다.
    const sending=store.transaction(()=>{
      const {row}=draftOf(raw,csrf,{write:true});
      if(row.status==='submitted')return row;
      if(row.status==='sending')throw fail('보내는 중이에요. 잠시 뒤 다시 확인해 주세요.',409);
      const at=clock(),locked={...row,status:'sending',sendingAt:at,sendingId:randomUUID(),updatedAt:at};store.put(KIND,row.id,locked);return locked;
    });
    if(sending.status==='submitted')return store.transaction(()=>again(sending));
    // 파일은 앞으로만 옮기고 되돌리지 않는다(옮기고 되돌리던 처음 설계는 잠금이 풀린 사이의 경쟁을 막지 못했다 — GPT 세 회차 · Fable 설계 검토).
    // 프로젝트 쪽 폴더의 파일은 프로젝트가 가리키기 전까지 아무 일도 하지 않고 백업에도 오르지 않는다. 어디서 실패하거나 서버가 멈춰도 파일은 두 폴더 중 한 곳에 그대로 있고,
    // 같은 요청을 다시 보내면 그대로 잇는다. 다시 보내지 않으면 14일 정리(pruneDrafts)나 파일 지우기(removeFile)가 두 폴더를 함께 지운다.
    try{
      await mkdir(media(),{recursive:true,mode:0o700});
      for(const file of sending.files){
        const source=inDraft(file.diskName),target=inMedia(file.diskName);
        try{await rename(source,target);}catch(error){if(error.code!=='ENOENT')throw error;if(!await stat(target).catch(()=>null))throw fail(`「${file.fileName}」 파일을 찾지 못했어요. 지우고 다시 올려 주세요.`,409,'SYNK_PULSE_FILE_MISSING');}
      }
      const done=store.transaction(()=>{
        const {row}=draftOf(raw,csrf,{write:true}),held=store.get(KIND,sending.id);
        // 늦게 끝난 보내기: 다른 보내기가 이미 접수했다. 여기서 새 초대를 만들면 손님이 쓰고 있는 세션이 끊긴다.
        if(held?.status==='submitted')throw fail('이미 보낸 의뢰서예요. 받은 링크로 열어 주세요.',409);
        // 옮기는 일이 2분을 넘기면 잠금이 풀린다. 그 사이 손님이 저장하거나 파일을 더했거나 다른 보내기가 잠금을 가져갔으면 잠근 때의 목록을 기록하면 안 되니 여기서 멈춘다.
        if(held?.status!=='sending'||held.sendingId!==sending.sendingId)throw fail('보내는 동안 내용이 바뀌었어요. 다시 보내 주세요.',409);
        // 인물 사진 칸은 프로젝트 자료로 가지 않는다: 맞춤 인물이면 인물 문서의 출처로, 아니면 접수 뒤 지운다(손님이 마음을 바꾼 얼굴 사진).
        const at=clock(),attached=reuse?workspaces.attachedRequest(held,at):null;
        const no=newNumber(at),personaFiles=sending.files.filter(file=>PERSONA_SLOTS.includes(file.slot)),files=sending.files.filter(file=>!PERSONA_SLOTS.includes(file.slot));
        const assets=files.filter(file=>file.inline).map(file=>({id:file.id,diskName:file.diskName,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,slot:file.slot,author:'customer',authorId:'customer',authorName:answers.contactName,at:file.at}));
        const attachments=files.filter(file=>!file.inline).map(file=>({id:file.id,diskName:file.diskName,fileName:file.fileName,byteSize:file.byteSize,mimeType:file.mimeType,sha256:file.sha256,kind:'attachment',slot:file.slot}));
        const {consent,rights,...kept}=answers;
        const request={schemaVersion:1,number:no,status:'submitted',submittedAt:at,consentAt:at,answers:kept,files:files.map(fileView),asks:[],notes:[],rounds:[]};
        const studio={...emptyPulseStudio(),assets,request};
        const contact=[answers.contactName,answers.email,answers.phone].filter(Boolean).join(' · ').slice(0,300);
        // 다시 쓰기 의뢰는 붙임을 workspaceRequest로 옮겨 적고(직원이 접수 때 확인한다 — 설계 3-3), 담당자는 그 브랜드 담당(일하는 직원이면).
        const {project,invite,expiresAt}=clientProjects.createFromRequest({title:answers.name,customerName:answers.company||answers.contactName,contact,summary:requestSummaryRows(answers,files,custom?personaFiles:null),studio,attachments,...(attached?{ownerId:attached.ownerId,workspaceRequest:attached.workspaceRequest}:{})});
        if(custom)personas.create({projectId:project.id,request:{...answers.personaRequest,kind:answers.personaRequest.kind||'virtual'},files:personaFiles,at});
        const opened=clientProjects.open(invite);
        store.put(KIND,row.id,{id:row.id,status:'submitted',createdAt:row.createdAt,submittedAt:at,updatedAt:at,files:[],bytes:0,projectId:project.id,number:no});
        return {receipt:{number:no,at,projectId:project.id,invite,expiresAt,session:opened.session,csrf:opened.csrf},discard:custom?[]:personaFiles};
      });
      for(const file of done.discard)await unlink(inMedia(file.diskName)).catch(()=>{});
      return done.receipt;
    }catch(error){
      store.transaction(()=>{const current=store.get(KIND,sending.id);if(current?.status==='sending'&&current.sendingId===sending.sendingId){const {sendingAt,sendingId,...rest}=current;store.put(KIND,sending.id,{...rest,status:'draft'});}});
      throw error;
    }
  }
  // 14일 안 건드린 초안을 지운다. 공개 요청에서 돌아도 되는 유일한 정리다(남의 프로젝트에 닿지 않는다).
  async function pruneDrafts(){
    const stamp=now(),stale=row=>row?.status==='removing'||['draft','sending'].includes(row?.status)&&stamp-Date.parse(row.updatedAt||row.createdAt)>REQUEST_LIMITS.draftDays*86400000;
    for(const {id} of store.all(KIND).filter(stale)){
      // 지우기 직전에 다시 보고 표시부터 한다(표시한 뒤로는 손님이 쓸 수 없다). 그 사이 손님이 저장했으면 그대로 둔다. 파일을 지운 뒤에 기록을 지우므로, 사이에 서버가 멈춰도 다음 정리가 잇는다.
      const marked=store.transaction(()=>{const row=store.get(KIND,id);if(!stale(row))return null;const next={...row,status:'removing'};store.put(KIND,id,next);return next;});
      if(!marked)continue;
      // 보내다 멈춘 초안의 파일은 프로젝트 쪽 폴더로 옮겨 가 있을 수 있다. 접수되지 않았으니 어느 프로젝트도 가리키지 않는다.
      for(const file of marked.files||[]){await unlink(inDraft(file.diskName)).catch(()=>{});await unlink(inMedia(file.diskName)).catch(()=>{});}
      store.remove(KIND,id);
    }
    // 파일을 지우거나 올리는 도중에 서버가 멈추면 파일만 남는다. 어느 초안도 가리키지 않고 하루 넘게 그대로인 파일을 지운다.
    const kept=new Set(store.all(KIND).flatMap(row=>(row.files||[]).map(file=>file.diskName)));
    for(const name of await readdir(directory()).catch(()=>[])){
      if(kept.has(name))continue;
      let file;try{file=inDraft(name);}catch{continue;}
      const info=await stat(file).catch(()=>null);
      if(info&&stamp-info.mtimeMs>86400000)await unlink(file).catch(()=>{});
    }
  }
  // 동의 문구의 약속: 접수 뒤 90일 동안 아무 움직임이 없고 제작으로 이어지지 않은 의뢰는 연락처 · 답 · 파일을 지우고 보관으로 돌린다.
  // 유지보수 예약에서만 돈다(익명 요청이 방아쇠가 되면 안 된다). 움직임 하나라도 있으면 그때부터 다시 잰다.
  // 차례(판 4 설계 11-6 「한 길」 — Fable 5.2 설계 검토 11-12): 먼저 보관 기간 뒤 지우기(sweepRetention — 브랜드 인물의 기한 · 브랜드 없는 인물의 90일 시계,
  // 14일 전 예고 뒤에만 지움), 그다음 의뢰 정리. 브랜드 없는 인물(또는 열린 인물)이 살아 있는 의뢰는 정리하지 않는다 — 인물이 시계로 지워진 같은 회차에 정리된다.
  // 그래서 브랜드 없는 인물을 지우는 날은 직원 · 손님 화면이 보는 시계의 날 하나다. startup(서버 시작 직후 회차): 예고만 내고 지우기 · 정리는 다음 회차(6시간 뒤)부터 —
  // 백업 복원 직후 잃은 구간의 움직임을 사람이 볼 틈을 둔다(Fable 5.2 설계 검토 P3).
  async function retireUnconfirmed({startup=false}={}){
    const retention=workspaces?.sweepRetention?await workspaces.sweepRetention({noticeOnly:startup}):null;
    const stamp=now(),cutoff=REQUEST_LIMITS.unconfirmedDays*86400000;let retired=0;
    for(const row of startup?[]:store.all(KIND)){
      if(row.status!=='submitted')continue;
      const project=row.projectId&&store.get('clientProjects',row.projectId);
      if(!project){if(stamp-Date.parse(row.submittedAt)>cutoff)store.remove(KIND,row.id);continue;}
      if(stamp-Date.parse(project.updatedAt)<=cutoff)continue;
      // 붙잡는 인물은 정리하는 바로 그 순간에 본다(await 없이 정리 트랜잭션 앞 — 회차 도중의 귀속 취소 · 새 요청도 본다, Fable 5.2 설계 검토 P1 (b)).
      // 정리 대기 줄을 지우는 아래 갈래보다 먼저 본다 — 인물 검토 중 보관한 의뢰도 줄을 남겨, 보관을 풀면 뒤에 정리된다(GPT 서버 다시 검수 GA1).
      if(personaHoldsProject(store,project.id))continue;
      // 보관한 확인 전 의뢰는 대기 줄을 남긴다 — 보관을 풀면(received) 그때부터 다시 재어 정리된다(GPT 서버 끝 판 GA1). 확인됐거나 다른 단계로 간 의뢰만 줄을 지운다.
      if(!project.studio?.request?.confirmedAt&&project.stage==='archived')continue;
      if(project.studio?.request?.confirmedAt||project.stage!=='received'){store.remove(KIND,row.id);continue;}
      const files=clientProjects.retireRequest(project.id,{...emptyPulseStudio(),request:{schemaVersion:1,number:row.number||'',status:'retired',retiredAt:clock(),answers:{},files:[],asks:[],notes:[],rounds:[]}});
      for(const file of files)await unlink(inMedia(file.diskName)).catch(()=>{});
      store.remove(KIND,row.id);retired++;
    }
    return {retired,...(retention&&(retention.deleted||retention.held||retention.failed||retention.noticed||retention.resumed||retention.unclear)?{retention}:{})};
  }
  // 접수 뒤 손님이 더 보내는 파일(되묻기 답 · 자료 더 보내기 · 담당자가 만든 프로젝트의 의뢰서). 받는 형식과 문턱은 초안과 같고, 자리는 처음부터 백업되는 폴더다.
  async function receiveProjectFile(req,{session,client=''}){
    const before=session();
    if(before.row.stage==='archived')throw fail('보관된 프로젝트예요.',409);
    if((before.row.studio?.request?.files||[]).length>=REQUEST_LIMITS.filesPerDraft*2)throw fail('파일이 많아요. 나머지는 드라이브 링크로 알려 주세요.',413);
    count('upload:'+digest(client),1,REQUEST_LIMITS.uploadsPerHourByClient,3600000);
    await assertDisk();
    const header=key=>{const value=req.headers[key];if(value==null)return '';try{return decodeURIComponent(value);}catch{throw fail('파일 이름을 확인해 주세요.');}};
    const fileName=text(header('x-file-name'),200),slot=one(header('x-request-slot'),REQUEST_SLOTS)||'etc',mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!fileName)throw fail('파일 정보를 확인해 주세요.');
    const kind=requestFileKind(mimeType,fileName),limit=kind.inline?REQUEST_LIMITS.fileBytes:REQUEST_LIMITS.attachmentBytes,tooBig=()=>fail(kind.inline?'파일은 100MB까지 받을 수 있어요. 더 크면 드라이브 링크로 알려 주세요.':'이 형식은 30MB까지 받을 수 있어요. 더 크면 드라이브 링크로 알려 주세요.',413);
    const declared=Number(req.headers['content-length']);if(declared>limit)throw tooBig();
    if(declared){count('bytes:'+digest(client),declared,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',declared,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
    const id=randomUUID(),temporary=inMedia(id+'.upload');
    await mkdir(media(),{recursive:true,mode:0o700});
    const handle=await open(temporary,'wx',0o600),sha=createHash('sha256');let size=0,head=Buffer.alloc(0);
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;if(size>limit){req.resume();throw tooBig();}
        if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
        sha.update(chunk);let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
      }
      await handle.close();
      if(!size||!validRequestFile(kind,mimeType,head))throw fail('파일 내용이 형식과 달라요. 다른 파일을 골라 주세요.',415);
      if(!declared){count('bytes:'+digest(client),size,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',size,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
      const diskName=`${id}.${kind.extension}`;
      await rename(temporary,inMedia(diskName));
      return {id,slot,diskName,fileName,mimeType:kind.inline?mimeType:'application/octet-stream',byteSize:size,sha256:sha.digest('hex'),inline:kind.inline,at:clock()};
    }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  }
  // 고객 방에서 더 보내는 인물 사진(판 3). 같은 문턱 · 디스크 검사를 지나 처음부터 백업되는 폴더에 쓰고, 인물 출처 문서는 부른 쪽(pulse-personas addSource)이 남긴다.
  async function receivePersonaFile(req,{session,client=''}){
    const before=session();
    if(before.row.stage==='archived')throw fail('보관된 프로젝트예요.',409);
    count('upload:'+digest(client),1,REQUEST_LIMITS.uploadsPerHourByClient,3600000);
    await assertDisk();
    const header=key=>{const value=req.headers[key];if(value==null)return '';try{return decodeURIComponent(value);}catch{throw fail('파일 이름을 확인해 주세요.');}};
    const fileName=text(header('x-file-name'),200),purpose=one(header('x-persona-purpose'),['identity','mood']),mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!fileName||!purpose)throw fail('파일 정보를 확인해 주세요.');
    const kind=personaFileKind(mimeType,fileName),limit=kind.inline?REQUEST_LIMITS.fileBytes:REQUEST_LIMITS.attachmentBytes,tooBig=()=>fail(kind.inline?'파일은 100MB까지 받을 수 있어요. 더 크면 드라이브 링크로 알려 주세요.':'이 형식은 30MB까지 받을 수 있어요. 더 크면 드라이브 링크로 알려 주세요.',413);
    const declared=Number(req.headers['content-length']);if(declared>limit)throw tooBig();
    if(declared){count('bytes:'+digest(client),declared,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',declared,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
    const id=randomUUID(),temporary=inMedia(id+'.upload');
    await mkdir(media(),{recursive:true,mode:0o700});
    const handle=await open(temporary,'wx',0o600),sha=createHash('sha256');let size=0,head=Buffer.alloc(0);
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;if(size>limit){req.resume();throw tooBig();}
        if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
        sha.update(chunk);let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
      }
      await handle.close();
      if(!size||!validRequestFile(kind,mimeType,head))throw fail('파일 내용이 형식과 달라요. 다른 파일을 골라 주세요.',415);
      if(!declared){count('bytes:'+digest(client),size,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',size,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
      const diskName=`${id}.${kind.extension}`;
      await rename(temporary,inMedia(diskName));
      return {id,purpose,diskName,fileName,mimeType:kind.inline?mimeType:'application/octet-stream',byteSize:size,sha256:sha.digest('hex'),inline:kind.inline,at:clock()};
    }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  }
  // 문의 사진(운영 조각 8-B · 설계 S1 「④ 문의에 사진 붙이기」): 손님이 담당자에게 묻는 글에 붙이는 JPG · PNG 한 장. 의뢰 자료(request.files)와 섞지 않고
  // 부른 쪽(pulse-studio addMessagePhoto)이 메시지 전용 자산(purpose message)으로 둔다. 문턱 · 디스크 검사 · 서명 확인은 자료 더 보내기와 같고, 크기는 15MB까지.
  async function receiveMessagePhoto(req,{session,client=''}){
    const before=session();
    if(before.row.stage==='archived')throw fail('보관된 프로젝트예요.',409);
    count('upload:'+digest(client),1,REQUEST_LIMITS.uploadsPerHourByClient,3600000);
    await assertDisk();
    const header=key=>{const value=req.headers[key];if(value==null)return '';try{return decodeURIComponent(value);}catch{throw fail('파일 이름을 확인해 주세요.');}};
    const fileName=text(header('x-file-name'),200),mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!fileName)throw fail('파일 정보를 확인해 주세요.');
    const photo=()=>fail('문의에는 사진(JPG · PNG)만 붙일 수 있어요.',415);
    if(!['image/png','image/jpeg'].includes(mimeType))throw photo();
    let kind;try{kind=requestFileKind(mimeType,fileName);}catch{throw photo();}
    if(!kind.inline)throw photo();
    const limit=REQUEST_LIMITS.messagePhotoBytes,tooBig=()=>fail('사진은 한 장에 15MB까지 붙일 수 있어요.',413);
    const declared=Number(req.headers['content-length']);if(declared>limit)throw tooBig();
    if(declared){count('bytes:'+digest(client),declared,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',declared,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
    const id=randomUUID(),temporary=inMedia(id+'.upload');
    await mkdir(media(),{recursive:true,mode:0o700});
    const handle=await open(temporary,'wx',0o600),sha=createHash('sha256');let size=0,head=Buffer.alloc(0);
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;if(size>limit){req.resume();throw tooBig();}
        if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
        sha.update(chunk);let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
      }
      await handle.close();
      if(!size||!validRequestFile(kind,mimeType,head))throw fail('파일 내용이 형식과 달라요. 다른 파일을 골라 주세요.',415);
      if(!declared){count('bytes:'+digest(client),size,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',size,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
      const diskName=`${id}.${kind.extension}`;
      await rename(temporary,inMedia(diskName));
      return {id,diskName,fileName,mimeType,byteSize:size,sha256:sha.digest('hex'),at:clock()};
    }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  }
  const discardProjectFile=async file=>{await unlink(inMedia(file.diskName)).catch(()=>{});};
  return {start,read,save,receive,removeFile,draftFilePath,submit,pruneDrafts,retireUnconfirmed,receiveProjectFile,receivePersonaFile,receiveMessagePhoto,discardProjectFile,limits:REQUEST_LIMITS};
}
export async function streamDraftFile(res,{paths,file},req){
  let path,info;
  for(path of paths){info=await stat(path).catch(()=>null);if(info)break;}
  if(!info)throw fail('파일을 찾지 못했어요.',404);
  res.writeHead(200,{'Content-Type':file.mimeType,'Content-Length':info.size,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"});
  if(req.method==='HEAD')return res.end();
  await pipeline(createReadStream(path),res);
}

// ── 프로젝트 안의 의뢰서 액션(pulse-studio의 mutate 확장 — 다른 액션과 같은 트랜잭션 · 판 검사를 탄다) ──
const FIELDS={
  request_note:['note'],request_ask:['items'],request_confirm:[],propose_model:['modelId','note','translation'],send_draft:['oneLine','note','translation','kind'],
  request_answer:['askId','text','fileId'],answer_model:['accept','modelId','note','outfit','hair'],request_save:['answers'],request_submit:['answers'],submit_draft_review:['round','items'],approve_draft:['round','terms'],
  propose_direction:['lead','options','modelId','price','dueDate','revisions','translation'],request_contact:['email','mailOff'],settle_direction:['optionId','note'],answer_direction:['optionId','modelId','note','neither','outfit','hair'],
  payment_request:['amount','overSeat'],payment_confirm:['ref','dueDate','amount','channel','net'],payment_cancel:['note'],due_change:['dueDate','reason','note'],
  // 작업 소식(운영 조각 4 · 설계 S1): 직원만 — 초안 쓰기 · 공개 · 거두기. 동작은 pulse-progress.mjs.
  ...PROGRESS_FIELDS,
};
export const requestActions=action=>Object.hasOwn(FIELDS,action)?FIELDS[action]:undefined;
const STAFF_ONLY=['request_note','request_ask','request_confirm','propose_model','send_draft','propose_direction','settle_direction','request_contact','payment_request','payment_confirm','payment_cancel','due_change','progress_save','progress_post','progress_withdraw'],CUSTOMER_ONLY=['request_answer','answer_model','request_save','request_submit','submit_draft_review','approve_draft','answer_direction'];
// 카탈로그 모델로 정할 때는 붙어 있던 전용 인물 참조를 뗀다(「카탈로그로 바꿀 때만 교체」 — 기획 12-2 「선택 값」).
// 옷 · 머리(2026-11-10): 값은 모델마다 다르다(머리 2는 그 모델의 헤어 2). 모델이 바뀌면 옛 모델의 값을 비우고, 손님이 이번에 보낸 값(look)만 쓴다.
// 방향 고르기 · 직원 정리 · 글 콘티의 「다른 모델로 바꾸기」가 모두 이 한 자리를 지난다(설계 검토 1).
const LOOK_KEYS=['outfit','hair'];
const catalogCasting=(selection,modelId,look={})=>{
  const {personaRef,...rest}=selection||{},out={...rest,modelId};
  if(rest.modelId!==modelId)for(const key of LOOK_KEYS)out[key]='';
  for(const key of LOOK_KEYS)if(look[key]!==undefined)out[key]=look[key];
  return out;
};
// 의뢰서 답(의뢰 기록)도 같은 규칙: 첫 모델이 바뀌면 옷 · 머리를 비우고, 보낸 값만 쓴다.
function answersWithModel(answers,modelId,look={}){
  const out={...answers,models:[modelId],modelChoice:''};
  if(answers?.models?.[0]!==modelId)for(const key of LOOK_KEYS)out[key]='';
  for(const key of LOOK_KEYS)if(look[key]!==undefined)out[key]=look[key];
  return out;
}
// 손님이 방향을 고를 때 보낸 옷 · 머리(answer_direction): 칸이 없으면(옛 화면) 건드리지 않고, ''는 맡김(비움), 값은 그 모델의 옷 · 머리만.
// 하나라도 틀리면 400 — 화면이 고른 값을 서버가 조용히 바꾸지 않는다.
function lookOf(input){
  const look={};
  for(const [key,list]of [['outfit',OUTFITS],['hair',HAIRS]]){
    if(!Object.hasOwn(input,key))continue;
    const value=input[key];if(typeof value!=='string'||value&&!list.includes(value))throw fail('옷 · 머리 고름을 확인해 주세요.');
    look[key]=value;
  }
  return look;
}
// 전용 인물로 가는 프로젝트는 방향 제안 · 제작 시작 때 그 인물 판을 다시 본다(personas: pulse-personas.mjs createPersonaGuard).
// 제작 시작(start)은 더 엄격하다: 새 전용 인물(custom) · 이미 있는 인물(persona)을 고르고 아직 인물이 붙지 않았으면(손님 사용 승인 전) 시작하지 않는다.
// 방향 · 글 콘티는 인물을 만드는 동안에도 먼저 맞출 수 있다(GPT 검수 GA1, 2026-11-09).
function assertCasting(casting,personas,row,{start=false}={}){
  if(casting.kind==='persona'&&casting.personaRef){
    if(typeof personas!=='function')throw fail('전용 인물 판이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    personas(casting.personaRef,row);
    return;
  }
  if(start&&['custom','persona'].includes(casting.kind))throw fail('전용 인물이 아직 준비되지 않았어요. 준비되면 담당자가 알려 드려요.',409);
}
// 결제(판 4, 결정 11-10 D2): 결제는 크몽에서 받고 담당자가 앱에 적는다 — 요청함(requested) → 확인함(confirmed) · 취소(cancelled).
// 장면 이미지 판 보내기 · 제작 시작 승인 · 의뢰 흐름 시안 올리기는 확인함만 통과한다. 사진 상품은 첫 장을 승인하기 전의 판은 결제 없이 오간다(첫 장이 방향 확인 몫).
const PACKAGE_DAYS={s15:10,s30:14,s60:21,photo:3};
// 받으실 날 고치기(운영 조각 6-A · 설계 S2): 결제를 확인한 뒤에는 받으실 날을 고칠 길이 없었는데, 메일은 「확인을 기다리는 날만큼 늦어져요」라고 말한다.
// 담당자가 날과 까닭(정해 둔 넷 — 손님에게는 손님 언어의 문장으로 보인다)을 골라 고치고, 메모(note)는 직원만 본다.
// 이력은 결제 이력에 due_changed 줄로 쌓인다(앞 날 from · 새 날 dueDate · 까닭 reason). 손님 일지 · 앱 알림 · 메일(due_changed 순간)이 이 줄에서 나온다.
export const DUE_REASONS=Object.freeze(['waiting','scope','agreed','ours']);
const DUE_CHANGE_LIMIT=20,DAY=/^\d{4}-\d{2}-\d{2}$/;
// 달력에 있는 날만 손님 보기에 내린다(꼴이 맞아도 「2026-13-40」은 뺀다 — 깨진 이력 문서).
const realDay=day=>typeof day==='string'&&DAY.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(Date.parse(day+'T00:00:00Z')).toISOString().slice(0,10)===day;
export const requestPaid=request=>request?.payment?.status==='confirmed';
// 결제 이력(2026-11-11 운영판 설계 S4): payment는 지금 상태 하나라, 취소한 뒤 다시 요청하면 앞 기록(취소 까닭 · 때)이 지워진다.
// 요청 · 확인 · 취소를 덮지 않고 paymentLog에 쌓는다 — 쓰는 자리는 logPayment 하나다(추가만, 고치거나 지우지 않는다).
// 이력 없이 결제가 적힌 옛 건은 그때의 payment에서 한 번 만들어 잇는다(seeded). 직원만 본다 — requestView가 손님 보기에서 뺀다.
const PAYMENT_LOG_LIMIT=100;
const paymentAmount=value=>Number.isSafeInteger(value)&&value>=10000&&value<=100000000;
function seedPaymentLog(payment){
  if(!payment||typeof payment!=='object')return [];
  const log=[],amount=paymentAmount(payment.amount)?{amount:payment.amount}:{};
  if(payment.requestedAt)log.push({kind:'requested',at:payment.requestedAt,by:payment.requestedBy||'',...amount,seeded:true});
  if(payment.confirmedAt)log.push({kind:'confirmed',at:payment.confirmedAt,by:payment.confirmedBy||'',...amount,...(payment.ref?{ref:payment.ref}:{}),...(payment.dueDate?{dueDate:payment.dueDate}:{}),seeded:true});
  if(payment.cancelledAt)log.push({kind:'cancelled',at:payment.cancelledAt,by:payment.cancelledBy||'',was:payment.confirmedAt?'confirmed':'requested',...amount,...(payment.note?{note:payment.note}:{}),seeded:true});
  return log;
}
export const paymentLogOf=request=>Array.isArray(request?.paymentLog)?request.paymentLog:seedPaymentLog(request?.payment);
// 손님 일지에 오르는 결제 줄의 종류(requestView paymentTrail). 환불처럼 뒤에 더할 종류는 화면이 그 문장을 가진 뒤에 여기 넣는다.
// due_changed(받으실 날 고침 · 운영 조각 6-A): 옛 화면은 모르는 종류를 거르므로 먼저 실어도 깨지지 않는다.
const PAYMENT_TRAIL_KINDS=['requested','confirmed','cancelled','due_changed'];
// opens: 새 결제를 여는 줄(요청, 또는 요청 없이 바로 하는 확인)만 상한에 걸린다. 이미 열린 결제를 닫는 줄(요청한 결제의 확인 · 취소 · 환불)은
// 가득 차도 적는다 — 막으면 환불한 결제가 「확인함」으로 남아 제작 문턱이 열린 채가 된다(GPT 검수 GA1). 그래서 길이는 상한을 둘까지 넘을 수 있다.
function logPayment(request,entry,{opens=false}={}){
  const log=paymentLogOf(request);
  if(opens&&log.length>=PAYMENT_LOG_LIMIT)throw fail('결제 기록이 가득 찼어요. 새 결제는 관리자에게 알려 주세요.',409);
  return [...log,entry];
}
const photoPackage=request=>request?.answers?.package==='photo';
const photoSheetApproved=request=>photoPackage(request)&&(request.rounds||[]).some(round=>round.kind==='images'&&round.approvedAt);
// locale: 이 프로젝트의 소통 언어(pulse-locale.mjs). 한국어가 아니면 손님에게 보일 직원 글은 번역을 함께 받아야 보낸다(pulse-translations.mjs).
// seat(운영 조각 6-B): 그 프로젝트의 지금 자리(pulse-capacity.mjs seatFor — 자리가 모자라면 {state:'queue', noticeDate}, 있으면 null). 방향 제안이 보내는 순간에 굳힌다.
export function applyRequestAction({studio,row,input,staff,stamp,personas,locale='ko',seat=null}){
  const action=input.action,now=stamp.at;
  if(STAFF_ONLY.includes(action)&&!staff)throw fail('담당자 화면에서만 할 수 있어요.',403);
  if(CUSTOMER_ONLY.includes(action)&&staff)throw fail('고객 화면에서만 할 수 있어요.',403);
  const request=studio.request||{schemaVersion:1,number:'',status:'writing',answers:emptyRequestAnswers(),files:[],asks:[],notes:[],rounds:[]};
  if(action==='request_save'||action==='request_submit'){
    if(request.status==='confirmed'||request.confirmedAt)throw fail('확인이 끝난 의뢰서예요. 바꿀 내용은 담당자에게 알려 주세요.',409);
    const strict=action==='request_submit',answers=normalizeRequestAnswers(input.answers,{strict}),{consent,rights,...kept}=answers;
    if(strict&&!(consent&&rights))throw fail('동의 칸을 확인해 주세요.');
    // 판 4(설계 4-5 · 5판 D8): 방 안 의뢰서는 내 모델 다시 쓰기를 시작하지 않는다(스위치와 상관없이) — 다시 쓰기 의뢰로 생긴 프로젝트가 이미 고른 persona만 그대로 두고 카탈로그 모델 · 헤어를 비운다.
    if(kept.modelChoice==='persona'){if(!(object(row?.workspaceRequest)&&request.answers?.modelChoice==='persona'))throw fail('내 모델 다시 쓰기는 「내 모델」에서 시작해 주세요.',409);kept.models=[];kept.hair='';}
    studio.request={...request,answers:kept,...(strict?{status:'submitted',number:request.number||requestNumber(now),submittedAt:request.submittedAt||now,consentAt:now}:{}),updatedAt:now};
    return;
  }
  if(!studio.request)throw fail('의뢰서가 아직 없어요.',409);
  // 작업 소식(운영 조각 4): 거둔 그림 중 지울 파일 이름을 돌려준다 — 파일은 커밋 뒤에 지운다(pulse-studio.mjs staffMutate → server.mjs).
  if(['progress_save','progress_post','progress_withdraw'].includes(action))return applyProgressAction({studio,row,input,stamp,locale});
  // 담당자가 확인 뒤에도 알림 메일 주소를 고치거나 메일을 끈다(판 2 메일). 그때의 의뢰서 주소(basedOn)를 적어 두어
  // 손님이 그 뒤 의뢰서 주소를 고치면 손님 주소가 이긴다. 직원 화면의 연락처 줄도 함께 고친다.
  if(action==='request_contact'){
    const answers=request.answers||{},prev=request.contact||{};
    if(input.email===undefined&&input.mailOff===undefined)throw fail('고칠 내용을 골라 주세요.');
    const answered=String(answers.email||'').trim(),stale=!!prev.email&&prev.basedOn!==undefined&&prev.basedOn!==answered;
    const typed=input.email===undefined?(stale?'':(prev.email||'')):text(input.email,254);
    if(typed&&!validPulseMailAddress(typed))throw fail('이메일 주소를 확인해 주세요.');
    // 의뢰서 주소를 그대로 저장하면(메일 끄기만 바꿀 때 등) 고친 주소로 치지 않는다.
    const email=typed&&typed.toLowerCase()!==answered.toLowerCase()?typed:'';
    if(input.mailOff!==undefined&&typeof input.mailOff!=='boolean')throw fail('메일 끄기를 다시 골라 주세요.');
    const contact={email,mailOff:input.mailOff===undefined?prev.mailOff===true:input.mailOff,basedOn:answered,at:now,by:stamp.authorName};
    studio.request={...request,contact};
    row.contact=[answers.contactName,email||answers.email,answers.phone].filter(Boolean).join(' · ').slice(0,300);
    return;
  }
  if(action==='request_note'){
    if(!object(input.note)||Object.keys(input.note).some(key=>!['summary','lines','model','ref','risks','by'].includes(key)))throw fail('메모 항목을 확인해 주세요.');
    const note={id:randomUUID(),at:now,by:text(input.note.by,40)||stamp.authorName,summary:text(input.note.summary,1000),lines:many(input.note.lines,null,5,200),model:text(input.note.model,300),ref:text(input.note.ref,500),risks:many(input.note.risks,null,8,300)};
    studio.request={...request,notes:[...request.notes,note].slice(-20)};
    return;
  }
  if(action==='request_ask'){
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>8)throw fail('물어볼 것을 확인해 주세요.');
    const pairs=[],items=input.items.map(item=>{if(!object(item))throw fail('물어볼 것을 확인해 주세요.');const label=text(item.label,120);if(!label)throw fail('물어볼 것을 적어 주세요.');const made={id:randomUUID(),label,why:text(item.why,300),status:'open',at:now},said=inlineObject(item.translation,['label','why']);pairs.push({key:`ask:${made.id}:label`,source:made.label,max:120,text:said.label},{key:`ask:${made.id}:why`,source:made.why,max:300,text:said.why});return made;});
    applyInlineTranslations(studio,pairs,{locale,stamp});
    // 확인을 마친 뒤에 더 물어도 「확인 끝」은 지우지 않는다(고객 방은 열린 물음을 먼저 보인다).
    studio.request={...request,status:request.confirmedAt?request.status:'asking',asks:[...request.asks,...items].slice(-40)};
    return;
  }
  if(action==='request_answer'){
    const ask=request.asks.find(item=>item.id===input.askId);if(!ask||ask.status!=='open')throw fail('이 질문이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    const value=text(input.text,1000),fileId=input.fileId?text(input.fileId,40):'';
    const file=fileId?(request.files||[]).find(item=>item.id===fileId):null;if(fileId&&!file)throw fail('올린 파일을 찾지 못했어요.',404);
    if(!value&&!fileId)throw fail('답이나 파일을 보내 주세요.');
    const asks=request.asks.map(item=>item.id===ask.id?{...item,status:'answered',answer:value,fileId,fileName:file?.fileName||'',answeredAt:now}:item);
    studio.request={...request,asks,status:request.confirmedAt?request.status:asks.some(item=>item.status==='open')?'asking':'submitted'};
    return;
  }
  if(action==='request_confirm'){
    if(request.status==='confirmed')throw fail('이미 확인했어요.',409);
    studio.request={...request,status:'confirmed',confirmedAt:now,confirmedBy:stamp.authorName};
    studio.strategy=carryToStrategy(studio.strategy,studio.request.answers,stamp);
    return;
  }
  // 영상 전 세 번 확인의 첫 번째: 모델을 손님이 고르지 않았으면 먼저 제안해 확인받는다(장면을 굽고 나서 모델이 바뀌지 않게).
  if(action==='propose_model'){
    const modelId=one(input.modelId,MODEL_IDS);if(!modelId)throw fail('제안할 모델을 골라 주세요.');
    const note=text(input.note,300);
    applyInlineTranslations(studio,[{key:'model:note',source:note,max:300,text:inlineObject(input.translation,['note']).note}],{locale,stamp});
    studio.request={...request,modelProposal:{modelId,note,at:now,by:stamp.authorName,status:'open'}};
    return;
  }
  if(action==='answer_model'){
    const proposal=request.modelProposal;
    const picked=input.modelId?one(input.modelId,MODEL_IDS):'';
    // 옷 · 머리(2026-11-12 사진 상품 — 방향 제안이 없어 모델 제안 카드에서 고른다): 받는 규칙은 방향 고르기와 같다(lookOf — 칸이 없으면 건드리지 않고, ''는 맡김,
    // 틀린 값은 400). 값은 모델이 정해질 때만 쓰고(말로만 답하면 버린다), 모델이 바뀌면 옛 모델의 값은 비운다(answersWithModel · catalogCasting).
    const look=lookOf(input);
    if(input.accept!==true&&!picked&&!text(input.note,300))throw fail('진행할 모델을 고르거나 바라는 점을 적어 주세요.');
    const modelId=picked||(input.accept===true?proposal?.modelId:'');
    // look은 그때 정한 값의 기록(일지 · 담당자 칸이 읽는다 — 방향 제안의 proposal.look과 같은 뜻). 모델을 정하지 않은 답에는 남기지 않는다.
    const answers=modelId?answersWithModel(request.answers,modelId,look):request.answers,{look:_old,...rest}=proposal||{};
    studio.request={...request,answers,modelProposal:{...rest,status:modelId?'accepted':'declined',answer:text(input.note,300),answeredAt:now,...(modelId?{modelId,look:{outfit:answers.outfit||'',hair:answers.hair||''}}:{})}};
    // 확인 끝 뒤에 정해진 모델은 제작 설계에도 옮긴다(확인 때 옮긴 값을 고객이 바꿀 수 있다). 전용 인물이 붙어 있었으면 그 참조도 뗀다.
    if(modelId&&(request.confirmedAt||personaRefOf(studio.strategy?.data?.castingSelection?.personaRef)))studio.strategy=strategyWith(studio.strategy,{...studio.strategy.data,castingSelection:catalogCasting(studio.strategy.data?.castingSelection,modelId,look)},stamp);
    return;
  }
  // 영상 전 세 번 확인의 첫 번째(11-07 판): 방향 두세 안과 모델을 함께 내밀고 손님이 고른다. 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판1_설계.md 1b.
  if(action==='propose_direction'){
    if(request.status!=='confirmed')throw fail('의뢰서 확인을 먼저 끝내 주세요.',409);
    if(request.rounds.length)throw fail('글 콘티를 보낸 뒤에는 방향을 다시 제안할 수 없어요.',409);
    if(request.answers?.package==='photo')throw fail('사진 상품은 첫 장으로 방향을 맞춰요.',409);
    const prev=request.directionProposal;
    if(prev&&['chosen','settled'].includes(prev.status))throw fail('고객이 이미 방향을 정했어요.',409);
    if(prev?.status==='declined'&&prev.round>=2)throw fail('다시 제안은 한 번이에요. 고객과 직접 이야기해 정한 안으로 정리해 주세요.',409);
    const modelId=one(input.modelId||'',MODEL_IDS),casting=castingOf(request,studio.strategy?.data?.castingSelection);
    // 사람 없이 · 전용 인물로 가는 의뢰는 카탈로그 모델 없이 보낸다. 전용 인물이 붙어 있으면 그 판을 다시 본다.
    if(!modelId&&!MODEL_OPTIONAL_CHOICES.includes(request.answers?.modelChoice)&&casting.kind!=='persona')throw fail('함께 보낼 모델을 골라 주세요.');
    if(!modelId)assertCasting(casting,personas,row);
    const price=input.price,revisions=input.revisions;
    if(!Number.isSafeInteger(price)||price<10000||price>100000000)throw fail('값은 원 단위로 1만 원에서 1억 원 사이로 적어 주세요.');
    if(!Number.isSafeInteger(revisions)||revisions<0||revisions>9)throw fail('수정 횟수를 확인해 주세요.');
    // 받으실 날: 제작 자리가 모자란 때(대기) 보낸 제안은 날짜 없이도 받는다 — 결제 안내가 미뤄지면 적은 날이 거짓이 되므로 「결제한 날부터 N일」로 보이게
    // 제안에 seat:'queue'를 굳혀 둔다(볼 때마다 따지면 다른 손님의 결제에 따라 약속 날짜가 생겼다 사라진다 — 설계 S2 「언제쯤」). 자리가 있으면 전처럼 날짜가 꼭 든다.
    // 기간이 정해진 구성(PACKAGE_DAYS)만 — 기업 · 추천 구성은 「결제한 날부터 N일」로 보일 기간이 없어 대기여도 날이 꼭 든다(6-B 화면 Fable F1).
    const waiting=typeof seat==='function'&&Object.hasOwn(PACKAGE_DAYS,request.answers?.package??'')?seat(row):null,undated=!!waiting&&(input.dueDate===undefined||input.dueDate===null||input.dueDate==='');
    const dueDate=undated?'':kstDay(input.dueDate,now);
    const declined=prev?.status==='declined';
    const proposal={round:declined?prev.round+1:prev?.round||1,status:'open',at:now,by:stamp.authorName,lead:text(input.lead,200),options:directionOptions(input.options,studio),...(modelId?{modelId}:{}),price,dueDate,...(undated?{seat:'queue'}:{}),revisions,...(declined?{prior:{round:prev.round,names:prev.options.map(option=>option.name),ids:prev.options.map(option=>option.id),answer:prev.answer||'',...(prev.at?{at:prev.at}:{}),...(prev.by?{by:prev.by}:{}),...(prev.answeredAt?{answeredAt:prev.answeredAt}:{})}}:prev?.prior?{prior:prev.prior}:{})};
    // 영어 프로젝트: 리드 · 안마다 이름 · 한 문장 · 흐름 · 이유 · 움직임 견본 메모의 영어를 같은 순서로 함께 받는다(input.translation.options[i]).
    const said=inlineObject(input.translation,['lead','options']),saidOptions=Array.isArray(said.options)?said.options:[];
    if(said.options!==undefined&&(!Array.isArray(said.options)||said.options.length>proposal.options.length))throw fail('번역 칸을 확인해 주세요.');
    applyInlineTranslations(studio,[{key:`direction:${proposal.round}:lead`,source:proposal.lead,max:200,text:said.lead},...proposal.options.flatMap((option,index)=>{const o=inlineObject(saidOptions[index],['name','sentence','why','filmNote','flow']),flow=o.flow===undefined?[]:Array.isArray(o.flow)&&o.flow.length<=option.flow.length?o.flow:(()=>{throw fail('번역 칸을 확인해 주세요.');})();return [{key:`option:${option.id}:name`,source:option.name,max:40,text:o.name},{key:`option:${option.id}:sentence`,source:option.sentence,max:160,text:o.sentence},{key:`option:${option.id}:why`,source:option.why,max:300,text:o.why},{key:`option:${option.id}:filmNote`,source:option.filmNote,max:80,text:o.filmNote},...option.flow.map((line,i)=>({key:`option:${option.id}:flow:${i}`,source:line.text,max:200,text:flow[i]}))];})],{locale,stamp});
    // 둘 다 열려 직원 화면이 「답을 기다려요」를 계속 띄우지 않게 열린 모델 제안은 닫는다.
    const model=request.modelProposal?.status==='open'?{...request.modelProposal,status:'replaced',answeredAt:now}:request.modelProposal;
    studio.request={...request,directionProposal:proposal,...(model?{modelProposal:model}:{})};
    return;
  }
  if(action==='answer_direction'){
    const proposal=request.directionProposal;
    if(!proposal||!['open','chosen'].includes(proposal.status))throw fail('방향 제안이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    if(request.rounds.length)throw fail('글 콘티가 이미 도착했어요. 바꿀 점은 글 콘티에서 알려 주세요.',409);
    if(input.neither===true){
      const note=text(input.note,300);if(!note)throw fail('어떤 점이 아쉬웠는지 한 줄 적어 주세요.');
      const {chosenId,...rest}=proposal;
      studio.request={...request,directionProposal:{...rest,status:'declined',answer:note,answeredAt:now}};
      return;
    }
    const option=proposal.options.find(item=>item.id===input.optionId);if(!option)throw fail('방향 제안이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    const modelId=input.modelId?one(input.modelId,MODEL_IDS):proposal.modelId||'',look=lookOf(input);
    // 옷 · 머리는 카탈로그 모델이 있을 때만 쓴다(사람 없이 · 전용 인물로 가는 방향은 받지 않고 버린다).
    chooseDirection(studio,request,proposal,{option,modelId,note:text(input.note,200),status:'chosen',now,stamp,look:modelId?look:{}});
    return;
  }
  // 회차 2도 거절되면 더 제안하지 않고, 담당자가 손님과 이야기해 정한 안을 적어 앞으로 간다(설계 검토 1).
  if(action==='settle_direction'){
    const proposal=request.directionProposal;
    if(!proposal||proposal.status!=='declined'||proposal.round<2)throw fail('두 번째 제안도 거절된 뒤에만 정리할 수 있어요.',409);
    if(request.rounds.length)throw fail('글 콘티를 보낸 뒤에는 방향을 바꿀 수 없어요.',409);
    const option=proposal.options.find(item=>item.id===input.optionId);if(!option)throw fail('정한 안을 골라 주세요.');
    const note=text(input.note,300);if(!note)throw fail('고객과 정한 내용을 한 줄 적어 주세요.');
    chooseDirection(studio,request,proposal,{option,modelId:proposal.modelId||'',note,status:'settled',now,stamp,extra:{settledBy:stamp.authorName}});
    return;
  }
  if(action==='payment_request'){
    if(request.status!=='confirmed')throw fail('의뢰서 확인을 먼저 끝내 주세요.',409);
    if(requestPaid(request))throw fail('결제를 이미 확인했어요.',409);
    const amount=input.amount;
    if(!paymentAmount(amount))throw fail('값은 원 단위로 1만 원에서 1억 원 사이로 적어 주세요.');
    // 제작 자리 차례를 기다리는 건(운영 조각 6-B): 설계 S2대로 막지는 않지만(담당자 판단) 자리 경고를 띄운 결제 요청 창이 보낸 확인(overSeat)이 있어야 받는다 —
    // 경고를 모르는 옛 화면 · 다른 길로 대기 손님에게 결제 안내가 먼저 나가지 않게(서버 검수 GA1).
    if(input.overSeat!==undefined&&input.overSeat!==true)throw fail('자리 확인 값을 확인해 주세요.');
    if(typeof seat==='function'&&seat(row)&&input.overSeat!==true)throw fail('이 건은 아직 제작 자리 차례가 아니에요. 결제 요청 창을 닫고 다시 열면 자리 경고가 떠요 — 그걸 보고 보내 주세요.',409,'SYNK_PULSE_SEAT_WAIT');
    studio.request={...request,payment:{status:'requested',requestedAt:now,requestedBy:stamp.authorName,amount},paymentLog:logPayment(request,{kind:'requested',at:now,by:stamp.authorName,amount},{opens:true})};
    return;
  }
  if(action==='payment_confirm'){
    if(request.status!=='confirmed')throw fail('의뢰서 확인을 먼저 끝내 주세요.',409);
    if(requestPaid(request))throw fail('결제를 이미 확인했어요.',409);
    if(input.ref!==undefined&&typeof input.ref!=='string')throw fail('크몽 주문 번호를 확인해 주세요.');
    const ref=text(input.ref||'',40);
    // 받으실 날: 크몽 작업일이 결제부터 세므로 오늘(KST) + 패키지 일수가 기본이고 담당자가 고칠 수 있다. 일수가 없는 패키지(기업 · 상담)는 방향 제안의 날을 쓴다.
    const days=PACKAGE_DAYS[request.answers?.package],today=new Date(Date.parse(now)+9*3600000);
    const fallback=days?new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+days)).toISOString().slice(0,10):request.directionProposal?.dueDate||'';
    const dueDate=input.dueDate===undefined||input.dueDate===''?fallback:kstDay(input.dueDate,now);
    // 금액: 담당자가 적으면 그 값(실제 결제액), 아니면 요청한 값. 둘 다 없으면 금액 없이 확인한다(이 칸을 모르는 옛 직원 화면 — 운영판은 「금액 없음」으로 따로 센다).
    // channel: 받은 곳(크몽 · 직접), net: 수수료를 뺀 실수령(선택). 둘 다 직원만 본다.
    if(input.amount!==undefined&&!paymentAmount(input.amount))throw fail('값은 원 단위로 1만 원에서 1억 원 사이로 적어 주세요.');
    const amount=input.amount??(request.payment?.status==='requested'?request.payment.amount:undefined);
    if(input.channel!==undefined&&!['kmong','direct'].includes(input.channel))throw fail('결제를 받은 곳을 골라 주세요.');
    const channel=input.channel||'kmong',net=input.net;
    if(net!==undefined&&(!amount||!Number.isSafeInteger(net)||net<0||net>amount))throw fail('실수령 금액은 결제 금액 안에서 원 단위로 적어 주세요.');
    const paid={...(amount?{amount}:{}),...(ref?{ref}:{}),...(dueDate?{dueDate}:{}),channel,...(net!==undefined?{net}:{})};
    studio.request={...request,payment:{status:'confirmed',...(request.payment?.status==='requested'?{requestedAt:request.payment.requestedAt,requestedBy:request.payment.requestedBy}:{}),confirmedAt:now,confirmedBy:stamp.authorName,...paid},paymentLog:logPayment(request,{kind:'confirmed',at:now,by:stamp.authorName,...paid},{opens:request.payment?.status!=='requested'})};
    // 사진 상품이 첫 장을 이미 승인했으면 결제를 확인하는 이때 제작을 시작한다.
    const sheet=photoPackage(request)&&!request.approvedRound?[...(request.rounds||[])].reverse().find(round=>round.kind==='images'&&round.approvedAt):null;
    if(sheet){
      assertCasting(castingOf(request,studio.strategy?.data?.castingSelection),personas,row,{start:true});
      studio.request={...studio.request,approvedRound:sheet.round,approvedAt:now};
      if(['received','planning'].includes(row.stage)){row.stage='producing';row.closeoutWorkRevision=(row.closeoutWorkRevision||0)+1;}
    }
    return;
  }
  // 받으실 날 고치기(운영 조각 6-A): 확인한 결제의 받으실 날만. 납품 · 보관한 뒤나 취소(환불)한 결제는 고치지 않는다.
  // 같은 날로는 고치지 않고(손님에게 뜻 없는 알림 · 메일), 한 결제 이력 안에서 스무 번까지(결제 이력 상한이 이 줄로 차지 않게).
  if(action==='due_change'){
    if(!requestPaid(request))throw fail('결제를 확인한 뒤에 받으실 날을 고칠 수 있어요.',409);
    if(['delivered','archived'].includes(row.stage))throw fail('납품을 마친 프로젝트는 받으실 날을 고치지 않아요.',409);
    if(!DUE_REASONS.includes(input.reason))throw fail('받으실 날을 고친 까닭을 골라 주세요.');
    const dueDate=kstDay(input.dueDate,now),from=realDay(request.payment.dueDate)?request.payment.dueDate:'',note=text(input.note,300);
    if(dueDate===from)throw fail('지금 받으실 날과 같아요. 바꿀 날을 골라 주세요.');
    if(paymentLogOf(request).filter(entry=>entry?.kind==='due_changed').length>=DUE_CHANGE_LIMIT)throw fail('받으실 날은 스무 번까지 고칠 수 있어요. 더 고쳐야 하면 관리자에게 알려 주세요.',409);
    studio.request={...request,payment:{...request.payment,dueDate,dueChangedAt:now},paymentLog:logPayment(request,{kind:'due_changed',at:now,by:stamp.authorName,...(from?{from}:{}),dueDate,reason:input.reason,...(note?{note}:{})})};
    return;
  }
  // 결제 뒤 전액 환불(D3) · 크몽 자동 취소(24시간 무응답)를 적는다. 취소 뒤에는 결제를 다시 요청할 수 있다.
  if(action==='payment_cancel'){
    if(!request.payment||request.payment.status==='cancelled')throw fail('취소할 결제가 없어요.',409);
    const note=text(input.note,300);if(!note)throw fail('취소한 까닭을 한 줄 적어 주세요.');
    // was: 무엇을 취소했나 — 확인한 결제(confirmed)면 환불이고, 요청만 한 결제(requested)면 받은 돈이 없다. 운영판이 이 값으로 환불을 센다.
    const was=request.payment.status,cancelled={kind:'cancelled',at:now,by:stamp.authorName,was,...(paymentAmount(request.payment.amount)?{amount:request.payment.amount}:{}),note};
    studio.request={...request,payment:{...request.payment,status:'cancelled',cancelledAt:now,cancelledBy:stamp.authorName,note},paymentLog:logPayment(request,cancelled)};
    return;
  }
  if(action==='send_draft'){
    if(request.status!=='confirmed')throw fail('의뢰서 확인을 먼저 끝내 주세요.',409);
    const answers=request.answers||{},direction=request.directionProposal;
    if(direction&&!['chosen','settled'].includes(direction.status))throw fail('방향을 먼저 정해 주세요.',409);
    // 모델이 정해졌는지: 고른 방향, 또는 손님이 고르거나 받아들인 모델 · 사람 없이 · 승인한 전용 인물(castingOf).
    const modelReady=direction||castingOf(request,studio.strategy?.data?.castingSelection).agreed;
    if(!modelReady)throw fail('모델을 먼저 제안해 확인받아 주세요.',409);
    const scenes=studio.scenes.filter(scene=>scene.visibility==='customer');
    if(!scenes.length)throw fail('고객에게 보이는 장면을 먼저 준비해 주세요.',409);
    const oneLine=text(input.oneLine,300)||studio.strategy?.data?.primaryPromise||'';if(!oneLine)throw fail('이 광고가 남길 한 문장을 적어 주세요.');
    // 그림이 빠진 컷이 있으면 글 콘티 판이고, 모든 컷에 장면 이미지가 있어야 제작을 시작할 수 있는 판이다.
    // 담당자는 그림이 다 붙어 있어도 글 콘티 판으로 보낼 수 있다(kind:'script'). 장면 이미지 판은 결제를 확인한 뒤에만 보낸다(사진은 첫 장 승인 전 판은 예외).
    if(input.kind!==undefined&&input.kind!=='script')throw fail('보낼 판을 확인해 주세요.');
    const kind=input.kind==='script'?'script':scenes.every(scene=>scene.assetId||scene.imageUrl)?'images':'script';
    if(kind==='images'&&!requestPaid(request)&&!(photoPackage(request)&&!photoSheetApproved(request)))throw fail('결제가 확인된 뒤에 장면 이미지를 보낼 수 있어요.',409);
    const round={round:request.rounds.length+1,kind,oneLine,note:text(input.note,600),sentAt:now,by:stamp.authorName,scenes:scenes.map(scene=>({id:scene.id,revision:scene.revision}))};
    // 영어 프로젝트: 한 문장 · 메모의 영어를 함께 받고, 보낼 장면의 제목 · 설명에도 reviewed 번역이 있어야 한다(광고 문구인 내레이션 · 화면 글은 출력 언어 그대로).
    const said=inlineObject(input.translation,['oneLine','note']);
    applyInlineTranslations(studio,[{key:`round:${round.round}:oneLine`,source:round.oneLine,max:300,text:said.oneLine},{key:`round:${round.round}:note`,source:round.note,max:600,text:said.note}],{locale,stamp});
    if(missingTranslations(studio,row,locale,scenes.flatMap(scene=>[`scene:${scene.id}:title`,`scene:${scene.id}:description`])).length)throw fail('보낼 장면의 제목 · 설명에 손님 언어 번역이 빠졌어요. 장면마다 번역을 넣은 뒤 보내 주세요.',409);
    studio.request={...request,rounds:[...request.rounds,round]};
    return;
  }
  const round=request.rounds.at(-1);
  if(!round||input.round!==round.round)throw fail('새 판이 도착했어요. 최신 내용을 불러와 주세요.',409);
  if(action==='submit_draft_review'){
    if(round.approvedAt)throw fail('이미 확인한 판이에요.',409);
    if(round.feedbackAt)throw fail('이 판의 의견은 이미 보내셨어요. 반영한 판을 곧 보내 드려요.',409);
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>60)throw fail('의견을 확인해 주세요.');
    if(studio.sceneReviews.length+input.items.length>240)throw fail('이 프로젝트의 기록이 가득 찼어요. 담당자에게 알려 주세요.',409);
    const items=input.items.map(item=>{if(!object(item)||!['confirmed','changes'].includes(item.status))throw fail('의견을 확인해 주세요.');const ref=round.scenes.find(value=>value.id===item.sceneId);if(!ref)throw fail('이 판에 없는 컷이에요.',404);const note=text(item.text,1000);if(item.status==='changes'&&!note)throw fail('고칠 내용을 적어 주세요.');return {ref,status:item.status,text:note};});
    for(const item of items){
      const scene=studio.scenes.find(value=>value.id===item.ref.id),review={id:randomUUID(),sceneId:item.ref.id,sceneRevision:item.ref.revision,title:scene?.title||'',status:item.status,text:item.text,...stamp,author:'customer',round:round.round};
      studio.sceneReviews.push(review);
      row.sceneRequestWorkflows=recordSceneReview({...row,studio},review,{at:now})||row.sceneRequestWorkflows;
    }
    studio.request={...request,rounds:request.rounds.map(value=>value.round===round.round?{...value,feedbackAt:now,changes:items.filter(item=>item.status==='changes').length}:value)};
    return;
  }
  if(action==='approve_draft'){
    if(round.approvedAt)throw fail('이미 확인한 판이에요.',409);
    if(round.feedbackAt&&round.changes)throw fail('보내 주신 의견을 반영한 판을 곧 보내 드려요. 그 판에서 확인해 주세요.',409);
    if(round.kind==='script'){studio.request={...request,rounds:request.rounds.map(value=>value.round===round.round?{...value,approvedAt:now,approvedBy:stamp.authorName}:value),scriptApprovedAt:now};return;}
    // 제작이 시작되는 승인: 맞춤 제작이라 시작 뒤에는 환불 대신 수정 횟수로 고친다는 안내에 손님이 동의해야 한다(크몽 판매 이용약관 12조 — 사전 고지와 서면 동의).
    if(input.terms!==true)throw fail('제작을 시작하기 전에 취소 · 환불 안내를 확인해 주세요.');
    const rounds=request.rounds.map(value=>value.round===round.round?{...value,approvedAt:now,approvedBy:stamp.authorName,termsAcceptedAt:now}:value);
    // 사진 상품의 첫 장은 결제 전에도 승인을 받아 두고, 제작은 결제를 확인할 때 시작한다.
    if(photoPackage(request)&&!requestPaid(request)){studio.request={...request,rounds};return;}
    if(!requestPaid(request))throw fail('결제가 확인된 뒤에 제작을 시작할 수 있어요. 담당자가 결제를 확인하면 알려 드려요.',409);
    // 제작을 시작하기 전에 전용 인물 판을 다시 본다(그사이 사용 중지 · 만료됐으면 409, 아직 붙지 않았으면 409).
    assertCasting(castingOf(request,studio.strategy?.data?.castingSelection),personas,row,{start:true});
    studio.request={...request,rounds,approvedRound:round.round,approvedAt:now};
    if(['received','planning'].includes(row.stage)){row.stage='producing';row.closeoutWorkRevision=(row.closeoutWorkRevision||0)+1;}
    return;
  }
  throw fail('의뢰서 요청을 확인해 주세요.');
}
// 방향 안: 두세 안, 추천은 하나까지, 그림은 이 프로젝트의 이미지 자산, 견본은 영상 자산. 안 id는 보낼 때마다 새로 만든다(밀린 화면이 옛 id로 다른 안을 고르지 못하게).
function directionOptions(list,studio){
  if(!Array.isArray(list)||list.length<2||list.length>3)throw fail('방향은 두 안이나 세 안으로 보내 주세요.');
  const asset=(id,kind)=>{const found=typeof id==='string'?studio.assets.find(item=>item.id===id):null;return found?.mimeType?.startsWith(kind+'/')?found:null;};
  const options=list.map(item=>{
    if(!object(item))throw fail('방향 안을 확인해 주세요.');
    const name=text(item.name,40),sentence=text(item.sentence,160);if(!name||!sentence)throw fail('안마다 이름과 한 문장을 적어 주세요.');
    if(!Array.isArray(item.flow)||!item.flow.length||item.flow.length>4)throw fail('흐름은 안마다 한 줄에서 네 줄까지 적어 주세요.');
    const flow=item.flow.map(line=>{const at=object(line)?text(line.at,8):'',body=object(line)?text(line.text,200):'';if(!/^\d{1,2}:\d{2}$/.test(at)||!body)throw fail('흐름 줄은 「0:00 내용」 꼴로 적어 주세요.');return {at,text:body};});
    const image=asset(item.assetId,'image');if(!image)throw fail('안마다 이 프로젝트에 올린 그림을 골라 주세요.');
    const film=item.filmAssetId?asset(item.filmAssetId,'video'):null;if(item.filmAssetId&&!film)throw fail('움직임 견본은 이 프로젝트에 올린 영상이어야 해요.');
    const workId=item.workId?text(item.workId,40):'';if(workId&&!/^[a-z0-9-]+$/.test(workId))throw fail('작품 이름을 확인해 주세요.');
    return {id:randomUUID(),name,sentence,flow,why:text(item.why,300),assetId:image.id,...(film?{filmAssetId:film.id,filmNote:text(item.filmNote,80)}:{}),...(workId?{workId}:{}),recommended:item.recommended===true};
  });
  if(options.filter(item=>item.recommended).length>1)throw fail('추천은 한 안에만 표시해 주세요.');
  if(new Set(options.map(item=>item.name)).size!==options.length)throw fail('안 이름이 겹쳐요.');
  return options;
}
// 받으실 날은 KST 날짜로만 견준다(서버 시계는 UTC). 오늘부터 120일 안.
function kstDay(value,now){
  const day=typeof value==='string'?value:'',at=Date.parse(day+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(at)||new Date(at).toISOString().slice(0,10)!==day)throw fail('받으실 날을 확인해 주세요.');
  const today=new Date(Date.parse(now)+9*3600000).toISOString().slice(0,10),days=(at-Date.parse(today+'T00:00:00Z'))/86400000;
  if(days<0||days>120)throw fail('받으실 날은 오늘부터 120일 안으로 정해 주세요.');
  return day;
}
// 고르거나(손님) 정리하면(직원) 모델을 의뢰서 답과 제작 설계에 옮긴다. 모델 없는 의뢰(사람 없이 제품만)는 그대로 둔다.
// 옷 · 머리(look — 손님만 보낸다, 직원 정리는 값을 더하지 않는다): 정본은 제작 설계(castingSelection), 답은 의뢰 기록,
// proposal.look은 그때 고른 값의 기록(고른 카드 · 일지가 읽는다 — 다시 고르면 덮어쓴다). 글 콘티 전에는 손님이 고른 값이 직원이 고친 값을 덮는다.
function chooseDirection(studio,request,proposal,{option,modelId,note,status,now,stamp,extra={},look={}}){
  const answers=modelId?answersWithModel(request.answers,modelId,look):request.answers,{look:_old,...rest}=proposal;
  studio.request={...request,answers,directionProposal:{...rest,status,chosenId:option.id,...(modelId?{modelId,look:{outfit:answers.outfit||'',hair:answers.hair||''}}:{}),answer:note,answeredAt:now,...extra}};
  // 카탈로그 모델을 고르면 전용 인물 참조를 뗀다. 모델 없이 고른 방향(사람 없이 · 전용 인물)은 붙은 인물을 그대로 둔다.
  // 제안은 의뢰 확인 뒤에만 생기므로 이 조건은 사실상 늘 참이다(전용 인물 조건은 판 3 그대로).
  if(modelId&&(request.confirmedAt||personaRefOf(studio.strategy?.data?.castingSelection?.personaRef)))studio.strategy=strategyWith(studio.strategy,{...studio.strategy.data,castingSelection:catalogCasting(studio.strategy.data?.castingSelection,modelId,look)},stamp);
}
// 확인이 끝나면 답을 제작 설계 칸으로 옮겨 담는다(직원 도구가 그대로 쓰게). 이미 저장한 칸은 덮지 않는다.
// 제작 설계에 칸이 없는 것(무엇으로 이길지 · 참고 광고 · 드라이브 · 쓰는 법 등)은 메모 칸에 줄로 남겨 옮겨 적는 일이 없게 한다.
const CHANNEL_MAP={shorts:['instagram','tiktok','youtube'],youtube:['youtube','website'],store:['website'],screen:['offline']};
const PACKAGE_SECONDS={s15:15,s30:30,s60:60,corp:30};
const OBJECTIVE={buy:'sales',install:'sales',visit:'sales',ask:'sales',remember:'brand'};
const WIN_LABEL={story:'이야기로 여운을',impact:'한 장면의 임팩트로',laugh:'웃음으로 퍼지게',ask:'맡김'};
const BOLD_LABEL={safe:'정석대로',twist:'조금 다르게',wild:'확 다르게'},VOICE_LABEL={narration:'내레이션',model:'모델이 직접 말함',none:'말 없이 음악과 자막'};
// 메모의 한 줄은 「항목: 값」 하나다. 손님이 쓴 글에 줄바꿈이 있으면 그 뒤가 서버가 만든 다른 줄처럼 보이므로(11-13 백엔드 검수 GA1) 줄을 나누는 공백을 빈칸 하나로 잇는다.
const oneLine=value=>String(value).replace(/\s*[^\S \t]+\s*/g,' ');
// 꼭 붙일 표시: 「해당 없어요」는 줄을 만들지 않고, 「잘 모르겠어요」는 담당자가 확인할 일로 적는다. 고지 문구는 표시 업종을 골랐을 때만 붙인다.
const noticeLine=a=>!a.notice||a.notice==='none'?'':a.notice==='unsure'?'꼭 붙일 표시: 손님이 잘 모름 — 확인 필요':`꼭 붙일 표시: ${[NOTICE_LABEL[a.notice],a.noticeText].filter(Boolean).join(' · ')}`;
export function carryToStrategy(strategy,a,stamp){
  const data={...strategy.data},put=(key,value)=>{if(value&&(data[key]===undefined||data[key]===''||data[key]===null||Array.isArray(data[key])&&!data[key].length))data[key]=value;};
  put('product',a.name);put('audience',a.audience);put('primaryPromise',a.oneThing);put('evidence1',a.facts);
  put('desiredAction',{buy:'제품 페이지에서 사기',install:'앱 설치하기',visit:'찾아오기',ask:'문의하기',remember:'브랜드를 기억하기'}[a.action]||'');
  put('objective',OBJECTIVE[a.action]||'');put('channels',[...new Set((a.channels||[]).flatMap(id=>CHANNEL_MAP[id]||[]))]);
  put('aspectRatio',a.channels?.length>1?'multiple':{shorts:'9:16',youtube:'16:9',store:'1:1',screen:'16:9'}[a.channels?.[0]]||'');
  put('durationSeconds',PACKAGE_SECONDS[a.package]||null);put('distribution',a.paid?'paid':'');
  put('screenCopy',a.screenText);put('destinationUrl',/^https:\/\//.test(a.pageUrl||'')?a.pageUrl:'');put('proposedDeadline',a.date);
  const refs=(a.refs||[]).map(ref=>[ref.url,(ref.points||[]).join(', '),ref.why].filter(Boolean).join(' — ')).filter(Boolean);
  const lines=[a.win&&`무엇으로 이길지: ${WIN_LABEL[a.win]}`,a.bold&&`얼마나 과감하게: ${BOLD_LABEL[a.bold]}`,a.voice&&`목소리: ${VOICE_LABEL[a.voice]}`,noticeLine(a),refs.length&&`참고 광고: ${refs.join(' / ')}`,a.avoidFeel&&`피할 느낌: ${a.avoidFeel}`,[...(a.avoid||[]),a.avoidNote].filter(Boolean).length&&`피할 말: ${[...(a.avoid||[]),a.avoidNote].filter(Boolean).join(', ')}`,a.models?.[1]&&`함께 고민 중인 모델: ${a.models[1]}`,a.size&&`크기: ${a.size}`,a.useNote&&`쓰는 법: ${a.useNote}`,a.driveUrl&&`드라이브: ${a.driveUrl}`,a.approver==='many'&&`여러 명이 확인${a.approverName?` · 최종 ${a.approverName}`:''}`].filter(Boolean).map(oneLine);
  put('notes',lines.join('\n').slice(0,3000));
  // 고른 모델의 헤어는 그 모델이 제작 설계의 모델일 때만 옮긴다(헤어 1 · 2 · 3은 모델마다 다르다). 전용 인물이 붙어 있으면 카탈로그 모델을 넣지 않는다.
  const casting={...data.castingSelection};if(a.models?.[0]&&!casting.modelId&&!personaRefOf(casting.personaRef))casting.modelId=a.models[0];
  if(a.hair&&!casting.hair&&casting.modelId&&casting.modelId===a.models?.[0])casting.hair=a.hair;
  if(a.outfit&&!casting.outfit&&casting.modelId&&casting.modelId===a.models?.[0])casting.outfit=a.outfit;
  data.castingSelection=casting;
  return strategyWith(strategy,data,stamp);
}
function strategyWith(strategy,data,stamp){
  if(JSON.stringify(data)===JSON.stringify(strategy.data))return strategy;
  const history=strategy.revision>0?[...strategy.history,{revision:strategy.revision,data:strategy.data,request:strategy.request,confirmation:strategy.confirmation,updatedAt:strategy.updatedAt,author:strategy.author,authorName:strategy.authorName}].slice(-20):strategy.history;
  return {...strategy,revision:strategy.revision+1,data,history,updatedAt:stamp.at,author:stamp.author,authorName:stamp.authorName,authorId:stamp.authorId};
}
export function requestView(studio,{staff=false}={}){
  const request=studio.request;if(!request)return null;
  // paymentLog(결제 이력 — 취소 까닭 · 담당자 이름 · 크몽 주문 번호 · 실수령)는 직원만 본다. 여기서 빼지 않으면 request가 통째로 손님에게 내려간다.
  // 작업 소식(운영 조각 4)은 studio.progress에 있다(request 밖 — 앞 판 서버로 되돌려도 새지 않게, pulse-progress.mjs). 혹시 request에 같은 이름 칸이 있어도 내리지 않는다.
  const {notes,contact,paymentLog,progress,...safe}=request;
  // 담당자가 고친 메일 주소 · 끈 사실은 손님 보기에 내리지 않는다(고객 방은 초대 링크를 가진 누구나 연다).
  // paymentFlow는 직원 보기에도 둔다 — 직원 화면의 결제 줄 · 글 콘티 판 고르기 · 의견 다시 묶기는 이 서버에서만 켠다(화면 묶음이 서버보다 먼저 나가도 옛 서버에 모르는 칸을 보내지 않게).
  // castingLooks(2026-11-10 옷 · 머리 고르기): 이 서버가 방향 고르기의 옷 · 머리(answer_direction outfit · hair)를 안다 — 화면은 이것이 있을 때만 그 줄을 그리고 칸을 보낸다.
  // messagePhotos(운영 조각 8-B): 이 서버가 문의 사진(POST /pulse/api/studio/message-photo · support의 photos)을 받는다 — 손님 화면은 이것이 있을 때만 「사진 붙이기」를 그린다.
  // modelProposalLooks(2026-11-12 사진 상품): 이 서버가 모델 답(answer_model)의 outfit · hair를 안다 — 화면은 이것이 있을 때만 모델 제안 카드에 그 줄을 그리고 칸을 보낸다.
  // paymentLedger: 이 서버가 결제 이력을 쌓고 payment_confirm의 amount · channel · net을 안다 — 직원 화면은 이것이 있을 때만 그 칸을 보낸다.
  // progressFeed: 이 서버가 작업 소식(progress_save · progress_post · progress_withdraw, 그림 올리기의 x-studio-purpose: progress)을 안다 — 직원 화면은 이것이 있을 때만 「소식 올리기」를 그린다.
  // dueChange: 이 서버가 받으실 날 고치기(due_change)를 안다 — 직원 화면은 이것이 있을 때만 「받으실 날 고치기」를 그린다.
  if(staff)return {...safe,notes:notes||[],contact:contact||null,paymentLog:paymentLogOf(request),progress:progressOf(studio),paymentFlow:true,castingLooks:true,modelProposalLooks:true,paymentLedger:true,progressFeed:true,dueChange:true,messagePhotos:true};
  // 결제는 상태 · 때 · 값 · 받으실 날 · 받으실 날을 고친 때만 내린다(크몽 주문 번호 · 취소 사유 · 담당자 이름은 직원만).
  if(safe.payment){const {status,requestedAt,confirmedAt,cancelledAt,amount,dueDate,dueChangedAt}=safe.payment;safe.payment={status,...(requestedAt?{requestedAt}:{}),...(confirmedAt?{confirmedAt}:{}),...(cancelledAt?{cancelledAt}:{}),...(amount?{amount}:{}),...(dueDate?{dueDate}:{}),...(dueChangedAt?{dueChangedAt}:{})};}
  // paymentTrail(운영 조각 2 · 11-11): 일지의 결제 줄 — 다시 요청해도 앞 요청 · 취소 줄이 남게 이력에서 만든다.
  // 허용 목록으로 종류 · 때 · 값 · (확인 줄의) 받으실 날만 담는다. 담당자 이름 · 크몽 주문 번호 · 취소 까닭 · 받은 곳 · 실수령은 내리지 않는다.
  // 결제가 한 번도 없었으면 싣지 않는다. 옛 서버에는 이 칸이 없어 화면이 payment의 때로 대신 그린다(room-view.mjs journalModel).
  // 때를 읽을 수 없는 줄(빈 값 · 깨진 값)은 내리지 않는다(카본 끝판 검수 A1).
  // 받으실 날 고침 줄(due_changed)은 종류 · 때 · 새 날 · 앞 날 · 까닭(정해 둔 넷)만 — 담당자 메모는 내리지 않는다. 새 날을 읽을 수 없는 줄은 뺀다.
  const trail=paymentLogOf(request).filter(entry=>PAYMENT_TRAIL_KINDS.includes(entry?.kind)&&typeof entry.at==='string'&&Number.isFinite(Date.parse(entry.at))&&(entry.kind!=='due_changed'||realDay(entry.dueDate))).map(entry=>entry.kind==='due_changed'
    ?{kind:entry.kind,at:entry.at,dueDate:entry.dueDate,...(realDay(entry.from)?{from:entry.from}:{}),...(DUE_REASONS.includes(entry.reason)?{reason:entry.reason}:{})}
    :{kind:entry.kind,at:entry.at,...(paymentAmount(entry.amount)?{amount:entry.amount}:{}),...(entry.kind==='confirmed'&&typeof entry.dueDate==='string'&&entry.dueDate?{dueDate:entry.dueDate}:{})});
  // paymentFlow: 이 서버가 결제 상태와 제작 시작 동의(terms)를 안다 — 화면은 이것이 있을 때만 terms를 보낸다(서버보다 화면 묶음이 먼저 나가도 승인이 막히지 않게).
  // 작업 소식: 올린 것만 {id, at, stage?, text, assets}로(pulse-progress.mjs progressCustomerView) request.progress 자리에 싣는다. 하나도 없으면 칸을 싣지 않는다.
  const shown=progressCustomerView(studio);
  return {...safe,...(trail.length?{paymentTrail:trail}:{}),...(shown.length?{progress:shown}:{}),paymentFlow:true,castingLooks:true,modelProposalLooks:true,messagePhotos:true};
}
