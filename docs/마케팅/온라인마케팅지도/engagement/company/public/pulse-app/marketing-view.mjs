import {esc} from './api.mjs';
import {t,k,locale,intlLocale} from './i18n.mjs';
import {arrow} from './film-home.mjs';

// PULSE 고객 앱 「마케팅 성과」 칸(2026-11-16). 계약은 docs/마케팅/PULSE_마케팅성과_20261116/계약.md 한 곳이다.
// 직원이 올린 리포트 넷(이번 달 한 장 · AI 검색 노출 · 경쟁사 광고 · 표기와 규제 검수)을 고객이 읽기만 한다. 이 파일은 자료를 다듬고 그리기만 하고,
// 부르기 · 회차 고르기 · 다시 불러오기는 app.mjs가 맡는다(s.marketing). 스위치가 켜진 손님이 칸을 처음 열 때 app.mjs가 이 파일을 불러온다.
// 지킬 것: 모든 글은 받은 평문을 esc로만 넣는다. 바깥 링크는 광고 라이브러리 하나이고 id는 숫자만 받는다. 출처는 호스트 이름만 보이고 링크를 걸지 않는다.
// 순위 · 매출 · 노출을 약속하는 글을 쓰지 않는다. AI 서비스 이름은 받은 자료(services[].name)에만 있고 이 파일에는 적지 않는다.
// 그래프는 그래프 문법(docs/디자인/그래프_문법.md) — 0부터 세는 수는 빗금 막대(가는 사선 · 끝에만 단단한 선), 꽉 찬 둥근 막대는 쓰지 않는다.
// CSP style-src 'self'라 style 속성을 쓰지 않는다. 막대 길이는 SVG의 width 퍼센트로 준다(표현 속성이라 막히지 않는다).

export const MARKETING_ORDER=Object.freeze(['memo','ai-search','competitor-ads','label-review']);
// 판정 여섯(계약 label-review). 「해당 없음」 · 「확인 필요」는 의뢰서에도 있는 낱말이라 판정 문맥(verdict)으로 따로 옮긴다.
const VERDICTS=Object.freeze(['hit','check','ok','na','norecord','unread']);
const verdictLabel=v=>({hit:t('걸림',null,'verdict'),check:t('확인 필요',null,'verdict'),ok:t('문제없음',null,'verdict'),na:t('해당 없음',null,'verdict'),norecord:t('기록 없음',null,'verdict'),unread:t('원고를 읽지 못함',null,'verdict')})[v]||t('판정 없음',null,'verdict');
const SECTION_TITLE=Object.freeze({'ai-search':k('AI 검색 노출'),'competitor-ads':k('경쟁사 광고'),'label-review':k('표기와 규제 검수')});

// ── 자료 다듬기 ── 서버도 올릴 때 검사하지만, 화면은 꼴이 어긋난 칸을 버리고 길이를 다시 자른다.
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const str=(value,max=600)=>typeof value==='string'?value.replace(CONTROL,'').trim().slice(0,max):'';
const list=value=>Array.isArray(value)?value:[];
const count=value=>Number.isFinite(value)&&value>=0?Math.floor(value):0;
const idOk=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(value);
const hostOf=value=>{const host=str(value,253).toLowerCase();return /^[a-z0-9](?:[a-z0-9-]{0,62}\.)+[a-z0-9-]{1,63}$/.test(host)?host:'';};
const dateOk=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';
const isoOk=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:'';
function common(report){
  return {kind:report?.kind||'',runId:idOk(report?.runId)?report.runId:'',title:str(report?.title,120),from:isoOk(report?.measuredAt?.from),to:isoOk(report?.measuredAt?.to),notes:list(report?.notes).map(note=>str(note,400)).filter(Boolean).slice(0,8)};
}

export function memoModel(report){
  return {...common(report),headline:str(report?.headline,300),body:list(report?.body).map(text=>str(text,1600)).filter(Boolean).slice(0,8),next:list(report?.nextActions).map(text=>str(text,300)).filter(Boolean).slice(0,3)};
}

// AI 검색: 수는 모두 칸(cells)에서 센다 — 표와 큰 수가 늘 같은 칸에서 나온다. 답을 받지 못한 칸(answered false)은 분모에서 뺀다.
// 브랜드 이름이 든 질문(branded)은 따로 센다. 순위는 재지 않고 보이지 않는다.
export function aiSearchModel(report){
  const base=common(report),seenS=new Set(),seenQ=new Set();
  const services=list(report?.services).filter(item=>idOk(item?.id)&&!seenS.has(item.id)&&seenS.add(item.id)).map(item=>({id:item.id,name:str(item.name,60)||item.id,condition:str(item.condition,200)})).slice(0,12);
  const questions=list(report?.questions).filter(item=>idOk(item?.id)&&!seenQ.has(item.id)&&seenQ.add(item.id)).map(item=>({id:item.id,group:str(item.group,40),lang:str(item.lang,8).toLowerCase(),text:str(item.text,400),branded:item.branded===true})).filter(item=>item.text).slice(0,200);
  const qIds=new Set(questions.map(item=>item.id)),sIds=new Set(services.map(item=>item.id)),cells=new Map();
  for(const cell of list(report?.cells)){
    if(!qIds.has(cell?.q)||!sIds.has(cell?.s))continue;
    const key=cell.q+'\u0001'+cell.s;if(cells.has(key))continue;
    const answered=cell.answered!==false;
    cells.set(key,{answered,mentioned:answered&&cell.mentioned===true,cited:answered&&cell.cited===true,briefing:typeof cell.aiBriefing==='boolean'?cell.aiBriefing:null,sources:answered?[...new Set(list(cell.sources).map(hostOf).filter(Boolean))].slice(0,12):[],excerpt:answered?str(cell.excerpt,600):''});
  }
  const cellOf=(q,s)=>cells.get(q+'\u0001'+s)||null;
  const tally=(branded,service)=>{const out={asked:0,answered:0,mentioned:0,cited:0};for(const q of questions){if(q.branded!==branded)continue;for(const s of services){if(service&&s.id!==service)continue;const cell=cellOf(q.id,s.id);if(!cell)continue;out.asked++;if(!cell.answered)continue;out.answered++;if(cell.mentioned)out.mentioned++;if(cell.cited)out.cited++;}}return out;};
  const byService=services.map(s=>{const shown=questions.map(q=>cellOf(q.id,s.id)).filter(cell=>cell&&cell.answered&&cell.briefing!==null);return {...s,general:tally(false,s.id),branded:tally(true,s.id),none:questions.filter(q=>cellOf(q.id,s.id)?.answered===false).length,briefing:shown.length?{shown:shown.filter(cell=>cell.briefing).length,of:shown.length}:null};});
  // 출처 집계는 계약의 summary.topSources와 같은 정의로 칸에서 센다: 이름 없이 물은 질문(일반 칸)의 받은 답만, 한 칸 안에서는 한 번,
  // 건수가 많은 순 · 같으면 호스트 이름순 · 15곳까지. 이름을 넣어 물은 답의 출처는 이름 때문에 걸린 것이라 넣지 않는다.
  const sources=new Map();
  for(const q of questions){if(q.branded)continue;for(const s of services){const cell=cellOf(q.id,s.id);if(cell?.answered)for(const host of cell.sources)sources.set(host,(sources.get(host)||0)+1);}}
  const topSources=[...sources].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,15).map(([host,n])=>({host,count:n}));
  // 질문 묶음: 이름 없이 물은 질문을 먼저(묶음 이름이 처음 나온 차례대로), 이름을 넣은 질문을 뒤에.
  const groups=[];
  for(const branded of [false,true]){
    const mine=questions.filter(q=>q.branded===branded);if(!mine.length)continue;
    const names=[...new Set(mine.map(q=>q.group))];
    groups.push({branded,count:mine.length,parts:names.map(name=>({name,questions:mine.filter(q=>q.group===name)}))});
  }
  const subject={brand:str(report?.subject?.brand,60),site:hostOf(report?.subject?.site)};
  return {...base,subject,services,questions,groups,cellOf,general:tally(false,''),branded:tally(true,''),byService,topSources,empty:!cells.size};
}

// 경쟁사 광고: 광고는 오래 켜 둔 것부터(시작일이 앞선 것부터). 「n일째」는 잰 날을 첫날 다음으로 센다. 믿기 어려운 수(reliable false)는 막대를 그리지 않는다.
const dayNo=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return m?Date.UTC(+m[1],+m[2]-1,+m[3])/864e5:NaN;};
const localDayNo=iso=>{const date=new Date(iso);return Number.isFinite(date.getTime())?Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/864e5:NaN;};
function adOf(item,measuredDay){
  if(!item||typeof item!=='object')return null;
  const startedAt=dateOk(item.startedAt),days=startedAt&&Number.isFinite(measuredDay)?measuredDay-dayNo(startedAt)+1:NaN;
  return {id:typeof item.id==='string'&&/^\d{1,30}$/.test(item.id)?item.id:'',startedAt,days:Number.isFinite(days)&&days>=1?days:0,advertiser:str(item.advertiser,120),text:str(item.text,400),multiVariant:item.multiVariant===true};
}
const byStart=(a,b)=>(a.startedAt||'9999')<(b.startedAt||'9999')?-1:(a.startedAt||'9999')>(b.startedAt||'9999')?1:0;
export function competitorModel(report){
  const base=common(report),measuredDay=localDayNo(base.to||base.from);
  const ads=value=>list(value).map(item=>adOf(item,measuredDay)).filter(Boolean).sort(byStart).slice(0,400);
  const competitors=list(report?.competitors).filter(item=>item&&typeof item==='object').map(item=>({name:str(item.name,80)||str(item.query,80),query:str(item.query,80),resultLabel:str(item.resultLabel,40),read:count(item.read),own:count(item.own),reliable:item.reliable===true,note:str(item.note,400),ads:ads(item.ads)})).filter(item=>item.name).slice(0,20);
  const sure=competitors.filter(item=>item.reliable).sort((a,b)=>b.own-a.own),unsure=competitors.filter(item=>!item.reliable);
  const changes=report?.changes&&typeof report.changes==='object'?{since:idOk(report.changes.since)?report.changes.since:'',started:ads(report.changes.started),stopped:ads(report.changes.stopped).map(ad=>({...ad,days:0,ended:true})),longRunning:ads(report.changes.longRunning)}:null;
  return {...base,method:str(report?.method,240),competitors:[...sure,...unsure],max:Math.max(0,...sure.map(item=>item.own)),changes};
}

// 표기와 규제 검수: 판정은 점검표 차례대로다. 수는 판정 칸에서 센다(요약 칸과 같은 뜻 — 칸의 수).
export function labelModel(report){
  const base=common(report),seen=new Set();
  // 판정(verdicts)은 점검표의 원래 차례로 온다. 걸러진 줄이 있어도 남은 칸은 원래 자리(at)의 판정을 읽는다(최종 검수 11-16).
  const checklist=list(report?.checklist).map((item,at)=>({item,at})).filter(({item})=>Number.isInteger(item?.id)&&!seen.has(item.id)&&seen.add(item.id)).map(({item,at})=>({id:item.id,title:str(item.title,120)||String(item.id),at})).slice(0,12);
  const titleOf=id=>checklist.find(item=>item.id===id)?.title||'';
  const items=list(report?.items).filter(item=>item&&typeof item==='object').map(item=>({title:str(item.title,160),venue:str(item.venue,80),publishedAt:str(item.publishedAt,60),verdicts:checklist.map(c=>VERDICTS.includes(item.verdicts?.[c.at])?item.verdicts[c.at]:''),findings:list(item.findings).map(f=>({check:Number.isInteger(f?.check)?f.check:0,verdict:VERDICTS.includes(f?.verdict)?f.verdict:'',quote:str(f?.quote,500),why:str(f?.why,500)})).filter(f=>f.quote||f.why).map(f=>({...f,title:titleOf(f.check)})).sort((a,b)=>a.check-b.check)})).filter(item=>item.title).slice(0,200);
  const counts=Object.fromEntries(VERDICTS.map(v=>[v,0]));
  for(const item of items)for(const v of item.verdicts)if(v)counts[v]++;
  return {...base,checklist,items,counts,flagged:items.filter(item=>item.verdicts.some(v=>v==='hit'||v==='check')).length};
}

// ── 그리기 도우미 ──
const fmt=value=>new Intl.NumberFormat(intlLocale(locale())).format(value);
const pad=value=>String(value).padStart(2,'0');
const dayText=iso=>{const date=new Date(iso);if(!Number.isFinite(date.getTime()))return '';return new Intl.DateTimeFormat(intlLocale(locale()),{...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{}),month:'long',day:'numeric'}).format(date);};
const plainDay=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!m)return value;const date=new Date(+m[1],+m[2]-1,+m[3]);return new Intl.DateTimeFormat(intlLocale(locale()),{...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{}),month:'long',day:'numeric'}).format(date);};
// 잰 때: 같은 날이면 「11월 16일 오전 5:29 ~ 6:33」, 날이 다르면 「11월 15일 ~ 11월 16일」.
function measured(from,to){
  const a=new Date(from||to),b=new Date(to||from);if(!Number.isFinite(a.getTime()))return '';
  const loc=intlLocale(locale()),same=Number.isFinite(b.getTime())&&a.toDateString()===b.toDateString();
  const time=date=>new Intl.DateTimeFormat(loc,{hour:'numeric',minute:'2-digit'}).format(date);
  if(!Number.isFinite(b.getTime())||same)return `${dayText(a.toISOString())} ${time(a)}${same&&b.getTime()!==a.getTime()?` ~ ${time(b)}`:''}`;
  return `${dayText(a.toISOString())} ~ ${dayText(b.toISOString())}`;
}
const notesOf=notes=>notes.length?`<ul class="sx-mk-notes sx-small" aria-label="${esc(t('읽을 때 알아 둘 것'))}">${notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:'';
// 빗금 막대 하나(0부터 세는 수). on이면 잉크 빛 사선(뜻이 있는 줄 하나에만), 아니면 옅은 사선. 값이 0이면 바닥 선만 남는다.
function bar(value,max,{on=false}={}){
  const w=max>0?Math.max(0,Math.min(100,value/max*100)):0,x=w.toFixed(2);
  return `<svg class="sx-mk-bar${on?' is-on':''}" aria-hidden="true" focusable="false"><rect class="sx-mk-bar-base" x="0" y="9" width="100%" height="1"/>${w>0?`<rect class="sx-mk-bar-fill" x="0" y="0" width="${x}%" height="10"/><rect class="sx-mk-bar-end" x="${x}%" y="0" width="1.5" height="10"/>`:''}</svg>`;
}
const HATCH=`<svg class="sx-mk-defs" aria-hidden="true" focusable="false" width="0" height="0"><defs><pattern id="sx-mk-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="sx-mk-hatch-line" width="1.3" height="5"/></pattern><pattern id="sx-mk-hatch-on" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="sx-mk-hatch-line is-on" width="1.3" height="5"/></pattern></defs></svg>`;
const runKey=(kind,run)=>kind+'\u0001'+run;
function runPicker(m,kind){
  const runs=m.heads.filter(head=>head.kind===kind);if(runs.length<2)return '';
  return `<label class="sx-mk-run sx-small"><span>${esc(t('회차'))}</span><select data-mk-run="${esc(kind)}">${runs.map(head=>`<option value="${esc(head.runId)}"${head.runId===m.picks[kind]?' selected':''}>${esc(head.title||head.runId)}${head.to||head.from?` · ${esc(dayText(head.to||head.from))}`:''}</option>`).join('')}</select></label>`;
}
// 리포트 한 건의 상태: 기다림 · 못 불러옴 · 찾지 못함. 그린 글이 있으면 빈 글자다.
function waitOf(entry,kind){
  if(!entry||entry.status==='loading')return `<p class="sx-small sx-mk-wait" role="status">${esc(t('리포트를 불러오고 있어요.'))}</p>`;
  if(entry.status==='error')return `<p class="sx-small sx-mk-fail" role="alert">${esc(t('이 리포트를 불러오지 못했어요.'))} <button type="button" class="sx-link" data-mk-do="retry" data-kind="${esc(kind)}">${esc(t('다시 불러오기'))}</button></p>`;
  if(entry.status==='missing')return `<p class="sx-small sx-mk-fail">${esc(t('이 회차의 리포트를 찾지 못했어요.'))}</p>`;
  return '';
}

// ── 이번 달 한 장 ──
function memoPart(m,sections){
  const head=m.heads.find(item=>item.kind==='memo'&&item.runId===m.picks.memo),entry=head?m.reports[runKey('memo',head.runId)]:null;
  const ready=entry?.status==='ready'?memoModel(entry.report):null;
  const toc=sections.length?`<aside class="sx-mk-toc" aria-labelledby="mk-toc-title"><h2 class="sx-small sx-mk-label" id="mk-toc-title">${esc(t('이번 회차에 잰 것'))}</h2><ol>${sections.map(({head:item},i)=>`<li><button type="button" class="sx-mk-toc-row" data-mk-jump="${esc(item.kind)}"><span class="sx-no">${pad(i+1)}</span><span class="sx-mk-toc-what"><b>${esc(item.title||t(SECTION_TITLE[item.kind]))}</b>${item.summaryLine?`<span class="sx-small">${esc(item.summaryLine)}</span>`:''}${item.to||item.from?`<span class="sx-small sx-mk-toc-when">${esc(measured(item.from,item.to))}</span>`:''}</span></button></li>`).join('')}</ol></aside>`:'';
  let main;
  if(ready&&ready.headline)main=`<p class="sx-small sx-mk-memo-when">${esc(ready.title||head.title)}${ready.from||ready.to?` · ${esc(t('{when}에 잰 것',{when:measured(ready.from,ready.to)}))}`:''}</p><h1 class="sx-display sx-mk-headline" data-room-title>${esc(ready.headline)}</h1>${ready.body.length?`<div class="sx-mk-memo-body">${ready.body.map(text=>`<p class="sx-body">${esc(text)}</p>`).join('')}</div>`:''}${ready.next.length?`<div class="sx-mk-next"><h2 class="sx-small sx-mk-label">${esc(t('다음 달에 할 일'))}</h2><ol>${ready.next.map((text,i)=>`<li><span class="sx-no">${pad(i+1)}</span><span class="sx-body">${esc(text)}</span></li>`).join('')}</ol></div>`:''}${notesOf(ready.notes)}`;
  else if(head)main=`<p class="sx-small sx-mk-memo-when">${esc(head.title)}</p><h1 class="sx-display sx-mk-headline" data-room-title>${esc(head.summaryLine||t('이번 달 한 장'))}</h1>${waitOf(entry,'memo')}`;
  else main=`<h1 class="sx-display sx-mk-headline" data-room-title>${esc(t('이번 회차에 잰 것이에요'))}</h1>`;
  return `<section class="sx-mk-memo" id="mk-memo" data-room-in><div class="sx-mk-memo-main">${main}</div>${toc}</section>`;
}

// ── AI 검색 노출 ──
// 칸 표시 넷: 이름이 나오고 출처로 링크까지 · 이름만 · 나오지 않음 · 답 없음. 글은 표시 곁과 화면 읽기 글로 같이 둔다.
const CELL_LABEL=Object.freeze({cited:k('출처 링크까지'),mentioned:k('이름이 나옴'),no:k('나오지 않음'),none:k('답 없음')});
// 칸 표시는 이름이 나왔는지(mentioned)로 먼저 가른다 — 큰 수 · 서비스 표와 같은 정의다. 이름 없이 출처 링크만 단 칸은 「나오지 않음」으로 두고 글로 링크를 밝힌다(카본 검수 11-16).
const cellKind=cell=>!cell?'':!cell.answered?'none':cell.mentioned?(cell.cited?'cited':'mentioned'):'no';
const mark=kind=>kind?`<i class="sx-mk-m is-${kind}" aria-hidden="true"></i>`:'<i class="sx-mk-m" aria-hidden="true"></i>';
function cellStatus(cell){
  if(!cell.answered)return t('답을 받지 못했어요');
  if(!cell.mentioned)return cell.cited?t('이름은 나오지 않았고 출처로 링크만 달았어요'):t('이름이 나오지 않았어요');
  return cell.cited?t('이름이 나왔고 출처로 링크를 달았어요'):t('이름이 나왔어요');
}
// 칸의 펼침(details)은 문서 안 순번이 아니라 열쇠(data-mk-key: 종류|회차|무엇)로 기억한다 — 위 칸이 줄거나 늦게 와도 연 목록이 그대로다(최종 검수 11-16).
// 열림은 app.mjs가 s.marketing.open(Set)에 적고, 그릴 때 여기서 open으로 넣는다. render의 순번 복원은 이 열쇠가 있는 details를 건너뛴다.
const details=(cls,key,ctx)=>`<details class="${cls}" data-mk-key="${esc(key)}"${ctx?.open?.has(key)?' open':''}>`;
function questionRow(a,q,ctx){
  const kinds=a.services.map(s=>cellKind(a.cellOf(q.id,s.id))),named=kinds.filter(kind=>kind==='cited'||kind==='mentioned').length,none=kinds.filter(kind=>kind==='none').length,asked=kinds.filter(Boolean).length;
  const tally=`${t('{count}곳 가운데 이름이 나온 곳 {named}',{count:asked,named})}${none?` · ${t('답 없음 {count}',{count:none})}`:''}`;
  const answers=a.services.map(s=>{const cell=a.cellOf(q.id,s.id);if(!cell)return '';return `<li class="sx-mk-ans"><p class="sx-mk-ans-head">${mark(cellKind(cell))}<b>${esc(s.name)}</b><span class="sx-small">${esc(cellStatus(cell))}${cell.briefing===null?'':` · ${esc(cell.briefing?t('AI 브리핑이 떴어요'):t('AI 브리핑이 뜨지 않았어요'))}`}</span></p>${cell.excerpt?`<blockquote class="sx-mk-quote"><p class="sx-small sx-mk-quote-label">${esc(t('답의 앞부분'))}</p><p>${esc(cell.excerpt)}</p></blockquote>`:''}${cell.sources.length?`<p class="sx-small sx-mk-hosts"><span>${esc(t('출처로 단 곳'))}</span> ${cell.sources.map(host=>`<span class="sx-mk-host">${esc(host)}</span>`).join(' ')}</p>`:''}</li>`;}).join('');
  return `${details('sx-mk-q',`ai-search|${ctx?.run||''}|q|${q.id}`,ctx)}<summary class="sx-mk-q-row"><span class="sx-no">${esc(q.id)}</span><span class="sx-mk-q-text">${esc(q.text)}${q.lang&&q.lang!=='ko'?` <span class="sx-mk-tag sx-small">${esc(q.lang==='en'?t('영어로 물음'):q.lang)}</span>`:''}<span class="sx-small sx-mk-q-tally" aria-hidden="true">${esc(tally)}</span></span><span class="sx-mk-q-marks">${kinds.map(kind=>`<span>${mark(kind)}</span>`).join('')}</span><span class="sx-mk-plus" aria-hidden="true"></span><span class="sr">${esc(tally)}</span></summary><ul class="sx-mk-answers">${answers}</ul></details>`;
}
function aiSearchBody(a,ctx){
  if(a.empty)return `<p class="sx-small">${esc(t('이 리포트에는 잰 칸이 없어요.'))}</p>`;
  const brand=a.subject.brand||t('브랜드'),site=a.subject.site||brand,g=a.general,b=a.branded;
  const fig=`<div class="sx-mk-fig"><p class="sx-mk-big" aria-hidden="true">${esc(fmt(g.mentioned))}</p><div class="sx-mk-fig-text"><p class="sx-small sx-mk-label">${esc(t('브랜드 이름 없이 물은 질문'))}</p><p class="sx-mk-fig-lead"><span class="sr">${esc(fmt(g.mentioned))} </span>${esc(t('받은 답 {answered}건 가운데 {brand} 이름이 나온 답이에요.',{answered:fmt(g.answered),brand,count:g.mentioned}))}</p><p class="sx-small">${esc(t('출처로 {site} 링크를 단 답 {cited}건',{site,cited:fmt(g.cited),count:g.cited}))}${g.asked>g.answered?` · ${esc(t('답을 받지 못한 {count}건은 세지 않았어요.',{count:g.asked-g.answered}))}`:''}</p></div></div>`;
  const contrast=b.asked?`<p class="sx-body sx-mk-contrast">${esc(t('이름을 넣어 물으면 받은 답 {answered}건 가운데 {mentioned}건에 나왔고, {cited}건이 출처로 {site} 링크를 달았어요.',{answered:fmt(b.answered),mentioned:fmt(b.mentioned),cited:fmt(b.cited),site,count:b.answered}))}</p>`:'';
  const maxRate=1;
  const rows=a.byService.map(s=>{const rate=s.general.answered?s.general.mentioned/s.general.answered:0;return `<tr><th scope="row"><b>${esc(s.name)}</b>${s.condition?`<span class="sx-small">${esc(s.condition)}</span>`:''}${s.briefing?`<span class="sx-small sx-mk-brief">${esc(t('AI 브리핑이 뜬 답 {shown} / {of}',{shown:fmt(s.briefing.shown),of:fmt(s.briefing.of)}))}</span>`:''}</th><td data-label="${esc(t('이름 없이 물은 질문'))}"><span class="sx-mk-frac"><b>${esc(fmt(s.general.mentioned))}</b> / ${esc(fmt(s.general.answered))}</span>${bar(rate,maxRate,{on:rate>0})}</td><td data-label="${esc(t('출처 링크'))}"><span class="sx-mk-frac"><b>${esc(fmt(s.general.cited))}</b></span></td><td data-label="${esc(t('이름을 넣은 질문'))}"><span class="sx-mk-frac"><b>${esc(fmt(s.branded.mentioned))}</b> / ${esc(fmt(s.branded.answered))}</span><span class="sx-small">${esc(t('출처 링크 {count}',{count:fmt(s.branded.cited)}))}</span></td><td data-label="${esc(t('답 없음'))}"><span class="sx-mk-frac${s.none?'':' is-zero'}">${esc(fmt(s.none))}</span></td></tr>`;}).join('');
  const table=`<div class="sx-mk-block"><h3 class="sx-mk-h3">${esc(t('서비스마다'))}</h3><table class="sx-mk-table sx-mk-services"><thead><tr><th scope="col">${esc(t('서비스'))}</th><th scope="col">${esc(t('이름 없이 물은 질문'))}</th><th scope="col">${esc(t('출처 링크'))}</th><th scope="col">${esc(t('이름을 넣은 질문'))}</th><th scope="col">${esc(t('답 없음'))}</th></tr></thead><tbody>${rows}</tbody></table><p class="sx-small sx-mk-foot">${esc(t('나온 답 / 받은 답이에요. 답을 받지 못한 칸은 「답 없음」으로 따로 셌어요.'))}</p></div>`;
  const legend=`<ul class="sx-mk-legend sx-small" aria-label="${esc(t('표시 읽는 법'))}">${Object.entries(CELL_LABEL).map(([kind,label])=>`<li>${mark(kind)}${esc(t(label))}</li>`).join('')}</ul>`;
  const head=`<div class="sx-mk-q-head" aria-hidden="true"><span></span><span></span><span class="sx-mk-q-marks">${a.services.map(s=>`<span class="sx-mk-q-name">${esc(s.name)}</span>`).join('')}</span><span></span></div>`;
  const groups=a.groups.map(group=>`<div class="sx-mk-qgroup"><h4 class="sx-mk-qgroup-title sx-small">${esc(group.branded?t('브랜드 이름을 넣은 질문 {count}개',{count:group.count}):t('브랜드 이름 없이 물은 질문 {count}개',{count:group.count}))}</h4>${group.parts.map(part=>`${part.name&&group.parts.length>1?`<p class="sx-mk-qpart sx-no sx-ko">${esc(part.name)}</p>`:''}${part.questions.map(q=>questionRow(a,q,ctx)).join('')}`).join('')}</div>`).join('');
  const questions=`<div class="sx-mk-block"><div class="sx-mk-block-head"><h3 class="sx-mk-h3">${esc(t('질문마다 받은 답'))}</h3>${legend}</div><div class="sx-mk-qs" data-n="${a.services.length}">${head}${groups}</div></div>`;
  const top=a.topSources.length?a.topSources[0].count:0;
  const sources=a.topSources.length?`<div class="sx-mk-block"><h3 class="sx-mk-h3">${esc(t('답에 자주 걸린 출처'))}</h3><ol class="sx-mk-bars">${a.topSources.map(item=>`<li class="${item.host===a.subject.site?'is-on':''}"><span class="sx-mk-bars-name">${esc(item.host)}</span>${bar(item.count,top,{on:item.host===a.subject.site})}<span class="sx-mk-bars-no">${esc(fmt(item.count))}</span></li>`).join('')}</ol><p class="sx-small sx-mk-foot">${esc(t('브랜드 이름 없이 물은 질문의 답에 출처로 걸린 횟수예요. 한 답에 같은 곳이 여러 번 걸려도 한 번으로 셌어요.'))}</p></div>`:'';
  return fig+contrast+table+questions+sources;
}

// ── 경쟁사 광고 ──
const LIBRARY='https://www.facebook.com/ads/library/?id=';
// 끈 광고(changes.stopped)는 「{date}부터 · n일째」 대신 「{date}에 시작」만 쓴다 — 리포트에 끈 날이 없어 며칠 켜졌는지 모른다(카본 검수 11-16).
function adRow(ad,{who=''}={}){
  const other=ad.advertiser&&ad.advertiser!==who;
  return `<li class="sx-mk-ad"><p class="sx-mk-ad-when sx-small">${ad.startedAt?`<span>${esc(ad.ended?t('{date}에 시작',{date:plainDay(ad.startedAt)}):t('{date}부터',{date:plainDay(ad.startedAt)}))}</span>`:''}${ad.days?`<span class="sx-no sx-ko">${esc(t('{days}일째',{days:fmt(ad.days),count:ad.days}))}</span>`:''}</p><div class="sx-mk-ad-body">${ad.text?`<p class="sx-mk-ad-text">${esc(ad.text)}</p>`:''}<p class="sx-small sx-mk-ad-meta">${other?`<span>${esc(t('광고주 {name}',{name:ad.advertiser}))}</span>`:''}${ad.multiVariant?`<span>${esc(t('판 여럿'))}</span>`:''}${ad.id?`<a class="sx-link" href="${LIBRARY}${ad.id}" target="_blank" rel="noopener noreferrer">${esc(t('광고 라이브러리에서 보기'))}<span class="sr"> ${esc(t('(새 탭)'))}</span></a>`:''}</p></div></li>`;
}
const SHOWN_ADS=8;
function adList(ads,who,ctx,key){
  if(!ads.length)return '';
  const first=ads.slice(0,SHOWN_ADS),rest=ads.slice(SHOWN_ADS);
  return `${details('sx-mk-ads',key,ctx)}<summary class="sx-small"><span class="sx-mk-plus" aria-hidden="true"></span>${esc(t('광고 {count}건 보기',{count:ads.length}))} · ${esc(t('오래 켜 둔 광고부터'))}</summary><ol>${first.map(ad=>adRow(ad,{who})).join('')}</ol>${rest.length?`${details('sx-mk-ads is-rest',key+'|rest',ctx)}<summary class="sx-small"><span class="sx-mk-plus" aria-hidden="true"></span>${esc(t('나머지 {count}건',{count:rest.length}))}</summary><ol>${rest.map(ad=>adRow(ad,{who})).join('')}</ol></details>`:''}</details>`;
}
function competitorBody(c,ctx={}){
  const heads=ctx.heads||[];
  const rows=c.competitors.map((item,index)=>`<li class="sx-mk-co${item.reliable?'':' is-unsure'}"><div class="sx-mk-co-row"><p class="sx-mk-co-name sx-serif">${esc(item.name)}</p>${item.reliable?`${bar(item.own,c.max)}<p class="sx-mk-co-no"><b>${esc(fmt(item.own))}</b></p>`:`<p class="sx-small sx-mk-co-unsure">${esc(item.note||t('이 수는 그대로 믿기 어려워 막대로 그리지 않았어요.'))}</p>`}</div><p class="sx-small sx-mk-co-meta">${item.reliable?`<span>${esc(t('읽은 광고 가운데 {name} 광고',{name:item.name}))}</span>`:''}${item.resultLabel?`<span>${esc(t('라이브러리 표시 {label}',{label:item.resultLabel}))}</span>`:''}<span>${esc(t('읽은 카드 {count}장',{count:fmt(item.read)}))}</span>${item.reliable?'':`<span>${esc(t('그 이름의 광고 {count}건',{count:fmt(item.own)}))}</span>`}</p>${item.reliable&&item.note?`<p class="sx-small sx-mk-co-note">${esc(item.note)}</p>`:''}${adList(item.ads,item.query||item.name,ctx,`competitor-ads|${ctx.run||''}|co|${index}`)}</li>`).join('');
  // 앞 회차의 이름: 목록(heads)에 그 회차가 남아 있으면 그 제목, 없으면 「앞 회차」. 회차 번호(runId)는 내부 값이라 보이지 않는다(카본 검수 11-16).
  const sinceTitle=c.changes?.since?heads.find(head=>head.kind==='competitor-ads'&&head.runId===c.changes.since)?.title||'':'';
  const changes=c.changes?`<div class="sx-mk-block"><h3 class="sx-mk-h3">${esc(sinceTitle?t('「{title}」 뒤에 달라진 것',{title:sinceTitle}):t('앞 회차 뒤에 달라진 것'))}</h3><div class="sx-mk-changes">${[['started',t('새로 켠 광고')],['stopped',t('끈 광고')],['longRunning',t('오래 켜 둔 광고')]].map(([key,label])=>`<section><h4 class="sx-small sx-mk-label">${esc(label)} <span class="sx-no">${esc(fmt(c.changes[key].length))}</span></h4>${c.changes[key].length?`<ol>${c.changes[key].slice(0,SHOWN_ADS).map(ad=>adRow(ad)).join('')}</ol>${c.changes[key].length>SHOWN_ADS?`${details('sx-mk-ads is-rest',`competitor-ads|${ctx.run||''}|changes|${key}`,ctx)}<summary class="sx-small"><span class="sx-mk-plus" aria-hidden="true"></span>${esc(t('나머지 {count}건',{count:c.changes[key].length-SHOWN_ADS}))}</summary><ol>${c.changes[key].slice(SHOWN_ADS).map(ad=>adRow(ad)).join('')}</ol></details>`:''}`:`<p class="sx-small">${esc(t('없어요'))}</p>`}</section>`).join('')}</div></div>`:'';
  return `${c.method?`<p class="sx-small sx-mk-method"><span>${esc(t('읽은 곳'))}</span> ${esc(c.method)}</p>`:''}<div class="sx-mk-block"><h3 class="sx-mk-h3">${esc(t('읽은 광고 가운데 그 회사 광고'))}</h3>${rows?`<ol class="sx-mk-cos">${rows}</ol>`:`<p class="sx-small">${esc(t('이 리포트에는 경쟁사가 없어요.'))}</p>`}</div>${changes}`;
}

// ── 표기와 규제 검수 ──
const verdictMark=v=>`<i class="sx-mk-v is-${esc(v||'blank')}" aria-hidden="true"></i>`;
function labelBody(l){
  if(!l.checklist.length||!l.items.length)return `<p class="sx-small">${esc(t('이 리포트에는 본 영상이 없어요.'))}</p>`;
  const tally=`<p class="sx-body sx-mk-label-lead">${esc(t('{items}편을 점검표 {checks}칸으로 봤어요.',{items:fmt(l.items.length),checks:fmt(l.checklist.length),count:l.items.length}))}${l.flagged?` ${esc(t('확인할 것이 있는 영상은 {count}편이에요.',{count:l.flagged}))}`:''}</p><ul class="sx-mk-legend sx-small sx-mk-verdicts" aria-label="${esc(t('판정 읽는 법'))}">${VERDICTS.map(v=>`<li>${verdictMark(v)}${esc(verdictLabel(v))} <span class="sx-no">${esc(fmt(l.counts[v]))}</span></li>`).join('')}</ul>`;
  const checks=`<ol class="sx-mk-checks sx-small" aria-label="${esc(t('점검표'))}">${l.checklist.map((c,i)=>`<li><span class="sx-no">${i+1}</span>${esc(c.title)}</li>`).join('')}</ol>`;
  const span=l.checklist.length+1;
  const rows=l.items.map(item=>`<tr class="sx-mk-item${item.findings.length?' has-findings':''}"><th scope="row"><b>${esc(item.title)}</b>${item.venue||item.publishedAt?`<span class="sx-small">${esc([item.venue,item.publishedAt].filter(Boolean).join(' · '))}</span>`:''}</th>${item.verdicts.map((v,i)=>`<td>${verdictMark(v)}<span class="sr">${esc(l.checklist[i].title)}: ${esc(verdictLabel(v))}</span></td>`).join('')}</tr>${item.findings.length?`<tr class="sx-mk-findings"><td colspan="${span}"><ul>${item.findings.map(f=>`<li>${verdictMark(f.verdict)}<p class="sx-small sx-mk-finding-head">${f.check?`<span class="sx-no">${esc(String(f.check))}</span> `:''}${esc(f.title)}${f.verdict?` · ${esc(verdictLabel(f.verdict))}`:''}</p>${f.quote?`<p class="sx-mk-finding-quote">${esc(f.quote)}</p>`:''}${f.why?`<p class="sx-small">${esc(f.why)}</p>`:''}</li>`).join('')}</ul></td></tr>`:''}`).join('');
  return `${tally}${checks}<div class="sx-mk-scroll"><table class="sx-mk-table sx-mk-review"><thead><tr><th scope="col">${esc(t('영상'))}</th>${l.checklist.map((c,i)=>`<th scope="col" class="sx-mk-col"><span aria-hidden="true">${i+1}</span><span class="sr">${esc(c.title)}</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

const BODY={'ai-search':(report,ctx)=>aiSearchBody(aiSearchModel(report),ctx),'competitor-ads':(report,ctx)=>competitorBody(competitorModel(report),ctx),'label-review':report=>labelBody(labelModel(report))};
function sectionOf(m,{head},i){
  const kind=head.kind,entry=m.reports[runKey(kind,head.runId)],report=entry?.status==='ready'?entry.report:null,base=report?common(report):null;
  const when=base&&(base.from||base.to)?measured(base.from,base.to):head.from||head.to?measured(head.from,head.to):'';
  const tag=kind==='competitor-ads'&&report?(report.changes&&typeof report.changes==='object'?'':t('첫 기록')):'';
  return `<section class="sx-mk-sec" id="mk-${esc(kind)}" data-kind="${esc(kind)}" aria-labelledby="mk-${esc(kind)}-title" data-room-in><p class="sx-no sx-mk-sec-no" aria-hidden="true">${pad(i+1)}</p><div class="sx-mk-sec-body"><header class="sx-mk-sec-head"><div><h2 class="sx-serif" id="mk-${esc(kind)}-title">${esc(t(SECTION_TITLE[kind]))}</h2><p class="sx-small sx-mk-sec-meta">${esc((base?.title||head.title)||'')}${when?` · ${esc(t('{when}에 잰 것',{when}))}`:''}${tag?` · <span class="sx-mk-tag">${esc(tag)}</span>`:''}</p></div>${runPicker(m,kind)}</header>${report?`${notesOf(base.notes)}${BODY[kind](report,{open:m.open instanceof Set?m.open:null,run:head.runId,heads:m.heads})}`:waitOf(entry,kind)}</div></section>`;
}

// 칸 전체. m은 app.mjs의 s.marketing({status, heads, picks, reports}). 끝까지 순수 — 같은 상태면 같은 글자다.
export function marketingScreen(m){
  const page=inner=>`<div class="sx-mk-page">${inner}</div>`;
  const kicker=`<p class="sx-kicker sx-mk-kicker">${esc(t('마케팅 성과'))}</p>`;
  if(!m||m.status==='loading'||m.status==='idle')return page(`${kicker}<p class="sx-small sx-mk-wait" role="status">${esc(t('리포트를 불러오고 있어요.'))}</p>`);
  if(m.status==='error')return page(`${kicker}<h1 class="sx-display sx-mk-headline" data-room-title>${esc(t('리포트를 불러오지 못했어요'))}</h1><p class="sx-body sx-mk-lead">${esc(t('인터넷 연결을 확인한 뒤 다시 불러와 주세요.'))}</p><div class="sx-mk-act"><button type="button" class="sx-go is-solid" data-mk-do="retry"><span>${esc(t('다시 불러오기'))}</span>${arrow}</button></div>`);
  if(!m.heads.length)return page(`${kicker}<h1 class="sx-display sx-mk-headline" data-room-title>${esc(t('아직 잰 것이 없어요'))}</h1><p class="sx-body sx-mk-lead">${esc(t('첫 회차를 재면 이번 달 한 장과 함께 AI 검색 노출, 경쟁사 광고, 표기와 규제 검수 리포트가 여기에 올라와요.'))}</p><div class="sx-mk-act"><button type="button" class="sx-go" data-room-go="room"><span>${esc(t('고객 방으로'))}</span>${arrow}</button></div>`);
  const sections=MARKETING_ORDER.slice(1).map(kind=>({head:m.heads.find(item=>item.kind===kind&&item.runId===m.picks[kind])})).filter(item=>item.head);
  return `${HATCH}${page(`<header class="sx-mk-top">${kicker}${runPicker(m,'memo')}</header>${memoPart(m,sections)}${sections.map((item,i)=>sectionOf(m,item,i)).join('')}`)}`;
}
