'use strict';

const { createHash } = require('node:crypto');

const ASK = /[?？]|부탁|요청|문의|궁금|주세|주시|주실|알려|보내\s*주|바랍니다|필요합니다|가능할까|가능한가|얼마|어떻게\s*되|싶(?:습니다|어요|은데)|희망합니다|please|could you|can you|would (?:you|like)|(?:i|we)['’]d like|how much|how many|request|looking for/i;
const PRICE = /견적|단가|제작비|비용|가격|요금|예산|얼마|quotation|\bRFQ\b|\bquotes?\b|\bestimates?\b|\bpric(?:e|es|ing)\b|how much|\bbudget\b/i;
const CHANGE = /수량|납기|일정|기한|옵션|추가|포함|제외|반영|대신|수정|버전|변경|납품|부가세|세금|할인|배송|늘리|줄이|바꾸|며칠|몇\s*(?:개|편)|quantit|deadline|deliver|instead|revis|discount|units?|another|includ/i;
const NUDGE = /어떻게\s*(?:됐|되었|되나|될까)|진행\s*상황|답장\s*기다|다시\s*문의|(?:확인|회신|답장)\s*(?:부탁|기다)|follow[ -]?up|any update|please (?:confirm|respond)/i;
const CANCEL = /견적.{0,18}(?:필요\s*없|필요하지\s*않|취소|철회)|(?:요청|문의).{0,8}(?:취소|철회)|보류\s*(?:중(?:입니다|이에요)?|합니다|하겠습니다|하기로\s*했습니다|해\s*주세요)[.!。…\s]*$|진행하지\s*않|다른\s*업체로\s*결정|no longer (?:need|require)|withdraw (?:my|our) request/i;
const AUTO = /^(?:(?:re|fw|fwd)\s*:\s*)*(?:자동\s*회신|부재중|배송\s*알림|인증\s*코드|automatic reply|out of office|delivery status|verification code)/i;
const SUPPORT = /참고\s*(?:파일|자료)|(?:자료|파일).{0,10}첨부|for (?:your )?reference/i;
const ACK = /(?:요청|문의|견적서?).{0,6}(?:받았|받았습니다|수신했|접수했|확인했)|(?:견적|금액|수량|일정).{0,18}(?:확정했습니다|결제했습니다)|(?:received|acknowledge) (?:the|your) (?:quote|request)/i;
const OFFER = /견적서?(?:를|을)?\s*(?:(?:첨부|송부|전달)(?:하여|해)?\s*(?:드립|드렸|합니다|했습|했어|합니)|보내\s*드|보냅)|(?:attached|enclosed) (?:is |our |the |your )*(?:estimate|quot(?:ation|e))\b(?!\s+(?:request|inquir|brief|specification))/i;
const STATED_PRICE = /(?:견적|단가|금액|총액|비용|가격)(?:은|는|이|가)\s*[\d,.]+\s*(?:만|천)?\s*원(?:입니다|이에요|으로)|our (?:quote|price) (?:is|comes to)\s*[$£€\d]/i;
const BILL = /(?:요금|청구|결제)\s*(?:은|는|액|금액)?.{0,25}[\d,]+\s*원.{0,80}(?:고객\s*센터|문의처)|(?:문의|질문)(?:는|은)\s*(?:고객\s*센터|상담센터)/is;
const NO_REQUEST = /(?:견적|추가|가격|비용|문의|요청).{0,14}(?:문의|요청)?\s*(?:없이|없습니다|없어요|없네요|필요하지\s*않|필요\s*없)|(?:견적|가격).{0,14}(?:문의|요청)에?\s*(?:감사|고맙)|no (?:further )?(?:inquir|question|quote|request)|thank (?:you|you all) for (?:your|the) (?:inquiry|request)/i;
const DECLINES_QUOTE = /(?:견적서?|가격|단가)(?:을|를|은|는|도)?\s*(?:받(?:아\s*보)?고|알고)\s*싶지(?:는|도|가)?\s*(?:않|못)/;
const HOLDS_DETAIL = /(?:배송|수령|납품|결제|발송|시안)(?:만|을|를|은|는)?\s*(?:(?:지금은|당분간|잠시)\s*)?보류/;
const REPLY_SUBJECT = /^(?:(?:re|fw|fwd|답장|전달|회신)\s*(?:\[\d+\])?\s*[:：]\s*)+/i;
const addresses = s => (String(s || '').toLowerCase().match(/[^\s<>(),;:@"']+@[^\s<>(),;:@"']+/g) || []);
const clean = (s, max = 800) => String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, ' ').trim().slice(0,max);
function authoredText(raw) {
  const kept = [];
  for (const line of clean(raw, 24000).split(/\r?\n/)) {
    if (/^\s*(?:-{2,}\s*(?:Original Message|Forwarded message|원본\s*메일|전달된\s*메일)|--\s*$|Begin forwarded message:)/i.test(line)) break;
    if (/^\s*(?:From|보낸\s*사람|발신자)\s*[:：]/i.test(line) || /^\s*On .{1,350} wrote:\s*$/i.test(line)) break;
    if (!/^\s*>/.test(line)) kept.push(line);
  }
  return kept.join('\n').replace(/https?:\/\/\S+|please (?:consider the environment|do not print)[^\n]*/gi,' ').trim();
}
function excerpt(body,limit=850) {
  const text=body.replace(/\s+/g,' ').trim();
  if(text.length<=limit)return text;
  let best=-1,anchor=0;
  for(const match of text.matchAll(/[^.!?？。]+[.!?？。]*/g)){
    const sentence=match[0],price=PRICE.exec(sentence),ask=ASK.exec(sentence),change=CHANGE.exec(sentence);
    if(!ask&&!price&&!change)continue;
    const score=(price?4:0)+(ask?4:0)+(change?2:0);
    if(score>=best){best=score;anchor=match.index+(price||change||ask).index;}
  }
  const lead=Math.min(300,Math.floor(limit*0.45));
  const start=Math.max(0,Math.min(text.length-limit,anchor-lead));
  return text.slice(start,start+limit);
}
const HANDOFF = /넘겨|넘기|건네|인계|전달|맡겨|맡기|\b(?:hand(?:off|over|\s+(?:(?:them|these|it)\s+)?(?:off|over))|forward|delegate)\b/i;
const REPLY_ACTION = /답장|회신|답변|발송|보내|\b(?:reply|respond|send)\b/i;
const STOP_ACTION = /지\s*(?:마|말|않)|하지\s*말|보류|중단|중지|멈|미루|나중에|(?:안|못)\s*(?:해|하)|\b(?:don't|don’t|do not|never|without|hold|pause|postpone)\b/i;
const ORDER = /(?:넘겨|맡겨|건네|전달해|인계해)(?:\s*(?:줘|주(?:세요|십시오|시기\s*바랍니다|실래요|시겠어요)|줄래|봐|라))?(?:요)?$|(?:넘기|맡기|전달하|인계하)(?:세요|십시오)$|(?:전달|인계)\s*(?:부탁드립니다|바랍니다)$/;
const ENGLISH_REQUEST = /^(?:(?:can|could|would)\s+you\s+|I\s+(?:need|want)\s+you\s+to\s+|I['’]d\s+like\s+you\s+to\s+)?(?:(?:please|just|then|also)\s+)*/i;
const ENGLISH_ARGUMENT = /^(?:(?:unanswered|unreplied|e?mails?|messages?|requests?|inquiries|quotes?|quotations?|estimates?|estimating|quoting|team|agent|my|our|the|a|an|all|any|in|from|for|to|of|them|these|those|it|now|today|inbox|mailbox|gmail|outlook|and|then|please|just|that|I|we|haven['’]t|replied)\b[\s'-]*)*$/i;
const KOREAN_ARGUMENT = /^(?:\s+|(?:(?:견적|메일)\s*(?:담당자?|직원|팀|부서)|(?:업무용\s*)?(?:메일함|사서함|받은\s*편지함|받은\s*메일|이메일|메일)|견적서?|문의|요청|고객|거래처|관련|건|Gmail|Outlook|지메일|아웃룩)(?:에게로|에게|한테|께|으로|에서|에|로|을|를|은|는|이|가|도|들|만|중|의|과|와)*|(?:찾아|조사해|검토해|확인해|검색해|골라|살펴|확인하|조사하|분류해)(?:봐서|보고|서|고|여)?|아직|전부|모두|다|좀|전수|지금|바로|오늘|연결된|등록된|중에서|그중|우선)*$/i;
function directOrder(part) {
  const korean=ORDER.exec(part);
  if(korean)return KOREAN_ARGUMENT.test(part.slice(0,korean.index));
  const english=part.replace(ENGLISH_REQUEST,'');
  const action=HANDOFF.exec(english);
  if(!action||!ENGLISH_ARGUMENT.test(english.slice(action.index+action[0].length).trim()))return false;
  if(action.index===0)return true;
  const search=/^(?:search|find|scan|check|look (?:for|through))\s+(.*?)\s+(?:and(?: then)?|then)\s+$/i.exec(english.slice(0,action.index));
  return Boolean(search&&ENGLISH_ARGUMENT.test(search[1]));
}
const FUTURE = /나중에|추후|이따|내일|모레|다음\s*(?:주|달|번에)|\b(?:tomorrow|later|next (?:week|month|time))\b/i;
const KOREAN_PRESENT = /(?:미(?:회|답)신|미응답|(?:아직\s*)?(?:답(?:장|변)?|회신)(?:을|이)?\s*(?:(?:안|못)\s*한|하지\s*않은|없는))\s*견적\s*(?:문의(?:\s*메일)?|메일|요청)(?:가|이|들이)?\s*(?:있는지\s*확인하고\s*)?(?:있으면|있다면|있는\s*경우(?:에는)?)/g;
const ENGLISH_PRESENT = /\bif (?:there (?:are|is)|you (?:find|see|have)) (?:any |an? )?(?:unanswered|unreplied) (?:quote|quotation|estimate) (?:e?mails?|requests?|inquiries)\b/gi;
const CLAUSE_END = /[.:：!?？。;,，\n]+|(?<=(?:말고|마시고|말되|않고|보류하고|보류하되|보류해 두고|미루고|미루되|보내고|발송하고|답장하고|회신하고))\s*|\s+(?:but|instead)\s+/i;
const HELD_REPLY = /^(?:(?:고객|상대방?)(?:에게는?|한테는?)?|직접|지금은?|아직|당장은?|내일까지|오늘까지|\s)*(?:답장|회신|답변|발송)(?:은|는|을|를|도)?\s*(?:(?:내일|오늘)까지\s*)?(?:(?:하|보내)?지\s*(?:말|마|않)|(?:보류|중지|미루)(?:하|해|고|되|어|기))|^(?:please\s+)?(?:don['’]t|do not|never|without)\s+(?:reply(?:ing)?|respond(?:ing)?|send(?:ing)?)\b|^(?:hold off|hold|postpone|pause)\s+(?:on\s+)?(?:the\s+)?(?:reply|responding|sending)\b/i;
function quoteIntent(value) {
  const text=String(value||'').replace(/“[^”]*”|‘[^’]*’|"[^"]*"|(?:^|\s)'[^']*'(?:\s|$)/g,' ').trim();
  if(!/견적|quotes?|estimate/i.test(text) ||
     !/미(?:회|답)신|미응답|답(?:장|변)?(?:을|이)?\s*(?:안|못|없|하지\s*않)|답하지\s*않|회신(?:을|이)?\s*(?:안|못|없|하지\s*않)|unanswered|unreplied|haven.t replied/i.test(text) ||
     !/견적\s*(?:담당(?:자)?|직원|팀|부서)|(?:quot(?:e|ing)|estimating) (?:agent|team)/i.test(text))return false;
  const conditionScope=text.replace(KOREAN_PRESENT,' ').replace(ENGLISH_PRESENT,' ');
  if(/예시|구현|코드|사용법|방법|설명|가능한지|가능해|되나요|어떻게\s*(?:하나요|해요)|(?:으?면|한다면)\s*(?:견적|그때|넘겨|전달|인계)|\b(?:example|implement|if|when|how (?:do|can|to)|explain|(?:should|shall|could|can|would|do) (?:I|we))\b/i.test(conditionScope))return false;
  // Remove the description of an unanswered message. It describes the object, not a requested reply action.
  const instruction=conditionScope.replace(/미(?:회|답)신|미응답|(?:답(?:장|변)?|회신)(?:을|이)?\s*(?:(?:안|못)\s*한|하지\s*않은|없는)|답하지\s*않은/g,' ');
  let delegate=false;
  for(const clause of instruction.split(CLAUSE_END)){
    const part=clause.trim();
    if(!part)continue;
    const handoff=HANDOFF.test(part),reply=REPLY_ACTION.test(part),stop=STOP_ACTION.test(part);
    // Holding the reply is compatible with delegating now. A positive reply,
    // or a clause that holds both actions, is a different instruction.
    if(reply){
      const replyInstruction=part.replace(/^(?:아직\s*)?견적\s*(?:문의(?:\s*메일)?|메일|요청)(?:은|는|을|를|에는|에)?\s*/,'')
        .replace(/(?:직접|일단|잠시|우선|바로|먼저|당분간)\s*(?=(?:보류|중지|미루|(?:하|보내)지))/g,'');
      if(handoff||!stop||!HELD_REPLY.test(replyInstruction)||/조사|검색|\bscan\b|(?:보류|중지|연기)(?:를)?\s*(?:없이|하지\s*(?:마|말|않))/i.test(part))return false;
      continue;
    }
    if(stop||FUTURE.test(part))return false;
    const argument=part.replace(/^최근(?:에)?\s+/,'');
    if(!handoff){
      const lookup=/^(?:search|find|scan|check|look (?:for|through))\s+(.+)$/i.exec(part.replace(ENGLISH_REQUEST,''));
      if(!KOREAN_ARGUMENT.test(argument)&&!(lookup&&ENGLISH_ARGUMENT.test(lookup[1])))return false;
      continue;
    }
    if(delegate||!directOrder(argument))return false;
    delegate=true;
  }
  return delegate;
}
function childId(provider, subject, threadId, messageId) {
  const hex=createHash('sha256').update(JSON.stringify(['solio-quote-v1', provider, subject, threadId, messageId])).digest('hex').slice(0,32).split('');
  hex[12]='5'; hex[16]=((parseInt(hex[16],16)&3)|8).toString(16);
  const s=hex.join('');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
const PRICE_REQUEST = /(?:견적서?|단가|가격|제작비|비용|요금)[을를이가은는도]?\s*(?:(?:좀|한\s*번|빠르게|부디|혹시)\s*)*(?:문의|부탁|요청|요망|궁금|얼마|알려|알고\s*싶|어떻게|필요|내\s*(?:주|줄)|주(?:세요|십시오|실)|보내\s*주|송부\s*부탁|확인\s*부탁|가능(?:한가|할까|할지|합니까)|(?:받을|받아\s*볼)\s*수\s*(?:있(?:을|나|는지|겠|습니까)|있으면\s*(?:감사|고맙|좋)|있어(?:요)?\s*[?？]|없(?:을까|나요|을지))|받(?:아\s*보)?고\s*(?:싶(?!었|었었|지\s*(?:않|못)|을\s*뻔)|자)|받아\s*보려)|얼마(?:인가|인지|예요|나|일까|로)|(?:견적서?|단가|가격).{0,12}(?:어떻게\s*되|얼마)/;
const ENGLISH_PRICE_REQUEST = /\b(?:(?:request(?:ing)?|need|want|like|looking for|please (?:send|give|provide)(?: us| me)?) (?:a |an |your |the )?(?:quot(?:e|ation)|estimate|pric(?:e|ing))|quote (?:request|inquiry)|how much|your pricing|could you quote|RFQ)\b/i;
const SELLER_FRAME = /(?:단가|견적|가격|비용)(?:을|를|의)?\s*(?:산정|산출|계산|준비|작성)(?:을|를|하|해)?\s*(?:위해|하려|하기|하는\s*데)|(?:견적|가격)(?:서|을|를)?\s*(?:드리|내려면)|(?:to|in order to) (?:calculate|prepare|provide|finali[sz]e|work out) (?:your|our|the|a) (?:price|quot(?:e|ation)|estimate)/i;
const PRICE_NOTICE = /(?:단가|가격|총액|비용|견적)(?:은|는|이|가)?\s*[\d,.]+\s*(?:만|천)?\s*원(?:이니|이며|이고|으로\s*가능|에\s*가능|입니다|입니다만)|(?:we (?:can )?(?:offer|charge)|our (?:unit )?price is)\b/i;
const BUDGET = /희망|예산|목표|budget|target|hoped for/i;
const RENEW = /(?:새(?:로운)?|다시|수정|추가|별도)\s*(?:로\s*)?(?:견적|단가)|\b(?:new|revised|additional|separate) (?:quote|estimate)\b/i;
const STATUS_ONLY = /어떻게\s*(?:됐|되었|되나|될까)|진행\s*(?:상황|여부)|답장\s*기다|any update|status of|following up/i;
const UNITS = /\d[\d,]*(?:\.\d+)?\s*(?:부|권|개|편|명|장|세트|벌|대|매|박스|(?:(?:additional|extra|more)\s+)?(?:units?|copies|pieces|sets?|pcs)\b)/gi;
const AMOUNTS = /[$£€₩]\s*\d[\d,.]*|\d[\d,.]*\s*(?:만|천)?\s*(?:원|달러|USD\b|KRW\b|EUR\b)/gi;
const DATES = /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}[-/]\d{1,2}|\d+\s*(?:주|일|weeks?|days?))/gi;
const CHANGE_ACTION = /추가|포함|제외|반영|대신|수정|변경|늘리|늘려|줄이|줄여|바꾸|바꿔|instead|revis|includ|exclud|chang/i;
const REFERENCE = /^(?:지난|기존|이번|해당|같은|관련|이전|진행|진척|상황|결과|희망|목표|예상|정확한|제작|제시|예산|단가|견적|문의|주신|부탁|보낸|대한|대해|기준|새|수정|추가로?|별도로?|다시|우선|먼저|최종(?:적으로)?|대략|모두|총|더|덜|좀|조금|the|our|your|this|that|previous|price|quote|revised|updated|new|another|additional|total|more|fewer)$/i;
const key = text => text.toLowerCase().replace(/[\s,]/g,'');
function detailSpans(text, productRequest) {
  const spans=[];
  function add(kind,value){spans.push({kind,value,id:kind+':'+key(value)});}
  for(const value of text.match(UNITS)||[])add('quantity',value);
  for(const value of text.match(AMOUNTS)||[])add('amount',value);
  if(/납기|수령|배송|납품|일정|기한|deliver|deadline|receive/i.test(text)){
    for(const value of text.match(DATES)||[])add('deadline',value);
  }
  if(!productRequest)return spans;
  for(const m of text.matchAll(/(?<![가-힣a-z0-9-])([가-힣a-z][가-힣a-z0-9-]*)\s+(?=\d[\d,.]*\s*(?:부|권|개|편|명|장|세트|units?|copies))/gi)){
    if(!REFERENCE.test(m[1])&&!/(?:대신|에서|수량|수량은|수량을|수량이|총|about|for|of)$/i.test(m[1]))add('product',m[1]);
  }
  for(const m of text.matchAll(/(?<![가-힣a-z0-9-])([가-힣a-z][가-힣a-z0-9-]*)\s+(?:단가|제작비|가격|견적|unit price|pricing)/gi)){
    if(!REFERENCE.test(m[1])&&!/(?:으로|에서|까지|에게|저희|귀사|확인)$/.test(m[1]))add('product',m[1]);
  }
  return spans;
}
function revisedValues(previous, current) {
  const kind=value=>value.split(':',1)[0];
  const changedKinds=new Set([...current].map(kind));
  const unchanged=[...(previous||[])].filter(value=>!changedKinds.has(kind(value)));
  return new Set([...unchanged,...current]);
}
function sourcePiece(record, limit) {
  const {text, anchor}=record;
  if(text.length<=limit)return text;
  const start=Math.max(0,Math.min(text.length-limit,anchor-Math.floor(limit*0.45)));
  return text.slice(start,start+limit);
}
function productInRequest(text, spans, previousName) {
  const normalize=value=>value.toLowerCase().replace(/(?:입니다|이에요|예요|이고|이며|인데|으로|로|을|를)$/,'');
  const swap=/([가-힣a-z0-9-]+)\s+대신\s+([가-힣a-z0-9-]+)/i.exec(text);
  if(swap&&previousName&&normalize(swap[1])===previousName)return {name:normalize(swap[2]),anchor:swap.index,explicit:true,replaces:true};
  const field=/(?:품목|제품|상품)(?:명)?(?:은|는|이|가|을|를)\s*([가-힣a-z0-9-]+)/i.exec(text);
  if(field){
    const value=field[1];
    if(/^\d|^(?:그대로|동일|같|유지|종전|기존과|이전과|바꾸지|변경하지|변동\s*없)/.test(value))return null;
    const clause=text.slice(field.index).split(/[.!?。？,\n]/,1)[0];
    return {name:normalize(value),anchor:field.index,explicit:true,replaces:/바꿉|바꾸|바꿔|변경|교체/.test(clause)};
  }
  const item=spans.find(span=>span.kind==='product'&&!/^(?:본|주문|예비분|수량|납기|배송|수령|단위|기준)(?:은|는|이|가|을|를|에|만)?$/.test(span.value));
  return item?{name:normalize(item.value),anchor:text.indexOf(item.value)}:null;
}
function quantitySources(text,spans,scopedOrders=[]) {
  const eligible=new Set(spans.filter(s=>s.kind==='quantity').map(s=>s.value));
  const quantities={absolute:[],increment:[],portion:[]};
  for(const match of text.matchAll(UNITS)){
    if(!eligible.has(match[0]))continue;
    const before=text.slice(0,match.index),after=text.slice(match.index+match[0].length);
    let kind='absolute';
    const inScopedOrder=scopedOrders.some(clause=>{
      const start=text.indexOf(clause);
      return start>=0&&match.index>=start&&match.index<start+clause.length;
    });
    if(inScopedOrder||/(?:[그이]\s*중(?:에서|에)?|일부|나머지|잔여|남은|(?:the )?remaining)\s*$/i.test(before))kind='portion';
    else if(/(?:추가로|추가\s*(?:수량|주문)(?:은|이)?|(?:additional|extra))\s*$/i.test(before)||
      /^(?:을|를|만)?\s*(?:더|추가(?!\s*(?:비용|요금|금액|가격|문의|설명)))/.test(after)||
      /\b(?:additional|extra|more)\b/i.test(match[0]))kind='increment';
    quantities[kind].push({value:match[0],anchor:match.index});
  }
  return quantities;
}
function containsFieldValue(text,value) {
  for(let at=text.indexOf(value);at!==-1;at=text.indexOf(value,at+1)){
    if(!/^\d/.test(value)||!at||!/[\d,.]/.test(text[at-1]))return true;
  }
  return false;
}
function requestEvidence(prior, facts, authored, messageId) {
  const spans=facts.spans;
  const kinds=new Set(spans.map(span=>span.kind));
  const previous=prior?.context;
  const product=productInRequest(authored,spans,previous?.product.name);
  const number=spans.find(span=>span.kind==='quantity');
  const first=number||spans[0];
  const anchor=product?.anchor??(first?authored.indexOf(first.value):authored.search(PRICE));
  const record={messageId,text:authored,anchor:Math.max(0,anchor),name:product?.name,order:(previous?.order||0)+1};
  const root=previous?.root||record;
  const counts=quantitySources(authored,spans,facts.scopedOrders);
  const relativeOnly=Boolean(number)&&!counts.absolute.length;
  const newProduct=Boolean(product)&&(product.explicit||!relativeOnly);
  const base=previous?.product||root;
  const replacement=newProduct&&product.replaces&&Boolean(base.name)&&product.name!==base.name;
  const additions=replacement?[]:[...(previous?.additions||[])];
  const portions=replacement?[]:[...(previous?.portions||[])];
  const notes=replacement?[]:[...(previous?.notes||[])];
  const holds=replacement?new Map():new Map(previous?.holds);
  let incomplete=!replacement&&Boolean(previous?.incomplete);
  const fields=new Map(previous?.fields);
  const pieces=[];
  const requiredValues=[];
  function include(label,item,limit){
    if(!item||item.messageId===messageId)return;
    const window=sourcePiece(item,limit);
    if(pieces.some(part=>part.id===item.messageId&&part.window.includes(window)))return;
    pieces.push({id:item.messageId,item,label,window,text:label+window});
  }
  if(previous){
    include('처음 문의: ',root,170);
    include('이전 사양: ',base,124);
    for(const item of additions)include('이전 추가 요청: ',item,80);
    for(const item of portions)include('이전 일부 수량 요청: ',item,70);
    for(const item of notes)include('이전 조건 변경: ',item,70);
    for(const item of holds.values())include('이후 고객이 남긴 조건: ',item,100);
    for(const [kind,item] of fields){
      if(kinds.has(kind)&&(kind!=='quantity'||counts.absolute.length))continue;
      include('이전 조건 변경: ',item,56);
      requiredValues.push({id:item.messageId,values:item.values});
    }
  }
  // Preserve the source of an increment separately from the absolute value it changes.
  if(counts.increment.length)additions.push({...record,anchor:counts.increment[0].anchor,values:counts.increment.map(q=>q.value)});
  if(counts.portion.length)portions.push({...record,anchor:counts.portion[0].anchor,values:counts.portion.map(q=>q.value)});
  if(previous&&!kinds.size&&facts.changed)notes.push(record);
  for(const [target,text] of facts.affectedDetails||[]){
    const exceptions=(facts.scopedOrders||[]).filter(clause=>containsFieldValue(clause,target));
    holds.set(target,{...record,anchor:Math.max(0,authored.indexOf(text)),values:[text,...exceptions]});
  }
  if(facts.procurement)for(const target of holds.keys()){
    if(!facts.affectedDetails?.has(target)&&containsFieldValue(authored,target)&&facts.renew)holds.delete(target);
  }
  for(const kind of kinds){
    if(kind==='product'||kind==='quantity'&&!counts.absolute.length)continue;
    const values=kind==='quantity'?[...new Set(counts.absolute.map(q=>q.value))]:[...new Set(spans.filter(span=>span.kind===kind).map(span=>span.value))];
    fields.set(kind,{...record,values,anchor:authored.indexOf(values[0])});
  }
  // Each increment needs source space in the card. Beyond that space, ask the member to review the conversation.
  if(additions.length>24||holds.size>24)incomplete=true;
  const context={root,order:record.order,product:newProduct&&product.name!==base.name?record:base,additions:additions.slice(-24),portions:portions.slice(-2),notes:notes.slice(-2),fields,holds:new Map([...holds].slice(-24)),incomplete};
  // Use whole messages in the customer's original order whenever the selected sources fit on the card.
  const ordered=[...pieces].sort((a,b)=>a.item.order-b.item.order||a.item.anchor-b.item.anchor);
  const messages=new Map();
  for(const part of ordered)if(!messages.has(part.id))messages.set(part.id,part.label+part.item.text);
  const full=[...messages.values(),(messages.size?'최근 요청: ':'')+authored].join('\n');
  if(full.length<=850)return {context,evidence:full,complete:!incomplete};
  const history=[];
  let available=570-requiredValues.reduce((size,item)=>size+Math.min(42,item.values.join(' / ').length)+8,0);
  for(const part of pieces){
    if(part.text.length+1>available)continue;
    history.push(part);
    available-=part.text.length+1;
  }
  for(const item of requiredValues){
    const source=history.filter(piece=>piece.id===item.id).map(piece=>piece.text).join('\n');
    const missing=item.values.filter(value=>!containsFieldValue(source,value));
    if(missing.length)history.push({id:item.id,item:pieces.find(piece=>piece.id===item.id)?.item,text:'이전 조건: '+missing.join(' / ').slice(0,42)});
  }
  history.sort((a,b)=>(a.item?.order||0)-(b.item?.order||0)||(a.item?.anchor||0)-(b.item?.anchor||0));
  const header=history.length?history.map(piece=>piece.text).join('\n')+'\n최근 요청: ':'';
  const limit=850-header.length;
  let latest=excerpt(authored,limit);
  const missing=spans.find(span=>!containsFieldValue(latest,span.value));
  if(missing){
    const at=authored.indexOf(missing.value);
    const window=sourcePiece({...record,anchor:at},Math.min(90,Math.floor(limit/3)));
    latest=window+' … '+excerpt(authored,limit-window.length-3);
  }
  const evidence=header+latest;
  const essential=[fields.get('quantity'),...additions,...context.portions,...holds.values()].filter(Boolean);
  const complete=!incomplete&&essential.every(item=>{
    const source=item.messageId===messageId?latest:history.filter(part=>part.id===item.messageId).map(part=>part.text).join('\n');
    return item.values.every(value=>containsFieldValue(source,value));
  });
  return {context,evidence,complete};
}
function withdrawalTarget(clause,context,retained) {
  const generic=/^(?:견적|견적서|요청|문의|주문|발주|제작|진행|거래|건|전체|모두|저희|우리|저|당사|당분간|내부|사정|승인|결정|일단|잠시|지금|현재|이번|지난|기존|앞서|죄송|하지만|부득이|더는|아직|우선|해당|원래|그대로)/;
  const topics=[...clause.matchAll(/(?:^|\s)([가-힣a-z0-9-]+?)(?:은|는|을|를)(?=\s|$)/gi)].map(m=>m[1]);
  const mentioned=detailSpans(clause,true).find(s=>s.kind==='product'&&!generic.test(s.value)&&!/(?:은|는|에서)$/.test(s.value))?.value;
  const candidates=[...topics,mentioned].filter(t=>t&&!generic.test(t));
  const sources=context?[...context.additions,...context.portions,...context.notes,context.product]:[];
  const grounded=candidates.find(t=>sources.some(s=>containsFieldValue(s.text,t))||retained.some(s=>containsFieldValue(s,t)));
  if(grounded)return grounded;
  if(mentioned)return mentioned;
  if(/^(?:저희|우리|당사)(?:\s|는|가)/.test(clause))return '';
  const explicitOther=retained.some(text=>PRICE_REQUEST.test(text)||ENGLISH_PRICE_REQUEST.test(text));
  if(explicitOther&&candidates.length)return context?null:candidates[0];
  const focus=topics.findLast(t=>!/^(?:지금|현재|당분간|이번|오늘|내일)$/.test(t));
  if(!focus||generic.test(focus))return '';
  // The context of a new, bare subject needs a member's review before an old quote can continue.
  return null;
}
function mailFacts(body,context) {
  // Keep grammatical direction within the clause. A buyer's budget in a neighbouring clause is evidence.
  const lines=body.replace(/((?:말씀드렸|전했|말했|요청했|희망했)(?:지만|고|는데))\s*/g,'$1\n').replace(/((?:취소|철회)(?:하고|하되|하지만|해\s*(?:주(?:시)?고|주시되)|한\s*(?:뒤|후)))\s*/g,'$1\n')
    .replace(/(보류(?:하고|하며|하되))\s+/g,'$1\n')
    .replace(/(보류\s*(?:하겠습니다|합니다|중입니다|하기로\s*했습니다))만(?=[\s,，.…!?？]|$)/g,'$1\n')
    .replace(/((?:부탁|요청|문의)(?:드리|하)(?:고|며|지만|는데))\s+/g,'$1\n')
    .replace(/(싶지(?:는|도|가)?\s*않(?:지만|고|으나))\s*/g,'$1\n')
    .split(/(?<=[.!?？。])\s+|,\s+|(?<=[가-힣]),\s*|\n+/).map(s=>s.trim()).filter(Boolean);
  const stopsQuote=s=>CANCEL.test(s)&&!/(?:취소|철회)(?:를)?\s*하지\s*(?:않|마|말)/.test(s)&&!HOLDS_DETAIL.test(s);
  let retained=[],withdrawAll=false,unknownWithdrawal=false;
  const withdrawnProducts=new Map();
  for(const clause of lines){
    if(!stopsQuote(clause)&&!DECLINES_QUOTE.test(clause)){retained.push(clause);continue;}
    const target=withdrawalTarget(clause,context,retained);
    if(target){
      withdrawnProducts.set(target,clause);
      retained=retained.filter(text=>!containsFieldValue(text,target));
    }else{
      if(target===null)unknownWithdrawal=true;
      withdrawAll=true;
      retained=[];
    }
  }
  const withdrawn=withdrawAll||withdrawnProducts.size>0;
  const clauses=retained.filter(s=>!NO_REQUEST.test(s)&&!ACK.test(s)).map(text=>{
    const price=PRICE.test(text), procurement=!/(?:겠|싶었|바랐|원했)다고\s*(?:말씀|전했|말했|생각했)/.test(text)&&(PRICE_REQUEST.test(text)||ENGLISH_PRICE_REQUEST.test(text)), budget=BUDGET.test(text);
    const seller=SELLER_FRAME.test(text)||OFFER.test(text)||BILL.test(text);
    const statement=!budget&&(STATED_PRICE.test(text)||PRICE_NOTICE.test(text));
    const retrospective=STATUS_ONLY.test(text)&&/지난|기존|이전|앞서|문의드린|follow|status/i.test(text);
    const ask=ASK.test(text),spans=detailSpans(text,procurement&&!retrospective),op=CHANGE_ACTION.test(text)||HOLDS_DETAIL.test(text);
    const nudge=NUDGE.test(text)||STATUS_ONLY.test(text);
    return {text,ask,price,seller,statement,procurement:!seller&&!statement&&procurement,
      spans,op,renew:RENEW.test(text),nudge,support:SUPPORT.test(text)};
  });
  const active=clauses.filter(c=>!c.seller&&!c.statement);
  const spans=active.flatMap(c=>c.spans);
  return {withdrawn,withdrawAll,unknownWithdrawal,withdrawnProducts,orderedClauses:lines,retainedClauses:retained,evidence:withdrawn?retained.join(' '):body,ask:active.some(c=>c.ask),price:active.some(c=>c.price),
    procurement:active.some(c=>c.procurement),seller:clauses.some(c=>c.seller),
    statement:clauses.some(c=>c.statement),spans,values:new Set(spans.map(s=>s.id)),
    changed:active.some(c=>c.op),renew:active.some(c=>c.renew),
    reminder:active.some(c=>c.nudge),support:active.some(c=>c.support),
    condition:active.some(c=>CHANGE.test(c.text)),informative:active.some(c=>c.spans.length||c.op)};
}
function requestEvent(facts, prior, awaitingReply, titleRequest) {
  const newValue=[...facts.values].some(value=>!prior?.values.has(value));
  const changed=newValue || facts.changed || facts.renew;
  const businessRequest=facts.procurement || (titleRequest || Boolean(prior)) && (
    facts.ask && (facts.informative||facts.condition) || titleRequest && facts.informative
  );
  if(facts.seller)return facts.procurement?'review':'none';
  if(facts.statement&&!facts.procurement)return 'none';
  if(!awaitingReply&&facts.procurement&&!facts.reminder)return 'open';
  if(prior && changed && (businessRequest || facts.ask || facts.changed || facts.renew))return 'open';
  if(prior && (facts.reminder||facts.procurement))return 'keep';
  if(!prior && businessRequest && (!facts.reminder || facts.procurement || changed))return 'open';
  if(facts.ask&&!facts.support)return 'review';
  return 'none';
}
function draftDisposition(drafts, open) {
  let uncertain=false;
  for(const draft of drafts){
    const addressed=Array.isArray(draft.recipients)&&draft.recipients.length>0;
    if(addressed&&!draft.recipients.some(to=>open.contacts.includes(to)))continue;
    if(Number.isFinite(draft.at)&&draft.at<open.at)continue;
    if(addressed&&Number.isFinite(draft.at)&&draft.at>open.at)return 'draft';
    uncertain=true;
  }
  return uncertain?'review':'open';
}
function assessThread(messages) {
  let open=null, lastRequest=null, customer=null, review=false, ambiguousAt=-1, previous=null;
  const suppliers=new Set(),drafts=[];
  const sorted=messages.filter(m=>!m.excluded&&!m.automatic&&!AUTO.test(m.subject))
    .sort((a,b)=>a.at-b.at||Number(a.outgoing)-Number(b.outgoing));
  for(const m of sorted){
    if(m.draft){drafts.push(m);continue;}
    if(m.bulk)continue;
    if(previous?.at===m.at&&previous.id!==m.id)ambiguousAt=m.at;
    previous=m;
    const sender=m.sender||'';
    const subject=clean(m.subject,240),body=authoredText(m.body);
    const facts=mailFacts(body,!m.outgoing&&sender===customer?lastRequest?.context:null);
    if(m.outgoing){
      const recipients=m.recipients||[];
      if(facts.procurement)for(const address of recipients){
        if(address!==customer&&!lastRequest?.contacts.includes(address))suppliers.add(address);
      }
      if(open&&(!recipients.length||recipients.some(to=>open.contacts.includes(to)))){
        review=!recipients.length||m.at===open.at;
        open=null;
      }
      continue;
    }
    const quotedTitle=PRICE.test(subject);
    if(suppliers.has(sender)){
      if(facts.procurement)review=true;
      continue;
    }
    if((open||lastRequest||quotedTitle||facts.price)&&(!body||m.uncertain||/^(?:re\s*:\s*)*(?:fwd?|전달)\s*[:：]/i.test(subject))){
      open=null;review=true;continue;
    }
    if(facts.withdrawn&&(!customer||sender===customer)){
      const context=lastRequest?.context;
      const targets=[...facts.withdrawnProducts.keys()];
      const adjustments=context?[...context.additions,...context.portions,...context.notes]:[];
      facts.affectedDetails=new Map([...facts.withdrawnProducts].filter(([target])=>adjustments.some(item=>containsFieldValue(item.text,target))));
      const inMain=target=>Boolean(context&&containsFieldValue(context.product.text,target));
      const stopsCurrent=targets.some(target=>target===context?.product.name||inMain(target));
      const overlaps=targets.some(target=>facts.affectedDetails.has(target)&&target!==context?.product.name&&inMain(target));
      if(facts.withdrawAll||!lastRequest||stopsCurrent){
        open=null;lastRequest=null;review=facts.unknownWithdrawal||overlaps;
      }else if(facts.affectedDetails.size){
        const selected=new Set([...facts.retainedClauses,...facts.affectedDetails.values()]);
        const update=facts.orderedClauses.filter(clause=>selected.has(clause)).join('\n');
        facts.scopedOrders=facts.retainedClauses.filter(clause=>[...facts.affectedDetails.keys()].some(target=>containsFieldValue(clause,target))&&
          (PRICE_REQUEST.test(clause)||ENGLISH_PRICE_REQUEST.test(clause)));
        if(!open&&!facts.evidence){
          lastRequest.context=requestEvidence(lastRequest,facts,update,m.id).context;
          continue;
        }
        facts.evidence=update;
      }
      if(!facts.evidence)continue;
    }
    const firstTitle=quotedTitle&&!REPLY_SUBJECT.test(subject)&&(ASK.test(subject)||/견적서?\s*$|\bRFQ\b/i.test(subject));
    const prior=sender===customer?lastRequest:null;
    const updatesOpen=open&&(facts.affectedDetails?.size||facts.withdrawn&&facts.procurement&&!facts.reminder);
    const event=updatesOpen?'open':requestEvent(facts,prior,Boolean(open),firstTitle);
    if(event==='keep'){
      if(!open&&prior&&facts.reminder)review=true;
      continue;
    }
    if(event==='review'){
      if(open||lastRequest||firstTitle||facts.price||facts.withdrawn){open=null;review=true;}
      continue;
    }
    if(event!=='open')continue;
    if(!m.direct||!sender||customer&&customer!==sender){open=null;review=true;continue;}
    customer=sender;review=false;
    const authored=facts.evidence||body;
    const {evidence,context,complete}=requestEvidence(prior,facts,authored,m.id);
    open={id:m.id,at:m.at,sender,contacts:[sender,...(m.replyTo||[])],subject,inbox:m.inbox,authored,from:clean(m.from,200),
      date:new Date(m.at).toISOString(),evidence,sourceId:m.id,webLink:m.webLink||''};
    if(!complete)open.needsReview=true;
    lastRequest={contacts:open.contacts,values:revisedValues(prior?.values,facts.values),context};
  }
  if(!open)return {state:review?'review':'closed'};
  if(ambiguousAt>=open.at||open.needsReview)return {state:'review'};
  const status=draftDisposition(drafts,open);
  return status==='open'?{state:status,item:open}:{state:status};
}
module.exports={assessThread,quoteIntent,childId,addresses,clean,authoredText};
