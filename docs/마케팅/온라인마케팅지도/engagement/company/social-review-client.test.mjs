import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/social-review.js',import.meta.url),'utf8'),html=readFileSync(new URL('./public/social-review.html',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const token='a'.repeat(43);
function fixture(hash='#token='+token,globals={}){
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.textContent='';this.hidden=false;this.disabled=false;this.value='';}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    replaceChildren(...children){this.children=[];this.append(...children);}
    replaceWith(other){const index=this.parent.children.indexOf(this);this.parent.children[index]=other;other.parent=this.parent;}
    addEventListener(name,handler){this.handlers[name]=handler;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...selector.split(',').includes(child.tagName)?[child]:[],...child.querySelectorAll(selector)]);}
    set innerHTML(_){throw Error('untrusted HTML rendering');}
    focus(){this.focused=true;}
  }
  const ids={},requests=[],revoked=[],windows={};for(const id of ['review-notice','review-error','review-content','review-feedback','review-form','review-name','review-comment','review-retry','review-result'])ids[id]=new Element(id==='review-name'?'input':id==='review-comment'?'textarea':id==='review-retry'?'button':'div');
  ids['review-form'].append(ids['review-name'],ids['review-comment'],ids['review-retry'],new Element('button'));
  let uuid=0;class SafeURL extends URL{static createObjectURL(){return 'blob:local-'+(++uuid);}static revokeObjectURL(value){revoked.push(value);}}
  const sandbox=vm.createContext({URL:SafeURL,URLSearchParams,Intl,Date,location:{hash},crypto:{randomUUID:()=>`request-client-${++uuid}`},document:{getElementById:id=>ids[id],createElement:tag=>new Element(tag)},window:{addEventListener:(name,fn)=>windows[name]=fn},fetch:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject})),console,...globals});
  vm.runInContext(source,sandbox);
  const resolveRequest=(index,data,status=200)=>requests[index].resolve({ok:status<400,status,json:async()=>data,blob:async()=>data});
  const text=element=>[element.textContent,...element.children.map(text)].join('\n');
  const submit=decision=>ids['review-form'].handlers.submit({preventDefault(){},submitter:{value:decision}});
  return {ids,requests,resolveRequest,text,submit,revoked,windows};
}
const opened={notice:'제한된 게시 버전 검토',review:{revision:1,contentVersion:2,required:true,expiresAt:'2026-10-20T00:00:00Z',status:'pending',feedback:[],snapshot:{title:'<script>untrusted title</script>',body:'공통 문구',variants:[{account:{platform:'instagram',name:'검토 계정',profile:'@review'},title:'제목',text:'<img src=x onerror=alert(1)>',format:'image',options:{coverUrl:'https://external.test/private',firstComment:'첫 댓글'},copyVariants:[{title:'반복 제목',text:'반복 문구',hashtags:'#반복'}],media:[{key:'v0m0',type:'image',mimeType:'image/png',width:100,height:100}]}],schedule:[{account:'검토 계정',scheduledAt:'2026-10-15T00:00:00Z',timezone:'Asia/Seoul'}],recurrence:{intervalDays:7,maxOccurrences:3}}}};

test('external page requests use token in header with no cookies, storage or remote media loads',async()=>{
  const f=fixture();assert.equal(f.requests[0].path,'/api/social-review/open');const options=f.requests[0].options;assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,'Bearer '+token);assert.ok(!f.requests[0].path.includes(token));
  f.resolveRequest(0,opened);await flush();assert.equal(f.requests.length,1);assert.equal(f.ids['review-content'].hidden,false);assert.match(f.text(f.ids['review-content']),/<script>untrusted title<\/script>/);assert.match(f.text(f.ids['review-content']),/반복 문구/);assert.match(f.text(f.ids['review-content']),/2026/);
  assert.ok(!html.includes('app.js'));assert.doesNotMatch(source,/localStorage|sessionStorage|innerHTML|document\.cookie/);assert.doesNotMatch(html,/<script[^>]*>[^<]+|\son\w+=|\sstyle=/);
});

test('missing or malformed fragments never make an API request',()=>{
  for(const hash of ['','#token=short','#token='+token+'?wrong']){const f=fixture(hash);assert.equal(f.requests.length,0);assert.equal(f.ids['review-form'].hidden,true);assert.match(f.ids['review-error'].textContent,/전체 검토 링크/);}
});

test('media is loaded only on explicit preview through the scoped authenticated endpoint and blob URLs are released',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();const load=f.ids['review-content'].querySelectorAll('button')[0];const action=load.handlers.click();assert.equal(f.requests[1].path,'/api/social-review/media');assert.equal(JSON.parse(f.requests[1].options.body).mediaKey,'v0m0');f.resolveRequest(1,{type:'image/png'});await action;const image=f.ids['review-content'].querySelectorAll('img')[0];assert.equal(image.src,'blob:local-1');f.windows.pagehide();assert.deepEqual(f.revoked,['blob:local-1']);
});

test('uncertain feedback retries reuse the exact request id and body and suppress duplicate submit',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();f.ids['review-name'].value='고객';f.ids['review-comment'].value='검토했습니다.';f.submit('approve');f.submit('approve');assert.equal(f.requests.length,2);const first=f.requests[1].options.body;f.requests[1].reject(Error('disconnected'));await flush();assert.equal(f.ids['review-retry'].hidden,false);f.ids['review-retry'].handlers.click();assert.equal(f.requests[2].options.body,first);f.resolveRequest(2,{...opened,review:{...opened.review,revision:2,status:'approved',feedback:[{name:'고객',comment:'검토했습니다.',decision:'approve',createdAt:'2026-10-13T00:00:00Z'}]}});await flush();assert.equal(f.ids['review-retry'].hidden,true);assert.equal(f.ids['review-comment'].value,'');assert.match(f.ids['review-result'].textContent,/저장했어요/);
});

test('stale feedback refreshes current revision and revoked links hide the post and form',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();f.submit('approve');f.resolveRequest(1,{error:'다른 검토 의견이 등록됐습니다.'},409);await flush();assert.equal(f.requests[2].path,'/api/social-review/open');f.resolveRequest(2,{...opened,review:{...opened.review,revision:2}});await flush();f.submit('approve');assert.equal(JSON.parse(f.requests[3].options.body).revision,2);f.resolveRequest(3,{error:'만료된 검토 링크입니다.'},410);await flush();assert.equal(f.ids['review-form'].hidden,true);assert.equal(f.ids['review-content'].hidden,true);assert.match(f.ids['review-error'].textContent,/만료/);
});

test('reject and comment require text before sending',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();f.submit('reject');assert.equal(f.requests.length,1);assert.equal(f.ids['review-comment'].focused,true);f.submit('comment');assert.equal(f.requests.length,1);
});
test('daily-content options read as names, not raw keys or codes, and unknown values stay as sent (2026-10-22)',async()=>{
  const youtube={account:{platform:'youtube',name:'유튜브 계정',profile:'@yt'},title:'쇼츠 제목',text:'설명',format:'shorts',options:{privacy:'public',madeForKids:false,notifySubscribers:true,madeWithAi:true,language:'ko',audioLanguage:'mn',categoryId:'27'},copyVariants:[],media:[]};
  const instagram={account:{platform:'instagram',name:'인스타 계정',profile:'@ig'},text:'캡션',format:'reel',options:{shareToFeed:true,madeWithAi:true,thumbnailTimestamp:1500,privacy:'constructor',categoryId:'999',language:'not a language code'},copyVariants:[],media:[]};
  const f=fixture();f.resolveRequest(0,{...opened,review:{...opened.review,snapshot:{...opened.review.snapshot,variants:[youtube,instagram]}}});await flush();const text=f.text(f.ids['review-content']);
  for(const pattern of [/공개 범위\n전체 공개/,/아동용\n아니요/,/구독자에게 알림\n예/,/AI 제작 표시\n예/,/제목·설명 언어\n한국어/,/영상 언어\n몽골어/,/YouTube 카테고리\n교육/,/피드에도 공유\n예/,/표지 시각\(ms\)\n1500/,/공개 범위\nconstructor/,/YouTube 카테고리\n999/,/제목·설명 언어\nnot a language code/])assert.match(text,pattern);
  assert.doesNotMatch(text,/notifySubscribers|audioLanguage|categoryId|shareToFeed|function/);
});
test('every option key the server keeps has a review-page name, so new keys never show raw (2026-10-22)',()=>{
  const server=readFileSync(new URL('./social-publishing.mjs',import.meta.url),'utf8'),allowed=server.match(/function options\(raw=\{\}\)\{object\(raw\);const allowed=new Set\(\[([^\]]+)\]\)/);assert.ok(allowed,'social-publishing.mjs options() allowed list');
  const names=source.match(/const optionNames=\{([^}]+)\}/);assert.ok(names,'social-review.js optionNames');const named=new Set([...names[1].matchAll(/(\w+):'/g)].map(m=>m[1]));
  for(const key of allowed[1].match(/'(\w+)'/g).map(k=>k.slice(1,-1)))assert.ok(named.has(key),key);
});
test('prototype keys, object values, partial language codes and missing Intl.DisplayNames never print code or a guessed name (2026-10-22)',async()=>{
  const options=JSON.parse('{"__proto__":"toString","constructor":"toString","utm":{"source":"ig"},"hashtags":["#a","#b"],"language":"ko-123","audioLanguage":"und"}');
  const variant={account:{platform:'youtube',name:'유튜브 계정',profile:'@yt'},text:'설명',format:'shorts',options,copyVariants:[],media:[]};
  const snapshot={...opened.review.snapshot,variants:[variant]},data={...opened,review:{...opened.review,snapshot}};
  const f=fixture();f.resolveRequest(0,data);await flush();const text=f.text(f.ids['review-content']);
  for(const pattern of [/__proto__\ntoString/,/constructor\ntoString/,/UTM\n\{"source":"ig"\}/,/해시태그\n\["#a","#b"\]/,/제목·설명 언어\nko-123/,/영상 언어\nund/])assert.match(text,pattern);
  assert.doesNotMatch(text,/function|native code|\[object Object\]|root|\(123\)/);
  const old=fixture(undefined,{Intl:{DateTimeFormat:Intl.DateTimeFormat}});old.resolveRequest(0,{...data,review:{...data.review,snapshot:{...snapshot,variants:[{...variant,options:{language:'ko'}}]}}});await flush();
  assert.match(old.text(old.ids['review-content']),/제목·설명 언어\nko/);assert.equal(old.ids['review-content'].hidden,false);
});
test('a link that expires during the conflict refresh keeps the expiry reason instead of the conflict message',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();f.submit('approve');f.resolveRequest(1,{error:'다른 검토 의견이 먼저 등록됐어요.'},409);await flush();assert.equal(f.requests[2].path,'/api/social-review/open');
  f.resolveRequest(2,{error:'만료된 검토 링크예요.'},410);await flush();assert.equal(f.ids['review-form'].hidden,true);assert.match(f.ids['review-error'].textContent,/만료/);
});
