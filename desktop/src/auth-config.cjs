'use strict';
const crypto=require('node:crypto');
const IDS=['platform','world','messenger','teacher','fortune','care','path'];
function configuration(value,clientId,mode){
  if(value==null)return null;
  const fail=()=>{throw Object.assign(new Error('공개 로그인 설정을 확인해 주세요.'),{code:'AUTH_CONFIG_INVALID'});};
  if(value.version!==1||!IDS.includes(clientId)||Object.keys(value).some(k=>!['version','supabaseUrl','accountApiUrl','supabasePublishableKey','clients'].includes(k)))fail();
  const url=value=>{try{const u=new URL(value);if(u.username||u.password||u.hash||u.search||u.pathname!=='/'||!(u.protocol==='https:'||mode==='development'&&u.protocol==='http:'&&u.hostname==='127.0.0.1'))fail();return u.origin;}catch{fail();}};
  const supabaseUrl=url(value.supabaseUrl),accountApiUrl=url(value.accountApiUrl||value.supabaseUrl),key=value.supabasePublishableKey;
  if(typeof key!=='string'||key.length>4096||key.startsWith('sb_secret_'))fail();
  if(!key.startsWith('sb_publishable_')){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')fail();}catch{fail();}}
  if(!value.clients||Object.keys(value.clients).some(id=>!IDS.includes(id)))fail();
  const seenIds=new Set(),seenCallbacks=new Set();
  for(const [id,c]of Object.entries(value.clients)){
    if(!c||Object.keys(c).some(k=>!['clientId','redirectUri'].includes(k))||typeof c.clientId!=='string'||!c.clientId||c.clientId.length>256)fail();
    let redirect;try{redirect=new URL(c.redirectUri);}catch{fail();}
    if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||!redirect.port||Number(redirect.port)<1024||redirect.username||redirect.password||redirect.search||redirect.hash||redirect.pathname!==`/synk/oauth/${id}/callback`)fail();
    if(seenIds.has(c.clientId)||seenCallbacks.has(redirect.href))fail();seenIds.add(c.clientId);seenCallbacks.add(redirect.href);
  }
  if(!value.clients[clientId])fail();
  // Teacher, Fortune and Care own separate OAuth registrations and encrypted vaults.
  // Their API products remain WORLD and platform; the server decides permissions.
  const product=clientId==='teacher'?'world':['fortune','care','path'].includes(clientId)?'platform':clientId;
  const selected={version:1,supabaseUrl,accountApiUrl,publishableKey:key,clientId:value.clients[clientId].clientId,redirectUri:value.clients[clientId].redirectUri,product,...(['teacher','fortune','care','path'].includes(clientId)?{clientKey:clientId}:{})};
  // Platform's fixed route key is derived from this client selection. Keep its
  // existing vault binding; every OAuth identity field still participates above.
  return Object.freeze({...selected,...(['platform','world'].includes(clientId)?{clientKey:clientId}:{}),fingerprint:crypto.createHash('sha256').update(JSON.stringify(selected)).digest('hex')});
}
module.exports={configuration};
