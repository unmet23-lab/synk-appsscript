import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';

const SOURCE='website-inquiry',SETTINGS='socialInquirySettings',RECEIPTS='socialInquiryReceipts',DAYS=90;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(value).digest('hex');
const secretId=id=>'social-inquiry:'+id;
const requestId=value=>{if(typeof value!=='string'||!/^[a-f0-9-]{36}$/i.test(value))throw fail('문의 접수 번호를 확인해 주세요.');return value;};
const text=(value,max)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('문의 내용을 확인해 주세요.');return value.trim();};

// Call only after the caller has checked the current channel permission.
export function websiteInquiryView(store,row,clock=()=>new Date().toISOString()){
  if(row?.source!==SOURCE)return row;
  const privateValue=Date.parse(row.createdAt)>Date.parse(clock())-DAYS*86400000?store.secret(secretId(row.id)):null;
  return {...row,author:privateValue?.name||'홈페이지 문의',
    text:privateValue?`${privateValue.message}\n\n답장 받을 이메일: ${privateValue.email}`:'보관 기간이 끝났거나 요청에 따라 삭제된 문의예요.'};
}

export function createSocialInquiries({store,tracking,clock=()=>new Date().toISOString()}){
  const limits=new Map();
  const config=()=>store.get(SETTINGS,'main')||{id:'main',revision:0,enabled:false,channelId:'',ownerId:''};
  function current(user,admin=false){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(admin&&live.role!=='admin')throw fail('문의 접수 설정은 관리자만 바꿀 수 있어요.',403);return live;}
  function destination(){const c=config(),channel=store.get('channels',c.channelId),owner=store.get('users',c.ownerId);return c.enabled&&channel&&channel.active!==false&&!channel.hidden&&owner?.active&&canWriteChannel(owner,channel)?{channel,owner}:null;}
  function settings(user){user=current(user);const c=config();return {revision:c.revision,enabled:c.enabled,channelId:c.channelId,retentionDays:DAYS,canConfigure:user.role==='admin',ready:!!destination()};}
  function configure(user,input={}){
    user=current(user,true);const old=config();if(input.revision!==old.revision)throw fail('문의 접수 설정이 바뀌었어요. 새로고침해 주세요.',409);
    if(typeof input.enabled!=='boolean'||typeof input.channelId!=='string'||Object.keys(input).some(k=>!['revision','enabled','channelId'].includes(k)))throw fail('문의 접수 설정을 확인해 주세요.');
    const channel=store.get('channels',input.channelId);
    if(input.enabled&&(!channel||channel.active===false||channel.hidden||!canWriteChannel(user,channel)))throw fail('접수할 계정을 선택해 주세요.',403);
    store.put(SETTINGS,'main',{id:'main',revision:old.revision+1,enabled:input.enabled,channelId:input.channelId,ownerId:user.id,updatedAt:clock()});
    return {inquiries:settings(user)};
  }
  function rate(client){
    const now=Date.parse(clock());
    for(const [key,value]of limits)if(value.until<=now)limits.delete(key);
    if(limits.size>5000)throw fail('문의 접수가 많아요. 잠시 후 다시 시도해 주세요.',429);
    for(const [key,max]of [[hash('client:'+client),5],['all',200]]){
      const value=limits.get(key)||{until:now+60000,count:0};
      if(value.count>=max)throw fail('문의가 여러 번 접수됐어요. 잠시 후 다시 시도해 주세요.',429);
      value.count++;limits.set(key,value);
    }
  }
  function originAllowed(origin){if(!tracking.allowOrigin(origin))throw fail('SYNK 홈페이지에서 접수해 주세요.',403);}
  function deletionToken(id){return createHmac('sha256',store.key).update('website-inquiry-delete\0'+id).digest('hex');}
  function receipt(row){return {ok:true,accepted:!row.deletedAt,deleted:!!row.deletedAt,receiptId:row.id,deleteToken:deletionToken(row.id),retentionDays:DAYS};}
  function erase(id){
    const row=store.get(RECEIPTS,id);
    if(!row)return;
    store.deleteSecret(secretId(id));store.remove('socialInbox',id);
    store.put(RECEIPTS,id,{id,createdAt:row.createdAt,deletedAt:row.deletedAt||clock()});
  }
  function prune(){
    const cutoff=Date.parse(clock())-DAYS*86400000;
    for(const row of store.all(RECEIPTS))if(Date.parse(row.createdAt)<cutoff){
      store.transaction(()=>{erase(row.id);store.remove(RECEIPTS,row.id);});
    }
  }
  function submit(input={},context={}){
    originAllowed(context.origin);rate(context.client||'');prune();
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['requestId','clickId','name','email','message','consent','website'].includes(k)))throw fail('문의 입력 항목을 확인해 주세요.');
    const reqId=requestId(input.requestId),id='web-'+hash(reqId);
    const value={name:text(input.name||'',120),email:text(input.email||'',254),message:text(input.message||'',4000)};
    if(input.consent!==true||!value.message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)||input.website)throw fail('답장 받을 이메일·문의 내용·수집 동의를 확인해 주세요.');
    const existing=store.get(RECEIPTS,id);
    if(existing){
      if(!existing.deletedAt){
        const old=store.secret(secretId(id));
        if(!old||JSON.stringify(old)!==JSON.stringify(value))throw fail('같은 접수 번호의 내용이 달라요. 새 문의로 접수해 주세요.',409);
        confirm(id);
      }
      return {...receipt(existing),duplicate:true};
    }
    const target=destination();if(!target)throw fail('직접 접수는 준비 중이에요. 기존 문의 양식을 이용해 주세요.',503);
    if(store.count(RECEIPTS)>=10000)throw fail('문의 접수 공간이 다 찼어요. 기존 문의 양식을 이용해 주세요.',503);
    let attribution=null;
    if(input.clickId){try{attribution=tracking.inquiryAttribution(input.clickId,context.origin);}catch(error){if(![400,403,404].includes(error.status))throw error;}}
    const channel=attribution?store.get('channels',attribution.channelId):target.channel;
    const assignee=attribution?store.get('users',attribution.ownerId):target.owner;
    const row={id,revision:1,channelId:channel.id,postId:attribution?.postId||'',kind:'message',author:'홈페이지 문의',
      text:'홈페이지에서 받은 문의예요. 권한이 있는 담당자가 문의함에서 원문을 확인할 수 있어요.',url:'',status:'open',assigneeId:assignee.id,
      replyDraft:'',source:SOURCE,outboundSent:false,createdBy:'website',createdAt:clock(),updatedAt:clock(),
      inquiryOrigin:context.origin,...(attribution?{inquiryClickId:input.clickId,inquiryTracking:'pending'}:{inquiryTracking:'unattributed'})};
    store.transaction(()=>{
      store.setSecret(secretId(id),value);
      store.put('socialInbox',id,row);
      store.put(RECEIPTS,id,{id,createdAt:row.createdAt});
      // The received inquiry survives an unavailable attribution sink. Retrying the same
      // receipt retries attribution, never creates a second inquiry.
      confirm(id);
    });
    return receipt(store.get(RECEIPTS,id));
  }
  function confirm(id){
    const row=store.get('socialInbox',id);if(!row?.inquiryClickId||row.inquiryTracking!=='pending')return;
    try{tracking.confirmInquiry(id);store.put('socialInbox',id,{...row,inquiryTracking:'verified'});}
    catch(error){if([400,403,404,409].includes(error.status))store.put('socialInbox',id,{...row,inquiryTracking:'unavailable'});}
  }
  function receiptId(input){
    const id=input.receiptId,provided=input.deleteToken;
    if(typeof id!=='string'||!/^web-[a-f0-9]{64}$/.test(id)||typeof provided!=='string'||!/^[a-f0-9]{64}$/.test(provided)||!timingSafeEqual(Buffer.from(provided,'hex'),Buffer.from(deletionToken(id),'hex')))throw fail('삭제할 문의 접수증을 확인해 주세요.',403);
    return id;
  }
  // The random request ID is a recovery capability. Only receipt metadata is returned,
  // never the contact information or message. It also resolves an uncertain POST result.
  function lookup(input={},context={}){
    originAllowed(context.origin);rate('receipt:'+(context.client||''));prune();
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['requestId','receiptId','deleteToken'].includes(k)))throw fail('접수증을 확인해 주세요.');
    const id=input.requestId?'web-'+hash(requestId(input.requestId)):receiptId(input),row=store.get(RECEIPTS,id);
    if(!row)return {ok:true,found:false,accepted:false,state:'unavailable'};
    return {...receipt(row),found:true,state:row.deletedAt?'deleted':'received'};
  }
  function remove(input={},context={}){
    originAllowed(context.origin);rate(context.client||'');
    const id=receiptId(input);
    store.transaction(()=>erase(id));return {ok:true,deleted:true};
  }
  function removeByStaff(user,id){user=current(user);const row=store.get('socialInbox',id),channel=store.get('channels',row?.channelId);if(row?.source!==SOURCE||!channel||channel.active===false||channel.hidden||!canReadChannel(user,channel)||!canWriteChannel(user,channel))throw fail('문의 삭제 권한을 확인해 주세요.',403);store.transaction(()=>erase(id));return {ok:true,deleted:true};}
  function status(origin){originAllowed(origin);return {enabled:!!destination(),retentionDays:DAYS};}
  function maintain(){prune();for(const row of store.all('socialInbox'))if(row.source===SOURCE&&row.inquiryTracking==='pending')confirm(row.id);}
  return {settings,configure,submit,lookup,remove,removeByStaff,status,maintain};
}
