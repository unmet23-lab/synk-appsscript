import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {CASTING_OPTIONS,castingFromForm,takeCastingValues,castingSummary,castingView,castingVoices,normalizeDemoCasting} from './public/pulse-app/casting-view.mjs';
import {normalizeCastingSelection} from './pulse-strategy.mjs';
import {strategyView,strategyHistory} from './public/pulse-app/strategy-view.mjs';
import {createDemoSession} from './public/pulse-app/demo.mjs';

test('demo casting and server use matching options and reject invalid combinations',()=>{
  for(const model of CASTING_MODELS)for(const voice of ['','A','B','C']){
    const selection={modelId:model.id,voice};assert.deepEqual(normalizeDemoCasting(selection),normalizeCastingSelection(selection));
  }
  for(const [key,{values}]of Object.entries(CASTING_OPTIONS))for(const value of Object.keys(values))assert.deepEqual(normalizeDemoCasting({[key]:value}),normalizeCastingSelection({[key]:value}));
  for(const invalid of [{voice:'A'},{modelId:'unlisted'},{hair:'unknown'},{notes:'bad\u0000'},{notes:'x'.repeat(1001)},{unexpected:'secret'}])assert.throws(()=>normalizeDemoCasting(invalid));
});
test('read-only fields still produce an accurate selection and submission strips only casting UI keys',()=>{
  const form={elements:[{name:'cast_modelId',type:'radio',value:'F01',checked:true,disabled:true},{name:'cast_modelId',type:'radio',value:'M01',checked:false,disabled:true},{name:'cast_voice',type:'radio',value:'B',checked:true,disabled:true},{name:'cast_notes',type:'textarea',value:'메모',disabled:true}]};
  assert.equal(castingFromForm(form).modelId,'F01');assert.equal(castingFromForm(form).voice,'B');
  const values={product:'기존 제품',cast_modelId:'F01',cast_voice:'B',cast_notes:'메모'},selection=takeCastingValues(values);
  assert.deepEqual(values,{product:'기존 제품'});assert.equal(selection.modelId,'F01');assert.equal(selection.voice,'B');
});
test('seven model portraits, playable selected voices, honest unproduced films and escaped notes appear in summaries',()=>{
  const selection=normalizeDemoCasting({modelId:'F01',voice:'B',jacket:'blazer',notes:'<img src=x onerror=alert(1)>'});
  const html=castingView(selection);assert.equal((html.match(/class="casting-model-card"/g)||[]).length,7);assert.equal((html.match(/alt="[^"]+ 대표 사진" loading="lazy"/g)||[]).length,7);assert.doesNotMatch(html,/대표 사진 준비 중|음성 샘플 준비 중/);assert.match(html,/영상 준비 중/);assert.equal((html.match(/<audio controls preload="none"/g)||[]).length,3);assert.doesNotMatch(html,/<video|src=""/);assert.doesNotMatch(castingSummary(selection),/<img/);
  assert.match(castingVoices({}),/disabled/);assert.match(castingVoices({modelId:'M01'}),/차분한 중저음/);
  assert.doesNotMatch(html,/샘플 음원은 연결 준비 중/);assert.match(html,/샘플을 듣고 원하는 목소리/);
  assert.match(castingVoices({modelId:'M03'}),/실제 목소리 · 인터뷰 원음\(배경음악 포함\)/);assert.doesNotMatch(castingVoices({modelId:'F01'}),/인터뷰 원음/);
  const project={studio:{strategy:{revision:2,data:{castingSelection:selection},history:[{revision:1,data:{castingSelection:selection}}]}}};
  assert.match(strategyView({project,mode:'staff',canEdit:false}),/유나/);assert.match(strategyHistory(project),/블레이저/);assert.doesNotMatch(castingView(selection,{editable:false}),/type="submit"/);
});
test('demo saves casting without network, reloads it and keeps an earlier selection in history',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  let demo=createDemoSession({storage}),project=demo.snapshot().project;
  const selection=normalizeDemoCasting({modelId:'F02',voice:'B',hair:'wave',jacket:'blazer',notes:'합성 테스트'});
  await demo.request('/pulse/api/studio',{method:'POST',body:{action:'save_strategy',revision:project.revision,strategy:{...project.studio.strategy.data,castingSelection:selection}}});
  demo=createDemoSession({storage});project=demo.snapshot().project;assert.deepEqual(project.studio.strategy.data.castingSelection,selection);
  await demo.request('/pulse/api/studio',{method:'POST',body:{action:'save_strategy',revision:project.revision,strategy:{...project.studio.strategy.data,castingSelection:{...selection,modelId:'M01',voice:''}}}});
  assert.deepEqual(demo.snapshot().project.studio.strategy.history.at(-1).data.castingSelection,selection);
});

// Original casting-book backup hashes: no cross-model substitutions or transcoding.
const RESTORED_MEDIA_SHA256={
  "assets/casting/f04.webp": "2e58b62ce8039865bc4ed2a6165300c7a1147d5aabd745079c134bbe1d75cdfb",
  "assets/casting/voice/F01-1.mp3": "7d32b4fa1979715fdccd6853feae7ffee292e3084d7801c209438ca791f4cdf6",
  "assets/casting/voice/F01-2.mp3": "118e6d26dd834850b7fd04f64f9af0a7895bfbd087151d427f7f7b5dcfb609c4",
  "assets/casting/voice/F01-3.mp3": "db6be6f7280b1f8144514c48c17e8b16097cbd35eff6a9e09f7bf427ca4fc722",
  "assets/casting/voice/F02-1.mp3": "be610a915ae6e311b3356cbc68f75f0d8ca103fe2c3f0b7d1e654f44cba26715",
  "assets/casting/voice/F02-2.mp3": "4949d897fda798c79ef029eb956a3e201278bad011fe4e186798a0e965534db3",
  "assets/casting/voice/F02-3.mp3": "15ce8881e00e3f837c34935eacb2248f82ef26f24154e9ace57be25e8990918f",
  "assets/casting/voice/F03-1.mp3": "6c44003aa29b75ac746cfee6178507841ef5f1903b85aa236e6017f25926f71c",
  "assets/casting/voice/F03-2.mp3": "4a25da738bd577ec0d2b5ebaa08449b71d11d2ed186ba09ff6cd12f059c2a63a",
  "assets/casting/voice/F03-3.mp3": "7665455328eba2c8a46958e20f53445d38bd647c25b56a3b13fe32ee90a15af5",
  "assets/casting/voice/F04-1.mp3": "910eba1165f112034c7f824cf135c37cfba92c3cdd547f23cea202f7f975506e",
  "assets/casting/voice/F04-2.mp3": "6f097794bb34cb888ebaa1243f597e6e01decc6f3a3f932492828a70e2114b64",
  "assets/casting/voice/F04-3.mp3": "2bfbeae367eca8816a5d8e2b21cd74a6699fe4caa093375a7d79f0a19e855499",
  "assets/casting/voice/M01-1.mp3": "183d9728a26862f42106bf45e45c8bd2e3220e9a5d98030a1e825a970667b07a",
  "assets/casting/voice/M01-2.mp3": "8023971177837ac808bceb03bdd056d0b9694a91df0d4caa992a18dbadec1e0f",
  "assets/casting/voice/M01-3.mp3": "bcb63042d67375245253b03fabb71ce934eb53ce5b372f80732cfc5c1f1c4a3a",
  "assets/casting/voice/M02-1.mp3": "1ad66574cdab3dc571f2a163995375560a4ebc1cfa3dca081612fbe618157c76",
  "assets/casting/voice/M02-2.mp3": "269ab0c8e18685d2ed4835518dd1cd91c04743f6ed5eef810fa6a0bed0c501d8",
  "assets/casting/voice/M02-3.mp3": "21b19e968232b7cc66f4e60c60166ea9edb285b4a6f3e8ffb6fbc0e5351cd508",
  "assets/casting/voice/M03-1.mp3": "417c1e652e70478c373a2c357ce1a7db1539b56e004ea5f582ddd558f40e24c8",
  "assets/casting/voice/M03-2.mp3": "44de06897bc9b3225c7c1907631f32c8f074b620934a4e040751fb82c4cdaaec",
  "assets/casting/voice/M03-3.mp3": "e2f3af34009c810bfaf9022ae002d8db3ab5cfa1e7c38cf9c0de2b8b5a3c1e94"
};

test('restored samples retain exact approved portrait and canonical per-model A/B/C audio bytes',async()=>{
  const urls=new Set();
  for(const model of CASTING_MODELS){
    assert.ok(model.image,model.id+' portrait');
    if(model.id!=='F02')assert.equal(model.videos.every(v=>v.src===''),true,model.id+' has no produced ad/runway');
    assert.deepEqual(model.voices.map(v=>v.id),['A','B','C']);
    const html=castingVoices({modelId:model.id});
    for(const [i,voice]of model.voices.entries()){
      const src=`./assets/casting/voice/${model.id}-${i+1}.mp3`;
      assert.equal(voice.src,src);assert.equal(urls.has(src),false);urls.add(src);
      assert.ok(html.includes(`src="${src}" aria-label="${model.name} 목소리 ${voice.id}"`));
    }
    assert.doesNotMatch(html,/autoplay|preload="auto"|src=""/);
  }
  assert.equal(urls.size,21);
  assert.equal(CASTING_MODELS.find(m=>m.id==='F04').image,'./assets/casting/f04.webp');
  for(const [relative,expected]of Object.entries(RESTORED_MEDIA_SHA256)){
    const bytes=await readFile(new URL('./public/pulse-app/'+relative,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,relative);
  }
});

test('Harin has exactly two portrait motion samples with honest labels in editable and saved casting views',()=>{
  const model=CASTING_MODELS.find(item=>item.id==='F02');
  assert.deepEqual(model.videos.map(({kind,label,src,aspectRatio,sampleType})=>({kind,label,src,aspectRatio,sampleType})),[
    {kind:'ad',label:'커피잔 동작 · 5초 움직임 샘플',src:'./assets/casting/video/F02-ad-motion-5s-v1.mp4',aspectRatio:'9:16',sampleType:'motion'},
    {kind:'runway',label:'런웨이 · 5초 움직임 샘플',src:'./assets/casting/video/F02-runway-motion-5s-v1.mp4',aspectRatio:'9:16',sampleType:'motion'},
  ]);
  assert.equal(CASTING_MODELS.flatMap(item=>item.videos).filter(video=>video.src).length,2);
  const selection=normalizeDemoCasting({modelId:'F02',voice:'B',top:'shirt',notes:'선택 유지'}),before=structuredClone(selection);
  for(const editable of [true,false]){
    const html=castingView(selection,{editable}),players=Array.from(html.matchAll(/<video\b[^>]*>/g),match=>match[0]);
    assert.equal(players.length,2);
    for(const [index,player]of players.entries()){
      assert.match(player,/controls playsinline preload="none" data-aspect-ratio="9:16"/);
      assert.ok(player.includes(`src="${model.videos[index].src}"`));
      assert.ok(player.includes(`aria-label="${model.videos[index].label}"`));
      assert.doesNotMatch(player,/autoplay|\bloop\b|style=/);
    }
    assert.equal((html.match(/MOTION SAMPLE/g)||[]).length,2);
    assert.equal((html.match(/광고·런웨이 본편은 별도 제작 예정입니다/g)||[]).length,2);
    assert.match(html,/손과 제품 움직임을 보는 접사입니다\. 얼굴과 대사 연기는 포함하지 않습니다\./);
    assert.doesNotMatch(html,/CAMPAIGN FILM|영상 준비 중|15초 완성/);
    assert.equal((html.match(/<audio controls preload="none"/g)||[]).length,3);
    assert.match(html,/name="cast_voice" value="B" checked/);
  }
  assert.deepEqual(selection,before);
});

test('only the founder model shows the finished music video as a poster, a click-to-play excerpt and a full-film link',async()=>{
  const owners=CASTING_MODELS.filter(model=>model.works?.length);
  assert.deepEqual(owners.map(model=>model.id),['M03']);
  const [work]=owners[0].works,base='./assets/casting/video/M03-mv-happy-gangster-';
  assert.deepEqual({kind:work.kind,title:work.title,poster:work.poster,excerpt:work.excerpt,full:work.full},{
    kind:'music-video',title:'Happy, Happy Gangster',poster:base+'poster-v1.webp',
    excerpt:{src:base+'excerpt-20s-v1.mp4',duration:'20초'},full:{src:base+'full-v1.mp4',duration:'3분 18초'},
  });
  assert.equal(owners[0].videos.every(video=>video.src===''),true,'ad and runway slots stay unproduced');
  const poster=await readFile(new URL('./public/pulse-app/'+work.poster.slice(2),import.meta.url));
  assert.equal(createHash('sha256').update(poster).digest('hex'),'cab9f663ca559534948325e96b80ccc41e840ae5665472e39bdbc19f6fd46e50');
  const selection=normalizeDemoCasting({modelId:'M03',voice:'A'});
  for(const editable of [true,false]){
    const html=castingView(selection,{editable}),players=Array.from(html.matchAll(/<video\b[^>]*>/g),match=>match[0]);
    assert.equal(players.length,1);
    assert.equal(players[0],`<video controls playsinline preload="none" poster="${work.poster}" src="${work.excerpt.src}" aria-label="Happy, Happy Gangster · 20초 발췌">`);
    assert.match(html,/<span class="eyebrow">MUSIC VIDEO<\/span><h5>Happy, Happy Gangster<\/h5>/);
    assert.match(html,/유호의 작품과 광고·런웨이/);
    assert.match(html,/<p class="casting-motion-note">SYNK가 직접 만든 뮤직비디오의 20초 발췌예요\. 3분 넘는 본편 내내 장면과 옷이 바뀌어도 같은 얼굴로 이어져요\.<\/p>/);
    assert.ok(html.includes(`<a class="casting-work-full" href="${work.full.src}" target="_blank" rel="noopener noreferrer">본편 보기 · 3분 18초 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`));
    assert.equal((html.match(/영상 준비 중/g)||[]).length,2);
    assert.doesNotMatch(html,/autoplay|\bloop\b|preload="auto"|src=""|Kling|Wan|Seedance|Higgsfield/);
  }
  for(const modelId of ['M01','F01','F02','F03','M02','F04'])assert.doesNotMatch(castingView(normalizeDemoCasting({modelId})),/MUSIC VIDEO|casting-work/);
  // The browser downloads these modules as-is, so even comments must not name the generation tools.
  for(const file of ['casting-catalog.mjs','casting-view.mjs','casting.css']){
    const source=await readFile(new URL('./public/pulse-app/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\b(?:Kling|Wan ?\d|Seedance|Higgsfield|Nano ?Banana|Veo)\b/i,file);
  }
});
