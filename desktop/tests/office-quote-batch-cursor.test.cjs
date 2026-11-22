'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {scanQuotes}=require('../src/office-quote-providers.cjs');
const {addRecipients}=require('../src/office-quote-cards.cjs');
const {quoteMailbox}=require('./fixtures/office-quote-mail.cjs');

for(const provider of ['gmail','outlook'])for(const failAt of [12,28]){
  test(provider+' 견적 30건 중 '+failAt+'번째 원문을 한 번 못 읽어도 모두 한 번씩 인계한다',async()=>{
    const mailbox=quoteMailbox(provider),messages=[];
    for(let index=0;index<30;index++){
      messages.push(mailbox.add((4096+index).toString(16),'책자 견적 '+(index+1),'책자 30부 인쇄 견적을 부탁드립니다.'));
    }
    const failedThread=messages[failAt-1].thread,fetch=mailbox.context.fetch;
    let faultPending=true,start=null;
    let lookup=[];
    const context={...mailbox.context,fetch:async(raw,options)=>{
      const url=new URL(raw);
      const id=provider==='gmail'?url.pathname.match(/\/threads\/([0-9a-f]+)$/)?.[1]:
        url.searchParams.get('$filter')?.match(/^conversationId eq '([^']+)'$/)?.[1];
      if(id)lookup.push(id);
      if(id===failedThread&&faultPending){faultPending=false;return Response.json({error:'temporary'},{status:503});}
      return fetch(raw,options);
    }};
    const binding={provider,id:randomUUID(),lineage:randomUUID()},ledger=[],batches=[];
    do{
      assert.ok(batches.length<4,'cursor must advance after the transient error');
      const known=new Set(ledger.filter(row=>row.quoteOrigin).map(row=>row.id));
      lookup=[];
      const result=await scanQuotes({...context,known,start});
      const parent={id:randomUUID(),departmentId:'office',status:'completed',quoteHandoff:true,createdAt:batches.length+1,
        mailReceipt:{quoteHandoff:true,bindings:[binding],groups:[{provider,...result}]}};
      const added=addRecipients(ledger,parent,parent.createdAt,false);
      const handedOff=ledger.filter(row=>row.quoteOrigin&&added.includes(row.id)).map(row=>row.id);
      batches.push({result,lookedUp:lookup.slice(),handedOff});
      if(!result.more)break;
      assert.ok(result.cursor);start=result.cursor;
    }while(true);
    const [first,second,third]=batches;
    if(failAt===12){
      assert.equal(first.result.code,'MAIL_NETWORK');
      assert.equal(first.result.cursor.id,failedThread);
      assert.equal(second.lookedUp[0],failedThread);
      assert.deepEqual(batches.map(batch=>batch.handedOff.length),[24,6]);
    }else{
      assert.equal(first.result.code,undefined);
      assert.equal(first.result.cursor.id,messages[24].thread);
      assert.equal(first.lookedUp.at(-1),messages[24].thread);
      assert.ok(!first.lookedUp.includes(failedThread));
      assert.equal(second.lookedUp[0],messages[24].thread);
      assert.equal(second.result.code,'MAIL_NETWORK');
      assert.equal(second.result.cursor.id,failedThread);
      assert.equal(third.lookedUp[0],failedThread);
      assert.deepEqual(batches.map(batch=>batch.handedOff.length),[24,5,1]);
    }
    assert.equal(faultPending,false);
    const issued=batches.flatMap(batch=>batch.handedOff);
    assert.equal(issued.length,30);assert.equal(new Set(issued).size,30);
    const evidence=new Set(batches.flatMap(batch=>batch.result.items.map(item=>item.messageId)));
    assert.deepEqual(evidence,new Set(messages.map(message=>message.id)));
  });
}
