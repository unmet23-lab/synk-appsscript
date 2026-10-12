import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';

export const COMPLETION_RENDER_LIMITS=Object.freeze({maxInputBytes:4*1024*1024,maxRows:2000,maxCharacters:1_000_000,maxSections:32,maxColumns:32,maxPages:250,maxPdfBytes:16*1024*1024,maxCsvBytes:12*1024*1024,timeoutMs:20_000,maxTimeoutMs:30_000,maxConcurrent:2});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const scalar=value=>value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
let activeWorkers=0;

function validate(report){
  if(!plain(report)||report.schema!==1||typeof report.projectId!=='string'||!report.projectId||!Number.isSafeInteger(report.revision)||report.revision<0||!/^\w{64}$/.test(report.fingerprint||'')||!/^[a-f0-9]{64}$/i.test(report.fingerprint))throw fail('완료 기록의 프로젝트와 버전을 확인해 주세요.');
  if(typeof report.generatedAt!=='string'||!Number.isFinite(Date.parse(report.generatedAt))||!['title','customerName','status','statusLabel'].every(key=>typeof report[key]==='string'))throw fail('완료 기록의 이름과 생성 시각을 확인해 주세요.');
  if(!Array.isArray(report.sections)||report.sections.length>COMPLETION_RENDER_LIMITS.maxSections||!Array.isArray(report.warnings)||!report.warnings.every(value=>typeof value==='string')||!plain(report.counts)||!Object.values(report.counts).every(value=>Number.isSafeInteger(value)&&value>=0))throw fail('완료 기록의 구성 항목을 확인해 주세요.');
  let rows=0,characters=report.title.length+report.customerName.length+report.status.length+report.statusLabel.length+report.warnings.reduce((sum,value)=>sum+value.length,0);const ids=new Set();
  for(const section of report.sections){
    if(!plain(section)||typeof section.id!=='string'||!section.id||ids.has(section.id)||typeof section.title!=='string'||!Array.isArray(section.columns)||!section.columns.length||section.columns.length>COMPLETION_RENDER_LIMITS.maxColumns||!Array.isArray(section.rows))throw fail('완료 기록의 구간과 열 구성을 확인해 주세요.');
    ids.add(section.id);const keys=new Set();characters+=section.title.length;
    for(const column of section.columns){if(!plain(column)||typeof column.key!=='string'||!column.key||keys.has(column.key)||typeof column.label!=='string')throw fail('완료 기록의 열 이름을 확인해 주세요.');keys.add(column.key);characters+=column.label.length;}
    rows+=section.rows.length;if(rows>COMPLETION_RENDER_LIMITS.maxRows)throw fail('완료 기록이 2,000행을 넘어 파일을 만들지 않았습니다. 기록 범위를 나눠 주세요.',413);
    for(const row of section.rows){if(!plain(row)||Object.keys(row).some(key=>!keys.has(key))||section.columns.some(column=>!Object.hasOwn(row,column.key)||!scalar(row[column.key])))throw fail('완료 기록의 셀 값을 확인해 주세요.');for(const value of Object.values(row))characters+=typeof value==='string'?value.length:0;}
    if(characters>COMPLETION_RENDER_LIMITS.maxCharacters)throw fail('완료 기록이 100만 글자를 넘어 파일을 만들지 않았습니다. 기록 범위를 나눠 주세요.',413);
  }
  if(characters>COMPLETION_RENDER_LIMITS.maxCharacters||Buffer.byteLength(JSON.stringify(report),'utf8')>COMPLETION_RENDER_LIMITS.maxInputBytes)throw fail('완료 기록의 파일 입력 한도를 넘어 파일을 만들지 않았습니다. 기록 범위를 나눠 주세요.',413);
  return report;
}
function valueText(value){return value===null?'':typeof value==='boolean'?(value?'예':'아니요'):String(value);}
function csvCell(value){const text=valueText(value);const protectedText=/^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]*[=+\-@\uff1d\uff0b\uff0d\uff20]/u.test(text)||/^[\t\r\n]/.test(text)?"'"+text:text;return '"'+protectedText.replaceAll('"','""')+'"';}

/** One rectangular CSV. Each section row is represented by its labelled cells. */
export function renderCompletionCsv(report){
  validate(report);const lines=[],append=(section,row,field,value)=>lines.push([section,row,field,value].map(csvCell).join(','));
  lines.push(['구간','기록 번호','항목','값'].map(csvCell).join(','));
  for(const [label,value]of [['문서 용도','내부 보관용 · 자동 발송하지 않음'],['프로젝트명',report.title],['고객명',report.customerName],['현재 상태',report.statusLabel],['마감 확정 여부',report.status==='closed'?'현재 납품 묶음의 마감 기록 있음':'미확정 · 이 파일로 확정하지 않음'],['파일 생성 시각',report.generatedAt],['시각 안내','파일 생성 시각과 마감 확인 시각은 다릅니다. 마감 확인은 해당 기록의 시각을 확인해 주세요.'],['프로젝트 ID',report.projectId],['프로젝트 버전',report.revision],['기록 지문',report.fingerprint]])append('문서 정보','',label,value);
  for(const warning of report.warnings)append('확인할 점','','안내',warning);
  for(const section of report.sections){
    if(!section.rows.length)append(section.title,'','기록 수',0);
    for(let index=0;index<section.rows.length;index++)for(const column of section.columns)append(section.title,index+1,column.label,section.rows[index][column.key]);
  }
  const output=Buffer.from('\ufeff'+lines.join('\r\n')+'\r\n','utf8');
  if(output.length>COMPLETION_RENDER_LIMITS.maxCsvBytes)throw fail('CSV 크기 한도를 넘어 파일을 만들지 않았습니다. 기록 범위를 나눠 주세요.',413);
  return output;
}

/** CPU-heavy font shaping and pagination run outside the server event loop. */
export async function renderCompletionPdf(report,{signal,timeoutMs=COMPLETION_RENDER_LIMITS.timeoutMs}={}){
  validate(report);
  if(signal?.aborted)throw fail('PDF 만들기를 취소했습니다.',499);
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>COMPLETION_RENDER_LIMITS.maxTimeoutMs)throw fail('PDF 생성 제한 시간을 확인해 주세요.');
  if(activeWorkers>=COMPLETION_RENDER_LIMITS.maxConcurrent)throw fail('다른 완료 기록 PDF를 만들고 있습니다. 잠시 뒤 다시 시도해 주세요.',503);
  activeWorkers++;
  return await new Promise((resolve,reject)=>{
    let worker,timer,finished=false;
    const finish=async(error,buffer)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(worker){worker.removeAllListeners();try{await worker.terminate();}catch{}}activeWorkers--;if(error)reject(error);else resolve(buffer);};
    const abort=()=>void finish(fail('PDF 만들기를 취소했습니다.',499));
    try{
      worker=new Worker(new URL(import.meta.url),{workerData:{kind:'completion-record-pdf',report},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32,stackSizeMb:4}});
      timer=setTimeout(()=>void finish(fail('PDF 생성 제한 시간을 넘겨 파일을 만들지 않았습니다. CSV를 이용하거나 기록 범위를 나눠 주세요.',504)),timeoutMs);
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
      worker.once('error',()=>void finish(fail('PDF를 만들지 못했습니다. 잠시 뒤 다시 시도하거나 CSV를 이용해 주세요.',500)));
      worker.once('exit',code=>{if(!finished)void finish(fail('PDF 생성 작업이 완료되기 전에 종료됐습니다.',500));});
      worker.once('message',message=>{
        if(message?.error){void finish(fail(message.error.message,[400,413,500].includes(message.error.status)?message.error.status:500));return;}
        if(!(message?.bytes instanceof Uint8Array)||message.bytes.byteLength>COMPLETION_RENDER_LIMITS.maxPdfBytes){void finish(fail('PDF 결과를 확인하지 못했습니다.',500));return;}
        const buffer=Buffer.from(message.bytes);if(buffer.subarray(0,5).toString()!=='%PDF-'||!buffer.subarray(-20).toString().includes('%%EOF')){void finish(fail('완성되지 않은 PDF를 내려받지 않았습니다.',500));return;}
        void finish(null,buffer);
      });
    }catch(error){void finish(fail('PDF 생성 작업을 시작하지 못했습니다.',500));}
  });
}

async function createPdf(report){
  const {default:PDFDocument}=await import('./vendor/completion-pdf/pdfkit.cjs');
  const fontPath=fileURLToPath(new URL('./vendor/completion-pdf/SUIT-Regular.otf',import.meta.url));
  const doc=new PDFDocument({size:'A4',font:fontPath,autoFirstPage:false,bufferPages:true,compress:true,margins:{top:80,bottom:58,left:48,right:48},info:{Title:'제작 완료 기록 · '+report.title,Author:'SYNK',Subject:'내부 보관용. 생성 시점의 기록이며 새 승인이나 마감 확인이 아닙니다.',Creator:'SYNK 작업실',CreationDate:new Date(report.generatedAt),ModDate:new Date(report.generatedAt)}});
  const chunks=[];let bytes=0,pageCount=0,unsupported=0;const glyphs=new Map();
  const output=new Promise((resolve,reject)=>{doc.on('data',chunk=>{bytes+=chunk.length;if(bytes>COMPLETION_RENDER_LIMITS.maxPdfBytes){doc.destroy();reject(fail('PDF가 16MiB를 넘어 파일을 만들지 않았습니다. CSV를 이용하거나 기록 범위를 나눠 주세요.',413));}else chunks.push(chunk);});doc.once('end',()=>resolve(Buffer.concat(chunks)));doc.once('error',reject);});
  // The pinned embedded font is checked so unsupported symbols are never silent empty boxes.
  function text(value){let result='';for(const char of valueText(value).replaceAll('\r\n','\n').replaceAll('\r','\n')){if(char==='\n'){result+='\n';continue;}if(char==='\t'){result+='    ';continue;}const point=char.codePointAt(0);let supported=glyphs.get(point);if(supported===undefined){supported=doc._font.font.hasGlyphForCodePoint(point);glyphs.set(point,supported);}if(supported)result+=char;else{result+='[U+'+point.toString(16).toUpperCase().padStart(4,'0')+']';unsupported++;}}return result;}
  const width=499.28;
  function drawHeader(){const fontSize=doc._fontSize||10;doc.save();doc.fillColor('#000000').fontSize(9).text('SYNK  |  제작 완료 기록',48,35,{width:width/2,lineBreak:false});doc.fontSize(8).text('내부 보관용 · 생성 시점 기준',300,35,{width:247.28,align:'right',lineBreak:false});doc.strokeColor('#c7c7c7').lineWidth(.6).moveTo(48,57).lineTo(547.28,57).stroke();doc.restore();doc.fontSize(fontSize);doc.x=48;doc.y=80;}
  doc.on('pageAdded',()=>{pageCount++;if(pageCount>COMPLETION_RENDER_LIMITS.maxPages)throw fail('PDF가 250페이지를 넘어 파일을 만들지 않았습니다. CSV를 이용하거나 기록 범위를 나눠 주세요.',413);drawHeader();});
  function room(height=35){if(doc.y+height>doc.page.height-58)doc.addPage();}
  function paragraph(value,{size=10,color='#000000',gap=6}={}){doc.fillColor(color).fontSize(size);doc.text(text(value),48,doc.y,{width,lineGap:3,paragraphGap:2});doc.moveDown(gap/(size*1.3));}
  function field(label,value){
    const labelText=text(label),body=text(valueText(value)||'기록 없음');doc.fontSize(8.5);const labelHeight=doc.heightOfString(labelText,{width:100,lineGap:2});
    // Labels from the service are short. Arbitrarily long labels still flow in full.
    if(labelHeight>160){paragraph(label,{size:8.5,color:'#565656',gap:2});paragraph(valueText(value)||'기록 없음',{size:10,gap:6});return;}
    room(Math.max(24,labelHeight+5));const y=doc.y,page=pageCount;
    doc.fillColor('#565656').fontSize(8.5).text(labelText,48,y,{width:100,lineGap:2});
    doc.fillColor('#000000').fontSize(10).text(body,160,y,{width:387.28,lineGap:3,paragraphGap:2});
    if(pageCount===page)doc.y=Math.max(doc.y,y+labelHeight);doc.y+=6;doc.x=48;
  }
  try{
    doc.addPage();paragraph('제작 완료 기록',{size:21,gap:8});paragraph(report.title,{size:16,gap:7});paragraph((report.status==='closed'?'현재 상태: ':'미확정 · 현재 상태: ')+report.statusLabel,{size:11,gap:12});
    field('고객명',report.customerName);field('파일 생성 시각 (한국 시간)',new Date(report.generatedAt).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'})+' KST');
    paragraph('이 파일은 현재 작업실 기록을 모은 내부 보관용 자료입니다. 파일 생성은 새 승인, 수령 확인 또는 마감 확정을 뜻하지 않습니다. 마감 확인 시각은 해당 기록에 별도로 표시합니다.',{size:9,color:'#464646',gap:10});
    for(const warning of report.warnings)paragraph('확인할 점: '+warning,{size:9,gap:6});
    for(const section of report.sections){
      room(64);doc.moveDown(.4);paragraph(section.title+' · '+section.rows.length+'건',{size:14,gap:8});
      if(!section.rows.length){paragraph('현재 조회 범위에 기록이 없습니다.',{size:9,color:'#565656',gap:12});continue;}
      for(let index=0;index<section.rows.length;index++){
        const summary=section.id==='current_summary'&&section.columns.some(column=>column.key==='item')&&section.columns.some(column=>column.key==='value');
        room(40);if(section.rows.length>1&&!summary)paragraph('기록 '+(index+1)+' / '+section.rows.length,{size:9,color:'#565656',gap:4});
        if(summary){field(section.rows[index].item,section.rows[index].value);for(const column of section.columns)if(!['item','value'].includes(column.key))field(column.label,section.rows[index][column.key]);}
        else for(const column of section.columns)field(column.label,section.rows[index][column.key]);
        room(8);doc.strokeColor('#e0e0e0').lineWidth(.5).moveTo(48,doc.y).lineTo(547.28,doc.y).stroke();doc.moveDown(.6);
      }
    }
    room(90);paragraph('이 파일의 기준',{size:12,gap:5});field('프로젝트 ID / 버전',report.projectId+' / '+report.revision);field('기록 지문',report.fingerprint);
    if(unsupported)paragraph('내장 한글 폰트가 지원하지 않는 문자는 [U+유니코드 번호]로 표기했습니다. CSV에는 원래 문자를 유지합니다.',{size:8,color:'#565656'});
    const pages=doc.bufferedPageRange();for(let page=pages.start;page<pages.start+pages.count;page++){doc.switchToPage(page);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.fontSize(8).fillColor('#565656').text('내부 보관용 · 외부 전달 전 내용 확인',48,doc.page.height-34,{width:350,lineBreak:false});doc.text((page+1)+' / '+pages.count,450,doc.page.height-34,{width:97.28,align:'right',lineBreak:false});doc.page.margins.bottom=bottom;}
    doc.end();return await output;
  }catch(error){doc.destroy();void output.catch(()=>{});throw error;}
}

if(!isMainThread&&workerData?.kind==='completion-record-pdf'){
  try{validate(workerData.report);const buffer=await createPdf(workerData.report),bytes=Uint8Array.from(buffer);parentPort.postMessage({bytes},[bytes.buffer]);}
  catch(error){parentPort.postMessage({error:{message:error.status?error.message:'PDF 문서 생성 중 오류가 발생했습니다. CSV를 이용하거나 다시 시도해 주세요.',status:error.status||500}});}
}
