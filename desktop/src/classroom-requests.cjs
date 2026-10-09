'use strict';
// Main-process allowlist: callers provide an operation, never a URL or headers.
const ROUTES=Object.freeze({
  classes:['GET','classes'],workspace:['GET','workspace'],account:['GET','world/account'],
  student:['GET','student'],practice:['GET','world/practice'],practiceSubmit:['POST','world/practice'],
  submit:['POST','submissions'],sharing:['POST','world/sharing'],startRun:['POST','world/runs/start'],
  stopRun:['POST','world/runs/stop'],learningGet:['GET','world/learning'],learningPost:['POST','world/learning'],
  townRead:['GET','world/town'],townCommand:['POST','world/town/command'],assignments:['POST','assignments'],
  assignmentUpdate:['POST','assignments/update'],assignmentCancel:['POST','assignments/cancel'],observations:['POST','observations'],
  teacherOverview:['GET','teacher/overview'],care:['GET','teacher/care'],careSave:['POST','teacher/care'],enrollmentInvite:['POST','teacher/invites'],enrollmentPreview:['POST','enrollment/preview'],enrollmentClaim:['POST','enrollment/claim'],
  townMembership:['GET','world/town/membership'],townSharing:['POST','world/town/sharing'],townActivity:['POST','world/town/activity'],
});
function invalid(){throw Object.assign(new Error('수업 요청 형식을 확인해 주세요.'),{code:'INVALID_REQUEST'});}
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function jsonCopy(value,seen=new Set(),depth=0){
  if(depth>32)invalid();
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))invalid();return value;}
  if(!Array.isArray(value)&&!record(value)||seen.has(value))invalid();
  seen.add(value);let result;
  if(Array.isArray(value))result=Array.from(value,item=>jsonCopy(item,seen,depth+1));
  else {result=Object.create(null);for(const key of Object.keys(value)){if(['__proto__','prototype','constructor'].includes(key))invalid();result[key]=jsonCopy(value[key],seen,depth+1);}}
  seen.delete(value);return result;
}
function classroomRequestSpec(params,product){
  if(!['world','platform'].includes(product)||!record(params)||Object.keys(params).some(key=>!['operation','classId','query','body'].includes(key)))invalid();
  const {operation,classId,query,body}=params;
  if(typeof operation!=='string'||!Object.hasOwn(ROUTES,operation))invalid();
  const [method,route]=ROUTES[operation],search=new URLSearchParams();
  if(['classes','teacherOverview','enrollmentPreview','enrollmentClaim'].includes(operation)){if(classId!==undefined)invalid();}
  else {if(typeof classId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(classId))invalid();search.set('classId',classId);}
  if(operation==='learningGet'){
    if(!record(query)||Object.keys(query).some(key=>!['after','revision'].includes(key)))invalid();
    for(const key of ['after','revision']){if(!Number.isSafeInteger(query[key])||query[key]<0)invalid();search.set(key,String(query[key]));}
  }else if(query!==undefined)invalid();
  const url='synk-classroom/api/'+route+(search.size?'?'+search.toString():'');
  if(method==='GET'){if(body!==undefined)invalid();return {path:url};}
  if(!record(body)||body.classId!==undefined&&body.classId!==classId)invalid();
  const copy=jsonCopy(body),serialized=JSON.stringify(copy);
  if(Buffer.byteLength(serialized)>524288)invalid();
  return {path:url,body:JSON.parse(serialized)};
}
module.exports={classroomRequestSpec};
