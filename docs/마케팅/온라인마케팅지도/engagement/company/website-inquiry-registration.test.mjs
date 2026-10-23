import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteInquiryRegistration,summarizeWebsiteRegistrations} from './website-inquiry-registration.mjs';

const topik=(patch={})=>({email:'first@example.test',type:'LAB · 한국어 교육',status:'new',message:'[TOPIK 4급 온라인 반 관심 등록]\n이름: 시험\n지금 급수: 3급\n4급이 필요한 때: 다음 학기\n토요일 시간: 오후\n들어온 곳: univ-test · 화면 언어 몽골어',...patch});
const ub=(consult=false,patch={})=>({email:'first@example.test',type:consult?'PATH · 유학·취업 연계':'LAB · 한국어 교육',status:'new',message:`[울란바토르 관심 등록 · ${consult?'유학 상담':'학원'}]\n이름: 시험\n누가 적었나: 학생 본인\n학생 한국어: 처음\n한국에 가려는 때: 내년\n${consult?'생각하는 유학: 학사':'다니기 좋은 때: 오후'}\n함께 등록: ${consult?'학원':'유학 상담'}\n들어온 곳: club-test · 화면 언어 한국어`,...patch});

test('three published registration formats keep distinct products and only plain registrations skip review',()=>{
  assert.deepEqual(websiteInquiryRegistration(topik()),{productId:'topik4',label:'TOPIK 4급 온라인 반',source:'univ-test',language:'mn',hasNote:false,resubmitted:false,waitlistOnly:true,manualReviewRequired:false});
  assert.equal(websiteInquiryRegistration(ub()).productId,'ub-academy');
  assert.equal(websiteInquiryRegistration(ub(true)).productId,'ub-consult');
  assert.equal(websiteInquiryRegistration(ub(true,{type:'SHIFT · 유학·취업 연계'})).waitlistOnly,true,'historical PATH label remains readable');
  for(const row of [topik({type:'PATH · 유학·취업 연계'}),topik({message:'일반 문의\n'+topik().message}),topik({message:'[TOPIK 4급 온라인 반 관심 등록 안내]\n이름: 시험'})])assert.equal(websiteInquiryRegistration(row),null);
});

test('free notes without question marks, resubmissions and unexpected content always need human review',()=>{
  for(const [label,addition]of[['concern','쓰기에서 어려운 점: 단어가 잘 떠오르지 않아요'],['question','쓰기에서 어려운 점: 언제 시작하나요?'],['resubmission','다시 등록: 앞서 보낸 등록의 이메일을 고쳐 다시 보냄(앞 등록은 버림)'],['unexpected','그 외: 연락해 주세요']]){
    const row=topik({message:topik().message+'\n'+addition}),parsed=websiteInquiryRegistration(row);
    assert.equal(parsed.waitlistOnly,false,label);assert.equal(parsed.manualReviewRequired,true,label);
  }
  const resubmitted=websiteInquiryRegistration(ub(true,{message:ub(true).message+'\n다시 등록: 앞서 old@example.test로 보낸 등록을 고쳐 다시 보냄(앞 등록은 버림)'}));
  assert.equal(resubmitted.resubmitted,true);assert.doesNotMatch(JSON.stringify(resubmitted),/old@example|시험/,'metadata contains no applicant identifiers');
  assert.equal(websiteInquiryRegistration(topik({message:topik().message.replace('토요일 시간: 오후\n','')})).manualReviewRequired,true);
  assert.equal(websiteInquiryRegistration(topik({message:topik().message.replace('univ-test','../../unsafe@example.test')})).source,'direct');
  assert.equal(websiteInquiryRegistration(ub(true,{message:ub(true).message+'\n궁금한 점: 한국 대학 입학 준비'})).hasNote,true);
});

test('test and privacy responses never enter registration summaries even with a valid product marker',()=>{
  for(const row of [topik({message:topik().message+'\n[SYNK 기능 점검 · 실제 문의 아님]'}),topik({message:topik().message+'\n개인정보 삭제 요청'}),topik({classification:{isTest:true}}),topik({classification:{category:'privacy'}})]){
    assert.equal(websiteInquiryRegistration(row),null);assert.equal(summarizeWebsiteRegistrations([row]).products[0].records,0);
  }
});

test('summaries deduplicate email within products, omit closed rows, retain source overlap and expose no addresses',()=>{
  const rows=[topik(),topik({email:' FIRST@EXAMPLE.TEST ',message:topik().message.replace('univ-test','friend')}),
    topik({email:'second@example.test',message:topik().message+'\n다시 등록: 이메일을 고쳐 보냄'}),
    topik({email:'third@example.test',message:topik().message+'\n쓰기에서 어려운 점: 쓰기가 어려워요'}),
    topik({email:'closed@example.test',status:'closed'}),topik({email:'first+extra@example.test'}),ub(),ub(true)];
  const result=summarizeWebsiteRegistrations(rows),a=result.products[0];
  assert.deepEqual({...a,sources:null},{id:'topik4',label:'TOPIK 4급 온라인 반',records:5,uniqueEmails:4,duplicateRecords:1,waitlistRecords:3,needsReviewRecords:2,resubmittedRecords:1,sources:null});
  assert.deepEqual(a.sources,[{source:'friend',records:1,uniqueEmails:1},{source:'univ-test',records:4,uniqueEmails:4}]);
  assert.equal(result.products[1].uniqueEmails,1);assert.equal(result.products[2].uniqueEmails,1);
  assert.doesNotMatch(JSON.stringify(result),/@|시험|쓰기에서 어려운/);
  assert.deepEqual(summarizeWebsiteRegistrations([]).products.map(p=>p.records),[0,0,0]);
});
