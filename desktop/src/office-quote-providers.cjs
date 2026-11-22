'use strict';

const {bearer,fail,current,jsonRequest}=require('./office-mail-http.cjs');
const {assessThread,addresses,childId,clean}=require('./office-quote-thread.cjs');

const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me/threads';
const GRAPH='https://graph.microsoft.com/v1.0/me';
const MAX_ITEMS=24;
const values=(input,name)=>input.filter(v=>v?.name?.toLowerCase()===name).map(v=>String(v.value||'')).join(', ');
const graphAddresses=list=>(list||[]).map(v=>v?.emailAddress?.address?.toLowerCase()).filter(Boolean);
const autoHeaders=headers=>/^(?!no(?:\s|$)).+/i.test(values(headers,'auto-submitted').trim())||!!values(headers,'x-autoreply')||!!values(headers,'x-autorespond');
const bulkHeaders=headers=>!!values(headers,'list-unsubscribe')||!!values(headers,'list-id')||/\b(?:bulk|list|junk)\b/i.test(values(headers,'precedence'));
function htmlText(value) {
  return String(value||'').replace(/<(?:blockquote|div\b[^>]*(?:gmail_quote|divRplyFwdMsg))\b[\s\S]*$/i,'')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\b[^>]*>|<\/(?:p|div|li)>/gi,'\n')
    .replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi,s=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[s.toLowerCase()]);
}
function gmailText(part) {
  if(!part||part.filename||/^attachment\b/i.test(values(part.headers||[],'content-disposition')))return '';
  const mime=String(part.mimeType||'').toLowerCase();
  if(mime==='message/rfc822')return '';
  if(mime.startsWith('multipart/')){
    const parts=part.parts||[], plain=parts.find(x=>x.mimeType==='text/plain'&&!x.filename);
    if(mime==='multipart/alternative'&&plain)return gmailText(plain)||gmailText(parts.find(x=>x.mimeType==='text/html'));
    return parts.map(gmailText).filter(Boolean).join('\n').slice(0,24000);
  }
  if(!['text/plain','text/html'].includes(mime)||!part.body?.data)return '';
  const body=Buffer.from(part.body.data,'base64url').toString('utf8');
  return clean(mime==='text/html'?htmlText(body):body,24000);
}
function gmailMessage(m,address) {
  if(m.labelIds!=null&&!Array.isArray(m.labelIds)||!m.payload||!m.id||!m.internalDate||!Number.isFinite(Number(m.internalDate)))throw fail('MAIL_NETWORK');
  const h=m.payload.headers||[],labels=m.labelIds||[],from=values(h,'from'),senders=addresses(from);
  const to=addresses(values(h,'to')),cc=addresses(values(h,'cc')),bcc=addresses(values(h,'bcc'));
  const originals=addresses(values(h,'x-original-to')),delivered=addresses(values(h,'delivered-to'));
  const routed=delivered.includes(address)&&!cc.includes(address)&&to.some(v=>originals.includes(v));
  return {id:m.id,at:Number(m.internalDate),subject:values(h,'subject'),body:gmailText(m.payload),from,sender:senders[0],
    recipients:[...to,...cc,...bcc],replyTo:addresses(values(h,'reply-to')),
    direct:routed||to.some(value=>value===address||value.replace(/\+[^@]+(?=@)/,'')===address),inbox:labels.includes('INBOX'),
    outgoing:labels.includes('SENT')||senders.includes(address),draft:labels.includes('DRAFT'),excluded:labels.some(l=>['SPAM','TRASH'].includes(l)),
    automatic:autoHeaders(h),bulk:bulkHeaders(h)||labels.includes('CATEGORY_PROMOTIONS'),uncertain:senders.length!==1};
}
function graphMessage(m,address,folders) {
  const from=m.from?.emailAddress, sender=from?.address?.toLowerCase(), h=m.internetMessageHeaders||[];
  const to=graphAddresses(m.toRecipients),cc=graphAddresses(m.ccRecipients),bcc=graphAddresses(m.bccRecipients);
  const outgoing=m.parentFolderId===folders.sentitems||sender===address||m.sender?.emailAddress?.address?.toLowerCase()===address;
  const draft=m.isDraft||m.parentFolderId===folders.drafts||m.parentFolderId===folders.outbox;
  const at=Date.parse(draft?(m.lastModifiedDateTime||m.createdDateTime):(outgoing?m.sentDateTime:m.receivedDateTime)||m.createdDateTime);
  if(!m.id||!draft&&!Number.isFinite(at)||!m.parentFolderId||!Array.isArray(m.toRecipients)||typeof m.isDraft!=='boolean')throw fail('MAIL_NETWORK');
  const body=m.uniqueBody?.content?m.uniqueBody:m.body;
  return {id:m.id,at,from:from?.name?clean(from.name,120)+' <'+(sender||'')+'>':sender,sender,subject:m.subject,webLink:m.webLink,
    recipients:[...to,...cc,...bcc],replyTo:graphAddresses(m.replyTo),outgoing,direct:to.includes(address),inbox:m.parentFolderId===folders.inbox,draft,
    excluded:[folders.junkemail,folders.deleteditems].includes(m.parentFolderId),automatic:autoHeaders(h),bulk:bulkHeaders(h),uncertain:!sender,
    body:body?.contentType?.toLowerCase()==='html'?htmlText(body.content):body?.content||''};
}
function providerReader({provider,address,access,fetch,signal,renew,plan={}}) {
  address=address.toLowerCase();
  const gmail=provider==='gmail', headers=bearer(access);
  if(!gmail)headers.Prefer='IdType="ImmutableId", outlook.body-content-type="text"';
  async function get(url){
    try{return await jsonRequest(fetch,url,{headers},signal);}
    catch(e){
      if(e.code!=='MAIL_RECONNECT'||!renew)throw e;
      headers.Authorization='Bearer '+(await renew()).access;
      return jsonRequest(fetch,url,{headers},signal);
    }
  }
  const checked=url=>{
    let u;
    try{if(String(url).length>16384)throw new Error();u=new URL(url);}catch{throw fail('MAIL_NETWORK');}
    if(u.origin!=='https://graph.microsoft.com'||u.pathname!==new URL(GRAPH+'/messages').pathname||u.username||u.password||u.hash)throw fail('MAIL_NETWORK');
    return u;
  };
  async function* graphPages(url){
    const seen=new Set();
    while(url){
      const u=checked(url);if(seen.has(u.href))throw fail('MAIL_NETWORK');seen.add(u.href);
      const data=await get(u);
      if(!Array.isArray(data.value))throw fail('MAIL_NETWORK');
      yield data.value;url=data['@odata.nextLink'];
    }
  }
  let folderIds;
  const ancestors=new Map();
  async function folders(){
    if(!folderIds){
      const names=['sentitems','drafts','outbox','junkemail','deleteditems','inbox','msgfolderroot'];
      folderIds=Promise.all(names.map(async name=>{
        const d=await get(GRAPH+'/mailFolders/'+name+'?$select=id');
        if(!d.id)throw fail('MAIL_NETWORK');return [name,d.id];
      })).then(Object.fromEntries);
    }
    return folderIds;
  }
  async function rootFolder(id,f){
    if(!id||typeof id!=='string'||id.length>1800)throw fail('MAIL_NETWORK');
    if(Object.values(f).includes(id))return id;
    if(ancestors.has(id))return ancestors.get(id);
    const path=new Set();let curr=id;
    while(!Object.values(f).includes(curr)&&!ancestors.has(curr)){
      if(!curr||path.has(curr)||path.size>32)throw fail('MAIL_NETWORK');
      path.add(curr);
      const folder=await get(GRAPH+'/mailFolders/'+encodeURIComponent(curr)+'?$select=id,parentFolderId');
      if(folder.id!==curr||!folder.parentFolderId)throw fail('MAIL_NETWORK');
      curr=folder.parentFolderId;
    }
    const root=ancestors.get(curr)||curr;
    for(const child of path)ancestors.set(child,root);
    return root;
  }
  let position=null;
  async function* list(start){
    let offset=Number.isSafeInteger(start?.offset)&&start.offset>=0&&start.offset<=100?start.offset:0;
    let expected=start?.id;
    const midnight=s=>new Date(s+'T00:00:00');
    if(!gmail){
      const first=new URL(GRAPH+'/messages');first.searchParams.set('$top','100');first.searchParams.set('$select','conversationId');
      const dates=[];
      if(plan.after)dates.push('receivedDateTime ge '+midnight(plan.after).toISOString());
      if(plan.before)dates.push('receivedDateTime lt '+midnight(plan.before).toISOString());
      if(dates.length)first.searchParams.set('$filter',dates.join(' and '));
      let page=start?.page||first.href;
      const visited=new Set();
      while(page){
        const u=checked(page);if(visited.has(u.href))throw fail('MAIL_NETWORK');visited.add(u.href);
        position={page:u.href,offset};
        const d=await get(u);if(!Array.isArray(d.value))throw fail('MAIL_NETWORK');
        if(expected&&d.value[offset]?.conversationId!==expected)offset=0;
        expected=null;
        for(let i=offset;i<d.value.length;i++){
          position={page:u.href,offset:i,id:d.value[i].conversationId};
          if(!d.value[i].conversationId)throw fail('MAIL_NETWORK');
          yield d.value[i].conversationId;
        }
        offset=0;page=d['@odata.nextLink'];
      }
      return;
    }
    const u=new URL(GMAIL),tokens=new Set();u.searchParams.set('maxResults','100');u.searchParams.set('includeSpamTrash','false');
    const q=[];
    if(plan.after)q.push('after:'+(Math.floor(+midnight(plan.after)/1000)-1));
    if(plan.before)q.push('before:'+Math.floor(+midnight(plan.before)/1000));
    if(q.length)u.searchParams.set('q',q.join(' '));
    if(start?.page)u.searchParams.set('pageToken',start.page);
    do{
      position={page:u.searchParams.get('pageToken')||'',offset};
      const d=await get(u);
      if(d.threads!=null&&!Array.isArray(d.threads))throw fail('MAIL_NETWORK');
      if(expected&&d.threads?.[offset]?.id!==expected)offset=0;
      expected=null;
      for(let i=offset;i<(d.threads||[]).length;i++){
        position={page:u.searchParams.get('pageToken')||'',offset:i,id:d.threads[i].id};
        if(!d.threads[i].id)throw fail('MAIL_NETWORK');yield d.threads[i].id;
      }
      if(!d.nextPageToken)break;
      if(typeof d.nextPageToken!=='string'||d.nextPageToken.length>4096||tokens.has(d.nextPageToken))throw fail('MAIL_NETWORK');
      tokens.add(d.nextPageToken);u.searchParams.set('pageToken',d.nextPageToken);offset=0;
    }while(true);
  }
  async function thread(id){
    if(gmail){
      if(!/^[0-9a-f]{1,40}$/i.test(id))throw fail('MAIL_NETWORK');
      const d=await get(GMAIL+'/'+id+'?format=full&fields=id,messages(id,threadId,internalDate,labelIds,payload)');
      if(d.id!==id||!Array.isArray(d.messages)||!d.messages.length||d.messages.some(m=>m.threadId!==id))throw fail('MAIL_NETWORK');
      return assessThread(d.messages.map(m=>gmailMessage(m,address)));
    }
    if(typeof id!=='string'||!id.length||id.length>1024||/[\x00-\x1f]/.test(id))throw fail('MAIL_NETWORK');
    const f=await folders(),u=new URL(GRAPH+'/messages');u.searchParams.set('$top','30');
    u.searchParams.set('$filter',"conversationId eq '"+id.replace(/'/g,"''")+"'");
    u.searchParams.set('$select','id,conversationId,subject,from,sender,replyTo,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,createdDateTime,lastModifiedDateTime,parentFolderId,isDraft,uniqueBody,body,internetMessageHeaders,webLink');
    const messages=[];
    for await(const page of graphPages(u))for(const m of page){
      if(m.conversationId!==id)throw fail('MAIL_NETWORK');
      const root=await rootFolder(m.parentFolderId,f),item=graphMessage({...m,parentFolderId:root},address,f);
      item.inbox=m.parentFolderId===f.inbox;
      messages.push(item);
    }
    return assessThread(messages);
  }
  return {list,thread,position:()=>position};
}
function eligible(item,plan) {
  const date=new Date(item.at);
  const local=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const text=(item.subject+' '+(item.authored||item.evidence)).toLowerCase();
  return plan.folder!=='sent'&&(plan.folder!=='inbox'||item.inbox)&&(!plan.after||local>=plan.after)&&(!plan.before||local<plan.before)&&(!plan.from||item.from.toLowerCase().includes(plan.from.toLowerCase()))
    &&(plan.terms||[]).every(t=>text.includes(t.toLowerCase()));
}
function evidence(ctx,threadId,item){
  return {id:childId(ctx.provider,ctx.subject,threadId,item.id),threadId,messageId:item.id,sourceId:item.sourceId,
    subject:item.subject||'(제목 없음)',from:item.from,date:item.date,evidence:item.evidence,snippet:item.evidence,webLink:item.webLink};
}
async function scanQuotes(ctx){
  const reader=providerReader(ctx),seen=new Set(),fresh=[],prior=[],known=ctx.known||new Set();
  let eligibleCount=0,newCount=0,review=0,drafts=0,checked=0,code,cursor=null,firstOmitted=null,unread=null;
  try{
    for await(const id of reader.list(ctx.start)){
      current(ctx.signal);if(seen.has(id))continue;seen.add(id);
      let result;
      try{result=await reader.thread(id);checked++;}catch(e){
        if(e.code==='MAIL_NOT_FOUND'){review++;continue;}
        if(e.code==='MAIL_NETWORK'){code='MAIL_NETWORK';unread??=reader.position();review++;continue;}
        throw e;
      }
      if(result.state==='review'){review++;continue;}
      if(result.state==='draft'){drafts++;continue;}
      if(result.state!=='open'||!eligible(result.item,ctx.plan))continue;
      const item=evidence(ctx,id,result.item);eligibleCount++;
      const items=known.has(item.id)?prior:fresh;
      if(items===fresh)newCount++;
      if(items.length<MAX_ITEMS)items.push(item);
      else if(items===fresh){firstOmitted=reader.position();checked--;break;}
    }
  }catch(e){
    if(!['MAIL_NETWORK','MAIL_LIMIT','MAIL_RECONNECT'].includes(e.code))throw e;
    if(ctx.start&&!checked&&e.code==='MAIL_NETWORK')return scanQuotes({...ctx,start:null});
    if(!seen.size&&!ctx.start)throw e;
    code=e.code;cursor=reader.position();
  }
  const items=[...fresh,...prior].slice(0,MAX_ITEMS);
  const remaining=newCount-fresh.length;
  cursor=unread||firstOmitted||cursor;
  return {items,checked,review,drafts,eligibleCount,remaining,more:remaining>0||!!code,
    ...(code?{code}:{}),...(cursor?{cursor}:{}),...(ctx.start?{resumed:true}:{})};
}
async function confirmQuote(ctx,source) {
  const result=await providerReader(ctx).thread(source.threadId);
  return result.state==='open'?{state:'open',item:evidence(ctx,source.threadId,result.item)}:result;
}
module.exports={scanQuotes,confirmQuote};
