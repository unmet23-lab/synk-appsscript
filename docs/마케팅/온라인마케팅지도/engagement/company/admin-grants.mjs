// 관리자 화면의 반 · 명부 · 이용 권한 부여(관리자 직접부여 설계 3 · 4절)를 회사 서버가 중앙 synk-account에 넘길 때 쓰는 계약.
// 정본은 SYNK-talk lib/synk-account-admin-grants.js와 docs/C0_API계약.md 「Workspace 관리자 직접 부여」 절이다(2026-11-21 82eecb2f).
// 회사 서버는 op마다 중앙이 받는 키만 받아 그대로 넘기고, 중앙 응답은 op마다 아는 칸만 남긴다. 꼴이 틀리면 503이다.
// 칸 이름은 중앙 그대로 둔다(반 줄의 id · teachers · learners · openRows 등). 화면 public/admin-grants.js가 같은 이름을 읽는다.

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL=/[\u0000-\u001f\u007f]/;
const CODE=/^[A-Z][A-Z0-9_]{1,63}$/;
const ISO_INSTANT=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
export const GRANTS_PAGE_SIZE=25;
export const REAUTH_WINDOW_MS=15*60_000;

// 7절 7의 기본값. 회사 상한은 회사 audit의 applied 성공 건으로, 중앙 상한은 중앙 감사 표로 따로 센다.
export const GRANT_DAILY_LIMITS=Object.freeze({'teacher.add':5,'class.create':5});
export const ADMIN_PROMOTION_DAILY_LIMIT=1;

// 중앙 ALLOWED와 같은 허용 목록(1e7685f7). library.*는 기한을 골라서 주고(주면 1분 뒤보다 늦어야 한다), WORLD 연습 더하기는 기한을 꼭 정하고 6개월 안이다.
export const ENTITLEMENT_CHOICES=Object.freeze([
  ['platform','library.world','서재에서 WORLD 열기'],
  ['platform','library.messenger','서재에서 메신저 열기'],
  ['platform','library.teacher','서재에서 교사 앱 열기'],
  ['platform','library.path','서재에서 PATH 열기'],
  ['platform','library.pulse','서재에서 PULSE 열기'],
  ['platform','library.care','서재에서 케어 열기'],
  ['platform','library.fortune','서재에서 운세 열기'],
  ['world','practice.plus','WORLD 연습 더하기'],
].map(([product,capability,label])=>Object.freeze({product,capability,label,expiry:product==='world'?'required':'optional',maxMonths:product==='world'?6:null})));
// 목록에는 보이지만 이 도구로 주거나 거두지 않는 권한과 그 까닭(중앙 1e7685f7 GA4). 화면은 이 줄에서 「거두기」를 숨기고 까닭을 적는다.
// 마을 체험: 학습 확인 때의 자동 체험은 체험 줄이 하나라도 있으면 건너뛰므로, 관리자가 준 기간제 체험이 먼저 끝나면 자동 체험을 영영 못 받는다.
export const ENTITLEMENT_VIEW_ONLY=Object.freeze([
  Object.freeze({product:'world',capability:'town.access.trial',label:'마을 체험 입장',reason:'마을 체험은 학습 확인 때 자동으로 주어져 여기서 주거나 거둘 수 없어요.'}),
]);
function capabilityMessage(payload){
  const row=ENTITLEMENT_VIEW_ONLY.find(item=>item.product===payload?.product&&item.capability===payload?.capability);
  return row?row.reason:grantMessage('CAPABILITY_NOT_ALLOWED');
}

const text=(max,{required=false}={})=>value=>typeof value==='string'&&value.length<=max&&!CONTROL.test(value)&&(!required||(value.trim()===value&&value.length>0));
const uuid=value=>typeof value==='string'&&UUID.test(value);
const bool=value=>typeof value==='boolean';
const int=(min,max)=>value=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const oneOf=(...values)=>value=>values.includes(value);
// 꼴이 맞아도 달력에 없는 날(2월 30일 · 4월 31일)이나 시각(24시 · 60분)은 Date가 다음 날로 넘겨 버린다. 중앙처럼 칸마다 본다.
function instant(value){
  const match=typeof value==='string'&&value.length<=40?ISO_INSTANT.exec(value):null;
  if(!match)return false;
  const [y,mo,d,h,mi,sec,oh,om]=match.slice(1).map(part=>part===undefined?0:Number(part)),day=new Date(Date.UTC(y,mo-1,d));
  if(mo<1||mo>12||day.getUTCFullYear()!==y||day.getUTCMonth()!==mo-1||day.getUTCDate()!==d)return false;
  if(h>23||mi>59||sec>59||oh>14||om>59)return false;
  return Number.isFinite(Date.parse(value));
}

// op → {write, staff(교사 열람권으로 여는 op), keys:{이름:[검사, 꼭 있어야 하는지]}}. 중앙 OPS의 keys · optional과 같다.
// 쓰기 op에는 requestId(UUID)와 confirm:true가 따로 붙는다.
export const GRANT_OPS=Object.freeze({
  'classes.list':{write:false,keys:{q:[text(80),true],active:[oneOf('all','active','inactive'),true],page:[int(1,10_000),true]}},
  'class.create':{write:true,keys:{classKey:[value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,59}$/.test(value),true],displayName:[text(80,{required:true}),true],test:[bool,true]}},
  'class.setActive':{write:true,keys:{classId:[uuid,true],active:[bool,true],displayName:[text(80,{required:true})]}},
  'class.people':{write:false,keys:{classId:[uuid,true]}},
  'learner.add':{write:true,keys:{classId:[uuid,true],synkUserId:[uuid,true],learnerId:[uuid],move:[bool]}},
  'learner.remove':{write:true,keys:{classId:[uuid,true],learnerId:[uuid,true]}},
  'teacher.add':{write:true,staff:true,keys:{classId:[uuid,true],synkUserId:[uuid,true]}},
  'teacher.remove':{write:true,staff:true,keys:{classId:[uuid,true],staffId:[uuid,true]}},
  'entitlements.list':{write:false,keys:{synkUserId:[uuid,true]}},
  'entitlement.grant':{write:true,keys:{synkUserId:[uuid,true],product:[text(40),true],capability:[text(80),true],validUntil:[value=>value===null||instant(value)]}},
  'entitlement.revoke':{write:true,keys:{synkUserId:[uuid,true],product:[text(40),true],capability:[text(80),true]}},
  'audit.list':{write:false,keys:{days:[int(1,30)]}},
});
export const GRANT_OP_LABELS=Object.freeze({
  'classes.list':'반 목록 보기','class.create':'반 만들기','class.setActive':'반 켜고 끄기','class.people':'반 사람 보기',
  'learner.add':'학생 넣기','learner.remove':'학생 빼기','teacher.add':'선생님 넣기','teacher.remove':'선생님 빼기',
  'entitlements.list':'이용 권한 보기','entitlement.grant':'이용 권한 주기','entitlement.revoke':'이용 권한 거두기','audit.list':'최근 부여 보기',
});

// 중앙 오류 코드마다 처음 읽는 사람이 알아듣는 한 문장.
const MESSAGES={
  INVALID_GRANT_REQUEST:'요청 내용이 맞지 않아요. 화면을 새로 불러온 뒤 다시 해 주세요.',
  CONFIRM_REQUIRED:'확인 창에서 직접 확인해 주세요.',
  INVALID_VALID_UNTIL:'기한을 다시 골라 주세요. 달력에 있는 날짜여야 하고 지금보다 뒤여야 해요. WORLD 권한은 6개월 안에서 꼭 정해요.',
  AUTH_REQUIRED:'SYNK ID 로그인이 끝났어요. 다시 로그인해 주세요.',
  REAUTH_REQUIRED:'15분 안에 SYNK ID로 다시 로그인해야 이 일을 할 수 있어요. 「SYNK ID로 다시 로그인」을 눌러 한 번 더 로그인해 주세요.',
  GRANTS_FORBIDDEN:'이 SYNK ID에는 반과 이용 권한을 관리할 권한이 없어요.',
  PRODUCT_FORBIDDEN:'이 SYNK ID에는 반과 이용 권한을 관리할 권한이 없어요.',
  SYNK_LOGIN_REQUIRED:'반과 이용 권한은 SYNK ID로 로그인했을 때만 관리할 수 있어요.',
  CAPABILITY_NOT_ALLOWED:'여기서 주거나 거둘 수 없는 권한이에요.',
  ACCOUNT_NOT_FOUND:'이 SYNK ID를 찾지 못했어요.',
  CLASS_NOT_FOUND:'반을 찾지 못했어요. 반 목록을 새로 불러와 주세요.',
  LEARNER_NOT_FOUND:'이 반에서 그 명부 줄을 찾지 못했어요. 반 사람을 새로 불러와 주세요.',
  STAFF_NOT_FOUND:'그 선생님을 찾지 못했어요. 반 사람을 새로 불러와 주세요.',
  ENTITLEMENT_NOT_FOUND:'거둘 이용 권한이 없어요. 목록을 새로 불러와 주세요.',
  REQUEST_CONFLICT:'같은 요청 번호로 다른 내용이 이미 처리됐어요. 확인 창을 닫고 처음부터 다시 해 주세요.',
  ACCOUNT_UNAVAILABLE:'지금 쓸 수 없는 SYNK ID예요. 이용 중지나 탈퇴 요청 상태인지 확인해 주세요.',
  LOGIN_OWNER_MISSING:'이 SYNK ID에 이어진 로그인 계정이 없어요. 운영 SQL로 먼저 정리해야 해요.',
  LOGIN_OWNER_AMBIGUOUS:'이 SYNK ID에 로그인 계정이 둘 이상 이어져 있어요. 운영 SQL로 먼저 정리해야 해요.',
  LEARNER_ON_OLD_LOGIN:'지운 로그인 계정에 이어진 옛 명부 줄이 있어요. 운영 SQL로 줄의 주인을 먼저 바꿔야 해요.',
  STAFF_ON_OLD_LOGIN:'지운 로그인 계정에 이어진 옛 직원 줄이 있어요. 운영 SQL로 먼저 정리해야 해요.',
  TARGET_CHANGED:'그사이 이 사람의 계정이나 명부가 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',
  CLASS_KEY_TAKEN:'같은 반 키가 이미 있어요. 다른 키를 적어 주세요.',
  CLASS_INACTIVE:'꺼진 반에는 사람을 넣을 수 없어요. 반을 먼저 다시 켜 주세요.',
  TEACHER_OF_CLASS:'이 사람은 이 반의 선생님이에요. 학생으로 넣을 수 없어요.',
  LEARNER_OF_CLASS:'이 사람은 이 반의 학생이에요. 선생님으로 넣을 수 없어요.',
  LEARNER_ROW_TAKEN:'그 명부 줄은 이미 다른 SYNK ID에 이어져 있어요.',
  LEARNER_ROW_UNAVAILABLE:'그 명부 줄은 빠진 줄이라 이을 수 없어요.',
  ACCOUNT_ALREADY_ENROLLED:'이 사람은 다른 반 명부에 있어요. 옮기려면 「다른 반에서 이 반으로 옮기기」를 눌러 주세요.',
  STAFF_ROLE_CONFLICT:'이 사람은 검수자 자격이 있어 선생님으로 넣을 수 없어요.',
  STAFF_INACTIVE:'닫힌 직원 줄이라 여기서 다시 켤 수 없어요. 운영에서 닫았거나 원장 · 검수자 자격인 줄이에요. 운영 SQL로 먼저 정리해야 해요.',
  ENTITLEMENT_CONFLICT:'이용 권한이 그사이 바뀌어 반영하지 못했어요. 목록을 새로 불러온 뒤 다시 해 주세요.',
  ENTITLEMENT_NOT_EDITABLE:'결제나 운영에서 준 권한이라 여기서 바꿀 수 없어요.',
  DAILY_LIMIT:'오늘 할 수 있는 횟수를 다 썼어요. 24시간 뒤에 다시 해 주세요.',
  CONTRACT_UNSUPPORTED:'회사 서버와 SYNK ID 서버의 판이 맞지 않아요. 관리자에게 알려 주세요.',
  GRANTS_UNAVAILABLE:'SYNK ID 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.',
  GRANTS_UNCONFIRMED:'반영됐는지 확인하지 못했어요. 그사이 로그인 상태를 다시 확인해야 했어요. 「다시 확인」을 눌러 같은 요청으로 확인해 주세요.',
};
// 같은 코드라도 op에 따라 할 일이 다르면 op별 문장을 쓴다. ENTITLEMENT_NOT_EDITABLE은 주기와 거두기 모두에서 난다.
const OP_MESSAGES={
  'entitlement.grant':{ENTITLEMENT_NOT_EDITABLE:'같은 권한이 결제나 운영에서 준 줄로 있어 여기서 줄 수 없어요. 그 줄은 운영에서 바꿔요.'},
  'entitlement.revoke':{ENTITLEMENT_NOT_EDITABLE:'결제나 운영에서 준 권한이라 여기서 거둘 수 없어요.'},
};
export function grantMessage(code,details=null,op=null){
  if(op&&Object.hasOwn(OP_MESSAGES,op)&&Object.hasOwn(OP_MESSAGES[op],code))return OP_MESSAGES[op][code];
  if(code==='DAILY_LIMIT'&&Number.isSafeInteger(details?.limit))return `오늘은 이 일을 ${details.limit}번까지 할 수 있어요. 24시간 뒤에 다시 해 주세요.`;
  return MESSAGES[code]||'요청을 처리하지 못했어요. 화면을 새로 불러온 뒤 다시 해 주세요.';
}
export function grantsError(status,code,{message=null,details=null,retryable=false}={}){
  return Object.assign(new Error(message||grantMessage(code,details)),{status,code,grants:true,...(details?{details}:{}),...(retryable?{retryable:true}:{})});
}

function addMonths(at,months){const date=new Date(at);date.setUTCMonth(date.getUTCMonth()+months);return date.getTime();}

// 화면이 보낸 본문을 op 계약대로 읽는다. 모르는 키, 빠진 키, 틀린 꼴은 모두 400이다. 받은 키만 중앙에 넘긴다.
export function parseGrantRequest(input,{now=Date.now()}={}){
  const invalid=()=>grantsError(400,'INVALID_GRANT_REQUEST');
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.op!=='string'||!Object.hasOwn(GRANT_OPS,input.op))throw invalid();
  const spec=GRANT_OPS[input.op],allowed=new Set(['op',...Object.keys(spec.keys),...(spec.write?['requestId','confirm']:[])]);
  if(Object.keys(input).some(key=>!allowed.has(key)))throw invalid();
  const payload={};
  for(const [key,[check,required]]of Object.entries(spec.keys)){
    if(!Object.hasOwn(input,key)){if(required)throw invalid();continue;}
    if(!check(input[key]))throw key==='validUntil'?grantsError(400,'INVALID_VALID_UNTIL'):invalid();
    payload[key]=input[key];
  }
  if(spec.write){
    if(!uuid(input.requestId))throw invalid();
    if(input.confirm!==true)throw grantsError(400,'CONFIRM_REQUIRED');
    payload.requestId=input.requestId.toLowerCase();payload.confirm=true;
  }
  if(input.op==='class.create'&&payload.test!==payload.classKey.startsWith('test-'))throw invalid();
  if(input.op==='entitlement.grant'||input.op==='entitlement.revoke'){
    const choice=ENTITLEMENT_CHOICES.find(row=>row.product===payload.product&&row.capability===payload.capability);
    if(!choice)throw grantsError(403,'CAPABILITY_NOT_ALLOWED',{message:capabilityMessage(payload)});
    if(input.op==='entitlement.grant'){
      const until=payload.validUntil??null,at=until===null?null:Date.parse(until);
      if(choice.expiry==='required'&&until===null)throw grantsError(400,'INVALID_VALID_UNTIL');
      if(until!==null&&(at<=now+60_000||choice.expiry==='required'&&at>addMonths(now,choice.maxMonths)))throw grantsError(400,'INVALID_VALID_UNTIL');
    }
  }
  for(const key of ['classId','synkUserId','learnerId','staffId'])if(typeof payload[key]==='string')payload[key]=payload[key].toLowerCase();
  return {op:input.op,write:spec.write,staff:spec.staff===true,payload};
}

// 응답 칸 검사. 아는 칸만 남기고 꼴이 틀리면 null을 돌려준다(→ 503). [검사, 없어도 되는지]
const nullable=check=>value=>value===null||check(value);
const time=value=>typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
function pick(value,fields){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const result={};
  for(const [key,[check,optional]]of Object.entries(fields)){
    if(!Object.hasOwn(value,key)||value[key]===undefined){if(optional)continue;return null;}
    if(!check(value[key]))return null;
    result[key]=value[key];
  }
  return result;
}
const list=(value,fields,max)=>{if(!Array.isArray(value)||value.length>max)return null;const rows=value.map(row=>pick(row,fields));return rows.every(Boolean)?rows:null;};
const count=int(0,1_000_000);
const name=nullable(text(120));
const CLASS_ROW={id:[uuid],classKey:[text(60,{required:true})],displayName:[nullable(text(120))],active:[bool],test:[bool],seasonless:[bool,true],teachers:[count],learners:[count],openRows:[count],createdAt:[nullable(time),true]};
const CLASS_VIEW={id:[uuid],classKey:[text(60,{required:true})],displayName:[nullable(text(120))],active:[bool],test:[bool],createdAt:[nullable(time),true]};
const TEACHER={staffId:[uuid],synkUserId:[nullable(uuid)],name:[name],role:[oneOf('teacher','director','inspector')],active:[bool],assignedAt:[nullable(time),true]};
const LEARNER={learnerId:[uuid],studentCode:[nullable(text(40))],active:[bool],linked:[bool],synkUserId:[nullable(uuid)],accountStatus:[nullable(text(40))],name:[name],enrolledAt:[nullable(time)],test:[bool]};
const ENTITLEMENT_ROW={product:[text(40,{required:true})],capability:[text(120,{required:true})],source:[text(60,{required:true})],validFrom:[nullable(time)],validUntil:[nullable(time)],revokedAt:[nullable(time)],active:[bool],editable:[bool]};
const ENTITLEMENT_VIEW={product:[text(40,{required:true})],capability:[text(120,{required:true})],validUntil:[nullable(time)],revokedAt:[nullable(time)],active:[bool]};
const AUDIT={id:[text(40,{required:true})],at:[time],op:[value=>typeof value==='string'&&Object.hasOwn(GRANT_OPS,value)],outcome:[oneOf('applied','duplicate','rejected')],code:[nullable(value=>typeof value==='string'&&CODE.test(value)),true],
  actorSynkUserId:[nullable(uuid)],targetSynkUserId:[nullable(uuid)],classId:[nullable(uuid)],learnerId:[nullable(uuid)],staffId:[nullable(uuid)],entitlementRef:[nullable(text(240))]};

const READS={
  'classes.list'(data,payload){
    if(data.page!==payload.page||data.pageSize!==GRANTS_PAGE_SIZE||!count(data.total))return null;
    const rows=list(data.rows,CLASS_ROW,GRANTS_PAGE_SIZE),expected=Math.min(GRANTS_PAGE_SIZE,Math.max(0,data.total-(payload.page-1)*GRANTS_PAGE_SIZE));
    return rows&&rows.length===expected?{total:data.total,page:data.page,pageSize:data.pageSize,rows}:null;
  },
  'class.people'(data){
    const row=pick(data.class,CLASS_VIEW),teachers=list(data.teachers,TEACHER,500),learners=list(data.learners,LEARNER,2000);
    return row&&teachers&&learners?{class:row,teachers,learners}:null;
  },
  'entitlements.list'(data,payload){const rows=list(data.rows,ENTITLEMENT_ROW,200);return rows&&data.synkUserId===payload.synkUserId?{synkUserId:data.synkUserId,rows}:null;},
  'audit.list'(data){const rows=list(data.rows,AUDIT,200);return rows&&int(1,30)(data.days)?{days:data.days,rows}:null;},
};
// 쓰기 응답의 op별 칸. 공통 칸(op · requestId · outcome · replayed)은 readGrantsResponse가 본다. duplicate 응답에는 없을 수 있는 칸은 「없어도 됨」이다.
const WRITES={
  'class.create':{class:[value=>Boolean(pick(value,CLASS_VIEW))]},
  'class.setActive':{class:[value=>Boolean(pick(value,CLASS_VIEW))]},
  'learner.add':{classId:[uuid],learnerId:[uuid],studentCode:[nullable(text(40))],change:[oneOf('created','linked','reactivated','moved','assigned','none')],fromClassId:[uuid,true],sharing:[value=>Boolean(pick(value,{enabled:[bool],revision:[value=>Number.isSafeInteger(Number(value)),true]})),true]},
  'learner.remove':{classId:[uuid],learnerId:[uuid],studentCode:[nullable(text(40))],change:[oneOf('removed','none')],accessRevoked:[count,true]},
  'teacher.add':{classId:[uuid],staffId:[uuid],role:[oneOf('teacher','director')],change:[oneOf('created','reopened','assigned','none')]},
  'teacher.remove':{classId:[uuid],staffId:[uuid],change:[oneOf('unassigned','closed','none')],invitesRemoved:[count,true]},
  'entitlement.grant':{synkUserId:[uuid],entitlement:[value=>Boolean(pick(value,ENTITLEMENT_VIEW))],change:[oneOf('granted','none')]},
  'entitlement.revoke':{synkUserId:[uuid],entitlement:[value=>Boolean(pick(value,ENTITLEMENT_VIEW))],change:[oneOf('revoked','none')]},
};
const NESTED={class:CLASS_VIEW,entitlement:ENTITLEMENT_VIEW,sharing:{enabled:[bool],revision:[value=>Number.isSafeInteger(Number(value)),true]}};
function readWrite(op,data,payload){
  if(data.requestId!==payload.requestId||!oneOf('applied','duplicate')(data.outcome)||data.replayed!==undefined&&!bool(data.replayed))return null;
  const fields=pick(data,WRITES[op]);if(!fields)return null;
  for(const key of Object.keys(fields))if(NESTED[key])fields[key]=pick(fields[key],NESTED[key]);
  return {requestId:data.requestId,outcome:data.outcome,...(data.replayed===true?{replayed:true}:{}),...fields};
}

// 중앙 오류 줄에서 화면이 쓸 칸만 넘긴다(ACCOUNT_ALREADY_ENROLLED의 classId · className, DAILY_LIMIT의 limit).
function errorDetails(error){
  const details={};
  if(uuid(error?.classId))details.classId=error.classId.toLowerCase();
  if(text(120)(error?.className)&&error.className)details.className=error.className;
  if(int(1,1000)(error?.limit))details.limit=error.limit;
  return Object.keys(details).length?details:null;
}

// 중앙의 응답을 회사 화면의 답으로 바꾼다.
// 중앙 401 REAUTH_REQUIRED는 코드를 그대로 넘기되 상태는 409로 준다(화면의 401은 「로그아웃됨」으로 읽혀 회사 세션 화면을 지운다).
// 그 밖의 401 · 403(AUTH_REQUIRED · GRANTS_FORBIDDEN · PRODUCT_FORBIDDEN)은 GRANTS_FORBIDDEN, 426은 판 불일치라 503 CONTRACT_UNSUPPORTED다.
export function readGrantsResponse(op,status,data,payload){
  const unavailable=()=>grantsError(503,'GRANTS_UNAVAILABLE',{retryable:true});
  if(status>=200&&status<300){
    if(data?.ok!==true||data.op!==op)throw unavailable();
    const result=GRANT_OPS[op].write?readWrite(op,data,payload):READS[op](data,payload);
    if(!result)throw unavailable();
    return {ok:true,op,...result};
  }
  const code=typeof data?.error?.code==='string'&&CODE.test(data.error.code)?data.error.code:null;
  if(status===401&&code==='REAUTH_REQUIRED')throw grantsError(409,'REAUTH_REQUIRED',{details:{source:'central'}});
  if(status===403&&code==='CAPABILITY_NOT_ALLOWED')throw grantsError(403,code,{message:capabilityMessage(payload)});
  if(status===401||status===403)throw grantsError(403,'GRANTS_FORBIDDEN');
  if(status===426)throw grantsError(503,'CONTRACT_UNSUPPORTED');
  if([400,404,409,429].includes(status)&&code){const details=errorDetails(data.error);throw grantsError(status,code,{details,message:grantMessage(code,details,op)});}
  throw unavailable();
}
