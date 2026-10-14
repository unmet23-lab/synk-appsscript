export const LIMITS = Object.freeze({ photo: 6*1024*1024, audio: 8*1024*1024, total:20*1024*1024, export:32*1024*1024, pages:30, contributions:40, attempts:20, skippedQuestions:300 });
export const EXPORT_NAME = 'synk-family-album.json';
// Whose story the album holds. callName is how the family addresses that person
// in questions ('어머니'); self/spouse/other start without one.
export const STORYTELLER_RELATIONS = Object.freeze([
  { id:'mother', label:'어머니', callName:'어머니' },
  { id:'father', label:'아버지', callName:'아버지' },
  { id:'grandmother', label:'할머니', callName:'할머니' },
  { id:'grandfather', label:'할아버지', callName:'할아버지' },
  { id:'maternal-grandmother', label:'외할머니', callName:'외할머니' },
  { id:'maternal-grandfather', label:'외할아버지', callName:'외할아버지' },
  { id:'spouse', label:'배우자', callName:'' },
  { id:'self', label:'나', callName:'' },
  { id:'other', label:'그 밖의 가족', callName:'' },
].map(Object.freeze));
export const STORYTELLER_LIMITS = Object.freeze({ name:30, callName:20, hometown:40, firstBirthYear:1900 });
export const QUESTIONS = Object.freeze([
  { id:'place', label:'장소', prompt: () => '함께한 그날, 어디에 있었나요?' },
  { id:'occasion', label:'그날의 계기', prompt: p => `「${p.title}」의 날, 함께 모인 계기가 있었나요?` },
  { id:'quote', label:'기억나는 한마디', prompt: () => '그날 나눈 말 중 지금도 떠오르는 한마디가 있나요?' },
  { id:'feeling', label:'남은 마음', prompt: () => '이 이야기를 지금 다시 보면 어떤 마음이 드나요?' },
]);
export const RECIPE_QUESTIONS = Object.freeze([
  { id:'amount', label:'직접 확인한 양', prompt: () => '“적당히”라고 배운 재료가 있나요? 실제로 넣어 본 양을 남겨 주세요.' },
  { id:'heat', label:'불 세기와 시간', prompt: () => '어떤 불 세기로 얼마나 익혔나요? 사용한 냄비나 도구도 함께 적어 주세요.' },
  { id:'doneness', label:'완성의 기준', prompt: () => '다 익었다는 걸 어떻게 확인했나요? 맛이나 모양으로 알게 된 기준이 있나요?' },
]);
export const pageQuestions = page => page.recipe ? RECIPE_QUESTIONS : QUESTIONS;
const fail = message => { throw new Error(message); };
const text = (v,max,required=false) => { if(typeof v !== 'string'||v.length>max||(required&&!v.trim())) fail('글의 길이나 필수 항목을 확인해 주세요.'); return v.trim(); };
const id = v => typeof v==='string' && /^[a-zA-Z0-9-]{1,80}$/.test(v);
const stamp = v => typeof v==='string'&&Number.isFinite(Date.parse(v));
const validDate = (v,required=false) => typeof v==='string' && (!v ? !required : /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const ownKeys = (v,allowed) => v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).every(k=>allowed.includes(k));
// Question bank ids are referenced, not imported: an id retired from the bank
// must never make an existing album unreadable.
export const isQuestionRef = v => typeof v==='string' && v.length<=60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const STORYTELLER_KEYS = ['name','relation','callName','birthYear','hometown'];
const storytellerError = () => fail(`이야기 주인 정보를 확인해 주세요. 이름은 ${STORYTELLER_LIMITS.name}자, 호칭은 ${STORYTELLER_LIMITS.callName}자, 고향은 ${STORYTELLER_LIMITS.hometown}자까지이고 태어난 해는 ${STORYTELLER_LIMITS.firstBirthYear}년부터 올해까지 적을 수 있어요.`);
function validateStoryteller(v){
  if(!ownKeys(v,STORYTELLER_KEYS)||!STORYTELLER_KEYS.every(k=>Object.hasOwn(v,k))) storytellerError();
  if(typeof v.name!=='string'||v.name.length>STORYTELLER_LIMITS.name||!v.name.trim()) storytellerError();
  if(!STORYTELLER_RELATIONS.some(r=>r.id===v.relation)) storytellerError();
  if(typeof v.callName!=='string'||v.callName.length>STORYTELLER_LIMITS.callName) storytellerError();
  if(typeof v.hometown!=='string'||v.hometown.length>STORYTELLER_LIMITS.hometown) storytellerError();
  if(v.birthYear!==null&&!(Number.isInteger(v.birthYear)&&v.birthYear>=STORYTELLER_LIMITS.firstBirthYear&&v.birthYear<=new Date().getFullYear())) storytellerError();
  return {name:v.name.trim(),relation:v.relation,callName:v.callName.trim(),birthYear:v.birthYear,hometown:v.hometown.trim()};
}
function validateSkippedQuestions(v){
  if(!Array.isArray(v)||v.length>LIMITS.skippedQuestions) fail(`건너뛴 질문은 ${LIMITS.skippedQuestions}개까지 기억할 수 있어요.`);
  const list=Array.from(v);
  if(list.some(item=>!isQuestionRef(item))||new Set(list).size!==list.length) fail('건너뛴 질문 기록을 확인해 주세요.');
  return list;
}
export function emptyAlbum(){ return {format:'synk-family-album',version:1,pages:[]}; }
/** Accepts loose form input (birthYear as '1948' or '', missing callName) and
 * returns the canonical storyteller record that validateAlbum stores. */
export function makeStoryteller(input){
  if(!input||typeof input!=='object'||Array.isArray(input)) storytellerError();
  const relation=input.relation??'other';
  const known=STORYTELLER_RELATIONS.find(r=>r.id===relation);
  let birthYear=input.birthYear??null;
  if(typeof birthYear==='string') birthYear=birthYear.trim()===''?null:/^\d{4}$/.test(birthYear.trim())?Number(birthYear.trim()):NaN;
  return validateStoryteller({name:input.name,relation,callName:input.callName??known?.callName??'',birthYear,hometown:input.hometown??''});
}
/** null removes the storyteller so the album returns to the original v1 shape. */
export function setStoryteller(album,input){
  const next=structuredClone(album);
  if(input===null||input===undefined) delete next.storyteller; else next.storyteller=makeStoryteller(input);
  return validateAlbum(next);
}
export function skipQuestion(album,questionId){
  if(!isQuestionRef(questionId)) fail('건너뛸 질문을 확인해 주세요.');
  const next=structuredClone(album),list=next.skippedQuestions??[];
  if(!list.includes(questionId)) list.push(questionId);
  next.skippedQuestions=list;
  return validateAlbum(next);
}
/** Removing the last skipped id removes the field instead of storing []. */
export function unskipQuestion(album,questionId){
  const next=structuredClone(album);
  if(Array.isArray(next.skippedQuestions)){
    next.skippedQuestions=next.skippedQuestions.filter(item=>item!==questionId);
    if(!next.skippedQuestions.length) delete next.skippedQuestions;
  }
  return validateAlbum(next);
}
// A read-only view: search entered text, never media bytes or account references.
export function selectAlbumPages(album,{query='',sort='recent'}={}){
  const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR');
  const terms=normalize(query).trim().split(/\s+/u).filter(Boolean);
  const result=album.pages.filter(page=>{
    if(!terms.length)return true;
    const recipe=page.recipe;
    const values=[page.title,page.story,page.person,page.author,page.date,...Object.values(page.details),
      ...page.contributions.flatMap(item=>[item.name,item.text]),
      ...(recipe?[recipe.learnedFrom,recipe.servings,recipe.ingredients,recipe.steps,...recipe.attempts.flatMap(item=>[item.date,item.note])]:[])];
    const haystack=normalize(values.join('\n'));
    return terms.every(term=>haystack.includes(term));
  });
  return result.sort((a,b)=>{
    if(sort==='date-asc'||sort==='date-desc'){
      if(!a.date||!b.date)return a.date?-1:b.date?1:0;
      return sort==='date-asc'?a.date.localeCompare(b.date):b.date.localeCompare(a.date);
    }
    return Date.parse(b.updatedAt)-Date.parse(a.updatedAt);
  });
}
export function newId(){return globalThis.crypto.randomUUID();}
export function emptyRecipe(at=new Date().toISOString()){return {servings:'',learnedFrom:'',ingredients:'',steps:'',attempts:[],revisedAt:at};}
function validateRecipe(recipe,at){
  if(!ownKeys(recipe,['servings','learnedFrom','ingredients','steps','attempts','revisedAt'])||!Array.isArray(recipe.attempts)||recipe.attempts.length>LIMITS.attempts||!stamp(recipe.revisedAt??at)) fail('손맛 기록을 확인해 주세요. 만들어 본 기록은 20번까지 남길 수 있어요.');
  const ids=new Set();
  const attempts=recipe.attempts.map(a=>{
    if(!ownKeys(a,['id','date','note','createdAt'])||!id(a.id)||ids.has(a.id)||!validDate(a.date,true)||!stamp(a.createdAt))fail('만들어 본 날짜와 기록을 확인해 주세요.');
    ids.add(a.id);return {id:a.id,date:a.date,note:text(a.note,2000,true),createdAt:a.createdAt};
  });
  return {servings:text(recipe.servings,120),learnedFrom:text(recipe.learnedFrom,120,true),ingredients:text(recipe.ingredients,6000,true),steps:text(recipe.steps,10000,true),attempts,revisedAt:recipe.revisedAt??at};
}
export function mediaBytes(media,kind) {
  if(media===null) return 0;
  if(!ownKeys(media,['name','type','data']) || typeof media.name!=='string'||media.name.length>180||typeof media.type!=='string'||typeof media.data!=='string') fail('파일 정보가 올바르지 않아요.');
  const allowed = kind==='photo' ? ['image/jpeg','image/png','image/webp'] : ['audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4'];
  if(!allowed.includes(media.type)) fail('지원하는 사진 또는 음성 파일을 골라 주세요.');
  const prefix=`data:${media.type};base64,`;
  if(!media.data.startsWith(prefix)) fail('파일 형식이 맞지 않아요.');
  const b64=media.data.slice(prefix.length);
  if(!b64.length||b64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) fail('파일 내용이 올바르지 않아요.');
  const count=b64.length/4*3-(b64.endsWith('==')?2:b64.endsWith('=')?1:0);
  if(count>LIMITS[kind]) fail(kind==='photo'?'사진은 한 장에 6 MB까지 담을 수 있어요.':'음성은 한 개에 8 MB까지 담을 수 있어요.');
  const header=atob(b64.slice(0,64));
  const byte = n=>header.charCodeAt(n);
  const valid = media.type==='image/jpeg' ? byte(0)===255&&byte(1)===216&&byte(2)===255
    : media.type==='image/png' ? header.slice(1,4)==='PNG'&&byte(0)===137
    : media.type==='image/webp' ? header.slice(0,4)==='RIFF'&&header.slice(8,12)==='WEBP'
    : media.type==='audio/wav' ? header.slice(0,4)==='RIFF'&&header.slice(8,12)==='WAVE'
    : media.type==='audio/ogg' ? header.slice(0,4)==='OggS'
    : media.type==='audio/webm' ? byte(0)===26&&byte(1)===69&&byte(2)===223&&byte(3)===163
    : media.type==='audio/mp4' ? header.slice(4,8)==='ftyp'
    : header.slice(0,3)==='ID3'||byte(0)===255&&(byte(1)&224)===224;
  if(!valid) fail('확장자와 실제 파일 내용이 달라요. 다른 파일을 골라 주세요.');
  return count;
}
// Version stays 1. storyteller, skippedQuestions and page.questionId are optional
// keys: absent keys are never added, so older files and account documents keep
// their exact shape when read and written again (same rule as page.recipe).
export function validateAlbum(input){
  if(!ownKeys(input,['format','version','storyteller','skippedQuestions','pages'])||input.format!=='synk-family-album'||input.version!==1||!Array.isArray(input.pages)||input.pages.length>LIMITS.pages) fail('가족 이야기 앨범 파일이 아니거나 페이지가 너무 많아요.');
  const storyteller=Object.hasOwn(input,'storyteller')?validateStoryteller(input.storyteller):null;
  const skippedQuestions=Object.hasOwn(input,'skippedQuestions')?validateSkippedQuestions(input.skippedQuestions):null;
  let bytes=0; const ids=new Set();
  const pages=input.pages.map(p=>{
    if(!ownKeys(p,['id','title','date','person','author','story','photo','audio','details','skipped','contributions','createdAt','updatedAt','questionId','recipe'])||!id(p.id)||ids.has(p.id)||!stamp(p.createdAt)||!stamp(p.updatedAt)) fail('페이지 정보가 올바르지 않아요.');
    ids.add(p.id);
    if(!validDate(p.date)) fail('날짜를 확인해 주세요.');
    if(Object.hasOwn(p,'questionId')&&!isQuestionRef(p.questionId)) fail('질문 기록을 확인해 주세요.');
    const recipe=Object.hasOwn(p,'recipe')?validateRecipe(p.recipe,p.createdAt):null;
    const questions=recipe?[...QUESTIONS,...RECIPE_QUESTIONS]:QUESTIONS;
    if(!ownKeys(p.details,questions.map(q=>q.id))||!Array.isArray(p.skipped)||p.skipped.some(v=>!questions.some(q=>q.id===v))||new Set(p.skipped).size!==p.skipped.length) fail('질문 기록을 확인해 주세요.');
    const details=Object.fromEntries(Object.entries(p.details).map(([k,v])=>[k,text(v,1000,true)]));
    if(!Array.isArray(p.contributions)||p.contributions.length>LIMITS.contributions) fail('덧붙인 기억은 페이지마다 40개까지 담을 수 있어요.');
    const contributionIds=new Set();
    const contributions=p.contributions.map(c=>{
      if(!ownKeys(c,['id','name','text','createdAt'])||!id(c.id)||contributionIds.has(c.id)||!stamp(c.createdAt)) fail('덧붙인 기억의 출처를 확인해 주세요.');
      contributionIds.add(c.id);return {id:c.id,name:text(c.name,60,true),text:text(c.text,2000,true),createdAt:c.createdAt};
    });
    bytes+=mediaBytes(p.photo,'photo')+mediaBytes(p.audio,'audio');
    return {id:p.id,title:text(p.title,100,true),date:p.date,person:text(p.person,100),author:text(p.author,60,true),story:text(p.story,10000,true),photo:p.photo?{...p.photo}:null,audio:p.audio?{...p.audio}:null,details,skipped:[...p.skipped],contributions,createdAt:p.createdAt,updatedAt:p.updatedAt,...(Object.hasOwn(p,'questionId')?{questionId:p.questionId}:{}),...(recipe?{recipe}:{})};
  });
  if(bytes>LIMITS.total) fail('앨범의 사진과 음성은 모두 합쳐 20 MB까지 담을 수 있어요. 기존 파일을 줄여 주세요.');
  const result={format:input.format,version:1,...(storyteller?{storyteller}:{}),...(skippedQuestions?{skippedQuestions}:{}),pages};
  if(new TextEncoder().encode(JSON.stringify(result)).length>LIMITS.export) fail('사진·음성·글을 합친 앨범 파일은 32 MB까지 담을 수 있어요. 일부 내용을 나눠 보관해 주세요.');
  return result;
}
export function parseAlbum(source){if(typeof source!=='string'||new TextEncoder().encode(source).length>LIMITS.export) fail('불러올 파일은 32 MB 이하여야 해요.');try{return validateAlbum(JSON.parse(source));}catch(e){if(e instanceof SyntaxError) fail('JSON 파일을 읽지 못했어요. 내보낸 앨범 파일을 골라 주세요.');throw e;}}
export function serializeAlbum(album){const result=JSON.stringify(validateAlbum(album));if(new TextEncoder().encode(result).length>LIMITS.export) fail('내보낼 파일이 너무 커요.');return result;}
export function upsertPage(album,page){const next=structuredClone(album),i=next.pages.findIndex(p=>p.id===page.id);if(i<0)next.pages.unshift(page);else next.pages[i]=page;return validateAlbum(next);}
export function recipeStatus(page){
  if(!page.recipe)return null;
  if(!page.recipe.attempts.length)return {tried:false,revised:false,label:'아직 만들어 보기 전이에요'};
  const latest=page.recipe.attempts.reduce((a,b)=>Date.parse(a.createdAt)>Date.parse(b.createdAt)?a:b);
  return {tried:true,revised:Date.parse(page.recipe.revisedAt)>Date.parse(latest.createdAt),label:'직접 만들어 봤어요'};
}
export function addRecipeAttempt(page,attempt){
  if(!page.recipe)fail('손맛 기록에서 만들어 본 경험을 남겨 주세요.');
  const next=structuredClone(page);next.recipe.attempts.push(attempt);next.updatedAt=attempt.createdAt;
  return validateAlbum({...emptyAlbum(),pages:[next]}).pages[0];
}
export function nextQuestion(page,{ask,domain,at=new Date().toISOString()}={}){
  if(!ask||!domain) throw new Error('질문 준비가 끝나지 않았어요. 새로고침해 주세요.');
  const available=pageQuestions(page);
  const contract={id:page.recipe?'family-recipe':'family-memory',version:'1',purpose:page.recipe?'next-recipe-detail':'next-story-detail',fields:available.map(q=>({id:q.id,kind:'boolean',maxAgeDays:36500})),criteria:[]};
  const scope={domain:'SYNK',workspace:'family-album',subject:page.id};
  const observations=Object.keys(page.details).filter(field=>available.some(q=>q.id===field)).map(field=>({id:`detail-${field}`,scope,contract:{id:contract.id,version:'1',purpose:contract.purpose},field,value:true,source:'declared',at,recordedAt:at}));
  const known=domain.understand({contract,scope,observations,at});
  const answers=Object.fromEntries(known.fields.filter(f=>f.usable&&f.value).map(f=>[f.id,'written']));
  // Only explicit fields count as answered. Free prose is preserved, not semantically inferred.
  const questions=available.map(q=>({id:q.id,about:q.id,kind:'follow_up',options:[{id:'written',value:'written'},{id:'skip',value:'skip'}]}));
  const selected=ask.choose({questions,answers,denied:page.skipped,decide:values=>({content:Object.keys(values).filter(k=>values[k]==='written').sort(),shape:Object.keys(values).filter(k=>values[k]==='skip').sort()})});
  if(selected.status!=='ask')return null;
  const q=available.find(q=>q.id===selected.question.id);
  return {...q,text:q.prompt(page),basis:page.recipe?`배운 곳: ${page.recipe.learnedFrom}`:page.person?`함께한 사람: ${page.person}`:`이야기: ${page.title}`,engine:{ask:ask.VERSION,domain:domain.VERSION,reason:selected.reason}};
}
