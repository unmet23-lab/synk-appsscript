'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {youtubeAboutUrl,readAbout} = require('../tools/계정통계예약/youtube-public.cjs');
const {publicEnvelope} = require('../tools/계정통계예약/public-metrics.cjs');
const {capture} = require('../tools/계정통계예약/capture-routes.cjs');

const id='UC'+'a'.repeat(22), origin='https://www.youtube.com', registeredUrl=origin+'/@example';
const account={id:'fixture-youtube',platform:'youtube',handle:'@example',publicUrl:registeredUrl,externalId:id};
function read(changes={}){
  const {views='조회수 12,345회',header='Example\n@example\n구독자 12명',aboutHandle='@example',canonical=origin+'/channel/'+id,
    finalUrl=registeredUrl+'/about',registered=registeredUrl,expectedId=id,hidden=false,moreRows=[]}=changes;
  const rect=()=>[{}];
  const link={href:'http://www.youtube.com/'+aboutHandle,innerText:'www.youtube.com/'+aboutHandle,getClientRects:rect};
  const rows=[{innerText:link.innerText,getClientRects:rect,querySelectorAll:()=>[link]},...[views,...moreRows].map(innerText=>({innerText,getClientRects:rect,querySelectorAll:()=>[]}))];
  const panel={getClientRects:hidden?()=>[]:rect,querySelectorAll:()=>rows};
  const document={querySelector:s=>s.startsWith('link')?{href:canonical}:{innerText:header},querySelectorAll:()=>[panel]};
  return JSON.parse(JSON.stringify(vm.runInNewContext('('+readAbout.toString()+')(args)',{document,URL,Date,location:new URL(finalUrl),
    args:{registeredUrl:registered,externalId:expectedId,handle:'@example'}})));
}

test('YouTube 정보 화면의 실제 핸들과 고유 번호를 확인하고 조회수를 계정 누적으로 저장한다',()=>{
  for(const registered of [registeredUrl,origin+'/channel/'+id]){
    const snapshot=read({registered});
    assert.equal(snapshot.channel.channelId,id);assert.equal(snapshot.channel.registeredUrl,registered);
    assert.equal(snapshot.channel.headerHandle,'@example');assert.deepEqual(snapshot.metrics,{views:12345});
    const envelope=publicEnvelope({account,sourceUrl:snapshot.url,snapshot,digest:null});
    assert.equal(envelope.sourceUrl,registeredUrl+'/about');assert.equal(envelope.observations.length,1);
    assert.equal(envelope.observations[0].kind,'account-lifetime');
  }
  assert.deepEqual(read({views:'0 views'}).metrics,{views:0});
  for(const views of ['조회수 1.2만회','12K views','12,34 views','9,999,999,999,999,999 views',''])assert.deepEqual(read({views}).metrics,{});
  assert.deepEqual(read({moreRows:['조회수 7회']}).metrics,{});
});

test('다른 채널로 도착하거나 정보창의 핸들 및 고유 번호가 다르면 수집하지 않는다',()=>{
  for(const changes of [{header:'Example\n@else'}, {canonical:origin+'/channel/UC'+'b'.repeat(22)},
    {aboutHandle:'@else'},{finalUrl:origin+'/@else/about'},{registered:origin+'/@else'},
    {finalUrl:'https://example.com/@example/about'},{hidden:true}]){
    const snapshot=read(changes);assert.equal(snapshot.matched,false);assert.deepEqual(snapshot.metrics,{});
  }
  assert.equal(youtubeAboutUrl(account),registeredUrl+'/about');
  assert.equal(youtubeAboutUrl({...account,publicUrl:'https://example.com/@example'}),null);
});

test('YouTube API가 조회수를 이미 수집했으면 좋아요와 공유만을 위해 브라우저를 열지 않는다',async()=>{
  const unexpected=()=>assert.fail('브라우저가 불필요하게 열렸습니다');
  for(const missing of [['shares'],['likes','shares']])
    assert.equal(await capture({account,missing},{ownerSource:unexpected,publicSource:unexpected}),'no_metrics');
});
