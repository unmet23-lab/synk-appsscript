'use strict';
// 공개 컬렉션에 필요한 완성 파일만 별도 사이트로 복사한다. 원천은 수정하지 않는다.
const fs=require('node:fs'),path=require('node:path');
const src=path.resolve(__dirname,'..'),dest=path.resolve(process.argv[2]);
if(!process.argv[2]||path.basename(dest)!=='source')throw Error('Explicit share source directory required');
const read=f=>fs.readFileSync(path.join(src,f),'utf8');
const write=(f,s)=>{const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s)};
const copy=f=>{const p=path.join(dest,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(src,f),p)};
const excluded=/(?:_검토|packages|원고|실행적용|업로드안내|댓글답변)/;
function clean(s){
 s=s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/g,(all,url)=>excluded.test(decodeURIComponent(url))?'':all);
 s=s.replace(/<title>/,'<meta name="robots" content="noindex,nofollow"><title>');
 return s.replace(/이 계정 게시 준비/g,'콘텐츠 보기');
}
let home=clean(read('index.html'));
home=home.replace(/<p class="metadata">로컬 제작본입니다\.[\s\S]*?<\/p>/,'<p class="metadata">SYNK 제작 컬렉션 · 콘텐츠와 실습자료를 둘러보세요. 작품 공개와 실제 채널 게시·개설은 별개입니다. 몽골어 콘텐츠는 사람 원어민 감수 전이며, 수업은 AI 합성음성과 가상 교육용 사례를 사용합니다.</p>');
home=home.replace(/<span class="status">([^<]*)<\/span>/g,(_,s)=>s.includes('감수')?'<span class="status">몽골어 · 사람 원어민 감수 전</span>':'');
home=home.replace(/<p class="metadata">([^<]*?) · @[^<]*<\/p>/g,'<p class="metadata">$1</p>');
home=home.replace(/<p class="metadata">([^<]*)<\/p>/g,(all,t)=>/@|미확정|희망/.test(t)?'<p class="metadata">'+t.split(' · ')[0]+'</p>':all);
write('index.html',home);copy('execution.css');
const ids=fs.readdirSync(src).filter(f=>/^\d{2}-/.test(f));
for(const id of ids){
 let s=read(id+'/index.html');
 const cut=s.indexOf('<h2>게시 준비</h2>');if(cut<0)throw Error('Unexpected account template '+id);
 s=s.slice(0,cut)+'</article></body></html>';
 s=clean(s).replace(/<p class="notice">([\s\S]*?)<\/p>/,(_,t)=>'<p class="notice">제작 컬렉션'+(t.includes('감수')?' · 몽골어 사람 원어민 감수 전':'')+'</p>');
 s=s.replace(/<p class="kicker">([^<]*?) · [^<]*<\/p>/,'<p class="kicker">$1</p>').replace('이 계정에 올릴 본문','콘텐츠 본문');
 write(id+'/index.html',s);write(id+'/cards.html',clean(read(id+'/cards.html')));
 for(const f of fs.readdirSync(path.join(src,id)))if(/^(upload-\d+\.jpg|video\.mp4|게시문안\.txt|본문\.md|제목\.txt|대체텍스트\.txt)$/.test(f))copy(id+'/'+f);
}
const mats=JSON.parse(read('제공자료/제공자료.json')).materials;
for(const m of mats){const stem=m.sourceFile.replace(/\.md$/,'');for(const ext of ['.html','_실습.html','_완성예시.html','_완성예시.txt','.md','.pdf']){const f='제공자료/'+stem+ext;if(ext.endsWith('.html'))write(f,clean(read(f)));else copy(f)}}
const help=read('제공자료/소통_후속도움.md');
write('제공자료/소통_후속도움.md','# 자료를 쓰다가 막혔을 때\n\n'+help.slice(help.indexOf('## 1. 독자에게'),help.indexOf('## 2. 운영자에게')).replace('후속 편지를 구독할지는 별도 선택입니다. ',''));
let helpHtml=read('제공자료/소통_후속도움.html');
const helpStart=helpHtml.indexOf('<h2>1. 독자에게'),helpEnd=helpHtml.indexOf('<h2>2. 운영자에게');
if(helpStart<0||helpEnd<0)throw Error('Unexpected help template');
helpHtml=helpHtml.slice(0,helpHtml.indexOf('<h1>'))+'<h1>자료를 쓰다가 막혔을 때</h1>'+helpHtml.slice(helpStart,helpEnd)+'</article></body></html>';
write('제공자료/소통_후속도움.html',clean(helpHtml).replace('후속 편지를 구독할지는 별도 선택입니다. ',''));
let lib=clean(read('자료실/index.html'));
lib=lib.replace(/<h2 class="chapter-heading">써본 뒤의 질문도 남도록<\/h2>[\s\S]*?<\/main>/,'<p>실습 화면에 적은 내용은 서버에 전송하거나 자동 저장하지 않습니다. 창을 닫기 전에 텍스트 파일로 보관하세요.</p></main>');
write('자료실/index.html',lib);
write('공개수업/index.html',clean(read('공개수업/index.html')).replace('<h2>게시할 설명</h2>','<h2>수업 안내</h2>'));
for(const f of ['클리닉.mp4','수업.srt','클리닉.srt','표지.jpg','클리닉-표지.jpg'])copy('공개수업/'+f);
// 수업.mp4는 동일 해상도와 전체 길이를 유지하는 웹 전달용 별도 변환본.
let kit=clean(read('브랜드킷/index.html'));
kit=kit.replace(/<h2>파일 선택<\/h2>[\s\S]*?(?=<h2>)/,'');
kit=kit.replace(/<h2>원본 내려받기<\/h2>[\s\S]*?(?=<h2>SYNK<\/h2>)/,'');
kit=kit.replace('픽셀 단위 동일 도형은 정밀 SVG를 사용하세요. ','');
write('브랜드킷/index.html',kit);
for(const f of fs.readdirSync(path.join(src,'브랜드킷/배치용')))if(/^SYNK(?:-(?:LAB|SHIFT|PULSE))?-(?:Ink|Paper)(?:-배경확인)?\.png$/.test(f))copy('브랜드킷/배치용/'+f);
// 이미지 참조로부터 필요한 자산만 복사한다.
const referenced=new Set();
function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())visit(p);else if(e.name.endsWith('.html'))for(const m of fs.readFileSync(p,'utf8').matchAll(/(?:src|poster)="(?:\.\.\/)?assets\/([^"]+)"/g))referenced.add(m[1])}}
visit(dest);for(const f of referenced)copy('assets/'+f);
write('robots.txt','User-agent: *\nDisallow: /\n');
write('_headers','/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n');
console.log(JSON.stringify({accounts:ids.length,workbooks:mats.length,assets:referenced.size}));
