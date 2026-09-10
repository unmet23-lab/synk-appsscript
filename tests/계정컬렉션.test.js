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
test('26장과 모아보기는 승인 완성 조합 하나로 SYNK와 사업명을 함께 표시한다',()=>{
  const {items}=JSON.parse(fs.readFileSync(path.join(base,'콘텐츠원고.json'),'utf8'));
  for(const p of items){
    const html=fs.readFileSync(path.join(base,p.id,'cards.html'),'utf8');
    assert.equal((html.match(/data-approved-logo=/g)||[]).length,p.cards.length,p.id);
    assert.equal((html.match(new RegExp(`assets/brand-full-${p.brand.toLowerCase()}-ink\\.webp`,'g'))||[]).length,p.cards.length,p.id);
    assert.ok(html.includes(`data-approved-logo="${p.brand}"`),p.id);
    assert.doesNotMatch(html,/class="brand-synk"|division-stitch-logo|division-label|<svg|assets\/stitch\.webp/,p.id);
  }
  assert.match(fs.readFileSync(path.join(base,'index.html'),'utf8'),/<header class="collection-intro"><div class="brand-lock"[^>]*data-approved-logo="SYNK"[^>]*><img src="assets\/brand-full-synk-ink.webp"/);
  const report=JSON.parse(fs.readFileSync(path.join(base,'_검토/정적_경계검사.json'),'utf8'));
  for(const r of report.results){
    assert.equal(r.brand.images.length,1,r.id);
    assert.equal(r.brand.flatSvg,0,r.id);assert.equal(r.brand.flatDivision,0,r.id);
    assert.equal(r.brand.overlapCopy,false,r.id);assert.equal(r.brand.outside,false,r.id);
    assert.ok(r.brand.images.every(x=>x.loaded&&x.width>0&&x.height>0),r.id);
  }
});
test('완성 조합은 현행 승인 명세와 일치하며 사업명 원본과 기존 소품을 보존한다',()=>{
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const kit=path.join(root,'docs/홍보물/마케팅실행_20260909/브랜드킷');
  const approved=JSON.parse(fs.readFileSync(path.join(kit,'배치명세.json'),'utf8'));
  const applied=JSON.parse(fs.readFileSync(path.join(base,'_검토/로고갱신_20260910.json'),'utf8'));
  assert.equal(approved.version,2);assert.equal(approved.items.length,8);
  for(const item of approved.items){
    assert.equal(hash(path.join(kit,item.file)),item.sha256,item.file+' approved source');
    const output=applied.assets.find(x=>x.source===item.file);assert.ok(output,item.file);
    assert.equal(output.sourceSha256,item.sha256,item.file+' source provenance');
    assert.equal(hash(path.join(base,output.file)),output.sha256,item.file+' exported pixels');
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'사용자산.json'),'utf8'));
  for(const a of manifest){
    assert.equal(a.sourceSha256,hash(path.join(root,a.source)),a.key+' source');
    assert.equal(a.outputSha256,hash(path.join(base,a.output)),a.key+' output');
    if(a.key==='brand-synk'||a.key.endsWith('page'))assert.match(a.transform,/^Approved complete logo or current introduction snapshot;/,a.key);
    else assert.equal(a.transform,ASSET_TRANSFORM,a.key);
  }
  const main=manifest.find(x=>x.key==='brand-synk');
  assert.equal(main.source,'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink.png');
  for(const brand of ['lab','shift','pulse']){
    const a=manifest.find(x=>x.key==='brand-'+brand);assert.ok(a,brand);
    assert.ok(a.source.includes('/_개선/배치용/'),brand);assert.equal(a.sourceSha256,a.outputSha256,brand+' original stitches');
  }
  for(const [key,file] of [['letter','봉투'],['book','책'],['scissors','가위']])assert.ok(manifest.find(x=>x.key===key).source.endsWith('/_개선/'+file+'-2.5.png'));
  for(const a of manifest.filter(x=>x.key.endsWith('page')))assert.ok(a.source.includes('/브랜드소개_20260909/소개서_4K/'),a.key);
});

test('공개수업도 현행 HTML 탐색에 포함하고 한 장의 완성 SHIFT 로고를 표시한다',()=>{
  const {currentHtmlFiles}=require('../docs/홍보물/로고갱신_20260910.cjs');
  const marketing=path.join(root,'docs/홍보물/마케팅실행_20260909');
  const lecture=path.join(marketing,'공개수업/index.html');
  assert.ok(currentHtmlFiles(marketing).includes(lecture),'media siblings must not exclude a public HTML page');
  const html=fs.readFileSync(lecture,'utf8');
  const header=html.match(/<div class="brand-lock"[^>]*>[\s\S]*?<\/div>/);
  assert.ok(header,'public class logo header exists');
  assert.equal((header[0].match(/<img\b/g)||[]).length,1);
  assert.match(header[0],/data-approved-logo="SHIFT"/);
  assert.match(header[0],/src="\.\.\/assets\/brand-full-shift-ink\.webp"/);
  assert.doesNotMatch(header[0],/division-stitch-logo|brand-synk\.webp|brand-shift\.webp/);
});
