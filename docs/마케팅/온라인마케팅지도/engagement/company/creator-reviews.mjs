import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import rules from './public/publish-rules.js';
const review=JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8')).review;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('보낸 점검 내용이 이상해요. 새로 읽은 뒤 다시 해 주세요.');return value;};
function text(value,max,label,required=false){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}에 쓸 수 없는 글자가 있거나 너무 길어요.`);const result=value.trim();if(required&&!result)throw fail(`${label} 칸을 채워 주세요.`);return result;}
export function normalizeReviewMedia(value){
  if(value===null||value===undefined)return null;object(value);
  const name=text(value.name,255,'파일 이름',true);if(/[\\/]/.test(name))throw fail('파일 이름에 폴더 경로가 섞여 있어요. 파일 이름을 바꾼 뒤 다시 골라 주세요.');
  if(!['image','video'].includes(value.kind)||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>2147483648||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||value.width<1||value.height<1||value.width>32768||value.height>32768)throw fail('파일 크기나 해상도를 받을 수 없어요. 2GB 이하 이미지나 영상으로 다시 골라 주세요.');
  const mime=text(value.mime||'',120,'파일 형식');if(mime&&!/^(image|video)\/[a-z0-9.+-]+$/i.test(mime))throw fail('이미지나 영상 파일만 고를 수 있어요.');
  if(value.kind==='video'&&(typeof value.duration!=='number'||!Number.isFinite(value.duration)||value.duration<=0||value.duration>86400))throw fail('영상 길이가 이상해요. 다른 파일로 다시 골라 주세요.');
  return {name,kind:value.kind,mime,bytes:value.bytes,width:value.width,height:value.height,duration:value.kind==='video'?value.duration:null,provenance:'browser-metadata'};
}
export function createCreatorReviewsService({store,clock=()=>new Date().toISOString()}){
  function current(user,write=false){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('읽기만 할 수 있는 계정이에요.',403);return live;}
  function rowFor(user,id){const row=store.get('creatorReviews',id);if(!row||row.ownerId!==user.id)throw fail('그 점검 기록을 찾지 못했어요.',404);return row;}
  function full(row){return {...row,analysis:rules.analyze(row.media,row.preset),checkCount:review.filter(check=>row.checks[check.id]?.checked).length};}
  function workspace(user){user=current(user);return {records:store.all('creatorReviews').filter(row=>row.ownerId===user.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(full),review,presets:rules.presets,canWrite:user.role!=='viewer'};}
  function save(user,input,id=null){
    user=current(user,true);object(input);const previous=id?rowFor(user,id):null;
    if(previous&&(input.revision!==previous.revision||previous.archived))throw fail(previous.archived?'보관한 기록이라 보관을 풀어야 고칠 수 있어요.':'그사이 다른 창에서 이 기록이 바뀌었어요. 다시 열어 주세요.',409);
    if(!previous&&store.all('creatorReviews').filter(row=>row.ownerId===user.id).length>=300)throw fail('내 점검 기록은 보관한 것까지 합쳐 300개까지예요.',409);
    const preset=text(input.preset,40,'게시 형식',true);if(!rules.presets.some(row=>row.id===preset))throw fail('게시 형식을 다시 골라 주세요.');
    const checks=object(input.checks||{});if(Object.keys(checks).some(key=>!review.some(row=>row.id===key)))throw fail('목록에 없는 점검 항목이 들어 있어요.');
    const normalized={};for(const item of review){const value=checks[item.id]||{checked:false,note:''};object(value);if(typeof value.checked!=='boolean')throw fail('점검 표시가 이상해요.');normalized[item.id]={checked:value.checked,note:text(value.note??'',1200,'점검 근거')};}
    const at=clock(),row={id:previous?.id||randomUUID(),ownerId:user.id,title:text(input.title,160,'작업 제목',true),preset,media:normalizeReviewMedia(input.media),audience:text(input.audience??'',600,'보는 사람과 얻는 것'),rights:text(input.rights??'',1800,'소재와 음악 사용권'),measurement:text(input.measurement??'',1000,'측정할 반응'),checks:normalized,archived:false,revision:(previous?.revision||0)+1,createdAt:previous?.createdAt||at,updatedAt:at};
    store.put('creatorReviews',row.id,row);return {record:full(row)};
  }
  function archive(user,id,input){user=current(user,true);object(input);const row=rowFor(user,id);if(input.revision!==row.revision)throw fail('그사이 다른 창에서 이 기록이 바뀌었어요. 다시 불러와 주세요.',409);if(typeof input.archived!=='boolean')throw fail('보관 표시가 이상해요.');const updated={...row,archived:input.archived,revision:row.revision+1,updatedAt:clock()};store.put('creatorReviews',id,updated);return {record:full(updated)};}
  return {workspace,save,archive};
}
