'use strict';

// Extract only the commercial fields from the current, unquoted message.
// Unknown clauses are significant: a second item, exception or discount can change the price.
const REQUEST_VERSION = 26;
const UNITS = ['편', '개', '장', '건', '세트', '부', '종'];
const countOnes = ['','한','두','세','네','다섯','여섯','일곱','여덟','아홉'];
const countTens = ['','열','스물','서른','마흔','쉰','예순','일흔','여든','아흔'];
const COUNTS = { 스무: 20 };
for (const [t, tens] of countTens.entries()) {
  for (const [u, ones] of countOnes.entries()) if (t || u) COUNTS[tens + ones] = 10*t + u;
}
const nativeCounts = Object.keys(COUNTS).sort((a,b) => b.length-a.length).map(word => {
  const tens = countTens.find(t => t && word.startsWith(t) && word !== t);
  return tens ? tens + '\\s*' + word.slice(tens.length) : word;
}).join('|');
const countOf = word => {
  const normalized = word.replace(/\s/g,'');
  return Object.hasOwn(COUNTS, normalized) ? COUNTS[normalized] : Number(normalized);
};
// A joined native numeral may also be an ordinary word, such as '세부 견적'.
const number = '(\\d{1,6}|(?<![가-힣])(?!(?:세부|세종|두부))(?:' + nativeCounts + '))';
const unit = '(' + UNITS.join('|') + ')';
const requestEnding = '(?:의?\\s*견적(?:서)?(?:을|를|이|가)?\\s*(?:부탁(?:드립니다|해요)|(?:요청|문의)(?:드립니다|합니다|드려요)|(?:회신|답변|회답)(?:을|를)?\\s*바랍니다|보내\\s*주세요|알려\\s*주세요|궁금(?:해요|합니다))?)?';
const orderLine = new RegExp('^(.{1,100}?)\\s+' + number + '\\s*' + unit + '(?:의|에\\s*대한|으로|에)?\\s*' + requestEnding + '$');
const orderCountEnd = '(?=$|[\\s,，;·+/)\\]}]|(?:이)?랑|과|와|및|하고|씩|도|만|으로|에|을|를|은|는|뿐|짜리|부터|까지)';
const embeddedOrder = new RegExp(number + '\\s*' + unit + orderCountEnd, 'u');
const quantityPeriod = String.raw`(?:매\s*(?:일|주|월|달|분기|반기|년|해)|(?:일|주|월|분기|반기|년)(?:\s*(?:마다|당|에))?)`;
const recurringOrder = new RegExp(String.raw`(?<![\p{L}\p{N}])`+quantityPeriod+String.raw`\s*`+number+String.raw`\s*`+unit+orderCountEnd+
  '|'+number+String.raw`\s*`+unit+String.raw`\s*씩\s*`+quantityPeriod+String.raw`(?=$|[^\p{L}\p{N}])`,'u');
const quantityLine = new RegExp('^(?:수량|주문\\s*수량)\\s*[:：은는]?\\s*' + number + '\\s*' + unit + '(?:입니다|이에요|예요)?$');
const revisionNumber = '(\\d{1,6}|' + nativeCounts + ')';
const revisionUpperLimit = new RegExp(String.raw`(?:최대\s*)?수정(?:\s*횟수)?\s*[:：]?\s*` + revisionNumber +
  String.raw`\s*회\s*(?:까지|이내|이하)(?:\s*(?:을|를)?\s*(기준)(?:으로|인|의)?)?(?![\p{L}\p{N}])`, 'gu');
// Consume one grammatical particle only together with the verified quantity or item it qualifies.
const oneParticle = '(?:\\s*(?:에\\s*대한|으로|의|에|로|을|를|은|는|이|가)(?=$|[\\s.,:;|·!?()[\\]。！？]))?';
const revisionHint = new RegExp('수정(?:\\s*횟수)?\\s*[:：]?\\s*' + revisionNumber + '\\s*회'+oneParticle+'(?:\\s*포함(?=$|[\\s)\\],·]))?', 'gu');
const revisionLine = new RegExp('^(?:수정(?:은|을|\\s*횟수(?:는)?)?\\s*[:：]?\\s*)' + revisionNumber + '\\s*회(?:를|로|가)?\\s*(?:원합니다|요청합니다|부탁드립니다|포함(?:해\\s*주세요)?|입니다|희망합니다)?$');
const titleDate=String.raw`(?<!\d)((?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}\s*-\s*\d{2}\s*-\s*\d{2})`;
const paymentCondition=new RegExp(String.raw`(?<![\p{L}])(?:결제|입금|지급|납부)(?:\s*(?:일정|일자|날짜|기한|시기|조건|마감|일)(?:은|는|이|가|을|를)?(?!\p{L})|(?:은|는|이|가)?\s*[:：]?\s*(?=`+titleDate+'))','u');
const otherDate=new RegExp(String.raw`(?<![\p{L}])(?:촬영|행사|전시|회의|공연|결제|게시|방송)(?:은|는|이|가)?(?:\s*(?:일정|일자|날짜|기간|일)(?:은|는|이|가)?(?=$|[\s:：\d])|\s*[:：]|\s*(?=`+titleDate+'))','u');
const bareDelivery=/(?<![\p{L}])납품(?:은|는|이|가|을|를)?(?=$|[\s:：\d])/u;
const dateOrCorrection=new RegExp(titleDate+'|날짜|기한|일정|정정|변경|바꾸|바꿔|미루|미뤄|당기','u');
const weekday=String.raw`(?:\s*(?:\(\s*[월화수목금토일](?:요일)?\s*\)|\[\s*[월화수목금토일](?:요일)?\s*\]|\s+[월화수목금토일]요일))?`;
const dateLine=new RegExp(String.raw`^(?:희망\s*)?(?:납품일|납기일?|납품\s*일정)(?:은|는|이|가)?\s*[:：]?\s*`+titleDate+weekday+String.raw`(?:\s*(까지))?`+weekday+String.raw`\s*(?:입니다|이에요|예요|(?:을|를)?\s*희망(?:합니다|해요)|로\s*부탁드립니다)?$`,'u');
const calendarRole=String.raw`((?:(?:고객\s*)?희망\s*)?(?:납품\s*일정|납품일?|납기일?)|(?:행사|촬영|전시|회의|공연|방송|게시|발표|접수|신청|문의|결제|주문)\s*(?:일정|일자|날짜|기간|일)|행사|촬영|전시|회의|공연)(?:은|는|이|가)?(?![\p{L}])`;
const titleDateToken=new RegExp(titleDate+weekday+String.raw`(?:\s*(까지))?`+weekday+String.raw`(?:에(?:는)?|은|는)?(?!\d)|`+calendarRole,'gu');
const normalize = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
const desiredDelivery = /^(?:고객\s*)?희망|희망(?:합니다|해요)$/u;

function deliveryDateLimit(label, until) {
  const desired = desiredDelivery.test(label);
  if (desired && until) return null;
  return Boolean(until) || (!desired && /^납기/u.test(label));
}

function titleDeliveries(title) {
  const entries=[],events=[];
  let ambiguous=false, weekdayIssue='', group=[];
  function finish(){
    if(group.some(t=>t.name) && group.some(t=>t.date)){
      // A bare project noun may describe the item. Every date and explicit role still needs its own partner.
      const choices=Array.from({length:group.length+1},()=>[]);
      choices[group.length]=[[]];
      for(let i=group.length-1;i>=0;i--){
        const left=group[i],right=group[i+1];
        const options=left.optional ? [...choices[i+1]] : [];
        if(right && Boolean(left.date)!==Boolean(right.date) && (!left.optional || left.mayIntroduceDate || left.colon)){
          const label=left.date?right:left, date=left.date?left:right;
          // Keep a possible deliverable (e.g. 촬영 견적) in the product-scope check.
          const entry={start:label.keepName?date.start:left.start,end:label.keepName?date.end:right.end,dateAt:date.start,
            date:date.date,delivery:label.delivery,shooting:/^촬영/u.test(label.name),limit:label.delivery && deliveryDateLimit(label.name,date.until),labelled:left.colon===true};
          for(const tail of choices[i+2])options.push([entry,...tail]);
        }
        const unique=new Map();
        for(const path of options){
          const key=path.map(x=>x.dateAt+'/'+x.delivery+'/'+x.limit+'/'+x.shooting).join(' ');
          const previous=unique.get(key);
          if(!previous || path.filter(x=>x.labelled).length>previous.filter(x=>x.labelled).length)unique.set(key,path);
        }
        choices[i]=[...unique.values()].slice(0,2);
      }
      if(choices[0].length===1){
        for(const entry of choices[0][0])(entry.delivery ? entries : events).push(entry);
      } else if(group.some(t=>t.delivery))ambiguous=true;
    }
    group=[];
  }
  const tokens=new RegExp(titleDateToken);
  let match;
  while((match=tokens.exec(title))){
    const [,date,until,name]=match;
    if(date && !weekdayIssue)weekdayIssue=weekdayConflict(date,match[0].slice(date.length));
    const previous=group.at(-1);
    const before=title.slice(0,match.index);
    if(name && /\p{L}$/u.test(before) && !(previous?.date && previous.end===match.index)){
      tokens.lastIndex=match.index+1;
      continue;
    }
    const after=title.slice(tokens.lastIndex);
    const token={start:match.index,end:match.index+match[0].length,date,until:Boolean(until),name,
      delivery:Boolean(name && /납품|납기/u.test(name)),optional:/^(?:행사|촬영|전시|회의|공연)$/u.test(name||''),
      colon:!!name && /^\s*[:：]/u.test(after),keepName:name==='촬영' || !!name && !/납품|납기/u.test(name) && /^\s*(?:견적|제작|의뢰|요청|영상|촬영비|비용)/u.test(after),
      mayIntroduceDate:!before.trim() || /[\p{P}\p{S}]\s*$/u.test(before) || !!previous && /^[\s:：]*$/u.test(title.slice(previous.end,match.index))};
    if(previous && !/^[\s:：]*$/u.test(title.slice(previous.end,token.start)))finish();
    group.push(token);
  }
  finish();
  return {entries,events,ambiguous,weekdayIssue};
}

function calendarKey(value){
  const compact=value.replace(/\s+/gu,'');
  const match=/^(?:(\d{4})년)?(\d{1,2})월(\d{1,2})일$/u.exec(compact) ||
    /^(\d{4})-(\d{2})-(\d{2})$/u.exec(compact);
  if(!match)return '';
  const year=match[1] ? Number(match[1]) : null, month=Number(match[2]), day=Number(match[3]);
  const leap=year===null || year%4===0 && (year%100!==0 || year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year===0 || month<1 || month>12 || day<1 || day>days[month-1])return '';
  return [year??'',month,day].join('/');
}

function weekdayConflict(date,suffix){
  const [year,month,day]=calendarKey(date).split('/').map(Number);
  if(!year)return '';
  const calendar=new Date(0);
  calendar.setUTCFullYear(year,month-1,day);
  const expected='일월화수목금토'[calendar.getUTCDay()];
  for(const mark of suffix.matchAll(/[([]\s*([월화수목금토일])(?:요일)?\s*[)\]]|([월화수목금토일])요일/gu)){
    const written=mark[1]||mark[2];
    if(written!==expected)return '메일에는 '+written+'요일이라고 적혀 있어요. '+date+'의 요일은 '+expected+'요일이니 일정을 확인해 주세요.';
  }
  return '';
}

function displayName(value) {
  const label = typeof value === 'string' ? value.replace(/\t/gu,' ') : '';
  return /[<>"\u0000-\u001f]/u.test(label) ? '' : normalize(label);
}

const linkWrappers=new Map([['(',')'],['<','>'],['〈','〉']]);
function referenceDisplay(token) {
  // Only formatting outside the URL is normalized. An explicit link which ends in punctuation keeps it inside.
  // An unwrapped query or fragment can end in punctuation that is part of its value.
  const bareWithQuery=/^https?:\/\/[^\s<>]*[?#]/iu.test(token);
  const suffix=bareWithQuery ? '' : token.match(/[.,!?;:。．，！？；：]+$/u)?.[0] || '';
  const main=suffix ? token.slice(0,-suffix.length) : token;
  const closing=linkWrappers.get(main[0]?.normalize('NFKC'));
  if(closing && main.at(-1)?.normalize('NFKC')!==closing)return null;
  const url=closing ? main.slice(1,-1) : main;
  if(!/^https?:\/\/[^\s<>]+$/iu.test(url))return null;
  try { if(!new URL(url).hostname)return null; } catch {return null;}
  return '<'+url+'>'+(closing ? suffix.normalize('NFKC') : suffix);
}
function portfolioReference(line) {
  const match=/^\s*((?:참고용\s*)?(?:포트폴리오|작품집|작업 사례))\s*(\S+)\s*$/u.exec(line);
  if(!match)return null;
  const url=referenceDisplay(match[2]);
  return url ? match[1]+' '+url : null;
}
function mentionsDeliveryDate(line, hasOtherDate = false) {
  return /납품\s*(?:일정|일자|날짜|일)|납기/u.test(line) ||
    (bareDelivery.test(line) && dateOrCorrection.test(line)) || (!hasOtherDate && /날짜/u.test(line));
}

function readQuoteRequest(body, subject, sender = '') {
  const facts = { version: REQUEST_VERSION, scope: '', quantity: null, unit: '', revisions: null, deadline: '', review: false };
  const disputed = new Set();
  let sawOrderLine=false, sawScopeLabel=false, sawQuantityLabel=false;
  function addCondition(reason){
    facts.conditionConflict=[facts.conditionConflict,reason].filter(Boolean).join(' ');
  }
  function disputeDeadline(reason){
    if(reason)addCondition(reason);
    disputed.add('deadline');
    facts.review=true;
    facts.deadline='';
    delete facts.deadlineIsLimit;
  }
  function put(key, value) {
    if (disputed.has(key)) return;
    if (facts[key] !== '' && facts[key] !== null && facts[key] !== value) {
      facts.review = true;
      disputed.add(key);
      facts[key] = typeof value === 'number' ? null : '';
    } else facts[key] = value;
  }
  function putOrder(scope, qty, measure) {
    if (scope) put('scope', normalize(scope));
    const value = countOf(qty);
    if (value < 1 || value > 100000) facts.review = true;
    else { put('quantity', value); put('unit', measure); }
  }
  const otherCount = /(?:촬영|회의|공연|방문|결제|배송|주문)(?:\s*횟수)?(?:은|는|이|가)?\s*[:：]?\s*\S+\s*회/u;
  let previousDateWasOther=false,previousCountWasOther=false;
  const clauses = body.normalize('NFKC')
    .split('\n').filter(line=>!portfolioReference(line)).join('\n')
    .replace(/[,，]\s*(?=(?:수정(?:은|을|\s*횟수)?|(?:희망\s*)?(?:납품일|납기일?|납품\s*일정))(?:은|는|[:：\s]))/gu, '\n')
    .replace(/회로\s*(?:바꾸고|변경하고)\s*,?\s*(?=(?:희망\s*)?(?:납품일|납기))/gu, '회\n')
    .replace(/\?/gu, '?\n').split(/[\n;!。！]+|[.](?!\d)/u);
  for (let index=0;index<clauses.length;index++) {
    const line = normalize(clauses[index]).replace(/^[-*•]\s+/u, '');
    const correction=/^(?:정정(?:합니다|할게요|드립니다)?|바로잡습니다)\s*[:,，：]?\s*(.*)$/u.exec(line);
    if(correction){
      const next=normalize(correction[1] || clauses[index+1] || '').replace(/^[-*•]\s*/u,'')
        .replace(/(?:으)?로\s*(?:변경(?:합니다|해\s*주세요)|바꿉니다|바꿔\s*주세요)$/u,'로 부탁드립니다');
      // An unlabelled correction follows the most recent role for that value (e.g. a shoot date, not delivery).
      const nextOtherDate=otherDate.test(next);
      const labelledDate=dateLine.exec(next);
      const date=labelledDate || dateLine.exec('납품일 '+next);
      if(nextOtherDate || otherCount.test(next) ||
         previousDateWasOther && !labelledDate && date ||
         previousCountWasOther && !revisionLine.test(next) && revisionLine.test('수정 '+next)){
        if(nextOtherDate)previousDateWasOther=true;
        facts.review=true;
        if(!correction[1])index++;
        continue;
      }
      const revisions=revisionLine.exec(next) || revisionLine.exec('수정 '+next);
      facts.review=true;
      const weekdayIssue=date && weekdayConflict(date[1],date[0]);
      const limit=date && deliveryDateLimit(next,date[2]);
      if(weekdayIssue)disputeDeadline(weekdayIssue);
      else if(date && limit===null)disputeDeadline('메일의 날짜가 희망 납품일인지 꼭 지켜야 할 기한인지 확인해 주세요.');
      else if(date && facts.deadline && calendarKey(date[1]) && !disputed.has('deadline')){
        previousDateWasOther=false;
        facts.deadline=date[1];
        if(limit)facts.deadlineIsLimit=true;
        else if(labelledDate || desiredDelivery.test(next))delete facts.deadlineIsLimit;
      } else if(revisions && facts.revisions!==null && !disputed.has('revisions')){
        facts.revisions=countOf(revisions[1]);
      } else {
        const dateCorrection=mentionsDeliveryDate(next) || /월|\d{4}-/u.test(next);
        if(/수정|회/u.test(next) || !dateCorrection){
          facts.revisions=null;disputed.add('revisions');
        }
        if(dateCorrection || !/수정|회/u.test(next))disputeDeadline();
      }
      if(!correction[1] && (date || revisions))index++;
      continue;
    }
    const hasOtherDate=otherDate.test(line);
    if(hasOtherDate)previousDateWasOther=true;
    else if(dateLine.test(line))previousDateWasOther=false;
    if(otherCount.test(line))previousCountWasOther=true;
    else if(revisionLine.test(line))previousCountWasOther=false;
    if (/^(?:안녕하세요|감사합니다)[,，]?$/u.test(line)) continue;
    if (line.includes('?')) {
      facts.review = true;
      if (/수정/u.test(line)) { disputed.add('revisions'); facts.revisions = null; }
      if (mentionsDeliveryDate(line,hasOtherDate)) disputeDeadline();
      continue;
    }
    if (!line || /^(?:견적(?:서)?(?:을|를)?\s*(?:부탁드립니다|(?:요청|문의)(?:드립니다|합니다|드려요))|고맙습니다)$/u.test(line)) continue;
    let match = quantityLine.exec(line);
    if (match) {
      if (sawQuantityLabel) facts.review=true;
      sawQuantityLabel=true;
      putOrder('', match[1], match[2]); continue;
    }
    match = /^(?:품목|납품물|제작물|납품 범위)\s*[:：]\s*(.{1,100})$/u.exec(line);
    if (match) {
      if (sawScopeLabel) facts.review=true;
      sawScopeLabel=true;
      if (embeddedOrder.test(match[1])) facts.review=true;
      put('scope', normalize(match[1])); continue;
    }
    match = orderLine.exec(line);
    if (match) {
      if (sawOrderLine || embeddedOrder.test(match[1])) facts.review = true;
      sawOrderLine=true;
      putOrder(match[1], match[2], match[3]); continue;
    }
    match = revisionLine.exec(line.replace(/회(?:로|로\s*변경해|로\s*바꿔)\s*주세요$/u,'회'));
    if (match) { put('revisions', countOf(match[1])); continue; }
    if (/^수정(?:은)?\s*(?:없음|없이|없습니다)$/u.test(line)) { put('revisions', 0); continue; }
    match = dateLine.exec(line);
    if (match) {
      const key=calendarKey(match[1]);
      const limit=deliveryDateLimit(line,match[2]);
      const weekdayIssue=weekdayConflict(match[1],line);
      if(weekdayIssue){disputeDeadline(weekdayIssue);continue;}
      if(limit===null)disputeDeadline('메일의 날짜가 희망 납품일인지 꼭 지켜야 할 기한인지 확인해 주세요.');
      else if(!key || facts.deadline && (key!==calendarKey(facts.deadline) || limit!==Boolean(facts.deadlineIsLimit)))disputeDeadline();
      else if(!disputed.has('deadline') && !facts.deadline){
        facts.deadline=match[1];
        if(limit)facts.deadlineIsLimit=true;
      }
      continue;
    }
    if (/수정/u.test(line)) { disputed.add('revisions'); facts.revisions=null; }
    if (mentionsDeliveryDate(line,hasOtherDate)) disputeDeadline('납품일 변경 내용을 원문에서 확인해 주세요.');
    facts.review = true;
  }
  // A complete labelled order and a separate order line can be two orders at the same unit price.
  if (sawOrderLine && sawScopeLabel && sawQuantityLabel) facts.review = true;
  // An explicit replacement in the subject contributes the requested count only. A range word before or
  // after it (최대 · 까지 · 이내 …) keeps the whole phrase, so the title is checked as a qualified count.
  const correctedRevision=new RegExp('(?<!(?:최대|최소|약)\\s*)수정\\s*'+revisionNumber+'\\s*회(?:가|이)?\\s*(?:아닌|아니라|말고)\\s*(?:수정\\s*)?'+revisionNumber+'\\s*회(?!\\s*(?:까지|이내|이상|이하|미만|초과|내외|정도|쯤))','gu');
  subject=String(subject || '').replace(correctedRevision,(_match,oldCount,newCount)=>'수정 '+newCount+'회');
  const normalizedTitle=normalize(subject);
  const hasPaymentCondition=paymentCondition.test(normalizedTitle) || clauses.some(line=>paymentCondition.test(line));
  if (unitJoinedToItem(subject, facts)) facts.review = true;
  const heading = subjectAssessment(subject, facts, sender);
  if (heading === 'conflict' && !exactInquiryTitle(subject, facts, sender)) {
    facts.review = true;
    if (/수정/u.test(subject)) {
      const hints=[...subject.matchAll(revisionHint)];
      const qualified=/(?:아닌|아니라|말고|정정)/u.test(subject) || hints.some(match=>/^\s*(?:까지|이내|이상|이하|미만|초과|내외|정도|쯤)/u.test(subject.slice(match.index+match[0].length)) || /(?:최대|최소|약)\s*$/u.test(subject.slice(0,match.index)));
      const counts=[...new Set(hints.map(match=>countOf(match[1])))];
      if(qualified)addCondition('제목의 수정 범위와 본문에 적힌 횟수를 확인해 주세요.');
      else if (facts.revisions !== null && counts.some(value=>value!==facts.revisions)) {
        addCondition('제목에는 수정 '+counts.join('회·')+'회, 본문에는 수정 '+facts.revisions+'회로 적혀 있어요. 이번 수정 횟수를 확인해 주세요.');
      }
      if(qualified || !counts.length || counts.some(value=>value!==facts.revisions) || /수정/u.test(subject.replace(revisionHint,'')))facts.revisions=null;
    }
    const {entries:deliveries,ambiguous,weekdayIssue}=titleDeliveries(normalize(subject));
    if (weekdayIssue || ambiguous || deliveries.length || /납품일|납기|납품\s*일정/u.test(subject)) {
      const dates=[...new Set(deliveries.map(entry=>entry.date))];
      const bodyDate=calendarKey(facts.deadline);
      const differentDate=dates.some(value=>!bodyDate || calendarKey(value)!==bodyDate);
      const differentMeaning=deliveries.some(entry=>entry.limit!==Boolean(facts.deadlineIsLimit));
      if(weekdayIssue){
        disputeDeadline(weekdayIssue);
      } else if(ambiguous){
        addCondition('제목에 여러 일정이 적혀 있어요. 원문에서 납품일을 확인해 주세요.');
      } else if (bodyDate && differentDate) {
        const particle = /[036]$/u.test(facts.deadline) ? '으로' : '로';
        addCondition('제목에는 '+dates.join('·')+', 본문에는 '+facts.deadline+particle+' 적혀 있어요. 납품일을 확인해 주세요.');
      } else if (bodyDate && differentMeaning) {
        addCondition('메일에 적힌 날짜('+facts.deadline+')가 희망 납품일인지 꼭 지켜야 할 기한인지 확인해 주세요.');
      }
      if(ambiguous || !dates.length || differentDate || differentMeaning)disputeDeadline();
    }
  }
  if(recurringOrder.test(normalizedTitle) || clauses.some(line=>recurringOrder.test(line))){
    facts.review=true;
    facts.quantity=null;
    addCondition('기간별 수량이 적혀 있어요. 이번 견적의 총수량을 확인해 주세요.');
  }
  if(hasPaymentCondition){
    facts.review=true;
    addCondition('메일에 적힌 결제 조건을 확인하고 견적 작성에서 반영해 주세요.');
  }
  if (heading === 'confirm') facts.checkTitle = true;
  // 「지난번처럼 해줘」의 금액은 닫힌 꼴의 제목(exactInquiryTitle)일 때만 제목 확인 없이 낸다. 제목 낱말을 하나씩 지워
  // 'clear'로 읽는 길은 검수마다 새 빈틈이 나왔다(0.5.8 검수 GPT-O). 목록 요약은 checkTitle만 본다.
  // 보낸 사람 이름 앞붙임은 금지 낱말로 거르는 열린 칸이라 여기서는 받지 않는다(0.5.8 Fable 설계 검토 — 「[당일] … 견적」).
  if (heading !== 'confirm' && exactInquiryTitle(subject, facts, sender, false)) facts.exactTitle = true;
  return facts;
}

const TITLE_UNITS = UNITS.join('|');
const countEnd = '(?=$|[^가-힣]|(?:으로|에|의|은|는|이|가|을|를|만|씩|도|로|부터|까지|짜리|미만|이상|이하|초과|정도|뿐))';
const pricedCount = new RegExp('(?<![가-힣\\da-z])(' + nativeCounts + '|\\d{1,6})\\s*(' + TITLE_UNITS + ')' + countEnd + oneParticle, 'giu');
// Only complete combinations of known heading words can be price-neutral.
const headingWords = new Set((
  '견적 견적서 견적문의 견적요청 견적서요청 견적드립니다 문의 문의드립니다 문의합니다 문의드려요 요청 요청드립니다 요청합니다 부탁 부탁드립니다 ' +
  '신청 의뢰 확인 수량 주문 계약 판매 제작 건 건의 대한 에대한 신규 새 신상품 제품 봄 작업 기준 세부 내용 사항 일정 간단한 상세 어제 문의한 ' +
  '부분 대표 담당자 안녕하세요 감사합니다 드립니다 바랍니다 합니다 주 외부 외부메일 솔리오'
).trim().split(/\s+/u));
const quoteWording = /^(?:세부|상세)?견적(?:서)?(?:(?:문의|요청|의뢰|부탁)(?:드립니다|합니다|드려요)?)?$/u;
const otherHeadings = new Set(['re','fw','fwd','대한','입니다','건으로','견적을','견적서를','견적을부탁드립니다','견적서를요청드립니다']);
const productionHeadings = new Set(['제작','제작에','제작에대한','제작건','제작문의','제작견적','제작에대한견적']);
const sinoNumber = '[일이삼사오육칠팔구십백천만一二三四五六七八九十]+';
const quantityBoundary = '(?=$|[^\\p{L}\\p{N}]|뿐|만|의|에|은|는|을|를|으로|로|부터|까지|이상|이하|쯤)';
const uncertainSeparated = new RegExp(sinoNumber+'(?:여)?\\s+(?:'+TITLE_UNITS+'|회)'+quantityBoundary,'u');
const uncertainJoined = new RegExp('(?<![가-힣])'+sinoNumber+'(?:'+TITLE_UNITS+'|회)'+quantityBoundary,'u');
const anyUnit = new RegExp(TITLE_UNITS+'|회','u');
// Only a whole neutral word or an explicit combination of this item and a quote phrase is eligible.
function scopeInHeading(word, names) {
  for (const scope of names.keys()) {
    if (!word.startsWith(scope)) continue;
    const remaining = word.slice(scope.length);
    if (!remaining || remaining === '제작' || quoteWording.test(remaining)) return names.get(scope);
  }
  return null;
}
const surnames = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차우주';
const escapePattern = text => text.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
const priceLanguage = /[\d%₩$€]|원본|썸네일|할인|급행|긴급|납품|예산|부가세|비용|장비비|인쇄|양면|단면|가로|세로|고화질|코팅|수정|차감|가격|추가|포함|사용권|제외|이상|이하|제공|규격|무료|유료|제작|별도|사양|견적|각각|마다/u;
const labelledProject = /^(?:[가-힣A-Za-z]{1,20}\s+){1,3}프로젝트$/u;
const labelledContact = /^담당자\s*[:：]\s*[가-힣A-Za-z]{2,12}$/u;

const caseSubject = /(?:^| )(?:행사|프로젝트|작업|영상|디자인|인터뷰|촬영|전시|인쇄|교육)$/u;
function unitJoinedToItem(subject, facts) {
  if (!facts.scope || caseSubject.test(facts.scope)) return false;
  const ending = facts.scope.split(' ').at(-1);
  const left = /^\d/u.test(ending) ? '(?<!\\d)' : '';
  const full = facts.scope.split(' ').map(escapePattern).join('\\s*');
  const abbreviated = left+escapePattern(ending);
  const gap = '[^\\p{L}\\p{N}]';
  // The whole item may abut a unit. A lone ordinary suffix must be a separate word (홍보 in 홍보부 is not one).
  const needsGap = /^\d|[\d]$/u.test(ending) || Object.hasOwn(COUNTS,ending) ? '*' : '+';
  const sequence = new RegExp('(?:'+full+gap+'*|'+abbreviated+gap+needsGap+')('+TITLE_UNITS+'|회)'+quantityBoundary,'giu');
  for (const match of normalize(subject).matchAll(sequence)) {
    if (countOf(ending) !== facts.quantity || match[1] !== facts.unit) return true;
  }
  return false;
}

function subjectAssessment(subject, facts, sender) {
  const originalTitle = normalize(subject);
  // Price-related ambiguity is terminal and is checked before consuming a name, quantity or particle.
  const exactScope = facts.scope && new RegExp('(?<![\\p{L}\\p{N}])'+
    facts.scope.split(' ').map(escapePattern).join('\\s*')+'(?=$|[^\\p{L}\\p{N}])','giu');
  const outsideScope = exactScope ? originalTitle.replace(exactScope,' ') : originalTitle;
  if (uncertainSeparated.test(originalTitle) || uncertainJoined.test(outsideScope) ||
      (facts.unit !== '부' || facts.quantity !== 3) && /(?<![가-힣])세\s+부(?=$|[^\p{L}\p{N}])/u.test(originalTitle)) return 'conflict';
  let title = originalTitle
    .replace(/\[(?:문의|접수|관리)\s*번호\s*[:#：]?\s*[A-Z0-9-]{1,36}\]/giu,' ')
    .replace(/^(?:(?:re|fw|fwd)\s*(?:\[\d+\]|\(\d+\))?\s*:\s*)+/i,' ').trim();
  const scopeWords = (facts.scope || '').split(' ').filter(Boolean);
  const product = scopeWords.at(-1) || '';
  const delivery=titleDeliveries(title);
  if(delivery.ambiguous || delivery.weekdayIssue)return 'conflict';
  for(const term of [...delivery.entries,...delivery.events].sort((a,b)=>b.start-a.start)){
    const {start,end,date,limit}=term;
    if(term.shooting && (!/촬영/u.test(facts.scope) || /촬영\s*(?:은|을|이|비)?\s*(?:제외|별도|없이|미포함|불포함|없음|불필요)|(?:제외|별도)\s*촬영/u.test(facts.scope)))return 'conflict';
    if(!calendarKey(date) || term.delivery && (calendarKey(facts.deadline)!==calendarKey(date) || limit!==Boolean(facts.deadlineIsLimit)))return 'conflict';
    title=title.slice(0,start)+' '+title.slice(end);
  }
  // Ignore an empty section left after removing the customer's dates.
  if(delivery.entries.length || delivery.events.length)title=title.replace(/^(?:\s*[/·,;|]\s*)+/u,'');
  title=title.replace(/(?:\s*[/·,;|]\s*)+$/u,'').trim();
  const senderName = displayName(sender);
  // A label may not conceal any possible count, even if it has an unresolved suffix such as '쯤'.
  const labelCount = new RegExp('(?:'+nativeCounts+'|[일이삼사오육칠팔구십백천만一二三四五六七八九十]+|\\d+)\\s*(?:'+TITLE_UNITS+'|회)','iu');
  const safeIdentity = value => !priceLanguage.test(value) && !labelCount.test(value);
  const senderWords = senderName.toLowerCase().split(' ');
  let needsCheck = facts.unit === '부' && /세부\s*(?:견적|문의|내역|내용|사항|일정)/u.test(originalTitle);
  const safeSender = safeIdentity(senderName) && !anyUnit.test(senderName) && !Object.hasOwn(COUNTS,senderName.replace(/\s/g,'')) && !senderWords.some(word =>
    scopeWords.some(item => item.toLowerCase() === word) || /^(?:가로|세로|양면|단면|고화질|고급|각|약)$/u.test(word));
  if (/^[가-힣A-Za-z]{1,30}(?: [가-힣A-Za-z]{1,30}){0,3}$/u.test(senderName) && safeSender) {
    const literal = escapePattern(senderName);
    const prefix = new RegExp('^(?:\\[\\s*'+literal+'\\s*\\]|\\(\\s*'+literal+'\\s*\\)|'+literal+'(?=\\s|[:：]))','u').exec(title);
    if (prefix) {
      const after = title.slice(prefix[0].length).trim();
      // An unmarked name can itself describe the item. The rest of the title must independently identify this product.
      const hasItem = product && after.toLowerCase().includes(product.toLowerCase());
      const startsWithScope = exactScope && after.search(exactScope) === 0;
      const startsWithUnit = new RegExp('^(?:'+TITLE_UNITS+'|회)'+quantityBoundary,'u').test(after);
      if (!startsWithScope && startsWithUnit) return 'conflict';
      if (!hasItem) {
        // If only a neutral request follows the sender, the owner can check the label. A price or item cannot disappear.
        const onlyRequest = after.replace(/\s+/gu,'').replace(/[.!?。！？]+$/u,'');
        if (!quoteWording.test(onlyRequest) && !(onlyRequest==='' && delivery.entries.length)) return 'conflict';
        if (!/(?:상사|기업|주식회사)$/u.test(senderName)) needsCheck = true;
      }
      title = after;
    }
  }
  let quantities = 0, revisions = 0, itemGroup = -1;
  const mentioned = new Set();
  // A project label cannot carry any priced unit, even if its preceding approximate count is unknown.
  const isProject = value => labelledProject.test(value) && safeIdentity(value) &&
    !anyUnit.test(value) && !(product.length > 1 && value.includes(product));
  if (scopeWords.length > 1 && title.toLowerCase().startsWith('['+scopeWords[0].toLowerCase()+']')) {
    const rest = title.slice(scopeWords[0].length+2).trimStart();
    if (rest.toLowerCase().startsWith(scopeWords[1].toLowerCase())) title = scopeWords[0]+' '+rest;
  }
  // An unbracketed project label is allowed only as its own leading phrase before the quote heading.
  title = title.replace(/^((?:[가-힣A-Za-z]{1,20}\s+){1,3}프로젝트)\s+(?=(?:견적|문의|요청))/u,(all,label) => {
    if (!isProject(label)) return all;
    needsCheck = true;
    return ' ';
  });
  const phrases = [...new Set([scopeWords.join(' '),scopeWords.slice(-2).join(' '),...scopeWords])]
    .filter(word => word && !/^\d+$/.test(word) && !Object.hasOwn(COUNTS,word)).sort((a,b)=>b.length-a.length);
  const scopeNames = new Map(phrases.map(phrase => [phrase.replace(/\s/g,'').toLowerCase(), phrase.split(' ')]));
  const scopePatterns = phrases.map(phrase => {
    const literal = phrase.split(' ').map(escapePattern).join('\\s*');
    const suffix = /\d$/.test(phrase) ? '' : '|(?:\\d{1,6}|'+nativeCounts+')\\s*(?:'+TITLE_UNITS+')';
    const pattern = new RegExp('(?<![가-힣\\da-z])'+literal+'(?=$|[^가-힣\\da-z]'+suffix+'|(?:으로|에|의|을|를|은|는|이|가|로)(?=\\s|$))'+oneParticle,'giu');
    return {pattern, words:phrase.split(' ')};
  });
  const titledName = new RegExp('^\\s*['+surnames+']\\s+(?:대표|사장|이사|실장|팀장)님(?=\\s|$)','u');
  // Keep each parenthesis, bracket and clause separate. An identified label can never clear a different clause.
  const groups = title.match(/\([^()[\]]*\)|\[[^()[\]]*\]|[^()[\],;|·]+|[()[\]]/gu) || [];
  for (const [groupIndex, original] of groups.entries()) {
    const bracketed = (original.startsWith('(') && original.endsWith(')')) ||
      (original.startsWith('[') && original.endsWith(']'));
    let part = (bracketed ? original.slice(1,-1) : original).trim();
    if (!part) continue;
    if (itemGroup !== -1 && /^제작(?:에대한)?견적(?:서)?(?:(?:문의|요청)(?:드립니다|합니다)?)?$/u.test(part.replace(/\s+/gu,''))) continue;
    if (bracketed && (isProject(part) || labelledContact.test(part) && safeIdentity(part))) {
      needsCheck = true;
      continue;
    }
    if (!scopeWords.includes('매장')) part=part.replace(/(?<![가-힣])세종\s+매장(?=\s|$)/gu,' ');
    part = part.replace(/(?<![가-힣])이\s+부분(?=$|\s)/gu,'부분');
    part = part.replace(titledName,' ').replace(/(?<![가-힣])[가-힣]{2,5}님(?=$|[\s.,])/gu,' ');
    part = part.replace(/(?<![가-힣])세부(?=\s*(?:견적|문의|내역|내용|사항|일정))|(?<![가-힣])세종(?=\s*(?:매장|시청|지역))/gu, term => {
      if (facts.unit === (term === '세부' ? '부' : '종')) needsCheck = true;
      return ' ';
    });
    let conflict = false;
    function mention(words) {
      if ((itemGroup !== -1 && itemGroup !== groupIndex) || words.some(word => mentioned.has(word))) conflict = true;
      itemGroup = groupIndex;
      for (const word of words) mentioned.add(word);
    }
    // The longest complete item is a single mention. A second clause cannot hide a partial repeat of that item.
    for (const {pattern,words} of scopePatterns) {
      part = part.replace(pattern,() => { mention(words); return ' '; });
    }
    part = part.replace(revisionUpperLimit,(_full,n,basis,index,text) => {
      const max = countOf(n);
      const quotedBasis = basis || /(?:^|[\s:：])기준\s*[:：]?\s*$/u.test(text.slice(0,index));
      if (++revisions > 1 || facts.revisions === null || (quotedBasis ? facts.revisions !== max : facts.revisions > max)) conflict = true;
      return ' ';
    });
    part = part.replace(revisionHint,(_full,n) => {
      if (++revisions > 1 || facts.revisions !== countOf(n)) conflict = true;
      return ' ';
    });
    part = part.replace(pricedCount,(_full,n,unit) => {
      if (++quantities > 1 || facts.quantity !== countOf(n) || facts.unit !== unit) conflict = true;
      return ' ';
    });
    if (conflict || /[\d%₩$€]|(?:원본\s*파일|할인|급행|긴급|납품일|예산|부가세|추가비|사용권|미포함|무료로|유료로|초과|미만|이내|넘는)/u.test(part)) return 'conflict';
    part = part.replace(/[-–—](?=\s*(?:견적|문의|요청))/gu,' ');
    const remaining = part.split(/[\s:：.,;|·!?。！？]+/u).filter(Boolean);
    for (const raw of remaining) {
      const word = raw.toLowerCase();
      const item = scopeInHeading(word,scopeNames);
      if (item) { mention(item); if (conflict) return 'conflict'; continue; }
      if (/^(?:제품|신상품|상품)$/u.test(word) && !/(?:제품|상품)/u.test(facts.scope)) return 'conflict';
      if (/^(?:신상품|신규|새)$/u.test(word) && /기존|구형|이전|중고|구제품|구상품/u.test(facts.scope)) return 'conflict';
      if (productionHeadings.has(word)) {
        if (itemGroup !== -1 && itemGroup !== groupIndex) return 'conflict';
        itemGroup = groupIndex;
        continue;
      }
      if (groups.length > 1 && itemGroup !== groupIndex && /^(?:매장|진열|신상품|제품|판매|작업)$/u.test(word)) return 'conflict';
      if (headingWords.has(word) || otherHeadings.has(word) || quoteWording.test(word) || /^[-–—]+$/u.test(word)) continue;
      return 'conflict';
    }
  }
  return needsCheck ? 'confirm' : 'clear';
}


// 반복 견적의 금액 앞에서 제목 확인이 필요한지. 닫힌 꼴의 제목이 아니면 대표가 제목과 원문을 대조한다.
function titleNeedsConfirmation(facts) {
  return facts?.version === REQUEST_VERSION && !facts.review && (!!facts.checkTitle || facts.exactTitle !== true);
}

// This positive form compares the complete title. Neither a second item nor a different quantity can be dropped.
// withSender: 'conflict' 판정을 거두는 데는 보낸 사람 이름 앞붙임도 받는다. 금액을 확인 없이 내는 데(exactTitle)는 받지 않는다.
function exactInquiryTitle(subject, facts, sender, withSender = true) {
  if (facts.review || !facts.scope || !facts.quantity || !facts.unit || facts.revisions === null) return false;
  const scope = normalize(facts.scope).toLowerCase();
  if (!/^[가-힣a-z0-9 ]{2,100}$/u.test(scope) || /\d$/u.test(scope) ||
      (facts.unit === '부' && scope.includes('세부')) || (facts.unit === '종' && scope.includes('세종'))) return false;
  // A price or separate quantity inside the item itself needs the ordinary editor.
  const explicitUnit = new RegExp('(?:\\d+|(?<![가-힣])(?:'+nativeCounts+'|'+sinoNumber+'))\\s+(?:'+TITLE_UNITS+'|회)'+quantityBoundary,'u');
  if (explicitUnit.test(scope) || /(?:\d+\s*(?:편|장|개|건|세트|부|종|회)|추가|할인|별도|미포함|급행|긴급)/u.test(scope)) return false;
  const title = normalize(subject).toLowerCase();
  const name = displayName(sender).toLowerCase();
  const company = /^([가-힣a-z]{2,18}?)\s*(?:주식회사|상사|기업|건설|건축|협회|연구소)$/u.exec(name);
  const stem = company ? company[1] : name;
  const safeName = withSender && /^[가-힣a-z]{2,24}$/u.test(stem) && stem !== scope && !scope.split(' ').includes(stem) && !anyUnit.test(stem) && !priceLanguage.test(stem) &&
    !new RegExp('^(?:'+nativeCounts+'|'+sinoNumber+')(?:여|쯤)?$','u').test(stem);
  const requests = ['견적','견적 문의','견적 요청','견적 문의드립니다','견적 요청드립니다','견적을 부탁드립니다'];
  const quantity = facts.quantity+facts.unit;
  const items = [scope, scope+'에 대한', scope+' '+quantity, scope+' '+quantity+'에 대한'];
  // Joining '건으로' to a number would manufacture a second quantity from the product suffix.
  if (caseSubject.test(scope)) items.push(scope+' 건으로');
  const prefixes = [''];
  if (safeName) {
    prefixes.push('['+name+'] ', '('+name+') ');
    if (company) prefixes.push(name+' ');
  }
  for (const prefix of prefixes) {
    for (const request of requests) {
      if (prefix && company && title === prefix+request) return true;
      if (items.some(item => title === prefix+item+' '+request)) return true;
    }
  }
  return false;
}

function repeatProposal(source, thread, options, quoteFields) {
  const method = source.repeatMethod;
  const facts = thread.quoteRequest;
  const format = source.replyFormat || 'paragraph';
  const notes = [], lines = [], questions = [];
  let fields = null, needsRevisionMinutes = false, needsAllocation = false;
  const needsTitleConfirmation = titleNeedsConfirmation(facts);
  if (!facts || facts.version !== REQUEST_VERSION || facts.review) {
    notes.push('원문에서 모든 견적 조건을 확인하기 어려워요. 메일을 확인하고 견적 작성에서 조건을 정해 주세요.');
    if (facts?.version === REQUEST_VERSION) {
      if (facts.conditionConflict) notes.push(facts.conditionConflict);
      const details = [];
      if (Number.isInteger(facts.revisions)) details.push('수정 ' + facts.revisions + '회');
      if (facts.deadline) details.push(facts.deadlineIsLimit ? '납품 기한 '+facts.deadline+'까지' : '희망 납품일 ' + facts.deadline);
      if (details.length) notes.push('이번 메일에는 ' + details.join(', ') + ' 조건이 적혀 있어요.');
    }
  } else {
    const matches = facts.scope && normalize(source.scope) === facts.scope && facts.unit === method.unit;
    if (!facts.scope) questions.push('필요한 납품물을 알려주실 수 있을까요?');
    if (!facts.quantity) questions.push('필요한 수량을 알려주실 수 있을까요?');
    if (needsTitleConfirmation && options.confirmedTitle !== true) notes.push('제목에 별도 조건이 있는지 이번 문의와 대조해 주세요. 다른 요청이 있으면 일반 견적 작성에서 반영해 주세요.');
    if (!matches) notes.push('이번 품목과 단위에 적용할 가격표를 확인해 주세요.');
    if (facts.revisions === null) questions.push('필요한 수정 횟수를 알려주실 수 있을까요?');
    else lines.push('요청하신 수정 횟수는 ' + facts.revisions + '회입니다.');
    needsRevisionMinutes = !!matches && facts.revisions !== null && facts.revisions > 0 && facts.revisions !== method.includedRevisions;
    needsAllocation = !!matches && source.allocation !== 0;
    if (needsRevisionMinutes && options.revisionMinutes == null) notes.push('기억한 가격은 수정 ' + method.includedRevisions + '회 기준이에요. 이번 ' + facts.revisions + '회에 필요한 ' + facts.unit + '당 수정 시간을 확인해 주세요.');
    if (needsAllocation && options.allocation == null) notes.push('구독료는 일감마다 달라요. 이번 견적에 배분할 금액을 확인해 주세요.');
    if (!notes.length && matches && facts.quantity && facts.revisions !== null) {
      fields = quoteFields({
        title: thread.subject.slice(0,200), scope: facts.scope, quantity: facts.quantity,
        buildMinutes: source.buildMinutes,
        revisionMinutes: facts.revisions === 0 ? 0 : (needsRevisionMinutes ? options.revisionMinutes : source.revisionMinutes),
        directCost: source.directCost, subcontractCost: source.subcontractCost, hourlyRate: source.hourlyRate,
        allocation: needsAllocation ? options.allocation : 0, taxMode: source.taxMode,
        deadline: facts.deadline + (facts.deadline && facts.deadlineIsLimit ? '까지' : ''), terms: '수정 ' + facts.revisions + '회 기준', replyFormat: format,
      });
      const won = n => n.toLocaleString('ko-KR') + '원';
      if (fields.taxMode === 'add10') lines.push('공급가액 ' + won(fields.subtotal) + ', 부가세 포함 예상 금액 ' + won(fields.total) + '입니다.');
      else lines.push('예상 공급가액은 ' + won(fields.subtotal) + '입니다. ' + (fields.tax === null ? '부가세 조건은 확인 후 안내드리겠습니다.' : '이 견적에는 부가세를 더하지 않았습니다.'));
    }
    if (facts.scope) lines.unshift('요청하신 ' + facts.scope + (facts.quantity ? ' ' + facts.quantity + facts.unit : '') +
      (fields ? ' 기준으로 계산했습니다.' : '의 견적을 준비하고 있습니다.'));
    if (facts.deadline) lines.push((facts.deadlineIsLimit ? '요청하신 납품 기한은 ' + facts.deadline + '까지입니다.' : '희망 납품일은 ' + facts.deadline + '입니다.')+' 가능한 일정을 확인해 안내드리겠습니다.');
    else questions.push('희망 납품일을 알려주실 수 있을까요?');
  }
  const parts = [...lines, ...questions];
  if (!parts.length) parts.push('보내주신 문의를 확인했습니다. 요청 조건을 확인한 뒤 견적을 안내드리겠습니다.');
  const replyDraft = format === 'items'
    ? '안녕하세요.\n' + parts.map(part => '• ' + part).join('\n')
    : '안녕하세요. ' + parts.join(' ');
  return { fields: fields && { ...fields, replyDraft }, replyDraft, notes, needsRevisionMinutes, needsAllocation, needsTitleConfirmation };
}

module.exports = { UNITS, readQuoteRequest, repeatProposal, titleNeedsConfirmation, portfolioReference, referenceDisplay, hasOrderQuantity:value=>embeddedOrder.test(value) };
