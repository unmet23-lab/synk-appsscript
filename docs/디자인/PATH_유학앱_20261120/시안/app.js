/* PATH 유학 앱 시안 2판 — 눌러 보는 화면. 조건을 바꾸면 대학과 돈이 따라 바뀌고, 누른 것은 다른 화면에 남는다. */
(function(){
'use strict';
var A='assets/';
var SRC=function(f){var m=window.PATH_ASSETS;return m&&m[f]?m[f]:A+f};
var IC=function(n,c){return '<svg class="'+(c||'ic')+'" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-'+n+'"/></svg>'};
var won=function(n){return n.toLocaleString('ko-KR')};
var man=function(n){return won(Math.round(n/10000))+'만 원'};

/* ── 상태 ── */
var S={topik:2,grade:80,money:0,cur:'KRW',filter:'all',cmp:[],picked:'a',added:false,
  ch:{topik:1,docs:1,money:1,scam:1,univ:0,life:0,job:0,senior:0,parent:0},
  docs:{passport:1,grade:1,grad:0,essay:1,plan:0,bank:0},
  meet:{futsal:0,hike:0},mood:'',year:1,workTopik:4,
  share:{topik:1,att:1,meet:1,intv:1},life:{arc:0}};
var RATE=2.4;
var U={
 a:{name:'예시대학 A',place:'전북 전주',kind:'학부',major:'경영 · 컴퓨터 · 간호',img:'ua.webp',tuition:6400000,dorm:1800000,living:6000000,topik:3,grade:70,fin:16000000,d:61,date:['1월','21'],cert:true,sch:function(t){return t>=4?.5:t>=3?.3:0}},
 b:{name:'예시대학 B 한국어교육원',place:'전북 익산',kind:'어학',major:'한국어 과정 1년',img:'ub.webp',tuition:5200000,dorm:1600000,living:5400000,topik:0,grade:60,fin:8000000,d:40,date:['12월','31'],cert:true,sch:function(){return 0}},
 c:{name:'예시대학 C',place:'충남 천안',kind:'학부',major:'기계 · 호텔 · 디자인',img:'uc.webp',tuition:6800000,dorm:2000000,living:6600000,topik:4,grade:75,fin:16000000,d:75,date:['2월','4'],cert:false,sch:function(t){return t>=5?.6:t>=4?.4:0}}
};
var short=function(u){return u.name.replace(' 한국어교육원','')};
var TOPIK=function(t){return t?'TOPIK '+t+'급':'아직 없음'};
function fit(u,t){t=t==null?S.topik:t;
  return [
   {k:'학력',need:'고등학교 졸업',mine:'2026년 졸업',r:'ok'},
   {k:'성적',need:'평균 '+u.grade+'% 이상',mine:S.grade+'%',r:S.grade>=u.grade?'ok':'lack'},
   {k:'한국어',need:u.topik?TOPIK(u.topik)+' 이상':'없어도 됨',mine:TOPIK(t),r:t>=u.topik?'ok':'lack'},
   {k:'재정',need:'은행 잔고 '+man(u.fin),mine:S.money?man(S.money):'아직 안 적음',r:!S.money?'check':S.money>=u.fin?'ok':'lack'}
  ]}
var RN={ok:'맞음',lack:'부족',check:'확인 필요'};
function okCount(u,t){return fit(u,t).filter(function(x){return x.r==='ok'}).length}
function canGo(t){return Object.keys(U).filter(function(k){var f=fit(U[k],t);return f[1].r==='ok'&&f[2].r==='ok'}).length}
function meter(u){return '<span class="meter">'+fit(u).map(function(x){return '<i class="'+x.r+'"></i>'}).join('')+'</span>'}
function cost(u,t){t=t==null?S.topik:t;var s=Math.round(u.tuition*u.sch(t));return {s:s,total:u.tuition+u.dorm+u.living-s}}
function cur(n){return S.cur==='KRW'?'₩ '+won(n):'₮ '+won(Math.round(n*RATE))}
function docsDone(){return Object.keys(S.docs).filter(function(k){return S.docs[k]}).length}
function hours(){return S.workTopik>=(S.year===1?3:4)?30:10}
function seg(key,opts,cls){return '<div class="seg'+(cls?' '+cls:'')+'">'+opts.map(function(o){return '<button data-set="'+key+'" data-v="'+o[0]+'" aria-pressed="'+(S[key]===o[0])+'">'+o[1]+'</button>'}).join('')+'</div>'}
function TI(f,pos){return '<i class="ti">'+img(f,pos)+'</i>'}
function img(f,pos){return '<img src="'+SRC(f)+'" alt=""'+(pos?' style="object-position:'+pos+'"':'')+'>'}

var V={};

V.today=function(){
  var u=U[S.picked],now=canGo(S.topik),at4=canGo(4),task;
  if(S.topik<3)task={img:'study.webp',pos:'72% 35%',t:'TOPIK 시험을 접수하세요',p:'접수가 12일 뒤에 끝나요.'+(at4>now?' 4급을 따면 갈 수 있는 대학이 '+now+'곳에서 '+at4+'곳으로 늘어요.':''),b:'접수 방법 보기',go:'post',hot:'12일 남음'};
  else if(!S.money)task={img:'gate.webp',pos:'72% 38%',t:'준비한 돈을 적어 주세요',p:'잔고 증명에 필요한 금액과 맞는지 바로 알려 줘요.',b:'내 조건에 적기',go:'cond'};
  else task={img:'gate.webp',pos:'72% 38%',t:'서류를 마저 준비하세요',p:'서류 6개 중 '+docsDone()+'개가 끝났어요. 원서 접수까지 '+u.d+'일 남았어요.',b:'내 길 보기',go:'path'};
  return '<p class="kicker">11월 21일 토요일</p>'+
  '<h2 class="t1">아노 님, 오늘은<br>한 가지만 하면 돼요.</h2>'+
  '<button class="hero" style="margin-top:18px" data-go="'+task.go+'"><span class="hero-img">'+img(task.img,task.pos)+
   '<span class="photo-top"><span class="tag white">지금 할 일</span>'+(task.hot?'<span class="tag hot">'+task.hot+'</span>':'')+'</span></span>'+
   '<span class="hero-body"><b>'+task.t+'</b><p>'+task.p+'</p><span class="cta butter">'+task.b+IC('go')+'</span></span></button>'+

  '<h3 class="h">한국까지 가는 길 <button data-go="path">전체 보기'+IC('r')+'</button></h3>'+
  '<div class="ticket" role="button" tabindex="0" data-go="path">'+
   '<span class="ticket-head"><span>PATH 탑승권</span><span class="mono">ANU · 2027.09</span></span>'+
   '<span class="ticket-route"><span><small>출발</small><b>울란바토르</b></span><span class="fly"><svg viewBox="0 0 24 24"><use href="#i-plane"/></svg></span><span><small>도착</small><b>'+u.place.split(' ')[1]+'</b></span></span>'+
   '<ol class="stops"><li class="now">준비</li><li>지원</li><li>도착</li><li>유학 중</li><li>취업</li></ol>'+
   '<span class="ticket-foot"><span><small>고른 대학</small><b>'+short(u)+'</b></span><span><small>입학</small><b>2027년 9월</b></span><span><small>남은 날</small><b>D-287</b></span><i class="bars" aria-hidden="true"></i></span>'+
  '</div>'+

  '<h3 class="h">다가오는 날</h3><ul class="rows">'+
   '<li><button class="row" data-go="post"><span class="day near"><small>12월</small><b>3</b></span><span class="row-main"><span class="row-t">TOPIK 접수 마감</span><span class="row-s">한국어 준비</span></span><span class="dleft near">D-12</span></button></li>'+
   '<li><button class="row" data-go="path"><span class="day"><small>12월</small><b>25</b></span><span class="row-main"><span class="row-t">졸업증명서에 대사관 확인 받기</span><span class="row-s">지원 서류</span></span><span class="dleft">D-34</span></button></li>'+
   (S.added?'<li><button class="row" data-go="post"><span class="day"><small>1월</small><b>10</b></span><span class="row-main"><span class="row-t">TOPIK 시험 보는 날</span><span class="row-s">채널 글에서 넣었어요</span></span><span class="dleft">D-50</span></button></li>':'')+
   '<li><button class="row" data-go="udetail"><span class="day"><small>'+u.date[0]+'</small><b>'+u.date[1]+'</b></span><span class="row-main"><span class="row-t">'+short(u)+' 원서 접수</span><span class="row-s">고른 대학</span></span><span class="dleft">D-'+u.d+'</span></button></li>'+
  '</ul>'+

  '<h3 class="h">내 조건 <button data-go="cond">바꿔 보기'+IC('r')+'</button></h3>'+
  '<button class="fit4" data-go="cond">'+fit(u).map(function(x){return '<span class="'+x.r+'"><b>'+x.k+'</b>'+RN[x.r]+'</span>'}).join('')+'</button>'+

  '<h3 class="h">새 소식 <button data-go="channels">채널'+IC('r')+'</button></h3>'+
  '<div class="news2">'+
   '<button class="news" data-go="post"><i class="ti">'+img('room.webp','78% 60%;transform:scale(1.55);transform-origin:76% 58%')+'</i><small>TOPIK</small><b>TOPIK 성적은 2년 동안만 쓸 수 있어요</b></button>'+
   '<button class="news" data-go="channels"><i class="ti">'+img('parents.webp','50% 30%')+'</i><small>사기 주의</small><b>「합격 보장」이라는 말을 들었다면</b></button>'+
  '</div>'+
  '<button class="btn2" style="width:100%;margin-top:26px" data-go="parent">'+IC('heart')+'부모님이 보는 화면</button>';
};

var CH=[
 {id:'topik',n:'TOPIK',s:'시험 일정, 접수, 성적 쓰는 법',ic:'pen',c:'lapis',news:2},
 {id:'docs',n:'비자와 서류',s:'유학 비자, 잔고 증명, 대사관 확인',ic:'doc',c:'ink',news:1},
 {id:'money',n:'장학금',s:'정부 장학금, 대학 장학금, 모집 시기',ic:'star',c:'butter',news:0},
 {id:'scam',n:'사기 주의',s:'가짜 유학원 가리는 법, 신고하는 곳',ic:'alert',c:'coral',news:0},
 {id:'univ',n:'대학 소식',s:'협력 대학마다 방이 하나씩 열려요',ic:'cap',c:'',soon:1},
 {id:'life',n:'한국 생활',s:'집, 통장, 휴대폰, 병원, 아르바이트',ic:'home',c:'meadow'},
 {id:'job',n:'취업',s:'졸업 뒤 비자, 일손이 모자란 직종',ic:'bag',c:'lapis'},
 {id:'senior',n:'선배 이야기',s:'먼저 간 학생이 직접 쓴 글과 영상',ic:'chat',c:'butter'},
 {id:'parent',n:'부모님 방',s:'비용, 안전, 진행 상황을 부모님 말로',ic:'heart',c:'coral'}
];
V.channels=function(){
  var on=CH.filter(function(c){return S.ch[c.id]}),off=CH.filter(function(c){return !S.ch[c.id]});
  var row=function(c){return '<li class="row"><span class="sq '+c.c+'">'+IC(c.ic)+'</span><span class="row-main"><span class="row-t">'+c.n+(c.soon?' <span class="tag wait" style="height:22px;vertical-align:1px">준비 중</span>':'')+'</span><span class="row-s">'+c.s+'</span></span>'+
    (S.ch[c.id]?(c.news?'<span class="badge">'+c.news+'</span>':'')+'<button class="mini on" data-ch="'+c.id+'">받는 중</button>':'<button class="mini" data-ch="'+c.id+'">받기</button>')+'</li>'};
  return '<h2 class="t1" style="margin-top:8px">채널</h2><p class="lead">한국 유학 소식을 주제별로 받아요. 모든 글에 공식 출처와 확인한 날짜가 붙어 있어요.</p>'+
  '<button class="hero" style="margin-top:18px" data-go="post"><span class="hero-img">'+img('study.webp','72% 35%')+'<span class="photo-top"><span class="tag white">TOPIK · 오늘</span></span></span><span class="hero-body"><b>TOPIK 성적은 2년 동안만 쓸 수 있어요</b><p>아노 님의 성적은 2027년 4월에 끝나요. 눌러서 읽어 보세요.</p></span></button>'+
  '<h3 class="h">받고 있는 채널 <span class="num" style="font-size:15px;color:var(--gray)">'+on.length+'</span></h3><ul class="rows">'+on.map(row).join('')+'</ul>'+
  (off.length?'<h3 class="h">더 받을 수 있는 채널</h3><ul class="rows">'+off.map(row).join('')+'</ul>':'');
};

V.post=function(){
  return '<button class="back" data-go="channels">'+IC('l')+'TOPIK 채널</button>'+
  '<div class="photo plain" style="aspect-ratio:16/10">'+img('study.webp','72% 35%')+'</div>'+
  '<p class="kicker" style="margin-top:16px">TOPIK · 오늘 올라온 글</p>'+
  '<h2 class="t1">TOPIK 성적은 2년 동안만 쓸 수 있어요</h2>'+
  '<ol class="points"><li>성적은 발표한 날부터 2년 동안 쓸 수 있어요.</li><li>원서를 낼 때와 비자를 신청할 때 성적이 살아 있어야 해요.</li><li>한국에 온 뒤에도 일할 수 있는 시간이 급수에 따라 달라져요.</li></ol>'+
  '<p class="src"><b>출처</b> Study in Korea 「한국어 시험」 · 확인 2026-11-20</p>'+
  '<div class="card butter" style="margin-top:22px"><p class="card-k">내게 해당되나요?</p><h4>아노 님의 2급 성적은 2027년 4월에 끝나요.</h4><p class="lead">2027년 9월 입학 원서에는 쓸 수 없어요. 1월 시험에서 급수를 올리면 2029년 초까지 쓸 수 있어요.</p>'+
   '<button class="cta'+(S.added?' done':'')+'" data-act="add">'+(S.added?'내 길에 넣었어요':'1월 시험을 내 길에 넣기')+'</button></div>'+
  '<div class="btn-row"><button class="btn2" data-toast="저장했습니다. 채널 탭에서 다시 볼 수 있습니다.">저장</button><button class="btn2" data-go="chat">이 글에 대해 묻기</button></div>'+
  '<h3 class="h">접수하는 순서</h3><ol class="steps">'+
   '<li class="done"><div class="st">시험 날짜 고르기</div><div class="ss">2027년 1월 10일, 울란바토르 시험장</div></li>'+
   '<li class="now"><div class="st">접수하기 <span class="tag lack">D-12</span></div><div class="ss">공식 접수처로 연결돼요. 접수는 본인이 직접 해요.</div></li>'+
   '<li><div class="st">수험표 저장</div><div class="ss">접수 번호를 넣으면 시험 전날 다시 알려 줘요.</div></li>'+
   '<li><div class="st">성적 올리기</div><div class="ss">성적표를 올리면 내 조건과 갈 수 있는 대학이 바로 바뀌어요.</div></li></ol>';
};

V.cond=function(){
  var ok3=S.topik>=3,n=canGo(S.topik),n4=canGo(4);
  return '<button class="back" data-go="today">'+IC('l')+'오늘</button>'+
  '<h2 class="t1">내 조건</h2><p class="lead">눌러서 바꿔 보세요. 갈 수 있는 길과 대학이 바로 따라 바뀌어요.</p>'+
  '<div class="field"><label>한국어 <span>'+TOPIK(S.topik)+'</span></label>'+seg('topik',[[0,'없음'],[1,'1급'],[2,'2급'],[3,'3급'],[4,'4급'],[5,'5급']])+'</div>'+
  '<div class="field"><label>고등학교 성적 <span>평균 '+S.grade+'%</span></label>'+seg('grade',[[60,'60%'],[70,'70%'],[80,'80%'],[90,'90%']])+'</div>'+
  '<div class="field"><label>준비한 돈 <span>'+(S.money?man(S.money):'아직 안 적음')+'</span></label>'+seg('money',[[0,'아직'],[8000000,'800만'],[16000000,'1,600만'],[20000000,'2,000만']])+'</div>'+
  '<div class="card lapis" style="margin-top:24px"><p class="card-k">지금 조건으로</p><div class="bigline"><span>대학</span><span class="num">'+n+'</span><span>곳에 지원할 수 있어요</span></div>'+
   '<p class="lead">'+(S.topik<4&&n4>n?'4급을 따면 '+n4+'곳으로 늘어요.':S.grade<75?'성적 조건 때문에 못 가는 곳이 있어요.':'한국어와 성적 조건을 세 곳 모두 채웠어요.')+(S.money?'':' 준비한 돈을 적으면 재정 조건도 맞춰 볼 수 있어요.')+'</p><button class="cta" data-go="univ">대학 보기'+IC('go')+'</button></div>'+
  '<h3 class="h">갈 수 있는 길</h3>'+
  '<div class="card line"><div class="match-top"><b>어학 과정 먼저, 그다음 학부</b><span class="tag ok">지금 시작 가능</span></div><p class="lead">한국에서 1년 동안 한국어를 배운 뒤 학부에 들어가요. 한국어 성적이 없어도 지원할 수 있어요.</p><p class="src"><b>비자</b> 어학연수(D-4) → 유학(D-2)</p></div>'+
  '<div class="card line" style="margin-top:10px"><div class="match-top"><b>바로 학부 입학</b>'+(ok3?'<span class="tag ok">지금 시작 가능</span>':'<span class="tag lack">한국어 '+['','한','두','세'][3-S.topik]+' 급 더 필요</span>')+'</div><p class="lead">'+(ok3?'한국어 조건을 채웠어요. 대학마다 필요한 급수가 달라요.':'TOPIK 3급을 따면 열려요. 1월과 4월, 두 번의 기회가 있어요.')+'</p>'+(ok3?'':'<button class="link" data-go="post">3급까지 가는 길 보기'+IC('r')+'</button>')+'<p class="src"><b>비자</b> 유학(D-2)</p></div>'+
  '<p class="fine">이 결과는 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.</p>';
};

V.univ=function(){
  var keys=Object.keys(U).filter(function(k){return S.filter==='all'||(S.filter==='fit'?okCount(U[k])>=3:U[k].kind===S.filter)});
  var chip=function(v,t){return '<button class="chip" data-set="filter" data-v="'+v+'" aria-pressed="'+(S.filter===v)+'">'+t+'</button>'};
  return '<p class="kicker">협력 대학 <span class="tag wait" style="height:22px;margin-left:4px">준비 중</span></p>'+
  '<h2 class="t1">내 조건으로<br>갈 수 있는 대학</h2>'+
  '<div class="chips">'+chip('all','전체 3')+chip('fit','조건이 맞는 곳')+chip('어학','어학 과정')+chip('학부','학부')+'</div>'+
  keys.map(function(k){var u=U[k],n=okCount(u),on=S.cmp.indexOf(k)>=0;
    return '<div class="ucard"><div style="position:relative"><button class="photo" data-u="'+k+'">'+img(u.img)+'<span class="photo-top"><span>'+(u.cert?'<span class="tag white">교육부 인증 대학</span>':'')+'</span></span><span class="photo-body"><small>'+u.place+' · '+u.kind+'</small><b>'+u.name+'</b></span></button><button class="pick'+(on?' on':'')+'" data-cmp="'+k+'">'+(on?'비교에 담음':'비교')+'</button></div>'+
    '<div class="ucard-info"><dl class="facts"><div><dt>한 해 '+(u.kind==='어학'?'수업료':'등록금')+'</dt><dd>'+man(u.tuition)+'</dd></div><div><dt>필요한 한국어</dt><dd>'+(u.topik?u.topik+'급':'없어도 됨')+'</dd></div><div><dt>원서 접수</dt><dd>D-'+u.d+'</dd></div></dl>'+
    '<div class="fitline"><span>내 조건 4개 중 '+n+'개 맞음</span>'+meter(u)+'</div></div></div>'}).join('')+
  (keys.length?'':'<div class="card" style="margin-top:16px"><h4>조건이 세 개 넘게 맞는 곳이 아직 없어요.</h4><p class="lead">내 조건에서 한국어나 준비한 돈을 바꿔 보세요.</p><button class="cta" data-go="cond">내 조건 바꿔 보기</button></div>')+
  (S.cmp.length>=2?'<div class="cmpbar"><button class="cta butter" data-go="compare">'+S.cmp.length+'곳 나란히 보기'+IC('go')+'</button></div>':'')+
  '<p class="fine" style="margin-top:20px">대학 이름과 금액은 자리를 보이려고 넣은 예시예요. 협력 대학이 아닌 곳은 한국 정부의 유학 안내 사이트로 연결해 줘요.</p>';
};

V.compare=function(){
  var ks=S.cmp.length>=2?S.cmp:['a','c'];
  var tr=function(h,fn){return '<tr><th>'+h+'</th>'+ks.map(function(k){return '<td>'+fn(U[k])+'</td>'}).join('')+'</tr>'};
  return '<button class="back" data-go="univ">'+IC('l')+'대학</button><h2 class="t1">나란히 보기</h2>'+
  '<table class="cmp">'+tr('',function(u){return '<img src="'+SRC(u.img)+'" alt="" style="width:100%;height:64px;border-radius:12px;object-fit:cover"><span style="display:block;margin-top:6px">'+short(u)+'</span>'})+
   tr('지역',function(u){return u.place})+tr('과정',function(u){return u.kind})+tr('한 해 수업료',function(u){return man(u.tuition)})+
   tr('내가 낼 돈',function(u){return man(cost(u).total)})+tr('필요한 한국어',function(u){return u.topik?u.topik+'급':'없어도 됨'})+
   tr('잔고 증명',function(u){return man(u.fin)})+tr('원서 접수',function(u){return 'D-'+u.d})+
   tr('내 조건',function(u){return okCount(u)+' / 4'+meter(u)})+'</table>'+
  '<p class="fine">금액은 예시예요. 「내가 낼 돈」은 지금 내 한국어 급수의 장학금을 뺀 값이에요.</p>';
};

V.udetail=function(){
  var u=U[S.picked],f=fit(u),c=cost(u),pct=Math.round(u.sch(S.topik)*100),up=Math.max(S.topik+1,u.topik),cu=cost(u,up);
  return '<button class="back" data-go="univ">'+IC('l')+'대학</button>'+
  '<div class="photo" style="aspect-ratio:4/3.3">'+img(u.img)+'<span class="photo-top"><span>'+(u.cert?'<span class="tag white">교육부 인증 대학</span>':'')+'</span><span class="tag white">원서 접수 D-'+u.d+'</span></span><span class="photo-body"><small>'+u.place+' · '+u.kind+' · '+u.major+'</small><b style="font-size:27px">'+u.name+'</b></span></div>'+

  '<h3 class="h">내 조건과 맞춰 보기 '+meter(u)+'</h3>'+
  '<ul class="match">'+f.map(function(x){return '<li><div class="match-top"><b>'+x.k+'</b><span class="tag '+x.r+'">'+RN[x.r]+'</span></div><div class="match-grid"><div><span>필요한 것</span><strong>'+x.need+'</strong></div><div><span>내 것</span><strong>'+x.mine+'</strong></div></div>'+
    (x.k==='한국어'&&x.r==='lack'?'<button class="link" data-go="post">'+u.topik+'급까지 가는 길 보기'+IC('r')+'</button>':'')+
    (x.k==='성적'&&x.r==='lack'?'<button class="link" data-go="univ">성적 조건이 맞는 대학 보기'+IC('r')+'</button>':'')+
    (x.k==='재정'?(x.r!=='ok'?'<button class="link" data-go="cond">준비한 돈 적기'+IC('r')+'</button>':'')+'<p class="src"><b>출처</b> 법무부 2023-06-23 발표('+(u.kind==='어학'?'지방 대학 어학연수':'지방 대학 학위 과정')+') · 확인 2026-11-20</p>':'')+'</li>'}).join('')+'</ul>'+

  '<h3 class="h">한 해에 드는 돈</h3>'+
  '<div class="money-hero"><small>내가 낼 돈</small><span class="big">'+cur(c.total)+'</span><small>'+(c.s?'한국어 '+S.topik+'급 장학금 '+pct+'%를 뺀 값이에요':u.kind==='어학'?'어학 과정은 장학금이 없어요':'지금 급수로는 장학금이 없어요')+'</small>'+seg('cur',[['KRW','원'],['MNT','투그릭']],'sm')+'</div>'+
  '<ul class="money"><li><span>'+(u.kind==='어학'?'수업료':'등록금')+'</span><span>'+cur(u.tuition)+'</span></li><li><span>기숙사</span><span>'+cur(u.dorm)+'</span></li><li><span>생활비</span><span>'+cur(u.living)+'</span></li>'+
   (c.s?'<li class="minus"><span>장학금</span><span>− '+cur(c.s)+'</span></li>':'')+'</ul>'+
  (cu.total<c.total?'<div class="card meadow" style="margin-top:12px"><p class="card-k">급수를 올리면</p><h4>'+up+'급이면 내가 낼 돈이 '+cur(cu.total)+'으로 줄어요.</h4></div>':'')+
  '<p class="src"><b>출처</b> '+short(u)+' 2027학년도 모집 요강 · 확인 2026-11-20'+(S.cur==='MNT'?' · 1원을 2.4투그릭으로 셈':'')+'</p>'+

  '<h3 class="h">학교 주변</h3><div class="tiles">'+
   '<button class="tile" data-toast="학교에서 걸어갈 수 있는 방, 보증금과 월세, 계약할 때 조심할 것을 보여 줍니다.">'+TI('room.webp','76% 55%;transform:scale(1.5);transform-origin:74% 55%')+'<span><b>집 구하기</b>기숙사와 원룸 14곳</span></button>'+
   '<button class="tile" data-toast="같은 나라에서 온 선배에게 질문을 보냅니다.">'+TI('meet.webp','60% 45%;transform:scale(1.45);transform-origin:62% 48%')+'<span><b>선배에게 묻기</b>몽골 선배 12명</span></button>'+
   '<button class="tile" data-toast="공항 마중부터 외국인등록, 통장, 휴대폰까지 첫 달 순서를 보여 줍니다.">'+TI('arrive.webp','50% 35%')+'<span><b>도착한 첫 달</b>공항 마중과 꼭 할 일</span></button>'+
   '<button class="tile" data-go="life">'+TI('futsal.webp','50% 40%')+'<span><b>모임</b>풋살, 등산, 저녁 식사</span></button>'+
  '</div>'+
  '<button class="cta" style="margin-top:26px" data-act="pick">'+short(u)+'로 준비 시작'+IC('go')+'</button>';
};

var DOCS=[['passport','여권 사본','담당자가 확인했어요'],['grade','성적증명서','담당자가 확인했어요'],['grad','졸업증명서','한국 대사관에서 확인 도장을 받아야 해요'],['essay','자기소개서','내가 쓰고 확인했어요'],['plan','학업 계획서','담당자 의견 2개를 고쳐야 해요'],['bank','은행 잔고 증명','원서 낼 때 필요해요']];
var CHECKED={passport:1,grade:1,essay:1};
V.path=function(){
  var n=docsDone(),u=U[S.picked];
  return '<p class="kicker">'+short(u)+' · 2027년 9월 입학</p><h2 class="t1">내 길</h2>'+
  '<div class="photo" style="aspect-ratio:16/9.5;margin-top:16px">'+img('gate.webp','72% 38%')+'<span class="photo-body"><small>지금 단계 · 지원</small><b>서류 6개 중 '+n+'개를 끝냈어요</b></span></div>'+
  '<div class="week" style="grid-template-columns:repeat(6,1fr)">'+DOCS.map(function(d){return '<i class="'+(S.docs[d[0]]?'on':'')+'"></i>'}).join('')+'</div>'+
  '<h3 class="h">지원 서류</h3><ul class="rows">'+DOCS.map(function(d){var on=S.docs[d[0]];return '<li class="row"><button class="chk'+(on?' on':'')+'" data-doc="'+d[0]+'" aria-label="'+d[1]+'"></button><span class="row-main"><span class="row-t">'+d[1]+'</span><span class="row-s">'+(on&&!CHECKED[d[0]]?'끝냈어요. 담당자 확인을 기다려요':d[2])+'</span></span>'+(on?'<span class="tag ok">'+(CHECKED[d[0]]?'확인됨':'확인 중')+'</span>':d[0]==='grad'?'<span class="dleft">D-34</span>':'<span class="tag wait">아직</span>')+'</li>'}).join('')+'</ul>'+
  (n===6?'<button class="cta butter" style="margin-top:14px" data-toast="담당자가 여섯 개를 모두 확인하면 원서 내기가 열립니다.">원서 낼 준비가 됐어요'+IC('go')+'</button>':'')+
  '<h3 class="h">수수료</h3><div class="card"><h4>수수료는 세 번에 나눠 내요.</h4><p class="lead">한 번에 다 내지 않아요. 일이 진행된 만큼만 내요.</p>'+
   '<div class="fee"><div><span class="n">1</span><b>계약할 때</b><span class="tag ok">냈어요</span></div><div><span class="n">2</span><b>합격했을 때</b><span class="tag wait">합격 뒤</span></div><div><span class="n">3</span><b>입학 준비 때</b><span class="tag wait">비자 뒤</span></div></div>'+
   '<p class="fine">금액, 영수증, 돌려받는 조건이 계약서와 똑같이 여기에 남아요. 부모님 화면에도 같이 보여요.</p></div>'+
  '<h3 class="h">앞으로의 순서</h3><ol class="steps">'+
   '<li class="now"><div class="st">원서 내기 <span class="tag check">D-'+u.d+'</span></div><div class="ss">서류 6개가 모두 확인되면 열려요.</div></li>'+
   '<li><div class="st">합격 발표와 입학 허가서</div><div class="ss">대학이 표준입학허가서를 보내요.</div></li>'+
   '<li><div class="st">유학 비자 신청</div><div class="ss">대사관에 낼 서류를 앱이 다시 모아 줘요.</div></li>'+
   '<li><div class="st">출국과 공항 마중</div><div class="ss">비행기, 기숙사, 첫 주 일정을 함께 정해요.</div></li></ol>';
};

V.parent=function(){
  return '<button class="back" data-go="today">'+IC('l')+'오늘</button>'+
  '<div class="hero"><span class="hero-img">'+img('parents.webp','50% 30%')+'<span class="photo-top"><span class="tag white">부모님이 보는 화면</span></span></span><span class="hero-body"><b>아노는 지금 「준비」 단계예요</b><p>학생이 보는 것과 같은 내용을 부모님 말로 보여 줘요. 몽골어로 열려요.</p></span></div>'+
  '<h3 class="h">지금까지 낸 돈</h3><div class="money-hero"><small>수수료 세 번 가운데</small><span class="big">한 번 냈어요</span><small>다음은 합격한 뒤에 내요. 그 전에는 더 내지 않아요.</small></div>'+
  '<h3 class="h">다음 일정</h3><ul class="rows">'+
   '<li class="row"><span class="day near"><small>12월</small><b>3</b></span><span class="row-main"><span class="row-t">한국어 시험 접수 마감</span><span class="row-s">아노가 직접 접수해요</span></span></li>'+
   '<li class="row"><span class="day"><small>12월</small><b>25</b></span><span class="row-main"><span class="row-t">졸업증명서 대사관 확인</span><span class="row-s">부모님 도움이 필요할 수 있어요</span></span></li></ul>'+
  '<div class="card coralw" style="margin-top:22px"><p class="card-k">꼭 알아 두세요</p><h4>SYNK는 이 화면에 없는 돈을 따로 달라고 하지 않아요.</h4><p class="lead">그런 연락을 받으면 아래 단추로 바로 알려 주세요.</p><button class="cta" data-toast="담당자에게 바로 전달됩니다. 받은 메시지나 통화 녹음을 함께 보낼 수 있습니다.">수상한 연락 알리기</button></div>';
};

V.life=function(){
  var h=hours();
  return '<p class="kicker">한국에 온 지 49일째 · '+U.a.name+' 1학년</p><h2 class="t1">이번 주도<br>잘 지내고 있나요?</h2>'+
  '<div class="card butter" style="margin-top:16px"><p class="card-k">이번 주 어땠어요?</p><div class="mood">'+['좋아요','그냥 그래요','힘들어요'].map(function(m){return '<button data-mood="'+m+'" aria-pressed="'+(S.mood===m)+'">'+m+'</button>'}).join('')+'</div>'+
   '<p class="fine" style="color:var(--butter-deep)">'+(S.mood==='힘들어요'?'알려 줘서 고마워요. 담당 매니저가 오늘 안에 몽골어로 연락할게요.':S.mood?'고마워요. 다음 주에 다시 물어볼게요.':'「힘들어요」를 누르면 담당 매니저가 몽골어로 하루 안에 연락해요.')+'</p></div>'+

  '<h3 class="h">이번 달 모임</h3>'+
  '<div class="hero"><span class="hero-img">'+img('futsal.webp','50% 35%')+'<span class="photo-top"><span class="tag white">11월 28일 토요일 저녁</span></span></span><span class="hero-body"><b>풋살 한 판, 끝나고 같이 저녁</b><p>한국 학생 6명을 포함해 '+(14+S.meet.futsal)+'명이 와요.</p><button class="cta '+(S.meet.futsal?'done':'butter')+'" data-meet="futsal">'+(S.meet.futsal?'신청했어요':'나도 갈래요')+'</button></span></div>'+
  '<ul class="rows" style="margin-top:6px"><li class="row"><img class="thumb" src="'+SRC('hike.webp')+'" alt="" style="object-position:50% 30%"><span class="row-main"><span class="row-t">모악산 오르기</span><span class="row-s">12월 6일 일요일 · '+(9+S.meet.hike)+'명</span></span><button class="mini'+(S.meet.hike?' on':'')+'" data-meet="hike">'+(S.meet.hike?'신청함':'신청')+'</button></li></ul>'+

  '<h3 class="h">꼭 해야 하는 일</h3><ul class="rows">'+
   '<li class="row"><button class="chk'+(S.life.arc?' on':'')+'" data-life="arc" aria-label="외국인등록"></button><span class="row-main"><span class="row-t">외국인등록</span><span class="row-s">한국에 온 지 90일 안에 해야 해요</span></span>'+(S.life.arc?'<span class="tag ok">끝</span>':'<button class="mini" data-toast="출입국 방문 예약 화면으로 연결합니다.">예약 · D-41</button>')+'</li>'+
   '<li class="row"><span class="chk on"></span><span class="row-main"><span class="row-t">통장 만들기</span><span class="row-s">10월 8일에 했어요</span></span><span class="tag ok">끝</span></li>'+
   '<li class="row"><span class="chk on"></span><span class="row-main"><span class="row-t">휴대폰 개통</span><span class="row-s">10월 3일에 했어요</span></span><span class="tag ok">끝</span></li>'+
   '<li class="row"><span class="chk'+(S.life.arc?' on':'')+'"></span><span class="row-main"><span class="row-t">건강보험</span><span class="row-s">외국인등록을 하면 자동으로 들어가요</span></span>'+(S.life.arc?'<span class="tag ok">끝</span>':'<span class="tag wait">등록 뒤</span>')+'</li></ul>'+
  '<p class="src"><b>출처</b> Study in Korea 「출입국」, 「주거와 생활」 · 확인 2026-11-20</p>'+

  '<h3 class="h">더 챙길 것</h3><div class="tiles">'+
   '<button class="tile" data-go="topik">'+TI('study.webp','72% 35%')+'<span><b>한국어 4급 지키기</b>성적이 끝나기까지 412일</span></button>'+
   '<button class="tile" data-go="work">'+TI('job.webp','40% 30%;transform:scale(1.5);transform-origin:38% 35%')+'<span><b>아르바이트</b>한 주 '+h+'시간까지</span></button>'+
   '<button class="tile" data-toast="다음 학기에 옮길 수 있는 방과 계약할 때 조심할 것을 보여 줍니다.">'+TI('room.webp','76% 55%;transform:scale(1.5);transform-origin:74% 55%')+'<span><b>집 구하기</b>다음 학기 방 14곳</span></button>'+
   '<button class="tile" data-go="chat">'+TI('arrive.webp','80% 30%;transform:scale(1.7);transform-origin:82% 34%')+'<span><b>내 매니저</b>몽골어로 물어보기</span></button></div>';
};

V.work=function(){
  var h=hours();
  return '<button class="back" data-go="life">'+IC('l')+'생활</button>'+
  '<h2 class="t1">아르바이트</h2><p class="lead">학년과 한국어 급수를 누르면 일할 수 있는 시간을 알려 줘요.</p>'+
  '<div class="money-hero" style="margin-top:18px"><small>내가 일할 수 있는 시간</small><span class="big">한 주 '+h+'시간</span><small>'+(h===30?'급수 조건을 채웠고 인증 대학이라 5시간이 더해졌어요.':(S.year===1?'1~2학년은 3급':'3~4학년은 4급')+'이 필요해요. 급수가 모자라면 10시간까지예요.')+'</small></div>'+
  '<div class="field"><label>학년</label>'+seg('year',[[1,'1~2학년'],[3,'3~4학년']])+'</div>'+
  '<div class="field"><label>한국어 <span>TOPIK '+S.workTopik+'급</span></label>'+seg('workTopik',[[2,'2급'],[3,'3급'],[4,'4급']])+'</div>'+
  '<p class="src"><b>출처</b> Study in Korea 「시간제 취업」, 법무부 2023-06-23 발표 · 확인 2026-11-20</p>'+
  '<h3 class="h">일하기 전에</h3><ol class="steps">'+
   '<li class="now"><div class="st">허가 먼저 받기</div><div class="ss">허가 없이 일하면 비자가 취소될 수 있어요. 신청 서류를 앱이 모아 줘요.</div></li>'+
   '<li><div class="st">할 수 없는 일 확인하기</div><div class="ss">배달처럼 유학생이 할 수 없는 일이 있어요.</div></li>'+
   '<li><div class="st">일한 시간 적기</div><div class="ss">한 주에 남은 시간을 앱이 세어 줘요.</div></li></ol>'+
  '<button class="cta" style="margin-top:20px" data-toast="허가 신청에 필요한 서류를 모으고 출입국 예약으로 연결합니다.">허가 신청 준비하기'+IC('go')+'</button>';
};

V.topik=function(){
  return '<button class="back" data-go="life">'+IC('l')+'생활</button>'+
  '<div class="hero"><span class="hero-img">'+img('room.webp','78% 60%;transform:scale(1.55);transform-origin:76% 58%')+'<span class="photo-top"><span class="tag white">한국어 4급 지키기</span></span></span><span class="hero-body"><b>성적이 끝나기 전에 다시 따요</b><p>하루 10분, 드라마 한 장면씩 이어 가요.</p></span></div>'+
  '<div class="card lapis" style="margin-top:14px"><p class="card-k">지금 성적(TOPIK 4급)이 끝나는 날까지</p><div class="bigline"><span class="num">412</span><span>일</span></div><p class="lead">아르바이트 허가를 받을 때와 비자를 바꿀 때 살아 있는 성적이 필요해요. 끝나기 6개월 전 시험을 미리 잡아 둬요.</p><p class="src"><b>출처</b> Study in Korea 「한국어 시험」 · 확인 2026-11-20</p></div>'+
  '<h3 class="h">지금 내 실력</h3><ul class="bar3"><li><span>듣기</span><span class="track"><span class="fill" style="width:78%"></span></span><span>78</span></li><li><span>읽기</span><span class="track"><span class="fill" style="width:71%"></span></span><span>71</span></li><li class="weak"><span>쓰기</span><span class="track"><span class="fill" style="width:46%"></span></span><span>46</span></li></ul>'+
  '<p class="fine">한국어 앱에서 푼 문제의 맞고 틀린 기록으로 계산해요. 쓰기가 약해서 이번 주는 쓰기 장면이 먼저 나와요.</p>'+
  '<h3 class="h">이번 주 <span class="num" style="font-size:15px;color:var(--gray)">3 / 5</span></h3><ul class="rows">'+
   '<li class="row"><span class="chk on"></span><span class="row-main"><span class="row-t">드라마 7화 · 병원에서</span><span class="row-s">듣기 12문제</span></span></li>'+
   '<li class="row"><span class="chk on"></span><span class="row-main"><span class="row-t">드라마 8화 · 조별 과제</span><span class="row-s">읽기 10문제</span></span></li>'+
   '<li class="row"><span class="chk on"></span><span class="row-main"><span class="row-t">쓰기 연습 · 53번 유형</span><span class="row-s">튜터가 고쳐 줬어요</span></span></li>'+
   '<li class="row"><span class="chk now"></span><span class="row-main"><span class="row-t">드라마 9화 · 아르바이트 면접</span><span class="row-s">쓰기 2문제 · 지금 할 차례</span></span></li>'+
   '<li class="row"><span class="chk"></span><span class="row-main"><span class="row-t">주말 모의시험</span><span class="row-s">30분</span></span></li></ul>'+
  '<button class="cta" style="margin-top:18px" data-toast="한국어 앱(SYNK WORLD)의 9화로 넘어갑니다.">9화 이어서 하기'+IC('go')+'</button>';
};

var REC=[['topik','한국어 4급 유지','3','년'],['att','출석','96','%'],['meet','모임과 봉사','14','번'],['intv','면접 연습','5','번']];
V.job=function(){
  var n=REC.filter(function(r){return S.share[r[0]]}).length;
  return '<p class="kicker">졸업까지 3학기 · 목표: 무역 회사 사무</p><h2 class="t1">졸업한 뒤<br>일할 자리까지</h2>'+
  '<div class="hero" style="margin-top:16px"><span class="hero-img">'+img('job.webp','78% 30%')+'<span class="photo-top"><span class="tag white">지원할 수 있는 공고 12건</span></span></span><span class="hero-body"><b>내 비자와 한국어 급수에 맞는 공고만 보여 줘요</b><button class="cta butter" data-toast="내 비자와 한국어 급수로 지원할 수 있는 공고만 보여 줍니다.">공고 보기'+IC('go')+'</button></span></div>'+

  '<h3 class="h">내 기록 한 장</h3>'+
  '<div class="paper"><span class="seal">PATH<br>확인</span><div class="paper-k">PATH가 확인한 기록</div><h4>아노 바트의 3년</h4><p>항목을 눌러 회사에 보여 줄 것만 고르세요.</p>'+
   '<div class="rec">'+REC.map(function(r){return '<button class="'+(S.share[r[0]]?'':'off')+'" data-share="'+r[0]+'" aria-pressed="'+!!S.share[r[0]]+'"><span>'+r[1]+'</span><b>'+r[2]+'<small>'+r[3]+'</small></b></button>'}).join('')+'</div></div>'+
  '<button class="cta" style="margin-top:14px" data-toast="고른 '+n+'개 항목을 30일 동안 열어 볼 수 있는 주소로 만듭니다.">'+(n?n+'개 항목을 회사에 보여 주기':'보여 줄 항목을 골라 주세요')+'</button>'+
  '<p class="fine">내가 고른 항목만, 내가 고른 회사에만 보여요.</p>'+

  '<h3 class="h">그 자리까지 가는 길</h3><ol class="steps">'+
   '<li class="done"><div class="st">한국어 4급 <span class="tag ok">지키는 중</span></div><div class="ss">3년째 끊기지 않았어요.</div></li>'+
   '<li class="now"><div class="st">대학 졸업 <span class="tag check">3학기 남음</span></div><div class="ss">졸업에 필요한 학점과 한국어 조건을 학기마다 확인해요.</div></li>'+
   '<li><div class="st">구직 비자로 바꾸기</div><div class="ss">졸업한 뒤 일자리를 찾는 동안 쓰는 비자(D-10)예요. 한 번에 6개월, 가장 길게 2년이에요.</div></li>'+
   '<li><div class="st">취업 비자 받기</div><div class="ss">회사와 계약한 뒤 받는 비자(E-7 등)예요. 한국에서 학사를 마치면 전공과 다른 직종도 돼요.</div></li>'+
   '<li><div class="st">오래 살 수 있는 비자</div><div class="ss">점수 80점을 채우면 열려요(F-2). 한국어 4급은 15점이에요.</div></li></ol>'+
  '<p class="src"><b>출처</b> Study in Korea 「체류와 취업」 · 확인 2026-11-20</p>'+

  '<h3 class="h">미리 해 보기</h3><ul class="rows">'+
   '<li><button class="row" data-toast="무역 회사 사무실을 VR로 걸어 보고 하루 일을 따라 해 봅니다."><span class="sq ink">'+IC('vr')+'</span><span class="row-main"><span class="row-t">일터 미리 가 보기</span><span class="row-s">사무실을 걸어 보고 하루 일을 해 봐요</span></span>'+IC('r','chev')+'</button></li>'+
   '<li><button class="row" data-toast="목표 직종의 면접 질문으로 연습합니다."><span class="sq lapis">'+IC('mic')+'</span><span class="row-main"><span class="row-t">면접 연습</span><span class="row-s">무역 회사 사무직 질문으로 연습해요</span></span>'+IC('r','chev')+'</button></li></ul>';
};

V.chat=function(){
  var u=U[S.picked];
  return '<h2 class="t1" style="margin-top:8px">물어보기</h2><p class="lead">몽골어로 물어도 돼요. 답에는 출처가 붙고, 사람 상담원에게 넘길 수 있어요.</p>'+
  '<div class="chat"><div class="msg me">은행 잔고 증명은 얼마가 필요해요?</div>'+
   '<div class="msg you">아노 님이 고른 '+short(u)+'는 지방에 있어서 '+(u.kind==='어학'?'어학연수 비자에 800만 원':'학위 과정 유학 비자에 1,600만 원')+'이 든 잔고 증명이 필요해요. TOPIK 4급이 있으면 이 증명을 면제하는 계획이 발표됐는데, 시작하는 날은 아직 정해지지 않았어요.<p class="src"><b>출처</b> 법무부 2023-06-23, 2026-10-07 발표 · 확인 2026-11-20</p></div>'+
   '<div class="msg me">부모님 통장이어도 돼요?</div>'+
   '<div class="msg you">이 질문은 서류마다 달라서 상담원이 직접 답해야 해요. 지금 넘길까요?</div></div>'+
  '<div class="quick"><button class="mini" data-toast="담당 상담원에게 대화를 넘겼습니다. 답이 오면 알려 드립니다.">상담원에게 넘기기</button><button class="mini ghost" data-go="cond">내 조건에 적기</button><button class="mini ghost" data-go="udetail">'+short(u)+' 보기</button></div>'+
  '<div class="ask"><div>여기에 질문을 쓰세요</div><button aria-label="보내기">'+IC('up')+'</button></div>'+
  '<p class="fine">앱은 입학과 비자를 약속하지 않아요. 돈을 따로 보내 달라는 연락을 받으면 사기 주의 채널에 바로 알려 주세요.</p>';
};

/* ── 시안 설명 ── */
var SCREENS=[
 {id:'today',tab:'today',stage:'알아보기와 준비',name:'오늘',who:'해외에서 준비하는 학생의 첫 화면',
  does:['<b>지금 할 일 하나</b>가 그림 한 장으로 화면을 엽니다. 내 조건이 바뀌면 할 일도 바뀝니다.','다섯 단계는 <b>한국행 탑승권</b> 한 장에 담았습니다. 고른 대학에 따라 도착지와 날짜가 바뀝니다.','채널 글에서 「내 길에 넣기」를 누르면 다가오는 날에 줄이 생깁니다.'],
  from:['그림 한 장이 화면을 여는 것은 토스와 당근, Monzo의 첫 화면에서 가져왔습니다.','탑승권은 Recent 「Boarding Pass Scanner」의 실물 표에서 가져왔습니다.','인물과 3D 결은 synk.im 홈 「한 사람의 길」의 그 학생입니다.']},
 {id:'channels',tab:'channels',stage:'알아보기와 준비',name:'채널',who:'유학 정보를 주제별로 받는 곳',
  does:['「받기」를 누르면 받고 있는 채널로 올라갑니다.','협력 대학마다 방이 하나씩 열립니다. 지금은 「준비 중」입니다.','글마다 공식 출처와 확인한 날짜가 붙습니다.'],
  from:['맨 위 큰 글 하나와 아래 목록의 짜임은 당근과 Headspace에서 가져왔습니다.']},
 {id:'post',tab:'channels',stage:'알아보기와 준비',name:'채널 글',who:'소식 한 편을 읽는 화면',
  does:['요점 셋 아래에 <b>「내게 해당되나요?」</b>가 내 날짜로 바꿔 말해 줍니다.','「내 길에 넣기」를 누르면 오늘 화면에 그 날이 생깁니다.','접수는 공식 접수처로 연결합니다. 앱이 대신 접수하지 않습니다.']},
 {id:'cond',tab:'today',stage:'알아보기와 준비',name:'내 조건',who:'조건을 바꿔 보며 갈 수 있는 길을 보는 화면',
  does:['한국어, 성적, 준비한 돈을 누르면 <b>지원할 수 있는 대학 수</b>가 바로 바뀝니다.','바꾼 조건은 오늘, 대학, 대학 자세히, 물어보기에 그대로 반영됩니다.','입학과 비자를 약속하지 않는다는 말을 결과 아래에 둡니다.'],
  from:['값을 누르면 결과가 그 자리에서 바뀌는 것은 Wise의 송금 계산기에서 가져왔습니다.','프로필로 지원할 수 있는 과정만 추리는 것은 ApplyBoard에서 가져왔습니다.']},
 {id:'univ',tab:'univ',stage:'지원과 입학',name:'대학',who:'협력 대학(준비 중)을 고르는 화면',
  does:['대학마다 그림, 수업료, 필요한 한국어, 접수까지 남은 날을 같은 자리에 둡니다.','<b>「내 조건 4개 중 몇 개 맞음」</b>이 내 조건에 따라 바뀝니다.','「비교」를 두 곳 넘게 누르면 나란히 보기가 열립니다.'],
  from:['그림이 카드를 채우는 짜임은 에어비앤비와 토스에서, 항목을 통일하는 것은 Mastersportal에서 가져왔습니다.','대학 이름과 금액은 예시입니다. 협약 전에는 실제 대학 이름을 쓰지 않습니다.']},
 {id:'udetail',tab:'univ',stage:'지원과 입학',name:'대학 자세히',who:'한 대학의 조건과 돈을 내 것과 맞춰 보는 화면',
  does:['학력, 성적, 한국어, 재정을 필요한 것과 내 것으로 나란히 놓습니다.','<b>「내가 낼 돈」</b>을 큰 숫자 하나로 보이고 원과 투그릭으로 바꿉니다.','급수를 올리면 얼마가 줄어드는지 보여 줍니다.'],
  from:['큰 숫자 하나와 숨김 없는 내역은 Wise와 X Money에서 가져왔습니다.','재정 증명 금액은 법무부 발표 값입니다.']},
 {id:'compare',tab:'univ',stage:'지원과 입학',name:'나란히 보기',who:'대학 두세 곳을 한 표로 보는 화면',
  does:['내 조건으로 계산한 「내가 낼 돈」을 대학마다 나란히 놓습니다.']},
 {id:'path',tab:'today',stage:'지원과 입학',name:'내 길',who:'지원하는 동안 서류와 돈을 보는 화면',
  does:['서류를 누르면 끝낸 것으로 바뀌고 위 진행 줄이 찹니다.','<b>수수료 세 번</b>과 지금 어디까지 냈는지를 보여 줍니다.','원서, 합격, 비자, 출국 순서가 한 줄로 이어집니다.'],
  from:['서류 한 번 올리기와 진행 상태는 IDP Live에서, 사람이 다시 확인하는 것은 ApplyBoard에서 가져왔습니다.','수수료와 돌려받는 조건을 화면에 보이는 곳은 읽은 앱에 없었습니다.']},
 {id:'parent',tab:'today',stage:'지원과 입학',name:'부모님 화면',who:'부모가 보는 화면',
  does:['지금 단계, 낸 돈, 다음 일정을 부모님 말로 보여 줍니다.','화면에 없는 돈을 달라는 연락을 바로 알리는 단추가 있습니다.'],
  from:['부모가 보는 화면은 읽은 유학 앱 어디에도 없었습니다.']},
 {id:'life',tab:'life',stage:'유학 중 관리',name:'생활',who:'한국에 도착한 학생의 첫 화면',
  does:['한 주에 한 번 안부를 묻습니다. 「힘들어요」면 매니저가 모국어로 연락합니다.','모임은 그림 한 장으로 열고 그 자리에서 신청합니다.','외국인등록을 끝내면 건강보험도 함께 끝난 것으로 바뀝니다.','4급 지키기, 아르바이트, 집, 매니저는 아래 네 칸에서 엽니다.'],
  from:['도착 뒤 행정은 HireVisa에서, 만료 알림은 KOWORK와 VIVISA에서 가져왔습니다.','한 화면에 구역을 넷으로 줄였습니다. 2판 첫 맹검이 여섯 구역이 어지럽다고 짚었습니다.']},
 {id:'work',tab:'life',stage:'유학 중 관리',name:'아르바이트',who:'일할 수 있는 시간을 계산하는 화면',
  does:['학년과 급수를 누르면 <b>일할 수 있는 시간</b>이 바로 계산됩니다.','허가를 먼저 받아야 한다는 것과 할 수 없는 일을 순서로 보여 줍니다.'],
  from:['큰 숫자 하나와 그 아래 고르는 칸은 Wise에서 가져왔습니다.','일할 수 있는 시간을 계산해 주는 앱은 찾지 못했습니다.']},
 {id:'topik',tab:'life',stage:'유학 중 관리',name:'4급 지키기',who:'한국어 성적이 끊기지 않게 하는 화면',
  does:['성적이 끝나는 날까지 남은 날을 크게 보여 줍니다.','한국어 앱에서 맞고 틀린 기록으로 약한 영역을 찾습니다.','이번 주 할 것 다섯 개를 정해 주고 한국어 앱으로 넘깁니다.'],
  from:['한 주를 다섯 칸으로 채워 가는 것은 Duolingo에서 가져왔습니다.']},
 {id:'job',tab:'job',stage:'졸업 뒤 취업',name:'취업',who:'졸업을 앞둔 학생의 첫 화면',
  does:['<b>「내 기록 한 장」</b>의 항목을 눌러 회사에 보여 줄 것만 고릅니다.','목표 자리까지 가는 길을 한국어, 졸업, 비자 순서로 세웁니다.','일터 미리 가 보기(VR 직업 체험)와 면접 연습으로 이어집니다.'],
  from:['증서처럼 보이는 종이 한 장은 Recent 「IPO Allotment Status」에서 가져왔습니다.','비자로 공고를 거르는 것은 KOWORK에서 가져왔습니다. 채용 공고는 법 확인 뒤에 엽니다.']},
 {id:'chat',tab:'',stage:'어느 단계에서나',name:'물어보기',who:'모국어로 묻고 출처가 붙은 답을 받는 화면',
  does:['답은 내가 고른 대학에 맞춰 달라집니다.','사람마다 다른 질문은 답을 지어내지 않고 상담원에게 넘깁니다.'],
  from:['상담사와 한 화면에서 이야기하는 것은 LeapScholar에서 가져왔습니다.']}
];
var byId={};SCREENS.forEach(function(s){byId[s.id]=s});
var list=document.getElementById('guideList'),note=document.getElementById('note'),view=document.getElementById('view'),tabbar=document.getElementById('tabbar'),guide=document.getElementById('guide'),app=document.getElementById('app');
if(/[?&]clean/.test(location.search))document.body.classList.add('clean');
var last='';
SCREENS.forEach(function(s,i){
  if(s.stage!==last){var h=document.createElement('li');h.className='guide-stage';h.textContent=s.stage;list.appendChild(h);last=s.stage}
  var li=document.createElement('li'),b=document.createElement('button');b.dataset.go=s.id;b.innerHTML='<span class="n">'+String(i+1).padStart(2,'0')+'</span>'+s.name;li.appendChild(b);list.appendChild(li);
});
var curId='today';
function ul(a){return '<ul>'+a.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>'}
function draw(keep){var y=view.scrollTop;view.innerHTML='<section class="scr" id="s-'+curId+'"'+(keep?' style="animation:none"':'')+'>'+V[curId]()+'</section>';view.scrollTop=keep?y:0}
function go(id){
  var s=byId[id];if(!s)return;curId=id;draw(false);
  tabbar.querySelectorAll('button').forEach(function(b){if(b.dataset.go===s.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  list.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-current',b.dataset.go===id?'true':'false')});
  note.innerHTML='<button class="close" data-close="note">닫기</button><h2>'+s.name+'</h2><p class="who">'+s.who+'</p><h3>이 화면에서 되는 일</h3>'+ul(s.does)+(s.from?'<h3>어디서 가져왔나</h3>'+ul(s.from):'')+'<p class="legend">대학 이름, 금액, 날짜는 자리를 보이려고 넣은 예시입니다. 「출처」가 붙은 조건만 공식 안내에서 확인한 값입니다.</p>';
  guide.classList.remove('open');note.classList.remove('open');
  if(location.hash!=='#'+id)history.replaceState(null,'',location.search+'#'+id);
}
var tt;
function toast(t){var o=app.querySelector('.toast');if(o)o.remove();var el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=t;app.appendChild(el);clearTimeout(tt);tt=setTimeout(function(){el.remove()},3000)}
document.addEventListener('click',function(e){
  var q=function(sel){return e.target.closest(sel)},t;
  if(t=q('[data-set]')){var v=t.dataset.v;S[t.dataset.set]=/^-?\d+$/.test(v)?+v:v;draw(true);return}
  if(t=q('[data-ch]')){S.ch[t.dataset.ch]=S.ch[t.dataset.ch]?0:1;draw(true);return}
  if(t=q('[data-cmp]')){var i=S.cmp.indexOf(t.dataset.cmp);if(i>=0)S.cmp.splice(i,1);else if(S.cmp.length<3)S.cmp.push(t.dataset.cmp);draw(true);return}
  if(t=q('[data-u]')){S.picked=t.dataset.u;go('udetail');return}
  if(t=q('[data-doc]')){S.docs[t.dataset.doc]=S.docs[t.dataset.doc]?0:1;draw(true);return}
  if(t=q('[data-life]')){S.life[t.dataset.life]=S.life[t.dataset.life]?0:1;draw(true);return}
  if(t=q('[data-meet]')){var m=t.dataset.meet;S.meet[m]=S.meet[m]?0:1;draw(true);if(S.meet[m])toast('신청했습니다. 전날 저녁에 장소를 다시 알려 드립니다.');return}
  if(t=q('[data-mood]')){S.mood=t.dataset.mood;draw(true);return}
  if(t=q('[data-share]')){S.share[t.dataset.share]=S.share[t.dataset.share]?0:1;draw(true);return}
  if(t=q('[data-act]')){
    if(t.dataset.act==='add'){S.added=!S.added;draw(true);if(S.added)toast('1월 10일 시험을 내 길에 넣었습니다. 오늘 화면에 그 날이 생겼습니다.')}
    else if(t.dataset.act==='pick'){go('path');toast(short(U[S.picked])+'를 골랐습니다. 탑승권과 내 길이 이 대학으로 바뀌었습니다.')}
    return}
  if(t=q('[data-toast]')){toast(t.dataset.toast);return}
  if(t=q('[data-go]')){go(t.dataset.go);return}
  if(t=q('[data-open]')){document.getElementById(t.dataset.open).classList.add('open');return}
  if(t=q('[data-close]')){document.getElementById(t.dataset.close).classList.remove('open')}
});
window.PATH={S:S,go:go,draw:draw,ids:SCREENS.map(function(s){return s.id})};
go(byId[location.hash.slice(1)]?location.hash.slice(1):'today');
})();
