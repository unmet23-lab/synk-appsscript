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
    scrollIntoView(){this.scrolled=true;}
    setAttribute(name,value){this.attributes={...this.attributes,[name]:String(value)};}
    getAttribute(name){return this.attributes?.[name]??null;}
  }
  const ids={},requests=[],revoked=[],windows={},reloads=[];for(const id of ['review-heading','review-notice','review-lede','review-facts','review-error','review-content','review-feedback','review-form','review-form-error','review-name','review-comment','review-retry','review-result','review-fine','review-dock','review-dock-write','review-dock-approve'])ids[id]=new Element(id==='review-name'?'input':id==='review-comment'?'textarea':['review-retry','review-dock-write','review-dock-approve'].includes(id)?'button':'div');
  ids['review-form'].append(ids['review-name'],ids['review-comment'],ids['review-retry'],new Element('button'));
  let uuid=0;class SafeURL extends URL{static createObjectURL(){return 'blob:local-'+(++uuid);}static revokeObjectURL(value){revoked.push(value);}}
  const sandbox=vm.createContext({URL:SafeURL,URLSearchParams,Intl,Date,location:{hash,reload:()=>reloads.push(1)},crypto:{randomUUID:()=>`request-client-${++uuid}`},document:{getElementById:id=>ids[id],createElement:tag=>new Element(tag)},window:{addEventListener:(name,fn)=>windows[name]=fn},fetch:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject})),console,...globals});
  vm.runInContext(source,sandbox);
  const resolveRequest=(index,data,status=200)=>requests[index].resolve({ok:status<400,status,json:async()=>data,blob:async()=>data});
  const text=element=>[element.textContent,...element.children.map(text)].join('\n');
  const submit=decision=>ids['review-form'].handlers.submit({preventDefault(){},submitter:{value:decision}});
  return {ids,requests,resolveRequest,text,submit,revoked,windows,reloads};
}
const opened={notice:'제한된 게시 버전 검토',review:{revision:1,contentVersion:2,required:true,expiresAt:'2026-10-20T00:00:00Z',status:'pending',feedback:[],snapshot:{title:'<script>untrusted title</script>',body:'공통 문구',variants:[{account:{platform:'instagram',name:'검토 계정',profile:'@review'},title:'제목',text:'<img src=x onerror=alert(1)>',format:'image',options:{coverUrl:'https://external.test/private',firstComment:'첫 댓글'},copyVariants:[{title:'반복 제목',text:'반복 문구',hashtags:'#반복'}],media:[{key:'v0m0',type:'image',mimeType:'image/png',width:100,height:100}]}],schedule:[{account:'검토 계정',scheduledAt:'2026-10-15T00:00:00Z',timezone:'Asia/Seoul'}],recurrence:{intervalDays:7,maxOccurrences:3}}}};

test('external page requests use token in header with no cookies, storage or remote media loads',async()=>{
  const f=fixture();assert.equal(f.requests[0].path,'/api/social-review/open');const options=f.requests[0].options;assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,'Bearer '+token);assert.ok(!f.requests[0].path.includes(token));
  f.resolveRequest(0,opened);await flush();assert.equal(f.requests.length,1);assert.equal(f.ids['review-content'].hidden,false);assert.equal(f.ids['review-heading'].textContent,'<script>untrusted title</script>');assert.match(f.text(f.ids['review-content']),/반복 문구/);assert.match(f.text(f.ids['review-content']),/10월 15일/);
  assert.ok(!html.includes('app.js'));assert.doesNotMatch(source,/localStorage|sessionStorage|innerHTML|document\.cookie/);assert.doesNotMatch(html,/<script[^>]*>[^<]+|\son\w+=|\sstyle=/);
});

test('missing or malformed fragments never make an API request',()=>{
  for(const hash of ['','#token=short','#token='+token+'?wrong']){const f=fixture(hash);assert.equal(f.requests.length,0);assert.equal(f.ids['review-form'].hidden,true);assert.match(f.ids['review-error'].textContent,/검토 링크 전체/);assert.equal(f.ids['review-heading'].textContent,'검토 링크를 열 수 없어요');}
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
  for(const pattern of [/공개 범위\n전체 공개/,/아동용 콘텐츠\n아니요/,/구독자에게 알림\n예/,/AI 제작 표시\n예/,/제목·설명 언어\n한국어/,/영상 언어\n몽골어/,/유튜브 카테고리\n교육/,/피드에도 공유\n예/,/표지로 쓸 장면\n1.5초/,/공개 범위\nconstructor/,/유튜브 카테고리\n999/,/제목·설명 언어\nnot a language code/])assert.match(text,pattern);
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
  for(const pattern of [/__proto__\ntoString/,/constructor\ntoString/,/UTM 태그\n\{"source":"ig"\}/,/해시태그\n\["#a","#b"\]/,/제목·설명 언어\nko-123/,/영상 언어\nund/])assert.match(text,pattern);
  assert.doesNotMatch(text,/function|native code|\[object Object\]|root|\(123\)/);
  const old=fixture(undefined,{Intl:{DateTimeFormat:Intl.DateTimeFormat}});old.resolveRequest(0,{...data,review:{...data.review,snapshot:{...snapshot,variants:[{...variant,options:{language:'ko'}}]}}});await flush();
  assert.match(old.text(old.ids['review-content']),/제목·설명 언어\nko/);assert.equal(old.ids['review-content'].hidden,false);
});
test('a link that expires during the conflict refresh keeps the expiry reason instead of the conflict message',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();f.submit('approve');f.resolveRequest(1,{error:'다른 검토 의견이 먼저 등록됐어요.'},409);await flush();assert.equal(f.requests[2].path,'/api/social-review/open');
  f.resolveRequest(2,{error:'만료된 검토 링크예요.'},410);await flush();assert.equal(f.ids['review-form'].hidden,true);assert.match(f.ids['review-error'].textContent,/만료/);
});
test('the page reads like the post (2026-10-23): titles only where the platform posts one, same-time accounts in one line, state and the first slot in the head',async()=>{
  const youtube={account:{platform:'youtube',name:'유호빌드',profile:'@yuhobuilds'},title:'유튜브 제목',text:'설명',format:'shorts',options:{},copyVariants:[],media:[]};
  const instagram={account:{platform:'instagram',name:'유호빌드',profile:'@yuhobuilds'},title:'게시물 이름이 기본값으로 든 제목',text:'캡션 #해시',format:'reel',options:{},copyVariants:[{title:'반복 제목',text:'둘째 문구',hashtags:'#둘째'}],media:[]};
  const schedule=[{account:'유호빌드',scheduledAt:'2026-10-25T12:00:00Z',timezone:'Asia/Seoul'},{account:'유호빌드',scheduledAt:'2026-10-25T12:00:00Z',timezone:'Asia/Seoul'},{account:'모루',scheduledAt:'2026-10-26T03:00:00Z',timezone:'Asia/Seoul',cancelled:true}];
  const f=fixture();f.resolveRequest(0,{...opened,review:{...opened.review,snapshot:{...opened.review.snapshot,variants:[instagram,youtube],schedule}}});await flush();
  const text=f.text(f.ids['review-content']);
  assert.match(text,/유튜브 제목/);assert.doesNotMatch(text,/게시물 이름이 기본값으로 든 제목|반복 제목/);
  for(const pattern of [/인스타그램 · 릴스/,/유튜브 · 쇼츠/,/(2026년 )?10월 25일 \(일\) 오후 9:00\n유호빌드 2곳/,/10월 26일 \(월\) 오후 12:00\n모루\n취소됨/,/문구 2/,/둘째 문구/,/해시태그\n#둘째/])assert.match(text,pattern);
  const facts=f.text(f.ids['review-facts']);
  for(const pattern of [/검토 전/,/인스타그램 · 유튜브/,/게시 (2026년 )?10월 25일 \(일\) 오후 9:00/,/버전 2/])assert.match(facts,pattern);
  assert.doesNotMatch(facts,/외 1번/,'a cancelled slot is not another posting time');
  assert.match(f.ids['review-lede'].textContent,/승인하기 전에는 올라가지 않아요/);
});
test('answering keeps files already opened, and form problems stay next to the form instead of closing the page (2026-10-23)',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();
  const load=f.ids['review-content'].querySelectorAll('button')[0],action=load.handlers.click();f.resolveRequest(1,{type:'image/png'});await action;
  f.submit('comment');assert.equal(f.requests.length,2);assert.match(f.ids['review-form-error'].textContent,/남길 의견/);assert.equal(f.ids['review-form-error'].hidden,false);assert.equal(f.ids['review-error'].hidden,true);
  f.ids['review-comment'].value='좋아요';f.submit('comment');assert.equal(f.requests.length,3);
  f.resolveRequest(2,{...opened,review:{...opened.review,revision:2,feedback:[{id:'a',name:'',comment:'좋아요',decision:'comment',createdAt:'2026-10-13T00:00:00Z'}]}});await flush();
  assert.equal(f.ids['review-content'].querySelectorAll('img')[0].src,'blob:local-1');assert.deepEqual(f.revoked,[]);
  assert.match(f.text(f.ids['review-feedback']),/의견\n이름 없음/);assert.match(f.ids['review-result'].textContent,/의견을 저장했어요/);assert.equal(f.ids['review-form-error'].hidden,true);
  f.ids['review-comment'].value='고쳐 주세요';f.submit('reject');assert.equal(JSON.parse(f.requests[3].options.body).revision,2);f.resolveRequest(3,{error:'검토 의견을 확인해 주세요.'},400);await flush();
  assert.match(f.ids['review-form-error'].textContent,/검토 의견을 확인해 주세요/);assert.equal(f.ids['review-form'].hidden,false);assert.equal(f.ids['review-error'].hidden,true);
});
test('a different snapshot after a conflict is drawn fresh and lets go of files opened for the old one (2026-10-23)',async()=>{
  const f=fixture();f.resolveRequest(0,opened);await flush();
  const load=f.ids['review-content'].querySelectorAll('button')[0],action=load.handlers.click();f.resolveRequest(1,{type:'image/png'});await action;
  f.submit('approve');f.resolveRequest(2,{error:'그사이 다른 검토 의견이 등록됐어요.'},409);await flush();assert.equal(f.requests[3].path,'/api/social-review/open');
  f.resolveRequest(3,{...opened,review:{...opened.review,revision:2,snapshot:{...opened.review.snapshot,body:'바뀐 공통 문구'}}});await flush();
  assert.deepEqual(f.revoked,['blob:local-1']);assert.match(f.text(f.ids['review-content']),/바뀐 공통 문구/);assert.match(f.ids['review-form-error'].textContent,/다른 검토 의견/);
});
test('the floating decision bar shows only while the link waits for an answer and steps aside for an unsure answer (2026-10-23)',async()=>{
  assert.match(html,/<div id="review-dock"[^>]* hidden>/,'nothing floats before the post is drawn');
  const f=fixture();f.resolveRequest(0,opened);await flush();assert.equal(f.ids['review-dock'].hidden,false,'the link waits for an answer');
  f.submit('approve');assert.equal(f.ids['review-dock-approve'].disabled,true,'busy while sending');f.requests[1].reject(Error('disconnected'));await flush();
  assert.equal(f.ids['review-dock'].hidden,true,'an unsure answer is retried from the form');assert.equal(f.ids['review-dock-approve'].disabled,false);
  f.ids['review-retry'].handlers.click();f.resolveRequest(2,{...opened,review:{...opened.review,revision:2,status:'approved',decision:'approve',feedback:[{name:'',comment:'',decision:'approve',createdAt:'2026-10-13T00:00:00Z'}]}});await flush();
  assert.equal(f.ids['review-dock'].hidden,true,'nothing left to decide');assert.match(f.text(f.ids['review-facts']),/승인됨/);
  const closed=fixture('');assert.equal(closed.ids['review-dock'].hidden,true);
});
// 지난 판과 바뀐 곳(10-24)
const all=(node,keep)=>[...(keep(node)?[node]:[]),...(node.children||[]).flatMap(child=>all(child,keep))];
const byClass=(root,name)=>all(root,node=>String(node.className||'').split(' ').includes(name));
const account={name:'검토 계정',platform:'instagram',profile:'@review'};
const revised={state:'compared',contentVersion:1,answeredAt:'2026-10-13T01:00:00Z',decision:'reject',decidedAt:'2026-10-13T01:00:00Z',requestTotal:3,truncated:false,
  requests:[{name:'가',comment:'첫 의견',decision:'comment',createdAt:'2026-10-13T00:10:00Z'},{name:'나',comment:'<img src=x onerror=alert(1)>',decision:'comment',createdAt:'2026-10-13T00:20:00Z'},{name:'다',comment:'가격 문구는 빼 주세요',decision:'reject',createdAt:'2026-10-13T01:00:00Z'}],
  changes:[
    {kind:'text',field:'text',variant:'v0',account,rows:[{type:'same',text:'하루'},{type:'removed',text:'<script>old</script> 가격은 1만 원'},{type:'same',text:''},{type:'removed',parts:[{text:'물 온도는 ',changed:false},{text:'92도면',changed:true}]},{type:'added',parts:[{text:'물 온도는 ',changed:false},{text:'90도면',changed:true}]},{type:'skip',count:3}],stats:{changed:1,removed:1,added:0}},
    {kind:'media',field:'media',variant:'v0',account,items:[{change:'replaced',index:1,key:'v0m0',type:'image',width:100,height:100,duration:null,before:{type:'image',width:200,height:100,duration:null}}]},
    {kind:'options',field:'options',variant:'v0',account,items:[{key:'firstComment',before:'옛 댓글',after:'첫 댓글'}]},
    {kind:'copies',field:'copyVariants',variant:'v0',account,items:[{index:1,change:'changed',text:{rows:[{type:'removed',text:'옛 반복'},{type:'added',text:'반복 문구'}],stats:{changed:0,removed:1,added:1}}}]},
    {kind:'value',field:'variantTitle',variant:'v0',account,before:'옛 제목',after:'제목'},
    {kind:'presence',field:'variant',change:'removed',account:{name:'페이스북 계정',platform:'facebook',profile:''}},
    {kind:'schedule',field:'schedule',removed:[{account:'검토 계정',scheduledAt:'2026-10-14T00:00:00Z',timezone:'Asia/Seoul',cancelled:false}],added:[{account:'검토 계정',scheduledAt:'2026-10-15T00:00:00Z',timezone:'Asia/Seoul',cancelled:false}]}]};
const withPrevious=previous=>({...opened,review:{...opened.review,previous}});
test('a revised link opens with a chip, a sheet of what changed, the answers left then, and small marks inside the post (2026-10-24)',async()=>{
  const f=fixture();f.resolveRequest(0,withPrevious(revised));await flush();
  const facts=f.text(f.ids['review-facts']),content=f.ids['review-content'],sheet=byClass(content,'changes')[0];
  assert.match(facts,/바뀐 곳 6/,'the instagram title change is not shown, like the card');assert.ok(sheet);assert.equal(content.children[0],sheet,'the sheet comes first');
  const text=f.text(sheet);
  for(const pattern of [/지난 판과 바뀐 곳/,/10월 13일에 수정을 요청한 판\(버전 1\)과 견줬어요/,/그때 남긴 의견/,/가격 문구는 빼 주세요/,/<img src=x onerror=alert\(1\)>/,/앞의 의견 1개 더 보기/,/올라가는 때\n10월 14일 → 10월 15일[\s\S]*검토 계정 · 인스타그램\n+문구\n고친 줄 1 · 뺀 줄 1/,/사진 1 바뀜/,/첫 댓글/,/문구 2 고침/,/페이스북 계정 · 페이스북\n+이번 판에서 뺀 게시물/])assert.match(text,pattern);
  assert.doesNotMatch(text,/옛 제목|v0m0|variantTitle/);
  const removed=byClass(sheet,'is-removed').map(row=>f.text(row));assert.ok(removed.some(row=>/^\n?전\n.*<script>old<\/script> 가격은 1만 원/s.test(row)),removed.join(' | '));
  assert.deepEqual(all(sheet,node=>node.tagName==='del'||node.tagName==='ins').filter(node=>!String(node.className).includes('is-whole')).map(node=>node.tagName+':'+node.textContent),['del:92도면','ins:90도면']);
  assert.equal(byClass(sheet,'is-gap').length,1,'an unchanged blank line is only a gap');
  const asked=byClass(sheet,'asked')[0],items=all(asked,node=>node.tagName==='li');assert.deepEqual(items.map(item=>item.hidden),[true,false,false]);
  all(asked,node=>node.tagName==='button')[0].handlers.click();assert.deepEqual(items.map(item=>item.hidden),[false,false,false]);
  const marks=[...byClass(content,'tag'),...byClass(content,'frame-tag')].map(node=>node.textContent);
  for(const want of ['문구 바뀜','바뀐 사진','바뀜'])assert.ok(marks.includes(want),want+' in '+marks.join(','));
  assert.ok(byClass(content,'when')[0].children[0].children.some(node=>node.textContent==='바뀜'),'the schedule heading is marked');
});
test('what changed jumps to the post, the chip jumps back, and an answer does not redraw the sheet (2026-10-24)',async()=>{
  const f=fixture();f.resolveRequest(0,withPrevious(revised));await flush();
  const content=f.ids['review-content'],sheet=byClass(content,'changes')[0],card=byClass(content,'post')[0];
  const go=all(sheet,node=>node.tagName==='button'&&node.textContent==='게시물에서 보기')[0];go.handlers.click();assert.equal(card.scrolled,true);assert.equal(card.focused,true);
  const chip=all(f.ids['review-facts'],node=>node.tagName==='button')[0];chip.handlers.click();assert.equal(sheet.scrolled,true);assert.equal(sheet.focused,true);
  const details=all(sheet,node=>node.tagName==='details');details[0].open=true;
  f.ids['review-comment'].value='확인했어요';f.submit('comment');f.resolveRequest(1,{...withPrevious(revised),review:{...withPrevious(revised).review,revision:2,feedback:[{id:'a',name:'',comment:'확인했어요',decision:'comment',createdAt:'2026-10-13T02:00:00Z'}]}});await flush();
  assert.equal(byClass(f.ids['review-content'],'changes')[0],sheet,'same comparison, same nodes');assert.equal(details[0].open,true);
});
test('narrow screens fold the list to four with a show-all button; same, unavailable and first versions read differently (2026-10-24)',async()=>{
  const narrow=fixture(undefined,{matchMedia:query=>({matches:/max-width/.test(query)})});narrow.resolveRequest(0,withPrevious(revised));await flush();
  const list=byClass(narrow.ids['review-content'],'change');assert.deepEqual(list.map(item=>item.hidden),[false,false,false,true,true,true]);assert.ok(list.every(item=>item.children[0].open===false));
  assert.deepEqual(byClass(narrow.ids['review-content'],'change-group').map(head=>[head.textContent,head.hidden]),[['검토 계정 · 인스타그램',false],['페이스북 계정 · 페이스북',true]]);
  all(byClass(narrow.ids['review-content'],'changes')[0],node=>node.tagName==='button'&&/모두 보기/.test(node.textContent))[0].handlers.click();assert.ok(list.every(item=>item.hidden===false));
  const same=fixture();same.resolveRequest(0,withPrevious({...revised,state:'same',changes:[],decision:'approve'}));await flush();
  assert.match(same.text(same.ids['review-facts']),/지난 판과 같음/);assert.match(same.text(same.ids['review-content']),/지난 판과 같아요\n10월 13일에 승인한 판\(버전 1\)과 보이는 내용은 같아요/);
  const closed=fixture();closed.resolveRequest(0,withPrevious({state:'unavailable',contentVersion:1}));await flush();
  assert.doesNotMatch(closed.text(closed.ids['review-facts']),/바뀐 곳|지난 판/);assert.match(closed.text(closed.ids['review-content']),/지난 판\(버전 1\)과는 이 링크에서 견줘 볼 수 없어요/);
  const first=fixture();first.resolveRequest(0,opened);await flush();assert.equal(byClass(first.ids['review-content'],'changes').length,0);assert.doesNotMatch(first.text(first.ids['review-facts']),/바뀐 곳/);
  const big=fixture();big.resolveRequest(0,withPrevious({...revised,dropped:4}));await flush();
  assert.match(big.text(big.ids['review-facts']),/바뀐 곳 10/,'six shown + four the server left out');assert.match(big.text(big.ids['review-content']),/그 밖에 바뀐 곳 4곳은 길어서 여기 보이지 않아요/);
});
test('a schedule that only lost one of two slots is not called unset, and a body removed entirely gets no jump button (Argon 10-24 A1·A2)',async()=>{
  const slot=at=>({account:'검토 계정',scheduledAt:at,timezone:'Asia/Seoul',cancelled:false});
  const previous={...revised,changes:[{kind:'text',field:'body',rows:[{type:'removed',text:'옛 공통 문구'}],stats:{changed:0,removed:1,added:0}},{kind:'schedule',field:'schedule',removed:[slot('2026-10-16T00:00:00Z')],added:[]}]};
  const f=fixture();f.resolveRequest(0,{...opened,review:{...opened.review,previous,snapshot:{...opened.review.snapshot,body:'',schedule:[slot('2026-10-15T00:00:00Z')]}}});await flush();
  const sheet=byClass(f.ids['review-content'],'changes')[0],text=f.text(sheet);
  assert.match(text,/올라가는 때\n뺀 때 1/);assert.doesNotMatch(text,/아직 다시 정하지 않았어요/);
  assert.deepEqual(byClass(sheet,'view-post').map(node=>node.textContent),['올라가는 때에서 보기']);
});
test('Fable 10-23 follow-ups: total repeat count, reply-scope names, headings that read with their counts, and a page restored from the back-forward cache reloads',async()=>{
  const x={account:{platform:'x',name:'모루',profile:'@moru'},text:'글',format:'text',options:{whoCanReply:'mentionedUsers'},copyVariants:[],media:[]};
  const tiktok={account:{platform:'tiktok',name:'모루',profile:'@moru'},text:'영상',format:'video',options:{whoCanReply:'followers'},copyVariants:[],media:[]};
  const f=fixture();f.resolveRequest(0,{...opened,review:{...opened.review,snapshot:{...opened.review.snapshot,variants:[...opened.review.snapshot.variants,x,tiktok]}}});await flush();
  const text=f.text(f.ids['review-content']);
  assert.match(text,/7일마다 올려요 · 처음을 포함해 모두 3번/);assert.doesNotMatch(text,/다시 올려요|최대 3번/);
  assert.match(text,/답글 허용\n언급한 계정만/);assert.match(text,/답글 허용\nfollowers/,'a value the server does not name stays as sent');
  const headings=[...f.ids['review-content'].querySelectorAll('h2'),...f.ids['review-feedback'].querySelectorAll('h2')].map(h=>h.getAttribute('aria-label')).filter(Boolean);
  assert.deepEqual(headings,['올라갈 게시물 3개','주고받은 의견 0개']);
  f.windows.pageshow({persisted:false});assert.equal(f.reloads.length,0);f.windows.pageshow({persisted:true});assert.equal(f.reloads.length,1);
});

test('brand fonts (2026-10-24): every face is a consultation asset and the page preloads the same SUIT file before the stylesheet',()=>{
  const css=readFileSync(new URL('./public/social-review.css',import.meta.url),'utf8'),faces=[...css.matchAll(/url\('([^']+\.(?:woff2|ttf))'\)/g)].map(m=>m[1]);
  assert.equal(faces.length,5);assert.ok(faces.every(url=>url.startsWith('/consultation/assets/')),faces.join(' '));
  const preloads=[...html.matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)].map(m=>m[1]);
  assert.deepEqual(preloads,['/consultation/assets/SUIT-Variable.woff2']);assert.ok(faces.includes(preloads[0]),'the preload is the file a face names, so it is fetched once');
  assert.ok(html.indexOf('rel="preload"')<html.indexOf('rel="stylesheet"'),'the font starts with the stylesheet, not after it');
});
