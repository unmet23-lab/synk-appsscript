'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readPublicPage,publicEnvelope}=require('../tools/계정통계예약/public-metrics.cjs');
const account={id:'guest-brunch',platform:'brunch',handle:'예시 작가',publicUrl:'https://brunch.co.kr/@@example'};
const canonical='https://brunch.co.kr/@newwriter';
const args={platform:'brunch',handle:account.handle,urls:[account.publicUrl,canonical],registeredUrl:account.publicUrl,canonicalUrl:canonical,expectedTitle:'예시 작가의 브런치'};
function inspect({url=canonical,title=args.expectedTitle,author=account.handle,advertised=canonical,route=args}={}){
 const document={title,body:{innerText:['메뉴',author,'팔로워','0','팔로잉','1'].join('\n')},querySelector:()=>({href:advertised})};
 return JSON.parse(JSON.stringify(vm.runInNewContext('('+readPublicPage.toString()+')(args)',{args:route,location:new URL(url),URL,Date,document})));
}
test('등록 주소 방문 이후 공식 canonical과 작가가 일치할 때만 해당 원장에 기록한다',()=>{
 const snap=inspect();assert.equal(snap.matched,true);assert.deepEqual(snap.metrics,{followers:0});
 assert.deepEqual(snap.authorRoute,{requestedUrl:account.publicUrl,finalUrl:canonical,canonical,author:account.handle,profileTitle:args.expectedTitle});
 assert.equal(publicEnvelope({account,sourceUrl:snap.url,snapshot:snap,digest:'a'.repeat(64)}).sourceUrl,account.publicUrl);
 for(const change of [{title:'다른 작가의 브런치'},{author:'다른 사람'},{advertised:'https://brunch.co.kr/@another'},{route:{...args,urls:[canonical,account.publicUrl]}}]){
  const stale=inspect(change);assert.equal(stale.matched,false);assert.equal(publicEnvelope({account,sourceUrl:stale.url,snapshot:stale,digest:'a'.repeat(64)}),null);
 }
 const invalid={...snap,authorRoute:{...snap.authorRoute,requestedUrl:canonical}};
 assert.equal(publicEnvelope({account,sourceUrl:invalid.url,snapshot:invalid,digest:'a'.repeat(64)}),null);
});
