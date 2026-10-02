(()=>{
 const key='yuhobuilds-ep01-practice-v1';
 const el=id=>document.getElementById(id);
 function read(){try {const data=JSON.parse(localStorage.getItem(key)||'null');return data&&data.student==='A'&&data.date==='06.02'?data:null;}catch{return null;}}
 function show(){const record=read();el('records').innerHTML=record?'<div class="row"><span>학생 A</span><span class="small">06.02</span><span class="badge">✓ 출석</span></div>':'<div class="empty">아직 기록이 없어요.</div>';return record;}
 if(show())el('status').textContent='다시 열어도 기록이 남아 있어요. 첫 단계 완료!';
 el('save').onclick=()=>{try{localStorage.setItem(key,JSON.stringify({student:'A',date:'06.02',attendance:true}));show();el('status').textContent='저장했어요. 이제 ‘다시 열어 확인’을 눌러 보세요.';}catch{el('status').textContent='브라우저가 저장을 막고 있어요. 일반 브라우저에서 다시 열어 주세요.';}};
 el('reopen').onclick=()=>location.reload();
 el('reset').onclick=()=>{try{localStorage.removeItem(key);show();el('status').textContent='이 예제의 기록을 비웠어요. 다시 시작해 보세요.';}catch{el('status').textContent='브라우저 저장 공간에 접근하지 못했어요.';}};
 el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('prompt').value);el('copyStatus').textContent='복사했어요. 사용하던 AI 대화창에 붙여 넣어 보세요.';}catch{el('prompt').focus();el('prompt').select();el('copyStatus').textContent='문장을 선택했어요. Ctrl+C(맥은 ⌘C)로 복사해 주세요.';}};
})();
