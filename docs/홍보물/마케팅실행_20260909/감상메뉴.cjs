'use strict';
// One closed-by-default listening room. Presentation styles live in Loom.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const openButton=(label='라디오 열기 · K-LOFI24')=>`<button type="button" class="download" data-radio-open aria-haspopup="dialog" aria-controls="radio-room">${esc(label)}</button>`;
const script=`<script>(()=>{
 const room=document.getElementById('radio-room'),film=document.getElementById('listening-film'),status=document.getElementById('listen-status'),start=document.getElementById('listen-start');
 let opener=null;
 const quietOthers=()=>document.querySelectorAll('video').forEach(v=>{if(v!==film)v.pause()});
 document.querySelectorAll('[data-radio-open]').forEach(button=>button.addEventListener('click',()=>{opener=button;quietOthers();room.showModal()}));
 document.getElementById('radio-close').addEventListener('click',()=>room.close());
 room.addEventListener('close',()=>{film.pause();if(opener)opener.focus()});
 start.addEventListener('click',async()=>{quietOthers();film.muted=false;film.volume=1;film.currentTime=0;try{await film.play();if(!room.open){film.pause();return}status.textContent='전곡을 재생하고 있습니다. 소리 크기는 플레이어에서 조절하세요.'}catch(e){status.textContent='플레이어의 재생 버튼을 눌러주세요. 기기의 소리 설정도 확인해 주세요.'}});
 film.addEventListener('play',()=>{if(!room.open){film.pause();return}quietOthers()});
 film.addEventListener('ended',()=>{status.textContent='한 곡이 끝났습니다. 다시 듣고 싶으면 재생 버튼을 눌러주세요.'});
 film.addEventListener('error',()=>{status.textContent='영상을 불러오지 못했습니다. 영상 받기 링크로 직접 열어볼 수 있습니다.'});
 document.querySelectorAll('video').forEach(active=>active.addEventListener('play',()=>{document.querySelectorAll('video').forEach(other=>{if(other!==active)other.pause()})}));
})();</script>`;
function room(m,prefix=''){
 return `<dialog id="radio-room" class="radio-room" aria-labelledby="radio-title"><div class="radio-top"><p class="kicker">SYNK PULSE / K-LOFI24</p><button type="button" id="radio-close" class="download" autofocus>라디오 닫기</button></div><h2 id="radio-title">${esc(m.title)}</h2><p class="radio-subtitle">한 곡이 끝날 때까지, 추석 마당의 불빛 곁에.</p><video id="listening-film" class="film" src="${prefix}video.mp4?v=klofi-v5" poster="${prefix}upload-01.jpg" controls preload="none" playsinline aria-label="오늘 밤 제일 환한 사람 전곡 감상"></video><div class="material-actions"><button type="button" class="download" id="listen-start">소리 켜고 처음부터 듣기 · 1분 1.6초</button><a class="download" href="${prefix}video.mp4" download>감상 영상 받기</a><a class="download" href="${prefix}감상노트.md" download>곡·장면 노트</a></div><p id="listen-status" role="status">메뉴를 열어도 자동 재생하지 않습니다. 닫으면 음악도 멈춥니다.</p><p class="radio-credit">${esc(m.credit)} · 별도 제작 감상 영상이며 실시간 방송이 아닙니다.</p>${prefix?`<a class="download" href="${prefix}index.html">곡과 장면의 구상 읽기</a>`:''}</dialog>${script}`;
}
function detail(body,m){
 const start=body.indexOf('<video id="listening-film"'),end=body.indexOf('<h2>지금 흐르는 한 곡</h2>');
 if(start<0||end<0)throw Error('Listening template changed');
 body=body.slice(0,start)+`<div class="material-actions">${openButton()}</div><p class="notice">메뉴 안에서 전곡을 듣습니다. 아래에서는 곡과 장면의 구상을 읽을 수 있습니다. 몽골어 사람 원어민 감수 전.</p>`+body.slice(end);
 body=body.replace(/<script>[\s\S]*?<\/script>/g,'');
 return body.replace('<h2>게시 준비</h2>',room(m)+'<h2>게시 준비</h2>');
}
function home(html,m){
 html=html.replace('<main class="collection-shell">','<main class="collection-shell field-edition">');
 html=html.replace('<h1>한 편 뒤에도<br>도움이 남도록.</h1>','<h1>보는 콘텐츠에서,<br>쓰는 도구까지.</h1>');
 html=html.replace('<p>새로 정돈한 브랜드, 19개 계정의 한 편, 직접 고쳐 쓸 수 있는 실습자료. 보는 순간부터 사용한 뒤의 질문까지 한 흐름으로 준비합니다.</p>','<p class="intro-deck">캐릭터·소품·스티치 로고를 채널마다 다른 한 편으로.<br>1인기업 수업과 고쳐 쓰는 자료까지, 직접 보고 써보세요.</p>');
 // Keep the six workbooks together, after every account. Fail if the input drifts.
 const resourceBlock=html.match(/<h2 class="chapter-heading" id="resources">[\s\S]*?<section class="resources">[\s\S]*?<\/section>/);
 if(!resourceBlock)throw Error('Workbook section not found');
 html=html.replace(resourceBlock[0],'');
 html=html.replace('</main>',resourceBlock[0]+'</main>');
 const heading=(n,label,id)=>`<h2 class="chapter-heading chapter-title" id="${id}"><img src="assets/felt-number-${n}.webp" class="chapter-glyph" width="${[0,488,353,422][n]}" height="480" alt="" loading="lazy" aria-hidden="true"><span><span class="chapter-index">${String(n).padStart(2,'0')} / ${['','CLASS','CONTENTS','WORKBOOKS'][n]}</span>${label}</span></h2>`;
 html=html.replace('<h2 class="chapter-heading">02. 공개 실습 수업</h2>',heading(1,'내 일을 설명하는 법, 함께 실습해요.','class')+'<p class="chapter-deck">내 소개문과 상품 범위를 완성하는 1인기업 수업. 가상 클리닉에서는 같은 기준으로 문장을 고칩니다.</p><p class="section-note">AI 합성음성·가상 교육용 사례로 제작한 온라인 수업입니다.</p>');
 html=html.replace('<h2 class="chapter-heading" id="accounts">03. 계정마다 다른 한 편</h2>',heading(2,'같은 브랜드, 저마다의 쓰임.','accounts')+'<p class="chapter-deck">LAB의 한국어, SHIFT의 1인기업, PULSE의 음악. 각 계정에 맞춘 콘텐츠와 제공 자료를 열어보세요.</p>');
 html=html.replace('<h2 class="chapter-heading" id="resources">01. 먼저 건네는 실습자료</h2>',heading(3,'보고 끝내지 않도록, 실습자료 6종.','resources'));
 const metadata=html.match(/<p class="metadata">로컬 제작본입니다\.[\s\S]*?<\/p>/);
 if(!metadata)throw Error('Collection publication note not found');
 html=html.replace(metadata[0],'').replace('</main>',`<footer class="collection-notes">${metadata[0]}</footer></main>`);
 const figure='<figure class="craft-feature"><video id="craft-film" class="film" src="assets/craft-film-4k.mp4" poster="assets/craft-film-poster.jpg" controls preload="none" playsinline aria-label="공예 모티프와 기존 체험 일정 안내를 포함한 4K 브랜드 영상"></video><figcaption><span>솜에서, 우리 곁으로.</span> Google Veo 3.1 · 4K · 공예를 모티프로 한 AI 연출<br>기존 체험 일정 안내까지 담은 브랜드 필름 전체입니다. 재생 버튼을 누르면 소리와 함께 볼 수 있습니다.</figcaption></figure>';
 html=html.replace(/(<header class="collection-intro">)([\s\S]*?)(<nav class="quick-links">)/,`$1<div class="intro-feature"><div class="intro-copy">$2</div>${figure}</div><div class="provision-index" aria-label="여기서 보고 가져갈 것"><a href="#accounts"><span class="proof-label">브랜드 자산을 콘텐츠로</span><strong>19개 계정의 한 편</strong></a><a href="#class"><span class="proof-label">노하우를 실습으로</span><strong>1인기업 수업 · 클리닉</strong></a><a href="#resources"><span class="proof-label">배운 방법을 내 도구로</span><strong>채운 예시 · 수정 원본 6종</strong></a></div>$3`);
 html=html.replace('<nav class="quick-links">',`<nav class="quick-links" aria-label="컬렉션 메뉴">${openButton()}`);
 html=html.replace('<a class="download" href="#accounts">19개 계정</a>','').replace('<a class="download" href="#resources">실습자료 6종</a>','').replace('>업그레이드 브랜드 킷</a>','>브랜드 킷</a>');
 html=html.replace(/<article class="entry" data-brand="PULSE"><a href="01-lab-youtube\/index.html">[\s\S]*?<\/article>/,`<article class="entry radio-entry" data-brand="PULSE"><p class="kicker">PULSE / K-LOFI24</p><h2>${esc(m.title)}</h2><p>움직이는 추석 마당과 까몽. 1분 1.6초의 한 곡은 라디오 메뉴 안에 준비했습니다.</p><div class="actions">${openButton('라디오에서 듣기')}<a class="download" href="01-lab-youtube/index.html">곡과 장면의 구상</a></div></article>`);
 return html.replace('</main>',`</main>${room(m,'01-lab-youtube/')}`);
}
module.exports={detail,home};
