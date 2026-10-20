// Course state is persisted by synk-classroom's locked transaction. Learner
// manuscripts live ONLY under learnerState, covered by account purge/ownership.
import catalog from './topik4-course.json' with {type:'json'};
import prismContract from '../../tools/lib/prism계약.js';
export const CORRECTION_TAGS=Object.freeze(['체','조','어','낱','맞','띄','연','근','빠','자']);
const materials=Object.freeze({
 체:'「이용자가 늘었어요. 비용은 감소했다.」를 한 문체로 고치고 두 문장 끝을 확인한다.',
 조:'「학생 15명이 왔다 / 비율이 63%가 되었다」에서 수량을 읽고 조사 선택 이유를 설명한다.',
 어:'「이유는 시간이 부족했다」를 이유와 결말이 호응하도록 고친다.',
 낱:'40%에서 55%로 바뀐 가상 자료를 보고 증가 폭을 %포인트로 설명한다.',
 맞:'「되었다·됐다」를 바꾸어 써 보고 「됬다」와의 차이를 확인한다.',
 띄:'「할수 있다 / 할 수 있다」와 「안한다 / 안 한다」를 고르고 자기 문장에 적용한다.',
 연:'가상 조사 결과 두 문장을 「반면에·또한」 가운데 뜻에 맞는 말로 잇는다.',
 근:'주장 하나에 왜 그런지와 구체적인 예를 각각 한 문장씩 덧붙인다.',
 빠:'질문 세 개를 각각 체크하며 자기 글에서 답한 문장을 찾아 표시한다.',
 자:'가상 수치 1,200→6,800의 변화만 설명하고 자료에 없는 원인 문장을 지운다.'
});
const clone=value=>structuredClone(value);
const fail=(code,status=400)=>{throw Object.assign(Error(code),{code,status});};
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail('INVALID_COURSE_TEXT');return value.trim().normalize('NFC');};
const key=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(value))fail('INVALID_IDEMPOTENCY_KEY');return value;};
const eligible=l=>!l.revoked&&l.accountId&&l.sharing?.enabled&&l.accountLearning?.enabled!==false;
const records=l=>(l.courseWriting||[]).filter(r=>r.sharingRevision===l.sharing.revision);
const teacher=(s,a)=>{if(a.role!=='teacher'||!s.classes.some(c=>c.teacherIds.includes(a.id)))fail('FORBIDDEN',403);};
function learner(s,a){const l=s.learners.find(l=>l.id===a.id);if(a.role!=='learner'||!l||!eligible(l))fail('LEARNING_DISABLED',403);return l;}
function taskFor(s,id){const task=(s.courseTasks||[]).find(t=>t.id===id);if(!task)fail('COURSE_TASK_MISSING',404);return task;}
function material(task){const row=catalog.find(w=>w.week===task.week);return {week:row.week,title:row.title,prompt:row.prompt,reading:row.reading.map(({answer,explanation,...question})=>question)};}
function visibleRecord(record){
 const result=clone(record);delete result.actions;
 for(const version of result.versions)for(const feedback of version.feedback)delete feedback.reviewerId;
 result.improvement=null;
 const latest=result.versions.at(-1),first=result.versions[0],a=first?.feedback.at(-1),b=latest?.feedback.at(-1);
 if(result.versions.length>1&&a&&b&&a.rubric&&b.rubric)result.improvement={basis:'teacher-reviewed-revisions',originalVersion:first.version,revisionVersion:latest.version,content:b.rubric.content-a.rubric.content,structure:b.rubric.structure-a.rubric.structure,language:b.rubric.language-a.rubric.language,note:'같은 과제의 교사 첨삭 변화입니다. 공식 점수·급수·일반 학습 효과가 아닙니다.'};
 return result;
}
export function courseView(s,a,now=Date.now()){
 if(a.role==='teacher')teacher(s,a);else if(a.role!=='learner'||!s.learners.some(l=>l.id===a.id&&!l.revoked))fail('FORBIDDEN',403);
 const tasks=(s.courseTasks||[]).map(t=>({id:t.id,week:t.week,dueAt:t.dueAt,createdAt:t.createdAt,material:material(t)}));
 if(a.role==='learner'){
  const l=s.learners.find(l=>l.id===a.id);
  return {role:'learner',sharing:clone(l.sharing),canSubmit:!!eligible(l),tasks,records:(l.courseWriting||[]).map(r=>({...visibleRecord(r),readOnly:!eligible(l)||r.sharingRevision!==l.sharing.revision})),note:'내가 낸 원고와 첨삭 이력은 공유를 꺼도 내가 읽을 수 있습니다. 새 제출은 현재 반 공유 설정을 따릅니다.'};
 }
 return {role:'teacher',tasks,weeks:catalog.map(({week,title})=>({week,title})),learners:s.learners.filter(eligible).map(l=>({id:l.id,name:l.name,sharingRevision:l.sharing.revision,records:records(l).map(visibleRecord)})),groups:(s.courseTasks||[]).map(t=>courseGroup(s,t,now))};
}
export function courseGroup(s,task,now){
 const available=s.learners.filter(eligible).filter(l=>records(l).find(r=>r.taskId===task.id)?.groupConsent===true),reviewed=available.map(l=>records(l).find(r=>r.taskId===task.id)?.versions[0]?.feedback.at(-1)).filter(Boolean);
 // A five-person floor applies to both contributors and each displayed cell.
 // Nothing, including exact count or tags, is returned below that floor.
 if(reviewed.length<5)return {taskId:task.id,status:'insufficient',minimum:5,cells:[]};
 const denominator=reviewed.length,from=task.createdAt,to=new Date(now).toISOString();
 const cells=CORRECTION_TAGS.map(tag=>{const n=reviewed.filter(f=>f.tags.includes(tag)).length;if(n<5)return null;
  const cell={값:n/denominator,n,분모:denominator,독립수:denominator,편중:1/denominator,판:'topik4-teacher-tags-v1',출처:'담당 교사가 돌려준 첫 원고 첨삭',키출처:'반 내부의 중복 제거된 제출 계보',대상:'현재 동의한 이 반의 첫 원고',과업:`W${task.week}`,조건:'첫 원고당 최신 교사 첨삭 하나; 재제출 제외; 기회 대비 오류율 아님',기간:`${from}/${to}`};
  if(!prismContract.검증(cell,{갈래:'강사'}).통과)fail('INVALID_GROUP_EVIDENCE',500);
  return {tag,...cell,suggestion:materials[tag]};
 }).filter(Boolean).sort((a,b)=>b.n-a.n).slice(0,3);
 const signature=JSON.stringify([denominator,available.length,cells.map(c=>[c.tag,c.n])]);
 return {taskId:task.id,status:'ready',reviewed:denominator,eligible:available.length,unreviewed:available.length-denominator,cells,plan:task.lessonPlan?.signature===signature?clone(task.lessonPlan):null,note:'이 반·이 과제에서 교사가 표시한 비율입니다. 전체 학습자 분포·개인 성향·인과 추정에 쓰지 않습니다.'};
}
function replay(record,payload,kind,run){
 const id=key(payload.idempotencyKey),signature=JSON.stringify({...payload,idempotencyKey:undefined}),old=record.actions.find(x=>x.id===id);
 if(old){if(old.signature!==signature||old.kind!==kind)fail('IDEMPOTENCY_CONFLICT',409);return {duplicate:true,record:visibleRecord(record)};}
 run();record.actions.push({id,signature,kind});return {duplicate:false,record:visibleRecord(record)};
}
export function courseCommand(s,a,route,p,now=Date.now()){
 const at=new Date(now).toISOString();
 if(route==='/api/course/assign'){
  teacher(s,a);key(p.idempotencyKey);if(!Number.isInteger(p.week)||p.week<1||p.week>8)fail('INVALID_COURSE_WEEK');
  if(!Number.isFinite(Date.parse(p.dueAt))||Date.parse(p.dueAt)<=now)fail('INVALID_DUE_AT');
  const tasks=s.courseTasks||=[],signature=JSON.stringify([p.week,p.dueAt]),old=tasks.find(t=>t.idempotencyKey===p.idempotencyKey);
  if(old){if(old.signature!==signature)fail('IDEMPOTENCY_CONFLICT',409);return {task:clone(old),duplicate:true};}
  if(tasks.some(t=>t.week===p.week))fail('COURSE_ALREADY_ASSIGNED',409);
  const task={id:`course-${p.week}-${key(p.idempotencyKey)}`,week:p.week,dueAt:new Date(p.dueAt).toISOString(),createdAt:at,idempotencyKey:p.idempotencyKey,signature};
  s.courseTasks=tasks;tasks.push(task);return {task:clone(task)};
 }
 const task=taskFor(s,p.taskId);
 if(route==='/api/course/plan'){
  teacher(s,a);const group=courseGroup(s,task,now);if(group.status!=='ready'||!group.cells.length)fail('GROUP_EVIDENCE_CHANGED',409);
  const signature=JSON.stringify([group.reviewed,group.eligible,group.cells.map(c=>[c.tag,c.n])]);
  if(p.signature!==signature)fail('GROUP_EVIDENCE_CHANGED',409);
  task.lessonPlan={signature,at,materials:group.cells.map(c=>({tag:c.tag,activity:c.suggestion})),minutes:10,note:'다음 수업에서 먼저 스스로 고쳐 쓰기 → 이유 비교 → 새 문장으로 다시 확인. 교사 선택이며 실행·학습 효과 확인은 별도.'};
  return {plan:clone(task.lessonPlan)};
 }
 if(route==='/api/course/group-sharing'){
  const l=learner(s,a),record=records(l).find(r=>r.taskId===task.id);
  if(p.sharingRevision!==l.sharing.revision||!record||p.baseConsentRevision!==(record.consentRevision||1))fail('REVISION_CONFLICT',409);
  if(typeof p.enabled!=='boolean')fail('INVALID_CONSENT');
  if(record.groupConsent!==p.enabled){record.groupConsent=p.enabled;record.consentRevision=(record.consentRevision||1)+1;}
  return {record:visibleRecord(record)};
 }
 if(route==='/api/course/submit'){
  const l=learner(s,a);if(p.sharingRevision!==l.sharing.revision)fail('REVISION_CONFLICT',409);
  l.courseWriting??=[];let record=records(l).find(r=>r.taskId===task.id);
  if(!record){record={taskId:task.id,sharingRevision:l.sharing.revision,versions:[],actions:[],groupConsent:false,consentRevision:1};}
  const result=replay(record,p,'submit',()=>{
   const prior=record.versions.at(-1);if(p.baseVersion!==(prior?.version||0))fail('REVISION_CONFLICT',409);
   if(record.versions.length>=20)fail('COURSE_VERSION_LIMIT',409);
   if(prior&&!prior.feedback.length)fail('WAIT_FOR_FEEDBACK',409);
   const body=text(p.text,12000),reflection=prior?text(p.reflection,2000):'';
   let reading=prior?.reading;
   if(!prior){const qs=catalog[task.week-1].reading;if(!p.reading||Object.keys(p.reading).length!==5||qs.some(q=>!Number.isInteger(p.reading[q.id])||p.reading[q.id]<1||p.reading[q.id]>4))fail('READING_INCOMPLETE');
    reading=qs.map(q=>({id:q.id,chosen:p.reading[q.id],correct:p.reading[q.id]===q.answer,answer:q.answer,explanation:q.explanation}));
   }
   record.versions.push({version:(prior?.version||0)+1,text:body,reflection,submittedAt:at,late:now>Date.parse(task.dueAt),reading:clone(reading),feedback:[]});
  });
  if(!l.courseWriting.includes(record))l.courseWriting.push(record);
  return result;
 }
 if(route==='/api/course/feedback'){
  teacher(s,a);const l=s.learners.find(l=>l.id===p.learnerId);if(!l||!eligible(l))fail('SHARING_DISABLED',403);
  if(p.sharingRevision!==l.sharing.revision)fail('REVISION_CONFLICT',409);
  const record=records(l).find(r=>r.taskId===task.id);if(!record)fail('COURSE_SUBMISSION_MISSING',404);
  return replay(record,p,'feedback',()=>{
   const version=record.versions.find(v=>v.version===p.version);if(!version)fail('REVISION_CONFLICT',409);
   if(p.baseFeedback!==(version.feedback.at(-1)?.revision||0))fail('REVISION_CONFLICT',409);
   if(version.feedback.length>=20)fail('COURSE_VERSION_LIMIT',409);
   const good=text(p.good,1000),focus=text(p.focus,1000),retry=text(p.retry,1000);
   if(!Array.isArray(p.tags)||p.tags.length>5||new Set(p.tags).size!==p.tags.length||p.tags.some(t=>!CORRECTION_TAGS.includes(t)))fail('INVALID_CORRECTION_TAGS');
   const rubric=p.rubric;if(!rubric||Object.keys(rubric).length!==3||['content','structure','language'].some(k=>![0,1,2].includes(rubric[k])))fail('INVALID_RUBRIC');
   if(!Number.isInteger(p.minutes)||p.minutes<0||p.minutes>240)fail('INVALID_REVIEW_TIME');
   version.feedback.push({revision:version.feedback.length+1,at,good,focus,retry,tags:[...p.tags],rubric:clone(rubric),minutes:p.minutes,reviewerId:a.id});
  });
 }
 fail('NOT_FOUND',404);
}
