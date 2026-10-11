'use strict';
// Native WORLD pages name an existing operation; URLs, methods and credentials
// remain in main. The server remains authoritative for ownership and grading.
const ROUTES=Object.freeze({
  bootstrap:['GET','synk-world-v1/bootstrap'],
  'play/start':['POST','synk-world-v1/play/start'],
  'play/complete':['POST','synk-world-v1/play/complete'],
  'avatar/outfit':['PUT','synk-world-v1/avatar/outfit'],
  'wardrobe/looks':['PUT','synk-world-v1/wardrobe/looks'],
  'town/entry':['GET','synk-town/entry'],
  'town/state':['GET','synk-town/state'],
  'town/command':['POST','synk-town/command'],
  'town/presence':['POST','synk-town/presence'],
  'town/sharing':['POST','synk-classroom/api/world/town/sharing'],
  'enrollment/preview':['POST','synk-classroom/api/enrollment/preview'],
  'enrollment/claim':['POST','synk-classroom/api/enrollment/claim'],
});
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const id=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[\x00-\x1f\x7f]/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=0;
function invalid(){throw Object.assign(Error('WORLD 요청 형식을 확인해 주세요.'),{code:'INVALID_REQUEST'});}
function keys(value,allowed,required=allowed){if(!record(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))invalid();}
function copyJson(value,seen=new Set(),depth=0){
  if(depth>20)invalid();
  if(value===null||typeof value==='boolean'||typeof value==='string')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))invalid();return value;}
  if(!Array.isArray(value)&&!record(value)||seen.has(value))invalid();seen.add(value);
  const result=Array.isArray(value)?Array.from(value,v=>copyJson(v,seen,depth+1)):Object.create(null);
  if(!Array.isArray(value))for(const key of Object.keys(value)){if(['__proto__','prototype','constructor'].includes(key))invalid();result[key]=copyJson(value[key],seen,depth+1);}
  seen.delete(value);return result;
}
function slots(value){keys(value,['body','neck']);if(![value.body,value.neck].every(v=>typeof v==='string'&&v.length<=128&&!/[\x00-\x1f\x7f]/.test(v)))invalid();}
function dyes(value){if(value!==undefined){if(!record(value)||Object.keys(value).length>24)invalid();}}
function validateBody(route,body){
  switch(route){
    case 'play/start':keys(body,['requestId']);if(!uuid(body.requestId))invalid();break;
    case 'play/complete':keys(body,['runId','requestId','answers']);if(!uuid(body.runId)||!uuid(body.requestId)||!Array.isArray(body.answers)||body.answers.length>100)invalid();for(const a of body.answers){keys(a,['questionId','optionId']);if(!id(a.questionId)||!id(a.optionId))invalid();}break;
    case 'avatar/outfit':keys(body,['slots','dyes','expectedRevision','requestId'],['slots','expectedRevision','requestId']);slots(body.slots);dyes(body.dyes);if(!revision(body.expectedRevision)||!uuid(body.requestId))invalid();break;
    case 'wardrobe/looks':keys(body,['looks','expectedRevision','requestId']);if(!revision(body.expectedRevision)||!uuid(body.requestId)||!Array.isArray(body.looks)||body.looks.length>24)invalid();for(const look of body.looks){keys(look,['id','name','slots','dyes'],['id','name','slots']);if(!id(look.id)||typeof look.name!=='string'||look.name.length>120)invalid();slots(look.slots);dyes(look.dyes);}break;
    case 'town/command':keys(body,['id','type','payload','expectedRevision']);if(!id(body.id)||!id(body.type)||!record(body.payload)||!revision(body.expectedRevision))invalid();break;
    case 'town/presence':keys(body,['surfaceId','surface','foreground','safe']);if(!id(body.surfaceId)||!id(body.surface)||typeof body.foreground!=='boolean'||typeof body.safe!=='boolean')invalid();break;
    case 'town/sharing':keys(body,['enabled','revision']);if(typeof body.enabled!=='boolean'||!revision(body.revision))invalid();break;
    case 'enrollment/preview':case 'enrollment/claim':keys(body,route.endsWith('claim')?['token','confirm']:['token']);if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{22,128}$/.test(body.token)||route.endsWith('claim')&&body.confirm!==true)invalid();break;
    default:invalid();
  }
}
function worldRequestSpec(params,product,clientKey){
  if(product!=='world'||clientKey!=='world')invalid();keys(params,['route','body','classId'],['route']);
  const {route,body,classId}=params;if(typeof route!=='string'||!Object.hasOwn(ROUTES,route))invalid();
  const [method,endpoint]=ROUTES[route];let path=endpoint;
  if(classId!==undefined){if(!uuid(classId)||!['town/state','town/command','town/presence','town/sharing'].includes(route))invalid();path+='?classId='+encodeURIComponent(classId);}
  if(route==='town/sharing'&&classId===undefined)invalid();
  if(method==='GET'){if(body!==undefined)invalid();return {path};}
  validateBody(route,body);const encoded=JSON.stringify(copyJson(body));if(Buffer.byteLength(encoded)>524288)invalid();
  return {path,method,body:JSON.parse(encoded)};
}
module.exports={worldRequestSpec};
