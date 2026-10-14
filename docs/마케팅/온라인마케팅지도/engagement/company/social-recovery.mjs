import {createHash,randomUUID} from 'node:crypto';
import {canWriteChannel} from './organization.mjs';

const KIND='socialRecoveryDrafts';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const allowed=new Set(['title','body','brandId','category','campaignId','language','purpose','topikArea','source','sourceId','media','variants','expiresAt','recurrence','revision','contentVersion']);
const keyOf=value=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(value))throw fail('복구 원고 식별자를 확인해 주세요.');return value;};
const integer=(value,fallback=null)=>{if(value==null)return fallback;if(!Number.isSafeInteger(value)||value<0)throw fail('복구 원고 버전을 확인해 주세요.');return value;};

// Recovery is private working text, never an approved or scheduled post.
export function createSocialRecovery({store,publishing,marketing,clock=()=>new Date().toISOString()}){
  let setting=store.get('settings','socialRecovery');
  if(!setting){setting={id:'socialRecovery',scopeId:randomUUID()};store.put('settings',setting.id,setting);}
  const retentionDays=7,maxDrafts=20;
  const id=(user,key)=>createHash('sha256').update(user.id+'\0'+key).digest('hex');
  function current(user){const row=store.get('users',user?.id);if(!row?.active)throw fail('먼저 로그인해 주세요.',401);if(!['admin','manager','member'].includes(row.role))throw fail('원고를 작성할 권한이 없어요.',403);return row;}
  function prune(){const at=Date.parse(clock());for(const row of store.all(KIND))if(Date.parse(row.expiresAt)<=at)store.remove(KIND,row.id);}
  function validate(user,draft,postId){
    if(!draft||typeof draft!=='object'||Array.isArray(draft)||Buffer.byteLength(JSON.stringify(draft))>512*1024)throw fail('복구 원고는 512KiB까지만 보관할 수 있어요.');
    const payload=Object.fromEntries(Object.entries(draft).filter(([key])=>allowed.has(key)));
    if(payload.variants!=null&&(!Array.isArray(payload.variants)||payload.variants.length>40))throw fail('복구할 계정 목록을 확인해 주세요.');
    for(const v of payload.variants||[]){const c=store.get('channels',v?.channelId);if(!c||c.active===false||c.hidden||!canWriteChannel(user,c))throw fail('복구 원고의 현재 계정 권한을 확인해 주세요.',403);}
    if(postId){const p=publishing.get(user,postId).post;if(!p.canEdit)throw fail('원고를 수정할 권한이 없어요.',403);}
    // Canonical source validation checks references without requiring a complete title/date.
    marketing.validatePostInput(user,payload);
    return structuredClone(payload);
  }
  function view(user,row){const draft=store.decrypt(row.payload);validate(user,draft,row.postId);const currentPost=row.postId?publishing.get(user,row.postId).post:null;return {draftKey:row.draftKey,postId:row.postId,baseRevision:row.baseRevision,revision:row.revision,updatedAt:row.updatedAt,expiresAt:row.expiresAt,draft,currentPostRevision:currentPost?.revision??null,conflict:!!currentPost&&currentPost.revision!==row.baseRevision};}
  function list(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);prune();const drafts=[];if(live.role!=='viewer')for(const row of store.all(KIND).filter(r=>r.ownerId===live.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))try{drafts.push(view(live,row));}catch(error){if(![400,403,404,409].includes(error.status))throw error;}return {drafts,retentionDays,maxDrafts,scopeId:setting.scopeId};}
  // The workspace carries only this: no decryption or draft validation on every reload. Drafts come from list() when the summary changes.
  function summary(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);prune();const drafts=[];
    if(live.role!=='viewer')for(const row of store.all(KIND).filter(r=>r.ownerId===live.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){let currentPostRevision=null;
      if(row.postId)try{currentPostRevision=publishing.get(live,row.postId).post.revision;}catch(error){if([400,403,404,409].includes(error.status))continue;throw error;}
      drafts.push({draftKey:row.draftKey,postId:row.postId,baseRevision:row.baseRevision,revision:row.revision,updatedAt:row.updatedAt,expiresAt:row.expiresAt,currentPostRevision,conflict:currentPostRevision!=null&&currentPostRevision!==row.baseRevision});}
    return {drafts,retentionDays,maxDrafts,scopeId:setting.scopeId,summary:true};}
  function save(user,input={}){user=current(user);prune();const draftKey=keyOf(input.draftKey),postId=input.postId==null?null:keyOf(input.postId),baseRevision=integer(input.baseRevision),revision=integer(input.revision,0);if(postId&&baseRevision==null)throw fail('원본 게시물 버전을 함께 보관해 주세요.');const draft=validate(user,input.draft,postId),rowId=id(user,draftKey);return store.transaction(()=>{const old=store.get(KIND,rowId);if((old?.revision||0)!==revision)throw fail('다른 창에서 복구 원고를 먼저 저장했어요. 최신 복구본을 확인해 주세요.',409);if(old&&old.postId!==postId)throw fail('복구 원고의 원본은 바꿀 수 없어요.',409);if(!old&&store.all(KIND).filter(r=>r.ownerId===user.id).length>=maxDrafts)throw fail('복구 원고는 20개까지 보관할 수 있어요. 필요 없는 복구본을 먼저 지워 주세요.',409);const at=clock(),row={id:rowId,draftKey,postId,baseRevision,ownerId:user.id,revision:revision+1,createdAt:old?.createdAt||at,updatedAt:at,expiresAt:new Date(Date.parse(at)+retentionDays*86400000).toISOString(),payload:store.encrypt(draft)};store.put(KIND,rowId,row);return {recovery:view(user,row)};});}
  function check(user,input={}){user=current(user);const postId=input.postId==null?null:keyOf(input.postId);validate(user,input.draft,postId);return {ok:true,currentPostRevision:postId?publishing.get(user,postId).post.revision:null};}
  function discard(user,input={}){user=current(user);const draftKey=keyOf(input.draftKey),row=store.get(KIND,id(user,draftKey));if(!row)return {ok:true};if(row.revision!==integer(input.revision))throw fail('더 새로운 복구 원고가 있어요. 최신 내용을 확인한 뒤 버려 주세요.',409);store.remove(KIND,row.id);return {ok:true};}
  return {list,summary,save,check,discard,prune};
}
