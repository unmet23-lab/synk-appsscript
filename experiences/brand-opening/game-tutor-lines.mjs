import {TUTORS} from './tutor-profiles.mjs';

// These are game directions and authored reactions, not generated assessment.
// The game's existing answer/physics code owns whether a response was correct.
export const GAME_GUIDES={
 runner:{title:'바람길',steps:[
  {keys:'← →',title:'길 바꾸기',text:{marin:'수칙 하나. 왼쪽·오른쪽 단추로 한 칸씩 이동한다. 컴퓨터는 ←·→ 또는 A·D.',kkamong:'이 몸처럼 날렵하게. 왼쪽·오른쪽 단추로 한 칸씩 옮겨. 컴퓨터는 ←·→, A·D야.',mongle:'우와, 길이 세 칸이야! 왼쪽·오른쪽 단추로 같이 옮겨 보자! 컴퓨터는 ←·→, A·D!'}},
  {keys:'↑ ↓',title:'점프와 숙이기',text:{marin:'수칙 둘. 위 단추는 점프. 아래 단추는 숙이기. 컴퓨터는 ↑·W·Space, ↓·S.',kkamong:'이 몸의 비법. 위 단추로 뛰고, 아래 단추로 숙여. 컴퓨터는 ↑·W·Space, ↓·S지.',mongle:'오! 위 단추는 폴짝, 아래 단추는 쏙! 컴퓨터는 ↑·W·Space, ↓·S로 같이 해 보자!'}},
  {keys:'듣기',title:'바람의 부탁 듣기',text:{marin:'임무 확인. 표시선 전에 들은 대로 움직인다. 하지 말라는 부탁도 있다. …서두르지 마라.',kkamong:'이 몸도 끝까지 듣고 움직여. 표시선 전에 부탁대로 해 봐. 하지 말라면 그대로! …알고 있었지.',mongle:'어? 하지 말라는 부탁도 있네! 끝까지 듣고 표시선 전에 같이 움직이자!'}}]},
 rhythm:{title:'말의 리듬',steps:[
  {keys:'F / J',title:'두 단추로 박자 맞추기',text:{marin:'수칙 하나. 왼쪽은 F·←. 오른쪽은 J·→. 휴대폰은 아래 두 단추를 누른다.',kkamong:'이 몸의 무대에선 왼쪽 F·←, 오른쪽 J·→. 휴대폰은 아래 두 단추야.',mongle:'오! 단추가 둘이야! 왼쪽 F·←, 오른쪽 J·→! 휴대폰은 아래 단추로 같이 해 보자!'}},
  {keys:'O / X',title:'끝까지 듣고 고르기',text:{marin:'듣기 확인. 들은 내용과 맞으면 O. 아니면 X. 듣는 동안은 답하지 않는다.',kkamong:'이 몸도 듣는 중엔 기다려. 들은 내용과 맞으면 O, 아니면 X를 고르는 거지.',mongle:'어떤 이야기일까? 끝까지 같이 듣자! 들은 내용과 맞으면 O, 아니면 X야!'}},
  {keys:'박자',title:'선에 닿을 때 누르기',text:{marin:'타이밍 확인. 노트가 크림색 선에 닿을 때 누른다. 먼저 골랐다면 선에서 한 번 더.',kkamong:'이 몸의 타이밍을 봐. 노트가 크림색 선에 닿으면 눌러. 미리 골랐으면 선에서 한 번 더!',mongle:'우와, 노트가 내려온다! 크림색 선에 닿으면 같이 누르자! 먼저 골랐다면 선에서 한 번 더!'}}]},
 hangul:{title:'한글 만나기',steps:[
  {keys:'소리',title:'소리부터 만나기',text:{marin:'수칙 하나. 소리 단추를 누른다. 들은 뒤 글자를 확인한다. …다시 들어도 된다.',kkamong:'이 몸도 소리부터 들어. 소리 단추를 눌러 봐. 한 번 더 들어도 이 몸은 기다리지.',mongle:'어? 이 글자는 어떤 소리일까? 소리 단추로 같이 들어 보자! 한 번 더 들어도 좋아!'}},
  {keys:'선택',title:'듣고 고르거나 짝 맞추기',text:{marin:'임무 확인. 들은 글자를 고른다. 짝 맞추기는 소리 카드와 글자 카드, 하나씩.',kkamong:'이 몸의 설명대로 들은 글자를 골라 봐. 짝 맞추기는 소리 하나, 글자 하나지.',mongle:'오, 들은 글자를 찾았어? 같이 골라 보자! 짝 맞추기는 소리 카드랑 글자 카드 하나씩!'}},
  {keys:'다음',title:'내 속도로 이어가기',text:{marin:'진행 확인. 글자는 손가락으로 따라 그릴 수 있다. 확인이 끝나면 다음. …네 속도로.',kkamong:'이 몸처럼 글자를 손가락으로 그려 봐. 다 봤으면 다음! …천천히 해도 돼.',mongle:'우와, 손가락으로 글자도 그릴 수 있어! 다 봤으면 다음으로 같이 가자!'}}]},
 first:{title:'첫 문장 놀이',steps:[
  {keys:'읽기',title:'짧은 문장 읽기',text:{marin:'임무 하나. 짧은 문장을 읽는다. …천천히 읽어라.',kkamong:'이 몸이 같이 볼게. 짧은 문장부터 읽어 봐. 천천히도 괜찮지.',mongle:'어떤 상황일까? 짧은 문장을 같이 읽어 보자!'}},
  {keys:'선택',title:'어울리는 답 고르기',text:{marin:'선택 확인. 어울리는 답을 누른다. 다음 문장으로 이동한다.',kkamong:'이 몸이라면 상황에 어울리는 답을 고르겠지. 골랐으면 다음 문장!',mongle:'오! 이 상황에 어떤 답이 어울릴까? 골랐으면 다음 문장으로 같이 가자!'}},
  {keys:'확인',title:'끝나면 함께 확인하기',text:{marin:'결과 확인은 놀이가 끝난 뒤. …고른 순간에 정답이라 말하지 않는다.',kkamong:'이 몸도 끝나면 답을 확인해. 같이 보자고. …나도 궁금하네.',mongle:'답은 끝나면 같이 확인하자! 어려웠던 문장도 다시 만나 보자!'}}]}
};

const LINES={
 marin:{ready:['동행 확인. 조작 수칙을 확인한다. …나는 여기 있다.'],playing:['임무 시작. …네 속도로.'],paused:['진행 정지. …잠깐 쉬어도 된다.'],listening:['듣기 확인. 끝까지 듣는다.'],picked:['선택 기록. 결과는 놀이 뒤에 확인한다.'],success:['임무 완수. …좋다.','응답 확인. …잘했다.','완료 기록. 네가 해냈다.'],combo:['연속 완료. …훌륭하다.'],retry:['재도전. …나는 여기 있다.','다시 준비한다. …함께다.','확인. 다음에도 기다린다.'],unanswered:['응답 대기 종료. …다음에 다시 한다.'],obstacle:['충돌 확인. …다시 길을 본다.'],timing:['박자 확인. …선에 맞춰 다시.'],finish:['놀이 종료. …끝까지 함께했다.'],rest:['여기까지 기록. …쉬고 다시 와라.'],hint:['조작 수칙. 다시 확인한다.']},
 kkamong:{ready:['이 몸이 같이 왔지. 내 비법부터 볼까?'],playing:['이 몸이 지켜볼게. …잘해 봐!'],paused:['이 몸도 잠깐 쉴 참이었어. 특별히.'],listening:['이 몸도 듣는 중. 끝까지 들어 봐.'],picked:['골랐군. 이 몸도 끝나면 같이 확인하지.'],success:['훗. 내가 가르쳤지.','이 몸의 제자답군. …잘했어.','내가 봤어. 방금 꽤 멋졌지.'],combo:['이 몸도 놀랐… 아니, 예상했지!'],retry:['나도 처음엔… 아니! 같이 다시 해 보자.','이 몸이 옆에 있잖아. 한 번 더 해 봐.','내 비법? 천천히 다시 하는 거지.'],unanswered:['이 몸도 가끔 놓쳐. 다음엔 같이 해 봐.'],obstacle:['나도 부딪힌 적… 아니! 앞을 봐, 앞.'],timing:['이 몸의 비법. 선에 닿을 때 한 번 더.'],finish:['이 몸과 끝까지 왔군. …꽤 좋았어.'],rest:['이 몸도 잠깐 쉬려던 참이야. 또 오라고.'],hint:['이 몸이 다시 알려 주지. 특별히.']},
 mongle:{ready:['우와, 우리 같이 왔어! 어떻게 하는지 같이 볼까?'],playing:['오! 시작이다! 같이 해 보자!'],paused:['잠깐 쉬는 거야? 좋아, 같이 기다릴게!'],listening:['어떤 말일까? 끝까지 같이 듣자!'],picked:['오! 골랐어! 끝나면 같이 확인하자!'],success:['우와!! 봤어?! 방금 봤어?!','오! 해냈다! 우리 같이 해냈어!','우와! 방금 봤어! 다음도 같이 해 보자!'],combo:['우와, 또 해냈어! 같이 하니까 신나!'],retry:['나도… 어렵네! 다음엔 같이 해 보자!','어? 거의 다 왔어! 같이 다시 해 볼까?','조금 헷갈렸네… 다음엔 같이 찾아보자!'],unanswered:['어? 지나갔네! 다음 건 같이 해 보자!'],obstacle:['앗, 깜짝이야! 앞을 보면서 같이 가자!'],timing:['오! 선에 닿을 때 같이 눌러 보자!'],finish:['우와! 끝까지 왔어! 같이 해서 좋았어!'],rest:['여기까지도 같이 했어! 쉬고 또 만나자!'],hint:['어? 다시 보고 싶어? 같이 보자!']}
};
export const getTutor=id=>TUTORS.find(t=>t.id===id)||null;
export function tutorLine(id,kind,index=0){const bank=LINES[id]?.[kind];return bank?.[Math.max(0,index)%bank.length]||'';}
export function tutorFace(id,kind){
 const tutor=getTutor(id);if(!tutor)return null;
 const desired=kind==='success'||kind==='combo'||kind==='finish'?(id==='kkamong'?'으쓱':id==='marin'?'눈웃음':'기쁨')
  :['retry','unanswered','timing'].includes(kind)?(id==='marin'?'집중':'민망'):kind==='obstacle'?'놀람':kind==='listening'?(id==='marin'?'집중':'기본'):'기본';
 return tutor.images[desired]?desired:'기본';
}
