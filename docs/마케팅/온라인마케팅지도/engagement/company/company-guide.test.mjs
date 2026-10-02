import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {companyGuide} from './company-guide.mjs';
import {createCompanyApp} from './server.mjs';

const source=readFileSync(new URL('./public/company-guide.js',import.meta.url),'utf8');
function client(){
  const requests=[],handlers=new Map();let renders=0;
  const context=vm.createContext({URL,Intl,Promise,console,
    state:{user:{id:'A',role:'viewer'},tab:'handbook'},
    document:{addEventListener:(name,handler)=>handlers.set(name,handler),getElementById:()=>({scrollIntoView(){}})},window:{scrollTo(){}},
    escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    safeUrl:url=>url,icon:()=>'',button:label=>label,pageHeading:()=>'',bmDate:date=>date,
    api(path){let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,resolve,reject});return pending;},render(){renders++;},
    FormData:class{constructor(form){this.values=form.values;}get(name){return this.values[name];}}
  });
  vm.runInContext(source,context);const run=code=>vm.runInContext(code,context);run('companyGuideIdentity()');
  return{context,run,requests,handlers,cg:run('cg'),get renders(){return renders;}};
}
test('the guide focuses on welfare, classes and consultation and omits space and brand libraries',()=>{
  const guide=companyGuide();assert.equal(guide.documents.length,17);assert.equal(guide.categories.length,4);
  for(const row of guide.documents){assert.ok(row.text.length>100);assert.equal(row.error,undefined);assert.ok(row.updatedAt);}
  assert.equal(new Set(guide.documents.map(row=>row.id)).size,17);assert.equal(new Set(guide.documents.map(row=>row.path)).size,17);
  assert.ok(!guide.documents.some(row=>['operations','company'].includes(row.category)));assert.ok(!guide.documents.some(row=>['quality','content-template','workspace'].includes(row.id)));
  const expected=['02_학생_복지_프로그램.txt','02B_장학제도_운영규칙_내부용.txt','03_유학_프로그램.txt','04_SYNK_크루_핸드북.txt','08_설명회_원장_스피치.txt','09_학부모_안내문.txt','10_SYNK_LAB_수업_커리큘럼.txt','SYNK LAB 강사 수업 규칙.txt','SYNK LAB 급여 인센티브 정본.txt','SYNK LAB 주간 교안 양식.txt','SYNK LAB 소그룹 과업 은행.txt'];
  for(const name of expected)assert.ok(guide.documents.some(row=>row.path.endsWith('/'+name)),name);
  const hasSection=(document,section)=>document.text.split(/\r?\n/).some(line=>/^#{1,6} /.test(line)&&line.includes(section));
  for(const group of guide.categories){assert.ok(guide.documents.some(row=>row.category===group.id));for(const shortcut of group.shortcuts){const document=guide.documents.find(row=>row.id===shortcut.documentId);assert.ok(document);if(shortcut.section)assert.ok(hasSection(document,shortcut.section),shortcut.label);}}
  for(const document of guide.documents)for(const summary of document.highlights)assert.ok(hasSection(document,summary.section),summary.label);
  for(const group of guide.categories)for(const fact of group.facts){const document=guide.documents.find(row=>row.id===fact.documentId);assert.ok(document);assert.ok(hasSection(document,fact.section),fact.label);}
  const welfare=guide.categories.find(row=>row.id==='student');assert.equal(welfare.facts.length,7);assert.equal(welfare.overview.items.length,2);
  assert.match(welfare.facts.find(row=>row.label==='TOPIK 응시료').note,/같은 시험.*중복/);
  assert.equal(guide.categories.find(row=>row.id==='crew').facts.filter(row=>row.condition==='도입 미정').length,3);
  for(const row of guide.documents)for(const id of row.related)assert.ok(guide.documents.some(other=>other.id===id));
  const handbook=guide.documents.find(row=>row.id==='crew-handbook');assert.match(handbook.scope,/LAB/);assert.match(handbook.status,/2027-02-25.*예정/);assert.match(handbook.notice,/미정/);
  assert.ok(!guide.documents.some(row=>row.path.includes('AI_운영원칙')),'AI instructions are not employee rules');
  assert.ok(!guide.documents.some(row=>row.path.includes('SYNK 보안')));
  const curriculum=guide.documents.find(row=>row.id==='curriculum');assert.match(curriculum.notice,/90분.*30분/);assert.match(curriculum.notice,/목표는 TOPIK 4급.*상한은 TOPIK 5급/);
  assert.match(guide.documents.find(row=>row.id==='lesson-rules').notice,/20분.*이전.*30분/);
  assert.match(guide.documents.find(row=>row.id==='student-welfare').text,/조건을 충족한 뒤.*1회/);
  assert.match(guide.documents.find(row=>row.id==='terms').notice,/게시 전 초안/);
});
test('guidance is available to active crews of every role and cannot be read anonymously or after access revocation',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-company-guide-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  assert.equal((await fetch(base+'/api/company-guide')).status,401);
  for(const role of ['admin','manager','member','viewer']){
    const user=app.store.createUser({name:role,email:role+'@example.test',role}),cookie=`synk_company_session=${app.store.mint('session',user.id,{},10)}`;
    const response=await fetch(base+'/api/company-guide',{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal((await response.json()).documents.length,17);
    const rejected=await fetch(base+'/api/company-guide/encryption.key',{headers:{Cookie:cookie}});assert.equal(rejected.status,404);
    app.store.put('users',user.id,{...user,active:false});assert.equal((await fetch(base+'/api/company-guide',{headers:{Cookie:cookie}})).status,401);
  }
});
test('document rendering escapes raw HTML and unsafe links while preserving readable tables and lists',()=>{
  const f=client();f.context.text='# 규칙\n\n<script>boom()</script>\n\n[unsafe](javascript:alert) [safe](https://example.test/)\n\n| 항목 | 내용 |\n|---|---|\n| **근무** | 원문 |\n\n1. 첫째\n2. 둘째\n\n```\n<img onerror="boom">\n```';
  const html=f.run('cgMarkdown(text)');assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<img|href="javascript:/);assert.match(html,/href="https:\/\/example.test\//);assert.match(html,/<thead>/);assert.match(html,/<strong>근무<\/strong>/);assert.match(html,/<ol start="1">/);assert.match(html,/company-doc-section-0/);
});
test('search finds document body text and keeps category scope; guide failures support a fresh retry',async()=>{
  const f=client();f.context.guide={categories:[{id:'rules',label:'규칙'}],documents:[{id:'one',category:'rules',title:'핸드북',text:'고객 정보 보호',description:'',scope:'LAB',status:'예정'},{id:'two',category:'company',title:'회사',text:'고객 정보 보호',description:'',scope:'공통',status:'정본'}]};
  f.run("cg.query='고객 정보';cg.category='rules'");const html=f.run('cgDirectory(guide)');assert.match(html,/문서 1개/);assert.match(html,/핸드북/);assert.doesNotMatch(html,/<h2>회사<\/h2>/);
  const first=f.run('loadCompanyGuide()');f.requests[0].reject(new Error('연결 오류'));await first;assert.equal(f.cg.error,'연결 오류');assert.equal(f.cg.loading,false);
  const retry=f.run('loadCompanyGuide()');f.requests[1].resolve(f.context.guide);await retry;assert.equal(f.cg.error,'');assert.equal(f.cg.data.documents.length,2);
});
test('late responses cannot restore the departed user guide and identity changes clear reader and search state',async()=>{
  for(const user of ['A','B']){
    const f=client(),pending=f.run('loadCompanyGuide()');f.run("cg.selected='crew-handbook';cg.query='private'");
    f.context.state.user=null;f.run('resetCompanyGuide()');f.context.state.user={id:user,role:'member'};f.run('companyGuideIdentity()');const renders=f.renders;
    f.requests[0].resolve({documents:[{text:'old response'}]});await pending;assert.equal(f.cg.data,null);assert.equal(f.cg.selected,'');assert.equal(f.cg.query,'');assert.equal(f.renders,renders);
  }
});

test('overview shows three concise sections without document cards and filtered search preserves reading context',()=>{
  const f=client();f.context.guide=companyGuide();f.cg.data=f.context.guide;
  const overview=f.run('cgDirectory(guide)');assert.match(overview,/복지와 수업 한눈에/);assert.doesNotMatch(overview,/cg-topic|cg-document-group|분야별 전체 문서|자주 찾는 안내|운영과 공간|회사와 브랜드/);assert.equal((overview.match(/<dt>/g)||[]).length,6);
  f.run("cg.query='6개월 이상';cg.category='student'");const search=f.run('cgDirectory(guide)');assert.match(search,/<mark>6개월 이상<\/mark>/);assert.match(search,/학생 복지 프로그램/);assert.doesNotMatch(search,/급여와 인센티브/);
  const click=f.handlers.get('click');click({target:{closest:()=>({dataset:{action:'company-guide-open',id:'student-welfare'}})}});assert.equal(f.cg.selected,'student-welfare');
  click({target:{closest:()=>({dataset:{action:'company-guide-back'}})}});assert.equal(f.cg.selected,'');assert.equal(f.cg.category,'student');assert.equal(f.cg.query,'6개월 이상');
});
test('original cross references open only allowlisted documents, and code fences do not shift the section index',()=>{
  const f=client();f.cg.data=companyGuide();f.context.path='docs/수강약관_초안_v1.md';
  const html=f.run("cgInline('[복지](<정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/02_학생_복지_프로그램.txt>) [secret](../private.key)',path)");assert.match(html,/data-id="student-welfare"/);assert.doesNotMatch(html,/data-id=".*private/);
  f.context.text='# 시작\n```\n# 코드 속 제목\n```\n> ## 최신 표\n> | 레벨 | 목표 |\n> |---|---|\n> | Lv1 | 1급 |\n\n## 마지막';
  const headings=f.run('cgHeadings(text)'),body=f.run('cgMarkdown(text)');assert.deepEqual(Array.from(headings),['시작','최신 표','마지막']);assert.equal((body.match(/id="company-doc-section-/g)||[]).length,3);assert.match(body,/<blockquote><h3/);assert.match(body,/<thead>/);assert.equal(f.run("cgSectionId(text,'마지막')"),'company-doc-section-2');
});
test('reader separates concise welfare from full original without losing notices, source links or the document title',()=>{
  const f=client();f.cg.data=companyGuide();f.context.row=f.cg.data.documents.find(row=>row.id==='student-welfare');let html=f.run('cgReader(row)');
  assert.match(html,/핵심 안내/);assert.match(html,/몽골 계정/);assert.match(html,/같은 시험의 성취 보상과 중복 지급하지 않습니다/);assert.doesNotMatch(html,/다시 시작하는 사람이 크루/);assert.match(html,/장학 제도 운영 규칙/);assert.match(html,/원문 정보/);
  assert.equal((html.match(/<h1>/g)||[]).length,1);assert.equal((html.match(/<dt>/g)||[]).length,7);
  const click=f.handlers.get('click');click({target:{closest:()=>({dataset:{action:'company-guide-mode',id:'original'}})}});html=f.run('cgReader(row)');assert.match(html,/다시 시작하는 사람이 크루/);assert.match(html,/9월 29일의/);assert.match(html,/문서 목차/);
  click({target:{closest:()=>({dataset:{action:'company-guide-open',id:'crew-handbook',section:'일상을 받치는 것'}})}});assert.equal(f.cg.readerMode,'original');
});
