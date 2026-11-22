'use strict';
const {randomUUID}=require('node:crypto');
const {fail,providers,addressValid,jsonRequest,bearer,current}=require('./office-mail-http.cjs');
const {LIMIT,PAGES_PER_READ,gmailId,graphId,token,transient,outlookOriginal,identities,paging,nextGraphLink,numericGraphOffset,advance,expired}=require('./office-mail-pages.cjs');
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me/messages';
const GRAPH='https://graph.microsoft.com/v1.0/me';
const fields=['terms','from','after','before','folder','provider','inherit'];
const text=(v,max=256)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const word=v=>typeof v==='string'&&v.length>0&&v.length<=80&&/^[\p{L}\p{M}\p{N} .@_+\-]+$/u.test(v)&&v===v.trim()&&!/\b(?:AND|OR|NOT|NEAR)\b/.test(v);
const mailboxWord=/(?:메일|이멜|받은\s*편지|보낸\s*편지|편지함|사서함|아웃룩|\b(?:e-?mails?|gmail|outlook|inboxes|inbox|sent items|mailbox(?:es)?|mail)\b|(?<=\b(?:the|my|our|these|those)\s)mails\b)/iu;
const needsMailDecision=(prompt,previous)=>previous==='mail'||mailboxWord.test(prompt);
const schema=require('./office-mail-plan.schema.json');
const evidenceRoles=new Set(schema.properties.evidence.items.properties.role.enum);
const periods=new Set(schema.properties.period.enum);
const packetKeys=schema.required;
const filterKeys=['terms','from','after','before','folder','provider','attachment'];
const normalize=s=>s.normalize('NFC').toLowerCase().replace(/\s+/gu,' ').trim();
const outsideSources=/웹|인터넷|온라인|드라이브|(?:앞선|앞|위|이전)\s*(?:답변|보고서)|\b(?:web|internet|online|drive|repository|prior (?:answer|report)|previous (?:answer|report))\b/giu;
const folderNames={
  inbox:/받은\s*(?:편지|메일)\s*함|\binbox(?:es)?\b/iu,
  sent:/보낸\s*(?:(?:편지|메일)\s*함|메일|편지)|(?:내가|제가)\s*보낸|\bsent (?:items|folders?|mail|messages?|e-?mails?)\b|\b(?:i|we) sent\b/iu,
  all:/전체|모든|모두|전부|\ball\b|\bevery(?:where| folder)\b|(?:받은|수신).*?(?:보낸|발신)|\breceived\b.*\bsent\b/iu
};
const serviceNames={gmail:/지메일|\bgmail\b/iu,outlook:/아웃룩|\boutlook\b/iu};
const {day,selectedDays,dateTokens,dateEvidenceMatches,evidenceText,verifiesPeriod}=require('./office-mail-calendar.cjs');
const attachmentMark=/첨부|attachments?|attached/iu;
const attachmentNegative=/(?:없|않|제외|없이)|\b(?:no|without|excluding|not|missing|lack(?:ing|s)?)\b|n['’]t\b/iu;
const fileConstraint=/파일\s*(?:명|이름)|첨부(?:파일|문서)?\s*(?:안|속|내용|본문)|(?:pdf|xlsx?|docx?|pptx?|zip|png|jpe?g)\b|\b(?:filename|inline|inside|content of)\b/iu;
const unsupported=/(?:안\s*읽은|읽지\s*않은|답장(?:하지\s*않은|하지\s*못한|\s*안\s*한)|별표(?:가|를|로)?\s*(?:있는|붙은|표시한))|\b(?:unread|starred|unanswered)\b/iu;
const quotePattern=/“[^”]*”|‘[^’]*’|"[^"]*"|(?<![\p{L}\p{N}])'[^']*'(?![\p{L}\p{N}])/gu;
const blankPlan=()=>({terms:[],from:'',after:'',before:'',folder:'',provider:'',attachment:'',inherit:false,clear:[],mergeTerms:'replace'});
const includesSpan=(outer,inner)=>outer.start<=inner.start&&outer.end>=inner.end;
const overlaps=(a,b)=>a.start<b.end&&b.start<a.end;
function termsIn(prompt,term){return normalize(prompt).includes(normalize(term));}
function maskQuotes(prompt){
  const spans=[...prompt.matchAll(quotePattern)].map(m=>({start:m.index,end:m.index+m[0].length,quote:m[0]}));
  const simple=s=>/^(?:받은\s*(?:편지|메일)함|보낸\s*(?:편지|메일)함|inbox|sent items|gmail|outlook|지메일|아웃룩)$/iu.test(s.quote.slice(1,-1).trim());
  const conjunction=s=>/^\s*(?:(?:,|，)\s*)?(?:와|과|및|그리고|and|&)?\s*$/iu.test(s);
  const visible=new Set();
  for(const s of spans){
    const inside=s.quote.slice(1,-1).trim();
    if(dateTokens(inside,true).length&&(/\b(?:received|delivered|sent)\s+(?:on|in|during|before|after|since|until|through)\s*$/iu.test(prompt.slice(0,s.start))||
       /^\s*(?:에|부터|까지|이후|이전)\s*(?:제가\s*)?(?:받|보낸|도착)/u.test(prompt.slice(s.end))))visible.add(s.start);
  }
  for(let i=0;i<spans.length;i++){
    if(!simple(spans[i]))continue;
    let j=i;
    while(j+1<spans.length&&simple(spans[j+1])&&conjunction(prompt.slice(spans[j].end,spans[j+1].start)))j++;
    const tail=prompt.slice(spans[j].end);
    const local=atMailbox(prompt,{start:spans[i].start,end:spans[j].end});
    if(local)for(let k=i;k<=j;k++)visible.add(spans[k].start);
    i=j;
  }
  return prompt.replace(quotePattern,(quote,offset)=>visible.has(offset)?quote:' '.repeat(quote.length));
}
function marks(source,pattern){
  return [...source.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))]
    .map(m=>({start:m.index,end:m.index+m[0].length}));
}
function searchWording(prompt){
  const unquoted=maskQuotes(prompt);
  // Only the account chosen as the object of this search is a destination. Keep source offsets intact.
  return unquoted.replace(/\b((?:search|scan|browse|check)\s+(?:in\s+)?(?:(?:my|our|the)\s+)?(gmail|outlook))(\s+(?:instead of|rather than)\s+(gmail|outlook))(?=\s+for\s+(?:(?:the|any|all|my|our)\s+)*(?:e-?mails?|mails?|messages?)\b)/giu,
    (whole,chosen,first,excluded,second)=>first.toLowerCase()===second.toLowerCase()?whole:chosen+' '.repeat(excluded.length));
}
function cited(sentence,entry){
  if(!entry||typeof entry!=='object'||Object.keys(entry).length!==3||!evidenceRoles.has(entry.role)||
     typeof entry.quote!=='string'||!entry.quote.trim()||entry.quote.length>120||
     !Number.isInteger(entry.nth)||entry.nth<1||entry.nth>100)return null;
  let start=-1;
  for(let n=0;n<entry.nth;n++){
    start=sentence.indexOf(entry.quote,n?start+entry.quote.length:0);
    if(start<0)return null;
  }
  return {role:entry.role,quote:entry.quote,start,end:start+entry.quote.length};
}
function validPacket(packet){
  if(!packet||typeof packet!=='object'||Array.isArray(packet)||Object.keys(packet).length!==packetKeys.length||
     !packetKeys.every(k=>Object.hasOwn(packet,k)))return false;
  return schema.properties.scope.enum.includes(packet.scope)&&periods.has(packet.period)&&
    Array.isArray(packet.evidence)&&packet.evidence.length<=8&&Array.isArray(packet.unmet)&&packet.unmet.length<=schema.properties.unmet.maxItems&&
    packet.unmet.every(v=>typeof v==='string'&&v.trim()&&v.length<=schema.properties.unmet.items.maxLength)&&
    [packet.mailRef,packet.otherRef].every(v=>typeof v==='string'&&v.length<=512);
}
function conditionFields(packet){
  const {scope,mailRef,otherRef,period,evidence,unmet,...conditions}=packet;
  return validatePlan(conditions,true);
}
function reviewFilter(filter){
  if(!filter||typeof filter!=='object'||Array.isArray(filter)||Object.keys(filter).length!==filterKeys.length||
     !filterKeys.every(k=>Object.hasOwn(filter,k))||!filter.folder||!filter.provider)throw fail('MAIL_PLAN');
  return validatePlan({...filter,inherit:false},true);
}
function publicFilter(plan){
  const combined=combinePlan(plan);
  return Object.fromEntries(filterKeys.map(k=>[k,combined[k]]));
}

function evidenceForFolder(folder,include,exclude,sentence){
  const named=(spans,pattern)=>spans.some(s=>pattern.test(s.quote));
  const inbox=named(include,folderNames.inbox),sent=named(include,folderNames.sent),all=named(include,folderNames.all);
  const omitInbox=named(exclude,folderNames.inbox),omitSent=named(exclude,folderNames.sent);
  if(exclude.some(s=>!folderNames.inbox.test(s.quote)&&!folderNames.sent.test(s.quote)))return false;
  const needsInbox=folder!=='sent',needsSent=['all','sent','inbox_sent'].includes(folder);
  if(omitInbox&&needsInbox||omitSent&&needsSent)return false;
  if(['all','inbox_sent','inbox','sent'].includes(folder)){
    const narrowed=include.some(s=>/(?:받은|보낸)\s*(?:편지|메일)\s*함|\binbox(?:es)?\b|\bsent (?:items|folders?)\b/iu.test(s.quote));
    const ordered=[...include].sort((a,b)=>a.start-b.start);
    const wide=ordered.map((span,i)=>{
      if(i===0)return span.quote;
      const between=sentence.slice(ordered[i-1].end,span.start);
      return (/^\s*(?:,?\s*(?:and|as well as)|[,&/·+]|과|와|및|하고)\s*(?:(?:내가|제가|my|the|i|we)\s*)?$/iu.test(between)?between:' … ')+span.quote;
    }).join('');
    const directions=/\b(?:received|incoming)(?:\s+(?:mail|messages?|e-?mails?))?\s*(?:,\s*)?(?:and|&|as well as)\s+(?:(?:my|the|i|we)\s+)?(?:sent|outgoing)\b|\b(?:sent|outgoing)(?:\s+(?:mail|messages?|e-?mails?))?\s*(?:,\s*)?(?:and|&|as well as)\s+(?:(?:my|the|i|we)\s+)?(?:received|incoming)\b/iu.test(wide)||
      /(?:받은\s*(?:것|메일|편지)(?!함)\s*(?:과|와|및|하고)\s*(?:(?:내가|제가)\s*)?보낸\s*것|보낸\s*것\s*(?:과|와|및|하고)\s*(?:(?:내가|제가)\s*)?받은\s*것)/u.test(wide)||
      /(?:수신|받은)\s*[*·/,&및과와]+\s*(?:발신|보낸)\s*(?:메일|편지)(?!함)|(?:발신|보낸)\s*[*·/,&및과와]+\s*(?:수신|받은)\s*(?:메일|편지)(?!함)/u.test(wide);
    const mailboxScope=directions||/(?:모든|전체|모두|전부)\s*(?:폴더|사서함|메일함|편지함)|(?:메일함|편지함|사서함|폴더)\s*전체|\b(?:all (?:(?:my|our|the) )?(?:(?:mail )?folders|mailboxes|mail)|every folder|everywhere)\b|(?:받은|수신)\s*(?:메일|편지)(?!함).*?(?:보낸|발신)\s*(?:메일|편지)(?!함)/iu.test(wide);
    const context=include.length?sentence.slice(Math.min(...include.map(s=>s.start)),Math.max(...include.map(s=>s.end))):'';
    const examples=/(?:포함(?:한|하는|하여|해서|해|된)|비롯(?:한|해))|\b(?:including|such as)\b/iu.test(context)&&
      !/(?:제외|빼|않)|\b(?:not|except|excluding)\b/iu.test(context);
    const onlyNamed=/(?:편지함|메일함|폴더|사서함)\s*(?:에서|안에서|내에서)?만|\bonly (?:these|those|the two|both) (?:folders|mailboxes)\b/iu.test(sentence);
    if(mailboxScope&&(!narrowed||examples&&!onlyNamed))return folder==='all';
    if(folder==='all')return false;
  }
  if(folder==='inbox_sent')return inbox&&sent;
  if(folder==='inbox')return inbox&&!sent;
  if(folder==='sent')return sent&&!inbox;
  return !inbox&&!sent&&(!all||include.some(s=>/받은|수신|received|incoming/iu.test(s.quote)));
}

function atMailbox(sentence,span){
  const tail=sentence.slice(span.end).replace(/^[’”'"]/u,'');
  const head=sentence.slice(0,span.start).replace(/[‘“'"]$/u,'');
  if(/^(?:gmail|outlook)$/iu.test(sentence.slice(span.start,span.end))&&
     /\b(?:search|scan|browse|check)\s+(?:(?:my|our|the)\s+)?$/iu.test(head)&&/^\s+for\s+(?:(?:the|any|all|my|our)\s+)*(?:e-?mails?|mails?|messages?)\b/iu.test(tail))return true;
  return /^\s*(?:(?:의\s*)?(?:메일함|계정)|(?:두\s*곳|모두))?(?:에서|안에서|내에서|에\s*있는)|^\s+(?:inbox|sent items|account|mailbox)\b/iu.test(tail)||
    /\b(?:in|from|inside)\s+(?:(?:my|our|the)\s+)?$/iu.test(head);
}
function joinedPlaces(sentence,a,b){
  const [left,right]=a.start<b.start?[a,b]:[b,a];
  const gap=sentence.slice(left.end,right.start).replace(/[‘’“”'"]/gu,'');
  return /^\s*(?:(?:메일함|계정|mailboxes?|accounts?|inbox|sent items)\s*)?(?:이랑|랑|과|와|및|하고|그리고|,?\s*and|[,/&+])\s*(?:(?:우리|내|제|my|our|the)\s*)?$/iu.test(gap);
}
function namedLocations(sentence,mentions,previous){
  return mentions.filter(m=>atMailbox(sentence,m)||mentions.some(n=>{
    if(n===m||!joinedPlaces(sentence,m,n))return false;
    const last=m.end>n.end?m:n;
    return atMailbox(sentence,n)||previous==='mail'&&/^[’”'"]?\s*의\s*/u.test(sentence.slice(last.end));
  }));
}
function servicesRequestedTogether(sentence,first,second){
  return first.some(a=>second.some(b=>joinedPlaces(sentence,a,b)||atMailbox(sentence,a)&&atMailbox(sentence,b)));
}
function englishRequestObject(text){
  const clause=text.replace(/,\s*(?:please|kindly)\s*,/giu,' ').split(/[,;.!?\n]/u,1)[0].trim();
  const lead=clause.match(/^(?:(?:and|then|also|please|kindly)\s+)*(?:(?:i|we)(?:\s+(?:need|want|request|would\s+like)|['’]d\s+like)\s+|(?:(?:can|could|would|will)\s+you\s+)?(?:(?:please|kindly)\s+)*(?:find|search|look\s+(?:for|up)|check|show|give|get|pull(?:\s+up)?|list|retrieve|locate|fetch|summari[sz]e)\s+)/iu);
  return lead?clause.slice(lead[0].length).replace(/^(?:me|us)\s+/iu,''):'';
}
function englishMailRequest(text){
  return /^(?:what|which|anything|everything|them)\b|^(?:(?:all|both|any|some|the|my|our|those|these|received|sent|incoming|outgoing|and)\s+)*(?:(?:gmail|outlook)\s+)?(?:e-?mails?|mails?|messages?|invoices?|ones|inbox(?:es)?|sent items)\b/iu.test(englishRequestObject(text));
}
function requestAfterComma(sentence,begin,end){
  for(const comma of sentence.slice(begin,end).matchAll(/,/gu)){
    if(englishMailRequest(sentence.slice(begin+comma.index+1)))return true;
  }
  return false;
}
function inEnglishTopic(sentence,start){
  const prefix=sentence.slice(0,start).split(/[.!?](?=\s|$)|[;\n]/u).at(-1);
  const topic=[...prefix.matchAll(/\b(?:about|regarding|concerning)\b/giu)].at(-1);
  if(!topic)return false;
  return !requestAfterComma(sentence,start-prefix.length+topic.index,start);
}
function objectBefore(sentence,span){
  const prefix=sentence.slice(0,span.start).replace(/,\s*(?:please|kindly)\s*,/giu,' ').split(/[,;.!?\n]/u).at(-1);
  return englishRequestObject(prefix);
}
function refersToPreviousMail(sentence,span){
  const object=objectBefore(sentence,span);
  const tail=sentence.slice(span.end);
  const delivery=tail.match(/^\s+(sent|emailed|wrote)\b(?:\s+(?:to\s+)?(me|us)\b)?/iu);
  if(!delivery)return false;
  // Someone can write to the member inside a message sent by a different person.
  if(/^wrote$/iu.test(delivery[1])&&(!delivery[2]||mailboxWord.test(tail.slice(delivery[0].length))))return false;
  if(/^(?:what|anything|everything|(?:the|those) ones)(?:\s+(?:that|which))?$/iu.test(object))return true;
  // An invoice can be the requested item in a mail search, or a separate item before a mail request.
  const rest=tail.replace(/\b(?:in|from|on)\s+(?:(?:my|the|our)\s+)?(?:gmail|outlook)\b/giu,'');
  return /^(?:(?:the|my|our|these|those)\s+)?invoices?(?:\s+(?:that|which))?$/iu.test(object)&&!mailboxWord.test(rest);
}
function isSenderAt(sentence,span,outside){
  const head=sentence.slice(0,span.start).replace(/[‘“'"]$/u,''),tail=sentence.slice(span.end).replace(/^[’”'"]/u,'');
  if(/(?:보낸\s*(?:사람|이)|발신자|보낸\s*곳)(?:이|가|는|은|로|를|:)?\s*$/u.test(head)||
    /^\s*(?:(?:에서|에게서|한테서|[으]?로부터|이|가|님이|께서)\s*)?(?:(?:내게|저에게|제게)\s*)?(?:보낸|보내|온\s|받은|발송한)/u.test(tail)||
    /^\s*(?:에게|한테)\s*(?:받은|온\s)/u.test(tail))return true;
  const prefix=outside.slice(0,span.start).split(/[,;.!?\n]|\bbut\b/iu).at(-1);
  if(/\b(?:not|without|except|excluding|rather than|instead of)\b/iu.test(prefix))return false;
  if(/\b(?:from|sent by|sender(?: is)?|written by)\s+(?:(?:the|a)\s+)?$/iu.test(head))return true;
  if(!/^\s+(?:sent|emailed|wrote)\b/iu.test(tail)||inEnglishTopic(outside,span.start))return false;
  // The sender must modify the requested mail or the direct object of a mail follow-up.
  return /\b(?:e-?mails?|mails?|messages?)(?:\s+(?:that|which))?\s*$/iu.test(head)||refersToPreviousMail(outside,span);
}
function mailRequestClauses(sentence,reference){
  const starts=[0];
  // An independently requested lookup starts a new clause. Quoted text is already masked.
  const next=/(?:[,;.!?\n]\s*(?:(?:and|then|next|also)\s+)*|\b(?:and\s+then|and|then|next)\s+)(?=(?:(?:please|kindly)\s+)*(?:(?:could|can|would|will)\s+you\s+)?(?:find|search|look\s+(?:for|up)|check|show|give|get|pull\s+up|list|retrieve|locate|fetch|summari[sz]e)\b)/giu;
  for(const boundary of sentence.matchAll(next)){
    // A fronted topic (including “the price list”) belongs to the following request.
    const preceding=sentence.slice(starts.at(-1),boundary.index).split(/[,;.!?\n]/u);
    if(preceding.some(clause=>englishRequestObject(clause)))starts.push(boundary.index+boundary[0].length);
  }
  if(starts.length===1||!reference)return null;
  const at=position=>starts.findLastIndex(start=>start<=position);
  const targets=new Set();
  for(let offset=0;;){
    const pos=sentence.indexOf(reference,offset);if(pos<0)break;
    const end=pos+reference.length;
    for(let i=at(pos);i<=at(end-1);i++)targets.add(i);
    offset=end;
  }
  if(!targets.size)return null;
  return span=>targets.size===1&&targets.has(at(span.start))&&at(span.start)===at(span.end-1);
}
function negativeFolder(sentence,span){
  const left=sentence.slice(0,span.start),right=sentence.slice(span.end);
  return /(?:제외|빼|말고)|\b(?:excluding|except|not|without|omit|skip)\b|\bleave\s+(?:(?:my|our|the)\s+)?(?:inbox|sent items)\s+out\b/iu.test(span.quote)||
    /\b(?:excluding|except(?: for)?|omit|skip|without|not in)\s+(?:(?:my|our|the)\s+)?$/iu.test(left)||
    /^\s*(?:(?:은|는|를|을|도)\s*)?(?:제외|빼|말고)/u.test(right)||
    /\bleave\s+(?:(?:my|our|the)\s+)?$/iu.test(left)&&/^\s+out\b/iu.test(right);
}

const attachmentAbsent=/(?:첨부(?:\s*(?:파일|문서))?(?:이|가)?\s*(?:없(?:는|음|다|이)?|안\s*된|되지\s*않(?:은|는)?)|\b(?:without|no|excluding)\s+(?:any\s+)?attachments?\b)/iu;
const optionalAttachment=/첨부(?:\s*(?:파일|문서))?(?:이|가)?\s*없(?:어도|더라도)\s*(?:괜찮|무방|상관\s*없)/gu;
const deniesOptionalAttachment=/첨부(?:\s*(?:파일|문서))?(?:이|가)?\s*없(?:어도|더라도)\s*(?:괜찮|무방하|상관\s*없)(?:(?:다는|단)\s*(?:뜻|의미|말)(?:은|는|이|가)?\s*(?:아니|아닌)|지\s*않)/u;
const filterMarker=/(?:조건|필터|제한)(?:은|는|을|를|만|도)?\s*/gu;
const filterAction=/^(?:(?:이제|절대|계속|다시|모두|전부|다)\s*)*(?:(안|못)\s*)?(그대로\s*(?:두|유지)?|유지|보존|빼|제거|해제|없애|지우|지워|취소|초기화|리셋|없이)/u;
const negatedAction=/^\s*(?:(?:은|는|을|를)?\s*(?:안|못)\s*(?:하|해|했)|(?:은|는|을|를)?\s*(?:하|해|하여|아|어)?\s*(?:(?:버리|두|놓|보|내|주)\s*)?(?:(?:지(?:는|도|만)?|진)\s*(?:말|마|않)|(?:으?면|서는?|선)\s*안\s*(?:되|돼|됩)))/u;
// Only an affirmative instruction can widen a search. Unrecognized endings go to the card.
const koreanClearEnding=/^\s*(?:하(?:여|고)?|해(?:서)?|아|어)?\s*(?:(?:해\s*)?(?:줘(?:요)?|주세요|주십시오|주실래요)|세요|부탁(?:해(?:요)?|합니다)?)?\s*$/u;
const koreanSearchAfterClear=/^\s*(?:하|해|아|어)?(?:고|서)?\s*(?:(?:같은\s*조건으로|이제|다시|한\s*번\s*더)\s*)*(?:찾아|검색해|조회해|보여)\s*(?:줘(?:요)?|주세요|주십시오|주실래요)?\s*$/u;
const englishCommandLead=/^(?:(?:please|kindly|then|now)\s+)*(?:(?:can|could|would|will)\s+you\s+(?:(?:please|kindly)\s+)?)?$/iu;
const englishCommandEnd=/^\s*(?:please\s*)?(?:(?:and\s+(?:then\s+)?|then\s+)(?:please\s+)?(?:find|search|show|check|look\s+for|list)\b[^.!?;,\n]*)?$/iu;
const genericFilterSubject=/(?:^|[.?!;,])\s*(?:(?:그중|이제|이번엔)\s*)?(?:(?:기존|이전|직전|현재)\s*)?(?:검색\s*)?$/u;
const initializeFilters=/^(?:(?:다시|모두|전부|다)\s*)*(?:초기화|리셋)\s*(?:해|하(?:고|여|지|세요)|부탁|[.?!,]|$)/u;
const filterSubjects={
  attachment:/첨부(?:\s*(?:파일|문서))?(?:\s*(?:여부|유무))?\s*$/u,from:/(?:발신자|보낸\s*사람)\s*$/u,
  terms:/(?:검색어|키워드|검색\s*단어)\s*$/u,period:/(?:날짜|기간)\s*$/u,folder:/(?:폴더|편지함)\s*$/u,
  provider:/(?:공급자|서비스|메일\s*계정)\s*$/u
};
const englishFilterFields={attachment:'attachment',sender:'from',term:'terms',keyword:'terms',
  date:'period',period:'period',folder:'folder',provider:'provider',account:'provider'};
function filterInstruction(active,field,includeAll=false){
  const decisions=new Set();
  function note(keep,negated){
    decisions.add(negated?(keep?'notKeep':'keep'):(keep?'keep':'clear'));
  }
  for(const clause of active.split(/[.!?,;\n]/u)){
    const without=clause.indexOf('없이');
    if(without>=0&&filterSubjects[field].test(clause.slice(0,without))){
      const tail=clause.slice(without+2);
      if(!tail.trim()||koreanSearchAfterClear.test(tail))note(false,false);
    }
    if(field==='from'&&/^\s*(?:(?:이번엔|이제|그중)\s*)?(?:모든\s*발신자|(?:any|all)\s+senders?)\s*$/iu.test(clause))note(false,false);
  }
  let targeted=false;
  for(const marker of active.matchAll(filterMarker)){
    const subject=active.slice(0,marker.index),tail=active.slice(marker.index+marker[0].length);
    const all=includeAll&&(/(?:모든|전체)(?:\s*검색)?\s*$/u.test(subject)||
      genericFilterSubject.test(subject)&&(/^(?:모두|전부|다)\s*/u.test(tail)||initializeFilters.test(tail)));
    if(all||filterSubjects[field].test(subject))targeted=true;
    else if(!/(?:^|\s)(?:그|이|해당)\s*$/u.test(subject))targeted=false;
    if(!targeted)continue;
    const verb=filterAction.exec(tail);
    if(!verb)continue;
    const keep=/^(?:유지|그대로|보존)/u.test(verb[2]);
    const after=tail.slice(verb[0].length).split(/[.!?;,\n]/u,1)[0];
    const negated=Boolean(verb[1])||negatedAction.test(after);
    if(keep||negated||koreanClearEnding.test(after)||koreanSearchAfterClear.test(after))note(keep,negated);
    else decisions.add('unclear');
  }
  const en=/\b(?:(do not|don['’]t|never)\s+)?(keep|clear|remove|drop|reset|ignore)\s+(?:(?:the|that|previous)\s+)*(attachments?|senders?|terms?|keywords?|dates?|periods?|folders?|providers?|accounts?|all(?:\s+search)?)\s+(?:conditions?|filters?|requirements?|restrictions?)\b/giu;
  for(const match of active.matchAll(en)){
    const named=match[3].toLowerCase().replace(/s$/u,'');
    if(/^all/u.test(named)?!includeAll:englishFilterFields[named]!==field)continue;
    const keep=match[2].toLowerCase()==='keep';
    const lead=active.slice(0,match.index).split(/[.!?;,\n]/u).at(-1).trimStart();
    const end=active.slice(match.index+match[0].length).split(/[.!?;,\n]/u,1)[0];
    const negated=Boolean(match[1])||/\b(?:not|never)\b|n['’]t\b/iu.test(lead);
    if(keep||negated||englishCommandLead.test(lead)&&englishCommandEnd.test(end))note(keep,negated);
    else decisions.add('unclear');
  }
  if(decisions.has('unclear'))return 'unclear';
  if(decisions.has('keep'))return decisions.size===1?'keep':'unclear';
  if(decisions.has('clear'))return 'clear';
  return decisions.size?'unclear':'';
}
const anyAttachment=/첨부(?:\s*(?:파일|문서))?(?:\s*(?:여부|유무))?(?:은|는)?\s*(?:상관|관계)\s*없/gu;
function optionalAttachmentRequested(sentence){
  if(deniesOptionalAttachment.test(sentence))return false;
  return [...sentence.matchAll(optionalAttachment),...sentence.matchAll(anyAttachment)].some(m=>{
    const tail=sentence.slice(m.index+m[0].length);
    return /^\s*(?:아요|어요|습니다|다|으니(?:까)?|으므로|하니(?:까)?|해요|합니다)?\s*(?:$|[.!?,;\n])/u.test(tail)||
      /^이\s+/u.test(tail)&&koreanSearchAfterClear.test(tail.slice(1).split(/[.!?,;\n]/u,1)[0]);
  });
}
const readAgain=/(?:찾아?|검색|조회|확인|검사|보여|읽어|열어)(?:\s*(?:다시|해|하여|해\s*주|주|줄))?\s*(?:줄래요?|래요?|주세요|시겠어요|해줘|줘|요)?\s*[?!.…]*$|(?:^|[,;.!?]\s*|\band\s+)(?:(?:please|then|could you|can you|would you)\s+)*(?:find|search|show|look\s+(?:for|up)|browse|scan|list|check|read|open|retrieve)\b/iu;
const refusedRead=/(?:열(?:어\s*보)?|읽(?:어\s*보)?|찾(?:아\s*보)?|보|뒤지|살펴보|(?:검색|조사|조회|확인|열람|접근)(?:을|를|은|는|도)?\s*하)\s*지(?:는|도|만)?\s*(?:말|마|않)/gu;
const otherReadObject=/(?:첨부(?:파일|물)?|링크|웹사이트|문서|파일|페이지)(?:은|는|을|를|만|도)?\s*(?:(?:다시|따로|직접|절대)\s*)*$/u;
function refusesMailboxRead(active){
  if(/\b(?:never|do\s+not|don['’]t)\s+(?:open|read|check|search|access|scan)(?:\s+(?:in|through))?\s+(?:(?:my|our|the|any|personal)\s+)*(?:e-?mails?|mail|inbox|mailbox|gmail|outlook)\b/iu.test(active))return true;
  for(const match of active.matchAll(refusedRead)){
    if(!otherReadObject.test(active.slice(0,match.index)))return true;
  }
  return false;
}

function evaluatePacket(packet,prompt,previous,today,explicit){
  const sentence=typeof prompt==='string'?prompt:'',outside=searchWording(sentence);
  const safe=blankPlan(),unmet=[],quotes=[],roleChoices=[];
  function addUnmet(start,end){
    const value=sentence.slice(start,end).trim();
    // An exact duplicate denotes one displayed excerpt. Overlapping text can describe distinct restrictions.
    if(value&&!unmet.includes(value))unmet.push(value);
  }
  let requiresPeriodChoice=false;
  const review=(reason='conditions')=>!explicit&&reason==='source'?{kind:'choose'}:
    {kind:'review',review:{reason,plan:safe,filter:publicFilter(safe),quotes,unmet,
      ...(roleChoices.length?{roleChoices}:{}),...(requiresPeriodChoice?{requiresPeriodChoice:true}:{})}};
  const ambiguous=reason=>!explicit&&packet?.scope&&packet.scope!=='mailbox'?{kind:'choose'}:review(reason);
  if(!validPacket(packet))return ambiguous('evidence');
  let plan;
  try{plan=conditionFields(packet);}catch{return ambiguous('evidence');}
  for(const value of packet.unmet){
    const position=sentence.indexOf(value);
    if(position!==-1)addUnmet(position,position+value.length);
  }
  const refs=[packet.mailRef,packet.otherRef];
  if(refs.some(v=>v&&!sentence.includes(v)))return ambiguous('source');
  const evidence=packet.evidence.map(e=>cited(sentence,e));
  if(evidence.includes(null))return ambiguous('evidence');
  const by=role=>evidence.filter(e=>e.role===role),about=by('about');
  if(packet.scope!=='mailbox'){
    if(explicit)return review('source');
    if(packet.scope==='undecided'||packet.mailRef||packet.unmet.length||
       packet.scope==='prior_result'&&previous!=='ordinary'||['web_docs','prior_result'].includes(packet.scope)&&!packet.otherRef)
      return {kind:'choose'};
    const ungroundedTerms=plan.terms.some(term=>!about.some(s=>termsIn(s.quote,term)));
    const appliedConditions=ungroundedTerms||plan.from||plan.after||plan.before||plan.folder||plan.provider||plan.attachment||
      plan.inherit||plan.clear.length||packet.period||evidence.some(e=>e.role!=='about');
    if(appliedConditions)return {kind:'choose'};
    const ordinarySources=about.slice();
    const pos=outside.indexOf(packet.otherRef);
    if(packet.otherRef&&pos>=0)ordinarySources.push({start:pos,end:pos+packet.otherRef.length});
    const unmatched=marks(outside,mailboxWord).some(m=>!ordinarySources.some(s=>includesSpan(s,m)));
    if(unmatched)return {kind:'choose'};
    return {kind:'ordinary'};
  }
  let issue=packet.otherRef||refusesMailboxRead(outside)?'source':'';
  const selfSender=/^(?:i|me|myself|we|us|ourselves|나|저|내가|제가|우리|우리가|저희|저희가|본인)$/iu.test(plan.from);
  const senderMentions=selfSender?[]:by('sender').flatMap(span=>{
    const name=plan.from&&span.quote.toLowerCase().indexOf(plan.from.toLowerCase());
    if(typeof name!=='number'||name<0)return [];
    const at={start:span.start+name,end:span.start+name+plan.from.length};
    return [at];
  });
  const inRequestedClause=mailRequestClauses(outside,packet.mailRef);
  const senders=senderMentions.filter(span=>(!inRequestedClause||inRequestedClause(span))&&isSenderAt(sentence,span,outside));
  // Only a sender's literal name or a topic can legitimately contain an external source.
  const sourceRoles=[...senders,...about];
  const directExternal=m=>atMailbox(outside,m)||
    /\b(?:(?:search|check)\s+(?:the\s+)?|(?:search|look|check|find)\s+(?:on|in|from)\s+(?:the\s+)?)$/iu.test(outside.slice(0,m.start));
  const withinNamedSource=m=>senders.some(s=>includesSpan(s,m)&&s.end-s.start>m.end-m.start&&
    !/^\s*(?:에서|안에서|내에서)/u.test(outside.slice(m.end))&&
    !/^(?:(?:the|from|in|on|search|check)\s+)*(?:web|drive|online|internet|repository)$/iu.test(outside.slice(s.start,s.end)))||
    about.some(s=>includesSpan(s,m)&&s.start<m.start&&/\b(?:with|about|regarding|concerning)\s+(?:(?:a|an|the)\s+)?$/iu.test(outside.slice(0,s.start)));
  if(marks(outside,outsideSources).some(m=>!sourceRoles.some(s=>includesSpan(s,m))||
     directExternal(m)&&!withinNamedSource(m)))issue='source';
  const references=[];
  for(let offset=0;packet.mailRef;){
    const pos=sentence.indexOf(packet.mailRef,offset);if(pos<0)break;
    references.push({start:pos,end:pos+packet.mailRef.length});offset=pos+packet.mailRef.length;
  }
  const refersToMail=marks(outside,mailboxWord).some(m=>references.some(s=>includesSpan(s,m))&&
    ![...about,...senders].some(s=>includesSpan(s,m)));
  const directMailObject=senders.some(span=>/^(?:(?:my|the|our|these|those)\s+)?(?:(?:gmail|outlook)\s+)?(?:e-?mails?|mails?)(?:\s+(?:that|which))?$/iu.test(objectBefore(outside,span)))||
    by('folder').length>0&&outside.split(/[,;.!?\n]/u).some(clause=>
      /^(?:(?:my|the|our)\s+)?(?:received|incoming|sent|outgoing)\s+(?:and\s+(?:received|incoming|sent|outgoing)\s+)?(?:e-?mails?|mails?)\b/iu.test(englishRequestObject(clause)));
  const namedMailbox=by('provider').some(s=>atMailbox(outside,s))&&
    (references.some(ref=>/\b(?:e-?mails?|mails?|messages?)\b/iu.test(sentence.slice(ref.start,ref.end)))||senders.some(s=>refersToPreviousMail(outside,s)));
  const priorMail=previous==='mail'&&(senders.some(span=>refersToPreviousMail(outside,span)||
    /^(?:(?:my|the|our|these|those)\s+)?messages?(?:\s+(?:that|which))?$/iu.test(objectBefore(outside,span)))||
    by('folder').some(span=>/^(?:received|sent)\b/iu.test(span.quote)&&
      /^(?:what|anything|everything|(?:the|those) ones)(?:\s+(?:that|which))?\s+(?:i|we)$/iu.test(objectBefore(outside,span))));
  if(!explicit&&!plan.inherit&&!refersToMail&&!directMailObject&&!namedMailbox&&!priorMail)issue='source';
  const grounded=s=>s.quote.trim()&&outside.slice(s.start,s.end).trim().length>0;
  const applied=evidence.filter(s=>s.role!=='about');
  if(applied.some(s=>!grounded(s)||about.some(t=>overlaps(s,t))))issue=issue||'evidence';
  for(const e of evidence)if(!quotes.includes(e.quote))quotes.push(e.quote);
  if(plan.inherit){
    if(previous==='mail'&&by('followup').some(grounded)){
      safe.inherit=true;safe.mergeTerms=plan.mergeTerms;
      safe.clear=plan.clear.filter(field=>{
        const action=filterInstruction(outside,field,true);
        return action==='clear'||!action&&field==='attachment'&&optionalAttachmentRequested(outside);
      });
      if(safe.clear.length!==plan.clear.length)issue=issue||'followup';
    }else issue=issue||'followup';
  }else if(plan.clear.length)issue=issue||'followup';
  safe.terms=plan.terms.filter(term=>termsIn(sentence,term));
  if(inRequestedClause){
    safe.terms=safe.terms.filter(term=>{
      const matching=about.filter(s=>termsIn(s.quote,term));
      return !matching.length||matching.some(inRequestedClause);
    });
  }
  if(safe.terms.length!==plan.terms.length)issue=issue||'terms';
  // Invoices are the object of this lookup. A sender alone would return unrelated correspondence.
  for(const item of marks(outside,/\binvoices?\b/giu)){
    if(inRequestedClause&&!inRequestedClause(item))continue;
    const object=objectBefore(outside,{start:item.end});
    if(!/^(?:(?:the|my|our|these|those|all|any|some)\s+)*invoices?$/iu.test(object))continue;
    if(safe.terms.some(term=>/\binvoices?\b/iu.test(term)))continue;
    if(safe.terms.length<6)safe.terms.push(sentence.slice(item.start,item.end));
    else addUnmet(item.start,item.end);
  }
  for(const match of sentence.matchAll(quotePattern)){
    const phrase=match[0].slice(1,-1).trim(),start=match.index,end=start+match[0].length;
    const head=sentence.slice(0,start),tail=sentence.slice(end);
    const beforeTitle=head.match(/(?:\b(?:subject|title)(?:\s+line)?(?:\s+(?:containing|contains|is))?|제목(?:에만|에|이|은))\s*$/iu);
    const afterTitle=tail.match(/^\s*(?:\bin\s+(?:the\s+)?(?:subject|title)(?:\s+line)?\b|(?:이|가|을|를)?\s*제목에(?:만)?)/iu);
    if(beforeTitle||afterTitle){
      // The editable keyword field searches the entire message. A subject restriction needs explicit consent to omit.
      addUnmet(start-(beforeTitle?.[0].length||0),end+(afterTitle?.[0].length||0));
    }
    if(!phrase||outside.slice(start,end).trim()||senders.some(s=>s.start>=start&&s.end<=end))continue;
    const literal=safe.terms.some(t=>normalize(t)===normalize(phrase));
    if(!literal){
      if(word(phrase)&&safe.terms.length<6)safe.terms.push(phrase);
      issue=issue||'terms';
    }
  }
  if(plan.from){
    if(senders.length)safe.from=plan.from;
    else{
      issue=issue||'sender';
      const span=senderMentions[0];
      const quoted=span?sentence.slice(span.start,span.end):sentence.includes(plan.from)?plan.from:'';
      if(quoted&&!selfSender)roleChoices.push({field:'from',quote:quoted,value:plan.from});
    }
  }
  const proposedFolders=by('folder');
  const included=proposedFolders.filter(span=>!inEnglishTopic(outside,span.start)||atMailbox(outside,span)||
    !/\b(?:received|sent|incoming|outgoing)\b/iu.test(span.quote)||/\b(?:inbox|sent items|folders?)\b/iu.test(span.quote));
  const omissions=by('exclude'),excluded=omissions.filter(s=>negativeFolder(sentence,s));
  if(omissions.length!==excluded.length)issue=issue||'folder';
  const folderSpans=[...included,...excluded,...about];
  const folderWords=marks(outside,/받은\s*(?:편지|메일)\s*함|보낸\s*(?:편지|메일)\s*함|\binbox(?:es)?\b|\bsent (?:items|folder)\b/giu);
  const folder=safe.inherit&&!included.length&&!excluded.length?'':plan.folder;
  // maskQuotes keeps a quoted folder visible only when its list identifies a search location.
  const quotedPlaces=marks(outside,quotePattern),folderLocations=new Set(namedLocations(outside,folderWords));
  if(folderWords.length===2&&joinedPlaces(outside,...folderWords)&&
     /(?:이|그|해당)\s*두\s*(?:폴더|편지함|메일함)(?:에서|안에서|내에서)?만|\bonly (?:these|those) two folders\b/iu.test(outside.slice(folderWords[1].end))){
    for(const mark of folderWords)folderLocations.add(mark);
  }
  const coveredFolders=folderWords.every(m=>{
    const inTopic=about.some(t=>t.start<m.start&&includesSpan(t,m)&&safe.terms.some(term=>termsIn(t.quote,term))&&
      /\b(?:with|about|regarding|concerning)\b[^,.;!?]*$/iu.test(outside.slice(0,t.start)))&&
      !folderWords.some(n=>n!==m&&joinedPlaces(outside,m,n));
    const spans=folderLocations.has(m)&&!inTopic||quotedPlaces.some(s=>includesSpan(s,m))?[...included,...excluded]:folderSpans;
    return spans.some(s=>includesSpan(s,m));
  });
  const supportedFolder=coveredFolders&&evidenceForFolder(folder,included,excluded,sentence);
  if(supportedFolder)safe.folder=folder;
  else{
    if(folderWords.length===2&&folderLocations.size===2&&folderNames.inbox.test(outside)&&folderNames.sent.test(outside)){
      const denySent=excluded.some(s=>folderNames.sent.test(s.quote)),denyInbox=excluded.some(s=>folderNames.inbox.test(s.quote));
      safe.folder=denySent&&!denyInbox?'inbox':denyInbox&&!denySent?'sent':denySent?'':'inbox_sent';
    }else if(coveredFolders&&(included.length||excluded.length)){
      const supported=['inbox','sent','inbox_sent','received','all'].filter(candidate=>evidenceForFolder(candidate,included,excluded,sentence));
      if(supported.length===1)safe.folder=supported[0];
    }
    issue=issue||'folder';
  }
  let uncertainFolder=proposedFolders.find(s=>!included.includes(s));
  if(plan.folder&&!supportedFolder&&!included.length&&!excluded.length&&!uncertainFolder){
    // A model-only folder is a proposal. The member sees the original wording and chooses the scope.
    uncertainFolder=folderWords[0]||marks(outside,/\b(?:sent|received|incoming|outgoing)\b(?:\s+(?:to\s+)?(?:me|us))?|보낸|받은|발신|수신/giu)[0]||
      (sentence.trim()?{start:0,end:sentence.length}:null);
  }
  if(uncertainFolder&&plan.folder){
    roleChoices.push({field:'folder',quote:sentence.slice(uncertainFolder.start,uncertainFolder.end),value:plan.folder});
    issue=issue||'folder';
  }
  if(selfSender&&!folderWords.length&&!included.length&&!excluded.length){
    const selfSent=marks(outside,/\b(?:e-?mails?|messages?|mail)\s+(?:(?:that|which)\s+)?(?:i|we)\s+(?:have\s+)?sent\b|(?:내가|제가|우리가|저희가)\s*(?:직접\s*)?(?:보낸|발송한)\s*(?:메일|편지)/giu);
    if(selfSent.some(m=>!inEnglishTopic(outside,m.start)&&!about.some(s=>includesSpan(s,m))))safe.folder='sent';
  }
  const serviceSpans=[...by('provider'),...included];
  const requested=[],sourceMentions=[],rawServices=Object.entries(serviceNames).flatMap(([name,pattern])=>marks(outside,pattern).map(m=>({...m,name})));
  const inServiceTopic=m=>about.some(t=>includesSpan(t,m)&&safe.terms.some(term=>termsIn(t.quote,term))&&
    /\b(?:about|regarding|concerning)\s+(?:(?:the|a|an)\s+)?$/iu.test(outside.slice(0,t.start)));
  const locations=[...new Set(namedLocations(outside,rawServices.filter(m=>!inServiceTopic(m)),previous).map(m=>m.name))];
  for(const name of Object.keys(serviceNames)){
    const rawMentions=rawServices.filter(m=>m.name===name);
    const mentions=rawMentions.filter(m=>![...about,...senders].some(s=>includesSpan(s,m)));
    if(mentions.some(m=>!serviceSpans.some(s=>includesSpan(s,m))))issue=issue||'provider';
    const matched=mentions.filter(m=>serviceSpans.some(s=>includesSpan(s,m)));
    if(matched.length){requested.push(name);sourceMentions.push(matched);}
  }
  const service=requested.length===2?'all':requested[0];
  if(requested.length===2&&!servicesRequestedTogether(outside,...sourceMentions)){
    const located=requested.filter((_,i)=>sourceMentions[i].some(s=>atMailbox(outside,s)));
    if(located.length===1)safe.provider=located[0];
    issue=issue||'provider';
  }
  else if(service&&plan.provider===service)safe.provider=service;
  else if(!service&&(!plan.provider||plan.provider==='all')){
    // combinePlan applies the default. Only a source the member actually named belongs here.
    safe.provider='';
  }else{
    if(service)safe.provider=service;
    issue=issue||'provider';
  }
  if(locations.some(name=>!requested.includes(name))){
    safe.provider=locations.length===2?'all':locations[0];
    issue=issue||'provider';
  }
  if(service==='all'||locations.length===2){
    const pairs=rawServices.flatMap(serviceMark=>{
      const label=folderWords.find(mark=>mark.start>=serviceMark.end&&/^[‘’“”'"\s]*(?:의\s*)?$/u.test(outside.slice(serviceMark.end,mark.start)));
      return label?[{provider:serviceMark.name,folder:folderNames.inbox.test(outside.slice(label.start,label.end))?'inbox':'sent',start:serviceMark.start,end:label.end}]:[];
    });
    if(pairs.length===2&&pairs[0].provider!==pairs[1].provider&&pairs[0].folder!==pairs[1].folder){
      const targetPairs=pairs.filter(p=>!excluded.some(s=>overlaps(s,p))&&!negativeFolder(outside,{...p,quote:outside.slice(p.start,p.end)}));
      const first=targetPairs[0]||pairs[0];
      safe.provider=first.provider;
      safe.folder=targetPairs.length?first.folder:(first.folder==='inbox'?'sent':'inbox');
      if(targetPairs.length===1){
        if(plan.provider!==first.provider||plan.folder!==first.folder)issue=issue||'provider';
      }else{
        const start=Math.min(...pairs.map(p=>p.start)),end=Math.max(...pairs.map(p=>p.end));
        addUnmet(start,end);
      }
    }
  }
  const delivery=by('delivered'),dates=evidenceText(sentence,delivery,[...about,...marks(sentence,quotePattern)]);
  const dateCovered=dateEvidenceMatches(outside,delivery,about,senders);
  if(safe.inherit&&!delivery.length&&dateCovered){
    safe.after='';safe.before='';
  }else if(packet.period){
    if(dateCovered&&verifiesPeriod(packet.period,plan,dates,today)){
      const bounds=packet.period==='absolute'?plan:selectedDays(packet.period,today);
      safe.after=bounds.after;safe.before=bounds.before;
    }else{requiresPeriodChoice=true;issue=issue||'period';}
  }else if(plan.after||plan.before||delivery.length||!dateCovered){requiresPeriodChoice=true;issue=issue||'period';}
  const clearsAttachment=plan.clear.includes('attachment');
  const action=filterInstruction(outside,'attachment',clearsAttachment);
  const keep=action==='keep';
  // A reminder about a retained filter is not itself a request to read the member's mailbox again.
  if(!explicit&&keep&&!outside.split(/[.!?;\n]/u).some(clause=>readAgain.test(clause.trim()))&&!plan.terms.length&&!plan.from&&!plan.after&&!plan.before&&
      !plan.clear.some(field=>field!=='attachment'))issue='source';
  const clear=action==='clear'||!action&&optionalAttachmentRequested(outside);
  const described=keep?outside.replace(deniesOptionalAttachment,''):clear?outside.replace(optionalAttachment,''):outside;
  const absent=attachmentAbsent.exec(described);
  if(absent&&!unmet.some(excerpt=>excerpt.includes(absent[0]))){
    const at=outside.indexOf(absent[0]);
    addUnmet(at,at+absent[0].length);
  }
  if(clearsAttachment&&(!clear||deniesOptionalAttachment.test(outside)||absent)||action==='unclear'){
    safe.clear=safe.clear.filter(field=>field!=='attachment');
    issue=issue||'attachment';
  }else if(clear&&!clearsAttachment||keep&&!safe.inherit)issue=issue||'attachment';
  const attachment=by('attachment'),attachmentSpans=[...attachment,...about,...by('followup')];
  const attMarks=marks(outside,attachmentMark);
  if(attMarks.some(m=>!attachmentSpans.some(s=>includesSpan(s,m)))||
     attachment.some(s=>fileConstraint.test(s.quote)||attachmentNegative.test(s.quote)))issue=issue||'attachment';
  const requestedAttachment=attachment.some(s=>attachmentMark.test(s.quote)&&!attachmentNegative.test(s.quote)&&!fileConstraint.test(s.quote));
  const newAttachment=attachment.some(s=>/\b(?:has|with|have)\s+(?:an?\s+|any\s+)?attachments?\b|\battached\s+(?:file|document)|첨부(?:\s*(?:파일|문서))?(?:이|가)?\s*(?:있는|있어|포함|달린|붙은)|첨부(?:된|한)/iu.test(s.quote)||
    attachmentMark.test(s.quote)&&/^\s*(?:이|가)?\s*있는\s*(?:메일|편지)/u.test(outside.slice(s.end)));
  if(keep&&safe.inherit&&!newAttachment){
    // Keeping a constraint retains its value from the parent, including a previous empty value.
    safe.attachment='';
  }else if(plan.attachment){
    if(requestedAttachment)safe.attachment=plan.attachment;
    else issue=issue||'attachment';
  }else if(newAttachment&&requestedAttachment){safe.attachment='has';issue=issue||'attachment';}
  else if(attachment.length&&!safe.clear.includes('attachment')&&!safe.inherit)issue=issue||'attachment';
  const unsupportedTerms=marks(outside,unsupported).filter(m=>{
    const sender=senders.find(s=>includesSpan(s,m));
    if(sender&&(sender.end-sender.start>m.end-m.start||/\bfrom\s*$/iu.test(outside.slice(0,sender.start))||
       /^\s*(?:이|가|에서)?\s*(?:보낸|보내온)/u.test(outside.slice(sender.end))))return false;
    const name=/^[A-Z][a-z]+\s+[A-Z][\p{L}\p{M}]+/u.test(outside.slice(m.start));
    const topic=about.some(s=>includesSpan(s,m)&&/\b(?:about|regarding|concerning)\s*$/iu.test(outside.slice(0,m.start)));
    return !(topic||name&&about.some(s=>includesSpan(s,m)));
  });
  for(const m of unsupportedTerms)addUnmet(m.start,m.end);
  // A paraphrased condition has no source span. Keep the user's instruction alongside the known excerpts.
  // A label such as "unread status" is already represented if the exact "unread" excerpt is present.
  const unmatchedClaim=packet.unmet.some(value=>{
    if(sentence.includes(value))return false;
    const label=normalize(value).replace(/\s+(?:status|condition|filter|상태|조건)$/u,'');
    return !unmet.some(excerpt=>normalize(excerpt)===label);
  });
  if(unmatchedClaim)addUnmet(0,sentence.length);
  if(unmet.length)return review('unsupported');
  if(!issue&&about.length&&!safe.terms.length&&!safe.inherit){
    // An identified topic with no search terms would query unrelated mail.
    for(const topic of about){
      const phrase=topic.quote.trim();
      if(word(phrase)&&safe.terms.length<6&&!safe.terms.includes(phrase))safe.terms.push(phrase);
    }
    issue='terms';
  }
  const hasFilters=safe.terms.length||safe.from||safe.folder||safe.after||safe.before||safe.attachment||safe.inherit;
  const bareSource=/^(?:(?:내|제|우리)\s*|(?:my|our|the)\s+)?(?:gmail|outlook|지메일|아웃룩|메일(?:함)?|사서함|이메일|inbox|mail(?:box)?|e-?mails?)(?:\s*(?:계정|메일함|사서함|account|inbox|mailbox))?[\s\p{P}]*$/iu;
  if(bareSource.test(sentence.trim())||!hasFilters&&!refersToMail)issue=issue||'conditions';
  if(issue)return review(issue);
  return {kind:'mailbox',plan:safe};
}
function checkDecision(packet,prompt,previous,today=new Date()){
  return evaluatePacket(packet,prompt,previous,today,false);
}
function explicitPlan(packet,prompt,today=new Date(),previous){
  const decision=evaluatePacket(packet,prompt,previous,today,true);
  if(decision.kind==='mailbox')return decision.plan;
  throw Object.assign(fail('MAIL_REVIEW'),{review:decision.review});
}

function validatePlan(value,confirmed=false) {
  const clear=value?.clear??[],mergeTerms=value?.mergeTerms??'replace',attachment=value?.attachment??'';
  if(!value||Object.keys(value).some(k=>!fields.includes(k)&&!['clear','mergeTerms','attachment'].includes(k))||fields.some(f=>!Object.hasOwn(value,f))||
    !['','has'].includes(attachment)||!['add','replace'].includes(mergeTerms)||!Array.isArray(clear)||clear.length>6||clear.some(k=>!['terms','from','period','folder','provider','attachment'].includes(k))||
    !Array.isArray(value.terms)||value.terms.length>6||value.terms.some(v=>!word(v))||
    value.from!==''&&!word(value.from)||value.after!==''&&!day(value.after)||value.before!==''&&!day(value.before)||
    value.after&&value.before&&value.after>=value.before||!['received','all','inbox','sent',''].includes(value.folder)&&!(confirmed&&value.folder==='inbox_sent')||
    !['all',...providers,''].includes(value.provider)||typeof value.inherit!=='boolean')throw fail('MAIL_PLAN');
  return {...value,attachment,terms:[...new Set(value.terms)],clear:[...new Set(clear)],mergeTerms};
}
function combinePlan(next,previous) {
  const p=validatePlan(next,true),prior=p.inherit&&previous?validatePlan(previous,true):null;
  const keep=key=>prior&&!p.clear.includes(key);
  const terms=p.terms.length ? (keep('terms')&&p.mergeTerms==='add'?[...new Set([...prior.terms,...p.terms])]:p.terms) : keep('terms')?prior.terms:[];
  const datesChanged=Boolean(p.after||p.before);
  return validatePlan({
    terms,from:p.from||(keep('from')?prior.from:''),
    after:datesChanged?p.after:keep('period')?prior.after:'',before:datesChanged?p.before:keep('period')?prior.before:'',
    folder:p.folder||(keep('folder')?prior.folder:'received'),provider:p.provider||(keep('provider')?prior.provider:'all'),
    attachment:p.attachment||(keep('attachment')?prior.attachment:''),inherit:false
  },true);
}
function searchScope(p) {
  const range={received:'받은 메일',all:'받은 메일과 보낸 메일',inbox:'받은편지함',sent:'보낸편지함',inbox_sent:'받은편지함과 보낸편지함'}[p.folder];
  if(typeof range!=='string')throw fail('MAIL_PLAN');
  const end=p.before?new Date(day(p.before)) : null;if(end)end.setDate(end.getDate()-1);
  const format=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  return [range,p.after||end?[(p.after||'처음')+' ~ '+(end?format(end):'현재')]:null,p.from&&'보낸 사람 '+p.from,p.terms.join(' · '),p.attachment==='has'&&'첨부파일 있음'].filter(Boolean).join(' · ');
}
function within(date,p,asOf) {
  const stamp=Date.parse(date);return Number.isFinite(stamp)&&(!p.after||stamp>=+day(p.after))&&(!p.before||stamp<+day(p.before))&&(!asOf||stamp<=Date.parse(asOf));
}
function sourceUrl(provider,address,item) {
  if(provider==='gmail' && addressValid(address) && /^[0-9a-f]{1,40}$/i.test(item.sourceId||''))
    return 'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(address)+'#all/'+item.sourceId;
  if(provider==='outlook')return outlookOriginal(item)?.href||null;
  return null;
}
function decodeSnippet(value) {
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return text(typeof value==='string'?value.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d{1,7}|#x[0-9a-f]{1,6});/gi,(m,key)=>{
    if(key[0]!=='#')return entities[key.toLowerCase()];
    const cp=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    return cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):' ';
  }):'',280);
}
function gmailFromMatches(value,expected) {
  if(typeof value!=='string')return false;
  const raw=value.replace(/\r?\n[ \t]+/gu,' ');
  if(/[\r\n]/u.test(raw))return false;
  // Quoted display names and nested comments may include addresses or angle brackets.
  let visible='',quoted=false,commentDepth=0;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if((quoted||commentDepth)&&ch==='\\'){i++;continue;}
    if(commentDepth){
      if(ch==='(')commentDepth++;
      if(ch===')')commentDepth--;
    }else if(ch==='"'){
      quoted=!quoted;visible+='"';
    }else if(!quoted){
      if(ch==='('){commentDepth=1;visible+=' ';}
      else visible+=ch;
    }
  }
  if(quoted||commentDepth)return false;
  const mailbox=visible.trim();
  const envelope=/^[^<>,;:()]*<\s*([^<>\s]+)\s*>$/u.exec(mailbox);
  return (envelope?envelope[1]:mailbox).toLowerCase()===expected;
}
function gmailQuery(p,asOf){
  const q=[...p.terms.map(v=>'"'+v+'"'),p.from&&'from:('+p.from+')','-in:drafts'];
  if(p.attachment==='has')q.push('has:attachment');
  if(p.folder==='inbox'||p.folder==='sent')q.push('in:'+p.folder);
  if(p.folder==='inbox_sent')q.push('{in:inbox in:sent}');
  if(p.folder==='received')q.push('-in:sent');
  if(p.after)q.push('after:'+Math.floor(+day(p.after)/1000-1));
  const end=Math.min(p.before?+day(p.before):Infinity,asOf?1000*(Math.floor(Date.parse(asOf)/1000)+1):Infinity);
  if(Number.isFinite(end))q.push('before:'+Math.floor(end/1000));
  const list=new URL(GMAIL);list.search=new URLSearchParams({q:q.filter(Boolean).join(' '),fields:'messages(id),nextPageToken',maxResults:String(LIMIT+1),includeSpamTrash:'false'});
  return list;
}
async function gmailItem(id,p,asOf,get) {
  const headers=new URL(GMAIL+'/'+id),summary=new URL(headers);
  headers.search=new URLSearchParams([['format','metadata'],['metadataHeaders','Subject'],['metadataHeaders','From'],['fields','id,payload/headers']]);
  summary.search=new URLSearchParams({format:'full',fields:'id,internalDate,snippet'});
  const meta=await get(headers);
  if(meta.id!==id||!Array.isArray(meta.payload?.headers))throw fail('MAIL_NETWORK');
  const from=meta.payload.headers.filter(h=>typeof h?.name==='string'&&h.name.toLowerCase()==='from');
  if(addressValid(p.from)&&(from.length!==1||!gmailFromMatches(from[0].value,p.from.toLowerCase())))return null;
  const m=await get(summary);
  if(m.id!==id||typeof m.internalDate!=='string'||!/^\d{1,15}$/.test(m.internalDate))throw fail('MAIL_NETWORK');
  const date=new Date(Number(m.internalDate)).toISOString();if(!within(date,p,asOf))return null;
  const subject=meta.payload.headers.find(h=>typeof h?.name==='string'&&h.name.toLowerCase()==='subject');
  return {id:randomUUID(),sourceId:id,subject:text(subject?.value),from:text(from[0]?.value),date,snippet:decodeSnippet(m.snippet)};
}
async function gmailPage({plan,asOf,get,positions,seen}){
  const s=positions.streams.gmail,initial=gmailQuery(plan,asOf);
  if(s.next && !token(s.next)||!s.pending.every(gmailId))throw fail('MAIL_PAGE_RESTART');
  const items=[],retry=[],attempted=new Set();let issue,pages=0,reads=0,rebuilt=false;
  while(items.length<LIMIT&&reads<50){
    if(!s.pending.length){
      if(s.next===null||pages>=PAGES_PER_READ)break;
      const start=s.next,u=new URL(initial);
      if(start)u.searchParams.set('pageToken',start);
      pages++;
      let data;
      try{data=await get(u);}catch(e){
        // A continuation advertised by Gmail may end with HTTP 204 and no JSON.
        if(start&&e.httpStatus===204&&e.code==='MAIL_NETWORK')data={};
        else{
          if(start&&!rebuilt&&expired(e)){s.next='';s.history=[];rebuilt=true;continue;}
          if(!transient(e.code)||!items.length&&!retry.length)throw e;
          issue=e.code;break;
        }
      }
      if(data.messages!=null&&!Array.isArray(data.messages))throw fail('MAIL_NETWORK');
      const next=data.nextPageToken??null;
      const candidates=[];
      for(const row of data.messages||[]){
        if(!gmailId(row?.id)){issue='MAIL_NETWORK';continue;}
        candidates.push(row.id);
      }
      try{
        if(next!==null&&!token(next))throw fail('MAIL_NETWORK');
        advance(s,start,next);
      }catch(e){
        issue=e.code;pages=PAGES_PER_READ;
      }
      s.pending=candidates;
      if(!s.pending.length)continue;
    }
    const id=s.pending.shift(),key=id.toLowerCase();
    if(attempted.has(key)||seen.ids.has(key))continue;
    attempted.add(key);reads++;
    try{
      const item=await gmailItem(id,plan,asOf,get);
      if(item){items.push(item);seen.add(item);}
    }catch(e){
      if(!transient(e.code))throw e;
      issue=e.code;
      if(e.code!=='MAIL_NOT_FOUND')retry.push(id);
      if(e.code==='MAIL_LIMIT'){
        if(!items.length&&!s.history.length)throw e;
        break;
      }
    }
  }
  s.pending=retry.concat(s.pending);
  const more=s.pending.length>0||s.next!==null;
  return {items,more,...(more?{cursor:positions}:{}),...(issue?{code:issue}:{})};
}
function outlookQuery(p,asOf,pageSize){
  const direct=['inbox','sent'].includes(p.folder);
  const path=direct?'/mailFolders/'+(p.folder==='inbox'?'inbox':'sentitems')+'/messages':'/messages';
  const url=new URL(GRAPH+path);
  const params=new URLSearchParams({'$select':'id,subject,from,receivedDateTime,sentDateTime,bodyPreview,webLink,parentFolderId,isDraft','$top':String(pageSize)});
  if(p.attachment==='has')params.set('$select',params.get('$select')+',hasAttachments');
  const dateKey=p.folder==='sent'?'sentDateTime':'receivedDateTime';
  const phrase=value=>value.includes(' ')?'"'+value+'"':value;
  const terms=p.terms.map(phrase);
  if(p.from)terms.push('from:'+phrase(p.from));
  if(terms.length){
    if(p.attachment==='has')terms.push('hasAttachments:true');
    // A KQL date is interpreted by the service. Widen to nearby dates and check
    // exact local midnight instants from each returned message below.
    const k=p.folder==='sent'?'sent':'received';
    for(const [bound,operator,delta] of [[p.after,'>=',-1],[p.before,'<=',1]]){
      if(bound){const d=day(bound);d.setDate(d.getDate()+delta);terms.push(k+operator+(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear());}
    }
    if(asOf){const d=new Date(asOf);d.setDate(d.getDate()+1);terms.push(k+'<='+(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear());}
    // Quote the entire Graph search literal and retain KQL phrase quotes inside it.
    params.set('$search',JSON.stringify(terms.join(' AND ')));
  }else{
    const filters=[];
    if(p.after)filters.push(dateKey+' ge '+day(p.after).toISOString());
    if(p.before)filters.push(dateKey+' lt '+day(p.before).toISOString());
    if(asOf)filters.push(dateKey+' le '+asOf);
    // Graph requires the orderby property first when combined with other filters.
    if(p.attachment==='has'){
      if(!filters.length)filters.push(dateKey+' ge 0001-01-01T00:00:00Z');
      filters.push('hasAttachments eq true');
    }
    if(filters.length)params.set('$filter',filters.join(' and '));
    params.set('$orderby',dateKey+' desc');
  }
  url.search=params;
  return url;
}
// Only the original search path and well-known folders are used. Folder ancestry is
// checked afresh for each click, since a classified folder can be moved in Outlook.
function folderCheck(p,get){
  const excluded=new Set(),known=new Map();let ready=false;
  async function prepare(){
    if(ready)return;
    for(const name of ['deleteditems','junkemail','drafts',...(p.folder==='received'?['sentitems']:[]),'msgfolderroot']){
      const f=await get(GRAPH+'/mailFolders/'+name+'?$select=id');
      if(!graphId(f.id))throw fail('MAIL_NETWORK');
      if(name==='msgfolderroot')known.set(f.id,false);else excluded.add(f.id);
    }
    ready=true;
  }
  async function omitted(id,visited=new Set()){
    if(excluded.has(id))return true;
    if(known.has(id))return known.get(id);
    if(!graphId(id)||id==='.'||id==='..'||id.length>1500||visited.has(id)||visited.size>12)throw fail('MAIL_NETWORK');
    visited.add(id);
    const f=await get(GRAPH+'/mailFolders/'+encodeURIComponent(id)+'?$select=id,parentFolderId');
    if(f.id!==id)throw fail('MAIL_NETWORK');
    const skip=await omitted(f.parentFolderId,visited);known.set(id,skip);return skip;
  }
  async function omittedMessage(row){
    try{return await omitted(row.folderId);}catch(e){if(e.code!=='MAIL_NOT_FOUND')throw e;}
    // The old folder can disappear after its message moves. Only ask where the
    // immutable ID from the original search lives; a missing message is final.
    const id=row.item.graphId;
    if(!graphId(id)||id==='.'||id==='..')throw fail('MAIL_NETWORK');
    let message;
    try{message=await get(GRAPH+'/messages/'+encodeURIComponent(id)+'?$select=id,parentFolderId');}
    catch(e){if(e.code==='MAIL_NOT_FOUND')return null;throw e;}
    if(message.id!==id||!graphId(message.parentFolderId))throw fail('MAIL_NETWORK');
    row.folderId=message.parentFolderId;
    return omitted(row.folderId);
  }
  return {prepare,omittedMessage};
}
function graphRow(m,p,asOf){
  if(!graphId(m?.id))throw fail('MAIL_NETWORK');
  const sender=m.from?.emailAddress;
  if(addressValid(p.from)&&(typeof sender?.address!=='string'||sender.address.trim().toLowerCase()!==p.from.toLowerCase()))return null;
  if(p.attachment==='has'&&m.hasAttachments!==true)throw fail('MAIL_NETWORK');
  const date=p.folder==='sent'?m.sentDateTime:m.receivedDateTime;
  if(m.isDraft||!within(date,p,asOf))return null;
  return {rank:Date.parse(date),item:{id:randomUUID(),graphId:m.id,subject:text(m.subject),from:[text(sender?.name),text(sender?.address)].filter(Boolean).join(' '),
    date:new Date(date).toISOString(),snippet:text(m.bodyPreview,280),webLink:typeof m.webLink==='string'&&m.webLink.length<=4096?m.webLink:''}};
}
function ordered(left,right){
  if(left.rank!==right.rank)return right.rank-left.rank;
  return left.item.graphId<right.item.graphId?-1:left.item.graphId>right.item.graphId?1:0;
}
async function outlookPage({plan,asOf,get,positions,seen,cursor}){
  // A small provider page is normal. Keep reading during this operation, but
  // checkpoint slow networks before the interactive job becomes unresponsive.
  const scanDeadline=Date.now()+120_000;
  const canRead=s=>s.pages<s.budget&&(!s.receiveOrder||!s.pages||Date.now()<scanDeadline);
  const streams=Object.entries(positions.streams).map(([name,state])=>{
    const p={...plan,folder:name};
    if(state.pending.some(r=>!Number.isFinite(r?.rank)||!graphId(r.item?.graphId)||typeof r.item.id!=='string'))throw fail('MAIL_PAGE_RESTART');
    const receiveOrder=plan.folder==='inbox_sent'&&name==='inbox'&&Boolean(p.terms.length||p.from);
    if(receiveOrder&&state.receiveOrder!==2){
      // Older cursors kept only eleven candidates. Rebuild that ranking once while
      // excluding the stable IDs that already have a row on the card.
      if(cursor){state.next='';state.history=[];state.pending=[];delete state.anchor;delete state.boundary;delete state.remaining;}
      state.receiveOrder=2;
    }
    const base=outlookQuery(p,asOf,receiveOrder?100:LIMIT+1);
    if(cursor&&state.next){
      const saved=new URL(nextGraphLink(state.next,base));
      if(numericGraphOffset(saved)){
        if(!state.anchor||!Array.isArray(state.anchor.ids)||!state.anchor.ids.every(graphId)||
          typeof state.anchor.page!=='string'||state.anchor.next!==undefined&&state.anchor.next!==saved.href){
          state.next='';state.history=[];state.pending=[];delete state.anchor;delete state.boundary;
        }else state.anchor.next=saved.href; // Former cursors stored this same link in state.next.
      }
    }
    const pool=receiveOrder&&state.next!==null?new Map(state.pending.map(r=>[r.item.graphId,r])):null;
    return {p,state,receiveOrder,pool,base,budget:receiveOrder?256:PAGES_PER_READ,folders:['inbox','sent'].includes(name)?null:folderCheck(p,get),
      folderRetry:new Set(),visited:new Set(),drawn:[],reconciliations:0,pages:0,rebuilt:false,blocked:false,verifyOffset:!!cursor};
  });
  const items=[],picked=new Set();
  let issue,revision=0;
  function rewind(stream){
    // Only previously published IDs are immutable here. Return provisional picks
    // to unaffected streams, then rebuild this stream from the original query.
    for(const other of streams){
      if(other!==stream&&other.drawn.length){
        const rows=new Map(other.state.pending.map(r=>[r.item.graphId,r]));
        for(const r of other.drawn)rows.set(r.item.graphId,r);
        other.state.pending=[...rows.values()].sort(ordered);
      }
      other.drawn.length=0;
    }
    items.length=0;picked.clear();revision++;
    const s=stream.state;
    s.next='';s.history=[];s.pending=[];delete s.anchor;delete s.boundary;
    stream.visited.clear();stream.folderRetry.clear();
    if(stream.receiveOrder)stream.pool=new Map();
  }
  async function read(stream,verifyOnly=false){
    const {p,state:s,base,folders}=stream;
    let start=s.next;
    if(start===null||!canRead(stream)||stream.blocked)return;
    stream.pages++;
    let data;
    async function reconcile(anchor){
      const previous=anchor.page?nextGraphLink(anchor.page,base):base;
      const check=await get(previous);
      if(!Array.isArray(check.value))throw fail('MAIL_NETWORK');
      const keys=check.value.map(m=>m?.id).filter(graphId);
      const returned=check['@odata.nextLink'];
      const next=returned==null?null:nextGraphLink(returned,base);
      if(next===anchor.next&&keys.length===anchor.ids.length&&keys.every((k,i)=>k===anchor.ids[i]))return false;
      if(++stream.reconciliations>2)throw Object.assign(fail('MAIL_NETWORK'),{unstablePage:true});
      rewind(stream);start='';
      data=anchor.page?null:check;
      return true;
    }
    try{
      if(start&&stream.verifyOffset&&s.anchor){
        stream.verifyOffset=false;
        await reconcile(s.anchor);
      }
      if(stream.visited.has(start))throw fail('MAIL_NETWORK');
      if(!data){
        data=await get(start?nextGraphLink(start,base):base);
        // A move can occur after the first check but before this numeric-offset
        // GET. Verify the predecessor again before admitting any fetched row.
        if(s.anchor&&await reconcile(s.anchor)&&!data)return;
      }
    }catch(e){
      if(start&&!stream.rebuilt&&expired(e)){
        rewind(stream);stream.rebuilt=true;return;
      }
      throw e;
    }
    if(!Array.isArray(data.value))throw fail('MAIL_NETWORK');
    stream.visited.add(start);
    if(folders&&(data.value.length||data['@odata.nextLink']))await folders.prepare();
    const found=stream.pool||new Map(s.pending.map(r=>[r.item.graphId,r]));
    let boundary;
    for(const m of data.value){
      const orderDate=(p.terms.length||p.from)&&m?.sentDateTime?m.sentDateTime:p.folder==='sent'?m?.sentDateTime:m?.receivedDateTime;
      const rank=Date.parse(orderDate);
      if(Number.isFinite(rank))boundary=boundary===undefined?rank:Math.min(boundary,rank);
      let r;
      try{r=graphRow(m,p,asOf);}catch(e){issue=e.code;continue;}
      if(!r||seen.has(r.item)||verifyOnly)continue;
      if(!stream.receiveOrder&&Number.isFinite(rank))r.rank=rank;
      // Defer classification until the row could actually be displayed. For the
      // eleventh candidate the next click, not this search, may inspect its folder.
      if(folders)r.folderId=typeof m.parentFolderId==='string'?m.parentFolderId:'';
      const old=found.get(m.id);
      if(!old||ordered(r,old)<0)found.set(m.id,r);
    }
    if(!stream.pool)s.pending=[...found.values()].sort(ordered);
    if(!stream.blocked){
      try{
        const link=data['@odata.nextLink'];
        const next=link==null?null:nextGraphLink(link,base);
        advance(s,start,next);
        if(next&&numericGraphOffset(new URL(next)))s.anchor={page:start,next,ids:data.value.map(m=>m?.id).filter(graphId)};
        else delete s.anchor;
        if(boundary!==undefined)s.boundary=boundary;
      }catch(e){issue=e.code;stream.blocked=true;}
    }
    if(stream.pool&&(s.next===null||stream.blocked)){
      s.pending=[...stream.pool.values()].sort(ordered);stream.pool=null;
    }
  }
  async function head(stream){
    const s=stream.state;
    for(;;){
      while(s.pending.length){
        const row=s.pending[0];
        if(seen.has(row.item))s.pending.shift();
        else if(picked.has(row.item.graphId))stream.drawn.push(s.pending.shift());
        else break;
      }
      const first=s.pending[0];
      if(first&&Object.hasOwn(first,'folderId')){
        if(stream.blocked&&stream.folderRetry.has(first.item.graphId))return;
        try{
          await stream.folders.prepare();
          const skip=await stream.folders.omittedMessage(first);
          if(skip!==false){s.pending.shift();if(skip===null)issue??='MAIL_NOT_FOUND';continue;}
          delete first.folderId;
        }catch(e){
          // A folder lookup can still fail even though the immutable message is
          // present. Only a 404 on the message itself consumes it as unavailable.
          const code=e.code==='MAIL_NOT_FOUND'?'MAIL_NETWORK':e.code;
          if(!transient(code))throw e;
          // A temporary classification error is retried once while the original
          // query has a next page. Never emit an older row beyond this unknown head.
          if(code==='MAIL_NETWORK'&&s.next!==null&&!stream.folderRetry.has(first.item.graphId)){
            stream.folderRetry.add(first.item.graphId);continue;
          }
          stream.folderRetry.add(first.item.graphId);issue=code;stream.blocked=true;return;
        }
      }
      const unfinishedTie=streams.length>1&&s.pending.length&&s.pending[0].rank===s.boundary;
      const needsDisplayOrder=stream.receiveOrder&&s.next!==null;
      const verifySavedOffset=stream.verifyOffset&&s.anchor&&s.next;
      if(s.pending.length&&!unfinishedTie&&!needsDisplayOrder&&!verifySavedOffset||s.next===null||!canRead(stream)||stream.blocked)return;
      try{await read(stream);}catch(e){
        if(!transient(e.code)||e.unstablePage)throw e;
        issue=e.code;stream.blocked=true;
        if(s.anchor)stream.offsetBlocked=true;
        if(e.code==='MAIL_LIMIT')break;
      }
    }
  }
  // Old Outlook rows contain only a web link. Verify each old identity under this
  // very query before appending anything, since moved or deleted messages can lose it.
  if(seen.unverified.size&&(!cursor||cursor.legacyPending)){
    if(cursor?.legacyPending){
      if(!Array.isArray(cursor.legacyPending)||cursor.legacyPending.some(k=>!seen.unverified.has(k)))throw fail('MAIL_PAGE_RESTART');
      for(const key of seen.unverified)if(!cursor.legacyPending.includes(key))seen.unverified.delete(key);
    }
    for(const s of streams){
      while(seen.unverified.size&&s.state.next!==null&&canRead(s)&&!s.blocked)await read(s,true);
    }
    if(seen.unverified.size){
      if(issue)throw fail(issue);
      if(streams.every(s=>s.state.next===null))throw fail('MAIL_PAGE_RESTART');
      positions.legacyPending=[...seen.unverified];
      return {items:[],more:true,cursor:positions};
    }
    // Verification reads identities only. Replay with the proven immutable IDs
    // before publishing, so no unrelated message body is stored as migration data.
    for(const s of streams){
      s.state.next='';s.state.history=[];s.state.pending=[];s.visited.clear();
      if(s.receiveOrder)s.pool=new Map();
      delete s.state.boundary;delete s.state.anchor;
    }
  }
  while(items.length<LIMIT){
    const before=revision;
    for(const s of streams){
      await head(s);
      if(issue==='MAIL_LIMIT')break;
    }
    if(before!==revision)continue;
    const ready=streams.filter(s=>s.state.pending.length&&!s.offsetBlocked&&!Object.hasOwn(s.state.pending[0],'folderId')&&
      (!s.receiveOrder||s.state.next===null)).sort((a,b)=>ordered(a.state.pending[0],b.state.pending[0]));
    if(!ready.length)break;
    const candidate=ready[0].state.pending[0];
    // A filtered or unavailable page may still contain a newer result. The last examined
    // rank bounds every unseen row in that stream; equality can still change the ID order.
    const unknown=streams.length>1&&streams.some(s=>{
      if(s.state.next===null)return false;
      if(s.offsetBlocked)return true;
      if(s.receiveOrder&&(!s.blocked||cursor||s.state.history.length||s.pool?.size||s.state.pending.length))return true;
      const stalled=!canRead(s)||s.blocked||issue==='MAIL_LIMIT'&&!s.state.pending.length;
      if(!stalled||s.blocked&&!cursor)return false; // preserve healthy results on a partial first search
      const bound=s.state.boundary;
      return (!s.state.pending.length||s.state.pending[0].rank===bound)&&(!Number.isFinite(bound)||candidate.rank<=bound);
    });
    if(unknown)break;
    const stream=ready[0],row=stream.state.pending.shift(),item=row.item;
    stream.drawn.push(row);
    if(!seen.has(item)&&!picked.has(item.graphId)){items.push(item);picked.add(item.graphId);}
  }
  for(const {state:s,pool} of streams){
    if(pool)s.pending=[...pool.values()].sort(ordered);
    s.pending=s.pending.filter(r=>!seen.has(r.item)&&!picked.has(r.item.graphId));
  }
  const more=streams.some(s=>s.state.pending.length||s.state.next!==null);
  const interrupted=streams.some(s=>(s.receiveOrder||s.offsetBlocked)&&s.state.next!==null&&(s.state.history.length||s.state.pending.length));
  if(issue&&!items.length&&!interrupted&&(!cursor||streams.every(s=>!s.state.history.length&&!s.state.pending.length)))throw fail(issue);
  return {items,more,...(more?{cursor:positions}:{}),...(issue?{code:issue}:{})};
}
async function searchMailbox({provider,address='',access,plan,fetch=globalThis.fetch,signal,cursor,previousItems=[],asOf=''}){
  current(signal);
  if(!providers.includes(provider)||!['all','received','inbox','sent','inbox_sent'].includes(plan?.folder)||!Array.isArray(previousItems)||
    asOf&&(typeof asOf!=='string'||!Number.isFinite(Date.parse(asOf))))throw fail('MAIL_PLAN');
  const names=provider==='gmail'?['gmail']:plan.folder==='inbox_sent'?['inbox','sent']:[plan.folder];
  const positions=paging(provider,address,plan,asOf,cursor,names),seen=identities(provider,previousItems,cursor?.legacyIds);
  const headers=bearer(access);if(provider==='outlook')headers.Prefer='IdType="ImmutableId"';
  const get=async url=>{
    let status;
    try{
      return await jsonRequest(async(target,options)=>{
        const response=await fetch(target,options);status=response.status;return response;
      },url,{method:'GET',headers},signal);
    }catch(e){e.httpStatus=status;throw e;}
  };
  const options={plan,asOf,get,positions,seen,cursor};
  const result=provider==='gmail'?await gmailPage(options):await outlookPage(options);
  current(signal);
  if(result.cursor&&seen.verified.size)result.cursor.legacyIds=[...seen.verified];
  return result;
}
function reviewMissingMailboxes(plan,bindings,prompt,proposal=null){
  // The caller supplies the accounts captured for this task, or their intersection with the previous receipt.
  if(plan?.provider!=='all'||!bindings.length)return proposal;
  const outside=searchWording(typeof prompt==='string'?prompt:'');
  const named=providers.map(id=>({id,quote:serviceNames[id].exec(outside)?.[0]}));
  if(named.some(item=>!item.quote))return proposal;
  const missing=named.filter(item=>!bindings.some(b=>b.provider===item.id));
  if(!missing.length)return proposal;
  // A previous card fixes the account identities. It does not by itself reuse the previous search filters.
  const instruction=outside.trim(),nextLocation=/^\s*[,，]?\s*['"‘“]?(?:gmail\b|outlook\b|지메일|아웃룩|find\b|search\b)/iu;
  const subset=/^(?:그\s*중(?:에서만|에서|에)?|(?:among|of)\s+(?:those|them))(?=[\s,，])/iu.exec(instruction);
  const period=/(?<![\p{L}\p{N}])(?:(?:같은|동일한)\s*기간(?:에는|에|으로|만)?|(?:(?:for|during|over|in)\s+)?the\s+same\s+(?:period|date range))(?=[\s,，.!?]|$)/iu.exec(instruction);
  const declined=/^\s*[,，]?\s*(?:말고|대신|아니|아닌|제외|상관\s*없이|except\b|instead\b)/iu;
  let requested=plan;
  if(subset){
    requested={...plan,inherit:!declined.test(instruction.slice(subset[0].length))};
  }else if(period){
    const before=instruction.slice(0,period.index),after=instruction.slice(period.index+period[0].length);
    const followsLocation=/(?:gmail|outlook|지메일|아웃룩)(?:\s*메일함)?에서\s*$/iu.test(before);
    if(!declined.test(after)&&(nextLocation.test(after)||followsLocation||plan.inherit&&/^\s*[.!?]?\s*$/u.test(after))){
      const clear=new Set([...(plan.clear||[]),'terms','from','folder','provider','attachment']);
      requested={...plan,inherit:true,clear:[...clear]};
    }
  }
  const reason=proposal?.reason==='followup'&&subset&&requested.inherit?'provider':proposal?.reason||'provider';
  const unmet=[...new Set([...(proposal?.unmet||[]),...missing.map(item=>item.quote)])];
  return {...proposal,reason,plan:requested,unmet,...(reason==='provider'?{}:{missingProviders:missing.map(item=>item.id)})};
}
function validMissingProviders(ids,unmet){
  return Array.isArray(ids)&&ids.length>0&&ids.length<=providers.length&&new Set(ids).size===ids.length&&Array.isArray(unmet)&&
    ids.every(id=>providers.includes(id)&&unmet.some(q=>typeof q==='string'&&serviceNames[id].exec(q)?.[0]===q));
}
function confirmedMailExclusions(review,available,previous){
  // Existing provider-only reviews recorded the missing service as an exact member quote.
  const ids=review.missingProviders|| (review.reason==='provider'?providers.filter(id=>validMissingProviders([id],review.unmet)):[]);
  return ids.filter(id=>!available.some(b=>b.provider===id)).map(provider=>{
    // Only the previous receipt identifies the mailbox the member meant to search.
    const address=previous?.groups.find(group=>group.provider===provider)?.address;
    return addressValid(address)?{provider,address}:{provider};
  });
}
module.exports={searchMailbox,validatePlan,reviewFilter,combinePlan,reviewMissingMailboxes,validMissingProviders,confirmedMailExclusions,searchScope,needsMailDecision,checkDecision,explicitPlan,sourceUrl,LIMIT};
