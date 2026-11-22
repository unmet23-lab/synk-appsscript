'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {checkDecision,searchMailbox,combinePlan,explicitPlan}=require('../src/office-mail-api.cjs');
const seed={terms:[],from:'',after:'',before:'',folder:'',provider:'',inherit:false};
const ok=value=>new Response(JSON.stringify(value),{status:200});
const cite=(role,quote,nth=1)=>({role,quote,nth});
const raw=(mailRef,fields={})=>({...seed,scope:'mailbox',mailRef,otherRef:'',unmet:[],evidence:[],period:'',
  attachment:'',mergeTerms:'replace',clear:[],...fields});
test('일반 자료, 웹, 앞 업무와 사서함을 구분하고 출처가 충돌하면 검색 조건을 회원에게 돌려준다',()=>{
  const web='Search the web for how to configure filters in Gmail';
  const correct=raw('',{scope:'web_docs',otherRef:'the web',evidence:[cite('about','Gmail')]});
  assert.equal(checkDecision(correct,web).kind,'ordinary');
  assert.equal(checkDecision({...correct,otherRef:'unmentioned'},web).kind,'choose');
  assert.throws(()=>explicitPlan(correct,web),{code:'MAIL_REVIEW'});
  const prior='앞 답변에서 email 항목만 찾아줘',priorPacket=raw('',{scope:'prior_result',otherRef:'앞 답변',evidence:[cite('about','email')]});
  assert.equal(checkDecision(priorPacket,prior,'ordinary').kind,'ordinary');
  assert.equal(checkDecision(priorPacket,prior,'mail').kind,'choose');
  assert.equal(checkDecision(raw('',{scope:'undecided'}),'찾는 곳을 모르겠어').kind,'choose');
  assert.equal(checkDecision(raw('',{scope:'general'}),'내 받은편지함에서 메일 찾아줘').kind,'choose');
  const build='이메일 확인 기능 구현해줘';
  assert.equal(checkDecision(raw('',{scope:'general',evidence:[cite('about','이메일 확인 기능')]}),build).kind,'ordinary');
  for(const prompt of ['Find emails about refunds, but search the web for them','Find examples of refund emails from online sources for our new hires']){
    const forged=raw('emails',{terms:['refund']});
    assert.equal(checkDecision(forged,prompt).kind,'choose');
    assert.throws(()=>explicitPlan(forged,prompt),{code:'MAIL_REVIEW'});
  }
});
test('메일의 주제에 들어 있는 웹 위치는 자동 모드와 명시한 메일 검색 모두에서 그대로 찾는다',()=>{
  for(const [prompt,mailRef,topic,source] of [
    ['Find emails about the report we published on the web','emails','report we published on the web',''],
    ['Find emails in my inbox with instructions to search online for order status','emails','instructions to search online for order status','my inbox'],
    ['Find public procurement emails in my inbox about the notice we published on the web','emails','notice we published on the web','my inbox'],
    ['받은편지함에서 웹 검색으로 새로 작성한 보고서 관련 메일 찾아줘','메일','웹 검색으로 새로 작성한 보고서','받은편지함']
  ]){
    const evidence=[cite('about',topic)];if(source)evidence.push(cite('folder',source));
    const packet=raw(mailRef,{evidence,terms:[topic],folder:source?'inbox':''});
    assert.equal(checkDecision(packet,prompt).kind,'mailbox',prompt);
    assert.equal(explicitPlan(packet,prompt).folder,packet.folder,prompt);
  }
});
test('두 폴더가 실제 검색 대상이면 계획을 그대로 쓰고 주제·제외 폴더는 넓히지 않는다',()=>{
  for(const [prompt,ref,boxA,boxB] of [
    ['받은편지함과 보낸편지함의 견적 메일 찾아줘','메일','받은편지함','보낸편지함'],
    ['받은편지함과 보낸편지함 안에서 견적 메일 찾아줘','메일','받은편지함','보낸편지함'],
    ['Search my inbox and sent items for the Acme quote','my inbox','my inbox','sent items'],
    ['Find emails in my inbox about the quote, and in my Sent Items too','emails','my inbox','my Sent Items'],
    ['Find invoice emails in both my Outlook Inbox and Sent Items between November 1 and November 15','emails','my Outlook Inbox','Sent Items']
  ]){
    const period=prompt.includes('November'),ms=prompt.includes('Outlook');
    const packet=raw(ref,{folder:'inbox_sent',provider:ms?'outlook':'',evidence:[cite('folder',boxA),cite('folder',boxB),
      ...(period?[cite('delivered','between November 1 and November 15')]:[])],
      ...(period?{period:'absolute',after:'2026-11-01',before:'2026-11-16'}:{})});
    const at=new Date(2026,10,22);
    assert.equal(checkDecision(packet,prompt,null,at).plan?.folder,'inbox_sent',prompt);
    assert.equal(explicitPlan(packet,prompt,at).folder,'inbox_sent',prompt);
    for(const lesser of ['all','inbox','sent','']){
      assert.equal(checkDecision({...packet,folder:lesser},prompt).kind,'review',prompt);
    }
  }
  const scope='Find emails from HR referring to the messages I sent to Acme';
  const hr=raw('emails',{from:'HR',terms:['Acme'],folder:'received',evidence:[cite('sender','from HR'),cite('about','the messages I sent to Acme')]});
  assert.equal(checkDecision(hr,scope).plan?.folder,'received');
  assert.equal(checkDecision({...hr,folder:'sent'},scope).kind,'review');
  const excluded='Find quote emails in my inbox, but not in my Sent Items';
  const noSent=raw('emails',{terms:['quote'],folder:'inbox',evidence:[cite('folder','my inbox'),cite('exclude','not in my Sent Items')]});
  assert.equal(explicitPlan(noSent,excluded).folder,'inbox');
  for(const wrong of ['all','sent','inbox_sent'])assert.equal(checkDecision({...noSent,folder:wrong},excluded).kind,'review');
  const all='Find emails across all my mail folders about the Sent Items migration';
  assert.equal(explicitPlan(raw('emails',{folder:'all',terms:['migration'],evidence:[cite('folder','all my mail folders'),cite('about','Sent Items migration')]}),all).folder,'all');
});
test('한 번만 나온 실제 근거와 반복된 인용의 순번을 확인하고 서로 겹친 근거는 확인 카드로 돌린다',()=>{
  const prompt='Find emails in my inbox about the inbox migration';
  const packet=raw('emails',{folder:'inbox',terms:['migration'],evidence:[cite('folder','inbox',1),cite('about','inbox',2)]});
  assert.equal(checkDecision(packet,prompt).kind,'mailbox');
  for(const evidence of [[cite('folder','inbox',3)],[cite('folder','inbox',2),cite('about','inbox',2)],[cite('folder','Outbox')],[]]){
    assert.equal(checkDecision({...packet,evidence},prompt).kind,'review');
  }
  assert.equal(checkDecision({...packet,terms:['unrequested']},prompt).review.filter.terms.length,0);
  const unrelated='Find emails about “search the web”';
  assert.equal(checkDecision(raw('emails',{terms:['search the web'],evidence:[cite('about','“search the web”')]}),unrelated).kind,'mailbox');
});
test('발신자와 서비스 이름은 원문 근거에 묶이고 앞 검색 조건은 실제 메일 업무에서만 이어진다',()=>{
  const billing='Find emails from Acme Billing in my inbox';
  const packet=raw('emails',{from:'Acme Billing',folder:'inbox',evidence:[cite('sender','Acme Billing'),cite('folder','my inbox')]});
  assert.equal(explicitPlan(packet,billing).from,'Acme Billing');
  for(const edit of [{from:'Another'},{provider:'outlook'}])assert.equal(checkDecision({...packet,...edit},billing).kind,'review');
  const prompt='그중 Gmail 계약서 메일만',follow=raw('',{terms:['계약서'],provider:'gmail',inherit:true,
    evidence:[cite('provider','Gmail'),cite('followup','그중')]});
  assert.equal(checkDecision(follow,prompt,'mail').kind,'mailbox');
  assert.equal(checkDecision(follow,prompt,'ordinary').kind,'review');
  assert.equal(checkDecision({...follow,clear:['period']},prompt,'mail').kind,'review');
});
test('에게·한테는 받은 메일의 발신자와 보낸 메일의 수신자를 구분한다',()=>{
  for(const [name,particle] of [['김 대리','에게'],['Alice','한테']]){
    const packet=raw('메일',{terms:['견적'],from:name,evidence:[cite('sender',name)]});
    const received=name+particle+' 받은 견적 메일 찾아줘';
    assert.equal(checkDecision(packet,received).plan?.from,name);
    assert.equal(explicitPlan(packet,received).from,name);
    const sent=name+particle+' 보낸 견적 메일 찾아줘';
    const decision=checkDecision(packet,sent);
    assert.equal(decision.kind,'review',sent);
    assert.equal(decision.review.filter.from,'');
    assert.throws(()=>explicitPlan(packet,sent),{code:'MAIL_REVIEW'});
  }
});
test('계정별로 받은편지함과 보낸편지함을 다르게 지정하면 제외한 곳은 검색 제안에서 빠진다',()=>{
  const prompt='Excluding Gmail Inbox, find invoice emails in Outlook Sent Items';
  const packet=raw('emails',{terms:['invoice'],folder:'sent',provider:'all',evidence:[
    cite('exclude','Gmail Inbox'),cite('provider','Gmail'),cite('provider','Outlook'),cite('folder','Sent Items'),cite('about','invoice')
  ]});
  const candidate=checkDecision(packet,prompt);
  assert.equal(candidate.kind,'review');
  assert.deepEqual([candidate.review.filter.provider,candidate.review.filter.folder],['outlook','sent']);
  assert.throws(()=>explicitPlan(packet,prompt),{code:'MAIL_REVIEW'});
});
test('수신과 발신을 잇는 원문의 접속사를 보존하고 메일 주제 속 발신은 검색 범위에서 뺀다',()=>{
  const prompt='Find received and sent emails about the budget';
  const packet=raw('emails',{terms:['budget'],folder:'all',evidence:[cite('folder','received'),cite('folder','sent emails'),cite('about','budget')]});
  assert.equal(checkDecision(packet,prompt).plan?.folder,'all');
  assert.equal(explicitPlan(packet,prompt).folder,'all');
  assert.equal(checkDecision({...packet,folder:'sent'},prompt).review?.filter.folder,'all');
  const topic='Find sent emails about the invoice we received and sent to Finance';
  const wrong=raw('emails',{terms:['invoice'],folder:'all',evidence:[cite('folder','sent emails'),cite('folder','received and sent'),cite('about','invoice')]});
  assert.equal(checkDecision(wrong,topic).review?.filter.folder,'sent');
  const sender='Find emails about the invoice Alice sent me';
  const named=raw('emails',{terms:['invoice'],from:'Alice',evidence:[cite('about','invoice'),cite('sender','Alice')]});
  assert.equal(checkDecision(named,sender).review?.filter.from,'');
  assert.throws(()=>explicitPlan(named,sender),{code:'MAIL_REVIEW'});
  const direct='Find quote emails that Alice sent me';
  assert.equal(explicitPlan(raw('emails',{from:'Alice',terms:['quote'],evidence:[cite('sender','Alice')]}),direct).from,'Alice');
});
test('회원 자신을 뜻하는 대명사를 발신자 이름으로 조회하지 않고 보낸 편지함을 제안한다',()=>{
  for(const [prompt,who,source] of [
    ['Find emails I sent last week','I','I sent'],
    ['Find emails we sent last week','we','we sent'],
    ['제가 보낸 메일 찾아줘','제가','제가 보낸']
  ]){
    const ref=prompt.includes('emails')?'emails':'메일';
    const wrong=raw(ref,{from:who,folder:'received',evidence:[cite('sender',who)]});
    const saved=checkDecision(wrong,prompt).review;
    assert.equal(saved?.filter.from,'',prompt);
    assert.equal(saved?.filter.folder,'sent',prompt);
    assert.throws(()=>explicitPlan(wrong,prompt),{code:'MAIL_REVIEW'});
    const simple=prompt.replace(' last week','');
    assert.equal(explicitPlan(raw(ref,{folder:'sent',evidence:[cite('folder',source)]}),simple).folder,'sent');
  }
});
test('첨부 조건을 풀겠다는 원문일 때만 물려받은 첨부 조건을 해제한다',()=>{
  const prior=combinePlan({...seed,attachment:'has'});
  for(const [prompt,accepted] of [
    ['첨부파일 조건은 빼지 마세요.',false],['발신자 조건만 빼고 다시 찾아줘.',false],
    ['Do not remove the attachment filter.',false],['첨부 조건은 유지하고 사서함은 열지 마세요.',false],
    ['첨부파일 조건은 빼고 첨부파일이 없는 메일만 찾아줘',false],
    ['첨부파일이 없어도 괜찮으니 첨부파일 조건은 빼 주세요.',true],
    ['모든 검색 조건을 초기화해 줘.',true],['기존 검색 조건을 초기화하지 마세요.',false],
    ['첨부 조건을 빼면 안 돼요. 같은 조건으로 다시 찾아줘.',false],
    ['첨부 조건을 빼선 안 돼요. 같은 조건으로 다시 찾아줘.',false],
    ['첨부 조건 해제는 하지 마세요. 같은 조건으로 다시 찾아줘.',false],
    ["You shouldn't remove the attachment filter.",false],["Don't ever remove the attachment filter.",false],
    ['이번엔 첨부파일이 없어도 상관없어요. 같은 조건으로 다시 찾아줘.',true]
  ]){
    const packet=raw('',{inherit:true,clear:['attachment'],evidence:[cite('followup',prompt)]});
    const result=checkDecision(packet,prompt,'mail');
    if(accepted){assert.equal(result.kind,'mailbox',prompt);assert.equal(combinePlan(result.plan,prior).attachment,'');}
    else{
      assert.notEqual(result.kind,'mailbox',prompt);
      assert.throws(()=>explicitPlan(packet,prompt,new Date(),'mail'),{code:'MAIL_REVIEW'});
      if(result.review)assert.equal(combinePlan(result.review.plan,prior).attachment,'has');
    }
  }
  const keep='첨부파일 조건은 그대로 유지해서 다시 찾아줘.';
  const proposal=raw('',{inherit:true,attachment:'has',evidence:[cite('followup',keep)]});
  const kept=checkDecision(proposal,keep,'mail');
  assert.equal(combinePlan(kept.plan,prior).attachment,'has');
  assert.equal(combinePlan(kept.plan,combinePlan(seed)).attachment,'');
  const reminder='첨부파일이 없어도 괜찮다는 뜻은 아니니 첨부파일 조건은 빼지 마세요.';
  const unchanged=raw('',{inherit:true,evidence:[cite('followup',reminder)]});
  assert.notEqual(checkDecision(unchanged,reminder,'mail').kind,'mailbox');
  assert.equal(combinePlan(explicitPlan(unchanged,reminder,new Date(),'mail'),prior).attachment,'has');
  for(const prompt of ['그중 견적 메일을 검색하지 마세요.','위 보고서에서 견적 금액만 다시 찾아줘.','첨부 조건은 유지하고 사서함은 열지 마세요.']){
    const mistaken=raw('',{inherit:true,evidence:[cite('followup',prompt)]});
    assert.notEqual(checkDecision(mistaken,prompt,'mail').kind,'mailbox',prompt);
    assert.throws(()=>explicitPlan(mistaken,prompt,new Date(),'mail'),{code:'MAIL_REVIEW'});
  }
});
test('후속 요청에서 각 조건의 변경과 새 첨부 조건을 독립적으로 적용한다',()=>{
  const previous=combinePlan({...seed,from:'Alice',attachment:'has'});
  const reset='첨부 조건만 초기화하고 다시 찾아줘.';
  const wrong=raw('',{inherit:true,clear:['attachment','from'],evidence:[cite('followup',reset)]});
  const review=checkDecision(wrong,reset,'mail').review;
  assert.ok(review);
  assert.deepEqual(review.plan.clear,['attachment']);
  assert.equal(combinePlan(review.plan,previous).from,'Alice');
  assert.throws(()=>explicitPlan(wrong,reset,new Date(),'mail'),{code:'MAIL_REVIEW'});
  const cleared=explicitPlan({...wrong,clear:['attachment']},reset,new Date(),'mail');
  assert.deepEqual([combinePlan(cleared,previous).from,combinePlan(cleared,previous).attachment],['Alice','']);
  const request='첨부파일이 있는 메일만 다시 찾아줘. 앞으로도 이 첨부 조건은 유지해 줘.';
  const packet=raw('메일',{inherit:true,attachment:'has',evidence:[cite('attachment','첨부파일이 있는'),cite('followup','이 첨부 조건은 유지해 줘')]});
  const newPlan=checkDecision(packet,request,'mail');
  assert.equal(newPlan.kind,'mailbox');
  assert.equal(combinePlan(newPlan.plan,combinePlan(seed)).attachment,'has');
  const again='첨부 조건은 유지하고 같은 조건으로 다시 찾아줄래요?';
  const keep=checkDecision(raw('',{inherit:true,evidence:[cite('followup',again)]}),again,'mail');
  assert.equal(keep.kind,'mailbox');assert.equal(combinePlan(keep.plan,previous).attachment,'has');
  for(const later of ['Keep the attachment filter. Search again.','Keep the attachment filter.\n  Search again.']){
    const result=checkDecision(raw('',{inherit:true,evidence:[cite('followup',later)]}),later,'mail');
    assert.equal(result.kind,'mailbox');assert.equal(combinePlan(result.plan,previous).attachment,'has');
  }
  for(const [sentence,field] of [['모든 발신자','from'],['키워드 없이','terms'],['기간 제한은 빼','period']]){
    const request=raw('',{inherit:true,clear:[field],evidence:[cite('followup',sentence)]});
    assert.deepEqual(explicitPlan(request,sentence,new Date(),'mail').clear,[field],sentence);
  }
});
test('서로 다른 표기로 적은 두 달 사이에서 한쪽 끝만 제시한 계획은 검색하지 않는다',()=>{
  const today=new Date(2026,10,22);
  for(const first of ['March 19','19 March','2026-03-19']){
    const bounds='between '+first+' and 20 may';
    const prompt='Find quote emails received '+bounds+' about the fee.';
    const packet=raw('emails',{terms:['quote'],period:'absolute',after:'2026-03-19',before:'2026-05-21',evidence:[cite('delivered',bounds)]});
    assert.equal(checkDecision(packet,prompt,null,today).kind,'mailbox');
    assert.equal(explicitPlan(packet,prompt,today).before,'2026-05-21');
    const partial={...packet,before:'2026-03-21',evidence:[cite('delivered','between '+first+' and 20')]};
    assert.equal(checkDecision(partial,prompt,null,today).kind,'review');
    assert.throws(()=>explicitPlan(partial,prompt,today),{code:'MAIL_REVIEW'});
  }
});
test('메일 주제의 덧붙임과 따옴표 속 검색어는 실제 폴더와 발신자를 바꾸지 않는다',()=>{
  const topic='Find sent emails about the invoice, the one we received and sent back';
  const wrong=raw('emails',{terms:['invoice'],folder:'all',evidence:[
    cite('folder','sent emails'),cite('folder','received'),cite('folder','sent back'),cite('about','invoice')
  ]});
  const review=checkDecision(wrong,topic).review;
  assert.equal(review?.filter.folder,'sent');
  assert.throws(()=>explicitPlan(wrong,topic),{code:'MAIL_REVIEW'});
  const quoted='Search for "about the budget" in the emails that Alice sent me';
  const valid=raw('emails',{terms:['about the budget'],from:'Alice',evidence:[cite('about','about the budget'),cite('sender','Alice')]});
  assert.equal(checkDecision(valid,quoted).plan?.from,'Alice');
  assert.equal(explicitPlan(valid,quoted).from,'Alice');
  const fronted=raw('emails',{terms:['contract'],from:'Alice',evidence:[cite('about','contract'),cite('sender','Alice')]});
  for(const prompt of ['Regarding the contract, show me the emails Alice sent me','Concerning the contract, pull up the emails Alice sent me',
    'Regarding the contract, could you please show me the emails Alice sent me','Regarding the contract, give me the emails Alice sent me',
    'Regarding the contract, show me, please, the emails Alice sent me',
    'Regarding the contract, I need the emails Alice sent me',
    'Also, regarding the contract, show me the emails Alice sent me','Regarding the contract, the one Bob drafted, show me the emails Alice sent me',
    'Regarding the contract, the one we received and sent back, show me the emails Alice sent me']){
    assert.equal(checkDecision(fronted,prompt).plan?.from,'Alice');
    assert.equal(explicitPlan(fronted,prompt).from,'Alice');
  }
  const proposed=raw('emails',{terms:['deposit'],from:'Alice',evidence:[cite('about','deposit'),cite('sender','Alice')]});
  for(const words of ['the one Alice sent me','the draft Alice sent me','the draft that Alice sent me',
    'the one with shipping costs, list-price changes, and the terms Alice sent me',
    'the one with shipping costs, list prices, and the terms Alice sent me']){
    const apposition='Regarding the contract, '+words+', find the emails about the deposit';
    const card=checkDecision(proposed,apposition).review;
    assert.equal(card?.filter.from,'');
    assert.deepEqual(card.roleChoices,[{field:'from',quote:'Alice',value:'Alice'}]);
    assert.throws(()=>explicitPlan(proposed,apposition),{code:'MAIL_REVIEW'});
  }
});
test('가격·협상 설명과 실제 찾을 메일을 구분하고, 정해지지 않은 역할은 회원이 직접 고른다',()=>{
  const prompt='Regarding the negotiations, the ones with shipping costs, give and take in the messages Alice sent me, and revised payment terms, find the emails about the deposit';
  const packet=raw('emails',{terms:['deposit'],from:'Alice',folder:'sent',
    evidence:[cite('about','deposit'),cite('sender','Alice'),cite('folder','sent me')]});
  const card=checkDecision(packet,prompt).review;
  assert.deepEqual(card.filter.terms,['deposit']);assert.equal(card.filter.from,'');
  assert.deepEqual(card.roleChoices,[{field:'from',quote:'Alice',value:'Alice'},{field:'folder',quote:'sent me',value:'sent'}]);
  assert.throws(()=>explicitPlan(packet,prompt),e=>e.code==='MAIL_REVIEW'&&e.review.roleChoices.length===2);
  const correct={...packet,folder:'',from:'',evidence:[cite('about','deposit')]};
  assert.deepEqual(checkDecision(correct,prompt).plan.terms,['deposit']);
  const missingRole={...correct,from:'Alice'};
  assert.deepEqual(checkDecision(missingRole,prompt).review?.roleChoices,[{field:'from',quote:'Alice',value:'Alice'}]);
  const missingFolder=raw('emails',{terms:['deposit'],folder:'inbox',evidence:[cite('about','deposit')]});
  const folderReview=checkDecision(missingFolder,'Find emails about the deposit in my inbox').review;
  assert.deepEqual(folderReview?.roleChoices,[{field:'folder',quote:'inbox',value:'inbox'}]);
  const unsupportedFolder={...correct,folder:'sent'};
  assert.deepEqual(checkDecision(unsupportedFolder,prompt).review?.roleChoices,[{field:'folder',quote:'sent me',value:'sent'}]);
  const noDirection='Find emails about the deposit';
  assert.deepEqual(checkDecision(unsupportedFolder,noDirection).review?.roleChoices,[{field:'folder',quote:noDirection,value:'sent'}]);
});
test('메일 후속과 명시 검색에서 what Alice sent me의 발신자를 유지한다',()=>{
  const prompt='Regarding the contract, show me what Alice sent me';
  const packet=raw('',{terms:['contract'],from:'Alice',evidence:[cite('about','contract'),cite('sender','Alice')]});
  assert.equal(checkDecision(packet,prompt,'ordinary').kind,'choose');
  assert.equal(checkDecision(packet,prompt,'mail').plan?.from,'Alice');
  assert.equal(explicitPlan(packet,prompt).from,'Alice');
  const mixed=prompt+'; search the web too';
  assert.equal(checkDecision(packet,mixed,'mail').kind,'choose');
});
test('영어로 제외한 사람이나 별도로 요청한 자료의 작성자를 찾을 메일의 발신자로 쓰지 않는다',()=>{
  const negative='Regarding the contract, show me what Bob sent me, not what Alice sent me';
  const other='Regarding the negotiations, show me the slide deck Alice sent me, then find the emails about the deposit';
  const alice=raw('',{from:'Alice',evidence:[cite('sender','Alice')]});
  const bob={...alice,from:'Bob',evidence:[cite('sender','Bob')]};
  assert.equal(checkDecision(bob,negative,'mail').plan?.from,'Bob');
  assert.equal(explicitPlan(bob,negative).from,'Bob');
  assert.notEqual(checkDecision(alice,negative,'mail').kind,'mailbox');
  assert.throws(()=>explicitPlan(alice,negative),{code:'MAIL_REVIEW'});
  const deposit=raw('emails',{terms:['deposit'],evidence:[cite('about','deposit')]});
  const combined={...deposit,from:'Alice',evidence:[...deposit.evidence,cite('sender','Alice')]};
  for(const previous of [null,'ordinary','mail']){
    assert.deepEqual(checkDecision(deposit,other,previous).plan?.terms,['deposit']);
    const review=checkDecision(combined,other,previous).review;
    assert.deepEqual(review?.filter.terms,['deposit']);assert.equal(review.filter.from,'');
    assert.deepEqual(review.roleChoices,[{field:'from',quote:'Alice',value:'Alice'}]);
  }
  assert.throws(()=>explicitPlan(combined,other),{code:'MAIL_REVIEW'});
});
test('메일을 가리키는 영어 후속 요청은 곧장 읽고 별도의 자료에서 온 발신자는 확인한다',()=>{
  const topic=cite('about','contract'),sender=cite('sender','Alice');
  const filters={terms:['contract'],from:'Alice',folder:'received',evidence:[topic,sender]};
  for(const [text,ref] of [['please check the invoices Alice sent me','the invoices Alice sent me'],
    ['show me the mails Alice sent me','mails'],['the one we received and sent back, summarize the emails Alice sent me','the emails']]){
    const prompt='Regarding the contract, '+text,packet=raw(ref,filters);
    assert.equal(checkDecision(packet,prompt,'mail').plan?.from,'Alice',prompt);
    assert.equal(explicitPlan(packet,prompt).from,'Alice');
    if(ref!=='the invoices Alice sent me')assert.equal(checkDecision(packet,prompt).plan?.from,'Alice');
  }
  const two='Regarding the negotiations, check the invoices Alice sent me, then find the emails about the deposit';
  const wrong=raw('emails',{terms:['deposit'],from:'Alice',evidence:[cite('about','deposit'),sender]});
  assert.equal(checkDecision(wrong,two,'mail').review?.filter.from,'');
  const directions='Hi, about the budget, show me everything I received and sent';
  const folders=raw('everything I received and sent',{terms:['budget'],folder:'all',
    evidence:[cite('about','budget'),cite('folder','received'),cite('folder','sent')]});
  assert.equal(checkDecision(folders,directions,'mail').plan?.folder,'all');
  assert.equal(checkDecision(folders,directions).kind,'choose');
});
test('메일 내용의 작성자와 보낸 사람을 구별하고 실제로 지정한 메일함만 조회한다',()=>{
  const text='Show me what Alice wrote in the email Bob sent me';
  const bob=raw('the email',{from:'Bob',evidence:[cite('sender','Bob')]});
  assert.equal(checkDecision(bob,text).plan?.from,'Bob');
  const author={...bob,from:'Alice',evidence:[cite('sender','Alice')]};
  assert.equal(checkDecision(author,text).review?.filter.from,'');
  assert.throws(()=>explicitPlan(author,text),{code:'MAIL_REVIEW'});
  const authored='Show me what Alice wrote to me in the email Bob sent me';
  assert.equal(checkDecision(bob,authored).plan?.from,'Bob');
  assert.equal(checkDecision(author,authored).review?.filter.from,'');
  const single='Regarding the price list, show me the emails Alice sent me';
  const listed=raw('the emails',{from:'Alice',terms:['price list'],evidence:[cite('sender','Alice'),cite('about','price list')]});
  assert.deepEqual(checkDecision(listed,single).plan?.terms,['price list']);
  const invoices=raw('the invoices',{from:'Alice',evidence:[cite('sender','Alice')]});
  const bill=explicitPlan(invoices,'Please check the invoices Alice sent');
  assert.equal(bill.from,'Alice');assert.deepEqual(bill.terms,['invoices']);
  const deposit=raw('the emails',{terms:['deposit'],evidence:[cite('about','deposit')]});
  for(const instruction of [
    'Find the emails about the deposit, then show me the invoices Alice sent me',
    'Show me the invoices Alice sent me, then find the emails about the deposit']){
    const mixed={...deposit,from:'Alice',evidence:[...deposit.evidence,cite('sender','Alice')]};
    assert.equal(checkDecision(mixed,instruction).review?.filter.from,'',instruction);
    assert.deepEqual(checkDecision(deposit,instruction).plan?.terms,['deposit']);
    assert.throws(()=>explicitPlan(mixed,instruction),{code:'MAIL_REVIEW'});
  }
  const samples=[
    ['Regarding the contract, please check the invoices Alice sent me in Gmail','the invoices Alice sent me'],
    ['Regarding the contract, show me the Gmail messages Alice sent me','Gmail messages'],
    ['Search Gmail instead of Outlook for messages from Alice','messages'],
    ['Search in Gmail instead of Outlook for messages from Alice','messages']
  ];
  for(const [instruction,mailRef] of samples){
    const packet=raw(mailRef,{from:'Alice',provider:'gmail',evidence:[cite('sender','Alice'),cite('provider','Gmail')]});
    const plan=checkDecision(packet,instruction).plan;
    assert.deepEqual([plan?.from,plan?.provider],['Alice','gmail'],instruction);
    assert.equal(explicitPlan(packet,instruction).provider,'gmail');
    assert.notEqual(checkDecision({...packet,provider:'outlook'},instruction).kind,'mailbox');
  }
});
test('날짜 뒤의 수식어와 메일을 주어로 한 조동사 구문을 구분하고 불분명한 기간은 직접 고른다',()=>{
  const today=new Date(2026,10,22);
  for(const [prompt,citation,end,shouldRun] of [
    ['Find quote emails received from 19 March to 20 may mentioning the fee.','from 19 March to 20 may','2026-05-21',true],
    ['Find quote emails received from 19 March to 20 may mentioning the fee.','from 19 March to 20','2026-03-21',false],
    ['The quote emails I received between 19th March and 20th may in fact be about the fee. Find them.','between 19th March and 20th','2026-03-21',true],
    ['The quote emails I received between 19th March and 20th may in fact be about the fee. Find them.','between 19th March and 20th may','2026-05-21',false],
    ["The amounts in the quote emails I've received between 19th March and 20th may exceed our budget. Find those emails.",'between 19th March and 20th may','2026-05-21',false],
    ['The quote emails I received between Mar. 19th and 20th may still contain the fee. Find them.','between Mar. 19th and 20th','2026-03-21',true],
    ['The quote emails I received between 19th March and 20th may about the fee are the ones I need. Find them.','between 19th March and 20th may','2026-05-21',true],
    ['The quote emails I received between 19th March and 20th may about the fee are the ones I need. Find them.','between 19th March and 20th','2026-03-21',false],
    ['Find quote emails received from 19 March to 20 may perhaps explain the fee.','from 19 March to 20','2026-03-21',false],
    ['Find quote emails received from 19 March to 20 may perhaps explain the fee.','from 19 March to 20 may','2026-05-21',false]
  ]){
    const packet=raw('emails',{terms:['quote'],period:'absolute',after:'2026-03-19',before:end,evidence:[cite('delivered',citation)]});
    const decision=checkDecision(packet,prompt,null,today);
    if(shouldRun){assert.equal(decision.plan?.before,end,prompt);assert.equal(explicitPlan(packet,prompt,today).before,end);}
    else{assert.equal(decision.kind,'review',prompt);assert.throws(()=>explicitPlan(packet,prompt,today),{code:'MAIL_REVIEW'});}
  }
});
test('내가 작성한 메일의 발신자를 확인할 때 회원이 지정한 받은편지함과 제외 범위를 지킨다',()=>{
  const prompt='Find emails from me in my inbox. Leave Sent Items out.';
  const packet=raw('emails',{folder:'inbox',from:'me',evidence:[cite('sender','me'),cite('folder','my inbox'),cite('exclude','Leave Sent Items out')]});
  const review=checkDecision(packet,prompt).review;
  assert.equal(review?.filter.from,'');
  assert.equal(review?.filter.folder,'inbox');
  assert.throws(()=>explicitPlan(packet,prompt),{code:'MAIL_REVIEW'});
});
test('첨부 조건 뒤 본동사가 있는 문장의 may는 두 기간 모두 회원이 고른 뒤에만 쓴다',()=>{
  const today=new Date(2026,10,22),range='between 19th March and 20th';
  const prompt='The quote emails I received '+range+' may with attachments have the fee details. Find them.';
  for(const [before,quote] of [['2026-03-21',range],['2026-05-21',range+' may']]){
    const packet=raw('emails',{terms:['quote'],period:'absolute',after:'2026-03-19',before,attachment:'has',
      evidence:[cite('delivered',quote),cite('attachment','with attachments')]});
    const review=checkDecision(packet,prompt,null,today).review;
    assert.equal(review?.requiresPeriodChoice,true);assert.equal(review.filter.attachment,'has');
    assert.throws(()=>explicitPlan(packet,prompt,today),{code:'MAIL_REVIEW'});
  }
});
test('영어 날짜 뒤에 정형 동사가 오면 5월을 기간의 끝에 포함한다',()=>{
  const today=new Date(2026,10,22),range='between 19th March and 20th';
  for(const clause of ['are the ones I need','were the ones I needed','had the original quote']){
    const prompt="The emails I've received "+range+' may '+clause+'. Find them.';
    const end=raw('emails',{period:'absolute',after:'2026-03-19',before:'2026-05-21',
      evidence:[cite('delivered',range+' may')]});
    const short={...end,before:'2026-03-21',evidence:[cite('delivered',range)]};
    assert.equal(checkDecision(end,prompt,null,today).plan?.before,'2026-05-21');
    assert.equal(explicitPlan(end,prompt,today).before,'2026-05-21');
    assert.equal(checkDecision(short,prompt,null,today).review?.requiresPeriodChoice,true);
    assert.throws(()=>explicitPlan(short,prompt,today),{code:'MAIL_REVIEW'});
  }
});
test('현재 응답 형식이 아닌 계획은 확인 전까지 실행하지 않고 기존 영수증의 필터는 그대로 읽는다',()=>{
  const prompt='견적 메일 찾아줘',legacy={...seed,terms:['견적'],scope:'mailbox',mailRef:'메일',otherRef:''};
  assert.equal(checkDecision(legacy,prompt).kind,'review');
  assert.throws(()=>explicitPlan(legacy,prompt),{code:'MAIL_REVIEW'});
  assert.equal(combinePlan({...seed,folder:'all'}).folder,'all');
  assert.equal(combinePlan({...seed,folder:'inbox_sent'}).folder,'inbox_sent');
});
test('실제 모델에서 관찰한 계정 이름 단독·인용된 안내·웹과 앞 답변은 각각 한 번에 맞는 경로로 간다',()=>{
  const bare=raw('Gmail',{provider:'gmail',evidence:[cite('provider','Gmail')]});
  for(const prompt of ['Gmail.','Gmail!','My Gmail account']){
    assert.equal(checkDecision(bare,prompt).kind,'review');
    assert.throws(()=>explicitPlan(bare,prompt),{code:'MAIL_REVIEW'});
  }
  const quoted='내 받은편지함에서 “웹에서 배송 상황을 확인하세요”라고 안내한 메일을 찾아줘.';
  const actual=raw(quoted,{terms:['웹에서 배송 상황을 확인하세요'],folder:'inbox',
    evidence:[cite('folder','받은편지함'),cite('about','웹에서 배송 상황을 확인하세요')]});
  assert.equal(checkDecision(actual,quoted).kind,'mailbox');
  const prompt='From the response above, collect the entries labelled as customer service email addresses.';
  const prior=raw('',{scope:'prior_result',otherRef:'the response above',terms:['customer service email addresses'],evidence:[cite('about','customer service email addresses')]});
  assert.equal(checkDecision(prior,prompt,'ordinary').kind,'ordinary');
});
test('Gmail 머리말 조회가 실패할 때 별도의 발췌 요청을 남기지 않는다',async()=>{
  const asked=[];
  const fetch=async raw=>{
    const u=new URL(raw);asked.push(u.searchParams.get('format')||'list');
    return u.pathname.endsWith('/messages')?ok({messages:[{id:'a5'}]}):new Response('{}',{status:404});
  };
  const r=await searchMailbox({provider:'gmail',access:'fixture',plan:combinePlan(seed),fetch});
  assert.equal(r.code,'MAIL_NOT_FOUND');assert.deepEqual(asked,['list','metadata']);
});
test('사람이 직접 확인한 일곱 조건만 실행에 쓰고 공급자 연산자를 끼워넣은 값은 받지 않는다',()=>{
  const {reviewFilter}=require('../src/office-mail-api.cjs');
  const filter={terms:['견적'],from:'',after:'2026-11-01',before:'2026-12-01',folder:'inbox_sent',provider:'gmail',attachment:'has'};
  const accepted=reviewFilter(filter);
  assert.equal(accepted.folder,'inbox_sent');assert.equal(accepted.inherit,false);
  for(const change of [{scope:'mailbox'},{terms:['in:anywhere']},{after:'2026-02-30'},{folder:''},{provider:''},{attachment:'filename'}])
    assert.throws(()=>reviewFilter({...filter,...change}),{code:'MAIL_PLAN'});
});
test('Outlook의 대소문자가 다른 공식 정적 폴더 경로를 따르고 같은 메시지의 원문은 한 건만 센다',async()=>{
  const q=combinePlan({...seed,folder:'inbox'}),next='https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages?$skiptoken=b';
  const m=id=>({id,subject:id,receivedDateTime:'2026-11-11T08:00:00Z',webLink:'https://outlook.office.com/mail/inbox/id/'+id});
  const calls=[];
  const fetch=async raw=>{const u=new URL(raw);calls.push(u.href);return ok(u.searchParams.has('$skiptoken')?{value:[m('first'),m('second'),m('second')]}:{value:[m('first')],'@odata.nextLink':next});};
  const r=await searchMailbox({provider:'outlook',access:'fixture',plan:q,fetch});
  assert.deepEqual(r.items.map(x=>x.subject),['first','second']);assert.deepEqual(calls.slice(1),[next]);assert.equal(r.more,false);assert.equal(r.code,undefined);
});
test('Outlook 다음 페이지는 같은 사서함 정적 경로의 상대 주소만 따라간다',async()=>{
  const plan=combinePlan({...seed,folder:'inbox'}),prefix='https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages';
  const first={id:'m1',subject:'one',receivedDateTime:'2026-11-10T09:00:00Z'};
  for(const next of ['?page=2','/v1.0/me/mailfolders/inbox/messages?page=2','/v1.0/me/mail%46olders/inbox/messages?page=2']){
    const calls=[];
    const fetch=async raw=>{calls.push(String(raw));return ok(calls.length===1?{value:[first],'@odata.nextLink':next}:{value:[first,{...first,id:'m2',subject:'two'}]});};
    const result=await searchMailbox({provider:'outlook',access:'fixture',plan,fetch});
    assert.deepEqual(result.items.map(i=>i.subject),['one','two']);assert.equal(calls.length,2);assert.equal(result.code,undefined);
  }
  for(const next of ['http://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages','https://graph.microsoft.com./v1.0/me/mailFolders/inbox/messages',
    'https://name@graph.microsoft.com/v1.0/me/mailFolders/inbox/messages','https://example.test/a','/v1.0/users/b/messages',prefix+'/m1',
    '/v1.0/me/mailFolders/sentitems/messages','/v1.0/me/mailFolders/other/%2e%2e/inbox/messages','/v1.0/me/mailFolders%2finbox/messages','#other']){
    let count=0;const fetch=async()=>{count++;return ok({value:[first],'@odata.nextLink':next});};
    const result=await searchMailbox({provider:'outlook',access:'fixture',plan,fetch});
    assert.equal(count,1,next);assert.equal(result.items.length,1);assert.equal(result.code,'MAIL_NETWORK');assert.equal(result.more,true);
  }
});
test('Outlook 받은 메일 폴더 조회가 실패하면 다른 폴더 요청을 남기지 않는다',async()=>{
  const calls=[];const fetch=async raw=>{
    const u=new URL(raw);calls.push(u.pathname);
    return u.pathname.endsWith('/messages')?ok({value:[{id:'one'}]}):new Response('{}',{status:500});
  };
  await assert.rejects(searchMailbox({provider:'outlook',access:'fixture',plan:combinePlan(seed),fetch}),{code:'MAIL_NETWORK'});
  assert.deepEqual(calls,['/v1.0/me/messages','/v1.0/me/mailFolders/deleteditems']);
});
