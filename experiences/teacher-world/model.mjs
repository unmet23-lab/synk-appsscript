import Learning from '../../atlas/learning.js';
import Personalization from '../../atlas/personalization.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
import {GAME_CONTENT,gameContent,gameProfiles} from './game-catalog.mjs';

// Local teacher MVP adapter over the existing Core learning policy and Strata map.
// No ninth Atlas engine, live authentication, production roster or proficiency score.
const map=Strata.createMap(mapData),DAY=86400000;
const copy=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const skillLabels=new Map(map.allNodes().filter(node=>node.kind==='skill').map(node=>[node.id,node.label_ko]));

const TASKS=freeze({
  'reading-detail':{id:'reading-detail',title:'도서관 안내문 읽기',skillIds:['ko.reading.detail'],difficulty:1,modality:'reading',responseFormat:'single-choice',assignable:true,minutes:3,
    passage:'우리 도서관은 월요일부터 토요일까지 오전 9시에 문을 엽니다. 일요일에는 쉽니다. 책은 한 사람에게 세 권까지 빌려 줍니다. 빌린 책은 2주 안에 돌려주세요.',
    questions:[
      {id:'detail-open',prompt:'도서관은 몇 시에 문을 엽니까?',options:[{id:'a',text:'오전 8시'},{id:'b',text:'오전 9시'},{id:'c',text:'오전 10시'}],answer:'b',explanation:'안내문에 오전 9시에 문을 연다고 쓰여 있어요.'},
      {id:'detail-books',prompt:'한 사람이 책을 몇 권까지 빌릴 수 있습니까?',options:[{id:'a',text:'두 권'},{id:'b',text:'세 권'},{id:'c',text:'다섯 권'}],answer:'b',explanation:'책은 한 사람에게 세 권까지 빌려 준다고 안내했어요.'},
      {id:'detail-return',prompt:'빌린 책은 언제까지 돌려줘야 합니까?',options:[{id:'a',text:'하루 안에'},{id:'b',text:'일주일 안에'},{id:'c',text:'2주 안에'}],answer:'c',explanation:'마지막 문장에 2주 안에 돌려달라고 쓰여 있어요.'}
    ]},
  'reading-negation':{id:'reading-negation',title:'바뀐 약속과 쉬는 날 읽기',skillIds:['ko.reading.negation'],difficulty:1,modality:'reading',responseFormat:'single-choice',assignable:true,minutes:3,
    passage:'내일 한국어 모임은 카페가 아니라 도서관에서 만납니다. 오전에는 도서관을 사용할 수 없어서 오후 2시에 만납니다. 간식은 준비되어 있으니 가져오지 않아도 됩니다.',
    questions:[
      {id:'negation-place',prompt:'내일 모임은 어디에서 합니까?',options:[{id:'a',text:'카페'},{id:'b',text:'도서관'},{id:'c',text:'공원'}],answer:'b',explanation:'카페가 아니라 도서관에서 만난다고 장소를 바꿨어요.'},
      {id:'negation-time',prompt:'언제 만납니까?',options:[{id:'a',text:'오전 9시'},{id:'b',text:'오전 11시'},{id:'c',text:'오후 2시'}],answer:'c',explanation:'오전에는 사용할 수 없어서 오후 2시에 만나요.'},
      {id:'negation-snack',prompt:'간식에 대한 설명으로 맞는 것은 무엇입니까?',options:[{id:'a',text:'꼭 가져와야 합니다.'},{id:'b',text:'가져오지 않아도 됩니다.'},{id:'c',text:'간식을 먹으면 안 됩니다.'}],answer:'b',explanation:'준비되어 있으니 가져오지 않아도 된다고 했어요.'}
    ]},
  'reading-condition':{id:'reading-condition',title:'신청 조건 확인하기',skillIds:['ko.reading.condition'],difficulty:1,modality:'reading',responseFormat:'single-choice',assignable:true,minutes:3,
    passage:'학교 요리 수업에 참여하고 싶으면 금요일까지 신청하세요. 재료를 준비해야 하므로 신청한 사람만 수업에 참여할 수 있습니다. 앞치마가 없으면 학교에서 빌릴 수 있습니다.',
    questions:[
      {id:'condition-day',prompt:'언제까지 신청해야 합니까?',options:[{id:'a',text:'목요일'},{id:'b',text:'금요일'},{id:'c',text:'토요일'}],answer:'b',explanation:'금요일까지 신청하라는 조건이 있어요.'},
      {id:'condition-who',prompt:'누가 수업에 참여할 수 있습니까?',options:[{id:'a',text:'신청한 사람'},{id:'b',text:'학교에 온 모든 사람'},{id:'c',text:'앞치마를 산 사람만'}],answer:'a',explanation:'신청한 사람만 참여할 수 있다고 했어요.'},
      {id:'condition-apron',prompt:'앞치마가 없으면 어떻게 합니까?',options:[{id:'a',text:'수업에 참여할 수 없습니다.'},{id:'b',text:'학교에서 빌립니다.'},{id:'c',text:'신청을 취소합니다.'}],answer:'b',explanation:'앞치마가 없으면 학교에서 빌릴 수 있어요.'}
    ]},
  'reading-detail-transfer':{id:'reading-detail-transfer',title:'학교 행사 안내문 읽기',skillIds:['ko.reading.detail'],difficulty:1,modality:'reading',responseFormat:'single-choice',assignable:true,minutes:4,
    passage:'이번 토요일에 학교에서 봄 행사를 합니다. 행사는 오전 10시에 시작하고 오후 1시에 끝납니다. 비가 와도 운동장이 아닌 강당에서 진행합니다. 점심은 학교에서 준비합니다. 물은 각자 가져오세요.',
    questions:[
      {id:'transfer-day',prompt:'행사는 언제 합니까?',options:[{id:'a',text:'금요일'},{id:'b',text:'토요일'},{id:'c',text:'일요일'}],answer:'b',explanation:'첫 문장에서 이번 토요일에 행사를 한다고 안내했어요.'},
      {id:'transfer-time',prompt:'행사는 몇 시에 끝납니까?',options:[{id:'a',text:'오전 10시'},{id:'b',text:'낮 12시'},{id:'c',text:'오후 1시'}],answer:'c',explanation:'시작은 오전 10시, 끝나는 시간은 오후 1시예요.'},
      {id:'transfer-place',prompt:'행사는 어디에서 합니까?',options:[{id:'a',text:'강당'},{id:'b',text:'운동장'},{id:'c',text:'교실'}],answer:'a',explanation:'비가 와도 운동장이 아닌 강당에서 진행해요.'},
      {id:'transfer-bring',prompt:'참가자가 가져와야 하는 것은 무엇입니까?',options:[{id:'a',text:'점심'},{id:'b',text:'물'},{id:'c',text:'우산'}],answer:'b',explanation:'점심은 학교에서 준비하고 물은 각자 가져오라고 안내했어요.'}
    ]},
  'racing-listening':{id:'racing-listening',title:'레이싱 · 듣고 세부 정보 찾기',skillIds:['ko.listening.detail'],difficulty:1,modality:'listening',responseFormat:'single-choice',assignable:false,minutes:5,href:'/korean-racing/?learning=listening',note:'WORLD의 듣기 연습 추천입니다. 게임 자유 연습 기록은 공유하지만 게임 과제 배정은 아직 지원하지 않습니다.'},
  'rhythm-listening':{id:'rhythm-listening',title:'시그널 리듬 · 듣고 뜻 확인하기',skillIds:['ko.listening.main'],difficulty:1,modality:'listening',responseFormat:'binary-choice',assignable:false,minutes:5,href:'/korean-rhythm/',note:'리듬 조작 점수는 한국어 수행 근거로 사용하지 않습니다. 이 MVP의 과제 배정 대상은 읽기 활동입니다.'}
});
export const CONTENT_CATALOG=freeze(Object.values(TASKS).map(({questions,passage,...item})=>item));
export function contentCatalog(state){return state.mode==='local-linked'?[...CONTENT_CATALOG.filter(c=>c.assignable),...GAME_CONTENT]:copy(CONTENT_CATALOG);}
// Both clients use the same versioned reading content and server-side answer key.
export function readingContent(){return Object.values(TASKS).filter(t=>t.assignable&&t.questions).map(({questions,...task})=>({...copy(task),questions:questions.map(({answer,explanation,...q})=>copy(q))}));}
export function submitPractice(state,actor,payload,options={}){
  scope(state,actor,'learner');object(payload);const now=clock(options),key=idempotencyKey(payload.idempotencyKey);
  const task=TASKS[payload.contentId];if(!task?.assignable||!task.questions)fail('CONTENT_NOT_ASSIGNABLE','읽기 활동을 선택해 주세요.');
  const answers=object(payload.answers),fingerprint=JSON.stringify([task.id,task.questions.map(q=>[q.id,answers[q.id]])]);
  state.practices??=[];
  const prior=state.practices.find(p=>p.learnerId===actor.id&&p.idempotencyKey===key);
  if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','같은 요청에 다른 답을 보낼 수 없어요.',409);return {ok:true,submission:copy(prior),duplicate:true};}
  const learner=state.learners.find(l=>l.id===actor.id),working=copy(state),assignmentId=`practice-${state.nextId}`;
  working.assignments.push({id:assignmentId,classId:learner.classId,learnerIds:[actor.id],contentId:task.id,taskSnapshot:copy(task),contentVersion:'v1',dueAt:new Date(now+DAY).toISOString(),status:'active',revision:1});
  const result=submitAssignment(working,actor,{assignmentId,revision:1,answers,idempotencyKey:`practice-${key}`},{now});
  learner.evidence=working.learners.find(l=>l.id===actor.id).evidence;state.nextId=working.nextId;
  const submission={...result.submission,assignmentId:null,kind:'practice',idempotencyKey:key,fingerprint};
  state.practices.push(submission);audit(state,actor,'practice.submitted',submission.id,submission.at);
  return {ok:true,submission:copy(submission),duplicate:false};
}
export const MODEL_VERSION='teacher-world-demo-1';
export const DEMO_TEACHER=freeze({id:'teacher-demo',role:'teacher',mode:'demo'});
export const demoLearnerActor=id=>freeze({id,role:'learner',mode:'demo'});

export class TeacherModelError extends Error {
  constructor(code,message,status=400){super(message);this.name='TeacherModelError';this.code=code;this.status=status;}
}
const fail=(code,message,status=400)=>{throw new TeacherModelError(code,message,status);};
function clock(options={}){const raw=options.now??Date.now(),time=typeof raw==='string'?Date.parse(raw):raw;if(!Number.isFinite(time)||!Number.isFinite(new Date(time).getTime()))fail('INVALID_TIME','시간을 확인하지 못했어요.');return time;}
function text(value,name,max,{optional=false}={}){if(optional&&(value==null||typeof value==='string'&&!value.trim()))return '';if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail('INVALID_INPUT',`${name}을 확인해 주세요.`);return value.trim();}
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID_INPUT','요청 내용을 확인해 주세요.');return value;}
function idempotencyKey(value){const key=text(value,'재전송 식별자',100);if(!/^[a-zA-Z0-9_.:-]+$/.test(key))fail('INVALID_INPUT','재전송 식별자를 확인해 주세요.');return key;}
function scope(state,actor,role){
  const demo=state?.mode==='demo'&&state.synthetic===true&&actor?.mode==='demo';
  const linked=state?.mode==='local-linked'&&state.synthetic===false&&actor?.mode==='local-linked';
  if(!demo&&!linked)fail('AUTH_NOT_CONFIGURED','인증된 로컬 연결 또는 합성 데모에서만 사용할 수 있어요.',403);
  if(state.schemaVersion!==1)fail('STATE_VERSION','저장된 자료의 버전을 확인해 주세요.',409);
  if(actor?.role!==role)fail('FORBIDDEN','이 작업을 할 권한이 없어요.',403);
  const owner=(role==='teacher'?state.teachers:state.learners).find(row=>row.id===actor.id);
  if(!owner)fail('FORBIDDEN','이 작업을 할 권한이 없어요.',403);
  return role==='teacher'?state.classes.filter(row=>row.teacherIds.includes(owner.id)):state.classes.filter(row=>row.learnerIds.includes(owner.id));
}
function allowedLearner(state,classes,id){const learner=state.learners.find(row=>row.id===id);if(!learner||!classes.some(row=>row.id===learner.classId&&row.learnerIds.includes(id)))fail('FORBIDDEN','담당 반에 속한 학생만 확인할 수 있어요.',403);return learner;}
function teacherAssignment(state,actor,id){const classes=scope(state,actor,'teacher'),assignment=state.assignments.find(row=>row.id===id);if(!assignment||!classes.some(row=>row.id===assignment.classId))fail('FORBIDDEN','담당 반의 과제만 변경할 수 있어요.',403);return assignment;}
function dueDate(value,now){const due=Date.parse(value);if(typeof value!=='string'||!Number.isFinite(due)||due<=now||due>now+366*DAY)fail('INVALID_DUE_DATE','마감은 지금 이후 1년 안의 날짜로 정해 주세요.');return new Date(due).toISOString();}
const nextId=(state,type)=>`${type}-${state.nextId++}`;
function audit(state,actor,action,targetId,at){state.audit.push({id:nextId(state,'audit'),actorId:actor.id,action,targetId,at});}

function profileFor(state,learner,now,candidates=contentCatalog(state)){
  const evidence=learner.evidence||[];
  // Only an explicitly scored language item enters Core. Motor performance and
  // free teacher notes remain visible provenance, never fabricated correctness.
  const attempts=evidence.filter(row=>row.source==='language-item'&&skillLabels.has(row.skillId)&&Number.isFinite(Date.parse(row.at))&&Date.parse(row.at)<=now&&['correct','incorrect','unassessed','skipped'].includes(row.verdict)&&[1,2,3].includes(row.difficulty??1)&&Learning.RESPONSE_FORMATS.includes(row.responseFormat??'single-choice')).map(row=>({eventId:row.id,at:row.at,verdict:row.verdict,
    independent:row.independent===true&&row.assisted!==true&&['correct','incorrect'].includes(row.verdict),assisted:row.assisted===true,
    measure:{skillId:row.skillId,difficulty:row.difficulty??1,responseFormat:row.responseFormat??'single-choice',familyKey:row.familyKey||row.id}}));
  const profile=Learning.summarizeLearning({summary:{asOf:new Date(now).toISOString(),attempts},map,complete:true});
  const presentations=evidence.filter(row=>row.source==='language-item'&&Date.parse(row.at)<=now).map(row=>({taskId:row.taskId,itemKey:row.itemKey}));
  const expanded=candidates.flatMap(c=>c.kind==='game'?gameProfiles(c):[c]),plan=Learning.recommend({profile,candidates:expanded,presentations}),unique=new Set();
  const recommendations=[plan.selected,...plan.alternatives].filter(candidate=>{if(!candidate)return false;const id=candidate.contentId||candidate.id;if(unique.has(id))return false;unique.add(id);return true;}).slice(0,3).map(candidate=>{
    const own=Learning.recommend({profile,candidates:[candidate],presentations});
    const supportingEvidence=evidence.filter(row=>row.source==='language-item'&&row.skillId===own.focusSkillId&&row.assisted===true&&Date.parse(row.at)<=now&&now-Date.parse(row.at)<=Learning.POLICY.recentDays*DAY).map(row=>row.id);
    return {contentId:candidate.contentId||candidate.id,title:candidate.title,skillId:own.focusSkillId,difficulty:candidate.difficulty,responseFormat:candidate.responseFormat,reason:own.reason,evidence:own.evidence,supportingEvidence,policy:own.policy,state:own.state,assignable:candidate.assignable,modality:candidate.modality,kind:candidate.kind||'reading',href:candidate.href||null,note:candidate.note||null};
  });
  return {policy:profile.policy,mapVersion:map.map_ver,learningEffectClaim:false,grade:null,
    skills:profile.skills.map(skill=>{const lastAt=skill.lastAt||evidence.filter(row=>row.source==='language-item'&&row.skillId===skill.id&&row.assisted===true&&Date.parse(row.at)<=now).map(row=>row.at).sort().at(-1)||null;
      return {id:skill.id,label:skill.label,domain:skill.domain,status:skill.status,n:skill.n,correct:skill.correct,incorrect:skill.incorrect,assisted:skill.assisted,lastAt,evidence:skill.evidence,
      source:skill.n?'independent-language-items':skill.assisted?'assisted-language-items':'insufficient-evidence',freshness:lastAt?(now-Date.parse(lastAt)>Learning.POLICY.recentDays*DAY?'stale':now-Date.parse(lastAt)>Learning.POLICY.reviewDays*DAY?'review-due':'recent'):'none',responseFormat:skill.responseFormat,difficulty:skill.difficulty};}),
    recommendation:recommendations[0]||null,recommendations,
    excludedEvidence:evidence.filter(row=>row.source!=='language-item').map(row=>({id:row.id,source:row.source,at:row.at,reason:'게임 조작과 관찰 메모는 정답률·급수의 근거로 계산하지 않아요.'})),
    evidence:evidence.map(row=>({id:row.id,skillId:row.skillId,at:row.at,source:row.source,verdict:row.source==='language-item'?row.verdict:'unassessed',independent:row.source==='language-item'&&row.independent===true&&row.assisted!==true,assisted:row.assisted===true,taskId:row.taskId||null,reason:row.reason||null,grading:row.grading||null,sourceEventId:row.sourceEventId||null}))};
}
function assignmentView(state,row,now,learnerId=null){
  const submissions=state.submissions.filter(item=>item.assignmentId===row.id&&(!learnerId||item.learnerId===learnerId));
  const base={id:row.id,classId:row.classId,contentId:row.contentId,contentVersion:row.contentVersion||'v1',title:row.title,dueAt:row.dueAt,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt,reason:row.reason,revision:row.revision,
    overdue:row.status==='active'&&Date.parse(row.dueAt)<now&&submissions.length<(learnerId?1:row.learnerIds.length),completedCount:submissions.length,lateCount:submissions.filter(item=>item.late).length};
  if(learnerId){const task=row.taskSnapshot||TASKS[row.contentId];return {...base,completed:submissions.length>0,submission:submissions[0]?copy(submissions[0]):null,content:{id:task.id,title:task.title,kind:task.kind||'reading',gameId:task.gameId,href:task.href,requiredAttempts:task.requiredAttempts,note:task.note,passage:task.passage,questions:(task.questions||[]).map(({answer,explanation,...question})=>copy(question))}};}
  const task=row.taskSnapshot||TASKS[row.contentId];
  return {...base,kind:task?.kind||'reading',requiredAttempts:task?.requiredAttempts||task?.questions?.length,learnerIds:[...row.learnerIds],assignedCount:row.learnerIds.length,createdBy:row.createdBy,cancelledAt:row.cancelledAt||null,cancelReason:row.cancelReason||null,recommendations:copy(row.recommendations),submissions:copy(submissions)};
}
function analyticsFor(state,classes,now){
  const ids=new Set(classes.flatMap(row=>row.learnerIds)),assignments=state.assignments.filter(row=>classes.some(c=>c.id===row.classId));
  const active=assignments.filter(row=>row.status==='active'),activeIds=new Set(active.map(row=>row.id));
  const completed=state.submissions.filter(row=>activeIds.has(row.assignmentId)&&ids.has(row.learnerId));
  const total=active.reduce((sum,row)=>sum+row.learnerIds.length,0);
  return {learners:ids.size,activeAssignments:active.length,assigned:total,completed:completed.length,pending:total-completed.length,
    overdue:active.reduce((sum,row)=>sum+(Date.parse(row.dueAt)<now?row.learnerIds.filter(id=>!completed.some(result=>result.assignmentId===row.id&&result.learnerId===id)).length:0),0),
    lateSubmissions:completed.filter(row=>row.late).length,correct:completed.reduce((sum,row)=>sum+row.correct,0),questions:completed.reduce((sum,row)=>sum+row.total,0),
    learningEffectClaim:false,note:'이 화면의 정답 수는 배정한 문항의 수행 결과입니다. TOPIK 급수나 학습 효과의 입증이 아닙니다.'};
}
export function getWorkspace(state,actor,options={}){
  const classes=scope(state,actor,'teacher'),now=clock(options),teacher=state.teachers.find(row=>row.id===actor.id);
  const allowedIds=new Set(classes.flatMap(row=>row.learnerIds));
  return {mode:state.mode,synthetic:state.synthetic,version:MODEL_VERSION,asOf:new Date(now).toISOString(),teacher:{id:teacher.id,name:teacher.name},content:copy(contentCatalog(state)),personalization:getPersonalization(state,actor,options),
    classes:classes.map(row=>({id:row.id,name:row.name,learners:row.learnerIds.map(id=>{
      const learner=allowedLearner(state,classes,id),profile=profileFor(state,learner,now);
      return {id:learner.id,name:learner.name,classId:learner.classId,...profile,
        assignments:state.assignments.filter(a=>a.classId===row.id&&a.learnerIds.includes(id)).map(a=>assignmentView(state,a,now)),
        observations:copy(state.observations.filter(item=>item.learnerId===id))};
    }),analytics:analyticsFor(state,[row],now)})),
    assignments:state.assignments.filter(row=>classes.some(c=>c.id===row.classId)).map(row=>assignmentView(state,row,now)),
    observations:copy(state.observations.filter(row=>allowedIds.has(row.learnerId))),analytics:analyticsFor(state,classes,now),
    integration:{core:Learning.POLICY.version,strata:map.map_ver,live:false,note:'기존 Atlas Core·Strata 정책을 합성 자료에 적용한 로컬 교사 어댑터입니다. 운영 학생 기록 API에는 연결되지 않았습니다.'}};
}
export function getStudentWorkspace(state,actor,options={}){
  const classes=scope(state,actor,'learner'),learner=allowedLearner(state,classes,actor.id),now=clock(options);
  return {mode:state.mode,synthetic:state.synthetic,learner:{id:learner.id,name:learner.name,classId:learner.classId},personalization:getPersonalization(state,actor,options),
    assignments:state.assignments.filter(row=>row.classId===learner.classId&&row.learnerIds.includes(learner.id)).map(row=>assignmentView(state,row,now,learner.id)),
    submissions:copy(state.submissions.filter(row=>row.learnerId===learner.id))};
}
export function createAssignment(state,actor,payload,options={}){
  const classes=scope(state,actor,'teacher'),now=clock(options);object(payload);
  const classroom=classes.find(row=>row.id===payload.classId);if(!classroom)fail('FORBIDDEN','담당 반에만 과제를 배정할 수 있어요.',403);
  const task=(state.mode==='local-linked'&&gameContent(payload.contentId))||TASKS[payload.contentId];if(!task?.assignable)fail('CONTENT_NOT_ASSIGNABLE','이 화면에서 연결 가능한 활동을 골라 주세요.');
  if(!Array.isArray(payload.learnerIds)||!payload.learnerIds.length||payload.learnerIds.length>100||new Set(payload.learnerIds).size!==payload.learnerIds.length)fail('INVALID_RECIPIENTS','과제를 받을 학생을 확인해 주세요.');
  const learners=payload.learnerIds.map(id=>{const learner=allowedLearner(state,[classroom],id);return learner;});
  const title=payload.title==null?task.title:text(payload.title,'과제 제목',100),reason=text(payload.reason,'배정 이유',500,{optional:true}),key=payload.idempotencyKey==null?null:idempotencyKey(payload.idempotencyKey);
  const fingerprint=JSON.stringify([classroom.id,[...payload.learnerIds].sort(),task.id,title,payload.dueAt,reason]);
  const prior=key&&state.assignments.find(row=>row.createdBy===actor.id&&row.idempotencyKey===key);
  if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','같은 요청에 다른 과제 내용을 보낼 수 없어요.',409);return {ok:true,assignment:assignmentView(state,prior,now),duplicate:true};}
  const dueAt=dueDate(payload.dueAt,now),at=new Date(now).toISOString();
  const recommendations=learners.map(learner=>{const recommended=profileFor(state,learner,now).recommendation;return {learnerId:learner.id,recommendedContentId:recommended?.contentId||null,reason:recommended?.reason||'',evidence:recommended?.evidence||[],policy:Learning.POLICY.version,teacherOverride:recommended?.contentId!==task.id,teacherReason:reason};});
  if(recommendations.some(row=>row.teacherOverride)&&!reason)fail('OVERRIDE_REASON_REQUIRED','추천과 다른 과제를 배정하는 이유를 짧게 적어 주세요.');
  const assignment={id:nextId(state,'assignment'),classId:classroom.id,learnerIds:learners.map(row=>row.id),contentId:task.id,contentVersion:'v1',taskSnapshot:copy(task),title,dueAt,reason,status:'active',revision:1,createdBy:actor.id,createdAt:at,updatedAt:at,recommendations,...(key?{idempotencyKey:key,fingerprint}:{})};
  state.assignments.push(assignment);audit(state,actor,'assignment.created',assignment.id,at);
  return {ok:true,assignment:assignmentView(state,assignment,now)};
}
export function updateAssignment(state,actor,payload,options={}){
  object(payload);const assignment=teacherAssignment(state,actor,payload.assignmentId),now=clock(options);
  if(assignment.status!=='active')fail('ASSIGNMENT_CANCELLED','취소한 과제는 변경할 수 없어요.',409);
  if(payload.revision!=null&&payload.revision!==assignment.revision)fail('REVISION_CONFLICT','과제가 변경되었어요. 최신 내용을 다시 확인해 주세요.',409);
  if(['learnerIds','classId','contentId'].some(key=>Object.hasOwn(payload,key)))fail('ASSIGNMENT_SCOPE_FIXED','학생과 활동을 바꾸려면 새 과제를 배정해 주세요.',409);
  const title=payload.title==null?assignment.title:text(payload.title,'과제 제목',100),dueAt=payload.dueAt==null?assignment.dueAt:dueDate(payload.dueAt,now),reason=payload.reason==null?assignment.reason:text(payload.reason,'변경 이유',500);
  assignment.title=title;assignment.dueAt=dueAt;assignment.reason=reason;assignment.revision++;assignment.updatedAt=new Date(now).toISOString();audit(state,actor,'assignment.updated',assignment.id,assignment.updatedAt);
  return {ok:true,assignment:assignmentView(state,assignment,now)};
}
export function cancelAssignment(state,actor,payload,options={}){
  object(payload);const assignment=teacherAssignment(state,actor,payload.assignmentId),now=clock(options);
  if(assignment.status==='cancelled')return {ok:true,assignment:assignmentView(state,assignment,now),duplicate:true};
  const reason=text(payload.reason,'취소 이유',500,{optional:true}),at=new Date(now).toISOString();
  assignment.status='cancelled';assignment.cancelledAt=at;assignment.cancelReason=reason;assignment.updatedAt=at;assignment.revision++;audit(state,actor,'assignment.cancelled',assignment.id,at);
  return {ok:true,assignment:assignmentView(state,assignment,now)};
}
export function addObservation(state,actor,payload,options={}){
  const classes=scope(state,actor,'teacher'),now=clock(options);object(payload);
  const learner=allowedLearner(state,classes,payload.learnerId);if(payload.classId!=null&&payload.classId!==learner.classId)fail('FORBIDDEN','학생의 반을 확인해 주세요.',403);
  if(!skillLabels.has(payload.skillId))fail('INVALID_SKILL','관찰할 학습 영역을 선택해 주세요.');
  const note=text(payload.note,'관찰 내용',1000),key=idempotencyKey(payload.idempotencyKey),fingerprint=JSON.stringify([learner.id,payload.skillId,note]);
  const prior=state.observations.find(row=>row.teacherId===actor.id&&row.idempotencyKey===key);
  if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','같은 요청에 다른 관찰 내용을 보낼 수 없어요.',409);return {ok:true,observation:copy(prior),duplicate:true};}
  const at=new Date(now).toISOString(),observation={id:nextId(state,'observation'),classId:learner.classId,learnerId:learner.id,teacherId:actor.id,skillId:payload.skillId,label:skillLabels.get(payload.skillId),note,at,source:'teacher-observation',reliability:'teacher-confirmed-note',idempotencyKey:key,fingerprint};
  state.observations.push(observation);audit(state,actor,'observation.noted',observation.id,at);
  return {ok:true,observation:copy(observation),duplicate:false};
}
export function submitAssignment(state,actor,payload,options={}){
  const classes=scope(state,actor,'learner'),now=clock(options);object(payload);
  const learner=allowedLearner(state,classes,actor.id),assignment=state.assignments.find(row=>row.id===payload.assignmentId);
  if(!assignment||assignment.classId!==learner.classId||!assignment.learnerIds.includes(learner.id)||payload.learnerId!=null&&payload.learnerId!==learner.id)fail('FORBIDDEN','본인에게 배정된 과제만 제출할 수 있어요.',403);
  const task=assignment.taskSnapshot||TASKS[assignment.contentId];if(task.kind==='game')fail('GAME_RUN_REQUIRED','게임은 WORLD 과제 시작으로 실행하고 실제 문항에 답해 주세요.');
  const answers=object(payload.answers),key=idempotencyKey(payload.idempotencyKey);
  if(Object.keys(answers).length!==task.questions.length||task.questions.some(question=>!Object.hasOwn(answers,question.id)||!question.options.some(option=>option.id===answers[question.id])))fail('INVALID_ANSWERS','모든 문항에서 보기 하나를 선택해 주세요.');
  const fingerprint=JSON.stringify([assignment.id,task.questions.map(question=>[question.id,answers[question.id]])]);
  const prior=state.submissions.find(row=>row.learnerId===learner.id&&row.idempotencyKey===key);
  if(prior){if(prior.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT','같은 제출 요청에 다른 답을 보낼 수 없어요.',409);return {ok:true,submission:copy(prior),duplicate:true};}
  if(state.mode==='local-linked'&&payload.revision!==assignment.revision)fail('REVISION_CONFLICT','과제가 바뀌었어요. 최신 과제를 다시 열어 주세요.',409);
  if(assignment.status!=='active')fail('ASSIGNMENT_CANCELLED','취소된 과제는 제출할 수 없어요.',409);
  if(state.submissions.some(row=>row.assignmentId===assignment.id&&row.learnerId===learner.id))fail('ALREADY_SUBMITTED','이미 제출한 과제예요.',409);
  const at=new Date(now).toISOString(),submissionId=nextId(state,'submission');
  const results=task.questions.map(question=>{const familyKey=`teacher-world:${task.id}:${question.id}:v1`,independent=!learner.evidence.some(row=>row.source==='language-item'&&row.familyKey===familyKey),verdict=answers[question.id]===question.answer?'correct':'incorrect';
    const evidence={id:nextId(state,'evidence'),skillId:task.skillIds[0],at,source:'language-item',verdict,independent,assisted:false,taskId:task.id,itemKey:question.id,familyKey,difficulty:task.difficulty,responseFormat:task.responseFormat,submissionId,reason:independent?'새 문항의 첫 제출':'같은 문항을 이전에 제출하여 새 독립 문항으로 계산하지 않음'};
    learner.evidence.push(evidence);return {questionId:question.id,answer:answers[question.id],correctAnswer:question.answer,correct:verdict==='correct',explanation:question.explanation,independent,evidenceId:evidence.id};});
  const submission={id:submissionId,assignmentId:assignment.id,learnerId:learner.id,classId:learner.classId,contentId:task.id,at,late:now>Date.parse(assignment.dueAt),correct:results.filter(row=>row.correct).length,total:results.length,results,idempotencyKey:key,fingerprint,learningEffectClaim:false};
  state.submissions.push(submission);audit(state,actor,'assignment.submitted',submission.id,at);
  return {ok:true,submission:copy(submission),duplicate:false};
}

// Personal preferences are separate from scored learning evidence. They never
// establish proficiency or grant membership, and teacher views do not expose a
// learner's private answers. Core selects a delivery plan within this one scope.
const field=(id,label,entries,defaultValue,group='context',description='')=>({id,label,description,group,default:defaultValue,options:entries.map(([value,label])=>({value,label}))});
const DISPLAY_FIELDS=[
  field('textSize','글자 크기',[['standard','기본'],['large','크게']],'standard','presentation'),
  field('detail','설명량',[['brief','짧게'],['standard','보통'],['detailed','자세히']],'standard','presentation'),
  field('motion','화면 움직임',[['full','기본'],['reduced','줄이기']],'full','presentation')
];
export const PERSONALIZATION_FIELDS=freeze({
  teacher:[
    field('goal','맡은 수업의 목표',[['topik','TOPIK I 준비'],['daily','생활 한국어']],'topik'),
    field('classFormat','수업 형태',[['group','반 수업'],['individual','개별 수업']],'group'),
    field('sessionMinutes','한 번의 수업 시간',[['20','20분'],['40','40분'],['60','60분']],'40'),
    field('preparationMinutes','수업 준비에 쓸 시간',[['5','5분'],['15','15분'],['30','30분']],'15'),
    field('experience','이 수업을 맡은 경험',[['new','처음 맡았어요'],['familiar','어느 정도 있어요'],['practiced','익숙해요']],'new','context','직접 고르는 수업 경험입니다. 교사 역량 평가에 쓰지 않아요.'),
    field('support','먼저 받고 싶은 도움',[['grouping','비슷한 약점 묶기'],['individual','개별 과제 준비'],['explanation','자료 설명 준비']],'grouping'),
    ...DISPLAY_FIELDS
  ],
  learner:[
    field('goal','이번 연습의 목표',[['topik','TOPIK I 준비'],['daily','생활 한국어']],'topik'),
    field('availableMinutes','한 번에 연습할 시간',[['3','3분'],['5','5분'],['10','10분']],'5'),
    field('audio','지금 소리를 들을 수 있나요?',[['off','소리를 듣기 어려워요'],['available','들을 수 있어요']],'available'),
    field('preference','연습 안내 방식',[['step','한 단계씩 안내'],['independent','먼저 혼자 풀기']],'step','context','선호하는 방식만 바꿉니다. 실력은 실제 언어 문항의 수행 기록으로 따로 확인해요.'),
    ...DISPLAY_FIELDS
  ]
});
const personalDefaults=role=>Object.fromEntries(PERSONALIZATION_FIELDS[role].map(row=>[row.id,row.default]));
function personalOwner(state,actor){
  if(!['teacher','learner'].includes(actor?.role))fail('FORBIDDEN','개인 설정을 바꿀 권한이 없어요.',403);
  const classes=scope(state,actor,actor.role);
  if(actor.role==='learner')allowedLearner(state,classes,actor.id);
  return {classes,key:`${actor.role}:${actor.id}`,scope:{personId:actor.id,productId:'teacher-world',contextId:actor.role,domain:'LAB'}};
}
export function migrateTeacherState(state){
  const migrated=copy(state);
  if(migrated.personalization==null)migrated.personalization={version:1,records:{}};
  if(migrated.personalization.version!==1||!migrated.personalization.records||typeof migrated.personalization.records!=='object'||Array.isArray(migrated.personalization.records))fail('STATE_VERSION','개인 설정 저장 버전을 확인해 주세요.',409);
  return migrated;
}
function personalRecord(state,key){
  const section=state.personalization;
  if(section==null)return null;
  if(section.version!==1||!section.records||typeof section.records!=='object'||Array.isArray(section.records))fail('STATE_VERSION','개인 설정 저장 버전을 확인해 주세요.',409);
  return Object.hasOwn(section.records,key)?section.records[key]:null;
}
function personalAnswers(role,value){
  object(value);
  const fields=PERSONALIZATION_FIELDS[role];
  if(Object.keys(value).some(key=>!fields.some(row=>row.id===key)))fail('INVALID_PERSONALIZATION','지원하는 개인 설정만 저장할 수 있어요.');
  const result={};
  for(const [key,answer] of Object.entries(value)){
    if(!fields.find(row=>row.id===key).options.some(option=>option.value===answer))fail('INVALID_PERSONALIZATION','개인 설정의 선택값을 확인해 주세요.');
    result[key]=answer;
  }
  return result;
}
function foundationValues(role,answers){
  const values={};
  if(role==='teacher'&&answers.support){values.goal={grouping:'prepare',individual:'study',explanation:'clarity'}[answers.support];values.support={grouping:'choose',individual:'independent',explanation:'step'}[answers.support];}
  if(role==='learner'&&answers.goal)values.goal=answers.goal==='topik'?'study':'explore';
  if(role==='learner'&&answers.preference)values.support=answers.preference;
  const minutes=role==='teacher'?answers.sessionMinutes:answers.availableMinutes;
  if(minutes)values.minutes=Number(minutes);
  for(const key of ['experience','audio','textSize','motion'])if(answers[key])values[key]=answers[key];
  if(answers.detail)values.explanation=answers.detail;
  return values;
}
function personalCandidates(role,answers){
  if(role==='teacher')return [
    {id:'group-evidence',minutes:Number(answers.sessionMinutes),pace:'standard',goals:['prepare'],requiresAudio:false},
    {id:'individual-practice',minutes:Number(answers.sessionMinutes),pace:'standard',goals:['study'],requiresAudio:false},
    {id:'explain-together',minutes:Number(answers.sessionMinutes),pace:'standard',goals:['clarity'],requiresAudio:false}
  ];
  return [
    {id:'guided-practice',minutes:3,pace:'short',goals:['study'],supports:['step'],requiresAudio:false},
    {id:'try-then-check',minutes:3,pace:'short',goals:['explore'],supports:['independent'],requiresAudio:false},
    {id:'context-first',minutes:3,pace:'short',goals:['clarity'],supports:['choose'],requiresAudio:false}
  ];
}
function refreshPersonalDecision(record,actor,owner,now){
  const effective={...personalDefaults(actor.role),...record.answers};
  const decision=Personalization.selectPersonalization({profile:record.profile,scope:owner.scope,candidates:personalCandidates(actor.role,effective),experienceId:actor.role==='teacher'?'teacher-lesson-plan':'student-practice-plan',events:record.events||[],at:new Date(now).toISOString()});
  record.profile=decision.profile;record.events=decision.events;record.decision=decision.plan;record.presentation=decision.presentation;
  record.reasons=decision.reasons||[];record.completionId=null;
}
const instructionFor=(answers)=>answers.detail==='brief'?'안내문을 읽고 정답의 근거가 되는 문장을 찾아요.':answers.detail==='detailed'?'먼저 안내문 전체를 읽고, 질문의 핵심 낱말을 표시해요. 알맞은 보기를 고른 뒤 근거 문장을 다시 찾아 보고 제출 후 해설과 비교해요.':'안내문을 읽고 세 문항을 풀어요. 헷갈린 문장의 근거를 찾아 제출 후 해설과 비교해요.';
function teacherBenefits(state,classes,answers,selected,active,now){
  const kind=selected||'group-evidence',minutes=Number(answers.sessionMinutes),prep=Number(answers.preparationMinutes);
  const names={'group-evidence':'비슷한 학습 근거부터 함께 살피는 수업','individual-practice':'각자 필요한 연습을 고르는 수업','explain-together':'자료의 뜻과 풀이를 함께 설명하는 수업'};
  const first=Math.max(3,Math.round(minutes*.15)),last=Math.max(3,Math.round(minutes*.2));
  const instructions=instructionFor(answers),days=answers.classFormat==='individual'?1:3;
  const lessonPlans=classes.map(classroom=>({classId:classroom.id,title:names[kind]||names['group-evidence'],minutes,preparationMinutes:prep,learnerIds:[...classroom.learnerIds],
    steps:[
      {title:answers.experience==='new'?'수업 목표와 진행 순서 안내':'오늘의 목표 확인',minutes:first,description:answers.goal==='topik'?'TOPIK I 읽기에서 확인할 정보와 질문을 연결해요.':'안내문을 실제 생활의 상황과 연결해요.'},
      {title:kind==='individual-practice'?'각자 필요한 문항 풀기':kind==='explain-together'?'근거 문장을 함께 설명하기':'비슷한 연습이 필요한 학생끼리 확인하기',minutes:minutes-first-last,description:prep<=5?'준비된 읽기 활동을 이용하고, 실제 수행 근거가 있는 영역부터 확인해요.':answers.classFormat==='individual'?'학생의 독립 수행과 도움 받은 수행을 나눠 살피며 풀이를 확인해요.':'반 학생의 추천 영역을 살펴 소그룹 또는 개별 연습으로 연결해요.'},
      {title:'풀이 확인과 다음 연습',minutes:last,description:instructions}
    ]}));
  const assignmentTemplates=classes.flatMap(classroom=>classroom.learnerIds.flatMap(id=>{
    const learner=allowedLearner(state,[classroom],id),rec=profileFor(state,learner,now).recommendation,content=CONTENT_CATALOG.find(row=>row.id===rec?.contentId);
    return content?.assignable?[{classId:classroom.id,learnerId:id,contentId:content.id,title:content.title,reason:`${rec.reason} ${instructions}`,defaultAssignmentDays:days,minutes:content.minutes}]:[];
  }));
  const reason=active?`${minutes}분 수업 · ${prep}분 준비 · ${answers.classFormat==='individual'?'개별':'반'} 수업에 맞췄어요. 답한 수업 경험은 안내 수준에만 반영해요.`:'설정 없이도 사용할 수 있는 기본 수업안이에요. 학생의 학습 근거와 교사의 개인 설정은 따로 관리해요.';
  return {benefit:{title:names[kind]||names['group-evidence'],reason,steps:lessonPlans[0]?.steps.map(row=>`${row.title} · ${row.minutes}분`)||[],suggestedView:kind==='individual-practice'?'assignments':kind==='explain-together'?'review':'students',defaultAssignmentDays:days,instructions},lessonPlans,assignmentTemplates};
}
function learnerBenefits(state,actor,classes,answers,selected,active,now){
  const learner=allowedLearner(state,classes,actor.id);
  const available=CONTENT_CATALOG.filter(row=>row.minutes<=Number(answers.availableMinutes)&&(answers.audio!=='off'||row.modality!=='listening'));
  // Ask the existing language policy to rank the remaining candidates, rather
  // than assigning proficiency from goal, preferences or game motor scores.
  const recommendations=profileFor(state,learner,now,available).recommendations;
  const rec=recommendations[0],method=selected==='try-then-check'?'먼저 풀고 풀이 확인':selected==='context-first'?'상황을 살피고 연습':'한 단계씩 연습';
  const steps=selected==='context-first'?['어디에서 볼 수 있는 안내문인지 생각해요.','실제 상황에 나를 넣어 문항을 풀어요.','제출 후 상황과 정답 근거를 연결해요.']:selected==='try-then-check'||(!selected&&answers.preference==='independent')?['안내문을 먼저 혼자 읽어요.','문항을 풀고 제출해요.','해설과 근거 문장을 비교해요.']:['상황과 목표부터 확인해요.','문항마다 근거 문장을 찾아요.','제출 후 해설을 읽어요.'];
  const why=answers.audio==='off'?'지금은 소리가 필요 없는 읽기 연습만 골랐어요.':`${answers.availableMinutes}분 안에 할 수 있는 연습을 골랐어요.`;
  return {benefit:{title:rec?`${rec.title} · ${method}`:'먼저 읽기 연습을 확인해요.',reason:`${active?why:'기본 연습 순서로 시작해요.'} ${rec?.reason||''}`,steps, instructions:instructionFor(answers)},recommendations,
    explanation:{preferences:'목표·시간·소리 환경·안내 선호는 지금 할 연습과 보여 주는 방식을 바꿔요.',evidence:'실력 판단은 독립적으로 푼 한국어 문항의 기록으로 따로 해요. 게임 조작 점수와 본인이 고른 선호를 실력으로 계산하지 않아요.',policy:Learning.POLICY.version},lessonPlans:[],assignmentTemplates:[]};
}
export function getPersonalization(state,actor,options={}){
  const owner=personalOwner(state,actor),now=clock(options),record=personalRecord(state,owner.key),active=record?.status==='active'&&record.consent===true;
  const answers={...personalDefaults(actor.role),...(active?record.answers:{})},status=record?.status||'new';
  const result=actor.role==='teacher'?teacherBenefits(state,owner.classes,answers,record?.decision?.selected?.id,active,now):learnerBenefits(state,actor,owner.classes,answers,record?.decision?.selected?.id,active,now);
  if(active&&PERSONALIZATION_FIELDS[actor.role].some(field=>!Object.hasOwn(record.answers,field.id)))result.benefit.reason+=' 선택하지 않은 항목은 기본 운영값을 사용해요.';
  if(active&&record.decision?.reasons?.includes('feedback.alternative'))result.benefit.reason+=' 다른 방법을 원한다는 의견을 반영해 다음 방식을 바꿨어요.';
  if(active&&record.decision?.reasons?.includes('feedback.no_alternative'))result.benefit.reason+=' 현재 선택한 조건에 맞는 다른 방식이 없어 이 방식을 유지했어요. 설정은 언제든 바꿀 수 있어요.';
  return {status,revision:record?.revision||0,consent:active,answers:active?copy(record.answers):{},fields:copy(PERSONALIZATION_FIELDS[actor.role]),
    presentation:{textSize:answers.textSize,detail:answers.detail,explanation:answers.detail,motion:answers.motion},
    decisionId:active?record?.decision?.id||null:null,completionId:active?record?.completionId||null:null,feedbackAllowed:active&&!!record?.completionId,
    policy:Personalization.VERSION||'core-personalization-1',scope:{role:actor.role,personId:actor.id},...result};
}
function personalWriteContext(state,actor,payload,options){
  object(payload);const owner=personalOwner(state,actor),now=clock(options),previous=personalRecord(state,owner.key);
  if(payload.personId!=null&&payload.personId!==actor.id||payload.learnerId!=null&&payload.learnerId!==actor.id||payload.role!=null&&payload.role!==actor.role)fail('FORBIDDEN','본인의 개인 설정만 바꿀 수 있어요.',403);
  if(!Number.isInteger(payload.revision)||payload.revision!==(previous?.revision||0))fail('REVISION_CONFLICT','개인 설정이 변경되었어요. 새로 불러와 주세요.',409);
  return {owner,now,previous};
}
function storePersonalRecord(state,key,record){
  if(state.personalization==null)state.personalization={version:1,records:{}};
  state.personalization.records[key]=record;
}
export function updatePersonalization(state,actor,payload,options={}){
  const {owner,now,previous}=personalWriteContext(state,actor,payload,options),at=new Date(now).toISOString();
  if(!['save','skip','disable','clear'].includes(payload.action))fail('INVALID_PERSONALIZATION','개인 설정 동작을 확인해 주세요.');
  const profile=previous?.profile||Personalization.createProfile({scope:owner.scope,at});
  let next;
  if(payload.action==='save'){
    if(payload.consent!==true)fail('CONSENT_REQUIRED','개인화에 사용할 내용에 동의한 경우에만 저장해요.');
    const answers=personalAnswers(actor.role,payload.answers);
    const declared=foundationValues(actor.role,answers),values={...Object.fromEntries(Object.keys(profile.values).filter(key=>!Object.hasOwn(declared,key)).map(key=>[key,null])),...declared};
    next={revision:(previous?.revision||0)+1,status:'active',consent:true,answers,profile:Personalization.updateProfile(profile,{values,consent:true},at),events:previous?.events||[]};
    refreshPersonalDecision(next,actor,owner,now);
  }else{
    const mode={skip:'skip',disable:'disable',clear:'delete'}[payload.action];
    next={revision:(previous?.revision||0)+1,status:{skip:'skipped',disable:'disabled',clear:'new'}[payload.action],consent:false,answers:{},events:[],profile:Personalization.clearProfile(profile,{mode,at})};
    // A revision tombstone blocks stale saves after erasure; no old answers,
    // decision reasons, feedback events or assignment evidence are copied here.
  }
  storePersonalRecord(state,owner.key,next);
  return {ok:true,personalization:getPersonalization(state,actor,options)};
}
export function completePersonalization(state,actor,payload,options={}){
  const {owner,now,previous}=personalWriteContext(state,actor,payload,options);
  if(previous?.status!=='active'||!previous.consent)fail('PERSONALIZATION_DISABLED','개인 설정을 켠 뒤 사용할 수 있어요.',409);
  if(payload.decisionId!==previous.decision?.id)fail('DECISION_CONFLICT','지금 표시된 수업안을 다시 확인해 주세요.',409);
  if(previous.completionId)return {ok:true,personalization:getPersonalization(state,actor,options),duplicate:true};
  const next=copy(previous),result=Personalization.recordCompletion({profile:next.profile,scope:owner.scope,events:next.events,decisionId:payload.decisionId,at:new Date(now).toISOString()});
  next.events=result;next.completionId=result.find(row=>row.type==='experience.completed'&&row.decisionId===payload.decisionId)?.id||null;next.revision++;
  storePersonalRecord(state,owner.key,next);return {ok:true,personalization:getPersonalization(state,actor,options)};
}
export function feedbackPersonalization(state,actor,payload,options={}){
  const {owner,now,previous}=personalWriteContext(state,actor,payload,options);
  if(previous?.status!=='active'||!previous.consent)fail('PERSONALIZATION_DISABLED','개인 설정을 켠 뒤 사용할 수 있어요.',409);
  if(!previous.completionId||payload.completionId!==previous.completionId)fail('COMPLETION_REQUIRED','현재 수업안을 사용한 뒤 의견을 남길 수 있어요.',409);
  if(!['helpful','not_fit','too_much','want_more'].includes(payload.value))fail('INVALID_FEEDBACK','의견의 선택값을 확인해 주세요.');
  const next=copy(previous),result=Personalization.recordFeedback({profile:next.profile,scope:owner.scope,events:next.events,completionId:payload.completionId,value:payload.value,at:new Date(now).toISOString()});
  next.events=result;next.revision++;refreshPersonalDecision(next,actor,owner,now);
  storePersonalRecord(state,owner.key,next);return {ok:true,personalization:getPersonalization(state,actor,options)};
}
