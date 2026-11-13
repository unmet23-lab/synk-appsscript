// PULSE 운영 조각 6-C 알림 명단(2026-11-14, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2) — 화면 쪽 약속.
// 대기까지 찼고 메일이 켜져 있으면(서버 notify) 첫 화면 안내에 「열리면 메일로 알려 드릴까요?」 메일 한 칸, 남긴 뒤에는 「알림을 걸어 두었어요」 한 줄(한 · 영).
// 서버 쪽(등록 · 보내기 · 지우기 · 문턱)은 pulse-waitlist.test.mjs · pulse-presale-server.test.mjs 「운영 조각 6-C」가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {entryView,applyEntryIntake}=await import('./public/pulse-app/film-home.mjs');
const {setLocale}=await import('./public/pulse-app/i18n.mjs');
const {ERROR_CODE_TEXT}=await import('./public/pulse-app/api.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');

const FULL={state:'full',kinds:['video','photo'],noticeDate:''};
const slots=html=>[...html.matchAll(/<div class="sx-paused" data-paused( data-paused-works)? data-in tabindex="-1" data-key="([^"]*)"( hidden)?>(.*?)<\/div>/gs)].map(m=>({key:m[2].replaceAll('&quot;','"'),inner:m[4]}));

test('대기까지 찼고 메일이 켜져 있으면 두 안내 자리에 메일 한 칸 — 덫 칸 · 한 번만 보내고 지운다는 말, 메일이 꺼져 있거나 쉬는 중이면 칸이 없다',()=>{
  for(const slot of slots(entryView({paused:{...FULL,notify:true}}))){
    assert.match(slot.inner,/<form class="sx-wait" data-form="waitlist" novalidate><label><span class="sx-small">열리면 메일로 알려 드릴까요\?<\/span><input name="email" type="email" maxlength="254" autocomplete="email" autocapitalize="off" spellcheck="false" required><\/label>/);
    assert.match(slot.inner,/<input class="sx-hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">/,'덫 칸');
    assert.match(slot.inner,/<button type="submit" class="sx-go" data-mutate><span>알려 주세요<\/span>/);
    assert.match(slot.inner,/<p class="sx-small sx-wait-note">자리가 나면 이 주소로 한 번만 보내 드리고, 그 뒤 주소는 지워요\.<\/p><\/form>/);
    assert.deepEqual(JSON.parse(slot.key),['full','','ko',true,'']);
  }
  // 휴대폰 1쪽용 한 줄 단추(넓은 화면에서는 CSS로 숨음): 둘째 줄을 대신해 끝 쪽 칸으로 내려간다(최종 검수).
  for(const slot of slots(entryView({paused:{...FULL,notify:true}}))){
    assert.match(slot.inner,/<p class="sx-small sx-paused-when">자리가 나면 이 화면에서 바로 시작하실 수 있어요\.<\/p><button type="button" class="sx-go sx-wait-jump" data-entry="wait"><span>열리면 메일로 알려 드릴까요\?<\/span>/);
  }
  assert.doesNotMatch(slots(entryView({paused:{...FULL,notify:true,notified:'a@b.co'}}))[0].inner,/sx-wait-jump|sx-paused-when/,'남긴 뒤에는 단추 없이 둘째 줄');
  assert.doesNotMatch(entryView({paused:FULL}),/sx-wait-jump|sx-paused-when/,'메일이 꺼져 있으면 단추도 없다');
  assert.doesNotMatch(entryView({paused:FULL}),/data-form="waitlist"/,'메일이 꺼져 있으면(notify 없음) 칸이 없다');
  assert.doesNotMatch(entryView({paused:{state:'paused',until:'',note:'',noteEn:'',notify:true}}),/data-form="waitlist"/,'쉬는 중에는 없다');
});

test('남긴 뒤: 칸 대신 「알림을 걸어 두었어요」 한 줄(화면 읽기에 알림) — 남긴 주소는 글로만 넣는다',()=>{
  const [one]=slots(entryView({paused:{...FULL,notify:true,notified:'buyer@pulse-synthetic.test'}}));
  assert.doesNotMatch(one.inner,/data-form="waitlist"/);
  assert.match(one.inner,/<p class="sx-small sx-wait-done" role="status">알림을 걸어 두었어요\. 자리가 나면 buyer@pulse-synthetic\.test 주소로 한 번 보내 드려요\.<\/p>/);
  assert.deepEqual(JSON.parse(one.key),['full','','ko',true,'buyer@pulse-synthetic.test'],'남기면 열쇠가 바뀌어 다시 그린다');
  const [odd]=slots(entryView({paused:{...FULL,notify:true,notified:'"><img src=x onerror=alert(1)>@x.co'}}));
  assert.doesNotMatch(odd.inner,/<img/,'주소는 글로만');
  // 이미 그려진 화면: 남긴 뒤 다시 그리고, 같은 상태는 다시 쓰지 않는다.
  const slot={writes:0,html:'',hasAttribute:()=>false,set innerHTML(value){this.writes++;this.html=value;}};
  const state={resume:false,paused:{...FULL,notify:true},key:null},parts={starts:[],notes:[],slots:[slot]};
  applyEntryIntake(parts,state);assert.match(slot.html,/data-form="waitlist"/);
  state.paused={...FULL,notify:true,notified:'a@b.co'};applyEntryIntake(parts,state);assert.match(slot.html,/알림을 걸어 두었어요/);
  applyEntryIntake(parts,state);assert.equal(slot.writes,2);
});

test('영어 화면: 칸 · 남긴 뒤 · 오류 글',async()=>{
  await setLocale('en');
  try{
    const [one]=slots(entryView({paused:{...FULL,notify:true}}));
    assert.match(one.inner,/Want an email when a spot opens up\?/);assert.match(one.inner,/<span>Notify me<\/span>/);
    assert.match(one.inner,/We’ll email this address just once when a spot opens up, then delete it\./);
    assert.match(slots(entryView({paused:{...FULL,notify:true,notified:'a@b.co'}}))[0].inner,/You’re on the list\. We’ll send one email to a@b\.co when a spot opens up\./);
    assert.deepEqual(JSON.parse(one.key),['full','','en',true,'']);
  }finally{await setLocale('ko');}
  for(const code of ['SYNK_PULSE_WAITLIST_OPEN','SYNK_PULSE_WAITLIST_OFF','SYNK_PULSE_WAITLIST_FULL'])assert.ok(ERROR_CODE_TEXT[code],code);
});

test('앱: 공개 상태의 notify를 읽고(대기까지 찼을 때만), 등록은 같은 출처 POST(주소 · 화면 언어 · 덫 칸만) — 남긴 주소는 다시 읽어도 안내에 남고, 열렸거나 꺼졌으면 상태를 새로 읽는다',()=>{
  const app=read('app.mjs');
  assert.ok(app.includes("...(result.state==='full'&&result.notify===true?{notify:true}:{})};"),'notify는 full일 때만');
  assert.ok(app.includes("JSON.stringify([intake.state,intake.kinds,intake.noticeDate,!!intake.notify])"),'메일이 켜지고 꺼지는 것도 다시 그린다');
  assert.ok(app.includes("if(type==='waitlist'){await waitlistStep(form,values);return;}"));
  assert.ok(app.includes("const slot=form.closest('[data-paused]');let back=null;")&&app.includes("try{await request('/pulse/api/waitlist',{body:{email,locale:locale()==='en'?'en':'ko',website:values.website||''}});waitlistDone=email;waitlistDoneAt=Date.now();hideNotice();render();back=slot;}"),'보낸 뒤 초점은 칸이 있던 안내 자리로');
  assert.ok(app.includes(`back=form.isConnected&&!slot?.hidden?form.querySelector('[name=email]'):slot?.hidden?document.querySelectorAll('[data-entry="start"]')[[...document.querySelectorAll('[data-paused]')].indexOf(slot)]:slot;}`)&&app.includes("finally{setBusy(false);back?.focus({preventScroll:true});}"),'못 남겼을 때도 초점을 돌린다 — 칸 · 같은 자리의 시작 단추 · 바뀐 안내(카본 A2)');
  assert.ok(app.includes("const intakeSeen=result=>{const intake=intakeOf(result);intakeSeenAt=Date.now();if(intake.state!=='full')waitlistDone='';return intake;};")&&app.includes("networkRequest('/pulse/api/availability').then(intakeSeen,"),'대기까지 찬 상태가 풀린 것을 읽으면 남긴 주소를 지운다 — 다시 찼을 때 지난 줄 대신 칸(카본 A1)');
  // 최종 검수: 알림 칸은 「보내지 않은 글」이 아니다(떠날 때 저장 안 됨 창 · 나가기 대화상자가 뜨지 않게), 성공하면 앞선 오류 알림을 거두고,
  // 남긴 뒤 접수 상태를 15분 넘게 못 읽었으면(가려진 탭 — 열림 · 알림 · 다시 참이 지나갔을 수 있다) 화면으로 돌아올 때 줄 대신 칸. 보이는 동안(1분마다 읽음)은 줄이 남는다.
  assert.ok(app.includes("['invite','login','waitlist'].includes(form.dataset.form)"),'알림 칸은 초안으로 남지 않는다');
  assert.ok(app.includes("waitlistDone=email;waitlistDoneAt=Date.now();hideNotice();render();back=slot;}"),'성공하면 앞선 알림을 거둔다');
  assert.ok(app.includes("const WAITLIST_DONE_MS=15*60000;")&&/const since=Math\.max\(intakeSeenAt,waitlistDoneAt\);\r?\n  const intake=await readIntake\(\);\r?\n(?:  \/\/[^\n]*\n)?  if\(waitlistDone&&waitlistDoneAt<=since&&intakeSeenAt-since>WAITLIST_DONE_MS\)\{waitlistDone='';waitlistRedraw=true;\}/.test(app)&&app.includes("if(intake&&(waitlistRedraw||intakeKey(intake)!==intakeKey(s.intake))&&!s.project&&canApplyRemote()){waitlistRedraw=false;s.intake=intake;render();}"),'못 읽은 틈이 15분을 넘을 때만 칸을 다시(남긴 시각이 아니라 — 최종 검수 다시 P2)');
  assert.ok(app.includes("if(error.code==='SYNK_PULSE_WAITLIST_OPEN'||error.code==='SYNK_PULSE_INTAKE_PAUSED'||error.code==='SYNK_PULSE_WAITLIST_OFF'){const intake=await readIntake({fresh:true});if(intake&&!s.project){s.intake=intake;render();}}"));
  const css=read('film.css');
  assert.match(css,/\.sx-wait\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;/);
  assert.match(css,/\.sx-hero-act \.sx-wait,\.sx-hero-act \.sx-wait-done,\.sx-hero-act \.sx-paused-when\{display:none\}/,'휴대폰 1쪽(두 줄 높이)에는 칸을 두지 않고 끝 쪽 안내가 맡는다 — 둘째 줄은 내려가는 단추로');
  assert.match(css,/\n\.sx-wait-jump\{display:none\}/,'넓은 화면에서는 단추가 숨는다');
  assert.match(css,/\.sx-hero-act \.sx-wait-jump\{display:inline-flex;/);
  assert.ok(read('film-home.mjs').includes(`if(what==='wait'){const end=$('.sx-end');(end?.closest('.sx-p')||end)?.scrollIntoView({behavior:smooth()});$('.sx-end form[data-form="waitlist"] input[name="email"]')?.focus({preventScroll:true});return;}`),'단추는 끝 쪽 칸으로 내려가 주소 칸에 초점');
});
