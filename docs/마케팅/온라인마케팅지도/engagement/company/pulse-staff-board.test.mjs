// PULSE 직원 작업실 「제작 보드」(2026-11-13) — 나누기(room-view.mjs staffBoard) · 첫 화면(views.mjs picker) · 머리 띠 · 연결(app.mjs) · 직원 전용 CSS의 약속.
// 실제 그림(1440 · 390 넘침 · 13px 아래 글 · 누르는 자리)은 합성 서버 촬영이 본다(.tmp/pulse-staff-redesign-20261113/capture-new.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

globalThis.location??=new URL('http://localhost/pulse-app/?mode=staff');
const {staffBoard,STAFF_STAGES}=await import('./public/pulse-app/room-view.mjs');
const {picker,header}=await import('./public/pulse-app/views.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');

const NOW=Date.parse('2026-11-13T03:00:00Z'); // 한국 시각 11-13 12:00
const day=n=>new Date(NOW+9*3600000+n*86400000).toISOString().slice(0,10);
const ago=hours=>new Date(NOW-hours*3600000).toISOString();
const asset=(id,author,extra={})=>({id,author,mimeType:'image/jpeg',fileName:id+'.jpg',at:ago(1),...extra});
// 의뢰 흐름 프로젝트: 상태는 roomState가 의뢰서 · 버전으로 판단한다.
const requestProject=(id,{status='submitted',submittedAt=ago(2),assets=[asset('front-'+id,'customer',{slot:'front'})],stage='received',...rest}={})=>({id,title:'의뢰 '+id,customerName:'손님 '+id,stage,updatedAt:submittedAt,createdAt:submittedAt,dueDate:'',versions:[],messages:[],
  studio:{assets,request:{number:'P-1113-'+id.toUpperCase(),status,submittedAt,answers:{kind:'food',package:'s15',channels:['shorts']},files:[],asks:[],rounds:[]}},...rest});
const legacyProject=(id,stage,{dueDate='',updatedAt=ago(1),nextStep=''}={})=>({id,title:'옛 '+id,customerName:'회사 '+id,stage,dueDate,updatedAt,createdAt:updatedAt,nextStep,versions:[],messages:[]});

test('나누기: 새 의뢰 · 우리 차례 · 손님 차례 · 끝 · 보관이 겹치지 않고, 단계 다섯 칸에 들어간다',()=>{
  const projects=[
    requestProject('a',{submittedAt:ago(5)}),requestProject('b',{submittedAt:ago(1)}),
    requestProject('c',{status:'confirmed',submittedAt:ago(30)}), // 확인 끝 → 1차안 준비(우리 차례)
    legacyProject('make','producing',{dueDate:day(4)}),legacyProject('soon','producing',{dueDate:day(2)}),
    legacyProject('wait-long','review',{updatedAt:ago(72)}),legacyProject('wait-short','review',{updatedAt:ago(1)}),
    legacyProject('old','archived'),
  ];
  const b=staffBoard(projects,NOW);
  assert.deepEqual(b.fresh.map(x=>x.id),['b','a'],'새 의뢰는 막 들어온 것부터(의뢰 확인 왼쪽 목록과 같은 순서)');
  assert.deepEqual(b.ours.map(x=>x.id),['soon','make','c'],'우리 차례는 전달일이 가까운 것부터, 전달일 없는 것은 뒤로');
  assert.deepEqual(b.theirs.map(x=>x.id),['wait-long','wait-short'],'손님 차례는 오래 기다린 것부터');
  assert.deepEqual(b.archived.map(x=>x.id),['old']);
  assert.equal(b.total,7);
  assert.deepEqual(b.soon.map(x=>x.id),['soon'],'사흘 안 전달');
  const all=[...b.fresh,...b.ours,...b.theirs,...b.done,...b.archived].map(x=>x.id);
  assert.equal(new Set(all).size,projects.length,'한 프로젝트는 한 곳에만');
  assert.deepEqual(STAFF_STAGES.map(s=>s.name),['확인','1차안','제작','영상 확인','납품']);
  const at=Object.fromEntries(b.stages.map(s=>[s.id,s.items.map(x=>x.id)]));
  assert.deepEqual(at.check,['b','a']);assert.ok(at.draft.includes('c'));assert.deepEqual(at.make.sort(),['make','soon']);assert.deepEqual(at.review.sort(),['wait-long','wait-short']);
  assert.ok(!b.stages.some(s=>s.items.some(x=>x.id==='old')),'보관은 보드 칸에 없다');
  const fresh=b.fresh[0];
  assert.equal(fresh.number,'P-1113-B');assert.equal(fresh.turn,'us');assert.equal(fresh.state,'새 의뢰');
  assert.ok(fresh.missing.length>0,'자동 점검의 빠진 것을 싣는다');
  assert.equal(fresh.picture.src,'/api/client-projects/b/studio/media/front-b','확인 단계는 손님이 보낸 앞면 사진');
  assert.equal(b.theirs[0].waited,3);assert.equal(b.ours[0].left,2);
});

test('대표 그림: 확인 뒤에는 우리가 올린 가장 최근 그림, 없으면 손님 사진, 둘 다 없으면 그림 없음',()=>{
  const ours=asset('scene','staff',{at:ago(1)}),older=asset('older','staff',{at:ago(9)}),theirs=asset('front','customer',{slot:'front'});
  const p=requestProject('x',{status:'confirmed',assets:[theirs,older,ours]});
  assert.equal(staffBoard([p],NOW).ours[0].picture.src,'/api/client-projects/x/studio/media/scene');
  assert.equal(staffBoard([requestProject('y',{status:'confirmed',assets:[theirs]})],NOW).ours[0].picture.src,'/api/client-projects/y/studio/media/front');
  assert.equal(staffBoard([legacyProject('z','producing')],NOW).ours[0].picture,null);
  const pdf={...asset('doc','customer'),mimeType:'application/pdf'};
  assert.equal(staffBoard([requestProject('w',{assets:[pdf]})],NOW).fresh[0].picture,null,'그림이 아닌 파일은 쓰지 않는다');
});

test('첫 화면: 숫자 셋 · 다섯 칸 · 카드는 옛 계약(open-project) 그대로, 손님 체험 큰 상자와 영문 꼬리표는 없다',t=>{
  t.mock.timers.enable({apis:['Date'],now:NOW}); // 화면은 지금 시각으로 D-n · 기다린 날을 센다 — 시험 날과 상관없이 같게(카본 B1)
  const projects=[requestProject('a'),legacyProject('make','producing',{dueDate:day(1),nextStep:'2번 컷 <다듬기>'}),legacyProject('wait','review',{updatedAt:ago(48)}),legacyProject('old','archived')];
  const html=picker({mode:'staff',user:{id:'u',name:'하늘'},workspace:{projects,canWrite:true}});
  assert.match(html,/class="project-picker staff-home"/);
  assert.equal((html.match(/<p class="staff-meter/g)||[]).length,3);
  assert.match(html,/<p class="staff-meter is-hot"><b>1<\/b><span>새 의뢰/);
  assert.equal((html.match(/<section class="staff-col/g)||[]).length,5);
  for(const id of ['a','make','wait','old'])assert.match(html,new RegExp(`data-action="open-project" data-id="${id}"`));
  assert.match(html,/<span class="staff-flag">새 의뢰<\/span>/);
  assert.match(html,/<span class="staff-due is-hot">D-1<\/span>/,'전달 이틀 안은 베리');
  assert.match(html,/2번 컷 &lt;다듬기&gt;/,'담당자 메모는 글로만');
  assert.match(html,/<b>손님 차례 · 2일째<\/b>/);
  assert.match(html,/<details class="staff-fold">[\s\S]*보관 1[\s\S]*data-id="old"[\s\S]*보관됨/);
  assert.match(html,/data-action="staff-stage" data-stage="check" aria-pressed="true"/,'새 의뢰가 있으면 휴대폰은 확인 칸부터');
  assert.match(html,/data-action="new-project"/);assert.match(html,/href="\?demo=gift" target="_blank"/);
  assert.doesNotMatch(html,/CREATOR WORKSPACE|CLIENT EXPERIENCE|어떤 광고를 함께 만들까요/);
  const crew=picker({mode:'staff',user:{id:'u'},workspace:{projects,canWrite:false}});
  assert.doesNotMatch(crew,/data-action="new-project"/,'쓸 수 없는 크루에게는 새 프로젝트가 없다');
  const picked=picker({mode:'staff',user:{id:'u'},staffStage:'review',workspace:{projects,canWrite:true}});
  assert.match(picked,/<div class="staff-board" data-stage="review">/);
  const none=picker({mode:'staff',user:{id:'u'},workspace:{projects:[],canWrite:true}});
  assert.match(none,/아직 프로젝트가 없어요/);assert.doesNotMatch(none,/staff-board/,'빈 칸 다섯을 늘어놓지 않는다');assert.match(none,/「새 프로젝트」를 눌러요/);
  assert.doesNotMatch(picker({mode:'staff',user:{id:'u'},workspace:{projects:[],canWrite:false}}),/새 프로젝트/,'쓸 수 없는 크루에게 없는 단추를 가리키지 않는다(카본 B4)');
  const noTime=picker({mode:'staff',user:{id:'u'},workspace:{projects:[requestProject('t',{submittedAt:''})],canWrite:true}});
  assert.match(noTime,/<span class="staff-card-w">손님 t · <span class="mono">P-1113-T<\/span><\/span>/,'접수 시각을 못 읽으면 「접수」 조각을 뺀다(카본 B3)');
  const xss=picker({mode:'staff',user:{id:'u'},workspace:{projects:[{...legacyProject('q"><img','producing'),title:'<b>x</b>',customerName:'<i>'}],canWrite:true}});
  assert.doesNotMatch(xss,/<b>x<\/b>|<i>|data-id="q"><img/);
});

test('끝난 프로젝트는 2주 동안만 납품 칸에, 그 뒤는 접기로',t=>{
  t.mock.timers.enable({apis:['Date'],now:NOW});
  const done=(id,hours)=>({...legacyProject(id,'delivered',{updatedAt:ago(hours)})});
  const html=picker({mode:'staff',user:{id:'u'},workspace:{projects:[done('recent',24),done('past',24*20)],canWrite:true}});
  const column=html.slice(html.indexOf('data-col="deliver"'),html.indexOf('</section>',html.indexOf('data-col="deliver"')));
  assert.match(column,/data-id="recent"/);assert.doesNotMatch(column,/data-id="past"/);
  assert.match(html,/<b>끝난 프로젝트 1<\/b> · 보관 0/);
});

test('머리 띠: 갈 곳 셋과 지금 자리, 알림 숫자는 글 · 숫자로 나눠 그린다',()=>{
  const base={mode:'staff',user:{id:'u',name:'김하늘'},live:{unreadCount:4}};
  const home=header(base);
  assert.match(home,/<nav class="staff-nav" aria-label="작업실">/);
  assert.match(home,/data-action="projects" aria-current="page">제작 보드</);
  assert.match(home,/data-action="brands" >고객 브랜드</);
  assert.match(home,/data-action="notifications"[^>]*><span>알림<\/span><b class="staff-count">4<\/b>/);
  assert.match(home,/data-action="logout"/);assert.match(home,/class="staff-me"[^>]*>김</);
  assert.match(header({...base,brands:{}}),/data-action="brands" aria-current="page"/);
  assert.doesNotMatch(header({...base,project:{id:'p'}}),/aria-current="page"/,'프로젝트 안에서는 어느 갈 곳도 지금 자리가 아니다');
  assert.doesNotMatch(header({mode:'staff',user:null}),/staff-nav|data-action="logout"/,'로그인 전에는 갈 곳 · 로그아웃이 없다');
});

test('연결: 쉬기 칸 · 단계 탭 · 알림 숫자 · 직원 CSS는 직원 화면에서만',()=>{
  const app=read('app.mjs');
  assert.ok(app.includes("if(action==='intake-sheet'&&s.mode==='staff'){if(!s.staffIntake?.canEdit)return;"),'크루는 쉬기 칸을 열 수 없다');
  assert.ok(app.includes("if(s.project||s.brands)withLeave(async()=>{resetContext();try{await loadWorkspace();}catch(error){notice(error.message);}openSheet();});else openSheet();"),'다른 화면이면 쓰던 글을 물은 뒤 첫 화면으로 돌아가 연다');
  assert.ok(app.includes("if(action==='staff-stage'){s.staffStage=button.dataset.stage||'';render();return;}"));
  assert.ok(app.includes("s.staffIntake=['open','paused'].includes(result?.state)?result:null;s.intakeSheet=false;"),'저장하면 쉬기 칸을 닫는다');
  assert.ok(app.includes('castingCodeSave=null;s.brands=null;s.intakeSheet=false;}'),'다른 화면으로 가면 쉬기 칸은 닫힌다');
  assert.ok(app.includes("if(s.mode==='staff')badge.innerHTML=staffNotifyLabel(s.live.unreadCount||0);"));
  assert.ok(app.includes("...(staffMode?[new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='./staff.css';"),'staff.css는 직원 모드에서만 맨 끝에 붙인다');
  const css=read('staff.css');
  // 선택자 목록은 괄호 밖 쉼표로 나눠 하나하나 본다 — 「html.is-staff .a,.b」의 .b가 새는 것까지(카본 B2).
  const selectors=list=>{const out=[];let depth=0,part='';for(const ch of list){if(ch==='(')depth++;if(ch===')')depth--;if(ch===','&&!depth){out.push(part);part='';}else part+=ch;}out.push(part);return out.map(x=>x.trim()).filter(Boolean);};
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').match(/[^{}]+(?=\{)/g).map(x=>x.trim()).filter(x=>x&&!x.startsWith('@'));
  assert.ok(rules.length>100,'규칙을 다 읽었다');
  for(const rule of rules)for(const one of selectors(rule))assert.match(one,/^html\.is-staff\b/,`직원 화면 밖으로 새지 않는다: ${one}`);
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8'),sw=read('sw.js');
  assert.ok(server.includes("'film-legacy.css','staff.css'])files['/pulse-app/'+file]"),'서버가 staff.css를 내준다');
  assert.ok(sw.includes("BASE+'staff.css'"),'오프라인 셸에 staff.css');
});
