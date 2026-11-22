'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {randomUUID,randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {createOfficeMail}=require('../src/office-mail.cjs');
const {createOfficeTasks}=require('../src/office-tasks.cjs');
const {createTaskStore}=require('../src/office-task-store.cjs');
const {assessThread,quoteIntent,childId}=require('../src/office-quote-thread.cjs');

const account={synk_user_id:'quote_fixture_member',sessionGeneration:1};
const request='아직 답 안 한 견적 문의를 찾아서 견적 담당에게 넘겨줘';
const customer='customer@fixture.invalid',office='office@fixture.invalid';
const source='합성 고객 시안집 37권의 단가를 알려주세요.';
const plan={terms:[],from:'',after:'',before:'',folder:'received',provider:'all',inherit:false};
const latch=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve};};
function mailMessage(body,at,extra={}){
  return {id:String(at),subject:'책자 견적 문의',from:customer,sender:customer,recipients:[office],direct:true,at,body,...extra};
}
const outgoing=(at,to=customer)=>mailMessage('확인했습니다.',at,{sender:office,outgoing:true,recipients:[to]});

test('고객 본문, 보낸 답장의 수신자와 새 조건을 시간순으로 대조한다',()=>{
  const first=mailMessage(source,10),updated=mailMessage('수량을 58권으로 바꾸면 비용이 얼마인가요?',40);
  const state=messages=>assessThread(messages);
  assert.equal(state([first]).item.id,'10');
  assert.equal(state([first,outgoing(22,'coworker@fixture.invalid')]).item.id,'10');
  assert.equal(state([first,outgoing(22)]).state,'closed');
  assert.equal(state([updated,outgoing(22),first]).item.id,'40');
  assert.equal(state([first,mailMessage('진행 상황이 어떤가요? 회신 부탁드립니다.',23)]).item.id,'10');
  assert.equal(state([first,mailMessage('확인 부탁드립니다.',23)]).item.id,'10');
  assert.equal(state([first,mailMessage('답장 작성 중',23,{draft:true,recipients:[customer]})]).state,'draft');
  assert.equal(state([mailMessage('동료에게 보낼 내용',5,{draft:true,recipients:['staff@fixture.invalid']}),first]).state,'open');
  assert.notEqual(state([mailMessage(source,10,{direct:false})]).state,'open');
  assert.notEqual(state([mailMessage('감사합니다.\n\nOn Friday a customer wrote:\n가격을 알려 주세요.',10,{subject:'Re: 책자 견적 문의'})]).state,'open');
  assert.notEqual(state([mailMessage('견적 문의 없이 일정을 확정했습니다.',10,{subject:'지난번 대화'})]).state,'open');
  assert.notEqual(state([mailMessage('귀사의 견적 요청을 받았습니다.',10,{subject:'접수'})]).state,'open');
  assert.equal(state([mailMessage('책자 200부, 12월 초 납품 희망합니다.',10)]).state,'open');
  assert.equal(state([mailMessage('머그컵 100개 견적서 받아보고 싶어요.',10,{subject:'단체 주문'})]).state,'open');
  assert.equal(state([mailMessage('I would like a quote for our website redesign.',10,{subject:'Website redesign'})]).state,'open');
  assert.equal(state([mailMessage('Attached is our quote request for 100 units. Please let me know your pricing.',11,{subject:'Purchase enquiry'})]).state,'open');
  const ours=mailMessage('명함 500장 견적을 알려주세요.',10,{outgoing:true,sender:office,recipients:[customer]});
  assert.equal(state([ours,mailMessage('용지는 어떤 것으로 하실지 알려주세요. 그에 따라 단가가 달라집니다.',12)]).state,'closed');
  const long=state([mailMessage('회사 사정을 설명합니다. '.repeat(155)+'구리 명판 500개의 제작 단가와 납기를 알려주세요.',12)]);
  assert.ok(long.item.evidence.includes('구리 명판 500개'));assert.ok(long.item.evidence.length<=850);
  assert.equal(state([mailMessage(source,10,{bulk:true})]).state,'closed');
  assert.equal(state([first,mailMessage('이번 견적 요청을 취소합니다.',20)]).state,'closed');
  assert.equal(state([first,mailMessage('기존 견적은 취소하고 20개 기준으로 다시 견적 부탁드립니다.',20)]).item.id,'20');
  assert.equal(state([first,mailMessage('기존 견적은 취소해 주세요. 20개 기준으로 새 견적 부탁드립니다.',20)]).item.id,'20');
  assert.equal(state([first,mailMessage('책갈피 단가 확인 부탁드립니다.',20)]).item.id,'20');
  assert.equal(state([mailMessage('배너 A3 40개 견적서 송부 부탁드립니다.',12)]).state,'open');
  assert.equal(state([mailMessage('명함 500장 견적은 33,000원입니다. 확인 부탁드립니다.',12)]).state,'closed');
  assert.equal(state([first,mailMessage('지난 견적 어떻게 됐나요? 견적에 부스 조명도 포함해 주세요.',20)]).item.id,'20');
  assert.notEqual(state([first,mailMessage('',20,{uncertain:true})]).state,'open');
  assert.equal(state([{...first,replyTo:['reply@fixture.invalid']},outgoing(22,'reply@fixture.invalid')]).state,'closed');
  const tie=mailMessage('수량을 20권으로 바꾸면 얼마인가요?',10,{id:'tie'});
  for(const pair of [[first,tie],[tie,first]])assert.equal(state(pair).state,'review');
  const coworker=mailMessage('500장이면 단가 얼마로 안내할까요?',20,{sender:'staff@fixture.invalid'});
  assert.equal(state([first,outgoing(11,'staff@fixture.invalid'),coworker,outgoing(24,'staff@fixture.invalid')]).state,'review');
  for(const m of [
    mailMessage('받은 견적 문의 전달드립니다. 검토 부탁드립니다.',11,{subject:'Fwd: 배너 견적 문의'}),
    mailMessage('이번 달 요금은 33,000원입니다. 문의는 고객센터로 주세요.',11,{subject:'이용 요금 안내'}),
    mailMessage('견적서 첨부드립니다. 검토 부탁드립니다.',11,{subject:'Re: 견적 문의'})
  ])assert.notEqual(state([m]).state,'open');
});
test('직접 인계를 요청한 때만 자연어로 견적 담당을 선택한다',()=>{
  assert.equal(quoteIntent(request),true);
  assert.equal(quoteIntent('미회신 견적 문의는 직접 답장하지 말고 견적 담당에게 넘겨줘'),true);
  assert.equal(quoteIntent('고객 답장은 보류하고 미회신 견적 문의를 견적 담당에게 넘겨줘'),true);
  assert.equal(quoteIntent('아직 답 안 한 견적 문의를 견적 담당에게 넘겨주는 작업은 하지 마세요.'),false);
  assert.equal(quoteIntent('지금은 미회신 견적 문의를 견적 담당에게 넘기는 작업을 보류해 주세요'),false);
  for(const s of ['미회신 견적 문의를 찾아줘','견적 문의 메일을 검색해줘','미회신 견적 문의를 견적 담당에게 넘기는 방법을 설명해 줘','견적 담당에게 넘기지 마','“'+request+'” 기능을 구현해줘'])
    assert.equal(quoteIntent(s),false);
});
test('회원이 보류하라고 한 동작과 지금 맡긴 동작을 구분한다',()=>{
  for(const text of [
    '고객에게 답장하지 마시고 미회신 견적 문의는 견적 담당에게 넘겨줘.',
    '고객 답장은 내일까지 보류하고 미회신 견적 문의는 견적 담당에게 넘겨줘.',
    '내일까지 답장을 보류하고 미회신 견적 문의를 견적 담당에게 넘겨줘.',
    '미회신 견적 문의는 견적 담당에게 넘겨줘. 고객에게는 아직 답장하지 마.',
    "Don't reply to the customer, just hand off unanswered quote requests to the quoting team.",
    '미회신 견적 문의를 찾아서 견적 담당에게 인계하세요.',
    '고객 답장은 내일까지 보류하되 미회신 견적 문의는 견적 담당에게 전달하세요.',
    '미회신 견적 문의가 있으면 견적 담당에게 넘겨줘.',
    '메일 담당이 아직 답 안 한 견적 문의를 찾아서 견적 담당한테 넘겨줘.',
    '메일함을 조사해서 미회신 견적 문의를 견적 담당에게 넘겨줘.',
    '최근 미회신 견적 문의를 견적 담당에게 넘겨줘.',
    '미회신 견적 문의 좀 견적 담당에게 넘겨줘.',
    '미회신 견적 문의는 견적 담당한테 다 넘겨줘.',
    '고객 답장은 내일까지 보류해 두고 미회신 견적 문의는 견적 담당에게 넘겨줘.',
    '고객 답장은 일단 보류하고 미회신 견적 문의는 견적 담당에게 넘겨줘.',
    '미회신 견적 메일은 답장하지 말고 견적 담당에게 넘겨줘.',
    '고객 답장은 직접 하지 말고 미회신 견적 문의를 견적 담당에게 넘겨줘.',
    '미회신 견적 문의 메일이 있으면 견적 담당에게 넘겨줘.',
    '아직 답장하지 않은 견적 문의가 있으면 견적 담당에게 넘겨줘.',
    '미회신 견적 문의가 있는지 확인하고 있으면 견적 담당에게 넘겨줘.',
    'If there are unanswered quote emails, hand them off to the quote team.',
    'If you find unanswered quote emails, hand them off to the quote team.',
    'Please handoff unanswered quote emails to the quote team.',
    'Please handover unanswered quote emails to the quote team.',
    'I need you to forward unanswered quote requests to the quote team.',
    'Search my inbox for unanswered quote requests and forward them to the quote team.',
    'Search for unanswered quote emails, then forward them to the quote team.',
    'Check my inbox, then forward unanswered quote requests to the quote team.',
    'Look through my inbox and hand off unanswered quote emails to the quote team.',
    'Search for unanswered quote emails and forward them to the quote team.'
  ])assert.equal(quoteIntent(text),true,text);
  for(const text of [
    '미회신 견적 문의를 견적 담당에게 넘겨주지 마세요.',
    '미회신 견적 문의는 견적 담당에 인계하지 말고 제목만 보여줘.',
    '미회신 견적 문의를 견적 담당에게 넘겨줘. 아니, 하지 마.',
    '미회신 견적 문의를 고객이 다시 물으면 견적 담당에게 넘겨줘.',
    '미회신 견적 문의를 고객에게 답장도 하고 견적 담당에게 넘겨줘.',
    'Should I forward unanswered quote requests to the quote team?',
    'Should I reply now or hold off and forward unanswered quote requests to the quote team?',
    '고객 답장은 지금 보내고 미회신 견적 문의는 나중에 견적 담당에게 넘겨줘.',
    '내일 미회신 견적 문의가 있으면 견적 담당에게 넘겨줘.',
    '연휴 끝나고 미회신 견적 문의를 견적 담당에게 넘겨줘.',
    '내일 할 일: 답장하지 말고 미회신 견적 문의 메일이 있으면 견적 담당에게 넘겨줘.',
    '보류 없이 답장하고 미회신 견적 문의를 견적 담당에게 넘겨줘.',
    'I will forward unanswered quote requests to the quote team.',
    'If you find unanswered quote emails tomorrow, hand them off to the quote team.'
  ])assert.equal(quoteIntent(text),false,text);
});
test('제목에 견적이 없어도 고객의 직접 요청을 받고, 답장을 보낸 뒤 다시 온 요청은 새로 연다',()=>{
  const subject='명함 제작 문의';
  for(const body of ['명함 500장 견적 좀 부탁드립니다.','브로슈어 1,000부 견적 가능할까요?','명함 500장 견적 주세요.',
    '견적 좀 받아볼 수 있을까요?','견적 받아볼 수 없을까요?','가격 좀 알려주세요.',
    '명함 500장 견적서를 받아볼 수 있으면 감사하겠습니다.','견적 받을 수 있으면 좋겠습니다.','견적 받을 수 있어요?',
    '명함 500장 견적을 받아보고 싶어 연락드립니다.','명함 500장 견적 받아보고 싶네요.']){
    assert.equal(assessThread([mailMessage(body,10,{subject})]).item?.id,'10',body);
  }
  const first=mailMessage('명함 500장 견적 부탁드립니다.',10,{subject});
  const answer=outgoing(20);
  for(const text of ['보내주신 견적서 받고 검토 중입니다. 다음 주에 연락드리겠습니다.','견적 받아봤는데 내부 검토 후 연락드리겠습니다.',
    '지난달에 견적 좀 받아보고 싶었지만 지금은 보류 중입니다.',
    '지난달에 견적 받을 수 있으면 좋겠다고 말씀드렸지만 지금은 보류 중입니다.']){
    assert.notEqual(assessThread([first,answer,mailMessage(text,30,{subject})]).state,'open',text);
  }
  for(const body of ['명함 500장 견적서 부탁드립니다.','양면입니다. 견적 부탁드립니다.']){
    assert.equal(assessThread([first,answer,mailMessage(body,30,{subject})]).item?.id,'30');
  }
  for(const body of ['당분간 보류하기로 했던 건인데 행사가 확정돼서 64권으로 다시 견적 부탁드립니다.',
    '현재 보류 중인 건을 다시 진행하려 합니다. 64권으로 견적 부탁드립니다.']){
    const active=assessThread([first,answer,mailMessage(body,30,{subject})]);
    assert.equal(active.item?.id,'30',body);
    assert.ok(active.item.evidence.includes('64권'),body);
  }
});
test('서로 다른 메일에서 품목과 수량을 차례로 바꿔도 견적 담당에게 현재 품목이 전달된다',()=>{
  const revised=assessThread([mailMessage('시안집 37권 견적 부탁드립니다.',10),
    mailMessage('시안집 대신 안내책자 37권으로 바꿔서 새 견적 부탁드립니다.',20),
    mailMessage('58권으로 확인 부탁드립니다.',30)]);
  assert.equal(revised.item?.id,'30');
  assert.match(revised.item.evidence,/안내책자/);
  assert.match(revised.item.evidence,/58권/);
  const more=assessThread([mailMessage('안내책자 37권 견적 부탁드립니다.',10),
    mailMessage('추가로 20권 더 견적 부탁드립니다.',20),mailMessage('30권으로 확인 부탁드립니다.',30)]);
  assert.match(more.item.evidence,/안내책자/);
  assert.match(more.item.evidence,/추가로 20권 더/);
  assert.match(more.item.evidence,/30권/);
});
test('긴 문의의 품목과 마지막 수량을 차례로 수정한 뒤에도 원문에서 함께 확인한다',()=>{
  const original='안내책자 37권을 행사 안내 데스크에서 나눠줄 예정이라 표지는 지문이 덜 남는 무광으로 하고 내지는 실내 조명에서도 또렷하게 읽히는 종이로 만들어 주시고 보내 드린 시안과 색이 최대한 비슷하게 맞춰 주시고 개별 포장은 생략하고 운반 중 모서리가 상하지 않도록 완충재를 넣은 다음 접수처에서 바로 나눌 수 있도록 상자별로 행사 이름과 배송지를 표시해 보내 주시는 조건으로 견적 부탁드립니다.';
  const messages=[mailMessage(original,10,{subject:'제작 의뢰'}),mailMessage('58권으로 견적 부탁드립니다.',20,{subject:'Re: 제작 의뢰'})];
  for(const [quantity,id] of [['58권','20'],['64권','30']]){
    const result=assessThread(messages);
    assert.equal(result.item?.id,id);
    assert.match(result.item.evidence,/안내책자/);
    assert.ok(result.item.evidence.includes(quantity));
    assert.ok(result.item.evidence.length<=850);
    if(id==='20')messages.push(mailMessage('64권으로 확인 부탁드립니다.',30,{subject:'Re: 제작 의뢰'}));
  }
});
test('고객이 알려준 품목, 기준 수량, 추가 발주와 납기는 각각 원문에서 이어진다',()=>{
  const examples=[
    [['품목은 안내책자입니다. 표지는 무광으로 하고 빛 반사가 적은 내지로 제작해 주세요. 수량은 37권입니다. 위 조건으로 견적 부탁드립니다.',
      '58권으로 확인 부탁드립니다.','64권으로 확인 부탁드립니다.'],['안내책자','64권']],
    [['시안집 37권 견적 부탁드립니다.','시안집 대신 안내책자로 바꿔 주세요. 수량은 37권입니다. 새 견적 부탁드립니다.',
      '58권으로 최종 견적 부탁드립니다.'],['안내책자로 바꿔','58권']],
    [['안내책자 37권 견적 부탁드립니다.','수량은 20권 추가해 주세요.','12월 5일까지 납품 가능한지 확인 부탁드립니다.'],
      ['안내책자','37권','20권 추가','12월 5일']],
    [['안내책자 37권 견적 부탁드립니다.','제품은 동일하고 수량만 58권으로 변경 부탁드립니다.','64권으로 확인 부탁드립니다.'],
      ['안내책자','64권']],
    [['안내책자 37권 견적 부탁드립니다.','수량은 20권 추가해 주세요.','택배 대신 직접 수령하겠습니다. 12월 5일까지 납품 가능한지 확인 부탁드립니다.'],
      ['안내책자','37권','20권 추가','직접 수령','12월 5일']],
    [['안내책자 37권 견적 부탁드립니다.','20권 추가 부탁드립니다.','그중 5권은 12월 5일까지 먼저 납품 가능한지 확인 부탁드립니다.'],
      ['안내책자','37권','20권 추가','5권','12월 5일']]
  ];
  for(const [messages,expected] of examples){
    const result=assessThread(messages.map((body,i)=>mailMessage(body,10+i,{subject:'제작 문의'})));
    assert.equal(result.item?.sourceId,'12');
    for(const piece of expected)assert.ok(result.item.evidence.includes(piece),piece);
  }
  const first='품목은 안내책자입니다. '+'희망하는 내지와 표지의 사양을 설명드립니다. '.repeat(18)+'수량은 37권입니다. 견적 부탁드립니다.';
  const later=assessThread([mailMessage(first,10),mailMessage('12월 5일까지 납품 가능한지 확인 부탁드립니다.',20)]);
  for(const token of ['안내책자','37권','12월 5일'])assert.ok(later.item?.evidence.includes(token),token);
  assert.ok(later.item.evidence.length<=850);
});
test('새 품목에 적용할 조건은 그 품목에 관한 메일에서 확인한다',()=>{
  const first='안내책자 137권 견적 부탁드립니다.';
  const artwork='품목은 작품집으로 바꿉니다. 42권 견적 부탁드립니다.';
  const deadline='12월 5일까지 납품 가능한지 확인 부탁드립니다.';
  const assess=bodies=>assessThread(bodies.map((body,i)=>mailMessage(body,10+i,{subject:'제작 문의'})));
  for(const unchanged of ['품목은 그대로입니다. 58권으로 확인 부탁드립니다.',
    '제품은 동일하고 수량만 58권으로 변경 부탁드립니다.','택배 대신 직접 수령하겠습니다. 58권으로 확인 부탁드립니다.']){
    const result=assess([first,artwork,unchanged,'64권으로 확인 부탁드립니다.']);
    assert.ok(result.item.evidence.includes('작품집'));
    assert.ok(result.item.evidence.includes('64권'));
  }
  const replaced=assess([first,'수량은 20권 추가해 주세요.',artwork,deadline]);
  assert.ok(replaced.item.evidence.includes('작품집'));
  assert.doesNotMatch(replaced.item.evidence,/20권/);
  const long='품목은 작품집입니다. '+'희망하는 내지와 표지의 사양을 설명드립니다. '.repeat(9)+'실제 수량은 37권입니다. 견적 부탁드립니다.';
  const moved=assess([first,long,deadline]);
  assert.match(moved.item.evidence,/(?<!\d)37권/);
  const separate=assess([first,'20권 추가 부탁드립니다. 예비분은 별도 견적 부탁드립니다.','본 주문은 64권으로 확인 부탁드립니다.']);
  assert.match(separate.item.evidence,/20권 추가/);
});
test('견적을 거절하거나 발주만 미룬 고객의 뜻을 구분한다',()=>{
  const first=mailMessage('명함 500장 견적 부탁드립니다.',10);
  const declined=mailMessage('명함 500장 견적을 받아보고 싶지는 않습니다.',20);
  assert.equal(assessThread([declined]).state,'closed');
  assert.equal(assessThread([first,declined]).state,'closed');
  const newQuote=mailMessage('명함 견적을 받고 싶지는 않지만 작품집 25권 견적 부탁드립니다.',30);
  assert.equal(assessThread([first,declined,newQuote]).item?.id,'30');
  const purchasing=mailMessage('지금은 발주를 보류 중이지만, 내부 검토용으로 안내책자 37권 견적 부탁드립니다.',40);
  assert.equal(assessThread([first,outgoing(22),purchasing]).item?.id,'40');
  for(const hold of ['내부 승인 전이라 당분간 견적을 보류해 주세요.','견적은 당분간 보류하겠습니다.',
    '저희 회사는 견적을 당분간 보류하겠습니다.','저희 팀은 견적을 당분간 보류하겠습니다.','제작은 당분간 보류하겠습니다.',
    '저희 회사는 당분간 보류하겠습니다.']){
    assert.equal(assessThread([first,mailMessage(hold,30)]).state,'closed',hold);
  }
  assert.equal(assessThread([first,mailMessage('명함 견적 부탁드립니다. 지금은 견적을 보류하겠습니다.',30)]).state,'closed');
  assert.equal(assessThread([first,mailMessage('배송만 잠시 보류해 주세요.',30)]).state,'open');
  assert.notEqual(assessThread([first,mailMessage('인쇄는 당분간 보류하겠습니다.',35)]).state,'open');
  const cover=mailMessage('표지 시안 비용만 먼저 견적 부탁드립니다. 인쇄는 당분간 보류하겠습니다.',35);
  assert.equal(assessThread([mailMessage('안내책자 37권 견적 부탁드립니다.',10),cover]).state,'review');
  const mixed=mailMessage('안내책자 37권 견적 부탁드리고 명함 500장 견적을 받아보고 싶지는 않습니다.',31);
  const result=assessThread([mixed]);
  assert.equal(result.item?.id,'31');
  assert.match(result.item.evidence,/안내책자 37권/);
  assert.doesNotMatch(result.item.evidence,/명함/);
  const book='안내책자 37권 인쇄 견적 부탁드립니다.';
  for(const decline of ['디자인 견적은 필요 없습니다.','지난번 명함 견적 요청은 취소해 주세요.','명함 500장 견적은 취소해 주세요.','명함은 당분간 보류하겠습니다.','예비분은 당분간 보류하겠습니다.']){
    const sameMessage=assessThread([mailMessage(book+' '+decline,10)]);
    assert.equal(sameMessage.item?.evidence,book,decline);
    const nextMessage=assessThread([mailMessage(book,10),mailMessage(decline,20)]);
    if(/^(?:명함은|예비분은)/.test(decline))assert.equal(nextMessage.state,'review',decline);
    else assert.equal(nextMessage.item?.id,'10',decline);
  }
  for(const reason of ['당분간 보류하겠습니다만 …','견적은 당분간 보류하겠습니다만, 진행 여부는 차후 알려드리겠습니다.']){
    assert.notEqual(assessThread([first,mailMessage(reason,40)]).state,'open',reason);
  }
  const stillRequests=mailMessage('발주는 당분간 보류하겠습니다만, 내부 검토용으로 안내책자 37권 견적 부탁드립니다.',45);
  assert.equal(assessThread([first,stillRequests]).item?.id,'45');
  assert.equal(assessThread([first,mailMessage('배송은 보류하고 견적은 취소해 주세요.',48)]).state,'closed');
});
test('견적 담당은 같은 품목의 추가 주문과 분할 납품을 각각 확인한다',()=>{
  const read=bodies=>assessThread(bodies.map((body,i)=>mailMessage(body,10+i,{subject:'제작 문의'}))).item?.evidence||'';
  const base='안내책자 37권 견적 부탁드립니다.';
  const artwork='품목은 작품집입니다. 42권 견적 부탁드립니다.';
  const extra='20권 추가해 주세요. 예비분은 별도 견적 부탁드립니다.';
  const deadline='12월 5일까지 납품 가능한지 확인 부탁드립니다.';
  for(const restated of ['품목은 작품집이고 ','품목은 작품집인데 ','품목은 작품집이며 ']){
    assert.match(read([artwork,extra,restated+deadline]),/20권 추가/);
  }
  const change='품목은 작품집으로 바꿉니다. 42권 견적 부탁드립니다. 그중 5권은 먼저 납품 부탁드립니다.';
  const mixed=read([base,change,extra,'품목은 작품집입니다. '+deadline]);
  for(const detail of ['작품집','42권','5권','20권 추가'])assert.ok(mixed.includes(detail),detail);
  const split=read([base,extra,'그중 5권은 12월 5일까지 먼저 납품 가능한지 확인 부탁드립니다.',
    '그중 10권은 12월 6일까지 납품 가능한지 확인 부탁드립니다.','나머지 수량의 납기도 확인 부탁드립니다.']);
  for(const detail of ['20권 추가','5권','10권'])assert.ok(split.includes(detail),detail);
  const alternate=read([base,extra,'품목은 작품집입니다. 안내책자 대신 작품집 42권 견적 부탁드립니다.',deadline]);
  assert.match(alternate,/작품집 42권/);
  assert.doesNotMatch(alternate,/20권/);
  const bothParts=read([base,'수량은 64권으로 확인 부탁드립니다.',
    '그중 5권은 12월 5일까지 먼저 납품 가능한지 확인 부탁드립니다. 나머지 59권은 12월 7일까지 납품 가능한지 확인 부탁드립니다.']);
  for(const value of ['64권','5권','59권'])assert.ok(bothParts.includes(value),value);
  const packaging='포장과 배송 시 책의 모서리가 접히지 않도록 부탁드립니다. '.repeat(7);
  const longChange='품목은 작품집으로 바꿉니다. 42권 견적 부탁드립니다. '+packaging+'그중 5권은 12월 5일까지 먼저 납품 부탁드립니다.';
  assert.match(read([base,longChange,'나머지 수량의 납기도 확인 부탁드립니다.']),/그중 5권은 12월 5일/);
  const ordered=read([base,'그중 5권은 먼저 납품 가능한지 확인 부탁드립니다.',extra,deadline]);
  assert.ok(ordered.indexOf('그중 5권')>=0&&ordered.indexOf('그중 5권')<ordered.indexOf('20권 추가'));
  for(const addition of [extra,'예비분 5권 추가 견적 부탁드립니다.']){
    for(const held of ['예비분은 당분간 보류하겠습니다.','예비분은 제작을 당분간 보류하겠습니다.',
      '예비분은 견적을 당분간 보류하겠습니다.','예비분은 일단은 보류하겠습니다.']){
      for(const further of [[],[deadline]]){
        const evidence=read([base,addition,held,...further]);
        assert.ok(evidence.includes('안내책자 37권'),held);
        assert.ok(evidence.includes(held)&&evidence.indexOf(addition)<evidence.indexOf(held),held);
      }
    }
  }
  const baseAndExtras=['예비분으로 쓸 안내책자 37권 견적 부탁드립니다.','예비분 5권 추가 견적 부탁드립니다.','예비분은 당분간 보류하겠습니다.'];
  assert.notEqual(assessThread(baseAndExtras.map((body,i)=>mailMessage(body,10+i))).state,'open');
  for(const count of ['7권','5권']){
    const held='그중 '+count+'은 견적을 보류하겠습니다.';
    const result=read([base,'그중 '+count+'은 12월 5일까지 먼저 납품 가능한지 확인 부탁드립니다.',held,
      '나머지는 12월 7일까지 납품 가능한지 확인 부탁드립니다.']);
    for(const value of ['37권',held,'12월 7일'])assert.ok(result.includes(value),value);
  }
  const hold='예비분은 당분간 보류하겠습니다.';
  const exception='다만 당장 필요한 예비분 3권은 견적 부탁드립니다.';
  for(const next of [[],[deadline]]){
    const evidence=read([base,extra,hold+' '+exception,...next]);
    assert.ok(evidence.includes(hold)&&evidence.indexOf(exception)>evidence.indexOf(hold),evidence);
    assert.ok(evidence.includes('안내책자 37권'));
  }
  const increments=Array.from({length:28},(_,i)=>mailMessage((i+1)+'권 추가해 주세요.',20+i));
  assert.equal(assessThread([mailMessage(base,10),...increments]).state,'review');
});
test('거래처가 알려 준 희망 가격과 공급사가 산정한 가격을 구분한다',()=>{
  const budget='희망 단가는 3,000원입니다. 종이책 100부 견적 부탁드립니다.';
  assert.equal(assessThread([mailMessage(budget,10)]).item?.evidence,budget);
  const rfq=mailMessage('명함 500장 견적을 알려주세요.',10,{outgoing:true,sender:office,recipients:[customer]});
  for(const body of [
    '명함 500장 기준 단가 66원이니 진행 여부 확인 부탁드립니다.',
    '정확한 단가 산정을 위해 인쇄 수량을 알려주세요.',
    'To calculate your price, please confirm how many copies you need.'
  ])assert.notEqual(assessThread([rfq,mailMessage(body,20)]).state,'open',body);
});
test('원문의 재촉, 새 품목과 수량 변경, 철회 후 다시 맡긴 요청을 구분한다',()=>{
  const first=mailMessage('A3 배너 40개 제작 견적 부탁드립니다.',10);
  for(const text of ['바쁘실 텐데, 지난 견적 어떻게 됐나요?','안녕하세요. 지난 견적 진행 상황 확인 부탁드립니다.',
    '지난주 문의드린 견적 건, 아직 답변이 없어 다시 문의드립니다.']){
    assert.equal(assessThread([first,mailMessage(text,20)]).item?.id,first.id,text);
  }
  for(const text of ['58권으로 확인 부탁드립니다.','책갈피 단가 확인 부탁드립니다.',
    '기존 견적은 취소 부탁드립니다. 20개 기준으로 새 견적 부탁드립니다.',
    '기존 견적은 취소해 주시고 20개로 다시 견적 부탁드립니다.']){
    const changed=mailMessage(text,30);
    assert.equal(assessThread([first,changed]).item?.id,changed.id,text);
    assert.ok(assessThread([first,changed]).item.evidence.includes(text.includes('취소')?'20개':text));
  }
  assert.equal(assessThread([mailMessage(source,10),mailMessage('58권으로 확인 부탁드립니다.',20),mailMessage('37권으로 확인 부탁드립니다.',30)]).item?.id,'30');
});
test('같은 고객의 옛 초안은 그 뒤의 새 조건을 숨기지 않는다',()=>{
  const first=mailMessage(source,10);
  const prior=mailMessage('37권 견적을 준비하고 있습니다.',20,{draft:true,recipients:[customer]});
  const change=mailMessage('원래 37권에서 58권으로 바꾸면 얼마인가요?',30);
  assert.equal(assessThread([change,prior,first]).item?.id,change.id);
  assert.equal(assessThread([prior,change,first,{...prior,id:'40',at:40}]).state,'draft');
  for(const [time,recipients,expected] of [[30,[customer],'review'],[undefined,[customer],'review'],[40,[],'review'],[20,[],'open'],[40,[office],'open']]){
    assert.equal(assessThread([first,change,{...prior,at:time,recipients}]).state,expected);
  }
});
test('견적 초안의 근거 없는 금액과 납품 약속을 걸러내고 고객이 제시한 예산 확인은 허용한다',()=>{
  const {ungrounded}=require('../src/office-quote-draft.cjs');
  assert.equal(ungrounded('총 견적은 999,000원입니다. 내일 납품하겠습니다.',source),true);
  assert.equal(ungrounded('We will deliver on Friday.',source),true);
  assert.equal(ungrounded('말씀하신 예산 50만원이 맞으실까요?','예산은 50만원입니다.'),false);
  assert.equal(ungrounded('희망하시는 12월 6일에 맞출 수 있는지 확인하겠습니다.',source),false);
});
function cipher(){
  const key=randomBytes(32);
  return {available:()=>true,encrypt:text=>{
    const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);
    const data=Buffer.concat([c.update(text,'utf8'),c.final()]);
    return Buffer.concat([iv,c.getAuthTag(),data]);
  },decrypt:data=>{
    const d=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));d.setAuthTag(data.subarray(12,28));
    return Buffer.concat([d.update(data.subarray(28)),d.final()]).toString('utf8');
  }};
}
async function fixture(t,config={}){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'solio-quote-test-'));
  const current=()=>account,authorized=async a=>a===account,events=[],opened=[];
  const item={id:childId('gmail','fixture-account','ba','f1'),threadId:'ba',messageId:'f1',sourceId:'f1',subject:'합성 시안집 문의',from:customer,
    date:'2026-11-20T00:00:00Z',snippet:source,evidence:source};
  const state={recheck:'open',checks:0,events,opened,item};
  const mail=createOfficeMail({userData:dir,secrets:cipher(),current,authorized,clients:async()=>({gmail:{id:'fixture'}}),
    authorize:async()=>({subject:'fixture-account',address:office,refreshToken:'fixture-synthetic',scope:'fixture'}),
    refresh:async()=>({access:'fixture-access',refreshToken:'fixture-synthetic',scope:'fixture'}),
    openExternal:async url=>opened.push(url),search:async()=>({items:[],more:false}),
    scanQuotes:config.scan|| (async()=>({items:[item],checked:3,eligibleCount:1,more:false})),
    confirmQuote:config.confirm|| (async()=>{state.checks++;return {state:state.recheck,item};})});
  const baseStore=createTaskStore(dir,fs,mail);
  const store=config.store?.(baseStore)||baseStore;
  const runner=async(spec,hooks)=>{
    events.push(spec);
    assert.equal(await hooks.session(spec.id,'1'.repeat(64)),true);
    if(spec.quoteDraft){
      if(config.draft)return config.draft(state,hooks);
      return '합성 답장. 요청하신 시안집 37권의 판형을 알려주시면 견적을 안내하겠습니다.';
    }
    if(config.plan)await config.plan(state);
    return plan;
  };
  const options={userData:dir,current,authorized,context:async()=>({ok:true,cwd:dir,name:'업무',cap:2}),run:runner,mail,store};
  const service=createOfficeTasks(options);
  await mail.connect(account,'gmail');
  const submit=(extra={})=>service.submit(account,{id:randomUUID(),provider:'codex',prompt:request,...extra});
  async function done(id){
    for(let attempt=0;attempt<1000;attempt++){
      const row=(await service.snapshot(account)).tasks?.find(t=>t.id===id);
      if(row&&['completed','failed','paused','interrupted'].includes(row.status))return row;
      await delay(10);
    }
    assert.fail('업무 시간 초과 '+id);
  }
  t.after(async()=>{service.close();await service.snapshot(account);await fs.rm(dir,{recursive:true,force:true});});
  return {service,mail,done,dir,state,submit,options};
}
test('동시에 두 번 맡겨도 원래 견적 카드·암호화 근거·별도 GPT 업무가 하나 생긴다',async t=>{
  const f=await fixture(t),[one,two]=await Promise.all([f.submit(),f.submit()]);
  const p=await f.done(one.id),q=await f.done(two.id);
  assert.equal(p.handoffs.length,1);assert.equal(p.handoffs[0].id,q.handoffs[0].id);
  const c=await f.done(p.handoffs[0].id);
  assert.equal(c.quoteOutcome,'draft');assert.equal(c.quoteSource.evidence,source);assert.match(c.answer,/판형/);
  assert.equal(f.state.events.filter(s=>s.quoteDraft).length,1);
  const recipient=f.state.events.find(s=>s.quoteDraft);assert.equal(recipient.previousId,null);
  assert.equal(recipient.id,c.id);assert.notEqual(recipient.id,p.id);assert.equal(recipient.mailSearch,true);
  assert.equal((await f.service.action(account,c.id,'terminal')).ok,false);
  assert.equal((await f.submit({previousId:c.id,prompt:'준비한 답장을 이어서 처리해줘'})).code,'SESSION');
  assert.equal((await f.mail.openResult(account,c.quoteSource.parentId,c.quoteSource.itemId)).ok,true);
  assert.match(f.state.opened[0],/#all\/f1$/);
  const index=await fs.readFile(path.join(f.dir,'Office',account.synk_user_id,'tasks.json'),'utf8');
  for(const secret of [source,customer,'합성 시안집 문의','판형','fixture-synthetic'])assert.equal(index.includes(secret),false);
  for(const id of [p.id,c.id]){
    const data=await fs.readFile(path.join(f.dir,'OfficeMail',account.synk_user_id,id+'.enc'));
    assert.equal(data.includes(Buffer.from('시안집')),false);
  }
  // A receipt written just before the crashed ledger rename restores one paused child.
  const parsed=JSON.parse(index);parsed.tasks=parsed.tasks.filter(row=>row.id!==c.id);
  await fs.writeFile(path.join(f.dir,'Office',account.synk_user_id,'tasks.json'),JSON.stringify(parsed));
  const restarted=createOfficeTasks(f.options);
  const rows=(await restarted.snapshot(account)).tasks;
  assert.equal(rows.filter(row=>row.id===c.id).length,1);
  assert.equal(rows.find(row=>row.id===c.id).status,'paused');
  assert.equal(rows.find(row=>row.id===p.id).handoffs[0].id,c.id);
});
test('조사와 인계 사이에 답장을 보냈으면 견적 모델을 실행하지 않는다',async t=>{
  const f=await fixture(t);f.state.recheck='closed';
  const parent=await f.done((await f.submit()).id),child=await f.done(parent.handoffs[0].id);
  assert.equal(child.quoteOutcome,'held');assert.ok(!f.state.events.some(s=>s.quoteDraft));
});
test('초안을 쓰는 도중 답장이 왔으면 해당 초안을 보관하지 않는다',async t=>{
  const f=await fixture(t,{draft:async state=>{state.recheck='closed';return '보관하면 안 되는 초안';}});
  const parent=await f.done((await f.submit()).id),child=await f.done(parent.handoffs[0].id);
  assert.equal(child.quoteOutcome,'held');assert.ok(!child.answer.includes('보관하면'));
  const receipt=await f.mail.vault.read(account.synk_user_id,child.id);
  assert.ok(!JSON.stringify(receipt).includes('보관하면 안 되는 초안'));
});
test('연결 해제는 실행 중인 견적 모델을 중단하고 결과를 남기지 않는다',async t=>{
  const started=latch(),aborted=latch();
  const f=await fixture(t,{draft:async(_state,hooks)=>{
    started.resolve();await new Promise(resolve=>hooks.signal.addEventListener('abort',resolve,{once:true}));
    aborted.resolve();return '보관하면 안 되는 초안';
  }});
  const parent=await f.done((await f.submit()).id);await started.promise;
  await f.mail.disconnect(account,'gmail');await aborted.promise;
  const child=await f.done(parent.handoffs[0].id);
  assert.equal(child.status,'failed');assert.equal(child.reason,'MAIL_CHANGED');
  assert.equal(await f.mail.vault.read(account.synk_user_id,child.id),null);
});
test('일반 메일 검색 모드에서는 같은 문장이어도 인계하지 않는다',async t=>{
  const f=await fixture(t),parent=await f.done((await f.submit({mailSearch:true})).id);
  assert.equal(parent.quoteHandoff,undefined);assert.equal(f.state.events.length,1);
});
test('앞선 일반 메일 카드에서 분명하게 인계를 시키면 독립된 조사로 시작한다',async t=>{
  const f=await fixture(t),first=await f.done((await f.submit({mailSearch:true})).id);
  const parent=await f.done((await f.submit({previousId:first.id})).id);
  assert.equal(parent.previousId,null);assert.equal(parent.quoteHandoff,true);
  assert.equal(parent.handoffs.length,1);await f.done(parent.handoffs[0].id);
  assert.equal(f.state.events[1].previousId,null);
});
for(const code of ['LIMIT','NATIVE','MAIL_TIMEOUT'])test('GPT 실행이 일시 중단된 뒤 같은 카드에서 초안을 마친다 ('+code+')',async t=>{
  let attempts=0;
  const f=await fixture(t,{draft:async()=>{if(!attempts++)throw Object.assign(new Error(code),{code});return '현재 문의용 견적 답장';}});
  const parent=await f.done((await f.submit()).id),id=parent.handoffs[0].id;
  assert.equal((await f.done(id)).canRetry,true);
  assert.equal((await f.service.action(account,id,'resume')).ok,true);
  const done=await f.done(id);assert.equal(done.quoteOutcome,'draft');assert.equal(attempts,2);
});
test('견적 직원이 구매 요청 근거를 확인하지 못하면 정상 보류하며 잘못된 응답은 실패로 남긴다',async t=>{
  for(const [output,status] of [['','completed'],[null,'failed'],['   ','failed']]){
    const f=await fixture(t,{draft:async()=>output});
    const parent=await f.done((await f.submit()).id);
    const child=await f.done(parent.handoffs[0].id);
    assert.equal(child.status,status);
    if(status==='completed')assert.equal(child.quoteOutcome,'held');
    else assert.equal(child.reason,'MAIL_PLAN');
  }
});
test('보류했던 문의가 다시 열리면 새 지시에서 같은 카드의 이전 보류 결과를 교체한다',async t=>{
  const f=await fixture(t);f.state.recheck='draft';
  const first=await f.done((await f.submit()).id),id=first.handoffs[0].id;
  assert.equal((await f.done(id)).quoteOutcome,'held');
  f.state.recheck='open';
  const second=await f.done((await f.submit()).id);
  assert.equal(second.handoffs[0].id,id);
  assert.equal((await f.done(id)).quoteOutcome,'draft');
  const restored=(await createOfficeTasks(f.options).snapshot(account)).tasks;
  assert.equal(restored.filter(x=>x.quoteSource).length,1);
  assert.equal(restored.find(x=>x.id===id).quoteOutcome,'draft');
});
test('메일함에 문의가 24건을 넘으면 추가 지시 없이 다음 묶음을 넘기고 첫 카드에 모두 표시한다',async t=>{
  const entries=Array.from({length:27},(_,i)=>({id:childId('gmail','fixture-account','ab'+i,'c'+i),threadId:'ab'+i,messageId:'c'+i,
    sourceId:'c'+i,subject:'책자 '+i,from:customer,date:'2026-11-20T00:00:00Z',evidence:source,snippet:source}));
  let scans=0;
  const f=await fixture(t,{scan:async ctx=>{
    scans++;return ctx.start?{items:entries.slice(24),checked:3,remaining:0,more:false,resumed:true}:
      {items:entries.slice(0,24),checked:24,remaining:1,more:true,cursor:{page:'next',offset:0}};
  },confirm:async(_ctx,item)=>({state:'open',item})});
  const first=await f.submit();await f.done(entries.at(-1).id);
  const rows=(await f.service.snapshot(account)).tasks,root=rows.find(r=>r.id===first.id);
  assert.equal(scans,2);assert.equal(root.handoffs.length,27);assert.equal(rows.filter(r=>r.quoteSource).length,27);
  assert.equal(f.state.events.filter(s=>!s.quoteDraft).length,1);
});
test('묶음 앞에서 잠시 읽지 못한 대화와 새 연결로 재시도할 27건도 빠짐없이 처리한다',async()=>{
  const {quoteMailbox}=require('./fixtures/office-quote-mail.cjs');
  const {scanQuotes}=require('../src/office-quote-providers.cjs');
  const {needsScan}=require('../src/office-quote-cards.cjs');
  const box=quoteMailbox('gmail'),ids=Array.from({length:27},(_,i)=>(0x201+i).toString(16));
  for(const id of ids)box.add(id,'도서 견적 문의','책자 37권 제작 견적 부탁드립니다.');
  const ctx={...box.context,fetch:async(url,options)=>{
    if(new URL(url).pathname.endsWith('/'+ids[1]))return Response.json({error:{}},{status:503});
    return box.context.fetch(url,options);
  }};
  const partial=await scanQuotes(ctx);
  assert.equal(partial.code,'MAIL_NETWORK');assert.equal(partial.items.length,24);
  const found=new Set(partial.items.map(i=>i.id));
  const resumed=await scanQuotes({...box.context,start:partial.cursor,known:found});
  for(const item of resumed.items)found.add(item.id);
  assert.equal(found.size,27);
  const gate=[{provider:'gmail',id:'renewed'}];
  const rows=[...found].map(id=>({id,quoteOrigin:{},mailBindings:[{provider:'gmail',id:'revoked'}],status:'failed',reason:'MAIL_CHANGED'}));
  const known=new Set(rows.filter(r=>!needsScan(r,gate)).map(r=>r.id));
  const first=await scanQuotes({...box.context,known});
  for(const item of first.items)known.add(item.id);
  const last=await scanQuotes({...box.context,known,start:first.cursor});
  assert.equal(first.items.length,24);assert.equal(last.items.length,3);
  assert.equal(new Set([...first.items,...last.items].map(i=>i.id)).size,27);
});
test('보관 메일의 직접 별칭은 원래 수신 헤더와 실제 배달 주소가 모두 맞아야 인계한다',async()=>{
  const {quoteMailbox}=require('./fixtures/office-quote-mail.cjs');
  const {scanQuotes}=require('../src/office-quote-providers.cjs');
  const box=quoteMailbox('gmail'),alias='quotes@example.test';
  box.add('a1','안내책자 견적 문의',source,{to:alias});
  let original=true;
  const ctx={...box.context,fetch:async(url,opts)=>{
    const raw=await box.context.fetch(url,opts);
    if(!new URL(url).pathname.endsWith('/threads/a1'))return raw;
    const thread=await raw.json(),m=thread.messages[0];
    delete m.labelIds;
    m.payload.headers.push({name:'Delivered-To',value:box.context.address});
    if(original)m.payload.headers.push({name:'X-Original-To',value:alias});
    return Response.json(thread);
  }};
  assert.equal((await scanQuotes(ctx)).items.length,1);
  original=false;
  assert.equal((await scanQuotes(ctx)).items.length,0);
});
test('새 지시는 최신 메일부터 읽고 중단된 카드에서 명시적으로 이어야 어제의 커서를 쓴다',async t=>{
  const starts=[],cursor={page:'yesterday',offset:1};
  const f=await fixture(t,{scan:async ctx=>{
    starts.push(ctx.start||null);
    if(starts.length===1)return {items:[],checked:3,more:true,code:'MAIL_LIMIT',cursor};
    return {items:ctx.start?[]:[f.state.item],checked:1,more:false};
  }});
  const interrupted=await f.done((await f.submit()).id);
  assert.equal(interrupted.quoteCanResume,true);
  const fresh=await f.done((await f.submit()).id);
  assert.equal(fresh.handoffs.length,1);await f.done(fresh.handoffs[0].id);
  const resume={quoteHandoff:true,mailSearch:true,quoteResumeOf:interrupted.id};
  const recovery=await f.done((await f.submit(resume)).id);assert.equal(recovery.status,'completed');
  assert.deepEqual(starts,[null,null,cursor]);
  assert.equal((await f.submit({...resume,prompt:'다른 문의'})).code,'SESSION');
  await f.mail.disconnect(account,'gmail');await f.mail.connect(account,'gmail');
  assert.equal((await f.submit(resume)).code,'MAIL_CHANGED');
});
