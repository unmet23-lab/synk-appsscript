'use strict';
// 제작 도구 8탭의 공통 틀 — 시그널 13판(2026-10-20). 위 절반은 탭들이 같이 쓰는 그리기 도우미(순수 함수)이고,
// 시험은 아래 「상태와 화면 바꾸기」 표시줄(줄 머리의 주석) 앞까지만 잘라 읽는다. 글은 escape로 넣고, attrs·body·actions처럼 HTML을 받는 칸은 부르는 쪽이 만든다.
// 탭 성격대로: desk = A 목록+상세(머리 오른쪽 계기판, 포스터는 상세의 「지금 할 일」) · board = B 먼저 할 일 판 · sheet = 도구 한 장(번호 구역만).
// 끝의 제작 상황판 · 문의 접수(관리자만)는 사업 자동화(10-21 origin aa3224719)가 더한 탭이다 — 화면은 아직 그 판 그대로라 목록 끝에 두고, 13판 문법으로 다시 그리는 것은 후속이다.
const mtTools=[['publication','게시 준비·성과','desk'],['weekly','주간 정리','board'],['automation','자동화 상태','board'],['publish','게시 전 점검','desk'],['subtitles','자막 검사','sheet'],['sources','승인 제작 자료','sheet'],['brand','브랜드 제작실','desk'],['quality','품질·운영 확인','desk'],['productions','제작 상황판','sheet'],['inquiries','문의 접수','sheet']];
const mtSvg=(body,width='2')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const mtIcons={
  refresh:mtSvg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  search:mtSvg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  upload:mtSvg('<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>','1.8'),
  download:mtSvg('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>','1.8'),
  close:mtSvg('<path d="M6 6l12 12M18 6 6 18"/>'),
  check:mtSvg('<path d="m5 12.5 4.2 4.2L19 7"/>','2.6'),
  file:mtSvg('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>','1.8'),
  image:mtSvg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>','1.8'),
  plus:mtSvg('<path d="M12 5v14M5 12h14"/>'),
  arrow:mtSvg('<path d="M5 12h14M13 6l6 6-6 6"/>','2.4'),
  back:mtSvg('<path d="M19 12H5M11 6l-6 6 6 6"/>','2.2'),
};
function mtIcon(name){return mtIcons[name]||'';}
function mtToolLabel(tool){return (mtTools.find(row=>row[0]===tool)||[])[1]||'';}
const mtFeltTools=['publication','weekly','automation','publish','subtitles','sources','brand','quality'];
function mtFelt(tool){return mtFeltTools.includes(tool)?`/messenger/assets/maker-felt-${tool}.webp`:'';}
function mtNum(value){if(value===null||value===undefined||value==='')return '—';const number=Number(value);return typeof value!=='boolean'&&Number.isFinite(number)?number.toLocaleString('ko-KR'):String(value);}
function mtTone(tone){return ['alert','wait','ok','info','off'].includes(tone)?tone:'';}
function mtBadge(text,tone=''){return text?`<span class="mt-badge"${mtTone(tone)?` data-tone="${mtTone(tone)}"`:''}>${escape(text)}</span>`:'';}
function mtLed(tone='',label=''){return `<span class="mt-led"${mtTone(tone)?` data-tone="${mtTone(tone)}"`:''}${label?` role="img" aria-label="${escape(label)}"`:' aria-hidden="true"'}></span>`;}
function mtGlyphs(names){const list=(Array.isArray(names)?names:[names]).filter(Boolean);return list.length?`<span class="mt-glyphs">${list.map(name=>`<span class="mt-glyph">${escape(name)}</span>`).join('')}</span>`:'';}
// 채널 글리프: 화면에 플랫폼 이름 대신 두 글자 표식. 모르는 값은 그대로 짧게.
function mtPlatformGlyph(platform){const key=String(platform||'').toLowerCase();return ({youtube:'YT',instagram:'IG',facebook:'FB',tiktok:'TT',threads:'TH',x:'X',twitter:'X',naver:'N',naverblog:'N',blog:'B',linkedin:'IN'})[key]||String(platform||'').slice(0,2).toUpperCase();}
function mtPill(label,attrs=''){return `<button type="button" class="mt-pill" ${attrs}>${escape(label)}<span class="mt-pill-arrow">${mtIcons.arrow}</span></button>`;}
function mtKicker(text='SYNK WORKSPACE / MAKER'){return `<span class="mt-kicker">${escape(text)}</span>`;}
// 계기판: rows = [{label,value,unit,tone,attrs,pressed}] — attrs가 있으면 누르는 칸(필터), 없으면 보기 칸. 값이 없으면 「—」.
function mtMeter(rows){
  const list=(rows||[]).filter(Boolean);if(!list.length)return '';
  return `<div class="mt-meter" data-cols="${Math.min(list.length,5)}">${list.map(row=>{const value=row.value===null||row.value===undefined||row.value===''?'—':row.value,none=value==='—',inner=`<span>${escape(row.label)}</span><strong${none?' class="is-none"':''}>${escape(typeof value==='number'?mtNum(value):value)}${row.unit&&!none?`<small>${escape(row.unit)}</small>`:''}</strong>`,tone=` data-tone="${mtTone(row.tone)}"`;return row.attrs?`<button type="button"${tone} ${row.attrs}${row.pressed===undefined?'':` aria-pressed="${row.pressed?'true':'false'}"`}>${inner}</button>`:`<div${tone}>${inner}</div>`;}).join('')}</div>`;
}
// 머리 포스터(B·도구 한 장): 워크스페이스 면 + 옅은 청금석 큰 글자 + 탭의 펠트 물건 + 숫자 둘(서버가 준 값만, 없으면 칸을 비우지 말고 줄인다).
function mtPoster({tool,label,stats=[],word}){const art=mtFelt(tool);return `<div class="mt-poster" data-mt-poster="${escape(tool)}"><span class="mt-poster-label" aria-hidden="true">${escape(label||'')}</span>${stats.length?`<dl class="mt-poster-stats">${stats.slice(0,2).map(row=>`<div data-tone="${mtTone(row.tone)}"><dt>${escape(row.label)}</dt><dd>${escape(typeof row.value==='number'?mtNum(row.value):row.value)}</dd></div>`).join('')}</dl>`:''}<span class="mt-poster-word" aria-hidden="true">${escape(word||'')}</span>${art?`<img class="mt-poster-art" src="${art}" alt="" width="160" height="156" decoding="async">`:''}</div>`;}
// 탭 머리 한 벌: 모노 눈썹 → 제목 → 한 줄 설명 → 단추. desk는 계기판을 오른쪽에, 나머지는 포스터를 오른쪽에 두고 계기판을 아래에.
function mtHead({tool,title,desc='',actions='',meter='',poster=null,layout}){
  const kind=layout||(mtTools.find(row=>row[0]===tool)||[])[2]||'sheet';
  const copy=`<div class="mt-head-copy">${mtKicker()}<h1>${escape(title||mtToolLabel(tool))}</h1>${desc?`<p>${escape(desc)}</p>`:''}${actions?`<div class="mt-actions">${actions}</div>`:''}</div>`;
  return kind==='desk'?`<header class="mt-head is-desk${meter?'':' is-plain'}">${copy}${meter||''}</header>`:`<header class="mt-head${poster?'':' is-plain'}">${copy}${poster?mtPoster({tool,...poster}):''}</header>${meter||''}`;
}
// 「지금 할 일」: tone poster = 내 차례(워크스페이스 면 포스터 · 화면의 주 단추 하나), quiet = 기다리거나 할 일 없음(옅은 판), butter = 바뀐 자료를 다시 불러올 때.
function mtNow({tool,label='',title,body='',actions='',word='',tone='poster',attrs=''}){
  const art=mtFelt(tool),poster=tone==='poster';
  return `<div class="mt-now${poster?' is-poster':tone==='butter'?' is-butter':''}" data-mt-poster="${escape(tool)}" ${attrs}><div class="mt-now-copy"><span class="mt-now-label"><i>NOW</i>${escape(label)}</span><h3>${escape(title)}</h3>${body?`<p>${body}</p>`:''}${actions?`<div class="mt-actions">${actions}</div>`:''}</div>${poster&&word?`<span class="mt-now-word" aria-hidden="true">${escape(word)}</span>`:''}${art&&tone!=='butter'?`<img class="mt-now-art" src="${art}" alt="" width="112" height="98" decoding="async">`:''}</div>`;
}
// 번호 구역(판): 01 모노 번호 · 제목 · 개수 칩 · 한 줄 설명 · 오른쪽 도구.
function mtBlock({num,title,count,countTone='',desc='',tools='',body='',attrs='',cls='',level=2,headingId=''}){
  const tag=level===3?'h3':'h2';
  return `<section class="mt-block${cls?' '+cls:''}" ${headingId?`aria-labelledby="${escape(headingId)}" `:''}${attrs}><div class="mt-block-head">${num?`<span class="mt-num">${escape(num)}</span>`:''}<${tag}${headingId?` id="${escape(headingId)}"`:''}>${escape(title)}</${tag}>${count===undefined||count===null||count===''?'':`<span class="mt-count"${mtTone(countTone)?` data-tone="${mtTone(countTone)}"`:''}>${escape(typeof count==='number'?mtNum(count):count)}</span>`}${tools?`<div class="mt-block-tools">${tools}</div>`:''}${desc?`<p>${escape(desc)}</p>`:''}</div>${body}</section>`;
}
// 접는 번호 구역(상세 안): summary에 번호 · 제목 · 회색 요약 · 꺾쇠. 열림 상태는 다시 그려도 workspaceDetails가 지킨다.
function mtSec({num,title,sum='',sumTone='',open=false,body='',attrs=''}){return `<details class="mt-sec"${open?' open':''} ${attrs}><summary>${num?`<span class="mt-num">${escape(num)}</span>`:'<span></span>'}<h3>${escape(title)}</h3><span class="mt-sum"${mtTone(sumTone)?` data-tone="${mtTone(sumTone)}"`:''}>${escape(sum)}</span></summary><div class="mt-sec-body">${body}</div></details>`;}
// 파일 놓기 칸: 기본 파일 단추를 숨기고 칸 전체가 누르는 자리가 된다. input 속성(이름 · accept · data-*)은 attrs로.
function mtDrop({attrs='',title,hint='',icon='upload',small=false,disabled=false,set=false,cls=''}){return `<label class="mt-drop${small?' is-small':''}${set?' is-set':''}${disabled?' is-disabled':''}${cls?' '+cls:''}"><input type="file" ${attrs}${disabled?' disabled':''}><span class="mt-drop-icon">${mtIcon(icon)}</span><span><strong>${escape(title)}</strong>${hint?`<small>${escape(hint)}</small>`:''}</span></label>`;}
function mtEmpty(title,text=''){return `<div class="mt-empty">${title?`<strong>${escape(title)}</strong>`:''}${text?escape(text):''}</div>`;}
function mtError(text,actions='',cls=''){return text?`<div class="mt-error${cls?' '+cls:''}" role="alert"><span>${escape(text)}</span>${actions}</div>`:'';}
function mtSwitch(current){return `<nav class="mt-switch" aria-label="제작 도구">${(typeof makerToolsList==='function'?makerToolsList():mtTools).map(([id,label])=>`<button type="button" data-maker-tool="${id}"${id===current?' aria-current="page"':''}>${label}</button>`).join('')}</nav>`;}

// ── 상태와 화면 바꾸기 ──
const makerTools={view:'publish'};
function makerToolsReset(){makerTools.view='publish';if(typeof resetStudioWorkspace==='function')resetStudioWorkspace();if(typeof websiteInquiriesReset==='function')websiteInquiriesReset();if(typeof automationHealthReset==='function')automationHealthReset();if(typeof weeklySummaryReset==='function')weeklySummaryReset();if(typeof publishCheckReset==='function')publishCheckReset();if(typeof publicationFlowReset==='function')publicationFlowReset();if(typeof subtitleLabReset==='function')subtitleLabReset();if(typeof creatorSourcesReset==='function')creatorSourcesReset();if(typeof brandQualityReset==='function')brandQualityReset();}
function makerToolsEnsure(){if(typeof automationHealthSync==='function')automationHealthSync();if(typeof weeklySummarySync==='function')weeklySummarySync();if(!state.user||wr.view!=='tools')return;if(makerTools.view==='productions'&&typeof ensureStudioWorkspace==='function')ensureStudioWorkspace();if(makerTools.view==='inquiries'&&typeof websiteInquiriesEnsure==='function')websiteInquiriesEnsure();if(makerTools.view==='weekly')weeklySummaryEnsure();if(makerTools.view==='automation')automationHealthEnsure();if(makerTools.view==='publish')publishCheckEnsure();if(makerTools.view==='publication')publicationFlowEnsure();if(makerTools.view==='sources')creatorSourcesEnsure();if(['brand','quality'].includes(makerTools.view))brandQualityEnsure();makerToolsSyncSwitch();}
// 문의 접수는 회사 관리자만 본다(서버도 막는다).
function makerToolsList(){return mtTools.filter(row=>row[0]!=='inquiries'||state.user?.role==='admin');}
function makerToolsCurrent(){return makerToolsList().some(row=>row[0]===makerTools.view)?makerTools.view:'publish';}
function makerToolsPanel(){const view=makerToolsCurrent(),panel=view==='productions'&&typeof studioPage==='function'?studioPage():view==='inquiries'&&typeof websiteInquiriesPanel==='function'?websiteInquiriesPanel():view==='automation'?automationHealthPanel():view==='weekly'?weeklySummaryPanel():view==='publication'?publicationFlowPanel():view==='subtitles'?subtitleLabPanel():view==='sources'?creatorSourcesPanel():['brand','quality'].includes(view)?brandQualityPanel(view):publishCheckPanel();if(typeof queueMicrotask==='function')queueMicrotask(makerToolsSyncSwitch);return `<section class="maker-tools mt" data-mt="${view}">${mtSwitch(view)}${panel}</section>`;}
// 왼쪽 메뉴 하위 줄의 숫자: 그 탭 자료를 이미 불러왔을 때만 탭이 {value,tone,label}을 돌려준다(없으면 숫자 없음). 멈춤 같은 문제만 코랄.
function makerToolsNavCount(id){const name={publication:'publicationFlowNavCount',weekly:'weeklySummaryNavCount',automation:'automationHealthNavCount',publish:'publishCheckNavCount',subtitles:'subtitleLabNavCount',sources:'creatorSourcesNavCount',brand:'brandQualityNavCount',quality:'brandQualityNavCount'}[id],read=name?globalThis[name]:null;if(typeof read!=='function')return null;try{const count=read(id),value=Number(count?.value);return value>0&&Number.isFinite(value)?{value,tone:count.tone==='alert'?'alert':'',label:String(count.label||'')}:null;}catch{return null;}}
function makerToolsSubnav(){const view=makerToolsCurrent();return `<div class="mt-subnav" role="group" aria-label="제작 도구">${makerToolsList().map(([id,label])=>{const count=makerToolsNavCount(id);return `<button type="button" data-action="maker-tool" data-maker-tool="${id}" aria-current="${view===id?'page':'false'}"><span>${label}</span>${count?`<b${count.tone?` data-tone="${count.tone}"`:''}>${count.label?`<span class="mt-sr">${escape(count.label)} </span>`:''}${mtNum(count.value)}</b>`:''}</button>`;}).join('')}</div>`;}
// 휴대폰 캡슐은 세 탭만 보이니, 다시 그린 뒤 고른 탭이 다 보이지 않으면 가운데로 민다(세로 위치는 건드리지 않는다).
function makerToolsSyncSwitch(){if(typeof document==='undefined'||typeof document.querySelector!=='function')return;const nav=document.querySelector('.mt-switch'),button=nav?.querySelector('[aria-current="page"]');if(!nav||!button||nav.scrollWidth<=nav.clientWidth)return;const left=button.offsetLeft-nav.scrollLeft,right=left+button.offsetWidth;if(left>=0&&right<=nav.clientWidth)return;nav.scrollLeft=Math.max(0,button.offsetLeft-(nav.clientWidth-button.offsetWidth)/2);}
document.addEventListener('click',event=>{const target=event.target.closest('[data-maker-tool]');if(!target||!state.user||!makerToolsList().some(row=>row[0]===target.dataset.makerTool))return;if(makerTools.view==='inquiries'&&target.dataset.makerTool!=='inquiries'&&typeof wiCanLeave==='function'&&!wiCanLeave())return;const changed=makerTools.view!==target.dataset.makerTool;makerTools.view=target.dataset.makerTool;render();makerToolsEnsure();if(changed&&typeof window!=='undefined'&&typeof window.scrollTo==='function')window.scrollTo(0,0);});
