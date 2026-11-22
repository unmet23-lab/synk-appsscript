'use strict';
/*
 * 사업계획서 기능이 쓰는 Office 파일 읽기와 쓰기(사업계획서_설계.md 2.1, 4.3).
 * 앱에 실행 의존성을 넣지 않으려고 ZIP을 node zlib로 직접 푼다.
 * - ZIP: 중앙 목록을 읽고, 항목마다 풀린 크기와 CRC를 확인한다. 암호, ZIP64, 저장·deflate 밖의 압축은 받지 않는다.
 * - .docx: 본문 문단(표 칸 안 포함)의 글과 각 글 조각의 XML 자리를 읽는다. 바꾸기는 그 자리의 글만 고친다.
 * - .xlsx: 시트마다 「시트 · N행: 칸 | 칸」 줄로 읽는다.
 */
const zlib=require('node:zlib');

const LIMITS={entries:4000,entryBytes:50*1024*1024,totalBytes:100*1024*1024};
const fail=code=>Object.assign(new Error(code),{code});

/* ── CRC32 ── */
let table=null;
function crc32(buf){
  if(typeof zlib.crc32==='function')return zlib.crc32(buf)>>>0;
  if(!table){table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}}
  let c=0xFFFFFFFF;for(const b of buf)c=table[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;
}

/* ── ZIP 읽기 ── */
function readZip(buf,limits=LIMITS){
  if(!Buffer.isBuffer(buf)||buf.length<22)throw fail('NOT_ZIP');
  let eocd=-1;
  for(let i=buf.length-22;i>=Math.max(0,buf.length-22-65535);i--){if(buf.readUInt32LE(i)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw fail('NOT_ZIP');
  const count=buf.readUInt16LE(eocd+10),cdSize=buf.readUInt32LE(eocd+12),cdOffset=buf.readUInt32LE(eocd+16);
  if(buf.readUInt16LE(eocd+4)!==0||buf.readUInt16LE(eocd+6)!==0)throw fail('ZIP_UNSUPPORTED');
  if(count===0xFFFF||cdSize===0xFFFFFFFF||cdOffset===0xFFFFFFFF)throw fail('ZIP_UNSUPPORTED');
  if(count>limits.entries)throw fail('ZIP_TOO_BIG');
  if(cdOffset+cdSize>eocd)throw fail('NOT_ZIP');
  const entries=[],names=new Set();
  let p=cdOffset,total=0;
  for(let n=0;n<count;n++){
    if(p+46>eocd||buf.readUInt32LE(p)!==0x02014b50)throw fail('NOT_ZIP');
    const flags=buf.readUInt16LE(p+8),method=buf.readUInt16LE(p+10);
    const compSize=buf.readUInt32LE(p+20),size=buf.readUInt32LE(p+24);
    const nameLen=buf.readUInt16LE(p+28),extraLen=buf.readUInt16LE(p+30),commentLen=buf.readUInt16LE(p+32);
    const local=buf.readUInt32LE(p+42);
    if(flags&0x0041)throw fail('ZIP_ENCRYPTED');
    if(method!==0&&method!==8)throw fail('ZIP_UNSUPPORTED');
    if(compSize===0xFFFFFFFF||size===0xFFFFFFFF||local===0xFFFFFFFF)throw fail('ZIP_UNSUPPORTED');
    const nameRaw=Buffer.from(buf.subarray(p+46,p+46+nameLen));
    const name=nameRaw.toString(flags&0x0800?'utf8':'latin1');
    const extraRaw=Buffer.from(buf.subarray(p+46+nameLen,p+46+nameLen+extraLen));
    if(!name||names.has(name))throw fail('NOT_ZIP');
    names.add(name);
    if(size>limits.entryBytes)throw fail('ZIP_TOO_BIG');
    total+=size;if(total>limits.totalBytes)throw fail('ZIP_TOO_BIG');
    if(local+30>cdOffset||buf.readUInt32LE(local)!==0x04034b50)throw fail('NOT_ZIP');
    const dataStart=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28);
    if(dataStart+compSize>cdOffset)throw fail('NOT_ZIP');
    entries.push({name,nameRaw,extraRaw,flags,method,crc:buf.readUInt32LE(p+16),compSize,size,
      time:buf.readUInt16LE(p+12),date:buf.readUInt16LE(p+14),
      madeBy:buf.readUInt16LE(p+4),needed:buf.readUInt16LE(p+6),
      internal:buf.readUInt16LE(p+36),external:buf.readUInt32LE(p+38),
      raw:buf.subarray(dataStart,dataStart+compSize)});
    p+=46+nameLen+extraLen+commentLen;
  }
  const byName=new Map(entries.map(e=>[e.name,e]));
  return {entries,
    has:name=>byName.has(name),
    names:()=>entries.map(e=>e.name),
    read(name){
      const e=byName.get(name);
      if(!e)throw fail('ZIP_MISSING');
      let out;
      try{out=e.method===0?Buffer.from(e.raw):zlib.inflateRawSync(e.raw,{maxOutputLength:Math.max(1,e.size)});}
      catch{throw fail('NOT_ZIP');}
      if(out.length!==e.size||crc32(out)!==e.crc)throw fail('NOT_ZIP');
      return out;
    },
    text(name){return this.read(name).toString('utf8').replace(/^\uFEFF/,'');},
  };
}

/* ── ZIP 쓰기: 바꾼 항목만 다시 압축하고 나머지는 압축된 바이트를 그대로 옮긴다 ── */
function writeZip(zip,replace){
  const parts=[],central=[];
  let offset=0;
  for(const e of zip.entries){
    let {raw,crc,compSize,size,method}=e;
    // 항목 이름 바이트와 UTF-8 표시는 원본 그대로 옮긴다(표시 없는 한글 이름이 깨지지 않게, 설계 검토 17)
    const flags=e.nameRaw?(e.flags&~0x0008):((e.flags&~0x0008)|0x0800);
    if(replace.has(e.name)){
      const data=Buffer.from(replace.get(e.name),'utf8');
      raw=zlib.deflateRawSync(data,{level:6});method=8;crc=crc32(data);compSize=raw.length;size=data.length;
    }
    const name=e.nameRaw||Buffer.from(e.name,'utf8');
    const extra=e.extraRaw||Buffer.alloc(0);
    const head=Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(e.needed||20,4);head.writeUInt16LE(flags,6);head.writeUInt16LE(method,8);
    head.writeUInt16LE(e.time,10);head.writeUInt16LE(e.date,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(compSize,18);
    head.writeUInt32LE(size,22);head.writeUInt16LE(name.length,26);head.writeUInt16LE(extra.length,28);
    parts.push(head,name,extra,raw);
    const c=Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(e.madeBy||20,4);c.writeUInt16LE(e.needed||20,6);c.writeUInt16LE(flags,8);
    c.writeUInt16LE(method,10);c.writeUInt16LE(e.time,12);c.writeUInt16LE(e.date,14);c.writeUInt32LE(crc,16);
    c.writeUInt32LE(compSize,20);c.writeUInt32LE(size,24);c.writeUInt16LE(name.length,28);c.writeUInt16LE(extra.length,30);c.writeUInt16LE(0,32);
    c.writeUInt16LE(0,34);c.writeUInt16LE(e.internal||0,36);c.writeUInt32LE(e.external||0,38);c.writeUInt32LE(offset,42);
    central.push(c,name,extra);
    offset+=30+name.length+extra.length+raw.length;
  }
  const cd=Buffer.concat(central);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(zip.entries.length,8);end.writeUInt16LE(zip.entries.length,10);
  end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,cd,end]);
}

/* ── XML 조각 ── */
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function decode(s){
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,(m,v)=>{
    if(v[0]!=='#')return ENT[v];
    const n=v[1]==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10);
    return n>0&&n<=0x10FFFF&&!(n>=0xD800&&n<=0xDFFF)?String.fromCodePoint(n):'';
  });
}
// XML 1.0이 금하는 제어 문자와 짝 없는 대리 문자는 지운다(설계 검토 3)
const clean=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'');
const escape=s=>clean(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const TAG=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w.\-]*(?::[\w.\-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
function* tags(xml){
  // 안에서 다시 tags()를 불러도(글상자) 자리가 섞이지 않게 부를 때마다 새 정규식을 쓴다
  const re=new RegExp(TAG.source,'g');let m;
  while((m=re.exec(xml))){
    if(m[0].startsWith('<!DOCTYPE'))throw fail('XML_DOCTYPE');
    if(!m[2])continue;
    yield {close:m[1]==='/',name:m[2],attrs:m[3]||'',self:m[4]==='/',start:m.index,end:re.lastIndex};
  }
}
const attr=(attrs,name)=>{const m=new RegExp('(?:^|\\s)'+name.replace(/[.:]/g,'\\$&')+'\\s*=\\s*("([^"]*)"|\'([^\']*)\')').exec(attrs);return m?decode(m[2]??m[3]):null;};

/* ── .docx 문단 ──
   문단마다 {index, start, end, style, outline, text, segs, inTable, toc}. segs는 글 조각이다.
   w:t 조각은 {kind:'t', from, to(글 안 자리), xmlStart, xmlEnd(내용의 XML 자리), openStart, openEnd(여는 태그 자리)}.
   필드 결과와 데이터에 묶인 내용 컨트롤의 글은 {kind:'f'}로 글에 들어가지만 바꿀 수 없다(설계 검토 8).
   탭과 줄바꿈은 {kind:'x'}로 글에 들어가지만 바꿀 수 없다. mc:Fallback 안은 읽지 않는다(설계 검토 19) */
function docxParagraphs(xml,boxes=[]){
  const paras=[];
  let para=null,skipDepth=0,delDepth=0,textOpen=null,tableDepth=0,boxDepth=0,fallback=0,instrOpen=null;
  let boxStart=0;
  const fields=[],sdts=[];
  const locked=()=>fields.some(f=>f.phase==='result')||sdts.some(d=>d.bound);
  const inToc=()=>fields.some(f=>/^\s*TOC\b/i.test(f.instr));
  const newPara=(t,empty)=>({index:paras.length,start:t.start,end:empty?t.end:0,style:'',outline:null,text:'',segs:[],inTable:tableDepth>0,toc:inToc(),...(empty?{empty:true}:{})});
  for(const t of tags(xml)){
    if(fallback>0){if(t.name==='mc:Fallback'&&!t.self)fallback+=t.close?-1:1;continue;}
    if(t.name==='mc:Fallback'&&!t.close&&!t.self){fallback=1;continue;}
    if(boxDepth>0){
      if(t.name==='w:txbxContent'&&!t.self){boxDepth+=t.close?-1:1;if(!boxDepth)boxes.push(...plainParagraphs(xml.slice(boxStart,t.start)));}
      continue;
    }
    if(t.name==='w:txbxContent'&&!t.close&&!t.self){boxDepth=1;boxStart=t.end;continue;}
    if(t.name==='w:tbl'&&!t.self)tableDepth+=t.close?-1:1;
    if(t.name==='w:sdt'&&!t.self){if(t.close)sdts.pop();else sdts.push({bound:false});continue;}
    if(t.name==='w:dataBinding'&&!t.close&&sdts.length){sdts[sdts.length-1].bound=true;continue;}
    if(t.name==='w:fldChar'&&!t.close){
      const type=attr(t.attrs,'w:fldCharType');
      if(type==='begin')fields.push({instr:'',phase:'instr'});
      else if(type==='separate'&&fields.length)fields[fields.length-1].phase='result';
      else if(type==='end')fields.pop();
      if(para&&inToc())para.toc=true;
      continue;
    }
    if(t.name==='w:fldSimple'&&!t.self){if(t.close)fields.pop();else{fields.push({instr:attr(t.attrs,'w:instr')||'',phase:'result'});if(para&&inToc())para.toc=true;}continue;}
    if(t.name==='w:instrText'){
      if(t.self)continue;
      if(!t.close){instrOpen=t;continue;}
      if(instrOpen&&fields.length&&!delDepth){fields[fields.length-1].instr+=decode(xml.slice(instrOpen.end,t.start));if(para&&inToc())para.toc=true;}
      instrOpen=null;continue;
    }
    if(t.name==='w:p'){
      if(t.self){if(!para)paras.push(newPara(t,true));continue;}
      if(!t.close){if(para){skipDepth++;continue;}para=newPara(t,false);continue;}
      if(skipDepth){skipDepth--;continue;}
      if(para){para.end=t.end;paras.push(para);para=null;}
      continue;
    }
    if(!para||skipDepth)continue;
    if((t.name==='w:del'||t.name==='w:moveFrom')&&!t.self){delDepth+=t.close?-1:1;continue;}
    if(t.name==='w:pStyle'&&!t.close){para.style=attr(t.attrs,'w:val')||'';if(/^(?:toc|목차)\s*\d*$/i.test(para.style))para.toc=true;continue;}
    if(t.name==='w:outlineLvl'&&!t.close){const v=Number(attr(t.attrs,'w:val'));if(Number.isInteger(v))para.outline=v;continue;}
    if(delDepth)continue;
    if(fields.some(f=>f.phase==='instr'))continue;
    if(t.name==='w:t'){
      if(t.self)continue;
      if(!t.close){textOpen=t;continue;}
      if(textOpen){
        const value=decode(xml.slice(textOpen.end,t.start));
        para.segs.push({kind:locked()?'f':'t',from:para.text.length,to:para.text.length+value.length,xmlStart:textOpen.end,xmlEnd:t.start,openStart:textOpen.start,openEnd:textOpen.end,openAttrs:textOpen.attrs});
        para.text+=value;textOpen=null;
      }
      continue;
    }
    if((t.name==='w:tab'||t.name==='w:br'||t.name==='w:cr')&&!t.close){
      const v=t.name==='w:tab'?'\t':'\n';
      para.segs.push({kind:'x',from:para.text.length,to:para.text.length+1});para.text+=v;
    }
  }
  return paras;
}

/* 바꾸지 않는 글(글상자, 각주, 머리글)의 문단 글만. 안에 든 글상자도 펼친다 */
function plainParagraphs(xml){
  const inner=[];
  const out=docxParagraphs(xml,inner).map(p=>p.text);
  return [...out,...inner].map(t=>t.trim()).filter(Boolean);
}
/* 문단 글의 [from, to)를 text로 바꾼다. 탭이나 줄바꿈을 걸치면 바꾸지 않는다(false) */
function paragraphEdits(xml,para,from,to,text){
  if(!(from>=0&&to<=para.text.length&&from<to))return null;
  text=String(text).replace(/[\r\n\u000B\u2028\u2029]+/g,' ');
  const hit=para.segs.filter(s=>s.to>from&&s.from<to);
  if(!hit.length||hit.some(s=>s.kind!=='t'))return null;
  const edits=[];
  hit.forEach((s,i)=>{
    const value=para.text.slice(s.from,s.to);
    const head=i===0?value.slice(0,Math.max(0,from-s.from)):'';
    const tail=i===hit.length-1?value.slice(Math.min(value.length,to-s.from)):'';
    const next=head+(i===0?text:'')+tail;
    edits.push({start:s.xmlStart,end:s.xmlEnd,text:escape(next)});
    if(/^\s|\s$/.test(next)&&!/xml:space\s*=\s*["']preserve["']/.test(s.openAttrs))edits.push({start:s.openStart,end:s.openEnd,text:'<w:t xml:space="preserve">'});
  });
  return edits;
}
function applyEdits(xml,edits){
  const sorted=[...edits].sort((a,b)=>b.start-a.start||b.end-a.end);
  for(let i=1;i<sorted.length;i++)if(sorted[i].end>sorted[i-1].start)throw fail('EDIT_OVERLAP');
  let out=xml;
  for(const e of sorted)out=out.slice(0,e.start)+e.text+out.slice(e.end);
  return out;
}
/* 조각 안에서 이름이 name인 첫 요소(짝 맞춘 범위)를 찾는다. depthOf가 있으면 그 깊이의 것만 */
function firstElement(fragment,name,{direct=null}={}){
  let depth=0,open=null,inner=0;
  for(const t of tags(fragment)){
    if(open){
      if(t.name===name&&!t.self){inner+=t.close?-1:1;if(inner===0)return fragment.slice(open.start,t.end);}
      continue;
    }
    if(t.name===name&&!t.close&&(direct==null||depth===direct)){
      if(t.self)return fragment.slice(t.start,t.end);
      open=t;inner=1;continue;
    }
    if(!t.self)depth+=t.close?-1:1;
  }
  return '';
}
/* 조각에서 이름이 names에 든 요소를 짝 맞춰 모두 지운다 */
function removeElements(fragment,names){
  const set=new Set(names);
  let out='',pos=0,skip=0,skipName=null;
  for(const t of tags(fragment)){
    if(skip){
      if(t.name===skipName&&!t.self){skip+=t.close?-1:1;if(!skip)pos=t.end;}
      continue;
    }
    if(set.has(t.name)&&!t.close){
      out+=fragment.slice(pos,t.start);
      if(t.self){pos=t.end;continue;}
      skip=1;skipName=t.name;
    }
  }
  return skip?out:out+fragment.slice(pos);
}
/* 태그 짝이 모두 맞는지(저장 뒤 확인, 설계 검토 3) */
function wellFormed(xml){
  const stack=[];
  try{
    for(const t of tags(xml)){
      if(t.self)continue;
      if(!t.close){stack.push(t.name);continue;}
      if(stack.pop()!==t.name)return false;
    }
  }catch{return false;}
  return stack.length===0;
}
/* 문단 뒤에 새 문단을 넣는 편집. 본뜬 문단의 문단 속성과, 하이퍼링크 밖 첫 글 묶음의 글자 속성을 짝 맞춰 뽑는다.
   번호 매기기, 구역 나눔, 서식 변경 내용, 문단 표시의 글자 속성, 글자 스타일은 뺀다(설계 검토 3, 9).
   plain이면 속성 없이 기본 스타일로 넣는다 */
function insertAfterEdit(xml,para,text,{plain=false}={}){
  const body=xml.slice(para.start,para.end);
  const inner=body.slice(body.indexOf('>')+1,body.lastIndexOf('</'));
  let pPr='',rPr='';
  if(!plain){
    pPr=removeElements(firstElement(inner,'w:pPr',{direct:0}),['w:numPr','w:sectPr','w:pPrChange','w:rPr']);
    const run=firstElement(inner,'w:r',{direct:0});
    rPr=removeElements(firstElement(run.slice(run.indexOf('>')+1),'w:rPr',{direct:0}),['w:rPrChange','w:rStyle','w:ins','w:del','w:moveFrom','w:moveTo']);
  }
  const lines=clean(String(text).replace(/\r\n?/g,'\n').replace(/[\u000B\u2028\u2029]/g,'\n')).split('\n');
  const runs=lines.map((line,i)=>(i?'<w:br/>':'')+'<w:t xml:space="preserve">'+escape(line)+'</w:t>').join('');
  return {start:para.end,end:para.end,text:'<w:p>'+pPr+'<w:r>'+rPr+runs+'</w:r></w:p>'};
}
/* 읽을 때 미리 해 보는 바꾸기(설계 3.3의 canReplace) */
function canReplace(para,from,to){return !!paragraphEdits('',para,from,to,'x');}

/* 스타일 번호 → 개요 수준(0부터). 이름이 heading N이거나 스타일에 개요 수준이 있으면 제목이다. basedOn을 따라간다 */
function styleLevels(xml){
  const styles=new Map();let cur=null;
  for(const t of tags(xml)){
    if(t.name==='w:style'){if(!t.close&&!t.self){cur={id:attr(t.attrs,'w:styleId'),name:'',outline:null,based:null};}else if(t.close&&cur){if(cur.id)styles.set(cur.id,cur);cur=null;}continue;}
    if(!cur||t.close)continue;
    if(t.name==='w:name')cur.name=attr(t.attrs,'w:val')||'';
    else if(t.name==='w:basedOn')cur.based=attr(t.attrs,'w:val');
    else if(t.name==='w:outlineLvl'){const v=Number(attr(t.attrs,'w:val'));if(Number.isInteger(v))cur.outline=v;}
  }
  const levels=new Map();
  const level=(id,seen=new Set())=>{
    const s=styles.get(id);if(!s||seen.has(id))return null;seen.add(id);
    if(s.outline!=null&&s.outline<9)return s.outline;
    const m=/^(?:heading|제목)\s*([1-9])$/i.exec(s.name.trim());if(m)return Number(m[1])-1;
    return s.based?level(s.based,seen):null;
  };
  for(const id of styles.keys()){const v=level(id);if(v!=null)levels.set(id,v);}
  return levels;
}
function docxDocument(buf){
  const zip=readZip(buf);
  if(zip.has('word/vbaProject.bin'))throw fail('MACRO');
  const types=zip.has('[Content_Types].xml')?zip.text('[Content_Types].xml'):'';
  if(/macroEnabled/i.test(types))throw fail('MACRO');
  if(!zip.has('word/document.xml'))throw fail('NOT_DOCX');
  const xml=zip.text('word/document.xml');
  const levels=zip.has('word/styles.xml')?styleLevels(zip.text('word/styles.xml')):new Map();
  const boxes=[];
  const paragraphs=docxParagraphs(xml,boxes).map(p=>({...p,level:p.outline??levels.get(p.style)??null}));
  // 양식 안내: 글상자, 각주, 머리글의 글(사업계획서_설계.md 3.1). 바꾸지 않는다
  const guides=[...boxes];
  for(const name of zip.names().filter(n=>/^word\/(?:footnotes|endnotes|header\d*)\.xml$/.test(n)).sort())guides.push(...plainParagraphs(zip.text(name)));
  return {zip,xml,paragraphs,guides:[...new Set(guides)]};
}
/* edits: [{para, from, to, text}] 바꾸기와 [{after, text}] 넣기. 새 .docx 바이트를 돌려준다 */
function docxApply(doc,changes){
  const edits=[];
  for(const c of changes){
    const para=doc.paragraphs[c.after??c.para];
    if(!para)throw fail('EDIT_PARA');
    if(c.after!=null){if(para.empty&&!c.plain)throw fail('EDIT_PARA');edits.push(insertAfterEdit(doc.xml,para,c.text,{plain:!!c.plain}));continue;}
    const e=paragraphEdits(doc.xml,para,c.from,c.to,c.text);
    if(!e)throw fail('EDIT_SPAN');
    edits.push(...e);
  }
  const xml=applyEdits(doc.xml,edits);
  return writeZip(doc.zip,new Map([['word/document.xml',xml]]));
}

/* ── .xlsx 줄 ──
   숫자 서식으로 백분율과 날짜를 푼다(설계 검토 6). 그 밖의 숫자는 저장된 값 그대로다 */
const DATE_IDS=new Set([14,15,16,17,18,19,20,21,22,45,46,47]);
function formatKinds(xml){
  const custom=new Map(),xfs=[];
  let inXfs=false;
  for(const t of tags(xml)){
    if(t.name==='numFmt'&&!t.close)custom.set(Number(attr(t.attrs,'numFmtId')),attr(t.attrs,'formatCode')||'');
    if(t.name==='cellXfs'&&!t.self){inXfs=!t.close;continue;}
    if(inXfs&&t.name==='xf'&&!t.close)xfs.push(Number(attr(t.attrs,'numFmtId'))||0);
  }
  return xfs.map(id=>{
    if(id===9||id===10)return 'pct';
    if(DATE_IDS.has(id))return 'date';
    const code=(custom.get(id)||'').replace(/"[^"]*"|\[[^\]]*\]|\\./g,'');
    if(/%/.test(code))return 'pct';
    if(/[yd]/i.test(code)||/m/i.test(code)&&!/[hs0#]/i.test(code))return 'date';
    return null;
  });
}
function cellValue(raw,kind,date1904){
  const n=Number(raw);
  if(!Number.isFinite(n)||raw.trim()==='')return raw;
  if(kind==='pct')return String(Number((n*100).toPrecision(12)))+'%';
  if(kind==='date'&&n>0&&n<2958466){
    const ms=Math.round(((date1904?n+1462:n)-25569)*86400000);
    const d=new Date(ms);
    return d.toISOString().slice(0,10);
  }
  return raw;
}
function xlsxLines(buf,{maxLines=20000}={}){
  const zip=readZip(buf);
  if(zip.has('xl/vbaProject.bin'))throw fail('MACRO');
  if(!zip.has('xl/workbook.xml'))throw fail('NOT_XLSX');
  const shared=[];
  if(zip.has('xl/sharedStrings.xml')){
    const xml=zip.text('xl/sharedStrings.xml');
    let cur=null,inT=null,skip=0;
    for(const t of tags(xml)){
      if(t.name==='si'){if(!t.close&&!t.self)cur='';else if(t.close){shared.push(cur??'');cur=null;}else shared.push('');continue;}
      if(t.name==='rPh'&&!t.self){skip+=t.close?-1:1;continue;}
      if(t.name==='t'&&cur!==null&&!skip){if(!t.close&&!t.self)inT=t;else if(t.close&&inT){cur+=decode(xml.slice(inT.end,t.start));inT=null;}}
    }
  }
  const kinds=zip.has('xl/styles.xml')?formatKinds(zip.text('xl/styles.xml')):[];
  const rels=new Map();
  if(zip.has('xl/_rels/workbook.xml.rels'))for(const t of tags(zip.text('xl/_rels/workbook.xml.rels')))if(t.name==='Relationship'&&!t.close)rels.set(attr(t.attrs,'Id'),attr(t.attrs,'Target'));
  const sheets=[];let date1904=false;
  for(const t of tags(zip.text('xl/workbook.xml'))){
    if(t.name==='sheet'&&!t.close)sheets.push({name:attr(t.attrs,'name')||'시트',rid:attr(t.attrs,'r:id')});
    if(t.name==='workbookPr'&&!t.close)date1904=/^(?:1|true)$/.test(attr(t.attrs,'date1904')||'');
  }
  const lines=[];
  for(const s of sheets){
    let target=rels.get(s.rid);if(!target)continue;
    target=target.replace(/^\/?xl\//,'').replace(/^\//,'');
    const file='xl/'+target;
    if(!zip.has(file))continue;
    const xml=zip.text(file);
    let row=null,rowNo=0,cells=[],cell=null,val=null;
    for(const t of tags(xml)){
      if(t.name==='row'){
        if(t.self){rowNo++;continue;}
        if(!t.close){rowNo=Number(attr(t.attrs,'r'))||rowNo+1;row=rowNo;cells=[];continue;}
        if(cells.length)lines.push(`${s.name} · ${row}행: ${cells.join(' | ')}`);
        row=null;cells=[];if(lines.length>=maxLines)return lines;continue;
      }
      if(t.name==='c'){if(!t.close&&!t.self)cell={type:attr(t.attrs,'t')||'n',kind:kinds[Number(attr(t.attrs,'s'))||0]||null,text:''};else if(t.close&&cell){const v=cell.text.trim();if(v)cells.push(v);cell=null;}continue;}
      if(!cell)continue;
      if((t.name==='v'||t.name==='t')&&!t.self){
        if(!t.close)val=t;
        else if(val){
          const raw=decode(xml.slice(val.end,t.start));
          cell.text+=cell.type==='s'&&t.name==='v'?(shared[Number(raw)]??''):cell.type==='b'?(raw==='1'?'TRUE':'FALSE'):cell.type==='n'&&t.name==='v'?cellValue(raw,cell.kind,date1904):raw;
          val=null;
        }
      }
    }
  }
  return lines;
}

module.exports={readZip,writeZip,crc32,docxDocument,docxParagraphs,docxApply,canReplace,wellFormed,xlsxLines,decode,escape,clean,LIMITS};
