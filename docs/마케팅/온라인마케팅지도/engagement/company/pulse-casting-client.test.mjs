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
test('seven model portraits, playable selected voices, no empty film slots and escaped notes appear in summaries',()=>{
  const selection=normalizeDemoCasting({modelId:'F01',voice:'B',jacket:'blazer',notes:'<img src=x onerror=alert(1)>'});
  const html=castingView(selection);assert.equal((html.match(/class="casting-model-card"/g)||[]).length,7);assert.equal((html.match(/alt="[^"]+ 대표 사진" loading="lazy"/g)||[]).length,7);assert.doesNotMatch(html,/대표 사진 준비 중|음성 샘플 준비 중/);assert.doesNotMatch(html,/영상 준비 중|casting-media-pending/);assert.match(html,/이 모델의 광고·런웨이 영상은 만들고 있어요/);assert.equal((html.match(/<audio preload="none" src="[^"]+" hidden><\/audio>/g)||[]).length,3);assert.equal((html.match(/<button type="button" class="voice-play" data-action="voice-play" aria-label="[^"]+ 듣기">듣기<\/button>/g)||[]).length,3);assert.doesNotMatch(html,/<video|src=""/);assert.doesNotMatch(castingSummary(selection),/<img/);
  assert.match(castingVoices({}),/disabled/);assert.match(castingVoices({modelId:'M01'}),/부드럽고 차분한/);
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

// Same bytes as the casting book's site/voice (copied 2026-10-19) so a client hears the voices the book plays;
// M03 keeps the interview originals and f04 the approved portrait. No cross-model substitutions or transcoding.
const RESTORED_MEDIA_SHA256={
  "assets/casting/f04.webp": "2e58b62ce8039865bc4ed2a6165300c7a1147d5aabd745079c134bbe1d75cdfb",
  "assets/casting/voice/F01-1.mp3": "0e1c1628659661857aaedcd29cae64e4dafdba61496ceb1270c467282ad18f7f",
  "assets/casting/voice/F01-2.mp3": "c42813e425ac708b90fcacdfce37f886bee88e94dbae888faa9b8bf6c96bdd26",
  "assets/casting/voice/F01-3.mp3": "4af0e37fc7e129e6c8e41c2b61850392b5f0e08087b1e8cf5de40bae7a052fd3",
  "assets/casting/voice/F02-1.mp3": "dfade28a7094250e592f218395ea792b883c9273bbc0e71d9c946456d4ff0356",
  "assets/casting/voice/F02-2.mp3": "16d041c0bfffdcd86c33205686fc5beaf1d3ab9454ad5219083742b249616a2a",
  "assets/casting/voice/F02-3.mp3": "8c846a468d582e4b69de6df2ced56a9ac8633bab14cfea1db5497f688449f6ba",
  "assets/casting/voice/F03-1.mp3": "51a6c9bf35e210cf3912bdd13b36dcd11f6be0de14dde2173996b0507357aaaa",
  "assets/casting/voice/F03-2.mp3": "05635d102dbafb1ea4ef48a146fdaa47c0dfc4c2b2e6d085298d98ff4fd5dff2",
  "assets/casting/voice/F03-3.mp3": "38ccb8c5787f7d0d42bc774a5ec4be8130f6e9b6aa66694b4525b0aedca64fda",
  "assets/casting/voice/F04-1.mp3": "6442cf3c05bee8f21d02ba2a9062cdc8e62730c2b2b190d496224492daaf2013",
  "assets/casting/voice/F04-2.mp3": "70d270adb302e52ac98c30648d6df6c58c76f80b518ad3024a16f9373bdf8bf0",
  "assets/casting/voice/F04-3.mp3": "967cb24f9cffc72ec923d1b64e1b175b3632c11f1ea91c7d5e82da27e64e89af",
  "assets/casting/voice/M01-1.mp3": "a24faa5f009d8c3aa7ecc447a22b23d0c47e57c036622f8bdba8c37b8b1d58cb",
  "assets/casting/voice/M01-2.mp3": "f65e20d4b56558875ed61137f526d020513d151b62276ab36d027bd647129368",
  "assets/casting/voice/M01-3.mp3": "717579033fcf4a001dbfe7391e46a405779c51b150305f5fe669e8bf9cf5d865",
  "assets/casting/voice/M02-1.mp3": "282fd2df19e52a275607c84db4df9b1234a086a4480805f188dcde18c2fba912",
  "assets/casting/voice/M02-2.mp3": "7f9a8b160b137c744f74867d778f21a5ecc55ca7e25a6bf5f55ca44db45f568d",
  "assets/casting/voice/M02-3.mp3": "18b1bf45fad1d73b166c9cde5ed0ed6fe166907f3c68d40a91916d84fb1ed835",
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
      assert.ok(html.includes(`<button type="button" class="voice-play" data-action="voice-play" aria-label="${model.name} 목소리 ${voice.id} 듣기">듣기</button><audio preload="none" src="${src}" hidden></audio>`),src);
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

// 10-20 하린 아이스커피 광고(콘티 v5 최종본)를 메인 광고 칸에 「표정 참고용 시안」으로 올렸다(유호님 10-18 「모델 표정 참고용이라는 느낌을 같이 게시」).
test('Harin shows the finished iced-coffee ad as an expression reference with a poster and keeps the runway motion sample in editable and saved casting views',async()=>{
  const model=CASTING_MODELS.find(item=>item.id==='F02'),base='./assets/casting/video/F02-';
  assert.deepEqual(model.videos.map(({kind,label,src,poster,aspectRatio,sampleType})=>({kind,label,src,poster,aspectRatio,sampleType})),[
    {kind:'ad',label:'아이스커피 광고 · 20초',src:base+'ad-iced-coffee-20s-v1.mp4',poster:base+'ad-iced-coffee-20s-v1-poster.webp',aspectRatio:'9:16',sampleType:'expression'},
    {kind:'runway',label:'런웨이 · 5초 움직임 샘플',src:base+'runway-motion-5s-v1.mp4',poster:undefined,aspectRatio:'9:16',sampleType:'motion'},
  ]);
  assert.equal(CASTING_MODELS.flatMap(item=>item.videos).filter(video=>video.src).length,2);
  for(const [file,digest]of[['ad-iced-coffee-20s-v1.mp4','b6b47293bcec453c111f75c71790f3705d9b7d09b31a4abf95500383c261f8f3'],['ad-iced-coffee-20s-v1-poster.webp','dc63a3a1542d42438743b5276db851c81eef4ce5d7069c6480c3f84320fb36ea']]){
    const bytes=await readFile(new URL('./public/pulse-app/assets/casting/video/F02-'+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,file);
  }
  const [ad,runway]=model.videos,selection=normalizeDemoCasting({modelId:'F02',voice:'B',top:'shirt',notes:'선택 유지'}),before=structuredClone(selection);
  for(const editable of [true,false]){
    const html=castingView(selection,{editable}),players=Array.from(html.matchAll(/<video\b[^>]*>/g),match=>match[0]);
    assert.deepEqual(players,[
      `<video controls playsinline preload="none" data-aspect-ratio="9:16" poster="${ad.poster}" src="${ad.src}" aria-label="${ad.label}">`,
      `<video controls playsinline preload="none" data-aspect-ratio="9:16" src="${runway.src}" aria-label="${runway.label}">`,
    ]);
    assert.equal((html.match(/<span class="eyebrow ko">표정 참고용<\/span><h5>아이스커피 광고 · 20초<\/h5>/g)||[]).length,1);
    assert.equal((html.match(/<span class="eyebrow ko">움직임 샘플<\/span>/g)||[]).length,1);
    assert.equal((html.match(/광고·런웨이 본편은 따로 만들 예정이에요/g)||[]).length,1);
    assert.match(html,/하린의 표정과 분위기를 보여 드리는 참고용 시안이에요\. 실제로 만드는 광고의 화질·연출과는 달라요\./);
    assert.doesNotMatch(html,/손과 제품 움직임을 보는 접사|CAMPAIGN FILM|영상 준비 중|15초 완성|autoplay|\bloop\b/);
    assert.equal((html.match(/<audio preload="none" src="[^"]+" hidden><\/audio>/g)||[]).length,3);
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
    assert.match(html,/<span class="eyebrow ko">뮤직비디오<\/span><h5>Happy, Happy Gangster<\/h5>/);
    assert.match(html,/<h4>유호의 포트폴리오<\/h4>/);
    assert.match(html,/<p class="casting-motion-note">SYNK가 직접 만든 뮤직비디오의 20초 발췌예요\. 3분 넘는 본편 내내 장면과 옷이 바뀌어도 같은 얼굴로 이어져요\.<\/p>/);
    assert.ok(html.includes(`<a class="casting-work-full" href="${work.full.src}" target="_blank" rel="noopener noreferrer">본편 보기 · 3분 18초 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`));
    assert.doesNotMatch(html,/영상 준비 중|casting-media-pending|casting-video-grid/);
    assert.doesNotMatch(html,/autoplay|\bloop\b|preload="auto"|src=""|Kling|Wan|Seedance|Higgsfield/);
  }
  for(const modelId of ['M01','F01','F02','F03','M02','F04'])assert.doesNotMatch(castingView(normalizeDemoCasting({modelId})),/뮤직비디오|casting-work/);
  // The browser downloads these modules as-is, so even comments must not name the generation tools.
  for(const file of ['casting-catalog.mjs','casting-view.mjs','casting.css']){
    const source=await readFile(new URL('./public/pulse-app/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\b(?:Kling|Wan ?\d|Seedance|Higgsfield|Nano ?Banana|Veo)\b/i,file);
  }
});
