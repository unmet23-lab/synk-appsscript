'use strict';
const {createHash}=require('node:crypto');
const {fail}=require('./office-mail-http.cjs');

const LIMIT=10;
const PAGES_PER_READ=5;
const hash=value=>createHash('sha256').update(value).digest('base64url');
const gmailId=id=>typeof id==='string'&&/^[0-9a-f]{1,40}$/i.test(id);
const graphId=id=>typeof id==='string'&&id.length>0&&id.length<=2048&&!/[\s\x00-\x1f\x7f]/u.test(id);
const token=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\s\x00-\x1f\x7f]/u.test(value);
const transient=code=>['MAIL_NETWORK','MAIL_NOT_FOUND','MAIL_LIMIT'].includes(code);

function outlookOriginal(item){
  try{
    const u=new URL(item.webLink);
    if(u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['outlook.live.com','outlook.office.com','outlook.office365.com','outlook.cloud.microsoft'].includes(u.hostname)&&/^\/(?:owa|mail)(?:\/|$)/i.test(u.pathname))return u;
  }catch{}
  return null;
}
function legacyKey(item){
  const u=outlookOriginal(item);
  if(!u)return null;
  let id;
  for(const [name,value] of [...u.searchParams,...new URLSearchParams(u.hash.slice(1))])if(name.toLowerCase()==='itemid')id=value;
  if(!id){
    const encoded=/\/(?:id|deeplink\/read)\/([^/]+)\/?$/iu.exec(u.pathname)?.[1];
    if(encoded)try{id=decodeURIComponent(encoded);}catch{}
  }
  return graphId(id)?id:null;
}
function identities(provider,previous,migrated=[]){
  if(!Array.isArray(migrated)||migrated.length>previous.length||!migrated.every(graphId))throw fail('MAIL_PAGE_RESTART');
  const verified=new Set(migrated),ids=new Set(verified),legacy=new Set();
  for(const item of previous){
    if(provider==='gmail'&&gmailId(item?.sourceId))ids.add(item.sourceId.toLowerCase());
    else if(provider==='outlook'&&graphId(item?.graphId))ids.add(item.graphId);
    else if(provider==='outlook'&&legacyKey(item))legacy.add(legacyKey(item));
    else throw fail('MAIL_PAGE_RESTART');
  }
  const unverified=new Set(legacy);
  return {ids,unverified,verified,has(item){
    if(provider==='gmail')return ids.has(item.sourceId.toLowerCase());
    if(legacy.size){
      const key=legacyKey(item);
      if(legacy.has(key)){unverified.delete(key);ids.add(item.graphId);verified.add(item.graphId);return true;}
    }
    return ids.has(item.graphId);
  },add(item){ids.add(provider==='gmail'?item.sourceId.toLowerCase():item.graphId);}};
}
function paging(provider,address,plan,asOf,cursor,names){
  const scope=hash(JSON.stringify([provider,(address||'').toLowerCase(),plan.terms,plan.from,plan.after,plan.before,plan.folder,plan.attachment||'',asOf||'']));
  if(cursor!=null&&(cursor.v!==1||cursor.scope!==scope||!cursor.streams))throw fail('MAIL_CHANGED');
  const streams={};
  for(const name of names){
    const s=cursor?.streams[name];
    if(cursor&&(s==null||s.next!==null&&typeof s.next!=='string'||!Array.isArray(s.pending)||!Array.isArray(s.history)))throw fail('MAIL_PAGE_RESTART');
    streams[name]=s?structuredClone(s):{next:'',pending:[],history:[]};
  }
  return {v:1,scope,streams};
}
function numericGraphOffset(u){
  return [...u.searchParams].some(([key,v])=>/^\$?skip$/iu.test(key)&&/^\d+$/u.test(v));
}
function nextGraphLink(raw,base){
  if(typeof raw!=='string'||!raw||raw.length>16384||/[\\\x00-\x20]|(?:^|\/)(?:\.|%2e){1,2}(?:\/|\?|$)/iu.test(raw.split('?')[0]))throw fail('MAIL_NETWORK');
  let u,decoded;
  try{u=new URL(raw,base);decoded=decodeURIComponent(u.pathname);}catch{throw fail('MAIL_NETWORK');}
  if(u.origin!==base.origin||u.username||u.password||u.hash||/%2f|%5c/iu.test(u.pathname)||decoded.toLowerCase()!==base.pathname.toLowerCase())throw fail('MAIL_NETWORK');
  // The server owns the paging parameter. Any repeated query options must be the original
  // projection and search. This prevents a changed link from requesting bodies or a wider search.
  let continuation=false;
  const parameters=new Set();
  for(const [key,value] of u.searchParams){
    const normalized=key.toLowerCase();
    if(parameters.has(normalized))throw fail('MAIL_NETWORK');
    parameters.add(normalized);
    if(['$skiptoken','$skip','skip','page'].includes(key.toLowerCase())){
      if(!value||value.length>16384)throw fail('MAIL_NETWORK');
      continuation=true;
    }else if(!base.searchParams.has(key)||base.searchParams.get(key)!==value)throw fail('MAIL_NETWORK');
  }
  if(!continuation)throw fail('MAIL_NETWORK');
  // A numeric offset is not an opaque query token. The original query and field
  // selection must accompany it, otherwise Graph would execute a different search.
  if(numericGraphOffset(u)&&(parameters.has('$skiptoken')||[...base.searchParams].some(([k,v])=>k!=='$top'&&u.searchParams.get(k)!==v)))throw fail('MAIL_NETWORK');
  return u.href;
}
function advance(s,current,next){
  const visited=hash(current);
  if(next!==null && (next===current||s.history.includes(hash(next))))throw fail('MAIL_NETWORK');
  s.history.push(visited);
  // Bound a corrupt server's history without capping the number of result pages.
  if(s.history.length>32)s.history.shift();
  s.next=next;
}
function expired(error){
  return error.code==='MAIL_NOT_FOUND'||error.code==='MAIL_NETWORK'&&[400,410].includes(error.httpStatus);
}
module.exports={LIMIT,PAGES_PER_READ,gmailId,graphId,token,transient,outlookOriginal,identities,paging,nextGraphLink,numericGraphOffset,advance,expired};
