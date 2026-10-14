'use strict';

const cg={userId:null,data:null,request:0,loading:false,attempted:false,error:'',query:'',category:'all',selected:'',readerMode:'summary'};
function resetCompanyGuide(){Object.assign(cg,{userId:null,data:null,request:cg.request+1,loading:false,attempted:false,error:'',query:'',category:'all',selected:'',readerMode:'summary'});}
function companyGuideIdentity(){if(state.user&&cg.userId!==state.user.id){resetCompanyGuide();cg.userId=state.user.id;}}
function ensureCompanyGuide(){if(!state.user)return;companyGuideIdentity();if(!cg.loading&&!cg.attempted)void loadCompanyGuide();}
async function loadCompanyGuide(){
  const userId=state.user?.id;if(!userId)return;companyGuideIdentity();const request=++cg.request;cg.loading=true;cg.attempted=true;cg.error='';if(state.tab==='handbook')render();
  try{const data=await api('/api/company-guide');if(request!==cg.request||state.user?.id!==userId)return;cg.data=data;}
  catch(error){if(request===cg.request&&state.user?.id===userId)cg.error=error.message;}
  finally{if(request===cg.request&&state.user?.id===userId){cg.loading=false;if(state.tab==='handbook')render();}}
}
const cgButton=(label,action,attrs='',classes='')=>button(label,'company-guide-'+action,'',classes,attrs);
function cgSourceLink(url,path){
  const decoded=url.replaceAll('&amp;','&').replace(/^&lt;|&gt;$/g,'');
  if(!path||/^[a-z]+:/i.test(decoded))return null;
  let target;try{target=decodeURIComponent(decoded.split('#')[0]);}catch{return null;}
  const parts=(target.startsWith('docs/')?target:path.split('/').slice(0,-1).join('/')+'/'+target).split('/'),resolved=[];
  for(const part of parts){if(part==='..')resolved.pop();else if(part&&part!=='.')resolved.push(part);}
  const row=cg.data?.documents.find(row=>row.path===resolved.join('/'));
  return row?{id:row.id,section:decoded.split('#')[1]?.replaceAll('-',' ')||''}:null;
}
function cgInline(text,path=''){
  return escape(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_whole,label,url)=>{
    const link=cgSourceLink(url,path);
    if(link)return `<button type="button" class="cg-inline-link" data-action="company-guide-open" data-id="${escape(link.id)}" data-section="${escape(link.section)}">${label}</button>`;
    return /^https?:\/\//i.test(url)?`<a href="${escape(safeUrl(url.replaceAll('&amp;','&')))}" target="_blank" rel="noopener noreferrer">${label}${icon('external')}</a>`:label;
  }).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
}
function cgHeadings(text){let fenced=false;return text.replace(/<!--[\s\S]*?-->/g,'').split(/\r?\n/).flatMap(line=>{line=line.replace(/^(>\s*)+/,'');if(line.startsWith('```')){fenced=!fenced;return [];}return !fenced&&/^#{1,6}\s/.test(line)?[line.replace(/^#+\s*/,'')]:[];});}
function cgMarkdown(text,path='',counter={heading:0}){
  const lines=text.replace(/<!--[\s\S]*?-->/g,'').split(/\r?\n/),output=[];
  const special=line=>/^\s*$|^#{1,6}\s|^\s*[-*]\s|^\s*\d+[.)]\s|^>|^\||^```|^---+$/.test(line);
  const inline=text=>cgInline(text,path),cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>inline(cell.trim()));
  for(let i=0;i<lines.length;){
    const line=lines[i];if(!line.trim()||/^<a\s+id="[^"]+"><\/a>$/.test(line.trim())){i++;continue;}
    if(line.startsWith('```')){const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;output.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);continue;}
    const title=line.match(/^(#{1,6})\s+(.+)$/);if(title){const level=Math.min(4,title[1].length+1);output.push(`<h${level} id="company-doc-section-${counter.heading++}">${inline(title[2])}</h${level}>`);i++;continue;}
    if(/^\|/.test(line)&&/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(lines[i+1]||'')){
      const headers=cells(line),rows=[];i+=2;while(i<lines.length&&/^\|/.test(lines[i]))rows.push(cells(lines[i++]));output.push(`<div class="cg-table" tabindex="0" role="region" aria-label="문서 표"><table><thead><tr>${headers.map(cell=>`<th scope="col">${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
    }
    if(/^---+$/.test(line)){output.push('<hr>');i++;continue;}
    if(/^>/.test(line)){const quote=[];while(i<lines.length&&/^>/.test(lines[i]))quote.push(lines[i++].replace(/^>\s?/,''));output.push(`<blockquote>${cgMarkdown(quote.join('\n'),path,counter)}</blockquote>`);continue;}
    const unordered=/^\s*[-*]\s/.test(line),ordered=/^\s*\d+[.)]\s/.test(line);
    if(unordered||ordered){const list=[],pattern=unordered?/^\s*[-*]\s/:/^\s*\d+[.)]\s/,tag=unordered?'ul':'ol',start=ordered?` start="${parseInt(line.trim(),10)}"`:'';while(i<lines.length&&pattern.test(lines[i]))list.push(inline(lines[i++].replace(pattern,'')));output.push(`<${tag}${start}>${list.map(item=>`<li>${item}</li>`).join('')}</${tag}>`);continue;}
    const paragraph=[inline(line)];i++;while(i<lines.length&&!special(lines[i]))paragraph.push(inline(lines[i++]));output.push(`<p>${paragraph.join(' ')}</p>`);
  }
  return output.join('');
}
function cgHeader(title,description){return `<header class="cg-heading"><div><h1>${escape(title)}</h1>${description?`<p>${escape(description)}</p>`:''}</div><button type="button" class="cg-refresh" data-action="company-guide-refresh" aria-label="자료 새로고침" ${cg.loading?'disabled':''}>${icon('refresh')}</button></header>`;}
function companyGuidePage(){
  companyGuideIdentity();const guide=cg.data,row=guide?.documents.find(row=>row.id===cg.selected),category=!cg.query.trim()&&guide?.categories.find(row=>row.id===cg.category);
  return `<div class="cg-page"><button type="button" class="cg-settings-back" data-action="marin-account">${icon('settings')}<span>설정</span></button>${row?'':cgHeader(category?.label||'회사 안내',category?category.overview?.note||category.description:'복지와 수업 기준을 확인하세요.')}${cg.error?`<p class="cg-error" role="alert">${escape(cg.error)}</p>`:''}${!guide?`<p class="cg-empty" role="status">${cg.loading?'자료를 불러오고 있어요.':'자료를 다시 불러와 주세요.'}</p>`:row?cgReader(row):cgDirectory(guide)}</div>`;
}
function cgJump(label,id,section='',classes=''){
  return `<button type="button" class="${classes}" data-action="company-guide-open" data-id="${escape(id)}" data-section="${escape(section)}">${escape(label)}${icon('arrow')}</button>`;
}
function cgSectionId(text,section){
  const headings=cgHeadings(text),needle=section.toLocaleLowerCase(),index=headings.findIndex(title=>title.toLocaleLowerCase().includes(needle));
  return section&&index>=0?'company-doc-section-'+index:'';
}
function cgExcerpt(text,query){
  const clean=text.replace(/<!--[\s\S]*?-->/g,'').replace(/[#*`>|]/g,'').replace(/\s+/g,' '),at=clean.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if(at<0)return '';
  return `<p class="cg-excerpt">${at>45?'…':''}${escape(clean.slice(Math.max(0,at-45),at))}<mark>${escape(clean.slice(at,at+query.length))}</mark>${escape(clean.slice(at+query.length,at+query.length+95))}…</p>`;
}
function cgDocumentRow(row,query=''){
  return `<article class="cg-document-row"><h3>${cgJump(row.title,row.id,'','cg-document-title')}</h3>${query?cgExcerpt(row.text,query):`<p>${escape(row.description)}</p>`}${row.error?`<p class="cg-error">${escape(row.error)}</p>`:''}</article>`;
}
function cgFacts(facts){
  return `<dl class="cg-facts">${facts.map(row=>`<div><dt>${escape(row.label)}</dt><dd><span>${escape(row.value)}</span>${row.note?`<small>${escape(row.note)}</small>`:''}</dd><dd class="cg-condition">${escape(row.condition)}</dd></div>`).join('')}</dl>`;
}
function cgOverview(guide){
  const images={crew:'sticker-person.webp',student:'sticker-check.webp',teaching:'sticker-book.webp',work:'sticker-envelope.webp'};
  return `<section class="cg-atglance" aria-label="회사 안내 한눈에">${guide.categories.map(row=>`<section><h2><button type="button" class="cg-overview-link" data-action="company-guide-category" data-id="${escape(row.id)}"><img src="/messenger/assets/${images[row.id]||'sticker-book.webp'}" width="32" height="32" alt=""><span>${escape(row.label)}</span>${icon('arrow')}</button></h2>${row.overview?`<dl>${row.overview.items.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p>${escape(row.overview.note)}</p>`:`<p class="cg-overview-description">${escape(guide.documents.filter(document=>document.category===row.id).map(document=>document.title).slice(0,3).join(' · '))}</p>`}</section>`).join('')}</section>`;
}
function cgDirectory(guide){
  const query=cg.query.trim(),normalized=query.toLocaleLowerCase(),category=guide.categories.find(row=>row.id===cg.category),documents=guide.documents.filter(row=>(cg.category==='all'||row.category===cg.category)&&(!query||[row.title,row.description,row.scope,row.status,row.notice,row.text].join(' ').toLocaleLowerCase().includes(normalized)));
  return `<form class="cg-search" data-company-guide-search><label class="cg-sr" for="company-guide-query">안내 검색</label><input id="company-guide-query" name="query" type="search" maxlength="120" value="${escape(query)}" placeholder="복지·수업·문서 검색"><button type="submit" aria-label="안내 검색"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button></form><nav class="cg-categories" aria-label="안내 분류">${[{id:'all',label:'한눈에'},...guide.categories].map(row=>`<button type="button" data-action="company-guide-category" data-id="${escape(row.id)}" aria-pressed="${cg.category===row.id}">${escape(row.label)}</button>`).join('')}</nav>
  ${query?`<div class="cg-results-heading"><h2>‘${escape(query)}’</h2><span role="status">문서 ${documents.length}개</span>${cgButton('검색 지우기','clear','','quiet small')}</div><div class="cg-document-list">${documents.map(row=>cgDocumentRow(row,query)).join('')}</div>${documents.length?'':'<p class="cg-empty">찾는 내용이 없어요. 다른 단어로 검색해 보세요.</p>'}`:!category?cgOverview(guide):`<section class="cg-category" aria-label="${escape(category.label)}">${category.facts?.length?cgFacts(category.facts):''}</section><section class="cg-source-list"><h2>${category.facts?.length?'관련 문서':'안내 문서'}</h2><div class="cg-document-list">${documents.map(row=>cgDocumentRow(row)).join('')}</div></section>`}`;
}
function cgReader(row){
  const category=cg.data?.categories.find(group=>group.id===row.category),facts=(category?.facts||[]).filter(fact=>fact.documentId===row.id),original=!facts.length||cg.readerMode==='original',headings=cgHeadings(row.text),related=(row.related||[]).map(id=>cg.data?.documents.find(row=>row.id===id)).filter(Boolean),tocOpen='';
  return `<div class="cg-reader-nav">${cgButton('회사 안내로','back','','quiet')}<span>${escape(row.scope)}</span></div>${cgHeader(row.title,'')}<div class="cg-reader-meta"><span>${escape(row.status)}</span><details class="cg-source"><summary>원문 정보</summary><p>${escape(row.path)}</p><p>파일 업데이트 ${bmDate(row.updatedAt)} · 시행일은 원문을 따릅니다.</p></details></div>${facts.length?`<nav class="cg-reader-modes" aria-label="문서 보기"><button type="button" data-action="company-guide-mode" data-id="summary" aria-pressed="${!original}">핵심 안내</button><button type="button" data-action="company-guide-mode" data-id="original" aria-pressed="${original}">원문 전체</button></nav>`:''}
  ${row.error?`<p class="cg-error" role="alert">${escape(row.error)}</p>`:original?`<div class="cg-reader-layout"><aside>${headings.length?`<details class="cg-toc"${tocOpen}><summary>목차</summary><nav aria-label="문서 목차">${headings.map((title,index)=>`<a href="#company-doc-section-${index}">${cgInline(title)}</a>`).join('')}</nav></details>`:''}</aside><article class="cg-reader">${row.notice?`<details class="cg-notice"><summary>${escape(row.notice.split('. ')[0])}</summary><p>${escape(row.notice)}</p></details>`:''}<div class="cg-body">${cgMarkdown(row.text,row.path)}</div></article></div>`:`<article class="cg-reader-summary">${cgFacts(facts)}${row.notice?`<p class="cg-summary-note">${escape(row.notice)}</p>`:''}</article>`}
  ${related.length?`<footer class="cg-related"><h2>관련 문서</h2>${related.map(document=>cgJump(document.title,document.id)).join('')}</footer>`:''}`;
}

document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-action^="company-guide-"]');if(!target||target.disabled||!state.user)return;const action=target.dataset.action.slice(14);
  if(action==='refresh'){void loadCompanyGuide();return;}
  if(action==='open'&&cg.data?.documents.some(row=>row.id===target.dataset.id)){cg.selected=target.dataset.id;cg.readerMode=target.dataset.section?'original':'summary';}
  else if(action==='back')cg.selected='';
  else if(action==='mode'&&['summary','original'].includes(target.dataset.id))cg.readerMode=target.dataset.id;
  else if(action==='category'&&['all',...(cg.data?.categories||[]).map(row=>row.id)].includes(target.dataset.id)){cg.category=target.dataset.id;cg.selected='';}
  else if(action==='clear'){cg.query='';cg.category='all';cg.selected='';}
  else return;
  render();const main=document.getElementById('main');if(main)main.scrollTop=0;window.scrollTo(0,0);
  const focus=action==='category'?`[data-action="company-guide-category"][data-id="${cg.category}"]`:action==='mode'?`[data-action="company-guide-mode"][data-id="${cg.readerMode}"]`:'.cg-heading h1';
  const heading=document.querySelector?.(focus);if(heading){if(heading.tagName==='H1')heading.tabIndex=-1;heading.focus?.({preventScroll:true});}
  if(action==='open'&&target.dataset.section){const row=cg.data.documents.find(row=>row.id===cg.selected),id=cgSectionId(row.text,target.dataset.section);if(id)document.getElementById(id)?.scrollIntoView();}
});
document.addEventListener('submit',event=>{if(!event.target.matches?.('[data-company-guide-search]')||!state.user)return;event.preventDefault();cg.query=String(new FormData(event.target).get('query')||'').trim().slice(0,120);cg.selected='';render();});
