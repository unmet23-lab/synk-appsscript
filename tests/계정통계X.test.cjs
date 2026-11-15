'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readPublicPage,readXTimeline}=require('../tools/계정통계예약/public-metrics.cjs');
const url='https://x.com/example',args={platform:'x',handle:'@example',urls:[url]};

function xDocument(){
 const history=[];
 const rect=()=>[{width:16,height:16}];
 const article={getClientRects:rect};
 const status='https://x.com/example/status/123456',time={getClientRects:rect,dateTime:'2026-11-14T12:00:00Z',closest:()=>({href:status})};
 const group={getClientRects:rect,closest:()=>article,getAttribute:()=> '3 reposts, 24 views'};
 function button(label,href){return {getClientRects:rect,getAttribute:()=>label,innerText:'',closest:()=>article,href};}
 const controls={like:button('0 Likes. Like'),reply:button('4 Replies. Reply'),analytics:button('24 views. View post analytics',status+'/analytics'),bookmark:button('Bookmark')};
 article.querySelector=s=>s==='time[datetime]'?time:null;
 article.querySelectorAll=s=>{history.push(s);if(s.startsWith('[role="group"'))return [group];if(s.startsWith('[data-testid=like]'))return [controls.like];if(s.startsWith('a[href*='))return [controls.analytics];if(s.includes('reply'))return [controls.reply];if(s.includes('bookmark'))return [controls.bookmark];return [];};
 return {document:{body:{innerText:'example'},querySelectorAll:s=>s==='article[data-testid="tweet"]'?[article]:[]},history,controls};
}
function withDOM(fixture){return JSON.parse(JSON.stringify(vm.runInNewContext('('+readPublicPage.toString()+')(args)',{args,document:fixture.document,location:new URL(url),URL,Date})));}
test('X 게시물의 버튼에 명시된 0과 조회수를 읽고 재게시·숫자 없는 북마크를 합산하지 않는다',()=>{
 const fixture=xDocument(),data=withDOM(fixture);assert.equal(data.posts.length,1);
 assert.deepEqual(data.posts[0].metrics,{views:24,likes:0,comments:4});assert.equal(data.posts[0].externalId,'123456');
 fixture.controls.analytics.href='https://x.com/other/status/999/analytics';fixture.controls.analytics.getAttribute=()=> '701 views. View post analytics';
 assert.equal(withDOM(fixture).posts[0].metrics.views,24);
});
test('X 타임라인은 첫 게시물의 실제 로딩을 기다리고 스크롤 전후의 같은 게시물을 한 번만 남긴다',async()=>{
 const reads=[],stages=[],read=()=>{},p=id=>({externalId:id,metrics:{views:2,likes:0}});
 const sets=[[p('10')],[p('10'),p('9')],[p('9')]];
 const page={waitForFunction:async()=>{stages.push('wait');},evaluate:async f=>{if(f!==read)return true;stages.push('read');const posts=sets.shift();reads.push(posts);return {matched:true,posts};}};
 const result=await readXTimeline(page,args,read);assert.deepEqual(stages.slice(0,2),['wait','read']);assert.equal(reads.length,3);assert.deepEqual(result.posts.map(x=>x.externalId),['10','9']);
});
test('목록이 로딩되지 않은 화면을 수치 미제공으로 끝내지 않는다',async()=>{
 const read=()=>{};const page={waitForFunction:async()=>{},evaluate:async f=>f===read?{matched:true,posts:[],empty:false}:null};
 const result=await readXTimeline(page,args,read);assert.equal(result.unavailable,'retry');
});
