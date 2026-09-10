'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const {loadVisions}=require(path.join(root,'tools/lib/비전정본.js'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const CSS='/* Approved brand visions, 2026-09-11 */\n.execution .collection-intro .provision-index{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;margin:40px 0 24px;padding:24px 0;border-block:1px solid #EDE7DC}.execution .collection-intro .provision-index a{display:block;min-width:0;text-decoration:none;color:inherit}.execution .collection-intro .vision-subtext{font-size:1rem;line-height:1.8;font-weight:500;margin:14px 0 0;word-break:keep-all}.execution .collection-intro .provision-index strong{display:block;line-height:1.55;word-break:keep-all}.execution .collection-intro h1{word-break:keep-all;text-wrap:balance}@media(max-width:640px){.execution .collection-intro .provision-index{grid-template-columns:1fr;gap:24px;margin-top:32px}}\n';
function headerVision(html){
 const v=loadVisions();
 if(!html.includes('SYNK / FIELD NOTES'))throw Error('Field Notes 현재 소개가 없습니다.');
 const match=html.match(/<header class="collection-intro">[\s\S]*?<\/header>/);
 if(!match)throw Error('현재 소개 헤더를 찾을 수 없습니다.');
 let header=match[0];
 const heading=header.match(/<h1>[^]*?<\/h1>\s*<p(?: class="intro-deck")?>[^]*?<\/p>/);
 if(!heading)throw Error('현재 소개 제목과 본문을 찾을 수 없습니다.');
 header=header.replace(heading[0],`<h1>${esc(v.synk.headline)}</h1><p class="intro-deck">${esc(v.synk.subtext)}</p>`);
 const links={lab:'https://synk.im/#lab',shift:html.includes('id="making"')?'#making':'#accounts',pulse:'01-lab-youtube/index.html'};
 const provision=`<div class="provision-index" aria-label="SYNK가 만드는 경험">${['lab','shift','pulse'].map(k=>`<a href="${links[k]}"><span class="proof-label">${k.toUpperCase()} / VISION</span><strong>${esc(v[k].headline)}</strong><p class="vision-subtext">${esc(v[k].subtext)}</p></a>`).join('')}</div>`;
 const current=header.match(/<div class="provision-index"[^>]*>[\s\S]*?<\/div>/);
 header=current?header.replace(current[0],provision):header.replace('<nav class="quick-links"',provision+'<nav class="quick-links"');
 if(!header.includes(v.lab.headline))throw Error('세 사업 비전 반영 실패');
 return html.replace(match[0],header).replace(/<title>[^<]*<\/title>/,'<title>SYNK · 비전과 만드는 과정</title>').replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(v.synk.subtext)}">`);
}
function cssVision(css){return css.replace(/\/\* Approved brand visions, 2026-09-11 \*\/[\s\S]*?(?=\/\*|$)/,'').trimEnd()+'\n'+CSS;}
function refreshCollectionHeader(base){
 const target=path.join(base,'index.html'),style=path.join(base,'execution.css');
 const before=fs.readFileSync(target,'utf8'),after=headerVision(before);
 if(before!==after)fs.writeFileSync(target,after);
 const beforeCss=fs.readFileSync(style,'utf8'),afterCss=cssVision(beforeCss);
 if(beforeCss!==afterCss)fs.writeFileSync(style,afterCss);
 return {header:before!==after,style:beforeCss!==afterCss};
}
module.exports={headerVision,cssVision,refreshCollectionHeader};
