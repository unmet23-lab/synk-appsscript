'use strict';

const money=/[$€£₩]\s*\d[\d,.]*|(?:\d[\d,.]*\s*(?:만|천|억)?\s*(?:원|달러|유로|USD|KRW|EUR))/gi;
const confirming=/희망|예산|말씀|요청|기준|맞으|맞나|맞을|확인|budget|target|requested|confirm/i;
const promisedPrice=/견적(?:은|이|가|으로)|(?:총액|단가|가격|금액)(?:은|이|는)|할인해\s*드|청구하|our (?:price|quote)|we (?:charge|offer)|will cost|price (?:is|will be)/i;
const promisedDelivery=/(?:납품|배송|발송|완료|도착)(?:을|이|은|는)?\s*(?:(?:보장|확약|약속)|(?:해\s*드리|하겠|합니다|가능합니다|가능합니|해\s*드릴게|됩니다))|\b(?:we (?:will|can|shall) (?:deliver|ship|complete)|(?:delivery|turnaround) (?:is guaranteed|is confirmed|will be))\b/i;
function ungrounded(draft,source){
  const normalize=s=>s.toLowerCase().replace(/[\s,]/g,'');
  const budget=new Set((source.match(money)||[]).map(normalize));
  return draft.split(/(?<=[.!?。？])\s+|\n/).some(line=>{
    if(promisedDelivery.test(line))return true;
    const amounts=line.match(money)||[];
    if(!amounts.length)return false;
    return amounts.some(a=>!budget.has(normalize(a)))||!confirming.test(line)||promisedPrice.test(line)&&!/[?？]/.test(line);
  });
}
function acknowledgement(evidence){
  return /[가-힣]/.test(evidence)
    ?'문의 주셔서 감사합니다. 보내주신 조건을 확인했습니다. 견적에 꼭 포함해야 할 사항이 더 있으면 알려주세요. 확인한 내용을 바탕으로 견적을 준비하겠습니다.'
    :'Thank you for your enquiry. I have received your requirements. If there is anything else the quote should include, please let me know so I can prepare it.';
}
module.exports={ungrounded,acknowledgement};
