'use strict';

const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const weekdays=['sun','mon','tue','wed','thu','fri','sat'];
const monthText='jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const relativeText={
  last_week:'(?:지난|저번|이전)\\s*주|\\b(?:last|previous) week\\b',
  this_week:'이번\\s*주|\\bthis week\\b',last_month:'(?:지난|저번)\\s*달|전월|\\blast month\\b',
  this_month:'이번\\s*달|금월|\\bthis month\\b',today:'오늘|\\btoday\\b',yesterday:'어제|\\byesterday\\b'
};
const parts=[
  ...Object.entries(relativeText).map(([period,pattern])=>'(?<'+period+'>'+pattern+')'),
  '(?<iso>(?<!\\d)\\d{4}-\\d\\d-\\d\\d(?!\\d))',
  '(?<!\\d)(?<sy>\\d{4})[/.](?<sm>\\d{1,2})[/.](?<sd>\\d{1,2})(?!\\d)|(?<ambiguous>(?<!\\d)\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?(?!\\d))',
  '(?:(?<ky>\\d{4})\\s*년\\s*)?(?<km>\\d{1,2})\\s*월(?:\\s*(?<kd>\\d{1,2})(?:\\s*일|(?=\\s*[~–—-]\\s*\\d{1,2}\\s*일)))?',
  '\\b(?<rm>'+monthText+')\\b\\.?\\s+(?<ra>\\d{1,2})(?:st|nd|rd|th)?(?<rsep>\\s*(?:[–—~-]|\\b(?:to|through|and)\\b)\\s*)(?<rb>\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s+(?:'+monthText+')\\b)(?:(?:,\\s*|\\s+)(?<ry>\\d{4})\\b)?',
  '(?<!\\d)(?<dd>\\d{1,2})(?:st|nd|rd|th)?\\s+(?<dm>'+monthText+')\\b(?:\\.?(?:,\\s*|\\s+)(?<dy>\\d{4})\\b)?',
  '\\b(?<em>'+monthText+')\\b(?:\\.?\\s+(?<ed>\\d{1,2})(?:st|nd|rd|th)?\\b)?(?:(?:,\\s*|\\s+)(?<ey>\\d{4})\\b)?',
  '(?<kw>[일월화수목금토])요일|\\b(?<ew>sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b',
  '(?<!\\d)(?<ordinal>\\d{1,2})(?:일|(?:st|nd|rd|th)\\b)'
];
const tokenPattern=new RegExp(parts.join('|'),'giu');
const koreanEnd='(?:부터|까지|이후|이전|에서|동안|이랑|랑|하고|로|엔|의|에(?!서)|이(?!랑|후|전)|가|은|는|을|도|와|과|만)*';
const morphemeEnd=koreanEnd+'(?=$|[^\\p{Script=Hangul}])';
const koreanBoundary=new RegExp('^(?:[일월화수목금토]요일|말'+morphemeEnd+'|'+morphemeEnd+')','u');
const offsetDay=(date,n)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+n);
const formatDay=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function day(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/u.test(value))return null;
  const [year,month,date]=value.split('-').map(Number),result=new Date(year,month-1,date);
  return year>=1970&&year<=2200&&result.getFullYear()===year&&result.getMonth()===month-1&&result.getDate()===date?result:null;
}
function periodBounds(period,at){
  const today=offsetDay(at,0);
  if(period.endsWith('_week')){
    const start=offsetDay(today,-((today.getDay()+6)%7)-(period==='last_week'?7:0));
    return [start,offsetDay(start,7)];
  }
  if(period.endsWith('_month')){
    const start=new Date(today.getFullYear(),today.getMonth()-(period==='last_month'?1:0),1);
    return [start,new Date(start.getFullYear(),start.getMonth()+1,1)];
  }
  const start=period==='yesterday'?offsetDay(today,-1):today;
  return [start,offsetDay(start,1)];
}
function selectedDays(period,at){
  const [start,end]=periodBounds(period,at);
  return {after:formatDay(start),before:formatDay(end)};
}
const monthContext=/\b(?:in|during|from|since|until|through|to|between|and|or|before|after)\s+(?:the\s+)?$/iu;
// Determine whether lowercase 'may' names a month before examining clipped date citations.
const rangeEnd=/(?:\b(?:to|through|until|and)|[–—~-])\s*\d{1,2}(?:st|nd|rd|th)?\s+$/iu;
const dayFirst=/(?:^|[\n,(;]\s*|\b(?:on|in|from|during|since|after|before|until|through|between|to|of|dated|received|sent|delivered)\s+(?:the\s+)?)\d{1,2}(?:st|nd|rd|th)?\s+$/iu;
function endsDateRange(prefix){
  const separator=rangeEnd.exec(prefix);
  if(!separator)return false;
  const first=prefix.slice(0,separator.index).trimEnd();
  const token=[...first.matchAll(tokenPattern)].at(-1);
  return Boolean(token&&token.index+token[0].length===first.length);
}
function mayAfterRange(before,tail){
  const prose=before.replace(tokenPattern,token=>token.replace(/\./gu,' '));
  const clause=prose.split(/[.!?](?=\s|$)|[;\n]/u).at(-1);
  const search=/\b(?:find|search|look for|show|list|retrieve|locate|check)\b/iu.test(clause);
  const mailSubject=/\b(?:e-?mails?|messages?)\s+(?:(?:that|which)\s+)?(?:(?:(?:i|we|you|they)(?:['’](?:ve|d)|\s+(?:have|had))?|were)\s+)?(?:received|sent|delivered)\b/iu.test(clause);
  const modifier=/^\s*(?:(?:about|regarding|concerning|with|in|for|from|on|at|by|to|through|until|that|which|and|inclusive)\b|[a-z]{3,}(?:ing|ed)\b)/iu.test(tail);
  // In a statement, a mailbox or attachment modifier can precede the main verb under either reading.
  // The fixed adverbial "in fact" leaves the following auxiliary attached to the modal.
  const modalAside=/^\s*in fact\s+(?:be|have|do)\b/iu.test(tail);
  if(!search){
    if(!mailSubject)return 'uncertain';
    // Inflected auxiliaries start the sentence's finite predicate. A modal cannot take these forms.
    if(/^\s*(?:am|is|are|was|were|has|had|does|did)\b/iu.test(tail))return 'month';
    if(modalAside||!modifier)return 'modal';
    // A topic followed by the main plural copula completes the noun phrase that contains the date.
    if(/^\s*(?:about|regarding|concerning)\s+[^,.;!?]+\s+(?:are|were)\s+(?:the|those)\s+ones\b/iu.test(tail))return 'month';
    return 'uncertain';
  }
  const possibleAside=/^\s*(?:in|on|at|by|with|for|as)\s+(?:[a-z'-]+\s+){1,4}(?:be|have|do)\b/iu.test(tail);
  return modifier&&!possibleAside?'month':'uncertain';
}
function dateSource(source,onUncertain){
  return source.replace(/\bmay(?=\s+[A-Za-z]+\b)/gu,(word,index)=>{
    const before=source.slice(0,index);
    if(monthContext.test(before))return word;
    if(endsDateRange(before)){
      const role=mayAfterRange(before,source.slice(index+word.length));
      if(role==='uncertain')onUncertain?.(index);
      return role==='modal'?' '.repeat(word.length):word;
    }
    if(dayFirst.test(before))return word;
    return ' '.repeat(word.length);
  });
}
function dateTokens(source,delivered=false,onUncertain){
  source=dateSource(source,onUncertain);
  return Array.from(source.matchAll(tokenPattern)).flatMap(m=>{
    const g=m.groups,period=Object.keys(relativeText).find(key=>g[key]);
    if(g.rm){
      const split=m[0].indexOf(g.rsep),monthNumber=months.indexOf(g.rm.toLowerCase().slice(0,3))+1;
      const common={monthNumber,year:g.ry?Number(g.ry):null,weekday:null,sharedMonth:m.index};
      return [{...common,start:m.index,end:m.index+split,dateNumber:Number(g.ra)},
        {...common,start:m.index+split+g.rsep.length,end:m.index+m[0].length,dateNumber:Number(g.rb)}];
    }
    const tail=source.slice(m.index+m[0].length);
    const unknownSuffix=period&&/\p{Script=Hangul}$/u.test(m[0])&&!koreanBoundary.test(tail);
    // In a separate noun, 주 is also the first syllable of 주문, 주소 and 주제.
    if(unknownSuffix&&(/\s주$/u.test(m[0])&&/^(?:문|소|제)/u.test(tail)||m[0]==='전월'&&tail.startsWith('세')))return [];
    const month=g.em||g.dm,date=g.kd||g.ed||g.dd||g.sd||g.ordinal,year=g.ky||g.ey||g.dy||g.sy;
    if(month?.toLowerCase()==='may'&&!date&&!year&&month[0]===month[0].toLowerCase()&&!(delivered&&source.trim()===m[0])&&
       !/\b(?:from|in|during|since|until|through|to|between|and|or|before|after)\s+$/iu.test(source.slice(0,m.index)))return [];
    return [{start:m.index,end:m.index+m[0].length,period,iso:g.iso,ambiguous:Boolean(g.ambiguous||unknownSuffix),year:year?Number(year):null,
      monthNumber:g.km||g.sm?Number(g.km||g.sm):month?months.indexOf(month.toLowerCase().slice(0,3))+1:null,
      dateNumber:date===undefined?null:Number(date),
      weekday:g.kw?'일월화수목금토'.indexOf(g.kw):g.ew?weekdays.indexOf(g.ew.toLowerCase().slice(0,3)):null}];
  });
}
// Keep connecting operators even when the planner cited each endpoint separately.
const englishEdge=/\b(?:(not)\s+)?(on or after|on or before|starting(?: on| from)?|since|after|from|between|until|through|before|prior to|up to|to|ending(?: on)?|on)\s+(?:the\s+)?[‘“"']?$/iu;
const koreanEdge=/^[’”"']?\s*(에만|부터|에서|이후|이상|초과|까지|이전|미만|이하|[전후](?=에|부터|까지|\s|$))/u;
const vagueBefore=/\b(?:early|mid|late|around|about|approximately|(?:beginning|start|middle|end) of)[ -]*$/iu;
const approximate='(?:무렵|즈음|쯤|께|경|정도|전후)';
const vagueAfter=new RegExp('^\\s*(?:(?:초순|중순|하순|초반|중반|후반|초(?!과)|말)'+approximate+'?|'+approximate+')'+morphemeEnd,'u');
const shortRangeEnd=/^\s*(?:to|through|and|[~–—-])\s*\d{1,2}\b/iu;
const koreanDeliveryGlue=/^[’”"']?\s*(?:(?:이후|이전|이상|이하|미만|초과|에서|부터|까지|동안|사이|전|후)\s*)?(?:(?:에만|에는|에도|에|엔|의|만)\s*)?(?:(?:제가|내가|제게|내게|저에게|우리에게)\s*)?(?:(?:실제로|직접)\s*)?$/u;
function evidenceText(sentence,spans,topics=[]){
  if(!spans.length)return '';
  sentence=dateSource(sentence);
  const sorted=[...spans].sort((a,b)=>a.start-b.start);
  const start=sorted[0].start,end=Math.max(...spans.map(s=>s.end));
  const local=dateTokens(sentence.slice(start,end),true);
  if(!local.length)return sentence.slice(start,end);
  const first=start+local[0].start,last=start+local.at(-1).end;
  const head=sentence.slice(0,first),tail=sentence.slice(last);
  const pre=head.match(vagueBefore)?.[0]||head.match(englishEdge)?.[0]||'';
  const post=tail.match(vagueAfter)?.[0]||tail.match(koreanEdge)?.[0]||tail.match(shortRangeEnd)?.[0]||'';
  const from=Math.min(start,first-pre.length),to=Math.max(end,last+post.length);
  let cursor=from,prior;
  for(const span of sorted){
    if(prior&&sorted.length===2&&cursor<span.start){
      const known=topics.filter(t=>t.start>=cursor&&t.end<=span.start).sort((a,b)=>b.start-a.start);
      let gap=sentence.slice(cursor,span.start);
      for(const t of known)gap=gap.slice(0,t.start-cursor)+' '.repeat(t.end-t.start)+gap.slice(t.end-cursor);
      // Preserve the original comparators around two distinct delivery clauses.
      const joined=/\b(?:and|but)\b|그리고|또한/iu.test(gap)||known.some(t=>t.role==='about')&&/[,;]/u.test(gap);
      const bridge=gap.replace(/\b(?:with|in|the|subject(?:\s+line)?|title|and|but|received|sent|on|before|after|not)\b|제목(?:이|에)?|이고|그리고|또한|받은|보낸|[,\s"'“”‘’]/giu,'');
      if(known.length&&joined&&!bridge){
        const a=dateTokens(sentence.slice(prior.start,prior.end),true).at(-1),b=dateTokens(sentence.slice(span.start,span.end),true)[0];
        if(a&&b){
          const left=prior.start+a.end,right=span.start+b.start;
          const suffix=sentence.slice(left).match(koreanEdge)?.[0]||'',prefix=sentence.slice(0,right).match(englishEdge)?.[0]||'';
          return sentence.slice(from,left)+suffix+' and '+prefix+sentence.slice(right,to);
        }
      }
    }
    cursor=Math.max(cursor,span.end);prior=span;
  }
  return sentence.slice(from,to);
}
function dateUnits(citation,tokens=dateTokens(citation,true)){
  const units=[];
  for(const token of tokens){
    const prior=units.at(-1),gap=prior?citation.slice(prior.end,token.start):'';
    if(prior?.period?.endsWith('_week')&&prior.weekDay===undefined&&token.weekday!==null&&/^\s*(?:의\s*)?$/u.test(gap)){
      units[units.length-1]={...prior,end:token.end,weekDay:token.weekday};
    }else if(prior?.weekday!=null&&token.period?.endsWith('_week')&&/^\s*(?:of|in)?\s*$/iu.test(gap)){
      units[units.length-1]={...token,start:prior.start,weekDay:prior.weekday};
    }else units.push(token);
  }
  return units;
}
function dateEvidenceMatches(source,delivery,about,senders){
  const covers=(span,start,end)=>span.start<=start&&span.end>=end;
  const roles=[...delivery,...about,...senders];
  let uncertainPeriod=false;
  const tokens=dateTokens(source,false,()=>{uncertainPeriod=true;}).filter(t=>!(t.ambiguous&&source[t.end-1]==='주'&&/^(?:문|소|제)/u.test(source.slice(t.end))&&
    [...about,...senders].some(s=>covers(s,t.end-1,t.end+1))));
  if(uncertainPeriod)return false;
  if(tokens.some(t=>!roles.some(s=>covers(s,t.start,t.end))))return false;
  // Quantified durations are genuine conditions even when no supported date token covers them.
  const duration=/(?:지난|최근|앞으로|다음)\s*(?:\d+|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|몇)\s*(?:개월|시간|주일|달|주|년|일)(?:\s*(?:이내|동안|간))?/gu;
  for(const m of source.matchAll(duration)){
    if(/^지난\s*\d{1,2}일$/u.test(m[0])&&/^(?:에|엔)/u.test(source.slice(m.index+m[0].length)))continue;
    if(!tokens.some(t=>t.start<=m.index&&t.end>=m.index+m[0].length)&&
       ![...about,...senders].some(s=>covers(s,m.index,m.index+m[0].length)))return false;
  }
  const units=dateUnits(source,tokens);
  for(const [i,unit] of units.entries()){
    if(senders.some(s=>covers(s,unit.start,unit.end)))continue;
    const parts=tokens.filter(t=>t.start>=unit.start&&t.end<=unit.end);
    const assigned=group=>parts.every(t=>group.some(s=>covers(s,t.start,t.end)));
    if(unit.weekDay!==undefined&&!assigned(delivery)&&!assigned(about))return false;
    const prior=units[i-1];
    if(prior&&/^\s*(?:랑|이랑|하고|와|과|and)?\s*$/iu.test(source.slice(prior.end,unit.start))){
      const earlier=tokens.filter(t=>t.start>=prior.start&&t.end<=prior.end);
      if(assigned(about)&&earlier.some(t=>delivery.some(s=>covers(s,t.start,t.end)))||
         assigned(delivery)&&earlier.some(t=>about.some(s=>covers(s,t.start,t.end))))return false;
    }
    const following=source.slice(unit.end);
    const edge=edges(unit,source);
    if(assigned(delivery)){
      if(/\b(?:not|never)\s+(?:(?:received|sent|delivered)\s+)(?:on|in|during|after|before)?\s*$/iu.test(source.slice(0,unit.start)))return false;
      // All intervening words in a Korean delivery-time clause must have a known time function.
      const deliveryVerb=following.match(/^([\p{Script=Hangul}\s]{0,36}?)(?:받|보내|보낸|도착|수신|발신|온\s)/u);
      if(deliveryVerb){
        const nextDate=units[i+1]?.start,verbAt=unit.end+deliveryVerb[1].length;
        const otherClause=nextDate!==undefined&&nextDate<verbAt||[...about,...senders].some(s=>s.start>=unit.end&&s.end<=verbAt);
        if(!otherClause&&!koreanDeliveryGlue.test(deliveryVerb[1])||
           /^(?:받|보내|도착|수신|발신)(?:하지|지)\s*(?:않|못)/u.test(following.slice(deliveryVerb[1].length)))return false;
      }
    }
    const governing=['lower','after','before','upper'].includes(edge.op)||
      /^\s*(?:에만|에는|엔|에|동안)?\s*(?:제가\s*|내가\s*)?(?:받은|받았|보낸|보냈|도착한|온)(?=\s|$)/u.test(following)||
      /\b(?:received|sent)\s+(?:on|in|during)\s*$/iu.test(source.slice(0,unit.start));
    const topical=about.some(s=>covers(s,unit.start,unit.end)&&s.start<unit.start-edge.before.length&&
      /\b(?:about|regarding|concerning)\s+(?:(?:the|a|an)\s+)?$/iu.test(source.slice(0,s.start)));
    if(governing&&!assigned(delivery)&&!topical)return false;
  }
  return true;
}
function pointBounds(token,today,previous){
  if(token.period){
    const unit=periodBounds(token.period,today);
    if(token.weekDay===undefined)return unit;
    const d=offsetDay(unit[0],(token.weekDay+6)%7);return [d,offsetDay(d,1)];
  }
  if(token.iso){const d=day(token.iso);return d&&[d,offsetDay(d,1)];}
  if(token.weekday!==null){
    const d=offsetDay(today,-((today.getDay()-token.weekday+7)%7));return [d,offsetDay(d,1)];
  }
  const reference=offsetDay(previous?previous[0]:today,0),direction=previous?1:-1;
  let year=token.year??reference.getFullYear(),month=token.monthNumber??reference.getMonth()+1;
  const date=token.dateNumber??1;
  if(month<1||month>12||date<1||date>31)return null;
  // A yearless leap day can be eight years away across a non-leap century.
  for(let i=0;i<=12;i++){
    if(year<1970||year>2200)return null;
    const d=new Date(year,month-1,date);
    const exists=d.getMonth()===month-1&&d.getDate()===date;
    if(exists&&(token.year!==null||(previous?d>=reference:d<=reference))){
      return [d,token.dateNumber?offsetDay(d,1):new Date(year,month,1)];
    }
    if(token.year!==null||previous&&!token.monthNumber)return null;
    if(token.monthNumber)year+=direction;
    else{const next=new Date(year,month-1+direction,1);year=next.getFullYear();month=next.getMonth()+1;}
  }
  return null;
}
const operators=new Map([
  ['since','lower'],['starting','lower'],['starting on','lower'],['starting from','lower'],['on or after','lower'],['not before','lower'],
  ['부터','lower'],['에서','lower'],['이후','lower'],['이상','lower'],['after','after'],['초과','after'],
  ['before','before'],['prior to','before'],['미만','before'],['on or before','upper'],['until','upper'],['through','upper'],['up to','upper'],['to','upper'],
  ['ending','upper'],['ending on','upper'],['not after','upper'],['까지','upper'],['이전','upper'],['이하','upper'],['전','before'],['후','after'],
  ['from','from'],['between','between'],['on','point'],['에만','point']
]);
function edges(unit,citation){
  const head=citation.slice(0,unit.start),tail=citation.slice(unit.end);
  const before=head.match(englishEdge),after=tail.match(koreanEdge);
  const plain=operators.get(before?.[2].toLowerCase())||'';
  const a=before?.[1]?({lower:'before',after:'upper',before:'lower',upper:'after'}[plain]||'ambiguous'):plain;
  const b=operators.get(after?.[1])||'';
  const vague=vagueBefore.test(head)||vagueAfter.test(tail);
  return {op:b||a,bad:vague||a==='ambiguous'||Boolean(a&&b&&a!==b&&a!=='from'),before:before?.[0]||'',after:after?.[0]||''};
}
function verifiesPeriod(period,plan,citation,today){
  const units=dateUnits(citation);
  if(!units.length||units.length>2||units.some(t=>t.ambiguous))return false;
  const [left,right]=units;
  if(left.sharedMonth!==undefined&&left.sharedMonth===right?.sharedMonth&&left.year===null){
    // Neither endpoint of a named same-month range may roll into a different year.
    let year=today.getFullYear();
    for(;year>=today.getFullYear()-8;year--){
      const a=new Date(year,left.monthNumber-1,left.dateNumber),b=new Date(year,right.monthNumber-1,right.dateNumber);
      if(a.getMonth()===left.monthNumber-1&&b.getMonth()===left.monthNumber-1&&a<=today)break;
    }
    if(year<today.getFullYear()-8)return false;
    left.year=year;right.year=year;
  }
  const le=edges(left,citation);
  if(left.year===null&&right?.year!=null&&left.monthNumber&&right.monthNumber&&['from','between'].includes(le.op)){
    left.year=right.year-(left.monthNumber>right.monthNumber?1:0);
  }
  const first=pointBounds(left,today);
  if(le.bad||!first)return false;
  let start,end;
  if(!right){
    if(shortRangeEnd.test(citation.slice(left.end)))return false;
    const op=le.op==='from'||le.op==='point'?'':le.op;
    if(op==='between'||!op&&left.weekday!==null)return false;
    if(period!=='absolute')return !op&&left.period===period&&left.weekDay===undefined&&!plan.after&&!plan.before;
    if(op==='lower'||op==='after')start=first[op==='after'?1:0];
    else if(op==='upper'||op==='before')end=first[op==='before'?0:1];
    else [start,end]=first;
  }else{
    if(period!=='absolute'||left.weekday!==null||right.weekday!==null)return false;
    const re=edges(right,citation);
    const sameDirection=['before','upper'].includes(le.op)&&['before','upper'].includes(re.op)||
      ['after','lower'].includes(le.op)&&['after','lower'].includes(re.op);
    const second=pointBounds(right,today,sameDirection?null:first);
    if(!second||re.bad)return false;
    const gap=citation.slice(left.end,right.start),middle=gap.slice(le.after.length,gap.length-re.before.length).trim();
    if(!/^(?:,?\s*(?:and|but)|랑|이랑|하고|와|과|,|[~–—-])?$/iu.test(middle))return false;
    const conjunction=/^(?:,?\s*(?:and|but)|랑|이랑|하고|와|과|,)$/iu.test(middle);
    const between=le.op==='between'||/^\s*사이/u.test(citation.slice(right.end));
    const directional=op=>['lower','after','before','upper','point'].includes(op);
    if(directional(le.op)&&directional(re.op)){
      const lowers=[],uppers=[];
      for(const [op,bounds] of [[le.op,first],[re.op,second]]){
        if(['lower','after','point'].includes(op))lowers.push(bounds[op==='after'?1:0]);
        if(['upper','before','point'].includes(op))uppers.push(bounds[op==='before'?0:1]);
      }
      if(lowers.length)start=new Date(Math.max(...lowers));
      if(uppers.length)end=new Date(Math.min(...uppers));
    }else if(conjunction&&!between){
      // Only touching or overlapping named units can be represented by a single range.
      if(le.op||re.op||!left.period||!right.period||first[0]>second[1]||second[0]>first[1])return false;
      start=new Date(Math.min(first[0],second[0]));end=new Date(Math.max(first[1],second[1]));
    }else{
      if(['upper','before'].includes(le.op)||['lower','after','from','between'].includes(re.op)||!middle&&!re.op&&!between)return false;
      start=first[le.op==='after'?1:0];end=second[re.op==='before'?0:1];
    }
  }
  return (!start||!end||start<end)&&plan.after===(start?formatDay(start):'')&&plan.before===(end?formatDay(end):'');
}
module.exports={day,selectedDays,dateTokens,dateEvidenceMatches,evidenceText,verifiesPeriod};
