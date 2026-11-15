'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {collect,resolveAccount}=require('../tools/계정통계예약/rutube-public.cjs');
const account=resolveAccount('lab-ru-rutube'),owner=account.externalId,base='https://rutube.ru/api/video/person/'+owner+'/';
const identity=(id=owner)=>'<head><meta property="og:title" content="SYNK LAB Russia"><meta property="og:url" content="/channel/'+id+'/"><meta name="description" content="channel ('+id+')"></head>';
const video=(hex,hits)=>({id:hex.repeat(32),author:{id:Number(owner)},publication_ts:'2026-01-01T00:00:00+03:00',hits,video_url:'https://rutube.ru/video/'+hex.repeat(32)+'/'});
function page(page,results,next){return {page,per_page:20,has_next:!!next,next:next||null,results};}
function fake(pages,html=identity()){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    assert.equal(options.redirect,'error');
    calls.push(url);
    if(url===account.publicUrl)return new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}});
    const n=new URL(url).searchParams.get('page');
    assert.equal(new URL(url).origin,'https://rutube.ru');
    return new Response(JSON.stringify(pages[Number(n)-1]),{headers:{'content-type':'application/json'}});
  };
  return {fetchImpl,calls};
}
test('빈 목록은 게시물이 하나도 없는 이번 공식 응답이며 조회수·좋아요·공유 합계를 만들어 내지 않는다',async()=>{
  const source=fake([page(1,[])]),files=new Map();
  const result=await collect(account,{fetchImpl:source.fetchImpl,capture:(n,b)=>files.set(n,b)});
  assert.equal(result.inventoryComplete,true);
  assert.equal(result.listedVideos,0);
  assert.deepEqual(result.videos,[]);
  assert.equal(Object.hasOwn(result,'views'),false);
  assert.ok(!('metrics' in result));
  for(const entry of result.sources)assert.equal(require('node:crypto').createHash('sha256').update(files.get(entry.evidenceFile)).digest('hex'),entry.sha256);
});
test('목록을 끝까지 읽고 정확한 0과 미제공·축약 수치를 구별한다',async()=>{
  const next=base+'?page=2&format=json';
  const source=fake([page(1,[video('a','0'),video('b',null)],next),page(2,[video('c','1.3K'),video('d','36')])]);
  const result=await collect(account,source);
  assert.equal(result.listedVideos,4);
  assert.equal(result.videosWithExactViews,2);
  assert.deepEqual(result.videos.map(v=>v.metrics.views),[0,null,null,36]);
  assert.equal(result.sources.length,3);
  const partial=await collect(account,{...fake([page(1,[video('a',2)],next)]),maxPages:1});
  assert.equal(partial.inventoryComplete,false);
});
test('다른 계정·겹친 영상·목록 밖 주소는 완료로 저장되지 않는다',async()=>{
  await assert.rejects(collect(account,fake([page(1,[])],identity('321'))),/채널 번호/);
  await assert.rejects(collect(account,fake([page(1,[{...video('a',1),author:{id:321}}])])),/게시자/);
  await assert.rejects(collect(account,fake([page(1,[video('a',1)],'https://elsewhere.invalid/?page=2')])),/다음 페이지/);
  await assert.rejects(collect(account,fake([page(1,[video('a',1)],base+'?page=2'),page(2,[video('a',1)])])),/겹쳐/);
});
test('계정 원장에 같은 번호와 승인된 공식 주소가 있어야만 호출한다',()=>{
  assert.throws(()=>resolveAccount('does-not-exist'),/계정/);
  assert.throws(()=>resolveAccount(account.id,{accounts:[{...account,publicUrl:'https://example.org/channel/'+owner+'/'}]}),/일치/);
});

