'use strict';
// 외부 통계 파싱·계정 통계 수집(2026-11-14): 다른 계정·예약 노트·반쪽 줄·줄인 수·null과 0·겹친 날·덜 끝난 기간·합계 중복·경로 탈출·미리 보기 무인증·재전송.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {parseXhs,parseTelegram,parseNaverDaily,periodSummaries}=require('../tools/lib/외부통계파싱.cjs');
const 수집=require('../tools/계정통계수집.cjs');

const code=reason=>({code:'SYNK_METRICS_'+reason});
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const shift=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);

const XHS={accountId:'lab-cn-xiaohongshu',expectedAccountName:'SYNK 한국어',externalId:'6ab10807000000000301d12f'};
const A='64f0a1b2000000001f00aa01',B='64f0a1b2000000001f00aa02';
// 실제 노트 관리 화면 꼴(11-14 감사본): 영상 길이 · 제목 · 한 줄 전체인 게시 시각 · 수치 다섯 줄. 예약은 「定时发布」 줄과 GMT+8 예약 시각 줄, 수치는 [].
const note=(noteId,metrics=[12,0,3,1,0])=>({noteId,title:'인사말',text:['00:26','인사말','2026-11-13 21:00',...metrics].join('\n'),metrics});
const planned={noteId:'6af2a83f000000001903ad9f',title:'예약 노트',text:'00:19\n예약 노트\n定时发布\n2026-11-15 21:00 （GMT+8:00 北京时间）',metrics:[]};
const xhs=(rows,extra={})=>({observedAt:'2026-11-14T09:00:00+08:00',accountName:'SYNK 한국어',profileId:XHS.externalId,paginationComplete:true,expectedCount:rows.length,rows,...extra});

test('샤오훙수: 예약 노트는 빼고, 게시 노트는 공식 프로필 주소·+08:00 게시 시각·0까지 그대로 남긴다',()=>{
  const {envelope,summary}=parseXhs(xhs([note(A),planned,note(B,[5,1,0,0,2])]),XHS);
  assert.equal(summary.scheduled,1);assert.equal(envelope.observations.length,2);assert.equal(envelope.evidenceSha256,null);
  assert.equal(envelope.observedAt,'2026-11-14T09:00:00+08:00');assert.deepEqual(envelope.identity,{accountId:XHS.accountId,externalId:XHS.externalId});
  assert.deepEqual(envelope.observations[0],{kind:'post-lifetime',post:{externalId:A,url:`https://www.rednote.com/user/profile/${XHS.externalId}/${A}`,publishedAt:'2026-11-13T21:00:00+08:00',title:'인사말'},metrics:{views:12,comments:0,likes:3,saves:1,shares:0}});
});
test('샤오훙수: 다른 계정·끝까지 안 읽은 목록·줄인 수·빈 수치·알 수 없는 줄은 묶음 전체를 거절한다',()=>{
  assert.throws(()=>parseXhs(xhs([note(A)],{accountName:'다른 계정'}),XHS),code('IDENTITY'));
  assert.throws(()=>parseXhs(xhs([note(A)]),{...XHS,externalId:'abc'}),code('IDENTITY'));
  assert.throws(()=>parseXhs(xhs([note(A)],{paginationComplete:false}),XHS),code('INCOMPLETE'));
  assert.throws(()=>parseXhs(xhs([note(A)],{expectedCount:23}),XHS),code('INCOMPLETE'));
  assert.throws(()=>parseXhs(xhs([note(A,[12,'1.2万',3,1,0])]),XHS),code('COUNT'));
  assert.throws(()=>parseXhs(xhs([note(A,[12,null,3,1,0])]),XHS),code('COUNT'));
  assert.throws(()=>parseXhs(xhs([note(A,[12,3,1,0])]),XHS),code('ROW'));
  assert.throws(()=>parseXhs(xhs([{...note(A),text:'审核中'}]),XHS),code('ROW'));
  assert.throws(()=>parseXhs(xhs([{...planned,metrics:[1,2,3,4,5]}]),XHS),code('ROW'));
  assert.throws(()=>parseXhs(xhs([{...note(A),noteId:'not-a-note'}]),XHS),code('ROW'));
  assert.throws(()=>parseXhs(xhs([note(A),note(A)]),XHS),code('DUPLICATE'));
  assert.throws(()=>parseXhs(xhs([note(A)],{capturedBy:'x'}),XHS),code('SHAPE'));
  assert.throws(()=>parseXhs(xhs([planned]),XHS),code('NO_ROWS'));
});
// 11-14 감사본 두 줄 그대로. 게시 시각은 한 줄 전체인 날짜뿐이고, 예약 줄은 「定时发布」 + GMT+8 미래 시각 + 빈 수치다.
const ACTUAL_XHS=[{noteId:'6af2a802000000001903ad8a',title:'用韩语说时间，数字要用两套 😤',text:'00:26\n用韩语说时间，数字要用两套 😤\n2026-11-13 21:00\n24\n0\n4\n1\n0',metrics:['24','0','4','1','0']},
  {noteId:'6af2a83f000000001903ad9f',title:'我只是打了一个句号…',text:'00:19\n我只是打了一个句号…\n定时发布\n2026-11-14 21:00 （GMT+8:00 北京时间）',metrics:[]}];
test('샤오훙수 실제 꼴: 한 줄 전체인 날짜만 게시 시각으로 읽고, 제목·글 속 날짜나 지난 예약 시각은 거절한다',()=>{
  const {envelope,summary}=parseXhs(xhs(ACTUAL_XHS),XHS);
  assert.deepEqual(summary,{rows:2,published:1,scheduled:1});
  assert.deepEqual(envelope.observations,[{kind:'post-lifetime',post:{externalId:'6af2a802000000001903ad8a',url:`https://www.rednote.com/user/profile/${XHS.externalId}/6af2a802000000001903ad8a`,publishedAt:'2026-11-13T21:00:00+08:00',title:'用韩语说时间，数字要用两套 😤'},metrics:{views:24,comments:0,likes:4,saves:1,shares:0}}]);
  const [live,plan]=ACTUAL_XHS;
  assert.equal(parseXhs(xhs([{...live,text:live.text.replace('2026-11-13 21:00','发布于 2026-11-13 21:00')}]),XHS).envelope.observations[0].post.publishedAt,'2026-11-13T21:00:00+08:00');
  for(const text of ['00:26\n2026-11-13 21:00 用韩语说时间\n24\n0\n4\n1\n0','00:26\n用韩语说时间\n2026-02-30 21:00\n24\n0\n4\n1\n0','00:26\n用韩语说时间\n2026-11-13 21:00\n2026-11-12 20:00\n24'])
    assert.throws(()=>parseXhs(xhs([{...live,text}]),XHS),code('ROW'),text);
  assert.throws(()=>parseXhs(xhs([{...live,title:'2026-11-13 21:00',text:'00:26\n2026-11-13 21:00\n24\n0\n4\n1\n0'}]),XHS),code('ROW'),'제목과 같은 날짜 줄만 있으면 게시 시각이 아니다');
  assert.throws(()=>parseXhs(xhs([plan],{observedAt:'2026-11-14T22:00:00+08:00'}),XHS),code('ROW'),'지난 예약 시각');
  assert.throws(()=>parseXhs(xhs([{...plan,text:plan.text.replace(' （GMT+8:00 北京时间）','')}]),XHS),code('ROW'),'예약 표시와 게시 시각 줄이 함께');
});

// 11-20부터 바뀐 꼴(11-23 실제 회차 증거): 빗금 날짜 · 달과 날 앞 0 없음 · 예약 시각 줄에 GMT+8 꼬리표 없음
const SLASH_XHS=[{noteId:'6aff0001000000001903ad01',title:'脱口而出“아이고！”？',text:'00:11\n脱口而出“아이고！”？\n2026/11/20 21:00\n1\n0\n1\n0\n0',metrics:['1','0','1','0','0']},
  {noteId:'6aff0002000000001903ad02',title:'在韩国餐厅叫服务员',text:'00:22\n在韩国餐厅叫服务员\n2026/11/9 21:00\n264\n0\n9\n2\n2',metrics:['264','0','9','2','2']},
  {noteId:'6aff0003000000001903ad03',title:'韩国餐厅怎么叫服务员？',text:'00:19\n韩国餐厅怎么叫服务员？\n定时发布\n2026/11/23 22:00',metrics:[]}];
test('샤오훙수 빗금 꼴: 「2026/11/9 21:00」을 게시 시각으로 읽고, 꼬리표 없는 빗금 예약 줄은 예약으로 건너뛴다',()=>{
  const KST={observedAt:'2026-11-20T21:13:18+08:00',viewerTimeZone:'Asia/Seoul'};
  const {envelope,summary}=parseXhs(xhs(SLASH_XHS,KST),XHS);
  assert.deepEqual(summary,{rows:3,published:2,scheduled:1});
  assert.deepEqual(envelope.observations.map(o=>o.post.publishedAt),['2026-11-20T21:00:00+08:00','2026-11-09T21:00:00+08:00']);
  const [live,second,plan]=SLASH_XHS;
  assert.throws(()=>parseXhs(xhs([second,{...plan,text:plan.text+'\n2026/11/20 21:00'}],KST),XHS),code('ROW'),'예약 줄 말고 날짜 줄이 하나 더');
  assert.throws(()=>parseXhs(xhs([second,plan],{...KST,observedAt:'2026-11-24T09:00:00+08:00'}),XHS),code('ROW'),'지난 예약 시각');
  for(const text of ['00:11\n脱口而出\n2026/13/20 21:00\n1\n0\n1\n0\n0','00:11\n脱口而出\n2026/11-20 21:00\n1\n0\n1\n0\n0','00:11\n脱口而出\n2026/11/20 21:00\n2026/11/19 21:00\n1\n0\n1\n0\n0'])
    assert.throws(()=>parseXhs(xhs([{...live,text}],KST),XHS),code('ROW'),text);
});
test('샤오훙수 빗금 예약 시각은 보는 PC의 시간대로 읽는다(GPT GA1): 한국 22:00 예약을 한국 22:30에 보면 지난 예약이다',()=>{
  const [,second,plan]=SLASH_XHS;
  // 2026/11/23 22:00(한국) = 13:00Z. 13:30Z에 아직 예약으로 보이면 거절한다. 베이징으로 읽으면 14:00Z라 통과하던 경우다.
  assert.throws(()=>parseXhs(xhs([second,plan],{observedAt:'2026-11-23T13:30:00Z',viewerTimeZone:'Asia/Seoul'}),XHS),code('ROW'),'한 시간 늦게 보지 않는다');
  assert.equal(parseXhs(xhs([second,plan],{observedAt:'2026-11-23T12:30:00Z',viewerTimeZone:'Asia/Seoul'}),XHS).summary.scheduled,1);
  assert.throws(()=>parseXhs(xhs([second,plan],{observedAt:'2026-11-23T12:30:00Z'}),XHS),code('ROW'),'시간대 없이 꼬리표 없는 예약 시각');
  for(const viewerTimeZone of ['Mars/Base',540,null,''])
    assert.throws(()=>parseXhs(xhs([second],{observedAt:'2026-11-20T21:13:18+08:00',viewerTimeZone}),XHS),code('SHAPE'),String(viewerTimeZone));
  // 일광 절약 시간이 끝나는 날(GPT 다시 검수 GA1): 시드니 2027/4/4 02:15는 관측 때의 UTC+11이 아니라 그 시각의 UTC+10으로 읽는다
  const sydney={...plan,text:plan.text.replace('2026/11/23 22:00','2027/4/4 02:15')};
  assert.equal(parseXhs(xhs([second,sydney],{observedAt:'2027-04-03T15:45:00Z',viewerTimeZone:'Australia/Sydney'}),XHS).summary.scheduled,1);
  assert.throws(()=>parseXhs(xhs([second,sydney],{observedAt:'2027-04-03T16:35:00Z',viewerTimeZone:'Australia/Sydney'}),XHS),code('ROW'));
  // 같은 시각이 두 번인 날은 어느 쪽인지 모르므로 뒤의 순간까지 지나야 거절한다(GPT 셋째 검수 GA1 · GA2): 뉴욕 2027/11/7 01:30은 05:30Z와 06:30Z
  const ny={...plan,text:plan.text.replace('2026/11/23 22:00','2027/11/7 01:30')};
  for(const observedAt of ['2027-11-07T05:45:00Z','2027-11-07T06:15:00Z'])
    assert.equal(parseXhs(xhs([second,ny],{observedAt,viewerTimeZone:'America/New_York'}),XHS).summary.scheduled,1,observedAt);
  assert.throws(()=>parseXhs(xhs([second,ny],{observedAt:'2027-11-07T06:50:00Z',viewerTimeZone:'America/New_York'}),XHS),code('ROW'));
  // 건너뛴 시각(시작하는 날 02:30)은 후보(06:30Z · 07:30Z) 가운데 늦은 쪽
  const gap={...plan,text:plan.text.replace('2026/11/23 22:00','2027/3/14 02:30')};
  assert.equal(parseXhs(xhs([second,gap],{observedAt:'2027-03-14T07:00:00Z',viewerTimeZone:'America/New_York'}),XHS).summary.scheduled,1);
  assert.throws(()=>parseXhs(xhs([second,gap],{observedAt:'2027-03-14T07:50:00Z',viewerTimeZone:'America/New_York'}),XHS),code('ROW'));
  // 예약 시각 뒤 15분까지는 늦게 올라가는 중으로 보고 거절하지 않는다(Fable P2). 시는 한 자리도 받는다(Fable P2)
  for(const observedAt of ['2026-11-23T13:00:00Z','2026-11-23T13:10:00Z'])
    assert.equal(parseXhs(xhs([second,plan],{observedAt,viewerTimeZone:'Asia/Seoul'}),XHS).summary.scheduled,1,observedAt);
  assert.throws(()=>parseXhs(xhs([second,plan],{observedAt:'2026-11-23T13:15:00Z',viewerTimeZone:'Asia/Seoul'}),XHS),code('ROW'),'15분째부터 거절');
  const nine={...plan,text:plan.text.replace('2026/11/23 22:00','2026/11/24 9:00')};
  assert.equal(parseXhs(xhs([second,nine],{observedAt:'2026-11-23T13:00:00Z',viewerTimeZone:'Asia/Seoul'}),XHS).summary.scheduled,1);
  // 꼬리표가 있는 빗금 예약 줄은 베이징 시각이다
  const tagged={...plan,text:plan.text.replace('2026/11/23 22:00','2026/11/23 21:00 （GMT+8:00 北京时间）')};
  assert.equal(parseXhs(xhs([second,tagged],{observedAt:'2026-11-23T12:30:00Z'}),XHS).summary.scheduled,1);
  assert.throws(()=>parseXhs(xhs([second,tagged],{observedAt:'2026-11-23T13:30:00Z'}),XHS),code('ROW'));
});

const TG={accountId:'lab-telegram',handle:'synkmn'};
const post=(n,extra={})=>({post:`synkmn/${n}`,url:`https://t.me/synkmn/${n}`,datetime:'2026-11-13T12:00:00+00:00',views:'345',text:'몽골 교실 소식',...extra});
const tg=(rows,extra={})=>({sourceUrl:'https://t.me/s/synkmn',observedAt:'2026-11-14T03:00:00Z',accountHandle:'@synkmn',rows,...extra});
test('텔레그램: 서비스 줄만 건너뛰고, 공개 화면에 없는 좋아요·공유는 0이 아니라 null이다',()=>{
  const {envelope,summary}=parseTelegram(tg([{post:'synkmn/20',url:'https://t.me/synkmn/20',service:true,text:'Channel created'},post(21)]),TG);
  assert.equal(summary.service,1);assert.equal(envelope.sourceType,'public-page');assert.equal(envelope.sourceUrl,'https://t.me/s/synkmn');
  assert.deepEqual(envelope.observations,[{kind:'post-lifetime',post:{externalId:'21',url:'https://t.me/synkmn/21',publishedAt:'2026-11-13T12:00:00+00:00',title:'몽골 교실 소식'},metrics:{views:345,likes:null,shares:null}}]);
  assert.equal(parseTelegram(tg([post(22,{views:0,likes:0})]),TG).envelope.observations[0].metrics.likes,0);
});
test('텔레그램: 다른 채널·정식이 아닌 주소·반쪽 줄·줄인 수·시간대 없는 시각은 거절한다',()=>{
  assert.throws(()=>parseTelegram(tg([post(21)],{accountHandle:'synkmn_fake'}),TG),code('IDENTITY'));
  assert.throws(()=>parseTelegram(tg([post(21)],{sourceUrl:'https://t.me/s/another'}),TG),code('SOURCE'));
  assert.throws(()=>parseTelegram(tg([post(21,{url:'https://t.me/s/synkmn/21'})]),TG),code('ROW'));
  assert.throws(()=>parseTelegram(tg([post(21,{post:'another/21'})]),TG),code('ROW'));
  assert.throws(()=>parseTelegram(tg([post(21,{views:null})]),TG),code('PARTIAL'));
  assert.throws(()=>parseTelegram(tg([post(21,{datetime:null})]),TG),code('PARTIAL'));
  assert.throws(()=>parseTelegram(tg([post(21,{views:'1.2K'})]),TG),code('COUNT'));
  assert.throws(()=>parseTelegram(tg([post(21,{datetime:'2026-11-13 12:00'})]),TG),code('TIME'));
  assert.throws(()=>parseTelegram(tg([post(21),post(21)]),TG),code('DUPLICATE'));
});
// 11-14 감사본 꼴: 서비스 줄은 service:true에 시각은 있고 조회수가 없다. 글 줄은 service:false.
const ACTUAL_TG=[{post:'synkmn/2',url:'https://t.me/synkmn/2',datetime:'2026-09-06T17:27:51+00:00',service:true,text:'Channel photo updated'},
  {post:'synkmn/5',url:'https://t.me/synkmn/5',datetime:'2026-10-26T16:25:16+00:00',views:'1',service:false,text:'example'}];
test('텔레그램 실제 꼴: service:true이고 수치가 없는 줄만 건너뛰되 글 번호·주소·시각을 검사하고, service:false인데 조회수가 없으면 거절한다',()=>{
  const {envelope,summary}=parseTelegram(tg(ACTUAL_TG),TG);
  assert.deepEqual(summary,{rows:2,posts:1,service:1});
  assert.deepEqual(envelope.observations,[{kind:'post-lifetime',post:{externalId:'5',url:'https://t.me/synkmn/5',publishedAt:'2026-10-26T16:25:16+00:00',title:'example'},metrics:{views:1,likes:null,shares:null}}]);
  const [notice,content]=ACTUAL_TG;
  const cases=[[{...content,views:undefined},'PARTIAL'],[{...content,service:undefined,views:null},'PARTIAL'],[{...notice,service:'true'},'ROW'],[{...notice,views:'3'},'ROW'],
    [{...notice,post:'another/2',url:'https://t.me/another/2'},'ROW'],[{...notice,url:'https://t.me/s/synkmn/2'},'ROW'],[{...notice,datetime:'2026-09-06 17:27'},'TIME'],
    [{post:null,url:null,datetime:null,views:null,text:'Channel created'},'ROW']];
  for(const [row,reason] of cases)assert.throws(()=>parseTelegram(tg([row,post(21)]),TG),code(reason),reason);
});

const NAVER={accountId:'shift-naverblog',handle:'synkshift'},AT='2026-11-14T10:00:00+09:00';
const naverRows=()=>[['조회수','일간'],['기간','2026.11.10 ~ 2026.11.14'],[],['날짜','전체','피이웃','서로이웃','기타'],
  ['2026.11.10',10,1,2,3],['2026.11.11','0',0,0,0],['2026.11.12','1,234',4,30,100],['2026.11.13',5,1,1,1],['2026.11.14',2,0,0,2],['합계',1251,6,33,106]];
const naver=rows=>({sheets:[{name:'조회수',rows}]});
const edited=change=>{const rows=naverRows();change(rows);return naver(rows);};
test('네이버: 「전체」 열만 하루짜리 기간 관측으로 내고, 합계 행·이웃 열을 더하지 않으며 내보낸 날(덜 끝난 날)은 뺀다',()=>{
  const result=parseNaverDaily(naver(naverRows()),NAVER,AT);
  assert.deepEqual(result.days,[{date:'2026-11-10',views:10},{date:'2026-11-11',views:0},{date:'2026-11-12',views:1234},{date:'2026-11-13',views:5}]);
  assert.deepEqual(result.excludedPartialDays,['2026-11-14']);assert.equal(result.envelope.observations.length,4);
  assert.deepEqual(result.envelope.observations[0],{kind:'account-period',period:{start:'2026-11-10',end:'2026-11-10'},metrics:{views:10}});
  assert.equal(result.envelope.sourceUrl,'https://admin.blog.naver.com/synkshift/stat/download');assert.equal(result.envelope.exportFormat,'xlsx');
  assert.deepEqual(result.envelope.identity,{accountId:'shift-naverblog',handle:'synkshift'});
  const descending=naverRows();descending.splice(4,5,...descending.slice(4,9).reverse());
  assert.deepEqual(parseNaverDaily(descending,NAVER,AT).days,result.days);
});
test('네이버: 겹친 날·빠진 날·빈 칸·줄인 수·맞지 않는 합계·전체보다 큰 이웃 열·다른 단위·다른 수치·다른 기간·머리글·날짜 형식·미래 날짜·계정 설정을 거절한다',()=>{
  const cases=[[r=>{r[5][0]='2026.11.10';},'DUPLICATE'],[r=>{r.splice(6,1);},'GAP'],[r=>{r[5][3]='';},'COUNT'],[r=>{r[5][1]='1.2만';},'COUNT'],
    [r=>{r[9][1]=9999;},'TOTAL'],[r=>{r[4][2]=11;},'TOTAL'],[r=>{r[0][1]='주간';},'METRIC'],[r=>{r[0][0]='순방문자수';},'METRIC'],
    [r=>{r[1][1]='2026.11.09 ~ 2026.11.14';},'RANGE'],[r=>{r[3][1]='합산';},'HEADER'],[r=>{r[4][0]=46000;},'DATE']];
  for(const [change,reason] of cases)assert.throws(()=>parseNaverDaily(edited(change),NAVER,AT),code(reason),reason);
  assert.throws(()=>parseNaverDaily(naver(naverRows()),NAVER,'2026-11-13T10:00:00+09:00'),code('FUTURE'));
  assert.throws(()=>parseNaverDaily(naver(naverRows()),{accountId:'shift-naverblog'},AT),code('IDENTITY'));
});
// 11-14 감사본 꼴: 칸 주소 열쇠(A1·C8), 따로 있는 요일 열, 날짜 내림차순 90일(08-16~11-13). 첫 두 줄은 실제 값이고 「전체」 합은 공식 163이 되게 채운다.
const NAVER_AT='2026-11-14T06:24:52+09:00';
function naverExport(){
  const rows=[{A1:'서비스명',B1:'블로그 통계'},{A2:'데이터명',B2:'조회수'},{A3:'데이터 단위',B3:'일간'},{A4:'데이터 기간',B4:'2026-08-16 ~ 2026-11-13'},
    {A5:'다운로드 날짜',B5:'2026년 11월 14일 06시 24분 52초'},{},{A7:'날짜',B7:'요일',C7:'전체',D7:'피이웃',E7:'서로이웃',F7:'기타'}];
  for(let i=0;i<90;i++){
    const date=shift('2026-11-13',-i),views=String(i===0?3:i===1?7:i-2<65?2:1),r=8+i;
    rows.push({[`A${r}`]:date,[`B${r}`]:'일월화수목금토'[new Date(date+'T00:00:00Z').getUTCDay()],[`C${r}`]:views,[`D${r}`]:'0',[`E${r}`]:'0',[`F${r}`]:views});
  }
  return {sheets:[{rows}]};
}
test('네이버 실제 꼴: 칸 주소 열쇠와 요일 열을 읽고, 90일 「전체」 합이 공식 163으로 이웃 열을 더하지 않는다',()=>{
  const result=parseNaverDaily(naverExport(),NAVER,NAVER_AT);
  assert.equal(result.days.length,90);assert.equal(result.days[0].date,'2026-08-16');assert.deepEqual(result.days.slice(-2),[{date:'2026-11-12',views:7},{date:'2026-11-13',views:3}]);
  assert.equal(result.days.reduce((sum,d)=>sum+d.views,0),163);assert.equal(result.envelope.observations.length,90);
  assert.deepEqual(result.excludedPartialDays,[]);assert.deepEqual(result.summary.segments,['피이웃','서로이웃','기타']);
  const changed=fn=>{const input=naverExport();fn(input.sheets[0].rows);return input;};
  const cases=[[r=>{r[7].B8='토';},'DATE'],[r=>{r[7].B8='';},'DATE'],[r=>{r[7]={A8:'2026-11-13',B9:'금',C8:'3',D8:'0',E8:'0',F8:'3'};},'SHAPE'],
    [r=>{r[7]={A:'2026-11-13',B8:'금',C8:'3',D8:'0',E8:'0',F8:'3'};},'SHAPE'],[r=>{r.splice(5,1);},'SHAPE'],[r=>{r[7].F8='4';},'TOTAL']];
  for(const [change,reason] of cases)assert.throws(()=>parseNaverDaily(changed(change),NAVER,NAVER_AT),code(reason),reason);
});

test('기간 요약: 앞뒤 같은 길이의 끝난 기간만 셈하고, 빈 날은 0이 아니며, 앞 기간이 0이면 성장률 대신 새 활동 표시',()=>{
  const daily=Array.from({length:14},(_,i)=>({date:shift('2026-11-01',i),views:i<7?10:14}));
  const [week,month]=periodSummaries(daily,'2026-11-14',[7,30]).windows;
  assert.deepEqual(week.current,{start:'2026-11-08',end:'2026-11-14',coverage:7,complete:true,sum:98});
  assert.equal(week.previous.sum,70);assert.equal(week.change,28);assert.equal(week.growth,0.4);assert.equal(week.newActivity,null);
  assert.equal(month.current.sum,null);assert.equal(month.current.coverage,14);assert.equal(month.growth,null);
  const zero=periodSummaries(daily.map((row,i)=>({...row,views:i<7?0:row.views})),'2026-11-14',[7]).windows[0];
  assert.equal(zero.previous.sum,0);assert.equal(zero.growth,null);assert.equal(zero.newActivity,true);
  const gap=periodSummaries(daily.map((row,i)=>i===10?{...row,views:null}:row),'2026-11-14',[7]).windows[0];
  assert.equal(gap.current.sum,null);assert.equal(gap.current.coverage,6);assert.equal(gap.change,null);
  assert.equal(periodSummaries([],'2026-11-14',[7]).windows[0].current.sum,null);
  assert.throws(()=>periodSummaries([...daily,daily[0]],'2026-11-14'),code('DUPLICATE'));
});

// 11-14 첫 정식 검수 지적 재현: 증거의 공식 프로필 번호·예약 노트 겹침·관측 한도와 읽은 줄 상한·제목과 같은 게시 시각 줄·수 범위·유니코드 자르기·통계 종류·열 열쇠·기간 경계·합계 정밀도.
test('샤오훙수 신원: 캡처에서 읽은 공식 프로필 번호(profileId)가 없거나 설정과 다르면 화면 이름이 같아도 거절한다',()=>{
  const {profileId:_old,...withoutProfile}=xhs([note(A)]);
  assert.throws(()=>parseXhs(withoutProfile,XHS),{code:'SYNK_METRICS_IDENTITY',message:/profileId.*없어요/});
  assert.throws(()=>parseXhs(xhs([note(A)],{profileId:'6ab10807000000000301d130'}),XHS),code('IDENTITY'));
  assert.throws(()=>parseXhs(xhs([note(A)]),{...XHS,externalId:'6ab10807000000000301d130'}),code('IDENTITY'));
  assert.deepEqual(parseXhs(xhs([note(A)]),XHS).envelope.identity,{accountId:'lab-cn-xiaohongshu',externalId:'6ab10807000000000301d12f'});
});
test('샤오훙수 목록 수: 예약 노트도 번호·겹침을 먼저 검사하고 전체 수는 고유 노트 수와 맞춘다',()=>{
  assert.throws(()=>parseXhs(xhs([note(A),planned,planned]),XHS),code('DUPLICATE'));
  assert.throws(()=>parseXhs(xhs([note(A),{...planned,noteId:'예약'}]),XHS),code('ROW'));
  assert.throws(()=>parseXhs(xhs([note(A),planned],{expectedCount:3}),XHS),code('INCOMPLETE'));
  assert.deepEqual(parseXhs(xhs([note(A),planned,note(B)]),XHS).summary,{rows:3,published:2,scheduled:1});
});
test('샤오훙수 제목 자리: 제목이 게시 시각과 같은 글자여도 제목 줄 하나만 빼고 따로 있는 게시 시각 줄을 읽는다',()=>{
  const row={noteId:A,title:'2026-11-13 21:00',text:'00:26\n2026-11-13 21:00\n2026-11-13 21:00\n24\n0\n4\n1\n0',metrics:['24','0','4','1','0']};
  assert.deepEqual(parseXhs(xhs([row]),XHS).envelope.observations,[{kind:'post-lifetime',post:{externalId:A,url:`https://www.rednote.com/user/profile/6ab10807000000000301d12f/${A}`,publishedAt:'2026-11-13T21:00:00+08:00',title:'2026-11-13 21:00'},metrics:{views:24,comments:0,likes:4,saves:1,shares:0}}]);
});
test('관측 한도: 200개는 서비스 줄·예약 노트를 뺀 관측에만 걸고, 읽은 줄 상한은 따로 센다',()=>{
  const notice={post:'synkmn/1',url:'https://t.me/synkmn/1',service:true,text:'Channel created'},posts=n=>Array.from({length:n},(_,i)=>post(i+2));
  const {envelope,summary}=parseTelegram(tg([notice,...posts(200)]),TG);
  assert.deepEqual(summary,{rows:201,posts:200,service:1});assert.equal(envelope.observations.length,200);
  assert.throws(()=>parseTelegram(tg(posts(201)),TG),code('ROWS'));
  assert.throws(()=>parseTelegram(tg(Array.from({length:1001},(_,i)=>({post:`synkmn/${i+1}`,url:`https://t.me/synkmn/${i+1}`,service:true}))),TG),code('ROWS'));
  const notes=n=>Array.from({length:n},(_,i)=>note('64f0a1b2000000001f'+(i+1).toString(16).padStart(6,'0')));
  assert.deepEqual(parseXhs(xhs([...notes(200),planned]),XHS).summary,{rows:201,published:200,scheduled:1});
  assert.throws(()=>parseXhs(xhs(notes(201)),XHS),code('ROWS'));
});
test('수와 글자: 쉼표가 있든 없든 안전 정수만 받고, 제목은 이모지를 반으로 자르지 않는다',()=>{
  const views=value=>parseTelegram(tg([post(21,{views:value})]),TG).envelope.observations[0].metrics.views;
  assert.equal(views('9007199254740991'),9007199254740991);assert.equal(views('9,007,199,254,740,991'),9007199254740991);
  for(const value of ['9,007,199,254,740,993','9007199254740992',9007199254740992])assert.throws(()=>views(value),code('COUNT'),String(value));
  const title=text=>parseTelegram(tg([post(21,{text})]),TG).envelope.observations[0].post.title;
  assert.equal(title('가'.repeat(119)+'😀나'),'가'.repeat(119));assert.equal(title('가'.repeat(118)+'😀나'),'가'.repeat(118)+'😀');
});
test('네이버 검사: 다른 통계 머리글·앞에 0이 붙은 숫자 열·여분 숫자가 붙은 기간을 거절한다',()=>{
  const cases=[[r=>{r[0]=['일간 순 방문자 수'];},'METRIC'],[r=>{r[0][1]='일간 순 방문자 수';},'METRIC'],[r=>{r[1][1]='2026.11.10 ~ 2026.11.141';},'RANGE'],[r=>{r[1][1]='12026.11.10 ~ 2026.11.14';},'RANGE']];
  for(const [change,reason] of cases)assert.throws(()=>parseNaverDaily(edited(change),NAVER,AT),code(reason),reason);
  const keyed=last=>naver([['조회수','일간'],['기간','2026.11.12 ~ 2026.11.12'],{0:'날짜',1:'전체'},last]);
  assert.deepEqual(parseNaverDaily(keyed({0:'2026.11.12',1:17}),NAVER,AT).days,[{date:'2026-11-12',views:17}]);
  assert.throws(()=>parseNaverDaily(keyed({0:'2026.11.12',1:17,'01':2}),NAVER,AT),code('SHAPE'));
});
test('네이버 통계 종류: 장 이름에만 적힌 조회수·일간도 받고, 장 이름·보고서 머리글 어디든 방문·공감·주간·월간이 있으면 거절한다',()=>{
  const sheet=(name,heading=[])=>({sheets:[{name,rows:[...heading,['기간','2026.11.12 ~ 2026.11.12'],['날짜','전체'],['2026.11.12',17]]}]});
  assert.deepEqual(parseNaverDaily(sheet('조회수 일간'),NAVER,AT).days,[{date:'2026-11-12',views:17}]);
  assert.deepEqual(parseNaverDaily(sheet('조회수',[['일간']]),NAVER,AT).days,[{date:'2026-11-12',views:17}]);
  for(const [name,heading] of [['조회수 일간',[['방문자 수']]],['조회수 일간 공감',[]],['조회수 주간',[]],['조회수 일간',[['월간']]],['방문 일간',[['조회수']]],['조회수',[]],['일간',[]]])
    assert.throws(()=>parseNaverDaily(sheet(name,heading),NAVER,AT),code('METRIC'),`${name} ${JSON.stringify(heading)}`);
});
test('기간 요약: 합계를 정확한 정수로 더해 안전 범위 안의 차이는 그대로 내고, 넘는 합은 거절한다',()=>{
  const days=values=>values.map((views,i)=>({date:shift('2026-11-11',i),views}));
  const w=periodSummaries(days([9007199254740989,1,9007199254740989,2]),'2026-11-14',[2]).windows[0];
  assert.equal(w.previous.sum,9007199254740990);assert.equal(w.current.sum,9007199254740991);assert.equal(w.change,1);
  assert.throws(()=>periodSummaries(days([9007199254740991,1,9007199254740991,2]),'2026-11-14',[2]),code('TOTAL'));
});
function folder(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-account-metrics-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir=path.join(root,'run');fs.mkdirSync(dir);return {root,dir,logDir:path.join(root,'log')};
}
function telegramBatch(dir,file,n=21){
  const evidence={sourceUrl:'https://t.me/s/synkmn',observedAt:new Date(Date.now()-3600000).toISOString(),accountHandle:'synkmn',
    rows:[{post:`synkmn/${n}`,url:`https://t.me/synkmn/${n}`,datetime:new Date(Date.now()-86400000).toISOString(),views:7}]};
  const text=JSON.stringify(evidence);
  fs.writeFileSync(path.join(dir,file),text);
  // 봉투의 증거 해시는 봉투를 만들 때 읽은 바이트로 넣는다(파서는 null로 두고, 수집기는 빈 해시를 지금 파일 해시로 채우지 않는다).
  return {accountId:'lab-telegram',evidenceFile:file,envelope:{...parseTelegram(evidence,TG).envelope,evidenceSha256:sha(text)}};
}
const writeManifest=(dir,batches)=>{const file=path.join(dir,'manifest.json');fs.writeFileSync(file,JSON.stringify({version:1,batches}));return file;};
const CHANNEL={id:'ch-telegram',platform:'telegram',handle:'synkmn',publicUrl:'https://t.me/synkmn',catalogAccountId:'lab-telegram',active:true,canEdit:true};
const OBSERVE='/api/channels/ch-telegram/external-observations';
function workspace(channels=[CHANNEL],replay=false){
  const calls=[],ws={get:async route=>{calls.push(['GET',route]);return {channels};},
    post:async(route,body)=>{calls.push(['POST',route]);if(route==='/api/logout')return {};const ids=body.observations.map((_,i)=>'xmo_'+i);
      return {evidenceSha256:body.evidenceSha256,created:replay?[]:ids,existing:replay?ids:[]};}};
  return {calls,connect:async options=>{calls.push(['CONNECT',options.origin,options.session]);return ws;}};
}
const receipt=(dir,hash)=>JSON.parse(fs.readFileSync(path.join(dir,'receipts',hash+'.json'),'utf8'));

test('미리 보기는 자격·로그인·요청·잠금·영수증·기록 없이 검사만 하고 증거 해시는 파일에서 계산한다',async t=>{
  const {dir,logDir}=folder(t),manifestPath=writeManifest(dir,[telegramBatch(dir,'tg.json')]);
  const report=await 수집.run({manifestPath,env:{},logDir,connect:()=>{throw new Error('미리 보기에서 로그인하면 안 된다');}});
  assert.equal(report.mode,'preview');assert.equal(report.results[0].status,'ready');assert.match(report.results[0].evidenceSha256,/^[0-9a-f]{64}$/);
  assert.deepEqual(fs.readdirSync(dir).sort(),['manifest.json','tg.json']);assert.equal(fs.existsSync(logDir),false);
});
test('증거 경로가 목록 폴더 밖(.. · 절대 경로 · 연결 폴더)이면 그 묶음만 거절한다',async t=>{
  const {root,dir,logDir}=folder(t),good=telegramBatch(dir,'tg.json'),outside=path.join(root,'outside');
  fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'e.json'),'{}');fs.writeFileSync(path.join(root,'up.json'),'{}');
  let linked=true;
  try{fs.symlinkSync(outside,path.join(dir,'link'),'junction');}catch{linked=false;t.diagnostic('연결 폴더를 만들 수 없어 연결 경우는 건너뜀');}
  const batches=[{...good,evidenceFile:'../up.json'},{...good,evidenceFile:path.join(root,'up.json')},good,...(linked?[{...good,evidenceFile:'link/e.json'}]:[])];
  const report=await 수집.run({manifestPath:writeManifest(dir,batches),env:{},logDir});
  assert.deepEqual(report.results.map(row=>row.code),['EVIDENCE_PATH','EVIDENCE_PATH',null,...(linked?['EVIDENCE_PATH']:[])]);
});
test('봉투 해시가 증거 파일과 다르거나 캡처 시각이 없거나 계정이 다르면 보내지 않는다',async t=>{
  const {dir,logDir}=folder(t),good=telegramBatch(dir,'tg.json'),other=telegramBatch(dir,'tg2.json',22),{observedAt:_drop,...noTime}=other.envelope;
  const batches=[{...good,envelope:{...good.envelope,evidenceSha256:'a'.repeat(63)+'b'}},{...other,envelope:noTime},{...good,accountId:'lab-uz-telegram'}];
  const report=await 수집.run({manifestPath:writeManifest(dir,batches),env:{},logDir});
  assert.deepEqual(report.results.map(row=>row.code),['EVIDENCE_HASH','OBSERVED_AT','IDENTITY']);
});
test('--실행은 GET 한 번·묶음마다 POST 한 번·제 세션 로그아웃이고, 같은 증거를 다시 보내도 서버의 같은 기록으로 끝난다',async t=>{
  const {dir,logDir}=folder(t),manifestPath=writeManifest(dir,[telegramBatch(dir,'tg.json')]);
  const first=workspace(),report=await 수집.run({manifestPath,execute:true,env:{},logDir,connect:first.connect});
  assert.deepEqual(first.calls.map(call=>call.slice(0,2)),[['CONNECT','https://workspace.synk.im'],['GET','/api/state'],['POST',OBSERVE],['POST','/api/logout']]);
  assert.equal(first.calls[0][2],null);assert.equal(report.results[0].status,'created');assert.equal(report.loggedOut,true);assert.equal(report.countsAsApiCollection,false);
  const hash=report.results[0].evidenceSha256,saved=receipt(dir,hash);
  assert.deepEqual(Object.keys(saved).sort(),['accountId','attemptedAt','channelId','code','countsAsApiCollection','created','evidenceSha256','existing','firstRecordedAt','httpStatus','observedAt','rows','status','version']);
  assert.equal(saved.status,'created');assert.equal(saved.created,1);
  const again=workspace([CHANNEL],true),replay=await 수집.run({manifestPath,execute:true,env:{},logDir,connect:again.connect});
  assert.equal(again.calls.filter(call=>call[1]===OBSERVE).length,1,'영수증이 있어도 요청은 건너뛰지 않는다');
  assert.equal(replay.results[0].status,'existing');assert.equal(receipt(dir,hash).firstRecordedAt,saved.firstRecordedAt);
  assert.equal(fs.existsSync(path.join(dir,수집.LOCK_NAME)),false);
  assert.equal(fs.readFileSync(path.join(logDir,'수집기록.jsonl'),'utf8').trim().split('\n').length,2);
});
test('운영 채널이 없거나 둘이면 보내지 않고, 빌린 세션은 로그아웃하지 않으며, 잠금이 있으면 지우지 않고 멈춘다',async t=>{
  const {dir,logDir}=folder(t),manifestPath=writeManifest(dir,[telegramBatch(dir,'tg.json')]);
  const twin=workspace([CHANNEL,{...CHANNEL,id:'ch-telegram-2'}]);
  assert.equal((await 수집.run({manifestPath,execute:true,env:{},logDir,connect:twin.connect})).results[0].status,'channel-ambiguous');
  assert.deepEqual(twin.calls.filter(call=>call[0]==='POST').map(call=>call[1]),['/api/logout']);
  const none=workspace([{...CHANNEL,active:false}]);
  assert.equal((await 수집.run({manifestPath,execute:true,env:{},logDir,connect:none.connect})).results[0].status,'channel-missing');
  const borrowed=workspace();
  await 수집.run({manifestPath,execute:true,env:{SYNK_WORKSPACE_SESSION:'borrowed'},logDir,connect:borrowed.connect});
  assert.equal(borrowed.calls[0][2],'borrowed');assert.equal(borrowed.calls.some(call=>call[1]==='/api/logout'),false);
  fs.mkdirSync(path.join(dir,수집.LOCK_NAME));
  const locked=workspace();
  await assert.rejects(수집.run({manifestPath,execute:true,env:{},logDir,connect:locked.connect}),{code:'LOCKED'});
  assert.equal(locked.calls.length,0);assert.equal(fs.existsSync(path.join(dir,수집.LOCK_NAME)),true);
});
test('영수증은 성공만 적는다: 첫 성공 뒤 자격·네트워크·쓰기 권한·서버 거절 실패는 영수증을 덮지 않고 보고와 실행 기록에만 실패로 남는다',async t=>{
  const {dir,logDir}=folder(t),manifestPath=writeManifest(dir,[telegramBatch(dir,'tg.json')]);
  const first=await 수집.run({manifestPath,execute:true,env:{},logDir,connect:workspace().connect});
  const file=path.join(dir,'receipts',first.results[0].evidenceSha256+'.json'),saved=fs.readFileSync(file,'utf8');
  assert.equal(JSON.parse(saved).status,'created');
  const logout=route=>(route==='/api/logout'?{}:null);
  const attempts=[
    async()=>{throw Object.assign(new Error('자격 없음 secret-text'),{code:'NO_CREDENTIAL'});},
    async()=>({get:async()=>{throw new Error('ECONNRESET secret-text');},post:async()=>({})}),
    async()=>({get:async()=>({channels:[{...CHANNEL,canEdit:false}]}),post:async()=>({})}),
    async()=>({get:async()=>({channels:[CHANNEL]}),post:async route=>logout(route)||Promise.reject(Object.assign(new Error('forbidden secret-text'),{status:403,data:{code:'SYNK_EXTERNAL_FORBIDDEN',error:'secret-text'}}))}),
    async()=>({get:async()=>({channels:[CHANNEL]}),post:async route=>logout(route)||Promise.reject(new Error('socket hang up secret-text'))})];
  const outcomes=[];
  for(const connect of attempts){
    const row=(await 수집.run({manifestPath,execute:true,env:{},logDir,connect})).results[0];
    outcomes.push([row.status,row.code,row.receipt]);
    assert.equal(fs.readFileSync(file,'utf8'),saved,'앞선 성공 영수증은 바이트 그대로 남는다');
  }
  assert.deepEqual(outcomes,[['not-sent','NO_CREDENTIAL','kept-prior'],['not-sent','WORKSPACE','kept-prior'],['channel-not-writable','CHANNEL_NOT_WRITABLE','kept-prior'],
    ['rejected','SYNK_EXTERNAL_FORBIDDEN','kept-prior'],['unknown','NETWORK','kept-prior']]);
  const text=fs.readFileSync(path.join(logDir,'수집기록.jsonl'),'utf8');
  assert.deepEqual(text.trim().split('\n').map(line=>JSON.parse(line).results[0].status),['created','not-sent','not-sent','channel-not-writable','rejected','unknown']);
  assert.doesNotMatch(text+saved,/secret-text/);
});
test('같은 증거를 쓰는 잘못된 줄(뒤의 겹침·앞의 다른 계정·뒤의 다른 계정)은 같은 목록에서도 다음 회차에서도 성공 영수증을 덮지 않는다',async t=>{
  const cases={'duplicate-after':good=>[good,{...good}],'wrong-identity-before':good=>[{...good,accountId:'lab-uz-telegram'},good],'other-account-after':(good,foreign)=>[good,foreign]};
  for(const [name,arrange] of Object.entries(cases)){
    const {dir,logDir}=folder(t),good=telegramBatch(dir,'tg.json');
    const foreign={...good,accountId:'lab-uz-telegram',envelope:{...good.envelope,identity:{accountId:'lab-uz-telegram',handle:'synkmn'}}};
    const report=await 수집.run({manifestPath:writeManifest(dir,arrange(good,foreign)),execute:true,env:{},logDir,connect:workspace().connect});
    assert.deepEqual(report.results.map(row=>row.status),name==='wrong-identity-before'?['invalid','created']:['created','invalid'],name);
    const success=report.results.find(row=>row.status==='created'),other=report.results.find(row=>row.status==='invalid');
    assert.equal(other.evidenceSha256,success.evidenceSha256,name);
    const file=path.join(dir,'receipts',success.evidenceSha256+'.json'),saved=fs.readFileSync(file,'utf8'),parsed=JSON.parse(saved);
    assert.deepEqual([parsed.status,parsed.accountId,parsed.channelId,parsed.created],['created','lab-telegram','ch-telegram',1],name);
    assert.deepEqual([success.receipt,other.receipt],['written','kept-prior'],name);
    const later=await 수집.run({manifestPath:writeManifest(dir,[foreign]),execute:true,env:{},logDir,connect:workspace().connect});
    assert.deepEqual([later.results[0].status,later.results[0].receipt],['invalid','kept-prior'],name);
    assert.equal(fs.readFileSync(file,'utf8'),saved,name);
  }
});
// 11-14 GPT D 검수 재현: 봉투 증거 해시 필수(GD3) · 영수증 자리와 증거 분리(GD1·GD2) · 로그아웃 실패는 미완료(GD4) · 잠금 주인 파일 쓰기 실패(GD6).
test('봉투의 증거 해시는 필수다: 없거나 null·대문자·길이가 다르면 지금 파일 해시로 채우지 않고, 봉투를 만든 뒤 바뀐 증거는 거절한다',async t=>{
  const {dir,logDir}=folder(t),good=telegramBatch(dir,'tg.json'),{evidenceSha256:hash,...noHash}=good.envelope;
  const forms=[noHash,{...noHash,evidenceSha256:null},{...noHash,evidenceSha256:hash.toUpperCase()},{...noHash,evidenceSha256:hash.slice(1)}];
  const report=await 수집.run({manifestPath:writeManifest(dir,forms.map(envelope=>({...good,envelope}))),env:{},logDir});
  assert.deepEqual(report.results.map(row=>[row.status,row.code]),forms.map(()=>['invalid','EVIDENCE_HASH_MISSING']));
  fs.writeFileSync(path.join(dir,'tg.json'),fs.readFileSync(path.join(dir,'tg.json'),'utf8').replace('"views":7','"views":8'));
  const stale=(await 수집.run({manifestPath:writeManifest(dir,[good]),env:{},logDir})).results[0];
  assert.deepEqual([stale.status,stale.code],['invalid','EVIDENCE_HASH'],'봉투를 만든 뒤 새 캡처로 바뀐 증거를 옛 수치와 묶지 않는다');
});
test('영수증 자리와 증거를 나눈다: receipts 안의 증거는 받지 않고, 밖으로 연결된 receipts·모르는 파일·다른 채널의 영수증은 덮지 않는다',async t=>{
  const one=folder(t),base=telegramBatch(one.dir,'tg.json'),hash=base.envelope.evidenceSha256,own=path.join(one.dir,'receipts',hash+'.json'),text=fs.readFileSync(path.join(one.dir,'tg.json'),'utf8');
  fs.mkdirSync(path.dirname(own));fs.renameSync(path.join(one.dir,'tg.json'),own);
  const quiet=workspace(),inReceipts=(await 수집.run({manifestPath:writeManifest(one.dir,[{...base,evidenceFile:`receipts/${hash}.json`}]),execute:true,env:{},logDir:one.logDir,connect:quiet.connect})).results[0];
  assert.deepEqual([inReceipts.status,inReceipts.code,quiet.calls.length],['invalid','EVIDENCE_PATH',0]);
  assert.equal(fs.readFileSync(own,'utf8'),text,'제 해시 이름의 영수증 자리에 둔 증거 원본은 그대로다');
  const two=folder(t),batch=telegramBatch(two.dir,'tg.json'),target=path.join(two.dir,'receipts',batch.envelope.evidenceSha256+'.json'),manifestPath=writeManifest(two.dir,[batch]);
  fs.mkdirSync(path.dirname(target));fs.writeFileSync(target,'사람이 둔 메모');
  const unknown=await 수집.run({manifestPath,execute:true,env:{},logDir:two.logDir,connect:workspace().connect});
  assert.deepEqual([unknown.results[0].status,unknown.results[0].code,unknown.results[0].created,수집.exitCodeOf(unknown)],['receipt-conflict','RECEIPT_UNKNOWN_FILE',1,1]);
  assert.equal(fs.readFileSync(target,'utf8'),'사람이 둔 메모');
  fs.rmSync(target);
  assert.equal((await 수집.run({manifestPath,execute:true,env:{},logDir:two.logDir,connect:workspace().connect})).results[0].receipt,'written');
  const saved=fs.readFileSync(target,'utf8'),moved=(await 수집.run({manifestPath,execute:true,env:{},logDir:two.logDir,connect:workspace([{...CHANNEL,id:'ch-telegram-new'}]).connect})).results[0];
  assert.deepEqual([moved.status,moved.code],['receipt-conflict','RECEIPT_IDENTITY_CONFLICT']);
  assert.equal(fs.readFileSync(target,'utf8'),saved,'다른 채널의 성공이 앞 성공 영수증을 덮지 않는다');
  const three=folder(t),away=telegramBatch(three.dir,'tg.json'),outside=path.join(three.root,'outside'),foreign=path.join(outside,away.envelope.evidenceSha256+'.json');
  fs.mkdirSync(outside);fs.writeFileSync(foreign,'밖의 원본');
  try{fs.symlinkSync(outside,path.join(three.dir,'receipts'),'junction');}catch{t.diagnostic('연결 폴더를 만들 수 없어 밖으로 연결된 receipts 경우는 건너뜀');return;}
  const linked=(await 수집.run({manifestPath:writeManifest(three.dir,[away]),execute:true,env:{},logDir:three.logDir,connect:workspace().connect})).results[0];
  assert.deepEqual([linked.status,linked.code,linked.receipt],['receipt-failed','RECEIPTS_PATH','failed']);
  assert.equal(fs.readFileSync(foreign,'utf8'),'밖의 원본');assert.deepEqual(fs.readdirSync(outside),[path.basename(foreign)]);
});
test('직접 연 세션의 로그아웃이 실패하면 올린 성공 영수증은 남기고 실행 미완료(끝 코드 4)로 보고하며, 빌린 세션은 로그아웃하지 않는다',async t=>{
  const {dir,logDir}=folder(t),manifestPath=writeManifest(dir,[telegramBatch(dir,'tg.json')]),server=workspace();
  let logouts=0;
  const connect=async options=>{const ws=await server.connect(options);return {get:ws.get,post:async(route,body)=>{if(route!=='/api/logout')return ws.post(route,body);logouts++;throw new Error('logout 503 secret-text');}};};
  const report=await 수집.run({manifestPath,execute:true,env:{},logDir,connect}),row=report.results[0];
  assert.deepEqual([row.status,row.receipt,report.loggedOut,report.complete,수집.exitCodeOf(report)],['created','written',false,false,4]);
  assert.equal(receipt(dir,row.evidenceSha256).status,'created','올린 성공 영수증은 남는다');
  const line=JSON.parse(fs.readFileSync(path.join(logDir,'수집기록.jsonl'),'utf8').trim());
  assert.deepEqual([line.loggedOut,line.complete],[false,false]);assert.doesNotMatch(JSON.stringify(report)+JSON.stringify(line),/secret-text/);
  const borrowed=await 수집.run({manifestPath,execute:true,env:{SYNK_WORKSPACE_SESSION:'borrowed'},logDir,connect});
  assert.deepEqual([borrowed.loggedOut,borrowed.complete,수집.exitCodeOf(borrowed),logouts],[null,true,0,1]);
});
test('잠금 주인 파일(owner.json)을 처음 쓰다 디스크가 차면 이번에 만든 잠금 폴더만 치우고 원래 오류로 끝내 다음 회차를 막지 않는다',async t=>{
  const {dir,logDir}=folder(t),manifestPath=writeManifest(dir,[telegramBatch(dir,'tg.json')]),original=fs.writeFileSync,owner=path.join(수집.LOCK_NAME,'owner.json'),never=workspace();
  fs.writeFileSync=function(file,...rest){
    if(String(file).endsWith(owner)){original.call(fs,file,'{"pid":');throw Object.assign(new Error('ENOSPC: no space left on device, write'),{code:'ENOSPC'});}
    return original.call(fs,file,...rest);
  };
  try{await assert.rejects(수집.run({manifestPath,execute:true,env:{},logDir,connect:never.connect}),{code:'ENOSPC',message:/ENOSPC/});}finally{fs.writeFileSync=original;}
  assert.equal(fs.existsSync(path.join(dir,수집.LOCK_NAME)),false);assert.equal(never.calls.length,0);
  assert.equal((await 수집.run({manifestPath,execute:true,env:{},logDir,connect:workspace().connect})).results[0].status,'created');
});
test('앞 판(v1) 성공 영수증: 실제 14칸이고 같은 증거·계정·채널·관측이면 실패 회차엔 그대로 두고, 다시 성공하면 v1의 첫 성공 시각을 이어 v2로 옮긴다. 실패 기록·13칸·모르는 칸·맞지 않는 개수·뒤바뀐 시각·다른 계정은 덮지 않는다',async t=>{
  const {dir,logDir}=folder(t),batch=telegramBatch(dir,'tg.json'),hash=batch.envelope.evidenceSha256,file=path.join(dir,'receipts',hash+'.json'),manifestPath=writeManifest(dir,[batch]);
  // 앞 판 writeReceipt가 쓰던 꼴 그대로(14칸). 앞 판은 실패 줄도 적었고, 앞선 성공이 있으면 그 첫 성공 시각을 이어 적었다.
  const v1={version:1,evidenceSha256:hash,accountId:'lab-telegram',channelId:'ch-telegram',status:'created',httpStatus:201,code:null,created:1,existing:0,rows:1,
    observedAt:batch.envelope.observedAt,attemptedAt:'2026-11-13T00:00:00.000Z',firstRecordedAt:'2026-11-12T00:00:00.000Z',countsAsApiCollection:false};
  fs.mkdirSync(path.dirname(file));
  const {firstRecordedAt:_first,...thirteen}=v1;
  const again=async(body,connect=workspace([CHANNEL],true).connect)=>{fs.writeFileSync(file,JSON.stringify(body));return (await 수집.run({manifestPath,execute:true,env:{},logDir,connect})).results[0];};
  const cases=[[{...v1,accountId:'lab-uz-telegram'},'RECEIPT_IDENTITY_CONFLICT'],[{...v1,channelId:'ch-other'},'RECEIPT_IDENTITY_CONFLICT'],[{...v1,observedAt:'2026-11-11T00:00:00.000Z'},'RECEIPT_IDENTITY_CONFLICT'],
    [{...v1,status:'rejected',httpStatus:403,code:'SYNK_EXTERNAL_FORBIDDEN',created:null,existing:null},'RECEIPT_UNKNOWN_FILE'],
    [{...v1,status:'not-sent',httpStatus:null,code:'NO_CREDENTIAL',created:null,existing:null,channelId:null,firstRecordedAt:null},'RECEIPT_UNKNOWN_FILE'],
    [thirteen,'RECEIPT_UNKNOWN_FILE'],[{...v1,note:'x'},'RECEIPT_UNKNOWN_FILE'],[{...v1,created:2},'RECEIPT_UNKNOWN_FILE'],[{...v1,version:3},'RECEIPT_UNKNOWN_FILE'],
    [{...v1,firstRecordedAt:null},'RECEIPT_UNKNOWN_FILE'],[{...v1,firstRecordedAt:'2026-11-14T00:00:00.000Z'},'RECEIPT_UNKNOWN_FILE']];
  for(const [body,expected] of cases){
    const row=await again(body);
    assert.deepEqual([row.status,row.code],['receipt-conflict',expected],JSON.stringify(body));
    assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),body,'덮지 않는다');
  }
  const failed=await again(v1,async()=>{throw Object.assign(new Error('자격 없음'),{code:'NO_CREDENTIAL'});});
  assert.deepEqual([failed.status,failed.receipt],['not-sent','kept-prior']);assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),v1);
  // 첫 성공 시각은 마지막 확인 시각과 같거나 앞선다. 어느 쪽이든 v1의 firstRecordedAt을 그대로 이어 v2로 옮긴다.
  for(const first of [v1.attemptedAt,v1.firstRecordedAt]){
    const moved=await again({...v1,firstRecordedAt:first});
    assert.deepEqual([moved.status,moved.receipt],['existing','written'],first);
    const saved=receipt(dir,hash);
    assert.deepEqual([saved.version,saved.firstRecordedAt,saved.status,saved.accountId,saved.channelId,saved.existing],[2,first,'existing','lab-telegram','ch-telegram',1],first);
  }
});
