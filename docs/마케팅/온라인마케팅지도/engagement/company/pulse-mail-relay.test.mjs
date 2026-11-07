import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import vm from 'node:vm';

// 판 2 메일 중계(founder@synk.im 소유 Apps Script)를 Node vm에서 가짜 Apps Script 서비스로 돌린다.
const source=readFileSync(new URL('./pulse-mail-relay/relay.gs',import.meta.url),'utf8');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const nHex=Buffer.from(publicKey.export({format:'jwk'}).n,'base64url').toString('hex');
const signed=bytes=>[...bytes].map(b=>b>127?b-256:b);

function relay({key=nHex,quota=100,mailFails=false,lock=true}={}){
  const props=new Map(key?[['SERVER_KEY_N',key]]:[]),sent=[];
  const context={
    BigInt,JSON,Math,Number,String,Date,isFinite,parseInt,
    Utilities:{
      DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
      base64Decode:value=>{if(!/^[A-Za-z0-9+/=]*$/.test(value))throw new Error('bad');return signed(Buffer.from(value,'base64'));},
      computeDigest:(alg,value)=>{assert.equal(alg,'SHA_256');return signed(createHash('sha256').update(value,'utf8').digest());},
      formatDate:(date,tz,fmt)=>{assert.equal(tz,'Asia/Seoul');assert.equal(fmt,'yyyyMMdd');return new Date(date.getTime()+9*3600000).toISOString().slice(0,10).replaceAll('-','');},
    },
    PropertiesService:{getScriptProperties:()=>({getProperty:name=>props.has(name)?props.get(name):null,setProperty:(name,value)=>props.set(name,String(value)),deleteProperty:name=>props.delete(name),getProperties:()=>Object.fromEntries(props)})},
    LockService:{getScriptLock:()=>({tryLock:()=>lock,releaseLock:()=>{}})},
    MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:message=>{if(mailFails)throw new Error('quota');sent.push(JSON.parse(JSON.stringify(message)));}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
  };
  vm.createContext(context);vm.runInContext(source,context);
  const post=body=>JSON.parse(context.doPost({postData:{contents:typeof body==='string'?body:JSON.stringify(body)}}).text);
  return {post,props,sent,context};
}
const NOW=Date.parse('2026-11-08T05:00:00Z');
function request({op='send',key='p1:direction_proposed:0123456789ab',ts=NOW,to='client@example.com',subject='〔SYNK PULSE〕 오미톡 광고, 방향을 골라 주세요',body='오미톡님, SYNK PULSE입니다.\n\n본문',tamper}={}){
  const fields=op==='ping'?['','','','']:[key,to,subject,body];
  const message=JSON.stringify(['pulse-mail/v1',op,...fields.slice(0,1),ts,...fields.slice(1)]);
  const sig=sign('sha256',Buffer.from(message,'utf8'),privateKey).toString('base64');
  return {v:1,op,ts,sig,...(op==='send'?{key,to,subject,body}:{}),...tamper};
}
const at=(r,now=NOW)=>{const realNow=Date.now;Date.now=()=>now;try{return r();}finally{Date.now=realNow;}};

test('중계: 서명한 ping은 판 번호와 남은 몫을 돌려준다',()=>{
  const r=relay();const answer=at(()=>r.post(request({op:'ping'})));
  assert.deepEqual(answer,{ok:true,status:'ok',remaining:100,version:1});
});

test('중계: 서명한 메일은 한 번만 보내고, 보낼 이름 · 답장 주소는 중계가 박는다',()=>{
  const r=relay();
  assert.equal(at(()=>r.post(request())).status,'sent');
  assert.equal(at(()=>r.post(request({ts:NOW+60000}))).status,'duplicate');
  assert.equal(r.sent.length,1);
  assert.deepEqual(r.sent[0],{to:'client@example.com',subject:'〔SYNK PULSE〕 오미톡 광고, 방향을 골라 주세요',body:'오미톡님, SYNK PULSE입니다.\n\n본문',name:'SYNK PULSE',replyTo:'hello@synk.im'});
  assert.match(r.props.get('k:p1:direction_proposed:0123456789ab'),/^sent:\d+$/);
  // 요청에 보낼 이름 · 답장 주소를 넣어도 듣지 않는다.
  at(()=>r.post({...request({key:'p1:final_ready:0123456789ab'}),name:'Someone',replyTo:'x@evil.test'}));
  assert.equal(r.sent[1].replyTo,'hello@synk.im');assert.equal(r.sent[1].name,'SYNK PULSE');
});

test('중계: 서명 · 시각 · 공개 열쇠가 틀리면 보내지 않는다',()=>{
  const r=relay();
  const good=request();
  assert.equal(at(()=>r.post({...good,body:good.body+'!'})).code,'signature');
  assert.equal(at(()=>r.post({...good,to:'other@example.com'})).code,'signature');
  assert.equal(at(()=>r.post({...good,sig:'AAAA'})).code,'signature');
  assert.equal(at(()=>r.post({...good,sig:'***'})).code,'signature');
  assert.equal(at(()=>r.post(good),NOW+11*60000).code,'clock');
  assert.equal(at(()=>r.post(good),NOW-11*60000).code,'clock');
  assert.equal(at(()=>relay({key:null}).post(good)).code,'no_key');
  assert.equal(at(()=>relay({key:'ab'.repeat(10)}).post(good)).code,'no_key');
  const other=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey;
  assert.equal(at(()=>relay({key:Buffer.from(other.export({format:'jwk'}).n,'base64url').toString('hex')}).post(good)).code,'signature');
  assert.equal(at(()=>r.post('{nope')).code,'format');
  assert.equal(at(()=>r.post({...good,v:2})).code,'format');
  assert.equal(r.sent.length,0);
});

test('중계: 받는 사람 하나 · 제목 머리 · 제어 문자 · 길이를 막는다',()=>{
  const r=relay(),code=fields=>at(()=>r.post(request(fields))).code;
  assert.equal(code({to:'a@example.com, b@example.com'}),'to');
  assert.equal(code({to:'Name <a@example.com>'}),'to');
  assert.equal(code({to:'a@example'}),'to');
  assert.equal(code({subject:'오미톡 광고'}),'subject');
  assert.equal(code({subject:'〔SYNK PULSE〕 a\r\nBcc: x@evil.test'}),'subject');
  assert.equal(code({subject:'〔SYNK PULSE〕'+'가'.repeat(150)}),'subject');
  assert.equal(code({body:'a\u0007b'}),'body');
  assert.equal(code({body:'a\r\nb'}),'body');
  assert.equal(code({body:'가'.repeat(4001)}),'body');
  assert.equal(code({key:'BAD KEY'}),'key');
  assert.equal(r.sent.length,0);
});

test('중계: 보내다 끊긴 열쇠는 unknown, 보내기 예외는 열쇠를 지워 다시 보낼 수 있다',()=>{
  const r=relay();r.props.set('k:p1:preview_ready:0123456789ab','sending:'+(NOW-1000));
  assert.deepEqual(at(()=>r.post(request({key:'p1:preview_ready:0123456789ab'}))),{ok:false,status:'unknown',code:'interrupted',version:1});
  const failing=relay({mailFails:true});
  assert.equal(at(()=>failing.post(request())).status,'failed');
  assert.equal(failing.props.has('k:p1:direction_proposed:0123456789ab'),false);
  assert.equal(r.sent.length,0);
});

test('중계: 하루 상한 · 잠금 실패는 busy(서버가 나중에 같은 열쇠로 다시)',()=>{
  const r=relay();r.props.set('d:20261108','200');
  assert.deepEqual(at(()=>r.post(request())),{ok:false,status:'busy',code:'cap',version:1});
  assert.equal(at(()=>relay({quota:0}).post(request())).code,'cap');
  assert.equal(at(()=>relay({lock:false}).post(request())).code,'lock');
  assert.equal(r.props.has('k:p1:direction_proposed:0123456789ab'),false);
});

test('중계: 7일 지난 열쇠와 오래된 날짜 칸을 지운다',()=>{
  const r=relay();
  r.props.set('k:old-key-000001','sent:'+(NOW-8*86400000));r.props.set('k:new-key-000001','sent:'+(NOW-86400000));r.props.set('d:20261031','5');r.props.set('d:20261107','3');
  at(()=>r.post(request()));
  assert.equal(r.props.has('k:old-key-000001'),false);assert.equal(r.props.has('d:20261031'),false);
  assert.equal(r.props.has('k:new-key-000001'),true);assert.equal(r.props.has('d:20261107'),true);assert.equal(r.props.get('SERVER_KEY_N'),nHex);
});

test('중계: BigInt 확인이 Node 서명을 여러 글에서 받아들인다',()=>{
  const r=relay();
  for(const body of ['a','한국어 본문\n둘째 줄','x'.repeat(3999),'〔〕「」 · …'])assert.equal(at(()=>r.post(request({key:`k:${createHash('sha256').update(body).digest('hex').slice(0,12)}`,body}))).status,'sent');
  assert.equal(r.sent.length,4);
});
