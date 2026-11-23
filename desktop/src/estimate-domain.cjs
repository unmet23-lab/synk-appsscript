'use strict';

// 같은 규칙을 PC 본체와 로컬 예시 우편함에서 사용한다.
const textValue = (value, limit = 1000) => typeof value === 'string'
  ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
const EXCERPT_INDEX_VERSION = 47;
const { UNITS, readQuoteRequest, repeatProposal, titleNeedsConfirmation, portfolioReference, referenceDisplay, hasOrderQuantity } = require('./estimate-repeat.cjs');

// Gmail and IMAP supply a From header. Only a single, complete, unambiguous mailbox has a usable display name.
// Read recipient addresses only. Quoted display names, RFC comments and group names are not recipients.
function headerAddresses(value) {
  const result=[];
  let token='', quoted=false, commentDepth=0, escaped=false, angled=false;
  function finish(){
    const field=token.trim();
    const angle=field.match(/<([^<>]+)>\s*$/u);
    const address=(angle ? angle[1].trim() : field).toLowerCase();
    if(/^(?:"(?:[^"\\]|\\.)+"|[^\s<>()@,;:"\\]+)@[^\s<>()@,;:"\\]+$/u.test(address))result.push(address);
    token='';
  }
  for(const ch of String(value || '')){
    if(escaped){if(!commentDepth)token+=ch;escaped=false;continue;}
    if((quoted||commentDepth) && ch==='\\'){if(!commentDepth)token+=ch;escaped=true;continue;}
    if(!quoted && ch==='('){if(!commentDepth)token+=' ';commentDepth++;continue;}
    if(commentDepth){if(ch===')')commentDepth--;continue;}
    if(ch==='"')quoted=!quoted;
    if(!quoted){
      if(ch==='<')angled=true;
      if(ch==='>')angled=false;
      if(!angled && ch===':'){token='';continue;}
      if(!angled && (ch===','||ch===';')){finish();continue;}
    }
    token+=ch;
  }
  if(!quoted && !commentDepth && !angled)finish();
  return result;
}

function headerDisplayName(value) {
  if (typeof value !== 'string' || value.length > 600 || /[\r\n\u0000]/u.test(value)) return '';
  const match = /^(?:"([^"<>\\]+)"|([^"<>\\@,;:()]+?))\s*<([^<>\s@]+)@([^<>\s@]+)>$/u.exec(value.trim());
  if (!match) return '';
  const [, quotedName, plainName, local, domain] = match;
  // Conservative ASCII dot-atom and DNS forms. An unknown header never supplies a partial display name.
  if (local.length > 64 || local.length+domain.length+1 > 254 ||
      !/^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*$/iu.test(local)) return '';
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(label))) return '';
  return (quotedName || plainName).replace(/\t/gu,' ').trim();
}

function fault(code, message) {
  return Object.assign(new Error(message), { code });
}

function whole(value, name, max, min = 0) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value).trim())) {
    throw fault('VALUE', name + '을(를) 숫자로 입력해 주세요.');
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw fault('VALUE', name + ' 입력 범위를 확인해 주세요.');
  return result;
}

function needed(value, label, limit = 500) {
  if (typeof value !== 'string' || value.trim().length > limit || !textValue(value, limit)) {
    throw fault('VALUE', label + '을(를) 확인해 주세요.');
  }
  return textValue(value, limit);
}

function jobFields(input) {
  return {
    title: needed(input.title, '작업 이름', 200),
    scope: needed(input.scope, '납품 범위'),
    quantity: whole(input.quantity, '수량', 100000, 1),
    buildMinutes: whole(input.buildMinutes, '개당 제작 시간', 1000000),
    revisionMinutes: whole(input.revisionMinutes, '개당 수정 시간', 1000000),
    directCost: whole(input.directCost, '개당 생성비', 1e10),
    subcontractCost: whole(input.subcontractCost, '개당 외주비', 1e10),
  };
}

function quoteFields(input, request) {
  const base = jobFields(input);
  const hourlyRate = whole(input.hourlyRate, '시간당 목표 금액', 1e9, 1);
  const allocation = whole(input.allocation, '구독료 배분액', 1e10);
  const taxMode = input.taxMode;
  if (!['undecided', 'add10', 'none'].includes(taxMode)) throw fault('VALUE', '부가세 표시 방법을 선택해 주세요.');
  const quantity = BigInt(base.quantity);
  const minutes = BigInt(base.buildMinutes + base.revisionMinutes);
  const timeWon = (quantity * minutes * BigInt(hourlyRate) + 30n) / 60n;
  const supply = timeWon + quantity * BigInt(base.directCost + base.subcontractCost) + BigInt(allocation);
  const vat = taxMode === 'add10' ? (supply + 5n) / 10n : 0n;
  if (supply + vat > BigInt(Number.MAX_SAFE_INTEGER)) throw fault('VALUE', '계산할 수 있는 금액 범위를 넘었어요.');
  const subtotal = Number(supply), tax = taxMode === 'undecided' ? null : Number(vat);
  const total = tax === null ? null : subtotal + tax;
  const scope = base.scope, deadline = textValue(input.deadline, 120), terms = textValue(input.terms, 500);
  const formatted = subtotal.toLocaleString('ko-KR');
  const pricing = taxMode === 'undecided' ? '예상 공급가액은 ' + formatted + '원이며, 부가세 조건은 확인 후 안내드리겠습니다.'
    : taxMode === 'add10' ? '예상 금액은 부가세를 포함해 ' + total.toLocaleString('ko-KR') + '원입니다.'
    : '예상 금액은 ' + formatted + '원입니다. 부가세는 이 견적에 더하지 않았습니다.';
  const replyFormat = input.replyFormat ?? 'paragraph';
  if (!['paragraph', 'items'].includes(replyFormat)) throw fault('VALUE', '답장 형식을 확인해 주세요.');
  const sameScope = request && scope.normalize('NFKC').replace(/\s+/gu,' ') === request.scope;
  const sameItem = sameScope && base.quantity === request.quantity;
  const measure = sameScope && UNITS.includes(request.unit) ? request.unit : '건';
  const sections = [(sameItem ? '요청하신 ' : '제안드리는 ') + scope + ' ' + base.quantity + measure + ' 기준으로 계산했습니다.', pricing,
    deadline ? '제안드리는 납품 일정은 ' + deadline + '입니다.' : '희망 납품일을 알려주실 수 있을까요?'];
  if (sameItem && Number.isInteger(request.revisions)) sections.push('메일에서 요청하신 수정 횟수는 ' + request.revisions + '회입니다.');
  if (terms) sections.push('진행 조건은 다음과 같습니다. ' + terms);
  else if (!sameItem || !Number.isInteger(request.revisions)) sections.push('필요한 수정 범위도 알려주시면 반영하겠습니다.');
  return {
    ...base, replyFormat, hourlyRate, allocation, taxMode, subtotal, tax, total, deadline, terms,
    replyDraft: replyFormat === 'items' ? '안녕하세요.\n' + sections.map(line => '• ' + line).join('\n') : '안녕하세요. ' + sections.join(' '),
  };
}

const ASK = /[?？]|부탁|요청|문\s*의|궁금|주시(?:기|면|겠)|주실|주세요|보내\s*주|알려\s*주|(?:확인|회신|답변|회답)(?:을|를)?\s*바랍니다|필요합니다|해주세|please|could you|can you|would you|let me know|looking for|request/i;
const QUOTE = /견적|단가|제작비|비용|가격|요금|시세|예산|quote\b|quotat(?:ion|ions)|estimat(?:e|es)|pric(?:e|ing)|how much|budget/i;
const PROMISE = /(?:보내|전달|회신|회답|확인|정리|공유|안내|답변|답장|연락|송부|발송|확정|알려|보여)(?:을|를)?\s*(?:해\s*)?(?:하겠|할게|할 예정|드리겠|드릴게|드릴 예정|드리기로|겠습니다)|(?:i|we)(?:'ll| will)\s+(?:send|reply|confirm|share|check|follow up|get back)/i;
const THANKS = /^(?:(?:네|예)[,.\s]+)?(?:네[ ,.!]*|감사합니다|고맙습니다|감사드려요|알겠습니다|잘\s*받았습니다|확인했습니다|thank(?:s| you)|got it|noted|received)[\s.,!~🙏]*(?:감사합니다|고맙습니다|thank you)?[\s.,!~🙏]*$/i;
const RECEIPT = /^(?:(?:네|예)[,.\s]+)?(?:(?:보내\s*주신\s*)?(?:견적서?|자료|파일|메일|답변|수정본)(?:을|를|도)?\s+)(?:잘\s*)?(?:받았습니다|확인했습니다)[\s.,!]*(?:감사합니다|고맙습니다)?[\s.,!]*$/;
// Preserve an earlier unanswered request only for a complete attachment notice.
const SUPPORTING = /^(?:(?:참고(?:용(?:으로(?:만)?)?)?|추가(?:로)?)\s*)?(?:자료|파일)(?:를|을)?\s*(?:추가로\s*)?(?:첨부(?:합니다|했습니다|드립니다|해\s*드립니다)|보냅니다|보내드립니다)[.!\s]*(?:(?:감사합니다|고맙습니다)[.!\s]*)?$/u;
const AUTOMATIC = /^(?:out of office|automatic reply|자동\s*회신|부재중\s*안내|배송\s*알림|로그인\s*알림|verification code|인증\s*코드)(?:\s*[.!。！])?$/i;
const AUTO_REFERRAL = /^(?:(?:안녕하세요|부재중입니다|휴가 중입니다)[,.\s]+)*(?:(?:급한|긴급한|일반)\s*(?:문의|용무)(?:가\s*있으면|는|의\s*경우)\s*[^.!?。\n]{1,70}(?:에|에게|으로|로)\s*(?:연락|문의)(?:해|하여)\s*주세요|(?:for (?:urgent matters|assistance)[, ]+)?please contact [^.!?\n]{1,80})[.!。\s]*$/iu;
const ORDER_CHANGE = /(?:주문|발주|요청|작업|제작|납기|일정|진행|계약|결제)(?:을|를|은|는|이|가)?\s*(?:취소|철회|보류|변경|연기|중단)|(?:cancel|withdraw|postpone|reschedule)\b/iu;

function submissionFlags(value, replyHeader=false) {
  const token=String(value || '').split(';')[0].trim().toLowerCase();
  return {automatic:replyHeader || token==='auto-replied',generated:token==='auto-generated'};
}

const SENDER_HEADERS = new Set(['from','보낸사람','보낸이','발신','발신자']);
const TIME_HEADERS = new Set(['sent','date','날짜','보낸날짜','보낸시간','보낸일시','발신일시','발송일시']);
const RECIPIENT_HEADERS = new Set(['to','받는사람','수신','수신자','받는이']);
const MAIL_DATE = /(?:\b(?:19|20)\d{2}[-./년]\s*\d{1,2}[-./월]\s*\d{1,2}|\b\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2})\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s,-]+\d{1,2}(?:st|nd|rd|th)?[\s,.-]+(?:19|20)\d{2}|\b\d{1,2}[\s-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s,-]+(?:19|20)\d{2})/i;
const KOREAN_REPLY_DATE=/^\s*(?:19|20)\d{2}\s*(?:년|\.)\s*\d{1,2}\s*(?:월|\.)\s*\d{1,2}\s*(?:일|\.)/u;
const KOREAN_REPLY_HEADER=/^\s*(?:19|20)\d{2}\s*(?:년|\.)\s*\d{1,2}\s*(?:월|\.)\s*\d{1,2}\s*(?:일|\.)\s*(?:\([월화수목금토일](?:요일)?\)\s*)?(?:(?:오전|오후)\s*)?\d{1,2}:\d{2}(?::\d{2})?\s*,\s*[^<>\n]{0,100}<[^<>\s@]+@[^<>\s@]+>\s*(?:님이\s*)?작성\s*[:：]\s*$/u;
function latestBody(value,senderName='',incoming=false,keepSignature=false) {
  const lines=textValue(value,16000).split(/\r?\n/);
  const kept=[];
  const header=line=>(/^\s*([^:：]{1,48})\s*[:：]/.exec(line)?.[1]||'').replace(/\s+|\([^)]*\)/g,'').toLowerCase();
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^\s*-{2,}\s*(?:Original Message|Forwarded message|원본 메일|전달된 메일)/i.test(line))break;
    let replyHeader=/^\s*On .{1,300} wrote:\s*$/i.test(line)&&!ASK.test(requestText(line));
    if(!replyHeader && line.length<360 && KOREAN_REPLY_DATE.test(line)){
      replyHeader=KOREAN_REPLY_HEADER.test(line);
      if(!replyHeader && lines[i+1]?.length<160 && KOREAN_REPLY_HEADER.test(line+' '+lines[i+1])){
        replyHeader=true;
        i++;
      }
    }
    if(replyHeader){
      const next=lines.slice(i+1).find(s=>s.trim());
      if(!next||!/^\s*>/.test(next))break;
      continue;
    }
    if(SENDER_HEADERS.has(header(line))){
      const senderDetails = line.replace(/[^\s<>]*@[^\s<>]+/g, '');
      const dateWithSender = MAIL_DATE.test(senderDetails);
      let datedHeader = false, recipient = false, replySubject = false;
      for(const other of lines.slice(i+1,i+13)){
        if(!other.trim())continue;
        const key=header(other);
        if(!TIME_HEADERS.has(key)&&!RECIPIENT_HEADERS.has(key)&&!['subject','제목','cc','참조','bcc','숨은참조'].includes(key))break;
        datedHeader ||= TIME_HEADERS.has(key) && MAIL_DATE.test(other);
        recipient ||= RECIPIENT_HEADERS.has(key);
        replySubject ||= (key === 'subject' || key === '제목') && /[:：]\s*(?:re|fw|fwd|회신|답장|전달)(?:\[\d+\])?\s*[:：]/i.test(other);
      }
      if (((dateWithSender || datedHeader) && recipient) || (datedHeader && replySubject)) break;
    }
    if(!/^\s*>/.test(line))kept.push(line);
  }
  if(keepSignature)return kept.join('\n').trim();
  const separator=kept.findLastIndex(line=>/^\s*--\s*$/u.test(line));
  const tail=separator>=0 ? kept.slice(separator+1) : [];
  const loose=tail.map(line=>line.trim()).filter(Boolean);
  const closing=loose.length===1 ? signoffLine.exec('\n'+loose[0]) : null;
  const signedAttachmentNotice=incoming && closing?.[1].length===3 && !offeredClosing(closing[1]) &&
    SUPPORTING.test(kept.slice(0,separator).join('\n').trim());
  const current=separator>=0 && (signatureOnly(tail,senderName)||signedAttachmentNotice) ? kept.slice(0,separator) : kept;
  return current.filter(line=>!/^\s*--\s*$/u.test(line)).join('\n').trim();
}

function requestText(value){
  return value.replace(/https?:\/\/[^\s<>]+|[^\s<>()@,;:"?]+@[a-z0-9.-]+\.[a-z]{2,}|please (?:consider the environment|do not print|do not reply)[^\n]*/gi,s=>' '.repeat(s.length));
}

function normalizeLinkToken(token) {
      const start=token.search(/https?:\/\//iu);
      if(start<0)return token.normalize('NFKC');
      const prefix=token.slice(0,start),address=token.slice(start);
      const opener=prefix.at(-1);
      if(opener && ['(','<','〈'].includes(opener.normalize('NFKC'))){
        const wrapped=referenceDisplay(opener+address);
        if(wrapped)return prefix.slice(0,-1).normalize('NFKC')+wrapped;
      }
      const display=referenceDisplay(address);
      return display ? prefix.normalize('NFKC')+display : token;
}
function normalizeLinkDisplay(value) {
  return value.split('\n').map(line=>{
    // Angle-enclosed targets stay whole even if the actual href contains a list separator.
    const label=portfolioReference(line);
    if(label && !/[,，;；][(<（＜]?(?:https?):\/\//iu.test(line))return label;
    return line.replace(/\S+/gu,word=>{
      const pieces=[];
      let start=0;
      for(const boundary of word.matchAll(/[,，;；](?=[(<（＜]?(?:https?):\/\/)/giu)){
        const left=word.slice(start,boundary.index);
        if(!/https?:\/\//iu.test(left) || /[<＜]https?:\/\/[^>＞]*$/iu.test(left) ||
            /https?:\/\/[^\s<>]*[?#]/iu.test(left) && !/[)）>＞]$/u.test(left))continue;
        pieces.push(normalizeLinkToken(left+boundary[0]));
        start=boundary.index+1;
      }
      pieces.push(normalizeLinkToken(word.slice(start)));
      return pieces.join('');
    });
  }).join('\n');
}
function sameCurrentBody(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (left === right) return true;
  if (left.length >= 16000 || right.length >= 16000) return false;
  const display = body => normalizeLinkDisplay(latestBody(body))
    .replace(/^\s*[-*•]\s+/gmu,'').replace(/\s+/gu,' ').trim();
  return display(left) === display(right);
}

// Compare full MIME renditions, including quoted correspondence. Keep the first actual text for display.
function originalBodyVersions(texts) {
  const distinct=new Map();
  for (const value of texts) {
    const text=value.trim();
    if (!text) continue;
    const sections=[];
    for(const line of text.split(/\r\n?|\n/u)){
      const prefix=line.match(/^(?:[ \t]*>[ \t]?)+/u)?.[0] || '';
      const depth=prefix.split('>').length-1;
      const words=normalizeLinkDisplay(line.slice(prefix.length)).replace(/^[ \t]*[-*•][ \t]+/u,'• ').replace(/\s+/gu,' ').trim();
      if(!words)continue;
      if(sections.at(-1)?.[0]===depth)sections.at(-1)[1]+=' '+words;
      else sections.push([depth,words]);
    }
    const key=JSON.stringify(sections);
    if (!distinct.has(key)) distinct.set(key,text);
  }
  return [...distinct.values()];
}

function evidenceOf(body, fallback) {
  const lines = body.split(/\n+/).map(line => line.trim()).filter(line => requestText(line).trim());
  const requested = lines.filter(line => ASK.test(requestText(line)) || /(?:수량|수정|납품일|납기|납품\s*일정)/u.test(line));
  const line = requested.join(' ') || lines[0] || fallback;
  const at = requestText(line).search(ASK);
  return textValue(at > 200 ? '…' + line.slice(at - 110) : line, 280);
}

// Incremental sync keeps one excerpt and the facts needed for threading, without retaining full bodies.
// A closing line can name a person or actually offer a price or deliverable.
const offeredItem=/^(?:(?:제작비|가격|단가|비용|요금|예산|시세|무료|유료|유상|무상|공짜|정가|저가|특가|할인(?:가)?|추가|별도|서비스|사은품|견적서?|조건|자료|제안서?|첨부|파일|서류|수정본?|납품|일정|답장|회신|계약서?|결과|금액|작업|답변|결제|보너스|샘플|시안)(?:으?로|에|을|를|만|까지|도|은|는)?)$/u;
const signoffLine=/\n[ \t]*([가-힣]{2,8})[ \t]+(?:드림|올림|배상)[.!。]?[ \t]*$/u;
const companyLabel=/^[가-힣A-Za-z0-9 .&()-]{1,40}(?:스튜디오|연구소|주식회사|전시|문구|출판사|사무소|협회|미디어|컴퍼니|프로덕션|기획|상사|그룹|파트너스|디자인팀|제작팀|사업팀|지원팀|운영팀|studio|ltd\.?|inc\.?)$/iu;
const commercialLine=/무료|유료|무상|유상|가격|요금|금액|견적|제작비|납품|납기|할인|까지|파일|확정|전달|보냅|드립|입니다|합니다|\d{4}[-.]\d{1,2}[-.]\d{1,2}|[0-9]\s*(?:원|월|일|회)/u;
const timeWord=/(?:[월화수목금토일]요일|오늘|내일|모레|이번\s*(?:주|달)|다음\s*(?:주|달)|오전|오후|이번\s*달|주말|평일|\d+\s*(?:시|분|일|월))/u;
const workWord=/(?:촬영|작업|공연|녹음|방문|예약|미팅|회의|장소|현장|예정|마감|출고|배송|납기|납품|편집|제작|설치)/u;
function offeredClosing(name){
  const stem=name.replace(/(?:으로|까지|에서|에게|만큼|로|에|을|를|만|도|은|는)$/u,'');
  return offeredItem.test(name) || /(?:파일|서류|자료|제품|상품|결과물|납품물|완성품|한정판|원본|서식|샘플|청구서|계약서|제안서|견적서|내역서|계산서|확인서|발주서|의뢰서|명세서|수정본|완성본)$/u.test(stem) ||
    stem.length>=4 && /시안$/u.test(stem) || /값|할인|무상|무료|금액|단가|요금|비용/u.test(stem) ||
    /(?:송장|(?:최[저고]|공급|입찰|현금|현찰|카드|구매|소매|도매|원|정상|행사|특별|판매|세일|세금포함|회원|우대|반액|특|할인)가|정산서|영수증|청구액|최종[안본]|(?:최종|편집|수정|완성)(?:파일|안|본|물)|(?:신|신규|완성)(?:제품|상품))$/u.test(stem);
}
function personalSignoff(line,senderName,verifiedCard=false){
  const closing=signoffLine.exec(line);
  if(!closing || offeredClosing(closing[1]))return null;
  const display=typeof senderName==='string' ? senderName.normalize('NFKC').trim() : '';
  if(display)return display.split(/[^\p{L}\p{N}]+/u).includes(closing[1]) ? closing : null;
  // An address alone does not identify the author of a loose closing line.
  return verifiedCard && conventionalSignatureName(closing[1]) ? closing : null;
}
function incomingCompanySignoff(body,senderName){
  const closing=/\n[ \t]*([가-힣A-Za-z0-9&.()-]{2,36})[ \t]+([가-힣]{2,5})[ \t]+(?:드림|올림|배상)[.!。]?[ \t]*$/u.exec(body);
  if (typeof senderName!=='string' || !closing || offeredClosing(closing[2])) return null;
  const [,company,name]=closing;
  const display=senderName.normalize('NFKC').trim();
  if (display===company+' '+name) return closing;
  if (!companyLabel.test(company) || commercialLine.test(company)) return null;
  const identity=display.split(/[^\p{L}\p{N}]+/u);
  return identity.includes(name) || display===company && conventionalSignatureName(name) ? closing : null;
}
function conventionalSignatureName(name){
  return /^(?:[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구라민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제탁국어은편용]|남궁|황보|제갈|선우|독고|사공|서문|동방|어금|망절)[가-힣]{1,2}$/u.test(name);
}
function generalReceiptName(name){
  const conventional=name.length>=3 && conventionalSignatureName(name);
  const deliverable=/(?:파일|서류|자료|제품|상품|결과물|납품물|완성품|한정판|송장|영수증|청구액|원본|시안|서식|샘플|청구서|계약서|제안서|견적서|명세서|가격|단가|차액|할인|비용|제작비|납기|일정|수정본|완성본|최종[안본]|(?:으)?로|까지)$/u.test(name);
  return conventional && !deliverable;
}
function signaturePhone(line){
  const phone=line.replace(/^(?:전화|휴대폰|휴대전화|연락처|팩스|tel|phone|mobile|fax)\s*[:：.]?\s*/iu,'');
  if(!/^\+?[\d(][\d\s().-]*$/u.test(phone))return false;
  const digits=phone.replace(/[\s().-]/gu,'');
  if(/^\+\d{8,15}$/u.test(digits))return true;
  if(/^0(?:2\d{7,8}|(?:1[016789]|[3-6][1-5]|70|80)\d{7,8}|50\d{8,9})$/u.test(digits))return true;
  return /^(?:15|16|18)\d{2}[-. ]\d{4}$|^\(?[2-9]\d{2}\)?[- .]\d{3}[- .]\d{4}$/u.test(phone);
}
function signatureEmail(line){
  return /^(?:(?:이메일|메일|e-?mail)\s*[:：]?\s*)?[\w.!#$%&'*+/=?^_{|}~-]+@[\w.-]+\.[a-z]{2,}$/iu.test(line);
}
function signatureHomepage(line){
  const home=/^(?:홈페이지|웹사이트|website)\s*[:：]?\s*(https?:\/\/\S+)$/iu.exec(line);
  if(!home)return false;
  try{
    const link=new URL(home[1]);
    if(link.username || link.password || link.search || link.hash ||
       /(?:^|\.)(?:drive\.google\.com|docs\.google\.com|sharepoint\.com|dropbox\.com|1drv\.ms|onedrive\.live\.com)$/iu.test(link.hostname))return false;
    if(link.pathname==='/')return true;
    const segment=/^\/([a-z]{2,3}(?:-[a-z0-9]{2,8})*)\/?$/iu.exec(link.pathname);
    return Boolean(segment && Intl.DateTimeFormat.supportedLocalesOf([segment[1]]).length);
  }catch{return false;}
}
function signatureCompany(line,senderName){
  if(commercialLine.test(line) || timeWord.test(line) && workWord.test(line))return false;
  if(companyLabel.test(line))return true;
  const fields=line.split(/\s*(?:[|｜·ㆍ/]|[–—]|\s-\s)\s*/u);
  if(fields.length!==2)return false;
  const role=/^(?:대표(?:이사)?|공동대표|이사|팀장|실장|본부장|부장|과장|차장|대리|주임|사원|담당자?|매니저|디자이너|프로듀서|감독|작가|CEO|CTO|CFO|COO|Founder|Director|Manager|Designer)$/iu;
  const company=role.test(fields[0]) ? fields[1] : role.test(fields[1]) ? fields[0] : '';
  return Boolean(company) && (companyLabel.test(company) || /^[가-힣]{2,14}$/u.test(company) || /^[A-Z][A-Z0-9&.-]{1,29}$/u.test(company) ||
    typeof senderName==='string' && senderName.split(/[|｜·/()[\]]/u).some(part=>part.trim()===company));
}
function signatureOnly(lines,senderName){
  const tail=lines.map(line=>line.trim()).filter(Boolean);
  if(!tail.length)return true;
  const contact=tail.some(line=>signaturePhone(line)||signatureEmail(line));
  const company=tail.some(line=>signatureCompany(line,senderName));
  const verifiedCard=company && contact;
  let identity=false;
  for(const line of tail){
    if(personalSignoff('\n'+line,senderName,verifiedCard) ||
       /^[가-힣]{2,5}$/u.test(line) && personalSignoff('\n'+line+' 드림',senderName,verifiedCard)){
      identity=true;continue;
    }
    if(signaturePhone(line)||signatureEmail(line)||signatureCompany(line,senderName)||signatureHomepage(line)||
       /^(?:드림|올림|배상|감사합니다|고맙습니다)[.!。]?$/u.test(line))continue;
    return false;
  }
  return (identity || verifiedCard) && (!company || contact || Boolean(senderName) && tail.some(signatureHomepage));
}

// 「지난번처럼 해줘」는 최신 고객 견적 요청 뒤에 고객이 받았을 수 있는 답장이 하나도 없을 때만 연다(11-23 Fable 설계 검토).
// 접수 인사도 예외로 두지 않는다. 문장 판별로 여는 예외는 검수할 때마다 새 빈틈이 나왔다(0.5.8 검수 GPT-F).
const REPEAT_REPLIED='이 문의에는 이미 답장을 보냈어요. 보낸 답장과 맞게 견적 작성에서 정해 주세요.';

// A newly observed footer never establishes that a quote is still unanswered. The operator can
// classify the actual sent message after reading it. Keep the exact footer for a keyed local digest.
function outgoingReceipt(text,senderName){
  const raw=latestBody(text,senderName,false,true).replace(/^(?:안녕하세요|안녕하십니까)[,.!。\s]+/u,'');
  if(THANKS.test(raw)||RECEIPT.test(raw))return {kind:'plain'};
  const lines=raw.split('\n');
  let offset=0;
  while(offset<lines.length){
    const part=lines[offset].trim();
    if(part && !THANKS.test(part) && !RECEIPT.test(part))break;
    offset++;
  }
  if(!offset || !raw.trim())return {kind:'sent'};
  if(offset===lines.length)return {kind:'plain'};
  const tail=lines.slice(offset).join('\n').trim();
  const divider=/^--[ \t]*(?:\n|$)/u.test(tail);
  const fields=(divider?tail.replace(/^--[ \t]*(?:\n|$)/u,''):tail).split('\n').map(line=>line.trim()).filter(Boolean);
  if(!fields.length)return {kind:'plain'};
  const named=fields.some(line=>signoffLine.test('\n'+line));
  const card=fields.some(line=>signaturePhone(line)||signatureEmail(line)||signatureHomepage(line));
  if(!divider && !named && !card)return {kind:'sent'};
  const clearReply=fields.some(line=>{
    if(THANKS.test(line)||RECEIPT.test(line)||signaturePhone(line)||signatureEmail(line)||signatureHomepage(line))return false;
    const part=line.replace(/^(?:대표(?:이사)?|감독|팀장|매니저|담당자?|작가|프로듀서|대표자|CEO|Director)\s*[|｜·/]\s*/iu,'').normalize('NFKC');
    const companyMarker=/^(?:(?:주식|유한(?:책임)?)회사|\((?:주|유)\))\s*\S/u.test(part);
    const concreteDate=/(?:\d{1,4}[-./]\d{1,2}|\d{1,2}\s*[월일시]|[월화수목금토일]요일(?:에|까지)?(?:\s|$)|\([월화수목금토일]\))/u.test(part);
    const action=/(?:촬영|공연|제작|작업|편집|미팅|방문|회의|배송|수정|전달|납품|녹음|예약)\s*(?:일정|기한|장소|취소|변경|연기|보류|확정|요청|완료|예정|마감)|(?:장소|일정|기한)\s*[:：]/u.test(part);
    const closing=signoffLine.exec('\n'+line);
    if(closing && offeredClosing(closing[1]))return true;
    if(/https?:\/\//iu.test(line))return true;
    const dateLine=/^(?:\d{4}[-./]?\d{2}[-./]?\d{2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})(?:\s*\([월화수목금토일]\))?$/u.test(part);
    if(dateLine || action || concreteDate && workWord.test(part))return true;
    if(companyMarker)return false;
    return commercialLine.test(part) || /현금가|할인가|도매가|소매가|반값|(?:\d[\d,.]*)\s*(?:원|만원|달러)|가격을|부탁|입금/u.test(part) ||
      /(?:오늘|내일|모레|이번\s*주|다음\s*주|오전|오후|주말|[월화수목금토일]요일)(?:에|부터|까지)?(?:\s+|\d)/u.test(part) && workWord.test(part) || PROMISE.test(part);
  });
  return clearReply ? {kind:'sent'} : {kind:'verify',footer:tail};
}

const moneyAmount = /(?:[₩￦$€£]|\b(?:KRW|USD|EUR|GBP)\s*)\s*\d[\d,.]*|(?:\d[\d,.]*(?:\s*[백천만억]\s*\d*)*|[일이삼사오육칠팔구십백천만억]*[십백천만억])\s*(?:원(?!본)|달러|유로|엔|파운드|KRW\b|USD\b|EUR\b|GBP\b)/giu;
const taxAside = new RegExp('(?<=원|달러|유로|엔|파운드|KRW|USD|EUR|GBP|\\d)\\s*\\(\\s*(?:부가(?:가치)?세|세금|VAT)\\s*[:：]?\\s*(?:별도|포함|제외|'+moneyAmount.source+')\\s*\\)','giu');
const sentDocument = /(?:확정|최종)\s*(?:견적서|계약서|산출내역)(?:입니다|예요|를\s*보|를\s*전달)|(?:견적서?|산출내역|계약서|결과물|최종본|원본|파일)(?:[을를은는이가]\s*|\s+)(?:(?:첨부|발송|전달)(?:했|하였|합니다|드립니다|드렸|완료)|보냈|보냅|보내드렸|보내드립니다)/u;
const workDecision = /(?:촬영|작업|제작|편집|납품|예약|배송|주문|계약)(?:을|를|은|는|이|가)?\s*(?:취소|변경|보류|중단|장소\s+\S)|(?:납기|납품일|마감일|촬영일|일정)[^.!?\n]{0,45}(?:변경했|로\s*정했)/u;
const confirmedWork = /(?:(?:촬영|작업|제작|편집|납품|예약|배송|주문|계약)(?:을|를|은|는|이|가)?\s*|(?:납기|납품일|마감일|촬영일|일정)[^.!?\n]{0,45})확정(?:합니다|했|하였|됐|되었|되었습니다|입니다|이에요|해요|하되|$)/u;
const tentative = /미확정|(?<![가-힣])(?:미정|가정)(?=$|[\s.,]|(?:입니다|으로|이며|이라|이나|이므로|인\s))|확정(?:할|될|하기|되기|하기로|하기\s*전)|확정(?:된|한)?\s*(?:금액|가격|단가|일정)?(?:이|가|은|는)?\s*아(?:니|닙|닌|닐|님)|(?:확정|합의|결정|제안|취소|전달|보내)(?:하|되|되었|하지|되지|드리지|지)?\s*(?:않|못)|아직.{0,32}(?:아니|아닙|아닌|않|못)|not\s+(?:yet\s+)?(?:final|confirmed|agreed)/iu;
const customerBudget = /예산|희망(?:가|한\s*금액)|요청가|(?:고객(?:님)?(?:이|께서)?\s*)?(?:제시|말씀|요청)하신\s*(?:금액|가격|단가)|your budget/iu;
const actualOffer = /(?:당사|저희|이번)\s*(?:의\s*)?(?:확정\s*)?(?:견적|단가|금액|제안가)|(?:확정|제안|최종|공급)\s*(?:견적|금액|가격|단가|가액)|견적\s*(?:금액|합계)/u;

// Protect complete URLs before breaking the prose into clauses. Resolve labels for each address independently.
const referenceMedia = /(?:(?:행사장|촬영장|현장|스튜디오|행사|촬영)\s*)?(?:약도|오시는\s*길|위치\s*안내)|(?:촬영\s*장소|행사\s*현장|현장|제품)\s*(?:의\s*)?(?:사진|이미지|참고\s*영상)/u;
const referenceLabel = /(?:(?:행사장|촬영장|현장|스튜디오|행사|촬영)\s*)?(?:약도|오시는\s*길|위치\s*안내)|(?:촬영\s*장소|행사\s*현장|현장|제품)\s*(?:의\s*)?(?:사진|이미지|참고\s*영상)|참고용|참고\s*(?:자료|예시|링크)|포트폴리오|작업\s*사례|제작\s*예시|견적서?\s*(?:예시|샘플)|도움말|이용\s*방법|사용\s*(?:방법|가이드)|예전\s*예시|\b(?:help|guide|portfolio|example)\b/iu;
const deliveredQuoteLabel = /(?:보내드린|전달드린|발송한|공유한|보낸|첨부한)\s*(?:이번\s*)?(?:견적|계약|산출내역)|(?:견적(?:서)?|계약서|산출내역)(?:의|을|를|은|는)?\s*(?:링크|주소|문서|파일|입니다|예요|아래에서\s*확인)|(?:확정|최종)\s*(?:견적|계약서)|(?:이번|고객(?:님)?의?)\s*(?:고객\s*)?견적(?:입니다|이에요|$)|\b(?:your|final|attached)\s+(?:quote|estimate|invoice)\b/iu;
const unclearLinkLabel = /(?:어느|어떤)\s*(?:쪽|것|링크|주소)|(?:둘|두\s*링크)\s*중|(?:견적서?|계약서)인지/u;
const pointsBack = /^(?:이쪽|위쪽|앞쪽|여기(?:도|는)|먼저\s|(?:앞|첫|두)\s*번째(?:는|가)|(?:이|위|앞|방금|해당)\s*(?:주소|링크|자료|문서|파일)(?:[은는이가를을]|입니다|예요)|(?:은|는|이|가)\s)/u;
const quoteRoute = /^(?:quotes?|quotations?|estimates?|invoices?|견적서?|계약서)(?:\.(?:pdf|xlsx?|docx?))?$/iu;
const referenceRoute = /^(?:help|guides?|manuals?|docs|faq|support|tutorials?|samples?|examples?|portfolio|도움말|가이드|사용법|예시|참고자료)(?:[.-].*)?$/iu;
const linkMarker = '\uFFFC';

function captionParts(text) {
  return text.normalize('NFKC').split(/[.!?。;|,·]+/u)
    .map(part => part.replace(/^[\s()[\]<>,:·-]+|[\s()[\]<>,:·-]+$/gu, '')).filter(Boolean);
}

function parseLinkLine(raw) {
  const urls = [];
  if (signatureHomepage(raw.trim())) return {text:raw,urls};
  const text = normalizeLinkDisplay(raw).replace(/<(https?:\/\/[^\s<>]+)>|(https?:\/\/[^\s<>"']+)/giu,
    (match, explicit, bare, at, line) => {
      let address = explicit || bare;
      if (line[at-1] === '[' && address.endsWith(']')) address = address.slice(0,-1);
      urls.push(address);
      return linkMarker;
    });
  return {text,urls};
}

function captionsForLink(lines, lineNumber, index, parts) {
  const labels = [];
  const count = parts.length-1;
  const left = captionParts(parts[index]);
  const right = captionParts(parts[index+1]);
  // Between two URLs, "이쪽은…" refers to the preceding one. A new label before the next URL belongs to that next link.
  if (left.length && (index===0 || left.length>1 || !pointsBack.test(left.at(-1)))) labels.push(left.at(-1));
  if (right.length && (pointsBack.test(right[0]) || index===count-1 &&
      (!/^[\s()[\]<>]*[.!?。;,·|]/u.test(parts[index+1]) || /^\s*,\s*(?:참고용|예전\s*예시|사용\s*예시)/u.test(parts[index+1])))) labels.push(right[0]);
  if (labels.length || count!==1) return labels;
  const preceding = lines[lineNumber-1], following = lines[lineNumber+1];
  const previous = preceding && !preceding.urls.length && captionParts(preceding.text).at(-1);
  const next = following && !following.urls.length && captionParts(following.text)[0];
  if (previous && !(lines[lineNumber-2]?.urls.length && pointsBack.test(previous))) labels.push(previous);
  if (next && (pointsBack.test(next) || !lines[lineNumber+2]?.urls.length && !labels.some(label=>deliveredQuoteLabel.test(label)||referenceLabel.test(label)))) labels.push(next);
  return labels;
}

function quoteLinkKind(address, labels) {
  let link, segments;
  try {
    link = new URL(address);
    segments = link.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  } catch { return 'verify'; }
  if (link.username || link.password) return 'verify';
  // The most specific route wins: /support/quotes/Q-504 is a quote, /quotes/help is a guide.
  const quoteIndex = segments.findLastIndex(part => quoteRoute.test(part));
  const guideIndex = segments.findLastIndex(part => referenceRoute.test(part));
  const guide = guideIndex>quoteIndex;
  const current = labels.filter(label => !tentative.test(label) && !PROMISE.test(label));
  const delivered = current.some(label => deliveredQuoteLabel.test(label));
  // A promise about a future estimate can follow the label of a reference already shared.
  const reference = labels.some(label => !tentative.test(label) && referenceLabel.test(label));
  if (current.some(label => unclearLinkLabel.test(label)) || delivered && (reference || guide)) return 'verify';
  if (reference || guide) return 'none';
  if (delivered) return 'sent';
  const last = segments.at(-1) || '', parent = segments.at(-2) || '';
  if (quoteRoute.test(last) || quoteRoute.test(parent) && /^(?=[\p{L}\d_.-]*\d)[\p{L}\d_.-]+$/u.test(last)) return 'sent';
  const {hostname, pathname} = link;
  const sharedDocument = hostname === 'drive.google.com' && /^\/file\/d\/[^/]+/u.test(pathname) ||
    hostname === 'docs.google.com' && /^\/(?:document|spreadsheets|presentation)\/d\/[^/]+/u.test(pathname) ||
    hostname === '1drv.ms' && segments.length>0 || hostname.endsWith('.sharepoint.com') && /^\/:/u.test(pathname) ||
    /^(?:www\.)?dropbox\.com$/u.test(hostname) && /^\/s(?:cl)?\//u.test(pathname);
  // A shared file presented as a homepage is a delivered document, not an ordinary contact link.
  // Its contents do not establish that the operator sent a price.
  if (sharedDocument && labels.some(label => /홈페이지|website|homepage/iu.test(label))) return 'terms';
  return 'verify';
}

function outgoingLinkEvidence(body) {
  const lines = body.replaceAll(linkMarker,' ').split('\n').map(parseLinkLine);
  let decision = 'none';
  for (const [lineNumber,line] of lines.entries()) {
    const parts = line.text.split(linkMarker);
    for (const [index,address] of line.urls.entries()) {
      const kind = quoteLinkKind(address,captionsForLink(lines,lineNumber,index,parts));
      if (kind==='sent') return {decision:'sent'};
      if (kind==='terms') decision='terms';
      else if (kind==='verify' && decision==='none') decision='verify';
    }
  }
  return {decision,prose:lines.map(line=>line.text.replaceAll(linkMarker,' ')).join('\n')};
}

const deliveryDate = /(?:\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|[월화수목금토일]요일|오늘|내일|모레|(?:이번|다음)\s*주)/u;
const committedDelivery = /(?:까지|에)\s*(?:최종(?:본| 결과물)(?:을|를)?\s*)?(?:납품|배송|출고)(?:하겠습니다|합니다|해\s*드리겠습니다|할게요)|(?:확정|최종)\s*(?:납기(?:일)?|납품일|배송일)(?:은|는|이|가)?\s*.+(?:입니다|예요|이에요|로\s*정했)/u;
const previousTerms = /(?:지난(?:번|해|달|주)?|이전|예전|종전|과거|당시)(?:\s*(?:의|에|의\s*)?\s*(?:프로젝트|작업|건|주문|계약|견적|금액|가격|단가|납기|납품일|제안))/u;
const currentTerms = /이번|현재|지금|오늘|새\s*견적/u;
const offerAtAmount = /^(?:으로|로|에)\s*(?:(?:제작|진행|제공)(?:하겠습니다|합니다|해\s*드리겠습니다|해\s*드립니다)|확정(?:합니다|했습니다))/u;
const futureDecision = /(?:확인|검토|협의|조율)(?:한)?\s*(?:후|뒤|다음에)\s*(?:일정을?\s*)?(?:확정|결정|조율)(?:하겠|할게|할\s*예정)/u;
function historicalOnly(clause) {
  const previous=clause.search(previousTerms);
  if(previous<0)return false;
  const terms=clause.slice(previous);
  const appliedAgain=/(?:과|와)\s*(?:똑?같|동일|마찬가지)|(?:처럼|때처럼|때와\s*같이|그대로|동일하게|기준으로)/u;
  return !currentTerms.test(terms) && !appliedAgain.test(terms);
}

function outgoingQuoteDecision(body) {
  // The plain-text view labels withdrawn text. An unresolved withdrawal always requires reading this reply.
  let depth=0,withdrawn=false;
  const current=[];
  for(const part of body.split(/(〔\/?취소선〕)/u)){
    if(part==='〔취소선〕'){depth++;withdrawn=true;}
    else if(part==='〔/취소선〕'){depth=Math.max(0,depth-1);withdrawn=true;}
    else if(!depth)current.push(part);
  }
  const links = outgoingLinkEvidence(current.join(' '));
  let decision = links.decision==='none' && withdrawn ? 'verify' : links.decision;
  if (decision === 'sent') return 'quote';
  const clauses = links.prose.normalize('NFKC')
    .split(/(?<=[?？])|[\n。!！;]+|(?<!\d)\.(?=\s|$)|[,，](?=\s)|(?<=지만|으나|이며|이었고|이고|이고요|했으며|됐으며|였으며|했고|됐고|였고|아니라|아니고)\s+|(?<=인데|이나|는데|하되|이라|라서|어서)\s+(?=(?:[가-힣]+\s+){0,3}[가-힣]+[은는이가만]\s)/u);
  for (const clause of clauses) {
    const text = clause.trim();
    if (!text || signaturePhone(text) || signatureEmail(text) || signatureHomepage(text)) continue;
    // A range, a subtotal and its tax, or a unit price and total share the clause's subject and predicate.
    if (historicalOnly(text) || tentative.test(text) || /[?？]$/u.test(text)) continue;
    const pricing=text.replace(taxAside,'');
    const budget=customerBudget.exec(pricing);
    const amounts=Array.from(pricing.matchAll(moneyAmount));
    const last=amounts.at(-1);
    if (last && /^(?:이|가|은|는)?\s*아(?:니|닌|닙|닐|님)/u.test(pricing.slice(last.index+last[0].length).trim())) continue;
    const priceSubject = /(?:총액|합계|견적(?:가|금액)?|제작비|공급가(?:액)?|단가|가격|금액|부가세|총)\s*[:：은는이가를]?\s*$/u;
    for (const [i, match] of amounts.entries()) {
      const left = pricing.slice(i ? amounts[i-1].index + amounts[i-1][0].length : 0, match.index);
      const right = pricing.slice(match.index + match[0].length, amounts[i+1]?.index ?? pricing.length);
      const offered = offerAtAmount.test(right.trim());
      const budgetApplied = /(?:예산|희망가|요청가)[^.!?\n]{0,30}(?:맞춘|맞춰|맞추어|맞게|반영한|고려한|기준으로)\s*/u.test(left);
      if (budget && !offered && !(budgetApplied && priceSubject.test(left))) {
        const ourOffer=match.index<budget.index ? left : pricing.slice(budget.index+budget[0].length,match.index);
        if (!actualOffer.test(ourOffer)) continue;
      }
      if (offered || actualOffer.test(left) || priceSubject.test(left) ||
          /^(?:입니다|이에요|예요|으로\s*(?:확정|진행)|에\s*(?:진행|제공)|(?:으로|로)?\s*(?:제안|드림|드립니다|제공))/u.test(right.trim())) return 'quote';
      if (decision !== 'terms') decision='verify';
    }
    const considering = /(?:가능\s*(?:여부|한지)|취소|변경|일정|조건)[^.!?\n]{0,55}(?:검토|협의|조율|논의)\s*(?:중|예정|하겠|할\s*예정)/u;
    const futureChoice = /(?:확정|결정|조율)(?:드리|하|해\s*드리)?(?:겠|할게|할\s*예정|할\s*계획|할\s*것)/u;
    if (futureDecision.test(text) || considering.test(text) || futureChoice.test(text)) continue;
    const dateSubject = /(?:납품(?:일|일자|일정)|납기(?:일)?|배송일|(?:최종본|결과물|완성본)\s*(?:전달|인도|발송|제출|납품)(?:일|일자|일정))\s*(?:은|는|이|가|[:：])?\s*/u;
    const namedDate = dateSubject.test(text) && deliveryDate.test(text) && /(?:입니다|이에요|예요|확정|합의|정했|예정입니다)/u.test(text);
    const changedDate = /(?:납품\s*일정|납기|납품일|배송일)[^.!?\n]{0,55}(?:연기|변경|조정|앞당)(?:합니다|했습니다|겼습니다|하겠습니다)/u;
    const policy = /(?:취소|변경|환불|위약|예약|결제|착수)\s*(?:수수료|비용|위약금|기한|마감|조건|금)[^.!?\n]{0,55}(?:\d+\s*(?:%|퍼센트|영업일|일|시간)|무료|불가|가능|없(?:습니다|어요|음$))|(?:취소|환불|변경)(?:은|는|이|가)?\s*(?:불가|불가능|가능)(?:합니다|입니다|해요|이에요|$)/u;
    const conditionWindow = /(?:일정\s*변경|취소|환불|변경)[^.!?\n]{0,65}(?:\d+\s*(?:영업일|일|시간)\s*(?:전|후)|전날|당일)[^.!?\n]{0,28}(?:가능|불가|까지|어렵)/u;
    if (namedDate || deliveryDate.test(text) && (committedDelivery.test(text) || changedDate.test(text)) || policy.test(text) || conditionWindow.test(text)) decision='terms';
    const closing=signoffLine.exec('\n'+text);
    if (closing && offeredClosing(closing[1]) ||
        /(?:반값|무료|무상|할인(?:가)?|현금가)(?:으로|로|에|를|을|은|는)?\s*(?:진행|확정|제공|적용|드림|드립니다|입니다)/u.test(text)) return 'quote';
    if (!referenceLabel.test(text) && sentDocument.test(text)) {
      if (/(?:견적서?|산출내역|청구서)/u.test(text)) return 'quote';
      decision='terms';
    }
    if (!referenceMedia.test(text) && (workDecision.test(text) || confirmedWork.test(text))) decision='terms';
    if (decision!=='terms' && !referenceLabel.test(text) && /(?:견적서|납기|납품일|계약서|단가|할인)/u.test(text) && !PROMISE.test(text) && !customerBudget.test(text) &&
        !/(?:받았습니다|확인했습니다|희망|검토|문의|참고용)/u.test(text)) decision='verify';
  }
  return decision;
}

function compactMessage(message, digest) {
  const body=latestBody(message.text,message.senderName,!message.outgoing&&!message.draft), subject=textValue(message.subject,240);
  const envelope=message.outgoing ? outgoingReceipt(message.text,message.senderName) : null;
  const current=message.outgoing ? latestBody(message.text,message.senderName,false,true) : body;
  const meaningful=requestText(body);
  const complete = !message.partialBody && !message.unreadable && !message.uncertain &&
    typeof message.text === 'string' && message.text.length < 16000 &&
    textValue(message.subject,241).length <= 240;
  const reading = {source:body ? message.bodySource || 'body' : 'subject',complete,
    reason:message.readingReason || message.uncertain || (complete ? '' : '본문을 끝까지 확인하기 어려워요.'),
    stamp:digest ? digest(current) : ''};
  const quoteRequest=complete && !message.outgoing && !message.draft ? readQuoteRequest(body, subject, message.senderName) : null;
  const hasTerms=Boolean(quoteRequest && (quoteRequest.quantity || quoteRequest.revisions!==null || quoteRequest.deadline)) ||
    hasOrderQuantity(meaningful) || /수정\s*\d+\s*회|희망\s*납품|납품일|납기일|납품\s*일정/u.test(meaningful);
  const politeBody=body.replace(/^(?:안녕하세요|안녕하십니까)[,.!。\s]+/u,'');
  let receiptBody=politeBody;
  if(message.outgoing || message.senderName){
    // Only omit a final, standalone personal sign-off when recognizing a receipt.
    // The original text still supplies the evidence, terms, and promise signals.
    const closing=personalSignoff(politeBody,message.senderName) || (!message.outgoing && incomingCompanySignoff(politeBody,message.senderName));
    if(closing)receiptBody=politeBody.slice(0,closing.index).trimEnd();
  }
  const receiptLines=receiptBody.split('\n').map(line=>line.trim()).filter(Boolean);
  const courtesies=receiptBody.split(/[.!?。！？\n]+/u).map(line=>line.trim()).filter(Boolean);
  const goodwill=/^(?:(?:오늘도|남은\s*(?:하루|시간))\s*)?(?:좋은|즐거운|편안한|행복한)\s*(?:하루|저녁|주말|연휴)(?:를|을)?\s*(?:보내세요|되세요|보내시기\s*바랍니다)$/u;
  const onlyCourtesy=courtesies.length>0 && courtesies.every(line=>THANKS.test(line)||RECEIPT.test(line)||goodwill.test(line));
  const acknowledgement=onlyCourtesy||THANKS.test(receiptBody)||RECEIPT.test(receiptBody)||
    receiptLines.length>0 && receiptLines.every(line=>THANKS.test(line)||RECEIPT.test(line));
  let looseName='';
  if(complete && message.outgoing && !message.senderName && !acknowledgement){
    const lines=politeBody.split('\n').map(line=>line.trim()).filter(Boolean);
    const at=lines.findIndex(line=>signoffLine.test('\n'+line));
    if(at>=1){
      const name=signoffLine.exec('\n'+lines[at])[1];
      const signatureField=line=>signaturePhone(line)||signatureEmail(line)||signatureCompany(line,'')||signatureHomepage(line);
      const rest=lines.slice(at+1);
      let prefix=at;
      while(prefix>0 && signatureField(lines[prefix-1]))prefix--;
      const opening=lines.slice(0,prefix).join('\n');
      if(!offeredClosing(name) && rest.every(signatureField) && (THANKS.test(opening)||RECEIPT.test(opening)))looseName=name;
    }
  }
  const quoteDecision=complete && envelope && envelope.kind!=='plain' ? outgoingQuoteDecision(current) : 'none';
  const statedQuoteTerms=quoteDecision==='quote' || quoteDecision==='terms';
  const termReview=quoteDecision==='verify';
  const checkReceipt=Boolean(complete && !statedQuoteTerms && (envelope?.kind==='verify' || termReview));
  const incompleteBody=Boolean(message.partialBody || message.unreadable || typeof message.text!=='string' || message.text.length>=16000);
  return {subject, originalRef:message.originalRef || null, originalUrl:message.originalUrl || '', text:evidenceOf(current,subject), signals:{complete,incompleteBody,reading,hasTerms,quoteRequest,
    receiptKind:complete ? envelope?.kind : null,
    statedQuoteTerms, sentPriceOrQuote:quoteDecision==='quote', termReview,
    thanks:complete&&(message.outgoing ? envelope?.kind==='plain' : acknowledgement),checkReceipt,
    generalReceipt:Boolean(complete && message.outgoing && (acknowledgement || looseName && generalReceiptName(looseName))),
    supporting:complete&&SUPPORTING.test(politeBody),
    referenceOnly:complete&&/^참고용(?:으로(?:만)?)?\s*(?:자료|파일)/u.test(politeBody), asks:ASK.test(meaningful), quote:QUOTE.test(meaningful), promise:PROMISE.test(meaningful), empty:!body,
    referral:AUTO_REFERRAL.test(meaningful.trim()), orderChange:ORDER_CHANGE.test(meaningful)
  }};
}

function draftFor(kind) {
  if (kind === 'quote') return '안녕하세요. 견적을 준비하고 있습니다. 납품할 결과물과 수량, 희망 일정, 원하시는 수정 범위를 알려주시면 금액과 함께 회신드리겠습니다.';
  return '안녕하세요. 보내주신 요청을 확인했습니다. 요청하신 내용을 살펴보고 회신드리겠습니다.';
}

// messages are ordered by the provider timestamp, not the untrusted Date header.
function inspectThread(messages, digest, compareTied) {
  const ordered = [...messages].sort((a, b) => a.at - b.at || compareTied?.(a,b) || String(a.id).localeCompare(String(b.id)));
  let active = null, customer = null, hasQuote = false, draftAt = null;
  let customerAddresses=[];
  let customerOrigin=null;
  let passive = null, directionReview = '';
  let lastSubject = '';
  let answeredRequestId = null, sentPriceOrQuote = false;
  function recordSentConditions(messageId, facts) {
    if (answeredRequestId !== messageId) sentPriceOrQuote=false;
    answeredRequestId=messageId;
    sentPriceOrQuote ||= facts.sentPriceOrQuote===true;
  }
  // 최신 고객 견적 요청 뒤에 고객이 받았을 수 있는 답장이 있으면 「지난번처럼 해줘」를 닫는다(11-23 Fable 설계 검토).
  // 받는 사람 필터 · 휴지통 · 방향 불확실 · 끝까지 못 읽음 · 첨부 분기보다 앞에서 세우고, 새 견적 요청 한 곳에서만 푼다.
  let replied = false;
  // 같은 시각에 고객에게 보냈을 수 있는 편지(휴지통 · 스팸 · 방향 불확실 포함)와 받은 편지가 함께 있으면 둘의 순서를 믿지 않는다.
  // 그 시각의 고객 편지는 잠금을 풀지 못한다(0.5.8 검수 카본 G1 · G2 — Gmail은 같은 밀리초 안의 순서를 보장하지 않는다).
  const moments = new Map();
  for (const m of ordered) {
    if (m.draft) continue;
    const moment = moments.get(m.at) || { sent: false, received: false };
    if (m.outgoing || m.directionUncertain || m.possibleSelf) moment.sent = true;
    if (!m.outgoing) moment.received = true;
    moments.set(m.at, moment);
  }
  const mixedMoment = at => Boolean(moments.get(at)?.sent && moments.get(at)?.received);
  for (const m of ordered) {
    const subject = textValue(m.subject, 240) || '(제목 없음)';
    const facts = m.signals || compactMessage(m,digest).signals;
    const plainSubject = subject.normalize('NFKC').trim()
      .replace(/^(?:(?:re|fw|fwd|답장|회신|전달|aw|wg|sv|tr)\s*(?:\[\d+\]|\(\d+\))?\s*:\s*|\[(?:외부(?:\s*메일)?|external)(?:\s+email)?\]\s*)+/i,'').trim();
    const comparison = plainSubject.replace(/\s+/g,' ').toLowerCase();
    // 휴지통 · 다른 수신자 · 방향 불확실 · 끝까지 못 읽음 · 첨부와 상관없이 고객이 받았을 수 있는 편지는 모두 잠근다.
    // 보낸 편지함 밖으로 옮긴 내 주소의 편지(possibleSelf)도 보낸 답장일 수 있다(0.5.8 검수).
    if ((m.outgoing || m.directionUncertain || m.possibleSelf) && !m.draft) replied = true;
    if((m.outgoing||m.draft) && customer && Array.isArray(m.recipients) &&
        !m.recipients.some(address=>customerAddresses.includes(address)))continue;
    const body = latestBody(m.text,m.senderName,!m.outgoing&&!m.draft);
    if (m.draft) { if(!m.excluded)draftAt = m.at; continue; }
    const excerpt = m.signals ? m.text : evidenceOf(body,subject);
    const part = { subject, originalRef:m.originalRef || null, originalUrl:m.originalUrl || '', reading:facts.reading, quoteRequest: facts.quoteRequest || null, request:excerpt, evidence:excerpt,
      evidenceId: String(m.id), lastAt: m.at, due: '', kind: 'general' };
    if (m.excluded) {
      passive ||= { ...part, status: 'excluded', reason: '스팸 또는 휴지통에 있는 편지예요.' };
      continue;
    }
    if (m.directionUncertain) {
      customerOrigin=null;
      hasQuote ||= QUOTE.test(subject) || facts.quote;
      directionReview=m.uncertain || '이 메일의 발신자를 확인해 주세요.';
      customer={...part,kind:hasQuote?'quote':'general',quoteRequest:null};
      customerAddresses=m.customerAddresses||[];
      lastSubject=comparison;
      active={...customer,status:'review',reason:directionReview};
      continue;
    }
    // A later outgoing promise cannot finish a partial read of an earlier sent reply.
    // Keep that exact original in view until the provider supplies its full body or a new customer request arrives.
    if(m.outgoing && active?.incompleteSent && !directionReview){
      if(!m.uncertain && facts.complete && (m.hasAttachments || facts.statedQuoteTerms)) recordSentConditions(customer?.evidenceId ?? null,facts);
      active={...active,lastAt:m.at,activityId:String(m.id)};
      continue;
    }
    if(m.outgoing && customer && facts.incompleteBody && !directionReview){
      const kind=hasQuote || QUOTE.test(subject) || facts.quote ? 'quote' : 'general';
      active={...part,kind,status:'review',incompleteSent:true,quoteRequest:null,reason:'보낸 답장을 끝까지 읽지 못했어요. 원문에서 회신 내용을 확인해 주세요.'};
      continue;
    }
    const genericSubject = /^(?:(?:견적\s*)?(?:문의|요청)|inquiry|참고\s*(?:자료|파일)|(?:자료|파일)\s*첨부|첨부\s*(?:자료|파일))$/iu.test(comparison);
    const changedSubject = Boolean(!m.outgoing && lastSubject && comparison !== lastSubject &&
      (ASK.test(plainSubject.replace(/문\s*의|inquiry/gi,'')) || hasQuote && !genericSubject));
    const supportingOnly=!m.uncertain&&!m.outgoing&&facts.supporting&&!facts.asks&&!changedSubject;
    if(active && supportingOnly && (!m.hasAttachments || facts.referenceOnly))continue;
    // A real incoming file may change what the customer wants, even when a mailing system sent it.
    if ((active || (QUOTE.test(subject) || facts.quote) && (facts.thanks || facts.empty)) && !m.outgoing && !m.uncertain && m.hasAttachments) {
      hasQuote ||= QUOTE.test(subject) || facts.quote;
      part.kind = hasQuote ? 'quote' : 'general';
      const terms=facts.quoteRequest;
      part.quoteRequest = facts.complete && terms && (terms.deadline || Number.isInteger(terms.revisions))
        ? {...terms,scope:'',quantity:null,unit:'',review:true} : null;
      customer = part;
      customerOrigin=null;
      customerAddresses=m.customerAddresses||[];
      directionReview = '';
      lastSubject = comparison;
      active = { ...part, status:'review', reason:'새 참고 자료를 받았어요. 메일의 첨부 내용을 확인해 주세요.' };
      continue;
    }
    const automaticNotice = facts.complete && !facts.hasTerms && !facts.quote && !facts.orderChange && (!facts.asks || facts.referral) &&
      (m.automatic || AUTOMATIC.test(subject.trim()) || m.generated && !facts.asks && !ASK.test(subject) && !QUOTE.test(subject));
    if (automaticNotice) {
      passive = { ...part, status: 'excluded', reason: '자동으로 보낸 안내예요.' };
      continue;
    }
    const subjectRequest = changedSubject || (!active && ASK.test(plainSubject));
    const sameAnsweredRequest=customer && answeredRequestId===customer.evidenceId;
    if (!m.outgoing && !subjectRequest && facts.thanks) {
      if (active) active={...active,lastAt:m.at};
      passive ||= { ...part, status: 'done', reason: '확인 인사를 받았어요.' };
      continue;
    }
    if (!m.outgoing && m.bulk && facts.complete && !m.uncertain && !facts.orderChange && !facts.asks && !facts.quote && !facts.hasTerms && !ASK.test(subject)) {
      passive ||= { ...part, status: 'excluded', reason: '별도 요청이 없는 일괄 안내예요.' };
      continue;
    }
    if(m.outgoing && !m.hasAttachments && (facts.termReview || !facts.promise && !facts.hasTerms) && facts.checkReceipt && active?.kind==='quote' &&
       ['reply','review','promise','waiting'].includes(active.status) && customer?.reading?.complete && !directionReview && !m.uncertain){
      // A closing courtesy cannot reopen a completed quote. An outstanding promise keeps its own original.
      // 금액이나 조건을 이미 보낸 요청에는 원문 확인으로 풀 보류를 새로 만들지 않는다(0.5.7 r4 D1). 남은 약속은 그대로 둔다.
      if (sameAnsweredRequest && ['waiting','promise'].includes(active.status)) {
        const promised=active.status==='promise' || facts.promise;
        active={...active, ...part, kind:active.kind, quoteRequest:null, activityId:String(m.id), status:promised ? 'promise' : 'waiting',
          reason:promised ? (sentPriceOrQuote ? '이 견적은 이미 보냈어요. 후속 회신의 원문과 남은 약속을 확인해 주세요.' : '진행 조건을 이미 안내했어요. 후속 회신의 원문과 남은 약속을 확인해 주세요.')
            : sentPriceOrQuote ? '견적을 보낸 뒤 후속 회신이 있었어요. 해당 회신의 원문을 볼 수 있어요.'
            : '진행 조건을 안내한 뒤 후속 회신이 있었어요. 해당 회신의 원문을 볼 수 있어요.'};
        continue;
      }
      // Each open receipt needs its own original. A later courtesy reply cannot resolve an earlier promise or partial read.
      const history=active.receiptHistory || [];
      if(active.receiptReply){
        const {receiptReply,receiptHistory,...earlier}=active;
        history.push(earlier);
      }
      const pending=active.receiptReply || active;
      const prior=facts.termReview && facts.promise && ['reply','waiting'].includes(pending.status)
        ? {...pending,status:'promise',reason:'보낸 편지에 아직 챙길 약속이 있어요.'} : pending;
      active={...part,kind:'quote',status:'review',quoteRequest:null,receiptReply:prior,
        needsTermsReview:Boolean(facts.termReview),
        receiptHistory:history,activityId:String(m.id),
        reason:facts.termReview ? '보낸 메일에서 조건을 제안했는지 확인해 주세요. 원문을 확인할 때까지 금액을 보류해요.' :
          '보낸 메일의 끝말이 서명인지 확인해 주세요. 원문을 확인할 때까지 금액을 보류해요.'};
      continue;
    }
    if (m.outgoing && !m.hasAttachments && active && (active.kind==='quote' ? facts.receiptKind==='plain' : (facts.thanks || facts.generalReceipt)) &&
        ['reply','review','promise'].includes(active.status)) {
      const next=active.status==='review' ? active.reason.replace(/^확인 답장을 보냈어요\. /u,'') : active.status==='promise' ? '먼저 약속한 회신이 남아 있어요.'
        : active.kind==='quote' ? '견적 회신이 남아 있어요.' : '요청 내용에 대한 답변이 남아 있어요.';
      active={...active,lastAt:m.at,activityId:String(m.id),reason:'확인 답장을 보냈어요. '+next};
      continue;
    }
    if (m.outgoing && active?.receiptReply && !m.hasAttachments && !facts.statedQuoteTerms && !m.uncertain) {
      const prior = active.receiptReply;
      const next = facts.promise && ['reply','waiting'].includes(prior.status) ? {...prior,status:'promise',reason:'보낸 편지에 아직 챙길 약속이 있어요.'} : prior;
      active = {...active,receiptReply:next,lastAt:m.at,activityId:String(m.id)};
      continue;
    }
    const asks = facts.asks || subjectRequest;
    if((changedSubject || subjectRequest && facts.thanks) && !facts.asks){
      part.request = part.evidence = textValue(plainSubject+(!facts.empty?' — '+part.evidence:''),280);
    }
    if (QUOTE.test(subject) || facts.quote) hasQuote = true;
    part.kind = hasQuote ? 'quote' : 'general';
    if (!hasQuote) part.quoteRequest = null;
    if (!customer || !m.outgoing) lastSubject=comparison;
    if (!m.outgoing) {
      // Only a new customer request releases the existing duplicate guard.
      if (sameAnsweredRequest && (!asks || !facts.complete || m.uncertain || m.bulk || m.copied)) answeredRequestId=part.evidenceId;
      // 본문에 묻는 말과 견적 낱말이 함께 든, 끝까지 읽은 고객 편지만 「지난번처럼 해줘」 잠금을 푼다. 바뀐 제목만으로는
      // 풀지 않는다(답장에 「Re:」로 단 인사도 제목이 달라 보인다 — 0.5.8 검수 c 카본 F2 · GPT F2). 내 주소 편지는 풀지 못한다.
      if (facts.asks && facts.quote && facts.complete && !m.uncertain && !m.bulk && !m.copied && !m.possibleSelf && !mixedMoment(m.at)) replied=false;
      customer = part;
      customerAddresses=m.customerAddresses||[];
      directionReview = '';
      customerOrigin = part.kind==='quote' && asks && !m.uncertain && !m.bulk && !m.copied &&
        facts.reading?.complete && facts.reading.stamp && Number.isFinite(m.at)
        ? {id:part.evidenceId, messageKey:m.customerStableId===undefined ? part.evidenceId : m.customerStableId, at:m.at, stamp:facts.reading.stamp, subject, terms:part.quoteRequest} : null;
    }
    const current = m.outgoing && customer ? {...customer,lastAt:m.at,activityId:String(m.id)} : part;
    if (m.outgoing && hasQuote && !directionReview && !m.uncertain && (m.hasAttachments || facts.statedQuoteTerms)) {
      recordSentConditions(current.evidenceId,facts);
    }
    if (m.outgoing && directionReview) {
      active = { ...current, status:'review', reason:directionReview };
    } else if (m.uncertain) {
      active = { ...current, status: 'review', reason: textValue(m.uncertain,240) };
    } else if (m.outgoing && facts.promise) {
      active = { ...current, status: 'promise', reason: '보낸 편지에 아직 챙길 약속이 있어요.' };
    } else if (m.outgoing) {
      active = { ...current, status: 'waiting', reason: '내가 보낸 답장 뒤에 새 요청이 없어요.' };
    } else if (m.bulk || m.copied || !asks || (facts.empty&&!changedSubject&&!ASK.test(plainSubject))) {
      active = { ...part, status: 'review', reason: m.copied ? '참조로 받은 편지라 담당자를 확인해 주세요.'
        : m.bulk ? '여러 사람에게 보낸 편지라 내 답이 필요한지 확인해 주세요.' : '직접 답할 내용인지 확인해 주세요.' };
    } else {
      active = { ...part, status: 'reply', reason: '고객의 요청 뒤에 보낸 답장이 없어요.' };
    }
  }
  const result = active || passive;
  if (!result) return null;
  if (draftAt !== null && draftAt >= result.lastAt && ['reply','review','promise'].includes(result.status)) {
    if(result.status==='review')result.reason+=' 작성 중인 메일도 있어요.';
    else {
      result.status = 'draft';
      result.reason = '작성 중인 메일이 있고 아직 보내지 않았어요.';
    }
  }
  const sentQuoteReply = answeredRequestId !== null && answeredRequestId === (customer || result).evidenceId;
  const followupPromise=sentQuoteReply && result.receiptReply?.status==='promise';
  return { ...result, ...(followupPromise ? {status:'promise',
    reason:sentPriceOrQuote ? '이 견적은 이미 보냈어요. 후속 회신의 원문과 남은 약속을 확인해 주세요.' : '진행 조건을 이미 안내했어요. 후속 회신의 원문과 남은 약속을 확인해 주세요.'} : {}),
    customerOrigin, sentQuoteReply, repliedSinceRequest:replied, ...(sentQuoteReply ? {sentReplyKind:sentPriceOrQuote ? 'quote' : 'terms'} : {}), replyDraft: draftFor(result.kind) };
}

const WORK = new Set(['reply','promise','draft']);
function choiceApplies(thread, choice = thread.manual) {
  return Boolean(choice && choice.for === thread.evidenceId && (choice.activity || '') === (thread.activityId || ''));
}
const ROLES = ['견적 담당', '디자인 담당', '고객지원 담당'];
function emptyState() { return { version: 1, boxes: [], threads: [], jobs: [], quotes: [], handoffs: [] }; }

function canRepeatSource(source, thread) {
  if (!source || !thread) return false;
  if (source.threadId !== thread.id) return true;
  return Boolean(source.boxId === thread.boxId && source.customerMessageKey && thread.customerMessageKey &&
    source.customerMessageKey !== thread.customerMessageKey && Number.isFinite(source.customerMessageAt) &&
    Number.isFinite(thread.customerMessageAt) && thread.customerMessageAt > source.customerMessageAt);
}

function handoffEvidenceMatches(handoff, thread) {
  if (!thread?.evidenceId || !handoff.evidenceId) return false;
  if (handoff.status === 'accepted' && (handoff.customerRequestId || thread.customerRequestId)) {
    return Boolean(handoff.boxId === thread.boxId && thread.customerRequestId &&
      (handoff.customerRequestId || handoff.evidenceId) === thread.customerRequestId);
  }
  return handoff.evidenceId === thread.evidenceId;
}

function appendQuote(state, thread, fields, makeId, now) {
  const previous = state.quotes.find(quote => quote.threadId === thread.id && quote.evidenceId === thread.evidenceId);
  const same = previous && Object.entries(fields).every(([key,value]) =>
    (key === 'replyFormat' ? previous.replyFormat ?? 'paragraph' : previous[key]) === value);
  if (same && previous.evidenceId === thread.evidenceId) return;
  const version = 1 + state.quotes.reduce((n,q) => q.threadId === thread.id ? Math.max(n,q.version) : n, 0);
  state.quotes.unshift({ ...fields, id: makeId(), threadId: thread.id, boxId: thread.boxId, evidenceId: thread.evidenceId,
    ...(thread.customerMessageKey ? {customerMessageKey:thread.customerMessageKey, customerMessageAt:thread.customerMessageAt} : {}),
    subject: thread.subject, version, createdAt: now });
}

function repeatAction(state, name, input, thread, makeId, now, bindInputs) {
  if (!input.evidenceId || input.evidenceId !== thread.evidenceId) throw fault('STALE', '이번 문의를 다시 열어 주세요.');
  if(thread.repliedSinceRequest!==false && name!=='rememberQuote')throw fault('VALUE',REPEAT_REPLIED);
  if(thread.sentQuoteReply && name!=='rememberQuote')throw fault('VALUE','이미 조건을 보낸 문의예요. 새 고객 요청이 오면 이전 견적을 다시 쓸 수 있어요.');
  const source = state.quotes.find(q => q.repeatMethod);
  const activeId = source?.repeatMethod.id || '';
  const latest = state.quotes.find(q => q.threadId === thread.id && q.evidenceId === thread.evidenceId);
  if (name === 'rememberQuote') {
    if (!latest || latest.id !== input.quoteId || latest.evidenceId !== thread.evidenceId) {
      throw fault('STALE', '현재 문의에서 견적 초안을 다시 저장한 뒤 방식을 기억해 주세요.');
    }
    const includedRevisions = whole(input.includedRevisions, '기준 수정 횟수', 1000);
    if (!UNITS.includes(input.unit)) throw fault('VALUE', '가격표의 수량 단위를 골라 주세요.');
    if (!latest.customerMessageKey && thread.customerMessageKey) {
      latest.customerMessageKey=thread.customerMessageKey;
      latest.customerMessageAt=thread.customerMessageAt;
    }
    if (source === latest && source.repeatMethod.unit === input.unit && source.repeatMethod.includedRevisions === includedRevisions) return;
    if (activeId !== input.expectedMethodId) throw fault('STALE', '기억한 가격표가 바뀌었어요. 다시 확인해 주세요.');
    if (source) delete source.repeatMethod;
    latest.repeatMethod = { id: makeId(), unit: input.unit, includedRevisions };
    return;
  }
  if (!source || input.methodId !== activeId) throw fault('STALE', '기억한 방식이 바뀌었어요. 다시 확인해 주세요.');
  const status = choiceApplies(thread) ? thread.manual.status : thread.status;
  if (thread.incompleteSent || !canRepeatSource(source,thread) || thread.kind !== 'quote' || !['reply','draft','promise'].includes(status)) {
    throw fault('VALUE', '새로 받은 견적 문의에서 이 방식을 사용할 수 있어요.');
  }
  const options = {};
  const titleConfirmationKey = titleNeedsConfirmation(thread.quoteRequest)
    ? JSON.stringify([EXCERPT_INDEX_VERSION, thread.id, thread.evidenceId, activeId, thread.subject, thread.quoteRequest])
    : '';
  if (input.confirmedTitle === true) {
    if (!titleConfirmationKey || input.titleConfirmationKey !== titleConfirmationKey) throw fault('STALE', '이번 메일 제목과 조건을 다시 확인해 주세요.');
    options.confirmedTitle = true;
  }
  if (input.revisionMinutes != null) options.revisionMinutes = whole(input.revisionMinutes, '이번 개당 수정 시간', 1000000);
  if (input.allocation != null) options.allocation = whole(input.allocation, '이번 구독료 배분액', 1e10);
  const { fields, ...proposal } = repeatProposal(source, thread, options, quoteFields);
  const previewKey = bindInputs([EXCERPT_INDEX_VERSION,thread.id,thread.evidenceId,source.id,activeId,
    options.confirmedTitle===true,options.revisionMinutes??null,options.allocation??null]);
  if (name === 'repeatPreview') return { ...proposal, ...options, titleConfirmationKey, previewKey, canSave: !!fields,
    threadId: thread.id, evidenceId: thread.evidenceId, methodId: activeId, expectedQuoteId: latest?.id || '' };
  if (!fields || input.previewKey !== previewKey || input.expectedDraft !== fields.replyDraft) throw fault('STALE', '현재 조건으로 초안을 다시 확인해 주세요.');
  const clean = { ...fields, referenceId: '', referenceTitle: '', repeatedMethodId: activeId, sourceQuoteId: source.id,
    confirmedTitle: options.confirmedTitle === true, sourceIncludedRevisions: source.repeatMethod.includedRevisions, sourceRevisionMinutes: source.revisionMinutes, quantityUnit: source.repeatMethod.unit };
  if ((latest?.id || '') !== input.expectedQuoteId && !(latest?.evidenceId === thread.evidenceId &&
      Object.entries(clean).every(([key,value]) => latest[key] === value))) {
    throw fault('STALE', '이 문의에 새 견적이 저장됐어요. 현재 견적을 확인해 주세요.');
  }
  appendQuote(state, thread, clean, makeId, now);
}

function updateJob(state, name, input, makeId, now, bindInputs=JSON.stringify) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fault('VALUE', '입력한 내용을 확인해 주세요.');
  if (name === 'job') {
    const fields = jobFields(input);
    state.jobs.unshift({ ...fields, deadline: textValue(input.deadline, 120), terms: textValue(input.terms, 700), id: makeId(), createdAt: now });
    return;
  }
  if (name === 'accept' || name === 'finish') {
    const handoff = state.handoffs.find(item => item.id === input.id);
    if (!handoff) throw fault('MISSING', '인계할 일을 찾지 못했어요.');
    const expected = name === 'accept' ? 'pending' : 'accepted', target = name === 'accept' ? 'accepted' : 'done';
    if (target === 'done' && handoff.status === target) return;
    const latest = state.threads.find(thread => thread.id === handoff.threadId);
    if (!handoffEvidenceMatches(handoff,latest)) {
      throw fault('STALE', '인계 후 문의가 바뀌었어요. 최신 메일을 확인해 주세요.');
    }
    if (handoff.status === target) return;
    if (handoff.status !== expected) throw fault('STALE', '인계 상태가 바뀌었어요. 다시 확인해 주세요.');
    if (name==='accept' && latest.customerRequestId) handoff.customerRequestId=latest.customerRequestId;
    handoff.status = target;
    handoff.updatedAt = now;
    return;
  }
  const thread = state.threads.find(item => item.id === input.threadId);
  if (!thread) throw fault('MISSING', '메일 대화를 찾지 못했어요.');
  if (typeof input.evidenceId !== 'string' || !input.evidenceId || input.evidenceId !== thread.evidenceId) {
    throw fault('STALE', '새 메일이 왔어요. 대화를 다시 열어 내용을 확인해 주세요.');
  }
  if (['rememberQuote','repeatPreview','saveRepeatedQuote'].includes(name)) {
    return repeatAction(state, name, input, thread, makeId, now, bindInputs);
  }
  if (name === 'mark' || name === 'reopen') {
    thread.manual = { for: thread.evidenceId, activity: thread.activityId || '', status: name === 'mark' ? 'done' : 'reply' };
    return;
  }
  if (name === 'quote') {
    if (thread.incompleteSent) throw fault('VALUE','보낸 견적과 현재 문의의 원문을 확인해 주세요.');
    const fields = quoteFields(input,thread.reading?.complete ? thread.quoteRequest : null);
    const reference = input.referenceId ? state.jobs.find(job => job.id === input.referenceId) : null;
    if (input.referenceId && !reference) throw fault('MISSING', '근거로 고른 완료 작업을 찾지 못했어요.');
    appendQuote(state, thread, { ...fields, referenceId: reference?.id || '', referenceTitle: reference?.title || '' }, makeId, now);
    return;
  }
  if (name === 'handoff') {
    if (!ROLES.includes(input.to)) throw fault('VALUE', '받을 담당자를 골라 주세요.');
    const next = needed(input.next, '다음 할 일');
    const conditions = textValue(input.conditions, 700), due = textValue(input.due, 120), reference = textValue(input.reference, 500);
    const quoteId = state.quotes.find(item => item.threadId === thread.id && item.evidenceId && item.evidenceId === thread.evidenceId)?.id || '';
    const same = state.handoffs.find(item => item.threadId === thread.id && item.evidenceId === thread.evidenceId &&
      item.quoteId === quoteId && item.to === input.to && item.next === next &&
      item.conditions === conditions && item.due === due && item.reference === reference);
    if (same) return;
    state.handoffs.unshift({ id: makeId(), threadId: thread.id, boxId: thread.boxId, subject: thread.subject,
      request:thread.request, evidence:thread.evidence,evidenceId:thread.evidenceId, quoteId,
      to: input.to, next, conditions, due, reference, status: 'pending', createdAt: now, updatedAt: now });
    return;
  }
  throw fault('VALUE', '지원하지 않는 동작이에요.');
}

function publicView(state, capabilities) {
  const source=state.quotes.find(quote=>quote.repeatMethod);
  const threads = state.threads.map(thread => {
    const { manual, originalUrl, originalRef, tiedOriginals,receiptReply,receiptConfirmed,receiptHistory,receiptReadCount,customerOrigin,customerRequestId,customerFingerprint,customerMessageKey,customerMessageAt,...visible } = thread;
    visible.canRepeatSameThread=Boolean(source?.threadId===thread.id && thread.evidenceId && !thread.awaitingEvidence &&
      !thread.orderUncertain && !thread.sentQuoteReply && thread.repliedSinceRequest===false && (!receiptReply || receiptConfirmed) && canRepeatSource(source,thread));
    if(receiptReply && !receiptConfirmed)visible.needsReceiptReview=true;
    visible.directOriginal=Boolean(originalUrl);
    visible.canReadOriginal=Boolean(originalRef);
    const facts=visible.quoteRequest;
    if (visible.kind==='quote' && visible.reading?.complete && !facts?.review && !facts?.checkTitle && facts?.scope && facts.quantity && facts.unit) {
      const revisions=Number.isInteger(facts.revisions) ? '수정 '+facts.revisions+'회' : '수정 횟수 확인 필요';
      const deadline=facts.deadline ? (facts.deadlineIsLimit ? facts.deadline+'까지 납품' : '희망 납품일 '+facts.deadline) : '희망 납품일 확인 필요';
      visible.request=[facts.scope+' '+facts.quantity+facts.unit,revisions,deadline].join(' · ');
    }
    if (visible.reading) {
      const {source,complete,reason}=visible.reading;
      visible.reading={source,complete,reason};
    }
    if (choiceApplies(thread,manual)) return { ...visible, status: manual.status, reason: '직접 처리 상태를 표시했어요.' };
    return visible;
  }).sort((a,b) => Number(WORK.has(b.status)) - Number(WORK.has(a.status)) || b.lastAt - a.lastAt);
  return { boxes: state.boxes.map(({ id,label,provider,phase,checked,detail,startedAt,completedAt }) => ({id,label,provider,phase,checked,detail,startedAt,completedAt})),
    threads, jobs: state.jobs, quotes: state.quotes.map(({customerMessageKey,customerMessageAt,...quote})=>quote),
    handoffs: state.handoffs.map(({customerRequestId,...item}) => ({ ...item, excerpt: item.evidence || item.excerpt || '' })), capabilities };
}

module.exports = { EXCERPT_INDEX_VERSION, REPEAT_REPLIED, headerDisplayName, headerAddresses, submissionFlags, sameCurrentBody, originalBodyVersions, fault, textValue, jobFields, quoteFields, inspectThread, compactMessage, emptyState, updateJob, publicView, choiceApplies, handoffEvidenceMatches };
