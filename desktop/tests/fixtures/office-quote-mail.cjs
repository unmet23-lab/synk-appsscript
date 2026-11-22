'use strict';

const assert = require('node:assert/strict');

const office = 'studio@example.test';
const customer = 'customer@example.test';
const other = 'other@example.test';
const firstDate = Date.parse('2026-11-01T08:00:00Z');
const label = {inbox:'INBOX', sentitems:'SENT', drafts:'DRAFT', junkemail:'SPAM', deleteditems:'TRASH'};
const person = address => ({emailAddress:{address}});
const folderId = folder => 'folder-' + folder;

function gmailMessage(message) {
  const {id, thread, folder, at, from, to, subject, body, unread} = message;
  const headers = Object.entries({From:from, To:to, Subject:subject,...(message.replyTo?{'Reply-To':message.replyTo}:{})}).map(([name,value])=>({name,value}));
  return {
    id, threadId:thread, internalDate:String(at), labelIds:[label[folder], ...(unread?['UNREAD']:[])],
    payload:{mimeType:'text/plain',headers,body:{data:Buffer.from(body).toString('base64url')}}
  };
}

function graphMessage(message) {
  const {id, thread, folder, at, from, to, subject, body, unread} = message;
  return {
    id, conversationId:thread, parentFolderId:folderId(folder), isDraft:folder==='drafts', isRead:!unread,
    from:person(from), sender:person(from), toRecipients:[person(to)], ccRecipients:[], bccRecipients:[], replyTo:message.replyTo?[person(message.replyTo)]:[],
    receivedDateTime:new Date(at).toISOString(), sentDateTime:folder==='drafts'?null:new Date(at).toISOString(),
    createdDateTime:new Date(at).toISOString(), lastModifiedDateTime:new Date(message.modifiedAt??at).toISOString(),
    subject, uniqueBody:{contentType:'text',content:body}, internetMessageHeaders:[],
    webLink:'https://outlook.live.com/mail/0/inbox/id/'+id
  };
}

function quoteMailbox(provider) {
  const messages = [], requests = [];
  let blocked = false, access = 'sample';
  const add = (thread, subject, body, {folder='inbox', from, to, replyTo, unread=false}={}) => {
    const outgoing = ['sentitems','drafts'].includes(folder);
    const index = messages.length;
    const item = {id:(4096+index).toString(16), thread, folder, subject, body, unread, replyTo,
      at:firstDate+index*60000, from:from || (outgoing?office:customer), to:to || (outgoing?customer:office)};
    messages.push(item);
    return item;
  };

  // Two entries per page make a reply and a new question cross the Graph page boundary.
  function paged(items, url, key, continuation) {
    const offset = Number(url.searchParams.get(continuation) || 0);
    const response = {[key]:items.slice(offset,offset+2)};
    if(offset+2<items.length){
      if(provider==='gmail')response.nextPageToken=String(offset+2);
      else {const next=new URL(url);next.searchParams.set(continuation,String(offset+2));response['@odata.nextLink']=next.href;}
    }
    return Response.json(response);
  }

  async function fetch(raw, options={}) {
    const url = new URL(raw), query = url.searchParams;
    assert.equal(options.method || 'GET','GET');
    const authorization=new Headers(options.headers).get('authorization');
    requests.push({path:url.pathname,query,authorization});
    if(authorization!=='Bearer '+access)return Response.json({error:{code:'InvalidAuthenticationToken'}},{status:401});
    if(blocked && (query.has('pageToken') || query.has('$skiptoken'))){
      return Response.json({error:{code:'rateLimitExceeded'}},{status:429});
    }
    if(provider==='gmail'){
      assert.equal(url.origin,'https://gmail.googleapis.com');
      const base='/gmail/v1/users/me/threads';
      if(url.pathname===base)return paged([...new Set(messages.map(m=>m.thread))].map(id=>({id})),url,'threads','pageToken');
      const id=url.pathname.slice(base.length+1);
      assert.ok(url.pathname.startsWith(base+'/'));assert.equal(query.get('format'),'full');
      return Response.json({id,messages:messages.filter(m=>m.thread===id).map(gmailMessage)});
    }
    assert.equal(url.origin,'https://graph.microsoft.com');
    const folder=url.pathname.match(/^\/v1\.0\/me\/mailFolders\/(sentitems|drafts|outbox|junkemail|deleteditems|inbox|msgfolderroot)$/);
    if(folder)return Response.json({id:folderId(folder[1])});
    const childFolder=url.pathname.match(/^\/v1\.0\/me\/mailFolders\/folder-(inbox|junkemail)-child$/);
    if(childFolder)return Response.json({id:folderId(childFolder[1]+'-child'),parentFolderId:folderId(childFolder[1])});
    assert.equal(url.pathname,'/v1.0/me/messages');
    const filter=query.get('$filter'), group=filter && /^conversationId eq '([^']+)'$/.exec(filter);
    if(filter)assert.ok(group,'The synthetic server expects a conversation filter');
    const select=query.get('$select').split(',');
    const rows=messages.filter(m=>!group || m.thread===group[1]).map(graphMessage).map(row=>
      Object.fromEntries(select.filter(k=>k in row).map(k=>[k,row[k]])));
    return paged(rows,url,'value','$skiptoken');
  }

  return {add,requests,blockNextPage(value=true){blocked=value;},expireAccess(){access='renewed-sample';},
    context:{provider,address:office,subject:'fixture-'+provider,access:'sample',fetch,signal:new AbortController().signal,plan:{}}};
}

module.exports = {quoteMailbox, customer, other};

