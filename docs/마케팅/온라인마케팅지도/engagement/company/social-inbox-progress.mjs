import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const graphId=value=>typeof value==='string'&&/^\d{1,50}(?:_\d{1,50})?$/.test(value);
export const validInboxCursor=value=>typeof value==='string'&&value.length>0&&value.length<=2000&&!/[\s\x00-\x1f\x7f]/.test(value);

// The cursor is never a URL. Only these server-created tasks may choose an edge.
export function inboxProgressBinding(channel,settings,credentials,actor){
  return hash([channel.id,channel.platform,channel.externalId,channel.handle,channel.connectionVersion||0,channel.ownerIds,channel.teamId,channel.active,channel.hidden,settings.version,settings.updatedBy,actor?.active,actor?.role,actor?.teamId,credentials.authType,credentials.apiVersion,credentials.accountId,credentials.appScopedId,credentials.accessToken]);
}
export function newInboxTraversal(){return [{kind:'posts',after:null,cursors:[]}];}
const validTime=(value,at)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value&&Date.parse(value)<=Date.parse(at);
function validTask(task,at){
  if(!task||typeof task!=='object')return false;
  if(['item','reply-end','replies'].includes(task.kind)&&(!validTime(task.startedAt,at)||!['recent','history'].includes(task.scanLane)))return false;
  if(['item','reply-end'].includes(task.kind)&&(!validTime(task.observedAt,at)||task.startedAt>task.observedAt))return false;
  if(task.kind==='item')return graphId(task.item?.externalId)&&graphId(task.item?.nativePostId)&&(!task.item.parentExternalId||graphId(task.item.parentExternalId))&&typeof task.item.text==='string'&&task.item.text.length<=10000&&typeof task.item.accountReply==='boolean'&&typeof task.item.hiddenAccountReply==='boolean'&&typeof task.item.authorKnown==='boolean'&&typeof task.scanId==='string'&&task.scanId.length<=80;
  if(task.kind==='reply-end')return graphId(task.parentId)&&graphId(task.postId)&&typeof task.scanId==='string'&&task.scanId.length<=80&&typeof task.complete==='boolean';
  if(!['posts','comments','replies'].includes(task.kind)||task.after!==null&&!validInboxCursor(task.after)||!Array.isArray(task.cursors)||task.cursors.length>100||task.cursors.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x)))return false;
  if(task.kind!=='posts'&&(!graphId(task.post?.id)||typeof task.post?.url!=='string'||task.post.url.length>4096))return false;
  return task.kind!=='replies'||graphId(task.parentId)&&typeof task.scanId==='string'&&task.scanId.length<=80;
}
export function loadInboxProgress(saved,binding,at=new Date().toISOString()){
  const base={schema:1,binding,revision:Number.isSafeInteger(saved?.revision)?saved.revision:0,history:null,historyCompletedAt:null,lastCheckpointAt:null};
  if(!saved)return {...base,resetReason:null};
  if(saved.binding!==binding)return {...base,resetReason:'connection-changed'};
  if(saved.schema!==1||saved.history!==null&&(!Array.isArray(saved.history)||saved.history.length>4000||!saved.history.every(task=>validTask(task,at)))||JSON.stringify(saved).length>3*1024*1024)return {...base,resetReason:'invalid-progress'};
  return structuredClone(saved);
}
export function nextInboxPage(result,current){
  if(!result.paging?.next)return {after:null,cursors:current.cursors,complete:true};
  const after=result.paging?.cursors?.after;
  if(!validInboxCursor(after))return {after:null,cursors:[],complete:false};
  const digest=hash(after);
  if(after===current.after||current.cursors.includes(digest))return {after:null,cursors:[],complete:false};
  return {after,cursors:[...current.cursors.slice(-99),digest],complete:false};
}
export function inboxProgressView(progress,counts={}){
  return {mode:'recent-and-history',historyPending:Boolean(progress?.history?.length),historyCompletedAt:progress?.historyCompletedAt||null,lastCheckpointAt:progress?.lastCheckpointAt||null,recentPostsChecked:counts.recentPosts||0,historyPostsChecked:counts.historyPosts||0,recentCommentsReceived:counts.recentComments||0,historyCommentsReceived:counts.historyComments||0,resetReason:progress?.resetReason||null};
}
