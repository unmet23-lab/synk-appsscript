// TOPIK II 쓰기 51~54 연습의 규칙 점검. AI를 부르지 않고 이 기기에서만 돈다.
// · 결과는 감점 확정이 아니라 「확인해 보세요」 목록이다(3차 검수: 자동 검출을 과제별 검수 없이 감점으로 잇지 않는다).
//   글자 수처럼 사실로 잴 수 있는 것(fact)과, 감점일 수 있어 다시 볼 것(check)을 나눠 돌려준다. 점수·급수는 만들지 않는다.
// · 51·52는 빈칸마다(㉠㉡), 53·54는 글 전체를 본다. 공식 감점 원칙(외부조사 §1-4): 「-ㅂ/습니다·-아/어요」 종결,
//   개조식, 제목, 문제 문장 베끼기, 분량, 51·52의 ( ) 앞뒤 어구 넣기·한 문장 넘기기.
// · 글자 수: NFC 정규화 뒤 공백·문장부호를 넣고 줄바꿈을 뺀 Unicode 문자 수(온라인 반 과제·수업 자료 검산과 같다).
//   원고지 칸 수(문단 첫 칸, 숫자 두 자 한 칸)와는 다를 수 있다.
export const WRITING_CHECK_VERSION='writing-check-1';
export const writingLength=text=>[...plain(text).replace(/\n/g,'')].length;
const plain=text=>String(text??'').replace(/\r\n?/g,'\n').normalize('NFC');

// 문장 끝 꼴. 문장부호·닫는 따옴표를 떼고 마지막 음절로 가른다.
const CLOSERS=/[\s.?!…~"'”’)\]」』〉》>]+$/u;
export function endingOf(sentence){
 const tail=String(sentence).replace(CLOSERS,'');
 if(!tail)return 'none';
 if(/(니다|니까|시오|읍시다)$/.test(tail)||(/시다$/.test(tail)&&hasBieup(tail.at(-3)??'')))return 'formal';
 if(/(요|죠)$/.test(tail))return 'polite';
 if(/(했음|됐음|였음|었음|았음|있음|없음|겠음|많음|적음|좋음|높음|낮음|같음|함|됨|임)$/.test(tail))return 'noun';
 if(/(다|까|가|냐|자|라)$/.test(tail))return 'plain';
 return 'other';
}
// 문장 나누기: 마침표·물음표·느낌표 뒤 빈칸, 또는 줄바꿈. 위치(start·end)를 함께 둔다(화면이 그 자리를 표시한다).
export function sentencesOf(text){
 const value=plain(text),out=[];let start=0;
 const push=end=>{const raw=value.slice(start,end),lead=raw.length-raw.trimStart().length,body=raw.trim();if(body)out.push({start:start+lead,end:start+lead+body.length,text:body});};
 for(let i=0;i<value.length;i++){
  const ch=value[i];
  if(ch==='\n'){push(i);start=i+1;continue;}
  if('.?!'.includes(ch)&&(i+1>=value.length||/[\s가-힣]/.test(value[i+1])||(/[가-힣]/.test(value[i-1]??'')&&/[0-9A-Za-z]/.test(value[i+1])))){let j=i+1;while(j<value.length&&CLOSERS.test(value[j])&&value[j]!=='\n')j++;push(j);start=j;i=j-1;}
 }
 push(value.length);
 return out;
}
// 어절: 문장부호를 지운 뒤 빈칸으로 나눈다. 베끼기 검사에서 문제 문장과 견줄 때 쓴다.
const words=text=>plain(text).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean);

// 글에서 쓰지 않는 말(첨삭기준 §5-10). 확정 오류가 아니라 글말로 바꿔 볼 후보다. 뒤 글자로 다른 낱말과 가른다.
const SPOKEN=[
 {word:'진짜',re:/진짜(?![가-힣])|진짜로/g,suggest:'정말·매우'},
 {word:'엄청',re:/엄청(?!나|난|나게)/g,suggest:'매우·상당히'},
 {word:'되게',re:/(?<![가-힣])되게(?! ?(하|만들|되))(?= ?[가-힣])/g,suggest:'매우'},
 {word:'근데',re:/(^|[\s,.])근데(?![가-힣])/g,suggest:'그런데·그러나'},
 {word:'그치만',re:/그치만/g,suggest:'그렇지만'},
 {word:'맨날',re:/맨날/g,suggest:'늘·매일'},
 {word:'너무',re:/너무(?![가-힣])/g,suggest:'지나치게·매우'},
 {word:'좀',re:/(^|\s)좀(?=\s)/g,suggest:'조금'},
 {word:'이거',re:/(^|\s)(이거|그거|저거)(?=[\s,.]|$)/g,suggest:'이것·그것'},
];
// 자주 틀리는 맞춤법·띄어쓰기(첨삭기준 §5-8·9). 다른 뜻으로 맞는 말이 거의 없는 꼴만 둔다.
const SPELLING=[
 {re:/됬/g,suggest:'됐'},
 {re:/몇 ?일(?!본)/g,suggest:'며칠'},
 {re:/([가-힣])수 ?(있|없)/g,test:m=>hasRieul(m[1]),suggest:'-ㄹ 수 있다·없다(띄어 쓴다)'},
 {re:/([가-힣]) 수(있|없)/g,test:m=>hasRieul(m[1]),suggest:'-ㄹ 수 있다·없다(띄어 쓴다)'},
 {re:/([가-힣])때(?=[\s,.]|$|에|는|도|마다|부터|까지)/g,test:m=>hasRieul(m[1]),suggest:'-ㄹ 때(띄어 쓴다)'},
 {re:/것같/g,suggest:'것 같다(띄어 쓴다)'},
 {re:/않(하|해|했|한|할)/g,suggest:'안 하다'},
 {re:/되요/g,suggest:'돼요'},
 {re:/되서/g,suggest:'돼서'},
 {re:/왠만/g,suggest:'웬만'},
 {re:/어떻해/g,suggest:'어떡해·어떻게 해'},
 {re:/금새/g,suggest:'금세'},
 {re:/희안/g,suggest:'희한'},
];
const hasBieup=syllable=>{const code=syllable.charCodeAt(0)-0xac00;return code>=0&&code<11172&&code%28===17;};
const hasRieul=syllable=>{const code=syllable.charCodeAt(0)-0xac00;return code>=0&&code<11172&&code%28===8;};

const scan=(value,rules)=>{
 const found=[];
 for(const rule of rules){rule.re.lastIndex=0;for(const m of value.matchAll(rule.re)){
  if(rule.test&&!rule.test(m,value))continue;
  const lead=m[0].length-m[0].replace(/^[\s,.]+/,'').length,start=m.index+lead,end=m.index+m[0].length;
  found.push({start,end,quote:value.slice(start,end),suggest:rule.suggest});
 }}
 return found.sort((a,b)=>a.start-b.start);
};

// 문체: 51은 그 글의 문체(formal 안내문·편지 / polite 친구에게), 52·53·54는 「-다」체.
const EXPECT={formal:['formal'],polite:['polite'],plain:['plain']};
function styleSpans(sentences,style){
 const want=EXPECT[style]||EXPECT.plain;
 return sentences.filter(s=>{const e=endingOf(s.text);return ['formal','polite','plain'].includes(e)&&!want.includes(e);})
  .map(s=>({start:s.start,end:s.end,quote:s.text,ending:endingOf(s.text)}));
}
// 개조식: 줄 머리의 글머리 기호·번호, 또는 「-음·-함·-됨」으로 끝낸 문장.
const BULLET=/^[ \t]*(?:[-–—•●○◦▪■□▶►☞*]|\d{1,2}[.)]|[①-⑳]|\(\d{1,2}\)|[가-하][.)])[ \t]*/gmu;
function listSpans(value,sentences){
 const spans=[];
 for(const m of value.matchAll(BULLET))if(value.slice(m.index+m[0].length).trim())spans.push({start:m.index+m[0].length-m[0].trimStart().length,end:m.index+m[0].length,quote:m[0].trim(),kind:'bullet'});
 for(const s of sentences)if(endingOf(s.text)==='noun')spans.push({start:s.start,end:s.end,quote:s.text,kind:'noun'});
 return spans.sort((a,b)=>a.start-b.start);
}
// 제목: 첫 줄이 짧고 문장으로 끝나지 않는데 뒤에 글이 이어진다.
function titleSpan(value){
 const first=value.indexOf('\n');if(first<0)return null;
 const line=value.slice(0,first),body=line.trim();
 if(!body||!value.slice(first+1).trim()||[...body].length>30||/[.?!]$/.test(body))return null;
 if(['formal','polite','plain'].includes(endingOf(body))&&[...body].length>12)return null;
 const start=line.length-line.trimStart().length;
 return {start,end:start+body.length,quote:body};
}
// 문제 문장 베끼기: 문제 글·질문과 어절 6개 이상이 그대로 이어지거나, 질문 한 문장을 통째로 옮긴 곳.
function copySpans(value,sources){
 const mine=[];const re=/[^\s]+/g;let m;
 while((m=re.exec(value))){const w=m[0].replace(/[^\p{L}\p{N}]/gu,'');if(w)mine.push({w,start:m.index,end:m.index+m[0].length});}
 const spans=[];
 for(const source of sources.filter(Boolean)){
  const theirs=words(source);if(theirs.length<4)continue;
  const whole=theirs.length<=8;
  for(let i=0;i<mine.length;i++)for(let j=0;j<theirs.length;j++){
   let k=0;while(i+k<mine.length&&j+k<theirs.length&&mine[i+k].w===theirs[j+k])k++;
   const chars=mine.slice(i,i+k).reduce((n,x)=>n+x.w.length,0);
   if((k>=6&&chars>=20)||(whole&&k===theirs.length&&k>=4)){spans.push({start:mine[i].start,end:mine[i+k-1].end,quote:value.slice(mine[i].start,mine[i+k-1].end)});i+=k-1;break;}
  }
 }
 return mergeSpans(spans);
}
const mergeSpans=spans=>spans.sort((a,b)=>a.start-b.start).reduce((out,s)=>{const last=out.at(-1);if(last&&s.start<=last.end){last.end=Math.max(last.end,s.end);}else out.push({...s});return out;},[]);

// 51·52 빈칸의 앞뒤 글. 지문 조각 [글, {blank}, 글…]에서 빈칸이 든 문장의 앞부분과 뒤 글을 뽑는다.
export function blankContext(item,blankId){
 for(const line of item.passage||[]){
  const index=line.findIndex(part=>typeof part==='object'&&part?.blank===blankId);if(index<0)continue;
  const before=line.slice(0,index).map(p=>typeof p==='string'?p:' ').join(''),after=line.slice(index+1).map(p=>typeof p==='string'?p:' ').join('');
  const sentenceStart=Math.max(before.lastIndexOf('. '),before.lastIndexOf('? '),before.lastIndexOf('! '));
  const lead=before.slice(sentenceStart+1).trim(),tailEnd=after.search(/[.?!](\s|$)/);
  return {before:lead,after:tailEnd<0?after.trim():after.slice(0,tailEnd).trim(),next:tailEnd<0?'':after.slice(tailEnd+1).trim().split(/(?<=[.?!])\s/)[0]||'',endsSentence:tailEnd===0};
 }
 return {before:'',after:'',next:'',endsSentence:true};
}
// 이음 어미로 끝난 빈칸(「고장 나서」처럼 줄어든 꼴 포함). 빈칸이 문장 끝일 때만 본다.
const CONNECTIVE=/(고|서|며|면|는데|은데|던데|지만|려고|도록|니까|으니)$/;
function checkBlank(item,blank,answer){
 const value=plain(answer).trim(),items=[];
 if(!value){items.push({id:'empty',level:'note',blank:blank.id});return items;}
 const ctx=blankContext(item,blank.id),sentences=sentencesOf(value),mine=words(value);
 if(sentences.length>1)items.push({id:'oneSentence',level:'check',blank:blank.id,spans:sentences.slice(1).map(({start,end,text})=>({start,end,quote:text})),count:sentences.length});
 const beforeWords=words(ctx.before),afterWords=words(ctx.after),nextWords=words(ctx.next);
 const lastBefore=beforeWords.slice(-2),firstAfter=afterWords.slice(0,2);
 const startsWith=(arr,prefix)=>prefix.length&&prefix.every((w,i)=>arr[i]===w);
 if(beforeWords.length&&(startsWith(mine,lastBefore)||(beforeWords.at(-1).length>=3&&mine[0]===beforeWords.at(-1))))items.push({id:'beforeWords',level:'check',blank:blank.id,quote:ctx.before.split(/\s+/).slice(-2).join(' ')});
 if(!ctx.endsSentence&&firstAfter.length&&firstAfter.every((w,i)=>mine[mine.length-firstAfter.length+i]===w))items.push({id:'afterWords',level:'check',blank:blank.id,quote:ctx.after.split(/\s+/).slice(0,2).join(' ')});
 if(nextWords.length>=3&&mine.join(' ').includes(nextWords.slice(0,3).join(' ')))items.push({id:'nextSentence',level:'check',blank:blank.id,quote:ctx.next.split(/\s+/).slice(0,3).join(' ')});
 const style=styleSpans(sentences.length?sentences:[{start:0,end:value.length,text:value}],item.style);
 if(ctx.endsSentence&&style.length)items.push({id:'style',level:'check',blank:blank.id,style:item.style,spans:style});
 const tail=value.replace(CLOSERS,'');
 if(ctx.endsSentence&&!style.length&&endingOf(value)==='other'&&CONNECTIVE.test(tail))items.push({id:'unfinished',level:'check',blank:blank.id,quote:mine.at(-1)||value});
 if(item.style!=='polite'){const spoken=scan(value,SPOKEN);if(spoken.length)items.push({id:'spoken',level:'check',blank:blank.id,spans:spoken});}
 const spelling=scan(value,SPELLING);if(spelling.length)items.push({id:'spelling',level:'check',blank:blank.id,spans:spelling});
 return items;
}
// 53: 자료의 숫자가 글에 있는지(사실 확인). 쉼표·빈칸을 지우고 찾는다.
function missingFacts(value,facts){
 const flat=value.replace(/[\s,]/g,'');
 return (facts||[]).filter(f=>!(f.any||[]).some(p=>flat.includes(String(p).replace(/[\s,]/g,'')))).map(f=>f.label);
}
function checkEssay(item,text){
 const value=plain(text),items=[],length=writingLength(value),sentences=sentencesOf(value);
 const range={min:item.min,max:item.max};
 if(!value.trim()){items.push({id:'empty',level:'note'});return {length,range,items};}
 if(length<range.min)items.push({id:'short',level:length<range.min/2?'check':'note',length,min:range.min,far:length<range.min/2});
 if(length>range.max)items.push({id:'long',level:'check',length,max:range.max});
 const title=titleSpan(value);if(title)items.push({id:'title',level:'check',spans:[title]});
 const style=styleSpans(sentences,'plain');if(style.length)items.push({id:'style',level:'check',style:'plain',spans:style});
 const list=listSpans(value,sentences);if(list.length)items.push({id:'list',level:'check',spans:list});
 const copies=copySpans(value,[item.prompt,...(item.questions||[]),item.type===53?item.instruction:null]);
 if(copies.length)items.push({id:'copy',level:'check',spans:copies});
 if(item.type===53){const missing=missingFacts(value,item.facts);if(missing.length)items.push({id:'facts',level:'check',labels:missing});}
 if(item.type===54&&length>=300&&!/\n\s*\S/.test(value.trim()))items.push({id:'paragraphs',level:'note'});
 const spoken=scan(value,SPOKEN);if(spoken.length)items.push({id:'spoken',level:'check',spans:spoken});
 const spelling=scan(value,SPELLING);if(spelling.length)items.push({id:'spelling',level:'check',spans:spelling});
 return {length,range,items};
}
// answer: 51·52는 {a,b}(빈칸 id별 글), 53·54는 글 하나.
export function checkWriting(item,answer){
 if(!item||![51,52,53,54].includes(item.type))throw new TypeError('writing-check: unknown item');
 if(item.type<=52){
  const blanks=(item.blanks||[]).map(blank=>({id:blank.id,mark:blank.mark,length:writingLength(String(answer?.[blank.id]??'').trim()),items:checkBlank(item,blank,answer?.[blank.id])}));
  return {version:WRITING_CHECK_VERSION,type:item.type,blanks,items:blanks.flatMap(b=>b.items)};
 }
 return {version:WRITING_CHECK_VERSION,type:item.type,...checkEssay(item,answer)};
}
// 화면에 보일 「확인해 보세요」 수(사실 메모는 빼고).
export const checkCount=result=>result.items.filter(i=>i.level==='check').length;
