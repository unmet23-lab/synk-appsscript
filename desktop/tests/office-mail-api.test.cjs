'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {searchMailbox,validatePlan,needsMailDecision,checkDecision,explicitPlan,combinePlan,sourceUrl}=require('../src/office-mail-api.cjs');
const empty={terms:[],from:'',after:'',before:'',folder:'all',provider:'all',inherit:false};
const profile={address:'office@example.test'};
const respond=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
const sunday=new Date(2026,10,22);
const span=(role,quote,nth=1)=>({role,quote,nth});
function answer(mailRef,overrides={}){
  return {scope:'mailbox',mailRef,otherRef:'',period:'',evidence:[],unmet:[],terms:[],from:'',after:'',before:'',
    folder:'',provider:'',inherit:false,clear:[],mergeTerms:'replace',attachment:'',...overrides};
}
test('메일 후보와 이전 대화의 종류는 업무 원문에서 고른다',()=>{
  for(const prompt of ['‘받은편지함’에서 지난주 견적 찾아줘','메일에 쓸 인사말 작성해줘','Show my sent items'])
    assert.equal(needsMailDecision(prompt),true,prompt);
  assert.equal(needsMailDecision('그중 계약서만','mail'),true);
  assert.equal(needsMailDecision('제품 소개를 써줘','ordinary'),false);
});
test('검색 계획의 날짜·필드와 공급자 검색 구문을 검사한다',()=>{
  assert.equal(validatePlan({...empty,terms:['견적'],after:'2026-02-01'}).after,'2026-02-01');
  for (const extra of [{after:'2026-02-30'},{terms:['in:anywhere']},{terms:['견적'],provider:'other'},{before:'2026-02-01',after:'2026-02-01'},{from:'bob" OR *'},{terms:['견적'],url:'https://example.test'}]) {
    assert.throws(()=>validatePlan({...empty,...extra}),{code:'MAIL_PLAN'});
  }
});
test('주간 기호는 요청한 시점의 현지 달력으로 계산하고 다른 날짜를 낸 응답은 실행 전에 돌려준다',()=>{
  const prompt='지난주 받은편지함에서 견적 메일 찾아줘';
  const packet=answer('견적 메일 찾아줘',{terms:['견적'],folder:'inbox',period:'last_week',
    evidence:[span('delivered','지난주'),span('folder','받은편지함')]});
  for(const [at,expected] of [[new Date(2026,10,22,23,59),['2026-11-09','2026-11-16']],
    [new Date(2026,10,23,0,1),['2026-11-16','2026-11-23']],[new Date(2026,0,1),['2025-12-22','2025-12-29']]]){
    const decided=checkDecision(packet,prompt,null,at);assert.equal(decided.kind,'mailbox');
    for(const plan of [decided.plan,explicitPlan(packet,prompt,at)])assert.deepEqual([plan.after,plan.before],expected);
  }
  const wrong={...packet,after:'2026-11-16',before:'2026-11-23'};
  assert.equal(checkDecision(wrong,prompt,null,sunday).kind,'review');
  assert.throws(()=>explicitPlan(wrong,prompt,sunday),{code:'MAIL_REVIEW'});
  assert.equal(checkDecision({...packet,period:''},prompt,null,sunday).kind,'review');
});
test('수신 시점과 메일의 주제를 각각 인용해 관련 없는 날짜와 날짜가 없는 검색을 보존한다',()=>{
  const cases=[
    ['지난주 받은편지함에서 이번 달 예산 관련 메일 찾아줘','메일','지난주','이번 달 예산','예산','last_week','받은편지함'],
    ['지난주에 제가 받은 이번 달 예산 관련 메일 찾아줘','메일','지난주에 제가 받은','이번 달 예산','예산','last_week'],
    ['지난주에 발송된 청구서에 관한 문의 메일 찾아줘','메일','','지난주에 발송된 청구서','청구서',''],
    ['지난주의 정기회의 회의록 관련 메일 찾아줘','메일','','지난주의 정기회의 회의록','회의록',''],
    ['Find emails from last week about the late payment','emails','from last week','the late payment','late payment','last_week'],
    ['Find emails between Kim and me from last week','emails','from last week','','','last_week'],
    ['Find emails from last week about the Tuesday meeting','emails','from last week','the Tuesday meeting','meeting','last_week'],
    ['Find emails from this month about the notice, sent last week to tenants','emails','this month','notice, sent last week to tenants','notice','this_month'],
    ["Find emails about last week's outage that came in this week",'emails','came in this week',"last week's outage",'outage','this_week'],
    ['Check my inbox for emails from last week','emails','from last week','','','last_week','my inbox'],
    ['Find emails in my inbox recapping the conference held last week','emails','','conference held last week','conference','','my inbox'],
  ];
  const windows={'':['',''],last_week:['2026-11-09','2026-11-16'],this_week:['2026-11-16','2026-11-23'],this_month:['2026-11-01','2026-12-01']};
  for(const [prompt,ref,delivery,topic,term,period,folder] of cases){
    const evidence=[];
    if(delivery)evidence.push(span('delivered',delivery));
    if(topic)evidence.push(span('about',topic));
    if(folder)evidence.push(span('folder',folder));
    const packet=answer(ref,{period,evidence,terms:term?[term]:[],folder:folder?'inbox':''});
    if(term)assert.equal(checkDecision({...packet,terms:[]},prompt,null,sunday).kind,'review');
    const decided=checkDecision(packet,prompt,null,sunday);assert.equal(decided.kind,'mailbox',prompt);
    for(const plan of [decided.plan,explicitPlan(packet,prompt,sunday)])assert.deepEqual([plan.after,plan.before],windows[period],prompt);
  }
  const may='Find quote emails received in may from Alice';
  const sender=answer('emails',{terms:['quote'],from:'Alice',evidence:[span('sender','from Alice')]});
  assert.equal(checkDecision(sender,may,null,sunday).kind,'review');
  const dated={...sender,period:'absolute',after:'2026-05-01',before:'2026-06-01',evidence:[...sender.evidence,span('delivered','in may')]};
  assert.equal(checkDecision(dated,may,null,sunday).kind,'mailbox');
});
test('영문의 may는 실제 날짜 위치에서만 5월로 쓰며 앞에서 끝난 수신 기간을 바꾸지 않는다',()=>{
  for(const [prompt,citation,after,before,expected] of [
    ['The quote emails I received between November 19 and 20 may explain the fee. Find them.','between November 19 and 20','2026-11-19','2026-11-21','mailbox'],
    ['The quote emails may still contain the fee. Find them.','may','2026-05-01','2026-06-01','review'],
    ['Find quote emails received in may from Alice.','in may','2026-05-01','2026-06-01','mailbox'],
    ['Find quote emails received on 20 may about the fee.','on 20 may','2026-05-20','2026-05-21','mailbox'],
    ['Find quote emails received between March 19 and 20 may about the fee.','between March 19 and 20 may','2026-03-19','2026-05-21','mailbox'],
    ['Find quote emails received between March 19 and 20 may concerning the fee.','between March 19 and 20 may','2026-03-19','2026-05-21','mailbox'],
    ['Find quote emails received between March 19 and 20 may concerning the fee.','between March 19 and 20','2026-03-19','2026-03-21','review'],
    ['The quote emails I received for order 20 may contain the fee. Find them.','20 may','2026-05-20','2026-05-21','review']
  ]){
    const packet=answer('emails',{terms:['quote'],period:'absolute',after,before,evidence:[span('delivered',citation)]});
    assert.equal(checkDecision(packet,prompt,null,sunday).kind,expected,prompt);
    if(expected==='mailbox')assert.equal(explicitPlan(packet,prompt,sunday).before,before);
    else assert.throws(()=>explicitPlan(packet,prompt,sunday),{code:'MAIL_REVIEW'});
  }
  const numbered='The quote emails I received for order 20 may contain the fee. Find them.';
  const topicOnly=answer('emails',{terms:['quote','order 20'],evidence:[span('about','order 20')]});
  assert.equal(checkDecision(topicOnly,numbered,null,sunday).kind,'mailbox');
  assert.equal(explicitPlan(topicOnly,numbered,sunday).after,'');
});
test('명시한 날짜의 두 경계는 인용의 숫자와 맞아야 하며 제목의 지난주는 기간을 바꾸지 않는다',()=>{
  for(const [prompt,delivery,topic,term,after,before] of [
    ['Find emails from November 16 to November 22 about the meeting held last week','November 16 to November 22','meeting held last week','meeting','2026-11-16','2026-11-23'],
    ['Search my inbox for emails from the 16th to the 22nd about last week','from the 16th to the 22nd','about last week','last week','2026-11-16','2026-11-23'],
    ["Find emails from November with a copy of last week's notice",'from November',"last week's notice",'notice','2026-11-01','2026-12-01'],
    ['2026-11-09부터 2026-11-15까지 받은 메일 찾아줘','2026-11-09부터 2026-11-15까지','','','2026-11-09','2026-11-16']
  ]){
    const en=prompt.includes('emails'),box=prompt.includes('inbox');
    const packet=answer(en?'emails':'메일',{period:'absolute',after,before,terms:term?[term]:[],folder:box?'inbox':'',
      evidence:[span('delivered',delivery),...(topic?[span('about',topic)]:[]),...(box?[span('folder','my inbox')]:[])]});
    const decided=checkDecision(packet,prompt,null,sunday);assert.equal(decided.kind,'mailbox',prompt);
    assert.deepEqual([decided.plan.after,decided.plan.before],[after,before]);
    assert.equal(checkDecision({...packet,after:'2025-01-07',before:'2025-01-09'},prompt,null,sunday).kind,'review',prompt);
  }
});
test('하루를 지정한 요청은 한쪽 경계를 빼서 넓히지 않고 명시한 단방향만 처리한다',()=>{
  for(const [phrase,after,before,kind] of [
    ['on November 19, 2026','2026-11-19','2026-11-20','mailbox'],
    ['on November 19, 2026','2026-11-19','','review'],
    ['on November 19, 2026','','2026-11-20','review'],
    ['since November 19, 2026','2026-11-19','','mailbox'],
    ['until November 19, 2026','','2026-11-20','mailbox']
  ]){
    const prompt='Find emails received '+phrase;
    const packet=answer('emails',{after,before,period:'absolute',evidence:[span('delivered',phrase)]});
    assert.equal(checkDecision(packet,prompt,null,sunday).kind,kind,phrase);
  }
});
test('주가 없는 요일을 확인하고 시작점만 말한 주간은 그다음 주까지 열어 둔다',()=>{
  const cases=[
    ['on Tuesday','absolute','2026-11-10','2026-11-11','review'],
    ['on Tuesday','absolute','2026-11-17','2026-11-18','review'],
    ['since Monday','absolute','2026-11-16','','mailbox'],
    ['since Monday','absolute','2026-11-09','','review'],
    ['starting last week','last_week','','','review'],
    ['starting last week','absolute','2026-11-09','','mailbox'],
    ['from last week','last_week','','','mailbox']
  ];
  for(const [phrase,period,after,before,kind] of cases){
    const prompt='Find emails '+phrase,packet=answer('emails',{period,after,before,evidence:[span('delivered',phrase)]});
    assert.equal(checkDecision(packet,prompt,null,sunday).kind,kind,phrase);
  }
});
test('날짜 인용마다 순서와 포함 여부를 대조하고 다른 달의 일자나 넓은 경계는 확인을 요청한다',()=>{
  const cases=[
    ['after November 19, 2026','2026-11-20','','2026-11-19',''],
    ['before November 19, 2026','','2026-11-19','','2026-11-20'],
    ['sent to Kim on November 19, 2026','2026-11-19','2026-11-20','','2026-11-20'],
    ['11월 1일부터 12월 5일까지','2026-11-01','2026-12-06','2026-11-05','2026-12-02'],
    ['from 2026-11-19 to November 21, 2026','2026-11-19','2026-11-22','2026-11-19','2026-11-21'],
    ['지난주부터 오늘까지','2026-11-09','2026-11-23','2026-11-09','2026-11-16'],
    ['지난주 화요일','2026-11-10','2026-11-11','2026-11-17','2026-11-18'],
    ['November','2026-11-01','2026-12-01','2025-11-01','2026-12-01'],
  ];
  for(const [phrase,after,before,wrongAfter,wrongBefore] of cases){
    const prompt='Find emails '+phrase;
    const plan=answer('emails',{after,before,period:'absolute',evidence:[span('delivered',phrase)]});
    assert.equal(checkDecision(plan,prompt,null,sunday).kind,'mailbox',phrase);
    for(const rejected of [{...plan,after:wrongAfter,before:wrongBefore},answer('emails')]){
      assert.equal(checkDecision(rejected,prompt,null,sunday).kind,'review',phrase);
      assert.throws(()=>explicitPlan(rejected,prompt,sunday),{code:'MAIL_REVIEW'});
    }
  }
});
test('원문 날짜의 연산자는 인용을 나눠도 같고 모호한 경계는 범위를 넓히지 않는다',()=>{
  const cases=[
    ['before November 19,2025',['November 19,2025'],'','2025-11-19','mailbox'],
    ['before November 19,2025',['November 19,2025'],'','2026-11-19','review'],
    ['on or after November 19, 2026',['after November 19, 2026'],'2026-11-19','','mailbox'],
    ['on or before November 19, 2026',['before November 19, 2026'],'','2026-11-20','mailbox'],
    ['after November 17, 2026 and before November 20, 2026',['November 17, 2026','November 20, 2026'],'2026-11-18','2026-11-20','mailbox'],
    ['before November 19 and after November 21',['before November 19 and after November 21'],'2026-11-19','2026-11-22','review'],
    ['in early November',['November'],'2026-11-01','2026-12-01','review'],
    ['지난주 화요일까지',['지난주 화요일까지'],'','2026-11-11','mailbox'],
    ['지난주화요일부터',['지난주화요일부터'],'2026-11-10','','mailbox'],
    ['지난주화요일부터',['지난주화요일부터'],'2026-11-17','','review'],
    ['지난주 화요일 수요일',['지난주 화요일 수요일'],'2026-11-11','2026-11-12','review'],
    ['at the end of November',['November'],'2026-11-01','2026-12-01','review'],
    ['지난주 화요일부터 오늘까지',['지난주 화요일부터 오늘까지'],'2026-11-10','2026-11-23','mailbox'],
    ['11월 1일 이후 12월 5일 이전',['11월 1일 이후 12월 5일 이전'],'2026-11-01','2026-12-06','mailbox'],
    ['on February 29',['February 29'],'2024-02-29','2024-03-01','mailbox'],
    ['February 28–29',['February 28–29'],'2024-02-28','2024-03-01','mailbox'],
    ['February 28–29',['February 28–29'],'2026-02-28','2028-03-01','review'],
    ['before November 20, but not after November 17',['before November 20','not after November 17'],'','2026-11-18','mailbox'],
    ['before November 20, but not after November 17',['before November 20','not after November 17'],'','2026-11-20','review'],
    ['from November 17 to 20 Dec. 2025',['from November 17 to 20 Dec. 2025'],'2025-11-17','2025-12-21','mailbox'],
    ['11월 20일 이전 것은 빼고 받은 견적 메일',['11월 20일 이전'],'','2026-11-21','review'],
    ['11월 20일께 견적 메일',['11월 20일'],'2026-11-20','2026-11-21','review'],
    ['from November 17 to 20 December 2026',['from November 17 to 20 December 2026'],'2026-11-17','2026-12-21','mailbox'],
    ['I may have received on November 20, 2026',['may have received on November 20, 2026'],'2026-11-20','2026-11-21','mailbox'],
    ['November 19–21, 2025',['November 19–21, 2025'],'2025-11-19','2025-11-22','mailbox'],
    ['November 19–21, 2025',['November 19–21, 2025'],'2026-11-19','2026-11-20','review'],
    ['4월 1일부터 31일까지',['4월 1일부터 31일까지'],'2026-04-01','2026-06-01','review'],
    ['11월 1일 이후 11월 20일에만',['11월 1일 이후 11월 20일에만'],'2026-11-01','2026-11-21','review'],
    ['11월 1일 말레이시아 팀에서',['11월 1일'],'2026-11-01','2026-11-02','mailbox'],
    ['after November 17, 2026 but before November 20, 2026',['after November 17, 2026 but before November 20, 2026'],'2026-11-18','2026-11-20','mailbox'],
    ['after November 17, 2026, with "November 18" in the subject, and received before November 20, 2026',['after November 17, 2026','before November 20, 2026'],'2026-11-18','2026-11-20','mailbox'],
    ['November 1 to 5',['November 1'],'2026-11-01','2026-11-02','review']
  ];
  for(const [phrase,quotes,after,before,kind] of cases){
    const prompt='Find emails '+phrase;
    const subject=phrase.includes('in the subject'),evidence=quotes.map(q=>span('delivered',q));
    if(subject)evidence.push(span('about','"November 18"'));
    const packet=answer('emails',{period:'absolute',after,before,terms:subject?['November 18']:[],evidence});
    const decision=checkDecision(packet,prompt,null,sunday);
    if(subject){
      assert.equal(decision.review?.reason,'unsupported',phrase);
      assert.deepEqual([decision.review.filter.after,decision.review.filter.before],[after,before]);
      assert.deepEqual(decision.review.filter.terms,['November 18']);
      assert.ok(decision.review.unmet.some(q=>q.includes('in the subject')));
      assert.equal(checkDecision({...packet,terms:[]},prompt,null,sunday).kind,'review');
    }else assert.equal(decision.kind,kind,phrase);
  }
  assert.equal(checkDecision(answer('메일'),'이번 주문 확인 메일 찾아줘').kind,'mailbox');
  for(const phrase of ['지난 주말','지난주말','지난주엔','이번달엔'])
    assert.equal(checkDecision(answer('메일'),phrase+' 받은 메일 찾아줘',null,sunday).kind,'review');
});
test('계정·편지함 이름이 주제나 상호에 쓰여도 실제 조회 범위는 회원이 지정한 곳으로 한정한다',()=>{
  const inboxes='받은편지함과 보낸편지함 모두에서 견적 메일 찾아줘';
  const packet=answer('메일',{folder:'inbox_sent',evidence:[span('folder','받은편지함과 보낸편지함 모두')]});
  assert.equal(checkDecision(packet,inboxes).kind,'mailbox');
  assert.equal(checkDecision({...packet,folder:'all'},inboxes).kind,'review');
  const source='Gmail에서 Outlook 전환 안내 메일 찾아줘';
  const gmail=answer('메일',{provider:'gmail',terms:['Outlook 전환 안내'],evidence:[span('provider','Gmail'),span('about','Outlook 전환 안내')]});
  assert.equal(checkDecision(gmail,source).kind,'mailbox');
  for(const provider of ['all','outlook',''])assert.equal(checkDecision({...gmail,provider},source).kind,'review');
  const both={...gmail,provider:'all',terms:[],evidence:[span('provider','Gmail'),span('provider','Outlook')]};
  assert.equal(checkDecision(both,source).kind,'review');
  assert.equal(checkDecision(both,'Gmail과 Outlook에서 메일 찾아줘').kind,'mailbox');
  const web=answer('메일',{evidence:[span('provider','웹')]});
  assert.equal(checkDecision(web,'웹에서 견적 메일 찾아줘').kind,'choose');
  assert.throws(()=>explicitPlan(web,'웹에서 견적 메일 찾아줘'),{code:'MAIL_REVIEW'});
  for(const sender of ['오늘의집','네이버웹툰']){
    const mail=answer('메일',{from:sender,evidence:[span('sender',sender)]});
    assert.equal(checkDecision(mail,sender+'에서 보낸 정산 메일 찾아줘').kind,'mailbox');
  }
});
test('요청에서 따로 인용한 두 편지함과 제목 밖 미지원 조건을 각각 확인한다',()=>{
  const text='‘보낸편지함’과 ‘받은편지함’에서 견적 메일 찾아줘';
  const both=answer('메일',{folder:'inbox_sent',evidence:[span('folder','보낸편지함'),span('folder','받은편지함')]});
  assert.equal(checkDecision(both,text).kind,'mailbox');
  assert.equal(checkDecision({...both,folder:'inbox',evidence:[span('folder','받은편지함')]},text).kind,'review');
  const partial={...both,folder:'inbox',evidence:[span('about','보낸편지함'),span('folder','받은편지함')]};
  assert.equal(checkDecision(partial,text).kind,'review');
  assert.throws(()=>explicitPlan(partial,text),{code:'MAIL_REVIEW'});
  assert.equal(checkDecision({...both,folder:'inbox',evidence:[span('exclude','보낸편지함'),span('folder','받은편지함')]},text).kind,'review');
  const unread='Find unread emails about the Unanswered Questions survey';
  const task=answer('emails',{evidence:[span('about','Unanswered Questions survey')]});
  assert.equal(checkDecision(task,unread).review.reason,'unsupported');
  const fakeSender=answer('emails',{from:'unread emails',terms:['survey'],evidence:[span('sender','unread emails'),span('about','Unanswered Questions survey')]});
  assert.equal(checkDecision(fakeSender,unread).review.reason,'unsupported');
  const search=answer('emails',{from:'Starred Consulting',evidence:[span('sender','Starred Consulting')]});
  assert.equal(checkDecision(search,'Find emails from Starred Consulting about the quote').kind,'mailbox');
});
test('Gmail은 인증된 사서함의 날짜 경계를 초로 보내고 같은 메일의 머리말과 발췌만 읽는다',async()=>{
  const seen=[];
  const received=new Date(2026,10,10,12).valueOf();
  const fetch=async (url,options)=>{
    seen.push(String(url));assert.equal(options.headers.Authorization,'Bearer fixture-token');
    assert.equal(options.redirect,'error');
    if(seen.length===1)return respond({messages:[{id:'18abc'}]});
    if(new URL(url).searchParams.get('format')==='metadata')return respond({id:'18abc',payload:{headers:[{name:'Subject',value:'겨울 견적'},{name:'From',value:'거래처 <sales@example.test>'}]}});
    assert.equal(new URL(url).searchParams.get('fields'),'id,internalDate,snippet');
    return respond({id:'18abc',internalDate:String(received),snippet:'<b>예시</b>'});
  };
  const result=await searchMailbox({provider:'gmail',...profile,access:'fixture-token',plan:validatePlan({...empty,terms:['견적'],after:'2026-11-09',before:'2026-11-16'}),fetch});
  const q=new URL(seen[0]).searchParams.get('q');
  assert.match(q,/after:\d{10}/);assert.match(q,/before:\d{10}/);
  assert.equal(new URL(seen[1]).searchParams.get('format'),'metadata');
  assert.equal(result.items[0].subject,'겨울 견적');assert.equal(result.more,false);
  assert.equal(new URL(sourceUrl('gmail',profile.address,result.items[0])).hostname,'mail.google.com');
});
test('Outlook 검색 결과에서 사서함 원문만 연다',async()=>{
  let api;
  const fetch=async url=>{api=new URL(url);return respond({value:[{id:'one',subject:'견적',receivedDateTime:'2026-11-10T04:30:00Z',bodyPreview:'예시 문장',from:{emailAddress:{address:'sales@example.test'}},webLink:'https://outlook.office.com/owa/?ItemID=one'}]});};
  const result=await searchMailbox({provider:'outlook',...profile,access:'sample',plan:validatePlan({...empty,terms:['견적'],folder:'inbox'}),fetch});
  assert.equal(api.origin,'https://graph.microsoft.com');assert.match(api.pathname,/inbox\/messages$/);assert.ok(api.searchParams.get('$search'));assert.equal(result.items[0].snippet,'예시 문장');
  assert.equal(new URL(sourceUrl('outlook',profile.address,result.items[0])).hostname,'outlook.office.com');
  assert.equal(sourceUrl('outlook',profile.address,{...result.items[0],webLink:'https://example.test/'}),null);
});
test('제공자 오류와 실제 0건을 구분한다',async()=>{
  const options={provider:'outlook',...profile,access:'sample',plan:validatePlan({...empty,terms:['견적']})};
  const zero=await searchMailbox({...options,fetch:async()=>respond({value:[]})});
  assert.deepEqual(zero.items,[]);assert.equal(zero.more,false);
  await assert.rejects(searchMailbox({...options,fetch:async()=>new Response('{}',{status:429})}),{code:'MAIL_LIMIT'});
});
test('검색한 일부만 표시하면 전체 건수나 전체 사서함의 0건으로 보고하지 않는다',()=>{
  const {summary}=require('../src/office-mail.cjs');
  assert.match(summary({groups:[{items:[{}],more:true}]}),/1건을 화면에 표시/);
  assert.match(summary({groups:[{items:[],code:'MAIL_NETWORK'}]}),/확인하지 못한 부분/);
  assert.equal(summary({groups:[{items:[],more:false}]}),'조건에 맞는 메일이 없습니다.');
});
test('첨부파일 있음과 아직 지원하지 않는 필터는 회원이 확인하기 전에 조용히 바꾸지 않는다',()=>{
  const p='첨부파일이 있는 견적 메일만 찾아줘';
  const packet=answer('메일만 찾아줘',{terms:['견적'],attachment:'has',evidence:[span('attachment','첨부파일이 있는')]});
  assert.equal(explicitPlan(packet,p).attachment,'has');
  assert.equal(checkDecision({...packet,attachment:''},p).kind,'review');
  for(const prompt of ['첨부파일이 없는 메일만 찾아줘','안 읽은 메일만 찾아줘','PDF 첨부파일 내용을 읽어줘']){
    const mixed=answer(prompt.includes('메일')?'메일':'',{unmet:[prompt]});
    const result=checkDecision(mixed,prompt);assert.equal(result.kind,'review');
    assert.deepEqual(result.review.unmet,prompt.startsWith('안 읽은')?[prompt,'안 읽은']:[prompt]);
    assert.throws(()=>explicitPlan(mixed,prompt),{code:'MAIL_REVIEW'});
  }
  const old=combinePlan({...empty,attachment:'has'});
  assert.equal(combinePlan({...empty,inherit:true,folder:''},old).attachment,'has');
  assert.equal(combinePlan({...empty,inherit:true,clear:['attachment']},old).attachment,'');
});
test('Gmail·Outlook은 첨부 존재를 검색에 적용하고 Outlook에서 반환한 불일치를 부분 범위로 알린다',async()=>{
  const urls=[],fetch=async raw=>{const u=new URL(raw);urls.push(u);return respond(u.hostname==='gmail.googleapis.com'?{}:{value:[
    {id:'yes',hasAttachments:true,subject:'첨부 있음',receivedDateTime:'2026-11-12T00:00:00Z'},
    {id:'no',hasAttachments:false,receivedDateTime:'2026-11-12T00:00:00Z'}]});};
  const plan=combinePlan({...empty,folder:'inbox',terms:['견적'],attachment:'has'});
  await searchMailbox({provider:'gmail',access:'x',plan,fetch});
  const r=await searchMailbox({provider:'outlook',access:'x',plan,fetch});
  assert.match(urls[0].searchParams.get('q'),/has:attachment/);
  assert.match(urls[1].searchParams.get('$search'),/hasAttachments:true/);assert.match(urls[1].searchParams.get('$select'),/hasAttachments/);
  assert.deepEqual(r.items.map(v=>v.subject),['첨부 있음']);assert.ok(r.code);
  await searchMailbox({provider:'outlook',access:'x',plan:{...plan,terms:[]},fetch});
  assert.match(urls[2].searchParams.get('$filter'),/^receivedDateTime ge [^ ]+ and hasAttachments eq true$/);
  assert.equal(urls[2].searchParams.get('$orderby'),'receivedDateTime desc');
  await searchMailbox({provider:'outlook',access:'x',plan:{...plan,terms:[],after:'2026-11-01'},fetch});
  assert.match(urls[3].searchParams.get('$filter'),/^receivedDateTime ge [^ ]+ and hasAttachments eq true$/);
  assert.equal(urls[3].searchParams.get('$orderby'),'receivedDateTime desc');
  assert.ok(urls.every(u=>!u.pathname.includes('/attachments')&&!u.searchParams.has('$expand')));
});
