'use strict';

// File contents stay in this tab. These helpers never upload or rewrite the source file.
const subtitleLimits = Object.freeze({bytes:2*1024*1024,cues:10000,issues:1000});
const subtitleSegmenter = typeof Intl!=='undefined'&&typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
const subtitleLab = {userId:'',request:0,busy:false,text:'',fileName:'',report:null,error:'',maxCps:20,maxLine:42,sort:false,onlyIssues:false,limit:40,issueLimit:80};
const subtitleEscape = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

function subtitleTime(value,format='vtt') {
  if(typeof value!=='string')return null;
  const match=(format==='srt'?/^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/:/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/).exec(value);
  if(!match)return null;
  const ms=((Number(match[1]||0)*60+Number(match[2]))*60+Number(match[3]))*1000+Number(match[4]);
  return Number.isSafeInteger(ms)?ms:null;
}
function subtitleClock(ms) {
  if(!Number.isFinite(ms))return '시간 오류';
  const hours=Math.floor(ms/3600000),minutes=Math.floor(ms%3600000/60000),seconds=Math.floor(ms%60000/1000);
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
function subtitlePlain(value,format) {
  let text=String(value??'');
  if(format==='vtt')text=text.replace(/<v(?:\.[^\s>]+)*[ \t]+([^>]+)>/g,(_,speaker)=>`[${speaker}] `).replace(/<\/?(?:b|i|u|c(?:\.[^\s>]+)*|v|lang(?:[ \t]+[^>]+)?|ruby|rt)>/g,'').replace(/<(?:(?:\d{2,}:)?[0-5]\d:[0-5]\d\.\d{3})>/g,'');
  else text=text.replace(/<\/?(?:b|i|u|font(?:[ \t]+[^>]+)?)>/gi,'');
  const entities={amp:'&',lt:'<',gt:'>',nbsp:' ',lrm:'\u200e',rlm:'\u200f'};
  return text.replace(/&(?:amp|lt|gt|nbsp|lrm|rlm);/g,token=>entities[token.slice(1,-1)]);
}
function subtitleCount(value) {
  const text=String(value).replace(/\s/g,'');
  if(subtitleSegmenter){let count=0;for(const ignored of subtitleSegmenter.segment(text))count++;return count;}
  return [...text].length;
}
function subtitleInspect(input,options={}) {
  if(typeof input!=='string')throw new Error('자막 텍스트를 확인해 주세요.');
  if(new TextEncoder().encode(input).byteLength>subtitleLimits.bytes)throw new Error('자막은 UTF-8 기준 2MiB 이하로 검사할 수 있어요.');
  const maxCps=Number(options.maxCps??20),maxLine=Number(options.maxLine??42);
  if(!Number.isFinite(maxCps)||maxCps<1||maxCps>100||!Number.isInteger(maxLine)||maxLine<10||maxLine>200)throw new Error('확인 기준은 초당 1~100자, 한 줄 10~200자로 설정해 주세요.');
  const normalized=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const format=/^WEBVTT(?:[ \t]|\n|$)/.test(normalized)||/\.vtt$/i.test(options.fileName||'')?'vtt':'srt';
  const report={format,cues:[],entries:[],header:'',issues:[],issueCount:0,errors:0,warnings:0,orderCount:0,overlaps:0,durationMs:null,characters:0,maxCps,maxLine,metadataAfterCue:false,byteSize:new TextEncoder().encode(input).byteLength};
  function issue(code,severity,message,cue=null,line=null) {
    report.issueCount++;severity==='error'?report.errors++:report.warnings++;
    if(report.issues.length<subtitleLimits.issues)report.issues.push({code,severity,message,cue:cue?.index??null,line:line??cue?.line??null});
    if(cue)cue.issueCount++;
  }
  if(!normalized.trim()){issue('empty-file','error','자막 내용이 없어요.');return report;}
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(normalized))issue('control-character','error','지원하지 않는 제어 문자가 있어요. 원본 인코딩을 확인해 주세요.');
  if(normalized.includes('\uFFFD'))issue('encoding','warning','대체 문자(�)가 있어요. 원본에서 글자가 깨졌는지 확인해 주세요.');
  const blocks=[];let start=0,line=1;
  for(const match of normalized.matchAll(/\n[ \t]*\n(?:[ \t]*\n)*/g)){
    const raw=normalized.slice(start,match.index);if(raw.trim())blocks.push({raw,line});
    line+=(normalized.slice(start,match.index+match[0].length).match(/\n/g)||[]).length;start=match.index+match[0].length;
  }
  const final=normalized.slice(start).replace(/\n+$/,'');if(final.trim())blocks.push({raw:final,line});
  let first=0;
  if(format==='vtt'){
    const header=blocks[0]?.raw||'';
    if(!/^WEBVTT(?:[ \t]|\n|$)/.test(header)||header.includes('-->'))issue('vtt-header','error','WebVTT는 WEBVTT 헤더 다음에 빈 줄이 필요해요.',null,1);
    else{report.header=header;first=1;}
  }
  const ids=new Set(),duplicates=new Map();let previousStart=-1;
  for(let blockIndex=first;blockIndex<blocks.length;blockIndex++){
    const block=blocks[blockIndex],lines=block.raw.split('\n');
    if(format==='vtt'&&/^(?:NOTE(?:[ \t]|$)|STYLE$|REGION$)/.test(lines[0])){
      const metadataType=lines[0].split(/[ \t]/)[0];
      if(report.cues.length)report.metadataAfterCue=true;
      if(block.raw.includes('-->'))issue('metadata-arrow','error',`${metadataType} 블록 안에는 -->를 넣을 수 없어요.`,null,block.line);
      if(metadataType!=='NOTE'&&report.cues.length)issue('metadata-position','error',`${metadataType} 블록은 첫 자막 앞에 있어야 해요.`,null,block.line);
      report.entries.push({type:'metadata',raw:block.raw,line:block.line});continue;
    }
    let timingIndex=lines[0].includes('-->')?0:lines[1]?.includes('-->')?1:-1;
    if(timingIndex<0){issue('unrecognized-block','error','시간 줄을 찾지 못한 블록이 있어요. 빈 줄과 자막 번호를 확인해 주세요.',null,block.line);report.entries.push({type:'unknown',raw:block.raw,line:block.line});continue;}
    if(report.cues.length>=subtitleLimits.cues)throw new Error('한 파일에서 최대 10,000개 자막까지 검사할 수 있어요. 파일을 나눠 주세요.');
    const identifier=timingIndex?lines[0]:'',timingRaw=lines[timingIndex],text=lines.slice(timingIndex+1).join('\n');
    const cue={index:report.cues.length+1,identifier,timingRaw,text,line:block.line,startMs:null,endMs:null,durationMs:null,characters:0,cps:null,issueCount:0};
    report.cues.push(cue);report.entries.push({type:'cue',cue});
    if(format==='srt'){
      if(!/^[1-9]\d*$/.test(identifier))issue('srt-number','warning','번호가 없거나 일반 SRT 번호 형식과 달라요. 정리본에서 순서대로 번호를 붙입니다.',cue);
      else if(ids.has(identifier))issue('duplicate-number','warning','같은 자막 번호가 반복돼요. 정리본에서 번호를 다시 붙입니다.',cue);
    }else if(identifier&&ids.has(identifier))issue('duplicate-identifier','error','WebVTT 자막 이름이 중복돼요. 스타일 참조가 있을 수 있어 자동으로 바꾸지 않아요.',cue);
    if(identifier)ids.add(identifier);
    const timing=/^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+(.*))?$/.exec(timingRaw);
    if(timing){cue.startMs=subtitleTime(timing[1],format);cue.endMs=subtitleTime(timing[2],format);cue.settings=timing[3]||'';}
    if(!timing||cue.startMs===null||cue.endMs===null){issue('timestamp','error',format==='srt'?'시간은 00:00:00,000 --> 00:00:01,000 형식으로 적어 주세요.':'시간은 00:00.000 또는 00:00:00.000 형식으로 적어 주세요.',cue);}
    else if(cue.endMs<=cue.startMs)issue('time-range','error','끝나는 시간이 시작 시간보다 늦어야 해요.',cue);
    else{
      cue.durationMs=cue.endMs-cue.startMs;report.durationMs=Math.max(report.durationMs??0,cue.endMs);
      if(cue.startMs<previousStart){report.orderCount++;issue('order','warning','시작 시간 순서가 뒤섞였어요. 시간은 바꾸지 않고 순서만 정리할 수 있어요.',cue);}
      previousStart=Math.max(previousStart,cue.startMs);
    }
    if(format==='vtt'&&text.includes('-->'))issue('payload-arrow','error','자막 본문 안에는 -->를 넣을 수 없어요. 빈 줄이 누락됐는지 확인해 주세요.',cue);
    if(format==='srt'&&/(?:^|\n)\d{2,}:[0-5]\d:[0-5]\d,\d{3}[ \t]+-->[ \t]+\d{2,}:[0-5]\d:[0-5]\d,\d{3}(?:[ \t]*\n|[ \t]*$)/.test(text))issue('missing-separator','error','본문에 또 다른 자막 시간 줄이 있어요. 자막 사이 빈 줄이 빠졌는지 확인해 주세요.',cue);
    if(cue.settings&&format==='srt')issue('srt-settings','warning','시간 뒤의 추가 설정을 그대로 보존해요. 게시할 플랫폼에서 지원하는지 확인해 주세요.',cue);
    const plain=subtitlePlain(text,format);cue.characters=subtitleCount(plain);report.characters+=cue.characters;
    if(!plain.trim())issue('empty-cue','warning','표시할 문장이 없는 자막이에요. 의도한 빈 자막인지 확인해 주세요.',cue);
    if(/<\/?(?:script|iframe|object|embed|img|style)\b/i.test(text))issue('unknown-markup','warning','자막과 무관한 태그가 있어요. 화면에서는 글자로만 보이며 정리본에 그대로 남습니다.',cue);
    if(plain.split('\n').some(row=>subtitleCount(row)>maxLine))issue('long-line','warning',`한 줄이 확인 기준 ${maxLine}자를 넘어요. 실제 휴대폰 화면에서 읽어 보세요.`,cue);
    if(plain.split('\n').length>2)issue('many-lines','warning','세 줄 이상 표시돼요. 화면과 자막 위치가 겹치는지 확인해 주세요.',cue);
    if(cue.durationMs){cue.cps=cue.characters/(cue.durationMs/1000);if(cue.cps>maxCps)issue('reading-speed','warning',`초당 ${cue.cps.toFixed(1)}자로 확인 기준 ${maxCps}자를 넘어요. 실제 음성과 읽는 시간을 확인해 주세요.`,cue);}
    const duplicateKey=`${cue.startMs}|${cue.endMs}|${text}`;
    if(cue.startMs!==null&&duplicates.has(duplicateKey))issue('duplicate-cue','warning',`${duplicates.get(duplicateKey)}번과 시간·문장이 같아요. 의도한 반복인지 확인해 주세요.`,cue);
    else if(cue.startMs!==null)duplicates.set(duplicateKey,cue.index);
  }
  let furthestEnd=-1,furthestCue=null;
  for(const cue of report.cues.filter(row=>row.durationMs).sort((a,b)=>a.startMs-b.startMs||a.index-b.index)){
    if(cue.startMs<furthestEnd){report.overlaps++;issue('overlap','warning',`${furthestCue.index}번과 표시 시간이 겹쳐요. 동시 대사라면 정상일 수 있으며 자동으로 밀지 않아요.`,cue);}
    if(cue.endMs>furthestEnd){furthestEnd=cue.endMs;furthestCue=cue;}
  }
  if(!report.cues.length)issue('no-cues','error','검사할 자막 시간과 문장을 찾지 못했어요.');
  return report;
}
function subtitleSerialize(report,{sort=false}={}) {
  if(!report||report.errors)throw new Error('형식 오류를 먼저 수정한 뒤 정리본을 내려받아 주세요. 오류 블록을 버리지 않아요.');
  if(report.orderCount&&!sort)throw new Error('시작 시간 순서 정리를 선택하거나 원본의 순서를 직접 확인해 주세요.');
  if(sort&&report.orderCount&&report.metadataAfterCue)throw new Error('자막 사이에 주석이나 설정이 있어요. 연결을 보존하기 위해 원본 순서를 직접 수정해 주세요.');
  const cues=sort?[...report.cues].sort((a,b)=>a.startMs-b.startMs||a.index-b.index):report.cues;
  let cursor=0,number=0;
  const blocks=report.entries.map(entry=>{
    if(entry.type!=='cue')return entry.raw;
    const cue=cues[cursor++];number++;
    return `${report.format==='srt'?number+'\n':cue.identifier?cue.identifier+'\n':''}${cue.timingRaw}\n${cue.text}`;
  });
  return (report.format==='vtt'?report.header+'\n\n':'')+blocks.join('\n\n')+'\n';
}
function subtitleTranscript(report) {return (report?.cues||[]).map(cue=>subtitlePlain(cue.text,report.format)).join('\n\n');}
function subtitleLabReset() {
  Object.assign(subtitleLab,{userId:'',request:subtitleLab.request+1,busy:false,text:'',fileName:'',report:null,error:'',maxCps:20,maxLine:42,sort:false,onlyIssues:false,limit:40,issueLimit:80});
}
function subtitleLabIdentity() {
  const id=typeof state!=='undefined'?state.user?.id:'';
  if(subtitleLab.userId!==id){subtitleLabReset();subtitleLab.userId=id||'';}
  return Boolean(id);
}
function subtitleLabRender() {if(typeof document!=='undefined'&&document.querySelector('[data-subtitle-panel]')&&typeof render==='function')render();}
function subtitleLabButton(label,action,classes='',attrs='') {return `<button type="button" class="btn ${classes}" data-action="subtitle-${action}" ${attrs}>${subtitleEscape(label)}</button>`;}
function subtitleLabPanel() {
  if(!subtitleLabIdentity())return '';
  const report=subtitleLab.report;
  return `<section class="subtitle-lab" data-subtitle-panel><header class="subtitle-heading"><div><span class="subtitle-kicker">게시할 자막 다듬기</span><h2>자막 검사</h2><p>SRT·WebVTT의 시간과 문장을 확인하고, 정리본과 읽기 원고를 가져가세요.</p></div>${subtitleLabButton('내용 비우기','clear','quiet small',subtitleLab.text?'':'disabled')}</header><form data-subtitle-form class="subtitle-input"><div class="subtitle-file-row"><label class="field">자막 파일<input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain" data-subtitle-file ${subtitleLab.busy?'disabled':''}><small>UTF-8 · 최대 2MiB / 10,000개 자막</small></label><p class="subtitle-privacy">파일은 이 브라우저 탭에서만 읽어요. 서버로 보내거나 원본을 덮어쓰지 않으며, 로그아웃하면 내용이 지워집니다.</p></div><label class="field">자막 붙여넣기<textarea name="text" rows="8" data-subtitle-text spellcheck="false" placeholder="1&#10;00:00:00,000 --&gt; 00:00:02,000&#10;오늘 하나만 바꿔 보세요." aria-describedby="subtitle-local-note">${subtitleEscape(subtitleLab.text)}</textarea></label><div class="subtitle-inspect-row"><details class="subtitle-options"><summary>읽기 확인 기준</summary><div class="subtitle-thresholds"><label class="field">초당 문자 수<input name="maxCps" type="number" min="1" max="100" step="1" value="${subtitleLab.maxCps}" data-subtitle-threshold="maxCps"></label><label class="field">한 줄 문자 수<input name="maxLine" type="number" min="10" max="200" step="1" value="${subtitleLab.maxLine}" data-subtitle-threshold="maxLine"></label></div><p>우리 작업용 조절값이며 플랫폼의 합격 기준이 아닙니다. 공백을 제외하고, 가능한 경우 표시 문자 단위로 셉니다.</p></details><button type="submit" class="btn primary" ${subtitleLab.busy?'disabled':''}>${subtitleLab.busy?'파일을 읽는 중…':'자막 검사하기'}</button></div><p id="subtitle-local-note" class="subtitle-note">음성과 뜻이 맞는지, 화자·효과음 설명이 충분한지는 실제로 재생해 확인하세요. 이 검사는 음성을 듣거나 번역하지 않습니다.</p></form>${subtitleLab.error?`<p class="subtitle-error" role="alert">${subtitleEscape(subtitleLab.error)}</p>`:''}${report?subtitleLabResult(report):''}<details class="subtitle-sources"><summary>검사 참고 기준</summary><p>WebVTT는 자막 중첩을 허용합니다. 형식 오류와 읽기 검토 사항을 구분하고, 시간·문장·스타일·주석은 자동으로 고치지 않습니다.</p><div><a href="https://www.w3.org/TR/webvtt1/" target="_blank" rel="noopener noreferrer">W3C WebVTT</a><a href="https://www.w3.org/WAI/media/av/captions/" target="_blank" rel="noopener noreferrer">자막 정확성과 접근성</a><a href="https://support.google.com/youtube/answer/2734698?hl=ko" target="_blank" rel="noopener noreferrer">YouTube 지원 자막</a></div></details></section>`;
}
function subtitleLabResult(report) {
  const cues=subtitleLab.onlyIssues?report.cues.filter(cue=>cue.issueCount):report.cues;
  const shown=cues.slice(0,subtitleLab.limit),sortable=!report.metadataAfterCue;
  const blocked=report.errors||report.orderCount&&!subtitleLab.sort||report.orderCount&&subtitleLab.sort&&!sortable;
  return `<section class="subtitle-result" data-subtitle-result aria-label="자막 검사 결과"><div class="subtitle-result-heading"><div><h3>${subtitleEscape(subtitleLab.fileName||'붙여넣은 자막')}</h3><p>${report.format.toUpperCase()} · ${report.cues.length.toLocaleString('ko-KR')}개 자막 · 마지막 종료 ${report.durationMs===null?'미확인':subtitleClock(report.durationMs)}</p></div><div class="subtitle-summary"><span class="${report.errors?'has-errors':''}"><b>${report.errors}</b> 형식 오류</span><span><b>${report.warnings}</b> 검토 안내</span></div></div>${report.errors?'<p class="subtitle-note">오류가 있는 블록을 버리지 않도록 정리본 다운로드를 막았어요. 원본에서 수정한 뒤 다시 검사해 주세요.</p>':'<p class="subtitle-note">형식 오류를 찾지 못했어요. 문장 정확성·실제 가독성·게시 가능 여부는 직접 확인해야 합니다.</p>'}<div class="subtitle-exports">${subtitleLabButton('정리본 내려받기','download','primary',blocked?'disabled':'')}${subtitleLabButton('읽기 원고 복사','copy','quiet',report.cues.length?'':'disabled')}${subtitleLabButton('원고 TXT 내려받기','transcript','quiet',report.cues.length?'':'disabled')}</div><label class="subtitle-sort"><input type="checkbox" data-subtitle-sort ${subtitleLab.sort?'checked':''} ${sortable?'':'disabled'}>시작 시간 순서로 정리 <span>시간·문장은 바꾸지 않아요.</span></label>${!sortable&&report.orderCount?'<p class="subtitle-note">자막 사이에 주석/설정이 있어 연결을 유지해야 해요. 원본에서 순서를 직접 정리해 주세요.</p>':''}<p class="subtitle-note">정리본은 줄바꿈과 SRT 번호만 정돈해 별도 파일로 저장합니다. 중복·빈 자막·시간 중첩은 그대로 남습니다.</p>${report.issueCount?`<details class="subtitle-issues" open><summary>확인할 곳 ${report.issueCount.toLocaleString('ko-KR')}개</summary><ol>${report.issues.slice(0,subtitleLab.issueLimit).map(item=>`<li class="${item.severity==='error'?'is-error':''}"><span>${item.severity==='error'?'오류':'검토'}${item.cue?` · 자막 ${item.cue}`:''}${item.line?` · ${item.line}줄`:''}</span><p>${subtitleEscape(item.message)}</p></li>`).join('')}</ol>${report.issues.length>subtitleLab.issueLimit?subtitleLabButton(`${Math.min(80,report.issues.length-subtitleLab.issueLimit)}개 검토 더 보기`,'more-issues','quiet small'):''}${report.issueCount>subtitleLimits.issues?`<p class="subtitle-note">검토가 많아 앞의 1,000개를 보관했습니다. 원본에서 해당 내용을 수정한 뒤 다시 검사해 주세요.</p>`:''}</details>`:''}<div class="subtitle-cue-heading"><h3>자막 내용</h3><label><input type="checkbox" data-subtitle-issues-only ${subtitleLab.onlyIssues?'checked':''}>검토가 있는 자막만</label></div><div class="subtitle-cues">${shown.map(cue=>`<article class="subtitle-cue"><header><b>${cue.index}</b><span>${subtitleEscape(cue.timingRaw)}</span>${cue.issueCount?`<small>검토 ${cue.issueCount}</small>`:''}</header><p>${subtitleEscape(cue.text||'(빈 자막)')}</p><footer>${cue.durationMs===null?'시간 미확인':`${(cue.durationMs/1000).toFixed(3)}초`} · ${cue.characters}자${cue.cps===null?'':` · 초당 ${cue.cps.toFixed(1)}자`}</footer></article>`).join('')||'<p class="subtitle-note">이 범위에 해당하는 자막이 없어요.</p>'}</div>${cues.length>shown.length?subtitleLabButton(`${Math.min(40,cues.length-shown.length)}개 더 보기`,'more','quiet'):''}</section>`;
}
async function subtitleLabFile(file) {
  if(!subtitleLabIdentity()||!file)return;
  const userId=subtitleLab.userId,request=++subtitleLab.request;
  subtitleLab.busy=true;subtitleLab.error='';subtitleLab.report=null;subtitleLabRender();
  try{
    if(file.size>subtitleLimits.bytes)throw new Error('자막 파일은 2MiB 이하로 골라 주세요.');
    if(!/\.(?:srt|vtt)$/i.test(file.name||''))throw new Error('.srt 또는 .vtt 파일을 골라 주세요.');
    const text=await file.text();
    if(request!==subtitleLab.request||typeof state==='undefined'||state.user?.id!==userId)return;
    subtitleLab.text=text;subtitleLab.fileName=file.name;subtitleLab.limit=40;subtitleLab.issueLimit=80;subtitleLab.sort=false;
    subtitleLab.report=subtitleInspect(text,{fileName:file.name,maxCps:subtitleLab.maxCps,maxLine:subtitleLab.maxLine});
  }catch(error){if(request===subtitleLab.request&&state.user?.id===userId)subtitleLab.error=error.message||'자막을 읽지 못했어요. 파일과 인코딩을 확인해 주세요.';}
  finally{if(request===subtitleLab.request&&state.user?.id===userId){subtitleLab.busy=false;subtitleLabRender();}}
}
function subtitleLabDownload(text,extension,suffix) {
  if(!subtitleLabIdentity())return;
  const name=(subtitleLab.fileName||'자막').replace(/\.(?:srt|vtt)$/i,'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,140)||'자막';
  const url=URL.createObjectURL(new Blob([text],{type:extension==='vtt'?'text/vtt;charset=utf-8':'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`${name}_${suffix}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
if(typeof document!=='undefined'){
  document.addEventListener('input',event=>{
    const target=event.target;if(!target.matches?.('[data-subtitle-text],[data-subtitle-threshold]')||!subtitleLabIdentity())return;
    subtitleLab.request++;subtitleLab.busy=false;subtitleLab.error='';subtitleLab.report=null;
    if(target.matches('[data-subtitle-text]')){subtitleLab.text=target.value;subtitleLab.fileName='';}else subtitleLab[target.dataset.subtitleThreshold]=Number(target.value);
    const result=document.querySelector('[data-subtitle-result]');if(result)result.hidden=true;
  });
  document.addEventListener('change',event=>{
    const target=event.target;if(!subtitleLabIdentity())return;
    if(target.matches?.('[data-subtitle-file]')){const file=target.files?.[0];if(file)void subtitleLabFile(file);}
    else if(target.matches?.('[data-subtitle-sort]')){subtitleLab.sort=target.checked;subtitleLabRender();}
    else if(target.matches?.('[data-subtitle-issues-only]')){subtitleLab.onlyIssues=target.checked;subtitleLab.limit=40;subtitleLabRender();}
  });
  document.addEventListener('submit',event=>{
    const form=event.target;if(!form.matches?.('[data-subtitle-form]'))return;event.preventDefault();if(!subtitleLabIdentity()||subtitleLab.busy)return;
    subtitleLab.request++;subtitleLab.error='';subtitleLab.limit=40;subtitleLab.issueLimit=80;subtitleLab.sort=false;
    try{subtitleLab.text=form.querySelector('[data-subtitle-text]').value;subtitleLab.maxCps=Number(form.elements.maxCps.value);subtitleLab.maxLine=Number(form.elements.maxLine.value);subtitleLab.report=subtitleInspect(subtitleLab.text,{fileName:subtitleLab.fileName,maxCps:subtitleLab.maxCps,maxLine:subtitleLab.maxLine});}
    catch(error){subtitleLab.report=null;subtitleLab.error=error.message;}subtitleLabRender();
  });
  document.addEventListener('click',async event=>{
    const target=event.target.closest?.('[data-action^="subtitle-"]');if(!target||target.disabled||!subtitleLabIdentity())return;
    const action=target.dataset.action.slice(9),report=subtitleLab.report,userId=subtitleLab.userId,request=subtitleLab.request;
    try{
      if(action==='clear'){subtitleLabReset();subtitleLabIdentity();subtitleLabRender();}
      else if(action==='more'){subtitleLab.limit+=40;subtitleLabRender();}
      else if(action==='more-issues'){subtitleLab.issueLimit=Math.min(subtitleLimits.issues,subtitleLab.issueLimit+80);subtitleLabRender();}
      else if(report&&action==='download')subtitleLabDownload(subtitleSerialize(report,{sort:subtitleLab.sort}),report.format,'정리본');
      else if(report&&action==='transcript')subtitleLabDownload(subtitleTranscript(report),'txt','읽기원고');
      else if(report&&action==='copy'){
        try{await navigator.clipboard.writeText(subtitleTranscript(report));if(state.user?.id===userId&&request===subtitleLab.request&&typeof notify==='function')notify('읽기 원고를 복사했어요.');}
        catch{if(state.user?.id===userId&&request===subtitleLab.request&&typeof modal==='function')modal('읽기 원고','선택해서 복사해 주세요.',`<label class="field">복사용 원고<textarea rows="14" readonly>${subtitleEscape(subtitleTranscript(report))}</textarea></label>`,true);}
      }
    }catch(error){if(state.user?.id===userId&&request===subtitleLab.request){subtitleLab.error=error.message;subtitleLabRender();}}
  });
}
