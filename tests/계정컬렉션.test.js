'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'docs/홍보물/계정별콘텐츠_20260909');
const loom=require('../tools/lib/loom.js');
const {assetNeedsRefresh,ASSET_TRANSFORM}=require('../docs/홍보물/계정별콘텐츠_20260909/만들기.cjs');
test('계정 컬렉션은 Loom의 명시 호출에만 실리고 기본 스킨을 바꾸지 않는다',()=>{
  const skin=loom.계정컬렉션();
  assert.match(skin,/\.account-collection/);
  assert.doesNotMatch(skin,/undefined|NaN|transition:\s*all/);
  assert.doesNotMatch(loom.css({지면:'밝은부품',범위:'.loom',천:null}),/collection-grid/);
  for(const name of ['Paper','Ink','Coral 3','Lapis Deep','Pop Deep'])assert.ok(skin.includes(loom.정본().색[name]));
});
test('13개 기록 + 3개 준비, 7개 영상, 원작/파생과 계정 형식이 일치한다',()=>{
  const {items}=JSON.parse(fs.readFileSync(path.join(base,'콘텐츠원고.json'),'utf8'));
  assert.equal(items.length,16);assert.equal(new Set(items.map(p=>p.id)).size,16);
  assert.equal(items.filter(p=>p.status==='recorded').length,13);
  assert.equal(items.filter(p=>p.status==='preparation').length,3);
  assert.equal(items.filter(p=>p.format==='video').length,7);
  for(const p of items){
    assert.ok(p.caption&&p.alt&&p.target&&p.benefit&&p.luxuryDecision,p.id);
    if(p.derivativeOf)assert.ok(items.some(x=>x.id===p.derivativeOf));
    if(p.format==='video')assert.ok(p.scenes.length>0);
    if(p.account.includes('yuhobuilds')&&p.platform.toLowerCase()==='instagram')assert.equal(p.format,'video');
    if(p.platform.toLowerCase()==='threads')assert.equal(p.status,'preparation');
  }
  assert.equal(items.filter(p=>p.platform.toLowerCase()==='youtube'&&p.account==='@synkkorean').length,1);
});
test('완성 지면과 문안이 원고 전량에 대응한다',()=>{
  const {items}=JSON.parse(fs.readFileSync(path.join(base,'콘텐츠원고.json'),'utf8'));
  for(const p of items){
    assert.equal(fs.readFileSync(path.join(base,p.id,'게시문안.txt'),'utf8').trim(),p.caption.trim());
    const html=fs.readFileSync(path.join(base,p.id,'cards.html'),'utf8');
    assert.equal((html.match(/class="artboard"/g)||[]).length,p.cards.length);
    for(let i=1;i<=p.cards.length;i++)assert.ok(fs.statSync(path.join(base,p.id,`upload-${String(i).padStart(2,'0')}.jpg`)).size>10000);
  }
});
test('26개 실물의 경계와 서체 검사를 통과한다',()=>{
  const report=JSON.parse(fs.readFileSync(path.join(base,'_검토/정적_경계검사.json'),'utf8'));
  assert.equal(report.cards,26);
  assert.deepEqual(report.errors,[]);
  for(const r of report.results){assert.equal(r.textOverflow,false,r.id);assert.equal(r.collision,false,r.id);assert.ok(r.fonts.suit&&r.fonts.inter,r.id);}
});
test('원천·출력·변환 규칙이 달라지면 기존 자산을 다시 만든다',()=>{
  const previous={sourceSha256:'source-a',outputSha256:'output-a',transform:ASSET_TRANSFORM};
  assert.equal(assetNeedsRefresh(previous,'source-a','output-a'),false);
  assert.equal(assetNeedsRefresh(previous,'source-b','output-a'),true);
  assert.equal(assetNeedsRefresh(previous,'source-a','output-b'),true);
  assert.equal(assetNeedsRefresh(previous,'source-a',null),true);
  assert.equal(assetNeedsRefresh({...previous,transform:'old'},'source-a','output-a'),true);
  assert.equal(assetNeedsRefresh(undefined,'source-a','output-a'),true);
});
test('26장과 모아보기의 로고는 모두 실물 스티치 이미지다',()=>{
  const {items}=JSON.parse(fs.readFileSync(path.join(base,'콘텐츠원고.json'),'utf8'));
  for(const p of items){
    const html=fs.readFileSync(path.join(base,p.id,'cards.html'),'utf8');
    assert.equal((html.match(/class="brand-synk"/g)||[]).length,p.cards.length,p.id);
    assert.equal((html.match(/class="division-stitch-logo"/g)||[]).length,p.brand==='SYNK'?0:p.cards.length,p.id);
    assert.doesNotMatch(html,/division-label|<svg|assets\/stitch\.webp/,p.id);
    if(p.brand!=='SYNK')assert.ok(html.includes(`data-division="${p.brand}"`),p.id);
  }
  assert.match(fs.readFileSync(path.join(base,'index.html'),'utf8'),/<header class="collection-intro"><div class="brand-lock"[^>]*><img class="brand-synk" src="assets\/brand-synk.webp"/);
  const report=JSON.parse(fs.readFileSync(path.join(base,'_검토/정적_경계검사.json'),'utf8'));
  for(const r of report.results){
    assert.equal(r.brand.flatSvg,0,r.id);assert.equal(r.brand.flatDivision,0,r.id);
    assert.equal(r.brand.overlapCopy,false,r.id);assert.equal(r.brand.outside,false,r.id);
    assert.ok(r.brand.images.every(x=>x.loaded&&x.width>0&&x.height>0),r.id);
  }
});
test('신규 배치 로고는 원본 바이트를 보존하고 봉투·지면은 개선 원천을 가리킨다',()=>{
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'사용자산.json'),'utf8'));
  for(const a of manifest){
    assert.equal(a.sourceSha256,hash(path.join(root,a.source)),a.key+' source');
    assert.equal(a.outputSha256,hash(path.join(base,a.output)),a.key+' output');
    assert.equal(a.transform,ASSET_TRANSFORM,a.key);
  }
  for(const brand of ['synk','lab','shift','pulse']){
    const a=manifest.find(x=>x.key==='brand-'+brand);assert.ok(a,brand);
    assert.ok(a.source.includes('/_개선/배치용/'),brand);assert.equal(a.sourceSha256,a.outputSha256,brand+' original pixels');
  }
  assert.ok(manifest.find(x=>x.key==='letter').source.endsWith('/_개선/봉투-2.5.png'));
  assert.ok(manifest.find(x=>x.key==='book').source.endsWith('/_개선/책-2.5.png'));
  assert.ok(manifest.find(x=>x.key==='scissors').source.endsWith('/_개선/가위-2.5.png'));
  for(const a of manifest.filter(x=>x.key.endsWith('page')||x.key==='labinside'))assert.ok(a.source.includes('/_개선/지면스냅샷/'),a.key);
});
