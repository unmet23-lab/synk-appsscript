import test from 'node:test';
import assert from 'node:assert/strict';
import {textChange,mediaChange,compareReviews} from './social-review-changes.mjs';

const text=rows=>rows.map(r=>r.type==='skip'?'…'+r.count:(r.type==='removed'?'-':r.type==='added'?'+':' ')+(r.parts?r.parts.map(p=>p.changed?'['+p.text+']':p.text).join(''):r.text));

test('text changes pair similar lines word by word and keep unrelated lines apart',()=>{
  assert.equal(textChange('같은 글','같은 글'),null);assert.equal(textChange('a\r\nb','a\nb'),null);
  const caption=textChange('하루의 첫 장면을 천천히.\n가격은 1만 원이에요.\n#모루커피','하루의 첫 장면을 천천히.\n#모루커피 #드립백');
  assert.deepEqual(text(caption.rows),[' 하루의 첫 장면을 천천히.','-가격은 1만 원이에요.','-#모루커피','+#모루커피[ #드립백]']);
  assert.deepEqual(caption.stats,{changed:1,removed:1,added:0},'the unrelated price line stays removed; the hashtag line pairs with its edit');
  const word=textChange('물 온도는 92도면 충분해요.','물 온도는 90도면 충분해요.');
  assert.deepEqual(text(word.rows),['-물 온도는 [92도면] 충분해요.','+물 온도는 [90도면] 충분해요.']);assert.deepEqual(word.stats,{changed:1,removed:0,added:0});
  assert.deepEqual(text(textChange('','새 문구').rows),['+새 문구']);assert.deepEqual(text(textChange('옛 문구','').rows),['-옛 문구']);
});

test('long texts fold unchanged lines, long one-line captions keep only the words around a change',()=>{
  const before=Array.from({length:30},(_,i)=>'줄 '+(i+1)),after=[...before];after[14]='바뀐 줄 15';
  assert.deepEqual(text(textChange(before.join('\n'),after.join('\n')).rows),['…13',' 줄 14','-줄 15','+[바뀐 ]줄 15',' 줄 16','…14']);
  const paragraph=n=>'모루 커피 가을 시즌 정리. '.repeat(n);
  const one=textChange(paragraph(30)+'가격은 1만 원. '+paragraph(30),paragraph(30)+'오늘부터 팔아요. '+paragraph(30));
  assert.equal(one.rows.length,2);assert.ok(one.rows.every(r=>r.parts&&r.parts.map(p=>p.text).join('').length<400),JSON.stringify(one.rows).length);
  assert.match(one.rows[0].parts.map(p=>p.changed?'['+p.text+']':p.text).join(''),/^….*\[가격은 1만 원\].*…$/);
});

test('size and time stay bounded for huge texts and emoji are never cut in half',()=>{
  const many=n=>Array.from({length:n},(_,i)=>'줄 '+i+' '+'가'.repeat(i%7)).join('\n');
  const started=Date.now(),big=textChange(many(3000),many(3000).replace(/줄 (\d+)/g,'행 $1'));
  assert.ok(Date.now()-started<1500,'took '+(Date.now()-started)+'ms');assert.equal(big.truncated,true);assert.ok(big.rows.length<=200);
  const huge=textChange('가'.repeat(20000),'나'.repeat(20000));assert.ok(huge.rows.every(r=>r.text.length<=1501));
  // 많은 짧은 줄 대 아주 긴 한 줄도 막히지 않는다 — 짝 비교의 글자 수 예산(GPT 7차 GA1, 고치기 전 7.4초)
  const lopsided=Date.now();textChange('a\n'.repeat(10000).trimEnd(),'b'.repeat(29999));assert.ok(Date.now()-lopsided<1500,'took '+(Date.now()-lopsided)+'ms');
  // 예산이 바닥난 뒤에도 긴 줄의 바뀐 곳은 보이고 「일부만」으로 알린다(GPT 8차 GA1 — 계정 34개 × 3만 자 줄)
  const v=(i,text)=>({key:'v'+i,account:{name:'계정 '+i,platform:'instagram',profile:''},title:'',text,format:'post',options:{},copyVariants:[],media:[]});
  const wide=word=>({title:'t',body:'',variants:Array.from({length:34},(_,i)=>v(i,'a'.repeat(29991)+word)),schedule:[],recurrence:null,expiresAt:null}),ids34=Array.from({length:34},(_,i)=>({channelId:'c'+i,media:[],copies:[]}));
  const spent=Date.now(),{changes:all}=compareReviews(wide('OLD PRICE'),wide('NEW PRICE'),{before:ids34,after:ids34});assert.ok(Date.now()-spent<3000,'took '+(Date.now()-spent)+'ms');
  const last=all.filter(c=>c.rows&&c.rows.length).at(-1);assert.ok(last,'line details kept for some');assert.deepEqual(last.rows.map(r=>r.parts.filter(p=>p.changed).map(p=>p.text)),[['OLD'],['NEW']]);
  assert.ok(all.some(c=>c.truncated===true),'rough pairs say only part is shown');
  // 예산이 바닥난 뒤 고친 줄 앞에 새 줄이 끼어도 짝을 찾는다(GPT 9차 GA1 — 마지막 계정에만 'Z\n')
  const shiftedLast=word=>({...wide(word),variants:wide(word).variants.map((x,i)=>({...x,text:(i===33&&word==='NEW'?'Z\n':'')+'a'.repeat(29985)+word}))});
  const {changes:late}=compareReviews(shiftedLast('OLD'),shiftedLast('NEW'),{before:ids34,after:ids34}),lastText=late.filter(c=>c.field==='text').at(-1);
  assert.equal(lastText.variant,'v33');assert.ok(lastText.rows.length,'kept rows');assert.deepEqual(lastText.rows.filter(r=>r.parts).map(r=>r.parts.filter(p=>p.changed).map(p=>p.text)),[['OLD'],['NEW']]);assert.equal(lastText.truncated,true);
  // 4,000자 넘는 한 줄의 끝에서 바뀐 값도 보인다(GPT 4차 GA1)
  const price=textChange('same '.repeat(900)+'OLD PRICE','same '.repeat(900)+'NEW PRICE');
  assert.deepEqual(price.rows.map(r=>r.parts.filter(p=>p.changed).map(p=>p.text)),[['OLD'],['NEW']]);
  assert.ok(price.rows.every(r=>r.parts[0].text.startsWith('…')&&r.parts.at(-1).text===' PRICE'));assert.deepEqual(price.stats,{changed:1,removed:0,added:0});
  // 1,500~4,000자 줄과 아주 긴 낱말 안의 변경도 그 자리가 칠해진다(GPT 5차 GA1)
  for(const [x,y] of [['가'.repeat(1600)+'OLD PRICE','가'.repeat(1600)+'NEW PRICE'],['same '.repeat(250)+'a'.repeat(1600)+'OLD PRICE','same '.repeat(250)+'a'.repeat(1600)+'NEW PRICE']]){
    const r=textChange(x,y);assert.deepEqual(r.rows.map(row=>row.parts.filter(p=>p.changed).map(p=>p.text)),[['OLD'],['NEW']]);assert.ok(r.rows.every(row=>row.parts.map(p=>p.text).join('').length<200));}
  // 비슷하지 않은(30% 미만) 긴 줄도 같은 앞부분 뒤 바뀐 글자가 보인다(GPT 6차 GA1)
  const unlike=textChange('a'.repeat(2000)+'b'.repeat(8000),'a'.repeat(2000)+'c'.repeat(8000));
  assert.deepEqual(unlike.rows.map(row=>row.parts.filter(p=>p.changed).map(p=>p.text[0])),[['b'],['c']]);assert.ok(unlike.rows.every(row=>row.parts[0].text.length<=81));
  // 고친 긴 줄 앞에 새 줄이 끼어도 고친 줄끼리 짝이 된다(자리끼리만 짝짓지 않는다)
  const shifted=textChange('x'.repeat(2000)+' old','새로 낀 줄\n'+'x'.repeat(2000)+' new');
  assert.deepEqual(shifted.rows.map(r=>r.type+':'+(r.parts?r.parts.filter(p=>p.changed).map(p=>p.text).join('|'):r.text)),['added:새로 낀 줄','removed:old','added:new']);assert.deepEqual(shifted.stats,{changed:1,removed:0,added:1});assert.equal(shifted.truncated,undefined);
  // 짝 찾기 범위(20줄)를 넘어 놓친 긴 줄은 잘리며 「일부만」으로 알린다(GPT 10차 GA1 — 새 줄 21개), 19개면 그대로 짝이 된다
  const far=textChange('a'.repeat(2000)+'OLD',Array.from({length:21},(_,i)=>'새 줄 '+i).join('\n')+'\n'+'a'.repeat(2000)+'NEW');assert.equal(far.truncated,true);
  const near=textChange('a'.repeat(2000)+'OLD',Array.from({length:19},(_,i)=>'새 줄 '+i).join('\n')+'\n'+'a'.repeat(2000)+'NEW');assert.equal(near.rows.filter(r=>r.parts).length,2,'19 inserted lines still pair');assert.equal(near.truncated,undefined);
  // 짝 없는 줄이 1,500자 이하면 다 보이므로 「일부만」이 아니다
  assert.equal(textChange('짧은 줄','b'.repeat(1500)).truncated,undefined);assert.equal(textChange('짧은 줄','b'.repeat(1501)).truncated,true);
  // 앞·뒤가 하나도 같지 않은 긴 두 줄은 짝 없이 서로 다른 줄로(첫 글자부터 달라 앞부분에 바뀐 곳이 보인다)
  assert.deepEqual(textChange('가'.repeat(5000),'나'.repeat(5000)).stats,{changed:0,removed:1,added:1});
  const emoji=textChange('🙂'.repeat(2000),'🙃'.repeat(2000));for(const row of emoji.rows)assert.ok(!/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/.test(row.text.replace(/…$/,'')),'surrogate cut');
});

test('files are matched by content: replaced, added, removed and moved',()=>{
  const m=(id,key)=>({id,key,type:'image',mimeType:'image/png',width:1080,height:1350,duration:null});
  assert.equal(mediaChange([m('a','v0m0')],[m('a','v0m0')]),null);
  assert.deepEqual(mediaChange([m('a'),m('b')],[m('a','v0m0'),m('c','v0m1'),m('d','v0m2')]).map(i=>[i.change,i.index,i.key??null]),[['replaced',2,'v0m1'],['added',3,'v0m2']]);
  assert.deepEqual(mediaChange([m('a'),m('b'),m('c')],[m('a','v0m0'),m('c','v0m1')]).map(i=>[i.change,i.index]),[['removed',2]]);
  assert.deepEqual(mediaChange([m('a'),m('b')],[m('b','v0m0'),m('a','v0m1')]).map(i=>[i.change,i.from??null,i.index]),[['moved',1,2]]);
  const replaced=mediaChange([{...m('a'),type:'video',width:1920,height:1080,duration:15}],[m('b','v0m0')])[0];assert.deepEqual(replaced.before,{type:'video',width:1920,height:1080,duration:15});assert.ok(!('id' in replaced));
});

test('whole snapshots compare only public values and never return channel or file identities',()=>{
  const account=(name,platform)=>({name,platform,profile:'@'+name});
  const variant=(i,extra)=>({key:'v'+i,account:account('모루',['instagram','facebook','tiktok'][i]),title:'제목',text:'문구',format:'image',options:{},copyVariants:[],media:[],...extra});
  const before={title:'가을 첫 잔',body:'공통',variants:[variant(0,{media:[{key:'v0m0',type:'image'},{key:'v0m1',type:'image'}],options:{firstComment:'링크는 프로필에',altText:'봉투'},copyVariants:[{title:'',text:'둘째 주',hashtags:'#a'}]}),variant(1,{text:'페이스북 문구'})],
    schedule:[{account:'모루',scheduledAt:'2026-10-25T03:00:00.000Z',timezone:'Asia/Seoul',mode:'fixed',cancelled:false}],recurrence:{intervalDays:7,maxOccurrences:3,until:null},expiresAt:null};
  const after={title:'가을 첫 잔',body:'공통',variants:[variant(0,{text:'문구 고침',media:[{key:'v0m0',type:'image'},{key:'v0m1',type:'image'}],options:{firstComment:'링크는 프로필 맨 위에',altText:'봉투'},copyVariants:[{title:'',text:'둘째 주에도',hashtags:'#a'},{title:'',text:'셋째 주',hashtags:''}]}),{...variant(1,{format:'video'}),account:account('모루',['instagram','tiktok'][1])}],
    schedule:[{account:'모루',scheduledAt:'2026-10-26T03:00:00.000Z',timezone:'Asia/Seoul',mode:'fixed',cancelled:false}],recurrence:{intervalDays:7,maxOccurrences:3,until:null},expiresAt:null};
  const ids={before:[{channelId:'chan-ig-secret',media:['sha-a','sha-b'],copies:['copy-id-second']},{channelId:'chan-fb-secret',media:[],copies:[]}],after:[{channelId:'chan-ig-secret',media:['sha-a','sha-c'],copies:['copy-id-second','copy-id-third']},{channelId:'chan-tt-secret',media:[],copies:[]}]};
  const {changes,truncated}=compareReviews(before,after,ids);assert.equal(truncated,false);
  assert.deepEqual(changes.map(c=>[c.kind,c.field,c.variant??null,c.change??null]),[['text','text','v0',null],['media','media','v0',null],['options','options','v0',null],['copies','copyVariants','v0',null],['presence','variant','v1','added'],['presence','variant',null,'removed'],['schedule','schedule',null,null]]);
  const json=JSON.stringify(changes);for(const secret of ['chan-','sha-','copy-id'])assert.ok(!json.includes(secret),secret);
  assert.ok(!json.includes('페이스북 문구'),'a removed account shows its header only');
  assert.deepEqual(changes[2].items,[{key:'firstComment',before:'링크는 프로필에',after:'링크는 프로필 맨 위에'}]);
  assert.deepEqual(changes[3].items.map(i=>[i.index,i.change]),[[1,'changed'],[2,'added']]);
  assert.deepEqual(changes[6].removed.map(s=>s.scheduledAt),['2026-10-25T03:00:00.000Z']);assert.deepEqual(changes[6].added.map(s=>s.scheduledAt),['2026-10-26T03:00:00.000Z']);
});

test('very large comparisons drop line details from the biggest text first and say so',()=>{
  const big=n=>Array.from({length:180},(_,i)=>'줄 '+i+' '+n.repeat(300)).join('\n');
  const v=(text)=>({key:'v0',account:{name:'모루',platform:'instagram',profile:''},title:'',text,format:'post',options:{},copyVariants:[],media:[]});
  const before={title:'t',body:big('가'),variants:[v(big('다'))],schedule:[],recurrence:null,expiresAt:null},after={...before,body:big('나'),variants:[v(big('라'))]};
  const ids={before:[{channelId:'c',media:[],copies:[]}],after:[{channelId:'c',media:[],copies:[]}]};
  const {changes,truncated}=compareReviews(before,after,ids);assert.equal(truncated,true);assert.ok(Buffer.byteLength(JSON.stringify(changes))<=32768);
  assert.ok(changes.some(c=>c.truncated&&!c.rows.length&&c.stats.removed+c.stats.changed>0));assert.equal(changes.length,2,'counts stay: only line details are dropped');
});

test('many short value changes stay under the byte cap too: later accounts are dropped first and counted (GPT GA1)',()=>{
  const variants=title=>Array.from({length:40},(_,i)=>({key:'v'+i,account:{name:'계정 '+i,platform:'youtube',profile:''},title,text:'',format:'post',options:{},copyVariants:[],media:[]}));
  const ids=Array.from({length:40},(_,i)=>({channelId:'c'+i,media:[],copies:[]}));
  const snap=(title,body)=>({title:'t',body,variants:variants(title),schedule:[],recurrence:null,expiresAt:null});
  const {changes,truncated,dropped}=compareReviews(snap('가'.repeat(120),'옛 공통'),snap('나'.repeat(120),'새 공통'),{before:ids,after:ids});
  assert.ok(Buffer.byteLength(JSON.stringify(changes))<=32768,String(Buffer.byteLength(JSON.stringify(changes))));assert.equal(truncated,true);assert.ok(dropped>0);
  assert.equal(changes.length+dropped,41);assert.equal(changes[0].field,'body','post-wide changes are kept');assert.equal(changes.at(-1).variant,'v'+(changes.length-2),'the later accounts went first');
});

test('repeat copies pair by their private id: an inserted copy is new, the others keep their pairs or say they moved',()=>{
  const v=copyVariants=>({key:'v0',account:{name:'모루',platform:'instagram',profile:''},title:'',text:'문구',format:'post',options:{},copyVariants,media:[]});
  const snap=copies=>({title:'t',body:'',variants:[v(copies)],schedule:[],recurrence:null,expiresAt:null});
  const ids=copies=>[{channelId:'c',media:[],copies}];
  const {changes}=compareReviews(snap([{title:'',text:'둘째',hashtags:''},{title:'',text:'셋째',hashtags:''}]),snap([{title:'',text:'새 둘째',hashtags:''},{title:'',text:'둘째',hashtags:''},{title:'',text:'셋째 고침',hashtags:''}]),{before:ids(['a','b']),after:ids(['n','a','b'])});
  assert.deepEqual(changes[0].items.map(i=>[i.index,i.change,i.from??null]),[[1,'added',null],[2,'moved',1],[3,'changed',null]]);
});
