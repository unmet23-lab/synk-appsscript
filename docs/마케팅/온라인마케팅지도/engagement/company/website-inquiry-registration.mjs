// Read-only interpretation of the three existing interest-registration forms.
// No customer text or email is retained in the returned metadata or summary.
const PRODUCTS=[
  {id:'topik4',label:'TOPIK 4급 온라인 반',marker:'[TOPIK 4급 온라인 반 관심 등록]',types:['LAB · 한국어 교육'],fields:['이름','지금 급수','4급이 필요한 때','토요일 시간'],note:'쓰기에서 어려운 점'},
  {id:'ub-academy',label:'울란바토르 한국어 학원',marker:'[울란바토르 관심 등록 · 학원]',types:['LAB · 한국어 교육'],fields:['이름','누가 적었나','학생 한국어','한국에 가려는 때','다니기 좋은 때'],note:'궁금한 점'},
  {id:'ub-consult',label:'한국 유학 상담',marker:'[울란바토르 관심 등록 · 유학 상담]',types:['PATH · 유학·취업 연계','SHIFT · 유학·취업 연계'],fields:['이름','누가 적었나','학생 한국어','한국에 가려는 때','생각하는 유학'],note:'궁금한 점'},
];

export function websiteInquiryRegistration(input){
  const message=typeof input?.message==='string'?input.message:'';
  if(input?.classification?.isTest||['test','privacy'].includes(input?.classification?.category)||
    /\[SYNK 기능 점검\s*[·-]\s*실제 문의 아님\]/.test(message)||/개인정보.{0,12}(삭제|열람|철회)|동의.{0,8}철회/.test(message))return null;
  const lines=message.split(/\r?\n/),product=PRODUCTS.find(p=>p.marker===lines[0]&&p.types.includes(input.type));
  if(!product)return null;
  const seen=new Set();let source='direct',language=null,hasNote=false,resubmitted=false,unrecognized=false,inNote=false,sourceSeen=false;
  for(const line of lines.slice(1)){
    if(!line.trim())continue;
    const origin=/^들어온 곳: ([a-z0-9][a-z0-9-]{0,39}) · 화면 언어 (한국어|몽골어)$/.exec(line);
    if(origin){if(sourceSeen)unrecognized=true;sourceSeen=true;source=origin[1];language=origin[2]==='한국어'?'ko':'mn';inNote=false;continue;}
    if(line.startsWith('다시 등록:')){resubmitted=true;inNote=false;continue;}
    if(line.startsWith(product.note+':')){hasNote||=!!line.slice(product.note.length+1).trim();inNote=true;continue;}
    if(inNote){hasNote=true;continue;}
    const field=product.fields.find(name=>line.startsWith(name+':'));
    if(field){if(seen.has(field)||!line.slice(field.length+1).trim())unrecognized=true;seen.add(field);continue;}
    if(product.id!=='topik4'&&line.startsWith('함께 등록:')&&line.slice(6).trim())continue;
    unrecognized=true;
  }
  const manualReviewRequired=hasNote||resubmitted||unrecognized||!sourceSeen||product.fields.some(field=>!seen.has(field));
  return {productId:product.id,label:product.label,source,language,hasNote,resubmitted,waitlistOnly:!manualReviewRequired,manualReviewRequired};
}

export function summarizeWebsiteRegistrations(items){
  const products=PRODUCTS.map(({id,label})=>({id,label,records:0,uniqueEmails:0,duplicateRecords:0,waitlistRecords:0,needsReviewRecords:0,resubmittedRecords:0,sources:[]}));
  const emails=new Map(PRODUCTS.map(({id})=>[id,new Set()])),sources=new Map(PRODUCTS.map(({id})=>[id,new Map()]));
  for(const item of items||[]){
    if(item.status==='closed')continue;
    const registration=websiteInquiryRegistration(item);if(!registration)continue;
    const product=products.find(p=>p.id===registration.productId),email=String(item.email||'').trim().toLowerCase();
    // A source without a usable address is not an identified registration.
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))continue;
    product.records++;emails.get(product.id).add(email);
    if(registration.waitlistOnly)product.waitlistRecords++;
    if(registration.manualReviewRequired)product.needsReviewRecords++;
    if(registration.resubmitted)product.resubmittedRecords++;
    const bySource=sources.get(product.id),entry=bySource.get(registration.source)||{source:registration.source,records:0,emails:new Set()};
    entry.records++;entry.emails.add(email);bySource.set(entry.source,entry);
  }
  for(const product of products){
    product.uniqueEmails=emails.get(product.id).size;product.duplicateRecords=product.records-product.uniqueEmails;
    product.sources=[...sources.get(product.id).values()].sort((a,b)=>a.source.localeCompare(b.source)).map(({source,records,emails})=>({source,records,uniqueEmails:emails.size}));
  }
  return {products};
}
