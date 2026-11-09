'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./core.js'),D=require('./demo.json');
const base={category:'automation',mode:'commission',goal:'문의 접수와 분류를 한 흐름으로 만들고 싶어요.',deliverable:'문의 접수와 담당자 알림',budgetMax:1000000,deadline:'2026-11-23'};
test('예산·기한 미정은 유효하며 동의는 기본 false다',()=>{
 const r=C.validateRequest({...base,budgetMax:'',deadline:''},'2026-11-09');
 assert.equal(r.valid,true);assert.equal(r.value.budgetMax,null);assert.equal(r.value.deadline,null);
 assert.equal(r.value.shareWithCandidates,false);assert.equal(r.value.publishCase,false);
});
test('잘못된 날짜·과거·0원·소수·비정상 수치를 거절한다',()=>{
 for(const value of ['2026-02-30','2026-11-08','not-a-date'])assert.equal(C.validateRequest({...base,deadline:value},'2026-11-09').valid,false);
 for(const value of [0,-1,1.5,Infinity,'NaN',1000000001])assert.equal(C.validateRequest({...base,budgetMax:value},'2026-11-09').valid,false);
});
test('https 아닌 링크와 사용자 정보가 든 링크를 받지 않는다',()=>{
 for(const reference of ['javascript:alert(1)','http://example.com','https://name:pass@example.com'])assert.equal(C.validateRequest({...base,reference},'2026-11-09').valid,false);
 assert.equal(C.validateRequest({...base,reference:'https://example.com/work'},'2026-11-09').valid,true);
});
test('미참여 판매자는 가격이 맞아도 추천하지 않는다',()=>{
 const r=C.matchRequest(base,D.sellers,'2026-11-09');
 assert.deepEqual(r.matches.map(m=>m.seller.id),['creator-e']);
 assert.ok(r.excluded.find(x=>x.id==='creator-f').reasons.includes('참여·운영 검토 전'));
});
test('가격·납기 불일치 때 빈 결과를 내고 부적합 후보로 채우지 않는다',()=>{
 assert.equal(C.matchRequest({...base,budgetMax:499999},D.sellers,'2026-11-09').matches.length,0);
 assert.equal(C.matchRequest({...base,deadline:'2026-11-22'},D.sellers,'2026-11-09').matches.length,0);
 assert.equal(C.matchRequest({...base,deadline:'2026-11-23'},D.sellers,'2026-11-09').matches.length,1);
});
test('미정 예산·날짜·보안 조건은 확인 질문으로 남는다',()=>{
 const r=C.matchRequest({...base,budgetMax:null,deadline:null,constraints:'외부 데이터 전송 금지'},D.sellers,'2026-11-09');
 assert.equal(r.matches.length,1);assert.equal(r.matches[0].questions.length,4);
});
test('자료와 교육은 자신의 제공 방식·가격·준비 기간을 쓴다',()=>{
 const r=C.matchRequest({...base,mode:'digital',budgetMax:39000,deadline:'2026-11-09'},D.sellers,'2026-11-09');
 assert.equal(r.matches.length,1);assert.equal(r.matches[0].terms.from,39000);
});
test('판매자는 직접 역할·사례 링크·참여 의사를 채워야 한다',()=>{
 const seller={displayName:'예시 제작자',category:'automation',modes:['commission'],offer:'반복 문의 분류와 알림 업무를 구성합니다.',workUrl:'https://example.com/work',role:'설계부터 운영 안내까지 직접 맡음',priceFrom:'범위별 견적',availability:'협의',participation:true};
 assert.equal(C.validateSeller(seller).valid,true);
 for(const [k,v]of [['participation',false],['modes',[]],['workUrl','javascript:alert(1)'],['role','']])assert.equal(C.validateSeller({...seller,[k]:v}).valid,false);
});
const cost={orderValue:1000000,orders:30,commission:12,paymentRate:3.5,support:15000,lossRate:1,acquisition:0,fixed:3000000};
test('금액 구분자를 읽고 잘못된 숫자를 금액으로 바꾸지 않는다',()=>{
 assert.equal(C.parseNumericInput('1,000,000'),1000000);assert.equal(C.parseNumericInput('3.5'),3.5);assert.equal(C.parseNumericInput('0'),0);
 for(const value of ['', '1,00', '1,2,3', '0x10', 'Infinity', '-1', '1원'])assert.ok(Number.isNaN(C.parseNumericInput(value)));
});
test('거래액·플랫폼 매출·공헌이익·고정비를 구분한다',()=>{
 const r=C.economics(cost);assert.equal(r.fee,120000);assert.equal(r.contribution,60000);assert.equal(r.monthlyRevenue,3600000);assert.equal(r.operatingResult,-1200000);assert.equal(r.breakEven,50);
 assert.equal(C.economics({...cost,orders:50}).operatingResult,0);
 assert.equal(C.economics({...cost,acquisition:15000}).breakEven,67);
});
test('음수 공헌이익은 손익분기 거래 수를 만들어 내지 않는다',()=>{
 const r=C.economics({...cost,orderValue:10000});assert.equal(r.contribution,-14250);assert.equal(r.breakEven,null);
});
test('계산기의 빈값·음수·잘못된 비율·소수 건수를 거절한다',()=>{
 for(const [k,v]of [['orders',1.5],['orderValue',0],['fixed',NaN],['commission',101],['support',-1]])assert.equal(C.economics({...cost,[k]:v}).valid,false);
});
test('원고 20편은 실제 문서 절을 가리키며 고객 후기·게시 완료로 꾸미지 않는다',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
 const posts=JSON.parse(fs.readFileSync(path.join(root,'docs/AI_커뮤니티마켓/콘텐츠.json'),'utf8'));
 const source=fs.readFileSync(path.join(root,'docs/마케팅/제작양식/만족사례_장부.md'),'utf8');
 assert.equal(posts.items.length,20);assert.equal(new Set(posts.items.map(x=>x.id)).size,20);
 for(const item of posts.items){assert.ok(source.includes('### '+item.sourceSection+' · '));assert.equal(item.isCustomerReview,false);assert.equal(item.publicationStatus,'rights_and_media_review_required');}
});

