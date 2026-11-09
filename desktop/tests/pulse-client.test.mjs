import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODELS,PORTFOLIO,RETIRED_WORKS,TEAMS} from '../renderer/pulse-data.mjs';
import {mountPulseClient,pulseRequestText,sanitizePulseDraft} from '../renderer/pulse-client.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=JSON.parse(fs.readFileSync(path.join(desktop,'assets/pulse/sources.json'),'utf8'));
const OLD_SIX=['M01','F02','M03','F03','M02','F01'];
const oldDraft=()=>({models:OLD_SIX,works:['model-casting'],brief:{brand:'브랜드',goal:'목표',channel:'채널',deadline:'일정',notes:'메모'}});

function mount({saved}={}){
  const handlers={},store=new Map(saved?[['synk.pulse.brief.v1:owner-a',JSON.stringify(saved)]]:[]);
  const root={innerHTML:'',addEventListener:(type,handler)=>{handlers[type]=handler;},querySelector:()=>null,contains:()=>true};
  const client=mountPulseClient(root,{storage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},getContext:()=>({owner:'owner-a',status:'ready'})});
  const press=dataset=>handlers.click({target:{closest:()=>({dataset})}});
  const show=async tab=>{await press({pulseTab:tab});return root.innerHTML;};
  client.render();
  return {root,client,press,show,store};
}
const visibleText=html=>html.replace(/<[^>]+>/g,' ');

test('the roster matches the website: twenty-one models and two idol teams of four',()=>{
  assert.equal(MODELS.length,21);
  assert.equal(new Set(MODELS.map(m=>m.id)).size,21);
  assert.deepEqual(TEAMS.map(t=>t.id),['OPALIN','OUTBLUE']);
  assert.deepEqual(MODELS.filter(m=>m.team==='OPALIN').map(m=>m.name),['윤슬','로하','새봄','해인']);
  assert.deepEqual(MODELS.filter(m=>m.team==='OUTBLUE').map(m=>m.name),['도현','하람','서율','지온']);
  assert.ok(MODELS.filter(m=>m.team==='OPALIN').every(m=>m.gender==='여'));
  assert.ok(MODELS.filter(m=>m.team==='OUTBLUE').every(m=>m.gender==='남'));
  assert.deepEqual(MODELS.find(m=>m.id==='M03').tags.slice(2),['미스터리한','4차원']);
});

test('the portfolio lists the six works in the synk.im order and keeps the contest entry apart from the virtual brands',()=>{
  // 11-09 작품 진열 최신화(SYNK-appsscript docs/마케팅/PULSE_포트폴리오_제작준비_20261012/진열): 쇼릴의 네 편이 앞, 霜の肌理 · 화성 CF가 뒤.
  // 11-06 대표작 이름은 「霜の肌理」다 — 손님이 읽는 글에 옛 이름이 남지 않는다. 저장된 초안이 고른 옛 id(yurigyeol · maejin · hwaseong-cf)는 그대로다.
  assert.ok(PORTFOLIO.find(w=>w.id==='yurigyeol').title.includes('「霜の肌理」'));assert.doesNotMatch(JSON.stringify(PORTFOLIO),/유리결|YURIGYEOL|서리꽃 앰플/);
  assert.deepEqual(PORTFOLIO.map(w=>w.id),['dodam','omitok-court','maejin','modu-course','yurigyeol','hwaseong-cf']);
  assert.deepEqual(PORTFOLIO.map(w=>w.kind),[...Array(5).fill('가상 브랜드로 만든 자체 작품'),'공모전 출품작']);
  assert.deepEqual(PORTFOLIO.slice(0,5).map(w=>w.sourceUrl),['https://synk.im/pulse/#work-1','https://synk.im/pulse/#work-2','https://synk.im/pulse/#work-3','https://synk.im/pulse/#work-4','https://synk.im/pulse/#work-7']);
  assert.ok(!PORTFOLIO.some(w=>w.id==='model-casting'));
});

test('every model and work image is a recorded byte-for-byte copy of its public file',()=>{
  const rows=new Map(sources.assets.map(row=>[row.file,row]));
  const used=[...MODELS,...PORTFOLIO,...RETIRED_WORKS].flatMap(item=>[item.image,...(item.gallery||[]).map(row=>row.image)]).map(image=>image.replace('/assets/pulse/',''));
  for(const file of new Set(used)){
    const row=rows.get(file);assert.ok(row,file+' is not in sources.json');
    const bytes=fs.readFileSync(path.join(desktop,'assets/pulse',file));
    assert.equal(bytes.length,row.bytes,file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256,file);
    // 11-06 대표작 霜の肌理 · 11-09 새 작품 셋: synk.im이 이 작품들을 영상으로 보여 정지 그림이 없다 — 그 영상의 같은 원본에서 뽑은 장 하나만 출처를 적고 받는다.
    if(row.publicFilm){assert.match(file,/^portfolio\/(?:yurigyeol|dodam|omitok-court|modu-course)\.webp$/);assert.match(row.publicFilm,/^https:\/\/synk\.im\/assets\/.+\.mp4$/);assert.match(row.transformation,/^frame at [\d.]+ s of the approved \d+ s film/);continue;}
    assert.match(row.publicUrl,/^https:\/\/synk\.im\/assets\//);
    assert.equal(row.transformation,'none; byte-for-byte copy');
  }
  assert.equal(sources.assets.length,27);
  for(const model of MODELS)assert.equal(rows.get(model.image.replace('/assets/pulse/','')).publicUrl,model.sourceUrl,model.id);
});

test('a brief saved before this change keeps its six models, its retired work and its text',()=>{
  const draft=sanitizePulseDraft(oldDraft());
  assert.deepEqual(draft.models,OLD_SIX);
  assert.deepEqual(draft.works,['model-casting']);
  assert.deepEqual(draft.brief,oldDraft().brief);
  const text=pulseRequestText(oldDraft());
  for(const line of ['- 이안 (M01) · 가상 AI 모델','- 유호 (M03) · SYNK 창업자 본인 기반 AI 이미지','- PULSE AI 모델 캐스팅 · 자체 제작 이미지','  https://synk.im/pulse/#models','브랜드·제품: 브랜드','올릴 곳·화면 비율: 채널','기타·메모: 메모'])assert.ok(text.includes(line),line);
});

test('a draft still drops unknown ids and repeats and cuts over-long text',()=>{
  const draft=sanitizePulseDraft({models:['M01','M01','X99'],works:['nope','maejin'],brief:{brand:'가'.repeat(500),notes:'나'.repeat(4000),goal:7}});
  assert.deepEqual(draft.models,['M01']);
  assert.deepEqual(draft.works,['maejin']);
  assert.equal(draft.brief.brand.length,400);
  assert.equal(draft.brief.notes.length,3000);
  assert.equal(draft.brief.goal,'');
});

test('a saved draft opens on its brief, unchanged, and its retired work can be seen and removed',async()=>{
  const {root,client,press,show}=mount({saved:oldDraft()});
  assert.match(root.innerHTML,/data-pulse-tab="brief" aria-current="page"/);
  assert.match(root.innerHTML,/이 기기에 저장한 요청 초안을 불러왔어요/);
  assert.equal(client.hasUnsavedChanges(),false);
  for(const name of ['이안','하린','유호','서진','태준','유나','PULSE AI 모델 캐스팅'])assert.ok(root.innerHTML.includes('<strong>'+name+'</strong>'),name);
  const portfolio=await show('portfolio');
  assert.equal(portfolio.match(/class="pulse-work-card/g).length,7);
  assert.match(portfolio,/data-pulse-work="model-casting"/);
  await press({pulsePickWork:'model-casting'});
  assert.equal(root.innerHTML.match(/class="pulse-work-card/g).length,6);
  assert.doesNotMatch(root.innerHTML,/model-casting/);
  assert.equal(client.hasUnsavedChanges(),true);
});

test('with no saved draft the view opens on the models and lists the teams under their names',()=>{
  const {root}=mount();
  assert.match(root.innerHTML,/data-pulse-tab="models" aria-current="page"/);
  assert.equal(root.innerHTML.match(/class="pulse-model-card"/g).length,21);
  assert.match(root.innerHTML,/<strong>21<\/strong>/);
  for(const team of TEAMS){assert.ok(root.innerHTML.includes(team.line),team.id);assert.ok(root.innerHTML.includes('id="pulse-team-'+team.id+'"'),team.id);}
  assert.match(root.innerHTML,/F08 · 가상 AI 모델 · OPALIN/);
});

test('a picked team member is saved and named with its team in the request',async()=>{
  const {press,store}=mount();
  await press({pulsePickModel:'M10'});await press({pulseSave:''});
  const stored=JSON.parse(store.get('synk.pulse.brief.v1:owner-a'));
  assert.deepEqual(stored.models,['M10']);
  assert.match(pulseRequestText(stored),/- 지온 \(M10\) · 가상 AI 모델 · OUTBLUE/);
});

test('the view says the new introduction and none of what it must not say',async()=>{
  const {root,show}=mount();
  const models=visibleText(root.innerHTML),portfolio=visibleText(await show('portfolio')),brief=visibleText(await show('brief'));
  const all=models+portfolio+brief+pulseRequestText(oldDraft())+JSON.stringify([MODELS,PORTFOLIO,RETIRED_WORKS,TEAMS]);
  // 11-05 first line (Yuho: 「좋아 훌륭해」): the heading says what synk.im/pulse says, in 해요체.
  for(const screen of [models,portfolio,brief]){
    assert.match(screen,/카메라 앞에서 10년,\s+배우가 AI 모델을 연출합니다/);assert.doesNotMatch(screen,/연기를 가르칩니다/);
    assert.match(screen,/넷플릭스 · tvN에 출연하고 웹드라마 주연\(페이스북 1,000만 회\)을 맡은 대표가 시선, 제품을 쥔 손, 웃음이 나오는 타이밍까지 직접 연출해요\. 상담은 제품 사진 한 장과 올릴 곳만으로 시작해요\./);
  }
  assert.match(models,/AI 광고 제작/);
  assert.match(models,/AI 모델 21명 가운데/);
  assert.match(models,/다음 편도 같은 모델/);
  assert.match(models,/나머지 20명은 실제 인물이 아닌 가상 모델/);
  // Wherever a scene image is promised the caveat is on the same screen. The heading no longer promises one
  // (every cut first is a process line now, as on the website), so the caveat sits with the brief's three checks.
  for(const screen of [models,portfolio])assert.doesNotMatch(screen,/장면 이미지/);
  assert.match(brief,/컷마다 장면 이미지\. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요/);
  assert.match(portfolio,/가상 브랜드로 만든 자체 광고와 공모전 출품작이에요/);
  assert.match(portfolio,/카메라 앞에 서 본 사람이 AI 모델의 연기를 연출해요/);
  assert.match(portfolio,/SYNK PULSE는 엔터테인먼트·광고 업계에서 10년 일한 대표 유호가 연출해요/);
  assert.match(portfolio,/넷플릭스 공개 「보라! 데보라」 1화 오프닝 시퀀스 출연 · tvN 「코미디빅리그」 코너 출연 · 웹드라마 「알바왕 98과 99사이」 주연\(페이스북 조회수 1,000만 회\) · 부활 「너의 모습」 뮤직비디오 주연/);
  assert.match(brief,/모델 고르기, 광고가 남길 한 문장과 글 콘티, 컷마다 장면 이미지/);
  assert.match(brief,/15초 광고 39만원부터 · 30초 광고와 편집본 89만원부터 · 기업 캠페인 250만원부터/);
  for(const old of ['CLIENT STUDIO','광고 모델을 고르고','맡길 작업을','뮤직비디오와 기업 영상은','6명','참고 작업','모든 컷을 먼저 보여 드리는','배우로 활동한'])assert.ok(!all.includes(old),old);
  assert.ok(!root.innerHTML.includes('pulse-heading-fine'),'the heading keeps no fine print');
  for(const banned of ['실제 촬영','실사 촬영','납기','부가세','세금계산서','같은 얼굴','무제한','최고','최초','유일','몽글','까몽','마린'])assert.ok(!all.includes(banned),banned);
  assert.doesNotMatch(all,/Higgsfield|Seedance|Sunburst|Omni|Veo|Kling|Runway|Sora|Midjourney|Gemini|Nano|ChatGPT|GPT|ElevenLabs|Typecast/i);
  assert.doesNotMatch(all,/\d+만원(?!부터)/);
});

test('the client code still loads only pictures that ship with the app',()=>{
  for(const item of [...MODELS,...PORTFOLIO,...RETIRED_WORKS,...[...PORTFOLIO,...RETIRED_WORKS].flatMap(w=>w.gallery)])assert.match(item.image,/^\/assets\/pulse\/(?:models|portfolio)\/[a-z0-9-]+\.webp$/);
});

test('a team name and its one-line story are separate lines, not one run-on sentence',()=>{
  const {root}=mount();
  for(const team of TEAMS)assert.ok(root.innerHTML.includes('<p><strong>'+team.kind+'</strong></p><p>'+team.line+'</p>'),team.id);
});
