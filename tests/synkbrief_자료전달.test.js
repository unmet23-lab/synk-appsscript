const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname,'../엔진_synkbrief.js'),'utf8');
function fixture(overrides = {}, response = () => ({getResponseCode:()=>200,getContentText:()=>'{"message_id":"sent"}'})) {
  const values = new Map(Object.entries({상담AI_URL키:'secret', SYNKBRIEF_IG_ID:'brief-id', SYNKBRIEF_IG_TOKEN:'IGAA_test_valid_abcdefghijklmnopqrstuvwxyz12345',SYNKBRIEF_DM_ENABLED:'1',SYNKBRIEF_CAMPAIGN_INDEX:'["meeting"]',SYNKBRIEF_CAMPAIGN_meeting:JSON.stringify({id:'meeting',mediaId:'12345',keyword:'synk',url:'https://synk.im/brief/meeting/',message:'회의 정리 자료',enabled:true}),SYNKBRIEF_DIRECT_CAMPAIGN:'meeting',...overrides}));
  const calls = [];const context = vm.createContext({console,Date,Session:{getActiveUser:()=>({getEmail:()=> 'owner@example.test'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>values.get(k),setProperties:o=>Object.entries(o).forEach(([k,v])=>values.set(k,v)),setProperty:(k,v)=>values.set(k,v),getProperties:()=>Object.fromEntries(values),deleteProperty:k=>values.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(value).digest())},UrlFetchApp:{fetch:(url,args)=>{calls.push({url,args});return response();}}});
  vm.runInContext(source, context);return {context,calls,values,run:(body,key='secret')=>context.synkbrief_웹훅_({parameter:{k:key}},body)};
}
function comment(text='SYNK 부탁해요',media='12345',account='brief-id') {return {object:'instagram',entry:[{id:account,time:Math.floor(Date.now()/1000),changes:[{field:'comments',value:{id:'comment-1',text,from:{id:'viewer'},media:{id:media}}}]}]};}
test('정확한 키워드·계정·게시물에만 댓글 비공개 답장을 한 번 보낸다',()=>{const f=fixture();assert.equal(f.run(comment()).sent,1);assert.equal(f.run(comment()).skipped,1);assert.equal(f.calls.length,1);const body=JSON.parse(f.calls[0].args.payload);assert.equal(body.recipient.comment_id,'comment-1');assert.match(body.message.text,/https:\/\/synk.im\/brief\/meeting\//);assert.match(f.calls[0].url,/graph.instagram.com\/v26.0\/brief-id\/messages/);});
test('다른 계정과 게시물·부분 단어는 발송하지 않는다',()=>{const f=fixture();assert.equal(f.run(comment('synk','12345','lab-id')),null);f.run(comment('synk','unrelated'));f.run(comment('asynk'));f.run(comment('synkbrief'));assert.equal(f.calls.length,0);});
test('인증·활성화·토큰 누락은 닫힌 상태다',()=>{assert.equal(fixture().run(comment(),'wrong').error,'unauthorized');const off=fixture({SYNKBRIEF_DM_ENABLED:'0'});off.run(comment());assert.equal(off.calls.length,0);const noToken=fixture({SYNKBRIEF_IG_TOKEN:''});assert.equal(noToken.run(comment()).error,'synkbrief-token-missing');});
test('오래된 댓글과 자기 댓글은 보내지 않는다',()=>{const f=fixture(),old=comment();old.entry[0].time-=8*86400;f.run(old);const own=comment();own.entry[0].changes[0].value.from.id='brief-id';f.run(own);assert.equal(f.calls.length,0);});
test('전송 실패와 응답 유실은 자동 중복 재전송하지 않는다',()=>{const f=fixture({},()=>{throw Error('private token details')});assert.equal(f.run(comment()).failed,1);assert.equal(f.run(comment()).skipped,1);assert.equal(f.calls.length,1);assert.doesNotMatch(JSON.stringify([...f.values]),/private token details/);});
test('한 사람이 여러 댓글을 달아도 이번 자료를 반복 발송하지 않는다',()=>{const f=fixture();f.run(comment());const second=comment();second.entry[0].changes[0].value.id='comment-2';f.run(second);assert.equal(f.calls.length,1);});
test('직접 요청한 DM만 명시 설정 뒤 응답한다',()=>{const body={object:'instagram',entry:[{id:'brief-id',messaging:[{sender:{id:'viewer'},recipient:{id:'brief-id'},timestamp:Date.now(),message:{mid:'dm-1',text:'synk'}}]}]};const off=fixture();off.run(body);assert.equal(off.calls.length,0);const on=fixture({SYNKBRIEF_DM_KEYWORD_ENABLED:'1'});assert.equal(on.run(body).sent,1);assert.equal(JSON.parse(on.calls[0].args.payload).recipient.id,'viewer');});

test('다음 편은 같은 요청자라도 해당 편 자료를 받는다',()=>{
  const f=fixture({SYNKBRIEF_CAMPAIGN_INDEX:'["meeting","next"]',SYNKBRIEF_CAMPAIGN_next:JSON.stringify({id:'next',mediaId:'67890',keyword:'synk',url:'https://synk.im/brief/next/',message:'다음 편 자료',enabled:true})});
  f.run(comment());const second=comment('synk','67890');second.entry[0].changes[0].value.id='comment-next';
  assert.equal(f.run(second).sent,1);assert.match(JSON.parse(f.calls[1].args.payload).message.text,/brief\/next/);assert.doesNotMatch(JSON.parse(f.calls[1].args.payload).message.text,/brief\/meeting/);
});
test('등록이 없거나 손상되면 전체 게시물로 확장하지 않는다',()=>{
  for(const index of ['[]','bad','{}']){const f=fixture({SYNKBRIEF_CAMPAIGN_INDEX:index});assert.equal(f.run(comment()).sent,0);assert.equal(f.calls.length,0);}
});
test('관리자 로그인 없는 인증 교체는 거절한다',()=>{
  const f=fixture();f.context.Session.getActiveUser=()=>({getEmail:()=>''});
  assert.throws(()=>f.context.synkbrief인증저장('IGAA_abcdefghijklmnopqrstuvwxyz123456789'),/관리자/);assert.equal(f.calls.length,0);
});
test('다른 계정 토큰과 API 실패는 기존 인증을 덮어쓰지 않는다',()=>{
  for(const result of [{user_id:'different',username:'synk.mn'},{user_id:'17841433358976667',username:'wrong'}]){
    const f=fixture({},()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(result)}));const old=f.values.get('SYNKBRIEF_IG_TOKEN');
    assert.throws(()=>f.context.synkbrief인증저장('IGAA_abcdefghijklmnopqrstuvwxyz123456789'),/전용/);assert.equal(f.values.get('SYNKBRIEF_IG_TOKEN'),old);
  }
});
test('올바른 계정 인증 저장은 발송을 켜지 않고 비밀값을 반환하지 않는다',()=>{
  const f=fixture({},()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({user_id:'17841433358976667',username:'synkbrief'})}));
  const r=f.context.synkbrief인증저장('IGAA_abcdefghijklmnopqrstuvwxyz123456789');assert.equal(r.configured,true);assert.equal(f.values.get('SYNKBRIEF_DM_ENABLED'),'0');assert.doesNotMatch(JSON.stringify(r),/IGAA/);
});
test('새 토큰은 계정만 확인하고 일주일 뒤에 갱신한다',()=>{
  const f=fixture({SYNKBRIEF_TOKEN_SAVED_AT:new Date().toISOString()},()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({user_id:'17841433358976667',username:'synkbrief'})}));
  f.context.synkbrief정기점검();assert.equal(f.calls.length,1);assert.doesNotMatch(f.calls[0].url,/refresh_access_token/);
});
test('자동 갱신 실패는 기존 토큰 보존 및 비밀값 없는 오류를 남긴다',()=>{
  const f=fixture({SYNKBRIEF_TOKEN_SAVED_AT:new Date(Date.now()-8*86400000).toISOString()});let n=0;
  f.context.UrlFetchApp.fetch=()=>{if(n++===0)return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({user_id:'17841433358976667',username:'synkbrief'})};throw Error('secret-in-error');};
  const old=f.values.get('SYNKBRIEF_IG_TOKEN');assert.throws(()=>f.context.synkbrief정기점검(),/갱신 실패/);assert.equal(f.values.get('SYNKBRIEF_IG_TOKEN'),old);assert.doesNotMatch(f.values.get('SYNKBRIEF_HEALTH'),/secret-in-error/);
});

function registryFixture(rows, media) {
  const f=fixture({},()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({data:media})}));
  const sheet={getLastRow:()=>rows.length+1,getRange:(r,c)=>({getValues:()=>rows,setValues:()=>{}})};
  f.values.set('SYNKBRIEF_ADMIN_SHEET_ID','admin');
  f.context.SpreadsheetApp={openById:()=>({getSheetByName:()=>sheet}),getUi:()=>({alert(){}})};
  return f;
}
test('관리표는 본인 게시물 링크를 검증해서 등록한다',()=>{
  const f=registryFixture([['next','다음 편','https://www.instagram.com/reel/Next_1/?x=1','synk','https://synk.im/brief/next/','다음 자료',true,'']], [{id:'67890',permalink:'https://www.instagram.com/reel/Next_1/'}]);
  f.context.synkbrief등록적용();assert.deepEqual(JSON.parse(f.values.get('SYNKBRIEF_CAMPAIGN_INDEX')),['next']);assert.equal(JSON.parse(f.values.get('SYNKBRIEF_CAMPAIGN_next')).mediaId,'67890');
});
test('다른 계정 게시물이나 중복 등록 오류는 기존 운영 자료를 보존한다',()=>{
  const row=['next','다음 편','https://www.instagram.com/reel/Other/','synk','https://synk.im/brief/next/','다음 자료',true,''];
  const f=registryFixture([row],[]);assert.throws(()=>f.context.synkbrief등록적용(),/수정/);assert.equal(f.values.get('SYNKBRIEF_CAMPAIGN_INDEX'),'["meeting"]');
});
test('게시 전 초안은 발송 자료로 등록하지 않는다',()=>{
  const f=registryFixture([['draft','초안','','synk','https://synk.im/brief/meeting/','자료',false,'']],[]);
  f.context.synkbrief등록적용();assert.equal(f.values.get('SYNKBRIEF_CAMPAIGN_INDEX'),'[]');assert.equal(f.calls.length,0);
});
