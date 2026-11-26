/* 출결 · TOPIK 시안 셋이 함께 쓰는 예시 자료와 상태(2026-11-27).
   학생 이름은 몽골 지명을 빌려 지어낸 것이다. 실학생 자료가 아니다.
   규칙은 설계(docs/디자인/학원운영_출결_TOPIK_20261127/설계.md 9절)를 따른다.
   - 공유를 켠 학생만 찍는다. 끈 학생은 이유 한 줄만 보인다.
   - 만료일 = 성적 발표일 + 2년. 만료일 당일부터 「만료」. 30일 안 · 90일 안 · 유효.
   - 대표 성적 = 가장 최근의 유효 성적(없으면 가장 최근 성적).
   - 3회 연속 결석 = 그 반에 출결이 있는 날을 최근부터 세어 결석이 이어진 수. */
(function(){
  const BASIS='2026-11-27';
  const DOW=['일','월','화','수','목','금','토'];
  const STATUS={present:{ko:'출석',short:'출'},late:{ko:'지각',short:'지'},absent:{ko:'결석',short:'결'},excused:{ko:'공결',short:'공'}};
  const ORDER=['present','late','absent','excused'];
  const SESSIONS=['2026-11-13','2026-11-16','2026-11-18','2026-11-20','2026-11-23','2026-11-25'];

  // 지난 수업 여섯 번의 기록(저장된 것). p 출석 · l 지각 · a 결석 · e 공결
  const H=s=>Object.fromEntries(s.split('').map((c,i)=>[SESSIONS[i],{p:'present',l:'late',a:'absent',e:'excused'}[c]]).filter(x=>x[1]));
  const LEARNERS=[
    {id:'orkhon',ko:'오르홍',mn:'Орхон',share:'on',hist:H('pppplp'),topik:[{id:'t1',kind:'II',round:96,level:4,on:'2024-12-26'}]},
    {id:'selenge',ko:'셀렝게',mn:'Сэлэнгэ',share:'on',hist:H('pplppp'),topik:[{id:'t2',kind:'II',round:98,level:5,on:'2025-02-20'},{id:'t3',kind:'II',round:94,level:4,on:'2024-06-13'}]},
    {id:'khangai',ko:'항가이',mn:'Хангай',share:'on',hist:H('pppppp'),topik:[{id:'t4',kind:'II',round:104,level:3,on:'2026-06-11'}]},
    {id:'altai',ko:'알타이',mn:'Алтай',share:'on',hist:H('ppeppp'),topik:[{id:'t5',kind:'II',round:95,level:4,on:'2024-10-28'}]},
    {id:'gobi',ko:'고비',mn:'Говь',share:'on',hist:H('pplaaa'),topik:[]},
    {id:'terelj',ko:'테렐지',mn:'Тэрэлж',share:'on',hist:H('pppppl'),topik:[{id:'t6',kind:'I',round:103,level:2,on:'2026-04-30'}]},
    {id:'darkhan',ko:'다르항',mn:'Дархан',share:'on',hist:H('pppppp'),topik:[{id:'t7',kind:'II',round:102,level:6,on:'2026-01-15'}]},
    {id:'tuul',ko:'톨',mn:'Туул',share:'on',hist:H('ppppap'),topik:[{id:'t8',kind:'II',round:100,level:4,on:'2025-08-21'}]},
    {id:'khuvsgul',ko:'흡스굴',mn:'Хөвсгөл',share:'off',hist:{},topik:[]},
    {id:'kharkhorin',ko:'하르호린',mn:'Хархорин',share:'none',hist:{},topik:[]},
  ];
  const OTHER={name:'TOPIK 대비 B반',time:'화 · 목 19:00',people:6,today:{absent:0,late:0},streak:0,expiring:1,noFour:2,expNames:['볼강 · TOPIK II 4급 · D-61'],noFourNames:['투브','오브스']};

  // 학생 관리: 지점 · 반 · 재학생 체류(노란 시안에서 가져온 항목). 모두 예시다.
  const BRANCHES=[
    {key:'all',name:'전체 지점'},
    {key:'ub',name:'울란바토르 직영',sub:'UTC+8'},
    {key:'kr',name:'한국 · 정착',sub:'서울'},
    {key:'hanoi',name:'하노이',sub:'2028 예정',off:true},
    {key:'tash',name:'타슈켄트',sub:'2029 예정',off:true},
  ];
  const CLASSES=[
    {id:'a',name:'한국어 중급 A반',branch:'ub',days:'월 · 수 · 금',time:'18:00',teacher:'한결',people:10,live:true},
    {id:'t4',name:'TOPIK 4급 집중반',branch:'ub',days:'월 · 수 · 금',time:'14:00',teacher:'나린',people:12,today:{present:10,late:1,absent:1,excused:0,none:0},at:'14:06'},
    {id:'en',name:'영어 · 유학 준비',branch:'ub',days:'화 · 금',time:'16:00',teacher:'나린',people:8,today:{present:6,late:0,absent:0,excused:1,none:0},at:'16:03'},
    {id:'b',name:'TOPIK 대비 B반',branch:'ub',days:'화 · 목',time:'19:00',teacher:'한결',people:6,today:null},
    {id:'kr1',name:'정착 1기',branch:'kr',days:'멘토 반',time:'',teacher:'솔',people:5,today:null,mentor:true},
  ];
  const STAGES=[{key:'academy',ko:'어학원 재원',n:36},{key:'path',ko:'유학 수속',n:4},{key:'arrived',ko:'입국 · 정착',n:1},{key:'enrolled',ko:'한국 재학',n:4}];
  const STAY=[
    {id:'onon',ko:'오논',mn:'Онон',stage:'enrolled',uni:'협약 대학 A',program:'학부 1학년',visa:'D-2',stay:'2027-02-10',entered:'2026-03-02',mentor:'솔',uniAtt:98,topik:{kind:'II',level:4,on:'2025-01-07'}},
    {id:'ulgii',ko:'울기',mn:'Өлгий',stage:'enrolled',uni:'협약 대학 B',program:'어학당 2학기',visa:'D-4',stay:'2026-12-20',entered:'2026-03-02',mentor:'솔',uniAtt:95,topik:{kind:'II',level:3,on:'2026-06-11'}},
    {id:'kherlen',ko:'헤를렌',mn:'Хэрлэн',stage:'enrolled',uni:'협약 대학 A',program:'학부 2학년',visa:'D-2',stay:'2027-08-31',entered:'2025-08-25',mentor:'솔',uniAtt:68,topik:{kind:'II',level:4,on:'2026-01-15'}},
    {id:'erdenet',ko:'에르데넷',mn:'Эрдэнэт',stage:'enrolled',uni:'협약 대학 B',program:'학부 1학년',visa:'D-2',stay:'2027-09-15',entered:'2026-03-02',mentor:'솔',uniAtt:97,topik:{kind:'II',level:5,on:'2025-10-23'}},
    {id:'khovd',ko:'호브드',mn:'Ховд',stage:'arrived',uni:'협약 대학 A',program:'어학당 입학 예정',visa:'D-4',stay:'2027-05-30',entered:'2026-11-20',mentor:'솔',uniAtt:null,topik:{kind:'II',level:3,on:'2026-08-27'}},
  ];

  const pad=n=>String(n).padStart(2,'0');
  const toDate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
  const iso=d=>d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
  // Postgres (announced_on + interval '2 years')와 같게: 2월 29일은 2월 28일로.
  const plus2y=s=>{const [y,m,d]=s.split('-').map(Number);const last=new Date(Date.UTC(y+2,m,0)).getUTCDate();return (y+2)+'-'+pad(m)+'-'+pad(Math.min(d,last));};
  const days=(a,b)=>Math.round((toDate(b)-toDate(a))/86400000);
  const md=s=>{const d=toDate(s);return (d.getUTCMonth()+1)+'월 '+d.getUTCDate()+'일';};
  const mdShort=s=>{const d=toDate(s);return (d.getUTCMonth()+1)+'.'+pad(d.getUTCDate());};
  const dow=s=>DOW[toDate(s).getUTCDay()];
  const ymd=s=>s.replace(/-/g,'.');
  const now=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes());};

  function topikInfo(r,basis=BASIS){
    const expires=plus2y(r.on),left=days(basis,expires);
    if(Number(r.level)===0)return {...r,expires,left,state:'fail',label:'미달',tone:'quiet'};
    const state=left<=0?'expired':left<=30?'d30':left<=90?'d90':'valid';
    const label={expired:'만료',d30:'30일 안 만료',d90:'90일 안 만료',valid:'유효'}[state];
    const tone={expired:'bad',d30:'bad',d90:'warn',valid:'quiet'}[state];
    return {...r,expires,left,state,label,tone};
  }
  function representative(l){
    const list=l.topik.map(r=>topikInfo(r)).sort((a,b)=>b.on.localeCompare(a.on));
    return list.find(r=>r.state!=='expired'&&r.state!=='fail')||list[0]||null;
  }
  const levelText=v=>Number(v)>0?Number(v)+'급':'미달';
  const hasFourPlus=l=>l.topik.map(r=>topikInfo(r)).some(r=>r.state!=='expired'&&r.state!=='fail'&&Number(r.level)>=4);

  // 상태: 날짜마다 저장된 출결, 지금 고르는 중인 것(draft)
  const state={
    date:BASIS,
    saved:{},   // date -> id -> {status,note,by,at}
    draft:{},   // id -> {status?,note?}
    teacher:'한결 선생님',
    lastSave:null,
  };
  for(const d of SESSIONS){state.saved[d]={};for(const l of LEARNERS){if(l.hist[d])state.saved[d][l.id]={status:l.hist[d],note:'',by:'한결 선생님',at:'18:04'};}}
  state.saved[BASIS]={};
  const listeners=new Set();
  const emit=why=>{for(const f of listeners)f(why);};
  const shared=()=>LEARNERS.filter(l=>l.share==='on');
  const day=()=>state.saved[state.date]||(state.saved[state.date]={});
  function eff(id){const old=day()[id],nx=state.draft[id]||{};return {status:nx.status??old?.status??null,note:nx.note??old?.note??'',old};}
  function dirty(){return shared().some(l=>{if(!state.draft[l.id])return false;const e=eff(l.id);return e.status!==(e.old?.status??null)||e.note!==(e.old?.note??'');});}
  function counts(){const c={present:0,late:0,absent:0,excused:0,none:0};for(const l of shared()){const s=eff(l.id).status;if(s)c[s]++;else c.none++;}return c;}
  const allDates=()=>[...SESSIONS,BASIS].filter(d=>d<=state.date||d===BASIS);
  // 최근 수업부터 결석이 이어진 수. 오늘 고른 것(draft)도 센다.
  function streak(id){
    const dates=[...new Set([...SESSIONS,BASIS])].sort().reverse();let n=0;
    for(const d of dates){const s=d===state.date?eff(id).status:state.saved[d]?.[id]?.status;if(d===BASIS&&!s)continue;if(s==='absent')n++;else break;}
    return n;
  }
  function history(id,n=6){return SESSIONS.slice(-n).map(d=>({date:d,status:state.saved[d]?.[id]?.status||null}));}

  function summary(){
    const todayNames={absent:[],late:[]};
    for(const l of shared()){const s=state.date===BASIS?eff(l.id).status:state.saved[BASIS]?.[l.id]?.status;if(s==='absent')todayNames.absent.push(l);if(s==='late')todayNames.late.push(l);}
    const streaks=shared().map(l=>({l,n:streak(l.id)})).filter(x=>x.n>=3);
    const exp=shared().map(l=>({l,r:representative(l)})).filter(x=>x.r&&(x.r.state==='expired'||x.r.state==='d30'||x.r.state==='d90')).sort((a,b)=>a.r.left-b.r.left);
    const noFour=shared().filter(l=>!hasFourPlus(l));
    return {todayNames,streaks,exp,noFour};
  }

  // 체류: 120일 안 「연장 신청 열림」, 30일 안 「급함」, 지났으면 「만료」
  function stayInfo(s){
    const left=s.stay?days(BASIS,s.stay):null;
    const state=left===null?'none':left<=0?'expired':left<=30?'urgent':left<=120?'open':'ok';
    const label={expired:'체류 만료',urgent:'체류 급함',open:'연장 신청 열림',ok:'체류 여유',none:'체류 기록 없음'}[state];
    return {left,state,label,tone:state==='expired'||state==='urgent'?'bad':state==='open'?'warn':'quiet'};
  }
  // 반의 오늘 출결: A반은 화면에서 찍는 값, 나머지는 예시 고정값
  function classToday(c){
    if(c.live){const k=counts();return {...k,recorded:k.present+k.late+k.absent+k.excused,total:shared().length,at:state.lastSave&&state.lastSave.date===BASIS?state.lastSave.at:null};}
    if(!c.today)return null;
    const t=c.today;return {...t,recorded:t.present+t.late+t.absent+t.excused,total:t.present+t.late+t.absent+t.excused+t.none,at:c.at};
  }
  const inBranch=(b,key)=>b==='all'||b===key;
  function mgmt(branch='all'){
    let came=0,rec=0;
    for(const c of CLASSES.filter(c=>inBranch(branch,c.branch))){const t=classToday(c);if(!t)continue;came+=t.present+t.late;rec+=t.present+t.late+t.absent;}
    const s=summary();
    const streak=inBranch(branch,'ub')?s.streaks.length:0;
    const stays=inBranch(branch,'kr')?STAY.filter(x=>['expired','urgent','open'].includes(stayInfo(x).state)).length:0;
    const topikA=inBranch(branch,'ub')?s.exp.length+OTHER.expiring:0;
    const topikK=inBranch(branch,'kr')?STAY.filter(x=>{const r=topikInfo(x.topik);return ['expired','d30','d90'].includes(r.state);}).length:0;
    return {came,rec,rate:rec?Math.round(came/rec*100):null,streak,stays,topik:topikA+topikK};
  }
  // 알림이 있는 학생을 급한 순서로
  function alerts(branch='all'){
    const out=[];
    if(inBranch(branch,'ub')){
      for(const x of summary().streaks)out.push({id:x.l.id,ko:x.l.ko,mn:x.l.mn,where:'한국어 중급 A반 · 울란바토르',kind:'learner',rank:-50,chips:[{t:x.n+'회 연속 결석',tone:'bad'}]});
      for(const x of summary().exp){const o=out.find(a=>a.id===x.l.id);const chip={t:'TOPIK '+x.r.kind+' '+levelText(x.r.level)+' '+(x.r.state==='expired'?'만료':'D-'+x.r.left),tone:x.r.tone};if(o){o.chips.push(chip);o.rank=Math.min(o.rank,x.r.left);}else out.push({id:x.l.id,ko:x.l.ko,mn:x.l.mn,where:'한국어 중급 A반 · 울란바토르',kind:'learner',rank:x.r.left,chips:[chip]});}
      out.push({id:'bolgan',ko:'볼강',mn:'Булган',where:'TOPIK 대비 B반 · 울란바토르',kind:'other',rank:61,chips:[{t:'TOPIK II 4급 D-61',tone:'warn'}]});
    }
    if(inBranch(branch,'kr'))for(const x of STAY){
      const si=stayInfo(x),tr=topikInfo(x.topik),chips=[];let rank=9999;
      if(['expired','urgent','open'].includes(si.state)){chips.push({t:(si.state==='expired'?'체류 만료':'체류 만료 D-'+si.left),tone:si.tone});rank=Math.min(rank,si.left);}
      if(['expired','d30','d90'].includes(tr.state)){chips.push({t:'TOPIK '+levelText(tr.level)+' '+(tr.state==='expired'?'만료':'D-'+tr.left),tone:tr.tone});rank=Math.min(rank,tr.left);}
      if(x.uniAtt!==null&&x.uniAtt<70){chips.push({t:'대학 출석 '+x.uniAtt+'%',tone:'bad'});rank=Math.min(rank,20);}
      if(chips.length)out.push({id:x.id,ko:x.ko,mn:x.mn,where:x.uni+' · '+x.program+' · 비자 '+x.visa,kind:'stay',rank,chips,mentor:x.mentor});
    }
    return out.sort((a,b)=>a.rank-b.rank);
  }

  const api={
    BASIS,STATUS,ORDER,SESSIONS,LEARNERS,OTHER,state,BRANCHES,CLASSES,STAGES,STAY,
    stayInfo,classToday,mgmt,alerts,
    stay:id=>STAY.find(s=>s.id===id),
    saveStay(id,patch){const s=STAY.find(x=>x.id===id);if(!s)return;Object.assign(s,patch);emit('stay');},
    toDate,iso,plus2y,days,md,mdShort,dow,ymd,now,levelText,topikInfo,representative,hasFourPlus,
    shared,eff,dirty,counts,streak,history,summary,
    on(f){listeners.add(f);return ()=>listeners.delete(f);},
    learner:id=>LEARNERS.find(l=>l.id===id),
    setStatus(id,status){const l=api.learner(id);if(!l||l.share!=='on')return;const cur=eff(id).status;state.draft[id]={...(state.draft[id]||{}),status:cur===status&&!day()[id]?null:status};emit('status');},
    setNote(id,note){state.draft[id]={...(state.draft[id]||{}),note:String(note).slice(0,200)};emit('note');},
    allPresent(){let n=0;for(const l of shared())if(!eff(l.id).status){state.draft[l.id]={...(state.draft[l.id]||{}),status:'present'};n++;}emit('all');return n;},
    save(){
      const rows=shared().filter(l=>state.draft[l.id]&&eff(l.id).status);if(!rows.length)return 0;
      const at=now();
      for(const l of rows){const e=eff(l.id);day()[l.id]={status:e.status,note:e.note.trim(),by:state.teacher,at};}
      state.draft={};state.lastSave={n:rows.length,at,date:state.date};emit('save');return rows.length;
    },
    setDate(d){if(dirty()&&!confirm('저장하지 않은 출결이 있어요. 다른 날로 넘어갈까요?'))return false;state.date=d;state.draft={};emit('date');return true;},
    sessionDates:()=>[...SESSIONS,BASIS],
    addTopik(id,{kind,round,level,on}){const l=api.learner(id);if(!l)return null;const r={id:'n'+Date.now(),kind,round:Number(round),level:Number(level),on};const dup=l.topik.findIndex(x=>x.kind===r.kind&&x.round===r.round);if(dup>=0)l.topik[dup]=r;else l.topik.push(r);emit('topik');return r;},
    removeTopik(id,rid){const l=api.learner(id);if(!l)return;l.topik=l.topik.filter(r=>r.id!==rid);emit('topik');},
    shareLine:l=>l.share==='off'?'학생이 기록 공유를 허락하지 않았어요':'학생이 아직 SYNK 앱 계정을 만들지 않았어요',
  };
  window.ATT=api;
})();
