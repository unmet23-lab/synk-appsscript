import {PROMPTS,FOLLOWUPS} from '../content.mjs';
const $=id=>document.getElementById(id);
const descriptions=[
  {title:'첫 질문 · 중앙 면접관',text:PROMPTS.question.text,reaction:'왼쪽 면접관은 질문자를 잠시 본 뒤 지원자를 바라봅니다. 오른쪽 면접관은 서류에서 고개를 듭니다.'},
  {title:'답변을 듣는 동안 · 경청 A',text:'세 명 모두 말하지 않고 지원자의 답변을 듣습니다.',reaction:'각자 다른 순간에 눈을 깜박입니다. 한 사람만 작게 고개를 끄덕이고 다른 사람은 잠깐 메모합니다.'},
  {title:'경험을 말했을 때 · 후속 질문',text:FOLLOWUPS.experience.text,reaction:'왼쪽 면접관이 후속 질문을 합니다. 두 사람은 화자를 잠시 바라본 뒤 다시 지원자를 봅니다.'},
  {title:'다음 답변 · 경청 B',text:'직전 질문이 끝난 자세에서 경청으로 이어집니다.',reaction:'메모하던 손이 쉬고 시선이 돌아옵니다. 모두가 동시에 끄덕이거나 같은 행동을 반복하지 않습니다.'}
];
for(const s of descriptions){const li=document.createElement('li'),title=document.createElement('strong'),p=document.createElement('p'),small=document.createElement('small');title.textContent=s.title;p.textContent=s.text;small.textContent=s.reaction;li.append(title,p,small);$('shots').append(li);}
$('clear-view').onclick=()=>{document.body.classList.add('clean');$('restore').hidden=false;$('restore').focus();};
$('restore').onclick=()=>{document.body.classList.remove('clean');$('restore').hidden=true;$('clear-view').focus();};
$('show-script').onclick=()=>$('script').showModal();$('close-script').onclick=$('close-bottom').onclick=()=>$('script').close();
try{const response=await fetch('../film-manifest.json');if(!response.ok)throw Error();const m=await response.json();const count=(m.clips||[]).filter(c=>c.src&&c.reviewed&&c.status==='ready').length;$('asset-status').textContent=`본편용 영상 ${count}/${m.clips?.length||16}개 · 비교 샘플 3편 별도`;document.documentElement.dataset.ready='true';}catch{$('asset-status').textContent='본편 제작 준비 · 비교 샘플 3편 별도';document.documentElement.dataset.ready='true';}
