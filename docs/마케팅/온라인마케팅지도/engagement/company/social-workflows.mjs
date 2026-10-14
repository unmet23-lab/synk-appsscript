import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel,canManageOwners} from './organization.mjs';

const K={templates:'socialTemplates',policies:'socialQueuePolicies',plans:'socialWorkflowPlans'};
const fields=['title','body','brandId','category','campaignId','language','purpose','topikArea','source','media','variants','expiresAt','recurrence'];
const editable=new Set(['title','body','brandId','category','campaignId','language','purpose','topikArea','expiresAt','recurrence']);
const clone=value=>JSON.parse(JSON.stringify(value));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const josa=w=>{const s=String(w),c=s.charCodeAt(s.length-1);return c>=0xac00&&c<=0xd7a3?((c-0xac00)%28?'을':'를'):/id$/i.test(s)?'를':'을';};
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 형식을 확인해 주세요.');return value;};
const text=(value,max,label,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||required&&!value.trim())throw fail(label+josa(label)+' 확인해 주세요.');return value.trim();};
const content=post=>Object.fromEntries(fields.filter(key=>post[key]!==undefined).map(key=>[key,clone(post[key])]));
const ids=value=>{if(!Array.isArray(value)||!value.length||value.length>200||value.some(id=>typeof id!=='string'||!id||id.length>100)||new Set(value).size!==value.length)throw fail('중복 없는 게시물 1~200개를 선택해 주세요.');return value;};
const jobSignature=jobs=>jobs.map(job=>({id:job.id,channelId:job.channelId,scheduledAt:job.scheduledAt,selectedCopyId:job.selectedCopyId,scheduleRevision:job.scheduleRevision}));

/** Explicit, persisted previews. This service never calls a publishing provider. */
export function createSocialWorkflowsService({store,publishing,clock=()=>new Date().toISOString(),preparePost=async(_user,post)=>post,validatePostInput=(_user,post)=>post}={}){
  if(!store||!publishing)throw new TypeError('store and publishing are required');
  const now=()=>new Date(clock()).toISOString();
  function current(user,write=false){const row=store.get('users',typeof user==='string'?user:user?.id);if(!row?.active||!['admin','manager','member','viewer'].includes(row.role))throw fail('먼저 로그인해 주세요.',401);if(write&&row.role==='viewer')throw fail('작성 권한이 필요해요.',403);return row;}
  function live(user,{authorize=()=>user,signal}={}){if(signal?.aborted)throw fail('요청이 중단됐어요.',409);const actor=current(authorize(),true);if(actor.id!==user.id)throw fail('로그인한 사용자가 바뀌었어요.',401);return actor;}
  function target(user,id,manage=false){const row=store.get('channels',id);if(!row||row.active===false||row.hidden||!canReadChannel(user,row))throw fail('사용할 수 있는 계정을 확인해 주세요.',404);if(manage?!canManageOwners(user,row):!canWriteChannel(user,row))throw fail('대상 계정에 대한 권한이 필요해요.',403);return row;}
  async function prepared(user,post,context){user=live(user,context);const input=content(post);validatePostInput(user,input);const result=await preparePost(user,input,{...context,authorize:()=>live(user,context)});user=live(user,context);const canonical=content(result?.post||result||input);validatePostInput(user,canonical);return canonical;}
  function templateFor(user,id,write=false){user=current(user,write);const row=store.get(K.templates,text(id,100,'템플릿',true));if(!row)throw fail('템플릿을 찾을 수 없어요.',404);for(const variant of row.post.variants||[])target(user,variant.channelId,write);if(!row.post.variants?.length&&row.ownerId!==user.id)throw fail('템플릿을 찾을 수 없어요.',404);validatePostInput(user,clone(row.post));return row;}
  function prune(){const at=Date.parse(now());for(const plan of store.all(K.plans))if(!plan.appliedAt&&Date.parse(plan.expiresAt)<=at||plan.appliedAt&&Date.parse(plan.appliedAt)<at-30*86400000)store.remove(K.plans,plan.id);}
  function workspace(user){user=current(user);prune();const templates=[];for(const row of store.all(K.templates))try{const readable=templateFor(user,row.id);templates.push({...readable,canEdit:user.role!=='viewer'&&(row.ownerId===user.id||row.post.variants.every(v=>canManageOwners(user,store.get('channels',v.channelId))))});}catch(error){if(![400,401,403,404,409,422].includes(error.status))throw error;}return {templates,queuePolicies:store.all(K.policies).filter(row=>canReadChannel(user,store.get('channels',row.channelId))).map(row=>({...row,canEdit:canManageOwners(user,store.get('channels',row.channelId))}))};}
  async function saveTemplate(user,input,id,context={}){
    user=live(current(user,true),context);object(input);const old=id?templateFor(user,id):null;
    if(old&&(old.ownerId!==user.id&&!old.post.variants.every(v=>canManageOwners(user,store.get('channels',v.channelId)))))throw fail('템플릿을 수정할 권한이 없어요.',403);
    if(old&&input.revision!==old.revision)throw fail('템플릿이 바뀌었어요. 다시 열어 주세요.',409);
    const base=input.postId?publishing.get(user,input.postId).post:input.post||old?.post;
    const canonical=await prepared(user,object(base),context);user=live(user,context);
    if(old&&store.get(K.templates,old.id)?.revision!==old.revision)throw fail('템플릿이 바뀌었어요. 다시 열어 주세요.',409);
    const checked=publishing.batch(user,[{operation:'save',input:canonical}],{preview:true}).rows[0];if(!checked.valid)throw fail(checked.errors.join('\n'));
    const row={id:old?.id||randomUUID(),name:text(input.name??old?.name,120,'템플릿 이름',true),description:text(input.description??old?.description,1000,'템플릿 설명'),post:content(checked.after),ownerId:old?.ownerId||user.id,revision:(old?.revision||0)+1,createdAt:old?.createdAt||now(),updatedAt:now()};
    store.put(K.templates,row.id,row);return {template:row};
  }
  function persist(user,action,commands,result,extra={}){
    prune();const id=randomUUID(),createdAt=now(),expiresAt=new Date(Date.parse(createdAt)+15*60000).toISOString();
    const rows=result.rows.map((row,index)=>({...row,index,title:row.title||'',errors:row.errors||[],warnings:row.warnings||[]}));
    const plan={id,ownerId:user.id,action,commands,rows,createdAt,expiresAt,...extra};store.put(K.plans,id,plan);
    return {previewId:id,action,expiresAt,rows,validCount:rows.filter(row=>row.valid).length,errorCount:rows.filter(row=>!row.valid).length};
  }
  async function templatePreview(user,input,context={}){
    user=live(current(user,true),context);object(input);const template=templateFor(user,input.templateId),old=input.postId?publishing.get(user,input.postId).post:null;
    const preparedPost=await prepared(user,template.post,context);user=live(user,context);
    if(templateFor(user,template.id).revision!==template.revision)throw fail('템플릿이 바뀌었어요. 다시 확인해 주세요.',409);
    const command={operation:'save',postId:old?.id,revision:old?.revision,input:preparedPost};
    const result=publishing.batch(user,[command],{preview:true});return persist(user,'template',[command],result,{templateId:template.id,templateRevision:template.revision});
  }
  async function bulkPreview(user,input,context={}){
    user=live(current(user,true),context);object(input);const action=input.action;
    if(!['edit','submit','approve','schedule'].includes(action))throw fail('일괄 작업을 선택해 주세요.');
    const selected=ids(input.postIds),patch=action==='edit'?object(input.patch):{};
    for(const key of Object.keys(patch))if(!editable.has(key))throw fail('일괄 수정할 수 없는 항목이 있어요: '+key);
    if(input.syncCommonText!==undefined&&typeof input.syncCommonText!=='boolean')throw fail('공통 본문 동기화 여부를 확인해 주세요.');
    const commands=[],errors=new Map();
    for(const [index,id] of selected.entries())try{
      user=live(user,context);const before=publishing.get(user,id).post;
      const next=content(before);if(action==='edit'){Object.assign(next,clone(patch));if(input.syncCommonText===true&&Object.hasOwn(patch,'body'))next.variants=next.variants.map(variant=>({...variant,text:patch.body}));}
      const canonical=await prepared(user,next,context);user=live(user,context);
      if(publishing.get(user,id).post.revision!==before.revision)throw fail('준비하는 동안 게시물이 바뀌었어요. 다시 확인해 주세요.',409);
      if(action!=='edit'&&digest(canonical)!==digest(content(before)))throw fail('미디어 정보가 바뀌었어요. 게시물을 먼저 다시 저장해 주세요.',409);
      commands.push({operation:action==='edit'?'save':action,postId:id,revision:before.revision,input:action==='edit'?canonical:action==='schedule'?clone(object(input.schedule||{})):{},validationPost:canonical});
    }catch(error){commands.push({operation:action,postId:id,revision:null,input:{}});errors.set(index,error.message);}
    const result=publishing.batch(live(user,context),commands,{preview:true});
    for(const [index,message] of errors)result.rows[index]={index,postId:selected[index],valid:false,errors:[message],warnings:[]};
    for(const row of result.rows)if(row.valid&&action==='schedule')commands[row.index].expectedJobs=jobSignature(row.jobs);
    return persist(user,action,commands,result);
  }
  function saveQueuePolicy(user,input){
    user=current(user,true);object(input);const channel=target(user,input.channelId,true),old=store.get(K.policies,channel.id);
    if(old&&input.revision!==old.revision)throw fail('편성 규칙이 바뀌었어요. 다시 확인해 주세요.',409);
    const minutes=input.minimumIntervalMinutes??0;if(!Number.isInteger(minutes)||minutes<0||minutes>525600)throw fail('최소 재게시 간격은 0~525600분으로 입력해 주세요.');
    if(!Array.isArray(input.categoryWeights)||input.categoryWeights.length>40)throw fail('카테고리 비중을 확인해 주세요.');
    const weights=input.categoryWeights.map(row=>{object(row);if(!Number.isInteger(row.weight)||row.weight<1||row.weight>100)throw fail('카테고리 비중은 1~100의 정수로 입력해 주세요.');return {category:text(row.category,100,'카테고리',true),weight:row.weight};});
    if(new Set(weights.map(row=>row.category)).size!==weights.length)throw fail('카테고리가 겹쳐요. 한 번씩만 넣어 주세요.');
    const policy={id:channel.id,channelId:channel.id,minimumIntervalMinutes:minutes,categoryWeights:weights,revision:(old?.revision||0)+1,updatedAt:now(),byId:user.id};store.put(K.policies,channel.id,policy);return {policy};
  }
  async function queuePreview(user,input,context={}){
    user=live(current(user,true),context);object(input);const channel=target(user,input.channelId,true),policy=store.get(K.policies,channel.id);
    if(!policy?.categoryWeights.length)throw fail('이 계정의 카테고리 비중을 먼저 설정해 주세요.');
    const selected=ids(input.postIds),posts=selected.map(id=>publishing.get(user,id).post),buckets=new Map(policy.categoryWeights.map(row=>[row.category,[]]));
    for(const post of posts){if(!post.variants.some(v=>v.channelId===channel.id))throw fail('선택한 계정용 게시물만 편성할 수 있어요.');if(!buckets.has(post.category))throw fail('비중을 정하지 않은 카테고리의 게시물이 있어요.');buckets.get(post.category).push(post);}
    // Smooth weighted round robin changes order, not category-specific slot times.
    const weights=policy.categoryWeights.map(row=>({...row,current:0})),ordered=[];
    while(ordered.length<posts.length){const available=weights.filter(row=>buckets.get(row.category).length),total=available.reduce((sum,row)=>sum+row.weight,0);for(const row of available)row.current+=row.weight;available.sort((a,b)=>b.current-a.current||a.category.localeCompare(b.category));const chosen=available[0];chosen.current-=total;ordered.push(buckets.get(chosen.category).shift());}
    const commands=[],failures=new Map();
    for(const [index,post] of ordered.entries())try{const canonical=await prepared(user,post,context);user=live(user,context);if(digest(canonical)!==digest(content(post)))throw fail('미디어 정보가 바뀌었어요. 게시물을 다시 저장해 주세요.',409);commands.push({operation:'schedule',postId:post.id,revision:post.revision,serialChannelId:channel.id,input:{mode:'queue',channelIds:[channel.id],scheduledAt:input.from,timezone:input.timezone||'Asia/Seoul'},validationPost:canonical});}catch(error){commands.push({operation:'schedule',postId:post.id,revision:null,input:{}});failures.set(index,error.message);}
    const result=publishing.batch(live(user,context),commands,{preview:true});for(const [index,message] of failures)result.rows[index]={index,postId:ordered[index].id,valid:false,errors:[message],warnings:[]};
    for(const row of result.rows)if(row.valid)commands[row.index].expectedJobs=jobSignature(row.jobs);
    return persist(user,'queue',commands,result,{policyChannelId:channel.id,policyRevision:policy.revision});
  }
  async function apply(user,input,context={}){
    user=live(current(user,true),context);object(input);if(input.confirmed!==true)throw fail('미리보기 결과를 확인한 뒤 적용해 주세요.');
    const plan=store.get(K.plans,text(input.previewId,100,'미리보기',true));if(!plan||plan.ownerId!==user.id)throw fail('미리보기를 찾을 수 없어요.',404);
    if(plan.appliedAt){const posts=plan.postIds.map(id=>publishing.get(user,id).post),jobs=posts.flatMap(post=>publishing.get(user,post.id).jobs).filter(job=>plan.jobIds.includes(job.id));return {posts,jobs,rows:[],existing:true};}
    if(plan.expiresAt<=now())throw fail('미리보기 유효 시간이 지났어요. 다시 확인해 주세요.',409);
    if(plan.rows.some(row=>!row.valid)&&input.skipInvalid!==true)throw fail('오류 행을 고치거나, 오류 항목은 빼고 적용하도록 선택해 주세요.',409);
    if(plan.templateId&&templateFor(user,plan.templateId).revision!==plan.templateRevision)throw fail('템플릿이 바뀌었어요. 다시 확인해 주세요.',409);
    if(plan.policyChannelId&&store.get(K.policies,plan.policyChannelId)?.revision!==plan.policyRevision)throw fail('계정 편성 규칙이 바뀌었어요. 다시 확인해 주세요.',409);
    const commands=plan.commands.filter((_command,index)=>plan.rows[index].valid);
    if(!commands.length)throw fail('적용할 수 있는 행이 없어요.');
    for(const command of commands){user=live(user,context);if(command.postId&&publishing.get(user,command.postId).post.revision!==command.revision)throw fail('게시물이 바뀌었어요. 새 미리보기로 다시 확인해 주세요.',409);const before=command.operation==='save'?command.input:command.validationPost,checked=await prepared(user,before,context);if(digest(checked)!==digest(before))throw fail('원본·미디어가 바뀌었어요. 새 미리보기로 다시 확인해 주세요.',409);}
    user=live(user,context);
    return publishing.atomic(()=>{
      const currentPlan=store.get(K.plans,plan.id);if(!currentPlan||currentPlan.ownerId!==user.id)throw fail('미리보기가 만료됐어요. 다시 확인해 주세요.',409);if(currentPlan.appliedAt)return {posts:currentPlan.postIds.map(id=>publishing.get(user,id).post),jobs:currentPlan.jobIds.map(id=>publishing.workspace(user).jobs.find(job=>job.id===id)).filter(Boolean),rows:[],existing:true};
      if(currentPlan.expiresAt<=now())throw fail('미리보기 유효 시간이 지났어요.',409);
      if(plan.templateId&&templateFor(user,plan.templateId).revision!==plan.templateRevision||plan.policyChannelId&&store.get(K.policies,plan.policyChannelId)?.revision!==plan.policyRevision)throw fail('미리보기 설정이 바뀌었어요. 다시 확인해 주세요.',409);
      // Later rows may await media inspection after an earlier row was prepared.
      // Recheck every source together immediately before the atomic commit.
      for(const command of commands)validatePostInput(user,clone(command.operation==='save'?command.input:command.validationPost));
      const result=publishing.batch(user,commands);store.put(K.plans,plan.id,{id:plan.id,ownerId:user.id,action:plan.action,createdAt:plan.createdAt,expiresAt:plan.expiresAt,appliedAt:now(),postIds:result.posts.map(post=>post.id),jobIds:result.jobs.map(job=>job.id)});return {...result,existing:false};
    });
  }
  return {workspace,saveTemplate,templatePreview,bulkPreview,queuePreview,apply,saveQueuePolicy,prune};
}
