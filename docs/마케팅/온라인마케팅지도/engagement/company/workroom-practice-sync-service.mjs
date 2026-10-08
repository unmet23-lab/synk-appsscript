// The company host owns private account storage and concurrency. SHIFT owns
// state validation. This adds no Atlas engine or external customer workspace.
import engine from '../../../../../atlas/personalization.js';
import '../../../../../atlas/domain.js';
import temper from '../../../../../atlas/temper-outcomes.js';
import {restore} from '../../../../../experiences/shift-workbench/model.mjs';

const KIND='workroomPracticeSync';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const fields=['version','save','manifest','settings','profile','events','run','history','visits','retention','evaluation'];
export function createPracticeSyncService({store,clock}){
  function own(user){
    const current=typeof user?.id==='string'?store.get('users',user.id):null;
    if(!current?.active||!['admin','manager','member','viewer'].includes(current.role))throw fail('로그인 상태를 다시 확인해 주세요.',401);
    return current;
  }
  const scopeFor=user=>({personId:user.id,productId:'company',contextId:'workroom-practice',domain:'SHIFT'});
  function validate(state,user){
    if(!object(state)||Object.keys(state).some(key=>!fields.includes(key))||state.save!==true||!state.profile)throw fail('계정에 저장할 실습 기록을 확인해 주세요.');
    const raw=JSON.stringify(state);
    if(raw.length>1000000||Buffer.byteLength(raw,'utf8')>3000000)throw fail('실습 기록이 너무 큽니다. 필요한 작성물을 내려받고 오래된 기록을 정리해 주세요.',413);
    try{return restore(raw,engine,scopeFor(user),temper);}catch{throw fail('본인 계정의 실습 기록과 원근거를 확인할 수 없어요. 기기 내용을 보존한 채 다시 확인해 주세요.');}
  }
  function rowFor(user){
    const row=store.get(KIND,user.id);
    if(!row)return {version:1,ownerId:user.id,revision:0,status:'empty',updatedAt:null};
    if(row.version!==1||row.ownerId!==user.id||!Number.isSafeInteger(row.revision)||row.revision<1||!['active','deleted'].includes(row.status)||!Number.isFinite(Date.parse(row.updatedAt))
      ||(row.status==='active'&&typeof row.ciphertext!=='string')||(row.status==='deleted'&&Object.hasOwn(row,'ciphertext')))throw fail('계정 저장 기록을 읽지 못했어요. 이 기기의 내용은 유지됩니다.',500);
    return row;
  }
  function envelope(user,row){
    let state=null;
    if(row.status==='active'){
      try{state=validate(store.decrypt(row.ciphertext),user);}catch{throw fail('계정 저장 기록을 읽지 못했어요. 이 기기의 내용은 유지됩니다.',500);}
    }
    return {revision:row.revision,status:row.status,updatedAt:row.updatedAt,state};
  }
  function revision(input){if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw fail('계정 기록을 새로 확인한 뒤 저장해 주세요.');}
  function conflict(user,row,code='PRACTICE_CONFLICT'){
    const message=code==='PRACTICE_DELETED'?'다른 기기에서 계정 기록을 삭제했어요. 이 기기 내용을 자동으로 다시 올리지 않습니다.':code==='PRACTICE_NOT_ENABLED'?'계정 저장을 직접 켠 뒤 실습 기록을 저장해 주세요.':'다른 기기에서 실습 기록을 바꿨어요. 양쪽 내용을 확인한 뒤 선택해 주세요.';
    throw Object.assign(fail(message,409,code),{current:envelope(user,row)});
  }
  function read(user){user=own(user);return envelope(user,rowFor(user));}
  function save(user,input){
    user=own(user);
    if(!object(input)||Object.keys(input).some(key=>!['action','expectedRevision','activate','state'].includes(key))||input.action!=='save'||typeof input.activate!=='boolean')throw fail('본인의 계정 저장 선택과 실습 기록만 변경할 수 있어요.');
    revision(input);const state=validate(input.state,user),at=clock();
    return store.transaction(()=>{
      user=own(user);const row=rowFor(user);
      if(input.expectedRevision!==row.revision)conflict(user,row,row.status==='deleted'?'PRACTICE_DELETED':'PRACTICE_CONFLICT');
      if(row.status!=='active'&&input.activate!==true)conflict(user,row,row.status==='deleted'?'PRACTICE_DELETED':'PRACTICE_NOT_ENABLED');
      if(row.revision>=Number.MAX_SAFE_INTEGER)throw fail('계정 기록의 새 저장을 준비하지 못했어요.',503);
      const next={version:1,ownerId:user.id,revision:row.revision+1,status:'active',updatedAt:at,ciphertext:store.encrypt(state)};
      store.put(KIND,user.id,next);return envelope(user,next);
    });
  }
  function remove(user,input){
    user=own(user);
    if(!object(input)||Object.keys(input).some(key=>!['action','expectedRevision'].includes(key))||input.action!=='delete')throw fail('본인의 계정 저장 기록만 삭제할 수 있어요.');
    revision(input);return store.transaction(()=>{
      user=own(user);const row=rowFor(user);if(input.expectedRevision!==row.revision)conflict(user,row);
      if(row.revision>=Number.MAX_SAFE_INTEGER)throw fail('계정 기록의 삭제를 준비하지 못했어요.',503);
      // Keep only a content-free revision tombstone to reject a late writer.
      const next={version:1,ownerId:user.id,revision:row.revision+1,status:'deleted',updatedAt:clock()};
      store.put(KIND,user.id,next);return envelope(user,next);
    });
  }
  function mutate(user,input){if(input?.action==='save')return save(user,input);if(input?.action==='delete')return remove(user,input);throw fail('계정 저장 또는 삭제를 선택해 주세요.');}
  return Object.freeze({read,mutate});
}
