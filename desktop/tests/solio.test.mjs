// SYNK SOLIO 판(2026-11-13): 솔리오 공용 글 · 옛 회원 혜택 경로 옮김 · 찾기 · 홈 후보 · 내 계정 「맞춤 정보」.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SOLIO,SOLIO_SECTIONS,SOLIO_BACKUP,SOLIO_SUBSCRIPTIONS,SOLIO_SEARCH,solioSection,solioMigrateRoute,solioSearch} from '../renderer/solio.mjs';
import {MEMBER_BENEFITS,MEMBER_INSIGHT,memberBenefit} from '../renderer/benefits.mjs';
import {buildHomeModel,HOME_PINNED_ONLY} from '../renderer/member-home.mjs';
import {normalizeRoute} from '../renderer/convenience-state.mjs';
import {renderAccountPage} from '../renderer/account-page.mjs';

test('SOLIO names itself once, keeps the three tabs and falls back to home',()=>{
  assert.equal(SOLIO.name,'SYNK SOLIO');assert.equal(SOLIO.koName,'싱크 솔리오');assert.equal(SOLIO.menu,'솔리오');assert.equal(SOLIO.tagline,'AI 1인기업을 위한 통합 업무 앱');
  assert.deepEqual(SOLIO_SECTIONS.map(([id])=>id),['home','backup','subscriptions']);
  for(const value of ['home','backup','subscriptions'])assert.equal(solioSection(value),value);
  for(const value of [undefined,null,'','pay','__proto__','toString'])assert.equal(solioSection(value),'home');
});

test('backup is described as in preparation only — no install, download, sign-up or price promise',()=>{
  assert.equal(SOLIO_BACKUP.statusLabel,'준비 중');
  const copy=[SOLIO_BACKUP.headline,...SOLIO_BACKUP.rows.flat(),SOLIO.summary].join(' ');
  assert.doesNotMatch(copy,/출시|베타|신청하기|신청해 주|구매|결제|가격|\d+%/);
  assert.match(copy,/설치 파일과 요금은 아직 공개하지 않았어요/);
});

test('AI subscription management keeps the old board facts: PC app, free for members, records stay on this PC',()=>{
  assert.equal(SOLIO_SUBSCRIPTIONS.formerName,'AI 구독 계정판');assert.equal(SOLIO_SUBSCRIPTIONS.statusLabel,'PC 앱 · 회원 무료');
  assert.match(SOLIO_SUBSCRIPTIONS.availability,/기록은 이 PC에만 저장해요/);
  // 웹 안내는 새 판(「솔리오」 → 「AI 구독 관리」)과 0.4.88 이하 이전 판(「회원 혜택」 → 「AI 구독 계정판」)을 모두 실제 이름으로 적는다.
  assert.match(SOLIO_SUBSCRIPTIONS.pcEntry,/「솔리오」 → 「AI 구독 관리」/);
  assert.match(SOLIO_SUBSCRIPTIONS.pcEntry,/이전 판에서는 「회원 혜택」 → 「AI 구독 계정판」/);
  assert.doesNotMatch(SOLIO_SUBSCRIPTIONS.pcEntry,/이전 판은 「회원 혜택」\)에서 「AI 구독 관리」/);
});

test('member benefits now hold only PLEASURE; insight keeps its definition outside the list',()=>{
  assert.deepEqual(MEMBER_BENEFITS.map(item=>item.id),['care']);
  assert.equal(memberBenefit('insight'),null);assert.equal(memberBenefit('subscriptions'),null);assert.equal(memberBenefit('care')?.id,'care');
  assert.equal(MEMBER_INSIGHT.id,'insight');assert.equal(MEMBER_INSIGHT.name,'내 성향');
});

test('old benefit routes move to the new places; PLEASURE and unknown routes stay put',()=>{
  assert.deepEqual(solioMigrateRoute({view:'benefits',benefitId:'subscriptions',scroll:300,pageScroll:20}),{view:'solio',benefitId:null,section:'subscriptions',scroll:0,pageScroll:0});
  assert.deepEqual(solioMigrateRoute({view:'benefits',benefitId:'insight',scroll:300}),{view:'insight',benefitId:null,scroll:0,pageScroll:0});
  const care={view:'benefits',benefitId:'care',scroll:5};assert.equal(solioMigrateRoute(care),care);
  for(const value of [null,undefined,{view:'benefits',benefitId:'__proto__'},{view:'benefits',benefitId:'hasOwnProperty'},{view:'home',benefitId:'insight'}])assert.equal(solioMigrateRoute(value),value);
  // 저장된 마지막 화면도 같은 길로 옮긴다.
  assert.deepEqual(['view','section','benefitId'].map(key=>normalizeRoute({view:'benefits',benefitId:'insight'})[key]),['insight',null,null]);
  assert.deepEqual(['view','section','benefitId'].map(key=>normalizeRoute({view:'benefits',benefitId:'care'})[key]),['benefits',null,'care']);
  assert.deepEqual(['view','section'].map(key=>normalizeRoute({view:'solio',section:'backup'})[key]),['solio','backup']);
});

test('search finds the new places by their old names too',()=>{
  const ids=query=>solioSearch(query).map(item=>item.id);
  assert.deepEqual(ids('계정판'),['solio-subscriptions']);assert.deepEqual(ids('구독'),['solio-subscriptions']);
  assert.ok(ids('성향').includes('insight'));assert.ok(ids('백업').includes('solio-backup'));assert.ok(ids('솔리오').includes('solio'));
  assert.ok(ids('회원 혜택').includes('care'));assert.deepEqual(ids('   '),[]);
  assert.equal(SOLIO_SEARCH.find(item=>item.id==='insight').where,'내 계정 · 맞춤 정보');
  assert.equal(SOLIO_SEARCH.find(item=>item.id==='solio-subscriptions').hash,'#solio/subscriptions');
});

test('home candidates: PLEASURE stands on home only when pinned, used, holding an open task or chosen for this window',()=>{
  assert.deepEqual(HOME_PINNED_ONLY,['care']);
  const library={owner:'a',status:'ready',appIds:['messenger','care']};
  const quiet=buildHomeModel({library,prefs:{}});assert.deepEqual(quiet.homeOrder,['messenger']);assert.equal(quiet.first,'messenger');assert.ok(quiet.order.includes('care'),'the memo and grant order still know care');
  assert.ok(buildHomeModel({library,prefs:{favorites:['care']}}).homeOrder.includes('care'),'pinned');
  assert.ok(buildHomeModel({library,prefs:{lastLaunch:{care:200}}}).homeOrder.includes('care'),'recently opened');
  assert.ok(buildHomeModel({library,prefs:{},records:[{kind:'task',appId:'care',done:false}]}).homeOrder.includes('care'),'open task');
  assert.ok(!buildHomeModel({library,prefs:{},records:[{kind:'task',appId:'care',done:true}]}).homeOrder.includes('care'),'a finished task does not');
  assert.ok(buildHomeModel({library,personal:{sessionOnly:true,selected:'care'},prefs:{}}).homeOrder.includes('care'),'chosen for this window');
  const onlyCare=buildHomeModel({library:{owner:'b',status:'ready',appIds:['care']},prefs:{}});assert.deepEqual(onlyCare.homeOrder,[]);assert.equal(onlyCare.first,null);
});

test('the account page shows 맞춤 정보 with 내 성향 right after the profile and before sign-in',()=>{
  const html=renderAccountPage({signedIn:true,native:true,auth:{account:{display_name:'합성 회원'}},identity:{email:'synthetic@example.invalid'},data:{account:{status:'active',profile:{display_name:'합성 회원'}},sessions:[]}});
  const at=key=>html.indexOf(`data-section="${key}"`);
  assert.ok(at('01-profile')>=0&&at('01-profile')<at('02-personal')&&at('02-personal')<at('03-sign-in'),'profile → personal → sign-in');
  assert.match(html,/data-section="02-personal"><h2>맞춤 정보<\/h2>/);assert.match(html,/<h3>내 성향<\/h3>/);assert.match(html,/data-account-action="insight"/);
  assert.doesNotMatch(html.slice(at('02-personal'),at('03-sign-in')),/솔리오|진단|성격/);
});
