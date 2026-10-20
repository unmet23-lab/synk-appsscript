import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/subtitle-lab.js',import.meta.url),'utf8');
// 화면 도우미(mtHead · mtBlock · mtDrop …)는 maker-tools.js 앞 절반 — 머리 주석에도 같은 문구가 있어 줄 머리에서 찾는다.
const kit=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8'),kitHelpers=kit.slice(0,kit.indexOf('\n// ── 상태와 화면 바꾸기'));
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const pure=vm.createContext({Intl,TextEncoder,console});vm.runInContext(source,pure,{filename:'subtitle-lab.js'});
const inspect=(text,options={})=>{pure.input=text;pure.options=options;return vm.runInContext('subtitleInspect(input,options)',pure);};
const serialize=(report,options={})=>{pure.report=report;pure.options=options;return vm.runInContext('subtitleSerialize(report,options)',pure);};
const transcript=report=>{pure.report=report;return vm.runInContext('subtitleTranscript(report)',pure);};
const codes=report=>report.issues.map(row=>row.code);
const cue=(id,start,end,text)=>`${id}\n${start} --> ${end}\n${text}`;
function client(){
  const handlers=new Map(),notifications=[],modals=[],downloads=[],urls=[],revoked=[];let renders=0;
  const context=vm.createContext({Intl,TextEncoder,console,Blob,URL:class extends URL{static createObjectURL(blob){urls.push(blob);return 'blob:local-'+urls.length;}static revokeObjectURL(url){revoked.push(url);}},
    state:{user:{id:'A'},tab:'workroom'},document:{addEventListener(type,handler){handlers.set(type,handler);},querySelector(){return {hidden:false};},body:{append(){}},createElement(){return {click(){downloads.push({href:this.href,download:this.download});},remove(){}};}},
    render(){renders++;},notify:message=>notifications.push(message),modal:(...args)=>modals.push(args),navigator:{clipboard:{writeText:async()=>{}}},setTimeout(callback){callback();return 1;},escape:escapeHtml
  });vm.runInContext(kitHelpers,context);vm.runInContext(source,context);vm.runInContext('subtitleLabIdentity()',context);
  return {context,handlers,notifications,modals,downloads,urls,revoked,evaluate:code=>vm.runInContext(code,context),get renders(){return renders;}};
}
const flush=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};

test('SRT normalization preserves times, text and all duplicate cues while renumbering a separate file',()=>{
  const original='\uFEFF'+cue(7,'00:00:00,000','00:00:02,200',' 첫 문장  \n둘째 문장')+'\r\n\r\n'+cue(7,'00:00:00,000','00:00:02,200',' 첫 문장  \n둘째 문장')+'\r\n';
  const report=inspect(original,{fileName:'원본.srt'});assert.equal(report.errors,0);assert.equal(report.cues.length,2);assert.ok(codes(report).includes('duplicate-number'));assert.ok(codes(report).includes('duplicate-cue'));assert.ok(codes(report).includes('overlap'));
  assert.equal(serialize(report),cue(1,'00:00:00,000','00:00:02,200',' 첫 문장  \n둘째 문장')+'\n\n'+cue(2,'00:00:00,000','00:00:02,200',' 첫 문장  \n둘째 문장')+'\n');assert.ok(original.startsWith('\uFEFF'));assert.ok(original.includes('\r\n'));
});
test('strict timestamps distinguish SRT commas, VTT full stops, 2-digit minute forms and invalid ranges',()=>{
  for(const bad of ['00:60:00,000','00:00:60,000','00:00:00.000','0:00:00,000','00:00:00,01','-00:00:00,000'])assert.ok(codes(inspect(cue(1,bad,'00:00:02,000','문장'))).includes('timestamp'),bad);
  assert.equal(inspect('WEBVTT\n\n00:01.050 --> 00:03.250\n문장',{fileName:'x.vtt'}).errors,0);
  for(const bad of ['00:60.000','00:01,000','00:01.01'])assert.ok(codes(inspect(`WEBVTT\n\n${bad} --> 00:03.000\n문장`)).includes('timestamp'));
  assert.ok(codes(inspect(cue(1,'00:00:03,000','00:00:03,000','문장'))).includes('time-range'));
  assert.ok(codes(inspect(cue(1,'00:00:03,000','00:00:02,000','문장'))).includes('time-range'));
});
test('WebVTT retains headers, settings, identifiers, notes and styling without executing markup',()=>{
  const original='WEBVTT 자막 제목\nLanguage: ko\n\nSTYLE\n::cue(#first) { color: lime; }\n\nREGION\nid:left\nwidth:50%\n\nNOTE 설명\n\nfirst\n00:00.000 --> 00:02.000 align:start region:left\n<v 유호><b>시작</b> &amp; 확인\n\nNOTE 마지막 주석\n';
  const report=inspect(original);assert.equal(report.format,'vtt');assert.equal(report.errors,0);assert.equal(report.cues[0].identifier,'first');assert.equal(report.cues[0].settings,'align:start region:left');assert.equal(serialize(report),original);assert.equal(transcript(report),'[유호] 시작 & 확인');
});
test('WebVTT overlap is a review note rather than an error and nested overlaps are found',()=>{
  const report=inspect('WEBVTT\n\n00:00.000 --> 00:10.000\n긴 대사\n\n00:01.000 --> 00:02.000\n답변\n\n00:03.000 --> 00:04.000\n다음 답변');assert.equal(report.errors,0);assert.equal(report.overlaps,2);assert.equal(report.cues[2].issueCount,1);assert.equal(report.issues.find(row=>row.code==='overlap').severity,'warning');assert.match(serialize(report),/00:03\.000 --> 00:04\.000/);
});
test('sorting needs explicit selection and never changes original timing or drops empty text',()=>{
  const report=inspect(cue(8,'00:00:05,000','00:00:06,000','늦은 문장')+'\n\n'+cue(3,'00:00:01,000','00:00:02,000',''));
  assert.equal(report.orderCount,1);assert.ok(codes(report).includes('empty-cue'));assert.throws(()=>serialize(report),/순서로 정리/);const output=serialize(report,{sort:true});assert.ok(output.indexOf('00:00:01,000')<output.indexOf('00:00:05,000'));assert.match(output,/00:00:01,000 --> 00:00:02,000\n\n\n2\n/);assert.equal(report.cues[0].identifier,'8');
});
test('interleaved VTT comments prevent automatic sorting that could change their meaning',()=>{
  const report=inspect('WEBVTT\n\n00:03.000 --> 00:04.000\n먼저\n\nNOTE 앞 장면 확인\n\n00:01.000 --> 00:02.000\n뒤에');assert.equal(report.errors,0);assert.equal(report.metadataAfterCue,true);assert.throws(()=>serialize(report,{sort:true}),/주석이나 설정/);
});
test('malformed blocks, missing cue separators and duplicate VTT identifiers cannot silently disappear',()=>{
  for(const original of [cue(1,'00:00:00,000','00:00:01,000','말')+'\n\n이 블록은 깨졌어요','WEBVTT\n00:01.000 --> 00:02.000\n빈 줄 누락',cue(1,'00:00:00,000','00:00:01,000','말')+'\n2\n00:00:01,000 --> 00:00:02,000\n두 번째 말','WEBVTT\n\nsame\n00:01.000 --> 00:02.000\n말\n\nsame\n00:02.000 --> 00:03.000\n다른 말']){
    const report=inspect(original);assert.ok(report.errors>0);assert.throws(()=>serialize(report),/형식 오류/);
  }
});
test('VTT metadata must precede cues and metadata arrows are diagnosed',()=>{
  assert.ok(codes(inspect('WEBVTT\n\n00:01.000 --> 00:02.000\n말\n\nSTYLE\n::cue {color:red}')).includes('metadata-position'));
  assert.ok(codes(inspect('WEBVTT\n\nNOTE 잘못된 --> 주석\n\n00:01.000 --> 00:02.000\n말')).includes('metadata-arrow'));
});
test('long-line, fast-reading and line-count checks are advisory with explicit adjustable limits',()=>{
  const report=inspect(cue(1,'00:00:00,000','00:00:00,500','가'.repeat(43)+'\n다\n라'));assert.equal(report.errors,0);assert.ok(codes(report).includes('long-line'));assert.ok(codes(report).includes('reading-speed'));assert.ok(codes(report).includes('many-lines'));assert.equal(inspect(cue(1,'00:00:00,000','00:00:01,000','가'.repeat(43)),{maxCps:100,maxLine:100}).warnings,0);
  assert.throws(()=>inspect('x',{maxCps:0}),/읽기 기준/);assert.throws(()=>inspect('x',{maxLine:9}),/읽기 기준/);
});
test('Unicode reading count uses visible graphemes and transcript retains unknown tags as text',()=>{
  const report=inspect(cue(1,'00:00:00,000','00:00:02,000','👨‍👩‍👧‍👦 e\u0301 가'));assert.equal(report.cues[0].characters,3);
  const tagged=inspect(cue(1,'00:00:00,000','00:00:02,000','<script>alert(1)</script> <b>문장</b>'));assert.ok(codes(tagged).includes('unknown-markup'));assert.equal(transcript(tagged),'<script>alert(1)</script> 문장');
});
test('UTF-8 byte and cue limits prevent oversized inputs, while issue rendering is bounded',()=>{
  assert.throws(()=>inspect('가'.repeat(700000)),/2MiB/);
  const repeated=Array.from({length:10001},(_,index)=>cue(index+1,'00:00:00,000','00:00:01,000','가')).join('\n\n');assert.throws(()=>inspect(repeated),/10,000/);
  const report=inspect(Array.from({length:600},()=>cue(1,'00:00:00,000','00:00:01,000','가'.repeat(45))).join('\n\n'));assert.equal(report.issues.length,1000);assert.ok(report.issueCount>1000);
});
test('empty, invalid extension-header, control characters and encoding replacement are reported',()=>{
  assert.ok(codes(inspect('  ')).includes('empty-file'));assert.ok(codes(inspect(cue(1,'00:00:00,000','00:00:02,000','말'),{fileName:'broken.vtt'})).includes('vtt-header'));
  assert.ok(codes(inspect(cue(1,'00:00:00,000','00:00:02,000','\u0000말'))).includes('control-character'));assert.ok(codes(inspect(cue(1,'00:00:00,000','00:00:02,000','�말'))).includes('encoding'));
  assert.equal(inspect(cue(1,'00:99:00,000','00:00:02,000','말')).durationMs,null);
});
test('UI escapes all cue markup, uses local-file wording and bounds the rendered cue list',()=>{
  const f=client();f.context.text=Array.from({length:80},(_,index)=>cue(index+1,'00:00:00,000','00:00:02,000','<script>alert(1)</script>')).join('\n\n');f.evaluate('subtitleLab.text=text;subtitleLab.report=subtitleInspect(text);');const html=f.evaluate('subtitleLabPanel()');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));assert.equal((html.match(/class="sl-cue"/g)||[]).length,40);assert.match(html,/서버로 보내지 않고 원본도 고치지 않아요/);assert.match(html,/플랫폼 합격 기준은 아니에요/);
  // CSP style-src 'self': 인라인 style 없이 클래스·data 속성만, 검은 알약은 「검사하기」 하나.
  assert.ok(!/\sstyle=/.test(html));assert.equal((html.match(/class="btn primary"/g)||[]).length,1);
});
test('UI shows poster numbers only after a check and meters empty, overlapping and fast cues the checker found',()=>{
  const f=client(),empty=f.evaluate('subtitleLabPanel()');
  assert.match(empty,/SYNK MAKER · SUBTITLE/);assert.ok(!empty.includes('mt-poster-stats'));assert.ok(!empty.includes('data-subtitle-result'));assert.match(empty,/<label class="mt-drop[^"]*"><input type="file"[^>]*data-subtitle-file/);assert.match(empty,/UTF-8 · 2MiB · 자막 10,000개까지/);
  f.context.text=[cue(1,'00:00:00,000','00:00:02,000','첫 문장'),cue(2,'00:00:01,500','00:00:03,000','겹친 문장'),cue(3,'00:00:04,000','00:00:04,500','아주 빠르게 지나가는 긴 문장입니다'),cue(4,'00:00:05,000','00:00:06,000','')].join('\n\n');
  f.evaluate('subtitleLab.report=subtitleInspect(text)');const html=f.evaluate('subtitleLabPanel()');
  assert.match(html,/<dt>자막<\/dt><dd>4<\/dd>/);assert.match(html,/<dt>문제<\/dt><dd>3<\/dd>/);
  for(const [label,value] of [['자막',4],['빈 자막',1],['겹침',1],['빠른 자막',1]])assert.match(html,new RegExp(`<span>${label}</span><strong>${value}<small>개</small>`));
  for(const label of ['빈 자막','겹침','빠름'])assert.ok(html.includes(`<span class="mt-badge" data-tone="wait">${label}</span>`),label);
  assert.match(html,/data-action="subtitle-download"/);assert.match(html,/data-action="subtitle-transcript"/);assert.equal((html.match(/class="btn primary"/g)||[]).length,1);
});
test('UI bounds cue rows and file-level notes separately and marks unknown ending times as unconfirmed',async()=>{
  const f=client();f.context.text=Array.from({length:50},(_,index)=>cue(index+1,'00:00:00,000','00:00:01,000','가'.repeat(43))).join('\n\n');f.evaluate('subtitleLab.report=subtitleInspect(text)');const before=f.evaluate('subtitleLabPanel()');
  const notes=count=>f.evaluate(`subtitleLab.report.cues.slice(0,${count}).reduce((sum,row)=>sum+row.issueCount,0)`);assert.equal((before.match(/class="sl-cue"/g)||[]).length,40);assert.equal((before.match(/class="sl-issue"/g)||[]).length,notes(40));assert.ok(before.includes('data-action="subtitle-more"'));
  await f.handlers.get('click')({target:{closest:()=>({dataset:{action:'subtitle-more'},disabled:false})}});const after=f.evaluate('subtitleLabPanel()');assert.equal((after.match(/class="sl-cue"/g)||[]).length,50);assert.equal((after.match(/class="sl-issue"/g)||[]).length,notes(50));
  f.context.text=Array.from({length:120},(_,index)=>`시간 줄 없는 덩어리 ${index+1}`).join('\n\n');f.evaluate('subtitleLab.issueLimit=80;subtitleLab.report=subtitleInspect(text)');const loose=f.evaluate('subtitleLabPanel()');
  assert.equal((loose.match(/class="mt-issue sl-loose"/g)||[]).length,80);assert.ok(loose.includes('subtitle-more-issues'));
  await f.handlers.get('click')({target:{closest:()=>({dataset:{action:'subtitle-more-issues'},disabled:false})}});assert.ok((f.evaluate('subtitleLabPanel()').match(/class="mt-issue sl-loose"/g)||[]).length>80);
  f.context.text=cue(1,'00:99:00,000','00:00:02,000','말');f.evaluate('subtitleLab.report=subtitleInspect(text)');assert.match(f.evaluate('subtitleLabPanel()'),/끝 시각 미확인/);
});
test('SRT leading blank lines no longer break the first cue and keep source line numbers, while VTT still needs WEBVTT first',()=>{
  const report=inspect('\n \n'+cue(1,'00:00:00,000','00:00:02,000','첫 문장')+'\n\n'+cue(2,'00:00:02,000','00:00:03,000','둘째'));
  assert.equal(report.errors,0);assert.equal(report.cues.length,2);assert.deepEqual([...report.cues.map(row=>row.line)],[3,7]);
  assert.equal(serialize(report),cue(1,'00:00:00,000','00:00:02,000','첫 문장')+'\n\n'+cue(2,'00:00:02,000','00:00:03,000','둘째')+'\n');
  const vtt=inspect('\nWEBVTT\n\n00:01.000 --> 00:02.000\n문장');assert.equal(vtt.format,'vtt');assert.deepEqual([...codes(vtt)],['vtt-header']);assert.equal(vtt.cues.length,1);
});
test('reading-limit boxes treat an empty value as missing, the form never blocks on the folded boxes, and a bad limit opens them',()=>{
  const f=client();assert.match(f.evaluate('subtitleLabPanel()'),/<form class="sl-form" id="subtitle-lab-form" data-subtitle-form novalidate>/);
  f.handlers.get('input')({target:{value:'',dataset:{subtitleThreshold:'maxCps'},matches:selector=>selector.includes('[data-subtitle-threshold]')}});
  assert.ok(Number.isNaN(f.evaluate('subtitleLab.maxCps')));const blank=f.evaluate('subtitleLabPanel()');assert.match(blank,/name="maxCps"[^>]*value=""/);assert.match(blank,/초당 — · 한 줄 42자/);
  f.context.form={matches:()=>true,querySelector:()=>({value:cue(1,'00:00:00,000','00:00:01,000','말')}),elements:{namedItem:name=>({value:name==='maxCps'?'0':'42'})}};
  f.handlers.get('submit')({target:f.context.form,preventDefault(){}});
  assert.match(f.evaluate('subtitleLab.error'),/읽기 기준/);assert.equal(f.evaluate('subtitleLab.maxCps'),0);assert.match(f.evaluate('subtitleLabPanel()'),/id="subtitle-lab-options" open>/);assert.doesNotMatch(f.evaluate('subtitleLabPanel()'),/id="subtitle-lab-options" open>/);
});
test('typing while a file is being read unlocks the check button and file box without a full redraw',()=>{
  const f=client(),title={textContent:'파일을 읽고 있어요…'},hint={textContent:'UTF-8'},submit={disabled:true,textContent:'읽는 중…'},removed=[],error={hidden:false};
  const drop={classList:{remove:(...names)=>removed.push(...names),toggle:(name,on)=>{if(!on)removed.push(name);}},querySelector:selector=>selector==='strong'?title:hint};
  const file={disabled:true,value:'a.srt',closest:()=>drop},form={querySelector:selector=>selector==='button[type=submit]'?submit:selector==='[data-subtitle-file]'?file:null,querySelectorAll:()=>[error]};
  f.context.document.querySelector=selector=>selector==='[data-subtitle-form]'?form:{hidden:false};
  f.evaluate('subtitleLab.busy=true;subtitleLab.fileName="a.srt";subtitleLab.error="지난 오류"');const renders=f.renders;
  f.handlers.get('input')({target:{value:'1',matches:selector=>selector.includes('[data-subtitle-text]')}});
  assert.equal(f.evaluate('subtitleLab.busy'),false);assert.equal(f.renders,renders);assert.equal(submit.disabled,false);assert.equal(submit.textContent,'검사하기');assert.equal(error.hidden,true);
  assert.equal(file.disabled,false);assert.equal(file.value,'');assert.equal(title.textContent,'SRT·VTT 파일 고르기');assert.ok(removed.includes('is-disabled')&&removed.includes('is-set'));
});
test('late file reads cannot reveal a former account file or replace a newer file',async()=>{
  const f=client();let resolveOld;f.context.file={name:'비공개.srt',size:100,text:()=>new Promise(resolve=>{resolveOld=resolve;})};const old=f.evaluate('subtitleLabFile(file)');f.context.state.user={id:'B'};f.evaluate('subtitleLabIdentity()');resolveOld(cue(1,'00:00:00,000','00:00:02,000','비공개'));await old;assert.equal(f.evaluate('subtitleLab.text'),'');assert.equal(f.evaluate('subtitleLab.userId'),'B');
  let resolveSlow;f.context.file={name:'느림.srt',size:100,text:()=>new Promise(resolve=>{resolveSlow=resolve;})};const slow=f.evaluate('subtitleLabFile(file)');f.context.file={name:'최신.srt',size:100,text:async()=>cue(1,'00:00:00,000','00:00:02,000','최신')};await f.evaluate('subtitleLabFile(file)');resolveSlow(cue(1,'00:00:00,000','00:00:02,000','느림'));await slow;assert.equal(f.evaluate('subtitleLab.fileName'),'최신.srt');assert.match(f.evaluate('subtitleLab.text'),/최신/);
});
test('typing after a file read invalidates its report and blocks a pending read from overwriting pasted text',async()=>{
  const f=client();let resolveFile;f.context.file={name:'늦음.srt',size:100,text:()=>new Promise(resolve=>{resolveFile=resolve;})};const pending=f.evaluate('subtitleLabFile(file)');const text=cue(1,'00:00:00,000','00:00:02,000','직접 입력');
  f.handlers.get('input')({target:{value:text,matches:selector=>selector.includes('[data-subtitle-text]')}});resolveFile(cue(1,'00:00:00,000','00:00:02,000','옛 파일'));await pending;assert.equal(f.evaluate('subtitleLab.text'),text);assert.equal(f.evaluate('subtitleLab.report'),null);assert.equal(f.evaluate('subtitleLab.busy'),false);
});
test('download creates a new local blob filename and releases its object URL',async()=>{
  const f=client();f.context.text=cue(1,'00:00:00,000','00:00:02,000','문장');f.evaluate('subtitleLab.text=text;subtitleLab.fileName="원본.srt";subtitleLab.report=subtitleInspect(text);');await f.handlers.get('click')({target:{closest:()=>({dataset:{action:'subtitle-download'},disabled:false})}});assert.equal(f.downloads.length,1);assert.equal(f.downloads[0].download,'원본_정리본.srt');assert.equal(f.urls.length,1);assert.equal(await f.urls[0].text(),f.evaluate('subtitleSerialize(subtitleLab.report)'));assert.equal(f.revoked[0],'blob:local-1');
});
test('clipboard failures show escaped fallback only while the same account and document are current',async()=>{
  const f=client();f.context.text=cue(1,'00:00:00,000','00:00:02,000','<script>악성</script>');f.evaluate('subtitleLab.report=subtitleInspect(text);');f.context.navigator.clipboard.writeText=async()=>{throw new Error('blocked');};await f.handlers.get('click')({target:{closest:()=>({dataset:{action:'subtitle-copy'},disabled:false})}});assert.equal(f.modals.length,1);assert.ok(f.modals[0][2].includes('&lt;script&gt;'));
  let reject;f.context.navigator.clipboard.writeText=()=>new Promise((resolve,no)=>{reject=no;});const copying=f.handlers.get('click')({target:{closest:()=>({dataset:{action:'subtitle-copy'},disabled:false})}});f.context.state.user={id:'C'};f.evaluate('subtitleLabIdentity()');reject(new Error('blocked'));await copying;await flush();assert.equal(f.modals.length,1);assert.equal(f.notifications.length,0);
});
