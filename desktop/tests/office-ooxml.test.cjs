'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const ox=require('../src/office-ooxml.cjs');

function makeZip(files){
  const entries=Object.entries(files).map(([name,text])=>{
    const data=Buffer.isBuffer(text)?text:Buffer.from(text,'utf8');
    const raw=zlib.deflateRawSync(data);
    return {name,flags:0x0800,method:8,raw,crc:ox.crc32(data),compSize:raw.length,size:data.length,time:0,date:0x21,madeBy:20,needed:20,internal:0,external:0};
  });
  return ox.writeZip({entries},new Map());
}
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc=body=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;
const styles=`<?xml version="1.0"?><w:styles ${W}><w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Sub"><w:name w:val="Sub"/><w:basedOn w:val="1"/></w:style><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
const TYPES='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const docx=body=>makeZip({'[Content_Types].xml':TYPES,'word/document.xml':doc(body),'word/styles.xml':styles});

const BODY=[
  '<w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>지금까지 한 일</w:t></w:r></w:p>',
  '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>2025년 9월부터 팔아 왔습니다. </w:t></w:r><w:r><w:t xml:space="preserve">단골 손님 </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>300명</w:t></w:r><w:r><w:t>이 다시 삽니다.</w:t></w:r></w:p>',
  '<w:p><w:r><w:t>매출 &amp; 이익</w:t></w:r><w:r><w:tab/><w:t>3억 원</w:t></w:r><w:del w:id="1"><w:r><w:delText>지운 글</w:delText></w:r></w:del><w:ins w:id="2"><w:r><w:t> 넣은 글</w:t></w:r></w:ins></w:p>',
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>표 칸 글</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
  '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>7</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:drawing><wp:inline><w:txbxContent><w:p><w:r><w:t>글상자</w:t></w:r></w:p></w:txbxContent></wp:inline></w:drawing></w:r><w:r><w:t>쪽</w:t></w:r></w:p>',
  '<w:p><w:pPr><w:pStyle w:val="Sub"/></w:pPr><w:r><w:t>3년 뒤</w:t></w:r></w:p>',
  '<w:p/>',
].join('');

test('docx 문단: 제목 수준, 표 칸, 변경 내용, 필드, 글상자, 엔티티', () => {
  const d=ox.docxDocument(docx(BODY));
  const t=d.paragraphs.map(p=>p.text);
  assert.deepEqual(t,['지금까지 한 일','2025년 9월부터 팔아 왔습니다. 단골 손님 300명이 다시 삽니다.','매출 & 이익\t3억 원 넣은 글','표 칸 글','7쪽','3년 뒤','']);
  assert.equal(d.paragraphs[0].level,0);
  assert.equal(d.paragraphs[5].level,0, 'basedOn을 따라 제목 1');
  assert.equal(d.paragraphs[1].level,null);
  assert.equal(d.paragraphs[3].inTable,true);
  assert.equal(d.paragraphs[1].inTable,false);
  assert.deepEqual(d.guides,['글상자']);
});

test('docx 양식 안내: 각주와 머리글의 글을 읽고 같은 글은 한 번만', () => {
  const buf=makeZip({'[Content_Types].xml':TYPES,'word/document.xml':doc(BODY),'word/styles.xml':styles,
    'word/footnotes.xml':`<w:footnotes ${W}><w:footnote w:id="1"><w:p><w:r><w:t>※ 매출은 최근 1년 실적을 적으십시오</w:t></w:r></w:p></w:footnote></w:footnotes>`,
    'word/header1.xml':`<w:hdr ${W}><w:p><w:r><w:t>글상자</w:t></w:r></w:p><w:p/></w:hdr>`});
  assert.deepEqual(ox.docxDocument(buf).guides,['글상자','※ 매출은 최근 1년 실적을 적으십시오']);
});

test('docx 바꾸기: 한 글 묶음 안이면 그 서식이 남고, 걸치면 첫 묶음에 넣는다. 다른 항목은 바이트 그대로', () => {
  const src=docx(BODY);
  const d=ox.docxDocument(src);
  const p=d.paragraphs[1];
  const a=p.text.indexOf('300명'),b=a+'300명'.length;
  const out=ox.docxApply(d,[{para:1,from:a,to:b,text:'112명'}]);
  const again=ox.docxDocument(out);
  assert.equal(again.paragraphs[1].text,'2025년 9월부터 팔아 왔습니다. 단골 손님 112명이 다시 삽니다.');
  assert.match(again.xml,/<w:rPr><w:i\/><\/w:rPr><w:t>112명<\/w:t>/);
  const s1=ox.readZip(src).entries.find(e=>e.name==='word/styles.xml');
  const s2=ox.readZip(out).entries.find(e=>e.name==='word/styles.xml');
  assert.ok(s1.raw.equals(s2.raw));
  const from=p.text.indexOf('단골'),to=p.text.length;
  const out2=ox.docxApply(d,[{para:1,from,to,text:'10월에 다시 산 손님은 112명입니다.'}]);
  const p2=ox.docxDocument(out2).paragraphs[1];
  assert.equal(p2.text,'2025년 9월부터 팔아 왔습니다. 10월에 다시 산 손님은 112명입니다.');
  assert.match(ox.docxDocument(out2).xml,/<w:rPr><w:b\/><\/w:rPr><w:t>2025년 9월부터 팔아 왔습니다. <\/w:t>/);
});

test('docx 바꾸기: 탭을 걸치면 거절, 앞뒤 공백이면 xml:space를 붙이고, 넣은 글을 이스케이프한다', () => {
  const d=ox.docxDocument(docx(BODY));
  const p=d.paragraphs[2];
  assert.throws(()=>ox.docxApply(d,[{para:2,from:0,to:p.text.indexOf('3억')+1,text:'x'}]),{code:'EDIT_SPAN'});
  const out=ox.docxApply(d,[{para:2,from:0,to:'매출 & 이익'.length,text:' <매출> '}]);
  const x=ox.docxDocument(out);
  assert.equal(x.paragraphs[2].text,' <매출> \t3억 원 넣은 글');
  assert.match(x.xml,/<w:t xml:space="preserve"> &lt;매출&gt; <\/w:t>/);
});

test('docx 넣기: 본뜬 문단의 속성에서 번호 매기기를 빼고 줄바꿈을 지킨다', () => {
  const d=ox.docxDocument(docx(BODY));
  const out=ox.docxApply(d,[{after:1,text:'첫해에는 인스타그램에서\n새 손님을 만납니다.'}]);
  const x=ox.docxDocument(out);
  assert.equal(x.paragraphs[2].text,'첫해에는 인스타그램에서\n새 손님을 만납니다.');
  assert.equal(x.paragraphs[3].text,'매출 & 이익\t3억 원 넣은 글');
  const inserted=x.xml.slice(x.paragraphs[2].start,x.paragraphs[2].end);
  assert.doesNotMatch(inserted,/numPr|sectPr/);
  assert.match(inserted,/<w:rPr><w:b\/><\/w:rPr>/);
  assert.throws(()=>ox.docxApply(d,[{after:6,text:'x'}]),{code:'EDIT_PARA'});
});

test('docx 바꾸기 둘이 겹치면 거절한다', () => {
  const d=ox.docxDocument(docx(BODY));
  assert.throws(()=>ox.docxApply(d,[{para:1,from:0,to:5,text:'a'},{para:1,from:2,to:8,text:'b'}]),{code:'EDIT_OVERLAP'});
});

test('ZIP 막이: 풀린 크기, 항목 수, 암호, 크기를 속인 항목, DOCTYPE, 매크로', () => {
  const big=makeZip({'a.txt':'x'.repeat(5000)});
  assert.throws(()=>ox.readZip(big,{entries:10,entryBytes:100,totalBytes:1000}),{code:'ZIP_TOO_BIG'});
  assert.throws(()=>ox.readZip(makeZip({a:'1',b:'2',c:'3'}),{entries:2,entryBytes:100,totalBytes:1000}),{code:'ZIP_TOO_BIG'});
  const enc=Buffer.from(makeZip({'a.txt':'hello'}));
  const cd=enc.lastIndexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  enc.writeUInt16LE(enc.readUInt16LE(cd+8)|1,cd+8);
  assert.throws(()=>ox.readZip(enc),{code:'ZIP_ENCRYPTED'});
  // 중앙 목록이 작은 크기를 말하는데 풀면 더 크다(폭탄)
  const liar=Buffer.from(makeZip({'a.txt':'y'.repeat(4000)}));
  const c2=liar.lastIndexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  liar.writeUInt32LE(10,c2+24);
  assert.throws(()=>ox.readZip(liar).read('a.txt'),{code:'NOT_ZIP'});
  const dt=makeZip({'[Content_Types].xml':TYPES,'word/document.xml':'<!DOCTYPE x [<!ENTITY a "aaaa">]><w:document><w:body><w:p><w:r><w:t>&a;</w:t></w:r></w:p></w:body></w:document>'});
  assert.throws(()=>ox.docxDocument(dt),{code:'XML_DOCTYPE'});
  const macro=makeZip({'[Content_Types].xml':TYPES.replace('document.main','document.macroEnabled.main'),'word/document.xml':doc('')});
  assert.throws(()=>ox.docxDocument(macro),{code:'MACRO'});
  assert.throws(()=>ox.docxDocument(Buffer.from('not a zip at all, just text')),{code:'NOT_ZIP'});
});

test('xlsx 줄: 공유 문자열, 숫자, 인라인 글, 윗주 빼기, 빈 칸 건너뛰기', () => {
  const ss='<sst><si><t>월</t></si><si><t>매출</t></si><si><r><t>유료 </t></r><r><t>고객</t></r><rPh><t>こきゃく</t></rPh></si></sst>';
  const wb='<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="10월" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels='<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
  const sheet='<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>10</v></c><c r="B2"><v>320000000</v></c><c r="C2"/><c r="D2" t="inlineStr"><is><t>112명</t></is></c></row><row r="3"/></sheetData></worksheet>';
  const buf=makeZip({'xl/workbook.xml':wb,'xl/_rels/workbook.xml.rels':rels,'xl/sharedStrings.xml':ss,'xl/worksheets/sheet1.xml':sheet});
  assert.deepEqual(ox.xlsxLines(buf),['10월 · 1행: 월 | 매출 | 유료 고객','10월 · 2행: 10 | 320000000 | 112명']);
});

test('설계 검토 3: 서식 변경 내용이 든 문단을 본떠도 XML이 맞고, 제어 문자는 지우고 줄바꿈은 w:br', () => {
  const body='<w:p><w:pPr><w:pStyle w:val="Normal"/><w:pPrChange w:id="9"><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrChange><w:rPr><w:ins w:id="3"/></w:rPr></w:pPr><w:hyperlink><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>링크</w:t></w:r></w:hyperlink><w:r><w:rPr><w:b/><w:rPrChange w:id="4"><w:rPr><w:i/></w:rPr></w:rPrChange></w:rPr><w:t>본문</w:t></w:r></w:p>';
  const d=ox.docxDocument(docx(body));
  const out=ox.docxApply(d,[{after:0,text:'첫 줄\u000B둘째 줄\u0001끝'}]);
  const x=ox.docxDocument(out);
  assert.ok(ox.wellFormed(x.xml));
  assert.equal(x.paragraphs[1].text,'첫 줄\n둘째 줄끝');
  const ins=x.xml.slice(x.paragraphs[1].start,x.paragraphs[1].end);
  assert.doesNotMatch(ins,/Change|Hyperlink|w:ins/);
  assert.match(ins,/<w:pPr><w:pStyle w:val="Normal"\/><\/w:pPr><w:r><w:rPr><w:b\/><\/w:rPr>/);
  const plain=ox.docxDocument(ox.docxApply(d,[{after:0,text:'기본',plain:true}]));
  assert.match(plain.xml,/<w:p><w:r><w:t xml:space="preserve">기본<\/w:t><\/w:r><\/w:p>/);
  const rep=ox.docxDocument(ox.docxApply(d,[{para:0,from:2,to:4,text:'새\n글'}]));
  assert.equal(rep.paragraphs[0].text,'링크새 글');
  assert.equal(ox.wellFormed('<a><b></a></b>'),false);
});

test('설계 검토 8: 필드 결과와 묶인 내용 컨트롤은 바꿀 수 없고, 목차 문단을 표시한다', () => {
  const body=[
    '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \o "1-3" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1. 사업 개요 3</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>2. 시장 5</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
    '<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>스타일 목차</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>참조: </w:t></w:r><w:fldSimple w:instr=" REF x "><w:r><w:t>표 3</w:t></w:r></w:fldSimple><w:r><w:t> 참고</w:t></w:r></w:p>',
    '<w:sdt><w:sdtPr><w:dataBinding w:xpath="/a"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>회사 이름</w:t></w:r></w:p></w:sdtContent></w:sdt>',
    '<w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><w:txbxContent><w:p><w:r><w:t>안내 글</w:t></w:r></w:p></w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>안내 글</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r><w:r><w:t>본문</w:t></w:r></w:p>',
  ].join('');
  const d=ox.docxDocument(docx(body));
  assert.deepEqual(d.paragraphs.map(p=>p.toc),[true,true,true,false,false,false]);
  assert.equal(d.paragraphs[3].text,'참조: 표 3 참고');
  assert.equal(ox.canReplace(d.paragraphs[3],4,8),false,'필드 결과를 걸치면 못 바꾼다');
  assert.equal(ox.canReplace(d.paragraphs[3],0,2),true);
  assert.equal(ox.canReplace(d.paragraphs[4],0,2),false,'묶인 컨트롤');
  assert.deepEqual(d.guides,['안내 글']);
  assert.equal(d.paragraphs[5].text,'본문');
});

test('설계 검토 17: UTF-8 표시 없는 항목 이름 바이트와 extra가 그대로 남는다', () => {
  const src=Buffer.from(docx(BODY));
  const zip=ox.readZip(src);
  const e=zip.entries.find(x=>x.name==='word/styles.xml');
  e.nameRaw=Buffer.from([0x77,0x6f,0x72,0x64,0x2f,0xc7,0xd1]);e.name=e.nameRaw.toString('latin1');e.flags&=~0x0800;e.extraRaw=Buffer.from([0x0a,0x00,0x04,0x00,1,2,3,4]);
  const rebuilt=ox.writeZip(zip,new Map());
  const again=ox.readZip(rebuilt).entries.find(x=>x.nameRaw[0]===0x77&&x.nameRaw.length===7);
  assert.ok(again.nameRaw.equals(e.nameRaw));
  assert.ok(again.extraRaw.equals(e.extraRaw));
  assert.equal(again.flags&0x0800,0);
});

test('설계 검토 6: xlsx 백분율과 날짜를 숫자 서식으로 푼다', () => {
  const wb='<workbook xmlns:r="r"><workbookPr/><sheets><sheet name="표" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels='<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>';
  const styles='<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy&quot;년&quot; m&quot;월&quot;"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="10"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>';
  const sheet='<worksheet><sheetData><row r="5"><c r="A5" s="1"><v>0.153</v></c><c r="B5" s="2"><v>45930</v></c><c r="C5" s="3"><v>45231</v></c><c r="D5"><v>112</v></c></row></sheetData></worksheet>';
  const buf=makeZip({'xl/workbook.xml':wb,'xl/_rels/workbook.xml.rels':rels,'xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet});
  assert.deepEqual(ox.xlsxLines(buf),['표 · 5행: 15.3% | 2025-09-30 | 2023-11-01 | 112']);
});
