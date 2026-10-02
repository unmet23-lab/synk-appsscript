import fs from 'node:fs';
const scenes=JSON.parse(fs.readFileSync('../video-v16/content.json','utf8'));
const bodies={
hook:`<div class="hero-art"><img class="felt" src="assets/meeting-scene.png" alt="회의 내용을 메모하는 사람"></div><div class="card solid">컴퓨터 문서 · 메모 앱 · 종이 메모</div>`,
record:`<div class="record-panel"><div class="audio-note"><span class="eyebrow">기록하는 방법 ①</span><div class="wave">${[28,65,105,48,130,78,112,44,88,35].map(h=>`<i style="height:${h}px"></i>`).join('')}</div><b>음성으로 기록</b><p>조용하고 목소리가 또렷할 때 편리해요.</p></div><div class="written-note"><span class="eyebrow">기록하는 방법 ②</span><b>필요한 내용은 직접 메모</b><p>컴퓨터나 메모장에 적어도 좋아요.</p></div></div>`,
common:`<div class="flow-board"><div class="routes"><div class="source-note"><span class="eyebrow">직접 적었다면</span><b>텍스트 메모</b><p>문구 짧게 수정<br>지수 · 9월 23일까지</p></div><div class="source-note"><span class="eyebrow">녹음했다면</span><b>글로 옮긴 기록</b><p>“지수가 23일까지<br>수정하기로 했어요.”</p><small>기록 앱에서 글로 변환</small></div></div><div class="merge-arrow">↓</div><div class="flow-result card accent"><span class="eyebrow">둘 다 같은 방법으로</span><b>읽기 쉬운 회의록</b><div class="result-sections"><span>핵심 요약</span><span>결정된 내용</span><span>확인할 내용</span></div></div></div>`,
prepare:`<div class="notepad"><div class="note-top">정리 전 · 내가 적어둔 메모</div><p>오늘 회의 메모. 소개 페이지 문구가 길다는 얘기 나옴. 짧게 고치기로. 지수가 9월 23일까지 수정하겠다고 함. 설문 얘기도 했는데 초안은 민호가 맡기로 했고 마감은 안 정함. 고객 인터뷰 해보자는 말도 나왔지만 할지는 아직 미정. 아 다음 회의는 9월 25일 오후 2시.</p><div class="note-bottom">순서나 문장을 다듬을 필요 없어요.</div></div><div class="card accent">적어둔 내용 그대로 선택 → 복사</div>`,
result:`<div class="before-notes"><b>정리 전 · 섞여 있는 메모</b><p>문구가 길다는 얘기 나옴. <span class="match-blue">짧게 고치기로. 지수가 9월 23일까지 수정</span>하겠다고 함. 설문 초안은 민호가 맡기로 했고 <span class="match-amber">마감은 안 정함. 고객 인터뷰 할지는 미정.</span></p></div><div class="compare-command">“읽기 쉬운 회의록으로 정리해줘” ↓</div><div class="after-label">정리 후 · 필요한 내용을 바로 찾게</div><div class="after-notes"><div><b>핵심 요약</b><span>소개 문구 개선 · 설문 초안 준비</span></div><div class="match-blue"><b>결정된 내용</b><span>소개 페이지 문구를 짧게 수정</span></div><div class="match-blue"><b>할 일</b><span>지수 · 문구 수정 · 9월 23일까지</span></div><div class="match-amber"><b>확인할 내용</b><span>설문 마감일 · 인터뷰 진행 여부</span></div></div><div class="label">원문·응답 일부를 요약했어요. 전체 예시는 가이드에 있어요.</div>`,
rules:`<div class="review-board"><div class="card quote"><span class="eyebrow">원래 메모</span><p>“초안은 민호가 맡기로 했고<br>마감은 안 정함.”</p></div><div class="review-arrow">↓</div><div class="review-output"><span class="eyebrow">AI가 정리한 결과</span><div class="row-card"><b>설문 초안</b><span>민호</span><mark>확인 필요</mark></div></div><div class="reason-note"><span>왜 ‘확인 필요’일까요?</span><b>메모에 마감일이 없기 때문이에요.</b></div><div class="label">다음 회의 날짜를 작업 마감으로 대신 넣지 않아요.</div></div>`,
project:`<div class="project-home"><div class="project-tab"><span>프로젝트</span><b>회의 전용 폴더처럼 생각하세요.</b></div><div class="project-item"><b>대화</b><span>오늘 회의 · 다음 회의</span></div><div class="project-item"><b>자료</b><span>회의에 참고할 문서</span></div><div class="project-item"><b>지침</b><span>이 안에서 쓸 정리 규칙</span></div><div class="folder-summary">같은 업무에 필요한 것을 한곳에.</div></div>`,
'project-reuse':`<div class="folder"><span class="folder-tab">회의 정리 프로젝트</span><div class="rule-file"><span class="eyebrow">한 번 저장</span><b>지침 = 정리 규칙</b><small>회의록 구성 · 모르는 내용 처리법</small></div><svg class="links" viewBox="0 0 800 300"><path d="M400 20V135H190V270M400 135H610V270"/></svg><div class="chat-card one"><span class="eyebrow">채팅 하나</span>오늘 회의</div><div class="chat-card two"><span class="eyebrow">새 채팅</span>다음 회의</div><div class="folder-bottom">이 안의 새 채팅에도 같은 규칙이 적용돼요.</div></div>`,
global:`<div class="scope-board"><div class="scope-wide"><div id="all-scope" class="card amber"><span class="eyebrow">범위가 너무 넓어요</span><b>계정 전체 맞춤 지침</b></div><div class="branch-row"><div>회의 정리</div><div class="irrelevant">여행 질문</div><div class="irrelevant">글쓰기</div></div><div class="card scenario">다른 질문에도 회의 규칙이 영향을 줄 수 있어요.</div></div><div id="right-scope" class="card accent"><span class="eyebrow">이곳에 저장하세요</span><b>회의 프로젝트의 지침</b><span>회의용 대화에서만 쓸 규칙</span></div><div class="label">적용 범위를 설명하는 가상 예시</div></div>`,
ending:`<div class="pdf-fan"><img src="assets/guide-1.png" alt="제공 PDF 표지"><img src="assets/guide-3.png" alt="프로젝트 지침 설정 안내"></div><div class="kit-tags"><b>11쪽 PDF</b><b>복사할 문장</b><b>정리 전·후 예시</b></div><div class="card solid"><span>가이드가 필요하다면</span><b>댓글에 <strong>synk</strong></b></div>`
};
for(const scene of scenes){
 if(bodies[scene.id])scene.body=bodies[scene.id];
 if(scene.camera){
  let body=scene.body;
  const a=body.indexOf('<div class="camera-frame">'),b=body.indexOf('<div class="cam-action">');
  const label=body.match(/<div class="camera-label">[\s\S]*?<\/div>/)?.[0]||'';
  const note=body.match(/<div class="cam-note">[\s\S]*?<\/div>/)?.[0]||'';
  const steps=body.slice(0,a).replaceAll('① 전체 화면','전체 화면').replaceAll('② 위치 확대','위치 확대').replaceAll('③ ','');
  const frame=body.slice(a,b).replace(label,'');
  const action=body.slice(b).replace(note,'');
  scene.body=steps+'<div class="demo-panel">'+label+frame+action+'</div>'+note;
 }
}
for(const scene of scenes){
 if(scene.id==='record')scene.body=scene.body.replace(/height:(\d+)px/g,(_,n)=>`height:${Math.round(Number(n)*2.35)}px`);
 if(scene.id==='common')scene.body=scene.body.replace('<div class="result-sections">','<div class="result-example">지수 · 문구 수정<br><strong>9월 23일까지</strong></div><div class="result-sections">');
 if(scene.id==='prepare')scene.body=scene.body.replace('<p>','<p><span class="raw-text">').replace('</p>','</span></p>');
 if(scene.id==='rules')scene.body=scene.body.replace('<div class="row-card">','<div class="row-head"><span>할 일</span><span>담당자</span><span>기한</span></div><div class="row-card">');
}
fs.writeFileSync('content.json',JSON.stringify(scenes,null,2)+'\n');
