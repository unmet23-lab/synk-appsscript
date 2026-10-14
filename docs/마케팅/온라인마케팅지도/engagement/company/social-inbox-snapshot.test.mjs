import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {Store} from './store.mjs';
import {createSocialReplies} from './social-replies.mjs';
import {createSocialMarketingService} from './social-marketing.mjs';

const at='2026-10-14T04:00:00.000Z';
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-inbox-snapshot-')),store=new Store(directory);
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const member={id:'member',role:'member',teamId:'team',active:true},viewer={id:'viewer',role:'viewer',teamId:'team',active:true},other={id:'other',role:'member',teamId:'other',active:true};
  for(const user of [member,viewer,other])store.put('users',user.id,user);
  const channel={id:'channel',platform:'instagram',externalId:'100',ownerIds:[member.id],teamId:'team',active:true,connectionVersion:1};store.put('channels',channel.id,channel);
  const credentials={accessToken:'synthetic-only',authType:'instagram-login',scope:'instagram_business_basic instagram_business_manage_comments'};store.setSecret('channel:channel',credentials);
  const makeRow=(id,externalId='300')=>({id,channelId:channel.id,sourceAccountId:'100',externalId,nativePostId:'200',source:'api:instagram',kind:'comment',text:'합성 댓글',status:'open',importedAt:at,updatedAt:at});
  const row=makeRow('item');store.put('socialInbox',row.id,row);
  const options={store,clock:()=>at,fetchImpl:()=>{throw Error('NETWORK_FORBIDDEN');}};
  const replies=createSocialReplies(options),marketing=createSocialMarketingService(options),inbox=user=>marketing.workspace(user,{posts:[],jobs:[]}).inbox;
  const attempt=(id,fields={})=>store.put('socialReplyAttempts',id,{id,inboxId:row.id,channelId:channel.id,sourceAccountId:'100',externalId:'300',status:'failed',...fields});
  return {store,member,viewer,other,channel,credentials,row,makeRow,replies,inbox,attempt};
}

test('a detached earlier attempt still blocks its original account and comment without exposing its record',t=>{
  const f=fixture(t);f.attempt('orphan',{inboxId:'removed-inbox',status:'submitting',leaseUntil:'2026-10-13T00:00:00.000Z'});
  f.attempt('foreign',{inboxId:'foreign-inbox',channelId:'foreign-channel',status:'submitting',leaseUntil:'2026-10-13T00:00:00.000Z'});
  f.attempt('wrong-account',{inboxId:'other-inbox',sourceAccountId:'999',externalId:'301',status:'unknown'});
  f.store.put('socialInbox','unblocked',f.makeRow('unblocked','301'));
  const result=f.replies.workspace(f.member),blocked=result.items.find(row=>row.inboxId==='item');
  assert.equal(blocked.canReply,false);assert.equal(blocked.canReconcile,true);assert.equal(blocked.latestAttempt,null);assert.deepEqual(result.attempts,[]);
  assert.equal(f.store.get('socialReplyAttempts','orphan').status,'unknown');assert.equal(f.store.get('socialReplyAttempts','foreign').status,'submitting');
  assert.equal(result.items.find(row=>row.inboxId==='unblocked').canReply,true);
  assert.equal(f.replies.workspace(f.viewer).items[0].canReconcile,false);
  assert.deepEqual(f.replies.workspace(f.other),{items:[],attempts:[]});
});

test('ordered local attempts and observed reply provenance survive grouping and remain private in marketing inbox',t=>{
  const f=fixture(t);f.attempt('sent',{status:'sent',remoteReplyId:'400'});f.attempt('failed-latest',{status:'failed'});
  f.store.put('socialInbox','item',{...f.row,metaReplyProofIds:['private-proof'],metaReplyCompleteAt:at,metaAccountReply:{private:'proof'},externalReplyEvidence:{source:'meta-read',method:'author-id-match',sourceAccountId:'100',connectionVersion:1,observedAt:at,replyIds:['400'],replyCount:1,latestReplyExternalId:'400',complete:true}});
  let result=f.replies.workspace(f.member);assert.equal(result.items[0].latestAttempt.id,'failed-latest');assert.equal(result.items[0].observedReply.knownLocal,true);assert.deepEqual(result.attempts.map(row=>row.id),['sent','failed-latest']);
  f.store.put('socialReplyAttempts','sent',{...f.store.get('socialReplyAttempts','sent'),status:'failed'});
  result=f.replies.workspace(f.member);assert.equal(result.items[0].observedReply.knownLocal,false);assert.equal(result.items[0].alreadyAnswered,true);
  const row=f.inbox(f.member)[0];assert.equal(row.effectiveStatus,'answered');assert.equal(row.canEdit,true);assert.ok(!('metaReplyProofIds' in row));assert.ok(!('metaReplyCompleteAt' in row));assert.ok(!('metaAccountReply' in row));
});

test('successive reads immediately reflect ownership, channel visibility, reconnect and user revocation',t=>{
  const f=fixture(t);assert.equal(f.replies.workspace(f.member).items[0].canReply,true);assert.equal(f.inbox(f.member).length,1);
  f.store.setSecret('channel:channel',{...f.credentials,scope:'instagram_business_basic'});assert.deepEqual(f.replies.workspace(f.member).items[0].missingScopes,['instagram_business_manage_comments']);
  f.store.setSecret('channel:channel',f.credentials);assert.equal(f.replies.workspace(f.member).items[0].canReply,true);
  for(const change of [{ownerIds:[]},{hidden:true},{active:false}]){
    f.store.put('channels','channel',{...f.channel,...change});assert.deepEqual(f.replies.workspace(f.member),{items:[],attempts:[]});assert.deepEqual(f.inbox(f.member),[]);
  }
  f.store.put('channels','channel',f.channel);assert.equal(f.replies.workspace(f.member).items.length,1);assert.equal(f.inbox(f.member).length,1);
  f.store.put('users','member',{...f.member,active:false});assert.deepEqual(f.replies.workspace(f.member),{items:[],attempts:[]});assert.throws(()=>f.inbox(f.member),{status:401});
});

test('identical external IDs on separate accounts retain independent blockers, credentials and visibility',t=>{
  const f=fixture(t),second={...f.channel,id:'second',externalId:'200'},privateChannel={...f.channel,id:'private',externalId:'300',ownerIds:[f.other.id],teamId:'other'};
  f.store.put('channels',second.id,second);f.store.put('channels',privateChannel.id,privateChannel);
  f.store.setSecret('channel:second',{...f.credentials,scope:'instagram_business_basic'});
  f.store.setSecret('channel:private',f.credentials);
  f.store.put('socialInbox','second-item',{...f.row,id:'second-item',channelId:'second',sourceAccountId:'200',updatedAt:'2026-10-14T04:01:00.000Z'});
  f.store.put('socialInbox','private-item',{...f.row,id:'private-item',channelId:'private',sourceAccountId:'300'});
  f.attempt('first-pending',{status:'unknown'});f.attempt('second-preparing',{inboxId:'second-item',channelId:'second',sourceAccountId:'200',status:'preparing',leaseUntil:'2026-10-13T00:00:00.000Z'});
  f.attempt('private-pending',{inboxId:'private-item',channelId:'private',sourceAccountId:'300',status:'submitting',leaseUntil:'2026-10-13T00:00:00.000Z'});
  let result=f.replies.workspace(f.member);assert.deepEqual(result.items.map(row=>row.inboxId),['item','second-item']);assert.equal(result.items[0].canReconcile,true);assert.deepEqual(result.items[0].missingScopes,[]);assert.deepEqual(result.items[1].missingScopes,['instagram_business_manage_comments']);assert.equal(result.items[1].latestAttempt.status,'failed');assert.equal(f.store.get('socialReplyAttempts','private-pending').status,'submitting');
  assert.deepEqual(f.inbox(f.member).map(row=>row.id),['second-item','item']);
  f.store.setSecret('channel:second',f.credentials);result=f.replies.workspace(f.member);assert.equal(result.items[0].canReply,false);assert.equal(result.items[1].canReply,true);
  f.store.remove('socialReplyAttempts','first-pending');assert.equal(f.replies.workspace(f.member).items[0].canReply,true);
});
