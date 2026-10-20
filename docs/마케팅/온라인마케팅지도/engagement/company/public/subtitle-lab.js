'use strict';

// 자막 검사 — 시그널 13판 「도구 한 장」(2026-10-20). 파일은 이 탭에서만 읽고, 원본을 올리거나 고치지 않는다.
// 머리·포스터·번호 구역·파일 칸은 maker-tools.js 앞 절반 도우미(mtHead · mtBlock · mtDrop · mtMeter …)를 그대로 쓴다.
const subtitleLimits = Object.freeze({bytes:2*1024*1024,cues:10000,issues:1000});
const subtitleSegmenter = typeof Intl!=='undefined'&&typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
const subtitleLab = {userId:'',request:0,busy:false,text:'',fileName:'',report:null,error:'',maxCps:20,maxLine:42,sort:false,onlyIssues:false,limit:40,issueLimit:80,openOptions:false};
const subtitleEscape = value => String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
// 줄 목록 오른쪽에 붙는 문제 이름. 형식 오류(코랄)는 subtitleErrorCodes, 나머지는 살펴볼 곳(버터).
const subtitleIssueLabels = Object.freeze({'empty-cue':'빈 자막',overlap:'겹침','reading-speed':'빠름','long-line':'긴 줄','many-lines':'세 줄 이상',order:'순서','duplicate-cue':'같은 자막','srt-number':'번호','duplicate-number':'번호 겹침','duplicate-identifier':'이름 겹침',timestamp:'시간 형식','time-range':'시간 범위','payload-arrow':'빈 줄 빠짐','missing-separator':'빈 줄 빠짐','srt-settings':'추가 설정','unknown-markup':'태그'});
const subtitleErrorCodes = new Set(['duplicate-identifier','timestamp','time-range','payload-arrow','missing-separator']);
// 파일 칸 기본 글 — 글을 고칠 때는 다시 그리지 않고 이 글로 되돌린다.
const subtitleDropTitle = 'SRT·VTT 파일 고르기', subtitleDropLimits = 'UTF-8 · 2MiB · 자막 10,000개까지';
// 읽기 기준 칸: 비우면 0이 아니라 「값 없음」으로 둬서 검사가 범위 오류로 알리게 한다.
function subtitleLabLimit(value) {return String(value??'').trim()===''?NaN:Number(value);}
function subtitleLabLimitsOk() {const cps=subtitleLab.maxCps,line=subtitleLab.maxLine;return Number.isFinite(cps)&&cps>=1&&cps<=100&&Number.isInteger(line)&&line>=10&&line<=200;}

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
  if(typeof input!=='string')throw new Error('자막 글을 읽지 못했어요. 다시 붙여넣어 주세요.');
  if(new TextEncoder().encode(input).byteLength>subtitleLimits.bytes)throw new Error('자막은 UTF-8 기준 2MiB 이하로 검사할 수 있어요.');
  const maxCps=Number(options.maxCps??20),maxLine=Number(options.maxLine??42);
  if(!Number.isFinite(maxCps)||maxCps<1||maxCps>100||!Number.isInteger(maxLine)||maxLine<10||maxLine>200)throw new Error('읽기 기준은 초당 1~100자, 한 줄 10~200자 사이로 넣어 주세요.');
  const normalized=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  // \uB9E8 \uC55E \uBE48 \uC904: SRT\uB294 \uAC74\uB108\uB6F0\uACE0 \uC904 \uBC88\uD638\uB294 \uC6D0\uBCF8 \uAE30\uC900\uC73C\uB85C \uC13C\uB2E4. WebVTT\uB294 \uCCAB \uC904\uC774 WEBVTT\uC5EC\uC57C \uD558\uB2C8 \uADF8\uB300\uB85C \uB450\uACE0 \uBA38\uB9AC \uC624\uB958\uB85C \uC54C\uB9B0\uB2E4.
  const lead=/^(?:[ \t]*\n)+/.exec(normalized)?.[0]||'';
  const format=/^WEBVTT(?:[ \t]|\n|$)/.test(normalized.slice(lead.length))||/\.vtt$/i.test(options.fileName||'')?'vtt':'srt';
  const body=format==='srt'?normalized.slice(lead.length):normalized;
  const report={format,cues:[],entries:[],header:'',issues:[],issueCount:0,errors:0,warnings:0,orderCount:0,overlaps:0,durationMs:null,characters:0,maxCps,maxLine,metadataAfterCue:false,byteSize:new TextEncoder().encode(input).byteLength};
  function issue(code,severity,message,cue=null,line=null) {
    report.issueCount++;severity==='error'?report.errors++:report.warnings++;
    if(report.issues.length<subtitleLimits.issues)report.issues.push({code,severity,message,cue:cue?.index??null,line:line??cue?.line??null});
    // 자막마다 문제 이름을 남겨 둔다 — 문장으로 남기는 issues는 1,000개에서 멈추지만 이름과 개수는 끝까지 센다.
    if(cue){cue.issueCount++;cue.codes.push(code);if(severity==='error')cue.errorCount++;}
  }
  if(!normalized.trim()){issue('empty-file','error','자막 내용이 없어요.');return report;}
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(normalized))issue('control-character','error','보이지 않는 제어 문자가 들어 있어요. 원본을 UTF-8로 다시 저장해 주세요.');
  if(normalized.includes('\uFFFD'))issue('encoding','warning','깨진 글자(\uFFFD)가 있어요. 원본을 UTF-8로 저장했는지 봐 주세요.');
  const blocks=[];let start=0,line=1+(body===normalized?0:(lead.match(/\n/g)||[]).length);
  for(const match of body.matchAll(/\n[ \t]*\n(?:[ \t]*\n)*/g)){
    const raw=body.slice(start,match.index);if(raw.trim())blocks.push({raw,line});
    line+=(body.slice(start,match.index+match[0].length).match(/\n/g)||[]).length;start=match.index+match[0].length;
  }
  const final=body.slice(start).replace(/\n+$/,'');if(final.trim())blocks.push({raw:final,line});
  let first=0;
  if(format==='vtt'){
    const header=blocks[0]?.raw||'';
    if(!/^WEBVTT(?:[ \t]|\n|$)/.test(header)||header.includes('-->')){
      issue('vtt-header','error','WebVTT는 첫 줄에 WEBVTT를 쓰고 그다음 줄을 비워야 해요.',null,1);
      // 맨 앞 빈 줄 때문에 머리가 밀린 경우는 그 머리 덩어리를 자막으로 다시 세지 않는다(같은 문제를 두 번 알리지 않게).
      if(!header.includes('-->')&&/^WEBVTT(?:[ \t]|\n|$)/.test(header.replace(/^(?:[ \t]*\n)+/,'')))first=1;
    }
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
    if(timingIndex<0){issue('unrecognized-block','error','시간 줄을 찾지 못한 부분이 있어요. 빈 줄과 자막 번호를 고쳐 주세요.',null,block.line);report.entries.push({type:'unknown',raw:block.raw,line:block.line});continue;}
    if(report.cues.length>=subtitleLimits.cues)throw new Error('한 파일에서 최대 10,000개 자막까지 검사할 수 있어요. 파일을 나눠 주세요.');
    const identifier=timingIndex?lines[0]:'',timingRaw=lines[timingIndex],text=lines.slice(timingIndex+1).join('\n');
    const cue={index:report.cues.length+1,identifier,timingRaw,text,line:block.line,startMs:null,endMs:null,durationMs:null,characters:0,cps:null,issueCount:0,errorCount:0,codes:[]};
    report.cues.push(cue);report.entries.push({type:'cue',cue});
    if(format==='srt'){
      if(!/^[1-9]\d*$/.test(identifier))issue('srt-number','warning','번호가 없거나 SRT 번호 형식과 달라요. 정리본에서 순서대로 다시 붙여요.',cue);
      else if(ids.has(identifier))issue('duplicate-number','warning','같은 번호가 또 나와요. 정리본에서 번호를 다시 붙여요.',cue);
    }else if(identifier&&ids.has(identifier))issue('duplicate-identifier','error','WebVTT 자막 이름이 겹쳐요. 스타일이 이 이름을 가리킬 수 있어 자동으로 바꾸지 않아요.',cue);
    if(identifier)ids.add(identifier);
    const timing=/^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+(.*))?$/.exec(timingRaw);
    if(timing){cue.startMs=subtitleTime(timing[1],format);cue.endMs=subtitleTime(timing[2],format);cue.settings=timing[3]||'';}
    if(!timing||cue.startMs===null||cue.endMs===null){issue('timestamp','error',format==='srt'?'시간은 00:00:00,000 --> 00:00:01,000 형식으로 적어 주세요.':'시간은 00:00.000 또는 00:00:00.000 형식으로 적어 주세요.',cue);}
    else if(cue.endMs<=cue.startMs)issue('time-range','error','끝나는 시간이 시작 시간보다 늦어야 해요.',cue);
    else{
      cue.durationMs=cue.endMs-cue.startMs;report.durationMs=Math.max(report.durationMs??0,cue.endMs);
      if(cue.startMs<previousStart){report.orderCount++;issue('order','warning','시작 시간 순서가 뒤섞였어요. 시간은 그대로 두고 순서만 정리할 수 있어요.',cue);}
      previousStart=Math.max(previousStart,cue.startMs);
    }
    if(format==='vtt'&&text.includes('-->'))issue('payload-arrow','error','자막 문장 안에는 -->를 넣을 수 없어요. 자막 사이 빈 줄이 빠졌는지 봐 주세요.',cue);
    if(format==='srt'&&/(?:^|\n)\d{2,}:[0-5]\d:[0-5]\d,\d{3}[ \t]+-->[ \t]+\d{2,}:[0-5]\d:[0-5]\d,\d{3}(?:[ \t]*\n|[ \t]*$)/.test(text))issue('missing-separator','error','문장 안에 다른 자막의 시간 줄이 있어요. 자막 사이 빈 줄이 빠졌는지 봐 주세요.',cue);
    if(cue.settings&&format==='srt')issue('srt-settings','warning','시간 뒤 추가 설정은 그대로 둬요. 올릴 플랫폼이 이 설정을 읽는지 봐 주세요.',cue);
    const plain=subtitlePlain(text,format);cue.characters=subtitleCount(plain);report.characters+=cue.characters;
    if(!plain.trim())issue('empty-cue','warning','보여 줄 문장이 없어요. 일부러 비운 자막인지 봐 주세요.',cue);
    if(/<\/?(?:script|iframe|object|embed|img|style)\b/i.test(text))issue('unknown-markup','warning','자막과 상관없는 태그가 있어요. 화면에는 글자로만 보이고 정리본에도 그대로 남아요.',cue);
    if(plain.split('\n').some(row=>subtitleCount(row)>maxLine))issue('long-line','warning',`한 줄이 읽기 기준 ${maxLine}자를 넘어요. 휴대폰 화면에서 읽어 봐요.`,cue);
    if(plain.split('\n').length>2)issue('many-lines','warning','세 줄 이상 보여요. 화면 속 다른 글자와 겹치는지 봐 주세요.',cue);
    if(cue.durationMs){cue.cps=cue.characters/(cue.durationMs/1000);if(cue.cps>maxCps)issue('reading-speed','warning',`초당 ${cue.cps.toFixed(1)}자로 읽기 기준 ${maxCps}자를 넘어요. 소리와 같이 틀어 놓고 읽어 봐요.`,cue);}
    const duplicateKey=`${cue.startMs}|${cue.endMs}|${text}`;
    if(cue.startMs!==null&&duplicates.has(duplicateKey))issue('duplicate-cue','warning',`${duplicates.get(duplicateKey)}번과 시간·문장이 같아요. 일부러 반복한 건지 봐 주세요.`,cue);
    else if(cue.startMs!==null)duplicates.set(duplicateKey,cue.index);
  }
  let furthestEnd=-1,furthestCue=null;
  for(const cue of report.cues.filter(row=>row.durationMs).sort((a,b)=>a.startMs-b.startMs||a.index-b.index)){
    if(cue.startMs<furthestEnd){report.overlaps++;issue('overlap','warning',`${furthestCue.index}번과 보이는 시간이 겹쳐요. 두 사람이 같이 말하는 자리면 괜찮아요. 시간을 자동으로 밀지 않아요.`,cue);}
    if(cue.endMs>furthestEnd){furthestEnd=cue.endMs;furthestCue=cue;}
  }
  if(!report.cues.length)issue('no-cues','error','검사할 자막 시간과 문장을 찾지 못했어요.');
  return report;
}
function subtitleSerialize(report,{sort=false}={}) {
  if(!report||report.errors)throw new Error('형식 오류를 먼저 고쳐야 정리본을 받을 수 있어요. 오류가 있는 부분을 버리지 않아요.');
  if(report.orderCount&&!sort)throw new Error('순서가 뒤섞여 있어요. 「시작 시간 순서로 정리」를 켜거나 원본에서 순서를 고쳐 주세요.');
  if(sort&&report.orderCount&&report.metadataAfterCue)throw new Error('자막 사이에 주석이나 설정이 있어 순서를 자동으로 바꾸지 않아요. 원본에서 순서를 고쳐 주세요.');
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
  Object.assign(subtitleLab,{userId:'',request:subtitleLab.request+1,busy:false,text:'',fileName:'',report:null,error:'',maxCps:20,maxLine:42,sort:false,onlyIssues:false,limit:40,issueLimit:80,openOptions:false});
}
function subtitleLabIdentity() {
  const id=typeof state!=='undefined'?state.user?.id:'';
  if(subtitleLab.userId!==id){subtitleLabReset();subtitleLab.userId=id||'';}
  return Boolean(id);
}
function subtitleLabRender() {if(typeof document!=='undefined'&&document.querySelector('[data-subtitle-panel]')&&typeof render==='function')render();}
// 단추: label은 글자로 넣고(escape), html은 아이콘처럼 이미 만든 마크업을 앞에 붙인다.
function subtitleLabButton(label,action,classes='btn',attrs='',html='') {return `<button type="button" class="${classes}" data-action="subtitle-${action}" ${attrs}>${html}${subtitleEscape(label)}</button>`;}
function subtitleLabNumber(value) {return Number(value).toLocaleString('ko-KR');}
function subtitleLabPanel() {
  if(!subtitleLabIdentity())return '';
  const report=subtitleLab.report;
  // 포스터 숫자는 검사한 뒤에만 — 검사 전에는 숫자 칸을 비우지 않고 아예 두지 않는다.
  const stats=report?[{label:'자막',value:report.cues.length},{label:'문제',value:report.issueCount,tone:report.errors?'alert':report.issueCount?'wait':'ok'}]:[];
  const head=mtHead({tool:'subtitles',title:'자막 검사',desc:'SRT·WebVTT 자막의 시간과 문장을 검사하고, 정리본과 읽기 원고를 받아요.',poster:{label:'SYNK MAKER · SUBTITLE',stats,word:'자막'}});
  return `<div class="sl" data-subtitle-panel>${head}${subtitleLabInput()}${report?subtitleLabResult(report):''}${subtitleLabOptions()}</div>`;
}
function subtitleLabInput() {
  const busy=subtitleLab.busy,name=subtitleLab.fileName,limits=subtitleDropLimits;
  const drop=mtDrop({attrs:'accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain" data-subtitle-file aria-describedby="subtitle-lab-local"',title:busy?'파일을 읽고 있어요…':name||subtitleDropTitle,hint:name&&!busy?`다른 파일을 고르면 바꿔요 · ${limits}`:limits,icon:'file',set:Boolean(name)&&!busy,disabled:busy});
  const filled=Boolean(subtitleLab.text||subtitleLab.fileName||subtitleLab.report);
  // novalidate: 접힌 기준 칸의 값이 범위 밖이어도 브라우저가 제출을 막지 않고, 검사가 한국어 안내로 알린다.
  const body=`<form class="sl-form" id="subtitle-lab-form" data-subtitle-form novalidate>${drop}<label class="mt-field sl-paste"><span>또는 붙여넣기</span><textarea name="text" rows="7" data-subtitle-text spellcheck="false" placeholder="1&#10;00:00:00,000 --&gt; 00:00:02,000&#10;오늘 하나만 바꿔 보세요." aria-describedby="subtitle-lab-local">${subtitleEscape(subtitleLab.text)}</textarea></label>${subtitleLab.error?mtError(subtitleLab.error):''}<div class="sl-form-foot"><button type="submit" class="btn primary" ${busy?'disabled':''}>${busy?'읽는 중…':'검사하기'}</button>${filled?subtitleLabButton('비우기','clear','mt-link'):''}<p class="mt-note" id="subtitle-lab-local">이 브라우저 탭에서만 읽어요. 서버로 보내지 않고 원본도 고치지 않아요. 로그아웃하면 지워져요.</p></div></form>`;
  return mtBlock({num:'01',title:'자막 넣기',body});
}
// 시간 줄은 파일에 적힌 시작·끝 글자를 그대로 두고 화살표만 보기 좋게 바꾼다(형식이 깨진 줄은 원문 그대로).
function subtitleLabTiming(cue) {const match=/^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+(.*))?$/.exec(cue.timingRaw||'');return match?`${subtitleEscape(match[1])} <i>→</i> ${subtitleEscape(match[2])}${match[3]?`<em>${subtitleEscape(match[3])}</em>`:''}`:subtitleEscape(cue.timingRaw);}
function subtitleLabCue(cue,messages) {
  const codes=[...new Set(cue.codes||[])],tone=cue.errorCount?'alert':cue.issueCount?'wait':'';
  const meta=`${cue.durationMs===null?'시간 미확인':`${(cue.durationMs/1000).toFixed(3)}초`} · ${cue.characters}자${cue.cps===null?'':` · 초당 ${cue.cps.toFixed(1)}자`}`;
  const blank=!String(cue.text).trim();
  return `<li class="sl-cue"${tone?` data-tone="${tone}"`:''}><span class="sl-num">${cue.index}</span><span class="sl-time">${subtitleLabTiming(cue)}<small>${meta}</small></span><div class="sl-text"><p${blank?' class="is-empty"':''}>${blank?'(빈 자막)':subtitleEscape(cue.text)}</p>${messages.map(item=>`<p class="sl-issue" data-tone="${item.severity==='error'?'alert':'wait'}">${subtitleEscape(item.message)}</p>`).join('')}</div><span class="sl-flags">${codes.map(code=>mtBadge(subtitleIssueLabels[code]||'살펴볼 곳',subtitleErrorCodes.has(code)?'alert':'wait')).join('')}</span></li>`;
}
function subtitleLabResult(report) {
  const cues=subtitleLab.onlyIssues?report.cues.filter(cue=>cue.issueCount):report.cues;
  const shown=cues.slice(0,subtitleLab.limit),sortable=!report.metadataAfterCue;
  const blocked=report.errors||report.orderCount&&!subtitleLab.sort||report.orderCount&&subtitleLab.sort&&!sortable;
  const counted=code=>report.cues.filter(cue=>cue.codes?.includes(code)).length,empty=counted('empty-cue'),fast=counted('reading-speed'),withIssues=report.cues.filter(cue=>cue.issueCount).length;
  const meter=mtMeter([{label:'자막',value:report.cues.length,unit:'개'},{label:'빈 자막',value:empty,unit:'개',tone:empty?'wait':''},{label:'겹침',value:report.overlaps,unit:'개',tone:report.overlaps?'wait':''},{label:'빠른 자막',value:fast,unit:'개',tone:fast?'wait':''}]);
  const status=report.errors?mtError(`형식 오류 ${subtitleLabNumber(report.errors)}개가 있어 정리본을 받을 수 없어요. 원본에서 고친 뒤 다시 검사해요.`):`<p class="mt-notice"${report.warnings?' data-tone="wait"':''}>${report.warnings?`형식 오류는 없어요 · 살펴볼 곳 ${subtitleLabNumber(report.warnings)}개`:'형식 오류도 살펴볼 곳도 없어요'}</p>`;
  const messages=new Map();for(const item of report.issues)if(item.cue!==null){const list=messages.get(item.cue)||[];list.push(item);messages.set(item.cue,list);}
  const loose=report.issues.filter(item=>item.cue===null);
  const looseRows=loose.slice(0,subtitleLab.issueLimit).map(item=>`<div class="mt-issue sl-loose">${mtLed(item.severity==='error'?'alert':'wait')}<div><strong>${subtitleEscape(item.message)}</strong><p>${item.line?`${subtitleLabNumber(item.line)}줄 · `:''}${item.severity==='error'?'형식 오류':'살펴볼 곳'}</p></div></div>`).join('');
  const tools=`<div class="sl-list-tools"><label class="mt-check"><input type="checkbox" data-subtitle-issues-only ${subtitleLab.onlyIssues?'checked':''}><span>문제 있는 자막만 보기 <b>${subtitleLabNumber(withIssues)}</b></span></label>${cues.length?`<span class="mt-note">${subtitleLabNumber(shown.length)} / ${subtitleLabNumber(cues.length)}개</span>`:''}</div>`;
  const list=shown.length?`<ol class="sl-cues">${shown.map(cue=>subtitleLabCue(cue,messages.get(cue.index)||[])).join('')}</ol>`:report.cues.length?mtEmpty('','문제 있는 자막이 없어요.'):'';
  const more=cues.length>shown.length?`<div class="sl-more">${subtitleLabButton(`${subtitleLabNumber(Math.min(40,cues.length-shown.length))}개 더 보기`,'more','btn small')}</div>`:'';
  const resultBody=`${meter}${status}${loose.length?`<div class="sl-loose-list">${looseRows}${loose.length>subtitleLab.issueLimit?`<div class="sl-more">${subtitleLabButton(`${subtitleLabNumber(Math.min(80,loose.length-subtitleLab.issueLimit))}개 더 보기`,'more-issues','btn small')}</div>`:''}</div>`:''}${report.issueCount>subtitleLimits.issues?`<p class="mt-note">문제가 많아 앞의 ${subtitleLabNumber(subtitleLimits.issues)}개만 문장으로 보여요. 원본을 고친 뒤 다시 검사해요.</p>`:''}${report.cues.length?tools:''}${list}${more}`;
  const desc=`${subtitleLab.fileName||'붙여넣은 자막'} · ${report.format.toUpperCase()} · 끝 시각 ${report.durationMs===null?'미확인':subtitleClock(report.durationMs)}`;
  const reason=report.errors?'':report.orderCount&&!sortable?'자막 사이에 주석·설정이 있어 순서를 자동으로 바꾸지 않아요. 원본에서 순서를 고친 뒤 다시 검사해요.':report.orderCount&&!subtitleLab.sort?'시작 시간 순서가 뒤섞여 있어요. 「시작 시간 순서로 정리」를 켜면 정리본을 받을 수 있어요.':'';
  const exportsBody=`<div class="mt-actions sl-exports">${subtitleLabButton('정리본','download','btn',`${blocked?'disabled':''} aria-label="정리본 받기"`,mtIcon('download'))}${subtitleLabButton('읽기 원고','transcript','btn',`${report.cues.length?'':'disabled'} aria-label="읽기 원고 받기"`,mtIcon('download'))}${report.cues.length?subtitleLabButton('원고 복사','copy','mt-link'):''}</div>${report.orderCount?`<label class="mt-check sl-sort"><input type="checkbox" data-subtitle-sort ${subtitleLab.sort?'checked':''} ${sortable?'':'disabled'}><span>시작 시간 순서로 정리 <small>시간·문장은 바꾸지 않아요</small></span></label>`:''}${reason?`<p class="mt-note sl-reason">${reason}</p>`:''}<p class="mt-note">정리본은 번호와 줄바꿈만 다시 맞춘 새 파일이고, 읽기 원고는 문장만 모은 TXT예요. 시간·문장·빈 자막·겹침은 그대로 둬요.</p><p class="mt-note">소리를 듣거나 번역하지 않아요. 음성과 뜻이 맞는지는 영상을 틀어 놓고 봐요.</p>`;
  return `<div class="sl-result" data-subtitle-result>${mtBlock({num:'02',title:'결과',desc,body:resultBody,cls:'sl-result-block'})}${mtBlock({num:'03',title:'받기',body:exportsBody})}</div>`;
}
function subtitleLabOptions() {
  const value=key=>Number.isFinite(subtitleLab[key])?subtitleLab[key]:'';
  const shown=key=>Number.isFinite(subtitleLab[key])?`${subtitleLabNumber(subtitleLab[key])}자`:'—';
  const links=[['https://www.w3.org/TR/webvtt1/','W3C WebVTT'],['https://www.w3.org/WAI/media/av/captions/','자막 정확성과 접근성'],['https://support.google.com/youtube/answer/2734698?hl=ko','YouTube 지원 자막']].map(([href,label])=>`<a class="mt-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('');
  // 기준 칸은 접힌 줄 안에 있지만 form 속성으로 01의 검사 양식에 묶여, 「검사하기」가 이 값을 읽는다.
  // 기준 값이 잘못돼 검사가 멈추면 한 번 펼쳐 보여 준다(그 뒤 열림은 id로 다시 그려도 유지된다).
  const open=subtitleLab.openOptions;subtitleLab.openOptions=false;
  return `<details class="mt-fold sl-options" id="subtitle-lab-options"${open?' open':''}><summary><span>읽기 기준 · 참고 자료 <b>초당 ${shown('maxCps')} · 한 줄 ${shown('maxLine')}</b></span></summary><div class="sl-options-body"><div class="sl-thresholds"><label class="mt-field"><span>초당 글자 수 <small>1~100</small></span><input form="subtitle-lab-form" name="maxCps" type="number" min="1" max="100" step="1" inputmode="numeric" value="${value('maxCps')}" data-subtitle-threshold="maxCps"></label><label class="mt-field"><span>한 줄 글자 수 <small>10~200</small></span><input form="subtitle-lab-form" name="maxLine" type="number" min="10" max="200" step="1" inputmode="numeric" value="${value('maxLine')}" data-subtitle-threshold="maxLine"></label></div><p class="mt-note">우리 팀이 정한 읽기 기준이에요. 플랫폼 합격 기준은 아니에요. 공백은 빼고 눈에 보이는 글자 단위로 세요. 바꾼 뒤 「검사하기」를 다시 눌러요.</p><p class="mt-note">WebVTT는 자막이 겹쳐도 돼요. 형식 오류와 살펴볼 곳을 나눠 보여 주고, 시간·문장·스타일·주석은 자동으로 고치지 않아요.</p><div class="mt-actions sl-links">${links}</div></div></details>`;
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
  }catch(error){if(request===subtitleLab.request&&state.user?.id===userId){subtitleLab.error=error.message||'자막을 읽지 못했어요. UTF-8로 저장한 .srt·.vtt 파일인지 봐 주세요.';if(!subtitleLabLimitsOk())subtitleLab.openOptions=true;}}
  finally{if(request===subtitleLab.request&&state.user?.id===userId){subtitleLab.busy=false;subtitleLabRender();}}
}
function subtitleLabDownload(text,extension,suffix) {
  if(!subtitleLabIdentity())return;
  const name=(subtitleLab.fileName||'자막').replace(/\.(?:srt|vtt)$/i,'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,140)||'자막';
  const url=URL.createObjectURL(new Blob([text],{type:extension==='vtt'?'text/vtt;charset=utf-8':'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`${name}_${suffix}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// 글·기준을 고치면 다시 그리지 않고(쓰던 칸의 초점·커서 유지) 화면만 지금 상태에 맞춘다:
// 지난 결과·포스터 숫자·오류 상자를 감추고, 파일을 읽던 중이었으면 「검사하기」와 파일 칸 잠금을 풀고, 파일 칸 글을 되돌린다.
function subtitleLabHideResult() {
  if(typeof document==='undefined')return;
  const result=document.querySelector('[data-subtitle-result]');if(result)result.hidden=true;
  const stats=document.querySelector('[data-subtitle-panel] .mt-poster-stats');if(stats)stats.hidden=true;
  const form=document.querySelector('[data-subtitle-form]');if(!form||typeof form.querySelector!=='function')return;
  for(const box of form.querySelectorAll('.mt-error'))box.hidden=true;
  const submit=form.querySelector('button[type=submit]');if(submit){submit.disabled=false;submit.textContent='검사하기';}
  const file=form.querySelector('[data-subtitle-file]'),drop=file?.closest('.mt-drop');if(!file||!drop)return;
  const name=subtitleLab.fileName,title=drop.querySelector('strong'),hint=drop.querySelector('small');
  file.disabled=false;if(!name)file.value='';drop.classList.remove('is-disabled');drop.classList.toggle('is-set',Boolean(name));
  if(title)title.textContent=name||subtitleDropTitle;if(hint)hint.textContent=name?`다른 파일을 고르면 바꿔요 · ${subtitleDropLimits}`:subtitleDropLimits;
}
if(typeof document!=='undefined'){
  document.addEventListener('input',event=>{
    const target=event.target;if(!target.matches?.('[data-subtitle-text],[data-subtitle-threshold]')||!subtitleLabIdentity())return;
    subtitleLab.request++;subtitleLab.busy=false;subtitleLab.error='';subtitleLab.report=null;
    if(target.matches('[data-subtitle-text]')){subtitleLab.text=target.value;subtitleLab.fileName='';}else subtitleLab[target.dataset.subtitleThreshold]=subtitleLabLimit(target.value);
    subtitleLabHideResult();
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
    try{
      const field=name=>form.elements?.namedItem?.(name)||form.elements?.[name]||null;
      subtitleLab.text=form.querySelector('[data-subtitle-text]').value;
      const cps=field('maxCps'),perLine=field('maxLine');if(cps)subtitleLab.maxCps=subtitleLabLimit(cps.value);if(perLine)subtitleLab.maxLine=subtitleLabLimit(perLine.value);
      subtitleLab.report=subtitleInspect(subtitleLab.text,{fileName:subtitleLab.fileName,maxCps:subtitleLab.maxCps,maxLine:subtitleLab.maxLine});
    }
    catch(error){subtitleLab.report=null;subtitleLab.error=error.message;if(!subtitleLabLimitsOk())subtitleLab.openOptions=true;}subtitleLabRender();
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
        catch{if(state.user?.id===userId&&request===subtitleLab.request&&typeof modal==='function')modal('읽기 원고','아래 글을 골라 복사해 주세요.',`<label class="field">복사할 원고<textarea rows="14" readonly>${subtitleEscape(subtitleTranscript(report))}</textarea></label>`,true);}
      }
    }catch(error){if(state.user?.id===userId&&request===subtitleLab.request){subtitleLab.error=error.message;subtitleLabRender();}}
  });
}
