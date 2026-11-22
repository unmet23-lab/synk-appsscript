'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {scanQuotes,confirmQuote} = require('../src/office-quote-providers.cjs');
const {quoteMailbox,customer,other} = require('./fixtures/office-quote-mail.cjs');

for(const provider of ['gmail','outlook']){
  const name=provider==='gmail'?'Gmail':'Outlook';
  test(name+'의 모든 페이지에서 고객에게 아직 답하지 않은 견적 요청을 고른다',async()=>{
    const {add,context,requests}=quoteMailbox(provider);
    add('a1','업무 안내','다음 주에 만납니다.',{unread:true});
    add('a2','겨울 교재 견적','교재 80부 견적을 부탁드립니다.',{unread:true});
    add('a2','Re: 겨울 교재 견적','요청하신 견적입니다.',{folder:'sentitems'});
    add('a3','봄 학기 견적','교재 30부 견적을 부탁드립니다.');
    add('a3','Re: 봄 학기 견적','확인 후 답변드리겠습니다.',{folder:'drafts'});
    add('a4','지난 회의','견적 문의 없이 일정을 확정했습니다.');
    const intended=add('a5','인쇄물 견적 문의','책자 37부 제작 비용을 알려 주세요.',{unread:false});
    add('a5','Re: 인쇄물 견적 문의','내부에서 사양을 검토해 주세요.',{folder:'sentitems',to:other});

    const result=await scanQuotes(context);
    assert.equal(result.checked,5);
    assert.equal(result.drafts,1);
    assert.equal(result.eligibleCount,1);
    assert.equal(result.more,false);
    assert.equal(result.code,undefined);
    const [item]=result.items;
    assert.equal(item.threadId,intended.thread);
    assert.equal(item.messageId,intended.id);
    assert.equal(item.sourceId,intended.id);
    assert.equal(item.subject,intended.subject);
    assert.ok(item.from.includes(customer));
    assert.equal(item.evidence,intended.body);
    const continuation=provider==='gmail'?'pageToken':'$skiptoken';
    assert.ok(requests.some(r=>r.query.has(continuation)));
    const again=await scanQuotes({...context,known:new Set([item.id])});
    assert.deepEqual(again.items.map(i=>i.id),[item.id]);
  });

  test(name+'에서 견적 담당이 원문을 다시 읽을 때 최근 답장과 새 질문, 작성 중인 초안을 구별한다',async()=>{
    const {add,context}=quoteMailbox(provider);
    const first=add('a1','안내책자 견적','책자 37부 인쇄 견적을 부탁드립니다.');
    const [source]=(await scanQuotes(context)).items;
    assert.equal((await confirmQuote(context,source)).item.id,source.id);
    add(first.thread,'Re: 안내책자 견적','요청하신 견적입니다.',{folder:'sentitems'});
    assert.equal((await confirmQuote(context,source)).state,'closed');
    const updated=add(first.thread,'Re: 안내책자 견적','73부로 수량을 바꾸면 납기가 어떻게 되나요?');
    const confirmation=await confirmQuote(context,source);
    assert.equal(confirmation.state,'open');
    assert.notEqual(confirmation.item.id,source.id);
    assert.equal(confirmation.item.messageId,updated.id);
    assert.ok(confirmation.item.evidence.endsWith(updated.body));
    assert.ok(confirmation.item.evidence.includes('책자'));
    assert.ok(confirmation.item.evidence.includes('최근 요청: '+updated.body));
    assert.deepEqual((await scanQuotes(context)).items.map(item=>item.id),[confirmation.item.id]);
    add(first.thread,'Re: 안내책자 견적','납기 확인 후 답드리겠습니다.',{folder:'drafts'});
    assert.equal((await confirmQuote(context,confirmation.item)).state,'draft');
  });

  test(name+'의 다음 페이지를 못 읽으면 확인한 후보와 부분 조회 사유를 보존한다',async()=>{
    const mailbox=quoteMailbox(provider);
    mailbox.add('a1','안내책자 견적','책자 37부 인쇄 견적을 부탁드립니다.');
    mailbox.add('a2','정기 회의','다음 회의 일정을 공유합니다.');
    const later=mailbox.add('a3','추가 발주 견적','다른 규격의 제작 비용을 알려 주세요.');
    mailbox.blockNextPage();
    const result=await scanQuotes(mailbox.context);
    assert.equal(result.checked,2);
    assert.equal(result.items.length,1);
    assert.equal(result.more,true);
    assert.equal(result.code,'MAIL_LIMIT');
    assert.ok(result.cursor);
    mailbox.blockNextPage(false);
    const firstResumeRequest=mailbox.requests.length;
    const resumed=await scanQuotes({...mailbox.context,start:result.cursor});
    assert.equal(resumed.resumed,true);assert.equal(resumed.more,false);
    assert.deepEqual(resumed.items.map(item=>item.messageId),[later.id]);
    const resumeQuery=mailbox.requests[firstResumeRequest].query;
    assert.ok(resumeQuery.has(provider==='gmail'?'pageToken':'$skiptoken'));
    assert.equal(resumed.checked,1);
  });

  test(name+'에서 만료된 읽기 권한을 한 번 갱신하고 같은 요청을 이어간다',async()=>{
    const mailbox=quoteMailbox(provider);
    mailbox.add('b1','책자 견적','교재 20부 제작 비용을 알려 주세요.');
    mailbox.expireAccess();
    let renewals=0;
    const result=await scanQuotes({...mailbox.context,renew:async()=>{renewals++;return {access:'renewed-sample'};}});
    assert.equal(renewals,1);
    assert.equal(result.items.length,1);
    assert.equal(result.code,undefined);
    assert.deepEqual(mailbox.requests.slice(0,2).map(r=>r.authorization),['Bearer sample','Bearer renewed-sample']);
    assert.equal(mailbox.requests[0].path,mailbox.requests[1].path);
    assert.equal(mailbox.requests[0].query.toString(),mailbox.requests[1].query.toString());
  });

  test(name+'에서 고객이 지정한 회신 주소로 답장을 보내면 문의가 처리된다',async()=>{
    const mailbox=quoteMailbox(provider);
    const intended=mailbox.add('b2','책자 견적 문의','교재 20부 제작 비용을 알려 주세요.',
      {from:other,replyTo:customer,...(provider==='gmail'?{to:'studio+quotes@example.test'}:{})});
    const [source]=(await scanQuotes(mailbox.context)).items;
    assert.equal(source.messageId,intended.id);
    mailbox.add('b2','Re: 책자 견적 문의','요청하신 견적을 보내드립니다.',{folder:'sentitems',to:customer});
    assert.equal((await confirmQuote(mailbox.context,source)).state,'closed');
  });
}

test('Outlook의 하위 폴더는 받은편지함과 정크 메일의 구분을 따른다',async()=>{
  const {add,context}=quoteMailbox('outlook');
  const kept=add('c1','견적 문의','책자 37부 견적을 부탁드립니다.',{folder:'inbox-child'});
  add('c2','인쇄물 견적','추가 인쇄물 견적을 부탁드립니다.',{folder:'junkemail-child'});
  const result=await scanQuotes(context);
  assert.equal(result.checked,2);
  assert.equal(result.code,undefined);
  assert.deepEqual(result.items.map(item=>item.messageId),[kept.id]);
});

test('Outlook의 답장 초안은 최신 고객 문의 이후에 작성하거나 수정했을 때 보류한다',async()=>{
  const {add,context}=quoteMailbox('outlook');
  add('c3','안내책자 견적','책자 37부 견적을 부탁드립니다.');
  const draft=add('c3','Re: 안내책자 견적','37부의 종이 종류를 알려주세요.',{folder:'drafts'});
  const change=add('c3','Re: 안내책자 견적','수량을 58부로 변경하면 납기는 어떻게 되나요?');
  const result=await scanQuotes(context);
  assert.deepEqual(result.items.map(x=>x.messageId),[change.id]);
  draft.modifiedAt=change.at+60000;
  assert.equal((await confirmQuote(context,result.items[0])).state,'draft');
});

