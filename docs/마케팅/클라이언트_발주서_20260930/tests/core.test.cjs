const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js');
const RETIRED=['goal','familiarity','firstReviewFocus','firstReviewNotes','successMetric','successTarget','measurementPeriod','cta','approval','count','productVariants','intro','usageSituation','purchaseBarrier','difference','proof','genres','moods','colors','roles','background','camera','preserve','allowedChanges','previousContentUrl','previousContentNotes','offerMode','production','audio','transformRange','transformChanges','shootLocation','shootReady','hybridScope','script'];

test('remaining choices retain Other without retired questions or recommendation choices',()=>{
  for(const options of Object.values(C.OPTIONS)){assert.equal(options.filter(([id])=>id==='other').length,1);assert(!options.some(([,label])=>label==='추천받기'));}
  for(const key of RETIRED){assert(!Object.hasOwn(C.OPTIONS,key));assert(!Object.hasOwn(C.LABELS,key));assert(!C.NOTE_KEYS.includes(key));assert(!C.MULTI.has(key));assert(!C.SECTIONS.some(s=>s[2].includes(key)));}
  assert(C.OPTIONS.permission.some(([id])=>id==='pending'));assert(!C.OPTIONS.permission.some(([id])=>id==='consult'));
});
test('remaining notes-only and Other answers survive version-one round-trip and reports',()=>{
  const d={...C.defaults(),subject:'메모 확인',appearanceTarget:'other',scenes:['whole','other'],fieldNotes:{appearanceTarget:'제품 사진에 그래픽 설명',scenes:'포장 여는 장면도 포함',format:'선택 없이 남긴 형식 설명',budget:'월별로 나눠 진행'},assetStatus:{logo:'other'},assetNotes:{logo:'이 로고는 임시본'}};
  const copy=C.sanitize(JSON.parse(JSON.stringify(C.effective(d))));
  for(const report of [C.reportHtml(copy),C.reportText(copy)])for(const note of Object.values(d.fieldNotes))assert(report.includes(note));
  const attached=[{name:'logo.png',size:5,category:'logo'}];assert.equal(C.assetRows(copy,attached).find(a=>a.id==='logo').status,'첨부 완료');
  for(const report of [C.reportHtml(copy,attached),C.reportText(copy,attached)])assert(report.includes('이 로고는 임시본'));
  assert.deepEqual(C.validation(copy),[]);
});
test('notes are safely imported and conditional notes stay out of exports',()=>{
  const d=C.sanitize({model:'none',channels:['instagram'],fieldNotes:{model:'제품만 보여주세요',modelCount:'숨은 인원',permission:'숨은 허락',primaryChannel:'숨은 채널',appearanceTarget:'<img src=x onerror=alert(1)>',unknown:'버림',budget:42},assetNotes:{model:'숨은 사진',product:'제품 자료 메모',unknown:'버림'}}),clean=C.effective(d);
  assert.deepEqual(Object.keys(clean.fieldNotes).sort(),['appearanceTarget','model']);assert.deepEqual(clean.assetNotes,{product:'제품 자료 메모'});
  assert(!C.reportHtml(clean).includes('<img '));assert(C.reportHtml(clean).includes('&lt;img'));assert(!C.reportText(clean).includes('숨은'));
  assert.equal(C.sanitize({fieldNotes:{appearanceTarget:'a'.repeat(2100)}}).fieldNotes.appearanceTarget.length,2000);
});
test('conditional model answers and attachments cannot leak into a project without a model',()=>{
  const d={model:'none',permission:'approved',modelDetails:'이전 인물 기준',identityRules:'이전 인물 주의사항',deadlineMode:'flexible',deadline:'2099-01-01',attachments:[{name:'person.jpg',size:50,category:'model'},{name:'product.jpg',size:10,category:'product'}]};
  const a=C.effective(d);for(const k of ['permission','modelDetails','identityRules','deadline'])assert.equal(a[k],'');assert.deepEqual(a.attachments.map(x=>x.name),['product.jpg']);
});
test('imports only recognized values and keeps ordinary Korean without prototype pollution',()=>{
  const d=C.sanitize(JSON.parse('{"subject":"테스트 브랜드","channels":["instagram","evil","instagram"],"primaryChannel":"evil","scenes":["detail","consult","detail"],"assetStatus":{"model":"approved"},"__proto__":{"polluted":true}}'));
  assert.equal(d.subject,'테스트 브랜드');assert.deepEqual(d.channels,['instagram']);assert.deepEqual(d.scenes,['detail']);assert.equal(d.primaryChannel,'');assert.equal(d.assetStatus.model,undefined);assert.equal({}.polluted,undefined);
});
test('report escapes active markup and lists missing attachments separately',()=>{
  const d={subject:'<script>alert(1)</script>',message:'A & B',references:[{url:'https://example.com',likes:'<img src=x onerror=alert(1)>'}],attachments:[{name:'빠진자료.png',size:3,category:'product'}]},html=C.reportHtml(d);
  assert(!html.includes('<script>'));assert(!html.includes('<img '));assert(html.includes('&lt;script&gt;'));assert(html.includes('재첨부 필요 (현재 패키지에 없음): 빠진자료.png'));assert(C.reportText(d).includes('https://example.com'));
});
test('footage stays optional while person and output specifications remain conditional',()=>{
  const d=C.defaults();assert.deepEqual(C.activeAssets(d).map(x=>x.id),['product','logo','footage','reference','brand']);assert(!C.activeAssets(d).find(x=>x.id==='footage').essential);
  Object.assign(d,{model:'reference',channels:['tv']});for(const id of ['model','spec'])assert(C.activeAssets(d).some(x=>x.id===id&&x.essential));assert(!C.activeAssets(d).some(x=>x.id==='script'));
});
test('subtitle language and mandatory on-screen copy remain separate report requirements',()=>{
  const d=C.effective({language:'영어 자막',onScreenText:'가상 제품의 필수 문구'});assert.equal(d.language,'영어 자막');assert.equal(d.onScreenText,'가상 제품의 필수 문구');assert(C.reportText(d).includes('자막 언어: 영어 자막'));assert(C.reportText(d).includes('가상 제품의 필수 문구'));
});
test('retired version-one values and notes never return through JSON reports or ZIP',async()=>{
  const raw={subject:'구버전 발주서',audience:'20대 고객',message:'남길 문구',offerDetails:'그대로 남길 실제 혜택',language:'한국어 자막',fieldNotes:{},assetStatus:{script:'ready',footage:'ready'},assetNotes:{script:'RETIRED_script_asset',footage:'원본 영상 메모'},attachments:[{name:'RETIRED_script.txt',size:9,category:'script'},{name:'원본.mp4',size:12,category:'footage'}]};
  for(const key of RETIRED){raw[key]='RETIRED_'+key;raw.fieldNotes[key]='RETIRED_NOTE_'+key;}
  const imported=C.sanitize(JSON.parse(JSON.stringify(raw))),clean=C.effective(imported);
  for(const d of [C.defaults(),imported,clean])for(const key of RETIRED){assert(!Object.hasOwn(d,key),key);assert(!Object.hasOwn(d.fieldNotes,key),key);}
  assert.equal(clean.audience,raw.audience);assert.equal(clean.message,raw.message);assert.equal(clean.offerDetails,raw.offerDetails);assert.equal(clean.sceneNote,'');assert.equal(clean.productFacts,'');
  assert.deepEqual(clean.attachments,[{name:'원본.mp4',size:12,category:'footage'}]);assert.deepEqual(clean.assetNotes,{footage:'원본 영상 메모'});
  const outputs=[JSON.stringify(clean),C.reportHtml(raw),C.reportText(raw),C.questions(raw).join('\n')];
  const zip=await C.zip(outputs.map((data,i)=>({name:'문서'+i+'.txt',data})));outputs.push(new TextDecoder().decode(await zip.arrayBuffer()));
  for(const out of outputs){assert(!out.includes('RETIRED_'));assert(!out.includes('추천받기'));assert(!out.includes('소리 구성'));assert(!out.includes('제작 방식'));}
  assert(C.reportText(raw).includes('한국어 자막'));assert(C.reportText(raw).includes('원본.mp4'));
});
test('name is the only unconditional requirement; selected length and date still validate',()=>{
  const d=C.defaults();assert.deepEqual(C.validation(d).map(x=>x.key),['subject']);d.subject='검증';assert.deepEqual(C.validation(d),[]);assert.deepEqual(C.questions(d),[]);
  d.assetLink='javascript:alert(1)';assert.equal(C.validation(d)[0].key,'assetLink');d.assetLink='https://example.com/assets';d.duration='custom';assert.equal(C.validation(d)[0].key,'customDuration');d.customDuration='45초';d.deadlineMode='fixed';d.deadline='2000-01-01';assert.equal(C.validation(d)[0].key,'deadline');
});
test('remaining promotion, notes, priorities and baseline images survive round-trip',()=>{
  const added={offerDetails:'10월 말까지 두 장 구매 혜택',destinationUrl:'https://example.com/promotion',baselineNotes:'자연광에서 찍은 사진이 색상 기준'};
  const image={name:'최종_색상.png',size:27,category:'product'},d={...C.defaults(),...added,subject:'가을 셔츠',subjectType:'fashion',distribution:'paid',scenes:['detail','walk'],scenePriority:{detail:'must',walk:'prefer'},baselineImages:{color:image},attachments:[image],fieldNotes:{distribution:'브랜드 계정에서 집행'}};
  const copy=C.sanitize(JSON.parse(JSON.stringify(C.effective(d))));for(const [key,value] of Object.entries(added))assert.equal(copy[key],value);assert.deepEqual(copy.scenePriority,d.scenePriority);assert.deepEqual(copy.baselineImages,d.baselineImages);assert.deepEqual(C.validation(copy),[]);
  for(const report of [C.reportHtml(copy,[image]),C.reportText(copy,[image])]){for(const value of Object.values(added))assert(report.includes(value),value);assert(report.includes('브랜드 계정에서 집행'));assert(report.includes('소재·디테일 가까이 (반드시 포함)'));assert(report.includes('모델 포즈·워킹 (가능하면 포함)'));assert(report.includes('최종_색상.png'));assert(report.includes('현재 첨부됨'));}
});
test('five-row summary uses only remaining supplied information with accurate edit routes',()=>{
  const missing=C.strategy(C.defaults());assert.deepEqual(missing.map(row=>[row.key,row.step]),[['project',0],['message',1],['direction',2],['usage',3],['schedule',5]]);assert(missing.every(row=>row.value==='입력한 내용이 없어요'));
  const rows=C.strategy({subject:'셔츠',subjectType:'fashion',primaryProduct:'크림 M',audience:'직장인',message:'하루 종일 편하게',requiredNotices:'세탁 안내',scenes:['detail'],sceneNote:'앞면부터',references:[{url:'https://example.com/ref',likes:'옆광'}],channels:['instagram'],duration:'15',deadlineMode:'flexible',scheduleNotes:'공개 전 검토',difference:'RETIRED difference',cta:'RETIRED cta',proof:'RETIRED proof'});
  assert.equal(rows[0].value,'셔츠\n크림 M');assert.equal(rows[1].value,'대상: 직장인\n하루 종일 편하게\n필수 표기: 세탁 안내');assert(rows[2].value.includes('앞면부터'));assert(rows[2].value.includes('https://example.com/ref'));assert(rows[3].value.includes('인스타그램'));assert(rows[3].value.includes('15초'));assert(rows[4].value.includes('공개 전 검토'));assert(!JSON.stringify(rows).includes('RETIRED'));
});

test('unselected scene priorities are discarded and unranked scenes never become mandatory',()=>{
  const raw=JSON.parse('{"scenes":["detail","walk","logo","other"],"scenePriority":{"detail":"must","walk":"prefer","logo":"invented","whole":"must","other":"prefer","__proto__":{"polluted":true}},"fieldNotes":{"scenes":"다른 장면은 최종 상담 때"}}');
  const d=C.effective(raw);
  assert.deepEqual(d.scenePriority,{detail:'must',walk:'prefer',other:'prefer'});
  assert.equal({}.polluted,undefined);
  assert(C.display(d,'scenes').includes('로고·메시지 마무리 (우선순위 미지정)'));
  assert(!C.display(d,'scenes').includes('로고·메시지 마무리 (반드시 포함)'));
  d.scenes=['logo'];
  assert.deepEqual(C.effective(d).scenePriority,{});
  assert.deepEqual(C.sanitize({scenePriority:['must']}).scenePriority,{});
});
test('baseline references require valid product images and attachment identity before showing attached',()=>{
  const color={name:'색상.JPG',size:8,category:'product'},fit={name:'착장.webp',size:12,category:'product'},raw={subjectType:'fashion',baselineImages:{color,fit,length:{name:'문서.pdf',size:1,category:'product'},detail:{name:'영상.png',size:1,category:'reference'},unknown:color},attachments:[color,fit]};
  assert.deepEqual(C.sanitize(raw).baselineImages,{color,fit});
  const rows=C.baselineRows(raw,[{...color,category:'reference'},{...color,size:9},fit]);
  assert.deepEqual(rows.map(({key,label,name,attached})=>({key,label,name,attached})),[{key:'color',label:'색상',name:color.name,attached:false},{key:'fit',label:'핏',name:fit.name,attached:true}]);
  assert(C.baselineRows(raw,[color,fit]).every(row=>row.attached));
  for(const report of [C.reportHtml(raw,[fit]),C.reportText(raw,[fit])]){assert(report.includes(color.name));assert(report.includes('재첨부 필요 (현재 패키지에 없음)'));assert(report.includes('현재 첨부됨'));}
  const invalid=C.sanitize({baselineImages:{color:{name:'x.png',size:-1,category:'product'},fit:{name:'x.png',size:1.5,category:'product'},length:{name:'x.svg',size:1,category:'product'},detail:{name:'x.png',size:'1',category:'product'}}});
  assert.deepEqual(invalid.baselineImages,{});
  assert.deepEqual(C.sanitize({baselineImages:[]}).baselineImages,{});
  const hostile={subjectType:'fashion',baselineImages:{color:{name:'<img src=x onerror=alert(1)>.png',size:1,category:'product'}},baselineNotes:'<script>alert(1)</script>'};
  const html=C.reportHtml(hostile);
  assert(!html.includes('<img '));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert(html.includes('&lt;script&gt;'));
});
test('actual offer text stays optional and independent of removed toggles',()=>{
  const image={name:'기준.png',size:1,category:'product'},raw={subjectType:'fashion',offerDetails:'실제 혜택 안내',offerMode:'no',successTarget:'RETIRED target',measurementPeriod:'RETIRED period',baselineNotes:'의류 사진 기준',baselineImages:{color:image,fit:image,length:image,detail:image}};
  for(const distribution of ['organic','paid','both','']){const d=C.effective({...raw,distribution});assert.equal(d.offerDetails,raw.offerDetails);assert(!Object.hasOwn(d,'offerMode'));assert(!Object.hasOwn(d,'successTarget'));assert(!JSON.stringify(d).includes('RETIRED'));}
  const product=C.effective({...raw,subjectType:'product'});assert.deepEqual(Object.keys(product.baselineImages),['color','detail']);
  const service=C.effective({...raw,subjectType:'service'});assert.deepEqual(service.baselineImages,{});assert.equal(service.baselineNotes,'');assert(C.reportText(service).includes(raw.offerDetails));
});

test('new links and reference validation return their current wizard steps',()=>{
  const d={...C.defaults(),subject:'링크 검증',productUrl:'javascript:alert(1)',assetLink:'file:///c:/private',destinationUrl:'data:text/html,bad',references:[{url:'ftp://example.com',likes:''}]};
  assert.deepEqual(C.validation(d).map(({key,step})=>({key,step})),[{key:'productUrl',step:0},{key:'assetLink',step:4},{key:'destinationUrl',step:1},{key:'ref-url-0',step:2}]);
  for(const key of ['productUrl','assetLink','destinationUrl'])d[key]='https://example.com/'+key;
  d.references[0].url='http://example.com/reference';assert.deepEqual(C.validation(d),[]);
});
test('ZIP contains valid headers, CRC and UTF8 names with unchanged file bytes',async()=>{const source=Uint8Array.of(0,1,2,3,254,255),entries=[{name:'01_발주서.txt',data:'제품 광고\n한글 테스트'},{name:'자료/제품.png',data:new Blob([source])}],blob=await C.zip(entries),bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),dec=new TextDecoder();let offset=0;for(const entry of entries){assert.equal(view.getUint32(offset,true),0x04034b50);assert.equal(view.getUint16(offset+6,true),0x800);const len=view.getUint16(offset+26,true),size=view.getUint32(offset+18,true),body=bytes.slice(offset+30+len,offset+30+len+size);assert.equal(dec.decode(bytes.slice(offset+30,offset+30+len)),entry.name);assert.equal(C.crc32(body),view.getUint32(offset+14,true));if(entry.name.endsWith('.png'))assert.deepEqual(body,source);else assert.equal(dec.decode(body),entry.data);offset+=30+len+size;}assert.equal(view.getUint32(offset,true),0x02014b50);assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);assert.equal(view.getUint16(bytes.length-12,true),2);assert.equal(C.crc32(new TextEncoder().encode('123456789')),0xcbf43926);});

test('production requirements, source roles and claims survive version-one import and reports',()=>{
  const file={name:'셔츠_앞.jpg',size:30,category:'product'};
  const added={primaryProduct:'셔츠A 크림 M 2026년형',productFacts:'면 100퍼센트, 총장 72cm',productLocks:'단추 5개와 라벨 유지',usageSteps:'착용하고 소매를 접어요',actualOutcome:'움직일 때 옆트임이 보여요',identityRules:'단발머리 유지',requiredNotices:'측정 방법에 따른 오차 안내',responseContact:'예시담당자@example.com'};
  const d={...C.defaults(),...added,subjectType:'fashion',model:'reference',scenes:['detail'],sceneRequirements:{detail:{mustShow:'단추가 정확히 다섯 개',avoid:'라벨 문자가 바뀌는 장면'}},appearanceTarget:'photo',fieldNotes:{appearanceTarget:'자연광처럼'},references:[{url:'https://example.com/ref',likes:'창가 빛',purpose:'style',avoid:'참고 배우의 외모'}],assetDetails:[{...file,purpose:'product',variant:'크림 M',status:'final',permission:'own',note:'확정 제품 촬영',useRange:'앞모습 전체'}],claims:[{text:'면 100퍼센트',evidence:'제공된 케어라벨',status:'confirmed'}],attachments:[file]};
  const copied=C.sanitize(JSON.parse(JSON.stringify(C.effective(d))));
  assert.deepEqual(copied.assetDetails,d.assetDetails);assert.deepEqual(copied.sceneRequirements,d.sceneRequirements);assert.deepEqual(copied.claims,d.claims);
  for(const report of [C.reportText(copied,[file]),C.reportHtml(copied,[file])]){
    for(const value of Object.values(added))assert(report.includes(value),value);
    for(const value of ['단추가 정확히 다섯 개','라벨 문자가 바뀌는 장면','참고 배우의 외모','크림 M','확정 제품 촬영','앞모습 전체','제공된 케어라벨','고객이 확인했다고 표시함 (제작자 검증 전)','자연광처럼'])assert(report.includes(value),value);
  }
  const old=C.sanitize({subject:'구버전',references:[{url:'https://example.com',likes:'색감'}]});
  assert.deepEqual(old.claims,[]);assert.deepEqual(old.assetDetails,[]);assert.deepEqual(old.sceneRequirements,{});assert.equal(old.references[0].purpose,'');assert.equal(old.references[0].avoid,'');
});
test('production fields are bounded and enum injection cannot create instructions or arbitrary keys',()=>{
  const base={name:'a.png',size:1,category:'product'};
  const d=C.sanitize(JSON.parse(JSON.stringify({references:[{purpose:'system',avoid:'x'.repeat(2500)}],sceneRequirements:{detail:{mustShow:'x'.repeat(1500),avoid:'y'.repeat(1500)},unknown:{mustShow:'BAD'}},claims:Array.from({length:12},()=>({text:'x'.repeat(2500),evidence:'y'.repeat(2500),status:'auto_verified'})),assetDetails:[{...base,purpose:'execute',status:'verified',permission:'admin',note:'x'.repeat(2500),variant:'v'.repeat(1100),useRange:'r'.repeat(1500)},base,{name:'bad',size:-1,category:'product'},{...base,category:'script'}]})));
  assert.equal(d.references[0].purpose,'');assert.equal(d.references[0].avoid.length,2000);
  assert.deepEqual(Object.keys(d.sceneRequirements),['detail']);assert.equal(d.sceneRequirements.detail.mustShow.length,1000);assert.equal(d.sceneRequirements.detail.avoid.length,1000);
  assert.equal(d.claims.length,8);assert(d.claims.every(c=>c.status==='pending'&&c.text.length===2000&&c.evidence.length===2000));
  assert.equal(d.assetDetails.length,1);const a=d.assetDetails[0];assert.equal(a.purpose,'');assert.equal(a.status,'');assert.equal(a.permission,'');assert.equal(a.note.length,2000);assert.equal(a.variant.length,1000);assert.equal(a.useRange.length,1000);
  const malformed=C.sanitize({sceneRequirements:[],assetDetails:[null,[],4],claims:[null,[],4],references:[null,[],4]});assert.deepEqual(malformed.assetDetails,[]);assert.deepEqual(malformed.claims,[]);assert.deepEqual(malformed.sceneRequirements,{});
});
test('hidden product, person and scene information never leaks into a different project',()=>{
  const f={name:'person.png',size:2,category:'model'};
  const d={subjectType:'brand',model:'none',primaryProduct:'HIDDEN primary',productFacts:'HIDDEN facts',productLocks:'HIDDEN lock',usageSteps:'HIDDEN steps',actualOutcome:'HIDDEN outcome',identityRules:'HIDDEN identity',scenes:['logo'],sceneRequirements:{detail:{mustShow:'HIDDEN scene',avoid:''}},assetDetails:[{...f,note:'HIDDEN file',permission:'own'}],attachments:[f]};
  const cleaned=C.effective(d);assert.deepEqual(cleaned.sceneRequirements,{});assert.deepEqual(cleaned.assetDetails,[]);
  for(const output of [JSON.stringify(cleaned),C.reportHtml(d),C.reportText(d)])assert(!output.includes('HIDDEN'));
  const service=C.effective({...d,subjectType:'service',usageSteps:'앱 실행',actualOutcome:'예약 확인'});assert.equal(service.usageSteps,'앱 실행');assert.equal(service.actualOutcome,'예약 확인');
});
test('asset detail matches category, filename and byte size and reports reference-only metadata',()=>{
  const f={name:'photo.jpg',size:2,category:'product'},d={assetDetails:[{...f,purpose:'proof',status:'reference',permission:'licensed',note:'원단 시험 사진'}]};
  assert.equal(C.assetDetail(d,f).note,'원단 시험 사진');assert.equal(C.assetDetail(d,{...f,size:3}).note,'');assert.equal(C.assetDetail(d,{...f,category:'reference'}).note,'');
  const report=C.reportText(d);assert(report.includes('재첨부 필요 (현재 패키지에 없음)'));assert(report.includes('원단 시험 사진'));
  const hostile={subjectType:'product',productFacts:'<script>bad</script>',sceneRequirements:{detail:{mustShow:'<img src=x>',avoid:'</dd>'}},scenes:['detail'],claims:[{text:'<svg>',evidence:'<script>',status:'confirmed'}],references:[{purpose:'style',avoid:'<iframe>'}],assetDetails:[{...f,note:'<video>'}]};
  const html=C.reportHtml(hostile);for(const tag of ['<script>','<img ','<svg>','<iframe>','<video>'])assert(!html.includes(tag));assert(html.includes('&lt;video&gt;'));
});
